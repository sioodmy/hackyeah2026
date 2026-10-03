"""Tests for user profile management (display name and emoji avatar)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from hy.asgi import create_app


def test_get_my_profile_returns_default(users, client: TestClient) -> None:
    res = client.get("/api/v1/users/me")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "user_alice"
    assert data["displayName"] == "Alice"
    assert data["inviteCode"] is not None
    assert len(data["inviteCode"]) == 6


def test_update_display_name_and_emoji_avatar(users, client: TestClient) -> None:
    # Update both name and emoji avatar
    patch_res = client.patch(
        "/api/v1/users/me",
        json={"displayName": "Kasia", "avatarUrl": "🌸"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["displayName"] == "Kasia"
    assert updated["avatarUrl"] == "🌸"

    # Verify GET returns updated values
    get_res = client.get("/api/v1/users/me")
    assert get_res.status_code == 200
    profile = get_res.json()
    assert profile["displayName"] == "Kasia"
    assert profile["avatarUrl"] == "🌸"


def test_display_name_can_be_cleared(users, client: TestClient) -> None:
    """Sending an explicit null means "remove my name".

    An `is not None` check on the parsed body cannot tell that apart from the
    field being omitted, so the old name survived and the field could never be
    emptied from the app.
    """
    assert client.patch("/api/v1/users/me", json={"displayName": "Kasia"}).json()[
        "displayName"
    ] == ("Kasia")

    cleared = client.patch("/api/v1/users/me", json={"displayName": None})
    assert cleared.status_code == 200
    assert cleared.json()["displayName"] is None

    assert client.get("/api/v1/users/me").json()["displayName"] is None


def test_display_name_can_be_cleared_with_empty_string(users, client: TestClient) -> None:
    client.patch("/api/v1/users/me", json={"displayName": "Kasia"})
    assert (
        client.patch("/api/v1/users/me", json={"displayName": "   "}).json()["displayName"] is None
    )


def test_omitted_field_is_left_alone(users, client: TestClient) -> None:
    """A patch that touches only the avatar must not wipe the name."""
    client.patch("/api/v1/users/me", json={"displayName": "Kasia"})
    client.patch("/api/v1/users/me", json={"avatarUrl": "🦊"})
    assert client.get("/api/v1/users/me").json()["displayName"] == "Kasia"


def test_avatar_aura_round_trips(users, client: TestClient) -> None:
    res = client.patch("/api/v1/users/me", json={"avatarUrl": "🌸|#F472B6"})
    assert res.status_code == 200
    assert res.json()["avatarUrl"] == "🌸|#F472B6"


def test_avatar_with_malformed_aura_is_rejected(users, client: TestClient) -> None:
    """`avatar_url` is a friend-supplied string rendered by every client, so the
    `emoji|#RRGGBB` shape has to hold rather than being assumed downstream."""
    for bad in ["🌸|red", "🌸|#GGGGGG", "🌸|#FFF", "🌸|javascript:alert(1)"]:
        res = client.patch("/api/v1/users/me", json={"avatarUrl": bad})
        assert res.status_code == 422, bad


def test_users_me_requires_auth() -> None:
    anon = TestClient(create_app())
    assert anon.get("/api/v1/users/me").status_code == 401
    assert anon.patch("/api/v1/users/me", json={"displayName": "x"}).status_code == 401


def test_friends_list_and_snapshot_include_avatar(users, client: TestClient, client_for) -> None:
    bob_client = client_for("user_bob")

    # Set avatar and name for Alice
    client.patch("/api/v1/users/me", json={"displayName": "Alicja", "avatarUrl": "🦊"})

    # Set avatar and name for Bob
    bob_client.patch("/api/v1/users/me", json={"displayName": "Bobek", "avatarUrl": "⚡"})

    # Make them friends
    invite = bob_client.get("/api/v1/friends/qr/me/payload").json()["payload"]
    client.post("/api/v1/friends/scan", json={"payload": invite})
    bob_client.post("/api/v1/friends/user_alice/accept")

    # Bob lists friends - should see Alice's emoji avatar and name
    friends = bob_client.get("/api/v1/friends").json()
    assert len(friends) >= 1
    alice_entry = next(f for f in friends if f["id"] == "user_alice")
    assert alice_entry["avatarUrl"] == "🦊"
    assert alice_entry["displayName"] == "Alicja"
