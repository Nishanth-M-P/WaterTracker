import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "WaterTrack" in data["service"]


def test_reports_summary_endpoint():
    payload = {
        "start_date": "2026-10-01",
        "end_date": "2026-10-31",
        "deliveries": [
            {
                "id": 1,
                "customer_id": 1,
                "customer_name": "Lake View Resort",
                "customer_type": "Hotel",
                "delivery_date": "2026-10-10",
                "delivered_at": "2026-10-10T10:00:00",
                "delivery_location": "Lakeside Road 5",
                "created_at": "2026-10-10T10:00:00",
                "updated_at": "2026-10-10T10:00:00",
                "items": [
                    {
                        "id": 1,
                        "delivery_id": 1,
                        "bottle_size_id": 1,
                        "bottle_size_name_snapshot": "20L Jar",
                        "quantity": 10,
                        "unit_price_snapshot": 80.0,
                        "created_at": "2026-10-10T10:00:00",
                    },
                    {
                        "id": 2,
                        "delivery_id": 1,
                        "bottle_size_id": 2,
                        "bottle_size_name_snapshot": "1L Bottle",
                        "quantity": 25,
                        "unit_price_snapshot": 20.0,
                        "created_at": "2026-10-10T10:00:00",
                    },
                ],
            }
        ],
    }
    res = client.post("/reports/summary", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_bottles"] == 35
    assert data["total_deliveries"] == 1
    assert data["unique_customers"] == 1
    assert data["avg_bottles_per_delivery"] == 35.0
    assert len(data["bottle_size_breakdown"]) == 2


def test_invalid_date_range():
    payload = {
        "start_date": "2026-10-30",
        "end_date": "2026-10-01",
        "deliveries": [],
    }
    res = client.post("/reports/summary", json=payload)
    assert res.status_code == 400
