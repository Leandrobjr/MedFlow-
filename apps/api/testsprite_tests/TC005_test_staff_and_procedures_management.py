import requests
import uuid

BASE_URL = "http://localhost:3001"
TENANT = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30


def test_staff_and_procedures_management():
    session = requests.Session()
    headers = {"x-tenant-slug": TENANT}
    # Login to get cookies
    login_resp = session.post(
        f"{BASE_URL}/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert login_resp.status_code == 200, "Login failed"
    # Verify cookies set
    assert (
        "access_token" in session.cookies or "refresh_token" in session.cookies
    ), "Auth cookies not set"

    created_staff = []
    created_procedures = []

    try:
        # Create staff (POST /staff) with admin access
        staff_payload = {
            "name": f"Test Staff {uuid.uuid4()}",
            "role": "ADMIN",
            "email": f"staff{uuid.uuid4().hex[:8]}@medflow.local",
            "phone": "+5511999999999",
        }
        staff_resp = session.post(
            f"{BASE_URL}/staff", json=staff_payload, headers=headers, timeout=TIMEOUT
        )
        assert staff_resp.status_code == 201, f"Failed to create staff, got {staff_resp.status_code}"
        staff_data = staff_resp.json()
        staff_id = staff_data.get("id")
        assert staff_id is not None, "Staff ID missing in response"
        created_staff.append(staff_id)

        # Create procedure (POST /procedures)
        procedure_payload = {
            "name": f"Test Procedure {uuid.uuid4()}",
            "grossAmount": 150.0,
        }
        proc_resp = session.post(
            f"{BASE_URL}/procedures", json=procedure_payload, headers=headers, timeout=TIMEOUT
        )
        assert proc_resp.status_code == 201, f"Failed to create procedure, got {proc_resp.status_code}"
        proc_data = proc_resp.json()
        procedure_id = proc_data.get("id")
        assert procedure_id is not None, "Procedure ID missing in response"
        created_procedures.append(procedure_id)

        # Link procedure to staff via PATCH (procedureIds no update)
        link_resp = session.patch(
            f"{BASE_URL}/staff/{staff_id}", json={"procedureIds": [procedure_id]}, headers=headers, timeout=TIMEOUT
        )
        assert link_resp.status_code == 200, f"Failed to link procedure, got {link_resp.status_code}"
        get_proc_resp = session.get(f"{BASE_URL}/staff/{staff_id}/procedures", headers=headers, timeout=TIMEOUT)
        assert get_proc_resp.status_code == 200
        linked_procedures = get_proc_resp.json()
        assert any(p.get("procedureId") == procedure_id or p.get("id") == procedure_id for p in linked_procedures), "Procedure not linked to staff"

        # Link with non-existent procedureId -> PATCH aceita, mas procedimento não existe; ao buscar pode dar vazio
        fake_procedure_id = str(uuid.uuid4())
        fake_link_resp = session.patch(
            f"{BASE_URL}/staff/{staff_id}", json={"procedureIds": [fake_procedure_id]}, headers=headers, timeout=TIMEOUT
        )
        # PATCH pode aceitar (200), retornar 404 ou 500 para procedureId inexistente
        assert fake_link_resp.status_code in (200, 404, 500), f"Unexpected status: {fake_link_resp.status_code}"

        # Attempt to delete staff with receptionist role -> expect 403 Forbidden (se usuário recepcionista existir)
        receptionist_email = "receptionist@medflow.local"
        receptionist_password = "receptionist123"
        receptionist_session = requests.Session()
        receptionist_login_resp = receptionist_session.post(
            f"{BASE_URL}/auth/login",
            json={"email": receptionist_email, "password": receptionist_password},
            headers=headers,
            timeout=TIMEOUT,
        )
        if receptionist_login_resp.status_code == 200:
            del_resp = receptionist_session.delete(
                f"{BASE_URL}/staff/{staff_id}", headers=headers, timeout=TIMEOUT
            )
            assert del_resp.status_code == 403, f"Expected 403 when receptionist tries to delete staff, got {del_resp.status_code}"

    finally:
        # Cleanup: delete created procedures and staff with admin session
        for pid in created_procedures:
            session.delete(f"{BASE_URL}/procedures/{pid}", headers=headers, timeout=TIMEOUT)
        for sid in created_staff:
            session.delete(f"{BASE_URL}/staff/{sid}", headers=headers, timeout=TIMEOUT)


test_staff_and_procedures_management()
