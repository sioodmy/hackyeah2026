"""Friend invitations: signing, scanning, accepting."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from hy.invites import InviteError, create_invite, encode_invite, parse_and_verify


def test_create_and_verify_invite_roundtrip() -> None:
    invite = create_invite("user_alice")
    parsed = parse_and_verify(encode_invite(invite))

    assert parsed["user_id"] == "user_alice"
    assert parsed["scheme"] == "hm1"
    assert len(parsed["code"]) == 6


def test_tampered_user_id_is_rejected() -> None:
    invite = create_invite("user_alice")
    raw = encode_invite(invite)

    scheme, _user_id, nonce, expires, signature, code = raw.split(":")
    forged = ":".join([scheme, "user_mallory", nonce, expires, signature, code])

    try:
        parse_and_verify(forged)
    except InviteError as exc:
        assert "signature" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("forged invite was accepted")


def test_expired_invite_is_rejected() -> None:
    invite = create_invite("user_alice", ttl_seconds=-10)
    try:
        parse_and_verify(encode_invite(invite))
    except InviteError as exc:
        assert "expired" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expired invite was accepted")


def test_wrong_scheme_is_rejected() -> None:
    try:
        parse_and_verify("http:user:n:0:sig:CODE12")
    except InviteError as exc:
        assert "scheme" in str(exc) or "fields" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("bad scheme was accepted")


def test_short_payload_is_rejected() -> None:
    try:
        parse_and_verify("hm1:too:few")
    except InviteError as exc:
        assert "6 fields" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("short payload was accepted")


def test_qr_endpoint_persists_a_code(users, client: TestClient) -> None:
    response = client.get("/api/v1/friends/qr/me")
    assert response.status_code == 200

    body = response.json()
    assert body["u"] == "user_alice"
    assert len(body["c"]) == 6
    # Signature must be verifiable by a scanner.
    assert (
        parse_and_verify(f"hm1:{body['u']}:{body['n']}:{body['e']}:{body['s']}:{body['c']}")[
            "user_id"
        ]
        == "user_alice"
    )


def test_qr_payload_string_is_encoded(users, session: Session, client: TestClient) -> None:
    response = client.get("/api/v1/friends/qr/me/payload")
    assert response.status_code == 200

    payload = response.json()["payload"]
    assert payload.startswith("hm1:user_alice:")
    assert len(payload.split(":")) == 6

    # The code must be stored so manual entry resolves to this user.
    from hy.models import User

    user = session.get(User, "user_alice")
    session.refresh(user)
    assert user.invite_code == response.json()["code"]


def test_scan_creates_pending_request(
    users, session: Session, client: TestClient, client_for
) -> None:
    bob_client = client_for("user_bob")

    # Alice publishes her invite, Bob scans it.
    invite = bob_client.get("/api/v1/friends/qr/me/payload").json()["payload"]

    scan = client.post("/api/v1/friends/scan", json={"payload": invite, "displayName": "Alice B."})
    assert scan.status_code == 200
    assert scan.json()["id"] == "user_bob"
    assert scan.json()["status"] == "pending"

    # Alice sees an incoming request and accepts it.
    requests = bob_client.get("/api/v1/friends/requests").json()
    assert [r["id"] for r in requests] == ["user_alice"]

    accept = bob_client.post("/api/v1/friends/user_alice/accept")
    assert accept.status_code == 200
    assert accept.json()["status"] == "accepted"

    friends = bob_client.get("/api/v1/friends").json()
    assert [f["id"] for f in friends] == ["user_alice"]


def test_scanning_someone_who_requested_you_completes_handshake(
    users, client: TestClient, client_for
) -> None:
    bob_client = client_for("user_bob")
    invite = bob_client.get("/api/v1/friends/qr/me/payload").json()["payload"]

    # Alice scans Bob's code first...
    assert client.post("/api/v1/friends/scan", json={"payload": invite}).status_code == 200
    # ...then Bob scans Alice's, which should accept rather than create a duplicate.
    alice_invite = client.get("/api/v1/friends/qr/me/payload").json()["payload"]
    response = bob_client.post("/api/v1/friends/scan", json={"payload": alice_invite})

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"


def test_scan_is_idempotent(users, client: TestClient, client_for) -> None:
    bob_client = client_for("user_bob")
    invite = bob_client.get("/api/v1/friends/qr/me/payload").json()["payload"]

    first = client.post("/api/v1/friends/scan", json={"payload": invite})
    second = client.post("/api/v1/friends/scan", json={"payload": invite})

    assert first.json()["friendshipId"] == second.json()["friendshipId"]


def test_own_code_cannot_be_scanned(users, client: TestClient) -> None:
    invite = client.get("/api/v1/friends/qr/me/payload").json()["payload"]
    response = client.post("/api/v1/friends/scan", json={"payload": invite})

    assert response.status_code == 400
    assert "własny" in response.json()["detail"]


def test_forged_scan_is_rejected(users, client: TestClient) -> None:
    forged = "hm1:user_carol:deadbeef:9999999999:" + "0" * 32 + ":ABC234"
    response = client.post("/api/v1/friends/scan", json={"payload": forged})

    assert response.status_code == 400
    assert "signature" in response.json()["detail"]


def test_manual_short_code_resolves_to_owner(
    users, session: Session, client: TestClient, client_for
) -> None:
    bob_client = client_for("user_bob")
    code = bob_client.get("/api/v1/friends/qr/me/payload").json()["code"]

    response = client.post("/api/v1/friends/scan", json={"payload": code})
    assert response.status_code == 200
    assert response.json()["id"] == "user_bob"


def test_unknown_short_code_is_not_found(users, client: TestClient) -> None:
    response = client.post("/api/v1/friends/scan", json={"payload": "ZZZZZZ"})
    assert response.status_code == 404


def test_too_short_code_is_rejected_by_validation(users, client: TestClient) -> None:
    response = client.post("/api/v1/friends/scan", json={"payload": "abc"})
    assert response.status_code == 422


def test_short_code_with_bad_characters_is_rejected(users, client: TestClient) -> None:
    response = client.post("/api/v1/friends/scan", json={"payload": "ABC!!!"})
    assert response.status_code == 400
    assert "niedozwolone" in response.json()["detail"]


def test_wrong_length_code_is_rejected(users, client: TestClient) -> None:
    response = client.post("/api/v1/friends/scan", json={"payload": "ABCDEFGH"})
    assert response.status_code == 400
    assert "6 znaków" in response.json()["detail"]


def test_you_cannot_accept_your_own_request(users, client: TestClient, client_for) -> None:
    bob_client = client_for("user_bob")
    invite = bob_client.get("/api/v1/friends/qr/me/payload").json()["payload"]
    client.post("/api/v1/friends/scan", json={"payload": invite})

    # Alice was the requester, so accepting from her side is a conflict.
    response = client.post("/api/v1/friends/user_bob/accept")
    assert response.status_code == 409


def test_remove_friend_hides_them_from_the_list(users, client: TestClient, client_for) -> None:
    bob_client = client_for("user_bob")
    invite = bob_client.get("/api/v1/friends/qr/me/payload").json()["payload"]
    client.post("/api/v1/friends/scan", json={"payload": invite})
    bob_client.post("/api/v1/friends/user_alice/accept")

    assert len(client.get("/api/v1/friends").json()) == 1

    assert client.delete("/api/v1/friends/user_bob").status_code == 204
    assert client.get("/api/v1/friends").json() == []


def test_strangers_are_not_listed(users, client: TestClient) -> None:
    """Carol exists but never connected to Alice."""
    assert client.get("/api/v1/friends").json() == []
