"""Mock authorities endpoint — stands in for a 112 integration."""

from __future__ import annotations

from fastapi import APIRouter, status

from hy.auth import CurrentPrincipal
from hy.schemas import DispatchOut, DispatchRequest

router = APIRouter(prefix="/api/v1/authorities", tags=["authorities"])


@router.post("/dispatch", response_model=DispatchOut, status_code=status.HTTP_202_ACCEPTED)
async def dispatch(body: DispatchRequest, principal: CurrentPrincipal) -> DispatchOut:
    """Notify the (mock) authorities.

    Deliberately a separate endpoint from `POST /api/v1/alerts` so the demo can
    show the two consequences of level 3 arriving independently, and so a retry
    of the alert call cannot page anyone twice.
    """
    from hy.dispatch import dispatch as mock_dispatch

    receipt = await mock_dispatch(
        user_id=principal.user_id,
        lat=body.lat,
        lng=body.lng,
        level=body.level,
        alert_id=body.alert_id,
        evidence_session_id=body.evidence_session_id,
    )
    return DispatchOut(**receipt.as_dict())
