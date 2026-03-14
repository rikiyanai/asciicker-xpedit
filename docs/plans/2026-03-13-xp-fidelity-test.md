# XP Fidelity Test — User-Action Conformance Roundtrip

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Determine whether the current workbench UI can recreate XP cell data through real user-reachable actions only. On unmodified master, the harness aborts in setup because `upload-xp` does not return `job_id` (see Backend Prerequisite). After applying the prerequisite patch, the expected result is a structured FAIL documenting which UI capabilities are missing or broken. That failure is useful evidence, not a bug in the test.

**Architecture:** Three-layer stack: (1) oracle reads source XP via Python's authoritative codec into a truth table; (2) executor tries to reproduce all layer-2 cells using only visible DOM controls, clicks, and typing; (3) verifier exports the result via the real Export XP button and compares cell-by-cell against the oracle.

**Tech Stack:** Python 3 (xp_core.py), Node.js + Playwright (.mjs), Flask on :5071.

---

## Contract

### "User-reachable" means (narrowly)

- Visible DOM controls: buttons, inputs, selects, canvases — elements a user can see and interact with
- Normal click/type/select flows: `page.click()`, `page.fill()`, `page.selectOption()`
- Normal upload/export flows: file inputs, download triggers
- Standard keyboard shortcuts that the UI documents

### "User-reachable" does NOT mean

- `window.__wb_debug` or any debug/automation API
- Hidden inputs unless reachable through the shipped UI
- Direct JS state mutation via `page.evaluate(() => { state.x = y })`
- `page.evaluate(() => someInternalFunction())` that calls internal workbench functions

### `page.evaluate` boundary rule

**Allowed (all phases):**
- Reading visible DOM state (element values, visibility, bounding rects, computed styles)
- Computing canvas pixel coordinates from visible zoom/size values
- Setting `<input type="color">` `.value` + dispatching native `input`/`change` events (simulating user color picker interaction — Playwright `fill()` does not work on color inputs)
- Checking test outcomes (reading `#exportOut` text content)

**Forbidden (all phases):**
- Setting app state: `state.inspectorGlyphCode = 65` or any `state.*` mutation
- Calling app internals: `window.__wb_debug.*`, `openInspector()`, `setInspectorGlyphUIFromCell()`, `renderAll()`, etc.
- Calling any function that is not a DOM/Event/Canvas-read API: only `document.querySelector`, `el.value`, `el.dispatchEvent`, `new Event()`, `window.getComputedStyle`, `el.getBoundingClientRect`, `canvas.getContext('2d')`, `ctx.getImageData()` are permitted

**No exceptions.** Phase 1 uses a backend API call (`upload-xp`, which now returns a `job_id`) and then navigates to `/workbench?job_id=<id>`. The existing boot path (`workbench.js:6866`) calls `loadFromJob()` which does the full state initialization. No `page.evaluate` in any phase sets `state.*` or calls any app-internal function.

This boundary exists so the harness cannot drift back into verifier shortcuts. If the test needs something the visible DOM does not expose, the test should fail, not work around it.

### Failure Classes

| Class | Meaning |
|-------|---------|
| `ui_missing` | Required DOM control does not exist |
| `ui_blocked` | Control exists but cannot complete the action (disabled, hidden, non-interactive) |
| `ui_behavior_mismatch` | Action succeeds but resulting cell data is wrong (detected via Inspect tool readback or export comparison) |
| `export_missing` | No normal export path available |
| `xp_mismatch` | Export succeeds but roundtrip differs from oracle |

### Expected Results

**Current unmodified master:** Setup abort. The executor calls `upload-xp`, checks for `job_id` in the response, finds none (`service.py:2033` sets `job_id=""`), and exits with `"Cannot proceed without a job_id — is the backend prerequisite applied?"`. No UI interaction is attempted. No failure report is generated.

**Master after backend prerequisite patch:** Structured FAIL. Setup completes (upload → navigate → `loadFromJob()` boot). The executor reaches Phases 2-4, which exercise the real UI. The failure report documents exactly which capabilities are missing or broken (failure classes: `ui_missing`, `ui_blocked`, `ui_behavior_mismatch`, `xp_mismatch`). When the UI improves, the same harness starts passing — no philosophical shift, no different test.

---

## UI Interaction Surface (Current Master)

The executor expects these concrete DOM elements. Preflight validates each one. These selectors were extracted from `web/workbench.html` and `web/workbench.js` on audited master.

| # | Control | Selector | Type | User Action |
|---|---------|----------|------|-------------|
| 1 | Frame grid cells | `.frame-cell[data-row][data-col]` | DIV | Double-click to open inspector |
| 2 | Inspector panel | `#cellInspectorPanel` | DIV | Must become visible after opening |
| 3 | Glyph tool button | `#inspectorToolGlyphBtn` | BUTTON | Click to select glyph tool |
| 4 | Glyph code input | `#inspectorGlyphCode` | INPUT number (0-255) | Fill to set glyph CP437 code |
| 5 | FG color picker | `#inspectorGlyphFgColor` | INPUT color | Set value to change fg color |
| 6 | BG color picker | `#inspectorGlyphBgColor` | INPUT color | Set value to change bg color |
| 7 | Inspector canvas | `#cellInspectorCanvas` | CANVAS (dynamic size) | Click at pixel coords to paint cell |
| 8 | Zoom control | `#inspectorZoom` | INPUT range (4-28) | Read to compute click coordinates |
| 9 | Clear Frame button | `#inspectorClearFrameBtn` | BUTTON | Click to clear all cells in frame |
| 10 | Layer select | `#layerSelect` | SELECT | Change to switch editing layer |
| 11 | Export XP button | `#btnExport` | BUTTON | Click to export session as XP |
| 12 | Export output | `#exportOut` | PRE | Read to get export result path |

### Canvas Coordinate Formula

To paint cell (cx, cy) on the inspector canvas, compute pixel position from zoom:

```
zoom = parseInt(document.querySelector('#inspectorZoom').value) || 10
px = cx * zoom + floor(zoom / 2)
py = cy * 2 * zoom + floor(zoom / 2)
```

Derived from `inspectorHalfCellAtEvent()` in `web/workbench.js:3296-3316`. The `* 2` on cy accounts for half-cell row layout.

**Canvas size is dynamic, not fixed.** The HTML attribute is `width="320" height="320"` (`workbench.html:401`) but `renderInspector()` overwrites it every render to `frameWChars * zoom` × `frameHChars * 2 * zoom` (`workbench.js:3223-3224`). For an upload-xp session with a 126×80 grid at zoom 10, the canvas would be 1260×1600 pixels. The executor must read actual canvas dimensions at runtime via `canvas.width` / `canvas.height`, not assume 320×320. Click coordinates that exceed the actual canvas size will be rejected by `inspectorHalfCellAtEvent()` bounds check (`workbench.js:3303`).

### Editor Scope: Per-Frame, Not Whole-Sheet

The current workbench XP editor opens per-frame: the user double-clicks one `.frame-cell` tile and edits cells within that single frame's bounds (`frameWChars x frameHChars`). The inspector renders one frame at a time on a canvas sized to `frameWChars * zoom` × `frameHChars * 2 * zoom` (`renderInspector()` at `workbench.js:3221-3224`). All coordinate mapping is frame-scoped (`inspectorHalfCellAtEvent()` at `workbench.js:3310` bounds-checks against `frameWChars`/`frameHChars`).

By inference (not manual-verified fact), REXPaint opens the entire sheet as a single editable canvas. The REXPaint manual says only "`Ctrl-g Toggle Grid`" (`REXPAINT_MANUAL.txt:301`) — no specification of grid appearance, per-cell vs per-tile behavior, or zoom interaction. We infer whole-canvas/per-cell grid from REXPaint's font-based architecture (`REXPAINT_MANUAL.txt:145`: "images remember only what glyph/character index belongs at each position"), but this is not manual-verified.

### Harness Scope: Upload-XP Single-Frame Only

**This harness is scoped to sessions created via the `upload-xp` API path.** That path hardcodes `angles=1, anims=[1], projs=1` (`service.py:2034-2036`), which makes `frameWChars = gridCols` and `frameHChars = gridRows` — the entire grid is one frame. The recipe generator assumes this geometry — global coordinates equal frame-local coordinates.

**Multi-frame is out of scope for this harness version.** Extending to multi-frame would require:
1. A setup path that creates a session with matching geometry (the `upload-xp` API does not accept geometry overrides)
2. Handling `recomputeFrameGeometry()`'s non-exact-division fallback to `cellWChars`/`cellHChars` (`workbench.js:1839-1840`) — plain `floor(gridCols / frameCols)` is only correct when the division is exact
3. Passing effective frame cell dimensions (not just `angles`/`anims`/`projs`) so the recipe's coordinate decomposition matches the workbench's actual frame layout

This means:
- Opening the inspector IS part of the tested UI path, not scaffolding. The recipe's `open_inspector` action uses the real dblclick flow on `.frame-cell[data-row][data-col]` elements (`workbench.js:5467-5472`).
- For this version, there is exactly 1 frame. The recipe opens it once and paints all cells with global coordinates (which equal frame-local coordinates when geometry is `1,1,1`).
- The per-frame model is itself a known gap vs REXPaint's inferred whole-sheet editing. When the same test runs against a future whole-sheet editor, the `open_inspector` action becomes unnecessary — the recipe would paint all cells on a single canvas directly.
- Session bootstrap (uploading the XP via API, navigating to `/workbench?job_id=<id>`) is the ONLY scaffolding. Everything after that — opening the editor, selecting tools, painting, exporting — is under test.

### Event Propagation

The workbench listens on `input` events for all inspector controls (`workbench.js:6136-6156`). Setting a value requires dispatching `input` event to update internal state. For color inputs, also dispatch `change`. This matches what the browser does when the user interacts with these controls.

---

## File Layout

```
scripts/xp_fidelity_test/
├── truth_table.py              # Task 1: XP → JSON truth table (oracle)
├── recipe_generator.py         # Task 2: truth table → UI action sequence
├── run_fidelity_test.mjs       # Task 3: Playwright executor (preflight + execute + verify)
├── run.sh                      # Task 4: one-command wrapper
├── create_fixture.py           # Task 5: small test XP with known values
└── README.md                   # Task 5: docs
```

---

## Task 1: XP Truth Table Extractor (Oracle)

**Files:**
- Create: `scripts/xp_fidelity_test/truth_table.py`
- Read: `scripts/rex_mcp/xp_core.py`

**Purpose:** Read any .xp file via the authoritative Python codec. Output a JSON truth table with exact cell values for every layer, every coordinate.

### Step 1: Write truth_table.py

```python
# scripts/xp_fidelity_test/truth_table.py
"""
XP Truth Table Extractor

Reads an XP file via xp_core.py and outputs a JSON truth table:
{
  "source": "<filename>",
  "width": N,
  "height": N,
  "layer_count": N,
  "layers": [
    {
      "index": 0,
      "width": N,
      "height": N,
      "editable": false,
      "cell_count": N,
      "non_transparent_count": N,
      "cells": [
        {"x": 0, "y": 0, "glyph": 65, "fg": [255, 0, 0], "bg": [0, 0, 255]},
        ...
      ]
    },
    ...
  ]
}

Usage:
  python3 scripts/xp_fidelity_test/truth_table.py <xp_file> [--output <json_path>]
"""
import sys, json, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'rex_mcp'))
from xp_core import XPFile

MAGENTA = (255, 0, 255)


def is_transparent(glyph, bg):
    """Check if cell is transparent (glyph 0 with magenta bg, or just magenta bg)."""
    return bg == MAGENTA and glyph == 0


def extract_truth_table(xp_path):
    xp = XPFile(xp_path)
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

        layers_out.append({
            "index": layer_idx,
            "width": layer.width,
            "height": layer.height,
            "editable": layer_idx == 2,
            "cell_count": len(cells),
            "non_transparent_count": non_transparent,
            "cells": cells
        })

    return {
        "source": os.path.basename(xp_path),
        "width": xp.layers[0].width if xp.layers else 0,
        "height": xp.layers[0].height if xp.layers else 0,
        "layer_count": len(xp.layers),
        "layers": layers_out
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 truth_table.py <xp_file> [--output <json_path>]", file=sys.stderr)
        sys.exit(1)

    xp_path = sys.argv[1]
    output_path = None
    if '--output' in sys.argv:
        idx = sys.argv.index('--output')
        output_path = sys.argv[idx + 1]

    table = extract_truth_table(xp_path)

    if output_path:
        with open(output_path, 'w') as f:
            json.dump(table, f, indent=2)
        layer2 = next((l for l in table['layers'] if l['index'] == 2), None)
        nt = layer2['non_transparent_count'] if layer2 else '?'
        print(f"Truth table: {table['source']}, {table['layer_count']} layers, "
              f"{table['width']}x{table['height']}, "
              f"layer 2 non-transparent: {nt}/{table['width']*table['height']}",
              file=sys.stderr)
    else:
        json.dump(table, sys.stdout, indent=2)


if __name__ == '__main__':
    main()
```

### Step 2: Run to verify

```bash
python3 scripts/xp_fidelity_test/truth_table.py sprites/player-0100.xp --output /tmp/tt_test.json
# Expected: "Truth table: player-0100.xp, 4 layers, 126x80, layer 2 non-transparent: N/10080"
python3 -c "import json; t=json.load(open('/tmp/tt_test.json')); print(f'OK: {len(t[\"layers\"])} layers')"
# Expected: OK: 4 layers
```

### Step 3: Commit

```bash
git add scripts/xp_fidelity_test/truth_table.py
git commit -m "feat: add XP truth table extractor for fidelity testing"
```

---

## Task 2: Recipe Generator — UI Action Sequence

**Files:**
- Create: `scripts/xp_fidelity_test/recipe_generator.py`

**Purpose:** Takes a truth table JSON. Emits a sequence of concrete UI actions — what to click, what to type, where on the canvas to paint. Each action includes the DOM selector it targets. The recipe is auditable: you can read it and see exactly what the test will do.

### Session geometry assumption

This recipe generator assumes a single-frame session: `angles=1, anims=[1], projs=1`.
This matches the `upload-xp` API which hardcodes these values (`service.py:2034-2036`).
With this geometry, `recomputeFrameGeometry()` (`workbench.js:1832-1842`) produces
`frameWChars = gridCols` and `frameHChars = gridRows`, so global coordinates equal
frame-local coordinates. The recipe uses `(x, y)` from the truth table directly as
canvas paint coordinates `(cx, cy)`.

**Multi-frame is out of scope.** Extending to multi-frame geometry requires a setup
path that creates sessions with non-default geometry, and handling
`recomputeFrameGeometry()`'s non-exact-division fallback to `cellWChars`/`cellHChars`
(`workbench.js:1839-1840`). See "Harness Scope" section above.

### Step 1: Write recipe_generator.py

```python
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

    # Group cells by (glyph, fg, bg) for minimal brush changes
    brush_groups = defaultdict(list)
    for cell in layer2['cells']:
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
        "expected_result": "structured_fail_on_current_master",
        "required_selectors": REQUIRED_SELECTORS,
        "actions": actions,
        "skipped_layers": skipped,
        "stats": {
            "total_cells": total_cells,
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
    print(f"Recipe: {s['total_cells']} cells, "
          f"{s['brush_groups']} brush groups, "
          f"{s['total_actions']} actions total",
          file=sys.stderr)
    print(f"Geometry: 1,1,1 (single-frame upload-xp session)", file=sys.stderr)
    print(f"Required selectors: {len(REQUIRED_SELECTORS)}", file=sys.stderr)
    print(f"Expected result: {recipe['expected_result']}", file=sys.stderr)


if __name__ == '__main__':
    main()
```

### Step 2: Run to verify

```bash
python3 scripts/xp_fidelity_test/truth_table.py sprites/player-0100.xp --output /tmp/tt.json
python3 scripts/xp_fidelity_test/recipe_generator.py --truth-table /tmp/tt.json --output /tmp/recipe.json
# Expected: Recipe: 10080 cells, N brush groups, N actions total
#           Geometry: 1,1,1 (single-frame upload-xp session)
#           Required selectors: 12
#           Expected result: structured_fail_on_current_master
```

### Step 3: Commit

```bash
git add scripts/xp_fidelity_test/recipe_generator.py
git commit -m "feat: add UI action recipe generator for fidelity test"
```

---

## Task 3: Playwright Executor + Verifier

**Files:**
- Create: `scripts/xp_fidelity_test/run_fidelity_test.mjs`

**Purpose:** Reads a recipe and truth table. Phase 1: test scaffolding — uploads XP via API (`upload-xp` returns `job_id`), navigates to `/workbench?job_id=<id>`, waits for the normal `loadFromJob()` boot to complete (the ONLY part not under test). Phase 2: preflight — validates all required DOM selectors are visible, enabled, and actionable (not just present in DOM). Includes a canvas smoke test that verifies clicking actually changes state. Phase 3: executes recipe using only visible DOM controls — including opening the inspector/editor via real dblclick on frame cells. Phase 4: clicks Export XP, reads the result, compares against truth table.

### Step 1: Write the executor

```javascript
// scripts/xp_fidelity_test/run_fidelity_test.mjs
/**
 * XP Fidelity Test — User-Action Conformance Executor
 *
 * Dispatches UI actions from a recipe using only visible DOM controls.
 * No window.__wb_debug. No direct state mutation. Only clicks, fills, and typing.
 *
 * Phases:
 *   1. Setup (test scaffolding, not under conformance test): upload XP via API, navigate to ?job_id=<id>
 *   2. Preflight: validate all required DOM selectors exist and are interactive
 *   3. Execute: dispatch recipe actions through visible controls
 *   4. Verify: click Export XP, download result, compare against truth table
 *
 * Usage:
 *   node run_fidelity_test.mjs \
 *     --truth-table <truth_table.json> \
 *     --recipe <recipe.json> \
 *     --xp <source.xp> \
 *     [--url http://127.0.0.1:5071/workbench] \
 *     [--headed]
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Args ---
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}

const truthTablePath = getArg('--truth-table');
const recipePath = getArg('--recipe');
const xpPath = getArg('--xp');
const url = getArg('--url') || 'http://127.0.0.1:5071/workbench';
const headed = args.includes('--headed');

if (!truthTablePath || !recipePath || !xpPath) {
  console.error('Usage: node run_fidelity_test.mjs --truth-table <json> --recipe <json> --xp <xp_file> [--url <url>] [--headed]');
  process.exit(1);
}

const truthTable = JSON.parse(fs.readFileSync(truthTablePath, 'utf-8'));
const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf-8'));

if (!recipe.ok) {
  console.error(`Recipe not OK: ${recipe.error}`);
  process.exit(1);
}

// Build truth lookup for layer 2
const layer2Info = truthTable.layers.find(l => l.index === 2);
const layer2Truth = {};
for (const cell of layer2Info.cells) {
  layer2Truth[`${cell.x},${cell.y}`] = cell;
}

// Output dir
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join('output', 'xp-fidelity-test', `fidelity-${ts}`);
fs.mkdirSync(outDir, { recursive: true });

// --- Failure tracking ---
const failures = [];
function fail(cls, detail) {
  failures.push({ class: cls, ...detail, timestamp: new Date().toISOString() });
  console.error(`[FAIL:${cls}] ${detail.message || JSON.stringify(detail)}`);
}

async function main() {
  console.log(`[fidelity] XP Fidelity Test — User-Action Conformance`);
  console.log(`[fidelity] source: ${recipe.source}`);
  console.log(`[fidelity] recipe: ${recipe.stats.total_cells} cells, ${recipe.stats.brush_groups} groups, ${recipe.stats.total_actions} actions`);
  console.log(`[fidelity] expected result: ${recipe.expected_result}`);
  console.log('');

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[browser:error] ${msg.text()}`);
  });

  try {
    // ========================================================
    // PHASE 1: TEST SCAFFOLDING (the ONLY part not under test)
    // Uploads the XP via API, then navigates to the workbench
    // with the returned job_id. The existing boot path at
    // workbench.js:6866 calls loadFromJob() which does the
    // full state initialization (cells, geometry, layers,
    // activeLayer=2, btnExport.disabled=false, renderAll, etc).
    //
    // No direct state mutation. No page.evaluate for setup.
    // Everything after this — opening the editor, selecting
    // tools, painting cells, exporting — is under test.
    // ========================================================

    // Step 1: Upload XP via API.
    // upload-xp now creates a minimal job record alongside the session,
    // returning { session_id, job_id, grid_cols, grid_rows, ... }.
    // See "Backend Prerequisite" section in the plan.
    console.log(`[phase:setup] uploading ${path.basename(xpPath)} via upload-xp API`);
    const xpBytes = fs.readFileSync(path.resolve(xpPath));
    const baseUrl = new URL(url).origin;
    const uploadResp = await (async () => {
      // Use Node.js built-in fetch (Node 18+) with FormData/Blob from global scope
      const blob = new Blob([xpBytes], { type: 'application/octet-stream' });
      const fd = new FormData();
      fd.append('file', blob, path.basename(xpPath));
      const resp = await fetch(`${baseUrl}/api/workbench/upload-xp`, { method: 'POST', body: fd });
      return resp.json();
    })();

    if (!uploadResp.job_id) {
      fail('ui_blocked', { message: `upload-xp did not return job_id: ${JSON.stringify(uploadResp)}`, phase: 'setup' });
      throw new Error('Cannot proceed without a job_id — is the backend prerequisite applied?');
    }
    const jobId = uploadResp.job_id;
    console.log(`[phase:setup] upload OK: job_id=${jobId}, session_id=${uploadResp.session_id}, ${uploadResp.grid_cols}x${uploadResp.grid_rows}`);

    // Step 2: Navigate to workbench with job_id.
    // The IIFE boot at workbench.js:66 reads job_id from URL params.
    // At workbench.js:6866, if state.jobId is truthy, it calls loadFromJob()
    // which does the full state initialization:
    //   - state.sessionId, state.cells, state.gridCols/gridRows (3541-3544)
    //   - state.angles, state.anims, state.projs (3545-3548)
    //   - state.cellWChars, state.cellHChars, state.layerNames (3549-3551)
    //   - state.activeLayer = 2, state.visibleLayers = new Set([2]) (3567-3568)
    //   - state.history = [], state.future = [] (3571-3572)
    //   - $("btnExport").disabled = false (3585)
    //   - syncLayersFromSessionCells(), renderAll() (3586-3588)
    const loadUrl = `${url}?job_id=${encodeURIComponent(jobId)}`;
    console.log(`[phase:setup] navigating to ${loadUrl}`);
    await page.goto(loadUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Step 3: Wait for loadFromJob() to finish.
    // Evidence: .frame-cell elements appear (renderAll creates them),
    // and #btnExport becomes enabled (loadFromJob sets disabled=false at line 3585).
    await page.waitForSelector('.frame-cell[data-row][data-col]', { state: 'attached', timeout: 15000 });
    const exportReady = await page.evaluate(() => {
      const btn = document.querySelector('#btnExport');
      return btn && !btn.disabled;
    });
    if (!exportReady) {
      fail('ui_blocked', { message: 'loadFromJob() did not enable #btnExport — session may not have loaded', phase: 'setup' });
      throw new Error('Session load did not complete');
    }
    console.log(`[phase:setup] session loaded via loadFromJob() — frame cells present, export enabled`);

    // ========================================================
    // PHASE 2: PREFLIGHT (validates real DOM controls)
    // This IS part of the conformance test. A selector existing
    // in DOM is not enough — it must be visible, enabled, and
    // actually actionable. For the canvas, we verify that a
    // click changes visible state.
    // ========================================================
    console.log('[phase:preflight] validating DOM controls (visible + enabled + actionable)...');
    const preflightResults = {};
    let preflightPassed = true;

    for (const [name, selector] of Object.entries(recipe.required_selectors)) {
      const info = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { exists: false, visible: false, enabled: false, actionable: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible = style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0'
          && rect.width > 0 && rect.height > 0;
        const enabled = el.disabled !== true;
        return {
          exists: true,
          visible,
          enabled,
          actionable: visible && enabled,
          tagName: el.tagName,
          type: el.type || null,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        };
      }, selector);

      preflightResults[name] = { selector, ...info };

      if (!info.exists) {
        fail('ui_missing', { message: `${name}: selector "${selector}" not found in DOM`, control: name });
        preflightPassed = false;
      } else if (!info.visible) {
        // inspector_panel is expected to be hidden until opened — special case
        if (name !== 'inspector_panel') {
          fail('ui_blocked', { message: `${name}: "${selector}" exists but is not visible (display/visibility/opacity/size)`, control: name });
          preflightPassed = false;
        }
      } else if (!info.enabled) {
        // export_btn should be enabled after loadFromJob() — re-check before export as safety net
        if (name !== 'export_btn') {
          fail('ui_blocked', { message: `${name}: "${selector}" is visible but disabled`, control: name });
          preflightPassed = false;
        }
      }
    }

    // Special check: frame cells must exist (dynamically created from session data)
    const frameCellCount = await page.evaluate(() =>
      document.querySelectorAll('.frame-cell[data-row][data-col]').length
    );
    preflightResults['frame_cell_count'] = frameCellCount;
    if (frameCellCount === 0) {
      fail('ui_missing', { message: 'No .frame-cell elements found — grid not rendered (session may not have loaded)', control: 'frame_cell' });
      preflightPassed = false;
    }

    // Canvas smoke test: verify that (a) dblclick opens the inspector,
    // and (b) a glyph-tool click on the canvas actually changes pixel data.
    //
    // "Click did not throw" is not enough — we need evidence that the UI
    // accepted the edit. We read canvas pixel data before and after the
    // click. If pixels changed, the paint action took effect.
    if (preflightPassed && frameCellCount > 0) {
      console.log('[phase:preflight] canvas smoke test — verifying click changes canvas pixels...');
      try {
        // Step 1: Open inspector via dblclick on first frame cell
        await page.dblclick('.frame-cell[data-row="0"][data-col="0"]');
        await page.waitForTimeout(500);

        const panelVisible = await page.evaluate(() => {
          const panel = document.querySelector('#cellInspectorPanel');
          if (!panel) return false;
          const style = window.getComputedStyle(panel);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (!panelVisible) {
          fail('ui_blocked', { message: 'Double-click on frame cell did not open inspector panel — panel remained hidden', control: 'inspector_open' });
          preflightPassed = false;
        } else {
          // Step 2: Select glyph tool
          await page.click('#inspectorToolGlyphBtn');
          await page.waitForTimeout(100);

          // Step 3: Set a known glyph (219 = full block) with white fg
          // so we have a predictable color to detect.
          await page.fill('#inspectorGlyphCode', '219');
          await page.dispatchEvent('#inspectorGlyphCode', 'input');
          await page.evaluate(() => {
            const el = document.querySelector('#inspectorGlyphFgColor');
            if (el) {
              el.value = '#ffffff';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          await page.waitForTimeout(100);

          // Step 4: Read canvas pixel data at cell (0,0) BEFORE click
          const zoom = await page.evaluate(() =>
            parseInt(document.querySelector('#inspectorZoom')?.value || '10', 10)
          );
          const smokePx = Math.floor(zoom / 2);
          const smokePy = Math.floor(zoom / 2);

          const beforePixel = await page.evaluate(({ px, py }) => {
            const c = document.querySelector('#cellInspectorCanvas');
            if (!c) return null;
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(px, py, 1, 1).data;
            return [d[0], d[1], d[2], d[3]];
          }, { px: smokePx, py: smokePy });

          // Step 5: Click canvas at cell (0,0)
          await page.click('#cellInspectorCanvas', { position: { x: smokePx, y: smokePy } });
          await page.waitForTimeout(300);

          // Step 6: Read canvas pixel data AFTER click
          const afterPixel = await page.evaluate(({ px, py }) => {
            const c = document.querySelector('#cellInspectorCanvas');
            if (!c) return null;
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(px, py, 1, 1).data;
            return [d[0], d[1], d[2], d[3]];
          }, { px: smokePx, py: smokePy });

          // Step 7: Verify pixels actually changed
          const pixelsChanged = beforePixel && afterPixel &&
            (beforePixel[0] !== afterPixel[0] ||
             beforePixel[1] !== afterPixel[1] ||
             beforePixel[2] !== afterPixel[2]);

          if (!pixelsChanged) {
            fail('ui_blocked', {
              message: `Canvas click at (${smokePx},${smokePy}) did not change pixel data — UI did not accept the edit. before=${JSON.stringify(beforePixel)} after=${JSON.stringify(afterPixel)}`,
              control: 'canvas_smoke',
            });
            preflightPassed = false;
          }

          preflightResults['canvas_smoke_test'] = {
            passed: !!pixelsChanged,
            inspector_opened: panelVisible,
            before_pixel: beforePixel,
            after_pixel: afterPixel,
            pixels_changed: !!pixelsChanged,
          };
          console.log(`[phase:preflight] canvas smoke test: ${pixelsChanged ? 'PASS' : 'FAIL'} (pixels ${pixelsChanged ? 'changed' : 'unchanged'})`);
        }
      } catch (err) {
        fail('ui_blocked', { message: `Canvas smoke test failed: ${err.message}`, control: 'canvas_smoke' });
        preflightPassed = false;
      }
    }

    console.log(`[phase:preflight] ${Object.keys(preflightResults).length} controls checked`);
    for (const [name, info] of Object.entries(preflightResults)) {
      if (typeof info === 'number') {
        console.log(`  ${name}: ${info}`);
      } else if (info.passed !== undefined) {
        console.log(`  ${name}: ${info.passed ? 'PASS' : 'FAIL'}`);
      } else {
        const status = !info.exists ? 'MISSING' : !info.visible ? 'HIDDEN' : !info.enabled ? 'DISABLED' : 'ok';
        console.log(`  ${name}: ${status} (${info.tagName || '?'})`);
      }
    }

    if (!preflightPassed) {
      console.log('[phase:preflight] FAIL — controls missing, hidden, disabled, or non-actionable');
      writeReport(null, null);
      await browser.close();
      process.exit(1);
    }
    console.log('[phase:preflight] PASS — all controls visible, enabled, and actionable');

    // ========================================================
    // PHASE 3: EXECUTE RECIPE (user-reachable actions only)
    // Every action uses visible DOM controls via Playwright.
    // No __wb_debug. No direct state mutation.
    // ========================================================
    console.log(`[phase:execute] dispatching ${recipe.actions.length} actions...`);
    let actionCount = 0;
    let actionErrors = [];

    for (const action of recipe.actions) {
      try {
        switch (action.action) {
          case 'open_inspector': {
            await page.dblclick(action.selector);
            await page.waitForTimeout(300);
            break;
          }

          case 'wait_visible': {
            await page.waitForSelector(action.selector, {
              state: 'visible',
              timeout: action.timeout_ms || 3000,
            });
            break;
          }

          case 'select_tool': {
            await page.click(action.selector);
            await page.waitForTimeout(100);
            break;
          }

          case 'clear_frame': {
            await page.click(action.selector);
            await page.waitForTimeout(200);
            break;
          }

          case 'set_glyph_code': {
            // Clear and fill the number input, then dispatch input event
            await page.fill(action.selector, '');
            await page.fill(action.selector, action.value);
            await page.dispatchEvent(action.selector, 'input');
            break;
          }

          case 'set_fg_color':
          case 'set_bg_color': {
            // Color inputs require evaluate to set value + dispatch events.
            // This simulates the user picking a color in the browser's color dialog.
            await page.evaluate(({ selector, value }) => {
              const el = document.querySelector(selector);
              if (el) {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, { selector: action.selector, value: action.value });
            break;
          }

          case 'paint_cell': {
            // Compute pixel coords from cell coords and zoom
            const zoom = await page.evaluate(() => {
              const el = document.querySelector('#inspectorZoom');
              return parseInt(el?.value || '10', 10);
            });
            const px = action.cx * zoom + Math.floor(zoom / 2);
            const py = action.cy * 2 * zoom + Math.floor(zoom / 2);

            // Validate coords are within canvas bounds
            const canvasSize = await page.evaluate(() => {
              const c = document.querySelector('#cellInspectorCanvas');
              return c ? { w: c.width, h: c.height } : null;
            });
            if (!canvasSize || px >= canvasSize.w || py >= canvasSize.h) {
              fail('ui_blocked', {
                message: `Cell (${action.cx},${action.cy}) at px=(${px},${py}) is outside canvas ${canvasSize?.w}x${canvasSize?.h} at zoom=${zoom}`,
                action: 'paint_cell', cx: action.cx, cy: action.cy,
              });
              actionErrors.push({ action, error: 'out of canvas bounds' });
              break;
            }

            await page.click(action.selector, { position: { x: px, y: py } });
            break;
          }

          default:
            fail('ui_missing', { message: `Unknown action type: ${action.action}` });
            actionErrors.push({ action, error: 'unknown action' });
        }

        actionCount++;
        if (actionCount % 500 === 0) {
          process.stdout.write(`[phase:execute] ${actionCount}/${recipe.actions.length} actions\r`);
        }

      } catch (err) {
        fail('ui_blocked', {
          message: `Action "${action.action}" failed: ${err.message}`,
          selector: action.selector, action: action.action,
        });
        actionErrors.push({ action, error: err.message });
      }
    }
    console.log(`[phase:execute] ${actionCount} actions executed (${actionErrors.length} errors)`);

    // ========================================================
    // PHASE 4: VERIFY (export via real button, compare)
    // Clicks the visible Export XP button, reads the result,
    // then compares the exported XP against the oracle truth table.
    // ========================================================
    console.log('[phase:verify] clicking Export XP...');

    // Check export button is enabled
    const exportEnabled = await page.evaluate(() => {
      const btn = document.querySelector('#btnExport');
      return btn && !btn.disabled;
    });

    if (!exportEnabled) {
      fail('export_missing', { message: 'Export XP button (#btnExport) is missing or disabled' });
      writeReport(null, null);
      await browser.close();
      process.exit(1);
    }

    await page.click('#btnExport');
    await page.waitForTimeout(3000);

    // Read export result from visible #exportOut element
    const exportResult = await page.evaluate(() => {
      const el = document.querySelector('#exportOut');
      try { return JSON.parse(el?.textContent || '{}'); } catch { return null; }
    });

    if (!exportResult || !exportResult.xp_path) {
      fail('export_missing', { message: `Export did not produce xp_path: ${JSON.stringify(exportResult)}` });
      writeReport(exportResult, null);
      await browser.close();
      process.exit(1);
    }

    console.log(`[phase:verify] exported to ${exportResult.xp_path}`);

    // Compare exported XP against truth table by re-reading via the oracle
    // Run truth_table.py on the exported XP and compare cell-by-cell
    const { execSync } = await import('child_process');
    let exportedTruth;
    try {
      const cmd = `python3 "${path.join(__dirname, 'truth_table.py')}" "${exportResult.xp_path}" --output /tmp/xp-fidelity-exported-truth.json`;
      execSync(cmd, { stdio: 'pipe' });
      exportedTruth = JSON.parse(fs.readFileSync('/tmp/xp-fidelity-exported-truth.json', 'utf-8'));
    } catch (err) {
      fail('xp_mismatch', { message: `Failed to read exported XP: ${err.message}` });
      writeReport(exportResult, null);
      await browser.close();
      process.exit(1);
    }

    // Compare layer 2 cells
    const exportedLayer2 = exportedTruth.layers.find(l => l.index === 2);
    if (!exportedLayer2) {
      fail('xp_mismatch', { message: 'Exported XP has no layer 2' });
      writeReport(exportResult, null);
      await browser.close();
      process.exit(1);
    }

    const exportedLookup = {};
    for (const cell of exportedLayer2.cells) {
      exportedLookup[`${cell.x},${cell.y}`] = cell;
    }

    const mismatches = [];
    let matchCount = 0;
    const totalCells = layer2Info.width * layer2Info.height;

    for (let y = 0; y < layer2Info.height; y++) {
      for (let x = 0; x < layer2Info.width; x++) {
        const key = `${x},${y}`;
        const expected = layer2Truth[key];
        const actual = exportedLookup[key];

        if (!actual) {
          mismatches.push({ x, y, expected, actual: null, reason: 'missing_in_export' });
          continue;
        }

        const ok =
          expected.glyph === actual.glyph &&
          expected.fg[0] === actual.fg[0] && expected.fg[1] === actual.fg[1] && expected.fg[2] === actual.fg[2] &&
          expected.bg[0] === actual.bg[0] && expected.bg[1] === actual.bg[1] && expected.bg[2] === actual.bg[2];

        if (ok) {
          matchCount++;
        } else {
          mismatches.push({
            x, y,
            expected: { glyph: expected.glyph, fg: expected.fg, bg: expected.bg },
            actual: { glyph: actual.glyph, fg: actual.fg, bg: actual.bg },
            reason: 'value_mismatch',
          });
        }
      }
    }

    if (mismatches.length > 0) {
      fail('xp_mismatch', {
        message: `${mismatches.length}/${totalCells} cells differ between oracle and export`,
        mismatch_count: mismatches.length,
      });
    }

    writeReport(exportResult, { matchCount, totalCells, mismatches });
    await browser.close();
    const passed = failures.length === 0;
    process.exit(passed ? 0 : 1);

  } catch (err) {
    console.error(`[fidelity] FATAL: ${err.message}`);
    console.error(err.stack);
    writeReport(null, null);
    await browser.close();
    process.exit(2);
  }

  function writeReport(exportResult, comparison) {
    const passed = failures.length === 0;
    const report = {
      verdict: passed ? 'PASS' : 'FAIL',
      failure_count: failures.length,
      failures,
      failure_classes: [...new Set(failures.map(f => f.class))],
      source: recipe.source,
      canvas: recipe.canvas,
      total_cells: layer2Info.width * layer2Info.height,
      skipped_layers: recipe.skipped_layers,
      comparison: comparison ? {
        matched: comparison.matchCount,
        mismatched: comparison.mismatches.length,
        match_pct: ((comparison.matchCount / comparison.totalCells) * 100).toFixed(2) + '%',
        first_mismatches: comparison.mismatches.slice(0, 20),
      } : null,
      export: exportResult ? { xp_path: exportResult.xp_path } : null,
      preflight: preflightResults,
      recipe_stats: recipe.stats,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report, null, 2));

    console.log('');
    console.log(`===== ${report.verdict} =====`);
    if (comparison) {
      console.log(`${comparison.matchCount}/${comparison.totalCells} cells match (${report.comparison.match_pct})`);
    }
    if (failures.length > 0) {
      console.log(`Failure classes: ${report.failure_classes.join(', ')}`);
      console.log(`Failures (${failures.length}):`);
      for (const f of failures.slice(0, 10)) {
        console.log(`  [${f.class}] ${f.message}`);
      }
      if (failures.length > 10) console.log(`  ... and ${failures.length - 10} more`);
    }
    console.log(`Report: ${path.join(outDir, 'result.json')}`);
  }
}

main();
```

### Step 2: Test (requires server)

```bash
# Generate truth + recipe
python3 scripts/xp_fidelity_test/truth_table.py sprites/player-0100.xp --output /tmp/tt.json
python3 scripts/xp_fidelity_test/recipe_generator.py --truth-table /tmp/tt.json --output /tmp/recipe.json

# Run (server must be running)
node scripts/xp_fidelity_test/run_fidelity_test.mjs \
  --truth-table /tmp/tt.json \
  --recipe /tmp/recipe.json \
  --xp sprites/player-0100.xp \
  --headed

# Expected: FAIL with structured failure report (ui_missing, ui_blocked, or xp_mismatch)
# This failure is useful evidence about what the current UI can and cannot do.
```

### Step 3: Commit

```bash
git add scripts/xp_fidelity_test/run_fidelity_test.mjs
git commit -m "feat: add user-action conformance executor for XP fidelity test"
```

---

## Task 4: Shell Wrapper

**Files:**
- Create: `scripts/xp_fidelity_test/run.sh`

### Step 1: Write

```bash
#!/usr/bin/env bash
# scripts/xp_fidelity_test/run.sh
#
# XP Fidelity Test — full pipeline (single-frame, upload-xp sessions)
#
# Usage:
#   scripts/xp_fidelity_test/run.sh <xp_file> [--headed] [--url <url>]
#
# The XP is uploaded via /api/workbench/upload-xp, which creates a session
# with geometry 1,1,1 (entire grid = 1 frame). The recipe generator assumes
# this geometry — global coords = frame-local coords. Multi-frame sessions
# are out of scope for this harness version.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
XP_FILE="${1:?Usage: $0 <xp_file> [--headed] [--url <url>]}"
shift

URL="http://127.0.0.1:5071/workbench"
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

TS=$(date +%Y%m%dT%H%M%S)
TRUTH="/tmp/xp-fidelity-truth-${TS}.json"
RECIPE="/tmp/xp-fidelity-recipe-${TS}.json"

echo "=== XP Fidelity Test — User-Action Conformance ==="
echo "Source:   ${XP_FILE}"
echo "Geometry: 1,1,1 (upload-xp single-frame)"
echo "Expected: setup abort (no job_id) on unmodified master; structured FAIL after prerequisite patch"
echo ""

# Phase 1: Truth table (oracle)
echo "[1/3] Extracting truth table..."
python3 "${SCRIPT_DIR}/truth_table.py" "${XP_FILE}" --output "${TRUTH}"

# Phase 2: Recipe (single-frame)
echo "[2/3] Generating UI action recipe..."
python3 "${SCRIPT_DIR}/recipe_generator.py" \
  --truth-table "${TRUTH}" \
  --output "${RECIPE}"

# Phase 3: Execute + Verify
echo "[3/3] Executing in browser (user-action only)..."
node "${SCRIPT_DIR}/run_fidelity_test.mjs" \
  --truth-table "${TRUTH}" \
  --recipe "${RECIPE}" \
  --xp "${XP_FILE}" \
  --url "${URL}" \
  "${EXTRA_ARGS[@]}"

EXIT=$?
rm -f "${TRUTH}" "${RECIPE}"
exit $EXIT
```

### Step 2: Make executable, test

```bash
chmod +x scripts/xp_fidelity_test/run.sh

# Full test (expected: structured FAIL)
scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --headed
```

### Step 3: Commit

```bash
git add scripts/xp_fidelity_test/run.sh
git commit -m "feat: add one-command XP fidelity test wrapper"
```

---

## Task 5: Test Fixture + README

**Files:**
- Create: `scripts/xp_fidelity_test/create_fixture.py`
- Create: `scripts/xp_fidelity_test/README.md`

### Step 1: Write fixture creator

```python
# scripts/xp_fidelity_test/create_fixture.py
"""
Create a small 5x3 XP test fixture with known cell values.

Layer 2 pattern:
  Row 0: A(red/black) B(green/black) C(blue/black) D(yellow/black) E(white/black)
  Row 1: ?(cyan/gray) @(mag/white)  #(orange/dk)   $(pink/navy)   %(lime/brown)
  Row 2: full-block(white/transparent) for all 5 cells

Usage:
  python3 create_fixture.py [--output <path>]
"""
import sys, os, struct, gzip

MAGENTA = (255, 0, 255)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
WIDTH, HEIGHT, LAYERS = 5, 3, 4

LAYER2 = [
    [(65,(255,0,0),BLACK),(66,(0,255,0),BLACK),(67,(0,0,255),BLACK),(68,(255,255,0),BLACK),(69,WHITE,BLACK)],
    [(63,(0,255,255),(128,128,128)),(64,(255,0,255),WHITE),(35,(255,165,0),(40,40,40)),(36,(255,192,203),(0,0,128)),(37,(0,255,0),(139,69,19))],
    [(219,WHITE,MAGENTA)]*5,
]

def build():
    transparent = [(0,WHITE,MAGENTA)]*WIDTH
    l0 = [[(49,WHITE,MAGENTA)]+[(0,WHITE,MAGENTA)]*(WIDTH-1)] + [transparent[:] for _ in range(HEIGHT-1)]
    l1 = [transparent[:] for _ in range(HEIGHT)]
    l3 = [transparent[:] for _ in range(HEIGHT)]
    buf = bytearray()
    buf += struct.pack('<i', -1)
    buf += struct.pack('<i', LAYERS)
    for layer in [l0, l1, LAYER2, l3]:
        buf += struct.pack('<ii', WIDTH, HEIGHT)
        for x in range(WIDTH):
            for y in range(HEIGHT):
                g, fg, bg = layer[y][x]
                buf += struct.pack('<I', g)
                buf += bytes(fg) + bytes(bg)
    return gzip.compress(bytes(buf))

def main():
    out = 'sprites/fidelity-test-5x3.xp'
    if '--output' in sys.argv:
        out = sys.argv[sys.argv.index('--output')+1]
    data = build()
    with open(out, 'wb') as f: f.write(data)
    print(f"Created {out} ({WIDTH}x{HEIGHT}, {LAYERS} layers, {len(data)} bytes)")

if __name__ == '__main__': main()
```

### Step 2: Write README

Create `scripts/xp_fidelity_test/README.md`:

```markdown
# XP Fidelity Test — User-Action Conformance

Red/green gate for workbench XP editing. Tests whether the UI can recreate
XP cell data through real user-reachable actions only.

## Contract

- **Oracle**: Python reads source XP into truth table (exact cell values)
- **Executor**: tries to reproduce layer 2 using only visible DOM controls
- **Verifier**: clicks Export XP, compares exported XP against oracle

### User-reachable means

- Visible DOM controls: clicks, typing, color pickers
- Normal export flow: Export XP button
- NO `window.__wb_debug`
- NO direct JS state mutation
- NO hidden inputs

### Failure classes

| Class | Meaning |
|-------|---------|
| `ui_missing` | Required DOM control does not exist |
| `ui_blocked` | Control exists but can't complete action |
| `ui_behavior_mismatch` | Action works but cell data is wrong |
| `export_missing` | No normal export path |
| `xp_mismatch` | Export succeeds but doesn't match oracle |

## Expected Results

**Unmodified master:** Setup abort — `upload-xp` returns no `job_id`, executor exits before any UI interaction.

**After backend prerequisite patch:** Structured FAIL — setup completes, executor exercises real UI, failure report documents what's missing or broken. When the UI improves, the same test starts passing — no different test needed.

## Architecture

```
truth_table.py → recipe_generator.py → run_fidelity_test.mjs
   (oracle)        (UI actions)         (preflight + execute + verify)
```

## Usage

```bash
# Start server
PYTHONPATH=src python3 -m pipeline_v2.app &

# Run (expected: FAIL with structured report)
scripts/xp_fidelity_test/run.sh sprites/fidelity-test-5x3.xp --headed
```

## Output

`output/xp-fidelity-test/fidelity-<timestamp>/result.json`

Contains: verdict, failure classes, preflight results, comparison stats, first mismatches.
```

### Step 3: Generate fixture, commit all

```bash
python3 scripts/xp_fidelity_test/create_fixture.py
git add scripts/xp_fidelity_test/create_fixture.py scripts/xp_fidelity_test/README.md sprites/fidelity-test-5x3.xp
git commit -m "feat: add test fixture and docs for XP fidelity test"
```

---

## Backend Prerequisite: `upload-xp` Returns `job_id`

**This change must be applied before the fidelity test can run.**

### Current behavior (`service.py:2029-2054`)

`workbench_upload_xp()` creates a `WorkbenchSession` with `job_id=""` and returns `{session_id, grid_cols, grid_rows, cell_count, layer_count}`. There is no job record, so `workbench_load_from_job()` cannot load it, and the frontend's `loadFromJob()` boot path (`workbench.js:6866`) has no `job_id` to use.

### Required change

`workbench_upload_xp()` must:
1. Save the uploaded XP bytes to disk as a `.xp` file (so `workbench_load_from_job` can read it at `job["xp_path"]`)
2. Create a minimal job JSON at `_job_path(job_id)` with:
   - `xp_path`: path to the saved XP file
   - `metadata`: `{ "angles": 1, "anims": [1], "projs": 1, "cell_w_chars": 12, "cell_h_chars": 12, "render_resolution": 12, "family": "uploaded" }`
3. Set `job_id` on the `WorkbenchSession` (instead of `""`)
4. Return `job_id` in the response alongside `session_id`

### Why this approach

- **No frontend changes.** The existing `loadFromJob()` path handles all state initialization correctly: `state.cells`, geometry, `activeLayer=2`, `visibleLayers`, `btnExport.disabled=false`, `syncLayersFromSessionCells()`, `renderAll()` — all ~80 lines at `workbench.js:3541-3598`.
- **No new debug surface.** No `__wb_debug.loadSession()` to maintain.
- **No fake state hydration.** No `page.evaluate(() => { state.* = ... })` which can't even reach IIFE-private `state` anyway.
- **Additive, not breaking.** Existing callers of `upload-xp` that don't use `job_id` are unaffected — the field is added to the response, not removed.

### Semantics change

`upload-xp` now creates a job record in addition to a session. This is a real semantic change: an uploaded XP is now loadable through the standard workbench `?job_id=<id>` URL, not just a detached session. This is intentional — it makes uploaded XPs first-class citizens in the workbench, not a dead-end path.

### Sketch (not executable — adapt to actual job record structure)

```python
# In workbench_upload_xp(), after parsing and creating cells:

# Save XP bytes to disk so workbench_load_from_job can find them
job_id = str(uuid.uuid4())
xp_disk_path = JOBS_DIR / f"{job_id}.xp"
xp_disk_path.write_bytes(xp_bytes)

# Create minimal job record that workbench_load_from_job() can consume.
# workbench_load_from_job reads: job["xp_path"], job["metadata"]["angles"],
# job["metadata"]["anims"], job["metadata"]["projs"],
# job["metadata"].get("cell_w_chars", job["metadata"]["render_resolution"]),
# job["metadata"].get("family", "player")
# See service.py:1857-1866.
job_record = {
    "job_id": job_id,
    "xp_path": str(xp_disk_path),
    "status": "completed",
    "metadata": {
        "angles": 1,
        "anims": [1],
        "projs": 1,
        "source_projs": 1,
        "cell_w_chars": 12,
        "cell_h_chars": 12,
        "render_resolution": 12,
        "family": "uploaded",
    },
}
save_json(_job_path(job_id), job_record)

# Update session to reference the job
sess = WorkbenchSession(
    session_id=session_id,
    job_id=job_id,           # was: ""
    # ... rest unchanged ...
)

# Add job_id to response
return {
    "session_id": session_id,
    "job_id": job_id,          # NEW
    "grid_cols": cols,
    # ... rest unchanged ...
}
```

---

## Verification Checklist

- [ ] Backend prerequisite: `upload-xp` returns `job_id` in response
- [ ] Backend prerequisite: `workbench_load_from_job(job_id)` succeeds for upload-xp-created jobs
- [ ] `truth_table.py sprites/player-0100.xp` → outputs 4 layers, correct dimensions
- [ ] `recipe_generator.py` → single-frame recipe (geometry 1,1,1), paint_cell coords equal truth table (x, y)
- [ ] Recipe emits exactly 1 `open_inspector` action targeting frame (0, 0)
- [ ] Recipe `geometry` field is `{"angles": 1, "anims": [1], "projs": 1}`
- [ ] `run.sh sprites/fidelity-test-5x3.xp --headed` → structured FAIL with report
- [ ] `result.json` has `failure_classes` field listing which classes triggered
- [ ] `result.json` has `preflight` field showing each selector's visible/enabled/actionable status
- [ ] Preflight checks visibility (not just DOM presence): `display !== 'none'`, `visibility !== 'hidden'`, `opacity !== '0'`, `rect.width > 0`
- [ ] Preflight canvas smoke test: dblclick frame cell → inspector opens, canvas click changes pixel data at click point
- [ ] If preflight passes: executor dispatches click/fill/type actions (no `__wb_debug` calls in browser console)
- [ ] If export works: verifier compares cell-by-cell via oracle (re-reads exported XP through truth_table.py)
- [ ] No `page.evaluate` in any phase sets `state.*` or calls any app-internal function
- [ ] Phase 1 uses `upload-xp` → `job_id` → navigate to `/workbench?job_id=<id>` → `loadFromJob()` boot path (no direct state mutation)
- [ ] Failure report is actionable: tells you which controls are missing, hidden, disabled, or what cell values differ

## Risks

1. **Backend prerequisite** — The `upload-xp` endpoint must be modified to return a `job_id` (see "Backend Prerequisite" section above). On current unmodified master, `upload-xp` creates a detached session with `job_id=""` (`service.py:2033`) and returns only `{session_id, grid_cols, grid_rows, ...}`. The executor checks for `uploadResp.job_id` and aborts with a clear error if missing. The backend change is small (~15 lines in `service.py`) and does not alter the upload-xp contract for existing callers — it adds fields to the response.

2. **Canvas coordinate precision** — The pixel coordinate formula assumes the inspector canvas renders cells at integer zoom boundaries. If the canvas has padding, borders, or DPI scaling, clicks may land on wrong cells. Mitigation: the fixture uses a small 5x3 grid where cells are large relative to any rounding error.

3. **Color input interaction** — `<input type="color">` requires `page.evaluate` to set value + dispatch events (Playwright `fill()` doesn't work on color inputs). This is clearly simulating user color-picker interaction on a visible control, not state mutation, but the pattern should be documented.

4. **Export timing** — The Export XP button saves session state before exporting (`wait_for_idle: true, timeout_ms: 15000`). The test waits 3 seconds after clicking Export, then reads `#exportOut`. If the save+export takes longer, the test may read stale output. Mitigation: retry read with timeout.

5. **Large XP overhead** — `player-0100.xp` has 10,080 cells. Each paint_cell action requires a `page.click()` call with Playwright overhead. For the first run, use the 5x3 fixture (15 cells). For production, batch timing or zoom adjustment may be needed.

## Known Limitations

1. **Single-frame only** — This harness is scoped to `upload-xp` sessions (geometry `1,1,1`). Multi-frame XPs loaded via the pipeline path get real geometry (`angles > 1`, etc.) which this harness cannot set up or decompose correctly. Extending to multi-frame requires: (a) a setup path that creates sessions with non-default geometry, (b) handling `recomputeFrameGeometry()`'s non-exact-division fallback to `cellWChars`/`cellHChars` (`workbench.js:1839-1840`), and (c) passing effective frame cell dimensions alongside `angles`/`anims`/`projs`.

2. **REXPaint grid parity unverified** — The workbench grid overlay (`workbench.js:3239-3255`) is canvas stroke styling, not a verified match for REXPaint's grid behavior. The REXPaint manual says only "`Ctrl-g Toggle Grid`" with no visual specification. We cannot confirm parity.
