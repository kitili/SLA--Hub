#!/usr/bin/env python3
"""Keep visitor sign-in records aligned between the live visitor log and desks/visitors."""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "desks.json"
SCHEMA = """
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  host TEXT NOT NULL,
  campus TEXT NOT NULL,
  date TEXT NOT NULL,
  photo TEXT,
  source TEXT NOT NULL CHECK(source IN ('desk', 'self')),
  signed_in_at TEXT NOT NULL,
  signed_out_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_campus_date ON visits(campus, date);
CREATE INDEX IF NOT EXISTS idx_visits_signed_out ON visits(signed_out_at);
"""
INSERT = """
INSERT OR REPLACE INTO visits (
  id, name, phone, purpose, host, campus, date, photo, source, signed_in_at, signed_out_at
) VALUES (
  :id, :name, :phone, :purpose, :host, :campus, :date, :photo, :source, :signed_in_at, :signed_out_at
)
"""


def visitors_desk() -> dict:
    desks = json.loads(CONFIG_PATH.read_text())["desks"]
    desk = next((item for item in desks if item["id"] == "visitors"), None)
    if not desk:
        raise SystemExit("visitors desk is missing from desks.json")
    return desk


def data_paths(desk: dict) -> tuple[Path, Path]:
    live = Path(desk["fallback"]) / "data"
    hub = ROOT / desk["path"] / "data"
    return live, hub


def checkpoint(db_path: Path) -> None:
    if not db_path.exists():
        return
    con = sqlite3.connect(str(db_path))
    try:
        con.execute("PRAGMA wal_checkpoint(FULL)")
    except sqlite3.OperationalError:
        pass
    finally:
        con.close()


def read_visits(db_path: Path) -> dict[str, dict]:
    if not db_path.exists():
        return {}
    checkpoint(db_path)
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute("SELECT * FROM visits").fetchall()
    except sqlite3.DatabaseError:
        return {}
    finally:
        con.close()
    return {row["id"]: dict(row) for row in rows}


def prefer(left: dict, right: dict) -> dict:
    left_out = left.get("signed_out_at")
    right_out = right.get("signed_out_at")
    if right_out and not left_out:
        return right
    if left_out and not right_out:
        return left
    if (right.get("signed_in_at") or "") > (left.get("signed_in_at") or ""):
        return right
    return left


def write_visits(db_path: Path, rows: dict[str, dict]) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path))
    try:
        con.execute("PRAGMA journal_mode = WAL")
        con.executescript(SCHEMA)
        con.executemany(INSERT, list(rows.values()))
        con.commit()
        con.execute("PRAGMA wal_checkpoint(FULL)")
    finally:
        con.close()


def write_json(data_dir: Path, rows: dict[str, dict]) -> None:
    payload = []
    for row in sorted(rows.values(), key=lambda item: item.get("signed_in_at") or ""):
        payload.append(
            {
                "id": row["id"],
                "name": row["name"],
                "phone": row["phone"],
                "purpose": row["purpose"],
                "host": row["host"],
                "campus": "Arusha Modern" if row["campus"] == "Arusha Town" else row["campus"],
                "date": row["date"],
                "photo": row["photo"],
                "source": row["source"],
                "signedInAt": row["signed_in_at"],
                "signedOutAt": row["signed_out_at"],
            }
        )
    (data_dir / "visits.json").write_text(json.dumps(payload, indent=2) + "\n")


def sync_photos(live: Path, hub: Path) -> int:
    live_photos = live / "photos"
    hub_photos = hub / "photos"
    live_photos.mkdir(parents=True, exist_ok=True)
    hub_photos.mkdir(parents=True, exist_ok=True)
    names = {path.name for path in live_photos.glob("*") if path.is_file()} | {
        path.name for path in hub_photos.glob("*") if path.is_file()
    }
    copied = 0
    for name in names:
        src_live = live_photos / name
        src_hub = hub_photos / name
        src = src_live if src_live.exists() else src_hub
        for dest in (src_live, src_hub):
            if dest.exists():
                continue
            shutil.copy2(src, dest)
            copied += 1
    return copied


def stamp_mtime(live: Path) -> float:
    times = []
    for name in ("visits.db", "visits.db-wal", "visits.json"):
        path = live / name
        if path.exists():
            times.append(path.stat().st_mtime)
    return max(times) if times else 0.0


def sync_once(quiet: bool = False) -> dict:
    desk = visitors_desk()
    live, hub = data_paths(desk)
    if not live.exists():
        raise SystemExit(f"live visitor data missing: {live}")
    hub.mkdir(parents=True, exist_ok=True)

    merged = read_visits(live / "visits.db")
    for visit_id, row in read_visits(hub / "visits.db").items():
        merged[visit_id] = prefer(merged[visit_id], row) if visit_id in merged else row

    write_visits(live / "visits.db", merged)
    write_visits(hub / "visits.db", merged)
    write_json(live, merged)
    write_json(hub, merged)
    photos = sync_photos(live, hub)

    result = {
        "visits": len(merged),
        "photos": len(list((live / "photos").glob("*"))),
        "photosCopied": photos,
        "live": str(live),
        "hub": str(hub),
        "syncedAt": datetime.now(timezone.utc).isoformat(),
    }
    if not quiet:
        print(
            f"visitors data  {result['visits']} visits  "
            f"{result['photos']} photos  live={live}  hub={hub}",
            flush=True,
        )
    return result


def watch() -> int:
    desk = visitors_desk()
    live, _hub = data_paths(desk)
    last = stamp_mtime(live)
    sync_once()
    print("watching visitor sign-ins — Ctrl+C to stop", flush=True)
    try:
        while True:
            time.sleep(2)
            current = stamp_mtime(live)
            if current > last:
                last = current
                sync_once()
    except KeyboardInterrupt:
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Silverleaf visitor records into the hub")
    parser.add_argument("--watch", action="store_true", help="copy again whenever new visits are written")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--json", action="store_true", help="print a JSON summary")
    args = parser.parse_args()
    if args.watch:
        return watch()
    result = sync_once(quiet=args.quiet)
    if args.json:
        print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
