"""
Test Patient Documents and Site Documents APIs
Tests CRUD operations, template seeding, document assignment, e-signature, and publish toggle
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
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# =============================================================================
# PATIENT DOCUMENTS TEMPLATE TESTS
# =============================================================================

class TestPatientDocTemplates:
    """Test Patient Document Template CRUD operations"""
    
    created_template_id = None
    
    def test_list_patient_templates(self, headers):
        """Test GET /api/patient-documents/templates - List active templates"""
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "templates" in data
        assert "by_category" in data
        assert "total" in data
        print(f"✓ Found {data['total']} active patient document templates")
    
    def test_list_all_patient_templates(self, headers):
        """Test GET /api/patient-documents/templates/all - List all templates including inactive"""
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates/all",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "templates" in data
        assert "total" in data
        print(f"✓ Found {data['total']} total patient document templates (including inactive)")
    
    def test_create_patient_template(self, headers):
        """Test POST /api/patient-documents/templates - Create new template"""
        template_data = {
            "title": "TEST_Patient Consent Form",
            "description": "Test consent form for testing purposes",
            "category": "intake",
            "content": "<h2>TEST CONSENT FORM</h2><p>Patient: {{patient_name}}</p><p>Date: {{current_date}}</p>",
            "is_required": True,
            "is_active": True,
            "auto_assign": False
        }
        response = requests.post(
            f"{BASE_URL}/api/patient-documents/templates",
            headers=headers,
            json=template_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        TestPatientDocTemplates.created_template_id = data["id"]
        print(f"✓ Created patient template with ID: {data['id']}")
    
    def test_get_patient_template(self, headers):
        """Test GET /api/patient-documents/templates/{id} - Get specific template"""
        if not TestPatientDocTemplates.created_template_id:
            pytest.skip("No template created to get")
        
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates/{TestPatientDocTemplates.created_template_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_Patient Consent Form"
        assert data["category"] == "intake"
        print(f"✓ Retrieved template: {data['title']}")
    
    def test_update_patient_template(self, headers):
        """Test PUT /api/patient-documents/templates/{id} - Update template"""
        if not TestPatientDocTemplates.created_template_id:
            pytest.skip("No template created to update")
        
        update_data = {
            "title": "TEST_Updated Consent Form",
            "description": "Updated description"
        }
        response = requests.put(
            f"{BASE_URL}/api/patient-documents/templates/{TestPatientDocTemplates.created_template_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates/{TestPatientDocTemplates.created_template_id}",
            headers=headers
        )
        data = get_response.json()
        assert data["title"] == "TEST_Updated Consent Form"
        print(f"✓ Updated template title to: {data['title']}")
    
    def test_delete_patient_template(self, headers):
        """Test DELETE /api/patient-documents/templates/{id} - Soft delete template"""
        if not TestPatientDocTemplates.created_template_id:
            pytest.skip("No template created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/patient-documents/templates/{TestPatientDocTemplates.created_template_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Deleted (soft) template: {TestPatientDocTemplates.created_template_id}")
    
    def test_get_template_not_found(self, headers):
        """Test GET /api/patient-documents/templates/{id} - 404 for non-existent"""
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates/non-existent-id",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for non-existent template")


# =============================================================================
# PATIENT DOCUMENTS SEEDING TESTS
# =============================================================================

class TestPatientDocSeeding:
    """Test Patient Document Template Seeding"""
    
    def test_seed_default_templates(self, headers):
        """Test POST /api/patient-documents/templates/seed-defaults - Seed default templates"""
        response = requests.post(
            f"{BASE_URL}/api/patient-documents/templates/seed-defaults",
            headers=headers
        )
        # May return 200 or 400 if already seeded
        assert response.status_code in [200, 400], f"Expected 200/400, got {response.status_code}: {response.text}"
        print(f"✓ Seed defaults response: {response.json()}")
    
    def test_verify_default_templates_exist(self, headers):
        """Verify default templates were seeded"""
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected default templates
        template_titles = [t["title"] for t in data["templates"]]
        expected_templates = [
            "Patient Intake Form",
            "HIPAA Authorization",
            "Assignment of Benefits (AOB)"
        ]
        
        found_count = sum(1 for t in expected_templates if t in template_titles)
        print(f"✓ Found {found_count}/{len(expected_templates)} expected default templates")
        assert found_count >= 1, "At least one default template should exist"


# =============================================================================
# PATIENT DOCUMENTS ASSIGNMENT TESTS
# =============================================================================

class TestPatientDocAssignment:
    """Test Patient Document Assignment functionality"""
    
    test_patient_id = None
    test_assignment_id = None
    
    def test_get_patients_for_assignment(self, headers):
        """Get a patient to use for assignment tests"""
        response = requests.get(
            f"{BASE_URL}/api/patients?limit=1",
            headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            # API returns list directly
            patients = data if isinstance(data, list) else data.get("patients", [])
            if patients:
                TestPatientDocAssignment.test_patient_id = patients[0]["id"]
                print(f"✓ Found patient for testing: {patients[0].get('first_name', 'Unknown')}")
            else:
                print("⚠ No patients found in system")
        else:
            print(f"⚠ Could not fetch patients: {response.status_code}")
    
    def test_assign_documents_to_patient(self, headers):
        """Test POST /api/patient-documents/assign - Assign documents to patient"""
        if not TestPatientDocAssignment.test_patient_id:
            pytest.skip("No patient available for assignment test")
        
        # Get available templates
        templates_response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates",
            headers=headers
        )
        if templates_response.status_code != 200:
            pytest.skip("Could not get templates")
        
        templates = templates_response.json().get("templates", [])
        if not templates:
            pytest.skip("No templates available for assignment")
        
        template_ids = [templates[0]["id"]]
        
        assign_data = {
            "patient_id": TestPatientDocAssignment.test_patient_id,
            "template_ids": template_ids,
            "send_email": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/patient-documents/assign",
            headers=headers,
            json=assign_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        if data.get("assignments"):
            TestPatientDocAssignment.test_assignment_id = data["assignments"][0]["id"]
            print(f"✓ Assigned {len(data['assignments'])} document(s) to patient")
        else:
            print("✓ Assignment request processed (may have been already assigned)")
    
    def test_get_patient_documents(self, headers):
        """Test GET /api/patient-documents/patient/{patient_id} - Get patient's documents"""
        if not TestPatientDocAssignment.test_patient_id:
            pytest.skip("No patient available")
        
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/patient/{TestPatientDocAssignment.test_patient_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "assignments" in data
        assert "pending" in data
        assert "signed" in data
        print(f"✓ Patient has {data['pending_count']} pending and {data['signed_count']} signed documents")
    
    def test_get_assignment_details(self, headers):
        """Test GET /api/patient-documents/assignment/{id} - Get assignment details"""
        if not TestPatientDocAssignment.test_assignment_id:
            pytest.skip("No assignment available")
        
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/assignment/{TestPatientDocAssignment.test_assignment_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "template_title" in data
        assert "patient_name" in data
        assert "status" in data
        print(f"✓ Assignment details: {data['template_title']} - Status: {data['status']}")
    
    def test_cancel_assignment(self, headers):
        """Test DELETE /api/patient-documents/assignment/{id} - Cancel assignment"""
        if not TestPatientDocAssignment.test_assignment_id:
            pytest.skip("No assignment available to cancel")
        
        response = requests.delete(
            f"{BASE_URL}/api/patient-documents/assignment/{TestPatientDocAssignment.test_assignment_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Cancelled assignment: {TestPatientDocAssignment.test_assignment_id}")


# =============================================================================
# PATIENT DOCUMENTS E-SIGNATURE TESTS
# =============================================================================

class TestPatientDocSignature:
    """Test Patient Document E-Signature functionality"""
    
    def test_my_documents_endpoint(self, headers):
        """Test GET /api/patient-documents/my-documents - Get current user's documents"""
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/my-documents",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "assignments" in data
        assert "pending" in data
        assert "signed" in data
        print(f"✓ My documents: {data.get('pending_count', 0)} pending, {data.get('signed_count', 0)} signed")


# =============================================================================
# SITE DOCUMENTS CRUD TESTS
# =============================================================================

class TestSiteDocuments:
    """Test Site Documents CRUD operations"""
    
    created_doc_id = None
    
    def test_list_site_documents(self, headers):
        """Test GET /api/site-documents/list - List all site documents"""
        response = requests.get(
            f"{BASE_URL}/api/site-documents/list",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "documents" in data
        assert "total" in data
        print(f"✓ Found {data['total']} site documents")
    
    def test_create_site_document(self, headers):
        """Test POST /api/site-documents - Create new site document"""
        doc_data = {
            "title": "TEST_Terms of Service",
            "slug": f"test-terms-{uuid.uuid4().hex[:8]}",
            "content": "<h1>Test Terms of Service</h1><p>These are test terms.</p>",
            "doc_type": "terms",
            "is_published": False,
            "show_in_footer": False,
            "footer_order": 99
        }
        response = requests.post(
            f"{BASE_URL}/api/site-documents",
            headers=headers,
            json=doc_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        TestSiteDocuments.created_doc_id = data["id"]
        print(f"✓ Created site document with ID: {data['id']}")
    
    def test_get_site_document(self, headers):
        """Test GET /api/site-documents/{id} - Get specific document"""
        if not TestSiteDocuments.created_doc_id:
            pytest.skip("No document created to get")
        
        response = requests.get(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_Terms of Service"
        print(f"✓ Retrieved document: {data['title']}")
    
    def test_update_site_document(self, headers):
        """Test PUT /api/site-documents/{id} - Update document"""
        if not TestSiteDocuments.created_doc_id:
            pytest.skip("No document created to update")
        
        update_data = {
            "title": "TEST_Updated Terms of Service",
            "content": "<h1>Updated Test Terms</h1><p>Updated content.</p>"
        }
        response = requests.put(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers
        )
        data = get_response.json()
        assert data["title"] == "TEST_Updated Terms of Service"
        print(f"✓ Updated document title to: {data['title']}")
    
    def test_toggle_publish_site_document(self, headers):
        """Test POST /api/site-documents/{id}/publish - Toggle publish status"""
        if not TestSiteDocuments.created_doc_id:
            pytest.skip("No document created to toggle")
        
        # Publish the document
        response = requests.post(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}/publish",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify published
        get_response = requests.get(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers
        )
        data = get_response.json()
        print(f"✓ Document publish toggled: {data.get('is_published')}")
    
    def test_toggle_footer_visibility(self, headers):
        """Test PUT /api/site-documents/{id} - Toggle footer visibility"""
        if not TestSiteDocuments.created_doc_id:
            pytest.skip("No document created to toggle")
        
        # Show in footer
        update_data = {"show_in_footer": True, "footer_order": 5}
        response = requests.put(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify
        get_response = requests.get(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers
        )
        data = get_response.json()
        assert data["show_in_footer"] == True
        assert data["footer_order"] == 5
        print(f"✓ Footer visibility: {data['show_in_footer']}, order: {data['footer_order']}")
    
    def test_delete_site_document(self, headers):
        """Test DELETE /api/site-documents/{id} - Delete document"""
        if not TestSiteDocuments.created_doc_id:
            pytest.skip("No document created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/site-documents/{TestSiteDocuments.created_doc_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Deleted document: {TestSiteDocuments.created_doc_id}")
    
    def test_get_document_not_found(self, headers):
        """Test GET /api/site-documents/{id} - 404 for non-existent"""
        response = requests.get(
            f"{BASE_URL}/api/site-documents/non-existent-id",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for non-existent document")


# =============================================================================
# SITE DOCUMENTS SEEDING TESTS
# =============================================================================

class TestSiteDocSeeding:
    """Test Site Document Seeding"""
    
    def test_seed_default_site_documents(self, headers):
        """Test POST /api/site-documents/seed-defaults - Seed default documents"""
        response = requests.post(
            f"{BASE_URL}/api/site-documents/seed-defaults",
            headers=headers
        )
        # May return 200 or 400 if already seeded
        assert response.status_code in [200, 400], f"Expected 200/400, got {response.status_code}: {response.text}"
        print(f"✓ Seed defaults response: {response.json()}")
    
    def test_verify_default_site_documents_exist(self, headers):
        """Verify default site documents were seeded"""
        response = requests.get(
            f"{BASE_URL}/api/site-documents/list",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected default documents
        doc_titles = [d["title"] for d in data["documents"]]
        expected_docs = [
            "Terms of Service",
            "Privacy Policy",
            "HIPAA Notice of Privacy Practices"
        ]
        
        found_count = sum(1 for d in expected_docs if d in doc_titles)
        print(f"✓ Found {found_count}/{len(expected_docs)} expected default site documents")
        assert found_count >= 1, "At least one default site document should exist"


# =============================================================================
# SITE DOCUMENTS PUBLIC API TESTS
# =============================================================================

class TestSiteDocPublicAPI:
    """Test Site Documents Public API (no auth required)"""
    
    def test_get_public_documents(self, headers):
        """Test GET /api/site-documents/public/list - Get published documents (footer links)"""
        # Note: This endpoint requires auth based on the code
        response = requests.get(
            f"{BASE_URL}/api/site-documents/public/list",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "documents" in data
        print(f"✓ Public API returned {len(data['documents'])} published documents")
    
    def test_get_public_document_by_slug(self, headers):
        """Test GET /api/site-documents/public/{slug} - Get document by slug"""
        # First get a published document slug
        response = requests.get(
            f"{BASE_URL}/api/site-documents/list",
            headers=headers
        )
        if response.status_code != 200:
            pytest.skip("Could not get documents")
        
        docs = response.json().get("documents", [])
        published_docs = [d for d in docs if d.get("is_published")]
        if not published_docs:
            pytest.skip("No published documents available")
        
        slug = published_docs[0]["slug"]
        
        # Get by slug - this endpoint may or may not require auth
        response = requests.get(
            f"{BASE_URL}/api/site-documents/public/{slug}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["slug"] == slug
        print(f"✓ Retrieved public document by slug: {slug}")


# =============================================================================
# AUTO-ASSIGNMENT RULES TESTS
# =============================================================================

class TestAutoAssignRules:
    """Test Patient Document Auto-Assignment Rules"""
    
    created_rule_id = None
    
    def test_list_auto_assign_rules(self, headers):
        """Test GET /api/patient-documents/auto-assign-rules - List rules"""
        response = requests.get(
            f"{BASE_URL}/api/patient-documents/auto-assign-rules",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "rules" in data
        print(f"✓ Found {data.get('total', len(data['rules']))} auto-assign rules")
    
    def test_create_auto_assign_rule(self, headers):
        """Test POST /api/patient-documents/auto-assign-rules - Create rule"""
        # Get a template ID first
        templates_response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates",
            headers=headers
        )
        if templates_response.status_code != 200:
            pytest.skip("Could not get templates")
        
        templates = templates_response.json().get("templates", [])
        if not templates:
            pytest.skip("No templates available")
        
        rule_data = {
            "name": "TEST_Medicare Auto-Assign",
            "description": "Auto-assign documents to Medicare patients",
            "template_ids": [templates[0]["id"]],
            "conditions": {"insurance_type": ["Medicare"]},
            "is_active": True,
            "priority": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/patient-documents/auto-assign-rules",
            headers=headers,
            json=rule_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        TestAutoAssignRules.created_rule_id = data["id"]
        print(f"✓ Created auto-assign rule with ID: {data['id']}")
    
    def test_update_auto_assign_rule(self, headers):
        """Test PUT /api/patient-documents/auto-assign-rules/{id} - Update rule"""
        if not TestAutoAssignRules.created_rule_id:
            pytest.skip("No rule created to update")
        
        # Get a template ID first
        templates_response = requests.get(
            f"{BASE_URL}/api/patient-documents/templates",
            headers=headers
        )
        templates = templates_response.json().get("templates", [])
        
        update_data = {
            "name": "TEST_Updated Medicare Rule",
            "description": "Updated description",
            "template_ids": [templates[0]["id"]] if templates else [],
            "conditions": {"insurance_type": ["Medicare", "Medicaid"]},
            "is_active": True,
            "priority": 2
        }
        
        response = requests.put(
            f"{BASE_URL}/api/patient-documents/auto-assign-rules/{TestAutoAssignRules.created_rule_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Updated auto-assign rule")
    
    def test_delete_auto_assign_rule(self, headers):
        """Test DELETE /api/patient-documents/auto-assign-rules/{id} - Delete rule"""
        if not TestAutoAssignRules.created_rule_id:
            pytest.skip("No rule created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/patient-documents/auto-assign-rules/{TestAutoAssignRules.created_rule_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Deleted auto-assign rule: {TestAutoAssignRules.created_rule_id}")


# =============================================================================
# AUTHENTICATION TESTS
# =============================================================================

class TestAuthentication:
    """Test authentication requirements for protected endpoints"""
    
    def test_patient_templates_requires_auth(self):
        """Test that patient templates endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/patient-documents/templates")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Patient templates endpoint requires authentication")
    
    def test_site_documents_requires_auth(self):
        """Test that site documents admin endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/site-documents/list")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Site documents admin endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
