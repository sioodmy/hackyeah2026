"""Friend management: QR invites, scan, accept, remove."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from hy.auth import CurrentPrincipal, upsert_user
from hy.db import session_scope
from hy.friends import (
    find_friendship,
    friends_with_profiles,
    get_or_create_friendship,
    pending_requests,
)
from hy.invites import (
    CODE_ALPHABET,
    CODE_LENGTH,
    InviteError,
    create_invite,
    encode_invite,
    make_short_code,
    parse_and_verify,
)
from hy.models import FRIENDSHIP_ACCEPTED, FRIENDSHIP_DECLINED, User, utcnow
from hy.schemas import InviteOut, ScanRequest, UserOut

router = APIRouter(prefix="/api/v1/friends", tags=["friends"])


def _ensure_invite_code(session, user_id: str) -> str:
    """Return this user's short invite code, minting one on first use."""
    user = upsert_user(session, user_id=user_id)

    if not user.invite_code:
        # A collision would be a 1-in-900m event; retry a few times anyway.
        for _ in range(5):
            candidate = make_short_code()
            clash = session.execute(
                select(User.id).where(User.invite_code == candidate)
            ).scalar_one_or_none()
            if clash is None:
                user.invite_code = candidate
                session.flush()
                return candidate
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="nie udało się wygenerować kodu — spróbuj ponownie",
        )

    return user.invite_code


@router.get("/qr/me", response_model=InviteOut)
def my_invite(principal: CurrentPrincipal) -> InviteOut:
    """The signed payload this user renders as a QR code for others to scan."""
    with session_scope() as session:
        code = _ensure_invite_code(session, principal.user_id)
    invite = create_invite(principal.user_id)
    # Keep the printed code and the stored code identical.
    return InviteOut(**{**invite, "c": code})


@router.get("/qr/me/payload")
def my_invite_payload(principal: CurrentPrincipal) -> dict[str, str]:
    """Same invite, already joined into the single string the QR encodes."""
    with session_scope() as session:
        code = _ensure_invite_code(session, principal.user_id)
    invite = create_invite(principal.user_id)
    return {"payload": encode_invite({**invite, "c": code}), "code": code}


@router.get("", response_model=list[UserOut])
def list_friends(principal: CurrentPrincipal) -> list[UserOut]:
    with session_scope() as session:
        rows = friends_with_profiles(session, principal.user_id)
        return [
            UserOut(
                id=user.id,
                displayName=link.alias or user.display_name or user.id[:8],
                avatarUrl=user.avatar_url,
                status=link.status,
                friendshipId=link.id,
                lastSeenAt=user.last_seen_at,
            )
            for user, link in rows
        ]


@router.get("/requests", response_model=list[UserOut])
def list_requests(principal: CurrentPrincipal) -> list[UserOut]:
    with session_scope() as session:
        return [
            UserOut(
                id=user.id,
                displayName=link.alias or user.display_name,
                avatarUrl=user.avatar_url,
                status=link.status,
                friendshipId=link.id,
                lastSeenAt=user.last_seen_at,
            )
            for user, link in pending_requests(session, principal.user_id)
        ]


def _resolve_code(raw: str) -> str:
    """Map a manually typed 6-character code to its owner's user id."""
    code = raw.strip().upper()
    if len(code) != CODE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"kod musi mieć dokładnie {CODE_LENGTH} znaków",
        )
    if any(ch not in CODE_ALPHABET for ch in code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="kod zawiera niedozwolone znaki"
        )

    with session_scope() as session:
        owner = session.execute(select(User).where(User.invite_code == code)).scalar_one_or_none()
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="nie znaleziono znajomej z tym kodem — użyj skanowania QR",
            )
        return owner.id


@router.post("/scan", response_model=UserOut)
def scan_invite(body: ScanRequest, principal: CurrentPrincipal) -> UserOut:
    """Accept a scanned QR payload, or a manually typed code.

    Idempotent: scanning the same code twice does not create a second link, and
    scanning someone who already sent *us* a request completes the handshake —
    which keeps the two-phone demo to "scan once and you are connected".
    """
    raw = body.payload.strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="pusty kod")

    if ":" in raw:
        try:
            target_id = parse_and_verify(raw)["user_id"]
        except InviteError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    else:
        # An unsigned short code can only *propose* a link; the other side still
        # has to accept it, so this is not a way to add someone unilaterally.
        target_id = _resolve_code(raw)

    if target_id == principal.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="to jest Twój własny kod"
        )

    with session_scope() as session:
        upsert_user(session, user_id=principal.user_id)
        try:
            link = get_or_create_friendship(session, principal.user_id, target_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        if body.display_name:
            link.alias = body.display_name

        try:
            session.flush()
        except IntegrityError as exc:  # pragma: no cover - concurrent scan
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="relacja już istnieje"
            ) from exc

        target = session.get(User, target_id)
        return UserOut(
            id=target_id,
            displayName=link.alias or (target.display_name if target else None),
            avatarUrl=target.avatar_url if target else None,
            status=link.status,
            friendshipId=link.id,
        )


@router.post("/{friend_id}/accept", response_model=UserOut)
def accept_friend(friend_id: str, principal: CurrentPrincipal) -> UserOut:
    with session_scope() as session:
        link = find_friendship(session, principal.user_id, friend_id)
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak zaproszenia")
        if link.requester_id == principal.user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="to Ty wysłałeś zaproszenie"
            )
        link.status = FRIENDSHIP_ACCEPTED
        link.accepted_at = utcnow()
        session.flush()
        friend = session.get(User, friend_id)
        return UserOut(
            id=friend_id,
            displayName=link.alias or (friend.display_name if friend else None),
            avatarUrl=friend.avatar_url if friend else None,
            status=link.status,
            friendshipId=link.id,
        )


@router.delete("/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(friend_id: str, principal: CurrentPrincipal) -> None:
    with session_scope() as session:
        link = find_friendship(session, principal.user_id, friend_id)
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak relacji")
        link.status = FRIENDSHIP_DECLINED
        session.flush()


@router.get("/by-id/{friend_id}", response_model=UserOut)
def friend_detail(friend_id: str, principal: CurrentPrincipal) -> UserOut:
    with session_scope() as session:
        link = find_friendship(session, principal.user_id, friend_id)
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak relacji")
        friend = session.get(User, friend_id)
        return UserOut(
            id=friend_id,
            displayName=link.alias or (friend.display_name if friend else None),
            avatarUrl=friend.avatar_url if friend else None,
            status=link.status,
            friendshipId=link.id,
        )
