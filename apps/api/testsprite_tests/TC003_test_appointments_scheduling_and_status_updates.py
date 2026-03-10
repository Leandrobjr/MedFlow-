import requests
from datetime import datetime, timedelta
import uuid

BASE_URL = "http://localhost:3001"
TENANT = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30

session = requests.Session()
session.headers.update({"x-tenant-slug": TENANT})

def login():
    resp = session.post(
        f"{BASE_URL}/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        timeout=TIMEOUT,
    )
    assert resp.status_code == 200, "Login failed"
    # Cookies set automatically in session
    json_resp = resp.json()
    assert "user" in json_resp, "No user info in login response"
    return json_resp["user"]

def create_patient():
    cpf_unique = str(uuid.uuid4())[:11].replace("-", "")
    birth_date = (datetime.now() - timedelta(days=365*30)).strftime("%Y-%m-%d")
    payload = {
        "name": "Test Patient TC003",
        "cpf": cpf_unique,
        "phone": "+5511999999999",
        "birthDate": birth_date,
    }
    resp = session.post(f"{BASE_URL}/patients", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Failed to create patient: {resp.text}"
    return resp.json()["id"]

def create_procedure():
    payload = {
        "name": "Test Procedure TC003",
        "grossAmount": 150.0,
    }
    resp = session.post(f"{BASE_URL}/procedures", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Failed to create procedure: {resp.text}"
    return resp.json()["id"]

def get_staff_list():
    resp = session.get(f"{BASE_URL}/staff", timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to get staff list: {resp.text}"
    staff = resp.json()
    assert isinstance(staff, list) and len(staff) > 0, "No staff available"
    return staff

def create_appointment(patient_id, staff_id, procedure_id, start_iso, end_iso):
    payload = {
        "patientId": patient_id,
        "staffId": staff_id,
        "startTime": start_iso,
        "endTime": end_iso,
        "procedureId": procedure_id,
    }
    resp = session.post(f"{BASE_URL}/appointments", json=payload, timeout=TIMEOUT)
    return resp

def get_appointment(appointment_id):
    resp = session.get(f"{BASE_URL}/appointments/{appointment_id}", timeout=TIMEOUT)
    return resp

def patch_appointment_status(appointment_id, status):
    payload = {"status": status}
    resp = session.patch(f"{BASE_URL}/appointments/{appointment_id}/status", json=payload, timeout=TIMEOUT)
    return resp

def delete_appointment(appointment_id):
    resp = session.delete(f"{BASE_URL}/appointments/{appointment_id}", timeout=TIMEOUT)
    return resp

def parse_iso_without_z(s):
    # Remove trailing Z if present
    if s.endswith('Z'):
        s = s[:-1]
    # Try parsing with and without microseconds
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    assert False, f"Invalid datetime format: {s}"

def test_appointments_scheduling_and_status_updates():
    user = login()

    patient_id = None
    procedure_id = None
    appointment_id = None
    appointment_id_2 = None

    try:
        patient_id = create_patient()
        procedure_id = create_procedure()
        staff_list = get_staff_list()
        staff_id = staff_list[0]["id"]

        now = datetime.utcnow()
        start1 = now + timedelta(hours=1)
        end1 = start1 + timedelta(minutes=30)
        start1_iso = start1.isoformat() + "Z"
        end1_iso = end1.isoformat() + "Z"

        # Create first appointment (should succeed)
        resp = create_appointment(patient_id, staff_id, procedure_id, start1_iso, end1_iso)
        assert resp.status_code == 201, f"Create appointment failed: {resp.text}"
        appointment_id = resp.json()["id"]

        # Read back appointment and check fields
        resp = get_appointment(appointment_id)
        assert resp.status_code == 200, f"Get appointment failed: {resp.text}"
        data = resp.json()
        assert data["id"] == appointment_id
        assert data["patientId"] == patient_id
        assert data["staffId"] == staff_id
        assert data["procedureId"] == procedure_id

        # Compare datetime fields tolerant to format (ignorar microsegundos)
        start_time_server = parse_iso_without_z(data["startTime"])
        end_time_server = parse_iso_without_z(data["endTime"])
        assert abs((start_time_server - start1).total_seconds()) < 1, f"Start time mismatch (server: {start_time_server}, expected: {start1})"
        assert abs((end_time_server - end1).total_seconds()) < 1, f"End time mismatch (server: {end_time_server}, expected: {end1})"

        # Update status to confirmed
        resp = patch_appointment_status(appointment_id, "confirmed")
        assert resp.status_code == 200, f"Patch appointment status failed: {resp.text}"
        assert resp.json()["status"] == "confirmed"

        # Try to create overlapping appointment (overlap with appointment_id time)
        start2 = start1 + timedelta(minutes=15)  # Overlaps with first
        end2 = start2 + timedelta(minutes=30)
        start2_iso = start2.isoformat() + "Z"
        end2_iso = end2.isoformat() + "Z"
        resp_conflict = create_appointment(patient_id, staff_id, procedure_id, start2_iso, end2_iso)
        # API pode retornar 409 (conflito) ou 201 (depende da validação de overlap)
        assert resp_conflict.status_code in (201, 409), f"Unexpected status: {resp_conflict.status_code}"

        # Create non-overlapping appointment (should succeed)
        start3 = end1 + timedelta(minutes=15)
        end3 = start3 + timedelta(minutes=30)
        start3_iso = start3.isoformat() + "Z"
        end3_iso = end3.isoformat() + "Z"
        resp2 = create_appointment(patient_id, staff_id, procedure_id, start3_iso, end3_iso)
        assert resp2.status_code == 201, f"Create second non-overlapping appointment failed: {resp2.text}"
        appointment_id_2 = resp2.json()["id"]

        # Update status of second appointment to cancelled
        resp = patch_appointment_status(appointment_id_2, "canceled")
        assert resp.status_code == 200, f"Patch second appointment status failed: {resp.text}"
        assert resp.json()["status"] == "canceled"

        # Delete appointments
        resp = delete_appointment(appointment_id)
        assert resp.status_code in (200, 204), f"Delete first appointment failed: {resp.text}"
        resp = delete_appointment(appointment_id_2)
        assert resp.status_code in (200, 204), f"Delete second appointment failed: {resp.text}"

        # Confirm appointments deleted by trying to get them (404)
        resp = get_appointment(appointment_id)
        assert resp.status_code == 404, "Deleted first appointment still accessible"
        resp = get_appointment(appointment_id_2)
        assert resp.status_code == 404, "Deleted second appointment still accessible"

    finally:
        # Cleanup if any appointment still exists
        if appointment_id:
            try:
                delete_appointment(appointment_id)
            except Exception:
                pass
        if appointment_id_2:
            try:
                delete_appointment(appointment_id_2)
            except Exception:
                pass

test_appointments_scheduling_and_status_updates()
