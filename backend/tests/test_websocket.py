"""Live locations over the WebSocket, plus the HTTP ping fallback."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from hy.auth import Principal
from hy.ws import WS_CLOSE_UNAUTHORIZED
from tests.conftest import make_friendship

WARSAW = {"lat": 52.2297, "lng": 21.0122}


@pytest.fixture
def ws_auth(monkeypatch: pytest.MonkeyPatch):
    """Authenticate the WebSocket handshake as whoever `?as=user` names."""

    def _install(user_id: str):
        def _principal(websocket):
            return Principal(user_id=user_id)

        monkeypatch.setattr("hy.ws.websocket_principal", _principal)

    return _install


def test_handshake_rejects_a_bad_token(users) -> None:
    """No token is usable here, so the socket is closed before it is accepted."""
    from fastapi import WebSocketDisconnect

    from hy.asgi import create_app

    app = create_app()
    with (
        TestClient(app) as raw,
        pytest.raises(WebSocketDisconnect) as excinfo,
        raw.websocket_connect("/ws/locations?token=garbage") as socket,
    ):
        socket.receive_json()

    # 1008 = policy violation, the code our handler uses for auth failures.
    assert excinfo.value.code == WS_CLOSE_UNAUTHORIZED


def test_handshake_sends_hello(users, session: Session, ws_auth) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    ws_auth(alice)

    from hy.asgi import create_app

    with TestClient(create_app()) as raw, raw.websocket_connect("/ws/locations") as socket:
        hello = socket.receive_json()

    assert hello["type"] == "hello"
    assert hello["self"] == alice
    assert [f["id"] for f in hello["friends"]] == [bob]
    assert hello["friendIds"] == [bob]


def test_handshake_reports_connections(users, session: Session, ws_auth) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)

    from hy.asgi import create_app
    from hy.realtime import registry

    with TestClient(create_app()) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            assert registry.is_connected(alice)
            assert registry.connection_count() == 1

        assert not registry.is_connected(alice)


def test_friend_receives_the_ping(users, session: Session, ws_auth) -> None:
    """End-to-end: Alice's socket sends a location, Bob's socket receives it."""
    alice, bob, _ = users
    make_friendship(session, alice, bob)

    from hy.asgi import create_app

    app = create_app()
    with TestClient(app) as raw:
        ws_auth(bob)
        with raw.websocket_connect("/ws/locations") as bob_socket:
            assert bob_socket.receive_json()["type"] == "hello"

            ws_auth(alice)
            with raw.websocket_connect("/ws/locations") as alice_socket:
                assert alice_socket.receive_json()["type"] == "hello"

                alice_socket.send_json(
                    {"type": "location", "lat": 52.2, "lng": 21.0, "acc": 8, "seq": 7, "ts": 1.0}
                )

                message = bob_socket.receive_json()
                assert message["type"] == "location"
                assert message["userId"] == alice
                assert message["lat"] == 52.2
                assert message["seq"] == 7


def test_strangers_never_receive_pings(users, session: Session, ws_auth) -> None:
    alice, bob, carol = users
    make_friendship(session, alice, bob)
    # Carol is a real user but not Alice's friend.

    from hy.asgi import create_app
    from hy.realtime import registry

    app = create_app()
    with TestClient(app) as raw:
        ws_auth(carol)
        with raw.websocket_connect("/ws/locations") as carol_socket:
            carol_socket.receive_json()

            ws_auth(alice)
            with raw.websocket_connect("/ws/locations") as alice_socket:
                alice_socket.receive_json()
                alice_socket.send_json({"type": "location", "lat": 1.0, "lng": 1.0})

                assert not registry.is_connected(bob)


def test_sender_does_not_receive_its_own_ping(users, session: Session, ws_auth) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)

    from hy.asgi import create_app
    from hy.realtime import registry

    app = create_app()
    with TestClient(app) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            socket.send_json({"type": "location", "lat": 52.2, "lng": 21.0})

            assert registry.connection_count() == 1


def test_ping_is_persisted(users, session: Session, ws_auth) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)

    from hy.asgi import create_app
    from hy.models import LocationPing

    app = create_app()
    with TestClient(app) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            socket.send_json({"type": "location", "lat": 52.3, "lng": 21.3, "seq": 3})
            # The ack means the server has committed the row.
            assert socket.receive_json() == {"type": "ack", "seq": 3}

    stored = session.query(LocationPing).filter(LocationPing.user_id == alice).all()
    assert len(stored) == 1
    assert stored[0].lat == 52.3
    assert stored[0].seq == 3


def test_ping_attaches_to_the_active_alert(users, session: Session, ws_auth, push_spy) -> None:
    from hy.asgi import create_app
    from hy.auth import require_principal
    from hy.models import LocationPing

    # Create the level-3 alert over HTTP first (authenticated as Alice).
    with TestClient(create_app()) as http:
        http.app.dependency_overrides[require_principal] = lambda: Principal(user_id="user_alice")
        http.post("/api/v1/alerts", json={"level": 3, **WARSAW})

    app = create_app()
    with TestClient(app) as raw:
        ws_auth("user_alice")
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            socket.send_json({"type": "location", "lat": 52.3, "lng": 21.3})
            assert socket.receive_json()["type"] == "ack"

    pings = session.query(LocationPing).all()
    assert len(pings) == 1
    assert pings[0].alert_id is not None


def test_invalid_frame_is_answered_with_an_error(users, session: Session, ws_auth) -> None:
    alice, _, _ = users

    from hy.asgi import create_app

    with TestClient(create_app()) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            socket.send_json({"type": "location", "lat": 999, "lng": 0})

            reply = socket.receive_json()
            assert reply["type"] == "error"


def test_unknown_frame_type_is_reported(users, session: Session, ws_auth) -> None:
    alice, _, _ = users

    from hy.asgi import create_app

    with TestClient(create_app()) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            socket.send_json({"type": "teleport", "lat": 52.2, "lng": 21.2})
            assert socket.receive_json()["message"].startswith("unknown type")


def test_pong_does_not_error(users, session: Session, ws_auth) -> None:
    alice, _, _ = users

    from hy.asgi import create_app

    with TestClient(create_app()) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            socket.receive_json()
            socket.send_json({"type": "pong"})
            socket.send_json({"type": "pong"})
            # Still usable afterwards.
            socket.send_json({"type": "location", "lat": 52.2, "lng": 21.2})


def test_reconnect_replays_recent_friends_locations(
    users, session: Session, ws_auth, client: TestClient
) -> None:
    """A phone that lost the socket must not have to wait for the next ping."""
    from hy.asgi import create_app
    from hy.models import LocationPing

    alice, bob, _ = users
    make_friendship(session, alice, bob)

    # Bob's position is already in the database from an earlier episode.
    session.add(LocationPing(user_id=bob, lat=50.1, lng=19.9, seq=4, client_ts=99.0))
    session.commit()

    with TestClient(create_app()) as raw:
        ws_auth(alice)
        with raw.websocket_connect("/ws/locations") as socket:
            assert socket.receive_json()["type"] == "hello"
            replay = socket.receive_json()

    assert replay["type"] == "location"
    assert replay["userId"] == bob
    assert replay["lat"] == 50.1


def test_http_ping_fallback_updates_friends(users, session: Session, client: TestClient) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)

    response = client.post("/api/v1/locations/ping", json={"lat": 52.4, "lng": 21.4, "seq": 1})
    assert response.status_code == 202

    snapshot = client.get("/api/v1/locations/snapshot").json()
    # Alice does not see herself.
    assert snapshot["locations"] == []


def test_snapshot_returns_the_newest_ping_per_friend(
    users, session: Session, client: TestClient, client_for
) -> None:
    alice, bob, _ = users
    make_friendship(session, alice, bob)
    bob_client = client_for("user_bob")

    bob_client.post("/api/v1/locations/ping", json={"lat": 1.0, "lng": 1.0, "seq": 1})
    bob_client.post("/api/v1/locations/ping", json={"lat": 2.0, "lng": 2.0, "seq": 2})

    snapshot = client.get("/api/v1/locations/snapshot").json()["locations"]
    assert len(snapshot) == 1
    assert snapshot[0]["userId"] == bob
    assert snapshot[0]["lat"] == 2.0


def test_snapshot_excludes_strangers(users, session: Session, client: TestClient) -> None:
    assert client.get("/api/v1/locations/snapshot").json() == {"locations": []}
