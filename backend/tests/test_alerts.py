"""Alert creation, escalation and resolution across the four threat levels."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from hy.models import ALERT_ACTIVE, ALERT_RESOLVED, Alert, EvidenceSession
from tests.conftest import make_device, make_friendship

WARSAW = {"lat": 52.2297, "lng": 21.0122}


def test_level_2_alert_notifies_friends(
    users, session: Session, client: TestClient, push_spy: list[dict]
) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    make_device(session, bob, "ExponentPushToken[bob-token]")

    response = client.post("/api/v1/alerts", json={"level": 2, **WARSAW})
    assert response.status_code == 201

    body = response.json()
    assert body["alert"]["level"] == 2
    assert body["alert"]["status"] == ALERT_ACTIVE
    assert body["evidenceSessionId"] is None
    assert body["notifiedFriends"] == 1

    assert len(push_spy) == 1
    assert push_spy[0]["level"] == 2
    assert push_spy[0]["tokens"] == ["ExponentPushToken[bob-token]"]


def test_level_1_alert_stays_on_device(
    users, session: Session, client: TestClient, push_spy: list[dict]
) -> None:
    """Level 1 is the fake call only — no friends are told anything."""
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    make_device(session, bob, "ExponentPushToken[bob-token]")

    response = client.post("/api/v1/alerts", json={"level": 1, **WARSAW})
    assert response.status_code == 201
    assert response.json()["evidenceSessionId"] is None
    assert push_spy[0]["level"] == 1


def test_level_3_alert_opens_evidence_session(users, client: TestClient) -> None:
    response = client.post("/api/v1/alerts", json={"level": 3, **WARSAW})
    assert response.status_code == 201

    body = response.json()
    assert body["evidenceSessionId"]
    assert body["alert"]["evidenceSessionId"] == body["evidenceSessionId"]
    assert body["chunkSeconds"] == 30
    # Nobody to notify yet, so no push goes out.
    assert body["notifiedFriends"] == 0


def test_level_3_alert_notifies_friends_loudly(
    users, session: Session, client: TestClient, push_spy: list[dict]
) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    make_device(session, bob, "ExponentPushToken[bob-token]")

    client.post("/api/v1/alerts", json={"level": 3, **WARSAW})

    assert len(push_spy) == 1
    assert push_spy[0]["level"] == 3


def test_escalation_updates_the_live_alert_in_place(
    users, session: Session, client: TestClient
) -> None:
    first = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()
    second = client.post("/api/v1/alerts", json={"level": 3, "lat": 52.1, "lng": 21.1}).json()

    assert first["alert"]["id"] == second["alert"]["id"]
    assert second["alert"]["level"] == 3
    assert second["evidenceSessionId"]

    alerts = session.execute(select(Alert)).scalars().all()
    assert len(alerts) == 1


def test_escalation_opens_exactly_one_evidence_session(
    users, session: Session, client: TestClient
) -> None:
    client.post("/api/v1/alerts", json={"level": 3, **WARSAW})
    client.post("/api/v1/alerts", json={"level": 3, **WARSAW})

    sessions = session.execute(select(EvidenceSession)).scalars().all()
    assert len(sessions) == 1


def test_double_tap_does_not_create_two_alerts(users, session: Session, client: TestClient) -> None:
    a = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()
    b = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()

    assert a["alert"]["id"] == b["alert"]["id"]
    assert len(session.execute(select(Alert)).scalars().all()) == 1


def test_active_alert_is_reported(users, session: Session, client: TestClient) -> None:
    assert client.get("/api/v1/alerts/active").json() is None

    created = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()["alert"]
    assert client.get("/api/v1/alerts/active").json()["id"] == created["id"]

    client.patch(f"/api/v1/alerts/{created['id']}/resolve", json={})
    assert client.get("/api/v1/alerts/active").json() is None


def test_resolve_notifies_friends_that_it_is_over(
    users, session: Session, client: TestClient, push_spy: list[dict]
) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    make_device(session, bob, "ExponentPushToken[bob-token]")

    alert = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()["alert"]
    push_spy.clear()

    response = client.patch(f"/api/v1/alerts/{alert['id']}/resolve", json={})
    assert response.status_code == 200
    assert response.json()["status"] == ALERT_RESOLVED

    assert len(push_spy) == 1
    assert push_spy[0]["level"] == 0


def test_resolving_twice_does_not_duplicate_the_push(
    users, session: Session, client: TestClient, push_spy: list[dict]
) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    make_device(session, bob, "ExponentPushToken[bob-token]")

    alert = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()["alert"]
    client.patch(f"/api/v1/alerts/{alert['id']}/resolve", json={})
    push_spy.clear()

    client.patch(f"/api/v1/alerts/{alert['id']}/resolve", json={})
    assert push_spy == []


def test_alert_with_no_friends_still_succeeds(
    users, client: TestClient, push_spy: list[dict]
) -> None:
    response = client.post("/api/v1/alerts", json={"level": 3, **WARSAW})
    assert response.status_code == 201
    assert response.json()["notifiedFriends"] == 0


def test_cannot_read_or_resolve_another_users_alert(users, client: TestClient, client_for) -> None:
    bob_client = client_for("user_bob")
    alert = client.post("/api/v1/alerts", json={"level": 2, **WARSAW}).json()["alert"]

    assert bob_client.get(f"/api/v1/alerts/{alert['id']}").status_code == 404
    assert bob_client.patch(f"/api/v1/alerts/{alert['id']}/resolve", json={}).status_code == 404


def test_out_of_range_level_is_rejected(users, client: TestClient) -> None:
    assert client.post("/api/v1/alerts", json={"level": 0, **WARSAW}).status_code == 422
    assert client.post("/api/v1/alerts", json={"level": 4, **WARSAW}).status_code == 422


def test_out_of_range_coordinates_are_rejected(users, client: TestClient) -> None:
    assert client.post("/api/v1/alerts", json={"level": 2, "lat": 91, "lng": 0}).status_code == 422
    assert client.post("/api/v1/alerts", json={"level": 2, "lat": 0, "lng": 181}).status_code == 422


def test_dispatch_wrapper_records_the_case_on_the_alert(
    users, session: Session, client: TestClient
) -> None:
    alert = client.post("/api/v1/alerts", json={"level": 3, **WARSAW}).json()["alert"]
    response = client.post(f"/api/v1/alerts/{alert['id']}/dispatch")

    assert response.status_code == 200
    body = response.json()
    assert body["caseId"].startswith("MOCK-")
    assert body["mocked"] is True
    assert body["evidence"]["attached"] is True

    refreshed = session.get(Alert, alert["id"])
    session.refresh(refreshed)
    assert refreshed.dispatch_case_id == body["caseId"]
