# Milestone 2: Source-Panel Implementation Spec

Date: 2026-03-21
Status: implementation-ready draft
Method: Direct code audit of `web/workbench.js` (7382 lines), `web/workbench.html`, `web/styles.css`, `config/template_registry.json`
Based on: `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`, `docs/plans/2026-03-21-milestone-2-implementation-checklist.md`, `docs/WORKBENCH_SOURCE_PANEL_UX_CHECKLIST.md`

---

## 1. Template Guide Overlay

### Status: [PLANNED] — specified in M2-B.1 of the implementation checklist, no code exists

### Current Reality

The `renderSourceCanvas()` function (JS:2500-2594) draws:
- Checkerboard background (JS:2508-2516)
- Source image (JS:2549)
- Vertical cut lines (JS:2551-2562)
- Committed sprite boxes in amber/gold (JS:2564-2568)
- Anchor box in green dashed (JS:2569-2571)
- Draft box in blue (JS:2572-2575)
- Row/column drag region (JS:2576-2586)

There is **no** template guide overlay rendering. The function ends with a text summary at JS:2592 and returns.

### Data Source

Template data is available at runtime via `state.templateRegistry`, fetched by `fetchTemplateRegistry()` (JS:6040-6048). The active template set is accessed via `getActiveTemplateSet()` (JS:6051-6053).

Each action in the template registry (`config/template_registry.json`) contains:
- `xp_dims`: `[cols, rows]` — total grid dimensions in chars (e.g., `[126, 80]` for player idle)
- `angles`: number of angle rows (e.g., `8`)
- `frames`: array of frame counts per animation category (e.g., `[1, 8]`)
- `projs`: projection count (e.g., `2`)
- `cell_w`: frame width in chars (e.g., `7`)
- `cell_h`: frame height in chars (e.g., `10`)

These values are sufficient to compute a full guide grid:
- Total frame columns = `sum(frames) * projs`
- Total frame rows = `angles`
- Pixel-space frame width = `cell_w * render_resolution` (from `wbRenderRes` input, default 12)
- Pixel-space frame height = `cell_h * render_resolution`

### Planned Implementation

**Where to add:** Inside `renderSourceCanvas()`, after drawing the source image (JS:2549) and before drawing committed boxes (JS:2564). The overlay should render below sprite boxes so it doesn't interfere with box interaction.

**What to render:**
1. A grid of semi-transparent dashed lines showing expected frame boundaries on the source image.
2. Lines derived from: `frameCols * pixelFrameW` (vertical) and `angles * pixelFrameH` (horizontal).
3. Color: distinct from box colors — recommended `rgba(120,180,255,0.35)` (light blue, low opacity).
4. Line style: dashed `[6, 6]`, 1px width.
5. Optional per-frame labels at the top-left of each cell: e.g., "A0 F0" in 9px font, same blue, only when zoom >= 2x to avoid clutter.

**Toggle control:** Add a checkbox `<input id="showTemplateGuide" type="checkbox">` next to the Source Zoom control in the HTML (after line 97). Store state in `state.showTemplateGuide` (default: `true` when bundle mode is active, `false` otherwise).

**Guard:** Only render when:
- `isBundleMode()` is true
- An active action spec exists with `cell_w`, `cell_h`, `angles`
- A source image is loaded

**Pixel mapping:** The guide lines assume the source PNG corresponds to the expected grid layout. If the image dimensions do not match `xp_dims[0] * renderRes` by `xp_dims[1] * renderRes`, render the guide lines at calculated positions anyway (they serve as a hint, not a constraint).

### Open Questions
- Should guide lines scale with source zoom? Yes — they are drawn on the canvas coordinate space, which is already zoom-independent (zoom is applied via CSS `width`/`height` scaling on the canvas element).
- Should there be a "snap to guide" feature? Deferred to post-M2.

---

## 2. Bbox Labeling / Expected Dims Hints

### Status: [PARTIAL] — basic info text exists, numeric bbox readout and expected dims hints do not

### Current Reality

**Source info text** (JS:2588-2592): The `#sourceInfo` div displays a summary string:
```
sprites_detected=N anchor=WxH draft=WxH selected=N cutsV=N
```

This is informational but does not show:
- Individual bbox coordinates (`x, y, w, h`) for the selected box
- Expected frame dimensions from the active template
- Pixel-to-char dimension mapping

**Mode hint text** (JS:4134-4147): The `#sourceModeHint` div shows mode-specific instructions ("Mode: Draw Box. Drag to create a draft..."). This updates correctly per mode.

**Frame tile tooltips** (JS:2351): Grid frame tiles have tooltips like `Angle 0 (South), Frame 0, Proj 0`. This exists and is functional.

**No expected dims display:** There is no UI element that shows "Expected frame size: 7w x 10h chars (84x120 px)" from the template.

### Planned Implementation

#### 2a. Numeric Bbox Readout [NEW]

**Status: [NEW] — UX checklist item 17 lists this as DEFERRED; promoting to M2**

Add a `<span id="sourceBboxReadout" class="small">` element inside the source panel, after `#sourceInfo` (HTML after line 102).

Update logic: At the end of `renderSourceCanvas()` or in a dedicated `updateSourceBboxReadout()` function called after `renderSourceCanvas()`:
- If exactly one box is selected: display `bbox: x=N y=N w=N h=N (WxH chars at res R)`
  - Char dimensions: `Math.ceil(w / renderRes)` x `Math.ceil(h / renderRes)`
- If draft box exists: display `draft: x=N y=N w=N h=N`
- If nothing selected: display empty or nothing

**Implementation cost:** ~15 lines of JS, 1 line of HTML.

#### 2b. Expected Dims Hint [NEW]

**Status: [NEW] — mentioned in M2-B.3 of the implementation checklist as "template-aware source panel labeling"**

Add a `<div id="templateDimsHint" class="small">` element above or below the source canvas (HTML between lines 98 and 99).

Populate when bundle mode is active:
```
Expected: 7w x 10h chars/frame, 8 angles, 9 frames, 2 projs (126x80 grid, 84x120 px/frame at res 12)
```

Update in `renderSourceCanvas()` or on template/action switch. Clear when not in bundle mode.

**Implementation cost:** ~20 lines of JS, 1 line of HTML.

---

## 3. Row Drag / Selected-Row Sequence Insertion

### Status: [EXISTS] — fully implemented and functional

### Current Reality — Verified by Code Audit

#### Drag Interaction Model

**Source-panel drag modes** (JS:4108-4117, `setSourceMode()`):
- `row_select` mode: Activated by "Drag Row" button (HTML:84) or `R` key (JS:6909)
- `col_select` mode: Activated by "Drag Column" button (HTML:85) or `C` key (JS:6911)

**Mouse event handling:**
- `onSourceMouseDown()` (JS:4320): When mode is `row_select` or `col_select`, initiates drag with `state.sourceDrag = { type: d_type, start: pt, modifiers: {...} }`
- `onSourceMouseMove()` (JS:4426-4427): Updates `state.sourceRowDrag = { mode: d.type, rect: normalizeBox(d.start, pt) }` — draws a dashed overlay rectangle
- `onSourceMouseUp()` (JS:4487-4491): Finalizes drag, calls `applySourceBoxSelectionRect(type, rect, modifiers)` to select intersecting boxes

**Visual feedback:** Row drag region rendered as dashed yellow rectangle (row_select) or dashed orange (col_select) at JS:2576-2586.

#### Selection Semantics (all implemented per UX checklist item 10)

- Plain drag: replaces selection
- Selection hit-test: uses intersection (not full containment)
- Plain click: selects one box, clears others
- Cmd/Ctrl+click: toggles one box
- Shift+drag: adds to selection
- Alt/Option+drag: subtracts from selection

Modifier detection is passed via `d.modifiers` from `onSourceMouseDown()`.

#### Selected Rows Map to Animation Sequence Slots

**`addSourceBoxToSelectedRowSequence(box)`** (JS:5192-5222):
1. Checks `state.selectedRow !== null` (a grid row must be selected first)
2. Finds next available column via `nextAppendColForRow(row)` (JS:5101-5111)
3. Rasterizes the source box to char cells via `frameCellsFromSourceBox(box)` (JS:4721-4753)
4. Writes to the grid frame via `writeSourceCellsToFrame(row, col, cells)` (JS:5065-5075)
5. Updates selection to the newly filled column
6. Calls `renderAll()` and `saveSessionState()`

**Context menu wiring** (JS:6454-6463): "Add to selected row sequence" button calls this flow, handling both draft and committed box sources.

#### Multi-Select Behavior

**Drag-and-drop to grid** (JS:4446-4457, JS:5180-5189):
- When source boxes are selected and dragged outside the source canvas, `dropSelectedSourceBoxesAtClientPoint()` fires
- Calls `insertSourceBoxesIntoGridAt(boxes, targetRow, startCol)` (JS:5113-5167)
- Multiple selected boxes are grouped by source-image rows via `groupSourceBoxesByRows()` (JS:5077-5099)
- Multi-row drops span multiple grid rows (e.g., 2 source rows -> 2 grid rows)
- Boxes within each row are sorted left-to-right and placed in sequential columns starting from `startCol`

### No Changes Needed

This feature area is complete. The only M2-relevant enhancement would be:
- Better visual feedback during cross-panel drag (e.g., ghost preview on grid) — but this is post-M2 polish.

---

## 4. Source-Panel Pan

### Status: [PLANNED] — UX checklist item 17 marks this as DEFERRED; M2 plan promotes it

### Current Reality

**Zoom exists** (JS:3927-3944, HTML:93-97):
- Slider input `#sourceZoomInput` with range 1-6x, step 0.5
- `updateSourceCanvasZoomUI()` applies zoom by setting CSS `width`/`height` on the canvas element
- The canvas itself always renders at native pixel dimensions; zoom is purely display scaling

**Scroll exists via CSS overflow** (styles.css:104-116):
- `.canvas-wrap` has `overflow: auto; max-height: 420px;`
- When the source image (or zoomed canvas) exceeds the container, native scrollbars appear
- This provides basic pan via scrollbar drag or scroll wheel

**No programmatic pan control exists:**
- No pan offset state (`state.sourcePanX`, `state.sourcePanY`)
- No middle-click or spacebar+drag pan gesture
- No "fit to view" or "1:1" buttons
- No keyboard pan (arrow keys are bound to box nudge in select mode)

### Planned Implementation

#### 4a. Spacebar+Drag Pan [NEW]

When the spacebar is held and the user drags on the source canvas:
- Suppress normal mode behavior (draw/select/etc.)
- Instead, scroll the `.canvas-wrap` container by the drag delta
- Implementation: track `state.sourcePanning` flag, set on spacebar keydown (when source canvas is focused), clear on keyup
- In `onSourceMouseDown/Move/Up`, check `state.sourcePanning` and adjust `sourceCanvasWrap.scrollLeft`/`scrollTop` instead of normal drag

**Cursor:** Change cursor to `grab`/`grabbing` during pan.

#### 4b. Fit / Reset View Buttons [NEW]

Add two buttons next to the zoom slider:
- `Fit` — calculates zoom level to fit source image within `.canvas-wrap` bounds
- `1:1` — resets zoom to 1x

**Implementation cost:** ~30 lines of JS, ~5 lines of HTML.

#### 4c. Scroll Wheel Zoom [NEW]

When Ctrl+scroll is used over the source canvas:
- Adjust `state.sourceCanvasZoom` by +/- 0.5 per wheel tick
- Center the zoom on the cursor position (adjust scroll offsets to keep the pointed pixel stable)

**Implementation cost:** ~20 lines of JS.

### Zoom Considerations

Current zoom range (1x-6x) may be insufficient for very large source sheets. Consider extending max to 8x or 10x. The current CSS-based zoom approach is performant since the canvas is rendered once at native resolution.

---

## 5. Source/Grid Stability Expectations

### Status: [PARTIAL] — stability mechanisms exist but are not explicitly documented or fully tested

### What Should NOT Change When Source Panel Is Manipulated

#### 5a. Grid Cell Data Preservation [EXISTS]

**Guarantee:** Drawing, moving, resizing, deleting, or selecting source boxes MUST NOT modify grid cell data (`state.layers`, `state.cells`).

**Verification:** All source-panel mouse handlers (`onSourceMouseDown/Move/Up`, JS:4320-4506) only mutate source-panel state:
- `state.extractedBoxes` (the source box list)
- `state.drawCurrent` (draft box)
- `state.sourceDrag` (drag state)
- `state.sourceRowDrag` (row drag state)
- `state.sourceSelection` (selected box IDs)
- `state.sourceCutsV` (cut lines)
- `state.anchorBox` (anchor reference)

Grid data is only modified when the user explicitly invokes:
- `insertSourceBoxesIntoGridAt()` — drop to grid
- `addSourceBoxToSelectedRowSequence()` — context menu "Add to selected row sequence"
- `commitDraftToSource()` — only adds to `state.extractedBoxes`, not grid

**Status: [EXISTS]** — source and grid state are cleanly separated by design.

#### 5b. Grid Selection State Preservation [EXISTS]

**Guarantee:** Source panel interactions should not change `state.selectedRow` or `state.selectedCols`.

**Verification:** Source mouse handlers do not modify `selectedRow`/`selectedCols`. Only explicit grid operations (frame click, row header click, drop-to-grid) modify these.

Exception: `insertSourceBoxesIntoGridAt()` (JS:5159-5161) updates `selectedRow`/`selectedCols` to the drop target after a successful drop — this is intentional user-initiated behavior.

**Status: [EXISTS]**

#### 5c. Whole-Sheet Editor State Preservation [EXISTS]

**Guarantee:** Source panel interactions should not cause the whole-sheet editor to lose its viewport position, tool state, or unsaved edits.

**Verification:** Source panel functions do not call any `window.__wholeSheetEditor` methods. The whole-sheet editor is only affected by:
- `panWholeSheetToFrame()` — called on grid frame selection
- `hydrateWholeSheetEditor()` — called on session load

**Status: [EXISTS]**

#### 5d. Session Metadata Preservation [EXISTS]

**Guarantee:** Source panel operations should not alter `state.angles`, `state.anims`, `state.frameWChars`, `state.frameHChars`, or `state.projs`.

**Verification:** These are only set during session load, template apply, or explicit metadata edits. Source panel handlers never touch them.

**Status: [EXISTS]**

#### 5e. Undo/Redo Consistency [PARTIAL]

**Guarantee:** Source panel operations that modify state should participate in undo/redo via `pushHistory()`.

**Verification of pushHistory() coverage:**
- Box edit (move/resize): `pushHistory()` called at JS:4402 — **covered**
- Box delete: `pushHistory()` called at JS:5226 — **covered**
- Cut line move: `pushHistory()` called at JS:4363 in the `cut_v` mode handler — **covered**
- Draw box: No `pushHistory()` for draft creation (draft is transient, committed separately) — **acceptable**
- Commit draft to source: `pushHistory()` in `commitDraftToSource()` — **covered** (JS:4254, with `skipHistory` opt-out)
- Find Sprites: `pushHistory()` called at JS:4622 before replacing `state.extractedBoxes` — **covered**
- Set anchor: No explicit `pushHistory()` at the point of anchor change; called before `saveSessionState("set-anchor")` at JS:6469 but no pushHistory — **gap**

**Status: [PARTIAL]** — 1 gap identified:
1. Set anchor does not push history

#### 5f. Session Save Consistency [EXISTS]

**Guarantee:** Source panel mutations trigger `saveSessionState()` with a descriptive reason.

**Verification:** All significant source operations call `saveSessionState()`:
- `edit-source-box` (JS:4481)
- `row_select` / `col_select` (JS:4491)
- `move-cut-v` (JS:4493)
- `find-sprites` (JS:6422)
- `set-anchor` (JS:6469)
- `delete-source-selection` / `delete-source-cut` / `delete-source-draft` (JS:5232/5241/5248)
- `clear-source-overlays` (JS:6416)
- `drop-source-selection-to-grid` (JS:5164)
- `source-box-to-row-seq` (JS:5219)

**Status: [EXISTS]**

---

## Summary: Feature Status Breakdown

| Feature | Sub-feature | Status | Code Location |
|---------|-------------|--------|---------------|
| Template guide overlay | Grid line rendering | [PLANNED] | renderSourceCanvas() JS:2500 — insertion point after JS:2549 |
| Template guide overlay | Toggle control | [NEW] | HTML after line 97 |
| Template guide overlay | Data source | [EXISTS] | state.templateRegistry, getActiveTemplateSet() JS:6051 |
| Bbox labeling | Source info text | [EXISTS] | JS:2588-2592, HTML:102 |
| Bbox labeling | Numeric bbox readout | [NEW] | UX checklist item 17 (was DEFERRED) |
| Bbox labeling | Expected dims hint | [NEW] | M2-B.3 in implementation checklist |
| Bbox labeling | Mode hint text | [EXISTS] | JS:4134-4147, HTML:98 |
| Row drag | Drag interaction model | [EXISTS] | JS:4320-4506 |
| Row drag | Selection semantics | [EXISTS] | Cmd/Shift/Alt modifiers, intersection hit-test |
| Row drag | Row sequence insertion | [EXISTS] | addSourceBoxToSelectedRowSequence() JS:5192 |
| Row drag | Multi-select drop to grid | [EXISTS] | insertSourceBoxesIntoGridAt() JS:5113 |
| Source-panel pan | CSS overflow scroll | [EXISTS] | styles.css:114 `.canvas-wrap { overflow: auto }` |
| Source-panel pan | Spacebar+drag pan | [NEW] | Not implemented |
| Source-panel pan | Fit/Reset view buttons | [NEW] | Not implemented |
| Source-panel pan | Ctrl+scroll zoom | [NEW] | Not implemented |
| Source/grid stability | Grid cell data preservation | [EXISTS] | Source handlers isolated from grid state |
| Source/grid stability | Grid selection preservation | [EXISTS] | Source handlers don't touch selectedRow/Cols |
| Source/grid stability | Whole-sheet editor preservation | [EXISTS] | No WS API calls from source handlers |
| Source/grid stability | Session metadata preservation | [EXISTS] | angles/anims/frameW/H untouched by source |
| Source/grid stability | Undo/redo consistency | [PARTIAL] | 1 gap: set anchor |
| Source/grid stability | Session save consistency | [EXISTS] | All mutations call saveSessionState() |

---

## Counts

| Status | Count |
|--------|-------|
| [EXISTS] | 15 |
| [PARTIAL] | 2 |
| [PLANNED] | 1 |
| [NEW] | 5 |

---

## Implementation Priority Within M2

1. **Template guide overlay** (PLANNED) — Core M2-B deliverable. ~50 lines JS, ~3 lines HTML. Requires bundle mode + template data. Should be toggleable.
2. **Expected dims hint** (NEW) — Supports guide overlay understanding. ~20 lines JS, ~1 line HTML.
3. **Numeric bbox readout** (NEW) — Low effort, high value for precision editing. ~15 lines JS, ~1 line HTML.
4. **Undo/redo gap fix** (PARTIAL) — Add `pushHistory()` before anchor set (JS:6465-6469). ~1 line JS.
5. **Spacebar+drag pan** (NEW) — Important for large sheets at high zoom. ~30 lines JS.
6. **Fit/Reset view buttons** (NEW) — Quality-of-life. ~15 lines JS, ~5 lines HTML.
7. **Ctrl+scroll zoom** (NEW) — Nice-to-have. ~20 lines JS.

---

## Files Referenced

- `web/workbench.js` — main workbench logic (7382 lines)
- `web/workbench.html` — workbench layout (source panel: lines 79-110, grid panel: lines 112-142)
- `web/styles.css` — `.canvas-wrap` overflow/scroll (lines 104-116), `#sourceCanvas` (lines 118-121)
- `config/template_registry.json` — template specs with `cell_w`, `cell_h`, `angles`, `frames`, `projs`
- `docs/WORKBENCH_SOURCE_PANEL_UX_CHECKLIST.md` — 20-item UX checklist (baseline 2026-02-23)
- `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md` — M2 plan
- `docs/plans/2026-03-21-milestone-2-implementation-checklist.md` — M2 implementation checklist
