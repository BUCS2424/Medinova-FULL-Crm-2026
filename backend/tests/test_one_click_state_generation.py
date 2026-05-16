"""
Test suite for One-Click State Page Generation feature
Tests the GET /api/dev/us-states and POST /api/dev/generate-state/{state_slug} endpoints
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


class TestUSStatesEndpoint:
    """Test GET /api/dev/us-states endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_us_states_requires_auth(self):
        """Test that us-states endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dev/us-states")
        assert response.status_code == 403, "Should require authentication"
    
    def test_get_us_states_returns_list(self, headers):
        """Test that us-states endpoint returns a list of states"""
        response = requests.get(f"{BASE_URL}/api/dev/us-states", headers=headers)
        assert response.status_code == 200, f"Failed to get US states: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should return at least one state"
    
    def test_us_states_structure(self, headers):
        """Test that each state has required fields"""
        response = requests.get(f"{BASE_URL}/api/dev/us-states", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        for state in data:
            assert "slug" in state, "State should have slug"
            assert "name" in state, "State should have name"
            assert "abbr" in state, "State should have abbreviation"
            assert "county_count" in state, "State should have county_count"
            assert "city_count" in state, "State should have city_count"
            assert "total_pages" in state, "State should have total_pages"
            
            # Verify total_pages calculation
            expected_total = 1 + state["county_count"] + state["city_count"]
            assert state["total_pages"] == expected_total, f"total_pages should be 1 + counties + cities for {state['name']}"
    
    def test_us_states_sorted_alphabetically(self, headers):
        """Test that states are sorted alphabetically by name"""
        response = requests.get(f"{BASE_URL}/api/dev/us-states", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        names = [state["name"] for state in data]
        assert names == sorted(names), "States should be sorted alphabetically"
    
    def test_us_states_contains_expected_states(self, headers):
        """Test that response contains expected US states"""
        response = requests.get(f"{BASE_URL}/api/dev/us-states", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        slugs = [state["slug"] for state in data]
        
        # Check for some expected states
        expected_states = ["alabama", "alaska", "arizona", "california", "texas", "new-york"]
        for expected in expected_states:
            assert expected in slugs, f"Expected state '{expected}' not found in response"
    
    def test_us_states_count(self, headers):
        """Test that we have the expected number of states (19 as per requirements)"""
        response = requests.get(f"{BASE_URL}/api/dev/us-states", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # According to requirements, there should be 19 US states
        assert len(data) >= 19, f"Expected at least 19 states, got {len(data)}"


class TestGenerateStateEndpoint:
    """Test POST /api/dev/generate-state/{state_slug} endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_generate_state_requires_auth(self):
        """Test that generate-state endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/arizona")
        assert response.status_code == 403, "Should require authentication"
    
    def test_generate_state_invalid_slug(self, headers):
        """Test that invalid state slug returns 404"""
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/invalid-state-slug", headers=headers)
        assert response.status_code == 404, f"Should return 404 for invalid state: {response.text}"
        assert "not found" in response.json()["detail"].lower()
    
    def test_generate_state_arizona(self, headers):
        """Test generating pages for Arizona (a state without pages yet)"""
        # First get Arizona info
        states_response = requests.get(f"{BASE_URL}/api/dev/us-states", headers=headers)
        states = states_response.json()
        arizona = next((s for s in states if s["slug"] == "arizona"), None)
        
        if not arizona:
            pytest.skip("Arizona not found in states list")
        
        # Generate pages for Arizona
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/arizona", headers=headers)
        assert response.status_code == 200, f"Failed to generate Arizona pages: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "state" in data, "Response should have state name"
        assert "generated" in data, "Response should have generated count"
        assert "errors" in data, "Response should have errors count"
        assert "details" in data, "Response should have details"
        
        # Verify state name
        assert data["state"] == "Arizona", f"State name should be Arizona, got {data['state']}"
        
        # Verify generated count matches expected
        expected_total = arizona["total_pages"]
        assert data["generated"] == expected_total, f"Expected {expected_total} pages, got {data['generated']}"
        
        # Verify details breakdown
        assert data["details"]["state_page"] == 1, "Should have 1 state page"
        assert data["details"]["county_pages"] == arizona["county_count"], f"Should have {arizona['county_count']} county pages"
        assert data["details"]["city_pages"] == arizona["city_count"], f"Should have {arizona['city_count']} city pages"
        
        # Verify no errors
        assert data["errors"] == 0, f"Should have no errors, got {data['errors']}"
    
    def test_generate_state_creates_files(self, headers):
        """Test that generate-state creates actual HTML files"""
        # Generate pages for California (if not already generated)
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/california", headers=headers)
        assert response.status_code == 200, f"Failed to generate California pages: {response.text}"
        
        # Check that state file exists
        state_file = "/app/frontend/public/locations/durable-medical-equipment-in-california.html"
        assert os.path.exists(state_file), f"State file should exist: {state_file}"
        
        # Verify file content
        with open(state_file, 'r') as f:
            content = f.read()
            assert "<!DOCTYPE html>" in content, "File should be valid HTML"
            assert "California" in content, "File should contain state name"
            assert "Mastech Med" in content, "File should contain company name"
    
    def test_generate_state_updates_locations_json(self, headers):
        """Test that generate-state updates locations-data.json"""
        # Generate pages for Colorado
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/colorado", headers=headers)
        assert response.status_code == 200, f"Failed to generate Colorado pages: {response.text}"
        
        # Check locations-data.json
        json_path = "/app/frontend/public/locations-data.json"
        assert os.path.exists(json_path), "locations-data.json should exist"
        
        with open(json_path, 'r') as f:
            locations_data = json.load(f)
        
        # Find Colorado in the data
        colorado = next((s for s in locations_data if s["slug"] == "colorado"), None)
        assert colorado is not None, "Colorado should be in locations-data.json"
        
        # Verify structure
        assert "name" in colorado, "Should have name"
        assert "file" in colorado, "Should have file"
        assert "counties" in colorado, "Should have counties"
        assert "cities" in colorado, "Should have cities"
        assert "total_pages" in colorado, "Should have total_pages"


class TestGeneratedFilesContent:
    """Test the content of generated HTML files"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_state_page_html_structure(self, headers):
        """Test that state page HTML has proper structure"""
        # Generate Florida pages
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/florida", headers=headers)
        assert response.status_code == 200
        
        state_file = "/app/frontend/public/locations/durable-medical-equipment-in-florida.html"
        assert os.path.exists(state_file), "Florida state file should exist"
        
        with open(state_file, 'r') as f:
            html = f.read()
        
        # Check HTML structure
        assert "<!DOCTYPE html>" in html, "Should have DOCTYPE"
        assert "<html" in html, "Should have html tag"
        assert "<head>" in html, "Should have head tag"
        assert "<body" in html, "Should have body tag"
        assert "</html>" in html, "Should have closing html tag"
        
        # Check meta tags
        assert '<meta charset="UTF-8">' in html, "Should have charset meta"
        assert '<meta name="viewport"' in html, "Should have viewport meta"
        assert '<meta name="description"' in html, "Should have description meta"
        
        # Check title
        assert "<title>" in html, "Should have title tag"
        assert "Florida" in html, "Title should contain state name"
        assert "DME" in html or "Durable Medical Equipment" in html, "Title should mention DME"
    
    def test_state_page_has_contact_info(self, headers):
        """Test that state page has contact information"""
        state_file = "/app/frontend/public/locations/durable-medical-equipment-in-florida.html"
        
        if not os.path.exists(state_file):
            # Generate if not exists
            requests.post(f"{BASE_URL}/api/dev/generate-state/florida", headers=headers)
        
        with open(state_file, 'r') as f:
            html = f.read()
        
        # Check contact info
        assert "(727) 966-7767" in html, "Should have phone number"
        assert "tel:" in html, "Should have tel: link"
    
    def test_county_page_has_breadcrumb(self, headers):
        """Test that county page has breadcrumb navigation"""
        # Generate Georgia pages
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/georgia", headers=headers)
        assert response.status_code == 200
        
        # Check a county file
        county_files = [f for f in os.listdir("/app/frontend/public/locations/") 
                       if "georgia" in f and "county" in f.lower()]
        
        if county_files:
            county_file = f"/app/frontend/public/locations/{county_files[0]}"
            with open(county_file, 'r') as f:
                html = f.read()
            
            # Should have link back to state
            assert "durable-medical-equipment-in-georgia.html" in html, "County page should link to state page"


class TestStateGenerationIdempotency:
    """Test that state generation is idempotent (can be run multiple times)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_regenerate_existing_state(self, headers):
        """Test that regenerating an existing state works without errors"""
        # Generate Alabama (which was already generated according to context)
        response = requests.post(f"{BASE_URL}/api/dev/generate-state/alabama", headers=headers)
        assert response.status_code == 200, f"Should be able to regenerate: {response.text}"
        
        data = response.json()
        assert data["errors"] == 0, "Should have no errors on regeneration"
        assert data["generated"] > 0, "Should still report generated pages"
    
    def test_locations_json_no_duplicates(self, headers):
        """Test that locations-data.json doesn't have duplicate entries"""
        # Generate Alabama twice
        requests.post(f"{BASE_URL}/api/dev/generate-state/alabama", headers=headers)
        requests.post(f"{BASE_URL}/api/dev/generate-state/alabama", headers=headers)
        
        json_path = "/app/frontend/public/locations-data.json"
        with open(json_path, 'r') as f:
            locations_data = json.load(f)
        
        # Check for duplicates
        slugs = [s["slug"] for s in locations_data]
        assert len(slugs) == len(set(slugs)), "Should not have duplicate state entries"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
