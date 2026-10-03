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
def update_my_profile(
    principal: CurrentPrincipal, body: UserProfileUpdate | None = None
) -> UserProfileOut:
    """Update profile fields (display name, emoji / avatar icon).

    PATCH semantics: only keys present in the request body are touched.
    An explicit `null` (or whitespace-only string, normalised to None by the
    schema) clears the field; a missing key leaves it unchanged.
    An empty body is a no-op returning the current profile.
    """
    with session_scope() as session:
        user = session.get(User, principal.user_id)
        if user is None:
            user = upsert_user(session, user_id=principal.user_id)

        if body is not None:
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
