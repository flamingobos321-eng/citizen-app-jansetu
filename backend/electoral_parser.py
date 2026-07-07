"""Electoral Roll PDF Parser (JanSetu).

Parses Election Commission of India electoral roll PDFs in English or Marathi
into a common voter record structure. Language is auto-detected from PDF
content — no manual selection required.

Design (per PRD):
    Base Import Engine  →  Language Parsers  →  Common Person Records

    - Each voter card becomes ONE independent Person.
    - We DO NOT infer family relationships from the roll.
    - We DO extract the ``relative_name`` and its ``relation_type`` verbatim.
    - Duplicates are keyed on (office_id, epic_number).

New states / languages plug in as additional parser modules without touching
the core engine.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------
@dataclass
class RollHeader:
    """Header extracted once per uploaded Part."""
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    assembly_constituency: Optional[str] = None
    parliamentary_constituency: Optional[str] = None
    part_number: Optional[str] = None
    booth_number: Optional[str] = None
    polling_station_name: Optional[str] = None
    polling_station_address: Optional[str] = None
    section_name: Optional[str] = None
    total_male: Optional[int] = None
    total_female: Optional[int] = None
    total_voters: Optional[int] = None
    language: str = "english"


@dataclass
class VoterRecord:
    """Voter card — ONE independent Person."""
    # Location context (denormalised for search / filtering)
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    assembly_constituency: Optional[str] = None
    parliamentary_constituency: Optional[str] = None
    booth_number: Optional[str] = None
    part_number: Optional[str] = None
    section_name: Optional[str] = None
    # Voter card body
    serial_number: Optional[str] = None
    epic_number: Optional[str] = None
    full_name: Optional[str] = None
    relative_name: Optional[str] = None
    relation_type: Optional[str] = None  # Father / Husband / Mother / Other
    house_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    photo_available: Optional[bool] = None
    # Diagnostics
    _page: Optional[int] = None
    _language: str = "english"


@dataclass
class ParseError:
    page: Optional[int] = None
    record_number: Optional[str] = None
    error: str = ""


@dataclass
class ParseResult:
    header: RollHeader = field(default_factory=RollHeader)
    voters: List[VoterRecord] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    language: str = "english"
    pages: int = 0


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def _detect_language(text: str) -> str:
    """Return "marathi" if any Devanagari code-point is present, else "english"."""
    return "marathi" if _DEVANAGARI_RE.search(text or "") else "english"


# ---------------------------------------------------------------------------
# Shared regex helpers (English + Marathi variants)
# ---------------------------------------------------------------------------
# EPIC = Voter ID (e.g. ABC1234567) — same across languages.
EPIC_RE = re.compile(r"\b([A-Z]{3}[0-9]{7})\b")

# Serial number at start of a voter card block. Cards typically look like:
#   "23  Name : Rahul Patil"  (English)
#   "२३  नाव : राहुल पाटील"    (Marathi)
SERIAL_RE = re.compile(r"^\s*(\d{1,4})\s+", re.MULTILINE)

# Age is common in both languages: "Age: 32" / "वय: 32"
AGE_RE = re.compile(r"(?:Age|वय|उम्र)\s*[:\-]?\s*(\d{1,3})", re.IGNORECASE)

# Gender common tokens.
GENDER_MALE = re.compile(r"(?:Male|पुरुष|पुरूष|M\b)", re.IGNORECASE)
GENDER_FEMALE = re.compile(r"(?:Female|स्त्री|महिला|F\b)", re.IGNORECASE)

# House number variants.
HOUSE_RE = re.compile(
    r"(?:House\s*No\.?|House\s*Number|घर\s*क्र\.?|घर\s*क्रमांक|घर\s*नं\.?)\s*[:\-]?\s*([A-Za-z0-9/\-\u0900-\u097F]+)",
    re.IGNORECASE,
)

# Relation blocks: capture relative name + relation kind.
_ENGLISH_REL = re.compile(
    r"(Father|Husband|Mother|Other|Guardian)['\u2019]?s?\s*Name\s*[:\-]?\s*([^\n]+?)(?=\s{2,}|House|Age|Sex|Gender|$)",
    re.IGNORECASE,
)
_MARATHI_REL = re.compile(
    r"(वडिलांचे|पतीचे|आईचे|इतर)\s*नाव\s*[:\-]?\s*([^\n]+?)(?=\s{2,}|घर|वय|लिंग|$)",
)

# Full name capture. Match "Name:" where it's NOT the "<Relation>'s Name" label.
# We capture until newline or 2+ spaces (whichever comes first), then trim
# trailing label bleed-in in _parse_card.
_NAME_EN = re.compile(
    r"(?<!'s )(?<!'s\s)\bName\s*[:\-]\s*(.+?)(?=\n|$|\s{2,})",
    re.IGNORECASE,
)
_NAME_MR = re.compile(
    r"(?<!चे )नाव\s*[:\-]\s*(.+?)(?=\n|$|\s{2,})",
)


# ---------------------------------------------------------------------------
# Header helpers
# ---------------------------------------------------------------------------
_HEADER_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("state", re.compile(r"(?:State|राज्य)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("district", re.compile(r"(?:District|जिल्हा)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("taluka", re.compile(r"(?:Taluka|Tehsil|तालुका|तहसील)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("village", re.compile(r"(?:Village|City|गाव|शहर)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("assembly_constituency", re.compile(
        r"(?:Assembly\s*Constituency|Assembly\s*Const(?:\.|)|विधानसभा\s*मतदार\s*संघ|विधान\s*सभा)"
        r"[^:\n]*[:\-]\s*([^\n]+)", re.IGNORECASE,
    )),
    ("parliamentary_constituency", re.compile(
        r"(?:Parliamentary\s*Constituency|Parliamentary\s*Const(?:\.|)|लोकसभा\s*मतदार\s*संघ|संसदीय)"
        r"[^:\n]*[:\-]\s*([^\n]+)", re.IGNORECASE,
    )),
    ("part_number", re.compile(r"(?:Part\s*No\.?|Part\s*Number|भाग\s*(?:सं|क्र)\.?)\s*[:\-]?\s*([0-9]+)", re.IGNORECASE)),
    ("booth_number", re.compile(r"(?:Booth\s*No\.?|Booth\s*Number|बूथ\s*(?:सं|क्र)\.?)\s*[:\-]?\s*([A-Za-z0-9\-]+)", re.IGNORECASE)),
    ("polling_station_name", re.compile(r"(?:Polling\s*Station|मतदान\s*केंद्र)\s*[:\-]\s*([^\n]+)", re.IGNORECASE)),
    ("section_name", re.compile(r"(?:Section|विभाग)\s*[:\-]\s*([^\n]+)", re.IGNORECASE)),
    ("total_male", re.compile(r"(?:Male|पुरुष)\s*[:\-]?\s*([0-9]{1,7})", re.IGNORECASE)),
    ("total_female", re.compile(r"(?:Female|स्त्री|महिला)\s*[:\-]?\s*([0-9]{1,7})", re.IGNORECASE)),
    ("total_voters", re.compile(r"(?:Total\s*(?:Voters|Electors)|एकूण\s*मतदार)\s*[:\-]?\s*([0-9]{1,7})", re.IGNORECASE)),
]


def _extract_header(header_text: str, language: str) -> RollHeader:
    h = RollHeader(language=language)
    for field_name, pat in _HEADER_PATTERNS:
        m = pat.search(header_text or "")
        if m:
            val = m.group(1).strip().rstrip(",;")
            if field_name in ("total_male", "total_female", "total_voters"):
                try:
                    setattr(h, field_name, int(val))
                except ValueError:
                    pass
            else:
                setattr(h, field_name, val)
    return h


# ---------------------------------------------------------------------------
# Voter card splitter — each card starts with a serial number followed by the
# voter's data. Splitting on EPIC boundaries is much more reliable than trying
# to slice by serial numbers alone, because EPIC is unique per card.
# ---------------------------------------------------------------------------
def _split_cards(page_text: str) -> List[str]:
    """Return raw text blocks — each a candidate voter card.

    Strategy: split on EPIC anchors.  Preceding text (up to the previous EPIC
    or the top of the page) is kept alongside each EPIC so we get one block
    per card containing all its labels + values."""
    if not page_text:
        return []
    matches = list(EPIC_RE.finditer(page_text))
    if not matches:
        return []
    cards: List[str] = []
    prev_end = 0
    for m in matches:
        # Block spans from previous split point to just after this EPIC.
        # We take a look-ahead of a few chars to catch any trailing labels
        # (some templates place EPIC last, some place it first).
        start = prev_end
        end = m.end() + 60  # small trailing buffer
        cards.append(page_text[start:end])
        prev_end = m.end()
    return cards


def _parse_card(raw: str, language: str) -> Optional[VoterRecord]:
    if not raw or not raw.strip():
        return None
    v = VoterRecord(_language=language)

    epic_m = EPIC_RE.search(raw)
    if epic_m:
        v.epic_number = epic_m.group(1).strip().upper()

    # Serial number — first standalone digit sequence anywhere near the start.
    sn = SERIAL_RE.search(raw)
    if sn:
        v.serial_number = sn.group(1)

    # Name
    name_pat = _NAME_MR if language == "marathi" else _NAME_EN
    m = name_pat.search(raw)
    if m:
        v.full_name = _clean(m.group(1))

    # Relation + relative name
    rel_pat = _MARATHI_REL if language == "marathi" else _ENGLISH_REL
    m = rel_pat.search(raw)
    if m:
        rel_label = m.group(1).strip().lower()
        v.relative_name = _clean(m.group(2))
        v.relation_type = _normalize_relation(rel_label)

    # House number
    m = HOUSE_RE.search(raw)
    if m:
        v.house_number = _clean(m.group(1))

    # Age
    m = AGE_RE.search(raw)
    if m:
        try:
            v.age = int(m.group(1))
        except ValueError:
            pass

    # Gender
    if GENDER_FEMALE.search(raw):
        v.gender = "Female"
    elif GENDER_MALE.search(raw):
        v.gender = "Male"

    # Photo available — heuristic: EC PDFs render a placeholder text
    # "Photo Available" or a photo cell.  We conservatively mark True whenever
    # a card has both name and epic (a photoed card).  Downstream code doesn't
    # rely on this.
    v.photo_available = bool(v.full_name and v.epic_number)

    # A card is only useful if we got at least a name + EPIC OR name + relative.
    if not v.full_name and not v.epic_number:
        return None
    return v


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = re.sub(r"\s+", " ", s).strip(" -:;,")
    return s or None


def _normalize_relation(label: str) -> str:
    label = (label or "").lower()
    if any(k in label for k in ("father", "वडिल", "वडील")):
        return "Father"
    if any(k in label for k in ("husband", "पती", "पति")):
        return "Husband"
    if any(k in label for k in ("mother", "आई", "मा")):
        return "Mother"
    return "Other"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def parse_pdf(pdf_bytes: bytes) -> ParseResult:
    """Parse an electoral-roll PDF and return a ParseResult.

    Auto-detects language from PDF text content.
    """
    result = ParseResult()
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            result.pages = len(pdf.pages)
            all_text_parts: List[str] = []
            for page in pdf.pages:
                try:
                    all_text_parts.append(page.extract_text() or "")
                except Exception as e:
                    result.errors.append(ParseError(page=getattr(page, "page_number", None),
                                                   error=f"extract_text failed: {e}"))
                    all_text_parts.append("")

            full_text = "\n".join(all_text_parts)
            language = _detect_language(full_text)
            result.language = language

            # Header — extract from first 2 pages (EC of India rolls put summary/
            # header on first page; voter cards start from page 2 or 3).
            header_text = "\n".join(all_text_parts[:2])
            result.header = _extract_header(header_text, language)

            # Voter cards — parse per page for accurate page-number reporting.
            for idx, page_text in enumerate(all_text_parts, start=1):
                cards = _split_cards(page_text)
                for raw in cards:
                    try:
                        v = _parse_card(raw, language)
                        if v is None:
                            continue
                        v._page = idx
                        # Fill location context from the header (voter records
                        # don't repeat these on the card body).
                        for f_ in ("state", "district", "taluka", "village",
                                   "assembly_constituency", "parliamentary_constituency",
                                   "booth_number", "part_number", "section_name"):
                            if getattr(v, f_) is None and getattr(result.header, f_) is not None:
                                setattr(v, f_, getattr(result.header, f_))
                        result.voters.append(v)
                    except Exception as e:
                        result.errors.append(ParseError(page=idx, error=str(e)))
    except Exception as e:
        result.errors.append(ParseError(error=f"pdfplumber open failed: {e}"))
    return result


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------
def result_to_dict(result: ParseResult) -> Dict[str, Any]:
    return {
        "language": result.language,
        "pages": result.pages,
        "header": asdict(result.header),
        "voters": [asdict(v) for v in result.voters],
        "errors": [asdict(e) for e in result.errors],
    }
