# Asciicker Pipeline V2 — Workbench Architecture Analysis

## 1. Workbench Session Model

### Session State (`web/workbench.js` state object)

The workbench maintains a rich client-side state object with these key components:

**Core Grid Data:**
- `cells`: Flat array of cell objects `{idx, glyph, fg: [r,g,b], bg: [r,g,b]}` — this is the **visual layer (Layer 2)** data only
- `gridCols`, `gridRows`: Total XP dimensions in character cells
- `layers`: Array of 4 layer arrays (built client-side from session cells): `[L0_metadata, L1_blank, L2_visual, L3_blank]`
- `activeLayer`: Currently editable layer (only Layer 2 is editable)
- `visibleLayers`: Set of layer indices to composite for rendering

**Frame/Animation Geometry:**
- `angles`: Number of rotation angles (rows in the sprite atlas, e.g. 8 for octagonal)
- `anims`: Array of frame counts per animation sequence (e.g. `[1, 8]` = 1 idle + 8 attack)
- `projs`: Number of projection variants (1 = mono, 2 = stereo mirror)
- `frameWChars`, `frameHChars`: Dimensions of a single frame in character cells
- Frame grid layout: `rows = angles`, `cols = sum(anims) * projs`

**Cell Structure:**
Each cell has: `glyph` (CP437 code 0-255), `fg` ([R,G,B]), `bg` ([R,G,B]).

The workbench uses a **half-cell rendering model** where each character cell maps to 2 vertical pixels via specific CP437 block glyphs:
- Glyph 219 (full block): both halves = fg color
- Glyph 223 (upper half block): top = fg, bottom = bg
- Glyph 220 (lower half block): top = bg, bottom = fg
- Glyph 0/32: both halves = bg color (transparent if magenta)

**Transparency:**
- Magenta `(255, 0, 255)` bg = transparent (skipped during rendering)
- Glyph 0 = structural null/transparent cell

### Layer Architecture

The workbench reconstructs 4 layers client-side via `syncLayersFromSessionCells()`:

| Layer | Name | Purpose | Editable |
|-------|------|---------|----------|
| 0 | Metadata | Animation metadata (angles, frame counts) encoded as ASCII digit glyphs | No |
| 1 | Layer 1 | Height encoding (row-based countdown pattern for C++ engine) | No |
| 2 | Visual | Primary sprite appearance — the actual pixel art | **Yes** |
| 3 | Layer 3 | Swoosh/VFX overlay (blank in workbench, layers 3+ used for attack trails) | No |

Only the visual layer (2) is editable in the workbench UI. Layers 0 and 1 are auto-generated during export.

### Session Persistence

Sessions are persisted server-side as JSON files at `data/sessions/{session_id}.json` containing:
- `session_id`, `job_id`, `angles`, `anims`, `projs`, `grid_cols`, `grid_rows`
- `cell_w`, `cell_h` (character dimensions per frame)
- `cells` array (visual layer data)
- `family` (player, attack, plydie)
- Source panel state: `source_boxes`, `source_anchor_box`, `source_cuts_v`, etc.
- `row_categories`, `frame_groups` (animation organization metadata)

The save endpoint (`POST /api/workbench/save-session`) receives the full cell array + metadata and writes to disk.

### Bundle Model (Multi-Action Skins)

For full player skins (idle + attack + death), the workbench supports **bundles**:

- `BundleSession`: Groups multiple action sessions under one template set
- `BundleActionState`: Per-action state (session_id, job_id, source_path, status)
- Template sets define per-action geometry (dims, angles, frames, L0 reference XPs)
- Actions: `idle` (player family), `attack` (attack family), `death` (plydie family)

Template sets available:
- `player_native_idle_only`: Single idle XP
- `player_native_full`: Full bundle (idle + attack + death)

---

## 2. XP File Flow: Pipeline -> Workbench -> Game Engine

### Stage 1: PNG Upload + Pipeline Conversion

```
PNG sprite sheet
    |
    v
POST /api/upload  -->  saves to data/uploads/
    |
    v
POST /api/run  -->  RunConfig (angles, frames, render_resolution, native_compat)
    |
    v
service.run_pipeline()
    |-- Image analysis (frame detection, background estimation)
    |-- Per-cell rendering (pixels -> CP437 glyphs via half-cell encoding)
    |-- Native contract enforcement (126x80 for player, family-specific dims)
    |-- Layer assembly via _build_native_layers()
    |       L0: metadata (angles/frame counts as ASCII digit glyphs)
    |       L1: height encoding (9->0 countdown per 10-row block)
    |       L2: visual (the rendered sprite art)
    |       L3: swoosh overlay (empty)
    |-- write_xp() -> gzip-compressed .xp file
    v
data/jobs/{job_id}/output.xp
```

### Stage 2: Workbench Session Loading

```
POST /api/workbench/load-from-job  {job_id}
    |
    v
service.workbench_load_from_job()
    |-- read_xp() parses the .xp binary
    |-- Extracts visual layer (Layer 2) cells
    |-- Creates WorkbenchSession with metadata from job
    |-- Saves session JSON to data/sessions/
    v
Returns: session_id + cells + metadata -> JS client
    |
    v
JS: state.cells = cells
JS: syncLayersFromSessionCells() rebuilds 4-layer stack
JS: renderAll() draws frame grid, preview, inspector
```

### Stage 3: Workbench Editing

User edits happen only on Layer 2 (visual). The workbench offers:
- **Half-cell paint/erase**: Works at sub-cell granularity (top/bottom halves)
- **Glyph stamping**: Direct CP437 glyph + fg/bg placement
- **Frame operations**: Copy/paste/flip/rotate frames, jitter alignment
- **Find & Replace**: Match/replace glyph + fg + bg combinations
- **Selection operations**: Rectangular selection with copy/cut/paste

All edits update `state.cells[]` and trigger `saveSessionState()` -> `POST /api/workbench/save-session`.

### Stage 4: Export to XP

```
POST /api/workbench/export-xp  {session_id}
    |
    v
service.workbench_export_xp()
    |-- Loads session JSON
    |-- Calls _build_native_layers() with family dispatch:
    |       player: _build_native_player_layers() -> 4 layers
    |       attack: _build_native_attack_layers() -> 4 layers (L0 from reference XP)
    |       plydie: _build_native_death_layers()  -> 3 layers (L0 from reference XP)
    |-- write_xp() -> data/exports/session-{id}.xp
    v
Exported .xp file ready for game engine
```

### Stage 5: Skin Test Dock (WASM Injection)

```
"Test This Skin" button
    |
    v
Save session -> Export XP -> POST /api/workbench/web-skin-payload
    |
    v
Returns: { xp_b64, override_names: ["player-0000.xp", ...] }
    |
    v
JS: injectXpBytesIntoWebbuild()
    |-- Creates /sprites/ directory in Emscripten FS
    |-- Writes XP bytes to each override filename (AHSW ternary naming)
    |-- Calls Load("player") + Resize(null) on WASM runtime
    |-- Auto-newgame pulses from bootstrap handle menu advance
    v
Live preview in iframe (solo mode flat arena)
```

**Override Naming (AHSW Ternary):**
Pattern: `{family}-{A}{H}{S}{W}.xp` where A,H,S are in {0,1} and W is in {0,1,2}
- This produces 16 variants per family (2^3 * 2 for W=0,1 + special cases)
- Plus `player-nude.xp` as the base skin
- Families: player, attack, plydie, wolfie, wolack

**Bundle Injection:**
For multi-action bundles, `injectBundleIntoWebbuild()` iterates over each action's payload, writing family-specific override files, then calls Load() once.

---

## 3. API Surface

### HTTP REST Endpoints (Flask app, port 5071)

**Pipeline:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload` | Upload PNG sprite sheet |
| POST | `/api/analyze` | Analyze image for auto-detection |
| POST | `/api/run` | Run conversion pipeline |
| GET | `/api/status/{job_id}` | Poll job status |

**Classic Session:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/workbench/load-from-job` | Create session from pipeline job |
| POST | `/api/workbench/save-session` | Save session edits |
| POST | `/api/workbench/export-xp` | Export session as .xp file |
| GET | `/api/workbench/download-xp` | Download exported .xp |
| POST | `/api/workbench/web-skin-payload` | Get base64 XP + override names for WASM injection |

**Bundle Lifecycle:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/workbench/templates` | List template sets + enabled families |
| POST | `/api/workbench/bundle/create` | Create bundle from template |
| POST | `/api/workbench/action-grid/apply` | Run pipeline for one bundle action |
| POST | `/api/workbench/export-bundle` | Export all actions as .xp files with gate validation |
| POST | `/api/workbench/web-skin-bundle-payload` | Get bundle payload for WASM injection |

**Verification/Testing:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/workbench/runtime-preflight` | Check WASM runtime health |
| POST | `/api/workbench/xp-tool-command` | Generate XP tool launch command |
| POST | `/api/workbench/open-in-xp-tool` | Launch desktop XP tool |
| POST | `/api/workbench/verify` | Run verification profile |
| POST | `/api/workbench/termpp-skin-command` | Generate TERM++ skin launch command |
| POST | `/api/workbench/open-termpp-skin` | Launch native TERM++ with skin |

**Static Asset Serving:**
| Path | Content |
|------|---------|
| `/workbench` | Workbench HTML page |
| `/termpp-web-flat/*` | WASM runtime (Emscripten build) |
| `/*` | Web assets (JS, CSS) |

### MCP Tool APIs

**Workbench MCP Server** (`scripts/workbench_mcp_server.py`):
16 tools wrapping the REST API — `server_status`, `upload_png`, `run_pipeline`, `get_job_status`, `load_session`, `save_session`, `export_xp`, `get_skin_payload`, `get_templates`, `create_bundle`, `apply_action_grid`, `get_bundle_payload`, `export_bundle`, `check_runtime_preflight`, `validate_structural_gates`, `validate_override_names`, `inspect_payload`.

**XP Tool MCP Server** (`scripts/xp_mcp_server.py`):
12 tools for direct .xp file manipulation — `read_xp_info`, `create_xp_file`, `add_layer`, `write_cell`, `fill_rect`, `read_layer_region`, `set_metadata`, `replace_color`, `resize_xp_file`, `write_ascii_block`, `shift_layer_content`, `write_text`.

The XP Tool MCP server operates directly on .xp files via `xp_core.XPFile`/`XPLayer`, with a TCP notification channel (port 9877) to push reload events to the desktop XP viewer.

---

## 4. XP File Format Details

### Binary Format

```
gzip-compressed:
  version: int32 (always -1)
  layer_count: uint32
  for each layer:
    width: int32
    height: int32
    for x in 0..width:          # COLUMN-MAJOR order
      for y in 0..height:
        glyph: uint32           # CP437 code point (0-255 used)
        fg_r, fg_g, fg_b: uint8 # Foreground RGB
        bg_r, bg_g, bg_b: uint8 # Background RGB
```

Cell size on disk: 10 bytes (4 glyph + 3 fg + 3 bg).
Storage order: **column-major** (x outer, y inner) for REXPaint compatibility.
In-memory: **row-major** (data[y][x]) for Python convenience — transposition happens in load/save.

### Two XP Codec Implementations

1. **`scripts/rex_mcp/xp_core.py`** (XPFile/XPLayer classes): Used by the XP MCP server. Full-featured with validation, metadata extraction, column-major I/O.

2. **`src/pipeline_v2/xp_codec.py`** (write_xp/read_xp functions): Simpler functional implementation used by the pipeline service. Same binary format, uses flat cell arrays instead of 2D grids.

Both produce identical binary output. The pipeline codec uses flat arrays (`layer[y * width + x]`), while xp_core uses 2D arrays (`layer.data[y][x]`).

### Native Contract Differences

**REXPaint Native XP (e.g. player-0100.xp):**
- Dimensions: 126 cols x 80 rows (player/attack), different for plydie
- 4 layers: L0 (metadata with dense border art), L1 (height encoding), L2 (visual), L3 (swoosh)
- L0 row 0 metadata: `'8','1','8'` = 8 angles, [1, 8] anims
- L0 bg: yellow `(255, 255, 85)` with space-fill
- L1: 9-to-0 countdown pattern repeating every 10 rows (NATIVE_CELL_H=10)
- Death (plydie): only 3 layers (no swoosh), cell_h=11

**Pipeline-Generated XP:**
- Same binary format, same dimensions enforced via `_assert_native_contract_dims()`
- L0 built by `_build_native_l0_layer()` to match native pattern exactly
- L1 built by `_build_native_l1_layer()` with same countdown pattern
- For attack/plydie: L0 copied from reference XP files (`_assert_l0_reference_available()`)
- L2: pipeline-rendered visual from PNG source
- L3: empty transparent cells

**Key Format Differences:**
- No structural format differences — pipeline XP is designed to be binary-compatible with native XP
- The pipeline enforces native contract dimensions at export time via `_assert_native_contract_dims()`
- L0 metadata cells match the native glyph pattern character-for-character
- L1 height encoding uses the same 9->0 countdown cycle

**Potential Divergence Points:**
- L0 for attack/plydie uses reference XP files (dense border art) — if reference files are missing, export fails
- Swoosh layer (L3) is always empty in pipeline output but may have content in hand-authored native XPs
- The pipeline's L0 metadata template is hard-coded for player family; attack/plydie use full L0 copies from reference files

---

## 5. Rendering Pipeline (Canvas Drawing)

### Frame Grid Rendering (`renderFrameGrid`)

Each frame is rendered as a small canvas tile in a CSS grid:
1. Grid layout: `angles` rows x `(sum(anims) * projs)` columns
2. Each tile canvas: `frameWChars * scale` x `frameHChars * 2 * scale` pixels
3. Per cell: calls `drawHalfCell()` which maps CP437 glyphs to two colored rectangles

### Half-Cell Rendering (`drawHalfCell`)

The core rendering function treats each character cell as **two vertical pixels**:

```javascript
function drawHalfCell(ctx, px, py, scale, glyph, fg, bg) {
  // Each cell = 2 rows of scale x scale colored rectangles
  // Glyph determines how fg/bg map to top/bottom halves:
  //   219 (full block):  top=fg, bottom=fg
  //   223 (upper half):  top=fg, bottom=bg
  //   220 (lower half):  top=bg, bottom=fg
  //   0/32 (empty):      top=bg, bottom=bg
  //   other:             top=fg, bottom=fg (treated as full)
  // Magenta bg = transparent (not drawn)
}
```

This is NOT rendering actual CP437 glyphs as text — it's a **color-only** pixel rendering system. Each cell contributes 2 vertical pixels of color. The "character" is just a control code that determines the color split.

### Inspector/Editor Rendering (`renderInspector`)

Same `drawHalfCell` approach at higher zoom (4x-28x), with overlays:
- Grid lines
- Selection rectangle (dashed white outline)
- Hover highlight
- Paste anchor indicator

### Preview Animation (`renderPreviewFrame`)

Renders a single frame at a time into a 256x256 canvas with auto-scaling, using the same `drawHalfCell` for each cell in the frame window.

### Layer Compositing (`cellForRender`)

```javascript
function cellForRender(x, y) {
  let out = transparentCell(idx);
  for (let l = 0; l < state.layers.length; l++) {
    if (!state.visibleLayers.has(l)) continue;
    const c = layerCellAt(l, x, y);
    if (Number(c.glyph || 0) > 32) out = c;  // Non-empty cell overwrites
  }
  return out;
}
```

Simple back-to-front compositing: later visible layers with non-empty glyphs (> 32) overwrite earlier ones. No alpha blending — it's a purely opaque stacking model.

---

## 6. Structural Validation Gates

| Gate | Check | Applied To |
|------|-------|-----------|
| G7 | Cell count matches expected geometry | Pipeline output |
| G8 | Minimum non-empty cell ratio (5%) | Pipeline output |
| G9 | At least 1 populated cell | Pipeline output |
| G10 | XP dimensions match template spec | Bundle export |
| G11 | Layer count matches expected (3 for death, 4 for player/attack) | Bundle export |
| G12 | L0 row-0 metadata glyphs match family pattern | Bundle export |

Gates G10-G12 run during `export_bundle()` and `get_bundle_payload()`. They validate that the exported XP matches the native contract expected by the C++ engine.

---

## 7. Key File Locations

| File | Purpose |
|------|---------|
| `web/workbench.js` | Client-side workbench logic (~6000+ lines) |
| `web/workbench.html` | UI structure |
| `src/pipeline_v2/app.py` | Flask HTTP server |
| `src/pipeline_v2/service.py` | Core business logic |
| `src/pipeline_v2/xp_codec.py` | XP file read/write (functional) |
| `src/pipeline_v2/renderer.py` | Preview PNG rendering |
| `src/pipeline_v2/gates.py` | Structural validation gates |
| `src/pipeline_v2/models.py` | Data models (RunConfig, WorkbenchSession, BundleSession) |
| `src/pipeline_v2/config.py` | Directory paths, enabled families |
| `scripts/xp_mcp_server.py` | MCP server for .xp file operations |
| `scripts/workbench_mcp_server.py` | MCP server wrapping REST API |
| `scripts/rex_mcp/xp_core.py` | XPFile/XPLayer classes (vendored) |
| `web/termpp_flat_map_bootstrap.js` | WASM runtime bootstrap (auto-newgame, solo mode) |
