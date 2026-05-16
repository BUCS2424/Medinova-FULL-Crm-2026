"""
Waystar API routes for healthcare revenue cycle management.
Handles configuration, eligibility verification, claims status, and prior authorization.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import httpx
import logging
import base64

logger = logging.getLogger(__name__)

waystar_router = APIRouter(prefix="/waystar", tags=["waystar"])

_db = None

def set_database(db):
    global _db
    _db = db


class WaystarConfigUpdate(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    organization_id: Optional[str] = None
    environment: Optional[str] = "sandbox"  # sandbox or production


# ==================== CONFIG ====================

@waystar_router.get("/config")
async def get_waystar_config():
    """Get Waystar API configuration"""
    config = await _db.site_settings.find_one({"type": "waystar_config"}, {"_id": 0})
    if not config:
        return {
            "configured": False,
            "client_id": "",
            "client_secret": "",
            "organization_id": "",
            "environment": "sandbox"
        }
    return {
        "configured": bool(config.get("client_id") and config.get("client_secret")),
        "client_id": config.get("client_id", ""),
        "client_secret": ("*" * 16 + config["client_secret"][-6:]) if config.get("client_secret") else "",
        "organization_id": config.get("organization_id", ""),
        "environment": config.get("environment", "sandbox"),
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by"),
    }


@waystar_router.put("/config")
async def update_waystar_config(data: WaystarConfigUpdate):
    """Save Waystar API configuration"""
    existing = await _db.site_settings.find_one({"type": "waystar_config"}, {"_id": 0})
    
    update = {
        "type": "waystar_config",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": "admin",
    }
    
    if data.client_id is not None:
        update["client_id"] = data.client_id
    elif existing:
        update["client_id"] = existing.get("client_id", "")
    
    if data.client_secret is not None and not data.client_secret.startswith("*"):
        update["client_secret"] = data.client_secret
    elif existing:
        update["client_secret"] = existing.get("client_secret", "")
    
    if data.organization_id is not None:
        update["organization_id"] = data.organization_id
    elif existing:
        update["organization_id"] = existing.get("organization_id", "")
    
    if data.environment is not None:
        update["environment"] = data.environment
    elif existing:
        update["environment"] = existing.get("environment", "sandbox")
    
    await _db.site_settings.update_one(
        {"type": "waystar_config"},
        {"$set": update},
        upsert=True
    )
    return {"message": "Waystar configuration saved"}


# ==================== CONNECTION TEST ====================

@waystar_router.get("/status")
async def get_waystar_status():
    """Test Waystar API connection"""
    config = await _db.site_settings.find_one({"type": "waystar_config"}, {"_id": 0})
    if not config or not config.get("client_id") or not config.get("client_secret"):
        return {"configured": False, "connected": False, "message": "Not configured"}
    
    env = config.get("environment", "sandbox")
    base_url = "https://api.waystar.com" if env == "production" else "https://sandbox.waystar.com"
    
    try:
        auth = base64.b64encode(f"{config['client_id']}:{config['client_secret']}".encode()).decode()
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{base_url}/oauth/token",
                headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
                data={"grant_type": "client_credentials"}
            )
            if response.status_code == 200:
                return {"configured": True, "connected": True, "environment": env, "message": "Connected"}
            else:
                return {"configured": True, "connected": False, "environment": env, "message": f"Auth failed: HTTP {response.status_code}"}
    except Exception as e:
        return {"configured": True, "connected": False, "environment": env, "message": str(e)}


# ==================== ELIGIBILITY (270/271) ====================

@waystar_router.post("/eligibility/check")
async def check_eligibility(data: dict):
    """Check patient eligibility via Waystar 270/271 transaction"""
    config = await _db.site_settings.find_one({"type": "waystar_config"}, {"_id": 0})
    if not config or not config.get("client_id"):
        raise HTTPException(status_code=400, detail="Waystar not configured")
    
    required = ["payer_id", "member_id", "first_name", "last_name", "date_of_birth"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    env = config.get("environment", "sandbox")
    base_url = "https://api.waystar.com" if env == "production" else "https://sandbox.waystar.com"
    
    try:
        token = await _get_waystar_token(config)
        if not token:
            raise HTTPException(status_code=401, detail="Failed to authenticate with Waystar")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/eligibility/v1/inquiries",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "payerId": data["payer_id"],
                    "subscriber": {
                        "memberId": data["member_id"],
                        "firstName": data["first_name"],
                        "lastName": data["last_name"],
                        "dateOfBirth": data["date_of_birth"],
                    },
                    "providerNpi": data.get("provider_npi", config.get("organization_id", "")),
                    "serviceType": data.get("service_type", "DME"),
                }
            )
            
            # Log the check
            await _db.waystar_logs.insert_one({
                "type": "eligibility",
                "request": {k: v for k, v in data.items() if k != "client_secret"},
                "status_code": response.status_code,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": True, "status_code": response.status_code, "message": response.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Waystar eligibility check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CLAIMS STATUS (276/277) ====================

@waystar_router.post("/claims/status")
async def check_claim_status(data: dict):
    """Check claim status via Waystar 276/277 transaction"""
    config = await _db.site_settings.find_one({"type": "waystar_config"}, {"_id": 0})
    if not config or not config.get("client_id"):
        raise HTTPException(status_code=400, detail="Waystar not configured")
    
    if not data.get("claim_id") and not data.get("patient_account_number"):
        raise HTTPException(status_code=400, detail="claim_id or patient_account_number required")
    
    env = config.get("environment", "sandbox")
    base_url = "https://api.waystar.com" if env == "production" else "https://sandbox.waystar.com"
    
    try:
        token = await _get_waystar_token(config)
        if not token:
            raise HTTPException(status_code=401, detail="Failed to authenticate with Waystar")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/claims/v1/status",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "claimId": data.get("claim_id"),
                    "patientAccountNumber": data.get("patient_account_number"),
                    "payerId": data.get("payer_id"),
                }
            )
            
            await _db.waystar_logs.insert_one({
                "type": "claim_status",
                "request": data,
                "status_code": response.status_code,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": True, "status_code": response.status_code, "message": response.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Waystar claims status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ACTIVITY LOGS ====================

@waystar_router.get("/logs")
async def get_waystar_logs(limit: int = 50):
    """Get recent Waystar API activity logs"""
    logs = await _db.waystar_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(min(limit, 200)).to_list(min(limit, 200))
    return logs


# ==================== HELPERS ====================

async def _get_waystar_token(config: dict) -> str:
    """Get OAuth2 token from Waystar"""
    env = config.get("environment", "sandbox")
    base_url = "https://api.waystar.com" if env == "production" else "https://sandbox.waystar.com"
    
    try:
        auth = base64.b64encode(f"{config['client_id']}:{config['client_secret']}".encode()).decode()
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{base_url}/oauth/token",
                headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
                data={"grant_type": "client_credentials"}
            )
            if response.status_code == 200:
                return response.json().get("access_token")
    except Exception as e:
        logger.error(f"Waystar token error: {e}")
    return None
