"""
Test suite for Site Rules API endpoints
Tests CRUD operations for site rules management feature
Categories: doctor, patient, supplier, orders, billing, compliance, leads, shipping
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"

# Valid categories
VALID_CATEGORIES = ['doctor', 'patient', 'supplier', 'orders', 'billing', 'compliance', 'leads', 'shipping']


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def test_rule_id(auth_headers):
    """Create a test rule and return its ID, cleanup after test"""
    # Create test rule
    rule_data = {
        "category": "doctor",
        "title": f"TEST_Rule_{uuid.uuid4().hex[:8]}",
        "content": "Test rule content for automated testing",
        "priority": "medium",
        "enabled": True,
        "order": 999
    }
    response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create test rule: {response.text}"
    rule_id = response.json()["id"]
    
    yield rule_id
    
    # Cleanup - delete the test rule
    requests.delete(f"{BASE_URL}/api/dev/site-rules/{rule_id}", headers=auth_headers)


class TestSiteRulesAuth:
    """Test authentication requirements for site rules endpoints"""
    
    def test_get_rules_requires_auth(self):
        """GET /api/dev/site-rules requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dev/site-rules")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_create_rule_requires_auth(self):
        """POST /api/dev/site-rules requires authentication"""
        response = requests.post(f"{BASE_URL}/api/dev/site-rules", json={
            "category": "doctor",
            "title": "Test Rule"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_update_rule_requires_auth(self):
        """PUT /api/dev/site-rules/{id} requires authentication"""
        response = requests.put(f"{BASE_URL}/api/dev/site-rules/fake-id", json={
            "title": "Updated Title"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_delete_rule_requires_auth(self):
        """DELETE /api/dev/site-rules/{id} requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/dev/site-rules/fake-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestGetSiteRules:
    """Test GET /api/dev/site-rules endpoint"""
    
    def test_get_all_rules_success(self, auth_headers):
        """GET /api/dev/site-rules returns list of rules"""
        response = requests.get(f"{BASE_URL}/api/dev/site-rules", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_get_rules_by_category(self, auth_headers):
        """GET /api/dev/site-rules?category=doctor filters by category"""
        response = requests.get(f"{BASE_URL}/api/dev/site-rules?category=doctor", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned rules should be in doctor category
        for rule in data:
            assert rule.get("category") == "doctor", f"Expected category 'doctor', got '{rule.get('category')}'"
    
    def test_get_rules_invalid_category_returns_empty(self, auth_headers):
        """GET /api/dev/site-rules?category=invalid returns empty list"""
        response = requests.get(f"{BASE_URL}/api/dev/site-rules?category=invalid_category", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data == [], "Invalid category should return empty list"


class TestCreateSiteRule:
    """Test POST /api/dev/site-rules endpoint"""
    
    def test_create_rule_success(self, auth_headers):
        """POST /api/dev/site-rules creates a new rule"""
        rule_data = {
            "category": "patient",
            "title": f"TEST_Patient_Rule_{uuid.uuid4().hex[:8]}",
            "content": "Patient eligibility verification required",
            "priority": "high",
            "enabled": True,
            "order": 1
        }
        response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create rule: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain rule ID"
        assert data["category"] == "patient"
        assert data["title"] == rule_data["title"]
        assert data["content"] == rule_data["content"]
        assert data["priority"] == "high"
        assert data["enabled"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/site-rules/{data['id']}", headers=auth_headers)
    
    def test_create_rule_all_categories(self, auth_headers):
        """POST /api/dev/site-rules works for all valid categories"""
        created_ids = []
        
        for category in VALID_CATEGORIES:
            rule_data = {
                "category": category,
                "title": f"TEST_{category}_Rule_{uuid.uuid4().hex[:8]}",
                "content": f"Test rule for {category} category",
                "priority": "medium",
                "enabled": True
            }
            response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
            assert response.status_code == 200, f"Failed to create rule for category '{category}': {response.text}"
            created_ids.append(response.json()["id"])
        
        # Cleanup
        for rule_id in created_ids:
            requests.delete(f"{BASE_URL}/api/dev/site-rules/{rule_id}", headers=auth_headers)
    
    def test_create_rule_invalid_category(self, auth_headers):
        """POST /api/dev/site-rules rejects invalid category"""
        rule_data = {
            "category": "invalid_category",
            "title": "Test Rule",
            "priority": "medium"
        }
        response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for invalid category, got {response.status_code}"
    
    def test_create_rule_priority_levels(self, auth_headers):
        """POST /api/dev/site-rules accepts all priority levels"""
        created_ids = []
        
        for priority in ['high', 'medium', 'low']:
            rule_data = {
                "category": "orders",
                "title": f"TEST_Priority_{priority}_{uuid.uuid4().hex[:8]}",
                "priority": priority
            }
            response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
            assert response.status_code == 200, f"Failed to create rule with priority '{priority}'"
            data = response.json()
            assert data["priority"] == priority
            created_ids.append(data["id"])
        
        # Cleanup
        for rule_id in created_ids:
            requests.delete(f"{BASE_URL}/api/dev/site-rules/{rule_id}", headers=auth_headers)
    
    def test_create_rule_default_values(self, auth_headers):
        """POST /api/dev/site-rules uses default values for optional fields"""
        rule_data = {
            "category": "billing",
            "title": f"TEST_Defaults_{uuid.uuid4().hex[:8]}"
        }
        response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["priority"] == "medium", "Default priority should be 'medium'"
        assert data["enabled"] == True, "Default enabled should be True"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/site-rules/{data['id']}", headers=auth_headers)


class TestUpdateSiteRule:
    """Test PUT /api/dev/site-rules/{rule_id} endpoint"""
    
    def test_update_rule_title(self, auth_headers, test_rule_id):
        """PUT /api/dev/site-rules/{id} updates rule title"""
        new_title = f"Updated_Title_{uuid.uuid4().hex[:8]}"
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={"title": new_title},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/dev/site-rules", headers=auth_headers)
        rules = get_response.json()
        updated_rule = next((r for r in rules if r["id"] == test_rule_id), None)
        assert updated_rule is not None, "Rule should exist"
        assert updated_rule["title"] == new_title, "Title should be updated"
    
    def test_update_rule_content(self, auth_headers, test_rule_id):
        """PUT /api/dev/site-rules/{id} updates rule content"""
        new_content = "Updated content for testing purposes"
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={"content": new_content},
            headers=auth_headers
        )
        assert response.status_code == 200
    
    def test_update_rule_priority(self, auth_headers, test_rule_id):
        """PUT /api/dev/site-rules/{id} updates rule priority"""
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={"priority": "high"},
            headers=auth_headers
        )
        assert response.status_code == 200
    
    def test_update_rule_enabled_toggle(self, auth_headers, test_rule_id):
        """PUT /api/dev/site-rules/{id} toggles enabled status"""
        # Disable
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={"enabled": False},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Enable
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={"enabled": True},
            headers=auth_headers
        )
        assert response.status_code == 200
    
    def test_update_nonexistent_rule(self, auth_headers):
        """PUT /api/dev/site-rules/{id} returns 404 for nonexistent rule"""
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/nonexistent-rule-id",
            json={"title": "New Title"},
            headers=auth_headers
        )
        assert response.status_code == 404
    
    def test_update_rule_empty_body(self, auth_headers, test_rule_id):
        """PUT /api/dev/site-rules/{id} with empty body returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={},
            headers=auth_headers
        )
        assert response.status_code == 400, "Empty update should return 400"


class TestDeleteSiteRule:
    """Test DELETE /api/dev/site-rules/{rule_id} endpoint"""
    
    def test_delete_rule_success(self, auth_headers):
        """DELETE /api/dev/site-rules/{id} deletes a rule"""
        # Create a rule to delete
        rule_data = {
            "category": "compliance",
            "title": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}",
            "priority": "low"
        }
        create_response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
        assert create_response.status_code == 200
        rule_id = create_response.json()["id"]
        
        # Delete the rule
        delete_response = requests.delete(f"{BASE_URL}/api/dev/site-rules/{rule_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify deletion - rule should not exist
        get_response = requests.get(f"{BASE_URL}/api/dev/site-rules", headers=auth_headers)
        rules = get_response.json()
        deleted_rule = next((r for r in rules if r["id"] == rule_id), None)
        assert deleted_rule is None, "Rule should be deleted"
    
    def test_delete_nonexistent_rule(self, auth_headers):
        """DELETE /api/dev/site-rules/{id} returns 404 for nonexistent rule"""
        response = requests.delete(
            f"{BASE_URL}/api/dev/site-rules/nonexistent-rule-id",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestSiteRulesDataIntegrity:
    """Test data integrity and persistence"""
    
    def test_create_and_verify_persistence(self, auth_headers):
        """Create rule and verify it persists in GET response"""
        unique_title = f"TEST_Persistence_{uuid.uuid4().hex[:8]}"
        rule_data = {
            "category": "shipping",
            "title": unique_title,
            "content": "Shipping rule content",
            "priority": "high",
            "enabled": True
        }
        
        # Create
        create_response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
        assert create_response.status_code == 200
        created_rule = create_response.json()
        rule_id = created_rule["id"]
        
        # Verify in GET all
        get_response = requests.get(f"{BASE_URL}/api/dev/site-rules", headers=auth_headers)
        assert get_response.status_code == 200
        rules = get_response.json()
        
        found_rule = next((r for r in rules if r["id"] == rule_id), None)
        assert found_rule is not None, "Created rule should appear in GET response"
        assert found_rule["title"] == unique_title
        assert found_rule["category"] == "shipping"
        assert found_rule["priority"] == "high"
        assert found_rule["enabled"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/site-rules/{rule_id}", headers=auth_headers)
    
    def test_update_and_verify_persistence(self, auth_headers, test_rule_id):
        """Update rule and verify changes persist"""
        new_title = f"Updated_Persistence_{uuid.uuid4().hex[:8]}"
        new_content = "Updated content for persistence test"
        
        # Update
        update_response = requests.put(
            f"{BASE_URL}/api/dev/site-rules/{test_rule_id}",
            json={"title": new_title, "content": new_content, "priority": "low"},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Verify in GET
        get_response = requests.get(f"{BASE_URL}/api/dev/site-rules", headers=auth_headers)
        rules = get_response.json()
        
        updated_rule = next((r for r in rules if r["id"] == test_rule_id), None)
        assert updated_rule is not None
        assert updated_rule["title"] == new_title
        assert updated_rule["content"] == new_content
        assert updated_rule["priority"] == "low"


class TestSiteRulesResponseFormat:
    """Test response format and structure"""
    
    def test_rule_response_structure(self, auth_headers):
        """Verify rule response contains all expected fields"""
        rule_data = {
            "category": "leads",
            "title": f"TEST_Structure_{uuid.uuid4().hex[:8]}",
            "content": "Test content",
            "priority": "medium",
            "enabled": True,
            "order": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/site-rules", json=rule_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "id" in data, "Response should contain 'id'"
        assert "category" in data, "Response should contain 'category'"
        assert "title" in data, "Response should contain 'title'"
        assert "content" in data, "Response should contain 'content'"
        assert "priority" in data, "Response should contain 'priority'"
        assert "enabled" in data, "Response should contain 'enabled'"
        assert "order" in data, "Response should contain 'order'"
        assert "created_at" in data, "Response should contain 'created_at'"
        assert "updated_at" in data, "Response should contain 'updated_at'"
        assert "created_by" in data, "Response should contain 'created_by'"
        
        # Verify no MongoDB _id
        assert "_id" not in data, "Response should not contain MongoDB '_id'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/site-rules/{data['id']}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
