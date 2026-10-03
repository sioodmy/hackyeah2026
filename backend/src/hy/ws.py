"""Live friend locations over a native WebSocket.

Protocol (JSON text frames)
---------------------------
client → server
    {"type":"location","lat":52.23,"lng":21.01,"acc":12,"bearing":90,"seq":7,"ts":1730000000.0}
    {"type":"pong"}

server → client
    {"type":"hello","self":"user_1","friends":[{"id":"user_2","displayName":"Kasia"}],"lastSeq":42}
    {"type":"ack","seq":7}
    {"type":"location","userId":"user_2","lat":…,"lng":…,"acc":…,"bearing":…,"seq":…,"ts":…}
    {"type":"ping"}

Auth arrives as `?token=<clerk session jwt>` because React Native's WebSocket
cannot be relied on to send custom headers.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from hy.auth import AuthError, websocket_principal
from hy.config import get_settings
from hy.db import run_db
from hy.friends import accepted_friend_ids, friends_with_profiles
from hy.models import LocationPing, User
from hy.realtime import pump, registry
from hy.routers.locations import store_ping
from hy.schemas import LocationIn

log = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])

WS_CLOSE_UNAUTHORIZED = 1008
WS_CLOSE_BAD_REQUEST = 1003


def _load_friends(user_id: str) -> tuple[list[str], list[dict]]:
    """Fetch the friend list off the event loop."""

    def _work(session):
        ids = accepted_friend_ids(session, user_id)
        profiles = [
            {
                "id": user.id,
                "displayName": link.alias or user.display_name or user.id[:8],
                "avatarUrl": user.avatar_url,
            }
            for user, link in friends_with_profiles(session, user_id)
        ]
        return ids, profiles

    return run_db(_work)


def _load_replay(user_id: str, limit: int) -> list[dict]:
    """Recent pings from accepted friends, for reconnect without a map jump."""

    def _work(session):
        friend_ids = accepted_friend_ids(session, user_id)
        if not friend_ids:
            return []
        profile_map = {
            user.id: (link.alias or user.display_name or user.id[:8], user.avatar_url)
            for user, link in friends_with_profiles(session, user_id)
        }
        rows = (
            session.query(LocationPing)
            .filter(LocationPing.user_id.in_(friend_ids))
            .order_by(LocationPing.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "type": "location",
                "userId": row.user_id,
                "displayName": profile_map.get(row.user_id, (None, None))[0],
                "avatarUrl": profile_map.get(row.user_id, (None, None))[1],
                "lat": row.lat,
                "lng": row.lng,
                "acc": row.accuracy,
                "bearing": row.bearing,
                "seq": row.seq,
                "ts": row.client_ts,
            }
            for row in reversed(rows)
        ]

    return run_db(_work)


def _persist_ping(user_id: str, payload: LocationIn) -> tuple[list[str], dict]:
    """Store a ping and return the payload plus who should receive it."""

    def _work(session):
        store_ping(session, user_id=user_id, payload=payload)
        friend_ids = accepted_friend_ids(session, user_id)
        user = session.get(User, user_id)
        message = {
            "type": "location",
            "userId": user_id,
            "displayName": user.display_name if user else None,
            "avatarUrl": user.avatar_url if user else None,
            "lat": payload.lat,
            "lng": payload.lng,
            "acc": payload.acc,
            "bearing": payload.bearing,
            "seq": payload.seq,
            "ts": payload.ts,
        }
        return friend_ids, message

    return run_db(_work)


@router.websocket("/ws/locations")
async def locations_socket(websocket: WebSocket) -> None:
    settings = get_settings()

    try:
        principal = websocket_principal(websocket)
    except AuthError as exc:
        log.warning("ws rejected: %s", exc)
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED, reason=str(exc)[:120])
        return

    await websocket.accept()

    try:
        friend_ids, profiles = await _load_friends(principal.user_id)
    except Exception as exc:  # pragma: no cover - database unavailable
        log.exception("ws friend lookup failed: %s", exc)
        await websocket.close(code=1011, reason="friend lookup failed")
        return

    sub = await registry.subscribe(principal.user_id, websocket)
    pump_task = asyncio.create_task(pump(sub))
    heartbeat_task: asyncio.Task | None = None

    try:
        await websocket.send_json(
            {
                "type": "hello",
                "self": principal.user_id,
                "friends": profiles,
                "friendIds": friend_ids,
                "serverTs": time.time(),
            }
        )

        # Replay a little history so a reconnecting phone does not have to wait
        # a full ping interval for its markers to appear.
        try:
            for frame in await _load_replay(principal.user_id, settings.ws_replay_limit):
                await websocket.send_json(frame)
        except Exception as exc:  # pragma: no cover - replay is best effort
            log.info("ws replay skipped: %s", exc)

        async def _heartbeat() -> None:
            while True:
                await asyncio.sleep(settings.ws_heartbeat_seconds)
                with contextlib.suppress(Exception):
                    await websocket.send_json({"type": "ping", "ts": time.time()})

        heartbeat_task = asyncio.create_task(_heartbeat())

        while True:
            raw = await websocket.receive_text()
            try:
                payload = LocationIn.model_validate_json(raw)
            except ValidationError as exc:
                log.info("ws bad frame: %s", exc.errors()[0].get("msg"))
                await websocket.send_json({"type": "error", "message": "invalid frame"})
                continue

            kind = payload.type
            if kind == "pong":
                continue

            if kind == "location":
                try:
                    friend_ids_now, message = await _persist_ping(principal.user_id, payload)
                except Exception as exc:
                    log.warning("ws ping persist failed: %s", exc)
                    continue
                # Ack so the client knows the ping was stored, not just queued.
                with contextlib.suppress(Exception):
                    await websocket.send_json({"type": "ack", "seq": payload.seq})
                await registry.broadcast_to_friends(principal.user_id, friend_ids_now, message)
                continue

            await websocket.send_json({"type": "error", "message": f"unknown type {kind!r}"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover - transport level failure
        log.info("ws closed for user=%s: %s", principal.user_id, exc)
    finally:
        if heartbeat_task is not None:
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task
        pump_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await pump_task
        await registry.unsubscribe(sub)
