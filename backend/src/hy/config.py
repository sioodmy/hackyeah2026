"""Application configuration, read from the environment or a `.env` file."""

from __future__ import annotations

from functools import lru_cache

from clerk_backend_api.security.types import VerifyTokenOptions
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- database -----------------------------------------------------------
    database_url: str = "postgresql+psycopg://panicmap:panicmap@127.0.0.1:5432/panicmap"

    # --- clerk --------------------------------------------------------------
    # The publishable key is only needed by the mobile client; the backend needs
    # the secret key (for JWKS fallback) and the PEM public key for networkless
    # RS256 verification.
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_jwt_key: str = ""
    clerk_authorized_parties: list[str] = Field(default_factory=list)

    # --- signed QR invite payloads -----------------------------------------
    invite_signing_key: str = "dev-invite-key-change-me"

    # --- expo push ----------------------------------------------------------
    expo_access_token: str = ""

    # --- evidence storage ---------------------------------------------------
    evidence_dir: str = "./var/evidence"
    # Upper bound for a single uploaded chunk (bytes). Segments are ~30s of AAC.
    evidence_max_chunk_bytes: int = 32 * 1024 * 1024

    # --- realtime -----------------------------------------------------------
    ws_heartbeat_seconds: float = 15.0
    # How many pings to replay on reconnect so the map doesn't jump.
    ws_replay_limit: int = 20

    # --- misc ---------------------------------------------------------------
    # A native app is not subject to CORS, so this only matters for a browser
    # client (Expo web) and for curl. Keep it as a list so a deployment can
    # enumerate origins; `["*"]` disables credentials rather than granting them.
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    dispatch_artificial_delay_seconds: float = 0.4
    # Skip `create_all` on startup. Set when the schema is provisioned
    # elsewhere (the test suite creates it once per session).
    skip_create_all: bool = False
    # Seed the incident table from `backend/src/hy/krakow_data.py`. Off by
    # default: those are invented assault reports, and a database that mixes them
    # with real ones produces a heatmap nobody can tell apart from fiction.
    seed_demo_incidents: bool = False

    @property
    def verify_token_options(self) -> VerifyTokenOptions:
        """Options for Clerk session-token verification.

        Passing `jwt_key` makes verification networkless; if it is absent we fall
        back to fetching the JWKS with `secret_key`.
        """
        return VerifyTokenOptions(
            secret_key=self.clerk_secret_key or None,
            jwt_key=self.clerk_jwt_key or None,
            authorized_parties=list(self.clerk_authorized_parties) or None,
        )

    @property
    def clerk_configured(self) -> bool:
        """True when we have enough to verify tokens (PEM key or secret key)."""
        return bool(self.clerk_jwt_key or self.clerk_secret_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
