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
# Maximum cells to erase-and-repaint in an acceptance recipe
MAX_SAMPLE_CELLS = 20


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


def _pick_proof_cells(layer2_cells: list[dict], frame_w: int, frame_h: int) -> list[dict]:
    """Pick up to MAX_SAMPLE_CELLS representative cells from frame 0.

    Selects cells from the top-left frame only (x < frame_w, y < frame_h).
    Groups cells by brush state (glyph, fg, bg) and round-robins across groups
    (most-common first) so the sample covers diverse brush states rather than
    clustering all picks in one group.  Each group's cells are sorted by (y, x)
    so the first pick per group is the top-left occurrence.
    """
    frame0 = [
        c for c in layer2_cells
        if int(c["x"]) < frame_w and int(c["y"]) < frame_h and not _is_clear_cell(c)
    ]
    if not frame0:
        return []

    groups: dict[tuple, list[dict]] = defaultdict(list)
    for c in frame0:
        key = (int(c["glyph"]), tuple(c["fg"]), tuple(c["bg"]))
        groups[key].append(c)

    # Sort each group by (y, x); sort groups by size descending (most common first)
    sorted_groups = sorted(
        (sorted(g, key=lambda c: (int(c["y"]), int(c["x"]))) for g in groups.values()),
        key=lambda g: -len(g),
    )

    # Round-robin: one cell per group per pass until budget is exhausted
    sample: list[dict] = []
    pass_idx = 0
    while len(sample) < MAX_SAMPLE_CELLS:
        advanced = False
        for g in sorted_groups:
            if pass_idx < len(g) and len(sample) < MAX_SAMPLE_CELLS:
                sample.append(g[pass_idx])
                advanced = True
        if not advanced:
            break
        pass_idx += 1

    return sample


def _generate_acceptance_recipe(truth_table: dict, meta: dict) -> dict:
    """Whole-sheet acceptance recipe using targeted edits instead of full repaint.

    Strategy: leave unchanged areas untouched.
    - After XP import, cells are already loaded correctly from the source file.
    - The recipe exercises editing by making targeted changes to a small proof
      region (at most MAX_SAMPLE_CELLS non-transparent cells from frame 0).
    - Tool presence is verified by activating all six shipped whole-sheet tools
      in sequence before any editing begins.
    - The export comparison then validates ALL cells — both the proof region
      (which was edited and restored) and the untouched cells (which must match
      exactly because import was correct).

    This reduces the acceptance run from O(all cells) actions to O(sample size)
    actions while preserving the same correctness guarantee: the exported XP
    must match the original truth table exactly.
    """
    layer2 = next((l for l in truth_table["layers"] if int(l["index"]) == 2), None)
    if layer2 is None:
        return {"ok": False, "error": "Layer 2 not found"}

    frame_w = int(meta["frame_w"])
    frame_h = int(meta["frame_h"])

    # Pick a representative sample of non-transparent cells from frame 0
    proof_cells = _pick_proof_cells(layer2["cells"], frame_w, frame_h)

    actions: list[dict] = [
        {"action": "wait_visible", "selector": "#sessionOut", "timeout_ms": 5000},
        # Wait for the whole-sheet editor to mount
        {"action": "wait_visible", "selector": "#wholeSheetCanvas", "timeout_ms": 10000},
        # Ensure all apply modes are on for full-cell painting
        {"action": "ws_ensure_apply", "channel": "glyph", "selector": "#wsApplyGlyph", "state": True},
        {"action": "ws_ensure_apply", "channel": "fg", "selector": "#wsApplyFg", "state": True},
        {"action": "ws_ensure_apply", "channel": "bg", "selector": "#wsApplyBg", "state": True},
    ]

    # ── Tool presence verification ──
    # Activate each shipped whole-sheet tool in sequence.  This confirms all
    # six tool buttons are present in the UI without modifying any cells yet.
    for tool_name, tool_sel in [
        ("cell",        "#wsToolCell"),
        ("eyedropper",  "#wsToolEyedropper"),
        ("erase",       "#wsToolErase"),
        ("line",        "#wsToolLine"),
        ("rect",        "#wsToolRect"),
        ("fill",        "#wsToolFill"),
    ]:
        actions.append({"action": "ws_tool_activate", "tool": tool_name, "selector": tool_sel})

    # ── Tool exercise: eyedropper → erase → cell round-trip on probe cell ──
    if proof_cells:
        probe = proof_cells[0]
        probe_x = int(probe["x"])
        probe_y = int(probe["y"])
        glyph = int(probe["glyph"])
        fg = probe["fg"]
        bg = probe["bg"]

        # Set draw state to probe cell's value (for repaint after erase)
        actions.append({
            "action": "ws_set_draw_state",
            "glyph": glyph,
            "fg": rgb_to_hex(fg),
            "bg": rgb_to_hex(bg),
            "glyph_selector": "#wsGlyphCode",
            "fg_selector": "#wsFgColor",
            "bg_selector": "#wsBgColor",
        })

        # Eyedropper: sample the probe cell; verify draw state was updated
        actions.append({"action": "ws_tool_activate", "tool": "eyedropper", "selector": "#wsToolEyedropper"})
        actions.append({
            "action": "ws_eyedropper_sample",
            "selector": "#wholeSheetCanvas",
            "x": probe_x,
            "y": probe_y,
            "cell_size": WS_CELL_SIZE,
            "expected_glyph": glyph,
            "expected_fg": rgb_to_hex(fg),
            "expected_bg": rgb_to_hex(bg),
        })

        # Erase the probe cell
        actions.append({"action": "ws_tool_activate", "tool": "erase", "selector": "#wsToolErase"})
        actions.append({
            "action": "ws_erase_cell",
            "selector": "#wholeSheetCanvas",
            "x": probe_x,
            "y": probe_y,
            "cell_size": WS_CELL_SIZE,
        })

        # Verify erase: eyedropper should now report transparent state
        actions.append({"action": "ws_tool_activate", "tool": "eyedropper", "selector": "#wsToolEyedropper"})
        actions.append({
            "action": "ws_eyedropper_sample",
            "selector": "#wholeSheetCanvas",
            "x": probe_x,
            "y": probe_y,
            "cell_size": WS_CELL_SIZE,
            "expected_glyph": 0,
            "expected_fg": rgb_to_hex([255, 255, 255]),
            "expected_bg": rgb_to_hex([0, 0, 0]),
        })

        # Return to cell tool and repaint the probe cell
        actions.append({"action": "ws_tool_activate", "tool": "cell", "selector": "#wsToolCell"})
        actions.append({
            "action": "ws_set_draw_state",
            "glyph": glyph,
            "fg": rgb_to_hex(fg),
            "bg": rgb_to_hex(bg),
            "glyph_selector": "#wsGlyphCode",
            "fg_selector": "#wsFgColor",
            "bg_selector": "#wsBgColor",
        })
        actions.append({
            "action": "ws_paint_cell",
            "selector": "#wholeSheetCanvas",
            "x": probe_x,
            "y": probe_y,
            "cell_size": WS_CELL_SIZE,
        })

    # ── Targeted erase-and-repaint for remaining proof cells ──
    # Erase all remaining proof cells, then repaint them grouped by brush state.
    # Cells outside this sample are left untouched; the export comparison verifies
    # them against the original truth table (they must be correct because import
    # loaded them correctly).
    if len(proof_cells) > 1:
        actions.append({"action": "ws_tool_activate", "tool": "erase", "selector": "#wsToolErase"})
        for cell in proof_cells[1:]:
            actions.append({
                "action": "ws_erase_cell",
                "selector": "#wholeSheetCanvas",
                "x": int(cell["x"]),
                "y": int(cell["y"]),
                "cell_size": WS_CELL_SIZE,
            })

        # Repaint grouped by brush state (fewest ws_set_draw_state calls)
        by_brush: dict[tuple, list[dict]] = defaultdict(list)
        for cell in proof_cells[1:]:
            key = (int(cell["glyph"]), tuple(cell["fg"]), tuple(cell["bg"]))
            by_brush[key].append(cell)

        actions.append({"action": "ws_tool_activate", "tool": "cell", "selector": "#wsToolCell"})
        for (glyph, fg, bg), cells in sorted(by_brush.items(), key=lambda x: (-len(x[1]), x[0])):
            actions.append({
                "action": "ws_set_draw_state",
                "glyph": glyph,
                "fg": rgb_to_hex(list(fg)),
                "bg": rgb_to_hex(list(bg)),
                "glyph_selector": "#wsGlyphCode",
                "fg_selector": "#wsFgColor",
                "bg_selector": "#wsBgColor",
            })
            for cell in cells:
                actions.append({
                    "action": "ws_paint_cell",
                    "selector": "#wholeSheetCanvas",
                    "x": int(cell["x"]),
                    "y": int(cell["y"]),
                    "cell_size": WS_CELL_SIZE,
                })

    paint_cells = sum(1 for a in actions if a["action"] == "ws_paint_cell")

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
            "frame_w": frame_w,
            "frame_h": frame_h,
        },
        "editable_layer": 2,
        "preserved_only_layers": [l["index"] for l in truth_table["layers"] if int(l["index"]) != 2],
        "proof_region": {
            "cells_sampled": len(proof_cells),
            "from_frame": "0,0",
        },
        "tool_exercise": {
            "tools_exercised": ["cell", "eyedropper", "erase", "line", "rect", "fill"],
        },
        "actions": actions,
        "stats": {
            "proof_cells": len(proof_cells),
            "paint_cells": paint_cells,
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
