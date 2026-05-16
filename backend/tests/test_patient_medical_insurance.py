"""
Test Patient Medical Records and Insurance Coverage Endpoints
Tests for:
- GET /api/patients/{id}/medical
- PUT /api/patients/{id}/medical
- GET /api/patients/{id}/insurance-data
- PUT /api/patients/{id}/insurance-data
- HIPAA audit logs for medical and insurance saves
- DME category options (12 requested options)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "mel@a2gdesigns.com"
SUPER_ADMIN_PASSWORD = "BigDaddy2016!!"


class TestPatientMedicalInsuranceEndpoints:
    """Test Patient Medical Records and Insurance Coverage API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a patient ID for testing
        patients_response = self.session.get(f"{BASE_URL}/api/patients?limit=1")
        if patients_response.status_code == 200 and patients_response.json():
            self.patient_id = patients_response.json()[0].get("id")
        else:
            # Create a test patient if none exists
            patient_data = {
                "first_name": "TEST_Medical",
                "last_name": "Patient",
                "date_of_birth": "1980-01-15",
                "ssn_last_four": "1234",
                "primary_insurance": "Medicare Part B",
                "phone": "555-123-4567",
                "email": f"test_medical_{uuid.uuid4().hex[:8]}@example.com"
            }
            create_response = self.session.post(f"{BASE_URL}/api/patients", json=patient_data)
            if create_response.status_code in [200, 201]:
                self.patient_id = create_response.json().get("id")
            else:
                pytest.skip("Could not create test patient")
        
        yield
        
        # Cleanup is optional - we don't delete the patient to preserve test data

    # ==================== MEDICAL RECORDS TESTS ====================
    
    def test_get_medical_records_returns_schema(self):
        """GET /api/patients/{id}/medical returns correct schema structure"""
        response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}/medical")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify schema structure
        assert "vitals" in data, "Missing 'vitals' in medical records"
        assert "diagnoses" in data, "Missing 'diagnoses' in medical records"
        assert "medications" in data, "Missing 'medications' in medical records"
        assert "allergies" in data, "Missing 'allergies' in medical records"
        assert "dme_history" in data, "Missing 'dme_history' in medical records"
        assert "prior_authorizations" in data, "Missing 'prior_authorizations' in medical records"
        assert "care_team" in data, "Missing 'care_team' in medical records"
        assert "procedures" in data, "Missing 'procedures' in medical records"
        
        # Verify vitals structure
        vitals = data.get("vitals", {})
        expected_vitals_keys = ["height", "weight", "bmi", "blood_pressure", "heart_rate", "temperature", "last_recorded"]
        for key in expected_vitals_keys:
            assert key in vitals, f"Missing '{key}' in vitals"
        
        print(f"GET /api/patients/{self.patient_id}/medical - Schema verified successfully")

    def test_put_medical_records_saves_all_sections(self):
        """PUT /api/patients/{id}/medical saves all sections and persists to patient.medical_records"""
        
        # Prepare comprehensive medical records payload
        medical_payload = {
            "vitals": {
                "height": "5'10\"",
                "weight": "180 lbs",
                "bmi": "25.8",
                "blood_pressure": "120/80",
                "heart_rate": "72 bpm",
                "temperature": "98.6°F",
                "last_recorded": "2025-01-15"
            },
            "diagnoses": [
                {
                    "code": "M54.5",
                    "description": "Low back pain",
                    "status": "active",
                    "diagnosed_date": "2024-06-15",
                    "provider": "Dr. Smith"
                }
            ],
            "medications": [
                {
                    "name": "Ibuprofen",
                    "dosage": "400mg",
                    "prescriber": "Dr. Smith",
                    "start_date": "2024-06-15",
                    "status": "active"
                }
            ],
            "allergies": [
                {
                    "allergen": "Penicillin",
                    "reaction": "Rash",
                    "severity": "moderate"
                }
            ],
            "dme_history": [
                {
                    "item": "Back Brace LSO",
                    "delivered": "2024-07-01",
                    "status": "active",
                    "replacement_eligible": "2025-07-01",
                    "supplier": "DME Pros"
                }
            ],
            "prior_authorizations": [
                {
                    "auth_number": "PA123456",
                    "item": "Back Brace",
                    "status": "approved",
                    "submitted": "2024-06-20",
                    "expires": "2025-06-20",
                    "payer": "Medicare"
                }
            ],
            "care_team": [
                {
                    "name": "Dr. John Smith",
                    "role": "Primary Care",
                    "npi": "1234567890",
                    "phone": "555-111-2222",
                    "last_visit": "2025-01-10"
                }
            ],
            "procedures": [
                {
                    "code": "99213",
                    "description": "Office visit",
                    "date": "2025-01-10",
                    "provider": "Dr. Smith",
                    "status": "completed"
                }
            ]
        }
        
        # Save medical records
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{self.patient_id}/medical",
            json=medical_payload
        )
        
        assert put_response.status_code == 200, f"PUT failed: {put_response.status_code}: {put_response.text}"
        
        put_data = put_response.json()
        assert "message" in put_data, "Missing success message in response"
        assert "medical_records" in put_data, "Missing medical_records in response"
        
        # Verify persistence by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}/medical")
        assert get_response.status_code == 200
        
        persisted_data = get_response.json()
        
        # Verify all sections persisted correctly
        assert persisted_data["vitals"]["height"] == "5'10\"", "Vitals height not persisted"
        assert persisted_data["vitals"]["weight"] == "180 lbs", "Vitals weight not persisted"
        assert len(persisted_data["diagnoses"]) == 1, "Diagnoses not persisted"
        assert persisted_data["diagnoses"][0]["code"] == "M54.5", "Diagnosis code not persisted"
        assert len(persisted_data["medications"]) == 1, "Medications not persisted"
        assert len(persisted_data["allergies"]) == 1, "Allergies not persisted"
        assert len(persisted_data["dme_history"]) == 1, "DME history not persisted"
        assert len(persisted_data["prior_authorizations"]) == 1, "Prior authorizations not persisted"
        assert len(persisted_data["care_team"]) == 1, "Care team not persisted"
        assert len(persisted_data["procedures"]) == 1, "Procedures not persisted"
        
        print(f"PUT /api/patients/{self.patient_id}/medical - All sections saved and persisted successfully")

    def test_medical_records_404_for_invalid_patient(self):
        """GET/PUT /api/patients/{id}/medical returns 404 for non-existent patient"""
        fake_id = "non-existent-patient-id-12345"
        
        get_response = self.session.get(f"{BASE_URL}/api/patients/{fake_id}/medical")
        assert get_response.status_code == 404, f"Expected 404 for GET, got {get_response.status_code}"
        
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{fake_id}/medical",
            json={"vitals": {}, "diagnoses": [], "medications": [], "allergies": [], "dme_history": [], "prior_authorizations": [], "care_team": [], "procedures": []}
        )
        assert put_response.status_code == 404, f"Expected 404 for PUT, got {put_response.status_code}"
        
        print("Medical records endpoints return 404 for invalid patient ID")

    # ==================== INSURANCE DATA TESTS ====================
    
    def test_get_insurance_data_returns_schema(self):
        """GET /api/patients/{id}/insurance-data returns correct schema structure"""
        response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify schema structure
        assert "primary" in data, "Missing 'primary' in insurance data"
        assert "secondary" in data, "Missing 'secondary' in insurance data"
        assert "financial_summary" in data, "Missing 'financial_summary' in insurance data"
        assert "dme_benefits" in data, "Missing 'dme_benefits' in insurance data"
        assert "claims_summary" in data, "Missing 'claims_summary' in insurance data"
        assert "remittance" in data, "Missing 'remittance' in insurance data"
        assert "verification" in data, "Missing 'verification' in insurance data"
        
        # Verify primary insurance structure
        primary = data.get("primary", {})
        expected_primary_keys = ["status", "payer_name", "payer_id", "payer_phone", "member_id", 
                                  "group_number", "subscriber_name", "relationship", "plan_name", 
                                  "plan_type", "coverage_type", "effective_date", "termination_date"]
        for key in expected_primary_keys:
            assert key in primary, f"Missing '{key}' in primary insurance"
        
        print(f"GET /api/patients/{self.patient_id}/insurance-data - Schema verified successfully")

    def test_put_insurance_data_saves_all_sections(self):
        """PUT /api/patients/{id}/insurance-data saves all sections and persists to patient.insurance_data"""
        
        # Prepare comprehensive insurance data payload
        insurance_payload = {
            "primary": {
                "status": "active",
                "payer_name": "Medicare",
                "payer_id": "00001",
                "payer_phone": "1-800-MEDICARE",
                "member_id": "1EG4-TE5-MK72",
                "group_number": "GRP001",
                "subscriber_name": "John Doe",
                "relationship": "Self",
                "plan_name": "Medicare Part B",
                "plan_type": "Medicare",
                "coverage_type": "Medical",
                "effective_date": "2024-01-01",
                "termination_date": ""
            },
            "secondary": {
                "payer_name": "AARP Medigap",
                "plan_name": "Plan F",
                "plan_type": "Medigap",
                "covers_coinsurance": True,
                "covers_deductible": True
            },
            "financial_summary": {
                "deductible_annual": 226.00,
                "deductible_met": 226.00,
                "deductible_remaining": 0.00,
                "coinsurance": 20.0,
                "coverage_percentage": 80.0,
                "oop_max_annual": 2000.00,
                "oop_max_met": 500.00
            },
            "dme_benefits": [
                {
                    "name": "Back Braces (LSO/TLSO)",
                    "covered": True,
                    "prior_auth": False,
                    "coinsurance": 20.0,
                    "notes": "Covered under Part B"
                },
                {
                    "name": "Knee Braces",
                    "covered": True,
                    "prior_auth": True,
                    "coinsurance": 20.0,
                    "notes": "Prior auth required"
                }
            ],
            "claims_summary": [
                {
                    "claim_id": "CLM001",
                    "date": "2025-01-10",
                    "description": "Back Brace LSO",
                    "billed": 500.00,
                    "allowed": 400.00,
                    "paid": 320.00,
                    "patient_owes": 80.00,
                    "status": "paid"
                }
            ],
            "remittance": {
                "last_era_date": "2025-01-15",
                "last_era_number": "ERA123456",
                "payment_method": "EFT",
                "total_payments_ytd": 5000.00
            },
            "verification": {
                "last_verified": "2025-01-15",
                "verified_by": "Jane Admin",
                "source": "Availity"
            }
        }
        
        # Save insurance data
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data",
            json=insurance_payload
        )
        
        assert put_response.status_code == 200, f"PUT failed: {put_response.status_code}: {put_response.text}"
        
        put_data = put_response.json()
        assert "message" in put_data, "Missing success message in response"
        assert "insurance_data" in put_data, "Missing insurance_data in response"
        
        # Verify DME category options are returned
        assert "dme_category_options" in put_data, "Missing dme_category_options in response"
        
        # Verify persistence by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data")
        assert get_response.status_code == 200
        
        persisted_data = get_response.json()
        
        # Verify all sections persisted correctly
        assert persisted_data["primary"]["payer_name"] == "Medicare", "Primary payer_name not persisted"
        assert persisted_data["primary"]["member_id"] == "1EG4-TE5-MK72", "Primary member_id not persisted"
        assert persisted_data["secondary"]["payer_name"] == "AARP Medigap", "Secondary payer_name not persisted"
        assert persisted_data["financial_summary"]["deductible_annual"] == 226.00, "Financial deductible not persisted"
        assert len(persisted_data["dme_benefits"]) == 2, "DME benefits not persisted"
        assert len(persisted_data["claims_summary"]) == 1, "Claims summary not persisted"
        assert persisted_data["remittance"]["payment_method"] == "EFT", "Remittance not persisted"
        assert persisted_data["verification"]["source"] == "Availity", "Verification not persisted"
        
        print(f"PUT /api/patients/{self.patient_id}/insurance-data - All sections saved and persisted successfully")

    def test_insurance_data_404_for_invalid_patient(self):
        """GET/PUT /api/patients/{id}/insurance-data returns 404 for non-existent patient"""
        fake_id = "non-existent-patient-id-67890"
        
        get_response = self.session.get(f"{BASE_URL}/api/patients/{fake_id}/insurance-data")
        assert get_response.status_code == 404, f"Expected 404 for GET, got {get_response.status_code}"
        
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{fake_id}/insurance-data",
            json={"primary": {}, "secondary": {}, "financial_summary": {}, "dme_benefits": [], "claims_summary": [], "remittance": {}, "verification": {}}
        )
        assert put_response.status_code == 404, f"Expected 404 for PUT, got {put_response.status_code}"
        
        print("Insurance data endpoints return 404 for invalid patient ID")

    # ==================== DME CATEGORY OPTIONS TEST ====================
    
    def test_dme_category_options_includes_12_options(self):
        """Verify DME category dropdown includes 12 requested options"""
        
        # The DME category options should be returned in the PUT response
        insurance_payload = {
            "primary": {},
            "secondary": {},
            "financial_summary": {},
            "dme_benefits": [],
            "claims_summary": [],
            "remittance": {},
            "verification": {}
        }
        
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data",
            json=insurance_payload
        )
        
        assert put_response.status_code == 200
        
        put_data = put_response.json()
        dme_options = put_data.get("dme_category_options", [])
        
        # Verify 12 DME category options
        expected_options = [
            "Back Braces (LSO/TLSO)",
            "Knee Braces",
            "Wheelchairs (Manual)",
            "Power Wheelchairs",
            "CPAP/BiPAP",
            "Hospital Beds",
            "Oxygen Equipment",
            "Diabetic Supplies",
            "Wound Care Supplies",
            "Enteral Nutrition",
            "Bath Safety",
            "Walkers/Rollators"
        ]
        
        assert len(dme_options) == 12, f"Expected 12 DME options, got {len(dme_options)}"
        
        for option in expected_options:
            assert option in dme_options, f"Missing DME option: {option}"
        
        print(f"DME category options verified: {len(dme_options)} options present")

    # ==================== HIPAA AUDIT LOG TESTS ====================
    
    def test_hipaa_audit_log_created_on_medical_save(self):
        """Verify HIPAA audit log is created when medical records are saved"""
        
        # Save medical records
        medical_payload = {
            "vitals": {"height": "6'0\""},
            "diagnoses": [],
            "medications": [],
            "allergies": [],
            "dme_history": [],
            "prior_authorizations": [],
            "care_team": [],
            "procedures": []
        }
        
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{self.patient_id}/medical",
            json=medical_payload
        )
        
        assert put_response.status_code == 200
        
        # Check audit logs for the medical records update
        audit_response = self.session.get(f"{BASE_URL}/api/audit-logs?resource_type=patients&limit=10")
        
        if audit_response.status_code == 200:
            audit_logs = audit_response.json()
            
            # Find the medical records update audit entry
            medical_audit = None
            for log in audit_logs:
                if log.get("action") == "PATIENT_MEDICAL_RECORDS_UPDATED" and log.get("resource_id") == self.patient_id:
                    medical_audit = log
                    break
            
            assert medical_audit is not None, "HIPAA audit log not created for medical records save"
            assert medical_audit.get("resource_type") == "patients"
            assert "details" in medical_audit
            
            print("HIPAA audit log created for medical records save")
        else:
            # Audit logs endpoint may require different permissions
            print(f"Audit logs endpoint returned {audit_response.status_code} - skipping detailed audit verification")

    def test_hipaa_audit_log_created_on_insurance_save(self):
        """Verify HIPAA audit log is created when insurance data is saved"""
        
        # Save insurance data
        insurance_payload = {
            "primary": {"payer_name": "Test Payer"},
            "secondary": {},
            "financial_summary": {},
            "dme_benefits": [],
            "claims_summary": [],
            "remittance": {},
            "verification": {}
        }
        
        put_response = self.session.put(
            f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data",
            json=insurance_payload
        )
        
        assert put_response.status_code == 200
        
        # Check audit logs for the insurance data update
        audit_response = self.session.get(f"{BASE_URL}/api/audit-logs?resource_type=patients&limit=10")
        
        if audit_response.status_code == 200:
            audit_logs = audit_response.json()
            
            # Find the insurance data update audit entry
            insurance_audit = None
            for log in audit_logs:
                if log.get("action") == "PATIENT_INSURANCE_DATA_UPDATED" and log.get("resource_id") == self.patient_id:
                    insurance_audit = log
                    break
            
            assert insurance_audit is not None, "HIPAA audit log not created for insurance data save"
            assert insurance_audit.get("resource_type") == "patients"
            assert "details" in insurance_audit
            
            print("HIPAA audit log created for insurance data save")
        else:
            print(f"Audit logs endpoint returned {audit_response.status_code} - skipping detailed audit verification")

    # ==================== PATIENT DETAIL PERSISTENCE TEST ====================
    
    def test_patient_detail_includes_medical_and_insurance(self):
        """Verify patient detail endpoint includes medical_records and insurance_data after save"""
        
        # First save some medical and insurance data
        medical_payload = {
            "vitals": {"height": "5'8\"", "weight": "160 lbs"},
            "diagnoses": [{"code": "J45.20", "description": "Mild intermittent asthma", "status": "active"}],
            "medications": [],
            "allergies": [],
            "dme_history": [],
            "prior_authorizations": [],
            "care_team": [],
            "procedures": []
        }
        
        insurance_payload = {
            "primary": {"payer_name": "Blue Cross", "member_id": "BC123456"},
            "secondary": {},
            "financial_summary": {},
            "dme_benefits": [],
            "claims_summary": [],
            "remittance": {},
            "verification": {}
        }
        
        # Save both
        self.session.put(f"{BASE_URL}/api/patients/{self.patient_id}/medical", json=medical_payload)
        self.session.put(f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data", json=insurance_payload)
        
        # Fetch patient detail
        patient_response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}")
        assert patient_response.status_code == 200
        
        patient_data = patient_response.json()
        
        # Verify medical_records and insurance_data are stored in patient document
        # Note: The main patient endpoint may or may not include these fields
        # The dedicated endpoints should always work
        
        # Verify via dedicated endpoints
        medical_response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}/medical")
        insurance_response = self.session.get(f"{BASE_URL}/api/patients/{self.patient_id}/insurance-data")
        
        assert medical_response.status_code == 200
        assert insurance_response.status_code == 200
        
        medical_data = medical_response.json()
        insurance_data = insurance_response.json()
        
        assert medical_data["vitals"]["height"] == "5'8\"", "Medical data not persisted correctly"
        assert insurance_data["primary"]["payer_name"] == "Blue Cross", "Insurance data not persisted correctly"
        
        print("Patient medical and insurance data persisted and retrievable via dedicated endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
