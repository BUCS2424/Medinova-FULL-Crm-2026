"""
Test suite for CMS.gov & Medicare Data API endpoints
Tests the new CMS data integration on the Stay Up To Date page

Endpoints tested:
- GET /api/cms-data/datasets - List all CMS datasets with row counts
- GET /api/cms-data/{dataset_key}/data - Query dataset with filters
- GET /api/cms-data/{dataset_key}/stats - Get row count for dataset
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mel@a2gdesigns.com"
TEST_PASSWORD = "BigDaddy2016!!"

# Expected CMS datasets
EXPECTED_DATASETS = [
    "dme-suppliers",
    "dme-supplier-services", 
    "dme-referring-providers",
    "dme-provider-services"
]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestCMSDataAuthentication:
    """Test that CMS endpoints require authentication"""
    
    def test_datasets_requires_auth(self):
        """GET /api/cms-data/datasets requires Bearer token"""
        response = requests.get(f"{BASE_URL}/api/cms-data/datasets")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: /api/cms-data/datasets requires authentication")
    
    def test_data_endpoint_requires_auth(self):
        """GET /api/cms-data/{key}/data requires Bearer token"""
        response = requests.get(f"{BASE_URL}/api/cms-data/dme-suppliers/data")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: /api/cms-data/{key}/data requires authentication")
    
    def test_stats_endpoint_requires_auth(self):
        """GET /api/cms-data/{key}/stats requires Bearer token"""
        response = requests.get(f"{BASE_URL}/api/cms-data/dme-suppliers/stats")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: /api/cms-data/{key}/stats requires authentication")


class TestCMSDatasetsEndpoint:
    """Test GET /api/cms-data/datasets endpoint"""
    
    def test_get_datasets_returns_200(self, auth_headers):
        """GET /api/cms-data/datasets returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/cms-data/datasets", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/cms-data/datasets returns 200")
    
    def test_datasets_returns_4_datasets(self, auth_headers):
        """Response contains exactly 4 CMS datasets"""
        response = requests.get(f"{BASE_URL}/api/cms-data/datasets", headers=auth_headers)
        data = response.json()
        assert "datasets" in data, "Response missing 'datasets' key"
        assert len(data["datasets"]) == 4, f"Expected 4 datasets, got {len(data['datasets'])}"
        print(f"PASS: Response contains 4 datasets")
    
    def test_datasets_have_required_fields(self, auth_headers):
        """Each dataset has key, title, description, total_rows"""
        response = requests.get(f"{BASE_URL}/api/cms-data/datasets", headers=auth_headers)
        data = response.json()
        required_fields = ["key", "title", "description", "total_rows", "dataset_id"]
        
        for ds in data["datasets"]:
            for field in required_fields:
                assert field in ds, f"Dataset missing field: {field}"
        print("PASS: All datasets have required fields")
    
    def test_datasets_have_expected_keys(self, auth_headers):
        """Datasets include all expected dataset keys"""
        response = requests.get(f"{BASE_URL}/api/cms-data/datasets", headers=auth_headers)
        data = response.json()
        keys = [ds["key"] for ds in data["datasets"]]
        
        for expected_key in EXPECTED_DATASETS:
            assert expected_key in keys, f"Missing expected dataset: {expected_key}"
        print(f"PASS: All expected dataset keys present: {EXPECTED_DATASETS}")
    
    def test_datasets_have_positive_row_counts(self, auth_headers):
        """Each dataset has total_rows > 0"""
        response = requests.get(f"{BASE_URL}/api/cms-data/datasets", headers=auth_headers)
        data = response.json()
        
        for ds in data["datasets"]:
            assert ds["total_rows"] > 0, f"Dataset {ds['key']} has 0 rows"
            print(f"  - {ds['key']}: {ds['total_rows']:,} rows")
        print("PASS: All datasets have positive row counts")


class TestDMESuppliersDataEndpoint:
    """Test GET /api/cms-data/dme-suppliers/data endpoint"""
    
    def test_get_suppliers_data_returns_200(self, auth_headers):
        """GET /api/cms-data/dme-suppliers/data returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/cms-data/dme-suppliers/data returns 200")
    
    def test_suppliers_data_has_rows(self, auth_headers):
        """Response contains rows array"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            headers=auth_headers
        )
        data = response.json()
        assert "rows" in data, "Response missing 'rows' key"
        assert isinstance(data["rows"], list), "rows should be a list"
        assert len(data["rows"]) > 0, "rows should not be empty"
        print(f"PASS: Response contains {len(data['rows'])} rows")
    
    def test_suppliers_pagination_size(self, auth_headers):
        """size parameter limits results"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            params={"size": 10},
            headers=auth_headers
        )
        data = response.json()
        assert len(data["rows"]) <= 10, f"Expected max 10 rows, got {len(data['rows'])}"
        print(f"PASS: size=10 returns {len(data['rows'])} rows")
    
    def test_suppliers_pagination_offset(self, auth_headers):
        """offset parameter skips records"""
        # Get first page
        resp1 = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            params={"size": 5, "offset": 0},
            headers=auth_headers
        )
        # Get second page
        resp2 = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            params={"size": 5, "offset": 5},
            headers=auth_headers
        )
        
        data1 = resp1.json()
        data2 = resp2.json()
        
        # First row of page 2 should be different from first row of page 1
        if data1["rows"] and data2["rows"]:
            assert data1["rows"][0] != data2["rows"][0], "Offset not working - same first row"
        print("PASS: offset parameter works correctly")
    
    def test_suppliers_state_filter(self, auth_headers):
        """state parameter filters by state"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            params={"state": "FL", "size": 20},
            headers=auth_headers
        )
        data = response.json()
        
        # All returned rows should have FL state
        for row in data["rows"]:
            state = row.get("Suplr_Prvdr_State_Abrvtn", "")
            assert state == "FL", f"Expected FL, got {state}"
        print(f"PASS: state=FL filter returns only FL records ({len(data['rows'])} rows)")
    
    def test_suppliers_search_filter(self, auth_headers):
        """search parameter filters by name"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            params={"search": "MEDICAL", "size": 20},
            headers=auth_headers
        )
        data = response.json()
        
        # All returned rows should contain MEDICAL in name
        for row in data["rows"]:
            name = row.get("Suplr_Prvdr_Last_Name_Org", "").upper()
            assert "MEDICAL" in name, f"Expected MEDICAL in name, got {name}"
        print(f"PASS: search=MEDICAL filter works ({len(data['rows'])} rows)")
    
    def test_suppliers_combined_filters(self, auth_headers):
        """state and search can be combined"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/data",
            params={"state": "TX", "search": "HEALTH", "size": 20},
            headers=auth_headers
        )
        data = response.json()
        
        for row in data["rows"]:
            state = row.get("Suplr_Prvdr_State_Abrvtn", "")
            name = row.get("Suplr_Prvdr_Last_Name_Org", "").upper()
            assert state == "TX", f"Expected TX, got {state}"
            assert "HEALTH" in name, f"Expected HEALTH in name, got {name}"
        print(f"PASS: Combined state=TX + search=HEALTH works ({len(data['rows'])} rows)")


class TestDMEReferringProvidersDataEndpoint:
    """Test GET /api/cms-data/dme-referring-providers/data endpoint"""
    
    def test_get_providers_data_returns_200(self, auth_headers):
        """GET /api/cms-data/dme-referring-providers/data returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-referring-providers/data",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/cms-data/dme-referring-providers/data returns 200")
    
    def test_providers_state_filter(self, auth_headers):
        """state parameter filters referring providers by state"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-referring-providers/data",
            params={"state": "CA", "size": 20},
            headers=auth_headers
        )
        data = response.json()
        
        for row in data["rows"]:
            state = row.get("Rfrg_Prvdr_State_Abrvtn", "")
            assert state == "CA", f"Expected CA, got {state}"
        print(f"PASS: state=CA filter returns only CA records ({len(data['rows'])} rows)")
    
    def test_providers_search_filter(self, auth_headers):
        """search parameter filters referring providers by name"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-referring-providers/data",
            params={"search": "SMITH", "size": 20},
            headers=auth_headers
        )
        data = response.json()
        
        for row in data["rows"]:
            name = row.get("Rfrg_Prvdr_Last_Name_Org", "").upper()
            assert "SMITH" in name, f"Expected SMITH in name, got {name}"
        print(f"PASS: search=SMITH filter works ({len(data['rows'])} rows)")


class TestDMEServicesDataEndpoints:
    """Test service-level dataset endpoints"""
    
    def test_supplier_services_returns_200(self, auth_headers):
        """GET /api/cms-data/dme-supplier-services/data returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-supplier-services/data",
            params={"size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert len(data["rows"]) > 0, "Expected rows in response"
        print(f"PASS: dme-supplier-services returns {len(data['rows'])} rows")
    
    def test_provider_services_returns_200(self, auth_headers):
        """GET /api/cms-data/dme-provider-services/data returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-provider-services/data",
            params={"size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert len(data["rows"]) > 0, "Expected rows in response"
        print(f"PASS: dme-provider-services returns {len(data['rows'])} rows")


class TestCMSStatsEndpoint:
    """Test GET /api/cms-data/{key}/stats endpoint"""
    
    def test_suppliers_stats_returns_200(self, auth_headers):
        """GET /api/cms-data/dme-suppliers/stats returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/cms-data/dme-suppliers/stats returns 200")
    
    def test_stats_has_total_rows(self, auth_headers):
        """Stats response contains total_rows"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/dme-suppliers/stats",
            headers=auth_headers
        )
        data = response.json()
        assert "total_rows" in data, "Response missing 'total_rows'"
        assert data["total_rows"] > 0, "total_rows should be > 0"
        print(f"PASS: dme-suppliers has {data['total_rows']:,} total rows")
    
    def test_invalid_dataset_returns_404(self, auth_headers):
        """Invalid dataset key returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/cms-data/invalid-dataset/stats",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid dataset returns 404")


class TestHealthCareGovStillWorks:
    """Verify HealthCare.gov endpoints still work after CMS addition"""
    
    def test_articles_still_works(self, auth_headers):
        """GET /api/healthcare-gov/articles still returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/healthcare-gov/articles",
            params={"limit": 5},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "articles" in data, "Response missing 'articles'"
        assert data["total"] > 400, f"Expected 400+ articles, got {data['total']}"
        print(f"PASS: HealthCare.gov articles still works ({data['total']} items)")
    
    def test_glossary_still_works(self, auth_headers):
        """GET /api/healthcare-gov/glossary still returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/healthcare-gov/glossary",
            params={"limit": 5},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "glossary" in data, "Response missing 'glossary'"
        assert data["total"] > 200, f"Expected 200+ glossary items, got {data['total']}"
        print(f"PASS: HealthCare.gov glossary still works ({data['total']} items)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
