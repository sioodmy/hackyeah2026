"""Evidence: chunk validation, idempotent upload, manifest, playback."""

from __future__ import annotations

import hashlib

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from hy.models import EVIDENCE_FINALIZED, EvidenceChunk, EvidenceSession
from tests.conftest import make_friendship

WARSAW = {"lat": 52.2297, "lng": 21.0122}


def segment(text: str) -> bytes:
    """Stand-in for a recorded m4a segment."""
    return (text * 64).encode("utf-8")


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def open_session(client: TestClient, level: int = 3) -> str:
    response = client.post("/api/v1/alerts", json={"level": level, **WARSAW})
    return response.json()["evidenceSessionId"]


def upload(client: TestClient, session_id: str, seq: int, payload: bytes, **headers):
    base = {
        "X-Chunk-Seq": str(seq),
        "X-Chunk-SHA256": digest(payload),
        "X-Chunk-Offset-S": str(seq * 30),
        "X-Chunk-Client-Ts": str(1_700_000_000 + seq),
    }
    base.update(headers)
    return client.post(
        f"/api/v1/evidence/sessions/{session_id}/chunks",
        files={"chunk": (f"{seq:06d}.m4a", payload, "audio/mp4")},
        headers=base,
    )


def test_level_3_opens_a_session(users, session: Session, client: TestClient) -> None:
    session_id = open_session(client)
    evidence = session.get(EvidenceSession, session_id)

    assert evidence is not None
    assert evidence.status == "open"
    assert evidence.chunk_seconds == 30
    assert evidence.start_lat == WARSAW["lat"]


def test_upload_chunk_is_stored(users, session: Session, client: TestClient) -> None:
    session_id = open_session(client)
    payload = segment("chunk-zero")

    response = upload(client, session_id, 0, payload)
    assert response.status_code == 201

    body = response.json()
    assert body["chunkCount"] == 1
    assert body["uploadedBytes"] == len(payload)
    assert body["nextSeq"] == 1

    chunk = session.execute(select(EvidenceChunk)).scalars().one()
    assert chunk.seq == 0
    assert chunk.sha256 == digest(payload)
    assert chunk.size_bytes == len(payload)


def test_retransmitting_the_same_segment_is_a_no_op(
    users, session: Session, client: TestClient
) -> None:
    session_id = open_session(client)
    payload = segment("retry-me")

    first = upload(client, session_id, 0, payload)
    second = upload(client, session_id, 0, payload)

    assert first.status_code == second.status_code == 201
    assert second.json()["chunkCount"] == 1
    assert len(session.execute(select(EvidenceChunk)).scalars().all()) == 1


def test_same_seq_with_different_bytes_is_rejected(users, client: TestClient) -> None:
    session_id = open_session(client)
    upload(client, session_id, 0, segment("original"))

    response = upload(client, session_id, 0, segment("tampered"))
    assert response.status_code == 422
    assert "different digest" in response.json()["detail"]


def test_wrong_digest_is_rejected(users, client: TestClient) -> None:
    session_id = open_session(client)

    response = upload(client, session_id, 0, segment("body"), **{"X-Chunk-SHA256": "00" * 32})
    assert response.status_code == 422
    assert "digest mismatch" in response.json()["detail"]


def test_missing_digest_header_is_accepted_and_server_computed(
    users, session: Session, client: TestClient
) -> None:
    """The client always sends one, but the server must not trust it blindly."""
    session_id = open_session(client)
    payload = segment("no-header")

    response = client.post(
        f"/api/v1/evidence/sessions/{session_id}/chunks",
        files={"chunk": ("0.m4a", payload, "audio/mp4")},
        headers={"X-Chunk-Seq": "0"},
    )
    assert response.status_code == 201

    chunk = session.execute(select(EvidenceChunk)).scalars().one()
    assert chunk.sha256 == digest(payload)


def test_empty_chunk_is_rejected(users, client: TestClient) -> None:
    session_id = open_session(client)
    response = upload(client, session_id, 0, b"")

    assert response.status_code == 422
    assert "empty chunk" in response.json()["detail"]


def test_negative_seq_is_rejected_by_validation(users, client: TestClient) -> None:
    session_id = open_session(client)
    response = upload(client, session_id, -1, segment("bad"))

    assert response.status_code == 422


def test_chunks_land_on_disk(users, session: Session, client: TestClient, evidence_dir) -> None:
    session_id = open_session(client)
    payload = segment("on-disk")
    upload(client, session_id, 0, payload)

    expected = evidence_dir / session_id / "000000.m4a"
    assert expected.exists()
    assert expected.read_bytes() == payload


def test_no_partial_files_remain(users, client: TestClient, evidence_dir) -> None:
    session_id = open_session(client)
    upload(client, session_id, 0, segment("clean"))

    leftovers = list((evidence_dir / session_id).glob("*.part"))
    assert leftovers == []


def test_finalize_builds_the_manifest(users, session: Session, client: TestClient) -> None:
    session_id = open_session(client)
    for seq in range(3):
        upload(client, session_id, seq, segment(f"seg-{seq}"))

    response = client.post(
        f"/api/v1/evidence/sessions/{session_id}/finalize",
        json={
            "durationS": 90.0,
            "chunkCount": 3,
            "endLat": 52.23,
            "endLng": 21.01,
        },
    )
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == EVIDENCE_FINALIZED
    assert body["chunkCount"] == 3
    assert body["durationS"] == 90.0
    assert len(body["manifestSha256"]) == 64

    evidence = session.get(EvidenceSession, session_id)
    session.refresh(evidence)
    assert evidence.manifest is not None
    assert evidence.manifest["manifestSha256"] == body["manifestSha256"]
    assert [c["seq"] for c in evidence.manifest["chunks"]] == [0, 1, 2]
    assert evidence.manifest["contiguous"] is True


def test_finalize_records_a_gap_instead_of_failing(users, client: TestClient) -> None:
    """If a segment never arrived, the case file must show that."""
    session_id = open_session(client)
    upload(client, session_id, 0, segment("zero"))
    upload(client, session_id, 2, segment("two"))

    client.post(
        f"/api/v1/evidence/sessions/{session_id}/finalize",
        json={"chunkCount": 3, "durationS": 90.0},
    )

    manifest = client.get(f"/api/v1/evidence/sessions/{session_id}/manifest").json()
    assert manifest["contiguous"] is False
    assert manifest["missingChunks"] == 1


def test_manifest_endpoint_returns_json(users, client: TestClient) -> None:
    session_id = open_session(client)
    upload(client, session_id, 0, segment("live"))

    response = client.get(f"/api/v1/evidence/sessions/{session_id}/manifest")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")

    manifest = response.json()
    assert manifest["sessionId"] == session_id
    assert manifest["location"]["start"]["lat"] == WARSAW["lat"]
    assert len(manifest["chunks"]) == 1


def test_uploading_after_finalize_is_refused(users, client: TestClient) -> None:
    session_id = open_session(client)
    upload(client, session_id, 0, segment("sealed"))
    client.post(f"/api/v1/evidence/sessions/{session_id}/finalize", json={})

    response = upload(client, session_id, 1, segment("too-late"))
    assert response.status_code == 409


def test_segment_is_served_for_playback(users, client: TestClient) -> None:
    session_id = open_session(client)
    payload = segment("playable")
    upload(client, session_id, 0, payload)

    response = client.get(f"/api/v1/evidence/sessions/{session_id}/media/0")
    assert response.status_code == 200
    assert response.content == payload


def test_unknown_segment_is_not_found(users, client: TestClient) -> None:
    session_id = open_session(client)
    response = client.get(f"/api/v1/evidence/sessions/{session_id}/media/99")
    assert response.status_code == 404


def test_unknown_session_is_not_found(users, client: TestClient) -> None:
    response = client.get("/api/v1/evidence/sessions/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_evidence_of_another_user_is_not_reachable(users, client: TestClient, client_for) -> None:
    bob_client = client_for("user_bob")
    session_id = open_session(client)
    payload = segment("private")
    upload(client, session_id, 0, payload)

    assert bob_client.get(f"/api/v1/evidence/sessions/{session_id}").status_code == 404
    assert bob_client.get(f"/api/v1/evidence/sessions/{session_id}/media/0").status_code == 404


def test_session_list_shows_progress(users, client: TestClient) -> None:
    session_id = open_session(client)
    upload(client, session_id, 0, segment("listed"))

    sessions = client.get("/api/v1/evidence/sessions").json()
    assert len(sessions) == 1
    assert sessions[0]["id"] == session_id
    assert sessions[0]["chunkCount"] == 1
    assert sessions[0]["hasManifest"] is False


def test_next_seq_survives_a_gap(users, client: TestClient) -> None:
    """Tells a reconnecting client exactly which segment to resume from."""
    session_id = open_session(client)
    upload(client, session_id, 0, segment("zero"))
    upload(client, session_id, 2, segment("two"))

    body = client.get(f"/api/v1/evidence/sessions/{session_id}").json()
    assert body["nextSeq"] == 1
    assert body["chunkCount"] == 2


def test_evidence_dir_traversal_is_blocked(users, client: TestClient) -> None:
    response = client.get("/api/v1/evidence/sessions/..%2F..%2Fetc%2Fpasswd/manifest")
    assert response.status_code in (404, 400, 422)


def test_friends_do_not_see_your_evidence(
    users, session: Session, client: TestClient, client_for
) -> None:
    """Evidence is private to the person who recorded it."""
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    bob_client = client_for("user_bob")

    session_id = open_session(client)
    upload(client, session_id, 0, segment("mine"))

    assert bob_client.get("/api/v1/evidence/sessions").json() == []
