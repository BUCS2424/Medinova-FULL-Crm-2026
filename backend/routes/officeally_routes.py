"""
Office Ally API routes for EDI clearinghouse integration.
Handles configuration, eligibility verification (270/271), and claims submission.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import httpx
import logging

logger = logging.getLogger(__name__)

officeally_router = APIRouter(prefix="/officeally", tags=["officeally"])

_db = None

def set_database(db):
    global _db
    _db = db


class OfficeAllyConfigUpdate(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    submitter_id: Optional[str] = None
    environment: Optional[str] = "test"  # test or production


# ==================== CONFIG ====================

@officeally_router.get("/config")
async def get_officeally_config():
    """Get Office Ally configuration"""
    config = await _db.site_settings.find_one({"type": "officeally_config"}, {"_id": 0})
    if not config:
        return {
            "configured": False, "client_id": "", "client_secret": "",
            "username": "", "password": "", "submitter_id": "", "environment": "test"
        }
    return {
        "configured": bool(config.get("client_id") and config.get("client_secret")),
        "client_id": config.get("client_id", ""),
        "client_secret": ("*" * 16 + config["client_secret"][-6:]) if config.get("client_secret") else "",
        "username": config.get("username", ""),
        "password": ("*" * 12 + config["password"][-4:]) if config.get("password") else "",
        "submitter_id": config.get("submitter_id", ""),
        "environment": config.get("environment", "test"),
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by"),
    }


@officeally_router.put("/config")
async def update_officeally_config(data: OfficeAllyConfigUpdate):
    """Save Office Ally configuration"""
    existing = await _db.site_settings.find_one({"type": "officeally_config"}, {"_id": 0})
    update = {"type": "officeally_config", "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": "admin"}

    for field in ["client_id", "username", "submitter_id", "environment"]:
        val = getattr(data, field, None)
        if val is not None:
            update[field] = val
        elif existing:
            update[field] = existing.get(field, "")

    # Don't overwrite masked secrets
    for field in ["client_secret", "password"]:
        val = getattr(data, field, None)
        if val is not None and not val.startswith("*"):
            update[field] = val
        elif existing:
            update[field] = existing.get(field, "")

    await _db.site_settings.update_one({"type": "officeally_config"}, {"$set": update}, upsert=True)
    return {"message": "Office Ally configuration saved"}


# ==================== CONNECTION TEST ====================

@officeally_router.get("/status")
async def get_officeally_status():
    """Test Office Ally API connection"""
    config = await _db.site_settings.find_one({"type": "officeally_config"}, {"_id": 0})
    if not config or not config.get("client_id") or not config.get("client_secret"):
        return {"configured": False, "connected": False, "message": "Not configured"}

    env = config.get("environment", "test")
    base_url = "https://api.officeally.com" if env == "production" else "https://apitest.officeally.com"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{base_url}/token",
                data={
                    "grant_type": "password",
                    "username": config.get("username", ""),
                    "password": config.get("password", ""),
                    "client_id": config["client_id"],
                    "client_secret": config["client_secret"],
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if response.status_code == 200:
                return {"configured": True, "connected": True, "environment": env, "message": "Connected"}
            else:
                return {"configured": True, "connected": False, "environment": env, "message": f"Auth failed: HTTP {response.status_code}"}
    except Exception as e:
        return {"configured": True, "connected": False, "environment": env, "message": str(e)}


# ==================== ELIGIBILITY (270/271) ====================

@officeally_router.post("/eligibility/check")
async def check_eligibility(data: dict):
    """Check patient eligibility via Office Ally 270/271"""
    config = await _db.site_settings.find_one({"type": "officeally_config"}, {"_id": 0})
    if not config or not config.get("client_id"):
        raise HTTPException(status_code=400, detail="Office Ally not configured")

    required = ["payer_id", "member_id", "first_name", "last_name", "date_of_birth"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    token = await _get_token(config)
    if not token:
        raise HTTPException(status_code=401, detail="Failed to authenticate with Office Ally")

    env = config.get("environment", "test")
    base_url = "https://api.officeally.com" if env == "production" else "https://apitest.officeally.com"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/eligibility/inquiry",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "payerId": data["payer_id"],
                    "subscriberId": data["member_id"],
                    "patientFirstName": data["first_name"],
                    "patientLastName": data["last_name"],
                    "patientDob": data["date_of_birth"],
                    "providerNpi": data.get("provider_npi", config.get("submitter_id", "")),
                    "serviceType": data.get("service_type", "DME"),
                }
            )

            await _db.officeally_logs.insert_one({
                "type": "eligibility", "status_code": response.status_code,
                "request": {k: v for k, v in data.items() if k not in ["password", "client_secret"]},
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            if response.status_code == 200:
                return response.json()
            else:
                return {"error": True, "status_code": response.status_code, "message": response.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Office Ally eligibility error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CLAIMS SUBMISSION ====================

@officeally_router.post("/claims/submit")
async def submit_claim(data: dict):
    """Submit a claim via Office Ally"""
    config = await _db.site_settings.find_one({"type": "officeally_config"}, {"_id": 0})
    if not config or not config.get("client_id"):
        raise HTTPException(status_code=400, detail="Office Ally not configured")

    token = await _get_token(config)
    if not token:
        raise HTTPException(status_code=401, detail="Failed to authenticate with Office Ally")

    env = config.get("environment", "test")
    base_url = "https://api.officeally.com" if env == "production" else "https://apitest.officeally.com"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/claims/submit",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=data
            )

            await _db.officeally_logs.insert_one({
                "type": "claim_submit", "status_code": response.status_code,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            if response.status_code in [200, 201, 202]:
                return response.json()
            else:
                return {"error": True, "status_code": response.status_code, "message": response.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Office Ally claims submit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CLAIMS STATUS ====================

@officeally_router.post("/claims/status")
async def check_claim_status(data: dict):
    """Check claim status via Office Ally"""
    config = await _db.site_settings.find_one({"type": "officeally_config"}, {"_id": 0})
    if not config or not config.get("client_id"):
        raise HTTPException(status_code=400, detail="Office Ally not configured")

    token = await _get_token(config)
    if not token:
        raise HTTPException(status_code=401, detail="Failed to authenticate with Office Ally")

    env = config.get("environment", "test")
    base_url = "https://api.officeally.com" if env == "production" else "https://apitest.officeally.com"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/claims/status",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=data
            )

            await _db.officeally_logs.insert_one({
                "type": "claim_status", "status_code": response.status_code,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            if response.status_code == 200:
                return response.json()
            else:
                return {"error": True, "status_code": response.status_code, "message": response.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Office Ally claims status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ACTIVITY LOGS ====================

@officeally_router.get("/logs")
async def get_officeally_logs(limit: int = 50):
    """Get recent Office Ally API activity logs"""
    logs = await _db.officeally_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(min(limit, 200)).to_list(min(limit, 200))
    return logs


# ==================== HELPERS ====================

async def _get_token(config: dict) -> str:
    """Get OAuth2 token from Office Ally"""
    env = config.get("environment", "test")
    base_url = "https://api.officeally.com" if env == "production" else "https://apitest.officeally.com"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{base_url}/token",
                data={
                    "grant_type": "password",
                    "username": config.get("username", ""),
                    "password": config.get("password", ""),
                    "client_id": config["client_id"],
                    "client_secret": config["client_secret"],
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if response.status_code == 200:
                return response.json().get("access_token")
    except Exception as e:
        logger.error(f"Office Ally token error: {e}")
    return None
