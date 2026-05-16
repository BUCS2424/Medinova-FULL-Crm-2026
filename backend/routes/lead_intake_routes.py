"""
Lead Intake Hub routes.
API key management, external form submissions, embed script generation, and lead routing.
"""
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import logging

logger = logging.getLogger(__name__)

lead_intake_router = APIRouter(prefix="/lead-intake", tags=["lead-intake"])

_db = None

def set_database(db):
    global _db
    _db = db


# ==================== MODELS ====================

class CreateApiKeyRequest(BaseModel):
    name: str
    source_name: str
    domain_name: Optional[str] = None
    allowed_origins: List[str] = []
    rate_limit: int = 1000


class LeadSubmission(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    zip_code: Optional[str] = None
    pain_location: Optional[str] = None
    insurance_type: Optional[str] = None
    has_doctor: Optional[str] = None
    has_medicare: Optional[str] = None
    best_time_to_call: Optional[str] = None
    message: Optional[str] = None
    lead_type: Optional[str] = "healthcare"
    # Consent
    consent_contact: Optional[bool] = False
    consent_hipaa: Optional[bool] = False
    consent_insurance: Optional[bool] = False
    electronic_signature: Optional[str] = None
    # Tracking
    source_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    jornaya_lead_id: Optional[str] = None
    trustedform_cert_url: Optional[str] = None


# ==================== API KEY MANAGEMENT ====================

@lead_intake_router.get("/keys")
async def list_api_keys():
    """List all intake API keys"""
    keys = await _db.lead_intake_api_keys.find({}, {"_id": 0, "key_hash": 0}).sort("created_at", -1).to_list(100)
    return keys


@lead_intake_router.post("/keys")
async def create_api_key(data: CreateApiKeyRequest):
    """Create a new API key for external form submissions"""
    raw_key = f"vrm_{uuid.uuid4().hex}{uuid.uuid4().hex[:16]}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "source_name": data.source_name,
        "domain_name": data.domain_name,
        "key_hash": key_hash,
        "key_prefix": raw_key[:12],
        "allowed_origins": data.allowed_origins,
        "rate_limit": data.rate_limit,
        "request_count": 0,
        "lead_count": 0,
        "is_active": True,
        "created_at": now,
    }

    await _db.lead_intake_api_keys.insert_one(doc)
    doc.pop("_id", None)

    return {
        "id": doc["id"],
        "name": data.name,
        "api_key": raw_key,
        "key_prefix": doc["key_prefix"],
        "message": "Save this API key securely. It will not be shown again."
    }


@lead_intake_router.put("/keys/{key_id}/toggle")
async def toggle_api_key(key_id: str, data: dict):
    """Enable/disable an API key"""
    result = await _db.lead_intake_api_keys.update_one(
        {"id": key_id},
        {"$set": {"is_active": data.get("is_active", True), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"message": "Key updated"}


@lead_intake_router.delete("/keys/{key_id}")
async def delete_api_key(key_id: str):
    """Delete an API key"""
    result = await _db.lead_intake_api_keys.delete_one({"id": key_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"message": "Key deleted"}


# ==================== LEAD SUBMISSION (PUBLIC) ====================

@lead_intake_router.post("/submit")
async def submit_lead(data: LeadSubmission, request: Request, x_api_key: Optional[str] = Header(None)):
    """Public endpoint — submit a lead from an external form. Requires X-API-Key header."""
    if not x_api_key or not x_api_key.startswith("vrm_"):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    # Validate key
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    key_doc = await _db.lead_intake_api_keys.find_one({"key_hash": key_hash, "is_active": True}, {"_id": 0})
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    # Rate limit check
    rate_limit = key_doc.get("rate_limit", 1000)
    hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent_count = await _db.intake_leads.count_documents({
        "source_key_id": key_doc["id"],
        "created_at": {"$gte": hour_ago}
    })
    if recent_count >= rate_limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Origin check
    origin = request.headers.get("origin", "")
    allowed = key_doc.get("allowed_origins", [])
    if allowed and origin and not any(origin.endswith(o) for o in allowed):
        raise HTTPException(status_code=403, detail="Origin not allowed")

    # Capture IP
    ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
         request.headers.get("X-Real-IP") or \
         (request.client.host if request.client else "unknown")

    # Normalize phone
    phone = "".join(filter(str.isdigit, data.phone or ""))[-10:]

    # Duplicate check (same email or phone in last 24h)
    day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    is_duplicate = False
    if data.email or phone:
        dup_query = {"created_at": {"$gte": day_ago}, "$or": []}
        if data.email:
            dup_query["$or"].append({"email": data.email.lower().strip()})
        if phone:
            dup_query["$or"].append({"phone": phone})
        if dup_query["$or"]:
            existing = await _db.intake_leads.find_one(dup_query, {"_id": 0, "id": 1})
            is_duplicate = existing is not None

    now = datetime.now(timezone.utc).isoformat()
    confirmation_id = f"VRM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    lead = {
        "id": str(uuid.uuid4()),
        "confirmation_id": confirmation_id,
        "source_key_id": key_doc["id"],
        "source_name": key_doc.get("source_name", ""),
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "phone": phone,
        "email": (data.email or "").lower().strip(),
        "zip_code": data.zip_code or "",
        "pain_location": data.pain_location,
        "insurance_type": data.insurance_type,
        "has_doctor": data.has_doctor,
        "has_medicare": data.has_medicare,
        "best_time_to_call": data.best_time_to_call,
        "message": data.message,
        "lead_type": data.lead_type or "healthcare",
        "consent_contact": data.consent_contact,
        "consent_hipaa": data.consent_hipaa,
        "consent_insurance": data.consent_insurance,
        "electronic_signature": data.electronic_signature,
        "source_url": data.source_url,
        "utm_source": data.utm_source,
        "utm_medium": data.utm_medium,
        "utm_campaign": data.utm_campaign,
        "jornaya_lead_id": data.jornaya_lead_id,
        "trustedform_cert_url": data.trustedform_cert_url,
        "ip_address": ip,
        "user_agent": request.headers.get("User-Agent"),
        "is_duplicate": is_duplicate,
        "status": "new",
        "created_at": now,
    }

    await _db.intake_leads.insert_one(lead)

    # Update key stats
    await _db.lead_intake_api_keys.update_one(
        {"id": key_doc["id"]},
        {"$inc": {"request_count": 1, "lead_count": 1}, "$set": {"last_request_at": now}}
    )

    # Also create in main leads collection for CRM
    crm_lead = {
        "id": lead["id"],
        "first_name": lead["first_name"],
        "last_name": lead["last_name"],
        "phone": lead["phone"],
        "email": lead["email"],
        "zip_code": lead["zip_code"],
        "pain_location": lead["pain_location"],
        "insurance_type": lead["insurance_type"],
        "has_doctor": lead["has_doctor"],
        "form_source": f"intake:{key_doc.get('source_name', '')}",
        "utm_source": lead["utm_source"] or key_doc.get("source_name"),
        "utm_medium": lead["utm_medium"] or "external_form",
        "utm_campaign": lead["utm_campaign"],
        "consent_contact": lead["consent_contact"],
        "consent_hipaa": lead["consent_hipaa"],
        "consent_insurance": lead["consent_insurance"],
        "electronic_signature": lead["electronic_signature"],
        "status": "opportunity",
        "notes": f"External form: {key_doc.get('source_name', '')} | Confirmation: {confirmation_id}",
        "created_at": now,
        "updated_at": now,
        "created_by": "lead_intake_api",
    }
    await _db.leads.insert_one(crm_lead)

    return {
        "success": True,
        "confirmation_id": confirmation_id,
        "is_duplicate": is_duplicate,
        "message": "Lead received successfully"
    }


# ==================== STATS ====================

@lead_intake_router.get("/stats")
async def get_intake_stats():
    """Get lead intake statistics"""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    return {
        "total": await _db.intake_leads.count_documents({}),
        "today": await _db.intake_leads.count_documents({"created_at": {"$gte": today}}),
        "this_week": await _db.intake_leads.count_documents({"created_at": {"$gte": week_ago}}),
        "this_month": await _db.intake_leads.count_documents({"created_at": {"$gte": month_ago}}),
        "duplicates": await _db.intake_leads.count_documents({"is_duplicate": True}),
        "active_keys": await _db.lead_intake_api_keys.count_documents({"is_active": True}),
    }


# ==================== EMBED SCRIPT (PUBLIC) ====================

@lead_intake_router.get("/embed.js")
async def get_embed_script(key: str = ""):
    """Public — returns a JavaScript file that injects the lead form into any page"""
    if not key:
        return Response(content="// Missing API key parameter", media_type="application/javascript")

    # Get site settings for domain
    site_settings = await _db.site_settings.find_one({"type": "site"}, {"_id": 0})
    domain = site_settings.get("site_domain", "") if site_settings else ""
    if not domain:
        domain = "https://mastechdme.com"

    js = f'''(function(){{
  var API_URL = "{domain}/api/lead-intake/submit";
  var API_KEY = "{key}";

  function injectForm(container) {{
    container.innerHTML = '<div style="font-family:Inter,system-ui,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">' +
      '<h2 style="font-size:20px;font-weight:700;margin:0 0 4px;color:#1e293b">Check Your Eligibility</h2>' +
      '<p style="font-size:13px;color:#64748b;margin:0 0 16px">Answer a few questions to see if you qualify for Medicare-covered equipment.</p>' +
      '<form id="vrm-lead-form" style="display:flex;flex-direction:column;gap:12px">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<input name="first_name" required placeholder="First Name" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">' +
          '<input name="last_name" required placeholder="Last Name" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">' +
        '</div>' +
        '<input name="phone" type="tel" required placeholder="Phone Number" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">' +
        '<input name="email" type="email" placeholder="Email Address" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">' +
        '<input name="zip_code" placeholder="ZIP Code" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">' +
        '<select name="pain_location" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;color:#64748b">' +
          '<option value="">Where is your pain?</option>' +
          '<option value="back">Back</option><option value="knee">Knee</option><option value="wrist">Wrist</option><option value="shoulder">Shoulder</option><option value="other">Other</option>' +
        '</select>' +
        '<select name="insurance_type" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;color:#64748b">' +
          '<option value="">Insurance Type</option>' +
          '<option value="medicare">Medicare</option><option value="private_ppo">Private PPO</option><option value="medicaid">Medicaid</option><option value="other">Other</option>' +
        '</select>' +
        '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;font-size:11px;color:#1e40af">' +
          '<label style="display:flex;align-items:start;gap:6px;margin-bottom:6px;cursor:pointer"><input type="checkbox" name="consent_contact" required style="margin-top:2px"><span><b>Consent to Contact:</b> I consent to be contacted via phone, text, or email regarding my equipment request.</span></label>' +
          '<label style="display:flex;align-items:start;gap:6px;margin-bottom:6px;cursor:pointer"><input type="checkbox" name="consent_hipaa" required style="margin-top:2px"><span><b>HIPAA / PHI Permission:</b> I authorize sharing my health information with my physician and insurance company.</span></label>' +
          '<label style="display:flex;align-items:start;gap:6px;cursor:pointer"><input type="checkbox" name="consent_insurance" required style="margin-top:2px"><span><b>Insurance Understanding:</b> I understand coverage is subject to verification and I may be responsible for uncovered costs.</span></label>' +
          '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #bfdbfe"><input name="electronic_signature" required placeholder="Type your full legal name as e-signature" style="width:100%;padding:8px;border:1px solid #93c5fd;border-radius:6px;font-size:12px;outline:none;box-sizing:border-box"></div>' +
        '</div>' +
        '<button type="submit" style="padding:12px;background:linear-gradient(to right,#f59e0b,#f97316);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Check My Eligibility</button>' +
        '<input type="hidden" name="source_url" value="' + window.location.href + '">' +
      '</form>' +
      '<div id="vrm-success" style="display:none;text-align:center;padding:24px"><div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="24" height="24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div><h3 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 8px">Thank You!</h3><p style="font-size:13px;color:#64748b;margin:0">A specialist will contact you within 24 hours.</p></div>' +
    '</div>';

    document.getElementById("vrm-lead-form").addEventListener("submit", function(e) {{
      e.preventDefault();
      var form = e.target;
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Submitting...";

      var fd = new FormData(form);
      var body = {{}};
      fd.forEach(function(v, k) {{ body[k] = v; }});
      body.consent_contact = !!form.consent_contact.checked;
      body.consent_hipaa = !!form.consent_hipaa.checked;
      body.consent_insurance = !!form.consent_insurance.checked;

      // Capture Jornaya/TrustedForm tokens if present
      var jornaya = document.getElementById("leadid_token");
      if (jornaya && jornaya.value) body.jornaya_lead_id = jornaya.value;
      var tf = document.getElementById("xxTrustedFormCertUrl_0");
      if (tf && tf.value) body.trustedform_cert_url = tf.value;

      fetch(API_URL, {{
        method: "POST",
        headers: {{ "Content-Type": "application/json", "X-API-Key": API_KEY }},
        body: JSON.stringify(body)
      }})
      .then(function(r) {{ return r.json(); }})
      .then(function(d) {{
        if (d.success) {{
          form.style.display = "none";
          document.getElementById("vrm-success").style.display = "block";
        }} else {{
          alert(d.detail || "Error submitting. Please try again.");
          btn.disabled = false; btn.textContent = "Check My Eligibility";
        }}
      }})
      .catch(function() {{
        alert("Submission failed. Please try again.");
        btn.disabled = false; btn.textContent = "Check My Eligibility";
      }});
    }});
  }}

  // Auto-inject into #lead-form container if it exists
  var container = document.getElementById("lead-form") || document.getElementById("vrm-form");
  if (container) {{ injectForm(container); }}
}})();'''

    return Response(content=js, media_type="application/javascript", headers={"Cache-Control": "public, max-age=3600"})


# ==================== ALIASED ROUTES (match original component paths) ====================

@lead_intake_router.get("/api-keys")
async def list_api_keys_alias():
    """Alias for /keys — matches original component"""
    keys = await _db.lead_intake_api_keys.find({}, {"_id": 0, "key_hash": 0}).sort("created_at", -1).to_list(100)
    return {"api_keys": keys}


@lead_intake_router.post("/api-keys")
async def create_api_key_alias(data: CreateApiKeyRequest):
    """Alias for /keys — matches original component"""
    return await create_api_key(data)


@lead_intake_router.delete("/api-keys/{key_id}")
async def delete_api_key_alias(key_id: str):
    """Alias for /keys/{key_id}"""
    return await delete_api_key(key_id)


# ==================== DOMAINS ====================

@lead_intake_router.get("/domains")
async def list_domains():
    """List tracked domains"""
    domains = await _db.lead_intake_domains.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"domains": domains}


@lead_intake_router.post("/domains")
async def add_domain(data: dict):
    """Add a domain for tracking"""
    domain = data.get("domain", "").strip().lower()
    if not domain:
        raise HTTPException(status_code=400, detail="Domain is required")

    existing = await _db.lead_intake_domains.find_one({"domain": domain})
    if existing:
        raise HTTPException(status_code=400, detail="Domain already exists")

    doc = {
        "id": str(uuid.uuid4()),
        "domain": domain,
        "analytics_url": f"https://a2ganalytics.com/{domain}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.lead_intake_domains.insert_one(doc)
    doc.pop("_id", None)
    return doc


@lead_intake_router.delete("/domains/{domain_id}")
async def delete_domain(domain_id: str):
    """Remove a tracked domain"""
    result = await _db.lead_intake_domains.delete_one({"id": domain_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Domain not found")
    return {"message": "Domain deleted"}


# ==================== LEADS LIST ====================

@lead_intake_router.get("/leads")
async def list_intake_leads(
    status: Optional[str] = None,
    lead_type: Optional[str] = None,
    state: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    limit: int = 100
):
    """List intake leads with filters"""
    query = {}
    if status and status != "all":
        query["status"] = status
    if lead_type and lead_type != "all":
        query["lead_type"] = lead_type
    if state:
        query["state"] = state.upper()
    if is_duplicate is not None:
        query["is_duplicate"] = is_duplicate

    leads = await _db.intake_leads.find(query, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(min(limit, 500))
    return {"leads": leads}


# ==================== DUPLICATES ====================

@lead_intake_router.get("/duplicates")
async def list_duplicates(limit: int = 100):
    """List duplicate leads"""
    dupes = await _db.intake_leads.find(
        {"is_duplicate": True}, {"_id": 0}
    ).sort("created_at", -1).limit(min(limit, 500)).to_list(min(limit, 500))
    return {"duplicates": dupes}
