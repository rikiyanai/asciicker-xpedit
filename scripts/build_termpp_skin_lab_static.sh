#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEGACY_WEB_DIR_DEFAULT="$ROOT/../asciicker-Y9-2/.web"
LEGACY_WEB_DIR="${1:-$LEGACY_WEB_DIR_DEFAULT}"
OUT_DIR="${2:-$ROOT/output/termpp-skin-lab-static}"
LEGACY_A3D_DIR_DEFAULT="$ROOT/../asciicker-Y9-2/a3d"
LEGACY_A3D_DIR="${LEGACY_A3D_DIR:-$LEGACY_A3D_DIR_DEFAULT}"

if [[ ! -d "$LEGACY_WEB_DIR" ]]; then
  echo "error: legacy webbuild dir not found: $LEGACY_WEB_DIR" >&2
  echo "usage: $(basename "$0") [legacy_web_dir] [out_dir]" >&2
  exit 1
fi

for f in index.html index.js index.wasm index.data; do
  if [[ ! -f "$LEGACY_WEB_DIR/$f" ]]; then
    echo "error: missing $LEGACY_WEB_DIR/$f" >&2
    exit 1
  fi
done

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/termpp-web"
mkdir -p "$OUT_DIR/termpp-web-flat/flatmaps"

cp "$ROOT/web/termpp_skin_lab.html" "$OUT_DIR/index.html"
cp "$ROOT/web/termpp_skin_lab.js" "$OUT_DIR/termpp_skin_lab.js"
cp -R "$LEGACY_WEB_DIR"/. "$OUT_DIR/termpp-web/"
cp -R "$LEGACY_WEB_DIR"/. "$OUT_DIR/termpp-web-flat/"
cp "$ROOT/web/termpp_flat_map_bootstrap.js" "$OUT_DIR/termpp-web-flat/flat_map_bootstrap.js"

for mapf in minimal_2x2.a3d minimal_1x1.a3d test_map.a3d test_map_no_terrain.a3d; do
  if [[ -f "$LEGACY_A3D_DIR/$mapf" ]]; then
    cp "$LEGACY_A3D_DIR/$mapf" "$OUT_DIR/termpp-web-flat/flatmaps/$mapf"
  fi
done

python3 - "$OUT_DIR/termpp-web-flat/index.html" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8", errors="ignore")
needle = "</body></html>"
inject = '<script src="flat_map_bootstrap.js"></script></body></html>'
if "flat_map_bootstrap.js" not in s:
    if needle in s:
        s = s.replace(needle, inject, 1)
    else:
        s += '<script src="flat_map_bootstrap.js"></script>'
p.write_text(s, encoding="utf-8")
PY

touch "$OUT_DIR/.nojekyll"

cat > "$OUT_DIR/README.txt" <<EOF
TERM++ Skin Lab (Static)

Contents:
- index.html                (skin lab wrapper)
- termpp_skin_lab.js        (browser-side XP injection logic)
- termpp-web/*              (legacy Asciicker webbuild bundle)
- termpp-web-flat/*         (flat-map webbuild variant + bootstrap + flatmaps/*.a3d)

Usage:
1. Host this directory on any static web server / GitHub Pages.
2. Open index.html.
3. Click "Open Webbuild".
   - Default path: ./termpp-web/index.html?solo=1&player=player
   - Flat arena path: ./termpp-web-flat/index.html?solo=1&player=player
4. Upload an .xp file and click "Apply Uploaded XP".

Notes:
- This swaps runtime sprite XP files in the browser Emscripten filesystem.
- Terrain/map comes from termpp-web/index.data.
- termpp-web-flat overrides /a3d/game_map_y8.a3d before StartGame using flatmaps/minimal_2x2.a3d.
- You can choose another bundled test map via query param, e.g. &flatmap=minimal_1x1.a3d
- No backend is required for previewing an already-generated XP.
EOF

echo "Built static TERM++ Skin Lab:"
echo "  $OUT_DIR"
echo "Open locally with a static server (not file://) or publish the folder as a site."
