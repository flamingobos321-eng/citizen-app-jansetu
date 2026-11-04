"""
Auth flow tests: staff login + citizen OTP (request & verify) + citizen register.

Run with:
    cd /path/to/workspace && pytest tests/test_auth_flow.py -v

The tests use FastAPI's TestClient backed by an in-memory mock MongoDB so
they work without MONGO_URL / a live database.  All network calls to the
real DB are intercepted via unittest.mock patching.
"""
import os
import sys
import types
import pytest
import bcrypt
import jwt
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# Bootstrap: inject dummy env vars BEFORE importing server so the module
# load doesn't fail on missing MONGO_URL / DB_NAME / JWT_SECRET.
# ---------------------------------------------------------------------------
_TEST_JWT_SECRET = "test-secret-do-not-use-in-prod"

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "jansetu_test")
os.environ.setdefault("JWT_SECRET", _TEST_JWT_SECRET)

# ---------------------------------------------------------------------------
# Stub out heavy optional imports that may not be installed in this env
# ---------------------------------------------------------------------------
def _stub_module(name: str):
    """Register an empty stub module so `import name` succeeds."""
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod


# motor.motor_asyncio — patch before anything imports it
_motor_pkg = _stub_module("motor")
_motor_async = _stub_module("motor.motor_asyncio")


class _FakeCollection:
    """Minimal async collection stub used for the happy-path tests."""

    def __init__(self, store: dict):
        self._store = store  # {"collection_name": [docs]}

    def find_one(self, query, projection=None):
        coro = AsyncMock()
        return coro

    def find(self, query=None, projection=None):
        m = MagicMock()
        m.to_list = AsyncMock(return_value=[])
        m.sort = MagicMock(return_value=m)
        m.limit = MagicMock(return_value=m)
        return m

    def insert_one(self, doc):
        return AsyncMock(return_value=None)()

    def insert_many(self, docs):
        return AsyncMock(return_value=None)()

    def update_one(self, q, upd, **kw):
        return AsyncMock(return_value=MagicMock(modified_count=1, upserted_id=None))()

    def update_many(self, q, upd, **kw):
        return AsyncMock(return_value=MagicMock(modified_count=0))()

    def count_documents(self, q):
        return AsyncMock(return_value=0)()

    def create_index(self, *a, **kw):
        return AsyncMock(return_value="idx")()

    def find_one_and_update(self, q, upd, **kw):
        return AsyncMock(return_value={"seq": 1})()

    def delete_one(self, q):
        return AsyncMock(return_value=None)()


class _FakeDB:
    def __getattr__(self, name):
        return _FakeCollection({})

    def __getitem__(self, name):
        return _FakeCollection({})


class _FakeClient:
    def __getitem__(self, name):
        return _FakeDB()


_motor_async.AsyncIOMotorClient = MagicMock(return_value=_FakeClient())

# Also stub push_service, storage_util, v2_dualwrite, v2_transfer which have
# optional heavy deps (firebase-admin, boto3, etc.)
for _mod in ("push_service", "storage_util", "v2_dualwrite", "v2_transfer",
             "v2_visibility", "electoral_parser"):
    _m = _stub_module(_mod)
    # attach the symbols server.py references from these modules
    _m.init_storage = MagicMock()
    _m.put_object = AsyncMock()
    _m.get_object = AsyncMock()
    _m.APP_NAME = "jansetu"
    _m.ensure_person_for_user = AsyncMock(return_value=None)
    _m.resolve_active_membership = AsyncMock(return_value=None)
    _m.detect_transfer_need = AsyncMock(return_value={"exists": False})
    _m.initiate_transfer = AsyncMock(return_value={})
    _m.verify_and_execute_transfer = AsyncMock(return_value={})
    _m.get_person_membership_history = AsyncMock(return_value=[])

# ---------------------------------------------------------------------------
# Now we can safely import the FastAPI app
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Import must happen AFTER env vars + stubs are set up
from fastapi.testclient import TestClient  # noqa: E402

# ---------------------------------------------------------------------------
# Helper: build a real bcrypt hash (cheap in tests — small cost rounds)
# ---------------------------------------------------------------------------
def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=4)).decode()


# ---------------------------------------------------------------------------
# Fixtures — per-test patches so each test is independent
# ---------------------------------------------------------------------------

ADMIN_HASH = _hash("admin123")
PA_HASH = _hash("pa123")
WORKER_HASH = _hash("worker123")

_DEMO_USERS = {
    "admin@jansetu.in": {
        "id": "uid-admin",
        "role": "super_admin",
        "name": "Super Admin",
        "email": "admin@jansetu.in",
        "password_hash": ADMIN_HASH,
        "tenant_id": None,
    },
    "pa@jansetu.in": {
        "id": "uid-pa",
        "role": "pa",
        "name": "Priya Deshmukh",
        "email": "pa@jansetu.in",
        "password_hash": PA_HASH,
        "tenant_id": "tenant-001",
    },
    "worker1@jansetu.in": {
        "id": "uid-worker1",
        "role": "worker",
        "name": "Suresh Kale",
        "email": "worker1@jansetu.in",
        "password_hash": WORKER_HASH,
        "tenant_id": "tenant-001",
    },
}

_DEMO_CITIZEN = {
    "id": "uid-citizen-001",
    "role": "citizen",
    "name": "Ramesh Sharma",
    "mobile": "9999900001",
    "tenant_id": "tenant-001",
    "household_id": "hh-001",
    "is_active": True,
}

_DEMO_PORTAL = {
    "id": "tenant-001",
    "slug": "pune-cantonment",
    "office_code": "JS1045",
    "constituency_name": "Pune Cantonment Test Office",
    "politician_name": "JanSetu Test Office",
    "theme_color": "#147D64",
    "is_active": True,
    "is_default": True,
    "communication_mode": "development",
    "portal_status": "active",
    "otp_config": {},
}

_DEMO_ANNOUNCEMENT = {
    "id": "notification-test-announcement",
    "tenant_id": "tenant-001",
    "scope": "all",
    "title": "Test office hours",
    "body": "This announcement belongs to the isolated mobile test office.",
    "notif_type": "announcement",
    "created_at": "2026-01-15T10:00:00+00:00",
}

_DEMO_AREA = {
    "id": "area-ward-1",
    "kind": "ward",
    "name": "Ward 1 - Camp",
    "region_type": "urban",
    "constituency_id": "cons-001",
}


def _make_db_mock():
    """Return a db-like object whose collection.find_one is wired to
    return sensible demo data for the auth paths.

    Inserts are tracked in _store so subsequent find_one calls by id can
    return the just-inserted document (needed for citizen registration).
    """
    _store: dict = {}  # {"collection_name": {doc_id: doc}}

    class _Col:
        def __init__(self, name):
            self._name = name

        def _stored(self, doc_id):
            return _store.get(self._name, {}).get(doc_id)

        async def find_one(self, query, projection=None):
            if self._name in ("issues", "notifications") and query.get("id"):
                stored = self._stored(query["id"])
                if stored and all(
                    stored.get(key) == value
                    for key, value in query.items()
                    if not key.startswith("$")
                ):
                    return dict(stored)
                return None

            if self._name == "users":
                # --- id-based lookup (used by get_current_user after JWT decode) ---
                user_id = query.get("id")
                if user_id:
                    # Check tracked inserts first (newly registered citizens)
                    stored = self._stored(user_id)
                    if stored:
                        result = dict(stored)
                        if projection and projection.get("password_hash") == 0:
                            result.pop("password_hash", None)
                        return result
                    # match against demo users by id
                    for u in _DEMO_USERS.values():
                        if u["id"] == user_id:
                            result = dict(u)
                            if projection and projection.get("password_hash") == 0:
                                result.pop("password_hash", None)
                            return result
                    if user_id == _DEMO_CITIZEN["id"]:
                        return dict(_DEMO_CITIZEN)
                    return None

                email = query.get("email")
                if email and email in _DEMO_USERS:
                    u = dict(_DEMO_USERS[email])
                    # Honour projection: strip password_hash if excluded
                    if projection and projection.get("password_hash") == 0:
                        u.pop("password_hash", None)
                    return u
                mobile = query.get("mobile")
                if mobile == "9999900001" and query.get("role") == "citizen":
                    return dict(_DEMO_CITIZEN)
                # Duplicate mobile check during registration (is_active=True existing citizen)
                if mobile == "9999900001" and query.get("is_active") is True:
                    return dict(_DEMO_CITIZEN)
                # Any other mobile → new (no duplicate) → return None
                if mobile and query.get("is_active") is True:
                    return None
                # Probe query used in staff login (checks role != citizen)
                if email and query.get("role", {}).get("$ne") == "citizen":
                    if email in _DEMO_USERS:
                        return {k: v for k, v in _DEMO_USERS[email].items()
                                if k in ("id", "role", "tenant_id")}
                return None

            if self._name == "households":
                hh_id = query.get("id")
                if hh_id:
                    # Return tracked insert first (newly created household)
                    stored = self._stored(hh_id)
                    if stored:
                        return dict(stored)
                    # Fallback synthetic record so the endpoint can always return a household
                    return {
                        "id": hh_id,
                        "tenant_id": "tenant-001",
                        "household_code": "H-10001",
                        "family_head_name": "Test Citizen",
                        "address": "1 Test Street",
                        "house_number": "1",
                        "region_type": "urban",
                        "ward_id": "area-ward-1",
                        "members_count": 1,
                    }
                return None

            if self._name == "portal_configs":
                if query.get("office_code") == "JS1045":
                    return dict(_DEMO_PORTAL)
                if query.get("is_default") is True:
                    return dict(_DEMO_PORTAL)
                if query.get("slug") == "pune-cantonment":
                    return dict(_DEMO_PORTAL)
                if query.get("id") == "tenant-001":
                    return dict(_DEMO_PORTAL)
                return None

            if self._name == "system_meta":
                # multi_tenant already migrated (version=1) → skip migration
                if query.get("_id") == "multi_tenant":
                    return {"version": 1}
                if query.get("_id") == "v2_schema":
                    return {"version": 2}
                return None

            if self._name == "otps":
                # Return a stored dev-mode OTP for mobile 9999900001
                if query.get("mobile") == "9999900001":
                    return {"otp": "123456", "mode": "development"}
                return None

            if self._name == "areas":
                return dict(_DEMO_AREA)

            return None

        def find(self, query=None, projection=None):
            query = query or {}
            m = MagicMock()
            if self._name == "areas":
                m.to_list = AsyncMock(return_value=[dict(_DEMO_AREA)])
            elif self._name == "issues":
                docs = list(_store.get("issues", {}).values())
                docs = [
                    doc for doc in docs
                    if all(doc.get(key) == value for key, value in query.items()
                           if not key.startswith("$"))
                ]
                m.to_list = AsyncMock(return_value=docs)
            elif self._name == "notifications":
                docs = [dict(_DEMO_ANNOUNCEMENT)]
                docs.extend(_store.get("notifications", {}).values())
                docs = [
                    doc for doc in docs
                    if all(doc.get(key) == value for key, value in query.items()
                           if not key.startswith("$"))
                ]
                m.to_list = AsyncMock(return_value=docs)
            elif self._name == "portal_configs":
                m.to_list = AsyncMock(return_value=[])
            else:
                m.to_list = AsyncMock(return_value=[])
            m.sort = MagicMock(return_value=m)
            m.limit = MagicMock(return_value=m)
            return m

        async def count_documents(self, q):
            if self._name == "users" and q.get("role") == "admin":
                # Return 1 so startup skips seeding
                return 1
            if self._name == "portal_configs":
                return 1
            return 0

        async def insert_one(self, doc):
            # Track the inserted doc so find_one can retrieve it by id
            doc_id = doc.get("id") or doc.get("_id")
            if doc_id:
                _store.setdefault(self._name, {})[doc_id] = dict(doc)
            return MagicMock(inserted_id=doc_id or "fake-id")

        async def insert_many(self, docs):
            for doc in docs:
                doc_id = doc.get("id") or doc.get("_id")
                if doc_id:
                    _store.setdefault(self._name, {})[doc_id] = dict(doc)
            return MagicMock()

        async def update_one(self, q, upd, **kw):
            return MagicMock(modified_count=1, upserted_id=None)

        async def update_many(self, q, upd, **kw):
            return MagicMock(modified_count=0)

        async def find_one_and_update(self, q, upd, **kw):
            return {"seq": 1}

        async def delete_one(self, q):
            return MagicMock()

        async def create_index(self, *a, **kw):
            return "idx_name"

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    class _DB:
        def __init__(self):
            self._store = _store

        def __getattr__(self, name):
            return _Col(name)

        def __getitem__(self, name):
            return _Col(name)

    return _DB()


# ---------------------------------------------------------------------------
# Build the TestClient once with the db patched
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def client():
    """Create a TestClient with the database patched to our in-memory mock."""
    import server  # noqa — imported here after env/stubs set up

    fake_db = _make_db_mock()
    with patch.object(server, "db", fake_db):
        # Also patch push_service so startup doesn't error
        with patch.object(server, "init_storage", MagicMock()):
            test_client = TestClient(server.app, raise_server_exceptions=False)
            test_client.fake_db = fake_db
            yield test_client


# ===========================================================================
# ── STAFF LOGIN TESTS ────────────────────────────────────────────────────────
# ===========================================================================

class TestStaffLogin:
    """POST /api/auth/staff/login"""

    def test_admin_login_returns_token(self, client):
        r = client.post(
            "/api/auth/staff/login",
            json={"email": "admin@jansetu.in", "password": "admin123"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body, "Response must contain token"
        assert "user" in body, "Response must contain user"
        # JWT must be decodable
        payload = jwt.decode(body["token"], _TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "uid-admin"
        assert payload["role"] == "super_admin"

    def test_pa_login_returns_token(self, client):
        r = client.post(
            "/api/auth/staff/login",
            json={"email": "pa@jansetu.in", "password": "pa123"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body
        payload = jwt.decode(body["token"], _TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["role"] == "pa"

    def test_worker_login_returns_token(self, client):
        r = client.post(
            "/api/auth/staff/login",
            json={"email": "worker1@jansetu.in", "password": "worker123"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body
        payload = jwt.decode(body["token"], _TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["role"] == "worker"

    def test_wrong_password_returns_401(self, client):
        r = client.post(
            "/api/auth/staff/login",
            json={"email": "admin@jansetu.in", "password": "wrong_pass"},
        )
        assert r.status_code == 401, r.text

    def test_unknown_email_returns_401(self, client):
        r = client.post(
            "/api/auth/staff/login",
            json={"email": "nobody@example.com", "password": "whatever"},
        )
        assert r.status_code == 401, r.text

    def test_missing_fields_returns_422(self, client):
        r = client.post("/api/auth/staff/login", json={"email": "admin@jansetu.in"})
        assert r.status_code == 422

    def test_password_not_in_response(self, client):
        r = client.post(
            "/api/auth/staff/login",
            json={"email": "pa@jansetu.in", "password": "pa123"},
        )
        assert r.status_code == 200
        user = r.json().get("user", {})
        assert "password_hash" not in user, "password_hash must be stripped from response"
        assert "password" not in user


# ===========================================================================
# ── CITIZEN OTP TESTS ────────────────────────────────────────────────────────
# ===========================================================================

class TestCitizenOTP:
    """POST /api/auth/citizen/request-otp  and  /api/auth/citizen/verify-otp"""

    def test_request_otp_existing_mobile_dev_mode(self, client):
        """Dev-mode tenant returns demo_otp = '123456' immediately."""
        r = client.post(
            "/api/auth/citizen/request-otp",
            json={"mobile": "9999900001"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("sent") is True
        assert body.get("mode") == "development"
        assert body.get("demo_otp") == "123456"

    def test_request_otp_new_mobile_dev_mode(self, client):
        """A mobile not yet in the system still gets the dev OTP."""
        r = client.post(
            "/api/auth/citizen/request-otp",
            json={"mobile": "8888800001"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("sent") is True
        assert body.get("demo_otp") == "123456"

    def test_verify_otp_existing_citizen_returns_token(self, client):
        """Verifying OTP for a known mobile returns JWT + user record."""
        r = client.post(
            "/api/auth/citizen/verify-otp",
            json={"mobile": "9999900001", "otp": "123456"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body, "Must return JWT token"
        assert body.get("new_user") is False
        user = body.get("user", {})
        assert user.get("role") == "citizen"
        assert user.get("name") == "Ramesh Sharma"
        # Verify the JWT
        payload = jwt.decode(body["token"], _TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "uid-citizen-001"
        assert payload["role"] == "citizen"

    def test_verify_otp_new_mobile_returns_new_user_flag(self, client):
        """A mobile with no existing citizen record returns new_user=True."""
        r = client.post(
            "/api/auth/citizen/verify-otp",
            json={"mobile": "7777700001", "otp": "123456"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("new_user") is True, "Unknown mobile should trigger registration flow"

    def test_verify_otp_invalid_format_returns_400(self, client):
        """OTP that isn't 6 digits must be rejected."""
        r = client.post(
            "/api/auth/citizen/verify-otp",
            json={"mobile": "9999900001", "otp": "abc"},
        )
        assert r.status_code == 400, r.text

    def test_verify_otp_five_digit_returns_400(self, client):
        """5-digit OTP must be rejected."""
        r = client.post(
            "/api/auth/citizen/verify-otp",
            json={"mobile": "9999900001", "otp": "12345"},
        )
        assert r.status_code == 400, r.text


# ===========================================================================
# ── AUTH /me  (token validation) ─────────────────────────────────────────────
# ===========================================================================

class TestAuthMe:
    """GET /api/auth/me — validates JWT round-trip."""

    def _get_citizen_token(self, client) -> str:
        r = client.post(
            "/api/auth/citizen/verify-otp",
            json={"mobile": "9999900001", "otp": "123456"},
        )
        return r.json()["token"]

    def test_me_with_valid_citizen_token(self, client):
        token = self._get_citizen_token(client)
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "citizen"

    def test_me_without_token_returns_401(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401

    def test_me_with_malformed_token_returns_401(self, client):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
        assert r.status_code == 401

    def test_me_with_staff_token(self, client):
        login_r = client.post(
            "/api/auth/staff/login",
            json={"email": "pa@jansetu.in", "password": "pa123"},
        )
        token = login_r.json()["token"]
        me_r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_r.status_code == 200
        assert me_r.json().get("role") == "pa"


# ===========================================================================
# ── CITIZEN REGISTRATION TESTS ───────────────────────────────────────────────
# ===========================================================================

# Shared valid registration payload for a brand-new mobile
_REG_PAYLOAD = {
    "name": "Test Citizen",
    "mobile": "7777711111",      # unique — not in _DEMO_USERS
    "gender": "Male",
    "region_type": "urban",
    "ward_id": "area-ward-1",
    "house_number": "1",
    "address": "1 Test Street",
    "tenant_slug": "pune-cantonment",
}


class TestCitizenRegister:
    """POST /api/auth/citizen/register

    Covers the full OTP → new_user=true → register sequence that a new
    citizen goes through after OTP verification signals an unrecognised mobile.
    """

    def test_register_new_citizen_returns_token_user_household(self, client):
        """Happy path: new mobile → registration succeeds with JWT, user, household."""
        r = client.post("/api/auth/citizen/register", json=_REG_PAYLOAD)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body, "Must return a JWT token"
        assert "user" in body, "Must return the created user record"
        assert "household" in body, "Must return the created household record"
        # Household must have a generated code
        hh = body["household"]
        code = hh.get("household_code") or hh.get("code")
        assert code and code.startswith("H-"), f"household_code must start with 'H-', got: {code}"

    def test_register_new_citizen_jwt_is_valid(self, client):
        """JWT returned by registration must be decodable with correct claims."""
        r = client.post("/api/auth/citizen/register", json={**_REG_PAYLOAD, "mobile": "7777722222"})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        payload = jwt.decode(token, _TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["role"] == "citizen"
        assert payload["tid"] == "tenant-001"   # tenant_id propagated into JWT

    def test_register_new_citizen_user_has_correct_fields(self, client):
        """Registered user record must carry name, mobile, role, household_id."""
        r = client.post("/api/auth/citizen/register", json={**_REG_PAYLOAD, "mobile": "7777733333"})
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert user.get("role") == "citizen"
        assert user.get("name") == _REG_PAYLOAD["name"]
        assert "password_hash" not in user, "password_hash must never appear in the response"

    def test_register_duplicate_mobile_returns_400(self, client):
        """A mobile already registered (is_active=True) must be rejected with 400."""
        r = client.post(
            "/api/auth/citizen/register",
            json={**_REG_PAYLOAD, "mobile": "9999900001"},  # existing demo citizen
        )
        assert r.status_code == 400, r.text
        assert "already registered" in r.json().get("detail", "").lower()

    def test_register_missing_required_name_returns_422(self, client):
        """Omitting the required `name` field must return 422 Unprocessable Entity."""
        payload = {k: v for k, v in _REG_PAYLOAD.items() if k != "name"}
        r = client.post("/api/auth/citizen/register", json=payload)
        assert r.status_code == 422

    def test_register_missing_required_mobile_returns_422(self, client):
        """Omitting the required `mobile` field must return 422."""
        payload = {k: v for k, v in _REG_PAYLOAD.items() if k != "mobile"}
        r = client.post("/api/auth/citizen/register", json=payload)
        assert r.status_code == 422

    def test_register_missing_region_type_returns_422(self, client):
        """Omitting the required `region_type` field must return 422."""
        payload = {k: v for k, v in _REG_PAYLOAD.items() if k != "region_type"}
        r = client.post("/api/auth/citizen/register", json=payload)
        assert r.status_code == 422

    def test_otp_verify_to_register_sequence(self, client):
        """Full new-citizen flow: OTP verify returns new_user=True,
        then register with same mobile succeeds and returns a valid JWT."""
        new_mobile = "6666600001"
        # Step 1: OTP verify for unknown mobile → new_user=True
        otp_r = client.post(
            "/api/auth/citizen/verify-otp",
            json={"mobile": new_mobile, "otp": "123456"},
        )
        assert otp_r.status_code == 200, otp_r.text
        assert otp_r.json().get("new_user") is True, \
            "Unknown mobile must return new_user=True to trigger registration"

        # Step 2: Register with that mobile
        reg_r = client.post(
            "/api/auth/citizen/register",
            json={**_REG_PAYLOAD, "mobile": new_mobile},
        )
        assert reg_r.status_code == 200, reg_r.text
        body = reg_r.json()
        assert "token" in body
        token = body["token"]
        # JWT must decode cleanly
        claims = jwt.decode(token, _TEST_JWT_SECRET, algorithms=["HS256"])
        assert claims["role"] == "citizen"


class TestMobileCitizenJourney:
    """Mobile API contracts run only against the in-memory test database."""

    def _citizen_token(self, client):
        requested = client.post(
            "/api/auth/citizen/request-otp",
            json={"mobile": _DEMO_CITIZEN["mobile"], "tenant_slug": "JS1045"},
        )
        assert requested.status_code == 200, requested.text
        verified = client.post(
            "/api/auth/citizen/verify-otp",
            json={
                "mobile": _DEMO_CITIZEN["mobile"],
                "otp": requested.json()["demo_otp"],
                "tenant_slug": "JS1045",
            },
        )
        assert verified.status_code == 200, verified.text
        return verified.json()["token"]

    def test_citizen_can_view_only_own_household_not_office_directory(self, client):
        token = self._citizen_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        own_household = client.get("/api/households/hh-001", headers=headers)
        assert own_household.status_code == 200, own_household.text
        assert own_household.json()["household"]["id"] == "hh-001"
        assert isinstance(own_household.json()["members"], list)
        assert isinstance(own_household.json()["issues"], list)
        assert isinstance(own_household.json()["benefits"], list)

        assert client.get("/api/households", headers=headers).status_code == 403
        assert client.get("/api/households/another-household", headers=headers).status_code == 403

    def test_authenticated_photo_upload_path_is_saved_on_issue(self, client):
        import server

        photo_bytes = b"\xff\xd8\xff\xdb-test-image"
        token = self._citizen_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        stored_path = "jansetu/uploads/uid-citizen-001/stored-evidence.jpg"

        with patch.object(
            server,
            "put_object",
            new=MagicMock(return_value={"path": stored_path}),
        ) as put_object:
            uploaded = client.post(
                "/api/files/upload",
                headers=headers,
                files={"file": ("evidence.jpg", photo_bytes, "image/jpeg")},
            )

        assert uploaded.status_code == 200, uploaded.text
        assert uploaded.json()["path"] == stored_path
        put_object.assert_called_once()
        upload_args = put_object.call_args.args
        assert upload_args[1:] == (photo_bytes, "image/jpeg")
        assert upload_args[0].startswith("jansetu/uploads/uid-citizen-001/")

        file_record = next(
            record
            for record in client.fake_db._store["files"].values()
            if record["storage_path"] == stored_path
        )
        assert file_record["content_type"] == "image/jpeg"
        assert file_record["uploaded_by"] == "uid-citizen-001"

        submitted = client.post(
            "/api/issues",
            headers=headers,
            json={
                "category": "Roads",
                "title": "Pothole near school",
                "description": "The road surface is damaged near the school entrance.",
                "photos": [uploaded.json()["path"]],
                "gps_lat": None,
                "gps_lng": None,
                "location_address": "",
            },
        )
        assert submitted.status_code == 200, submitted.text
        issue_id = submitted.json()["id"]
        assert client.fake_db._store["issues"][issue_id]["photos"] == [stored_path]

    def test_photo_upload_requires_citizen_authentication(self, client):
        import server

        with patch.object(
            server,
            "put_object",
            new=MagicMock(return_value={"path": "ignored"}),
        ) as put_object:
            response = client.post(
                "/api/files/upload",
                files={"file": ("evidence.jpg", b"image", "image/jpeg")},
            )

        assert response.status_code == 401
        put_object.assert_not_called()

    def test_mobile_photo_upload_failure_stops_issue_submission_and_is_shown(self):
        from pathlib import Path

        mobile_root = Path(__file__).parents[1] / "artifacts" / "jansetu-mobile"
        screen = (mobile_root / "app" / "issues" / "new.tsx").read_text()
        mutation = screen.split("mutationFn: async () => {", 1)[1].split(
            "onSuccess:", 1
        )[0]

        upload_wait = mutation.index("await Promise.all(")
        upload_call = mutation.index("await uploadIssuePhoto(")
        issue_submission = mutation.index("apiRequest<CreatedIssue>('/issues'")
        assert upload_wait < upload_call < issue_submission
        assert "throw new Error(`Could not upload ${name}: ${detail}`)" in mutation
        assert "setFormError(error instanceof Error ? error.message" in screen
        assert "{formError ? <ErrorNotice message={formError} /> : null}" in screen

    def test_office_otp_issue_timeline_and_announcements(self, client):
        import server

        office = client.get("/api/portals/office/JS1045")
        assert office.status_code == 200, office.text
        office_body = office.json()
        assert office_body["office_code"] == "JS1045"
        assert office_body["constituency_name"] == "Pune Cantonment Test Office"
        assert "otp_config" not in office_body

        categories = client.get("/api/meta/categories")
        assert categories.status_code == 200, categories.text
        assert isinstance(categories.json().get("issue_categories"), list)
        assert categories.json()["issue_categories"]

        mobile = _DEMO_CITIZEN["mobile"]
        with patch.object(
            server.v2tr,
            "detect_transfer_need",
            new=AsyncMock(return_value={"exists": True, "same_tenant": True}),
        ):
            checked = client.post(
                "/api/auth/citizen/check-mobile",
                json={"mobile": mobile, "tenant_slug": "JS1045"},
            )
        assert checked.status_code == 200, checked.text
        assert checked.json()["exists"] is True

        requested = client.post(
            "/api/auth/citizen/request-otp",
            json={"mobile": mobile, "tenant_slug": "JS1045"},
        )
        assert requested.status_code == 200, requested.text
        otp_body = requested.json()
        assert otp_body["sent"] is True
        assert otp_body["mode"] == "development"
        assert otp_body["demo_otp"] == "123456"

        verified = client.post(
            "/api/auth/citizen/verify-otp",
            json={
                "mobile": mobile,
                "otp": otp_body["demo_otp"],
                "tenant_slug": "JS1045",
            },
        )
        assert verified.status_code == 200, verified.text
        auth_body = verified.json()
        assert auth_body["new_user"] is False
        assert auth_body["user"]["role"] == "citizen"
        token = auth_body["token"]
        headers = {"Authorization": f"Bearer {token}"}

        submitted = client.post(
            "/api/issues",
            headers=headers,
            json={
                "category": "Roads",
                "title": "Test lane pothole",
                "description": "This report verifies the isolated mobile issue flow.",
                "photos": [],
                "gps_lat": None,
                "gps_lng": None,
                "location_address": "",
            },
        )
        assert submitted.status_code == 200, submitted.text
        issue = submitted.json()
        assert issue["id"]
        assert issue["issue_code"]
        assert issue["title"] == "Test lane pothole"

        listed = client.get("/api/issues", headers=headers)
        assert listed.status_code == 200, listed.text
        assert any(item["id"] == issue["id"] for item in listed.json())

        detail = client.get(f"/api/issues/{issue['id']}", headers=headers)
        assert detail.status_code == 200, detail.text
        detail_issue = detail.json()["issue"]
        assert detail_issue["id"] == issue["id"]
        assert detail_issue["timeline"]
        assert detail_issue["timeline"][0]["status"] == "New"

        announcements = client.get("/api/notifications", headers=headers)
        assert announcements.status_code == 200, announcements.text
        assert any(
            item["id"] == _DEMO_ANNOUNCEMENT["id"]
            and item["title"] == _DEMO_ANNOUNCEMENT["title"]
            for item in announcements.json()
        )

    def test_mobile_navigation_targets_exist(self):
        from pathlib import Path

        mobile_root = Path(__file__).parents[1] / "artifacts" / "jansetu-mobile"
        login = (mobile_root / "app" / "(auth)" / "login.tsx").read_text()
        issues = (mobile_root / "app" / "(tabs)" / "issues.tsx").read_text()
        new_issue = (mobile_root / "app" / "issues" / "new.tsx").read_text()
        issue_detail = (mobile_root / "app" / "issues" / "[id].tsx").read_text()
        notifications = (mobile_root / "app" / "(tabs)" / "notifications.tsx").read_text()
        profile = (mobile_root / "app" / "(tabs)" / "profile.tsx").read_text()
        auth = (mobile_root / "lib" / "auth.tsx").read_text()

        assert "`/portals/office/${encodeURIComponent(code)}`" in login
        assert "'/auth/citizen/check-mobile'" in login
        assert "'/auth/citizen/request-otp'" in login
        assert "'/auth/citizen/verify-otp'" in login
        assert "router.replace('/(tabs)')" in login
        assert "router.push('/issues/new')" in issues
        assert "apiRequest<CreatedIssue>('/issues'" in new_issue
        assert "router.replace(`/issues/${created.id}`)" in new_issue
        assert "apiRequest<IssueDetailResponse>(`/issues/${encodeURIComponent(id)}`" in issue_detail
        assert "apiRequest<NotificationItem[]>('/notifications'" in notifications
        assert "router.replace('/(auth)/login')" in profile
        assert "const signOut = useCallback(async () => {" in auth
        assert "await removeToken();" in auth
        assert "setToken(null);" in auth
        assert "setUser(null);" in auth
        assert (mobile_root / "app" / "(tabs)" / "_layout.tsx").is_file()
        assert (mobile_root / "app" / "issues" / "[id].tsx").is_file()


def _make_issue_assignment_db(users_by_id, issue):
    """Build a small async DB mock for tenant-scoped issue assignment tests."""
    from copy import deepcopy

    users = MagicMock()
    issues = MagicMock()

    async def find_user(query, projection=None):
        candidate = users_by_id.get(query.get("id"))
        if candidate is None:
            return None
        for key, expected in query.items():
            if isinstance(expected, dict) and "$ne" in expected:
                if candidate.get(key) == expected["$ne"]:
                    return None
            elif candidate.get(key) != expected:
                return None
        return deepcopy(candidate)

    async def find_issue(query, projection=None):
        if issue is None:
            return None
        if all(issue.get(key) == value for key, value in query.items()):
            return deepcopy(issue)
        return None

    async def update_issue(query, update, **kwargs):
        matches = issue is not None and all(
            issue.get(key) == value for key, value in query.items()
        )
        if matches:
            issue.update(update.get("$set", {}))
            issue.setdefault("timeline", []).extend(update.get("$push", {}).values())
        return MagicMock(matched_count=1 if matches else 0)

    users.find_one = AsyncMock(side_effect=find_user)
    issues.find_one = AsyncMock(side_effect=find_issue)
    issues.update_one = AsyncMock(side_effect=update_issue)
    return MagicMock(users=users, issues=issues)


class TestIssueAssignment:
    """PA/admin issue assignments must stay in-tenant and target field workers."""

    def _request(self, client, assigned_to):
        import server

        token = server.create_token("uid-pa", "pa", "tenant-001")
        return client.post(
            "/api/issues/issue-1/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "assigned_to": assigned_to,
                "due_date": "2026-11-15",
                "remarks": "Please inspect the site.",
            },
        )

    def test_rejects_assignment_to_non_worker(self, client):
        import server

        users = {
            "uid-pa": {"id": "uid-pa", "role": "pa", "tenant_id": "tenant-001", "name": "PA"},
            "citizen-1": {"id": "citizen-1", "role": "citizen", "tenant_id": "tenant-001", "name": "Citizen"},
        }
        db = _make_issue_assignment_db(users, None)
        with patch.object(server, "db", db):
            response = self._request(client, "citizen-1")

        assert response.status_code == 404
        worker_query = db.users.find_one.call_args.args[0]
        assert worker_query["tenant_id"] == "tenant-001"
        assert worker_query["role"] == "worker"
        assert worker_query["is_active"] == {"$ne": False}
        db.issues.update_one.assert_not_awaited()

    def test_assigns_worker_with_remarks_and_due_date_in_same_tenant(self, client):
        import server

        users = {
            "uid-pa": {"id": "uid-pa", "role": "pa", "tenant_id": "tenant-001", "name": "PA"},
            "worker-1": {
                "id": "worker-1", "role": "worker", "tenant_id": "tenant-001",
                "name": "Field Worker", "is_active": True,
            },
        }
        issue = {
            "id": "issue-1", "tenant_id": "tenant-001", "citizen_id": "citizen-1",
            "issue_code": "ISS-10001", "title": "Streetlight outage", "timeline": [],
        }
        db = _make_issue_assignment_db(users, issue)
        with patch.object(server, "db", db), patch.object(
            server, "_push_to_user", new=AsyncMock()
        ):
            response = self._request(client, "worker-1")

        assert response.status_code == 200, response.text
        assert response.json()["assigned_to"] == "worker-1"
        assert response.json()["due_date"] == "2026-11-15"
        assert response.json()["remarks"] == "Please inspect the site."
        worker_query = db.users.find_one.call_args.args[0]
        assert worker_query["tenant_id"] == "tenant-001"
        issue_query = db.issues.update_one.call_args.args[0]
        assert issue_query == {"id": "issue-1", "tenant_id": "tenant-001"}

    def test_rejects_issue_outside_the_admin_tenant(self, client):
        import server

        users = {
            "uid-pa": {"id": "uid-pa", "role": "pa", "tenant_id": "tenant-001", "name": "PA"},
            "worker-1": {
                "id": "worker-1", "role": "worker", "tenant_id": "tenant-001",
                "name": "Field Worker", "is_active": True,
            },
        }
        issue = {"id": "issue-1", "tenant_id": "tenant-002", "timeline": []}
        db = _make_issue_assignment_db(users, issue)
        with patch.object(server, "db", db):
            response = self._request(client, "worker-1")

        assert response.status_code == 404
        assert db.issues.update_one.call_args.args[0] == {
            "id": "issue-1", "tenant_id": "tenant-001",
        }
