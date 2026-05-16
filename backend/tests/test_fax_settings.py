"""
Test suite for Telnyx Fax Integration
Tests fax settings, send fax, history, and webhook endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


class TestFaxSettings:
    """Test fax settings CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_fax_settings_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/fax/settings")
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_get_fax_settings_authenticated(self):
        """Test GET /api/fax/settings returns correct structure"""
        response = self.session.get(f"{BASE_URL}/api/fax/settings")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "is_configured" in data
        assert "is_enabled" in data
        assert "has_api_key" in data
        assert "has_connection_id" in data
        assert isinstance(data["is_configured"], bool)
        assert isinstance(data["is_enabled"], bool)
        assert isinstance(data["has_api_key"], bool)
        assert isinstance(data["has_connection_id"], bool)
    
    def test_save_fax_settings(self):
        """Test POST /api/fax/settings saves settings"""
        # Save test settings
        test_settings = {
            "telnyx_api_key": "TEST_KEY_" + str(uuid.uuid4())[:8],
            "telnyx_fax_number": "+15551234567",
            "telnyx_connection_id": "test-connection-123",
            "is_enabled": False  # Keep disabled for safety
        }
        
        response = self.session.post(f"{BASE_URL}/api/fax/settings", json=test_settings)
        assert response.status_code == 200, f"Failed to save: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "success" in data["message"].lower() or "updated" in data["message"].lower()
        
        # Verify settings were saved
        get_response = self.session.get(f"{BASE_URL}/api/fax/settings")
        assert get_response.status_code == 200
        
        saved_data = get_response.json()
        assert saved_data["has_api_key"] == True
        assert saved_data["fax_number"] == "+15551234567"
        assert saved_data["has_connection_id"] == True
        assert saved_data["is_enabled"] == False
    
    def test_save_partial_settings(self):
        """Test that partial updates work (only update some fields)"""
        # Only update fax number
        response = self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "telnyx_fax_number": "+15559876543"
        })
        assert response.status_code == 200
        
        # Verify only fax number changed
        get_response = self.session.get(f"{BASE_URL}/api/fax/settings")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["fax_number"] == "+15559876543"
    
    def test_enable_disable_fax_service(self):
        """Test enabling and disabling fax service"""
        # Enable
        response = self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "is_enabled": True
        })
        assert response.status_code == 200
        
        get_response = self.session.get(f"{BASE_URL}/api/fax/settings")
        assert get_response.json()["is_enabled"] == True
        
        # Disable
        response = self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "is_enabled": False
        })
        assert response.status_code == 200
        
        get_response = self.session.get(f"{BASE_URL}/api/fax/settings")
        assert get_response.json()["is_enabled"] == False


class TestFaxTestConnection:
    """Test fax connection testing endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_test_connection_without_api_key(self):
        """Test connection fails gracefully without API key"""
        # First clear the API key
        self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "telnyx_api_key": ""
        })
        
        response = self.session.post(f"{BASE_URL}/api/fax/test-connection")
        # Should return 400 or error message
        assert response.status_code in [400, 200]
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == False or "not configured" in str(data).lower()
    
    def test_test_connection_with_invalid_key(self):
        """Test connection with invalid API key returns appropriate error"""
        # Set an invalid API key
        self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "telnyx_api_key": "invalid_key_12345"
        })
        
        response = self.session.post(f"{BASE_URL}/api/fax/test-connection")
        assert response.status_code in [200, 400, 401]
        
        if response.status_code == 200:
            data = response.json()
            # Should indicate failure
            assert data.get("success") == False
            assert "message" in data


class TestFaxHistory:
    """Test fax history endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_fax_history(self):
        """Test GET /api/fax/history returns correct structure"""
        response = self.session.get(f"{BASE_URL}/api/fax/history")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "faxes" in data
        assert "total" in data
        assert isinstance(data["faxes"], list)
        assert isinstance(data["total"], int)
    
    def test_get_fax_history_with_limit(self):
        """Test fax history with limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/fax/history?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["faxes"]) <= 5
    
    def test_get_fax_history_with_skip(self):
        """Test fax history with skip parameter for pagination"""
        response = self.session.get(f"{BASE_URL}/api/fax/history?skip=0&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "faxes" in data
    
    def test_get_fax_history_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/fax/history")
        assert response.status_code in [401, 403]


class TestSendFax:
    """Test send fax endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_send_fax_when_disabled(self):
        """Test sending fax when service is disabled returns error"""
        # Ensure service is disabled
        self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "is_enabled": False
        })
        
        response = self.session.post(f"{BASE_URL}/api/fax/send", json={
            "recipient_fax_number": "+15551234567",
            "recipient_name": "Test Recipient",
            "document_type": "other",
            "file_url": "https://example.com/test.pdf"
        })
        
        assert response.status_code == 400
        assert "not enabled" in response.text.lower() or "disabled" in response.text.lower()
    
    def test_send_fax_missing_required_fields(self):
        """Test sending fax without required fields returns validation error"""
        # Enable service first
        self.session.post(f"{BASE_URL}/api/fax/settings", json={
            "is_enabled": True,
            "telnyx_api_key": "test_key",
            "telnyx_fax_number": "+15551234567"
        })
        
        # Missing recipient_fax_number
        response = self.session.post(f"{BASE_URL}/api/fax/send", json={
            "recipient_name": "Test Recipient",
            "file_url": "https://example.com/test.pdf"
        })
        
        assert response.status_code == 422  # Validation error
    
    def test_send_fax_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.post(f"{BASE_URL}/api/fax/send", json={
            "recipient_fax_number": "+15551234567",
            "recipient_name": "Test",
            "file_url": "https://example.com/test.pdf"
        })
        assert response.status_code in [401, 403]


class TestFaxWebhook:
    """Test fax webhook endpoint (public, no auth required)"""
    
    def test_webhook_endpoint_exists(self):
        """Test that webhook endpoint exists and accepts POST"""
        response = requests.post(f"{BASE_URL}/api/webhooks/fax", json={
            "data": {
                "event_type": "fax.delivered",
                "payload": {
                    "fax_id": "test-webhook-123",
                    "status": "delivered"
                }
            }
        })
        
        # Should accept the webhook (200) even if fax_id doesn't exist
        assert response.status_code == 200
    
    def test_webhook_handles_queued_status(self):
        """Test webhook handles queued status"""
        response = requests.post(f"{BASE_URL}/api/webhooks/fax", json={
            "data": {
                "event_type": "fax.queued",
                "payload": {
                    "fax_id": "test-queued-123",
                    "status": "queued"
                }
            }
        })
        assert response.status_code == 200
    
    def test_webhook_handles_sending_status(self):
        """Test webhook handles sending status"""
        response = requests.post(f"{BASE_URL}/api/webhooks/fax", json={
            "data": {
                "event_type": "fax.sending",
                "payload": {
                    "fax_id": "test-sending-123",
                    "status": "sending"
                }
            }
        })
        assert response.status_code == 200
    
    def test_webhook_handles_failed_status(self):
        """Test webhook handles failed status"""
        response = requests.post(f"{BASE_URL}/api/webhooks/fax", json={
            "data": {
                "event_type": "fax.failed",
                "payload": {
                    "fax_id": "test-failed-123",
                    "status": "failed",
                    "failure_reason": "Line busy"
                }
            }
        })
        assert response.status_code == 200
    
    def test_webhook_without_fax_id(self):
        """Test webhook handles missing fax_id gracefully"""
        response = requests.post(f"{BASE_URL}/api/webhooks/fax", json={
            "data": {
                "event_type": "fax.delivered",
                "payload": {}
            }
        })
        # Should return 200 with ignored status
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ignored" or "no fax_id" in str(data).lower()


class TestFaxDetails:
    """Test individual fax details endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_nonexistent_fax(self):
        """Test getting details of non-existent fax returns 404"""
        response = self.session.get(f"{BASE_URL}/api/fax/nonexistent-fax-id-12345")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
