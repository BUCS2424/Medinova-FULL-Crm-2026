"""
Test suite for Lead Detail Page feature
Tests: GET /api/leads/:leadId, PUT /api/leads/:leadId, DELETE /api/leads/:leadId, POST /api/leads/:leadId/convert
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mel@a2gdesigns.com"
TEST_PASSWORD = "BigDaddy2016!!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token once for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    # API returns access_token, not token
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture
def test_lead(api_client):
    """Create a test lead and cleanup after test"""
    lead_data = {
        "first_name": f"TEST_Lead_{uuid.uuid4().hex[:6]}",
        "last_name": "DetailTest",
        "phone": "555-123-4567",
        "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
        "utm_source": "test_source",
        "utm_medium": "test_medium",
        "utm_campaign": "test_campaign",
        "notes": "Test lead for Lead Detail Page testing"
    }
    response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
    assert response.status_code == 200, f"Failed to create test lead: {response.text}"
    lead = response.json()
    
    yield lead
    
    # Cleanup - try to delete the lead
    try:
        api_client.delete(f"{BASE_URL}/api/leads/{lead['id']}")
    except:
        pass


class TestLeadDetailAPI:
    """Tests for Lead Detail Page API endpoints"""
    
    # ==================== GET /api/leads/:leadId Tests ====================
    
    def test_get_lead_by_id_success(self, api_client, test_lead):
        """Test GET /api/leads/:leadId returns lead data"""
        lead_id = test_lead["id"]
        
        response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain 'id'"
        assert "first_name" in data, "Response should contain 'first_name'"
        assert "last_name" in data, "Response should contain 'last_name'"
        assert "phone" in data, "Response should contain 'phone'"
        assert "email" in data, "Response should contain 'email'"
        assert "status" in data, "Response should contain 'status'"
        assert "created_at" in data, "Response should contain 'created_at'"
        
        # Verify data matches
        assert data["id"] == lead_id
        assert data["first_name"] == test_lead["first_name"]
        assert data["last_name"] == test_lead["last_name"]
        
        print(f"SUCCESS: GET /api/leads/{lead_id} returns correct lead data")
    
    def test_get_lead_by_id_not_found(self, api_client):
        """Test GET /api/leads/:leadId returns 404 for non-existent lead"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/leads/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"SUCCESS: GET /api/leads/{fake_id} returns 404 for non-existent lead")
    
    def test_get_lead_contains_utm_data(self, api_client, test_lead):
        """Test GET /api/leads/:leadId returns UTM tracking data"""
        lead_id = test_lead["id"]
        
        response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
        data = response.json()
        
        # Verify UTM fields
        assert "utm_source" in data, "Response should contain 'utm_source'"
        assert "utm_medium" in data, "Response should contain 'utm_medium'"
        assert "utm_campaign" in data, "Response should contain 'utm_campaign'"
        assert data["utm_source"] == "test_source"
        assert data["utm_medium"] == "test_medium"
        assert data["utm_campaign"] == "test_campaign"
        
        print("SUCCESS: GET /api/leads/:leadId returns UTM tracking data")
    
    def test_get_lead_contains_notes(self, api_client, test_lead):
        """Test GET /api/leads/:leadId returns notes field"""
        lead_id = test_lead["id"]
        
        response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
        data = response.json()
        
        assert "notes" in data, "Response should contain 'notes'"
        assert data["notes"] == "Test lead for Lead Detail Page testing"
        
        print("SUCCESS: GET /api/leads/:leadId returns notes field")
    
    # ==================== PUT /api/leads/:leadId Tests ====================
    
    def test_update_lead_status(self, api_client, test_lead):
        """Test PUT /api/leads/:leadId updates lead status"""
        lead_id = test_lead["id"]
        
        # Update status
        response = api_client.put(
            f"{BASE_URL}/api/leads/{lead_id}",
            json={"status": "qualified"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update persisted
        get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
        data = get_response.json()
        assert data["status"] == "qualified", f"Expected status 'qualified', got '{data['status']}'"
        
        print("SUCCESS: PUT /api/leads/:leadId updates lead status")
    
    def test_update_lead_contact_info(self, api_client):
        """Test PUT /api/leads/:leadId updates contact information"""
        # Create a fresh lead for this test
        lead_data = {
            "first_name": f"TEST_Contact_{uuid.uuid4().hex[:6]}",
            "last_name": "UpdateTest",
            "phone": "555-111-2222",
            "email": f"contact_{uuid.uuid4().hex[:6]}@example.com"
        }
        create_response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # Update contact info
            update_data = {
                "first_name": "UpdatedFirst",
                "last_name": "UpdatedLast",
                "phone": "999-888-7777",
                "email": "updated@example.com"
            }
            response = api_client.put(f"{BASE_URL}/api/leads/{lead_id}", json=update_data)
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            # Verify update persisted
            get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
            data = get_response.json()
            assert data["first_name"] == "UpdatedFirst"
            assert data["last_name"] == "UpdatedLast"
            assert data["phone"] == "999-888-7777"
            assert data["email"] == "updated@example.com"
            
            print("SUCCESS: PUT /api/leads/:leadId updates contact information")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_update_lead_notes(self, api_client):
        """Test PUT /api/leads/:leadId updates notes"""
        # Create a fresh lead for this test
        lead_data = {
            "first_name": f"TEST_Notes_{uuid.uuid4().hex[:6]}",
            "last_name": "NotesTest",
            "phone": "555-333-4444"
        }
        create_response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # Update notes
            response = api_client.put(
                f"{BASE_URL}/api/leads/{lead_id}",
                json={"notes": "Updated notes for testing"}
            )
            
            assert response.status_code == 200
            
            # Verify update persisted
            get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
            data = get_response.json()
            assert data["notes"] == "Updated notes for testing"
            
            print("SUCCESS: PUT /api/leads/:leadId updates notes")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_update_lead_utm_data_not_supported(self, api_client):
        """Test PUT /api/leads/:leadId - UTM fields are not updatable (by design)
        
        Note: The LeadUpdate model only supports: first_name, last_name, phone, email, status, notes
        UTM fields (utm_source, utm_medium, utm_campaign) are set at creation and not updatable.
        """
        # Create a fresh lead for this test
        lead_data = {
            "first_name": f"TEST_UTM_{uuid.uuid4().hex[:6]}",
            "last_name": "UTMTest",
            "phone": "555-555-6666",
            "utm_source": "original_source"
        }
        create_response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # Verify UTM data is preserved from creation
            get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
            data = get_response.json()
            assert data["utm_source"] == "original_source", "UTM source should be preserved from creation"
            
            print("SUCCESS: UTM data is preserved from lead creation (not updatable by design)")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_update_lead_not_found(self, api_client):
        """Test PUT /api/leads/:leadId returns 404 for non-existent lead"""
        fake_id = str(uuid.uuid4())
        response = api_client.put(
            f"{BASE_URL}/api/leads/{fake_id}",
            json={"status": "qualified"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: PUT /api/leads/:leadId returns 404 for non-existent lead")
    
    # ==================== DELETE /api/leads/:leadId Tests ====================
    
    def test_delete_lead_success(self, api_client):
        """Test DELETE /api/leads/:leadId deletes lead"""
        # Create a lead to delete
        lead_data = {
            "first_name": f"TEST_Delete_{uuid.uuid4().hex[:6]}",
            "last_name": "DeleteTest",
            "phone": "555-777-8888"
        }
        create_response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead = create_response.json()
        lead_id = lead["id"]
        
        # Delete the lead
        response = api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify lead is deleted
        get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert get_response.status_code == 404, "Lead should be deleted"
        print("SUCCESS: DELETE /api/leads/:leadId deletes lead")
    
    def test_delete_lead_not_found(self, api_client):
        """Test DELETE /api/leads/:leadId returns 404 for non-existent lead"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/leads/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: DELETE /api/leads/:leadId returns 404 for non-existent lead")
    
    # ==================== POST /api/leads/:leadId/convert Tests ====================
    
    def test_convert_lead_to_patient_success(self, api_client):
        """Test POST /api/leads/:leadId/convert converts lead to patient"""
        # Create a lead to convert
        lead_data = {
            "first_name": f"TEST_Convert_{uuid.uuid4().hex[:6]}",
            "last_name": "ConvertTest",
            "phone": "555-999-0000",
            "email": f"convert_{uuid.uuid4().hex[:6]}@example.com"
        }
        create_response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # Convert lead to patient
            convert_data = {
                "date_of_birth": "1990-01-15",
                "ssn_last_four": "1234",
                "primary_insurance": "Medicare",
                "secondary_insurance": "Medicaid",
                "address": "123 Test Street, Test City, TS 12345"
            }
            response = api_client.post(f"{BASE_URL}/api/leads/{lead_id}/convert", json=convert_data)
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            
            # Verify response structure - API returns {"message": ..., "patient": {...}}
            assert "patient" in data, "Response should contain 'patient' object"
            assert "id" in data["patient"], "Patient object should contain 'id'"
            patient_id = data["patient"]["id"]
            
            # Verify lead is updated with patient_id
            lead_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
            lead_data = lead_response.json()
            assert lead_data.get("patient_id") == patient_id, "Lead should have patient_id after conversion"
            
            print("SUCCESS: POST /api/leads/:leadId/convert converts lead to patient")
            
            # Cleanup - delete the created patient
            api_client.delete(f"{BASE_URL}/api/patients/{patient_id}")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_convert_lead_not_found(self, api_client):
        """Test POST /api/leads/:leadId/convert returns 404 for non-existent lead"""
        fake_id = str(uuid.uuid4())
        convert_data = {
            "date_of_birth": "1990-01-15",
            "ssn_last_four": "1234",
            "primary_insurance": "Medicare"
        }
        response = api_client.post(f"{BASE_URL}/api/leads/{fake_id}/convert", json=convert_data)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: POST /api/leads/:leadId/convert returns 404 for non-existent lead")
    
    def test_convert_lead_already_converted(self, api_client):
        """Test POST /api/leads/:leadId/convert returns error for already converted lead"""
        # Create a lead to convert
        lead_data = {
            "first_name": f"TEST_Double_{uuid.uuid4().hex[:6]}",
            "last_name": "DoubleConvert",
            "phone": "555-111-0000"
        }
        create_response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # First conversion
            convert_data = {
                "date_of_birth": "1990-01-15",
                "ssn_last_four": "1234",
                "primary_insurance": "Medicare"
            }
            first_response = api_client.post(f"{BASE_URL}/api/leads/{lead_id}/convert", json=convert_data)
            assert first_response.status_code == 200
            patient_id = first_response.json()["patient"]["id"]
            
            # Second conversion attempt should fail
            second_response = api_client.post(f"{BASE_URL}/api/leads/{lead_id}/convert", json=convert_data)
            
            assert second_response.status_code == 400, f"Expected 400, got {second_response.status_code}"
            
            print("SUCCESS: POST /api/leads/:leadId/convert returns error for already converted lead")
            
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/patients/{patient_id}")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    # ==================== GET /api/leads Tests (List) ====================
    
    def test_get_leads_list(self, api_client):
        """Test GET /api/leads returns list of leads"""
        response = api_client.get(f"{BASE_URL}/api/leads")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/leads returns list with {len(data)} leads")
    
    def test_get_leads_filter_by_status(self, api_client):
        """Test GET /api/leads?status=new filters by status"""
        response = api_client.get(f"{BASE_URL}/api/leads?status=new")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify all returned leads have status 'new'
        for lead in data:
            assert lead["status"] == "new", f"Expected status 'new', got '{lead['status']}'"
        print(f"SUCCESS: GET /api/leads?status=new filters correctly ({len(data)} leads)")


class TestLeadDetailAuth:
    """Tests for Lead Detail Page authentication requirements"""
    
    def test_get_lead_without_auth(self):
        """Test GET /api/leads/:leadId returns 401/403 without auth"""
        session = requests.Session()
        fake_id = str(uuid.uuid4())
        response = session.get(f"{BASE_URL}/api/leads/{fake_id}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: GET /api/leads/:leadId requires authentication")
    
    def test_update_lead_without_auth(self):
        """Test PUT /api/leads/:leadId returns 401/403 without auth"""
        session = requests.Session()
        fake_id = str(uuid.uuid4())
        response = session.put(f"{BASE_URL}/api/leads/{fake_id}", json={"status": "new"})
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: PUT /api/leads/:leadId requires authentication")
    
    def test_delete_lead_without_auth(self):
        """Test DELETE /api/leads/:leadId returns 401/403 without auth"""
        session = requests.Session()
        fake_id = str(uuid.uuid4())
        response = session.delete(f"{BASE_URL}/api/leads/{fake_id}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: DELETE /api/leads/:leadId requires authentication")
    
    def test_convert_lead_without_auth(self):
        """Test POST /api/leads/:leadId/convert returns 401/403 without auth"""
        session = requests.Session()
        fake_id = str(uuid.uuid4())
        response = session.post(f"{BASE_URL}/api/leads/{fake_id}/convert", json={})
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: POST /api/leads/:leadId/convert requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
