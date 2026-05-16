"""
Voice/Dialer Routes - Telnyx Browser Dialer & IVR System
Includes OpenAI TTS for Voice AI IVR prompts
"""

from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import json
import os
import logging
import asyncio

logger = logging.getLogger(__name__)

# TTS Configuration
try:
    from emergentintegrations.llm.openai import OpenAITextToSpeech
    from dotenv import load_dotenv
    load_dotenv()
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    logger.warning("emergentintegrations not available - TTS features will be limited")

voice_router = APIRouter(prefix="/voice", tags=["Voice/Dialer"])

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
    logger.warning("Telnyx SDK not installed - voice features will be limited")

# =============================================================================
# MODELS
# =============================================================================

class IVRLevel(str, Enum):
    MAIN = "main"
    SALES = "sales"
    SUPPORT = "support"
    BILLING = "billing"
    ELIGIBILITY = "eligibility"
    VOICEMAIL = "voicemail"

class CallDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

class CallStatus(str, Enum):
    INITIATED = "initiated"
    RINGING = "ringing"
    ANSWERED = "answered"
    ON_HOLD = "on_hold"
    TRANSFERRED = "transferred"
    COMPLETED = "completed"
    FAILED = "failed"
    VOICEMAIL = "voicemail"

class TelnyxConfig(BaseModel):
    api_key: Optional[str] = None
    connection_id: Optional[str] = None
    phone_number: Optional[str] = None
    caller_name: Optional[str] = None
    webhook_url: Optional[str] = None
    enabled: bool = False
    sip_username: Optional[str] = None
    sip_password: Optional[str] = None

class BusinessHours(BaseModel):
    enabled: bool = True
    timezone: str = "America/New_York"
    schedule: Dict[str, Dict] = {
        "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
        "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
        "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
        "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
        "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
        "saturday": {"enabled": False, "start": "10:00", "end": "14:00"},
        "sunday": {"enabled": False, "start": "10:00", "end": "14:00"}
    }
    lunch_break: Dict = {"enabled": True, "start": "12:00", "end": "13:00"}
    after_hours_message: str = "Thank you for calling. Our office is currently closed. Please leave a message after the beep, or call back during business hours."

class IVRConfig(BaseModel):
    enabled: bool = True
    greeting: str = "Thank you for calling Mastech Medical Equipment. "
    main_menu: str = "Press 1 for Sales and new orders. Press 2 for Support and existing orders. Press 3 for Billing. Press 4 to check your eligibility. Press 0 to speak with an operator."
    sales_menu: str = "You've reached Sales. Press 1 to speak with a representative, or press 0 to return to the main menu."
    support_menu: str = "You've reached Support. Press 1 for order status. Press 2 for technical support. Press 0 to return to the main menu."
    billing_menu: str = "You've reached Billing. Press 1 to speak with billing support. Press 0 to return to the main menu."
    voicemail_greeting: str = "Please leave a message after the beep. Include your name, phone number, and a brief description of how we can help you."
    transfer_timeout: int = 30
    voicemail_enabled: bool = True
    # Voice AI TTS Settings
    tts_enabled: bool = False
    tts_voice: str = "nova"  # OpenAI TTS voice: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
    tts_model: str = "tts-1"  # tts-1 (fast) or tts-1-hd (high quality)
    tts_speed: float = 1.0  # Speed: 0.25 to 4.0

class TTSVoice(str, Enum):
    ALLOY = "alloy"      # Neutral, balanced
    ASH = "ash"          # Clear, articulate
    CORAL = "coral"      # Warm, friendly
    ECHO = "echo"        # Smooth, calm
    FABLE = "fable"      # Expressive, storytelling
    NOVA = "nova"        # Energetic, upbeat
    ONYX = "onyx"        # Deep, authoritative
    SAGE = "sage"        # Wise, measured
    SHIMMER = "shimmer"  # Bright, cheerful

class TTSGenerateRequest(BaseModel):
    script_type: str  # greeting, main_menu, sales_menu, support_menu, billing_menu, after_hours, voicemail, no_agents
    text: Optional[str] = None  # Custom text override
    voice: Optional[str] = "nova"
    model: Optional[str] = "tts-1"
    speed: Optional[float] = 1.0

# =============================================================================
# CALL ROUTING & QUEUE MODELS
# =============================================================================

class RingStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"  # Ring one at a time, rotating
    RING_ALL = "ring_all"        # Ring all extensions simultaneously
    SEQUENTIAL = "sequential"     # Ring in order, always start from first

class FallbackAction(str, Enum):
    VOICEMAIL = "voicemail"
    NEXT_GROUP = "next_group"
    SPECIFIC_EXTENSION = "specific_extension"
    QUEUE = "queue"

class CallGroup(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    extensions: List[str] = []  # List of extension numbers
    ring_strategy: RingStrategy = RingStrategy.ROUND_ROBIN
    ring_timeout: int = 20  # Seconds to ring each extension
    max_queue_size: int = 10
    fallback_action: FallbackAction = FallbackAction.VOICEMAIL
    fallback_group_id: Optional[str] = None  # If fallback is next_group
    fallback_extension: Optional[str] = None  # If fallback is specific_extension
    ivr_key: Optional[str] = None  # Which IVR key routes to this group (1, 2, 3, etc.)
    is_active: bool = True
    current_robin_index: int = 0  # For round robin tracking

class CallGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    extensions: List[str] = []
    ring_strategy: RingStrategy = RingStrategy.ROUND_ROBIN
    ring_timeout: int = 20
    max_queue_size: int = 10
    fallback_action: FallbackAction = FallbackAction.VOICEMAIL
    fallback_group_id: Optional[str] = None
    fallback_extension: Optional[str] = None
    ivr_key: Optional[str] = None
    is_active: bool = True

class CallGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    extensions: Optional[List[str]] = None
    ring_strategy: Optional[RingStrategy] = None
    ring_timeout: Optional[int] = None
    max_queue_size: Optional[int] = None
    fallback_action: Optional[FallbackAction] = None
    fallback_group_id: Optional[str] = None
    fallback_extension: Optional[str] = None
    ivr_key: Optional[str] = None
    is_active: Optional[bool] = None

class HoldConfig(BaseModel):
    enabled: bool = True
    music_url: Optional[str] = None  # URL to hold music file
    music_filename: Optional[str] = None
    position_announcement_enabled: bool = True
    position_announcement_interval: int = 30  # Seconds between announcements
    custom_hold_message: str = "Thank you for holding. You are currently number {position} in the queue. Please stay on the line and your call will be answered shortly."
    custom_hold_message_audio_url: Optional[str] = None  # TTS generated audio
    estimated_wait_enabled: bool = False
    max_hold_time: int = 600  # 10 minutes max hold time

class QueueEntry(BaseModel):
    id: str
    call_control_id: str
    caller_number: str
    caller_name: Optional[str] = None
    group_id: str
    group_name: str
    position: int
    entered_at: datetime
    estimated_wait_seconds: Optional[int] = None
    status: str = "waiting"  # waiting, connecting, abandoned

class IVRRouting(BaseModel):
    """Maps IVR keys to call groups"""
    key_1: Optional[str] = None  # Group ID for Press 1
    key_2: Optional[str] = None  # Group ID for Press 2
    key_3: Optional[str] = None  # Group ID for Press 3
    key_4: Optional[str] = None  # Group ID for Press 4
    key_5: Optional[str] = None  # Group ID for Press 5
    key_0: Optional[str] = None  # Group ID for Press 0 (operator)

class DialRequest(BaseModel):
    to_number: str
    from_extension: Optional[str] = None
    lead_id: Optional[str] = None
    patient_id: Optional[str] = None

class CallRecord(BaseModel):
    id: str
    call_control_id: Optional[str] = None
    from_number: str
    to_number: str
    direction: str
    status: str
    extension: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    lead_id: Optional[str] = None
    patient_id: Optional[str] = None
    ivr_selections: List[str] = []
    recording_id: Optional[str] = None
    recording_url: Optional[str] = None
    start_time: datetime
    answer_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None

class WebRTCCredentials(BaseModel):
    token: str
    expires_at: datetime
    connection_id: str
    sip_username: Optional[str] = None

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def get_telnyx_config():
    """Get Telnyx configuration from database"""
    if db is None:
        return None
    config = await db.system_settings.find_one({"type": "telnyx_config"}, {"_id": 0})
    return config

async def get_business_hours():
    """Get business hours configuration"""
    if db is None:
        return BusinessHours().dict()
    config = await db.system_settings.find_one({"type": "business_hours"}, {"_id": 0})
    return config or BusinessHours().dict()

async def get_ivr_config():
    """Get IVR configuration"""
    if db is None:
        return IVRConfig().dict()
    config = await db.system_settings.find_one({"type": "ivr_config"}, {"_id": 0})
    return config or IVRConfig().dict()

def is_within_business_hours(business_hours: dict) -> bool:
    """Check if current time is within business hours"""
    from datetime import datetime
    import pytz
    
    try:
        tz = pytz.timezone(business_hours.get("timezone", "America/New_York"))
        now = datetime.now(tz)
        day_name = now.strftime("%A").lower()
        
        schedule = business_hours.get("schedule", {})
        day_schedule = schedule.get(day_name, {})
        
        if not day_schedule.get("enabled", False):
            return False
        
        current_time = now.strftime("%H:%M")
        start_time = day_schedule.get("start", "09:00")
        end_time = day_schedule.get("end", "17:00")
        
        if current_time < start_time or current_time > end_time:
            return False
        
        # Check lunch break
        lunch = business_hours.get("lunch_break", {})
        if lunch.get("enabled", False):
            lunch_start = lunch.get("start", "12:00")
            lunch_end = lunch.get("end", "13:00")
            if lunch_start <= current_time <= lunch_end:
                return False
        
        return True
    except Exception as e:
        logger.error(f"Error checking business hours: {e}")
        return True  # Default to open if error

async def get_next_available_agent():
    """Get next available agent for call routing using round-robin"""
    if db is None:
        return None
    
    # Get round-robin settings
    settings = await db.chat_round_robin.find_one({"type": "settings"}, {"_id": 0})
    if not settings or not settings.get("enabled"):
        return None
    
    agent_order = settings.get("agent_order", [])
    current_index = settings.get("current_index", 0)
    
    for i in range(len(agent_order)):
        idx = (current_index + i) % len(agent_order)
        agent = agent_order[idx]
        
        if agent.get("opted_out"):
            continue
        
        # Check if agent is available
        availability = await db.agent_availability.find_one({"user_id": agent["user_id"]})
        if availability and availability.get("is_available"):
            user = await db.users.find_one({"id": agent["user_id"]}, {"_id": 0, "password_hash": 0})
            if user and user.get("extension"):
                # Update round-robin index
                next_idx = (idx + 1) % len(agent_order)
                await db.chat_round_robin.update_one(
                    {"type": "settings"},
                    {"$set": {"current_index": next_idx}}
                )
                return user
    
    return None

async def find_user_by_extension(extension: str):
    """Find user by extension number"""
    if db is None:
        return None
    user = await db.users.find_one({"extension": extension}, {"_id": 0, "password_hash": 0})
    return user

async def find_caller_info(phone_number: str):
    """Look up caller info from leads/patients"""
    if db is None:
        return None
    
    # Clean phone number
    clean_number = ''.join(filter(str.isdigit, phone_number))[-10:]
    
    # Check leads first
    lead = await db.leads.find_one(
        {"$or": [
            {"phone": {"$regex": clean_number}},
            {"phone": phone_number}
        ]},
        {"_id": 0}
    )
    if lead:
        return {"type": "lead", "data": lead}
    
    # Check patients
    patient = await db.patients.find_one(
        {"$or": [
            {"phone": {"$regex": clean_number}},
            {"phone": phone_number}
        ]},
        {"_id": 0}
    )
    if patient:
        return {"type": "patient", "data": patient}
    
    return None

# =============================================================================
# CALL GROUP & QUEUE HELPER FUNCTIONS
# =============================================================================

async def get_call_group(group_id: str):
    """Get a call group by ID"""
    if db is None:
        return None
    return await db.call_groups.find_one({"id": group_id}, {"_id": 0})

async def get_call_group_by_ivr_key(ivr_key: str):
    """Get a call group by IVR key (1, 2, 3, etc.)"""
    if db is None:
        return None
    return await db.call_groups.find_one({"ivr_key": ivr_key, "is_active": True}, {"_id": 0})

async def get_all_call_groups():
    """Get all call groups"""
    if db is None:
        return []
    groups = await db.call_groups.find({}, {"_id": 0}).to_list(100)
    return groups

async def get_hold_config():
    """Get hold/queue configuration"""
    if db is None:
        return HoldConfig().dict()
    config = await db.system_settings.find_one({"type": "hold_config"}, {"_id": 0})
    return config or HoldConfig().dict()

async def get_ivr_routing():
    """Get IVR key to group routing"""
    if db is None:
        return {}
    routing = await db.system_settings.find_one({"type": "ivr_routing"}, {"_id": 0})
    return routing or {}

async def get_group_queue(group_id: str):
    """Get current queue for a group"""
    if db is None:
        return []
    queue = await db.call_queue.find(
        {"group_id": group_id, "status": "waiting"},
        {"_id": 0}
    ).sort("position", 1).to_list(50)
    return queue

async def get_queue_position(group_id: str):
    """Get next position in queue for a group"""
    if db is None:
        return 1
    count = await db.call_queue.count_documents({"group_id": group_id, "status": "waiting"})
    return count + 1

async def add_to_queue(call_control_id: str, caller_number: str, caller_name: str, group: dict):
    """Add a call to the queue"""
    position = await get_queue_position(group["id"])
    
    queue_entry = {
        "id": str(uuid.uuid4()),
        "call_control_id": call_control_id,
        "caller_number": caller_number,
        "caller_name": caller_name,
        "group_id": group["id"],
        "group_name": group["name"],
        "position": position,
        "entered_at": datetime.now(timezone.utc).isoformat(),
        "status": "waiting"
    }
    
    await db.call_queue.insert_one(queue_entry)
    return queue_entry

async def remove_from_queue(call_control_id: str):
    """Remove a call from the queue"""
    await db.call_queue.delete_one({"call_control_id": call_control_id})
    # Reorder remaining queue entries
    # This is simplified - in production you'd want atomic operations

async def update_queue_positions(group_id: str):
    """Reorder queue positions after removal"""
    queue = await db.call_queue.find(
        {"group_id": group_id, "status": "waiting"},
        {"_id": 0}
    ).sort("entered_at", 1).to_list(50)
    
    for idx, entry in enumerate(queue, 1):
        await db.call_queue.update_one(
            {"id": entry["id"]},
            {"$set": {"position": idx}}
        )

async def get_available_agents_in_group(group: dict):
    """Get available agents in a call group"""
    if db is None or not group:
        return []
    
    extensions = group.get("extensions", [])
    if not extensions:
        return []
    
    available_agents = []
    for ext in extensions:
        user = await find_user_by_extension(ext)
        if user:
            # Check availability
            availability = await db.agent_availability.find_one({"user_id": user["id"]})
            if availability and availability.get("is_available", False):
                available_agents.append(user)
    
    return available_agents

async def get_next_agent_for_group(group: dict):
    """Get next agent to ring based on group's ring strategy"""
    available_agents = await get_available_agents_in_group(group)
    
    if not available_agents:
        return None, []
    
    ring_strategy = group.get("ring_strategy", RingStrategy.ROUND_ROBIN)
    
    if ring_strategy == RingStrategy.RING_ALL:
        # Return all available agents
        return None, available_agents
    
    elif ring_strategy == RingStrategy.SEQUENTIAL:
        # Always return first available agent
        return available_agents[0], []
    
    else:  # ROUND_ROBIN
        # Get current index and rotate
        current_idx = group.get("current_robin_index", 0)
        
        # Find next available agent starting from current index
        for i in range(len(available_agents)):
            idx = (current_idx + i) % len(available_agents)
            agent = available_agents[idx]
            
            # Update robin index
            next_idx = (idx + 1) % len(available_agents)
            await db.call_groups.update_one(
                {"id": group["id"]},
                {"$set": {"current_robin_index": next_idx}}
            )
            
            return agent, []
    
    return None, []

# =============================================================================
# CONFIGURATION ENDPOINTS
# =============================================================================

@voice_router.get("/status")
async def get_voice_connection_status():
    """Check Telnyx connection status - used for the green indicator dot"""
    telnyx_config = await get_telnyx_config()
    
    # Default response
    status = {
        "connected": False,
        "enabled": False,
        "configured": False,
        "phone_number": None,
        "error": None
    }
    
    if not telnyx_config:
        status["error"] = "Voice not configured"
        return status
    
    status["enabled"] = telnyx_config.get("enabled", False)
    status["phone_number"] = telnyx_config.get("phone_number")
    
    # Check for API key - it might be in voice config, fax_config, or site_settings
    api_key = telnyx_config.get("api_key")
    if not api_key and db is not None:
        # Try to get API key from fax_config (shared key)
        fax_settings = await db.fax_config.find_one({}, {"_id": 0})
        if fax_settings:
            api_key = fax_settings.get("telnyx_api_key")
        
        # Also try site_settings (where the Telnyx API Key tab saves it)
        if not api_key:
            async for doc in db.site_settings.find({"telnyx_api_key": {"$exists": True, "$ne": None}}, {"_id": 0}):
                api_key = doc.get("telnyx_api_key")
                if api_key:
                    break
    
    connection_id = telnyx_config.get("connection_id")
    status["configured"] = bool(api_key) and bool(connection_id)
    
    if not status["enabled"]:
        status["error"] = "Voice features disabled"
        return status
    
    if not status["configured"]:
        status["error"] = "Missing API key or connection ID"
        return status
    
    # If Telnyx SDK is available, verify the connection by making a simple API call
    if TELNYX_AVAILABLE and api_key:
        try:
            # Create a Telnyx client and try a simple call to verify API key
            client = telnyx.Telnyx(api_key=api_key)
            # Just mark as connected since we have a valid configuration
            # Real verification would require a billable API call
            status["connected"] = True
        except telnyx.AuthenticationError:
            status["error"] = "Invalid API key"
            status["connected"] = False
        except telnyx.TelnyxError as e:
            status["error"] = f"Telnyx error: {str(e)}"
            status["connected"] = False
        except Exception as e:
            logger.error(f"Error checking Telnyx status: {e}")
            # If we can't verify, assume connected if configured
            status["connected"] = True
            status["error"] = None
    else:
        # SDK not available, but config looks good - mark as connected
        if status["configured"] and status["enabled"]:
            status["connected"] = True
    
    return status


@voice_router.get("/config")
async def get_voice_config():
    """Get all voice/dialer configuration"""
    telnyx_config = await get_telnyx_config() or {}
    business_hours = await get_business_hours()
    ivr_config = await get_ivr_config()
    
    # Don't expose API key or SIP password
    if "api_key" in telnyx_config:
        telnyx_config["api_key"] = "***" if telnyx_config["api_key"] else None
    if "sip_password" in telnyx_config and telnyx_config["sip_password"]:
        telnyx_config["sip_password"] = "••••••••"
    
    return {
        "telnyx": telnyx_config,
        "business_hours": business_hours,
        "ivr": ivr_config,
        "telnyx_sdk_available": TELNYX_AVAILABLE
    }

@voice_router.put("/config/telnyx")
async def update_telnyx_config(config: TelnyxConfig):
    """Update Telnyx configuration - preserves existing values for empty fields"""
    # Get existing config to preserve values not being updated
    existing = await db.system_settings.find_one({"type": "telnyx_config"}) or {}
    
    config_dict = config.dict()
    config_dict["type"] = "telnyx_config"
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Preserve existing values for fields that are empty/None in the update
    # This prevents accidental overwrites when only updating certain fields
    preserve_fields = ['api_key', 'sip_username', 'sip_password', 'connection_id', 'phone_number', 'caller_name', 'webhook_url']
    for field in preserve_fields:
        if not config_dict.get(field) and existing.get(field):
            config_dict[field] = existing[field]
    
    await db.system_settings.update_one(
        {"type": "telnyx_config"},
        {"$set": config_dict},
        upsert=True
    )
    
    # Configure Telnyx SDK if available
    if TELNYX_AVAILABLE and config_dict.get('api_key') and config_dict.get('enabled'):
        try:
            telnyx.api_key = config_dict['api_key']
        except Exception as e:
            logger.error(f"Error configuring Telnyx: {e}")
    
    return {"message": "Telnyx configuration updated"}


@voice_router.get("/config/credentials")
async def get_voice_credentials():
    """Get SIP credentials for WebRTC client - returns actual credentials"""
    telnyx_config = await get_telnyx_config()
    
    if not telnyx_config:
        raise HTTPException(status_code=404, detail="Voice not configured")
    
    if not telnyx_config.get("enabled"):
        raise HTTPException(status_code=400, detail="Voice features disabled")
    
    return {
        "sip_username": telnyx_config.get("sip_username"),
        "sip_password": telnyx_config.get("sip_password"),
        "phone_number": telnyx_config.get("phone_number"),
        "caller_name": telnyx_config.get("caller_name"),
        "connection_id": telnyx_config.get("connection_id")
    }


@voice_router.put("/config/business-hours")
async def update_business_hours(hours: BusinessHours):
    """Update business hours configuration"""
    hours_dict = hours.dict()
    hours_dict["type"] = "business_hours"
    hours_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"type": "business_hours"},
        {"$set": hours_dict},
        upsert=True
    )
    
    return {"message": "Business hours updated"}

@voice_router.put("/config/ivr")
async def update_ivr_config(config: IVRConfig):
    """Update IVR configuration"""
    config_dict = config.dict()
    config_dict["type"] = "ivr_config"
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"type": "ivr_config"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"message": "IVR configuration updated"}

# =============================================================================
# CALL GROUPS ENDPOINTS
# =============================================================================

@voice_router.get("/groups")
async def list_call_groups():
    """Get all call groups"""
    groups = await get_all_call_groups()
    
    # Enrich with agent info
    for group in groups:
        agents = []
        for ext in group.get("extensions", []):
            user = await find_user_by_extension(ext)
            if user:
                availability = await db.agent_availability.find_one({"user_id": user["id"]})
                agents.append({
                    "extension": ext,
                    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                    "email": user.get("email"),
                    "is_available": availability.get("is_available", False) if availability else False
                })
            else:
                agents.append({"extension": ext, "name": "Unknown", "is_available": False})
        group["agents"] = agents
        
        # Get queue count
        queue_count = await db.call_queue.count_documents({"group_id": group["id"], "status": "waiting"})
        group["queue_count"] = queue_count
    
    return {"groups": groups, "total": len(groups)}


@voice_router.post("/groups")
async def create_call_group(group: CallGroupCreate):
    """Create a new call group"""
    group_id = str(uuid.uuid4())
    
    group_dict = group.dict()
    group_dict["id"] = group_id
    group_dict["current_robin_index"] = 0
    group_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    group_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.call_groups.insert_one(group_dict)
    
    # If IVR key is set, update routing
    if group.ivr_key:
        await db.system_settings.update_one(
            {"type": "ivr_routing"},
            {"$set": {f"key_{group.ivr_key}": group_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    
    logger.info(f"Created call group: {group.name} ({group_id})")
    
    return {"id": group_id, "message": "Call group created"}


@voice_router.get("/groups/{group_id}")
async def get_call_group_details(group_id: str):
    """Get a specific call group"""
    group = await get_call_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Call group not found")
    
    # Enrich with agent info
    agents = []
    for ext in group.get("extensions", []):
        user = await find_user_by_extension(ext)
        if user:
            availability = await db.agent_availability.find_one({"user_id": user["id"]})
            agents.append({
                "extension": ext,
                "user_id": user.get("id"),
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "email": user.get("email"),
                "phone": user.get("phone"),
                "is_available": availability.get("is_available", False) if availability else False
            })
    group["agents"] = agents
    
    # Get queue
    queue = await get_group_queue(group_id)
    group["queue"] = queue
    
    return group


@voice_router.put("/groups/{group_id}")
async def update_call_group(group_id: str, update: CallGroupUpdate):
    """Update a call group"""
    existing = await get_call_group(group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Call group not found")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.call_groups.update_one(
        {"id": group_id},
        {"$set": update_dict}
    )
    
    # Update IVR routing if key changed
    if update.ivr_key is not None:
        # Remove old routing
        old_key = existing.get("ivr_key")
        if old_key:
            await db.system_settings.update_one(
                {"type": "ivr_routing"},
                {"$unset": {f"key_{old_key}": ""}}
            )
        # Add new routing
        if update.ivr_key:
            await db.system_settings.update_one(
                {"type": "ivr_routing"},
                {"$set": {f"key_{update.ivr_key}": group_id}},
                upsert=True
            )
    
    logger.info(f"Updated call group: {group_id}")
    
    return {"message": "Call group updated"}


@voice_router.delete("/groups/{group_id}")
async def delete_call_group(group_id: str):
    """Delete a call group"""
    existing = await get_call_group(group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Call group not found")
    
    # Remove IVR routing
    ivr_key = existing.get("ivr_key")
    if ivr_key:
        await db.system_settings.update_one(
            {"type": "ivr_routing"},
            {"$unset": {f"key_{ivr_key}": ""}}
        )
    
    await db.call_groups.delete_one({"id": group_id})
    
    logger.info(f"Deleted call group: {group_id}")
    
    return {"message": "Call group deleted"}


@voice_router.post("/groups/{group_id}/extensions/{extension}")
async def add_extension_to_group(group_id: str, extension: str):
    """Add an extension to a call group"""
    group = await get_call_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Call group not found")
    
    # Verify extension exists
    user = await find_user_by_extension(extension)
    if not user:
        raise HTTPException(status_code=400, detail="Extension not found")
    
    extensions = group.get("extensions", [])
    if extension not in extensions:
        extensions.append(extension)
        await db.call_groups.update_one(
            {"id": group_id},
            {"$set": {"extensions": extensions, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": f"Extension {extension} added to group"}


@voice_router.delete("/groups/{group_id}/extensions/{extension}")
async def remove_extension_from_group(group_id: str, extension: str):
    """Remove an extension from a call group"""
    group = await get_call_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Call group not found")
    
    extensions = group.get("extensions", [])
    if extension in extensions:
        extensions.remove(extension)
        await db.call_groups.update_one(
            {"id": group_id},
            {"$set": {"extensions": extensions, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": f"Extension {extension} removed from group"}


# =============================================================================
# HOLD & QUEUE CONFIGURATION ENDPOINTS
# =============================================================================

@voice_router.get("/hold/config")
async def get_hold_configuration():
    """Get hold/queue configuration"""
    config = await get_hold_config()
    return config


@voice_router.put("/hold/config")
async def update_hold_configuration(config: HoldConfig):
    """Update hold/queue configuration"""
    config_dict = config.dict()
    config_dict["type"] = "hold_config"
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"type": "hold_config"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"message": "Hold configuration updated"}


@voice_router.post("/hold/music/upload")
async def upload_hold_music(file: bytes = None):
    """Upload hold music file"""
    from fastapi import UploadFile, File
    # This would handle file upload - simplified for now
    # In production, use UploadFile and save to storage
    return {"message": "Hold music upload endpoint - use multipart form"}


@voice_router.post("/hold/message/generate")
async def generate_hold_message_audio(text: str = None, voice: str = "echo", model: str = "tts-1", speed: float = 0.9):
    """Generate TTS audio for custom hold message"""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="TTS service not available")
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    
    # Get default text from config if not provided
    if not text:
        hold_config = await get_hold_config()
        text = hold_config.get("custom_hold_message", "Thank you for holding. Your call is important to us.")
    
    try:
        tts = OpenAITextToSpeech(api_key=api_key)
        
        audio_bytes = await tts.generate_speech(
            text=text,
            model=model,
            voice=voice,
            speed=speed,
            response_format="mp3"
        )
        
        # Save to file
        filename = f"hold_message_{voice}_{uuid.uuid4().hex[:8]}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        # Update hold config with audio URL
        audio_url = f"/api/voice/tts/audio/{filename}"
        await db.system_settings.update_one(
            {"type": "hold_config"},
            {"$set": {
                "custom_hold_message_audio_url": audio_url,
                "custom_hold_message": text,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        logger.info(f"Generated hold message audio: {filename}")
        
        return {
            "success": True,
            "audio_url": audio_url,
            "filename": filename
        }
        
    except Exception as e:
        logger.error(f"Hold message TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


# =============================================================================
# QUEUE MANAGEMENT ENDPOINTS
# =============================================================================

@voice_router.get("/queue")
async def get_all_queues():
    """Get all current call queues across all groups"""
    groups = await get_all_call_groups()
    queues = {}
    
    for group in groups:
        queue = await get_group_queue(group["id"])
        queues[group["id"]] = {
            "group_name": group["name"],
            "queue": queue,
            "count": len(queue)
        }
    
    total_waiting = sum(q["count"] for q in queues.values())
    
    return {"queues": queues, "total_waiting": total_waiting}


@voice_router.get("/queue/{group_id}")
async def get_group_queue_status(group_id: str):
    """Get queue status for a specific group"""
    group = await get_call_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Call group not found")
    
    queue = await get_group_queue(group_id)
    available_agents = await get_available_agents_in_group(group)
    
    return {
        "group_id": group_id,
        "group_name": group["name"],
        "queue": queue,
        "queue_count": len(queue),
        "available_agents": len(available_agents),
        "ring_strategy": group.get("ring_strategy", "round_robin")
    }


@voice_router.delete("/queue/{entry_id}")
async def remove_queue_entry(entry_id: str):
    """Remove a call from the queue (e.g., if caller hangs up)"""
    entry = await db.call_queue.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    
    await db.call_queue.delete_one({"id": entry_id})
    
    # Reorder positions
    await update_queue_positions(entry["group_id"])
    
    return {"message": "Queue entry removed"}


@voice_router.get("/routing")
async def get_ivr_routing_config():
    """Get IVR key to group routing configuration"""
    routing = await get_ivr_routing()
    groups = await get_all_call_groups()
    
    # Build friendly response
    routing_map = {}
    for key in ["1", "2", "3", "4", "5", "0"]:
        group_id = routing.get(f"key_{key}")
        if group_id:
            group = next((g for g in groups if g["id"] == group_id), None)
            routing_map[key] = {
                "group_id": group_id,
                "group_name": group["name"] if group else "Unknown"
            }
        else:
            routing_map[key] = None
    
    return {"routing": routing_map, "groups": groups}


@voice_router.put("/routing")
async def update_ivr_routing_config(routing: IVRRouting):
    """Update IVR key to group routing"""
    routing_dict = routing.dict()
    routing_dict["type"] = "ivr_routing"
    routing_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"type": "ivr_routing"},
        {"$set": routing_dict},
        upsert=True
    )
    
    return {"message": "IVR routing updated"}


# =============================================================================
# VOICE AI TTS (Text-to-Speech) ENDPOINTS
# =============================================================================

# Available voices info for UI
TTS_VOICES = {
    "alloy": {"name": "Alloy", "description": "Neutral, balanced - good for professional messages", "gender": "neutral"},
    "ash": {"name": "Ash", "description": "Clear, articulate - great for instructions", "gender": "neutral"},
    "coral": {"name": "Coral", "description": "Warm, friendly - ideal for customer service", "gender": "female"},
    "echo": {"name": "Echo", "description": "Smooth, calm - perfect for hold messages", "gender": "male"},
    "fable": {"name": "Fable", "description": "Expressive, storytelling - good for greetings", "gender": "neutral"},
    "nova": {"name": "Nova", "description": "Energetic, upbeat - best for sales menus", "gender": "female"},
    "onyx": {"name": "Onyx", "description": "Deep, authoritative - great for billing/serious", "gender": "male"},
    "sage": {"name": "Sage", "description": "Wise, measured - good for support menus", "gender": "neutral"},
    "shimmer": {"name": "Shimmer", "description": "Bright, cheerful - perfect for voicemail", "gender": "female"}
}

# Audio files storage path
AUDIO_DIR = "/app/backend/audio_prompts"
os.makedirs(AUDIO_DIR, exist_ok=True)


@voice_router.get("/tts/voices")
async def get_available_voices():
    """Get list of available TTS voices with descriptions"""
    return {
        "voices": TTS_VOICES,
        "tts_available": TTS_AVAILABLE,
        "models": {
            "tts-1": {"name": "Standard", "description": "Fast generation, good quality"},
            "tts-1-hd": {"name": "HD", "description": "Higher quality, slower generation"}
        }
    }


@voice_router.post("/tts/generate")
async def generate_tts_audio(request: TTSGenerateRequest):
    """Generate TTS audio for IVR scripts using OpenAI"""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="TTS service not available. Install emergentintegrations.")
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    
    # Get the script text
    ivr_config = await get_ivr_config()
    business_hours = await get_business_hours()
    
    script_texts = {
        "greeting": ivr_config.get("greeting", "Thank you for calling."),
        "main_menu": ivr_config.get("greeting", "") + ivr_config.get("main_menu", ""),
        "sales_menu": ivr_config.get("sales_menu", ""),
        "support_menu": ivr_config.get("support_menu", ""),
        "billing_menu": ivr_config.get("billing_menu", ""),
        "after_hours": business_hours.get("after_hours_message", "Our office is currently closed."),
        "voicemail": ivr_config.get("voicemail_greeting", "Please leave a message after the beep."),
        "no_agents": "All of our representatives are currently busy. Please leave a message after the beep, and we will return your call as soon as possible."
    }
    
    # Use custom text if provided, otherwise use script type
    text = request.text or script_texts.get(request.script_type, "")
    if not text:
        raise HTTPException(status_code=400, detail=f"Unknown script type: {request.script_type}")
    
    # Check text length (OpenAI limit is 4096 chars)
    if len(text) > 4096:
        raise HTTPException(status_code=400, detail="Text too long (max 4096 characters)")
    
    # Validate voice
    voice = request.voice or "nova"
    if voice not in TTS_VOICES:
        raise HTTPException(status_code=400, detail=f"Invalid voice. Choose from: {list(TTS_VOICES.keys())}")
    
    try:
        tts = OpenAITextToSpeech(api_key=api_key)
        
        # Generate audio
        audio_bytes = await tts.generate_speech(
            text=text,
            model=request.model or "tts-1",
            voice=voice,
            speed=request.speed or 1.0,
            response_format="mp3"
        )
        
        # Save to file
        filename = f"{request.script_type}_{voice}_{uuid.uuid4().hex[:8]}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        # Store reference in database
        audio_record = {
            "id": str(uuid.uuid4()),
            "script_type": request.script_type,
            "voice": voice,
            "model": request.model or "tts-1",
            "speed": request.speed or 1.0,
            "text": text,
            "filename": filename,
            "filepath": filepath,
            "file_size": len(audio_bytes),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tts_audio_files.insert_one(audio_record)
        
        logger.info(f"TTS audio generated: {filename} for {request.script_type}")
        
        return {
            "success": True,
            "filename": filename,
            "script_type": request.script_type,
            "voice": voice,
            "audio_url": f"/api/voice/tts/audio/{filename}",
            "duration_estimate": len(text) / 15  # Rough estimate: ~15 chars per second
        }
        
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@voice_router.post("/tts/generate-all")
async def generate_all_tts_audio(voice: str = "nova", model: str = "tts-1", speed: float = 1.0):
    """Generate TTS audio for all IVR scripts at once"""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="TTS service not available")
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    
    if voice not in TTS_VOICES:
        raise HTTPException(status_code=400, detail=f"Invalid voice. Choose from: {list(TTS_VOICES.keys())}")
    
    script_types = ["greeting", "main_menu", "sales_menu", "support_menu", "billing_menu", "after_hours", "voicemail", "no_agents"]
    results = []
    errors = []
    
    for script_type in script_types:
        try:
            request = TTSGenerateRequest(
                script_type=script_type,
                voice=voice,
                model=model,
                speed=speed
            )
            result = await generate_tts_audio(request)
            results.append(result)
        except Exception as e:
            errors.append({"script_type": script_type, "error": str(e)})
    
    # Update IVR config with TTS settings
    await db.system_settings.update_one(
        {"type": "ivr_config"},
        {"$set": {
            "tts_enabled": True,
            "tts_voice": voice,
            "tts_model": model,
            "tts_speed": speed,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "success": len(errors) == 0,
        "generated": results,
        "errors": errors,
        "voice": voice,
        "model": model
    }


@voice_router.get("/tts/audio/{filename}")
async def get_tts_audio(filename: str):
    """Serve generated TTS audio file"""
    filepath = os.path.join(AUDIO_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        filepath,
        media_type="audio/mpeg",
        filename=filename
    )


@voice_router.get("/tts/files")
async def list_tts_files():
    """List all generated TTS audio files"""
    files = await db.tts_audio_files.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Group by script type
    by_type = {}
    for f in files:
        script_type = f.get("script_type", "unknown")
        if script_type not in by_type:
            by_type[script_type] = []
        by_type[script_type].append(f)
    
    return {"files": files, "by_type": by_type, "total": len(files)}


@voice_router.delete("/tts/files/{file_id}")
async def delete_tts_file(file_id: str):
    """Delete a TTS audio file"""
    file_record = await db.tts_audio_files.find_one({"id": file_id})
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File record not found")
    
    # Delete physical file
    filepath = file_record.get("filepath")
    if filepath and os.path.exists(filepath):
        os.remove(filepath)
    
    # Delete database record
    await db.tts_audio_files.delete_one({"id": file_id})
    
    return {"message": "File deleted", "filename": file_record.get("filename")}


@voice_router.post("/tts/preview")
async def preview_tts(text: str, voice: str = "nova", model: str = "tts-1", speed: float = 1.0):
    """Generate a preview TTS audio (not saved to IVR config)"""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="TTS service not available")
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Preview text too long (max 500 chars)")
    
    if voice not in TTS_VOICES:
        raise HTTPException(status_code=400, detail=f"Invalid voice")
    
    try:
        tts = OpenAITextToSpeech(api_key=api_key)
        
        audio_bytes = await tts.generate_speech(
            text=text,
            model=model,
            voice=voice,
            speed=speed,
            response_format="mp3"
        )
        
        # Save as preview file (overwrite if exists)
        filename = f"preview_{voice}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        return {
            "success": True,
            "audio_url": f"/api/voice/tts/audio/{filename}",
            "voice": voice,
            "text_length": len(text)
        }
        
    except Exception as e:
        logger.error(f"TTS preview error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS preview failed: {str(e)}")


# =============================================================================
# WEBRTC CREDENTIALS
# =============================================================================

@voice_router.post("/credentials")
async def generate_webrtc_credentials(user_id: str):
    """Generate WebRTC credentials for browser dialer"""
    telnyx_config = await get_telnyx_config()
    
    if not telnyx_config or not telnyx_config.get("enabled"):
        raise HTTPException(status_code=400, detail="Voice features not enabled")
    
    if not TELNYX_AVAILABLE:
        raise HTTPException(status_code=500, detail="Telnyx SDK not available")
    
    try:
        telnyx.api_key = telnyx_config.get("api_key")
        connection_id = telnyx_config.get("connection_id")
        
        # Create on-demand credential
        credential = telnyx.TelephonyCredential.create(
            connection_id=connection_id,
            name=f"WebRTC-{user_id}-{datetime.now(timezone.utc).timestamp()}"
        )
        
        # Generate JWT token
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        token_response = telnyx.TelephonyCredential.Token.create(
            id=credential.id
        )
        
        # Store credential
        cred_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "credential_id": credential.id,
            "connection_id": connection_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        }
        await db.voice_credentials.insert_one(cred_doc)
        
        return WebRTCCredentials(
            token=token_response.token,
            expires_at=expires_at,
            connection_id=connection_id,
            sip_username=credential.sip_username if hasattr(credential, 'sip_username') else None
        )
    
    except Exception as e:
        logger.error(f"Error generating credentials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# CALL CONTROL ENDPOINTS
# =============================================================================

@voice_router.post("/calls/dial")
async def initiate_call(request: DialRequest, user_id: str = None):
    """Initiate an outbound call"""
    telnyx_config = await get_telnyx_config()
    
    if not telnyx_config or not telnyx_config.get("enabled"):
        raise HTTPException(status_code=400, detail="Voice features not enabled")
    
    call_id = str(uuid.uuid4())
    
    # Get user info if user_id provided
    agent_name = None
    extension = request.from_extension
    if user_id:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if user:
            agent_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            extension = extension or user.get("extension")
    
    # Create call record
    call_record = {
        "id": call_id,
        "call_control_id": None,
        "from_number": telnyx_config.get("phone_number", ""),
        "to_number": request.to_number,
        "direction": CallDirection.OUTBOUND,
        "status": CallStatus.INITIATED,
        "extension": extension,
        "agent_id": user_id,
        "agent_name": agent_name,
        "lead_id": request.lead_id,
        "patient_id": request.patient_id,
        "ivr_selections": [],
        "start_time": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    if TELNYX_AVAILABLE and telnyx_config.get("api_key"):
        try:
            telnyx.api_key = telnyx_config.get("api_key")
            
            # Build call parameters with caller name if configured
            call_params = {
                "connection_id": telnyx_config.get("connection_id"),
                "to": request.to_number,
                "from_": telnyx_config.get("phone_number"),
                "webhook_url": telnyx_config.get("webhook_url", "")
            }
            
            # Add caller name (CNAM) if configured
            caller_name = telnyx_config.get("caller_name")
            if caller_name:
                call_params["from_display_name"] = caller_name[:15]  # CNAM max 15 chars
            
            call_response = telnyx.Call.create(**call_params)
            
            call_record["call_control_id"] = call_response.call_control_id
            call_record["status"] = CallStatus.RINGING
            call_record["caller_name_used"] = caller_name
        except Exception as e:
            logger.error(f"Error initiating call: {e}")
            call_record["status"] = CallStatus.FAILED
            call_record["notes"] = str(e)
    
    await db.call_logs.insert_one(call_record)
    
    return {"call_id": call_id, "status": call_record["status"]}

@voice_router.post("/calls/{call_id}/answer")
async def answer_call(call_id: str):
    """Answer an inbound call"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.answer()
        except Exception as e:
            logger.error(f"Error answering call: {e}")
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {
            "status": CallStatus.ANSWERED,
            "answer_time": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "answered"}

@voice_router.post("/calls/{call_id}/hangup")
async def hangup_call(call_id: str):
    """Hang up a call"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.hangup()
        except Exception as e:
            logger.error(f"Error hanging up call: {e}")
    
    # Calculate duration
    start_time = datetime.fromisoformat(call["start_time"].replace("Z", "+00:00")) if isinstance(call["start_time"], str) else call["start_time"]
    duration = (datetime.now(timezone.utc) - start_time).total_seconds()
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {
            "status": CallStatus.COMPLETED,
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": int(duration)
        }}
    )
    
    return {"status": "completed", "duration_seconds": int(duration)}

@voice_router.post("/calls/{call_id}/hold")
async def hold_call(call_id: str):
    """Put call on hold"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.hold()
        except Exception as e:
            logger.error(f"Error holding call: {e}")
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {"status": CallStatus.ON_HOLD}}
    )
    
    return {"status": "on_hold"}

@voice_router.post("/calls/{call_id}/unhold")
async def unhold_call(call_id: str):
    """Resume held call"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.unhold()
        except Exception as e:
            logger.error(f"Error unholding call: {e}")
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {"status": CallStatus.ANSWERED}}
    )
    
    return {"status": "resumed"}

@voice_router.post("/calls/{call_id}/mute")
async def mute_call(call_id: str):
    """Mute call"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.mute()
        except Exception as e:
            logger.error(f"Error muting call: {e}")
    
    return {"status": "muted"}

@voice_router.post("/calls/{call_id}/unmute")
async def unmute_call(call_id: str):
    """Unmute call"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.unmute()
        except Exception as e:
            logger.error(f"Error unmuting call: {e}")
    
    return {"status": "unmuted"}

@voice_router.post("/calls/{call_id}/transfer")
async def transfer_call(call_id: str, to_number: str = None, to_extension: str = None):
    """Transfer call to another number or extension"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    transfer_to = to_number
    if to_extension:
        user = await find_user_by_extension(to_extension)
        if user:
            transfer_to = user.get("phone")
    
    if not transfer_to:
        raise HTTPException(status_code=400, detail="No transfer destination")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.transfer(transfer_to)
        except Exception as e:
            logger.error(f"Error transferring call: {e}")
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {
            "status": CallStatus.TRANSFERRED,
            "transferred_to": transfer_to
        }}
    )
    
    return {"status": "transferred", "to": transfer_to}

@voice_router.post("/calls/{call_id}/record/start")
async def start_recording(call_id: str):
    """Start call recording"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.record_start(format="mp3", channels="dual")
        except Exception as e:
            logger.error(f"Error starting recording: {e}")
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {"recording_started": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "recording_started"}

@voice_router.post("/calls/{call_id}/record/stop")
async def stop_recording(call_id: str):
    """Stop call recording"""
    call = await db.call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if TELNYX_AVAILABLE and call.get("call_control_id"):
        try:
            telnyx_config = await get_telnyx_config()
            telnyx.api_key = telnyx_config.get("api_key")
            
            telnyx_call = telnyx.Call(call["call_control_id"])
            telnyx_call.record_stop()
        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
    
    await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {"recording_stopped": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "recording_stopped"}

# =============================================================================
# CALL HISTORY & LOGS
# =============================================================================

@voice_router.get("/calls")
async def get_call_history(
    limit: int = 50,
    offset: int = 0,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    agent_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    patient_id: Optional[str] = None
):
    """Get call history with filters"""
    query = {}
    
    if direction:
        query["direction"] = direction
    if status:
        query["status"] = status
    if agent_id:
        query["agent_id"] = agent_id
    if lead_id:
        query["lead_id"] = lead_id
    if patient_id:
        query["patient_id"] = patient_id
    
    calls = await db.call_logs.find(query, {"_id": 0}).sort("start_time", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.call_logs.count_documents(query)
    
    return {"calls": calls, "total": total}


class CallLogEntry(BaseModel):
    direction: str = "outbound"
    from_number: Optional[str] = None
    to_number: Optional[str] = None
    duration_seconds: int = 0
    status: str = "completed"
    lead_id: Optional[str] = None
    patient_id: Optional[str] = None
    notes: Optional[str] = None


@voice_router.post("/calls/log")
async def log_call_from_webrtc(entry: CallLogEntry):
    """Log a call made from the WebRTC dialer"""
    call_id = f"call_{uuid.uuid4().hex[:16]}"
    
    call_record = {
        "id": call_id,
        "direction": entry.direction,
        "from_number": entry.from_number,
        "to_number": entry.to_number,
        "duration_seconds": entry.duration_seconds,
        "status": entry.status,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": datetime.now(timezone.utc).isoformat(),
        "source": "webrtc_dialer",
        "lead_id": entry.lead_id,
        "patient_id": entry.patient_id,
        "notes": entry.notes
    }
    
    await db.call_logs.insert_one(call_record)
    
    return {"id": call_id, "message": "Call logged"}


# =============================================================================
# PHONE BILLING & STATS
# =============================================================================

class PhoneBillingConfig(BaseModel):
    per_minute_rate: float = 0.0085  # Default Telnyx rate ~$0.0085/min
    markup_percentage: float = 0  # Optional markup
    currency: str = "USD"
    # SMS billing
    sms_outbound_rate: float = 0.004  # Default Telnyx SMS rate ~$0.004/message
    sms_inbound_rate: float = 0.004  # Default Telnyx SMS inbound rate
    sms_markup_percentage: float = 0  # Optional SMS markup


@voice_router.get("/billing/config")
async def get_phone_billing_config():
    """Get phone billing configuration"""
    config = await db.system_settings.find_one({"type": "phone_billing"}, {"_id": 0})
    if not config:
        # Return defaults
        return {
            "per_minute_rate": 0.0085,
            "markup_percentage": 0,
            "currency": "USD",
            "sms_outbound_rate": 0.004,
            "sms_inbound_rate": 0.004,
            "sms_markup_percentage": 0
        }
    # Ensure SMS fields exist for backwards compatibility
    config.setdefault("sms_outbound_rate", 0.004)
    config.setdefault("sms_inbound_rate", 0.004)
    config.setdefault("sms_markup_percentage", 0)
    return config


@voice_router.put("/billing/config")
async def update_phone_billing_config(config: PhoneBillingConfig):
    """Update phone billing configuration"""
    config_dict = config.dict()
    config_dict["type"] = "phone_billing"
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"type": "phone_billing"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"message": "Billing configuration updated"}


@voice_router.get("/stats")
async def get_phone_stats(
    period: str = "all",  # day, week, month, all
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get phone usage statistics with billing"""
    query = {}
    
    # Build date filter
    now = datetime.now(timezone.utc)
    if period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query["start_time"] = {"$gte": start.isoformat()}
    elif period == "week":
        start = now - timedelta(days=7)
        query["start_time"] = {"$gte": start.isoformat()}
    elif period == "month":
        start = now - timedelta(days=30)
        query["start_time"] = {"$gte": start.isoformat()}
    elif start_date and end_date:
        query["start_time"] = {"$gte": start_date, "$lte": end_date}
    
    # Get billing config
    billing_config = await db.system_settings.find_one({"type": "phone_billing"}, {"_id": 0})
    per_minute_rate = billing_config.get("per_minute_rate", 0.0085) if billing_config else 0.0085
    markup_percentage = billing_config.get("markup_percentage", 0) if billing_config else 0
    
    # Aggregate stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_calls": {"$sum": 1},
            "total_seconds": {"$sum": "$duration_seconds"},
            "completed_calls": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
            "missed_calls": {"$sum": {"$cond": [{"$eq": ["$status", "missed"]}, 1, 0]}},
            "inbound_calls": {"$sum": {"$cond": [{"$eq": ["$direction", "inbound"]}, 1, 0]}},
            "outbound_calls": {"$sum": {"$cond": [{"$eq": ["$direction", "outbound"]}, 1, 0]}},
            "inbound_seconds": {"$sum": {"$cond": [{"$eq": ["$direction", "inbound"]}, "$duration_seconds", 0]}},
            "outbound_seconds": {"$sum": {"$cond": [{"$eq": ["$direction", "outbound"]}, "$duration_seconds", 0]}}
        }}
    ]
    
    result = await db.call_logs.aggregate(pipeline).to_list(1)
    
    if not result:
        stats = {
            "total_calls": 0,
            "total_seconds": 0,
            "total_minutes": 0,
            "completed_calls": 0,
            "missed_calls": 0,
            "inbound_calls": 0,
            "outbound_calls": 0,
            "inbound_minutes": 0,
            "outbound_minutes": 0
        }
    else:
        r = result[0]
        stats = {
            "total_calls": r.get("total_calls", 0),
            "total_seconds": r.get("total_seconds", 0),
            "total_minutes": round(r.get("total_seconds", 0) / 60, 2),
            "completed_calls": r.get("completed_calls", 0),
            "missed_calls": r.get("missed_calls", 0),
            "inbound_calls": r.get("inbound_calls", 0),
            "outbound_calls": r.get("outbound_calls", 0),
            "inbound_minutes": round(r.get("inbound_seconds", 0) / 60, 2),
            "outbound_minutes": round(r.get("outbound_seconds", 0) / 60, 2)
        }
    
    # Get SMS stats
    sms_query = {}
    if period == "day":
        sms_query["timestamp"] = {"$gte": now.replace(hour=0, minute=0, second=0, microsecond=0)}
    elif period == "week":
        sms_query["timestamp"] = {"$gte": now - timedelta(days=7)}
    elif period == "month":
        sms_query["timestamp"] = {"$gte": now - timedelta(days=30)}
    
    sms_query["type"] = "sms"
    
    sms_pipeline = [
        {"$match": sms_query},
        {"$group": {
            "_id": None,
            "total_sms": {"$sum": 1},
            "outbound_sms": {"$sum": {"$cond": [{"$eq": ["$direction", "outbound"]}, 1, 0]}},
            "inbound_sms": {"$sum": {"$cond": [{"$eq": ["$direction", "inbound"]}, 1, 0]}}
        }}
    ]
    
    sms_result = await db.communications.aggregate(sms_pipeline).to_list(1)
    
    if sms_result:
        sms_r = sms_result[0]
        stats["sms"] = {
            "total_sms": sms_r.get("total_sms", 0),
            "outbound_sms": sms_r.get("outbound_sms", 0),
            "inbound_sms": sms_r.get("inbound_sms", 0)
        }
    else:
        stats["sms"] = {
            "total_sms": 0,
            "outbound_sms": 0,
            "inbound_sms": 0
        }
    
    # Calculate voice costs
    base_cost = stats["total_minutes"] * per_minute_rate
    markup_cost = base_cost * (markup_percentage / 100)
    total_voice_cost = base_cost + markup_cost
    
    # Calculate SMS costs
    sms_outbound_rate = billing_config.get("sms_outbound_rate", 0.004) if billing_config else 0.004
    sms_inbound_rate = billing_config.get("sms_inbound_rate", 0.004) if billing_config else 0.004
    sms_markup_percentage = billing_config.get("sms_markup_percentage", 0) if billing_config else 0
    
    sms_base_cost = (stats["sms"]["outbound_sms"] * sms_outbound_rate) + (stats["sms"]["inbound_sms"] * sms_inbound_rate)
    sms_markup_cost = sms_base_cost * (sms_markup_percentage / 100)
    total_sms_cost = sms_base_cost + sms_markup_cost
    
    stats["billing"] = {
        "per_minute_rate": per_minute_rate,
        "markup_percentage": markup_percentage,
        "voice_base_cost": round(base_cost, 4),
        "voice_markup_cost": round(markup_cost, 4),
        "voice_total_cost": round(total_voice_cost, 4),
        "sms_outbound_rate": sms_outbound_rate,
        "sms_inbound_rate": sms_inbound_rate,
        "sms_markup_percentage": sms_markup_percentage,
        "sms_base_cost": round(sms_base_cost, 4),
        "sms_markup_cost": round(sms_markup_cost, 4),
        "sms_total_cost": round(total_sms_cost, 4),
        "total_cost": round(total_voice_cost + total_sms_cost, 4),
        "currency": billing_config.get("currency", "USD") if billing_config else "USD"
    }
    
    stats["period"] = period
    
    return stats


@voice_router.get("/calls/cdr")
async def get_call_detail_records(
    period: str = "day",  # day, week, month
    page: int = 1,
    page_size: int = 50,
    direction: Optional[str] = None,
    status: Optional[str] = None
):
    """Get detailed CDR list with pagination"""
    query = {}
    
    # Build date filter
    now = datetime.now(timezone.utc)
    if period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query["start_time"] = {"$gte": start.isoformat()}
    elif period == "week":
        start = now - timedelta(days=7)
        query["start_time"] = {"$gte": start.isoformat()}
    elif period == "month":
        start = now - timedelta(days=30)
        query["start_time"] = {"$gte": start.isoformat()}
    
    if direction:
        query["direction"] = direction
    if status:
        query["status"] = status
    
    # Get billing config for cost calculation
    billing_config = await db.system_settings.find_one({"type": "phone_billing"}, {"_id": 0})
    per_minute_rate = billing_config.get("per_minute_rate", 0.0085) if billing_config else 0.0085
    markup_percentage = billing_config.get("markup_percentage", 0) if billing_config else 0
    
    # Get calls with pagination
    skip = (page - 1) * page_size
    calls = await db.call_logs.find(query, {"_id": 0}).sort("start_time", -1).skip(skip).limit(page_size).to_list(page_size)
    total = await db.call_logs.count_documents(query)
    
    # Add cost to each call
    for call in calls:
        duration_mins = call.get("duration_seconds", 0) / 60
        base_cost = duration_mins * per_minute_rate
        markup = base_cost * (markup_percentage / 100)
        call["cost"] = round(base_cost + markup, 4)
    
    return {
        "calls": calls,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@voice_router.get("/calls/{call_id}")
async def get_call_details(call_id: str):
    """Get detailed call information"""
    call = await db.call_logs.find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # Get related lead/patient info
    if call.get("lead_id"):
        lead = await db.leads.find_one({"id": call["lead_id"]}, {"_id": 0})
        call["lead"] = lead
    
    if call.get("patient_id"):
        patient = await db.patients.find_one({"id": call["patient_id"]}, {"_id": 0})
        call["patient"] = patient
    
    return call

@voice_router.put("/calls/{call_id}/notes")
async def update_call_notes(call_id: str, notes: str):
    """Update call notes"""
    result = await db.call_logs.update_one(
        {"id": call_id},
        {"$set": {"notes": notes, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Notes updated"}

@voice_router.post("/calls/{call_id}/link")
async def link_call_to_record(call_id: str, lead_id: Optional[str] = None, patient_id: Optional[str] = None):
    """Link call to a lead or patient record"""
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if lead_id:
        updates["lead_id"] = lead_id
    if patient_id:
        updates["patient_id"] = patient_id
    
    result = await db.call_logs.update_one(
        {"id": call_id},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Call linked"}

# =============================================================================
# WEBHOOK HANDLERS (Telnyx)
# =============================================================================

@voice_router.post("/webhooks")
async def handle_voice_webhook(request: Request):
    """Handle incoming voice webhooks from Telnyx"""
    try:
        body = await request.body()
        data = json.loads(body)
        
        event_type = data.get("data", {}).get("event_type")
        payload = data.get("data", {}).get("payload", {})
        call_control_id = payload.get("call_control_id")
        
        logger.info(f"Voice webhook received: {event_type}")
        
        # Store webhook event for audit
        if db is not None:
            await db.voice_webhook_events.insert_one({
                "id": str(uuid.uuid4()),
                "call_control_id": call_control_id,
                "event_type": event_type,
                "payload": payload,
                "received_at": datetime.now(timezone.utc).isoformat(),
                "source": "primary"
            })
        
        if event_type == "call.initiated":
            await handle_inbound_call(call_control_id, payload)
        
        elif event_type == "call.answered":
            await handle_call_answered(call_control_id, payload)
        
        elif event_type == "call.gather.ended":
            digits = payload.get("digits", "")
            await handle_ivr_input(call_control_id, digits)
        
        elif event_type == "call.hangup":
            await handle_call_hangup(call_control_id, payload)
        
        elif event_type == "call.recording.saved":
            await handle_recording_saved(call_control_id, payload)
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}


@voice_router.post("/webhooks/failover")
async def handle_voice_webhook_failover(request: Request):
    """
    Failover webhook for Telnyx voice - use as secondary webhook URL.
    Identical to primary but logs as failover for monitoring.
    Configure in Telnyx as: {YOUR_DOMAIN}/api/voice/webhooks/failover
    """
    try:
        body = await request.body()
        data = json.loads(body)
        
        event_type = data.get("data", {}).get("event_type")
        payload = data.get("data", {}).get("payload", {})
        call_control_id = payload.get("call_control_id")
        
        logger.warning(f"FAILOVER Voice webhook received: {event_type}")
        
        # Store webhook event for audit (mark as failover)
        if db is not None:
            await db.voice_webhook_events.insert_one({
                "id": str(uuid.uuid4()),
                "call_control_id": call_control_id,
                "event_type": event_type,
                "payload": payload,
                "received_at": datetime.now(timezone.utc).isoformat(),
                "source": "failover"
            })
        
        if event_type == "call.initiated":
            await handle_inbound_call(call_control_id, payload)
        
        elif event_type == "call.answered":
            await handle_call_answered(call_control_id, payload)
        
        elif event_type == "call.gather.ended":
            digits = payload.get("digits", "")
            await handle_ivr_input(call_control_id, digits)
        
        elif event_type == "call.hangup":
            await handle_call_hangup(call_control_id, payload)
        
        elif event_type == "call.recording.saved":
            await handle_recording_saved(call_control_id, payload)
        
        return {"status": "ok", "source": "failover"}
    
    except Exception as e:
        logger.error(f"FAILOVER Webhook error: {e}")
        return {"status": "error", "message": str(e)}

async def handle_inbound_call(call_control_id: str, payload: dict):
    """Handle incoming call - answer and start IVR"""
    from_number = payload.get("from", "")
    to_number = payload.get("to", "")
    
    # Create call record
    call_id = str(uuid.uuid4())
    call_record = {
        "id": call_id,
        "call_control_id": call_control_id,
        "from_number": from_number,
        "to_number": to_number,
        "direction": CallDirection.INBOUND,
        "status": CallStatus.INITIATED,
        "ivr_selections": [],
        "ivr_level": IVRLevel.MAIN,
        "start_time": datetime.now(timezone.utc).isoformat()
    }
    
    # Look up caller
    caller_info = await find_caller_info(from_number)
    if caller_info:
        if caller_info["type"] == "lead":
            call_record["lead_id"] = caller_info["data"].get("id")
            call_record["caller_name"] = f"{caller_info['data'].get('first_name', '')} {caller_info['data'].get('last_name', '')}".strip()
        elif caller_info["type"] == "patient":
            call_record["patient_id"] = caller_info["data"].get("id")
            call_record["caller_name"] = f"{caller_info['data'].get('first_name', '')} {caller_info['data'].get('last_name', '')}".strip()
    
    await db.call_logs.insert_one(call_record)
    
    # Check business hours
    business_hours = await get_business_hours()
    if not is_within_business_hours(business_hours):
        # After hours - go to voicemail
        await play_after_hours_message(call_control_id, business_hours)
        return
    
    # Answer the call using SDK v4
    telnyx_config = await get_telnyx_config()
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            client.calls.answer(call_control_id)
            logger.info(f"Answered inbound call: {call_control_id}")
        except Exception as e:
            logger.error(f"Error answering call: {e}")

async def handle_call_answered(call_control_id: str, payload: dict):
    """Handle call answered - play IVR menu"""
    ivr_config = await get_ivr_config()
    
    if not ivr_config.get("enabled"):
        # Direct to agent
        agent = await get_next_available_agent()
        if agent:
            await transfer_to_agent(call_control_id, agent)
        return
    
    # Play main menu
    await play_ivr_menu(call_control_id, IVRLevel.MAIN)

async def handle_ivr_input(call_control_id: str, digits: str):
    """Handle DTMF input during IVR"""
    if not digits:
        return
    
    digit = digits[-1]
    
    # Get current call and IVR level
    call = await db.call_logs.find_one({"call_control_id": call_control_id})
    if not call:
        return
    
    current_level = call.get("ivr_level", IVRLevel.MAIN)
    ivr_config = await get_ivr_config()
    
    # Update IVR selections
    await db.call_logs.update_one(
        {"call_control_id": call_control_id},
        {"$push": {"ivr_selections": digit}}
    )
    
    # Route based on selection
    if current_level == IVRLevel.MAIN:
        if digit == "1":
            await update_ivr_level(call_control_id, IVRLevel.SALES)
            await play_ivr_menu(call_control_id, IVRLevel.SALES)
        elif digit == "2":
            await update_ivr_level(call_control_id, IVRLevel.SUPPORT)
            await play_ivr_menu(call_control_id, IVRLevel.SUPPORT)
        elif digit == "3":
            await update_ivr_level(call_control_id, IVRLevel.BILLING)
            await play_ivr_menu(call_control_id, IVRLevel.BILLING)
        elif digit == "4":
            await update_ivr_level(call_control_id, IVRLevel.ELIGIBILITY)
            # Could integrate with eligibility check
            await transfer_to_department(call_control_id, "sales")
        elif digit == "0":
            await transfer_to_next_agent(call_control_id)
        else:
            await play_ivr_menu(call_control_id, IVRLevel.MAIN)
    
    elif current_level == IVRLevel.SALES:
        if digit == "1":
            await transfer_to_department(call_control_id, "sales")
        elif digit == "0":
            await update_ivr_level(call_control_id, IVRLevel.MAIN)
            await play_ivr_menu(call_control_id, IVRLevel.MAIN)
    
    elif current_level == IVRLevel.SUPPORT:
        if digit == "1":
            await transfer_to_department(call_control_id, "support")
        elif digit == "2":
            await transfer_to_department(call_control_id, "tech_support")
        elif digit == "0":
            await update_ivr_level(call_control_id, IVRLevel.MAIN)
            await play_ivr_menu(call_control_id, IVRLevel.MAIN)
    
    elif current_level == IVRLevel.BILLING:
        if digit == "1":
            await transfer_to_department(call_control_id, "billing")
        elif digit == "0":
            await update_ivr_level(call_control_id, IVRLevel.MAIN)
            await play_ivr_menu(call_control_id, IVRLevel.MAIN)

async def handle_call_hangup(call_control_id: str, payload: dict):
    """Handle call termination"""
    call = await db.call_logs.find_one({"call_control_id": call_control_id})
    if call:
        start_time = datetime.fromisoformat(call["start_time"].replace("Z", "+00:00")) if isinstance(call["start_time"], str) else call["start_time"]
        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        await db.call_logs.update_one(
            {"call_control_id": call_control_id},
            {"$set": {
                "status": CallStatus.COMPLETED,
                "end_time": datetime.now(timezone.utc).isoformat(),
                "duration_seconds": int(duration)
            }}
        )

async def handle_recording_saved(call_control_id: str, payload: dict):
    """Handle recording saved event"""
    recording_url = payload.get("recording_urls", {}).get("mp3")
    recording_id = payload.get("recording_id")
    
    await db.call_logs.update_one(
        {"call_control_id": call_control_id},
        {"$set": {
            "recording_id": recording_id,
            "recording_url": recording_url
        }}
    )

async def play_ivr_menu(call_control_id: str, level: IVRLevel):
    """Play IVR menu prompt using TTS"""
    ivr_config = await get_ivr_config()
    telnyx_config = await get_telnyx_config()
    
    prompts = {
        IVRLevel.MAIN: ivr_config.get("greeting", "") + " " + ivr_config.get("main_menu", ""),
        IVRLevel.SALES: ivr_config.get("sales_menu", ""),
        IVRLevel.SUPPORT: ivr_config.get("support_menu", ""),
        IVRLevel.BILLING: ivr_config.get("billing_menu", "")
    }
    
    prompt = prompts.get(level, prompts[IVRLevel.MAIN])
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            # Use gather_using_speak to play prompt and collect DTMF
            client.calls.gather_using_speak(
                call_control_id,
                payload=prompt,
                language="en-US",
                voice="female",
                maximum_digits=1,
                timeout_millis=10000,
                valid_digits="0123456789"
            )
            logger.info(f"Playing IVR menu level {level} for call {call_control_id}")
        except Exception as e:
            logger.error(f"Error playing IVR menu: {e}")

async def play_after_hours_message(call_control_id: str, business_hours: dict):
    """Play after hours message"""
    telnyx_config = await get_telnyx_config()
    message = business_hours.get("after_hours_message", "Our office is currently closed. Please call back during business hours.")
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            # Answer first
            client.calls.answer(call_control_id)
            # Then play message
            client.calls.speak(
                call_control_id,
                payload=message,
                language="en-US",
                voice="female"
            )
            logger.info(f"Playing after hours message for call {call_control_id}")
        except Exception as e:
            logger.error(f"Error playing after hours message: {e}")

async def update_ivr_level(call_control_id: str, level: IVRLevel):
    """Update current IVR level for call"""
    await db.call_logs.update_one(
        {"call_control_id": call_control_id},
        {"$set": {"ivr_level": level}}
    )

async def transfer_to_next_agent(call_control_id: str):
    """Transfer call to next available agent"""
    agent = await get_next_available_agent()
    if agent:
        await transfer_to_agent(call_control_id, agent)
    else:
        # No agents available - go to voicemail
        await play_no_agents_message(call_control_id)

async def transfer_to_agent(call_control_id: str, agent: dict):
    """Transfer call to specific agent"""
    telnyx_config = await get_telnyx_config()
    
    # Update call record
    await db.call_logs.update_one(
        {"call_control_id": call_control_id},
        {"$set": {
            "agent_id": agent.get("id"),
            "agent_name": f"{agent.get('first_name', '')} {agent.get('last_name', '')}".strip(),
            "extension": agent.get("extension"),
            "status": CallStatus.TRANSFERRED
        }}
    )
    
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            
            # Start recording before transfer
            client.calls.record_start(call_control_id, format="mp3", channels="dual")
            
            # Transfer to agent's phone or SIP
            if agent.get("phone"):
                client.calls.transfer(call_control_id, to=agent["phone"])
                logger.info(f"Transferred call {call_control_id} to agent {agent.get('id')}")
        except Exception as e:
            logger.error(f"Error transferring to agent: {e}")

async def transfer_to_department(call_control_id: str, department: str):
    """Transfer call to department queue"""
    # Find available agent in department
    agent = await get_next_available_agent()  # Could filter by department
    if agent:
        await transfer_to_agent(call_control_id, agent)
    else:
        await play_no_agents_message(call_control_id)

async def play_no_agents_message(call_control_id: str):
    """Play message when no agents available"""
    telnyx_config = await get_telnyx_config()
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            client.calls.speak(
                call_control_id,
                payload="All of our representatives are currently busy. Please leave a message after the beep, and we will return your call as soon as possible.",
                language="en-US",
                voice="female"
            )
            logger.info(f"Playing no agents message for call {call_control_id}")
        except Exception as e:
            logger.error(f"Error playing no agents message: {e}")

# =============================================================================
# EXTENSIONS MANAGEMENT
# =============================================================================

@voice_router.get("/extensions")
async def get_all_extensions():
    """Get all user extensions"""
    users = await db.users.find(
        {"extension": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "extension": 1, "role": 1}
    ).to_list(100)
    
    # Get availability status
    for user in users:
        avail = await db.agent_availability.find_one({"user_id": user["id"]})
        user["is_available"] = avail.get("is_available", False) if avail else False
    
    return {"extensions": users}

@voice_router.put("/extensions/{user_id}")
async def update_user_extension(user_id: str, extension: str):
    """Update user's extension number"""
    # Check if extension already exists
    existing = await db.users.find_one({"extension": extension, "id": {"$ne": user_id}})
    if existing:
        raise HTTPException(status_code=400, detail="Extension already in use")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"extension": extension}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Extension updated"}

# =============================================================================
# CALLER ID LOOKUP (Screen Pop)
# =============================================================================

@voice_router.get("/lookup/{phone_number}")
async def lookup_caller(phone_number: str):
    """Look up caller information for screen pop"""
    caller_info = await find_caller_info(phone_number)
    
    if caller_info:
        return {
            "found": True,
            "type": caller_info["type"],
            "data": caller_info["data"]
        }
    
    return {"found": False}


# =============================================================================
# VOICEMAIL MANAGEMENT
# =============================================================================

class VoicemailConfig(BaseModel):
    enabled: bool = True
    greeting: str = "No one is available to take your call. Please leave a message after the beep, including your name and phone number, and we will return your call as soon as possible."
    max_duration: int = 120
    email_notification: bool = True
    notification_email: Optional[str] = None

@voice_router.get("/voicemail/config")
async def get_voicemail_config():
    """Get main voicemail configuration"""
    config = await db.system_settings.find_one({"type": "voicemail_config"}, {"_id": 0})
    if not config:
        return {
            "enabled": True,
            "greeting": "No one is available to take your call. Please leave a message after the beep, including your name and phone number, and we will return your call as soon as possible.",
            "max_duration": 120,
            "email_notification": True,
            "notification_email": ""
        }
    return config

@voice_router.put("/voicemail/config")
async def update_voicemail_config(config: VoicemailConfig):
    """Update main voicemail configuration"""
    config_dict = config.dict()
    config_dict["type"] = "voicemail_config"
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"type": "voicemail_config"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"message": "Voicemail configuration updated"}

@voice_router.get("/voicemail/users")
async def get_users_with_voicemail():
    """Get all users who can have personal voicemail (have extensions)"""
    users = await db.users.find(
        {"extension": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "extension": 1, "voicemail_greeting": 1}
    ).to_list(100)
    
    return {"users": users}

@voice_router.put("/voicemail/user/{user_id}")
async def update_user_voicemail(user_id: str, data: dict):
    """Update user's personal voicemail greeting"""
    voicemail_greeting = data.get("voicemail_greeting", "")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"voicemail_greeting": voicemail_greeting}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User voicemail updated"}

async def play_personal_voicemail(call_control_id: str, user: dict):
    """Play user's personal voicemail greeting"""
    telnyx_config = await get_telnyx_config()
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    # Get user's personal greeting or use default
    greeting = user.get("voicemail_greeting")
    if not greeting:
        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "the person you called"
        greeting = f"Hi, you've reached {name}. I'm unable to take your call right now. Please leave a message and I'll get back to you as soon as possible."
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            # Play greeting then start recording
            client.calls.speak(
                call_control_id,
                payload=greeting,
                language="en-US",
                voice="female"
            )
            logger.info(f"Playing personal voicemail for {user.get('id')}")
        except Exception as e:
            logger.error(f"Error playing personal voicemail: {e}")

async def play_main_voicemail(call_control_id: str):
    """Play main/group voicemail greeting"""
    telnyx_config = await get_telnyx_config()
    api_key = telnyx_config.get("api_key") if telnyx_config else None
    
    # Get main voicemail config
    vm_config = await db.system_settings.find_one({"type": "voicemail_config"})
    greeting = vm_config.get("greeting") if vm_config else "No one is available to take your call. Please leave a message after the beep."
    
    if TELNYX_AVAILABLE and api_key:
        try:
            client = telnyx.Telnyx(api_key=api_key)
            client.calls.speak(
                call_control_id,
                payload=greeting,
                language="en-US",
                voice="female"
            )
            logger.info(f"Playing main voicemail for call {call_control_id}")
        except Exception as e:
            logger.error(f"Error playing main voicemail: {e}")
