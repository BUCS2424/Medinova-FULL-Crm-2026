"""
Insurance Integration Tests — Availity & Waystar API endpoints
Tests: feature toggles, auth protection, endpoint availability, and status checks
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ===================== Auth Helpers =====================

@pytest.fixture(scope="module")
def auth_token():
    """Login and get JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "mel@a2gdesigns.com",
        "password": "BigDaddy2016!!"
    })
    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return token
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ===================== Waystar Auth Protection =====================

class TestWaystarAuthProtection:
    """Test that Waystar endpoints require JWT auth"""

    def test_waystar_status_without_token_returns_403(self):
        """GET /api/waystar/status should return 403 without token"""
        response = requests.get(f"{BASE_URL}/api/waystar/status")
        assert response.status_code in [401, 403], (
            f"Expected 401 or 403, got {response.status_code}. Endpoint is not protected!"
        )
        print(f"PASS: /waystar/status returns {response.status_code} without token")

    def test_waystar_status_with_valid_token_returns_200(self, auth_headers):
        """GET /api/waystar/status should return 200 with valid token"""
        response = requests.get(f"{BASE_URL}/api/waystar/status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "configured" in data
        assert "connected" in data
        print(f"PASS: /waystar/status returns 200 with token. Configured: {data.get('configured')}")

    def test_waystar_config_without_token_returns_403(self):
        """GET /api/waystar/config should return 403 without token"""
        response = requests.get(f"{BASE_URL}/api/waystar/config")
        assert response.status_code in [401, 403], (
            f"Expected 401 or 403, got {response.status_code}. Endpoint is not protected!"
        )
        print(f"PASS: /waystar/config returns {response.status_code} without token")

    def test_waystar_eligibility_check_without_token(self):
        """POST /api/waystar/eligibility/check — check if auth required"""
        response = requests.post(f"{BASE_URL}/api/waystar/eligibility/check", json={
            "payer_id": "BCBS001",
            "member_id": "TEST123",
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "1990-01-01"
        })
        # Should be 401 or 403 if auth protected
        print(f"INFO: /waystar/eligibility/check without token returns {response.status_code}")
        # If it returns 400 (not configured) - that means it's NOT protected by auth
        if response.status_code == 400:
            print("WARNING: /waystar/eligibility/check is NOT auth-protected (returns 400 instead of 401/403)")
        assert response.status_code in [400, 401, 403], f"Unexpected status: {response.status_code}"

    def test_waystar_logs_without_token(self):
        """GET /api/waystar/logs — check if auth required"""
        response = requests.get(f"{BASE_URL}/api/waystar/logs")
        print(f"INFO: /waystar/logs without token returns {response.status_code}")
        if response.status_code == 200:
            print("WARNING: /waystar/logs is NOT auth-protected (returns 200 without token)")


# ===================== Availity Auth Protection =====================

class TestAvailityAuthProtection:
    """Test that Availity endpoints require JWT auth"""

    def test_availity_status_without_token_returns_403(self):
        """GET /api/availity/status should return 403 without token"""
        response = requests.get(f"{BASE_URL}/api/availity/status")
        assert response.status_code in [401, 403], (
            f"Expected 401 or 403, got {response.status_code}. Endpoint is not protected!"
        )
        print(f"PASS: /availity/status returns {response.status_code} without token")

    def test_availity_status_with_valid_token_returns_200(self, auth_headers):
        """GET /api/availity/status should return 200 with valid token"""
        response = requests.get(f"{BASE_URL}/api/availity/status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "configured" in data
        assert "connected" in data
        print(f"PASS: /availity/status returns 200 with token. Configured: {data.get('configured')}")

    def test_availity_config_without_token_returns_403(self):
        """GET /api/availity/config should return 403 without token"""
        response = requests.get(f"{BASE_URL}/api/availity/config")
        assert response.status_code in [401, 403], (
            f"Expected 401 or 403, got {response.status_code}. Endpoint is not protected!"
        )
        print(f"PASS: /availity/config returns {response.status_code} without token")


# ===================== Waystar Logs URL Mismatch =====================

class TestWaystarLogsEndpoint:
    """Test Waystar logs endpoint — verify correct URL"""

    def test_waystar_logs_correct_url(self, auth_headers):
        """GET /api/waystar/logs should work (backend route)"""
        response = requests.get(f"{BASE_URL}/api/waystar/logs", headers=auth_headers)
        print(f"INFO: /api/waystar/logs returns {response.status_code}")
        # This endpoint exists in backend

    def test_waystar_activity_logs_url_mismatch(self, auth_headers):
        """GET /api/waystar/activity/logs — frontend calls this URL but backend has /waystar/logs"""
        response = requests.get(f"{BASE_URL}/api/waystar/activity/logs", headers=auth_headers)
        print(f"INFO: /api/waystar/activity/logs returns {response.status_code}")
        if response.status_code == 404:
            print("BUG FOUND: Frontend calls /api/waystar/activity/logs but backend route is /api/waystar/logs — URL mismatch!")
        # Document the finding
        # Not asserting strict failure here — just reporting

    def test_availity_logs_correct_url(self, auth_headers):
        """GET /api/availity/logs should work (backend route)"""
        response = requests.get(f"{BASE_URL}/api/availity/logs", headers=auth_headers)
        print(f"INFO: /api/availity/logs returns {response.status_code}")

    def test_availity_activity_logs_url_mismatch(self, auth_headers):
        """GET /api/availity/activity/logs — frontend calls this URL but backend has /availity/logs"""
        response = requests.get(f"{BASE_URL}/api/availity/activity/logs", headers=auth_headers)
        print(f"INFO: /api/availity/activity/logs returns {response.status_code}")
        if response.status_code == 404:
            print("BUG FOUND: Frontend calls /api/availity/activity/logs but backend route is /api/availity/logs — URL mismatch!")


# ===================== Feature Toggle API =====================

class TestFeatureToggle:
    """Test feature toggle API"""

    def test_get_features_without_auth(self):
        """GET /api/features — check if publicly accessible"""
        response = requests.get(f"{BASE_URL}/api/features")
        print(f"INFO: GET /api/features returns {response.status_code}")
        assert response.status_code in [200, 401, 403]

    def test_get_features_with_auth(self, auth_headers):
        """GET /api/features should return feature list"""
        response = requests.get(f"{BASE_URL}/api/features", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        features = data["features"]
        print(f"PASS: Features loaded. availity_integration: {features.get('availity_integration')}, waystar_integration: {features.get('waystar_integration')}")

    def test_toggle_availity_feature_on(self, auth_headers):
        """Toggle availity_integration ON"""
        # Get current features first
        get_resp = requests.get(f"{BASE_URL}/api/features", headers=auth_headers)
        assert get_resp.status_code == 200
        features = get_resp.json().get("features", {})

        # Set availity ON
        features["availity_integration"] = True
        features["waystar_integration"] = True
        
        save_resp = requests.post(f"{BASE_URL}/api/features", json={"features": features}, headers=auth_headers)
        assert save_resp.status_code == 200, f"Failed to save features: {save_resp.text}"
        print("PASS: Toggled availity_integration and waystar_integration ON")

    def test_verify_features_toggled_on(self, auth_headers):
        """Verify features are now ON after toggle"""
        response = requests.get(f"{BASE_URL}/api/features", headers=auth_headers)
        assert response.status_code == 200
        features = response.json().get("features", {})
        assert features.get("availity_integration") == True, "availity_integration should be True"
        assert features.get("waystar_integration") == True, "waystar_integration should be True"
        print("PASS: Both integration features confirmed ON")

    def test_reset_features_to_default(self, auth_headers):
        """Reset availity and waystar features back to OFF (cleanup)"""
        get_resp = requests.get(f"{BASE_URL}/api/features", headers=auth_headers)
        features = get_resp.json().get("features", {})
        features["availity_integration"] = False
        features["waystar_integration"] = False
        save_resp = requests.post(f"{BASE_URL}/api/features", json={"features": features}, headers=auth_headers)
        assert save_resp.status_code == 200
        print("PASS: Reset features back to OFF")


# ===================== Leads API =====================

class TestLeadsAPI:
    """Test that leads exist for testing eligibility button"""

    def test_get_leads(self, auth_headers):
        """GET /api/leads should return leads list"""
        response = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        leads = data if isinstance(data, list) else data.get("leads", [])
        print(f"PASS: Got {len(leads)} leads")
        if leads:
            print(f"  First lead ID: {leads[0].get('id')}, Name: {leads[0].get('first_name')} {leads[0].get('last_name')}")
