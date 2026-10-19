from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.app.schemas import (
    Delivery,
    SummaryReport,
    CustomerSummary,
    BottleSizeSummary,
)
from backend.app.services.reporting import calculate_summary_report

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    deliveries: List[Delivery]


@router.post("/summary", response_model=SummaryReport)
def generate_summary_report(req: ReportRequest):
    if req.end_date < req.start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date cannot be earlier than start_date"
        )
    return calculate_summary_report(
        deliveries=req.deliveries,
        start_date=req.start_date,
        end_date=req.end_date,
    )


@router.post("/customer", response_model=List[CustomerSummary])
def generate_customer_report(req: ReportRequest):
    if req.end_date < req.start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date cannot be earlier than start_date"
        )
    summary = calculate_summary_report(
        deliveries=req.deliveries,
        start_date=req.start_date,
        end_date=req.end_date,
    )
    return summary.customer_breakdown


@router.post("/bottle-sizes", response_model=List[BottleSizeSummary])
def generate_bottle_sizes_report(req: ReportRequest):
    if req.end_date < req.start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date cannot be earlier than start_date"
        )
    summary = calculate_summary_report(
        deliveries=req.deliveries,
        start_date=req.start_date,
        end_date=req.end_date,
    )
    return summary.bottle_size_breakdown
