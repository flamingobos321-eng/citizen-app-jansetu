#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build the Family Relationship Module for JANSETU. Every relationship must support:
  - Relation type (from /api/meta/relation-types)
  - Since Year (optional)
  - Notes (optional)
  Example: Father, Since 1994, "Family connected since Shankarrao Kolhe era."

backend:
  - task: "GET /api/persons/{id} returns relationships with perspective-aware display_type"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Enhanced /api/persons/{id} to compute display_type for each relationship from the viewer's perspective using a new inverse_relation() helper in models.py. If stored edge is 'A is Father of B', then on B's profile display_type=Father, on A's profile display_type=Son/Daughter (depending on A's gender)."
        - working: true
          agent: "testing"
          comment: "✅ VERIFIED: Created Father relationship between Ramesh Sharma (Male) and Sunita Sharma (Female). Person B's profile correctly shows display_type='Father'. Person A's profile correctly shows display_type='Son' (based on Male gender). All required fields present: type, since, notes, other (person doc), and display_type. Perspective-aware logic working correctly."

  - task: "POST /api/relationships with validation (no self-link, no duplicate, valid type)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added: (1) reject person_a==person_b with 400; (2) reject exact duplicate (same person_a, person_b, type) with 409; (3) reject invalid type with 400; (4) reject unknown persons with 404. Auth required: pa or admin."
        - working: true
          agent: "testing"
          comment: "✅ VERIFIED: All validation tests passed. (1) Self-link rejected with 400. (2) Duplicate relationship rejected with 409. (3) Invalid type 'Friend' rejected with 400. (4) Unknown person ID rejected with 404. (5) Worker token correctly denied with 403. Happy path: Successfully created relationship with type='Father', since='1994', notes='Family connected since Shankarrao Kolhe era.' All fields persisted correctly."

  - task: "DELETE /api/relationships/{id} removes edge"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Pre-existing endpoint. Verify it still deletes and that the deletion reflects in /api/persons/{id}."
        - working: true
          agent: "testing"
          comment: "✅ VERIFIED: DELETE endpoint working correctly. Relationship successfully deleted and confirmed removed from both person A and person B profiles via GET /api/persons/{id}. Worker token correctly denied with 403."

  - task: "PUT /api/persons/{id} updates alive/deceased + date_of_death"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Pre-existing endpoint. Verify status toggle (alive↔deceased) and date_of_death persist."
        - working: true
          agent: "testing"
          comment: "✅ VERIFIED: Status updates working correctly. Successfully updated status to 'deceased' with date_of_death='2024-01-15', verified persistence via GET, then reverted to 'alive'. All changes persisted correctly. Worker token correctly denied with 403."

  - task: "GET /api/meta/relation-types includes new Grandson/Granddaughter"
    implemented: true
    working: true
    file: "backend/models.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Extended RELATION_TYPES with Grandson and Granddaughter to support clean inverses."
        - working: true
          agent: "testing"
          comment: "✅ VERIFIED: GET /api/meta/relation-types returns 18 relation types including the newly added 'Grandson' and 'Granddaughter'. All original 16 types still present: Father, Mother, Son, Daughter, Brother, Sister, Husband, Wife, Grandfather, Grandmother, Uncle, Aunt, Nephew, Niece, Cousin, Other."

frontend:
  - task: "Family Relationship Module UI on PersonProfile (Add/Delete/Group display, Since + Notes)"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/PersonProfile.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Rebuilt the Relationships card with grouped sections (Parents / Spouse / Children / Siblings / Grandparents / Grandchildren / Extended). Added 'Add' dialog with citizen search picker, relation type dropdown, Since Year, and Notes fields. Added per-row delete (PA/Admin only). Added Mark Deceased / Edit Status dialog. Frontend will be tested via the user manually or upon explicit request."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/persons/{id} returns relationships with perspective-aware display_type"
    - "POST /api/relationships with validation (no self-link, no duplicate, valid type)"
    - "DELETE /api/relationships/{id} removes edge"
    - "PUT /api/persons/{id} updates alive/deceased + date_of_death"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Family Relationship Module implemented.

        Backend changes:
          1. models.py: RELATION_TYPES now includes Grandson/Granddaughter. Added INVERSE_RELATION map + inverse_relation(type, viewer_gender) helper.
          2. server.py: GET /api/persons/{id} now adds display_type per relationship from the viewer's perspective.
          3. server.py: POST /api/relationships validates self-link (400), invalid type (400), unknown person (404), and duplicate edge (409).

        Please test the backend tasks listed in test_plan. Use credentials from /app/memory/test_credentials.md:
          - PA: pa@jansetu.in / pa123 (write access)
          - Admin: admin@jansetu.in / admin123 (write access)
          - Worker: worker1@jansetu.in / worker123 (read-only — should be denied for POST/DELETE/PUT relationship endpoints)

        Suggested scenarios:
          a. As PA: pick two seeded citizens via GET /api/users?role=citizen. Create Father relationship from A→B with since="1994" and a notes string. Verify GET /api/persons/{B} returns it with display_type="Father" and the since/notes preserved. Then GET /api/persons/{A} and verify display_type is "Son" or "Daughter" depending on A's gender.
          b. Validation: try self-link (expect 400), duplicate same edge (expect 409), invalid type "Friend" (expect 400), unknown person id (expect 404).
          c. Delete the relationship and confirm it's removed from both persons.
          d. PUT /api/persons/{id} with status="deceased" and date_of_death="2024-01-15", then revert to "alive".
          e. Confirm a worker token gets 403 on POST/DELETE/PUT relationship/person endpoints.
    - agent: "testing"
      message: |
        ✅ ALL BACKEND TESTS PASSED (12/12)

        Completed comprehensive testing of Family Relationship Module backend endpoints:

        Test Results:
        1. ✅ GET /api/meta/relation-types - Returns 18 types including Grandson/Granddaughter
        2. ✅ POST /api/relationships - Happy path with since="1994" and notes persisted correctly
        3. ✅ GET /api/persons/{id} - display_type field present with correct perspective-aware values
        4. ✅ POST /api/relationships - Self-link validation (400)
        5. ✅ POST /api/relationships - Invalid type validation (400)
        6. ✅ POST /api/relationships - Unknown person validation (404)
        7. ✅ POST /api/relationships - Duplicate relationship validation (409)
        8. ✅ POST /api/relationships - Worker authorization (403)
        9. ✅ PUT /api/persons/{id} - Status updates (deceased/alive) with date_of_death persistence
        10. ✅ PUT /api/persons/{id} - Worker authorization (403)
        11. ✅ DELETE /api/relationships/{id} - Edge removal verified on both persons
        12. ✅ DELETE /api/relationships/{id} - Worker authorization (403)

        Key Findings:
        - Perspective-aware display_type logic working perfectly (Father→Son/Daughter based on viewer gender)
        - All validation rules enforced correctly (self-link, duplicate, invalid type, unknown person)
        - Authorization working correctly (PA/Admin can write, Worker gets 403)
        - Since and Notes fields persist correctly
        - Status updates (alive/deceased) work with proper persistence

        Note: Created 2 additional test citizens (Sunita Sharma - Female, Vijay Kumar - Male) to enable relationship testing.
