# Grid Panel + REXPaint Editor Integration Analysis

> Audit status (2026-03-13): this file accurately describes the legacy XP inspector path living inside `web/workbench.js`, but it should not be read as evidence that `EditorApp` is already embedded in the live workbench on `master`.

## 1. Current Architecture Summary

### Data Model: Flat Cell Array with Virtual Frame Grid

The workbench stores ALL sprite data in a single flat array: `state.cells[]`, indexed as `y * state.gridCols + x`. This is the XP canvas — one contiguous grid of CP437 cells, each with `{glyph, fg[3], bg[3]}`.

The "frame grid" is a **virtual overlay** on this flat array. Frames are rectangular sub-regions computed from metadata:
- `state.angles` = number of rows (rotation angles)
- `state.anims` = array of animation lengths per sequence (e.g., `[1, 8]`)
- `state.projs` = projections per frame (1 or 2)
- `frameCols = sum(anims) * projs` = total frame columns
- `state.frameWChars` / `state.frameHChars` = cell dimensions of each frame

A frame at grid position `(row, col)` maps to the flat array region:
```
gx = col * frameWChars + localX
gy = row * frameHChars + localY
cellIndex = gy * gridCols + gx
```

### Multi-Layer System

The workbench has a layer stack (`state.layers[]`):
- **Layer 0**: Metadata (angles, animation frame counts encoded as CP437 glyphs)
- **Layer 1**: Height encoding (vertical position data for the 3D engine)
- **Layer 2**: Primary visual (the actual sprite art — **only editable layer**)
- **Layer 3+**: Swoosh overlays (attack trails, VFX)

`editableLayerActive()` returns true only when `state.activeLayer === 2`. All editing functions gate on this. `cellForRender()` composites visible layers for display (picks the last non-empty cell across visible layers).

---

## 2. Grid Panel Implementation

### File: `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js`

### renderFrameGrid() (line 2192)
- Clears `#gridPanel`, sets CSS grid template based on frameCols
- Iterates `angles` rows x `frameCols` columns
- Each cell rendered by `makeFrameCanvas(row, col, selected, rowSelected, groupSelected)` (line 2055)
- Row headers created by `makeFrameRowHeader(row, frameCols)` (line 2127) — these are draggable for reorder

### makeFrameCanvas() (line 2055)
- Creates a `<div class="frame-cell">` with a `<canvas>` child
- Canvas renders a thumbnail of the frame's cells using `drawHalfCell()` at a computed scale
- Adds selection classes: `selected`, `row-selected`, `group-selected`, `drop-target`
- Shows drag-drop overlay (Replace/Swap) when a frame is being dragged over

### Frame Selection Model
- `state.selectedRow` — currently selected row (angle index), or null
- `state.selectedCols` — `Set<number>` of selected frame column indices
- **selectFrame(row, col, shift)** (line 4990): Single-click sets `selectedRow + selectedCols={col}`. Shift-click extends selection range within the same row.
- **selectWholeRow(row)** (line 2158): Selects all frame columns for a row.
- Selection is always within a single row — no multi-row selection exists.

### Row Operations
- **moveRowToIndex(from, to)** (line 2170): Bubble-swaps row blocks via `swapRowBlocks()`. Swaps the actual cell data in `state.cells[]` for the full row width, plus swaps `rowCategories` and `frameGroups` metadata.
- **Row drag-and-drop** (line 5315-5357): HTML5 drag from row headers, drop triggers `moveRowToIndex()`.

### Column Operations
- **moveSelectedCols(delta)** (line 4910): Swaps column blocks left/right by calling `swapColBlocks()` for each selected column. Swaps cell data for the full column height (all rows).
- **deleteSelectedFrames()** (line 4839): Clears selected frames to transparent cells (glyph 0, bg magenta).
- **Cell drag-and-drop** (line 5152-5180): Mousedown on an already-selected cell initiates drag. Hover reveals Replace/Swap overlay. Drop calls `applyGridCellDropAction()` which does `writeFrameCellMatrix()`.

### Frame Copy/Paste (Grid Level)
- **copySelectedFrameToClipboard()** (line 5039): Reads frame cells into `state.inspectorFrameClipboard` as a 2D cell matrix.
- **pasteClipboardToSelectedFrame()** (line 5051): Writes the clipboard matrix into the selected frame position.
- Copy/paste operates on whole frames, not sub-regions.

---

## 3. Legacy Cell Inspector (Current Shipped XP Editing Path)

### Opening the Inspector
- **openInspector(row, col)** (line 2985): Sets `inspectorOpen=true`, stores `inspectorRow/Col`, unhides `#cellInspectorPanel`, calls `renderInspector()`.
- **Triggered by**: double-click on a frame tile (line 5286-5287), "Open XP Editor" button via `openInspectorForSelectedFrame()` (line 5007), or context menu via `openInspectorFromGridContextMenu()` (line 5081).

### renderInspector() (line 3017)
- Draws **one frame at a time** onto `#cellInspectorCanvas` at zoom level (4-28x).
- Iterates `frameWChars x frameHChars`, maps each to global coords `(col*frameWChars+cx, row*frameHChars+cy)`, reads cell via `cellForRender()`.
- Draws grid lines if `inspectorShowGrid` is true.
- Draws selection rectangle (dashed white) if `inspectorSelection` is set.
- Draws last-hover cursor highlight (dashed yellow).

### Coordinate System
- **Frame-local coords**: `(cx, cy)` within `0..frameWChars-1` and `0..frameHChars-1`
- **Half-cell coords**: Each cell has a "top" and "bottom" half (used for paint tool which paints half-cell colors)
- **Global coords**: `gx = col * frameWChars + cx`, `gy = row * frameHChars + cy`
- **inspectorCellFromLocal(row, col, cx, cy)** (line 2454): Converts frame-local to global, returns `{gx, gy, cell}`.
- **inspectorHalfCellAtEvent(evt)** (line 3111): Converts mouse pixel position to `{row, col, cx, cy, half}`.

### Inspector Tools (6 total)
1. **inspect**: Click a cell to read its glyph/fg/bg into the tool palette (non-destructive)
2. **select**: Drag to create a rectangular selection within the frame (frame-local coords)
3. **glyph**: Click/drag to stamp full XP cells (glyph + FG + BG) via `applyInspectorGlyphAtCell()`
4. **paint**: Click/drag to paint half-cells (top or bottom half) with `inspectorPaintColor`
5. **erase**: Click/drag to clear half-cells to transparent
6. **dropper**: Click to sample glyph + paint color from a cell

### Edit Flow (Inspector -> Grid/Session)
1. User clicks/drags on the inspector canvas
2. `inspectorHalfCellAtEvent()` converts mouse position to frame-local + half-cell coords
3. For glyph tool: `applyInspectorGlyphAtCell()` calls `setCell(gx, gy, next)` — writes directly to `state.cells[]`
4. For paint/erase: `applyInspectorToolAt()` decodes cell halves, modifies, re-encodes, calls `setCell()`
5. On mouseup: `commitInspectorStrokeIfNeeded()` calls `renderAll()` + `saveSessionState("inspector-edit")`
6. `renderAll()` re-renders both the legacy grid AND the frame grid, so grid thumbnails update immediately

### Inspector Selection (Sub-Frame)
- **Copy**: `copyInspectorSelection()` (line 2656) — reads selected rect into `inspectorSelectionClipboard` (2D cell matrix)
- **Paste**: `pasteInspectorSelection()` (line 2671) — writes clipboard matrix into selection region or at hover anchor
- **Clear**: `clearInspectorSelectionCells()` (line 2707) — fills selection with transparent cells
- Selection coords are frame-local: `{x1, y1, x2, y2}` within `0..frameWChars-1 / 0..frameHChars-1`

### Inspector Frame Navigation
- `inspectorCurrentFrameCoord()` (line 2413) returns the clamped `{row, col}` of the currently-viewed frame
- Frame changes happen via `openInspector(row, col)` — there are prev/next buttons that call it with incremented row/col
- When switching frames, any in-progress stroke is committed first

---

## 4. Interaction Model Analysis

### Click frame tile in grid -> What happens:
1. `selectFrame(row, col, shift)` sets `selectedRow=row`, `selectedCols={col}`
2. `renderFrameGrid()` re-renders all tiles with selection highlighting
3. `renderPreviewFrame(row, col)` updates the animation preview
4. Inspector remains on its current frame (no auto-navigation)

### Double-click frame tile in grid -> What happens:
1. `selectFrame(row, col, false)` selects the frame
2. `openInspector(row, col)` opens/navigates the inspector to that frame
3. Inspector renders the frame at zoom level, ready for editing

### Edit cell in inspector -> How it propagates:
1. `setCell(gx, gy, cell)` writes to `state.cells[idx]` AND `state.layers[2][idx]`
2. On stroke commit: `renderAll()` triggers full re-render including `renderFrameGrid()`
3. During drag-painting: each changed cell triggers `renderAll()` immediately (expensive but correct)
4. `saveSessionState("inspector-edit")` POSTs the entire cells array to the server

### Frame copy/paste across grid:
1. Grid-level: copies entire frame as a 2D matrix via `inspectorFrameCellMatrix()`
2. Paste writes the matrix into target frame position via `writeFrameCellMatrix()`
3. Both operations bypass the inspector entirely — they work on the flat cell array

### Row reorder effect on cell data:
1. `swapRowBlocks(r1, r2)` iterates every x in the row width, swaps cells between rows
2. This physically moves data in `state.cells[]` — not just pointer swaps
3. If inspector is open on the moved row, it still references the same (row, col) indices, which now contain different data. The inspector would need to track the row movement or re-open.

---

## 5. Design Decisions for REXPaint Editor Integration

### Decision 1: Frame-at-a-Time vs Full Canvas View

**Recommendation: Frame-at-a-time (current model) with optional multi-frame preview strip.**

Rationale:
- The current inspector already works frame-at-a-time and all coordinate math is frame-local
- A full-canvas view would require: (a) a viewport/pan/zoom system, (b) frame boundary overlays, (c) constraining edits to the active frame, (d) handling the fact that frames can be reordered/swapped while the canvas shows "stale" positions
- REXPaint's viewport/pan model maps well to the zoomed single-frame view
- A multi-frame preview strip below/beside the editor would give context without the complexity of a full canvas viewport

### Decision 2: Selection Model Ownership

**Recommendation: The editor should have its own selection model (it already does: `inspectorSelection`), independent from the grid's frame selection (`selectedRow/selectedCols`).**

Rationale:
- Grid selection = which frame(s) to operate on (bulk operations like delete, copy, move)
- Inspector selection = which cells within a frame to operate on (sub-frame copy/paste/clear)
- These are semantically different. Merging them would create confusing UX where clicking in the editor deselects grid frames.
- The connection point: grid selection determines which frame the editor shows. Double-click a grid tile -> editor navigates to that frame.

### Decision 3: How Grid Operations Interact with the Editor

**Recommendation: Grid operations should auto-commit any in-progress editor stroke, then re-render the editor if it's viewing an affected frame.**

Current behavior is partially there:
- `commitInspectorStrokeIfNeeded()` is called before certain operations
- `renderAll()` re-renders the inspector
- BUT: row reorder silently changes what the inspector shows (the inspector tracks `(row, col)` indices, not the logical angle identity)

Needed additions:
- After row reorder: if `inspectorRow` matches one of the swapped rows, update `inspectorRow` to follow the data
- After column move: same for `inspectorCol`
- After frame delete: if the inspector is viewing a deleted frame, close or re-select

### Decision 4: REXPaint Tool Integration

**Recommendation: Extend the existing inspector tool system rather than building a parallel tool system.**

The current 6 tools (inspect, select, glyph, paint, erase, dropper) already form a REXPaint-like toolkit. Integration path:
- Add more glyph-level tools: line, rectangle, fill-flood, text string
- Add a CP437 glyph palette panel (visual grid of all 256 glyphs for easy selection)
- Add a color palette panel (REXPaint uses .pal files with 16 or 256 colors)
- Keep the same edit flow: tool writes to `state.cells[]` via `setCell()`, stroke commit triggers save

### Decision 5: Undo/Redo Scope

**Recommendation: Keep the single unified undo stack (current model).**

Rationale:
- `pushHistory()` snapshots the entire state (including cells, metadata, layout)
- Both grid operations and inspector edits push to the same stack
- This means undoing a grid-level paste also undoes any inspector edits that happened after it — which is correct behavior
- A per-frame undo stack would be confusing when frames can be reordered/copied

### Decision 6: Editor-Grid Synchronization

**Recommendation: Adopt a "dirty frame" notification pattern instead of full re-render on every edit.**

Current problem: `renderAll()` is called after every inspector stroke, which rebuilds all grid thumbnails. For large atlases (8 angles x 9 frames = 72 tiles), this is expensive.

Proposed pattern:
- Inspector edits mark the specific frame `(row, col)` as dirty
- `renderFrameGrid()` only redraws dirty tile canvases, not the entire grid
- Grid operations (row swap, column move) mark all affected frames dirty

### Decision 7: Multi-Frame Editing

**Recommendation: Do NOT allow editing multiple frames simultaneously. Keep single-frame editing with batch operations at the grid level.**

Rationale:
- REXPaint edits one canvas at a time
- The grid already handles batch operations (select multiple frames -> delete/copy)
- Multi-frame simultaneous editing would require a merged coordinate space and complex conflict handling
- "Apply to all angles" operations (mirror the current frame to other rows) are better handled as explicit grid-level actions

### Decision 8: Layer Visibility in the Editor

**Recommendation: Keep the current layer compositing model (`cellForRender` composites visible layers) but show layer toggle controls within the editor panel.**

The current legacy inspector already does this — `renderInspector()` calls `cellForRender()` which respects `state.visibleLayers`. On `master` as of the 2026-03-13 audit, this statement does not apply to `EditorApp` integration because `EditorApp` is still a separate codepath.

---

## 6. Key Code Locations

| Concept | Function | Line |
|---------|----------|------|
| Flat cell array access | `cellAt(x,y)` | 1659 |
| Cell write (layer-aware) | `setCell(x,y,c)` | 1664 |
| Frame geometry computation | `recomputeFrameGeometry()` | 1647 |
| Frame-local to global coords | `inspectorCellFromLocal(row,col,cx,cy)` | 2454 |
| Mouse event to cell coords | `inspectorHalfCellAtEvent(evt)` | 3111 |
| Frame cell matrix read | `inspectorFrameCellMatrix(row,col)` | 2381 |
| Frame cell matrix write | `writeFrameCellMatrix(row,col,matrix)` | 2395 |
| Grid tile rendering | `makeFrameCanvas(row,col,...)` | 2055 |
| Grid layout rendering | `renderFrameGrid()` | 2192 |
| Inspector canvas rendering | `renderInspector()` | 3017 |
| Frame selection | `selectFrame(row,col,shift)` | 4990 |
| Row swap | `swapRowBlocks(r1,r2)` | 4851 |
| Column swap | `swapColBlocks(c1,c2)` | 4889 |
| Glyph stamp tool | `applyInspectorGlyphAtCell(hit)` | 2642 |
| Half-cell paint tool | `applyInspectorToolAt(hit)` | 3133 |
| Stroke commit & save | `commitInspectorStrokeIfNeeded()` | 3195 |
| Undo/redo | `pushHistory()` / `undo()` / `redo()` | 1607-1644 |
| Session save to server | `saveSessionState(reason)` | 3257 |
| Open inspector for frame | `openInspector(row,col)` | 2985 |

---

## 7. Risks and Constraints

1. **Performance**: `renderAll()` on every inspector edit is O(totalCells) for grid thumbnails. Large atlases (126x80 = 10,080 cells per frame, 72 frames = 725K cells) will lag.

2. **Inspector doesn't track frame identity**: If row 3 is dragged to row 1, the inspector still shows `inspectorRow=3` which now has different data. This is a latent bug.

3. **Single editable layer**: Only layer 2 is writable. A REXPaint-style editor would want multi-layer editing. This requires relaxing `editableLayerActive()` and adding per-layer `setCell` support.

4. **No viewport/pan**: The inspector canvas scales the entire frame to fit. For large frames (e.g., 18x10 chars), this works fine at 10x zoom. For very large frames, a pan/scroll viewport would be needed.

5. **History snapshots are full copies**: `snapshot()` copies all cells. For 725K cells, each undo step is ~30MB of cloned objects. This limits undo depth practically.
