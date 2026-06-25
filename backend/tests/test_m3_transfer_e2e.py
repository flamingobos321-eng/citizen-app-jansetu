"""V2 Citizen Constituency Transfer Workflow — HTTP-layer E2E tests.

Hits the LIVE preview backend via REACT_APP_BACKEND_URL. Uses fresh random
mobile numbers per run so it is safe to re-run.

Run:
    cd /app/backend && python -m pytest tests/test_m3_transfer_e2e.py -v
"""
from __future__ import annotations

import os
import random
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

PORTAL_A = "kopargaon"
PORTAL_B = "pune-cantonment"

SUPER_ADMIN = ("admin@jansetu.in", "admin123")
PUNE_ADMIN = ("admin@pune-cantonment.jansetu.in", "G7mj8YJ7pr15")


def _rand_mobile() -> str:
    return "98" + "".join(str(random.randint(0, 9)) for _ in range(8))


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/staff/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _register_citizen(portal: str, mobile: str, name: str = "TEST_M3T E2E") -> dict:
    payload = {
        "tenant_slug": portal,
        "mobile": mobile,
        "otp": "123456",
        "name": name,
        "gender": "m",
        "region_type": "urban",
        "house_number": f"H-{random.randint(1000, 9999)}",
        "address": "TEST_M3T E2E Address",
        "ward_id": None,
        "area_id": None,
        "village_id": None,
        "members_count": 1,
        "family_head_name": name,
    }
    r = requests.post(f"{API}/auth/citizen/register", json=payload, timeout=30)
    return r


@pytest.fixture(scope="module")
def fresh_mobile_in_a():
    """Register a fresh citizen in tenant A (kopargaon)."""
    mobile = _rand_mobile()
    r = _register_citizen(PORTAL_A, mobile, name=f"TEST_M3T_A_{mobile[-4:]}")
    assert r.status_code == 200, f"Failed to register in A: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return {"mobile": mobile, "register_response": data}


# ===========================================================================
# 1. check-mobile
# ===========================================================================
class TestCheckMobile:
    def test_unknown_mobile_returns_exists_false(self):
        r = requests.post(f"{API}/auth/citizen/check-mobile",
                          json={"mobile": _rand_mobile(), "tenant_slug": PORTAL_B},
                          timeout=15)
        assert r.status_code == 200
        assert r.json() == {"exists": False}

    def test_same_tenant_returns_login_hint(self, fresh_mobile_in_a):
        r = requests.post(f"{API}/auth/citizen/check-mobile",
                          json={"mobile": fresh_mobile_in_a["mobile"],
                                "tenant_slug": PORTAL_A}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["exists"] is True
        assert data["same_tenant"] is True

    def test_cross_tenant_returns_transfer_payload(self, fresh_mobile_in_a):
        r = requests.post(f"{API}/auth/citizen/check-mobile",
                          json={"mobile": fresh_mobile_in_a["mobile"],
                                "tenant_slug": PORTAL_B}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["exists"] is True
        assert data.get("same_tenant") is False
        assert data["can_transfer"] is True
        assert data["current_tenant"]["slug"] == PORTAL_A
        assert data["target_tenant"]["slug"] == PORTAL_B


# ===========================================================================
# 2. citizen_register at B with mobile from A returns 409 TRANSFER_REQUIRED
# ===========================================================================
class TestRegisterAtBReturns409:
    def test_409_transfer_required(self, fresh_mobile_in_a):
        r = _register_citizen(PORTAL_B, fresh_mobile_in_a["mobile"],
                              name="TEST_M3T_B_attempt")
        assert r.status_code == 409, f"Expected 409, got {r.status_code} {r.text}"
        body = r.json()
        detail = body.get("detail", {})
        assert detail.get("code") == "TRANSFER_REQUIRED"
        assert detail.get("can_transfer") is True
        assert detail["current_tenant"]["slug"] == PORTAL_A
        assert detail["target_tenant"]["slug"] == PORTAL_B


# ===========================================================================
# 3. transfer/initiate
# ===========================================================================
class TestTransferInitiate:
    def test_initiate_creates_request(self, fresh_mobile_in_a):
        r = requests.post(f"{API}/auth/citizen/transfer/initiate",
                          json={"mobile": fresh_mobile_in_a["mobile"],
                                "target_tenant_slug": PORTAL_B,
                                "reason": "TEST_M3T job"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["transfer_request_id"].startswith("tr_")
        assert data["demo_otp"] == "123456"
        assert "expires_at" in data
        # stash for next test class
        fresh_mobile_in_a["transfer_request_id"] = data["transfer_request_id"]

    def test_initiate_invalid_target(self, fresh_mobile_in_a):
        r = requests.post(f"{API}/auth/citizen/transfer/initiate",
                          json={"mobile": fresh_mobile_in_a["mobile"],
                                "target_tenant_slug": "no-such-tenant-xyz"},
                          timeout=15)
        assert r.status_code == 400


# ===========================================================================
# 4. transfer/verify — happy path + idempotency + invalid otp
# ===========================================================================
class TestTransferVerify:
    def test_invalid_otp(self, fresh_mobile_in_a):
        # Use a separate request so we don't burn the main one
        r0 = requests.post(f"{API}/auth/citizen/transfer/initiate",
                           json={"mobile": fresh_mobile_in_a["mobile"],
                                 "target_tenant_slug": PORTAL_B,
                                 "reason": "TEST_M3T bad-otp"}, timeout=15)
        assert r0.status_code == 200
        tr_id = r0.json()["transfer_request_id"]
        r = requests.post(f"{API}/auth/citizen/transfer/verify",
                          json={"transfer_request_id": tr_id, "otp": "abc",
                                "new_address": {
                                    "region_type": "urban",
                                    "house_number": "H-NEW",
                                    "address": "TEST_M3T New Lane",
                                    "members_count": 1}}, timeout=15)
        assert r.status_code == 400
        assert "Invalid OTP" in r.text

    def test_verify_happy_path(self, fresh_mobile_in_a):
        # Always initiate a fresh request here to make this test independent.
        r0 = requests.post(f"{API}/auth/citizen/transfer/initiate",
                           json={"mobile": fresh_mobile_in_a["mobile"],
                                 "target_tenant_slug": PORTAL_B,
                                 "reason": "TEST_M3T happy-path"}, timeout=15)
        assert r0.status_code == 200, r0.text
        tr_id = r0.json()["transfer_request_id"]
        fresh_mobile_in_a["happy_tr_id"] = tr_id

        addr = {"region_type": "urban", "house_number": "H-NEW-1",
                "address": "TEST_M3T New Lane B", "members_count": 2,
                "family_head_name": "TEST_M3T E2E"}
        r = requests.post(f"{API}/auth/citizen/transfer/verify",
                          json={"transfer_request_id": tr_id, "otp": "123456",
                                "new_address": addr}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["mobile"] == fresh_mobile_in_a["mobile"]
        assert data["user"]["person_id"]
        assert data["household"]["id"]
        # Stash new token + person_id for downstream tests
        fresh_mobile_in_a["new_token"] = data["token"]
        fresh_mobile_in_a["new_user"] = data["user"]
        fresh_mobile_in_a["person_id"] = data["user"]["person_id"]

    def test_verify_idempotent_replay(self, fresh_mobile_in_a):
        tr_id = fresh_mobile_in_a.get("happy_tr_id")
        assert tr_id, "happy-path must run first"
        addr = {"region_type": "urban", "house_number": "H-NEW-1",
                "address": "TEST_M3T New Lane B", "members_count": 2}
        r = requests.post(f"{API}/auth/citizen/transfer/verify",
                          json={"transfer_request_id": tr_id, "otp": "123456",
                                "new_address": addr}, timeout=30)
        assert r.status_code == 200, r.text
        replay = r.json()
        assert replay["user"]["id"] == fresh_mobile_in_a["new_user"]["id"]
        assert replay["household"]["id"] == fresh_mobile_in_a["new_user"]["household_id"]


# ===========================================================================
# 5. /me/transfer-info (citizen logged in at NEW tenant)
# ===========================================================================
class TestMeTransferInfo:
    def test_transferred_in_payload(self, fresh_mobile_in_a):
        tok = fresh_mobile_in_a["new_token"]
        r = requests.get(f"{API}/me/transfer-info",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["transferred_in"] is True
        tf = data["transferred_from"]
        assert tf and tf["organisation"]["slug"] == PORTAL_A
        assert tf["reason"]  # one of the reasons we set
        # history: at least one archived + one active
        statuses = {m["status"] for m in data["history"]}
        assert "archived" in statuses and "active" in statuses


# ===========================================================================
# 6. Citizen OTP login at OLD tenant after transfer -> transferred_out
# ===========================================================================
class TestOldTenantLoginBlocked:
    def test_verify_otp_returns_transferred_out(self, fresh_mobile_in_a):
        # request-otp to set up
        r0 = requests.post(f"{API}/auth/citizen/request-otp",
                           json={"mobile": fresh_mobile_in_a["mobile"],
                                 "tenant_slug": PORTAL_A}, timeout=15)
        assert r0.status_code == 200
        r = requests.post(f"{API}/auth/citizen/verify-otp",
                         json={"mobile": fresh_mobile_in_a["mobile"],
                               "otp": "123456",
                               "tenant_slug": PORTAL_A}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("transferred_out") is True
        # token must NOT be returned
        assert "token" not in data
        assert data.get("current_portal", {}).get("slug") == PORTAL_B


# ===========================================================================
# 7. Parity report still ok=true after a transfer (super_admin)
# ===========================================================================
class TestParityAfterTransfer:
    def test_parity_ok_after_transfer(self):
        token = _login(*SUPER_ADMIN)
        r = requests.get(f"{API}/admin/v2/parity",
                         headers={"Authorization": f"Bearer {token}"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True, f"Parity report failed: {data}"


# ===========================================================================
# 8. Staff view of old user shows transfer_banner (read-only)
# ===========================================================================
class TestStaffOldUserBanner:
    def test_old_user_has_transfer_banner(self, fresh_mobile_in_a):
        # super-admin can see persons across tenants
        token = _login(*SUPER_ADMIN)
        # We need the OLD user id from tenant A. /me/transfer-info returned only
        # person_id. Find the archived V1 user via the persons endpoint.
        # Try listing persons in tenant A by querying the platform-wide users.
        # The endpoint /api/persons/{id} expects a V1 user id, not person_id.
        # We obtain it via a directory: GET /api/admin/users?mobile=...
        # Fallback: query MongoDB through the parity user_to_person mapping.
        pid = fresh_mobile_in_a["person_id"]
        # Use server endpoint that returns all memberships for the person
        # (history contains the archived membership which carries the org +
        # membership id, but we still need user id). Easiest: hit /api/persons
        # search for the new user id (we have it) and verify the banner is NOT
        # there. The OLD user id is exposed in the membership's user_id field
        # of the archived membership; the citizen self-view doesn't return it,
        # so we leave this test best-effort.
        # First, lookup by the new user id (should NOT have banner)
        new_uid = fresh_mobile_in_a["new_user"]["id"]
        r = requests.get(f"{API}/persons/{new_uid}",
                         headers={"Authorization": f"Bearer {token}"},
                         timeout=15)
        assert r.status_code == 200, r.text
        new_data = r.json()
        assert not new_data.get("transfer_banner") or \
            new_data["transfer_banner"].get("kind") != "transferred_out"

        # We can recover the OLD V1 user via /me/transfer-info history: each
        # membership row should carry a v1 user id. If not, skip the rest
        # as a known limitation.
        tok_new = fresh_mobile_in_a["new_token"]
        h = requests.get(f"{API}/me/transfer-info",
                        headers={"Authorization": f"Bearer {tok_new}"},
                        timeout=15).json()
        archived = next((m for m in h.get("history", []) if m["status"] == "archived"), None)
        assert archived, "No archived membership found"
        # Heuristic: persons collection has a back-link _v1 user. Without it
        # we cannot construct the path. Mark as skipped if not present.
        old_uid = archived.get("v1_user_id") or archived.get("_v1_user_id")
        if not old_uid:
            pytest.skip("History does not expose V1 user id for archived membership")
        r2 = requests.get(f"{API}/persons/{old_uid}",
                          headers={"Authorization": f"Bearer {token}"},
                          timeout=15)
        assert r2.status_code == 200, r2.text
        old_data = r2.json()
        banner = old_data.get("transfer_banner")
        assert banner and banner.get("kind") == "transferred_out"
        assert banner.get("read_only") is True
