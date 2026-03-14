# scripts/xp_fidelity_test/recipe_generator.py
"""
XP Fidelity Recipe Generator — UI Action Sequence (Single-Frame)

Takes a truth table JSON from an upload-xp session (geometry 1,1,1).
Emits concrete UI actions for the Playwright executor.
No __wb_debug. No internal function calls. Only visible controls.

Session geometry assumption:
  upload-xp hardcodes angles=1, anims=[1], projs=1 (service.py:2034-2036).
  recomputeFrameGeometry() then produces frameWChars = gridCols,
  frameHChars = gridRows (workbench.js:1832-1842).
  So global coordinates (x, y) from the truth table are directly usable
  as canvas paint coordinates (cx, cy) — no frame decomposition needed.

  Multi-frame sessions (non-1,1,1 geometry) are out of scope. See plan
  "Harness Scope" section for why.

Action types:
  open_inspector  — dblclick a .frame-cell to open the inspector
  wait_visible    — wait for a selector to become visible
  select_tool     — click a tool button
  clear_frame     — click Clear Frame button
  set_glyph_code  — fill the glyph code input
  set_fg_color    — set the FG color picker value
  set_bg_color    — set the BG color picker value
  paint_cell      — click the inspector canvas at computed pixel coords

Usage:
  python3 recipe_generator.py --truth-table <json> [--output <json>]
"""
import sys, json, os
from collections import defaultdict


# All selectors the executor needs — preflight validates these exist at runtime
REQUIRED_SELECTORS = {
    "frame_cell": ".frame-cell[data-row][data-col]",
    "inspector_panel": "#cellInspectorPanel",
    "tool_glyph_btn": "#inspectorToolGlyphBtn",
    "glyph_code_input": "#inspectorGlyphCode",
    "fg_color_input": "#inspectorGlyphFgColor",
    "bg_color_input": "#inspectorGlyphBgColor",
    "inspector_canvas": "#cellInspectorCanvas",
    "zoom_input": "#inspectorZoom",
    "clear_frame_btn": "#inspectorClearFrameBtn",
    "layer_select": "#layerSelect",
    "export_btn": "#btnExport",
    "export_output": "#exportOut",
}


def rgb_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"


def generate_recipe(truth_table):
    # Find layer 2
    layer2 = next((l for l in truth_table['layers'] if l['index'] == 2), None)
    if not layer2:
        return {"error": "No layer 2 in truth table", "ok": False}

    skipped = [l['index'] for l in truth_table['layers'] if l['index'] != 2]

    # Group non-transparent cells by (glyph, fg, bg) for minimal brush changes.
    # After clear_frame, all cells are reset to the exact post-clear state:
    #   { glyph: 0, fg: [0,0,0], bg: [255,0,255] }  (workbench.js:5013)
    # Only skip cells that match this full tuple. Cells with glyph 0 and magenta bg
    # but nonzero fg must still be painted — otherwise the export will mismatch.
    POST_CLEAR_CELL = (0, [0, 0, 0], [255, 0, 255])
    brush_groups = defaultdict(list)
    skipped_transparent = 0
    for cell in layer2['cells']:
        if (cell['glyph'] == POST_CLEAR_CELL[0]
                and cell['fg'] == POST_CLEAR_CELL[1]
                and cell['bg'] == POST_CLEAR_CELL[2]):
            skipped_transparent += 1
            continue
        key = (cell['glyph'],
               cell['fg'][0], cell['fg'][1], cell['fg'][2],
               cell['bg'][0], cell['bg'][1], cell['bg'][2])
        brush_groups[key].append((cell['x'], cell['y']))

    # Sort: largest groups first (fewer brush changes)
    sorted_groups = sorted(brush_groups.items(), key=lambda item: -len(item[1]))

    # Build action sequence
    actions = []

    # Open inspector on the single frame (0, 0).
    # upload-xp sessions have geometry 1,1,1, so there is exactly 1 frame
    # and 1 .frame-cell element: data-row="0" data-col="0".
    # This is a user-reachable action: dblclick on .frame-cell calls
    # openInspector(row, col) via workbench.js:5467-5472.
    actions.append({
        "action": "open_inspector",
        "frame_row": 0,
        "frame_col": 0,
        "selector": ".frame-cell[data-row='0'][data-col='0']",
        "interaction": "dblclick",
    })

    # Wait for inspector panel to become visible
    actions.append({
        "action": "wait_visible",
        "selector": "#cellInspectorPanel",
        "timeout_ms": 3000,
    })

    # Select glyph tool
    actions.append({
        "action": "select_tool",
        "tool": "glyph",
        "selector": "#inspectorToolGlyphBtn",
        "interaction": "click",
    })

    # Clear the single frame
    actions.append({
        "action": "clear_frame",
        "selector": "#inspectorClearFrameBtn",
        "interaction": "click",
    })

    # Paint ops grouped by brush (minimizes control changes).
    # Since geometry is 1,1,1, global (x, y) = frame-local (cx, cy).
    for (glyph, fr, fg, fb, br, bg, bb), coords in sorted_groups:
        # Set glyph code
        actions.append({
            "action": "set_glyph_code",
            "code": glyph,
            "selector": "#inspectorGlyphCode",
            "interaction": "fill",
            "value": str(glyph),
        })

        # Set FG color
        fg_hex = rgb_to_hex(fr, fg, fb)
        actions.append({
            "action": "set_fg_color",
            "rgb": [fr, fg, fb],
            "selector": "#inspectorGlyphFgColor",
            "interaction": "color_input",
            "value": fg_hex,
        })

        # Set BG color
        bg_hex = rgb_to_hex(br, bg, bb)
        actions.append({
            "action": "set_bg_color",
            "rgb": [br, bg, bb],
            "selector": "#inspectorGlyphBgColor",
            "interaction": "color_input",
            "value": bg_hex,
        })

        # Paint each cell with this brush
        for x, y in sorted(coords, key=lambda c: (c[1], c[0])):
            actions.append({
                "action": "paint_cell",
                "cx": x,
                "cy": y,
                "selector": "#cellInspectorCanvas",
                "interaction": "click_at_computed_coords",
                "note": f"global=local ({x},{y}): px = {x} * zoom + zoom/2, py = {y} * 2 * zoom + zoom/2",
            })

    total_cells = sum(len(coords) for _, coords in sorted_groups)

    return {
        "ok": True,
        "source": truth_table['source'],
        "target_layer": 2,
        "canvas": {"width": layer2['width'], "height": layer2['height']},
        "geometry": {"angles": 1, "anims": [1], "projs": 1},
        "required_selectors": REQUIRED_SELECTORS,
        "actions": actions,
        "skipped_layers": skipped,
        "stats": {
            "total_cells": total_cells,
            "skipped_transparent": skipped_transparent,
            "brush_groups": len(sorted_groups),
            "total_actions": len(actions),
        }
    }


def main():
    args = sys.argv[1:]
    tt_path = output_path = None

    if '--truth-table' in args:
        tt_path = args[args.index('--truth-table') + 1]
    if '--output' in args:
        output_path = args[args.index('--output') + 1]

    if not tt_path:
        print("Usage: python3 recipe_generator.py --truth-table <json> [--output <json>]",
              file=sys.stderr)
        sys.exit(1)

    with open(tt_path) as f:
        truth_table = json.load(f)

    recipe = generate_recipe(truth_table)

    if not recipe.get('ok'):
        print(f"ABORT: {recipe.get('error')}", file=sys.stderr)
        if output_path:
            with open(output_path, 'w') as f:
                json.dump(recipe, f, indent=2)
        sys.exit(1)

    if output_path:
        with open(output_path, 'w') as f:
            json.dump(recipe, f, indent=2)

    s = recipe['stats']
    print(f"Recipe: {s['total_cells']} cells to paint, "
          f"{s['skipped_transparent']} transparent skipped, "
          f"{s['brush_groups']} brush groups, "
          f"{s['total_actions']} actions total",
          file=sys.stderr)
    print(f"Geometry: 1,1,1 (single-frame upload-xp session)", file=sys.stderr)
    print(f"Required selectors: {len(REQUIRED_SELECTORS)}", file=sys.stderr)


if __name__ == '__main__':
    main()
