"""Evidence storage for the level-3 audio recording.

Layout on disk::

    $EVIDENCE_DIR/<session-id>/000000.m4a
    $EVIDENCE_DIR/<session-id>/000001.m4a
    ...

The phone records in ~30s segments and uploads each one as soon as it closes, so
the worst case loss is one segment rather than the whole recording.

Each segment carries a SHA-256 digest that the server recomputes and checks
before accepting it. `seq` is unique per session, which makes retransmission of a
segment that was already stored a harmless no-op — important because the client
retries uploads over exactly the kind of bad network where partial failures
happen.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from hy.config import get_settings
from hy.models import EVIDENCE_FINALIZED, EvidenceChunk, EvidenceSession, utcnow

log = logging.getLogger(__name__)

SESSION_ID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")
CHUNK_NAME_TEMPLATE = "{seq:06d}.m4a"
MAX_MANIFEST_CHUNKS = 10_000


class EvidenceError(Exception):
    """Raised for rejected evidence uploads."""


@dataclass(slots=True)
class StoredChunk:
    seq: int
    sha256: str
    size_bytes: int
    path: Path
    created: bool


def _validate_session_id(session_id: str) -> str:
    if not SESSION_ID_RE.match(session_id):
        raise EvidenceError("invalid evidence session id")
    return session_id


def session_dir(session_id: str) -> Path:
    root = Path(get_settings().evidence_dir).expanduser()
    return root / _validate_session_id(session_id)


def chunk_path(session_id: str, seq: int) -> Path:
    return session_dir(session_id) / CHUNK_NAME_TEMPLATE.format(seq=seq)


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def store_chunk(
    db: Session,
    evidence: EvidenceSession,
    *,
    seq: int,
    payload: bytes,
    declared_sha256: str | None,
    mime: str = "audio/mp4",
    offset_s: float | None = None,
    client_ts: float | None = None,
) -> StoredChunk:
    """Validate and persist one audio segment. Idempotent on `seq`."""
    if seq < 0:
        raise EvidenceError("seq must be >= 0")
    if not payload:
        raise EvidenceError("empty chunk")

    limit = get_settings().evidence_max_chunk_bytes
    if len(payload) > limit:
        raise EvidenceError(f"chunk too large: {len(payload)} > {limit} bytes")

    digest = sha256_hex(payload)
    if declared_sha256 and declared_sha256.lower() != digest:
        raise EvidenceError("chunk digest mismatch — upload corrupted")

    existing = (
        db.query(EvidenceChunk)
        .filter(EvidenceChunk.session_id == evidence.id, EvidenceChunk.seq == seq)
        .one_or_none()
    )
    if existing is not None:
        # Retransmit of a segment we already have: verify it matches and stop.
        if existing.sha256 != digest:
            raise EvidenceError(f"seq {seq} already stored with a different digest")
        log.info("evidence chunk seq=%s duplicate, ignoring", seq)
        return StoredChunk(
            seq=seq,
            sha256=existing.sha256,
            size_bytes=existing.size_bytes,
            path=Path(existing.storage_path),
            created=False,
        )

    if len(evidence.chunks) >= MAX_MANIFEST_CHUNKS:
        raise EvidenceError("evidence session has too many chunks")

    directory = session_dir(evidence.id)
    directory.mkdir(parents=True, exist_ok=True)
    target = chunk_path(evidence.id, seq)

    # Write to a temp file then rename, so a partial write never looks complete.
    tmp = target.with_suffix(".part")
    tmp.write_bytes(payload)
    tmp.replace(target)

    chunk = EvidenceChunk(
        session_id=evidence.id,
        seq=seq,
        sha256=digest,
        size_bytes=len(payload),
        mime=mime,
        storage_path=str(target),
        offset_s=offset_s,
        client_ts=client_ts,
    )
    db.add(chunk)
    db.flush()
    db.refresh(evidence)

    evidence.total_bytes = sum(c.size_bytes for c in evidence.chunks)
    evidence.chunk_count = len(evidence.chunks)
    db.flush()

    return StoredChunk(seq=seq, sha256=digest, size_bytes=len(payload), path=target, created=True)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def build_manifest(evidence: EvidenceSession) -> dict[str, Any]:
    """Build the chain-of-custody manifest: what, when, where, in what order."""
    chunks = sorted(evidence.chunks, key=lambda c: c.seq)
    expected_seq = list(range(len(chunks)))
    contiguous = [c.seq for c in chunks] == expected_seq

    chunks_out = [
        {
            "seq": c.seq,
            "sha256": c.sha256,
            "sizeBytes": c.size_bytes,
            "mime": c.mime,
            "offsetS": c.offset_s,
            "clientTs": c.client_ts,
            "receivedAt": _iso(c.received_at),
        }
        for c in chunks
    ]

    # Chain digest: sha256 over "seq:digest" lines, in order.
    chain_input = "\n".join(f"{c['seq']}:{c['sha256']}" for c in chunks_out)
    manifest_sha = hashlib.sha256(chain_input.encode("utf-8")).hexdigest()

    return {
        "sessionId": evidence.id,
        "alertId": evidence.alert_id,
        "userId": evidence.user_id,
        "status": evidence.status,
        "startedAt": _iso(evidence.started_at),
        "endedAt": _iso(evidence.ended_at),
        "durationS": evidence.duration_s,
        "chunkSeconds": evidence.chunk_seconds,
        "chunkCount": len(chunks),
        "totalBytes": sum(c.size_bytes for c in chunks),
        "contiguous": contiguous,
        "location": {
            "start": {"lat": evidence.start_lat, "lng": evidence.start_lng},
            "end": {"lat": evidence.end_lat, "lng": evidence.end_lng},
        },
        "chunks": chunks_out,
        "manifestSha256": manifest_sha,
        "generatedAt": _iso(utcnow()),
    }


def finalize(
    db: Session,
    evidence: EvidenceSession,
    *,
    duration_s: float | None = None,
    end_lat: float | None = None,
    end_lng: float | None = None,
    chunk_count: int | None = None,
) -> dict[str, Any]:
    """Close a session and freeze its chain-of-custody manifest.

    `chunk_count` is the client's view of how many segments it recorded; a
    mismatch against what arrived is recorded in the manifest rather than
    treated as an error, because a gap is exactly the kind of thing a reviewer
    needs to see.
    """
    if duration_s is not None:
        evidence.duration_s = duration_s
    if end_lat is not None:
        evidence.end_lat = end_lat
    if end_lng is not None:
        evidence.end_lng = end_lng

    evidence.status = EVIDENCE_FINALIZED
    evidence.ended_at = evidence.ended_at or utcnow()
    db.flush()

    manifest = build_manifest(evidence)
    if chunk_count is not None:
        manifest["clientReportedChunkCount"] = chunk_count
        manifest["missingChunks"] = max(0, chunk_count - manifest["chunkCount"])

    evidence.manifest = manifest
    evidence.manifest_sha256 = manifest["manifestSha256"]
    evidence.chunk_count = manifest["chunkCount"]
    evidence.total_bytes = manifest["totalBytes"]
    db.flush()

    return manifest


def uploaded_sequences(session: EvidenceSession) -> list[int]:
    return sorted(c.seq for c in session.chunks)


def next_expected_seq(session: EvidenceSession) -> int:
    """Lowest seq not yet stored — tells the client what to resume from."""
    uploaded = set(uploaded_sequences(session))
    seq = 0
    while seq in uploaded:
        seq += 1
    return seq


def session_media_dir(session_id: str) -> Path:
    return session_dir(session_id)


def media_file(session_id: str, seq: int) -> Path:
    """Locate a stored segment, tolerating a filename written by an older build."""
    path = chunk_path(session_id, seq)
    if path.exists():
        return path
    directory = session_media_dir(session_id)
    if not directory.exists():
        raise EvidenceError("evidence session has no stored media")
    for candidate in sorted(directory.glob(f"*{seq}*.m4a")):
        return candidate
    raise EvidenceError(f"segment {seq} not found")


def to_json_bytes(manifest: dict[str, Any]) -> bytes:
    return json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8")
