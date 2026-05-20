#!/usr/bin/env python3
"""
Backend API Testing for DME PROS CRM
Tests core authentication and dashboard functionality
"""

import requests
import sys
from datetime import datetime

# Public endpoint from frontend/.env
API_URL = "https://supplier-assets-hub.preview.emergentagent.com"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "mel@a2gdesigns.com"
TEST_PASSWORD = "BigDaddy2016!!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class DMEAPITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []

    def log_success(self, message):
        print(f"{Colors.GREEN}✓{Colors.RESET} {message}")

    def log_error(self, message):
        print(f"{Colors.RED}✗{Colors.RESET} {message}")

    def log_info(self, message):
        print(f"{Colors.BLUE}ℹ{Colors.RESET} {message}")

    def log_warning(self, message):
        print(f"{Colors.YELLOW}⚠{Colors.RESET} {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{API_URL}{endpoint}"
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        
        if self.token and 'Authorization' not in headers:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n{Colors.BLUE}[{self.tests_run}] Testing: {name}{Colors.RESET}")
        print(f"   Endpoint: {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log_success(f"Status: {response.status_code} (Expected: {expected_status})")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                self.tests_failed += 1
                self.failed_tests.append({
                    'name': name,
                    'endpoint': endpoint,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                self.log_error(f"Status: {response.status_code} (Expected: {expected_status})")
                self.log_error(f"Response: {response.text[:200]}")
                return False, {}

        except requests.exceptions.Timeout:
            self.tests_failed += 1
            self.failed_tests.append({
                'name': name,
                'endpoint': endpoint,
                'error': 'Request timeout (10s)'
            })
            self.log_error(f"Request timeout after 10 seconds")
            return False, {}
        except requests.exceptions.ConnectionError as e:
            self.tests_failed += 1
            self.failed_tests.append({
                'name': name,
                'endpoint': endpoint,
                'error': f'Connection error: {str(e)}'
            })
            self.log_error(f"Connection error: {str(e)}")
            return False, {}
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append({
                'name': name,
                'endpoint': endpoint,
                'error': str(e)
            })
            self.log_error(f"Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test login with super admin credentials"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}AUTHENTICATION TESTS{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        success, response = self.run_test(
            "Login with super admin credentials",
            "POST",
            "/api/auth/login",
            200,
            data={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log_success(f"Token obtained: {self.token[:20]}...")
            
            # Verify user data in response
            if 'user' in response:
                user = response['user']
                self.log_info(f"User: {user.get('first_name')} {user.get('last_name')}")
                self.log_info(f"Email: {user.get('email')}")
                self.log_info(f"Role: {user.get('role')}")
                
                if user.get('role') == 'super_admin':
                    self.log_success("User has super_admin role")
                else:
                    self.log_warning(f"User role is {user.get('role')}, expected super_admin")
            
            return True
        else:
            self.log_error("Failed to obtain access token")
            return False

    def test_current_user(self):
        """Test getting current user info"""
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get current user info",
            "GET",
            "/api/auth/me",
            200
        )
        
        if success:
            self.log_info(f"User ID: {response.get('id')}")
            self.log_info(f"Email: {response.get('email')}")
            self.log_info(f"Role: {response.get('role')}")
        
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}DASHBOARD TESTS{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get dashboard statistics",
            "GET",
            "/api/dashboard/stats",
            200
        )
        
        if success:
            # Check for expected data structure
            if 'totals' in response:
                totals = response['totals']
                self.log_info(f"Total Patients: {totals.get('patients', 0)}")
                self.log_info(f"Total Leads: {totals.get('leads', 0)}")
                self.log_info(f"Total Orders: {totals.get('orders', 0)}")
                self.log_info(f"Total Suppliers: {totals.get('suppliers', 0)}")
            
            if 'sales' in response:
                sales = response['sales']
                self.log_info(f"Today's Sales: ${sales.get('today', {}).get('amount', 0)}")
                self.log_info(f"This Week's Sales: ${sales.get('week', {}).get('amount', 0)}")
                self.log_info(f"This Month's Sales: ${sales.get('month', {}).get('amount', 0)}")
            
            if 'leads_by_status' in response:
                leads = response['leads_by_status']
                self.log_info(f"New Leads: {leads.get('new', 0)}")
                self.log_info(f"Qualified Leads: {leads.get('qualified', 0)}")
            
            if 'orders_by_status' in response:
                orders = response['orders_by_status']
                self.log_info(f"Pending Orders: {orders.get('pending', 0)}")
                self.log_info(f"Confirmed Orders: {orders.get('confirmed', 0)}")
        
        return success

    def test_patients_list(self):
        """Test patients list endpoint"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}PATIENT MANAGEMENT TESTS{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get patients list",
            "GET",
            "/api/patients?limit=10",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log_info(f"Retrieved {len(response)} patients")
            else:
                self.log_warning("Unexpected response format")
        
        return success

    def test_leads_list(self):
        """Test leads (patient requests) list endpoint"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}PATIENT REQUESTS (LEADS) TESTS{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get patient requests list",
            "GET",
            "/api/leads?limit=10",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log_info(f"Retrieved {len(response)} patient requests")
            else:
                self.log_warning("Unexpected response format")
        
        return success

    def test_orders_list(self):
        """Test orders list endpoint"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}ORDERS TESTS{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get orders list",
            "GET",
            "/api/orders?limit=10",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log_info(f"Retrieved {len(response)} orders")
            else:
                self.log_warning("Unexpected response format")
        
        return success

    def test_documents_list(self):
        """Test documents list endpoint"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}DOCUMENTS TESTS{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get documents list",
            "GET",
            "/api/documents?limit=10",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log_info(f"Retrieved {len(response)} documents")
            else:
                self.log_warning("Unexpected response format")
        
        return success

    def test_suppliers_list(self):
        """Test suppliers list endpoint"""
        if not self.token:
            self.log_warning("Skipping - no auth token available")
            return False
        
        success, response = self.run_test(
            "Get suppliers list",
            "GET",
            "/api/suppliers",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log_info(f"Retrieved {len(response)} suppliers")
            else:
                self.log_warning("Unexpected response format")
        
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"\nTotal Tests: {self.tests_run}")
        print(f"{Colors.GREEN}Passed: {self.tests_passed}{Colors.RESET}")
        print(f"{Colors.RED}Failed: {self.tests_failed}{Colors.RESET}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print(f"\n{Colors.RED}Failed Tests:{Colors.RESET}")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"\n{i}. {test['name']}")
                print(f"   Endpoint: {test.get('endpoint', 'N/A')}")
                if 'expected' in test:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
                if 'error' in test:
                    print(f"   Error: {test['error']}")
                if 'response' in test:
                    print(f"   Response: {test['response']}")
        
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def main():
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}DME PROS CRM - Backend API Testing{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"API URL: {API_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = DMEAPITester()
    
    # Run authentication tests
    if not tester.test_login():
        print(f"\n{Colors.RED}Login failed - cannot proceed with other tests{Colors.RESET}")
        tester.print_summary()
        return 1
    
    tester.test_current_user()
    
    # Run dashboard tests
    tester.test_dashboard_stats()
    
    # Run resource tests
    tester.test_patients_list()
    tester.test_leads_list()
    tester.test_orders_list()
    tester.test_documents_list()
    tester.test_suppliers_list()
    
    # Print summary
    tester.print_summary()
    
    # Return exit code based on results
    return 0 if tester.tests_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
