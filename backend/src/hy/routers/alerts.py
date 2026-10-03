"""Alert lifecycle: raise, escalate, acknowledge, resolve.

Threat levels as implemented here, from the sender's side and the friend's:

* **1** — the victim's phone fakes an incoming call, and friends get a plain
  notification. Nothing on their screen is taken over.
* **2** — everything level 1 does, plus friends are pushed a call request on its
  own heads-up channel, with the notification category the client turns into a
  full-screen incoming call, and their phones start receiving live positions over
  the WebSocket.
* **3** — everything level 2 does, plus an audio evidence session is opened,
  (via `/api/v1/authorities/dispatch`) the mock authorities are notified, and
  friends' phones get the critical channel: heads-up, `bypassDnd`, and a category
  that adds a button opening the app onto a looping siren, which runs until the
  alert is acknowledged.

Raising the level of an alert that is already live **notifies again**: a friend who
only heard the level-1 notification has to hear the level-3 alarm.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from hy.auth import CurrentPrincipal, upsert_user
from hy.db import session_scope
from hy.friends import accepted_friend_ids
from hy.models import (
    ACK_ORDER,
    ALERT_ACTIVE,
    ALERT_RESOLVED,
    EVIDENCE_OPEN,
    Alert,
    AlertAck,
    Device,
    EvidenceSession,
    User,
    utcnow,
)
from hy.push import send_push
from hy.schemas import (
    AlertAckIn,
    AlertAckOut,
    AlertCreate,
    AlertCreateResponse,
    AlertOut,
    ResolveRequest,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])

#: Length of one uploaded audio segment. The client records with the same value.
CHUNK_SECONDS = 30


@dataclass(slots=True)
class _PushJob:
    """A fan-out to run once the transaction has been committed."""

    level: int
    tokens: list[str]
    lat: float
    lng: float
    display_name: str | None
    alert_id: str
    user_id: str


def _friend_tokens(session, friend_ids: list[str]) -> list[str]:
    if not friend_ids:
        return []
    rows = (
        session.execute(select(Device.expo_push_token).where(Device.user_id.in_(friend_ids)))
        .scalars()
        .all()
    )
    return [str(token) for token in rows if token]


def _display_name(session, user_id: str) -> str | None:
    user = session.get(User, user_id)
    if user is None:
        return None
    return user.display_name


def _active_alert(session: Session, user_id: str) -> Alert | None:
    return (
        session.execute(
            select(Alert)
            .where(Alert.user_id == user_id, Alert.status == ALERT_ACTIVE)
            .order_by(Alert.created_at.desc())
        )
        .scalars()
        .first()
    )


def _acks(session: Session, alert_id: str) -> list[AlertAckOut]:
    """Every friend's response to this alert, oldest first."""
    rows = session.execute(
        select(AlertAck, User.display_name)
        .join(User, User.id == AlertAck.user_id, isouter=True)
        .where(AlertAck.alert_id == alert_id)
        .order_by(AlertAck.updated_at)
    ).all()
    return [
        AlertAckOut(
            user_id=ack.user_id,
            display_name=display_name,
            action=ack.action,
            at=ack.updated_at,
        )
        for ack, display_name in rows
    ]


def _out(session: Session, alert: Alert) -> AlertOut:
    return AlertOut.model_validate(alert).model_copy(update={"acks": _acks(session, alert.id)})


@router.post("", response_model=AlertCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(body: AlertCreate, principal: CurrentPrincipal) -> AlertCreateResponse:
    """Raise an alert. Idempotency: an existing active alert is returned instead
    of creating a second episode, because a panicked double-tap must not split
    the evidence stream in two.

    Escalating an alert that is already live updates that episode in place and
    notifies friends again at the higher level."""
    with session_scope() as session:
        upsert_user(session, user_id=principal.user_id)

        existing = _active_alert(session, principal.user_id)

        # Same level, or lower: nothing changed, so nobody is told anything again.
        if existing is not None and body.level <= existing.level:
            return AlertCreateResponse(
                alert=_out(session, existing),
                evidenceSessionId=existing.evidence_session_id,
                chunkSeconds=CHUNK_SECONDS,
                notifiedFriends=0,
            )

        escalated = existing is not None
        if existing is None:
            alert = Alert(
                user_id=principal.user_id,
                level=body.level,
                lat=body.lat,
                lng=body.lng,
                accuracy=body.accuracy,
                bearing=body.bearing,
            )
            session.add(alert)
            session.flush()
        else:
            alert = existing
            alert.level = body.level
            alert.lat = body.lat
            alert.lng = body.lng
            alert.accuracy = body.accuracy
            alert.bearing = body.bearing
            session.flush()

        evidence_session_id = alert.evidence_session_id
        if body.level >= 3 and evidence_session_id is None:
            evidence_session_id = _open_evidence_session(session, alert)

        friend_ids = accepted_friend_ids(session, principal.user_id)
        response = AlertCreateResponse(
            alert=_out(session, alert),
            evidenceSessionId=evidence_session_id,
            chunkSeconds=CHUNK_SECONDS,
            notifiedFriends=0,
        )
        job = _PushJob(
            level=alert.level,
            tokens=_friend_tokens(session, friend_ids),
            lat=alert.lat,
            lng=alert.lng,
            display_name=_display_name(session, principal.user_id),
            alert_id=alert.id,
            user_id=principal.user_id,
        )

    # Push outside the transaction — a slow Expo call must not hold a DB lock.
    notified = 0
    if job.tokens:
        result = await send_push(
            level=job.level,
            tokens=job.tokens,
            lat=job.lat,
            lng=job.lng,
            display_name=job.display_name,
            alert_id=job.alert_id,
            user_id=job.user_id,
        )
        notified = result.sent

    log.info(
        "alert %s level=%d %s friends=%d push_sent=%d evidence=%s",
        job.alert_id,
        job.level,
        "escalated" if escalated else "raised",
        len(friend_ids),
        notified,
        evidence_session_id,
    )

    return response.model_copy(update={"notified_friends": notified})


def _open_evidence_session(session, alert: Alert) -> str:
    """Create the audio-evidence session for a level-3 alert."""
    evidence = EvidenceSession(
        alert_id=alert.id,
        user_id=alert.user_id,
        chunk_seconds=CHUNK_SECONDS,
        start_lat=alert.lat,
        start_lng=alert.lng,
        status=EVIDENCE_OPEN,
    )
    session.add(evidence)
    session.flush()
    alert.evidence_session_id = evidence.id
    session.flush()
    return evidence.id


@router.get("/active", response_model=AlertOut | None)
def active_alert(principal: CurrentPrincipal) -> AlertOut | None:
    with session_scope() as session:
        alert = _active_alert(session, principal.user_id)
        return _out(session, alert) if alert else None


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: str, principal: CurrentPrincipal) -> AlertOut:
    with session_scope() as session:
        alert = session.get(Alert, alert_id)
        if alert is None or alert.user_id != principal.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak alertu")
        return _out(session, alert)


@router.post("/{alert_id}/ack", response_model=AlertAckOut)
def acknowledge_alert(alert_id: str, body: AlertAckIn, principal: CurrentPrincipal) -> AlertAckOut:
    """A friend says what they did with the alert: saw it, answered it, or is coming.

    The caller is a friend of the alert's owner, never the owner — the person in
    danger cannot confirm their own alarm, and an outsider must not be able to
    write into someone's emergency. The stored action only ever moves forward, so a
    push arriving late cannot downgrade "idę do niej" back to "widzę".
    """
    with session_scope() as session:
        alert = session.get(Alert, alert_id)
        if alert is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak alertu")
        if principal.user_id == alert.user_id or principal.user_id not in accepted_friend_ids(
            session, alert.user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="to nie jest Twój alarm"
            )
        if alert.status != ALERT_ACTIVE:
            # The episode is closed: the person in danger is safe and an
            # acknowledgement from here on is about nothing.
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="alert już rozwiązany")

        ack = (
            session.execute(
                select(AlertAck).where(
                    AlertAck.alert_id == alert_id, AlertAck.user_id == principal.user_id
                )
            )
            .scalars()
            .first()
        )
        if ack is None:
            ack = AlertAck(alert_id=alert_id, user_id=principal.user_id, action=body.action)
            session.add(ack)
        elif ACK_ORDER[body.action] > ACK_ORDER[ack.action]:
            ack.action = body.action
        session.flush()

        out = AlertAckOut(
            user_id=ack.user_id,
            display_name=_display_name(session, principal.user_id),
            action=ack.action,
            at=ack.updated_at,
        )

    log.info("alert %s ack user=%s action=%s", alert_id, principal.user_id, out.action)
    return out


@router.patch("/{alert_id}/resolve", response_model=AlertOut)
async def resolve_alert(
    alert_id: str, body: ResolveRequest, principal: CurrentPrincipal
) -> AlertOut:
    """End the episode. Finalizes an open evidence session and tells friends."""
    with session_scope() as session:
        alert = session.get(Alert, alert_id)
        if alert is None or alert.user_id != principal.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak alertu")

        already_resolved = alert.status == ALERT_RESOLVED
        if not already_resolved:
            alert.status = ALERT_RESOLVED
            alert.resolved_at = utcnow()

        friend_ids = accepted_friend_ids(session, principal.user_id)
        tokens = _friend_tokens(session, friend_ids)
        name = _display_name(session, principal.user_id)
        lat, lng = alert.lat, alert.lng
        session.flush()

        out = _out(session, alert)

    if tokens and not already_resolved:
        await send_push(
            level=0, tokens=tokens, lat=lat, lng=lng, display_name=name, alert_id=alert_id
        )

    return out


@router.post("/{alert_id}/dispatch", response_model=dict)
async def dispatch_alert(alert_id: str, principal: CurrentPrincipal) -> dict:
    """Convenience wrapper so the client can notify authorities in one call."""
    from hy.dispatch import dispatch as mock_dispatch

    with session_scope() as session:
        alert = session.get(Alert, alert_id)
        if alert is None or alert.user_id != principal.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak alertu")
        user_id, level = alert.user_id, alert.level
        lat, lng = alert.lat, alert.lng
        evidence_session_id = alert.evidence_session_id

    receipt = await mock_dispatch(
        user_id=user_id,
        lat=lat,
        lng=lng,
        level=level,
        alert_id=alert_id,
        evidence_session_id=evidence_session_id,
    )

    with session_scope() as session:
        alert = session.get(Alert, alert_id)
        if alert is not None:
            alert.dispatch_case_id = receipt.case_id
            alert.dispatch_eta_min = receipt.eta_min
            session.flush()

    return receipt.as_dict()
