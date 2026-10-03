"""Clerk session-token verification for both REST and WebSocket requests."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from clerk_backend_api.security.verifytoken import (
    TokenVerificationError,
    TokenVerificationErrorReason,
    verify_token,
)
from fastapi import Depends, HTTPException, Request, WebSocket, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from hy.config import get_settings
from hy.db import session_scope
from hy.models import User, utcnow


@dataclass(frozen=True, slots=True)
class Principal:
    """The verified Clerk identity for a request."""

    user_id: str
    session_id: str | None = None
    claims: dict | None = None


class AuthError(Exception):
    """Raised when a token is missing, malformed or fails verification."""


def authenticate_token(token: str | None) -> Principal:
    """Verify a Clerk session JWT and return the caller identity.

    Raises `AuthError` for every failure mode so callers can decide the
    transport-specific response (401 JSON vs. WS close code).
    """
    if not token:
        raise AuthError("missing token")

    settings = get_settings()
    if not settings.clerk_configured:
        # Fail closed, but with an actionable message rather than a stack trace.
        raise AuthError(
            "Clerk is not configured: set CLERK_JWT_KEY (preferred) or CLERK_SECRET_KEY"
        )

    try:
        claims = verify_token(token, settings.verify_token_options)
    except TokenVerificationError as exc:
        reason = getattr(exc, "reason", None)
        detail = reason.name if isinstance(reason, TokenVerificationErrorReason) else str(exc)
        raise AuthError(f"token rejected: {detail}") from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise AuthError(f"token verification failed: {exc}") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise AuthError("token has no subject")

    return Principal(user_id=str(user_id), session_id=claims.get("sid"), claims=claims)


def _bearer_from_header(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


async def require_principal(request: Request) -> Principal:
    """FastAPI dependency for REST routes."""
    token = _bearer_from_header(request.headers.get("authorization"))
    try:
        principal = authenticate_token(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    request.state.principal = principal
    _touch_last_seen(principal.user_id)
    return principal


CurrentPrincipal = Annotated[Principal, Depends(require_principal)]


async def optional_principal(request: Request) -> Principal | None:
    """FastAPI dependency for endpoints that accept both authenticated and guest callers.

    Only a *missing* token means "anonymous". A token that is present but fails
    verification is a 401 rather than a silent downgrade: otherwise an expired or
    misconfigured session would quietly turn an authenticated reporter into an
    anonymous one, and their report would lose the attribution that lets them find
    and withdraw it later.
    """
    token = _bearer_from_header(request.headers.get("authorization"))
    if not token:
        return None
    try:
        principal = authenticate_token(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    request.state.principal = principal
    _touch_last_seen(principal.user_id)
    return principal


OptionalPrincipal = Annotated[Principal | None, Depends(optional_principal)]


def _touch_last_seen(user_id: str) -> None:
    """Best-effort last-seen update; never fails the request."""
    try:
        with session_scope() as session:
            user = session.get(User, user_id)
            if user is not None:
                user.last_seen_at = utcnow()
    except Exception:  # pragma: no cover - telemetry must not break auth
        pass


def upsert_user(
    session: Session,
    *,
    user_id: str,
    email: str | None = None,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """Create the local mirror of a Clerk user, or refresh its profile fields."""
    user = session.get(User, user_id)
    if user is None:
        user = User(
            id=user_id,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
            last_seen_at=utcnow(),
        )
        session.add(user)
        session.flush()
        return user

    # Only overwrite with fresh non-null values from Clerk.
    if email:
        user.email = email
    if display_name:
        user.display_name = display_name
    if avatar_url:
        user.avatar_url = avatar_url
    user.last_seen_at = utcnow()
    session.flush()
    return user


def websocket_principal(websocket: WebSocket) -> Principal:
    """Authenticate a WebSocket handshake via the `token` query parameter.

    React Native's `WebSocket` cannot be relied on for custom headers, so the
    session token travels in the query string.
    """
    token = websocket.query_params.get("token")
    try:
        return authenticate_token(token)
    except AuthError as exc:
        raise AuthError(str(exc)) from exc


def principal_from_bearer(token: str | None) -> Principal:
    return authenticate_token(token)


def find_user(session: Session, user_id: str) -> User | None:
    return session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
