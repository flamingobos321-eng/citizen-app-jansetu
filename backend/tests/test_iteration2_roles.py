"""Iteration 2: role gates + approval flows."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL","https://family-bonds-23.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

def H(t): return {"Authorization": f"Bearer {t}"}

@pytest.fixture(scope="module")
def s(): return requests.Session()

def _login(s,e,p):
    r=s.post(f"{API}/auth/staff/login", json={"email":e,"password":p})
    assert r.status_code==200, r.text
    return r.json()["token"]

@pytest.fixture(scope="module")
def admin(s): return _login(s,"admin@jansetu.in","admin123")
@pytest.fixture(scope="module")
def mla(s): return _login(s,"mla@jansetu.in","mla123")
@pytest.fixture(scope="module")
def pa(s): return _login(s,"pa@jansetu.in","pa123")
@pytest.fixture(scope="module")
def worker(s): return _login(s,"worker1@jansetu.in","worker123")
@pytest.fixture(scope="module")
def citizen(s):
    s.post(f"{API}/auth/citizen/request-otp", json={"mobile":"9999900001"})
    return s.post(f"{API}/auth/citizen/verify-otp", json={"mobile":"9999900001","otp":"123456"}).json()["token"]

# ---- staff creation: admin yes, MLA no ----
def test_create_staff_admin_ok(s, admin):
    p={"role":"worker","name":"TEST_W","email":f"tw{int(time.time())}@x.in","password":"x123456","designation":"d"}
    r=s.post(f"{API}/admin/staff", json=p, headers=H(admin)); assert r.status_code==200, r.text

def test_create_staff_mla_403(s, mla):
    p={"role":"worker","name":"TEST_W2","email":f"tw2{int(time.time())}@x.in","password":"x","designation":"d"}
    assert s.post(f"{API}/admin/staff", json=p, headers=H(mla)).status_code==403

# ---- assign: PA yes, MLA no ----
@pytest.fixture(scope="module")
def fresh_issue(s, citizen):
    r=s.post(f"{API}/issues", json={"category":"Water","title":"TEST_It2","description":"x"}, headers=H(citizen))
    return r.json()

def test_assign_mla_403(s, mla, worker, fresh_issue):
    wid=s.get(f"{API}/auth/me", headers=H(worker)).json()["id"]
    r=s.post(f"{API}/issues/{fresh_issue['id']}/assign", json={"assigned_to":wid}, headers=H(mla))
    assert r.status_code==403

def test_assign_pa_ok(s, pa, worker, fresh_issue):
    wid=s.get(f"{API}/auth/me", headers=H(worker)).json()["id"]
    r=s.post(f"{API}/issues/{fresh_issue['id']}/assign", json={"assigned_to":wid}, headers=H(pa))
    assert r.status_code==200 and r.json()["status"]=="Assigned"

# ---- status: worker only own; MLA 403 ----
def test_status_mla_403(s, mla, fresh_issue):
    r=s.post(f"{API}/issues/{fresh_issue['id']}/status", json={"status":"In Progress"}, headers=H(mla))
    assert r.status_code==403

def test_status_worker_ok_own(s, worker, fresh_issue):
    r=s.post(f"{API}/issues/{fresh_issue['id']}/status", json={"status":"In Progress"}, headers=H(worker))
    assert r.status_code==200 and r.json()["status"]=="In Progress"

def test_status_worker_403_not_own(s, citizen, pa, worker):
    # create issue, assign to worker2
    new=s.post(f"{API}/issues", json={"category":"Road","title":"TEST_NotMine","description":"x"}, headers=H(citizen)).json()
    users=s.get(f"{API}/users", params={"role":"worker"}, headers=H(pa)).json()
    w2=next(u for u in users if u["email"]=="worker2@jansetu.in")
    s.post(f"{API}/issues/{new['id']}/assign", json={"assigned_to":w2["id"]}, headers=H(pa))
    r=s.post(f"{API}/issues/{new['id']}/status", json={"status":"In Progress"}, headers=H(worker))
    assert r.status_code==403

# ---- request reassign ----
def test_request_reassign(s, citizen, pa, worker):
    new=s.post(f"{API}/issues", json={"category":"Road","title":"TEST_Reassign","description":"x"}, headers=H(citizen)).json()
    wid=s.get(f"{API}/auth/me", headers=H(worker)).json()["id"]
    s.post(f"{API}/issues/{new['id']}/assign", json={"assigned_to":wid}, headers=H(pa))
    r=s.post(f"{API}/issues/{new['id']}/request-reassign", params={"reason":"busy"}, headers=H(worker))
    assert r.status_code==200
    det=s.get(f"{API}/issues/{new['id']}", headers=H(pa)).json()["issue"]
    assert det["assigned_to"] is None and det["status"]=="Under Review"
    assert any("Reassignment Requested" in t.get("status","") for t in det.get("timeline",[]))

# ---- visits approval flow ----
def test_visits_pa_pending(s, pa, citizen):
    p={"title":"TEST_V_Pending","location":"W1","date":"2030-02-01","time":"10:00","visit_type":"Public Meeting"}
    r=s.post(f"{API}/visits", json=p, headers=H(pa))
    assert r.status_code==200 and r.json()["status"]=="Pending Approval"
    # citizen should NOT see pending
    titles=[v["title"] for v in s.get(f"{API}/visits", headers=H(citizen)).json()]
    assert "TEST_V_Pending" not in titles
    return r.json()["id"]

def test_visits_admin_published_and_notif(s, admin, citizen):
    p={"title":f"TEST_V_Admin_{int(time.time())}","location":"W1","date":"2030-02-02","time":"10:00","visit_type":"Public Meeting"}
    r=s.post(f"{API}/visits", json=p, headers=H(admin))
    assert r.status_code==200 and r.json()["status"]=="Published"
    titles=[v["title"] for v in s.get(f"{API}/visits", headers=H(citizen)).json()]
    assert p["title"] in titles
    # notification created
    ntitles=[n["title"] for n in s.get(f"{API}/notifications", headers=H(admin)).json()]
    assert any(p["title"] in t for t in ntitles)

def test_visit_pa_cannot_approve(s, pa):
    p={"title":f"TEST_V_PA_appr_{int(time.time())}","location":"W1","date":"2030-02-03","time":"10:00","visit_type":"Public Meeting"}
    vid=s.post(f"{API}/visits", json=p, headers=H(pa)).json()["id"]
    assert s.post(f"{API}/visits/{vid}/approve", headers=H(pa)).status_code==403

def test_visit_mla_approves(s, pa, mla, citizen):
    p={"title":f"TEST_V_MLAappr_{int(time.time())}","location":"W1","date":"2030-02-04","time":"10:00","visit_type":"Public Meeting"}
    vid=s.post(f"{API}/visits", json=p, headers=H(pa)).json()["id"]
    r=s.post(f"{API}/visits/{vid}/approve", headers=H(mla))
    assert r.status_code==200 and r.json()["status"]=="Published"
    titles=[v["title"] for v in s.get(f"{API}/visits", headers=H(citizen)).json()]
    assert p["title"] in titles

# ---- devworks approval ----
def test_devworks_pa_unapproved(s, pa, citizen):
    p={"title":f"TEST_DW_PA_{int(time.time())}","description":"x","location":"W1","category":"Road","status":"Planned"}
    r=s.post(f"{API}/devworks", json=p, headers=H(pa))
    assert r.status_code==200 and r.json().get("approved") is False
    did=r.json()["id"]
    # citizen should NOT see unapproved
    cids=[d["id"] for d in s.get(f"{API}/devworks", headers=H(citizen)).json()]
    assert did not in cids
    return did

def test_devworks_admin_approved(s, admin, citizen):
    p={"title":f"TEST_DW_AD_{int(time.time())}","description":"x","location":"W1","category":"Road","status":"Planned"}
    r=s.post(f"{API}/devworks", json=p, headers=H(admin))
    assert r.status_code==200 and r.json().get("approved") is True

def test_devworks_mla_approve(s, pa, mla, citizen):
    p={"title":f"TEST_DW_MLAappr_{int(time.time())}","description":"x","location":"W1","category":"Road","status":"Planned"}
    did=s.post(f"{API}/devworks", json=p, headers=H(pa)).json()["id"]
    r=s.post(f"{API}/devworks/{did}/approve", headers=H(mla))
    assert r.status_code==200 and r.json().get("approved") is True
    cids=[d["id"] for d in s.get(f"{API}/devworks", headers=H(citizen)).json()]
    assert did in cids

def test_devworks_pa_approve_403(s, pa):
    p={"title":f"TEST_DW_PAapprFail_{int(time.time())}","description":"x","location":"W1","category":"Road","status":"Planned"}
    did=s.post(f"{API}/devworks", json=p, headers=H(pa)).json()["id"]
    assert s.post(f"{API}/devworks/{did}/approve", headers=H(pa)).status_code==403

def test_devworks_delete_admin_only(s, pa, admin):
    p={"title":f"TEST_DW_Del_{int(time.time())}","description":"x","location":"W1","category":"Road","status":"Planned"}
    did=s.post(f"{API}/devworks", json=p, headers=H(pa)).json()["id"]
    assert s.delete(f"{API}/devworks/{did}", headers=H(pa)).status_code==403
    assert s.delete(f"{API}/devworks/{did}", headers=H(admin)).status_code==200

# ---- notifications: created_by_name + recipients_count ----
def test_notification_metadata(s, pa, citizen):
    p={"title":f"TEST_N_Meta_{int(time.time())}","body":"x","notif_type":"Public Meeting","scope":"all"}
    r=s.post(f"{API}/notifications", json=p, headers=H(pa))
    assert r.status_code==200
    j=r.json()
    assert j.get("created_by_name") and isinstance(j.get("recipients_count"), int)
    assert j["recipients_count"] >= 1

# ---- households benefits ----
def test_household_benefits(s, admin):
    arr=s.get(f"{API}/households", headers=H(admin)).json()
    d=s.get(f"{API}/households/{arr[0]['id']}", headers=H(admin)).json()
    assert "benefits" in d and isinstance(d["benefits"], list)
