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


class CitizenOTPVerify(BaseModel):
    mobile: str
    otp: str


class StaffLogin(BaseModel):
    email: str
    password: str


# ---------- Users ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    role: Literal["citizen", "worker", "pa", "politician", "admin"]
    name: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    password_hash: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    household_id: Optional[str] = None
    constituency_id: Optional[str] = None
    ward_id: Optional[str] = None
    village_id: Optional[str] = None
    area_id: Optional[str] = None
    booth_id: Optional[str] = None
    region_type: Optional[Literal["urban", "rural"]] = None
    house_number: Optional[str] = None
    address: Optional[str] = None
    designation: Optional[str] = None  # for worker/politician
    is_active: bool = True
    created_at: str = Field(default_factory=now_iso)


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
    name: str
    type: Literal["urban", "rural", "mixed"] = "mixed"
    state: str
    politician_name: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Area(BaseModel):
    """Generic area: ward / village / area / wasti / booth / taluka."""
    id: str = Field(default_factory=new_id)
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
ISSUE_STATUSES = ["New", "Under Review", "Assigned", "In Progress", "Resolved", "Verified", "Reopened"]


class Issue(BaseModel):
    id: str = Field(default_factory=new_id)
    issue_code: str  # ISS-10001
    citizen_id: str
    household_id: Optional[str] = None
    category: str
    title: str
    description: str
    photos: List[str] = []  # storage paths
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
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
