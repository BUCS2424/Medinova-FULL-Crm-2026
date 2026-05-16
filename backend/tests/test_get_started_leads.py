"""
Tests for /api/public/leads endpoint — used by /get-started page
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestPublicLeadsEndpoint:
    """Tests for POST /api/public/leads (public intake form backend)"""

    VALID_PAYLOAD = {
        "firstName": "Jane",
        "lastName": "Doe",
        "phone": "5551234567",
        "email": "jane@test.com",
        "zipCode": "90210",
        "painLocation": "back",
        "insuranceType": "medicare",
        "hasDoctor": "yes",
        "bestTime": "morning",
        "formType": "get_started_page",
        "consentContact": True,
        "consentHipaa": True,
        "consentInsurance": True,
        "electronicSignature": "Jane Doe",
        "consentLanguage": "Consent to Contact, HIPAA Authorization, and Insurance Understanding accepted via /get-started page.",
        "consentVersion": "2.0",
        "submissionDuration": 12000,
        "userAgent": "Mozilla/5.0 TestAgent",
        "screenResolution": "1920x1080",
        "timezone": "America/New_York",
    }

    def test_valid_submission_without_tcpa(self):
        """Test form submission with fields exactly as frontend sends — no consentTcpa"""
        payload = dict(self.VALID_PAYLOAD)
        # Do NOT include consentTcpa — matching what the frontend sends
        assert "consentTcpa" not in payload, "This test must not include consentTcpa"
        
        response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
        print(f"Status: {response.status_code}, Body: {response.text[:300]}")
        # This is the critical test — if backend requires consentTcpa this will return 422
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
        data = response.json()
        assert "lead_id" in data or "id" in data or "success" in data or "message" in data

    def test_valid_submission_with_tcpa(self):
        """Test form submission with consentTcpa included"""
        payload = {**self.VALID_PAYLOAD, "consentTcpa": True}
        response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
        print(f"Status: {response.status_code}, Body: {response.text[:300]}")
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
        data = response.json()
        assert "lead_id" in data or "id" in data or "success" in data or "message" in data

    def test_missing_first_name_returns_422(self):
        """Required field validation — firstName missing"""
        payload = {**self.VALID_PAYLOAD, "consentTcpa": True}
        del payload["firstName"]
        response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
        print(f"Status: {response.status_code}")
        assert response.status_code in [400, 422], f"Expected 400/422 but got {response.status_code}"

    def test_missing_phone_returns_422(self):
        """Required field validation — phone missing"""
        payload = {**self.VALID_PAYLOAD, "consentTcpa": True, "phone": ""}
        response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
        print(f"Status: {response.status_code}")
        assert response.status_code in [400, 422], f"Expected 400/422 but got {response.status_code}"

    def test_missing_consent_contact_returns_422(self):
        """Consent validation — consentContact is False"""
        payload = {**self.VALID_PAYLOAD, "consentTcpa": True, "consentContact": False}
        response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
        print(f"Status: {response.status_code}")
        assert response.status_code in [400, 422], f"Expected 400/422 but got {response.status_code}"

    def test_honeypot_bot_protection(self):
        """Honeypot field filled should block submission"""
        payload = {**self.VALID_PAYLOAD, "consentTcpa": True, "website": "http://spam.com"}
        response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
        print(f"Status: {response.status_code}")
        assert response.status_code == 400, f"Expected 400 for bot but got {response.status_code}"

    def test_all_pain_locations(self):
        """Test each pain location option"""
        for pain in ["back", "knee", "wrist", "shoulder", "other"]:
            payload = {**self.VALID_PAYLOAD, "consentTcpa": True, "painLocation": pain}
            response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
            print(f"Pain={pain}: Status={response.status_code}")
            assert response.status_code == 200, f"Failed for pain={pain}: {response.text}"

    def test_all_insurance_types(self):
        """Test each insurance type option"""
        for ins in ["medicare", "medicaid", "private", "other"]:
            payload = {**self.VALID_PAYLOAD, "consentTcpa": True, "insuranceType": ins}
            response = requests.post(f"{BASE_URL}/api/public/leads", json=payload)
            print(f"Insurance={ins}: Status={response.status_code}")
            assert response.status_code == 200, f"Failed for insurance={ins}: {response.text}"
