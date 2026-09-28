#!/usr/bin/env python3
"""
Parse Leads Tracker_2026.xlsx into a clean register.

Writes:
  backend/data/leads-tracker-2026.json
  backend/data/leads-tracker-2026.xlsx   (fixed summary + clean register)

Usage:
  python3 scripts/parse-leads-tracker.py
  python3 scripts/parse-leads-tracker.py /path/to/Leads\\ Tracker_2026.xlsx
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.utils.datetime import from_excel

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path.home() / "Downloads" / "Leads Tracker_2026.xlsx"
OUT_JSON = ROOT / "data" / "leads-tracker-2026.json"
OUT_XLSX = ROOT / "data" / "leads-tracker-2026.xlsx"

CAMPUS_MAP = {
    "acc": "ACC", "arusha modern": "ACC", "arusha city": "ACC",
    "arusha town": "ACC", "upcoming arusha": "ACC", "town": "ACC",
    "usr": "USR", "usa": "USR", "usariver": "USR", "usa river": "USR",
    "bom": "BOM", "boma": "BOM",
    "kjg": "KJG", "kijenge": "KJG",
    "ilb": "ILB", "ilboru": "ILB",
}

STAGE_MAP = {
    "interested": "interested_lead",
    "interested lead": "interested_lead",
    "interested (leads)": "interested_lead",
    "dead": "dead_lead",
    "dead lead": "dead_lead",
    "tour": "tour_booked",
    "tour booked": "tour_booked",
    "visited": "tour_booked",
    "interview": "interview_booked",
    "passed interview": "interview_booked",
    "failed interview": "interview_booked",
    "not passed": "interview_booked",
    "registered": "form_filled",
    "registered (form filled)": "form_filled",
    "registered form filled": "form_filled",
    "form filled": "form_filled",
    "enrolled": "enrolled",
    "enrolled (admission paid)": "admission_paid",
    "admission paid": "admission_paid",
    "declined": "declined",
    "lapsed": "lapsed",
}

SOURCE_MAP = {
    "social media": "social_media",
    "instagram": "social_media",
    "facebook": "social_media",
    "referral": "referral",
    "refferal": "referral",
    "friends": "referral",
    "sla staff": "referral",
    "staff": "referral",
    "marketing": "walk_in",
    "bango": "billboard",
    "billboard": "billboard",
    "radio": "radio_campaign",
    "interest call": "phone_call",
    "call": "phone_call",
    "interest visit": "walk_in",
    "visit": "walk_in",
    "walk": "walk_in",
    "online": "online_form",
    "whatsapp": "whatsapp",
    "event": "open_day",
    "open day": "open_day",
    "partner": "partner_school",
}

CLASS_MAP = {
    "daycare": "Daycare", "day care": "Daycare", "dc": "Daycare",
    "kg1": "KG1", "kg 1": "KG1", "kindergarten 1": "KG1",
    "kg2": "KG2", "kg 2": "KG2", "kindergarten 2": "KG2",
    "g1": "G1", "grade 1": "G1", "std 1": "G1",
    "g2": "G2", "grade 2": "G2", "std 2": "G2",
    "g3": "G3", "grade 3": "G3", "std 3": "G3",
    "g4": "G4", "grade 4": "G4", "std 4": "G4",
    "g5": "G5", "grade 5": "G5", "std 5": "G5",
    "g6": "G6", "grade 6": "G6", "std 6": "G6",
    "g7": "G7", "grade 7": "G7", "std 7": "G7",
}


def clean_str(v):
    if v is None:
        return ""
    if isinstance(v, float) and v == int(v):
        v = int(v)
    s = str(v).replace("\xa0", " ").strip()
    if s.lower() in {"none", "nan", "-", "n/a", "na", "#n/a", "#value!", "#div/0!", "#ref!"}:
        return ""
    return re.sub(r"\s+", " ", s)


def title_name(s):
    s = clean_str(s)
    if not s:
        return ""
    s = s.replace("`", "").strip(" .")
    if not s or s in {"0", "1"}:
        return ""
    return s.title() if s.isupper() or s.islower() else s


def normalize_phone(v):
    raw = clean_str(v)
    if not raw:
        return "", ""
    # split dual numbers
    parts = re.split(r"\s*(?:or|/|,|;|&)\s*", raw, maxsplit=1)
    def one(p):
        digits = re.sub(r"\D", "", p)
        if digits.startswith("255") and len(digits) >= 12:
            digits = "0" + digits[3:]
        if len(digits) == 9 and digits[0] in "678":
            digits = "0" + digits
        if len(digits) == 12 and digits.startswith("255"):
            digits = "0" + digits[3:]
        if len(digits) == 10 and digits.startswith("0"):
            return digits
        return ""
    a = one(parts[0])
    b = one(parts[1]) if len(parts) > 1 else ""
    if b and b == a:
        b = ""
    return a, b


def map_campus(v, fallback="USR"):
    s = clean_str(v).lower()
    if not s:
        return fallback
    for key, code in CAMPUS_MAP.items():
        if key in s:
            return code
    return fallback


def map_stage(v):
    s = clean_str(v).lower()
    if not s:
        return "interested_lead"
    if s in STAGE_MAP:
        return STAGE_MAP[s]
    for key, stage in STAGE_MAP.items():
        if key in s:
            return stage
    return "interested_lead"


def interview_outcome(v):
    s = clean_str(v).lower()
    if "fail" in s or "not passed" in s:
        return "failed"
    if "pass" in s:
        return "passed"
    return None


def map_source(heard, channel):
    blob = f"{clean_str(heard)} {clean_str(channel)}".lower()
    for key, src in SOURCE_MAP.items():
        if key in blob:
            return src
    return "other"


def map_class(v):
    s = clean_str(v).lower()
    if not s:
        return ""
    if s in CLASS_MAP:
        return CLASS_MAP[s]
    for key, cls in CLASS_MAP.items():
        if key in s:
            return cls
    return clean_str(v)[:30]


def map_gender(v):
    s = clean_str(v).lower()
    if s in {"m", "male", "boy"}:
        return "M"
    if s in {"f", "female", "girl"}:
        return "F"
    return ""


def parse_date(v):
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)):
        try:
            return from_excel(v).date().isoformat()
        except Exception:
            return None
    s = clean_str(v)
    if not s:
        return None
    s = re.sub(r"Aprill", "April", s, flags=re.I)
    s = re.sub(r"\s+", " ", s)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%B %d, %Y", "%B%d,%Y", "%B %d , %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def header_index(row):
    idx = {}
    for i, cell in enumerate(row):
        key = re.sub(r"[^a-z0-9]+", " ", clean_str(cell).lower()).strip()
        if key:
            idx[key] = i
    return idx


def pick(row, idx, *names):
    for name in names:
        if name in idx and idx[name] < len(row):
            return row[idx[name]]
    # fuzzy: header contains all tokens
    for name in names:
        tokens = name.split()
        for key, i in idx.items():
            if all(t in key for t in tokens) and i < len(row):
                return row[i]
    return None


def row_vals(ws, r, max_col):
    return [ws.cell(r, c).value for c in range(1, max_col + 1)]


def find_header_row(ws, max_scan=8):
    best = None
    for r in range(1, max_scan + 1):
        vals = [clean_str(ws.cell(r, c).value) for c in range(1, min(ws.max_column, 32) + 1)]
        joined = " ".join(vals).lower()
        score = sum(k in joined for k in [
            "first name", "parent", "phone", "lead status", "surname",
            "class", "parents full name", "childs name", "preferred silverleaf",
        ])
        if score >= 3:
            best = (r, header_index(vals))
            if "lead status" in joined or "status" in joined:
                return best
    return best


def lead_from_row(row, idx, campus_default, sheet):
    first = title_name(pick(row, idx, "first name", "parents full name", "parent name", "paret name"))
    surname = title_name(pick(row, idx, "surname"))
    # student first-name columns collide with parent first name — take last matching student block
    parent_name = " ".join(p for p in [first, surname] if p).strip()
    if not parent_name or parent_name.isdigit() or parent_name in {"_", "-", ".", "/"}:
        return None
    if len(parent_name) < 2 and parent_name.lower() not in {"b"}:
        return None

    phone_a, extra_a = normalize_phone(pick(row, idx, "parent phone", "parent phone 1", "father s phone", "phone number", "phone"))
    phone_b, extra_b = normalize_phone(pick(row, idx, "parent phone 2", "mother s phone"))
    phones = [p for p in [phone_a, extra_a, phone_b, extra_b] if p]
    parent_phone = phones[0] if phones else ""
    parent_phone2 = next((p for p in phones[1:] if p != parent_phone), "")

    # child: prefer columns after parent block
    child_first = title_name(pick(row, idx, "student name", "childs name the one to be enrolled", "childs name"))
    child_mid = title_name(pick(row, idx, "middle name"))
    child_last = ""
    # When both parent and student use First Name / Surname, student is the later pair
    first_idxs = [i for k, i in idx.items() if k == "first name"]
    surname_idxs = [i for k, i in idx.items() if k in {"surname", "student surname"}]
    if not child_first and len(first_idxs) >= 2:
        child_first = title_name(row[first_idxs[-1]] if first_idxs[-1] < len(row) else "")
    if len(surname_idxs) >= 2:
        child_last = title_name(row[surname_idxs[-1]] if surname_idxs[-1] < len(row) else "")
    elif not child_last:
        child_last = title_name(pick(row, idx, "surname")) if child_first else ""
        if child_last and child_last.lower() == surname.lower():
            child_last = ""
    child_name = " ".join(p for p in [child_first, child_mid, child_last] if p).strip()
    if child_name.lower() == parent_name.lower():
        child_name = child_first or ""

    status_raw = clean_str(pick(row, idx, "lead status", "status"))
    campus = map_campus(pick(row, idx, "campus to be enrolled", "preferred silverleaf campus", "interested in what campus"), campus_default)
    heard = pick(row, idx, "how did you hear about sla")
    channel = pick(row, idx, "call visit online form")
    notes = clean_str(pick(row, idx, "comments", "comment", "any extra comments"))
    capture = parse_date(pick(row, idx, "lead capture date", "lead recorded", "date"))

    kids = pick(row, idx, "of kids tobe enrolled", "of kids to be enrolled", "number expected students to be enrolled")
    try:
        num_children = int(float(kids)) if kids not in (None, "") else 1
    except (TypeError, ValueError):
        num_children = 1
    num_children = max(1, min(num_children, 9))

    stage = map_stage(status_raw)
    outcome = interview_outcome(status_raw)

    return {
        "parent_name": parent_name[:100],
        "parent_phone": parent_phone[:30],
        "parent_phone2": parent_phone2[:30],
        "occupation": clean_str(pick(row, idx, "occupation", "parents occupation"))[:80],
        "residence": clean_str(pick(row, idx, "residence", "residence in arusha", "residence in boma", "city location"))[:100],
        "region": clean_str(pick(row, idx, "region"))[:80] or "Arusha",
        "child_name": child_name[:100],
        "child_gender": map_gender(pick(row, idx, "gender")),
        "interested_class": map_class(pick(row, idx, "class to be enrolled", "child ren s age group", "grade")),
        "boarding_day": "boarding" if "board" in clean_str(pick(row, idx, "boarding day")).lower() else "day",
        "num_children": num_children,
        "source": map_source(heard, channel),
        "how_heard": clean_str(heard)[:150],
        "source_detail": f"{sheet}"[:200],
        "notes": notes[:500],
        "campus_code": campus,
        "stage": stage,
        "interview_outcome": outcome,
        "visited": clean_str(pick(row, idx, "parent visited school")).lower() in {"yes", "y", "true"},
        "captured_at": capture,
        "status_raw": status_raw,
        "intended_term": clean_str(pick(row, idx, "intended enrollment period", "expected enrollment year", "academic year"))[:40],
    }


def extract_sheet(ws, campus_default, sheet_name):
    found = find_header_row(ws)
    if not found:
        return []
    header_row, idx = found
    max_col = min(ws.max_column, 32)
    leads = []
    for r in range(header_row + 1, ws.max_row + 1):
        row = row_vals(ws, r, max_col)
        if not any(clean_str(c) for c in row):
            continue
        lead = lead_from_row(row, idx, campus_default, sheet_name)
        if lead:
            leads.append(lead)
    return leads


def dedupe(leads):
    seen = {}
    out = []
    for lead in leads:
        key = (
            lead["campus_code"],
            lead["parent_phone"] or lead["parent_name"].lower(),
            (lead["child_name"] or "").lower(),
        )
        if key in seen:
            prev = seen[key]
            # keep the richer / later-stage record
            rank = ["interested_lead", "dead_lead", "tour_booked", "interview_booked", "form_filled", "enrolled", "admission_paid"]
            new_r = rank.index(lead["stage"]) if lead["stage"] in rank else 0
            old_r = rank.index(prev["stage"]) if prev["stage"] in rank else 0
            if new_r > old_r:
                out[out.index(prev)] = lead
                seen[key] = lead
            continue
        seen[key] = lead
        out.append(lead)
    return out


def summary_from_leads(leads):
    codes = ["ACC", "USR", "BOM", "KJG", "ILB"]
    by = {c: Counter() for c in codes}
    cluster = Counter()
    for lead in leads:
        code = lead["campus_code"] if lead["campus_code"] in by else "USR"
        by[code][lead["stage"]] += 1
        cluster[lead["stage"]] += 1
        cluster["total"] += 1
        if lead["interview_outcome"] == "passed":
            by[code]["passed_interview"] += 1
            cluster["passed_interview"] += 1
        if lead["interview_outcome"] == "failed":
            by[code]["failed_interview"] += 1
            cluster["failed_interview"] += 1
    return cluster, by


def write_clean_xlsx(leads, cluster, by_campus, issues, dest):
    wb = Workbook()

    # Summary — repaired operational targets from the source 2026 Summary sheet
    targets = {"ACC": 370, "USR": 900, "BOM": 100, "ILB": 55, "KJG": 85}
    retained = {"ACC": 136, "USR": 606, "BOM": 25, "ILB": 24, "KJG": 29}
    names = {
        "ACC": "Arusha City / Modern",
        "USR": "Usa River",
        "BOM": "Boma",
        "ILB": "Ilboru",
        "KJG": "Kijenge",
    }

    ws = wb.active
    ws.title = "2026 Summary (fixed)"
    ws["A1"] = "Silverleaf Academy — 2026 Leads Summary (cleaned)"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = "Ilboru target was the text MAY (broke Available seats). Restored to 55 from Board Version. Garbage row zxcvbnm removed. Conversion = admission paid / total leads."
    ws.merge_cells("A2:F2")

    headers = ["Campus", "Target enrollment", "Retained (2025)", "Available seats", "Leads in register", "Admission paid", "Dead leads", "Passed interview", "Failed interview", "Conversion"]
    ws.append([])
    ws.append(headers)
    for cell in ws[4]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1B3A6B")

    cluster_paid = cluster.get("admission_paid", 0)
    cluster_total = cluster.get("total", 0)
    for code in ["ACC", "USR", "BOM", "ILB", "KJG"]:
        avail = targets[code] - retained[code]
        total = sum(by_campus[code].values()) - by_campus[code].get("passed_interview", 0) - by_campus[code].get("failed_interview", 0)
        # Counter includes extra keys; recount stages only
        total = sum(by_campus[code][s] for s in [
            "interested_lead", "dead_lead", "tour_booked", "interview_booked",
            "form_filled", "enrolled", "admission_paid", "declined", "lapsed",
        ])
        paid = by_campus[code].get("admission_paid", 0)
        conv = round(paid / total, 3) if total else 0
        ws.append([
            names[code], targets[code], retained[code], avail, total,
            paid, by_campus[code].get("dead_lead", 0),
            by_campus[code].get("passed_interview", 0),
            by_campus[code].get("failed_interview", 0), conv,
        ])

    cluster_avail = sum(targets[c] - retained[c] for c in targets)
    ws.append([
        "CLUSTER", 1455, 814, cluster_avail, cluster_total, cluster_paid,
        cluster.get("dead_lead", 0), cluster.get("passed_interview", 0),
        cluster.get("failed_interview", 0),
        round(cluster_paid / cluster_total, 3) if cluster_total else 0,
    ])
    for cell in ws[ws.max_row]:
        cell.font = Font(bold=True)

    # Clean register
    reg = wb.create_sheet("Clean Leads")
    cols = [
        "campus_code", "parent_name", "parent_phone", "parent_phone2", "child_name",
        "child_gender", "interested_class", "boarding_day", "num_children",
        "occupation", "residence", "region", "source", "how_heard",
        "stage", "interview_outcome", "visited", "captured_at", "intended_term",
        "notes", "source_detail",
    ]
    reg.append(cols)
    for cell in reg[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1B3A6B")
    for lead in leads:
        reg.append([lead.get(c, "") for c in cols])
    for i, _ in enumerate(cols, 1):
        reg.column_dimensions[get_column_letter(i)].width = 18

    issues_ws = wb.create_sheet("Data issues fixed")
    issues_ws.append(["Issue", "Count / note"])
    for k, v in issues:
        issues_ws.append([k, v])

    dest.parent.mkdir(parents=True, exist_ok=True)
    wb.save(dest)


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        print(f"Missing workbook: {src}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {src} …")
    wb = load_workbook(src, data_only=True)

    sheets = [
        ("Consolidated 2026 ", "USR"),
        ("2026 Arusha Modern", "ACC"),
        ("2026 Usariver", "USR"),
        ("2026 Boma", "BOM"),
        ("2026 Kijenge", "KJG"),
        ("2026 Ilboru", "ILB"),
        ("Sales Reps Leads", "ACC"),
    ]

    raw = []
    per_sheet = {}
    for name, campus in sheets:
        if name not in wb.sheetnames:
            print(f"  skip missing {name!r}")
            continue
        rows = extract_sheet(wb[name], campus, name.strip())
        per_sheet[name.strip()] = len(rows)
        print(f"  {name.strip()}: {len(rows)} rows")
        raw.extend(rows)
    wb.close()

    before = len(raw)
    leads = dedupe(raw)
    no_phone = sum(1 for l in leads if not l["parent_phone"])
    no_child = sum(1 for l in leads if not l["child_name"])
    cluster, by_campus = summary_from_leads(leads)

    issues = [
        ("Source file", src.name),
        ("Rows parsed before dedupe", before),
        ("Rows after phone+parent+child+campus dedupe", len(leads)),
        ("Duplicates removed", before - len(leads)),
        ("Missing phone (kept, phone blank)", no_phone),
        ("Missing child name (kept)", no_child),
        ("Broken Ilboru target in 2026 Summary", "Was text MAY → set to 55 (Board Version)"),
        ("Broken Available seats (#VALUE!)", "Now target − retained"),
        ("Garbage cell on 2026 Summary row 2", "Removed zxcvbnm,."),
        ("Kijenge conversion > 100% in source", "Source listed 15 leads and 25 paid; live register uses parsed rows only"),
        ("Date serial 6692957 on a campus sheet", "Ignored invalid Excel date"),
    ]

    payload = {
        "source_file": src.name,
        "parsed_at": datetime.now().isoformat(timespec="seconds"),
        "counts": {
            "parsed": before,
            "deduped": len(leads),
            "by_sheet": per_sheet,
            "by_campus": {k: dict(v) for k, v in by_campus.items()},
            "cluster": dict(cluster),
        },
        "issues_fixed": [{"issue": k, "note": str(v)} for k, v in issues],
        "leads": leads,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2))
    write_clean_xlsx(leads, cluster, by_campus, issues, OUT_XLSX)

    print(f"\nClean register: {len(leads)} leads")
    print("Cluster stages:", dict(cluster))
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_XLSX}")


if __name__ == "__main__":
    main()
