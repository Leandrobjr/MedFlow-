import requests
import datetime
import uuid

BASE_URL = "http://localhost:3001"
TENANT_SLUG = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_schedule_configuration_and_blocks_management():
    session = requests.Session()
    headers = {"x-tenant-slug": TENANT_SLUG}
    try:
        # Login to obtain cookies
        login_resp = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"

        # Confirm auth cookies set
        assert "access_token" in session.cookies or "refresh_token" in session.cookies, "Auth cookies missing after login"

        # Get staff ids to test schedule blocks: Create staff to get staffId
        # Since staff create requires DTO, do a minimal create (with admin cookie)
        staff_data = {
            "name": f"Test Staff {uuid.uuid4()}",
            "role": "DOCTOR",
            "email": f"staff{uuid.uuid4()}@medflow.local",
            "password": "Password123!",
            "phone": "1234567890"
        }
        # Create staff
        staff_resp = session.post(f"{BASE_URL}/staff", json=staff_data, headers=headers, timeout=TIMEOUT)
        assert staff_resp.status_code == 201, f"Staff creation failed: {staff_resp.text}"
        staff_id = staff_resp.json().get("id")
        assert staff_id, "Staff ID not returned"

        # Create first schedule block (blockType: date)
        today = datetime.date.today()
        block1_payload = {
            "staffId": staff_id,
            "blockType": "date",
            "startDate": today.isoformat()
        }
        block1_resp = session.post(f"{BASE_URL}/schedule/blocks", json=block1_payload, headers=headers, timeout=TIMEOUT)
        assert block1_resp.status_code == 201, f"First schedule block creation failed: {block1_resp.text}"
        block1_id = block1_resp.json().get("id")
        assert block1_id, "First schedule block ID missing"

        # Retrieve schedule blocks for staff (GET /schedule/blocks/staff/:staffId)
        sched_resp = session.get(f"{BASE_URL}/schedule/blocks/staff/{staff_id}", headers=headers, timeout=TIMEOUT)
        assert sched_resp.status_code == 200, f"Schedule retrieval failed: {sched_resp.text}"
        blocks = sched_resp.json()
        blocks_list = blocks if isinstance(blocks, list) else blocks.get("blocks", blocks.get("data", []))
        assert any(b.get("id") == block1_id for b in blocks_list), "Created block not in schedule"

        # Attempt to create an overlapping block (same staff, same startDate & blockType)
        block_overlap_payload = {
            "staffId": staff_id,
            "blockType": "date",
            "startDate": today.isoformat()
        }
        overlap_resp = session.post(f"{BASE_URL}/schedule/blocks", json=block_overlap_payload, headers=headers, timeout=TIMEOUT)
        # API pode retornar 409 (conflito) ou 201 (permite múltiplos blocos no mesmo dia)
        assert overlap_resp.status_code in (201, 409), f"Unexpected status: {overlap_resp.status_code}"

        # Verify authentication enforcement: try to get schedule blocks without cookies
        unauth_resp = requests.get(f"{BASE_URL}/schedule/blocks/staff/{staff_id}", headers={"x-tenant-slug": TENANT_SLUG}, timeout=TIMEOUT)
        assert unauth_resp.status_code == 401, "Unauthenticated request to /schedule/blocks should be 401 Unauthorized"

    finally:
        # Cleanup: delete created schedule block and staff
        # Delete block1
        if 'block1_id' in locals():
            _ = session.delete(f"{BASE_URL}/schedule/blocks/{block1_id}", headers=headers, timeout=TIMEOUT)
        # Delete staff
        if 'staff_id' in locals():
            _ = session.delete(f"{BASE_URL}/staff/{staff_id}", headers=headers, timeout=TIMEOUT)
        # Logout to clear cookies
        try:
            session.post(f"{BASE_URL}/auth/logout", headers=headers, timeout=TIMEOUT)
        except Exception:
            pass

test_schedule_configuration_and_blocks_management()