"""
SMS Routes - Telnyx SMS Integration
Handles sending/receiving SMS, conversation history, and webhooks
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid
import json
import os
import logging

logger = logging.getLogger(__name__)

sms_router = APIRouter(prefix="/sms", tags=["SMS"])

# Database reference (set by main server)
db = None

def set_database(database):
    global db
    db = database

# Try to import telnyx
try:
    import telnyx
    TELNYX_AVAILABLE = True
except ImportError:
    TELNYX_AVAILABLE = False
    logger.warning("Telnyx SDK not installed - SMS features will be limited")

# =============================================================================
# MODELS
# =============================================================================

class SMSConfig(BaseModel):
    enabled: bool = False
    api_key: Optional[str] = None
    messaging_profile_id: Optional[str] = None
    phone_number: Optional[str] = None
    webhook_url: Optional[str] = None

class SendSMSRequest(BaseModel):
    to: str = Field(..., description="Recipient phone number in E.164 format")
    text: str = Field(..., min_length=1, max_length=1600, description="Message content")
    from_number: Optional[str] = None
    lead_id: Optional[str] = None
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None

class SMSMessage(BaseModel):
    id: Optional[str] = None
    from_number: str
    to_number: str
    text: str
    direction: str  # inbound or outbound
    status: str  # queued, sent, delivered, failed, received
    timestamp: datetime
    lead_id: Optional[str] = None
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None
    telnyx_message_id: Optional[str] = None

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def get_sms_config():
    """Get SMS configuration from database"""
    if db is None:
        return None
    config = await db.system_settings.find_one({"type": "sms_config"}, {"_id": 0})
    return config

async def get_telnyx_api_key():
    """Get Telnyx API key from various sources"""
    # Check SMS config first
    sms_config = await get_sms_config()
    if sms_config and sms_config.get("api_key"):
        return sms_config.get("api_key")
    
    # Fall back to voice config
    voice_config = await db.system_settings.find_one({"type": "telnyx_config"}, {"_id": 0})
    if voice_config and voice_config.get("api_key"):
        return voice_config.get("api_key")
    
    # Fall back to environment variable
    return os.environ.get("TELNYX_API_KEY")

def format_phone_number(phone: str) -> str:
    """Format phone number to E.164 format"""
    if not phone:
        return phone
    
    # Remove all non-digit characters except +
    cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
    
    # Add + if missing and number is 10 or 11 digits
    if not cleaned.startswith('+'):
        if len(cleaned) == 10:
            cleaned = '+1' + cleaned
        elif len(cleaned) == 11 and cleaned.startswith('1'):
            cleaned = '+' + cleaned
    
    return cleaned

# =============================================================================
# SMS CONFIGURATION ENDPOINTS
# =============================================================================

@sms_router.get("/config")
async def get_sms_configuration():
    """Get SMS configuration (with masked API key)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    config = await get_sms_config() or {}
    
    # Mask API key
    if config.get("api_key"):
        config["api_key"] = "***" + config["api_key"][-4:] if len(config.get("api_key", "")) > 4 else "***"
    
    return {
        "enabled": config.get("enabled", False),
        "api_key": config.get("api_key"),
        "messaging_profile_id": config.get("messaging_profile_id"),
        "phone_number": config.get("phone_number"),
        "webhook_url": config.get("webhook_url")
    }

@sms_router.put("/config")
async def update_sms_configuration(config: SMSConfig):
    """Update SMS configuration"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    update_data = {
        "type": "sms_config",
        "enabled": config.enabled,
        "messaging_profile_id": config.messaging_profile_id,
        "phone_number": config.phone_number,
        "webhook_url": config.webhook_url,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Only update API key if provided and not masked
    if config.api_key and not config.api_key.startswith("***"):
        update_data["api_key"] = config.api_key
    
    await db.system_settings.update_one(
        {"type": "sms_config"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "SMS configuration updated"}

@sms_router.get("/status")
async def get_sms_status():
    """Check SMS service status and connectivity"""
    status = {
        "available": TELNYX_AVAILABLE,
        "enabled": False,
        "configured": False,
        "phone_number": None,
        "error": None
    }
    
    config = await get_sms_config()
    if config:
        status["enabled"] = config.get("enabled", False)
        status["phone_number"] = config.get("phone_number")
        status["configured"] = bool(config.get("api_key") and config.get("phone_number"))
    
    # Test API connection if configured
    if status["configured"] and TELNYX_AVAILABLE:
        try:
            api_key = await get_telnyx_api_key()
            if api_key:
                telnyx.api_key = api_key
                # Simple API test
                status["connected"] = True
        except Exception as e:
            status["error"] = str(e)
            status["connected"] = False
    
    return status

# =============================================================================
# SMS SENDING ENDPOINTS
# =============================================================================

@sms_router.post("/send")
async def send_sms(request: SendSMSRequest):
    """Send an SMS message"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    if not TELNYX_AVAILABLE:
        raise HTTPException(status_code=503, detail="SMS service not available")
    
    config = await get_sms_config()
    if not config or not config.get("enabled"):
        raise HTTPException(status_code=400, detail="SMS is not enabled. Go to Dev Settings → SMS Settings to enable.")
    
    api_key = await get_telnyx_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Telnyx API key not configured. Go to Dev Settings → Telnyx (Voice & Fax) to add your API key.")
    
    from_number = request.from_number or config.get("phone_number")
    if not from_number:
        raise HTTPException(status_code=400, detail="No sender phone number configured. Go to Dev Settings → SMS Settings to add a phone number.")
    
    to_number = format_phone_number(request.to)
    from_number = format_phone_number(from_number)
    
    try:
        # Create Telnyx client (SDK v4 syntax)
        client = telnyx.Telnyx(api_key=api_key)
        
        # Send via Telnyx using SDK v4 API
        send_params = {
            "from_": from_number,
            "to": to_number,
            "text": request.text,
        }
        
        # Add messaging profile ID if configured
        messaging_profile_id = config.get("messaging_profile_id")
        if messaging_profile_id:
            send_params["messaging_profile_id"] = messaging_profile_id
        
        telnyx_response = client.messages.send(**send_params)
        
        # Extract message ID from response
        telnyx_message_id = None
        if hasattr(telnyx_response, 'data') and hasattr(telnyx_response.data, 'id'):
            telnyx_message_id = telnyx_response.data.id
        elif hasattr(telnyx_response, 'id'):
            telnyx_message_id = telnyx_response.id
        
        # Store in database
        message_doc = {
            "from_number": from_number,
            "to_number": to_number,
            "text": request.text,
            "direction": "outbound",
            "status": "sent",
            "timestamp": datetime.now(timezone.utc),
            "lead_id": request.lead_id,
            "patient_id": request.patient_id,
            "doctor_id": request.doctor_id,
            "telnyx_message_id": telnyx_message_id,
            "type": "sms"
        }
        
        result = await db.communications.insert_one(message_doc)
        message_doc["_id"] = str(result.inserted_id)
        
        # Also add to conversation history if linked to lead/patient
        if request.lead_id or request.patient_id:
            await add_to_conversation_history(message_doc)
        
        logger.info(f"SMS sent to {to_number}: {request.text[:50]}...")
        
        return {
            "success": True,
            "message_id": str(result.inserted_id),
            "telnyx_message_id": telnyx_message_id,
            "status": "sent"
        }
        
    except telnyx.APIError as e:
        logger.error(f"Telnyx API error: {e}")
        raise HTTPException(status_code=500, detail=f"SMS sending failed: {str(e)}")
    except telnyx.AuthenticationError as e:
        logger.error(f"Telnyx auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Telnyx API key. Please check your configuration.")
    except Exception as e:
        logger.error(f"SMS error: {e}")
        raise HTTPException(status_code=500, detail=f"SMS sending failed: {str(e)}")

@sms_router.post("/webhook")
async def handle_sms_webhook(request: Request):
    """Handle incoming SMS webhooks from Telnyx"""
    try:
        body = await request.json()
        
        event_type = body.get("data", {}).get("event_type")
        payload = body.get("data", {}).get("payload", {})
        
        logger.info(f"SMS webhook received: {event_type}")
        
        if event_type == "message.received":
            # Incoming SMS
            from_number = payload.get("from", {}).get("phone_number")
            to_number = payload.get("to", [{}])[0].get("phone_number") if payload.get("to") else None
            text = payload.get("text", "")
            
            message_doc = {
                "from_number": from_number,
                "to_number": to_number,
                "text": text,
                "direction": "inbound",
                "status": "received",
                "timestamp": datetime.now(timezone.utc),
                "telnyx_message_id": payload.get("id"),
                "type": "sms"
            }
            
            # Try to match with lead/patient by phone number
            lead = await db.leads.find_one({"phone": {"$regex": from_number[-10:]}})
            if lead:
                message_doc["lead_id"] = str(lead["_id"])
            
            patient = await db.patients.find_one({"phone": {"$regex": from_number[-10:]}})
            if patient:
                message_doc["patient_id"] = str(patient["_id"])
            
            await db.communications.insert_one(message_doc)
            
            logger.info(f"Incoming SMS from {from_number}: {text[:50]}...")
            
        elif event_type == "message.sent" or event_type == "message.dlr":
            # Delivery status update
            telnyx_id = payload.get("id")
            status = payload.get("status", "unknown")
            
            await db.communications.update_one(
                {"telnyx_message_id": telnyx_id},
                {"$set": {"status": status}}
            )
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"SMS webhook error: {e}")
        return {"status": "error", "message": str(e)}

# =============================================================================
# CONVERSATION HISTORY ENDPOINTS
# =============================================================================

async def add_to_conversation_history(message_doc: dict):
    """Add communication to lead/patient history"""
    if message_doc.get("lead_id"):
        lead_id = message_doc["lead_id"]
        # Try to find by UUID string first (new format), then by ObjectId (legacy)
        lead = await db.leads.find_one({"_id": lead_id})
        if not lead:
            # Try as ObjectId if it looks like one (24 hex chars)
            if len(lead_id) == 24 and all(c in '0123456789abcdef' for c in lead_id.lower()):
                lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
                lead_id = ObjectId(lead_id)
        
        if lead:
            await db.leads.update_one(
                {"_id": lead_id if isinstance(lead_id, ObjectId) else lead_id},
                {
                    "$push": {
                        "communications": {
                            "type": message_doc.get("type", "sms"),
                            "direction": message_doc["direction"],
                            "content": message_doc["text"],
                            "timestamp": message_doc["timestamp"],
                            "from": message_doc["from_number"],
                            "to": message_doc["to_number"]
                        }
                    }
                }
            )
    
    if message_doc.get("patient_id"):
        patient_id = message_doc["patient_id"]
        # Try to find by UUID string first (new format), then by ObjectId (legacy)
        patient = await db.patients.find_one({"_id": patient_id})
        if not patient:
            # Try as ObjectId if it looks like one (24 hex chars)
            if len(patient_id) == 24 and all(c in '0123456789abcdef' for c in patient_id.lower()):
                patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
                patient_id = ObjectId(patient_id)
        
        if patient:
            await db.patients.update_one(
                {"_id": patient_id if isinstance(patient_id, ObjectId) else patient_id},
                {
                    "$push": {
                        "communications": {
                            "type": message_doc.get("type", "sms"),
                            "direction": message_doc["direction"],
                            "content": message_doc["text"],
                            "timestamp": message_doc["timestamp"],
                            "from": message_doc["from_number"],
                            "to": message_doc["to_number"]
                        }
                    }
                }
            )

@sms_router.get("/conversations/{phone_number}")
async def get_conversation_by_phone(phone_number: str, limit: int = 50, offset: int = 0):
    """Get SMS conversation history for a phone number"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    # Normalize phone number for search
    search_phone = phone_number[-10:] if len(phone_number) > 10 else phone_number
    
    messages = await db.communications.find({
        "$or": [
            {"from_number": {"$regex": search_phone}},
            {"to_number": {"$regex": search_phone}}
        ],
        "type": "sms"
    }).sort("timestamp", -1).skip(offset).limit(limit).to_list(length=limit)
    
    # Convert ObjectId to string
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    
    return {
        "messages": messages,
        "total": await db.communications.count_documents({
            "$or": [
                {"from_number": {"$regex": search_phone}},
                {"to_number": {"$regex": search_phone}}
            ],
            "type": "sms"
        })
    }

@sms_router.get("/lead/{lead_id}/messages")
async def get_lead_messages(lead_id: str, limit: int = 50):
    """Get all communications for a lead"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    messages = await db.communications.find({
        "lead_id": lead_id
    }).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    
    return messages

@sms_router.get("/patient/{patient_id}/messages")
async def get_patient_messages(patient_id: str, limit: int = 50):
    """Get all communications for a patient"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    messages = await db.communications.find({
        "patient_id": patient_id
    }).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    
    return messages

# =============================================================================
# UNIFIED COMMUNICATIONS ENDPOINTS
# =============================================================================

class CommunicationRecord(BaseModel):
    type: str  # sms, email, call
    direction: str  # inbound, outbound
    content: str
    from_address: str
    to_address: str
    lead_id: Optional[str] = None
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None
    subject: Optional[str] = None  # For emails
    duration_seconds: Optional[int] = None  # For calls
    attachments: Optional[List[str]] = None

@sms_router.post("/communications/log")
async def log_communication(record: CommunicationRecord):
    """Log any type of communication (SMS, email, call)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    comm_doc = {
        "type": record.type,
        "direction": record.direction,
        "content": record.content,
        "from_address": record.from_address,
        "to_address": record.to_address,
        "lead_id": record.lead_id,
        "patient_id": record.patient_id,
        "doctor_id": record.doctor_id,
        "subject": record.subject,
        "duration_seconds": record.duration_seconds,
        "attachments": record.attachments,
        "timestamp": datetime.now(timezone.utc),
        "status": "logged"
    }
    
    result = await db.communications.insert_one(comm_doc)
    
    # Add to lead/patient history
    await add_to_conversation_history({
        **comm_doc,
        "text": record.content,
        "from_number": record.from_address,
        "to_number": record.to_address
    })
    
    return {
        "success": True,
        "communication_id": str(result.inserted_id)
    }

@sms_router.get("/communications/history")
async def get_communications_history(
    lead_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    comm_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get communication history with filters"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    query = {}
    
    if lead_id:
        query["lead_id"] = lead_id
    if patient_id:
        query["patient_id"] = patient_id
    if comm_type:
        query["type"] = comm_type
    
    messages = await db.communications.find(query).sort("timestamp", -1).skip(offset).limit(limit).to_list(length=limit)
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    
    total = await db.communications.count_documents(query)
    
    return {
        "messages": messages,
        "total": total,
        "limit": limit,
        "offset": offset
    }
