"""
Patient Documents Routes
Handles patient document templates, assignments, e-signatures, and auto-assignment rules
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import json
import os
import logging
import secrets

logger = logging.getLogger(__name__)

patient_docs_router = APIRouter(prefix="/patient-documents", tags=["patient-documents"])
security = HTTPBearer()

# Database reference (set by main app)
db = None

def set_database(database):
    global db
    db = database

# =============================================================================
# MODELS
# =============================================================================

class DocumentCategory(str, Enum):
    INTAKE = "intake"
    HIPAA = "hipaa"
    INSURANCE = "insurance"
    EQUIPMENT = "equipment"
    COMPLIANCE = "compliance"
    FINANCIAL = "financial"
    DELIVERY = "delivery"
    OTHER = "other"

class AssignmentStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    VIEWED = "viewed"
    SIGNED = "signed"
    EXPIRED = "expired"

class PatientDocTemplate(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: DocumentCategory = DocumentCategory.OTHER
    content: str  # HTML template with {{variables}}
    order: int = 0
    is_required: bool = True
    is_active: bool = True
    auto_assign: bool = False  # Auto-assign to new patients
    auto_assign_rules: Optional[Dict] = None  # Rules for auto-assignment
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class PatientDocTemplateCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: DocumentCategory = DocumentCategory.OTHER
    content: str
    order: Optional[int] = 0
    is_required: bool = True
    is_active: bool = True
    auto_assign: bool = False
    auto_assign_rules: Optional[Dict] = None

class PatientDocTemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[DocumentCategory] = None
    content: Optional[str] = None
    order: Optional[int] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    auto_assign: Optional[bool] = None
    auto_assign_rules: Optional[Dict] = None

class PatientDocAssignment(BaseModel):
    id: Optional[str] = None
    template_id: str
    template_title: str
    patient_id: str
    patient_name: str
    patient_email: str
    assigned_by: str
    assigned_by_name: str
    filled_content: str
    status: AssignmentStatus = AssignmentStatus.PENDING
    signature_data: Optional[str] = None
    signed_by_name: Optional[str] = None
    signed_at: Optional[str] = None
    pdf_url: Optional[str] = None
    email_token: Optional[str] = None  # For email signing link
    email_token_expires: Optional[str] = None
    sent_at: Optional[str] = None
    viewed_at: Optional[str] = None
    created_at: Optional[str] = None

class AssignDocumentsRequest(BaseModel):
    patient_id: str
    template_ids: List[str]
    send_email: bool = False

class SignDocumentRequest(BaseModel):
    assignment_id: str
    signature_data: str
    signed_by_name: str

class AutoAssignRule(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    template_ids: List[str]  # Templates to auto-assign
    conditions: Dict  # e.g., {"insurance_type": ["Medicare", "Medicaid"], "equipment_type": ["CPAP"]}
    is_active: bool = True
    priority: int = 0

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT and get current user"""
    import jwt
    token = credentials.credentials
    try:
        payload = jwt.decode(token, os.environ.get("JWT_SECRET", "your-secret-key"), algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_staff(user: dict = Depends(get_current_user)):
    """Require admin, super_admin, or sales role"""
    if user.get("role") not in ["admin", "super_admin", "owner", "sales", "staff"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    return user

async def require_admin(user: dict = Depends(get_current_user)):
    """Require admin or super admin role"""
    if user.get("role") not in ["admin", "super_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_patient(patient_id: str):
    """Get patient by ID"""
    if db is None:
        return None
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return patient

def fill_patient_template(template_content: str, patient: dict, extra_vars: dict = None) -> str:
    """Replace template variables with patient data"""
    content = template_content
    
    # Patient variables
    replacements = {
        "{{patient_name}}": f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip(),
        "{{patient_first_name}}": patient.get("first_name", ""),
        "{{patient_last_name}}": patient.get("last_name", ""),
        "{{patient_dob}}": patient.get("date_of_birth", ""),
        "{{patient_phone}}": patient.get("phone", ""),
        "{{patient_email}}": patient.get("email", ""),
        "{{patient_address}}": patient.get("address", ""),
        "{{patient_city}}": patient.get("city", ""),
        "{{patient_state}}": patient.get("state", ""),
        "{{patient_zip}}": patient.get("zip_code", ""),
        "{{patient_full_address}}": f"{patient.get('address', '')}, {patient.get('city', '')}, {patient.get('state', '')} {patient.get('zip_code', '')}",
        "{{patient_insurance}}": patient.get("insurance_provider", ""),
        "{{patient_insurance_id}}": patient.get("insurance_id", ""),
        "{{patient_medicare_id}}": patient.get("medicare_id", ""),
        "{{patient_medicaid_id}}": patient.get("medicaid_id", ""),
        "{{current_date}}": datetime.now(timezone.utc).strftime("%B %d, %Y"),
        "{{current_year}}": str(datetime.now(timezone.utc).year),
    }
    
    # Extra variables (e.g., signer info)
    if extra_vars:
        for key, value in extra_vars.items():
            replacements[f"{{{{{key}}}}}"] = value or ""
    
    for var, value in replacements.items():
        content = content.replace(var, value or "")
    
    return content

def generate_email_token():
    """Generate secure token for email signing link"""
    return secrets.token_urlsafe(32)

# =============================================================================
# TEMPLATE MANAGEMENT ENDPOINTS
# =============================================================================

@patient_docs_router.get("/templates")
async def list_patient_templates(
    category: Optional[str] = None,
    user: dict = Depends(require_staff)
):
    """Get all patient document templates"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    
    templates = await db.patient_doc_templates.find(
        query,
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Group by category
    by_category = {}
    for t in templates:
        cat = t.get("category", "other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(t)
    
    return {"templates": templates, "by_category": by_category, "total": len(templates)}

@patient_docs_router.get("/templates/all")
async def list_all_patient_templates(user: dict = Depends(require_admin)):
    """Get all templates including inactive (admin only)"""
    templates = await db.patient_doc_templates.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"templates": templates, "total": len(templates)}

@patient_docs_router.post("/templates")
async def create_patient_template(template: PatientDocTemplateCreate, user: dict = Depends(require_admin)):
    """Create a new patient document template"""
    template_id = str(uuid.uuid4())
    
    # Get next order number
    last_template = await db.patient_doc_templates.find_one({}, sort=[("order", -1)])
    next_order = (last_template.get("order", 0) + 1) if last_template else 1
    
    template_dict = template.dict()
    template_dict["id"] = template_id
    template_dict["order"] = template.order if template.order > 0 else next_order
    template_dict["created_by"] = user.get("id")
    template_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    template_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.patient_doc_templates.insert_one(template_dict)
    
    logger.info(f"Patient doc template created: {template.title} by {user.get('email')}")
    
    return {"id": template_id, "message": "Template created"}

@patient_docs_router.get("/templates/{template_id}")
async def get_patient_template(template_id: str, user: dict = Depends(require_staff)):
    """Get a specific template"""
    template = await db.patient_doc_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@patient_docs_router.put("/templates/{template_id}")
async def update_patient_template(template_id: str, update: PatientDocTemplateUpdate, user: dict = Depends(require_admin)):
    """Update a patient document template"""
    existing = await db.patient_doc_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.patient_doc_templates.update_one(
        {"id": template_id},
        {"$set": update_dict}
    )
    
    logger.info(f"Patient template updated: {template_id}")
    
    return {"message": "Template updated"}

@patient_docs_router.delete("/templates/{template_id}")
async def delete_patient_template(template_id: str, user: dict = Depends(require_admin)):
    """Soft delete a template"""
    existing = await db.patient_doc_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await db.patient_doc_templates.update_one(
        {"id": template_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"Patient template deleted: {template_id}")
    
    return {"message": "Template deleted"}

@patient_docs_router.post("/templates/reorder")
async def reorder_patient_templates(template_ids: List[str], user: dict = Depends(require_admin)):
    """Reorder templates"""
    for idx, template_id in enumerate(template_ids):
        await db.patient_doc_templates.update_one(
            {"id": template_id},
            {"$set": {"order": idx + 1, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Templates reordered"}

# =============================================================================
# DOCUMENT ASSIGNMENT ENDPOINTS
# =============================================================================

@patient_docs_router.post("/assign")
async def assign_documents_to_patient(request: AssignDocumentsRequest, user: dict = Depends(require_staff)):
    """Assign documents to a patient"""
    patient = await get_patient(request.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    assignments = []
    
    for template_id in request.template_ids:
        template = await db.patient_doc_templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            continue
        
        # Check if already assigned
        existing = await db.patient_doc_assignments.find_one({
            "template_id": template_id,
            "patient_id": request.patient_id,
            "status": {"$in": ["pending", "sent", "viewed"]}
        })
        if existing:
            continue  # Skip if already assigned and not signed
        
        # Fill template with patient data
        filled_content = fill_patient_template(template.get("content", ""), patient)
        
        # Create assignment
        assignment_id = str(uuid.uuid4())
        email_token = generate_email_token() if request.send_email else None
        token_expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat() if email_token else None
        
        assignment = {
            "id": assignment_id,
            "template_id": template_id,
            "template_title": template.get("title"),
            "template_category": template.get("category"),
            "patient_id": request.patient_id,
            "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip(),
            "patient_email": patient.get("email", ""),
            "assigned_by": user.get("id"),
            "assigned_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "filled_content": filled_content,
            "status": AssignmentStatus.SENT.value if request.send_email else AssignmentStatus.PENDING.value,
            "email_token": email_token,
            "email_token_expires": token_expires,
            "sent_at": datetime.now(timezone.utc).isoformat() if request.send_email else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.patient_doc_assignments.insert_one(assignment)
        assignments.append(assignment)
        
        # TODO: Send email if requested
        if request.send_email and patient.get("email"):
            # Email sending logic here
            pass
    
    logger.info(f"Assigned {len(assignments)} documents to patient {request.patient_id}")
    
    return {
        "message": f"Assigned {len(assignments)} documents",
        "assignments": [{"id": a["id"], "title": a["template_title"]} for a in assignments]
    }

@patient_docs_router.get("/patient/{patient_id}")
async def get_patient_documents(patient_id: str, user: dict = Depends(require_staff)):
    """Get all documents assigned to a patient"""
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    assignments = await db.patient_doc_assignments.find(
        {"patient_id": patient_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Separate by status
    pending = [a for a in assignments if a.get("status") in ["pending", "sent", "viewed"]]
    signed = [a for a in assignments if a.get("status") == "signed"]
    
    return {
        "patient": patient,
        "assignments": assignments,
        "pending": pending,
        "signed": signed,
        "pending_count": len(pending),
        "signed_count": len(signed)
    }

@patient_docs_router.get("/assignment/{assignment_id}")
async def get_assignment_details(assignment_id: str, user: dict = Depends(require_staff)):
    """Get details of a specific assignment"""
    assignment = await db.patient_doc_assignments.find_one({"id": assignment_id}, {"_id": 0})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment

@patient_docs_router.delete("/assignment/{assignment_id}")
async def cancel_assignment(assignment_id: str, user: dict = Depends(require_staff)):
    """Cancel a pending document assignment"""
    assignment = await db.patient_doc_assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.get("status") == "signed":
        raise HTTPException(status_code=400, detail="Cannot cancel signed document")
    
    await db.patient_doc_assignments.delete_one({"id": assignment_id})
    
    return {"message": "Assignment cancelled"}

# =============================================================================
# PATIENT SIGNING ENDPOINTS (Portal)
# =============================================================================

@patient_docs_router.get("/my-documents")
async def get_my_documents(user: dict = Depends(get_current_user)):
    """Get documents assigned to current patient user"""
    # Find patient by email
    patient = await db.patients.find_one({"email": user.get("email")}, {"_id": 0})
    if not patient:
        return {"assignments": [], "pending": [], "signed": []}
    
    assignments = await db.patient_doc_assignments.find(
        {"patient_id": patient.get("id")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    pending = [a for a in assignments if a.get("status") in ["pending", "sent", "viewed"]]
    signed = [a for a in assignments if a.get("status") == "signed"]
    
    return {
        "assignments": assignments,
        "pending": pending,
        "signed": signed,
        "pending_count": len(pending),
        "signed_count": len(signed)
    }

@patient_docs_router.post("/sign")
async def sign_patient_document(request: SignDocumentRequest, user: dict = Depends(get_current_user)):
    """Sign a patient document (portal)"""
    assignment = await db.patient_doc_assignments.find_one({"id": request.assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify user can sign this document
    patient = await db.patients.find_one({"email": user.get("email")}, {"_id": 0})
    if not patient or patient.get("id") != assignment.get("patient_id"):
        raise HTTPException(status_code=403, detail="Not authorized to sign this document")
    
    if assignment.get("status") == "signed":
        raise HTTPException(status_code=400, detail="Document already signed")
    
    # Update with signature
    update_data = {
        "status": AssignmentStatus.SIGNED.value,
        "signature_data": request.signature_data,
        "signed_by_name": request.signed_by_name,
        "signed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Generate PDF
    try:
        pdf_result = await generate_patient_doc_pdf(assignment, request.signature_data, request.signed_by_name)
        update_data["pdf_url"] = pdf_result.get("url")
        update_data["pdf_filename"] = pdf_result.get("filename")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
    
    await db.patient_doc_assignments.update_one(
        {"id": request.assignment_id},
        {"$set": update_data}
    )
    
    logger.info(f"Patient document signed: {assignment.get('template_title')} by {user.get('email')}")
    
    return {"message": "Document signed successfully", "pdf_url": update_data.get("pdf_url")}

# =============================================================================
# EMAIL SIGNING ENDPOINTS (No Login Required)
# =============================================================================

@patient_docs_router.get("/sign-by-email/{token}")
async def get_document_for_email_signing(token: str):
    """Get document for email-based signing (no auth required)"""
    assignment = await db.patient_doc_assignments.find_one(
        {"email_token": token},
        {"_id": 0}
    )
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    # Check expiration
    expires = assignment.get("email_token_expires")
    if expires and datetime.fromisoformat(expires.replace('Z', '+00:00')) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link has expired")
    
    if assignment.get("status") == "signed":
        raise HTTPException(status_code=400, detail="Document already signed")
    
    # Mark as viewed
    await db.patient_doc_assignments.update_one(
        {"id": assignment.get("id")},
        {"$set": {"status": AssignmentStatus.VIEWED.value, "viewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Return document for signing (exclude sensitive fields)
    return {
        "id": assignment.get("id"),
        "title": assignment.get("template_title"),
        "patient_name": assignment.get("patient_name"),
        "filled_content": assignment.get("filled_content"),
        "status": "viewed"
    }

@patient_docs_router.post("/sign-by-email/{token}")
async def sign_document_by_email(token: str, signature_data: str, signed_by_name: str):
    """Sign document via email link (no auth required)"""
    assignment = await db.patient_doc_assignments.find_one({"email_token": token})
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    # Check expiration
    expires = assignment.get("email_token_expires")
    if expires and datetime.fromisoformat(expires.replace('Z', '+00:00')) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link has expired")
    
    if assignment.get("status") == "signed":
        raise HTTPException(status_code=400, detail="Document already signed")
    
    # Update with signature
    update_data = {
        "status": AssignmentStatus.SIGNED.value,
        "signature_data": signature_data,
        "signed_by_name": signed_by_name,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "email_token": None  # Invalidate token
    }
    
    # Generate PDF
    try:
        pdf_result = await generate_patient_doc_pdf(assignment, signature_data, signed_by_name)
        update_data["pdf_url"] = pdf_result.get("url")
        update_data["pdf_filename"] = pdf_result.get("filename")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
    
    await db.patient_doc_assignments.update_one(
        {"id": assignment.get("id")},
        {"$set": update_data}
    )
    
    logger.info(f"Patient document signed via email: {assignment.get('template_title')}")
    
    return {"message": "Document signed successfully", "pdf_url": update_data.get("pdf_url")}

@patient_docs_router.post("/resend-email/{assignment_id}")
async def resend_signing_email(assignment_id: str, user: dict = Depends(require_staff)):
    """Resend signing email for an assignment"""
    assignment = await db.patient_doc_assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.get("status") == "signed":
        raise HTTPException(status_code=400, detail="Document already signed")
    
    # Generate new token
    new_token = generate_email_token()
    token_expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    
    await db.patient_doc_assignments.update_one(
        {"id": assignment_id},
        {"$set": {
            "email_token": new_token,
            "email_token_expires": token_expires,
            "status": AssignmentStatus.SENT.value,
            "sent_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # TODO: Send email
    
    return {"message": "Signing link resent", "token": new_token}

# =============================================================================
# AUTO-ASSIGNMENT RULES
# =============================================================================

@patient_docs_router.get("/auto-assign-rules")
async def list_auto_assign_rules(user: dict = Depends(require_admin)):
    """Get all auto-assignment rules"""
    rules = await db.patient_doc_auto_rules.find({}, {"_id": 0}).sort("priority", 1).to_list(50)
    return {"rules": rules, "total": len(rules)}

@patient_docs_router.post("/auto-assign-rules")
async def create_auto_assign_rule(rule: AutoAssignRule, user: dict = Depends(require_admin)):
    """Create an auto-assignment rule"""
    rule_id = str(uuid.uuid4())
    
    rule_dict = rule.dict()
    rule_dict["id"] = rule_id
    rule_dict["created_by"] = user.get("id")
    rule_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.patient_doc_auto_rules.insert_one(rule_dict)
    
    return {"id": rule_id, "message": "Rule created"}

@patient_docs_router.put("/auto-assign-rules/{rule_id}")
async def update_auto_assign_rule(rule_id: str, rule: AutoAssignRule, user: dict = Depends(require_admin)):
    """Update an auto-assignment rule"""
    existing = await db.patient_doc_auto_rules.find_one({"id": rule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule_dict = rule.dict()
    rule_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.patient_doc_auto_rules.update_one(
        {"id": rule_id},
        {"$set": rule_dict}
    )
    
    return {"message": "Rule updated"}

@patient_docs_router.delete("/auto-assign-rules/{rule_id}")
async def delete_auto_assign_rule(rule_id: str, user: dict = Depends(require_admin)):
    """Delete an auto-assignment rule"""
    await db.patient_doc_auto_rules.delete_one({"id": rule_id})
    return {"message": "Rule deleted"}

async def auto_assign_documents_to_patient(patient: dict):
    """Auto-assign documents to a new patient based on rules"""
    rules = await db.patient_doc_auto_rules.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("priority", 1).to_list(50)
    
    assigned_template_ids = set()
    
    for rule in rules:
        conditions = rule.get("conditions", {})
        matches = True
        
        # Check conditions
        for field, values in conditions.items():
            patient_value = patient.get(field, "")
            if isinstance(values, list):
                if patient_value not in values:
                    matches = False
                    break
            else:
                if patient_value != values:
                    matches = False
                    break
        
        if matches:
            for template_id in rule.get("template_ids", []):
                if template_id not in assigned_template_ids:
                    assigned_template_ids.add(template_id)
    
    # Also get templates with auto_assign = True
    auto_templates = await db.patient_doc_templates.find(
        {"is_active": True, "auto_assign": True},
        {"_id": 0, "id": 1}
    ).to_list(50)
    
    for t in auto_templates:
        assigned_template_ids.add(t.get("id"))
    
    # Create assignments
    for template_id in assigned_template_ids:
        template = await db.patient_doc_templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            continue
        
        filled_content = fill_patient_template(template.get("content", ""), patient)
        
        assignment = {
            "id": str(uuid.uuid4()),
            "template_id": template_id,
            "template_title": template.get("title"),
            "template_category": template.get("category"),
            "patient_id": patient.get("id"),
            "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip(),
            "patient_email": patient.get("email", ""),
            "assigned_by": "system",
            "assigned_by_name": "Auto-Assigned",
            "filled_content": filled_content,
            "status": AssignmentStatus.PENDING.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.patient_doc_assignments.insert_one(assignment)
    
    logger.info(f"Auto-assigned {len(assigned_template_ids)} documents to patient {patient.get('id')}")
    
    return list(assigned_template_ids)

# =============================================================================
# PDF GENERATION
# =============================================================================

async def generate_patient_doc_pdf(assignment: dict, signature_data: str, signed_by_name: str) -> dict:
    """Generate PDF from signed patient document"""
    try:
        storage_settings = await db.site_settings.find_one({"type": "storage"}, {"_id": 0})
        if not storage_settings or not storage_settings.get("endpoint"):
            return {"url": None, "filename": None}
        
        from weasyprint import HTML
        
        signature_html = f"""
        <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
            <p><strong>Signed by:</strong> {signed_by_name}</p>
            <p><strong>Date:</strong> {datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p")}</p>
            <div style="margin-top: 10px;">
                <img src="{signature_data}" style="max-width: 300px; max-height: 100px;" />
            </div>
        </div>
        """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; padding: 40px; }}
                h1 {{ color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }}
                h2, h3 {{ color: #555; }}
                .content {{ margin: 20px 0; }}
                table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f5f5f5; }}
            </style>
        </head>
        <body>
            <h1>{assignment.get('template_title', 'Patient Document')}</h1>
            <p><strong>Patient:</strong> {assignment.get('patient_name', '')}</p>
            <div class="content">
                {assignment.get('filled_content', '')}
            </div>
            {signature_html}
        </body>
        </html>
        """
        
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        import boto3
        from botocore.config import Config
        
        s3_client = boto3.client(
            's3',
            endpoint_url=storage_settings.get("endpoint"),
            aws_access_key_id=storage_settings.get("access_key"),
            aws_secret_access_key=storage_settings.get("secret_key"),
            config=Config(signature_version='s3v4'),
            region_name=storage_settings.get("region", "us-east-1")
        )
        
        bucket = storage_settings.get("bucket_name")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_title = assignment.get("template_title", "document").replace(" ", "_").lower()[:30]
        patient_id = assignment.get("patient_id", "unknown")
        filename = f"patient_documents/{patient_id}/{safe_title}_{timestamp}.pdf"
        
        s3_client.put_object(
            Bucket=bucket,
            Key=filename,
            Body=pdf_bytes,
            ContentType='application/pdf'
        )
        
        url = f"{storage_settings.get('endpoint')}/{bucket}/{filename}"
        
        return {"url": url, "filename": filename}
        
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return {"url": None, "filename": None}

# =============================================================================
# DEFAULT TEMPLATES
# =============================================================================

DEFAULT_PATIENT_TEMPLATES = [
    {
        "title": "Patient Intake Form",
        "description": "Basic patient information and medical history",
        "category": "intake",
        "order": 1,
        "is_required": True,
        "auto_assign": True,
        "content": """
<h2>PATIENT INTAKE FORM</h2>

<h3>Patient Information</h3>
<table>
    <tr><td><strong>Name:</strong></td><td>{{patient_name}}</td></tr>
    <tr><td><strong>Date of Birth:</strong></td><td>{{patient_dob}}</td></tr>
    <tr><td><strong>Phone:</strong></td><td>{{patient_phone}}</td></tr>
    <tr><td><strong>Email:</strong></td><td>{{patient_email}}</td></tr>
    <tr><td><strong>Address:</strong></td><td>{{patient_full_address}}</td></tr>
</table>

<h3>Insurance Information</h3>
<table>
    <tr><td><strong>Insurance Provider:</strong></td><td>{{patient_insurance}}</td></tr>
    <tr><td><strong>Policy Number:</strong></td><td>{{patient_insurance_id}}</td></tr>
    <tr><td><strong>Medicare ID:</strong></td><td>{{patient_medicare_id}}</td></tr>
</table>

<h3>Emergency Contact</h3>
<p>Name: _________________________________ Phone: _________________________</p>
<p>Relationship: _________________________</p>

<h3>Medical History</h3>
<p>Primary Diagnosis: ___________________________________________________</p>
<p>Physician Name: ___________________________________________________</p>
<p>Physician Phone: ___________________________________________________</p>

<p>I certify that the information provided above is accurate and complete to the best of my knowledge.</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "HIPAA Authorization",
        "description": "Authorization for use and disclosure of health information",
        "category": "hipaa",
        "order": 2,
        "is_required": True,
        "auto_assign": True,
        "content": """
<h2>HIPAA AUTHORIZATION FOR USE AND DISCLOSURE OF HEALTH INFORMATION</h2>

<p><strong>Patient Name:</strong> {{patient_name}}</p>
<p><strong>Date of Birth:</strong> {{patient_dob}}</p>

<h3>Authorization</h3>
<p>I hereby authorize Mastech Medical Equipment, LLC and its employees to use and/or disclose my protected health information as described below:</p>

<h3>Information to be Disclosed</h3>
<ul>
    <li>Medical records related to durable medical equipment</li>
    <li>Insurance and billing information</li>
    <li>Diagnosis and treatment information</li>
</ul>

<h3>Purpose of Disclosure</h3>
<ul>
    <li>Insurance verification and billing</li>
    <li>Coordination of care with healthcare providers</li>
    <li>Equipment delivery and setup</li>
</ul>

<h3>Patient Rights</h3>
<ul>
    <li>I understand that I may revoke this authorization at any time in writing</li>
    <li>I understand that treatment will not be conditioned on signing this authorization</li>
    <li>I understand that information disclosed may be subject to re-disclosure</li>
</ul>

<p>This authorization expires one year from the date signed or upon: _________________</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "Assignment of Benefits (AOB)",
        "description": "Authorization to bill insurance directly",
        "category": "insurance",
        "order": 3,
        "is_required": True,
        "auto_assign": True,
        "content": """
<h2>ASSIGNMENT OF BENEFITS</h2>

<p><strong>Patient Name:</strong> {{patient_name}}</p>
<p><strong>Date of Birth:</strong> {{patient_dob}}</p>
<p><strong>Insurance ID:</strong> {{patient_insurance_id}}</p>

<h3>Assignment</h3>
<p>I hereby assign all medical and/or surgical benefits, including major medical benefits, to which I am entitled under my insurance policy to Mastech Medical Equipment, LLC.</p>

<p>This assignment will remain in effect until revoked by me in writing. I understand I am financially responsible for all charges whether or not paid by said insurance.</p>

<h3>Authorization to Release Information</h3>
<p>I hereby authorize Mastech Medical Equipment, LLC to release any information necessary to process insurance claims on my behalf.</p>

<h3>Medicare/Medicaid Certification</h3>
<p>I certify that the information given by me in applying for payment under Title XVIII and/or Title XIX of the Social Security Act is correct. I authorize any holder of medical or other information about me to release to the Social Security Administration and Centers for Medicare and Medicaid Services or its intermediaries any information needed for this or a related Medicare/Medicaid claim.</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "Medical Equipment Agreement",
        "description": "Terms and conditions for equipment rental/purchase",
        "category": "equipment",
        "order": 4,
        "is_required": True,
        "auto_assign": False,
        "content": """
<h2>MEDICAL EQUIPMENT AGREEMENT</h2>

<p><strong>Patient Name:</strong> {{patient_name}}</p>
<p><strong>Address:</strong> {{patient_full_address}}</p>

<h3>Equipment</h3>
<p>Equipment Type: _________________________________________________</p>
<p>Serial Number: _________________________________________________</p>
<p>Rental/Purchase: _________________________________________________</p>

<h3>Terms and Conditions</h3>
<ol>
    <li>The equipment remains the property of Mastech Medical Equipment, LLC until purchased or returned</li>
    <li>Patient agrees to use equipment only as prescribed and instructed</li>
    <li>Patient agrees to maintain equipment in good condition</li>
    <li>Patient is responsible for loss, theft, or damage to equipment</li>
    <li>Patient agrees to return equipment upon request or when no longer needed</li>
</ol>

<h3>Training Acknowledgment</h3>
<p>I acknowledge that I have received instruction on the proper use, care, and maintenance of the equipment listed above.</p>

<h3>Financial Responsibility</h3>
<p>I understand that I am responsible for any deductibles, co-payments, or charges not covered by insurance.</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "Delivery Receipt / Proof of Delivery",
        "description": "Confirmation of equipment delivery",
        "category": "delivery",
        "order": 5,
        "is_required": True,
        "auto_assign": False,
        "content": """
<h2>DELIVERY RECEIPT / PROOF OF DELIVERY</h2>

<p><strong>Date:</strong> {{current_date}}</p>
<p><strong>Patient Name:</strong> {{patient_name}}</p>
<p><strong>Delivery Address:</strong> {{patient_full_address}}</p>

<h3>Equipment Delivered</h3>
<table>
    <tr><th>Item Description</th><th>Quantity</th><th>Serial #</th></tr>
    <tr><td>_________________________</td><td>_____</td><td>_____________</td></tr>
    <tr><td>_________________________</td><td>_____</td><td>_____________</td></tr>
    <tr><td>_________________________</td><td>_____</td><td>_____________</td></tr>
</table>

<h3>Supplies Delivered</h3>
<table>
    <tr><th>Item Description</th><th>Quantity</th></tr>
    <tr><td>_________________________</td><td>_____</td></tr>
    <tr><td>_________________________</td><td>_____</td></tr>
</table>

<h3>Acknowledgment</h3>
<p>I acknowledge receipt of the above equipment and/or supplies in good working condition. I have received instruction on proper use and care.</p>

<p><strong>Patient/Representative Signature:</strong> _________________________ Date: {{current_date}}</p>
<p><strong>Delivery Technician:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "Patient Bill of Rights",
        "description": "Acknowledgment of patient rights and responsibilities",
        "category": "compliance",
        "order": 6,
        "is_required": True,
        "auto_assign": True,
        "content": """
<h2>PATIENT BILL OF RIGHTS AND RESPONSIBILITIES</h2>

<h3>Your Rights as a Patient</h3>
<ul>
    <li>To be treated with dignity, respect, and consideration</li>
    <li>To receive care regardless of race, religion, gender, or ability to pay</li>
    <li>To be informed about your care and participate in treatment decisions</li>
    <li>To receive safe, quality equipment and services</li>
    <li>To have your privacy and confidentiality protected</li>
    <li>To voice concerns or complaints without fear of retaliation</li>
    <li>To receive clear explanations of charges and billing</li>
</ul>

<h3>Your Responsibilities as a Patient</h3>
<ul>
    <li>To provide accurate and complete health information</li>
    <li>To follow prescribed treatment plans and instructions</li>
    <li>To use equipment safely and as directed</li>
    <li>To notify us of any changes in your condition</li>
    <li>To meet financial obligations in a timely manner</li>
    <li>To treat staff with respect and courtesy</li>
</ul>

<h3>Acknowledgment</h3>
<p>I acknowledge that I have received and understand this Patient Bill of Rights and Responsibilities.</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "Financial Responsibility Agreement",
        "description": "Agreement regarding payment and financial obligations",
        "category": "financial",
        "order": 7,
        "is_required": True,
        "auto_assign": True,
        "content": """
<h2>FINANCIAL RESPONSIBILITY AGREEMENT</h2>

<p><strong>Patient Name:</strong> {{patient_name}}</p>

<h3>Agreement</h3>
<p>I understand that I am financially responsible for all charges incurred for equipment and services provided by Mastech Medical Equipment, LLC, including but not limited to:</p>

<ul>
    <li>Insurance deductibles and co-payments</li>
    <li>Services or items not covered by insurance</li>
    <li>Charges exceeding insurance allowable amounts</li>
    <li>Replacement costs for lost, stolen, or damaged equipment</li>
</ul>

<h3>Insurance Billing</h3>
<p>I authorize Mastech Medical Equipment, LLC to bill my insurance company on my behalf. I understand that:</p>
<ul>
    <li>Insurance benefits will be verified but are not guaranteed</li>
    <li>I am responsible for any balance after insurance payment</li>
    <li>Claims may be denied or partially paid by insurance</li>
</ul>

<h3>Payment Terms</h3>
<p>Payment is due within 30 days of statement. Accounts over 90 days may be subject to collection action and/or equipment retrieval.</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "CPAP/BiPAP Compliance Agreement",
        "description": "Compliance requirements for CPAP/BiPAP therapy",
        "category": "compliance",
        "order": 8,
        "is_required": False,
        "auto_assign": False,
        "content": """
<h2>CPAP/BiPAP COMPLIANCE AGREEMENT</h2>

<p><strong>Patient Name:</strong> {{patient_name}}</p>
<p><strong>Date of Birth:</strong> {{patient_dob}}</p>

<h3>Equipment Information</h3>
<p>Device Type: ☐ CPAP  ☐ BiPAP  ☐ Auto-CPAP</p>
<p>Pressure Setting: ___________ cm H2O</p>
<p>Mask Type: _________________________</p>

<h3>Medicare/Insurance Compliance Requirements</h3>
<p>I understand that to qualify for continued coverage of my PAP equipment:</p>
<ul>
    <li>I must use my device at least 4 hours per night for 70% of nights (21 out of 30 days)</li>
    <li>I must have a face-to-face evaluation within the first 31-90 days</li>
    <li>My physician must document that I am benefiting from therapy</li>
    <li>Compliance data will be monitored and reported to my insurance</li>
</ul>

<h3>Patient Responsibilities</h3>
<ul>
    <li>Use equipment every night as prescribed</li>
    <li>Clean equipment regularly as instructed</li>
    <li>Report any problems or discomfort immediately</li>
    <li>Keep all follow-up appointments</li>
</ul>

<h3>Non-Compliance Consequences</h3>
<p>I understand that failure to meet compliance requirements may result in:</p>
<ul>
    <li>Denial of insurance coverage</li>
    <li>Requirement to return equipment</li>
    <li>Financial responsibility for equipment costs</li>
</ul>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    },
    {
        "title": "Oxygen Therapy Agreement",
        "description": "Safety and compliance for home oxygen therapy",
        "category": "compliance",
        "order": 9,
        "is_required": False,
        "auto_assign": False,
        "content": """
<h2>HOME OXYGEN THERAPY AGREEMENT</h2>

<p><strong>Patient Name:</strong> {{patient_name}}</p>
<p><strong>Oxygen Flow Rate:</strong> _________ LPM</p>
<p><strong>Usage:</strong> ☐ Continuous  ☐ PRN  ☐ With Activity  ☐ At Night</p>

<h3>Safety Rules - IMPORTANT</h3>
<ul>
    <li><strong>NO SMOKING</strong> - Oxygen supports combustion. No smoking within 10 feet of oxygen equipment</li>
    <li>Keep oxygen away from open flames, sparks, and heat sources</li>
    <li>Do not use petroleum-based products near oxygen</li>
    <li>Store oxygen cylinders upright and secured</li>
    <li>Post "Oxygen in Use" signs at home entrances</li>
</ul>

<h3>Patient Responsibilities</h3>
<ul>
    <li>Use oxygen only as prescribed by your physician</li>
    <li>Keep equipment clean and in good condition</li>
    <li>Have backup portable oxygen for emergencies</li>
    <li>Notify us of any equipment problems immediately</li>
    <li>Allow access for equipment maintenance and deliveries</li>
</ul>

<h3>Emergency Procedures</h3>
<p>In case of equipment failure: Call us immediately at [PHONE NUMBER]</p>
<p>After hours: [EMERGENCY NUMBER]</p>

<h3>Acknowledgment</h3>
<p>I have received instruction on the safe use of home oxygen therapy and agree to follow all safety guidelines.</p>

<p><strong>Patient Signature:</strong> _________________________ Date: {{current_date}}</p>
"""
    }
]

@patient_docs_router.post("/templates/seed-defaults")
async def seed_default_patient_templates(user: dict = Depends(require_admin)):
    """Seed default patient document templates"""
    created = 0
    
    for template_data in DEFAULT_PATIENT_TEMPLATES:
        existing = await db.patient_doc_templates.find_one({"title": template_data["title"]})
        if not existing:
            template_id = str(uuid.uuid4())
            template = {
                "id": template_id,
                **template_data,
                "is_active": True,
                "created_by": user.get("id"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.patient_doc_templates.insert_one(template)
            created += 1
    
    logger.info(f"Seeded {created} default patient document templates")
    
    return {"message": f"Created {created} default templates", "total_defaults": len(DEFAULT_PATIENT_TEMPLATES)}
