from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routers import health, reports, backup

app = FastAPI(
    title="WaterTrack Backend API",
    description="Companion REST API and reporting engine for WaterTrack Offline Water Distribution App",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(reports.router)
app.include_router(backup.router)


@app.get("/")
def root():
    return {
        "message": "WaterTrack Backend API is active.",
        "docs": "/docs",
        "health": "/health",
    }
