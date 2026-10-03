"""Expo push notification delivery.

Push is the channel that actually reaches a friend's phone when someone is in
danger — it works with the app killed or backgrounded, which the WebSocket does
not. That is why alerts notify over push and only *locations* over the socket.

What each level does to the friend's phone:

* **1** — a notification. Nothing takes over the screen.
* **2** — a call request: heads-up on its own channel and a notification category
  the client turns into a full-screen incoming call, so answering it is the thing
  the victim asked for.
* **3** — an alarm: the critical channel, `time-sensitive`, full-screen intent, and
  a category the client turns into a looping siren that only an acknowledgement
  stops.

Every message carries `alertId` and the sender's name, because the client cannot
route an incoming call or an alarm without knowing who is raising it.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

from hy.config import get_settings

log = logging.getLogger(__name__)

PUSH_URL = "https://exp.host/--/api/v2/push/send"

LEVEL_2_TITLE = "Potrzebuję pomocy"
LEVEL_3_TITLE = "FULL ALERT"

#: Android channels the client registers. Level 2 heads up without touching Do Not
#: Disturb; only level 3 earns the bypass.
CALL_CHANNEL = "call-request"
FULL_ALERT_CHANNEL = "full-alert"
DEFAULT_CHANNEL = "default"

#: Notification categories the client registers. Each one has to exist on the
#: phone with at least one action, which is what gives a level-2 or level-3 push a
#: button ("Odbierz", "Idę do niej") that opens the app onto the right screen. A
#: category is *not* a full-screen intent — Android needs `setCategory` on the
#: notification for that, which `expo-notifications` never sends — so the channel's
#: sound, its vibration and `bypassDnd` are what wake a friend whose app is dead.
CALL_CATEGORY = "call"
FULL_ALERT_CATEGORY = "alarm"


@dataclass(slots=True)
class PushResult:
    sent: int
    failed: int
    ticket_ids: list[str]
    skipped_reason: str | None = None


def _coordinates(lat: float, lng: float) -> str:
    """Compact, human-readable coordinates for the notification body."""
    return f"{lat:.4f}, {lng:.4f}"


def build_messages(
    *,
    level: int,
    tokens: list[str],
    lat: float,
    lng: float,
    display_name: str | None = None,
    alert_id: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    """Build one Expo push message per device token."""
    who = display_name or "Ktoś z bliskich"
    coords = _coordinates(lat, lng)

    if level >= 3:
        title = LEVEL_3_TITLE
        body = f"{who} — zagrożenie maksymalne. Lokalizacja: {coords}. Zadzwoń natychmiast."
        kind = "full-alert"
    elif level == 2:
        title = LEVEL_2_TITLE
        body = (
            f"{who} zgłasza, że nie czuje się bezpiecznie. Lokalizacja: {coords}. Zadzwoń do niej."
        )
        kind = "help"
    elif level == 1:
        title = "Ktoś blisko"
        body = f"{who} potrzebuje chwili. Lokalizacja: {coords}."
        kind = "check-in"
    else:
        title = "Już bezpieczna"
        body = f"{who} rozwiązała alert. Możesz się rozłączyć."
        kind = "resolved"

    # `at` lets a phone discard a stale push: an alert that was resolved a minute
    # ago must not re-open a call screen because its notification arrived late.
    shared: dict[str, Any] = {
        "level": min(max(level, 0), 3),
        "lat": lat,
        "lng": lng,
        "kind": kind,
        "from": display_name or "",
        "fromId": user_id or "",
        "alertId": alert_id or "",
        "at": int(time.time()),
    }

    messages: list[dict[str, Any]] = []
    for token in tokens:
        message: dict[str, Any] = {
            "to": token,
            "title": title,
            "body": body,
            "data": dict(shared),
            "sound": "default" if level > 0 else None,
            "channelId": _channel_for(level),
            # One thread per alert, so escalations stack instead of scattering.
            "threadId": alert_id or None,
        }
        if level >= 3:
            # Android: heads-up, bypass of Do Not Disturb when the app has the
            # permission, and the `alarm` category, which adds the button that
            # opens the app straight onto the alarm.
            message["priority"] = "high"
            message["interruptionLevel"] = "time-sensitive"
            message["categoryId"] = FULL_ALERT_CATEGORY
            message["_contentAvailable"] = True
        elif level == 2:
            # A call request has to be a heads-up, and the `call` category gives it
            # an "Odbierz" button that opens the app onto the incoming call. No Do
            # Not Disturb bypass: only level 3 earns that.
            message["priority"] = "high"
            message["categoryId"] = CALL_CATEGORY
        messages.append(message)
    return messages


def _channel_for(level: int) -> str:
    if level >= 3:
        return FULL_ALERT_CHANNEL
    if level == 2:
        return CALL_CHANNEL
    return DEFAULT_CHANNEL


async def send_push(
    *,
    level: int,
    tokens: list[str],
    lat: float,
    lng: float,
    display_name: str | None = None,
    alert_id: str | None = None,
    user_id: str | None = None,
) -> PushResult:
    """Fan a push out to every device token. Never raises — push is best-effort."""
    settings = get_settings()
    if not tokens:
        return PushResult(sent=0, failed=0, ticket_ids=[], skipped_reason="no registered devices")

    messages = build_messages(
        level=level,
        tokens=tokens,
        lat=lat,
        lng=lng,
        display_name=display_name,
        alert_id=alert_id,
        user_id=user_id,
    )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }
    if settings.expo_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_access_token}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(PUSH_URL, json=messages, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        log.warning("expo push failed (%d messages): %s", len(messages), exc)
        return PushResult(sent=0, failed=len(messages), ticket_ids=[], skipped_reason=str(exc))

    tickets = [
        str(item.get("id")) for item in payload.get("data", []) if item.get("status") == "ok"
    ]
    failed = len(messages) - len(tickets)
    log.info("expo push level=%d sent=%d failed=%d", level, len(tickets), failed)
    return PushResult(sent=len(tickets), failed=failed, ticket_ids=tickets)
