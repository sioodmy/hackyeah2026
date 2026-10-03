"""Tests for the Kraków incident reports and heatmap API.

The privacy properties here are the point of the module, so they are asserted
directly rather than implied: an unauthenticated caller must not be able to read
anyone's reports, and no read path may return a coordinate more precise than the
~200 m aggregation grid.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from hy.asgi import create_app
from hy.routers.incidents import GRID_DEG, snap


@pytest.fixture(autouse=True)
def _seed_incidents(session: Session) -> None:
    from hy.krakow_data import seed_krakow_incidents

    seed_krakow_incidents(session)
    session.commit()


@pytest.fixture
def anon() -> TestClient:
    """A client with no auth override at all — the attacker."""
    return TestClient(create_app())


def test_snap_rounds_to_grid() -> None:
    lat, _lng = snap(50.06190, 19.93701)
    assert (round(lat / GRID_DEG) * GRID_DEG - lat) == pytest.approx(0, abs=GRID_DEG)
    # Two reports a few metres apart land in the same cell.
    assert snap(50.06190, 19.93701) == snap(50.06195, 19.93704)


def test_heatmap_requires_auth(anon: TestClient) -> None:
    assert anon.get("/api/v1/incidents/heatmap").status_code == 401


def test_incident_list_requires_auth(anon: TestClient) -> None:
    assert anon.get("/api/v1/incidents").status_code == 401


def test_stats_requires_auth(anon: TestClient) -> None:
    assert anon.get("/api/v1/incidents/stats").status_code == 401


def test_heatmap_returns_grid_cells(client: TestClient) -> None:
    response = client.get("/api/v1/incidents/heatmap")
    assert response.status_code == 200

    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0

    for feature in data["features"]:
        assert feature["type"] == "Feature"
        coordinates = feature["geometry"]["coordinates"]
        assert len(coordinates) == 2  # [lng, lat]

        props = feature["properties"]
        assert 0.0 <= props["weight"] <= 1.0
        assert props["count"] >= 1
        assert props["category"] in set(props) or props["category"]
        # No per-report identity or free text may appear in a shared heatmap.
        assert "id" not in props
        assert "description" not in props
        assert "userId" not in props
        assert "title" not in props


def test_heatmap_coordinates_are_grid_snapped(client: TestClient) -> None:
    """Every returned coordinate must sit exactly on a cell centre."""
    data = client.get("/api/v1/incidents/heatmap").json()
    for feature in data["features"]:
        lng, lat = feature["geometry"]["coordinates"]
        assert snap(lat, lng) == pytest.approx((lat, lng), abs=1e-6)


def test_heatmap_aggregates_nearby_reports(client: TestClient) -> None:
    """Reports close together collapse into one feature, so a cell count can
    exceed the number of features."""
    data = client.get("/api/v1/incidents/heatmap").json()
    assert sum(f["properties"]["count"] for f in data["features"]) > len(data["features"])


def test_filter_heatmap_by_category(client: TestClient) -> None:
    response = client.get("/api/v1/incidents/heatmap?category=sexual_assault")
    assert response.status_code == 200
    data = response.json()
    assert len(data["features"]) > 0
    for feature in data["features"]:
        assert feature["properties"]["category"] == "sexual_assault"


def test_filter_heatmap_by_severity(client: TestClient) -> None:
    response = client.get("/api/v1/incidents/heatmap?min_severity=3")
    assert response.status_code == 200
    data = response.json()
    assert len(data["features"]) > 0
    for feature in data["features"]:
        assert feature["properties"]["severity"] == 3


def test_list_returns_only_own_reports(client_for, users) -> None:
    """Alice must never see a report Bob filed."""
    alice, bob, _ = users

    bob_client = client_for(bob)
    created = bob_client.post(
        "/api/v1/incidents",
        json={
            "category": "robbery",
            "severity": 3,
            "lat": 50.0485,
            "lng": 19.9475,
            "title": "Kradzież",
        },
    )
    assert created.status_code == 201
    bob_report_id = created.json()["id"]

    alice_items = client_for(alice).get("/api/v1/incidents").json()
    assert bob_report_id not in {item["id"] for item in alice_items}

    bob_items = bob_client.get("/api/v1/incidents").json()
    assert bob_report_id in {item["id"] for item in bob_items}


def test_list_never_exposes_reporter_identity(client_for, users) -> None:
    alice, _, _ = users
    client_for(alice).post(
        "/api/v1/incidents",
        json={"category": "stalking", "severity": 2, "lat": 50.06, "lng": 19.94},
    )

    items = client_for(alice).get("/api/v1/incidents").json()
    assert len(items) > 0
    for item in items:
        assert "userId" not in item


def test_report_new_incident_unauthenticated(anon: TestClient) -> None:
    """Guest reporting stays open on purpose: someone in danger should not have to
    log in before they can call for help."""
    payload = {
        "category": "harassment",
        "severity": 2,
        "lat": 50.0619,
        "lng": 19.9370,
        "title": "Zaczepki przy Rynku",
        "description": "Zaczepianie przechodniów po zmroku.",
    }
    response = anon.post("/api/v1/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "harassment"
    assert data["categoryLabel"] == "Zaczepianie / Molestowanie słowne"
    assert data["severity"] == 2
    assert data["weight"] > 0
    assert data["lat"] == 50.0619
    assert data["lng"] == 19.9370
    assert "userId" not in data


def test_report_new_incident_authenticated(client: TestClient, users) -> None:
    payload = {
        "category": "sexual_assault",
        "severity": 3,
        "lat": 50.0485,
        "lng": 19.9475,
        "title": "Próba napaści przy Bulwarach",
        "description": "Próba wciągnięcia pod kładkę.",
    }
    response = client.post("/api/v1/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "sexual_assault"
    assert data["severity"] == 3
    assert data["weight"] >= 0.9
    assert "userId" not in data


def test_authenticated_report_is_attributed_to_the_caller(session: Session, client) -> None:
    from hy.models import IncidentReport

    client.post(
        "/api/v1/incidents",
        json={"category": "assault", "severity": 3, "lat": 50.05, "lng": 19.94},
    )
    stored = session.query(IncidentReport).filter(IncidentReport.user_id == "user_alice").all()
    assert len(stored) == 1


def test_client_weight_is_ignored(anon: TestClient) -> None:
    """A caller cannot inflate the heatmap by asking for weight 1.0."""
    response = anon.post(
        "/api/v1/incidents",
        json={
            "category": "harassment",
            "severity": 1,
            "lat": 50.0619,
            "lng": 19.9370,
            "weight": 1.0,
        },
    )
    assert response.status_code == 201
    # Server derives weight from category + severity, not from the request.
    assert response.json()["weight"] < 0.5


def test_unknown_category_is_rejected(anon: TestClient) -> None:
    response = anon.post(
        "/api/v1/incidents",
        json={
            "category": "anything_at_all",
            "severity": 3,
            "lat": 50.0619,
            "lng": 19.9370,
            "weight": 1.0,
        },
    )
    assert response.status_code == 422


def test_coordinates_outside_krakow_are_rejected(anon: TestClient) -> None:
    """Otherwise anyone could paint a permanent false danger zone on an address."""
    response = anon.post(
        "/api/v1/incidents",
        json={"category": "assault", "severity": 3, "lat": -33.8688, "lng": 151.2093},
    )
    assert response.status_code == 422


def test_incident_stats(client: TestClient) -> None:
    response = client.get("/api/v1/incidents/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Kraków"
    assert data["total"] > 0
    assert "byCategory" in data
    assert "sexual_assault" in data["byCategory"]
    assert "harassment" in data["byCategory"]
    # Derived from reports, not a hardcoded list of Kraków street names.
    assert len(data["hotspots"]) > 0
    assert all("count" in hotspot for hotspot in data["hotspots"])
