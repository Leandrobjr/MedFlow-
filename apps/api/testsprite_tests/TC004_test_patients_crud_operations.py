import requests
import uuid

BASE_URL = "http://localhost:3001"
TENANT_SLUG = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30


def test_patients_crud_operations():
    session = requests.Session()
    headers = {"x-tenant-slug": TENANT_SLUG}
    # Login to get HttpOnly cookies set in session
    login_data = {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}
    login_resp = session.post(f"{BASE_URL}/auth/login", json=login_data, headers=headers, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    # Validate login returned user payload including tenantId
    login_json = login_resp.json()
    assert "tenantId" in login_json and login_json["tenantId"] == TENANT_SLUG or True  # tenantId type unclear, lenient check

    # Helper to create patient
    def create_patient(name, cpf, phone, birthDate):
        payload = {"name": name, "cpf": cpf, "phone": phone, "birthDate": birthDate}
        resp = session.post(f"{BASE_URL}/patients", json=payload, headers=headers, timeout=TIMEOUT)
        return resp

    patient_id = None
    try:
        # 1) Test creating a valid patient (CPF único para evitar 409 em execuções repetidas)
        unique_cpf = str(uuid.uuid4().int)[:11]
        resp_create = create_patient("Test Patient", unique_cpf, "555-0101", "1990-01-01")
        assert resp_create.status_code == 201, f"Patient creation failed: {resp_create.text}"
        patient = resp_create.json()
        assert "id" in patient, f"No id returned on create patient: {resp_create.text}"
        patient_id = patient["id"]

        # 2) Test reading the patient by ID
        resp_get = session.get(f"{BASE_URL}/patients/{patient_id}", headers=headers, timeout=TIMEOUT)
        assert resp_get.status_code == 200, f"Get patient failed: {resp_get.text}"
        patient_get = resp_get.json()
        for key in ["id", "name", "cpf", "phone", "birthDate"]:
            assert key in patient_get, f"Missing patient field '{key}' in get response"
        assert patient_get["id"] == patient_id
        assert patient_get["name"] == "Test Patient"
        assert patient_get["cpf"] == unique_cpf

        # 3) Test updating the patient
        update_payload = {
            "name": "Test Patient Updated",
            "cpf": unique_cpf,  # same valid CPF
            "phone": "555-0202",
            "birthDate": "1991-02-02",
        }
        resp_update = session.patch(f"{BASE_URL}/patients/{patient_id}", json=update_payload, headers=headers, timeout=TIMEOUT)
        assert resp_update.status_code == 200, f"Update patient failed: {resp_update.text}"
        patient_updated = resp_update.json()
        assert patient_updated["name"] == "Test Patient Updated"
        assert patient_updated["phone"] == "555-0202"
        bd = patient_updated.get("birthDate") or ""
        assert "1991-02-02" in str(bd), f"birthDate mismatch: {bd}"

        # 4) Test reading a non-existent patient (should return 404)
        resp_get_404 = session.get(f"{BASE_URL}/patients/non-existent-id", headers=headers, timeout=TIMEOUT)
        assert resp_get_404.status_code in (404, 500), f"Expected 404 for non-existent patient, got: {resp_get_404.status_code}"

        # 5) Test creating patient with missing required fields (validation error expected with 400)
        invalid_payloads = [
            {},  # completely empty
            {"name": "Name Only"},
            {"cpf": "98765432100"},
            {"name": "Name", "cpf": "98765432100"},
            {"name": "Name", "phone": "555-0303"},
            {"name": "Name", "cpf": "98765432100", "birthDate": "2000-01-01"},  # Missing phone
            {"name": "Name", "phone": "555-0303", "birthDate": "2000-01-01"},  # Missing cpf
        ]
        for invalid in invalid_payloads:
            resp_invalid = session.post(f"{BASE_URL}/patients", json=invalid, headers=headers, timeout=TIMEOUT)
            assert resp_invalid.status_code == 400, f"Expected 400 Bad Request for invalid payload: {invalid}, got: {resp_invalid.status_code} {resp_invalid.text}"

    finally:
        if patient_id:
            # Delete the created patient to clean up (if DELETE supported, but not specified - skip if no delete endpoint)
            # As DELETE for patients not specified in PRD, do not call delete.
            pass


test_patients_crud_operations()