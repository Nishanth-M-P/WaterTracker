from fastapi import APIRouter, HTTPException
from backend.app.schemas import BackupPayload

router = APIRouter(prefix="/backup", tags=["Backup & Sync"])


@router.post("/validate")
def validate_backup(payload: BackupPayload):
    """
    Validates a WaterTrack JSON backup payload against schema and consistency rules.
    """
    total_items = sum(len(d.items) for d in payload.deliveries)
    total_bottles = sum(
        sum(item.quantity for item in d.items)
        for d in payload.deliveries
    )
    return {
        "status": "valid",
        "app_name": payload.metadata.app_name,
        "schema_version": payload.metadata.schema_version,
        "customer_count": len(payload.customers),
        "bottle_size_count": len(payload.bottle_sizes),
        "delivery_count": len(payload.deliveries),
        "total_line_items": total_items,
        "total_bottles": total_bottles,
    }
