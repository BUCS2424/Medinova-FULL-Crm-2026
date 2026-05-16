"""
Telnyx Video Rooms API routes.
Handles room creation, token generation, participant management, and meeting scheduling.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import httpx
import uuid
import logging

logger = logging.getLogger(__name__)

video_rooms_router = APIRouter(prefix="/video-rooms", tags=["video-rooms"])

_db = None
_get_current_user = None

def set_database(db):
    global _db
    _db = db

def set_auth(get_current_user_fn):
    global _get_current_user
    _get_current_user = get_current_user_fn


async def _get_telnyx_api_key():
    """Get Telnyx API key from voice config, fax config, or site settings"""
    for collection_type in ["telnyx_config", "fax_config"]:
        config = await _db.system_settings.find_one({"type": collection_type}, {"_id": 0})
        if config and config.get("api_key"):
            return config["api_key"]
    config = await _db.site_settings.find_one({"type": "telnyx_config"}, {"_id": 0})
    if config and config.get("api_key"):
        return config["api_key"]
    return None


class CreateMeetingRequest(BaseModel):
    title: str
    scheduled_at: Optional[str] = None  # ISO datetime, None = instant
    duration_minutes: int = 30
    participant_emails: List[str] = []
    participant_phones: List[str] = []
    notes: Optional[str] = None
    patient_id: Optional[str] = None
    lead_id: Optional[str] = None
    doctor_id: Optional[str] = None


# ==================== MEETINGS (CRUD) ====================

@video_rooms_router.post("/meetings")
async def create_meeting(data: CreateMeetingRequest):
    """Create a video meeting — creates Telnyx room and stores meeting record"""
    api_key = await _get_telnyx_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Telnyx API key not configured. Set it in Voice or Fax settings.")

    # Create Telnyx room
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.telnyx.com/v2/rooms",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "unique_name": f"meeting-{uuid.uuid4().hex[:8]}",
                    "max_participants": 10,
                    "enable_recording": True
                }
            )
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=502, detail=f"Failed to create Telnyx room: {response.text}")
            room_data = response.json().get("data", {})
            telnyx_room_id = room_data.get("id")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Telnyx room creation error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    meeting_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    meeting = {
        "id": meeting_id,
        "telnyx_room_id": telnyx_room_id,
        "title": data.title,
        "status": "scheduled" if data.scheduled_at else "active",
        "scheduled_at": data.scheduled_at or now,
        "duration_minutes": data.duration_minutes,
        "participant_emails": data.participant_emails,
        "participant_phones": data.participant_phones,
        "notes": data.notes,
        "patient_id": data.patient_id,
        "lead_id": data.lead_id,
        "doctor_id": data.doctor_id,
        "join_url": f"/video-room/{meeting_id}",
        "created_at": now,
        "ended_at": None,
    }

    await _db.video_meetings.insert_one(meeting)

    # Send invitations
    invites_sent = await _send_invitations(meeting, api_key)

    meeting.pop("_id", None)
    return {"meeting": meeting, "invites_sent": invites_sent}


@video_rooms_router.get("/meetings")
async def list_meetings(status: Optional[str] = None, limit: int = 50):
    """List video meetings"""
    query = {}
    if status:
        query["status"] = status
    meetings = await _db.video_meetings.find(
        query, {"_id": 0}
    ).sort("scheduled_at", -1).limit(min(limit, 200)).to_list(min(limit, 200))
    return meetings


@video_rooms_router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    """Get a specific meeting"""
    meeting = await _db.video_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@video_rooms_router.post("/meetings/{meeting_id}/end")
async def end_meeting(meeting_id: str):
    """End an active meeting"""
    meeting = await _db.video_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    api_key = await _get_telnyx_api_key()
    if api_key and meeting.get("telnyx_room_id"):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(
                    f"https://api.telnyx.com/v2/rooms/{meeting['telnyx_room_id']}",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
        except Exception as e:
            logger.warning(f"Failed to delete Telnyx room: {e}")

    await _db.video_meetings.update_one(
        {"id": meeting_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Meeting ended"}


# ==================== JOIN TOKEN ====================

@video_rooms_router.post("/meetings/{meeting_id}/join-token")
async def get_join_token(meeting_id: str, data: dict = {}):
    """Generate a client token to join the video room"""
    meeting = await _db.video_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.get("status") == "ended":
        raise HTTPException(status_code=400, detail="Meeting has ended")

    api_key = await _get_telnyx_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Telnyx API key not configured")

    telnyx_room_id = meeting.get("telnyx_room_id")
    if not telnyx_room_id:
        raise HTTPException(status_code=400, detail="No Telnyx room associated")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://api.telnyx.com/v2/rooms/{telnyx_room_id}/actions/generate_join_client_token",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"token_ttl_secs": 3600, "refresh_token_ttl_secs": 86400}
            )
            if response.status_code == 200:
                token_data = response.json().get("data", {})
                return {
                    "token": token_data.get("token"),
                    "refresh_token": token_data.get("refresh_token"),
                    "room_id": telnyx_room_id,
                    "meeting": meeting
                }
            else:
                raise HTTPException(status_code=502, detail=f"Failed to get join token: {response.text}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Join token error: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# ==================== SEND INVITATIONS ====================

async def _send_invitations(meeting: dict, api_key: str) -> dict:
    """Send meeting invitations via SMS and email"""
    sent = {"sms": 0, "email": 0}
    site_settings = await _db.site_settings.find_one({"type": "site"}, {"_id": 0})
    domain = site_settings.get("site_domain", "https://mastechdme.com") if site_settings else "https://mastechdme.com"
    join_url = f"{domain}/video-room/{meeting['id']}"

    scheduled = meeting.get("scheduled_at", "")
    try:
        dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
        time_str = dt.strftime("%B %d, %Y at %I:%M %p %Z")
    except Exception:
        time_str = scheduled

    message = (
        f"You're invited to a video meeting: {meeting['title']}\n"
        f"When: {time_str}\n"
        f"Duration: {meeting['duration_minutes']} minutes\n"
        f"Join here: {join_url}\n"
    )
    if meeting.get("notes"):
        message += f"Notes: {meeting['notes']}\n"

    # Send SMS invitations
    sms_config = await _db.system_settings.find_one({"type": "sms_config"}, {"_id": 0})
    from_number = None
    if sms_config and sms_config.get("enabled") and sms_config.get("phone_number"):
        from_number = sms_config["phone_number"]

    if from_number:
        for phone in meeting.get("participant_phones", []):
            if not phone:
                continue
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        "https://api.telnyx.com/v2/messages",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={"from": from_number, "to": phone, "text": message}
                    )
                    sent["sms"] += 1
            except Exception as e:
                logger.warning(f"Failed to send SMS invite to {phone}: {e}")

    # Send email invitations (store in communications for now)
    for email in meeting.get("participant_emails", []):
        if not email:
            continue
        await _db.communications.insert_one({
            "id": str(uuid.uuid4()),
            "type": "email",
            "direction": "outbound",
            "to": email,
            "subject": f"Video Meeting Invitation: {meeting['title']}",
            "body": message,
            "meeting_id": meeting["id"],
            "status": "queued",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        sent["email"] += 1

    return sent
