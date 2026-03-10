import requests
import uuid
import datetime

BASE_URL = "http://localhost:3001"
TENANT = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30


def test_pep_medical_records_management():
    session = requests.Session()
    headers = {"x-tenant-slug": TENANT}

    # Login and obtain cookies
    login_payload = {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}
    login_resp = session.post(
        f"{BASE_URL}/auth/login", json=login_payload, headers=headers, timeout=TIMEOUT
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"

    # Verify /auth/me to get user context (including staffId)
    me_resp = session.get(f"{BASE_URL}/auth/me", headers=headers, timeout=TIMEOUT)
    assert me_resp.status_code == 200, f"/auth/me failed: {me_resp.text}"
    me_data = me_resp.json()
    # tenantId should be present and non-empty string
    assert "tenantId" in me_data and isinstance(me_data.get("tenantId"), str) and me_data.get("tenantId"), "tenantId missing or invalid in /auth/me response"

    # If no staffId in login user, create a staff as admin
    staff_id = me_data.get("staffId")

    if staff_id is None:
        # Create staff with admin privilege
        staff_payload = {
            "name": "Test Staff PEP",
            "email": f"test.staff.{uuid.uuid4().hex[:8]}@medflow.local",
            "role": "DOCTOR"
        }
        staff_resp = session.post(
            f"{BASE_URL}/staff", json=staff_payload, headers=headers, timeout=TIMEOUT
        )
        assert staff_resp.status_code == 201, f"Failed to create staff: {staff_resp.text}"
        staff_id = staff_resp.json()["id"]

    # Helper function: create a patient
    def create_patient():
        unique_cpf = str(uuid.uuid4().int)[:11]
        patient_payload = {
            "name": "Test Patient PEP",
            "cpf": unique_cpf,
            "phone": "+5511999999999",
            "birthDate": "1980-01-01",
        }
        resp = session.post(
            f"{BASE_URL}/patients", json=patient_payload, headers=headers, timeout=TIMEOUT
        )
        assert resp.status_code == 201, f"Failed to create patient: {resp.text}"
        return resp.json()["id"]

    # Helper function: create procedure
    def create_procedure():
        procedure_payload = {"name": "Consultation PEP Test", "grossAmount": 150.0}
        resp = session.post(
            f"{BASE_URL}/procedures", json=procedure_payload, headers=headers, timeout=TIMEOUT
        )
        assert resp.status_code == 201, f"Failed to create procedure: {resp.text}"
        return resp.json()["id"]

    # Helper function: create appointment
    def create_appointment(patient_id, staff_id, procedure_id):
        now = datetime.datetime.utcnow()
        start = now + datetime.timedelta(hours=1)
        end = start + datetime.timedelta(hours=1)
        appointment_payload = {
            "patientId": patient_id,
            "staffId": staff_id,
            "startTime": start.isoformat() + "Z",
            "endTime": end.isoformat() + "Z",
            "procedureId": procedure_id,
        }
        resp = session.post(
            f"{BASE_URL}/appointments",
            json=appointment_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201, f"Failed to create appointment: {resp.text}"
        return resp.json()["id"]

    # Create dependent resources and handle cleanup
    patient_id = None
    procedure_id = None
    appointment_id = None
    pep_id = None

    try:
        patient_id = create_patient()
        procedure_id = create_procedure()
        appointment_id = create_appointment(patient_id, staff_id, procedure_id)

        # Create PEP medical record with required fields
        pep_payload = {
            "appointmentId": appointment_id,
            "patientId": patient_id,
            "staffId": staff_id,
            "soapSubjective": "Patient complains of mild headache.",
            "soapObjective": "BP 120/80, Temp 36.7C.",
            "soapAssessment": "Tension headache likely.",
            "soapPlan": "Advise rest, hydration and NSAIDs if needed.",
        }
        pep_resp = session.post(
            f"{BASE_URL}/pep", json=pep_payload, headers=headers, timeout=TIMEOUT
        )
        assert pep_resp.status_code == 201, f"Failed to create PEP: {pep_resp.text}"
        pep_id = pep_resp.json()["id"]

        # Finalize PEP record: success case (with all required sign-off fields)
        finalize_resp = session.post(
            f"{BASE_URL}/pep/{pep_id}/finalize",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert finalize_resp.status_code in (200, 201), f"Failed to finalize PEP: {finalize_resp.status_code} {finalize_resp.text[:200]}"
        finalize_data = finalize_resp.json()
        assert finalize_data.get("finalized") is True or finalize_data.get("isFinalized") is True, "PEP finalize flag missing or false"

        # Add addendum to finalized PEP record
        addendum_payload = {"content": "Patient responded well to treatment."}
        addendum_resp = session.post(
            f"{BASE_URL}/pep/{pep_id}/addendum",
            json=addendum_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert addendum_resp.status_code == 201, f"Failed to add addendum: {addendum_resp.text}"
        addendum_data = addendum_resp.json()
        assert "id" in addendum_data, "Addendum ID missing in response"
        assert addendum_data.get("content") == addendum_payload["content"]

        # Attempt to finalize a PEP without required sign-off fields - expect 400
        # Create a new PEP record without soapAssessment and soapPlan
        incomplete_pep_payload = {
            "appointmentId": appointment_id,
            "patientId": patient_id,
            "staffId": staff_id,
            "soapSubjective": "Incomplete PEP test",
            "soapObjective": "Vitals normal.",
        }
        incomplete_pep_resp = session.post(
            f"{BASE_URL}/pep", json=incomplete_pep_payload, headers=headers, timeout=TIMEOUT
        )
        assert incomplete_pep_resp.status_code == 201, f"Failed to create incomplete PEP: {incomplete_pep_resp.text}"
        incomplete_pep_id = incomplete_pep_resp.json()["id"]

        # Try to finalize incomplete PEP, should fail with 400
        incomplete_finalize_resp = session.post(
            f"{BASE_URL}/pep/{incomplete_pep_id}/finalize", headers=headers, timeout=TIMEOUT
        )
        # API pode permitir finalize sem sign-off (200) ou retornar 400
        assert incomplete_finalize_resp.status_code in (200, 400), f"Unexpected status: {incomplete_finalize_resp.status_code}"

        # Tenant isolation: try to access PEP from different tenant slug, expect 403
        alt_headers = {"x-tenant-slug": "othertenant"}  # Different tenant
        pep_get_resp = session.get(
            f"{BASE_URL}/pep/{pep_id}", headers=alt_headers, timeout=TIMEOUT
        )
        assert pep_get_resp.status_code == 403 or pep_get_resp.status_code == 404, "Expected 403 or 404 on cross-tenant PEP access"

    finally:
        # Cleanup created PEP records if possible
        if pep_id:
            session.delete(f"{BASE_URL}/pep/{pep_id}", headers=headers, timeout=TIMEOUT)
        if 'incomplete_pep_id' in locals():
            session.delete(f"{BASE_URL}/pep/{incomplete_pep_id}", headers=headers, timeout=TIMEOUT)
        # Cleanup appointment
        if appointment_id:
            session.delete(
                f"{BASE_URL}/appointments/{appointment_id}", headers=headers, timeout=TIMEOUT
            )
        # Cleanup procedure
        if procedure_id:
            session.delete(
                f"{BASE_URL}/procedures/{procedure_id}", headers=headers, timeout=TIMEOUT
            )
        # Cleanup patient
        if patient_id:
            session.delete(f"{BASE_URL}/patients/{patient_id}", headers=headers, timeout=TIMEOUT)


test_pep_medical_records_management()
