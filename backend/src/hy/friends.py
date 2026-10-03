"""Friend-graph queries shared by the REST routers and the WebSocket handler."""

from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from hy.models import FRIENDSHIP_ACCEPTED, FRIENDSHIP_PENDING, Friendship, User


def accepted_friend_ids(session: Session, user_id: str) -> list[str]:
    """Ids of users who share an accepted friendship with `user_id`."""
    rows = session.execute(
        select(Friendship.left_id, Friendship.right_id).where(
            Friendship.status == FRIENDSHIP_ACCEPTED,
            or_(Friendship.left_id == user_id, Friendship.right_id == user_id),
        )
    ).all()
    return [row.right_id if row.left_id == user_id else row.left_id for row in rows]


def friends_with_profiles(session: Session, user_id: str) -> list[tuple[User, Friendship]]:
    """Accepted friends joined with their local profile, oldest link first."""
    friendships = (
        session.execute(
            select(Friendship).where(
                Friendship.status == FRIENDSHIP_ACCEPTED,
                or_(Friendship.left_id == user_id, Friendship.right_id == user_id),
            )
        )
        .scalars()
        .all()
    )

    out: list[tuple[User, Friendship]] = []
    for link in friendships:
        other_id = link.right_id if link.left_id == user_id else link.left_id
        other = session.get(User, other_id)
        if other is not None:
            out.append((other, link))
    return out


def pending_requests(session: Session, user_id: str) -> list[tuple[User, Friendship]]:
    """Incoming requests — someone scanned my QR and wants to connect."""
    links = (
        session.execute(
            select(Friendship).where(
                Friendship.status == FRIENDSHIP_PENDING,
                Friendship.right_id == user_id,
            )
        )
        .scalars()
        .all()
    )
    out = []
    for link in links:
        other = session.get(User, link.requester_id)
        if other is not None:
            out.append((other, link))
    return out


def find_friendship(session: Session, a: str, b: str) -> Friendship | None:
    left, right = Friendship.normalize_pair(a, b)
    return session.execute(
        select(Friendship).where(Friendship.left_id == left, Friendship.right_id == right)
    ).scalar_one_or_none()


def get_or_create_friendship(session: Session, requester_id: str, addressee_id: str) -> Friendship:
    """Idempotent friend request.

    Scanning someone who already requested you is treated as an accept — it keeps
    the two-phone demo flow to "scan once, done" while still supporting the
    explicit accept path.
    """
    if requester_id == addressee_id:
        raise ValueError("cannot befriend yourself")

    existing = find_friendship(session, requester_id, addressee_id)
    if existing is not None:
        if existing.status == FRIENDSHIP_PENDING and existing.requester_id == addressee_id:
            existing.status = FRIENDSHIP_ACCEPTED
            from hy.models import utcnow

            existing.accepted_at = utcnow()
            session.flush()
        return existing

    left, right = Friendship.normalize_pair(requester_id, addressee_id)
    link = Friendship(
        left_id=left,
        right_id=right,
        requester_id=requester_id,
        status=FRIENDSHIP_PENDING,
    )
    session.add(link)
    session.flush()
    return link
