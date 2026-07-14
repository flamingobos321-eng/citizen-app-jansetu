# Auth Flow Test Report

**Date:** 2026-07-14  
**Task:** Confirm login and citizen registration flow work end-to-end  
**Test file:** `tests/test_auth_flow.py`

---

## Summary

| Test Suite | Tests | Passed | Failed | Skipped |
|---|---|---|---|---|
| `tests/test_auth_flow.py` (new) | **25** | **25** | 0 | 0 |
| `backend_test.py` (existing) | N/A | — | — | All (see reason below) |
| `portal_test.py` (existing) | N/A | — | — | All (see reason below) |
| `backend/tests/test_jansetu_backend.py` | N/A | — | — | All (see reason below) |

**Overall result: All 25 auth + registration tests pass.**

---

## New Test File: `tests/test_auth_flow.py`

A self-contained pytest suite using FastAPI's `TestClient` with a stateful mocked
MongoDB. Inserts are tracked so subsequent id-based lookups work correctly — this
is required to verify the full registration flow (OTP → new_user=True → register
→ JWT round-trip).

### Staff Login (`POST /api/auth/staff/login`) — 7 tests

| Test | Result |
|---|---|
| Admin (`super_admin`) login returns valid JWT with correct role | ✅ PASS |
| PA login returns valid JWT with `role=pa` | ✅ PASS |
| Worker login returns valid JWT with `role=worker` | ✅ PASS |
| Wrong password → 401 | ✅ PASS |
| Unknown email → 401 | ✅ PASS |
| Missing required field (`password`) → 422 | ✅ PASS |
| `password_hash` never appears in response body | ✅ PASS |

### Citizen OTP (`POST /api/auth/citizen/request-otp` + `/verify-otp`) — 6 tests

| Test | Result |
|---|---|
| Request OTP for existing citizen mobile in dev-mode → `demo_otp=123456` | ✅ PASS |
| Request OTP for brand-new mobile → dev-mode OTP returned | ✅ PASS |
| Verify OTP for existing citizen → JWT + `user.name="Ramesh Sharma"`, `new_user=false` | ✅ PASS |
| Verify OTP for unknown mobile → `new_user=true` (triggers registration flow) | ✅ PASS |
| Non-numeric OTP (`"abc"`) → 400 | ✅ PASS |
| 5-digit OTP → 400 | ✅ PASS |

### JWT Round-trip (`GET /api/auth/me`) — 4 tests

| Test | Result |
|---|---|
| Valid citizen JWT → 200, `role=citizen` | ✅ PASS |
| Missing `Authorization` header → 401 | ✅ PASS |
| Malformed JWT → 401 | ✅ PASS |
| Valid staff (PA) JWT → 200, `role=pa` | ✅ PASS |

### Citizen Registration (`POST /api/auth/citizen/register`) — 8 tests

| Test | Result |
|---|---|
| New citizen registration returns `token`, `user`, `household` | ✅ PASS |
| Returned JWT decodes with `role=citizen` and correct `tenant_id` | ✅ PASS |
| Registered user record has correct fields (name, role); no `password_hash` | ✅ PASS |
| Duplicate mobile (already active) → 400 "already registered" | ✅ PASS |
| Missing required `name` field → 422 | ✅ PASS |
| Missing required `mobile` field → 422 | ✅ PASS |
| Missing required `region_type` field → 422 | ✅ PASS |
| **Full sequence:** OTP verify → `new_user=true` → register → valid JWT | ✅ PASS |

---

## Scope of Coverage

These tests exercise the **actual FastAPI endpoint code** in `backend/server.py`
(auth middleware, bcrypt password verification, JWT creation/decoding, pydantic
validation) against a mock of the database layer only. The business logic
executed is identical to a real request — only the MongoDB driver calls are
intercepted.

### What is NOT covered (requires live database + server)

- Seeded demo data integrity (correct passwords, mobile numbers)
- MongoDB index behavior under concurrent writes
- OTP TTL / expiry after server restart
- Portal config lookups for production tenants with real otp_config
- The `v2_dualwrite` path (person mirroring) during registration

---

## Existing Test Files — Skipped (Documented Reasons)

### `backend_test.py` and `portal_test.py`

**Skipped reason:** Integration-test scripts that hit a hardcoded external URL:

```
BASE_URL = "https://family-bonds-23.preview.emergentagent.com/api"
```

That host currently returns `404 page not found`. These can run once the app is
deployed (Task #2). They are scripted runners (not pytest), structured as
sequential function calls, not individual test cases.

### `backend/tests/test_jansetu_backend.py`

**Skipped reason:** Same URL dependency. Reads it from env var:

```python
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://family-bonds-23.preview.emergentagent.com")
```

Once `REACT_APP_BACKEND_URL` is set and the server is running:
```bash
REACT_APP_BACKEND_URL=https://your-replit-domain.replit.app \
  pytest backend/tests/test_jansetu_backend.py -v
```

---

## Code Review Findings (Auth Endpoints)

No logic bugs found. Notable findings:

1. **Dev-mode OTP bypass** — `communication_mode != "production"` always issues
   `demo_otp="123456"` and accepts any 6-digit input. Clean separation.

2. **new_user flow** — `verify-otp` returns `{new_user: true, mobile, tenant_id}`
   when no citizen exists, correctly gating registration.

3. **Staff login rate-limiter** — 5 bad attempts per (IP, email) → 15-min lockout.
   In-memory only; resets on worker restart. Documented caveat in code.

4. **password_hash stripping** — excluded in both `get_current_user` DB projection
   and `staff_login` via `user.pop("password_hash", None)`. No leakage.

5. **JWT claims** — `sub` (user ID), `role`, `tid` (tenant). 30-day expiry.
   JWT_SECRET must be ≥ 32 bytes in production (library warns at <32 bytes).

---

## How to Run

```bash
# From the workspace root:
pytest tests/test_auth_flow.py -v

# Once the live server is up (set REACT_APP_BACKEND_URL):
REACT_APP_BACKEND_URL=https://your-replit-domain.replit.app \
  pytest backend/tests/test_jansetu_backend.py -v
```
