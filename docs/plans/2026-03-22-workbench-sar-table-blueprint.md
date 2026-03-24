# Unified Full-Workbench SAR Table Blueprint

Date: 2026-03-22
Status: active
Method: Code audit of `web/workbench.js` (7647 lines), `web/workbench.html`, `web/whole-sheet-init.js`, `config/template_registry.json`, and all governing contracts/plans.
Depends on:
- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-22-workbench-verifier-sar-model` (architecture context)
- `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-22-milestone-1-edge-case-verifier-plan` (M1 edge-case verifier)
- `docs/plans/2026-03-21-milestone-2-png-verifier-design.md` (M2 verifier design)
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` (canonical contract)

## Purpose

This document is the exhaustive State-Action-Response (SAR) blueprint for the full shipped workbench. It enumerates every observable state domain, every user-reachable action, and every expected response/invariant. It maps each SAR slice to the Milestone 1 and Milestone 2 verifier families and identifies gaps in the current debug/state exposure API.

This blueprint is also the canonical input to future generated verifier sequences. The long-term
edge-case verifier should be able to choose bounded randomized actions from this table, derive the
expected SAR assertions for each step, and emit a reproducible recipe + seed artifact.

This is a planning/documentation artifact. It does not modify any code.

---

## 1. State Surfaces

### 1.1 Global / Session Identity

| Field | Type | JS Source | In `getState()`? | In `_state()`? |
|-------|------|-----------|-------------------|----------------|
| `jobId` | string | `state.jobId` | YES | YES |
| `sessionId` | string\|null | `state.sessionId` | YES | YES |
| `gridCols` | int | `state.gridCols` | NO | YES |
| `gridRows` | int | `state.gridRows` | NO | YES |
| `latestXpPath` | string | `state.latestXpPath` | NO | YES |
| `sourcePath` | string | `state.sourcePath` | NO | YES |
| `sessionDirty` | boolean | `state.sessionDirty` | NO | YES |
| `sessionSaveInFlight` | boolean | `state.sessionSaveInFlight` | NO | YES |
| `sessionLastSaveOkAt` | number | `state.sessionLastSaveOkAt` | NO | YES |
| `sessionLastSaveReason` | string | `state.sessionLastSaveReason` | NO | YES |

**History/Future (undo/redo stack):**

| Field | Type | JS Source | In `getState()`? |
|-------|------|-----------|-------------------|
| `historyDepth` | int | `state.history.length` | YES |
| `futureDepth` | int | `state.future.length` | YES |

Note: The system uses stack-pop undo/redo (`history[]` + `future[]`), not an index model. There is no `historyIndex`.

### 1.2 Template / Bundle

| Field | Type | JS Source | In `getState()`? | In `_state()`? |
|-------|------|-----------|-------------------|----------------|
| `templateSetKey` | string | `state.templateSetKey` | NO | YES |
| `bundleId` | string\|null | `state.bundleId` | NO | YES |
| `activeActionKey` | string | `state.activeActionKey` | NO | YES |
| `actionStates` | `Record<string, {sessionId, jobId, status}>` | `state.actionStates` | NO | YES |
| `templateRegistry` | object\|null | `state.templateRegistry` | NO | YES |

**Derived / UI-text state (observable via DOM):**

| Field | Type | JS Source |
|-------|------|-----------|
| `bundleStatus` (text) | string | `$("bundleStatus").textContent` |
| `wbStatus` (text) | string | `$("wbStatus").textContent` |
| `templateStatus` (text) | string | `$("templateStatus").textContent` |
| `uploadPanelLabel` (text) | string | `$("uploadPanelLabel").textContent` |

**`isBundleMode()`**: Returns `!!state.bundleId`. Controls routing for convert, save, export, tab rendering, and Skin Dock label.

**`areAllEnabledBundleActionsReady()`**: All enabled action keys have status `saved` or `converted`.

**`isBundleActionReadyStatus(s)`**: `s === "saved" || s === "converted"`.

### 1.3 Upload / Convert Pipeline

| Field | Type | JS Source | In `getState()`? |
|-------|------|-----------|-------------------|
| `sourceImage` | HTMLImageElement\|null | `state.sourceImage` | `sourceImageLoaded: !!state.sourceImage` (boolean) |
| `sourcePath` | string | `state.sourcePath` | NO |
| `extractedBoxes` | `Array<{id,x,y,w,h,source,...}>` | `state.extractedBoxes` | `extractedBoxes: .length` (count) + `sourceBoxes` (array) |
| `drawCurrent` | `{x,y,w,h}\|null` | `state.drawCurrent` | YES (cloned) |
| `drawMode` | boolean | `state.drawMode` | NO |
| `drawing` | boolean | `state.drawing` | NO |
| `drawStart` | object\|null | `state.drawStart` | NO |

### 1.4 Source Panel

| Field | Type | JS Source | In `getState()`? |
|-------|------|-----------|-------------------|
| `sourceMode` | string (`select`\|`draw_box`\|`row_select`\|`col_select`\|`cut_v`) | `state.sourceMode` | YES |
| `sourceSelection` | Set\<number\> | `state.sourceSelection` | YES (as Array) |
| `anchorBox` | `{id,x,y,w,h}\|null` | `state.anchorBox` | YES |
| `rapidManualAdd` | boolean | `state.rapidManualAdd` | YES |
| `sourceCutsV` | `Array<{id,x}>` | `state.sourceCutsV` | NO |
| `sourceCutsH` | `Array<{id,x}>` | `state.sourceCutsH` | NO |
| `sourceSelectedCut` | number\|null | `state.sourceSelectedCut` | NO |
| `sourceNextId` | int | `state.sourceNextId` | NO |
| `sourceCanvasZoom` | number (1-6) | `state.sourceCanvasZoom` | NO |
| `sourceDrag` | object\|null | `state.sourceDrag` | NO |
| `sourceRowDrag` | object\|null | `state.sourceRowDrag` | NO |
| `sourceContextTarget` | object\|null | `state.sourceContextTarget` | NO |
| `sourceDragHoverFrame` | object\|null | `state.sourceDragHoverFrame` | NO |

### 1.5 Grid Panel

| Field | Type | JS Source | In `getState()`? |
|-------|------|-----------|-------------------|
| `angles` | int | `state.angles` | YES |
| `anims` | number[] | `state.anims` | YES |
| `projs` | int | `state.projs` | YES |
| `sourceProjs` | int | `state.sourceProjs` | NO |
| `frameWChars` | int | `state.frameWChars` | YES |
| `frameHChars` | int | `state.frameHChars` | YES |
| `cellWChars` | int | `state.cellWChars` | NO |
| `cellHChars` | int | `state.cellHChars` | NO |
| `selectedRow` | int\|null | `state.selectedRow` | YES |
| `selectedCols` | Set\<int\> | `state.selectedCols` | YES (as Array) |
| `rowCategories` | Record | `state.rowCategories` | YES |
| `frameGroups` | Array | `state.frameGroups` | YES (deep cloned) |
| `gridPanelZoom` | number | `state.gridPanelZoom` | NO |
| `gridFrameDragSelect` | object\|null | `state.gridFrameDragSelect` | NO |
| `gridRowDrag` | object\|null | `state.gridRowDrag` | NO |
| `gridCellDrag` | object\|null | `state.gridCellDrag` | NO |
| `gridCellDragSuppressClick` | boolean | `state.gridCellDragSuppressClick` | NO |

### 1.6 Layers

| Field | Type | JS Source | In `getState()`? |
|-------|------|-----------|-------------------|
| `layers` | `Array<Array<Cell>>` | `state.layers` | NO |
| `cells` | `Array<Cell>` (mirror of `layers[2]`) | `state.cells` | NO |
| `hasUploadedLayers` | boolean | `state.hasUploadedLayers` | NO |
| `layerNames` | string[] | `state.layerNames` | NO |
| `activeLayer` | int | `state.activeLayer` | NO |
| `visibleLayers` | Set\<int\> | `state.visibleLayers` | NO |

### 1.7 Whole-Sheet Editor (via `__wholeSheetEditor.getState()`)

| Field | Type | Source | In WS `getState()`? |
|-------|------|--------|---------------------|
| `available` | boolean | check if `__wholeSheetEditor` exists | `__wb_debug.getWholeSheetEditorState()` |
| `mounted` | boolean | `editorState.mounted` | YES |
| `gridCols` | int | `editorState.gridCols` | YES |
| `gridRows` | int | `editorState.gridRows` | YES |
| `layerCount` | int | `editorState.layerStack.layers.length` | YES |
| `activeLayerIndex` | int | `editorState.layerStack.activeIndex` | YES |
| `hasFontLoaded` | boolean | `!!(editorState.cp437Font && cp437Font.spriteSheet)` | YES |
| `activeTool` | string | `editorState.activeTool` | YES |
| `drawGlyph` | int | `editorState.drawGlyph` | YES |
| `drawFg` | `[r,g,b]` | `editorState.drawFg` | YES |
| `drawBg` | `[r,g,b]` | `editorState.drawBg` | YES |
| `applyGlyph` | boolean | `editorState.applyGlyph` | NO |
| `applyFg` | boolean | `editorState.applyFg` | NO |
| `applyBg` | boolean | `editorState.applyBg` | NO |
| `wsVisible` | boolean | DOM: `!$('#wholeSheetPanel').classList.contains('hidden')` | DOM query only |

### 1.8 Runtime Dock / Webbuild

| Field | Type | JS Source | In `getWebbuildDebugState()`? |
|-------|------|-----------|------------------------------|
| `webbuild.loaded` | boolean | `state.webbuild.loaded` | YES |
| `webbuild.ready` | boolean | `state.webbuild.ready` | YES |
| `webbuild.actionInFlight` | boolean | `state.webbuild.actionInFlight` | NO (but `quickBtnDisabled` is exposed) |
| `webbuild.actionLabel` | string | `state.webbuild.actionLabel` | NO |
| `webbuild.loadRequestedAt` | number | `state.webbuild.loadRequestedAt` | YES |
| `webbuild.expectedSrc` | string | `state.webbuild.expectedSrc` | NO |
| `webbuild.lastLoadedSrc` | string | `state.webbuild.lastLoadedSrc` | NO |
| `webbuild.pendingAutoStartToken` | string | `state.webbuild.pendingAutoStartToken` | NO |
| `webbuild.uploadedXpBytes` | Uint8Array\|null | `state.webbuild.uploadedXpBytes` | NO |
| `webbuild.uploadedXpName` | string | `state.webbuild.uploadedXpName` | NO |
| `runtimePreflight.checked` | boolean | `state.webbuild.runtimePreflight.checked` | YES |
| `runtimePreflight.ok` | boolean | `state.webbuild.runtimePreflight.ok` | YES |
| `runtimePreflight.missing_files` | string[] | `state.webbuild.runtimePreflight.missing_files` | YES |
| `runtimePreflight.invalid_files` | string[] | `state.webbuild.runtimePreflight.invalid_files` | YES |
| `runtimePreflight.maps_found` | string[] | `state.webbuild.runtimePreflight.maps_found` | YES |
| `runtimePreflight.error` | string | `state.webbuild.runtimePreflight.error` | YES |
| `wbStatus` (text) | string | `$("wbStatus").textContent` | YES |
| `webbuildState` (text) | string | `$("webbuildState").textContent` | YES |
| `quickBtnDisabled` | boolean | `$("webbuildQuickTestBtn").disabled` | YES |
| `quickBtnText` | string | `$("webbuildQuickTestBtn").textContent` | YES |
| `iframeVisible` | boolean | `!$("webbuildFrame").classList.contains("hidden")` | YES |
| `iframeSrc` | string | `$("webbuildFrame").getAttribute("src")` | YES |

**Iframe sub-state** (from `getWebbuildDebugState().iframe`, cross-origin-guarded):

| Field | Type |
|-------|------|
| `href` | string |
| `readyState` | string |
| `hasModule` | boolean |
| `calledRun` | boolean |
| `hasLoad` | boolean |
| `hasStartGame` | boolean |
| `wasmReady` | boolean |
| `hasLegacyFsOps` | boolean |
| `hasWriteFileFs` | boolean |
| `statusText` | string |
| `progressHidden` | boolean |
| `progressValue` | number\|null |
| `progressMax` | number\|null |
| `overlayVisible` | boolean |
| `prebootApplied` | string\|null |

### 1.9 Inspector (Legacy)

| Field | Type | JS Source | In `getInspectorState()`? |
|-------|------|-----------|---------------------------|
| `inspectorOpen` | boolean | `state.inspectorOpen` | YES (`open`) |
| `inspectorRow` | int | `state.inspectorRow` | YES (`row`) |
| `inspectorCol` | int | `state.inspectorCol` | YES (`col`) |
| `inspectorTool` | string | `state.inspectorTool` | YES (`tool`) |
| `inspectorPaintColor` | `[r,g,b]` | `state.inspectorPaintColor` | YES (`paintColor`) |
| `inspectorGlyphCode` | int | `state.inspectorGlyphCode` | YES (`glyph.code`) |
| `inspectorGlyphFgColor` | `[r,g,b]` | `state.inspectorGlyphFgColor` | YES (`glyph.fg`) |
| `inspectorGlyphBgColor` | `[r,g,b]` | `state.inspectorGlyphBgColor` | YES (`glyph.bg`) |
| `inspectorSelection` | `{x1,y1,x2,y2}\|null` | `state.inspectorSelection` | YES (`selection`) |
| `inspectorSelectionClipboard` | 2D matrix\|null | `state.inspectorSelectionClipboard` | YES (size only) |
| `inspectorFrameClipboard` | 2D matrix\|null | `state.inspectorFrameClipboard` | YES (size only) |
| `inspectorHover` | `{cx,cy,half,cell}\|null` | `state.inspectorHover` | YES (`hover`) |
| `inspectorShowGrid` | boolean | `state.inspectorShowGrid` | NO |
| `inspectorShowChecker` | boolean | `state.inspectorShowChecker` | NO |

### 1.10 Bug-Report Widget

| Field | Type | JS Source | In debug API? |
|-------|------|-----------|---------------|
| `bugReport.recentErrors` | `Array<{t_ms, kind, detail}>` | `state.bugReport.recentErrors` | Via `getBugReportMetadata()` |
| Bug modal visible | boolean | DOM: `!$("bugReportModal").classList.contains("hidden")` | NO |
| Pending submission | boolean | Implied by submit button state | NO |

### 1.11 UI Recorder

| Field | Type | JS Source | In debug API? |
|-------|------|-----------|---------------|
| `uiRecorder.active` | boolean | `state.uiRecorder.active` | `getUiRecorder().active` |
| `uiRecorder.events` | Array | `state.uiRecorder.events` | `getUiRecorder().events` |
| `uiRecorder.startedAt` | number | `state.uiRecorder.startedAt` | `getUiRecorder().startedAt` |
| `uiRecorder.stoppedAt` | number | `state.uiRecorder.stoppedAt` | `getUiRecorder().stoppedAt` |

---

## 2. User-Reachable Actions

### 2.1 Template / Bundle Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| T1 | Template Select | Template panel | `#templateSelect` change | None | `templateSetKey` updates; no session change |
| T2 | Apply Template | Template panel | Click `#templateApplyBtn` | None | Creates bundle + blank sessions; `bundleId` set (multi-action) or null (single); `activeActionKey` set; `actionStates` populated; session loaded; whole-sheet editor hydrated |
| T3 | Switch Action Tab | Bundle tabs | Click bundle tab button | Bundle mode active | Saves dirty session; `activeActionKey` changes; session loaded/cleared; grid/WS rehydrated |
| T4 | Save | Session bar | Click `#btnSave` | Session exists | Flushes WS draw timer; persists session; if bundle mode and visual content exists, marks action `saved`; checks bundle completeness |
| T5 | Export XP | Session bar | Click `#btnExport` | Session exists | Saves first; exports XP binary; if bundle mode, marks action `converted`; auto-advances to next incomplete action |
| T6 | New XP | Session bar | Click `#btnNewXp` | Template applied | Saves dirty session; creates blank template session; loads it; resets history/future |
| T7 | Import XP | Session bar | Click `#xpImportBtn` + file input | .xp file selected | Uploads XP; creates job; loads session via `hydrateLoadedSession` |
| T8 | Load From Job | Session bar | Click `#btnLoad` | `jobId` in URL | Fetches pipeline output; hydrates session |

### 2.2 Upload / Convert Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| U1 | Upload PNG | Upload panel | Set `#wbFile` + click `#wbUpload` | File exists | `sourceImage` loaded; `sourcePath` set; `#wbAnalyze` enabled |
| U2 | Analyze | Upload panel | Click `#wbAnalyze` | Source uploaded | Analyze results populate form fields (angles, frames, cell dims); `#wbRun` enabled; grid state unchanged |
| U3 | Convert to XP | Upload panel | Click `#wbRun` | Analyze complete (or bundle mode) | Session created/updated; `cells` populated; grid rendered; WS editor hydrated; session loaded |

### 2.3 Source Panel Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| S1 | Set Mode: Select | Source toolbar | Click `#sourceSelectBtn` or press V | Source image loaded | `sourceMode = "select"` |
| S2 | Set Mode: Draw Box | Source toolbar | Click draw-box button or press B | Source image loaded | `sourceMode = "draw_box"` |
| S3 | Set Mode: Row Select | Source toolbar | Click `#rowSelectBtn` or press R | Source image loaded | `sourceMode = "row_select"` |
| S4 | Set Mode: Column Select | Source toolbar | Click `#colSelectBtn` or press C | Source image loaded | `sourceMode = "col_select"` |
| S5 | Set Mode: Vertical Cut | Source toolbar | Click cut-v button or press X | Source image loaded | `sourceMode = "cut_v"` |
| S6 | Draw Box | Source canvas | Mouse drag in `draw_box` mode | Mode is `draw_box` | `drawCurrent = {x,y,w,h}`; `extractedBoxes` unchanged |
| S7 | Commit Draft | Source canvas | Enter key or ctx menu | `drawCurrent` non-null | `drawCurrent` moved to `extractedBoxes`; `drawCurrent = null`; history pushed; save called |
| S8 | Select Box | Source canvas | Click box in `select` mode | Mode is `select`, box exists | `sourceSelection` updated |
| S9 | Move Box | Source canvas | Drag box in `select` mode | Box selected | Box position updated; history pushed; save called |
| S10 | Resize Box | Source canvas | Drag handle in `select` mode | Box selected | Box size updated; history pushed; save called |
| S11 | Delete Selection | Source toolbar | Delete key or click `#deleteBoxBtn` | Selection or draft non-empty | Selected items removed; history pushed; save called |
| S12 | Find Sprites | Source toolbar | Click `#extractBtn` | Source image loaded | `extractedBoxes` populated; history pushed; grid unchanged |
| S13 | Set Anchor | Context menu | Ctx menu "Set as anchor" | Target box/draft exists | `anchorBox = target dims`; save called; NO history push (not undoable) |
| S14 | Pad to Anchor | Context menu | Ctx menu "Pad to anchor size" | Anchor + target exist | Target box resized to anchor; save called |
| S15 | Add Cut V | Source canvas | Click in `cut_v` mode | Mode is `cut_v` | New cut added to `sourceCutsV` |
| S16 | Move Cut | Source canvas | Drag cut in `cut_v` mode | Cut exists | Cut position updated |
| S17 | Row Select | Source canvas | Drag in `row_select` mode | Mode is `row_select` | `sourceSelection` updated with intersecting box IDs |
| S18 | Column Select | Source canvas | Drag in `col_select` mode | Mode is `col_select` | `sourceSelection` updated |
| S19 | Source Zoom | Source toolbar | Drag `#sourceZoomInput` (range 1-6) | None | `sourceCanvasZoom` updated; canvas re-rendered |

### 2.4 Context Menu Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| C1 | Add as Sprite | Source ctx menu | Right-click + `#srcCtxAddSprite` | Draft or box target | Box committed to `extractedBoxes` |
| C2 | Add to Row Sequence | Source ctx menu | Right-click + `#srcCtxAddToRow` | Target + row selected | Box rasterized to grid at next col in selected row |
| C3 | Set as Anchor | Source ctx menu | Right-click + `#srcCtxSetAnchor` | Target exists | `anchorBox` set |
| C4 | Pad to Anchor | Source ctx menu | Right-click + `#srcCtxPadAnchor` | Anchor + target exist | Target resized |
| C5 | Delete Box | Source ctx menu | Right-click + `#srcCtxDelete` | Target exists | Target removed |
| C6 | Copy Frame | Grid ctx menu | Right-click + `#ctxCopy` | Frame selected | Frame data copied to clipboard |
| C7 | Paste Frame | Grid ctx menu | Right-click + `#ctxPaste` | Clipboard non-empty | Frame data pasted; history pushed |
| C8 | Focus Whole-Sheet | Grid ctx menu | Right-click + `#ctxOpenInspector` | Frame selected | WS panel shown; viewport panned |
| C9 | Delete Frame | Grid ctx menu | Right-click + `#ctxDelete` | Frame selected | Frame deleted |

### 2.5 Source-to-Grid Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| D1 | Drag to Grid | Cross-panel | Drag selected boxes from source canvas to grid cell | Selection non-empty, visual layer active | Boxes grouped by source rows; rasterized to grid; `selectedRow`/`selectedCols` updated; history pushed; save called |
| D2 | Add to Row Sequence | Debug API / ctx | Via `addSourceBoxToSelectedRowById()` or ctx | Row selected, visual layer active | Single box rasterized to next col in selected row; save called |

### 2.6 Grid Panel Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| G1 | Select Frame | Grid panel | Click frame tile | Grid populated | `selectedRow`/`selectedCols` set; WS auto-pans; preview updates; no cell change |
| G2 | Select Range | Grid panel | Shift+click | Grid populated | `selectedCols` range extended; no cell change |
| G3 | Row Up | Grid toolbar | Click `#rowUpBtn` | Row selected, visual layer active | Row blocks swapped; `selectedRow` updated; history pushed |
| G4 | Row Down | Grid toolbar | Click `#rowDownBtn` | Row selected, visual layer active | Row blocks swapped; `selectedRow` updated; history pushed |
| G5 | Col Left | Grid toolbar | Click `#colLeftBtn` | Cols selected, visual layer active | Column blocks shifted; history pushed |
| G6 | Col Right | Grid toolbar | Click `#colRightBtn` | Cols selected, visual layer active | Column blocks shifted; history pushed |
| G7 | Add Frame | Grid toolbar | Click `#addFrameBtn` | Visual layer active | New empty column appended to all rows; `anims` updated; history pushed |
| G8 | Delete Selected | Grid toolbar | Click `#deleteCellBtn` or Delete key | Frames selected, visual layer active | Selected columns removed; grid contracts; history pushed |
| G9 | Copy Frame (keyboard) | Grid panel | Ctrl+C | Frame selected | Frame data to clipboard |
| G10 | Paste Frame (keyboard) | Grid panel | Ctrl+V | Clipboard non-empty, frame selected | Frame data pasted; history pushed |
| G11 | Assign Row Category | Metadata panel | Select + click `#assignAnimCategoryBtn` | Row selected | `rowCategories[selectedRow]` updated |
| G12 | Assign Frame Group | Metadata panel | Input + click `#assignFrameGroupBtn` | Cols selected | `frameGroups` updated for selected cols |
| G13 | Apply Groups to Anims | Metadata panel | Click `#applyGroupsToAnimsBtn` | Frame groups defined | `anims` array recomputed from frame groups |
| G14 | Grid Zoom | Grid toolbar | Drag `#gridZoomInput` (0.75-2.5) | None | `gridPanelZoom` updated; grid re-rendered |

### 2.7 Whole-Sheet Editor Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| W1 | Focus Frame | Grid toolbar / ctx | Click `#openInspectorBtn` or `#ctxOpenInspector` or double-click frame | WS editor mounted, frame exists | WS panel visible; viewport panned to frame; no cell change |
| W2 | Paint Cell | WS canvas | CellTool click | WS visible, cell tool active | Cell at (x,y) on active layer updated with glyph/fg/bg; `onCellsChanged` fires; save debounced; history pushed on stroke start |
| W3 | Paint Line | WS canvas | LineTool drag | WS visible, line tool active | Line of cells painted; history pushed on stroke start |
| W4 | Paint Rect | WS canvas | RectTool drag | WS visible, rect tool active | Rectangle of cells painted; history pushed on stroke start |
| W5 | Fill | WS canvas | FillTool click | WS visible, fill tool active | Flood-fill from (x,y); history pushed on stroke start |
| W6 | Erase | WS canvas | EraseTool click/drag | WS visible, erase tool active | Cell set to `{glyph:0, fg:[255,255,255], bg:[0,0,0]}`; history pushed |
| W7 | Eyedropper | WS canvas | EyedropperTool click | WS visible, eyedropper active | Active draw colors updated to sampled cell; no cell change |
| W8 | Set Active Layer | WS sidebar | Layer selector change | WS visible, target layer exists | `activeLayer` changes; rendering reflects new layer |
| W9 | Toggle Layer Visibility | WS sidebar | Layer visibility checkbox | WS visible | `visibleLayers` toggled; rendering updated; no cell change |
| W10 | Select Tool | WS sidebar | Click tool button | WS visible | `activeTool` changes |
| W11 | Set Glyph | WS sidebar | Glyph code input | WS visible | `drawGlyph` updated |
| W12 | Set FG Color | WS sidebar | Color picker | WS visible | `drawFg` updated |
| W13 | Set BG Color | WS sidebar | Color picker | WS visible | `drawBg` updated |
| W14 | Toggle Apply Glyph | WS sidebar | Click apply-glyph toggle | WS visible | `applyGlyph` toggled |
| W15 | Toggle Apply FG | WS sidebar | Click apply-fg toggle | WS visible | `applyFg` toggled |
| W16 | Toggle Apply BG | WS sidebar | Click apply-bg toggle | WS visible | `applyBg` toggled |
| W17 | WS Undo | WS toolbar | Click `#wsUndoBtn` | History non-empty | Same as global undo |
| W18 | WS Redo | WS toolbar | Click `#wsRedoBtn` | Future non-empty | Same as global redo |

### 2.8 Jitter / Alignment Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| J1 | Nudge Left | Jitter panel | Click `#jitterLeftBtn` or press A | Frames selected, visual layer active | Selected frame content shifted left by step; history pushed |
| J2 | Nudge Right | Jitter panel | Click `#jitterRightBtn` or press D | Frames selected, visual layer active | Content shifted right |
| J3 | Nudge Up | Jitter panel | Click `#jitterUpBtn` or press W | Frames selected, visual layer active | Content shifted up |
| J4 | Nudge Down | Jitter panel | Click `#jitterDownBtn` or press S | Frames selected, visual layer active | Content shifted down |
| J5 | Auto Align Selected | Jitter panel | Click `#autoAlignSelectedBtn` | Frames selected, visual layer active | Selected frames auto-aligned per selected mode |
| J6 | Auto Align Row | Jitter panel | Click `#autoAlignRowBtn` | Row selected, visual layer active | All frames in row auto-aligned |

### 2.9 Session Lifecycle Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| L1 | Undo | Session bar / keyboard | Click `#undoBtn` or Ctrl+Z | `history.length > 0` | History popped; state restored; future pushed; save called with reason `"undo"` |
| L2 | Redo | Session bar / keyboard | Click `#redoBtn` or Ctrl+Y | `future.length > 0` | Future popped; state restored; history pushed; save called with reason `"redo"` |
| L3 | Refresh Page | Browser | F5 / navigate | None | Full page reload; session state from URL params + backend persistence |

### 2.10 Runtime Dock Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| R1 | Test This Skin / Test Bundle Skin | Runtime dock | Click `#webbuildQuickTestBtn` | Session exists, preflight OK, not action-busy | Deterministic test path: opens/reloads preview, exports XP, injects into runtime |
| R2 | Apply Current XP (Advanced) | Runtime dock | Click `#webbuildApplySkinBtn` | Session + runtime ready, preflight OK | Applies XP to running runtime |
| R3 | Apply In Place | Runtime dock | Click `#webbuildApplyInPlaceBtn` | Session + runtime ready, preflight OK | Applies without forced restart |
| R4 | Apply + Restart | Runtime dock | Click `#webbuildApplyRestartBtn` | Session exists, preflight OK | Exports and applies with deterministic restart |
| R5 | Upload Skin | Runtime dock | Click `#webbuildUploadTestBtn` + file input | Preflight OK | Uploads external .xp; applies to runtime |
| R6 | Open Preview | Runtime dock | Click `#webbuildOpenBtn` | Preflight OK | Opens/creates runtime iframe |
| R7 | Reload Preview | Runtime dock | Click `#webbuildReloadBtn` | Preflight OK | Reloads runtime iframe |

### 2.11 Bug Report Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| B1 | Open Bug Report | Header / WS toolbar | Click `#reportBugBtn` or `#reportBugWholeSheetBtn` | None | Bug modal shown; preview updated |
| B2 | Submit Bug Report | Bug modal | Click `#bugReportSubmitBtn` | Description non-empty | Structured report POSTed to `/api/workbench/bug-report`; includes metadata, optional session state, optional UI recorder |
| B3 | Close Bug Report | Bug modal | Click `#bugReportCloseBtn` or click backdrop | Modal open | Modal hidden |

### 2.12 UI Recorder Actions

| # | Action | UI Surface | Trigger | Preconditions | State Transitions |
|---|--------|-----------|---------|---------------|-------------------|
| X1 | Start Recorder | Recorder panel | Click `#uiRecorderStartBtn` | Not already active | `uiRecorder.active = true`; event hooks installed |
| X2 | Stop Recorder | Recorder panel | Click `#uiRecorderStopBtn` | Active | `uiRecorder.active = false`; stoppedAt set |
| X3 | Clear Recorder | Recorder panel | Click clear button | None | Events array cleared |
| X4 | Download Recorder | Recorder panel | Click download button | Events exist | JSON file downloaded |

---

## 3. Responses and Invariants

### 3.1 Template / Bundle Family

**T2: Apply Template**

- MUST: `templateSetKey` matches selected value
- MUST: For multi-action templates, `bundleId` is non-null; `activeActionKey` is first in `BUNDLE_ACTION_ORDER`
- MUST: `actionStates` has entries for all enabled action keys
- MUST: Blank session created and loaded for the initial action
- MUST NOT: Affect any existing sessions not belonging to this bundle
- BLOCKED HONESTLY: If template registry fetch fails, status shows error

**T3: Switch Action Tab**

- MUST: `activeActionKey` changes to target key
- MUST: If target action has a `sessionId`, that session loads (geometry, layers, WS editor rehydrate)
- MUST: If target action has no session, session cleared (buttons disabled, grid empty)
- MUST: Dirty current session saved before switch (switch blocked on save failure)
- MUST NOT: Corrupt linkage between action key and session
- FAILED SILENTLY (bug class): If geometry from wrong action persists after switch

**T4: Save**

- MUST: `sessionDirty = false` after success
- MUST: In bundle mode, if visual layer has meaningful content, action status promoted to `saved`
- MUST: Bundle status text updated (e.g., "2/3 actions ready")
- MUST NOT: Modify cell data
- BLOCKED HONESTLY: Save failure shows status error, `exportOut` shows failure JSON

**T5: Export XP**

- MUST: Save called first (export blocked if save fails)
- MUST: XP binary downloaded
- MUST: In bundle mode, action status promoted to `converted`
- MUST: If all actions ready, highlight Test Bundle Skin button
- MUST: If incomplete actions remain, auto-advance to next incomplete
- MUST NOT: Modify session state
- BLOCKED HONESTLY: Export failure shown in `exportOut`

**T6: New XP**

- MUST: Template must be applied (blocked otherwise)
- MUST: Dirty session saved first
- MUST: New blank session created with correct geometry from template
- MUST: In bundle mode, action's `sessionId` updated; status reset to `blank`
- MUST: History/future cleared
- MUST: WS editor rehydrated with blank layer data
- MUST NOT: Affect other bundle actions' sessions

### 3.2 Upload / Convert Family

**U1: Upload PNG**

- MUST: `sourceImage` becomes non-null; `sourceImageLoaded` is true
- MUST: Analyze button enabled
- MUST NOT: Grid state changes; extractedBoxes changes; session metadata changes

**U2: Analyze**

- MUST: Analyze results populate suggestion fields
- MUST: Convert button enabled
- MUST NOT: Modify session state, source boxes, or grid

**U3: Convert to XP**

- MUST: Session created with non-null cells
- MUST: Grid geometry matches template registry (if bundle mode): `angles`, `frameWChars`, `frameHChars`, `projs`, `layers`
- MUST: WS editor hydrated
- MUST NOT: Corrupt existing bundle action sessions

### 3.3 Source Panel Family

**Cross-family invariant**: ALL source-panel actions (S1-S19) MUST NOT modify:
- `state.cells` (grid cell data)
- `state.selectedRow` / `state.selectedCols` (grid selection)
- `state.angles` / `state.anims` / `state.frameWChars` / `state.frameHChars` (session geometry)
- Whole-sheet editor state

**S1-S5: Set Mode**

- MUST: `sourceMode` changes to target mode
- MUST: Mode hint text updates
- MUST NOT: Box/cut/grid state changes; save triggered

**S6: Draw Box**

- MUST: `drawCurrent = {x,y,w,h}` (blue draft box visible)
- MUST NOT: `extractedBoxes` changes (draft is uncommitted)

**S7: Commit Draft**

- MUST: `extractedBoxes.length` increases by 1
- MUST: New box matches draft dimensions; `drawCurrent = null`
- MUST: `pushHistory()` called; `saveSessionState("add-source-box")` called

**S12: Find Sprites**

- MUST: `extractedBoxes` populated with auto-detected boxes
- MUST: Manual boxes preserved (not replaced)
- MUST: `pushHistory()` called

**S13: Set Anchor**

- KNOWN GAP: No `pushHistory()` call -- anchor set is NOT undoable
- MUST: `anchorBox` set to target dimensions
- MUST: `saveSessionState("set-anchor")` called

### 3.4 Grid Family

**G1: Select Frame**

- MUST: `selectedRow`/`selectedCols` set
- MUST: WS auto-pans to frame; preview updates
- MUST NOT: Cell data changes; save triggered

**G3/G4: Row Up/Down**

- MUST: Row blocks swapped; `selectedRow` tracks new position
- MUST: `pushHistory()` called
- MUST NOT: Total cell count changes; frame content lost (reordered only)
- VERIFIABLE: `frameSignature(old_row, col) == frameSignature(new_row, col)` post-swap

**G7: Add Frame**

- MUST: New empty column appended to all rows; `anims` updated
- MUST: `pushHistory()` called
- MUST NOT: Existing frame content changes

**G8: Delete Selected**

- MUST: Selected columns removed from all rows; grid contracts
- MUST: `pushHistory()` called
- MUST NOT: Non-selected frame content changes

### 3.5 Whole-Sheet Editor Family

**W2-W6: Paint/Line/Rect/Fill/Erase**

- MUST: Target cells on active layer updated with specified values
- MUST: `pushHistory()` called on stroke start (via `onStrokeStart`)
- MUST: `saveSessionState("whole-sheet-draw-cells")` debounced
- MUST: `onCellsChanged` callback fires to sync grid rendering
- MUST NOT: Other layers affected; non-targeted cells affected

**W7: Eyedropper**

- MUST: Active draw colors (glyph, fg, bg) updated to sampled cell
- MUST NOT: Any cell data changes

**W8: Set Active Layer**

- MUST: `activeLayer` changes; cell rendering reflects new layer
- MUST NOT: Cell data changes

### 3.6 Session Lifecycle Family

**L1/L2: Undo/Redo**

- MUST: State snapshot restored from history/future stack
- MUST: Undo followed by redo returns to identical state
- MUST: `historyDepth`/`futureDepth` adjust by 1
- MUST: Save called with reason `"undo"` or `"redo"`
- VERIFIABLE: `frameSignature` for all frames matches snapshot

**L3: Refresh Page**

- MUST: Restored UI truth matches persisted backend truth
- MUST: Active action/session linkage correct
- MUST NOT: Silently corrupt bundle/session/action linkage

### 3.7 Runtime Dock Family

**R1: Test This Skin / Test Bundle Skin**

- MUST: Session exists AND preflight OK AND not action-busy (button disabled otherwise)
- MUST: XP exported, injected into webbuild iframe
- MUST: Game loads with custom skin; player sprite visible
- MUST NOT: Session state modified by test
- BLOCKED HONESTLY: Button disabled with title tooltip explaining reason (preflight failure, session missing, action busy)

**R2-R7: Apply/Upload/Open/Reload**

- MUST: Preflight OK for all (button disabled otherwise with tooltip)
- MUST: Action-busy mutex respected (only one skin action at a time)
- BLOCKED HONESTLY: `actionInFlight` prevents concurrent actions; title tooltip explains

### 3.8 Bug Report Family

**B2: Submit Bug Report**

- MUST: Description non-empty (blocked with inline error otherwise)
- MUST: Structured payload includes: category, severity, description, metadata (URL, userAgent, viewport)
- MUST: If "include session" checked: sessionId, jobId, bundleId, templateSetKey, activeActionKey, grid info, layers info, runtime state, recent errors
- MUST: If "include recorder" checked: UI recorder events included
- MUST NOT: Modify any application state

---

## 4. Verifier Mapping

### 4.1 Per-SAR-Slice Coverage

| SAR ID | Action | M1 Only | M2 Only | Shared | Existing Verifier |
|--------|--------|---------|---------|--------|-------------------|
| T1 | Template Select | | | X | none |
| T2 | Apply Template | X | | X | edge_workflow (recipe A) |
| T3 | Switch Action Tab | X | | X | edge_workflow (recipe B) |
| T4 | Save | X | | X | full_recreation (implicit) |
| T5 | Export XP | X | | X | full_recreation (implicit) |
| T6 | New XP | X | | | edge_workflow (recipe C) |
| T7 | Import XP | | X | | none |
| T8 | Load From Job | | | X | none |
| U1 | Upload PNG | | X | | none |
| U2 | Analyze | | X | | none |
| U3 | Convert to XP | X | X | X | full_recreation (bundle) |
| S1-S5 | Source Mode | | X | | M2 Slice 2 |
| S6-S7 | Draw/Commit Box | | X | | M2 Slice 2 |
| S8-S10 | Select/Move/Resize Box | | X | | M2 Slice 2 |
| S11 | Delete Selection | | X | | M2 Slice 2 |
| S12 | Find Sprites | | X | | M2 Slice 2 |
| S13-S14 | Anchor | | X | | M2 Slice 2 |
| S15-S16 | Cut V | | X | | M2 Slice 2 |
| S17-S18 | Row/Col Select | | X | | M2 Slice 2 |
| S19 | Source Zoom | | X | | none |
| C1-C5 | Source Ctx Menu | | X | | M2 Slice 2 |
| C6-C9 | Grid Ctx Menu | | | X | none |
| D1-D2 | Source-to-Grid | | X | | M2 Slice 3 |
| G1-G2 | Grid Select | | | X | none |
| G3-G6 | Grid Move Row/Col | | | X | none |
| G7 | Add Frame | | | X | none |
| G8 | Delete Selected | | | X | none |
| G9-G10 | Grid Copy/Paste (kbd) | | | X | none |
| G11-G13 | Assign Category/Group | | | X | none |
| G14 | Grid Zoom | | | X | none |
| W1 | Focus Frame | X | X | X | full_recreation (implicit) |
| W2 | Paint Cell | X | X | X | full_recreation (ws_paint_cell) |
| W3 | Paint Line | | | X | none |
| W4 | Paint Rect | | | X | none |
| W5 | Fill | | | X | none |
| W6 | Erase | | X | X | M2 Slice 4 |
| W7 | Eyedropper | | X | X | M2 Slice 4 |
| W8 | Set Active Layer | X | X | X | M2 Slice 4 |
| W9 | Toggle Layer Vis | | X | X | M2 Slice 4 |
| W10 | Select Tool | X | | X | full_recreation (implicit) |
| W11-W13 | Set Glyph/Colors | X | | X | full_recreation (implicit) |
| W14-W16 | Toggle Apply Modes | | | X | none |
| W17-W18 | WS Undo/Redo | | | X | none |
| J1-J6 | Jitter/Align | | | X | none |
| L1 | Undo | | X | X | M2 Slice 4 |
| L2 | Redo | | X | X | M2 Slice 4 |
| L3 | Refresh | X | | | edge_workflow (recipe D) |
| R1 | Test Skin | X | | X | edge_workflow (recipe E) |
| R2-R4 | Apply Skin | | | X | none |
| R5 | Upload Skin | | | X | none |
| R6-R7 | Open/Reload Preview | | | X | none |
| B1-B3 | Bug Report | | | X | none |
| X1-X4 | UI Recorder | | | X | none |

### 4.2 Summary Coverage

| Category | Total Actions | Covered by M1 verifiers | Covered by M2 verifiers | No verifier |
|----------|--------------|------------------------|------------------------|-------------|
| Template/Bundle (T) | 8 | 5 (edge_workflow) | 1 (Import XP) | 2 |
| Upload/Convert (U) | 3 | 1 (Convert) | 2 | 0 |
| Source Panel (S) | 19 | 0 | 15 (Slice 2) | 4 |
| Context Menu (C) | 9 | 0 | 5 (Slice 2) | 4 |
| Source-to-Grid (D) | 2 | 0 | 2 (Slice 3) | 0 |
| Grid Panel (G) | 14 | 0 | 0 | 14 |
| Whole-Sheet (W) | 18 | 5 (full_recreation) | 4 (Slice 4) | 9 |
| Jitter (J) | 6 | 0 | 0 | 6 |
| Lifecycle (L) | 3 | 1 (Refresh) | 2 (Slice 4) | 0 |
| Runtime Dock (R) | 7 | 1 (Test Skin) | 0 | 6 |
| Bug Report (B) | 3 | 0 | 0 | 3 |
| UI Recorder (X) | 4 | 0 | 0 | 4 |
| **TOTAL** | **96** | **13** | **31** | **52** |

**52 of 96 user-reachable actions have no verifier coverage at all.** The largest uncovered families are: Grid Panel (14), Whole-Sheet advanced tools (9), Runtime Dock non-test (6), Jitter (6), Context Menu grid (4).

---

## 5. Gaps in Current Debug / State Exposure

### 5.1 Fields Already Exposed on `__wb_debug.getState()` (JS:7240-7262)

These fields are accessible to verifiers today:

| Field | Serialization |
|-------|---------------|
| `jobId` | string |
| `sessionId` | string\|null |
| `angles` | int |
| `anims` | Array copy |
| `projs` | int |
| `frameWChars` | int |
| `frameHChars` | int |
| `selectedRow` | int\|null |
| `selectedCols` | Array (from Set) |
| `rowCategories` | shallow clone |
| `frameGroups` | deep clone |
| `sourceMode` | string |
| `rapidManualAdd` | boolean |
| `sourceImageLoaded` | boolean |
| `drawCurrent` | shallow clone\|null |
| `sourceSelection` | Array (from Set) |
| `extractedBoxes` | count (int) |
| `sourceBoxes` | Array of `{id,x,y,w,h}` |
| `anchorBox` | shallow clone\|null |
| `historyDepth` | int |
| `futureDepth` | int |

### 5.2 Fields Exposed on `getWebbuildDebugState()` (JS:7263-7311)

All runtime dock fields listed in Section 1.8 above.

### 5.3 Fields Exposed on `getWholeSheetEditorState()` (JS:7614-7618)

All WS fields listed in Section 1.7 above (except `applyGlyph`, `applyFg`, `applyBg`, `wsVisible`).

### 5.4 Fields Exposed on `getInspectorState()` (JS:7389-7427)

All inspector fields listed in Section 1.9 above (except `inspectorShowGrid`, `inspectorShowChecker`).

### 5.5 Fields Available via `_state()` Escape Hatch (JS:7330)

`_state()` returns the raw `state` object. All fields are accessible but not structured, typed, or serialized. This is a diagnostic-only escape hatch.

### 5.6 Fields That NEED to Be Added to `getState()` for a Unified Verifier

These are the fields identified in M2 design (Section 1.7 of that doc) plus additional fields needed for complete SAR coverage.

**Priority 1 -- Required for M1 edge-case verifier AND M2 verifier:**

| Field | Type | Rationale |
|-------|------|-----------|
| `bundleId` | string\|null | Bundle gating verification requires knowing if bundle mode is active |
| `activeActionKey` | string | Tab-switch verification requires knowing which action is active |
| `templateSetKey` | string | Template application verification |
| `activeLayer` | int | Layer isolation verification |
| `visibleLayers` | number[] | Layer visibility verification |
| `layerCount` | int | Layer count verification (Gate B) |
| `sessionDirty` | boolean | Save/dirty state verification |
| `gridCols` | int | Geometry verification (Gate A) |
| `gridRows` | int | Geometry verification (Gate A) |

**Priority 2 -- Required for M2 verifier (source panel / assembly):**

| Field | Type | Rationale |
|-------|------|-----------|
| `sourceCutsV` | `Array<{id,x}>` | Cut verification in source panel contract |
| `sourceCanvasZoom` | number | Zoom state verification |

**Priority 3 -- Nice to have for full SAR coverage:**

| Field | Type | Rationale |
|-------|------|-----------|
| `actionStates` | structured clone | Bundle action status verification without `_state()` |
| `gridPanelZoom` | number | Grid zoom verification |
| `layerNames` | string[] | Layer name verification |
| `cellWChars` | int | Template geometry verification |
| `cellHChars` | int | Template geometry verification |
| `webbuild.actionInFlight` | boolean | Runtime mutex verification |
| `webbuild.actionLabel` | string | Runtime action label verification |
| `inspectorShowGrid` | boolean | Inspector visual mode |
| `inspectorShowChecker` | boolean | Inspector visual mode |
| `wsApplyGlyph` | boolean | Apply-mode verification |
| `wsApplyFg` | boolean | Apply-mode verification |
| `wsApplyBg` | boolean | Apply-mode verification |

### 5.7 Existing Debug API Methods (Beyond State Getters)

These methods are available on `__wb_debug` and can be used by verifiers to trigger actions or read cell data:

| Method | Purpose | Read/Write |
|--------|---------|------------|
| `readFrameCell(row, col, cx, cy)` | Read cell in frame coordinates | Read |
| `readLayerCell(layerIdx, x, y)` | Read cell on specific layer | Read |
| `readFrameRect(row, col, x1, y1, x2, y2)` | Read rectangular region | Read |
| `frameSignature(row, col)` | Hash of frame content | Read |
| `writeFrameCell(row, col, cx, cy, payload)` | Write single cell | Write |
| `setActiveLayer(layerIdx)` | Change active layer | Write |
| `focusWholeSheetFrame(row, col)` | Pan WS to frame | Write |
| `openInspector(row, col)` | Open inspector on frame | Write |
| `commitDraftSource()` | Commit draft box | Write |
| `selectSourceBoxes(ids)` | Select source boxes | Write |
| `addSourceBoxToSelectedRowById(id)` | Add source box to grid row | Write |
| `flushSave()` | Force save | Write |
| `suppressAutoSave(on)` | Suppress auto-save during replay | Write |
| `suppressRender(on)` | Suppress rendering during replay | Write |
| `testSkinDock()` | Trigger test skin path | Write |
| `openWebbuild(forceFresh)` | Open runtime preview | Write |
| `_state()` | Raw state access | Read |
| `_setCell(x, y, c)` | Direct cell mutation | Write |
| `_pushHistory()` | Push history snapshot | Write |
| `_undo()` / `_redo()` | Undo/redo | Write |
| `getUiRecorder()` | Get recorder data | Read |
| `startUiRecorder()` / `stopUiRecorder()` / `clearUiRecorder()` | Recorder lifecycle | Write |
| `downloadUiRecorder()` | Download recording | Write |

### 5.8 Methods Missing for Complete SAR Verifier

These action primitives are NOT currently exposed on `__wb_debug` and would need either direct DOM manipulation (Playwright) or new debug API methods:

| Missing Method | Needed For | Workaround |
|----------------|-----------|------------|
| `applyTemplate(key)` | T2 | Playwright: select + click |
| `switchBundleAction(key)` | T3 | Playwright: click tab button |
| `uploadPng(path)` | U1 | Playwright: set file input + click |
| `analyze()` | U2 | Playwright: click `#wbAnalyze` |
| `convertToXp()` | U3 | Playwright: click `#wbRun` |
| `newXp()` | T6 | Playwright: click `#btnNewXp` |
| `exportXp()` | T5 | Playwright: click `#btnExport` |
| `importXp(path)` | T7 | Playwright: set file input + click |
| `setSourceMode(mode)` | S1-S5 | Playwright: click mode button |
| `drawSourceBox(x, y, w, h)` | S6 | Playwright: mouse drag |
| `findSprites(threshold, minSize)` | S12 | Playwright: click `#extractBtn` |
| `setAnchor(boxId)` | S13 | Playwright: right-click + ctx menu |
| `gridSelectFrame(row, col)` | G1 | Playwright: click frame tile |
| `gridMoveRow(delta)` | G3/G4 | Playwright: click button |
| `gridAddFrame()` | G7 | Playwright: click `#addFrameBtn` |
| `gridDeleteSelected()` | G8 | Playwright: click/key |
| `jitterNudge(dx, dy)` | J1-J4 | Playwright: click button |
| `autoAlign()` | J5-J6 | Playwright: click button |
| `dragToGrid(boxes, targetRow, targetCol)` | D1 | Playwright: drag gesture |
| `openBugReport()` | B1 | Playwright: click button |
| `submitBugReport(payload)` | B2 | Playwright: fill form + click |

The M2 verifier design addresses most of these by using Playwright gestures rather than debug API methods, which is the correct approach for acceptance-eligible verification (user-reachable actions only).

### 5.9 `getBugReportMetadata()` As Ad Hoc State Snapshot

The `getBugReportMetadata()` function (JS:390-429) provides a structured state snapshot that includes many fields not in `getState()`:

- `sessionId`, `jobId`, `bundleId`, `templateSetKey`, `activeActionKey`
- `sourcePath`, `latestXpPath`
- `bundleStatus`, `wbStatus`, `webbuildState`, `wholeSheetStatus`, `uploadPanelLabel` (DOM text)
- Grid geometry (nested under `.grid`)
- Layer state (nested under `.layers`)
- Runtime state (nested under `.runtime`)
- `recentErrors` from `bugReport`

This function is currently the closest thing to a structured full-state snapshot, but it is not exposed on `__wb_debug` and is only used internally for bug report payloads.

**Recommendation**: Expose `getBugReportMetadata()` on `__wb_debug` (or extract its structured snapshot logic into a `getFullState()` method) to provide verifiers with a single-call full state snapshot without relying on `_state()`.

---

## Appendix A: Template Registry Geometry Reference

From `config/template_registry.json`:

| Action Key | Family | XP Dims | Angles | Frames | Projs | Cell W | Cell H | Layers |
|------------|--------|---------|--------|--------|-------|--------|--------|--------|
| `idle` | player | 126x80 | 8 | [1, 8] | 2 | 7 | 10 | 4 |
| `attack` | attack | 144x80 | 8 | [8] | 2 | 9 | 10 | 4 |
| `death` | plydie | 110x88 | 8 | [5] | 2 | 11 | 11 | 3 |

## Appendix B: Button Enable/Disable Gating Summary

| Button | Enabled When | Disabled When |
|--------|-------------|---------------|
| `#btnSave` | Session loaded | No session |
| `#btnExport` | Session loaded | No session |
| `#btnNewXp` | Template applied (`templateSetKey` set) | No template |
| `#wbAnalyze` | Source image uploaded | No source |
| `#wbRun` | Analyze complete | No analyze result |
| `#undoBtn` / `#wsUndoBtn` | `history.length > 0` | Empty history |
| `#redoBtn` / `#wsRedoBtn` | `future.length > 0` | Empty future |
| `#webbuildQuickTestBtn` | Session + preflight OK + not action-busy | Any precondition false |
| `#webbuildApplySkinBtn` | Session + runtime ready + preflight OK + not busy | Any false |
| `#webbuildApplyInPlaceBtn` | Session + runtime ready + preflight OK + not busy | Any false |
| `#webbuildApplyRestartBtn` | Session + preflight OK + not busy | Any false |
| `#webbuildUploadTestBtn` | Preflight OK + not busy | Preflight fail or busy |
| `#webbuildOpenBtn` | Preflight OK + not busy | Any false |
| `#webbuildReloadBtn` | Preflight OK + not busy | Any false |
| `#openInspectorBtn` | Frames selected (implicit) | No frames |
| `#rowUpBtn` / `#rowDownBtn` | Row selected | No row |
| `#colLeftBtn` / `#colRightBtn` | Cols selected | No cols |
| `#addFrameBtn` | Visual layer active | Not active |
| `#deleteCellBtn` | Frames selected | No selection |
| `#autoAlignSelectedBtn` | Frames selected | No selection |
| `#autoAlignRowBtn` | Row selected | No row |
| `#jitterLeftBtn` etc. | Frames selected | No selection |
| `#assignAnimCategoryBtn` | Row selected | No row |
| `#assignFrameGroupBtn` | Cols selected | No cols |
