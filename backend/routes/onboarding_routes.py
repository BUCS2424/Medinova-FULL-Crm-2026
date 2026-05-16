"""
Onboarding Documents Routes
Handles document templates, e-signatures, and PDF generation for DME company onboarding
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid
import json
import os
import logging
import base64
import io

logger = logging.getLogger(__name__)

onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])
security = HTTPBearer()

# Database reference (set by main app)
db = None

def set_database(database):
    global db
    db = database

# =============================================================================
# MODELS
# =============================================================================

class DocumentStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"  # Sent to admin, awaiting signature
    SIGNED = "signed"
    ARCHIVED = "archived"

class DocumentTemplate(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    content: str  # HTML/Markdown template with {{variables}}
    order: int = 0
    is_required: bool = True
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class DocumentTemplateCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: str
    order: Optional[int] = 0
    is_required: bool = True
    is_active: bool = True

class DocumentTemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None

class SignedDocument(BaseModel):
    id: Optional[str] = None
    template_id: str
    template_title: str
    company_id: str
    company_name: str
    admin_id: str
    admin_name: str
    admin_email: str
    filled_content: str  # Template with variables filled
    signature_data: Optional[str] = None  # Base64 signature image
    signature_date: Optional[str] = None
    signed_by_name: Optional[str] = None
    signed_by_title: Optional[str] = None
    pdf_url: Optional[str] = None
    pdf_filename: Optional[str] = None
    status: DocumentStatus = DocumentStatus.PENDING
    created_at: Optional[str] = None
    signed_at: Optional[str] = None

class CompanyInfo(BaseModel):
    """Company information for auto-filling templates"""
    company_name: str = ""
    company_dba: str = ""  # Doing Business As
    company_address: str = ""
    company_city: str = ""
    company_state: str = ""
    company_zip: str = ""
    company_phone: str = ""
    company_fax: str = ""
    company_email: str = ""
    company_website: str = ""
    company_ein: str = ""  # Tax ID
    company_npi: str = ""  # National Provider Identifier
    company_license_number: str = ""
    owner_name: str = ""
    owner_title: str = ""
    owner_email: str = ""
    owner_phone: str = ""

class SignDocumentRequest(BaseModel):
    document_id: str
    signature_data: str  # Base64 signature image
    signed_by_name: str
    signed_by_title: str

class ReorderTemplatesRequest(BaseModel):
    template_ids: List[str]  # Ordered list of template IDs

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

async def require_super_admin(user: dict = Depends(get_current_user)):
    """Require super admin role"""
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

async def require_admin_or_super(user: dict = Depends(get_current_user)):
    """Require admin or super admin role"""
    if user.get("role") not in ["admin", "super_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_company_info():
    """Get company information from settings"""
    if db is None:
        return CompanyInfo().dict()
    
    settings = await db.site_settings.find_one({"type": "company_info"}, {"_id": 0})
    if settings:
        return settings
    return CompanyInfo().dict()

def fill_template_variables(template_content: str, company_info: dict, signer_info: dict = None) -> str:
    """Replace template variables with actual values"""
    content = template_content
    
    # Company variables
    replacements = {
        "{{company_name}}": company_info.get("company_name", ""),
        "{{company_dba}}": company_info.get("company_dba", ""),
        "{{company_address}}": company_info.get("company_address", ""),
        "{{company_city}}": company_info.get("company_city", ""),
        "{{company_state}}": company_info.get("company_state", ""),
        "{{company_zip}}": company_info.get("company_zip", ""),
        "{{company_full_address}}": f"{company_info.get('company_address', '')}, {company_info.get('company_city', '')}, {company_info.get('company_state', '')} {company_info.get('company_zip', '')}",
        "{{company_phone}}": company_info.get("company_phone", ""),
        "{{company_fax}}": company_info.get("company_fax", ""),
        "{{company_email}}": company_info.get("company_email", ""),
        "{{company_website}}": company_info.get("company_website", ""),
        "{{company_ein}}": company_info.get("company_ein", ""),
        "{{company_npi}}": company_info.get("company_npi", ""),
        "{{company_license}}": company_info.get("company_license_number", ""),
        "{{owner_name}}": company_info.get("owner_name", ""),
        "{{owner_title}}": company_info.get("owner_title", ""),
        "{{owner_email}}": company_info.get("owner_email", ""),
        "{{owner_phone}}": company_info.get("owner_phone", ""),
        "{{current_date}}": datetime.now(timezone.utc).strftime("%B %d, %Y"),
        "{{current_year}}": str(datetime.now(timezone.utc).year),
    }
    
    # Signer variables (if signing)
    if signer_info:
        replacements.update({
            "{{signer_name}}": signer_info.get("name", ""),
            "{{signer_title}}": signer_info.get("title", ""),
            "{{signature_date}}": signer_info.get("date", datetime.now(timezone.utc).strftime("%B %d, %Y")),
        })
    
    for var, value in replacements.items():
        content = content.replace(var, value or "")
    
    return content

# =============================================================================
# COMPANY INFO ENDPOINTS
# =============================================================================

@onboarding_router.get("/company-info")
async def get_company_information(user: dict = Depends(require_admin_or_super)):
    """Get company information for template auto-fill"""
    info = await get_company_info()
    return info

@onboarding_router.put("/company-info")
async def update_company_information(info: CompanyInfo, user: dict = Depends(require_admin_or_super)):
    """Update company information"""
    info_dict = info.dict()
    info_dict["type"] = "company_info"
    info_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    info_dict["updated_by"] = user.get("id")
    
    await db.site_settings.update_one(
        {"type": "company_info"},
        {"$set": info_dict},
        upsert=True
    )
    
    logger.info(f"Company info updated by {user.get('email')}")
    return {"message": "Company information updated"}

# =============================================================================
# TEMPLATE MANAGEMENT ENDPOINTS (Super Admin)
# =============================================================================

@onboarding_router.get("/templates")
async def list_document_templates(user: dict = Depends(require_admin_or_super)):
    """Get all document templates ordered by 'order' field"""
    templates = await db.onboarding_templates.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"templates": templates, "total": len(templates)}

@onboarding_router.get("/templates/all")
async def list_all_templates(user: dict = Depends(require_super_admin)):
    """Get all templates including inactive (super admin only)"""
    templates = await db.onboarding_templates.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"templates": templates, "total": len(templates)}

@onboarding_router.post("/templates")
async def create_document_template(template: DocumentTemplateCreate, user: dict = Depends(require_super_admin)):
    """Create a new document template (super admin only)"""
    template_id = str(uuid.uuid4())
    
    # Get next order number
    last_template = await db.onboarding_templates.find_one(
        {},
        sort=[("order", -1)]
    )
    next_order = (last_template.get("order", 0) + 1) if last_template else 1
    
    template_dict = template.dict()
    template_dict["id"] = template_id
    template_dict["order"] = template.order if template.order > 0 else next_order
    template_dict["created_by"] = user.get("id")
    template_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    template_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.onboarding_templates.insert_one(template_dict)
    
    logger.info(f"Document template created: {template.title} by {user.get('email')}")
    
    return {"id": template_id, "message": "Template created"}

@onboarding_router.get("/templates/{template_id}")
async def get_document_template(template_id: str, user: dict = Depends(require_admin_or_super)):
    """Get a specific template"""
    template = await db.onboarding_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@onboarding_router.put("/templates/{template_id}")
async def update_document_template(template_id: str, update: DocumentTemplateUpdate, user: dict = Depends(require_super_admin)):
    """Update a document template (super admin only)"""
    existing = await db.onboarding_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.onboarding_templates.update_one(
        {"id": template_id},
        {"$set": update_dict}
    )
    
    logger.info(f"Template updated: {template_id} by {user.get('email')}")
    
    return {"message": "Template updated"}

@onboarding_router.delete("/templates/{template_id}")
async def delete_document_template(template_id: str, user: dict = Depends(require_super_admin)):
    """Soft delete a template (super admin only)"""
    existing = await db.onboarding_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Soft delete - set is_active to False
    await db.onboarding_templates.update_one(
        {"id": template_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"Template deleted: {template_id} by {user.get('email')}")
    
    return {"message": "Template deleted"}

@onboarding_router.post("/templates/reorder")
async def reorder_templates(request: ReorderTemplatesRequest, user: dict = Depends(require_super_admin)):
    """Reorder templates (super admin only)"""
    for idx, template_id in enumerate(request.template_ids):
        await db.onboarding_templates.update_one(
            {"id": template_id},
            {"$set": {"order": idx + 1, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    logger.info(f"Templates reordered by {user.get('email')}")
    
    return {"message": "Templates reordered"}

@onboarding_router.get("/templates/{template_id}/preview")
async def preview_template(template_id: str, user: dict = Depends(require_admin_or_super)):
    """Preview a template with company info filled in"""
    template = await db.onboarding_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    company_info = await get_company_info()
    filled_content = fill_template_variables(template.get("content", ""), company_info)
    
    return {
        "template": template,
        "filled_content": filled_content,
        "company_info": company_info
    }

# =============================================================================
# DOCUMENT SIGNING ENDPOINTS (Admin/Owner)
# =============================================================================

@onboarding_router.get("/documents/pending")
async def get_pending_documents(user: dict = Depends(require_admin_or_super)):
    """Get documents pending signature for current user/company"""
    # Get all active templates
    templates = await db.onboarding_templates.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get already signed documents for this user
    signed_docs = await db.signed_documents.find(
        {"admin_id": user.get("id"), "status": {"$in": ["signed", "pending"]}},
        {"_id": 0}
    ).to_list(100)
    
    signed_template_ids = {doc.get("template_id") for doc in signed_docs}
    
    # Filter to only pending (unsigned) templates
    company_info = await get_company_info()
    pending = []
    
    for template in templates:
        if template.get("id") not in signed_template_ids:
            filled_content = fill_template_variables(template.get("content", ""), company_info)
            pending.append({
                **template,
                "filled_content": filled_content
            })
    
    return {
        "pending": pending,
        "signed": signed_docs,
        "total_templates": len(templates),
        "signed_count": len(signed_docs),
        "pending_count": len(pending)
    }

@onboarding_router.post("/documents/sign")
async def sign_document(request: SignDocumentRequest, user: dict = Depends(require_admin_or_super)):
    """Sign a document with e-signature"""
    # Get the document (could be a pending doc or creating from template)
    doc = await db.signed_documents.find_one({"id": request.document_id})
    
    if not doc:
        # Creating from template - get template
        template = await db.onboarding_templates.find_one({"id": request.document_id})
        if not template:
            raise HTTPException(status_code=404, detail="Document/Template not found")
        
        # Create new signed document record
        company_info = await get_company_info()
        signer_info = {
            "name": request.signed_by_name,
            "title": request.signed_by_title,
            "date": datetime.now(timezone.utc).strftime("%B %d, %Y")
        }
        
        filled_content = fill_template_variables(
            template.get("content", ""),
            company_info,
            signer_info
        )
        
        doc_id = str(uuid.uuid4())
        doc = {
            "id": doc_id,
            "template_id": template.get("id"),
            "template_title": template.get("title"),
            "company_id": user.get("company_id", "default"),
            "company_name": company_info.get("company_name", ""),
            "admin_id": user.get("id"),
            "admin_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "admin_email": user.get("email"),
            "filled_content": filled_content,
            "status": DocumentStatus.PENDING.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Apply signature
    doc["signature_data"] = request.signature_data
    doc["signed_by_name"] = request.signed_by_name
    doc["signed_by_title"] = request.signed_by_title
    doc["signature_date"] = datetime.now(timezone.utc).isoformat()
    doc["signed_at"] = datetime.now(timezone.utc).isoformat()
    doc["status"] = DocumentStatus.SIGNED.value
    
    # Generate PDF and upload to storage
    try:
        pdf_result = await generate_and_upload_pdf(doc, user)
        doc["pdf_url"] = pdf_result.get("url")
        doc["pdf_filename"] = pdf_result.get("filename")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        # Continue without PDF - can retry later
    
    # Save to database
    await db.signed_documents.update_one(
        {"id": doc.get("id")},
        {"$set": doc},
        upsert=True
    )
    
    # Notify super admin
    await notify_super_admin_of_signature(doc, user)
    
    logger.info(f"Document signed: {doc.get('template_title')} by {user.get('email')}")
    
    return {
        "message": "Document signed successfully",
        "document_id": doc.get("id"),
        "pdf_url": doc.get("pdf_url")
    }

@onboarding_router.get("/documents/signed")
async def get_signed_documents(user: dict = Depends(require_admin_or_super)):
    """Get all signed documents for current user or all (super admin)"""
    query = {}
    
    if user.get("role") != "super_admin":
        query["admin_id"] = user.get("id")
    
    documents = await db.signed_documents.find(
        query,
        {"_id": 0}
    ).sort("signed_at", -1).to_list(200)
    
    return {"documents": documents, "total": len(documents)}

@onboarding_router.get("/documents/{document_id}")
async def get_signed_document(document_id: str, user: dict = Depends(require_admin_or_super)):
    """Get a specific signed document"""
    doc = await db.signed_documents.find_one({"id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check access
    if user.get("role") != "super_admin" and doc.get("admin_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return doc

@onboarding_router.get("/documents/{document_id}/download")
async def download_signed_document(document_id: str, user: dict = Depends(require_admin_or_super)):
    """Download signed document PDF"""
    doc = await db.signed_documents.find_one({"id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check access
    if user.get("role") != "super_admin" and doc.get("admin_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not doc.get("pdf_url"):
        raise HTTPException(status_code=404, detail="PDF not available")
    
    # Return the PDF URL for download
    return {"download_url": doc.get("pdf_url"), "filename": doc.get("pdf_filename")}

# =============================================================================
# PDF GENERATION & STORAGE
# =============================================================================

async def generate_and_upload_pdf(doc: dict, user: dict) -> dict:
    """Generate PDF from signed document and upload to storage"""
    try:
        # Get storage settings
        storage_settings = await db.site_settings.find_one({"type": "storage"}, {"_id": 0})
        if not storage_settings or not storage_settings.get("endpoint"):
            logger.warning("Storage not configured - skipping PDF upload")
            return {"url": None, "filename": None}
        
        # Generate PDF using WeasyPrint or similar
        from weasyprint import HTML, CSS
        
        # Build HTML document
        signature_html = ""
        if doc.get("signature_data"):
            signature_html = f"""
            <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
                <p><strong>Signed by:</strong> {doc.get('signed_by_name', '')}</p>
                <p><strong>Title:</strong> {doc.get('signed_by_title', '')}</p>
                <p><strong>Date:</strong> {doc.get('signature_date', '')}</p>
                <div style="margin-top: 10px;">
                    <img src="{doc.get('signature_data')}" style="max-width: 300px; max-height: 100px;" />
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
            <h1>{doc.get('template_title', 'Document')}</h1>
            <div class="content">
                {doc.get('filled_content', '')}
            </div>
            {signature_html}
        </body>
        </html>
        """
        
        # Generate PDF
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        # Upload to S3/iDrive E2
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
        safe_title = doc.get("template_title", "document").replace(" ", "_").lower()[:30]
        filename = f"signed_documents/{doc.get('company_id', 'default')}/{safe_title}_{timestamp}.pdf"
        
        s3_client.put_object(
            Bucket=bucket,
            Key=filename,
            Body=pdf_bytes,
            ContentType='application/pdf'
        )
        
        # Generate URL
        url = f"{storage_settings.get('endpoint')}/{bucket}/{filename}"
        
        logger.info(f"PDF uploaded: {filename}")
        
        return {"url": url, "filename": filename}
        
    except ImportError:
        logger.warning("WeasyPrint not installed - PDF generation skipped")
        return {"url": None, "filename": None}
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return {"url": None, "filename": None}

async def notify_super_admin_of_signature(doc: dict, user: dict):
    """Notify super admin when a document is signed"""
    try:
        # Find super admins
        super_admins = await db.users.find(
            {"role": "super_admin"},
            {"_id": 0, "email": 1, "first_name": 1, "id": 1}
        ).to_list(10)
        
        # Create notification for each super admin
        for admin in super_admins:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": admin.get("id"),
                "type": "document_signed",
                "title": "Document Signed",
                "message": f"{user.get('first_name', '')} {user.get('last_name', '')} signed '{doc.get('template_title')}'",
                "data": {
                    "document_id": doc.get("id"),
                    "template_title": doc.get("template_title"),
                    "signer_email": user.get("email"),
                    "company_name": doc.get("company_name")
                },
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
        
        logger.info(f"Super admins notified of signed document: {doc.get('template_title')}")
        
    except Exception as e:
        logger.error(f"Failed to notify super admins: {e}")

# =============================================================================
# ONBOARDING STATUS
# =============================================================================

@onboarding_router.get("/status")
async def get_onboarding_status(user: dict = Depends(require_admin_or_super)):
    """Get overall onboarding status for current user"""
    # Get all active templates
    templates = await db.onboarding_templates.find(
        {"is_active": True, "is_required": True},
        {"_id": 0}
    ).to_list(100)
    
    required_count = len(templates)
    
    # Get signed documents
    signed_docs = await db.signed_documents.find(
        {"admin_id": user.get("id"), "status": DocumentStatus.SIGNED.value},
        {"_id": 0, "template_id": 1}
    ).to_list(100)
    
    signed_template_ids = {doc.get("template_id") for doc in signed_docs}
    signed_count = len([t for t in templates if t.get("id") in signed_template_ids])
    
    is_complete = signed_count >= required_count
    
    return {
        "is_complete": is_complete,
        "required_count": required_count,
        "signed_count": signed_count,
        "progress_percent": (signed_count / required_count * 100) if required_count > 0 else 100
    }

# =============================================================================
# DEFAULT TEMPLATES
# =============================================================================

DEFAULT_TEMPLATES = [
    {
        "title": "Business Associate Agreement (BAA)",
        "description": "HIPAA-required agreement for handling Protected Health Information (PHI)",
        "order": 1,
        "is_required": True,
        "content": """
<h2>BUSINESS ASSOCIATE AGREEMENT</h2>

<p>This Business Associate Agreement ("Agreement") is entered into as of {{current_date}} by and between:</p>

<p><strong>Covered Entity:</strong> {{company_name}}<br>
Address: {{company_full_address}}<br>
Phone: {{company_phone}}<br>
Email: {{company_email}}</p>

<p><strong>Business Associate:</strong> Mastech Medical Equipment, LLC</p>

<h3>1. DEFINITIONS</h3>
<p>Terms used, but not otherwise defined, in this Agreement shall have the same meaning as those terms in the HIPAA Rules.</p>

<h3>2. OBLIGATIONS OF BUSINESS ASSOCIATE</h3>
<p>Business Associate agrees to:</p>
<ul>
    <li>Not use or disclose Protected Health Information (PHI) other than as permitted or required by this Agreement or as required by law</li>
    <li>Use appropriate safeguards to prevent unauthorized use or disclosure of PHI</li>
    <li>Report to Covered Entity any use or disclosure of PHI not provided for by this Agreement</li>
    <li>Ensure that any subcontractors that create, receive, maintain, or transmit PHI agree to the same restrictions</li>
</ul>

<h3>3. PERMITTED USES AND DISCLOSURES</h3>
<p>Business Associate may use or disclose PHI to perform functions, activities, or services for Covered Entity as specified in this Agreement, provided that such use or disclosure would not violate HIPAA Rules.</p>

<h3>4. TERM AND TERMINATION</h3>
<p>This Agreement shall be effective as of the date first written above and shall terminate when all PHI provided by Covered Entity to Business Associate is destroyed or returned.</p>

<h3>5. SIGNATURES</h3>
<p><strong>Covered Entity Representative:</strong></p>
<p>Name: {{signer_name}}<br>
Title: {{signer_title}}<br>
Date: {{signature_date}}</p>
"""
    },
    {
        "title": "Terms of Service Agreement",
        "description": "Terms and conditions for using DME services",
        "order": 2,
        "is_required": True,
        "content": """
<h2>TERMS OF SERVICE AGREEMENT</h2>

<p>Effective Date: {{current_date}}</p>

<p>This Terms of Service Agreement ("Agreement") is between {{company_name}} ("Client") and Mastech Medical Equipment, LLC ("Provider").</p>

<h3>1. SERVICES</h3>
<p>Provider agrees to provide durable medical equipment and related services to Client's patients in accordance with all applicable laws and regulations.</p>

<h3>2. CLIENT RESPONSIBILITIES</h3>
<p>Client agrees to:</p>
<ul>
    <li>Provide accurate and complete patient information</li>
    <li>Ensure proper documentation and prescriptions</li>
    <li>Comply with all applicable healthcare regulations</li>
    <li>Maintain appropriate insurance coverage</li>
</ul>

<h3>3. PAYMENT TERMS</h3>
<p>Payment terms shall be as agreed upon separately. All invoices are due within 30 days of receipt.</p>

<h3>4. CONFIDENTIALITY</h3>
<p>Both parties agree to maintain the confidentiality of all proprietary information and patient data.</p>

<h3>5. TERM</h3>
<p>This Agreement shall remain in effect for one (1) year from the effective date and shall automatically renew for successive one-year terms unless terminated by either party with 30 days written notice.</p>

<h3>6. ACCEPTANCE</h3>
<p>By signing below, Client agrees to these Terms of Service.</p>

<p><strong>Client Representative:</strong></p>
<p>Company: {{company_name}}<br>
Name: {{signer_name}}<br>
Title: {{signer_title}}<br>
Date: {{signature_date}}</p>
"""
    },
    {
        "title": "Privacy Policy Acknowledgment",
        "description": "Acknowledgment of privacy practices and data handling",
        "order": 3,
        "is_required": True,
        "content": """
<h2>PRIVACY POLICY ACKNOWLEDGMENT</h2>

<p>Date: {{current_date}}</p>

<p>I, {{owner_name}}, on behalf of {{company_name}}, acknowledge that I have received and reviewed the Privacy Policy of Mastech Medical Equipment, LLC.</p>

<h3>I understand that:</h3>
<ul>
    <li>Patient information will be protected in accordance with HIPAA regulations</li>
    <li>Personal information may be collected for business purposes</li>
    <li>Data may be shared with authorized third parties as necessary for service delivery</li>
    <li>Appropriate security measures are in place to protect sensitive information</li>
    <li>I have the right to request access to and correction of my information</li>
</ul>

<h3>Contact Information</h3>
<p>For privacy-related inquiries, contact our Privacy Officer at privacy@mastechmedical.com</p>

<h3>ACKNOWLEDGMENT</h3>
<p>I acknowledge that I have read and understand this Privacy Policy.</p>

<p>Name: {{signer_name}}<br>
Title: {{signer_title}}<br>
Company: {{company_name}}<br>
Date: {{signature_date}}</p>
"""
    },
    {
        "title": "Insurance Verification Authorization",
        "description": "Authorization to verify insurance benefits on behalf of patients",
        "order": 4,
        "is_required": True,
        "content": """
<h2>INSURANCE VERIFICATION AUTHORIZATION</h2>

<p>Date: {{current_date}}</p>

<p><strong>Company Information:</strong><br>
{{company_name}}<br>
{{company_full_address}}<br>
Phone: {{company_phone}}<br>
Fax: {{company_fax}}<br>
NPI: {{company_npi}}</p>

<h3>AUTHORIZATION</h3>
<p>{{company_name}} hereby authorizes Mastech Medical Equipment, LLC to:</p>
<ul>
    <li>Verify insurance benefits and eligibility on behalf of our referred patients</li>
    <li>Obtain prior authorizations for durable medical equipment</li>
    <li>Communicate with insurance companies regarding claims and coverage</li>
    <li>Access necessary patient information for billing purposes</li>
</ul>

<h3>COMPLIANCE</h3>
<p>All insurance verification activities will be conducted in compliance with HIPAA regulations and applicable state laws.</p>

<h3>AUTHORIZED REPRESENTATIVE</h3>
<p>Name: {{signer_name}}<br>
Title: {{signer_title}}<br>
Date: {{signature_date}}</p>
"""
    },
    {
        "title": "W-9 Tax Information",
        "description": "Request for taxpayer identification number",
        "order": 5,
        "is_required": True,
        "content": """
<h2>W-9 TAX INFORMATION</h2>

<p>Request for Taxpayer Identification Number and Certification</p>

<h3>Part I: Taxpayer Identification</h3>
<p><strong>Legal Business Name:</strong> {{company_name}}</p>
<p><strong>Business Name/DBA:</strong> {{company_dba}}</p>
<p><strong>Business Address:</strong><br>
{{company_address}}<br>
{{company_city}}, {{company_state}} {{company_zip}}</p>
<p><strong>Employer Identification Number (EIN):</strong> {{company_ein}}</p>

<h3>Part II: Certification</h3>
<p>Under penalties of perjury, I certify that:</p>
<ol>
    <li>The number shown on this form is my correct taxpayer identification number</li>
    <li>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the IRS that I am subject to backup withholding</li>
    <li>I am a U.S. citizen or other U.S. person</li>
</ol>

<h3>SIGNATURE</h3>
<p>Name: {{signer_name}}<br>
Title: {{signer_title}}<br>
Date: {{signature_date}}</p>
"""
    },
    {
        "title": "Non-Disclosure Agreement (NDA)",
        "description": "Confidentiality agreement for proprietary information",
        "order": 6,
        "is_required": False,
        "content": """
<h2>NON-DISCLOSURE AGREEMENT</h2>

<p>Effective Date: {{current_date}}</p>

<p>This Non-Disclosure Agreement ("Agreement") is entered into between {{company_name}} ("Receiving Party") and Mastech Medical Equipment, LLC ("Disclosing Party").</p>

<h3>1. CONFIDENTIAL INFORMATION</h3>
<p>"Confidential Information" means any non-public information disclosed by either party, including but not limited to:</p>
<ul>
    <li>Business strategies and plans</li>
    <li>Financial information</li>
    <li>Customer and patient data</li>
    <li>Technical processes and procedures</li>
    <li>Pricing and contract terms</li>
</ul>

<h3>2. OBLIGATIONS</h3>
<p>The Receiving Party agrees to:</p>
<ul>
    <li>Keep all Confidential Information strictly confidential</li>
    <li>Not disclose Confidential Information to third parties without prior written consent</li>
    <li>Use Confidential Information only for the purposes of the business relationship</li>
    <li>Return or destroy all Confidential Information upon request</li>
</ul>

<h3>3. TERM</h3>
<p>This Agreement shall remain in effect for three (3) years from the date of signature.</p>

<h3>ACCEPTANCE</h3>
<p>Name: {{signer_name}}<br>
Title: {{signer_title}}<br>
Company: {{company_name}}<br>
Date: {{signature_date}}</p>
"""
    }
]

@onboarding_router.post("/templates/seed-defaults")
async def seed_default_templates(user: dict = Depends(require_super_admin)):
    """Seed default document templates (super admin only)"""
    created = 0
    
    for template_data in DEFAULT_TEMPLATES:
        # Check if already exists
        existing = await db.onboarding_templates.find_one({"title": template_data["title"]})
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
            await db.onboarding_templates.insert_one(template)
            created += 1
    
    logger.info(f"Seeded {created} default templates")
    
    return {"message": f"Created {created} default templates", "total_defaults": len(DEFAULT_TEMPLATES)}
