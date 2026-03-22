# Legacy Inspector Retirement/Demotion Checklist

Date: 2026-03-21
Status: complete
Method: read-only code inspection of `web/workbench.js`, `web/workbench.html`, `web/whole-sheet-init.js`, and `web/rexpaint-editor/` modules
Corrective pass: 2026-03-21 (verifier design handoff audit)

> **Caveat (2026-03-21 corrective pass):** This doc was flagged for two issues:
> (1) Feature table item #1 (Inspect tool) is classified as "Missing" but gap section G5
> below is marked "Resolved" because WS Info panel provides live cell-under-cursor readout.
> This is an internal contradiction — item #1 should be reclassified as "Replaced" (partial).
> (2) Summary counts say "12 missing" but should be 11 given the G5 reclassification.
> Both are corrected below.

---

## Summary

The legacy frame-by-frame inspector (`cellInspectorPanel`) comprises approximately 1,450 lines of JS logic in `web/workbench.js` and 97 lines of HTML (`web/workbench.html` lines 317-413). It provides frame-scoped cell editing with half-cell paint, glyph stamping, selection operations, find/replace, clipboard, and transforms.

The whole-sheet editor (`web/whole-sheet-init.js`, 1590 lines) provides a whole-grid canvas with cell/line/rect/fill/eyedropper/erase tools, glyph picker, palette, layer management, and keyboard shortcuts. It is already mounted and functional in the shipped workbench.

**Classification totals:** 12 replaced (3 WS-only, 1 partial — inspect/readout via WS Info panel), 18 debug fallback, 11 missing (feature gaps). Of the 11 missing features, 9 are gated on SelectTool import.

---

## Feature-by-Feature Comparison Table

### Drawing/Editing Tools

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 1 | Inspect tool (read cell properties) | `applyInspectorToolAt()` JS:3408-3414 | WS Info panel (`whole-sheet-init.js:880-924`) + `_onCanvasMouseMove()` (lines 1326-1361) provide live glyph/fg/bg under cursor. No dedicated click-to-inspect mode, but passive readout covers the primary use case. | **Replaced** (partial — see G5 reclassification) |
| 2 | Half-cell Paint tool | `decodeCellHalves()`/`encodeCellHalves()` JS:1912-1949, 3425-3439 | WS Cell tool writes full XP cells, not half-cell colors | **Missing** |
| 3 | Erase tool | `applyInspectorToolAt()` JS:3428-3431 | WS EraseTool `whole-sheet-init.js:71-112` | **Replaced** |
| 4 | Eyedropper tool | `sampleInspectorGlyphAndPaintFromHit()` JS:3442-3462 | WS EyedropperTool `whole-sheet-init.js:43-69` | **Replaced** |
| 5 | Glyph stamp tool | `applyInspectorGlyphAtCell()` JS:2889-2901 | WS CellTool `rexpaint-editor/tools/cell-tool.js` | **Replaced** |
| 6 | Line tool | N/A in inspector | WS LineTool `rexpaint-editor/tools/line-tool.js` | **Replaced** (WS-only) |
| 7 | Rect tool | N/A in inspector | WS RectTool `rexpaint-editor/tools/rect-tool.js` | **Replaced** (WS-only) |
| 8 | Fill tool | N/A in inspector | WS FillTool `rexpaint-editor/tools/fill-tool.js` | **Replaced** (WS-only) |

### Selection Operations

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 9 | Rectangular selection | `inspectorSelectAll()` JS:2838-2849, mouse drag JS:6670-6738 | SelectTool exists at `rexpaint-editor/tools/select-tool.js` but NOT imported into `whole-sheet-init.js` | **Missing** |
| 10 | Copy selection | `copyInspectorSelection()` JS:2903-2917 | Depends on SelectTool integration | **Missing** |
| 11 | Paste selection | `pasteInspectorSelection()` JS:2918-2953 | Depends on SelectTool integration | **Missing** |
| 12 | Cut selection | `cutInspectorSelection()` JS:2991-2995 | Depends on SelectTool integration | **Missing** |
| 13 | Clear selection | `clearInspectorSelectionCells()` JS:2954-2990 | Depends on SelectTool integration | **Missing** |
| 14 | Fill selection with glyph | `fillInspectorSelectionWithGlyph()` JS:2996-3032 | No equivalent in WS | **Missing** |
| 15 | Replace FG/BG in selection | `replaceInspectorSelectionColor()` JS:3033-3081 | No equivalent in WS | **Missing** |
| 16 | Rotate selection CW/CCW | `transformInspectorSelection()` JS:2851-2888 | Depends on SelectTool | **Missing** |
| 17 | Flip selection H/V | `transformInspectorSelection()` JS:2851-2888 | Depends on SelectTool | **Missing** |

### Frame Operations

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 18 | Copy frame | `copyInspectorFrame()` JS:3171-3179 | Grid ctx menu `copySelectedFrameToClipboard()` JS:5642 uses same infra; not inspector-dependent. **Note:** grid context menu equivalent exists (`ctxCopy`, JS:6481), inspector not required. | **Fallback** |
| 19 | Paste frame | `pasteInspectorFrame()` JS:3181-3197 | Grid ctx menu `pasteClipboardToSelectedFrame()` JS:5656 uses `writeFrameCellMatrix()`. **Note:** grid context menu equivalent exists (`ctxPaste`, JS:6487), inspector not required. | **Fallback** |
| 20 | Flip frame H | `flipInspectorFrameHorizontal()` JS:3199-3215 | Only via inspector or keyboard `F` when inspector open | **Fallback** |
| 21 | Clear frame | `clearInspectorFrame()` JS:3216-3230 | Grid ctx menu delete via `deleteSelectedFrames()`. **Note:** grid context menu equivalent exists (`ctxDelete`, JS:6493) and Delete key (JS:6877), inspector not required. | **Fallback** |

### Find & Replace

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 22 | Find & Replace (XP cell) | `applyInspectorFindReplace()` JS:3082-3153 | No WS equivalent. Multi-criteria glyph/fg/bg match with per-channel replacement. | **Missing** |

### Navigation

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 23 | Prev/Next angle (Q/R) | `moveInspectorSelection(-1,0)/(1,0)` JS:3155-3169 | WS `panToFrame()` + grid auto-pan JS:5458 | **Replaced** |
| 24 | Prev/Next frame (A/D) | `moveInspectorSelection(0,-1)/(0,1)` JS:3155-3169 | Same `panToFrame()` mechanism | **Replaced** |

### Display & Palette

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 25 | Zoom (4x-28x) | `state.inspectorZoom` HTML:325 | WS fixed at 12px/cell | **Fallback** |
| 26 | Grid overlay toggle | `state.inspectorShowGrid` HTML:353 | No WS grid toggle | **Fallback** |
| 27 | Checker pattern toggle | `state.inspectorShowChecker` HTML:354 | No WS checker overlay | **Fallback** |
| 28 | Hover readout | `inspectorHoverReadout` HTML:378, JS:2023-2029 | WS `_onCanvasMouseMove()` at `whole-sheet-init.js:1326-1361` updates `wsPos`, `wsHoverGlyph`, `wsHoverFg`, `wsHoverBg` live on mouse move | **Replaced** |
| 29 | Cell info line | `cellInspectorInfo` HTML:412, JS:3369-3375 | WS Info panel at `whole-sheet-init.js:880-924` shows pos, glyph code+char, fg/bg swatches under cursor | **Replaced** |
| 30 | Palette swatches (12 colors) | `INSPECTOR_SWATCHES` JS:11-24 | WS has full 64-color palette `whole-sheet-init.js:24-37` | **Replaced** |

### Debug API (`__wb_debug`)

| # | Inspector Feature | Location | WS Status | Class |
|---|---|---|---|---|
| 31 | `openInspector()` | JS:7084-7091 | `focusWholeSheetFrame()` JS:7092-7094 is primary | **Fallback** |
| 32 | `getInspectorState()` | JS:7125-7163 | Diagnostic-only, used by verifier | **Fallback** |
| 33 | Inspector selection/hover/glyph APIs | JS:7164-7276 | Used by verifier diagnostic mode | **Fallback** |
| 34 | `runInspectorAction()` | JS:7254-7276 | Used by verifier diagnostic mode replay | **Fallback** |
| 35 | `readFrameCell()`/`writeFrameCell()` | JS:7277-7336 | Uses `inspectorCellFromLocal()` - shared infra | **Fallback** |
| 36 | `frameSignature()` | JS:7337-7349 | Frame content hash for verification; not inspector-dependent | **Fallback** |
| 37 | `getWholeSheetEditorState()` | JS:7350-7354 | Delegates to `window.__wholeSheetEditor.getState()` -- WS-native | **Fallback** |
| 38 | `readLayerCell()` | JS:7355-7364 | Layer-aware cell accessor; not inspector-dependent | **Fallback** |
| 39 | `setActiveLayer()` | JS:7365-7370 | Layer switching; not inspector-dependent | **Fallback** |
| 40 | `readFrameRect()` | JS:7321-7336 | Bulk cell read over rectangle; uses `readFrameCell()` | **Fallback** |
| 41 | Utility methods | JS:7048-7083 | `suppressAutoSave`, `flushSave`, `suppressRender`, `_state`, `_setCell`, `_pushHistory`, `_undo`, `_redo`, UI recorder hooks, `openWebbuild`, `testSkinDock` | **Fallback** |

---

## What Can Be Hidden from Default UI Now

Following the precedent of `legacyGridDetails` at `workbench.html:149-152`:

1. **`cellInspectorPanel`** (HTML:317-413) -- wrap in `<details class="legacy-inspector-debug"><summary>Legacy Frame Inspector (debug)</summary>...</details>`.
2. No JS changes needed -- `$("cellInspectorPanel")` resolves regardless of details-collapsed state.
3. `openInspectorBtn` (HTML:121) already says "Focus Whole-Sheet" and delegates to `focusWholeSheetFrame()`. Keep visible.
4. Grid context menu "Focus Whole-Sheet" (`ctxOpenInspector`, HTML:138) already renamed. Keep.

**Constraint:** Do NOT remove inspector code. The `__wb_debug` API methods referencing inspector functions are used by the verifier recipe runner and must remain functional.

---

## What Must Remain as Fallback

1. `openInspector()` (JS:3232-3250) -- fallback when WS not mounted (JS:3257-3259)
2. `inspectorFrameCellMatrix()`/`writeFrameCellMatrix()` -- used by grid context menu copy/paste (JS:5642-5681) and frame swap (JS:5714-5740)
3. `inspectorCellFromLocal()` (JS:2701-2706) -- frame-local-to-global mapping, used by `readFrameCell()`/`writeFrameCell()` in `__wb_debug`
4. `renderInspector()` (JS:3285-3378) -- must remain callable for diagnostic use
5. All `__wb_debug` inspector methods -- verifier diagnostic mode
6. Inspector zoom and grid/checker overlays -- pixel-level verification
7. ~~Hover/info readouts~~ -- **Reclassified as Replaced**: WS Info panel (`whole-sheet-init.js:880-924`) and `_onCanvasMouseMove()` (`whole-sheet-init.js:1326-1361`) provide live cell-under-cursor readout with glyph, fg, bg

---

## Feature Gaps That Block Full Retirement

### Critical (block M2 editor workflow)

| Gap | Feature | Impact | Mitigation |
|---|---|---|---|
| G1 | No SelectTool in WS | Cannot select, copy, paste, cut, clear, or fill regions. Largest single gap (9/12 missing features gated on this). | Import `SelectTool` from `rexpaint-editor/tools/select-tool.js` into `whole-sheet-init.js`. Also import `TextTool` (`text-tool.js`) and `OvalTool` (`oval-tool.js`) which are similarly available but not wired. |
| G2 | No Find & Replace in WS | Cannot batch-replace glyphs/colors. Required for sprite recoloring. | Implement as WS sidebar panel. Whole-sheet scope more powerful than inspector's frame scope. |
| G3 | No clipboard ops in WS | Cannot duplicate/move cell regions. No Ctrl+C/X/V. | Requires G1. Implement clipboard buffer + keyboard shortcuts in `_onKeyDown()` |

### Medium (workarounds exist)

| Gap | Feature | Impact | Workaround |
|---|---|---|---|
| G4 | No half-cell paint in WS | Cannot paint individual half-cells (top/bottom). Inspector uses glyphs 219/220/223. | Use WS Cell tool with explicit half-block glyph selection. Same cell model. |
| ~~G5~~ | ~~No inspect/read mode in WS~~ | **Resolved.** WS Info panel (`whole-sheet-init.js:880-924`) shows live glyph/fg/bg under cursor via `_onCanvasMouseMove()` (lines 1326-1361). | Already implemented. |
| G6 | No selection transforms in WS | Cannot rotate/flip selected regions. | Requires G1. Add toolbar buttons. |

### Low (nice-to-have)

| Gap | Feature | Impact | Workaround |
|---|---|---|---|
| G7 | No zoom in WS | Fixed 12px/cell. Cannot zoom for fine work. | Add canvas zoom/scroll. |
| G8 | No grid/checker overlay in WS | Cannot visualize cell boundaries or transparency. | Add toggle buttons to WS toolbar. |

---

## Recommended Retirement Sequence for Milestone 2

### Phase 1: Demote Now (zero risk, no feature work)
Wrap `cellInspectorPanel` in `<details>` tag. Precedent: `legacyGridDetails` at HTML:149.

### Phase 2: Import SelectTool, TextTool, OvalTool (unblocks G1, G3, G6)
Import `SelectTool` from `rexpaint-editor/tools/select-tool.js` into `whole-sheet-init.js`. Wire into tool switching. Highest-impact single change. Also import `TextTool` from `rexpaint-editor/tools/text-tool.js` and `OvalTool` from `rexpaint-editor/tools/oval-tool.js` -- both exist as complete implementations but are not currently imported (same pattern as SelectTool: available but not wired).

### Phase 3: Add clipboard ops (unblocks G3)
Copy/paste/cut for WS selection. Add Ctrl+C/X/V. Requires Phase 2.

### Phase 4: Add Find & Replace (unblocks G2)
Port `applyInspectorFindReplace()` logic to WS scope (whole-sheet-or-selection). Requires Phase 2.

### Phase 5: ~~Add cell info readout~~ (DONE -- already replaced)
WS Info panel (`whole-sheet-init.js:880-924`) and `_onCanvasMouseMove()` (`whole-sheet-init.js:1326-1361`) already provide live glyph/fg/bg readout under cursor. G5 is resolved.

### Phase 6: Add zoom and overlays (unblocks G7, G8)
Canvas zoom/scroll. Grid line and checker overlays. Independent.

### Phase 7: Full retirement
Remove `openInspector()` fallback in `focusWholeSheetFrame()` (JS:3257-3259). Inspector stays as collapsed debug panel. Never auto-opened.

**Do NOT delete:** `inspectorCellFromLocal()`, `inspectorFrameCellMatrix()`, `writeFrameCellMatrix()`, `__wb_debug` inspector methods, `decodeCellHalves()`/`encodeCellHalves()`.

---

## Inspector Code Volume

| Location | Lines | Purpose |
|---|---|---|
| `web/workbench.js:1952-2100` | ~148 | `updateInspectorToolUI()`, palette swatches |
| `web/workbench.js:2628-2787` | ~159 | Frame cell matrix, selection matrix, coordinate utils |
| `web/workbench.js:2838-3230` | ~392 | Selection ops, transforms, find/replace, frame ops, open/close |
| `web/workbench.js:3285-3478` | ~193 | renderInspector, hit detection, tool application, stroke commit |
| `web/workbench.js:5461-5691` | ~14 | openInspectorForSelectedFrame, openInspectorFromGridContextMenu |
| `web/workbench.js:6624-6740` | ~116 | Inspector button bindings, mouse handlers |
| `web/workbench.js:6780-6920` | ~140 | Inspector keyboard shortcuts |
| `web/workbench.js:7084-7276` | ~192 | `__wb_debug` inspector APIs |
| `web/workbench.html:317-413` | ~97 | Inspector panel HTML |
| **Total** | **~1,451** | ~400 lines are shared infra that must survive retirement |
