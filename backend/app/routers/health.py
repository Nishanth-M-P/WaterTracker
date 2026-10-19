from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "WaterTrack Backend API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "offline_first_notice": "WaterTrack operates 100% offline. This API is an optional companion service for backups and central reporting.",
    }
