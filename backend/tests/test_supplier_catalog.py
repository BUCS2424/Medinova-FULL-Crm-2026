"""
Test Suite for DME Supplier and Product Catalog Features
Tests:
- POST /api/dev/seed-suppliers - Seeds default DME suppliers
- POST /api/dev/products/generate-full-catalog - Generates catalog with supplier associations
- GET /api/products/by-supplier/{supplier_id} - Gets products for a specific supplier
- GET /api/products/{product_id}/suppliers - Gets suppliers for a specific product
- GET /api/suppliers - Lists all suppliers
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mel@a2gdesigns.com"
TEST_PASSWORD = "BigDaddy2016!!"


class TestSupplierCatalogFeatures:
    """Test suite for supplier and catalog management features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ==================== SUPPLIER TESTS ====================
    
    def test_get_suppliers_list(self):
        """Test GET /api/suppliers - List all suppliers"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If suppliers exist, verify structure
        if len(data) > 0:
            supplier = data[0]
            assert "id" in supplier, "Supplier should have 'id'"
            assert "name" in supplier, "Supplier should have 'name'"
            assert "is_active" in supplier, "Supplier should have 'is_active'"
            print(f"✓ Found {len(data)} suppliers")
        else:
            print("⚠ No suppliers found - may need to seed first")
    
    def test_seed_default_suppliers(self):
        """Test POST /api/dev/seed-suppliers - Seeds default DME suppliers"""
        response = self.session.post(f"{BASE_URL}/api/dev/seed-suppliers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message'"
        assert "created" in data or "skipped_existing" in data, "Response should have creation stats"
        
        # Verify total suppliers count
        assert "total_suppliers" in data, "Response should have 'total_suppliers'"
        assert data["total_suppliers"] == 10, f"Expected 10 default suppliers, got {data['total_suppliers']}"
        
        # Verify supplier_ids map is returned
        assert "supplier_ids" in data, "Response should have 'supplier_ids' map"
        
        print(f"✓ Seed suppliers: created={data.get('created', 0)}, skipped={data.get('skipped_existing', 0)}")
    
    def test_suppliers_have_expected_names(self):
        """Verify all 10 default suppliers exist with correct names"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        
        assert response.status_code == 200
        
        suppliers = response.json()
        supplier_names = [s["name"] for s in suppliers]
        
        expected_suppliers = [
            "NikoHealth DME",
            "DDP Medical Supplies",
            "McKesson Medical-Surgical",
            "Medline Industries",
            "Rotech Healthcare",
            "AdaptHealth",
            "Byram Healthcare",
            "National Seating & Mobility",
            "Hanger Clinic",
            "Apria Healthcare"
        ]
        
        for expected_name in expected_suppliers:
            assert expected_name in supplier_names, f"Missing supplier: {expected_name}"
        
        print(f"✓ All 10 expected suppliers found")
    
    def test_supplier_has_product_tags(self):
        """Verify newly seeded suppliers have product_tags field"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        
        assert response.status_code == 200
        
        suppliers = response.json()
        
        # Check at least one supplier has product_tags
        suppliers_with_tags = [s for s in suppliers if s.get("product_tags") and len(s["product_tags"]) > 0]
        
        assert len(suppliers_with_tags) > 0, "At least one supplier should have product_tags"
        
        # Verify Rotech Healthcare has expected tags (newly seeded supplier)
        rotech = next((s for s in suppliers if s["name"] == "Rotech Healthcare"), None)
        if rotech:
            expected_tags = ["respiratory", "oxygen", "cpap", "ventilators"]
            for tag in expected_tags:
                assert tag in rotech.get("product_tags", []), f"Rotech Healthcare missing tag: {tag}"
        
        print(f"✓ {len(suppliers_with_tags)} suppliers have product_tags")
    
    # ==================== CATALOG GENERATION TESTS ====================
    
    def test_generate_full_catalog(self):
        """Test POST /api/dev/products/generate-full-catalog - Generates catalog with supplier associations"""
        response = self.session.post(f"{BASE_URL}/api/dev/products/generate-full-catalog")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message'"
        assert "Catalog generation complete" in data["message"], f"Unexpected message: {data['message']}"
        
        # Verify catalog stats
        assert "total_catalog_categories" in data, "Response should have 'total_catalog_categories'"
        assert data["total_catalog_categories"] >= 17, f"Expected at least 17 categories, got {data['total_catalog_categories']}"
        
        assert "total_catalog_products" in data, "Response should have 'total_catalog_products'"
        assert data["total_catalog_products"] >= 140, f"Expected at least 140 products, got {data['total_catalog_products']}"
        
        assert "total_suppliers_linked" in data, "Response should have 'total_suppliers_linked'"
        
        print(f"✓ Catalog generated: {data.get('created_categories', 0)} categories, {data.get('created_products', 0)} products")
    
    def test_catalog_has_new_categories(self):
        """Verify the 5 new categories exist: CPAP/BiPAP Accessories, Urology/Ostomy, Pediatric DME, Bariatric Equipment, Pain Management"""
        response = self.session.get(f"{BASE_URL}/api/dev/product-categories")
        
        assert response.status_code == 200
        
        categories = response.json()
        category_names = [c["name"] for c in categories]
        
        new_categories = [
            "CPAP/BiPAP Accessories",
            "Urology / Ostomy",
            "Pediatric DME",
            "Bariatric Equipment",
            "Pain Management / Therapeutic"
        ]
        
        for cat_name in new_categories:
            assert cat_name in category_names, f"Missing new category: {cat_name}"
        
        print(f"✓ All 5 new categories found")
    
    def test_products_have_supplier_ids(self):
        """Verify newly generated products have supplier_ids array populated"""
        response = self.session.get(f"{BASE_URL}/api/dev/products")
        
        assert response.status_code == 200
        
        products = response.json()
        
        # Count products with supplier_ids
        products_with_suppliers = [p for p in products if p.get("supplier_ids") and len(p["supplier_ids"]) > 0]
        
        # At least some products should have suppliers (newly generated ones)
        # Note: Products created before catalog generation won't have supplier_ids
        assert len(products_with_suppliers) >= 20, \
            f"Expected at least 20 products to have suppliers, got {len(products_with_suppliers)}"
        
        # Verify supplier_ids is a list of valid UUIDs
        for product in products_with_suppliers[:5]:
            assert isinstance(product["supplier_ids"], list)
            for sid in product["supplier_ids"]:
                assert isinstance(sid, str) and len(sid) > 10, f"Invalid supplier_id format: {sid}"
        
        print(f"✓ {len(products_with_suppliers)}/{len(products)} products have supplier associations")
    
    # ==================== PRODUCT-SUPPLIER RELATIONSHIP TESTS ====================
    
    def test_get_products_by_supplier(self):
        """Test GET /api/products/by-supplier/{supplier_id} - Gets products for a specific supplier"""
        # First get a supplier ID
        suppliers_response = self.session.get(f"{BASE_URL}/api/suppliers")
        assert suppliers_response.status_code == 200
        
        suppliers = suppliers_response.json()
        if len(suppliers) == 0:
            pytest.skip("No suppliers available for testing")
        
        # Use NikoHealth DME as test supplier (should have many products)
        nikohealth = next((s for s in suppliers if s["name"] == "NikoHealth DME"), suppliers[0])
        supplier_id = nikohealth["id"]
        
        # Get products for this supplier
        response = self.session.get(f"{BASE_URL}/api/products/by-supplier/{supplier_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "supplier" in data, "Response should have 'supplier'"
        assert "products" in data, "Response should have 'products'"
        assert "total_products" in data, "Response should have 'total_products'"
        
        # Verify supplier info
        assert data["supplier"]["id"] == supplier_id
        assert data["supplier"]["name"] == nikohealth["name"]
        
        # Verify products list
        assert isinstance(data["products"], list)
        assert data["total_products"] == len(data["products"])
        
        print(f"✓ Supplier '{nikohealth['name']}' has {data['total_products']} products")
    
    def test_get_products_by_supplier_not_found(self):
        """Test GET /api/products/by-supplier/{supplier_id} with invalid ID returns 404"""
        response = self.session.get(f"{BASE_URL}/api/products/by-supplier/invalid-supplier-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Invalid supplier ID returns 404")
    
    def test_get_suppliers_for_product(self):
        """Test GET /api/products/{product_id}/suppliers - Gets suppliers for a specific product"""
        # First get a product that has suppliers
        products_response = self.session.get(f"{BASE_URL}/api/dev/products")
        assert products_response.status_code == 200
        
        products = products_response.json()
        
        # Find a product with supplier_ids
        product_with_suppliers = next(
            (p for p in products if p.get("supplier_ids") and len(p["supplier_ids"]) > 0),
            None
        )
        
        if not product_with_suppliers:
            pytest.skip("No products with suppliers available for testing")
        
        product_id = product_with_suppliers["id"]
        
        # Get suppliers for this product
        response = self.session.get(f"{BASE_URL}/api/products/{product_id}/suppliers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "product" in data, "Response should have 'product'"
        assert "suppliers" in data, "Response should have 'suppliers'"
        assert "total_suppliers" in data, "Response should have 'total_suppliers'"
        
        # Verify product info
        assert data["product"]["id"] == product_id
        
        # Verify suppliers list
        assert isinstance(data["suppliers"], list)
        assert data["total_suppliers"] == len(data["suppliers"])
        assert data["total_suppliers"] > 0, "Product should have at least one supplier"
        
        # Verify supplier structure
        if len(data["suppliers"]) > 0:
            supplier = data["suppliers"][0]
            assert "id" in supplier
            assert "name" in supplier
            assert "api_key" not in supplier, "API key should not be exposed"
        
        print(f"✓ Product '{product_with_suppliers['name']}' has {data['total_suppliers']} suppliers")
    
    def test_get_suppliers_for_product_not_found(self):
        """Test GET /api/products/{product_id}/suppliers with invalid ID returns 404"""
        response = self.session.get(f"{BASE_URL}/api/products/invalid-product-id-12345/suppliers")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Invalid product ID returns 404")
    
    # ==================== CROSS-VALIDATION TESTS ====================
    
    def test_supplier_product_relationship_consistency(self):
        """Verify bidirectional consistency: if product has supplier, supplier should list product"""
        # Get all suppliers
        suppliers_response = self.session.get(f"{BASE_URL}/api/suppliers")
        assert suppliers_response.status_code == 200
        suppliers = suppliers_response.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available")
        
        # Pick a supplier
        test_supplier = suppliers[0]
        supplier_id = test_supplier["id"]
        
        # Get products for this supplier
        products_response = self.session.get(f"{BASE_URL}/api/products/by-supplier/{supplier_id}")
        assert products_response.status_code == 200
        
        products_data = products_response.json()
        products = products_data.get("products", [])
        
        if len(products) == 0:
            print(f"⚠ Supplier '{test_supplier['name']}' has no products - skipping consistency check")
            return
        
        # For each product, verify the supplier is listed
        for product in products[:5]:  # Check first 5 products
            product_suppliers_response = self.session.get(f"{BASE_URL}/api/products/{product['id']}/suppliers")
            assert product_suppliers_response.status_code == 200
            
            product_suppliers = product_suppliers_response.json().get("suppliers", [])
            supplier_ids_in_product = [s["id"] for s in product_suppliers]
            
            assert supplier_id in supplier_ids_in_product, \
                f"Product '{product['name']}' should list supplier '{test_supplier['name']}'"
        
        print(f"✓ Bidirectional relationship verified for {min(5, len(products))} products")
    
    def test_cpap_accessories_category_products(self):
        """Verify CPAP/BiPAP Accessories category has expected products"""
        # Get categories
        categories_response = self.session.get(f"{BASE_URL}/api/dev/product-categories")
        assert categories_response.status_code == 200
        
        categories = categories_response.json()
        cpap_category = next((c for c in categories if "CPAP" in c["name"]), None)
        
        if not cpap_category:
            pytest.skip("CPAP/BiPAP Accessories category not found")
        
        # Get products in this category
        products_response = self.session.get(f"{BASE_URL}/api/dev/products")
        assert products_response.status_code == 200
        
        products = products_response.json()
        cpap_products = [p for p in products if p.get("category_id") == cpap_category["id"]]
        
        expected_products = [
            "CPAP Masks - Full Face",
            "CPAP Masks - Nasal",
            "CPAP Tubing",
            "CPAP Filters"
        ]
        
        cpap_product_names = [p["name"] for p in cpap_products]
        
        for expected in expected_products:
            assert expected in cpap_product_names, f"Missing CPAP product: {expected}"
        
        print(f"✓ CPAP/BiPAP Accessories category has {len(cpap_products)} products")
    
    def test_product_count_per_category(self):
        """Verify each category has products"""
        # Get categories
        categories_response = self.session.get(f"{BASE_URL}/api/dev/product-categories")
        assert categories_response.status_code == 200
        categories = categories_response.json()
        
        # Get all products
        products_response = self.session.get(f"{BASE_URL}/api/dev/products")
        assert products_response.status_code == 200
        products = products_response.json()
        
        empty_categories = []
        for category in categories:
            cat_products = [p for p in products if p.get("category_id") == category["id"]]
            if len(cat_products) == 0:
                empty_categories.append(category["name"])
        
        # Allow some empty categories (might be manually created)
        if len(empty_categories) > 0:
            print(f"⚠ Categories without products: {empty_categories}")
        
        # At least 80% of categories should have products
        categories_with_products = len(categories) - len(empty_categories)
        assert categories_with_products >= len(categories) * 0.8, \
            f"Expected at least 80% of categories to have products"
        
        print(f"✓ {categories_with_products}/{len(categories)} categories have products")


class TestPublicCatalogEndpoints:
    """Test public catalog endpoints (no auth required)"""
    
    def test_public_product_categories(self):
        """Test GET /api/public/product-categories - Public access"""
        response = requests.get(f"{BASE_URL}/api/public/product-categories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        categories = response.json()
        assert isinstance(categories, list)
        
        # Only enabled categories should be returned
        for cat in categories:
            assert cat.get("enabled", True) == True, "Public endpoint should only return enabled categories"
        
        print(f"✓ Public categories endpoint returns {len(categories)} enabled categories")
    
    def test_public_products(self):
        """Test GET /api/public/products - Public access"""
        response = requests.get(f"{BASE_URL}/api/public/products")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        products = response.json()
        assert isinstance(products, list)
        
        # Only enabled products should be returned
        for prod in products:
            assert prod.get("enabled", True) == True, "Public endpoint should only return enabled products"
        
        print(f"✓ Public products endpoint returns {len(products)} enabled products")
    
    def test_public_catalog(self):
        """Test GET /api/public/catalog - Full catalog with categories and products"""
        response = requests.get(f"{BASE_URL}/api/public/catalog")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        catalog = response.json()
        assert isinstance(catalog, list)
        
        # Each category should have products array
        for cat in catalog:
            assert "products" in cat, "Each category should have 'products' array"
            assert isinstance(cat["products"], list)
        
        total_products = sum(len(cat["products"]) for cat in catalog)
        print(f"✓ Public catalog: {len(catalog)} categories, {total_products} total products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
