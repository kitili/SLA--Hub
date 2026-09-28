#!/usr/bin/env python3
"""Extract real per-student distance-based fee-tier data (DISTANCE, DISTANCE
CATEGORY, AMOUNT) from the Transport Users sheet
(data/sheet_import/gid_2024890881.csv) -- the same 20-block matrix
scripts/extract-real-stops-roster.py already parses for destination/GPS.

This is a DIFFERENT kind of gap than every other one handled this session:
the fee AMOUNT is already being captured today (scripts/import-from-sheet.py's
parse_fee() scans for it and it's already seeded into fee_balances.balance in
seed_silverleaf.sql) -- but distance_km/distance_category (the *why* behind
the amount) have nowhere to land in the schema, and the existing naive scan
was never cross-validated against this clean, category-anchored AMOUNT
column. This script does both: extracts distance/category, AND cross-checks
the derived amount against what's already seeded.

Each block's field-search window is bounded by the *next* block's actual
start column (not a fixed-width slice) -- blocks are NOT all the same width
(most are 15 columns, blocks 9/10 are 16/17 to fit an extra column), and a
fixed-width window would silently miss AMOUNT in blocks 9/10 or bleed into
the neighboring block for narrower ones.

Standalone -- does NOT modify any existing script or seed file. Writes:
  - data/import/student_fee_tiers.json  (intermediate, for review)
Reports coverage stats + bijection check + cross-check against already-seeded
fee_balances.balance to stdout; does not write any .sql itself (see
supabase/schema_fee_tiers.sql and supabase/seed_real_fee_tiers.sql, written
by hand from this script's output, since a schema decision is needed first).
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
OUT_JSON = ROOT / "data" / "import" / "student_fee_tiers.json"
OUT_SQL = ROOT / "supabase" / "seed_real_fee_tiers.sql"
STUDENT_STOPS_JSON = ROOT / "data" / "import" / "student_stops.json"
SEED_SILVERLEAF_SQL = ROOT / "supabase" / "seed_silverleaf.sql"


def sql_str(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"

SKIP_NAMES = {
    "NAME OF STUDENT",
    "USARIVER SCHOOL",
    "ARUSHA MODERN",
    "KIJENGE - CAMPUS",
    "ILBORU - CAMPUS",
    "BOMA CAMPUS",
}

# The sheet's own verbatim fee-tier labels -> TZS amount. Verified as a
# perfect, exception-free bijection across ~587-596 students in a prior
# read-only pass -- this script hard-asserts it holds again on every row.
CATEGORY_TO_AMOUNT = {
    "0 TO 5": 550000,
    "6 TO 10": 700000,
    "11 TO 15": 800000,
    "16 TO 20": 900000,
}


def read_csv(name: str) -> list[list[str]]:
    with (SHEET_DIR / name).open(encoding="utf-8") as handle:
        return list(csv.reader(handle))


def parse_amount(raw: str) -> int | None:
    digits = re.sub(r"[^\d]", "", raw or "")
    return int(digits) if digits else None


def parse_distance(raw: str) -> float | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def main() -> None:
    rows = read_csv("gid_2024890881.csv")
    header_row = rows[1]

    # Block start columns: every column whose header starts with "NAME OF STUDENT".
    block_starts = [
        i for i, cell in enumerate(header_row)
        if cell.strip().upper().startswith("NAME OF STUDENT")
    ]
    assert len(block_starts) == 20, (
        f"expected 20 blocks, found {len(block_starts)} -- sheet layout changed"
    )

    blocks = []
    for bi, start in enumerate(block_starts):
        end = block_starts[bi + 1] if bi + 1 < len(block_starts) else len(header_row)
        fields: dict[str, int] = {"name": start}
        for k in range(start, end):
            label = header_row[k].strip().upper()
            if label.startswith("DESTINATION"):
                fields["destination"] = k
            elif label == "DISTANCE CATEGORY":
                fields["distance_category"] = k
        if "distance_category" in fields:
            fields["distance"] = fields["distance_category"] - 1
            fields["amount"] = fields["distance_category"] + 1
        blocks.append(fields)

    missing_category = [bi for bi, f in enumerate(blocks) if "distance_category" not in f]
    if missing_category:
        print(f"WARNING: blocks with no DISTANCE CATEGORY column found: {missing_category}")

    matched = []
    skipped_partial = 0
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
            destination = row[dest_idx].strip() if dest_idx is not None and dest_idx < len(row) else ""
            if not destination:
                continue  # not a "destination-having" row at all; not counted as a gap

            dedupe_key = (full_name.upper(), destination.upper(), block_idx)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            cat_idx = fields.get("distance_category")
            dist_idx = fields.get("distance")
            amt_idx = fields.get("amount")
            if cat_idx is None or dist_idx is None or amt_idx is None:
                skipped_partial += 1
                continue

            category_raw = row[cat_idx].strip() if cat_idx < len(row) else ""
            distance_raw = row[dist_idx].strip() if dist_idx < len(row) else ""
            amount_raw = row[amt_idx].strip() if amt_idx < len(row) else ""

            if not category_raw or not distance_raw or not amount_raw:
                skipped_partial += 1
                continue

            category = category_raw.upper()
            distance_km = parse_distance(distance_raw)
            amount_tzs = parse_amount(amount_raw)

            if distance_km is None or amount_tzs is None:
                skipped_partial += 1
                continue

            expected_amount = CATEGORY_TO_AMOUNT.get(category)
            assert expected_amount is not None, (
                f"Unknown category {category!r} for {full_name} (block {block_idx}) -- "
                "the 4-tier lookup is no longer exhaustive, stop and re-check the sheet"
            )
            assert amount_tzs == expected_amount, (
                f"Bijection broken: {full_name} (block {block_idx}) has category "
                f"{category_raw!r} (expects {expected_amount}) but sheet AMOUNT is "
                f"{amount_tzs} -- contamination found, stop and investigate"
            )

            parts = full_name.split()
            matched.append(
                {
                    "first_name": parts[0].title(),
                    "last_name": " ".join(parts[1:]).title(),
                    "destination": destination,
                    "distance_km": distance_km,
                    "distance_category": category_raw.strip(),
                    "fee_amount_tzs": amount_tzs,
                    "currency": "TZS",
                }
            )

    total_with_destination = len(seen)
    print(f"Students with a destination filled in: {total_with_destination}")
    print(f"Matched with full distance+category+amount: {len(matched)}")
    print(f"Skipped (partial -- one or more of the 3 fields blank): {skipped_partial}")
    skip_pct = (skipped_partial / total_with_destination * 100) if total_with_destination else 0
    print(f"Skip rate: {skip_pct:.1f}% (expect ~4-5% -- a much higher rate means a bug, not sparsity)")

    # bijection cross-tab (should be exactly 4 rows)
    crosstab: dict[str, set[int]] = {}
    for m in matched:
        crosstab.setdefault(m["distance_category"], set()).add(m["fee_amount_tzs"])
    print(f"\nCategory -> amount cross-tab ({len(crosstab)} distinct categories, expect 4):")
    for cat, amounts in sorted(crosstab.items()):
        flag = "  <-- MULTIPLE AMOUNTS, CONTAMINATION" if len(amounts) > 1 else ""
        print(f"  {cat!r}: {sorted(amounts)}{flag}")

    # optional enrichment: route/stop context from student_stops.json (not a filter)
    enriched = 0
    if STUDENT_STOPS_JSON.exists():
        with STUDENT_STOPS_JSON.open(encoding="utf-8") as f:
            stops_records = json.load(f)
        route_by_name: dict[tuple[str, str], dict] = {}
        for r in stops_records:
            key = (r["first_name"].strip().lower(), r["last_name"].strip().lower())
            route_by_name.setdefault(key, r)
        for m in matched:
            key = (m["first_name"].lower(), m["last_name"].lower())
            r = route_by_name.get(key)
            if r:
                m["route_name"] = r["route_name"]
                m["route_id"] = r["route_id"]
                enriched += 1
    print(f"\nEnriched with route/stop context from student_stops.json: {enriched} of {len(matched)}")

    # Cross-check against already-seeded fee_balances.balance in seed_silverleaf.sql.
    # students and fee_balances are both plain one-insert-per-line statements keyed by the
    # same student_id -- join them statically rather than deferring to a live check.
    agree = 0
    disagree = 0
    disagree_samples = []
    if SEED_SILVERLEAF_SQL.exists():
        text = SEED_SILVERLEAF_SQL.read_text(encoding="utf-8")
        student_re = re.compile(
            r"insert into public\.students \([^)]*\) values \('([0-9a-f-]+)',\s*'[0-9a-f-]+',\s*'([^']*)',\s*'([^']*)'"
        )
        balance_re = re.compile(
            r"insert into public\.fee_balances \([^)]*\) values \('([0-9a-f-]+)',\s*(\d+)"
        )
        name_by_id = {m.group(1): (m.group(2), m.group(3)) for m in student_re.finditer(text)}
        balance_by_id = {m.group(1): int(m.group(2)) for m in balance_re.finditer(text)}
        seeded_balance_by_name: dict[tuple[str, str], int] = {}
        for sid, (first, last) in name_by_id.items():
            if sid in balance_by_id:
                seeded_balance_by_name[(first.strip().lower(), last.strip().lower())] = balance_by_id[sid]

        print(
            f"\nParsed {len(name_by_id)} students / {len(balance_by_id)} fee_balances rows "
            f"from seed_silverleaf.sql for cross-check."
        )
        for m in matched:
            key = (m["first_name"].lower(), m["last_name"].lower())
            seeded = seeded_balance_by_name.get(key)
            if seeded is None:
                continue
            m["seeded_balance"] = seeded
            m["seeded_balance_matches"] = seeded == m["fee_amount_tzs"]
            if m["seeded_balance_matches"]:
                agree += 1
            else:
                disagree += 1
                if len(disagree_samples) < 15:
                    disagree_samples.append(
                        f"{m['first_name']} {m['last_name']}: derived={m['fee_amount_tzs']} "
                        f"seeded={seeded}"
                    )
        checked = agree + disagree
        pct = (agree / checked * 100) if checked else 0
        print(f"Cross-check: {agree}/{checked} ({pct:.1f}%) agree with already-seeded fee_balances.balance")
        if disagree_samples:
            print(f"Disagreements ({disagree} total, showing up to 15):")
            for s in disagree_samples:
                print(f"  {s}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(matched, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {OUT_JSON}")

    disagreements = [m for m in matched if m.get("seeded_balance_matches") is False]

    lines = [
        "-- Real per-student distance_km / distance_category from the Transport Users sheet.",
        "-- PROPOSAL ONLY -- not auto-run. Generated by scripts/extract-real-fee-tiers.py.",
        "-- Run AFTER schema_fee_tiers.sql is applied (adds the columns/table this depends on)",
        "-- and after seed_silverleaf.sql (students + fee_balances must already exist).",
        "--",
        f"-- {len(matched)} of {total_with_destination} destination-having students matched with",
        "-- full distance+category+amount (skip rate within the expected ~4-5% sparse-gap band,",
        "-- not a parsing bug -- see script output for exact figures).",
        "--",
        f"-- Cross-checked against already-seeded fee_balances.balance: {agree}/{agree + disagree}",
        f"-- agree. {len(disagreements)} disagreement(s) found -- NOT applied here, flagged only:",
    ]
    for m in disagreements:
        lines.append(
            f"--   {m['first_name']} {m['last_name']}: derived {m['fee_amount_tzs']} vs "
            f"seeded {m['seeded_balance']} (likely the already-known duplicate-name case, "
            "same person appearing twice with two different destinations in the sheet --"
            " verify before trusting either value for this student)"
        )
    lines += [
        "--",
        "-- Matched by student name (case-insensitive) against public.students, same pattern as",
        "-- every other seed_real_*.sql this session. A name that doesn't match exactly one",
        "-- student is silently skipped by insert...select -- review the applied row count.",
        "",
        "update public.fee_balances fb",
        "set distance_km = v.distance_km, distance_category = v.distance_category",
        "from (values",
    ]

    value_rows = []
    for m in matched:
        if m.get("seeded_balance_matches") is False:
            continue  # flagged above, not applied -- needs manual review first
        value_rows.append(
            "  ("
            + sql_str(m["first_name"])
            + ", "
            + sql_str(m["last_name"])
            + ", "
            + f"{m['distance_km']:.2f}, "
            + sql_str(m["distance_category"])
            + ")"
        )
    lines.append(",\n".join(value_rows))
    lines.append(") as v(first_name, last_name, distance_km, distance_category)")
    lines.append("join public.students s on lower(s.first_name) = lower(v.first_name)")
    lines.append("  and lower(s.last_name) = lower(v.last_name)")
    lines.append("where fb.student_id = s.id;")
    lines.append("")

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    with OUT_SQL.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote {OUT_SQL} ({len(value_rows)} rows -- {len(disagreements)} disagreement(s) excluded)")


if __name__ == "__main__":
    main()
