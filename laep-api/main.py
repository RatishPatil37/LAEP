"""
LAEP FastAPI Backend — Main entrypoint.
Run with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import dem, ice_detection, pathfinding

app = FastAPI(
    title="LAEP API — Lunar Autonomous Exploration Pipeline",
    description="Backend for the LAEP web dashboard. Provides ice detection, terrain analysis, and rover pathfinding for the Lunar South Pole.",
    version="1.0.0",
)

# CORS — allow the Vite dev server and Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Lock to specific domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api prefix
app.include_router(dem.router,           prefix="/api", tags=["Terrain"])
app.include_router(ice_detection.router, prefix="/api", tags=["Ice Detection"])
app.include_router(pathfinding.router,   prefix="/api", tags=["Pathfinding"])


@app.get("/")
def root():
    return {
        "service": "LAEP API",
        "status": "operational",
        "docs": "/docs",
        "endpoints": [
            "GET  /api/dem",
            "GET  /api/hazard-map",
            "GET  /api/ice-detection",
            "GET  /api/ice-stats",
            "GET  /api/ch2-footprints",
            "POST /api/pathfind",
            "GET  /api/landing-sites",
        ],
    }
