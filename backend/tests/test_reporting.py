import pytest
from backend.app.schemas import Delivery, DeliveryItem
from backend.app.services.reporting import calculate_summary_report


def test_empty_deliveries_report():
    report = calculate_summary_report([], "2026-10-01", "2026-10-31")
    assert report.total_bottles == 0
    assert report.total_deliveries == 0
    assert report.unique_customers == 0
    assert report.avg_bottles_per_delivery == 0.0
    assert len(report.bottle_size_breakdown) == 0
    assert len(report.daily_breakdown) == 0
    assert len(report.customer_breakdown) == 0


def test_reporting_rules_and_aggregations():
    # Setup test deliveries
    d1 = Delivery(
        id=1,
        customer_id=101,
        customer_name="Grand Palace Hotel",
        customer_type="Hotel",
        delivery_date="2026-10-15",
        delivered_at="2026-10-15T09:30:00",
        delivery_location="MG Road 12",
        created_at="2026-10-15T09:30:00",
        updated_at="2026-10-15T09:30:00",
        items=[
            DeliveryItem(
                id=1,
                delivery_id=1,
                bottle_size_id=1,
                bottle_size_name_snapshot="20L Jar",
                quantity=10,
                unit_price_snapshot=80.0,
                created_at="2026-10-15T09:30:00",
            ),
            DeliveryItem(
                id=2,
                delivery_id=1,
                bottle_size_id=2,
                bottle_size_name_snapshot="1L Bottle",
                quantity=20,
                unit_price_snapshot=20.0,
                created_at="2026-10-15T09:30:00",
            ),
        ],
    )

    d2 = Delivery(
        id=2,
        customer_id=102,
        customer_name="Sunrise Cafe",
        customer_type="Shop",
        delivery_date="2026-10-15",
        delivered_at="2026-10-15T11:00:00",
        delivery_location="Market Complex 4",
        created_at="2026-10-15T11:00:00",
        updated_at="2026-10-15T11:00:00",
        items=[
            DeliveryItem(
                id=3,
                delivery_id=2,
                bottle_size_id=1,
                bottle_size_name_snapshot="20L Jar",
                quantity=5,
                unit_price_snapshot=80.0,
                created_at="2026-10-15T11:00:00",
            ),
        ],
    )

    d3 = Delivery(
        id=3,
        customer_id=101,
        customer_name="Grand Palace Hotel",
        customer_type="Hotel",
        delivery_date="2026-10-16",
        delivered_at="2026-10-16T10:00:00",
        delivery_location="MG Road 12",
        created_at="2026-10-16T10:00:00",
        updated_at="2026-10-16T10:00:00",
        items=[
            DeliveryItem(
                id=4,
                delivery_id=3,
                bottle_size_id=3,
                bottle_size_name_snapshot="500ml Bottle",
                quantity=40,
                unit_price_snapshot=10.0,
                created_at="2026-10-16T10:00:00",
            ),
        ],
    )

    # Delivery outside the date range:
    d4 = Delivery(
        id=4,
        customer_id=103,
        customer_name="Out of Range Office",
        customer_type="Office",
        delivery_date="2026-10-25",
        delivered_at="2026-10-25T14:00:00",
        delivery_location="Tech Park 7",
        created_at="2026-10-25T14:00:00",
        updated_at="2026-10-25T14:00:00",
        items=[
            DeliveryItem(
                id=5,
                delivery_id=4,
                bottle_size_id=1,
                bottle_size_name_snapshot="20L Jar",
                quantity=15,
                unit_price_snapshot=80.0,
                created_at="2026-10-25T14:00:00",
            ),
        ],
    )

    all_deliveries = [d1, d2, d3, d4]

    report = calculate_summary_report(all_deliveries, "2026-10-15", "2026-10-16")

    # In range: d1 (30 bottles), d2 (5 bottles), d3 (40 bottles) => Total 75 bottles
    assert report.total_bottles == 75
    # Total deliveries in range: 3
    assert report.total_deliveries == 3
    # Distinct customer IDs: 101, 102 => 2
    assert report.unique_customers == 2
    # Avg bottles: 75 / 3 = 25.0
    assert report.avg_bottles_per_delivery == 25.0

    # Test daily breakdown sum == total_bottles
    daily_sum = sum(day.total_bottles for day in report.daily_breakdown)
    assert daily_sum == report.total_bottles

    # Test bottle size breakdown sum == total_bottles
    bottle_sum = sum(b.total_quantity for b in report.bottle_size_breakdown)
    assert bottle_sum == report.total_bottles

    # Check top customer: 101 has 30 + 40 = 70 bottles
    assert report.customer_breakdown[0].customer_id == 101
    assert report.customer_breakdown[0].total_bottles == 70
    assert report.customer_breakdown[0].total_deliveries == 2
