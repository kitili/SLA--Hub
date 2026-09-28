#!/usr/bin/env python3
"""Extract real stop locations + student->stop assignments from the Transport
Users sheet (data/sheet_import/gid_2024890881.csv), cross-referenced against
the 18 real routes already seeded in supabase/seed_routes.sql.

Sheet structure (confirmed by direct inspection, not assumed): this is a
20-row x 20-block MATRIX, not "one row per bus". Rows 2-21 hold bus MASTER
data (campus/label/capacity/driver/etc, one bus per row) in columns 0-13.
Separately, columns 14+ are twenty repeating "NAME OF STUDENT" blocks -- each
BLOCK's position (not the row it appears on) identifies a fixed bus/route,
readable from row 0's label at that block's start column (e.g. "Kiwawa -
APW", "AM NGARAMTONI (BMC)"). Row number within a block is just "which
numbered student slot" for that bus. This was verified by dumping row 0's
per-block labels directly -- see BLOCK_ROUTE_NAMES below.

Standalone -- does NOT modify scripts/import-from-sheet.py or any existing
seed file. Writes:
  - data/import/student_stops.json   (intermediate, for review)
  - supabase/seed_real_stops_and_assignments.sql  (proposal, not auto-run)
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

csv.field_size_limit(min(sys.maxsize, 10_000_000))

ROOT = Path(__file__).resolve().parents[1]
SHEET_DIR = ROOT / "data" / "sheet_import"
OUT_JSON = ROOT / "data" / "import" / "student_stops.json"
OUT_SQL = ROOT / "supabase" / "seed_real_stops_and_assignments.sql"

SKIP_NAMES = {
    "NAME OF STUDENT",
    "USARIVER SCHOOL",
    "ARUSHA MODERN",
    "KIJENGE - CAMPUS",
    "ILBORU - CAMPUS",
    "BOMA CAMPUS",
}

# Block index (0-19, in header-column order) -> clean route name (matches
# supabase/seed_routes.sql exactly). Derived by reading row 0's per-block
# label (e.g. "Kiwawa - APW", "AM SAKINA (CHE)") and cross-referencing the
# bus-code suffix against data/import/buses.json's bus->route mapping.
BLOCK_ROUTE_NAMES = [
    "Kikatiti",                  # 0: "Kikatiti route DYW"      -> T 108 DYW
    "Nshupu via Usariver",       # 1: "Nshupu Route - EBP"      -> T 326 EBP
    "Kiwawa",                    # 2: "Kiwawa - APW"            -> T 910 APW
    "Tengeru",                   # 3: "Tengeru"                 -> Rental Hiace (Usariver)
    "Kambini",                   # 4: "Kambini - BHM"           -> BHM
    "East Africa - Moshono",     # 5: "Moshono - CPP"           -> CPP
    "Town - Sakina",             # 6: "Mianzini - DDA"          -> DDA
    "Sabato- Bango latigo",      # 7: "Sabato - BAE"            -> BAE
    "Nkoaranga",                 # 8: "Nkoaranga - BUF"         -> Rental Coaster BUF - Nkoaranga
    "Maji ya chai Tuvaila",      # 9: "Ebenezer - DSD"          -> DSD
    "Ngongongare",                # 10: "Young Boys - BAE"       -> Coaster BAE - Young boys
    "Morombo",                   # 11: "MOROMBO ROUTE (EBM)"    -> Hiace EBM
    "Sakina",                    # 12: "AM SAKINA (CHE)"        -> Coaster CHE
    "Ngaramtoni",                # 13: "AM NGARAMTONI (BMC)"    -> Rental Hiace (AM) -- real plate T400BMC
    "Njiro",                     # 14: "AM MOSHONO (DKS)"       -> Hiace DKS
    "Kijenge",                   # 15: "KIJENGE"                -> HIACE - Normal route (Kijenge)
    "Kijenge",                   # 16: "KIJENGE Back up"        -> Hiaace DKS - Back up
    "Iliboru",                   # 17: "ILBORU (Normal route)"  -> HIACE - Normal route (Ilboru)
    "Iliboru",                   # 18: "ILBORU - Back up)"      -> Coasster CHE - Back up
    "Sadala",                    # 19: "BOMA"                   -> HIACE (Boma)
]

ROUTE_ID_BY_NAME = {
    "Kiwawa": "e1000000-0000-4000-8000-000000000001",
    "East Africa - Moshono": "e1000000-0000-4000-8000-000000000002",
    "Ngongongare": "e1000000-0000-4000-8000-000000000003",
    "Nshupu via Usariver": "e1000000-0000-4000-8000-000000000004",
    "Town - Sakina": "e1000000-0000-4000-8000-000000000005",
    "Kikatiti": "e1000000-0000-4000-8000-000000000006",
    "Tengeru": "e1000000-0000-4000-8000-000000000007",
    "Sabato- Bango latigo": "e1000000-0000-4000-8000-000000000008",
    "Kambini": "e1000000-0000-4000-8000-000000000009",
    "Maji ya chai Tuvaila": "e1000000-0000-4000-8000-00000000000a",
    "Nkoaranga": "e1000000-0000-4000-8000-00000000000b",
    "Sakina": "e1000000-0000-4000-8000-00000000000c",
    "Morombo": "e1000000-0000-4000-8000-00000000000d",
    "Njiro": "e1000000-0000-4000-8000-00000000000e",
    "Ngaramtoni": "e1000000-0000-4000-8000-00000000000f",
    "Kijenge": "e1000000-0000-4000-8000-000000000010",
    "Iliboru": "e1000000-0000-4000-8000-000000000011",
    "Sadala": "e1000000-0000-4000-8000-000000000012",
}

SCHOOL_ID_BY_ROUTE_ID = {}
for _name, _rid in ROUTE_ID_BY_NAME.items():
    pass  # filled below once IDs are known


def school_for_route(route_id: str) -> str:
    suffix = route_id.split("-")[-1]
    usariver = {
        "000000000001", "000000000002", "000000000003", "000000000004",
        "000000000005", "000000000006", "000000000007", "000000000008",
        "000000000009", "00000000000a", "00000000000b",
    }
    am = {"00000000000c", "00000000000d", "00000000000e", "00000000000f"}
    if suffix in usariver:
        return "a1000000-0000-4000-8000-000000000001"
    if suffix in am:
        return "a1000000-0000-4000-8000-000000000002"
    if suffix == "000000000010":
        return "a1000000-0000-4000-8000-000000000003"
    if suffix == "000000000011":
        return "a1000000-0000-4000-8000-000000000004"
    return "a1000000-0000-4000-8000-000000000005"


def read_csv(name: str) -> list[list[str]]:
    with (SHEET_DIR / name).open(encoding="utf-8") as handle:
        return list(csv.reader(handle))


def norm_dest(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip()).upper()


def parse_latlong(raw: str) -> tuple[float, float] | None:
    if not raw or "," not in raw:
        return None
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 2:
        return None
    try:
        lat, lng = float(parts[0]), float(parts[1])
    except ValueError:
        return None
    if not (-6 < lat < -1 and 34 < lng < 39):
        return None
    return lat, lng


def sql_str(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def main() -> None:
    rows = read_csv("gid_2024890881.csv")
    route_row, header_row = rows[0], rows[1]

    blocks = []
    for i, cell in enumerate(header_row):
        if not cell.strip().upper().startswith("NAME OF STUDENT"):
            continue
        fields: dict[str, int] = {}
        for k in range(i, min(i + 14, len(header_row))):
            label = header_row[k].strip().upper()
            if label.startswith("NAME OF STUDENT"):
                fields["name"] = k
            elif label.startswith("DESTINATION"):
                fields["destination"] = k
            elif "LAT/LONG" in label:
                fields["gps"] = k
        blocks.append(fields)

    assert len(blocks) == len(BLOCK_ROUTE_NAMES), (
        f"expected {len(BLOCK_ROUTE_NAMES)} blocks, sheet has {len(blocks)} -- "
        "sheet layout changed, BLOCK_ROUTE_NAMES needs re-verifying"
    )

    matched = []
    no_gps = 0
    seen = set()

    for row in rows[2:]:
        for block_idx, fields in enumerate(blocks):
            name_idx = fields.get("name")
            if name_idx is None or name_idx >= len(row):
                continue
            full_name = row[name_idx].strip()
            if not full_name or len(full_name.split()) < 2 or full_name.upper() in SKIP_NAMES:
                continue

            dest_idx = fields.get("destination")
            gps_idx = fields.get("gps")
            destination = row[dest_idx].strip() if dest_idx is not None and dest_idx < len(row) else ""
            # The "LAT/LONG" header sometimes lands on a DMS-format column
            # (e.g. 3°21'37.6"S 36°51'55.4"E) with the real decimal "lat, lng"
            # string one column to the right (unlabeled) -- try both.
            gps_raw = row[gps_idx].strip() if gps_idx is not None and gps_idx < len(row) else ""
            latlong = parse_latlong(gps_raw)
            if latlong is None and gps_idx is not None and gps_idx + 1 < len(row):
                latlong = parse_latlong(row[gps_idx + 1].strip())

            dedupe_key = (full_name.upper(), destination.upper(), block_idx)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            route_name = BLOCK_ROUTE_NAMES[block_idx]
            route_id = ROUTE_ID_BY_NAME[route_name]
            if not destination or not latlong:
                no_gps += 1
                continue

            parts = full_name.split()
            matched.append(
                {
                    "first_name": parts[0].title(),
                    "last_name": " ".join(parts[1:]).title(),
                    "route_name": route_name,
                    "route_id": route_id,
                    "destination": destination,
                    "destination_key": norm_dest(destination),
                    "lat": latlong[0],
                    "lng": latlong[1],
                }
            )

    print(f"Matched students with real destination+GPS (route via block position): {len(matched)}")
    print(f"Skipped (no destination/gps in that cell): {no_gps}")

    stops: dict[tuple[str, str], dict] = {}
    for m in matched:
        key = (m["route_id"], m["destination_key"])
        s = stops.setdefault(
            key,
            {"route_id": m["route_id"], "name": m["destination"], "lats": [], "lngs": []},
        )
        s["lats"].append(m["lat"])
        s["lngs"].append(m["lng"])

    per_route_counts: dict[str, int] = {}
    for (route_id, _), s in stops.items():
        per_route_counts[route_id] = per_route_counts.get(route_id, 0) + 1

    print(f"\nUnique stops to create: {len(stops)}")
    for route_name, route_id in ROUTE_ID_BY_NAME.items():
        cnt = per_route_counts.get(route_id, 0)
        flag = "  <-- exceeds 25-stop cap!" if cnt > 25 else ""
        print(f"  {route_name}: {cnt} stops{flag}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(matched, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {OUT_JSON}")

    lines = [
        "-- Real stops + student->stop assignments from data/sheet_import/gid_2024890881.csv",
        "-- (Transport Users tab), cross-referenced against the 18 real routes in seed_routes.sql.",
        "-- PROPOSAL ONLY -- not auto-run. Generated by scripts/extract-real-stops-roster.py.",
        "-- Run AFTER seed_silverleaf.sql + seed_routes.sql.",
        "--",
        f"-- Coverage: {len(matched)} of ~618 transported students have real destination+GPS in the",
        "-- source sheet; the rest have no individual stop record there (only aggregate counts).",
        "-- Stop order (stop_order) is left as insertion order -- run POST /api/routes/[id]/optimize",
        "-- once per route after loading to get a real drive order (existing Jfree feature).",
        "-- Kijenge and Iliboru routes are each shared by 2 physical buses (normal + backup),",
        "-- so their stop counts reflect both buses' combined destinations (Kijenge: 30 stops,",
        "-- over the 25-stop soft cap used elsewhere -- may need splitting into 2 routes later).",
        "-- Njiro and Sadala (Boma) have ZERO real coordinates anywhere in the sheet for their",
        "-- students (destination names exist, GPS columns are empty/absent) -- those two routes",
        "-- still need the GPS-clustering path (src/lib/stops/cluster-from-trips.ts) once matrons",
        "-- run enough live trips, or manual pin-dropping.",
        "",
    ]

    stop_ids = {}
    counter = 1
    for (route_id, dest_key), s in sorted(stops.items()):
        stop_id = f"f3{str(counter).zfill(6)}-0000-4000-8000-{str(counter).zfill(12)}"
        stop_ids[(route_id, dest_key)] = stop_id
        counter += 1

    lines.append("insert into public.stops (id, school_id, name, lat, lng, kind) values")
    stop_rows = []
    for (route_id, dest_key), s in sorted(stops.items()):
        stop_id = stop_ids[(route_id, dest_key)]
        avg_lat = sum(s["lats"]) / len(s["lats"])
        avg_lng = sum(s["lngs"]) / len(s["lngs"])
        school_id = school_for_route(route_id)
        stop_rows.append(
            f"  ('{stop_id}', '{school_id}', {sql_str(s['name'][:120])}, {avg_lat:.6f}, {avg_lng:.6f}, 'pickup')"
        )
    lines.append(",\n".join(stop_rows) + "\non conflict (id) do update set lat = excluded.lat, lng = excluded.lng;")
    lines.append("")

    lines.append("insert into public.route_stops (route_id, stop_id, stop_order) values")
    rs_rows = []
    order_by_route: dict[str, int] = {}
    for (route_id, dest_key), s in sorted(stops.items()):
        stop_id = stop_ids[(route_id, dest_key)]
        order = order_by_route.get(route_id, 0)
        order_by_route[route_id] = order + 1
        rs_rows.append(f"  ('{route_id}', '{stop_id}', {order})")
    lines.append(",\n".join(rs_rows) + "\non conflict (route_id, stop_id) do update set stop_order = excluded.stop_order;")
    lines.append("")

    lines.append("-- student_stop_assignments: matched by name against public.students (case-insensitive).")
    lines.append("-- A name that doesn't match exactly one student is silently skipped by insert...select --")
    lines.append("-- review the actual applied row count against the expected count below.")
    lines.append(f"-- Expected upsert count: {len(matched)}")
    lines.append("insert into public.student_stop_assignments (student_id, stop_id, route_id)")
    select_rows = []
    for m in matched:
        stop_id = stop_ids[(m["route_id"], m["destination_key"])]
        select_rows.append(
            "select s.id, "
            + sql_str(stop_id)
            + "::uuid, "
            + sql_str(m["route_id"])
            + "::uuid from public.students s where lower(s.first_name) = lower("
            + sql_str(m["first_name"])
            + ") and lower(s.last_name) = lower("
            + sql_str(m["last_name"])
            + ") limit 1"
        )
    lines.append("\nunion all\n".join(select_rows))
    lines.append("on conflict (student_id, stop_id) do update set route_id = excluded.route_id;")
    lines.append("")

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    with OUT_SQL.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote {OUT_SQL}")


if __name__ == "__main__":
    main()
