"""Electoral Roll PDF Parser (JanSetu).

Parses Election Commission of India electoral roll PDFs in English or Marathi
into a common voter record structure. Language is auto-detected — no manual
selection required.

Design (per PRD):
    Base Import Engine  →  Language Parsers  →  Common Person Records

    - Each voter card becomes ONE independent Person.
    - We DO NOT infer family relationships from the roll.
    - We DO extract the ``relative_name`` and its ``relation_type`` verbatim.
    - Duplicates are keyed on (office_id, epic_number).

Two extraction modes:
    1.  **Text-layer** (pdfplumber) — for born-digital PDFs.
    2.  **OCR grid-crop** (Tesseract + pdf2image) — for scanned image-only PDFs
        used by the Election Commission of India, which are a 3-column × N-row
        grid of voter cards.

New states / languages plug in by (a) adding language codes to the OCR call and
(b) extending the regex tables below.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber

try:
    from pdf2image import convert_from_bytes
    import pytesseract
    from pytesseract import Output
    _OCR_AVAILABLE = True
except ImportError:  # pragma: no cover — graceful degradation
    _OCR_AVAILABLE = False


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
    mode: str = "text"  # "text" | "ocr"


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def _detect_language(text: str) -> str:
    """Return "marathi" only if Devanagari is a *meaningful* share of the text.

    OCR of English cards sometimes emits stray Devanagari glyphs; requiring at
    least 3 characters AND ≥15% of the alphabetic content avoids misrouting
    English cards to the Marathi regex table.
    """
    if not text:
        return "english"
    dev = _DEVANAGARI_RE.findall(text)
    if len(dev) < 3:
        return "english"
    latin = re.findall(r"[A-Za-z]", text)
    total = len(dev) + len(latin)
    if total and len(dev) / total >= 0.15:
        return "marathi"
    return "english"


# ---------------------------------------------------------------------------
# Shared regex helpers (English + Marathi variants)
# ---------------------------------------------------------------------------
EPIC_RE = re.compile(r"\b([A-Z]{3}[0-9]{7})\b")

SERIAL_RE = re.compile(r"^\s*(\d{1,4})\s+", re.MULTILINE)

# In real ECI Marathi PDFs the serial appears as `| 5 | NIE1234567` — a boxed
# serial+EPIC row.  We capture the serial specifically for this pattern.
_BOXED_SERIAL_EPIC_RE = re.compile(r"\|\s*(\d{1,4})\s*\|\s*([A-Z]{3}[0-9]{7})")

AGE_RE = re.compile(r"(?:Age|वय|उम्र)\s*[:\-]?\s*(\d{1,3})", re.IGNORECASE)

GENDER_MALE = re.compile(r"(?:\bMale\b|पुरुष|पुरूष|\bM\b)", re.IGNORECASE)
GENDER_FEMALE = re.compile(r"(?:\bFemale\b|स्त्री|महिला|\bF\b)", re.IGNORECASE)

HOUSE_RE = re.compile(
    r"(?:House\s*(?:No\.?|Number)|घर\s*(?:क्र\.?|क्रमांक|नं\.?))\s*[:\-]?\s*"
    r"([A-Za-z0-9/\-\u0900-\u097F ]+?)(?=\s{2,}|Photo|छायाचित्र|Age|वय|Gender|लिंग|\n|$)",
    re.IGNORECASE,
)

_ENGLISH_REL = re.compile(
    r"(Father|Husband|Mother|Other|Guardian)['\u2019]?s?\s*Name\s*[:\-]?\s*"
    r"([^\n]+?)(?=\s{2,}|House|Age|Sex|Gender|Photo|\n|$)",
    re.IGNORECASE,
)
_MARATHI_REL = re.compile(
    r"(वडिलांचे|पतीचे|आईचे|इतर|पत्नीचे)\s*(?:नाव|नावः|नावा)\s*[:\-]?\s*"
    r"([^\n]+?)(?=\s{2,}|घर|वय|लिंग|छायाचित्र|\n|$)",
)

_NAME_EN = re.compile(
    r"(?<!'s )(?<!'s\s)\bName\s*[:\-]\s*(.+?)(?=\n|$|\s{2,})",
    re.IGNORECASE,
)
# Marathi name label is "नाव" (or with a colon glyph immediately attached: "नाव:").
# Must NOT be preceded by "चे " (which would be part of "वडिलांचे नाव" etc).
_NAME_MR = re.compile(
    r"(?<!चे )नाव\s*[:\-ः]\s*(.+?)(?=\n|$|\s{2,})",
)

# ---------------------------------------------------------------------------
# Header helpers — accept both terse and verbose ECI variants.
# ---------------------------------------------------------------------------
_HEADER_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("state", re.compile(r"ELECTORAL\s+ROLL\s+[0-9]{4}\s+[A-Z0-9]+\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})", re.IGNORECASE)),
    ("state", re.compile(r"(?:State|राज्य)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("district", re.compile(r"(?:District|जिल्हा)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("taluka", re.compile(r"(?:Taluka|Tehsil|तालुका|तहसील)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("village", re.compile(r"(?:Village|City|गाव|शहर|Village\s*/\s*City)\s*[:\-]\s*([^\n,]+)", re.IGNORECASE)),
    ("assembly_constituency", re.compile(
        r"(?:Assembly\s*Constituency(?:\s*No\.?\s*(?:and|&)\s*Name)?|विधानसभा\s*मतदार\s*संघ|विधान\s*सभा|विधानसभा\s*मतदारसंघ(?:\s*क्रमांक\s*(?:आणि|व)\s*नाव)?)"
        r"[^:\n]*[:\-]\s*([^\n]+)", re.IGNORECASE,
    )),
    ("parliamentary_constituency", re.compile(
        r"(?:Parliamentary\s*Constituency(?:\(ies\))?|संसदीय\s*मतदार\s*संघ|लोकसभा\s*मतदार\s*संघ)"
        r"[^:\n]*[:\-]\s*([^\n]+)", re.IGNORECASE,
    )),
    ("part_number", re.compile(
        r"(?:Part\s*No\.?|Part\s*Number|भाग\s*(?:सं|क्र)\.?|यादी\s*भाग\s*क्रमांक)\s*[:\-]?\s*([0-9]+)",
        re.IGNORECASE,
    )),
    ("booth_number", re.compile(r"(?:Booth\s*No\.?|Booth\s*Number|बूथ\s*(?:सं|क्र)\.?|POLLING\s*STATION\s*No\.?)\s*[:\-]?\s*([A-Za-z0-9\-]+)", re.IGNORECASE)),
    ("polling_station_name", re.compile(r"(?:Polling\s*Station|मतदान\s*केंद्र)\s*(?:Name)?\s*[:\-]\s*([^\n]+)", re.IGNORECASE)),
    ("section_name", re.compile(
        r"(?:Section(?:\s*No\.?\s*(?:and|&)\s*Name)?|विभाग(?:\s*क्रमांक\s*(?:आणि|व)\s*नाव)?)\s*[:\-]\s*([^\n]+)",
        re.IGNORECASE,
    )),
    ("total_male", re.compile(r"(?:Total\s*)?(?:Male|पुरुष)\s*[:\-]?\s*([0-9]{1,7})", re.IGNORECASE)),
    ("total_female", re.compile(r"(?:Total\s*)?(?:Female|स्त्री|महिला)\s*[:\-]?\s*([0-9]{1,7})", re.IGNORECASE)),
    ("total_voters", re.compile(r"(?:Total\s*(?:Voters|Electors|Population)|एकूण\s*मतदार)\s*[:\-]?\s*([0-9]{1,7})", re.IGNORECASE)),
]


def _extract_header(header_text: str, language: str) -> RollHeader:
    h = RollHeader(language=language)
    for field_name, pat in _HEADER_PATTERNS:
        if getattr(h, field_name) is not None:
            continue
        m = pat.search(header_text or "")
        if m:
            val = m.group(1).strip().rstrip(",;")
            # Trim at first newline / obvious label bleed-through.
            val = re.split(r"\n|(?:\s{2,}(?:No|Part|Section|Booth|Male|Female|Total)\.?\s*:)", val)[0].strip()
            # Strip trailing Devanagari OCR noise on English fields.
            if language == "english":
                val = re.sub(r"\s+[\u0900-\u097F].*$", "", val).strip()
            val = val.strip(" -:.,;+|")
            if not val:
                continue
            if field_name in ("total_male", "total_female", "total_voters"):
                try:
                    setattr(h, field_name, int(val))
                except ValueError:
                    pass
            else:
                setattr(h, field_name, val)
    return h


# ---------------------------------------------------------------------------
# Text-layer voter card splitter — kept for born-digital PDFs.
# ---------------------------------------------------------------------------
def _split_cards(page_text: str) -> List[str]:
    if not page_text:
        return []
    matches = list(EPIC_RE.finditer(page_text))
    if not matches:
        return []
    cards: List[str] = []
    prev_end = 0
    for m in matches:
        end = m.end() + 60
        cards.append(page_text[prev_end:end])
        prev_end = m.end()
    return cards


def _parse_card(raw: str, language: str) -> Optional[VoterRecord]:
    """Extract fields from a single card's raw text (text-layer or OCR).

    ECI PDFs are scanned images and OCR often garbles the "Name" / "नाव" label
    into things like "== |=]" or "मोड" (because it's rendered next to a boxed
    serial number). We fall back to: **first non-empty line after the first
    ``:`` or ``>``** as the person's name.
    """
    if not raw or not raw.strip():
        return None
    v = VoterRecord(_language=language)

    epic_m = EPIC_RE.search(raw)
    if epic_m:
        v.epic_number = epic_m.group(1).strip().upper()

    boxed = _BOXED_SERIAL_EPIC_RE.search(raw)
    if boxed:
        v.serial_number = boxed.group(1)
        if not v.epic_number:
            v.epic_number = boxed.group(2)
    if not v.serial_number:
        sn = SERIAL_RE.search(raw)
        if sn:
            v.serial_number = sn.group(1)

    # ---- Full name ----
    # Try both language regex tables and take the first successful match.
    for pat in (_NAME_EN, _NAME_MR):
        m = pat.search(raw)
        if m:
            v.full_name = _clean_name(m.group(1))
            if v.full_name:
                break
    # Fallback for scanned OCR — first non-empty line, take text after first
    # colon / gt-arrow (which is where the "Name" label used to be).
    if not v.full_name:
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            m2 = re.search(r"[:>]\s*(.+)$", line)
            if m2:
                candidate = _clean_name(m2.group(1))
                if candidate and _looks_like_name(candidate):
                    v.full_name = candidate
                    break

    # ---- Relation + relative name ----
    for pat in (_ENGLISH_REL, _MARATHI_REL):
        m = pat.search(raw)
        if m:
            rel_label = m.group(1).strip().lower()
            v.relative_name = _clean_name(m.group(2))
            v.relation_type = _normalize_relation(rel_label)
            if v.relative_name:
                break

    # ---- House number ----
    m = HOUSE_RE.search(raw)
    if m:
        cand = _clean(m.group(1))
        # Reject OCR bleed-through like "Photo H", "छायाचित्र" etc.
        if cand and not re.match(r"^(?:Photo|छायाचित्र|Available|उपलब्ध|H|A)\s*[A-Z]?$", cand, re.IGNORECASE):
            v.house_number = cand

    # ---- Age ----
    m = AGE_RE.search(raw)
    if m:
        try:
            v.age = int(m.group(1))
        except ValueError:
            pass

    # ---- Gender ----
    if GENDER_FEMALE.search(raw):
        v.gender = "Female"
    elif GENDER_MALE.search(raw):
        v.gender = "Male"

    v.photo_available = bool(
        re.search(r"Photo\s*Available|छायाचित्र|Available", raw, re.IGNORECASE),
    )

    if not v.full_name and not v.epic_number:
        return None
    return v


def _clean_name(s: Optional[str]) -> Optional[str]:
    """Normalize a name string extracted via label match OR OCR fallback."""
    if s is None:
        return None
    # OCR often trails 'Photo', 'House Number', 'Age', 'K', 'H', 'A' — strip
    # single-letter and known-label suffixes.
    s = re.sub(r"\s+", " ", s).strip(" -:;,ः|")
    s = re.sub(
        r"\s*(?:Photo|House|Age|Gender|छायाचित्र|घर|वय|लिंग|Available|उपलब्ध)"
        r"(?:\s*[:.\-].*)?$", "", s, flags=re.IGNORECASE).strip()
    # Drop trailing lone punctuation & tiny OCR ghost chars.
    s = re.sub(r"[|]+$", "", s).strip()
    s = re.sub(r"\s+[A-Za-z]$", "", s)  # e.g. "Name X K" → "Name X"
    # Strip leading/trailing parenthesized OCR noise like "(280)".
    s = re.sub(r"^\(.*?\)\s*", "", s).strip()
    s = re.sub(r"\s*\(.*?\)$", "", s).strip()
    # Also strip unclosed OCR noise like "(280" mid-string.
    s = re.sub(r"\s*\(\d+\s*", " ", s).strip()
    # Trim trailing "+", "|", stray single chars.
    s = re.sub(r"[+|]+$", "", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s or None


def _looks_like_name(s: str) -> bool:
    """Cheap heuristic to reject junk lines when matching by fallback."""
    if not s or len(s) < 3:
        return False
    # Must contain letters, not just digits/symbols.
    if not re.search(r"[A-Za-z\u0900-\u097F]", s):
        return False
    # Reject if it's mostly digits.
    letters = len(re.findall(r"[A-Za-z\u0900-\u097F]", s))
    digits = len(re.findall(r"\d", s))
    return letters >= digits


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = re.sub(r"\s+", " ", s).strip(" -:;,ः")
    # OCR trailing-line artifacts.
    s = re.sub(r"\bPhoto$", "", s, flags=re.IGNORECASE).strip()
    s = re.sub(r"छायाचित्र$", "", s).strip()
    return s or None


def _normalize_relation(label: str) -> str:
    label = (label or "").lower()
    if any(k in label for k in ("father", "वडिल", "वडील")):
        return "Father"
    if any(k in label for k in ("husband", "पती", "पति")):
        return "Husband"
    if any(k in label for k in ("mother", "आई", "मा", "पत्नी")):
        # `पत्नीचे` (wife's) is rare but sometimes used in place of husband — bucket as Other.
        if "पत्नी" in label:
            return "Other"
        return "Mother"
    return "Other"


# ---------------------------------------------------------------------------
# OCR grid-crop pipeline (for scanned ECI PDFs)
# ---------------------------------------------------------------------------
def _needs_ocr(pdf_bytes: bytes) -> bool:
    """Peek at the first few pages — if fewer than 200 chars extractable total,
    treat this as a scanned PDF and use OCR."""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            sample = " ".join((p.extract_text() or "") for p in pdf.pages[:3])
            return len(sample.strip()) < 200
    except Exception:
        return True


def _ocr_page_words(img, langs: str) -> Dict[str, list]:
    """Return raw image_to_data dict for a page."""
    return pytesseract.image_to_data(img, lang=langs, output_type=Output.DICT)


def _find_card_grid(data: Dict[str, list], img_size: Tuple[int, int]) -> List[Tuple[int, int, int, int]]:
    """From ``image_to_data`` output, find voter card bounding boxes.

    Strategy: locate "Name"/"नाव" tokens (which anchor each card's top-left),
    then combine them into a 3-column grid. Each card box extends from its
    Name anchor down to the next row's Name (or page bottom).
    """
    anchors = []
    for i in range(len(data["text"])):
        t = data["text"][i].strip()
        if not t:
            continue
        # Latin "Name" or Devanagari "नाव".
        if t == "Name" or t.startswith("नाव"):
            anchors.append((data["left"][i], data["top"][i]))

    if not anchors:
        return []

    # Cluster X-positions into columns (kmeans-lite).
    xs = sorted(a[0] for a in anchors)
    cols: List[int] = []
    for x in xs:
        if not cols or x - cols[-1] > 500:
            cols.append(x)
        else:
            # merge into the current cluster centroid
            cols[-1] = (cols[-1] + x) // 2

    # Keep only reasonable columns (>=2, <=4).
    if len(cols) < 2 or len(cols) > 5:
        return []

    # For every anchor, snap to the nearest column.
    def _col_of(x: int) -> int:
        return min(range(len(cols)), key=lambda i: abs(cols[i] - x))

    grouped: Dict[int, List[int]] = {i: [] for i in range(len(cols))}
    for x, y in anchors:
        grouped[_col_of(x)].append(y)

    W, H = img_size
    col_width = W // len(cols) - 20
    boxes: List[Tuple[int, int, int, int]] = []
    for c_idx, col_x in enumerate(cols):
        ys = sorted(set(grouped[c_idx]))
        for j, y in enumerate(ys):
            y_next = ys[j + 1] if j + 1 < len(ys) else H
            top = max(0, y - 30)
            bottom = min(H, y_next - 20)
            if bottom - top < 100:
                continue
            left = max(0, col_x - 20)
            right = min(W, left + col_width)
            boxes.append((left, top, right, bottom))
    return boxes


def _ocr_extract(pdf_bytes: bytes, result: ParseResult) -> None:
    """Populate result.header and result.voters via OCR crop-per-card.

    **Memory-conscious**: pages are converted one-at-a-time (`first_page` /
    `last_page` slicing) and released immediately after each page's cards are
    extracted. Otherwise a 34-page ECI roll materialises ~500 MB of PIL images
    simultaneously and OOMs the container.
    """
    if not _OCR_AVAILABLE:
        result.errors.append(ParseError(error="OCR mode unavailable (pytesseract/pdf2image missing)"))
        return

    dpi = 200
    tess_cfg = "--psm 6"

    # Discover total pages using pdfplumber (cheap; no rendering).
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            total_pages = len(pdf.pages)
    except Exception as e:
        result.errors.append(ParseError(error=f"page-count failed: {e}"))
        return
    result.pages = total_pages
    result.mode = "ocr"

    # -------- Header: convert & OCR first 2 pages only --------
    try:
        header_pages = convert_from_bytes(pdf_bytes, dpi=dpi, first_page=1, last_page=min(2, total_pages))
        header_text = "\n".join(pytesseract.image_to_string(p, lang="eng+mar", config=tess_cfg) for p in header_pages)
        for p in header_pages:
            p.close()
        del header_pages
    except Exception as e:
        result.errors.append(ParseError(error=f"header OCR failed: {e}"))
        header_text = ""
    result.language = _detect_language(header_text)
    result.header = _extract_header(header_text, result.language)

    # -------- Voter cards: page-by-page --------
    for pn in range(1, total_pages + 1):
        try:
            page_imgs = convert_from_bytes(pdf_bytes, dpi=dpi, first_page=pn, last_page=pn)
        except Exception as e:
            result.errors.append(ParseError(page=pn, error=f"page render failed: {e}"))
            continue
        if not page_imgs:
            continue
        img = page_imgs[0]
        try:
            data = _ocr_page_words(img, "eng+mar")
            boxes = _find_card_grid(data, img.size)
            for (left, top, right, bottom) in boxes:
                try:
                    sub = img.crop((left, top, right, bottom))
                    raw = pytesseract.image_to_string(sub, lang="eng+mar", config=tess_cfg)
                    sub.close()
                    lang = _detect_language(raw)
                    v = _parse_card(raw, lang)
                    if not v:
                        continue
                    v._page = pn
                    v._language = lang
                    for f_ in ("state", "district", "taluka", "village",
                               "assembly_constituency", "parliamentary_constituency",
                               "booth_number", "part_number", "section_name"):
                        if getattr(v, f_) is None and getattr(result.header, f_) is not None:
                            setattr(v, f_, getattr(result.header, f_))
                    result.voters.append(v)
                except Exception as e:
                    result.errors.append(ParseError(page=pn, error=f"card OCR failed: {e}"))
        except Exception as e:
            result.errors.append(ParseError(page=pn, error=f"page OCR failed: {e}"))
        finally:
            img.close()
            del page_imgs, img


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def parse_pdf(pdf_bytes: bytes) -> ParseResult:
    """Parse an electoral-roll PDF and return a ParseResult.

    * Auto-detects language.
    * Auto-selects text vs OCR mode based on whether the PDF has extractable text.
    """
    result = ParseResult()
    if _needs_ocr(pdf_bytes):
        _ocr_extract(pdf_bytes, result)
        return result

    # ---- text-layer path ----
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
            result.language = _detect_language(full_text)

            header_text = "\n".join(all_text_parts[:2])
            result.header = _extract_header(header_text, result.language)

            for idx, page_text in enumerate(all_text_parts, start=1):
                for raw in _split_cards(page_text):
                    try:
                        v = _parse_card(raw, result.language)
                        if v is None:
                            continue
                        v._page = idx
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
        "mode": result.mode,
        "header": asdict(result.header),
        "voters": [asdict(v) for v in result.voters],
        "errors": [asdict(e) for e in result.errors],
    }
