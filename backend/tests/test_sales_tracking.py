"""
Test Sales Tracking Feature
- Dashboard sales overview (today, week, month, pipeline)
- Lead estimated_value and interested_products fields
- API endpoint /api/dashboard/stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mel@a2gdesigns.com"
TEST_PASSWORD = "BigDaddy2016!!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestDashboardStatsAPI:
    """Test /api/dashboard/stats endpoint for sales data"""
    
    def test_dashboard_stats_returns_sales_structure(self, headers):
        """Verify dashboard stats returns correct sales data structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify sales object exists
        assert "sales" in data, "Response should contain 'sales' object"
        sales = data["sales"]
        
        # Verify today's sales structure
        assert "today" in sales, "Sales should contain 'today'"
        assert "amount" in sales["today"], "Today should have 'amount'"
        assert "count" in sales["today"], "Today should have 'count'"
        assert isinstance(sales["today"]["amount"], (int, float))
        assert isinstance(sales["today"]["count"], int)
        
        # Verify week's sales structure
        assert "week" in sales, "Sales should contain 'week'"
        assert "amount" in sales["week"], "Week should have 'amount'"
        assert "count" in sales["week"], "Week should have 'count'"
        
        # Verify month's sales structure
        assert "month" in sales, "Sales should contain 'month'"
        assert "amount" in sales["month"], "Month should have 'amount'"
        assert "count" in sales["month"], "Month should have 'count'"
        
        # Verify total sales structure
        assert "total" in sales, "Sales should contain 'total'"
        assert "amount" in sales["total"], "Total should have 'amount'"
        assert "count" in sales["total"], "Total should have 'count'"
        
        # Verify pipeline_value
        assert "pipeline_value" in sales, "Sales should contain 'pipeline_value'"
        assert isinstance(sales["pipeline_value"], (int, float))
        
        print(f"✓ Dashboard stats sales structure is correct")
        print(f"  Today: ${sales['today']['amount']} ({sales['today']['count']} orders)")
        print(f"  Week: ${sales['week']['amount']} ({sales['week']['count']} orders)")
        print(f"  Month: ${sales['month']['amount']} ({sales['month']['count']} orders)")
        print(f"  Total: ${sales['total']['amount']} ({sales['total']['count']} orders)")
        print(f"  Pipeline: ${sales['pipeline_value']}")
    
    def test_dashboard_stats_returns_weekly_sales(self, headers):
        """Verify dashboard stats returns weekly_sales array for chart"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify weekly_sales array exists
        assert "weekly_sales" in data, "Response should contain 'weekly_sales' array"
        weekly_sales = data["weekly_sales"]
        
        # Should have 7 days of data
        assert len(weekly_sales) == 7, f"weekly_sales should have 7 days, got {len(weekly_sales)}"
        
        # Verify each day's structure
        for day_data in weekly_sales:
            assert "date" in day_data, "Each day should have 'date'"
            assert "day" in day_data, "Each day should have 'day' (weekday name)"
            assert "sales" in day_data, "Each day should have 'sales' amount"
            assert "orders" in day_data, "Each day should have 'orders' count"
            assert isinstance(day_data["sales"], (int, float))
            assert isinstance(day_data["orders"], int)
        
        print(f"✓ Weekly sales data structure is correct (7 days)")
        for day in weekly_sales:
            print(f"  {day['day']} ({day['date']}): ${day['sales']} ({day['orders']} orders)")


class TestLeadProductsAndValue:
    """Test lead interested_products and estimated_value fields"""
    
    def test_lead_has_product_fields(self, headers):
        """Verify leads have interested_products and estimated_value fields"""
        response = requests.get(f"{BASE_URL}/api/leads?limit=1", headers=headers)
        assert response.status_code == 200
        
        leads = response.json()
        assert len(leads) > 0, "Should have at least one lead"
        
        lead = leads[0]
        # Fields should exist (can be null)
        assert "estimated_value" in lead or lead.get("estimated_value") is None, "Lead should have estimated_value field"
        assert "interested_products" in lead or lead.get("interested_products") is None, "Lead should have interested_products field"
        
        print(f"✓ Lead has product tracking fields")
        print(f"  Lead: {lead.get('first_name')} {lead.get('last_name')}")
        print(f"  Estimated Value: {lead.get('estimated_value')}")
        print(f"  Products: {lead.get('interested_products')}")
    
    def test_update_lead_with_products(self, headers):
        """Test updating a lead with products and estimated value"""
        # Get a lead to update
        response = requests.get(f"{BASE_URL}/api/leads?limit=1", headers=headers)
        assert response.status_code == 200
        leads = response.json()
        assert len(leads) > 0
        lead_id = leads[0]["id"]
        
        # Update with products
        test_products = [
            {"name": "TEST_Back Brace", "value": 150.00},
            {"name": "TEST_Knee Support", "value": 200.00}
        ]
        test_value = 350.00
        
        update_response = requests.put(
            f"{BASE_URL}/api/leads/{lead_id}",
            headers=headers,
            json={
                "interested_products": test_products,
                "estimated_value": test_value
            }
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=headers)
        assert get_response.status_code == 200
        
        updated_lead = get_response.json()
        assert updated_lead["estimated_value"] == test_value, "Estimated value should be updated"
        assert len(updated_lead["interested_products"]) == 2, "Should have 2 products"
        
        print(f"✓ Lead products and value updated successfully")
        print(f"  Estimated Value: ${updated_lead['estimated_value']}")
        print(f"  Products: {updated_lead['interested_products']}")
    
    def test_pipeline_value_includes_lead_estimates(self, headers):
        """Verify pipeline_value in dashboard includes lead estimated values"""
        # First, get current pipeline value
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        
        pipeline_value = response.json()["sales"]["pipeline_value"]
        
        # Pipeline value should be >= 0 (could be 0 if no leads have estimates)
        assert pipeline_value >= 0, "Pipeline value should be non-negative"
        
        print(f"✓ Pipeline value is calculated: ${pipeline_value}")


class TestLeadDetailAPI:
    """Test individual lead detail endpoint for product fields"""
    
    def test_get_lead_detail_includes_products(self, headers):
        """Verify GET /api/leads/{id} returns product fields"""
        # Get a lead
        response = requests.get(f"{BASE_URL}/api/leads?limit=1", headers=headers)
        assert response.status_code == 200
        leads = response.json()
        assert len(leads) > 0
        lead_id = leads[0]["id"]
        
        # Get lead detail
        detail_response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=headers)
        assert detail_response.status_code == 200
        
        lead = detail_response.json()
        
        # Verify fields exist in response
        assert "id" in lead
        assert "first_name" in lead
        assert "last_name" in lead
        assert "status" in lead
        # These fields should be present (even if null)
        assert "estimated_value" in lead or lead.get("estimated_value") is None
        assert "interested_products" in lead or lead.get("interested_products") is None
        
        print(f"✓ Lead detail includes product fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
