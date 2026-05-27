"""
Plugin Installer Backend Tests
Tests for: GET /api/plugins, POST /api/plugins/preview, POST /api/plugins/install, DELETE /api/plugins/{id}
"""
import pytest
import requests
import os

# Load BASE_URL from frontend .env if env var not set
def _get_base_url():
    url = os.environ.get('REACT_APP_BACKEND_URL', '')
    if not url:
        try:
            with open('/app/frontend/.env') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.split('=', 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip('/')

BASE_URL = _get_base_url()

# Test plugin bundle used across tests
TEST_PLUGIN_BUNDLE = {
    "id": "TEST_plugin_installer_v1",
    "name": "TEST Plugin Installer",
    "version": "1.0.0",
    "description": "Test plugin for automated testing",
    "author": "T1 Test Agent",
    "files": [
        {
            "path": "/tmp/test_plugin_file.txt",
            "action": "create",
            "content": "Hello from test plugin"
        }
    ]
}


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "mel@a2gdesigns.com",
        "password": "BigDaddy2016!!"
    })
    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("access_token") or data.get("data", {}).get("token")
        if token:
            return token
    pytest.skip(f"Auth failed - status {response.status_code}: {response.text[:200]}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Authenticated request headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def cleanup_test_plugin(auth_headers):
    """Clean up test plugin after tests complete"""
    yield
    # Cleanup: delete test plugin if it was installed
    try:
        requests.delete(f"{BASE_URL}/api/plugins/{TEST_PLUGIN_BUNDLE['id']}", headers=auth_headers)
    except Exception:
        pass


class TestPluginListEndpoint:
    """Tests for GET /api/plugins"""

    def test_get_plugins_unauthenticated(self):
        """GET /api/plugins without auth should return 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/plugins")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: GET /api/plugins unauthenticated returns {response.status_code}")

    def test_get_plugins_authenticated(self, auth_headers):
        """GET /api/plugins with auth should return {plugins: [...]}"""
        response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        data = response.json()
        assert "plugins" in data, f"Response missing 'plugins' key: {data}"
        assert isinstance(data["plugins"], list), f"Expected plugins to be a list, got {type(data['plugins'])}"
        print(f"PASS: GET /api/plugins returns plugins list with {len(data['plugins'])} items")

    def test_get_plugins_response_structure(self, auth_headers):
        """GET /api/plugins should return valid structure"""
        response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Verify no _id fields in plugins list
        for plugin in data["plugins"]:
            assert "_id" not in plugin, "Plugin should not expose MongoDB _id"
        print(f"PASS: GET /api/plugins response structure valid (no _id exposed)")


class TestPluginPreviewEndpoint:
    """Tests for POST /api/plugins/preview"""

    def test_preview_unauthenticated(self):
        """POST /api/plugins/preview without auth should return 401 or 403"""
        response = requests.post(f"{BASE_URL}/api/plugins/preview", json=TEST_PLUGIN_BUNDLE)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: POST /api/plugins/preview unauthenticated returns {response.status_code}")

    def test_preview_valid_bundle(self, auth_headers):
        """POST /api/plugins/preview with valid bundle should return preview data"""
        response = requests.post(
            f"{BASE_URL}/api/plugins/preview",
            json=TEST_PLUGIN_BUNDLE,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"
        data = response.json()
        assert data.get("valid") is True, f"Expected valid=True, got {data.get('valid')}"
        assert data.get("id") == TEST_PLUGIN_BUNDLE["id"], f"Expected id={TEST_PLUGIN_BUNDLE['id']}"
        assert data.get("name") == TEST_PLUGIN_BUNDLE["name"]
        assert data.get("version") == TEST_PLUGIN_BUNDLE["version"]
        assert "files" in data, "Response missing 'files' key"
        assert isinstance(data["files"], list), "files should be a list"
        assert len(data["files"]) == 1, f"Expected 1 file preview, got {len(data['files'])}"
        print(f"PASS: POST /api/plugins/preview returns valid preview data: {data}")

    def test_preview_file_details(self, auth_headers):
        """POST /api/plugins/preview file details should include path and action"""
        response = requests.post(
            f"{BASE_URL}/api/plugins/preview",
            json=TEST_PLUGIN_BUNDLE,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        file_preview = data["files"][0]
        assert file_preview["path"] == "/tmp/test_plugin_file.txt"
        assert file_preview["action"] == "create"
        assert "exists" in file_preview
        print(f"PASS: Preview file details correct: {file_preview}")

    def test_preview_missing_id(self, auth_headers):
        """POST /api/plugins/preview with missing id should return 400"""
        invalid_bundle = {"name": "No ID Plugin", "version": "1.0.0", "files": []}
        response = requests.post(
            f"{BASE_URL}/api/plugins/preview",
            json=invalid_bundle,
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400 for missing id, got {response.status_code}"
        print(f"PASS: POST /api/plugins/preview with missing id returns 400")

    def test_preview_already_installed_flag(self, auth_headers):
        """Preview should indicate if plugin is already installed"""
        response = requests.post(
            f"{BASE_URL}/api/plugins/preview",
            json=TEST_PLUGIN_BUNDLE,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "already_installed" in data, "Response missing 'already_installed' field"
        print(f"PASS: Preview 'already_installed' field present: {data['already_installed']}")


class TestPluginInstallEndpoint:
    """Tests for POST /api/plugins/install"""

    def test_install_unauthenticated(self):
        """POST /api/plugins/install without auth should return 401 or 403"""
        response = requests.post(f"{BASE_URL}/api/plugins/install", json=TEST_PLUGIN_BUNDLE)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: POST /api/plugins/install unauthenticated returns {response.status_code}")

    def test_install_missing_id(self, auth_headers):
        """POST /api/plugins/install with missing id should return 400"""
        invalid_bundle = {"name": "No ID Plugin", "version": "1.0.0", "files": []}
        response = requests.post(
            f"{BASE_URL}/api/plugins/install",
            json=invalid_bundle,
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400 for missing id, got {response.status_code}"
        print(f"PASS: POST /api/plugins/install with missing id returns 400")

    def test_install_valid_bundle(self, auth_headers, cleanup_test_plugin):
        """POST /api/plugins/install with valid bundle should install plugin"""
        # First ensure cleanup happens if already installed
        requests.delete(
            f"{BASE_URL}/api/plugins/{TEST_PLUGIN_BUNDLE['id']}",
            headers=auth_headers
        )
        response = requests.post(
            f"{BASE_URL}/api/plugins/install",
            json=TEST_PLUGIN_BUNDLE,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"
        data = response.json()
        assert data.get("plugin_id") == TEST_PLUGIN_BUNDLE["id"], f"Expected plugin_id={TEST_PLUGIN_BUNDLE['id']}"
        assert data.get("status") == "success", f"Expected status=success, got {data.get('status')}"
        assert "steps" in data, "Response missing 'steps' key"
        assert "files_applied" in data, "Response missing 'files_applied' key"
        assert "errors" in data, "Response missing 'errors' key"
        assert data["errors"] == 0, f"Expected 0 errors, got {data['errors']}"
        assert data["files_applied"] >= 1, f"Expected at least 1 file applied, got {data['files_applied']}"
        print(f"PASS: POST /api/plugins/install succeeds: {data}")

    def test_install_appears_in_list(self, auth_headers):
        """After installation, plugin should appear in GET /api/plugins"""
        # First check if test plugin is installed (may have been installed in previous test)
        list_response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        assert list_response.status_code == 200
        plugins = list_response.json()["plugins"]
        installed_ids = [p["id"] for p in plugins]

        if TEST_PLUGIN_BUNDLE["id"] not in installed_ids:
            # Install it first
            install_response = requests.post(
                f"{BASE_URL}/api/plugins/install",
                json=TEST_PLUGIN_BUNDLE,
                headers=auth_headers
            )
            assert install_response.status_code == 200
            # Re-check list
            list_response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
            plugins = list_response.json()["plugins"]
            installed_ids = [p["id"] for p in plugins]

        assert TEST_PLUGIN_BUNDLE["id"] in installed_ids, \
            f"Plugin {TEST_PLUGIN_BUNDLE['id']} not found in plugins list: {installed_ids}"

        # Verify plugin record structure
        installed_plugin = next(p for p in plugins if p["id"] == TEST_PLUGIN_BUNDLE["id"])
        assert installed_plugin["name"] == TEST_PLUGIN_BUNDLE["name"]
        assert installed_plugin["version"] == TEST_PLUGIN_BUNDLE["version"]
        assert installed_plugin["status"] in ["installed", "error"]
        assert "installed_at" in installed_plugin
        assert "_id" not in installed_plugin, "Plugin should not expose MongoDB _id"
        print(f"PASS: Installed plugin appears in list: {installed_plugin}")

    def test_preview_shows_already_installed(self, auth_headers):
        """After installation, preview should show already_installed=True"""
        # Make sure plugin is installed
        list_response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        plugins = list_response.json()["plugins"]
        if not any(p["id"] == TEST_PLUGIN_BUNDLE["id"] for p in plugins):
            requests.post(f"{BASE_URL}/api/plugins/install", json=TEST_PLUGIN_BUNDLE, headers=auth_headers)

        preview_response = requests.post(
            f"{BASE_URL}/api/plugins/preview",
            json=TEST_PLUGIN_BUNDLE,
            headers=auth_headers
        )
        assert preview_response.status_code == 200
        data = preview_response.json()
        assert data.get("already_installed") is True, \
            f"Expected already_installed=True after install, got {data.get('already_installed')}"
        print(f"PASS: Preview shows already_installed=True after installation")


class TestPluginDeleteEndpoint:
    """Tests for DELETE /api/plugins/{plugin_id}"""

    def test_delete_unauthenticated(self):
        """DELETE /api/plugins/{id} without auth should return 401 or 403"""
        response = requests.delete(f"{BASE_URL}/api/plugins/some-plugin-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: DELETE /api/plugins/{{id}} unauthenticated returns {response.status_code}")

    def test_delete_nonexistent_plugin(self, auth_headers):
        """DELETE /api/plugins/{id} for non-existent plugin should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/plugins/this-plugin-does-not-exist-xyz",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text[:200]}"
        print(f"PASS: DELETE /api/plugins/nonexistent returns 404")

    def test_delete_installed_plugin(self, auth_headers):
        """DELETE /api/plugins/{id} for installed plugin should uninstall and rollback"""
        # First, make sure the plugin is installed
        list_response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        plugins = list_response.json()["plugins"]
        if not any(p["id"] == TEST_PLUGIN_BUNDLE["id"] for p in plugins):
            install_response = requests.post(
                f"{BASE_URL}/api/plugins/install",
                json=TEST_PLUGIN_BUNDLE,
                headers=auth_headers
            )
            assert install_response.status_code == 200, "Failed to install plugin for delete test"

        # Now delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/plugins/{TEST_PLUGIN_BUNDLE['id']}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, \
            f"Expected 200 for delete, got {delete_response.status_code}: {delete_response.text[:200]}"
        data = delete_response.json()
        assert data.get("plugin_id") == TEST_PLUGIN_BUNDLE["id"]
        assert data.get("status") == "uninstalled"
        assert "rollback_steps" in data
        print(f"PASS: DELETE /api/plugins/{{id}} returns uninstalled: {data}")

    def test_delete_plugin_removed_from_list(self, auth_headers):
        """After deletion, plugin should not appear in GET /api/plugins"""
        # First ensure it's installed
        list_response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        plugins = list_response.json()["plugins"]
        if not any(p["id"] == TEST_PLUGIN_BUNDLE["id"] for p in plugins):
            requests.post(f"{BASE_URL}/api/plugins/install", json=TEST_PLUGIN_BUNDLE, headers=auth_headers)

        # Delete the plugin
        requests.delete(
            f"{BASE_URL}/api/plugins/{TEST_PLUGIN_BUNDLE['id']}",
            headers=auth_headers
        )

        # Verify it's gone
        final_list_response = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        assert final_list_response.status_code == 200
        final_plugins = final_list_response.json()["plugins"]
        installed_ids = [p["id"] for p in final_plugins]
        assert TEST_PLUGIN_BUNDLE["id"] not in installed_ids, \
            f"Plugin still in list after deletion: {installed_ids}"
        print(f"PASS: Plugin removed from list after deletion")


class TestPluginEndToEndFlow:
    """End-to-end: Preview → Install → Verify → Delete"""

    def test_full_lifecycle(self, auth_headers):
        """Test complete plugin lifecycle: empty list → preview → install → list verify → delete → empty list"""
        plugin_id = "TEST_e2e_lifecycle_plugin"
        bundle = {
            "id": plugin_id,
            "name": "TEST E2E Lifecycle Plugin",
            "version": "2.0.0",
            "description": "End-to-end lifecycle test plugin",
            "files": [
                {
                    "path": "/tmp/e2e_test_plugin.txt",
                    "action": "create",
                    "content": "E2E test content"
                }
            ]
        }

        # Cleanup first (in case of previous failed run)
        requests.delete(f"{BASE_URL}/api/plugins/{plugin_id}", headers=auth_headers)

        # 1. Preview
        preview_resp = requests.post(f"{BASE_URL}/api/plugins/preview", json=bundle, headers=auth_headers)
        assert preview_resp.status_code == 200, f"Preview failed: {preview_resp.text[:200]}"
        preview_data = preview_resp.json()
        assert preview_data["valid"] is True
        assert preview_data["already_installed"] is False
        print(f"PASS: E2E Step 1 - Preview: valid={preview_data['valid']}, already_installed={preview_data['already_installed']}")

        # 2. Install
        install_resp = requests.post(f"{BASE_URL}/api/plugins/install", json=bundle, headers=auth_headers)
        assert install_resp.status_code == 200, f"Install failed: {install_resp.text[:200]}"
        install_data = install_resp.json()
        assert install_data["status"] == "success"
        print(f"PASS: E2E Step 2 - Install: status={install_data['status']}, files_applied={install_data['files_applied']}")

        # 3. Verify appears in list
        list_resp = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        assert list_resp.status_code == 200
        plugins = list_resp.json()["plugins"]
        assert any(p["id"] == plugin_id for p in plugins), f"Plugin not in list after install"
        print(f"PASS: E2E Step 3 - Plugin in list ({len(plugins)} total plugins)")

        # 4. Verify already_installed=True in preview
        preview2_resp = requests.post(f"{BASE_URL}/api/plugins/preview", json=bundle, headers=auth_headers)
        assert preview2_resp.json()["already_installed"] is True
        print(f"PASS: E2E Step 4 - Preview shows already_installed=True")

        # 5. Delete/Uninstall
        delete_resp = requests.delete(f"{BASE_URL}/api/plugins/{plugin_id}", headers=auth_headers)
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text[:200]}"
        assert delete_resp.json()["status"] == "uninstalled"
        print(f"PASS: E2E Step 5 - Delete: status={delete_resp.json()['status']}")

        # 6. Verify removed from list
        final_list_resp = requests.get(f"{BASE_URL}/api/plugins", headers=auth_headers)
        final_plugins = final_list_resp.json()["plugins"]
        assert not any(p["id"] == plugin_id for p in final_plugins), "Plugin still in list after delete"
        print(f"PASS: E2E Step 6 - Plugin removed from list")

        print(f"PASS: Full lifecycle test passed!")
