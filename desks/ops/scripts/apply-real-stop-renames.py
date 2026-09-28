#!/usr/bin/env python3
"""Rename Irene's live per-student "Pickup point" stops to their real
destination names, via the real PATCH /api/stops/[stopId] admin endpoint
(same auth/validation path as a human admin using the app -- not a direct
DB write). Kai verbally approved applying this ourselves rather than
waiting for review.

Matches by student name against data/import/student_stops.json, only for
names that map to exactly one destination there (ambiguous names are
skipped, not guessed) -- same logic as rename-pickup-point-stops.py, which
generates the equivalent SQL proposal for reference/review.

Requires LOGIN_EMAIL / LOGIN_PASSWORD (admin) as env vars and the dev
server running on localhost:3000.

Usage:
  python scripts/apply-real-stop-renames.py            (dry run -- prints only)
  MODE=--apply python scripts/apply-real-stop-renames.py  (writes)
"""

import json
import os
from collections import defaultdict
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://localhost:3000"
APPLY = "--apply" in os.environ.get("MODE", "")


def main() -> None:
    email = os.environ["LOGIN_EMAIL"]
    password = os.environ["LOGIN_PASSWORD"]

    with (ROOT / "data" / "import" / "student_stops.json").open(encoding="utf-8") as f:
        records = json.load(f)

    by_name: dict[tuple[str, str], set[str]] = defaultdict(set)
    dest_for_name: dict[tuple[str, str], str] = {}
    for r in records:
        key = (r["first_name"].strip().lower(), r["last_name"].strip().lower())
        by_name[key].add(r["destination"].strip())
        dest_for_name[key] = r["destination"].strip()
    unambiguous = {k: v for k, v in dest_for_name.items() if len(by_name[k]) == 1}
    print(f"Unambiguous name->destination pairs available: {len(unambiguous)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 1000})
        page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        page.wait_for_selector('input[type="email"]', timeout=20000)
        page.fill('input[type="email"]', email)
        page.wait_for_timeout(300)
        page.fill('input[type="password"]', password)
        page.wait_for_timeout(300)
        page.click('button[type="submit"]')
        page.wait_for_url(lambda url: "/login" not in url, timeout=45000)
        print("Login OK")

        assignments = page.evaluate(
            """async () => {
                const res = await fetch('/api/student-stops');
                const data = await res.json();
                return data.assignments ?? data ?? [];
            }"""
        )
        print(f"Live assignments fetched: {len(assignments)}")

        to_rename = []
        seen_stop_ids = set()
        for a in assignments:
            stop = a.get("stop") or {}
            student = a.get("student") or {}
            if stop.get("name") != "Pickup point":
                continue
            stop_id = stop.get("id")
            if not stop_id or stop_id in seen_stop_ids:
                continue
            key = (
                (student.get("first_name") or "").strip().lower(),
                (student.get("last_name") or "").strip().lower(),
            )
            dest = unambiguous.get(key)
            if not dest:
                continue
            seen_stop_ids.add(stop_id)
            to_rename.append({"stop_id": stop_id, "name": dest})

        print(
            f"Stops eligible for rename (currently 'Pickup point', unambiguous match): {len(to_rename)}"
        )

        if not APPLY:
            for item in to_rename[:10]:
                print("  [dry-run]", item)
            print(f"\nDry run only -- set MODE=--apply to write {len(to_rename)} renames.")
            browser.close()
            return

        ok = 0
        failed = 0
        fail_samples = []
        for item in to_rename:
            result = page.evaluate(
                """async ({stopId, name}) => {
                    const res = await fetch(`/api/stops/${stopId}`, {
                        method: 'PATCH',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ name })
                    });
                    return { status: res.status, ok: res.ok };
                }""",
                {"stopId": item["stop_id"], "name": item["name"]},
            )
            if result["ok"]:
                ok += 1
            else:
                failed += 1
                if len(fail_samples) < 10:
                    fail_samples.append({**item, "status": result["status"]})

        print(f"\nDone. {ok} renamed, {failed} failed.")
        if fail_samples:
            print("Failures:", json.dumps(fail_samples, indent=2))

        browser.close()


if __name__ == "__main__":
    main()
