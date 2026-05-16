"""
Pydantic models and enums for DME CRM
"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime
from enum import Enum


# ==================== ENUMS ====================

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SALES_REP = "sales_rep"
    DOCTOR = "doctor"
    PATIENT = "patient"


class LeadStatus(str, Enum):
    NEW = "new"
    OPPORTUNITY = "opportunity"
    VERIFYING_INSURANCE = "verifying_insurance"
    QUALIFIED = "qualified"
    LOST = "lost"


class OrderStatus(str, Enum):
    PENDING = "pending"
    AWAITING_PRESCRIPTION = "awaiting_prescription"
    PRESCRIPTION_SENT = "prescription_sent"
    PRESCRIPTION_VERIFIED = "prescription_verified"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class DocumentType(str, Enum):
    RX = "rx"
    FACE_TO_FACE = "face_to_face"
    CMN = "cmn"
    SIGNED_RX = "signed_rx"


class SignatureStatus(str, Enum):
    PENDING = "pending"
    SIGNED = "signed"
    REJECTED = "rejected"


class InsuranceType(str, Enum):
    MEDICARE = "medicare"
    MEDICAID = "medicaid"
    PRIVATE = "private"
    COMMERCIAL = "commercial"
    WORKERS_COMP = "workers_comp"
    VA = "va"
    TRICARE = "tricare"
    OTHER = "other"


class FaxStatus(str, Enum):
    QUEUED = "queued"
    SENDING = "sending"
    DELIVERED = "delivered"
    FAILED = "failed"


class FaxDocumentType(str, Enum):
    MEDICAL_RECORD = "medical_record"
    INSURANCE_FORM = "insurance_form"
    AUTHORIZATION = "authorization"
    EQUIPMENT_QUOTE = "equipment_quote"
    ORDER_CONFIRMATION = "order_confirmation"
    OTHER = "other"


# ==================== USER MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool = True
    phone: Optional[str] = None
    fax: Optional[str] = None
    state: Optional[str] = None
    npi: Optional[str] = None
    specialty: Optional[str] = None
    practice_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class PublicUserRegister(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str


class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ==================== PATIENT MODELS ====================

class PatientBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    ssn_last_four: str = Field(min_length=4, max_length=4)
    primary_insurance: str
    secondary_insurance: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    user_id: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    primary_insurance: Optional[str] = None
    secondary_insurance: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    user_id: Optional[str] = None


class PatientResponse(PatientBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    storage_folder: Optional[str] = None
    converted_from_lead: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str


class PatientNoteCreate(BaseModel):
    content: str


class PatientNoteResponse(BaseModel):
    id: str
    content: str
    created_at: str
    created_by: str
    created_by_name: str


# ==================== LEAD MODELS ====================

class LeadBase(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: Optional[EmailStr] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    notes: Optional[str] = None
    pain_location: Optional[str] = None
    has_medicare: Optional[str] = None
    has_doctor: Optional[str] = None
    zip_code: Optional[str] = None
    best_time_to_call: Optional[str] = None
    form_source: Optional[str] = None
    interested_products: Optional[List[dict]] = None
    estimated_value: Optional[float] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    interested_products: Optional[List[dict]] = None
    estimated_value: Optional[float] = None


class LeadResponse(LeadBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    status: LeadStatus
    patient_id: Optional[str] = None
    storage_folder: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str


class LeadToPatientConvert(BaseModel):
    date_of_birth: str
    ssn_last_four: str = Field(min_length=4, max_length=4)
    primary_insurance: str
    secondary_insurance: Optional[str] = None
    address: Optional[str] = None


# ==================== ORDER MODELS ====================

class OrderItem(BaseModel):
    hcpcs_code: str
    description: str
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0)
    sig: Optional[str] = None


class OrderCreate(BaseModel):
    patient_id: str
    prescriber_id: str
    supplier_id: str
    items: List[OrderItem]
    equipment_type: Optional[str] = None
    diagnoses: Optional[List[dict]] = None
    notes: Optional[str] = None
    refills_allowed: int = 0
    daw: bool = False
    note_to_supplier: Optional[str] = None
    status: Optional[str] = None
    prescription_status: Optional[str] = None
    signature_data: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    notes: Optional[str] = None
    tracking_number: Optional[str] = None
    prescription_status: Optional[str] = None


class OrderResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    patient_id: str
    prescriber_id: str
    supplier_id: str
    items: List[OrderItem]
    status: OrderStatus
    total_amount: float
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str


# ==================== SUPPLIER MODELS ====================

class SupplierBase(BaseModel):
    name: str
    api_endpoint_url: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True
    product_tags: List[str] = []


class SupplierCreate(SupplierBase):
    api_key: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    api_endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None
    product_tags: Optional[List[str]] = None


class SupplierResponse(SupplierBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    inventory_status: str = "unknown"
    created_at: datetime
    updated_at: datetime


# ==================== INSURANCE COMPANY MODELS ====================

class InsuranceCompanyBase(BaseModel):
    name: str
    insurance_type: InsuranceType
    payer_id: Optional[str] = None
    phone_main: Optional[str] = None
    phone_dme: Optional[str] = None
    phone_prior_auth: Optional[str] = None
    phone_claims: Optional[str] = None
    fax_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    address: Optional[str] = None
    dme_requirements: Optional[str] = None
    prior_auth_required: bool = False
    timely_filing_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool = True


class InsuranceCompanyCreate(InsuranceCompanyBase):
    pass


class InsuranceCompanyUpdate(BaseModel):
    name: Optional[str] = None
    insurance_type: Optional[InsuranceType] = None
    payer_id: Optional[str] = None
    phone_main: Optional[str] = None
    phone_dme: Optional[str] = None
    phone_prior_auth: Optional[str] = None
    phone_claims: Optional[str] = None
    fax_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    address: Optional[str] = None
    dme_requirements: Optional[str] = None
    prior_auth_required: Optional[bool] = None
    timely_filing_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class InsuranceCompanyResponse(InsuranceCompanyBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: datetime
    updated_at: datetime


# ==================== DOCUMENT MODELS ====================

class DocumentBase(BaseModel):
    patient_id: str
    order_id: Optional[str] = None
    document_type: DocumentType
    file_name: str


class DocumentCreate(DocumentBase):
    file_path: str


class DocumentUpdate(BaseModel):
    signature_status: Optional[SignatureStatus] = None
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None


class DocumentResponse(DocumentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    file_path: str
    signature_status: SignatureStatus
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None
    created_at: datetime
    uploaded_by: str


# ==================== AUDIT LOG MODELS ====================

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_email: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    timestamp: datetime


# ==================== FAX MODELS ====================

class FaxSettingsUpdate(BaseModel):
    telnyx_api_key: Optional[str] = None
    telnyx_fax_number: Optional[str] = None
    telnyx_connection_id: Optional[str] = None
    webhook_url: Optional[str] = None
    is_enabled: Optional[bool] = None


class FaxSettingsResponse(BaseModel):
    is_configured: bool
    is_enabled: bool
    fax_number: Optional[str] = None
    has_api_key: bool
    has_connection_id: bool
    webhook_url: Optional[str] = None
    updated_at: Optional[str] = None


class SendFaxRequest(BaseModel):
    recipient_fax_number: str
    recipient_name: str
    document_type: FaxDocumentType = FaxDocumentType.OTHER
    file_url: str
    notes: Optional[str] = None
    patient_id: Optional[str] = None
    order_id: Optional[str] = None


class FaxResponse(BaseModel):
    fax_id: str
    status: FaxStatus
    recipient_fax_number: str
    recipient_name: str
    document_type: str
    created_at: str
    message: str


class FaxHistoryItem(BaseModel):
    id: str
    fax_id: str
    recipient_name: str
    recipient_fax_number: str
    document_type: str
    status: str
    created_at: str
    updated_at: str
    page_count: Optional[int] = None
    failure_reason: Optional[str] = None
    patient_id: Optional[str] = None
    order_id: Optional[str] = None


class FaxCoverPageRequest(BaseModel):
    recipient_name: str
    recipient_fax: str
    recipient_organization: Optional[str] = None
    sender_name: str
    sender_fax: Optional[str] = None
    sender_phone: Optional[str] = None
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    pages_following: int = 1
    subject: Optional[str] = None
    message: Optional[str] = None
    urgent: bool = False
    confidentiality_notice: bool = True


# ==================== SETTINGS MODELS ====================

class StorageSettingsModel(BaseModel):
    endpoint: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    bucket_name: Optional[str] = None
    folder_path: Optional[str] = None
    use_presigned_urls: bool = True


class EmailSettingsModel(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = "587"
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    use_tls: bool = True
