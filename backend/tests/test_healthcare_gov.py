"""
Test suite for HealthCare.gov Content API proxy endpoints.
Tests the Stay Up To Date feature that pulls healthcare articles and glossary terms.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medinova-preview.preview.emergentagent.com')


class TestHealthCareGovAPI:
    """Tests for HealthCare.gov proxy endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - authenticate and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "mel@a2gdesigns.com", "password": "BigDaddy2016!!"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No access_token in login response"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ==================== ARTICLES ENDPOINT ====================
    
    def test_articles_endpoint_returns_200(self):
        """Test that articles endpoint returns 200 with valid auth"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        assert "total" in data
    
    def test_articles_returns_expected_count(self):
        """Test that articles endpoint returns approximately 436 items"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=1")
        assert response.status_code == 200
        data = response.json()
        # Allow some variance as content may change
        assert data["total"] >= 400, f"Expected ~436 articles, got {data['total']}"
    
    def test_articles_pagination_works(self):
        """Test that articles pagination (skip/limit) works correctly"""
        # Get first page
        response1 = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=5&skip=0")
        assert response1.status_code == 200
        page1 = response1.json()["articles"]
        
        # Get second page
        response2 = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=5&skip=5")
        assert response2.status_code == 200
        page2 = response2.json()["articles"]
        
        # Verify different items
        page1_titles = [a["title"] for a in page1]
        page2_titles = [a["title"] for a in page2]
        assert page1_titles != page2_titles, "Pagination not working - same items returned"
    
    def test_articles_search_filters_results(self):
        """Test that search parameter filters articles"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?search=medicare&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Search should return fewer results than total
        total_response = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=1")
        total = total_response.json()["total"]
        assert data["total"] < total, "Search did not filter results"
    
    def test_articles_structure_has_required_fields(self):
        """Test that article items have required fields"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=1")
        assert response.status_code == 200
        articles = response.json()["articles"]
        assert len(articles) > 0
        
        article = articles[0]
        assert "title" in article
        assert "url" in article
    
    # ==================== GLOSSARY ENDPOINT ====================
    
    def test_glossary_endpoint_returns_200(self):
        """Test that glossary endpoint returns 200 with valid auth"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "glossary" in data
        assert "total" in data
    
    def test_glossary_returns_expected_count(self):
        """Test that glossary endpoint returns approximately 256 items"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?limit=1")
        assert response.status_code == 200
        data = response.json()
        # Allow some variance as content may change
        assert data["total"] >= 200, f"Expected ~256 glossary terms, got {data['total']}"
    
    def test_glossary_letter_filter_works(self):
        """Test that letter filter returns only terms starting with that letter"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?letter=A&limit=20")
        assert response.status_code == 200
        data = response.json()
        
        # All terms should start with A
        for term in data["glossary"]:
            assert term["title"].upper().startswith("A"), f"Term '{term['title']}' doesn't start with A"
    
    def test_glossary_search_filters_results(self):
        """Test that search parameter filters glossary terms"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?search=insurance&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Search should return fewer results than total
        total_response = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?limit=1")
        total = total_response.json()["total"]
        assert data["total"] < total, "Search did not filter results"
    
    def test_glossary_pagination_works(self):
        """Test that glossary pagination (skip/limit) works correctly"""
        response1 = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?limit=5&skip=0")
        assert response1.status_code == 200
        page1 = response1.json()["glossary"]
        
        response2 = self.session.get(f"{BASE_URL}/api/healthcare-gov/glossary?limit=5&skip=5")
        assert response2.status_code == 200
        page2 = response2.json()["glossary"]
        
        page1_titles = [t["title"] for t in page1]
        page2_titles = [t["title"] for t in page2]
        assert page1_titles != page2_titles, "Pagination not working - same items returned"
    
    # ==================== CONTENT ENDPOINT ====================
    
    def test_content_endpoint_returns_200(self):
        """Test that content endpoint returns 200 for valid URL"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/content?url=/quality-ratings")
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "content" in data
    
    def test_content_returns_html_content(self):
        """Test that content endpoint returns actual HTML content"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/content?url=/quality-ratings")
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"], "Title should not be empty"
        assert len(data["content"]) > 100, "Content should have substantial HTML"
    
    def test_content_handles_url_with_leading_slash(self):
        """Test that content endpoint handles URLs with leading slash"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/content?url=/glossary/deductible")
        assert response.status_code == 200
    
    def test_content_handles_url_without_leading_slash(self):
        """Test that content endpoint handles URLs without leading slash"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/content?url=glossary/deductible")
        assert response.status_code == 200
    
    # ==================== INDEX ENDPOINT ====================
    
    def test_index_endpoint_returns_200(self):
        """Test that index endpoint returns 200 with valid auth"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/index?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_index_search_filters_results(self):
        """Test that search parameter filters index items"""
        response = self.session.get(f"{BASE_URL}/api/healthcare-gov/index?search=coverage&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        total_response = self.session.get(f"{BASE_URL}/api/healthcare-gov/index?limit=1")
        total = total_response.json()["total"]
        assert data["total"] < total, "Search did not filter results"
    
    # ==================== AUTH TESTS ====================
    
    def test_articles_requires_auth(self):
        """Test that articles endpoint requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/healthcare-gov/articles?limit=1")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_glossary_requires_auth(self):
        """Test that glossary endpoint requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/healthcare-gov/glossary?limit=1")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_content_requires_auth(self):
        """Test that content endpoint requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/healthcare-gov/content?url=/quality-ratings")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_index_requires_auth(self):
        """Test that index endpoint requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/healthcare-gov/index?limit=1")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
