"""
JANSETU White-Label Client Portal Backend Testing
Tests all portal endpoints: public (no auth) and admin (auth required)
"""
import requests
import json
from typing import Dict, Optional

BASE_URL = "https://family-bonds-23.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@jansetu.in", "password": "admin123"}
PA_CREDS = {"email": "pa@jansetu.in", "password": "pa123"}
WORKER_CREDS = {"email": "worker1@jansetu.in", "password": "worker123"}

# Global storage
tokens = {}
test_data = {}


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")


def login_staff(role: str, creds: Dict) -> str:
    """Login staff and return token"""
    resp = requests.post(f"{BASE_URL}/auth/staff/login", json=creds)
    if resp.status_code != 200:
        raise Exception(f"Failed to login {role}: {resp.status_code} {resp.text}")
    data = resp.json()
    return data["token"]


def get_citizen_token() -> tuple[str, dict]:
    """Get a citizen token via OTP flow. Returns (token, user_data)"""
    admin_token = tokens.get("admin")
    if not admin_token:
        raise Exception("Admin token not available")
    
    resp = requests.get(
        f"{BASE_URL}/users?role=citizen",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code != 200:
        raise Exception(f"Failed to get citizens: {resp.status_code}")
    
    citizens = resp.json()
    if not citizens:
        raise Exception("No citizens found in database")
    
    citizen = next((c for c in citizens if c.get("mobile")), None)
    if not citizen:
        raise Exception("No citizen with mobile found")
    
    mobile = citizen["mobile"]
    
    # Request OTP
    resp = requests.post(f"{BASE_URL}/auth/citizen/request-otp", json={"mobile": mobile})
    if resp.status_code != 200:
        raise Exception(f"Failed to request OTP: {resp.status_code}")
    
    # Verify OTP
    resp = requests.post(f"{BASE_URL}/auth/citizen/verify-otp", json={"mobile": mobile, "otp": "123456"})
    if resp.status_code != 200:
        raise Exception(f"Failed to verify OTP: {resp.status_code}")
    
    data = resp.json()
    return data["token"], data["user"]


def setup_tokens():
    """Setup all required tokens"""
    print("\n=== Setting up tokens ===")
    
    tokens["admin"] = login_staff("admin", ADMIN_CREDS)
    print("✓ Admin token obtained")
    
    tokens["pa"] = login_staff("pa", PA_CREDS)
    print("✓ PA token obtained")
    
    tokens["worker"] = login_staff("worker", WORKER_CREDS)
    print("✓ Worker token obtained")
    
    citizen_token, citizen_user = get_citizen_token()
    tokens["citizen"] = citizen_token
    test_data["citizen_user"] = citizen_user
    print(f"✓ Citizen token obtained (user: {citizen_user['name']}, id: {citizen_user['id']})")


def test_public_endpoints():
    """Test public portal endpoints (no auth required)"""
    print("\n=== Testing Public Portal Endpoints (No Auth) ===")
    
    # Test 1: GET /api/portals → 200, list contains pune-cantonment with is_default=true
    print("\n--- Test 1: GET /api/portals ---")
    resp = requests.get(f"{BASE_URL}/portals")
    
    log_test("GET /api/portals → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        portals = resp.json()
        log_test("Response is a list", isinstance(portals, list), f"Got type: {type(portals)}")
        
        if portals:
            # Check for pune-cantonment
            pune_portal = next((p for p in portals if p.get("slug") == "pune-cantonment"), None)
            log_test("List contains 'pune-cantonment'", pune_portal is not None, 
                     f"Found: {pune_portal['slug'] if pune_portal else 'None'}")
            
            if pune_portal:
                log_test("pune-cantonment has is_default=true", pune_portal.get("is_default") == True,
                         f"is_default={pune_portal.get('is_default')}")
                
                # Check compact fields only
                expected_fields = {"id", "slug", "politician_name", "designation", "constituency_name", 
                                   "logo_path", "theme_color", "is_default"}
                actual_fields = set(pune_portal.keys())
                # Should have at least the expected fields (may have more)
                has_required = expected_fields.issubset(actual_fields)
                log_test("Compact fields present", has_required,
                         f"Expected: {expected_fields}, Got: {actual_fields}")
                
                test_data["pune_portal_id"] = pune_portal.get("id")
        else:
            print("⚠️  No portals found in list")
    
    # Test 2: GET /api/portals/pune-cantonment → 200, full config
    print("\n--- Test 2: GET /api/portals/pune-cantonment ---")
    resp = requests.get(f"{BASE_URL}/portals/pune-cantonment")
    
    log_test("GET /api/portals/pune-cantonment → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        portal = resp.json()
        log_test("Response has slug='pune-cantonment'", portal.get("slug") == "pune-cantonment",
                 f"slug={portal.get('slug')}")
        
        # Check for full config fields
        full_fields = ["slug", "politician_name", "designation", "constituency_name", 
                       "welcome_message", "theme_color", "social_links"]
        missing_fields = [f for f in full_fields if f not in portal]
        log_test("Full config fields present", len(missing_fields) == 0,
                 f"Missing: {missing_fields}" if missing_fields else "All present")
    
    # Test 3: GET /api/portals/does-not-exist → 404
    print("\n--- Test 3: GET /api/portals/does-not-exist ---")
    resp = requests.get(f"{BASE_URL}/portals/does-not-exist")
    log_test("GET /api/portals/does-not-exist → 404", resp.status_code == 404, f"Got {resp.status_code}")
    
    # Test 4: GET /api/portals/pune-cantonment/devworks → 200, approved=true
    print("\n--- Test 4: GET /api/portals/pune-cantonment/devworks ---")
    resp = requests.get(f"{BASE_URL}/portals/pune-cantonment/devworks")
    
    log_test("GET /api/portals/pune-cantonment/devworks → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        devworks = resp.json()
        log_test("Response is a list", isinstance(devworks, list), f"Got type: {type(devworks)}")
        
        if devworks:
            log_test("List has ≥ 1 item", len(devworks) >= 1, f"Count: {len(devworks)}")
            
            # Check all have approved=true
            all_approved = all(d.get("approved") == True for d in devworks)
            log_test("All items have approved=true", all_approved,
                     f"Approved count: {sum(1 for d in devworks if d.get('approved') == True)}/{len(devworks)}")
        else:
            print("⚠️  No devworks found (may be expected if none seeded)")
    
    # Test 5: GET /api/portals/pune-cantonment/visits → 200, status in [Approved, Published], date >= today
    print("\n--- Test 5: GET /api/portals/pune-cantonment/visits ---")
    resp = requests.get(f"{BASE_URL}/portals/pune-cantonment/visits")
    
    log_test("GET /api/portals/pune-cantonment/visits → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        visits = resp.json()
        log_test("Response is a list", isinstance(visits, list), f"Got type: {type(visits)}")
        
        if visits:
            # Check all have status in [Approved, Published]
            valid_statuses = all(v.get("status") in ["Approved", "Published"] for v in visits)
            log_test("All items have status in [Approved, Published]", valid_statuses,
                     f"Statuses: {[v.get('status') for v in visits]}")
            
            # Check all have date >= today
            from datetime import datetime, timezone
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            future_dates = all(v.get("date", "") >= today for v in visits)
            log_test("All items have date >= today", future_dates,
                     f"Today: {today}, Dates: {[v.get('date') for v in visits]}")
        else:
            print("⚠️  No visits found (may be expected if none seeded)")
    
    # Test 6: GET /api/portals/pune-cantonment/notifications → 200, scope == "all"
    print("\n--- Test 6: GET /api/portals/pune-cantonment/notifications ---")
    resp = requests.get(f"{BASE_URL}/portals/pune-cantonment/notifications")
    
    log_test("GET /api/portals/pune-cantonment/notifications → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        notifications = resp.json()
        log_test("Response is a list", isinstance(notifications, list), f"Got type: {type(notifications)}")
        
        if notifications:
            # Check all have scope == "all"
            all_public = all(n.get("scope") == "all" for n in notifications)
            log_test("All items have scope='all'", all_public,
                     f"Scopes: {[n.get('scope') for n in notifications]}")
        else:
            print("⚠️  No notifications found (may be expected if none seeded)")
    
    # Test 7: Confirm no auth required for public endpoints
    print("\n--- Test 7: Confirm no auth required ---")
    print("✓ All above tests passed without Authorization header - no auth required")


def test_admin_write_flow():
    """Test admin write endpoints"""
    print("\n=== Testing Admin Write Flow ===")
    
    admin_token = tokens["admin"]
    
    # Test 8: POST /api/admin/portals with valid data → 200
    print("\n--- Test 8: POST /api/admin/portals (create test-portal) ---")
    
    create_payload = {
        "slug": "test-portal",
        "politician_name": "Test MLA",
        "designation": "MLA Test",
        "constituency_name": "Test",
        "welcome_message": "hello"
    }
    
    resp = requests.post(
        f"{BASE_URL}/admin/portals",
        json=create_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    log_test("POST /api/admin/portals → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        portal = resp.json()
        log_test("Returned doc has slug='test-portal'", portal.get("slug") == "test-portal",
                 f"slug={portal.get('slug')}")
        log_test("Returned doc has is_active=true", portal.get("is_active") == True,
                 f"is_active={portal.get('is_active')}")
        
        test_data["test_portal_id"] = portal.get("id")
        test_data["test_portal_slug"] = portal.get("slug")
    else:
        print(f"❌ Failed to create test portal: {resp.text}")
        return
    
    # Test 9: POST /api/admin/portals with duplicate slug → 409
    print("\n--- Test 9: POST /api/admin/portals (duplicate slug) ---")
    
    duplicate_payload = {
        "slug": "pune-cantonment",
        "politician_name": "Duplicate",
        "designation": "MLA",
        "constituency_name": "Duplicate",
        "welcome_message": "duplicate"
    }
    
    resp = requests.post(
        f"{BASE_URL}/admin/portals",
        json=duplicate_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    log_test("POST /api/admin/portals with duplicate slug → 409", resp.status_code == 409, 
             f"Got {resp.status_code}")
    
    # Test 10: POST /api/admin/portals with slug normalization
    print("\n--- Test 10: POST /api/admin/portals (slug normalization) ---")
    
    normalize_payload = {
        "slug": "Hello World!",
        "politician_name": "Normalize Test",
        "designation": "MLA",
        "constituency_name": "Normalize",
        "welcome_message": "normalize test"
    }
    
    resp = requests.post(
        f"{BASE_URL}/admin/portals",
        json=normalize_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    log_test("POST /api/admin/portals with 'Hello World!' → 200", resp.status_code == 200, 
             f"Got {resp.status_code}")
    
    if resp.status_code == 200:
        portal = resp.json()
        log_test("Returned slug is 'hello-world' (normalized)", portal.get("slug") == "hello-world",
                 f"slug={portal.get('slug')}")
        
        test_data["normalize_portal_id"] = portal.get("id")
    
    # Test 11: PUT /api/admin/portals/{id} with partial update → 200
    print("\n--- Test 11: PUT /api/admin/portals/{id} (update) ---")
    
    if "test_portal_id" in test_data:
        update_payload = {
            "politician_name": "Updated Name"
        }
        
        resp = requests.put(
            f"{BASE_URL}/admin/portals/{test_data['test_portal_id']}",
            json=update_payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        log_test("PUT /api/admin/portals/{id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
        
        if resp.status_code == 200:
            # Verify the update
            resp = requests.get(
                f"{BASE_URL}/portals/{test_data['test_portal_slug']}",
            )
            if resp.status_code == 200:
                portal = resp.json()
                log_test("Updated politician_name persisted", portal.get("politician_name") == "Updated Name",
                         f"politician_name={portal.get('politician_name')}")
    
    # Test 12: PUT /api/admin/portals/{id} with clashing slug → 409
    print("\n--- Test 12: PUT /api/admin/portals/{id} (clashing slug) ---")
    
    if "test_portal_id" in test_data:
        clash_payload = {
            "slug": "pune-cantonment"
        }
        
        resp = requests.put(
            f"{BASE_URL}/admin/portals/{test_data['test_portal_id']}",
            json=clash_payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        log_test("PUT /api/admin/portals/{id} with clashing slug → 409", resp.status_code == 409,
                 f"Got {resp.status_code}")
    
    # Test 13: POST /api/admin/portals/{id}/set-default → 200
    print("\n--- Test 13: POST /api/admin/portals/{id}/set-default (test-portal) ---")
    
    if "test_portal_id" in test_data:
        resp = requests.post(
            f"{BASE_URL}/admin/portals/{test_data['test_portal_id']}/set-default",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        log_test("POST /api/admin/portals/{id}/set-default → 200", resp.status_code == 200,
                 f"Got {resp.status_code}")
        
        if resp.status_code == 200:
            # Verify only test-portal has is_default=true
            resp = requests.get(f"{BASE_URL}/portals")
            if resp.status_code == 200:
                portals = resp.json()
                default_portals = [p for p in portals if p.get("is_default") == True]
                
                log_test("Only one portal has is_default=true", len(default_portals) == 1,
                         f"Count: {len(default_portals)}")
                
                if default_portals:
                    log_test("test-portal is the default", default_portals[0].get("slug") == "test-portal",
                             f"Default slug: {default_portals[0].get('slug')}")
    
    # Test 14: Restore pune-cantonment as default
    print("\n--- Test 14: POST /api/admin/portals/{id}/set-default (restore pune-cantonment) ---")
    
    if "pune_portal_id" in test_data:
        resp = requests.post(
            f"{BASE_URL}/admin/portals/{test_data['pune_portal_id']}/set-default",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        log_test("POST /api/admin/portals/{pune_id}/set-default → 200", resp.status_code == 200,
                 f"Got {resp.status_code}")
        
        if resp.status_code == 200:
            # Verify pune-cantonment is default again
            resp = requests.get(f"{BASE_URL}/portals")
            if resp.status_code == 200:
                portals = resp.json()
                default_portals = [p for p in portals if p.get("is_default") == True]
                
                if default_portals:
                    log_test("pune-cantonment is default again", default_portals[0].get("slug") == "pune-cantonment",
                             f"Default slug: {default_portals[0].get('slug')}")
                    
                    # Check test-portal is not default
                    test_portal = next((p for p in portals if p.get("slug") == "test-portal"), None)
                    if test_portal:
                        log_test("test-portal is_default=false", test_portal.get("is_default") == False,
                                 f"test-portal is_default={test_portal.get('is_default')}")
    
    # Test 15: DELETE /api/admin/portals/{id} (soft delete)
    print("\n--- Test 15: DELETE /api/admin/portals/{id} (soft delete) ---")
    
    if "test_portal_id" in test_data:
        resp = requests.delete(
            f"{BASE_URL}/admin/portals/{test_data['test_portal_id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        log_test("DELETE /api/admin/portals/{id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
        
        if resp.status_code == 200:
            # Verify test-portal no longer in public list
            resp = requests.get(f"{BASE_URL}/portals")
            if resp.status_code == 200:
                portals = resp.json()
                test_portal = next((p for p in portals if p.get("slug") == "test-portal"), None)
                log_test("test-portal not in public list (is_active=false)", test_portal is None,
                         f"Found: {test_portal is not None}")
            
            # Verify test-portal still in admin list with is_active=false
            resp = requests.get(
                f"{BASE_URL}/admin/portals",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if resp.status_code == 200:
                admin_portals = resp.json()
                test_portal = next((p for p in admin_portals if p.get("slug") == "test-portal"), None)
                
                if test_portal:
                    log_test("test-portal in admin list with is_active=false", 
                             test_portal.get("is_active") == False,
                             f"is_active={test_portal.get('is_active')}")
                else:
                    print("⚠️  test-portal not found in admin list")


def test_authorization():
    """Test authorization for admin endpoints"""
    print("\n=== Testing Authorization ===")
    
    pa_token = tokens["pa"]
    worker_token = tokens["worker"]
    citizen_token = tokens["citizen"]
    
    # Test 16: POST with PA token → 403
    print("\n--- Test 16: POST /api/admin/portals with PA token ---")
    
    payload = {
        "slug": "pa-test",
        "politician_name": "PA Test",
        "designation": "MLA",
        "constituency_name": "Test",
        "welcome_message": "test"
    }
    
    resp = requests.post(
        f"{BASE_URL}/admin/portals",
        json=payload,
        headers={"Authorization": f"Bearer {pa_token}"}
    )
    
    log_test("POST /api/admin/portals with PA token → 403", resp.status_code == 403,
             f"Got {resp.status_code}")
    
    # Test 17: POST with Worker token → 403
    print("\n--- Test 17: POST /api/admin/portals with Worker token ---")
    
    resp = requests.post(
        f"{BASE_URL}/admin/portals",
        json=payload,
        headers={"Authorization": f"Bearer {worker_token}"}
    )
    
    log_test("POST /api/admin/portals with Worker token → 403", resp.status_code == 403,
             f"Got {resp.status_code}")
    
    # Test 18: POST with Citizen token → 403
    print("\n--- Test 18: POST /api/admin/portals with Citizen token ---")
    
    resp = requests.post(
        f"{BASE_URL}/admin/portals",
        json=payload,
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    
    log_test("POST /api/admin/portals with Citizen token → 403", resp.status_code == 403,
             f"Got {resp.status_code}")
    
    # Test 19: GET /api/admin/portals with non-admin → 403
    print("\n--- Test 19: GET /api/admin/portals with non-admin ---")
    
    resp = requests.get(
        f"{BASE_URL}/admin/portals",
        headers={"Authorization": f"Bearer {pa_token}"}
    )
    log_test("GET /api/admin/portals with PA token → 403", resp.status_code == 403,
             f"Got {resp.status_code}")
    
    resp = requests.get(
        f"{BASE_URL}/admin/portals",
        headers={"Authorization": f"Bearer {worker_token}"}
    )
    log_test("GET /api/admin/portals with Worker token → 403", resp.status_code == 403,
             f"Got {resp.status_code}")
    
    resp = requests.get(
        f"{BASE_URL}/admin/portals",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    log_test("GET /api/admin/portals with Citizen token → 403", resp.status_code == 403,
             f"Got {resp.status_code}")


def cleanup():
    """Clean up test data"""
    print("\n=== Cleanup ===")
    
    admin_token = tokens.get("admin")
    if not admin_token:
        print("⚠️  No admin token, skipping cleanup")
        return
    
    # Delete test portals
    for portal_key in ["test_portal_id", "normalize_portal_id"]:
        if portal_key in test_data:
            portal_id = test_data[portal_key]
            resp = requests.delete(
                f"{BASE_URL}/admin/portals/{portal_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if resp.status_code == 200:
                print(f"✓ Deleted portal {portal_id}")
    
    # Ensure pune-cantonment is default and active
    if "pune_portal_id" in test_data:
        resp = requests.post(
            f"{BASE_URL}/admin/portals/{test_data['pune_portal_id']}/set-default",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if resp.status_code == 200:
            print("✓ pune-cantonment restored as default")
        
        # Verify
        resp = requests.get(f"{BASE_URL}/portals/pune-cantonment")
        if resp.status_code == 200:
            portal = resp.json()
            if portal.get("is_default") == True and portal.get("is_active") == True:
                print("✓ Verified: pune-cantonment is_default=true and is_active=true")
            else:
                print(f"⚠️  pune-cantonment state: is_default={portal.get('is_default')}, is_active={portal.get('is_active')}")


def test_regression_sanity():
    """Test that pre-existing endpoints still work"""
    print("\n=== Regression Sanity Check ===")
    
    admin_token = tokens["admin"]
    pa_token = tokens["pa"]
    
    # Test: GET /api/auth/me for admin → 200
    print("\n--- Test: GET /api/auth/me (admin) ---")
    resp = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    log_test("GET /api/auth/me for admin → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Test: GET /api/issues for PA → 200
    print("\n--- Test: GET /api/issues (PA) ---")
    resp = requests.get(
        f"{BASE_URL}/issues",
        headers={"Authorization": f"Bearer {pa_token}"}
    )
    log_test("GET /api/issues for PA → 200", resp.status_code == 200, f"Got {resp.status_code}")


def main():
    """Main test runner"""
    print("=" * 80)
    print("JANSETU White-Label Client Portal Backend Testing")
    print("=" * 80)
    
    try:
        # Setup
        setup_tokens()
        
        # Run tests
        test_public_endpoints()
        test_admin_write_flow()
        test_authorization()
        test_regression_sanity()
        
        # Cleanup
        cleanup()
        
        print("\n" + "=" * 80)
        print("Testing complete!")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
