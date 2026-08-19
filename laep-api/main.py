"""
LAEP FastAPI Backend — Main entrypoint.
Bulletproof production build with global exception handling, health checks, and full CORS.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from routers import dem, ice_detection, pathfinding, craters

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("laep-api")

app = FastAPI(
    title="LAEP API — Lunar Autonomous Exploration Pipeline",
    description="Backend for the LAEP web dashboard. Provides ice detection, terrain analysis, and rover pathfinding for the Lunar South Pole.",
    version="2.0.0",
)

# ── CORS Middleware ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Global Exception Handler ───────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}", "status": "error"}
    )

# ── Register Routers ───────────────────────────────────────────────────────
app.include_router(dem.router,           prefix="/api", tags=["Terrain"])
app.include_router(ice_detection.router, prefix="/api", tags=["Ice Detection"])
app.include_router(pathfinding.router,   prefix="/api", tags=["Pathfinding"])
app.include_router(craters.router,       prefix="/api", tags=["Craters & Volumetrics"])

# ── Health & Root ──────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
@app.head("/", tags=["Health"])
def root():
    return {
        "service": "LAEP API",
        "version": "2.0.0",
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
            "GET  /api/craters/benchmarks",
            "GET  /api/craters/subcraters",
            "POST /api/craters/custom_region_ice",
            "GET  /health",
        ],
    }

@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "laep-api", "version": "2.0.0"}
