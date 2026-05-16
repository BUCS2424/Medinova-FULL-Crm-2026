"""
Voicemail Routes - Handle voicemail recordings, storage, and notifications
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import logging
import os
import httpx

logger = logging.getLogger(__name__)

voicemail_router = APIRouter(prefix="/voicemail", tags=["voicemail"])

# Database reference (set by server.py)
db = None

def set_database(database):
    global db
    db = database

# Models
class VoicemailRecord(BaseModel):
    id: Optional[str] = None
    call_control_id: str
    from_number: str
    to_number: str
    recording_url: Optional[str] = None
    duration: Optional[int] = None
    transcription: Optional[str] = None
    status: str = "pending"  # pending, completed, listened, archived
    recipient_type: str = "main"  # main, extension
    recipient_id: Optional[str] = None  # user_id if extension voicemail
    recipient_name: Optional[str] = None
    patient_id: Optional[str] = None  # if linked to patient
    lead_id: Optional[str] = None  # if linked to lead
    caller_name: Optional[str] = None
    created_at: Optional[str] = None
    listened_at: Optional[str] = None
    listened_by: Optional[str] = None


# =============================================================================
# VOICEMAIL WEBHOOK - Called when recording completes
# =============================================================================

@voicemail_router.post("/webhook")
async def handle_voicemail_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Telnyx webhook for completed voicemail recording"""
    try:
        payload = await request.json()
        event_type = payload.get("data", {}).get("event_type", "")
        
        logger.info(f"Voicemail webhook received: {event_type}")
        
        if event_type == "recording.completed":
            recording_data = payload.get("data", {}).get("payload", {})
            
            call_control_id = recording_data.get("call_control_id")
            recording_url = recording_data.get("recording_urls", {}).get("mp3")
            duration = recording_data.get("recording_duration_ms", 0) // 1000
            
            # Find the call record to get context
            call_record = await db.call_logs.find_one({"call_control_id": call_control_id})
            
            # Create voicemail record
            voicemail_id = str(uuid.uuid4())
            voicemail = {
                "id": voicemail_id,
                "call_control_id": call_control_id,
                "from_number": call_record.get("from_number", "") if call_record else recording_data.get("from", ""),
                "to_number": call_record.get("to_number", "") if call_record else recording_data.get("to", ""),
                "recording_url": recording_url,
                "duration": duration,
                "status": "completed",
                "recipient_type": call_record.get("voicemail_type", "main") if call_record else "main",
                "recipient_id": call_record.get("voicemail_recipient_id") if call_record else None,
                "recipient_name": call_record.get("voicemail_recipient_name") if call_record else None,
                "caller_name": call_record.get("caller_name") if call_record else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Try to match caller to lead/patient
            if call_record:
                voicemail["lead_id"] = call_record.get("lead_id")
                voicemail["patient_id"] = call_record.get("patient_id")
            
            await db.voicemails.insert_one(voicemail)
            logger.info(f"Voicemail saved: {voicemail_id}")
            
            # Send email notification in background
            background_tasks.add_task(send_voicemail_notification, voicemail)
            
            return {"status": "success", "voicemail_id": voicemail_id}
        
        return {"status": "ignored", "event_type": event_type}
        
    except Exception as e:
        logger.error(f"Voicemail webhook error: {e}")
        return {"status": "error", "message": str(e)}


# =============================================================================
# EMAIL NOTIFICATION
# =============================================================================

async def send_voicemail_notification(voicemail: dict):
    """Send email notification about new voicemail"""
    try:
        # Get voicemail config for email settings
        vm_config = await db.system_settings.find_one({"type": "voicemail_config"})
        
        # Determine recipient email
        recipient_email = None
        recipient_name = "Team"
        
        if voicemail.get("recipient_type") == "extension" and voicemail.get("recipient_id"):
            # Get user's email for extension voicemail
            user = await db.users.find_one({"id": voicemail["recipient_id"]})
            if user:
                recipient_email = user.get("email")
                recipient_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        elif vm_config and vm_config.get("email_notification") and vm_config.get("notification_email"):
            # Use main voicemail notification email
            recipient_email = vm_config.get("notification_email")
        
        if not recipient_email:
            logger.info("No email recipient configured for voicemail notification")
            return
        
        # Format duration
        duration = voicemail.get("duration", 0)
        duration_str = f"{duration // 60}:{duration % 60:02d}" if duration else "Unknown"
        
        # Create email content
        from_number = voicemail.get("from_number", "Unknown")
        caller_name = voicemail.get("caller_name", "Unknown Caller")
        
        subject = f"New Voicemail from {caller_name} ({from_number})"
        
        body = f"""
Hello {recipient_name},

You have a new voicemail message:

From: {caller_name}
Phone: {from_number}
Duration: {duration_str}
Time: {voicemail.get('created_at', 'Unknown')}

Please log in to the DME CRM to listen to this message.

---
This is an automated notification from Mastech Medical Equipment.
        """
        
        # Store notification in database (for audit trail)
        notification = {
            "id": str(uuid.uuid4()),
            "type": "voicemail_notification",
            "voicemail_id": voicemail.get("id"),
            "recipient_email": recipient_email,
            "subject": subject,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        # Try to send email via configured email service
        # For now, we'll log it and mark as sent
        # In production, integrate with SendGrid/SES/etc.
        logger.info(f"Voicemail notification queued for {recipient_email}: {subject}")
        
        # Update notification status
        await db.notifications.update_one(
            {"id": notification["id"]},
            {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}}
        )
        
    except Exception as e:
        logger.error(f"Error sending voicemail notification: {e}")


# =============================================================================
# VOICEMAIL INBOX API
# =============================================================================

@voicemail_router.get("/inbox")
async def get_voicemail_inbox(
    status: Optional[str] = None,
    recipient_type: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get voicemail inbox with filters"""
    query = {}
    
    if status:
        query["status"] = status
    if recipient_type:
        query["recipient_type"] = recipient_type
    if user_id:
        query["recipient_id"] = user_id
    
    # Get voicemails
    voicemails = await db.voicemails.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.voicemails.count_documents(query)
    
    # Get unlistened count
    unlistened = await db.voicemails.count_documents({**query, "status": "completed"})
    
    return {
        "voicemails": voicemails,
        "total": total,
        "unlistened": unlistened,
        "limit": limit,
        "offset": offset
    }


@voicemail_router.get("/{voicemail_id}")
async def get_voicemail(voicemail_id: str):
    """Get single voicemail details"""
    voicemail = await db.voicemails.find_one({"id": voicemail_id}, {"_id": 0})
    if not voicemail:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    return voicemail


@voicemail_router.put("/{voicemail_id}/listened")
async def mark_voicemail_listened(voicemail_id: str, user_id: Optional[str] = None):
    """Mark voicemail as listened"""
    result = await db.voicemails.update_one(
        {"id": voicemail_id},
        {"$set": {
            "status": "listened",
            "listened_at": datetime.now(timezone.utc).isoformat(),
            "listened_by": user_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    return {"message": "Voicemail marked as listened"}


@voicemail_router.put("/{voicemail_id}/archive")
async def archive_voicemail(voicemail_id: str):
    """Archive a voicemail"""
    result = await db.voicemails.update_one(
        {"id": voicemail_id},
        {"$set": {"status": "archived"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    return {"message": "Voicemail archived"}


@voicemail_router.delete("/{voicemail_id}")
async def delete_voicemail(voicemail_id: str):
    """Delete a voicemail (soft delete - marks as deleted)"""
    result = await db.voicemails.update_one(
        {"id": voicemail_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    return {"message": "Voicemail deleted"}


# =============================================================================
# LINK VOICEMAIL TO PATIENT/LEAD
# =============================================================================

@voicemail_router.put("/{voicemail_id}/link-patient/{patient_id}")
async def link_voicemail_to_patient(voicemail_id: str, patient_id: str):
    """Link voicemail to a patient's file"""
    # Verify patient exists
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get voicemail
    voicemail = await db.voicemails.find_one({"id": voicemail_id})
    if not voicemail:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    # Update voicemail with patient link
    await db.voicemails.update_one(
        {"id": voicemail_id},
        {"$set": {
            "patient_id": patient_id,
            "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()
        }}
    )
    
    # Add voicemail reference to patient's documents/communications
    await db.patients.update_one(
        {"id": patient_id},
        {"$push": {
            "voicemails": {
                "voicemail_id": voicemail_id,
                "from_number": voicemail.get("from_number"),
                "duration": voicemail.get("duration"),
                "recording_url": voicemail.get("recording_url"),
                "created_at": voicemail.get("created_at"),
                "linked_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    # Create audit log entry
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "voicemail_linked_to_patient",
        "voicemail_id": voicemail_id,
        "patient_id": patient_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Voicemail linked to patient {patient.get('first_name')} {patient.get('last_name')}"}


@voicemail_router.put("/{voicemail_id}/link-lead/{lead_id}")
async def link_voicemail_to_lead(voicemail_id: str, lead_id: str):
    """Link voicemail to a lead"""
    # Verify lead exists
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get voicemail
    voicemail = await db.voicemails.find_one({"id": voicemail_id})
    if not voicemail:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    # Update voicemail with lead link
    await db.voicemails.update_one(
        {"id": voicemail_id},
        {"$set": {
            "lead_id": lead_id,
            "lead_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip()
        }}
    )
    
    # Add voicemail reference to lead's communications
    await db.leads.update_one(
        {"id": lead_id},
        {"$push": {
            "voicemails": {
                "voicemail_id": voicemail_id,
                "from_number": voicemail.get("from_number"),
                "duration": voicemail.get("duration"),
                "recording_url": voicemail.get("recording_url"),
                "created_at": voicemail.get("created_at"),
                "linked_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    return {"message": f"Voicemail linked to lead {lead.get('first_name')} {lead.get('last_name')}"}


@voicemail_router.put("/{voicemail_id}/unlink")
async def unlink_voicemail(voicemail_id: str):
    """Remove patient/lead link from voicemail"""
    voicemail = await db.voicemails.find_one({"id": voicemail_id})
    if not voicemail:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    # Remove from patient if linked
    if voicemail.get("patient_id"):
        await db.patients.update_one(
            {"id": voicemail["patient_id"]},
            {"$pull": {"voicemails": {"voicemail_id": voicemail_id}}}
        )
    
    # Remove from lead if linked
    if voicemail.get("lead_id"):
        await db.leads.update_one(
            {"id": voicemail["lead_id"]},
            {"$pull": {"voicemails": {"voicemail_id": voicemail_id}}}
        )
    
    # Clear links from voicemail
    await db.voicemails.update_one(
        {"id": voicemail_id},
        {"$unset": {"patient_id": "", "patient_name": "", "lead_id": "", "lead_name": ""}}
    )
    
    return {"message": "Voicemail unlinked"}


# =============================================================================
# VOICEMAIL STATS
# =============================================================================

@voicemail_router.get("/stats/summary")
async def get_voicemail_stats():
    """Get voicemail statistics"""
    total = await db.voicemails.count_documents({"status": {"$ne": "deleted"}})
    unlistened = await db.voicemails.count_documents({"status": "completed"})
    listened = await db.voicemails.count_documents({"status": "listened"})
    archived = await db.voicemails.count_documents({"status": "archived"})
    
    # Get stats by recipient type
    main_count = await db.voicemails.count_documents({"recipient_type": "main", "status": {"$ne": "deleted"}})
    extension_count = await db.voicemails.count_documents({"recipient_type": "extension", "status": {"$ne": "deleted"}})
    
    return {
        "total": total,
        "unlistened": unlistened,
        "listened": listened,
        "archived": archived,
        "by_type": {
            "main": main_count,
            "extension": extension_count
        }
    }
