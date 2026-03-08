# Web REXPaint -- Consolidated Design Brief

**Date:** 2026-03-04
**Purpose:** Replace the broken XP editor in the workbench with a standalone-capable, web-based ASCII art editor that understands Asciicker's sprite format constraints.

---

## 1. Scope Definition

### 1A. REXPaint Features to Include (Prioritized for Asciicker Workflow)

**Must Have (directly impacts sprite creation):**
- Cell draw mode (freehand single-cell painting)
- Apply mode toggles (independent glyph/fg/bg channel editing -- REXPaint's G/F/B toggles)
- Visual CP437 glyph selection grid (clickable 16x16 grid, not numeric code entry)
- True-color RGB/HSV color picker with numeric value entry
- Palette system (LMB=foreground, RMB=background, saveable palette files)
- Copy/cut/paste rectangular regions with flip (H/V)
- Undo/redo with per-image history
- Line draw tool
- Rectangle draw tool (outline + filled)
- Fill tool (flood fill, 4-dir + 8-dir)
- Right-click eyedropper (pick glyph + colors from canvas)
- Preview on hover (show effect before committing)
- Multi-layer support with visibility toggle, active layer switching (1-9 keys)
- Layer locking (prevent edits to non-active layers)
- Canvas resize
- Canvas pan/drag (spacebar hold + drag)
- Grid overlay toggle
- Zoom via font size scaling

**Should Have (improves workflow but not blocking):**
- Oval draw tool (outline + filled)
- Text input mode (typing directly onto canvas)
- Glyph swapping (replace all occurrences)
- Palette swapping (replace all occurrences of color)
- Palette extraction from image
- Layer merging (merge active layer down)
- Layer reorder (up/down buttons)
- Used glyph highlighting
- Auto-wall / auto-box drawing (Cell mode alternate)
- Color swap (swap fg/bg, Alt-W)

**Explicitly Exclude:**
- ANSI art mode and .ans import/export
- C:DDA export format
- BBCode/XML/XPM/CSV export formats
- Custom/extended fonts beyond CP437 256-glyph set
- Custom Unicode codepoint mapping
- Custom glyph mirroring tables
- Skinnable interface themes
- Browse mode (Tab-based image browser) -- replaced by session/file management UI
- Command-line batch operations (-exportAll, -png2xp, etc.)

### 1B. Workbench-Specific Features to Preserve

**Pipeline Integration (keep as-is):**
- PNG upload and pipeline conversion (POST /api/upload, /api/run)
- Session load from pipeline job (POST /api/workbench/load-from-job)
- Session save (POST /api/workbench/save-session)
- XP export with native contract enforcement (POST /api/workbench/export-xp)
- Bundle lifecycle (create, apply-action, export-bundle, web-skin-bundle-payload)
- Template system (template_registry.json, family-specific geometry)
- Structural gate validation (G10-G12)
- AHSW override naming for WASM injection

**Skin Testing (keep as-is):**
- WASM skin test dock (iframe with Emscripten runtime)
- Preboot XP injection flow (FS.writeFile + Load + Resize)
- Runtime preflight check
- Animation preview (play/stop/FPS controls)

**Source Panel (keep, fix regressions):**
- Source image display with sprite bbox drawing
- Find Sprites auto-detection
- Row/column drag modes
- Source-to-grid insertion workflow
- Frame jitter alignment (nudge, auto-align)

**Grid Panel (keep, fix regressions):**
- Frame tile grid with angle rows x frame columns
- Row/column reorder
- Frame copy/paste/delete via context menu
- Multi-select (drag, Shift+click, Ctrl+click)
- Animation category assignment
- Frame group assignment

### 1C. What Changes: The XP Editor Replacement

The current "Cell Inspector" panel (Section 14, elements 127-189 in UI inventory) gets **replaced** by Web REXPaint. This is the core deliverable. The current inspector has:
- 7 tools (inspect, select, glyph, paint, erase, dropper) -- inadequate
- No shape drawing tools (line, rect, oval, fill)
- No independent channel toggles (G/F/B)
- No visual glyph picker
- No palette system
- No hover preview
- No canvas pan
- 12 automated test failures in the red baseline

Web REXPaint replaces all of this with a proper editor.

---

## 2. Architecture Recommendation

### 2A. Hybrid: Standalone Page + Embedded Component

**Recommended approach:** Build Web REXPaint as a self-contained ES module (`web-rexpaint.js`) that:

1. **Standalone mode** (`/rexpaint` route): Full-page editor for general ASCII art. Opens/saves .xp files directly. No pipeline integration. Suitable for open-source standalone distribution.

2. **Embedded mode** (`/workbench` route): The same module mounted inside the workbench as a replacement for `#cellInspectorPanel`. Receives frame data from the workbench grid, sends edits back. Has access to pipeline context (family, layer constraints, metadata).

**Integration contract:**
```javascript
// Standalone
const editor = new WebREXPaint(canvasContainer, { mode: 'standalone' });
editor.loadXP(arrayBuffer);  // Load .xp binary
editor.saveXP();              // Returns ArrayBuffer

// Embedded in workbench
const editor = new WebREXPaint(canvasContainer, {
  mode: 'embedded',
  constraints: { family: 'player', layers: 4, dims: [126, 80] },
  onCellEdit: (layerIdx, x, y, glyph, fg, bg) => { /* update workbench state */ },
  onSave: (layerData) => { /* trigger session save */ }
});
editor.loadFrame(frameData, { cellW: 7, cellH: 10, layer: 2 });
```

### 2B. API Integration

**Existing endpoints to reuse (no changes needed):**
- `POST /api/workbench/save-session` -- save edited cell data back to session
- `POST /api/workbench/export-xp` -- export with native contract layers
- `POST /api/workbench/web-skin-payload` -- get XP bytes for injection
- `GET /api/workbench/download-xp` -- download exported file
- All bundle endpoints (create, apply-action, export-bundle, payload)
- All pipeline endpoints (upload, analyze, run, status)

**New endpoints needed:**
- `POST /api/rexpaint/open-xp` -- load arbitrary .xp file for standalone editing (wraps xp_core read)
- `POST /api/rexpaint/save-xp` -- save edited .xp to disk (wraps xp_core write)
- `GET /api/rexpaint/list-xp` -- list available .xp files (for file browser)
- `POST /api/rexpaint/read-region` -- read a rectangular region of cells from a layer (already exists as MCP tool `read_layer_region`, just needs HTTP wrapper)

**Existing MCP tools to reuse directly (xp-tool server):**
- `read_xp_info` -- file metadata
- `read_layer_region` -- region reads for Claude feedback
- `write_cell`, `fill_rect`, `write_ascii_block` -- Claude-driven edits
- `replace_color` -- palette swap operations
- `set_metadata` -- L0 metadata writes
- `add_layer`, `shift_layer_content` -- layer management

### 2C. Claude Feedback Loop (MCP Integration)

Claude can interact with the editor via existing MCP tools:
1. **Read canvas state:** `read_layer_region(path, layer, x, y, w, h)` returns cell grid
2. **Write edits:** `write_cell`, `fill_rect`, `write_ascii_block` for programmatic editing
3. **Validate:** `validate_structural_gates(bundle_id)` to check engine constraints
4. **Inspect:** `inspect_payload(session_id)` to check export readiness

No new MCP tools needed -- the existing 12 xp-tool + 17 workbench-api tools are sufficient. The browser editor handles interactive editing; Claude handles batch operations and validation.

### 2D. File I/O Strategy

**In-browser XP codec:** Port the existing `xp_core.py` column-major binary format to JavaScript. The format is simple (gzip + fixed-width binary cells). Libraries needed:
- `pako` (or built-in CompressionStream API) for gzip inflate/deflate
- DataView for binary parsing (little-endian int32 + uint8 RGB)
- No external dependencies beyond compression

**Client-side read/write flow:**
```
Load: File input / fetch -> ArrayBuffer -> gunzip -> parse binary -> layer arrays
Save: layer arrays -> write binary (column-major) -> gzip -> ArrayBuffer -> download/POST
```

Cell size on disk: 10 bytes (4 glyph + 3 fg + 3 bg). A full player sprite (126x80, 4 layers) = 126 * 80 * 4 * 10 = 403,200 bytes uncompressed, ~40-80KB gzipped.

The browser-side codec eliminates round-trips for every edit. Saves go to server only on explicit save/export.

---

## 3. Feature Priority Matrix

### Tier 1: MVP -- Basic Editing (must have for replacing broken inspector)

| # | Feature | Rationale |
|---|---------|-----------|
| 1 | Canvas rendering with half-cell model (glyphs 219/220/223) | Core visual system -- must match existing rendering |
| 2 | Cell draw mode (click/drag to paint cells) | Most basic editing tool |
| 3 | Apply mode toggles: independent G/F/B channels | REXPaint's #1 power feature, missing from current editor |
| 4 | Visual CP437 glyph picker (16x16 clickable grid) | Replaces current numeric code entry |
| 5 | Color picker (HTML native + palette strip) | Minimum viable color selection |
| 6 | Right-click eyedropper (pick glyph + fg + bg from canvas) | Essential for efficient editing |
| 7 | Rectangular selection with copy/cut/paste | Already exists in inspector, must preserve |
| 8 | Undo/redo | Already exists, must preserve |
| 9 | Zoom (keyboard/mouse wheel) | Inspector already has zoom slider 4-28x |
| 10 | Grid overlay toggle | Inspector already has grid checkbox |
| 11 | Layer visibility toggle | Inspector already has layer checkboxes |
| 12 | Active layer switching | Inspector already has layer dropdown |
| 13 | Transparency handling (magenta 255,0,255) | Core XP format requirement |
| 14 | In-browser XP file read/write (client-side codec) | Eliminates server round-trips for every edit |
| 15 | Keyboard shortcuts matching REXPaint conventions | c/l/r/o/i/t for tools, g/f/b for apply, z/y for undo |
| 16 | Embedded mode API (loadFrame/onCellEdit integration with workbench) | Required for workbench integration |

**Tier 1: 16 features**

### Tier 2: Core -- Needed for Asciicker Workflow

| # | Feature | Rationale |
|---|---------|-----------|
| 17 | Line draw tool | Basic shape primitive, heavily used in ASCII art |
| 18 | Rectangle draw tool (outline + filled) | Basic shape primitive |
| 19 | Fill tool (flood fill) | Essential for area coloring |
| 20 | Hover preview (show effect before committing) | REXPaint's signature UX feature |
| 21 | Palette system (saveable palettes, LMB=fg/RMB=bg) | Replace fixed 12-color swatch strip |
| 22 | HSV/RGB color picker with numeric entry | Precise color control |
| 23 | Canvas pan/drag (spacebar + drag) | Essential for sprites larger than viewport |
| 24 | Canvas resize (Ctrl+R) | Needed for creating new sprites |
| 25 | Layer locking (prevent edits to L0/L1) | Safety for metadata/height layers |
| 26 | Multi-layer copy depth | Copy across visible layers |
| 27 | Selection transforms (rotate CW/CCW, flip H/V) | Already exists in inspector, must preserve |
| 28 | Find & replace (glyph + fg + bg criteria) | Already exists in inspector, must preserve |
| 29 | Standalone mode (full-page editor at /rexpaint) | Enables open-source standalone use |
| 30 | File open/save dialogs (load .xp, save .xp) | Standalone mode requirement |
| 31 | Engine constraint enforcement (family dims, layer counts, L0 metadata) | Prevent WASM crashes from malformed edits |
| 32 | New file creation (blank canvas with specified dimensions) | Replaces create_xp_file MCP tool for browser use |
| 33 | Palette extraction from current image | Useful for matching existing sprite palettes |
| 34 | Animation preview integration (frame sequence playback) | Preserve existing preview panel functionality |

**Tier 2: 18 features**

### Tier 3: Nice -- Full REXPaint Parity

| # | Feature | Rationale |
|---|---------|-----------|
| 35 | Oval draw tool (outline + filled) | Shape completeness |
| 36 | Text input mode (type directly onto canvas) | ASCII art authoring |
| 37 | Auto-wall / auto-box drawing | Dungeon map drawing |
| 38 | Glyph swapping (replace all in visible layers) | Batch glyph operations |
| 39 | Palette swapping (replace all occurrences of color) | Batch color operations |
| 40 | Layer merging (merge active down) | Layer management |
| 41 | Layer reorder (up/down) | Layer management |
| 42 | Used glyph highlighting | Asset inspection |
| 43 | Rect dimension display (Ctrl+D) | Precision drawing |
| 44 | Color swap (Alt+W, swap fg/bg) | Convenience |
| 45 | Multiple palette files (switchable) | Palette organization |
| 46 | Palette organization (sort, purge unused) | Palette management |
| 47 | File browser (list/rename/duplicate/delete .xp files) | Asset management |
| 48 | PNG export | Share art outside .xp ecosystem |
| 49 | TXT export | Plain text art output |
| 50 | .xp file import from drag-and-drop | Convenience |
| 51 | Multi-image tabs (edit multiple files simultaneously) | Productivity |
| 52 | Clipboard paste between images | Cross-image editing |

**Tier 3: 18 features**

**Total: 52 features (16 T1 + 18 T2 + 18 T3)**

---

## 4. Reuse Assessment

### 4A. Existing Code That CAN Be Reused

**Rendering engine (`drawHalfCell` in workbench.js):**
- The half-cell rendering model (glyphs 219/220/223 -> two vertical color blocks) is correct and battle-tested. Port directly to Web REXPaint's render loop.
- Layer compositing logic (`cellForRender` back-to-front stacking) is correct.
- Lines 4200-4350 of workbench.js contain the core rendering functions.

**Data models (cell structure):**
- Cell format `{glyph, fg: [r,g,b], bg: [r,g,b]}` is used everywhere. Keep identical.
- Layer array structure (4 layers, each a flat array of cells) is correct.
- Magenta transparency convention is correct.

**XP codec (xp_core.py):**
- Column-major binary format with gzip compression. Port to JavaScript.
- Two existing Python implementations (xp_core.py and xp_codec.py) serve as reference.
- Format is fully documented in REXPaint manual Appendix B.

**API endpoints:**
- All 24 HTTP API endpoints remain unchanged.
- All 47 MCP tools remain unchanged.
- The workbench JS functions that call these endpoints (`wbUpload`, `wbRun`, `loadFromJob`, `saveSessionState`, `exportXp`, `testCurrentSkinInDock`) can be reused with minimal changes.

**Inspector selection/clipboard logic:**
- Copy/cut/paste selection (lines 5200-5600 of workbench.js) can be adapted.
- Selection transform functions (rotate CW/CCW, flip H/V) are correct.
- Find & replace logic is correct.

**Keyboard shortcut framework:**
- The window keydown handler pattern is reusable, but shortcuts need remapping to REXPaint conventions.

### 4B. What MUST Be Rewritten

**Drawing tools (entire new system):**
- Current inspector has no line, rectangle, oval, or fill tools. All must be new code.
- Cell draw mode needs freehand drag support (current paint tool is half-cell only).
- Apply mode toggles (G/F/B independent channels) require new state management.
- Hover preview requires shadow rendering pass before commit.

**Glyph picker UI (new):**
- Current glyph selection is a numeric input + single character input. Replace with a 16x16 clickable CP437 grid rendered on a canvas element.
- Used glyph highlighting (scan current layer for glyph occurrences).

**Palette system (new):**
- Current editor has 12 hardcoded swatches. Replace with a proper palette panel:
  - Color slots (resizable, scrollable)
  - LMB=set fg, RMB=set bg, double-click=edit in picker
  - Save/load palette files (JSON or REXPaint .txt format)
  - Extraction from current image

**Color picker (new):**
- Current editor uses native HTML `<input type="color">`. Replace with custom HSV/RGB picker with numeric entry fields, matching REXPaint's picker UX.

**Canvas management (new):**
- Pan/drag (spacebar + mouse drag) with viewport transform.
- Zoom (font size scaling) with configurable scale factor.
- Canvas resize dialog with dimension inputs.

**Layer management UI (new):**
- Layer panel with numbered buttons, visibility eye icons, lock icons.
- Active layer highlight. Layer order arrows.
- Currently layers are display-only -- need full interactive management.

### 4C. APIs That Exist and Just Need a New Frontend

| API | Current Frontend | New Frontend Need |
|-----|-----------------|-------------------|
| `save-session` | Auto-save on every edit | Same, but from Web REXPaint edit callbacks |
| `export-xp` | "Export XP" button | Same button, same endpoint |
| `web-skin-payload` | "Test This Skin" button | Same button, same endpoint |
| `load-from-job` | "Load From Job" button | Same button, same endpoint |
| `read_layer_region` (MCP) | Not used in browser | Could power server-side reads for large files |
| `write_cell` / `fill_rect` (MCP) | Not used in browser | Claude-driven edits bypass the UI |
| `templates` / `create_bundle` | Template panel | Same panel, same endpoints |
| `runtime-preflight` | Banner check | Same banner, same endpoint |

---

## 5. Risk Assessment

### 5A. Biggest Technical Risks

**Risk 1: Half-cell rendering fidelity (HIGH)**
The current renderer treats each cell as 2 vertical color pixels. Web REXPaint must render ALL 256 CP437 glyphs visually (not just 219/220/223), because users will draw with arbitrary glyphs. This requires either:
- A CP437 bitmap font atlas rendered via canvas (preferred -- matches REXPaint)
- SVG/path-based glyph rendering (complex, fragile)
The half-cell color-only renderer is insufficient for a general ASCII art editor. This is the single biggest technical challenge.

**Risk 2: Performance at scale (MEDIUM)**
A full player sprite atlas is 126x80 = 10,080 cells across 4 layers = 40,320 cells. At 28x zoom, the canvas is 3528x4480 pixels. Canvas 2D rendering at this resolution during mouse-drag operations (painting, selection) must maintain 60fps. Mitigation: dirty-rect rendering (only redraw changed cells), offscreen layer buffers.

**Risk 3: XP codec correctness (MEDIUM)**
The JavaScript XP codec must produce byte-identical output to the Python codec for column-major cell ordering. Any divergence will crash the WASM engine. Mitigation: automated round-trip tests (Python write -> JS read -> JS write -> Python read -> compare).

**Risk 4: State synchronization in embedded mode (MEDIUM)**
When Web REXPaint is embedded in the workbench, edits must flow bidirectionally:
- Workbench grid click -> loads frame into editor
- Editor cell edit -> updates workbench session state
- Session save -> serializes editor state to server
Race conditions and stale-state bugs are likely. Mitigation: single-source-of-truth pattern with event-driven sync.

### 5B. Format Compatibility Concerns

- **Column-major ordering:** The .xp format stores cells column-major (x outer, y inner). The browser naturally works row-major. Transposition must happen on every load/save. Both Python codecs handle this correctly; the JS port must replicate.
- **Gzip compression:** Browser gzip support varies. `pako` library is mature and reliable. CompressionStream API is newer but not universally available.
- **Integer encoding:** Little-endian int32 for version, layer count, dimensions, and glyph values. DataView handles this correctly with `getInt32(offset, true)`.
- **Layer 0 metadata:** The editor must treat L0 as read-only in embedded mode (engine contract). In standalone mode, L0 is editable but user should be warned.

### 5C. Integration Challenges

- **Workbench.js is 6,669 lines of monolithic code.** Extracting the inspector and replacing it with Web REXPaint requires careful surgery on the event handler registration, state management, and rendering pipeline.
- **The workbench has 162 event listeners** and many assume the inspector panel exists. These need rewiring.
- **38 keyboard shortcuts** in the workbench conflict with REXPaint conventions (e.g., both use R, C, X, V for different functions depending on context). Modal shortcut scoping is required.
- **The workbench stores only Layer 2 cells** in session state. Web REXPaint needs to handle the full 4-layer stack in the editor but only persist L2 edits to the session.

---

## 6. Estimated Effort

### Tier 1 (MVP -- Replace Broken Inspector)

| Component | Est. Lines | Notes |
|-----------|-----------|-------|
| XP codec (JS port) | 300 | Gzip + binary parse/write, column-major transposition |
| Canvas renderer (CP437 font atlas + half-cell) | 600 | Bitmap font loading, glyph rendering, layer compositing |
| Cell draw tool + apply mode toggles | 400 | G/F/B state, cell painting with channel independence |
| CP437 glyph picker panel | 200 | 16x16 canvas grid, selection highlight, used-glyph scan |
| Color picker (palette strip + native input) | 150 | LMB/RMB assignment, swatch strip |
| Eyedropper tool | 80 | Right-click sampling |
| Selection + clipboard (copy/cut/paste) | 400 | Rectangular selection, paste preview, flip |
| Undo/redo system | 200 | Command pattern with cell-level diffing |
| Zoom + grid overlay | 150 | Scale factor, grid line rendering |
| Layer visibility/switching UI | 100 | Layer buttons, visibility toggles |
| Keyboard shortcut system | 150 | Modal scoping (editor-focused vs workbench-global) |
| Workbench integration (embedded mode API) | 300 | loadFrame, onCellEdit, session sync |
| HTML/CSS layout | 200 | Editor panel, tool bar, palette bar, glyph picker, layer panel |
| **Tier 1 Total** | **~3,200 LOC** | |

**Prerequisites:** None beyond standard web dev (no build tools required, can be vanilla JS + HTML canvas).
**Estimated calendar time:** 2-3 weeks for one developer.

### Tier 2 (Core -- Full Asciicker Workflow)

| Component | Est. Lines | Notes |
|-----------|-----------|-------|
| Line draw tool | 150 | Bresenham's algorithm + preview |
| Rectangle draw tool (outline + filled) | 150 | Drag to define corners + preview |
| Fill tool (flood fill) | 200 | 4-dir/8-dir BFS with apply mode respect |
| Hover preview system | 300 | Shadow canvas pass, composite preview |
| Palette system (save/load/edit) | 400 | Palette file format, UI panel, extraction |
| HSV/RGB picker with numeric entry | 350 | Custom picker widget, HSV<->RGB conversion |
| Canvas pan/drag | 150 | Viewport transform, spacebar mode |
| Canvas resize dialog | 100 | Dimension inputs, centered reposition |
| Layer locking | 50 | Lock state per layer, edit guard |
| Multi-layer copy | 100 | Copy depth across visible layers |
| Standalone mode (file management) | 300 | Open/save dialogs, /rexpaint route, new file |
| Engine constraint enforcement | 200 | Family dims validation, L0 read-only in embedded mode |
| Animation preview integration | 150 | Frame sequence playback from editor state |
| HTTP endpoint wrappers (3-4 new endpoints) | 100 | open-xp, save-xp, list-xp routes |
| **Tier 2 Total** | **~2,700 LOC** | |

**Prerequisites:** Tier 1 complete.
**Estimated calendar time:** 2 weeks for one developer.

### Tier 3 (Nice -- Full REXPaint Parity)

| Component | Est. Lines | Notes |
|-----------|-----------|-------|
| Oval draw tool | 200 | Midpoint ellipse algorithm |
| Text input mode | 250 | Caret management, text history, multi-line |
| Auto-wall/auto-box | 200 | Context-sensitive wall glyph selection |
| Glyph/palette swapping | 200 | Batch operations across layers |
| Layer merge + reorder | 150 | Merge down, order arrows |
| Used glyph highlighting | 80 | Scan + overlay |
| Rect dimension display | 50 | Tooltip during drag |
| File browser panel | 400 | Directory listing, rename, duplicate, delete |
| PNG/TXT export | 300 | Canvas-to-PNG, cell-to-text conversion |
| Multi-image tabs | 400 | Tab bar, per-image state isolation |
| Drag-and-drop import | 80 | File drop handler |
| Cross-image clipboard | 100 | Shared clipboard across tabs |
| **Tier 3 Total** | **~2,400 LOC** | |

**Prerequisites:** Tiers 1 and 2 complete.
**Estimated calendar time:** 2 weeks for one developer.

### Grand Total

| Tier | Features | Est. LOC | Calendar Time |
|------|----------|---------|---------------|
| Tier 1 (MVP) | 16 | ~3,200 | 2-3 weeks |
| Tier 2 (Core) | 18 | ~2,700 | 2 weeks |
| Tier 3 (Nice) | 18 | ~2,400 | 2 weeks |
| **Total** | **52** | **~8,300** | **6-7 weeks** |

### Dependencies

- **CP437 bitmap font atlas:** Need a 16x16 glyph PNG (standard CP437 layout). Multiple sizes (8x8, 10x10, 12x12, 16x16) for zoom levels. Public domain CP437 fonts are widely available.
- **pako.js:** Gzip compression/decompression library (~45KB minified). Or use native CompressionStream if targeting modern browsers only.
- **No framework dependency:** Vanilla JS + Canvas 2D. No React/Vue/Svelte required. Keeps the build simple and matches the existing workbench's no-build-step approach.

### Key Technical Decision: Font Rendering

The biggest architectural decision is how to render CP437 glyphs:

**Option A: Bitmap font atlas (recommended)**
Load a CP437 font PNG, slice into 256 glyph tiles. For each cell, `drawImage` the glyph tile with fg color tinting (canvas globalCompositeOperation or pre-colored font atlas per used color). Background is a filled rect behind the glyph.

**Option B: Half-cell color blocks only (current approach)**
Keep the current renderer that only handles glyphs 219/220/223 as color blocks. Non-block glyphs render as full-block fg color. This is simpler but means the editor cannot display text, lines, or decorative glyphs.

**Recommendation:** Option A for standalone mode, with Option B as a fast-path for the embedded workbench mode where sprites only use half-cell encoding. The renderer should support both modes via a configuration flag.

---

## Appendix: Current Inspector Features to Preserve

These features from the existing Cell Inspector (Section 14 of UI inventory) must be preserved in Web REXPaint's embedded mode:

| Feature | Current Element | Web REXPaint Equivalent |
|---------|----------------|------------------------|
| Frame navigation (prev/next angle/frame) | inspectorPrevAngle/NextAngle/PrevFrame/NextFrame | Grid navigation controls |
| Zoom slider (4-28x) | inspectorZoom | Zoom via mouse wheel + keyboard |
| 7 tools (inspect/select/glyph/paint/erase/dropper) | inspectorTool* buttons | Replaced by REXPaint tool set |
| Glyph code + char input | inspectorGlyphCode/Char | Visual glyph picker replaces this |
| FG/BG color inputs | inspectorGlyphFgColor/BgColor | Palette + color picker replaces this |
| Frame ops (copy/paste/flip/clear) | inspectorCopy/Paste/Flip/ClearFrame | Same ops in new UI |
| Selection ops (copy/cut/paste/clear/fill/select-all) | inspectorCopy/Cut/Paste/Clear/FillSel | Same ops in new UI |
| Replace FG/BG | inspectorReplaceFg/BgBtn | Find & replace panel |
| Selection transforms (rotate/flip) | inspectorRotate/FlipSel | Same ops in new UI |
| Find & Replace panel | inspectorFindReplace* | Enhanced find & replace |
| Grid/checker toggles | inspectorShowGrid/Checker | Grid overlay toggle |
| Palette swatches (12 colors) | inspectorPaletteSwatches | Full palette system |
| Dirty badge | inspectorDirtyBadge | Same concept |
| Hover readout | inspectorHoverReadout | Status bar with cell info |
| Paste anchor readout | inspectorPasteAnchorReadout | Status bar |
| Match source info | inspectorMatchSourceInfo | Status bar |

All 38 inspector keyboard shortcuts (Section 15 of UI inventory) need equivalent mappings in Web REXPaint, remapped to REXPaint conventions where they differ.
