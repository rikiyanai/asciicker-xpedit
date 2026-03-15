"""
XP truth table extractor with metadata-derived frame geometry.

Reads an XP file through xp_core, preserves all layers, and records the
Layer-0 metadata contract used by the engine/editor:
  - angles
  - anims
  - projs
  - frame_rows
  - frame_cols
  - frame_w
  - frame_h
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "rex_mcp"))
from xp_core import XPFile  # type: ignore

MAGENTA = (255, 0, 255)


def is_transparent(glyph: int, bg: tuple[int, int, int]) -> bool:
    return glyph == 0 and bg == MAGENTA


def extract_truth_table(xp_path: str) -> dict:
    xp = XPFile(xp_path)
    meta = xp.get_metadata() or {"angles": 1, "anims": [1], "projs": 1}

    width = xp.layers[0].width if xp.layers else 0
    height = xp.layers[0].height if xp.layers else 0
    angles = max(1, int(meta.get("angles", 1)))
    anims = [max(1, int(v)) for v in (meta.get("anims") or [1])]
    projs = max(1, int(meta.get("projs", 1)))
    semantic_frames = max(1, sum(anims))
    frame_cols = semantic_frames * projs
    frame_rows = angles
    divisible = (width % frame_cols == 0) and (height % frame_rows == 0)
    frame_w = (width // frame_cols) if divisible and frame_cols > 0 else None
    frame_h = (height // frame_rows) if divisible and frame_rows > 0 else None

    layers_out = []
    for layer_idx, layer in enumerate(xp.layers):
        cells = []
        non_transparent = 0
        for y in range(layer.height):
            for x in range(layer.width):
                glyph, fg, bg = layer.data[y][x]
                g = int(glyph)
                f = [int(fg[0]), int(fg[1]), int(fg[2])]
                b = [int(bg[0]), int(bg[1]), int(bg[2])]
                cells.append({"x": x, "y": y, "glyph": g, "fg": f, "bg": b})
                if not is_transparent(g, (b[0], b[1], b[2])):
                    non_transparent += 1
        layers_out.append(
            {
                "index": layer_idx,
                "width": layer.width,
                "height": layer.height,
                "editable": layer_idx == 2,
                "cell_count": len(cells),
                "non_transparent_count": non_transparent,
                "cells": cells,
            }
        )

    return {
        "source": os.path.basename(xp_path),
        "source_path": str(Path(xp_path).resolve()),
        "width": width,
        "height": height,
        "layer_count": len(xp.layers),
        "metadata": {
            "angles": angles,
            "anims": anims,
            "projs": projs,
            "semantic_frames": semantic_frames,
            "frame_rows": frame_rows,
            "frame_cols": frame_cols,
            "frame_w": frame_w,
            "frame_h": frame_h,
            "geometry_exact_division": divisible,
        },
        "layer_roles": {
            "0": "metadata",
            "1": "height",
            "2": "visual",
            "3_plus": "overlay",
        },
        "layers": layers_out,
    }


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print("Usage: python3 truth_table.py <xp_file> [--output <json_path>]", file=sys.stderr)
        raise SystemExit(1)

    xp_path = args[0]
    output_path = None
    if "--output" in args:
        idx = args.index("--output")
        output_path = args[idx + 1]

    table = extract_truth_table(xp_path)
    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(table, indent=2), encoding="utf-8")
        meta = table["metadata"]
        print(
            f"Truth table: {table['source']}, {table['layer_count']} layers, "
            f"{table['width']}x{table['height']}, "
            f"angles={meta['angles']} anims={meta['anims']} projs={meta['projs']}",
            file=sys.stderr,
        )
    else:
        json.dump(table, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
