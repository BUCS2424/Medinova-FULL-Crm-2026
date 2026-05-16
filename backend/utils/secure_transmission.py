"""
Secure Lead Transmission Module

Provides encrypted API communication for HIPAA-compliant lead transmission:
- AES-256-GCM encryption for payload
- HMAC-SHA256 for request integrity
- Timestamp validation to prevent replay attacks
- Rate limiting for abuse prevention
"""

import os
import json
import time
import hmac
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from typing import Tuple, Optional, Dict, Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import logging

logger = logging.getLogger(__name__)

# Configuration
ENCRYPTION_KEY = os.environ.get('LEAD_ENCRYPTION_KEY', secrets.token_hex(32))
HMAC_SECRET = os.environ.get('LEAD_HMAC_SECRET', secrets.token_hex(32))
MAX_TIMESTAMP_DRIFT_SECONDS = 300  # 5 minutes
RATE_LIMIT_WINDOW = 60  # 1 minute
RATE_LIMIT_MAX_REQUESTS = 10  # Max requests per window per IP

# In-memory rate limit store (use Redis in production)
_rate_limit_store: Dict[str, list] = {}


class SecureLeadTransmission:
    """Handles secure encryption and decryption of lead data"""
    
    def __init__(self, encryption_key: str = None, hmac_secret: str = None):
        self.encryption_key = encryption_key or ENCRYPTION_KEY
        self.hmac_secret = hmac_secret or HMAC_SECRET
        
        # Derive AES key from the encryption key
        self._aes_key = self._derive_key(self.encryption_key)
    
    def _derive_key(self, key_material: str) -> bytes:
        """Derive a 256-bit AES key from the key material"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'mastech_dme_salt_v1',  # Fixed salt for consistency
            iterations=100000,
        )
        return kdf.derive(key_material.encode())
    
    def encrypt_payload(self, data: dict) -> Tuple[str, str, str]:
        """
        Encrypt the lead data payload
        
        Returns:
            Tuple of (encrypted_data_b64, nonce_b64, timestamp)
        """
        # Add timestamp to payload
        timestamp = datetime.now(timezone.utc).isoformat()
        data['_timestamp'] = timestamp
        data['_nonce'] = secrets.token_hex(16)
        
        # Serialize to JSON
        plaintext = json.dumps(data, separators=(',', ':')).encode('utf-8')
        
        # Generate nonce (96 bits for GCM)
        nonce = secrets.token_bytes(12)
        
        # Encrypt with AES-256-GCM
        aesgcm = AESGCM(self._aes_key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        
        # Encode to base64
        encrypted_b64 = base64.b64encode(ciphertext).decode('utf-8')
        nonce_b64 = base64.b64encode(nonce).decode('utf-8')
        
        return encrypted_b64, nonce_b64, timestamp
    
    def decrypt_payload(self, encrypted_b64: str, nonce_b64: str) -> dict:
        """
        Decrypt the lead data payload
        
        Args:
            encrypted_b64: Base64 encoded encrypted data
            nonce_b64: Base64 encoded nonce
            
        Returns:
            Decrypted data dictionary
            
        Raises:
            ValueError: If decryption fails or data is invalid
        """
        try:
            # Decode from base64
            ciphertext = base64.b64decode(encrypted_b64)
            nonce = base64.b64decode(nonce_b64)
            
            # Decrypt
            aesgcm = AESGCM(self._aes_key)
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            
            # Parse JSON
            data = json.loads(plaintext.decode('utf-8'))
            
            # Validate timestamp
            if '_timestamp' in data:
                self._validate_timestamp(data['_timestamp'])
            
            return data
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("Failed to decrypt payload - invalid or tampered data")
    
    def generate_signature(self, payload: str, timestamp: str) -> str:
        """
        Generate HMAC-SHA256 signature for request integrity
        
        Args:
            payload: The request payload (encrypted or plain)
            timestamp: ISO format timestamp
            
        Returns:
            Hex-encoded HMAC signature
        """
        message = f"{timestamp}:{payload}".encode('utf-8')
        signature = hmac.new(
            self.hmac_secret.encode('utf-8'),
            message,
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def verify_signature(self, payload: str, timestamp: str, signature: str) -> bool:
        """
        Verify HMAC-SHA256 signature
        
        Args:
            payload: The request payload
            timestamp: ISO format timestamp from request
            signature: Provided signature to verify
            
        Returns:
            True if signature is valid
        """
        expected_signature = self.generate_signature(payload, timestamp)
        return hmac.compare_digest(expected_signature, signature)
    
    def _validate_timestamp(self, timestamp_str: str) -> None:
        """Validate that timestamp is within acceptable drift"""
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            drift = abs((now - timestamp).total_seconds())
            
            if drift > MAX_TIMESTAMP_DRIFT_SECONDS:
                raise ValueError(f"Timestamp too old or in future: {drift}s drift")
        except ValueError as e:
            raise ValueError(f"Invalid timestamp: {e}")


def check_rate_limit(ip_address: str) -> Tuple[bool, int]:
    """
    Check if IP is within rate limit
    
    Args:
        ip_address: Client IP address
        
    Returns:
        Tuple of (is_allowed, remaining_requests)
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    
    # Clean old entries
    if ip_address in _rate_limit_store:
        _rate_limit_store[ip_address] = [
            ts for ts in _rate_limit_store[ip_address] 
            if ts > window_start
        ]
    else:
        _rate_limit_store[ip_address] = []
    
    request_count = len(_rate_limit_store[ip_address])
    
    if request_count >= RATE_LIMIT_MAX_REQUESTS:
        return False, 0
    
    # Add current request
    _rate_limit_store[ip_address].append(now)
    
    remaining = RATE_LIMIT_MAX_REQUESTS - request_count - 1
    return True, remaining


def get_public_encryption_config() -> dict:
    """
    Get public encryption configuration for frontend
    
    This returns the public key/config needed by frontend to encrypt data.
    The actual encryption key is never exposed.
    """
    return {
        "version": "1.0",
        "algorithm": "AES-256-GCM",
        "key_derivation": "PBKDF2-SHA256",
        "signature_algorithm": "HMAC-SHA256",
        "timestamp_drift_seconds": MAX_TIMESTAMP_DRIFT_SECONDS,
        # In a real implementation, you'd use asymmetric encryption
        # and provide a public key here. For simplicity, we're using
        # symmetric encryption with a shared secret approach.
        "endpoint": "/api/public/leads/secure"
    }


# Create default instance
secure_transmission = SecureLeadTransmission()
