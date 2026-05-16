from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, Response, HTMLResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from io import BytesIO
import httpx
import re
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from urllib.parse import urlsplit, urlunsplit

# Import secure transmission utilities
try:
    from utils.secure_transmission import (
        SecureLeadTransmission, 
        check_rate_limit, 
        get_public_encryption_config,
        secure_transmission
    )
    SECURE_TRANSMISSION_AVAILABLE = True
except ImportError:
    SECURE_TRANSMISSION_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Secure transmission module not available")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def _build_fax_encryption_cipher() -> Fernet:
    secret = (JWT_SECRET or "").encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


FAX_ENCRYPTION_CIPHER = _build_fax_encryption_cipher()


def encrypt_fax_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return FAX_ENCRYPTION_CIPHER.encrypt(text.encode("utf-8")).decode("utf-8")


def decrypt_fax_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return FAX_ENCRYPTION_CIPHER.decrypt(value.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def mask_fax_number(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) <= 4:
        return f"***{digits}"
    return f"***-***-{digits[-4:]}"


def get_fax_recipient_name(fax_doc: dict) -> Optional[str]:
    return decrypt_fax_value(fax_doc.get("recipient_name_encrypted")) or fax_doc.get("recipient_name")


def get_fax_recipient_number(fax_doc: dict) -> Optional[str]:
    return decrypt_fax_value(fax_doc.get("recipient_fax_number_encrypted")) or fax_doc.get("recipient_fax_number")

# Create the main app
app = FastAPI(title="DME CRM API", description="HIPAA-Compliant DME CRM System")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

A2G_ANALYTICS_SCRIPT = '<script data-host="https://a2ganalytics.com" data-dnt="false" src="https://a2ganalytics.com/js/script.js" id="ZwSg9rf6GA" async defer></script>'
LOCATION_PAGE_NAME_RE = re.compile(r"^durable-medical-equipment-in-[a-z0-9-]+\.html$")
US_REGION_MAP = {
    "northeast": ["Connecticut", "Maine", "Massachusetts", "New Hampshire", "New Jersey", "New York", "Pennsylvania", "Rhode Island", "Vermont"],
    "southeast": ["Alabama", "Arkansas", "Florida", "Georgia", "Kentucky", "Louisiana", "Maryland", "Mississippi", "North Carolina", "South Carolina", "Tennessee", "Virginia", "West Virginia", "Delaware"],
    "midwest": ["Illinois", "Indiana", "Iowa", "Kansas", "Michigan", "Minnesota", "Missouri", "Nebraska", "North Dakota", "Ohio", "South Dakota", "Wisconsin"],
    "southwest": ["Arizona", "New Mexico", "Oklahoma", "Texas"],
    "west": ["Alaska", "California", "Colorado", "Hawaii", "Idaho", "Montana", "Nevada", "Oregon", "Utah", "Washington", "Wyoming"],
}
REGION_LABELS = {
    "northeast": "Northeast",
    "southeast": "Southeast",
    "midwest": "Midwest",
    "southwest": "Southwest",
    "west": "West",
    "other": "Other",
}


def normalize_public_site_url(raw_url: Optional[str]) -> str:
    candidate = (raw_url or "").strip()
    if not candidate:
        return "https://medinovadme.com"

    parsed = urlsplit(candidate if "://" in candidate else f"https://{candidate}")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "https://medinovadme.com"

    return urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")


def is_safe_location_page_name(page_name: str) -> bool:
    return bool(page_name and LOCATION_PAGE_NAME_RE.fullmatch(page_name))


def get_us_region(state_name: str) -> str:
    for region, states in US_REGION_MAP.items():
        if state_name in states:
            return region
    return "other"


# ==================== STORAGE SERVICE ====================
class StorageService:
    """
    Centralized storage service for iDrive E2 (S3-compatible).
    All file uploads in the platform should use this service.
    """
    
    _instance = None
    _client = None
    _settings = None
    
    @classmethod
    async def get_settings(cls):
        """Fetch storage settings from database"""
        settings = await db.site_settings.find_one({"type": "storage"})
        return settings
    
    @classmethod
    async def get_client(cls):
        """Get or create S3 client with current settings"""
        settings = await cls.get_settings()
        if not settings:
            return None, "Storage not configured"
        
        required = ["endpoint", "access_key", "secret_key", "bucket_name"]
        missing = [f for f in required if not settings.get(f)]
        if missing:
            return None, f"Missing storage settings: {', '.join(missing)}"
        
        try:
            client = boto3.client(
                's3',
                endpoint_url=settings['endpoint'],
                aws_access_key_id=settings['access_key'],
                aws_secret_access_key=settings['secret_key'],
                region_name='us-east-1'  # Required but ignored by E2
            )
            return client, settings
        except Exception as e:
            logger.error(f"Failed to create S3 client: {e}")
            return None, str(e)
    
    @classmethod
    async def test_connection(cls):
        """Test the storage connection"""
        client, settings = await cls.get_client()
        if not client:
            return False, settings  # settings contains error message
        
        try:
            # Try to list objects (head bucket can fail on some S3-compatible services)
            client.list_objects_v2(Bucket=settings['bucket_name'], MaxKeys=1)
            return True, "Connection successful"
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchBucket':
                return False, f"Bucket '{settings['bucket_name']}' does not exist"
            return False, f"Connection failed: {error_code}"
        except NoCredentialsError:
            return False, "Invalid credentials"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
    
    @classmethod
    async def upload_file(cls, file_data: bytes, filename: str, content_type: str = None, folder: str = None):
        """
        Upload a file to storage.
        
        Args:
            file_data: File content as bytes
            filename: Original filename
            content_type: MIME type of the file
            folder: Optional subfolder within the base folder
        
        Returns:
            tuple: (success: bool, result: str or dict)
        """
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            # Generate unique filename to prevent collisions
            file_ext = Path(filename).suffix
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            
            # Build the full key (path) in the bucket
            base_folder = settings.get('folder_path', '').strip('/')
            if folder:
                folder = folder.strip('/')
                if base_folder:
                    key = f"{base_folder}/{folder}/{unique_filename}"
                else:
                    key = f"{folder}/{unique_filename}"
            else:
                if base_folder:
                    key = f"{base_folder}/{unique_filename}"
                else:
                    key = unique_filename
            
            # Upload with metadata
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            extra_args['Metadata'] = {
                'original-filename': filename,
                'uploaded-at': datetime.now(timezone.utc).isoformat()
            }
            
            client.put_object(
                Bucket=settings['bucket_name'],
                Key=key,
                Body=file_data,
                **extra_args
            )
            
            # Generate presigned URL for access (valid for 1 hour)
            try:
                url = client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': settings['bucket_name'], 'Key': key},
                    ExpiresIn=3600
                )
            except Exception:
                # Fallback to direct URL
                url = f"{settings['endpoint']}/{settings['bucket_name']}/{key}"
            
            return True, {
                'key': key,
                'url': url,
                'filename': filename,
                'size': len(file_data),
                'content_type': content_type
            }
        except ClientError as e:
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"Upload failed: {error_msg}")
            return False, f"Upload failed: {error_msg}"
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return False, f"Upload failed: {str(e)}"
    
    @classmethod
    async def get_file(cls, key: str):
        """
        Get a file from storage.
        
        Returns:
            tuple: (success: bool, result: bytes or error message)
        """
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            response = client.get_object(Bucket=settings['bucket_name'], Key=key)
            file_data = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            metadata = response.get('Metadata', {})
            
            return True, {
                'data': file_data,
                'content_type': content_type,
                'metadata': metadata
            }
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                return False, "File not found"
            return False, f"Failed to get file: {error_code}"
        except Exception as e:
            return False, f"Failed to get file: {str(e)}"
    
    @classmethod
    async def delete_file(cls, key: str):
        """Delete a file from storage"""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            client.delete_object(Bucket=settings['bucket_name'], Key=key)
            return True, "File deleted"
        except Exception as e:
            return False, f"Failed to delete file: {str(e)}"
    
    @classmethod
    async def generate_presigned_url(cls, key: str, expiration: int = 3600):
        """
        Generate a presigned URL for temporary access to a file.
        
        Args:
            key: The file key in storage
            expiration: URL expiration time in seconds (default 1 hour)
        
        Returns:
            tuple: (success: bool, url or error message)
        """
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            url = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings['bucket_name'], 'Key': key},
                ExpiresIn=expiration
            )
            return True, url
        except Exception as e:
            return False, f"Failed to generate URL: {str(e)}"
    
    @classmethod
    async def list_files(cls, prefix: str = None, max_keys: int = 100):
        """List files in storage with optional prefix filter"""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            params = {'Bucket': settings['bucket_name'], 'MaxKeys': max_keys}
            
            base_folder = settings.get('folder_path', '').strip('/')
            if prefix:
                if base_folder:
                    params['Prefix'] = f"{base_folder}/{prefix}"
                else:
                    params['Prefix'] = prefix
            elif base_folder:
                params['Prefix'] = base_folder
            
            response = client.list_objects_v2(**params)
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })
            
            return True, files
        except Exception as e:
            return False, f"Failed to list files: {str(e)}"
    
    @classmethod
    async def create_folder(cls, folder_path: str):
        """
        Create a folder in storage by uploading a placeholder file.
        S3-compatible storage doesn't have real folders, but we create a placeholder.
        
        Args:
            folder_path: The folder path to create (e.g., 'leads/lead-123')
        
        Returns:
            tuple: (success: bool, folder_path or error message)
        """
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            # Build the full key (path) in the bucket
            base_folder = settings.get('folder_path', '').strip('/')
            folder_path = folder_path.strip('/')
            
            if base_folder:
                full_path = f"{base_folder}/{folder_path}/.folder"
            else:
                full_path = f"{folder_path}/.folder"
            
            # Create a placeholder file to establish the folder
            client.put_object(
                Bucket=settings['bucket_name'],
                Key=full_path,
                Body=b'',
                ContentType='application/x-directory'
            )
            
            return True, folder_path
        except Exception as e:
            logger.error(f"Failed to create folder: {e}")
            return False, f"Failed to create folder: {str(e)}"
    
    @classmethod
    async def get_folder_files(cls, folder_path: str, max_keys: int = 100):
        """
        List all files in a specific folder with download URLs.
        
        Args:
            folder_path: The folder path (e.g., 'leads/lead-123')
            max_keys: Maximum number of files to return
        
        Returns:
            tuple: (success: bool, list of files or error message)
        """
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            base_folder = settings.get('folder_path', '').strip('/')
            folder_path = folder_path.strip('/')
            
            if base_folder:
                prefix = f"{base_folder}/{folder_path}/"
            else:
                prefix = f"{folder_path}/"
            
            response = client.list_objects_v2(
                Bucket=settings['bucket_name'],
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            files = []
            for obj in response.get('Contents', []):
                # Skip the placeholder file
                if obj['Key'].endswith('.folder'):
                    continue
                
                key = obj['Key']
                filename = key.split('/')[-1]
                
                # Generate presigned URL for download/play (valid for 1 hour)
                try:
                    url = client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': settings['bucket_name'], 'Key': key},
                        ExpiresIn=3600
                    )
                except Exception:
                    # Fallback to direct URL if presigned fails
                    url = f"{settings['endpoint']}/{settings['bucket_name']}/{key}"
                
                # Detect content type from filename
                content_type = 'application/octet-stream'
                ext = filename.split('.')[-1].lower() if '.' in filename else ''
                content_types = {
                    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
                    'wma': 'audio/x-ms-wma', 'flac': 'audio/flac', 'aac': 'audio/aac',
                    'm4a': 'audio/mp4',
                    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm',
                    'wmv': 'video/x-ms-wmv', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                    'gif': 'image/gif', 'webp': 'image/webp',
                    'pdf': 'application/pdf'
                }
                content_type = content_types.get(ext, content_type)
                
                files.append({
                    'key': key,
                    'filename': filename,
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'url': url,
                    'content_type': content_type
                })
            
            return True, files
        except Exception as e:
            return False, f"Failed to list folder files: {str(e)}"


# ==================== ENUMS ====================
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SALES_REP = "sales_rep"
    DOCTOR = "doctor"
    PATIENT = "patient"

class LeadStatus(str, Enum):
    NEW = "new"
    OPPORTUNITY = "opportunity"  # New leads from website forms
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
    CMN = "cmn"  # Certificate of Medical Necessity
    SIGNED_RX = "signed_rx"

class SignatureStatus(str, Enum):
    PENDING = "pending"
    SIGNED = "signed"
    REJECTED = "rejected"

# ==================== MODELS ====================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool = True
    phone: Optional[str] = None
    fax: Optional[str] = None  # Fax number for doctors
    state: Optional[str] = None  # State for doctors (e.g., "VA", "NC")
    npi: Optional[str] = None  # National Provider Identifier for doctors
    specialty: Optional[str] = None
    practice_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class PublicUserRegister(BaseModel):
    """Public registration - always creates patient accounts"""
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

# Patient Models
class PatientBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str  # Format: YYYY-MM-DD
    ssn_last_four: str = Field(min_length=4, max_length=4)
    primary_insurance: str
    secondary_insurance: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    user_id: Optional[str] = None  # Link to user account for patient portal access

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


# Patient Medical/Insurance Models
class MedicalVitals(BaseModel):
    height: Optional[str] = None
    weight: Optional[str] = None
    bmi: Optional[str] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[str] = None
    temperature: Optional[str] = None
    last_recorded: Optional[str] = None


class MedicalDiagnosis(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # active | managed | resolved
    diagnosed_date: Optional[str] = None
    provider: Optional[str] = None


class MedicalMedication(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    prescriber: Optional[str] = None
    start_date: Optional[str] = None
    status: Optional[str] = None  # active | discontinued | as_needed


class MedicalAllergy(BaseModel):
    allergen: Optional[str] = None
    reaction: Optional[str] = None
    severity: Optional[str] = None  # mild | moderate | severe


class MedicalDmeHistory(BaseModel):
    item: Optional[str] = None
    delivered: Optional[str] = None
    status: Optional[str] = None  # active | returned | expired
    replacement_eligible: Optional[str] = None
    supplier: Optional[str] = None


class MedicalPriorAuthorization(BaseModel):
    auth_number: Optional[str] = None
    item: Optional[str] = None
    status: Optional[str] = None  # pending | approved | denied | expired
    submitted: Optional[str] = None
    expires: Optional[str] = None
    payer: Optional[str] = None


class MedicalCareTeamMember(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    npi: Optional[str] = None
    phone: Optional[str] = None
    last_visit: Optional[str] = None


class MedicalProcedure(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    provider: Optional[str] = None
    status: Optional[str] = None  # completed | scheduled | cancelled


class PatientMedicalRecordsPayload(BaseModel):
    vitals: MedicalVitals = Field(default_factory=MedicalVitals)
    diagnoses: List[MedicalDiagnosis] = Field(default_factory=list)
    medications: List[MedicalMedication] = Field(default_factory=list)
    allergies: List[MedicalAllergy] = Field(default_factory=list)
    dme_history: List[MedicalDmeHistory] = Field(default_factory=list)
    prior_authorizations: List[MedicalPriorAuthorization] = Field(default_factory=list)
    care_team: List[MedicalCareTeamMember] = Field(default_factory=list)
    procedures: List[MedicalProcedure] = Field(default_factory=list)


class InsurancePrimary(BaseModel):
    status: Optional[str] = None  # active | inactive | pending
    payer_name: Optional[str] = None
    payer_id: Optional[str] = None
    payer_phone: Optional[str] = None
    member_id: Optional[str] = None
    group_number: Optional[str] = None
    subscriber_name: Optional[str] = None
    relationship: Optional[str] = None  # Self | Spouse | Child | Other
    plan_name: Optional[str] = None
    plan_type: Optional[str] = None  # Medicare | Medicaid | Commercial | HMO | PPO | Medigap | Other
    coverage_type: Optional[str] = None
    effective_date: Optional[str] = None
    termination_date: Optional[str] = None


class InsuranceSecondary(BaseModel):
    payer_name: Optional[str] = None
    plan_name: Optional[str] = None
    plan_type: Optional[str] = None
    covers_coinsurance: Optional[bool] = None
    covers_deductible: Optional[bool] = None


class InsuranceFinancialSummary(BaseModel):
    deductible_annual: Optional[float] = None
    deductible_met: Optional[float] = None
    deductible_remaining: Optional[float] = None
    coinsurance: Optional[float] = None
    coverage_percentage: Optional[float] = None
    oop_max_annual: Optional[float] = None
    oop_max_met: Optional[float] = None


class InsuranceDmeBenefit(BaseModel):
    name: Optional[str] = None
    covered: Optional[bool] = None
    prior_auth: Optional[bool] = None
    coinsurance: Optional[float] = None
    notes: Optional[str] = None


class InsuranceClaimSummary(BaseModel):
    claim_id: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    billed: Optional[float] = None
    allowed: Optional[float] = None
    paid: Optional[float] = None
    patient_owes: Optional[float] = None
    status: Optional[str] = None  # pending | paid | denied | appealed


class InsuranceRemittance(BaseModel):
    last_era_date: Optional[str] = None
    last_era_number: Optional[str] = None
    payment_method: Optional[str] = None  # EFT | Check | Virtual Card
    total_payments_ytd: Optional[float] = None


class InsuranceVerification(BaseModel):
    last_verified: Optional[str] = None
    verified_by: Optional[str] = None
    source: Optional[str] = None


class PatientInsuranceDataPayload(BaseModel):
    primary: InsurancePrimary = Field(default_factory=InsurancePrimary)
    secondary: InsuranceSecondary = Field(default_factory=InsuranceSecondary)
    financial_summary: InsuranceFinancialSummary = Field(default_factory=InsuranceFinancialSummary)
    dme_benefits: List[InsuranceDmeBenefit] = Field(default_factory=list)
    claims_summary: List[InsuranceClaimSummary] = Field(default_factory=list)
    remittance: InsuranceRemittance = Field(default_factory=InsuranceRemittance)
    verification: InsuranceVerification = Field(default_factory=InsuranceVerification)
    section_verification: dict = Field(default_factory=dict)


DME_BENEFIT_CATEGORY_OPTIONS = [
    "Back Braces (LSO/TLSO)",
    "Knee Braces",
    "Wheelchairs (Manual)",
    "Power Wheelchairs",
    "CPAP/BiPAP",
    "Hospital Beds",
    "Oxygen Equipment",
    "Diabetic Supplies",
    "Wound Care Supplies",
    "Enteral Nutrition",
    "Bath Safety",
    "Walkers/Rollators",
]

# Lead Models
class LeadBase(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: Optional[EmailStr] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    notes: Optional[str] = None
    # Opportunity fields from website forms
    pain_location: Optional[str] = None  # back, knee, wrist, shoulder, other
    has_medicare: Optional[str] = None   # yes, no, unsure
    has_doctor: Optional[str] = None     # yes, no
    zip_code: Optional[str] = None
    best_time_to_call: Optional[str] = None  # morning, afternoon, evening
    form_source: Optional[str] = None    # eligibility, contact, product
    # Product interest and estimated value
    interested_products: Optional[List[dict]] = None  # [{name: "Back Brace", value: 150.00}, ...]
    estimated_value: Optional[float] = None  # Total estimated value
    # Doctor + product mappings captured per lead
    doctor_links: Optional[List[dict]] = None  # [{doctor_id, first_name, ..., linked_products: [{product_id, name, sku}]}]

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
    doctor_links: Optional[List[dict]] = None


class LeadDoctorLinksUpdate(BaseModel):
    doctor_links: List[dict] = Field(default_factory=list)


class NpiDoctorImportRequest(BaseModel):
    npi: str = Field(min_length=10, max_length=10)

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

# Order Models
class OrderItem(BaseModel):
    hcpcs_code: str
    description: str
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0)
    sig: Optional[str] = None  # Directions for use

class OrderCreate(BaseModel):
    patient_id: str
    prescriber_id: str  # Doctor user ID
    supplier_id: str
    items: List[OrderItem]
    equipment_type: Optional[str] = None
    diagnoses: Optional[List[dict]] = None
    notes: Optional[str] = None
    refills_allowed: int = 0
    daw: bool = False  # Dispense As Written
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

# Supplier Models
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
    product_ids: Optional[List[str]] = None  # Links to product catalog items this supplier carries

class SupplierResponse(SupplierBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    inventory_status: str = "unknown"
    created_at: datetime
    updated_at: datetime

# Insurance Company Models
class InsuranceType(str, Enum):
    MEDICARE = "medicare"
    MEDICAID = "medicaid"
    PRIVATE = "private"
    COMMERCIAL = "commercial"
    WORKERS_COMP = "workers_comp"
    VA = "va"
    TRICARE = "tricare"
    OTHER = "other"

class InsuranceCompanyBase(BaseModel):
    name: str
    insurance_type: InsuranceType
    payer_id: Optional[str] = None  # EDI Payer ID
    phone_main: Optional[str] = None
    phone_dme: Optional[str] = None  # DME specific department
    phone_prior_auth: Optional[str] = None
    phone_claims: Optional[str] = None
    fax_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    address: Optional[str] = None
    dme_requirements: Optional[str] = None  # Special requirements for DME
    prior_auth_required: bool = False
    timely_filing_days: Optional[int] = None  # Days to file claim
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

# Document Models
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

# Audit Log Models
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

class FaxSettingsUpdate(BaseModel):
    telnyx_api_key: Optional[str] = None
    telnyx_fax_number: Optional[str] = None
    telnyx_connection_id: Optional[str] = None
    webhook_url: Optional[str] = None
    is_enabled: Optional[bool] = None
    caller_name: Optional[str] = None  # CNAM for outgoing faxes (max 15 chars)

class FaxSettingsResponse(BaseModel):
    is_configured: bool
    is_enabled: bool
    fax_number: Optional[str] = None
    has_api_key: bool
    has_connection_id: bool
    webhook_url: Optional[str] = None
    caller_name: Optional[str] = None  # CNAM for outgoing faxes
    updated_at: Optional[str] = None

class SendFaxRequest(BaseModel):
    recipient_fax_number: str
    recipient_name: str
    document_type: FaxDocumentType = FaxDocumentType.OTHER
    file_url: str  # URL to the PDF file to send
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
    """Request model for generating a HIPAA-compliant fax cover page"""
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


# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Add impersonation info from token if present
        user_dict = {k: v for k, v in user.items() if k != "_id"}
        if payload.get("is_impersonating"):
            user_dict["is_impersonating"] = True
            user_dict["impersonated_by"] = payload.get("impersonated_by")
        
        return user_dict
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(*roles: UserRole):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        # super_admin has access to everything
        if user_role == "super_admin":
            return current_user
        if user_role not in [r.value for r in roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

async def log_audit(user_id: str, user_email: str, action: str, resource_type: str, 
                    resource_id: str = None, details: dict = None, ip_address: str = None):
    audit_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_email": user_email,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_entry)


async def log_fax_transmission_audit(
    event_type: str,
    fax_record_id: Optional[str] = None,
    fax_id: Optional[str] = None,
    transmission_status: Optional[str] = None,
    sender_user_id: Optional[str] = None,
    sender_email: Optional[str] = None,
    recipient_name: Optional[str] = None,
    recipient_fax_number: Optional[str] = None,
    triggered_by: str = "system",
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Dedicated fax transmission audit trail for compliance: who sent, when, and to whom."""
    encrypted_recipient_name = encrypt_fax_value(recipient_name)
    encrypted_recipient_fax = encrypt_fax_value(recipient_fax_number)
    audit_entry = {
        "id": str(uuid.uuid4()),
        "fax_record_id": fax_record_id,
        "fax_id": fax_id,
        "event_type": event_type,
        "transmission_status": transmission_status,
        "sender_user_id": sender_user_id,
        "sender_email": sender_email,
        "recipient_name_encrypted": encrypted_recipient_name,
        "recipient_fax_number_encrypted": encrypted_recipient_fax,
        "recipient_fax_number_masked": mask_fax_number(recipient_fax_number),
        "triggered_by": triggered_by,
        "provider": "telnyx",
        "channel": "fax",
        "details": details or {},
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.fax_transmission_audit.insert_one(audit_entry)

def is_admin_role(user: dict) -> bool:
    """Check if user has admin or super_admin role"""
    return user.get("role") in ["admin", "super_admin"]

def require_admin(current_user: dict):
    """Raise 403 if user is not admin or super_admin"""
    if not is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: PublicUserRegister):
    """Public registration endpoint - always creates patient accounts"""
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Force patient role for public registrations
    role = UserRole.PATIENT.value
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": role,
        "password_hash": hash_password(user_data.password),
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, role)
    
    await log_audit(user_id, user_data.email, "USER_REGISTERED", "users", user_id)
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user_id,
            "email": user_data.email,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "role": role
        }
    )


@api_router.post("/users", response_model=dict)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Admin-only endpoint to create users with any role"""
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Use the role specified by admin
    role = user_data.role.value if isinstance(user_data.role, UserRole) else user_data.role
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": role,
        "password_hash": hash_password(user_data.password),
        "is_active": user_data.is_active,
        "phone": user_data.phone,
        "fax": user_data.fax,
        "state": user_data.state,
        "npi": user_data.npi,
        "specialty": user_data.specialty,
        "practice_name": user_data.practice_name,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    # Remove None values
    user_doc = {k: v for k, v in user_doc.items() if v is not None}
    
    await db.users.insert_one(user_doc)
    
    # Auto-subscribe team members to Team List newsletter
    if role in ["admin", "super_admin", "sales_rep"]:
        await auto_subscribe_team_to_newsletter(
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=role
        )
    
    await log_audit(current_user["id"], current_user["email"], "USER_CREATED", "users", user_id, 
                   details={"email": user_data.email, "role": role})
    
    return {
        "message": "User created successfully",
        "user": {
            "id": user_id,
            "email": user_data.email,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "role": role
        }
    }


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    await log_audit(user["id"], user["email"], "USER_LOGIN", "auth")
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "role": user["role"]
        }
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "first_name": current_user["first_name"],
        "last_name": current_user["last_name"],
        "role": current_user["role"],
        "is_impersonating": current_user.get("is_impersonating", False),
        "impersonated_by": current_user.get("impersonated_by")
    }

# Super admin email - cannot be impersonated
SUPER_ADMIN_EMAIL = "mel@a2gdesigns.com"

@api_router.post("/auth/impersonate/{user_id}")
async def impersonate_user(user_id: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Allow admins to impersonate other users (except super admin)"""
    
    # Get target user
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent impersonating super admin
    if target_user["email"].lower() == SUPER_ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Cannot impersonate super admin")
    
    # Prevent impersonating yourself
    if target_user["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")
    
    # Create impersonation token with special claims
    token_data = {
        "sub": target_user["id"],
        "email": target_user["email"],
        "role": target_user["role"],
        "is_impersonating": True,
        "impersonated_by": {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": f"{current_user['first_name']} {current_user['last_name']}"
        },
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)  # Shorter expiry for impersonation
    }
    
    impersonation_token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Log the impersonation
    await log_audit(
        current_user["id"], 
        current_user["email"], 
        "USER_IMPERSONATED", 
        "users", 
        user_id,
        details={
            "impersonated_user": target_user["email"],
            "impersonated_name": f"{target_user['first_name']} {target_user['last_name']}"
        }
    )
    
    return {
        "access_token": impersonation_token,
        "token_type": "bearer",
        "impersonated_user": {
            "id": target_user["id"],
            "email": target_user["email"],
            "first_name": target_user["first_name"],
            "last_name": target_user["last_name"],
            "role": target_user["role"]
        }
    }

@api_router.post("/auth/end-impersonation")
async def end_impersonation(current_user: dict = Depends(get_current_user)):
    """End impersonation session - requires the original admin token to be provided"""
    if not current_user.get("is_impersonating"):
        raise HTTPException(status_code=400, detail="Not currently impersonating")
    
    return {"message": "Impersonation ended. Please use your original token to continue."}

# ==================== USER MANAGEMENT ROUTES ====================

# ==================== USER PROFILE ROUTES ====================

@api_router.get("/users/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/users/me/profile")
async def update_current_user_profile(updates: dict, current_user: dict = Depends(get_current_user)):
    """Update the current authenticated user's profile including schedule and notifications"""
    # Only allow specific fields to be updated
    allowed_fields = ["first_name", "last_name", "phone", "extension", "availability_schedule", "notification_settings"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not filtered_updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Check if extension is being set and validate uniqueness
    if "extension" in filtered_updates and filtered_updates["extension"]:
        existing = await db.users.find_one({"extension": filtered_updates["extension"], "id": {"$ne": current_user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Extension already in use by another user")
    
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one({"id": current_user["id"]}, {"$set": filtered_updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_audit(current_user["id"], current_user["email"], "PROFILE_UPDATED", "users", current_user["id"])
    
    return {"message": "Profile updated successfully"}

# ==================== USER MANAGEMENT ROUTES ====================

@api_router.get("/users", response_model=List[dict])
async def get_users(current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    # Don't allow password update through this endpoint
    updates.pop("password", None)
    updates.pop("password_hash", None)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_audit(current_user["id"], current_user["email"], "USER_UPDATED", "users", user_id)
    
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    # Get user before deleting to check if team member
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove from Team List if team member
    if user.get("role") in ["admin", "super_admin", "sales_rep"]:
        await unsubscribe_team_from_newsletter(user.get("email", ""))
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_audit(current_user["id"], current_user["email"], "USER_DELETED", "users", user_id)
    
    return {"message": "User deleted successfully"}

@api_router.get("/users/role/{role}", response_model=List[dict])
async def get_users_by_role(role: UserRole, current_user: dict = Depends(get_current_user)):
    users = await db.users.find({"role": role.value}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

# ==================== PATIENT ROUTES ====================

@api_router.post("/patients", response_model=dict)
async def create_patient(patient: PatientCreate, request: Request, current_user: dict = Depends(get_current_user)):
    patient_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create storage folder for this patient
    storage_folder = f"patients/{patient_id}"
    folder_success, folder_result = await StorageService.create_folder(storage_folder)
    if not folder_success:
        logger.warning(f"Failed to create storage folder for patient {patient_id}: {folder_result}")
    
    patient_doc = {
        "id": patient_id,
        **patient.model_dump(),
        "storage_folder": storage_folder,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.patients.insert_one(patient_doc)
    
    await log_audit(
        current_user["id"], current_user["email"], 
        "PATIENT_CREATED", "patients", patient_id,
        ip_address=request.client.host if request.client else None
    )
    
    patient_doc.pop("_id", None)
    return patient_doc

@api_router.get("/patients", response_model=List[dict])
async def get_patients(
    skip: int = 0, 
    limit: int = 50,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"ssn_last_four": search}
        ]
    
    patients = await db.patients.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    await log_audit(current_user["id"], current_user["email"], "PATIENTS_VIEWED", "patients")
    
    return patients

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # HIPAA Audit: Log every patient record view
    await log_audit(
        current_user["id"], current_user["email"],
        "PATIENT_VIEWED", "patients", patient_id,
        ip_address=request.client.host if request.client else None
    )
    
    return patient

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, updates: PatientUpdate, request: Request, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.patients.update_one({"id": patient_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # HIPAA Audit: Log patient record edit
    await log_audit(
        current_user["id"], current_user["email"],
        "PATIENT_UPDATED", "patients", patient_id,
        details={"updated_fields": list(update_data.keys())},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Patient updated successfully"}


def get_default_medical_records() -> dict:
    return {
        "vitals": {
            "height": "",
            "weight": "",
            "bmi": "",
            "blood_pressure": "",
            "heart_rate": "",
            "temperature": "",
            "last_recorded": "",
        },
        "diagnoses": [],
        "medications": [],
        "allergies": [],
        "dme_history": [],
        "prior_authorizations": [],
        "care_team": [],
        "procedures": [],
    }


def get_default_insurance_data() -> dict:
    return {
        "primary": {
            "status": "",
            "payer_name": "",
            "payer_id": "",
            "payer_phone": "",
            "member_id": "",
            "group_number": "",
            "subscriber_name": "",
            "relationship": "",
            "plan_name": "",
            "plan_type": "",
            "coverage_type": "",
            "effective_date": "",
            "termination_date": "",
        },
        "secondary": {
            "payer_name": "",
            "plan_name": "",
            "plan_type": "",
            "covers_coinsurance": False,
            "covers_deductible": False,
        },
        "financial_summary": {
            "deductible_annual": None,
            "deductible_met": None,
            "deductible_remaining": None,
            "coinsurance": None,
            "coverage_percentage": None,
            "oop_max_annual": None,
            "oop_max_met": None,
        },
        "dme_benefits": [],
        "claims_summary": [],
        "remittance": {
            "last_era_date": "",
            "last_era_number": "",
            "payment_method": "",
            "total_payments_ytd": None,
        },
        "verification": {
            "last_verified": "",
            "verified_by": "",
            "source": "",
        },
        "section_verification": {
            "primary": False,
            "financial_summary": False,
            "dme_benefits": False,
            "claims_summary": False,
            "remittance": False,
            "secondary": False,
            "verification": False,
        },
    }


@api_router.get("/patients/{patient_id}/medical")
async def get_patient_medical_records(
    patient_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0, "medical_records": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    medical_records = patient.get("medical_records") or get_default_medical_records()

    await log_audit(
        current_user["id"],
        current_user["email"],
        "PATIENT_MEDICAL_RECORDS_VIEWED",
        "patients",
        patient_id,
        ip_address=request.client.host if request.client else None,
    )

    return medical_records


@api_router.put("/patients/{patient_id}/medical")
async def update_patient_medical_records(
    patient_id: str,
    payload: PatientMedicalRecordsPayload,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    medical_records = payload.model_dump()
    now = datetime.now(timezone.utc).isoformat()

    result = await db.patients.update_one(
        {"id": patient_id},
        {
            "$set": {
                "medical_records": medical_records,
                "updated_at": now,
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")

    await log_audit(
        current_user["id"],
        current_user["email"],
        "PATIENT_MEDICAL_RECORDS_UPDATED",
        "patients",
        patient_id,
        details={
            "diagnoses_count": len(medical_records.get("diagnoses") or []),
            "medications_count": len(medical_records.get("medications") or []),
            "allergies_count": len(medical_records.get("allergies") or []),
            "dme_history_count": len(medical_records.get("dme_history") or []),
            "prior_authorizations_count": len(medical_records.get("prior_authorizations") or []),
            "care_team_count": len(medical_records.get("care_team") or []),
            "procedures_count": len(medical_records.get("procedures") or []),
        },
        ip_address=request.client.host if request.client else None,
    )

    return {"message": "Medical records saved successfully", "medical_records": medical_records}


@api_router.get("/patients/{patient_id}/insurance-data")
async def get_patient_insurance_data(
    patient_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0, "insurance_data": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    insurance_data = patient.get("insurance_data") or get_default_insurance_data()

    await log_audit(
        current_user["id"],
        current_user["email"],
        "PATIENT_INSURANCE_DATA_VIEWED",
        "patients",
        patient_id,
        ip_address=request.client.host if request.client else None,
    )

    return insurance_data


@api_router.put("/patients/{patient_id}/insurance-data")
async def update_patient_insurance_data(
    patient_id: str,
    payload: PatientInsuranceDataPayload,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    insurance_data = payload.model_dump()
    now = datetime.now(timezone.utc).isoformat()

    result = await db.patients.update_one(
        {"id": patient_id},
        {
            "$set": {
                "insurance_data": insurance_data,
                "updated_at": now,
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")

    await log_audit(
        current_user["id"],
        current_user["email"],
        "PATIENT_INSURANCE_DATA_UPDATED",
        "patients",
        patient_id,
        details={
            "dme_benefits_count": len(insurance_data.get("dme_benefits") or []),
            "claims_count": len(insurance_data.get("claims_summary") or []),
            "verification_source": insurance_data.get("verification", {}).get("source"),
        },
        ip_address=request.client.host if request.client else None,
    )

    return {
        "message": "Insurance data saved successfully",
        "insurance_data": insurance_data,
        "dme_category_options": DME_BENEFIT_CATEGORY_OPTIONS,
    }

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, request: Request, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    await log_audit(
        current_user["id"], current_user["email"],
        "PATIENT_DELETED", "patients", patient_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Patient deleted successfully"}

@api_router.post("/patients/{patient_id}/link-user")
async def link_patient_to_user(
    patient_id: str, 
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Link a patient record to a user account by matching email"""
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if not patient.get("email"):
        raise HTTPException(status_code=400, detail="Patient has no email address")
    
    # Find user with matching email and patient role
    user = await db.users.find_one({"email": patient["email"], "role": "patient"})
    if not user:
        raise HTTPException(status_code=404, detail="No patient user account found with this email")
    
    # Update patient with user_id
    await db.patients.update_one(
        {"id": patient_id},
        {"$set": {"user_id": user["id"], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_audit(
        current_user["id"], current_user["email"],
        "PATIENT_LINKED_TO_USER", "patients", patient_id,
        {"user_id": user["id"]},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Patient linked to user account", "user_id": user["id"]}

# ==================== PATIENT NOTES ====================

class PatientNoteCreate(BaseModel):
    content: str

class PatientNoteResponse(BaseModel):
    id: str
    patient_id: str
    content: str
    created_by_id: str
    created_by_name: str
    created_by_role: str
    created_at: str

@api_router.get("/patients/{patient_id}/notes")
async def get_patient_notes(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for a patient"""
    # Verify patient exists
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Patients can only view their own notes
    if current_user["role"] == "patient":
        if patient.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    notes = await db.patient_notes.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes

@api_router.post("/patients/{patient_id}/notes")
async def create_patient_note(
    patient_id: str, 
    note_data: PatientNoteCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Add a note to a patient - accessible by staff and the patient themselves"""
    # Verify patient exists
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Patients can only add notes to their own record
    if current_user["role"] == "patient":
        if patient.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    note_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine who should receive the notification
    # If patient sends note, notify staff. If staff sends, notify patient.
    notify_user_ids = []
    if current_user["role"] == "patient":
        # Notify all admins and sales reps (staff will see it)
        notify_user_ids = ["staff"]  # Special marker for staff notifications
    else:
        # Notify the patient if they have a user account
        if patient.get("user_id"):
            notify_user_ids = [patient["user_id"]]
    
    note_doc = {
        "id": note_id,
        "patient_id": patient_id,
        "content": note_data.content,
        "created_by_id": current_user["id"],
        "created_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user["email"],
        "created_by_role": current_user["role"],
        "created_at": now,
        "read_by": [current_user["id"]],  # Creator has already "read" it
        "notify_user_ids": notify_user_ids
    }
    
    await db.patient_notes.insert_one(note_doc)
    
    await log_audit(
        current_user["id"], current_user["email"],
        "PATIENT_NOTE_CREATED", "patient_notes", note_id,
        {"patient_id": patient_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {**note_doc, "_id": None}

@api_router.get("/notifications/unread-count")
async def get_unread_notifications_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notes/notifications for current user"""
    user_id = current_user["id"]
    user_role = current_user["role"]
    
    notifications = []
    
    # Build query based on user role
    if user_role == "patient":
        # Patient sees notes on their own patient record where they haven't read
        # First find the patient record linked to this user
        patient = await db.patients.find_one({"user_id": user_id})
        if not patient:
            return {"unread_count": 0, "notifications": []}
        
        # Find unread notes for this patient (user_id not in read_by array)
        unread_notes = await db.patient_notes.find({
            "patient_id": patient["id"],
            "read_by": {"$nin": [user_id]},
            "created_by_id": {"$ne": user_id}  # Don't notify about own messages
        }, {"_id": 0}).sort("created_at", -1).to_list(50)
        
        # Get patient names for context
        for note in unread_notes:
            patient_doc = await db.patients.find_one({"id": note["patient_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
            patient_name = f"{patient_doc.get('first_name', '')} {patient_doc.get('last_name', '')}".strip() if patient_doc else "Unknown"
            notifications.append({
                "id": note["id"],
                "type": "patient_note",
                "patient_id": note["patient_id"],
                "patient_name": patient_name,
                "from_name": note["created_by_name"],
                "content_preview": note["content"][:100] + "..." if len(note["content"]) > 100 else note["content"],
                "created_at": note["created_at"]
            })
    else:
        # Staff/Admin sees patient notes where patients sent messages
        unread_notes = await db.patient_notes.find({
            "notify_user_ids": "staff",
            "read_by": {"$nin": [user_id]},
            "created_by_role": "patient"  # Only patient messages notify staff
        }, {"_id": 0}).sort("created_at", -1).to_list(50)
        
        for note in unread_notes:
            patient = await db.patients.find_one({"id": note["patient_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
            patient_name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip() if patient else "Unknown"
            notifications.append({
                "id": note["id"],
                "type": "patient_note",
                "patient_id": note["patient_id"],
                "patient_name": patient_name,
                "from_name": note["created_by_name"],
                "content_preview": note["content"][:100] + "..." if len(note["content"]) > 100 else note["content"],
                "created_at": note["created_at"]
            })
        
        # Also get lead notifications for admin/staff
        if is_admin_role(current_user) or user_role in ["sales_rep", "sales_manager"]:
            lead_notifications = await db.lead_notifications.find({
                "read_by": {"$nin": [user_id]}
            }, {"_id": 0}).sort("created_at", -1).to_list(20)
            
            for lead_notif in lead_notifications:
                notifications.append({
                    "id": lead_notif["id"],
                    "type": "new_lead",
                    "lead_id": lead_notif["lead_id"],
                    "patient_name": lead_notif["lead_name"],
                    "from_name": lead_notif.get("form_source", "Website"),
                    "content_preview": lead_notif["message"],
                    "created_at": lead_notif["created_at"]
                })
    
    # Sort all notifications by created_at
    notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {"unread_count": len(notifications), "notifications": notifications[:50]}

@api_router.post("/notifications/mark-read/{note_id}")
async def mark_notification_read(note_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a specific note/notification as read"""
    # Try to mark as read in patient_notes
    result = await db.patient_notes.update_one(
        {"id": note_id},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    
    # Also try to mark in lead_notifications
    if result.modified_count == 0:
        await db.lead_notifications.update_one(
            {"id": note_id},
            {"$addToSet": {"read_by": current_user["id"]}}
        )
    
    return {"message": "Marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for current user"""
    user_id = current_user["id"]
    user_role = current_user["role"]
    
    if user_role == "patient":
        patient = await db.patients.find_one({"user_id": user_id})
        if patient:
            await db.patient_notes.update_many(
                {"patient_id": patient["id"]},
                {"$addToSet": {"read_by": user_id}}
            )
    else:
        # Mark patient notes as read
        await db.patient_notes.update_many(
            {"notify_user_ids": "staff"},
            {"$addToSet": {"read_by": user_id}}
        )
        
        # Mark lead notifications as read for admin/staff
        if is_admin_role(current_user) or user_role in ["sales_rep", "sales_manager"]:
            await db.lead_notifications.update_many(
                {},
                {"$addToSet": {"read_by": user_id}}
            )
    
    return {"message": "All notifications marked as read"}

@api_router.delete("/patients/{patient_id}/notes/{note_id}")
async def delete_patient_note(
    patient_id: str,
    note_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a patient note - admin only"""
    # Additional check for super admin protection (optional extra security)
    note = await db.patient_notes.find_one({"id": note_id, "patient_id": patient_id})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await db.patient_notes.delete_one({"id": note_id})
    
    await log_audit(
        current_user["id"], current_user["email"],
        "PATIENT_NOTE_DELETED", "patient_notes", note_id,
        {"patient_id": patient_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Note deleted successfully"}

# ==================== LEAD ROUTES ====================

# Public model for website form submissions
class WebsiteLeadCreate(BaseModel):
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    phone: str
    email: Optional[str] = None
    zip_code: Optional[str] = Field(None, alias="zipCode")
    pain_location: Optional[str] = Field(None, alias="painLocation")
    insurance_type: Optional[str] = Field(None, alias="insuranceType")
    has_medicare: Optional[str] = Field(None, alias="hasMedicare")
    has_doctor: Optional[str] = Field(None, alias="hasDoctor")
    best_time_to_call: Optional[str] = Field(None, alias="bestTime")
    form_type: Optional[str] = Field(None, alias="formType")
    message: Optional[str] = None
    # Analytics/tracking fields
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None  # Search keywords from paid ads
    utm_content: Optional[str] = None
    search_query: Optional[str] = None  # Organic search keywords
    referrer: Optional[str] = None
    landing_page: Optional[str] = None
    gclid: Optional[str] = None  # Google Ads click ID
    # TCPA/Consent Compliance Fields
    consent_contact: Optional[bool] = Field(None, alias="consentContact")
    consent_hipaa: Optional[bool] = Field(None, alias="consentHipaa")
    consent_insurance: Optional[bool] = Field(None, alias="consentInsurance")
    consent_sms: Optional[bool] = Field(None, alias="consentSms")
    consent_tcpa: Optional[bool] = Field(None, alias="consentTcpa")
    electronic_signature: Optional[str] = Field(None, alias="electronicSignature")
    consent_language: Optional[str] = Field(None, alias="consentLanguage")  # Full text of consent displayed
    consent_version: Optional[str] = Field(None, alias="consentVersion")
    form_html_snapshot: Optional[str] = Field(None, alias="formHtmlSnapshot")  # HTML snapshot of form
    user_agent: Optional[str] = Field(None, alias="userAgent")
    screen_resolution: Optional[str] = Field(None, alias="screenResolution")
    timezone: Optional[str] = None
    # Jornaya / TrustedForm compliance tokens
    universal_leadid: Optional[str] = Field(None, alias="universalLeadId")
    trustedform_cert_url: Optional[str] = Field(None, alias="trustedFormCertUrl")
    # Basic bot protection
    honeypot: Optional[str] = Field(None, alias="website")
    submission_duration: Optional[int] = Field(None, alias="submissionDuration")
    
    model_config = ConfigDict(populate_by_name=True)


# Secure Lead Submission Models
class SecureLeadPayload(BaseModel):
    """Encrypted lead submission payload"""
    encrypted_data: str = Field(..., alias="encryptedData")
    nonce: str
    timestamp: str
    signature: str
    
    model_config = ConfigDict(populate_by_name=True)


# ==================== SECURE LEAD TRANSMISSION ENDPOINTS ====================

@api_router.get("/public/leads/encryption-config")
async def get_encryption_config():
    """Get public encryption configuration for secure lead submission"""
    if not SECURE_TRANSMISSION_AVAILABLE:
        return {
            "enabled": False,
            "message": "Secure transmission not configured"
        }
    
    config = get_public_encryption_config()
    config["enabled"] = True
    return config


@api_router.post("/public/leads/secure", response_model=dict)
async def create_secure_lead(payload: SecureLeadPayload, request: Request):
    """
    Secure encrypted lead submission endpoint
    
    This endpoint accepts encrypted lead data for HIPAA-compliant transmission.
    The payload must be encrypted with the shared key and signed with HMAC.
    """
    if not SECURE_TRANSMISSION_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Secure transmission not available"
        )
    
    # Get client IP
    ip_address = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                 request.headers.get("X-Real-IP") or \
                 (request.client.host if request.client else "unknown")
    
    # Check rate limit
    is_allowed, remaining = check_rate_limit(ip_address)
    if not is_allowed:
        logger.warning(f"Rate limit exceeded for IP: {ip_address}")
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"X-RateLimit-Remaining": "0", "Retry-After": "60"}
        )
    
    try:
        # Verify signature first
        if not secure_transmission.verify_signature(
            payload.encrypted_data, 
            payload.timestamp, 
            payload.signature
        ):
            logger.warning(f"Invalid signature from IP: {ip_address}")
            await db.security_logs.insert_one({
                "type": "invalid_signature",
                "ip_address": ip_address,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "user_agent": request.headers.get("User-Agent")
            })
            raise HTTPException(
                status_code=400,
                detail="Invalid request signature"
            )
        
        # Decrypt payload
        decrypted_data = secure_transmission.decrypt_payload(
            payload.encrypted_data,
            payload.nonce
        )
        
        # Log successful decryption
        logger.info(f"Successfully decrypted secure lead from IP: {ip_address}")
        
        # Create lead from decrypted data
        lead_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Create storage folder for this lead
        storage_folder = f"leads/{lead_id}"
        folder_success, folder_result = await StorageService.create_folder(storage_folder)
        if not folder_success:
            logger.warning(f"Failed to create storage folder for secure lead {lead_id}: {folder_result}")
        
        # Build notes from form data
        notes_parts = []
        if decrypted_data.get('painLocation'):
            notes_parts.append(f"Pain Location: {decrypted_data.get('painLocation')}")
        if decrypted_data.get('insuranceType'):
            notes_parts.append(f"Insurance Type: {decrypted_data.get('insuranceType')}")
        if decrypted_data.get('hasMedicare'):
            notes_parts.append(f"Has Medicare: {decrypted_data.get('hasMedicare')}")
        if decrypted_data.get('hasDoctor'):
            notes_parts.append(f"Has Doctor: {decrypted_data.get('hasDoctor')}")
        if decrypted_data.get('bestTime'):
            notes_parts.append(f"Best Time to Call: {decrypted_data.get('bestTime')}")
        if decrypted_data.get('message'):
            notes_parts.append(f"Message: {decrypted_data.get('message')}")
        
        # Create comprehensive consent record
        consent_record_id = str(uuid.uuid4())
        consent_record = {
            "id": consent_record_id,
            "lead_id": lead_id,
            "type": "secure_lead_submission",
            "timestamp": now,
            "ip_address": ip_address,
            "user_agent": decrypted_data.get('userAgent') or request.headers.get("User-Agent"),
            "screen_resolution": decrypted_data.get('screenResolution'),
            "timezone": decrypted_data.get('timezone'),
            "referrer": decrypted_data.get('referrer') or request.headers.get("Referer"),
            "landing_page": decrypted_data.get('landing_page'),
            "consent_contact": decrypted_data.get('consentContact', False),
            "consent_hipaa": decrypted_data.get('consentHipaa', False),
            "consent_insurance": decrypted_data.get('consentInsurance', False),
            "consent_sms": decrypted_data.get('consentSms', False),
            "consent_tcpa": decrypted_data.get('consentTcpa', False),
            "electronic_signature": decrypted_data.get('electronicSignature'),
            "signature_timestamp": now if decrypted_data.get('electronicSignature') else None,
            "consent_language": decrypted_data.get('consentLanguage'),
            "consent_version": decrypted_data.get('consentVersion', '1.0'),
            "form_html_snapshot": decrypted_data.get('formHtmlSnapshot'),
            "form_type": decrypted_data.get('formType', 'website'),
            "form_source": decrypted_data.get('utm_source', 'website'),
            "contact_name": f"{decrypted_data.get('firstName', '')} {decrypted_data.get('lastName', '')}",
            "contact_phone": decrypted_data.get('phone'),
            "contact_email": decrypted_data.get('email'),
            "transmission_type": "encrypted",
            "encryption_verified": True,
            "signature_verified": True,
            "created_at": now,
            "retention_period": "permanent"
        }
        
        await db.consent_records.insert_one(consent_record)
        
        # Store encrypted payload snapshot for audit (without decryption key)
        if folder_success:
            try:
                audit_content = f"""<!DOCTYPE html>
<html>
<head><title>Secure Lead Audit - {lead_id}</title></head>
<body>
<h1>Secure Lead Transmission Audit Record</h1>
<h2>Transmission Security</h2>
<ul>
<li><strong>Encryption:</strong> AES-256-GCM ✅</li>
<li><strong>Signature:</strong> HMAC-SHA256 Verified ✅</li>
<li><strong>Timestamp:</strong> {payload.timestamp}</li>
<li><strong>IP Address:</strong> {ip_address}</li>
</ul>
<h2>Consent Record ID:</h2>
<p>{consent_record_id}</p>
<h2>Lead ID:</h2>
<p>{lead_id}</p>
<h2>Submission Time:</h2>
<p>{now}</p>
</body>
</html>"""
                await StorageService.upload_file(
                    file_content=audit_content.encode('utf-8'),
                    storage_key=f"{storage_folder}/secure_transmission_audit.html",
                    content_type="text/html"
                )
            except Exception as e:
                logger.warning(f"Failed to store secure transmission audit: {e}")
        
        # Create the lead document
        lead_doc = {
            "id": lead_id,
            "first_name": decrypted_data.get('firstName', ''),
            "last_name": decrypted_data.get('lastName', ''),
            "phone": decrypted_data.get('phone', ''),
            "email": decrypted_data.get('email'),
            "pain_location": decrypted_data.get('painLocation'),
            "insurance_type": decrypted_data.get('insuranceType'),
            "has_medicare": decrypted_data.get('hasMedicare'),
            "has_doctor": decrypted_data.get('hasDoctor'),
            "zip_code": decrypted_data.get('zipCode'),
            "best_time_to_call": decrypted_data.get('bestTime'),
            "form_source": decrypted_data.get('formType', 'website'),
            "notes": " | ".join(notes_parts) if notes_parts else None,
            "utm_source": decrypted_data.get('utm_source', 'website'),
            "utm_medium": decrypted_data.get('utm_medium', 'organic'),
            "utm_campaign": decrypted_data.get('utm_campaign'),
            "referrer": decrypted_data.get('referrer'),
            "landing_page": decrypted_data.get('landing_page'),
            "consent_record_id": consent_record_id,
            "consent_captured": True,
            "consent_ip": ip_address,
            "consent_timestamp": now,
            "electronic_signature": decrypted_data.get('electronicSignature'),
            "transmission_encrypted": True,
            "status": LeadStatus.OPPORTUNITY.value,
            "patient_id": None,
            "storage_folder": storage_folder,
            "created_at": now,
            "updated_at": now,
            "created_by": "secure_website_form"
        }
        
        await db.leads.insert_one(lead_doc)
        
        # Create notification
        notification_id = str(uuid.uuid4())
        await db.lead_notifications.insert_one({
            "id": notification_id,
            "type": "new_lead",
            "lead_id": lead_id,
            "lead_name": f"{decrypted_data.get('firstName', '')} {decrypted_data.get('lastName', '')}",
            "lead_phone": decrypted_data.get('phone'),
            "form_source": decrypted_data.get('formType', 'website'),
            "message": f"New SECURE request: {decrypted_data.get('firstName', '')} {decrypted_data.get('lastName', '')}",
            "secure_transmission": True,
            "read_by": [],
            "created_at": now
        })
        
        # Audit log
        await db.system_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": "anonymous",
            "user_email": "website_visitor",
            "action": "SECURE_LEAD_CREATED",
            "resource_type": "leads",
            "resource_id": lead_id,
            "timestamp": now,
            "ip_address": ip_address,
            "details": {
                "form_type": decrypted_data.get('formType'),
                "consent_record_id": consent_record_id,
                "transmission_encrypted": True,
                "signature_verified": True
            }
        })
        
        # Auto-subscribe to newsletter if email provided
        if decrypted_data.get('email'):
            await auto_subscribe_to_newsletter(
                email=decrypted_data.get('email'),
                first_name=decrypted_data.get('firstName', ''),
                last_name=decrypted_data.get('lastName', ''),
                source="secure_website_form"
            )
        
        return {
            "success": True, 
            "message": "Thank you! Your information was securely submitted.", 
            "lead_id": lead_id,
            "consent_record_id": consent_record_id,
            "secure": True
        }
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Decryption error from IP {ip_address}: {e}")
        await db.security_logs.insert_one({
            "type": "decryption_failed",
            "ip_address": ip_address,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "user_agent": request.headers.get("User-Agent")
        })
        raise HTTPException(status_code=400, detail="Invalid encrypted payload")
    except Exception as e:
        logger.error(f"Secure lead creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process secure submission")


# PUBLIC ENDPOINT - No auth required for website forms
@api_router.post("/public/leads", response_model=dict)
async def create_public_lead(lead_data: WebsiteLeadCreate, request: Request):
    """Public endpoint for website form submissions - creates opportunity leads with full TCPA compliance tracking"""
    bot_field_value = (lead_data.honeypot or "").strip()
    if bot_field_value:
        logger.warning(f"Blocked suspected bot submission from IP: {request.client.host if request.client else 'unknown'}")
        raise HTTPException(status_code=400, detail="Invalid submission")

    first_name = (lead_data.first_name or "").strip()
    last_name = (lead_data.last_name or "").strip()
    phone = (lead_data.phone or "").strip()
    email = (lead_data.email or "").strip() or None

    if not first_name or not last_name or not phone:
        raise HTTPException(status_code=422, detail="First name, last name, and phone are required")

    if lead_data.consent_contact is not True:
        raise HTTPException(status_code=422, detail="Consent to contact is required")

    if lead_data.consent_tcpa is not True:
        raise HTTPException(status_code=422, detail="TCPA consent is required")

    lead_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Capture IP address from request (handle proxies)
    ip_address = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                 request.headers.get("X-Real-IP") or \
                 (request.client.host if request.client else "unknown")
    
    # Create storage folder for this lead
    storage_folder = f"leads/{lead_id}"
    folder_success, folder_result = await StorageService.create_folder(storage_folder)
    if not folder_success:
        logger.warning(f"Failed to create storage folder for public lead {lead_id}: {folder_result}")
    
    # Build notes from form data
    notes_parts = []
    if lead_data.pain_location:
        notes_parts.append(f"Pain Location: {lead_data.pain_location}")
    if lead_data.insurance_type:
        notes_parts.append(f"Insurance Type: {lead_data.insurance_type}")
    if lead_data.has_medicare:
        notes_parts.append(f"Has Medicare: {lead_data.has_medicare}")
    if lead_data.has_doctor:
        notes_parts.append(f"Has Doctor: {lead_data.has_doctor}")
    if lead_data.best_time_to_call:
        notes_parts.append(f"Best Time to Call: {lead_data.best_time_to_call}")
    if lead_data.message:
        notes_parts.append(f"Message: {lead_data.message}")
    
    # Create comprehensive consent record
    consent_record_id = str(uuid.uuid4())
    consent_record = {
        "id": consent_record_id,
        "lead_id": lead_id,
        "type": "lead_form_submission",
        # Timestamp and IP
        "timestamp": now,
        "ip_address": ip_address,
        # User environment
        "user_agent": lead_data.user_agent or request.headers.get("User-Agent"),
        "screen_resolution": lead_data.screen_resolution,
        "timezone": lead_data.timezone,
        "referrer": lead_data.referrer or request.headers.get("Referer"),
        "landing_page": lead_data.landing_page,
        # Consent checkboxes
        "consent_contact": lead_data.consent_contact or False,
        "consent_hipaa": lead_data.consent_hipaa or False,
        "consent_insurance": lead_data.consent_insurance or False,
        "consent_sms": lead_data.consent_sms or False,
        "consent_tcpa": lead_data.consent_tcpa or False,
        # Electronic signature
        "electronic_signature": lead_data.electronic_signature,
        "signature_timestamp": now if lead_data.electronic_signature else None,
        # Consent language snapshot
        "consent_language": lead_data.consent_language,
        "consent_version": lead_data.consent_version or "1.0",
        "form_html_snapshot": lead_data.form_html_snapshot,
        # Form metadata
        "form_type": lead_data.form_type or "website",
        "form_source": lead_data.utm_source or "website",
        # Contact info for verification
        "contact_name": f"{first_name} {last_name}",
        "contact_phone": phone,
        "contact_email": email,
        # Audit metadata
        "created_at": now,
        "retention_period": "permanent"  # TCPA requires keeping consent records
    }
    
    # Store consent record in dedicated collection
    await db.consent_records.insert_one(consent_record)
    
    # If HTML snapshot provided, save it as a file in the lead's folder
    if lead_data.form_html_snapshot and folder_success:
        try:
            snapshot_filename = f"consent_form_snapshot_{consent_record_id[:8]}.html"
            snapshot_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Consent Form Snapshot - {first_name} {last_name}</title>
    <style>body {{ font-family: Arial, sans-serif; padding: 20px; }}</style>
</head>
<body>
    <h1>Consent Form Snapshot</h1>
    <div style="background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
        <h2>Submission Details</h2>
        <p><strong>Lead ID:</strong> {lead_id}</p>
        <p><strong>Submitted By:</strong> {first_name} {last_name}</p>
        <p><strong>Phone:</strong> {phone}</p>
        <p><strong>Email:</strong> {email or 'Not provided'}</p>
        <p><strong>Timestamp:</strong> {now}</p>
        <p><strong>IP Address:</strong> {ip_address}</p>
        <p><strong>User Agent:</strong> {lead_data.user_agent or request.headers.get("User-Agent")}</p>
        <p><strong>Electronic Signature:</strong> {lead_data.electronic_signature or 'Not provided'}</p>
    </div>
    <div style="background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
        <h2>Consent Checkboxes Status</h2>
        <ul>
            <li>Consent to Contact: {'✅ AGREED' if lead_data.consent_contact else '❌ Not checked'}</li>
            <li>HIPAA/PHI Permission: {'✅ AGREED' if lead_data.consent_hipaa else '❌ Not checked'}</li>
            <li>Insurance Understanding: {'✅ AGREED' if lead_data.consent_insurance else '❌ Not checked'}</li>
            <li>SMS Consent: {'✅ AGREED' if lead_data.consent_sms else '❌ Not checked'}</li>
            <li>TCPA Consent: {'✅ AGREED' if lead_data.consent_tcpa else '❌ Not checked'}</li>
        </ul>
    </div>
    <div style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
        <h2>Original Form Content</h2>
        {lead_data.form_html_snapshot}
    </div>
    <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px;">
        <h2>Consent Language Displayed</h2>
        <pre style="white-space: pre-wrap; font-family: inherit;">{lead_data.consent_language or 'Not captured'}</pre>
    </div>
</body>
</html>"""
            # Store in lead's folder
            await StorageService.upload_file(
                file_content=snapshot_content.encode('utf-8'),
                storage_key=f"{storage_folder}/{snapshot_filename}",
                content_type="text/html"
            )
            logger.info(f"Stored consent snapshot for lead {lead_id}")
        except Exception as e:
            logger.warning(f"Failed to store consent snapshot: {e}")
    
    lead_doc = {
        "id": lead_id,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "email": email,
        "pain_location": lead_data.pain_location,
        "insurance_type": lead_data.insurance_type,
        "has_medicare": lead_data.has_medicare,
        "has_doctor": lead_data.has_doctor,
        "zip_code": lead_data.zip_code,
        "best_time_to_call": lead_data.best_time_to_call,
        "form_source": lead_data.form_type or "website",
        "notes": " | ".join(notes_parts) if notes_parts else None,
        # Analytics/tracking data
        "utm_source": lead_data.utm_source or "website",
        "utm_medium": lead_data.utm_medium or "organic",
        "utm_campaign": lead_data.utm_campaign,
        "utm_term": lead_data.utm_term,  # Paid search keywords
        "utm_content": lead_data.utm_content,
        "search_query": lead_data.search_query,  # Organic search keywords
        "referrer": lead_data.referrer,
        "landing_page": lead_data.landing_page,
        "gclid": lead_data.gclid,
        # Consent tracking reference
        "consent_record_id": consent_record_id,
        "consent_captured": True,
        "consent_ip": ip_address,
        "consent_timestamp": now,
        "electronic_signature": lead_data.electronic_signature,
        # Jornaya / TrustedForm tokens
        "universal_leadid": lead_data.universal_leadid,
        "trustedform_cert_url": lead_data.trustedform_cert_url,
        # Standard fields
        "status": LeadStatus.OPPORTUNITY.value,
        "patient_id": None,
        "storage_folder": storage_folder,
        "created_at": now,
        "updated_at": now,
        "created_by": "website_form"
    }
    
    await db.leads.insert_one(lead_doc)
    
    # Claim TrustedForm certificate if provided
    if lead_data.trustedform_cert_url:
        try:
            from routes.compliance_routes import claim_trustedform_certificate
            await claim_trustedform_certificate({"cert_url": lead_data.trustedform_cert_url, "lead_id": lead_id})
        except Exception as e:
            logger.warning(f"TrustedForm claim failed for lead {lead_id}: {e}")
    
    # Create notification for admin/sales staff about new lead
    notification_id = str(uuid.uuid4())
    await db.lead_notifications.insert_one({
        "id": notification_id,
        "type": "new_lead",
        "lead_id": lead_id,
        "lead_name": f"{first_name} {last_name}",
        "lead_phone": phone,
        "form_source": lead_data.form_type or "website",
        "message": f"New request from {lead_data.form_type or 'website'}: {first_name} {last_name}",
        "read_by": [],
        "created_at": now
    })
    
    # Create detailed audit trail entry
    await db.system_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": "anonymous",
        "user_email": "website_visitor",
        "action": "LEAD_CREATED_WITH_CONSENT",
        "resource_type": "leads",
        "resource_id": lead_id,
        "timestamp": now,
        "ip_address": ip_address,
        "details": {
            "form_type": lead_data.form_type,
            "consent_record_id": consent_record_id,
            "consent_contact": lead_data.consent_contact,
            "consent_hipaa": lead_data.consent_hipaa,
            "consent_sms": lead_data.consent_sms,
            "consent_tcpa": lead_data.consent_tcpa,
            "has_electronic_signature": bool(lead_data.electronic_signature),
            "user_agent": lead_data.user_agent or request.headers.get("User-Agent"),
            "referrer": lead_data.referrer
        }
    })
    
    # Auto-subscribe to newsletter if email provided
    if email:
        await auto_subscribe_to_newsletter(
            email=email,
            first_name=first_name,
            last_name=last_name,
            source="website_form"
        )
    
    return {"success": True, "message": "Thank you! We will contact you shortly.", "lead_id": lead_id, "consent_record_id": consent_record_id}


# ==================== SECURITY LOGS ENDPOINTS ====================

@api_router.get("/security/logs")
async def get_security_logs(
    limit: int = Query(50, le=200),
    log_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get security logs for audit purposes (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if log_type:
        query["type"] = log_type
    
    logs = await db.security_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log.pop("_id", None)
    
    return {
        "logs": logs,
        "total": len(logs)
    }


@api_router.get("/security/stats")
async def get_security_stats(current_user: dict = Depends(get_current_user)):
    """Get security statistics"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Count different log types
    total_logs = await db.security_logs.count_documents({})
    invalid_signatures = await db.security_logs.count_documents({"type": "invalid_signature"})
    decryption_failures = await db.security_logs.count_documents({"type": "decryption_failed"})
    
    # Count secure vs regular submissions
    total_leads = await db.leads.count_documents({})
    secure_leads = await db.leads.count_documents({"transmission_encrypted": True})
    
    return {
        "total_security_logs": total_logs,
        "invalid_signatures": invalid_signatures,
        "decryption_failures": decryption_failures,
        "total_leads": total_leads,
        "secure_leads": secure_leads,
        "secure_percentage": round((secure_leads / total_leads * 100), 1) if total_leads > 0 else 0
    }


@api_router.post("/leads", response_model=dict)
async def create_lead(lead: LeadCreate, current_user: dict = Depends(get_current_user)):
    lead_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create storage folder for this lead
    storage_folder = f"leads/{lead_id}"
    folder_success, folder_result = await StorageService.create_folder(storage_folder)
    if not folder_success:
        logger.warning(f"Failed to create storage folder for lead {lead_id}: {folder_result}")
        # Continue even if folder creation fails - storage may not be configured
        storage_folder = f"leads/{lead_id}"  # Still set the path for future use
    
    lead_doc = {
        "id": lead_id,
        **lead.model_dump(),
        "status": LeadStatus.NEW.value,
        "patient_id": None,
        "storage_folder": storage_folder,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.leads.insert_one(lead_doc)
    
    # Auto-subscribe to newsletter if email provided
    if lead.email:
        await auto_subscribe_to_newsletter(
            email=lead.email,
            first_name=lead.first_name,
            last_name=lead.last_name,
            source="patient_request"
        )
    
    await log_audit(current_user["id"], current_user["email"], "LEAD_CREATED", "leads", lead_id)
    
    lead_doc.pop("_id", None)
    return lead_doc

@api_router.get("/leads", response_model=List[dict])
async def get_leads(
    status: Optional[LeadStatus] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status.value
    
    leads = await db.leads.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return leads

# Export leads to CSV (MUST be before /{lead_id} routes)
@api_router.get("/leads/export-csv")
async def export_leads_csv(current_user: dict = Depends(get_current_user)):
    """Export all leads to CSV"""
    leads = await db.leads.find({}, {"_id": 0}).to_list(10000)
    
    if not leads:
        return Response(
            content="first_name,last_name,phone,email,status,zip_code,utm_source,utm_medium,utm_campaign,notes,pain_location,has_medicare,has_doctor\n",
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=leads_export.csv"}
        )
    
    # CSV columns
    columns = [
        "first_name", "last_name", "phone", "email", "status", "zip_code",
        "utm_source", "utm_medium", "utm_campaign", "notes", "pain_location",
        "has_medicare", "has_doctor", "form_source", "created_at"
    ]
    
    # Build CSV content
    csv_lines = [",".join(columns)]
    for lead in leads:
        row = []
        for col in columns:
            value = lead.get(col, "")
            if value is None:
                value = ""
            # Escape commas and quotes in values
            value = str(value).replace('"', '""')
            if "," in value or '"' in value or "\n" in value:
                value = f'"{value}"'
            row.append(value)
        csv_lines.append(",".join(row))
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"}
    )

# Download sample CSV template (MUST be before /{lead_id} routes)
@api_router.get("/leads/sample-csv")
async def get_leads_sample_csv():
    """Get sample CSV template for lead imports"""
    sample_content = """first_name,last_name,phone,email,status,zip_code,utm_source,utm_medium,utm_campaign,notes,pain_location,has_medicare,has_doctor
John,Smith,(555) 123-4567,john.smith@email.com,new,32801,google,cpc,spring_campaign,Interested in knee brace,knee,yes,yes
Jane,Doe,(555) 987-6543,jane.doe@email.com,opportunity,33101,facebook,social,pain_relief_ad,Called about back support,back,yes,no
Robert,Johnson,(555) 456-7890,,verifying_insurance,90210,referral,organic,,Doctor referred for TENS unit,shoulder,no,yes
Maria,Garcia,(555) 321-0987,maria.g@email.com,new,10001,google,organic,,,ankle,yes,yes
"""
    
    return Response(
        content=sample_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_import_template.csv"}
    )

# Import leads from CSV (MUST be before /{lead_id} routes)
@api_router.post("/leads/import-csv")
async def import_leads_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import leads from CSV file"""
    import csv
    import io
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')  # Handle BOM
    
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    valid_statuses = ['opportunity', 'new', 'verifying_insurance', 'qualified', 'lost']
    
    for row_num, row in enumerate(reader, start=2):
        try:
            # Validate required fields
            first_name = row.get('first_name', '').strip()
            last_name = row.get('last_name', '').strip()
            phone = row.get('phone', '').strip()
            
            if not first_name or not last_name or not phone:
                errors.append({"row": row_num, "error": "Missing required field (first_name, last_name, or phone)"})
                continue
            
            # Parse status
            status = row.get('status', 'new').strip().lower()
            if status not in valid_statuses:
                status = 'new'
            
            lead_doc = {
                "id": str(uuid.uuid4()),
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "email": row.get('email', '').strip() or None,
                "status": status,
                "zip_code": row.get('zip_code', '').strip() or None,
                "utm_source": row.get('utm_source', '').strip() or None,
                "utm_medium": row.get('utm_medium', '').strip() or None,
                "utm_campaign": row.get('utm_campaign', '').strip() or None,
                "notes": row.get('notes', '').strip() or None,
                "pain_location": row.get('pain_location', '').strip() or None,
                "has_medicare": row.get('has_medicare', '').strip().lower() if row.get('has_medicare') else None,
                "has_doctor": row.get('has_doctor', '').strip().lower() if row.get('has_doctor') else None,
                "form_source": "csv_import",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.leads.insert_one(lead_doc)
            imported += 1
            
        except Exception as e:
            errors.append({"row": row_num, "error": str(e)})
    
    await log_audit(current_user["id"], current_user["email"], "LEADS_IMPORTED", "leads", None, 
                   details={"imported": imported, "errors": len(errors)})
    
    return {"imported": imported, "errors": errors}

@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, updates: LeadUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if "status" in update_data:
        update_data["status"] = update_data["status"].value
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await log_audit(current_user["id"], current_user["email"], "LEAD_UPDATED", "leads", lead_id)
    
    return {"message": "Lead updated successfully"}


@api_router.put("/leads/{lead_id}/doctor-links")
async def update_lead_doctor_links(
    lead_id: str,
    payload: LeadDoctorLinksUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Save doctor + product mappings for a lead. If lead already converted, sync to patient profile too."""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    now = datetime.now(timezone.utc).isoformat()
    normalized_links = []
    for entry in payload.doctor_links:
        doctor_entry = {
            "doctor_id": entry.get("doctor_id"),
            "first_name": entry.get("first_name"),
            "last_name": entry.get("last_name"),
            "email": entry.get("email"),
            "phone": entry.get("phone"),
            "fax": entry.get("fax"),
            "npi": entry.get("npi"),
            "specialty": entry.get("specialty"),
            "practice_name": entry.get("practice_name"),
            "state": entry.get("state"),
            "address": entry.get("address"),
            "linked_products": []
        }

        linked_products = entry.get("linked_products") or []
        for product in linked_products:
            doctor_entry["linked_products"].append({
                "product_id": product.get("product_id"),
                "name": product.get("name"),
                "sku": product.get("sku"),
                "hcpcs_codes": product.get("hcpcs_codes") or []
            })

        normalized_links.append(doctor_entry)

    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {"doctor_links": normalized_links, "updated_at": now}}
    )

    # Keep patient profile in sync if this lead is already converted
    if lead.get("patient_id"):
        await db.patients.update_one(
            {"id": lead["patient_id"]},
            {"$set": {"linked_doctors": normalized_links, "updated_at": now}}
        )

    await log_audit(
        current_user["id"],
        current_user["email"],
        "LEAD_DOCTOR_LINKS_UPDATED",
        "leads",
        lead_id,
        details={
            "doctor_count": len(normalized_links),
            "patient_synced": bool(lead.get("patient_id"))
        },
        ip_address=request.client.host if request.client else None
    )

    return {
        "message": "Doctor links saved",
        "doctor_count": len(normalized_links),
        "patient_synced": bool(lead.get("patient_id"))
    }

@api_router.post("/leads/{lead_id}/convert")
async def convert_lead_to_patient(lead_id: str, patient_data: LeadToPatientConvert, request: Request, current_user: dict = Depends(get_current_user)):
    # Get the lead
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead.get("patient_id"):
        raise HTTPException(status_code=400, detail="Lead already converted to patient")
    
    # Create patient from lead
    patient_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Transfer storage folder from lead to patient (folder follows the patient forever)
    storage_folder = lead.get("storage_folder")
    if not storage_folder:
        # Create folder if lead didn't have one (for older leads)
        storage_folder = f"leads/{lead_id}"
        folder_success, _ = await StorageService.create_folder(storage_folder)
        if folder_success:
            # Update lead with the folder
            await db.leads.update_one({"id": lead_id}, {"$set": {"storage_folder": storage_folder}})
    
    patient_doc = {
        "id": patient_id,
        "first_name": lead["first_name"],
        "last_name": lead["last_name"],
        "phone": lead.get("phone"),
        "email": lead.get("email"),
        "date_of_birth": patient_data.date_of_birth,
        "ssn_last_four": patient_data.ssn_last_four,
        "primary_insurance": patient_data.primary_insurance,
        "secondary_insurance": patient_data.secondary_insurance,
        "address": patient_data.address,
        "linked_doctors": lead.get("doctor_links") or lead.get("linked_doctors") or [],
        "storage_folder": storage_folder,  # Same folder follows the patient
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"],
        "converted_from_lead": lead_id
    }
    
    await db.patients.insert_one(patient_doc)
    
    # Update lead status
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {
            "status": LeadStatus.QUALIFIED.value,
            "patient_id": patient_id,
            "updated_at": now
        }}
    )
    
    await log_audit(
        current_user["id"], current_user["email"],
        "LEAD_CONVERTED_TO_PATIENT", "leads", lead_id,
        details={"patient_id": patient_id, "storage_folder": storage_folder},
        ip_address=request.client.host if request.client else None
    )
    
    patient_doc.pop("_id", None)
    return {"message": "Lead converted to patient", "patient": patient_doc}

# ==================== CONSENT RECORDS ENDPOINTS ====================

@api_router.get("/leads/{lead_id}/consent")
async def get_lead_consent_records(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all consent records for a lead - TCPA compliance audit trail"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get all consent records for this lead
    consent_records = await db.consent_records.find(
        {"lead_id": lead_id}
    ).sort("timestamp", -1).to_list(100)
    
    # Remove MongoDB _id
    for record in consent_records:
        record.pop("_id", None)
    
    return {
        "lead_id": lead_id,
        "consent_records": consent_records,
        "total_records": len(consent_records),
        "has_consent": len(consent_records) > 0
    }

@api_router.get("/consent/records")
async def get_all_consent_records(
    limit: int = Query(50, le=200),
    skip: int = 0,
    lead_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all consent records for audit purposes"""
    query = {}
    if lead_id:
        query["lead_id"] = lead_id
    
    total = await db.consent_records.count_documents(query)
    records = await db.consent_records.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    for record in records:
        record.pop("_id", None)
    
    return {
        "records": records,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/consent/records/{record_id}")
async def get_consent_record(record_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific consent record with full details"""
    record = await db.consent_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Consent record not found")
    
    return record

@api_router.get("/consent/audit-trail/{lead_id}")
async def get_consent_audit_trail(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get complete audit trail for a lead including all consent and communication records"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get consent records
    consent_records = await db.consent_records.find({"lead_id": lead_id}).sort("timestamp", -1).to_list(100)
    for r in consent_records:
        r.pop("_id", None)
        r["event_type"] = "consent_captured"
    
    # Get audit logs
    audit_logs = await db.system_audit_logs.find({"resource_id": lead_id}).sort("timestamp", -1).to_list(100)
    for r in audit_logs:
        r.pop("_id", None)
        r["event_type"] = "audit_log"
    
    # Get communication history
    comm_records = await db.sms_logs.find({"$or": [{"lead_id": lead_id}, {"to_number": lead.get("phone")}]}).sort("created_at", -1).to_list(100)
    for r in comm_records:
        r.pop("_id", None)
        r["event_type"] = "communication"
    
    # Get call records if any
    call_records = await db.call_logs.find({"$or": [{"lead_id": lead_id}, {"to_number": lead.get("phone")}, {"from_number": lead.get("phone")}]}).sort("started_at", -1).to_list(100)
    for r in call_records:
        r.pop("_id", None)
        r["event_type"] = "call"
    
    # Combine all events
    all_events = consent_records + audit_logs + comm_records + call_records
    
    # Sort by timestamp
    def get_timestamp(event):
        return event.get("timestamp") or event.get("created_at") or event.get("started_at") or ""
    
    all_events.sort(key=get_timestamp, reverse=True)
    
    return {
        "lead_id": lead_id,
        "lead_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}",
        "lead_phone": lead.get("phone"),
        "lead_email": lead.get("email"),
        "consent_status": {
            "has_consent": lead.get("consent_captured", False),
            "consent_timestamp": lead.get("consent_timestamp"),
            "consent_ip": lead.get("consent_ip"),
            "electronic_signature": lead.get("electronic_signature")
        },
        "audit_trail": all_events,
        "total_events": len(all_events)
    }

# ==================== LEAD/PATIENT STORAGE FOLDER ROUTES ====================

@api_router.get("/leads/{lead_id}/files")
async def get_lead_files(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all files in a lead's storage folder"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    storage_folder = lead.get("storage_folder")
    if not storage_folder:
        return {"files": [], "storage_folder": None, "message": "No storage folder configured"}
    
    success, result = await StorageService.get_folder_files(storage_folder)
    if not success:
        return {"files": [], "storage_folder": storage_folder, "message": result}
    
    # Get metadata for files
    file_keys = [f.get("key") for f in result]
    metadata_cursor = db.file_metadata.find({"file_key": {"$in": file_keys}}, {"_id": 0})
    metadata_list = await metadata_cursor.to_list(1000)
    metadata_map = {m["file_key"]: m for m in metadata_list}
    
    # Merge metadata with files
    for f in result:
        f["metadata"] = metadata_map.get(f.get("key"))
    
    return {"files": result, "storage_folder": storage_folder}

@api_router.post("/leads/{lead_id}/files")
async def upload_lead_file(
    lead_id: str,
    file: UploadFile = File(...),
    title: str = Form(None),
    description: str = Form(None),
    notes: str = Form(None),
    file_type: str = Form("document"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to a lead's storage folder with metadata"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    storage_folder = lead.get("storage_folder")
    if not storage_folder:
        # Create folder if it doesn't exist
        storage_folder = f"leads/{lead_id}"
        await StorageService.create_folder(storage_folder)
        await db.leads.update_one({"id": lead_id}, {"$set": {"storage_folder": storage_folder}})
    
    # Read file content
    file_content = await file.read()
    
    # Upload to storage
    success, result = await StorageService.upload_file(
        file_data=file_content,
        filename=file.filename,
        content_type=file.content_type,
        folder=storage_folder
    )
    
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {result}")
    
    # Save file metadata
    now = datetime.now(timezone.utc).isoformat()
    metadata_doc = {
        "id": str(uuid.uuid4()),
        "entity_type": "leads",
        "entity_id": lead_id,
        "file_key": result.get("key"),
        "original_filename": file.filename,
        "title": title or file.filename,
        "description": description,
        "notes": notes,
        "file_type": file_type,
        "content_type": file.content_type,
        "size": len(file_content),
        "uploaded_by": current_user["id"],
        "uploaded_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "created_at": now,
        "updated_at": now
    }
    await db.file_metadata.insert_one(metadata_doc)
    
    await log_audit(current_user["id"], current_user["email"], "FILE_UPLOADED", "leads", lead_id, details={"filename": file.filename, "title": title})
    
    result["metadata"] = {k: v for k, v in metadata_doc.items() if k != "_id"}
    return {"message": "File uploaded successfully", "file": result}

@api_router.get("/leads/{lead_id}/file-metadata")
async def get_lead_file_metadata(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all file metadata for a lead"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    metadata = await db.file_metadata.find(
        {"entity_type": "leads", "entity_id": lead_id}, 
        {"_id": 0}
    ).to_list(1000)
    return metadata

@api_router.put("/leads/{lead_id}/file-metadata/{file_key:path}")
async def update_lead_file_metadata(
    lead_id: str, 
    file_key: str,
    title: str = None,
    description: str = None,
    notes: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Update file metadata (admin only)"""
    # Check if user is admin
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Only admins can edit file metadata")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if title is not None:
        update_data["title"] = title
    if description is not None:
        update_data["description"] = description
    if notes is not None:
        update_data["notes"] = notes
    
    result = await db.file_metadata.update_one(
        {"entity_type": "leads", "entity_id": lead_id, "file_key": file_key},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File metadata not found")
    
    return {"message": "File metadata updated"}

@api_router.delete("/leads/{lead_id}/files/{file_key:path}")
async def delete_lead_file(lead_id: str, file_key: str, current_user: dict = Depends(get_current_user)):
    """Delete a file from lead's storage (admin only)"""
    # Check if user is admin
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Only admins can delete files")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Delete from storage
    success, result = await StorageService.delete_file(file_key)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {result}")
    
    # Delete metadata
    await db.file_metadata.delete_one({"file_key": file_key})
    
    await log_audit(current_user["id"], current_user["email"], "FILE_DELETED", "leads", lead_id, details={"file_key": file_key})
    
    return {"message": "File deleted successfully"}

@api_router.get("/patients/{patient_id}/files")
async def get_patient_files(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all files in a patient's storage folder"""
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    storage_folder = patient.get("storage_folder")
    if not storage_folder:
        return {"files": [], "storage_folder": None, "message": "No storage folder configured"}
    
    success, result = await StorageService.get_folder_files(storage_folder)
    if not success:
        return {"files": [], "storage_folder": storage_folder, "message": result}
    
    # Get metadata for files
    file_keys = [f.get("key") for f in result]
    metadata_cursor = db.file_metadata.find({"file_key": {"$in": file_keys}}, {"_id": 0})
    metadata_list = await metadata_cursor.to_list(1000)
    metadata_map = {m["file_key"]: m for m in metadata_list}
    
    # Merge metadata with files
    for f in result:
        f["metadata"] = metadata_map.get(f.get("key"))
    
    return {"files": result, "storage_folder": storage_folder}

@api_router.post("/patients/{patient_id}/files")
async def upload_patient_file(
    patient_id: str,
    file: UploadFile = File(...),
    title: str = Form(None),
    description: str = Form(None),
    notes: str = Form(None),
    file_type: str = Form("document"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to a patient's storage folder with metadata"""
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    storage_folder = patient.get("storage_folder")
    if not storage_folder:
        # Create folder if it doesn't exist (for patients not converted from leads)
        storage_folder = f"patients/{patient_id}"
        await StorageService.create_folder(storage_folder)
        await db.patients.update_one({"id": patient_id}, {"$set": {"storage_folder": storage_folder}})
    
    # Read file content
    file_content = await file.read()
    
    # Upload to storage
    success, result = await StorageService.upload_file(
        file_data=file_content,
        filename=file.filename,
        content_type=file.content_type,
        folder=storage_folder
    )
    
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {result}")
    
    # Save file metadata
    now = datetime.now(timezone.utc).isoformat()
    metadata_doc = {
        "id": str(uuid.uuid4()),
        "entity_type": "patients",
        "entity_id": patient_id,
        "file_key": result.get("key"),
        "original_filename": file.filename,
        "title": title or file.filename,
        "description": description,
        "notes": notes,
        "file_type": file_type,
        "content_type": file.content_type,
        "size": len(file_content),
        "uploaded_by": current_user["id"],
        "uploaded_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "created_at": now,
        "updated_at": now
    }
    await db.file_metadata.insert_one(metadata_doc)
    
    await log_audit(current_user["id"], current_user["email"], "FILE_UPLOADED", "patients", patient_id, details={"filename": file.filename, "title": title})
    
    result["metadata"] = {k: v for k, v in metadata_doc.items() if k != "_id"}
    return {"message": "File uploaded successfully", "file": result}

@api_router.get("/patients/{patient_id}/file-metadata")
async def get_patient_file_metadata(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all file metadata for a patient"""
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    metadata = await db.file_metadata.find(
        {"entity_type": "patients", "entity_id": patient_id}, 
        {"_id": 0}
    ).to_list(1000)
    return metadata

@api_router.put("/patients/{patient_id}/file-metadata/{file_key:path}")
async def update_patient_file_metadata(
    patient_id: str, 
    file_key: str,
    title: str = None,
    description: str = None,
    notes: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Update file metadata (admin only)"""
    # Check if user is admin
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Only admins can edit file metadata")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if title is not None:
        update_data["title"] = title
    if description is not None:
        update_data["description"] = description
    if notes is not None:
        update_data["notes"] = notes
    
    result = await db.file_metadata.update_one(
        {"entity_type": "patients", "entity_id": patient_id, "file_key": file_key},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File metadata not found")
    
    return {"message": "File metadata updated"}

@api_router.delete("/patients/{patient_id}/files/{file_key:path}")
async def delete_patient_file(patient_id: str, file_key: str, current_user: dict = Depends(get_current_user)):
    """Delete a file from patient's storage (admin only)"""
    # Check if user is admin
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Only admins can delete files")
    
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Delete from storage
    success, result = await StorageService.delete_file(file_key)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {result}")
    
    # Delete metadata
    await db.file_metadata.delete_one({"file_key": file_key})
    
    await log_audit(current_user["id"], current_user["email"], "FILE_DELETED", "patients", patient_id, details={"file_key": file_key})
    
    return {"message": "File deleted successfully"}

@api_router.get("/leads/{lead_id}/comments")
async def get_lead_comments(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all comments for a lead"""
    comments = await db.lead_comments.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return comments

@api_router.post("/leads/{lead_id}/comments")
async def add_lead_comment(
    lead_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add a comment to a lead"""
    # Verify lead exists
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    content = request.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")
    
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    comment = {
        "id": comment_id,
        "lead_id": lead_id,
        "content": content,
        "created_by_id": current_user["id"],
        "created_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user["email"],
        "created_at": now
    }
    
    await db.lead_comments.insert_one(comment)
    
    # Update lead's updated_at timestamp
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {"updated_at": now}}
    )
    
    await log_audit(current_user["id"], current_user["email"], "LEAD_COMMENT_ADDED", "leads", lead_id, {"comment_id": comment_id})
    
    return {k: v for k, v in comment.items() if k != "_id"}

@api_router.delete("/leads/{lead_id}/comments/{comment_id}")
async def delete_lead_comment(
    lead_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a comment from a lead"""
    result = await db.lead_comments.delete_one({"id": comment_id, "lead_id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    await log_audit(current_user["id"], current_user["email"], "LEAD_COMMENT_DELETED", "leads", lead_id, {"comment_id": comment_id})
    
    return {"message": "Comment deleted"}

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await log_audit(current_user["id"], current_user["email"], "LEAD_DELETED", "leads", lead_id)
    
    return {"message": "Lead deleted successfully"}

# ==================== ORDER ROUTES ====================

@api_router.post("/orders", response_model=dict)
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    # Verify patient exists
    patient = await db.patients.find_one({"id": order.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Verify prescriber (doctor) exists
    prescriber = await db.users.find_one({"id": order.prescriber_id, "role": UserRole.DOCTOR.value})
    if not prescriber:
        raise HTTPException(status_code=404, detail="Prescriber (Doctor) not found")
    
    # Verify supplier exists
    supplier = await db.suppliers.find_one({"id": order.supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate total
    total_amount = sum(item.quantity * item.unit_price for item in order.items)
    
    order_doc = {
        "id": order_id,
        "patient_id": order.patient_id,
        "prescriber_id": order.prescriber_id,
        "supplier_id": order.supplier_id,
        "items": [item.model_dump() for item in order.items],
        "equipment_type": order.equipment_type if hasattr(order, 'equipment_type') else None,
        "diagnoses": order.diagnoses if hasattr(order, 'diagnoses') else [],
        "status": order.status if hasattr(order, 'status') and order.status else OrderStatus.PENDING.value,
        "prescription_status": order.prescription_status if hasattr(order, 'prescription_status') else "not_sent",
        "total_amount": total_amount,
        "tracking_number": None,
        "notes": order.notes,
        "refills_allowed": order.refills_allowed if hasattr(order, 'refills_allowed') else 0,
        "daw": order.daw if hasattr(order, 'daw') else False,
        "note_to_supplier": order.note_to_supplier if hasattr(order, 'note_to_supplier') else None,
        "signature_data": order.signature_data if hasattr(order, 'signature_data') else None,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.orders.insert_one(order_doc)
    
    await log_audit(current_user["id"], current_user["email"], "ORDER_CREATED", "orders", order_id)
    
    order_doc.pop("_id", None)
    return order_doc

@api_router.post("/orders/{order_id}/send-prescription-request")
async def send_prescription_request(order_id: str, current_user: dict = Depends(get_current_user)):
    """Send prescription verification request to the prescribing doctor"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get prescriber info
    prescriber = await db.users.find_one({"id": order["prescriber_id"]}, {"_id": 0})
    if not prescriber:
        raise HTTPException(status_code=404, detail="Prescriber not found")
    
    # Get patient info
    patient = await db.patients.find_one({"id": order["patient_id"]}, {"_id": 0})
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update order status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "prescription_status": "sent",
            "prescription_sent_at": now,
            "prescription_sent_to": prescriber.get("email"),
            "updated_at": now
        }}
    )
    
    # Create notification for the doctor
    notification_id = str(uuid.uuid4())
    patient_name = f"{patient['first_name']} {patient['last_name']}" if patient else "Unknown Patient"
    
    await db.notifications.insert_one({
        "id": notification_id,
        "user_id": order["prescriber_id"],
        "type": "prescription_request",
        "title": "Prescription Verification Required",
        "message": f"DME order for {patient_name} requires your prescription verification.",
        "order_id": order_id,
        "patient_id": order["patient_id"],
        "read": False,
        "created_at": now
    })
    
    await log_audit(
        current_user["id"], current_user["email"],
        "PRESCRIPTION_REQUEST_SENT", "orders", order_id,
        details={"prescriber_id": order["prescriber_id"], "prescriber_email": prescriber.get("email")}
    )
    
    return {"message": "Prescription request sent to doctor", "order_id": order_id}

@api_router.post("/orders/{order_id}/verify-prescription")
async def verify_prescription(order_id: str, current_user: dict = Depends(get_current_user)):
    """Doctor verifies and signs the prescription"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only the prescribing doctor or admin can verify
    if current_user["id"] != order["prescriber_id"] and not is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Only the prescribing doctor can verify this prescription")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update order to verified status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "prescription_status": "verified",
            "prescription_verified_at": now,
            "prescription_verified_by": current_user["id"],
            "status": OrderStatus.PROCESSING.value,  # Move to processing once verified
            "updated_at": now
        }}
    )
    
    await log_audit(
        current_user["id"], current_user["email"],
        "PRESCRIPTION_VERIFIED", "orders", order_id
    )
    
    return {"message": "Prescription verified successfully. Order is now ready for processing.", "order_id": order_id}

@api_router.get("/orders", response_model=List[dict])
async def get_orders(
    status: Optional[OrderStatus] = None,
    patient_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status.value
    if patient_id:
        query["patient_id"] = patient_id
    
    orders = await db.orders.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.put("/orders/{order_id}")
async def update_order(order_id: str, updates: OrderUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if "status" in update_data:
        update_data["status"] = update_data["status"].value
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await log_audit(current_user["id"], current_user["email"], "ORDER_UPDATED", "orders", order_id)
    
    return {"message": "Order updated successfully"}

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await log_audit(current_user["id"], current_user["email"], "ORDER_DELETED", "orders", order_id)
    
    return {"message": "Order deleted successfully"}

# ==================== SUPPLIER ROUTES ====================

@api_router.post("/suppliers", response_model=dict)
async def create_supplier(supplier: SupplierCreate, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    supplier_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    supplier_doc = {
        "id": supplier_id,
        **supplier.model_dump(),
        "inventory_status": "unknown",
        "created_at": now,
        "updated_at": now
    }
    
    await db.suppliers.insert_one(supplier_doc)
    
    await log_audit(current_user["id"], current_user["email"], "SUPPLIER_CREATED", "suppliers", supplier_id)
    
    supplier_doc.pop("_id", None)
    supplier_doc.pop("api_key", None)  # Don't return API key
    return supplier_doc

@api_router.get("/suppliers", response_model=List[dict])
async def get_suppliers(current_user: dict = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0, "api_key": 0}).to_list(1000)
    return suppliers

@api_router.get("/suppliers/products-for-orders")
async def get_supplier_products_for_orders(current_user: dict = Depends(get_current_user)):
    """Get enabled products with their linked suppliers for the order form HCPCS dropdown"""
    products = await db.products.find(
        {"enabled": True},
        {"_id": 0, "id": 1, "name": 1, "hcpcs_codes": 1, "category_id": 1, "short_description": 1}
    ).to_list(500)
    categories = await db.product_categories.find(
        {"enabled": True},
        {"_id": 0, "id": 1, "name": 1, "sort_order": 1}
    ).sort("sort_order", 1).to_list(100)
    cat_map = {c["id"]: c["name"] for c in categories}
    suppliers = await db.suppliers.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "name": 1, "product_ids": 1}
    ).to_list(100)
    product_suppliers = {}
    for sup in suppliers:
        for pid in sup.get("product_ids", []):
            if pid not in product_suppliers:
                product_suppliers[pid] = []
            product_suppliers[pid].append({"id": sup["id"], "name": sup["name"]})
    result = []
    for prod in products:
        codes = prod.get("hcpcs_codes", [])
        if not codes:
            continue
        result.append({
            "id": prod["id"],
            "name": prod["name"],
            "hcpcs_codes": codes,
            "category": cat_map.get(prod.get("category_id"), "Other"),
            "description": prod.get("short_description", ""),
            "suppliers": product_suppliers.get(prod["id"], [])
        })
    return result

@api_router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, current_user: dict = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0, "api_key": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, updates: SupplierUpdate, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.suppliers.update_one({"id": supplier_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await log_audit(current_user["id"], current_user["email"], "SUPPLIER_UPDATED", "suppliers", supplier_id)
    
    return {"message": "Supplier updated successfully"}

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await log_audit(current_user["id"], current_user["email"], "SUPPLIER_DELETED", "suppliers", supplier_id)
    
    return {"message": "Supplier deleted successfully"}


# ==================== SUPPLIER API INTEGRATION ====================
# Real API calls when credentials configured, demo mode when not

import httpx

class SupplierAPIClient:
    """Universal supplier API client - handles different supplier formats"""
    
    SUPPLIER_CONFIGS = {
        "NikoHealth DME": {
            "base_url": "https://api.nikohealth.com/v1",
            "auth_type": "bearer",  # or "api_key", "basic"
            "endpoints": {
                "inventory": "/inventory/check",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}/status",
                "pricing": "/products/{sku}/pricing"
            }
        },
        "DDP Medical Supplies": {
            "base_url": "https://api.ddpmedical.com/v2",
            "auth_type": "api_key",
            "endpoints": {
                "inventory": "/stock/availability",
                "order_submit": "/orders/create",
                "order_status": "/orders/{order_id}",
                "pricing": "/catalog/{sku}/price"
            }
        },
        "McKesson Medical-Surgical": {
            "base_url": "https://connect.mckesson.com/api",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/v1/inventory",
                "order_submit": "/v1/orders",
                "order_status": "/v1/orders/{order_id}",
                "pricing": "/v1/pricing"
            }
        },
        "Medline Industries": {
            "base_url": "https://api.medline.com/orders",
            "auth_type": "api_key",
            "endpoints": {
                "inventory": "/inventory/check",
                "order_submit": "/submit",
                "order_status": "/status/{order_id}",
                "pricing": "/pricing/{sku}"
            }
        },
        "Rotech Healthcare": {
            "base_url": "https://orders.rotech.com/api",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}",
                "pricing": "/products/{sku}/price"
            }
        },
        "AdaptHealth": {
            "base_url": "https://api.adapthealth.com/v1",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory/availability",
                "order_submit": "/orders/new",
                "order_status": "/orders/{order_id}/track",
                "pricing": "/pricing/quote"
            }
        },
        "Byram Healthcare": {
            "base_url": "https://api.byramhealthcare.com",
            "auth_type": "api_key",
            "endpoints": {
                "inventory": "/v1/stock",
                "order_submit": "/v1/orders",
                "order_status": "/v1/orders/{order_id}",
                "pricing": "/v1/pricing"
            }
        },
        "National Seating & Mobility": {
            "base_url": "https://api.nsm-seating.com",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/availability",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}",
                "pricing": "/quote"
            }
        },
        "Hanger Clinic": {
            "base_url": "https://api.hangerclinic.com",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/stock/check",
                "order_submit": "/orders/submit",
                "order_status": "/orders/{order_id}/status",
                "pricing": "/pricing/get"
            }
        },
        "Apria Healthcare": {
            "base_url": "https://api.apria.com/v2",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory/check",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}",
                "pricing": "/products/pricing"
            }
        }
    }
    
    @staticmethod
    def get_demo_inventory(product_sku: str, quantity: int = 1):
        """Return demo inventory data when no API key configured"""
        import random
        in_stock = random.choice([True, True, True, False])  # 75% in stock
        return {
            "available": in_stock,
            "quantity_available": random.randint(5, 100) if in_stock else 0,
            "estimated_ship_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 5))).isoformat() if in_stock else None,
            "warehouse_location": random.choice(["East Coast", "West Coast", "Central", "Southeast"]),
            "demo_mode": True
        }
    
    @staticmethod
    def get_demo_pricing(product_sku: str):
        """Return demo pricing data when no API key configured"""
        import random
        base_price = random.uniform(50, 500)
        return {
            "sku": product_sku,
            "list_price": round(base_price, 2),
            "contract_price": round(base_price * 0.85, 2),
            "medicare_allowable": round(base_price * 0.70, 2),
            "currency": "USD",
            "demo_mode": True
        }
    
    @staticmethod
    def get_demo_order_status(order_id: str):
        """Return demo order status when no API key configured"""
        import random
        statuses = ["received", "processing", "shipped", "out_for_delivery", "delivered"]
        status = random.choice(statuses)
        return {
            "order_id": order_id,
            "status": status,
            "tracking_number": f"DEMO{random.randint(100000, 999999)}" if status in ["shipped", "out_for_delivery", "delivered"] else None,
            "estimated_delivery": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 7))).isoformat(),
            "last_update": datetime.now(timezone.utc).isoformat(),
            "demo_mode": True
        }
    
    @staticmethod
    def get_demo_order_confirmation():
        """Return demo order confirmation when no API key configured"""
        import random
        return {
            "success": True,
            "supplier_order_id": f"DEMO-{random.randint(100000, 999999)}",
            "confirmation_number": f"CNF{random.randint(10000, 99999)}",
            "estimated_ship_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 3))).isoformat(),
            "demo_mode": True
        }


# Check inventory availability from supplier
@api_router.post("/suppliers/{supplier_id}/check-inventory")
async def check_supplier_inventory(
    supplier_id: str,
    product_sku: str = None,
    hcpcs_code: str = None,
    quantity: int = 1,
    current_user: dict = Depends(get_current_user)
):
    """Check product inventory/availability from a supplier's API"""
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    api_key = supplier.get("api_key")
    supplier_name = supplier.get("name")
    config = SupplierAPIClient.SUPPLIER_CONFIGS.get(supplier_name, {})
    
    # If no API key configured, return demo data
    if not api_key:
        logger.info(f"[DEMO MODE] Inventory check for {supplier_name} - no API key configured")
        return {
            "supplier": supplier_name,
            "product_sku": product_sku or hcpcs_code,
            "quantity_requested": quantity,
            **SupplierAPIClient.get_demo_inventory(product_sku or hcpcs_code, quantity),
            "message": "Demo mode - configure API key in supplier settings for live data"
        }
    
    # Real API call
    try:
        base_url = config.get("base_url") or supplier.get("api_endpoint_url")
        endpoint = config.get("endpoints", {}).get("inventory", "/inventory")
        
        headers = {"Content-Type": "application/json"}
        if config.get("auth_type") == "bearer":
            headers["Authorization"] = f"Bearer {api_key}"
        elif config.get("auth_type") == "api_key":
            headers["X-API-Key"] = api_key
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}{endpoint}",
                headers=headers,
                json={
                    "sku": product_sku,
                    "hcpcs": hcpcs_code,
                    "quantity": quantity
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                # Update supplier inventory status
                await db.suppliers.update_one(
                    {"id": supplier_id},
                    {"$set": {"inventory_status": "connected", "last_api_check": datetime.now(timezone.utc).isoformat()}}
                )
                return {
                    "supplier": supplier_name,
                    "product_sku": product_sku or hcpcs_code,
                    "quantity_requested": quantity,
                    **data,
                    "demo_mode": False
                }
            else:
                logger.error(f"Supplier API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=502, detail=f"Supplier API returned {response.status_code}")
                
    except httpx.RequestError as e:
        logger.error(f"Supplier API connection error: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to supplier API: {str(e)}")


# Get pricing from supplier
@api_router.post("/suppliers/{supplier_id}/get-pricing")
async def get_supplier_pricing(
    supplier_id: str,
    product_sku: str = None,
    hcpcs_code: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get product pricing from a supplier's API"""
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    api_key = supplier.get("api_key")
    supplier_name = supplier.get("name")
    config = SupplierAPIClient.SUPPLIER_CONFIGS.get(supplier_name, {})
    
    if not api_key:
        logger.info(f"[DEMO MODE] Pricing check for {supplier_name} - no API key configured")
        return {
            "supplier": supplier_name,
            **SupplierAPIClient.get_demo_pricing(product_sku or hcpcs_code),
            "message": "Demo mode - configure API key in supplier settings for live data"
        }
    
    try:
        base_url = config.get("base_url") or supplier.get("api_endpoint_url")
        endpoint = config.get("endpoints", {}).get("pricing", "/pricing").replace("{sku}", product_sku or "")
        
        headers = {"Content-Type": "application/json"}
        if config.get("auth_type") == "bearer":
            headers["Authorization"] = f"Bearer {api_key}"
        elif config.get("auth_type") == "api_key":
            headers["X-API-Key"] = api_key
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{base_url}{endpoint}",
                headers=headers,
                params={"sku": product_sku, "hcpcs": hcpcs_code}
            )
            
            if response.status_code == 200:
                return {"supplier": supplier_name, **response.json(), "demo_mode": False}
            else:
                raise HTTPException(status_code=502, detail=f"Supplier API returned {response.status_code}")
                
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Could not connect to supplier API: {str(e)}")


# Submit order to supplier
class SupplierOrderRequest(BaseModel):
    patient_id: str
    items: List[dict]  # [{product_id, sku, hcpcs, quantity, ...}]
    shipping_address: dict
    billing_info: Optional[dict] = None
    notes: Optional[str] = None
    priority: str = "standard"  # standard, expedited, overnight

@api_router.post("/suppliers/{supplier_id}/submit-order")
async def submit_supplier_order(
    supplier_id: str,
    order_request: SupplierOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """Submit an order to a supplier's API"""
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    api_key = supplier.get("api_key")
    supplier_name = supplier.get("name")
    config = SupplierAPIClient.SUPPLIER_CONFIGS.get(supplier_name, {})
    
    # Get patient info
    patient = await db.patients.find_one({"id": order_request.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Create internal order record first
    internal_order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    order_record = {
        "id": internal_order_id,
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "patient_id": order_request.patient_id,
        "items": order_request.items,
        "shipping_address": order_request.shipping_address,
        "billing_info": order_request.billing_info,
        "notes": order_request.notes,
        "priority": order_request.priority,
        "status": "pending_submission",
        "supplier_order_id": None,
        "tracking_number": None,
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    if not api_key:
        # Demo mode
        logger.info(f"[DEMO MODE] Order submission to {supplier_name} - no API key configured")
        demo_response = SupplierAPIClient.get_demo_order_confirmation()
        
        order_record["status"] = "submitted"
        order_record["supplier_order_id"] = demo_response["supplier_order_id"]
        order_record["demo_mode"] = True
        
        await db.supplier_orders.insert_one(order_record)
        
        await log_audit(current_user["id"], current_user["email"], "SUPPLIER_ORDER_SUBMITTED", "supplier_orders", internal_order_id,
                       details={"supplier": supplier_name, "demo_mode": True})
        
        return {
            "success": True,
            "internal_order_id": internal_order_id,
            "supplier": supplier_name,
            **demo_response,
            "message": "Demo mode - configure API key in supplier settings for live orders"
        }
    
    # Real API submission
    try:
        base_url = config.get("base_url") or supplier.get("api_endpoint_url")
        endpoint = config.get("endpoints", {}).get("order_submit", "/orders")
        
        headers = {"Content-Type": "application/json"}
        if config.get("auth_type") == "bearer":
            headers["Authorization"] = f"Bearer {api_key}"
        elif config.get("auth_type") == "api_key":
            headers["X-API-Key"] = api_key
        
        # Build order payload
        order_payload = {
            "reference_id": internal_order_id,
            "patient": {
                "first_name": patient.get("first_name"),
                "last_name": patient.get("last_name"),
                "date_of_birth": patient.get("date_of_birth"),
                "phone": patient.get("phone"),
                "email": patient.get("email")
            },
            "items": order_request.items,
            "shipping": order_request.shipping_address,
            "priority": order_request.priority,
            "notes": order_request.notes
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}{endpoint}",
                headers=headers,
                json=order_payload
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                order_record["status"] = "submitted"
                order_record["supplier_order_id"] = data.get("order_id") or data.get("supplier_order_id")
                order_record["supplier_response"] = data
                order_record["demo_mode"] = False
                
                await db.supplier_orders.insert_one(order_record)
                
                await log_audit(current_user["id"], current_user["email"], "SUPPLIER_ORDER_SUBMITTED", "supplier_orders", internal_order_id,
                               details={"supplier": supplier_name, "supplier_order_id": order_record["supplier_order_id"]})
                
                return {
                    "success": True,
                    "internal_order_id": internal_order_id,
                    "supplier": supplier_name,
                    **data,
                    "demo_mode": False
                }
            else:
                order_record["status"] = "submission_failed"
                order_record["error"] = response.text
                await db.supplier_orders.insert_one(order_record)
                raise HTTPException(status_code=502, detail=f"Supplier rejected order: {response.text}")
                
    except httpx.RequestError as e:
        order_record["status"] = "submission_failed"
        order_record["error"] = str(e)
        await db.supplier_orders.insert_one(order_record)
        raise HTTPException(status_code=503, detail=f"Could not connect to supplier: {str(e)}")


# Check order status from supplier
@api_router.get("/suppliers/{supplier_id}/order-status/{supplier_order_id}")
async def get_supplier_order_status(
    supplier_id: str,
    supplier_order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get order status/tracking from a supplier's API"""
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    api_key = supplier.get("api_key")
    supplier_name = supplier.get("name")
    config = SupplierAPIClient.SUPPLIER_CONFIGS.get(supplier_name, {})
    
    if not api_key:
        logger.info(f"[DEMO MODE] Order status check for {supplier_name} - no API key configured")
        return {
            "supplier": supplier_name,
            **SupplierAPIClient.get_demo_order_status(supplier_order_id),
            "message": "Demo mode - configure API key in supplier settings for live tracking"
        }
    
    try:
        base_url = config.get("base_url") or supplier.get("api_endpoint_url")
        endpoint = config.get("endpoints", {}).get("order_status", "/orders/{order_id}").replace("{order_id}", supplier_order_id)
        
        headers = {"Content-Type": "application/json"}
        if config.get("auth_type") == "bearer":
            headers["Authorization"] = f"Bearer {api_key}"
        elif config.get("auth_type") == "api_key":
            headers["X-API-Key"] = api_key
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{base_url}{endpoint}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Update local order record if tracking info received
                if data.get("tracking_number"):
                    await db.supplier_orders.update_one(
                        {"supplier_order_id": supplier_order_id},
                        {"$set": {
                            "tracking_number": data.get("tracking_number"),
                            "status": data.get("status", "in_progress"),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                
                return {"supplier": supplier_name, **data, "demo_mode": False}
            else:
                raise HTTPException(status_code=502, detail=f"Supplier API returned {response.status_code}")
                
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Could not connect to supplier: {str(e)}")


# Get all supplier orders
@api_router.get("/supplier-orders")
async def get_supplier_orders(
    supplier_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all supplier orders with optional filters"""
    query = {}
    if supplier_id:
        query["supplier_id"] = supplier_id
    if patient_id:
        query["patient_id"] = patient_id
    if status:
        query["status"] = status
    
    orders = await db.supplier_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


# Bulk inventory check across multiple suppliers
@api_router.post("/suppliers/bulk-inventory-check")
async def bulk_inventory_check(
    product_sku: str = None,
    hcpcs_code: str = None,
    quantity: int = 1,
    current_user: dict = Depends(get_current_user)
):
    """Check inventory across all active suppliers for a product"""
    suppliers = await db.suppliers.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    results = []
    for supplier in suppliers:
        supplier_name = supplier.get("name")
        api_key = supplier.get("api_key")
        
        if api_key:
            # Would make real API call here
            try:
                config = SupplierAPIClient.SUPPLIER_CONFIGS.get(supplier_name, {})
                base_url = config.get("base_url") or supplier.get("api_endpoint_url")
                # Real implementation would call each supplier's API
                # For now, mark as needing real implementation
                result = {
                    "supplier_id": supplier["id"],
                    "supplier_name": supplier_name,
                    "has_api_key": True,
                    "status": "api_configured",
                    **SupplierAPIClient.get_demo_inventory(product_sku or hcpcs_code, quantity)
                }
            except Exception as e:
                result = {
                    "supplier_id": supplier["id"],
                    "supplier_name": supplier_name,
                    "has_api_key": True,
                    "status": "error",
                    "error": str(e)
                }
        else:
            result = {
                "supplier_id": supplier["id"],
                "supplier_name": supplier_name,
                "has_api_key": False,
                **SupplierAPIClient.get_demo_inventory(product_sku or hcpcs_code, quantity)
            }
        
        results.append(result)
    
    # Sort by availability
    results.sort(key=lambda x: (not x.get("available", False), x.get("quantity_available", 0)), reverse=True)
    
    return {
        "product_sku": product_sku,
        "hcpcs_code": hcpcs_code,
        "quantity_requested": quantity,
        "suppliers_checked": len(results),
        "results": results
    }


# Test supplier API connection
@api_router.post("/suppliers/{supplier_id}/test-connection")
async def test_supplier_connection(
    supplier_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Test connection to a supplier's API"""
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    api_key = supplier.get("api_key")
    supplier_name = supplier.get("name")
    
    if not api_key:
        return {
            "success": False,
            "supplier": supplier_name,
            "message": "No API key configured. Add API key in supplier settings to enable live integration.",
            "demo_mode_available": True
        }
    
    config = SupplierAPIClient.SUPPLIER_CONFIGS.get(supplier_name, {})
    base_url = config.get("base_url") or supplier.get("api_endpoint_url")
    
    try:
        headers = {"Content-Type": "application/json"}
        if config.get("auth_type") == "bearer":
            headers["Authorization"] = f"Bearer {api_key}"
        elif config.get("auth_type") == "api_key":
            headers["X-API-Key"] = api_key
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try a simple health check or inventory endpoint
            response = await client.get(f"{base_url}/health", headers=headers)
            
            if response.status_code in [200, 401, 403]:
                # Even auth errors mean we connected
                await db.suppliers.update_one(
                    {"id": supplier_id},
                    {"$set": {
                        "api_status": "connected" if response.status_code == 200 else "auth_error",
                        "last_connection_test": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                if response.status_code == 200:
                    return {"success": True, "supplier": supplier_name, "message": "API connection successful"}
                else:
                    return {"success": False, "supplier": supplier_name, "message": "Connected but authentication failed. Check API key."}
            else:
                return {"success": False, "supplier": supplier_name, "message": f"API returned status {response.status_code}"}
                
    except httpx.RequestError as e:
        await db.suppliers.update_one(
            {"id": supplier_id},
            {"$set": {"api_status": "connection_failed", "last_connection_test": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": False, "supplier": supplier_name, "message": f"Could not connect: {str(e)}"}


# ==================== DOCUMENT ROUTES ====================

@api_router.post("/documents", response_model=dict)
async def create_document(document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc_data = {
        "id": doc_id,
        **document.model_dump(),
        "document_type": document.document_type.value,
        "signature_status": SignatureStatus.PENDING.value,
        "signed_by": None,
        "signed_at": None,
        "created_at": now,
        "uploaded_by": current_user["id"]
    }
    
    await db.documents.insert_one(doc_data)
    
    await log_audit(current_user["id"], current_user["email"], "DOCUMENT_CREATED", "documents", doc_id)
    
    doc_data.pop("_id", None)
    return doc_data

@api_router.get("/documents", response_model=List[dict])
async def get_documents(
    patient_id: Optional[str] = None,
    document_type: Optional[DocumentType] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if document_type:
        query["document_type"] = document_type.value
    
    documents = await db.documents.find(query, {"_id": 0}).to_list(1000)
    return documents

@api_router.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@api_router.put("/documents/{document_id}")
async def update_document(document_id: str, updates: DocumentUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if "signature_status" in update_data:
        update_data["signature_status"] = update_data["signature_status"].value
    if "signed_at" in update_data and update_data["signed_at"]:
        update_data["signed_at"] = update_data["signed_at"].isoformat()
    
    result = await db.documents.update_one({"id": document_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await log_audit(current_user["id"], current_user["email"], "DOCUMENT_UPDATED", "documents", document_id)
    
    return {"message": "Document updated successfully"}

@api_router.delete("/documents/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.documents.delete_one({"id": document_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await log_audit(current_user["id"], current_user["email"], "DOCUMENT_DELETED", "documents", document_id)
    
    return {"message": "Document deleted successfully"}

# ==================== AUDIT LOG ROUTES ====================

@api_router.get("/audit-logs", response_model=List[dict])
async def get_audit_logs(
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if resource_type:
        query["resource_type"] = resource_type
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

@api_router.get("/audit-logs/patient/{patient_id}")
async def get_patient_audit_logs(
    patient_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    logs = await db.audit_logs.find(
        {"resource_type": "patients", "resource_id": patient_id},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    # Count totals
    total_patients = await db.patients.count_documents({})
    total_leads = await db.leads.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_suppliers = await db.suppliers.count_documents({})
    
    # Lead stats by status
    leads_new = await db.leads.count_documents({"status": LeadStatus.NEW.value})
    leads_verifying = await db.leads.count_documents({"status": LeadStatus.VERIFYING_INSURANCE.value})
    leads_qualified = await db.leads.count_documents({"status": LeadStatus.QUALIFIED.value})
    leads_lost = await db.leads.count_documents({"status": LeadStatus.LOST.value})
    
    # Order stats by status
    orders_pending = await db.orders.count_documents({"status": OrderStatus.PENDING.value})
    orders_confirmed = await db.orders.count_documents({"status": OrderStatus.CONFIRMED.value})
    orders_shipped = await db.orders.count_documents({"status": OrderStatus.SHIPPED.value})
    orders_delivered = await db.orders.count_documents({"status": OrderStatus.DELIVERED.value})
    
    # Recent activity
    recent_leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # ========== SALES STATS ==========
    # Calculate sales from completed orders (delivered status)
    
    # Today's sales
    today_orders = await db.orders.find({
        "status": OrderStatus.DELIVERED.value,
        "updated_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    sales_today = sum(o.get("total_amount", 0) for o in today_orders)
    sales_today_count = len(today_orders)
    
    # This week's sales
    week_orders = await db.orders.find({
        "status": OrderStatus.DELIVERED.value,
        "updated_at": {"$gte": week_start.isoformat()}
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    sales_week = sum(o.get("total_amount", 0) for o in week_orders)
    sales_week_count = len(week_orders)
    
    # This month's sales
    month_orders = await db.orders.find({
        "status": OrderStatus.DELIVERED.value,
        "updated_at": {"$gte": month_start.isoformat()}
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    sales_month = sum(o.get("total_amount", 0) for o in month_orders)
    sales_month_count = len(month_orders)
    
    # All-time sales
    all_orders = await db.orders.find({
        "status": OrderStatus.DELIVERED.value
    }, {"_id": 0, "total_amount": 1}).to_list(10000)
    sales_total = sum(o.get("total_amount", 0) for o in all_orders)
    sales_total_count = len(all_orders)
    
    # Pipeline value (estimated value from leads in active pipeline stages)
    pipeline_leads = await db.leads.find({
        "status": {"$in": [LeadStatus.OPPORTUNITY.value, LeadStatus.NEW.value, LeadStatus.VERIFYING_INSURANCE.value, LeadStatus.QUALIFIED.value]}
    }, {"_id": 0, "estimated_value": 1}).to_list(10000)
    pipeline_value = sum(l.get("estimated_value", 0) or 0 for l in pipeline_leads)
    
    # Weekly sales data for graph (last 7 days)
    weekly_sales_data = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_orders = await db.orders.find({
            "status": OrderStatus.DELIVERED.value,
            "updated_at": {"$gte": day.isoformat(), "$lt": day_end.isoformat()}
        }, {"_id": 0, "total_amount": 1}).to_list(1000)
        day_total = sum(o.get("total_amount", 0) for o in day_orders)
        weekly_sales_data.append({
            "date": day.strftime("%Y-%m-%d"),
            "day": day.strftime("%a"),
            "sales": day_total,
            "orders": len(day_orders)
        })
    
    return {
        "totals": {
            "patients": total_patients,
            "leads": total_leads,
            "orders": total_orders,
            "suppliers": total_suppliers
        },
        "leads_by_status": {
            "new": leads_new,
            "verifying_insurance": leads_verifying,
            "qualified": leads_qualified,
            "lost": leads_lost
        },
        "orders_by_status": {
            "pending": orders_pending,
            "confirmed": orders_confirmed,
            "shipped": orders_shipped,
            "delivered": orders_delivered
        },
        "sales": {
            "today": {"amount": sales_today, "count": sales_today_count},
            "week": {"amount": sales_week, "count": sales_week_count},
            "month": {"amount": sales_month, "count": sales_month_count},
            "total": {"amount": sales_total, "count": sales_total_count},
            "pipeline_value": pipeline_value
        },
        "weekly_sales": weekly_sales_data,
        "recent_leads": recent_leads,
        "recent_orders": recent_orders
    }

# ==================== ACCOUNTING / FINANCIAL ====================

class ExpenseCategory(str, Enum):
    SUPPLIES = "supplies"
    SHIPPING = "shipping"
    EQUIPMENT = "equipment"
    PAYROLL = "payroll"
    UTILITIES = "utilities"
    MARKETING = "marketing"
    SOFTWARE = "software"
    INSURANCE = "insurance"
    RENT = "rent"
    OTHER = "other"

class ExpenseCreate(BaseModel):
    category: ExpenseCategory
    description: str
    amount: float = Field(gt=0)
    vendor: Optional[str] = None
    date: str  # YYYY-MM-DD
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    recurring: bool = False
    recurring_frequency: Optional[str] = None  # monthly, weekly, yearly

class ExpenseUpdate(BaseModel):
    category: Optional[ExpenseCategory] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    vendor: Optional[str] = None
    date: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = None

@api_router.get("/accounting/summary")
async def get_accounting_summary(
    period: str = "month",  # day, week, month, quarter, year, all
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get comprehensive accounting summary with income, expenses, and metrics"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range based on period
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    start_iso = start_date.isoformat()
    
    # Get all orders in period (income)
    orders = await db.orders.find({
        "created_at": {"$gte": start_iso}
    }, {"_id": 0, "total_amount": 1, "status": 1, "created_at": 1}).to_list(1000)
    
    total_revenue = sum(o.get("total_amount", 0) for o in orders)
    completed_revenue = sum(o.get("total_amount", 0) for o in orders if o.get("status") in ["delivered", "shipped"])
    pending_revenue = sum(o.get("total_amount", 0) for o in orders if o.get("status") in ["pending", "confirmed"])
    
    # Get all expenses in period
    expenses = await db.expenses.find({
        "date": {"$gte": start_date.strftime("%Y-%m-%d")}
    }, {"_id": 0, "amount": 1, "category": 1, "date": 1}).to_list(1000)
    
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    
    # Expenses by category
    expenses_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "other")
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + exp.get("amount", 0)
    
    # Calculate profit
    net_profit = total_revenue - total_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    # Revenue by day/week/month for charts
    revenue_by_period = {}
    for order in orders:
        order_date = order.get("created_at", "")[:10]  # YYYY-MM-DD
        revenue_by_period[order_date] = revenue_by_period.get(order_date, 0) + order.get("total_amount", 0)
    
    expenses_by_period = {}
    for exp in expenses:
        exp_date = exp.get("date", "")[:10]
        expenses_by_period[exp_date] = expenses_by_period.get(exp_date, 0) + exp.get("amount", 0)
    
    # Create timeline data for charts
    timeline_data = []
    all_dates = set(list(revenue_by_period.keys()) + list(expenses_by_period.keys()))
    for date in sorted(all_dates):
        timeline_data.append({
            "date": date,
            "revenue": revenue_by_period.get(date, 0),
            "expenses": expenses_by_period.get(date, 0),
            "profit": revenue_by_period.get(date, 0) - expenses_by_period.get(date, 0)
        })
    
    # Order status breakdown
    order_status_counts = {}
    for order in orders:
        status = order.get("status", "pending")
        order_status_counts[status] = order_status_counts.get(status, 0) + 1
    
    # Get previous period for comparison
    if period == "month":
        prev_start = start_date - timedelta(days=30)
        prev_end_iso = start_iso
        prev_start_iso = prev_start.isoformat()
        
        prev_orders = await db.orders.find({
            "created_at": {"$gte": prev_start_iso, "$lt": prev_end_iso}
        }, {"_id": 0, "total_amount": 1}).to_list(1000)
        
        prev_revenue = sum(o.get("total_amount", 0) for o in prev_orders)
        
        prev_expenses_list = await db.expenses.find({
            "date": {"$gte": prev_start.strftime("%Y-%m-%d"), "$lt": start_date.strftime("%Y-%m-%d")}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        
        prev_expenses = sum(e.get("amount", 0) for e in prev_expenses_list)
        
        revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        expense_change = ((total_expenses - prev_expenses) / prev_expenses * 100) if prev_expenses > 0 else 0
    else:
        revenue_change = 0
        expense_change = 0
    
    # Pipeline value (estimated value from active leads - for forecasting)
    pipeline_leads = await db.leads.find({
        "status": {"$in": [LeadStatus.OPPORTUNITY.value, LeadStatus.NEW.value, LeadStatus.VERIFYING_INSURANCE.value, LeadStatus.QUALIFIED.value]}
    }, {"_id": 0, "estimated_value": 1}).to_list(10000)
    pipeline_value = sum(l.get("estimated_value", 0) or 0 for l in pipeline_leads)
    
    return {
        "period": period,
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "completed_revenue": round(completed_revenue, 2),
            "pending_revenue": round(pending_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(net_profit, 2),
            "profit_margin": round(profit_margin, 2),
            "total_orders": len(orders),
            "revenue_change_percent": round(revenue_change, 2),
            "expense_change_percent": round(expense_change, 2),
            "pipeline_value": round(pipeline_value, 2)
        },
        "expenses_by_category": expenses_by_category,
        "order_status_breakdown": order_status_counts,
        "timeline_data": timeline_data[-30:],  # Last 30 data points
        "top_expense_categories": sorted(
            [{"category": k, "amount": v} for k, v in expenses_by_category.items()],
            key=lambda x: x["amount"],
            reverse=True
        )[:5]
    }

@api_router.get("/accounting/expenses")
async def get_expenses(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get all expenses with optional filtering"""
    query = {}
    if category:
        query["category"] = category
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.expenses.count_documents(query)
    
    return {"expenses": expenses, "total": total}

@api_router.post("/accounting/expenses")
async def create_expense(
    expense: ExpenseCreate,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Create a new expense record"""
    expense_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    expense_doc = {
        "id": expense_id,
        **expense.model_dump(),
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.expenses.insert_one(expense_doc)
    
    await log_audit(
        current_user["id"], current_user["email"],
        "EXPENSE_CREATED", "expenses", expense_id,
        {"amount": expense.amount, "category": expense.category.value},
        ip_address=request.client.host if request.client else None
    )
    
    return {**expense_doc, "_id": None}

@api_router.put("/accounting/expenses/{expense_id}")
async def update_expense(
    expense_id: str,
    expense_update: ExpenseUpdate,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Update an expense record"""
    existing = await db.expenses.find_one({"id": expense_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_data = {k: v for k, v in expense_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    
    await log_audit(
        current_user["id"], current_user["email"],
        "EXPENSE_UPDATED", "expenses", expense_id,
        update_data,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Expense updated successfully"}

@api_router.delete("/accounting/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete an expense record"""
    existing = await db.expenses.find_one({"id": expense_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    await db.expenses.delete_one({"id": expense_id})
    
    await log_audit(
        current_user["id"], current_user["email"],
        "EXPENSE_DELETED", "expenses", expense_id,
        {"amount": existing.get("amount")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Expense deleted successfully"}

@api_router.get("/accounting/revenue-breakdown")
async def get_revenue_breakdown(
    period: str = "month",
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get detailed revenue breakdown by patient, supplier, and product"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    start_iso = start_date.isoformat()
    
    # Get orders with full details
    orders = await db.orders.find({
        "created_at": {"$gte": start_iso}
    }, {"_id": 0}).to_list(1000)
    
    # Revenue by supplier
    revenue_by_supplier = {}
    for order in orders:
        supplier_id = order.get("supplier_id")
        amount = order.get("total_amount", 0)
        revenue_by_supplier[supplier_id] = revenue_by_supplier.get(supplier_id, 0) + amount
    
    # Get supplier names
    supplier_breakdown = []
    for supplier_id, amount in revenue_by_supplier.items():
        supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0, "name": 1})
        supplier_breakdown.append({
            "supplier_id": supplier_id,
            "supplier_name": supplier.get("name", "Unknown") if supplier else "Unknown",
            "revenue": round(amount, 2)
        })
    
    # Revenue by product/HCPCS code
    revenue_by_product = {}
    for order in orders:
        for item in order.get("items", []):
            code = item.get("hcpcs_code", "Unknown")
            desc = item.get("description", "")
            amount = item.get("quantity", 0) * item.get("unit_price", 0)
            if code not in revenue_by_product:
                revenue_by_product[code] = {"description": desc, "revenue": 0, "quantity": 0}
            revenue_by_product[code]["revenue"] += amount
            revenue_by_product[code]["quantity"] += item.get("quantity", 0)
    
    product_breakdown = [
        {"hcpcs_code": k, **v, "revenue": round(v["revenue"], 2)}
        for k, v in revenue_by_product.items()
    ]
    product_breakdown.sort(key=lambda x: x["revenue"], reverse=True)
    
    return {
        "period": period,
        "by_supplier": sorted(supplier_breakdown, key=lambda x: x["revenue"], reverse=True),
        "by_product": product_breakdown[:10],
        "total_orders": len(orders)
    }

# ==================== INSURANCE COMPANY DIRECTORY ====================

@api_router.get("/insurance-companies")
async def get_insurance_companies(
    insurance_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all insurance companies with optional filtering"""
    query = {}
    if insurance_type:
        query["insurance_type"] = insurance_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"payer_id": {"$regex": search, "$options": "i"}}
        ]
    
    companies = await db.insurance_companies.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return companies

@api_router.get("/insurance-companies/{company_id}")
async def get_insurance_company(company_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific insurance company"""
    company = await db.insurance_companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Insurance company not found")
    return company

@api_router.post("/insurance-companies")
async def create_insurance_company(
    company: InsuranceCompanyCreate,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Create a new insurance company"""
    company_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    company_doc = {
        "id": company_id,
        **company.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    
    await db.insurance_companies.insert_one(company_doc)
    
    await log_audit(
        current_user["id"], current_user["email"],
        "INSURANCE_COMPANY_CREATED", "insurance_companies", company_id,
        {"name": company.name},
        ip_address=request.client.host if request.client else None
    )
    
    return {**company_doc, "_id": None}

@api_router.put("/insurance-companies/{company_id}")
async def update_insurance_company(
    company_id: str,
    company_update: InsuranceCompanyUpdate,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Update an insurance company"""
    existing = await db.insurance_companies.find_one({"id": company_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Insurance company not found")
    
    update_data = {k: v for k, v in company_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.insurance_companies.update_one({"id": company_id}, {"$set": update_data})
    
    await log_audit(
        current_user["id"], current_user["email"],
        "INSURANCE_COMPANY_UPDATED", "insurance_companies", company_id,
        update_data,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Insurance company updated successfully"}

@api_router.delete("/insurance-companies/{company_id}")
async def delete_insurance_company(
    company_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete an insurance company"""
    existing = await db.insurance_companies.find_one({"id": company_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Insurance company not found")
    
    await db.insurance_companies.delete_one({"id": company_id})
    
    await log_audit(
        current_user["id"], current_user["email"],
        "INSURANCE_COMPANY_DELETED", "insurance_companies", company_id,
        {"name": existing.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Insurance company deleted successfully"}

@api_router.post("/insurance-companies/seed-defaults")
async def seed_default_insurance_companies(
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Seed default Medicare and Medicaid insurance companies"""
    default_companies = [
        {
            "name": "Medicare Part B (Durable Medical Equipment)",
            "insurance_type": "medicare",
            "payer_id": "00882",
            "phone_main": "1-800-633-4227",
            "phone_dme": "1-800-633-4227",
            "phone_claims": "1-800-633-4227",
            "website": "https://www.medicare.gov",
            "dme_requirements": "Requires physician prescription, Certificate of Medical Necessity (CMN) for certain items, Prior authorization for power wheelchairs and some oxygen equipment",
            "prior_auth_required": True,
            "timely_filing_days": 365,
            "notes": "Medicare Administrative Contractors (MACs) process DME claims. Check jurisdiction for specific MAC."
        },
        {
            "name": "Medicare Advantage (Part C)",
            "insurance_type": "medicare",
            "phone_main": "1-800-633-4227",
            "phone_dme": "Contact specific plan",
            "website": "https://www.medicare.gov",
            "dme_requirements": "Coverage varies by plan. Contact specific Medicare Advantage plan for DME benefits and requirements.",
            "prior_auth_required": True,
            "timely_filing_days": 365,
            "notes": "Benefits managed by private insurance companies. Verify coverage with specific plan."
        },
        {
            "name": "Medicaid - Florida",
            "insurance_type": "medicaid",
            "payer_id": "FLMCD",
            "phone_main": "1-877-254-1055",
            "phone_dme": "1-877-254-1055",
            "phone_prior_auth": "1-877-254-1055",
            "website": "https://ahca.myflorida.com/medicaid",
            "dme_requirements": "Prior authorization required for most DME. Must use enrolled DME providers.",
            "prior_auth_required": True,
            "timely_filing_days": 365,
            "notes": "Florida Medicaid managed care plans may have different requirements."
        },
        {
            "name": "Medicaid - General",
            "insurance_type": "medicaid",
            "phone_main": "Contact state Medicaid office",
            "dme_requirements": "Requirements vary by state. Prior authorization typically required. Must verify patient eligibility monthly.",
            "prior_auth_required": True,
            "notes": "Contact specific state Medicaid office for DME coverage and requirements."
        },
        {
            "name": "Blue Cross Blue Shield",
            "insurance_type": "commercial",
            "phone_main": "See member ID card",
            "phone_dme": "See member ID card",
            "website": "https://www.bcbs.com",
            "dme_requirements": "Coverage varies by plan. Prior auth often required for DME over certain dollar thresholds.",
            "prior_auth_required": True,
            "timely_filing_days": 180,
            "notes": "Contact specific BCBS plan based on member's state/prefix on ID card."
        },
        {
            "name": "Aetna",
            "insurance_type": "commercial",
            "payer_id": "60054",
            "phone_main": "1-800-872-3862",
            "phone_dme": "1-800-872-3862",
            "phone_prior_auth": "1-800-872-3862",
            "website": "https://www.aetna.com",
            "dme_requirements": "Prior authorization required for most DME. Use Availity or NaviNet for electronic prior auth.",
            "prior_auth_required": True,
            "timely_filing_days": 180,
            "notes": "Check specific plan benefits for DME coverage limits."
        },
        {
            "name": "United Healthcare",
            "insurance_type": "commercial",
            "payer_id": "87726",
            "phone_main": "1-800-842-9302",
            "phone_dme": "1-800-842-9302",
            "phone_prior_auth": "1-800-842-9302",
            "website": "https://www.uhc.com",
            "dme_requirements": "Prior authorization required. Must use in-network DME suppliers when possible.",
            "prior_auth_required": True,
            "timely_filing_days": 180,
            "notes": "UHC has specific DME supplier network. Verify provider enrollment."
        },
        {
            "name": "Cigna",
            "insurance_type": "commercial",
            "payer_id": "62308",
            "phone_main": "1-800-997-1654",
            "phone_dme": "1-800-997-1654",
            "phone_prior_auth": "1-800-997-1654",
            "website": "https://www.cigna.com",
            "dme_requirements": "Prior authorization typically required for DME. Check CignaforHCP portal for requirements.",
            "prior_auth_required": True,
            "timely_filing_days": 180
        },
        {
            "name": "Humana",
            "insurance_type": "commercial",
            "payer_id": "61101",
            "phone_main": "1-800-448-6262",
            "phone_dme": "1-800-448-6262",
            "phone_prior_auth": "1-800-448-6262",
            "website": "https://www.humana.com",
            "dme_requirements": "Prior authorization required for most DME items.",
            "prior_auth_required": True,
            "timely_filing_days": 180
        },
        {
            "name": "TRICARE",
            "insurance_type": "tricare",
            "phone_main": "1-800-444-5445",
            "phone_dme": "1-800-444-5445",
            "website": "https://www.tricare.mil",
            "dme_requirements": "Must use authorized DME suppliers. Prior authorization required for most items.",
            "prior_auth_required": True,
            "timely_filing_days": 365,
            "notes": "Coverage for military members and dependents."
        },
        {
            "name": "Veterans Affairs (VA)",
            "insurance_type": "va",
            "phone_main": "1-800-827-1000",
            "phone_dme": "Contact local VA medical center",
            "website": "https://www.va.gov",
            "dme_requirements": "DME typically provided through VA Prosthetics department. Contact local VA for requirements.",
            "prior_auth_required": True,
            "notes": "Veterans must be enrolled in VA healthcare. DME provided through VA system."
        }
    ]
    
    inserted_count = 0
    for company_data in default_companies:
        # Check if already exists by name
        existing = await db.insurance_companies.find_one({"name": company_data["name"]})
        if not existing:
            company_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            company_doc = {
                "id": company_id,
                **company_data,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
            await db.insurance_companies.insert_one(company_doc)
            inserted_count += 1
    
    await log_audit(
        current_user["id"], current_user["email"],
        "INSURANCE_COMPANIES_SEEDED", "insurance_companies", None,
        {"count": inserted_count},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Seeded {inserted_count} default insurance companies"}

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== MAGIC LINK & DOCTOR PORTAL ====================

# Magic Link Models
class MagicLinkRequest(BaseModel):
    doctor_id: str
    order_id: str
    patient_id: str

class MagicLinkVerify(BaseModel):
    token: str
    verification_code: str

class SignatureRequest(BaseModel):
    order_id: str
    document_id: str
    signature_data: str  # Base64 encoded signature image
    signature_type: str = "draw"  # draw, type, or upload
    signer_name: Optional[str] = None
    ip_address: Optional[str] = None

class FileUploadRequest(BaseModel):
    order_id: str
    patient_id: str
    file_name: str
    file_data: str  # Base64 encoded file
    document_type: str = "face_to_face"

# Mock Twilio SMS Service
class MockTwilioService:
    """Mock Twilio service for development - replace with real Twilio in production"""
    
    @staticmethod
    async def send_sms(phone_number: str, message: str) -> dict:
        # In production, this would use Twilio API
        # twilio_client.messages.create(to=phone_number, from_=TWILIO_NUMBER, body=message)
        logger.info(f"[MOCK TWILIO] SMS to {phone_number}: {message}")
        return {
            "status": "sent",
            "sid": f"mock_sid_{uuid.uuid4().hex[:8]}",
            "to": phone_number,
            "message": message
        }

    @staticmethod
    async def send_magic_link(phone_number: str, magic_link: str, verification_code: str) -> dict:
        message = f"Your DME CRM verification code is: {verification_code}. Access your prescriptions at: {magic_link}"
        return await MockTwilioService.send_sms(phone_number, message)

twilio_service = MockTwilioService()

# Mock E-Signature Service
class MockESignatureService:
    """Mock e-signature service - replace with Dropbox Sign/DocuSign in production"""
    
    @staticmethod
    async def create_signature_request(document_id: str, signer_email: str, signer_name: str) -> dict:
        signature_request_id = str(uuid.uuid4())
        return {
            "signature_request_id": signature_request_id,
            "status": "awaiting_signature",
            "signer_email": signer_email,
            "signer_name": signer_name,
            "document_id": document_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    async def embed_signature(signature_request_id: str) -> dict:
        # Returns embedded signing URL (mock)
        return {
            "sign_url": f"/doctor-portal/sign/{signature_request_id}",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        }
    
    @staticmethod
    async def complete_signature(signature_request_id: str, signature_data: str, ip_address: str) -> dict:
        # Create audit trail for the signature
        audit_trail = {
            "signature_request_id": signature_request_id,
            "signed_at": datetime.now(timezone.utc).isoformat(),
            "ip_address": ip_address,
            "signature_method": "embedded_electronic",
            "verification_method": "magic_link_2fa",
            "certificate_id": f"cert_{uuid.uuid4().hex[:12]}",
            "legal_statement": "I agree that my electronic signature is the legal equivalent of my manual signature."
        }
        return {
            "status": "signed",
            "audit_trail": audit_trail,
            "certificate_url": f"/api/documents/certificate/{signature_request_id}"
        }

esign_service = MockESignatureService()

# Generate Magic Link for Doctor
@api_router.post("/doctor-portal/send-magic-link")
async def send_magic_link(request: MagicLinkRequest, req: Request, current_user: dict = Depends(get_current_user)):
    # Verify doctor exists
    doctor = await db.users.find_one({"id": request.doctor_id, "role": "doctor"})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Verify order exists and belongs to patient
    order = await db.orders.find_one({"id": request.order_id, "patient_id": request.patient_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Generate magic link token and verification code
    magic_token = str(uuid.uuid4())
    verification_code = ''.join([str(uuid.uuid4().int % 10) for _ in range(6)])
    
    # Store magic link in database
    magic_link_doc = {
        "id": str(uuid.uuid4()),
        "token": magic_token,
        "verification_code": verification_code,
        "doctor_id": request.doctor_id,
        "order_id": request.order_id,
        "patient_id": request.patient_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "used": False,
        "verified": False
    }
    await db.magic_links.insert_one(magic_link_doc)
    
    # Get frontend URL from environment or use default
    frontend_url = os.environ.get('FRONTEND_URL', '')
    magic_link_url = f"{frontend_url}/doctor-portal?token={magic_token}"
    
    # Send SMS with magic link (mock)
    doctor_phone = doctor.get("phone", "+1234567890")  # Default for testing
    sms_result = await twilio_service.send_magic_link(doctor_phone, magic_link_url, verification_code)
    
    # Update order status
    await db.orders.update_one(
        {"id": request.order_id},
        {"$set": {"status": OrderStatus.PRESCRIPTION_SENT.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_audit(current_user["id"], current_user["email"], "MAGIC_LINK_SENT", "orders", request.order_id,
                   details={"doctor_id": request.doctor_id, "sms_sid": sms_result.get("sid")})
    
    return {
        "message": "Magic link sent successfully",
        "magic_link": magic_link_url,  # Return for testing/demo purposes
        "verification_code": verification_code,  # Return for testing/demo purposes - remove in production
        "expires_at": magic_link_doc["expires_at"],
        "sms_status": sms_result["status"]
    }

# Verify Magic Link
@api_router.post("/doctor-portal/verify")
async def verify_magic_link(request: MagicLinkVerify, req: Request):
    # Find magic link
    magic_link = await db.magic_links.find_one({"token": request.token, "used": False})
    if not magic_link:
        raise HTTPException(status_code=404, detail="Invalid or expired magic link")
    
    # Check expiration
    expires_at = datetime.fromisoformat(magic_link["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Magic link has expired")
    
    # Verify code
    if magic_link["verification_code"] != request.verification_code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Mark as verified (but not used yet - used after signing)
    await db.magic_links.update_one(
        {"token": request.token},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get doctor info
    doctor = await db.users.find_one({"id": magic_link["doctor_id"]}, {"_id": 0, "password_hash": 0})
    
    # Generate temporary session token for doctor portal
    portal_token = jwt.encode({
        "sub": magic_link["doctor_id"],
        "magic_link_id": magic_link["id"],
        "order_id": magic_link["order_id"],
        "patient_id": magic_link["patient_id"],
        "type": "doctor_portal",
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    await log_audit(magic_link["doctor_id"], doctor["email"], "MAGIC_LINK_VERIFIED", "doctor_portal", magic_link["id"],
                   ip_address=req.client.host if req.client else None)
    
    return {
        "message": "Verification successful",
        "portal_token": portal_token,
        "doctor": doctor,
        "order_id": magic_link["order_id"],
        "patient_id": magic_link["patient_id"]
    }

# Get Pending Orders for Doctor Portal
@api_router.get("/doctor-portal/pending-orders")
async def get_doctor_pending_orders(req: Request, authorization: str = None):
    # Extract token from query or header
    token = req.query_params.get("token") or (authorization.replace("Bearer ", "") if authorization else None)
    
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "doctor_portal":
            raise HTTPException(status_code=401, detail="Invalid portal token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    doctor_id = payload["sub"]
    order_id = payload.get("order_id")
    patient_id = payload.get("patient_id")
    
    # Get the specific order for this magic link session
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get patient info
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    
    # Get any existing documents for this order
    documents = await db.documents.find({"order_id": order_id}, {"_id": 0}).to_list(100)
    
    # Get supplier info
    supplier = await db.suppliers.find_one({"id": order.get("supplier_id")}, {"_id": 0, "api_key": 0})
    
    return {
        "order": order,
        "patient": patient,
        "documents": documents,
        "supplier": supplier
    }

# Generate CMN PDF
@api_router.post("/doctor-portal/generate-cmn")
async def generate_cmn(order_id: str, req: Request, authorization: str = None):
    token = req.query_params.get("token") or (authorization.replace("Bearer ", "") if authorization else None)
    
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get order details
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get patient
    patient = await db.patients.find_one({"id": order["patient_id"]}, {"_id": 0})
    
    # Get doctor
    doctor = await db.users.find_one({"id": order["prescriber_id"]}, {"_id": 0, "password_hash": 0})
    
    # Get supplier
    supplier = await db.suppliers.find_one({"id": order["supplier_id"]}, {"_id": 0, "api_key": 0})
    
    # Generate CMN document record
    cmn_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    cmn_data = {
        "id": cmn_id,
        "order_id": order_id,
        "patient_id": patient["id"],
        "document_type": "cmn",
        "file_name": f"CMN_{order_id[:8]}_{patient['last_name']}.pdf",
        "file_path": f"/documents/cmn/{cmn_id}.pdf",
        "signature_status": "pending",
        "signature_request_id": None,
        "audit_trail": None,
        "created_at": now,
        "uploaded_by": payload["sub"],
        # CMN specific data for PDF generation
        "cmn_data": {
            "patient": {
                "name": f"{patient['first_name']} {patient['last_name']}",
                "dob": patient["date_of_birth"],
                "ssn_last_four": patient["ssn_last_four"],
                "primary_insurance": patient["primary_insurance"],
                "secondary_insurance": patient.get("secondary_insurance"),
                "address": patient.get("address", "")
            },
            "prescriber": {
                "name": f"Dr. {doctor['first_name']} {doctor['last_name']}",
                "email": doctor["email"],
                "npi": doctor.get("npi", "NPI-PENDING")
            },
            "supplier": {
                "name": supplier["name"] if supplier else "Unknown",
                "address": supplier.get("address", "") if supplier else ""
            },
            "equipment": order["items"],
            "diagnosis_codes": order.get("diagnosis_codes", []),
            "medical_necessity": order.get("medical_necessity", "Medical necessity documentation pending"),
            "order_date": order["created_at"],
            "total_amount": order["total_amount"]
        }
    }
    
    await db.documents.insert_one(cmn_data)
    
    # Create signature request (mock)
    sig_request = await esign_service.create_signature_request(
        cmn_id, doctor["email"], f"Dr. {doctor['first_name']} {doctor['last_name']}"
    )
    
    await db.documents.update_one(
        {"id": cmn_id},
        {"$set": {"signature_request_id": sig_request["signature_request_id"]}}
    )
    
    # Get embedded signing URL
    embed_result = await esign_service.embed_signature(sig_request["signature_request_id"])
    
    await log_audit(payload["sub"], doctor["email"], "CMN_GENERATED", "documents", cmn_id,
                   details={"order_id": order_id})
    
    cmn_data.pop("_id", None)
    return {
        "cmn_document": cmn_data,
        "signature_request": sig_request,
        "sign_url": embed_result["sign_url"]
    }

# Sign Document (E-Signature)
@api_router.post("/doctor-portal/sign")
async def sign_document(request: SignatureRequest, req: Request, authorization: str = None):
    token = req.query_params.get("token") or (authorization.replace("Bearer ", "") if authorization else None)
    
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    doctor_id = payload["sub"]
    ip_address = request.ip_address or (req.client.host if req.client else "unknown")
    
    # Get document
    document = await db.documents.find_one({"id": request.document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.get("signature_status") == "signed":
        raise HTTPException(status_code=400, detail="Document already signed")
    
    # Get doctor info for audit
    doctor = await db.users.find_one({"id": doctor_id}, {"_id": 0, "password_hash": 0})
    
    # Complete signature (mock)
    sig_result = await esign_service.complete_signature(
        document.get("signature_request_id", str(uuid.uuid4())),
        request.signature_data,
        ip_address
    )
    
    # Create comprehensive audit trail
    audit_trail = {
        **sig_result["audit_trail"],
        "signer_id": doctor_id,
        "signer_email": doctor["email"],
        "signer_name": request.signer_name or f"Dr. {doctor['first_name']} {doctor['last_name']}",
        "document_id": request.document_id,
        "order_id": request.order_id,
        "signature_type": request.signature_type,
        "email_verified": True,
        "sms_verified": True,
        "user_agent": req.headers.get("user-agent", "unknown")
    }
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update document with signature (store full signature data)
    await db.documents.update_one(
        {"id": request.document_id},
        {"$set": {
            "signature_status": "signed",
            "signed_by": doctor_id,
            "signed_at": now,
            "audit_trail": audit_trail,
            "signature_data": request.signature_data,  # Full base64 signature image
            "signature_type": getattr(request, 'signature_type', 'typed')  # Track how it was signed
        }}
    )
    
    # Update order status to PRESCRIPTION_VERIFIED
    await db.orders.update_one(
        {"id": request.order_id},
        {"$set": {
            "status": OrderStatus.PRESCRIPTION_VERIFIED.value,
            "prescription_signed_at": now,
            "prescription_signed_by": doctor_id,
            "updated_at": now
        }}
    )
    
    # Mark magic link as used
    magic_link_id = payload.get("magic_link_id")
    if magic_link_id:
        await db.magic_links.update_one(
            {"id": magic_link_id},
            {"$set": {"used": True, "used_at": now}}
        )
    
    # Create notification for sales rep (store in notifications collection)
    order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    notification = {
        "id": str(uuid.uuid4()),
        "type": "prescription_signed",
        "order_id": request.order_id,
        "message": f"Prescription for order {request.order_id[:8]} has been signed by Dr. {doctor['last_name']}",
        "created_by": order.get("created_by"),
        "created_at": now,
        "read": False
    }
    await db.notifications.insert_one(notification)
    
    await log_audit(doctor_id, doctor["email"], "DOCUMENT_SIGNED", "documents", request.document_id,
                   details={"order_id": request.order_id, "audit_trail": audit_trail},
                   ip_address=ip_address)
    
    return {
        "message": "Document signed successfully",
        "signature_status": "signed",
        "audit_trail": audit_trail,
        "order_status": OrderStatus.PRESCRIPTION_VERIFIED.value,
        "notification_sent": True
    }

# Upload Face-to-Face Document
@api_router.post("/doctor-portal/upload-document")
async def upload_face_to_face(request: FileUploadRequest, req: Request, authorization: str = None):
    token = req.query_params.get("token") or (authorization.replace("Bearer ", "") if authorization else None)
    
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    doctor_id = payload["sub"]
    
    # Create document record
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc_data = {
        "id": doc_id,
        "order_id": request.order_id,
        "patient_id": request.patient_id,
        "document_type": request.document_type,
        "file_name": request.file_name,
        "file_path": f"/documents/{request.document_type}/{doc_id}_{request.file_name}",
        "file_size": len(request.file_data),
        "signature_status": "signed",  # F2F notes are auto-signed by upload
        "signed_by": doctor_id,
        "signed_at": now,
        "created_at": now,
        "uploaded_by": doctor_id,
        "audit_trail": {
            "uploaded_at": now,
            "uploaded_by": doctor_id,
            "ip_address": req.client.host if req.client else "unknown",
            "file_hash": str(hash(request.file_data))[:16]
        }
    }
    
    # In production, save file_data to storage (S3, etc.)
    # For now, we just store the metadata
    
    await db.documents.insert_one(doc_data)
    
    doctor = await db.users.find_one({"id": doctor_id}, {"_id": 0, "password_hash": 0})
    
    await log_audit(doctor_id, doctor["email"], "DOCUMENT_UPLOADED", "documents", doc_id,
                   details={"order_id": request.order_id, "document_type": request.document_type})
    
    doc_data.pop("_id", None)
    return {
        "message": "Document uploaded successfully",
        "document": doc_data
    }

# Save signature template from doctor portal (token-based auth)
class DoctorSignatureSave(BaseModel):
    signature_data: str
    signature_type: str
    signer_name: str
    signature_name: Optional[str] = "My Signature"

@api_router.post("/doctor-portal/save-signature")
async def save_doctor_signature(request: DoctorSignatureSave, req: Request, authorization: str = None):
    """Save a signature template for the doctor (uses portal token, not JWT)"""
    token = req.query_params.get("token") or (authorization.replace("Bearer ", "") if authorization else None)
    
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    doctor_id = payload["sub"]
    
    # Get IP address
    forwarded_for = req.headers.get("X-Forwarded-For", "")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else req.client.host
    
    # Check if doctor already has a saved signature with this name
    existing = await db.signatures.find_one({
        "user_id": doctor_id,
        "is_saved_template": True,
        "signature_name": request.signature_name
    })
    
    if existing:
        # Update existing signature template
        await db.signatures.update_one(
            {"id": existing["id"]},
            {"$set": {
                "signature_data": request.signature_data,
                "signature_type": request.signature_type,
                "signer_name": request.signer_name,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "Signature template updated", "id": existing["id"]}
    
    # Create new signature template
    signature_record = {
        "id": str(uuid.uuid4()),
        "user_id": doctor_id,
        "signature_data": request.signature_data,
        "signature_type": request.signature_type,
        "signer_name": request.signer_name,
        "signer_role": "prescriber",
        "ip_address": client_ip,
        "user_agent": req.headers.get("User-Agent", ""),
        "timestamp": datetime.now(timezone.utc),
        "is_saved_template": True,
        "signature_name": request.signature_name
    }
    
    await db.signatures.insert_one(signature_record)
    
    return {"message": "Signature template saved", "id": signature_record["id"]}

# Get saved signatures for doctor portal (token-based auth)
@api_router.get("/doctor-portal/saved-signatures")
async def get_doctor_saved_signatures(req: Request, authorization: str = None):
    """Get saved signature templates for the doctor"""
    token = req.query_params.get("token") or (authorization.replace("Bearer ", "") if authorization else None)
    
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    doctor_id = payload["sub"]
    
    signatures = await db.signatures.find(
        {"user_id": doctor_id, "is_saved_template": True},
        {"_id": 0, "signature_data": 1, "signature_type": 1, "signature_name": 1, "signer_name": 1, "id": 1}
    ).to_list(20)
    
    return signatures

# Get Notifications
@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"created_by": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return notifications

# Mark Notification as Read
@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Notification marked as read"}

# ==================== SMART ON FHIR ====================

# FHIR Configuration
FHIR_CONFIG = {
    "iss": os.environ.get("FHIR_ISS", "https://fhir.example.com"),
    "client_id": os.environ.get("FHIR_CLIENT_ID", "dme-crm-app"),
    "scopes": "launch patient/*.read user/*.read openid fhirUser"
}

# FHIR Launch Endpoint (for EHR integration)
@api_router.get("/fhir/launch")
async def fhir_launch(iss: str = None, launch: str = None):
    """
    SMART on FHIR launch endpoint.
    Called by EHR systems (Epic, Cerner) when launching the app from within their system.
    """
    if not iss or not launch:
        raise HTTPException(status_code=400, detail="Missing iss or launch parameter")
    
    # Store launch context
    launch_id = str(uuid.uuid4())
    launch_doc = {
        "id": launch_id,
        "iss": iss,
        "launch": launch,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    await db.fhir_launches.insert_one(launch_doc)
    
    # Build authorization URL (would redirect to EHR's auth server in production)
    # For mock, we return the launch context
    return {
        "launch_id": launch_id,
        "authorize_url": f"{iss}/authorize",
        "client_id": FHIR_CONFIG["client_id"],
        "scope": FHIR_CONFIG["scopes"],
        "redirect_uri": os.environ.get("FHIR_REDIRECT_URI", "/fhir/callback"),
        "state": launch_id,
        "aud": iss
    }

# FHIR Callback (OAuth callback from EHR)
@api_router.get("/fhir/callback")
async def fhir_callback(code: str = None, state: str = None, error: str = None):
    """
    SMART on FHIR OAuth callback.
    Receives authorization code from EHR and exchanges for access token.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"FHIR authorization error: {error}")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")
    
    # Find launch context
    launch = await db.fhir_launches.find_one({"id": state})
    if not launch:
        raise HTTPException(status_code=404, detail="Launch context not found")
    
    # In production, exchange code for access token with EHR's token endpoint
    # For mock, we create a simulated token
    mock_fhir_token = {
        "access_token": f"fhir_token_{uuid.uuid4().hex}",
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": FHIR_CONFIG["scopes"],
        "patient": f"Patient/{uuid.uuid4().hex[:8]}",  # FHIR patient ID from EHR
        "encounter": f"Encounter/{uuid.uuid4().hex[:8]}"  # Current encounter if available
    }
    
    # Update launch context
    await db.fhir_launches.update_one(
        {"id": state},
        {"$set": {
            "status": "completed",
            "fhir_token": mock_fhir_token,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "FHIR authorization successful",
        "launch_id": state,
        "fhir_context": mock_fhir_token,
        "redirect_url": f"/doctor-portal?fhir_launch={state}"
    }

# FHIR Patient Data (fetch patient from EHR)
@api_router.get("/fhir/patient/{fhir_patient_id}")
async def get_fhir_patient(fhir_patient_id: str, launch_id: str = None):
    """
    Fetch patient data from EHR via FHIR.
    In production, this would call the EHR's FHIR API.
    """
    # Get launch context for access token
    launch = await db.fhir_launches.find_one({"id": launch_id}) if launch_id else None
    
    # Mock FHIR patient data (in production, call EHR's FHIR API)
    mock_fhir_patient = {
        "resourceType": "Patient",
        "id": fhir_patient_id,
        "identifier": [
            {"system": "http://hl7.org/fhir/sid/us-ssn", "value": "***-**-1234"},
            {"system": "urn:oid:2.16.840.1.113883.4.1", "value": "MRN-12345"}
        ],
        "name": [{"family": "Smith", "given": ["John", "Robert"]}],
        "birthDate": "1985-07-15",
        "gender": "male",
        "address": [{"line": ["123 Main St"], "city": "Boston", "state": "MA", "postalCode": "02101"}],
        "telecom": [
            {"system": "phone", "value": "555-123-4567"},
            {"system": "email", "value": "john.smith@email.com"}
        ]
    }
    
    return {
        "fhir_patient": mock_fhir_patient,
        "source": "mock_ehr",
        "retrieved_at": datetime.now(timezone.utc).isoformat()
    }

# FHIR Medication Request (for DME orders)
@api_router.post("/fhir/medication-request")
async def create_fhir_medication_request(order_id: str, current_user: dict = Depends(get_current_user)):
    """
    Create a FHIR MedicationRequest resource for DME order.
    This can be sent back to the EHR for documentation.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    patient = await db.patients.find_one({"id": order["patient_id"]}, {"_id": 0})
    doctor = await db.users.find_one({"id": order["prescriber_id"]}, {"_id": 0, "password_hash": 0})
    
    # Build FHIR MedicationRequest
    fhir_request = {
        "resourceType": "DeviceRequest",  # More appropriate for DME
        "id": order_id,
        "status": "active" if order["status"] != "cancelled" else "cancelled",
        "intent": "order",
        "codeCodeableConcept": {
            "coding": [
                {
                    "system": "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets",
                    "code": item["hcpcs_code"],
                    "display": item["description"]
                } for item in order.get("items", [])
            ]
        },
        "subject": {
            "reference": f"Patient/{patient['id']}",
            "display": f"{patient['first_name']} {patient['last_name']}"
        },
        "requester": {
            "reference": f"Practitioner/{doctor['id']}",
            "display": f"Dr. {doctor['first_name']} {doctor['last_name']}"
        },
        "authoredOn": order["created_at"],
        "note": [{"text": order.get("notes", "")}]
    }
    
    return {
        "fhir_resource": fhir_request,
        "order_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

# FHIR .well-known configuration (for EHR discovery)
@api_router.get("/.well-known/smart-configuration")
async def smart_configuration():
    """
    SMART on FHIR configuration endpoint.
    EHR systems use this to discover our app's capabilities.
    """
    base_url = os.environ.get("API_BASE_URL", "/api")
    
    return {
        "authorization_endpoint": f"{base_url}/fhir/authorize",
        "token_endpoint": f"{base_url}/fhir/token",
        "capabilities": [
            "launch-ehr",
            "launch-standalone", 
            "client-public",
            "client-confidential-symmetric",
            "context-ehr-patient",
            "context-standalone-patient",
            "permission-offline",
            "permission-patient",
            "permission-user"
        ],
        "scopes_supported": FHIR_CONFIG["scopes"].split(" "),
        "response_types_supported": ["code"],
        "management_endpoint": f"{base_url}/fhir/manage",
        "introspection_endpoint": f"{base_url}/fhir/introspect",
        "revocation_endpoint": f"{base_url}/fhir/revoke"
    }

# ==================== PAGE GENERATOR (Dev Settings) ====================

class LocationType(str, Enum):
    STATE = "state"
    COUNTY = "county"
    CITY = "city"

class LocationCreate(BaseModel):
    name: str
    slug: str
    type: LocationType
    geo_region_code: str  # e.g., "US-VA", "US-AK"
    parent_id: Optional[str] = None  # For county->state or city->county relationship
    region_name: Optional[str] = None  # e.g., "Southcentral Alaska"
    stats: Optional[dict] = None  # e.g., {"counties": 5, "cities": 34}

class LocationResponse(LocationCreate):
    id: str
    created_at: datetime

class PageGenerateRequest(BaseModel):
    location_ids: List[str]  # Generate pages for these locations
    include_children: bool = True  # Also generate child pages

# Super admin email
SUPER_ADMIN_EMAIL = "mel@a2gdesigns.com"

# Database collections available for export
DB_COLLECTIONS = [
    "patients", "leads", "orders", "documents", "users", "suppliers",
    "products", "audit_logs", "analytics_events", "site_settings", 
    "site_rules", "signatures", "notifications", "analytics_sessions"
]

def check_db_permission(user: dict):
    """Check if user has permission for database operations"""
    is_super_admin = user.get("email", "").lower() == SUPER_ADMIN_EMAIL.lower()
    is_store_owner = user.get("role") == "store_owner"
    if not (is_super_admin or is_store_owner):
        raise HTTPException(status_code=403, detail="Only Super Admin or Store Owner can perform database operations")
    return True

# Get database stats
@api_router.get("/dev/database/stats")
async def get_database_stats(current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Get statistics for all database collections"""
    check_db_permission(current_user)
    
    stats = {"collections": {}, "total_documents": 0}
    
    for collection_name in DB_COLLECTIONS:
        try:
            collection = db[collection_name]
            count = await collection.count_documents({})
            stats["collections"][collection_name] = {"count": count}
            stats["total_documents"] += count
        except Exception as e:
            stats["collections"][collection_name] = {"count": 0, "error": str(e)}
    
    return stats

# Export single collection
@api_router.get("/dev/database/export/{collection_name}")
async def export_collection(collection_name: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Export a single collection as JSON"""
    check_db_permission(current_user)
    
    if collection_name not in DB_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid collection: {collection_name}")
    
    collection = db[collection_name]
    
    # Exclude sensitive fields
    projection = {"_id": 0}
    if collection_name == "users":
        projection["password_hash"] = 0
    
    documents = await collection.find({}, projection).to_list(100000)
    
    # Convert datetime objects to ISO strings
    import json
    def serialize(obj):
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    json_content = json.dumps(documents, default=serialize, indent=2)
    
    await log_audit(current_user["id"], current_user["email"], "DATABASE_EXPORT", "database", collection_name)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={collection_name}_export.json"}
    )

# Export entire database
@api_router.get("/dev/database/export-all")
async def export_full_database(current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Export entire database as JSON"""
    check_db_permission(current_user)
    
    full_backup = {"exported_at": datetime.now(timezone.utc).isoformat(), "collections": {}}
    
    for collection_name in DB_COLLECTIONS:
        try:
            collection = db[collection_name]
            projection = {"_id": 0}
            if collection_name == "users":
                projection["password_hash"] = 0
            
            documents = await collection.find({}, projection).to_list(100000)
            full_backup["collections"][collection_name] = documents
        except Exception as e:
            full_backup["collections"][collection_name] = {"error": str(e)}
    
    import json
    def serialize(obj):
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    json_content = json.dumps(full_backup, default=serialize, indent=2)
    
    await log_audit(current_user["id"], current_user["email"], "DATABASE_FULL_EXPORT", "database", None)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=full_database_backup.json"}
    )

# Import database
@api_router.post("/dev/database/import")
async def import_database(file: UploadFile = File(...), current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Import database from JSON backup file"""
    check_db_permission(current_user)
    
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")
    
    import json
    
    content = await file.read()
    try:
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    
    imported_collections = 0
    errors = []
    
    # Check if it's a full backup or single collection
    if "collections" in data:
        # Full backup format
        for collection_name, documents in data["collections"].items():
            if collection_name not in DB_COLLECTIONS:
                continue
            if isinstance(documents, dict) and "error" in documents:
                continue
            if not isinstance(documents, list):
                continue
            
            try:
                collection = db[collection_name]
                if documents:
                    # Use upsert to avoid duplicates
                    for doc in documents:
                        if "id" in doc:
                            await collection.update_one(
                                {"id": doc["id"]},
                                {"$set": doc},
                                upsert=True
                            )
                        else:
                            await collection.insert_one(doc)
                    imported_collections += 1
            except Exception as e:
                errors.append({"collection": collection_name, "error": str(e)})
    else:
        # Single collection format (list of documents)
        raise HTTPException(status_code=400, detail="Please use full backup format with 'collections' key")
    
    await log_audit(
        current_user["id"], 
        current_user["email"], 
        "DATABASE_IMPORT", 
        "database", 
        None,
        details={"imported_collections": imported_collections, "errors": len(errors)}
    )
    
    return {"imported_collections": imported_collections, "errors": errors}

# Clear collection (super admin only)
@api_router.delete("/dev/database/clear/{collection_name}")
async def clear_collection(collection_name: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Clear all documents from a collection (super admin only)"""
    # Only super admin can clear collections
    if current_user.get("email", "").lower() != SUPER_ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Only Super Admin can clear collections")
    
    if collection_name not in DB_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid collection: {collection_name}")
    
    # Prevent clearing users collection entirely
    if collection_name == "users":
        raise HTTPException(status_code=400, detail="Cannot clear users collection. Delete users individually.")
    
    collection = db[collection_name]
    result = await collection.delete_many({})
    
    await log_audit(
        current_user["id"], 
        current_user["email"], 
        "DATABASE_CLEAR", 
        "database", 
        collection_name,
        details={"deleted_count": result.deleted_count}
    )
    
    return {"message": f"Cleared {result.deleted_count} documents from {collection_name}"}

# Get all locations
@api_router.get("/dev/locations")
async def get_locations(
    type: Optional[LocationType] = None,
    parent_id: Optional[str] = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    query = {}
    if type:
        query["type"] = type.value
    if parent_id:
        query["parent_id"] = parent_id
    
    locations = await db.locations.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return locations

# Create a location
@api_router.post("/dev/locations")
async def create_location(
    location: LocationCreate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    location_dict = location.model_dump()
    location_dict["id"] = str(uuid.uuid4())
    location_dict["created_at"] = datetime.now(timezone.utc)
    
    # Check if slug already exists
    existing = await db.locations.find_one({"slug": location.slug, "type": location.type.value})
    if existing:
        raise HTTPException(status_code=400, detail="Location with this slug already exists")
    
    await db.locations.insert_one(location_dict)
    del location_dict["_id"]
    return location_dict

# Bulk create locations (for CSV import)
@api_router.post("/dev/locations/bulk")
async def bulk_create_locations(
    locations: List[LocationCreate],
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    created = []
    errors = []
    
    for loc in locations:
        try:
            loc_dict = loc.model_dump()
            loc_dict["id"] = str(uuid.uuid4())
            loc_dict["created_at"] = datetime.now(timezone.utc)
            
            existing = await db.locations.find_one({"slug": loc.slug, "type": loc.type.value})
            if existing:
                errors.append({"slug": loc.slug, "error": "Already exists"})
                continue
            
            await db.locations.insert_one(loc_dict)
            del loc_dict["_id"]
            created.append(loc_dict)
        except Exception as e:
            errors.append({"slug": loc.slug, "error": str(e)})
    
    return {"created": len(created), "errors": errors, "locations": created}

# Delete a location
@api_router.delete("/dev/locations/{location_id}")
async def delete_location(
    location_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    result = await db.locations.delete_one({"id": location_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted"}

# Category icon and color mapping for product display
CATEGORY_DISPLAY_CONFIG = {
    "Pain Management / Therapeutic": {"icon": "zap", "gradient": "from-purple-500 to-purple-600", "subtitle": "TENS units, therapy devices"},
    "Mobility": {"icon": "accessibility", "gradient": "from-blue-500 to-blue-600", "subtitle": "Wheelchairs, walkers, scooters"},
    "Lifts / Transfer Equipment": {"icon": "arrow-up-down", "gradient": "from-green-500 to-emerald-600", "subtitle": "Patient lifts, transfer aids"},
    "Orthopedic / Orthotics": {"icon": "bone", "gradient": "from-lime-500 to-lime-600", "subtitle": "Braces for back, knee, ankle, wrist"},
    "Respiratory / Oxygen": {"icon": "wind", "gradient": "from-sky-500 to-sky-600", "subtitle": "CPAP, oxygen concentrators"},
    "Hospital Beds / Bedroom": {"icon": "bed", "gradient": "from-rose-500 to-rose-600", "subtitle": "Hospital beds, mattresses"},
    "Urology / Ostomy / Clinical": {"icon": "droplets", "gradient": "from-teal-500 to-teal-600", "subtitle": "Catheters, ostomy supplies"},
    "Enteral Nutrition": {"icon": "utensils", "gradient": "from-pink-500 to-pink-600", "subtitle": "Feeding tubes, pumps, formulas"},
    "Compression / Wound Care": {"icon": "activity", "gradient": "from-indigo-500 to-indigo-600", "subtitle": "Compression therapy, wound supplies"},
    "Diabetes Supplies": {"icon": "heart-pulse", "gradient": "from-red-500 to-red-600", "subtitle": "Glucose monitors, insulin supplies"},
    "Bath Safety": {"icon": "bath", "gradient": "from-cyan-500 to-cyan-600", "subtitle": "Shower chairs, grab bars, commodes"},
}

def generate_products_section_html(categories: list, products: list, location_name: str) -> str:
    """Generate the products section HTML from database categories and products"""
    
    # Group products by category
    products_by_category = {}
    for product in products:
        if not product.get("enabled", True):
            continue
        cat_id = product.get("category_id")
        if cat_id not in products_by_category:
            products_by_category[cat_id] = []
        products_by_category[cat_id].append(product)
    
    # Build category cards HTML
    category_cards = []
    for category in sorted(categories, key=lambda x: x.get("sort_order", 999)):
        if not category.get("enabled", True):
            continue
        
        cat_id = category.get("id")
        cat_name = category.get("name", "Unknown")
        cat_products = products_by_category.get(cat_id, [])
        
        if not cat_products:
            continue
        
        # Get display config or use defaults
        config = CATEGORY_DISPLAY_CONFIG.get(cat_name, {
            "icon": "package",
            "gradient": "from-gray-500 to-gray-600",
            "subtitle": "Medical equipment"
        })
        
        # Build product items HTML
        product_items = []
        for product in sorted(cat_products, key=lambda x: x.get("sort_order", 999)):
            product_name = product.get("name", "")
            product_desc = product.get("short_description", "Medicare-covered medical equipment")
            product_items.append(
                f'<div class="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-lime-50 hover:border-lime-200 border border-transparent transition-colors product-item" data-product="{product_name}" data-category="{cat_name}">'
                f'<p class="font-medium text-gray-800 text-sm">{product_name}</p>'
                f'<p class="text-xs text-gray-500 mt-1">{product_desc}</p>'
                f'</div>'
            )
        
        products_html = "".join(product_items)
        
        category_card = (
            f'<div class="border border-gray-200 rounded-2xl overflow-hidden">'
            f'<button class="product-toggle w-full p-6 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors">'
            f'<div class="flex items-center gap-4">'
            f'<div class="w-12 h-12 bg-gradient-to-br {config["gradient"]} rounded-xl flex items-center justify-center">'
            f'<i data-lucide="{config["icon"]}" class="w-6 h-6 text-white"></i>'
            f'</div>'
            f'<div class="text-left">'
            f'<h3 class="font-semibold text-gray-900">{cat_name}</h3>'
            f'<p class="text-sm text-gray-500">{config["subtitle"]}</p>'
            f'</div>'
            f'</div>'
            f'<i data-lucide="chevron-down" class="w-5 h-5 text-gray-400 transition-transform product-chevron"></i>'
            f'</button>'
            f'<div class="product-content hidden px-6 pb-6">'
            f'<div class="space-y-3 pt-2 border-t border-gray-100">'
            f'{products_html}'
            f'</div>'
            f'</div>'
            f'</div>'
        )
        category_cards.append(category_card)
    
    categories_html = "\n".join(category_cards)
    
    return (
        f'<section id="products" class="py-16 bg-white">'
        f'<div class="max-w-7xl mx-auto px-4">'
        f'<div class="text-center mb-12">'
        f'<span class="inline-block px-4 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium mb-4">Medical Equipment</span>'
        f'<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Medicare-Covered Durable Medical Equipment</h2>'
        f'<p class="text-gray-600 max-w-2xl mx-auto">We provide a wide range of Medicare-covered medical equipment in {location_name}. Click any category below to see available products.</p>'
        f'</div>'
        f'<div class="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">'
        f'{categories_html}'
        f'</div>'
        f'</div>'
        f'</section>'
    )


# List all generated pages
@api_router.get("/dev/generated-pages")
async def list_generated_pages(
    current_user: dict = Depends(require_roles(UserRole.ADMIN)),
    skip: int = 0,
    limit: int = 100
):
    """List all generated pages from the database - excludes html_content for performance"""
    # Exclude html_content to prevent massive response sizes
    pages_cursor = db.generated_pages.find({}, {"_id": 0, "html_content": 0}).skip(skip).limit(limit)
    pages = await pages_cursor.to_list(limit)
    total = await db.generated_pages.count_documents({})
    return {
        "pages": pages,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# Delete a generated page
@api_router.delete("/dev/generated-pages/{page_id}")
async def delete_generated_page(
    page_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    result = await db.generated_pages.delete_one({"id": page_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Page deleted"}


# Bulk delete generated pages by state
@api_router.delete("/dev/generated-pages/bulk/state/{state_slug}")
async def bulk_delete_state_pages(
    state_slug: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete all generated pages for a specific state from the database"""
    
    # Delete from database - match by parent_state OR by location_slug for the state itself
    db_delete_result = await db.generated_pages.delete_many({
        "$or": [
            {"parent_state": state_slug},
            {"location_slug": state_slug}
        ]
    })
    
    deleted_count = db_delete_result.deleted_count
    
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"No pages found for state: {state_slug}")
    
    # Also try to delete any physical files if they exist (legacy support)
    deleted_files = []
    try:
        locations_dir = Path("/app/frontend/public/locations")
        if locations_dir.exists():
            state_pattern = f"*-{state_slug}.html"
            for file_path in locations_dir.glob(state_pattern):
                try:
                    file_path.unlink()
                    deleted_files.append(file_path.name)
                except:
                    pass
    except:
        pass
    
    # Log the action
    await db.system_audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "bulk_delete_state_pages",
        "entity_type": "generated_pages",
        "entity_id": state_slug,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "details": {
            "state_slug": state_slug,
            "db_records_deleted": deleted_count,
            "files_deleted": len(deleted_files)
        },
        "ip_address": "system",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Successfully deleted {deleted_count} pages for {state_slug}",
        "deleted_count": deleted_count,
        "files_deleted": len(deleted_files)
    }


# ==================== AI TEMPLATE EDITOR ====================

# Pydantic models for AI Template Editor
class AITemplateRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    current_template: Optional[str] = None

class AITemplateCommand(BaseModel):
    command: str
    parameters: Optional[dict] = None

# Store for template editor sessions
template_editor_sessions = {}

@api_router.post("/dev/template-editor/chat")
async def ai_template_chat(
    request: AITemplateRequest,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """AI-powered template editor chat endpoint using GPT-5.2"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    session_id = request.session_id or str(uuid.uuid4())
    
    # Get or create session
    if session_id not in template_editor_sessions:
        template_editor_sessions[session_id] = {
            "messages": [],
            "template_changes": []
        }
    
    session = template_editor_sessions[session_id]
    
    # Build context with current template
    system_message = """You are an expert web designer and HTML/CSS developer helping to customize DME (Durable Medical Equipment) location page templates.

Your capabilities:
1. Modify HTML structure and CSS styling
2. Change colors, fonts, spacing, and layouts
3. Add or remove sections
4. Improve UX and conversion optimization
5. Make the template mobile-responsive

When the user asks for changes, provide:
1. A clear explanation of what you'll change
2. The specific HTML/CSS code changes in a code block
3. Any recommendations for improvement

Current template sections:
- Hero section with stats box
- "Why Choose Us" features section
- Coverage area with location cards
- About section
- CTA section ("Ready to Get Your Medicare-Covered Equipment")
- Contact form
- Footer
- Eligibility modal popup

The template uses:
- Tailwind CSS for styling
- Lucide icons
- Inter font family
- Amber/orange as primary colors
- Slate/gray for dark sections

When providing code changes, format them as:
```html
<!-- SECTION: section_name -->
<your html code here>
<!-- END SECTION -->
```

For CSS-only changes:
```css
/* STYLE: description */
.class-name { property: value; }
```

Always be specific about which section to modify."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"template-editor-{session_id}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        # Add context about current template if provided
        user_text = request.message
        if request.current_template and len(session["messages"]) == 0:
            user_text = f"Here's the current template structure I'm working with:\n\n{request.current_template[:2000]}...\n\nUser request: {request.message}"
        
        # Replay previous messages for context
        for msg in session["messages"]:
            if msg["role"] == "user":
                await chat.send_message(UserMessage(text=msg["content"]))
        
        # Send current message
        user_message = UserMessage(text=user_text)
        response = await chat.send_message(user_message)
        
        # Store messages
        session["messages"].append({"role": "user", "content": request.message})
        session["messages"].append({"role": "assistant", "content": response})
        
        # Parse any code blocks from response
        code_blocks = []
        import re
        html_matches = re.findall(r'```html\n(.*?)```', response, re.DOTALL)
        css_matches = re.findall(r'```css\n(.*?)```', response, re.DOTALL)
        
        for html in html_matches:
            code_blocks.append({"type": "html", "code": html.strip()})
        for css in css_matches:
            code_blocks.append({"type": "css", "code": css.strip()})
        
        return {
            "session_id": session_id,
            "response": response,
            "code_blocks": code_blocks,
            "message_count": len(session["messages"])
        }
        
    except Exception as e:
        logger.error(f"AI Template Editor error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@api_router.get("/dev/template-editor/commands")
async def get_template_commands(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get available quick commands for the template editor"""
    return {
        "commands": [
            {
                "id": "change-colors",
                "name": "Change Color Scheme",
                "description": "Modify the primary and accent colors",
                "icon": "palette",
                "prompts": [
                    "Change primary color to blue",
                    "Make the color scheme more professional",
                    "Use a green and white color palette"
                ]
            },
            {
                "id": "modify-hero",
                "name": "Modify Hero Section",
                "description": "Customize the main hero banner",
                "icon": "layout",
                "prompts": [
                    "Make the hero section taller",
                    "Add a background pattern to the hero",
                    "Change the hero headline style"
                ]
            },
            {
                "id": "edit-cards",
                "name": "Edit Location Cards",
                "description": "Customize county/city card design",
                "icon": "grid",
                "prompts": [
                    "Make the location cards larger",
                    "Add hover animations to cards",
                    "Change card layout to 2 columns"
                ]
            },
            {
                "id": "update-cta",
                "name": "Update CTA Section",
                "description": "Modify call-to-action buttons and text",
                "icon": "mouse-pointer-click",
                "prompts": [
                    "Make CTA buttons more prominent",
                    "Add urgency to the CTA text",
                    "Change CTA background gradient"
                ]
            },
            {
                "id": "improve-modal",
                "name": "Improve Modal Design",
                "description": "Customize the eligibility modal popup",
                "icon": "square",
                "prompts": [
                    "Make the modal more modern",
                    "Add progress indicator to modal steps",
                    "Improve modal animation"
                ]
            },
            {
                "id": "add-section",
                "name": "Add New Section",
                "description": "Add a new section to the template",
                "icon": "plus-square",
                "prompts": [
                    "Add a testimonials section",
                    "Add an FAQ section",
                    "Add a product showcase section"
                ]
            },
            {
                "id": "mobile-optimize",
                "name": "Mobile Optimization",
                "description": "Improve mobile responsiveness",
                "icon": "smartphone",
                "prompts": [
                    "Optimize for mobile devices",
                    "Fix mobile navigation",
                    "Improve mobile card layout"
                ]
            },
            {
                "id": "seo-improve",
                "name": "SEO Improvements",
                "description": "Enhance SEO elements",
                "icon": "search",
                "prompts": [
                    "Add schema markup for local business",
                    "Improve heading structure for SEO",
                    "Add more semantic HTML elements"
                ]
            }
        ]
    }


@api_router.post("/dev/template-editor/apply")
async def apply_template_changes(
    request: dict,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Apply AI-suggested changes to the template"""
    changes = request.get("changes", [])
    section = request.get("section", "")
    
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")
    
    # Store the changes for manual review/application
    change_record = {
        "id": str(uuid.uuid4()),
        "section": section,
        "changes": changes,
        "applied_by": current_user["email"],
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    await db.template_changes.insert_one(change_record)
    
    return {
        "message": "Changes recorded for review",
        "change_id": change_record["id"],
        "status": "pending",
        "note": "Changes need to be manually applied to the template in server.py"
    }


@api_router.delete("/dev/template-editor/session/{session_id}")
async def clear_template_session(
    session_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Clear a template editor session"""
    if session_id in template_editor_sessions:
        del template_editor_sessions[session_id]
        return {"message": "Session cleared", "session_id": session_id}
    return {"message": "Session not found", "session_id": session_id}


# Get generated pages by state
@api_router.get("/dev/generated-pages/by-state/{state_slug}")
async def get_generated_pages_by_state(
    state_slug: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get all generated pages for a specific state from file system"""
    
    locations_dir = Path("/app/frontend/public/locations")
    state_pattern = f"*-{state_slug}.html"
    
    matching_files = list(locations_dir.glob(state_pattern))
    
    pages = []
    for file_path in matching_files:
        stat = file_path.stat()
        pages.append({
            "filename": file_path.name,
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    
    return {
        "state_slug": state_slug,
        "count": len(pages),
        "pages": sorted(pages, key=lambda x: x["filename"])
    }


# Delete ALL generated pages (nuclear option)
@api_router.delete("/dev/generated-pages/bulk/all")
async def bulk_delete_all_pages(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete ALL generated location pages - use with caution!"""
    
    locations_dir = Path("/app/frontend/public/locations")
    deleted_files = []
    errors = []
    
    # Find and delete all HTML files in the locations directory
    html_files = list(locations_dir.glob("*.html"))
    
    for file_path in html_files:
        try:
            filename = file_path.name
            file_path.unlink()
            deleted_files.append(filename)
        except Exception as e:
            errors.append({"file": str(file_path), "error": str(e)})
    
    # Clear the locations-data.json
    locations_data_path = Path("/app/frontend/public/locations-data.json")
    if locations_data_path.exists():
        try:
            with open(locations_data_path, "w") as f:
                json.dump([], f)
        except Exception as e:
            errors.append({"file": "locations-data.json", "error": str(e)})
    
    # Clear from database
    db_delete_result = await db.generated_pages.delete_many({})
    
    # Log the action
    await db.system_audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "bulk_delete_all_pages",
        "entity_type": "generated_pages",
        "entity_id": "all",
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "details": {
            "files_deleted": len(deleted_files),
            "db_records_deleted": db_delete_result.deleted_count,
            "errors": errors
        },
        "ip_address": "system",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Successfully deleted {len(deleted_files)} pages",
        "files_deleted": len(deleted_files),
        "db_records_deleted": db_delete_result.deleted_count,
        "errors": errors if errors else None
    }


# ==================== ONE-CLICK STATE GENERATION ====================

# Get list of available US states for generation
@api_router.get("/dev/us-states")
async def get_us_states(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get list of all US states available for page generation"""
    us_data = load_us_locations()
    
    if not us_data:
        return []
    
    states = []
    for slug, data in us_data.items():
        states.append({
            "slug": slug,
            "name": data["name"],
            "abbr": data.get("abbreviation", data.get("abbr", "")),
            "county_count": len(data.get("counties", [])),
            "city_count": len(data.get("cities", [])),
            "total_pages": 1 + len(data.get("counties", [])) + len(data.get("cities", []))
        })
    
    return sorted(states, key=lambda x: x["name"])


# Preview sample location page template (public for preview)
@api_router.get("/dev/preview-location-template", response_class=HTMLResponse)
async def preview_location_template():
    """Generate a preview of the location page template using sample data"""
    import sys
    import importlib
    
    # Load template
    sys.path.insert(0, '/app/backend/templates')
    import location_page
    importlib.reload(location_page)
    from location_page import generate_full_location_page_html
    
    # Override SITE_DOMAIN from database settings if configured
    site_settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
    if site_settings and site_settings.get("site_domain"):
        location_page.SITE_DOMAIN = normalize_public_site_url(site_settings["site_domain"])
    
    # Sample data for preview
    sample_counties = ["Sample County", "Example County", "Demo County", "Test County", "Preview County"]
    sample_cities = ["Sample City", "Example Town", "Demo Village", "Test Borough", "Preview Township", 
                     "North Sample", "South Example", "East Demo", "West Test", "Central Preview"]
    
    # Generate sample state page
    html = generate_full_location_page_html(
        loc_name="Sample State",
        loc_type="state",
        state_name="Sample State",
        state_slug="sample-state",
        county_count=len(sample_counties),
        city_count=len(sample_cities),
        counties=sample_counties,
        cities=sample_cities,
        products_html=""
    )
    
    return HTMLResponse(content=html)


# Generate all pages for a state (state + counties + cities)
@api_router.post("/dev/generate-state/{state_slug}")
async def generate_state_pages(
    state_slug: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """
    Generate all location pages for a state.
    Writes actual HTML files to /app/frontend/public/locations/ for direct serving.
    """
    us_data = load_us_locations()
    
    if not us_data:
        raise HTTPException(status_code=500, detail="US locations data not found")
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    state_data = us_data[state_slug]
    state_name = state_data["name"]
    counties = state_data.get("counties", [])
    cities = state_data.get("cities", [])
    
    generated_count = 0
    error_count = 0
    
    # Create output directory
    output_dir = Path("/app/frontend/public/locations")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    def slugify(text):
        return text.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")
    
    # Import template generator - always reload to pick up latest changes
    import sys
    import importlib
    sys.path.insert(0, '/app/backend/templates')
    import location_page
    importlib.reload(location_page)
    from location_page import generate_full_location_page_html
    
    # Override SITE_DOMAIN from database settings if configured
    site_settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
    if site_settings and site_settings.get("site_domain"):
        location_page.SITE_DOMAIN = normalize_public_site_url(site_settings["site_domain"])
    
    # Build styled products HTML for all generated pages
    db_categories = await db.product_categories.find({"enabled": True}, {"_id": 0}).to_list(100)
    db_products = await db.products.find({"enabled": True}, {"_id": 0}).to_list(500)
    products_html = ""
    if db_categories and db_products:
        products_html = generate_products_section_html(db_categories, db_products, state_name)
        # Extract just the inner grid content (strip the outer section wrapper since template adds its own)
        import re
        grid_match = re.search(r'<div class="grid md:grid-cols-2.*?</div>\s*</div>\s*</div>\s*</section>', products_html, re.DOTALL)
        if grid_match:
            # Get from grid start to before the closing section tags  
            inner = re.search(r'(<div class="grid md:grid-cols-2[^>]*>.*)</div>\s*</div>\s*</section>', products_html, re.DOTALL)
            if inner:
                products_html = inner.group(1) + '</div>'
            else:
                products_html = ""
    
    # Generate state page
    try:
        state_filename = f"durable-medical-equipment-in-{state_slug}.html"
        html = generate_full_location_page_html(
            loc_name=state_name,
            loc_type="state",
            state_name=state_name,
            state_slug=state_slug,
            county_count=len(counties),
            city_count=len(cities),
            counties=counties,
            cities=cities,
            products_html=products_html
        )
        
        # Write HTML file
        with open(output_dir / state_filename, 'w') as f:
            f.write(html)
        
        # Save metadata to database
        await db.generated_pages.update_one(
            {"location_slug": state_slug},
            {"$set": {
                "id": str(uuid.uuid4()),
                "location_name": state_name,
                "location_slug": state_slug,
                "location_type": "state",
                "parent_state": state_slug,
                "filename": state_filename,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "generated_by": current_user["id"]
            }},
            upsert=True
        )
        generated_count += 1
        logger.info(f"Generated state page: {state_filename}")
    except Exception as e:
        error_count += 1
        logger.error(f"Error generating state page: {e}")
    
    # Generate county pages
    for county in counties:
        try:
            county_slug = slugify(county)
            full_slug = f"{county_slug}-{state_slug}"
            filename = f"durable-medical-equipment-in-{full_slug}.html"
            
            # Get cities for this county (for internal linking)
            # For simplicity, distribute cities across counties evenly
            county_idx = counties.index(county)
            cities_per_county = max(1, len(cities) // max(1, len(counties)))
            county_cities = cities[county_idx * cities_per_county:(county_idx + 1) * cities_per_county]
            
            html = generate_full_location_page_html(
                loc_name=county,
                loc_type="county",
                state_name=state_name,
                state_slug=state_slug,
                county_name=county,
                county_slug=full_slug,
                county_count=len(counties),
                city_count=len(county_cities),
                counties=[],
                cities=county_cities,
                sibling_cities=[],
                products_html=products_html
            )
            
            with open(output_dir / filename, 'w') as f:
                f.write(html)
            
            await db.generated_pages.update_one(
                {"location_slug": full_slug},
                {"$set": {
                    "id": str(uuid.uuid4()),
                    "location_name": county,
                    "location_slug": full_slug,
                    "location_type": "county",
                    "parent_state": state_slug,
                    "county_cities": county_cities,
                    "filename": filename,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "generated_by": current_user["id"]
                }},
                upsert=True
            )
            generated_count += 1
        except Exception as e:
            error_count += 1
            logger.error(f"Error generating county page for {county}: {e}")
    
    # Build county-to-cities mapping for sibling linking
    county_cities_map = {}
    for i, county in enumerate(counties):
        cities_per_county = max(1, len(cities) // max(1, len(counties)))
        county_cities_map[county] = cities[i * cities_per_county:(i + 1) * cities_per_county]
    
    # Generate city pages with sibling linking
    for city in cities:
        try:
            city_slug = slugify(city)
            full_slug = f"{city_slug}-{state_slug}"
            filename = f"durable-medical-equipment-in-{full_slug}.html"
            
            # Find which county this city belongs to for sibling linking
            parent_county = None
            parent_county_slug = ""
            sibling_cities = []
            for county, county_cities in county_cities_map.items():
                if city in county_cities:
                    parent_county = county
                    parent_county_slug = f"{slugify(county)}-{state_slug}"
                    sibling_cities = [c for c in county_cities if c != city]
                    break
            
            html = generate_full_location_page_html(
                loc_name=city,
                loc_type="city",
                state_name=state_name,
                state_slug=state_slug,
                county_name=parent_county or "",
                county_slug=parent_county_slug,
                county_count=len(counties),
                city_count=len(cities),
                counties=[],
                cities=[],
                sibling_cities=sibling_cities,
                products_html=products_html
            )
            
            with open(output_dir / filename, 'w') as f:
                f.write(html)
            
            await db.generated_pages.update_one(
                {"location_slug": full_slug},
                {"$set": {
                    "id": str(uuid.uuid4()),
                    "location_name": city,
                    "location_slug": full_slug,
                    "location_type": "city",
                    "parent_state": state_slug,
                    "parent_county": parent_county,
                    "sibling_cities": sibling_cities,
                    "filename": filename,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "generated_by": current_user["id"]
                }},
                upsert=True
            )
            generated_count += 1
        except Exception as e:
            error_count += 1
            logger.error(f"Error generating city page for {city}: {e}")
    
    return {
        "state": state_name,
        "generated": generated_count,
        "errors": error_count,
        "details": {
            "state_page": 1,
            "county_pages": len(counties),
            "city_pages": len(cities)
        },
        "message": f"Generated {generated_count} HTML files in /locations/"
    }

# ==================== LOCATION DATA MANAGEMENT ====================

def get_us_locations_path():
    """Get path to US locations JSON file"""
    return os.path.join(os.path.dirname(__file__), 'us_locations_data.json')

def load_us_locations():
    """Load US locations data from JSON file"""
    try:
        with open(get_us_locations_path(), 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_us_locations(data):
    """Save US locations data to JSON file"""
    with open(get_us_locations_path(), 'w') as f:
        json.dump(data, f, indent=2)

def slugify_location(text):
    """Convert text to URL-friendly slug"""
    return text.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")

# US State abbreviations for validation
US_STATE_ABBRS = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
    "montana": "MT", "nebraska": "NE", "nevada": "NV", "new-hampshire": "NH", "new-jersey": "NJ",
    "new-mexico": "NM", "new-york": "NY", "north-carolina": "NC", "north-dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode-island": "RI", "south-carolina": "SC",
    "south-dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west-virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district-of-columbia": "DC", "puerto-rico": "PR"
}

class StateCreate(BaseModel):
    name: str
    abbr: str

class LocationAdd(BaseModel):
    name: str

class LocationImport(BaseModel):
    state_slug: str
    counties: List[str] = []
    cities: List[str] = []

# Export all states as CSV (MUST be defined before parameterized routes)
@api_router.get("/dev/location-data/export-all")
async def export_all_locations(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Export all states, counties, and cities as CSV"""
    us_data = load_us_locations()
    
    # Build CSV content
    csv_lines = ["state,state_abbr,type,name"]
    
    for slug, state in sorted(us_data.items(), key=lambda x: x[1]["name"]):
        state_name = state["name"]
        state_abbr = state["abbr"]
        
        for county in state.get("counties", []):
            csv_lines.append(f"{state_name},{state_abbr},county,{county}")
        
        for city in state.get("cities", []):
            csv_lines.append(f"{state_name},{state_abbr},city,{city}")
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=all_locations.csv"
        }
    )

# Export single state location data as CSV
@api_router.get("/dev/location-data/export/{state_slug}")
async def export_state_locations(
    state_slug: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Export a state's counties and cities as CSV"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    state = us_data[state_slug]
    
    # Build CSV content
    csv_lines = ["type,name"]
    
    for county in state.get("counties", []):
        csv_lines.append(f"county,{county}")
    
    for city in state.get("cities", []):
        csv_lines.append(f"city,{city}")
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={state_slug}_locations.csv"
        }
    )

# Get full location data for a state
@api_router.get("/dev/location-data/{state_slug}")
async def get_state_location_data(
    state_slug: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get all counties and cities for a state"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    state = us_data[state_slug]
    return {
        "slug": state_slug,
        "name": state["name"],
        "abbr": state["abbr"],
        "counties": state.get("counties", []),
        "cities": state.get("cities", [])
    }

# Add a new state
@api_router.post("/dev/location-data/state")
async def add_state(
    state: StateCreate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Add a new state to the location database"""
    us_data = load_us_locations()
    
    slug = slugify_location(state.name)
    
    if slug in us_data:
        raise HTTPException(status_code=400, detail=f"State '{state.name}' already exists")
    
    us_data[slug] = {
        "name": state.name,
        "abbr": state.abbr.upper(),
        "counties": [],
        "cities": []
    }
    
    save_us_locations(us_data)
    
    return {"message": f"State '{state.name}' added successfully", "slug": slug}

# Delete a state
@api_router.delete("/dev/location-data/state/{state_slug}")
async def delete_state(
    state_slug: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a state and all its counties/cities"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    state_name = us_data[state_slug]["name"]
    del us_data[state_slug]
    save_us_locations(us_data)
    
    return {"message": f"State '{state_name}' deleted successfully"}

# Add county to state
@api_router.post("/dev/location-data/state/{state_slug}/county")
async def add_county(
    state_slug: str,
    county: LocationAdd,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Add a county to a state"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    counties = us_data[state_slug].get("counties", [])
    
    # Check for duplicates (case-insensitive)
    if any(c.lower() == county.name.lower() for c in counties):
        raise HTTPException(status_code=400, detail=f"County '{county.name}' already exists in this state")
    
    counties.append(county.name)
    counties.sort()
    us_data[state_slug]["counties"] = counties
    
    save_us_locations(us_data)
    
    return {"message": f"County '{county.name}' added to {us_data[state_slug]['name']}", "total_counties": len(counties)}

# Add city to state
@api_router.post("/dev/location-data/state/{state_slug}/city")
async def add_city(
    state_slug: str,
    city: LocationAdd,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Add a city to a state"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    cities = us_data[state_slug].get("cities", [])
    
    # Check for duplicates (case-insensitive)
    if any(c.lower() == city.name.lower() for c in cities):
        raise HTTPException(status_code=400, detail=f"City '{city.name}' already exists in this state")
    
    cities.append(city.name)
    cities.sort()
    us_data[state_slug]["cities"] = cities
    
    save_us_locations(us_data)
    
    return {"message": f"City '{city.name}' added to {us_data[state_slug]['name']}", "total_cities": len(cities)}

# Delete county from state
@api_router.delete("/dev/location-data/state/{state_slug}/county/{county_name}")
async def delete_county(
    state_slug: str,
    county_name: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a county from a state"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    counties = us_data[state_slug].get("counties", [])
    
    # Find and remove (case-insensitive match)
    county_name_decoded = county_name.replace("%20", " ").replace("+", " ")
    original_count = len(counties)
    counties = [c for c in counties if c.lower() != county_name_decoded.lower()]
    
    if len(counties) == original_count:
        raise HTTPException(status_code=404, detail=f"County '{county_name_decoded}' not found")
    
    us_data[state_slug]["counties"] = counties
    save_us_locations(us_data)
    
    return {"message": f"County '{county_name_decoded}' deleted", "total_counties": len(counties)}

# Delete city from state
@api_router.delete("/dev/location-data/state/{state_slug}/city/{city_name}")
async def delete_city(
    state_slug: str,
    city_name: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a city from a state"""
    us_data = load_us_locations()
    
    if state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
    
    cities = us_data[state_slug].get("cities", [])
    
    # Find and remove (case-insensitive match)
    city_name_decoded = city_name.replace("%20", " ").replace("+", " ")
    original_count = len(cities)
    cities = [c for c in cities if c.lower() != city_name_decoded.lower()]
    
    if len(cities) == original_count:
        raise HTTPException(status_code=404, detail=f"City '{city_name_decoded}' not found")
    
    us_data[state_slug]["cities"] = cities
    save_us_locations(us_data)
    
    return {"message": f"City '{city_name_decoded}' deleted", "total_cities": len(cities)}

# Bulk import counties and cities for a state
@api_router.post("/dev/location-data/import")
async def import_locations(
    data: LocationImport,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Bulk import counties and cities for a state"""
    us_data = load_us_locations()
    
    if data.state_slug not in us_data:
        raise HTTPException(status_code=404, detail=f"State '{data.state_slug}' not found")
    
    state = us_data[data.state_slug]
    
    # Get existing data
    existing_counties = set(c.lower() for c in state.get("counties", []))
    existing_cities = set(c.lower() for c in state.get("cities", []))
    
    # Add new counties (skip duplicates)
    added_counties = 0
    for county in data.counties:
        county = county.strip()
        if county and county.lower() not in existing_counties:
            state.setdefault("counties", []).append(county)
            existing_counties.add(county.lower())
            added_counties += 1
    
    # Add new cities (skip duplicates)
    added_cities = 0
    for city in data.cities:
        city = city.strip()
        if city and city.lower() not in existing_cities:
            state.setdefault("cities", []).append(city)
            existing_cities.add(city.lower())
            added_cities += 1
    
    # Sort alphabetically
    state["counties"] = sorted(state.get("counties", []))
    state["cities"] = sorted(state.get("cities", []))
    
    save_us_locations(us_data)
    
    return {
        "message": f"Import complete for {state['name']}",
        "added_counties": added_counties,
        "added_cities": added_cities,
        "total_counties": len(state["counties"]),
        "total_cities": len(state["cities"]),
        "skipped_duplicates": (len(data.counties) - added_counties) + (len(data.cities) - added_cities)
    }

# Import from CSV file content
@api_router.post("/dev/location-data/import-csv")
async def import_csv_locations(
    request: Request,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Import locations from CSV content. Expected format: type,name (for single state) or state,state_abbr,type,name (for all)"""
    body = await request.json()
    csv_content = body.get("csv_content", "")
    state_slug = body.get("state_slug")  # Optional - if provided, import to this state
    
    if not csv_content:
        raise HTTPException(status_code=400, detail="CSV content is required")
    
    us_data = load_us_locations()
    lines = csv_content.strip().split("\n")
    
    if len(lines) < 2:
        raise HTTPException(status_code=400, detail="CSV must have header and at least one data row")
    
    header = lines[0].lower().strip()
    results = {"added_counties": 0, "added_cities": 0, "added_states": 0, "errors": []}
    
    # Detect format based on header
    if header == "type,name" and state_slug:
        # Single state format
        if state_slug not in us_data:
            raise HTTPException(status_code=404, detail=f"State '{state_slug}' not found")
        
        state = us_data[state_slug]
        existing_counties = set(c.lower() for c in state.get("counties", []))
        existing_cities = set(c.lower() for c in state.get("cities", []))
        
        for i, line in enumerate(lines[1:], start=2):
            parts = line.strip().split(",", 1)
            if len(parts) != 2:
                results["errors"].append(f"Line {i}: Invalid format")
                continue
            
            loc_type, name = parts[0].strip().lower(), parts[1].strip()
            
            if loc_type == "county":
                if name.lower() not in existing_counties:
                    state.setdefault("counties", []).append(name)
                    existing_counties.add(name.lower())
                    results["added_counties"] += 1
            elif loc_type == "city":
                if name.lower() not in existing_cities:
                    state.setdefault("cities", []).append(name)
                    existing_cities.add(name.lower())
                    results["added_cities"] += 1
            else:
                results["errors"].append(f"Line {i}: Invalid type '{loc_type}' (must be 'county' or 'city')")
        
        state["counties"] = sorted(state.get("counties", []))
        state["cities"] = sorted(state.get("cities", []))
        
    elif header == "state,state_abbr,type,name":
        # Multi-state format
        for i, line in enumerate(lines[1:], start=2):
            parts = line.strip().split(",", 3)
            if len(parts) != 4:
                results["errors"].append(f"Line {i}: Invalid format")
                continue
            
            state_name, state_abbr, loc_type, name = [p.strip() for p in parts]
            slug = slugify_location(state_name)
            
            # Create state if it doesn't exist
            if slug not in us_data:
                us_data[slug] = {
                    "name": state_name,
                    "abbr": state_abbr.upper(),
                    "counties": [],
                    "cities": []
                }
                results["added_states"] += 1
            
            state = us_data[slug]
            loc_type = loc_type.lower()
            
            if loc_type == "county":
                existing = set(c.lower() for c in state.get("counties", []))
                if name.lower() not in existing:
                    state.setdefault("counties", []).append(name)
                    results["added_counties"] += 1
            elif loc_type == "city":
                existing = set(c.lower() for c in state.get("cities", []))
                if name.lower() not in existing:
                    state.setdefault("cities", []).append(name)
                    results["added_cities"] += 1
        
        # Sort all states
        for slug in us_data:
            us_data[slug]["counties"] = sorted(us_data[slug].get("counties", []))
            us_data[slug]["cities"] = sorted(us_data[slug].get("cities", []))
    else:
        raise HTTPException(
            status_code=400, 
            detail="Invalid CSV header. Expected 'type,name' (single state) or 'state,state_abbr,type,name' (multi-state)"
        )
    
    save_us_locations(us_data)
    
    return {
        "message": "Import complete",
        **results,
        "total_errors": len(results["errors"])
    }


# Get page generator stats
@api_router.get("/dev/stats")
async def get_dev_stats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    # Count from generated_pages collection
    generated_pages = await db.generated_pages.count_documents({})
    states = await db.generated_pages.count_documents({"location_type": "state"})
    counties = await db.generated_pages.count_documents({"location_type": "county"})
    cities = await db.generated_pages.count_documents({"location_type": "city"})
    
    # If database is empty, count files on disk as fallback
    if generated_pages == 0:
        import glob
        locations_dir = "/app/frontend/public/locations"
        html_files = glob.glob(f"{locations_dir}/*.html")
        generated_pages = len(html_files)
        
        # Count by type from filename patterns
        states = len([f for f in html_files if f.count('-') <= 4 and '-county-' not in f and '-city-' not in f])
        counties = len([f for f in html_files if '-county-' in f])
        cities = generated_pages - states - counties
    
    total_categories = await db.product_categories.count_documents({})
    total_products = await db.products.count_documents({})
    enabled_categories = await db.product_categories.count_documents({"enabled": True})
    enabled_products = await db.products.count_documents({"enabled": True})
    
    return {
        "total_locations": generated_pages,
        "states": states,
        "counties": counties,
        "cities": cities,
        "generated_pages": generated_pages,
        "total_categories": total_categories,
        "total_products": total_products,
        "enabled_categories": enabled_categories,
        "enabled_products": enabled_products
    }


@api_router.get("/dev/generated-pages-grouped")
async def get_generated_pages_grouped(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """
    Get all generated pages grouped by state - replaces the static locations-data.json file.
    Returns data in the same format as the JSON file for frontend compatibility.
    Falls back to reading from disk if database is empty.
    """
    # Check if database has data
    db_count = await db.generated_pages.count_documents({})
    
    if db_count > 0:
        # Get all state pages from database
        states_cursor = db.generated_pages.find(
            {"location_type": "state"},
            {"_id": 0, "location_name": 1, "location_slug": 1, "filename": 1}
        )
        states = await states_cursor.to_list(100)
        
        result = []
        
        for state in states:
            state_slug = state.get("location_slug", "")
            state_name = state.get("location_name", "")
            state_file = state.get("filename", f"durable-medical-equipment-in-{state_slug}.html")
            
            # Get counties for this state
            counties_cursor = db.generated_pages.find(
                {"location_type": "county", "location_slug": {"$regex": f"-{state_slug}$"}},
                {"_id": 0, "location_name": 1, "location_slug": 1, "filename": 1}
            )
            counties = await counties_cursor.to_list(500)
            
            # Get cities for this state
            cities_cursor = db.generated_pages.find(
                {"location_type": "city", "location_slug": {"$regex": f"-{state_slug}$"}},
                {"_id": 0, "location_name": 1, "location_slug": 1, "filename": 1}
            )
            cities = await cities_cursor.to_list(2000)
            
            # Format counties
            formatted_counties = [
                {
                    "name": c.get("location_name", ""),
                    "slug": c.get("location_slug", ""),
                    "file": c.get("filename", f"durable-medical-equipment-in-{c.get('location_slug', '')}.html")
                }
                for c in counties
            ]
            
            # Format cities
            formatted_cities = [
                {
                    "name": c.get("location_name", ""),
                    "slug": c.get("location_slug", ""),
                    "file": c.get("filename", f"durable-medical-equipment-in-{c.get('location_slug', '')}.html")
                }
                for c in cities
            ]
            
            result.append({
                "name": state_name,
                "slug": state_slug,
                "file": state_file,
                "counties": formatted_counties,
                "cities": formatted_cities,
                "total_pages": 1 + len(formatted_counties) + len(formatted_cities)
            })
    else:
        # Fallback: Read from disk and locations-data.json if it exists
        import json
        result = []
        
        # Try to load from the static JSON file
        json_path = "/app/frontend/public/locations-data.json"
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                result = json.load(f)
        else:
            # Build from disk by scanning HTML files
            import glob
            from collections import defaultdict
            
            locations_dir = "/app/frontend/public/locations"
            html_files = glob.glob(f"{locations_dir}/*.html")
            
            # Group files by state (last part of filename before .html)
            state_data = defaultdict(lambda: {"counties": [], "cities": []})
            
            for filepath in html_files:
                filename = os.path.basename(filepath)
                # Parse filename: durable-medical-equipment-in-{location}-{state}.html
                parts = filename.replace("durable-medical-equipment-in-", "").replace(".html", "").split("-")
                if len(parts) >= 1:
                    state_slug = parts[-1]
                    location_slug = "-".join(parts)
                    
                    # Determine type
                    if "-county-" in filename:
                        state_data[state_slug]["counties"].append({
                            "name": " ".join(parts[:-1]).replace("-", " ").title(),
                            "slug": location_slug,
                            "file": filename
                        })
                    elif len(parts) == 1:
                        # State file
                        state_data[state_slug]["name"] = state_slug.replace("-", " ").title()
                        state_data[state_slug]["slug"] = state_slug
                        state_data[state_slug]["file"] = filename
                    else:
                        state_data[state_slug]["cities"].append({
                            "name": " ".join(parts[:-1]).replace("-", " ").title(),
                            "slug": location_slug,
                            "file": filename
                        })
            
            # Convert to list format
            for state_slug, data in state_data.items():
                if data.get("name"):
                    result.append({
                        "name": data["name"],
                        "slug": data["slug"],
                        "file": data.get("file", f"durable-medical-equipment-in-{state_slug}.html"),
                        "counties": data["counties"],
                        "cities": data["cities"],
                        "total_pages": 1 + len(data["counties"]) + len(data["cities"])
                    })
    
    # Sort by state name
    result.sort(key=lambda x: x.get("name", ""))
    
    return result


# ==================== PRODUCT CATALOG (Dev Settings) ====================

class ProductCategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None  # Lucide icon name
    color: Optional[str] = None  # Tailwind gradient class
    image_url: Optional[str] = None  # Category image URL
    enabled: bool = True
    sort_order: int = 0
    # SEO fields
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None

class ProductCreate(BaseModel):
    category_id: str
    name: str
    slug: str
    sku: Optional[str] = None  # Product number/SKU (e.g., DME-001)
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    features: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    image_url: Optional[str] = None  # Product image URL (stored in products folder)
    enabled: bool = True
    sort_order: int = 0
    # SEO fields
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    # Additional fields
    hcpcs_codes: Optional[List[str]] = None  # Medicare billing codes
    requires_prescription: bool = True
    coverage_info: Optional[str] = None

# Get all product categories
@api_router.get("/dev/product-categories")
async def get_product_categories(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    categories = await db.product_categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return categories

# Create product category
@api_router.post("/dev/product-categories")
async def create_product_category(
    category: ProductCategoryCreate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    category_dict = category.model_dump()
    category_dict["id"] = str(uuid.uuid4())
    category_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    category_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Check if slug exists
    existing = await db.product_categories.find_one({"slug": category.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Category with this slug already exists")
    
    await db.product_categories.insert_one(category_dict)
    del category_dict["_id"]
    return category_dict

# Update product category
@api_router.put("/dev/product-categories/{category_id}")
async def update_product_category(
    category_id: str,
    updates: dict,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.product_categories.update_one(
        {"id": category_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = await db.product_categories.find_one({"id": category_id}, {"_id": 0})
    return category

# Delete product category
@api_router.delete("/dev/product-categories/{category_id}")
async def delete_product_category(
    category_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    # Also delete all products in this category
    await db.products.delete_many({"category_id": category_id})
    result = await db.product_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category and its products deleted"}

# Get all products
@api_router.get("/dev/products")
async def get_products(
    category_id: Optional[str] = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    products = await db.products.find(query, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return products

# Create product
@api_router.post("/dev/products")
async def create_product(
    product: ProductCreate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    product_dict = product.model_dump()
    product_dict["id"] = str(uuid.uuid4())
    product_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    product_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Auto-generate SKU if not provided
    if not product_dict.get("sku"):
        # Get next SKU number
        last_product = await db.products.find_one(
            {"sku": {"$regex": "^DME-"}},
            sort=[("sku", -1)]
        )
        if last_product and last_product.get("sku"):
            try:
                last_num = int(last_product["sku"].split("-")[1])
                product_dict["sku"] = f"DME-{str(last_num + 1).zfill(4)}"
            except:
                product_dict["sku"] = "DME-0001"
        else:
            product_dict["sku"] = "DME-0001"
    
    # Verify category exists
    category = await db.product_categories.find_one({"id": product.category_id})
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    # Check if slug exists
    existing = await db.products.find_one({"slug": product.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Product with this slug already exists")
    
    await db.products.insert_one(product_dict)
    del product_dict["_id"]
    return product_dict

# Bulk create products (for AI generation)
@api_router.post("/dev/products/bulk")
async def bulk_create_products(
    products: List[ProductCreate],
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    created = []
    errors = []
    
    for prod in products:
        try:
            prod_dict = prod.model_dump()
            prod_dict["id"] = str(uuid.uuid4())
            prod_dict["created_at"] = datetime.now(timezone.utc).isoformat()
            prod_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            existing = await db.products.find_one({"slug": prod.slug})
            if existing:
                errors.append({"slug": prod.slug, "error": "Already exists"})
                continue
            
            await db.products.insert_one(prod_dict)
            del prod_dict["_id"]
            created.append(prod_dict)
        except Exception as e:
            errors.append({"slug": prod.slug, "error": str(e)})
    
    return {"created": len(created), "errors": errors, "products": created}

# Update product
@api_router.put("/dev/products/{product_id}")
async def update_product(
    product_id: str,
    updates: dict,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    return product

# Delete product
@api_router.delete("/dev/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# Upload product image
@api_router.post("/dev/products/{product_id}/image")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Upload product image to storage bucket"""
    # Verify product exists
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
    
    # Generate optimized filename based on product slug
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    optimized_filename = f"{product['slug']}.{ext}"
    storage_key = f"products/{optimized_filename}"
    
    # Read file content
    file_content = await file.read()
    
    # Upload to storage
    success, result = await StorageService.upload_file(
        file_content=file_content,
        file_key=storage_key,
        content_type=file.content_type
    )
    
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {result}")
    
    # Get the public URL
    image_url = result.get("url", f"/api/storage/download/{storage_key}")
    
    # Update product with image URL
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"image_url": image_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Image uploaded", "image_url": image_url}

# Search for product images from web
@api_router.post("/dev/products/{product_id}/search-images")
async def search_product_images(
    product_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Search web for product images based on product name/description"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Build search query - focus on generic DME/medical equipment images
    product_name = product.get("name", "")
    search_query = f"{product_name} medical equipment product photo white background"
    
    # Return search parameters for frontend to use with image search
    return {
        "product_id": product_id,
        "product_name": product_name,
        "search_query": search_query,
        "suggested_queries": [
            f"{product_name} DME equipment",
            f"{product_name} medical device",
            f"{product_name} healthcare product"
        ]
    }

# Bulk search images for all products without images
@api_router.post("/dev/products/bulk-search-images")
async def bulk_search_product_images(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get list of products needing images with search queries"""
    # Get products without images or with placeholder images
    products = await db.products.find(
        {"$or": [
            {"image_url": {"$exists": False}},
            {"image_url": None},
            {"image_url": ""},
            {"image_url": {"$regex": "placeholder|default", "$options": "i"}}
        ]},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "category_id": 1}
    ).to_list(500)
    
    results = []
    for product in products:
        product_name = product.get("name", "")
        results.append({
            "product_id": product.get("id"),
            "product_name": product_name,
            "slug": product.get("slug"),
            "search_query": f"{product_name} medical equipment"
        })
    
    return {
        "total": len(results),
        "products": results
    }

# Set product image from URL
@api_router.post("/dev/products/{product_id}/set-image-url")
async def set_product_image_url(
    product_id: str,
    image_url: str = Form(...),
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Set product image from external URL (downloads and stores in bucket)"""
    import httpx
    
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        # Download image from URL
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, follow_redirects=True, timeout=30.0)
            response.raise_for_status()
            
            # Determine content type
            content_type = response.headers.get("content-type", "image/jpeg")
            if "jpeg" in content_type or "jpg" in content_type:
                ext = "jpg"
            elif "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"
            else:
                ext = "jpg"
            
            # Upload to storage
            storage_key = f"products/{product['slug']}.{ext}"
            success, result = await StorageService.upload_file(
                file_content=response.content,
                file_key=storage_key,
                content_type=content_type
            )
            
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to store image: {result}")
            
            # Update product with new image URL
            stored_url = result.get("url", f"/api/storage/download/{storage_key}")
            await db.products.update_one(
                {"id": product_id},
                {"$set": {"image_url": stored_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {"message": "Image saved", "image_url": stored_url}
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")
    except Exception as e:
        logger.error(f"Error setting product image: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Upload category image
@api_router.post("/dev/product-categories/{category_id}/image")
async def upload_category_image(
    category_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Upload category image to storage bucket"""
    # Verify category exists
    category = await db.product_categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
    
    # Generate optimized filename based on category slug
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    optimized_filename = f"category-{category['slug']}.{ext}"
    storage_key = f"products/{optimized_filename}"
    
    # Read file content
    file_content = await file.read()
    
    # Upload to storage
    success, result = await StorageService.upload_file(
        file_content=file_content,
        file_key=storage_key,
        content_type=file.content_type
    )
    
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {result}")
    
    # Get the public URL
    image_url = result.get("url", f"/api/storage/download/{storage_key}")
    
    # Update category with image URL
    await db.product_categories.update_one(
        {"id": category_id},
        {"$set": {"image_url": image_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Image uploaded", "image_url": image_url}

# Search for product images from web (no API keys needed)
@api_router.get("/images/search")
async def search_images(
    query: str,
    count: int = 6,
    current_user: dict = Depends(get_current_user)
):
    """Search for product images using DuckDuckGo (no API key required)"""
    from duckduckgo_search import DDGS
    
    images = []
    
    try:
        # Search using DuckDuckGo - focus on product images
        search_query = f"{query} product photo white background -logo -brand"
        
        with DDGS() as ddgs:
            results = list(ddgs.images(
                keywords=search_query,
                region="us-en",
                safesearch="moderate",
                size="Medium",
                type_image="photo",
                layout="Square",
                max_results=count * 2  # Get more to filter
            ))
            
            for result in results[:count]:
                images.append({
                    "id": str(hash(result.get("image", ""))),
                    "url": result.get("image"),
                    "thumb": result.get("thumbnail"),
                    "source": "duckduckgo",
                    "title": result.get("title", ""),
                    "download_url": result.get("image")
                })
                
    except Exception as e:
        logger.warning(f"DuckDuckGo image search failed: {e}")
        
        # Fallback - try without filters
        try:
            with DDGS() as ddgs:
                results = list(ddgs.images(
                    keywords=query,
                    region="us-en",
                    safesearch="moderate",
                    max_results=count
                ))
                
                for result in results[:count]:
                    images.append({
                        "id": str(hash(result.get("image", ""))),
                        "url": result.get("image"),
                        "thumb": result.get("thumbnail"),
                        "source": "duckduckgo",
                        "title": result.get("title", ""),
                        "download_url": result.get("image")
                    })
        except Exception as e2:
            logger.error(f"DuckDuckGo fallback also failed: {e2}")
    
    if not images:
        return {
            "images": [],
            "message": "No images found. Try a different search term.",
            "suggested_queries": [
                f"{query} medical device",
                f"{query} healthcare equipment",
                f"{query} DME product"
            ]
        }
    
    return {"images": images, "total": len(images)}
    
    return {"images": images, "total": len(images)}

# Get single product by slug (for individual product page)
@api_router.get("/public/products/{product_slug}")
async def get_public_product_by_slug(product_slug: str):
    """Get single product by slug for product detail page"""
    product = await db.products.find_one(
        {"slug": product_slug, "enabled": True},
        {"_id": 0}
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get category info
    category = await db.product_categories.find_one(
        {"id": product.get("category_id")},
        {"_id": 0}
    )
    product["category"] = category
    
    return product

# Regenerate product slugs with SEO-friendly format (dme-{name}-{HCPCS})
@api_router.post("/dev/products/regenerate-slugs")
async def regenerate_product_slugs(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Regenerate all product slugs with SEO-friendly format: dme-{product-name}-{HCPCS}"""
    import re
    
    def generate_seo_slug(name: str, hcpcs_codes: list = None) -> str:
        # Clean the name
        slug = name.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        slug = slug.strip('-')
        
        # Add dme- prefix
        if not slug.startswith('dme-'):
            slug = 'dme-' + slug
        
        # Add primary HCPCS code if available
        if hcpcs_codes and len(hcpcs_codes) > 0:
            slug = slug + '-' + hcpcs_codes[0].upper()
        
        return slug
    
    products = await db.products.find({}).to_list(length=None)
    updated_count = 0
    
    for product in products:
        old_slug = product.get('slug', '')
        hcpcs_codes = product.get('hcpcs_codes', [])
        new_slug = generate_seo_slug(product['name'], hcpcs_codes)
        
        if old_slug != new_slug:
            await db.products.update_one(
                {"id": product['id']},
                {"$set": {"slug": new_slug, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            updated_count += 1
    
    return {"message": f"Updated {updated_count} product slugs", "total_products": len(products)}

# Seed default DME suppliers
@api_router.post("/dev/seed-suppliers")
async def seed_default_suppliers(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Seed the database with default DME suppliers"""
    
    DEFAULT_SUPPLIERS = [
        {
            "name": "NikoHealth DME",
            "api_endpoint_url": "https://api.nikohealth.com/v1",
            "contact_email": "orders@nikohealth.com",
            "contact_phone": "(800) 555-0101",
            "address": "123 Healthcare Blvd, Tampa, FL 33601",
            "is_active": True,
            "product_tags": ["respiratory", "mobility", "hospital_beds", "cpap", "oxygen"]
        },
        {
            "name": "DDP Medical Supplies",
            "api_endpoint_url": "https://api.ddpmedical.com/v2",
            "contact_email": "orders@ddpmedical.com",
            "contact_phone": "(800) 555-0102",
            "address": "456 Medical Center Dr, Orlando, FL 32801",
            "is_active": True,
            "product_tags": ["diabetic", "wound_care", "orthotics", "bathroom_safety"]
        },
        {
            "name": "McKesson Medical-Surgical",
            "api_endpoint_url": "https://connect.mckesson.com/api",
            "contact_email": "medsurg@mckesson.com",
            "contact_phone": "(800) 555-0103",
            "address": "6555 State Hwy 161, Irving, TX 75039",
            "is_active": True,
            "product_tags": ["general", "wound_care", "enteral", "urology"]
        },
        {
            "name": "Medline Industries",
            "api_endpoint_url": "https://api.medline.com/orders",
            "contact_email": "customerservice@medline.com",
            "contact_phone": "(800) 555-0104",
            "address": "Three Lakes Dr, Northfield, IL 60093",
            "is_active": True,
            "product_tags": ["general", "bathroom_safety", "wound_care", "mobility"]
        },
        {
            "name": "Rotech Healthcare",
            "api_endpoint_url": "https://orders.rotech.com/api",
            "contact_email": "orders@rotech.com",
            "contact_phone": "(800) 555-0105",
            "address": "3600 Vineland Rd, Orlando, FL 32811",
            "is_active": True,
            "product_tags": ["respiratory", "oxygen", "cpap", "ventilators"]
        },
        {
            "name": "AdaptHealth",
            "api_endpoint_url": "https://api.adapthealth.com/v1",
            "contact_email": "orders@adapthealth.com",
            "contact_phone": "(800) 555-0106",
            "address": "220 W Germantown Pike, Plymouth Meeting, PA 19462",
            "is_active": True,
            "product_tags": ["respiratory", "diabetic", "mobility", "sleep"]
        },
        {
            "name": "Byram Healthcare",
            "api_endpoint_url": "https://api.byramhealthcare.com",
            "contact_email": "customercare@byramhealthcare.com",
            "contact_phone": "(800) 555-0107",
            "address": "324 Delaware Ave, Buffalo, NY 14202",
            "is_active": True,
            "product_tags": ["diabetic", "ostomy", "urology", "wound_care"]
        },
        {
            "name": "National Seating & Mobility",
            "api_endpoint_url": "https://api.nsm-seating.com",
            "contact_email": "info@nsm-seating.com",
            "contact_phone": "(800) 555-0108",
            "address": "9800 Shelbyville Rd, Louisville, KY 40223",
            "is_active": True,
            "product_tags": ["mobility", "wheelchairs", "seating", "power_mobility"]
        },
        {
            "name": "Hanger Clinic",
            "api_endpoint_url": "https://api.hangerclinic.com",
            "contact_email": "referrals@hanger.com",
            "contact_phone": "(800) 555-0109",
            "address": "10910 Domain Dr, Austin, TX 78758",
            "is_active": True,
            "product_tags": ["prosthetics", "orthotics", "braces"]
        },
        {
            "name": "Apria Healthcare",
            "api_endpoint_url": "https://api.apria.com/v2",
            "contact_email": "orders@apria.com",
            "contact_phone": "(800) 555-0110",
            "address": "7353 Company Dr, Indianapolis, IN 46237",
            "is_active": True,
            "product_tags": ["respiratory", "oxygen", "cpap", "enteral", "home_health"]
        }
    ]
    
    created_count = 0
    skipped_count = 0
    supplier_map = {}
    
    for supplier_data in DEFAULT_SUPPLIERS:
        # Check if supplier already exists
        existing = await db.suppliers.find_one({"name": supplier_data["name"]})
        if existing:
            supplier_map[supplier_data["name"]] = existing["id"]
            skipped_count += 1
            continue
        
        supplier_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        supplier_doc = {
            "id": supplier_id,
            **supplier_data,
            "inventory_status": "available",
            "created_at": now,
            "updated_at": now
        }
        
        await db.suppliers.insert_one(supplier_doc)
        supplier_map[supplier_data["name"]] = supplier_id
        created_count += 1
    
    return {
        "message": "Supplier seeding complete",
        "created": created_count,
        "skipped_existing": skipped_count,
        "total_suppliers": len(DEFAULT_SUPPLIERS),
        "supplier_ids": supplier_map
    }


# Generate complete DME product catalog
@api_router.post("/dev/products/generate-full-catalog")
async def generate_full_dme_catalog(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Generate a complete DME product catalog with all standard categories and products, linked to suppliers"""
    import re
    
    def generate_slug(name: str) -> str:
        slug = name.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')
    
    # First, ensure suppliers exist and get their IDs
    existing_suppliers = await db.suppliers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    supplier_name_to_id = {s["name"]: s["id"] for s in existing_suppliers}
    
    # If no suppliers exist, create them first
    if not supplier_name_to_id:
        # Auto-seed suppliers
        seed_result = await seed_default_suppliers(current_user)
        supplier_name_to_id = seed_result.get("supplier_ids", {})
    
    # Complete DME Catalog Definition with Supplier Associations
    # Supplier keys: "NikoHealth DME", "DDP Medical Supplies", "McKesson Medical-Surgical", 
    # "Medline Industries", "Rotech Healthcare", "AdaptHealth", "Byram Healthcare",
    # "National Seating & Mobility", "Hanger Clinic", "Apria Healthcare"
    
    DME_CATALOG = {
        "Emergency / Monitoring": {
            "icon": "heart-pulse",
            "color": "from-red-500 to-red-600",
            "products": [
                {"name": "AEDs (Automated External Defibrillators)", "hcpcs": ["E0617"], "desc": "Life-saving devices for cardiac emergencies that analyze heart rhythm and deliver electrical shocks", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Apnea Monitors", "hcpcs": ["E0618"], "desc": "Monitors breathing patterns and detects pauses in breathing for sleep apnea and infant monitoring", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth"]},
                {"name": "Blood Glucose Monitors", "hcpcs": ["E0607", "E2100", "E2101"], "desc": "Devices for diabetic patients to monitor blood sugar levels at home", "suppliers": ["DDP Medical Supplies", "Byram Healthcare", "AdaptHealth"]},
                {"name": "Blood Pressure Monitors", "hcpcs": ["A4670"], "desc": "Digital and manual blood pressure monitoring devices for home use", "suppliers": ["McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Pulse Oximeters", "hcpcs": ["E0445"], "desc": "Non-invasive devices that measure blood oxygen saturation levels", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "Apria Healthcare"]},
                {"name": "Oxygen Concentrators", "hcpcs": ["E1390", "E1391", "E1392"], "desc": "Portable and stationary devices that provide supplemental oxygen therapy", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "Apria Healthcare", "AdaptHealth"]},
                {"name": "Portable Oxygen Systems", "hcpcs": ["E0431", "E0434"], "desc": "Lightweight oxygen delivery systems for mobile patients", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "Apria Healthcare"]},
                {"name": "Nebulizers", "hcpcs": ["E0570", "E0574"], "desc": "Devices that convert liquid medication into mist for respiratory treatment", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "Apria Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Ventilators", "hcpcs": ["E0450", "E0460", "E0461"], "desc": "Life support equipment for patients who cannot breathe independently", "suppliers": ["NikoHealth DME", "Rotech Healthcare"]},
                {"name": "CPAP Machines", "hcpcs": ["E0601"], "desc": "Continuous Positive Airway Pressure devices for sleep apnea treatment", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth", "Apria Healthcare"]},
                {"name": "BiPAP Machines", "hcpcs": ["E0470", "E0471"], "desc": "Bilevel Positive Airway Pressure devices for complex sleep apnea", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth", "Apria Healthcare"]},
                {"name": "Suction Machines", "hcpcs": ["E0600"], "desc": "Portable and stationary devices for airway secretion removal", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical", "Apria Healthcare"]},
                {"name": "Infusion Pumps", "hcpcs": ["E0781", "E0784"], "desc": "Devices for controlled delivery of medications, nutrients, or fluids", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare"]},
                {"name": "Personal Emergency Response Systems (PERS)", "hcpcs": ["S5160", "S5161"], "desc": "Medical alert systems with fall detection and 24/7 monitoring", "suppliers": ["NikoHealth DME", "AdaptHealth"]},
            ]
        },
        "Orthopedic / Orthotics": {
            "icon": "bone",
            "color": "from-amber-500 to-amber-600",
            "products": [
                {"name": "Back Braces (LSO/TLSO)", "hcpcs": ["L0631", "L0648", "L0650"], "desc": "Lumbar and thoracolumbar support braces for spinal injuries and post-surgery", "suppliers": ["DDP Medical Supplies", "Hanger Clinic", "McKesson Medical-Surgical"]},
                {"name": "Knee Braces", "hcpcs": ["L1810", "L1820", "L1830", "L1843"], "desc": "Supportive braces for knee injuries, arthritis, and post-operative care", "suppliers": ["DDP Medical Supplies", "Hanger Clinic", "Medline Industries"]},
                {"name": "Ankle Braces (AFO)", "hcpcs": ["L1900", "L1902", "L1904"], "desc": "Ankle-foot orthoses for drop foot, ankle instability, and support", "suppliers": ["DDP Medical Supplies", "Hanger Clinic"]},
                {"name": "Wrist Braces", "hcpcs": ["L3807", "L3809"], "desc": "Supportive braces for carpal tunnel, sprains, and wrist injuries", "suppliers": ["DDP Medical Supplies", "Hanger Clinic", "Medline Industries"]},
                {"name": "Shoulder Braces", "hcpcs": ["L3660", "L3670"], "desc": "Immobilizers and support braces for shoulder injuries and post-surgery", "suppliers": ["DDP Medical Supplies", "Hanger Clinic"]},
                {"name": "Cervical Collars", "hcpcs": ["L0120", "L0130", "L0140"], "desc": "Neck support collars for cervical spine injuries and conditions", "suppliers": ["DDP Medical Supplies", "Hanger Clinic", "McKesson Medical-Surgical"]},
                {"name": "Hip Braces", "hcpcs": ["L1600", "L1610"], "desc": "Hip abduction orthoses for post-surgical support and hip conditions", "suppliers": ["Hanger Clinic", "DDP Medical Supplies"]},
                {"name": "Elbow Braces", "hcpcs": ["L3700", "L3702"], "desc": "Support braces for tennis elbow, golfer's elbow, and injuries", "suppliers": ["DDP Medical Supplies", "Hanger Clinic", "Medline Industries"]},
                {"name": "Walking Boots", "hcpcs": ["L4360", "L4361"], "desc": "Pneumatic walking boots for fractures and foot/ankle injuries", "suppliers": ["DDP Medical Supplies", "Hanger Clinic", "McKesson Medical-Surgical"]},
                {"name": "Custom Orthotics", "hcpcs": ["L3000", "L3010", "L3020"], "desc": "Custom-molded foot orthoses for diabetic foot care and support", "suppliers": ["Hanger Clinic", "DDP Medical Supplies"]},
                {"name": "Compression Stockings", "hcpcs": ["A6530", "A6531", "A6532"], "desc": "Graduated compression garments for circulation and lymphedema", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Byram Healthcare"]},
            ]
        },
        "Mobility Equipment": {
            "icon": "accessibility",
            "color": "from-blue-500 to-blue-600",
            "products": [
                {"name": "Manual Wheelchairs", "hcpcs": ["K0001", "K0002", "K0003", "K0004"], "desc": "Standard, lightweight, and high-strength manual wheelchairs", "suppliers": ["National Seating & Mobility", "NikoHealth DME", "Medline Industries"]},
                {"name": "Power Wheelchairs", "hcpcs": ["K0800", "K0801", "K0802"], "desc": "Motorized wheelchairs for patients who cannot self-propel", "suppliers": ["National Seating & Mobility", "NikoHealth DME", "AdaptHealth"]},
                {"name": "Transport Chairs", "hcpcs": ["E1038"], "desc": "Lightweight chairs designed to be pushed by caregivers", "suppliers": ["Medline Industries", "NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Rollators", "hcpcs": ["E0143", "E0144"], "desc": "Four-wheeled walkers with seats and hand brakes", "suppliers": ["Medline Industries", "NikoHealth DME", "McKesson Medical-Surgical", "AdaptHealth"]},
                {"name": "Standard Walkers", "hcpcs": ["E0130", "E0135"], "desc": "Basic folding and rigid walkers for stability", "suppliers": ["Medline Industries", "NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Knee Walkers", "hcpcs": ["E0118"], "desc": "Scooter-style mobility devices for lower leg injuries", "suppliers": ["NikoHealth DME", "Medline Industries"]},
                {"name": "Canes", "hcpcs": ["E0100", "E0105"], "desc": "Standard, quad, and offset canes for balance assistance", "suppliers": ["Medline Industries", "McKesson Medical-Surgical"]},
                {"name": "Crutches", "hcpcs": ["E0110", "E0111", "E0114"], "desc": "Underarm and forearm crutches for non-weight bearing mobility", "suppliers": ["Medline Industries", "McKesson Medical-Surgical"]},
                {"name": "Mobility Scooters", "hcpcs": ["K0800", "K0806", "K0807"], "desc": "Powered scooters for indoor and outdoor mobility", "suppliers": ["National Seating & Mobility", "NikoHealth DME", "AdaptHealth"]},
                {"name": "Stair Lifts", "hcpcs": ["E0627"], "desc": "Motorized chairs that travel along staircases", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
                {"name": "Patient Lifts", "hcpcs": ["E0630", "E0635", "E0636"], "desc": "Hydraulic and electric lifts for patient transfers", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Standing Frames", "hcpcs": ["E0638", "E0641"], "desc": "Devices to help non-ambulatory patients stand", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
            ]
        },
        "Hospital Beds & Accessories": {
            "icon": "bed",
            "color": "from-purple-500 to-purple-600",
            "products": [
                {"name": "Hospital Beds - Manual", "hcpcs": ["E0250", "E0251"], "desc": "Fixed and variable height manual hospital beds", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Hospital Beds - Semi-Electric", "hcpcs": ["E0260", "E0261"], "desc": "Electric head/foot adjustment with manual height", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Hospital Beds - Full Electric", "hcpcs": ["E0265", "E0266"], "desc": "Fully electric adjustable hospital beds", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Low Air Loss Mattresses", "hcpcs": ["E0277"], "desc": "Therapeutic mattresses for pressure ulcer prevention", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Alternating Pressure Mattresses", "hcpcs": ["E0181", "E0182"], "desc": "Dynamic mattresses that alternate pressure points", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Foam Mattresses", "hcpcs": ["E0184", "E0185"], "desc": "Pressure-reducing foam mattresses for hospital beds", "suppliers": ["NikoHealth DME", "Medline Industries"]},
                {"name": "Gel Mattress Overlays", "hcpcs": ["E0185"], "desc": "Gel-based pressure redistribution overlays", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Bed Rails", "hcpcs": ["E0305", "E0310"], "desc": "Full and half-length bed safety rails", "suppliers": ["NikoHealth DME", "Medline Industries", "McKesson Medical-Surgical"]},
                {"name": "Trapeze Bars", "hcpcs": ["E0910", "E0912"], "desc": "Overhead bars to assist patient repositioning", "suppliers": ["NikoHealth DME", "Medline Industries"]},
                {"name": "Overbed Tables", "hcpcs": ["E0274"], "desc": "Adjustable tables for eating and activities in bed", "suppliers": ["NikoHealth DME", "Medline Industries", "McKesson Medical-Surgical"]},
            ]
        },
        "Bathroom Safety": {
            "icon": "bath",
            "color": "from-cyan-500 to-cyan-600",
            "products": [
                {"name": "Shower Chairs", "hcpcs": ["E0240"], "desc": "Waterproof chairs for safe bathing while seated", "suppliers": ["DDP Medical Supplies", "Medline Industries", "McKesson Medical-Surgical"]},
                {"name": "Transfer Benches", "hcpcs": ["E0247", "E0248"], "desc": "Benches that extend over tub edge for safe transfers", "suppliers": ["DDP Medical Supplies", "Medline Industries"]},
                {"name": "Raised Toilet Seats", "hcpcs": ["E0244"], "desc": "Elevated seats to reduce bending when using toilet", "suppliers": ["DDP Medical Supplies", "Medline Industries", "McKesson Medical-Surgical"]},
                {"name": "Toilet Safety Frames", "hcpcs": ["E0243"], "desc": "Support frames with armrests around toilet", "suppliers": ["DDP Medical Supplies", "Medline Industries"]},
                {"name": "Commode Chairs", "hcpcs": ["E0163", "E0165", "E0167"], "desc": "Portable toilet chairs for bedside use", "suppliers": ["DDP Medical Supplies", "Medline Industries", "McKesson Medical-Surgical"]},
                {"name": "Grab Bars", "hcpcs": ["E0241"], "desc": "Wall-mounted support bars for bathroom safety", "suppliers": ["DDP Medical Supplies", "Medline Industries"]},
                {"name": "Bath Lifts", "hcpcs": ["E0625"], "desc": "Powered or manual lifts for lowering into bathtubs", "suppliers": ["DDP Medical Supplies", "NikoHealth DME"]},
                {"name": "Hand-Held Showers", "hcpcs": ["E0245"], "desc": "Adjustable shower heads for seated bathing", "suppliers": ["DDP Medical Supplies", "Medline Industries"]},
            ]
        },
        "Diabetic Supplies": {
            "icon": "droplet",
            "color": "from-green-500 to-green-600",
            "products": [
                {"name": "Insulin Pumps", "hcpcs": ["E0784"], "desc": "Programmable devices for continuous insulin delivery", "suppliers": ["DDP Medical Supplies", "Byram Healthcare", "AdaptHealth"]},
                {"name": "Continuous Glucose Monitors (CGM)", "hcpcs": ["E2102", "E2103"], "desc": "Real-time glucose monitoring systems", "suppliers": ["DDP Medical Supplies", "Byram Healthcare", "AdaptHealth"]},
                {"name": "Blood Glucose Test Strips", "hcpcs": ["A4253"], "desc": "Disposable strips for blood glucose testing", "suppliers": ["DDP Medical Supplies", "Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Lancets & Lancing Devices", "hcpcs": ["A4258", "A4259"], "desc": "Devices for obtaining blood samples", "suppliers": ["DDP Medical Supplies", "Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Insulin Syringes", "hcpcs": ["A4206", "A4207"], "desc": "Disposable syringes for insulin injection", "suppliers": ["DDP Medical Supplies", "Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Pen Needles", "hcpcs": ["A4210"], "desc": "Disposable needles for insulin pens", "suppliers": ["DDP Medical Supplies", "Byram Healthcare"]},
                {"name": "Diabetic Shoes", "hcpcs": ["A5500", "A5501"], "desc": "Therapeutic footwear for diabetic foot care", "suppliers": ["DDP Medical Supplies", "Hanger Clinic"]},
                {"name": "Diabetic Shoe Inserts", "hcpcs": ["A5512", "A5513"], "desc": "Custom and prefabricated diabetic insoles", "suppliers": ["DDP Medical Supplies", "Hanger Clinic"]},
            ]
        },
        "Wound Care": {
            "icon": "bandage",
            "color": "from-pink-500 to-pink-600",
            "products": [
                {"name": "Wound VAC Systems", "hcpcs": ["E2402"], "desc": "Negative pressure wound therapy systems", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Byram Healthcare"]},
                {"name": "Wound Dressings - Foam", "hcpcs": ["A6209", "A6210", "A6211"], "desc": "Absorbent foam dressings for wound management", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Medline Industries", "Byram Healthcare"]},
                {"name": "Wound Dressings - Hydrocolloid", "hcpcs": ["A6234", "A6235", "A6236"], "desc": "Moisture-retentive dressings for healing", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Wound Dressings - Alginate", "hcpcs": ["A6196", "A6197", "A6198"], "desc": "Highly absorbent dressings from seaweed", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Byram Healthcare"]},
                {"name": "Wound Dressings - Hydrogel", "hcpcs": ["A6242", "A6243", "A6244"], "desc": "Moisture-donating dressings for dry wounds", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Compression Bandages", "hcpcs": ["A6448", "A6449", "A6450"], "desc": "Elastic bandages for compression therapy", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Surgical Dressings", "hcpcs": ["A6216", "A6217", "A6218"], "desc": "Sterile gauze and surgical pads", "suppliers": ["McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Skin Protectants", "hcpcs": ["A6250"], "desc": "Barrier creams and skin prep products", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical", "Byram Healthcare"]},
            ]
        },
        "Prosthetics": {
            "icon": "hand",
            "color": "from-indigo-500 to-indigo-600",
            "products": [
                {"name": "Lower Limb Prosthetics - Below Knee", "hcpcs": ["L5100", "L5105"], "desc": "Prosthetic legs for below-knee amputations", "suppliers": ["Hanger Clinic"]},
                {"name": "Lower Limb Prosthetics - Above Knee", "hcpcs": ["L5200", "L5210"], "desc": "Prosthetic legs for above-knee amputations", "suppliers": ["Hanger Clinic"]},
                {"name": "Upper Limb Prosthetics - Below Elbow", "hcpcs": ["L6000", "L6010"], "desc": "Prosthetic arms for below-elbow amputations", "suppliers": ["Hanger Clinic"]},
                {"name": "Upper Limb Prosthetics - Above Elbow", "hcpcs": ["L6100", "L6110"], "desc": "Prosthetic arms for above-elbow amputations", "suppliers": ["Hanger Clinic"]},
                {"name": "Prosthetic Sockets", "hcpcs": ["L5640", "L5645"], "desc": "Custom-fitted interface between residual limb and prosthesis", "suppliers": ["Hanger Clinic"]},
                {"name": "Prosthetic Liners", "hcpcs": ["L5673", "L5679"], "desc": "Cushioning liners for comfort and suspension", "suppliers": ["Hanger Clinic"]},
                {"name": "Prosthetic Feet", "hcpcs": ["L5970", "L5972", "L5974"], "desc": "Various prosthetic foot designs for different activities", "suppliers": ["Hanger Clinic"]},
                {"name": "Prosthetic Hands", "hcpcs": ["L6703", "L6704", "L6706"], "desc": "Terminal devices including hooks and hands", "suppliers": ["Hanger Clinic"]},
                {"name": "Myoelectric Prosthetics", "hcpcs": ["L6880", "L6881", "L6882"], "desc": "Electrically powered prosthetics controlled by muscle signals", "suppliers": ["Hanger Clinic"]},
            ]
        },
        "Speech & Communication": {
            "icon": "mic",
            "color": "from-violet-500 to-violet-600",
            "products": [
                {"name": "Speech Generating Devices (SGD)", "hcpcs": ["E2500", "E2502", "E2504"], "desc": "Electronic devices that produce speech output", "suppliers": ["NikoHealth DME", "AdaptHealth"]},
                {"name": "Communication Boards", "hcpcs": ["E2500"], "desc": "Non-electronic picture/symbol boards for communication", "suppliers": ["NikoHealth DME"]},
                {"name": "Electrolarynx Devices", "hcpcs": ["L8500"], "desc": "Artificial voice devices for laryngectomy patients", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Tracheoesophageal Voice Prostheses", "hcpcs": ["L8509", "L8510"], "desc": "Voice restoration devices for laryngectomy", "suppliers": ["NikoHealth DME"]},
                {"name": "Augmentative Communication Accessories", "hcpcs": ["E2599"], "desc": "Mounting systems and accessories for SGDs", "suppliers": ["NikoHealth DME", "AdaptHealth"]},
            ]
        },
        "Enteral Nutrition": {
            "icon": "utensils",
            "color": "from-orange-500 to-orange-600",
            "products": [
                {"name": "Enteral Feeding Pumps", "hcpcs": ["B9002"], "desc": "Electronic pumps for controlled tube feeding", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare"]},
                {"name": "Feeding Tubes - Nasogastric", "hcpcs": ["B4081", "B4082"], "desc": "Tubes inserted through nose to stomach", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare", "Byram Healthcare"]},
                {"name": "Feeding Tubes - Gastrostomy (G-Tube)", "hcpcs": ["B4087", "B4088"], "desc": "Tubes placed directly into stomach", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare", "Byram Healthcare"]},
                {"name": "Feeding Tubes - Jejunostomy (J-Tube)", "hcpcs": ["B4087", "B4088"], "desc": "Tubes placed directly into small intestine", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare"]},
                {"name": "Enteral Formula - Standard", "hcpcs": ["B4150"], "desc": "Nutritionally complete formulas for tube feeding", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare"]},
                {"name": "Enteral Formula - Specialized", "hcpcs": ["B4152", "B4153", "B4154"], "desc": "Disease-specific formulas (diabetic, renal, etc.)", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare"]},
                {"name": "Feeding Bags & Administration Sets", "hcpcs": ["B4034", "B4035"], "desc": "Bags and tubing for enteral feeding delivery", "suppliers": ["McKesson Medical-Surgical", "Apria Healthcare", "Byram Healthcare"]},
            ]
        },
        "Vision Aids": {
            "icon": "eye",
            "color": "from-teal-500 to-teal-600",
            "products": [
                {"name": "Magnifiers - Handheld", "hcpcs": ["E1401"], "desc": "Portable magnifying glasses for low vision", "suppliers": ["McKesson Medical-Surgical"]},
                {"name": "Magnifiers - Stand", "hcpcs": ["E1401"], "desc": "Stationary magnifiers for reading and tasks", "suppliers": ["McKesson Medical-Surgical"]},
                {"name": "Video Magnifiers (CCTV)", "hcpcs": ["E1401"], "desc": "Electronic magnification systems with cameras", "suppliers": ["McKesson Medical-Surgical", "AdaptHealth"]},
                {"name": "Prescription Eyewear - Post-Cataract", "hcpcs": ["V2100", "V2118"], "desc": "Specialized lenses after cataract surgery", "suppliers": ["Hanger Clinic"]},
                {"name": "Telescopic Lenses", "hcpcs": ["V2600", "V2610", "V2615"], "desc": "Distance and near telescopic systems", "suppliers": ["Hanger Clinic"]},
                {"name": "Prosthetic Eyes", "hcpcs": ["V2623", "V2624"], "desc": "Custom ocular prostheses", "suppliers": ["Hanger Clinic"]},
            ]
        },
        "Hearing Aids": {
            "icon": "ear",
            "color": "from-rose-500 to-rose-600",
            "products": [
                {"name": "Hearing Aids - Behind The Ear (BTE)", "hcpcs": ["V5261"], "desc": "Traditional style worn behind the ear", "suppliers": ["AdaptHealth"]},
                {"name": "Hearing Aids - In The Ear (ITE)", "hcpcs": ["V5262"], "desc": "Custom-molded to fit in outer ear", "suppliers": ["AdaptHealth"]},
                {"name": "Hearing Aids - In The Canal (ITC)", "hcpcs": ["V5263"], "desc": "Smaller aids that fit in ear canal", "suppliers": ["AdaptHealth"]},
                {"name": "Hearing Aids - Completely In Canal (CIC)", "hcpcs": ["V5264"], "desc": "Nearly invisible aids deep in ear canal", "suppliers": ["AdaptHealth"]},
                {"name": "Cochlear Implants", "hcpcs": ["L8614", "L8619"], "desc": "Surgically implanted hearing devices", "suppliers": ["AdaptHealth"]},
                {"name": "Bone Anchored Hearing Aids (BAHA)", "hcpcs": ["L8690", "L8691", "L8692"], "desc": "Implantable hearing systems", "suppliers": ["AdaptHealth"]},
                {"name": "Hearing Aid Accessories", "hcpcs": ["V5267"], "desc": "Batteries, cleaning supplies, and accessories", "suppliers": ["AdaptHealth", "McKesson Medical-Surgical"]},
            ]
        },
        "CPAP/BiPAP Accessories": {
            "icon": "wind",
            "color": "from-sky-500 to-sky-600",
            "products": [
                {"name": "CPAP Masks - Full Face", "hcpcs": ["A7030", "A7031"], "desc": "Full face masks covering nose and mouth for CPAP therapy", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth", "Apria Healthcare"]},
                {"name": "CPAP Masks - Nasal", "hcpcs": ["A7034", "A7035"], "desc": "Nasal masks covering only the nose for CPAP therapy", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth", "Apria Healthcare"]},
                {"name": "CPAP Masks - Nasal Pillows", "hcpcs": ["A7033"], "desc": "Minimal contact nasal pillow interfaces", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth"]},
                {"name": "CPAP Tubing", "hcpcs": ["A7037"], "desc": "Standard and heated tubing for CPAP machines", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth", "Apria Healthcare"]},
                {"name": "CPAP Filters", "hcpcs": ["A7038", "A7039"], "desc": "Disposable and reusable filters for CPAP machines", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "McKesson Medical-Surgical"]},
                {"name": "CPAP Humidifier Chambers", "hcpcs": ["A7046"], "desc": "Water chambers for heated humidification", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth"]},
                {"name": "CPAP Chinstraps", "hcpcs": ["A7036"], "desc": "Chin straps to prevent mouth breathing during therapy", "suppliers": ["NikoHealth DME", "Rotech Healthcare"]},
                {"name": "CPAP Headgear", "hcpcs": ["A7035"], "desc": "Replacement headgear for CPAP masks", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "AdaptHealth"]},
            ]
        },
        "Urology / Ostomy": {
            "icon": "droplets",
            "color": "from-emerald-500 to-emerald-600",
            "products": [
                {"name": "Intermittent Catheters", "hcpcs": ["A4351", "A4352"], "desc": "Single-use catheters for bladder drainage", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Foley Catheters", "hcpcs": ["A4338", "A4340"], "desc": "Indwelling urinary catheters with balloon retention", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "External Catheters (Condom)", "hcpcs": ["A4349"], "desc": "Non-invasive external collection devices for males", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Urinary Drainage Bags", "hcpcs": ["A4357", "A4358"], "desc": "Leg bags and bedside drainage collectors", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Ostomy Pouches - Colostomy", "hcpcs": ["A4414", "A4416"], "desc": "Collection pouches for colostomy patients", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Ostomy Pouches - Ileostomy", "hcpcs": ["A4414", "A4416"], "desc": "Collection pouches for ileostomy patients", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Ostomy Pouches - Urostomy", "hcpcs": ["A4420"], "desc": "Collection pouches for urinary diversion", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Ostomy Skin Barriers", "hcpcs": ["A4362", "A4363"], "desc": "Protective barriers and wafers around stoma", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
                {"name": "Ostomy Accessories", "hcpcs": ["A4421", "A4422"], "desc": "Belts, paste, powder, and deodorants for ostomy care", "suppliers": ["Byram Healthcare", "McKesson Medical-Surgical"]},
            ]
        },
        "Pediatric DME": {
            "icon": "baby",
            "color": "from-fuchsia-500 to-fuchsia-600",
            "products": [
                {"name": "Pediatric Wheelchairs", "hcpcs": ["E1231", "E1232"], "desc": "Sized wheelchairs for children with mobility impairments", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
                {"name": "Pediatric Strollers", "hcpcs": ["E1037", "E1038"], "desc": "Medical strollers for children with special needs", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
                {"name": "Pediatric Walkers", "hcpcs": ["E0130", "E0141"], "desc": "Sized walkers and gait trainers for children", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
                {"name": "Pediatric Standing Frames", "hcpcs": ["E0638", "E0641"], "desc": "Standing devices sized for children", "suppliers": ["National Seating & Mobility"]},
                {"name": "Pediatric AFOs/Orthotics", "hcpcs": ["L1900", "L1904"], "desc": "Child-sized ankle-foot orthoses and braces", "suppliers": ["Hanger Clinic", "DDP Medical Supplies"]},
                {"name": "Pediatric Hospital Beds", "hcpcs": ["E0328"], "desc": "Hospital beds designed for pediatric patients", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Pediatric CPAP/BiPAP", "hcpcs": ["E0601", "E0470"], "desc": "Sleep apnea devices sized for children", "suppliers": ["NikoHealth DME", "Rotech Healthcare"]},
                {"name": "Infant Apnea Monitors", "hcpcs": ["E0618"], "desc": "Breathing monitors for infants at risk of SIDS", "suppliers": ["NikoHealth DME", "Rotech Healthcare", "Apria Healthcare"]},
            ]
        },
        "Bariatric Equipment": {
            "icon": "scale",
            "color": "from-slate-500 to-slate-600",
            "products": [
                {"name": "Bariatric Wheelchairs", "hcpcs": ["K0007"], "desc": "Heavy-duty wheelchairs for patients over 250 lbs", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
                {"name": "Bariatric Power Wheelchairs", "hcpcs": ["K0800", "K0801"], "desc": "Motorized wheelchairs for bariatric patients", "suppliers": ["National Seating & Mobility", "NikoHealth DME"]},
                {"name": "Bariatric Hospital Beds", "hcpcs": ["E0301", "E0302"], "desc": "Heavy-duty hospital beds with higher weight capacity", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Bariatric Walkers", "hcpcs": ["E0130", "E0135"], "desc": "Heavy-duty walkers for larger patients", "suppliers": ["Medline Industries", "NikoHealth DME"]},
                {"name": "Bariatric Commodes", "hcpcs": ["E0168"], "desc": "Heavy-duty bedside commodes", "suppliers": ["DDP Medical Supplies", "Medline Industries"]},
                {"name": "Bariatric Patient Lifts", "hcpcs": ["E0630", "E0635"], "desc": "Heavy-duty patient lifts for transfers", "suppliers": ["NikoHealth DME", "Medline Industries"]},
                {"name": "Bariatric Mattresses", "hcpcs": ["E0277"], "desc": "Extra-wide therapeutic mattresses", "suppliers": ["NikoHealth DME", "McKesson Medical-Surgical"]},
                {"name": "Bariatric Bath Safety", "hcpcs": ["E0240", "E0247"], "desc": "Heavy-duty shower chairs and transfer benches", "suppliers": ["DDP Medical Supplies", "Medline Industries"]},
            ]
        },
        "Pain Management / Therapeutic": {
            "icon": "zap",
            "color": "from-yellow-500 to-yellow-600",
            "products": [
                {"name": "TENS Units", "hcpcs": ["E0720", "E0730"], "desc": "Transcutaneous electrical nerve stimulation for pain relief", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical"]},
                {"name": "TENS Electrodes & Supplies", "hcpcs": ["A4595", "A4556"], "desc": "Replacement electrodes and lead wires for TENS units", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical"]},
                {"name": "Electrical Stimulation Devices", "hcpcs": ["E0744", "E0745"], "desc": "Neuromuscular electrical stimulation devices", "suppliers": ["DDP Medical Supplies", "NikoHealth DME"]},
                {"name": "Heat Therapy Devices", "hcpcs": ["E0210", "E0215"], "desc": "Heating pads and moist heat therapy units", "suppliers": ["McKesson Medical-Surgical", "Medline Industries"]},
                {"name": "Cold Therapy Units", "hcpcs": ["E0218"], "desc": "Motorized cold therapy and ice machines", "suppliers": ["McKesson Medical-Surgical", "DDP Medical Supplies"]},
                {"name": "Ultrasound Therapy Devices", "hcpcs": ["E0659"], "desc": "Therapeutic ultrasound units for home use", "suppliers": ["DDP Medical Supplies"]},
                {"name": "Traction Devices", "hcpcs": ["E0840", "E0849"], "desc": "Cervical and lumbar traction equipment", "suppliers": ["DDP Medical Supplies", "McKesson Medical-Surgical"]},
                {"name": "Paraffin Bath Units", "hcpcs": ["E0235"], "desc": "Heat therapy units using warm paraffin wax", "suppliers": ["McKesson Medical-Surgical", "DDP Medical Supplies"]},
            ]
        }
    }
    
    created_categories = 0
    created_products = 0
    skipped_products = 0
    
    for cat_name, cat_data in DME_CATALOG.items():
        # Check if category exists
        existing_cat = await db.product_categories.find_one({"name": cat_name})
        
        if existing_cat:
            cat_id = existing_cat["id"]
        else:
            # Create category
            cat_id = str(uuid.uuid4())
            cat_slug = generate_slug(cat_name)
            now = datetime.now(timezone.utc).isoformat()
            
            await db.product_categories.insert_one({
                "id": cat_id,
                "name": cat_name,
                "slug": cat_slug,
                "icon": cat_data.get("icon", "package"),
                "color": cat_data.get("color", "from-gray-500 to-gray-600"),
                "enabled": True,
                "sort_order": created_categories,
                "created_at": now,
                "updated_at": now
            })
            created_categories += 1
        
        # Add products for this category
        for prod in cat_data["products"]:
            prod_slug = generate_slug(prod["name"])
            
            # Check if product already exists (by slug or name)
            existing_prod = await db.products.find_one({
                "$or": [
                    {"slug": prod_slug},
                    {"name": prod["name"]}
                ]
            })
            
            if existing_prod:
                skipped_products += 1
                continue
            
            prod_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Convert supplier names to IDs
            supplier_names = prod.get("suppliers", [])
            supplier_ids = [supplier_name_to_id.get(name) for name in supplier_names if supplier_name_to_id.get(name)]
            
            await db.products.insert_one({
                "id": prod_id,
                "name": prod["name"],
                "slug": prod_slug,
                "category_id": cat_id,
                "short_description": prod["desc"][:100] + "..." if len(prod["desc"]) > 100 else prod["desc"],
                "description": prod["desc"],
                "hcpcs_codes": prod.get("hcpcs", []),
                "supplier_ids": supplier_ids,
                "enabled": True,
                "image_url": None,
                "features": [],
                "created_at": now,
                "updated_at": now
            })
            created_products += 1
    
    # Get total supplier count
    total_suppliers = await db.suppliers.count_documents({})
    
    return {
        "message": "Catalog generation complete",
        "created_categories": created_categories,
        "created_products": created_products,
        "skipped_existing": skipped_products,
        "total_catalog_categories": len(DME_CATALOG),
        "total_catalog_products": sum(len(c["products"]) for c in DME_CATALOG.values()),
        "total_suppliers_linked": total_suppliers
    }


# Debug endpoint to check available catalog definition
@api_router.get("/dev/products/catalog-info")
async def get_catalog_info(current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Returns info about the hardcoded DME catalog available for generation"""
    
    DME_CATEGORIES = [
        "Emergency / Monitoring", "Orthopedic / Orthotics", "Mobility Equipment",
        "Hospital Beds & Accessories", "Bathroom Safety", "Diabetic Supplies",
        "Wound Care", "Prosthetics", "Speech & Communication", "Enteral Nutrition",
        "Vision Aids", "Hearing Aids", "CPAP/BiPAP Accessories", "Urology / Ostomy",
        "Pediatric DME", "Bariatric Equipment", "Pain Management / Therapeutic"
    ]
    
    # Count in database
    db_categories = await db.product_categories.count_documents({})
    db_products = await db.products.count_documents({})
    db_suppliers = await db.suppliers.count_documents({})
    
    return {
        "catalog_definition": {
            "total_categories": 17,
            "total_products": 146,
            "categories": DME_CATEGORIES
        },
        "database_current": {
            "categories": db_categories,
            "products": db_products,
            "suppliers": db_suppliers
        },
        "needs_generation": db_categories == 0 or db_products == 0
    }


# PUBLIC ENDPOINTS for Product Catalog (no auth required)
@api_router.get("/public/product-categories")
async def get_public_product_categories():
    """Get enabled product categories for public catalog"""
    categories = await db.product_categories.find(
        {"enabled": True}, 
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return categories

@api_router.get("/public/products")
async def get_public_products(category_id: Optional[str] = None):
    """Get enabled products for public catalog"""
    query = {"enabled": True}
    if category_id:
        query["category_id"] = category_id
    products = await db.products.find(query, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return products

@api_router.get("/public/catalog")
async def get_public_catalog():
    """Get full catalog with categories and their products"""
    categories = await db.product_categories.find(
        {"enabled": True}, 
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    
    catalog = []
    for cat in categories:
        products = await db.products.find(
            {"category_id": cat["id"], "enabled": True},
            {"_id": 0}
        ).sort("sort_order", 1).to_list(100)
        cat["products"] = products
        catalog.append(cat)
    
    return catalog


# Get products by supplier
@api_router.get("/products/by-supplier/{supplier_id}")
async def get_products_by_supplier(
    supplier_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all products available from a specific supplier"""
    # Verify supplier exists
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0, "api_key": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Find products that have this supplier in their supplier_ids list
    products = await db.products.find(
        {"supplier_ids": supplier_id, "enabled": True},
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    return {
        "supplier": supplier,
        "products": products,
        "total_products": len(products)
    }


# Get suppliers for a specific product
@api_router.get("/products/{product_id}/suppliers")
async def get_product_suppliers(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all suppliers that carry a specific product"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    supplier_ids = product.get("supplier_ids", [])
    suppliers = []
    
    if supplier_ids:
        suppliers = await db.suppliers.find(
            {"id": {"$in": supplier_ids}},
            {"_id": 0, "api_key": 0}
        ).to_list(100)
    
    return {
        "product": product,
        "suppliers": suppliers,
        "total_suppliers": len(suppliers)
    }


# ==================== GENERAL SETTINGS ====================

# Site Settings
class SiteSettingsModel(BaseModel):
    logo_url: Optional[str] = None
    logo_link_url: Optional[str] = "/"
    dashboard_logo_url: Optional[str] = None
    dashboard_logo_link: Optional[str] = "/dashboard"
    favicon_url: Optional[str] = None
    pwa_icon_url: Optional[str] = None
    site_domain: Optional[str] = None  # e.g. "https://medinovadme.com" - used for location page URLs
    branding_version: Optional[str] = None

@api_router.get("/dev/settings/site")
async def get_site_settings(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
    if not settings:
        return {}

    if settings.get("logo_url") and not settings.get("dashboard_logo_url"):
        settings["dashboard_logo_url"] = settings.get("logo_url")
    if settings.get("favicon_url") and not settings.get("pwa_icon_url"):
        settings["pwa_icon_url"] = settings.get("favicon_url")
    settings["logo_link_url"] = settings.get("logo_link_url") or "/"
    settings["dashboard_logo_link"] = settings.get("dashboard_logo_link") or "/dashboard"

    return settings

@api_router.get("/public/site-branding")
async def get_public_site_branding():
    """Public endpoint to get site branding (logo, favicon) for login page etc."""
    settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
    if not settings:
        return {
            "logo_url": None,
            "dashboard_logo_url": None,
            "favicon_url": None,
            "logo_link_url": "/",
            "dashboard_logo_link": "/dashboard",
            "branding_version": None,
        }

    logo_url = settings.get("logo_url") or settings.get("dashboard_logo_url")
    favicon_url = settings.get("favicon_url") or settings.get("pwa_icon_url")

    return {
        "logo_url": logo_url,
        "dashboard_logo_url": logo_url,
        "favicon_url": favicon_url,
        "logo_link_url": settings.get("logo_link_url") or "/",
        "dashboard_logo_link": settings.get("dashboard_logo_link") or "/dashboard",
        "branding_version": settings.get("branding_version")
    }

@api_router.get("/public/locations")
async def get_public_locations():
    """Public endpoint to get all generated location states for the locations page"""
    # Get all state-level pages from generated_pages
    states_cursor = db.generated_pages.find(
        {"location_type": "state"},
        {"_id": 0, "html_content": 0}
    )
    states = await states_cursor.to_list(100)
    
    # Load US data to get county/city counts
    us_data = load_us_locations()
    
    result = []
    for state in states:
        state_slug = state.get("location_slug", "")
        state_name = state.get("location_name", "")
        
        # Get county and city counts from generated_pages
        county_count = await db.generated_pages.count_documents({
            "location_type": "county",
            "parent_state": state_slug
        })
        city_count = await db.generated_pages.count_documents({
            "location_type": "city", 
            "parent_state": state_slug
        })
        
        # Get county and city names from US data or DB
        counties = []
        cities = []
        
        if us_data and state_slug in us_data:
            # Get all counties/cities for display
            raw_counties = us_data[state_slug].get("counties", [])
            raw_cities = us_data[state_slug].get("cities", [])
            
            for c in raw_counties:
                c_slug = c.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")
                counties.append({
                    "name": c,
                    "slug": f"{c_slug}-{state_slug}",
                    "file": f"durable-medical-equipment-in-{c_slug}-{state_slug}.html"
                })
            
            for c in raw_cities:
                c_slug = c.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")
                cities.append({
                    "name": c,
                    "slug": f"{c_slug}-{state_slug}",
                    "file": f"durable-medical-equipment-in-{c_slug}-{state_slug}.html"
                })
        
        result.append({
            "name": state_name,
            "slug": state_slug,
            "file": f"durable-medical-equipment-in-{state_slug}.html",
            "total_pages": 1 + county_count + city_count,
            "county_count": county_count,
            "city_count": city_count,
            "counties": counties,
            "cities": cities
        })
    
    # Sort by state name
    result.sort(key=lambda x: x["name"])
    return result

@api_router.post("/dev/settings/site")
async def save_site_settings(
    settings: SiteSettingsModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings_dict = settings.model_dump()

    primary_logo = settings_dict.get("logo_url") or settings_dict.get("dashboard_logo_url")
    favicon = settings_dict.get("favicon_url") or settings_dict.get("pwa_icon_url")

    settings_dict["logo_url"] = primary_logo
    settings_dict["dashboard_logo_url"] = primary_logo
    settings_dict["favicon_url"] = favicon
    settings_dict["pwa_icon_url"] = favicon
    settings_dict["logo_link_url"] = settings_dict.get("logo_link_url") or "/"
    settings_dict["dashboard_logo_link"] = settings_dict.get("dashboard_logo_link") or "/dashboard"
    settings_dict["branding_version"] = datetime.now(timezone.utc).isoformat()

    settings_dict["type"] = "site"
    settings_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.site_settings.update_one(
        {"type": "site"},
        {"$set": settings_dict},
        upsert=True
    )
    return {
        "message": "Site settings saved",
        "settings": {
            "logo_url": settings_dict.get("logo_url"),
            "dashboard_logo_url": settings_dict.get("dashboard_logo_url"),
            "favicon_url": settings_dict.get("favicon_url"),
            "pwa_icon_url": settings_dict.get("pwa_icon_url"),
            "logo_link_url": settings_dict.get("logo_link_url"),
            "dashboard_logo_link": settings_dict.get("dashboard_logo_link"),
            "site_domain": settings_dict.get("site_domain"),
            "branding_version": settings_dict.get("branding_version"),
        }
    }


# Storage Settings (iDrive E2)
class StorageSettingsModel(BaseModel):
    endpoint: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    bucket_name: Optional[str] = None
    folder_path: Optional[str] = None

@api_router.get("/dev/settings/storage")
async def get_storage_settings(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.site_settings.find_one({"type": "storage"}, {"_id": 0})
    if settings:
        # Mask secret key for display
        if settings.get("secret_key"):
            settings["secret_key"] = "••••••••" if len(settings["secret_key"]) > 0 else ""
    return settings or {}

@api_router.post("/dev/settings/storage")
async def save_storage_settings(
    settings: StorageSettingsModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings_dict = settings.model_dump()
    settings_dict["type"] = "storage"
    settings_dict["updated_at"] = datetime.now(timezone.utc)
    settings_dict["connected"] = False  # Will be set to True after successful test
    
    # If secret key is masked, keep the old one
    if settings_dict.get("secret_key") == "••••••••":
        existing = await db.site_settings.find_one({"type": "storage"})
        if existing:
            settings_dict["secret_key"] = existing.get("secret_key", "")
    
    await db.site_settings.update_one(
        {"type": "storage"},
        {"$set": settings_dict},
        upsert=True
    )
    return {"message": "Storage settings saved"}

@api_router.post("/dev/settings/storage/test")
async def test_storage_connection(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Use the StorageService to actually test the connection
    success, message = await StorageService.test_connection()
    
    if success:
        # Mark as connected in database
        await db.site_settings.update_one(
            {"type": "storage"},
            {"$set": {"connected": True}}
        )
    else:
        await db.site_settings.update_one(
            {"type": "storage"},
            {"$set": {"connected": False}}
        )
    
    return {"success": success, "message": message}


# ==================== ROLE MANAGEMENT ====================

# Default permissions structure
DEFAULT_PERMISSIONS = {
    "patients": {"view": False, "create": False, "edit": False, "delete": False},
    "leads": {"view": False, "create": False, "edit": False, "delete": False},
    "orders": {"view": False, "create": False, "edit": False, "delete": False},
    "documents": {"view": False, "create": False, "edit": False, "delete": False},
    "doctors": {"view": False, "create": False, "edit": False, "delete": False},
    "suppliers": {"view": False, "create": False, "edit": False, "delete": False},
    "insurance": {"view": False, "create": False, "edit": False, "delete": False},
    "users": {"view": False, "create": False, "edit": False, "delete": False, "impersonate": False},
    "accounting": {"view": False, "manage_expenses": False, "view_reports": False},
    "analytics": {"view": False},
    "audit_logs": {"view": False},
    "settings": {"admin_access": False, "dev_access": False},
    "files": {"view": False, "upload": False, "edit": False, "delete": False},
    "notes": {"view": False, "create": False, "delete": False}
}

# Default system roles that cannot be deleted
DEFAULT_ROLES = [
    {
        "name": "admin",
        "display_name": "Administrator",
        "description": "Full system access",
        "is_system": True,
        "permissions": {k: {pk: True for pk in pv} for k, pv in DEFAULT_PERMISSIONS.items()}
    },
    {
        "name": "office_manager",
        "display_name": "Office Manager",
        "description": "Manage office operations and staff",
        "is_system": True,
        "permissions": {
            **DEFAULT_PERMISSIONS,
            "patients": {"view": True, "create": True, "edit": True, "delete": False},
            "leads": {"view": True, "create": True, "edit": True, "delete": True},
            "orders": {"view": True, "create": True, "edit": True, "delete": False},
            "documents": {"view": True, "create": True, "edit": True, "delete": False},
            "doctors": {"view": True, "create": True, "edit": True, "delete": False},
            "suppliers": {"view": True, "create": True, "edit": True, "delete": False},
            "insurance": {"view": True, "create": True, "edit": True, "delete": False},
            "users": {"view": True, "create": False, "edit": False, "delete": False, "impersonate": False},
            "accounting": {"view": True, "manage_expenses": True, "view_reports": True},
            "analytics": {"view": True},
            "audit_logs": {"view": True},
            "files": {"view": True, "upload": True, "edit": True, "delete": False},
            "notes": {"view": True, "create": True, "delete": True}
        }
    },
    {
        "name": "sales_rep",
        "display_name": "Sales Representative",
        "description": "Can manage leads and patients",
        "is_system": True,
        "permissions": {
            **DEFAULT_PERMISSIONS,
            "patients": {"view": True, "create": True, "edit": True, "delete": False},
            "leads": {"view": True, "create": True, "edit": True, "delete": False},
            "orders": {"view": True, "create": True, "edit": True, "delete": False},
            "documents": {"view": True, "create": True, "edit": False, "delete": False},
            "doctors": {"view": True, "create": False, "edit": False, "delete": False},
            "files": {"view": True, "upload": True, "edit": False, "delete": False},
            "notes": {"view": True, "create": True, "delete": False}
        }
    },
    {
        "name": "doctor",
        "display_name": "Doctor",
        "description": "Medical professional with limited access",
        "is_system": True,
        "permissions": {
            **DEFAULT_PERMISSIONS,
            "patients": {"view": True, "create": False, "edit": False, "delete": False},
            "orders": {"view": True, "create": False, "edit": False, "delete": False},
            "documents": {"view": True, "create": True, "edit": False, "delete": False}
        }
    },
    {
        "name": "patient",
        "display_name": "Patient",
        "description": "Patient portal access only",
        "is_system": True,
        "permissions": {
            **DEFAULT_PERMISSIONS,
            "documents": {"view": True, "create": False, "edit": False, "delete": False},
            "notes": {"view": True, "create": True, "delete": False},
            "files": {"view": True, "upload": True, "edit": False, "delete": False}
        }
    }
]

class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    display_name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None
    permissions: dict = Field(default_factory=lambda: DEFAULT_PERMISSIONS.copy())

class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[dict] = None

@api_router.get("/roles")
async def get_roles(current_user: dict = Depends(get_current_user)):
    """Get all roles"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if roles collection has data, if not seed with defaults
    count = await db.roles.count_documents({})
    if count == 0:
        for role in DEFAULT_ROLES:
            role_doc = {
                "id": str(uuid.uuid4()),
                **role,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.roles.insert_one(role_doc)
    
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    return roles

@api_router.get("/roles/{role_id}")
async def get_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific role"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role

@api_router.post("/roles")
async def create_role(role_data: RoleCreate, current_user: dict = Depends(get_current_user)):
    """Create a new custom role"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if role name already exists
    existing = await db.roles.find_one({"name": role_data.name.lower().replace(" ", "_")})
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    role_doc = {
        "id": str(uuid.uuid4()),
        "name": role_data.name.lower().replace(" ", "_"),
        "display_name": role_data.display_name,
        "description": role_data.description,
        "is_system": False,
        "permissions": role_data.permissions,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.roles.insert_one(role_doc)
    await log_audit(current_user["id"], current_user["email"], "ROLE_CREATED", "roles", role_doc["id"])
    
    role_doc.pop("_id", None)
    return role_doc

@api_router.put("/roles/{role_id}")
async def update_role(role_id: str, updates: RoleUpdate, current_user: dict = Depends(get_current_user)):
    """Update a role's permissions"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Don't allow editing system role names
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if updates.display_name is not None:
        update_data["display_name"] = updates.display_name
    if updates.description is not None:
        update_data["description"] = updates.description
    if updates.permissions is not None:
        update_data["permissions"] = updates.permissions
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    await log_audit(current_user["id"], current_user["email"], "ROLE_UPDATED", "roles", role_id)
    
    return {"message": "Role updated successfully"}

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a custom role"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"role": role["name"]})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role: {users_with_role} users have this role assigned")
    
    await db.roles.delete_one({"id": role_id})
    await log_audit(current_user["id"], current_user["email"], "ROLE_DELETED", "roles", role_id)
    
    return {"message": "Role deleted successfully"}

@api_router.get("/roles/permissions/template")
async def get_permissions_template(current_user: dict = Depends(get_current_user)):
    """Get the default permissions template for creating new roles"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return DEFAULT_PERMISSIONS


# ==================== DME OPERATING STATES & DOCTOR AUTO-POPULATE ====================

# US States list
US_STATES = [
    {"code": "AL", "name": "Alabama"}, {"code": "AK", "name": "Alaska"}, {"code": "AZ", "name": "Arizona"},
    {"code": "AR", "name": "Arkansas"}, {"code": "CA", "name": "California"}, {"code": "CO", "name": "Colorado"},
    {"code": "CT", "name": "Connecticut"}, {"code": "DE", "name": "Delaware"}, {"code": "FL", "name": "Florida"},
    {"code": "GA", "name": "Georgia"}, {"code": "HI", "name": "Hawaii"}, {"code": "ID", "name": "Idaho"},
    {"code": "IL", "name": "Illinois"}, {"code": "IN", "name": "Indiana"}, {"code": "IA", "name": "Iowa"},
    {"code": "KS", "name": "Kansas"}, {"code": "KY", "name": "Kentucky"}, {"code": "LA", "name": "Louisiana"},
    {"code": "ME", "name": "Maine"}, {"code": "MD", "name": "Maryland"}, {"code": "MA", "name": "Massachusetts"},
    {"code": "MI", "name": "Michigan"}, {"code": "MN", "name": "Minnesota"}, {"code": "MS", "name": "Mississippi"},
    {"code": "MO", "name": "Missouri"}, {"code": "MT", "name": "Montana"}, {"code": "NE", "name": "Nebraska"},
    {"code": "NV", "name": "Nevada"}, {"code": "NH", "name": "New Hampshire"}, {"code": "NJ", "name": "New Jersey"},
    {"code": "NM", "name": "New Mexico"}, {"code": "NY", "name": "New York"}, {"code": "NC", "name": "North Carolina"},
    {"code": "ND", "name": "North Dakota"}, {"code": "OH", "name": "Ohio"}, {"code": "OK", "name": "Oklahoma"},
    {"code": "OR", "name": "Oregon"}, {"code": "PA", "name": "Pennsylvania"}, {"code": "RI", "name": "Rhode Island"},
    {"code": "SC", "name": "South Carolina"}, {"code": "SD", "name": "South Dakota"}, {"code": "TN", "name": "Tennessee"},
    {"code": "TX", "name": "Texas"}, {"code": "UT", "name": "Utah"}, {"code": "VT", "name": "Vermont"},
    {"code": "VA", "name": "Virginia"}, {"code": "WA", "name": "Washington"}, {"code": "WV", "name": "West Virginia"},
    {"code": "WI", "name": "Wisconsin"}, {"code": "WY", "name": "Wyoming"}, {"code": "DC", "name": "Washington DC"}
]

@api_router.get("/settings/us-states")
async def get_all_us_states(current_user: dict = Depends(get_current_user)):
    """Get list of all US states"""
    return US_STATES

@api_router.get("/settings/dme-operating-states")
async def get_dme_operating_states(current_user: dict = Depends(get_current_user)):
    """Get the states where DME operates"""
    settings = await db.site_settings.find_one({"type": "dme_operating_states"}, {"_id": 0})
    if not settings:
        return {"states": [], "auto_populate_enabled": False}
    return settings

@api_router.post("/settings/dme-operating-states")
async def save_dme_operating_states(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save the states where DME operates"""
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    states = request.get("states", [])
    auto_populate_enabled = request.get("auto_populate_enabled", False)
    
    now = datetime.now(timezone.utc).isoformat()
    await db.site_settings.update_one(
        {"type": "dme_operating_states"},
        {"$set": {
            "type": "dme_operating_states",
            "states": states,
            "auto_populate_enabled": auto_populate_enabled,
            "updated_at": now,
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "DME operating states saved", "states": states}

@api_router.get("/doctors")
async def get_all_doctors(
    current_user: dict = Depends(get_current_user)
):
    """Get all doctors/prescribers"""
    doctors = await db.users.find(
        {"role": UserRole.DOCTOR.value},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return doctors


def _extract_primary_taxonomy(record: dict) -> str:
    taxonomies = record.get("taxonomies") or []
    for tax in taxonomies:
        if tax.get("primary"):
            return tax.get("desc") or ""
    if taxonomies:
        return taxonomies[0].get("desc") or ""
    return ""


def _extract_location_address(record: dict) -> dict:
    addresses = record.get("addresses") or []
    for address in addresses:
        if address.get("address_purpose") == "LOCATION":
            return address
    return addresses[0] if addresses else {}


def _map_npi_record_to_doctor(record: dict) -> dict:
    basic = record.get("basic") or {}
    location = _extract_location_address(record)

    first_name = (basic.get("first_name") or "").title()
    last_name = (basic.get("last_name") or "").title()
    organization_name = (basic.get("organization_name") or "").strip()

    if not first_name and organization_name:
        first_name = "Provider"
    if not last_name and organization_name:
        last_name = organization_name

    state = (location.get("state") or "").upper()
    city = (location.get("city") or "").title()
    address_line1 = location.get("address_1") or ""
    address_line2 = location.get("address_2") or ""
    postal_code = location.get("postal_code") or ""
    full_address = ", ".join([value for value in [address_line1, address_line2, city, state, postal_code] if value])

    return {
        "npi": str(record.get("number") or "").strip(),
        "first_name": first_name,
        "last_name": last_name,
        "practice_name": organization_name,
        "specialty": _extract_primary_taxonomy(record),
        "phone": location.get("telephone_number"),
        "fax": location.get("fax_number"),
        "state": state,
        "city": city,
        "address": full_address,
        "credential": basic.get("credential"),
        "email": None,
    }


def _doctor_result_from_user(user: dict) -> dict:
    return {
        "doctor_id": user.get("id"),
        "npi": user.get("npi"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "practice_name": user.get("practice_name"),
        "specialty": user.get("specialty"),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "fax": user.get("fax"),
        "state": user.get("state"),
        "city": user.get("city"),
        "address": user.get("address"),
        "source": "local",
        "already_local": True,
        "import_needed": False,
    }


def _is_blank_value(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _is_placeholder_email(email: Optional[str]) -> bool:
    if not email:
        return True
    normalized = email.lower()
    return normalized.endswith("@example.com") or normalized.endswith("@placeholder.dme")


def _pick_better_doctor_value(field_name: str, existing, incoming):
    if _is_blank_value(existing) and not _is_blank_value(incoming):
        return incoming

    if field_name in ["first_name", "last_name"]:
        if isinstance(existing, str) and existing.strip().lower() in ["provider", "doctor", "unknown"] and incoming:
            return incoming
        return existing

    if field_name == "email":
        if _is_placeholder_email(existing) and incoming and not _is_placeholder_email(incoming):
            return incoming
        return existing

    if field_name in ["phone", "fax"]:
        existing_digits = re.sub(r"\D", "", str(existing or ""))
        incoming_digits = re.sub(r"\D", "", str(incoming or ""))
        if len(existing_digits) < 10 and len(incoming_digits) >= 10:
            return incoming
        return existing

    return existing if not _is_blank_value(existing) else incoming


@api_router.get("/doctors/unified-search")
async def unified_doctor_search(
    name: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    npi: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Search doctors from local directory + national NPI registry"""
    if not any([name, state, city, npi]):
        return {
            "results": [],
            "local_count": 0,
            "registry_count": 0,
            "total_count": 0,
            "npi_error": None,
        }

    local_query = {"role": UserRole.DOCTOR.value}
    local_and_filters = []

    if npi:
        local_and_filters.append({"npi": npi.strip()})
    if state:
        local_and_filters.append({"state": state.strip().upper()})
    if city:
        local_and_filters.append({"city": {"$regex": re.escape(city.strip()), "$options": "i"}})
    if name:
        escaped_name = re.escape(name.strip())
        local_and_filters.append({
            "$or": [
                {"first_name": {"$regex": escaped_name, "$options": "i"}},
                {"last_name": {"$regex": escaped_name, "$options": "i"}},
                {"practice_name": {"$regex": escaped_name, "$options": "i"}},
                {"email": {"$regex": escaped_name, "$options": "i"}},
            ]
        })

    if local_and_filters:
        local_query["$and"] = local_and_filters

    local_doctors = await db.users.find(
        local_query,
        {"_id": 0, "password_hash": 0}
    ).limit(limit).to_list(limit)

    local_results = [_doctor_result_from_user(user) for user in local_doctors]
    local_by_npi = {item["npi"]: item for item in local_results if item.get("npi")}

    registry_results = []
    npi_error = None

    try:
        params = {
            "version": "2.1",
            "limit": limit,
        }
        if npi:
            params["number"] = npi.strip()
        if name:
            parts = [part for part in re.split(r"\s+", name.strip()) if part]
            if len(parts) == 1:
                params["last_name"] = parts[0]
            elif len(parts) > 1:
                params["first_name"] = parts[0]
                params["last_name"] = " ".join(parts[1:])
        if state:
            params["state"] = state.strip().upper()
        if city:
            params["city"] = city.strip()

        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get("https://npiregistry.cms.hhs.gov/api/", params=params)
            response.raise_for_status()
            payload = response.json()

        for record in payload.get("results", []):
            mapped = _map_npi_record_to_doctor(record)
            if not mapped.get("npi"):
                continue

            local_match = local_by_npi.get(mapped["npi"])
            if local_match:
                merged = {
                    **mapped,
                    **{k: v for k, v in local_match.items() if v is not None},
                    "source": "local+registry",
                    "already_local": True,
                    "import_needed": False,
                    "doctor_id": local_match.get("doctor_id"),
                }
                existing_index = next((i for i, item in enumerate(local_results) if item.get("npi") == mapped["npi"]), None)
                if existing_index is not None:
                    local_results[existing_index] = merged
                continue

            mapped.update({
                "doctor_id": None,
                "source": "registry",
                "already_local": False,
                "import_needed": True,
            })
            registry_results.append(mapped)

    except Exception as e:
        npi_error = str(e)
        logger.warning(f"NPI registry search failed: {e}")

    combined_results = local_results + registry_results

    def _source_rank(item: dict):
        source = item.get("source")
        if source == "local+registry":
            return 0
        if source == "local":
            return 1
        return 2

    combined_results.sort(key=lambda item: (_source_rank(item), (item.get("last_name") or ""), (item.get("first_name") or "")))

    return {
        "results": combined_results,
        "local_count": len(local_results),
        "registry_count": len(registry_results),
        "total_count": len(combined_results),
        "npi_error": npi_error,
    }


@api_router.post("/doctors/import-from-npi")
async def import_doctor_from_npi(
    payload: NpiDoctorImportRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Import doctor from NPI Registry (dedupe by NPI, update if imported data is better)"""
    npi_number = (payload.npi or "").strip()
    if not re.fullmatch(r"\d{10}", npi_number):
        raise HTTPException(status_code=422, detail="NPI must be exactly 10 digits")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                "https://npiregistry.cms.hhs.gov/api/",
                params={"version": "2.1", "number": npi_number, "limit": 1}
            )
            response.raise_for_status()
            api_payload = response.json()
    except Exception as e:
        logger.error(f"NPI import lookup failed for {npi_number}: {e}")
        raise HTTPException(status_code=502, detail="Unable to fetch provider from NPI Registry")

    records = api_payload.get("results") or []
    if not records:
        raise HTTPException(status_code=404, detail="Provider not found in NPI Registry")

    mapped = _map_npi_record_to_doctor(records[0])
    mapped["npi"] = npi_number
    now = datetime.now(timezone.utc).isoformat()

    existing_doctor = await db.users.find_one({"role": UserRole.DOCTOR.value, "npi": npi_number}, {"_id": 0})

    tracked_fields = [
        "first_name", "last_name", "email", "phone", "fax", "state",
        "city", "address", "specialty", "practice_name", "credential"
    ]

    if existing_doctor:
        updates = {}
        for field_name in tracked_fields:
            current_value = existing_doctor.get(field_name)
            incoming_value = mapped.get(field_name)
            better_value = _pick_better_doctor_value(field_name, current_value, incoming_value)
            if better_value != current_value:
                updates[field_name] = better_value

        updates.update({
            "imported_from_npi": True,
            "last_npi_sync_at": now,
            "updated_at": now,
        })

        await db.users.update_one({"id": existing_doctor["id"]}, {"$set": updates})
        doctor = await db.users.find_one({"id": existing_doctor["id"]}, {"_id": 0, "password_hash": 0})
        action = "updated" if len([k for k in updates.keys() if k in tracked_fields]) > 0 else "already_exists"
    else:
        doctor_id = str(uuid.uuid4())
        placeholder_email = mapped.get("email") or f"npi.{npi_number}@placeholder.dme"

        doctor_doc = {
            "id": doctor_id,
            "role": UserRole.DOCTOR.value,
            "email": placeholder_email,
            "first_name": mapped.get("first_name") or "Provider",
            "last_name": mapped.get("last_name") or npi_number,
            "phone": mapped.get("phone"),
            "fax": mapped.get("fax"),
            "state": mapped.get("state"),
            "city": mapped.get("city"),
            "address": mapped.get("address"),
            "npi": npi_number,
            "specialty": mapped.get("specialty"),
            "practice_name": mapped.get("practice_name"),
            "credential": mapped.get("credential"),
            "is_active": True,
            "imported_from_npi": True,
            "last_npi_sync_at": now,
            "password_hash": hash_password(str(uuid.uuid4())),
            "created_at": now,
            "updated_at": now,
            "created_by": current_user.get("id"),
        }

        await db.users.insert_one(doctor_doc)
        doctor = {k: v for k, v in doctor_doc.items() if k not in ["_id", "password_hash"]}
        action = "created"

    await log_audit(
        current_user["id"],
        current_user["email"],
        "DOCTOR_IMPORTED_FROM_NPI",
        "users",
        doctor.get("id"),
        details={"npi": npi_number, "action": action},
        ip_address=request.client.host if request.client else None,
    )

    return {
        "message": "Doctor imported from NPI registry",
        "action": action,
        "doctor": doctor,
    }

@api_router.get("/doctors/by-states")
async def get_doctors_by_states(
    states: str = None,  # Comma-separated state codes
    current_user: dict = Depends(get_current_user)
):
    """Get doctors filtered by states"""
    query = {"role": UserRole.DOCTOR.value}
    
    if states:
        state_list = [s.strip().upper() for s in states.split(",")]
        query["state"] = {"$in": state_list}
    
    doctors = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    return doctors

@api_router.post("/doctors/auto-populate")
async def auto_populate_doctors(current_user: dict = Depends(get_current_user)):
    """
    Auto-populate doctors from the states DME operates in.
    This creates sample/placeholder doctor records that can be updated with real data.
    """
    if not is_admin_role(current_user) and current_user.get("email") != "mel@a2gdesigns.com":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get DME operating states
    settings = await db.site_settings.find_one({"type": "dme_operating_states"}, {"_id": 0})
    if not settings or not settings.get("states"):
        raise HTTPException(status_code=400, detail="No DME operating states configured. Please select states first.")
    
    operating_states = settings["states"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Sample specialties for DME-related doctors
    specialties = [
        "Pulmonology", "Sleep Medicine", "Internal Medicine", "Family Medicine",
        "Orthopedics", "Physical Medicine & Rehabilitation", "Neurology",
        "Cardiology", "Geriatrics", "Primary Care"
    ]
    
    # Sample practice name prefixes
    practice_prefixes = ["Regional", "Community", "Advanced", "Premier", "Family", "Comprehensive"]
    
    created_count = 0
    skipped_count = 0
    
    for state_code in operating_states:
        state_name = next((s["name"] for s in US_STATES if s["code"] == state_code), state_code)
        
        # Create 3-5 sample doctors per state
        import random
        num_doctors = random.randint(3, 5)
        
        for i in range(num_doctors):
            specialty = random.choice(specialties)
            # Generate a unique email based on state and specialty
            email_base = f"dr.{specialty.lower().replace(' ', '').replace('&', '')}_{state_code.lower()}_{i+1}@placeholder.dme"
            
            # Check if this placeholder already exists
            existing = await db.users.find_one({"email": email_base})
            if existing:
                skipped_count += 1
                continue
            
            # Generate sample data
            first_names = ["James", "Sarah", "Michael", "Jennifer", "David", "Emily", "Robert", "Lisa", "William", "Amanda"]
            last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Martinez", "Anderson"]
            
            practice_name = f"{random.choice(practice_prefixes)} {specialty} of {state_name}"
            
            doctor_doc = {
                "id": str(uuid.uuid4()),
                "email": email_base,
                "first_name": random.choice(first_names),
                "last_name": random.choice(last_names),
                "role": UserRole.DOCTOR.value,
                "is_active": True,
                "state": state_code,
                "specialty": specialty,
                "practice_name": practice_name,
                "npi": f"1{random.randint(100000000, 999999999)}",  # Placeholder NPI
                "phone": f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",
                "fax": f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",  # Fax number
                "password": "",  # No password - placeholder account
                "is_placeholder": True,  # Mark as auto-generated
                "created_at": now,
                "updated_at": now,
                "created_by": current_user["id"]
            }
            
            await db.users.insert_one(doctor_doc)
            created_count += 1
    
    await log_audit(
        current_user["id"], current_user["email"],
        "DOCTORS_AUTO_POPULATED", "users", None,
        details={"states": operating_states, "created": created_count, "skipped": skipped_count}
    )
    
    return {
        "message": f"Auto-populated {created_count} doctors across {len(operating_states)} states",
        "created_count": created_count,
        "skipped_count": skipped_count,
        "states": operating_states
    }


# ==================== FILE UPLOAD/DOWNLOAD ENDPOINTS ====================

@api_router.post("/storage/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default="uploads"),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Upload a file to cloud storage.
    
    Args:
        file: The file to upload
        folder: Subfolder to organize files (e.g., 'documents', 'logos', 'images')
    
    Returns:
        File metadata including URL
    """
    user = await get_current_user(credentials)
    
    # Read file content
    file_data = await file.read()
    
    # Check file size (max 50MB)
    max_size = 50 * 1024 * 1024  # 50MB
    if len(file_data) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB")
    
    # Upload to storage
    success, result = await StorageService.upload_file(
        file_data=file_data,
        filename=file.filename,
        content_type=file.content_type,
        folder=folder
    )
    
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    # Log the upload
    await db.system_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "file_upload",
        "user_id": user["id"],
        "user_email": user["email"],
        "details": {
            "filename": file.filename,
            "folder": folder,
            "key": result["key"],
            "size": result["size"]
        },
        "timestamp": datetime.now(timezone.utc)
    })
    
    return result


@api_router.get("/storage/download/{file_key:path}")
async def download_file(
    file_key: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Download a file from cloud storage"""
    await get_current_user(credentials)  # Verify authentication
    
    success, result = await StorageService.get_file(file_key)
    
    if not success:
        raise HTTPException(status_code=404, detail=result)
    
    # Get original filename from metadata
    filename = result["metadata"].get("original-filename", file_key.split("/")[-1])
    
    return StreamingResponse(
        BytesIO(result["data"]),
        media_type=result["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@api_router.get("/storage/url/{file_key:path}")
async def get_presigned_url(
    file_key: str,
    expiration: int = 3600,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a temporary presigned URL for a file"""
    await get_current_user(credentials)
    
    success, result = await StorageService.generate_presigned_url(file_key, expiration)
    
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    return {"url": result, "expires_in": expiration}


@api_router.delete("/storage/delete/{file_key:path}")
async def delete_file(
    file_key: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete a file from cloud storage"""
    user = await get_current_user(credentials)
    
    # Only admins can delete files
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required to delete files")
    
    success, result = await StorageService.delete_file(file_key)
    
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    # Log the deletion
    await db.system_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "file_delete",
        "user_id": user["id"],
        "user_email": user["email"],
        "details": {"key": file_key},
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": "File deleted"}


@api_router.get("/storage/list")
async def list_storage_files(
    prefix: str = None,
    max_keys: int = 100,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """List files in cloud storage"""
    user = await get_current_user(credentials)
    
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    success, result = await StorageService.list_files(prefix, max_keys)
    
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    return {"files": result}


@api_router.get("/storage/status")
async def get_storage_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Check if storage is configured and connected"""
    await get_current_user(credentials)
    
    settings = await StorageService.get_settings()
    
    if not settings:
        return {
            "configured": False,
            "connected": False,
            "message": "Storage not configured"
        }
    
    return {
        "configured": True,
        "connected": settings.get("connected", False),
        "bucket": settings.get("bucket_name"),
        "folder": settings.get("folder_path")
    }


# Email/SMTP Settings
class EmailSettingsModel(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = "587"
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    use_tls: bool = True

@api_router.get("/dev/settings/email")
async def get_email_settings(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.site_settings.find_one({"type": "email"}, {"_id": 0})
    if settings:
        # Mask password for display
        if settings.get("smtp_password"):
            settings["smtp_password"] = "••••••••" if len(settings["smtp_password"]) > 0 else ""
    return settings or {}

@api_router.post("/dev/settings/email")
async def save_email_settings(
    settings: EmailSettingsModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings_dict = settings.model_dump()
    settings_dict["type"] = "email"
    settings_dict["updated_at"] = datetime.now(timezone.utc)
    settings_dict["connected"] = False
    
    # If password is masked, keep the old one
    if settings_dict.get("smtp_password") == "••••••••":
        existing = await db.site_settings.find_one({"type": "email"})
        if existing:
            settings_dict["smtp_password"] = existing.get("smtp_password", "")
    
    await db.site_settings.update_one(
        {"type": "email"},
        {"$set": settings_dict},
        upsert=True
    )
    return {"message": "Email settings saved"}

@api_router.post("/dev/settings/email/test")
async def test_email_send(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.site_settings.find_one({"type": "email"})
    if not settings:
        raise HTTPException(status_code=400, detail="Email settings not configured")
    
    required = ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "from_email"]
    missing = [f for f in required if not settings.get(f)]
    
    if missing:
        return {"success": False, "message": f"Missing required fields: {', '.join(missing)}"}
    
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    try:
        smtp_host = settings.get("smtp_host")
        smtp_port = int(settings.get("smtp_port", 587))
        smtp_username = settings.get("smtp_username")
        smtp_password = settings.get("smtp_password")
        from_email = settings.get("from_email")
        from_name = settings.get("from_name", "MediNova Medical Supplies")
        
        # Create test email
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Test Email from MediNova Medical Supplies"
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = user['email']
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #0055CC;">Email Configuration Test</h2>
            <p>This is a test email from your MediNova Medical Supplies system.</p>
            <p>If you're receiving this, your SMTP settings are configured correctly!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
                Sent to: {user['email']}<br>
                SMTP Host: {smtp_host}:{smtp_port}
            </p>
        </body>
        </html>
        """
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Connect and send
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
            server.starttls()
        
        server.login(smtp_username, smtp_password)
        server.sendmail(from_email, user['email'], msg.as_string())
        server.quit()
        
        # Mark as connected
        await db.site_settings.update_one(
            {"type": "email"},
            {"$set": {"connected": True}}
        )
        
        return {"success": True, "message": f"Test email sent to {user['email']}"}
        
    except smtplib.SMTPAuthenticationError as e:
        return {"success": False, "message": f"Authentication failed: Check your username/password"}
    except smtplib.SMTPConnectError as e:
        return {"success": False, "message": f"Could not connect to {settings.get('smtp_host')}:{settings.get('smtp_port')}"}
    except Exception as e:
        logger.error(f"SMTP test error: {e}")
        return {"success": False, "message": f"Failed: {str(e)}"}


# Custom Code Settings
class CustomCodeModel(BaseModel):
    head_code: Optional[str] = None
    body_start_code: Optional[str] = None
    body_end_code: Optional[str] = None

@api_router.get("/dev/settings/custom-code")
async def get_custom_code(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.site_settings.find_one({"type": "custom_code"}, {"_id": 0})
    return settings or {}

@api_router.post("/dev/settings/custom-code")
async def save_custom_code(
    settings: CustomCodeModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings_dict = settings.model_dump()
    settings_dict["type"] = "custom_code"
    settings_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.site_settings.update_one(
        {"type": "custom_code"},
        {"$set": settings_dict},
        upsert=True
    )
    return {"message": "Custom code saved"}


# ==================== SITE RULES ====================

class SiteRuleCreate(BaseModel):
    category: str  # doctor, patient, supplier, orders, billing, compliance, leads, shipping
    title: str
    content: Optional[str] = None
    priority: str = "medium"  # high, medium, low
    enabled: bool = True
    order: int = 0

class SiteRuleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[str] = None
    enabled: Optional[bool] = None
    order: Optional[int] = None

@api_router.get("/dev/site-rules")
async def get_site_rules(
    category: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all site rules, optionally filtered by category"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if category:
        query["category"] = category
    
    rules = await db.site_rules.find(query, {"_id": 0}).sort("order", 1).to_list(500)
    return rules

@api_router.post("/dev/site-rules")
async def create_site_rule(
    rule: SiteRuleCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new site rule"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_categories = ['doctor', 'patient', 'supplier', 'orders', 'billing', 'compliance', 'leads', 'shipping', 'seo']
    if rule.category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}")
    
    rule_data = {
        "id": str(uuid.uuid4()),
        "category": rule.category,
        "title": rule.title,
        "content": rule.content,
        "priority": rule.priority,
        "enabled": rule.enabled,
        "order": rule.order,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": user["id"]
    }
    
    await db.site_rules.insert_one(rule_data)
    
    # Return without _id
    rule_data.pop("_id", None)
    return rule_data

@api_router.put("/dev/site-rules/{rule_id}")
async def update_site_rule(
    rule_id: str,
    updates: SiteRuleUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update a site rule"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build update dict with only provided fields
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.site_rules.update_one(
        {"id": rule_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return {"message": "Rule updated successfully"}

@api_router.delete("/dev/site-rules/{rule_id}")
async def delete_site_rule(
    rule_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete a site rule"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.site_rules.delete_one({"id": rule_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return {"message": "Rule deleted successfully"}

@api_router.post("/dev/site-rules/reorder")
async def reorder_site_rules(
    rules: List[dict],
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Reorder rules within a category"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    for item in rules:
        await db.site_rules.update_one(
            {"id": item["id"]},
            {"$set": {"order": item["order"]}}
        )
    
    return {"message": "Rules reordered successfully"}


# ==================== E-SIGNATURE SYSTEM ====================

class SignatureCreate(BaseModel):
    signature_data: str  # Base64 encoded image
    signature_type: str  # draw, type, upload
    signer_name: str
    signer_role: str = "signer"  # patient, doctor, witness, admin
    document_id: Optional[str] = None
    document_type: Optional[str] = None
    save_for_future: bool = False
    signature_name: Optional[str] = None

class SigningSessionCreate(BaseModel):
    document_id: str
    document_type: str  # cmn, consent, delivery, authorization
    document_name: str
    signers: List[dict]  # [{role: "doctor", name: "Dr. Smith", email: "...", order: 1}, ...]
    
class SigningSessionSign(BaseModel):
    signature_data: str
    signature_type: str
    signer_name: str

# Create a signature (and optionally save for reuse)
@api_router.post("/signatures")
async def create_signature(
    signature: SignatureCreate,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create and store a signature"""
    user = await get_current_user(credentials)
    
    # Get IP address
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host
    
    signature_record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "signature_data": signature.signature_data,
        "signature_type": signature.signature_type,
        "signer_name": signature.signer_name,
        "signer_role": signature.signer_role,
        "document_id": signature.document_id,
        "document_type": signature.document_type,
        "ip_address": client_ip,
        "user_agent": request.headers.get("User-Agent", ""),
        "timestamp": datetime.now(timezone.utc),
        "is_saved_template": signature.save_for_future,
        "signature_name": signature.signature_name if signature.save_for_future else None,
        "verified": True
    }
    
    await db.signatures.insert_one(signature_record)
    
    # Log audit event
    await db.system_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "action": "signature_created",
        "resource_type": "signature",
        "resource_id": signature_record["id"],
        "details": {
            "signer_name": signature.signer_name,
            "signer_role": signature.signer_role,
            "document_id": signature.document_id,
            "document_type": signature.document_type,
            "signature_type": signature.signature_type,
            "ip_address": client_ip
        },
        "ip_address": client_ip,
        "timestamp": datetime.now(timezone.utc)
    })
    
    signature_record.pop("_id", None)
    return signature_record

# Get saved signatures for a user
@api_router.get("/signatures/saved")
async def get_saved_signatures(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's saved signature templates"""
    user = await get_current_user(credentials)
    
    signatures = await db.signatures.find(
        {"user_id": user["id"], "is_saved_template": True},
        {"_id": 0, "signature_data": 1, "signature_type": 1, "signature_name": 1, "signer_name": 1, "id": 1}
    ).to_list(20)
    
    return signatures

# Delete a saved signature
@api_router.delete("/signatures/saved/{signature_id}")
async def delete_saved_signature(
    signature_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete a saved signature template"""
    user = await get_current_user(credentials)
    
    result = await db.signatures.delete_one({
        "id": signature_id,
        "user_id": user["id"],
        "is_saved_template": True
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved signature not found")
    
    return {"message": "Signature deleted"}

# Create a signing session for multi-signer documents
@api_router.post("/signing-sessions")
async def create_signing_session(
    session: SigningSessionCreate,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a multi-signer signing session"""
    user = await get_current_user(credentials)
    
    # Create signing session
    session_record = {
        "id": str(uuid.uuid4()),
        "document_id": session.document_id,
        "document_type": session.document_type,
        "document_name": session.document_name,
        "created_by": user["id"],
        "status": "pending",  # pending, in_progress, completed, expired, cancelled
        "signers": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
    }
    
    # Add signers with their status
    for idx, signer in enumerate(session.signers):
        signer_token = str(uuid.uuid4())
        session_record["signers"].append({
            "id": str(uuid.uuid4()),
            "role": signer.get("role", "signer"),
            "name": signer.get("name", ""),
            "email": signer.get("email", ""),
            "phone": signer.get("phone", ""),
            "order": signer.get("order", idx + 1),
            "status": "pending",  # pending, sent, viewed, signed, declined
            "token": signer_token,
            "signature_id": None,
            "signed_at": None,
            "ip_address": None
        })
    
    await db.signing_sessions.insert_one(session_record)
    session_record.pop("_id", None)
    
    return session_record

# Get signing session by ID
@api_router.get("/signing-sessions/{session_id}")
async def get_signing_session(
    session_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get signing session details"""
    user = await get_current_user(credentials)
    
    session = await db.signing_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Signing session not found")
    
    return session

# Public endpoint to access signing session via token
@api_router.get("/signing-sessions/token/{token}")
async def get_signing_session_by_token(token: str):
    """Get signing session for a signer via their unique token"""
    
    session = await db.signing_sessions.find_one(
        {"signers.token": token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Signing session not found or expired")
    
    # Check if expired
    if session.get("expires_at") and datetime.fromisoformat(str(session["expires_at"]).replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Signing session has expired")
    
    # Find the signer
    signer = next((s for s in session["signers"] if s["token"] == token), None)
    if not signer:
        raise HTTPException(status_code=404, detail="Signer not found")
    
    # Check if it's their turn (based on order)
    current_order = signer["order"]
    for s in session["signers"]:
        if s["order"] < current_order and s["status"] != "signed":
            raise HTTPException(status_code=400, detail="Waiting for previous signers to complete")
    
    # Update status to viewed
    if signer["status"] == "pending" or signer["status"] == "sent":
        await db.signing_sessions.update_one(
            {"id": session["id"], "signers.token": token},
            {"$set": {"signers.$.status": "viewed"}}
        )
    
    # Return limited info (no other signer tokens)
    return {
        "session_id": session["id"],
        "document_name": session["document_name"],
        "document_type": session["document_type"],
        "status": session["status"],
        "signer": {
            "name": signer["name"],
            "role": signer["role"],
            "status": signer["status"],
            "order": signer["order"]
        },
        "total_signers": len(session["signers"]),
        "signed_count": len([s for s in session["signers"] if s["status"] == "signed"])
    }

# Sign a document in a signing session
@api_router.post("/signing-sessions/token/{token}/sign")
async def sign_document_by_token(
    token: str,
    signature: SigningSessionSign,
    request: Request
):
    """Sign a document using the signer's token"""
    
    session = await db.signing_sessions.find_one({"signers.token": token})
    if not session:
        raise HTTPException(status_code=404, detail="Signing session not found")
    
    # Find the signer
    signer_idx = next((i for i, s in enumerate(session["signers"]) if s["token"] == token), None)
    if signer_idx is None:
        raise HTTPException(status_code=404, detail="Signer not found")
    
    signer = session["signers"][signer_idx]
    
    # Check if already signed
    if signer["status"] == "signed":
        raise HTTPException(status_code=400, detail="Document already signed by this signer")
    
    # Check if it's their turn
    current_order = signer["order"]
    for s in session["signers"]:
        if s["order"] < current_order and s["status"] != "signed":
            raise HTTPException(status_code=400, detail="Waiting for previous signers")
    
    # Get IP address
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host
    
    # Create signature record
    signature_record = {
        "id": str(uuid.uuid4()),
        "user_id": None,  # No user account for token-based signing
        "signature_data": signature.signature_data,
        "signature_type": signature.signature_type,
        "signer_name": signature.signer_name,
        "signer_role": signer["role"],
        "document_id": session["document_id"],
        "document_type": session["document_type"],
        "signing_session_id": session["id"],
        "ip_address": client_ip,
        "user_agent": request.headers.get("User-Agent", ""),
        "timestamp": datetime.now(timezone.utc),
        "is_saved_template": False,
        "verified": True
    }
    
    await db.signatures.insert_one(signature_record)
    
    # Update signer status
    await db.signing_sessions.update_one(
        {"id": session["id"], "signers.token": token},
        {
            "$set": {
                f"signers.{signer_idx}.status": "signed",
                f"signers.{signer_idx}.signature_id": signature_record["id"],
                f"signers.{signer_idx}.signed_at": datetime.now(timezone.utc),
                f"signers.{signer_idx}.ip_address": client_ip,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Check if all signers have signed
    updated_session = await db.signing_sessions.find_one({"id": session["id"]})
    all_signed = all(s["status"] == "signed" for s in updated_session["signers"])
    
    if all_signed:
        await db.signing_sessions.update_one(
            {"id": session["id"]},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.signing_sessions.update_one(
            {"id": session["id"]},
            {"$set": {"status": "in_progress"}}
        )
    
    # Log audit event
    await db.system_audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": None,
        "user_email": signer.get("email", ""),
        "action": "document_signed",
        "resource_type": "signing_session",
        "resource_id": session["id"],
        "details": {
            "signer_name": signature.signer_name,
            "signer_role": signer["role"],
            "document_name": session["document_name"],
            "signature_type": signature.signature_type,
            "ip_address": client_ip,
            "all_signed": all_signed
        },
        "ip_address": client_ip,
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {
        "message": "Document signed successfully",
        "signature_id": signature_record["id"],
        "all_signed": all_signed,
        "session_status": "completed" if all_signed else "in_progress"
    }

# Get all signatures for a document
@api_router.get("/documents/{document_id}/signatures")
async def get_document_signatures(
    document_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all signatures for a document"""
    user = await get_current_user(credentials)
    
    signatures = await db.signatures.find(
        {"document_id": document_id},
        {"_id": 0, "signature_data": 0}  # Exclude large data
    ).sort("timestamp", 1).to_list(50)
    
    return signatures

# Verify a signature
@api_router.get("/signatures/{signature_id}/verify")
async def verify_signature(signature_id: str):
    """Verify a signature exists and get its details"""
    
    signature = await db.signatures.find_one(
        {"id": signature_id},
        {"_id": 0, "signature_data": 0}
    )
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    return {
        "verified": signature.get("verified", True),
        "signer_name": signature.get("signer_name"),
        "signer_role": signature.get("signer_role"),
        "timestamp": signature.get("timestamp"),
        "ip_address": signature.get("ip_address"),
        "signature_type": signature.get("signature_type"),
        "document_id": signature.get("document_id"),
        "document_type": signature.get("document_type")
    }


# System Messages
class SystemMessageCreate(BaseModel):
    key: str
    title: str
    content: Optional[str] = None
    type: str = "info"  # paragraph, header1, header2, info, warning, success, error

class SystemMessageUpdate(BaseModel):
    key: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None

@api_router.get("/dev/settings/system-messages")
async def get_system_messages(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.system_messages.find({}, {"_id": 0}).to_list(100)
    return messages

@api_router.post("/dev/settings/system-messages")
async def create_system_message(
    message: SystemMessageCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    message_dict = message.model_dump()
    message_dict["id"] = str(uuid.uuid4())
    message_dict["created_at"] = datetime.now(timezone.utc)
    message_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.system_messages.insert_one(message_dict)
    return {"message": "System message created", "id": message_dict["id"]}

@api_router.put("/dev/settings/system-messages/{message_id}")
async def update_system_message(
    message_id: str,
    message: SystemMessageUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in message.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.system_messages.update_one(
        {"id": message_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "System message updated"}

@api_router.delete("/dev/settings/system-messages/{message_id}")
async def delete_system_message(
    message_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.system_messages.delete_one({"id": message_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "System message deleted"}


# ==================== SITE TRAFFIC ANALYTICS ====================

class AnalyticsEvent(BaseModel):
    """Analytics event sent from tracking script"""
    event_type: str  # pageview, click, scroll, session_end
    page_url: str
    page_title: Optional[str] = None
    referrer: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    session_id: str
    visitor_id: str
    timestamp: Optional[str] = None
    time_on_page: Optional[int] = None  # seconds
    scroll_depth: Optional[int] = None  # percentage
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    language: Optional[str] = None
    timezone: Optional[str] = None

def get_user_agent_info(user_agent: str) -> dict:
    """Parse user agent to get browser and OS info"""
    ua = user_agent.lower()
    
    # Browser detection
    browser = "Unknown"
    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua:
        browser = "Safari"
    elif "opera" in ua or "opr" in ua:
        browser = "Opera"
    elif "msie" in ua or "trident" in ua:
        browser = "Internet Explorer"
    
    # OS detection
    os_name = "Unknown"
    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        if "android" in ua:
            os_name = "Android"
        else:
            os_name = "Linux"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    
    # Device type
    device = "Desktop"
    if "mobile" in ua or "android" in ua or "iphone" in ua:
        device = "Mobile"
    elif "tablet" in ua or "ipad" in ua:
        device = "Tablet"
    
    return {"browser": browser, "os": os_name, "device": device}

def get_country_from_ip(ip: str) -> str:
    """Get country from IP address (simplified - in production use GeoIP database)"""
    # For now, return a default. In production, integrate MaxMind GeoIP or similar
    # This is a placeholder that can be enhanced later
    if ip.startswith("127.") or ip == "localhost" or ip.startswith("192.168.") or ip.startswith("10."):
        return "Local"
    return "United States"  # Default for demo

# Public endpoint - no auth required (for tracking script)
@api_router.post("/analytics/collect")
async def collect_analytics(event: AnalyticsEvent, request: Request):
    """Collect analytics events from public pages"""
    
    # Get IP and user agent
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host
    user_agent = request.headers.get("User-Agent", "")
    
    # Parse user agent
    ua_info = get_user_agent_info(user_agent)
    country = get_country_from_ip(client_ip)
    
    # Parse page path properly
    page_path = "/"
    try:
        if event.page_url:
            url_path = event.page_url.split("?")[0]
            url_path = url_path.replace("https://", "").replace("http://", "")
            if "/" in url_path:
                page_path = "/" + url_path.split("/", 1)[1]
            else:
                page_path = "/"
    except:
        page_path = "/"
    
    # Build analytics record
    analytics_record = {
        "id": str(uuid.uuid4()),
        "event_type": event.event_type,
        "page_url": event.page_url,
        "page_path": page_path,
        "page_title": event.page_title,
        "referrer": event.referrer or "Direct",
        "utm_source": event.utm_source,
        "utm_medium": event.utm_medium,
        "utm_campaign": event.utm_campaign,
        "session_id": event.session_id,
        "visitor_id": event.visitor_id,
        "ip_hash": str(hash(client_ip))[-8:],  # Store hashed IP for privacy
        "country": country,
        "browser": ua_info["browser"],
        "os": ua_info["os"],
        "device": ua_info["device"],
        "time_on_page": event.time_on_page or 0,
        "scroll_depth": event.scroll_depth,
        "screen_width": event.screen_width,
        "screen_height": event.screen_height,
        "language": event.language,
        "timestamp": datetime.fromisoformat(event.timestamp.replace("Z", "+00:00")) if event.timestamp else datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "hour": datetime.now(timezone.utc).hour
    }
    
    await db.analytics_events.insert_one(analytics_record)
    
    # Update or create session
    if event.event_type == "pageview":
        await db.analytics_sessions.update_one(
            {"session_id": event.session_id},
            {
                "$set": {
                    "visitor_id": event.visitor_id,
                    "last_activity": datetime.now(timezone.utc),
                    "country": country,
                    "browser": ua_info["browser"],
                    "os": ua_info["os"],
                    "device": ua_info["device"]
                },
                "$inc": {"pageviews": 1},
                "$setOnInsert": {
                    "started_at": datetime.now(timezone.utc),
                    "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
                }
            },
            upsert=True
        )
    
    # Update session duration on session_end
    if event.event_type == "session_end" and event.time_on_page:
        await db.analytics_sessions.update_one(
            {"session_id": event.session_id},
            {
                "$set": {
                    "duration": event.time_on_page,
                    "ended_at": datetime.now(timezone.utc)
                }
            }
        )
    
    return {"status": "ok"}

# Analytics Dashboard Endpoints (Admin only)
@api_router.get("/analytics/realtime")
async def get_realtime_analytics(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get real-time analytics for the last 30 minutes"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    thirty_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=30)
    
    # Count active visitors (unique sessions in last 30 min)
    active_sessions = await db.analytics_sessions.distinct(
        "visitor_id",
        {"last_activity": {"$gte": thirty_mins_ago}}
    )
    
    # Get recent pageviews
    pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_mins_ago}, "event_type": "pageview"}},
        {"$group": {"_id": {"minute": {"$minute": "$timestamp"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id.minute": 1}}
    ]
    pageviews_by_minute = await db.analytics_events.aggregate(pipeline).to_list(30)
    
    return {
        "active_visitors": len(active_sessions),
        "pageviews_last_30min": sum(p["count"] for p in pageviews_by_minute),
        "chart_data": pageviews_by_minute
    }

@api_router.get("/analytics/overview")
async def get_analytics_overview(
    period: str = "today",  # today, yesterday, 7days, 30days, 90days, all
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get analytics overview for specified period"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(days=1)
        prev_end = start_date
    elif period == "yesterday":
        start_date = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(days=1)
        prev_end = start_date
    elif period == "7days":
        start_date = now - timedelta(days=7)
        prev_start = start_date - timedelta(days=7)
        prev_end = start_date
    elif period == "30days":
        start_date = now - timedelta(days=30)
        prev_start = start_date - timedelta(days=30)
        prev_end = start_date
    elif period == "90days":
        start_date = now - timedelta(days=90)
        prev_start = start_date - timedelta(days=90)
        prev_end = start_date
    else:  # all
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
        prev_start = None
        prev_end = None
    
    # Current period stats
    match_query = {"timestamp": {"$gte": start_date}, "event_type": "pageview"}
    
    # Total pageviews
    pageviews = await db.analytics_events.count_documents(match_query)
    
    # Unique visitors
    visitors = len(await db.analytics_events.distinct("visitor_id", match_query))
    
    # Previous period for comparison
    prev_pageviews = 0
    prev_visitors = 0
    if prev_start and prev_end:
        prev_match = {"timestamp": {"$gte": prev_start, "$lt": prev_end}, "event_type": "pageview"}
        prev_pageviews = await db.analytics_events.count_documents(prev_match)
        prev_visitors = len(await db.analytics_events.distinct("visitor_id", prev_match))
    
    # Calculate percentage changes
    pageview_change = ((pageviews - prev_pageviews) / prev_pageviews * 100) if prev_pageviews > 0 else 0
    visitor_change = ((visitors - prev_visitors) / prev_visitors * 100) if prev_visitors > 0 else 0
    
    # Hourly chart data (for today) or daily (for longer periods)
    if period in ["today", "yesterday"]:
        pipeline = [
            {"$match": match_query},
            {"$group": {
                "_id": {"hour": "$hour"},
                "pageviews": {"$sum": 1},
                "visitors": {"$addToSet": "$visitor_id"}
            }},
            {"$project": {
                "hour": "$_id.hour",
                "pageviews": 1,
                "visitors": {"$size": "$visitors"}
            }},
            {"$sort": {"hour": 1}}
        ]
    else:
        pipeline = [
            {"$match": match_query},
            {"$group": {
                "_id": {"date": "$date"},
                "pageviews": {"$sum": 1},
                "visitors": {"$addToSet": "$visitor_id"}
            }},
            {"$project": {
                "date": "$_id.date",
                "pageviews": 1,
                "visitors": {"$size": "$visitors"}
            }},
            {"$sort": {"date": 1}}
        ]
    
    chart_data = await db.analytics_events.aggregate(pipeline).to_list(100)
    
    # Average time on site
    session_pipeline = [
        {"$match": {"started_at": {"$gte": start_date}, "duration": {"$exists": True, "$gt": 0}}},
        {"$group": {"_id": None, "avg_duration": {"$avg": "$duration"}}}
    ]
    duration_result = await db.analytics_sessions.aggregate(session_pipeline).to_list(1)
    avg_duration = duration_result[0]["avg_duration"] if duration_result else 0
    
    return {
        "visitors": visitors,
        "pageviews": pageviews,
        "visitor_change": round(visitor_change, 1),
        "pageview_change": round(pageview_change, 1),
        "avg_time_on_site": round(avg_duration, 0),
        "chart_data": chart_data,
        "period": period
    }

@api_router.get("/analytics/pages")
async def get_top_pages(
    period: str = "today",
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get top pages by pageviews"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate start date
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "yesterday":
        start_date = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    elif period == "90days":
        start_date = now - timedelta(days=90)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "event_type": "pageview"}},
        {"$group": {
            "_id": "$page_path",
            "pageviews": {"$sum": 1},
            "visitors": {"$addToSet": "$visitor_id"}
        }},
        {"$project": {
            "url": "$_id",
            "pageviews": 1,
            "visitors": {"$size": "$visitors"}
        }},
        {"$sort": {"pageviews": -1}},
        {"$limit": limit}
    ]
    
    pages = await db.analytics_events.aggregate(pipeline).to_list(limit)
    
    # Calculate total for percentages
    total = sum(p["pageviews"] for p in pages)
    for page in pages:
        page["percentage"] = round((page["pageviews"] / total * 100) if total > 0 else 0, 1)
    
    return {"pages": pages, "total": total}

@api_router.get("/analytics/referrers")
async def get_top_referrers(
    period: str = "today",
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get top referrers"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate start date
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "event_type": "pageview"}},
        {"$group": {
            "_id": "$referrer",
            "visitors": {"$addToSet": "$visitor_id"}
        }},
        {"$project": {
            "website": "$_id",
            "visitors": {"$size": "$visitors"}
        }},
        {"$sort": {"visitors": -1}},
        {"$limit": limit}
    ]
    
    referrers = await db.analytics_events.aggregate(pipeline).to_list(limit)
    total = sum(r["visitors"] for r in referrers)
    for ref in referrers:
        ref["percentage"] = round((ref["visitors"] / total * 100) if total > 0 else 0, 1)
    
    return {"referrers": referrers, "total": total}

@api_router.get("/analytics/countries")
async def get_top_countries(
    period: str = "today",
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get visitors by country"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "event_type": "pageview"}},
        {"$group": {
            "_id": "$country",
            "visitors": {"$addToSet": "$visitor_id"}
        }},
        {"$project": {
            "name": "$_id",
            "visitors": {"$size": "$visitors"}
        }},
        {"$sort": {"visitors": -1}},
        {"$limit": limit}
    ]
    
    countries = await db.analytics_events.aggregate(pipeline).to_list(limit)
    total = sum(c["visitors"] for c in countries)
    for country in countries:
        country["percentage"] = round((country["visitors"] / total * 100) if total > 0 else 0, 1)
    
    return {"countries": countries, "total": total}

@api_router.get("/analytics/browsers")
async def get_browsers(
    period: str = "today",
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get visitors by browser"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "event_type": "pageview"}},
        {"$group": {
            "_id": "$browser",
            "visitors": {"$addToSet": "$visitor_id"}
        }},
        {"$project": {
            "name": "$_id",
            "visitors": {"$size": "$visitors"}
        }},
        {"$sort": {"visitors": -1}},
        {"$limit": limit}
    ]
    
    browsers = await db.analytics_events.aggregate(pipeline).to_list(limit)
    total = sum(b["visitors"] for b in browsers)
    for browser in browsers:
        browser["percentage"] = round((browser["visitors"] / total * 100) if total > 0 else 0, 1)
    
    return {"browsers": browsers, "total": total}

@api_router.get("/analytics/operating-systems")
async def get_operating_systems(
    period: str = "today",
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get visitors by operating system"""
    user = await get_current_user(credentials)
    if not is_admin_role(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "event_type": "pageview"}},
        {"$group": {
            "_id": "$os",
            "visitors": {"$addToSet": "$visitor_id"}
        }},
        {"$project": {
            "name": "$_id",
            "visitors": {"$size": "$visitors"}
        }},
        {"$sort": {"visitors": -1}},
        {"$limit": limit}
    ]
    
    os_list = await db.analytics_events.aggregate(pipeline).to_list(limit)
    total = sum(o["visitors"] for o in os_list)
    for os_item in os_list:
        os_item["percentage"] = round((os_item["visitors"] / total * 100) if total > 0 else 0, 1)
    
    return {"operating_systems": os_list, "total": total}

# Serve tracking script
@api_router.get("/analytics/tracker.js")
async def get_tracking_script():
    """Serve the analytics tracking script"""
    script = """
(function() {
    'use strict';
    
    // Configuration
    var API_ENDPOINT = window.ANALYTICS_ENDPOINT || '/api/analytics/collect';
    var COOKIE_NAME = '_mtm_vid';
    var SESSION_COOKIE = '_mtm_sid';
    var COOKIE_EXPIRY_DAYS = 365;
    var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    
    // Utility functions
    function generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    function setCookie(name, value, days) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
    }
    
    function getCookie(name) {
        var nameEQ = name + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    
    function getVisitorId() {
        var visitorId = getCookie(COOKIE_NAME);
        if (!visitorId) {
            visitorId = generateId();
            setCookie(COOKIE_NAME, visitorId, COOKIE_EXPIRY_DAYS);
        }
        return visitorId;
    }
    
    function getSessionId() {
        var sessionId = getCookie(SESSION_COOKIE);
        if (!sessionId) {
            sessionId = generateId();
        }
        // Refresh session cookie on activity
        setCookie(SESSION_COOKIE, sessionId, 0.5 / 24); // 30 min
        return sessionId;
    }
    
    function getUTMParams() {
        var params = new URLSearchParams(window.location.search);
        return {
            utm_source: params.get('utm_source'),
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign')
        };
    }
    
    function getReferrer() {
        var ref = document.referrer;
        if (!ref) return 'Direct, Email, SMS';
        try {
            var refUrl = new URL(ref);
            if (refUrl.hostname === window.location.hostname) return null; // Internal link
            return refUrl.hostname;
        } catch (e) {
            return ref;
        }
    }
    
    function sendEvent(eventData) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', API_ENDPOINT, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(eventData));
    }
    
    // Track pageview
    function trackPageview() {
        var utm = getUTMParams();
        var event = {
            event_type: 'pageview',
            page_url: window.location.href,
            page_title: document.title,
            referrer: getReferrer(),
            utm_source: utm.utm_source,
            utm_medium: utm.utm_medium,
            utm_campaign: utm.utm_campaign,
            session_id: getSessionId(),
            visitor_id: getVisitorId(),
            timestamp: new Date().toISOString(),
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        sendEvent(event);
    }
    
    // Track time on page
    var pageStartTime = Date.now();
    
    function trackSessionEnd() {
        var timeOnPage = Math.round((Date.now() - pageStartTime) / 1000);
        var event = {
            event_type: 'session_end',
            page_url: window.location.href,
            session_id: getSessionId(),
            visitor_id: getVisitorId(),
            timestamp: new Date().toISOString(),
            time_on_page: timeOnPage
        };
        sendEvent(event);
    }
    
    // Initialize
    if (document.readyState === 'complete') {
        trackPageview();
    } else {
        window.addEventListener('load', trackPageview);
    }
    
    // Track when user leaves
    window.addEventListener('beforeunload', trackSessionEnd);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            trackSessionEnd();
        }
    });
    
    // Expose for manual tracking
    window.mtmTrack = {
        pageview: trackPageview,
        event: function(name, data) {
            sendEvent({
                event_type: 'custom',
                event_name: name,
                event_data: data,
                page_url: window.location.href,
                session_id: getSessionId(),
                visitor_id: getVisitorId(),
                timestamp: new Date().toISOString()
            });
        }
    };
})();
"""
    return Response(
        content=script,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=3600"}
    )


# ============ SEO & SEARCH ENGINE SUBMISSION ============

from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

# Site configuration for SEO
SITE_URL = normalize_public_site_url(os.environ.get("SITE_URL", "https://medinovadme.com"))

@api_router.get("/sitemap.xml")
async def generate_sitemap():
    """Generate dynamic XML sitemap for all public pages and products"""
    
    # Create root element
    urlset = Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    urlset.set('xmlns:image', 'http://www.google.com/schemas/sitemap-image/1.1')
    
    # Helper to add URL
    def add_url(loc, changefreq='weekly', priority='0.8', lastmod=None, images=None):
        url = SubElement(urlset, 'url')
        loc_elem = SubElement(url, 'loc')
        loc_elem.text = loc
        
        if lastmod:
            lastmod_elem = SubElement(url, 'lastmod')
            lastmod_elem.text = lastmod
        
        changefreq_elem = SubElement(url, 'changefreq')
        changefreq_elem.text = changefreq
        
        priority_elem = SubElement(url, 'priority')
        priority_elem.text = priority
        
        # Add images if provided
        if images:
            for img in images:
                image = SubElement(url, 'image:image')
                image_loc = SubElement(image, 'image:loc')
                image_loc.text = img.get('url', '')
                if img.get('title'):
                    image_title = SubElement(image, 'image:title')
                    image_title.text = img['title']
    
    # Static pages
    add_url(f"{SITE_URL}/", changefreq='daily', priority='1.0')
    add_url(f"{SITE_URL}/products", changefreq='daily', priority='0.9')
    add_url(f"{SITE_URL}/locations", changefreq='weekly', priority='0.8')
    add_url(f"{SITE_URL}/medicare-resources", changefreq='weekly', priority='0.7')
    
    # Get all product categories
    categories = await db.product_categories.find({"enabled": True}).to_list(100)
    for cat in categories:
        add_url(
            f"{SITE_URL}/products?category={cat.get('slug', '')}",
            changefreq='weekly',
            priority='0.8',
            images=[{'url': cat.get('image_url', ''), 'title': cat.get('name', '')}] if cat.get('image_url') else None
        )
    
    # Get all products
    products = await db.products.find({"enabled": True}).to_list(500)
    for prod in products:
        add_url(
            f"{SITE_URL}/products/{prod.get('slug', '')}",
            changefreq='weekly',
            priority='0.7',
            lastmod=prod.get('updated_at', '')[:10] if prod.get('updated_at') else None,
            images=[{'url': prod.get('image_url', ''), 'title': prod.get('name', '')}] if prod.get('image_url') else None
        )
    
    # Get service locations (legacy)
    locations = await db.service_locations.find({"enabled": True}).to_list(100)
    for loc in locations:
        add_url(
            f"{SITE_URL}/locations/{loc.get('slug', '')}",
            changefreq='monthly',
            priority='0.6'
        )
    
    # Get all generated location pages from BOTH database AND disk
    # First, try database
    generated_pages = await db.generated_pages.find(
        {},
        {"_id": 0, "filename": 1, "location_type": 1, "generated_at": 1, "location_name": 1}
    ).to_list(50000)  # Increased limit to 50k (sitemap spec max)
    
    # If database is empty, scan the locations directory for HTML files
    if not generated_pages:
        import glob
        locations_dir = "/app/frontend/public/locations"
        html_files = glob.glob(f"{locations_dir}/*.html")
        
        for filepath in html_files:
            filename = os.path.basename(filepath)
            # Determine location type from filename pattern
            if '-county-' in filename or filename.count('-') <= 3:
                loc_type = 'county' if '-county-' in filename else 'state'
            else:
                loc_type = 'city'
            
            # Get file modification time for lastmod
            try:
                mtime = os.path.getmtime(filepath)
                from datetime import datetime
                lastmod = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
            except:
                lastmod = None
            
            generated_pages.append({
                'filename': filename,
                'location_type': loc_type,
                'generated_at': lastmod
            })
    
    for page in generated_pages:
        filename = page.get('filename', '')
        if not filename:
            continue
            
        # Priority based on location type: states > counties > cities
        loc_type = page.get('location_type', 'city')
        if loc_type == 'state':
            priority = '0.8'
        elif loc_type == 'county':
            priority = '0.6'
        else:
            priority = '0.5'
        
        # Get lastmod from generated_at
        lastmod = None
        if page.get('generated_at'):
            lastmod = page['generated_at'][:10]
        
        add_url(
            f"{SITE_URL}/locations/{filename}",
            changefreq='monthly',
            priority=priority,
            lastmod=lastmod
        )
    
    # Convert to pretty XML
    xml_str = tostring(urlset, encoding='unicode')
    pretty_xml = minidom.parseString(xml_str).toprettyxml(indent="  ")
    # Remove extra XML declaration line
    lines = pretty_xml.split('\n')
    pretty_xml = '\n'.join(lines[1:])
    
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?>\n' + pretty_xml,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"}
    )


@api_router.get("/sitemap-preview")
async def get_sitemap_preview(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Return a lightweight preview of the sitemap (first 50 URLs only) for the admin UI"""
    from xml.etree.ElementTree import Element, SubElement, tostring
    from xml.dom import minidom
    
    urlset = Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    
    def add_url(loc, changefreq='weekly', priority='0.8'):
        url = SubElement(urlset, 'url')
        SubElement(url, 'loc').text = loc
        SubElement(url, 'changefreq').text = changefreq
        SubElement(url, 'priority').text = priority
    
    # Static pages
    add_url(f"{SITE_URL}/", changefreq='daily', priority='1.0')
    add_url(f"{SITE_URL}/products", changefreq='daily', priority='0.9')
    add_url(f"{SITE_URL}/locations", changefreq='weekly', priority='0.8')
    add_url(f"{SITE_URL}/medicare-resources", changefreq='weekly', priority='0.7')
    
    # First 10 categories
    categories = await db.product_categories.find({"enabled": True}, {"_id": 0}).to_list(10)
    for cat in categories:
        if cat.get("slug"):
            add_url(f"{SITE_URL}/products?category={cat['slug']}", changefreq='weekly', priority='0.7')
    
    # First 15 products
    products = await db.products.find({"enabled": True}, {"_id": 0}).sort("sort_order", 1).to_list(15)
    for p in products:
        if p.get("slug"):
            add_url(f"{SITE_URL}/products/{p['slug']}", changefreq='weekly', priority='0.6')
    
    # First 20 location pages
    pages = await db.generated_pages.find({}, {"_id": 0, "filename": 1, "location_type": 1}).sort("location_type", 1).to_list(20)
    for page in pages:
        filename = page.get("filename", "")
        if filename:
            add_url(f"{SITE_URL}/locations/{filename}", changefreq='monthly', priority='0.7')
    
    # Count totals
    total_categories = await db.product_categories.count_documents({"enabled": True})
    total_products = await db.products.count_documents({"enabled": True})
    total_locations = await db.generated_pages.count_documents({})
    total_urls = 4 + total_categories + total_products + total_locations
    
    xml_str = tostring(urlset, encoding='unicode')
    pretty_xml = minidom.parseString(xml_str).toprettyxml(indent="  ")
    lines = pretty_xml.split('\n')
    preview_xml = '\n'.join(lines[1:])
    preview_xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + preview_xml
    preview_xml += f"\n\n<!-- PREVIEW: Showing sample of {len(list(urlset))} URLs out of {total_urls} total -->"
    
    return {"preview": preview_xml, "total_urls": total_urls}
@api_router.get("/robots.txt")
async def get_robots_txt():
    """Generate robots.txt with sitemap reference"""
    robots = f"""User-agent: *
Allow: /
Allow: /products
Allow: /locations
Allow: /medicare-resources

Disallow: /dashboard
Disallow: /admin-settings
Disallow: /dev-settings
Disallow: /api/
Disallow: /login
Disallow: /*?*

Sitemap: {SITE_URL}/sitemap.xml
"""
    return Response(content=robots, media_type="text/plain")


@api_router.post("/seo/submit-to-search-engines")
async def submit_to_search_engines(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Submit sitemap to all major US search engines"""
    
    sitemap_url = f"{SITE_URL}/sitemap.xml"
    
    # US Search Engines that accept sitemap pings
    search_engines = [
        {
            "name": "Google",
            "ping_url": f"https://www.google.com/ping?sitemap={sitemap_url}",
            "webmaster_url": "https://search.google.com/search-console"
        },
        {
            "name": "Bing",
            "ping_url": f"https://www.bing.com/ping?sitemap={sitemap_url}",
            "webmaster_url": "https://www.bing.com/webmasters"
        },
        {
            "name": "IndexNow (Bing/Yandex/DuckDuckGo)",
            "ping_url": f"https://www.bing.com/indexnow?url={SITE_URL}&key=dmecrm2024",
            "webmaster_url": "https://www.indexnow.org"
        },
        {
            "name": "Brave",
            "ping_url": f"https://search.brave.com/submit-url?url={SITE_URL}/sitemap.xml",
            "webmaster_url": "https://search.brave.com/submit-url"
        }
    ]
    
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for engine in search_engines:
            try:
                response = await client.get(engine["ping_url"])
                results.append({
                    "engine": engine["name"],
                    "status": "success" if response.status_code in [200, 202, 204, 404, 410] else "error",
                    "status_code": response.status_code,
                    "ping_url": engine["ping_url"],
                    "webmaster_url": engine["webmaster_url"],
                    "message": "Sitemap ping sent" if response.status_code in [200, 202, 204, 404, 410] else f"Response: {response.status_code}"
                })
            except Exception as e:
                results.append({
                    "engine": engine["name"],
                    "status": "error",
                    "status_code": 0,
                    "ping_url": engine["ping_url"],
                    "webmaster_url": engine["webmaster_url"],
                    "message": str(e)
                })
    
    # Log the submission
    await db.system_audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "seo_submission",
        "entity_type": "sitemap",
        "entity_id": sitemap_url,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "details": {"results": results},
        "ip_address": "system",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Sitemap submission completed",
        "sitemap_url": sitemap_url,
        "results": results,
        "recommendations": [
            "For best results, verify your site in Google Search Console",
            "Submit your sitemap manually in Bing Webmaster Tools",
            "Ensure your robots.txt allows search engine crawlers",
            "Add structured data (Schema.org) to product pages for rich snippets"
        ]
    }


@api_router.get("/seo/status")
async def get_seo_status(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get current SEO status and statistics"""
    
    # Count indexed content
    categories_count = await db.product_categories.count_documents({"enabled": True})
    products_count = await db.products.count_documents({"enabled": True})
    
    # Count location pages - both legacy service_locations AND generated_pages
    legacy_locations = await db.service_locations.count_documents({"enabled": True})
    generated_locations = await db.generated_pages.count_documents({})
    locations_count = legacy_locations + generated_locations
    
    # Breakdown of generated pages by type
    generated_states = await db.generated_pages.count_documents({"location_type": "state"})
    generated_counties = await db.generated_pages.count_documents({"location_type": "county"})
    generated_cities = await db.generated_pages.count_documents({"location_type": "city"})
    
    # Products with SEO fields filled
    products_with_seo = await db.products.count_documents({
        "enabled": True,
        "meta_title": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    # Get last submission
    last_submission = await db.system_audit_log.find_one(
        {"action": "seo_submission"},
        sort=[("timestamp", -1)]
    )
    
    return {
        "sitemap_url": f"{SITE_URL}/sitemap.xml",
        "robots_url": f"{SITE_URL}/robots.txt",
        "indexed_pages": {
            "static_pages": 4,
            "categories": categories_count,
            "products": products_count,
            "locations": locations_count,
            "generated_pages": {
                "total": generated_locations,
                "states": generated_states,
                "counties": generated_counties,
                "cities": generated_cities
            },
            "total": 4 + categories_count + products_count + locations_count
        },
        "seo_completion": {
            "products_with_meta": products_with_seo,
            "products_total": products_count,
            "percentage": round((products_with_seo / products_count * 100) if products_count > 0 else 0, 1)
        },
        "last_submission": {
            "timestamp": last_submission.get("timestamp") if last_submission else None,
            "user": last_submission.get("user_email") if last_submission else None
        } if last_submission else None,
        "search_engines": [
            {"name": "Google", "webmaster_url": "https://search.google.com/search-console"},
            {"name": "Bing", "webmaster_url": "https://www.bing.com/webmasters"},
            {"name": "DuckDuckGo", "note": "Uses Bing index"},
            {"name": "Yahoo", "note": "Uses Bing index"},
            {"name": "Brave", "webmaster_url": "https://search.brave.com/submit-url"}
        ]
    }


# ==================== DIRECTORY SUBMISSION TOOL ====================

# Comprehensive list of free US business directories
FREE_US_DIRECTORIES = [
    # Major Search & Maps
    {"id": "google_business", "name": "Google Business Profile", "url": "https://business.google.com", "category": "Search & Maps", "priority": 1, "description": "Essential for local SEO and Google Maps visibility"},
    {"id": "bing_places", "name": "Bing Places for Business", "url": "https://www.bingplaces.com", "category": "Search & Maps", "priority": 1, "description": "Powers Bing, Yahoo, and DuckDuckGo local results"},
    {"id": "apple_maps", "name": "Apple Maps Connect", "url": "https://mapsconnect.apple.com", "category": "Search & Maps", "priority": 1, "description": "Essential for iPhone/iPad users"},
    
    # Social & Reviews
    {"id": "facebook", "name": "Facebook Business Page", "url": "https://business.facebook.com", "category": "Social & Reviews", "priority": 1, "description": "Largest social platform, important for visibility"},
    {"id": "yelp", "name": "Yelp for Business", "url": "https://biz.yelp.com", "category": "Social & Reviews", "priority": 1, "description": "Major review platform, high domain authority"},
    {"id": "nextdoor", "name": "Nextdoor Business", "url": "https://business.nextdoor.com", "category": "Social & Reviews", "priority": 2, "description": "Neighborhood-focused community platform"},
    {"id": "bbb", "name": "Better Business Bureau", "url": "https://www.bbb.org/get-accredited", "category": "Social & Reviews", "priority": 2, "description": "Trust signal, may have fees for accreditation"},
    
    # General Business Directories
    {"id": "yellowpages", "name": "Yellow Pages", "url": "https://www.yellowpages.com/about/get-listed", "category": "General Directories", "priority": 2, "description": "Classic business directory with high DA"},
    {"id": "whitepages", "name": "White Pages", "url": "https://www.whitepages.com", "category": "General Directories", "priority": 3, "description": "Business and people directory"},
    {"id": "superpages", "name": "Superpages", "url": "https://www.superpages.com", "category": "General Directories", "priority": 3, "description": "Part of Yellow Pages network"},
    {"id": "manta", "name": "Manta", "url": "https://www.manta.com/claim", "category": "General Directories", "priority": 2, "description": "Small business directory"},
    {"id": "hotfrog", "name": "Hotfrog", "url": "https://www.hotfrog.com", "category": "General Directories", "priority": 3, "description": "Free business listings"},
    {"id": "brownbook", "name": "Brownbook", "url": "https://www.brownbook.net", "category": "General Directories", "priority": 3, "description": "Global business directory"},
    {"id": "cylex", "name": "Cylex", "url": "https://www.cylex.us.com", "category": "General Directories", "priority": 3, "description": "US business directory"},
    {"id": "ezlocal", "name": "EZlocal", "url": "https://www.ezlocal.com", "category": "General Directories", "priority": 3, "description": "Local business listings"},
    {"id": "chamberofcommerce", "name": "Chamber of Commerce", "url": "https://www.chamberofcommerce.com", "category": "General Directories", "priority": 2, "description": "Business community directory"},
    
    # Local & Maps
    {"id": "mapquest", "name": "MapQuest", "url": "https://www.mapquest.com/my-business", "category": "Local & Maps", "priority": 2, "description": "Navigation and local search"},
    {"id": "foursquare", "name": "Foursquare", "url": "https://business.foursquare.com", "category": "Local & Maps", "priority": 2, "description": "Powers many apps and platforms"},
    {"id": "here", "name": "HERE WeGo", "url": "https://wego.here.com", "category": "Local & Maps", "priority": 3, "description": "Navigation platform"},
    {"id": "tomtom", "name": "TomTom Places", "url": "https://www.tomtom.com/products/places", "category": "Local & Maps", "priority": 3, "description": "GPS and navigation data"},
    
    # Healthcare Specific
    {"id": "healthgrades", "name": "Healthgrades", "url": "https://update.healthgrades.com", "category": "Healthcare", "priority": 1, "description": "Major healthcare provider directory"},
    {"id": "vitals", "name": "Vitals", "url": "https://www.vitals.com/about/providers", "category": "Healthcare", "priority": 2, "description": "Doctor and healthcare reviews"},
    {"id": "zocdoc", "name": "Zocdoc", "url": "https://www.zocdoc.com/join", "category": "Healthcare", "priority": 2, "description": "Healthcare appointment booking"},
    {"id": "webmd", "name": "WebMD Provider Directory", "url": "https://doctor.webmd.com/providers", "category": "Healthcare", "priority": 2, "description": "Major health information site"},
    {"id": "wellness", "name": "Wellness.com", "url": "https://www.wellness.com", "category": "Healthcare", "priority": 3, "description": "Health and wellness directory"},
    {"id": "caredash", "name": "CareDash", "url": "https://www.caredash.com", "category": "Healthcare", "priority": 3, "description": "Healthcare provider reviews"},
    {"id": "sharecare", "name": "Sharecare", "url": "https://www.sharecare.com", "category": "Healthcare", "priority": 3, "description": "Health engagement platform"},
    {"id": "dmelocator", "name": "DME Locator", "url": "https://www.yellowpages.com/search?search_terms=durable+medical+equipment", "category": "Healthcare", "priority": 2, "description": "Find DME suppliers"},
    
    # Data Aggregators
    {"id": "datafaxon", "name": "Data Axle (InfoUSA)", "url": "https://www.dataaxle.com", "category": "Data Aggregators", "priority": 2, "description": "Major data aggregator - feeds many directories"},
    {"id": "neustar", "name": "Neustar Localeze", "url": "https://www.neustarlocaleze.biz", "category": "Data Aggregators", "priority": 2, "description": "Powers many local search platforms"},
    {"id": "factual", "name": "Factual (Foursquare)", "url": "https://www.foursquare.com/products/places", "category": "Data Aggregators", "priority": 2, "description": "Location data platform"},
    
    # Industry Directories
    {"id": "thumbtack", "name": "Thumbtack", "url": "https://www.thumbtack.com/pro", "category": "Industry", "priority": 2, "description": "Service professional directory"},
    {"id": "angieslist", "name": "Angi (Angie's List)", "url": "https://www.angi.com/pro", "category": "Industry", "priority": 2, "description": "Home services but includes medical equipment"},
    {"id": "homeadvisor", "name": "HomeAdvisor", "url": "https://pro.homeadvisor.com", "category": "Industry", "priority": 3, "description": "Service professional matching"},
    
    # Local Community
    {"id": "local", "name": "Local.com", "url": "https://www.local.com", "category": "Local Community", "priority": 3, "description": "Local business search"},
    {"id": "showmelocal", "name": "ShowMeLocal", "url": "https://www.showmelocal.com", "category": "Local Community", "priority": 3, "description": "Local business listings"},
    {"id": "merchantcircle", "name": "MerchantCircle", "url": "https://www.merchantcircle.com", "category": "Local Community", "priority": 3, "description": "Small business networking"},
    {"id": "citysearch", "name": "Citysearch", "url": "https://www.citysearch.com", "category": "Local Community", "priority": 3, "description": "City-based business directory"},
    {"id": "judysbook", "name": "Judy's Book", "url": "https://www.judysbook.com", "category": "Local Community", "priority": 3, "description": "Local business reviews"},
    {"id": "tupalo", "name": "Tupalo", "url": "https://www.tupalo.co", "category": "Local Community", "priority": 3, "description": "Business discovery platform"},
    {"id": "yellowbot", "name": "YellowBot", "url": "https://www.yellowbot.com", "category": "Local Community", "priority": 3, "description": "Local search engine"},
    
    # Additional Free Directories
    {"id": "spoke", "name": "Spoke", "url": "https://www.spoke.com", "category": "Business Profiles", "priority": 3, "description": "Business profiles and info"},
    {"id": "corporationwiki", "name": "CorporationWiki", "url": "https://www.corporationwiki.com", "category": "Business Profiles", "priority": 3, "description": "Business relationships database"},
    {"id": "buzzfile", "name": "Buzzfile", "url": "https://www.buzzfile.com", "category": "Business Profiles", "priority": 3, "description": "Company information database"},
    {"id": "dnb", "name": "Dun & Bradstreet", "url": "https://www.dnb.com/duns-number/get-a-duns.html", "category": "Business Profiles", "priority": 2, "description": "Get a D-U-N-S number for credibility"},
    {"id": "linkedin", "name": "LinkedIn Company Page", "url": "https://www.linkedin.com/company/setup/new", "category": "Social & Reviews", "priority": 1, "description": "Professional network, important for B2B"},
    {"id": "crunchbase", "name": "Crunchbase", "url": "https://www.crunchbase.com", "category": "Business Profiles", "priority": 3, "description": "Business and startup database"},
]


class DirectoryStatus(str, Enum):
    NOT_SUBMITTED = "not_submitted"
    SUBMITTED = "submitted"
    PENDING = "pending_verification"
    VERIFIED = "verified"
    NEEDS_UPDATE = "needs_update"
    REJECTED = "rejected"


class DirectorySubmission(BaseModel):
    directory_id: str
    status: DirectoryStatus = DirectoryStatus.NOT_SUBMITTED
    submitted_date: Optional[str] = None
    verified_date: Optional[str] = None
    listing_url: Optional[str] = None
    username: Optional[str] = None
    notes: Optional[str] = None


@api_router.get("/directories")
async def get_directories(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get all directories with submission status"""
    
    # Get all submissions from database
    submissions = await db.directory_submissions.find({}, {"_id": 0}).to_list(100)
    submissions_map = {s["directory_id"]: s for s in submissions}
    
    # Merge directory info with submission status
    result = []
    for directory in FREE_US_DIRECTORIES:
        submission = submissions_map.get(directory["id"], {})
        result.append({
            **directory,
            "status": submission.get("status", DirectoryStatus.NOT_SUBMITTED.value),
            "submitted_date": submission.get("submitted_date"),
            "verified_date": submission.get("verified_date"),
            "listing_url": submission.get("listing_url"),
            "username": submission.get("username"),
            "notes": submission.get("notes")
        })
    
    return result


@api_router.get("/directories/stats")
async def get_directory_stats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get directory submission statistics"""
    
    total_directories = len(FREE_US_DIRECTORIES)
    submissions = await db.directory_submissions.find({}, {"_id": 0}).to_list(100)
    
    stats = {
        "total": total_directories,
        "not_submitted": total_directories,
        "submitted": 0,
        "pending": 0,
        "verified": 0,
        "needs_update": 0,
        "rejected": 0,
        "by_category": {},
        "by_priority": {1: 0, 2: 0, 3: 0}
    }
    
    # Count by status
    for sub in submissions:
        status = sub.get("status", "not_submitted")
        if status == "submitted":
            stats["submitted"] += 1
            stats["not_submitted"] -= 1
        elif status == "pending_verification":
            stats["pending"] += 1
            stats["not_submitted"] -= 1
        elif status == "verified":
            stats["verified"] += 1
            stats["not_submitted"] -= 1
        elif status == "needs_update":
            stats["needs_update"] += 1
            stats["not_submitted"] -= 1
        elif status == "rejected":
            stats["rejected"] += 1
            stats["not_submitted"] -= 1
    
    # Count by category
    for directory in FREE_US_DIRECTORIES:
        cat = directory["category"]
        if cat not in stats["by_category"]:
            stats["by_category"][cat] = {"total": 0, "submitted": 0}
        stats["by_category"][cat]["total"] += 1
        
        # Check if submitted
        sub = next((s for s in submissions if s["directory_id"] == directory["id"]), None)
        if sub and sub.get("status") in ["submitted", "pending_verification", "verified"]:
            stats["by_category"][cat]["submitted"] += 1
    
    # Calculate completion percentage
    completed = stats["submitted"] + stats["pending"] + stats["verified"]
    stats["completion_percentage"] = round((completed / total_directories) * 100, 1) if total_directories > 0 else 0
    
    return stats


@api_router.put("/directories/{directory_id}")
async def update_directory_submission(
    directory_id: str,
    submission: DirectorySubmission,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Update directory submission status"""
    
    # Verify directory exists
    directory = next((d for d in FREE_US_DIRECTORIES if d["id"] == directory_id), None)
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    submission_doc = {
        "directory_id": directory_id,
        "status": submission.status.value if isinstance(submission.status, DirectoryStatus) else submission.status,
        "submitted_date": submission.submitted_date,
        "verified_date": submission.verified_date,
        "listing_url": submission.listing_url,
        "username": submission.username,
        "notes": submission.notes,
        "updated_at": now,
        "updated_by": current_user["id"]
    }
    
    # Set submitted_date if status changed to submitted
    if submission.status in [DirectoryStatus.SUBMITTED, "submitted"] and not submission.submitted_date:
        submission_doc["submitted_date"] = now
    
    # Set verified_date if status changed to verified
    if submission.status in [DirectoryStatus.VERIFIED, "verified"] and not submission.verified_date:
        submission_doc["verified_date"] = now
    
    await db.directory_submissions.update_one(
        {"directory_id": directory_id},
        {"$set": submission_doc},
        upsert=True
    )
    
    await log_audit(
        current_user["id"],
        current_user["email"],
        "DIRECTORY_SUBMISSION_UPDATED",
        "directory_submissions",
        directory_id,
        details={"status": submission_doc["status"], "directory": directory["name"]}
    )
    
    return {"message": f"Directory submission updated for {directory['name']}"}


class BulkDirectoryUpdate(BaseModel):
    directory_ids: List[str]
    status: str


@api_router.post("/directories/bulk-update")
async def bulk_update_directories(
    data: BulkDirectoryUpdate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Bulk update directory submission status"""
    
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    
    for directory_id in data.directory_ids:
        directory = next((d for d in FREE_US_DIRECTORIES if d["id"] == directory_id), None)
        if directory:
            submission_doc = {
                "directory_id": directory_id,
                "status": data.status,
                "updated_at": now,
                "updated_by": current_user["id"]
            }
            
            if data.status == "submitted":
                submission_doc["submitted_date"] = now
            elif data.status == "verified":
                submission_doc["verified_date"] = now
            
            await db.directory_submissions.update_one(
                {"directory_id": directory_id},
                {"$set": submission_doc},
                upsert=True
            )
            updated += 1
    
    return {"message": f"Updated {updated} directory submissions"}


@api_router.get("/directories/export")
async def export_directory_submissions(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Export directory submissions as CSV data"""
    
    submissions = await db.directory_submissions.find({}, {"_id": 0}).to_list(100)
    submissions_map = {s["directory_id"]: s for s in submissions}
    
    csv_data = "Directory,Category,Priority,Status,Submitted Date,Verified Date,Listing URL,Notes\n"
    
    for directory in FREE_US_DIRECTORIES:
        submission = submissions_map.get(directory["id"], {})
        row = [
            directory["name"],
            directory["category"],
            str(directory["priority"]),
            submission.get("status") or "not_submitted",
            submission.get("submitted_date") or "",
            submission.get("verified_date") or "",
            submission.get("listing_url") or "",
            (submission.get("notes") or "").replace(",", ";").replace("\n", " ")
        ]
        csv_data += ",".join(row) + "\n"
    
    return {"csv_data": csv_data, "filename": f"directory_submissions_{datetime.now().strftime('%Y%m%d')}.csv"}


# ==================== FAX ENDPOINTS (TELNYX INTEGRATION) ====================

def normalize_fax_number(raw_number: str) -> str:
    """Normalize fax numbers to E.164 format for Telnyx"""
    # Remove common formatting characters
    cleaned = re.sub(r'[\s\-\(\)\.]', '', raw_number)
    
    # Handle already-formatted numbers
    if cleaned.startswith("+"):
        return cleaned
    
    # Remove leading 1 if present, we'll add it back with +
    if cleaned.startswith("1") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    
    # North American numbers should be 10 digits
    if len(cleaned) == 10:
        return f"+1{cleaned}"
    
    # If it's already 11 digits starting with 1
    if len(cleaned) == 11 and cleaned.startswith("1"):
        return f"+{cleaned}"
    
    # Return as-is with + prefix if we can't normalize
    return f"+{cleaned}" if not cleaned.startswith("+") else cleaned


async def get_fax_settings():
    """Get fax settings from database"""
    settings = await db.site_settings.find_one({"type": "fax_settings"}, {"_id": 0})
    return settings


def create_fax_file_access_token(file_id: str, expires_in_seconds: int = 900) -> str:
    payload = {
        "type": "fax_secure_file",
        "file_id": file_id,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def build_https_base_url(raw_request: Request) -> str:
    forwarded_host = raw_request.headers.get("x-forwarded-host") or raw_request.headers.get("host")
    forwarded_proto = raw_request.headers.get("x-forwarded-proto", "https")
    if forwarded_host:
        protocol = "https" if forwarded_proto.lower() != "http" else "http"
        return f"{protocol}://{forwarded_host}".rstrip("/")

    base_url = str(raw_request.base_url).rstrip("/")
    if base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://", 1)
    return base_url


@api_router.post("/fax/upload-secure")
async def upload_secure_fax_document(
    raw_request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload fax document encrypted-at-rest and return short-lived signed download URL."""
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/tiff"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Please upload a PDF, PNG, JPG, or TIFF file")

    file_data = await file.read()
    max_size = 10 * 1024 * 1024
    if len(file_data) > max_size:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")

    file_id = str(uuid.uuid4())
    encrypted_bytes = FAX_ENCRYPTION_CIPHER.encrypt(file_data)
    encrypted_filename = f"{Path(file.filename).stem}.enc"

    storage_backend = "cloud"
    storage_key_encrypted = None
    local_path_encrypted = None

    success, upload_result = await StorageService.upload_file(
        file_data=encrypted_bytes,
        filename=encrypted_filename,
        content_type="application/octet-stream",
        folder="fax-secure"
    )

    if success:
        storage_key_encrypted = encrypt_fax_value(upload_result.get("key"))
    else:
        # Fallback to encrypted local file storage when cloud storage is not configured
        fallback_dir = Path("/tmp/dme_fax_secure")
        fallback_dir.mkdir(parents=True, exist_ok=True)
        fallback_path = fallback_dir / f"{file_id}.enc"
        fallback_path.write_bytes(encrypted_bytes)
        storage_backend = "local_fallback"
        local_path_encrypted = encrypt_fax_value(str(fallback_path))

    expires_in = 900
    access_token = create_fax_file_access_token(file_id=file_id, expires_in_seconds=expires_in)
    base_url = build_https_base_url(raw_request)
    signed_url = f"{base_url}/api/fax/files/{file_id}/download?token={access_token}"

    now = datetime.now(timezone.utc).isoformat()
    await db.fax_secure_files.insert_one({
        "id": file_id,
        "storage_backend": storage_backend,
        "storage_key_encrypted": storage_key_encrypted,
        "local_path_encrypted": local_path_encrypted,
        "original_filename_encrypted": encrypt_fax_value(file.filename),
        "content_type": file.content_type,
        "size": len(file_data),
        "uploaded_by": current_user.get("id"),
        "uploaded_by_email": current_user.get("email"),
        "created_at": now,
        "updated_at": now,
    })

    await log_audit(
        current_user["id"],
        current_user["email"],
        "FAX_SECURE_FILE_UPLOADED",
        "fax_files",
        file_id,
        details={"filename": file.filename, "size": len(file_data), "expires_in": expires_in, "storage_backend": storage_backend},
        ip_address=raw_request.client.host if raw_request.client else None,
    )

    return {
        "file_id": file_id,
        "file_url": signed_url,
        "expires_in": expires_in,
        "filename": file.filename,
        "size": len(file_data),
    }


@api_router.get("/fax/files/{file_id}/signed-url")
async def refresh_fax_secure_file_signed_url(
    file_id: str,
    raw_request: Request,
    expires_in: int = Query(900, ge=60, le=3600),
    current_user: dict = Depends(get_current_user)
):
    """Refresh short-lived signed URL for secure fax file."""
    secure_file = await db.fax_secure_files.find_one({"id": file_id}, {"_id": 0})
    if not secure_file:
        raise HTTPException(status_code=404, detail="Secure fax file not found")

    access_token = create_fax_file_access_token(file_id=file_id, expires_in_seconds=expires_in)
    base_url = build_https_base_url(raw_request)
    signed_url = f"{base_url}/api/fax/files/{file_id}/download?token={access_token}"

    return {"file_id": file_id, "file_url": signed_url, "expires_in": expires_in}


@api_router.get("/fax/files/{file_id}/download")
async def download_secure_fax_file(file_id: str, token: str = Query(...)):
    """Download encrypted fax file using a short-lived signed token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Secure file link has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid secure file token")

    if payload.get("type") != "fax_secure_file" or payload.get("file_id") != file_id:
        raise HTTPException(status_code=401, detail="Invalid secure file token")

    secure_file = await db.fax_secure_files.find_one({"id": file_id}, {"_id": 0})
    if not secure_file:
        raise HTTPException(status_code=404, detail="Secure fax file not found")

    storage_backend = secure_file.get("storage_backend") or "cloud"
    encrypted_bytes = None

    if storage_backend == "local_fallback":
        local_path = decrypt_fax_value(secure_file.get("local_path_encrypted"))
        if not local_path or not Path(local_path).exists():
            raise HTTPException(status_code=404, detail="Secure local fax file not found")
        encrypted_bytes = Path(local_path).read_bytes()
    else:
        storage_key = decrypt_fax_value(secure_file.get("storage_key_encrypted"))
        if not storage_key:
            raise HTTPException(status_code=500, detail="Secure file metadata is corrupted")

        success, result = await StorageService.get_file(storage_key)
        if not success:
            raise HTTPException(status_code=404, detail=result)
        encrypted_bytes = result.get("data")

    try:
        decrypted_bytes = FAX_ENCRYPTION_CIPHER.decrypt(encrypted_bytes)
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Unable to decrypt secure fax file")

    original_filename = decrypt_fax_value(secure_file.get("original_filename_encrypted")) or f"fax-{file_id}.bin"
    content_type = secure_file.get("content_type") or "application/octet-stream"

    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{original_filename}"'}
    )


@api_router.get("/fax/settings")
async def get_fax_settings_endpoint(current_user: dict = Depends(get_current_user)):
    """Get current fax settings (admin only)"""
    if not is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await get_fax_settings()
    
    if not settings:
        return FaxSettingsResponse(
            is_configured=False,
            is_enabled=False,
            has_api_key=False,
            has_connection_id=False
        )
    
    return FaxSettingsResponse(
        is_configured=bool(settings.get("telnyx_api_key") and settings.get("telnyx_fax_number")),
        is_enabled=settings.get("is_enabled", False),
        fax_number=settings.get("telnyx_fax_number"),
        has_api_key=bool(settings.get("telnyx_api_key")),
        has_connection_id=bool(settings.get("telnyx_connection_id")),
        webhook_url=settings.get("webhook_url"),
        caller_name=settings.get("caller_name"),
        updated_at=settings.get("updated_at")
    )


@api_router.post("/fax/settings")
async def update_fax_settings(
    request: FaxSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update fax settings (admin only)"""
    if not is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Build update dict, only including non-None values
    update_data = {"type": "fax_settings", "updated_at": now, "updated_by": current_user["id"]}
    
    if request.telnyx_api_key is not None:
        update_data["telnyx_api_key"] = request.telnyx_api_key
    if request.telnyx_fax_number is not None:
        update_data["telnyx_fax_number"] = request.telnyx_fax_number
    if request.telnyx_connection_id is not None:
        update_data["telnyx_connection_id"] = request.telnyx_connection_id
    if request.webhook_url is not None:
        update_data["webhook_url"] = request.webhook_url
    if request.is_enabled is not None:
        update_data["is_enabled"] = request.is_enabled
    if request.caller_name is not None:
        # Truncate CNAM to 15 characters (Telnyx limit)
        update_data["caller_name"] = request.caller_name[:15] if request.caller_name else ""
    
    await db.site_settings.update_one(
        {"type": "fax_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_audit(
        current_user["id"], current_user["email"],
        "FAX_SETTINGS_UPDATED", "settings", None,
        details={"fields_updated": list(update_data.keys())}
    )
    
    return {"message": "Fax settings updated successfully"}


@api_router.post("/fax/test-connection")
async def test_fax_connection(current_user: dict = Depends(get_current_user)):
    """Test Telnyx API connection (admin only)"""
    if not is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await get_fax_settings()
    
    if not settings or not settings.get("telnyx_api_key"):
        raise HTTPException(status_code=400, detail="Telnyx API key not configured")
    
    api_key = settings["telnyx_api_key"]
    
    try:
        async with httpx.AsyncClient() as client:
            # Test connection by getting account balance
            response = await client.get(
                "https://api.telnyx.com/v2/balance",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message": "Connection successful",
                    "balance": data.get("data", {}).get("balance"),
                    "currency": data.get("data", {}).get("currency")
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "message": "Invalid API key - authentication failed"
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed with status {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "success": False,
            "message": "Connection timed out - please try again"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection error: {str(e)}"
        }


@api_router.post("/fax/send")
async def send_fax(
    request: SendFaxRequest,
    raw_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Send a fax via Telnyx"""
    settings = await get_fax_settings()
    
    if not settings or not settings.get("is_enabled"):
        raise HTTPException(status_code=400, detail="Fax service is not enabled")
    
    if not settings.get("telnyx_api_key") or not settings.get("telnyx_fax_number"):
        raise HTTPException(status_code=400, detail="Fax service is not properly configured")
    
    api_key = settings["telnyx_api_key"]
    from_number = settings["telnyx_fax_number"]
    connection_id = settings.get("telnyx_connection_id")
    caller_name = settings.get("caller_name")
    
    # Normalize the recipient fax number
    to_number = normalize_fax_number(request.recipient_fax_number)

    if not str(request.file_url).lower().startswith("https://"):
        raise HTTPException(status_code=422, detail="Document URL must use HTTPS")
    
    now = datetime.now(timezone.utc)
    fax_record_id = str(uuid.uuid4())
    
    # Build Telnyx API payload
    fax_payload = {
        "connection_id": connection_id,
        "to": to_number,
        "from": from_number,
        "media_url": request.file_url,
        "quality": "high"
    }
    
    # Add caller name (CNAM) if configured
    if caller_name:
        fax_payload["from_display_name"] = caller_name
    
    # Remove connection_id if not set
    if not connection_id:
        del fax_payload["connection_id"]
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.telnyx.com/v2/faxes",
                json=fax_payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
            
            if response.status_code in (200, 202):
                data = response.json()
                telnyx_fax_id = data.get("data", {}).get("id", fax_record_id)
                
                # Store fax record in database
                fax_record = {
                    "id": fax_record_id,
                    "fax_id": telnyx_fax_id,
                    "recipient_name_encrypted": encrypt_fax_value(request.recipient_name),
                    "recipient_fax_number_encrypted": encrypt_fax_value(to_number),
                    "recipient_fax_number_masked": mask_fax_number(to_number),
                    "document_type": request.document_type.value,
                    "file_url_encrypted": encrypt_fax_value(request.file_url),
                    "notes_encrypted": encrypt_fax_value(request.notes),
                    "patient_id": request.patient_id,
                    "order_id": request.order_id,
                    "status": FaxStatus.QUEUED.value,
                    "sent_by": current_user["id"],
                    "sent_by_email": current_user["email"],
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
                
                await db.faxes.insert_one(fax_record)

                await log_fax_transmission_audit(
                    event_type="FAX_SEND_QUEUED",
                    fax_record_id=fax_record_id,
                    fax_id=telnyx_fax_id,
                    transmission_status=FaxStatus.QUEUED.value,
                    sender_user_id=current_user.get("id"),
                    sender_email=current_user.get("email"),
                    recipient_name=request.recipient_name,
                    recipient_fax_number=to_number,
                    triggered_by="user",
                    details={
                        "document_type": request.document_type.value,
                        "patient_id": request.patient_id,
                        "order_id": request.order_id,
                    },
                    ip_address=raw_request.client.host if raw_request.client else None,
                )
                
                await log_audit(
                    current_user["id"], current_user["email"],
                    "FAX_SENT", "fax", fax_record_id,
                    details={
                        "recipient": request.recipient_name,
                        "fax_number": mask_fax_number(to_number),
                        "telnyx_fax_id": telnyx_fax_id
                    }
                )
                
                return FaxResponse(
                    fax_id=telnyx_fax_id,
                    status=FaxStatus.QUEUED,
                    recipient_fax_number=mask_fax_number(to_number) or to_number,
                    recipient_name=request.recipient_name,
                    document_type=request.document_type.value,
                    created_at=now.isoformat(),
                    message="Fax queued for delivery"
                )
            else:
                error_detail = response.json() if response.content else {}
                error_msg = error_detail.get("errors", [{}])[0].get("detail", f"Status {response.status_code}")
                
                # Log failed attempt
                fax_record = {
                    "id": fax_record_id,
                    "fax_id": None,
                    "recipient_name_encrypted": encrypt_fax_value(request.recipient_name),
                    "recipient_fax_number_encrypted": encrypt_fax_value(to_number),
                    "recipient_fax_number_masked": mask_fax_number(to_number),
                    "document_type": request.document_type.value,
                    "file_url_encrypted": encrypt_fax_value(request.file_url),
                    "notes_encrypted": encrypt_fax_value(request.notes),
                    "status": FaxStatus.FAILED.value,
                    "failure_reason": error_msg,
                    "sent_by": current_user["id"],
                    "sent_by_email": current_user["email"],
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
                await db.faxes.insert_one(fax_record)

                await log_fax_transmission_audit(
                    event_type="FAX_SEND_FAILED",
                    fax_record_id=fax_record_id,
                    fax_id=None,
                    transmission_status=FaxStatus.FAILED.value,
                    sender_user_id=current_user.get("id"),
                    sender_email=current_user.get("email"),
                    recipient_name=request.recipient_name,
                    recipient_fax_number=to_number,
                    triggered_by="user",
                    details={"failure_reason": error_msg},
                    ip_address=raw_request.client.host if raw_request.client else None,
                )
                
                raise HTTPException(status_code=response.status_code, detail=f"Telnyx error: {error_msg}")
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Telnyx API request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Telnyx: {str(e)}")


@api_router.post("/fax/cover-page")
async def generate_fax_cover_page(
    request: FaxCoverPageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a HIPAA-compliant fax cover page PDF and return it as base64"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    import io
    import base64
    
    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = []
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=6,
        textColor=colors.HexColor('#1e3a5f')
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#374151'),
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=4
    )
    
    urgent_style = ParagraphStyle(
        'UrgentStyle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.red,
        alignment=1,
        spaceBefore=10,
        spaceAfter=10
    )
    
    confidential_style = ParagraphStyle(
        'ConfidentialStyle',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#6b7280'),
        alignment=0,
        spaceBefore=20
    )
    
    # Title
    elements.append(Paragraph("FAX COVER SHEET", title_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
    elements.append(Spacer(1, 12))
    
    # Urgent notice if applicable
    if request.urgent:
        elements.append(Paragraph("*** URGENT - PLEASE DELIVER IMMEDIATELY ***", urgent_style))
    
    # Date and time
    now = datetime.now(timezone.utc)
    elements.append(Paragraph(f"<b>Date:</b> {now.strftime('%B %d, %Y')}", normal_style))
    elements.append(Paragraph(f"<b>Time:</b> {now.strftime('%I:%M %p')} UTC", normal_style))
    elements.append(Spacer(1, 12))
    
    # Recipient and Sender Info in a table
    recipient_data = [
        ["TO:", "FROM:"],
        [f"Name: {request.recipient_name}", f"Name: {request.sender_name}"],
        [f"Fax: {request.recipient_fax}", f"Fax: {request.sender_fax or 'N/A'}"],
        [f"Organization: {request.recipient_organization or 'N/A'}", f"Phone: {request.sender_phone or 'N/A'}"],
    ]
    
    recipient_table = Table(recipient_data, colWidths=[3.5*inch, 3.5*inch])
    recipient_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 12),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.HexColor('#1e3a5f')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (1, 0), 1, colors.HexColor('#e5e7eb')),
    ]))
    elements.append(recipient_table)
    elements.append(Spacer(1, 12))
    
    # Patient info if provided (PHI)
    if request.patient_name or request.patient_dob:
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
        elements.append(Spacer(1, 8))
        elements.append(Paragraph("PATIENT INFORMATION (PHI)", header_style))
        if request.patient_name:
            elements.append(Paragraph(f"<b>Patient Name:</b> {request.patient_name}", normal_style))
        if request.patient_dob:
            elements.append(Paragraph(f"<b>Date of Birth:</b> {request.patient_dob}", normal_style))
        elements.append(Spacer(1, 8))
    
    # Pages and Subject
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(f"<b>Total Pages (including cover):</b> {request.pages_following + 1}", normal_style))
    
    if request.subject:
        elements.append(Paragraph(f"<b>Subject:</b> {request.subject}", normal_style))
    
    # Message
    if request.message:
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("MESSAGE:", header_style))
        elements.append(Paragraph(request.message, normal_style))
    
    # HIPAA Confidentiality Notice
    if request.confidentiality_notice:
        hipaa_notice = """
        <b>CONFIDENTIALITY NOTICE:</b> This facsimile transmission contains confidential information, 
        some or all of which may be protected health information as defined by the federal Health 
        Insurance Portability & Accountability Act (HIPAA) Privacy Rule. This information is intended 
        only for the use of the individual or entity named above. The authorized recipient of this 
        information is prohibited from disclosing this information to any other party unless required 
        to do so by law or regulation and is required to destroy the information after its stated need 
        has been fulfilled. If you are not the intended recipient, you are hereby notified that any 
        disclosure, copying, distribution, or action taken in reliance on the contents of these 
        documents is strictly prohibited. If you have received this fax in error, please immediately 
        notify the sender by telephone to arrange for the return of the original documents.
        """
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#dc2626')))
        elements.append(Paragraph(hipaa_notice, confidential_style))
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF bytes and encode as base64
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    
    # Log audit
    await log_audit(
        current_user["id"], current_user["email"],
        "FAX_COVER_GENERATED", "fax_cover", None,
        details={
            "recipient": request.recipient_name,
            "recipient_fax": request.recipient_fax,
            "patient_name": request.patient_name if request.patient_name else None
        }
    )
    
    return {
        "success": True,
        "pdf_base64": pdf_base64,
        "filename": f"fax_cover_{now.strftime('%Y%m%d_%H%M%S')}.pdf",
        "content_type": "application/pdf",
        "pages": 1
    }


@api_router.get("/fax/history")
async def get_fax_history(
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get fax transmission history"""
    query = {}
    
    if status:
        query["status"] = status
    
    faxes = await db.faxes.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.faxes.count_documents(query)

    sanitized_faxes = []
    for fax in faxes:
        recipient_name = decrypt_fax_value(fax.get("recipient_name_encrypted")) or fax.get("recipient_name")
        recipient_fax_full = decrypt_fax_value(fax.get("recipient_fax_number_encrypted")) or fax.get("recipient_fax_number")
        recipient_fax_masked = fax.get("recipient_fax_number_masked") or mask_fax_number(recipient_fax_full)
        file_url = decrypt_fax_value(fax.get("file_url_encrypted")) or fax.get("file_url")
        notes = decrypt_fax_value(fax.get("notes_encrypted")) or fax.get("notes")

        sanitized = {k: v for k, v in fax.items() if k not in [
            "recipient_name_encrypted",
            "recipient_fax_number_encrypted",
            "file_url_encrypted",
            "notes_encrypted"
        ]}
        sanitized["recipient_name"] = recipient_name
        sanitized["recipient_fax_number"] = recipient_fax_masked
        sanitized["recipient_fax_number_masked"] = recipient_fax_masked
        sanitized["file_url"] = file_url
        sanitized["notes"] = notes
        sanitized_faxes.append(sanitized)
    
    return {
        "faxes": sanitized_faxes,
        "total": total,
        "limit": limit,
        "skip": skip
    }


# ==================== INCOMING FAX ENDPOINTS ====================
# Note: These must be defined BEFORE /fax/{fax_id} to avoid route conflicts

@api_router.get("/fax/incoming")
async def get_incoming_faxes(
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get incoming faxes list"""
    # Check role access
    allowed_roles = ["admin", "sales_manager", "super_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if status:
        query["status"] = status
    
    faxes = await db.incoming_faxes.find(query, {"_id": 0}).sort("received_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.incoming_faxes.count_documents(query)
    
    return {
        "faxes": faxes,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@api_router.get("/fax/incoming/{fax_id}")
async def get_incoming_fax_details(
    fax_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific incoming fax"""
    allowed_roles = ["admin", "sales_manager", "super_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied")
    
    fax = await db.incoming_faxes.find_one(
        {"$or": [{"id": fax_id}, {"fax_id": fax_id}]},
        {"_id": 0}
    )
    
    if not fax:
        raise HTTPException(status_code=404, detail="Incoming fax not found")
    
    return fax


@api_router.post("/fax/incoming/{fax_id}/assign")
async def assign_incoming_fax(
    fax_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Assign an incoming fax to a patient or mark for follow-up"""
    allowed_roles = ["admin", "sales_manager", "super_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied")
    
    fax = await db.incoming_faxes.find_one({"id": fax_id})
    if not fax:
        raise HTTPException(status_code=404, detail="Incoming fax not found")
    
    assign_type = request.get("assign_type")  # patient, general, follow_up
    assign_id = request.get("assign_id")  # patient_id if type is patient
    
    update_data = {
        "status": "assigned",
        "assigned_type": assign_type,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "assigned_by": current_user["id"]
    }
    
    if assign_type == "patient" and assign_id:
        # Get patient name
        patient = await db.patients.find_one({"id": assign_id})
        if patient:
            update_data["assigned_to"] = assign_id
            update_data["assigned_to_name"] = f"{patient.get('first_name', '')} {patient.get('last_name', '')}"
    elif assign_type == "general":
        update_data["assigned_to"] = "general"
        update_data["assigned_to_name"] = "General Inbox"
    elif assign_type == "follow_up":
        update_data["assigned_to"] = "follow_up"
        update_data["assigned_to_name"] = "Follow-up Required"
        update_data["status"] = "follow_up"
    
    await db.incoming_faxes.update_one(
        {"id": fax_id},
        {"$set": update_data}
    )
    
    await log_audit(
        current_user["id"], current_user["email"],
        "INCOMING_FAX_ASSIGNED", "incoming_fax", fax_id,
        details={"assign_type": assign_type, "assign_id": assign_id}
    )
    
    return {"message": "Fax assigned successfully", "status": update_data["status"]}


@api_router.delete("/fax/incoming/{fax_id}")
async def delete_incoming_fax(
    fax_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an incoming fax"""
    allowed_roles = ["admin", "super_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Admin access required to delete faxes")
    
    result = await db.incoming_faxes.delete_one({"id": fax_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incoming fax not found")
    
    await log_audit(
        current_user["id"], current_user["email"],
        "INCOMING_FAX_DELETED", "incoming_fax", fax_id
    )
    
    return {"message": "Fax deleted"}


# Outgoing fax detail (must be after /fax/incoming to avoid route conflict)
@api_router.get("/fax/{fax_id}")
async def get_fax_details(
    fax_id: str,
    include_sensitive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific fax"""
    fax = await db.faxes.find_one(
        {"$or": [{"id": fax_id}, {"fax_id": fax_id}]},
        {"_id": 0}
    )
    
    if not fax:
        raise HTTPException(status_code=404, detail="Fax not found")

    recipient_name = decrypt_fax_value(fax.get("recipient_name_encrypted")) or fax.get("recipient_name")
    recipient_fax_full = decrypt_fax_value(fax.get("recipient_fax_number_encrypted")) or fax.get("recipient_fax_number")
    recipient_fax_masked = fax.get("recipient_fax_number_masked") or mask_fax_number(recipient_fax_full)
    file_url = decrypt_fax_value(fax.get("file_url_encrypted")) or fax.get("file_url")
    notes = decrypt_fax_value(fax.get("notes_encrypted")) or fax.get("notes")

    is_admin = current_user.get("role") in ["admin", "super_admin"]
    allow_sensitive = include_sensitive and is_admin

    sanitized = {k: v for k, v in fax.items() if k not in [
        "recipient_name_encrypted",
        "recipient_fax_number_encrypted",
        "file_url_encrypted",
        "notes_encrypted"
    ]}
    sanitized["recipient_name"] = recipient_name
    sanitized["recipient_fax_number"] = recipient_fax_full if allow_sensitive else recipient_fax_masked
    sanitized["recipient_fax_number_masked"] = recipient_fax_masked
    sanitized["file_url"] = file_url
    sanitized["notes"] = notes
    
    return sanitized


@api_router.get("/fax/{fax_id}/audit-trail")
async def get_fax_transmission_audit_trail(
    fax_id: str,
    include_sensitive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get complete fax transmission audit trail for compliance."""
    events = await db.fax_transmission_audit.find(
        {"$or": [{"fax_id": fax_id}, {"fax_record_id": fax_id}]},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(300)

    is_admin = current_user.get("role") in ["admin", "super_admin"]
    allow_sensitive = include_sensitive and is_admin

    sanitized_events = []
    for event in events:
        full_fax_number = decrypt_fax_value(event.get("recipient_fax_number_encrypted"))
        masked_fax_number = event.get("recipient_fax_number_masked") or mask_fax_number(full_fax_number)
        recipient_name = decrypt_fax_value(event.get("recipient_name_encrypted"))

        sanitized_event = {k: v for k, v in event.items() if k not in [
            "recipient_name_encrypted",
            "recipient_fax_number_encrypted"
        ]}
        sanitized_event["recipient_name"] = recipient_name
        sanitized_event["recipient_fax_number"] = full_fax_number if allow_sensitive else masked_fax_number
        sanitized_event["recipient_fax_number_masked"] = masked_fax_number
        sanitized_events.append(sanitized_event)

    return {
        "fax_id": fax_id,
        "total_events": len(sanitized_events),
        "events": sanitized_events,
    }


@api_router.post("/fax/refresh-status/{fax_id}")
async def refresh_fax_status(
    fax_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually refresh fax status from Telnyx API"""
    fax = await db.faxes.find_one({"fax_id": fax_id})
    
    if not fax:
        raise HTTPException(status_code=404, detail="Fax not found")
    
    settings = await get_fax_settings()
    if not settings or not settings.get("telnyx_api_key"):
        raise HTTPException(status_code=400, detail="Telnyx not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.telnyx.com/v2/faxes/{fax_id}",
                headers={
                    "Authorization": f"Bearer {settings['telnyx_api_key']}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                new_status = data.get("status", fax.get("status"))
                
                # Map Telnyx status to our status
                status_map = {
                    "queued": FaxStatus.QUEUED.value,
                    "media.processed": FaxStatus.SENDING.value,
                    "sending": FaxStatus.SENDING.value,
                    "delivered": FaxStatus.DELIVERED.value,
                    "failed": FaxStatus.FAILED.value
                }
                mapped_status = status_map.get(new_status, new_status)
                
                update_data = {
                    "status": mapped_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                if data.get("page_count"):
                    update_data["page_count"] = data["page_count"]
                if data.get("failure_reason"):
                    update_data["failure_reason"] = data["failure_reason"]
                
                await db.faxes.update_one(
                    {"fax_id": fax_id},
                    {"$set": update_data}
                )

                await log_fax_transmission_audit(
                    event_type="FAX_STATUS_REFRESHED",
                    fax_record_id=fax.get("id"),
                    fax_id=fax_id,
                    transmission_status=mapped_status,
                    sender_user_id=fax.get("sent_by") or current_user.get("id"),
                    sender_email=fax.get("sent_by_email") or current_user.get("email"),
                    recipient_name=get_fax_recipient_name(fax),
                    recipient_fax_number=get_fax_recipient_number(fax),
                    triggered_by="user",
                    details={
                        "telnyx_status": new_status,
                        "refreshed_by": current_user.get("email")
                    }
                )
                
                return {
                    "message": "Status refreshed",
                    "status": mapped_status,
                    "telnyx_status": new_status
                }
            else:
                return {
                    "message": "Could not fetch status from Telnyx",
                    "error": response.status_code
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing status: {str(e)}")


@api_router.post("/webhooks/fax")
async def handle_fax_webhook(request: Request):
    """
    Handle Telnyx fax webhooks for delivery status updates.
    This endpoint is called by Telnyx when fax status changes.
    """
    try:
        payload = await request.json()
        logger.info(f"Received fax webhook: {json.dumps(payload)[:500]}")
        
        event_data = payload.get("data", {})
        event_type = event_data.get("event_type", "")
        fax_data = event_data.get("payload", {})
        
        fax_id = fax_data.get("fax_id") or fax_data.get("id")
        
        if not fax_id:
            logger.warning("Webhook received without fax_id")
            return {"status": "ignored", "reason": "no fax_id"}
        
        # Map Telnyx event types to our status
        status_map = {
            "fax.queued": FaxStatus.QUEUED.value,
            "fax.media.processed": FaxStatus.SENDING.value,
            "fax.sending.started": FaxStatus.SENDING.value,
            "fax.delivered": FaxStatus.DELIVERED.value,
            "fax.failed": FaxStatus.FAILED.value
        }
        
        new_status = status_map.get(event_type)
        
        if new_status:
            update_data = {
                "status": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if fax_data.get("page_count"):
                update_data["page_count"] = fax_data["page_count"]
            
            if event_type == "fax.failed":
                failure_reason = fax_data.get("failure_reason") or fax_data.get("sip_hangup_cause") or "Unknown error"
                update_data["failure_reason"] = failure_reason
            
            if event_type == "fax.delivered":
                update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
            
            result = await db.faxes.update_one(
                {"fax_id": fax_id},
                {"$set": update_data}
            )

            fax_doc = await db.faxes.find_one({"fax_id": fax_id}, {"_id": 0})
            if fax_doc:
                await log_fax_transmission_audit(
                    event_type="FAX_STATUS_WEBHOOK_UPDATE",
                    fax_record_id=fax_doc.get("id"),
                    fax_id=fax_id,
                    transmission_status=new_status,
                    sender_user_id=fax_doc.get("sent_by"),
                    sender_email=fax_doc.get("sent_by_email"),
                    recipient_name=get_fax_recipient_name(fax_doc),
                    recipient_fax_number=get_fax_recipient_number(fax_doc),
                    triggered_by="webhook",
                    details={
                        "webhook_event_type": event_type,
                        "failure_reason": update_data.get("failure_reason")
                    }
                )
            
            logger.info(f"Updated fax {fax_id} status to {new_status}, matched: {result.matched_count}")
        
        # Store webhook event for audit
        await db.fax_webhook_events.insert_one({
            "id": str(uuid.uuid4()),
            "fax_id": fax_id,
            "event_type": event_type,
            "payload": fax_data,
            "received_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Handle incoming fax webhooks
        if event_type == "fax.received":
            # Store incoming fax
            incoming_fax = {
                "id": str(uuid.uuid4()),
                "fax_id": fax_id,
                "from_number": fax_data.get("from", "Unknown"),
                "from_name": fax_data.get("from_display_name", ""),
                "to_number": fax_data.get("to", ""),
                "page_count": fax_data.get("page_count"),
                "media_url": fax_data.get("media_url"),
                "status": "unassigned",
                "received_at": datetime.now(timezone.utc).isoformat(),
                "assigned_to": None,
                "assigned_to_name": None,
                "assigned_type": None
            }
            await db.incoming_faxes.insert_one(incoming_fax)
            logger.info(f"Stored incoming fax {fax_id} from {incoming_fax['from_number']}")
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error processing fax webhook: {str(e)}")
        return {"status": "error", "message": str(e)}


@api_router.post("/webhooks/fax/failover")
async def handle_fax_webhook_failover(request: Request):
    """
    Failover webhook for Telnyx fax - use this as secondary webhook URL.
    Identical to primary webhook but logs as failover for monitoring.
    Configure in Telnyx as: {YOUR_DOMAIN}/api/webhooks/fax/failover
    """
    try:
        payload = await request.json()
        logger.warning(f"FAILOVER fax webhook received: {json.dumps(payload)[:500]}")
        
        event_data = payload.get("data", {})
        event_type = event_data.get("event_type", "")
        fax_data = event_data.get("payload", {})
        
        fax_id = fax_data.get("fax_id") or fax_data.get("id")
        
        if not fax_id:
            logger.warning("Failover webhook received without fax_id")
            return {"status": "ignored", "reason": "no fax_id"}
        
        # Map Telnyx event types to our status
        status_map = {
            "fax.queued": FaxStatus.QUEUED.value,
            "fax.media.processed": FaxStatus.SENDING.value,
            "fax.sending.started": FaxStatus.SENDING.value,
            "fax.delivered": FaxStatus.DELIVERED.value,
            "fax.failed": FaxStatus.FAILED.value
        }
        
        new_status = status_map.get(event_type)
        
        if new_status:
            update_data = {
                "status": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "webhook_source": "failover"
            }
            
            if fax_data.get("page_count"):
                update_data["page_count"] = fax_data["page_count"]
            
            if event_type == "fax.failed":
                failure_reason = fax_data.get("failure_reason") or fax_data.get("sip_hangup_cause") or "Unknown error"
                update_data["failure_reason"] = failure_reason
            
            if event_type == "fax.delivered":
                update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
            
            result = await db.faxes.update_one(
                {"fax_id": fax_id},
                {"$set": update_data}
            )

            fax_doc = await db.faxes.find_one({"fax_id": fax_id}, {"_id": 0})
            if fax_doc:
                await log_fax_transmission_audit(
                    event_type="FAX_STATUS_WEBHOOK_FAILOVER_UPDATE",
                    fax_record_id=fax_doc.get("id"),
                    fax_id=fax_id,
                    transmission_status=new_status,
                    sender_user_id=fax_doc.get("sent_by"),
                    sender_email=fax_doc.get("sent_by_email"),
                    recipient_name=get_fax_recipient_name(fax_doc),
                    recipient_fax_number=get_fax_recipient_number(fax_doc),
                    triggered_by="webhook_failover",
                    details={
                        "webhook_event_type": event_type,
                        "failure_reason": update_data.get("failure_reason")
                    }
                )
            
            logger.warning(f"FAILOVER: Updated fax {fax_id} status to {new_status}, matched: {result.matched_count}")
        
        # Store webhook event for audit (mark as failover)
        await db.fax_webhook_events.insert_one({
            "id": str(uuid.uuid4()),
            "fax_id": fax_id,
            "event_type": event_type,
            "payload": fax_data,
            "received_at": datetime.now(timezone.utc).isoformat(),
            "source": "failover"
        })
        
        # Handle incoming fax webhooks
        if event_type == "fax.received":
            # Check if already processed
            existing = await db.incoming_faxes.find_one({"fax_id": fax_id})
            if not existing:
                incoming_fax = {
                    "id": str(uuid.uuid4()),
                    "fax_id": fax_id,
                    "from_number": fax_data.get("from", "Unknown"),
                    "from_name": fax_data.get("from_display_name", ""),
                    "to_number": fax_data.get("to", ""),
                    "page_count": fax_data.get("page_count"),
                    "media_url": fax_data.get("media_url"),
                    "status": "unassigned",
                    "received_at": datetime.now(timezone.utc).isoformat(),
                    "assigned_to": None,
                    "assigned_to_name": None,
                    "assigned_type": None,
                    "webhook_source": "failover"
                }
                await db.incoming_faxes.insert_one(incoming_fax)
                logger.warning(f"FAILOVER: Stored incoming fax {fax_id} from {incoming_fax['from_number']}")
        
        return {"status": "success", "source": "failover"}
        
    except Exception as e:
        logger.error(f"Error processing failover fax webhook: {str(e)}")
        return {"status": "error", "message": str(e)}


# ==================== FEATURE FLAGS ====================

@api_router.get("/features")
async def get_features(current_user: dict = Depends(get_current_user)):
    """Get all feature flags"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.site_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    
    if not settings:
        return {"features": {}}
    
    return {"features": settings.get("features", {})}


@api_router.post("/features")
async def save_features(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save feature flags (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    features = request.get("features", {})
    now = datetime.now(timezone.utc).isoformat()
    
    await db.site_settings.update_one(
        {"type": "feature_flags"},
        {
            "$set": {
                "type": "feature_flags",
                "features": features,
                "updated_at": now,
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    await log_audit(
        current_user["id"], current_user["email"],
        "FEATURE_FLAGS_UPDATED", "settings", None,
        details={"features_changed": list(features.keys())}
    )
    
    return {"message": "Feature flags saved successfully"}


@api_router.get("/features/all")
async def get_all_features_public():
    """Get all feature flags (public endpoint for frontend)"""
    settings = await db.site_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    
    if not settings:
        return {"features": {}}
    
    return {"features": settings.get("features", {})}


@api_router.get("/features/{feature_id}")
async def get_feature_status(feature_id: str):
    """Get status of a specific feature (public endpoint for checking)"""
    settings = await db.site_settings.find_one({"type": "feature_flags"}, {"_id": 0})
    
    if not settings:
        return {"feature_id": feature_id, "enabled": True}  # Default to enabled
    
    features = settings.get("features", {})
    return {
        "feature_id": feature_id,
        "enabled": features.get(feature_id, True)  # Default to enabled if not set
    }

# ========================================
# PAGE SERVING API ROUTES
# ========================================

async def generate_location_page_on_demand(loc_name: str, loc_type: str, state_name: str, state_slug: str) -> str:
    """Generate full location page HTML on-the-fly for serving"""
    try:
        # Import the template function - always reload for latest changes
        import sys
        import importlib
        sys.path.insert(0, '/app/backend/templates')
        import location_page
        importlib.reload(location_page)
        from location_page import generate_full_location_page_html
        
        # Override SITE_DOMAIN from database settings if configured
        site_settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
        if site_settings and site_settings.get("site_domain"):
            location_page.SITE_DOMAIN = site_settings["site_domain"]
        
        # Fetch products from database
        db_categories = await db.product_categories.find({"enabled": True}, {"_id": 0}).to_list(100)
        db_products = await db.products.find({"enabled": True}, {"_id": 0}).to_list(500)
        
        # Generate products HTML using the rich styled format
        products_html = ""
        # Category display config for icons and colors
        cat_display = {
            "Pain Management / Therapeutic": {"icon": "zap", "gradient": "from-purple-500 to-purple-600", "subtitle": "TENS units, therapy devices"},
            "Mobility": {"icon": "accessibility", "gradient": "from-blue-500 to-blue-600", "subtitle": "Wheelchairs, walkers, scooters"},
            "Mobility Equipment": {"icon": "accessibility", "gradient": "from-blue-500 to-blue-600", "subtitle": "Wheelchairs, walkers, scooters"},
            "Lifts / Transfer Equipment": {"icon": "arrow-up-down", "gradient": "from-green-500 to-emerald-600", "subtitle": "Patient lifts, transfer aids"},
            "Orthopedic / Orthotics": {"icon": "bone", "gradient": "from-blue-500 to-blue-600", "subtitle": "Braces for back, knee, ankle, wrist"},
            "Respiratory / Oxygen": {"icon": "wind", "gradient": "from-sky-500 to-sky-600", "subtitle": "CPAP, oxygen concentrators"},
            "Hospital Beds / Bedroom": {"icon": "bed", "gradient": "from-rose-500 to-rose-600", "subtitle": "Hospital beds, mattresses"},
            "Hospital Beds & Accessories": {"icon": "bed", "gradient": "from-rose-500 to-rose-600", "subtitle": "Hospital beds, mattresses"},
            "Urology / Ostomy / Clinical": {"icon": "droplets", "gradient": "from-teal-500 to-teal-600", "subtitle": "Catheters, ostomy supplies"},
            "Enteral Nutrition": {"icon": "utensils", "gradient": "from-pink-500 to-pink-600", "subtitle": "Feeding tubes, pumps, formulas"},
            "Compression / Wound Care": {"icon": "activity", "gradient": "from-indigo-500 to-indigo-600", "subtitle": "Compression therapy, wound supplies"},
            "Wound Care": {"icon": "activity", "gradient": "from-indigo-500 to-indigo-600", "subtitle": "Compression therapy, wound supplies"},
            "Diabetes Supplies": {"icon": "heart-pulse", "gradient": "from-red-500 to-red-600", "subtitle": "Glucose monitors, insulin supplies"},
            "Diabetic Supplies": {"icon": "heart-pulse", "gradient": "from-red-500 to-red-600", "subtitle": "Glucose monitors, insulin supplies"},
            "Bath Safety": {"icon": "bath", "gradient": "from-cyan-500 to-cyan-600", "subtitle": "Shower chairs, grab bars, commodes"},
            "Bathroom Safety": {"icon": "bath", "gradient": "from-cyan-500 to-cyan-600", "subtitle": "Shower chairs, grab bars, commodes"},
            "Emergency / Monitoring": {"icon": "alert-triangle", "gradient": "from-red-500 to-orange-500", "subtitle": "AEDs, monitors, oxygen systems"},
            "Prosthetics": {"icon": "hand", "gradient": "from-violet-500 to-violet-600", "subtitle": "Limb prosthetics, sockets, liners"},
            "Speech & Communication": {"icon": "mic", "gradient": "from-blue-400 to-blue-500", "subtitle": "Speech devices, communication aids"},
            "Vision Aids": {"icon": "eye", "gradient": "from-emerald-500 to-emerald-600", "subtitle": "Magnifiers, video aids"},
            "Hearing Aids": {"icon": "ear", "gradient": "from-yellow-500 to-amber-500", "subtitle": "Behind-ear, in-ear hearing aids"},
        }
        
        category_cards = []
        for cat in sorted(db_categories, key=lambda x: x.get("sort_order", 999)):
            cat_name = cat.get("name", "Products")
            cat_products = [p for p in db_products if p.get("category_id") == cat.get("id")]
            if not cat_products:
                continue
            
            cfg = cat_display.get(cat_name, {"icon": "package", "gradient": "from-gray-500 to-gray-600", "subtitle": "Medical equipment"})
            
            items_html = ""
            for prod in sorted(cat_products, key=lambda x: x.get("sort_order", 999)):
                pname = prod.get("name", "")
                pdesc = prod.get("short_description", "Medicare-covered medical equipment")
                items_html += f'<div class="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors product-item" data-product="{pname}" data-category="{cat_name}"><p class="font-medium text-gray-800 text-sm">{pname}</p><p class="text-xs text-gray-500 mt-1">{pdesc}</p></div>'
            
            category_cards.append(
                f'<div class="border border-gray-200 rounded-2xl overflow-hidden">'
                f'<button class="product-toggle w-full p-6 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors">'
                f'<div class="flex items-center gap-4">'
                f'<div class="w-12 h-12 bg-gradient-to-br {cfg["gradient"]} rounded-xl flex items-center justify-center">'
                f'<i data-lucide="{cfg["icon"]}" class="w-6 h-6 text-white"></i></div>'
                f'<div class="text-left"><h3 class="font-semibold text-gray-900">{cat_name}</h3>'
                f'<p class="text-sm text-gray-500">{cfg["subtitle"]}</p></div></div>'
                f'<i data-lucide="chevron-down" class="w-5 h-5 text-gray-400 transition-transform product-chevron"></i>'
                f'</button>'
                f'<div class="product-content hidden px-6 pb-6"><div class="space-y-3 pt-2 border-t border-gray-100">{items_html}</div></div></div>'
            )
        
        if category_cards:
            products_html = '<div class="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">' + "".join(category_cards) + '</div>'
        
        # Load US locations data for county/city counts
        us_data = load_us_locations()
        state_data = us_data.get(state_slug, {})
        counties = state_data.get("counties", [])
        cities = state_data.get("cities", [])
        county_count = len(counties)
        city_count = len(cities)
        
        # Generate the full HTML using the template
        html = generate_full_location_page_html(
            loc_name=loc_name,
            loc_type=loc_type,
            state_name=state_name,
            state_slug=state_slug,
            county_count=county_count,
            city_count=city_count,
            counties=counties,
            cities=cities,
            products_html=products_html
        )
        
        return html
    except Exception as e:
        logger.error(f"Error generating page on demand: {e}")
        import traceback
        traceback.print_exc()
        return None


def build_locations_index_html(site_domain: str, state_cards: str, stats: dict) -> str:
    site_domain = normalize_public_site_url(site_domain)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DME Coverage Areas | Nationwide Coverage | MediNova Medical Supplies</title>
  <meta name="description" content="MediNova Medical Supplies delivers Medicare-covered durable medical equipment nationwide. Search states and browse coverage details across the United States.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:title" content="DME Coverage Areas | Nationwide Coverage | MediNova Medical Supplies">
  <meta property="og:description" content="Search MediNova Medical Supplies coverage areas across the United States and browse local Medicare-covered equipment delivery details.">
  <meta property="og:url" content="{site_domain}/locations/">
  <meta property="og:image" content="https://customer-assets.emergentagent.com/job_7965af6d-d9f9-48a9-9447-d2e9a0ead878/artifacts/e812a763_durable-medical-equipment-wheelchair.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="DME Coverage Areas | Nationwide Coverage | MediNova Medical Supplies">
  <meta name="twitter:description" content="Search MediNova Medical Supplies coverage areas across the United States and browse local Medicare-covered equipment delivery details.">
  <link rel="canonical" href="{site_domain}/locations/">
  {A2G_ANALYTICS_SCRIPT}
  <script type="application/ld+json">{{"@context":"https://schema.org","@type":"CollectionPage","name":"MediNova Medical Supplies Coverage Areas","url":"{site_domain}/locations/","description":"Search MediNova Medical Supplies coverage areas across the United States and browse local Medicare-covered equipment delivery details."}}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    *{{font-family:'Inter',sans-serif;}}
    html{{scroll-behavior:smooth;}}
    body{{background:#f8fafc;}}
    .hero-grid{{background-image:radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px);background-size:24px 24px;}}
    .mobile-drawer-overlay{{position:fixed;inset:0;background:rgba(15,23,42,0.5);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;z-index:80}}
    .mobile-drawer{{position:fixed;top:0;right:0;bottom:0;width:min(86vw,360px);background:rgba(15,23,42,.97);backdrop-filter:blur(14px);border-left:1px solid rgba(255,255,255,.08);box-shadow:-20px 0 50px rgba(15,23,42,.28);transform:translateX(100%);transition:transform .25s ease;z-index:90;display:flex;flex-direction:column;padding:1.5rem;gap:1.5rem}}
    body.mobile-drawer-open .mobile-drawer-overlay{{opacity:1;visibility:visible}}
    body.mobile-drawer-open .mobile-drawer{{transform:translateX(0)}}
  </style>
</head>
<body>
  <header class="bg-[#121b2f] text-white border-b border-white/5 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
      <a href="{site_domain}/" data-brand-logo-link data-default-href="{site_domain}/" class="flex items-center gap-3">
        <img data-brand-logo-image src="/images/medinova/logo.webp" alt="MediNova Medical Supplies logo" class="h-[60px] max-w-[200px] object-contain" onerror="this.style.display='none';document.querySelectorAll('[data-brand-logo-fallback]').forEach(n=>n.style.display='')" />
        <div data-brand-logo-fallback style="display:none">
          <div class="text-2xl font-bold leading-none text-white">MediNova</div>
          <div class="text-xs text-slate-400 mt-1">Medical Supplies</div>
        </div>
      </a>
      <div class="hidden md:flex items-center gap-4">
        <a href="tel:2488864363" class="inline-flex items-center gap-2 rounded-2xl bg-[#0055CC] px-5 py-3 font-semibold text-white shadow-lg shadow-[#0055CC]/20 hover:bg-[#004299] transition-colors"><i data-lucide="phone" class="w-4 h-4"></i>(248) 886-4-DME</a>
        <a href="{site_domain}/login" class="text-slate-200 hover:text-white font-medium">Patient Login</a>
      </div>
      <button id="mobile-menu-btn" type="button" class="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white hover:bg-white/5" aria-label="Open navigation menu"><i data-lucide="menu" class="w-5 h-5"></i></button>
    </div>
  </header>

  <div id="mobile-drawer-overlay" class="mobile-drawer-overlay md:hidden"></div>
  <aside id="mobile-drawer" class="mobile-drawer md:hidden" aria-hidden="true">
    <div class="flex items-start justify-between gap-4">
      <a href="{site_domain}/" data-brand-logo-link data-default-href="{site_domain}/" class="flex items-center gap-3">
        <img data-brand-logo-image src="/images/medinova/logo.webp" alt="MediNova Medical Supplies logo" class="h-[55px] max-w-[180px] object-contain" onerror="this.style.display='none';document.querySelectorAll('[data-brand-logo-fallback]').forEach(n=>n.style.display='')" />
        <div data-brand-logo-fallback style="display:none"><div class="text-xl font-bold text-white">MediNova Medical Supplies</div><div class="text-xs text-slate-400">Medicare DME Supplier</div></div>
      </a>
      <button id="mobile-menu-close" type="button" class="p-2 rounded-xl text-white hover:bg-white/5" aria-label="Close navigation menu"><i data-lucide="x" class="w-6 h-6"></i></button>
    </div>
    <p class="text-sm text-slate-400">Search nationwide coverage areas and browse local delivery details.</p>
    <nav class="flex flex-col gap-2">
      <a href="{site_domain}/products" class="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10">Products<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
      <a href="{site_domain}/locations" class="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10">Coverage Areas<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
      <a href="{site_domain}/medicare-resources" class="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10">Resources<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
      <a href="{site_domain}/#contact" class="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10">Contact<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
    </nav>
    <div class="mt-auto space-y-3 border-t border-white/10 pt-6">
      <a href="tel:2488864363" class="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 font-semibold text-white hover:bg-white/5"><i data-lucide="phone" class="w-4 h-4"></i>(248) 886-4-DME</a>
      <a href="{site_domain}/login" class="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0055CC] px-4 py-3 font-semibold text-white hover:bg-[#004299]">Patient Login</a>
    </div>
  </aside>

  <section class="relative overflow-hidden bg-[#121b2f] text-white hero-grid">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,159,28,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_24%)]"></div>
    <div class="relative max-w-7xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-[1.1fr_0.95fr] gap-10 items-center">
      <div>
        <div class="flex items-center gap-2 text-sm text-slate-400 mb-8"><a href="{site_domain}/" class="text-[#ffcf70] hover:text-white">Home</a><i data-lucide="chevron-right" class="w-4 h-4"></i><span>Coverage Areas</span></div>
        <h1 class="text-4xl md:text-6xl font-bold leading-tight">DME Coverage Areas<br><span class="text-[#ffb11f]">Nationwide Coverage</span></h1>
        <p class="mt-6 max-w-2xl text-xl text-slate-300 leading-relaxed">We deliver Medicare-covered durable medical equipment to patients across the United States. Find your state below to see local coverage details.</p>
        <div class="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="rounded-3xl border border-white/10 bg-white/5 px-5 py-6"><i data-lucide="globe" class="w-6 h-6 text-[#ffcf70] mb-4"></i><div class="text-4xl font-bold">{stats['states']}</div><div class="text-sm text-slate-400 mt-2">States</div></div>
          <div class="rounded-3xl border border-white/10 bg-white/5 px-5 py-6"><i data-lucide="building-2" class="w-6 h-6 text-[#8ec5ff] mb-4"></i><div class="text-4xl font-bold">{stats['counties']:,}</div><div class="text-sm text-slate-400 mt-2">Counties</div></div>
          <div class="rounded-3xl border border-white/10 bg-white/5 px-5 py-6"><i data-lucide="home" class="w-6 h-6 text-[#4ade80] mb-4"></i><div class="text-4xl font-bold">{stats['cities']:,}</div><div class="text-sm text-slate-400 mt-2">Cities</div></div>
          <div class="rounded-3xl border border-white/10 bg-white/5 px-5 py-6"><i data-lucide="truck" class="w-6 h-6 text-[#c4a1ff] mb-4"></i><div class="text-4xl font-bold">{stats['pages']:,}</div><div class="text-sm text-slate-400 mt-2">Pages</div></div>
        </div>
      </div>
      <div class="rounded-[2rem] border border-white/10 bg-white/8 backdrop-blur-xl p-6 shadow-2xl shadow-black/25">
        <div class="flex items-center gap-3 text-2xl font-semibold mb-5"><i data-lucide="search" class="w-6 h-6 text-[#ffcf70]"></i><span>Find Your Location</span></div>
        <div class="relative mb-5">
          <i data-lucide="search" class="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="location-search" type="text" placeholder="Search states, counties, or cities..." class="w-full rounded-2xl border border-white/10 bg-white/6 pl-12 pr-4 py-4 text-white placeholder:text-slate-400 outline-none focus:border-[#ffb11f]" />
        </div>
        <div class="flex flex-wrap gap-2" id="region-filters">
          <button data-region="all" class="region-filter rounded-xl bg-[#ffb11f] px-4 py-2 text-sm font-semibold text-white">All Regions</button>
          <button data-region="northeast" class="region-filter rounded-xl bg-white/8 px-4 py-2 text-sm font-medium text-slate-200">Northeast</button>
          <button data-region="southeast" class="region-filter rounded-xl bg-white/8 px-4 py-2 text-sm font-medium text-slate-200">Southeast</button>
          <button data-region="midwest" class="region-filter rounded-xl bg-white/8 px-4 py-2 text-sm font-medium text-slate-200">Midwest</button>
          <button data-region="southwest" class="region-filter rounded-xl bg-white/8 px-4 py-2 text-sm font-medium text-slate-200">Southwest</button>
          <button data-region="west" class="region-filter rounded-xl bg-white/8 px-4 py-2 text-sm font-medium text-slate-200">West</button>
        </div>
      </div>
    </div>
  </section>

  <section class="bg-white py-14">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div class="text-lg text-slate-600">Showing <span id="visible-count" class="font-semibold text-slate-900">{stats['states']}</span> of {stats['states']} states</div>
        <div class="flex items-center gap-3">
          <select id="sort-select" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#ffb11f]">
            <option value="name">Sort by Name</option>
            <option value="pages">Sort by Pages</option>
          </select>
          <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"><i data-lucide="grid-3x3" class="w-4 h-4"></i><i data-lucide="list" class="w-4 h-4"></i></div>
        </div>
      </div>
      <div id="state-grid" class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{state_cards}</div>
    </div>
  </section>

  <script>
    lucide.createIcons();
    function setMobileDrawerState(isOpen){{document.body.classList.toggle('mobile-drawer-open',isOpen);document.getElementById('mobile-drawer')?.setAttribute('aria-hidden',isOpen?'false':'true');}}
    document.getElementById('mobile-menu-btn')?.addEventListener('click',()=>setMobileDrawerState(true));
    document.getElementById('mobile-menu-close')?.addEventListener('click',()=>setMobileDrawerState(false));
    document.getElementById('mobile-drawer-overlay')?.addEventListener('click',()=>setMobileDrawerState(false));
    window.addEventListener('keydown',(event)=>{{if(event.key==='Escape')setMobileDrawerState(false);}});
    const searchInput = document.getElementById('location-search');
    const cards = Array.from(document.querySelectorAll('.state-card'));
    const countNode = document.getElementById('visible-count');
    const sortSelect = document.getElementById('sort-select');
    let activeRegion = 'all';
    function applyFilters(){{
      const term = (searchInput?.value || '').toLowerCase().trim();
      cards.forEach((card)=>{{
        const haystack = `${{card.dataset.name}} ${{card.dataset.counties}} ${{card.dataset.cities}}`.toLowerCase();
        const regionMatch = activeRegion === 'all' || card.dataset.region === activeRegion;
        const termMatch = !term || haystack.includes(term);
        card.style.display = regionMatch && termMatch ? '' : 'none';
      }});
      countNode.textContent = String(cards.filter((card)=>card.style.display !== 'none').length);
    }}
    function applySort(){{
      const grid = document.getElementById('state-grid');
      const key = sortSelect?.value || 'name';
      const sorted = [...cards].sort((a,b)=>{{
        if(key === 'pages') return Number(b.dataset.pages || 0) - Number(a.dataset.pages || 0);
        return (a.dataset.name || '').localeCompare(b.dataset.name || '');
      }});
      sorted.forEach((card)=>grid.appendChild(card));
      applyFilters();
    }}
    document.querySelectorAll('.region-filter').forEach((button)=>{{
      button.addEventListener('click',()=>{{
        activeRegion = button.dataset.region || 'all';
        document.querySelectorAll('.region-filter').forEach((node)=>{{
          node.classList.remove('bg-[#ffb11f]','text-white');
          node.classList.add('bg-white/8','text-slate-200');
        }});
        button.classList.remove('bg-white/8','text-slate-200');
        button.classList.add('bg-[#ffb11f]','text-white');
        applyFilters();
      }});
    }});
    searchInput?.addEventListener('input', applyFilters);
    sortSelect?.addEventListener('change', applySort);
    applySort();
  </script>
  <script src="/branding-sync.js"></script>
</body>
</html>'''

# Serve landing page via API for preview environments
@api_router.get("/pages/landing", response_class=HTMLResponse, include_in_schema=False)
async def api_serve_landing():
    """Serve landing page via API route"""
    landing_path = Path("/app/frontend/public/landing.html")
    if landing_path.exists():
        return HTMLResponse(content=landing_path.read_text(), status_code=200)
    raise HTTPException(status_code=404, detail="Landing page not found")

# Serve location pages via API route
@api_router.get("/pages/location/{page_name}", response_class=HTMLResponse, include_in_schema=False)
async def api_serve_location_page(page_name: str):
    """Serve location pages via API route - generates HTML on-the-fly from US locations data"""
    if not is_safe_location_page_name(page_name):
        raise HTTPException(status_code=404, detail="Location page not found")
    
    slug = page_name.replace('durable-medical-equipment-in-', '').replace('.html', '')
    
    # First check database for cached/generated page
    page = await db.generated_pages.find_one({"location_slug": slug}, {"_id": 0})
    if page:
        # Always regenerate fresh HTML to ensure correct URLs (never use cached html_content)
        loc_name = page.get("location_name", slug.replace("-", " ").title())
        loc_type = page.get("location_type", "city")
        state_slug = page.get("parent_state", slug)
        us_data = load_us_locations()
        state_name = us_data.get(state_slug, {}).get("name", state_slug.replace("-", " ").title()) if us_data else state_slug.replace("-", " ").title()
        
        html = await generate_location_page_on_demand(loc_name, loc_type, state_name, state_slug)
        if html:
            return HTMLResponse(content=html, status_code=200)
    
    # Page not in database - generate on-demand from US locations data
    us_data = load_us_locations()
    if not us_data:
        raise HTTPException(status_code=404, detail="Location data not available")
    
    # Helper to slugify names
    def slugify(text):
        return text.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")
    
    # Check if it's a state page (slug matches a state key directly)
    if slug in us_data:
        state_info = us_data[slug]
        state_name = state_info.get("name", slug.replace("-", " ").title())
        html = await generate_location_page_on_demand(state_name, "state", state_name, slug)
        if html:
            return HTMLResponse(content=html, status_code=200)
    
    # Check if it's a county or city page (format: {location}-{state})
    # Try to find matching state suffix
    for state_slug_key, state_info in us_data.items():
        if not slug.endswith(f"-{state_slug_key}"):
            continue
        
        state_name = state_info.get("name", state_slug_key.replace("-", " ").title())
        location_part = slug[:-len(state_slug_key)-1]  # Remove "-{state}" from end
        
        # Check counties
        for county in state_info.get("counties", []):
            if slugify(county) == location_part:
                html = await generate_location_page_on_demand(county, "county", state_name, state_slug_key)
                if html:
                    return HTMLResponse(content=html, status_code=200)
        
        # Check cities
        for city in state_info.get("cities", []):
            if slugify(city) == location_part:
                html = await generate_location_page_on_demand(city, "city", state_name, state_slug_key)
                if html:
                    return HTMLResponse(content=html, status_code=200)
    
    raise HTTPException(status_code=404, detail="Location page not found")


# Admin endpoint to purge cached location page HTML
@api_router.post("/dev/purge-location-cache")
async def purge_location_cache(current_user: dict = Depends(get_current_user)):
    """Purge all cached location page HTML content from the database to force fresh regeneration"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    result = await db.generated_pages.update_many(
        {"html_content": {"$exists": True}},
        {"$unset": {"html_content": ""}}
    )
    return {"purged": result.modified_count, "message": f"Purged cached HTML from {result.modified_count} pages"}


# API version of locations index for preview environment
@api_router.get("/pages/locations-index", response_class=HTMLResponse, include_in_schema=False)
async def api_serve_locations_index():
    """Serve locations index page via API route"""
    site_settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
    site_domain = normalize_public_site_url(site_settings.get("site_domain") if site_settings else SITE_URL)
    us_data = load_us_locations()
    if not us_data:
        raise HTTPException(status_code=404, detail="Location data not available")
    
    state_cards = ""
    total_counties = 0
    total_cities = 0
    for state_slug, state_info in sorted(us_data.items(), key=lambda x: x[1].get("name", "")):
        state_name = state_info.get("name", state_slug.replace("-", " ").title())
        county_count = len(state_info.get("counties", []))
        city_count = len(state_info.get("cities", []))
        total_counties += county_count
        total_cities += city_count
        total_pages = county_count + city_count + 1
        region = get_us_region(state_name)
        state_cards += f'''<a href="{site_domain}/locations/durable-medical-equipment-in-{state_slug}.html" class="state-card group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#ffcf70] hover:shadow-xl" data-name="{state_name}" data-region="{region}" data-pages="{total_pages}" data-counties="{county_count}" data-cities="{city_count}">
<div class="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ffcf70] to-transparent opacity-80"></div>
<div class="flex items-start justify-between gap-4">
<div><h3 class="text-2xl font-semibold text-slate-900 group-hover:text-[#ff9f1c]">{state_name}</h3><p class="text-sm text-slate-400 mt-1">{REGION_LABELS.get(region, 'Other')} Region</p></div>
<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{total_pages}</span>
</div>
<div class="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span>{county_count} counties</span><span>{city_count}+ cities</span></div>
</a>'''

    stats = {
        "states": len(us_data),
        "counties": total_counties,
        "cities": total_cities,
        "pages": total_counties + total_cities + len(us_data),
    }
    html = build_locations_index_html(site_domain, state_cards, stats)
    return HTMLResponse(content=html, status_code=200)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*", "https://medinovadme.com", "https://www.medinovadme.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_indexes():
    """Create database indexes for analytics performance"""
    try:
        # Analytics indexes for fast queries
        await db.analytics_events.create_index([("timestamp", -1)])
        await db.analytics_events.create_index([("date", -1)])
        await db.analytics_events.create_index([("session_id", 1)])
        await db.analytics_events.create_index([("visitor_id", 1)])
        await db.analytics_events.create_index([("page_path", 1)])
        await db.analytics_events.create_index([("event_type", 1), ("timestamp", -1)])
        
        # Sessions indexes
        await db.analytics_sessions.create_index([("session_id", 1)], unique=True)
        await db.analytics_sessions.create_index([("last_activity", -1)])
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ========================================
# NEWSLETTER SYSTEM
# ========================================

class NewsletterListCreate(BaseModel):
    name: str
    description: Optional[str] = None

class NewsletterListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class SubscriberCreate(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    lists: List[str] = []  # List IDs
    source: Optional[str] = None  # Where they signed up from

class SubscriberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    lists: Optional[List[str]] = None
    is_active: Optional[bool] = None

class NewsletterCreate(BaseModel):
    subject: str
    content: str  # HTML content from WYSIWYG
    list_ids: List[str]  # Which lists to send to
    scheduled_at: Optional[str] = None  # ISO datetime for scheduling

class AINewsletterRequest(BaseModel):
    subject: str
    tone: Optional[str] = "professional"  # professional, friendly, casual
    include_products: bool = True
    list_ids: List[str] = []

# Newsletter Lists CRUD
@api_router.get("/newsletter/lists")
async def get_newsletter_lists(current_user: dict = Depends(get_current_user)):
    """Get all newsletter lists"""
    require_admin(current_user)
    lists = await db.newsletter_lists.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add subscriber counts
    for lst in lists:
        count = await db.newsletter_subscribers.count_documents({
            "lists": lst["id"],
            "is_active": True
        })
        lst["subscriber_count"] = count
    
    return lists

@api_router.post("/newsletter/lists")
async def create_newsletter_list(data: NewsletterListCreate, current_user: dict = Depends(get_current_user)):
    """Create a new newsletter list"""
    require_admin(current_user)
    
    list_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    list_doc = {
        "id": list_id,
        "name": data.name,
        "description": data.description,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.newsletter_lists.insert_one(list_doc)
    
    return {"message": "List created", "id": list_id, "name": data.name}

@api_router.put("/newsletter/lists/{list_id}")
async def update_newsletter_list(list_id: str, data: NewsletterListUpdate, current_user: dict = Depends(get_current_user)):
    """Update a newsletter list"""
    require_admin(current_user)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.newsletter_lists.update_one({"id": list_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="List not found")
    
    return {"message": "List updated"}

@api_router.delete("/newsletter/lists/{list_id}")
async def delete_newsletter_list(list_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a newsletter list"""
    require_admin(current_user)
    
    # Remove list from all subscribers
    await db.newsletter_subscribers.update_many(
        {"lists": list_id},
        {"$pull": {"lists": list_id}}
    )
    
    await db.newsletter_lists.delete_one({"id": list_id})
    
    return {"message": "List deleted"}

# Subscribers CRUD
@api_router.get("/newsletter/subscribers")
async def get_newsletter_subscribers(
    list_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get newsletter subscribers with optional filtering"""
    require_admin(current_user)
    
    query = {}
    if list_id:
        query["lists"] = list_id
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.newsletter_subscribers.count_documents(query)
    subscribers = await db.newsletter_subscribers.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    
    return {
        "subscribers": subscribers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/newsletter/subscribers")
async def add_newsletter_subscriber(data: SubscriberCreate, current_user: dict = Depends(get_current_user)):
    """Add a new subscriber"""
    require_admin(current_user)
    
    # Check if already exists
    existing = await db.newsletter_subscribers.find_one({"email": data.email.lower()})
    if existing:
        # Update existing subscriber's lists
        await db.newsletter_subscribers.update_one(
            {"email": data.email.lower()},
            {
                "$addToSet": {"lists": {"$each": data.lists}},
                "$set": {
                    "is_active": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"message": "Subscriber updated", "id": existing["id"]}
    
    subscriber_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    subscriber_doc = {
        "id": subscriber_id,
        "email": data.email.lower(),
        "first_name": data.first_name,
        "last_name": data.last_name,
        "lists": data.lists,
        "source": data.source or "manual",
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.newsletter_subscribers.insert_one(subscriber_doc)
    
    return {"message": "Subscriber added", "id": subscriber_id}

@api_router.put("/newsletter/subscribers/{subscriber_id}")
async def update_newsletter_subscriber(subscriber_id: str, data: SubscriberUpdate, current_user: dict = Depends(get_current_user)):
    """Update a subscriber"""
    require_admin(current_user)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.newsletter_subscribers.update_one({"id": subscriber_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    
    return {"message": "Subscriber updated"}

@api_router.delete("/newsletter/subscribers/{subscriber_id}")
async def delete_newsletter_subscriber(subscriber_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a subscriber"""
    require_admin(current_user)
    
    await db.newsletter_subscribers.delete_one({"id": subscriber_id})
    
    return {"message": "Subscriber deleted"}

# Public unsubscribe endpoint
@api_router.get("/newsletter/unsubscribe/{token}")
async def unsubscribe_newsletter(token: str):
    """Public endpoint to unsubscribe from newsletter"""
    try:
        # Token is base64 encoded email
        import base64
        email = base64.urlsafe_b64decode(token.encode()).decode()
        
        result = await db.newsletter_subscribers.update_one(
            {"email": email.lower()},
            {"$set": {"is_active": False, "unsubscribed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.matched_count == 0:
            return HTMLResponse(content="<html><body><h1>Email not found</h1></body></html>")
        
        return HTMLResponse(content="""
            <html>
            <head><title>Unsubscribed</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>Successfully Unsubscribed</h1>
                <p>You have been removed from our newsletter list.</p>
                <p>We're sorry to see you go!</p>
            </body>
            </html>
        """)
    except Exception as e:
        logger.error(f"Unsubscribe error: {e}")
        return HTMLResponse(content="<html><body><h1>Invalid unsubscribe link</h1></body></html>")

# Auto-subscribe from patient requests (called when lead is created)
async def auto_subscribe_to_newsletter(email: str, first_name: str = None, last_name: str = None, source: str = "patient_request"):
    """Automatically subscribe new patient requests to newsletter"""
    try:
        # Get the default "Patient Requests" list or create it
        default_list = await db.newsletter_lists.find_one({"name": "Patient Requests"})
        if not default_list:
            list_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            await db.newsletter_lists.insert_one({
                "id": list_id,
                "name": "Patient Requests",
                "description": "Automatically subscribed from patient request forms",
                "created_at": now,
                "updated_at": now,
                "created_by": "system"
            })
        else:
            list_id = default_list["id"]
        
        # Check if subscriber exists
        existing = await db.newsletter_subscribers.find_one({"email": email.lower()})
        if existing:
            # Add to list if not already
            await db.newsletter_subscribers.update_one(
                {"email": email.lower()},
                {
                    "$addToSet": {"lists": list_id},
                    "$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        else:
            # Create new subscriber
            subscriber_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            await db.newsletter_subscribers.insert_one({
                "id": subscriber_id,
                "email": email.lower(),
                "first_name": first_name,
                "last_name": last_name,
                "lists": [list_id],
                "source": source,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            })
        
        logger.info(f"Auto-subscribed {email} to newsletter")
    except Exception as e:
        logger.error(f"Failed to auto-subscribe {email}: {e}")

# Auto-subscribe team members (admin, super_admin, sales_rep) to Team List
async def auto_subscribe_team_to_newsletter(email: str, first_name: str = None, last_name: str = None, role: str = None):
    """Automatically subscribe team members to the Team List newsletter"""
    try:
        # Get the "Team List" or create it
        team_list = await db.newsletter_lists.find_one({"name": "Team List"})
        if not team_list:
            list_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            await db.newsletter_lists.insert_one({
                "id": list_id,
                "name": "Team List",
                "description": "Internal team members (admins, sales reps)",
                "created_at": now,
                "updated_at": now,
                "created_by": "system"
            })
        else:
            list_id = team_list["id"]
        
        # Check if subscriber exists
        existing = await db.newsletter_subscribers.find_one({"email": email.lower()})
        if existing:
            # Add to Team List if not already
            await db.newsletter_subscribers.update_one(
                {"email": email.lower()},
                {
                    "$addToSet": {"lists": list_id},
                    "$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        else:
            # Create new subscriber
            subscriber_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            await db.newsletter_subscribers.insert_one({
                "id": subscriber_id,
                "email": email.lower(),
                "first_name": first_name,
                "last_name": last_name,
                "lists": [list_id],
                "source": f"team_{role}" if role else "team",
                "is_active": True,
                "created_at": now,
                "updated_at": now
            })
        
        logger.info(f"Auto-subscribed team member {email} ({role}) to Team List")
    except Exception as e:
        logger.error(f"Failed to auto-subscribe team member {email}: {e}")

# Remove team member from Team List when deleted
async def unsubscribe_team_from_newsletter(email: str):
    """Remove team member from Team List when they are deleted"""
    try:
        team_list = await db.newsletter_lists.find_one({"name": "Team List"})
        if team_list:
            # Remove from Team List (but keep in other lists if any)
            await db.newsletter_subscribers.update_one(
                {"email": email.lower()},
                {"$pull": {"lists": team_list["id"]}}
            )
            
            # If no more lists, mark as inactive
            subscriber = await db.newsletter_subscribers.find_one({"email": email.lower()})
            if subscriber and not subscriber.get("lists"):
                await db.newsletter_subscribers.update_one(
                    {"email": email.lower()},
                    {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            
            logger.info(f"Removed {email} from Team List")
    except Exception as e:
        logger.error(f"Failed to unsubscribe team member {email}: {e}")

# Import/Export Subscribers
@api_router.post("/newsletter/subscribers/import")
async def import_subscribers(
    file: UploadFile = File(...),
    list_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Import subscribers from CSV file"""
    require_admin(current_user)
    
    import csv
    from io import StringIO
    
    content = await file.read()
    text = content.decode('utf-8')
    
    reader = csv.DictReader(StringIO(text))
    
    imported = 0
    updated = 0
    errors = []
    
    for row in reader:
        try:
            email = row.get('email', '').strip().lower()
            if not email:
                continue
            
            first_name = row.get('first_name', row.get('name', '')).strip()
            last_name = row.get('last_name', '').strip()
            
            existing = await db.newsletter_subscribers.find_one({"email": email})
            if existing:
                await db.newsletter_subscribers.update_one(
                    {"email": email},
                    {
                        "$addToSet": {"lists": list_id},
                        "$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
                updated += 1
            else:
                subscriber_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc).isoformat()
                await db.newsletter_subscribers.insert_one({
                    "id": subscriber_id,
                    "email": email,
                    "first_name": first_name or None,
                    "last_name": last_name or None,
                    "lists": [list_id],
                    "source": "import",
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now
                })
                imported += 1
        except Exception as e:
            errors.append(f"Row error: {str(e)}")
    
    return {
        "message": f"Import complete: {imported} new, {updated} updated",
        "imported": imported,
        "updated": updated,
        "errors": errors[:10]  # Return first 10 errors
    }

@api_router.get("/newsletter/subscribers/export")
async def export_subscribers(list_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export subscribers to CSV"""
    require_admin(current_user)
    
    import csv
    from io import StringIO
    
    query = {"is_active": True}
    if list_id:
        query["lists"] = list_id
    
    subscribers = await db.newsletter_subscribers.find(query, {"_id": 0}).to_list(10000)
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['email', 'first_name', 'last_name', 'source', 'created_at'])
    
    for sub in subscribers:
        writer.writerow([
            sub.get('email', ''),
            sub.get('first_name', ''),
            sub.get('last_name', ''),
            sub.get('source', ''),
            sub.get('created_at', '')
        ])
    
    output.seek(0)
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=subscribers_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

# Newsletter Creation and Sending
@api_router.get("/newsletter/campaigns")
async def get_newsletter_campaigns(current_user: dict = Depends(get_current_user)):
    """Get all newsletter campaigns"""
    require_admin(current_user)
    
    campaigns = await db.newsletters.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return campaigns

@api_router.post("/newsletter/campaigns")
async def create_newsletter_campaign(data: NewsletterCreate, current_user: dict = Depends(get_current_user)):
    """Create a new newsletter campaign"""
    require_admin(current_user)
    
    campaign_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    campaign_doc = {
        "id": campaign_id,
        "subject": data.subject,
        "content": data.content,
        "list_ids": data.list_ids,
        "status": "draft",
        "scheduled_at": data.scheduled_at,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"],
        "sent_count": 0,
        "open_count": 0,
        "click_count": 0
    }
    
    await db.newsletters.insert_one(campaign_doc)
    
    return {"message": "Campaign created", "id": campaign_id}

@api_router.put("/newsletter/campaigns/{campaign_id}")
async def update_newsletter_campaign(campaign_id: str, data: NewsletterCreate, current_user: dict = Depends(get_current_user)):
    """Update a newsletter campaign"""
    require_admin(current_user)
    
    update_data = {
        "subject": data.subject,
        "content": data.content,
        "list_ids": data.list_ids,
        "scheduled_at": data.scheduled_at,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.newsletters.update_one({"id": campaign_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": "Campaign updated"}

@api_router.delete("/newsletter/campaigns/{campaign_id}")
async def delete_newsletter_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a newsletter campaign"""
    require_admin(current_user)
    
    await db.newsletters.delete_one({"id": campaign_id})
    
    return {"message": "Campaign deleted"}

@api_router.post("/newsletter/campaigns/{campaign_id}/send")
async def send_newsletter_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Send a newsletter campaign to all subscribers in the selected lists"""
    require_admin(current_user)
    
    campaign = await db.newsletters.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")
    
    # Get all active subscribers in the selected lists
    query = {
        "is_active": True,
        "lists": {"$in": campaign["list_ids"]}
    }
    subscribers = await db.newsletter_subscribers.find(query, {"_id": 0}).to_list(10000)
    
    if not subscribers:
        raise HTTPException(status_code=400, detail="No subscribers in selected lists")
    
    # Get email settings
    email_settings = await db.site_settings.find_one({"type": "email"})
    
    if not email_settings or not email_settings.get("smtp_host"):
        raise HTTPException(status_code=400, detail="SMTP settings not configured. Go to Dev Settings > General Settings > Email Settings to configure.")
    
    sent_count = 0
    failed_count = 0
    
    import base64
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    # Setup SMTP connection
    smtp_host = email_settings.get("smtp_host")
    smtp_port = int(email_settings.get("smtp_port", 587))
    smtp_username = email_settings.get("smtp_username")
    smtp_password = email_settings.get("smtp_password")
    from_email = email_settings.get("from_email")
    from_name = email_settings.get("from_name", "MediNova Medical Supplies")
    
    try:
        # Connect to SMTP server
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
            server.starttls()
        
        server.login(smtp_username, smtp_password)
        
        for subscriber in subscribers:
            try:
                # Generate unsubscribe token
                unsubscribe_token = base64.urlsafe_b64encode(subscriber["email"].encode()).decode()
                unsubscribe_url = f"{SITE_URL}/api/newsletter/unsubscribe/{unsubscribe_token}"
                
                # Create email message
                msg = MIMEMultipart('alternative')
                msg['Subject'] = campaign.get("subject", "Newsletter")
                msg['From'] = f"{from_name} <{from_email}>"
                msg['To'] = subscriber["email"]
                
                # Add unsubscribe link to content
                html_content = campaign["content"] + f"""
                    <br><br>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666; text-align: center;">
                        You're receiving this because you signed up at MediNova Medical Supplies.<br>
                        <a href="{unsubscribe_url}" style="color: #666;">Unsubscribe from this list</a>
                    </p>
                """
                
                # Attach HTML content
                html_part = MIMEText(html_content, 'html')
                msg.attach(html_part)
                
                # Send email
                server.sendmail(from_email, subscriber["email"], msg.as_string())
                logger.info(f"Newsletter sent to {subscriber['email']}")
                sent_count += 1
                    
            except Exception as e:
                logger.error(f"Failed to send to {subscriber['email']}: {e}")
                failed_count += 1
        
        server.quit()
        
    except smtplib.SMTPAuthenticationError as e:
        raise HTTPException(status_code=400, detail=f"SMTP authentication failed. Check your username/password: {str(e)}")
    except smtplib.SMTPConnectError as e:
        raise HTTPException(status_code=400, detail=f"Could not connect to SMTP server: {str(e)}")
    except Exception as e:
        logger.error(f"SMTP error: {e}")
        raise HTTPException(status_code=500, detail=f"Email sending failed: {str(e)}")
    
    # Update campaign status
    await db.newsletters.update_one(
        {"id": campaign_id},
        {
            "$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "sent_count": sent_count,
                "failed_count": failed_count
            }
        }
    )
    
    await log_audit(
        current_user["id"],
        current_user["email"],
        "NEWSLETTER_SENT",
        "newsletters",
        campaign_id,
        details={"sent_count": sent_count, "failed_count": failed_count}
    )
    
    return {
        "message": f"Newsletter sent to {sent_count} subscribers",
        "sent_count": sent_count,
        "failed_count": failed_count
    }

# AI Newsletter Writer
@api_router.post("/newsletter/ai/generate")
async def generate_ai_newsletter(data: AINewsletterRequest, current_user: dict = Depends(get_current_user)):
    """Generate newsletter content using AI"""
    require_admin(current_user)
    
    # Get some random products to feature
    products = []
    if data.include_products:
        products_cursor = db.products.aggregate([
            {"$match": {"enabled": True}},
            {"$sample": {"size": 3}}
        ])
        products = await products_cursor.to_list(3)
    
    # Build product descriptions
    product_info = ""
    if products:
        product_info = "\\n\\nFeatured Products:\\n"
        for p in products:
            product_info += f"- {p.get('name', 'Product')}: {p.get('short_description', p.get('description', 'Quality DME equipment'))[:100]}\\n"
    
    # Generate using OpenAI
    try:
        from emergentintegrations.llm.chat import chat, UserMessage
        
        prompt = f"""Write a professional healthcare newsletter email about: {data.subject}

Tone: {data.tone}
Company: MediNova Medical Supplies - A trusted durable medical equipment supplier
{product_info}

Requirements:
1. Write engaging, HIPAA-compliant content
2. Include a compelling subject line suggestion
3. Format the body in clean HTML with inline styles
4. Keep it concise but informative (300-500 words)
5. Include a clear call-to-action
6. If products are provided, naturally incorporate them

Return JSON format:
{{
    "subject": "Suggested email subject line",
    "content": "Full HTML content of the newsletter body"
}}"""

        response = await chat(
            api_key=os.environ.get("EMERGENT_API_KEY", ""),
            messages=[UserMessage(content=prompt)],
            model="gpt-5.2"
        )
        
        # Parse JSON from response
        response_text = response.content
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "subject": result.get("subject", data.subject),
                "content": result.get("content", ""),
                "generated": True
            }
        else:
            # Fallback - use the response as content
            return {
                "subject": data.subject,
                "content": f"<div style='font-family: Arial, sans-serif;'>{response_text}</div>",
                "generated": True
            }
            
    except Exception as e:
        logger.error(f"AI newsletter generation failed: {e}")
        
        # Fallback to template-based generation
        products_html = ""
        if products:
            products_html = """
            <h3 style="color: #333; margin-top: 30px;">Featured Products</h3>
            <table style="width: 100%; border-collapse: collapse;">
            """
            for p in products:
                products_html += f"""
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 15px 0;">
                        <strong style="color: #d97706;">{p.get('name', 'Product')}</strong><br>
                        <span style="color: #666; font-size: 14px;">{p.get('short_description', '')[:150]}</span>
                    </td>
                </tr>
                """
            products_html += "</table>"
        
        fallback_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0055CC, #0090D0); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">MediNova Medical Supplies</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Trusted Medicare DME Partner</p>
            </div>
            
            <h2 style="color: #333;">{data.subject}</h2>
            
            <p style="color: #555; line-height: 1.6;">
                Thank you for being a valued member of the MediNova Medical Supplies community. We're committed to providing 
                you with the highest quality durable medical equipment and exceptional service.
            </p>
            
            {products_html}
            
            <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin-top: 30px; text-align: center;">
                <p style="color: #333; margin: 0 0 15px 0;">Have questions about your DME needs?</p>
                <a href="tel:2488864363" style="display: inline-block; background: #0055CC; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Call Us: (248) 886-4-DME
                </a>
            </div>
            
            <p style="color: #888; font-size: 12px; margin-top: 30px; text-align: center;">
                MediNova Medical Supplies | Quality Medicare DME You Can Trust
            </p>
        </div>
        """
        
        return {
            "subject": data.subject,
            "content": fallback_content,
            "generated": True,
            "fallback": True
        }

# Auto-newsletter settings
@api_router.get("/newsletter/settings/auto")
async def get_auto_newsletter_settings(current_user: dict = Depends(get_current_user)):
    """Get auto-newsletter settings"""
    require_admin(current_user)
    
    settings = await db.site_settings.find_one({"type": "auto_newsletter"}, {"_id": 0})
    return settings or {
        "enabled": False,
        "frequency_days": 5,
        "list_ids": [],
        "last_sent": None
    }

@api_router.post("/newsletter/settings/auto")
async def update_auto_newsletter_settings(
    enabled: bool = Form(...),
    frequency_days: int = Form(5),
    list_ids: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    """Update auto-newsletter settings"""
    require_admin(current_user)
    
    list_ids_array = [lid.strip() for lid in list_ids.split(",") if lid.strip()]
    
    settings = {
        "type": "auto_newsletter",
        "enabled": enabled,
        "frequency_days": frequency_days,
        "list_ids": list_ids_array,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.site_settings.update_one(
        {"type": "auto_newsletter"},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Auto-newsletter settings updated", "settings": settings}

# Newsletter stats
@api_router.get("/newsletter/stats")
async def get_newsletter_stats(current_user: dict = Depends(get_current_user)):
    """Get newsletter statistics"""
    require_admin(current_user)
    
    total_subscribers = await db.newsletter_subscribers.count_documents({"is_active": True})
    total_lists = await db.newsletter_lists.count_documents({})
    total_campaigns = await db.newsletters.count_documents({})
    sent_campaigns = await db.newsletters.count_documents({"status": "sent"})
    
    # Get recent campaigns
    recent_campaigns = await db.newsletters.find(
        {"status": "sent"}, 
        {"_id": 0}
    ).sort("sent_at", -1).limit(5).to_list(5)
    
    # Subscribers by source
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    sources = await db.newsletter_subscribers.aggregate(pipeline).to_list(10)
    
    return {
        "total_subscribers": total_subscribers,
        "total_lists": total_lists,
        "total_campaigns": total_campaigns,
        "sent_campaigns": sent_campaigns,
        "recent_campaigns": recent_campaigns,
        "subscribers_by_source": {s["_id"] or "unknown": s["count"] for s in sources}
    }

# Migrate existing team members to Team List
@api_router.post("/newsletter/migrate-team")
async def migrate_team_to_newsletter(current_user: dict = Depends(get_current_user)):
    """One-time migration to add existing team members to Team List"""
    require_admin(current_user)
    
    # Get all team members
    team_roles = ["admin", "super_admin", "sales_rep"]
    team_users = await db.users.find(
        {"role": {"$in": team_roles}, "is_active": True},
        {"_id": 0, "email": 1, "first_name": 1, "last_name": 1, "role": 1}
    ).to_list(1000)
    
    migrated = 0
    for user in team_users:
        await auto_subscribe_team_to_newsletter(
            email=user.get("email"),
            first_name=user.get("first_name"),
            last_name=user.get("last_name"),
            role=user.get("role")
        )
        migrated += 1
    
    return {"message": f"Migrated {migrated} team members to Team List", "migrated": migrated}

# ========================================
# ==================== REVIEWS/TESTIMONIALS SYSTEM ====================
# ========================================

class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class ReviewTransactionType(str, Enum):
    PATIENT = "Patient"
    CAREGIVER = "Caregiver"
    HEALTHCARE_PROVIDER = "Healthcare Provider"
    INSURANCE_REP = "Insurance Representative"
    FAMILY_MEMBER = "Family Member"
    OTHER = "Other"

class ReviewSource(str, Enum):
    WEBSITE = "Website"
    MANUAL = "Manual"
    GOOGLE = "Google"
    HEALTHGRADES = "Healthgrades"
    YELP = "Yelp"
    BBB = "BBB"
    FACEBOOK = "Facebook"

class ReviewCreate(BaseModel):
    title: str
    text: str
    rating: int = Field(ge=1, le=5)
    reviewer_name: str
    reviewer_email: Optional[str] = None
    reviewer_phone: Optional[str] = None
    reviewer_title: Optional[str] = None
    reviewer_location: Optional[str] = None
    transaction_type: Optional[str] = None
    product_purchased: Optional[str] = None
    source: str = "Manual"
    status: str = "approved"
    featured: bool = False
    show_on_homepage: bool = True
    is_fake: bool = False

class ReviewPublicSubmit(BaseModel):
    title: str
    text: str
    rating: int = Field(ge=1, le=5)
    reviewer_name: str
    reviewer_email: EmailStr
    reviewer_phone: Optional[str] = None
    transaction_type: Optional[str] = None
    product_purchased: Optional[str] = None

class ReviewUpdate(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    reviewer_name: Optional[str] = None
    reviewer_email: Optional[str] = None
    reviewer_phone: Optional[str] = None
    reviewer_title: Optional[str] = None
    reviewer_location: Optional[str] = None
    transaction_type: Optional[str] = None
    product_purchased: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    featured: Optional[bool] = None
    show_on_homepage: Optional[bool] = None
    is_fake: Optional[bool] = None


# --- Admin Reviews Endpoints ---

@api_router.get("/reviews")
async def get_reviews(
    search: Optional[str] = None,
    source: Optional[str] = None,
    status: Optional[str] = None,
    is_fake: Optional[bool] = None,
    featured: Optional[bool] = None,
    show_on_homepage: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get all reviews with filters (admin)"""
    query = {}
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"text": {"$regex": search, "$options": "i"}},
            {"reviewer_name": {"$regex": search, "$options": "i"}}
        ]
    
    if source:
        query["source"] = source
    if status:
        query["status"] = status
    if is_fake is not None:
        query["is_fake"] = is_fake
    if featured is not None:
        query["featured"] = featured
    if show_on_homepage is not None:
        query["show_on_homepage"] = show_on_homepage
    
    reviews = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await db.reviews.count_documents(query)
    
    return {"reviews": reviews, "total": total}


@api_router.get("/reviews/stats")
async def get_reviews_stats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get reviews statistics"""
    total = await db.reviews.count_documents({})
    pending = await db.reviews.count_documents({"status": "pending"})
    approved = await db.reviews.count_documents({"status": "approved"})
    rejected = await db.reviews.count_documents({"status": "rejected"})
    on_homepage = await db.reviews.count_documents({"show_on_homepage": True, "status": "approved"})
    featured = await db.reviews.count_documents({"featured": True, "status": "approved"})
    fake_count = await db.reviews.count_documents({"is_fake": True})
    
    # Calculate average rating
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    result = await db.reviews.aggregate(pipeline).to_list(length=1)
    avg_rating = round(result[0]["avg_rating"], 1) if result else 0
    review_count = result[0]["count"] if result else 0
    
    # Get source breakdown
    sources_pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    sources = await db.reviews.aggregate(sources_pipeline).to_list(length=20)
    by_source = {s["_id"]: s["count"] for s in sources}
    
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "on_homepage": on_homepage,
        "featured": featured,
        "fake_count": fake_count,
        "average_rating": avg_rating,
        "review_count": review_count,
        "by_source": by_source
    }


@api_router.post("/reviews")
async def create_review(
    review: ReviewCreate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Create a new review (admin)"""
    review_data = review.model_dump()
    review_data["id"] = str(uuid.uuid4())
    review_data["created_at"] = datetime.now(timezone.utc).isoformat()
    review_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    review_data["created_by"] = current_user.get("id")
    
    await db.reviews.insert_one(review_data)
    return {"message": "Review created", "id": review_data["id"]}


@api_router.put("/reviews/{review_id}")
async def update_review(
    review_id: str,
    review: ReviewUpdate,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Update a review"""
    existing = await db.reviews.find_one({"id": review_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Review not found")
    
    update_data = {k: v for k, v in review.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.reviews.update_one({"id": review_id}, {"$set": update_data})
    return {"message": "Review updated"}


@api_router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a review"""
    result = await db.reviews.delete_one({"id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Review deleted"}


@api_router.delete("/reviews/fake/all")
async def delete_all_fake_reviews(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Delete all fake/placeholder reviews"""
    result = await db.reviews.delete_many({"is_fake": True})
    return {"message": f"Deleted {result.deleted_count} fake reviews", "deleted_count": result.deleted_count}


@api_router.post("/reviews/bulk-approve")
async def bulk_approve_reviews(
    review_ids: List[str] = [],
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Bulk approve reviews"""
    result = await db.reviews.update_many(
        {"id": {"$in": review_ids}},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Approved {result.modified_count} reviews"}


@api_router.get("/reviews/sources")
async def get_review_sources(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get all unique review sources"""
    sources = await db.reviews.distinct("source")
    return {"sources": sources}


# --- Public Reviews Endpoints ---

@api_router.get("/reviews/public")
async def get_public_reviews(
    homepage_only: bool = False,
    featured_only: bool = False,
    limit: int = 20
):
    """Get approved reviews for public display (no auth required)"""
    query = {"status": "approved"}
    
    if homepage_only:
        query["show_on_homepage"] = True
    if featured_only:
        query["featured"] = True
    
    # Exclude sensitive info
    projection = {
        "_id": 0,
        "reviewer_email": 0,
        "reviewer_phone": 0,
        "is_fake": 0,
        "created_by": 0
    }
    
    reviews = await db.reviews.find(query, projection).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    # Calculate stats
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    result = await db.reviews.aggregate(pipeline).to_list(length=1)
    avg_rating = round(result[0]["avg_rating"], 1) if result else 5.0
    total_count = result[0]["count"] if result else 0
    
    return {
        "reviews": reviews,
        "stats": {
            "average_rating": avg_rating,
            "total_reviews": total_count,
            "recommend_percentage": 100 if avg_rating >= 4.5 else int((avg_rating / 5) * 100)
        }
    }


@api_router.post("/reviews/submit")
async def submit_public_review(review: ReviewPublicSubmit):
    """Submit a review from the public website (requires approval)"""
    review_data = review.model_dump()
    review_data["id"] = str(uuid.uuid4())
    review_data["status"] = "pending"  # Requires admin approval
    review_data["source"] = "Website"
    review_data["featured"] = False
    review_data["show_on_homepage"] = False
    review_data["is_fake"] = False
    review_data["created_at"] = datetime.now(timezone.utc).isoformat()
    review_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.reviews.insert_one(review_data)
    
    return {
        "message": "Thank you for your review! It will be published after approval.",
        "id": review_data["id"]
    }


@api_router.post("/reviews/generate-fake")
async def generate_fake_reviews(
    count: int = 200,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Generate fake/placeholder reviews for testing"""
    import random
    
    # DME-specific review templates
    first_names = ["Sarah", "Michael", "Jennifer", "David", "Lisa", "Robert", "Maria", "James", "Patricia", "William",
                   "Elizabeth", "Richard", "Barbara", "Joseph", "Susan", "Thomas", "Jessica", "Charles", "Margaret", "Daniel",
                   "Dorothy", "Matthew", "Nancy", "Anthony", "Karen", "Mark", "Betty", "Donald", "Helen", "Steven",
                   "Sandra", "Paul", "Ashley", "Andrew", "Kimberly", "Joshua", "Emily", "Kenneth", "Donna", "Kevin",
                   "Michelle", "Brian", "Carol", "George", "Amanda", "Timothy", "Melissa", "Ronald", "Deborah", "Edward"]
    
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
                  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"]
    
    cities = ["Tampa", "Orlando", "Miami", "Jacksonville", "St. Petersburg", "Clearwater", "Fort Lauderdale", "Sarasota",
              "Naples", "West Palm Beach", "Gainesville", "Tallahassee", "Pensacola", "Fort Myers", "Lakeland", "Brandon",
              "Wesley Chapel", "Spring Hill", "Ocala", "Daytona Beach"]
    
    titles = [
        "Excellent service and fast delivery!",
        "Life-changing equipment",
        "Professional and caring staff",
        "Highly recommend!",
        "Best DME provider in Florida",
        "Made the process so easy",
        "Outstanding customer service",
        "Quality equipment, fair prices",
        "They truly care about patients",
        "Five-star experience!",
        "Couldn't be happier",
        "Exceptional care",
        "Quick and efficient",
        "Very knowledgeable staff",
        "Went above and beyond",
        "Top-notch service",
        "Reliable and trustworthy",
        "Great communication",
        "Made a difficult time easier",
        "Fantastic experience overall"
    ]
    
    review_texts = [
        "I was so impressed with the level of care I received. The staff took the time to explain everything about my {product} and made sure I understood how to use it properly. Delivery was prompt and the equipment was in perfect condition.",
        "After struggling to find quality DME supplies, I finally found this company. They helped me get my {product} covered by insurance and delivered it within days. The customer service team is amazing!",
        "My elderly mother needed a {product} urgently. The team expedited the order and even set it up for her. They showed genuine compassion and professionalism throughout the process.",
        "I've been using their services for over a year now for my {product} supplies. Always reliable, always professional. They handle all the insurance paperwork which saves me so much time and stress.",
        "The staff went above and beyond when I needed a {product}. They followed up multiple times to make sure everything was working correctly. This level of service is rare these days.",
        "From the initial consultation to delivery, everything was seamless. My {product} arrived exactly when promised and the quality exceeded my expectations. Will definitely use them again.",
        "I was hesitant about ordering medical equipment online, but this company made it so easy. They walked me through the entire process for my {product} and answered all my questions patiently.",
        "Excellent experience! They helped coordinate with my doctor's office to get the necessary paperwork for my {product}. The whole team is friendly, professional, and knowledgeable.",
        "What sets this company apart is their follow-up care. After receiving my {product}, they called to check on me and make sure I was satisfied. That personal touch means everything.",
        "I can't say enough good things about this DME provider. My {product} was delivered on time, the billing was transparent, and the customer service was exceptional. Highly recommend!",
        "The technician who delivered my {product} was incredibly helpful. He took the time to show me all the features and even helped with the initial setup. True professionals!",
        "As a caregiver for my father, dealing with DME companies used to be stressful. This company changed that completely. They make getting a {product} simple and hassle-free.",
        "I was referred by my doctor and I'm so glad I chose this provider for my {product}. The quality of equipment and service is outstanding. They treat patients like family.",
        "Quick turnaround, excellent communication, and fair pricing. My {product} was exactly what I needed. The team even helped me understand my insurance benefits better.",
        "This company restored my faith in healthcare services. They genuinely care about their patients. My experience getting a {product} was smooth from start to finish."
    ]
    
    products = ["wheelchair", "hospital bed", "CPAP machine", "oxygen concentrator", "walker", "mobility scooter",
                "power wheelchair", "lift chair", "nebulizer", "compression stockings", "diabetic supplies",
                "wound care supplies", "bath safety equipment", "orthopedic braces", "blood pressure monitor"]
    
    transaction_types = ["Patient", "Caregiver", "Family Member", "Healthcare Provider"]
    
    reviewer_titles = ["Verified Patient", "Verified Customer", "Verified Buyer", "Medicare Patient", "Medicaid Patient"]
    
    generated = []
    
    for i in range(count):
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        city = random.choice(cities)
        product = random.choice(products)
        rating = random.choices([5, 5, 5, 5, 4, 4, 5], weights=[30, 25, 20, 15, 5, 3, 2])[0]  # Mostly 5 stars
        
        review_text = random.choice(review_texts).format(product=product)
        
        review_data = {
            "id": str(uuid.uuid4()),
            "title": random.choice(titles),
            "text": review_text,
            "rating": rating,
            "reviewer_name": f"{fname} {lname[0]}.",
            "reviewer_email": f"{fname.lower()}.{lname.lower()}@email.com",
            "reviewer_phone": f"813-555-{random.randint(1000, 9999)}",
            "reviewer_title": random.choice(reviewer_titles),
            "reviewer_location": f"{city}, FL",
            "transaction_type": random.choice(transaction_types),
            "product_purchased": product,
            "source": random.choice(["Website", "Google", "Manual"]),
            "status": "approved",
            "featured": random.random() < 0.1,  # 10% featured
            "show_on_homepage": True,
            "is_fake": True,  # Marked as fake for easy deletion
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365))).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        generated.append(review_data)
    
    # Insert all at once
    if generated:
        await db.reviews.insert_many(generated)
    
    return {"message": f"Generated {len(generated)} fake reviews", "count": len(generated)}


# ========================================
# ==================== JOFFRY AI CHAT SYSTEM ====================
# ========================================

from emergentintegrations.llm.chat import LlmChat, UserMessage

# Chat status enum
class ChatStatus(str, Enum):
    ACTIVE = "active"
    WAITING_HUMAN = "waiting_human"
    WITH_HUMAN = "with_human"
    CLOSED = "closed"

class ChatMessageType(str, Enum):
    USER = "user"
    AI = "ai"
    AGENT = "agent"
    SYSTEM = "system"
    WHISPER = "whisper"  # Private message from supervisor to agent

# Pydantic models for chat
class ChatMessageCreate(BaseModel):
    text: str
    session_id: str

class AgentAvailability(BaseModel):
    is_available: bool
    available_from: Optional[str] = None  # HH:MM format
    available_to: Optional[str] = None    # HH:MM format

class WhisperMessage(BaseModel):
    chat_id: str
    agent_id: str
    text: str

# Knowledge base for Joffry
JOFFRY_SYSTEM_PROMPT = """You are Joffry, a friendly and professional AI assistant for MediNova Medical Supplies, a Medicare-certified Durable Medical Equipment (DME) supplier with Nationwide Delivery.

**About MediNova Medical Supplies:**
- Medicare-accredited DME supplier serving all 50 US states
- Phone: (248) 886-4-DME (4363)
- Service Area: Nationwide Delivery across all 50 states
- Email: info@medinovadme.com
- HIPAA compliant, dedicated to patient privacy and care

**Our Products:**
- Back Braces (lumbar support, posture correctors)
- Knee Braces (stabilizers, compression sleeves, hinged braces)
- Wheelchairs (manual, power, lightweight, transport)
- Walkers (standard, rollators, knee walkers)
- Hospital Beds (semi-electric, full-electric, low beds)
- CPAP Machines and supplies
- Oxygen concentrators
- Mobility scooters
- Bath safety equipment
- Diabetic supplies
- Wound care supplies
- Compression stockings

**Insurance & Coverage:**
- We work with Medicare Part B
- We handle insurance verification and paperwork
- We coordinate with doctors for prescriptions
- Most equipment is covered with little to no out-of-pocket cost

**Your Personality:**
- Friendly and warm, but professional
- Helpful and knowledgeable about DME products
- Patient and understanding, especially with elderly patients
- Always offer to connect users with a human representative if they need more help
- Never provide medical advice - recommend consulting with their doctor

**Important Guidelines:**
- If asked about specific medical conditions, recommend consulting their doctor
- If asked about pricing, explain that costs depend on insurance coverage
- If user seems frustrated or has complex questions, offer to connect them with a human
- Always be respectful of patient privacy (HIPAA)
- Keep responses concise but helpful

If the user wants to speak with a human representative, let them know you'll connect them right away."""

# Store active chat sessions in memory (for real-time features)
active_chats = {}  # chat_id -> {session_id, agent_id, supervisor_ids, typing_text, etc.}
agent_availability = {}  # user_id -> availability settings


@api_router.post("/chat/start")
async def start_chat_session(
    visitor_name: Optional[str] = None,
    visitor_email: Optional[str] = None
):
    """Start a new chat session for a website visitor"""
    chat_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    chat_data = {
        "id": chat_id,
        "session_id": session_id,
        "visitor_name": visitor_name,
        "visitor_email": visitor_email,
        "status": ChatStatus.ACTIVE,
        "messages": [],
        "agent_id": None,
        "supervisor_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "summary": None,
        "converted_to_lead": False,
        "lead_id": None
    }
    
    await db.chats.insert_one(chat_data)
    
    # Add to active chats
    active_chats[chat_id] = {
        "session_id": session_id,
        "agent_id": None,
        "supervisor_ids": [],
        "typing_text": "",
        "status": ChatStatus.ACTIVE
    }
    
    # Send welcome message from Joffry
    welcome_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.AI,
        "text": "Hi there! 👋 I'm Joffry, your virtual assistant at MediNova Medical Supplies. I'm here to help you learn about our Medicare-covered medical equipment. How can I assist you today?",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {"$push": {"messages": welcome_message}}
    )
    
    return {
        "chat_id": chat_id,
        "session_id": session_id,
        "welcome_message": welcome_message
    }


@api_router.post("/chat/message")
async def send_chat_message(message: ChatMessageCreate):
    """Send a message in a chat session"""
    chat = await db.chats.find_one({"session_id": message.session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_id = chat["id"]
    
    # Store user message
    user_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.USER,
        "text": message.text,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$push": {"messages": user_message},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Update typing indicator in active chats
    if chat_id in active_chats:
        active_chats[chat_id]["typing_text"] = ""
    
    # If chat is with human agent, don't generate AI response
    if chat["status"] == ChatStatus.WITH_HUMAN:
        return {"message": user_message, "ai_response": None}
    
    # Generate AI response using Joffry
    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        
        # Build conversation history for context
        history_messages = chat.get("messages", [])[-10:]  # Last 10 messages for context
        conversation_context = "\n".join([
            f"{'User' if m['type'] == 'user' else 'Joffry'}: {m['text']}"
            for m in history_messages
        ])
        
        enhanced_prompt = f"{JOFFRY_SYSTEM_PROMPT}\n\nConversation so far:\n{conversation_context}\n\nUser's latest message: {message.text}"
        
        chat_llm = LlmChat(
            api_key=llm_key,
            session_id=f"joffry-{chat_id}",
            system_message=JOFFRY_SYSTEM_PROMPT
        ).with_model("openai", "gpt-5.2")
        
        user_msg = UserMessage(text=message.text)
        ai_response_text = await chat_llm.send_message(user_msg)
        
        # Store AI response
        ai_message = {
            "id": str(uuid.uuid4()),
            "type": ChatMessageType.AI,
            "text": ai_response_text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.chats.update_one(
            {"id": chat_id},
            {"$push": {"messages": ai_message}}
        )
        
        return {"message": user_message, "ai_response": ai_message}
        
    except Exception as e:
        logger.error(f"Error generating AI response: {e}")
        # Fallback response
        fallback_message = {
            "id": str(uuid.uuid4()),
            "type": ChatMessageType.AI,
            "text": "I apologize, but I'm having a moment. Would you like me to connect you with a human representative? They can help you right away!",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chats.update_one(
            {"id": chat_id},
            {"$push": {"messages": fallback_message}}
        )
        return {"message": user_message, "ai_response": fallback_message}


@api_router.post("/chat/request-human")
async def request_human_agent(session_id: str):
    """Request to speak with a human agent"""
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_id = chat["id"]
    
    # Update chat status
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$set": {
                "status": ChatStatus.WAITING_HUMAN,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update active chat status
    if chat_id in active_chats:
        active_chats[chat_id]["status"] = ChatStatus.WAITING_HUMAN
    
    # Add system message
    system_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.SYSTEM,
        "text": "You've requested to speak with a human representative. Please hold while we connect you with the next available agent.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {"$push": {"messages": system_message}}
    )
    
    # Create notification for available agents
    notification = {
        "id": str(uuid.uuid4()),
        "type": "chat_request",
        "chat_id": chat_id,
        "visitor_name": chat.get("visitor_name"),
        "message_preview": chat.get("messages", [{}])[-1].get("text", "")[:100] if chat.get("messages") else "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    await db.chat_notifications.insert_one(notification)
    
    return {"message": system_message, "status": ChatStatus.WAITING_HUMAN}


@api_router.post("/chat/typing")
async def update_typing_status(session_id: str, text: str = ""):
    """Update typing indicator (what user is typing in real-time)"""
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_id = chat["id"]
    
    # Update typing text in active chats
    if chat_id in active_chats:
        active_chats[chat_id]["typing_text"] = text
    
    return {"status": "ok"}


@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    return chat


@api_router.post("/chat/upload")
async def upload_chat_attachment(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    is_agent: str = Form(default="false")
):
    """Upload a file attachment in a chat"""
    import os
    import base64
    
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_id = chat["id"]
    
    # Read file content
    file_content = await file.read()
    
    # Validate file size (max 10MB)
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"chat_{chat_id}_{uuid.uuid4()}{file_ext}"
    
    # Store file in uploads directory
    upload_dir = Path("/app/uploads/chat")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / unique_filename
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Create attachment record
    attachment = {
        "id": str(uuid.uuid4()),
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(file_content),
        "url": f"/api/uploads/chat/{unique_filename}",
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Create message with attachment
    message_type = "agent" if is_agent.lower() == "true" else "user"
    message = {
        "id": str(uuid.uuid4()),
        "type": message_type,
        "text": file.filename,
        "attachment": attachment,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Add message to chat
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "File uploaded", "attachment": attachment}


# Serve uploaded chat files
@app.get("/api/uploads/chat/{filename}", include_in_schema=False)
async def serve_chat_upload(filename: str):
    """Serve uploaded chat files"""
    from fastapi.responses import FileResponse
    
    file_path = Path(f"/app/uploads/chat/{filename}")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)


@api_router.post("/chat/convert-to-lead")
async def convert_chat_to_lead(session_id: str):
    """Convert a chat to a lead"""
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    if chat.get("converted_to_lead"):
        return {"message": "Already converted to lead", "lead_id": chat.get("lead_id")}
    
    # Create lead from chat
    lead_data = {
        "id": str(uuid.uuid4()),
        "first_name": chat.get("visitor_name", "").split()[0] if chat.get("visitor_name") else "Chat",
        "last_name": " ".join(chat.get("visitor_name", "").split()[1:]) if chat.get("visitor_name") else "Visitor",
        "email": chat.get("visitor_email"),
        "phone": "",
        "source": "Chat - Joffry AI",
        "status": LeadStatus.NEW,
        "notes": f"Lead created from chat conversation. Chat ID: {chat['id']}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leads.insert_one(lead_data)
    
    # Update chat with lead reference
    await db.chats.update_one(
        {"id": chat["id"]},
        {
            "$set": {
                "converted_to_lead": True,
                "lead_id": lead_data["id"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Converted to lead", "lead_id": lead_data["id"]}


# --- Admin/Sales Chat Endpoints ---

@api_router.get("/chat/admin/pending")
async def get_pending_chats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Get chats waiting for human agent"""
    chats = await db.chats.find(
        {"status": ChatStatus.WAITING_HUMAN},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(length=50)
    
    return {"chats": chats}


@api_router.get("/chat/admin/active")
async def get_active_chats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Get all active chats (for admin to monitor)"""
    chats = await db.chats.find(
        {"status": {"$in": [ChatStatus.ACTIVE, ChatStatus.WAITING_HUMAN, ChatStatus.WITH_HUMAN]}},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(length=100)
    
    # Add real-time typing info
    for chat in chats:
        if chat["id"] in active_chats:
            chat["typing_text"] = active_chats[chat["id"]].get("typing_text", "")
    
    return {"chats": chats}


@api_router.get("/chat/admin/my-chats")
async def get_my_assigned_chats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Get chats assigned to current agent"""
    chats = await db.chats.find(
        {"agent_id": current_user["id"], "status": ChatStatus.WITH_HUMAN},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(length=50)
    
    return {"chats": chats}


@api_router.post("/chat/admin/join/{chat_id}")
async def join_chat_as_agent(
    chat_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Agent joins a chat to assist customer"""
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Update chat with agent
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$set": {
                "agent_id": current_user["id"],
                "agent_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or current_user.get('email'),
                "status": ChatStatus.WITH_HUMAN,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update active chat
    if chat_id in active_chats:
        active_chats[chat_id]["agent_id"] = current_user["id"]
        active_chats[chat_id]["status"] = ChatStatus.WITH_HUMAN
    
    # Add system message
    agent_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or "A representative"
    system_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.SYSTEM,
        "text": f"{agent_name} has joined the chat and is here to help you!",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {"$push": {"messages": system_message}}
    )
    
    # Mark notification as read
    await db.chat_notifications.update_many(
        {"chat_id": chat_id},
        {"$set": {"read": True}}
    )
    
    return {"message": "Joined chat", "system_message": system_message}


@api_router.post("/chat/admin/message/{chat_id}")
async def send_agent_message(
    chat_id: str,
    text: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Agent sends a message to customer"""
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.get("agent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this chat")
    
    agent_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or "Agent"
    
    agent_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.AGENT,
        "text": text,
        "agent_id": current_user["id"],
        "agent_name": agent_name,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$push": {"messages": agent_message},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": agent_message}


@api_router.post("/chat/admin/whisper/{chat_id}")
async def send_whisper_message(
    chat_id: str,
    agent_id: str,
    text: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Supervisor sends a private whisper to agent (customer can't see)"""
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    supervisor_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or "Supervisor"
    
    whisper_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.WHISPER,
        "text": text,
        "from_id": current_user["id"],
        "from_name": supervisor_name,
        "to_agent_id": agent_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {"$push": {"messages": whisper_message}}
    )
    
    return {"message": whisper_message}


@api_router.post("/chat/admin/supervise/{chat_id}")
async def start_supervising_chat(
    chat_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Admin starts supervising a chat (can see everything, whisper to agent)"""
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Add supervisor to chat
    await db.chats.update_one(
        {"id": chat_id},
        {"$addToSet": {"supervisor_ids": current_user["id"]}}
    )
    
    # Update active chat
    if chat_id in active_chats:
        if current_user["id"] not in active_chats[chat_id].get("supervisor_ids", []):
            active_chats[chat_id].setdefault("supervisor_ids", []).append(current_user["id"])
    
    return {"message": "Now supervising chat"}


@api_router.get("/chat/admin/typing/{chat_id}")
async def get_user_typing(
    chat_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Get what user is currently typing (real-time)"""
    if chat_id in active_chats:
        return {"typing_text": active_chats[chat_id].get("typing_text", "")}
    return {"typing_text": ""}


@api_router.post("/chat/admin/close/{chat_id}")
async def close_chat(
    chat_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Close a chat session"""
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Generate summary using AI
    summary = None
    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        messages = chat.get("messages", [])
        conversation = "\n".join([f"{m['type']}: {m['text']}" for m in messages if m['type'] != 'whisper'])
        
        summary_chat = LlmChat(
            api_key=llm_key,
            session_id=f"summary-{chat_id}",
            system_message="You are a helpful assistant that summarizes customer service conversations. Provide a brief summary of the key points, customer needs, and outcomes."
        ).with_model("openai", "gpt-5.2")
        
        summary_prompt = UserMessage(text=f"Please summarize this customer service conversation:\n\n{conversation}")
        summary = await summary_chat.send_message(summary_prompt)
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        summary = "Summary generation failed"
    
    # Update chat
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$set": {
                "status": ChatStatus.CLOSED,
                "summary": summary,
                "closed_at": datetime.now(timezone.utc).isoformat(),
                "closed_by": current_user["id"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Remove from active chats
    if chat_id in active_chats:
        del active_chats[chat_id]
    
    # Add closing message
    system_message = {
        "id": str(uuid.uuid4()),
        "type": ChatMessageType.SYSTEM,
        "text": "This chat session has been closed. Thank you for contacting MediNova Medical Supplies!",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {"$push": {"messages": system_message}}
    )
    
    return {"message": "Chat closed", "summary": summary}


@api_router.get("/chat/admin/notifications")
async def get_chat_notifications(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Get unread chat notifications"""
    notifications = await db.chat_notifications.find(
        {"read": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)
    
    return {"notifications": notifications, "count": len(notifications)}


@api_router.post("/chat/admin/availability")
async def set_agent_availability(
    availability: AgentAvailability,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Set agent availability status"""
    await db.agent_availability.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                "is_available": availability.is_available,
                "available_from": availability.available_from,
                "available_to": availability.available_to,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Update in-memory store
    agent_availability[current_user["id"]] = {
        "is_available": availability.is_available,
        "available_from": availability.available_from,
        "available_to": availability.available_to
    }
    
    return {"message": "Availability updated"}


@api_router.get("/chat/admin/availability")
async def get_agent_availability(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP))
):
    """Get current agent availability"""
    availability = await db.agent_availability.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return availability or {"is_available": False, "available_from": None, "available_to": None}


@api_router.get("/chat/admin/stats")
async def get_chat_stats(
    current_user: dict = Depends(require_roles(UserRole.ADMIN))
):
    """Get chat statistics"""
    total = await db.chats.count_documents({})
    active = await db.chats.count_documents({"status": {"$in": [ChatStatus.ACTIVE, ChatStatus.WAITING_HUMAN, ChatStatus.WITH_HUMAN]}})
    waiting = await db.chats.count_documents({"status": ChatStatus.WAITING_HUMAN})
    with_human = await db.chats.count_documents({"status": ChatStatus.WITH_HUMAN})
    closed = await db.chats.count_documents({"status": ChatStatus.CLOSED})
    converted = await db.chats.count_documents({"converted_to_lead": True})
    
    # Get available agents
    available_agents = await db.agent_availability.count_documents({"is_available": True})
    
    return {
        "total": total,
        "active": active,
        "waiting_for_human": waiting,
        "with_human": with_human,
        "closed": closed,
        "converted_to_leads": converted,
        "available_agents": available_agents
    }


# ==================== CHAT ADMIN DASHBOARD ROUTES ====================

@api_router.get("/chat/admin/dashboard")
async def get_chat_admin_dashboard(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP, UserRole.SUPER_ADMIN))
):
    """Get complete chat dashboard data - stats, pending chats, and active chats"""
    # Get stats
    total = await db.chats.count_documents({})
    waiting = await db.chats.count_documents({"status": ChatStatus.WAITING_HUMAN})
    with_human = await db.chats.count_documents({"status": ChatStatus.WITH_HUMAN})
    
    stats = {
        "total": total,
        "waiting_for_agent": waiting,
        "with_agent": with_human
    }
    
    # Get pending chats (waiting for human)
    pending_chats = await db.chats.find(
        {"status": ChatStatus.WAITING_HUMAN},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(length=50)
    
    # Get active chats (with human agent)
    active_chats = await db.chats.find(
        {"status": ChatStatus.WITH_HUMAN},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(length=50)
    
    # Add typing indicators for active chats
    for chat in active_chats:
        if chat["id"] in active_chats:
            chat["typing_text"] = active_chats[chat["id"]].get("typing_text", "")
    
    return {
        "stats": stats,
        "pending_chats": pending_chats,
        "active_chats": active_chats
    }


@api_router.get("/chat/admin/chat/{chat_id}")
async def get_chat_details(
    chat_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP, UserRole.SUPER_ADMIN))
):
    """Get detailed chat information including messages"""
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return chat


@api_router.delete("/chat/admin/chat/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SUPER_ADMIN))
):
    """Delete a chat and its attachments"""
    import shutil
    
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Delete associated files
    messages = chat.get("messages", [])
    for msg in messages:
        attachment = msg.get("attachment")
        if attachment and attachment.get("url"):
            # Extract filename from URL
            url = attachment["url"]
            if "/api/uploads/chat/" in url:
                filename = url.split("/api/uploads/chat/")[-1]
                file_path = Path(f"/app/uploads/chat/{filename}")
                if file_path.exists():
                    try:
                        file_path.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete attachment file: {e}")
    
    # Delete chat from database
    await db.chats.delete_one({"id": chat_id})
    
    # Delete related notifications
    await db.chat_notifications.delete_many({"chat_id": chat_id})
    
    # Remove from active chats if present
    if chat_id in active_chats:
        del active_chats[chat_id]
    
    return {"message": "Chat deleted successfully"}


@api_router.post("/chat/admin/set-availability")
async def set_agent_availability_simple(
    is_available: bool = Query(...),
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP, UserRole.SUPER_ADMIN))
):
    """Simple endpoint to set agent availability via query param"""
    await db.agent_availability.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                "is_available": is_available,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Update in-memory store
    agent_availability[current_user["id"]] = {
        "is_available": is_available,
        "available_from": None,
        "available_to": None
    }
    
    return {"message": "Availability updated", "is_available": is_available}


@api_router.post("/chat/admin/message")
async def send_agent_message_simple(
    request: dict,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SALES_REP, UserRole.SUPER_ADMIN))
):
    """Send a message as an agent - accepts session_id in body"""
    session_id = request.get("session_id")
    text = request.get("text")
    
    if not session_id or not text:
        raise HTTPException(status_code=400, detail="session_id and text are required")
    
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    chat_id = chat["id"]
    agent_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or "Agent"
    
    agent_message = {
        "id": str(uuid.uuid4()),
        "type": "agent",
        "text": text,
        "agent_id": current_user["id"],
        "agent_name": agent_name,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {"$push": {"messages": agent_message}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Message sent", "agent_message": agent_message}


# ==================== CHAT ROUND ROBIN ROUTES ====================

@api_router.get("/chat/round-robin/settings")
async def get_round_robin_settings(current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.SUPER_ADMIN))):
    """Get round robin settings including agent order and opt-out status"""
    settings = await db.chat_round_robin.find_one({"type": "settings"}, {"_id": 0})
    
    if not settings:
        # Initialize with super admin in rotation by default
        super_admins = await db.users.find({"role": "super_admin"}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "role": 1}).to_list(length=100)
        admins = await db.users.find({"role": {"$in": ["admin", "sales_manager", "sales_rep"]}}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "role": 1}).to_list(length=100)
        
        all_agents = super_admins + admins
        agent_order = [{"user_id": a["id"], "order": i, "opted_out": False} for i, a in enumerate(all_agents)]
        
        settings = {
            "type": "settings",
            "agent_order": agent_order,
            "current_index": 0,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_round_robin.insert_one(settings)
    
    # Enrich with user details
    user_ids = [a["user_id"] for a in settings.get("agent_order", [])]
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(length=100)
    user_map = {u["id"]: u for u in users}
    
    # Get availability status for each agent
    availabilities = await db.agent_availability.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(length=100)
    avail_map = {a["user_id"]: a.get("is_available", False) for a in availabilities}
    
    enriched_order = []
    for agent in settings.get("agent_order", []):
        user = user_map.get(agent["user_id"], {})
        enriched_order.append({
            **agent,
            "first_name": user.get("first_name", "Unknown"),
            "last_name": user.get("last_name", ""),
            "email": user.get("email", ""),
            "role": user.get("role", ""),
            "is_available": avail_map.get(agent["user_id"], False)
        })
    
    return {
        "agent_order": enriched_order,
        "current_index": settings.get("current_index", 0),
        "enabled": settings.get("enabled", True)
    }

@api_router.put("/chat/round-robin/settings")
async def update_round_robin_settings(data: dict, current_user: dict = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """Update round robin settings - reorder agents or enable/disable"""
    updates = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if "agent_order" in data:
        # Validate and update agent order
        updates["agent_order"] = [
            {"user_id": a["user_id"], "order": i, "opted_out": a.get("opted_out", False)}
            for i, a in enumerate(data["agent_order"])
        ]
    
    if "enabled" in data:
        updates["enabled"] = data["enabled"]
    
    if "current_index" in data:
        updates["current_index"] = data["current_index"]
    
    await db.chat_round_robin.update_one(
        {"type": "settings"},
        {"$set": updates},
        upsert=True
    )
    
    return {"message": "Round robin settings updated"}

@api_router.post("/chat/round-robin/opt-out")
async def opt_out_round_robin(current_user: dict = Depends(get_current_user)):
    """Opt out of round robin rotation"""
    await db.chat_round_robin.update_one(
        {"type": "settings", "agent_order.user_id": current_user["id"]},
        {"$set": {"agent_order.$.opted_out": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Opted out of round robin"}

@api_router.post("/chat/round-robin/opt-in")
async def opt_in_round_robin(current_user: dict = Depends(get_current_user)):
    """Opt back into round robin rotation"""
    await db.chat_round_robin.update_one(
        {"type": "settings", "agent_order.user_id": current_user["id"]},
        {"$set": {"agent_order.$.opted_out": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Opted into round robin"}

@api_router.get("/chat/round-robin/next-agent")
async def get_next_round_robin_agent():
    """Get the next available agent in the round robin rotation"""
    settings = await db.chat_round_robin.find_one({"type": "settings"}, {"_id": 0})
    
    if not settings or not settings.get("enabled"):
        return {"agent_id": None, "message": "Round robin disabled"}
    
    agent_order = settings.get("agent_order", [])
    current_index = settings.get("current_index", 0)
    
    # Find next available agent
    checked = 0
    while checked < len(agent_order):
        idx = (current_index + checked) % len(agent_order)
        agent = agent_order[idx]
        
        if not agent.get("opted_out"):
            # Check if agent is available
            avail = await db.agent_availability.find_one({"user_id": agent["user_id"]})
            if avail and avail.get("is_available"):
                # Update index for next time
                next_idx = (idx + 1) % len(agent_order)
                await db.chat_round_robin.update_one(
                    {"type": "settings"},
                    {"$set": {"current_index": next_idx}}
                )
                
                # Get agent details
                user = await db.users.find_one({"id": agent["user_id"]}, {"_id": 0, "password_hash": 0})
                return {
                    "agent_id": agent["user_id"],
                    "agent_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Agent",
                    "agent_email": user.get("email") if user else None
                }
        
        checked += 1
    
    return {"agent_id": None, "message": "No available agents"}

@api_router.get("/chat/round-robin/available-agents")
async def get_available_agents_for_rotation(current_user: dict = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """Get all users eligible for round robin rotation"""
    eligible_roles = ["super_admin", "admin", "sales_manager", "sales_rep"]
    users = await db.users.find(
        {"role": {"$in": eligible_roles}},
        {"_id": 0, "password_hash": 0}
    ).to_list(length=200)
    
    # Get current rotation list
    settings = await db.chat_round_robin.find_one({"type": "settings"}, {"_id": 0})
    current_ids = [a["user_id"] for a in settings.get("agent_order", [])] if settings else []
    
    # Mark which users are already in rotation
    for user in users:
        user["in_rotation"] = user["id"] in current_ids
    
    return {"users": users}

@api_router.post("/chat/round-robin/add-agent")
async def add_agent_to_rotation(data: dict, current_user: dict = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """Add an agent to the round robin rotation"""
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Verify user exists and has eligible role
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings = await db.chat_round_robin.find_one({"type": "settings"})
    agent_order = settings.get("agent_order", []) if settings else []
    
    # Check if already in rotation
    if any(a["user_id"] == user_id for a in agent_order):
        raise HTTPException(status_code=400, detail="User already in rotation")
    
    # Add to end of rotation
    agent_order.append({
        "user_id": user_id,
        "order": len(agent_order),
        "opted_out": False
    })
    
    await db.chat_round_robin.update_one(
        {"type": "settings"},
        {"$set": {"agent_order": agent_order, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Agent added to rotation"}

@api_router.delete("/chat/round-robin/remove-agent/{user_id}")
async def remove_agent_from_rotation(user_id: str, current_user: dict = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """Remove an agent from the round robin rotation"""
    settings = await db.chat_round_robin.find_one({"type": "settings"})
    if not settings:
        raise HTTPException(status_code=404, detail="Round robin not configured")
    
    agent_order = [a for a in settings.get("agent_order", []) if a["user_id"] != user_id]
    
    # Re-index orders
    for i, agent in enumerate(agent_order):
        agent["order"] = i
    
    await db.chat_round_robin.update_one(
        {"type": "settings"},
        {"$set": {"agent_order": agent_order, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Agent removed from rotation"}


# ==================== SUPPORT TICKETS ROUTES ====================

class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"

class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

@api_router.get("/tickets")
async def get_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get support tickets with filters"""
    query = {}
    
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if source:
        query["source"] = source
    if assigned_to:
        query["assigned_to"] = assigned_to
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"contact_name": {"$regex": search, "$options": "i"}},
            {"contact_email": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.tickets.count_documents(query)
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Get stats
    stats = {
        "total": await db.tickets.count_documents({}),
        "open": await db.tickets.count_documents({"status": "open"}),
        "in_progress": await db.tickets.count_documents({"status": "in_progress"}),
        "pending": await db.tickets.count_documents({"status": "pending"}),
        "resolved": await db.tickets.count_documents({"status": "resolved"}),
        "closed": await db.tickets.count_documents({"status": "closed"})
    }
    
    return {"tickets": tickets, "total": total, "stats": stats}

@api_router.post("/tickets")
async def create_ticket(ticket_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new support ticket"""
    ticket_count = await db.tickets.count_documents({})
    ticket_number = f"TKT-{ticket_count + 1001:05d}"
    
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": ticket_number,
        "subject": ticket_data.get("subject", "No subject"),
        "description": ticket_data.get("description", ""),
        "status": "open",
        "priority": ticket_data.get("priority", "medium"),
        "source": ticket_data.get("source", "manual"),
        "source_id": ticket_data.get("source_id"),
        "contact_name": ticket_data.get("contact_name"),
        "contact_email": ticket_data.get("contact_email"),
        "contact_phone": ticket_data.get("contact_phone"),
        "patient_id": ticket_data.get("patient_id"),
        "assigned_to": ticket_data.get("assigned_to"),
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "chat_messages": ticket_data.get("chat_messages", []),
        "notes": [],
        "tags": ticket_data.get("tags", [])
    }
    
    await db.tickets.insert_one(ticket)
    await log_audit(current_user["id"], current_user["email"], "TICKET_CREATED", "tickets", ticket["id"])
    
    return {"id": ticket["id"], "ticket_number": ticket_number, "message": "Ticket created successfully"}

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific ticket"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get assignee info if assigned
    if ticket.get("assigned_to"):
        assignee = await db.users.find_one({"id": ticket["assigned_to"]}, {"_id": 0, "password_hash": 0})
        ticket["assignee"] = assignee
    
    return ticket

@api_router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    """Update a ticket"""
    allowed_fields = ["subject", "description", "status", "priority", "assigned_to", "patient_id", "tags"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.tickets.update_one({"id": ticket_id}, {"$set": filtered_updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    await log_audit(current_user["id"], current_user["email"], "TICKET_UPDATED", "tickets", ticket_id)
    return {"message": "Ticket updated successfully"}

@api_router.post("/tickets/{ticket_id}/notes")
async def add_ticket_note(ticket_id: str, note_data: dict, current_user: dict = Depends(get_current_user)):
    """Add a note to a ticket"""
    note = {
        "id": str(uuid.uuid4()),
        "text": note_data.get("text", ""),
        "is_internal": note_data.get("is_internal", False),
        "created_by": current_user["id"],
        "created_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$push": {"notes": note}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": "Note added successfully", "note": note}

@api_router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a ticket"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete tickets")
    
    result = await db.tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    await log_audit(current_user["id"], current_user["email"], "TICKET_DELETED", "tickets", ticket_id)
    return {"message": "Ticket deleted successfully"}

@api_router.post("/chat/admin/assign-patient")
async def assign_chat_to_patient(data: dict, current_user: dict = Depends(get_current_user)):
    """Assign a chat to a patient record and close it"""
    chat_id = data.get("chat_id")
    patient_id = data.get("patient_id")
    
    if not chat_id or not patient_id:
        raise HTTPException(status_code=400, detail="chat_id and patient_id are required")
    
    # Update chat with patient assignment and close it
    result = await db.chats.update_one(
        {"id": chat_id},
        {"$set": {
            "patient_id": patient_id, 
            "status": ChatStatus.CLOSED,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "closed_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Remove from active chats in memory
    if chat_id in active_chats:
        del active_chats[chat_id]
    
    return {"message": "Chat assigned to patient and closed successfully"}


@api_router.post("/chat/admin/assign-lead")
async def assign_chat_to_lead(data: dict, current_user: dict = Depends(get_current_user)):
    """Assign a chat to a lead record and close it"""
    chat_id = data.get("chat_id")
    lead_id = data.get("lead_id")
    
    if not chat_id or not lead_id:
        raise HTTPException(status_code=400, detail="chat_id and lead_id are required")
    
    # Verify lead exists
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update chat with lead assignment and close it
    result = await db.chats.update_one(
        {"id": chat_id},
        {"$set": {
            "lead_id": lead_id,
            "status": ChatStatus.CLOSED,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "closed_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Remove from active chats in memory
    if chat_id in active_chats:
        del active_chats[chat_id]
    
    return {"message": "Chat assigned to lead and closed successfully"}


@api_router.post("/chat/admin/create-lead-from-chat")
async def create_lead_from_chat(data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new lead from chat visitor info and assign the chat to it"""
    chat_id = data.get("chat_id")
    
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")
    
    # Get the chat
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Create new lead from chat visitor info
    lead_id = str(uuid.uuid4())
    visitor_name = chat.get("visitor_name", "Chat Visitor")
    name_parts = visitor_name.split(" ", 1)
    first_name = name_parts[0] if name_parts else "Chat"
    last_name = name_parts[1] if len(name_parts) > 1 else "Visitor"
    
    new_lead = {
        "id": lead_id,
        "first_name": first_name,
        "last_name": last_name,
        "email": chat.get("visitor_email", ""),
        "phone": chat.get("visitor_phone", ""),
        "status": "new",
        "source": "chat",
        "notes": f"Created from chat conversation on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
        "created_by": current_user["id"],
        "assigned_to": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leads.insert_one(new_lead)
    
    # Assign chat to the new lead and close it
    await db.chats.update_one(
        {"id": chat_id},
        {"$set": {
            "lead_id": lead_id,
            "status": ChatStatus.CLOSED,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "closed_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Remove from active chats in memory
    if chat_id in active_chats:
        del active_chats[chat_id]
    
    return {
        "message": "Lead created and chat assigned successfully",
        "lead": {
            "id": lead_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": new_lead["email"]
        }
    }


@api_router.post("/chat/request-callback")
async def request_callback(data: dict):
    """Customer requests a callback with their phone number"""
    session_id = data.get("session_id")
    phone = data.get("phone")
    
    if not session_id or not phone:
        raise HTTPException(status_code=400, detail="session_id and phone are required")
    
    chat = await db.chats.find_one({"session_id": session_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_id = chat["id"]
    
    # Update chat with callback request
    callback_message = {
        "id": str(uuid.uuid4()),
        "type": "callback_request",
        "text": f"📞 CALLBACK REQUESTED: {phone}",
        "phone": phone,
        "visitor_name": chat.get("visitor_name", "Visitor"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_urgent": True
    }
    
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$push": {"messages": callback_message},
            "$set": {
                "visitor_phone": phone,
                "has_callback_request": True,
                "callback_requested_at": datetime.now(timezone.utc).isoformat(),
                "status": ChatStatus.WAITING_HUMAN,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Callback request submitted", "callback_message": callback_message}


# ========================================
# HEALTHCARE.GOV CONTENT API PROXY
# ========================================

_hcgov_cache = {}
_HCGOV_CACHE_TTL = 3600  # 1 hour

async def _fetch_hcgov(endpoint: str):
    """Fetch and cache HealthCare.gov API data."""
    now = datetime.now(timezone.utc).timestamp()
    if endpoint in _hcgov_cache:
        cached_at, data = _hcgov_cache[endpoint]
        if now - cached_at < _HCGOV_CACHE_TTL:
            return data
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"https://www.healthcare.gov{endpoint}")
            resp.raise_for_status()
            data = resp.json()
            _hcgov_cache[endpoint] = (now, data)
            return data
    except Exception as e:
        logging.error(f"HealthCare.gov API error for {endpoint}: {e}")
        if endpoint in _hcgov_cache:
            return _hcgov_cache[endpoint][1]
        raise HTTPException(status_code=502, detail="Failed to fetch HealthCare.gov data")

@api_router.get("/healthcare-gov/articles")
async def get_hcgov_articles(
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Fetch articles from HealthCare.gov Content API."""
    data = await _fetch_hcgov("/api/articles.json")
    articles = data.get("articles", [])
    # Filter English only
    articles = [a for a in articles if a.get("lang", "en") == "en"]
    if search:
        q = search.lower()
        articles = [a for a in articles if q in (a.get("title", "") or "").lower() or q in (a.get("bite", "") or "").lower()]
    total = len(articles)
    articles = articles[skip:skip + limit]
    return {"articles": articles, "total": total}

@api_router.get("/healthcare-gov/glossary")
async def get_hcgov_glossary(
    search: Optional[str] = None,
    letter: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Fetch glossary terms from HealthCare.gov Content API."""
    data = await _fetch_hcgov("/api/glossary.json")
    terms = data.get("glossary", [])
    terms = [t for t in terms if t.get("lang", "en") == "en"]
    if letter:
        terms = [t for t in terms if (t.get("title", "") or "").upper().startswith(letter.upper())]
    if search:
        q = search.lower()
        terms = [t for t in terms if q in (t.get("title", "") or "").lower() or q in (t.get("bite", "") or "").lower()]
    total = len(terms)
    terms = terms[skip:skip + limit]
    return {"glossary": terms, "total": total}

@api_router.get("/healthcare-gov/content")
async def get_hcgov_content(
    url: str = Query(..., description="HealthCare.gov content path, e.g. /quality-ratings"),
    current_user: dict = Depends(get_current_user)
):
    """Fetch a single content page from HealthCare.gov."""
    clean = url.strip("/")
    data = await _fetch_hcgov(f"/{clean}.json")
    return {
        "title": data.get("title", ""),
        "content": data.get("content", ""),
        "bite": data.get("bite", ""),
        "url": data.get("url", ""),
        "date": data.get("date", ""),
        "meta_title": data.get("meta-title", ""),
        "meta_description": data.get("meta-description", ""),
        "tags": data.get("tags", []),
        "categories": data.get("categories", []),
    }

@api_router.get("/healthcare-gov/index")
async def get_hcgov_index(
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Fetch the full content index from HealthCare.gov."""
    data = await _fetch_hcgov("/api/index.json")
    items = data if isinstance(data, list) else []
    if category:
        items = [i for i in items if category in (i.get("categories", []) or [])]
    if search:
        q = search.lower()
        items = [i for i in items if q in (i.get("title", "") or "").lower() or q in (i.get("bite", "") or "").lower()]
    total = len(items)
    items = items[skip:skip + limit]
    return {"items": items, "total": total}


# ========================================
# CMS.GOV & MEDICARE DATA API PROXY
# ========================================

_cms_cache = {}
_CMS_CACHE_TTL = 3600  # 1 hour

CMS_DATASETS = {
    "dme-suppliers": {
        "id": "a2d56d3f-3531-4315-9d87-e29986516b41",
        "title": "Medicare DME Suppliers",
        "description": "Usage, payments, submitted charges and beneficiary info for DME suppliers",
    },
    "dme-supplier-services": {
        "id": "1746a83e-bb65-4300-8e02-21edbab77c6b",
        "title": "Medicare DME Services by Supplier",
        "description": "DME usage, payments and charges by supplier and HCPCS service code",
    },
    "dme-referring-providers": {
        "id": "f8603e5b-9c47-4c52-9b47-a4ef92dfada4",
        "title": "Medicare DME Referring Providers",
        "description": "DME usage, payments and charges by referring provider",
    },
    "dme-provider-services": {
        "id": "86b4807a-d63a-44be-bfdf-ffd398d5e623",
        "title": "Medicare DME Services by Referring Provider",
        "description": "DME usage, payments and charges by referring provider and HCPCS service",
    },
}

async def _fetch_cms_data(dataset_id: str, params: dict):
    """Fetch CMS data.cms.gov dataset with caching for stats."""
    url = f"https://data.cms.gov/data-api/v1/dataset/{dataset_id}/data"
    cache_key = f"{url}?{json.dumps(params, sort_keys=True)}"
    now = datetime.now(timezone.utc).timestamp()
    if cache_key in _cms_cache:
        cached_at, data = _cms_cache[cache_key]
        if now - cached_at < _CMS_CACHE_TTL:
            return data
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            _cms_cache[cache_key] = (now, data)
            return data
    except Exception as e:
        logging.error(f"CMS data API error for {dataset_id}: {e}")
        if cache_key in _cms_cache:
            return _cms_cache[cache_key][1]
        raise HTTPException(status_code=502, detail="Failed to fetch CMS data")

async def _fetch_cms_stats(dataset_id: str):
    """Fetch row count stats for a CMS dataset."""
    cache_key = f"stats_{dataset_id}"
    now = datetime.now(timezone.utc).timestamp()
    if cache_key in _cms_cache:
        cached_at, data = _cms_cache[cache_key]
        if now - cached_at < _CMS_CACHE_TTL:
            return data
    try:
        url = f"https://data.cms.gov/data-api/v1/dataset/{dataset_id}/data-viewer/stats"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            _cms_cache[cache_key] = (now, data)
            return data
    except Exception as e:
        logging.error(f"CMS stats API error: {e}")
        return {"data": {"total_rows": 0}}

@api_router.get("/cms-data/datasets")
async def get_cms_datasets(current_user: dict = Depends(get_current_user)):
    """List available CMS Medicare datasets with row counts."""
    results = []
    for key, ds in CMS_DATASETS.items():
        stats = await _fetch_cms_stats(ds["id"])
        total = stats.get("data", {}).get("total_rows", 0)
        results.append({
            "key": key,
            "dataset_id": ds["id"],
            "title": ds["title"],
            "description": ds["description"],
            "total_rows": total,
        })
    return {"datasets": results}

@api_router.get("/cms-data/{dataset_key}/data")
async def get_cms_dataset_data(
    dataset_key: str,
    search: Optional[str] = None,
    state: Optional[str] = None,
    size: int = 30,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Query a CMS dataset with filters and pagination."""
    if dataset_key not in CMS_DATASETS:
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset_key}")
    ds = CMS_DATASETS[dataset_key]
    params = {"size": min(size, 100), "offset": offset}

    # Build filters based on dataset type
    filter_idx = 1
    if state:
        state_field = "Suplr_Prvdr_State_Abrvtn" if "supplier" in dataset_key else "Rfrg_Prvdr_State_Abrvtn"
        params[f"filter[f{filter_idx}][condition][path]"] = state_field
        params[f"filter[f{filter_idx}][condition][operator]"] = "="
        params[f"filter[f{filter_idx}][condition][value]"] = state.upper()
        filter_idx += 1
    if search:
        name_field = "Suplr_Prvdr_Last_Name_Org" if "supplier" in dataset_key else "Rfrg_Prvdr_Last_Name_Org"
        params[f"filter[f{filter_idx}][condition][path]"] = name_field
        params[f"filter[f{filter_idx}][condition][operator]"] = "CONTAINS"
        params[f"filter[f{filter_idx}][condition][value]"] = search
        filter_idx += 1

    data = await _fetch_cms_data(ds["id"], params)
    rows = data if isinstance(data, list) else []
    return {
        "rows": rows,
        "count": len(rows),
        "dataset": ds["title"],
        "offset": offset,
        "size": size,
    }

@api_router.get("/cms-data/{dataset_key}/stats")
async def get_cms_dataset_stats(
    dataset_key: str,
    current_user: dict = Depends(get_current_user)
):
    """Get row count for a CMS dataset."""
    if dataset_key not in CMS_DATASETS:
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset_key}")
    ds = CMS_DATASETS[dataset_key]
    stats = await _fetch_cms_stats(ds["id"])
    return {
        "dataset": ds["title"],
        "total_rows": stats.get("data", {}).get("total_rows", 0),
    }


# ========================================
# STATIC PAGE SERVING ROUTES
# ========================================

# Serve sitemap.xml at root level (where Google expects it)
@app.get("/sitemap.xml", include_in_schema=False)
async def serve_sitemap_root():
    """Serve sitemap at /sitemap.xml - standard location for search engines"""
    return await generate_sitemap()

# Serve robots.txt at root level
@app.get("/robots.txt", include_in_schema=False)
async def serve_robots_root():
    """Serve robots.txt at /robots.txt - standard location"""
    return await get_robots_txt()

# Serve landing page at root
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_landing_page():
    """Serve the landing page at the root URL"""
    landing_path = Path("/app/frontend/public/landing.html")
    if landing_path.exists():
        return HTMLResponse(content=landing_path.read_text(), status_code=200)
    raise HTTPException(status_code=404, detail="Landing page not found")

# Serve locations index page (all 50 states)
@app.get("/locations/", response_class=HTMLResponse, include_in_schema=False)
async def serve_locations_index():
    """Serve a locations index page listing all 50 states"""
    site_settings = await db.site_settings.find_one({"type": "site"}, {"_id": 0})
    site_domain = normalize_public_site_url(site_settings.get("site_domain") if site_settings else SITE_URL)
    us_data = load_us_locations()
    if not us_data:
        raise HTTPException(status_code=404, detail="Location data not available")
    
    state_cards = ""
    total_counties = 0
    total_cities = 0
    for state_slug, state_info in sorted(us_data.items(), key=lambda x: x[1].get("name", "")):
        state_name = state_info.get("name", state_slug.replace("-", " ").title())
        county_count = len(state_info.get("counties", []))
        city_count = len(state_info.get("cities", []))
        total_counties += county_count
        total_cities += city_count
        total_pages = county_count + city_count + 1
        region = get_us_region(state_name)
        state_cards += f'''<a href="{site_domain}/locations/durable-medical-equipment-in-{state_slug}.html" class="state-card group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#ffcf70] hover:shadow-xl" data-name="{state_name}" data-region="{region}" data-pages="{total_pages}" data-counties="{county_count}" data-cities="{city_count}">
<div class="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ffcf70] to-transparent opacity-80"></div>
<div class="flex items-start justify-between gap-4">
<div><h3 class="text-2xl font-semibold text-slate-900 group-hover:text-[#ff9f1c]">{state_name}</h3><p class="text-sm text-slate-400 mt-1">{REGION_LABELS.get(region, 'Other')} Region</p></div>
<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{total_pages}</span>
</div>
<div class="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span>{county_count} counties</span><span>{city_count}+ cities</span></div>
</a>'''
    stats = {
        "states": len(us_data),
        "counties": total_counties,
        "cities": total_cities,
        "pages": total_counties + total_cities + len(us_data),
    }
    html = build_locations_index_html(site_domain, state_cards, stats)
    return HTMLResponse(content=html, status_code=200)

# Serve location pages dynamically
@app.get("/locations/{page_name}", response_class=HTMLResponse, include_in_schema=False)
async def serve_location_page(page_name: str):
    """Serve location pages directly at /locations/ URL - generates HTML on-demand"""
    if not is_safe_location_page_name(page_name):
        raise HTTPException(status_code=404, detail="Location page not found")

    # Generate on-demand from database metadata
    if page_name.endswith('.html'):
        slug = page_name.replace('durable-medical-equipment-in-', '').replace('.html', '')
        page = await db.generated_pages.find_one({"location_slug": slug}, {"_id": 0})
        
        if page:
            loc_name = page.get("location_name", slug.replace("-", " ").title())
            loc_type = page.get("location_type", "city")
            state_slug = page.get("parent_state", slug)
            
            # Get state name from US data
            us_data = load_us_locations()
            state_name = us_data.get(state_slug, {}).get("name", state_slug.replace("-", " ").title()) if us_data else state_slug.replace("-", " ").title()
            
            # Generate HTML on-demand
            html = await generate_location_page_on_demand(loc_name, loc_type, state_name, state_slug)
            if html:
                return HTMLResponse(content=html, status_code=200)
        
        # Not in database - try generating from US locations data
        us_data = load_us_locations()
        if us_data:
            def slugify(text):
                return text.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")
            
            # Check if it's a state page
            if slug in us_data:
                state_info = us_data[slug]
                state_name = state_info.get("name", slug.replace("-", " ").title())
                html = await generate_location_page_on_demand(state_name, "state", state_name, slug)
                if html:
                    return HTMLResponse(content=html, status_code=200)
            
            # Check if it's a county or city page
            for state_slug_key, state_info in us_data.items():
                if not slug.endswith(f"-{state_slug_key}"):
                    continue
                state_name = state_info.get("name", state_slug_key.replace("-", " ").title())
                location_part = slug[:-len(state_slug_key)-1]
                
                for county in state_info.get("counties", []):
                    if slugify(county) == location_part:
                        html = await generate_location_page_on_demand(county, "county", state_name, state_slug_key)
                        if html:
                            return HTMLResponse(content=html, status_code=200)
                
                for city in state_info.get("cities", []):
                    if slugify(city) == location_part:
                        html = await generate_location_page_on_demand(city, "city", state_name, state_slug_key)
                        if html:
                            return HTMLResponse(content=html, status_code=200)
    
    raise HTTPException(status_code=404, detail="Location page not found")

# Import and include voice routes BEFORE main router inclusion
try:
    from routes.voice_routes import voice_router, set_database as set_voice_db
    set_voice_db(db)
    api_router.include_router(voice_router)
    logger.info("Voice routes loaded successfully")
except ImportError as e:
    logger.warning(f"Voice routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading voice routes: {e}")

# Import and include SMS routes
try:
    from routes.sms_routes import sms_router, set_database as set_sms_db
    set_sms_db(db)
    api_router.include_router(sms_router)
    logger.info("SMS routes loaded successfully")
except ImportError as e:
    logger.warning(f"SMS routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading SMS routes: {e}")

# Import and include voicemail routes
try:
    from routes.voicemail_routes import voicemail_router, set_database as set_voicemail_db
    set_voicemail_db(db)
    api_router.include_router(voicemail_router)
    logger.info("Voicemail routes loaded successfully")
except ImportError as e:
    logger.warning(f"Voicemail routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading voicemail routes: {e}")

# Import and include onboarding routes
try:
    from routes.onboarding_routes import onboarding_router, set_database as set_onboarding_db
    set_onboarding_db(db)
    api_router.include_router(onboarding_router)
    logger.info("Onboarding routes loaded successfully")
except ImportError as e:
    logger.warning(f"Onboarding routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading onboarding routes: {e}")

# Import and include patient documents routes
try:
    from routes.patient_docs_routes import patient_docs_router, set_database as set_patient_docs_db
    set_patient_docs_db(db)
    api_router.include_router(patient_docs_router)
    logger.info("Patient documents routes loaded successfully")
except ImportError as e:
    logger.warning(f"Patient documents routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading patient documents routes: {e}")

# Import and include site documents routes
try:
    from routes.site_docs_routes import site_docs_router, set_database as set_site_docs_db
    set_site_docs_db(db)
    api_router.include_router(site_docs_router)
    logger.info("Site documents routes loaded successfully")
except ImportError as e:
    logger.warning(f"Site documents routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading site documents routes: {e}")

# Import and include Availity routes
try:
    from routes.availity_routes import availity_router, set_database as set_availity_db
    set_availity_db(db)
    api_router.include_router(availity_router)
    logger.info("Availity routes loaded successfully")
except ImportError as e:
    logger.warning(f"Availity routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading Availity routes: {e}")

# Import and include Compliance routes (Jornaya / TrustedForm)
try:
    from routes.compliance_routes import compliance_router, set_database as set_compliance_db, set_auth as set_compliance_auth
    set_compliance_db(db)
    set_compliance_auth(get_current_user, is_admin_role)
    api_router.include_router(compliance_router)
    logger.info("Compliance routes loaded successfully")
except ImportError as e:
    logger.warning(f"Compliance routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading compliance routes: {e}")

# Import and include Waystar routes
try:
    from routes.waystar_routes import waystar_router, set_database as set_waystar_db
    set_waystar_db(db)
    api_router.include_router(waystar_router)
    logger.info("Waystar routes loaded successfully")
except ImportError as e:
    logger.warning(f"Waystar routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading Waystar routes: {e}")

# Import and include Office Ally routes
try:
    from routes.officeally_routes import officeally_router, set_database as set_officeally_db
    set_officeally_db(db)
    api_router.include_router(officeally_router)
    logger.info("Office Ally routes loaded successfully")
except ImportError as e:
    logger.warning(f"Office Ally routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading Office Ally routes: {e}")

# Import and include Video Rooms routes
try:
    from routes.video_rooms_routes import video_rooms_router, set_database as set_video_rooms_db, set_auth as set_video_rooms_auth
    set_video_rooms_db(db)
    set_video_rooms_auth(get_current_user)
    api_router.include_router(video_rooms_router)
    logger.info("Video Rooms routes loaded successfully")
except ImportError as e:
    logger.warning(f"Video Rooms routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading Video Rooms routes: {e}")

# Import and include Campaign routes
try:
    from routes.campaign_routes import campaign_router, set_database as set_campaign_db
    set_campaign_db(db)
    api_router.include_router(campaign_router)
    logger.info("Campaign routes loaded successfully")
except ImportError as e:
    logger.warning(f"Campaign routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading Campaign routes: {e}")

# Import and include Lead Intake Hub routes
try:
    from routes.lead_intake_routes import lead_intake_router, set_database as set_lead_intake_db
    set_lead_intake_db(db)
    api_router.include_router(lead_intake_router)
    logger.info("Lead Intake Hub routes loaded successfully")
except ImportError as e:
    logger.warning(f"Lead Intake Hub routes not loaded: {e}")
except Exception as e:
    logger.error(f"Error loading Lead Intake Hub routes: {e}")


# Include router (MUST be at the end after all routes are defined)
app.include_router(api_router)
