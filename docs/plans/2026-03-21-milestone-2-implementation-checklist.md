# Milestone 2: Implementation-Ready Checklist

Date: 2026-03-21
Status: draft
Based on: `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`
Method: Direct codebase inspection (read-only audit)

---

## Phase M2-A: Freeze Structural PNG Baseline

### Currently exists:

- PNG upload endpoint (`/api/upload`) — status: **EXISTS** — `src/pipeline_v2/app.py`, frontend `web/workbench.js:5982`
- Bundle create endpoint (`/api/workbench/bundle/create`) — status: **EXISTS** — `src/pipeline_v2/app.py:228`
- Action-grid apply endpoint (`/api/workbench/action-grid/apply`) — status: **EXISTS** — `src/pipeline_v2/app.py:240`, backed by `bundle_action_run()` at `src/pipeline_v2/service.py:2145`
- Structural gates G10 (dimension match), G11 (layer count), G12 (L0 metadata) — status: **EXISTS** — `src/pipeline_v2/gates.py:41-82`
- `_run_structural_gates()` called on bundle export — status: **EXISTS** — `src/pipeline_v2/service.py:2770-2805`, invoked at lines 2828 and 2892
- XP fidelity test family — status: **EXISTS** — `scripts/xp_fidelity_test/` (truth tables, recipes, Playwright runner)
- Python API contract tests — status: **EXISTS** — `tests/test_contracts.py`, `tests/test_workbench_flow.py`

### Required work:

1. **Create a dedicated PNG-to-bundle non-regression test** — The existing `run_bundle.sh` tests reference-XP fidelity (loads known `.xp` files). No test currently: uploads an arbitrary PNG -> runs `bundle_action_run` -> exports XP -> validates G10-G12 pass. Write a Python test (`tests/test_png_bundle_baseline.py`) that exercises this full path for each enabled family.
2. **Create known-good PNG test fixtures** — Only `tests/fixtures/known_good/cat_sheet.png` exists. Need at least one player-format, one attack-format, and one death-format PNG fixture for baseline testing.
3. **Add G7-G9 gates to bundle export validation** — Gates G7 (geometry), G8 (nonempty), G9 (handoff) exist in `gates.py` but are NOT called in `_run_structural_gates()`. Decide whether to integrate them or document why they are excluded.
4. **Add a Skin Dock runtime smoke test for PNG baseline** — Currently manual via Playwright. Consider a headless or API-level check that confirms the exported bundle XP can be injected into the runtime iframe without crash.
5. **Document the frozen baseline contract** — Write a short baseline spec that lists exactly what structural properties are guaranteed after M2-A.

### Dependencies:
- Milestone 1 must close first (structural baseline depends on M1 correctness).

---

## Phase M2-B: Source-Panel Assisted Assembly

### Currently exists:

- `Find Sprites` button + `findSprites()` — status: **EXISTS** — `web/workbench.html:88`, `web/workbench.js:4508`
- `Draw Box` mode — status: **EXISTS** — `web/workbench.html:83`, handler at `web/workbench.js:6399`
- `Drag Row` mode — status: **EXISTS** — `web/workbench.html:84`, handler at `web/workbench.js:6400`
- `Drag Column` mode — status: **EXISTS** — `web/workbench.html:85`, handler at `web/workbench.js:6401`
- `Vertical Cut` mode — status: **EXISTS** — `web/workbench.html:86`, handler at `web/workbench.js:6402`
- `Delete Box` button — status: **EXISTS** — `web/workbench.html:87`
- Context menu: `Add as 1 sprite` — status: **EXISTS** — `web/workbench.html:104`, handler at `web/workbench.js:6450`
- Context menu: `Add to selected row sequence` — status: **EXISTS** — `web/workbench.html:105`, handler at `web/workbench.js:6454`
- Context menu: `Set as anchor for Find Sprites` — status: **EXISTS** — `web/workbench.html:106`, handler at `web/workbench.js:6465`
- Context menu: `Pad this bbox to anchor size` — status: **EXISTS** — `web/workbench.html:107`, handler at `web/workbench.js:6471`
- Source canvas rendering with boxes/overlays — status: **EXISTS** — `web/workbench.js:2500` (`renderSourceCanvas()`)
- Source zoom control — status: **EXISTS** — `web/workbench.html:94-97`
- Draft/commit box model — status: **EXISTS** — `web/workbench.js:4254` (`commitDraftToSource()`)
- Insert source boxes into grid — status: **EXISTS** — `web/workbench.js:5113` (`insertSourceBoxesIntoGridAt()`)
- Add to selected row sequence — status: **EXISTS** — `web/workbench.js:5192` (`addSourceBoxToSelectedRowSequence()`)
- Drag-drop source boxes onto grid — status: **EXISTS** — `web/workbench.js:5180` (`dropSelectedSourceBoxesAtClientPoint()`)
- Rapid Add checkbox — status: **EXISTS** — `web/workbench.html:89`
- Threshold + Min Size controls — status: **EXISTS** — `web/workbench.html:90-91`

### Required work:

1. **Add template guide-line overlay on source canvas** — `renderSourceCanvas()` (JS:2500) currently draws boxes, cuts, and anchor. Add rendering of template-derived frame boundary lines (e.g., if the template expects 7x10 cells per frame with 8 angles, draw a grid of expected frame boundaries over the source image). Data source: active template set from `state.templateRegistry`.
2. **Add auto-slice guide overlay** — When `Find Sprites` runs or Analyze completes, optionally overlay suggested slice boundaries on the source canvas as dashed/semi-transparent lines distinct from committed boxes.
3. **Add template-aware source panel labeling** — Show expected frame dimensions from the active template (e.g., "Expected: 7w x 10h cells, 8 angles x N frames") as a hint near the source canvas.
4. **Improve bundle-context PNG upload prominence** — When a bundle is active and an action tab is selected, make the upload panel label and flow more explicitly connected to "upload PNG for [action name]". The wiring exists (`uploadPanelLabel` at HTML:61) but could be more directive.

### Dependencies:
- M2-A (baseline must be frozen before expanding source panel features).
- Template registry data must be available to the frontend (already fetched via `fetchTemplateRegistry()`).

---

## Phase M2-C: Whole-Sheet Editor as Primary Surface

### Currently exists:

- `whole-sheet-init.js` editor module (1590 lines) — status: **EXISTS** — full REXPaint-style left-sidebar + canvas layout
- WholeSheet panel in workbench HTML — status: **EXISTS** — `web/workbench.html:144-147`
- Module loaded via `<script type="module">` — status: **EXISTS** — `web/workbench.html:416`
- `hydrateWholeSheetEditor()` auto-mounts when session exists — status: **EXISTS** — `web/workbench.js:5480`
- `panWholeSheetToFrame()` scrolls editor to selected frame — status: **EXISTS** — `web/workbench.js:5614`
- `window.__wholeSheetEditor` public API (12 methods) — status: **EXISTS** — `web/whole-sheet-init.js:1577`
- `focusWholeSheetFrame()` prefers whole-sheet, falls back to legacy inspector — status: **EXISTS** — `web/workbench.js:3252`
- `openInspectorForSelectedFrame()` delegates to `focusWholeSheetFrame()` — status: **EXISTS** — `web/workbench.js:5461`
- Grid frame selection auto-pans whole-sheet — status: **EXISTS** — `web/workbench.js:5458`
- `Focus Whole-Sheet` button (already renamed from "Open XP Editor") — status: **EXISTS** — `web/workbench.html:121`
- Grid context menu `Focus Whole-Sheet` — status: **EXISTS** — `web/workbench.html:138`
- Tools in WS editor: Cell, Line, Rect, Fill, Eyedropper, Erase — status: **EXISTS**
- Palette + Glyph Picker in WS sidebar — status: **EXISTS**
- Layer management (add/delete/move/visibility/active) — status: **EXISTS** — `web/whole-sheet-init.js:1538-1573`
- Keyboard shortcuts for tool switching — status: **EXISTS** — `web/whole-sheet-init.js:471`
- Session save on WS edits — status: **EXISTS** — `web/workbench.js:5533`

### Partial / needs completion:

- Select Tool in WS editor — status: **MISSING** — `web/rexpaint-editor/tools/select-tool.js` exists but is NOT imported in `whole-sheet-init.js`
- Oval Tool in WS editor — status: **MISSING** — `web/rexpaint-editor/tools/oval-tool.js` exists but is NOT imported
- Text Tool in WS editor — status: **MISSING** — `web/rexpaint-editor/tools/text-tool.js` exists but is NOT imported
- `EditorApp.undo()`/`redo()` — status: **TODO STUBS** — `web/rexpaint-editor/editor-app.js:950-960`. Workbench-level snapshot undo/redo (JS:1838-1854) IS functional.
- Legacy inspector fallback — status: **INTENTIONAL BUT NEEDS DEMOTION** — `focusWholeSheetFrame()` at JS:3252 falls back to `openInspector()` only when WS is not mounted/visible

### Required work:

1. **Demote legacy inspector to debug-only** — Move `cellInspectorPanel` (HTML:317-413) into a `<details>` collapse or conditional panel similar to the existing `legacyGridDetails` (HTML:149-152). It should not be the primary editing surface. Consider wrapping it in `<details class="legacy-inspector-debug">` with a summary tag.
2. **Import and wire Select Tool into whole-sheet editor** — Add `import { SelectTool }` to `web/whole-sheet-init.js` and wire it into the tool switching logic. This is needed for region selection, copy/paste, and batch operations in the whole-sheet surface.
3. **Import and wire Oval Tool** — Lower priority but completes the tool set.
4. **Import and wire Text Tool** — Lower priority but useful for annotation.
5. **Connect whole-sheet per-stroke undo to workbench undo** — Currently, workbench undo (snapshot-based) works but is coarse-grained. Investigate connecting `UndoStack` from `web/rexpaint-editor/undo-stack.js` to the whole-sheet editor's stroke callbacks for finer-grained undo.
6. **Verify whole-sheet editor visibility is prominent** — Panel starts `class="panel hidden"` and shows after hydration. Consider making the panel always visible (even in empty/placeholder state) so users know the editing surface exists.

### Dependencies:
- M2-A (baseline must hold through editor changes).
- Select Tool implementation is prerequisite for efficient whole-sheet editing.

---

## Phase M2-D: Source/Grid Panel Stability

### Currently exists:

- Grid row move (Up/Down) — status: **EXISTS** — `web/workbench.js:5327` (`moveSelectedRow()`)
- Grid col move (Left/Right) — status: **EXISTS** — `web/workbench.js:5363` (`moveSelectedCols()`)
- Add Frame — status: **EXISTS** — `web/workbench.js:5018` (`addGridFrameSlot()`)
- Delete Selected — status: **EXISTS** — `web/workbench.js:5292` (`deleteSelectedFrames()`)
- Frame copy/paste via context menu — status: **EXISTS** — JS:6481-6487
- Frame selection with click/shift-click — status: **EXISTS** — JS:5443-5459
- Grid zoom control — status: **EXISTS** — HTML:129-131
- Layer selector + visibility toggles — status: **EXISTS** — HTML:125, HTML:133
- Animation category assignment — status: **EXISTS** — HTML:157-166
- Frame jitter (nudge, auto-align) — status: **EXISTS** — HTML:176-204
- Workbench-level undo/redo (snapshot-based) — status: **EXISTS** — JS:1838-1854
- `pushHistory()` called before ~40 mutating operations — status: **EXISTS**
- Source box move/resize/delete — status: **EXISTS** (per UX checklist, IMPLEMENTED)
- Keyboard shortcuts for source panel modes — status: **EXISTS** (per UX checklist item 16)

### In-progress / needs verification:

- Semantic grid labels (angle names, frame numbers) — status: **IN_PROGRESS** — per UX checklist item 8
- Vertical cut-line editing UX — status: **IN_PROGRESS** — per UX checklist item 11
- Source-panel undo participation — status: **IN_PROGRESS** — per UX checklist item 13
- Source panel pan — status: **DEFERRED** — per UX checklist item 17
- Horizontal cut mode — status: **DEFERRED** — per UX checklist item 11
- Numeric bbox readout — status: **DEFERRED** — per UX checklist item 17

### Required work:

1. **Verify and complete semantic grid labels** — Check whether grid panel renders angle/frame labels. If not, add row headers (e.g., "Angle 0 (South)") and column headers (e.g., "Frame 0") using template angle-name presets.
2. **Verify cut-line editing stability** — Test that vertical cuts can be placed, moved, and deleted reliably. Ensure visual distinction from sprite boxes.
3. **Audit source-panel undo coverage** — Verify that all source-panel mutations (draw box, move, resize, delete, add sprite, set anchor, add cut, delete cut) call `pushHistory()`. Cross-reference with UX checklist item 13.
4. **Add source panel pan** — Currently deferred per UX checklist. Evaluate whether M2 workflows need pan (likely yes for large sprite sheets). If promoted, implement canvas panning with mouse drag or scroll.
5. **Add numeric bbox readout** — Show selected box coordinates (x, y, w, h) in source panel info area. Low-effort, high-value for precision editing.
6. **Stability testing for grid operations after source-to-grid insertion** — Ensure that after inserting source boxes into the grid, row/column moves, frame additions, and deletions remain correct. No automated test covers this path today.

### Dependencies:
- M2-B (source panel features should stabilize before declaring M2-D complete).

---

## Phase M2-E: Semantic Dictionaries

### Currently exists:

- Player sprite semantic dictionary seed (research doc) — status: **EXISTS** — `docs/research/ascii/2026-03-21-player-sprite-semantic-dictionary-seed.md`
- Verified glyph inventory for `player-0100.xp` L2 (13+ glyph types) — status: **EXISTS**
- Region labels with bboxes (face, boots, shirt, pants) — status: **EXISTS** — high/medium confidence
- Bundle animation types research (all 5 families) — status: **EXISTS** — `docs/research/ascii/2026-03-20-bundle-animation-types.md`
- Reference XP files for 3 canonical families — status: **EXISTS** — `sprites/player-0100.xp`, `sprites/attack-0001.xp`, `sprites/plydie-0000.xp`

### Already created (this session):

- Machine-readable JSON semantic dictionaries at `docs/research/ascii/semantic_maps/`:
  - `schema.json` — JSON Schema for the format
  - `player-0100.json` — player family (frames 0+1, verified cell-accurate)
  - `attack-0001.json` — attack family with weapon region (frame 0, verified)
  - `plydie-0000.json` — death family (frame 0, verified)

### Required work:

1. ~~Create machine-readable semantic dictionary for `player-0100.xp`~~ — **DONE** at `docs/research/ascii/semantic_maps/player-0100.json`
2. ~~Create semantic dictionary for `attack-0001.xp`~~ — **DONE** at `docs/research/ascii/semantic_maps/attack-0001.json`
3. ~~Create semantic dictionary for `plydie-0000.xp`~~ — **DONE** at `docs/research/ascii/semantic_maps/plydie-0000.json`
4. **Verify region labels across multiple frames and angles** — Current dictionaries cover frame 0 (and frame 1 for player). Extend verification to at least 4 frames across 2+ angles to confirm region stability.
5. **Design and implement agent API for region-based edits** — Create an API endpoint or MCP tool that accepts commands like `{"family": "player", "region": "shirt", "action": "recolor", "color": [0,255,0]}` and applies them to the correct cells in the session. This requires loading the dictionary, resolving region->cell mappings, and applying the edit.
6. **Implement palette-role mapping** — Map semantic roles (skin, shirt, pants, boots) to palette color indices so that recoloring preserves the half-block glyph structure.

### Dependencies:
- M2-A (reference XP files must be structurally valid).
- M2-C (region edits should be visible in the whole-sheet editor).
- Dictionary creation is independent and can start in parallel with M2-B/M2-C.

---

## Phase M2-F: Analyze as Assistive Only

### Currently exists:

- Analyze endpoint — status: **EXISTS** — `src/pipeline_v2/app.py`, frontend at `web/workbench.js:6010`
- Analyze suggests angles, frames, cell dims — status: **EXISTS** — JS:6023-6029 populates form fields
- Analyze is optional (user can skip) — status: **EXISTS**
- `Find Sprites` is independent from Analyze — status: **EXISTS** — JS:4508 uses threshold-based detection

### Required work:

1. **Add "suggestion" badge to Analyze results** — When Analyze populates form fields, add a visual indicator (e.g., `(suggested)` label, dashed border) making clear these are hints, not authoritative values. Minimal code change in `wbAnalyze()` around JS:6023.
2. **Add guide overlay from Analyze results** — When Analyze returns `suggested_cell_w`, `suggested_cell_h`, `suggested_angles`, `suggested_frames`, optionally render a grid overlay on the source canvas showing the suggested frame boundaries. Tie this to a toggle so users can show/hide it.
3. **Add UX text clarifying manual correction as primary path** — Update `sourceModeHint` or `sourceInfo` text to indicate that source-panel manual assembly is the recommended workflow, with Analyze providing optional starting hints.
4. **Do NOT make Analyze a blocking prerequisite** — Verify that no code path requires Analyze before Convert or source panel use. (Current code: Analyze button is independent. Verify no regressions.)

### Dependencies:
- M2-B (guide overlay on source canvas is shared work).

---

## Execution Order

Recommended sequence considering dependencies:

### Wave 1 (can start immediately after M1 closes)

| Priority | Phase | Task | Rationale |
|----------|-------|------|-----------|
| 1 | M2-A.1 | Create PNG-to-bundle non-regression test | Foundation — nothing else should land without this gate |
| 1 | M2-A.2 | Create known-good PNG test fixtures | Required by M2-A.1 |
| 1 | M2-E.1 | Create machine-readable player dictionary JSON | Independent research work, no code dependencies |

### Wave 2 (after M2-A baseline is frozen)

| Priority | Phase | Task | Rationale |
|----------|-------|------|-----------|
| 2 | M2-C.1 | Demote legacy inspector to debug-only | Core UX shift; high impact, moderate risk |
| 2 | M2-C.2 | Import Select Tool into whole-sheet editor | Prerequisite for efficient WS editing |
| 2 | M2-A.3 | Integrate G7-G9 gates into bundle export (or document exclusion) | Strengthens baseline |

### Wave 3 (after WS editor is primary surface)

| Priority | Phase | Task | Rationale |
|----------|-------|------|-----------|
| 3 | M2-B.1 | Template guide-line overlay on source canvas | Primary M2-B feature |
| 3 | M2-B.3 | Template-aware source panel labeling | Supports guide-line feature |
| 3 | M2-D.1 | Verify and complete semantic grid labels | UX completion |
| 3 | M2-F.1 | Add "suggestion" badge to Analyze results | Low-effort UX improvement |

### Wave 4 (stabilization and polish)

| Priority | Phase | Task | Rationale |
|----------|-------|------|-----------|
| 4 | M2-D.3 | Audit source-panel undo coverage | Stability |
| 4 | M2-D.4 | Add source panel pan | UX for large sheets |
| 4 | M2-D.5 | Add numeric bbox readout | Precision editing |
| 4 | M2-C.3 | Import Oval Tool | Tool completeness |
| 4 | M2-C.4 | Import Text Tool | Tool completeness |
| 4 | M2-B.2 | Auto-slice guide overlay | Enhancement |
| 4 | M2-F.2 | Guide overlay from Analyze results | Enhancement |

### Wave 5 (semantic editing — can parallel with Waves 3-4)

| Priority | Phase | Task | Rationale |
|----------|-------|------|-----------|
| 5 | M2-E.2 | Attack family semantic dictionary | Extends coverage |
| 5 | M2-E.3 | Death family semantic dictionary | Extends coverage |
| 5 | M2-E.4 | Multi-frame region verification | Quality gate |
| 5 | M2-E.5 | Agent API for region-based edits | Enables semantic editing |
| 5 | M2-E.6 | Palette-role mapping | Supports recoloring |

### Wave 6 (hardening)

| Priority | Phase | Task | Rationale |
|----------|-------|------|-----------|
| 6 | M2-A.4 | Skin Dock runtime smoke test for PNG baseline | Full-stack non-regression |
| 6 | M2-C.5 | Whole-sheet per-stroke undo integration | UX refinement |
| 6 | M2-D.6 | Stability testing for grid ops after source insertion | Regression prevention |
| 6 | M2-A.5 | Document frozen baseline contract | Final documentation |
| 6 | M2-F.3 | UX text clarifying manual correction path | Final UX pass |

---

## Critical Finding

**The whole-sheet editor IS already mounted and functional in the shipped workbench.** Contrary to
warnings in some docs (e.g., `docs/INDEX.md` line 174: "live workbench on audited master still edits
through the legacy inspector"), code inspection confirms:

- `whole-sheet-init.js` is loaded via `<script type="module" src="/whole-sheet-init.js">` (HTML:416)
- `hydrateWholeSheetEditor()` (JS:5480) mounts the editor when a session exists
- The button already says "Focus Whole-Sheet" not "Open XP Editor" (HTML:121)
- Frame selection auto-pans the whole-sheet editor (JS:5458)
- The fallback to legacy inspector only occurs when the whole-sheet editor is not yet mounted (JS:3257-3259)

The primary M2-C work is **demotion of the legacy inspector**, not creation of the whole-sheet
integration. The integration already exists and is functional.
