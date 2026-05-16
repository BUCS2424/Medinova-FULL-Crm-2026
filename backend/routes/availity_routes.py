"""
Availity API Integration Routes

Provides integration with Availity's healthcare APIs for:
- Eligibility & Benefits verification (270/271 transactions)
- Member ID Card retrieval
- Payer listings
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import httpx
import logging
import jwt
import os

logger = logging.getLogger(__name__)

# Database reference - will be set by server.py
_db = None

def set_database(database):
    """Set the database reference"""
    global _db
    _db = database

availity_router = APIRouter(prefix="/availity", tags=["Availity"])
security = HTTPBearer()

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user data"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        user = await _db.users.find_one({"id": payload.get("sub")})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "id": user.get("id"),
            "email": user.get("email"),
            "role": user.get("role"),
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# ==================== MODELS ====================

class AvailityConfigUpdate(BaseModel):
    """Availity configuration update model"""
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    environment: str = "test"  # "test" or "production"
    provider_npi: Optional[str] = None
    provider_tax_id: Optional[str] = None
    organization_name: Optional[str] = None

class EligibilityRequest(BaseModel):
    """Request model for eligibility check"""
    payer_id: str
    member_id: str
    member_first_name: Optional[str] = None
    member_last_name: Optional[str] = None
    member_dob: Optional[str] = None  # YYYY-MM-DD format
    service_type_codes: Optional[List[str]] = None  # e.g., ["30"] for health benefit plan coverage

class MemberCardRequest(BaseModel):
    """Request model for member ID card retrieval"""
    payer_id: str
    member_id: str
    format: str = "pdf"  # "pdf" or "png"


# ==================== HELPER FUNCTIONS ====================

async def get_availity_config():
    """Get Availity configuration from database"""
    config = await _db.system_settings.find_one({"type": "availity_config"})
    return config

async def get_access_token(config: dict) -> tuple:
    """
    Get OAuth access token from Availity
    
    Returns:
        tuple: (success: bool, token_or_error: str)
    """
    if not config:
        return False, "Availity not configured"
    
    client_id = config.get("client_id")
    client_secret = config.get("client_secret")
    
    if not client_id or not client_secret:
        return False, "Missing Availity credentials (client_id or client_secret)"
    
    # Determine environment
    env = config.get("environment", "test")
    if env == "production":
        token_url = "https://api.availity.com/v1/token"
    else:
        token_url = "https://tst.api.availity.com/v1/token"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "hipaa"
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return True, data.get("access_token")
            else:
                error_detail = response.text
                logger.error(f"Availity token error: {response.status_code} - {error_detail}")
                return False, f"Authentication failed: {response.status_code}"
    except httpx.TimeoutException:
        return False, "Connection timeout - Availity API not responding"
    except Exception as e:
        logger.error(f"Availity token exception: {e}")
        return False, f"Connection error: {str(e)}"


def get_api_base_url(env: str) -> str:
    """Get the base URL for Availity API calls"""
    if env == "production":
        return "https://api.availity.com"
    return "https://tst.api.availity.com"


# ==================== CONFIGURATION ENDPOINTS ====================

@availity_router.get("/config")
async def get_config(user: dict = Depends(verify_token)):
    """Get Availity configuration (masks secrets)"""
    config = await get_availity_config()
    
    if not config:
        return {
            "configured": False,
            "client_id": "",
            "client_secret": "",
            "environment": "test",
            "provider_npi": "",
            "provider_tax_id": "",
            "organization_name": ""
        }
    
    # Mask the secret
    client_secret = config.get("client_secret", "")
    masked_secret = f"{'*' * 20}{client_secret[-4:]}" if len(client_secret) > 4 else ""
    
    return {
        "configured": bool(config.get("client_id") and config.get("client_secret")),
        "client_id": config.get("client_id", ""),
        "client_secret": masked_secret,
        "environment": config.get("environment", "test"),
        "provider_npi": config.get("provider_npi", ""),
        "provider_tax_id": config.get("provider_tax_id", ""),
        "organization_name": config.get("organization_name", "")
    }


@availity_router.put("/config")
async def update_config(config_data: AvailityConfigUpdate, user: dict = Depends(verify_token)):
    """Update Availity configuration"""
    # Get existing config to preserve fields
    existing = await get_availity_config()
    
    update_data = {
        "type": "availity_config",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("email", "unknown")
    }
    
    # Only update fields that are provided and not empty
    if config_data.client_id is not None and config_data.client_id.strip():
        update_data["client_id"] = config_data.client_id.strip()
    elif existing:
        update_data["client_id"] = existing.get("client_id", "")
    
    # Handle secret - don't overwrite with masked value
    if config_data.client_secret is not None and config_data.client_secret.strip():
        # Only update if it doesn't look like a masked value
        if not config_data.client_secret.startswith("*"):
            update_data["client_secret"] = config_data.client_secret.strip()
        elif existing:
            update_data["client_secret"] = existing.get("client_secret", "")
    elif existing:
        update_data["client_secret"] = existing.get("client_secret", "")
    
    if config_data.environment:
        update_data["environment"] = config_data.environment
    elif existing:
        update_data["environment"] = existing.get("environment", "test")
    
    if config_data.provider_npi is not None:
        update_data["provider_npi"] = config_data.provider_npi.strip()
    elif existing:
        update_data["provider_npi"] = existing.get("provider_npi", "")
    
    if config_data.provider_tax_id is not None:
        update_data["provider_tax_id"] = config_data.provider_tax_id.strip()
    elif existing:
        update_data["provider_tax_id"] = existing.get("provider_tax_id", "")
    
    if config_data.organization_name is not None:
        update_data["organization_name"] = config_data.organization_name.strip()
    elif existing:
        update_data["organization_name"] = existing.get("organization_name", "")
    
    await _db.system_settings.update_one(
        {"type": "availity_config"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "message": "Availity configuration updated"}


@availity_router.get("/status")
async def get_status(user: dict = Depends(verify_token)):
    """Check Availity connection status"""
    config = await get_availity_config()
    
    if not config or not config.get("client_id") or not config.get("client_secret"):
        return {
            "configured": False,
            "connected": False,
            "environment": "test",
            "message": "Availity credentials not configured"
        }
    
    # Try to get an access token to verify credentials
    success, result = await get_access_token(config)
    
    return {
        "configured": True,
        "connected": success,
        "environment": config.get("environment", "test"),
        "message": "Connection successful" if success else result
    }


# ==================== PAYER ENDPOINTS ====================

@availity_router.get("/payers")
async def list_payers(
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type (e.g., '270' for eligibility)"),
    user: dict = Depends(verify_token)
):
    """
    Get list of available payers from Availity
    
    Transaction types:
    - 270: Eligibility and Benefits Inquiry
    - 276: Claim Status Inquiry
    - 278: Service Review/Prior Auth
    """
    config = await get_availity_config()
    success, token_or_error = await get_access_token(config)
    
    if not success:
        raise HTTPException(status_code=401, detail=token_or_error)
    
    base_url = get_api_base_url(config.get("environment", "test"))
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {"submissionMode": "API"}
            if transaction_type:
                params["transactionType"] = transaction_type
            
            response = await client.get(
                f"{base_url}/availity/v1/payers",
                headers={
                    "Authorization": f"Bearer {token_or_error}",
                    "Accept": "application/json"
                },
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                # Extract and format payer list
                payers = data.get("payers", []) if isinstance(data, dict) else data
                return {
                    "success": True,
                    "payers": payers,
                    "count": len(payers)
                }
            else:
                logger.error(f"Availity payers error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch payers: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Availity API timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payers list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ELIGIBILITY ENDPOINTS ====================

@availity_router.post("/eligibility/check")
async def check_eligibility(
    request: EligibilityRequest,
    user: dict = Depends(verify_token)
):
    """
    Check patient eligibility and benefits (270/271 transaction)
    
    This performs an eligibility inquiry with the specified payer.
    """
    config = await get_availity_config()
    success, token_or_error = await get_access_token(config)
    
    if not success:
        raise HTTPException(status_code=401, detail=token_or_error)
    
    base_url = get_api_base_url(config.get("environment", "test"))
    
    # Build the eligibility request payload
    payload = {
        "payerId": request.payer_id,
        "providerNpi": config.get("provider_npi", ""),
        "providerTaxId": config.get("provider_tax_id", ""),
        "subscriber": {
            "memberId": request.member_id
        }
    }
    
    # Add optional subscriber details
    if request.member_first_name:
        payload["subscriber"]["firstName"] = request.member_first_name
    if request.member_last_name:
        payload["subscriber"]["lastName"] = request.member_last_name
    if request.member_dob:
        payload["subscriber"]["birthDate"] = request.member_dob
    
    # Add service type codes if specified
    if request.service_type_codes:
        payload["serviceTypeCodes"] = request.service_type_codes
    else:
        # Default to general health benefit plan coverage
        payload["serviceTypeCodes"] = ["30"]
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/availity/v1/coverages",
                headers={
                    "Authorization": f"Bearer {token_or_error}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Log the eligibility check
                await _db.availity_logs.insert_one({
                    "type": "eligibility_check",
                    "payer_id": request.payer_id,
                    "member_id": request.member_id,
                    "status": "success",
                    "response_summary": data.get("status", "unknown"),
                    "checked_by": user.get("email", "unknown"),
                    "checked_at": datetime.now(timezone.utc).isoformat()
                })
                
                return {
                    "success": True,
                    "data": data
                }
            elif response.status_code == 202:
                # Async response - need to poll for results
                data = response.json()
                return {
                    "success": True,
                    "async": True,
                    "message": "Request accepted - eligibility check in progress",
                    "transaction_id": data.get("id") or data.get("transactionId"),
                    "data": data
                }
            else:
                logger.error(f"Eligibility check error: {response.status_code} - {response.text}")
                
                # Log the failed attempt
                await _db.availity_logs.insert_one({
                    "type": "eligibility_check",
                    "payer_id": request.payer_id,
                    "member_id": request.member_id,
                    "status": "error",
                    "error": response.text,
                    "checked_by": user.get("email", "unknown"),
                    "checked_at": datetime.now(timezone.utc).isoformat()
                })
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Eligibility check failed: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Eligibility check timeout - try again")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Eligibility check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@availity_router.get("/eligibility/status/{transaction_id}")
async def get_eligibility_status(
    transaction_id: str,
    user: dict = Depends(verify_token)
):
    """
    Get the status of an async eligibility check
    """
    config = await get_availity_config()
    success, token_or_error = await get_access_token(config)
    
    if not success:
        raise HTTPException(status_code=401, detail=token_or_error)
    
    base_url = get_api_base_url(config.get("environment", "test"))
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{base_url}/availity/v1/coverages/{transaction_id}",
                headers={
                    "Authorization": f"Bearer {token_or_error}",
                    "Accept": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "data": data
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get eligibility status: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Eligibility status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MEMBER CARD ENDPOINTS ====================

@availity_router.post("/member-card")
async def get_member_card(
    request: MemberCardRequest,
    user: dict = Depends(verify_token)
):
    """
    Retrieve member ID card from Availity
    
    Returns the card as PDF or PNG based on format parameter.
    """
    config = await get_availity_config()
    success, token_or_error = await get_access_token(config)
    
    if not success:
        raise HTTPException(status_code=401, detail=token_or_error)
    
    base_url = get_api_base_url(config.get("environment", "test"))
    
    payload = {
        "payerId": request.payer_id,
        "memberId": request.member_id,
        "providerNpi": config.get("provider_npi", ""),
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            accept_type = "application/pdf" if request.format == "pdf" else "image/png"
            
            response = await client.post(
                f"{base_url}/pre-claim/eb-value-adds/member-card",
                headers={
                    "Authorization": f"Bearer {token_or_error}",
                    "Content-Type": "application/json",
                    "Accept": accept_type
                },
                json=payload
            )
            
            if response.status_code == 200:
                # Log successful retrieval
                await _db.availity_logs.insert_one({
                    "type": "member_card",
                    "payer_id": request.payer_id,
                    "member_id": request.member_id,
                    "format": request.format,
                    "status": "success",
                    "retrieved_by": user.get("email", "unknown"),
                    "retrieved_at": datetime.now(timezone.utc).isoformat()
                })
                
                # Return base64 encoded content
                import base64
                content_b64 = base64.b64encode(response.content).decode('utf-8')
                
                return {
                    "success": True,
                    "format": request.format,
                    "content_type": accept_type,
                    "data": content_b64
                }
            else:
                logger.error(f"Member card error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to retrieve member card: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Member card error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LOGS ENDPOINT ====================

@availity_router.get("/logs")
async def get_logs(
    limit: int = Query(50, le=100),
    log_type: Optional[str] = Query(None, description="Filter by type: eligibility_check, member_card"),
    user: dict = Depends(verify_token)
):
    """Get Availity API activity logs"""
    query = {}
    if log_type:
        query["type"] = log_type
    
    logs = await _db.availity_logs.find(query).sort("checked_at", -1).limit(limit).to_list(limit)
    
    # Remove _id from results
    for log in logs:
        log.pop("_id", None)
    
    return {
        "logs": logs,
        "count": len(logs)
    }
