# Revised Design Brief: Embedded XP Editor (Workbench-Only)

**Date:** 2026-03-04
**Constraint Change:** No standalone mode. The editor replaces `#cellInspectorPanel` inside `workbench.html`. All existing workbench panels (grid, source, bundle/template, skin test dock) are preserved.

---

## Scope Changes from Original Brief

### REMOVED (standalone-only features)
- `/rexpaint` route and standalone HTML page
- `POST /api/rexpaint/open-xp` endpoint
- `POST /api/rexpaint/save-xp` endpoint
- `GET /api/rexpaint/list-xp` endpoint
- Standalone file open/save dialogs
- File browser panel (list/rename/duplicate .xp files)
- Multi-image tabs (edit multiple files simultaneously)
- Cross-image clipboard
- New file creation dialog (canvas dimensions are set by pipeline/template, not user)
- Canvas resize dialog (dimensions locked by family contract in embedded mode)
- `mode: 'standalone'` constructor option and dual-mode API

### ADDED (workbench integration features)
- Grid panel <-> editor frame sync (grid click loads frame, editor edits write back)
- Frame navigation from within editor (prev/next angle/frame buttons, matching grid selection)
- Session save integration (edits trigger `saveSessionState()` through existing debounce path)
- Layer constraint enforcement per family (player=4 layers, plydie=3 layers, L0/L1 read-only)
- Bundle-aware context (editor knows current action tab, applies family-specific constraints)
- Dirty badge sync with existing `inspectorDirtyBadge` / `sessionDirtyBadge`
- Existing undo/redo system reuse (extend `state.history` stack, keep `undoBtn`/`redoBtn`)
- Grid panel re-render on editor save (frame tile updates when editor modifies cells)
- Animation preview panel sync (preview canvas updates from editor state)
- Keyboard shortcut scoping (editor shortcuts active only when editor panel is focused/open)

---

## Revised Feature List

### Tier 1: MVP -- Replace Broken Inspector (18 features)

| # | Feature | Rationale | LOC Est |
|---|---------|-----------|---------|
| 1 | CP437 bitmap font atlas renderer | Core requirement -- must render all 256 glyphs, not just half-cell color blocks. Load bitmap font PNG (8x8, 10x10, 12x12, 16x16 sizes). drawImage per cell with fg color tinting via canvas compositing. Background filled rect behind glyph. | 500 |
| 2 | Font size selector (interchangeable fonts) | Support multiple CP437 bitmap font sizes. Dropdown or keyboard shortcut to switch between 8x8, 10x10, 12x12, 16x16 font atlases. Each size = different zoom level with crisp pixel rendering. | 100 |
| 3 | Layer compositing with font rendering | Back-to-front compositing (reuse `cellForRender` logic) but rendered via bitmap font atlas instead of half-cell color blocks. Half-cell fast-path preserved for glyphs 219/220/223. | 200 |
| 4 | Cell draw mode (click/drag to paint cells) | Freehand single-cell painting with drag support. Replaces current glyph stamp + half-cell paint as unified tool. | 300 |
| 5 | Apply mode toggles: independent G/F/B channels | REXPaint's core power feature. Three toggle buttons control which channels (Glyph, Foreground, Background) are applied when drawing. Missing entirely from current inspector. | 150 |
| 6 | Visual CP437 glyph picker (16x16 clickable grid) | Canvas-rendered 16x16 grid showing all 256 CP437 glyphs using the active bitmap font. Click to select. Replaces current numeric `inspectorGlyphCode` + single-char `inspectorGlyphChar` inputs. | 200 |
| 7 | Color picker (HTML native + palette strip) | LMB on swatch = set FG, RMB = set BG. Expand current 12-swatch strip to 24+ slots. Keep native `<input type="color">` for precise selection. | 100 |
| 8 | Right-click eyedropper (pick glyph + fg + bg from canvas) | Click any cell on canvas to sample its full cell state (glyph + fg + bg). Current inspector has a separate dropper tool; this makes it a right-click shortcut available from any tool. | 80 |
| 9 | Rectangular selection with copy/cut/paste | Preserve existing inspector selection logic (elements 152-159). Adapt to new renderer. Paste preview at hover anchor. | 300 |
| 10 | Undo/redo (reuse existing system) | Extend existing `state.history` stack. Keep `undoBtn`/`redoBtn` wiring. Cell-level diffing for efficient storage. | 100 |
| 11 | Zoom via font size + mouse wheel | Replace `inspectorZoom` slider (4-28x) with font-size-based zoom. Mouse wheel zooms in/out. Each zoom step selects appropriate font atlas size. | 100 |
| 12 | Grid overlay toggle | Preserve existing `inspectorShowGrid` checkbox behavior. Render grid lines between cells at current zoom. | 50 |
| 13 | Layer visibility toggle + active layer switching | Preserve existing `layerSelect` dropdown and `layerVisibility` checkboxes from grid panel. Editor respects these. Only active layer is editable. | 80 |
| 14 | Transparency handling (magenta 255,0,255) | Core XP format requirement. Magenta bg = transparent, rendered as checkerboard pattern. Preserve `inspectorShowChecker` toggle. | 50 |
| 15 | In-browser XP codec (client-side read/write) | Port xp_core.py column-major binary format to JavaScript. Gzip via pako. Eliminates server round-trips for frame cell reads. Used internally by editor for frame loading. | 300 |
| 16 | Grid panel <-> editor frame sync | Grid click/double-click loads frame into editor. Editor cell edits write back to `state.cells[]`. Grid tile re-renders on save. Frame navigation buttons (prev/next angle/frame) update grid selection. This replaces elements 127-132 (navigation row). | 250 |
| 17 | Keyboard shortcuts (REXPaint conventions, scoped) | c/l/r/o/i/t for tools, g/f/b for apply toggles, z/y for undo/redo. Active ONLY when editor panel is open/focused. Existing global shortcuts (V/B/R/C/X for source modes, WASD for jitter) remain active when editor is closed. Resolves the 38-shortcut conflict identified in original brief. | 150 |
| 18 | Session save on edit | Cell edits trigger `saveSessionState()` via existing debounce. Dirty badge updates. No new API endpoints needed. | 50 |

**Tier 1 Total: 18 features, ~3,060 LOC estimated**

### Tier 2: Core -- Full Asciicker Editing Workflow (14 features)

| # | Feature | Rationale | LOC Est |
|---|---------|-----------|---------|
| 19 | Line draw tool | Bresenham's algorithm + hover preview line. Respects G/F/B apply toggles. | 150 |
| 20 | Rectangle draw tool (outline + filled) | Drag to define corners. Outline and filled modes. Respects apply toggles. | 150 |
| 21 | Fill tool (flood fill) | 4-dir/8-dir BFS. Respects G/F/B apply toggles (can flood-fill only BG color, for example). | 200 |
| 22 | Hover preview (show effect before committing) | Shadow canvas pass composited over main render. Shows what the current tool would do at cursor position. REXPaint's signature UX feature. | 300 |
| 23 | Palette system (saveable palettes, LMB=fg/RMB=bg) | Replace fixed 12-swatch strip with resizable palette panel. Save/load palette files (JSON format). LMB=fg, RMB=bg, double-click=edit in color picker. | 300 |
| 24 | HSV/RGB color picker with numeric entry | Custom picker widget replacing native `<input type="color">`. HSV wheel/square + RGB sliders + hex input. | 350 |
| 25 | Canvas pan/drag (spacebar + drag) | Viewport transform for sprites larger than editor panel. Spacebar hold activates pan mode. | 150 |
| 26 | Layer locking (prevent edits to L0/L1) | Lock state per layer. L0 (metadata) and L1 (height) are auto-locked in embedded mode. Visual lock icon in layer panel. Prevents accidental corruption of engine-contract layers. | 50 |
| 27 | Multi-layer copy depth | Copy across all visible layers (not just active layer). Paste preserves layer structure. | 100 |
| 28 | Selection transforms (rotate CW/CCW, flip H/V) | Preserve existing inspector transform logic (elements 160-163). Adapt to new selection model. | 100 |
| 29 | Find & replace (glyph + fg + bg criteria) | Preserve existing inspector find/replace panel (elements 169-184). Adapt to new UI layout. Selection and whole-frame scopes. | 150 |
| 30 | Engine constraint enforcement | Family-aware dimension validation. L0 read-only enforcement. Layer count enforcement (4 for player/attack, 3 for plydie). Prevents WASM crashes from malformed edits. Bundle-aware: reads constraints from current action tab's template spec. | 200 |
| 31 | Palette extraction from current image | Scan current frame/layer for unique colors. Auto-populate palette. Useful for matching existing sprite palettes. | 100 |
| 32 | Animation preview integration | Frame sequence playback from editor state. Sync with existing preview panel (elements 80-84). Editor edits are reflected in real-time preview. | 150 |

**Tier 2 Total: 14 features, ~2,450 LOC estimated**

### Tier 3: Nice-to-Have -- Advanced Editing (12 features)

| # | Feature | Rationale | LOC Est |
|---|---------|-----------|---------|
| 33 | Oval draw tool (outline + filled) | Shape completeness. Midpoint ellipse algorithm. | 200 |
| 34 | Text input mode (type directly onto canvas) | ASCII art authoring. Caret management, wrapping. | 250 |
| 35 | Auto-wall / auto-box drawing | Context-sensitive wall glyph selection (single/double line box-drawing characters). | 200 |
| 36 | Glyph swapping (replace all in visible layers) | Batch operation: replace all occurrences of glyph A with glyph B. | 100 |
| 37 | Palette swapping (replace all occurrences of color) | Batch color replace across visible layers. (MCP `replace_color` tool exists server-side; this is the browser-side equivalent.) | 100 |
| 38 | Layer merging (merge active down) | Composite active layer onto layer below, clear active. | 80 |
| 39 | Layer reorder (up/down) | Move layers up/down in the stack. Constrained: L0 and L1 positions are fixed in embedded mode. | 80 |
| 40 | Used glyph highlighting | Scan current layer and highlight which glyphs in the picker are actually used. | 80 |
| 41 | Rect dimension display (Ctrl+D) | Show width x height tooltip while dragging selection or drawing shapes. | 50 |
| 42 | Color swap (Alt+W, swap fg/bg) | Quick swap foreground and background colors. | 20 |
| 43 | PNG export (single frame) | Export current frame view as PNG image. Canvas-to-PNG via toDataURL. | 100 |
| 44 | .xp file drag-and-drop import | Drop .xp file onto editor to load it into current frame slot. Validates dimensions match frame geometry. | 80 |

**Tier 3 Total: 12 features, ~1,340 LOC estimated**

---

## Grand Total

| Tier | Features | Est. LOC | Calendar Time |
|------|----------|---------|---------------|
| Tier 1 (MVP) | 18 | ~3,060 | 2-3 weeks |
| Tier 2 (Core) | 14 | ~2,450 | 2 weeks |
| Tier 3 (Nice) | 12 | ~1,340 | 1-2 weeks |
| **Total** | **44** | **~6,850** | **5-7 weeks** |

Reduction from original: 52 -> 44 features, ~8,300 -> ~6,850 LOC.

---

## Existing Workbench Code: Keep vs Replace

### KEEP (no changes needed)
- **Template panel** (Section 1, elements 1-5): Template selector, bundle creation, action tabs
- **Session toolbar** (Section 2, elements 6-10): Load/Export/Undo/Redo buttons, status
- **Upload + Convert panel** (Section 3, elements 11-21): PNG upload, analyze, convert pipeline
- **Source panel** (Section 4, elements 22-42): Source image, sprite detection, bbox drawing, context menu
- **Grid panel** (Section 5, elements 43-55): Frame grid, row/column operations, context menu
- **Animation + Metadata panel** (Section 7, elements 63-79): Row categories, frame groups, jitter controls
- **XP Preview panel** (Section 8, elements 80-84): Animation preview playback
- **Session panel** (Section 9, element 85): Session JSON display
- **Skin Test Dock** (Section 10, elements 86-99): WASM preview iframe, skin injection
- **TERM++ Native panel** (Section 11, elements 100-115): Native binary launch
- **Verification panel** (Section 12, elements 116-123): Verification profiles
- **Export panel** (Section 13, elements 124-126): XP tool launch
- **All 24 HTTP API endpoints**: No changes
- **All 29 MCP tools** (workbench + xp-tool servers): No changes
- **Debug API** (`window.__wb_debug`): Keep, extend with editor methods

### REPLACE (cell inspector panel -- Section 14, elements 127-188)
The entire `#cellInspectorPanel` is replaced by the new embedded editor. Specifically:

| Current Element | Disposition |
|-----------------|-------------|
| Navigation row (127-134): dirty badge, close, prev/next angle/frame, zoom | **REPLACE** with editor's own navigation + zoom |
| Tool row (135-141): 6 tool buttons + paint color | **REPLACE** with REXPaint tool bar + G/F/B toggles |
| Glyph row (142-145): glyph code, char, FG/BG inputs | **REPLACE** with visual CP437 glyph picker + palette |
| Frame ops row (146-151): copy/paste/flip/clear frame, grid/checker | **REPLACE** with editor toolbar (same ops, new UI) |
| Selection ops row (152-159): copy/cut/paste/clear/fill/replace sel | **REPLACE** with editor selection tools |
| Transform ops row (160-164): rotate/flip sel, BG transparent | **REPLACE** with editor transform tools |
| Palette row (165): 12 swatches | **REPLACE** with full palette system |
| Info readouts (166-168): match source, hover, paste anchor | **REPLACE** with editor status bar |
| Find & Replace (169-184) | **REPLACE** with editor find/replace panel |
| Inspector canvas (187) | **REPLACE** with editor canvas (bitmap font rendering) |
| Inspector info (188) | **REPLACE** with editor status bar |

### ADAPT (workbench.js functions that wire to replaced elements)
These functions in `workbench.js` currently serve the inspector and need rewiring to the new editor:

| Function | Lines (approx) | Action |
|----------|---------------|--------|
| `openInspectorForSelectedFrame()` | Opens inspector panel | Rewire to open embedded editor |
| `closeInspector()` | Hides inspector panel | Rewire to close editor |
| `moveInspectorSelection(dr, dc)` | Navigate frames | Rewire to editor frame navigation |
| `renderInspector()` | Renders inspector canvas | **DELETE** -- replaced by editor's own render loop |
| `drawHalfCell()` | Half-cell color rendering | **KEEP** for grid/preview panels; editor uses bitmap font renderer |
| Inspector mouse handlers (mousedown/move/leave) | Tool-specific actions | **DELETE** -- replaced by editor's own event system |
| Inspector tool setters | Set active tool | **DELETE** -- replaced by editor's tool system |
| Inspector clipboard functions | Copy/cut/paste selection | **ADAPT** -- logic reused, UI rewired |
| Inspector find/replace | Find & replace cells | **ADAPT** -- logic reused, UI rewired |
| Inspector transform functions | Rotate/flip selection | **ADAPT** -- logic reused, UI rewired |
| `syncLayersFromSessionCells()` | Rebuilds 4-layer stack | **KEEP** -- editor reads from this |
| `cellForRender()` | Layer compositing | **KEEP** for grid/preview; editor uses own compositing with font rendering |
| `saveSessionState()` | Debounced session save | **KEEP** -- editor calls this on edits |

---

## Grid Panel <-> Editor Coordination Points

These are the critical sync points where the grid panel and editor must coordinate:

### Frame Selection
- **Grid -> Editor**: Double-click or "Open XP Editor" on grid frame loads that frame's cell data into the editor canvas. Editor receives `(row, col, cellData, frameW, frameH, activeLayer)`.
- **Editor -> Grid**: Editor's prev/next angle/frame buttons update `state.inspectorRow`/`state.inspectorCol` and highlight the corresponding grid cell.
- **Grid context menu**: "Open XP Editor" (element 59) wires to new editor open.

### Cell Edits
- **Editor -> Grid**: On every committed edit (mouseup after paint stroke, paste, fill, transform), editor writes changed cells back to `state.cells[]` via existing cell index math: `idx = (row * frameHChars + cy) * gridCols + (col * frameWChars + cx)`. Then calls `renderFrameTile(row, col)` to update the grid tile.
- **Editor -> Session**: Edits trigger `saveSessionState("editor-edit")` through existing debounce.

### Frame Reorder
- **Grid -> Editor**: When rows/columns are reordered via grid panel buttons (elements 43-47), if editor is open showing a frame that moved, editor must update its `(row, col)` reference. The grid panel's `moveSelectedRow()` and `moveSelectedCols()` functions must notify the editor.
- **Grid -> Editor**: When frames are deleted via grid panel, if the deleted frame is currently open in editor, editor must close or navigate to adjacent frame.

### Frame Copy/Paste (Grid-Level)
- **Grid context menu copy/paste** (elements 57-58) operates on whole frames. These are grid-panel operations, not editor operations. If editor is open showing the pasted-over frame, editor must reload its cell data.

### Layer Changes
- **Grid -> Editor**: `layerSelect` change and `layerVisibility` checkbox changes (elements 50, 54) must propagate to editor. The editor renders the same layers the grid panel shows.

### Bundle Tab Switches
- **Bundle tabs -> Editor**: When user switches action tab (idle/attack/death), the entire session state changes (different cells, different frame geometry). Editor must close or reinitialize with new action's data. The existing `switchBundleAction()` function handles session swap; editor must hook into this.

---

## Dependencies

### Required Assets
- **CP437 bitmap font atlas PNGs**: 4 sizes (8x8, 10x10, 12x12, 16x16 pixel cells). Standard CP437 layout (16 columns x 16 rows = 256 glyphs). White-on-black (or white-on-transparent for compositing). Public domain CP437 fonts are widely available.
- **pako.js**: Gzip library for client-side XP codec (~45KB minified). Or native CompressionStream for modern browsers.

### No New Server Endpoints
All existing endpoints are sufficient. The editor operates on client-side cell data and saves via existing `POST /api/workbench/save-session`.

### No New MCP Tools
The existing 12 xp-tool + 17 workbench-api MCP tools are sufficient. The browser editor handles interactive editing; Claude handles batch operations and validation via MCP.

---

## Risk Assessment (Revised for Embedded-Only)

### Reduced Risks (vs original)
- **No dual-mode complexity**: Single embedded mode eliminates the standalone/embedded state synchronization risk.
- **No new API endpoints**: Eliminates server-side scope creep.
- **No file browser**: Eliminates filesystem security considerations.
- **Smaller total LOC**: ~6,850 vs ~8,300 reduces integration bugs.

### Remaining Risks

**Risk 1: CP437 Bitmap Font Rendering (HIGH)**
Must render all 256 CP437 glyphs at multiple font sizes. This is the single biggest technical challenge. Requires font atlas loading, per-cell drawImage with fg color tinting (canvas compositing), and bg fill behind each glyph. Performance must maintain 60fps during drag-paint operations on 7x10 = 70 cell frames at 16x zoom.

**Risk 2: State Sync Between Grid and Editor (MEDIUM)**
Bidirectional sync between grid panel and editor. Race conditions when: (a) user edits in editor while grid auto-saves, (b) grid frame reorder while editor is open, (c) bundle tab switch while editor has unsaved changes. Mitigation: single source of truth in `state.cells[]`, event-driven sync, editor always reads from / writes to state.cells.

**Risk 3: Keyboard Shortcut Conflicts (MEDIUM)**
38 existing workbench shortcuts + REXPaint conventions share keys (R, C, X, V, G, etc.). Must implement modal scoping: when editor is open and focused, editor shortcuts take priority; when editor is closed, workbench global shortcuts are active. The `window keydown` handler needs a focus-check gate.

**Risk 4: XP Codec Correctness (MEDIUM)**
JavaScript XP codec must produce byte-identical output to Python codec. Column-major transposition, gzip compression, little-endian int32. Mitigation: automated round-trip tests.

**Risk 5: workbench.js Surgery (MEDIUM)**
Replacing the inspector panel requires modifying a 6,669-line monolithic file. 162 event listeners, many referencing inspector elements. Must carefully extract inspector code without breaking grid panel, source panel, or other panels. Mitigation: keep all non-inspector code intact, replace only inspector-specific functions.
