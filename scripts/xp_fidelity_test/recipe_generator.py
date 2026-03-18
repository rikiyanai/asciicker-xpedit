"""
Generate a repaint recipe from a truth table.

Supports two modes:

  --mode diagnostic   (default) Inspector-centric frame-by-frame recipe.
                      Uses legacy inspector selectors (#cellInspectorPanel,
                      #inspectorGlyphCode, etc.).  Results are labeled
                      diagnostic and may NOT be cited as acceptance evidence.

  --mode acceptance   Whole-sheet recipe using user-reachable whole-sheet
                      editor controls (#wholeSheetCanvas, #wsGlyphCode,
                      #wsFgColor, etc.).  Only this mode produces
                      acceptance-eligible recipes.

Both modes derive frame geometry from the truth table metadata parsed from
Layer 0. Neither mode flattens geometry.

Acceptance mode strategy (area-based repaint):
  - Proof region: all cells in frame 0 (x < frame_w, y < frame_h).
  - Erase phase: ws_erase_drag row by row (one drag per row).
  - Repaint phase (per brush-state group, priority order):
      1. ws_draw_rect if the group's cells form a complete rectangle outline
         (>= 2x2, all perimeter cells present, no interior cells, no gaps).
      2. ws_draw_line for each contiguous horizontal run of length >= 2.
      3. ws_paint_cell for isolated single-cell runs.
  - The export comparison validates ALL cells (proof region + unchanged cells
    in all other frames and layers).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

POST_CLEAR_CELL = (0, [0, 0, 0], [255, 0, 255])

# ── Selector sets per mode ──

DIAGNOSTIC_SELECTORS = {
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

ACCEPTANCE_SELECTORS = {
    "session_out": "#sessionOut",
    "meta_out": "#metaOut",
    "whole_sheet_canvas": "#wholeSheetCanvas",
    "ws_glyph_code": "#wsGlyphCode",
    "ws_fg_color": "#wsFgColor",
    "ws_bg_color": "#wsBgColor",
    "ws_tool_cell": "#wsToolCell",
    "ws_tool_eyedropper": "#wsToolEyedropper",
    "ws_tool_erase": "#wsToolErase",
    "ws_tool_line": "#wsToolLine",
    "ws_tool_rect": "#wsToolRect",
    "ws_tool_fill": "#wsToolFill",
    "ws_apply_glyph": "#wsApplyGlyph",
    "ws_apply_fg": "#wsApplyFg",
    "ws_apply_bg": "#wsApplyBg",
    "export_btn": "#btnExport",
    "export_output": "#exportOut",
}

# Cell size in pixels used by the whole-sheet editor (must match whole-sheet-init.js CELL_SIZE)
WS_CELL_SIZE = 12


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


def _is_clear_cell(cell: dict) -> bool:
    return (
        cell["glyph"] == POST_CLEAR_CELL[0]
        and cell["fg"] == POST_CLEAR_CELL[1]
        and cell["bg"] == POST_CLEAR_CELL[2]
    )


# ── Area-operation helpers ──


def _find_horizontal_runs(coords: list[tuple[int, int]]) -> list[tuple[int, int, int]]:
    """Find contiguous horizontal runs from (x, y) coordinates.

    Returns list of (x1, x2, y) where x1..x2 is the inclusive column range.
    """
    by_row: dict[int, list[int]] = defaultdict(list)
    for x, y in coords:
        by_row[y].append(x)
    runs: list[tuple[int, int, int]] = []
    for row_y, xs in sorted(by_row.items()):
        xs = sorted(xs)
        start = xs[0]
        prev = xs[0]
        for x in xs[1:]:
            if x == prev + 1:
                prev = x
            else:
                runs.append((start, prev, row_y))
                start = x
                prev = x
        runs.append((start, prev, row_y))
    return runs


def _connected_components(
    coords_set: set[tuple[int, int]],
) -> list[list[tuple[int, int]]]:
    """Return 4-connected components of a set of (x, y) coords.

    Each component is sorted by (y, x) so the first element is the top-left
    seed — convenient for flood fill.
    """
    remaining = set(coords_set)
    components: list[list[tuple[int, int]]] = []
    while remaining:
        seed = min(remaining, key=lambda c: (c[1], c[0]))
        component: list[tuple[int, int]] = []
        stack = [seed]
        while stack:
            x, y = stack.pop()
            if (x, y) not in remaining:
                continue
            remaining.discard((x, y))
            component.append((x, y))
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if (nx, ny) in remaining:
                    stack.append((nx, ny))
        components.append(sorted(component, key=lambda c: (c[1], c[0])))
    return components


def _detect_rect_outline(
    coords: list[tuple[int, int]],
) -> tuple[int, int, int, int] | None:
    """Return (x, y, w, h) if coords form a complete rectangle outline, else None.

    A rectangle outline is the set of perimeter cells of an axis-aligned
    rectangle that is at least 2 cells wide and 2 cells tall:
      - top row:    (x_min..x_max, y_min)
      - bottom row: (x_min..x_max, y_max)
      - left col:   (x_min, y_min+1..y_max-1)
      - right col:  (x_max, y_min+1..y_max-1)

    The group must contain *exactly* those cells — no extras, no gaps.
    A 1×N or M×1 rectangle degenerates to a line; use ws_draw_line for those.
    """
    if len(coords) < 4:
        return None
    coord_set = set(coords)
    xs = [x for x, _ in coords]
    ys = [y for _, y in coords]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    w = x_max - x_min + 1
    h = y_max - y_min + 1
    if w < 2 or h < 2:
        return None
    # Build expected perimeter and compare
    perimeter: set[tuple[int, int]] = set()
    for x in range(x_min, x_max + 1):
        perimeter.add((x, y_min))
        perimeter.add((x, y_max))
    for y in range(y_min + 1, y_max):
        perimeter.add((x_min, y))
        perimeter.add((x_max, y))
    if coord_set == perimeter:
        return (x_min, y_min, w, h)
    return None


def _repaint_group_actions(
    coords: list[tuple[int, int]],
    current_tool: str,
) -> tuple[list[dict], str]:
    """Return (actions, new_current_tool) to repaint one brush-state group.

    Operation priority:
      1. ws_draw_rect  — if coords form a complete rectangle outline (>= 2x2).
      2. ws_draw_line  — for each contiguous horizontal run of length >= 2.
      3. ws_paint_cell — for isolated single-cell positions.

    The caller must emit ws_set_draw_state before calling this function.
    Tool-activate actions are emitted only when the active tool must change.
    """
    actions: list[dict] = []

    rect = _detect_rect_outline(coords)
    if rect is not None:
        x, y, w, h = rect
        if current_tool != "rect":
            actions.append({"action": "ws_tool_activate", "tool": "rect", "selector": "#wsToolRect"})
            current_tool = "rect"
        actions.append({
            "action": "ws_draw_rect",
            "selector": "#wholeSheetCanvas",
            "x": x, "y": y, "w": w, "h": h,
            "cell_size": WS_CELL_SIZE,
        })
        return actions, current_tool

    # Fall through to run-based approach
    for x1, x2, y in _find_horizontal_runs(coords):
        if x2 > x1:
            if current_tool != "line":
                actions.append({"action": "ws_tool_activate", "tool": "line", "selector": "#wsToolLine"})
                current_tool = "line"
            actions.append({
                "action": "ws_draw_line",
                "selector": "#wholeSheetCanvas",
                "x1": x1, "y1": y, "x2": x2, "y2": y,
                "cell_size": WS_CELL_SIZE,
            })
        else:
            if current_tool != "cell":
                actions.append({"action": "ws_tool_activate", "tool": "cell", "selector": "#wsToolCell"})
                current_tool = "cell"
            actions.append({
                "action": "ws_paint_cell",
                "selector": "#wholeSheetCanvas",
                "x": x1, "y": y,
                "cell_size": WS_CELL_SIZE,
            })

    return actions, current_tool


# ── Diagnostic mode (inspector-centric) ──


def _generate_diagnostic_recipe(truth_table: dict, meta: dict) -> dict:
    """Original inspector-centric recipe. Results labeled diagnostic."""
    frame_w = int(meta["frame_w"])
    frame_h = int(meta["frame_h"])
    frame_rows = int(meta.get("frame_rows", 1))
    frame_cols = int(meta.get("frame_cols", 1))

    layer2 = next((l for l in truth_table["layers"] if int(l["index"]) == 2), None)
    if layer2 is None:
        return {"ok": False, "error": "Layer 2 not found"}

    frames = _group_frame_cells(layer2["cells"], frame_w, frame_h)
    actions: list[dict] = [
        {"action": "wait_visible", "selector": "#sessionOut", "timeout_ms": 5000},
    ]

    total_paint_cells = 0
    for frame_row in range(frame_rows):
        for frame_col in range(frame_cols):
            actions.append({
                "action": "open_frame",
                "frame_row": frame_row,
                "frame_col": frame_col,
                "selector": f".frame-cell[data-row='{frame_row}'][data-col='{frame_col}']",
                "interaction": "dblclick",
            })
            actions.append({"action": "wait_visible", "selector": "#cellInspectorPanel", "timeout_ms": 2000})
            actions.append({"action": "select_layer", "selector": "#layerSelect", "value": "2"})
            actions.append({"action": "select_tool", "selector": "#inspectorToolGlyphBtn"})
            actions.append({"action": "clear_frame", "selector": "#inspectorClearFrameBtn"})

            brush_groups: dict[tuple, list] = defaultdict(list)
            for local_x, local_y, cell in frames.get((frame_row, frame_col), []):
                if _is_clear_cell(cell):
                    continue
                key = (int(cell["glyph"]), tuple(cell["fg"]), tuple(cell["bg"]))
                brush_groups[key].append((local_x, local_y))

            for (glyph, fg, bg), coords in sorted(brush_groups.items(), key=lambda item: (-len(item[1]), item[0][0])):
                actions.append({"action": "set_glyph_code", "selector": "#inspectorGlyphCode", "value": str(glyph)})
                actions.append({"action": "set_fg_color", "selector": "#inspectorGlyphFgColor", "value": rgb_to_hex(list(fg))})
                actions.append({"action": "set_bg_color", "selector": "#inspectorGlyphBgColor", "value": rgb_to_hex(list(bg))})
                for local_x, local_y in sorted(coords, key=lambda p: (p[1], p[0])):
                    total_paint_cells += 1
                    actions.append({
                        "action": "paint_cell",
                        "selector": "#cellInspectorCanvas",
                        "cx": local_x,
                        "cy": local_y,
                    })

    return {
        "ok": True,
        "mode": "diagnostic",
        "source": truth_table["source"],
        "required_selectors": DIAGNOSTIC_SELECTORS,
        "geometry": {
            "angles": int(meta["angles"]),
            "anims": list(meta["anims"]),
            "projs": int(meta["projs"]),
            "frame_rows": frame_rows,
            "frame_cols": frame_cols,
            "frame_w": frame_w,
            "frame_h": frame_h,
        },
        "editable_layer": 2,
        "preserved_only_layers": [l["index"] for l in truth_table["layers"] if int(l["index"]) != 2],
        "actions": actions,
        "stats": {
            "frames": frame_rows * frame_cols,
            "paint_cells": total_paint_cells,
            "actions": len(actions),
        },
    }


# ── Acceptance mode (whole-sheet, area-based) ──


def _generate_acceptance_recipe(truth_table: dict, meta: dict) -> dict:
    """Whole-sheet acceptance recipe using area-based operations.

    After XP import, cells are already loaded correctly from the source file.
    The recipe exercises real editing tools by erasing and repainting frame 0:

      Erase phase:
        ws_erase_drag across each row of frame 0 (realistic drag-erase).

      Repaint phase, per brush-state group:
        ws_draw_rect if coords form a complete rectangle outline (>= 2x2).
        ws_draw_line for contiguous horizontal runs of length >= 2.
        ws_paint_cell for isolated single-cell runs.

    The export comparison validates ALL cells — both the repainted proof region
    and the untouched cells in other frames (which must match because import
    loaded them correctly).
    """
    layer2 = next((l for l in truth_table["layers"] if int(l["index"]) == 2), None)
    if layer2 is None:
        return {"ok": False, "error": "Layer 2 not found"}

    frame_w = int(meta["frame_w"])
    frame_h = int(meta["frame_h"])

    # Proof region: all cells in frame 0 (x < frame_w, y < frame_h)
    frame0_cells = [
        c for c in layer2["cells"]
        if int(c["x"]) < frame_w and int(c["y"]) < frame_h
    ]

    actions: list[dict] = [
        {"action": "wait_visible", "selector": "#sessionOut", "timeout_ms": 5000},
        {"action": "wait_visible", "selector": "#wholeSheetCanvas", "timeout_ms": 10000},
        {"action": "ws_ensure_apply", "channel": "glyph", "selector": "#wsApplyGlyph", "state": True},
        {"action": "ws_ensure_apply", "channel": "fg",    "selector": "#wsApplyFg",    "state": True},
        {"action": "ws_ensure_apply", "channel": "bg",    "selector": "#wsApplyBg",    "state": True},
    ]

    # Tool presence verification (all 6 tools).
    for tool_name, tool_sel in [
        ("cell",        "#wsToolCell"),
        ("eyedropper",  "#wsToolEyedropper"),
        ("erase",       "#wsToolErase"),
        ("line",        "#wsToolLine"),
        ("rect",        "#wsToolRect"),
        ("fill",        "#wsToolFill"),
    ]:
        actions.append({"action": "ws_tool_activate", "tool": tool_name, "selector": tool_sel})

    # Eyedropper sample on the first cell of the proof region (verifies tool response)
    if frame0_cells:
        probe = frame0_cells[0]
        probe_x, probe_y = int(probe["x"]), int(probe["y"])
        glyph_p, fg_p, bg_p = int(probe["glyph"]), probe["fg"], probe["bg"]
        actions.append({"action": "ws_tool_activate", "tool": "eyedropper", "selector": "#wsToolEyedropper"})
        actions.append({
            "action": "ws_eyedropper_sample",
            "selector": "#wholeSheetCanvas",
            "x": probe_x, "y": probe_y, "cell_size": WS_CELL_SIZE,
            "expected_glyph": glyph_p,
            "expected_fg": rgb_to_hex(fg_p),
            "expected_bg": rgb_to_hex(bg_p),
        })

    # ── Erase phase: row-by-row drag erase across frame 0 ──
    actions.append({"action": "ws_tool_activate", "tool": "erase", "selector": "#wsToolErase"})
    for row in range(frame_h):
        actions.append({
            "action": "ws_erase_drag",
            "selector": "#wholeSheetCanvas",
            "x1": 0, "y1": row, "x2": frame_w - 1, "y2": row,
            "cell_size": WS_CELL_SIZE,
        })

    # ── Repaint phase ──
    # Group proof cells by brush state (glyph, fg, bg)
    by_brush: dict[tuple, list[tuple[int, int]]] = defaultdict(list)
    for c in frame0_cells:
        key = (int(c["glyph"]), tuple(c["fg"]), tuple(c["bg"]))
        by_brush[key].append((int(c["x"]), int(c["y"])))

    sorted_groups = sorted(by_brush.items(), key=lambda x: len(x[1]))

    # Track current active tool to minimise redundant ws_tool_activate calls.
    current_tool = "erase"  # last tool from the erase phase

    # --- Repaint all groups via rect/line/cell operations ---
    for (glyph, fg, bg), coords in sorted_groups:
        if not coords:
            continue
        actions.append({
            "action": "ws_set_draw_state",
            "glyph": glyph,
            "fg": rgb_to_hex(list(fg)),
            "bg": rgb_to_hex(list(bg)),
            "glyph_selector": "#wsGlyphCode",
            "fg_selector":    "#wsFgColor",
            "bg_selector":    "#wsBgColor",
        })
        group_actions, current_tool = _repaint_group_actions(coords, current_tool)
        actions.extend(group_actions)

    # Tally action types for the stats block
    paint_cells  = sum(1 for a in actions if a["action"] == "ws_paint_cell")
    draw_lines   = sum(1 for a in actions if a["action"] == "ws_draw_line")
    draw_rects   = sum(1 for a in actions if a["action"] == "ws_draw_rect")
    flood_fills  = sum(1 for a in actions if a["action"] == "ws_flood_fill")
    erase_drags  = sum(1 for a in actions if a["action"] == "ws_erase_drag")

    return {
        "ok": True,
        "mode": "acceptance",
        "source": truth_table["source"],
        "required_selectors": ACCEPTANCE_SELECTORS,
        "geometry": {
            "angles":     int(meta["angles"]),
            "anims":      list(meta["anims"]),
            "projs":      int(meta["projs"]),
            "frame_rows": int(meta.get("frame_rows", 1)),
            "frame_cols": int(meta.get("frame_cols", 1)),
            "frame_w":    frame_w,
            "frame_h":    frame_h,
        },
        "editable_layer": 2,
        "preserved_only_layers": [l["index"] for l in truth_table["layers"] if int(l["index"]) != 2],
        "proof_region": {
            "cells_total": len(frame0_cells),
            "from_frame": "0,0",
            "strategy": "area_based_repaint",
        },
        "tool_exercise": {
            "tools_exercised": ["cell", "eyedropper", "erase", "line", "rect", "fill"],
            "ws_erase_drag":  erase_drags,
            "ws_draw_line":   draw_lines,
            "ws_draw_rect":   draw_rects,
            "ws_flood_fill":  flood_fills,
            "ws_paint_cell":  paint_cells,
        },
        "actions": actions,
        "stats": {
            "proof_cells": len(frame0_cells),
            "paint_cells": paint_cells,
            "draw_lines":  draw_lines,
            "draw_rects":  draw_rects,
            "flood_fills": flood_fills,
            "erase_drags": erase_drags,
            "actions":     len(actions),
        },
    }


# ── Public entry point ──


def generate_recipe(truth_table: dict, *, mode: str = "diagnostic") -> dict:
    meta = truth_table.get("metadata") or {}
    frame_w = meta.get("frame_w")
    frame_h = meta.get("frame_h")
    if not meta.get("geometry_exact_division") or not frame_w or not frame_h:
        return {
            "ok": False,
            "error": "XP geometry does not divide cleanly into metadata-derived frame rows/cols",
        }

    if truth_table.get("layer_count", 0) < 3:
        return {"ok": False, "error": "XP must contain at least three layers"}

    if mode == "acceptance":
        return _generate_acceptance_recipe(truth_table, meta)
    elif mode == "diagnostic":
        return _generate_diagnostic_recipe(truth_table, meta)
    else:
        return {"ok": False, "error": f"Unknown mode: {mode!r}. Use 'acceptance' or 'diagnostic'."}


def main() -> None:
    args = sys.argv[1:]
    if "--truth-table" not in args:
        print(
            "Usage: python3 recipe_generator.py --truth-table <json> [--output <json>] [--mode acceptance|diagnostic]",
            file=sys.stderr,
        )
        raise SystemExit(1)
    tt_path = args[args.index("--truth-table") + 1]
    out_path = args[args.index("--output") + 1] if "--output" in args else None
    mode = args[args.index("--mode") + 1] if "--mode" in args else "diagnostic"

    truth_table = json.loads(Path(tt_path).read_text(encoding="utf-8"))
    recipe = generate_recipe(truth_table, mode=mode)
    if out_path:
        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(recipe, indent=2), encoding="utf-8")
    if recipe.get("ok"):
        stats = recipe["stats"]
        if mode == "acceptance":
            print(
                f"Recipe [{mode}]: proof_cells={stats['proof_cells']}"
                f" erase_drags={stats['erase_drags']}"
                f" draw_lines={stats['draw_lines']}"
                f" draw_rects={stats['draw_rects']}"
                f" flood_fills={stats['flood_fills']}"
                f" paint_cells={stats['paint_cells']}"
                f" actions={stats['actions']}",
                file=sys.stderr,
            )
        else:
            print(
                f"Recipe [{mode}]: paint_cells={stats['paint_cells']}"
                f" actions={stats['actions']}",
                file=sys.stderr,
            )
    else:
        print(f"ABORT: {recipe['error']}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
