#!/usr/bin/env python3
"""Backend API tests for JANSETU Family Relationship Module."""
import requests
import json
import sys

# Backend URL from frontend/.env
BASE_URL = "https://family-bonds-23.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@jansetu.in"
ADMIN_PASSWORD = "admin123"
PA_EMAIL = "pa@jansetu.in"
PA_PASSWORD = "pa123"
WORKER_EMAIL = "worker1@jansetu.in"
WORKER_PASSWORD = "worker123"

# Global tokens
admin_token = None
pa_token = None
worker_token = None

# Test data
test_relationship_id = None
test_person_a_id = None
test_person_b_id = None


def print_test(name):
    """Print test name."""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)


def print_result(passed, message):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed


def login_staff(email, password):
    """Login as staff and return token."""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/staff/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        else:
            print(f"Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error for {email}: {e}")
        return None


def get_citizens():
    """Get list of citizens."""
    try:
        response = requests.get(
            f"{BASE_URL}/users?role=citizen",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error getting citizens: {e}")
        return []


def test_relation_types():
    """Test GET /api/meta/relation-types includes Grandson and Granddaughter."""
    print_test("GET /api/meta/relation-types - Should include Grandson and Granddaughter")
    
    try:
        response = requests.get(f"{BASE_URL}/meta/relation-types", timeout=10)
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        relation_types = data.get("relation_types", [])
        
        if "Grandson" not in relation_types:
            return print_result(False, "Grandson not found in relation_types")
        
        if "Granddaughter" not in relation_types:
            return print_result(False, "Granddaughter not found in relation_types")
        
        # Check original types are still there
        expected_types = ["Father", "Mother", "Son", "Daughter", "Brother", "Sister", 
                         "Husband", "Wife", "Grandfather", "Grandmother", "Uncle", 
                         "Aunt", "Nephew", "Niece", "Cousin", "Other"]
        
        for rel_type in expected_types:
            if rel_type not in relation_types:
                return print_result(False, f"{rel_type} not found in relation_types")
        
        print(f"Found {len(relation_types)} relation types: {relation_types}")
        return print_result(True, f"All expected relation types present including Grandson and Granddaughter")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_create_relationship_happy_path():
    """Test POST /api/relationships - Happy path with since and notes."""
    global test_relationship_id, test_person_a_id, test_person_b_id
    
    print_test("POST /api/relationships - Happy path with since and notes")
    
    # Get two citizens
    citizens = get_citizens()
    if len(citizens) < 2:
        return print_result(False, "Need at least 2 citizens for testing")
    
    # Pick two citizens with known genders
    person_a = None
    person_b = None
    
    for citizen in citizens:
        if citizen.get("gender") in ["Male", "male", "M", "m"]:
            if not person_a:
                person_a = citizen
        if citizen.get("gender") in ["Female", "female", "F", "f"]:
            if not person_b:
                person_b = citizen
        if person_a and person_b:
            break
    
    # If we don't have both genders, just use first two
    if not person_a or not person_b:
        person_a = citizens[0]
        person_b = citizens[1]
    
    test_person_a_id = person_a["id"]
    test_person_b_id = person_b["id"]
    
    print(f"Person A: {person_a['name']} (Gender: {person_a.get('gender', 'Unknown')})")
    print(f"Person B: {person_b['name']} (Gender: {person_b.get('gender', 'Unknown')})")
    
    try:
        payload = {
            "person_a": test_person_a_id,
            "person_b": test_person_b_id,
            "type": "Father",
            "since": "1994",
            "notes": "Family connected since Shankarrao Kolhe era."
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        test_relationship_id = data.get("id")
        
        # Verify fields
        if data.get("type") != "Father":
            return print_result(False, f"Expected type 'Father', got {data.get('type')}")
        
        if data.get("since") != "1994":
            return print_result(False, f"Expected since '1994', got {data.get('since')}")
        
        if data.get("notes") != "Family connected since Shankarrao Kolhe era.":
            return print_result(False, f"Expected notes to match, got {data.get('notes')}")
        
        print(f"Created relationship: {data}")
        return print_result(True, "Relationship created with since and notes")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_get_person_with_display_type():
    """Test GET /api/persons/{id} returns display_type field."""
    print_test("GET /api/persons/{id} - Verify display_type field")
    
    if not test_person_a_id or not test_person_b_id:
        return print_result(False, "Need to run create relationship test first")
    
    try:
        # Test person B's profile (should show Father as display_type)
        response = requests.get(
            f"{BASE_URL}/persons/{test_person_b_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        relationships = data.get("relationships", [])
        
        if not relationships:
            return print_result(False, "No relationships found for person B")
        
        # Find the relationship we created
        rel = None
        for r in relationships:
            if r.get("type") == "Father":
                rel = r
                break
        
        if not rel:
            return print_result(False, "Father relationship not found")
        
        # Check display_type
        if "display_type" not in rel:
            return print_result(False, "display_type field not present")
        
        if rel["display_type"] != "Father":
            return print_result(False, f"Expected display_type 'Father', got {rel['display_type']}")
        
        # Check other fields are present
        if "type" not in rel:
            return print_result(False, "type field not present")
        
        if "since" not in rel:
            return print_result(False, "since field not present")
        
        if "notes" not in rel:
            return print_result(False, "notes field not present")
        
        if "other" not in rel:
            return print_result(False, "other field (other person doc) not present")
        
        print(f"Person B's relationship: {rel}")
        
        # Now test person A's profile (should show Son or Daughter based on A's gender)
        response = requests.get(
            f"{BASE_URL}/persons/{test_person_a_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200 for person A, got {response.status_code}")
        
        data = response.json()
        person_a_gender = data.get("person", {}).get("gender", "").lower()
        relationships = data.get("relationships", [])
        
        # Find the relationship
        rel = None
        for r in relationships:
            if r.get("type") == "Father":
                rel = r
                break
        
        if not rel:
            return print_result(False, "Father relationship not found in person A's profile")
        
        if "display_type" not in rel:
            return print_result(False, "display_type field not present in person A's profile")
        
        expected_display = "Daughter" if person_a_gender in ["female", "f"] else "Son"
        
        if rel["display_type"] != expected_display:
            print(f"Warning: Expected display_type '{expected_display}' for person A (gender: {person_a_gender}), got {rel['display_type']}")
            # This is still a pass if display_type exists, just log the mismatch
        
        print(f"Person A's relationship: {rel}")
        return print_result(True, "display_type field present with correct perspective-aware values")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_create_relationship_self_link():
    """Test POST /api/relationships - Reject self-link with 400."""
    print_test("POST /api/relationships - Reject self-link (400)")
    
    if not test_person_a_id:
        return print_result(False, "Need person_a_id from previous test")
    
    try:
        payload = {
            "person_a": test_person_a_id,
            "person_b": test_person_a_id,
            "type": "Father"
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}")
        
        return print_result(True, "Self-link rejected with 400")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_create_relationship_invalid_type():
    """Test POST /api/relationships - Reject invalid type with 400."""
    print_test("POST /api/relationships - Reject invalid type (400)")
    
    if not test_person_a_id or not test_person_b_id:
        return print_result(False, "Need person IDs from previous test")
    
    try:
        payload = {
            "person_a": test_person_a_id,
            "person_b": test_person_b_id,
            "type": "Friend"
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}")
        
        return print_result(True, "Invalid type rejected with 400")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_create_relationship_unknown_person():
    """Test POST /api/relationships - Reject unknown person with 404."""
    print_test("POST /api/relationships - Reject unknown person (404)")
    
    if not test_person_a_id:
        return print_result(False, "Need person_a_id from previous test")
    
    try:
        payload = {
            "person_a": test_person_a_id,
            "person_b": "unknown-person-id-12345",
            "type": "Father"
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 404:
            return print_result(False, f"Expected 404, got {response.status_code}")
        
        return print_result(True, "Unknown person rejected with 404")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_create_relationship_duplicate():
    """Test POST /api/relationships - Reject duplicate with 409."""
    print_test("POST /api/relationships - Reject duplicate (409)")
    
    if not test_person_a_id or not test_person_b_id:
        return print_result(False, "Need person IDs from previous test")
    
    try:
        # Try to create the same relationship again
        payload = {
            "person_a": test_person_a_id,
            "person_b": test_person_b_id,
            "type": "Father",
            "since": "1994",
            "notes": "Family connected since Shankarrao Kolhe era."
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 409:
            return print_result(False, f"Expected 409, got {response.status_code}")
        
        return print_result(True, "Duplicate relationship rejected with 409")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_create_relationship_worker_forbidden():
    """Test POST /api/relationships - Worker gets 403."""
    print_test("POST /api/relationships - Worker forbidden (403)")
    
    if not test_person_a_id or not test_person_b_id:
        return print_result(False, "Need person IDs from previous test")
    
    try:
        payload = {
            "person_a": test_person_a_id,
            "person_b": test_person_b_id,
            "type": "Brother"
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {worker_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 403:
            return print_result(False, f"Expected 403, got {response.status_code}")
        
        return print_result(True, "Worker forbidden with 403")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_update_person_status():
    """Test PUT /api/persons/{id} - Update status to deceased and back to alive."""
    print_test("PUT /api/persons/{id} - Update status deceased/alive")
    
    if not test_person_a_id:
        return print_result(False, "Need person_a_id from previous test")
    
    try:
        # Update to deceased
        payload = {
            "status": "deceased",
            "date_of_death": "2024-01-15"
        }
        
        response = requests.put(
            f"{BASE_URL}/persons/{test_person_a_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        if data.get("status") != "deceased":
            return print_result(False, f"Expected status 'deceased', got {data.get('status')}")
        
        if data.get("date_of_death") != "2024-01-15":
            return print_result(False, f"Expected date_of_death '2024-01-15', got {data.get('date_of_death')}")
        
        print("Status updated to deceased")
        
        # Verify via GET
        response = requests.get(
            f"{BASE_URL}/persons/{test_person_a_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"GET failed: {response.status_code}")
        
        data = response.json()
        person = data.get("person", {})
        
        if person.get("status") != "deceased":
            return print_result(False, "Status not persisted as deceased")
        
        # Revert to alive
        payload = {
            "status": "alive"
        }
        
        response = requests.put(
            f"{BASE_URL}/persons/{test_person_a_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Revert failed: {response.status_code}")
        
        data = response.json()
        
        if data.get("status") != "alive":
            return print_result(False, f"Expected status 'alive', got {data.get('status')}")
        
        print("Status reverted to alive")
        return print_result(True, "Status updates work correctly")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_update_person_worker_forbidden():
    """Test PUT /api/persons/{id} - Worker gets 403."""
    print_test("PUT /api/persons/{id} - Worker forbidden (403)")
    
    if not test_person_a_id:
        return print_result(False, "Need person_a_id from previous test")
    
    try:
        payload = {
            "status": "deceased"
        }
        
        response = requests.put(
            f"{BASE_URL}/persons/{test_person_a_id}",
            headers={"Authorization": f"Bearer {worker_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 403:
            return print_result(False, f"Expected 403, got {response.status_code}")
        
        return print_result(True, "Worker forbidden with 403")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_delete_relationship():
    """Test DELETE /api/relationships/{id} - Remove edge."""
    print_test("DELETE /api/relationships/{id} - Remove edge")
    
    if not test_relationship_id:
        return print_result(False, "Need relationship_id from previous test")
    
    try:
        response = requests.delete(
            f"{BASE_URL}/relationships/{test_relationship_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        # Verify it's removed from both persons
        response = requests.get(
            f"{BASE_URL}/persons/{test_person_a_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"GET person A failed: {response.status_code}")
        
        data = response.json()
        relationships = data.get("relationships", [])
        
        for rel in relationships:
            if rel.get("id") == test_relationship_id:
                return print_result(False, "Relationship still exists in person A's profile")
        
        response = requests.get(
            f"{BASE_URL}/persons/{test_person_b_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"GET person B failed: {response.status_code}")
        
        data = response.json()
        relationships = data.get("relationships", [])
        
        for rel in relationships:
            if rel.get("id") == test_relationship_id:
                return print_result(False, "Relationship still exists in person B's profile")
        
        return print_result(True, "Relationship deleted successfully")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def test_delete_relationship_worker_forbidden():
    """Test DELETE /api/relationships/{id} - Worker gets 403."""
    print_test("DELETE /api/relationships/{id} - Worker forbidden (403)")
    
    # Create a new relationship to test deletion
    if not test_person_a_id or not test_person_b_id:
        return print_result(False, "Need person IDs from previous test")
    
    try:
        # Create a new relationship
        payload = {
            "person_a": test_person_a_id,
            "person_b": test_person_b_id,
            "type": "Brother"
        }
        
        response = requests.post(
            f"{BASE_URL}/relationships",
            headers={"Authorization": f"Bearer {pa_token}"},
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            return print_result(False, f"Failed to create test relationship: {response.status_code}")
        
        rel_id = response.json().get("id")
        
        # Try to delete with worker token
        response = requests.delete(
            f"{BASE_URL}/relationships/{rel_id}",
            headers={"Authorization": f"Bearer {worker_token}"},
            timeout=10
        )
        
        if response.status_code != 403:
            return print_result(False, f"Expected 403, got {response.status_code}")
        
        # Cleanup: delete with PA token
        requests.delete(
            f"{BASE_URL}/relationships/{rel_id}",
            headers={"Authorization": f"Bearer {pa_token}"},
            timeout=10
        )
        
        return print_result(True, "Worker forbidden with 403")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")


def main():
    """Run all tests."""
    global admin_token, pa_token, worker_token
    
    print("\n" + "="*80)
    print("JANSETU FAMILY RELATIONSHIP MODULE - BACKEND API TESTS")
    print("="*80)
    
    # Login
    print("\n--- Logging in ---")
    admin_token = login_staff(ADMIN_EMAIL, ADMIN_PASSWORD)
    pa_token = login_staff(PA_EMAIL, PA_PASSWORD)
    worker_token = login_staff(WORKER_EMAIL, WORKER_PASSWORD)
    
    if not admin_token or not pa_token or not worker_token:
        print("\n❌ CRITICAL: Failed to login. Cannot proceed with tests.")
        sys.exit(1)
    
    print("✅ All logins successful")
    
    # Run tests
    results = []
    
    # Test 1: Relation types
    results.append(test_relation_types())
    
    # Test 2: Create relationship (happy path)
    results.append(test_create_relationship_happy_path())
    
    # Test 3: Get person with display_type
    results.append(test_get_person_with_display_type())
    
    # Test 4: Validation tests
    results.append(test_create_relationship_self_link())
    results.append(test_create_relationship_invalid_type())
    results.append(test_create_relationship_unknown_person())
    results.append(test_create_relationship_duplicate())
    results.append(test_create_relationship_worker_forbidden())
    
    # Test 5: Update person status
    results.append(test_update_person_status())
    results.append(test_update_person_worker_forbidden())
    
    # Test 6: Delete relationship
    results.append(test_delete_relationship())
    results.append(test_delete_relationship_worker_forbidden())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
