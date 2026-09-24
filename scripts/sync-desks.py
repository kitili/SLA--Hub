#!/usr/bin/env python3
"""Clone or fast-forward each department repo into desks/ to match origin."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "desks.json"
LOCK_PATH = ROOT / "desks.lock.json"


def run(
    args: list[str],
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("GIT_TERMINAL_PROMPT", "0")
    return subprocess.run(
        args,
        cwd=cwd,
        check=check,
        text=True,
        capture_output=True,
        env=env,
    )


def git_ok(args: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return run(["git", *args], cwd=cwd, check=False)


def load_config() -> list[dict]:
    return json.loads(CONFIG_PATH.read_text())["desks"]


def current_sha(path: Path) -> str | None:
    result = git_ok(["rev-parse", "HEAD"], cwd=path)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def dirty(path: Path) -> bool:
    result = git_ok(["status", "--porcelain"], cwd=path)
    return bool(result.stdout.strip())


def is_git_repo(path: Path) -> bool:
    return (path / ".git").exists()


def copy_fallback(fallback: Path, dest: Path) -> None:
    shutil.copytree(
        fallback,
        dest,
        ignore=shutil.ignore_patterns(
            "node_modules",
            ".next",
            ".pglite",
            ".git",
            "dist",
            ".vercel",
        ),
    )


def clone_desk(desk: dict, dest: Path) -> tuple[str, str | None]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return "exists", None

    attempts: list[list[str]] = [
        ["git", "clone", "--branch", desk["branch"], "--single-branch", desk["repo"], str(dest)],
    ]
    fallback = desk.get("fallback")
    fallback_path = Path(fallback) if fallback else None
    if fallback_path and fallback_path.exists() and is_git_repo(fallback_path):
        attempts.append(
            [
                "git",
                "clone",
                "--branch",
                desk["branch"],
                "--single-branch",
                str(fallback_path),
                str(dest),
            ]
        )

    errors: list[str] = []
    for command in attempts:
        result = run(command, check=False)
        if result.returncode == 0:
            git_ok(["remote", "set-url", "origin", desk["repo"]], cwd=dest)
            return "cloned", None
        errors.append(result.stderr.strip() or result.stdout.strip())

    if fallback_path and fallback_path.exists():
        copy_fallback(fallback_path, dest)
        return "copied", None

    return "clone-failed", (errors[0] if errors else "missing fallback").splitlines()[0][:200]


def update_desk(desk: dict, dest: Path, force: bool) -> tuple[str, str | None]:
    if not is_git_repo(dest):
        return "copied", None
    git_ok(["remote", "set-url", "origin", desk["repo"]], cwd=dest)
    fetched = git_ok(["fetch", "origin", desk["branch"]], cwd=dest)
    if fetched.returncode != 0:
        fallback = desk.get("fallback")
        if fallback and Path(fallback).exists():
            git_ok(["remote", "add", "local-src", fallback], cwd=dest)
            git_ok(["remote", "set-url", "local-src", fallback], cwd=dest)
            fetched = git_ok(["fetch", "local-src", desk["branch"]], cwd=dest)
            if fetched.returncode != 0:
                return "fetch-failed", fetched.stderr.strip() or fetched.stdout.strip()
            target = f"local-src/{desk['branch']}"
        else:
            return "fetch-failed", fetched.stderr.strip() or fetched.stdout.strip()
    else:
        target = f"origin/{desk['branch']}"

    if dirty(dest) and not force:
        return "dirty", "uncommitted changes — skip (pass --force to reset)"

    if force and dirty(dest):
        run(["git", "reset", "--hard", "HEAD"], cwd=dest)
        run(["git", "clean", "-fd"], cwd=dest)

    checkout = git_ok(["checkout", desk["branch"]], cwd=dest)
    if checkout.returncode != 0:
        git_ok(["checkout", "-B", desk["branch"], target], cwd=dest)
    else:
        pull = git_ok(["merge", "--ff-only", target], cwd=dest)
        if pull.returncode != 0:
            if force:
                run(["git", "reset", "--hard", target], cwd=dest)
            else:
                return "diverged", pull.stderr.strip() or pull.stdout.strip()
    return "updated", None


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync department repos into desks/")
    parser.add_argument("--force", action="store_true", help="discard local desk changes")
    parser.add_argument("--status", action="store_true", help="print SHAs only")
    args = parser.parse_args()

    desks = load_config()
    lock: dict[str, dict] = {}
    failed = False

    print(f"Silverleaf desks  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print()

    for desk in desks:
        dest = ROOT / desk["path"]
        before = current_sha(dest) if dest.exists() else None
        action = "status"

        if desk.get("skipSync"):
            print(f"  {desk['id']:12}  hosted        live-only     :{desk['port']}")
            lock[desk["id"]] = {
                "repo": desk.get("repo", ""),
                "branch": desk.get("branch", "main"),
                "sha": None,
                "path": desk.get("path", ""),
                "port": desk["port"],
                "liveUrl": desk["liveUrl"],
                "status": "hosted",
                "syncedAt": datetime.now(timezone.utc).isoformat(),
            }
            continue

        if not args.status:
            if not dest.exists():
                action, error = clone_desk(desk, dest)
                if error:
                    print(f"  {desk['id']:12}  {action:12}  {error[:120]}")
                    failed = True
                    lock[desk["id"]] = {
                        "repo": desk["repo"],
                        "branch": desk["branch"],
                        "sha": None,
                        "status": action,
                    }
                    continue
            action, error = update_desk(desk, dest, force=args.force)
            if error:
                print(f"  {desk['id']:12}  {action:12}  {error.splitlines()[0][:120]}")
                failed = action in {"fetch-failed", "diverged"}
                lock[desk["id"]] = {
                    "repo": desk["repo"],
                    "branch": desk["branch"],
                    "sha": before or current_sha(dest),
                    "status": action,
                }
                continue

        after = current_sha(dest)
        short = (after or "local")[:7]
        print(f"  {desk['id']:12}  {action:12}  {desk['branch']:12}  {short}  :{desk['port']}")
        lock[desk["id"]] = {
            "repo": desk["repo"],
            "branch": desk["branch"],
            "sha": after,
            "path": desk["path"],
            "port": desk["port"],
            "liveUrl": desk["liveUrl"],
            "status": action,
            "syncedAt": datetime.now(timezone.utc).isoformat(),
        }

        if not args.status and desk.get("syncData") and dest.exists():
            data_result = run(
                [sys.executable, str(ROOT / "scripts" / "sync-visitor-data.py"), "--quiet", "--json"],
                check=False,
            )
            if data_result.returncode == 0:
                try:
                    payload = json.loads(data_result.stdout.strip().splitlines()[-1])
                    lock[desk["id"]]["visits"] = payload.get("visits")
                    lock[desk["id"]]["photos"] = payload.get("photos")
                    print(
                        f"  {desk['id']:12}  data          {payload.get('visits', 0)} visits  "
                        f"{payload.get('photos', 0)} photos"
                    )
                except json.JSONDecodeError:
                    print(f"  {desk['id']:12}  data          synced")
            else:
                err = (data_result.stderr or data_result.stdout or "visitor data sync failed").splitlines()
                print(f"  {desk['id']:12}  data-failed   {err[0][:120] if err else 'visitor data sync failed'}")
                failed = True

    if not args.status:
        LOCK_PATH.write_text(json.dumps({"syncedAt": datetime.now(timezone.utc).isoformat(), "desks": lock}, indent=2) + "\n")
        print()
        print(f"Wrote {LOCK_PATH.relative_to(ROOT)}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
