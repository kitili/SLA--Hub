#!/usr/bin/env bash
# Loss-aware compression: smaller files, same readable content (high-quality presets).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="${1:-$ROOT/documents}"

if [[ ! -d "$DOCS" ]]; then
  echo "Documents folder not found: $DOCS"
  exit 1
fi

replace_if_smaller() {
  local src="$1" tmp="$2"
  if [[ -f "$tmp" ]]; then
    local before after
    before=$(stat -c%s "$src")
    after=$(stat -c%s "$tmp")
    if (( after < before )); then
      mv "$tmp" "$src"
      echo "  $(basename "$src"): $((before / 1024))KB → $((after / 1024))KB"
      return 0
    fi
    rm -f "$tmp"
  fi
  return 1
}

compress_pdf() {
  local f="$1" tmp="${f}.compressing.pdf"
  gs -sDEVICE=pdfwrite \
    -dCompatibilityLevel=1.4 \
    -dPDFSETTINGS=/prepress \
    -dNOPAUSE -dQUIET -dBATCH \
    -sOutputFile="$tmp" "$f" 2>/dev/null || { rm -f "$tmp"; return; }
  replace_if_smaller "$f" "$tmp" || true
}

compress_eps() {
  local f="$1" tmp="${f}.compressing.eps"
  gs -sDEVICE=eps2write -dEPSCrop -dNOPAUSE -dBATCH \
    -sOutputFile="$tmp" "$f" 2>/dev/null || { rm -f "$tmp"; return; }
  replace_if_smaller "$f" "$tmp" || true
}

compress_images() {
  python3 - "$DOCS" <<'PY'
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit(0)

root = Path(sys.argv[1])
for path in sorted(root.rglob("*")):
    if not path.is_file():
        continue
    ext = path.suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png"}:
        continue
    before = path.stat().st_size
    try:
        with Image.open(path) as img:
            if ext in {".jpg", ".jpeg"}:
                img.save(path, format="JPEG", quality=92, optimize=True, progressive=True)
            else:
                img.save(path, format="PNG", optimize=True, compress_level=9)
    except Exception:
        continue
    after = path.stat().st_size
    if after < before:
        print(f"  {path.name}: {before // 1024}KB → {after // 1024}KB")
PY
}

compress_videos() {
  local ffmpeg
  ffmpeg="$(command -v ffmpeg || true)"
  [[ -x "$HOME/.local/bin/ffmpeg" ]] && ffmpeg="$HOME/.local/bin/ffmpeg"
  [[ -n "$ffmpeg" ]] || return 0

  while IFS= read -r -d '' f; do
    local tmp="${f}.compressing.mp4"
    echo "Video: $(basename "$f")"
    "$ffmpeg" -y -i "$f" \
      -c:v libx264 -crf 20 -preset slow -movflags +faststart \
      -c:a aac -b:a 160k \
      "$tmp" >/dev/null 2>&1 || { rm -f "$tmp"; continue; }
    replace_if_smaller "$f" "$tmp" || true
  done < <(find "$DOCS" -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.webm' \) -print0)
}

echo "Compressing PDFs in $DOCS..."
while IFS= read -r -d '' f; do
  echo "PDF: $(basename "$f")"
  compress_pdf "$f"
done < <(find "$DOCS" -type f -iname '*.pdf' -print0)

echo "Compressing EPS print assets..."
while IFS= read -r -d '' f; do
  echo "EPS: $(basename "$f")"
  compress_eps "$f"
done < <(find "$DOCS" -type f -iname '*.eps' -print0)

echo "Optimizing JPG/PNG..."
compress_images

if [[ "${COMPRESS_VIDEOS:-0}" == "1" ]]; then
  echo "Compressing videos (local only, still gitignored)..."
  compress_videos
fi

before=$(du -sb "$DOCS" | awk '{print $1}')
echo "Done. Folder size: $((before / 1048576)) MB"
