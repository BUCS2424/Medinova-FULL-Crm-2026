"""
Services package initialization
All business logic services
"""
from services.storage import StorageService
from services.email import EmailService
from services.supplier_api import SupplierAPIClient
try:
    from services.ai import AIService
except Exception:
    AIService = None
from services.fax import FaxService

__all__ = [
    'StorageService',
    'EmailService', 
    'SupplierAPIClient',
    'AIService',
    'FaxService'
]
