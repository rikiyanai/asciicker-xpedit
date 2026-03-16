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


# ── Acceptance mode (whole-sheet) ──


def _generate_acceptance_recipe(truth_table: dict, meta: dict) -> dict:
    """Whole-sheet recipe using only user-reachable whole-sheet editor controls.

    Exercises all shipped whole-sheet tools (cell draw, eyedropper, erase) and
    tool switching.  Paints cells at global (x,y) on #wholeSheetCanvas.  Does
    NOT open the inspector or use any inspector-only controls.

    Tool exercise strategy:
      1. Paint a small sample of cells with the Cell tool
      2. Switch to Eyedropper, sample one of the painted cells
      3. Switch to Erase, erase one cell
      4. Switch back to Cell, repaint the erased cell
      5. Continue painting the remaining cells
    This exercises every shipped whole-sheet tool and every tool switch path.
    """
    layer2 = next((l for l in truth_table["layers"] if int(l["index"]) == 2), None)
    if layer2 is None:
        return {"ok": False, "error": "Layer 2 not found"}

    actions: list[dict] = [
        {"action": "wait_visible", "selector": "#sessionOut", "timeout_ms": 5000},
        # Wait for the whole-sheet editor to be mounted
        {"action": "wait_visible", "selector": "#wholeSheetCanvas", "timeout_ms": 10000},
        # Activate the cell draw tool
        {"action": "ws_tool_activate", "tool": "cell", "selector": "#wsToolCell"},
        # Ensure all apply modes are on for full-cell painting
        {"action": "ws_ensure_apply", "channel": "glyph", "selector": "#wsApplyGlyph", "state": True},
        {"action": "ws_ensure_apply", "channel": "fg", "selector": "#wsApplyFg", "state": True},
        {"action": "ws_ensure_apply", "channel": "bg", "selector": "#wsApplyBg", "state": True},
    ]

    # Group non-transparent L2 cells by brush state (glyph, fg, bg)
    brush_groups: dict[tuple, list] = defaultdict(list)
    for cell in layer2["cells"]:
        if _is_clear_cell(cell):
            continue
        key = (int(cell["glyph"]), tuple(cell["fg"]), tuple(cell["bg"]))
        brush_groups[key].append((int(cell["x"]), int(cell["y"])))

    # Sort brush groups for deterministic order — largest groups first
    sorted_groups = sorted(brush_groups.items(), key=lambda item: (-len(item[1]), item[0][0]))

    total_paint_cells = 0
    tool_exercise_done = False
    # We'll inject tool exercise after painting the first brush group's first cell
    eyedropper_target = None  # (x, y) of a cell we painted, to sample later
    erase_target = None       # (x, y) of a cell to erase and repaint

    for group_idx, ((glyph, fg, bg), coords) in enumerate(sorted_groups):
        # Set draw state once per brush group
        actions.append({
            "action": "ws_set_draw_state",
            "glyph": glyph,
            "fg": rgb_to_hex(list(fg)),
            "bg": rgb_to_hex(list(bg)),
            "glyph_selector": "#wsGlyphCode",
            "fg_selector": "#wsFgColor",
            "bg_selector": "#wsBgColor",
        })

        sorted_coords = sorted(coords, key=lambda p: (p[1], p[0]))

        for coord_idx, (x, y) in enumerate(sorted_coords):
            total_paint_cells += 1
            actions.append({
                "action": "ws_paint_cell",
                "selector": "#wholeSheetCanvas",
                "x": x,
                "y": y,
                "cell_size": WS_CELL_SIZE,
            })

            # After painting the first cell of the first group, inject tool
            # exercise: eyedropper → erase → cell tool round-trip
            if not tool_exercise_done and group_idx == 0 and coord_idx == 0:
                tool_exercise_done = True
                eyedropper_target = (x, y)
                erase_target = (x, y)

                # ── Eyedropper exercise ──
                # Switch to eyedropper, sample the cell we just painted
                actions.append({
                    "action": "ws_tool_activate",
                    "tool": "eyedropper",
                    "selector": "#wsToolEyedropper",
                })
                actions.append({
                    "action": "ws_eyedropper_sample",
                    "selector": "#wholeSheetCanvas",
                    "x": eyedropper_target[0],
                    "y": eyedropper_target[1],
                    "cell_size": WS_CELL_SIZE,
                    "expected_glyph": glyph,
                    "expected_fg": rgb_to_hex(list(fg)),
                    "expected_bg": rgb_to_hex(list(bg)),
                })

                # ── Erase exercise ──
                # Switch to erase, erase the same cell
                actions.append({
                    "action": "ws_tool_activate",
                    "tool": "erase",
                    "selector": "#wsToolErase",
                })
                actions.append({
                    "action": "ws_erase_cell",
                    "selector": "#wholeSheetCanvas",
                    "x": erase_target[0],
                    "y": erase_target[1],
                    "cell_size": WS_CELL_SIZE,
                })

                # Verify erase semantics by switching back to eyedropper and
                # sampling the erased cell before repainting it.
                actions.append({
                    "action": "ws_tool_activate",
                    "tool": "eyedropper",
                    "selector": "#wsToolEyedropper",
                })
                actions.append({
                    "action": "ws_eyedropper_sample",
                    "selector": "#wholeSheetCanvas",
                    "x": erase_target[0],
                    "y": erase_target[1],
                    "cell_size": WS_CELL_SIZE,
                    "expected_glyph": 0,
                    "expected_fg": rgb_to_hex([255, 255, 255]),
                    "expected_bg": rgb_to_hex([0, 0, 0]),
                })

                # ── Return to Cell tool and repaint ──
                actions.append({
                    "action": "ws_tool_activate",
                    "tool": "cell",
                    "selector": "#wsToolCell",
                })
                # Restore draw state (eyedropper may have changed it, but we
                # want to verify the round-trip is correct)
                actions.append({
                    "action": "ws_set_draw_state",
                    "glyph": glyph,
                    "fg": rgb_to_hex(list(fg)),
                    "bg": rgb_to_hex(list(bg)),
                    "glyph_selector": "#wsGlyphCode",
                    "fg_selector": "#wsFgColor",
                    "bg_selector": "#wsBgColor",
                })
                # Repaint the erased cell
                total_paint_cells += 1
                actions.append({
                    "action": "ws_paint_cell",
                    "selector": "#wholeSheetCanvas",
                    "x": erase_target[0],
                    "y": erase_target[1],
                    "cell_size": WS_CELL_SIZE,
                })

    return {
        "ok": True,
        "mode": "acceptance",
        "source": truth_table["source"],
        "required_selectors": ACCEPTANCE_SELECTORS,
        "geometry": {
            "angles": int(meta["angles"]),
            "anims": list(meta["anims"]),
            "projs": int(meta["projs"]),
            "frame_rows": int(meta.get("frame_rows", 1)),
            "frame_cols": int(meta.get("frame_cols", 1)),
            "frame_w": int(meta["frame_w"]),
            "frame_h": int(meta["frame_h"]),
        },
        "editable_layer": 2,
        "preserved_only_layers": [l["index"] for l in truth_table["layers"] if int(l["index"]) != 2],
        "tool_exercise": {
            "eyedropper_target": eyedropper_target,
            "erase_target": erase_target,
            "tools_exercised": ["cell", "eyedropper", "erase"],
        },
        "actions": actions,
        "stats": {
            "paint_cells": total_paint_cells,
            "actions": len(actions),
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
        print(
            f"Recipe [{mode}]: paint_cells={recipe['stats']['paint_cells']} "
            f"actions={recipe['stats']['actions']}",
            file=sys.stderr,
        )
    else:
        print(f"ABORT: {recipe['error']}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
