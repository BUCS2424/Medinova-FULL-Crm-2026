"""
Authentication utilities and helper functions
"""
import bcrypt
import jwt
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import db, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, security
from models import UserRole

# ==================== PASSWORD FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


# ==================== TOKEN FUNCTIONS ====================

def create_token(user_id: str, email: str, role: str, is_impersonating: bool = False, impersonated_by: str = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    if is_impersonating:
        payload["is_impersonating"] = True
        payload["impersonated_by"] = impersonated_by
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ==================== USER AUTHENTICATION ====================

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


# ==================== ROLE HELPERS ====================

def is_admin_role(user: dict) -> bool:
    """Check if user has admin or super_admin role"""
    return user.get("role") in ["admin", "super_admin"]


def require_admin(current_user: dict):
    """Raise 403 if user is not admin or super_admin"""
    if not is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")


# ==================== AUDIT LOGGING ====================

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
