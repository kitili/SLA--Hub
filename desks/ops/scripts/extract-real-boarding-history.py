#!/usr/bin/env python3
"""Extract real historical boarding scans from data/sheet_import/gid_356330456.csv
("Transport scan log" -- confirmed by direct read to be the true long-format
STUDENT_NAME + TIMESTAMP log; NOT gid_1756657284 "AttendanceA", which is
actually a wide Yes/No day-matrix, a different tab entirely).

Row 0 of the raw CSV is a corrupted duplicate-data artifact (header cells
contain the whole column's data crammed in) -- real data starts at row 1.

Matches each scan to a student via data/import/student_stops.json (507
students with a route_id already confirmed reliable by block position, see
scripts/extract-real-stops-roster.py) -- students outside that set are
skipped rather than guessed at.

boarding_events.trip_id is NOT NULL and no historical trips exist for these
dates -- this script also generates the backing `trips` rows.

PROPOSAL ONLY. Writes supabase/seed_real_boarding_history.sql -- not auto-run.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

csv.field_size_limit(min(sys.maxsize, 10_000_000))

ROOT = Path(__file__).resolve().parents[1]
OUT_SQL = ROOT / "supabase" / "seed_real_boarding_history.sql"

# route_id -> (bus label, school_id) -- Kijenge/Iliboru resolved to their
# "Normal route" bus (not backup); the two "Rental Hiace" buses (Tengeru vs
# Ngaramtoni) disambiguated by school_id since the label alone is ambiguous.
ROUTE_BUS = {
    "e1000000-0000-4000-8000-000000000001": ("T 910 APW -", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000002": ("CPP", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000003": ("Coaster BAE - Young boys", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000004": ("T 326 EBP", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000005": ("DDA", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000006": ("T 108 DYW", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000007": ("Rental Hiace", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000008": ("BAE", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-000000000009": ("BHM", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-00000000000a": ("DSD", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-00000000000b": ("Rental Coaster BUF) - Nkoaranga", "a1000000-0000-4000-8000-000000000001"),
    "e1000000-0000-4000-8000-00000000000c": ("Coaster  CHE", "a1000000-0000-4000-8000-000000000002"),
    "e1000000-0000-4000-8000-00000000000d": ("Hiace EBM", "a1000000-0000-4000-8000-000000000002"),
    "e1000000-0000-4000-8000-00000000000e": ("Hiace DKS", "a1000000-0000-4000-8000-000000000002"),
    "e1000000-0000-4000-8000-00000000000f": ("Rental Hiace", "a1000000-0000-4000-8000-000000000002"),
    "e1000000-0000-4000-8000-000000000010": ("HIACE - Normal route", "a1000000-0000-4000-8000-000000000003"),
    "e1000000-0000-4000-8000-000000000011": ("HIACE - Normal route", "a1000000-0000-4000-8000-000000000004"),
    "e1000000-0000-4000-8000-000000000012": ("HIACE", "a1000000-0000-4000-8000-000000000005"),
}


def sql_str(v) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def main() -> None:
    with (ROOT / "data" / "import" / "student_stops.json").open(encoding="utf-8") as f:
        student_stops = json.load(f)
    # name (upper, "first last") -> route_id (first match wins; duplicates are rare)
    name_to_route = {}
    for s in student_stops:
        key = f"{s['first_name']} {s['last_name']}".upper()
        name_to_route.setdefault(key, s["route_id"])

    with (ROOT / "data" / "sheet_import" / "gid_356330456.csv").open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    matched = []
    unmatched_names = set()
    bad_timestamp = 0

    for row in rows[1:]:  # row 0 is a corrupted duplicate-data artifact
        if len(row) < 2:
            continue
        name, ts_raw = row[0].strip(), row[1].strip()
        if not name or not ts_raw:
            continue
        try:
            dt = datetime.strptime(ts_raw, "%d-%m-%Y %H:%M:%S")
        except ValueError:
            bad_timestamp += 1
            continue

        route_id = name_to_route.get(name.upper())
        if not route_id:
            unmatched_names.add(name.upper())
            continue

        direction = "am" if dt.hour < 12 else "pm"
        matched.append(
            {
                "name": name,
                "route_id": route_id,
                "date": dt.date().isoformat(),
                "direction": direction,
                "scanned_at": dt.isoformat(),
            }
        )

    print(f"Raw rows: {len(rows) - 1}")
    print(f"Matched to a known student+route: {len(matched)}")
    print(f"Unmatched student names: {len(unmatched_names)}")
    print(f"Bad/unparseable timestamps: {bad_timestamp}")

    # dedup: keep only the EARLIEST scan per (name, date, direction) --
    # source has frequent same-day duplicate scans (scanner glitches).
    best: dict[tuple[str, str, str], dict] = {}
    for m in matched:
        key = (m["name"].upper(), m["date"], m["direction"])
        if key not in best or m["scanned_at"] < best[key]["scanned_at"]:
            best[key] = m
    deduped = list(best.values())
    print(f"After dedup (earliest scan per student/date/direction): {len(deduped)}")

    # figure out which (bus_label, school_id, date) trips are needed
    trip_keys = set()
    for m in deduped:
        label, school_id = ROUTE_BUS[m["route_id"]]
        trip_keys.add((label, school_id, m["date"], m["direction"]))

    lines = [
        "-- Real historical boarding scans from 'Transport scan log' tab",
        "-- (data/sheet_import/gid_356330456.csv). PROPOSAL ONLY -- not auto-run.",
        "-- Generated by scripts/extract-real-boarding-history.py.",
        "-- Run AFTER seed_silverleaf.sql + seed_real_stops_and_assignments.sql.",
        "--",
        f"-- {len(rows) - 1} raw scan rows -> {len(matched)} matched to a known student+route",
        "-- (via data/import/student_stops.json's 507 confirmed students) -> "
        f"{len(deduped)} after",
        "-- deduping same-student-same-day-same-direction repeat scans (kept earliest).",
        "-- Students outside the 507 with confirmed real destination+GPS are skipped, not",
        "-- guessed at -- this is a partial, not complete, historical backfill.",
        "--",
        "-- All events seeded as event_type='in' (the source log has no in/out marker).",
        "-- Direction (am/pm) inferred from scan hour (<12:00 = am, >=12:00 = pm).",
        "--",
        "-- boarding_events.trip_id is NOT NULL -- this file creates the backing historical",
        "-- `trips` rows first (one per bus+date+direction actually needed).",
        "",
        "-- Step 1: backing historical trips (idempotent).",
        "insert into public.trips (bus_id, trip_date, direction, status)",
        "select b.id, v.trip_date::date, v.direction, 'completed'",
        "from (values",
    ]
    trip_rows = [
        f"  ({sql_str(label)}, {sql_str(school_id)}::uuid, {sql_str(date)}, {sql_str(direction)})"
        for (label, school_id, date, direction) in sorted(trip_keys)
    ]
    lines.append(",\n".join(trip_rows))
    lines.append(") as v(bus_label, school_id, trip_date, direction)")
    lines.append("join public.buses b on b.label = v.bus_label and b.school_id = v.school_id")
    lines.append("on conflict (bus_id, trip_date, direction) do nothing;")
    lines.append("")

    lines.append(f"-- Step 2: {len(deduped)} boarding events, matched by student name.")
    lines.append("insert into public.boarding_events (trip_id, student_id, event_type, scanned_at)")
    event_selects = []
    for m in deduped:
        label, school_id = ROUTE_BUS[m["route_id"]]
        parts = m["name"].split()
        first, last = parts[0], " ".join(parts[1:]) if len(parts) > 1 else ""
        event_selects.append(
            "select t.id, s.id, 'in', "
            + sql_str(m["scanned_at"])
            + "::timestamptz "
            + "from public.trips t "
            + f"join public.buses b on b.id = t.bus_id and b.label = {sql_str(label)} and b.school_id = {sql_str(school_id)}::uuid "
            + f"join public.students s on lower(s.first_name || ' ' || s.last_name) = lower({sql_str(m['name'])}) "
            + f"where t.trip_date = {sql_str(m['date'])}::date and t.direction = {sql_str(m['direction'])} "
            + "limit 1"
        )
    lines.append("\nunion all\n".join(event_selects))
    lines.append("on conflict (trip_id, student_id, event_type) do nothing;")
    lines.append("")

    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_SQL}")


if __name__ == "__main__":
    main()
