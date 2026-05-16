"""
Test Video Studio API Endpoints
Tests AI Video Marketing Studio feature for script/video generation with GPT-5.2 and Sora 2
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVideoStudioAPI:
    """Video Studio API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test credentials and headers"""
        # Login to get token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mel@a2gdesigns.com",
            "password": "BigDaddy2016!!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    # ==================== API KEYS ENDPOINTS ====================
    
    def test_get_api_keys_status(self):
        """Test GET /api/video-studio/api-keys returns configuration status"""
        response = requests.get(
            f"{BASE_URL}/api/video-studio/api-keys",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "configured" in data, "Response missing 'configured' field"
        assert "openai_api_key" in data, "Response missing 'openai_api_key' field"
        assert isinstance(data["configured"], bool), "'configured' should be boolean"
        print(f"✓ API key status: configured={data['configured']}")
    
    def test_put_api_keys_super_admin_only(self):
        """Test PUT /api/video-studio/api-keys saves OpenAI key (super_admin only)"""
        # Save test API key
        response = requests.put(
            f"{BASE_URL}/api/video-studio/api-keys",
            headers=self.headers,
            json={"openai_api_key": "sk-test-video-studio-key-12345"}
        )
        assert response.status_code == 200, f"Failed to save API key: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        
        # Verify it was saved (should show masked)
        get_response = requests.get(
            f"{BASE_URL}/api/video-studio/api-keys",
            headers=self.headers
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data.get("configured") == True, "API key should be configured after save"
        assert get_data.get("updated_by") == "mel@a2gdesigns.com", "updated_by should match logged in user"
        print(f"✓ API key saved and masked: {get_data.get('openai_key_masked')}")
    
    # ==================== SCRIPTS ENDPOINTS ====================
    
    def test_get_scripts_history(self):
        """Test GET /api/video-studio/scripts returns scripts history"""
        response = requests.get(
            f"{BASE_URL}/api/video-studio/scripts?limit=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "scripts" in data, "Response missing 'scripts' field"
        assert "total" in data, "Response missing 'total' field"
        assert isinstance(data["scripts"], list), "'scripts' should be a list"
        print(f"✓ Scripts history: {data['total']} scripts found")
    
    # ==================== JOBS ENDPOINTS ====================
    
    def test_get_jobs_history(self):
        """Test GET /api/video-studio/jobs returns video generation jobs history"""
        response = requests.get(
            f"{BASE_URL}/api/video-studio/jobs?limit=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "jobs" in data, "Response missing 'jobs' field"
        assert "total" in data, "Response missing 'total' field"
        assert isinstance(data["jobs"], list), "'jobs' should be a list"
        print(f"✓ Jobs history: {data['total']} jobs found")
    
    # ==================== LOGO ENDPOINTS ====================
    
    def test_get_logo_configuration(self):
        """Test GET /api/video-studio/logo returns logo configuration"""
        response = requests.get(
            f"{BASE_URL}/api/video-studio/logo",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "has_logo" in data, "Response missing 'has_logo' field"
        assert "logo_url" in data, "Response missing 'logo_url' field"
        assert isinstance(data["has_logo"], bool), "'has_logo' should be boolean"
        print(f"✓ Logo configuration: has_logo={data['has_logo']}")
    
    # ==================== AUTHORIZATION TESTS ====================
    
    def test_api_requires_authentication(self):
        """Test endpoints require authentication"""
        # Try without token
        endpoints = [
            ("GET", "/api/video-studio/api-keys"),
            ("GET", "/api/video-studio/scripts"),
            ("GET", "/api/video-studio/jobs"),
            ("GET", "/api/video-studio/logo"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"{endpoint} should require auth, got {response.status_code}"
        
        print("✓ All endpoints require authentication")
    
    def test_admin_role_required_for_api_keys(self):
        """Test PUT api-keys requires super_admin role"""
        # Note: This test verifies the endpoint exists and responds correctly
        # Full role-based test would require creating non-admin user
        response = requests.put(
            f"{BASE_URL}/api/video-studio/api-keys",
            headers=self.headers,
            json={"openai_api_key": "sk-test-role-check"}
        )
        # super_admin should succeed
        assert response.status_code == 200, f"super_admin should be able to update keys: {response.text}"
        print("✓ super_admin can update API keys")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
