#!/usr/bin/env python3
"""Download all tabs from the Silverleaf transport Google Sheet as CSV."""

from __future__ import annotations

import urllib.request
from pathlib import Path

SHEET_ID = "1BDkvHWhJnJXS9vx1c2reyXkab494ZF7bji8z76Ck-mw"
GIDS = [
    "1481461008",  # Dashboard
    "590546887",  # Transport P/L
    "2024890881",  # Transport Users
    "699362141",  # Bus Incidence
    "600620859",  # Bus Arrival Time
    "912299804",  # Live Locations
    "1430392442",  # Repair & Maintenance
    "1818137574",  # Actual vs Budget
    "1756657284",  # AttendanceA
    "1795930256",  # AttendanceB
    "90679730",  # QR Code
    "356330456",  # Transport scan log
]

OUT = Path(__file__).resolve().parents[1] / "data" / "sheet_import"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for gid in GIDS:
        url = (
            f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
            f"?tqx=out:csv&gid={gid}"
        )
        data = urllib.request.urlopen(url, timeout=120).read()
        path = OUT / f"gid_{gid}.csv"
        path.write_bytes(data)
        print(f"saved {path.name} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
