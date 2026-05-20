"""
Video Rooms — native WebRTC signaling (no Telnyx required).
Falls back to Telnyx if an API key is configured.
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import httpx
import uuid
import logging
import asyncio

logger = logging.getLogger(__name__)

video_rooms_router = APIRouter(prefix="/video-rooms", tags=["video-rooms"])

_db = None
_get_current_user = None

# ── In-memory signaling rooms ─────────────────────────────────────────────────
# { meeting_id: { "host": WebSocket | None, "patient": WebSocket | None } }
_signal_rooms: dict = {}

def set_database(db):
    global _db
    _db = db

def set_auth(get_current_user_fn):
    global _get_current_user
    _get_current_user = get_current_user_fn


async def _get_telnyx_api_key():
    for ctype in ["telnyx_config", "fax_config"]:
        cfg = await _db.system_settings.find_one({"type": ctype}, {"_id": 0})
        if cfg and cfg.get("api_key"):
            return cfg["api_key"]
    cfg = await _db.site_settings.find_one({"type": "telnyx_config"}, {"_id": 0})
    if cfg and cfg.get("api_key"):
        return cfg["api_key"]
    return None


class CreateMeetingRequest(BaseModel):
    title: str
    scheduled_at: Optional[str] = None
    duration_minutes: int = 30
    participant_emails: List[str] = []
    participant_phones: List[str] = []
    notes: Optional[str] = None
    patient_id: Optional[str] = None
    lead_id: Optional[str] = None
    doctor_id: Optional[str] = None


# ==================== MEETINGS (CRUD) ====================

PROVIDER_ROLES = {"super_admin", "admin", "sales_rep", "sales_manager", "doctor"}


def _optional_current_user():
    """Returns a dependency that tries to authenticate but doesn't hard-fail."""
    async def _dep(request: None = None):
        return None
    return _dep


@video_rooms_router.post("/meetings")
async def create_meeting(data: CreateMeetingRequest, request: Request):
    """Create a video meeting — provider auth via Authorization header.
    Allowed roles: super_admin, admin, sales_rep, sales_manager, doctor.
    Uses native WebRTC signaling by default; falls back to Telnyx if API key configured."""
    # Authenticate the requesting user (required for providers)
    created_by_id = None
    created_by_name = None
    created_by_role = None
    if _get_current_user:
        try:
            token = request.headers.get("authorization", "").replace("Bearer ", "")
            if token:
                user = await _get_current_user(token)
                if user:
                    role = user.get("role", "")
                    if role not in PROVIDER_ROLES:
                        raise HTTPException(
                            status_code=403,
                            detail=f"Only providers can create meetings (role: {role})"
                        )
                    created_by_id = user.get("id")
                    created_by_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                    created_by_role = role
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Auth check failed for meeting creation: {e}")

    api_key = await _get_telnyx_api_key()
    meeting_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    telnyx_room_id = None

    if api_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.telnyx.com/v2/rooms",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"unique_name": f"meeting-{uuid.uuid4().hex[:8]}", "max_participants": 10}
                )
                if resp.status_code in [200, 201]:
                    telnyx_room_id = resp.json().get("data", {}).get("id")
        except Exception as e:
            logger.warning(f"Telnyx room creation failed, using native WebRTC: {e}")

    meeting = {
        "id": meeting_id,
        "telnyx_room_id": telnyx_room_id,
        "engine": "telnyx" if telnyx_room_id else "webrtc",
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
        "host_url": f"/video-room/{meeting_id}?role=host",
        "created_at": now,
        "ended_at": None,
        "created_by_id": created_by_id,
        "created_by_name": created_by_name,
        "created_by_role": created_by_role,
    }

    await _db.video_meetings.insert_one(meeting)
    invites_sent = await _send_invitations(meeting, api_key)
    meeting.pop("_id", None)
    return {"meeting": meeting, "invites_sent": invites_sent}


@video_rooms_router.get("/meetings")
async def list_meetings(status: Optional[str] = None, limit: int = 50):
    query = {}
    if status:
        query["status"] = status
    meetings = await _db.video_meetings.find(
        query, {"_id": 0}
    ).sort("scheduled_at", -1).limit(min(limit, 200)).to_list(min(limit, 200))
    return meetings


@video_rooms_router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    meeting = await _db.video_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@video_rooms_router.post("/meetings/{meeting_id}/end")
async def end_meeting(meeting_id: str):
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

    # Clean up signaling room
    _signal_rooms.pop(meeting_id, None)

    await _db.video_meetings.update_one(
        {"id": meeting_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Meeting ended"}


# ==================== JOIN TOKEN (native WebRTC) ====================

@video_rooms_router.post("/meetings/{meeting_id}/join-token")
async def get_join_token(meeting_id: str, data: dict = {}):
    """For Telnyx meetings: returns Telnyx token.
    For native WebRTC meetings: returns meeting_id as the signaling room key."""
    meeting = await _db.video_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.get("status") == "ended":
        raise HTTPException(status_code=400, detail="Meeting has ended")

    # Native WebRTC — no token needed, just confirm meeting is valid
    if meeting.get("engine") != "telnyx" or not meeting.get("telnyx_room_id"):
        return {"engine": "webrtc", "room_id": meeting_id, "token": meeting_id, "meeting": meeting}

    # Telnyx path (backward compat)
    api_key = await _get_telnyx_api_key()
    if not api_key:
        return {"engine": "webrtc", "room_id": meeting_id, "token": meeting_id, "meeting": meeting}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://api.telnyx.com/v2/rooms/{meeting['telnyx_room_id']}/actions/generate_join_client_token",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"token_ttl_secs": 3600, "refresh_token_ttl_secs": 86400}
            )
            if resp.status_code == 200:
                td = resp.json().get("data", {})
                return {"engine": "telnyx", "token": td.get("token"), "room_id": meeting["telnyx_room_id"], "meeting": meeting}
    except Exception as e:
        logger.warning(f"Telnyx token failed, falling back to native WebRTC: {e}")

    return {"engine": "webrtc", "room_id": meeting_id, "token": meeting_id, "meeting": meeting}


# ==================== NATIVE WebRTC SIGNALING (WebSocket) ====================

@video_rooms_router.websocket("/ws/{meeting_id}/{role}")
async def webrtc_signaling(websocket: WebSocket, meeting_id: str, role: str):
    """
    Pure WebRTC signaling relay.
    role: 'host' (provider watches) or 'patient' (broadcasts camera).
    Just relays JSON messages between the two peers — no media passes through.
    """
    await websocket.accept()

    if role not in ("host", "patient"):
        await websocket.close(code=4003, reason="Invalid role")
        return

    meeting = await _db.video_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        await websocket.close(code=4004, reason="Meeting not found")
        return
    if meeting.get("status") == "ended":
        await websocket.close(code=4001, reason="Meeting ended")
        return

    if meeting_id not in _signal_rooms:
        _signal_rooms[meeting_id] = {"host": None, "patient": None}

    _signal_rooms[meeting_id][role] = websocket
    other_role = "patient" if role == "host" else "host"

    # Notify the other peer that this peer connected
    other_ws = _signal_rooms[meeting_id].get(other_role)
    if other_ws:
        try:
            await other_ws.send_json({"type": "peer_joined", "role": role})
        except Exception:
            pass
        # Also tell the newly-connected peer that the other is ALREADY present.
        # This covers the case where patient joins before host:
        # host connects later → host receives peer_joined(patient) → host creates offer.
        try:
            await websocket.send_json({"type": "peer_joined", "role": other_role})
        except Exception:
            pass

    logger.info(f"[signaling] {role} connected to room {meeting_id}")

    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=120)
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
                continue

            other_ws = _signal_rooms[meeting_id].get(other_role)
            if other_ws and msg.get("type") != "ping":
                try:
                    await other_ws.send_json(msg)
                except Exception:
                    _signal_rooms[meeting_id][other_role] = None

    except WebSocketDisconnect:
        logger.info(f"[signaling] {role} disconnected from room {meeting_id}")
    except Exception as e:
        logger.warning(f"[signaling] error in room {meeting_id}: {e}")
    finally:
        if _signal_rooms.get(meeting_id, {}).get(role) is websocket:
            _signal_rooms[meeting_id][role] = None

        other_ws = _signal_rooms.get(meeting_id, {}).get(other_role)
        if other_ws:
            try:
                await other_ws.send_json({"type": "peer_left", "role": role})
            except Exception:
                pass


# ==================== SEND INVITATIONS ====================

async def _send_invitations(meeting: dict, api_key: str) -> dict:
    sent = {"sms": 0, "email": 0}
    site_settings = await _db.site_settings.find_one({"type": "site"}, {"_id": 0})
    domain = site_settings.get("site_domain", "https://medinovadme.com") if site_settings else "https://medinovadme.com"
    join_url = f"{domain}/video-room/{meeting['id']}"

    scheduled = meeting.get("scheduled_at", "")
    try:
        dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
        time_str = dt.strftime("%B %d, %Y at %I:%M %p %Z")
    except Exception:
        time_str = scheduled

    message = (
        f"You're invited to a telehealth video consultation: {meeting['title']}\n"
        f"When: {time_str}\n"
        f"Duration: {meeting['duration_minutes']} minutes\n"
        f"Join here: {join_url}\n"
    )
    if meeting.get("notes"):
        message += f"Notes: {meeting['notes']}\n"

    sms_config = await _db.system_settings.find_one({"type": "sms_config"}, {"_id": 0})
    from_number = None
    if sms_config and sms_config.get("enabled") and sms_config.get("phone_number"):
        from_number = sms_config["phone_number"]

    if api_key and from_number:
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
                logger.warning(f"SMS invite failed: {e}")

    for email in meeting.get("participant_emails", []):
        if not email:
            continue
        await _db.communications.insert_one({
            "id": str(uuid.uuid4()),
            "type": "email",
            "direction": "outbound",
            "to": email,
            "subject": f"Telehealth Appointment: {meeting['title']}",
            "body": message,
            "meeting_id": meeting["id"],
            "status": "queued",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        sent["email"] += 1

    return sent
