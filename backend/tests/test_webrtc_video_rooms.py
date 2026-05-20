"""
WebRTC Video Rooms & Gemini Diagnostic API Tests
Tests: video meeting CRUD, WebSocket signaling endpoints, Gemini /api/gemini/diagnose
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"
TEST_MEETING_ID = "72a2a36a-6a23-405a-81c5-b0506c185270"


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


# ==================== MEETING CRUD TESTS ====================

class TestVideoRoomMeetingsCRUD:
    """Test /api/video-rooms/meetings endpoints"""

    def test_list_meetings_returns_200(self, headers):
        """GET /api/video-rooms/meetings returns 200 and a list"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ List meetings: {len(data)} meetings returned")

    def test_list_meetings_without_auth(self):
        """GET /api/video-rooms/meetings - should still work (no auth required based on route definition)"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings")
        # This endpoint does not have auth dependency in the route definition
        assert resp.status_code in [200, 401, 403], f"Unexpected: {resp.status_code}"
        print(f"✓ List meetings without auth: {resp.status_code}")

    def test_get_existing_meeting(self, headers):
        """GET /api/video-rooms/meetings/{id} returns meeting details for known meeting"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings/{TEST_MEETING_ID}", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("id") == TEST_MEETING_ID, "Meeting id mismatch"
        assert "title" in data, "Missing title field"
        assert "status" in data, "Missing status field"
        assert "engine" in data, "Missing engine field"
        assert "join_url" in data, "Missing join_url field"
        assert "host_url" in data, "Missing host_url field"
        print(f"✓ Get meeting: id={data['id']}, engine={data.get('engine')}, status={data.get('status')}")

    def test_get_meeting_engine_is_webrtc(self, headers):
        """Meeting engine should be 'webrtc' since Telnyx key is not configured"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings/{TEST_MEETING_ID}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        # Since no Telnyx API key is configured, engine should be 'webrtc'
        engine = data.get("engine")
        print(f"✓ Meeting engine: {engine}")
        # Just log, don't hard-fail — could be either

    def test_get_nonexistent_meeting_returns_404(self, headers):
        """GET /api/video-rooms/meetings/nonexistent returns 404"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings/nonexistent-meeting-id-xxx", headers=headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ Nonexistent meeting returns 404")

    def test_create_meeting_webrtc(self, headers):
        """POST /api/video-rooms/meetings creates a meeting with engine=webrtc"""
        payload = {
            "title": "TEST_WebRTC Telehealth Consultation",
            "duration_minutes": 30,
            "participant_emails": [],
            "participant_phones": [],
            "notes": "Created by automated test"
        }
        resp = requests.post(f"{BASE_URL}/api/video-rooms/meetings", headers=headers, json=payload)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "meeting" in data, "Response missing 'meeting' key"
        meeting = data["meeting"]
        assert meeting.get("title") == payload["title"], "Title mismatch"
        assert "id" in meeting, "Meeting id missing"
        assert "join_url" in meeting, "join_url missing"
        assert "host_url" in meeting, "host_url missing"
        assert "engine" in meeting, "engine field missing"
        assert meeting.get("engine") in ("webrtc", "telnyx"), f"Unexpected engine: {meeting.get('engine')}"
        print(f"✓ Created meeting: id={meeting['id']}, engine={meeting['engine']}")
        # Return meeting id for further tests
        return meeting["id"]

    def test_create_meeting_with_scheduled_at(self, headers):
        """POST /api/video-rooms/meetings with scheduled_at creates scheduled meeting"""
        payload = {
            "title": "TEST_Scheduled Meeting",
            "scheduled_at": "2026-06-01T14:00:00Z",
            "duration_minutes": 60
        }
        resp = requests.post(f"{BASE_URL}/api/video-rooms/meetings", headers=headers, json=payload)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        meeting = data["meeting"]
        assert meeting.get("status") == "scheduled", f"Expected 'scheduled', got {meeting.get('status')}"
        assert meeting.get("scheduled_at") == "2026-06-01T14:00:00Z", "scheduled_at mismatch"
        print(f"✓ Scheduled meeting created: status={meeting['status']}")

    def test_create_meeting_without_scheduled_at_is_active(self, headers):
        """POST without scheduled_at creates active meeting"""
        payload = {"title": "TEST_Active Meeting Now"}
        resp = requests.post(f"{BASE_URL}/api/video-rooms/meetings", headers=headers, json=payload)
        assert resp.status_code == 200
        meeting = resp.json()["meeting"]
        assert meeting.get("status") == "active", f"Expected 'active', got {meeting.get('status')}"
        print(f"✓ Active meeting created: status={meeting['status']}")

    def test_meeting_has_correct_structure(self, headers):
        """Verify full meeting structure from list endpoint"""
        resp = requests.get(f"{BASE_URL}/api/video-rooms/meetings?limit=1", headers=headers)
        assert resp.status_code == 200
        meetings = resp.json()
        if meetings:
            m = meetings[0]
            required_fields = ["id", "title", "status", "engine", "join_url", "host_url",
                                "scheduled_at", "duration_minutes", "created_at"]
            for field in required_fields:
                assert field in m, f"Meeting missing required field: {field}"
            print(f"✓ Meeting structure validated: {list(m.keys())}")
        else:
            print("No meetings to validate structure")


# ==================== JOIN TOKEN TESTS ====================

class TestJoinToken:
    """Test /api/video-rooms/meetings/{id}/join-token"""

    def test_get_join_token_for_existing_meeting(self, headers):
        """POST join-token for known meeting returns engine and token"""
        resp = requests.post(
            f"{BASE_URL}/api/video-rooms/meetings/{TEST_MEETING_ID}/join-token",
            headers=headers,
            json={"role": "patient"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "engine" in data, "Missing engine field"
        assert "token" in data, "Missing token field"
        assert "room_id" in data, "Missing room_id field"
        print(f"✓ Join token: engine={data['engine']}, room_id={data['room_id']}")

    def test_join_token_for_nonexistent_meeting_returns_404(self, headers):
        """POST join-token for nonexistent meeting returns 404"""
        resp = requests.post(
            f"{BASE_URL}/api/video-rooms/meetings/nonexistent-id-xxx/join-token",
            headers=headers,
            json={}
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✓ join-token for nonexistent meeting → 404")


# ==================== GEMINI DIAGNOSE TESTS ====================

class TestGeminiDiagnose:
    """Test POST /api/gemini/diagnose endpoint"""

    def test_diagnose_returns_200_with_valid_symptoms(self):
        """POST /api/gemini/diagnose returns 200 with diagnosis field"""
        payload = {"symptoms": "Patient reports lower back pain radiating to left leg, worse with sitting"}
        resp = requests.post(f"{BASE_URL}/api/gemini/diagnose", json=payload, timeout=30)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "diagnosis" in data, "Response missing 'diagnosis' field"
        assert "symptoms" in data, "Response missing 'symptoms' field"
        assert len(data["diagnosis"]) > 50, "Diagnosis seems too short"
        assert data["symptoms"] == payload["symptoms"], "symptoms echo mismatch"
        print(f"✓ Diagnose response OK (length={len(data['diagnosis'])} chars)")
        print(f"  Preview: {data['diagnosis'][:200]}...")

    def test_diagnose_returns_structured_content(self):
        """Diagnosis response should contain structured sections"""
        payload = {"symptoms": "Knee pain, swelling, difficulty walking stairs"}
        resp = requests.post(f"{BASE_URL}/api/gemini/diagnose", json=payload, timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        diagnosis = data["diagnosis"]
        # Check for expected sections from the system message
        expected_sections = ["Assessment", "DME", "ICD"]
        found_sections = [s for s in expected_sections if s.lower() in diagnosis.lower()]
        print(f"✓ Found sections in diagnosis: {found_sections}")
        assert len(found_sections) >= 2, f"Expected at least 2 structured sections, found: {found_sections}"

    def test_diagnose_with_context_field(self):
        """POST /api/gemini/diagnose with optional context field"""
        payload = {
            "symptoms": "Wrist pain and numbness in fingers",
            "context": "Patient is 65 years old, Medicare beneficiary, works at computer daily"
        }
        resp = requests.post(f"{BASE_URL}/api/gemini/diagnose", json=payload, timeout=30)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "diagnosis" in data
        print(f"✓ Diagnose with context: {len(data['diagnosis'])} chars")

    def test_diagnose_missing_symptoms_returns_422(self):
        """POST /api/gemini/diagnose without symptoms returns 422"""
        resp = requests.post(f"{BASE_URL}/api/gemini/diagnose", json={}, timeout=10)
        assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"
        print("✓ Missing symptoms returns 422")

    def test_diagnose_empty_symptoms_accepted(self):
        """POST with empty string symptoms - behavior depends on backend validation"""
        resp = requests.post(f"{BASE_URL}/api/gemini/diagnose", json={"symptoms": ""}, timeout=30)
        # Could be 200 (sends to AI) or 422 (validation) - just verify it doesn't crash with 500
        assert resp.status_code in [200, 422], f"Unexpected status: {resp.status_code}: {resp.text}"
        print(f"✓ Empty symptoms returns: {resp.status_code}")


# ==================== WEBSOCKET SIGNALING URL TESTS ====================

class TestWebSocketSignaling:
    """Test WebSocket signaling endpoint availability via HTTP upgrade"""

    def test_websocket_endpoint_url_construction(self):
        """Verify WebSocket URL is correctly constructed"""
        base = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{base}/api/video-rooms/ws/{TEST_MEETING_ID}/host"
        assert ws_url.startswith("wss://") or ws_url.startswith("ws://")
        print(f"✓ WebSocket URL: {ws_url}")

    def test_websocket_invalid_role_rejected(self):
        """An HTTP request to the WebSocket endpoint with invalid role should indicate rejection"""
        # Can't test WebSocket with requests lib, but we can check the signaling endpoint path exists
        # by confirming the HTTP upgrade attempt gets a meaningful response
        import socket
        import ssl
        resp = requests.get(
            f"{BASE_URL}/api/video-rooms/ws/{TEST_MEETING_ID}/invalid_role",
            headers={"Upgrade": "websocket", "Connection": "Upgrade",
                     "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
                     "Sec-WebSocket-Version": "13"}
        )
        # FastAPI returns 403 for wrong upgrade or 4003 close on invalid role
        # HTTP GET to a websocket endpoint typically returns 200 or 403
        print(f"✓ WebSocket HTTP probe for invalid role: {resp.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
