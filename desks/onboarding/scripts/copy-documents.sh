#!/usr/bin/env bash
# Copy onboarding documents into the repo for production (replaces dev symlink).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:-/home/kiki/Documents/Silverleaf Academy- Onboarding docs-20260617T093745Z-3-001/Silverleaf Academy- Onboarding docs}"
DEST="$ROOT/documents"

if [[ ! -d "$SOURCE" ]]; then
  echo "Source folder not found: $SOURCE"
  echo "Usage: $0 [path-to-onboarding-docs]"
  exit 1
fi

if [[ -L "$DEST" ]]; then
  echo "Removing symlink: $DEST"
  rm "$DEST"
elif [[ -d "$DEST" ]]; then
  echo "Backing up existing documents/ to documents.backup"
  rm -rf "$ROOT/documents.backup"
  mv "$DEST" "$ROOT/documents.backup"
fi

echo "Copying documents from:"
echo "  $SOURCE"
echo "  → $DEST"
mkdir -p "$DEST"
cp -a "$SOURCE/." "$DEST/"

COUNT=$(find "$DEST" -type f | wc -l)
echo "Done. $COUNT files copied."
