import requests

BASE_URL = "http://localhost:3001"
TENANT_SLUG = "medflow"
LOGIN_EMAIL = "admin@medflow.local"
LOGIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_jwt_cookie_authentication_flow():
    session = requests.Session()
    headers = {"x-tenant-slug": TENANT_SLUG}

    try:
        # 1. POST /auth/login with valid credentials
        login_payload = {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}
        login_resp = session.post(f"{BASE_URL}/auth/login", json=login_payload, headers=headers, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code} {login_resp.text}"

        # Validate login response JSON has user payload with tenantId
        login_json = login_resp.json()
        assert "tenantId" in login_json, "Login response missing tenantId"
        user_tenant_id = login_json["tenantId"]

        # Validate HttpOnly access_token and refresh_token cookies are set
        cookies = session.cookies
        access_token_cookie = None
        refresh_token_cookie = None
        for cookie in cookies:
            if cookie.name == "access_token":
                access_token_cookie = cookie
            if cookie.name == "refresh_token":
                refresh_token_cookie = cookie
        assert access_token_cookie is not None, "access_token cookie missing after login"
        assert refresh_token_cookie is not None, "refresh_token cookie missing after login"
        assert access_token_cookie.has_nonstandard_attr("HttpOnly") or getattr(access_token_cookie, 'rest', {}).get('HttpOnly', False), "access_token cookie is not HttpOnly"
        assert refresh_token_cookie.has_nonstandard_attr("HttpOnly") or getattr(refresh_token_cookie, 'rest', {}).get('HttpOnly', False), "refresh_token cookie is not HttpOnly"

        # 2. GET /auth/me with cookies
        me_resp = session.get(f"{BASE_URL}/auth/me", headers=headers, timeout=TIMEOUT)
        assert me_resp.status_code == 200, f"/auth/me failed: {me_resp.status_code} {me_resp.text}"
        me_json = me_resp.json()
        assert "tenantId" in me_json, "/auth/me response missing tenantId"
        assert me_json["tenantId"] == TENANT_SLUG or me_json["tenantId"] == user_tenant_id, "TenantId mismatch on /auth/me"
        assert "role" in me_json, "/auth/me response missing role"

        # 3. POST /auth/refresh with valid refresh_token cookie - refresh token rotation
        refresh_resp = session.post(f"{BASE_URL}/auth/refresh", headers=headers, timeout=TIMEOUT)
        assert refresh_resp.status_code == 200, f"/auth/refresh failed: {refresh_resp.status_code} {refresh_resp.text}"
        # Validate rotated cookies set (new access_token and refresh_token)
        cookies_after_refresh = session.cookies
        new_access_token_cookie = None
        new_refresh_token_cookie = None
        for cookie in cookies_after_refresh:
            if cookie.name == "access_token":
                new_access_token_cookie = cookie
            if cookie.name == "refresh_token":
                new_refresh_token_cookie = cookie
        assert new_access_token_cookie is not None, "access_token cookie missing after refresh"
        assert new_refresh_token_cookie is not None, "refresh_token cookie missing after refresh"
        assert new_access_token_cookie.value != access_token_cookie.value or new_refresh_token_cookie.value != refresh_token_cookie.value, "Tokens not rotated on refresh"

        # 4. GET /auth/me with new access cookie to verify continued valid authentication
        me_resp_after_refresh = session.get(f"{BASE_URL}/auth/me", headers=headers, timeout=TIMEOUT)
        assert me_resp_after_refresh.status_code == 200, f"/auth/me after refresh failed: {me_resp_after_refresh.status_code} {me_resp_after_refresh.text}"
        me_json_after_refresh = me_resp_after_refresh.json()
        assert "tenantId" in me_json_after_refresh, "tenantId missing on /auth/me after refresh"
        assert me_json_after_refresh["tenantId"] == TENANT_SLUG or me_json_after_refresh["tenantId"] == user_tenant_id, "TenantId mismatch on /auth/me after refresh"

        # 5. POST /auth/logout with cookies to clear cookies
        logout_resp = session.post(f"{BASE_URL}/auth/logout", headers=headers, timeout=TIMEOUT)
        assert logout_resp.status_code == 200, f"/auth/logout failed: {logout_resp.status_code} {logout_resp.text}"

        # Validate that cookies are cleared by checking Set-Cookie headers for clearing tokens
        set_cookie_headers = logout_resp.headers.get("Set-Cookie", "")
        assert ("access_token=;" in set_cookie_headers or "access_token=" in set_cookie_headers), "access_token cookie not cleared on logout"
        assert ("refresh_token=;" in set_cookie_headers or "refresh_token=" in set_cookie_headers), "refresh_token cookie not cleared on logout"

        # After logout, further /auth/me calls should fail with 401 Unauthorized
        me_resp_post_logout = session.get(f"{BASE_URL}/auth/me", headers=headers, timeout=TIMEOUT)
        assert me_resp_post_logout.status_code == 401, f"/auth/me should fail after logout with 401, but got {me_resp_post_logout.status_code}"

    finally:
        session.close()

test_jwt_cookie_authentication_flow()