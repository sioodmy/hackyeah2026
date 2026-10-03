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
    """Update profile fields (display name, emoji / avatar icon)."""
    with session_scope() as session:
        user = session.get(User, principal.user_id)
        if user is None:
            user = upsert_user(session, user_id=principal.user_id)

        if body.display_name is not None:
            clean_name = body.display_name.strip()
            user.display_name = clean_name if clean_name else None

        if body.avatar_url is not None:
            clean_avatar = body.avatar_url.strip()
            user.avatar_url = clean_avatar if clean_avatar else None

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
