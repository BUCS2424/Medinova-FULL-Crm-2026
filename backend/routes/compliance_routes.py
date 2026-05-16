"""
Compliance API routes for Jornaya LeadiD and TrustedForm integration.
Handles configuration management and TrustedForm certificate claiming.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import httpx
import logging
import base64

logger = logging.getLogger(__name__)

compliance_router = APIRouter(prefix="/compliance", tags=["compliance"])

_db = None
_get_current_user = None
_is_admin_role = None

def set_database(db):
    global _db
    _db = db

def set_auth(get_current_user_fn, is_admin_fn):
    global _get_current_user, _is_admin_role
    _get_current_user = get_current_user_fn
    _is_admin_role = is_admin_fn


class ComplianceConfigUpdate(BaseModel):
    jornaya_campaign_id: Optional[str] = None
    trustedform_api_key: Optional[str] = None


# ==================== CONFIG ENDPOINTS (Admin) ====================

@compliance_router.get("/config")
async def get_compliance_config():
    """Get compliance API configuration (admin only)"""
    config = await _db.site_settings.find_one({"type": "compliance_apis"}, {"_id": 0})
    if not config:
        return {
            "jornaya_configured": False,
            "trustedform_configured": False,
            "jornaya_campaign_id": "",
            "trustedform_api_key": "",
        }
    return {
        "jornaya_configured": bool(config.get("jornaya_campaign_id")),
        "trustedform_configured": bool(config.get("trustedform_api_key")),
        "jornaya_campaign_id": config.get("jornaya_campaign_id", ""),
        # Mask the API key in response
        "trustedform_api_key": ("*" * 20 + config["trustedform_api_key"][-8:]) if config.get("trustedform_api_key") else "",
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by"),
    }


@compliance_router.put("/config")
async def update_compliance_config(data: ComplianceConfigUpdate):
    """Save compliance API configuration (admin only)"""
    update = {
        "type": "compliance_apis",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": "admin",
    }
    
    # Only update fields that are provided (preserve existing values)
    existing = await _db.site_settings.find_one({"type": "compliance_apis"}, {"_id": 0})
    
    if data.jornaya_campaign_id is not None:
        update["jornaya_campaign_id"] = data.jornaya_campaign_id
    elif existing:
        update["jornaya_campaign_id"] = existing.get("jornaya_campaign_id", "")
        
    if data.trustedform_api_key is not None:
        # Don't overwrite with masked value
        if data.trustedform_api_key and not data.trustedform_api_key.startswith("*"):
            update["trustedform_api_key"] = data.trustedform_api_key
        elif existing:
            update["trustedform_api_key"] = existing.get("trustedform_api_key", "")
    elif existing:
        update["trustedform_api_key"] = existing.get("trustedform_api_key", "")
    
    await _db.site_settings.update_one(
        {"type": "compliance_apis"},
        {"$set": update},
        upsert=True
    )
    return {"message": "Compliance API configuration saved"}


# ==================== PUBLIC CONFIG (for script injection) ====================

@compliance_router.get("/public-config")
async def get_public_compliance_config():
    """Public endpoint — returns which compliance scripts should be loaded (no keys exposed)"""
    config = await _db.site_settings.find_one({"type": "compliance_apis"}, {"_id": 0})
    features = await _db.site_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    feature_flags = features.get("features", {}) if features else {}
    
    jornaya_enabled = feature_flags.get("jornaya_tracking", False)
    trustedform_enabled = feature_flags.get("trustedform_cert", False)
    
    result = {
        "jornaya_enabled": False,
        "trustedform_enabled": False,
        "jornaya_campaign_id": None,
    }
    
    if config:
        if jornaya_enabled and config.get("jornaya_campaign_id"):
            result["jornaya_enabled"] = True
            result["jornaya_campaign_id"] = config["jornaya_campaign_id"]
        if trustedform_enabled and config.get("trustedform_api_key"):
            result["trustedform_enabled"] = True
    
    return result


# ==================== TRUSTEDFORM CERTIFICATE CLAIM ====================

@compliance_router.post("/trustedform/claim")
async def claim_trustedform_certificate(data: dict):
    """Claim a TrustedForm certificate after lead submission (called internally)"""
    cert_url = data.get("cert_url")
    lead_id = data.get("lead_id")
    
    if not cert_url:
        return {"claimed": False, "reason": "No certificate URL provided"}
    
    config = await _db.site_settings.find_one({"type": "compliance_apis"}, {"_id": 0})
    if not config or not config.get("trustedform_api_key"):
        return {"claimed": False, "reason": "TrustedForm API key not configured"}
    
    api_key = config["trustedform_api_key"]
    
    try:
        auth = base64.b64encode(f"API:{api_key}".encode()).decode()
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                cert_url,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": f"Basic {auth}"
                },
                json={"reference": lead_id} if lead_id else {}
            )
            
            if response.status_code in [200, 201]:
                cert_data = response.json()
                # Store certificate data with lead
                if lead_id:
                    await _db.leads.update_one(
                        {"id": lead_id},
                        {"$set": {
                            "trustedform_cert_claimed": True,
                            "trustedform_cert_data": {
                                "claimed_at": datetime.now(timezone.utc).isoformat(),
                                "masked_cert_url": cert_data.get("masked_cert_url"),
                                "expires_at": cert_data.get("expires_at"),
                                "page_url": cert_data.get("page_url"),
                            }
                        }}
                    )
                return {"claimed": True, "data": cert_data}
            else:
                logger.warning(f"TrustedForm claim failed: {response.status_code} {response.text}")
                return {"claimed": False, "reason": f"HTTP {response.status_code}"}
    except Exception as e:
        logger.error(f"TrustedForm claim error: {e}")
        return {"claimed": False, "reason": str(e)}
