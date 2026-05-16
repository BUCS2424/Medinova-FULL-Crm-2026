"""
Test suite for public SEO, analytics, mobile menu, and security hardening features.
Tests: robots.txt, sitemap.xml, location pages, A2G analytics, mobile drawer, path traversal protection
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRobotsTxt:
    """Tests for robots.txt endpoint"""
    
    def test_root_robots_txt_returns_200(self):
        """Root /robots.txt should return 200"""
        response = requests.get(f"{BASE_URL}/robots.txt")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /robots.txt returns 200")
    
    def test_api_robots_txt_returns_200(self):
        """API /api/robots.txt should return 200"""
        response = requests.get(f"{BASE_URL}/api/robots.txt")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/robots.txt returns 200")
    
    def test_robots_txt_contains_sitemap_reference(self):
        """robots.txt should contain sitemap reference"""
        response = requests.get(f"{BASE_URL}/robots.txt")
        assert response.status_code == 200
        content = response.text
        assert "Sitemap:" in content, "robots.txt should contain Sitemap directive"
        assert "sitemap.xml" in content, "robots.txt should reference sitemap.xml"
        print(f"PASS: robots.txt contains sitemap reference")
    
    def test_robots_txt_content_type(self):
        """robots.txt should have text/plain content type"""
        response = requests.get(f"{BASE_URL}/robots.txt")
        assert "text/plain" in response.headers.get("Content-Type", ""), "Content-Type should be text/plain"
        print("PASS: robots.txt has correct content type")


class TestSitemapXml:
    """Tests for sitemap.xml endpoint"""
    
    def test_root_sitemap_returns_200(self):
        """Root /sitemap.xml should return 200"""
        response = requests.get(f"{BASE_URL}/sitemap.xml")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /sitemap.xml returns 200")
    
    def test_api_sitemap_returns_200(self):
        """API /api/sitemap.xml should return 200"""
        response = requests.get(f"{BASE_URL}/api/sitemap.xml")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/sitemap.xml returns 200")
    
    def test_sitemap_is_valid_xml(self):
        """sitemap.xml should be valid XML"""
        response = requests.get(f"{BASE_URL}/sitemap.xml")
        assert response.status_code == 200
        content = response.text
        assert '<?xml version="1.0"' in content, "Should have XML declaration"
        assert '<urlset' in content, "Should have urlset element"
        assert '</urlset>' in content, "Should have closing urlset element"
        print("PASS: sitemap.xml is valid XML structure")
    
    def test_sitemap_contains_medicare_resources(self):
        """sitemap.xml should include /medicare-resources"""
        response = requests.get(f"{BASE_URL}/sitemap.xml")
        assert response.status_code == 200
        content = response.text
        assert "/medicare-resources" in content, "sitemap should include /medicare-resources"
        print("PASS: sitemap.xml contains /medicare-resources")
    
    def test_sitemap_contains_products(self):
        """sitemap.xml should include /products"""
        response = requests.get(f"{BASE_URL}/sitemap.xml")
        assert response.status_code == 200
        content = response.text
        assert "/products" in content, "sitemap should include /products"
        print("PASS: sitemap.xml contains /products")
    
    def test_sitemap_contains_locations(self):
        """sitemap.xml should include /locations"""
        response = requests.get(f"{BASE_URL}/sitemap.xml")
        assert response.status_code == 200
        content = response.text
        assert "/locations" in content, "sitemap should include /locations"
        print("PASS: sitemap.xml contains /locations")
    
    def test_sitemap_content_type(self):
        """sitemap.xml should have application/xml content type"""
        response = requests.get(f"{BASE_URL}/sitemap.xml")
        assert "application/xml" in response.headers.get("Content-Type", ""), "Content-Type should be application/xml"
        print("PASS: sitemap.xml has correct content type")


class TestLocationPages:
    """Tests for location page endpoints"""
    
    def test_alaska_location_page_returns_200(self):
        """Alaska location page should return 200"""
        response = requests.get(f"{BASE_URL}/api/pages/location/durable-medical-equipment-in-alaska.html")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Alaska location page returns 200")
    
    def test_alaska_page_contains_analytics_script(self):
        """Alaska location page should contain A2G analytics script"""
        response = requests.get(f"{BASE_URL}/api/pages/location/durable-medical-equipment-in-alaska.html")
        assert response.status_code == 200
        content = response.text
        assert "a2ganalytics.com" in content, "Page should contain A2G analytics script"
        print("PASS: Alaska page contains A2G analytics script")
    
    def test_alaska_page_contains_seo_tags(self):
        """Alaska location page should contain SEO meta tags"""
        response = requests.get(f"{BASE_URL}/api/pages/location/durable-medical-equipment-in-alaska.html")
        assert response.status_code == 200
        content = response.text
        # Check for essential SEO tags
        assert '<title>' in content, "Page should have title tag"
        assert 'og:title' in content or 'property="og:title"' in content, "Page should have OG title"
        assert 'description' in content, "Page should have description meta tag"
        print("PASS: Alaska page contains SEO tags")
    
    def test_alaska_page_contains_mobile_drawer(self):
        """Alaska location page should contain mobile drawer markup"""
        response = requests.get(f"{BASE_URL}/api/pages/location/durable-medical-equipment-in-alaska.html")
        assert response.status_code == 200
        content = response.text
        assert "mobile-drawer" in content, "Page should contain mobile drawer markup"
        print("PASS: Alaska page contains mobile drawer markup")
    
    def test_locations_index_returns_200(self):
        """Locations index page should return 200"""
        response = requests.get(f"{BASE_URL}/api/pages/locations-index")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Locations index returns 200")


class TestSecurityHardening:
    """Tests for security hardening - path traversal protection"""
    
    def test_path_traversal_blocked_etc_passwd(self):
        """Path traversal attempt with ../../etc/passwd should return 404"""
        response = requests.get(f"{BASE_URL}/api/pages/location/../../etc/passwd")
        assert response.status_code == 404, f"Expected 404 for path traversal, got {response.status_code}"
        print("PASS: Path traversal ../../etc/passwd blocked (404)")
    
    def test_path_traversal_blocked_double_encoded(self):
        """Path traversal with double encoding should return 404"""
        response = requests.get(f"{BASE_URL}/api/pages/location/..%2F..%2Fetc%2Fpasswd")
        assert response.status_code == 404, f"Expected 404 for encoded path traversal, got {response.status_code}"
        print("PASS: Encoded path traversal blocked (404)")
    
    def test_invalid_page_name_blocked(self):
        """Invalid page name format should return 404"""
        response = requests.get(f"{BASE_URL}/api/pages/location/invalid-page-name.html")
        assert response.status_code == 404, f"Expected 404 for invalid page name, got {response.status_code}"
        print("PASS: Invalid page name blocked (404)")
    
    def test_valid_page_name_pattern_only(self):
        """Only valid durable-medical-equipment-in-*.html pattern should work"""
        # Valid pattern
        response = requests.get(f"{BASE_URL}/api/pages/location/durable-medical-equipment-in-alaska.html")
        assert response.status_code == 200, "Valid pattern should return 200"
        
        # Invalid patterns
        invalid_patterns = [
            "test.html",
            "durable-medical-equipment.html",
            "durable-medical-equipment-in-.html",
            "../durable-medical-equipment-in-alaska.html",
        ]
        for pattern in invalid_patterns:
            resp = requests.get(f"{BASE_URL}/api/pages/location/{pattern}")
            assert resp.status_code == 404, f"Pattern '{pattern}' should return 404, got {resp.status_code}"
        print("PASS: Only valid page name patterns accepted")


class TestHomepageAndLanding:
    """Tests for homepage and landing page"""
    
    def test_homepage_returns_200(self):
        """Homepage / should return 200"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Homepage returns 200")
    
    def test_homepage_not_blank(self):
        """Homepage should not be blank"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        content = response.text
        assert len(content) > 500, "Homepage content should not be blank"
        assert "<html" in content.lower(), "Homepage should contain HTML"
        print("PASS: Homepage is not blank")
    
    def test_homepage_contains_analytics(self):
        """Homepage should contain A2G analytics script"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        content = response.text
        assert "a2ganalytics.com" in content, "Homepage should contain A2G analytics script"
        print("PASS: Homepage contains A2G analytics")
    
    def test_landing_api_returns_200(self):
        """Landing page API should return 200"""
        response = requests.get(f"{BASE_URL}/api/pages/landing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Landing API returns 200")


class TestPublicPages:
    """Tests for public pages loading"""
    
    def test_products_page_api(self):
        """Products API should return 200"""
        response = requests.get(f"{BASE_URL}/api/public/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Products API returns 200")
    
    def test_locations_api(self):
        """Locations API should return 200"""
        response = requests.get(f"{BASE_URL}/api/public/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Locations API returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
