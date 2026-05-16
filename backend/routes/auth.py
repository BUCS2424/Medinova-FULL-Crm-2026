"""
Authentication Routes
- Login, Register, Impersonation
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import uuid
import jwt

from config import db, JWT_SECRET, JWT_ALGORITHM, security
from models import UserRole, UserLogin, UserCreate, PublicUserRegister, TokenResponse
from utils.auth import (
    hash_password, verify_password, create_token, 
    get_current_user, require_roles, log_audit
)

router = APIRouter()

SUPER_ADMIN_EMAIL = "mel@a2gdesigns.com"


@router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: PublicUserRegister):
    """Public registration endpoint - always creates patient accounts"""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
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


@router.post("/auth/login", response_model=TokenResponse)
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


@router.get("/auth/me")
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


@router.post("/auth/impersonate/{user_id}")
async def impersonate_user(user_id: str, current_user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Allow admins to impersonate other users (except super admin)"""
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user["email"].lower() == SUPER_ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Cannot impersonate super admin")
    
    if target_user["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")
    
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
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)
    }
    
    impersonation_token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
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


@router.post("/auth/end-impersonation")
async def end_impersonation(current_user: dict = Depends(get_current_user)):
    """End impersonation session"""
    if not current_user.get("is_impersonating"):
        raise HTTPException(status_code=400, detail="Not currently impersonating")
    
    return {"message": "Impersonation ended. Please use your original token to continue."}
