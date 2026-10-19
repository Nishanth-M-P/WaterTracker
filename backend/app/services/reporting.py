from collections import defaultdict
from typing import List, Dict, Any
from backend.app.schemas import (
    Delivery,
    SummaryReport,
    BottleSizeSummary,
    CustomerSummary,
    DailyDistribution,
)


def calculate_summary_report(
    deliveries: List[Delivery],
    start_date: str,
    end_date: str,
) -> SummaryReport:
    """
    Computes summary metrics for deliveries falling inclusively between start_date and end_date.
    Follows WaterTrack PRD rules:
    - Inclusively between start_date and end_date.
    - Total bottles = sum of line items.
    - Total deliveries = count of delivery records.
    - Unique customers = count of distinct customer IDs.
    - Average bottles per delivery = total_bottles / total_deliveries (0.0 if empty).
    - Daily breakdown sum strictly equals total_bottles.
    """
    filtered_deliveries = [
        d for d in deliveries
        if start_date <= d.delivery_date <= end_date
    ]

    total_deliveries = len(filtered_deliveries)
    unique_customer_ids = set()
    total_bottles = 0
    bottle_size_map: Dict[int, Dict[str, Any]] = {}
    customer_map: Dict[int, Dict[str, Any]] = {}
    daily_map: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total_bottles": 0, "delivery_count": 0})

    for delivery in filtered_deliveries:
        unique_customer_ids.add(delivery.customer_id)
        delivery_total = sum(item.quantity for item in delivery.items)
        total_bottles += delivery_total

        # Daily aggregation
        d_day = delivery.delivery_date
        daily_map[d_day]["total_bottles"] += delivery_total
        daily_map[d_day]["delivery_count"] += 1

        # Customer aggregation
        cid = delivery.customer_id
        if cid not in customer_map:
            customer_map[cid] = {
                "customer_id": cid,
                "customer_name": delivery.customer_name or f"Customer #{cid}",
                "customer_type": delivery.customer_type or "Other",
                "total_deliveries": 0,
                "total_bottles": 0,
            }
        customer_map[cid]["total_deliveries"] += 1
        customer_map[cid]["total_bottles"] += delivery_total

        # Bottle size aggregation
        for item in delivery.items:
            bid = item.bottle_size_id
            if bid not in bottle_size_map:
                bottle_size_map[bid] = {
                    "bottle_size_id": bid,
                    "bottle_size_name": item.bottle_size_name_snapshot,
                    "total_quantity": 0,
                    "total_amount": 0.0,
                }
            bottle_size_map[bid]["total_quantity"] += item.quantity
            if item.unit_price_snapshot:
                bottle_size_map[bid]["total_amount"] += (item.unit_price_snapshot * item.quantity)

    avg_bottles = (
        round(total_bottles / total_deliveries, 2)
        if total_deliveries > 0
        else 0.0
    )

    # Sort daily breakdown by date ascending
    daily_list = [
        DailyDistribution(
            date=d_str,
            total_bottles=metrics["total_bottles"],
            delivery_count=metrics["delivery_count"],
        )
        for d_str, metrics in sorted(daily_map.items(), key=lambda x: x[0])
    ]

    # Sort customer breakdown by total_bottles descending
    customer_list = [
        CustomerSummary(
            customer_id=c["customer_id"],
            customer_name=c["customer_name"],
            customer_type=c["customer_type"],
            total_deliveries=c["total_deliveries"],
            total_bottles=c["total_bottles"],
        )
        for c in sorted(customer_map.values(), key=lambda x: x["total_bottles"], reverse=True)
    ]

    # Bottle size breakdown sorted descending by quantity
    bottle_list = [
        BottleSizeSummary(
            bottle_size_id=b["bottle_size_id"],
            bottle_size_name=b["bottle_size_name"],
            total_quantity=b["total_quantity"],
            total_amount=round(b["total_amount"], 2),
        )
        for b in sorted(bottle_size_map.values(), key=lambda x: x["total_quantity"], reverse=True)
    ]

    return SummaryReport(
        start_date=start_date,
        end_date=end_date,
        total_bottles=total_bottles,
        total_deliveries=total_deliveries,
        unique_customers=len(unique_customer_ids),
        avg_bottles_per_delivery=avg_bottles,
        bottle_size_breakdown=bottle_list,
        daily_breakdown=daily_list,
        customer_breakdown=customer_list,
    )
