"""Mock public-safety dispatch.

There is no real 112 integration in this project — this module stands in for it
so the demo can show the full chain: level 3 → authorities notified → case
number + ETA back on the victim's screen. Every call is recorded in
`dispatch_log` with `mocked=True` so it is obvious in the data what was real.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass

from hy.config import get_settings
from hy.db import session_scope
from hy.models import DispatchLog, utcnow

log = logging.getLogger(__name__)

UNITS = ["patrol", "patrol", "intervention", "response"]


@dataclass(slots=True)
class DispatchReceipt:
    case_id: str
    eta_min: int
    unit: str
    mocked: bool = True
    received_at: float = 0.0
    evidence: dict | None = None

    def as_dict(self) -> dict:
        return {
            "caseId": self.case_id,
            "status": "dispatched",
            "etaMin": self.eta_min,
            "unit": self.unit,
            "mocked": self.mocked,
            "receivedAt": utcnow().isoformat(),
            "evidence": self.evidence
            or {"sessionId": None, "attached": False, "note": "no audio evidence attached"},
        }


def _case_id() -> str:
    # Stable-looking, obviously synthetic: MOCK-<year>-<4 digits>.
    return f"MOCK-{time.gmtime().tm_year}-{random.randint(1000, 9999)}"


async def dispatch(
    *,
    user_id: str,
    lat: float,
    lng: float,
    level: int = 3,
    alert_id: str | None = None,
    evidence_session_id: str | None = None,
) -> DispatchReceipt:
    """Pretend to page the authorities, then return a case number and ETA."""
    settings = get_settings()

    # Artificial latency: a real dispatch takes time, and the UI waits on it.
    await asyncio.sleep(max(0.0, settings.dispatch_artificial_delay_seconds))

    receipt = DispatchReceipt(
        case_id=_case_id(),
        eta_min=random.randint(4, 11),
        unit=random.choice(UNITS),
        received_at=time.time(),
        evidence=(
            {"sessionId": evidence_session_id, "attached": True, "note": "audio evidence pending"}
            if evidence_session_id
            else None
        ),
    )

    try:
        with session_scope() as session:
            session.add(
                DispatchLog(
                    alert_id=alert_id,
                    user_id=user_id,
                    case_id=receipt.case_id,
                    eta_min=receipt.eta_min,
                    lat=lat,
                    lng=lng,
                    evidence_session_id=evidence_session_id,
                    mocked=True,
                )
            )
    except Exception as exc:  # pragma: no cover - audit write must not break alerting
        log.warning("could not record dispatch log: %s", exc)

    log.info("MOCK dispatch case=%s level=%s eta=%smin", receipt.case_id, level, receipt.eta_min)
    return receipt
