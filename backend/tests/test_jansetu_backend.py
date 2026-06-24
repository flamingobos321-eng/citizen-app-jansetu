"""JANSETU comprehensive backend tests."""
import os, time, pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://family-bonds-23.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

@pytest.fixture(scope="module")
def s(): return requests.Session()

def _login(s, e, p):
    r = s.post(f"{API}/auth/staff/login", json={"email": e, "password": p})
    assert r.status_code == 200, f"{e}: {r.status_code} {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="module")
def admin_token(s): return _login(s, "admin@jansetu.in", "admin123")
@pytest.fixture(scope="module")
def mla_token(s): return _login(s, "mla@jansetu.in", "mla123")
@pytest.fixture(scope="module")
def pa_token(s): return _login(s, "pa@jansetu.in", "pa123")
@pytest.fixture(scope="module")
def worker_token(s): return _login(s, "worker1@jansetu.in", "worker123")

def H(t): return {"Authorization": f"Bearer {t}"}

@pytest.fixture(scope="module")
def citizen_token(s):
    s.post(f"{API}/auth/citizen/request-otp", json={"mobile": "9999900001"})
    r = s.post(f"{API}/auth/citizen/verify-otp", json={"mobile": "9999900001", "otp": "123456"})
    return r.json()["token"]

# ---- meta + auth ----
def test_meta(s):
    j = s.get(f"{API}/meta/categories").json()
    for k in ("issue_categories","issue_statuses","dev_statuses"):
        assert k in j and j[k]

def test_citizen_request_otp(s):
    r = s.post(f"{API}/auth/citizen/request-otp", json={"mobile":"9999900001"})
    assert r.status_code == 200 and r.json().get("demo_otp") == "123456"

def test_citizen_verify_existing(s):
    r = s.post(f"{API}/auth/citizen/verify-otp", json={"mobile":"9999900001","otp":"123456"})
    assert r.status_code == 200
    j = r.json(); assert "Ramesh" in j["user"]["name"]

def test_citizen_verify_new_mobile(s):
    m = f"888{int(time.time())%10000000:07d}"[:10]
    r = s.post(f"{API}/auth/citizen/verify-otp", json={"mobile":m,"otp":"123456"})
    assert r.status_code == 200 and r.json().get("new_user") is True

def test_citizen_register(s):
    ward = s.get(f"{API}/areas", params={"kind":"ward"}).json()[0]
    payload = {
        "mobile": f"877{int(time.time())%10000000:07d}"[:10],
        "name":"TEST_NewCitizen", "gender":"Male", "kind":"urban",
        "region_type":"urban", "ward_id": ward["id"],
        "house_number":"42", "address":"Test Street"
    }
    r = s.post(f"{API}/auth/citizen/register", json=payload)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "token" in j and "user" in j and "household" in j
    hh = j["household"]
    code = hh.get("household_code") or hh.get("code")
    assert code and code.startswith("H-")

def test_auth_me(s, citizen_token):
    r = s.get(f"{API}/auth/me", headers=H(citizen_token))
    assert r.status_code == 200 and r.json()["role"] == "citizen"

@pytest.mark.parametrize("e,p",[("admin@jansetu.in","admin123"),("mla@jansetu.in","mla123"),
                              ("pa@jansetu.in","pa123"),("worker1@jansetu.in","worker123")])
def test_staff_logins(s,e,p):
    assert s.post(f"{API}/auth/staff/login", json={"email":e,"password":p}).status_code == 200

# ---- areas ----
def test_areas_list(s):
    arr = s.get(f"{API}/areas").json()
    assert isinstance(arr,list) and len(arr) > 0

def test_areas_crud(s, admin_token, citizen_token):
    # need a constituency id
    cons_id = None
    # try via existing area
    any_area = s.get(f"{API}/areas").json()[0]
    cons_id = any_area.get("constituency_id")
    assert cons_id, "no constituency available"
    payload = {"kind":"ward","name":f"TEST_W{int(time.time())%10000}",
               "code":f"TW{int(time.time())%10000}", "constituency_id":cons_id,
               "region_type":"urban"}
    bad = s.post(f"{API}/areas", json=payload, headers=H(citizen_token))
    assert bad.status_code == 403
    r = s.post(f"{API}/areas", json=payload, headers=H(admin_token))
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    d = s.delete(f"{API}/areas/{aid}", headers=H(admin_token))
    assert d.status_code in (200,204)

# ---- issues ----
@pytest.fixture(scope="module")
def issue(s, citizen_token):
    r = s.post(f"{API}/issues", json={"category":"Water","title":"TEST_NoWater",
                                       "description":"No water since morning"}, headers=H(citizen_token))
    assert r.status_code == 200, r.text
    j = r.json()
    code = j.get("issue_code") or j.get("code")
    assert code and code.startswith("ISS-")
    assert j["status"] == "New"
    assert j.get("timeline") and len(j["timeline"]) >= 1
    return j

def test_issue_create(issue): assert issue["id"]

def test_citizen_own_issues(s, citizen_token, issue):
    r = s.get(f"{API}/issues", headers=H(citizen_token))
    assert r.status_code == 200 and issue["id"] in [i["id"] for i in r.json()]

def test_pa_all_issues(s, pa_token, issue):
    r = s.get(f"{API}/issues", headers=H(pa_token))
    assert r.status_code == 200 and issue["id"] in [i["id"] for i in r.json()]

def test_pa_assign(s, pa_token, worker_token, issue):
    wid = s.get(f"{API}/auth/me", headers=H(worker_token)).json()["id"]
    r = s.post(f"{API}/issues/{issue['id']}/assign", json={"assigned_to":wid}, headers=H(pa_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Assigned"

def test_worker_progress_resolve(s, worker_token, issue):
    r1 = s.post(f"{API}/issues/{issue['id']}/status", json={"status":"In Progress"}, headers=H(worker_token))
    assert r1.status_code == 200 and r1.json()["status"] == "In Progress"
    r2 = s.post(f"{API}/issues/{issue['id']}/status", json={"status":"Resolved"}, headers=H(worker_token))
    assert r2.status_code == 200 and r2.json()["status"] == "Resolved"

def test_feedback_verified(s, citizen_token, issue):
    r = s.post(f"{API}/issues/{issue['id']}/feedback",
               json={"rating":5,"verified":True,"comment":"ok"}, headers=H(citizen_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Verified"

def test_feedback_reopen(s, citizen_token, pa_token, worker_token):
    new = s.post(f"{API}/issues", json={"category":"Road","title":"TEST_RO","description":"x"}, headers=H(citizen_token)).json()
    wid = s.get(f"{API}/auth/me", headers=H(worker_token)).json()["id"]
    s.post(f"{API}/issues/{new['id']}/assign", json={"assigned_to":wid}, headers=H(pa_token))
    s.post(f"{API}/issues/{new['id']}/status", json={"status":"In Progress"}, headers=H(worker_token))
    s.post(f"{API}/issues/{new['id']}/status", json={"status":"Resolved"}, headers=H(worker_token))
    r = s.post(f"{API}/issues/{new['id']}/feedback",
               json={"rating":2,"verified":False,"comment":"bad"}, headers=H(citizen_token))
    assert r.status_code == 200 and r.json()["status"] == "Reopened"

# ---- visits ----
def test_visits(s, pa_token, citizen_token):
    payload = {"title":"TEST_Visit","location":"Ward 1",
               "date":"2030-01-01","time":"10:00","visit_type":"Public Meeting"}
    r = s.post(f"{API}/visits", json=payload, headers=H(pa_token))
    assert r.status_code == 200, r.text
    assert s.get(f"{API}/visits", headers=H(pa_token)).status_code == 200
    assert s.get(f"{API}/visits", params={"upcoming":"true"}, headers=H(pa_token)).status_code == 200
    assert s.get(f"{API}/notifications", headers=H(citizen_token)).status_code == 200

# ---- notifications ----
def test_notifications(s, pa_token, citizen_token):
    payload = {"title":"TEST_Notice","body":"Hello all","notif_type":"Public Meeting","scope":"all"}
    r = s.post(f"{API}/notifications", json=payload, headers=H(pa_token))
    assert r.status_code == 200, r.text
    titles = [n.get("title","") for n in s.get(f"{API}/notifications", headers=H(citizen_token)).json()]
    assert any("TEST_Notice" in t for t in titles)

# ---- devworks ----
def test_devworks(s, pa_token):
    r = s.post(f"{API}/devworks", json={"title":"TEST_Proj","description":"desc",
                                         "location":"Ward 1","category":"Road","status":"Planned"},
               headers=H(pa_token))
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    u = s.post(f"{API}/devworks/{pid}/status", params={"status":"Completed"}, headers=H(pa_token))
    assert u.status_code == 200 and u.json()["status"] == "Completed"

# ---- dashboards / reports / households ----
def test_dashboard_stats(s, admin_token):
    j = s.get(f"{API}/dashboard/stats", headers=H(admin_token)).json()
    for k in ("total_citizens","by_category","by_ward"): assert k in j

def test_citizen_stats(s, citizen_token):
    assert s.get(f"{API}/dashboard/citizen-stats", headers=H(citizen_token)).status_code == 200

def test_reports_csv(s, admin_token):
    r = s.get(f"{API}/reports/issues.csv", headers=H(admin_token))
    assert r.status_code == 200
    assert "csv" in r.headers.get("content-type","").lower() or "," in r.text

def test_households(s, admin_token):
    arr = s.get(f"{API}/households", headers=H(admin_token)).json()
    assert isinstance(arr,list) and len(arr) > 0
    d = s.get(f"{API}/households/{arr[0]['id']}", headers=H(admin_token)).json()
    assert "members" in d and "issues" in d
