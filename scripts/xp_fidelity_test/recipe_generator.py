"""
Generate a frame-aware layer-2 repaint recipe from a truth table.

This generator does not flatten geometry. It derives frame rows/cols from the
truth table metadata parsed from Layer 0.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

POST_CLEAR_CELL = (0, [0, 0, 0], [255, 0, 255])

REQUIRED_SELECTORS = {
    "frame_cell": ".frame-cell[data-row][data-col]",
    "session_out": "#sessionOut",
    "meta_out": "#metaOut",
    "layer_select": "#layerSelect",
    "inspector_panel": "#cellInspectorPanel",
    "tool_glyph_btn": "#inspectorToolGlyphBtn",
    "glyph_code_input": "#inspectorGlyphCode",
    "fg_color_input": "#inspectorGlyphFgColor",
    "bg_color_input": "#inspectorGlyphBgColor",
    "clear_frame_btn": "#inspectorClearFrameBtn",
    "zoom_input": "#inspectorZoom",
    "inspector_canvas": "#cellInspectorCanvas",
    "export_btn": "#btnExport",
    "export_output": "#exportOut",
}


def rgb_to_hex(rgb: list[int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _group_frame_cells(layer2_cells, frame_w: int, frame_h: int):
    frames = defaultdict(list)
    for cell in layer2_cells:
        x = int(cell["x"])
        y = int(cell["y"])
        frame_col = x // frame_w
        frame_row = y // frame_h
        local_x = x % frame_w
        local_y = y % frame_h
        frames[(frame_row, frame_col)].append((local_x, local_y, cell))
    return frames


def generate_recipe(truth_table: dict) -> dict:
    meta = truth_table.get("metadata") or {}
    frame_w = meta.get("frame_w")
    frame_h = meta.get("frame_h")
    frame_rows = int(meta.get("frame_rows", 1))
    frame_cols = int(meta.get("frame_cols", 1))
    if not meta.get("geometry_exact_division") or not frame_w or not frame_h:
        return {
            "ok": False,
            "error": "XP geometry does not divide cleanly into metadata-derived frame rows/cols",
        }

    if truth_table.get("layer_count", 0) < 3:
        return {"ok": False, "error": "XP must contain at least three layers"}

    layer2 = next((layer for layer in truth_table["layers"] if int(layer["index"]) == 2), None)
    if layer2 is None:
        return {"ok": False, "error": "Layer 2 not found"}

    frames = _group_frame_cells(layer2["cells"], int(frame_w), int(frame_h))
    actions = [
        {
            "action": "wait_visible",
            "selector": "#sessionOut",
            "timeout_ms": 5000,
        }
    ]

    total_paint_cells = 0
    for frame_row in range(frame_rows):
        for frame_col in range(frame_cols):
            actions.append(
                {
                    "action": "open_frame",
                    "frame_row": frame_row,
                    "frame_col": frame_col,
                    "selector": f".frame-cell[data-row='{frame_row}'][data-col='{frame_col}']",
                    "interaction": "dblclick",
                }
            )
            actions.append({"action": "wait_visible", "selector": "#cellInspectorPanel", "timeout_ms": 2000})
            actions.append({"action": "select_layer", "selector": "#layerSelect", "value": "2"})
            actions.append({"action": "select_tool", "selector": "#inspectorToolGlyphBtn"})
            actions.append({"action": "clear_frame", "selector": "#inspectorClearFrameBtn"})

            brush_groups = defaultdict(list)
            for local_x, local_y, cell in frames.get((frame_row, frame_col), []):
                if (
                    cell["glyph"] == POST_CLEAR_CELL[0]
                    and cell["fg"] == POST_CLEAR_CELL[1]
                    and cell["bg"] == POST_CLEAR_CELL[2]
                ):
                    continue
                key = (
                    int(cell["glyph"]),
                    tuple(cell["fg"]),
                    tuple(cell["bg"]),
                )
                brush_groups[key].append((local_x, local_y))

            for (glyph, fg, bg), coords in sorted(brush_groups.items(), key=lambda item: (-len(item[1]), item[0][0])):
                actions.append({"action": "set_glyph_code", "selector": "#inspectorGlyphCode", "value": str(glyph)})
                actions.append({"action": "set_fg_color", "selector": "#inspectorGlyphFgColor", "value": rgb_to_hex(list(fg))})
                actions.append({"action": "set_bg_color", "selector": "#inspectorGlyphBgColor", "value": rgb_to_hex(list(bg))})
                for local_x, local_y in sorted(coords, key=lambda p: (p[1], p[0])):
                    total_paint_cells += 1
                    actions.append(
                        {
                            "action": "paint_cell",
                            "selector": "#cellInspectorCanvas",
                            "cx": local_x,
                            "cy": local_y,
                        }
                    )

    return {
        "ok": True,
        "source": truth_table["source"],
        "required_selectors": REQUIRED_SELECTORS,
        "geometry": {
            "angles": int(meta["angles"]),
            "anims": list(meta["anims"]),
            "projs": int(meta["projs"]),
            "frame_rows": frame_rows,
            "frame_cols": frame_cols,
            "frame_w": int(frame_w),
            "frame_h": int(frame_h),
        },
        "editable_layer": 2,
        "preserved_only_layers": [layer["index"] for layer in truth_table["layers"] if int(layer["index"]) != 2],
        "actions": actions,
        "stats": {
            "frames": frame_rows * frame_cols,
            "paint_cells": total_paint_cells,
            "actions": len(actions),
        },
    }


def main() -> None:
    args = sys.argv[1:]
    if "--truth-table" not in args:
        print("Usage: python3 recipe_generator.py --truth-table <json> [--output <json>]", file=sys.stderr)
        raise SystemExit(1)
    tt_path = args[args.index("--truth-table") + 1]
    out_path = args[args.index("--output") + 1] if "--output" in args else None

    truth_table = json.loads(Path(tt_path).read_text(encoding="utf-8"))
    recipe = generate_recipe(truth_table)
    if out_path:
        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(recipe, indent=2), encoding="utf-8")
    if recipe.get("ok"):
        print(
            f"Recipe: frames={recipe['stats']['frames']} paint_cells={recipe['stats']['paint_cells']} "
            f"actions={recipe['stats']['actions']}",
            file=sys.stderr,
        )
    else:
        print(f"ABORT: {recipe['error']}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
