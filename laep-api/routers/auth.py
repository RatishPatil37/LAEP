"""
auth.py — Planetary Exploration Role-Based Authentication & Clearance System
Provides zero-dependency HMAC-signed JWT generation and verification for:
1. Public Explorer (Tier 1, default, read-only)
2. Principal Investigator / Scientist (Tier 2, unlocked via clearance key)
"""
import time
import json
import hmac
import hashlib
import base64
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Clearance & Authentication"])

SECRET_KEY = b"ISRO_CH2_LAEP_SECRET_KEY_2026"
VALID_CLEARANCE_KEYS = {
    "CH2-PI-CLEARANCE-2026": "Principal Investigator / Scientist Level",
    "ISRO-SAC-2026":         "ISRO Space Applications Centre Fellow",
    "PRL-PLANETARY-PI":      "Physical Research Laboratory Investigator",
    "DEMO-SCIENTIST":        "Demo Research Evaluation Token",
}

class ClearanceVerifyRequest(BaseModel):
    key: str

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ''
    return base64.urlsafe_b64decode(data + padding)

def create_clearance_token(role: str = "scientist", subject: str = "PI_USER") -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "role": role,
        "iss": "ISRO-CH2-LAEP",
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,  # 24 hours validity
    }
    header_b64 = _base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(payload).encode('utf-8'))
    message = f"{header_b64}.{payload_b64}".encode('utf-8')
    sig = hmac.new(SECRET_KEY, message, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def verify_clearance_token(token: str) -> Optional[dict]:
    try:
        parts = token.strip().split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY, message, hashlib.sha256).digest()
        actual_sig = _base64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_base64url_decode(payload_b64).decode('utf-8'))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

@router.post("/verify")
def verify_clearance_key(req: ClearanceVerifyRequest):
    """
    Validates a submitted mission clearance key and returns an HMAC JWT token.
    """
    key_clean = req.key.strip().upper()
    if key_clean not in VALID_CLEARANCE_KEYS:
        raise HTTPException(
            status_code=401,
            detail="Invalid clearance key. Try demo key: CH2-PI-CLEARANCE-2026"
        )
    
    title = VALID_CLEARANCE_KEYS[key_clean]
    token = create_clearance_token(role="scientist", subject=key_clean)
    
    return {
        "status": "authenticated",
        "role": "scientist",
        "clearance_title": title,
        "token": token,
        "expires_in_seconds": 86400,
        "message": f"Clearance Granted: {title}"
    }

@router.get("/me")
def get_current_clearance(authorization: Optional[str] = Header(None)):
    """
    Decodes bearer token and returns active clearance tier.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return {
            "status": "guest",
            "role": "explorer",
            "clearance_title": "Public Mission Explorer",
            "capabilities": ["read_maps", "benchmark_craters", "standard_routes", "ask_gemini"]
        }
    
    token = authorization.split(" ", 1)[1]
    payload = verify_clearance_token(token)
    if not payload:
        return {
            "status": "expired",
            "role": "explorer",
            "clearance_title": "Public Mission Explorer",
            "message": "Token expired or invalid. Re-authenticate with clearance key."
        }
    
    return {
        "status": "authenticated",
        "role": payload.get("role", "scientist"),
        "clearance_title": "Principal Investigator / Scientist",
        "capabilities": [
            "read_maps",
            "benchmark_craters",
            "standard_routes",
            "ask_gemini",
            "custom_coordinate_injection",
            "simpson_2d_volumetrics",
            "kinematic_overrides",
            "raw_telemetry_csv_export"
        ]
    }
