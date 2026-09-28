#!/usr/bin/env python3
"""Import Silverleaf transport data from scraped Google Sheet CSVs."""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

csv.field_size_limit(min(sys.maxsize, 10_000_000))

ROOT = Path(__file__).resolve().parents[1]
SHEET_DIR = ROOT / "data" / "sheet_import"
OUT_DIR = ROOT / "data" / "import"
SEED_PATH = ROOT / "supabase" / "seed_silverleaf.sql"

SCHOOLS = [
    {
        "name": "Usariver Campus",
        "slug": "usariver",
        "students_transport": 419,
        "bus_capacity": 480,
    },
    {
        "name": "Arusha Modern Campus",
        "slug": "arusha-modern",
        "students_transport": 119,
        "bus_capacity": 130,
    },
    {
        "name": "Kijenge Campus",
        "slug": "kijenge",
        "students_transport": 37,
        "bus_capacity": 36,
    },
    {
        "name": "Ilboru Campus",
        "slug": "ilboru",
        "students_transport": 23,
        "bus_capacity": 20,
    },
    {
        "name": "Boma Campus",
        "slug": "boma",
        "students_transport": 23,
        "bus_capacity": 30,
    },
]

CAMPUS_SLUG = {
    "Usariver": "usariver",
    "Arusha Modern": "arusha-modern",
    "Kijenge": "kijenge",
    "Ilboru": "ilboru",
    "Boma": "boma",
}

CAMPUS_PREFIX = {
    "Usariver": "USR",
    "Arusha Modern": "AM",
    "Kijenge": "KIJ",
    "Ilboru": "ILB",
    "Boma": "BOM",
}

SKIP_NAMES = {
    "NAME OF STUDENT",
    "USARIVER SCHOOL",
    "ARUSHA MODERN",
    "KIJENGE - CAMPUS",
    "ILBORU - CAMPUS",
    "BOMA CAMPUS",
}


def read_csv(name: str) -> list[list[str]]:
    path = SHEET_DIR / name
    with path.open(encoding="utf-8") as handle:
        return list(csv.reader(handle))


def campus_from_route(route: str, default: str = "Usariver") -> str:
    upper = (route or "").upper()
    if "ILBORU" in upper:
        return "Ilboru"
    if "BOMA" in upper:
        return "Boma"
    if "KIJENGE" in upper or "MBEGU" in upper:
        return "Kijenge"
    if any(
        token in upper
        for token in (
            "ARUSHA MODERN",
            "AM SAKINA",
            "AM NGARAMTONI",
            "AM MOSHONO",
            "MOROMBO",
            "EBM",
            "CHE",
            "BMC",
            "DKS",
        )
    ):
        return "Arusha Modern"
    if "USARIVER" in upper:
        return "Usariver"
    return default


def campus_from_header(route_row: list[str], index: int, route: str) -> str:
    route_campus = campus_from_route(route)
    if route_campus != "Usariver" or "USARIVER" in (route or "").upper():
        return route_campus

    for j in range(index, -1, -1):
        val = route_row[j].strip().upper() if j < len(route_row) else ""
        if val in ("USARIVER", "ARUSHA MODERN", "KIJENGE", "ILBORU", "BOMA", "MBEGU"):
            return {
                "USARIVER": "Usariver",
                "ARUSHA MODERN": "Arusha Modern",
                "KIJENGE": "Kijenge",
                "ILBORU": "Ilboru",
                "BOMA": "Boma",
                "MBEGU": "Kijenge",
            }[val]
    return route_campus


def norm_bus_campus(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw.lower() == "total":
        return None
    return {
        "Usariver": "Usariver",
        "Arusha Modern": "Arusha Modern",
        "Kijenge": "Kijenge",
        "Kijenge ": "Kijenge",
        "Ilboru": "Ilboru",
        "Boma": "Boma",
    }.get(raw, raw)


def parse_fee(cells: list[str], start_idx: int) -> int:
    for j in range(start_idx, min(start_idx + 15, len(cells))):
        val = cells[j].strip().replace(",", "")
        if re.match(r"^\d{3,7}$", val):
            return int(val)
    return 0


def esc(value: str | None) -> str:
    return (value or "").replace("'", "''")


def sql_text(value: str | None) -> str:
    """SQL text literal or NULL for empty strings."""
    if not value or not str(value).strip():
        return "null"
    return f"'{esc(value.strip())}'"


# Tanzania-style plate in BUS NO (e.g. "T 910 APW -"); sheet has no dedicated plate column.
PLATE_FROM_LABEL = re.compile(r"^T\s*\d+", re.IGNORECASE)


def plate_for_bus(label: str) -> str:
    """Use BUS NO as plate only when it looks like a vehicle plate; else TBA.

    Real plates are not in the sheet as a separate column — only BUS NO exists.
    Duplicating label into plate_number made UI show the same string twice.
    """
    cleaned = label.strip().rstrip("-").strip()
    if PLATE_FROM_LABEL.match(cleaned):
        return cleaned[:32]
    return "TBA"


def resolve_bus_capacity(
    label: str, bus_type: str, sheet_max: int | None, sheet_alt: int | None
) -> int:
    """Sheet col F/G: max capacity. Backup rows incorrectly used student counts (6, 4).

    Correct those to type-typical seats (Hiace 30 / Coaster 40) or the alternate
    column when it looks like a real capacity (>= 10).
    """
    cap = sheet_max if sheet_max and sheet_max > 0 else None
    label_l = label.lower()
    type_l = (bus_type or "").lower()
    is_backup = "back" in label_l  # "Back up" / "backup"

    if cap is not None and cap < 10 and is_backup:
        # Prefer vehicle-type defaults over sheet col E (often a stub "30")
        if "hiace" in type_l or "hiaace" in label_l:
            return 30
        if "coaster" in type_l or "coasster" in label_l:
            return 40  # match AM Coaster CHE (same backup vehicle)
        if sheet_alt is not None and sheet_alt >= 10:
            return sheet_alt
        return 30

    return cap if cap is not None else 45


def parse_int_cell(raw: str | None) -> int | None:
    digits = re.sub(r"\D", "", raw or "")
    return int(digits) if digits else None


def parse_transport_users() -> tuple[list[dict], list[dict]]:
    rows = read_csv("gid_2024890881.csv")
    route_row, header_row = rows[0], rows[1]

    blocks: list[dict] = []
    for i, cell in enumerate(header_row):
        if not cell.strip().upper().startswith("NAME OF STUDENT"):
            continue

        route = route_row[i].strip() if i < len(route_row) else ""
        campus = campus_from_header(route_row, i, route)
        fields: dict[str, int] = {}

        for k in range(i, min(i + 14, len(header_row))):
            label = header_row[k].strip().upper()
            if label.startswith("NAME OF STUDENT"):
                fields["name"] = k
            elif label.startswith("STATUS"):
                fields["status"] = k
            elif label.startswith("PLATE NO"):
                fields["plate"] = k
            elif label.startswith("PHONE"):
                fields["phone"] = k
            elif label.startswith("GRADE"):
                fields["grade"] = k
            elif label.startswith("DESTINATION"):
                fields["destination"] = k
            elif "LAT/LONG" in label:
                fields["gps"] = k

        blocks.append({"route": route, "campus": campus, "fields": fields})

    buses: list[dict] = []
    seen_buses: set[tuple[str, str]] = set()
    for row in rows[2:]:
        if len(row) < 10:
            continue
        campus = norm_bus_campus(row[2])
        bus_no = row[3].strip()
        route = row[9].strip()
        if not campus or not bus_no or bus_no.upper() == "BUS NO":
            continue

        key = (campus, bus_no)
        if key in seen_buses:
            continue
        seen_buses.add(key)

        bus_type = row[4].strip() if len(row) > 4 else ""
        sheet_alt = parse_int_cell(row[5] if len(row) > 5 else "")
        sheet_max = parse_int_cell(row[6] if len(row) > 6 else "")
        buses.append(
            {
                "campus": campus,
                "label": bus_no,
                "bus_type": bus_type,
                "route": route,
                "max_capacity": resolve_bus_capacity(
                    bus_no, bus_type, sheet_max, sheet_alt
                ),
                "students_on_bus": row[7].strip() if len(row) > 7 else "",
                "driver": row[10].strip() if len(row) > 10 else "",
                "attendant": row[11].strip() if len(row) > 11 else "",
                "owner": row[13].strip() if len(row) > 13 else "",
                "plate_number": plate_for_bus(bus_no),
            }
        )

    students: list[dict] = []
    seen_students: set[tuple[str, str]] = set()
    for row in rows[2:]:
        row_bus = row[3].strip() if len(row) > 3 else ""
        for block in blocks:
            fields = block["fields"]
            name_idx = fields.get("name")
            if name_idx is None or name_idx >= len(row):
                continue

            full_name = row[name_idx].strip()
            if (
                not full_name
                or len(full_name.split()) < 2
                or full_name.upper() in SKIP_NAMES
            ):
                continue

            dedupe_key = (full_name.upper(), block["campus"])
            if dedupe_key in seen_students:
                continue
            seen_students.add(dedupe_key)

            parts = full_name.split()
            plate_idx = fields.get("plate")
            plate = (
                row[plate_idx].strip()
                if plate_idx is not None and plate_idx < len(row)
                else row_bus
            )

            students.append(
                {
                    "first_name": parts[0].title(),
                    "last_name": " ".join(parts[1:]).title(),
                    "campus": block["campus"],
                    "route": block["route"],
                    "bus_plate": plate or row_bus,
                    "grade": row[fields["grade"]].strip()
                    if "grade" in fields and fields["grade"] < len(row)
                    else "",
                    "destination": row[fields["destination"]].strip()
                    if "destination" in fields and fields["destination"] < len(row)
                    else "",
                    "parent_phone": row[fields["phone"]].strip()
                    if "phone" in fields and fields["phone"] < len(row)
                    else "",
                    "fee_balance_tzs": parse_fee(row, fields.get("destination", name_idx) + 1),
                }
            )

    return buses, students


def assign_qr_codes(students: list[dict]) -> None:
    students.sort(key=lambda item: (item["campus"], item["last_name"], item["first_name"]))
    seq = defaultdict(int)
    for student in students:
        seq[student["campus"]] += 1
        prefix = CAMPUS_PREFIX.get(student["campus"], "SLV")
        student["qr_code"] = f"SLV-{prefix}-{seq[student['campus']]:04d}"


def write_seed_sql(students: list[dict], buses: list[dict]) -> None:
    school_ids = {
        school["slug"]: f"a1000000-0000-4000-8000-{index:012d}"
        for index, school in enumerate(SCHOOLS, start=1)
    }

    lines = [
        "-- Silverleaf Transport — real data from 2026 Transport Master Google Sheet",
        "-- Sheet: https://docs.google.com/spreadsheets/d/1BDkvHWhJnJXS9vx1c2reyXkab494ZF7bji8z76Ck-mw",
        "-- Regenerate: python3 scripts/fetch-sheet-tabs.py && python3 scripts/import-from-sheet.py",
        "-- Run AFTER schema_auth.sql + schema_v1.sql in Supabase SQL Editor.",
        "--",
        "-- Bus notes:",
        "--   * plate_number: sheet has BUS NO only (no real plates). TBA unless BUS NO looks like T ### XXX.",
        "--   * Re-seed plates when real registration numbers are sourced.",
        "--   * Backup capacities 6 (Kijenge) / 4 (Ilboru) in the sheet were student counts — corrected to 30/40.",
        "--   * driver_name / attendant_name / owner_name from sheet DRIVER, BUS ATTENDANT, OWNER columns.",
        "",
        "-- ── Clear old demo + prior seed (safe re-run) ───────────────────────────────",
        "delete from public.boarding_events;",
        "delete from public.trips;",
        "delete from public.fee_balances;",
        "delete from public.qr_codes;",
        "delete from public.student_parents;",
        "delete from public.students;",
        "delete from public.parents;",
        "delete from public.buses;",
        "delete from public.schools;",
        "",
        f"-- Expected after load: {len(SCHOOLS)} schools, {len(buses)} buses, {len(students)} students",
        "",
    ]

    for school in SCHOOLS:
        lines.append(
            "insert into public.schools (id, name, slug) values "
            f"('{school_ids[school['slug']]}', '{esc(school['name'])}', '{esc(school['slug'])}') "
            "on conflict (slug) do update set name = excluded.name;"
        )

    for index, bus in enumerate(buses, start=1):
        school_id = school_ids[CAMPUS_SLUG[bus["campus"]]]
        bus_id = f"c1000000-0000-4000-8000-{index:012d}"
        lines.append(
            "insert into public.buses ("
            "id, school_id, label, plate_number, capacity, "
            "driver_name, attendant_name, owner_name"
            ") values "
            f"('{bus_id}', '{school_id}', '{esc(bus['label'])}', "
            f"'{esc(bus['plate_number'])}', {bus['max_capacity']}, "
            f"{sql_text(bus.get('driver'))}, {sql_text(bus.get('attendant'))}, "
            f"{sql_text(bus.get('owner'))}) "
            "on conflict (id) do nothing;"
        )

    for index, student in enumerate(students, start=1):
        school_id = school_ids[CAMPUS_SLUG[student["campus"]]]
        student_id = f"d1000000-0000-4000-8000-{index:012d}"
        class_name = student["grade"] or None
        class_sql = "null" if not class_name else f"'{esc(class_name)}'"

        lines.append(
            "insert into public.students (id, school_id, first_name, last_name, class_name) values "
            f"('{student_id}', '{school_id}', '{esc(student['first_name'])}', "
            f"'{esc(student['last_name'])}', {class_sql}) on conflict (id) do nothing;"
        )
        lines.append(
            "insert into public.qr_codes (student_id, code) values "
            f"('{student_id}', '{esc(student['qr_code'])}') on conflict (code) do nothing;"
        )
        lines.append(
            "insert into public.fee_balances (student_id, balance, currency) values "
            f"('{student_id}', {student['fee_balance_tzs']}, 'TZS') "
            "on conflict (student_id) do update set balance = excluded.balance, synced_at = now();"
        )

        if student["parent_phone"]:
            phone = re.sub(r"\s.*", "", student["parent_phone"].split("/")[0].strip())
            parent_id = f"b1000000-0000-4000-8000-{index:012d}"
            parent_name = f"Parent of {student['first_name']} {student['last_name']}"
            lines.append(
                "insert into public.parents (id, full_name, phone) values "
                f"('{parent_id}', '{esc(parent_name)}', '{esc(phone)}') on conflict (id) do nothing;"
            )
            lines.append(
                "insert into public.student_parents (student_id, parent_id, is_primary) values "
                f"('{student_id}', '{parent_id}', true) on conflict do nothing;"
            )

    lines.extend(
        [
            "",
            "-- ── Verify (optional — run separately after seed) ─────────────────────────",
            "-- select count(*) as schools from public.schools;",
            "-- select count(*) as students from public.students;",
            "-- select count(*) as buses from public.buses;",
            "-- select count(*) as qr_codes from public.qr_codes;",
            "-- select slug, name from public.schools order by slug;",
            "-- select code from public.qr_codes order by code limit 5;",
        ]
    )

    SEED_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    buses, students = parse_transport_users()
    assign_qr_codes(students)

    qr_rows = read_csv("gid_90679730.csv")
    qr_names = {
        cell.strip().upper()
        for row in qr_rows[2:]
        for cell in row
        if cell.strip() and len(cell.split()) >= 2 and cell.upper() != "NAME OF STUDENT"
    }

    for student in students:
        full_name = f"{student['first_name']} {student['last_name']}".upper()
        student["in_qr_sheet"] = full_name in qr_names

    summary = {
        "source_sheet": "2026 Transport Master sheet",
        "sheet_id": "1BDkvHWhJnJXS9vx1c2reyXkab494ZF7bji8z76Ck-mw",
        "schools_dashboard": {
            "total_students": 621,
            "total_bus_capacity": 696,
            "by_campus": {school["name"]: school["students_transport"] for school in SCHOOLS},
        },
        "parsed": {
            "schools": len(SCHOOLS),
            "buses": len(buses),
            "students": len(students),
            "students_by_campus": dict(Counter(student["campus"] for student in students)),
            "buses_by_campus": dict(Counter(bus["campus"] for bus in buses)),
            "students_with_phone": sum(1 for student in students if student["parent_phone"]),
            "students_with_fee": sum(1 for student in students if student["fee_balance_tzs"] > 0),
            "qr_sheet_names": len(qr_names),
            "students_matched_qr_sheet": sum(1 for student in students if student["in_qr_sheet"]),
        },
        "sheet_tabs": {
            "1481461008": "Dashboard",
            "2024890881": "Transport Users (master roster + buses)",
            "90679730": "QR Code (names in CSV; QR images not exported)",
            "356330456": "Transport scan log",
            "1756657284": "AttendanceA",
            "1795930256": "AttendanceB",
            "699362141": "Bus Incidence",
            "600620859": "Bus Arrival Time",
            "590546887": "Transport P/L",
        },
        "notes": [
            "QR tab stores QR as embedded images; CSV export has names only.",
            "Assigned qr_code values as SLV-{campus}-{seq} until image QR payloads are extracted.",
            "Bus plate_number is TBA unless BUS NO looks like a Tanzania plate (T ###); re-seed when real plates sourced.",
            "Kijenge/Ilboru backup capacities 6/4 in sheet corrected to Hiace 30 / Coaster 40 (were student counts).",
        ],
    }

    (OUT_DIR / "schools.json").write_text(json.dumps(SCHOOLS, indent=2), encoding="utf-8")
    (OUT_DIR / "buses.json").write_text(json.dumps(buses, indent=2), encoding="utf-8")
    (OUT_DIR / "students.json").write_text(json.dumps(students, indent=2), encoding="utf-8")
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_seed_sql(students, buses)

    print(json.dumps(summary, indent=2))
    print(f"\nWrote {SEED_PATH} ({SEED_PATH.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
