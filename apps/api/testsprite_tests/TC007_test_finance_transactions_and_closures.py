import requests
import datetime
import uuid

BASE_URL = "http://localhost:3001"
TENANT_SLUG = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_finance_transactions_and_closures():
    session = requests.Session()
    headers = {"x-tenant-slug": TENANT_SLUG}
    # Login to get auth cookies
    login_resp = session.post(
        f"{BASE_URL}/auth/login",
        headers=headers,
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        timeout=TIMEOUT,
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"

    cookies = login_resp.cookies
    # Verify auth/me - to confirm tenant context and get staffId
    me_resp = session.get(
        f"{BASE_URL}/auth/me", headers=headers, cookies=cookies, timeout=TIMEOUT
    )
    assert me_resp.status_code == 200, f"Auth/me failed: {me_resp.text}"
    me_data = me_resp.json()
    tenant_id = me_data.get("tenantId")
    assert tenant_id and isinstance(tenant_id, (str, int)), "tenantId missing or invalid in auth/me"

    # Create a patient for appointment (CPF único)
    patient_payload = {
        "name": "Finance Test Patient",
        "cpf": str(uuid.uuid4().int)[:11],
        "phone": "55519998877",
        "birthDate": "1980-01-01",
    }
    patient_resp = session.post(
        f"{BASE_URL}/patients", headers=headers, cookies=cookies, json=patient_payload, timeout=TIMEOUT
    )
    assert patient_resp.status_code == 201, f"Patient creation failed: {patient_resp.text}"
    patient_id = patient_resp.json().get("id")
    assert patient_id, "Patient ID missing in response"

    # Create a procedure
    procedure_payload = {
        "name": "Finance Procedure",
        "grossAmount": 150.75
    }
    procedure_resp = session.post(
        f"{BASE_URL}/procedures", headers=headers, cookies=cookies, json=procedure_payload, timeout=TIMEOUT
    )
    assert procedure_resp.status_code == 201, f"Procedure creation failed: {procedure_resp.text}"
    procedure_id = procedure_resp.json().get("id")
    assert procedure_id, "Procedure ID missing in response"

    # Create staff if admin has no staffId (admin/owner may not be linked to staff)
    staff_id = me_data.get("staffId")
    if staff_id is None:
        staff_payload = {
            "name": "Finance Test Doctor",
            "email": f"finance.doctor.{datetime.datetime.utcnow().strftime('%f')}@medflow.local",
            "role": "DOCTOR",
        }
        staff_resp = session.post(
            f"{BASE_URL}/staff", headers=headers, cookies=cookies, json=staff_payload, timeout=TIMEOUT
        )
        assert staff_resp.status_code == 201, f"Staff creation failed: {staff_resp.text}"
        staff_id = staff_resp.json().get("id")
        assert staff_id, "Staff ID missing"
    # Create an appointment with created patient, staff and procedure
    start_time = (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).isoformat() + "Z"
    end_time = (datetime.datetime.utcnow() + datetime.timedelta(hours=2)).isoformat() + "Z"
    appointment_payload = {
        "patientId": patient_id,
        "staffId": staff_id,
        "startTime": start_time,
        "endTime": end_time,
        "procedureId": procedure_id,
    }
    appointment_resp = session.post(
        f"{BASE_URL}/appointments", headers=headers, cookies=cookies, json=appointment_payload, timeout=TIMEOUT
    )
    assert appointment_resp.status_code == 201, f"Appointment creation failed: {appointment_resp.text}"
    appointment_id = appointment_resp.json().get("id")
    assert appointment_id, "Appointment ID missing in response"

    # Prepare tracking IDs for cleanup
    created_transaction_ids = []
    created_pep_id = None
    try:
        # Create financial transaction (income)
        fin_tx_in_payload = {
            "type": "income",
            "category": "test_category_income",
            "amount": 123.45
        }
        fin_tx_in_resp = session.post(
            f"{BASE_URL}/finance/transactions", headers=headers, cookies=cookies, json=fin_tx_in_payload, timeout=TIMEOUT
        )
        assert fin_tx_in_resp.status_code == 201, f"Income transaction creation failed: {fin_tx_in_resp.text}"
        fin_tx_in_id = fin_tx_in_resp.json().get("id")
        assert fin_tx_in_id, "Income transaction ID missing"
        created_transaction_ids.append(fin_tx_in_id)

        # Create financial transaction (expense)
        fin_tx_exp_payload = {
            "type": "expense",
            "category": "test_category_expense",
            "amount": 50.00
        }
        fin_tx_exp_resp = session.post(
            f"{BASE_URL}/finance/transactions", headers=headers, cookies=cookies, json=fin_tx_exp_payload, timeout=TIMEOUT
        )
        assert fin_tx_exp_resp.status_code == 201, f"Expense transaction creation failed: {fin_tx_exp_resp.text}"
        fin_tx_exp_id = fin_tx_exp_resp.json().get("id")
        assert fin_tx_exp_id, "Expense transaction ID missing"
        created_transaction_ids.append(fin_tx_exp_id)

        # Retrieve box status and validate presence of balances
        today = datetime.date.today().isoformat()
        box_status_resp = session.get(
            f"{BASE_URL}/finance/boxes/status?date={today}", headers=headers, cookies=cookies, timeout=TIMEOUT
        )
        assert box_status_resp.status_code == 200, f"Box status fetch failed: {box_status_resp.text}"
        box_status_data = box_status_resp.json()
        assert "balancesByMethod" in box_status_data, "'balancesByMethod' missing in box status response"

        # Close receptionist box for today with calculated balances
        today = datetime.date.today().isoformat()
        initial_balance = box_status_data.get("previousDayFinalBalance", 0.0) or 0.0
        final_balance = initial_balance + fin_tx_in_payload["amount"] - fin_tx_exp_payload["amount"]

        box_close_payload = {
            "date": today,
            "initialBalance": initial_balance,
            "finalBalance": final_balance,
        }
        box_close_resp = session.post(
            f"{BASE_URL}/finance/boxes/receptionist/close", headers=headers, cookies=cookies, json=box_close_payload, timeout=TIMEOUT
        )
        assert box_close_resp.status_code == 201, f"Box close failed: {box_close_resp.text}"
        closure_id = box_close_resp.json().get("id")
        assert closure_id, "Closure ID missing"

        # Create PEP for the appointment to close medical fees
        pep_payload = {
            "appointmentId": appointment_id,
            "patientId": patient_id,
            "staffId": staff_id
        }
        pep_resp = session.post(
            f"{BASE_URL}/pep", headers=headers, cookies=cookies, json=pep_payload, timeout=TIMEOUT
        )
        assert pep_resp.status_code == 201, f"PEP creation failed: {pep_resp.text}"
        created_pep_id = pep_resp.json().get("id")
        assert created_pep_id, "PEP ID missing"

        # Close medical fees with valid payload
        med_fees_close_payload = {
            "staffId": staff_id,
            "periodStart": today,
            "periodEnd": today
        }
        med_fees_close_resp = session.post(
            f"{BASE_URL}/finance/medical-fees/close", headers=headers, cookies=cookies, json=med_fees_close_payload, timeout=TIMEOUT
        )
        assert med_fees_close_resp.status_code == 201, f"Medical fees close failed: {med_fees_close_resp.text}"
        medical_fee_closure_id = med_fees_close_resp.json().get("id")
        assert medical_fee_closure_id, "Medical fee closure ID missing"

        # Close medical fees with incomplete payload to validate error
        invalid_med_fees_close_payload = {
            "staffId": staff_id,
            # Missing periodStart and periodEnd
        }
        med_fees_close_invalid_resp = session.post(
            f"{BASE_URL}/finance/medical-fees/close", headers=headers, cookies=cookies, json=invalid_med_fees_close_payload, timeout=TIMEOUT
        )
        assert med_fees_close_invalid_resp.status_code == 400, "Expected 400 Bad Request for incomplete medical fee close payload"

    finally:
        # Cleanup: Delete created appointments, patients, procedures, transactions, PEP if applicable
        if created_pep_id:
            session.delete(
                f"{BASE_URL}/pep/{created_pep_id}", headers=headers, cookies=cookies, timeout=TIMEOUT
            )
        if appointment_id:
            session.delete(
                f"{BASE_URL}/appointments/{appointment_id}", headers=headers, cookies=cookies, timeout=TIMEOUT
            )
        if patient_id:
            session.delete(
                f"{BASE_URL}/patients/{patient_id}", headers=headers, cookies=cookies, timeout=TIMEOUT
            )
        if procedure_id:
            session.delete(
                f"{BASE_URL}/procedures/{procedure_id}", headers=headers, cookies=cookies, timeout=TIMEOUT
            )
        for tx_id in created_transaction_ids:
            session.delete(
                f"{BASE_URL}/finance/transactions/{tx_id}", headers=headers, cookies=cookies, timeout=TIMEOUT
            )

test_finance_transactions_and_closures()
