import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import sys

# Import the inference script
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.append(base_dir)

from scripts.predict_ice import predict_ice_prospectivity

app = FastAPI(title="LAEP Moon Trek API")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CoordinateRequest(BaseModel):
    latitude: float
    longitude: float

@app.post("/api/predict")
async def get_prediction(req: CoordinateRequest):
    result = predict_ice_prospectivity(req.latitude, req.longitude)
    if not result:
        return {"error": "Failed to generate prediction. Check backend logs."}
    return result

# Serve the frontend
static_dir = os.path.join(base_dir, "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
