# Milestone 2 PNG Verifier Design

Date: 2026-03-21
Status: canonical design complete (v2 — post-audit revision)
Depends on: Milestone 1 close, `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`
Method: Code audit of `web/workbench.js`, `web/workbench.html`, `web/whole-sheet-init.js`, and corrected Milestone 2 support docs
Revision: 2026-03-21 v2 — incorporated findings from 6-agent audit (performance, maintainability, iterability, gaps, duplication, quality) and 4 planner agents (state model, coordinates, recipe handling, shared lib)

## Purpose

Define the Milestone 2 verifier architecture for practical PNG ingest and manual assembly.

This design should now be read as the Milestone 2 realization of the broader workbench-wide
SAR verifier model described in:

- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-22-workbench-verifier-sar-model`

Milestone 1's verifier was paint-sequence-centered: the recipe generator produced a list of
`ws_paint_cell` actions that recreated L2 content, and the verifier checked cell fidelity after
replay. That model does not cover Milestone 2 because the PNG workflow involves:

- source-panel mode switches
- bbox extraction and correction
- context-menu actions
- drag/drop gestures across panels
- source-to-grid assembly with row/column coordination
- whole-sheet correction after assembly
- multi-action bundle coordination

This design extends the verifier to handle stateful, multi-panel, gesture-driven workflows.

## Constraints

- Do not reuse Milestone 1's paint-only assumptions
- Do not flatten the PNG workflow into one giant end-to-end script
- Keep acceptance evidence tied to user-reachable actions
- Support context menus, mode switches, and drag/drop explicitly
- Keep the arbitrary-PNG structural baseline protected as a separate contract
- Evidence hierarchy: manual > screenshots > rexpaint ui.md > SAR blueprints

## Supporting Inputs Used

This design assumes the following Milestone 2 support artifacts have received their
2026-03-21 corrective pass and may now be used as implementation inputs with normal caution:

- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-21-legacy-inspector-retirement-checklist`
- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-21-m2-png-fixture-inventory`
- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-21-m2-source-panel-implementation-spec`
- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-21-semantic-edit-test-matrix`
- `scripts/validate_semantic_maps.py`

They remain support artifacts rather than higher-priority truth than current code or the
canonical contracts, but they are no longer treated here as unvetted draft inputs.

---

## 1. Verifier State Model

> **v2 revision**: Section 1 was rewritten after code audit of `__wb_debug` at JS:6975-6998.
> The v1 design referenced 8 properties that do not exist on `getState()`, used 3 wrong
> property names, and had 2 wrong type claims. All corrected below.

The verifier observes workbench state through `window.__wb_debug.getState()` (JS:6976-6998),
the whole-sheet editor API `window.__wb_debug.getWholeSheetEditorState()`, and raw state via
`window.__wb_debug._state()` for properties not yet exposed on `getState()`.

### 1.1 Session Identity

| Property | Type | Source | Exists on getState()? |
|----------|------|--------|-----------------------|
| `sessionId` | string\|null | `getState().sessionId` | YES |
| `jobId` | string | `getState().jobId` | YES |
| `bundleId` | string\|null | `_state().bundleId` | **NO — needs addition** |
| `activeActionKey` | string\|null | `_state().activeActionKey` | **NO — needs addition** |
| `templateSetKey` | string\|null | `_state().templateSetKey` | **NO — needs addition** |

### 1.2 Source Panel State

| Property | Type | Source | Exists? |
|----------|------|--------|---------|
| `sourceMode` | string | `getState().sourceMode` | YES |
| `sourceImageLoaded` | boolean | `getState().sourceImageLoaded` | YES (v1 said `sourceImage`) |
| `extractedBoxes` | **int** (count) | `getState().extractedBoxes` | YES (count, NOT array) |
| `sourceBoxes` | `Array<{id,x,y,w,h}>` | `getState().sourceBoxes` | YES (this is the array) |
| `sourceSelection` | **number[]** | `getState().sourceSelection` | YES (Array, not Set) |
| `drawCurrent` | `{x,y,w,h}\|null` | `getState().drawCurrent` | YES |
| `anchorBox` | `{id,x,y,w,h}\|null` | `getState().anchorBox` | YES |
| `rapidManualAdd` | boolean | `getState().rapidManualAdd` | YES |
| `sourceCutsV` | `Array<{id,x}>` | `_state().sourceCutsV` | **NO — needs addition** |
| `sourceCanvasZoom` | number (1-6) | `_state().sourceCanvasZoom` | **NO — needs addition** |

### 1.3 Grid State

| Property | Type | Source | Exists? |
|----------|------|--------|---------|
| `angles` | int | `getState().angles` | YES |
| `anims` | number[] | `getState().anims` | YES |
| `frameWChars` | int | `getState().frameWChars` | YES |
| `frameHChars` | int | `getState().frameHChars` | YES |
| `projs` | int | `getState().projs` | YES |
| `selectedRow` | int\|null | `getState().selectedRow` | YES |
| `selectedCols` | **number[]** | `getState().selectedCols` | YES (Array, not Set) |
| `rowCategories` | Record | `getState().rowCategories` | YES |
| `activeLayer` | int | `_state().activeLayer` | **NO — needs addition** |
| `visibleLayers` | number[] | `_state().visibleLayers` | **NO — needs addition** |
| `layerCount` | int | `_state().layers.length` | **NO — needs addition** |

### 1.4 Cell Data

| Accessor | Return Type | Source | Exists? |
|----------|-------------|--------|---------|
| `readFrameCell(row, col, cx, cy)` | `{row,col,cx,cy,gx,gy,cell:{glyph,fg,bg}}\|null` | `__wb_debug.readFrameCell()` | YES |
| `readLayerCell(layerIdx, x, y)` | `{glyph,fg,bg}\|null` | `__wb_debug.readLayerCell()` | YES |
| `frameSignature(row, col)` | string hash | `__wb_debug.frameSignature()` | YES |
| `readFrameRect(row, col, x, y, x2, y2)` | 2D array | `__wb_debug.readFrameRect()` | YES |

### 1.5 Whole-Sheet Editor State

Accessed via `__wb_debug.getWholeSheetEditorState()` which delegates to `window.__wholeSheetEditor.getState()`.

| Property | Type | Source | Exists? |
|----------|------|--------|---------|
| `available` | boolean | `.available` | YES |
| `mounted` | boolean | `.mounted` | YES |
| `activeTool` | string | `.activeTool` | YES |
| `activeLayerIndex` | int | `.activeLayerIndex` | YES (v1 said `activeLayer`) |
| `layerCount` | int | `.layerCount` | YES |
| `hasFontLoaded` | boolean | `.hasFontLoaded` | YES |
| `drawGlyph` | int | `.drawGlyph` | YES |
| `drawFg` | `[r,g,b]` | `.drawFg` | YES |
| `drawBg` | `[r,g,b]` | `.drawBg` | YES |
| `wsVisible` | boolean | DOM: `!$('#wholeSheetPanel').classList.contains('hidden')` | DOM query |

### 1.6 Session Lifecycle

| Property | Type | Source | Exists? |
|----------|------|--------|---------|
| `historyDepth` | int | `getState().historyDepth` | YES (v1 said `historyLength`) |
| `futureDepth` | int | `getState().futureDepth` | YES (v1 omitted) |
| `sessionDirty` | boolean | `_state().sessionDirty` | **NO — needs addition** |

> **Note**: There is NO `historyIndex`. The system uses stack-pop undo/redo (`history[]` + `future[]`), not an index model.

### 1.7 Required `getState()` Patch

Before M2 verifier implementation, add these 9 properties to the `getState()` return object at `web/workbench.js:6976`:

```javascript
bundleId: state.bundleId ? String(state.bundleId) : null,
activeActionKey: String(state.activeActionKey || ""),
templateSetKey: String(state.templateSetKey || ""),
sourceCutsV: state.sourceCutsV.map(c => ({ id: Number(c.id), x: Number(c.x) })),
sourceCanvasZoom: Number(state.sourceCanvasZoom || 1),
activeLayer: state.activeLayer,
visibleLayers: [...state.visibleLayers],
layerCount: state.layers.length,
sessionDirty: !!state.sessionDirty,
```

Until patched, `queryState()` uses `_state()` as a bridge (see Section 1.8).

### 1.8 `queryState()` Implementation

```javascript
async function queryState(page) {
  return await page.evaluate(() => {
    const d = window.__wb_debug;
    if (!d) return { error: 'no_debug_api' };
    const s = d.getState();
    const ws = d.getWholeSheetEditorState();
    const raw = d._state();  // bridge until getState() is patched
    return {
      sessionId: s.sessionId, jobId: s.jobId,
      bundleId: raw.bundleId ? String(raw.bundleId) : null,
      activeActionKey: String(raw.activeActionKey || ''),
      templateSetKey: String(raw.templateSetKey || ''),
      sourceMode: s.sourceMode, sourceImageLoaded: s.sourceImageLoaded,
      extractedBoxCount: s.extractedBoxes,
      sourceBoxes: s.sourceBoxes, sourceSelection: s.sourceSelection,
      drawCurrent: s.drawCurrent, anchorBox: s.anchorBox,
      rapidManualAdd: s.rapidManualAdd,
      sourceCutsV: raw.sourceCutsV.map(c => ({ id: +c.id, x: +c.x })),
      sourceCanvasZoom: +raw.sourceCanvasZoom || 1,
      angles: s.angles, anims: s.anims,
      frameWChars: s.frameWChars, frameHChars: s.frameHChars, projs: s.projs,
      selectedRow: s.selectedRow, selectedCols: s.selectedCols,
      rowCategories: s.rowCategories,
      activeLayer: raw.activeLayer,
      visibleLayers: [...raw.visibleLayers],
      layerCount: raw.layers.length,
      historyDepth: s.historyDepth, futureDepth: s.futureDepth,
      sessionDirty: !!raw.sessionDirty,
      wsAvailable: ws.available, wsMounted: ws.mounted || false,
      wsActiveTool: ws.activeTool || null,
      wsActiveLayerIndex: ws.activeLayerIndex ?? null,
      wsLayerCount: ws.layerCount ?? 0,
      wsVisible: !document.querySelector('#wholeSheetPanel')?.classList.contains('hidden'),
    };
  });
}
```

---

## 2. Action DSL

### 2.1 Design Principles

Actions are **user-reachable primitives** — each corresponds to a gesture, click, keystroke,
or context-menu selection that a human user can perform through the shipped workbench UI.

Actions are NOT direct state mutations. They go through the product's event handlers.

Actions are grouped by **family** (which panel/subsystem they target). Each action specifies:
- Name (verb_noun format)
- Parameters
- Trigger mechanism (how Playwright executes it)
- Preconditions (what state must hold)

### 2.2 Session Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `upload_png` | `file_path` | Click `#wbFile` + `#wbUpload` | File exists |
| `analyze` | — | Click `#wbAnalyze` | Source uploaded |
| `convert_action` | `action_key` | Click `#wbRun` (bundle mode) | Analyze complete, bundle mode |
| `apply_template` | `template_key` | Select `#templateSelect` + click `#templateApplyBtn` | — |
| `new_xp` | — | Click `#btnNewXp` | Template applied |
| `import_xp` | `file_path` | Click `#xpImportBtn` + file input | File exists |

### 2.3 Source-Panel Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `source_set_mode` | `mode` | Click mode button or press key (V/B/R/C/X) | Source image loaded |
| `source_draw_box` | `x, y, w, h` | Mouse drag in `draw_box` mode | Mode is `draw_box` |
| `source_commit_draft` | — | Press Enter or context menu "Add as 1 sprite" | Draft box exists |
| `source_select_box` | `box_id` | Click on box in `select` mode | Mode is `select`, box exists |
| `source_move_box` | `box_id, dx, dy` | Drag box in `select` mode | Box selected |
| `source_resize_box` | `box_id, w, h` | Drag handle in `select` mode | Box selected |
| `source_delete_selection` | — | Press Delete or click `#deleteBoxBtn` | Selection non-empty |
| `source_find_sprites` | `threshold, min_size` | Click `#extractBtn` | Source image loaded |
| `source_set_anchor` | `box_id` | Context menu "Set as anchor" | Box/draft exists |
| `source_pad_to_anchor` | `box_id` | Context menu "Pad to anchor size" | Anchor + target exist |
| `source_add_cut_v` | `x` | Click in `cut_v` mode | Mode is `cut_v` |
| `source_move_cut` | `cut_id, x` | Drag cut in `cut_v` mode | Cut exists |
| `source_row_select` | `y_start, y_end, modifiers` | Drag in `row_select` mode | Mode is `row_select` |
| `source_col_select` | `x_start, x_end, modifiers` | Drag in `col_select` mode | Mode is `col_select` |

### 2.4 Context-Menu Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `ctx_add_as_sprite` | — | Right-click target + click `#srcCtxAddSprite` | Draft or box target |
| `ctx_add_to_row_seq` | — | Right-click target + click `#srcCtxAddToRow` | Target + row selected |
| `ctx_set_anchor` | — | Right-click target + click `#srcCtxSetAnchor` | Target exists |
| `ctx_pad_to_anchor` | — | Right-click target + click `#srcCtxPadAnchor` | Anchor + target exist |
| `ctx_delete` | — | Right-click target + click `#srcCtxDelete` | Target exists |
| `ctx_grid_copy` | — | Right-click frame + click `#ctxCopy` | Frame selected |
| `ctx_grid_paste` | — | Right-click frame + click `#ctxPaste` | Clipboard non-empty |
| `ctx_grid_focus_ws` | — | Right-click frame + click `#ctxOpenInspector` | Frame selected |
| `ctx_grid_delete` | — | Right-click frame + click `#ctxDelete` | Frame selected |

### 2.5 Source-to-Grid Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `drag_to_grid` | `target_row, target_col` | Drag selected boxes from source canvas to grid | Selection non-empty, visual layer active |
| `add_to_row_sequence` | `box_id` | Context menu or `__wb_debug.addSourceBoxToSelectedRowById()` | Row selected, visual layer active |
| `insert_boxes_at` | `boxes[], target_row, start_col` | Via `insertSourceBoxesIntoGridAt()` | Visual layer active |

### 2.6 Grid Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `grid_select_frame` | `row, col` | Click on frame tile | Grid populated |
| `grid_select_range` | `row, col_start, col_end` | Shift+click on frame tiles | Grid populated |
| `grid_move_row` | `delta` | Click `#rowUpBtn`/`#rowDownBtn` | Row selected, visual layer active |
| `grid_move_cols` | `delta` | Click `#colLeftBtn`/`#colRightBtn` | Cols selected, visual layer active |
| `grid_add_frame` | — | Click `#addFrameBtn` | Visual layer active |
| `grid_delete_selected` | — | Click `#deleteCellBtn` or Delete key | Frames selected, visual layer active |
| `grid_copy_frame` | — | Ctrl+C or context menu | Frame selected |
| `grid_paste_frame` | — | Ctrl+V or context menu | Clipboard non-empty, frame selected |
| `grid_assign_category` | `category` | Select + click `#assignAnimCategoryBtn` | Row selected |
| `grid_assign_frame_group` | `name` | Input + click `#assignFrameGroupBtn` | Cols selected |
| `grid_apply_groups` | — | Click `#applyGroupsToAnimsBtn` | Frame groups defined |

### 2.7 Jitter Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `jitter_nudge` | `dx, dy` | Click directional buttons or W/A/S/D | Frames selected, visual layer active |
| `jitter_auto_align` | `whole_row` | Click `#autoAlignSelectedBtn`/`#autoAlignRowBtn` | Frames selected, visual layer active |

### 2.8 Whole-Sheet Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `ws_focus_frame` | `row, col` | Click "Focus Whole-Sheet" or double-click frame | WS editor mounted, frame exists |
| `ws_paint_cell` | `x, y, glyph, fg, bg` | CellTool click on WS canvas | WS visible, cell tool active |
| `ws_paint_line` | `x1, y1, x2, y2, glyph, fg, bg` | LineTool drag | WS visible, line tool active |
| `ws_paint_rect` | `x, y, w, h, glyph, fg, bg` | RectTool drag | WS visible, rect tool active |
| `ws_fill` | `x, y, glyph, fg, bg` | FillTool click | WS visible, fill tool active |
| `ws_erase` | `x, y` | EraseTool click | WS visible, erase tool active |
| `ws_eyedropper` | `x, y` | EyedropperTool click | WS visible, eyedropper active |
| `ws_set_active_layer` | `layer` | Layer selector | WS visible |
| `ws_toggle_layer_vis` | `layer` | Layer visibility checkbox | WS visible |
| `ws_add_layer` | — | WS add layer button | WS visible |
| `ws_delete_layer` | `layer` | WS delete layer button | WS visible, layer exists, layerCount > 1 |
| `ws_move_layer` | `from, to` | WS drag layer | WS visible |

### 2.9 Session Lifecycle Actions

| Action | Parameters | Trigger | Preconditions |
|--------|-----------|---------|---------------|
| `save_session` | — | `__wb_debug.flushSave()` | Session exists |
| `export_xp` | — | Click `#btnExport` | Session exists |
| `test_skin_dock` | — | Click `#webbuildQuickTestBtn` | Session exists, webbuild loaded |
| `undo` | — | Ctrl+Z | historyIndex > 0 |
| `redo` | — | Ctrl+Y | historyIndex < historyLength - 1 |

---

## 3. State -> Action -> Response / Invariant Mapping

### 3.1 Upload / Analyze / Convert Family

#### `upload_png`
- **Precondition**: File exists at `file_path`
- **Gesture**: Set `#wbFile` input value, click `#wbUpload`
- **Expected response**: `sourceImage` becomes non-null, `sourcePath` set, Analyze button enabled
- **Invariants**: Grid state unchanged, extractedBoxes unchanged, session metadata unchanged

#### `analyze`
- **Precondition**: `sourceImage` is loaded
- **Gesture**: Click `#wbAnalyze`
- **Expected response**: Analyze results populate form fields (suggested angles, frames, cell dims). Convert button enabled.
- **Invariants**: Source boxes unchanged, grid unchanged. Analyze results are suggestions only — they do not modify session state.

#### `convert_action`
- **Precondition**: Bundle mode active, action key set, source uploaded
- **Gesture**: Click `#wbRun` (routes to `wbRunBundleAction()`)
- **Expected response**: Session created/updated, `cells` populated for this action, grid rendered, whole-sheet editor hydrated
- **Invariants**: Template geometry (angles, frameWChars, frameHChars, projs) matches template registry. Layer count matches family contract. Structural gates (G10, G11, G12) can be validated on the resulting session.

### 3.2 Source-Panel Family

#### `source_set_mode`
- **Precondition**: Source image loaded
- **Gesture**: Click mode button or press shortcut key
- **Expected response**: `sourceMode` changes to target mode. Mode hint text updates.
- **Invariants**: No box/cut/grid state changes. No save triggered.

#### `source_draw_box`
- **Precondition**: Mode is `draw_box`
- **Gesture**: Mouse drag on source canvas
- **Expected response**: `drawCurrent` set to `{x, y, w, h}` (blue draft box visible)
- **Invariants**: `extractedBoxes` unchanged (draft is not yet committed). Grid unchanged.

#### `source_commit_draft`
- **Precondition**: `drawCurrent` is non-null
- **Gesture**: Enter key or context menu "Add as 1 sprite"
- **Expected response**: `drawCurrent` moved to `extractedBoxes` with new ID and `source: "manual"`. `drawCurrent` becomes null.
- **Invariants**: Grid unchanged. `pushHistory()` called. `saveSessionState("add-source-box")` called.
- **Verifiable**: `extractedBoxes.length` increases by 1. New box matches draft dimensions.

#### `source_find_sprites`
- **Precondition**: Source image loaded
- **Gesture**: Click `#extractBtn`
- **Expected response**: `extractedBoxes` populated with auto-detected boxes. Manual boxes preserved.
- **Invariants**: `pushHistory()` called (JS:4622). Grid unchanged. Anchor unchanged.
- **Verifiable**: `extractedBoxes.length >= 0`. All boxes have valid `{x, y, w, h}` within image bounds.

#### `source_set_anchor`
- **Precondition**: Target box or draft exists
- **Gesture**: Context menu "Set as anchor"
- **Expected response**: `anchorBox` set to target box dimensions
- **Invariants**: `saveSessionState("set-anchor")` called. Grid unchanged.
- **Known gap**: No `pushHistory()` at JS:6465 — anchor set is not undoable.

#### `source_move_box` / `source_resize_box`
- **Precondition**: Box selected in `select` mode
- **Gesture**: Drag box body (move) or drag handle (resize)
- **Expected response**: Box position/size updated in `extractedBoxes`
- **Invariants**: `pushHistory()` called (JS:4402). `saveSessionState("edit-source-box")` called. Grid unchanged.
- **Verifiable**: Box dimensions changed by expected delta. No overlap with other committed boxes (enforced for committed boxes).

#### `source_delete_selection`
- **Precondition**: Selection non-empty, or cut selected, or draft exists
- **Gesture**: Delete key or `#deleteBoxBtn`
- **Expected response**: Selected items removed from `extractedBoxes` / `sourceCutsV` / `drawCurrent`
- **Invariants**: `pushHistory()` called (JS:5226). Save called. Grid unchanged.

### 3.3 Context-Menu Family

#### `ctx_add_to_row_seq`
- **Precondition**: Target box/draft exists AND `selectedRow` is non-null
- **Gesture**: Right-click target + click `#srcCtxAddToRow`
- **Expected response**: Box rasterized to char cells via `frameCellsFromSourceBox()`. Cells written to next available column in `selectedRow`. `selectedCols` updated to newly-filled column.
- **Invariants**: `pushHistory()` called. `saveSessionState("source-box-to-row-seq")` called. Source boxes unchanged. Grid cell count increases.
- **Verifiable**: Frame at `(selectedRow, new_col)` contains non-empty cells. `frameSignature` changes.

### 3.4 Source-to-Grid Family

#### `drag_to_grid`
- **Precondition**: Source selection non-empty, visual layer active (layer 2)
- **Gesture**: Drag selected boxes from source canvas to grid frame cell
- **Expected response**: Boxes grouped by source-image rows via `groupSourceBoxesByRows()`. Multi-row drops span multiple grid rows. Boxes sorted left-to-right within each row, placed sequentially.
- **Invariants**: `pushHistory()` called (JS:5133). `saveSessionState("drop-source-selection-to-grid")` called. `selectedRow`/`selectedCols` updated to drop target.
- **Verifiable**: Each target frame now contains rasterized source content. `frameSignature` changes for each target frame. Source boxes NOT consumed (they remain in `extractedBoxes`).

#### `add_to_row_sequence`
- **Precondition**: Row selected, visual layer active
- **Gesture**: Context menu or debug API
- **Expected response**: Single box written to next available column in selected row
- **Invariants**: Same as `ctx_add_to_row_seq`

### 3.5 Grid Family

#### `grid_select_frame`
- **Precondition**: Grid populated
- **Gesture**: Click on frame tile
- **Expected response**: `selectedRow` and `selectedCols` set. Whole-sheet editor auto-pans to frame (JS:5458). Preview updates.
- **Invariants**: No cell data changes. No save triggered.

#### `grid_move_row`
- **Precondition**: Row selected, visual layer active
- **Gesture**: Click `#rowUpBtn` (delta=-1) or `#rowDownBtn` (delta=+1)
- **Expected response**: Row blocks swapped. `selectedRow` updated to new position.
- **Invariants**: `pushHistory()` called (JS:5335). Total cell count unchanged. All frame content preserved (just reordered).
- **Verifiable**: `frameSignature(old_row, col) == frameSignature(new_target_row, col)` after swap.

#### `grid_add_frame`
- **Precondition**: Visual layer active
- **Gesture**: Click `#addFrameBtn`
- **Expected response**: New empty column appended to all rows. `anims` geometry updated.
- **Invariants**: `pushHistory()` called (JS:5028). Existing frames unchanged. New frames are all-empty.

#### `grid_delete_selected`
- **Precondition**: Frames selected, visual layer active
- **Gesture**: Delete key or `#deleteCellBtn`
- **Expected response**: Selected columns removed from all rows. Grid contracts.
- **Invariants**: `pushHistory()` called (JS:5298). Non-selected frames unchanged.

### 3.6 Whole-Sheet Family

#### `ws_focus_frame`
- **Precondition**: WS editor mounted
- **Gesture**: "Focus Whole-Sheet" button or double-click frame tile
- **Expected response**: WS panel visible. Viewport panned to frame. WS editor state reflects current grid data.
- **Invariants**: No cell data changes (read-only navigation).

#### `ws_paint_cell`
- **Precondition**: WS visible, cell tool active
- **Gesture**: Click on WS canvas at coordinates
- **Expected response**: Cell at (x, y) on active layer updated with glyph/fg/bg. `onCellsChanged` callback fires. `saveSessionState("whole-sheet-draw-cells")` called.
- **Invariants**: `pushHistory()` called via `onStrokeStart` (JS:5510). Only the targeted cell changes. Other layers unchanged.
- **Verifiable**: `readFrameCell(row, col, x, y)` returns expected glyph/fg/bg after paint.

#### `ws_set_active_layer`
- **Precondition**: WS visible, target layer exists
- **Gesture**: Layer selector change
- **Expected response**: `activeLayer` changes. Cell rendering reflects new layer.
- **Invariants**: No cell data changes.

### 3.7 Session Lifecycle Family

#### `save_session`
- **Precondition**: Session exists
- **Gesture**: `__wb_debug.flushSave()`
- **Expected response**: `sessionDirty` becomes false. Session data persisted to backend.
- **Invariants**: Cell data unchanged by save. Session can be reloaded and round-trips.

#### `export_xp`
- **Precondition**: Session exists
- **Gesture**: Click `#btnExport`
- **Expected response**: XP file downloaded. Structural gates (G10-G12) pass on the exported file.
- **Invariants**: Session state unchanged by export. Exported XP re-importable.

#### `test_skin_dock`
- **Precondition**: Session exists, webbuild loaded
- **Gesture**: Click `#webbuildQuickTestBtn`
- **Expected response**: XP exported, injected into webbuild iframe. Game loads with custom skin. Player sprite visible and moves.
- **Invariants**: Session state unchanged by test.

#### `undo` / `redo`
- **Precondition**: History available in target direction
- **Gesture**: Ctrl+Z / Ctrl+Y
- **Expected response**: State snapshot restored. All observable state reverts/advances.
- **Invariants**: Undo followed by redo returns to same state. `historyDepth`/`futureDepth` adjust by 1.
- **Verifiable**: `frameSignature` for all frames matches the snapshot state.

---

## 4. Recipe Generator Architecture

### 4.1 How M2 Recipes Differ from M1

| Aspect | M1 (paint-only) | M2 (PNG assembly) |
|--------|-----------------|-------------------|
| Input | Reference XP (known cells) | Arbitrary PNG (unknown layout) |
| Actions | `ws_paint_cell` sequences | Mode switches, bbox ops, drag/drop, context menus, WS corrections |
| Coordination | Single panel (WS editor) | Three panels (source, grid, WS) + context menus |
| State tracking | Minimal (just cell writes) | Full state model (source boxes, selections, grid geometry) |
| Determinism | High (exact cell coordinates) | Medium (bbox detection varies, human correction needed) |

### 4.2 Recipe Format

A recipe is a JSON array of action objects:

```json
[
  { "action": "apply_template", "params": { "template_key": "player_native_full" } },
  { "action": "upload_png", "params": { "file_path": "SMALLTESTPNGs/player-0100.png" } },
  { "action": "convert_action", "params": { "action_key": "idle" } },
  { "action": "source_find_sprites", "params": { "threshold": 48, "min_size": 8 } },
  { "action": "source_row_select", "params": { "y_start": 0, "y_end": 120 } },
  { "action": "grid_select_frame", "params": { "row": 0, "col": 0 } },
  { "action": "drag_to_grid", "params": { "target_row": 0, "target_col": 0 } },
  { "action": "ws_focus_frame", "params": { "row": 0, "col": 0 } },
  { "action": "ws_paint_cell", "params": { "x": 3, "y": 2, "glyph": 219, "fg": "#ff0000", "bg": "#000000" } },
  { "action": "save_session" },
  { "action": "export_xp" },
  { "action": "test_skin_dock" }
]
```

### 4.3 Recipe Phases

Every M2 recipe follows a phase structure:

1. **Setup** — `apply_template`, `upload_png` for each action
2. **Conversion** — `convert_action` for each bundle action (or `import_xp` for existing XP)
3. **Source extraction** — `source_find_sprites` and/or manual `source_draw_box` + `source_commit_draft`
4. **Source correction** — `source_move_box`, `source_resize_box`, `source_set_anchor`, `source_pad_to_anchor`
5. **Assembly** — `drag_to_grid` or `add_to_row_sequence` for each action's frames
6. **Grid organization** — `grid_move_row`, `grid_assign_category`, `grid_assign_frame_group`
7. **Whole-sheet correction** — `ws_paint_cell` for individual cell fixes
8. **Finalization** — `save_session`, `export_xp`, `test_skin_dock`

### 4.4 Recipe Modes

Extending Milestone 1's mode system:

| Mode | Use | Acceptance-eligible? |
|------|-----|---------------------|
| `structural_baseline` | Structural gates only (G10-G12). No cell content verification. | Acceptance for M2-A slice only |
| `source_panel_contract` | Source-panel actions + state assertions. No grid verification. | Diagnostic |
| `source_to_grid_contract` | Source extraction + assembly + grid cell verification. | Diagnostic |
| `ws_correction_contract` | Assembly + WS corrections + cell verification. | Diagnostic |
| `manual_assembly_acceptance` | Full upload → assemble → correct → export → runtime. User-reachable actions only. | Acceptance for M2 |
| `diagnostic` | Any action, including debug API and inspector. | Diagnostic only |

`manual_assembly_acceptance` is the M2 equivalent of M1's `full_recreation`.

### 4.5 Recipe Generation Rules

The recipe generator must:

1. **Respect mode boundaries**: `manual_assembly_acceptance` recipes may only use actions from
   Sections 2.2-2.9. No `__wb_debug` mutations, no inspector actions, no synthetic shortcuts.

2. **Track panel focus**: Actions targeting a panel require that panel to be in the correct
   state. The generator must insert mode-switch actions before bbox operations.

3. **Track selection state**: `drag_to_grid` and `add_to_row_sequence` require specific selection
   and row selection state. The generator must insert `grid_select_frame` before row-sequence
   operations.

4. **Generate per-action**: For bundle workflows, the generator produces a recipe segment for
   each bundle action (idle, attack, death) with its own upload/convert/extract/assemble cycle.

5. **Insert verification checkpoints**: After each phase transition, insert a state assertion
   that the verifier can check (e.g., after assembly, verify frame signatures changed).

---

## 5. Verifier Slices

### 5.1 Slice Architecture

Each verifier slice is an independent test that can run separately. Slices are ordered by
dependency but do not require prior slices to pass before running.

```
Slice 1: PNG Structural Baseline
    ↓ (baseline must hold)
Slice 2: Source-Panel Contract
    ↓ (source panel must work)
Slice 3: Source-to-Grid Contract
    ↓ (assembly must work)
Slice 4: Whole-Sheet Correction Contract
    ↓ (corrections must work)
Slice 5: End-to-End Manual Assembly Acceptance
```

### 5.2 Slice 1: PNG Structural Baseline

**Purpose**: Verify the Milestone 1 structural checkpoint is not regressed.

**Contract reference**: `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md`

**Recipe mode**: `structural_baseline`

**Actions exercised**:
- `upload_png` (per family fixture)
- `apply_template`
- `convert_action`
- `export_xp`

**Assertions**:
1. Upload succeeds without error for each fixture PNG
2. `convert_action` produces a session with non-null cells
3. Structural gate G10 (dimension match) passes
4. Structural gate G11 (layer count) passes
5. Structural gate G12 (L0 metadata) passes
6. Exported XP is a valid REXPaint binary (re-readable by XP codec)
7. At least one cell on the visual layer has non-default content (G8-equivalent)

**Fixtures required**:
- `tests/fixtures/baseline/player-sheet.png` (from `SMALLTESTPNGs/player-0100.png`)
- `tests/fixtures/baseline/attack-sheet.png` (from `SMALLTESTPNGs/knight.png`)
- `tests/fixtures/baseline/death-sheet.png` (from `SMALLTESTPNGs/skeleton-bgfix5.png`)

**Negative assertions**:
- `tests/fixtures/known_bad/all_black.png` does not crash the pipeline

**Runner**: `tests/test_png_bundle_baseline.py` (Python, headless, no browser)

**Frequency**: Every code change to pipeline, gates, XP codec, or bundle system.

### 5.3 Slice 2: Source-Panel Contract

**Purpose**: Verify that source-panel actions produce correct state transitions.

**Recipe mode**: `source_panel_contract`

**Actions exercised**:
- `upload_png`
- `source_set_mode` (all 5 modes)
- `source_find_sprites`
- `source_draw_box`
- `source_commit_draft`
- `source_select_box`
- `source_move_box`
- `source_resize_box`
- `source_delete_selection`
- `source_set_anchor`
- `source_pad_to_anchor`
- `source_add_cut_v`
- `source_move_cut`
- `source_row_select`

**Assertions per action**:

| Action | Post-condition | Invariant |
|--------|---------------|-----------|
| `source_set_mode(m)` | `sourceMode === m` | Grid unchanged, boxes unchanged |
| `source_find_sprites` | `extractedBoxes.length >= 0` | Grid unchanged, history pushed |
| `source_draw_box` | `drawCurrent !== null` | `extractedBoxes` unchanged |
| `source_commit_draft` | `extractedBoxes` grows by 1, `drawCurrent === null` | Grid unchanged |
| `source_move_box(id, dx, dy)` | Box position shifted by (dx, dy) | Grid unchanged, history pushed |
| `source_resize_box(id, w, h)` | Box dimensions changed | Grid unchanged, history pushed |
| `source_delete_selection` | Selected items removed | Grid unchanged, history pushed |
| `source_set_anchor(id)` | `anchorBox` matches target dims | Grid unchanged |
| `source_row_select(y0, y1)` | `sourceSelection` contains intersecting box IDs | Grid unchanged |

**Critical isolation invariant**: All source-panel actions MUST NOT modify:
- `state.cells` (grid cell data)
- `state.selectedRow` / `state.selectedCols` (grid selection)
- `state.angles` / `state.anims` / `state.frameWChars` / `state.frameHChars` (session metadata)
- Whole-sheet editor state

**Runner**: Playwright (browser-based, exercises real UI handlers)

### 5.4 Slice 3: Source-to-Grid Contract

**Purpose**: Verify that source-to-grid assembly produces correct grid content.

**Recipe mode**: `source_to_grid_contract`

**Actions exercised**:
- All Slice 2 actions (setup)
- `grid_select_frame`
- `drag_to_grid`
- `add_to_row_sequence`

**Assertions**:

1. **Pre-insertion**: Target frame has known signature (empty or known content)
2. **Post-insertion**: Target frame signature changes
3. **Content check**: At least one cell in the target frame has non-empty content
4. **Multi-box ordering**: When multiple boxes are inserted, they appear left-to-right matching source order
5. **Multi-row spanning**: Row-grouped boxes land in the correct grid rows
6. **Selection update**: `selectedRow`/`selectedCols` point to the drop target after insertion
7. **Layer check**: Content is written to the active layer only (visual layer 2 by default)

**Corner-case assertions**:
- Inserting into a non-empty frame overwrites existing content (not appends)
- Inserting when no row is selected (for `add_to_row_sequence`) fails gracefully
- Inserting with active layer != 2 writes to the active layer, not hardcoded layer 2

**Runner**: Playwright

### 5.5 Slice 4: Whole-Sheet Correction Contract

**Purpose**: Verify that whole-sheet editing after assembly works correctly.

**Recipe mode**: `ws_correction_contract`

**Actions exercised**:
- Assembly actions from Slice 3 (setup)
- `ws_focus_frame`
- `ws_paint_cell`
- `ws_erase`
- `ws_eyedropper`
- `ws_set_active_layer`
- `ws_toggle_layer_vis`
- `undo` / `redo`
- `save_session`

**Assertions**:

1. **Focus**: After `ws_focus_frame(row, col)`, the WS editor is visible and viewport covers the target frame
2. **Paint**: After `ws_paint_cell(x, y, glyph, fg, bg)`, `readFrameCell(row, col, x, y)` returns the painted values
3. **Erase**: After `ws_erase(x, y)`, cell at position is empty/transparent
4. **Eyedropper**: After `ws_eyedropper(x, y)`, the WS editor's active colors match the sampled cell
5. **Layer isolation**: Painting on layer 2 does not affect layer 0 or layer 1
6. **Undo roundtrip**: Paint → undo restores previous cell value. Paint → undo → redo restores the paint.
7. **Save persistence**: After save + reload, all corrections are preserved. `frameSignature` matches pre-save value.

**Runner**: Playwright

### 5.6 Slice 5: End-to-End Manual Assembly Acceptance

**Purpose**: Full acceptance test for the Milestone 2 PNG manual assembly workflow.

**Recipe mode**: `manual_assembly_acceptance`

**This is the M2 acceptance test.** It exercises the complete user workflow from PNG upload
through runtime verification.

**Recipe structure** (for a 3-action bundle: idle, attack, death):

```
Phase 1: Setup
  apply_template("player_native_full")

Phase 2: Per-action cycle (repeat for idle, attack, death)
  upload_png(fixture_path)
  convert_action(action_key)
  source_find_sprites(48, 8)
  [optional: source_draw_box + source_commit_draft for missed sprites]
  [optional: source_set_anchor + source_pad_to_anchor for size normalization]
  source_row_select(y_start, y_end)  — select first row of sprites
  grid_select_frame(angle_row, 0)
  drag_to_grid(angle_row, 0)
  [repeat for remaining angle rows]

Phase 3: Grid organization
  grid_assign_category(0, "idle")
  grid_assign_category(1, "walk")
  ... etc.

Phase 4: Whole-sheet corrections
  ws_focus_frame(0, 0)
  ws_paint_cell(...) — fix specific cells as needed
  ...

Phase 5: Finalization
  save_session()
  export_xp()
  test_skin_dock()
```

**Assertions** (cumulative — all prior slice assertions apply, plus):

1. **Bundle completeness**: All required actions (idle, attack, death) have sessions with content
2. **Export validity**: Exported bundle XP passes all structural gates (G10-G12)
3. **XP round-trip**: Exported XP can be re-imported and produces identical `frameSignature` values
4. **Runtime safety**: Exported bundle loads in Skin Dock without crash
5. **Runtime visual**: Player sprite is visible and animates in the test dock (requires headed mode or screenshot comparison)

**Reporting shape** (extends M1 contract):

```json
{
  "mode": "manual_assembly_acceptance",
  "structural_baseline_pass": true,
  "source_panel_contract_pass": true,
  "source_to_grid_contract_pass": true,
  "ws_correction_contract_pass": true,
  "bundle_completeness_pass": true,
  "idle_pass": true,
  "attack_pass": true,
  "death_pass": true,
  "geometry_pass": true,
  "layer_count_pass": true,
  "l0_metadata_pass": true,
  "export_pass": true,
  "xp_roundtrip_pass": true,
  "skin_dock_pass": true,
  "overall_pass": true
}
```

`overall_pass` is `true` only if ALL other fields are `true`.

**Runner**: Playwright (headed for runtime visual; headless for all other checks)

---

## 6. Acceptance vs Diagnostic Boundaries

### 6.1 Boundary Definition

| Category | What qualifies | Naming rules | Can cite as acceptance? |
|----------|---------------|-------------|------------------------|
| **Acceptance evidence** | Output from Slice 5 (`manual_assembly_acceptance` mode) or Slice 1 (`structural_baseline` mode for M2-A only). All actions are user-reachable. No debug API mutations. | May use: "acceptance", "verified", "PASS" | Yes |
| **Diagnostic evidence** | Output from Slices 2-4, or any recipe in `diagnostic` mode. May use debug API, inspector actions, synthetic shortcuts. | Must use: "diagnostic", "smoke", "probe", "contract_check" | No — diagnostic only |
| **Ad hoc scripts** | Any Playwright script, `page.evaluate()` mutation, or `window.__wb_debug` call outside the canonical recipe runner. | Must use: "experiment", "exploration", "scratch" | No — never acceptance |

### 6.2 What Makes an Action Acceptance-Eligible

An action is acceptance-eligible if and only if:

1. It corresponds to a UI element the user can click, a keyboard shortcut the user can press,
   or a gesture the user can perform (drag, right-click menu)
2. It does NOT use `__wb_debug` for state mutation (read-only debug queries are OK for verification)
3. It does NOT use the legacy inspector as the primary editing surface
4. It does NOT bypass shipped controls with synthetic state injection

### 6.3 What Makes a Verification Check Acceptance-Grade

A verification check is acceptance-grade if:

1. The check reads state through `__wb_debug` read-only APIs (getState, readFrameCell, frameSignature)
2. The check compares against expected values derived from the recipe (not hardcoded)
3. The check does not modify workbench state as a side effect
4. The check result is deterministic given the same recipe and fixture

### 6.4 Inspector Actions in M2

The legacy frame inspector is demoted to debug-only in Milestone 2. Inspector actions
(`openInspector`, inspector tool application, inspector selection/transform/find-replace`)
are classified as **diagnostic only** and MUST NOT appear in `manual_assembly_acceptance` recipes.

The whole-sheet editor is the only acceptance-eligible editing surface.

Inspector functions that are shared infrastructure (e.g., `inspectorCellFromLocal()`,
`readFrameCell()`, `frameSignature()`) may be used for verification checks since they are
read-only utilities, not inspector-specific editing actions.

### 6.5 Forbidden in Acceptance Recipes

The following are forbidden in `manual_assembly_acceptance` mode:

- `__wb_debug._setCell()` — direct cell mutation bypassing UI
- `__wb_debug._pushHistory()` — synthetic history manipulation
- `__wb_debug.loadSessionJson()` — synthetic session injection
- `openInspector()` — inspector as editing surface
- Any `inspectorTool*` actions
- Any `page.evaluate()` that modifies `state.*` directly

These may appear in `diagnostic` mode recipes only.

---

## 7. Implementation Roadmap

> **v2 revision**: Roadmap restructured per audit findings. Phase 0 (shared lib extraction)
> is now prerequisite. Thin runner pattern replaces per-slice monolith runners.

### 7.0 Phase 0: Shared Infrastructure (PREREQUISITE)

Extract shared code from M1 runners before any M2 work. See Appendix C for full spec.

| Component | Priority | Scope |
|-----------|----------|-------|
| `selectors.mjs` — DOM selector registry | P0 | ~120 lines, 60+ selectors |
| `verifier_lib.mjs` — shared utilities | P0 | ~400 lines, 18 exported functions |
| `action_registry.json` — action name enum + trigger_type + defaults | P0 | ~150 lines JSON |
| `recipe_schema.json` — JSON Schema for recipes | P0 | ~200 lines JSON |
| Thin M1 runners — refactor existing to use shared lib | P0 | Net reduction ~600 lines |

### 7.1 Phase 1: Core Verifier Components

| Component | Priority | Dependencies | Scope |
|-----------|----------|-------------|-------|
| `getState()` patch (9 missing properties) | P0 | None | ~10 lines in workbench.js |
| `queryState()` in verifier_lib | P0 | getState patch | ~50 lines JS |
| Recipe format parser + validator | P0 | recipe_schema.json | ~100 lines JS |
| Error handling wrapper (timeout, retry, screenshot) | P0 | verifier_lib | ~150 lines JS |
| Slice 1 runner (Python, headless) | P0 | PNG fixtures | ~150 lines Python |

### 7.2 Phase 2: Slice Runners (Thin Pattern)

All M2 runners are thin (~55 lines each) using `verifier_lib.mjs`.

| File | Slice | Scope |
|------|-------|-------|
| `tests/test_png_bundle_baseline.py` | Slice 1 | ~150 lines Python |
| `run_m2_source_panel_test.mjs` | Slice 2 | ~55 lines (thin) |
| `run_m2_assembly_test.mjs` | Slices 3-4 | ~80 lines (thin) |
| `run_m2_acceptance_test.mjs` | Slice 5 | ~100 lines (thin) |
| `m2_recipe_generator.py` | Recipe gen | ~200 lines Python |

### 7.3 Execution Ordering

1. **Phase 0**: Extract `selectors.mjs` + `verifier_lib.mjs` from M1 runners (pure refactor)
2. **Phase 0**: Create `action_registry.json` + `recipe_schema.json`
3. **Phase 1**: Patch `getState()` with 9 missing properties
4. **Phase 1**: Create PNG fixtures (copy from `SMALLTESTPNGs/`)
5. **Phase 1**: Implement Slice 1 (headless Python — immediate MVP value)
6. **Phase 1**: Add error handling wrapper + partial execution support
7. **Phase 2**: Implement Slice 2 (source panel — most granular)
8. **Phase 2**: Implement Slices 3-4 (assembly + WS corrections)
9. **Phase 2**: Implement Slice 5 (full acceptance)
10. **Phase 2**: Implement M2 recipe generator with mode enforcement

---

## 8. Open Questions

> **v2 revision**: Questions 2, 6, and 7 from v1 are now RESOLVED by planner agents.
> See Appendices A-C for the specifications.

### Resolved

1. ~~**Drag-drop Playwright simulation**~~ — **RESOLVED.** Full `page.mouse` sequence specified
   in Appendix A. Uses `mouse.down` on source box center → `mouse.move` past 3px threshold →
   `mouse.move` to target `.frame-cell` center → `mouse.up`. The product's
   `gridFrameFromClientPoint()` uses `document.elementFromPoint()` so the cursor must be
   physically over the `.frame-cell` DOM element.

2. ~~**WS cell-to-pixel mapping**~~ — **RESOLVED.** Cell `(col, row)` maps to backing-pixel
   `(col * 12 + 6, row * 12 + 6)`. No pan offset, no headers. Scroll `#wholeSheetScroll` first.
   Existing M1 `clickCanvasCell()` is the reference pattern. See Appendix A.

3. ~~**Recipe error handling**~~ — **RESOLVED.** Per-action timeouts, abort/skip/retry policy,
   screenshot-on-failure, state dumps, partial execution with `--stop-at-phase`/`--start-from-phase`.
   See Appendix B.

### Still Open

4. **Fixture determinism**: Does `source_find_sprites` produce deterministic box results for the
   same input PNG and parameters? If not, Slice 2 assertions on box count/position need tolerance.

5. **Runtime visual assertion**: Slice 5's "player sprite is visible and animates" requires
   either headed Playwright with screenshot comparison or a WASM-level position report. The
   `pos=[None,None,None]` regression from 2026-03-10 may still affect runtime classification.

6. **Undo coverage for anchor**: The confirmed `pushHistory()` gap at JS:6465 (set-anchor) means
   anchor changes are not undoable. Should the verifier assert undo coverage for all actions,
   or accept this as a known limitation?

7. **G7-G9 gate integration**: Gates G7-G9 exist in `gates.py` but are not called in
   `_run_structural_gates()`. Should Slice 1 call them directly, or wait for integration?

---

## 9. Summary

### Proposed Action DSL

8 families, 50+ action primitives covering the full PNG workflow from upload through runtime test.
Each action has a `trigger_type` (`ui_click`, `ui_gesture`, `ui_keyboard`, `api_call`, `debug_api`)
for mode enforcement.

### Verifier Slices

| Slice | Name | Mode | Acceptance? |
|-------|------|------|-------------|
| 1 | PNG Structural Baseline | `structural_baseline` | Yes (M2-A only) |
| 2 | Source-Panel Contract | `source_panel_contract` | Diagnostic |
| 3 | Source-to-Grid Contract | `source_to_grid_contract` | Diagnostic |
| 4 | Whole-Sheet Correction Contract | `ws_correction_contract` | Diagnostic |
| 5 | End-to-End Manual Assembly | `manual_assembly_acceptance` | Yes (M2 acceptance) |

### Acceptance Boundary

Only Slice 5 in `manual_assembly_acceptance` mode (and Slice 1 for M2-A structural baseline)
produce acceptance-grade evidence. Everything else is diagnostic.

### v2 Audit Findings Addressed

| Finding | Source | Resolution |
|---------|--------|-----------|
| State model: 8 missing, 3 wrong, 2 mistyped properties | Quality audit | Section 1 rewritten, `queryState()` implementation added |
| Drag-drop simulation unspecified | Gaps audit | Appendix A: full Playwright sequence |
| WS cell-to-pixel mapping unspecified | Gaps audit | Appendix A: coordinate formula |
| Context menu targeting unspecified | Gaps audit | Appendix A: right-click sequence |
| No error handling / recipe schema | Gaps audit | Appendix B: full spec |
| No partial execution | Iterability audit | Appendix B: phase markers + CLI flags |
| No trigger_type for mode enforcement | Iterability audit | Appendix B: per-action classification |
| M1/M2 runner duplication (~200 lines) | Duplication audit | Appendix C: shared lib extraction |
| No selector registry | Maintainability audit | Appendix C: `selectors.mjs` spec |
| Recipe format incompatibility | Duplication audit | Appendix C: unified format |

### Support-Doc Inaccuracies Fixed

| Doc | Issue | Fix |
|-----|-------|-----|
| `m2-png-fixture-inventory.md` | Misleading PNG counts, missing gitignore note | Added caveat + corrected summary |
| `legacy-inspector-retirement-checklist.md` | Item #1 / G5 contradiction, wrong counts | Reclassified item #1, updated counts |
| `m2-source-panel-implementation-spec.md` | Flagged for undo gaps (not confirmed) | Added caveat noting code verification |
| `semantic-edit-test-matrix.md` | Missing cross-family coverage | Added caveat with 3 specific gaps |
| `validate_semantic_maps.py` | Draft limitations undocumented | Added limitations section to docstring |

### Remaining Open Unknowns

- `source_find_sprites` determinism
- Runtime pos-reporting regression status
- G7-G9 gate integration decision
- Anchor undo gap acceptance

---

## Appendix A: Coordinate Mapping Specifications

### A.1 Source Canvas: Backing-Pixel to Viewport

The source canvas (`#sourceCanvas`) sits inside `.canvas-wrap` (`overflow: auto`, `max-height: 420px`).
Zoom is CSS-based: `canvas.style.width = Math.round(canvas.width * zoom) + 'px'`.

To target backing-pixel `(px, py)`:
1. Scroll `.canvas-wrap` to make the pixel visible
2. Read `canvas.getBoundingClientRect()`
3. `vpX = rect.left + (px + 0.5) * (rect.width / canvas.width)`
4. `vpY = rect.top + (py + 0.5) * (rect.height / canvas.height)`

The ratio `rect.width / canvas.width` equals the CSS zoom factor.

### A.2 Drag-Drop: Source Canvas to Grid Frame

**Preconditions**: `sourceMode` is `row_select` or `col_select`, selection non-empty, visual layer active.

**Playwright sequence**:
1. `page.evaluate()` to scroll `.canvas-wrap` and compute source box center viewport coords
2. `page.mouse.move(srcVpX, srcVpY)` — position over selected box
3. `page.mouse.down()` — initiate drag
4. `page.mouse.move(srcVpX + 5, srcVpY + 5, {steps: 2})` — pass 3px threshold
5. Get target `.frame-cell[data-row="R"][data-col="C"]` bounding box
6. `page.mouse.move(targetCenterX, targetCenterY, {steps: 5})` — move to grid
7. `page.mouse.up()` — triggers `dropSelectedSourceBoxesAtClientPoint()`

The product uses `document.elementFromPoint()` internally, so cursor must be over the target element.

### A.3 Context Menu: Right-Click on Source Box

1. Compute box center viewport coords (same as A.1 using box `{x, y, w, h}`)
2. `page.mouse.click(vpX, vpY, {button: 'right'})` — triggers `contextmenu` event
3. `page.locator('#sourceContextMenu:not(.hidden)').waitFor({state: 'visible'})` — wait for menu
4. `page.click('#srcCtxAddSprite')` (or other menu item) — click target item

### A.4 Whole-Sheet Editor: Cell to Viewport

Cell `(col, row)` maps to backing-pixel `(col * 12 + 6, row * 12 + 6)` (CELL_SIZE = 12, +6 for center).
No pan offset, no headers, no margins. Cell (0,0) starts at canvas pixel (0,0).

**Playwright sequence** (from existing M1 `clickCanvasCell()`):
1. `page.evaluate()` to scroll `#wholeSheetScroll` to center the target cell
2. Get `#wholeSheetCanvas` bounding box
3. `vpX = canvasBox.x + col * 12 + 6`
4. `vpY = canvasBox.y + row * 12 + 6`
5. `page.mouse.click(vpX, vpY)`

This works because the canvas displays at 1:1 CSS scale (no zoom transform).

---

## Appendix B: Recipe Error Handling, Schema, and Partial Execution

### B.1 Recipe JSON Schema

New file: `scripts/xp_fidelity_test/recipe_schema.json`

Adds to existing M1 recipe wrapper format:
- `schema_version: 2` (required for v2 recipes)
- `phases[]` — array of phase markers with `name`, `label`, `snapshotable`
- Per-action: optional `phase`, `trigger_type`, `timeout_ms`, `on_failure` fields
- Action name validated against closed enum from `action_registry.json`

v1 recipes (no `schema_version`) skip validation for backward compatibility.

### B.2 Action trigger_type Classification

| trigger_type | Description | Acceptance-eligible? |
|-------------|-------------|---------------------|
| `ui_click` | Single click on visible UI element | Yes |
| `ui_gesture` | Multi-step mouse (drag, right-click+menu) | Yes |
| `ui_keyboard` | Keyboard shortcut | Yes |
| `api_call` | Backend API call via product UI | Yes |
| `debug_api` | Direct `__wb_debug` mutation | Diagnostic only |

Mode enforcement: `manual_assembly_acceptance` allows `ui_click`, `ui_gesture`, `ui_keyboard`, `api_call`.

### B.3 Error Handling Policy

- **Per-action timeout**: Category-based defaults (10s for clicks, 20s for drags, 120s for skin dock). Override with `timeout_ms` field.
- **On failure**: `abort` (default), `skip`, or `retry` (max 3). Category-based defaults.
- **Screenshot-on-failure**: `{outDir}/failure-action-{index}-{action}-{timestamp}.png`
- **State dump on error**: `{outDir}/state-dump-action-{index}-{action}-{timestamp}.json`
- **Overall abort**: If skip count exceeds 10, treat as abort.

### B.4 Partial Execution

CLI flags for all runners:
- `--stop-at-phase <name>` — execute through named phase, then stop
- `--start-from-phase <name>` — skip to named phase (requires `--snapshot`)
- `--stop-at-action <index>` — stop after action N
- `--save-snapshot <path>` — save state after last executed action
- `--snapshot <path>` — restore state before execution

Phase names: `setup`, `conversion`, `source_extraction`, `source_correction`, `assembly`,
`grid_organization`, `ws_correction`, `finalization`.

### B.5 Failure Reporting

Per-action result: `{index, action, phase, trigger_type, status, duration_ms, attempt, screenshot_path, error}`

Execution summary: `{total_actions, executed, succeeded, skipped, failed, retried, aborted_at_index, phases_completed, phases_partial}`

---

## Appendix C: Shared Infrastructure Specification

### C.1 Selector Registry (`selectors.mjs`)

Single source of truth for all DOM IDs referenced by verifier runners. ~60+ entries covering
session, template, whole-sheet, inspector, source-panel, and grid selectors.

Grouped exports: `SEL` (flat map) and `SELECTOR_SETS.diagnostic` / `SELECTOR_SETS.acceptance`.

Python sync: Generate `selectors.json` from `selectors.mjs` for `recipe_generator.py` consumption.

### C.2 Shared Library (`verifier_lib.mjs`)

Extracted from M1 runners (eliminates ~200 lines of duplication per runner):

**Utilities**: `getArg`, `parseJsonText`, `sameRgb`, `isCellTransparent`, `runTruthTable`
**DOM helpers**: `scrollToCell`, `clickCanvasCell`, `dragOnCanvas`, `readSummary`
**Comparison**: `compareTruth`, `compareProofRegion`
**Action execution**: `executeRecipe` with pluggable action handler map
**Skin Dock**: `captureFrameProbe`, `probeShowsWorldStarted`, `pulseMainMenuAdvance`
**Browser**: `launchBrowser`, `navigateToWorkbench`

### C.3 Recipe Format Unification

Keep M1 wrapper format as canonical (has metadata: geometry, proof_region, selectors).
M2 bare-array format auto-wrapped via `normalizeRecipe()`. Action params stay flat (no nesting).
`format_version: 2` added to all new recipes.

### C.4 Thin Runner Pattern

After extraction, each slice runner is ~55-100 lines:
- Import from `verifier_lib.mjs` + `selectors.mjs`
- Argument parsing + report structure
- `navigateToWorkbench()` + `executeRecipe()` + slice-specific assertions
- Write `result.json`

### C.5 Migration Sequence

1. Create `selectors.mjs` (no other files change)
2. Create `verifier_lib.mjs` with all shared functions
3. Generate `selectors.json` for Python
4. Thin existing M1 runners (pure refactor, zero behavioral change)
5. Add M2 action handlers to `verifier_lib.mjs`
6. Create M2 slice runners using thin pattern
