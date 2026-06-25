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
    is_active: bool = True
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
ISSUE_STATUSES = ["New", "Under Review", "Assigned", "In Progress", "Resolved", "Verified", "Reopened", "Reassignment Requested"]


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


# ---------- Notifications ----------
class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    tenant_id: Optional[str] = None
    person_id: Optional[str] = None  # V2 — creator's Person id (set by dual-write)
    origin_membership_id: Optional[str] = None  # V2 — creator's staff membership at write time
    title: str
    body: str
    notif_type: str  # Politician Visit / Public Meeting / Scheme / Emergency / etc
    scope: Literal["all", "ward", "village", "wards", "villages"] = "all"
    ward_ids: List[str] = []
    village_ids: List[str] = []
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
    slug: str  # unique URL-safe identifier, e.g. "pune-cantonment"
    is_active: bool = True
    is_default: bool = False

    # Identity
    politician_name: str
    designation: str
    constituency_name: str
    constituency_id: Optional[str] = None  # filter content scope if set

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
    is_trial: bool = True
    trial_expiry: Optional[str] = None
    portal_status: str = "active"               # active | suspended
    max_staff_limit: int = 25
    custom_domain: Optional[str] = None         # e.g. "rajeshpatil.in" (future use)

    # Integrations (per-tenant, stored as dicts to stay schema-flexible)
    whatsapp_config: dict = {}    # {provider, api_key, sender, webhook}
    sms_config: dict = {}         # {provider, api_key, sender_id}

    # Setup wizard progress for tenant admin first-time setup
    setup_progress: dict = {}     # {branding, constituency, pa, workers, areas, citizens}
    setup_completed: bool = False

    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class PortalConfigCreate(BaseModel):
    slug: str
    politician_name: str
    designation: str
    constituency_name: str
    welcome_message: str
    constituency_id: Optional[str] = None
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
