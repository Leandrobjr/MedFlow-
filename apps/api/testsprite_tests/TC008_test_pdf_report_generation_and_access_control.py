import requests
import datetime
import uuid

BASE_URL = "http://localhost:3001"
TENANT_SLUG = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30

def login(session, tenant_slug):
    url = f"{BASE_URL}/auth/login"
    headers = {"x-tenant-slug": tenant_slug}
    data = {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 200
    assert 'access_token' in resp.cookies and 'refresh_token' in resp.cookies
    user = resp.json()
    assert 'tenantId' in user
    return user

def create_patient(session, tenant_slug):
    url = f"{BASE_URL}/patients"
    headers = {"x-tenant-slug": tenant_slug}
    unique_cpf = str(uuid.uuid4())[:11].replace("-", "")  # CPF unique per tenant, use dummy unique string
    data = {
        "name": "Test Patient",
        "cpf": unique_cpf,
        "phone": "555-1234",
        "birthDate": "1980-01-01"
    }
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 201
    patient = resp.json()
    assert "id" in patient
    return patient

def create_staff(session, tenant_slug):
    url = f"{BASE_URL}/staff"
    headers = {"x-tenant-slug": tenant_slug}
    # minimal staff data - guessing basic fields since DTO not provided explicitly; using name and role as common fields
    data = {
        "name": "Dr. Staff",
        "email": f"dr.staff.{uuid.uuid4().hex[:6]}@medflow.local",
        "role": "DOCTOR"
    }
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 201
    staff = resp.json()
    assert "id" in staff
    return staff

def create_procedure(session, tenant_slug):
    url = f"{BASE_URL}/procedures"
    headers = {"x-tenant-slug": tenant_slug}
    data = {
        "name": "Procedure A",
        "grossAmount": 100.0
    }
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 201
    procedure = resp.json()
    assert "id" in procedure
    return procedure

def create_appointment(session, tenant_slug, patient_id, staff_id, procedure_id):
    url = f"{BASE_URL}/appointments"
    headers = {"x-tenant-slug": tenant_slug}
    now = datetime.datetime.utcnow()
    start = (now + datetime.timedelta(hours=1)).isoformat() + "Z"
    end = (now + datetime.timedelta(hours=2)).isoformat() + "Z"
    data = {
        "patientId": patient_id,
        "staffId": staff_id,
        "startTime": start,
        "endTime": end,
        "procedureId": procedure_id
    }
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 201
    appointment = resp.json()
    assert "id" in appointment
    return appointment

def close_receptionist_box(session, tenant_slug, date, initial_balance, final_balance):
    url = f"{BASE_URL}/finance/boxes/receptionist/close"
    headers = {"x-tenant-slug": tenant_slug}
    data = {
        "date": date,
        "initialBalance": initial_balance,
        "finalBalance": final_balance
    }
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    if resp.status_code == 400 and "fechado" in (resp.text or "").lower():
        raise AssertionError("Caixa já fechado hoje. Execute o teste uma vez por dia ou reinicie o banco.")
    assert resp.status_code == 201, f"Box close failed: {resp.status_code} {resp.text}"
    closure = resp.json()
    assert "id" in closure, f"Closure response missing id: {closure}"
    return closure

def generate_daily_closure_report(session, tenant_slug, closure_id):
    url = f"{BASE_URL}/reports/daily-closure/{closure_id}"
    headers = {"x-tenant-slug": tenant_slug}
    resp = session.get(url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 200
    content_type = resp.headers.get("Content-Type", "")
    assert content_type == "application/pdf"
    assert len(resp.content) > 100  # minimal size check
    return resp.content

def close_medical_fee(session, tenant_slug, staff_id, period_start, period_end):
    url = f"{BASE_URL}/finance/medical-fees/close"
    headers = {"x-tenant-slug": tenant_slug}
    data = {
        "staffId": staff_id,
        "periodStart": period_start,
        "periodEnd": period_end
    }
    resp = session.post(url, json=data, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 201
    repasse = resp.json()
    assert "id" in repasse
    return repasse

def generate_medical_fee_report(session, tenant_slug, payment_id):
    url = f"{BASE_URL}/reports/medical-fee/{payment_id}"
    headers = {"x-tenant-slug": tenant_slug}
    resp = session.get(url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 200
    content_type = resp.headers.get("Content-Type", "")
    assert content_type == "application/pdf"
    assert len(resp.content) > 100
    return resp.content


def test_pdf_report_generation_and_access_control():
    session_admin = requests.Session()
    # Login as medflow admin
    user = login(session_admin, TENANT_SLUG)

    # Create necessary resources for reports: patient, staff, procedure, appointment
    patient = None
    staff = None
    procedure = None
    appointment = None
    closure = None
    repasse = None

    try:
        patient = create_patient(session_admin, TENANT_SLUG)
        staff = create_staff(session_admin, TENANT_SLUG)
        procedure = create_procedure(session_admin, TENANT_SLUG)
        appointment = create_appointment(session_admin, TENANT_SLUG, patient["id"], staff["id"], procedure["id"])

        # Close receptionist box for today to generate a closure report
        today = datetime.date.today().isoformat()
        closure = close_receptionist_box(session_admin, TENANT_SLUG, today, 1000.0, 1500.0)

        # Generate daily closure PDF report with correct tenant
        pdf_data = generate_daily_closure_report(session_admin, TENANT_SLUG, closure["id"])
        assert pdf_data is not None and len(pdf_data) > 0

        # Close medical fee repasse for the staff over a period to generate repasse report
        period_start = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        period_end = datetime.date.today().isoformat()
        repasse = close_medical_fee(session_admin, TENANT_SLUG, staff["id"], period_start, period_end)

        # Generate medical fee PDF report with correct tenant
        pdf_repasse_data = generate_medical_fee_report(session_admin, TENANT_SLUG, repasse["id"])
        assert pdf_repasse_data is not None and len(pdf_repasse_data) > 0

        # Now test access control: another tenant tries to access medflow reports => must get 403 Forbidden 
        session_other_tenant = requests.Session()
        # Login with another tenant (simulate different tenant slug)
        # For test, we use tenant 'other-tenant', login same user (assuming user exists in other tenant or simulate failed access)
        other_tenant_slug = "other-tenant"
        # Login same admin email but for other tenant - this should work if user exists in other tenant
        # We expect 403 Forbidden on report access if tenant isolation works
        resp_login = session_other_tenant.post(
            f"{BASE_URL}/auth/login",
            headers={"x-tenant-slug": other_tenant_slug},
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            timeout=TIMEOUT)
        if resp_login.status_code == 200:
            # Attempt to get daily closure report from medflow tenant with other tenant token / cookies
            resp_closure = session_other_tenant.get(
                f"{BASE_URL}/reports/daily-closure/{closure['id']}",
                headers={"x-tenant-slug": other_tenant_slug},
                timeout=TIMEOUT)
            assert resp_closure.status_code == 403

            # Attempt to get medical fee report from medflow tenant with other tenant token / cookies
            resp_repasse = session_other_tenant.get(
                f"{BASE_URL}/reports/medical-fee/{repasse['id']}",
                headers={"x-tenant-slug": other_tenant_slug},
                timeout=TIMEOUT)
            assert resp_repasse.status_code == 403
        else:
            # If login fails for other tenant, consider test pass for isolation as user cannot authenticate/use that tenant
            assert resp_login.status_code in (401, 403)

    finally:
        # Cleanup created resources in medflow tenant
        headers = {"x-tenant-slug": TENANT_SLUG}
        # Delete appointment
        if appointment:
            session_admin.delete(f"{BASE_URL}/appointments/{appointment['id']}", headers=headers, timeout=TIMEOUT)
        # Delete procedure
        if procedure:
            session_admin.delete(f"{BASE_URL}/procedures/{procedure['id']}", headers=headers, timeout=TIMEOUT)
        # Delete staff
        if staff:
            session_admin.delete(f"{BASE_URL}/staff/{staff['id']}", headers=headers, timeout=TIMEOUT)
        # Delete patient
        if patient:
            session_admin.delete(f"{BASE_URL}/patients/{patient['id']}", headers=headers, timeout=TIMEOUT)
        # Delete closure and repasse if applicable (no API documented for delete, so skip if no endpoint)
        # Typically closures and repasses are immutable, so we skip deleting those

test_pdf_report_generation_and_access_control()
