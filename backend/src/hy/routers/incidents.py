"""Endpoints for Krakow safety incident reporting, danger heatmap, and statistics."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import desc, func, select

from hy.auth import OptionalPrincipal
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


@router.get("/heatmap", response_model=HeatmapGeoJSON)
def get_krakow_heatmap(
    category: Annotated[str | None, Query(description="Filter by category")] = None,
    min_severity: Annotated[int | None, Query(ge=1, le=3, description="Minimum severity")] = None,
) -> HeatmapGeoJSON:
    """Return GeoJSON FeatureCollection formatted for MapLibre Heatmap layer.

    Features include calculated weight and severity for yellow-to-red density rendering.
    """
    with session_scope() as session:
        query = select(IncidentReport).order_by(desc(IncidentReport.created_at))
        if category:
            query = query.where(IncidentReport.category == category)
        if min_severity:
            query = query.where(IncidentReport.severity >= min_severity)

        incidents = session.execute(query).scalars().all()
        features = [inc.as_geojson_feature() for inc in incidents]

        return HeatmapGeoJSON(
            type="FeatureCollection",
            features=features,
        )


@router.get("", response_model=list[IncidentReportOut])
def list_incidents(
    category: Annotated[str | None, Query(description="Filter by category")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[IncidentReportOut]:
    """List recent incident reports in Kraków."""
    with session_scope() as session:
        query = (
            select(IncidentReport)
            .order_by(desc(IncidentReport.created_at))
            .offset(offset)
            .limit(limit)
        )
        if category:
            query = query.where(IncidentReport.category == category)

        incidents = session.execute(query).scalars().all()
        return [IncidentReportOut(**inc.as_public_dict()) for inc in incidents]


@router.post("", response_model=IncidentReportOut, status_code=status.HTTP_201_CREATED)
def report_incident(
    payload: IncidentReportCreate,
    caller: OptionalPrincipal,
) -> IncidentReportOut:
    """Report a harassment, assault, rape, or other dangerous situation in Kraków.

    Can be reported by authenticated users or anonymous/guest users in danger.
    Calculates threat weight automatically based on category and severity.
    """
    with session_scope() as session:
        # Determine weight if not specified
        weight = payload.weight
        if weight is None:
            base_weight = INCIDENT_DEFAULT_WEIGHTS.get(payload.category, 0.5)
            # Scale by severity (1=0.7x, 2=1.0x, 3=1.3x)
            severity_factor = {1: 0.7, 2: 1.0, 3: 1.3}.get(payload.severity, 1.0)
            weight = round(min(1.0, max(0.1, base_weight * severity_factor)), 2)

        # Polish display label
        label = payload.category_label or INCIDENT_CATEGORY_LABELS.get(
            payload.category, payload.category.replace("_", " ").capitalize()
        )

        incident = IncidentReport(
            user_id=caller.user_id if caller else None,
            category=payload.category,
            severity=payload.severity,
            weight=weight,
            lat=payload.lat,
            lng=payload.lng,
            title=payload.title or label,
            description=payload.description,
            reported_at=payload.reported_at,
        )
        session.add(incident)
        session.flush()

        result = IncidentReportOut(**incident.as_public_dict())
        return result


@router.get("/stats", response_model=IncidentStatsOut)
def get_incident_stats() -> IncidentStatsOut:
    """Return summary statistics of danger reports in Kraków."""
    with session_scope() as session:
        total = session.execute(select(func.count(IncidentReport.id))).scalar_one()

        cat_counts = session.execute(
            select(IncidentReport.category, func.count(IncidentReport.id)).group_by(
                IncidentReport.category
            )
        ).all()
        by_category = dict(cat_counts)

        high_risk_zones = [
            "Stare Miasto / Szewska / Floriańska / Planty",
            "Bulwary Wiślane / Kładka Ojca Bernatka",
            "Dworzec Główny / Tunel Magazynowa",
            "Kazimierz (Plac Nowy / ul. Szeroka)",
            "Rondo Mogilskie (dolna płyta)",
        ]

        return IncidentStatsOut(
            total=total,
            city="Kraków",
            by_category=by_category,
            high_risk_zones=high_risk_zones,
        )
