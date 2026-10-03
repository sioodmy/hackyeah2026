"""Alert lifecycle: raise, list, resolve.

Threat levels as implemented here:

* **1** — stays on the device. After a short delay the phone fakes an incoming
  call, which is the escape hatch that needs no network and no other person.
* **2** — everything level 1 does, plus accepted friends are pushed a location
  and their phones start receiving live positions over the WebSocket.
* **3** — everything level 2 does, plus an audio evidence session is opened and
  (via `/api/v1/authorities/dispatch`) the mock authorities are notified.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from hy.auth import CurrentPrincipal, upsert_user
from hy.db import session_scope
from hy.friends import accepted_friend_ids
from hy.models import (
    ALERT_ACTIVE,
    ALERT_RESOLVED,
    EVIDENCE_OPEN,
    Alert,
    Device,
    EvidenceSession,
    User,
    utcnow,
)
from hy.push import send_push
from hy.schemas import AlertCreate, AlertCreateResponse, AlertOut, ResolveRequest

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])

#: Length of one uploaded audio segment. The client records with the same value.
CHUNK_SECONDS = 30


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


@router.post("", response_model=AlertCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(body: AlertCreate, principal: CurrentPrincipal) -> AlertCreateResponse:
    """Raise an alert. Idempotency: an existing active alert is returned instead
    of creating a second episode, because a panicked double-tap must not split
    the evidence stream in two."""
    with session_scope() as session:
        upsert_user(session, user_id=principal.user_id)

        existing = (
            session.execute(
                select(Alert)
                .where(Alert.user_id == principal.user_id, Alert.status == ALERT_ACTIVE)
                .order_by(Alert.created_at.desc())
            )
            .scalars()
            .first()
        )

        if existing is not None:
            # Escalation: a higher level upgrades the live episode in place.
            if body.level > existing.level:
                existing.level = body.level
                existing.lat = body.lat
                existing.lng = body.lng
                existing.accuracy = body.accuracy
                existing.bearing = body.bearing
                session.flush()
                if body.level >= 3 and existing.evidence_session_id is None:
                    session_id = _open_evidence_session(session, existing)
                    session.flush()
                    return AlertCreateResponse(
                        alert=AlertOut.model_validate(existing),
                        evidenceSessionId=session_id,
                        chunkSeconds=CHUNK_SECONDS,
                        notifiedFriends=0,
                    )
                return AlertCreateResponse(
                    alert=AlertOut.model_validate(existing),
                    evidenceSessionId=existing.evidence_session_id,
                    chunkSeconds=CHUNK_SECONDS,
                    notifiedFriends=0,
                )

            return AlertCreateResponse(
                alert=AlertOut.model_validate(existing),
                evidenceSessionId=existing.evidence_session_id,
                chunkSeconds=CHUNK_SECONDS,
                notifiedFriends=0,
            )

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

        evidence_session_id: str | None = None
        if body.level >= 3:
            evidence_session_id = _open_evidence_session(session, alert)

        friend_ids = accepted_friend_ids(session, principal.user_id)
        tokens = _friend_tokens(session, friend_ids)
        name = _display_name(session, principal.user_id)

        alert_id = alert.id
        lat, lng, level = alert.lat, alert.lng, alert.level
        session.flush()

    # Push outside the transaction — a slow Expo call must not hold a DB lock.
    notified = 0
    if tokens:
        result = await send_push(level=level, tokens=tokens, lat=lat, lng=lng, display_name=name)
        notified = result.sent

    log.info(
        "alert %s level=%d friends=%d push_sent=%d evidence=%s",
        alert_id,
        level,
        len(friend_ids),
        notified,
        evidence_session_id,
    )

    return AlertCreateResponse(
        alert=AlertOut.model_validate(alert),
        evidenceSessionId=evidence_session_id,
        chunkSeconds=CHUNK_SECONDS,
        notifiedFriends=notified,
    )


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
        alert = (
            session.execute(
                select(Alert)
                .where(Alert.user_id == principal.user_id, Alert.status == ALERT_ACTIVE)
                .order_by(Alert.created_at.desc())
            )
            .scalars()
            .first()
        )
        return AlertOut.model_validate(alert) if alert else None


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: str, principal: CurrentPrincipal) -> AlertOut:
    with session_scope() as session:
        alert = session.get(Alert, alert_id)
        if alert is None or alert.user_id != principal.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="brak alertu")
        return AlertOut.model_validate(alert)


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

        out = AlertOut.model_validate(alert)

    if tokens and not already_resolved:
        await send_push(level=0, tokens=tokens, lat=lat, lng=lng, display_name=name)

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
