"""
Phone CDR Dashboard API Tests
Tests for Call Detail Records, Statistics, and Billing Configuration endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhoneCDRDashboard:
    """Tests for Phone CDR Dashboard API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mel@a2gdesigns.com",
            "password": "BigDaddy2016!!"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    # ==================== Billing Config Tests ====================
    
    def test_get_billing_config(self):
        """Test GET /api/voice/billing/config returns billing configuration"""
        response = self.session.get(f"{BASE_URL}/api/voice/billing/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "per_minute_rate" in data, "Missing per_minute_rate field"
        assert "markup_percentage" in data, "Missing markup_percentage field"
        assert "currency" in data, "Missing currency field"
        
        # Validate data types
        assert isinstance(data["per_minute_rate"], (int, float)), "per_minute_rate should be numeric"
        assert isinstance(data["markup_percentage"], (int, float)), "markup_percentage should be numeric"
        assert isinstance(data["currency"], str), "currency should be string"
        
        print(f"Billing config: rate=${data['per_minute_rate']}/min, markup={data['markup_percentage']}%")
    
    def test_update_billing_config(self):
        """Test PUT /api/voice/billing/config updates billing configuration"""
        # Get current config
        original_response = self.session.get(f"{BASE_URL}/api/voice/billing/config")
        original_config = original_response.json()
        
        # Update config
        new_config = {
            "per_minute_rate": 0.015,
            "markup_percentage": 15,
            "currency": "USD"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/voice/billing/config",
            json=new_config
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        assert "message" in update_response.json(), "Missing success message"
        
        # Verify update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/voice/billing/config")
        verify_data = verify_response.json()
        
        assert verify_data["per_minute_rate"] == 0.015, "per_minute_rate not updated"
        assert verify_data["markup_percentage"] == 15, "markup_percentage not updated"
        
        # Restore original config
        restore_config = {
            "per_minute_rate": original_config.get("per_minute_rate", 0.0085),
            "markup_percentage": original_config.get("markup_percentage", 0),
            "currency": original_config.get("currency", "USD")
        }
        self.session.put(f"{BASE_URL}/api/voice/billing/config", json=restore_config)
        
        print("Billing config update and restore successful")
    
    # ==================== Stats Tests ====================
    
    def test_get_stats_all_time(self):
        """Test GET /api/voice/stats with period=all returns all-time statistics"""
        response = self.session.get(f"{BASE_URL}/api/voice/stats?period=all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields
        required_fields = [
            "total_calls", "total_seconds", "total_minutes",
            "completed_calls", "missed_calls",
            "inbound_calls", "outbound_calls",
            "inbound_minutes", "outbound_minutes",
            "billing", "period"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify billing sub-fields
        billing = data["billing"]
        billing_fields = ["per_minute_rate", "markup_percentage", "base_cost", "markup_cost", "total_cost", "currency"]
        for field in billing_fields:
            assert field in billing, f"Missing billing field: {field}"
        
        # Verify period
        assert data["period"] == "all", f"Expected period='all', got {data['period']}"
        
        print(f"Stats: {data['total_calls']} calls, {data['total_minutes']} min, ${data['billing']['total_cost']} total cost")
    
    def test_get_stats_today(self):
        """Test GET /api/voice/stats with period=day returns today's statistics"""
        response = self.session.get(f"{BASE_URL}/api/voice/stats?period=day")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["period"] == "day", f"Expected period='day', got {data['period']}"
        assert "total_calls" in data
        assert "billing" in data
        
        print(f"Today's stats: {data['total_calls']} calls")
    
    def test_get_stats_week(self):
        """Test GET /api/voice/stats with period=week returns weekly statistics"""
        response = self.session.get(f"{BASE_URL}/api/voice/stats?period=week")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["period"] == "week", f"Expected period='week', got {data['period']}"
        
        print(f"Weekly stats: {data['total_calls']} calls")
    
    def test_get_stats_month(self):
        """Test GET /api/voice/stats with period=month returns monthly statistics"""
        response = self.session.get(f"{BASE_URL}/api/voice/stats?period=month")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["period"] == "month", f"Expected period='month', got {data['period']}"
        
        print(f"Monthly stats: {data['total_calls']} calls")
    
    def test_stats_cost_calculation(self):
        """Test that stats cost calculation reflects billing config"""
        # Set known billing config
        test_config = {
            "per_minute_rate": 0.01,
            "markup_percentage": 10,
            "currency": "USD"
        }
        self.session.put(f"{BASE_URL}/api/voice/billing/config", json=test_config)
        
        # Get stats
        response = self.session.get(f"{BASE_URL}/api/voice/stats?period=all")
        data = response.json()
        
        # Verify billing config is reflected
        assert data["billing"]["per_minute_rate"] == 0.01, "per_minute_rate not reflected in stats"
        assert data["billing"]["markup_percentage"] == 10, "markup_percentage not reflected in stats"
        
        # Verify cost calculation
        expected_base_cost = data["total_minutes"] * 0.01
        expected_markup = expected_base_cost * 0.10
        expected_total = expected_base_cost + expected_markup
        
        # Allow small floating point differences
        assert abs(data["billing"]["base_cost"] - expected_base_cost) < 0.0001, "Base cost calculation incorrect"
        assert abs(data["billing"]["total_cost"] - expected_total) < 0.0001, "Total cost calculation incorrect"
        
        # Restore default config
        self.session.put(f"{BASE_URL}/api/voice/billing/config", json={
            "per_minute_rate": 0.0085,
            "markup_percentage": 0,
            "currency": "USD"
        })
        
        print("Cost calculation verified correctly")
    
    # ==================== CDR Tests ====================
    
    def test_get_cdr_list(self):
        """Test GET /api/voice/calls/cdr returns call detail records"""
        response = self.session.get(f"{BASE_URL}/api/voice/calls/cdr?period=all&page=1&page_size=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify pagination fields
        assert "calls" in data, "Missing calls array"
        assert "total" in data, "Missing total count"
        assert "page" in data, "Missing page number"
        assert "page_size" in data, "Missing page_size"
        assert "total_pages" in data, "Missing total_pages"
        
        # Verify calls is a list
        assert isinstance(data["calls"], list), "calls should be a list"
        
        # If there are calls, verify structure
        if len(data["calls"]) > 0:
            call = data["calls"][0]
            call_fields = ["id", "direction", "from_number", "status", "start_time", "cost"]
            for field in call_fields:
                assert field in call, f"Missing call field: {field}"
        
        print(f"CDR: {data['total']} total calls, page {data['page']} of {data['total_pages']}")
    
    def test_get_cdr_with_direction_filter(self):
        """Test GET /api/voice/calls/cdr with direction filter"""
        # Test inbound filter
        response = self.session.get(f"{BASE_URL}/api/voice/calls/cdr?period=all&direction=inbound")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all returned calls are inbound
        for call in data["calls"]:
            assert call["direction"] == "inbound", f"Expected inbound, got {call['direction']}"
        
        print(f"Inbound filter: {data['total']} inbound calls")
    
    def test_get_cdr_with_status_filter(self):
        """Test GET /api/voice/calls/cdr with status filter"""
        # Test completed filter
        response = self.session.get(f"{BASE_URL}/api/voice/calls/cdr?period=all&status=completed")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all returned calls are completed
        for call in data["calls"]:
            assert call["status"] == "completed", f"Expected completed, got {call['status']}"
        
        print(f"Completed filter: {data['total']} completed calls")
    
    def test_get_cdr_pagination(self):
        """Test GET /api/voice/calls/cdr pagination works correctly"""
        # Get first page
        page1_response = self.session.get(f"{BASE_URL}/api/voice/calls/cdr?period=all&page=1&page_size=5")
        page1_data = page1_response.json()
        
        assert page1_response.status_code == 200
        assert page1_data["page"] == 1
        assert len(page1_data["calls"]) <= 5
        
        # If there are more pages, get second page
        if page1_data["total_pages"] > 1:
            page2_response = self.session.get(f"{BASE_URL}/api/voice/calls/cdr?period=all&page=2&page_size=5")
            page2_data = page2_response.json()
            
            assert page2_response.status_code == 200
            assert page2_data["page"] == 2
            
            # Verify different calls on different pages
            if len(page1_data["calls"]) > 0 and len(page2_data["calls"]) > 0:
                page1_ids = [c["id"] for c in page1_data["calls"]]
                page2_ids = [c["id"] for c in page2_data["calls"]]
                assert not any(id in page1_ids for id in page2_ids), "Same calls on different pages"
        
        print(f"Pagination: {page1_data['total_pages']} total pages")
    
    def test_cdr_cost_reflects_billing_config(self):
        """Test that CDR call costs reflect current billing configuration"""
        # Set known billing config
        test_config = {
            "per_minute_rate": 0.02,
            "markup_percentage": 25,
            "currency": "USD"
        }
        self.session.put(f"{BASE_URL}/api/voice/billing/config", json=test_config)
        
        # Get CDR
        response = self.session.get(f"{BASE_URL}/api/voice/calls/cdr?period=all&page=1&page_size=10")
        data = response.json()
        
        # Verify costs are calculated with new config
        for call in data["calls"]:
            if call.get("duration_seconds", 0) > 0:
                duration_mins = call["duration_seconds"] / 60
                expected_cost = duration_mins * 0.02 * 1.25  # rate * (1 + markup)
                # Allow small floating point differences
                assert abs(call["cost"] - expected_cost) < 0.0001, f"Cost mismatch for call {call['id']}"
        
        # Restore default config
        self.session.put(f"{BASE_URL}/api/voice/billing/config", json={
            "per_minute_rate": 0.0085,
            "markup_percentage": 0,
            "currency": "USD"
        })
        
        print("CDR costs reflect billing config correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
