"""Location ingestion and snapshots.

The WebSocket at `/ws/locations` is the primary path. The HTTP `POST /ping`
endpoint exists as a fallback so the map still updates if the socket cannot be
established (captive portal, proxy, sleeping phone) — degraded, not broken.
"""

from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import select

from hy.auth import CurrentPrincipal
from hy.db import session_scope
from hy.friends import accepted_friend_ids
from hy.models import ALERT_ACTIVE, Alert, LocationPing, User, utcnow
from hy.schemas import LocationIn, LocationOut, LocationSnapshotOut

router = APIRouter(prefix="/api/v1/locations", tags=["locations"])


def store_ping(
    session,
    *,
    user_id: str,
    payload: LocationIn,
    alert_id: str | None = None,
) -> LocationPing:
    """Persist one ping, attaching it to the user's active alert when there is one."""
    if alert_id is None:
        active = (
            session.execute(
                select(Alert.id)
                .where(Alert.user_id == user_id, Alert.status == ALERT_ACTIVE)
                .order_by(Alert.created_at.desc())
            )
            .scalars()
            .first()
        )
        alert_id = active

    ping = LocationPing(
        user_id=user_id,
        alert_id=alert_id,
        lat=payload.lat,
        lng=payload.lng,
        accuracy=payload.acc,
        bearing=payload.bearing,
        seq=payload.seq,
        client_ts=payload.ts,
    )
    session.add(ping)
    session.flush()
    return ping


@router.post("/ping", status_code=status.HTTP_202_ACCEPTED)
async def push_ping(payload: LocationIn, principal: CurrentPrincipal) -> dict:
    """Fallback location submission when the WebSocket is unavailable."""
    from hy.realtime import registry

    with session_scope() as session:
        ping = store_ping(
            session,
            user_id=principal.user_id,
            payload=payload,
            alert_id=payload.alert_id,
        )
        user = session.get(User, principal.user_id)
        friend_ids = accepted_friend_ids(session, principal.user_id)
        display_name = user.display_name if user else None
        avatar_url = user.avatar_url if user else None

    await registry.broadcast_to_friends(
        principal.user_id,
        friend_ids,
        {
            "type": "location",
            "userId": principal.user_id,
            "displayName": display_name,
            "avatarUrl": avatar_url,
            "lat": ping.lat,
            "lng": ping.lng,
            "acc": ping.accuracy,
            "bearing": ping.bearing,
            "seq": ping.seq,
            "ts": ping.client_ts,
        },
    )
    return {"ok": True, "id": ping.id}


@router.get("/snapshot", response_model=LocationSnapshotOut)
def snapshot(principal: CurrentPrincipal) -> LocationSnapshotOut:
    """Last known position of every accepted friend."""
    with session_scope() as session:
        friend_ids = accepted_friend_ids(session, principal.user_id)
        if not friend_ids:
            return LocationSnapshotOut(locations=[])

        rows = (
            session.execute(
                select(LocationPing)
                .where(LocationPing.user_id.in_(friend_ids))
                .order_by(LocationPing.id.desc())
                .limit(len(friend_ids) * 4)
            )
            .scalars()
            .all()
        )

        users = {u.id: u for u in session.query(User).filter(User.id.in_(friend_ids)).all()}

        # Keep only the newest ping per friend.
        newest: dict[str, LocationPing] = {}
        for row in rows:
            newest.setdefault(row.user_id, row)

        locations = [
            LocationOut(
                userId=ping.user_id,
                lat=ping.lat,
                lng=ping.lng,
                acc=ping.accuracy,
                bearing=ping.bearing,
                seq=ping.seq,
                ts=ping.client_ts,
                displayName=users[ping.user_id].display_name if ping.user_id in users else None,
                avatarUrl=users[ping.user_id].avatar_url if ping.user_id in users else None,
            )
            for ping in newest.values()
        ]

    locations.sort(key=lambda loc: loc.user_id)
    return LocationSnapshotOut(locations=locations)


def prune_pings(older_than_days: int = 30) -> int:
    """Housekeeping: drop location history that is no longer useful."""
    from datetime import timedelta

    cutoff = utcnow() - timedelta(days=older_than_days)
    with session_scope() as session:
        deleted = (
            session.query(LocationPing)
            .filter(LocationPing.created_at < cutoff)
            .delete(synchronize_session=False)
        )
    return deleted
