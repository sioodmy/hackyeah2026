"""Test configuration.

Environment variables are set at import time, before `hy.config` is first
loaded, because `get_settings()` is cached for the whole process.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://panicmap@127.0.0.1:5433/panicmap_test",
)

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["EVIDENCE_DIR"] = tempfile.mkdtemp(prefix="panicmap-evidence-test-")
os.environ["INVITE_SIGNING_KEY"] = "test-signing-key"
os.environ["DISPATCH_ARTIFICIAL_DELAY_SECONDS"] = "0"
# The suite creates the schema once per session; the app must not also try to,
# because a fixture may hold an open transaction and block its DDL lock.
os.environ["HY_SKIP_CREATE_ALL"] = "1"
# Present so `Settings.clerk_configured` is truthy; actual verification is stubbed.
os.environ["CLERK_JWT_KEY"] = "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from hy.asgi import create_app  # noqa: E402
from hy.auth import Principal, require_principal  # noqa: E402
from hy.db import Base, get_engine, session_scope  # noqa: E402
from hy.models import (  # noqa: E402
    Device,
    Friendship,
    User,
)


def _ensure_test_database() -> None:
    """Create the test database if it is missing."""
    target = TEST_DB_URL.rsplit("/", 1)[-1].split("?")[0]
    admin_url = TEST_DB_URL.rsplit("/", 1)[0] + "/postgres"
    admin_engine = __import__("sqlalchemy").create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{target}"'))
    finally:
        admin_engine.dispose()


_ensure_test_database()


@pytest.fixture(scope="session", autouse=True)
def _schema() -> Iterator[None]:
    engine = get_engine()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables() -> Iterator[None]:
    """Truncate every table between tests, keeping the schema around."""
    yield
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, devices, friendships, alerts, location_pings, "
                "evidence_sessions, evidence_chunks, dispatch_log, incident_reports RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def session() -> Iterator[Session]:
    """A session that is committed as tests go.

    Fixtures and helpers commit eagerly: the app under test runs on its own
    connection, so uncommitted fixture data would be invisible to it — and an
    INSERT of the same primary key would block on the open transaction.
    """
    with session_scope() as db:
        yield db


def make_user(session: Session, user_id: str, **fields) -> User:
    user = User(id=user_id, display_name=fields.get("display_name"), last_seen_at=None)
    session.add(user)
    session.commit()
    return user


def make_device(session: Session, user_id: str, token: str) -> Device:
    device = Device(user_id=user_id, expo_push_token=token)
    session.add(device)
    session.commit()
    return device


def make_friendship(session: Session, a: str, b: str) -> Friendship:
    left, right = Friendship.normalize_pair(a, b)
    link = Friendship(
        left_id=left,
        right_id=right,
        requester_id=a,
        status="accepted",
        alias=f"friend-of-{a}",
    )
    session.add(link)
    session.commit()
    return link


@pytest.fixture
def users(session: Session) -> tuple[str, str, str]:
    """Two friends plus an outsider."""
    make_user(session, "user_alice", display_name="Alice")
    make_user(session, "user_bob", display_name="Bob")
    make_user(session, "user_carol", display_name="Carol")
    return "user_alice", "user_bob", "user_carol"


@pytest.fixture
def evidence_dir() -> Path:
    return Path(os.environ["EVIDENCE_DIR"])


@pytest.fixture
def client() -> Iterator[TestClient]:
    """TestClient whose auth dependency always resolves to `user_alice`."""
    app = create_app()

    def _override() -> Principal:
        return Principal(user_id="user_alice")

    app.dependency_overrides[require_principal] = _override
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_for() -> Iterator[callable]:
    """Factory for clients authenticated as an arbitrary user id."""
    app = create_app()
    clients: list[TestClient] = []

    def _make(user_id: str) -> TestClient:
        def _override() -> Principal:
            return Principal(user_id=user_id)

        app.dependency_overrides[require_principal] = _override
        test_client = TestClient(app)
        test_client.__enter__()
        clients.append(test_client)
        return test_client

    yield _make

    for test_client in clients:
        test_client.__exit__(None, None, None)


@pytest.fixture
def push_spy(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replace Expo push delivery with a recorder."""
    calls: list[dict] = []

    async def _fake_send_push(*, level, tokens, lat, lng, display_name=None):
        from hy.push import PushResult

        calls.append(
            {
                "level": level,
                "tokens": list(tokens),
                "lat": lat,
                "lng": lng,
                "displayName": display_name,
            }
        )
        return PushResult(
            sent=len(tokens), failed=0, ticket_ids=[f"t{i}" for i in range(len(tokens))]
        )

    import hy.routers.alerts as alerts_router
    import hy.routers.locations as locations_router  # noqa: F401

    monkeypatch.setattr(alerts_router, "send_push", _fake_send_push)
    return calls
