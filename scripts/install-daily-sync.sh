#!/usr/bin/env bash
# Install a daily 06:00 crontab entry that pulls every desk into this workspace.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="silverleaf-hub desks:sync"
VISITOR_MARKER="silverleaf-hub visitors:sync"
LINE="0 6 * * * cd \"$ROOT\" && /usr/bin/python3 \"$ROOT/scripts/sync-desks.py\" >> \"$ROOT/.desks-sync.log\" 2>&1  # $MARKER"
VISITOR_LINE="*/5 * * * * cd \"$ROOT\" && /usr/bin/python3 \"$ROOT/scripts/sync-visitor-data.py\" >> \"$ROOT/.desks-sync.log\" 2>&1  # $VISITOR_MARKER"

existing="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$existing" | grep -v "$MARKER" | grep -v "$VISITOR_MARKER" || true)"
printf '%s\n%s\n%s\n' "$filtered" "$LINE" "$VISITOR_LINE" | crontab -
echo "Daily desk sync installed (06:00)."
echo "Visitor sign-in data sync installed (every 5 minutes)."
echo "Run now: npm run desks:sync && npm run visitors:sync"
crontab -l | grep -E "$MARKER|$VISITOR_MARKER"
