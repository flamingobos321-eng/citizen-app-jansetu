"""
JANSETU Backend Security Fixes Testing
Tests three specific areas: C1 (access control), M1 (inverse gender), M5 (file access)
"""
import os
import requests
import json
from typing import Dict, Optional

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8000") + "/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@jansetu.in", "password": "admin123"}
PA_CREDS = {"email": "pa@jansetu.in", "password": "pa123"}
WORKER_CREDS = {"email": "worker1@jansetu.in", "password": "worker123"}

# Global tokens storage
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
    # First, get a list of citizens from admin
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
    
    # Pick first citizen with mobile
    citizen = next((c for c in citizens if c.get("mobile")), None)
    if not citizen:
        raise Exception("No citizen with mobile found")
    
    mobile = citizen["mobile"]
    
    # Request OTP
    resp = requests.post(f"{BASE_URL}/auth/citizen/request-otp", json={"mobile": mobile})
    if resp.status_code != 200:
        raise Exception(f"Failed to request OTP: {resp.status_code}")
    
    # Verify OTP (any 6 digits work in MVP)
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


def test_c1_access_control():
    """Test C1: Access control matrix for key endpoints"""
    print("\n=== Testing C1: Access Control Matrix ===")
    
    admin_token = tokens["admin"]
    pa_token = tokens["pa"]
    worker_token = tokens["worker"]
    citizen_token = tokens["citizen"]
    citizen_user = test_data["citizen_user"]
    
    # Test 1: GET /api/users - staff only
    print("\n--- Testing GET /api/users ---")
    
    # Citizen should get 403
    resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {citizen_token}"})
    log_test("Citizen GET /users → 403", resp.status_code == 403, f"Got {resp.status_code}")
    
    # Worker should get 200
    resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {worker_token}"})
    log_test("Worker GET /users → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # PA should get 200
    resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {pa_token}"})
    log_test("PA GET /users → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Admin should get 200
    resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {admin_token}"})
    log_test("Admin GET /users → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Test 2: GET /api/households - staff only
    print("\n--- Testing GET /api/households ---")
    
    # Citizen should get 403
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {citizen_token}"})
    log_test("Citizen GET /households → 403", resp.status_code == 403, f"Got {resp.status_code}")
    
    # Worker should get 200
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {worker_token}"})
    log_test("Worker GET /households → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # PA should get 200
    resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {pa_token}"})
    log_test("PA GET /households → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Test 3: GET /api/households/{id} - staff OR own household
    print("\n--- Testing GET /api/households/{id} ---")
    
    citizen_hh_id = citizen_user.get("household_id")
    if citizen_hh_id:
        # Citizen accessing own household → 200
        resp = requests.get(f"{BASE_URL}/households/{citizen_hh_id}", headers={"Authorization": f"Bearer {citizen_token}"})
        log_test("Citizen GET /households/{own_hh_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
        
        # Get another household ID for testing
        resp = requests.get(f"{BASE_URL}/households", headers={"Authorization": f"Bearer {admin_token}"})
        if resp.status_code == 200:
            households = resp.json()
            other_hh = next((h for h in households if h["id"] != citizen_hh_id), None)
            if other_hh:
                # Citizen accessing other household → 403
                resp = requests.get(f"{BASE_URL}/households/{other_hh['id']}", headers={"Authorization": f"Bearer {citizen_token}"})
                log_test("Citizen GET /households/{other_hh_id} → 403", resp.status_code == 403, f"Got {resp.status_code}")
                
                # Staff accessing any household → 200
                resp = requests.get(f"{BASE_URL}/households/{other_hh['id']}", headers={"Authorization": f"Bearer {pa_token}"})
                log_test("PA GET /households/{any_hh_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
    else:
        print("⚠️  Citizen has no household_id, skipping household access tests")
    
    # Test 4: GET /api/issues/{id} - complex access control
    print("\n--- Testing GET /api/issues/{id} ---")
    
    # Get citizen's own issue
    resp = requests.get(f"{BASE_URL}/issues?mine=true", headers={"Authorization": f"Bearer {citizen_token}"})
    if resp.status_code == 200:
        citizen_issues = resp.json()
        if citizen_issues:
            own_issue_id = citizen_issues[0]["id"]
            
            # Citizen accessing own issue → 200
            resp = requests.get(f"{BASE_URL}/issues/{own_issue_id}", headers={"Authorization": f"Bearer {citizen_token}"})
            log_test("Citizen GET /issues/{own_issue_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
            
            # Staff accessing any issue → 200
            resp = requests.get(f"{BASE_URL}/issues/{own_issue_id}", headers={"Authorization": f"Bearer {pa_token}"})
            log_test("PA GET /issues/{any_issue_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
            
            # Get another citizen's issue
            resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {admin_token}"})
            if resp.status_code == 200:
                all_issues = resp.json()
                other_issue = next((i for i in all_issues if i.get("citizen_id") != citizen_user["id"]), None)
                if other_issue:
                    # Citizen accessing other's issue → 403
                    resp = requests.get(f"{BASE_URL}/issues/{other_issue['id']}", headers={"Authorization": f"Bearer {citizen_token}"})
                    log_test("Citizen GET /issues/{other_issue_id} → 403", resp.status_code == 403, f"Got {resp.status_code}")
                    
                    # Test worker access - assigned vs unassigned
                    if other_issue.get("assigned_to"):
                        assigned_worker_id = other_issue["assigned_to"]
                        # If worker1 is assigned, they should get 200
                        resp = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {admin_token}"})
                        workers = [u for u in resp.json() if u["role"] == "worker"]
                        worker1_user = next((w for w in workers if w["email"] == "worker1@jansetu.in"), None)
                        
                        if worker1_user and worker1_user["id"] == assigned_worker_id:
                            resp = requests.get(f"{BASE_URL}/issues/{other_issue['id']}", headers={"Authorization": f"Bearer {worker_token}"})
                            log_test("Assigned worker GET /issues/{assigned_issue_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
                        else:
                            # Worker not assigned → 403
                            resp = requests.get(f"{BASE_URL}/issues/{other_issue['id']}", headers={"Authorization": f"Bearer {worker_token}"})
                            log_test("Unassigned worker GET /issues/{unassigned_issue_id} → 403", resp.status_code == 403, f"Got {resp.status_code}")
        else:
            print("⚠️  Citizen has no issues, creating one for testing")
            # Create an issue for testing
            issue_payload = {
                "category": "Road Repair",
                "title": "Test issue for access control",
                "description": "Testing access control",
                "photos": [],
                "gps_lat": None,
                "gps_lng": None
            }
            resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {citizen_token}"})
            if resp.status_code == 200:
                own_issue_id = resp.json()["id"]
                
                # Citizen accessing own issue → 200
                resp = requests.get(f"{BASE_URL}/issues/{own_issue_id}", headers={"Authorization": f"Bearer {citizen_token}"})
                log_test("Citizen GET /issues/{own_issue_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Test 5: GET /api/persons/{id} - staff OR self
    print("\n--- Testing GET /api/persons/{id} ---")
    
    citizen_id = citizen_user["id"]
    
    # Citizen accessing own person profile → 200
    resp = requests.get(f"{BASE_URL}/persons/{citizen_id}", headers={"Authorization": f"Bearer {citizen_token}"})
    log_test("Citizen GET /persons/{self_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Get another person ID
    resp = requests.get(f"{BASE_URL}/users?role=citizen", headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        citizens = resp.json()
        other_citizen = next((c for c in citizens if c["id"] != citizen_id), None)
        if other_citizen:
            # Citizen accessing other person → 403
            resp = requests.get(f"{BASE_URL}/persons/{other_citizen['id']}", headers={"Authorization": f"Bearer {citizen_token}"})
            log_test("Citizen GET /persons/{other_id} → 403", resp.status_code == 403, f"Got {resp.status_code}")
            
            # Staff accessing any person → 200
            resp = requests.get(f"{BASE_URL}/persons/{other_citizen['id']}", headers={"Authorization": f"Bearer {pa_token}"})
            log_test("PA GET /persons/{any_id} → 200", resp.status_code == 200, f"Got {resp.status_code}")


def test_m1_inverse_gender():
    """Test M1: Family relationship inverse-gender fix"""
    print("\n=== Testing M1: Family Relationship Inverse Gender ===")
    
    pa_token = tokens["pa"]
    admin_token = tokens["admin"]
    
    # Get two citizens - one male, one female
    resp = requests.get(f"{BASE_URL}/users?role=citizen", headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print("❌ Failed to get citizens for M1 test")
        return
    
    citizens = resp.json()
    male_citizen = next((c for c in citizens if c.get("gender", "").lower() in ["male", "m"]), None)
    female_citizen = next((c for c in citizens if c.get("gender", "").lower() in ["female", "f"]), None)
    
    if not male_citizen or not female_citizen:
        print("⚠️  Need both male and female citizens for M1 test. Skipping.")
        return
    
    print(f"Using male citizen: {male_citizen['name']} (id: {male_citizen['id']})")
    print(f"Using female citizen: {female_citizen['name']} (id: {female_citizen['id']})")
    
    # Test 1: Create Father relationship from male to female
    print("\n--- Testing Father relationship (Male → Female) ---")
    
    rel_payload = {
        "person_a": male_citizen["id"],
        "person_b": female_citizen["id"],
        "type": "Father",
        "since": "1994",
        "notes": "Test relationship for M1"
    }
    
    resp = requests.post(f"{BASE_URL}/relationships", json=rel_payload, headers={"Authorization": f"Bearer {pa_token}"})
    if resp.status_code != 200:
        print(f"❌ Failed to create Father relationship: {resp.status_code} {resp.text}")
        return
    
    rel_data = resp.json()
    test_data["father_rel_id"] = rel_data["id"]
    print(f"✓ Created Father relationship (id: {rel_data['id']})")
    
    # Get person B's profile (female) - should show display_type = "Father"
    resp = requests.get(f"{BASE_URL}/persons/{female_citizen['id']}", headers={"Authorization": f"Bearer {pa_token}"})
    if resp.status_code != 200:
        print(f"❌ Failed to get person B profile: {resp.status_code}")
        return
    
    person_b_data = resp.json()
    relationships_b = person_b_data.get("relationships", [])
    father_rel_b = next((r for r in relationships_b if r["id"] == rel_data["id"]), None)
    
    if father_rel_b:
        display_type_b = father_rel_b.get("display_type")
        log_test("Person B (Female) sees display_type='Father'", display_type_b == "Father", f"Got '{display_type_b}'")
    else:
        print("❌ Relationship not found in person B's profile")
    
    # Get person A's profile (male) - should show display_type = "Daughter"
    resp = requests.get(f"{BASE_URL}/persons/{male_citizen['id']}", headers={"Authorization": f"Bearer {pa_token}"})
    if resp.status_code != 200:
        print(f"❌ Failed to get person A profile: {resp.status_code}")
        return
    
    person_a_data = resp.json()
    relationships_a = person_a_data.get("relationships", [])
    father_rel_a = next((r for r in relationships_a if r["id"] == rel_data["id"]), None)
    
    if father_rel_a:
        display_type_a = father_rel_a.get("display_type")
        log_test("Person A (Male) sees display_type='Daughter' (inverse based on OTHER's gender)", 
                 display_type_a == "Daughter", f"Got '{display_type_a}'")
    else:
        print("❌ Relationship not found in person A's profile")
    
    # Test 2: Brother relationship between two males
    print("\n--- Testing Brother relationship (Male → Male) ---")
    
    # Find another male citizen
    male_citizen_2 = next((c for c in citizens if c.get("gender", "").lower() in ["male", "m"] and c["id"] != male_citizen["id"]), None)
    
    if male_citizen_2:
        rel_payload = {
            "person_a": male_citizen["id"],
            "person_b": male_citizen_2["id"],
            "type": "Brother",
            "since": "2000",
            "notes": "Test Brother relationship"
        }
        
        resp = requests.post(f"{BASE_URL}/relationships", json=rel_payload, headers={"Authorization": f"Bearer {pa_token}"})
        if resp.status_code == 200:
            rel_data = resp.json()
            test_data["brother_rel_id"] = rel_data["id"]
            
            # Both should see "Brother"
            resp = requests.get(f"{BASE_URL}/persons/{male_citizen['id']}", headers={"Authorization": f"Bearer {pa_token}"})
            if resp.status_code == 200:
                person_data = resp.json()
                brother_rel = next((r for r in person_data.get("relationships", []) if r["id"] == rel_data["id"]), None)
                if brother_rel:
                    log_test("Male A sees display_type='Brother' (symmetric)", 
                             brother_rel.get("display_type") == "Brother", f"Got '{brother_rel.get('display_type')}'")
            
            resp = requests.get(f"{BASE_URL}/persons/{male_citizen_2['id']}", headers={"Authorization": f"Bearer {pa_token}"})
            if resp.status_code == 200:
                person_data = resp.json()
                brother_rel = next((r for r in person_data.get("relationships", []) if r["id"] == rel_data["id"]), None)
                if brother_rel:
                    log_test("Male B sees display_type='Brother' (symmetric)", 
                             brother_rel.get("display_type") == "Brother", f"Got '{brother_rel.get('display_type')}'")
    else:
        print("⚠️  Need another male citizen for Brother test. Skipping.")
    
    # Test 3: Brother relationship from male to female
    print("\n--- Testing Brother relationship (Male → Female) ---")
    
    rel_payload = {
        "person_a": male_citizen["id"],
        "person_b": female_citizen["id"],
        "type": "Brother",
        "since": "1995",
        "notes": "Test Brother cross-gender"
    }
    
    # First delete the Father relationship to avoid conflicts
    if "father_rel_id" in test_data:
        requests.delete(f"{BASE_URL}/relationships/{test_data['father_rel_id']}", headers={"Authorization": f"Bearer {pa_token}"})
    
    resp = requests.post(f"{BASE_URL}/relationships", json=rel_payload, headers={"Authorization": f"Bearer {pa_token}"})
    if resp.status_code == 200:
        rel_data = resp.json()
        test_data["brother_cross_rel_id"] = rel_data["id"]
        
        # Female should see "Brother" (he is her brother)
        resp = requests.get(f"{BASE_URL}/persons/{female_citizen['id']}", headers={"Authorization": f"Bearer {pa_token}"})
        if resp.status_code == 200:
            person_data = resp.json()
            brother_rel = next((r for r in person_data.get("relationships", []) if r["id"] == rel_data["id"]), None)
            if brother_rel:
                log_test("Female sees display_type='Brother' (he is her brother)", 
                         brother_rel.get("display_type") == "Brother", f"Got '{brother_rel.get('display_type')}'")
        
        # Male should see "Sister" (she is his sister - inverse based on OTHER's gender)
        resp = requests.get(f"{BASE_URL}/persons/{male_citizen['id']}", headers={"Authorization": f"Bearer {pa_token}"})
        if resp.status_code == 200:
            person_data = resp.json()
            brother_rel = next((r for r in person_data.get("relationships", []) if r["id"] == rel_data["id"]), None)
            if brother_rel:
                log_test("Male sees display_type='Sister' (inverse based on OTHER's gender)", 
                         brother_rel.get("display_type") == "Sister", f"Got '{brother_rel.get('display_type')}'")


def test_m5_file_access():
    """Test M5: File access auth + permission"""
    print("\n=== Testing M5: File Access Auth + Permission ===")
    
    admin_token = tokens["admin"]
    citizen_token = tokens["citizen"]
    citizen_user = test_data["citizen_user"]
    worker_token = tokens["worker"]
    pa_token = tokens["pa"]
    
    # First, try to upload a file
    print("\n--- Testing file upload ---")
    
    # Create a simple test image file
    test_file_content = b"fake image content for testing"
    files = {"file": ("test_image.jpg", test_file_content, "image/jpeg")}
    
    resp = requests.post(
        f"{BASE_URL}/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        print(f"⚠️  File upload failed: {resp.status_code} {resp.text}")
        print("Trying to find existing file in database...")
        
        # Try to get an existing file path from issues
        resp = requests.get(f"{BASE_URL}/issues", headers={"Authorization": f"Bearer {admin_token}"})
        if resp.status_code == 200:
            issues = resp.json()
            issue_with_photo = next((i for i in issues if i.get("photos") and len(i["photos"]) > 0), None)
            if issue_with_photo:
                file_path = issue_with_photo["photos"][0]
                print(f"✓ Found existing file path: {file_path}")
            else:
                print("❌ No existing files found. Cannot test M5.")
                return
        else:
            print("❌ Cannot access issues. Cannot test M5.")
            return
    else:
        upload_data = resp.json()
        file_path = upload_data["path"]
        print(f"✓ File uploaded: {file_path}")
    
    # Test 1: Access file with no token → 401
    print("\n--- Testing file access without token ---")
    resp = requests.get(f"{BASE_URL}/files/{file_path}")
    log_test("GET /files/{path} with no token → 401", resp.status_code == 401, f"Got {resp.status_code}")
    
    # Test 2: Access file with ?t= query param → 200
    print("\n--- Testing file access with ?t= query param ---")
    resp = requests.get(f"{BASE_URL}/files/{file_path}?t={admin_token}")
    log_test("GET /files/{path}?t=<admin_token> → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Test 3: Access file with Authorization header → 200
    print("\n--- Testing file access with Authorization header ---")
    resp = requests.get(f"{BASE_URL}/files/{file_path}", headers={"Authorization": f"Bearer {admin_token}"})
    log_test("GET /files/{path} with Authorization header → 200", resp.status_code == 200, f"Got {resp.status_code}")
    
    # Test 4: Permission logic - create issue with photo as citizen
    print("\n--- Testing file permission logic ---")
    
    # Upload a file as citizen
    files = {"file": ("citizen_test.jpg", test_file_content, "image/jpeg")}
    resp = requests.post(
        f"{BASE_URL}/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    
    if resp.status_code == 200:
        citizen_file_data = resp.json()
        citizen_file_path = citizen_file_data["path"]
        
        # Create an issue with this photo
        issue_payload = {
            "category": "Water Supply",
            "title": "Test issue for file access",
            "description": "Testing file access permissions",
            "photos": [citizen_file_path],
            "gps_lat": None,
            "gps_lng": None
        }
        
        resp = requests.post(f"{BASE_URL}/issues", json=issue_payload, headers={"Authorization": f"Bearer {citizen_token}"})
        if resp.status_code == 200:
            issue_data = resp.json()
            issue_id = issue_data["id"]
            
            # Citizen A accessing their own issue photo → 200
            resp = requests.get(f"{BASE_URL}/files/{citizen_file_path}?t={citizen_token}")
            log_test("Citizen A GET /files/{own_issue_photo}?t=<citizenA_token> → 200", 
                     resp.status_code == 200, f"Got {resp.status_code}")
            
            # Get another citizen token
            resp = requests.get(f"{BASE_URL}/users?role=citizen", headers={"Authorization": f"Bearer {admin_token}"})
            if resp.status_code == 200:
                citizens = resp.json()
                other_citizen = next((c for c in citizens if c["id"] != citizen_user["id"] and c.get("mobile")), None)
                
                if other_citizen:
                    # Get other citizen token
                    resp = requests.post(f"{BASE_URL}/auth/citizen/request-otp", json={"mobile": other_citizen["mobile"]})
                    resp = requests.post(f"{BASE_URL}/auth/citizen/verify-otp", json={"mobile": other_citizen["mobile"], "otp": "123456"})
                    if resp.status_code == 200:
                        other_citizen_token = resp.json()["token"]
                        
                        # Other citizen accessing the photo → 403
                        resp = requests.get(f"{BASE_URL}/files/{citizen_file_path}?t={other_citizen_token}")
                        log_test("Citizen B GET /files/{citizenA_issue_photo}?t=<citizenB_token> → 403", 
                                 resp.status_code == 403, f"Got {resp.status_code}")
            
            # Assign the issue to a worker
            resp = requests.get(f"{BASE_URL}/users?role=worker", headers={"Authorization": f"Bearer {admin_token}"})
            if resp.status_code == 200:
                workers = resp.json()
                if workers:
                    worker_id = workers[0]["id"]
                    
                    assign_payload = {
                        "assigned_to": worker_id,
                        "due_date": "2026-12-31",
                        "remarks": "Test assignment"
                    }
                    
                    resp = requests.post(
                        f"{BASE_URL}/issues/{issue_id}/assign",
                        json=assign_payload,
                        headers={"Authorization": f"Bearer {pa_token}"}
                    )
                    
                    if resp.status_code == 200:
                        # Assigned worker accessing the photo → 200
                        resp = requests.get(f"{BASE_URL}/files/{citizen_file_path}?t={worker_token}")
                        log_test("Assigned worker GET /files/{assigned_issue_photo}?t=<worker_token> → 200", 
                                 resp.status_code == 200, f"Got {resp.status_code}")
                        
                        # Get another worker if available
                        if len(workers) > 1:
                            # Get worker2 token
                            worker2_creds = {"email": "worker2@jansetu.in", "password": "worker123"}
                            try:
                                worker2_token = login_staff("worker2", worker2_creds)
                                
                                # Unassigned worker accessing the photo → 403
                                resp = requests.get(f"{BASE_URL}/files/{citizen_file_path}?t={worker2_token}")
                                log_test("Unassigned worker GET /files/{unassigned_issue_photo}?t=<worker2_token> → 403", 
                                         resp.status_code == 403, f"Got {resp.status_code}")
                            except Exception as e:
                                print(f"⚠️  Could not test unassigned worker: {e}")
    else:
        print(f"⚠️  Could not upload file as citizen: {resp.status_code}")


def cleanup():
    """Clean up test data"""
    print("\n=== Cleaning up test data ===")
    
    pa_token = tokens.get("pa")
    if not pa_token:
        return
    
    # Delete created relationships
    for rel_key in ["father_rel_id", "brother_rel_id", "brother_cross_rel_id"]:
        if rel_key in test_data:
            rel_id = test_data[rel_key]
            resp = requests.delete(f"{BASE_URL}/relationships/{rel_id}", headers={"Authorization": f"Bearer {pa_token}"})
            if resp.status_code == 200:
                print(f"✓ Deleted relationship {rel_id}")


def main():
    """Main test runner"""
    print("=" * 80)
    print("JANSETU Backend Security Fixes Testing")
    print("Testing: C1 (Access Control), M1 (Inverse Gender), M5 (File Access)")
    print("=" * 80)
    
    try:
        # Setup
        setup_tokens()
        
        # Run tests
        test_c1_access_control()
        test_m1_inverse_gender()
        test_m5_file_access()
        
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
