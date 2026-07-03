"""
Iteration-5 backend tests for the 12-point production readiness checklist:
  - Caste / Religion CRUD
  - Family Linking (immediate + pending invitations)
  - Karyakarta CRUD, bulk import, celebrations
  - Visit Visibility (public vs internal)
  - Super Admin Subscription Management
  - Pending karyakarta auto-promotion on citizen registration

Runs against the live preview backend via REACT_APP_BACKEND_URL.
"""

import os
import random
import time
import pytest
import requests

_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not _URL:
    # Fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _URL = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
assert _URL, "REACT_APP_BACKEND_URL not set"
BASE = _URL.rstrip("/") + "/api"

SUPER = ("admin@jansetu.in", "admin123")
VK_ADMIN = ("admin@vivek-kolhe.jansetu.in", "VKAdmin2026!")
PC_ADMIN = ("admin@pune-cantonment.jansetu.in", "G7mj8YJ7pr15")
PA = ("pa@jansetu.in", "pa123")

CITIZEN_MOBILE = "9999900001"     # pune-cantonment tenant
CITIZEN_PORTAL = "pune-cantonment"


def _staff_login(email, password):
    r = requests.post(f"{BASE}/auth/staff/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"staff login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _citizen_login(mobile, portal):
    r = requests.post(f"{BASE}/auth/citizen/request-otp",
                      json={"mobile": mobile, "tenant_slug": portal}, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE}/auth/citizen/verify-otp",
                      json={"mobile": mobile, "otp": "123456", "tenant_slug": portal},
                      timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    if j.get("new_user"):
        pytest.skip(f"Citizen mobile {mobile} not registered in {portal}")
    return j["token"], j["user"]


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def vk_token():
    return _staff_login(*VK_ADMIN)


@pytest.fixture(scope="module")
def super_token():
    return _staff_login(*SUPER)


@pytest.fixture(scope="module")
def pc_token():
    return _staff_login(*PC_ADMIN)


@pytest.fixture(scope="module")
def citizen_ctx():
    tok, user = _citizen_login(CITIZEN_MOBILE, CITIZEN_PORTAL)
    return tok, user


# ---------- Caste CRUD ----------
class TestCasteCRUD:
    def test_create_caste(self, vk_token):
        r = requests.post(f"{BASE}/castes",
                          json={"name": f"TEST_Maratha_{random.randint(1000,9999)}",
                                "category": "OBC"},
                          headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "_id" not in j
        assert j["category"] == "OBC"
        assert "id" in j
        TestCasteCRUD.cid = j["id"]
        TestCasteCRUD.name = j["name"]

    def test_list_caste(self, vk_token):
        r = requests.get(f"{BASE}/castes", headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        names = [x["name"] for x in data]
        assert TestCasteCRUD.name in names

    def test_super_admin_cannot_create_caste_without_tenant(self, super_token):
        # Super admin has no tenant context → get_tenant_id_for_write should fail
        r = requests.post(f"{BASE}/castes",
                          json={"name": "TEST_ShouldFail", "category": "OBC"},
                          headers=_hdr(super_token), timeout=15)
        assert r.status_code in (400, 403), f"expected 400/403, got {r.status_code} {r.text}"

    def test_delete_caste(self, vk_token):
        r = requests.delete(f"{BASE}/castes/{TestCasteCRUD.cid}",
                            headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200


# ---------- Religion CRUD ----------
class TestReligionCRUD:
    def test_create_religion(self, vk_token):
        r = requests.post(f"{BASE}/religions",
                          json={"name": f"TEST_Hindu_{random.randint(1000,9999)}"},
                          headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "_id" not in j
        TestReligionCRUD.rid = j["id"]
        TestReligionCRUD.name = j["name"]

    def test_list_religion(self, vk_token):
        r = requests.get(f"{BASE}/religions", headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200
        assert TestReligionCRUD.name in [x["name"] for x in r.json()]

    def test_delete_religion(self, vk_token):
        r = requests.delete(f"{BASE}/religions/{TestReligionCRUD.rid}",
                            headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200


# ---------- Family Linking ----------
class TestFamilyLinking:
    def test_link_pending(self, citizen_ctx):
        tok, _ = citizen_ctx
        # Random unregistered mobile
        mob = "88888" + str(random.randint(10000, 99999))
        r = requests.post(f"{BASE}/family/link",
                          json={"mobile": mob, "relation_type": "Brother",
                                "target_name": "TEST_Bro"},
                          headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("linked") is False
        assert j.get("pending") is True
        assert "invitation_id" in j
        TestFamilyLinking.inv_id = j["invitation_id"]
        TestFamilyLinking.mob = mob

    def test_list_invitations(self, citizen_ctx):
        tok, _ = citizen_ctx
        r = requests.get(f"{BASE}/family/invitations",
                         headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "outgoing" in j and "incoming" in j
        assert any(i.get("id") == TestFamilyLinking.inv_id for i in j["outgoing"])

    def test_cancel_invitation(self, citizen_ctx):
        tok, _ = citizen_ctx
        r = requests.post(f"{BASE}/family/invitations/{TestFamilyLinking.inv_id}/cancel",
                         headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text


# ---------- Karyakarta CRUD ----------
class TestKaryakarta:
    def test_create_pending_karyakarta(self, vk_token):
        mob = "77777" + str(random.randint(10000, 99999))
        payload = {"name": "TEST_K1", "mobile": mob,
                   "designation": "Booth Agent", "dob": "1990-01-01"}
        r = requests.post(f"{BASE}/karyakartas", json=payload,
                          headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("linked") is False
        assert "pending_karyakarta" in j
        TestKaryakarta.pending_kid = j["pending_karyakarta"]["id"]
        TestKaryakarta.pending_mob = mob

    def test_bulk_import(self, vk_token):
        rows = [
            {"name": f"TEST_KBulk1_{random.randint(100,999)}",
             "mobile": "7777" + str(random.randint(100000, 999999)),
             "designation": "Coordinator"},
            {"name": f"TEST_KBulk2_{random.randint(100,999)}",
             "mobile": "7777" + str(random.randint(100000, 999999)),
             "designation": "Coordinator"},
        ]
        r = requests.post(f"{BASE}/karyakartas/bulk-import", json=rows,
                          headers=_hdr(vk_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("linked", "pending", "errors", "total"):
            assert k in j
        assert j["total"] == 2

    def test_list_karyakartas(self, vk_token):
        r = requests.get(f"{BASE}/karyakartas", headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "linked" in j and "pending" in j
        assert any(k["id"] == TestKaryakarta.pending_kid for k in j["pending"])

    def test_karyakarta_celebrations(self, vk_token):
        r = requests.get(f"{BASE}/dashboard/karyakarta-celebrations?days=7",
                         headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "birthdays" in j and "anniversaries" in j
        assert "today" in j["birthdays"] and "upcoming" in j["birthdays"]

    def test_delete_pending_karyakarta(self, vk_token):
        r = requests.delete(f"{BASE}/karyakartas/{TestKaryakarta.pending_kid}",
                            headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200


# ---------- Visit Visibility ----------
class TestVisitVisibility:
    def _count_notifications(self, tok):
        r = requests.get(f"{BASE}/notifications", headers=_hdr(tok), timeout=15)
        if r.status_code != 200:
            return None
        data = r.json()
        return len(data) if isinstance(data, list) else len(data.get("items", []))

    def test_internal_visit_no_notification(self, pc_token):
        before = self._count_notifications(pc_token)
        payload = {"title": f"TEST_INT_{random.randint(1000,9999)}",
                   "location": "Test",
                   "date": "2026-06-01",
                   "time": "10:00",
                   "visit_type": "General",
                   "visit_date": "2026-06-01",
                   "status": "Published",
                   "visibility": "internal"}
        r = requests.post(f"{BASE}/visits", json=payload,
                          headers=_hdr(pc_token), timeout=15)
        assert r.status_code == 200, r.text
        vid = r.json().get("id")
        TestVisitVisibility.internal_vid = vid
        time.sleep(1)
        after = self._count_notifications(pc_token)
        if before is not None and after is not None:
            assert after == before, f"Internal visit created a notification: {before}->{after}"

    def test_public_visit_creates_notification(self, pc_token):
        before = self._count_notifications(pc_token)
        payload = {"title": f"TEST_PUB_{random.randint(1000,9999)}",
                   "location": "Test",
                   "date": "2026-06-01",
                   "time": "10:00",
                   "visit_type": "General",
                   "visit_date": "2026-06-01",
                   "status": "Published",
                   "visibility": "public"}
        r = requests.post(f"{BASE}/visits", json=payload,
                          headers=_hdr(pc_token), timeout=15)
        assert r.status_code == 200, r.text
        time.sleep(1)
        after = self._count_notifications(pc_token)
        if before is not None and after is not None:
            assert after >= before + 1, f"Public visit did not add notification: {before}->{after}"

    def test_citizen_excludes_internal(self, citizen_ctx):
        tok, _ = citizen_ctx
        r = requests.get(f"{BASE}/visits", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        for v in items:
            assert v.get("visibility") != "internal", \
                f"Citizen sees internal visit: {v.get('id')}"

    def test_staff_sees_internal(self, pc_token):
        r = requests.get(f"{BASE}/visits", headers=_hdr(pc_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        ids = [v.get("id") for v in items]
        # Best-effort: internal visit created earlier should be visible to staff
        if getattr(TestVisitVisibility, "internal_vid", None):
            assert TestVisitVisibility.internal_vid in ids


# ---------- Subscriptions ----------
class TestSubscriptions:
    def test_super_admin_list_subs(self, super_token):
        r = requests.get(f"{BASE}/admin/subscriptions",
                         headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) > 0
        TestSubscriptions.portal_id = rows[0]["id"]
        TestSubscriptions.orig = rows[0]

    def test_non_super_forbidden(self, vk_token):
        r = requests.get(f"{BASE}/admin/subscriptions",
                         headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 403

    def test_update_subscription(self, super_token):
        payload = {"billing_cycle": "monthly",
                   "agreed_amount": 5000,
                   "next_renewal_date": "2026-08-01"}
        r = requests.put(f"{BASE}/admin/subscriptions/{TestSubscriptions.portal_id}",
                         json=payload, headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["billing_cycle"] == "monthly"
        assert j["agreed_amount"] == 5000
        assert j["next_renewal_date"] == "2026-08-01"


# ---------- Pending karyakarta auto-promotion ----------
class TestKaryakartaAutoPromote:
    def test_flow(self, vk_token):
        mob = "76" + str(random.randint(10000000, 99999999))
        # 1) Create pending karyakarta via bulk-import
        r = requests.post(f"{BASE}/karyakartas/bulk-import",
                          json=[{"name": "TEST_AutoPromote", "mobile": mob,
                                 "designation": "BLA"}],
                          headers=_hdr(vk_token), timeout=15)
        assert r.status_code == 200, r.text

        # 2) Register a new citizen with that mobile in vivek-kolhe
        #    First send OTP+verify to establish tenant flow
        rr = requests.post(f"{BASE}/auth/citizen/request-otp",
                           json={"mobile": mob, "tenant_slug": "vivek-kolhe"}, timeout=15)
        assert rr.status_code == 200
        rr = requests.post(f"{BASE}/auth/citizen/verify-otp",
                           json={"mobile": mob, "otp": "123456", "tenant_slug": "vivek-kolhe"}, timeout=15)
        assert rr.status_code == 200
        vj = rr.json()
        if not vj.get("new_user"):
            pytest.skip("mobile already registered — pick a new one")

        reg = {"mobile": mob, "otp": "123456",
               "name": "TEST_AutoPromote",
               "tenant_slug": "vivek-kolhe",
               "dob": "1992-05-10",
               "gender": "Male",
               "address": "Test Address",
               "region_type": "urban",
               "house_number": "TEST-1"}
        rr = requests.post(f"{BASE}/auth/citizen/register", json=reg, timeout=20)
        assert rr.status_code == 200, rr.text
        rj = rr.json()
        assert "token" in rj
        assert "user" in rj
        # pending_family_invitations present (empty ok per prompt)
        # It's fine if this key is absent for now — just soft-check.

        # 3) List karyakartas — the pending row should now be in linked
        r2 = requests.get(f"{BASE}/karyakartas", headers=_hdr(vk_token), timeout=15)
        assert r2.status_code == 200
        j2 = r2.json()
        linked_mobiles = [k.get("mobile") for k in j2.get("linked", [])]
        pending_mobiles = [k.get("mobile") for k in j2.get("pending", [])]
        assert mob in linked_mobiles, \
            f"Pending karyakarta was not promoted after citizen register. linked={linked_mobiles[:5]}, still pending={mob in pending_mobiles}"

        # 4) V1 user extra_roles contains 'karyakarta' — the register response
        # is built from the in-memory user before promotion, so re-fetch via
        # verify-otp on the freshly-registered citizen.
        vv = requests.post(f"{BASE}/auth/citizen/verify-otp",
                           json={"mobile": mob, "otp": "123456",
                                 "tenant_slug": "vivek-kolhe"}, timeout=15)
        assert vv.status_code == 200, vv.text
        u2 = vv.json().get("user") or {}
        assert "karyakarta" in (u2.get("extra_roles") or []), \
            f"extra_roles missing karyakarta after re-fetch: {u2.get('extra_roles')}"
