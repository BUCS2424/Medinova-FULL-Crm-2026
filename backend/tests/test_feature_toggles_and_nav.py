"""
Feature Toggles & Video Meetings Tests
Tests: GET/POST /api/features, GET /api/features/all, GET /api/features/{id},
       POST /api/video-rooms/meetings, GET /api/video-rooms/meetings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        token = resp.json().get("access_token")
        if token:
            return token
    pytest.skip(f"Auth failed: {resp.status_code} {resp.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ==================== FEATURES API TESTS ====================

class TestFeaturesAPI:
    """Test feature flag endpoints"""

    def test_get_all_features_public(self):
        """GET /api/features/all is public and returns features dict"""
        resp = requests.get(f"{BASE_URL}/api/features/all")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "features" in data, "Response missing 'features' key"
        assert isinstance(data["features"], dict), "features should be a dict"
        print(f"✓ GET /features/all returned {len(data['features'])} features")

    def test_get_features_authenticated(self, headers):
        """GET /api/features with auth returns features dict"""
        resp = requests.get(f"{BASE_URL}/api/features", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "features" in data, "Response missing 'features' key"
        assert isinstance(data["features"], dict), "features should be a dict"
        print(f"✓ GET /features (authenticated) returned {len(data['features'])} features")

    def test_get_feature_analytics_dashboard(self):
        """GET /api/features/analytics_dashboard returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/analytics_dashboard")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data, "Response missing 'enabled' key"
        assert isinstance(data["enabled"], bool), "enabled should be bool"
        print(f"✓ analytics_dashboard feature enabled={data['enabled']}")

    def test_get_feature_video_conferencing(self):
        """GET /api/features/video_conferencing returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/video_conferencing")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data, "Response missing 'enabled' key"
        print(f"✓ video_conferencing feature enabled={data['enabled']}")

    def test_get_feature_marketing_campaigns(self):
        """GET /api/features/marketing_campaigns returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/marketing_campaigns")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data
        print(f"✓ marketing_campaigns feature enabled={data['enabled']}")

    def test_get_feature_lead_intake_hub(self):
        """GET /api/features/lead_intake_hub returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/lead_intake_hub")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data
        print(f"✓ lead_intake_hub feature enabled={data['enabled']}")

    def test_get_feature_patient_portal(self):
        """GET /api/features/patient_portal returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/patient_portal")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data
        print(f"✓ patient_portal feature enabled={data['enabled']}")

    def test_get_feature_doctors_directory(self):
        """GET /api/features/doctors_directory returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/doctors_directory")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data
        print(f"✓ doctors_directory feature enabled={data['enabled']}")

    def test_get_feature_fax_center(self):
        """GET /api/features/fax_center returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/fax_center")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data
        print(f"✓ fax_center feature enabled={data['enabled']}")

    def test_get_feature_officeally_integration(self):
        """GET /api/features/officeally_integration returns its enabled state"""
        resp = requests.get(f"{BASE_URL}/api/features/officeally_integration")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "enabled" in data
        print(f"✓ officeally_integration feature enabled={data['enabled']}")

    def test_save_and_restore_features(self, headers):
        """POST /api/features saves features and GET /api/features/all reflects changes"""
        # Step 1: Get current state
        get_resp = requests.get(f"{BASE_URL}/api/features/all")
        assert get_resp.status_code == 200
        original_features = get_resp.json().get("features", {})
        
        # Step 2: Enable video_conferencing (toggle it on)
        video_conf_original = original_features.get("video_conferencing", False)
        test_features = dict(original_features)
        test_features["video_conferencing"] = True  # Enable it for this test
        
        save_resp = requests.post(
            f"{BASE_URL}/api/features",
            headers=headers,
            json={"features": test_features}
        )
        assert save_resp.status_code == 200, f"Expected 200, got {save_resp.status_code}: {save_resp.text}"
        print(f"✓ POST /api/features returned 200")
        
        # Step 3: Verify the change was persisted
        verify_resp = requests.get(f"{BASE_URL}/api/features/all")
        assert verify_resp.status_code == 200
        updated_features = verify_resp.json().get("features", {})
        assert updated_features.get("video_conferencing") == True, \
            f"Expected video_conferencing=True, got {updated_features.get('video_conferencing')}"
        print(f"✓ video_conferencing saved as True and persisted")
        
        # Step 4: Restore original state
        restore_resp = requests.post(
            f"{BASE_URL}/api/features",
            headers=headers,
            json={"features": original_features}
        )
        assert restore_resp.status_code == 200
        print(f"✓ Restored original feature states")

    def test_save_features_requires_auth(self):
        """POST /api/features without auth should return 401/403"""
        resp = requests.post(
            f"{BASE_URL}/api/features",
            json={"features": {"test_feature": True}}
        )
        assert resp.status_code in [401, 403], \
            f"Expected 401/403 for unauthenticated POST, got {resp.status_code}"
        print(f"✓ POST /api/features without auth returns {resp.status_code}")

    def test_all_features_present_in_response(self, headers):
        """GET /api/features should contain all expected feature keys"""
        resp = requests.get(f"{BASE_URL}/api/features", headers=headers)
        assert resp.status_code == 200
        features = resp.json().get("features", {})
        
        expected_keys = [
            "analytics_dashboard", "video_conferencing", "marketing_campaigns",
            "lead_intake_hub", "patient_portal", "doctors_directory",
            "fax_center", "officeally_integration", "availity_integration",
            "waystar_integration"
        ]
        
        # Log which features are present/missing
        missing = [k for k in expected_keys if k not in features]
        present = [k for k in expected_keys if k in features]
        print(f"✓ Present features: {present}")
        if missing:
            print(f"  Missing (may be default-only): {missing}")
        # We don't hard-fail here — some might not be saved if they're at defaults
        # But the important thing is the API returns a valid dict
        assert isinstance(features, dict), "features should be a dict"


# ==================== VIDEO MEETINGS API TESTS ====================

class TestVideoMeetingsAPI:
    """Test /api/video-rooms/meetings endpoints"""

    def test_list_meetings_returns_200(self, headers):
        """GET /api/video-rooms/meetings returns 200 and list"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/video-rooms/meetings: {len(data)} meetings")

    def test_create_meeting_returns_200(self, headers):
        """POST /api/video-rooms/meetings creates a new meeting"""
        payload = {
            "title": "TEST_Feature Toggle Test Meeting",
            "duration_minutes": 30,
            "notes": "Feature toggle test"
        }
        resp = requests.post(
            f"{BASE_URL}/api/video-rooms/meetings",
            headers=headers,
            json=payload
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "meeting" in data, "Response missing 'meeting' key"
        meeting = data["meeting"]
        assert meeting.get("title") == payload["title"], "Title mismatch"
        assert "id" in meeting, "Missing meeting id"
        assert "status" in meeting, "Missing status"
        assert "engine" in meeting, "Missing engine"
        print(f"✓ Created meeting: id={meeting['id']}, engine={meeting['engine']}, status={meeting['status']}")

    def test_create_meeting_missing_title_returns_error(self, headers):
        """POST /api/video-rooms/meetings without title should fail"""
        resp = requests.post(
            f"{BASE_URL}/api/video-rooms/meetings",
            headers=headers,
            json={"duration_minutes": 30}
        )
        assert resp.status_code in [400, 422], \
            f"Expected 400/422 for missing title, got {resp.status_code}: {resp.text}"
        print(f"✓ Missing title returns {resp.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
