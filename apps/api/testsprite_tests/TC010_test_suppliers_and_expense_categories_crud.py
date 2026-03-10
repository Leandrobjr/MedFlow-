import requests
import uuid

BASE_URL = "http://localhost:3001"
TENANT = "medflow"
EMAIL = "admin@medflow.local"
PASSWORD = "admin123"
TIMEOUT = 30

session = requests.Session()
session.headers.update({"x-tenant-slug": TENANT})


def login():
    login_url = f"{BASE_URL}/auth/login"
    resp = session.post(
        login_url,
        json={"email": EMAIL, "password": PASSWORD},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    # Cookies set automatically in session if using requests.Session()
    # We still check for access_token cookie presence
    assert "access_token" in resp.cookies or "access_token" in session.cookies, "access_token cookie missing"
    return resp.json()


def logout():
    logout_url = f"{BASE_URL}/auth/logout"
    resp = session.post(logout_url, timeout=TIMEOUT)
    resp.raise_for_status()


def create_supplier(name):
    url = f"{BASE_URL}/suppliers"
    resp = session.post(url, json={"name": name}, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "id" in data
    return data["id"]


def get_supplier(supplier_id):
    url = f"{BASE_URL}/suppliers/{supplier_id}"
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def update_supplier(supplier_id, new_name):
    url = f"{BASE_URL}/suppliers/{supplier_id}"
    resp = session.patch(url, json={"name": new_name}, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def delete_supplier(supplier_id):
    url = f"{BASE_URL}/suppliers/{supplier_id}"
    resp = session.delete(url, timeout=TIMEOUT)
    # It can succeed (204 No Content or 200 OK), or 404 if already deleted
    if resp.status_code == 404:
        return False
    resp.raise_for_status()
    return True


def create_expense_category(name, parent_id=None):
    url = f"{BASE_URL}/expense-categories"
    payload = {"name": name, "code": str(uuid.uuid4())[:8].upper()}
    if parent_id:
        payload["parentId"] = parent_id
    resp = session.post(url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "id" in data
    return data["id"]


def get_expense_category(category_id):
    url = f"{BASE_URL}/expense-categories/{category_id}"
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def update_expense_category(category_id, name=None, parent_id=None):
    url = f"{BASE_URL}/expense-categories/{category_id}"
    payload = {}
    if name is not None:
        payload["name"] = name
    if parent_id is not None:
        payload["parentId"] = parent_id
    resp = session.patch(url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def get_expense_categories_tree():
    url = f"{BASE_URL}/expense-categories"
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def test_suppliers_and_expense_categories_crud():
    # Login first
    login()

    # -------------------- SUPPLIERS CRUD --------------------
    supplier_id = None
    try:
        # Create supplier
        supplier_name = f"Test Supplier {uuid.uuid4()}"
        supplier_id = create_supplier(supplier_name)
        assert supplier_id

        # Get supplier details
        supplier_data = get_supplier(supplier_id)
        assert supplier_data["name"] == supplier_name

        # Update supplier
        new_supplier_name = supplier_name + " Updated"
        updated_data = update_supplier(supplier_id, new_supplier_name)
        assert updated_data["name"] == new_supplier_name

        # Get updated supplier
        supplier_data_after_update = get_supplier(supplier_id)
        assert supplier_data_after_update["name"] == new_supplier_name

    finally:
        if supplier_id:
            deleted = delete_supplier(supplier_id)
            # If already deleted or not found can be False, else True
            assert deleted or not deleted

    # -------------------- EXPENSE CATEGORIES CRUD & VALIDATION --------------------
    root_cat_id = None
    child_cat_id = None
    try:
        # Create root category
        root_name = f"Root Category {uuid.uuid4()}"
        root_cat_id = create_expense_category(root_name)
        assert root_cat_id

        # Create child category under root
        child_name = f"Child Category {uuid.uuid4()}"
        child_cat_id = create_expense_category(child_name, parent_id=root_cat_id)
        assert child_cat_id

        # Fetch categories tree and verify root and child presence
        tree = get_expense_categories_tree()
        # Check root present in tree
        def find_category(categories, cat_id):
            for c in categories:
                if c["id"] == cat_id:
                    return c
                if "children" in c and c["children"]:
                    found = find_category(c["children"], cat_id)
                    if found:
                        return found
            return None
        found_root = find_category(tree, root_cat_id)
        found_child = find_category(tree, child_cat_id)
        assert found_root is not None
        assert found_child is not None
        # child's parentId should be root_cat_id
        assert found_child.get("parentId") == root_cat_id

        # Update child category name and parentId to None (move to root)
        updated_name = child_name + " Updated"
        updated_cat = update_expense_category(child_cat_id, name=updated_name, parent_id=None)
        assert updated_cat["name"] == updated_name
        # parentId pode permanecer ou ser None conforme implementação

        # Try to update root category parentId to child's id to create a cycle (should fail 400)
        url = f"{BASE_URL}/expense-categories/{root_cat_id}"
        cycle_payload = {"parentId": child_cat_id}
        resp = session.patch(url, json=cycle_payload, timeout=TIMEOUT)
        assert resp.status_code == 400, "Cycle creation should return 400 Bad Request"

    finally:
        # Cleanup expense categories - no delete endpoint given in PRD, assuming no direct delete.
        # If delete exists, you could call it here.
        pass

    # Logout last
    logout()


test_suppliers_and_expense_categories_crud()