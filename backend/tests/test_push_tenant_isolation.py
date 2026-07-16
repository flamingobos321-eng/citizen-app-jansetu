"""
Push notification tenant-isolation tests.

Covers:
  - /push/send-to-user cross-tenant rejection (tenant admin → other-tenant user)
  - /push/send-to-user same-tenant success (tenant admin → same-tenant user)
  - /push/status diagnostic endpoint availability for admin/super_admin
  - /push/test fires without error (dev mode)

Runs against a live backend via BACKEND_URL env var (falls back to localhost:8000).
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _staff_login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/staff/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def super_token():
    """Super-admin (platform-wide) token."""
    return _staff_login("admin@jansetu.in", "admin123")


@pytest.fixture(scope="module")
def vk_token():
    """Vivek-Kolhe tenant admin token (first tenant)."""
    try:
        return _staff_login("admin@vivek-kolhe.jansetu.in", "VKAdmin2026!")
    except AssertionError:
        pytest.skip("VK tenant admin credentials not available in this environment")


@pytest.fixture(scope="module")
def pc_token():
    """Pune-Cantonment tenant admin token (second tenant)."""
    try:
        return _staff_login("admin@pune-cantonment.jansetu.in", "G7mj8YJ7pr15")
    except AssertionError:
        pytest.skip("PC tenant admin credentials not available in this environment")


@pytest.fixture(scope="module")
def vk_citizen_id(vk_token):
    """A citizen user ID that belongs to the VK tenant."""
    r = requests.get(f"{API}/citizens", headers=_hdr(vk_token), timeout=15)
    assert r.status_code == 200, f"GET /citizens failed: {r.status_code} {r.text}"
    citizens = r.json() if isinstance(r.json(), list) else r.json().get("citizens") or r.json().get("users") or []
    if not citizens:
        pytest.skip("No citizens in VK tenant; skipping cross-tenant test")
    return citizens[0]["id"]


@pytest.fixture(scope="module")
def pc_citizen_id(pc_token):
    """A citizen user ID that belongs to the PC tenant."""
    r = requests.get(f"{API}/citizens", headers=_hdr(pc_token), timeout=15)
    assert r.status_code == 200, f"GET /citizens failed: {r.status_code} {r.text}"
    citizens = r.json() if isinstance(r.json(), list) else r.json().get("citizens") or r.json().get("users") or []
    if not citizens:
        pytest.skip("No citizens in PC tenant; skipping cross-tenant test")
    return citizens[0]["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPushStatus:
    def test_super_admin_sees_global_total(self, super_token):
        """Super admin receives total_registered_tokens (platform-wide count)."""
        r = requests.get(f"{API}/push/status", headers=_hdr(super_token), timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        j = r.json()
        assert "mode" in j
        assert "fcm_configured" in j
        assert "total_registered_tokens" in j, (
            "Super admin should see total_registered_tokens (global count)"
        )
        assert isinstance(j["total_registered_tokens"], int)
        assert isinstance(j["your_registered_tokens"], int)
        # Super admin must NOT get the tenant-scoped-only key
        assert "registered_tokens" not in j, (
            "Super admin response should use total_registered_tokens, not registered_tokens"
        )

    def test_tenant_admin_sees_only_tenant_count(self, vk_token):
        """Tenant admin sees registered_tokens (own tenant only), not global total."""
        r = requests.get(f"{API}/push/status", headers=_hdr(vk_token), timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        j = r.json()
        assert "mode" in j
        assert "fcm_configured" in j
        # Tenant admin must NOT see the global total
        assert "total_registered_tokens" not in j, (
            "Tenant admin must not see cross-tenant total_registered_tokens; "
            f"got keys: {list(j.keys())}"
        )
        # Tenant admin sees their own tenant's count only
        assert "registered_tokens" in j, (
            "Tenant admin should see registered_tokens (scoped to their tenant)"
        )
        assert isinstance(j["registered_tokens"], int)
        assert isinstance(j["your_registered_tokens"], int)

    def test_citizen_cannot_see_status(self):
        # Get a citizen token via OTP to verify citizens are blocked.
        requests.post(f"{API}/auth/citizen/request-otp",
                      json={"mobile": "9999900001"}, timeout=10)
        r2 = requests.post(f"{API}/auth/citizen/verify-otp",
                           json={"mobile": "9999900001", "otp": "123456"}, timeout=10)
        if r2.status_code != 200:
            pytest.skip("Citizen OTP auth unavailable")
        citizen_tok = r2.json().get("token")
        if not citizen_tok:
            pytest.skip("No citizen token returned")
        r = requests.get(f"{API}/push/status",
                         headers=_hdr(citizen_tok), timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


class TestPushTest:
    def test_push_test_returns_mode(self, super_token):
        r = requests.post(f"{API}/push/test", headers=_hdr(super_token), timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        j = r.json()
        assert "mode" in j
        # In dev mode: inbox_only is True; in FCM mode: delivered_to is set.
        assert "delivered_to" in j or "inbox_only" in j


class TestPushSendToUser:
    def test_cross_tenant_send_rejected(self, vk_token, pc_citizen_id):
        """VK tenant admin must NOT be able to push to a PC tenant citizen."""
        payload = {
            "user_id": pc_citizen_id,
            "title": "Cross-tenant test",
            "body": "This should be rejected.",
        }
        r = requests.post(f"{API}/push/send-to-user",
                          json=payload, headers=_hdr(vk_token), timeout=10)
        assert r.status_code == 404, (
            f"Cross-tenant push should return 404 (user not found in tenant), "
            f"got {r.status_code}: {r.text}"
        )

    def test_same_tenant_send_accepted(self, vk_token, vk_citizen_id):
        """VK tenant admin CAN push to a citizen in the same tenant."""
        payload = {
            "user_id": vk_citizen_id,
            "title": "Same-tenant test",
            "body": "End-to-end push diagnostics verification.",
        }
        r = requests.post(f"{API}/push/send-to-user",
                          json=payload, headers=_hdr(vk_token), timeout=10)
        assert r.status_code == 200, (
            f"Same-tenant push should return 200, got {r.status_code}: {r.text}"
        )
        j = r.json()
        assert "mode" in j

    def test_super_admin_can_send_to_any_tenant(self, super_token, pc_citizen_id, vk_citizen_id):
        """Super admin bypasses tenant scoping and can push to any user."""
        for uid in [pc_citizen_id, vk_citizen_id]:
            payload = {
                "user_id": uid,
                "title": "Super admin cross-tenant test",
                "body": "Super admin should have global push access.",
            }
            r = requests.post(f"{API}/push/send-to-user",
                              json=payload, headers=_hdr(super_token), timeout=10)
            assert r.status_code == 200, (
                f"Super admin push should return 200 for user {uid}, "
                f"got {r.status_code}: {r.text}"
            )

    def test_invalid_user_id_returns_404(self, super_token):
        payload = {
            "user_id": "nonexistent-user-id-xyz",
            "title": "Should fail",
            "body": "No such user.",
        }
        r = requests.post(f"{API}/push/send-to-user",
                          json=payload, headers=_hdr(super_token), timeout=10)
        assert r.status_code == 404, (
            f"Unknown user_id should return 404, got {r.status_code}: {r.text}"
        )

    def test_citizen_cannot_send_push(self):
        """Citizens must not be able to use send-to-user (requires admin role)."""
        requests.post(f"{API}/auth/citizen/request-otp",
                      json={"mobile": "9999900001"}, timeout=10)
        r2 = requests.post(f"{API}/auth/citizen/verify-otp",
                           json={"mobile": "9999900001", "otp": "123456"}, timeout=10)
        if r2.status_code != 200:
            pytest.skip("Citizen OTP auth unavailable")
        citizen_tok = r2.json().get("token")
        if not citizen_tok:
            pytest.skip("No citizen token returned")
        payload = {
            "user_id": "any-id",
            "title": "Citizen trying to push",
            "body": "Should be forbidden.",
        }
        r = requests.post(f"{API}/push/send-to-user",
                          json=payload,
                          headers={"Authorization": f"Bearer {citizen_tok}"},
                          timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
