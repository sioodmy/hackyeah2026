"""User profile management: viewing and updating display name and emoji avatar."""

from __future__ import annotations

from fastapi import APIRouter

from hy.auth import CurrentPrincipal, upsert_user
from hy.db import session_scope
from hy.models import User
from hy.routers.friends import _ensure_invite_code
from hy.schemas import UserProfileOut, UserProfileUpdate

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserProfileOut)
def get_my_profile(principal: CurrentPrincipal) -> UserProfileOut:
    """Return the profile of the authenticated user, creating their record if missing."""
    with session_scope() as session:
        user = upsert_user(session, user_id=principal.user_id)
        code = _ensure_invite_code(session, principal.user_id)
        return UserProfileOut(
            id=user.id,
            email=user.email,
            displayName=user.display_name,
            avatarUrl=user.avatar_url,
            inviteCode=code,
            lastSeenAt=user.last_seen_at,
        )


@router.patch("/me", response_model=UserProfileOut)
def update_my_profile(body: UserProfileUpdate, principal: CurrentPrincipal) -> UserProfileOut:
    """Update profile fields (display name, emoji / avatar icon).

    `model_fields_set` is what makes clearing work: a client that sends
    `{"displayName": null}` means "remove my name", but a plain `is not None` test
    would read that as "field omitted" and silently keep the old value, leaving the
    user unable to ever empty the field.
    """
    with session_scope() as session:
        user = session.get(User, principal.user_id)
        if user is None:
            user = upsert_user(session, user_id=principal.user_id)

        if "display_name" in body.model_fields_set:
            clean_name = (body.display_name or "").strip()
            user.display_name = clean_name or None

        if "avatar_url" in body.model_fields_set:
            user.avatar_url = body.avatar_url

        session.flush()
        code = _ensure_invite_code(session, principal.user_id)

        return UserProfileOut(
            id=user.id,
            email=user.email,
            displayName=user.display_name,
            avatarUrl=user.avatar_url,
            inviteCode=code,
            lastSeenAt=user.last_seen_at,
        )
