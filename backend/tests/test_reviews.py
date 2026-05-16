"""
Test suite for Reviews/Testimonials System
Tests all review endpoints including:
- Admin review management (CRUD, filters, stats)
- Public review submission and display
- Fake review generation and cleanup
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mel@a2gdesigns.com"
TEST_PASSWORD = "BigDaddy2016!!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestReviewsStats:
    """Test GET /api/reviews/stats endpoint"""
    
    def test_get_stats_success(self, headers):
        """Test getting review statistics"""
        response = requests.get(f"{BASE_URL}/api/reviews/stats", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields are present
        assert "total" in data
        assert "pending" in data
        assert "approved" in data
        assert "rejected" in data
        assert "on_homepage" in data
        assert "featured" in data
        assert "fake_count" in data
        assert "average_rating" in data
        assert "by_source" in data
        
        # Verify data types
        assert isinstance(data["total"], int)
        assert isinstance(data["pending"], int)
        assert isinstance(data["approved"], int)
        assert isinstance(data["average_rating"], (int, float))
        
        print(f"Stats: total={data['total']}, approved={data['approved']}, pending={data['pending']}, fake={data['fake_count']}")
    
    def test_get_stats_requires_auth(self):
        """Test that stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/reviews/stats")
        assert response.status_code in [401, 403]


class TestReviewsList:
    """Test GET /api/reviews endpoint with filters"""
    
    def test_get_reviews_success(self, headers):
        """Test getting all reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "reviews" in data
        assert "total" in data
        assert isinstance(data["reviews"], list)
        
        print(f"Found {data['total']} total reviews")
    
    def test_get_reviews_with_search(self, headers):
        """Test search filter"""
        response = requests.get(f"{BASE_URL}/api/reviews?search=excellent", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "reviews" in data
        print(f"Search 'excellent' returned {len(data['reviews'])} reviews")
    
    def test_get_reviews_filter_by_status(self, headers):
        """Test status filter"""
        for status in ["pending", "approved", "rejected"]:
            response = requests.get(f"{BASE_URL}/api/reviews?status={status}", headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            # Verify all returned reviews have the correct status
            for review in data["reviews"]:
                assert review["status"] == status
            print(f"Status '{status}' returned {len(data['reviews'])} reviews")
    
    def test_get_reviews_filter_by_fake(self, headers):
        """Test is_fake filter"""
        # Get fake reviews
        response = requests.get(f"{BASE_URL}/api/reviews?is_fake=true", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        for review in data["reviews"]:
            assert review.get("is_fake") == True
        print(f"Fake reviews: {len(data['reviews'])}")
        
        # Get real reviews
        response = requests.get(f"{BASE_URL}/api/reviews?is_fake=false", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        for review in data["reviews"]:
            assert review.get("is_fake") == False
        print(f"Real reviews: {len(data['reviews'])}")
    
    def test_get_reviews_pagination(self, headers):
        """Test pagination"""
        response = requests.get(f"{BASE_URL}/api/reviews?skip=0&limit=5", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["reviews"]) <= 5
    
    def test_get_reviews_requires_auth(self):
        """Test that reviews list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code in [401, 403]


class TestReviewSources:
    """Test GET /api/reviews/sources endpoint"""
    
    def test_get_sources_success(self, headers):
        """Test getting unique review sources"""
        response = requests.get(f"{BASE_URL}/api/reviews/sources", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "sources" in data
        assert isinstance(data["sources"], list)
        print(f"Sources: {data['sources']}")


class TestReviewCRUD:
    """Test review CRUD operations"""
    
    def test_create_review(self, headers):
        """Test creating a new review"""
        review_data = {
            "title": "TEST_Excellent Service",
            "text": "This is a test review created by automated testing. The service was excellent!",
            "rating": 5,
            "reviewer_name": "Test User",
            "reviewer_email": "test@example.com",
            "reviewer_phone": "555-123-4567",
            "reviewer_title": "Test Patient",
            "reviewer_location": "Tampa, FL",
            "transaction_type": "Patient",
            "product_purchased": "Wheelchair",
            "source": "Manual",
            "status": "approved",
            "featured": False,
            "show_on_homepage": True,
            "is_fake": True  # Mark as fake for cleanup
        }
        
        response = requests.post(f"{BASE_URL}/api/reviews", json=review_data, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["message"] == "Review created"
        
        # Store ID for later tests
        TestReviewCRUD.created_review_id = data["id"]
        print(f"Created review with ID: {data['id']}")
    
    def test_get_created_review(self, headers):
        """Verify the created review exists in the list"""
        response = requests.get(f"{BASE_URL}/api/reviews?search=TEST_Excellent", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["reviews"]) > 0
        
        # Find our created review
        found = False
        for review in data["reviews"]:
            if review.get("title") == "TEST_Excellent Service":
                found = True
                assert review["rating"] == 5
                assert review["reviewer_name"] == "Test User"
                assert review["status"] == "approved"
                break
        
        assert found, "Created review not found in list"
    
    def test_update_review(self, headers):
        """Test updating a review"""
        review_id = getattr(TestReviewCRUD, 'created_review_id', None)
        if not review_id:
            pytest.skip("No review ID from create test")
        
        update_data = {
            "title": "TEST_Updated Title",
            "status": "pending",
            "featured": True
        }
        
        response = requests.put(f"{BASE_URL}/api/reviews/{review_id}", json=update_data, headers=headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Review updated"
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/reviews?search=TEST_Updated", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        found = False
        for review in data["reviews"]:
            if review.get("id") == review_id:
                found = True
                assert review["title"] == "TEST_Updated Title"
                assert review["status"] == "pending"
                assert review["featured"] == True
                break
        
        assert found, "Updated review not found"
    
    def test_update_nonexistent_review(self, headers):
        """Test updating a non-existent review returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/reviews/{fake_id}", json={"title": "Test"}, headers=headers)
        assert response.status_code == 404
    
    def test_delete_review(self, headers):
        """Test deleting a review"""
        review_id = getattr(TestReviewCRUD, 'created_review_id', None)
        if not review_id:
            pytest.skip("No review ID from create test")
        
        response = requests.delete(f"{BASE_URL}/api/reviews/{review_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Review deleted"
        
        # Verify deletion
        response = requests.get(f"{BASE_URL}/api/reviews?search=TEST_Updated", headers=headers)
        data = response.json()
        for review in data["reviews"]:
            assert review.get("id") != review_id
    
    def test_delete_nonexistent_review(self, headers):
        """Test deleting a non-existent review returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/reviews/{fake_id}", headers=headers)
        assert response.status_code == 404


class TestPublicReviews:
    """Test public review endpoints (no auth required)"""
    
    def test_get_public_reviews(self):
        """Test getting public reviews without auth"""
        response = requests.get(f"{BASE_URL}/api/reviews/public")
        assert response.status_code == 200
        
        data = response.json()
        assert "reviews" in data
        assert "stats" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "average_rating" in stats
        assert "total_reviews" in stats
        assert "recommend_percentage" in stats
        
        # Verify reviews don't contain sensitive info
        for review in data["reviews"]:
            assert "reviewer_email" not in review
            assert "reviewer_phone" not in review
            assert "is_fake" not in review
        
        print(f"Public reviews: {len(data['reviews'])}, avg rating: {stats['average_rating']}")
    
    def test_get_public_reviews_homepage_only(self):
        """Test getting only homepage reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews/public?homepage_only=true")
        assert response.status_code == 200
        
        data = response.json()
        # All returned reviews should have show_on_homepage=True (but field is excluded)
        print(f"Homepage reviews: {len(data['reviews'])}")
    
    def test_get_public_reviews_featured_only(self):
        """Test getting only featured reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews/public?featured_only=true")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Featured reviews: {len(data['reviews'])}")
    
    def test_get_public_reviews_with_limit(self):
        """Test limiting public reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews/public?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["reviews"]) <= 5


class TestPublicReviewSubmission:
    """Test public review submission endpoint"""
    
    def test_submit_review_success(self):
        """Test submitting a review from public website"""
        review_data = {
            "title": "TEST_Public Submission",
            "text": "This is a test review submitted through the public form.",
            "rating": 5,
            "reviewer_name": "Public Test User",
            "reviewer_email": "publictest@example.com",
            "reviewer_phone": "555-999-8888",
            "transaction_type": "Patient",
            "product_purchased": "CPAP Machine"
        }
        
        response = requests.post(f"{BASE_URL}/api/reviews/submit", json=review_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "Thank you" in data["message"]
        
        TestPublicReviewSubmission.submitted_review_id = data["id"]
        print(f"Submitted public review with ID: {data['id']}")
    
    def test_submitted_review_is_pending(self, headers):
        """Verify submitted review has pending status"""
        review_id = getattr(TestPublicReviewSubmission, 'submitted_review_id', None)
        if not review_id:
            pytest.skip("No review ID from submit test")
        
        response = requests.get(f"{BASE_URL}/api/reviews?search=TEST_Public", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        found = False
        for review in data["reviews"]:
            if review.get("id") == review_id:
                found = True
                assert review["status"] == "pending"
                assert review["source"] == "Website"
                assert review["featured"] == False
                assert review["show_on_homepage"] == False
                break
        
        assert found, "Submitted review not found"
    
    def test_submit_review_validation(self):
        """Test validation for required fields"""
        # Missing required fields
        response = requests.post(f"{BASE_URL}/api/reviews/submit", json={
            "title": "Test",
            "text": "Test text"
            # Missing rating, reviewer_name, reviewer_email
        })
        assert response.status_code == 422  # Validation error
    
    def test_submit_review_invalid_rating(self):
        """Test validation for rating range"""
        response = requests.post(f"{BASE_URL}/api/reviews/submit", json={
            "title": "Test",
            "text": "Test text",
            "rating": 6,  # Invalid - should be 1-5
            "reviewer_name": "Test",
            "reviewer_email": "test@test.com"
        })
        assert response.status_code == 422
    
    def test_cleanup_submitted_review(self, headers):
        """Clean up the submitted test review"""
        review_id = getattr(TestPublicReviewSubmission, 'submitted_review_id', None)
        if review_id:
            response = requests.delete(f"{BASE_URL}/api/reviews/{review_id}", headers=headers)
            assert response.status_code == 200


class TestFakeReviewGeneration:
    """Test fake review generation and cleanup"""
    
    def test_generate_fake_reviews(self, headers):
        """Test generating fake reviews"""
        # Generate a small batch for testing
        response = requests.post(f"{BASE_URL}/api/reviews/generate-fake?count=5", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "Generated" in data["message"]
        assert data["count"] == 5
        print(f"Generated {data['count']} fake reviews")
    
    def test_generated_reviews_are_marked_fake(self, headers):
        """Verify generated reviews are marked as fake"""
        response = requests.get(f"{BASE_URL}/api/reviews?is_fake=true&limit=5", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["reviews"]) > 0
        
        for review in data["reviews"]:
            assert review["is_fake"] == True
    
    def test_delete_all_fake_reviews(self, headers):
        """Test deleting all fake reviews"""
        # First get count of fake reviews
        response = requests.get(f"{BASE_URL}/api/reviews/stats", headers=headers)
        initial_fake_count = response.json()["fake_count"]
        
        if initial_fake_count == 0:
            pytest.skip("No fake reviews to delete")
        
        # Delete all fake reviews
        response = requests.delete(f"{BASE_URL}/api/reviews/fake/all", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "Deleted" in data["message"]
        assert data["deleted_count"] >= 0
        print(f"Deleted {data['deleted_count']} fake reviews")
        
        # Verify deletion
        response = requests.get(f"{BASE_URL}/api/reviews/stats", headers=headers)
        new_fake_count = response.json()["fake_count"]
        assert new_fake_count == 0
    
    def test_generate_requires_auth(self):
        """Test that generate endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/reviews/generate-fake?count=5")
        assert response.status_code in [401, 403]
    
    def test_delete_fake_requires_auth(self):
        """Test that delete fake endpoint requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/reviews/fake/all")
        assert response.status_code in [401, 403]


class TestReviewQuickActions:
    """Test quick action updates (approve, feature, show/hide)"""
    
    @pytest.fixture(autouse=True)
    def setup_test_review(self, headers):
        """Create a test review for quick action tests"""
        review_data = {
            "title": "TEST_Quick Action Review",
            "text": "Test review for quick action testing",
            "rating": 4,
            "reviewer_name": "Quick Test",
            "status": "pending",
            "featured": False,
            "show_on_homepage": False,
            "is_fake": True
        }
        
        response = requests.post(f"{BASE_URL}/api/reviews", json=review_data, headers=headers)
        if response.status_code == 200:
            self.review_id = response.json()["id"]
        
        yield
        
        # Cleanup
        if hasattr(self, 'review_id'):
            requests.delete(f"{BASE_URL}/api/reviews/{self.review_id}", headers=headers)
    
    def test_approve_review(self, headers):
        """Test approving a pending review"""
        if not hasattr(self, 'review_id'):
            pytest.skip("No test review created")
        
        response = requests.put(f"{BASE_URL}/api/reviews/{self.review_id}", 
                               json={"status": "approved"}, headers=headers)
        assert response.status_code == 200
    
    def test_feature_review(self, headers):
        """Test featuring a review"""
        if not hasattr(self, 'review_id'):
            pytest.skip("No test review created")
        
        response = requests.put(f"{BASE_URL}/api/reviews/{self.review_id}", 
                               json={"featured": True}, headers=headers)
        assert response.status_code == 200
    
    def test_show_on_homepage(self, headers):
        """Test showing review on homepage"""
        if not hasattr(self, 'review_id'):
            pytest.skip("No test review created")
        
        response = requests.put(f"{BASE_URL}/api/reviews/{self.review_id}", 
                               json={"show_on_homepage": True}, headers=headers)
        assert response.status_code == 200
    
    def test_reject_review(self, headers):
        """Test rejecting a review"""
        if not hasattr(self, 'review_id'):
            pytest.skip("No test review created")
        
        response = requests.put(f"{BASE_URL}/api/reviews/{self.review_id}", 
                               json={"status": "rejected"}, headers=headers)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
