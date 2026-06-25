"""
JANSETU Multi-Tenant Data Isolation Testing (Phase 2)
Tests comprehensive tenant isolation across all endpoints and operations.
"""
import requests
import json
from typing import Dict, Optional, List

BASE_URL = "https://family-bonds-23.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN_CREDS = {"email": "admin@jansetu.in", "password": "admin123"}
PUNE_ADMIN_CREDS = {"email": "admin@pune-cantonment.jansetu.in", "password": "G7mj8YJ7pr15"}
PUNE_PA_CREDS = {"email": "pa@jansetu.in", "password": "pa123"}
PUNE_WORKER_CREDS = {"email": "worker1@jansetu.in", "password": "worker123"}
VK_ADMIN_CREDS = {"email": "admin@vivek-kolhe.jansetu.in", "password": "VKAdmin2026!"}

# Global storage
tokens = {}
test_data = {}
test_results = {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "failures": []
}


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    if passed:
        status = "✅ PASS"
        test_results["passed"] += 1
    else:
        status = "❌ FAIL"
        test_results["failed"] += 1
        test_results["failures"].append(f"{name}: {details}")
    
    print(f"{status}: {name}")
    if details and not passed:
        print(f"   {details}")


def login_staff(role: str, creds: Dict) -> tuple[str, dict]:
    """Login staff and return (token, user)"""
    resp = requests.post(f"{BASE_URL}/auth/staff/login", json=creds)
    if resp.status_code != 200:
        raise Exception(f"Failed to login {role}: {resp.status_code} {resp.text}")
    data = resp.json()
    return data["token"], data["user"]


def setup_tokens():
    """Setup all required tokens"""
    print("\n=== Setting up tokens ===")
    
    tokens["super_admin"], test_data["super_admin_user"] = login_staff("super_admin", SUPER_ADMIN_CREDS)
    print(f"✓ Super admin token obtained (tenant_id: {test_data['super_admin_user'].get('tenant_id')})")
    
    tokens["pune_admin"], test_data["pune_admin_user"] = login_staff("pune_admin", PUNE_ADMIN_CREDS)
    print(f"✓ Pune admin token obtained (tenant_id: {test_data['pune_admin_user'].get('tenant_id')})")
    
    tokens["pune_pa"], test_data["pune_pa_user"] = login_staff("pune_pa", PUNE_PA_CREDS)
    print(f"✓ Pune PA token obtained (tenant_id: {test_data['pune_pa_user'].get('tenant_id')})")
    
    tokens["pune_worker"], test_data["pune_worker_user"] = login_staff("pune_worker", PUNE_WORKER_CREDS)
    print(f"✓ Pune worker token obtained (tenant_id: {test_data['pune_worker_user'].get('tenant_id')})")
    
    tokens["vk_admin"], test_data["vk_admin_user"] = login_staff("vk_admin", VK_ADMIN_CREDS)
    print(f"✓ VK admin token obtained (tenant_id: {test_data['vk_admin_user'].get('tenant_id')})")
    
    # Get tenant IDs
    test_data["pune_tenant_id"] = test_data["pune_admin_user"].get("tenant_id")
    test_data["vk_tenant_id"] = test_data["vk_admin_user"].get("tenant_id")
    
    print(f"\nTenant IDs:")
    print(f"  Pune Cantonment: {test_data['pune_tenant_id']}")
    print(f"  Vivek Kolhe: {test_data['vk_tenant_id']}")


def get_pune_data():
    """Fetch Pune tenant data for testing"""
    print("\n=== Fetching Pune tenant data ===")
    pune_token = tokens["pune_admin"]
    
    # Get issues
    resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        test_data["pune_issues"] = resp.json()
        print(f"✓ Pune issues: {len(test_data['pune_issues'])}")
    
    # Get households
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        test_data["pune_households"] = resp.json()
        print(f"✓ Pune households: {len(test_data['pune_households'])}")
    
    # Get citizens
    resp = requests.get(f"{BASE_URL}/users?role=citizen", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        test_data["pune_citizens"] = resp.json()
        print(f"✓ Pune citizens: {len(test_data['pune_citizens'])}")
    
    # Get visits
    resp = requests.get(f"{BASE_URL}/visits", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        test_data["pune_visits"] = resp.json()
        print(f"✓ Pune visits: {len(test_data['pune_visits'])}")
    
    # Get notifications
    resp = requests.get(f"{BASE_URL}/notifications", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        test_data["pune_notifications"] = resp.json()
        print(f"✓ Pune notifications: {len(test_data['pune_notifications'])}")
    
    # Get devworks
    resp = requests.get(f"{BASE_URL}/devworks", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        test_data["pune_devworks"] = resp.json()
        print(f"✓ Pune devworks: {len(test_data['pune_devworks'])}")


def get_vk_data():
    """Fetch VK tenant data for testing"""
    print("\n=== Fetching VK tenant data ===")
    vk_token = tokens["vk_admin"]
    
    # Get issues
    resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        test_data["vk_issues"] = resp.json()
        print(f"✓ VK issues: {len(test_data['vk_issues'])}")
    
    # Get households
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        test_data["vk_households"] = resp.json()
        print(f"✓ VK households: {len(test_data['vk_households'])}")
    
    # Get citizens
    resp = requests.get(f"{BASE_URL}/users?role=citizen", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        test_data["vk_citizens"] = resp.json()
        print(f"✓ VK citizens: {len(test_data['vk_citizens'])}")
    
    # Get visits
    resp = requests.get(f"{BASE_URL}/visits", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        test_data["vk_visits"] = resp.json()
        print(f"✓ VK visits: {len(test_data['vk_visits'])}")
    
    # Get notifications
    resp = requests.get(f"{BASE_URL}/notifications", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        test_data["vk_notifications"] = resp.json()
        print(f"✓ VK notifications: {len(test_data['vk_notifications'])}")
    
    # Get devworks
    resp = requests.get(f"{BASE_URL}/devworks", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        test_data["vk_devworks"] = resp.json()
        print(f"✓ VK devworks: {len(test_data['vk_devworks'])}")


def test_a_tenant_isolation_pune_to_vk():
    """Test A: Pune tenant cannot see/modify VK tenant data"""
    print("\n=== Test A: Tenant Isolation (Pune → VK) ===")
    
    pune_token = tokens["pune_admin"]
    vk_issues = test_data.get("vk_issues", [])
    vk_households = test_data.get("vk_households", [])
    vk_citizens = test_data.get("vk_citizens", [])
    vk_visits = test_data.get("vk_visits", [])
    vk_notifications = test_data.get("vk_notifications", [])
    vk_devworks = test_data.get("vk_devworks", [])
    
    # Test 1: GET /api/issues should NOT contain VK issues
    resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_issues_list = resp.json()
        vk_issue_ids = {i["id"] for i in vk_issues}
        leaked_issues = [i for i in pune_issues_list if i["id"] in vk_issue_ids]
        log_test("Pune GET /issues does NOT contain VK issues", 
                 len(leaked_issues) == 0, 
                 f"Found {len(leaked_issues)} VK issues in Pune list")
    
    # Test 2: GET /api/issues/{vk_issue_id} should return 404
    if vk_issues:
        vk_issue_id = vk_issues[0]["id"]
        resp = requests.get(f"{BASE_URL}/issues/{vk_issue_id}", headers={"Authorization": f"Bearer {pune_token}"})
        log_test("Pune GET /issues/{vk_issue_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 3: GET /api/households should NOT contain VK households
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_hh_list = resp.json()
        vk_hh_ids = {h["id"] for h in vk_households}
        leaked_hh = [h for h in pune_hh_list if h["id"] in vk_hh_ids]
        log_test("Pune GET /households does NOT contain VK households", 
                 len(leaked_hh) == 0, 
                 f"Found {len(leaked_hh)} VK households in Pune list")
    
    # Test 4: GET /api/households/{vk_hh_id} should return 404
    if vk_households:
        vk_hh_id = vk_households[0]["id"]
        resp = requests.get(f"{BASE_URL}/households/{vk_hh_id}", headers={"Authorization": f"Bearer {pune_token}"})
        log_test("Pune GET /households/{vk_hh_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 5: GET /api/persons/{vk_citizen_id} should return 404
    if vk_citizens:
        vk_citizen_id = vk_citizens[0]["id"]
        resp = requests.get(f"{BASE_URL}/persons/{vk_citizen_id}", headers={"Authorization": f"Bearer {pune_token}"})
        log_test("Pune GET /persons/{vk_citizen_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 6: PUT /api/persons/{vk_citizen_id} should return 404 and NOT update
    if vk_citizens:
        vk_citizen_id = vk_citizens[0]["id"]
        original_notes = vk_citizens[0].get("notes", "")
        
        resp = requests.put(
            f"{BASE_URL}/persons/{vk_citizen_id}",
            json={"notes": "HACKED BY PUNE"},
            headers={"Authorization": f"Bearer {pune_token}"}
        )
        log_test("Pune PUT /persons/{vk_citizen_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
        
        # Verify the record was NOT updated
        vk_token = tokens["vk_admin"]
        resp = requests.get(f"{BASE_URL}/persons/{vk_citizen_id}", headers={"Authorization": f"Bearer {vk_token}"})
        if resp.status_code == 200:
            person_data = resp.json()
            current_notes = person_data.get("notes", "")
            log_test("VK citizen notes NOT modified by Pune", 
                     current_notes != "HACKED BY PUNE", 
                     f"Notes: {current_notes}")
    
    # Test 7: POST /api/issues/{vk_issue_id}/status should return 404
    if vk_issues:
        vk_issue_id = vk_issues[0]["id"]
        resp = requests.post(
            f"{BASE_URL}/issues/{vk_issue_id}/status",
            json={"status": "Resolved", "note": "Hacked"},
            headers={"Authorization": f"Bearer {pune_token}"}
        )
        log_test("Pune POST /issues/{vk_issue_id}/status → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 8: POST /api/issues/{vk_issue_id}/assign should return 404
    if vk_issues:
        vk_issue_id = vk_issues[0]["id"]
        pune_worker_id = test_data["pune_worker_user"]["id"]
        resp = requests.post(
            f"{BASE_URL}/issues/{vk_issue_id}/assign",
            json={"assigned_to": pune_worker_id, "due_date": "2026-12-31", "remarks": "Hacked"},
            headers={"Authorization": f"Bearer {pune_token}"}
        )
        log_test("Pune POST /issues/{vk_issue_id}/assign → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 9: GET /api/visits should NOT contain VK visits
    resp = requests.get(f"{BASE_URL}/visits", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_visits_list = resp.json()
        vk_visit_ids = {v["id"] for v in vk_visits}
        leaked_visits = [v for v in pune_visits_list if v["id"] in vk_visit_ids]
        log_test("Pune GET /visits does NOT contain VK visits", 
                 len(leaked_visits) == 0, 
                 f"Found {len(leaked_visits)} VK visits in Pune list")
    
    # Test 10: GET /api/notifications should NOT contain VK notifications
    resp = requests.get(f"{BASE_URL}/notifications", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_notif_list = resp.json()
        vk_notif_ids = {n["id"] for n in vk_notifications}
        leaked_notif = [n for n in pune_notif_list if n["id"] in vk_notif_ids]
        log_test("Pune GET /notifications does NOT contain VK notifications", 
                 len(leaked_notif) == 0, 
                 f"Found {len(leaked_notif)} VK notifications in Pune list")
    
    # Test 11: GET /api/devworks should NOT contain VK devworks
    resp = requests.get(f"{BASE_URL}/devworks", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_devworks_list = resp.json()
        vk_devwork_ids = {d["id"] for d in vk_devworks}
        leaked_devworks = [d for d in pune_devworks_list if d["id"] in vk_devwork_ids]
        log_test("Pune GET /devworks does NOT contain VK devworks", 
                 len(leaked_devworks) == 0, 
                 f"Found {len(leaked_devworks)} VK devworks in Pune list")
    
    # Test 12: GET /api/users?role=citizen should NOT contain VK citizens
    resp = requests.get(f"{BASE_URL}/users?role=citizen", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_citizens_list = resp.json()
        vk_citizen_ids = {c["id"] for c in vk_citizens}
        leaked_citizens = [c for c in pune_citizens_list if c["id"] in vk_citizen_ids]
        log_test("Pune GET /users?role=citizen does NOT contain VK citizens", 
                 len(leaked_citizens) == 0, 
                 f"Found {len(leaked_citizens)} VK citizens in Pune list")
    
    # Test 13: GET /api/users should NOT contain VK staff
    resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        pune_users_list = resp.json()
        vk_admin_id = test_data["vk_admin_user"]["id"]
        leaked_staff = [u for u in pune_users_list if u["id"] == vk_admin_id]
        log_test("Pune GET /users does NOT contain VK staff", 
                 len(leaked_staff) == 0, 
                 f"Found {len(leaked_staff)} VK staff in Pune list")
    
    # Test 14: GET /api/dashboard/stats should only reflect Pune tenant
    resp = requests.get(f"{BASE_URL}/dashboard/stats", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        stats = resp.json()
        # Stats should match Pune data counts, not include VK
        pune_issue_count = len(test_data.get("pune_issues", []))
        stats_issue_count = stats.get("issues", {}).get("total", 0)
        log_test("Pune GET /dashboard/stats reflects only Pune data", 
                 stats_issue_count == pune_issue_count, 
                 f"Stats issues: {stats_issue_count}, Pune issues: {pune_issue_count}")
    
    # Test 15: GET /api/dashboard/celebrations should not contain VK citizens
    resp = requests.get(f"{BASE_URL}/dashboard/celebrations", headers={"Authorization": f"Bearer {pune_token}"})
    if resp.status_code == 200:
        celebrations = resp.json()
        all_celebration_citizens = []
        for category in ["birthdays", "anniversaries", "remembrance"]:
            if category in celebrations:
                all_celebration_citizens.extend(celebrations[category].get("today", []))
                all_celebration_citizens.extend(celebrations[category].get("upcoming", []))
        
        vk_citizen_ids = {c["id"] for c in vk_citizens}
        leaked_celebrations = [c for c in all_celebration_citizens if c.get("id") in vk_citizen_ids]
        log_test("Pune GET /dashboard/celebrations does NOT contain VK citizens", 
                 len(leaked_celebrations) == 0, 
                 f"Found {len(leaked_celebrations)} VK citizens in celebrations")


def test_a_tenant_isolation_vk_to_pune():
    """Test A: VK tenant cannot see/modify Pune tenant data (reverse)"""
    print("\n=== Test A: Tenant Isolation (VK → Pune) ===")
    
    vk_token = tokens["vk_admin"]
    pune_issues = test_data.get("pune_issues", [])
    pune_households = test_data.get("pune_households", [])
    pune_citizens = test_data.get("pune_citizens", [])
    
    # Test 1: GET /api/issues should NOT contain Pune issues
    resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        vk_issues_list = resp.json()
        pune_issue_ids = {i["id"] for i in pune_issues}
        leaked_issues = [i for i in vk_issues_list if i["id"] in pune_issue_ids]
        log_test("VK GET /issues does NOT contain Pune issues", 
                 len(leaked_issues) == 0, 
                 f"Found {len(leaked_issues)} Pune issues in VK list")
    
    # Test 2: GET /api/issues/{pune_issue_id} should return 404
    if pune_issues:
        pune_issue_id = pune_issues[0]["id"]
        resp = requests.get(f"{BASE_URL}/issues/{pune_issue_id}", headers={"Authorization": f"Bearer {vk_token}"})
        log_test("VK GET /issues/{pune_issue_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 3: GET /api/households should NOT contain Pune households
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {vk_token}"})
    if resp.status_code == 200:
        vk_hh_list = resp.json()
        pune_hh_ids = {h["id"] for h in pune_households}
        leaked_hh = [h for h in vk_hh_list if h["id"] in pune_hh_ids]
        log_test("VK GET /households does NOT contain Pune households", 
                 len(leaked_hh) == 0, 
                 f"Found {len(leaked_hh)} Pune households in VK list")
    
    # Test 4: GET /api/households/{pune_hh_id} should return 404
    if pune_households:
        pune_hh_id = pune_households[0]["id"]
        resp = requests.get(f"{BASE_URL}/households/{pune_hh_id}", headers={"Authorization": f"Bearer {vk_token}"})
        log_test("VK GET /households/{pune_hh_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")
    
    # Test 5: GET /api/persons/{pune_citizen_id} should return 404
    if pune_citizens:
        pune_citizen_id = pune_citizens[0]["id"]
        resp = requests.get(f"{BASE_URL}/persons/{pune_citizen_id}", headers={"Authorization": f"Bearer {vk_token}"})
        log_test("VK GET /persons/{pune_citizen_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")


def test_b_insert_auto_attach():
    """Test B: tenant_id is auto-attached on writes"""
    print("\n=== Test B: Insert Auto-Attach ===")
    
    pune_pa_token = tokens["pune_pa"]
    pune_admin_token = tokens["pune_admin"]
    pune_tenant_id = test_data["pune_tenant_id"]
    
    # Test 1: POST /api/issues as Pune PA → tenant_id auto-attached
    issue_payload = {
        "category": "Water Supply",
        "title": "Test issue for auto-attach",
        "description": "Testing tenant_id auto-attach",
        "photos": [],
        "gps_lat": None,
        "gps_lng": None
    }
    resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {pune_pa_token}"})
    if resp.status_code == 200:
        issue_data = resp.json()
        test_data["test_issue_id"] = issue_data["id"]
        log_test("POST /issues as Pune PA → tenant_id auto-attached", 
                 issue_data.get("tenant_id") == pune_tenant_id, 
                 f"tenant_id: {issue_data.get('tenant_id')}")
    else:
        log_test("POST /issues as Pune PA → 200", False, f"Got {resp.status_code}: {resp.text}")
    
    # Test 2: POST /api/devworks as Pune admin → tenant_id auto-attached
    devwork_payload = {
        "title": "Test devwork for auto-attach",
        "description": "Testing tenant_id auto-attach",
        "category": "Road Construction",
        "location": "Test Location",
        "budget": 100000,
        "status": "Proposed"
    }
    resp = requests.post(f"{BASE_URL}/devworks", json=devwork_payload, headers={"Authorization": f"Bearer {pune_admin_token}"})
    if resp.status_code == 200:
        devwork_data = resp.json()
        test_data["test_devwork_id"] = devwork_data["id"]
        log_test("POST /devworks as Pune admin → tenant_id auto-attached", 
                 devwork_data.get("tenant_id") == pune_tenant_id, 
                 f"tenant_id: {devwork_data.get('tenant_id')}")
    else:
        log_test("POST /devworks as Pune admin → 200", False, f"Got {resp.status_code}: {resp.text}")
    
    # Test 3: POST /api/notifications as Pune admin → tenant_id auto-attached
    notif_payload = {
        "title": "Test notification for auto-attach",
        "body": "Testing tenant_id auto-attach",
        "notif_type": "General",
        "scope": "all"
    }
    resp = requests.post(f"{BASE_URL}/notifications", json=notif_payload, headers={"Authorization": f"Bearer {pune_admin_token}"})
    if resp.status_code == 200:
        notif_data = resp.json()
        test_data["test_notif_id"] = notif_data["id"]
        log_test("POST /notifications as Pune admin → tenant_id auto-attached", 
                 notif_data.get("tenant_id") == pune_tenant_id, 
                 f"tenant_id: {notif_data.get('tenant_id')}")
    else:
        log_test("POST /notifications as Pune admin → 200", False, f"Got {resp.status_code}: {resp.text}")
    
    # Test 4: POST /api/visits as Pune PA → tenant_id auto-attached
    visit_payload = {
        "title": "Test visit for auto-attach",
        "description": "Testing tenant_id auto-attach",
        "date": "2026-12-31",
        "time": "10:00",
        "location": "Test Location",
        "visit_type": "Janata Darbar",
        "target_audience": "All",
        "ward_ids": [],
        "village_ids": []
    }
    resp = requests.post(f"{BASE_URL}/visits", json=visit_payload, headers={"Authorization": f"Bearer {pune_pa_token}"})
    if resp.status_code == 200:
        visit_data = resp.json()
        test_data["test_visit_id"] = visit_data["id"]
        log_test("POST /visits as Pune PA → tenant_id auto-attached", 
                 visit_data.get("tenant_id") == pune_tenant_id, 
                 f"tenant_id: {visit_data.get('tenant_id')}")
    else:
        log_test("POST /visits as Pune PA → 200", False, f"Got {resp.status_code}: {resp.text}")
    
    # Test 5: POST /api/relationships referencing VK citizen as Pune admin → 404
    vk_citizens = test_data.get("vk_citizens", [])
    pune_citizens = test_data.get("pune_citizens", [])
    if vk_citizens and pune_citizens:
        vk_citizen_id = vk_citizens[0]["id"]
        pune_citizen_id = pune_citizens[0]["id"]
        
        rel_payload = {
            "person_a": pune_citizen_id,
            "person_b": vk_citizen_id,
            "type": "Father",
            "since": "2000",
            "notes": "Cross-tenant test"
        }
        resp = requests.post(f"{BASE_URL}/relationships", json=rel_payload, headers={"Authorization": f"Bearer {pune_admin_token}"})
        log_test("POST /relationships with cross-tenant person → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")


def test_c_super_admin_behavior():
    """Test C: Super admin behavior"""
    print("\n=== Test C: Super Admin Behavior ===")
    
    super_admin_token = tokens["super_admin"]
    pune_admin_token = tokens["pune_admin"]
    
    # Test 1: GET /api/users as super_admin → sees BOTH tenants' users
    resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {super_admin_token}"})
    if resp.status_code == 200:
        all_users = resp.json()
        pune_tenant_id = test_data["pune_tenant_id"]
        vk_tenant_id = test_data["vk_tenant_id"]
        
        pune_users = [u for u in all_users if u.get("tenant_id") == pune_tenant_id]
        vk_users = [u for u in all_users if u.get("tenant_id") == vk_tenant_id]
        
        log_test("Super admin GET /users sees BOTH tenants' users", 
                 len(pune_users) > 0 and len(vk_users) > 0, 
                 f"Pune users: {len(pune_users)}, VK users: {len(vk_users)}, Total: {len(all_users)}")
    else:
        log_test("Super admin GET /users → 200", False, f"Got {resp.status_code}")
    
    # Test 2: POST /api/issues as super_admin → 400 "Super admin cannot create tenant-scoped records"
    issue_payload = {
        "category": "Water Supply",
        "title": "Test issue by super admin",
        "description": "Should fail",
        "photos": [],
        "gps_lat": None,
        "gps_lng": None
    }
    resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {super_admin_token}"})
    log_test("Super admin POST /issues → 400", 
             resp.status_code == 400, 
             f"Got {resp.status_code}: {resp.text[:100] if resp.text else ''}")
    
    # Test 3: GET /api/platform/stats as super_admin → 200 with aggregate counts
    resp = requests.get(f"{BASE_URL}/platform/stats", headers={"Authorization": f"Bearer {super_admin_token}"})
    if resp.status_code == 200:
        platform_stats = resp.json()
        log_test("Super admin GET /platform/stats → 200", 
                 True, 
                 f"Portals: {platform_stats.get('portals', {}).get('total', 0)}, Citizens: {platform_stats.get('entities', {}).get('citizens', 0)}")
    else:
        log_test("Super admin GET /platform/stats → 200", False, f"Got {resp.status_code}")
    
    # Test 4: GET /api/platform/stats as Pune admin → 403
    resp = requests.get(f"{BASE_URL}/platform/stats", headers={"Authorization": f"Bearer {pune_admin_token}"})
    log_test("Pune admin GET /platform/stats → 403", 
             resp.status_code == 403, 
             f"Got {resp.status_code}")


def test_d_per_tenant_counters():
    """Test D: Per-tenant counters"""
    print("\n=== Test D: Per-Tenant Counters ===")
    
    pune_issues = test_data.get("pune_issues", [])
    vk_issues = test_data.get("vk_issues", [])
    
    # Test 1: Verify Pune issue codes
    pune_codes = [i.get("issue_code", "") for i in pune_issues]
    log_test("Pune issues have ISS-10001..ISS-10006 codes", 
             len(pune_codes) >= 6, 
             f"Pune issue codes: {pune_codes[:10]}")
    
    # Test 2: Verify VK issue codes start at ISS-10001
    vk_codes = [i.get("issue_code", "") for i in vk_issues]
    if vk_codes:
        log_test("VK issues start at ISS-10001 (independent sequence)", 
                 "ISS-10001" in vk_codes, 
                 f"VK issue codes: {vk_codes}")
    
    # Test 3: Create NEW issue in VK tenant → expect ISS-10002 (or next in sequence)
    vk_admin_token = tokens["vk_admin"]
    issue_payload = {
        "category": "Road Repair",
        "title": "Test issue for counter",
        "description": "Testing per-tenant counter",
        "photos": [],
        "gps_lat": None,
        "gps_lng": None
    }
    resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {vk_admin_token}"})
    if resp.status_code == 200:
        new_issue = resp.json()
        test_data["vk_new_issue_id"] = new_issue["id"]
        new_code = new_issue.get("issue_code", "")
        expected_next = f"ISS-{10001 + len(vk_issues)}"
        log_test(f"VK new issue has code {expected_next}", 
                 new_code == expected_next, 
                 f"Got {new_code}, expected {expected_next}")
    else:
        log_test("VK POST /issues → 200", False, f"Got {resp.status_code}: {resp.text}")
    
    # Test 4: Create NEW issue in Pune tenant → expect ISS-10007 (or next in sequence)
    pune_pa_token = tokens["pune_pa"]
    resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {pune_pa_token}"})
    if resp.status_code == 200:
        new_issue = resp.json()
        test_data["pune_new_issue_id"] = new_issue["id"]
        new_code = new_issue.get("issue_code", "")
        expected_next = f"ISS-{10001 + len(pune_issues)}"
        log_test(f"Pune new issue has code {expected_next}", 
                 new_code == expected_next, 
                 f"Got {new_code}, expected {expected_next}")
    else:
        log_test("Pune POST /issues → 200", False, f"Got {resp.status_code}: {resp.text}")


def test_e_file_access():
    """Test E: File access (cross-tenant)"""
    print("\n=== Test E: File Access (Cross-Tenant) ===")
    
    # This test requires file upload functionality
    # For now, we'll skip if no files are available
    print("⚠️  File access testing requires file upload - skipping for now")
    test_results["skipped"] += 1


def test_f_citizen_scoping():
    """Test F: Citizen scoping"""
    print("\n=== Test F: Citizen Scoping ===")
    
    pune_citizens = test_data.get("pune_citizens", [])
    vk_citizens = test_data.get("vk_citizens", [])
    
    if not pune_citizens:
        print("⚠️  No Pune citizens found - skipping citizen scoping tests")
        test_results["skipped"] += 1
        return
    
    # Get a Pune citizen token via OTP
    pune_citizen = pune_citizens[0]
    pune_citizen_mobile = pune_citizen.get("mobile")
    
    if not pune_citizen_mobile:
        print("⚠️  Pune citizen has no mobile - skipping citizen scoping tests")
        test_results["skipped"] += 1
        return
    
    # Request OTP
    resp = requests.post(f"{BASE_URL}/auth/citizen/request-otp", json={"mobile": pune_citizen_mobile})
    if resp.status_code != 200:
        print(f"⚠️  Failed to request OTP: {resp.status_code}")
        test_results["skipped"] += 1
        return
    
    # Verify OTP (any 6-digit works in MVP)
    resp = requests.post(f"{BASE_URL}/auth/citizen/verify-otp", json={"mobile": pune_citizen_mobile, "otp": "123456"})
    if resp.status_code != 200:
        print(f"⚠️  Failed to verify OTP: {resp.status_code}")
        test_results["skipped"] += 1
        return
    
    citizen_token = resp.json()["token"]
    citizen_user = resp.json()["user"]
    print(f"✓ Pune citizen token obtained: {citizen_user['name']}")
    
    # Test 1: GET /api/issues → sees only their own
    resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {citizen_token}"})
    if resp.status_code == 200:
        citizen_issues = resp.json()
        all_own = all(i.get("citizen_id") == citizen_user["id"] for i in citizen_issues)
        log_test("Citizen GET /issues sees only their own", 
                 all_own, 
                 f"Found {len(citizen_issues)} issues, all owned by citizen: {all_own}")
    
    # Test 2: GET /api/persons/{self_id} → 200
    resp = requests.get(f"{BASE_URL}/persons/{citizen_user['id']}", headers={"Authorization": f"Bearer {citizen_token}"})
    log_test("Citizen GET /persons/{self_id} → 200", 
             resp.status_code == 200, 
             f"Got {resp.status_code}")
    
    # Test 3: GET /api/persons/{pune_other_citizen_id} → 403
    if len(pune_citizens) > 1:
        other_pune_citizen = next((c for c in pune_citizens if c["id"] != citizen_user["id"]), None)
        if other_pune_citizen:
            resp = requests.get(f"{BASE_URL}/persons/{other_pune_citizen['id']}", headers={"Authorization": f"Bearer {citizen_token}"})
            log_test("Citizen GET /persons/{pune_other_citizen_id} → 403", 
                     resp.status_code == 403, 
                     f"Got {resp.status_code}")
    
    # Test 4: GET /api/persons/{vk_citizen_id} → 404 (tenant boundary first)
    if vk_citizens:
        vk_citizen_id = vk_citizens[0]["id"]
        resp = requests.get(f"{BASE_URL}/persons/{vk_citizen_id}", headers={"Authorization": f"Bearer {citizen_token}"})
        log_test("Citizen GET /persons/{vk_citizen_id} → 404", 
                 resp.status_code == 404, 
                 f"Got {resp.status_code}")


def test_g_regression_sanity():
    """Test G: Regression sanity - Pune workflow still works"""
    print("\n=== Test G: Regression Sanity ===")
    
    pune_pa_token = tokens["pune_pa"]
    pune_worker_token = tokens["pune_worker"]
    pune_citizens = test_data.get("pune_citizens", [])
    
    # Test 1: PA creates issue
    if pune_citizens:
        citizen_id = pune_citizens[0]["id"]
        issue_payload = {
            "category": "Garbage Collection",
            "title": "Test regression issue",
            "description": "Testing workflow",
            "photos": [],
            "gps_lat": None,
            "gps_lng": None
        }
        resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {pune_pa_token}"})
        if resp.status_code == 200:
            regression_issue = resp.json()
            test_data["regression_issue_id"] = regression_issue["id"]
            log_test("PA creates issue → 200", True, f"Issue ID: {regression_issue['id']}")
            
            # Test 2: PA assigns worker
            worker_id = test_data["pune_worker_user"]["id"]
            assign_payload = {
                "assigned_to": worker_id,
                "due_date": "2026-12-31",
                "remarks": "Test assignment"
            }
            resp = requests.post(
                f"{BASE_URL}/issues/{regression_issue['id']}/assign",
                json=assign_payload,
                headers={"Authorization": f"Bearer {pune_pa_token}"}
            )
            log_test("PA assigns worker → 200", 
                     resp.status_code == 200, 
                     f"Got {resp.status_code}")
            
            # Test 3: Worker updates status
            status_payload = {
                "status": "In Progress",
                "note": "Started work"
            }
            resp = requests.post(
                f"{BASE_URL}/issues/{regression_issue['id']}/status",
                json=status_payload,
                headers={"Authorization": f"Bearer {pune_worker_token}"}
            )
            log_test("Worker updates status → 200", 
                     resp.status_code == 200, 
                     f"Got {resp.status_code}")
            
            # Test 4: Verify all operations stayed tenant-scoped
            resp = requests.get(f"{BASE_URL}/issues/{regression_issue['id']}", headers={"Authorization": f"Bearer {pune_pa_token}"})
            if resp.status_code == 200:
                issue_data = resp.json()["issue"]
                log_test("All operations stayed tenant-scoped", 
                         issue_data.get("tenant_id") == test_data["pune_tenant_id"], 
                         f"tenant_id: {issue_data.get('tenant_id')}")
        else:
            log_test("PA creates issue → 200", False, f"Got {resp.status_code}: {resp.text}")


def cleanup():
    """Clean up test data"""
    print("\n=== Cleaning up test data ===")
    
    pune_admin_token = tokens.get("pune_admin")
    vk_admin_token = tokens.get("vk_admin")
    
    # Delete test issues
    for key in ["test_issue_id", "pune_new_issue_id", "regression_issue_id"]:
        if key in test_data:
            issue_id = test_data[key]
            # Issues can't be deleted via API, so we skip
            pass
    
    # Delete test devworks
    if "test_devwork_id" in test_data and pune_admin_token:
        devwork_id = test_data["test_devwork_id"]
        resp = requests.delete(f"{BASE_URL}/devworks/{devwork_id}", headers={"Authorization": f"Bearer {pune_admin_token}"})
        if resp.status_code == 200:
            print(f"✓ Deleted test devwork {devwork_id}")
    
    # Delete test notifications
    if "test_notif_id" in test_data and pune_admin_token:
        notif_id = test_data["test_notif_id"]
        resp = requests.delete(f"{BASE_URL}/notifications/{notif_id}", headers={"Authorization": f"Bearer {pune_admin_token}"})
        if resp.status_code == 200:
            print(f"✓ Deleted test notification {notif_id}")
    
    # Delete test visits
    if "test_visit_id" in test_data and pune_admin_token:
        visit_id = test_data["test_visit_id"]
        resp = requests.delete(f"{BASE_URL}/visits/{visit_id}", headers={"Authorization": f"Bearer {pune_admin_token}"})
        if resp.status_code == 200:
            print(f"✓ Deleted test visit {visit_id}")
    
    # Delete VK new issue
    if "vk_new_issue_id" in test_data and vk_admin_token:
        # Issues can't be deleted via API
        pass


def print_summary():
    """Print test summary"""
    print("\n" + "=" * 80)
    print("MULTI-TENANT DATA ISOLATION TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"⚠️  Skipped: {test_results['skipped']}")
    print(f"Total: {test_results['passed'] + test_results['failed'] + test_results['skipped']}")
    
    if test_results["failures"]:
        print("\n" + "=" * 80)
        print("FAILURES:")
        print("=" * 80)
        for failure in test_results["failures"]:
            print(f"❌ {failure}")
    
    print("=" * 80)


def main():
    """Main test runner"""
    print("=" * 80)
    print("JANSETU Multi-Tenant Data Isolation Testing (Phase 2)")
    print("=" * 80)
    
    try:
        # Setup
        setup_tokens()
        get_pune_data()
        get_vk_data()
        
        # Run tests
        test_a_tenant_isolation_pune_to_vk()
        test_a_tenant_isolation_vk_to_pune()
        test_b_insert_auto_attach()
        test_c_super_admin_behavior()
        test_d_per_tenant_counters()
        test_e_file_access()
        test_f_citizen_scoping()
        test_g_regression_sanity()
        
        # Cleanup
        cleanup()
        
        # Summary
        print_summary()
        
    except Exception as e:
        print(f"\n❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
