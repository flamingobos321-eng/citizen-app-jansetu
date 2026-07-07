"""Pydantic models for JANSETU."""
from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
import uuid


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


# ---------- Auth ----------
class CitizenOTPRequest(BaseModel):
    mobile: str
    tenant_slug: Optional[str] = None  # determined from portal URL


class CitizenOTPVerify(BaseModel):
    mobile: str
    otp: str
    tenant_slug: Optional[str] = None


class StaffLogin(BaseModel):
    email: str
    password: str
    tenant_slug: Optional[str] = None  # None means platform super_admin / fallback


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


# ---------- Users ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    role: Literal["citizen", "worker", "pa", "politician", "admin", "super_admin"]
    name: str
    tenant_id: Optional[str] = None  # null only for super_admin (platform-wide)
    email: Optional[str] = None
    mobile: Optional[str] = None
    password_hash: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    anniversary: Optional[str] = None
    occupation: Optional[str] = None
    caste_id: Optional[str] = None      # V2: Jaat (caste) taxonomy id
    religion_id: Optional[str] = None   # V2: Dharm (religion) taxonomy id
    marriage_anniversary: Optional[str] = None  # ISO date — set when Husband/Wife rel created
    household_id: Optional[str] = None
    constituency_id: Optional[str] = None
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    area_id: Optional[str] = None
    booth_id: Optional[str] = None
    region_type: Optional[Literal["urban", "rural"]] = None
    house_number: Optional[str] = None
    address: Optional[str] = None
    designation: Optional[str] = None
    must_change_password: bool = False  # forces first-login password change for auto-provisioned admins
    profile_photo: Optional[str] = None
    notes: Optional[str] = None
    # Person master fields (long-term vision)
    status: Literal["alive", "deceased"] = "alive"
    date_of_death: Optional[str] = None
    # Political CRM (long-term vision)
    supporter_since: Optional[str] = None
    political_role: Optional[str] = None  # Booth Worker / Volunteer / Coordinator / etc
    influence_level: Optional[str] = None  # Low / Medium / High
    political_notes: Optional[str] = None
    family_lineage: List[dict] = []  # [{leader_name, era, since_year, notes}]
    # Multi-role support: a single Person can be Citizen + Karyakarta + Worker etc
    extra_roles: List[Literal["karyakarta"]] = []
    karyakarta_designation: Optional[str] = None
    is_active: bool = True
    # ---- Preloaded citizen / Claim-and-Activate (v1.2+) ----
    # `preloaded=True` means the row was created by an Electoral-Roll / CSV /
    # Excel import and is waiting for its citizen to claim + activate. When
    # activated: mobile is set, activation_status="activated", account is live.
    preloaded: bool = False
    activation_status: Literal["unclaimed", "activated"] = "activated"
    activated_at: Optional[str] = None
    activation_device: Optional[str] = None
    last_login_at: Optional[str] = None
    father_name: Optional[str] = None
    husband_name: Optional[str] = None
    mother_name: Optional[str] = None       # electoral roll: relation_type=Mother
    relation_type: Optional[Literal["Father", "Husband", "Mother", "Other"]] = None
    relative_name: Optional[str] = None     # canonical (verbatim from electoral roll)
    age: Optional[int] = None
    # ---- Electoral Roll fields (Election Commission of India) ----
    # A voter card imported from an electoral roll populates these. Each voter
    # becomes ONE independent Person; family links are NEVER inferred here.
    epic_number: Optional[str] = None       # e.g. ABC1234567 — unique per office
    part_number: Optional[str] = None
    booth_number: Optional[str] = None
    serial_number: Optional[str] = None
    section_name: Optional[str] = None
    polling_station_name: Optional[str] = None
    polling_station_address: Optional[str] = None
    assembly_constituency: Optional[str] = None
    parliamentary_constituency: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village_label: Optional[str] = None     # free-text village/city from roll header
    electoral_import_id: Optional[str] = None  # link back to ElectoralRollImport
    # Import quality classification (Complete / Partial / Failed).
    #   * complete — all critical + non-critical fields present
    #   * partial  — critical fields present; missing e.g. EPIC/House/Relative Name
    #   * failed   — critical identity missing (name/age/gender) → manual review queue
    import_status: Optional[Literal["complete", "partial", "failed"]] = None
    import_missing_fields: Optional[List[str]] = None
    # Fields the admin manually corrected — reimports must NOT overwrite these
    # unless explicitly approved.
    manually_corrected_fields: Optional[List[str]] = None
    ocr_retry_count: Optional[int] = None
    created_at: str = Field(default_factory=now_iso)


# ---------- Relationships (Family Graph) ----------
RELATION_TYPES = [
    "Father", "Mother", "Son", "Daughter", "Brother", "Sister",
    "Husband", "Wife", "Grandfather", "Grandmother",
    "Grandson", "Granddaughter",
    "Uncle", "Aunt", "Nephew", "Niece", "Cousin", "Other",
]

# Inverse relationship mapping. Some inverses are gender dependent — second tuple
# entry is used when viewer's gender is "female"/"f", first otherwise.
INVERSE_RELATION = {
    "Father": ("Son", "Daughter"),
    "Mother": ("Son", "Daughter"),
    "Son": ("Father", "Mother"),
    "Daughter": ("Father", "Mother"),
    "Brother": ("Brother", "Sister"),
    "Sister": ("Brother", "Sister"),
    "Husband": ("Wife", "Wife"),
    "Wife": ("Husband", "Husband"),
    "Grandfather": ("Grandson", "Granddaughter"),
    "Grandmother": ("Grandson", "Granddaughter"),
    "Grandson": ("Grandfather", "Grandmother"),
    "Granddaughter": ("Grandfather", "Grandmother"),
    "Uncle": ("Nephew", "Niece"),
    "Aunt": ("Nephew", "Niece"),
    "Nephew": ("Uncle", "Aunt"),
    "Niece": ("Uncle", "Aunt"),
    "Cousin": ("Cousin", "Cousin"),
    "Other": ("Other", "Other"),
}


def inverse_relation(rel_type: str, viewer_gender: Optional[str] = None) -> str:
    pair = INVERSE_RELATION.get(rel_type, ("Other", "Other"))
    g = (viewer_gender or "").strip().lower()
    return pair[1] if g in ("female", "f") else pair[0]


class Relationship(BaseModel):
    """Edge in the family graph: person_a is `type` of person_b."""
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    origin_membership_id: Optional[str] = None  # V2 — actor's active staff membership in tenant
    person_a: str
    person_b: str
    type: str  # one of RELATION_TYPES
    since: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class RelationshipCreate(BaseModel):
    person_a: str
    person_b: str
    type: str
    since: Optional[str] = None
    notes: Optional[str] = None


# ---------- Service Interaction (long-term: extends beyond Issues) ----------
class ServiceInteraction(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    person_id: str
    origin_membership_id: Optional[str] = None  # V2 — subject person's active membership in tenant
    household_id: Optional[str] = None
    interaction_type: str  # Road Repair / Scheme Help / Medical / Meeting / Financial / etc
    description: str
    worker_id: Optional[str] = None
    worker_name: Optional[str] = None
    status: str = "Completed"
    remarks: Optional[str] = None
    photos: List[str] = []
    occurred_at: str = Field(default_factory=now_iso)
    created_at: str = Field(default_factory=now_iso)


class ServiceInteractionCreate(BaseModel):
    person_id: str
    household_id: Optional[str] = None
    interaction_type: str
    description: str
    worker_id: Optional[str] = None
    status: str = "Completed"
    remarks: Optional[str] = None
    photos: List[str] = []
    occurred_at: Optional[str] = None


class CitizenRegister(BaseModel):
    name: str
    mobile: str
    gender: str
    dob: Optional[str] = None
    region_type: Literal["urban", "rural"]
    ward_id: Optional[str] = None
    area_id: Optional[str] = None
    village_id: Optional[str] = None
    house_number: str
    address: str
    family_head_name: Optional[str] = None
    members_count: int = 1
    tenant_slug: Optional[str] = None  # required for multi-tenant registration


class StaffCreate(BaseModel):
    role: Literal["worker", "pa", "politician", "admin"]
    name: str
    email: str
    password: str
    designation: Optional[str] = None
    mobile: Optional[str] = None


# ---------- Constituency Structure ----------
class Constituency(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    name: str
    type: Literal["urban", "rural", "mixed"] = "mixed"
    state: str
    politician_name: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Area(BaseModel):
    """Generic area: ward / village / area / wasti / booth / taluka."""
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    constituency_id: str
    parent_id: Optional[str] = None
    name: str
    kind: Literal["city", "ward", "area", "booth", "taluka", "village", "wasti"]
    region_type: Literal["urban", "rural"]
    created_at: str = Field(default_factory=now_iso)


class AreaCreate(BaseModel):
    constituency_id: str
    parent_id: Optional[str] = None
    name: str
    kind: Literal["city", "ward", "area", "booth", "taluka", "village", "wasti"]
    region_type: Literal["urban", "rural"]


# ---------- Household ----------
class Household(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    household_code: str  # H-10001
    family_head_name: str
    address: str
    house_number: str
    region_type: Literal["urban", "rural"]
    ward_id: Optional[str] = None
    area_id: Optional[str] = None
    village_id: Optional[str] = None
    members_count: int = 1
    created_at: str = Field(default_factory=now_iso)


# ---------- Issues ----------
ISSUE_CATEGORIES = [
    "Road", "Water Supply", "Drainage", "Garbage", "Street Light",
    "Electricity", "Encroachment", "Government Scheme Assistance",
    "Health", "Education", "Public Facility", "Other",
]
ISSUE_STATUSES = ["New", "Under Review", "Assigned", "In Progress", "Resolved", "Verified", "Reopened", "Reassignment Requested", "Cancelled", "Closed"]


class Issue(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    issue_code: str  # ISS-10001
    citizen_id: str
    person_id: Optional[str] = None  # V2: set during M2 backfill + M3 dual-write
    # Amendment 1.1 — pins the record to the membership active at creation
    # time. Tenant visibility on operational data is gated by this field.
    origin_membership_id: Optional[str] = None
    household_id: Optional[str] = None
    category: str
    title: str
    description: str
    photos: List[str] = []  # storage paths
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    location_address: Optional[str] = None  # GPS-derived (reverse-geocoded) address for the issue site
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    status: str = "New"
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_dept: Optional[str] = None
    due_date: Optional[str] = None
    remarks: Optional[str] = None
    completion_notes: Optional[str] = None
    completion_photos: List[str] = []
    rating: Optional[int] = None
    feedback_comment: Optional[str] = None
    timeline: List[dict] = []  # [{status, at, by, note}]
    # Escalation reminders (P0). `escalation_level` values:
    #   0 = never escalated
    #   1 = worker reminded  (3-day threshold from anchor)
    #   2 = PA reminded      (7-day threshold from anchor)
    #   3 = MLA/politician reminded (15-day threshold from anchor)
    # `escalation_anchor_at` is the timestamp the escalation clock counts from —
    # it starts at creation and is reset to now() whenever the issue is
    # reassigned (per production rule: reassignment restarts the clock).
    escalation_level: int = 0
    last_escalated_at: Optional[str] = None
    escalation_anchor_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class IssueCreate(BaseModel):
    category: str
    title: str
    description: str
    photos: List[str] = []
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    location_address: Optional[str] = None


class IssueAssign(BaseModel):
    assigned_to: str
    due_date: Optional[str] = None
    remarks: Optional[str] = None


class IssueUpdateStatus(BaseModel):
    status: str
    remarks: Optional[str] = None
    completion_notes: Optional[str] = None
    completion_photos: List[str] = []


class IssueFeedback(BaseModel):
    rating: int
    comment: Optional[str] = None
    verified: bool  # True = resolved confirmed, False = reopen


# ---------- Visits ----------
VISIT_STATUSES = ["Draft", "Pending Approval", "Approved", "Published"]


class Visit(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    person_id: Optional[str] = None  # V2 — creator's Person id (set by dual-write)
    origin_membership_id: Optional[str] = None  # V2 — creator's staff membership at write time
    title: str
    description: Optional[str] = None
    date: str  # ISO date
    time: str
    location: str
    visit_type: str
    target_audience: Optional[str] = None
    ward_ids: List[str] = []
    village_ids: List[str] = []
    status: str = "Pending Approval"
    # V2: publication visibility. "public" (default) = citizens see it &
    # notifications fire. "internal" = office-only (MLA/PA/Staff), no citizen
    # portal visibility, no citizen notifications.
    visibility: Literal["public", "internal"] = "public"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_by: str
    created_at: str = Field(default_factory=now_iso)


class VisitCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    time: str
    location: str
    visit_type: str
    target_audience: Optional[str] = None
    ward_ids: List[str] = []
    village_ids: List[str] = []
    visibility: Literal["public", "internal"] = "public"


# ---------- Notifications ----------
class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    person_id: Optional[str] = None  # V2 — creator's Person id (set by dual-write)
    origin_membership_id: Optional[str] = None  # V2 — creator's staff membership at write time
    title: str
    body: str
    notif_type: str  # Politician Visit / Public Meeting / Scheme / Emergency / etc
    scope: Literal["all", "ward", "village", "wards", "villages", "user"] = "all"
    ward_ids: List[str] = []
    village_ids: List[str] = []
    user_ids: List[str] = []  # populated when scope == "user" (e.g. escalation reminders)
    created_by: str
    created_by_name: Optional[str] = None
    recipients_count: int = 0
    delivery_status: str = "Delivered"
    created_at: str = Field(default_factory=now_iso)


class NotificationCreate(BaseModel):
    title: str
    body: str
    notif_type: str
    scope: Literal["all", "ward", "village", "wards", "villages"] = "all"
    ward_ids: List[str] = []
    village_ids: List[str] = []


# ---------- Development Works ----------
DEV_STATUSES = ["Planned", "Approved", "Tender Issued", "Work Started", "Completed"]


class DevWork(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    person_id: Optional[str] = None  # V2 — creator's Person id (set by dual-write)
    origin_membership_id: Optional[str] = None  # V2 — creator's staff membership at write time
    title: str
    description: str
    category: str
    location: str
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    status: str = "Planned"
    budget: Optional[float] = None
    start_date: Optional[str] = None
    completion_date: Optional[str] = None
    photos: List[str] = []
    approved: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    progress_updates: List[dict] = []  # [{at, by, note}]
    created_by: str
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class DevWorkCreate(BaseModel):
    title: str
    description: str
    category: str
    location: str
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    status: str = "Planned"
    budget: Optional[float] = None
    start_date: Optional[str] = None
    completion_date: Optional[str] = None
    photos: List[str] = []



SUBSCRIPTION_PLANS = ["trial", "starter", "professional", "enterprise"]
PORTAL_STATUSES = ["active", "suspended"]


# ---------- White Label Portal Config (=Tenant) ----------
class PortalConfig(BaseModel):
    """Per-client tenant. The id of this doc IS the tenant_id partition key
    used across every other domain collection. White-label branding fields
    live here alongside subscription and integration settings.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    slug: str  # LEGACY URL fragment — kept for backwards compat; new tenants
               # get a synthetic slug matching the office_code (lowercased).
               # office_code is the canonical public identifier (v1.1+).
    office_code: Optional[str] = None  # canonical Office Code, e.g. "JS1045".
                                       # unique globally, immutable once any
                                       # citizen has registered under it.
    is_active: bool = True
    is_default: bool = False

    # Identity
    politician_name: str          # Representative Name
    designation: str
    constituency_name: str        # Assembly Constituency
    constituency_id: Optional[str] = None
    office_name: Optional[str] = None
    office_type: Optional[str] = None   # MLA / MP / Corporator / Panchayat / Trust / Other
    district: Optional[str] = None
    state: Optional[str] = None

    # Primary tenant admin (auto-provisioned on creation)
    primary_admin_email: Optional[str] = None
    primary_admin_user_id: Optional[str] = None

    # Branding
    logo_path: Optional[str] = None
    hero_image_path: Optional[str] = None
    theme_color: str = "#0A1128"          # alias: primary_color
    accent_color: Optional[str] = None    # alias: secondary_color
    welcome_message: str
    tagline: Optional[str] = None

    # Contact
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_address: Optional[str] = None
    office_hours: Optional[str] = None
    social_links: dict = {}  # {facebook, twitter, instagram, youtube, whatsapp}

    # Localization
    timezone: str = "Asia/Kolkata"
    language: str = "en"  # ISO 639-1

    # Subscription / lifecycle
    subscription_plan: str = "trial"            # one of SUBSCRIPTION_PLANS
    subscription_start: Optional[str] = None    # ISO date
    subscription_expiry: Optional[str] = None   # ISO date
    # Extended billing (super-admin managed)
    service_start_date: Optional[str] = None
    billing_cycle: Optional[Literal["monthly", "quarterly", "half_yearly", "yearly"]] = None
    agreed_amount: Optional[float] = None       # INR
    next_renewal_date: Optional[str] = None
    billing_notes: Optional[str] = None
    is_trial: bool = True
    trial_expiry: Optional[str] = None
    portal_status: str = "active"               # active | suspended
    max_staff_limit: int = 25
    custom_domain: Optional[str] = None         # e.g. "rajeshpatil.in" (future use)

    # Integrations (per-tenant, stored as dicts to stay schema-flexible)
    whatsapp_config: dict = {}    # {provider, api_key, sender, webhook}  — v2+
    sms_config: dict = {}         # LEGACY — kept for backwards compat, not used in v1
    # -------- OTP / Communication (v1) --------
    # Per-tenant, no cross-tenant credential sharing.
    #   communication_mode: "development" → fixed OTP "123456", no provider call
    #   communication_mode: "production"  → random OTP, delivered via configured provider
    # The `otp_config` dict is intentionally provider-agnostic so we can add
    # WhatsApp / Email / other SMS gateways later without changing business logic.
    #   {
    #     "provider":       "fast2sms",       # only value supported in v1
    #     "api_key":        "<tenant secret>",
    #     "sender_id":      "ABCMLA",
    #     "message_id":     "17071xxxxxxx",   # DLT-approved OTP template id
    #     "route":          "dlt",
    #   }
    communication_mode: Literal["development", "production"] = "development"
    otp_config: dict = {}

    # Setup wizard progress for tenant admin first-time setup
    setup_progress: dict = {}     # {branding, constituency, pa, workers, areas, citizens}
    setup_completed: bool = False

    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class PortalConfigCreate(BaseModel):
    slug: Optional[str] = None   # OPTIONAL — derived from office_code if omitted
    office_code: Optional[str] = None  # Office Code (JS####) — auto-generated
                                       # on the client via /admin/office-code/generate
                                       # and passed here on create. If omitted,
                                       # server generates a fresh one.
    politician_name: str          # Representative name
    designation: str
    constituency_name: str        # Assembly Constituency
    welcome_message: str
    constituency_id: Optional[str] = None
    office_name: Optional[str] = None
    office_type: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    logo_path: Optional[str] = None
    hero_image_path: Optional[str] = None
    theme_color: str = "#0A1128"
    accent_color: Optional[str] = None
    tagline: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_address: Optional[str] = None
    office_hours: Optional[str] = None
    social_links: dict = {}
    timezone: str = "Asia/Kolkata"
    language: str = "en"
    subscription_plan: str = "trial"
    is_trial: bool = True
    trial_expiry: Optional[str] = None
    max_staff_limit: int = 25
    custom_domain: Optional[str] = None
    # Optional admin override; if omitted, server generates admin@<slug>.jansetu.in
    primary_admin_email: Optional[str] = None
    primary_admin_name: Optional[str] = None
    # OTP / communication — safe defaults (dev-mode) so a new portal is
    # instantly usable without a live SMS gateway. Tenant admin flips to
    # production after DLT approval.
    communication_mode: Literal["development", "production"] = "development"
    otp_config: dict = {}


# ==========================================================================
# ============================  V2  ARCHITECTURE  ==========================
# ==========================================================================
# Added per "JanSetu V2 Master Technical Architecture v1.0" (signed off).
# These models are ADDITIVE — V1 collections remain authoritative until M4.
# Nothing here changes runtime behaviour on its own; collections will start
# accumulating data only when the M2 backfill / dual-write code is enabled.
# Sprint A scope: Person, Credential, Membership, PersonAudit, PersonConsent,
#                 AccessAudit. Political-CRM (Party, Election, ...) ship in
#                 Sprint B but their models are sketched here so migration
#                 scripts can reference them safely.
# ==========================================================================


# ---------- V2 Identity Layer (global, NO tenant_id) ----------

class Person(BaseModel):
    """Permanent identity. Survives constituency transfers, marriages,
    credential rotations, even death (status='deceased')."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)  # "p_<uuid>" assigned by service layer
    name: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    photo_path: Optional[str] = None
    # A person can be more than one type over their lifetime.
    types: List[Literal["citizen", "supporter", "volunteer", "worker",
                        "politician", "staff", "journalist", "external"]] = ["citizen"]
    status: Literal["active", "redacted", "deceased", "merged"] = "active"
    merged_into_person_id: Optional[str] = None  # set only when status='merged'
    # Amendment 1.1 — cached pointers to the current active membership for
    # fast lookups. Source of truth = memberships collection. NULL for staff.
    current_organisation_id: Optional[str] = None
    current_membership_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class Credential(BaseModel):
    """Login proof attached to a Person. A Person may have many credentials
    (multiple mobiles, email, OAuth, Aadhaar offline, voter ID, DigiLocker).
    Uniqueness is enforced ONLY among status='active' rows of the same type."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    type: Literal["mobile", "email", "google_oauth", "aadhaar_offline",
                  "voter_id", "digilocker"]
    value: str
    verified_at: Optional[str] = None  # ISO timestamp of last successful OTP / OAuth
    last_used_at: Optional[str] = None
    status: Literal["active", "revoked", "expired"] = "active"
    created_at: str = Field(default_factory=now_iso)


class RelationshipV2(BaseModel):
    """V2 family edge — GLOBAL. No tenant_id. Survives transfers.

    Stored in `relationships_v2` collection (V1's `relationships` continues
    to exist until M5 decommission)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    from_person_id: str
    to_person_id: str
    type: str  # father|mother|son|daughter|spouse|guardian|sibling|...
    since_date: Optional[str] = None
    until_date: Optional[str] = None
    status: Literal["active", "ended"] = "active"
    notes: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    created_by_person_id: Optional[str] = None


# ---------- V2 Tenancy / Membership Layer ----------

class Membership(BaseModel):
    """Polymorphic person<->organisation link with history.
    scope_type future-proofs the schema for party-office / NGO / municipal
    memberships without redesign. v1 enforces ≤1 active membership per person
    in the application layer (NOT a unique index)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    organisation_id: str  # = portal_configs.id; renamed in service layer
    scope_type: Literal["constituency", "staff", "party_office", "ngo",
                        "municipal", "panchayat", "govt_dept", "csr"] = "constituency"
    household_id: Optional[str] = None
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    address: Optional[str] = None
    start_date: str = Field(default_factory=now_iso)
    end_date: Optional[str] = None
    status: Literal["active", "archived", "pending_transfer", "superseded"] = "active"
    transfer_reason: Optional[str] = None  # marriage|migration|job|education|other
    transferred_from_membership_id: Optional[str] = None
    # Amendment 1.1 — symmetric pointer set on the ARCHIVED row when transfer
    # completes; powers the "Transferred to <Org>" banner without N-queries.
    transferred_to_membership_id: Optional[str] = None
    transferred_to_organisation_id: Optional[str] = None
    archive_reason: Optional[Literal["transferred", "left", "merged", "deceased"]] = None
    is_primary: bool = True  # future multi-active will set is_primary=false on secondaries
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ---------- V2 Privacy / Consent / Audit Layer ----------

class PersonConsent(BaseModel):
    """Per-(person, organisation, tier) consent. Default tier1+tier2 granted
    automatically on registration / transfer-in. Revocation blocks future reads
    but does NOT erase past data (use Person.status='redacted' for that)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    organisation_id: str
    scope: Literal["tier1", "tier2", "tier3"]
    granted_at: str = Field(default_factory=now_iso)
    revoked_at: Optional[str] = None
    source: Literal["auto_on_registration", "auto_on_transfer", "explicit"] = "explicit"


class PersonAudit(BaseModel):
    """Append-only event log for a Person (created, transferred, merged,
    redacted, credential added/revoked, etc.). Source of truth for compliance."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    event: str
    at: str = Field(default_factory=now_iso)
    by_user_id: Optional[str] = None
    by_tenant_id: Optional[str] = None
    payload: dict = {}


class AccessAudit(BaseModel):
    """Logged on every Tier-2/Tier-3 READ of personal data. Powers the
    self-service audit report for politicians and forensic investigations."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    organisation_id: str
    accessed_by_user_id: str
    fields_accessed: List[str] = []
    justification: Optional[str] = None
    at: str = Field(default_factory=now_iso)


# ---------- V2 Political CRM Layer (schema only — wired in Sprint B) ----------

class Party(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    short_name: Optional[str] = None
    logo: Optional[str] = None
    founded_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class PositionDefinition(BaseModel):
    """Per-party position tree. e.g. BJP's 'Booth President' lives only inside
    BJP's tree; Congress has its own."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    party_id: str
    name: str
    level: int = 1  # 1 = top of party hierarchy
    parent_position_id: Optional[str] = None
    default_influence_weight: int = 0


class PartyMembership(BaseModel):
    """Append-only political-affiliation timeline."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    party_id: str
    position_id: Optional[str] = None
    scope_type: Literal["national", "state", "district",
                        "constituency", "ward", "booth"] = "constituency"
    scope_id: Optional[str] = None
    scope_label: Optional[str] = None
    start_date: str = Field(default_factory=now_iso)
    end_date: Optional[str] = None
    status: Literal["active", "past", "defected"] = "active"
    source_event: Literal["elected", "appointed",
                          "joined", "left", "defected"] = "joined"
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Election(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    year: int
    type: Literal["lok_sabha", "vidhan_sabha", "municipal", "panchayat"]
    scope_type: Optional[str] = None
    scope_id: Optional[str] = None
    polling_date: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ElectionEvent(BaseModel):
    """A Person's participation in a specific election."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    election_id: str
    role: Literal["voter", "volunteer", "polling_agent",
                  "candidate", "observer"]
    party_id: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    recorded_at: str = Field(default_factory=now_iso)


class InfluenceSignal(BaseModel):
    """Append-only weighted signal feeding the computed influence score.
    A score is NEVER stored as ground truth — it is recomputed from signals."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    signal_type: Literal["position", "household", "attendance",
                         "social_reach", "volunteer_hours", "custom"]
    weight: int = 1
    value: float = 0.0
    source: Literal["auto", "manual", "import"] = "auto"
    scope_organisation_id: Optional[str] = None  # tenant-specific signal
    recorded_at: str = Field(default_factory=now_iso)
    recorded_by: Optional[str] = None


# ---------- V2 Person Timeline (Amendment 1.1) ----------

class PersonTimelineEvent(BaseModel):
    """Denormalised, append-only event stream powering Person 360 and the
    citizen's lifetime view. ONE row per civic event.

    Tier-3 (political intelligence) events NEVER enter this collection — they
    remain in tenant-scoped intelligence stores. Credential-management events
    (added/revoked) also stay out per user policy; they live only in
    person_audit (for super-admin + compliance).

    Visibility at READ time:
      • Citizen (self) → all rows for their person_id.
      • Tenant staff   → rows where organisation_id == acting tenant's id.
      • Super admin    → all rows.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str                               # indexed
    organisation_id: Optional[str] = None        # tenant that generated the event (NULL for global events)
    membership_id: Optional[str] = None          # which membership was active at the time
    event_type: Literal[
        # civic / operational
        "registered", "complaint_raised", "complaint_assigned",
        "complaint_in_progress", "complaint_reassigned",
        "complaint_resolved", "complaint_feedback",
        "visit_logged", "visit_announced", "visit_approved",
        "devwork_announced", "devwork_completed", "devwork_benefited",
        "scheme_applied", "meeting_attended", "interaction_logged",
        "notification_published",
        # lifecycle
        "profile_updated", "household_changed",
        "membership_created", "membership_archived", "membership_transferred",
        "relationship_added", "relationship_removed",
        "party_joined", "party_left",
    ]
    at: str = Field(default_factory=now_iso)
    ref_collection: Optional[str] = None         # e.g. "issues", "memberships"
    ref_id: Optional[str] = None
    label: str                                   # human-readable, e.g. "Complaint #1042"
    summary: Optional[str] = None
    tier: Literal["public", "operational"] = "operational"



# ---------- V2 Transfer Workflow ----------

class TransferRequest(BaseModel):
    """Tracks a citizen-initiated constituency transfer.

    State machine: otp_pending → completed | expired | cancelled.
    Idempotent: completing a `completed` request returns the prior outcome
    instead of re-running the side-effects.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    person_id: str
    mobile: str
    from_user_id: str
    from_organisation_id: str
    from_membership_id: str
    to_tenant_slug: str
    to_organisation_id: str
    reason: Optional[str] = None
    status: Literal["otp_pending", "completed", "expired", "cancelled"] = "otp_pending"
    otp_attempts: int = 0
    # Snapshot of the outcome — populated when status=completed
    new_user_id: Optional[str] = None
    new_membership_id: Optional[str] = None
    new_household_id: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    # Expires after 10 minutes if not verified (computed at create-time).
    expires_at: Optional[str] = None


class MembershipAudit(BaseModel):
    """Append-only event log for Membership lifecycle (created / archived /
    transferred_out / transferred_in / cross_linked). Separate from
    PersonAudit so compliance can subscribe to membership events alone.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    membership_id: str
    person_id: str
    organisation_id: str
    event: Literal["created", "archived", "transferred_out",
                   "transferred_in", "cross_linked", "updated"]
    at: str = Field(default_factory=now_iso)
    by_user_id: Optional[str] = None
    by_tenant_id: Optional[str] = None
    payload: dict = {}


class TransferInitiate(BaseModel):
    mobile: str
    target_tenant_slug: str
    reason: Optional[str] = None


class TransferAddress(BaseModel):
    region_type: Literal["urban", "rural"]
    house_number: Optional[str] = None
    ward_id: Optional[str] = None
    area_id: Optional[str] = None
    village_id: Optional[str] = None
    address: str
    members_count: int = 1
    family_head_name: Optional[str] = None


class TransferVerify(BaseModel):
    transfer_request_id: str
    otp: str
    new_address: TransferAddress


class CitizenMobileCheck(BaseModel):
    mobile: str
    tenant_slug: str


# ==============================================================================
# Taxonomy (Caste / Religion) — tenant-scoped configurable lookups.
# ==============================================================================
class Caste(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    tenant_id: str
    name: str                  # e.g. "Maratha", "Brahmin"
    code: Optional[str] = None
    category: Optional[str] = None  # e.g. General / OBC / SC / ST / EWS
    created_at: str = Field(default_factory=now_iso)


class Religion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    tenant_id: str
    name: str                  # e.g. "Hindu", "Muslim", "Christian"
    code: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class TaxonomyCreate(BaseModel):
    name: str
    code: Optional[str] = None
    category: Optional[str] = None


# ==============================================================================
# Family Invitations — pending links keyed by mobile until the target registers.
# ==============================================================================
class FamilyInvitation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    tenant_id: str
    from_user_id: str                    # V1 user who initiated
    from_person_id: str
    target_mobile: str                   # mobile of the invitee
    target_name: Optional[str] = None
    relation_type: str                   # RELATION_TYPES value
    marriage_anniversary: Optional[str] = None  # captured only for Husband/Wife
    status: Literal["pending", "accepted", "declined", "linked"] = "pending"
    resolved_user_id: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class FamilyLinkRequest(BaseModel):
    """Payload for `POST /api/family/link`. Either links to an existing citizen
    (mobile already registered) or creates a Pending Family Invitation."""
    relation_type: str
    mobile: str
    target_name: Optional[str] = None
    marriage_anniversary: Optional[str] = None


# ==============================================================================
# Karyakarta (party worker / volunteer) — role attached to a Person.
# When mobile is not yet registered, we keep a PendingKaryakarta row that will
# auto-link on registration.
# ==============================================================================
class Karyakarta(BaseModel):
    """A karyakarta record is always linked to a resolved Person id. If the
    person's mobile was not yet registered at import time, a `PendingKaryakarta`
    is created instead and auto-promoted to `Karyakarta` on registration."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    tenant_id: str
    person_id: str
    user_id: Optional[str] = None        # V1 user id if any
    name: str
    mobile: str
    designation: Optional[str] = None
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    dob: Optional[str] = None
    anniversary: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=now_iso)


class PendingKaryakarta(BaseModel):
    """Waiting for the mobile owner to register. Consumed by
    citizen_register (fully) or by a super-admin manual attach step."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    tenant_id: str
    name: str
    mobile: str
    designation: Optional[str] = None
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    dob: Optional[str] = None
    anniversary: Optional[str] = None
    notes: Optional[str] = None
    imported_by: Optional[str] = None
    imported_at: str = Field(default_factory=now_iso)
    status: Literal["pending", "linked", "cancelled"] = "pending"
    linked_person_id: Optional[str] = None


class KaryakartaCreate(BaseModel):
    name: str
    mobile: str
    designation: Optional[str] = None
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    dob: Optional[str] = None
    anniversary: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# ELECTORAL ROLL IMPORT — per-file processing record + summary
# ============================================================================
class ElectoralRollImport(BaseModel):
    """One row per uploaded PDF (a single Part of the roll).

    * Each voter card in the PDF becomes ONE independent Person in db.users.
    * Family relationships are NEVER inferred from the roll.
    * Duplicate detection is keyed on (tenant_id, epic_number).
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    tenant_id: str                                # office that owns this import
    uploaded_by: str                              # user id
    uploaded_by_name: Optional[str] = None
    file_name: str
    file_size: int = 0
    language: Optional[Literal["english", "marathi"]] = None
    part_number: Optional[str] = None
    booth_number: Optional[str] = None
    assembly_constituency: Optional[str] = None
    parliamentary_constituency: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village_label: Optional[str] = None
    total_records: int = 0
    # New classification counters (per PRD v1.3.2).
    complete: int = 0       # fully-extracted voters
    partial: int = 0        # imported but missing non-critical fields
    failed: int = 0         # missing critical identity → manual review queue
    # Legacy counters kept for backwards compatibility of history rows.
    imported: int = 0       # new Person records created (complete + partial)
    updated: int = 0        # existing Person records updated
    duplicates: int = 0
    processing_ms: int = 0
    status: Literal["processing", "completed", "failed"] = "processing"
    errors: List[dict] = []                       # [{page, record_number, error}]
    header: dict = {}                             # snapshot of parsed header
    created_at: str = Field(default_factory=now_iso)
    completed_at: Optional[str] = None

