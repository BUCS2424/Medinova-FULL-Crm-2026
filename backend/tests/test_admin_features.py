"""
Backend API tests for Admin Settings features:
- DME Operating States configuration
- Auto-populate doctors
- Role Management
- File Management (Patient files)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


class TestAuthentication:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful, role: {data['user']['role']}")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestDMEOperatingStates:
    """Tests for DME Operating States configuration"""
    
    def test_get_dme_operating_states(self, auth_headers):
        """Test GET /api/settings/dme-operating-states"""
        response = requests.get(
            f"{BASE_URL}/api/settings/dme-operating-states",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "states" in data
        assert isinstance(data["states"], list)
        print(f"✓ GET DME operating states: {len(data['states'])} states configured")
    
    def test_save_dme_operating_states(self, auth_headers):
        """Test POST /api/settings/dme-operating-states"""
        # Save new states
        response = requests.post(
            f"{BASE_URL}/api/settings/dme-operating-states",
            headers=auth_headers,
            params={
                "states": ["VA", "NC", "FL", "GA"],
                "auto_populate_enabled": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "states" in data
        print(f"✓ POST DME operating states saved: {data['states']}")
        
        # Verify states were saved
        verify_response = requests.get(
            f"{BASE_URL}/api/settings/dme-operating-states",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert set(verify_data["states"]) == {"VA", "NC", "FL", "GA"}
        print("✓ States verified after save")
    
    def test_get_us_states_list(self, auth_headers):
        """Test GET /api/settings/us-states returns all US states"""
        response = requests.get(
            f"{BASE_URL}/api/settings/us-states",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 50  # At least 50 US states
        # Check structure
        if len(data) > 0:
            assert "code" in data[0]
            assert "name" in data[0]
        print(f"✓ GET US states list: {len(data)} states returned")


class TestDoctorsAutoPopulate:
    """Tests for Doctors auto-populate feature"""
    
    def test_get_doctors_list(self, auth_headers):
        """Test GET /api/users returns doctors"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Filter for doctors
        doctors = [u for u in data if u.get("role") == "doctor"]
        print(f"✓ GET users: {len(doctors)} doctors found")
    
    def test_auto_populate_doctors(self, auth_headers):
        """Test POST /api/doctors/auto-populate"""
        # First ensure states are configured
        requests.post(
            f"{BASE_URL}/api/settings/dme-operating-states",
            headers=auth_headers,
            params={
                "states": ["VA", "NC"],
                "auto_populate_enabled": True
            }
        )
        
        # Auto-populate doctors
        response = requests.post(
            f"{BASE_URL}/api/doctors/auto-populate",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "created_count" in data
        assert "states" in data
        print(f"✓ Auto-populate doctors: {data['created_count']} created, {data.get('skipped_count', 0)} skipped")
    
    def test_get_doctors_by_states(self, auth_headers):
        """Test GET /api/doctors/by-states with state filter"""
        response = requests.get(
            f"{BASE_URL}/api/doctors/by-states",
            headers=auth_headers,
            params={"states": "VA,NC"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned doctors are from VA or NC
        for doctor in data:
            assert doctor.get("state") in ["VA", "NC"], f"Doctor {doctor.get('email')} has unexpected state: {doctor.get('state')}"
        print(f"✓ GET doctors by states: {len(data)} doctors in VA/NC")


class TestRoleManagement:
    """Tests for Role Management feature"""
    
    def test_get_roles(self, auth_headers):
        """Test GET /api/roles returns all roles"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4  # At least admin, sales_rep, doctor, patient
        
        # Check for system roles
        role_names = [r.get("name") for r in data]
        assert "admin" in role_names, "Admin role not found"
        print(f"✓ GET roles: {len(data)} roles found - {role_names}")
    
    def test_get_role_by_id(self, auth_headers):
        """Test GET /api/roles/{role_id}"""
        # First get all roles
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers=auth_headers
        )
        roles = response.json()
        
        if len(roles) > 0:
            role_id = roles[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/roles/{role_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == role_id
            print(f"✓ GET role by ID: {data['name']}")
    
    def test_create_role(self, auth_headers):
        """Test POST /api/roles creates new role"""
        import uuid
        test_role_name = f"test_role_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/roles",
            headers=auth_headers,
            json={
                "name": test_role_name,
                "display_name": "Test Role",
                "description": "Test role for automated testing",
                "permissions": {
                    "patients": {"view": True, "create": False, "edit": False, "delete": False},
                    "leads": {"view": True, "create": False, "edit": False, "delete": False}
                }
            }
        )
        assert response.status_code == 200, f"Create role failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == test_role_name
        print(f"✓ POST create role: {data['name']} created")
        
        # Cleanup - delete the test role
        delete_response = requests.delete(
            f"{BASE_URL}/api/roles/{data['id']}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Cleanup: Test role deleted")
    
    def test_get_permissions_template(self, auth_headers):
        """Test GET /api/roles/permissions/template"""
        response = requests.get(
            f"{BASE_URL}/api/roles/permissions/template",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        # Check for expected permission categories
        expected_categories = ["patients", "leads", "orders", "documents"]
        for category in expected_categories:
            assert category in data, f"Missing permission category: {category}"
        print(f"✓ GET permissions template: {len(data)} categories")
    
    def test_cannot_delete_system_role(self, auth_headers):
        """Test that system roles cannot be deleted"""
        # Get admin role
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers=auth_headers
        )
        roles = response.json()
        admin_role = next((r for r in roles if r.get("name") == "admin"), None)
        
        if admin_role:
            delete_response = requests.delete(
                f"{BASE_URL}/api/roles/{admin_role['id']}",
                headers=auth_headers
            )
            assert delete_response.status_code == 400, "Should not be able to delete system role"
            print("✓ System role deletion correctly blocked")


class TestPatientFileManagement:
    """Tests for Patient File Management"""
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        """Get or create a test patient"""
        # Get existing patients
        response = requests.get(
            f"{BASE_URL}/api/patients",
            headers=auth_headers
        )
        patients = response.json()
        
        if len(patients) > 0:
            return patients[0]["id"]
        
        # Create a test patient if none exist
        create_response = requests.post(
            f"{BASE_URL}/api/patients",
            headers=auth_headers,
            json={
                "first_name": "Test",
                "last_name": "Patient",
                "phone": "(555) 123-4567",
                "email": "test.patient@example.com",
                "date_of_birth": "1990-01-01"
            }
        )
        if create_response.status_code == 200:
            return create_response.json()["id"]
        pytest.skip("Could not get or create test patient")
    
    def test_get_patient_files(self, auth_headers, test_patient_id):
        """Test GET /api/patients/{patient_id}/files"""
        response = requests.get(
            f"{BASE_URL}/api/patients/{test_patient_id}/files",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert isinstance(data["files"], list)
        print(f"✓ GET patient files: {len(data['files'])} files found")
    
    def test_get_patient_file_metadata(self, auth_headers, test_patient_id):
        """Test GET /api/patients/{patient_id}/file-metadata"""
        response = requests.get(
            f"{BASE_URL}/api/patients/{test_patient_id}/file-metadata",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET patient file metadata: {len(data)} metadata records")


class TestLeadFileManagement:
    """Tests for Lead File Management"""
    
    @pytest.fixture
    def test_lead_id(self, auth_headers):
        """Get or create a test lead"""
        # Get existing leads
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers=auth_headers
        )
        leads = response.json()
        
        if len(leads) > 0:
            return leads[0]["id"]
        
        # Create a test lead if none exist
        create_response = requests.post(
            f"{BASE_URL}/api/leads",
            headers=auth_headers,
            json={
                "first_name": "Test",
                "last_name": "Lead",
                "phone": "(555) 987-6543"
            }
        )
        if create_response.status_code == 200:
            return create_response.json()["id"]
        pytest.skip("Could not get or create test lead")
    
    def test_get_lead_files(self, auth_headers, test_lead_id):
        """Test GET /api/leads/{lead_id}/files"""
        response = requests.get(
            f"{BASE_URL}/api/leads/{test_lead_id}/files",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert isinstance(data["files"], list)
        print(f"✓ GET lead files: {len(data['files'])} files found")


class TestStorageEndpoints:
    """Tests for Storage/File endpoints"""
    
    def test_storage_folder_endpoint(self, auth_headers):
        """Test GET /api/storage/folder/{folder_type}/{entity_id}"""
        # Get a patient first
        patients_response = requests.get(
            f"{BASE_URL}/api/patients",
            headers=auth_headers
        )
        patients = patients_response.json()
        
        if len(patients) > 0:
            patient_id = patients[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/storage/folder/patients/{patient_id}",
                headers=auth_headers
            )
            # This endpoint may return 200 or 404 depending on if folder exists
            assert response.status_code in [200, 404]
            print(f"✓ Storage folder endpoint responded with status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
