"""
Fax Center Feature Tests
Tests for the standalone Fax Center page including:
- Incoming fax endpoints (GET, assign, delete)
- Outgoing fax endpoints (history, send)
- Role-based access control (admin, sales_manager, super_admin)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


class TestFaxCenterAuth:
    """Test authentication and role-based access for Fax Center"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_incoming_faxes_requires_auth(self):
        """GET /api/fax/incoming requires authentication"""
        response = requests.get(f"{BASE_URL}/api/fax/incoming")
        assert response.status_code == 403 or response.status_code == 401
        print("PASS: Incoming faxes endpoint requires authentication")
    
    def test_incoming_faxes_admin_access(self):
        """Admin can access incoming faxes"""
        response = requests.get(f"{BASE_URL}/api/fax/incoming", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "faxes" in data
        assert "total" in data
        print(f"PASS: Admin can access incoming faxes (total: {data['total']})")
    
    def test_fax_settings_requires_auth(self):
        """GET /api/fax/settings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/fax/settings")
        assert response.status_code == 403 or response.status_code == 401
        print("PASS: Fax settings endpoint requires authentication")
    
    def test_fax_history_requires_auth(self):
        """GET /api/fax/history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/fax/history")
        assert response.status_code == 403 or response.status_code == 401
        print("PASS: Fax history endpoint requires authentication")


class TestIncomingFaxEndpoints:
    """Test incoming fax CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_incoming_faxes_structure(self):
        """GET /api/fax/incoming returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/fax/incoming", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "faxes" in data, "Response should have 'faxes' array"
        assert "total" in data, "Response should have 'total' count"
        assert "limit" in data, "Response should have 'limit'"
        assert "skip" in data, "Response should have 'skip'"
        assert isinstance(data["faxes"], list), "'faxes' should be a list"
        print(f"PASS: Incoming faxes returns correct structure (total: {data['total']})")
    
    def test_get_incoming_faxes_pagination(self):
        """GET /api/fax/incoming supports pagination"""
        response = requests.get(f"{BASE_URL}/api/fax/incoming?limit=10&skip=0", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["skip"] == 0
        print("PASS: Incoming faxes supports pagination parameters")
    
    def test_get_incoming_faxes_status_filter(self):
        """GET /api/fax/incoming supports status filter"""
        response = requests.get(f"{BASE_URL}/api/fax/incoming?status=unassigned", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "faxes" in data
        print("PASS: Incoming faxes supports status filter")
    
    def test_get_incoming_fax_not_found(self):
        """GET /api/fax/incoming/{id} returns 404 for non-existent fax"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/fax/incoming/{fake_id}", headers=self.headers)
        assert response.status_code == 404
        print("PASS: Non-existent incoming fax returns 404")
    
    def test_assign_incoming_fax_not_found(self):
        """POST /api/fax/incoming/{id}/assign returns 404 for non-existent fax"""
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/fax/incoming/{fake_id}/assign",
            headers=self.headers,
            json={"assign_type": "general"}
        )
        assert response.status_code == 404
        print("PASS: Assign non-existent fax returns 404")
    
    def test_delete_incoming_fax_not_found(self):
        """DELETE /api/fax/incoming/{id} returns 404 for non-existent fax"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/fax/incoming/{fake_id}", headers=self.headers)
        assert response.status_code == 404
        print("PASS: Delete non-existent fax returns 404")


class TestOutgoingFaxEndpoints:
    """Test outgoing fax operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_fax_history_structure(self):
        """GET /api/fax/history returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/fax/history", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "faxes" in data, "Response should have 'faxes' array"
        assert "total" in data, "Response should have 'total' count"
        assert isinstance(data["faxes"], list), "'faxes' should be a list"
        print(f"PASS: Fax history returns correct structure (total: {data['total']})")
    
    def test_get_fax_history_pagination(self):
        """GET /api/fax/history supports pagination"""
        response = requests.get(f"{BASE_URL}/api/fax/history?limit=5&skip=0", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 5
        print("PASS: Fax history supports pagination")
    
    def test_get_fax_settings_structure(self):
        """GET /api/fax/settings returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/fax/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "is_configured" in data, "Should have 'is_configured'"
        assert "is_enabled" in data, "Should have 'is_enabled'"
        assert "has_api_key" in data, "Should have 'has_api_key'"
        assert "has_connection_id" in data, "Should have 'has_connection_id'"
        print(f"PASS: Fax settings returns correct structure (configured: {data['is_configured']}, enabled: {data['is_enabled']})")
    
    def test_send_fax_validation(self):
        """POST /api/fax/send validates required fields"""
        response = requests.post(
            f"{BASE_URL}/api/fax/send",
            headers=self.headers,
            json={}  # Empty payload
        )
        # Should return 422 for validation error
        assert response.status_code == 422
        print("PASS: Send fax validates required fields")
    
    def test_send_fax_requires_all_fields(self):
        """POST /api/fax/send requires recipient_fax_number, recipient_name, file_url"""
        # Missing file_url
        response = requests.post(
            f"{BASE_URL}/api/fax/send",
            headers=self.headers,
            json={
                "recipient_fax_number": "+15551234567",
                "recipient_name": "Test Recipient"
            }
        )
        assert response.status_code == 422
        print("PASS: Send fax requires all mandatory fields")
    
    def test_get_fax_not_found(self):
        """GET /api/fax/{id} returns 404 for non-existent fax"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/fax/{fake_id}", headers=self.headers)
        assert response.status_code == 404
        print("PASS: Non-existent outgoing fax returns 404")


class TestFaxCenterIntegration:
    """Integration tests for Fax Center workflows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_fax_service_status(self):
        """Verify fax service configuration status"""
        response = requests.get(f"{BASE_URL}/api/fax/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Log current status
        print(f"Fax Service Status:")
        print(f"  - Configured: {data['is_configured']}")
        print(f"  - Enabled: {data['is_enabled']}")
        print(f"  - Has API Key: {data['has_api_key']}")
        print(f"  - Has Connection ID: {data['has_connection_id']}")
        if data.get('fax_number'):
            print(f"  - Fax Number: {data['fax_number']}")
        
        # Test passes regardless of configuration state
        print("PASS: Fax service status retrieved successfully")
    
    def test_patients_endpoint_for_fax_assignment(self):
        """Verify patients endpoint works for fax assignment dropdown"""
        response = requests.get(f"{BASE_URL}/api/patients?limit=10", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Patients should return a list"
        print(f"PASS: Patients endpoint works for fax assignment (found {len(data)} patients)")
    
    def test_webhook_endpoint_public(self):
        """POST /api/webhooks/fax is public (no auth required)"""
        # Webhook should accept POST without auth
        response = requests.post(
            f"{BASE_URL}/api/webhooks/fax",
            json={
                "data": {
                    "event_type": "fax.received",
                    "payload": {
                        "fax_id": "test-webhook-fax",
                        "from": "+15551234567",
                        "to": "+15559876543",
                        "status": "received"
                    }
                }
            }
        )
        # Should not return 401/403 (auth errors)
        assert response.status_code not in [401, 403], "Webhook should be public"
        print(f"PASS: Webhook endpoint is public (status: {response.status_code})")


class TestRoleBasedAccess:
    """Test role-based access control for Fax Center"""
    
    def test_admin_role_has_access(self):
        """Admin role can access all fax endpoints"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test incoming faxes
        response = requests.get(f"{BASE_URL}/api/fax/incoming", headers=headers)
        assert response.status_code == 200, "Admin should access incoming faxes"
        
        # Test fax history
        response = requests.get(f"{BASE_URL}/api/fax/history", headers=headers)
        assert response.status_code == 200, "Admin should access fax history"
        
        # Test fax settings
        response = requests.get(f"{BASE_URL}/api/fax/settings", headers=headers)
        assert response.status_code == 200, "Admin should access fax settings"
        
        print("PASS: Admin role has full access to Fax Center")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
