"""
Utils package initialization
"""
from utils.auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_roles,
    is_admin_role,
    require_admin,
    log_audit
)
from utils.helpers import (
    generate_slug,
    generate_id,
    now_iso,
    format_phone,
    sanitize_filename,
    mask_email,
    mask_phone,
    calculate_age,
    truncate_text
)

__all__ = [
    # Auth
    'hash_password',
    'verify_password', 
    'create_token',
    'get_current_user',
    'require_roles',
    'is_admin_role',
    'require_admin',
    'log_audit',
    # Helpers
    'generate_slug',
    'generate_id',
    'now_iso',
    'format_phone',
    'sanitize_filename',
    'mask_email',
    'mask_phone',
    'calculate_age',
    'truncate_text'
]
