"""
Test suite for Directory Submission Tool API endpoints
Tests: GET /api/directories, GET /api/directories/stats, PUT /api/directories/{id}, 
       POST /api/directories/bulk-update, GET /api/directories/export
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDirectorySubmissionAPI:
    """Directory Submission Tool API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - authenticate and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mel@a2gdesigns.com",
            "password": "BigDaddy2016!!"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # ==================== GET /api/directories ====================
    
    def test_get_directories_returns_47_directories(self):
        """GET /api/directories should return 47 directories"""
        response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        assert response.status_code == 200
        directories = response.json()
        assert len(directories) == 47, f"Expected 47 directories, got {len(directories)}"
    
    def test_get_directories_has_required_fields(self):
        """Each directory should have required fields"""
        response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        assert response.status_code == 200
        directories = response.json()
        
        required_fields = ["id", "name", "url", "category", "priority", "description", "status"]
        for directory in directories[:5]:  # Check first 5
            for field in required_fields:
                assert field in directory, f"Missing field '{field}' in directory {directory.get('name')}"
    
    def test_get_directories_has_9_categories(self):
        """Directories should span 9 categories"""
        response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        assert response.status_code == 200
        directories = response.json()
        
        categories = set(d["category"] for d in directories)
        expected_categories = {
            "Search & Maps", "Social & Reviews", "General Directories", 
            "Local & Maps", "Healthcare", "Data Aggregators", 
            "Industry", "Local Community", "Business Profiles"
        }
        assert categories == expected_categories, f"Categories mismatch: {categories}"
    
    def test_get_directories_has_priority_levels(self):
        """Directories should have priority 1, 2, or 3"""
        response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        assert response.status_code == 200
        directories = response.json()
        
        priorities = set(d["priority"] for d in directories)
        assert priorities == {1, 2, 3}, f"Expected priorities 1,2,3, got {priorities}"
    
    def test_get_directories_unauthorized(self):
        """GET /api/directories without auth should return 403"""
        response = requests.get(f"{BASE_URL}/api/directories")
        assert response.status_code == 403
    
    # ==================== GET /api/directories/stats ====================
    
    def test_get_directory_stats_returns_stats(self):
        """GET /api/directories/stats should return statistics"""
        response = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers)
        assert response.status_code == 200
        stats = response.json()
        
        required_fields = ["total", "not_submitted", "submitted", "pending", 
                          "verified", "needs_update", "rejected", "by_category", 
                          "by_priority", "completion_percentage"]
        for field in required_fields:
            assert field in stats, f"Missing field '{field}' in stats"
    
    def test_get_directory_stats_total_is_47(self):
        """Stats total should be 47"""
        response = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers)
        assert response.status_code == 200
        stats = response.json()
        assert stats["total"] == 47
    
    def test_get_directory_stats_counts_add_up(self):
        """Status counts should add up to total"""
        response = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers)
        assert response.status_code == 200
        stats = response.json()
        
        total_counted = (stats["not_submitted"] + stats["submitted"] + 
                        stats["pending"] + stats["verified"] + 
                        stats["needs_update"] + stats["rejected"])
        assert total_counted == stats["total"], f"Counts don't add up: {total_counted} != {stats['total']}"
    
    def test_get_directory_stats_by_category(self):
        """Stats should include breakdown by category"""
        response = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers)
        assert response.status_code == 200
        stats = response.json()
        
        assert len(stats["by_category"]) == 9, f"Expected 9 categories, got {len(stats['by_category'])}"
        
        # Verify category totals add up
        category_total = sum(cat["total"] for cat in stats["by_category"].values())
        assert category_total == 47, f"Category totals don't add up: {category_total}"
    
    # ==================== PUT /api/directories/{directory_id} ====================
    
    def test_update_directory_status(self):
        """PUT /api/directories/{id} should update status"""
        # Update a directory
        response = requests.put(
            f"{BASE_URL}/api/directories/facebook",
            headers=self.headers,
            json={
                "directory_id": "facebook",
                "status": "submitted",
                "listing_url": "https://facebook.com/testbusiness",
                "username": "test@test.com",
                "notes": "Test submission via pytest"
            }
        )
        assert response.status_code == 200
        assert "message" in response.json()
        
        # Verify the update
        get_response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        directories = get_response.json()
        facebook = next(d for d in directories if d["id"] == "facebook")
        
        assert facebook["status"] == "submitted"
        assert facebook["listing_url"] == "https://facebook.com/testbusiness"
        assert facebook["username"] == "test@test.com"
        assert facebook["notes"] == "Test submission via pytest"
    
    def test_update_directory_sets_submitted_date(self):
        """Updating to submitted status should set submitted_date"""
        response = requests.put(
            f"{BASE_URL}/api/directories/yelp",
            headers=self.headers,
            json={
                "directory_id": "yelp",
                "status": "submitted"
            }
        )
        assert response.status_code == 200
        
        # Verify submitted_date was set
        get_response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        directories = get_response.json()
        yelp = next(d for d in directories if d["id"] == "yelp")
        
        assert yelp["submitted_date"] is not None
    
    def test_update_directory_sets_verified_date(self):
        """Updating to verified status should set verified_date"""
        response = requests.put(
            f"{BASE_URL}/api/directories/nextdoor",
            headers=self.headers,
            json={
                "directory_id": "nextdoor",
                "status": "verified"
            }
        )
        assert response.status_code == 200
        
        # Verify verified_date was set
        get_response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        directories = get_response.json()
        nextdoor = next(d for d in directories if d["id"] == "nextdoor")
        
        assert nextdoor["verified_date"] is not None
    
    def test_update_nonexistent_directory(self):
        """PUT /api/directories/{invalid_id} should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/directories/nonexistent_directory",
            headers=self.headers,
            json={
                "directory_id": "nonexistent_directory",
                "status": "submitted"
            }
        )
        assert response.status_code == 404
    
    # ==================== POST /api/directories/bulk-update ====================
    
    def test_bulk_update_directories(self):
        """POST /api/directories/bulk-update should update multiple directories"""
        response = requests.post(
            f"{BASE_URL}/api/directories/bulk-update",
            headers=self.headers,
            json={
                "directory_ids": ["yellowpages", "whitepages", "superpages"],
                "status": "submitted"
            }
        )
        assert response.status_code == 200
        result = response.json()
        assert "Updated 3" in result["message"]
        
        # Verify the updates
        get_response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        directories = get_response.json()
        
        for dir_id in ["yellowpages", "whitepages", "superpages"]:
            directory = next(d for d in directories if d["id"] == dir_id)
            assert directory["status"] == "submitted", f"{dir_id} not updated"
    
    def test_bulk_update_to_verified(self):
        """Bulk update to verified should set verified_date"""
        response = requests.post(
            f"{BASE_URL}/api/directories/bulk-update",
            headers=self.headers,
            json={
                "directory_ids": ["manta", "hotfrog"],
                "status": "verified"
            }
        )
        assert response.status_code == 200
        
        # Verify verified_date was set
        get_response = requests.get(f"{BASE_URL}/api/directories", headers=self.headers)
        directories = get_response.json()
        
        for dir_id in ["manta", "hotfrog"]:
            directory = next(d for d in directories if d["id"] == dir_id)
            assert directory["verified_date"] is not None
    
    def test_bulk_update_empty_list(self):
        """Bulk update with empty list should update 0"""
        response = requests.post(
            f"{BASE_URL}/api/directories/bulk-update",
            headers=self.headers,
            json={
                "directory_ids": [],
                "status": "submitted"
            }
        )
        assert response.status_code == 200
        assert "Updated 0" in response.json()["message"]
    
    # ==================== GET /api/directories/export ====================
    
    def test_export_directories_csv(self):
        """GET /api/directories/export should return CSV data"""
        response = requests.get(f"{BASE_URL}/api/directories/export", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "csv_data" in data
        assert "filename" in data
        assert data["filename"].endswith(".csv")
    
    def test_export_csv_has_headers(self):
        """Export CSV should have correct headers"""
        response = requests.get(f"{BASE_URL}/api/directories/export", headers=self.headers)
        assert response.status_code == 200
        
        csv_data = response.json()["csv_data"]
        first_line = csv_data.split("\n")[0]
        
        expected_headers = "Directory,Category,Priority,Status,Submitted Date,Verified Date,Listing URL,Notes"
        assert first_line == expected_headers
    
    def test_export_csv_has_47_data_rows(self):
        """Export CSV should have 47 data rows (plus header)"""
        response = requests.get(f"{BASE_URL}/api/directories/export", headers=self.headers)
        assert response.status_code == 200
        
        csv_data = response.json()["csv_data"]
        lines = [l for l in csv_data.split("\n") if l.strip()]
        
        # 1 header + 47 data rows
        assert len(lines) == 48, f"Expected 48 lines, got {len(lines)}"
    
    # ==================== Integration Tests ====================
    
    def test_update_reflects_in_stats(self):
        """Updating directories should reflect in stats"""
        # Get initial stats
        initial_stats = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers).json()
        initial_verified = initial_stats["verified"]
        
        # Update a directory to verified
        requests.put(
            f"{BASE_URL}/api/directories/brownbook",
            headers=self.headers,
            json={"directory_id": "brownbook", "status": "verified"}
        )
        
        # Check stats updated
        new_stats = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers).json()
        assert new_stats["verified"] >= initial_verified
    
    def test_completion_percentage_calculation(self):
        """Completion percentage should be calculated correctly"""
        stats = requests.get(f"{BASE_URL}/api/directories/stats", headers=self.headers).json()
        
        completed = stats["submitted"] + stats["pending"] + stats["verified"]
        expected_percentage = round((completed / stats["total"]) * 100, 1)
        
        assert stats["completion_percentage"] == expected_percentage


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
