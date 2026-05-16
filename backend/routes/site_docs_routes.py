"""
Site Documents Routes
Handles public-facing legal documents (Terms, Privacy Policy, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid
import os
import logging

logger = logging.getLogger(__name__)

site_docs_router = APIRouter(prefix="/site-documents", tags=["site-documents"])
security = HTTPBearer()

# Database reference (set by main app)
db = None

def set_database(database):
    global db
    db = database

# =============================================================================
# MODELS
# =============================================================================

class DocumentType(str, Enum):
    TERMS = "terms"
    PRIVACY = "privacy"
    HIPAA = "hipaa"
    ACCESSIBILITY = "accessibility"
    COOKIE = "cookie"
    DISCLAIMER = "disclaimer"
    REFUND = "refund"
    SHIPPING = "shipping"
    OTHER = "other"

class SiteDocTemplate(BaseModel):
    id: Optional[str] = None
    title: str
    slug: str  # URL-friendly identifier
    doc_type: DocumentType = DocumentType.OTHER
    description: Optional[str] = None
    content: str  # HTML content with variables
    is_published: bool = False
    show_in_footer: bool = True
    footer_order: int = 0
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    last_updated: Optional[str] = None
    updated_by: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None

class SiteDocCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    doc_type: DocumentType = DocumentType.OTHER
    description: Optional[str] = None
    content: str
    is_published: bool = False
    show_in_footer: bool = True
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class SiteDocUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    doc_type: Optional[DocumentType] = None
    description: Optional[str] = None
    content: Optional[str] = None
    is_published: Optional[bool] = None
    show_in_footer: Optional[bool] = None
    footer_order: Optional[int] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

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

async def require_admin(user: dict = Depends(get_current_user)):
    """Require admin or super admin role"""
    if user.get("role") not in ["admin", "super_admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title"""
    return title.lower().replace(" ", "-").replace("&", "and").replace("'", "")

async def get_company_info():
    """Get company info for template variables"""
    if db is None:
        return {}
    settings = await db.site_settings.find_one({"type": "company_info"}, {"_id": 0})
    return settings or {}

def fill_template_variables(content: str, company_info: dict) -> str:
    """Replace template variables with company data"""
    replacements = {
        "{{company_name}}": company_info.get("company_name", "[Company Name]"),
        "{{company_address}}": company_info.get("company_address", "[Company Address]"),
        "{{company_city}}": company_info.get("company_city", "[City]"),
        "{{company_state}}": company_info.get("company_state", "[State]"),
        "{{company_zip}}": company_info.get("company_zip", "[ZIP]"),
        "{{company_full_address}}": f"{company_info.get('company_address', '[Address]')}, {company_info.get('company_city', '[City]')}, {company_info.get('company_state', '[State]')} {company_info.get('company_zip', '[ZIP]')}",
        "{{company_phone}}": company_info.get("company_phone", "[Phone]"),
        "{{company_email}}": company_info.get("company_email", "[Email]"),
        "{{company_website}}": company_info.get("company_website", "[Website]"),
        "{{current_date}}": datetime.now(timezone.utc).strftime("%B %d, %Y"),
        "{{current_year}}": str(datetime.now(timezone.utc).year),
    }
    
    for var, value in replacements.items():
        content = content.replace(var, value or "")
    
    return content

# =============================================================================
# PUBLIC ENDPOINTS (No Auth Required)
# =============================================================================

@site_docs_router.get("/public/list")
async def get_public_documents():
    """Get list of published site documents (for footer links)"""
    docs = await db.site_documents.find(
        {"is_published": True, "show_in_footer": True},
        {"_id": 0, "content": 0}  # Exclude content for list view
    ).sort("footer_order", 1).to_list(20)
    
    return {"documents": docs}

@site_docs_router.get("/public/{slug}")
async def get_public_document(slug: str):
    """Get a published document by slug (for public viewing)"""
    doc = await db.site_documents.find_one(
        {"slug": slug, "is_published": True},
        {"_id": 0}
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Fill template variables
    company_info = await get_company_info()
    filled_content = fill_template_variables(doc.get("content", ""), company_info)
    doc["filled_content"] = filled_content
    
    return doc

# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@site_docs_router.get("/list")
async def list_site_documents(user: dict = Depends(require_admin)):
    """Get all site documents (admin view)"""
    docs = await db.site_documents.find(
        {},
        {"_id": 0}
    ).sort("footer_order", 1).to_list(50)
    
    return {"documents": docs, "total": len(docs)}

@site_docs_router.get("/{doc_id}")
async def get_site_document(doc_id: str, user: dict = Depends(require_admin)):
    """Get a specific document"""
    doc = await db.site_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Include preview with filled variables
    company_info = await get_company_info()
    doc["preview_content"] = fill_template_variables(doc.get("content", ""), company_info)
    
    return doc

@site_docs_router.post("")
async def create_site_document(doc: SiteDocCreate, user: dict = Depends(require_admin)):
    """Create a new site document"""
    doc_id = str(uuid.uuid4())
    
    # Generate slug if not provided
    slug = doc.slug or generate_slug(doc.title)
    
    # Check for duplicate slug
    existing = await db.site_documents.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail="A document with this slug already exists")
    
    # Get next order number
    last_doc = await db.site_documents.find_one({}, sort=[("footer_order", -1)])
    next_order = (last_doc.get("footer_order", 0) + 1) if last_doc else 1
    
    doc_dict = doc.dict()
    doc_dict["id"] = doc_id
    doc_dict["slug"] = slug
    doc_dict["footer_order"] = next_order
    doc_dict["created_by"] = user.get("id")
    doc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    doc_dict["last_updated"] = datetime.now(timezone.utc).isoformat()
    doc_dict["updated_by"] = user.get("id")
    
    await db.site_documents.insert_one(doc_dict)
    
    logger.info(f"Site document created: {doc.title} by {user.get('email')}")
    
    return {"id": doc_id, "slug": slug, "message": "Document created"}

@site_docs_router.put("/{doc_id}")
async def update_site_document(doc_id: str, update: SiteDocUpdate, user: dict = Depends(require_admin)):
    """Update a site document"""
    existing = await db.site_documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check for duplicate slug if changing
    if update.slug and update.slug != existing.get("slug"):
        dupe = await db.site_documents.find_one({"slug": update.slug, "id": {"$ne": doc_id}})
        if dupe:
            raise HTTPException(status_code=400, detail="A document with this slug already exists")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    update_dict["last_updated"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = user.get("id")
    
    await db.site_documents.update_one(
        {"id": doc_id},
        {"$set": update_dict}
    )
    
    logger.info(f"Site document updated: {doc_id}")
    
    return {"message": "Document updated"}

@site_docs_router.delete("/{doc_id}")
async def delete_site_document(doc_id: str, user: dict = Depends(require_admin)):
    """Delete a site document"""
    existing = await db.site_documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.site_documents.delete_one({"id": doc_id})
    
    logger.info(f"Site document deleted: {doc_id}")
    
    return {"message": "Document deleted"}

@site_docs_router.post("/reorder")
async def reorder_documents(doc_ids: List[str], user: dict = Depends(require_admin)):
    """Reorder footer documents"""
    for idx, doc_id in enumerate(doc_ids):
        await db.site_documents.update_one(
            {"id": doc_id},
            {"$set": {"footer_order": idx + 1, "last_updated": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Documents reordered"}

@site_docs_router.post("/{doc_id}/publish")
async def toggle_publish(doc_id: str, user: dict = Depends(require_admin)):
    """Toggle document publish status"""
    existing = await db.site_documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    new_status = not existing.get("is_published", False)
    
    await db.site_documents.update_one(
        {"id": doc_id},
        {"$set": {
            "is_published": new_status,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.get("id")
        }}
    )
    
    status_text = "published" if new_status else "unpublished"
    logger.info(f"Site document {status_text}: {doc_id}")
    
    return {"message": f"Document {status_text}", "is_published": new_status}

# =============================================================================
# DEFAULT TEMPLATES
# =============================================================================

DEFAULT_SITE_DOCUMENTS = [
    {
        "title": "Terms and Conditions",
        "slug": "terms-and-conditions",
        "doc_type": "terms",
        "description": "Terms of service for using our website and services",
        "show_in_footer": True,
        "meta_title": "Terms and Conditions | {{company_name}}",
        "meta_description": "Read our terms and conditions for using {{company_name}} services.",
        "content": """
<h1>Terms and Conditions</h1>
<p><strong>Last Updated:</strong> {{current_date}}</p>

<p>Welcome to {{company_name}}. By accessing or using our website and services, you agree to be bound by these Terms and Conditions.</p>

<h2>1. Acceptance of Terms</h2>
<p>By accessing this website, you accept these terms and conditions in full. If you disagree with any part of these terms, you must not use our website or services.</p>

<h2>2. Services</h2>
<p>{{company_name}} provides durable medical equipment (DME) and related services. Our services include:</p>
<ul>
    <li>Medical equipment sales and rentals</li>
    <li>Equipment setup and training</li>
    <li>Insurance billing and verification</li>
    <li>Ongoing support and maintenance</li>
</ul>

<h2>3. User Responsibilities</h2>
<p>As a user of our services, you agree to:</p>
<ul>
    <li>Provide accurate and complete information</li>
    <li>Use equipment only as prescribed and instructed</li>
    <li>Maintain equipment in good condition</li>
    <li>Notify us of any issues or concerns promptly</li>
    <li>Meet financial obligations in a timely manner</li>
</ul>

<h2>4. Intellectual Property</h2>
<p>All content on this website, including text, graphics, logos, and images, is the property of {{company_name}} and is protected by copyright laws.</p>

<h2>5. Limitation of Liability</h2>
<p>{{company_name}} shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services or website.</p>

<h2>6. Privacy</h2>
<p>Your use of our services is also governed by our Privacy Policy. Please review our Privacy Policy for information on how we collect, use, and protect your personal information.</p>

<h2>7. HIPAA Compliance</h2>
<p>{{company_name}} is committed to protecting your health information in accordance with the Health Insurance Portability and Accountability Act (HIPAA).</p>

<h2>8. Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to our website.</p>

<h2>9. Contact Information</h2>
<p>If you have questions about these Terms and Conditions, please contact us:</p>
<p>
{{company_name}}<br>
{{company_full_address}}<br>
Phone: {{company_phone}}<br>
Email: {{company_email}}
</p>
"""
    },
    {
        "title": "Privacy Policy",
        "slug": "privacy-policy",
        "doc_type": "privacy",
        "description": "How we collect, use, and protect your personal information",
        "show_in_footer": True,
        "meta_title": "Privacy Policy | {{company_name}}",
        "meta_description": "Learn how {{company_name}} protects your privacy and handles your personal information.",
        "content": """
<h1>Privacy Policy</h1>
<p><strong>Last Updated:</strong> {{current_date}}</p>

<p>{{company_name}} ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.</p>

<h2>1. Information We Collect</h2>
<h3>Personal Information</h3>
<p>We may collect personal information that you provide directly to us, including:</p>
<ul>
    <li>Name, address, phone number, and email address</li>
    <li>Date of birth and Social Security Number</li>
    <li>Insurance information and policy numbers</li>
    <li>Medical information and prescriptions</li>
    <li>Payment information</li>
</ul>

<h3>Automatically Collected Information</h3>
<p>When you visit our website, we may automatically collect:</p>
<ul>
    <li>IP address and browser type</li>
    <li>Device information</li>
    <li>Pages visited and time spent on our site</li>
    <li>Referring website addresses</li>
</ul>

<h2>2. How We Use Your Information</h2>
<p>We use the information we collect to:</p>
<ul>
    <li>Provide and improve our services</li>
    <li>Process orders and insurance claims</li>
    <li>Communicate with you about your care</li>
    <li>Send important notices and updates</li>
    <li>Comply with legal obligations</li>
</ul>

<h2>3. HIPAA Compliance</h2>
<p>As a healthcare provider, we are required to comply with the Health Insurance Portability and Accountability Act (HIPAA). We maintain appropriate safeguards to protect your Protected Health Information (PHI).</p>

<h2>4. Information Sharing</h2>
<p>We may share your information with:</p>
<ul>
    <li>Healthcare providers involved in your care</li>
    <li>Insurance companies for billing purposes</li>
    <li>Business associates bound by confidentiality agreements</li>
    <li>Government agencies as required by law</li>
</ul>

<h2>5. Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>

<h2>6. Your Rights</h2>
<p>You have the right to:</p>
<ul>
    <li>Access your personal information</li>
    <li>Request corrections to inaccurate information</li>
    <li>Request restrictions on certain uses of your information</li>
    <li>Receive a copy of your health records</li>
    <li>File a complaint if you believe your privacy rights have been violated</li>
</ul>

<h2>7. Cookies and Tracking</h2>
<p>Our website uses cookies to enhance your experience. You can control cookie settings through your browser preferences.</p>

<h2>8. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our website.</p>

<h2>9. Contact Us</h2>
<p>For questions about this Privacy Policy or to exercise your rights, contact:</p>
<p>
Privacy Officer<br>
{{company_name}}<br>
{{company_full_address}}<br>
Phone: {{company_phone}}<br>
Email: {{company_email}}
</p>
"""
    },
    {
        "title": "HIPAA Notice of Privacy Practices",
        "slug": "hipaa-notice",
        "doc_type": "hipaa",
        "description": "Notice describing how medical information may be used and disclosed",
        "show_in_footer": True,
        "meta_title": "HIPAA Notice | {{company_name}}",
        "meta_description": "HIPAA Notice of Privacy Practices for {{company_name}}.",
        "content": """
<h1>HIPAA Notice of Privacy Practices</h1>
<p><strong>Effective Date:</strong> {{current_date}}</p>

<p><strong>THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.</strong></p>

<h2>Our Commitment to Your Privacy</h2>
<p>{{company_name}} is committed to protecting the privacy of your health information. We are required by law to maintain the privacy of your Protected Health Information (PHI) and to provide you with this Notice of our legal duties and privacy practices.</p>

<h2>How We May Use and Disclose Your Health Information</h2>

<h3>For Treatment</h3>
<p>We may use and disclose your health information to coordinate your medical care. For example, we may share information with your physician regarding equipment you receive from us.</p>

<h3>For Payment</h3>
<p>We may use and disclose your health information to bill and collect payment for services provided. This may include contacting your insurance company and submitting claims on your behalf.</p>

<h3>For Healthcare Operations</h3>
<p>We may use and disclose your health information for our healthcare operations, such as quality improvement activities, training, and compliance activities.</p>

<h2>Other Uses and Disclosures</h2>
<p>We may also use or disclose your health information:</p>
<ul>
    <li>As required by law</li>
    <li>For public health activities</li>
    <li>To report abuse or neglect</li>
    <li>For health oversight activities</li>
    <li>For judicial and administrative proceedings</li>
    <li>For law enforcement purposes</li>
    <li>To avert a serious threat to health or safety</li>
</ul>

<h2>Your Rights</h2>
<p>You have the following rights regarding your health information:</p>
<ul>
    <li><strong>Right to Access:</strong> You may request copies of your health records</li>
    <li><strong>Right to Amend:</strong> You may request corrections to your records</li>
    <li><strong>Right to an Accounting:</strong> You may request a list of disclosures we have made</li>
    <li><strong>Right to Request Restrictions:</strong> You may request limits on how we use your information</li>
    <li><strong>Right to Confidential Communications:</strong> You may request that we communicate with you in a specific way</li>
    <li><strong>Right to a Paper Copy:</strong> You may request a paper copy of this notice</li>
</ul>

<h2>Our Duties</h2>
<p>We are required to:</p>
<ul>
    <li>Maintain the privacy of your health information</li>
    <li>Provide you with this notice of our privacy practices</li>
    <li>Notify you if your information is breached</li>
    <li>Follow the terms of this notice currently in effect</li>
</ul>

<h2>Changes to This Notice</h2>
<p>We reserve the right to change this notice and our privacy practices. Changes will be effective for all information we maintain.</p>

<h2>Complaints</h2>
<p>If you believe your privacy rights have been violated, you may file a complaint with us or with the Secretary of the U.S. Department of Health and Human Services. You will not be penalized for filing a complaint.</p>

<h2>Contact Information</h2>
<p>
Privacy Officer<br>
{{company_name}}<br>
{{company_full_address}}<br>
Phone: {{company_phone}}<br>
Email: {{company_email}}
</p>
"""
    },
    {
        "title": "Accessibility Statement",
        "slug": "accessibility",
        "doc_type": "accessibility",
        "description": "Our commitment to digital accessibility",
        "show_in_footer": True,
        "meta_title": "Accessibility | {{company_name}}",
        "meta_description": "{{company_name}}'s commitment to website accessibility for all users.",
        "content": """
<h1>Accessibility Statement</h1>
<p><strong>Last Updated:</strong> {{current_date}}</p>

<h2>Our Commitment</h2>
<p>{{company_name}} is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards.</p>

<h2>Conformance Status</h2>
<p>We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. These guidelines explain how to make web content more accessible for people with disabilities.</p>

<h2>Accessibility Features</h2>
<p>Our website includes the following accessibility features:</p>
<ul>
    <li>Keyboard navigation support</li>
    <li>Screen reader compatibility</li>
    <li>Alternative text for images</li>
    <li>Clear heading structure</li>
    <li>Sufficient color contrast</li>
    <li>Resizable text</li>
    <li>Skip navigation links</li>
</ul>

<h2>Known Limitations</h2>
<p>While we strive for accessibility, some content may have limitations. We are actively working to address these issues.</p>

<h2>Feedback</h2>
<p>We welcome your feedback on the accessibility of our website. Please contact us if you encounter any barriers:</p>
<p>
{{company_name}}<br>
Phone: {{company_phone}}<br>
Email: {{company_email}}
</p>

<h2>Assistive Technologies</h2>
<p>Our website is designed to be compatible with:</p>
<ul>
    <li>Screen readers (JAWS, NVDA, VoiceOver)</li>
    <li>Screen magnification software</li>
    <li>Speech recognition software</li>
    <li>Keyboard-only navigation</li>
</ul>
"""
    },
    {
        "title": "Refund & Return Policy",
        "slug": "refund-policy",
        "doc_type": "refund",
        "description": "Our policy on refunds and equipment returns",
        "show_in_footer": True,
        "meta_title": "Refund Policy | {{company_name}}",
        "meta_description": "Learn about {{company_name}}'s refund and return policy for medical equipment.",
        "content": """
<h1>Refund & Return Policy</h1>
<p><strong>Last Updated:</strong> {{current_date}}</p>

<h2>Overview</h2>
<p>At {{company_name}}, we want you to be satisfied with your medical equipment. This policy outlines our procedures for returns, exchanges, and refunds.</p>

<h2>Return Eligibility</h2>
<p>Items may be returned within 30 days of delivery if:</p>
<ul>
    <li>The item is in its original, unopened packaging</li>
    <li>The item is unused and in resalable condition</li>
    <li>You have the original receipt or proof of purchase</li>
</ul>

<h2>Non-Returnable Items</h2>
<p>For health and safety reasons, the following items cannot be returned:</p>
<ul>
    <li>Items that have been used or worn</li>
    <li>Customized or special-order items</li>
    <li>Disposable supplies (masks, tubing, filters)</li>
    <li>Personal care items</li>
    <li>Items without original packaging</li>
</ul>

<h2>Rental Equipment</h2>
<p>Rental equipment must be returned in good working condition. You may be charged for:</p>
<ul>
    <li>Damage beyond normal wear and tear</li>
    <li>Missing accessories or components</li>
    <li>Late return fees</li>
</ul>

<h2>Defective or Damaged Items</h2>
<p>If you receive a defective or damaged item, please contact us within 48 hours of delivery. We will arrange for repair, replacement, or refund at no additional cost.</p>

<h2>How to Return</h2>
<ol>
    <li>Contact our customer service team to initiate a return</li>
    <li>Receive a Return Authorization (RA) number</li>
    <li>Pack the item securely in its original packaging</li>
    <li>Include the RA number and a copy of your receipt</li>
    <li>Ship the item to our return address</li>
</ol>

<h2>Refund Processing</h2>
<p>Once we receive and inspect your return, we will process your refund:</p>
<ul>
    <li>Credit card refunds: 5-10 business days</li>
    <li>Check refunds: 2-3 weeks</li>
    <li>Insurance adjustments: Varies by carrier</li>
</ul>

<h2>Questions?</h2>
<p>
{{company_name}}<br>
Phone: {{company_phone}}<br>
Email: {{company_email}}
</p>
"""
    }
]

@site_docs_router.post("/seed-defaults")
async def seed_default_documents(user: dict = Depends(require_admin)):
    """Seed default site documents"""
    created = 0
    
    for doc_data in DEFAULT_SITE_DOCUMENTS:
        existing = await db.site_documents.find_one({"slug": doc_data["slug"]})
        if not existing:
            doc_id = str(uuid.uuid4())
            doc = {
                "id": doc_id,
                **doc_data,
                "is_published": False,  # Start unpublished
                "footer_order": DEFAULT_SITE_DOCUMENTS.index(doc_data) + 1,
                "created_by": user.get("id"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "updated_by": user.get("id")
            }
            await db.site_documents.insert_one(doc)
            created += 1
    
    logger.info(f"Seeded {created} default site documents")
    
    return {"message": f"Created {created} default documents", "total_defaults": len(DEFAULT_SITE_DOCUMENTS)}
