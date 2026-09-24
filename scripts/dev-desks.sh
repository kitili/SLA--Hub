#!/usr/bin/env bash
# Start synced desks on their unique local ports. Hosted-only desks (MEL) are skipped.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 - <<'PY'
import json, os, signal, subprocess, sys, time
from pathlib import Path

root = Path(".").resolve()
desks = json.loads((root / "desks.json").read_text())["desks"]
children = []

def start(desk):
    if desk.get("inHub"):
        return
    dest = root / desk["path"]
    cwd = dest / desk.get("cwd", ".")
    if not cwd.exists():
        print(f"skip {desk['id']}: {cwd} missing — run npm run desks:sync", file=sys.stderr)
        return
    if not (cwd / "package.json").exists():
        print(f"skip {desk['id']}: no package.json in {cwd}", file=sys.stderr)
        return
    if not (cwd / "node_modules").exists():
        print(f"install {desk['id']}…")
        subprocess.check_call(["npm", "install"], cwd=cwd)
    cmd = desk.get("dev") or f"npx next dev --port {desk['port']}"
    print(f"start {desk['id']}  http://localhost:{desk['port']}")
    proc = subprocess.Popen(cmd, cwd=cwd, shell=True)
    children.append(proc)

for desk in desks:
    start(desk)

if not children:
    print("No desks to start.", file=sys.stderr)
    sys.exit(1)

def stop(*_):
    for proc in children:
        if proc.poll() is None:
            proc.terminate()
    for proc in children:
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
    sys.exit(0)

signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)

while True:
    alive = [p for p in children if p.poll() is None]
    if not alive:
        codes = [p.returncode for p in children]
        sys.exit(1 if any(codes) else 0)
    time.sleep(1)
PY
