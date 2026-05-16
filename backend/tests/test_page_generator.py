"""
Test suite for Page Generator (Dev Settings) feature
Tests location management, page generation, and generated page operations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


class TestPageGeneratorAuth:
    """Test authentication for Page Generator endpoints"""
    
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
    
    def test_dev_stats_requires_auth(self):
        """Test that dev stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dev/stats")
        assert response.status_code == 403, "Should require authentication"
    
    def test_dev_locations_requires_auth(self):
        """Test that dev locations endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dev/locations")
        assert response.status_code == 403, "Should require authentication"
    
    def test_dev_stats_requires_admin_role(self, admin_token):
        """Test that dev stats endpoint requires admin role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dev/stats", headers=headers)
        assert response.status_code == 200, f"Admin should access dev stats: {response.text}"


class TestDevStats:
    """Test Dev Stats endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_dev_stats(self, admin_token):
        """Test getting dev stats returns correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dev/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields exist
        assert "total_locations" in data
        assert "states" in data
        assert "counties" in data
        assert "cities" in data
        assert "generated_pages" in data
        
        # Verify values are integers
        assert isinstance(data["total_locations"], int)
        assert isinstance(data["states"], int)
        assert isinstance(data["counties"], int)
        assert isinstance(data["cities"], int)
        assert isinstance(data["generated_pages"], int)
        
        # Verify total equals sum of types
        assert data["total_locations"] == data["states"] + data["counties"] + data["cities"]


class TestLocationCRUD:
    """Test Location CRUD operations"""
    
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
    
    def test_create_state_location(self, headers):
        """Test creating a state location"""
        unique_slug = f"test-state-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_Alaska",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-AK",
            "region_name": "Pacific Northwest",
            "stats": {"counties": 29, "cities": 150}
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert response.status_code == 200, f"Failed to create location: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Alaska"
        assert data["slug"] == unique_slug
        assert data["type"] == "state"
        assert data["geo_region_code"] == "US-AK"
        assert "id" in data
        assert "created_at" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/locations/{data['id']}", headers=headers)
    
    def test_create_county_location(self, headers):
        """Test creating a county location with parent"""
        # First create a state
        state_slug = f"test-state-{uuid.uuid4().hex[:8]}"
        state_data = {
            "name": "TEST_Maryland",
            "slug": state_slug,
            "type": "state",
            "geo_region_code": "US-MD",
            "stats": {"counties": 24, "cities": 100}
        }
        state_response = requests.post(f"{BASE_URL}/api/dev/locations", json=state_data, headers=headers)
        assert state_response.status_code == 200
        state_id = state_response.json()["id"]
        
        # Create county under state
        county_slug = f"test-county-{uuid.uuid4().hex[:8]}"
        county_data = {
            "name": "TEST_Montgomery County",
            "slug": county_slug,
            "type": "county",
            "geo_region_code": "US-MD-031",
            "parent_id": state_id,
            "region_name": "Central Maryland"
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/locations", json=county_data, headers=headers)
        assert response.status_code == 200, f"Failed to create county: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Montgomery County"
        assert data["type"] == "county"
        assert data["parent_id"] == state_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/locations/{data['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{state_id}", headers=headers)
    
    def test_create_city_location(self, headers):
        """Test creating a city location with parent county"""
        # Create state
        state_slug = f"test-state-{uuid.uuid4().hex[:8]}"
        state_data = {
            "name": "TEST_Texas",
            "slug": state_slug,
            "type": "state",
            "geo_region_code": "US-TX",
            "stats": {"counties": 254, "cities": 1200}
        }
        state_response = requests.post(f"{BASE_URL}/api/dev/locations", json=state_data, headers=headers)
        state_id = state_response.json()["id"]
        
        # Create county
        county_slug = f"test-county-{uuid.uuid4().hex[:8]}"
        county_data = {
            "name": "TEST_Harris County",
            "slug": county_slug,
            "type": "county",
            "geo_region_code": "US-TX-201",
            "parent_id": state_id
        }
        county_response = requests.post(f"{BASE_URL}/api/dev/locations", json=county_data, headers=headers)
        county_id = county_response.json()["id"]
        
        # Create city
        city_slug = f"test-city-{uuid.uuid4().hex[:8]}"
        city_data = {
            "name": "TEST_Houston",
            "slug": city_slug,
            "type": "city",
            "geo_region_code": "US-TX-201-HOU",
            "parent_id": county_id,
            "region_name": "Greater Houston"
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/locations", json=city_data, headers=headers)
        assert response.status_code == 200, f"Failed to create city: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Houston"
        assert data["type"] == "city"
        assert data["parent_id"] == county_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/locations/{data['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{county_id}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{state_id}", headers=headers)
    
    def test_get_all_locations(self, headers):
        """Test getting all locations"""
        response = requests.get(f"{BASE_URL}/api/dev/locations", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_locations_by_type(self, headers):
        """Test filtering locations by type"""
        response = requests.get(f"{BASE_URL}/api/dev/locations?type=state", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        for loc in data:
            assert loc["type"] == "state"
    
    def test_delete_location(self, headers):
        """Test deleting a location"""
        # Create a location to delete
        unique_slug = f"test-delete-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_DeleteMe",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-XX"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert create_response.status_code == 200
        location_id = create_response.json()["id"]
        
        # Delete the location
        delete_response = requests.delete(f"{BASE_URL}/api/dev/locations/{location_id}", headers=headers)
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Location deleted"
        
        # Verify it's deleted by trying to get locations and checking it's not there
        get_response = requests.get(f"{BASE_URL}/api/dev/locations", headers=headers)
        locations = get_response.json()
        location_ids = [loc["id"] for loc in locations]
        assert location_id not in location_ids
    
    def test_duplicate_slug_rejected(self, headers):
        """Test that duplicate slugs are rejected"""
        unique_slug = f"test-dup-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_First",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-YY"
        }
        
        # Create first location
        response1 = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert response1.status_code == 200
        location_id = response1.json()["id"]
        
        # Try to create duplicate
        location_data["name"] = "TEST_Second"
        response2 = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"].lower()
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/locations/{location_id}", headers=headers)


class TestPageGeneration:
    """Test page generation functionality"""
    
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
    
    @pytest.fixture(scope="class")
    def test_location(self, headers):
        """Create a test location for page generation"""
        unique_slug = f"test-gen-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_California",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-CA",
            "region_name": "West Coast",
            "stats": {"counties": 58, "cities": 482}
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert response.status_code == 200
        location = response.json()
        
        yield location
        
        # Cleanup - delete location and any generated pages
        requests.delete(f"{BASE_URL}/api/dev/locations/{location['id']}", headers=headers)
    
    def test_generate_page_for_location(self, headers, test_location):
        """Test generating a page for a location"""
        generate_data = {
            "location_ids": [test_location["id"]],
            "include_children": True
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/generate-pages", json=generate_data, headers=headers)
        assert response.status_code == 200, f"Failed to generate page: {response.text}"
        
        data = response.json()
        assert data["generated"] == 1
        assert len(data["errors"]) == 0
        assert len(data["pages"]) == 1
        
        page = data["pages"][0]
        assert page["location_id"] == test_location["id"]
        assert page["location_name"] == test_location["name"]
        assert f"durable-medical-equipment-in-{test_location['slug']}.html" == page["filename"]
    
    def test_generate_page_invalid_location(self, headers):
        """Test generating page for non-existent location"""
        generate_data = {
            "location_ids": ["non-existent-id"],
            "include_children": False
        }
        
        response = requests.post(f"{BASE_URL}/api/dev/generate-pages", json=generate_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["generated"] == 0
        assert len(data["errors"]) == 1
        assert data["errors"][0]["error"] == "Location not found"


class TestGeneratedPages:
    """Test generated pages management"""
    
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
    
    @pytest.fixture(scope="class")
    def generated_page(self, headers):
        """Create a location and generate a page for testing"""
        unique_slug = f"test-page-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_Oregon",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-OR",
            "region_name": "Pacific Northwest",
            "stats": {"counties": 36, "cities": 241}
        }
        
        # Create location
        loc_response = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert loc_response.status_code == 200
        location = loc_response.json()
        
        # Generate page
        gen_response = requests.post(f"{BASE_URL}/api/dev/generate-pages", json={
            "location_ids": [location["id"]],
            "include_children": False
        }, headers=headers)
        assert gen_response.status_code == 200
        
        # Get the generated page
        pages_response = requests.get(f"{BASE_URL}/api/dev/generated-pages", headers=headers)
        pages = pages_response.json()
        page = next((p for p in pages if p["location_id"] == location["id"]), None)
        
        yield {"location": location, "page": page}
        
        # Cleanup
        if page:
            requests.delete(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{location['id']}", headers=headers)
    
    def test_get_all_generated_pages(self, headers):
        """Test getting all generated pages"""
        response = requests.get(f"{BASE_URL}/api/dev/generated-pages", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure of each page (if any exist)
        for page in data:
            assert "id" in page
            assert "location_id" in page
            assert "location_name" in page
            assert "filename" in page
            assert "generated_at" in page
    
    def test_get_generated_page_by_id(self, headers, generated_page):
        """Test getting a specific generated page with HTML content"""
        page_id = generated_page["page"]["id"]
        
        response = requests.get(f"{BASE_URL}/api/dev/generated-pages/{page_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == page_id
        assert "html_content" in data
        assert len(data["html_content"]) > 0
        
        # Verify HTML contains expected elements
        html = data["html_content"]
        assert "<!DOCTYPE html>" in html
        assert generated_page["location"]["name"] in html
        assert generated_page["location"]["geo_region_code"] in html
        assert "Mastech Med" in html
        assert "meta name=\"description\"" in html
        assert "meta name=\"geo.region\"" in html
    
    def test_download_generated_page(self, headers, generated_page):
        """Test downloading a generated page as HTML file"""
        page_id = generated_page["page"]["id"]
        
        response = requests.get(f"{BASE_URL}/api/dev/generated-pages/{page_id}/download", headers=headers)
        assert response.status_code == 200
        
        # Check content type
        assert "text/html" in response.headers.get("content-type", "")
        
        # Check content disposition header
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition
        assert generated_page["page"]["filename"] in content_disposition
        
        # Verify content is valid HTML
        assert "<!DOCTYPE html>" in response.text
    
    def test_delete_generated_page(self, headers):
        """Test deleting a generated page"""
        # Create a location and page to delete
        unique_slug = f"test-del-page-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_DeletePage",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-ZZ"
        }
        
        loc_response = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        assert loc_response.status_code == 200, f"Failed to create location: {loc_response.text}"
        location = loc_response.json()
        
        # Generate page
        gen_response = requests.post(f"{BASE_URL}/api/dev/generate-pages", json={
            "location_ids": [location["id"]],
            "include_children": False
        }, headers=headers)
        assert gen_response.status_code == 200, f"Failed to generate page: {gen_response.text}"
        gen_data = gen_response.json()
        assert gen_data["generated"] == 1, f"Page not generated: {gen_data}"
        
        # Get the page ID from the generation response
        page_info = gen_data["pages"][0]
        
        # Get the page ID from the list
        pages_response = requests.get(f"{BASE_URL}/api/dev/generated-pages", headers=headers)
        pages = pages_response.json()
        page = next((p for p in pages if p["location_id"] == location["id"]), None)
        assert page is not None, f"Page not found in list. Location ID: {location['id']}, Pages: {[p['location_id'] for p in pages]}"
        
        # Delete the page
        delete_response = requests.delete(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Page deleted"
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)
        assert get_response.status_code == 404
        
        # Cleanup location
        requests.delete(f"{BASE_URL}/api/dev/locations/{location['id']}", headers=headers)
    
    def test_get_nonexistent_page(self, headers):
        """Test getting a non-existent page returns 404"""
        response = requests.get(f"{BASE_URL}/api/dev/generated-pages/nonexistent-id", headers=headers)
        assert response.status_code == 404


class TestLocationHierarchy:
    """Test location hierarchy (state -> county -> city)"""
    
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
    
    @pytest.fixture(scope="class")
    def location_hierarchy(self, headers):
        """Create a full location hierarchy for testing"""
        # Create state
        state_slug = f"test-hier-state-{uuid.uuid4().hex[:8]}"
        state_data = {
            "name": "TEST_Florida",
            "slug": state_slug,
            "type": "state",
            "geo_region_code": "US-FL",
            "stats": {"counties": 67, "cities": 411}
        }
        state_response = requests.post(f"{BASE_URL}/api/dev/locations", json=state_data, headers=headers)
        state = state_response.json()
        
        # Create county
        county_slug = f"test-hier-county-{uuid.uuid4().hex[:8]}"
        county_data = {
            "name": "TEST_Miami-Dade County",
            "slug": county_slug,
            "type": "county",
            "geo_region_code": "US-FL-086",
            "parent_id": state["id"],
            "region_name": "South Florida"
        }
        county_response = requests.post(f"{BASE_URL}/api/dev/locations", json=county_data, headers=headers)
        county = county_response.json()
        
        # Create city
        city_slug = f"test-hier-city-{uuid.uuid4().hex[:8]}"
        city_data = {
            "name": "TEST_Miami",
            "slug": city_slug,
            "type": "city",
            "geo_region_code": "US-FL-086-MIA",
            "parent_id": county["id"],
            "region_name": "Greater Miami"
        }
        city_response = requests.post(f"{BASE_URL}/api/dev/locations", json=city_data, headers=headers)
        city = city_response.json()
        
        yield {"state": state, "county": county, "city": city}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/locations/{city['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{county['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{state['id']}", headers=headers)
    
    def test_filter_locations_by_parent(self, headers, location_hierarchy):
        """Test filtering locations by parent_id"""
        state_id = location_hierarchy["state"]["id"]
        
        response = requests.get(f"{BASE_URL}/api/dev/locations?parent_id={state_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 1
        
        # All returned locations should have the state as parent
        for loc in data:
            assert loc["parent_id"] == state_id
    
    def test_generated_page_includes_children(self, headers, location_hierarchy):
        """Test that generated state page includes county children links"""
        state = location_hierarchy["state"]
        
        # Generate page for state with children
        gen_response = requests.post(f"{BASE_URL}/api/dev/generate-pages", json={
            "location_ids": [state["id"]],
            "include_children": True
        }, headers=headers)
        assert gen_response.status_code == 200
        
        # Get the generated page
        pages_response = requests.get(f"{BASE_URL}/api/dev/generated-pages", headers=headers)
        pages = pages_response.json()
        page = next((p for p in pages if p["location_id"] == state["id"]), None)
        assert page is not None
        
        # Get full page content
        page_response = requests.get(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)
        html = page_response.json()["html_content"]
        
        # Verify county is linked in the page
        county = location_hierarchy["county"]
        assert county["name"] in html or county["slug"] in html
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)


class TestHTMLContent:
    """Test generated HTML content quality"""
    
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
    
    @pytest.fixture(scope="class")
    def generated_html(self, headers):
        """Create a location and generate HTML for testing"""
        unique_slug = f"test-html-{uuid.uuid4().hex[:8]}"
        location_data = {
            "name": "TEST_Nevada",
            "slug": unique_slug,
            "type": "state",
            "geo_region_code": "US-NV",
            "region_name": "Southwest",
            "stats": {"counties": 17, "cities": 19}
        }
        
        loc_response = requests.post(f"{BASE_URL}/api/dev/locations", json=location_data, headers=headers)
        location = loc_response.json()
        
        # Generate page
        requests.post(f"{BASE_URL}/api/dev/generate-pages", json={
            "location_ids": [location["id"]],
            "include_children": False
        }, headers=headers)
        
        # Get the page
        pages_response = requests.get(f"{BASE_URL}/api/dev/generated-pages", headers=headers)
        pages = pages_response.json()
        page = next((p for p in pages if p["location_id"] == location["id"]), None)
        
        page_response = requests.get(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)
        html = page_response.json()["html_content"]
        
        yield {"location": location, "page": page, "html": html}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/dev/generated-pages/{page['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/dev/locations/{location['id']}", headers=headers)
    
    def test_html_has_proper_doctype(self, generated_html):
        """Test HTML has proper DOCTYPE"""
        assert "<!DOCTYPE html>" in generated_html["html"]
    
    def test_html_has_title_tag(self, generated_html):
        """Test HTML has proper title tag with location name"""
        html = generated_html["html"]
        location = generated_html["location"]
        
        assert "<title>" in html
        assert location["name"] in html
        assert "Mastech Med" in html
    
    def test_html_has_meta_description(self, generated_html):
        """Test HTML has meta description"""
        html = generated_html["html"]
        assert 'meta name="description"' in html
    
    def test_html_has_geo_region_meta(self, generated_html):
        """Test HTML has geo.region meta tag"""
        html = generated_html["html"]
        location = generated_html["location"]
        
        assert 'meta name="geo.region"' in html
        assert location["geo_region_code"] in html
    
    def test_html_has_canonical_url(self, generated_html):
        """Test HTML has canonical URL"""
        html = generated_html["html"]
        location = generated_html["location"]
        
        assert 'rel="canonical"' in html
        assert location["slug"] in html
    
    def test_html_has_contact_info(self, generated_html):
        """Test HTML has contact information"""
        html = generated_html["html"]
        
        assert "(727) 966-7767" in html
        assert "tel:" in html
    
    def test_html_has_eligibility_modal(self, generated_html):
        """Test HTML has eligibility check modal"""
        html = generated_html["html"]
        
        assert "eligibility-modal" in html
        assert "CHECK MY ELIGIBILITY" in html or "Check Eligibility" in html


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
