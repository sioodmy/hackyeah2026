"""Expo push notification delivery.

Push is the channel that actually reaches a friend's phone when someone is in
danger — it works with the app killed or backgrounded, which the WebSocket does
not. That is why alerts notify over push and only *locations* over the socket.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from hy.config import get_settings

log = logging.getLogger(__name__)

PUSH_URL = "https://exp.host/--/api/v2/push/send"

LEVEL_2_TITLE = "Potrzebuję pomocy"
LEVEL_3_TITLE = "FULL ALERT"


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
    *, level: int, tokens: list[str], lat: float, lng: float, display_name: str | None = None
) -> list[dict[str, Any]]:
    """Build one Expo push message per device token."""
    who = display_name or "Ktoś z bliskich"
    coords = _coordinates(lat, lng)

    if level >= 3:
        title = LEVEL_3_TITLE
        body = f"{who} — zagrożenie maksymalne. Lokalizacja: {coords}. Zadzwoń natychmiast."
        data = {"level": 3, "lat": lat, "lng": lng, "kind": "full-alert"}
    elif level == 2:
        title = LEVEL_2_TITLE
        body = (
            f"{who} zgłasza, że nie czuje się bezpiecznie. Lokalizacja: {coords}. Zadzwoń do niej."
        )
        data = {"level": 2, "lat": lat, "lng": lng, "kind": "help"}
    elif level == 1:
        title = "Ktoś blisko"
        body = f"{who} potrzebuje chwili. Lokalizacja: {coords}."
        data = {"level": 1, "lat": lat, "lng": lng, "kind": "check-in"}
    else:
        title = "Już bezpieczna"
        body = f"{who} rozwiązała alert. Możesz się rozłączyć."
        data = {"level": 0, "lat": lat, "lng": lng, "kind": "resolved"}

    messages: list[dict[str, Any]] = []
    for token in tokens:
        message: dict[str, Any] = {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default" if level > 0 else None,
            "channelId": "full-alert" if level >= 3 else "default",
        }
        if level >= 3:
            # Android: heads-up, bypass of Do Not Disturb when the app has the
            # permission, and a looping ring on the critical channel.
            message["priority"] = "high"
            message["interruptionLevel"] = "time-sensitive"
            message["categoryId"] = "full-alert"
            message["_contentAvailable"] = True
        messages.append(message)
    return messages


async def send_push(
    *, level: int, tokens: list[str], lat: float, lng: float, display_name: str | None = None
) -> PushResult:
    """Fan a push out to every device token. Never raises — push is best-effort."""
    settings = get_settings()
    if not tokens:
        return PushResult(sent=0, failed=0, ticket_ids=[], skipped_reason="no registered devices")

    messages = build_messages(
        level=level, tokens=tokens, lat=lat, lng=lng, display_name=display_name
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
