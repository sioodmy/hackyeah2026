"""SQLAlchemy models.

Schema notes
------------
* `User.id` is the Clerk user id (`sub` claim) — we never mint our own.
* `LocationPing.id` is a monotonic bigint used as the live-location cursor.
* `Friendship` stores `min(requester, addressee)` as `left_id` so the pair has a
  single uniqueness constraint regardless of who scanned whose QR code.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hy.db import Base
from hy.invites import CODE_LENGTH

FRIENDSHIP_PENDING = "pending"
FRIENDSHIP_ACCEPTED = "accepted"
FRIENDSHIP_DECLINED = "declined"

ALERT_ACTIVE = "active"
ALERT_RESOLVED = "resolved"

EVIDENCE_OPEN = "open"
EVIDENCE_FINALIZED = "finalized"

INCIDENT_CATEGORY_LABELS: dict[str, str] = {
    "harassment": "Zaczepianie / Molestowanie słowne",
    "sexual_assault": "Próba gwałtu / Napaść na tle seksualnym",
    "assault": "Napaść fizyczna / Pobicie",
    "robbery": "Rozbój / Kradzież zuchwała",
    "stalking": "Śledzenie / Stalking",
    "suspicious": "Agresywna grupa / Zastraszanie",
    "other": "Inne niebezpieczne zdarzenie",
}

INCIDENT_DEFAULT_WEIGHTS: dict[str, float] = {
    "harassment": 0.55,
    "sexual_assault": 1.0,
    "assault": 0.9,
    "robbery": 0.75,
    "stalking": 0.7,
    "suspicious": 0.45,
    "other": 0.5,
}


def _uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Short human-typable invite code, for when the camera will not focus.
    invite_code: Mapped[str | None] = mapped_column(String(CODE_LENGTH), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    devices: Mapped[list[Device]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Device(Base):
    """An Expo push token for one of the user's installs."""

    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("expo_push_token", name="uq_devices_expo_push_token"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"))
    expo_push_token: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(16), default="android")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="devices")


class Friendship(Base):
    """Friend link. Created as pending by whoever scans the QR code."""

    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("left_id", "right_id", name="uq_friendships_pair"),
        Index("ix_friendships_left", "left_id"),
        Index("ix_friendships_right", "right_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    left_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"))
    right_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"))
    requester_id: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default=FRIENDSHIP_PENDING)
    # Nickname supplied by whoever scanned the QR code, so friends can be listed
    # by something more recognisable than a Clerk user id.
    alias: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @staticmethod
    def normalize_pair(a: str, b: str) -> tuple[str, str]:
        return (a, b) if a <= b else (b, a)


class Alert(Base):
    """One 'I am in danger' episode at a given threat level."""

    __tablename__ = "alerts"
    __table_args__ = (Index("ix_alerts_user_status", "user_id", "status"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"))
    level: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default=ALERT_ACTIVE)

    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    bearing: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Level 3: mock dispatch bookkeeping.
    dispatch_case_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dispatch_eta_min: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Level 3: link to the audio evidence session, if one was opened.
    evidence_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def as_public_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.user_id,
            "level": self.level,
            "status": self.status,
            "lat": self.lat,
            "lng": self.lng,
            "accuracy": self.accuracy,
            "bearing": self.bearing,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "dispatchCaseId": self.dispatch_case_id,
            "dispatchEtaMin": self.dispatch_eta_min,
            "evidenceSessionId": self.evidence_session_id,
        }


class LocationPing(Base):
    """A single live-location sample. `id` doubles as the fan-out cursor."""

    __tablename__ = "location_pings"
    __table_args__ = (
        Index("ix_pings_user_id", "user_id", "id"),
        Index("ix_pings_alert", "alert_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"))
    alert_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    bearing: Mapped[float | None] = mapped_column(Float, nullable=True)
    seq: Mapped[int | None] = mapped_column(Integer, nullable=True)
    client_ts: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EvidenceSession(Base):
    """Audio recording session, opened automatically at threat level 3."""

    __tablename__ = "evidence_sessions"
    __table_args__ = (Index("ix_evidence_user", "user_id", "started_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    alert_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey("users.id", ondelete="CASCADE"))

    status: Mapped[str] = mapped_column(String(16), default=EVIDENCE_OPEN)
    chunk_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    total_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)

    start_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Chain of custody: SHA-256 over the ordered chunk digests.
    manifest_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    manifest: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    chunks: Mapped[list[EvidenceChunk]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="EvidenceChunk.seq",
    )


class EvidenceChunk(Base):
    """One uploaded audio segment. `seq` is unique per session (idempotent)."""

    __tablename__ = "evidence_chunks"
    __table_args__ = (
        UniqueConstraint("session_id", "seq", name="uq_evidence_chunk_seq"),
        Index("ix_chunks_session_seq", "session_id", "seq"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("evidence_sessions.id", ondelete="CASCADE")
    )

    seq: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    mime: Mapped[str] = mapped_column(String(80), default="audio/mp4")
    storage_path: Mapped[str] = mapped_column(Text)

    # Client-supplied start time of the segment, relative to recording start.
    offset_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    client_ts: Mapped[float | None] = mapped_column(Float, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[EvidenceSession] = relationship(back_populates="chunks")


class DispatchLog(Base):
    """Audit trail for the mock 'authorities' endpoint."""

    __tablename__ = "dispatch_log"
    __table_args__ = (Index("ix_dispatch_alert", "alert_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    alert_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str] = mapped_column(String(128))
    case_id: Mapped[str] = mapped_column(String(64))
    eta_min: Mapped[int] = mapped_column(Integer)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    evidence_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    mocked: Mapped[bool] = mapped_column(Boolean, default=True)


class IncidentReport(Base):
    """User-submitted or seeded report of a dangerous situation in Krakow."""

    __tablename__ = "incident_reports"
    __table_args__ = (
        Index("ix_incidents_category", "category"),
        Index("ix_incidents_user", "user_id"),
        Index("ix_incidents_coords", "lat", "lng"),
        Index("ix_incidents_created", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    # CASCADE so deleting an account also deletes the reports it filed: an
    # orphaned Clerk id attached to a rape report is retained personal data.
    # Anonymous reports keep a NULL here and are not affected.
    user_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    category: Mapped[str] = mapped_column(String(32))
    severity: Mapped[int] = mapped_column(Integer, default=2)
    weight: Mapped[float] = mapped_column(Float, default=0.6)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def as_own_dict(self) -> dict:
        """Serialise for the reporter who filed this report.

        Deliberately omits `user_id`: no response in this app should ever carry a
        reporter identity. Coordinates here are the caller's own, so they stay
        exact — this is the one endpoint where the user needs their real position.
        """
        return {
            "id": self.id,
            "category": self.category,
            "categoryLabel": INCIDENT_CATEGORY_LABELS.get(self.category, self.category),
            "severity": self.severity,
            "weight": self.weight,
            "lat": self.lat,
            "lng": self.lng,
            "title": self.title or INCIDENT_CATEGORY_LABELS.get(self.category, self.category),
            "description": self.description,
            "reportedAt": self.reported_at.isoformat() if self.reported_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
