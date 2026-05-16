"""
Patient Routes
- CRUD operations for patients
- Patient notes
- Storage folders
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from config import db
from models import UserRole, PatientBase, PatientUpdate
from utils.auth import get_current_user, require_roles, log_audit

router = APIRouter()

# Routes will be migrated here from server.py
# Currently routes are in server.py - this file is a placeholder for future refactoring
