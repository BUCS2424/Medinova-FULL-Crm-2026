"""
Test suite for E-Signature System - SignatureCapture component backend endpoints
Tests:
- POST /api/doctor-portal/save-signature (portal token auth)
- GET /api/doctor-portal/saved-signatures (portal token auth)
- POST /api/signatures (JWT auth)
- GET /api/signatures/saved (JWT auth)
- DELETE /api/signatures/saved/{id} (JWT auth)
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"

# Sample base64 signature data (small PNG)
SAMPLE_SIGNATURE_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


class TestAuthenticatedSignatureEndpoints:
    """Test signature endpoints that require JWT authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            self.user = response.json().get("user")
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_create_signature_draw_type(self):
        """Test creating a signature with draw type"""
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw",
            "signer_name": "Test User",
            "signer_role": "admin",
            "save_for_future": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["signature_type"] == "draw"
        assert data["signer_name"] == "Test User"
        assert data["signature_data"] == SAMPLE_SIGNATURE_DATA
        print(f"✓ Created draw signature: {data['id']}")
    
    def test_create_signature_type_type(self):
        """Test creating a signature with type (typed) type"""
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "type",
            "signer_name": "Typed Signature User",
            "signer_role": "admin",
            "save_for_future": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["signature_type"] == "type"
        print(f"✓ Created typed signature: {data['id']}")
    
    def test_create_signature_upload_type(self):
        """Test creating a signature with upload type"""
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "upload",
            "signer_name": "Upload Signature User",
            "signer_role": "admin",
            "save_for_future": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["signature_type"] == "upload"
        print(f"✓ Created upload signature: {data['id']}")
    
    def test_create_signature_and_save_for_future(self):
        """Test creating a signature and saving it for future use"""
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw",
            "signer_name": "Test Admin",
            "signer_role": "admin",
            "save_for_future": True,
            "signature_name": "TEST_My Primary Signature"
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["is_saved_template"] == True
        assert data["signature_name"] == "TEST_My Primary Signature"
        self.saved_signature_id = data["id"]
        print(f"✓ Created and saved signature template: {data['id']}")
    
    def test_get_saved_signatures(self):
        """Test retrieving saved signature templates"""
        response = self.session.get(f"{BASE_URL}/api/signatures/saved")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} saved signatures")
        
        # Check structure of returned signatures
        if len(data) > 0:
            sig = data[0]
            assert "id" in sig
            assert "signature_data" in sig
            assert "signature_type" in sig
            print(f"✓ Saved signature structure is correct")
    
    def test_delete_saved_signature(self):
        """Test deleting a saved signature template"""
        # First create a signature to delete
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw",
            "signer_name": "To Delete",
            "signer_role": "admin",
            "save_for_future": True,
            "signature_name": "TEST_Delete Me"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        assert create_response.status_code == 200
        sig_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/signatures/saved/{sig_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        print(f"✓ Deleted saved signature: {sig_id}")
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/signatures/saved")
        saved_ids = [s["id"] for s in get_response.json()]
        assert sig_id not in saved_ids
        print(f"✓ Verified signature was deleted")
    
    def test_delete_nonexistent_signature_returns_404(self):
        """Test deleting a non-existent signature returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/signatures/saved/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ Correctly returned 404 for non-existent signature")
    
    def test_create_signature_without_auth_returns_401(self):
        """Test that creating signature without auth returns 401/403"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw",
            "signer_name": "Unauthorized User",
            "signer_role": "admin"
        }
        
        response = session.post(f"{BASE_URL}/api/signatures", json=payload)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Correctly returned {response.status_code} for unauthorized request")
    
    def test_get_saved_signatures_without_auth_returns_401(self):
        """Test that getting saved signatures without auth returns 401/403"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/signatures/saved")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Correctly returned {response.status_code} for unauthorized request")


class TestDoctorPortalSignatureEndpoints:
    """Test doctor portal signature endpoints (token-based auth)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for doctor portal tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get admin token first
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.admin_token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_doctor_portal_saved_signatures_without_token_returns_401(self):
        """Test that doctor portal endpoints require token"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/doctor-portal/saved-signatures")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Correctly returned 401 for missing token")
    
    def test_doctor_portal_save_signature_without_token_returns_401(self):
        """Test that save signature endpoint requires token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw",
            "signer_name": "Dr. Test",
            "signature_name": "My Signature"
        }
        
        response = session.post(f"{BASE_URL}/api/doctor-portal/save-signature", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Correctly returned 401 for missing token")


class TestSignatureDataValidation:
    """Test signature data validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_create_signature_missing_required_fields(self):
        """Test that missing required fields returns 422"""
        # Missing signature_data
        payload = {
            "signature_type": "draw",
            "signer_name": "Test User"
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✓ Correctly returned 422 for missing signature_data")
    
    def test_create_signature_missing_signer_name(self):
        """Test that missing signer_name returns 422"""
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw"
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✓ Correctly returned 422 for missing signer_name")
    
    def test_create_signature_with_document_reference(self):
        """Test creating signature with document reference"""
        payload = {
            "signature_data": SAMPLE_SIGNATURE_DATA,
            "signature_type": "draw",
            "signer_name": "Test User",
            "signer_role": "admin",
            "document_id": "test-doc-123",
            "document_type": "cmn",
            "save_for_future": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/signatures", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["document_id"] == "test-doc-123"
        assert data["document_type"] == "cmn"
        print(f"✓ Created signature with document reference")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_cleanup_test_signatures(self):
        """Clean up TEST_ prefixed signatures"""
        response = self.session.get(f"{BASE_URL}/api/signatures/saved")
        if response.status_code == 200:
            signatures = response.json()
            for sig in signatures:
                if sig.get("signature_name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/signatures/saved/{sig['id']}")
                    print(f"✓ Cleaned up test signature: {sig['signature_name']}")
        print("✓ Cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
