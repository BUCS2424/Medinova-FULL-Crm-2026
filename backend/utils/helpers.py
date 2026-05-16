"""
Helper Utilities
- Common helper functions used across the application
"""
import re
from datetime import datetime, timezone
from typing import Optional
import uuid


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from a name"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def generate_id() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())


def now_iso() -> str:
    """Get current UTC time as ISO string"""
    return datetime.now(timezone.utc).isoformat()


def format_phone(phone: str) -> str:
    """Format phone number to standard format"""
    if not phone:
        return phone
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    return phone


def sanitize_filename(filename: str) -> str:
    """Sanitize filename for storage"""
    # Remove path separators and null bytes
    filename = filename.replace('/', '_').replace('\\', '_').replace('\x00', '')
    # Remove other problematic characters
    filename = re.sub(r'[<>:"|?*]', '_', filename)
    return filename


def mask_email(email: str) -> str:
    """Mask email for privacy (e.g., j***@gmail.com)"""
    if not email or '@' not in email:
        return email
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked = local[0] + '*' * (len(local) - 1)
    else:
        masked = local[0] + '*' * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


def mask_phone(phone: str) -> str:
    """Mask phone for privacy (e.g., (***) ***-1234)"""
    if not phone:
        return phone
    digits = re.sub(r'\D', '', phone)
    if len(digits) >= 4:
        return f"(***) ***-{digits[-4:]}"
    return phone


def calculate_age(birth_date: str) -> Optional[int]:
    """Calculate age from birth date string"""
    if not birth_date:
        return None
    try:
        if isinstance(birth_date, str):
            birth = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
        else:
            birth = birth_date
        today = datetime.now(timezone.utc)
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        return age
    except Exception:
        return None


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate text to max length with suffix"""
    if not text or len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix
