"""Pydantic request/response schemas.

Field names are camelCase on the wire because the mobile client is TypeScript;
the Python side uses snake_case internally and maps with explicit aliases.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from hy.models import (
    ALERT_ACTIVE,
    EVIDENCE_OPEN,
    FRIENDSHIP_ACCEPTED,
    FRIENDSHIP_PENDING,
)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# --------------------------------------------------------------------------- #
# devices
# --------------------------------------------------------------------------- #
class DeviceRegister(CamelModel):
    expo_push_token: str = Field(alias="expoPushToken", min_length=8, max_length=255)
    platform: str = Field(default="android", alias="platform", max_length=16)


class DeviceOut(CamelModel):
    id: str
    platform: str
    registered: bool = True


# --------------------------------------------------------------------------- #
# friends
# --------------------------------------------------------------------------- #
class InvitePayload(CamelModel):
    """The signed QR payload. `signature` is HMAC over the other fields."""

    scheme: str = Field(default="hm1", alias="v")
    user_id: str = Field(alias="u")
    nonce: str = Field(alias="n")
    expires_at: int = Field(alias="e")
    signature: str = Field(alias="s")
    code: str = Field(alias="c", min_length=6, max_length=6)


class InviteOut(CamelModel):
    scheme: str = "hm1"
    user_id: str = Field(alias="u")
    nonce: str = Field(alias="n")
    expires_at: int = Field(alias="e")
    signature: str = Field(alias="s")
    code: str = Field(alias="c")

    def to_payload_string(self) -> str:
        return f"hm1:{self.u}:{self.n}:{self.e}:{self.s}:{self.c}"


class ScanRequest(CamelModel):
    # Either a full signed `hm1:...` payload or a 6-character manual code.
    payload: str = Field(min_length=6, max_length=512)
    display_name: str | None = Field(default=None, alias="displayName", max_length=120)


class UserOut(CamelModel):
    id: str
    display_name: str | None = Field(default=None, alias="displayName")
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    status: str = FRIENDSHIP_PENDING
    friendship_id: str | None = Field(default=None, alias="friendshipId")
    last_seen_at: datetime | None = Field(default=None, alias="lastSeenAt")


# --------------------------------------------------------------------------- #
# alerts
# --------------------------------------------------------------------------- #
class AlertCreate(CamelModel):
    level: int = Field(ge=1, le=3)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0, le=100_000)
    bearing: float | None = Field(default=None, ge=-360, le=360)


class AlertOut(CamelModel):
    id: str
    user_id: str = Field(alias="userId")
    level: int
    status: str = ALERT_ACTIVE
    lat: float
    lng: float
    accuracy: float | None = None
    bearing: float | None = None
    created_at: datetime | None = Field(default=None, alias="createdAt")
    resolved_at: datetime | None = Field(default=None, alias="resolvedAt")
    dispatch_case_id: str | None = Field(default=None, alias="dispatchCaseId")
    dispatch_eta_min: int | None = Field(default=None, alias="dispatchEtaMin")
    evidence_session_id: str | None = Field(default=None, alias="evidenceSessionId")


class AlertCreateResponse(CamelModel):
    alert: AlertOut
    evidence_session_id: str | None = Field(default=None, alias="evidenceSessionId")
    chunk_seconds: int = Field(default=30, alias="chunkSeconds")
    notified_friends: int = Field(default=0, alias="notifiedFriends")


class ResolveRequest(CamelModel):
    reason: str | None = Field(default=None, max_length=200)


# --------------------------------------------------------------------------- #
# dispatch (mock authorities endpoint)
# --------------------------------------------------------------------------- #
class DispatchRequest(CamelModel):
    alert_id: str | None = Field(default=None, alias="alertId")
    level: int = Field(default=3, ge=1, le=3)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    evidence_session_id: str | None = Field(default=None, alias="evidenceSessionId")
    notes: str | None = Field(default=None, max_length=500)


class DispatchOut(CamelModel):
    case_id: str = Field(alias="caseId")
    status: str = "dispatched"
    eta_min: int = Field(alias="etaMin")
    unit: str = "patrol"
    mocked: bool = True
    received_at: datetime = Field(alias="receivedAt")
    evidence: dict = Field(default_factory=dict)


# --------------------------------------------------------------------------- #
# locations
# --------------------------------------------------------------------------- #
class LocationIn(CamelModel):
    type: str = "location"
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    acc: float | None = Field(default=None, ge=0, le=100_000)
    bearing: float | None = Field(default=None, ge=-360, le=360)
    seq: int | None = Field(default=None, ge=0)
    ts: float | None = None
    alert_id: str | None = Field(default=None, alias="alertId")


class LocationOut(CamelModel):
    type: str = "location"
    user_id: str = Field(alias="userId")
    lat: float
    lng: float
    acc: float | None = None
    bearing: float | None = None
    seq: int | None = None
    ts: float | None = None


class LocationSnapshotOut(CamelModel):
    locations: list[LocationOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# evidence
# --------------------------------------------------------------------------- #
class EvidenceSessionOut(CamelModel):
    id: str
    alert_id: str | None = Field(default=None, alias="alertId")
    user_id: str = Field(alias="userId")
    status: str = EVIDENCE_OPEN
    started_at: datetime | None = Field(default=None, alias="startedAt")
    ended_at: datetime | None = Field(default=None, alias="endedAt")
    chunk_seconds: int | None = Field(default=None, alias="chunkSeconds")
    chunk_count: int = Field(default=0, alias="chunkCount")
    total_bytes: int = Field(default=0, alias="totalBytes")
    duration_s: float | None = Field(default=None, alias="durationS")
    uploaded_bytes: int = Field(default=0, alias="uploadedBytes")
    expected_chunk_count: int | None = Field(default=None, alias="expectedChunkCount")
    next_seq: int = Field(default=0, alias="nextSeq")
    manifest_sha256: str | None = Field(default=None, alias="manifestSha256")
    has_manifest: bool = Field(default=False, alias="hasManifest")


class EvidenceFinalize(CamelModel):
    duration_s: float | None = Field(default=None, alias="durationS", ge=0)
    chunk_count: int | None = Field(default=None, alias="chunkCount", ge=0)
    end_lat: float | None = Field(default=None, alias="endLat", ge=-90, le=90)
    end_lng: float | None = Field(default=None, alias="endLng", ge=-180, le=180)


class EvidenceFinalizeOut(CamelModel):
    session_id: str = Field(alias="sessionId")
    status: str
    chunk_count: int = Field(alias="chunkCount")
    total_bytes: int = Field(alias="totalBytes")
    duration_s: float | None = Field(default=None, alias="durationS")
    manifest_sha256: str = Field(alias="manifestSha256")
    manifest_url: str = Field(alias="manifestUrl")


class FriendAlias(CamelModel):
    """Minimal friend identity for WebSocket handshake frames."""

    id: str
    display_name: str | None = Field(default=None, alias="displayName")
    status: str = FRIENDSHIP_ACCEPTED


# --------------------------------------------------------------------------- #
# incidents / danger heatmap
# --------------------------------------------------------------------------- #
class IncidentReportCreate(CamelModel):
    category: str = Field(min_length=2, max_length=32)
    category_label: str | None = Field(default=None, alias="categoryLabel")
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    severity: int = Field(default=2, ge=1, le=3)
    weight: float | None = Field(default=None, ge=0.0, le=1.0)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    reported_at: datetime | None = Field(default=None, alias="reportedAt")


class IncidentReportOut(CamelModel):
    id: str
    user_id: str | None = Field(default=None, alias="userId")
    category: str
    category_label: str = Field(alias="categoryLabel")
    severity: int
    weight: float
    lat: float
    lng: float
    title: str | None = None
    description: str | None = None
    reported_at: datetime | None = Field(default=None, alias="reportedAt")
    created_at: datetime | None = Field(default=None, alias="createdAt")


class HeatmapGeoJSON(CamelModel):
    type: str = "FeatureCollection"
    features: list[dict]


class IncidentStatsOut(CamelModel):
    total: int
    city: str = "Kraków"
    by_category: dict[str, int] = Field(alias="byCategory")
    high_risk_zones: list[str] = Field(alias="highRiskZones")
