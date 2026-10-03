"""Endpoints for Krakow safety incident reporting and the aggregated danger heatmap.

Privacy rules this module enforces, because they are the whole point of it:

* Nothing that leaves this module is ever a reporter's exact position or free-text
  account. Reports are snapped to a ~200 m grid before they are read back out, and
  `description` never crosses the wire except to the reporter who wrote it.
* No response ever carries `user_id`. Reporter identity is only reachable through
  the caller's own report list.
* Reads require a principal. Anonymous *writing* is allowed on purpose: someone in
  danger should not have to log in first. Abuse is bounded by validating the
  category against the whitelist, refusing client-supplied weights, and confining
  coordinates to the Krakow bounding box.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, func, select

from hy.auth import CurrentPrincipal, OptionalPrincipal, upsert_user
from hy.db import session_scope
from hy.models import (
    INCIDENT_CATEGORY_LABELS,
    INCIDENT_DEFAULT_WEIGHTS,
    IncidentReport,
)
from hy.schemas import (
    HeatmapGeoJSON,
    IncidentReportCreate,
    IncidentReportOut,
    IncidentStatsOut,
)

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])

# Reports are bucketed to this grid before anything is returned, so a returned
# coordinate identifies a ~200 m cell rather than a doorway. 0.0018 deg of
# latitude is roughly 200 m.
GRID_DEG = 0.0018

# Generous bounds around Krakow. Anything outside is rejected rather than stored:
# without this, anyone can paint a false "danger zone" onto a victim's address.
KRAKOW_LAT_RANGE = (49.80, 50.20)
KRAKOW_LNG_RANGE = (19.70, 20.15)

# Upper bounds on what one request may read or write, so the heatmap query cannot
# be turned into a full table dump or the write path into a flood.
MAX_CELLS = 500
MAX_OWN_REPORTS = 100

SEVERITY_FACTOR = {1: 0.7, 2: 1.0, 3: 1.3}


def snap(lat: float, lng: float) -> tuple[float, float]:
    """Round a coordinate to the centre of its grid cell."""
    cell_lat = round(round(lat / GRID_DEG) * GRID_DEG, 6)
    cell_lng = round(round(lng / GRID_DEG) * GRID_DEG, 6)
    return cell_lat, cell_lng


def _in_krakow(lat: float, lng: float) -> bool:
    lat_ok = KRAKOW_LAT_RANGE[0] <= lat <= KRAKOW_LAT_RANGE[1]
    lng_ok = KRAKOW_LNG_RANGE[0] <= lng <= KRAKOW_LNG_RANGE[1]
    return lat_ok and lng_ok


def _severity_weight(category: str, severity: int) -> float:
    base = INCIDENT_DEFAULT_WEIGHTS.get(category, INCIDENT_DEFAULT_WEIGHTS["other"])
    return round(min(1.0, max(0.1, base * SEVERITY_FACTOR.get(severity, 1.0))), 2)


@router.get("/heatmap", response_model=HeatmapGeoJSON)
def get_krakow_heatmap(
    principal: CurrentPrincipal,
    category: Annotated[str | None, Query(description="Filter by category")] = None,
    min_severity: Annotated[int | None, Query(ge=1, le=3, description="Minimum severity")] = None,
) -> HeatmapGeoJSON:
    """Return a density heatmap of reported incidents as GeoJSON for MapLibre.

    The features are grid cells, not reports: each one carries how many reports
    fell in the cell, their combined weight and the worst severity seen. There is
    no per-report id, no description and no coordinate finer than the cell, so the
    response cannot be used to locate or identify anybody.
    """
    with session_scope() as session:
        query = select(IncidentReport)
        if category:
            query = query.where(IncidentReport.category == category)
        if min_severity:
            query = query.where(IncidentReport.severity >= min_severity)

        incidents = session.execute(query).scalars().all()

    cells: dict[tuple[float, float], dict] = {}
    for inc in incidents:
        key = snap(inc.lat, inc.lng)
        cell = cells.setdefault(
            key,
            {
                "count": 0,
                "weight": 0.0,
                "severity": 0,
                "categories": {},
            },
        )
        cell["count"] += 1
        cell["weight"] += inc.weight
        cell["severity"] = max(cell["severity"], inc.severity)
        cell["categories"][inc.category] = cell["categories"].get(inc.category, 0) + 1

    # Heaviest cells first, so the cap drops the quietest rather than an
    # arbitrary prefix of the table.
    ranked = sorted(cells.items(), key=lambda item: item[1]["weight"], reverse=True)[:MAX_CELLS]

    features = []
    for (cell_lat, cell_lng), cell in ranked:
        dominant = max(cell["categories"], key=lambda key: cell["categories"][key])
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [cell_lng, cell_lat]},
                "properties": {
                    "count": cell["count"],
                    # Normalised back into 0..1 so MapLibre's weight ramp behaves.
                    "weight": round(min(1.0, cell["weight"] / 3), 3),
                    "severity": cell["severity"],
                    "category": dominant,
                    "categoryLabel": INCIDENT_CATEGORY_LABELS.get(dominant, dominant),
                },
            }
        )

    return HeatmapGeoJSON(type="FeatureCollection", features=features)


@router.get("", response_model=list[IncidentReportOut])
def list_my_incidents(
    principal: CurrentPrincipal,
    category: Annotated[str | None, Query(description="Filter by category")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_OWN_REPORTS)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[IncidentReportOut]:
    """List the reports the caller filed themselves.

    Deliberately scoped to the caller: this app collects rape and assault
    reports, so there is no endpoint that hands one user's reports, identity or
    position to another.
    """
    with session_scope() as session:
        query = (
            select(IncidentReport)
            .where(IncidentReport.user_id == principal.user_id)
            .order_by(desc(IncidentReport.created_at))
            .offset(offset)
            .limit(limit)
        )
        if category:
            query = query.where(IncidentReport.category == category)

        incidents = session.execute(query).scalars().all()
        return [IncidentReportOut(**inc.as_own_dict()) for inc in incidents]


@router.post("", response_model=IncidentReportOut, status_code=status.HTTP_201_CREATED)
def report_incident(
    payload: IncidentReportCreate,
    caller: OptionalPrincipal,
) -> IncidentReportOut:
    """Report a harassment, assault or other dangerous situation in Kraków.

    Works for authenticated users and for anonymous callers, because the person
    reporting may be in a situation where logging in is not an option.
    """
    if payload.category not in INCIDENT_DEFAULT_WEIGHTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown category {payload.category!r}",
        )

    if not _in_krakow(payload.lat, payload.lng):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Report is outside the covered area (Kraków)",
        )

    # `payload.weight` is ignored on purpose: a caller-supplied weight would let
    # anyone inflate a cell into a permanent red zone without any evidence.
    weight = _severity_weight(payload.category, payload.severity)

    with session_scope() as session:
        user_id = None
        if caller is not None:
            # `incident_reports.user_id` is a real foreign key so that deleting an
            # account deletes the reports it filed. That means the user row has to
            # exist first, and a Clerk user who has never opened /users/me or
            # /friends has no row yet — without this upsert their report would fail
            # on the constraint and be lost exactly when it mattered most.
            upsert_user(session, user_id=caller.user_id)
            user_id = caller.user_id

        incident = IncidentReport(
            user_id=user_id,
            category=payload.category,
            severity=payload.severity,
            weight=weight,
            lat=payload.lat,
            lng=payload.lng,
            title=payload.title or INCIDENT_CATEGORY_LABELS[payload.category],
            description=payload.description,
            reported_at=payload.reported_at,
        )
        session.add(incident)
        session.flush()
        return IncidentReportOut(**incident.as_own_dict())


@router.get("/stats", response_model=IncidentStatsOut)
def get_incident_stats(principal: CurrentPrincipal) -> IncidentStatsOut:
    """Return summary statistics of danger reports in Kraków.

    `hotspots` is derived from the grid, not a hand-written list of street names:
    the previous version returned five fixed Kraków locations regardless of what
    had actually been reported, which read as data but was fiction.
    """
    with session_scope() as session:
        total = session.execute(select(func.count(IncidentReport.id))).scalar_one()

        cat_counts = session.execute(
            select(IncidentReport.category, func.count(IncidentReport.id)).group_by(
                IncidentReport.category
            )
        ).all()
        by_category = dict(cat_counts)

        rows = session.execute(select(IncidentReport.lat, IncidentReport.lng)).all()

    cells: dict[tuple[float, float], int] = {}
    for lat, lng in rows:
        key = snap(lat, lng)
        cells[key] = cells.get(key, 0) + 1

    hotspots = [
        {
            "lat": cell_lat,
            "lng": cell_lng,
            "count": count,
        }
        for (cell_lat, cell_lng), count in sorted(cells.items(), key=lambda i: i[1], reverse=True)[
            :10
        ]
    ]

    return IncidentStatsOut(
        total=total,
        city="Kraków",
        byCategory=by_category,
        hotspots=hotspots,
    )
