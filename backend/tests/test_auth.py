"""Clerk token verification: missing, invalid and valid tokens."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hy.auth import AuthError, authenticate_token
from hy.config import get_settings


def test_missing_token_is_rejected() -> None:
    with pytest.raises(AuthError, match="missing token"):
        authenticate_token(None)


def test_empty_token_is_rejected() -> None:
    with pytest.raises(AuthError, match="missing token"):
        authenticate_token("")


def test_bogus_token_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from clerk_backend_api.security.verifytoken import (
        TokenVerificationError,
        TokenVerificationErrorReason,
    )

    def _boom(token, options):
        raise TokenVerificationError(TokenVerificationErrorReason.TOKEN_INVALID_SIGNATURE)

    monkeypatch.setattr("hy.auth.verify_token", _boom)

    with pytest.raises(AuthError, match="token rejected"):
        authenticate_token("not-a-jwt")


def test_valid_token_yields_subject(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "hy.auth.verify_token",
        lambda token, options: {"sub": "user_123", "sid": "sess_1"},
    )

    principal = authenticate_token("good-token")
    assert principal.user_id == "user_123"
    assert principal.session_id == "sess_1"


def test_token_without_subject_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("hy.auth.verify_token", lambda token, options: {"sid": "sess_1"})

    with pytest.raises(AuthError, match="no subject"):
        authenticate_token("good-token")


def test_authorized_parties_are_passed_through() -> None:
    settings = get_settings()
    # Default test config has no authorized parties configured.
    assert settings.verify_token_options.authorized_parties is None


def test_rest_route_requires_bearer_token(users, push_spy) -> None:
    """The dependency override normally short-circuits this, so test the raw app."""
    from hy.asgi import create_app

    app = create_app()
    with TestClient(app) as raw:
        response = raw.get("/api/v1/friends")
        assert response.status_code == 401
        assert (
            "Clerk is not configured" in response.json()["detail"]
            or "token" in response.json()["detail"]
        )
