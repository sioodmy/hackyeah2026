"""Tests for the Kraków incident reports and heatmap API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from hy.asgi import create_app
from hy.auth import Principal, require_principal
from hy.krakow_data import seed_krakow_incidents


@pytest.fixture(autouse=True)
def _seed_incidents(session: Session) -> None:
    seed_krakow_incidents(session)
    session.commit()


def test_get_heatmap_seeds_krakow_data():
    client = TestClient(create_app())
    response = client.get("/api/v1/incidents/heatmap")
    assert response.status_code == 200

    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0

    feature = data["features"][0]
    assert feature["type"] == "Feature"
    assert "coordinates" in feature["geometry"]
    assert len(feature["geometry"]["coordinates"]) == 2  # [lng, lat]
    props = feature["properties"]
    assert "weight" in props
    assert "category" in props
    assert "categoryLabel" in props
    assert 0.0 <= props["weight"] <= 1.0


def test_filter_heatmap_by_category():
    client = TestClient(create_app())
    response = client.get("/api/v1/incidents/heatmap?category=sexual_assault")
    assert response.status_code == 200
    data = response.json()
    assert len(data["features"]) > 0
    for feature in data["features"]:
        assert feature["properties"]["category"] == "sexual_assault"


def test_filter_heatmap_by_severity():
    client = TestClient(create_app())
    response = client.get("/api/v1/incidents/heatmap?min_severity=3")
    assert response.status_code == 200
    data = response.json()
    assert len(data["features"]) > 0
    for feature in data["features"]:
        assert feature["properties"]["severity"] == 3


def test_list_incidents():
    client = TestClient(create_app())
    response = client.get("/api/v1/incidents")
    assert response.status_code == 200
    items = response.json()
    assert len(items) > 0
    first = items[0]
    assert "category" in first
    assert "categoryLabel" in first
    assert "lat" in first
    assert "lng" in first
    assert "weight" in first


def test_report_new_incident_unauthenticated():
    client = TestClient(create_app())
    payload = {
        "category": "harassment",
        "severity": 2,
        "lat": 50.0619,
        "lng": 19.9370,
        "title": "Zaczepki przy Rynku",
        "description": "Zaczepianie przechodniów po zmroku.",
    }
    response = client.post("/api/v1/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "harassment"
    assert data["categoryLabel"] == "Zaczepianie / Molestowanie słowne"
    assert data["severity"] == 2
    assert data["weight"] > 0
    assert data["lat"] == 50.0619
    assert data["lng"] == 19.9370
    assert data["userId"] is None

    # Check it appears in heatmap
    heatmap_res = client.get("/api/v1/incidents/heatmap")
    features = heatmap_res.json()["features"]
    assert any(f["id"] == data["id"] for f in features)


def test_report_new_incident_authenticated():
    app = create_app()

    async def _mock_principal():
        return Principal(user_id="user_reporter_123")

    app.dependency_overrides[require_principal] = _mock_principal
    client = TestClient(app)

    payload = {
        "category": "sexual_assault",
        "severity": 3,
        "lat": 50.0485,
        "lng": 19.9475,
        "title": "Próba napaści przy Bulwarach",
        "description": "Próba wciągnięcia pod kładkę.",
    }
    response = client.post(
        "/api/v1/incidents",
        json=payload,
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "sexual_assault"
    assert data["severity"] == 3
    assert data["weight"] >= 0.9


def test_incident_stats():
    client = TestClient(create_app())
    response = client.get("/api/v1/incidents/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Kraków"
    assert data["total"] > 0
    assert "byCategory" in data
    assert "sexual_assault" in data["byCategory"]
    assert "harassment" in data["byCategory"]
    assert len(data["highRiskZones"]) > 0
