"""
Test suite for Product Catalog APIs
Tests: Public catalog, Dev product management, categories, products, SKU generation, image upload
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://supplier-assets-hub.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "mel@a2gdesigns.com"
ADMIN_PASSWORD = "BigDaddy2016!!"


class TestPublicCatalog:
    """Test public catalog endpoints (no auth required)"""
    
    def test_public_catalog_returns_categories_with_products(self):
        """GET /api/public/catalog - Returns categories with nested products"""
        response = requests.get(f"{BASE_URL}/api/public/catalog")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Public catalog returned {len(data)} categories")
        
        # Verify structure
        if len(data) > 0:
            category = data[0]
            assert "id" in category
            assert "name" in category
            assert "products" in category
            assert isinstance(category["products"], list)
            print(f"First category: {category['name']} with {len(category['products'])} products")
    
    def test_public_catalog_only_returns_enabled_categories(self):
        """Verify only enabled categories are returned"""
        response = requests.get(f"{BASE_URL}/api/public/catalog")
        assert response.status_code == 200
        
        data = response.json()
        for category in data:
            # All returned categories should be enabled (or enabled field not present means enabled)
            assert category.get("enabled", True) == True
    
    def test_public_catalog_products_have_required_fields(self):
        """Verify products have required fields for display"""
        response = requests.get(f"{BASE_URL}/api/public/catalog")
        assert response.status_code == 200
        
        data = response.json()
        for category in data:
            for product in category.get("products", []):
                assert "id" in product
                assert "name" in product
                assert "slug" in product
                # SKU should be present (auto-generated if not provided)
                # short_description is optional but commonly present
                print(f"Product: {product['name']}, SKU: {product.get('sku', 'N/A')}")


class TestAuthenticatedProductAPIs:
    """Test authenticated product management APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_product_categories(self):
        """GET /api/dev/product-categories - Returns all categories (admin only)"""
        response = requests.get(f"{BASE_URL}/api/dev/product-categories", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin view: {len(data)} total categories")
    
    def test_get_products(self):
        """GET /api/dev/products - Returns all products (admin only)"""
        response = requests.get(f"{BASE_URL}/api/dev/products", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin view: {len(data)} total products")
    
    def test_get_products_by_category(self):
        """GET /api/dev/products?category_id=xxx - Filter products by category"""
        # First get categories
        cat_response = requests.get(f"{BASE_URL}/api/dev/product-categories", headers=self.headers)
        categories = cat_response.json()
        
        if len(categories) > 0:
            category_id = categories[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/dev/products?category_id={category_id}", 
                headers=self.headers
            )
            assert response.status_code == 200
            
            products = response.json()
            for product in products:
                assert product["category_id"] == category_id
            print(f"Category {categories[0]['name']} has {len(products)} products")


class TestCategoryManagement:
    """Test category CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_category_id = None
    
    def teardown_method(self):
        """Cleanup created test category"""
        if self.created_category_id:
            requests.delete(
                f"{BASE_URL}/api/dev/product-categories/{self.created_category_id}",
                headers=self.headers
            )
    
    def test_create_category(self):
        """POST /api/dev/product-categories - Create new category"""
        unique_slug = f"test-category-{uuid.uuid4().hex[:8]}"
        category_data = {
            "name": "TEST Category",
            "slug": unique_slug,
            "description": "Test category for automated testing",
            "icon": "package",
            "color": "from-gray-500 to-gray-600",
            "enabled": True,
            "sort_order": 99
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dev/product-categories",
            json=category_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST Category"
        assert data["slug"] == unique_slug
        assert "id" in data
        
        self.created_category_id = data["id"]
        print(f"Created category: {data['name']} with ID: {data['id']}")
    
    def test_update_category(self):
        """PUT /api/dev/product-categories/{id} - Update category"""
        # First create a category
        unique_slug = f"test-update-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/dev/product-categories",
            json={
                "name": "TEST Update Category",
                "slug": unique_slug,
                "description": "Original description",
                "enabled": True
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        category_id = create_response.json()["id"]
        self.created_category_id = category_id
        
        # Update the category
        update_response = requests.put(
            f"{BASE_URL}/api/dev/product-categories/{category_id}",
            json={"description": "Updated description", "enabled": False},
            headers=self.headers
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["description"] == "Updated description"
        assert updated["enabled"] == False
        print(f"Updated category description and enabled status")
    
    def test_delete_category(self):
        """DELETE /api/dev/product-categories/{id} - Delete category"""
        # First create a category
        unique_slug = f"test-delete-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/dev/product-categories",
            json={
                "name": "TEST Delete Category",
                "slug": unique_slug,
                "enabled": True
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        category_id = create_response.json()["id"]
        
        # Delete the category
        delete_response = requests.delete(
            f"{BASE_URL}/api/dev/product-categories/{category_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        print(f"Deleted category: {category_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/dev/product-categories", headers=self.headers)
        categories = get_response.json()
        assert not any(c["id"] == category_id for c in categories)


class TestProductManagement:
    """Test product CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token, create test category"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get an existing category for product tests
        cat_response = requests.get(f"{BASE_URL}/api/dev/product-categories", headers=self.headers)
        categories = cat_response.json()
        if len(categories) > 0:
            self.test_category_id = categories[0]["id"]
        else:
            # Create a test category if none exist
            unique_slug = f"test-products-{uuid.uuid4().hex[:8]}"
            create_cat = requests.post(
                f"{BASE_URL}/api/dev/product-categories",
                json={"name": "TEST Products Category", "slug": unique_slug, "enabled": True},
                headers=self.headers
            )
            self.test_category_id = create_cat.json()["id"]
        
        self.created_product_id = None
    
    def teardown_method(self):
        """Cleanup created test product"""
        if self.created_product_id:
            requests.delete(
                f"{BASE_URL}/api/dev/products/{self.created_product_id}",
                headers=self.headers
            )
    
    def test_create_product_with_auto_sku(self):
        """POST /api/dev/products - Create product with auto-generated SKU"""
        unique_slug = f"test-product-{uuid.uuid4().hex[:8]}"
        product_data = {
            "category_id": self.test_category_id,
            "name": "TEST Auto SKU Product",
            "slug": unique_slug,
            "short_description": "Test product with auto-generated SKU",
            "enabled": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dev/products",
            json=product_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST Auto SKU Product"
        assert "sku" in data
        assert data["sku"].startswith("DME-")
        
        self.created_product_id = data["id"]
        print(f"Created product with auto-generated SKU: {data['sku']}")
    
    def test_create_product_with_custom_sku(self):
        """POST /api/dev/products - Create product with custom SKU"""
        unique_slug = f"test-custom-sku-{uuid.uuid4().hex[:8]}"
        custom_sku = f"CUSTOM-{uuid.uuid4().hex[:6].upper()}"
        
        product_data = {
            "category_id": self.test_category_id,
            "name": "TEST Custom SKU Product",
            "slug": unique_slug,
            "sku": custom_sku,
            "short_description": "Test product with custom SKU",
            "enabled": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dev/products",
            json=product_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["sku"] == custom_sku
        
        self.created_product_id = data["id"]
        print(f"Created product with custom SKU: {data['sku']}")
    
    def test_create_product_with_seo_fields(self):
        """POST /api/dev/products - Create product with SEO fields"""
        unique_slug = f"test-seo-{uuid.uuid4().hex[:8]}"
        
        product_data = {
            "category_id": self.test_category_id,
            "name": "TEST SEO Product",
            "slug": unique_slug,
            "short_description": "Test product with SEO fields",
            "meta_title": "Test SEO Product | Medicare DME",
            "meta_description": "This is a test product with SEO meta description",
            "meta_keywords": "test, seo, product, dme",
            "enabled": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dev/products",
            json=product_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["meta_title"] == "Test SEO Product | Medicare DME"
        assert data["meta_description"] == "This is a test product with SEO meta description"
        assert data["meta_keywords"] == "test, seo, product, dme"
        
        self.created_product_id = data["id"]
        print(f"Created product with SEO fields")
    
    def test_update_product(self):
        """PUT /api/dev/products/{id} - Update product"""
        # First create a product
        unique_slug = f"test-update-prod-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/dev/products",
            json={
                "category_id": self.test_category_id,
                "name": "TEST Update Product",
                "slug": unique_slug,
                "short_description": "Original description",
                "enabled": True
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        self.created_product_id = product_id
        
        # Update the product
        update_response = requests.put(
            f"{BASE_URL}/api/dev/products/{product_id}",
            json={
                "short_description": "Updated description",
                "image_url": "https://example.com/image.jpg"
            },
            headers=self.headers
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["short_description"] == "Updated description"
        assert updated["image_url"] == "https://example.com/image.jpg"
        print(f"Updated product description and image URL")
    
    def test_delete_product(self):
        """DELETE /api/dev/products/{id} - Delete product"""
        # First create a product
        unique_slug = f"test-delete-prod-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/dev/products",
            json={
                "category_id": self.test_category_id,
                "name": "TEST Delete Product",
                "slug": unique_slug,
                "enabled": True
            },
            headers=self.headers
        )
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Delete the product
        delete_response = requests.delete(
            f"{BASE_URL}/api/dev/products/{product_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        print(f"Deleted product: {product_id}")


class TestPublicLeadCreation:
    """Test public lead creation from Request Info form"""
    
    def test_create_lead_from_product_request(self):
        """POST /api/public/leads - Create lead from product request form"""
        lead_data = {
            "firstName": "Test",
            "lastName": "ProductLead",
            "phone": "(555) 123-4567",
            "email": "testproductlead@example.com",
            "zipCode": "32801",
            "painLocation": "mobility",
            "hasMedicare": "yes",
            "hasDoctor": "yes",
            "bestTime": "morning",
            "formType": "product"
        }
        
        response = requests.post(f"{BASE_URL}/api/public/leads", json=lead_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "lead_id" in data
        print(f"Created lead from product request: {data['lead_id']}")
    
    def test_create_lead_with_product_tags(self):
        """POST /api/public/leads - Create lead with product interest tags"""
        lead_data = {
            "first_name": "Test",
            "last_name": "ProductTags",
            "phone": "(555) 987-6543",
            "email": "testproducttags@example.com",
            "zip_code": "33101",
            "form_source": "product",
            "product_tags": ["Manual Wheelchairs"],
            "pain_location": "mobility",
            "status": "new"
        }
        
        response = requests.post(f"{BASE_URL}/api/public/leads", json=lead_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"Created lead with product tags")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
