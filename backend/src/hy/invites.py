"""Signed QR invite payloads.

A friend invite is a compact `hm1:` string so it can live inside a QR code:

    hm1:<user_id>:<nonce>:<expires_at>:<hmac_hex>:<short_code>

The HMAC is over the first four fields using `INVITE_SIGNING_KEY`, which stops
someone from crafting a code for an arbitrary user id and force-adding it. The
6-character code is a manual fallback for typing a code when the camera will not
focus.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from hy.config import get_settings

SCHEME = "hm1"
INVITE_TTL_SECONDS = 24 * 60 * 60
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I/O/0/1 — easier to read aloud
CODE_LENGTH = 6


class InviteError(ValueError):
    """Raised when an invite payload is malformed, forged or expired."""


def _key() -> bytes:
    return get_settings().invite_signing_key.encode("utf-8")


def _sign(user_id: str, nonce: str, expires_at: int) -> str:
    message = f"{SCHEME}:{user_id}:{nonce}:{expires_at}".encode()
    return hmac.new(_key(), message, hashlib.sha256).hexdigest()[:32]


def make_short_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def create_invite(user_id: str, ttl_seconds: int = INVITE_TTL_SECONDS) -> dict[str, object]:
    """Build a fresh signed invite for `user_id`."""
    nonce = secrets.token_hex(8)
    expires_at = int(time.time()) + ttl_seconds
    signature = _sign(user_id, nonce, expires_at)
    code = make_short_code()
    return {
        "v": SCHEME,
        "u": user_id,
        "n": nonce,
        "e": expires_at,
        "s": signature,
        "c": code,
    }


def encode_invite(invite: dict[str, object]) -> str:
    return ":".join(
        [
            SCHEME,
            str(invite["u"]),
            str(invite["n"]),
            str(invite["e"]),
            str(invite["s"]),
            str(invite["c"]),
        ]
    )


def parse_and_verify(raw: str) -> dict[str, str]:
    """Parse and verify an invite payload; raise `InviteError` on any problem."""
    parts = raw.strip().split(":")
    if len(parts) != 6:
        raise InviteError("invite payload must have 6 fields")

    scheme, user_id, nonce, expires_raw, signature, code = parts
    if scheme != SCHEME:
        raise InviteError(f"unsupported invite scheme: {scheme!r}")
    if not nonce or not code:
        raise InviteError("invite payload has empty fields")

    try:
        expires_at = int(expires_raw)
    except ValueError as exc:
        raise InviteError("expiry is not an integer") from exc

    expected = _sign(user_id, nonce, expires_at)
    if not hmac.compare_digest(expected, signature):
        raise InviteError("invite signature does not match")

    if expires_at < int(time.time()):
        raise InviteError("invite has expired — ask for a fresh code")

    return {
        "scheme": scheme,
        "user_id": user_id,
        "nonce": nonce,
        "expires_at": str(expires_at),
        "signature": signature,
        "code": code.upper(),
    }
