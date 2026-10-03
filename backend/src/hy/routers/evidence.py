"""Evidence endpoints: session metadata, chunked upload, finalize, playback."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, Header, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select

from hy.auth import CurrentPrincipal
from hy.db import session_scope
from hy.evidence import (
    EvidenceError,
    build_manifest,
    media_file,
    next_expected_seq,
    store_chunk,
    to_json_bytes,
)
from hy.evidence import (
    finalize as finalize_session,
)
from hy.models import EVIDENCE_FINALIZED, EvidenceSession, LocationPing
from hy.schemas import EvidenceFinalize, EvidenceFinalizeOut, EvidenceSessionOut

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/evidence", tags=["evidence"])

CHUNK_FORM_FIELD = "chunk"


def _owned_session(session, session_id: str, user_id: str) -> EvidenceSession:
    evidence = session.get(EvidenceSession, session_id)
    if evidence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak sesji nagrania")
    if evidence.user_id != user_id:
        # Do not leak existence of other people's evidence.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak sesji nagrania")
    return evidence


def _to_out(evidence: EvidenceSession) -> EvidenceSessionOut:
    uploaded = [c.size_bytes for c in evidence.chunks]
    return EvidenceSessionOut(
        id=evidence.id,
        alertId=evidence.alert_id,
        userId=evidence.user_id,
        status=evidence.status,
        startedAt=evidence.started_at,
        endedAt=evidence.ended_at,
        chunkSeconds=evidence.chunk_seconds,
        chunkCount=len(evidence.chunks),
        totalBytes=sum(uploaded),
        durationS=evidence.duration_s,
        uploadedBytes=sum(uploaded),
        expectedChunkCount=evidence.chunk_count,
        nextSeq=next_expected_seq(evidence),
        manifestSha256=evidence.manifest_sha256,
        hasManifest=evidence.manifest is not None,
    )


@router.get("/sessions", response_model=list[EvidenceSessionOut])
def list_sessions(principal: CurrentPrincipal) -> list[EvidenceSessionOut]:
    with session_scope() as session:
        rows = (
            session.execute(
                select(EvidenceSession)
                .where(EvidenceSession.user_id == principal.user_id)
                .order_by(EvidenceSession.started_at.desc())
                .limit(50)
            )
            .scalars()
            .all()
        )
        return [_to_out(row) for row in rows]


@router.get("/sessions/{session_id}", response_model=EvidenceSessionOut)
def get_session(session_id: str, principal: CurrentPrincipal) -> EvidenceSessionOut:
    with session_scope() as session:
        evidence = _owned_session(session, session_id, principal.user_id)
        return _to_out(evidence)


@router.post(
    "/sessions/{session_id}/chunks",
    response_model=EvidenceSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_chunk(
    session_id: str,
    principal: CurrentPrincipal,
    chunk: UploadFile = File(..., description="One recorded audio segment"),
    x_chunk_seq: int = Header(..., alias="X-Chunk-Seq", ge=0),
    x_chunk_sha256: str | None = Header(default=None, alias="X-Chunk-SHA256"),
    x_chunk_offset_s: float | None = Header(default=None, alias="X-Chunk-Offset-S", ge=0),
    x_chunk_client_ts: float | None = Header(default=None, alias="X-Chunk-Client-Ts"),
) -> EvidenceSessionOut:
    """Accept one audio segment.

    Retransmitting a `seq` that is already stored is accepted as a no-op, so a
    client retrying after a half-open connection cannot corrupt the sequence.
    """
    payload = await chunk.read()
    mime = chunk.content_type or "audio/mp4"

    with session_scope() as session:
        evidence = _owned_session(session, session_id, principal.user_id)

        if evidence.status == EVIDENCE_FINALIZED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="sesja nagrania jest zamknięta",
            )

        try:
            stored = store_chunk(
                session,
                evidence,
                seq=x_chunk_seq,
                payload=payload,
                declared_sha256=x_chunk_sha256,
                mime=mime,
                offset_s=x_chunk_offset_s,
                client_ts=x_chunk_client_ts,
            )
        except EvidenceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
            ) from exc

        log.info(
            "evidence %s seq=%d bytes=%d created=%s total=%d",
            session_id,
            stored.seq,
            stored.size_bytes,
            stored.created,
            len(evidence.chunks),
        )
        return _to_out(evidence)


@router.post("/sessions/{session_id}/finalize", response_model=EvidenceFinalizeOut)
def finalize(
    session_id: str, body: EvidenceFinalize, principal: CurrentPrincipal
) -> EvidenceFinalizeOut:
    """Close the session and freeze its chain-of-custody manifest."""
    with session_scope() as session:
        evidence = _owned_session(session, session_id, principal.user_id)

        # The alert's end position matters for the case file, so fall back to the
        # last known ping if the client could not supply one.
        if body.end_lat is None or body.end_lng is None:
            last_ping = (
                session.execute(
                    select(LocationPing)
                    .where(
                        LocationPing.user_id == principal.user_id,
                        LocationPing.alert_id == evidence.alert_id,
                    )
                    .order_by(LocationPing.id.desc())
                    .limit(1)
                )
                .scalars()
                .first()
            )
            if last_ping is not None:
                body.end_lat = body.end_lat if body.end_lat is not None else last_ping.lat
                body.end_lng = body.end_lng if body.end_lng is not None else last_ping.lng

        manifest = finalize_session(
            session,
            evidence,
            duration_s=body.duration_s,
            end_lat=body.end_lat,
            end_lng=body.end_lng,
            chunk_count=body.chunk_count,
        )
        session.flush()

    return EvidenceFinalizeOut(
        sessionId=session_id,
        status=evidence.status,
        chunkCount=manifest["chunkCount"],
        totalBytes=manifest["totalBytes"],
        durationS=manifest["durationS"],
        manifestSha256=manifest["manifestSha256"],
        manifestUrl=f"/api/v1/evidence/sessions/{session_id}/manifest",
    )


@router.get("/sessions/{session_id}/manifest")
def get_manifest(session_id: str, principal: CurrentPrincipal) -> Response:
    """The frozen manifest, or a live build if the session is still open."""
    with session_scope() as session:
        evidence = _owned_session(session, session_id, principal.user_id)
        manifest = evidence.manifest or build_manifest(evidence)

    return Response(
        content=to_json_bytes(manifest),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="manifest-{session_id}.json"'},
    )


@router.get("/sessions/{session_id}/media/{seq}")
def get_media(session_id: str, seq: int, principal: CurrentPrincipal) -> FileResponse:
    """Serve one stored segment. Supports HTTP Range for in-app playback."""
    with session_scope() as session:
        _owned_session(session, session_id, principal.user_id)

    try:
        path = media_file(session_id, seq)
    except EvidenceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return FileResponse(path, media_type="audio/mp4")
