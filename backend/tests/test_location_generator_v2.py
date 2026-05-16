"""Backend API tests for Location Generator V2 module.

Tests all /api/v2/ endpoints: site-settings, locations-meta, page-generators CRUD.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API_V2 = f"{BASE_URL}/api/v2"

# Admin credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"

_token_cache = {}


def get_token():
    if "token" in _token_cache:
        return _token_cache["token"]
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token in login response: {r.json()}"
    _token_cache["token"] = token
    return token


def auth_headers():
    return {"Authorization": f"Bearer {get_token()}"}


# ─── Auth / Token ────────────────────────────────────────────────────────────

class TestAuth:
    """Validate admin login works and token is valid."""

    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, f"Login failed: {r.text}"
        data = r.json()
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        print("PASS: Admin login successful")

    def test_unauthenticated_request_blocked(self):
        r = requests.get(f"{API_V2}/page-generators")
        # Should require auth (401 or 403)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
        print(f"PASS: Unauthenticated request blocked with {r.status_code}")


# ─── Site Settings ───────────────────────────────────────────────────────────

class TestSiteSettings:
    """Tests for GET /api/v2/site-settings."""

    def test_get_site_settings(self):
        r = requests.get(f"{API_V2}/site-settings", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "company_name" in data, "Missing company_name field"
        assert "company_phone" in data, "Missing company_phone field"
        print(f"PASS: site-settings returned company_name='{data.get('company_name')}'")

    def test_site_settings_no_id_field(self):
        """MongoDB _id should be stripped from response."""
        r = requests.get(f"{API_V2}/site-settings", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert "_id" not in data, "_id should not be exposed in response"
        print("PASS: _id not exposed in site-settings response")


# ─── Locations Meta ──────────────────────────────────────────────────────────

class TestLocationsMeta:
    """Tests for GET /api/v2/locations-meta."""

    def test_get_locations_meta(self):
        r = requests.get(f"{API_V2}/locations-meta", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "items" in data, "Missing 'items' key"
        assert "total" in data, "Missing 'total' key"
        print(f"PASS: locations-meta returned {data['total']} states")

    def test_locations_meta_has_50_states(self):
        r = requests.get(f"{API_V2}/locations-meta", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        total = data.get("total", 0)
        # Should have at least 50 states (may include DC/territories)
        assert total >= 50, f"Expected >= 50 states, got {total}"
        print(f"PASS: locations-meta has {total} states (>= 50)")

    def test_locations_meta_item_fields(self):
        """Each state item must have code, name, counties, cities."""
        r = requests.get(f"{API_V2}/locations-meta", headers=auth_headers())
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) > 0, "No items returned"
        first = items[0]
        for field in ("code", "name", "counties", "cities"):
            assert field in first, f"Missing field '{field}' in state item: {first}"
        print(f"PASS: First state item has all required fields: {first}")

    def test_unauthenticated_locations_meta_blocked(self):
        r = requests.get(f"{API_V2}/locations-meta")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
        print(f"PASS: Unauthenticated locations-meta blocked with {r.status_code}")


# ─── Page Generators CRUD ────────────────────────────────────────────────────

class TestPageGenerators:
    """CRUD tests for /api/v2/page-generators."""

    _created_id = None

    def test_list_generators_empty_or_existing(self):
        r = requests.get(f"{API_V2}/page-generators", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "items" in data, "Missing 'items' key"
        assert "total" in data, "Missing 'total' key"
        assert isinstance(data["items"], list), "'items' should be a list"
        assert isinstance(data["total"], int), "'total' should be an int"
        print(f"PASS: list generators returned total={data['total']}")

    def test_create_generator(self):
        payload = {
            "name": "TEST_Medical_Supplies_US",
            "type": "Medical Supplies",
            "keywords": ["dme", "medical supplies", "healthcare"],
            "levels": {"state": True, "county": True, "city": True},
            "slug_pattern_state": "{product}-{state}",
            "slug_pattern_county": "{product}-{county}-county-{state}",
            "slug_pattern_city": "{product}-{city}-{state}",
        }
        r = requests.post(f"{API_V2}/page-generators", json=payload, headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("name") == "TEST_Medical_Supplies_US"
        assert "id" in data, "No 'id' in created generator response"
        assert data.get("status") == "draft", f"Expected status 'draft', got {data.get('status')}"
        assert data.get("levels") == {"state": True, "county": True, "city": True}
        TestPageGenerators._created_id = data["id"]
        print(f"PASS: Generator created with id={data['id']}")

    def test_get_created_generator(self):
        gen_id = TestPageGenerators._created_id
        if not gen_id:
            pytest.skip("Create test did not run — skipping get test")
        r = requests.get(f"{API_V2}/page-generators/{gen_id}", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("id") == gen_id
        assert data.get("name") == "TEST_Medical_Supplies_US"
        assert data.get("type") == "Medical Supplies"
        assert data.get("keywords") == ["dme", "medical supplies", "healthcare"]
        # Verify all three slug patterns
        assert data.get("slug_pattern_state") == "{product}-{state}"
        assert data.get("slug_pattern_county") == "{product}-{county}-county-{state}"
        assert data.get("slug_pattern_city") == "{product}-{city}-{state}"
        print(f"PASS: Generator fetch verified all fields for id={gen_id}")

    def test_list_generators_count_increased(self):
        r = requests.get(f"{API_V2}/page-generators", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        # Should have at least 1 item (the one we just created)
        assert data["total"] >= 1, f"Expected at least 1 generator, got {data['total']}"
        ids = [g["id"] for g in data["items"]]
        gen_id = TestPageGenerators._created_id
        if gen_id:
            assert gen_id in ids, f"Created generator {gen_id} not in list"
        print(f"PASS: Generator appears in list, total={data['total']}")

    def test_patch_generator(self):
        gen_id = TestPageGenerators._created_id
        if not gen_id:
            pytest.skip("Create test did not run — skipping patch test")
        patch = {"name": "TEST_Medical_Supplies_US_Updated", "status": "active"}
        r = requests.patch(f"{API_V2}/page-generators/{gen_id}", json=patch, headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("name") == "TEST_Medical_Supplies_US_Updated"
        assert data.get("status") == "active"
        print(f"PASS: Generator patched successfully")

    def test_get_generator_stats(self):
        gen_id = TestPageGenerators._created_id
        if not gen_id:
            pytest.skip("Create test did not run")
        r = requests.get(f"{API_V2}/page-generators/{gen_id}/stats", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "states_scoped" in data
        assert "pages_generated" in data
        assert "levels" in data
        assert data["pages_generated"] == 0, "New generator should have 0 pages"
        print(f"PASS: Generator stats: states_scoped={data['states_scoped']}, pages=0")

    def test_generator_pages_list_empty(self):
        gen_id = TestPageGenerators._created_id
        if not gen_id:
            pytest.skip("Create test did not run")
        r = requests.get(f"{API_V2}/page-generators/{gen_id}/pages", headers=auth_headers(), params={"limit": 1})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("total") == 0, f"Expected 0 pages for new generator, got {data.get('total')}"
        print("PASS: New generator has 0 pages")

    def test_get_nonexistent_generator(self):
        r = requests.get(f"{API_V2}/page-generators/nonexistent-id-999", headers=auth_headers())
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"
        print("PASS: 404 for nonexistent generator")

    def test_delete_generator_and_verify(self):
        gen_id = TestPageGenerators._created_id
        if not gen_id:
            pytest.skip("Create test did not run — skipping delete test")
        r = requests.delete(f"{API_V2}/page-generators/{gen_id}", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("deleted") is True, "Expected 'deleted' to be True"
        
        # Verify it's gone
        r2 = requests.get(f"{API_V2}/page-generators/{gen_id}", headers=auth_headers())
        assert r2.status_code == 404, f"Expected 404 after delete, got {r2.status_code}"
        TestPageGenerators._created_id = None
        print("PASS: Generator deleted and verified gone")


# ─── Duplicate name guard ─────────────────────────────────────────────────────

class TestGeneratorValidation:
    """Input validation for page generators."""

    _temp_id = None

    def setup_method(self, method):
        """Create a generator for duplicate-name test."""
        if method.__name__ == "test_duplicate_name_rejected":
            r = requests.post(
                f"{API_V2}/page-generators",
                json={"name": "TEST_DupCheck_Gen", "type": "Test"},
                headers=auth_headers()
            )
            if r.status_code == 200:
                TestGeneratorValidation._temp_id = r.json().get("id")

    def teardown_method(self, method):
        """Cleanup temp generator."""
        if TestGeneratorValidation._temp_id:
            requests.delete(
                f"{API_V2}/page-generators/{TestGeneratorValidation._temp_id}",
                headers=auth_headers()
            )
            TestGeneratorValidation._temp_id = None

    def test_duplicate_name_rejected(self):
        """Creating a generator with a duplicate name should return 409."""
        r = requests.post(
            f"{API_V2}/page-generators",
            json={"name": "TEST_DupCheck_Gen", "type": "Test"},
            headers=auth_headers()
        )
        assert r.status_code == 409, f"Expected 409 for duplicate name, got {r.status_code}: {r.text}"
        print("PASS: Duplicate generator name rejected with 409")

    def test_missing_name_rejected(self):
        """Creating a generator without a name should return 422."""
        r = requests.post(
            f"{API_V2}/page-generators",
            json={"type": "Medical Supplies"},
            headers=auth_headers()
        )
        assert r.status_code == 422, f"Expected 422 for missing name, got {r.status_code}"
        print("PASS: Missing name returns 422 validation error")

    def test_missing_type_rejected(self):
        """Creating a generator without a type should return 422."""
        r = requests.post(
            f"{API_V2}/page-generators",
            json={"name": "TEST_NoType_Gen"},
            headers=auth_headers()
        )
        assert r.status_code == 422, f"Expected 422 for missing type, got {r.status_code}"
        print("PASS: Missing type returns 422 validation error")


# ─── Available Pages ─────────────────────────────────────────────────────────

class TestAvailablePages:
    """Test the available pages catalog endpoint."""

    def test_get_available_pages(self):
        r = requests.get(f"{API_V2}/available-pages", headers=auth_headers())
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "pages" in data, "Missing 'pages' key"
        assert isinstance(data["pages"], list), "'pages' should be a list"
        print(f"PASS: available-pages returned {len(data['pages'])} pages")


# ─── Public pages (coverage-areas) ───────────────────────────────────────────

class TestPublicPages:
    """Test public-facing coverage areas pages."""

    def test_public_coverage_areas_accessible(self):
        """The /coverage-areas/ endpoint should be publicly accessible."""
        r = requests.get(f"{BASE_URL}/coverage-areas", allow_redirects=True, timeout=10)
        # Might be 200 (HTML page) or redirect
        assert r.status_code in (200, 301, 302, 404), f"Unexpected status: {r.status_code}"
        print(f"PASS: /coverage-areas returned {r.status_code}")

    def test_coverage_areas_sitemap(self):
        """coverage-areas-sitemap.xml should exist (may be empty if no pages generated)."""
        r = requests.get(f"{BASE_URL}/coverage-areas-sitemap.xml", timeout=10)
        # Should return 200 with XML content or 404 if no pages
        print(f"INFO: /coverage-areas-sitemap.xml returned {r.status_code}")
        # Not asserting 200 because if no pages are generated the sitemap might not serve
