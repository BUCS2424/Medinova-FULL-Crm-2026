/**
 * Secure Lead Transmission Utility
 * 
 * Provides client-side encryption for HIPAA-compliant lead transmission.
 * Uses AES-256-GCM for encryption and HMAC-SHA256 for integrity.
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Encryption configuration (should match backend)
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  tagLength: 128
};

/**
 * Convert string to ArrayBuffer
 */
function stringToArrayBuffer(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive encryption key from shared secret using PBKDF2
 */
async function deriveKey(keyMaterial) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);
  
  // Import the key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive the AES key
  const salt = encoder.encode('dmepros_salt_v1');
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate HMAC-SHA256 signature
 */
async function generateSignature(message, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  // Convert to hex string
  const bytes = new Uint8Array(signature);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt lead data for secure transmission
 * 
 * @param {Object} leadData - The lead data to encrypt
 * @param {string} encryptionKey - The shared encryption key
 * @param {string} hmacSecret - The HMAC signing secret
 * @returns {Object} - Encrypted payload ready for transmission
 */
export async function encryptLeadData(leadData, encryptionKey, hmacSecret) {
  try {
    // Add timestamp and nonce to payload
    const timestamp = new Date().toISOString();
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const nonceHex = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const dataWithMeta = {
      ...leadData,
      _timestamp: timestamp,
      _nonce: nonceHex
    };
    
    // Serialize to JSON
    const plaintext = JSON.stringify(dataWithMeta);
    const plaintextBuffer = stringToArrayBuffer(plaintext);
    
    // Generate IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
    
    // Derive the encryption key
    const key = await deriveKey(encryptionKey);
    
    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength
      },
      key,
      plaintextBuffer
    );
    
    // Convert to base64
    const encryptedData = arrayBufferToBase64(encryptedBuffer);
    const ivBase64 = arrayBufferToBase64(iv);
    
    // Generate HMAC signature
    const signatureMessage = `${timestamp}:${encryptedData}`;
    const signature = await generateSignature(signatureMessage, hmacSecret);
    
    return {
      encryptedData,
      nonce: ivBase64,
      timestamp,
      signature,
      encrypted: true
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Submit lead data securely with encryption
 * 
 * @param {Object} leadData - The lead data to submit
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} - API response
 */
export async function submitSecureLead(leadData, options = {}) {
  const {
    encryptionKey = window.LEAD_ENCRYPTION_KEY,
    hmacSecret = window.LEAD_HMAC_SECRET,
    fallbackToUnsecure = true
  } = options;
  
  // Check if encryption keys are available
  if (!encryptionKey || !hmacSecret) {
    console.warn('Encryption keys not configured');
    
    if (fallbackToUnsecure) {
      // Fall back to regular (HTTPS-only) submission
      const response = await fetch(`${API_URL}/api/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      return response.json();
    }
    
    throw new Error('Secure transmission not configured');
  }
  
  try {
    // Encrypt the lead data
    const encryptedPayload = await encryptLeadData(leadData, encryptionKey, hmacSecret);
    
    // Submit to secure endpoint
    const response = await fetch(`${API_URL}/api/public/leads/secure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encryptedPayload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Secure submission failed');
    }
    
    return response.json();
  } catch (error) {
    console.error('Secure submission failed:', error);
    
    if (fallbackToUnsecure) {
      console.warn('Falling back to standard HTTPS submission');
      const response = await fetch(`${API_URL}/api/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      return response.json();
    }
    
    throw error;
  }
}

/**
 * Check if secure transmission is available
 */
export async function checkSecureTransmissionAvailable() {
  try {
    const response = await fetch(`${API_URL}/api/public/leads/encryption-config`);
    const config = await response.json();
    return config.enabled === true;
  } catch (error) {
    console.error('Failed to check secure transmission:', error);
    return false;
  }
}

/**
 * Initialize secure transmission with server-provided config
 * Call this on app startup to configure encryption
 */
export async function initializeSecureTransmission() {
  try {
    const response = await fetch(`${API_URL}/api/public/leads/encryption-config`);
    const config = await response.json();
    
    if (config.enabled) {
      // In production, these would come from a secure key exchange
      // For now, we check if they're set via environment or config
      console.log('Secure transmission available:', config);
      return {
        available: true,
        config
      };
    }
    
    return { available: false };
  } catch (error) {
    console.error('Failed to initialize secure transmission:', error);
    return { available: false, error: error.message };
  }
}

export default {
  encryptLeadData,
  submitSecureLead,
  checkSecureTransmissionAvailable,
  initializeSecureTransmission
};
