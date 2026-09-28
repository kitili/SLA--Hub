#!/usr/bin/env python3
"""Extract real maintenance/repair line items from the 'Repair & Maintenance'
tab of the raw xlsx (no clean CSV exists for this tab -- it's not part of the
scripts/import-from-sheet.py pipeline). Structure confirmed by direct read:

  - Q1:BS11 -- 7 side-by-side per-bus blocks (DATE|BUS-x|ITEM|UNIT|QTY|
    COST/UNIT|TOTAL). Only "Coaster CHE" (cols BM:BS) has real rows (10 items,
    all dated 2026-05-28). The other 6 (T910 APW, T348 DKS, T147 DEP,
    T108 DYW, T418 EBM, T326 EBP) are empty header-only stubs.
  - B973:I998 and B1070:H1130 -- two "BUSES MAINTENANCE" invoice blocks
    (Bus|Issue|Item|Unit type|Qnt|unit price|Total[|Suply]), no dates.
    These mix single-bus and MULTI-bus shared-invoice jobs -- see caveats
    written into the output SQL file's header.

PROPOSAL ONLY. Writes supabase/seed_real_maintenance.sql -- not auto-run,
not touching any existing seed file.
"""

from __future__ import annotations

from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = Path(r"C:\Users\jet\Downloads\Bus\2026 Transport Master sheet.xlsx")
OUT_SQL = ROOT / "supabase" / "seed_real_maintenance.sql"

# bus label as it appears in data/import/buses.json / the live `buses` table
BUS_LABEL = {
    "Coaster CHE": "Coaster  CHE",  # note: real label has 2 spaces
    "T 910 APW": "T 910 APW -",
    "T 108 DYW": "T 108 DYW",
    "T 326 EBP": "T 326 EBP",
    "Hiace DKS": "Hiace DKS",
    "Hiace EBM": "Hiace EBM",
}


def sql_str(v) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def bus_subquery(label: str) -> str:
    return f"(select id from public.buses where label = {sql_str(label)} limit 1)"


def main() -> None:
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    ws = wb["Repair & Maintenance"]

    records = []  # each: {bus_label, title, cost, service_date, notes}

    # --- Coaster CHE (BM:BS, rows 2-11) ---
    for r in range(2, 12):
        item = ws.cell(row=r, column=67).value  # BO
        qty = ws.cell(row=r, column=69).value  # BQ
        cost_unit = ws.cell(row=r, column=70).value  # BR
        total = ws.cell(row=r, column=71).value  # BS
        date = ws.cell(row=r, column=65).value  # BM
        if not item or not total:
            continue
        records.append(
            {
                "bus_label": BUS_LABEL["Coaster CHE"],
                "title": f"{item} (qty {qty})",
                "cost": float(total),
                "service_date": date.date().isoformat() if hasattr(date, "date") else None,
                "notes": "From 'Repair & Maintenance' sheet, per-bus line-item block",
            }
        )

    # --- APW invoice (rows 1096-1099) ---
    for r in range(1096, 1100):
        item = ws.cell(row=r, column=4).value  # D: Item
        total = ws.cell(row=r, column=7).value  # G: Total
        if not item or not total:
            continue
        records.append(
            {
                "bus_label": BUS_LABEL["T 910 APW"],
                "title": str(item),
                "cost": float(total),
                "service_date": None,
                "notes": "From 'Repair & Maintenance' sheet, BUSES MAINTENANCE invoice block (undated)",
            }
        )

    # --- ROSA EBP & DYW invoice (rows 1104-1107) -- shared 2-bus visit, ---
    # --- attributed to DYW (the only bus named in an item description) ---
    for r in range(1104, 1108):
        item = ws.cell(row=r, column=4).value
        total = ws.cell(row=r, column=7).value
        if not item or not total:
            continue
        records.append(
            {
                "bus_label": BUS_LABEL["T 108 DYW"],
                "title": str(item),
                "cost": float(total),
                "service_date": None,
                "notes": (
                    "SHARED VISIT: sheet groups this under 'ROSA EBP & DYW' (both T326 EBP "
                    "and T108 DYW serviced together); attributed here to T108 DYW only "
                    "since the 'Shock up for DYW' line explicitly names it -- cost is NOT "
                    "split, review before trusting this attribution for T326 EBP's own history."
                ),
            }
        )

    # --- DEP & DKS invoice (rows 1112-1117) -- mixes DEP/DKS/EBM references, ---
    # --- attributed to Hiace DKS (matches header, DEP not in fleet) ---
    for r in range(1112, 1118):
        item = ws.cell(row=r, column=4).value
        total = ws.cell(row=r, column=7).value
        if not item or not total:
            continue
        records.append(
            {
                "bus_label": BUS_LABEL["Hiace DKS"],
                "title": str(item),
                "cost": float(total),
                "service_date": None,
                "notes": (
                    "AMBIGUOUS: sheet header says 'DEP & DKS' but one item text says "
                    "'Shock up front EBM' -- likely a 3-way shared visit (DEP not in current "
                    "fleet, so attributed to Hiace DKS only). Cost NOT split. Review before trusting."
                ),
            }
        )

    print(f"Extracted {len(records)} maintenance line items with confident/flagged bus attribution.")
    total_cost = sum(r["cost"] for r in records)
    print(f"Total cost across these: {total_cost:,.0f} TZS")

    lines = [
        "-- Real maintenance/repair records from 'Repair & Maintenance' tab of the raw xlsx.",
        "-- PROPOSAL ONLY -- not auto-run. Generated by scripts/extract-real-maintenance.py.",
        "-- Run AFTER seed_silverleaf.sql (buses must exist).",
        "--",
        f"-- {len(records)} line items seeded, total {total_cost:,.0f} TZS.",
        "--",
        "-- NOT seeded (flagged, not guessed):",
        "--   - 'Hiace DEP' block (24 line items, ~2.33M TZS, rows 975-995 -- duplicated at",
        "--     1072-1094): Hiace DEP is NOT among the current 20 seeded buses. Real repair",
        "--     history exists for a bus that doesn't exist in this app -- either a retired bus",
        "--     whose plate should be reconciled, or a fleet gap. Flag to Kai before deciding.",
        "--   - 'Labour charges' 350,000 TZS (row 1129) -- fleet-wide, not attributable to one bus.",
        "--   - Two line items above (ROSA EBP&DYW, DEP&DKS) are SHARED multi-bus invoices --",
        "--     attributed to one bus only per record, cost NOT split. Search this file for",
        "--     'SHARED VISIT' / 'AMBIGUOUS' before trusting per-bus maintenance totals.",
        "",
        "insert into public.maintenance_records (bus_id, title, category, cost, currency, service_date, notes)",
        "values",
    ]

    rows_sql = []
    for r in records:
        rows_sql.append(
            "  ("
            + bus_subquery(r["bus_label"])
            + ", "
            + sql_str(r["title"][:200])
            + ", 'repair', "
            + f"{r['cost']:.2f}"
            + ", 'TZS', "
            + (sql_str(r["service_date"]) + "::date" if r["service_date"] else "null")
            + ", "
            + sql_str(r["notes"])
            + ")"
        )
    lines.append(",\n".join(rows_sql) + ";")
    lines.append("")

    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_SQL}")


if __name__ == "__main__":
    main()
