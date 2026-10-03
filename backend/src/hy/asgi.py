"""ASGI application entrypoint.

Run locally::

    uv run uvicorn hy.asgi:app --reload --host 0.0.0.0 --port 8000

Run from the Nix package::

    nix run .
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from hy.config import get_settings
from hy.db import get_engine
from hy.realtime import registry
from hy.routers import (
    alerts,
    authorities,
    devices,
    evidence,
    friends,
    incidents,
    locations,
    users,
)
from hy.ws import router as ws_router

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("hy")


def _init_database() -> None:
    """Create tables on boot — a hackathon does not need migration tooling."""
    from hy import models  # noqa: F401  (ensures models are registered)
    from hy.db import Base, session_scope

    Path(get_settings().evidence_dir).expanduser().mkdir(parents=True, exist_ok=True)

    if get_settings().skip_create_all:
        log.info("skipping create_all (schema assumed to exist)")
        return

    Base.metadata.create_all(get_engine())

    if get_settings().seed_demo_incidents:
        from hy.krakow_data import seed_krakow_incidents

        with session_scope() as session:
            seed_krakow_incidents(session)
    log.info("database ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_database()
    log.info("PanicMap API ready")
    yield
    await registry.disconnect_all()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="PanicMap API",
        version="0.1.0",
        description=(
            "Backend for PanicMap: live friend locations over WebSocket, threat-level "
            "alerting with Expo push, segmented audio evidence upload, and danger heatmap."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(users.router)
    app.include_router(devices.router)
    app.include_router(friends.router)
    app.include_router(alerts.router)
    app.include_router(authorities.router)
    app.include_router(locations.router)
    app.include_router(evidence.router)
    app.include_router(incidents.router)
    app.include_router(ws_router)

    @app.get("/healthz", tags=["meta"])
    def healthz() -> dict:
        db_ok = True
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as exc:
            log.warning("health check: database unreachable: %s", exc)
            db_ok = False
        return {
            "ok": True,
            "database": db_ok,
            "clerkConfigured": settings.clerk_configured,
            "sockets": registry.connection_count(),
        }

    return app


app = create_app()


def main() -> int:
    """Console-script entrypoint used by the Nix package (`hy-api`)."""
    import uvicorn

    host = os.environ.get("HY_HOST", "0.0.0.0")
    port = int(os.environ.get("HY_PORT", "8000"))
    # One worker on purpose: the WebSocket registry is in-process. See README.
    uvicorn.run("hy.asgi:app", host=host, port=port, workers=1, log_level="info")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
