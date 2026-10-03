"""Push notification content and the mock dispatch endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from hy.dispatch import dispatch
from hy.models import DispatchLog
from hy.push import LEVEL_2_TITLE, LEVEL_3_TITLE, build_messages

WARSAW = {"lat": 52.2297, "lng": 21.0122}
TOKENS = ["ExponentPushToken[a]", "ExponentPushToken[b]"]


def _message(level: int, token: str = TOKENS[0]) -> dict:
    return build_messages(level=level, tokens=[token], lat=WARSAW["lat"], lng=WARSAW["lng"])[0]


def test_level_3_push_is_maximal() -> None:
    message = _message(3)

    assert message["title"] == LEVEL_3_TITLE
    assert message["priority"] == "high"
    assert message["interruptionLevel"] == "time-sensitive"
    assert message["channelId"] == "full-alert"
    # `alarm` is Android's own category for this, and the reason the OS fires a
    # full-screen intent instead of only showing a heads-up.
    assert message["categoryId"] == "alarm"
    assert message["data"]["kind"] == "full-alert"


def test_level_3_push_carries_coordinates_and_callback_hint() -> None:
    message = _message(3)

    assert "52.2297" in message["body"]
    assert "21.0122" in message["body"]
    assert "Zadzwoń" in message["body"]
    assert message["data"]["lat"] == WARSAW["lat"]


def test_level_2_push_is_a_call_request() -> None:
    message = _message(2)

    assert message["title"] == LEVEL_2_TITLE
    assert message["data"]["kind"] == "help"
    # Heads-up, because a friend being asked to talk should not be able to miss it,
    # but no Do Not Disturb bypass — only level 3 earns that.
    assert message["priority"] == "high"
    assert "interruptionLevel" not in message
    assert message["channelId"] == "call-request"
    assert message["categoryId"] == "call"


def test_level_1_push_is_a_soft_check_in() -> None:
    message = _message(1)
    assert message["data"]["kind"] == "check-in"
    assert message["channelId"] == "default"
    # Nothing takes over the friend's screen at level 1.
    assert "categoryId" not in message


def test_every_push_identifies_who_and_which_alert() -> None:
    message = build_messages(
        level=3,
        tokens=[TOKENS[0]],
        lat=WARSAW["lat"],
        lng=WARSAW["lng"],
        display_name="Kasia",
        alert_id="alert_1",
        user_id="user_kasia",
    )[0]

    data = message["data"]
    assert data["alertId"] == "alert_1"
    assert data["from"] == "Kasia"
    assert data["fromId"] == "user_kasia"
    assert data["level"] == 3
    assert data["at"] > 0
    # One thread per alert, so escalations stack instead of scattering.
    assert message["threadId"] == "alert_1"


def test_resolution_push_has_no_sound() -> None:
    message = _message(0)
    assert message["title"] == "Już bezpieczna"
    assert message["sound"] is None


def test_display_name_is_used_when_available() -> None:
    message = build_messages(
        level=3, tokens=TOKENS, lat=WARSAW["lat"], lng=WARSAW["lng"], display_name="Kasia"
    )[0]
    assert "Kasia" in message["body"]


def test_one_message_per_token() -> None:
    messages = build_messages(level=2, tokens=TOKENS, lat=52.0, lng=21.0)
    assert [m["to"] for m in messages] == TOKENS


def test_send_push_without_tokens_short_circuits() -> None:
    import asyncio

    from hy.push import send_push

    result = asyncio.run(send_push(level=2, tokens=[], lat=52.0, lng=21.0))
    assert result.sent == 0
    assert result.skipped_reason == "no registered devices"


def test_send_push_survives_network_failure(monkeypatch) -> None:
    import asyncio

    import httpx

    from hy.push import send_push

    class _Boom(httpx.AsyncClient):
        async def __aenter__(self):
            raise RuntimeError("network down")

    monkeypatch.setattr("hy.push.httpx.AsyncClient", _Boom)

    result = asyncio.run(send_push(level=2, tokens=TOKENS, lat=52.0, lng=21.0))
    assert result.sent == 0
    assert result.failed == 2


def test_dispatch_returns_a_mock_case_number() -> None:
    import asyncio

    receipt = asyncio.run(dispatch(user_id="user_alice", lat=52.0, lng=21.0, level=3))
    assert receipt.case_id.startswith("MOCK-")
    assert receipt.mocked is True
    assert 3 <= receipt.eta_min <= 15


def test_dispatch_is_audited(users, session: Session) -> None:
    import asyncio

    asyncio.run(
        dispatch(
            user_id="user_alice",
            lat=52.0,
            lng=21.0,
            level=3,
            alert_id=None,
            evidence_session_id=None,
        )
    )

    logs = session.query(DispatchLog).all()
    assert len(logs) == 1
    assert logs[0].mocked is True
    assert logs[0].user_id == "user_alice"


def test_dispatch_endpoint_response(users, client: TestClient) -> None:
    response = client.post("/api/v1/authorities/dispatch", json={"level": 3, **WARSAW})
    assert response.status_code == 202

    body = response.json()
    assert body["caseId"].startswith("MOCK-")
    assert body["mocked"] is True
    assert body["status"] == "dispatched"
    assert body["evidence"]["attached"] is False


def test_dispatch_mentions_attached_evidence(users, client: TestClient) -> None:
    response = client.post(
        "/api/v1/authorities/dispatch",
        json={"level": 3, **WARSAW, "evidenceSessionId": "session-123"},
    )
    assert response.json()["evidence"]["attached"] is True
    assert response.json()["evidence"]["sessionId"] == "session-123"


def test_dispatch_validates_level(users, client: TestClient) -> None:
    assert (
        client.post("/api/v1/authorities/dispatch", json={"level": 5, **WARSAW}).status_code == 422
    )
