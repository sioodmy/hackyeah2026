"""In-memory WebSocket connection registry and fan-out.

Design constraints
------------------
* One uvicorn worker (see README). The registry therefore lives in process
  memory — no Redis, no sticky sessions.
* Each connection gets an outbound queue of size 1 holding only the *newest*
  location. A phone on a bad network drops stale coordinates instead of
  accumulating a backlog that would replay minutes later, which is exactly the
  behaviour you do not want in an emergency.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)


@dataclass(eq=False)
class Subscriber:
    """One connected phone."""

    user_id: str
    websocket: WebSocket
    queue: asyncio.Queue[dict[str, Any]] = field(default_factory=lambda: asyncio.Queue(maxsize=1))
    task: asyncio.Task[None] | None = None

    def offer(self, payload: dict[str, Any]) -> None:
        """Publish the newest payload, evicting anything already queued."""
        if self.queue.full():
            with contextlib.suppress(asyncio.QueueEmpty):
                self.queue.get_nowait()
        with contextlib.suppress(asyncio.QueueFull):
            self.queue.put_nowait(payload)


class ConnectionRegistry:
    """Tracks live sockets and who may see whose location."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[Subscriber]] = {}
        self._lock = asyncio.Lock()

    # --- lifecycle ---------------------------------------------------------
    async def subscribe(self, user_id: str, websocket: WebSocket) -> Subscriber:
        sub = Subscriber(user_id=user_id, websocket=websocket)
        async with self._lock:
            self._subscribers.setdefault(user_id, set()).add(sub)
        log.info("ws connect user=%s total_for_user=%d", user_id, len(self._subscribers[user_id]))
        return sub

    async def unsubscribe(self, sub: Subscriber) -> None:
        async with self._lock:
            peers = self._subscribers.get(sub.user_id)
            if peers is not None:
                peers.discard(sub)
                if not peers:
                    self._subscribers.pop(sub.user_id, None)
        log.info("ws disconnect user=%s", sub.user_id)

    # --- queries -----------------------------------------------------------
    def is_connected(self, user_id: str) -> bool:
        return bool(self._subscribers.get(user_id))

    def connection_count(self) -> int:
        return sum(len(v) for v in self._subscribers.values())

    async def _fanout(self, user_ids: Iterable[str], payload: dict[str, Any]) -> int:
        delivered = 0
        targets: list[Subscriber] = []
        async with self._lock:
            seen: set[Subscriber] = set()
            for uid in user_ids:
                for sub in self._subscribers.get(uid, ()):
                    if sub not in seen:
                        seen.add(sub)
                        targets.append(sub)
        for sub in targets:
            sub.offer(payload)
            delivered += 1
        return delivered

    async def broadcast_to_friends(
        self, sender_id: str, friend_ids: Iterable[str], payload: dict[str, Any]
    ) -> int:
        """Send `payload` to every live socket of `friend_ids` (never to sender)."""
        return await self._fanout((fid for fid in friend_ids if fid != sender_id), payload)

    async def send_to(self, user_id: str, payload: dict[str, Any]) -> int:
        return await self._fanout([user_id], payload)

    async def disconnect_all(self) -> None:
        async with self._lock:
            subs = [s for peers in self._subscribers.values() for s in peers]
            self._subscribers.clear()
        for sub in subs:
            with contextlib.suppress(Exception):
                await sub.websocket.close(code=1001)


registry = ConnectionRegistry()


async def pump(sub: Subscriber) -> None:
    """Drain a subscriber's queue onto its socket, dropping dead connections."""
    try:
        while True:
            payload = await sub.queue.get()
            await sub.websocket.send_json(payload)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # socket closed / network gone
        log.info("ws pump ended user=%s: %s", sub.user_id, exc)
