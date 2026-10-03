"""Tests for user profile management (display name and emoji avatar)."""

from __future__ import annotations

from fastapi.testclient import TestClient


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
