"""Database engine and session plumbing (SQLAlchemy 2, sync psycopg driver).

The whole app uses the *sync* driver. That is deliberate: the WebSocket handlers
are async, so every database call made from them goes through
`run_in_threadpool` (see `db.run_in_threadpool`) instead of blocking the event
loop.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from starlette.concurrency import run_in_threadpool

from hy.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=10,
            future=True,
        )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), expire_on_commit=False, future=True)
    return _session_factory


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope. Commits on success, rolls back on failure."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def run_db(fn, *args: Any, **kwargs: Any):
    """Run `fn(session, *args, **kwargs)` in a worker thread.

    Used from async handlers (notably the WebSocket loop) so blocking psycopg
    calls never stall the event loop. The session is created, used and
    committed inside the worker thread.
    """

    def _call():
        with session_scope() as session:
            return fn(session, *args, **kwargs)

    return run_in_threadpool(_call)


def reset_engine() -> None:
    """Drop the cached engine — used by tests that swap the database URL."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
