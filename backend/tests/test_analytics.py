"""
Test Suite for Site Traffic Analytics Feature
Tests all analytics endpoints including:
- POST /api/analytics/collect - Public endpoint to collect pageview events
- GET /api/analytics/tracker.js - Returns JavaScript tracking script
- GET /api/analytics/overview - Returns visitor, pageview counts with chart data
- GET /api/analytics/realtime - Returns active visitors in last 30 minutes
- GET /api/analytics/pages - Returns top pages by pageviews
- GET /api/analytics/referrers - Returns top referrers
- GET /api/analytics/countries - Returns visitors by country
- GET /api/analytics/browsers - Returns visitors by browser
- GET /api/analytics/operating-systems - Returns visitors by OS
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestAnalyticsCollectEndpoint:
    """Tests for POST /api/analytics/collect - Public endpoint (no auth required)"""
    
    def test_collect_pageview_event(self):
        """Test collecting a pageview event"""
        event_data = {
            "event_type": "pageview",
            "page_url": "https://example.com/test-page",
            "page_title": "Test Page",
            "referrer": "https://google.com",
            "session_id": str(uuid.uuid4()),
            "visitor_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/analytics/collect", json=event_data)
        assert response.status_code == 200, f"Failed to collect event: {response.text}"
        data = response.json()
        assert data["status"] == "ok"
    
    def test_collect_event_with_utm_params(self):
        """Test collecting event with UTM parameters"""
        event_data = {
            "event_type": "pageview",
            "page_url": "https://example.com/landing",
            "page_title": "Landing Page",
            "referrer": "https://facebook.com",
            "utm_source": "facebook",
            "utm_medium": "cpc",
            "utm_campaign": "summer_sale",
            "session_id": str(uuid.uuid4()),
            "visitor_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/analytics/collect", json=event_data)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_collect_event_with_screen_info(self):
        """Test collecting event with screen dimensions"""
        event_data = {
            "event_type": "pageview",
            "page_url": "https://example.com/products",
            "page_title": "Products",
            "session_id": str(uuid.uuid4()),
            "visitor_id": str(uuid.uuid4()),
            "screen_width": 1920,
            "screen_height": 1080,
            "language": "en-US",
            "timezone": "America/New_York"
        }
        
        response = requests.post(f"{BASE_URL}/api/analytics/collect", json=event_data)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_collect_session_end_event(self):
        """Test collecting session end event with time on page"""
        session_id = str(uuid.uuid4())
        visitor_id = str(uuid.uuid4())
        
        # First send pageview
        pageview_data = {
            "event_type": "pageview",
            "page_url": "https://example.com/article",
            "page_title": "Article",
            "session_id": session_id,
            "visitor_id": visitor_id
        }
        requests.post(f"{BASE_URL}/api/analytics/collect", json=pageview_data)
        
        # Then send session end
        session_end_data = {
            "event_type": "session_end",
            "page_url": "https://example.com/article",
            "session_id": session_id,
            "visitor_id": visitor_id,
            "time_on_page": 120  # 2 minutes
        }
        
        response = requests.post(f"{BASE_URL}/api/analytics/collect", json=session_end_data)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_collect_event_missing_required_fields(self):
        """Test that missing required fields returns error"""
        # Missing session_id and visitor_id
        event_data = {
            "event_type": "pageview",
            "page_url": "https://example.com/test"
        }
        
        response = requests.post(f"{BASE_URL}/api/analytics/collect", json=event_data)
        # Should return 422 for validation error
        assert response.status_code == 422


class TestTrackerScriptEndpoint:
    """Tests for GET /api/analytics/tracker.js"""
    
    def test_get_tracker_script(self):
        """Test that tracker script is returned"""
        response = requests.get(f"{BASE_URL}/api/analytics/tracker.js")
        assert response.status_code == 200
        
        # Check content type is JavaScript
        content_type = response.headers.get("content-type", "")
        assert "javascript" in content_type.lower() or "text/plain" in content_type.lower()
        
        # Check script contains expected functions
        script_content = response.text
        assert "trackPageview" in script_content or "pageview" in script_content
        assert "generateId" in script_content
        assert "setCookie" in script_content
        assert "getCookie" in script_content
    
    def test_tracker_script_no_auth_required(self):
        """Test that tracker script doesn't require authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/tracker.js")
        assert response.status_code == 200


class TestAnalyticsOverviewEndpoint:
    """Tests for GET /api/analytics/overview"""
    
    def test_overview_requires_auth(self):
        """Test that overview endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code in [401, 403]
    
    def test_overview_today(self, auth_headers):
        """Test getting overview for today"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview?period=today",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "visitors" in data
        assert "pageviews" in data
        assert "visitor_change" in data
        assert "pageview_change" in data
        assert "avg_time_on_site" in data
        assert "chart_data" in data
        assert "period" in data
        assert data["period"] == "today"
    
    def test_overview_7days(self, auth_headers):
        """Test getting overview for last 7 days"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview?period=7days",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "7days"
        assert isinstance(data["visitors"], int)
        assert isinstance(data["pageviews"], int)
    
    def test_overview_30days(self, auth_headers):
        """Test getting overview for last 30 days"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview?period=30days",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "30days"
    
    def test_overview_all_time(self, auth_headers):
        """Test getting overview for all time"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview?period=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "all"


class TestRealtimeEndpoint:
    """Tests for GET /api/analytics/realtime"""
    
    def test_realtime_requires_auth(self):
        """Test that realtime endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/realtime")
        assert response.status_code in [401, 403]
    
    def test_realtime_returns_data(self, auth_headers):
        """Test getting realtime analytics data"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/realtime",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "active_visitors" in data
        assert "pageviews_last_30min" in data
        assert isinstance(data["active_visitors"], int)
        assert isinstance(data["pageviews_last_30min"], int)


class TestPagesEndpoint:
    """Tests for GET /api/analytics/pages"""
    
    def test_pages_requires_auth(self):
        """Test that pages endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/pages")
        assert response.status_code in [401, 403]
    
    def test_pages_returns_data(self, auth_headers):
        """Test getting top pages"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/pages?period=all&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "pages" in data
        assert "total" in data
        assert isinstance(data["pages"], list)
        
        # If there are pages, check structure
        if data["pages"]:
            page = data["pages"][0]
            assert "url" in page
            assert "pageviews" in page
            assert "percentage" in page


class TestReferrersEndpoint:
    """Tests for GET /api/analytics/referrers"""
    
    def test_referrers_requires_auth(self):
        """Test that referrers endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/referrers")
        assert response.status_code in [401, 403]
    
    def test_referrers_returns_data(self, auth_headers):
        """Test getting top referrers"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/referrers?period=all&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "referrers" in data
        assert "total" in data
        assert isinstance(data["referrers"], list)
        
        # If there are referrers, check structure
        if data["referrers"]:
            ref = data["referrers"][0]
            assert "website" in ref
            assert "visitors" in ref
            assert "percentage" in ref


class TestCountriesEndpoint:
    """Tests for GET /api/analytics/countries"""
    
    def test_countries_requires_auth(self):
        """Test that countries endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/countries")
        assert response.status_code in [401, 403]
    
    def test_countries_returns_data(self, auth_headers):
        """Test getting visitors by country"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/countries?period=all&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "countries" in data
        assert "total" in data
        assert isinstance(data["countries"], list)
        
        # If there are countries, check structure
        if data["countries"]:
            country = data["countries"][0]
            assert "name" in country
            assert "visitors" in country
            assert "percentage" in country


class TestBrowsersEndpoint:
    """Tests for GET /api/analytics/browsers"""
    
    def test_browsers_requires_auth(self):
        """Test that browsers endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/browsers")
        assert response.status_code in [401, 403]
    
    def test_browsers_returns_data(self, auth_headers):
        """Test getting visitors by browser"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/browsers?period=all&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "browsers" in data
        assert "total" in data
        assert isinstance(data["browsers"], list)
        
        # If there are browsers, check structure
        if data["browsers"]:
            browser = data["browsers"][0]
            assert "name" in browser
            assert "visitors" in browser
            assert "percentage" in browser


class TestOperatingSystemsEndpoint:
    """Tests for GET /api/analytics/operating-systems"""
    
    def test_os_requires_auth(self):
        """Test that operating-systems endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/operating-systems")
        assert response.status_code in [401, 403]
    
    def test_os_returns_data(self, auth_headers):
        """Test getting visitors by operating system"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/operating-systems?period=all&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "operating_systems" in data
        assert "total" in data
        assert isinstance(data["operating_systems"], list)
        
        # If there are operating systems, check structure
        if data["operating_systems"]:
            os_item = data["operating_systems"][0]
            assert "name" in os_item
            assert "visitors" in os_item
            assert "percentage" in os_item


class TestAnalyticsDataIntegrity:
    """Tests to verify data integrity after collecting events"""
    
    def test_collected_events_appear_in_overview(self, auth_headers):
        """Test that collected events appear in overview"""
        # Create unique visitor and session
        visitor_id = f"test_visitor_{uuid.uuid4().hex[:8]}"
        session_id = f"test_session_{uuid.uuid4().hex[:8]}"
        
        # Collect a pageview
        event_data = {
            "event_type": "pageview",
            "page_url": "https://example.com/integrity-test",
            "page_title": "Integrity Test Page",
            "session_id": session_id,
            "visitor_id": visitor_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        collect_response = requests.post(f"{BASE_URL}/api/analytics/collect", json=event_data)
        assert collect_response.status_code == 200
        
        # Check overview - should have at least 1 pageview
        overview_response = requests.get(
            f"{BASE_URL}/api/analytics/overview?period=today",
            headers=auth_headers
        )
        assert overview_response.status_code == 200
        data = overview_response.json()
        
        # Verify pageviews count is at least 1
        assert data["pageviews"] >= 1


class TestNonAdminAccess:
    """Tests to verify non-admin users cannot access analytics"""
    
    def test_non_admin_cannot_access_overview(self):
        """Test that non-admin users get 403 on overview"""
        # First register a non-admin user
        test_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "User",
            "role": "sales_rep"
        })
        
        if register_response.status_code == 200:
            token = register_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Try to access analytics
            response = requests.get(
                f"{BASE_URL}/api/analytics/overview",
                headers=headers
            )
            assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
