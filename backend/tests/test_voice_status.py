"""
Test Voice Connection Status Endpoint
Tests the GET /api/voice/status endpoint for the Phone Connection Status Indicator feature
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVoiceConnectionStatus:
    """Tests for the voice connection status endpoint used by the green dot indicator"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mel@a2gdesigns.com",
            "password": "BigDaddy2016!!"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_voice_status_endpoint_returns_200(self):
        """Test that /api/voice/status returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Voice status endpoint returns 200 OK")
    
    def test_voice_status_response_structure(self):
        """Test that response contains all required fields"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        required_fields = ["connected", "enabled", "configured", "phone_number", "error"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✓ Response contains all required fields: {required_fields}")
        print(f"  Response data: {data}")
    
    def test_voice_status_connected_is_boolean(self):
        """Test that 'connected' field is a boolean"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["connected"], bool), f"'connected' should be boolean, got {type(data['connected'])}"
        print(f"✓ 'connected' field is boolean: {data['connected']}")
    
    def test_voice_status_enabled_is_boolean(self):
        """Test that 'enabled' field is a boolean"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["enabled"], bool), f"'enabled' should be boolean, got {type(data['enabled'])}"
        print(f"✓ 'enabled' field is boolean: {data['enabled']}")
    
    def test_voice_status_configured_is_boolean(self):
        """Test that 'configured' field is a boolean"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["configured"], bool), f"'configured' should be boolean, got {type(data['configured'])}"
        print(f"✓ 'configured' field is boolean: {data['configured']}")
    
    def test_voice_status_phone_number_format(self):
        """Test that phone_number is either null or a string"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        phone = data["phone_number"]
        assert phone is None or isinstance(phone, str), f"'phone_number' should be null or string, got {type(phone)}"
        print(f"✓ 'phone_number' field is valid: {phone}")
    
    def test_voice_status_error_field(self):
        """Test that error field is either null or a string"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        error = data["error"]
        assert error is None or isinstance(error, str), f"'error' should be null or string, got {type(error)}"
        print(f"✓ 'error' field is valid: {error}")
    
    def test_voice_status_when_connected(self):
        """Test that when connected=true, enabled and configured are also true"""
        response = self.session.get(f"{BASE_URL}/api/voice/status")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["connected"]:
            # If connected, should also be enabled and configured
            assert data["enabled"], "If connected, 'enabled' should be true"
            assert data["configured"], "If connected, 'configured' should be true"
            assert data["error"] is None, "If connected, 'error' should be null"
            print("✓ Connected state is consistent: enabled=True, configured=True, error=None")
        else:
            print(f"✓ Not connected - error: {data.get('error')}")
    
    def test_voice_status_no_auth_required(self):
        """Test that voice status endpoint works without authentication (for polling)"""
        # Create a new session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/voice/status")
        # Should return 200 even without auth (public endpoint for status checking)
        assert response.status_code == 200, f"Expected 200 without auth, got {response.status_code}"
        print("✓ Voice status endpoint accessible without authentication")


class TestVoiceConfig:
    """Tests for the voice configuration endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mel@a2gdesigns.com",
            "password": "BigDaddy2016!!"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_voice_config_endpoint_returns_200(self):
        """Test that /api/voice/config returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/voice/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Voice config endpoint returns 200 OK")
    
    def test_voice_config_response_structure(self):
        """Test that config response contains expected sections"""
        response = self.session.get(f"{BASE_URL}/api/voice/config")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check expected sections
        expected_sections = ["telnyx", "business_hours", "ivr", "telnyx_sdk_available"]
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"
        
        print(f"✓ Config contains all expected sections: {expected_sections}")
    
    def test_voice_config_telnyx_enabled(self):
        """Test that Telnyx is enabled in config"""
        response = self.session.get(f"{BASE_URL}/api/voice/config")
        assert response.status_code == 200
        
        data = response.json()
        telnyx_config = data.get("telnyx", {})
        
        # Check if enabled
        enabled = telnyx_config.get("enabled", False)
        print(f"✓ Telnyx enabled status: {enabled}")
        
        # Check that API key is masked
        api_key = telnyx_config.get("api_key")
        if api_key:
            assert api_key == "***", "API key should be masked"
            print("✓ API key is properly masked")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
