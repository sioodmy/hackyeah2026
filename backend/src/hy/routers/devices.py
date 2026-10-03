"""Device registration — stores each install's Expo push token."""

from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import select

from hy.auth import CurrentPrincipal, upsert_user
from hy.db import session_scope
from hy.models import Device, utcnow
from hy.schemas import DeviceOut, DeviceRegister

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])


@router.post("", response_model=DeviceOut, status_code=status.HTTP_200_OK)
def register_device(body: DeviceRegister, principal: CurrentPrincipal) -> DeviceOut:
    """Idempotent: re-registering the same token is a no-op refresh."""
    with session_scope() as session:
        upsert_user(session, user_id=principal.user_id)

        device = session.execute(
            select(Device).where(Device.expo_push_token == body.expo_push_token)
        ).scalar_one_or_none()

        if device is None:
            device = Device(
                user_id=principal.user_id,
                expo_push_token=body.expo_push_token,
                platform=body.platform,
                last_seen_at=utcnow(),
            )
            session.add(device)
        else:
            # A token can be handed to a different account after a re-login.
            device.user_id = principal.user_id
            device.platform = body.platform
            device.last_seen_at = utcnow()

        session.flush()
        return DeviceOut(id=device.id, platform=device.platform, registered=True)


@router.get("", response_model=list[DeviceOut])
def list_devices(principal: CurrentPrincipal) -> list[DeviceOut]:
    with session_scope() as session:
        devices = (
            session.execute(select(Device).where(Device.user_id == principal.user_id))
            .scalars()
            .all()
        )
        return [DeviceOut(id=d.id, platform=d.platform) for d in devices]
