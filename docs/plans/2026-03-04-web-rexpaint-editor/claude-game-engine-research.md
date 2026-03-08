# Asciicker Game Engine Sprite System — Research Analysis

## 1. Game Engine Sprite System

### .xp File Format (REXPaint Binary)
Source: `docs/REXPAINT_MANUAL.txt` Appendix B

Files are gzip-compressed binary:
- 32-bit version number
- 32-bit layer count
- Per layer: 32-bit width, 32-bit height, then cell data in **column-major** order
- Per cell: 32-bit glyph (CP437), 3x8-bit fg RGB, 3x8-bit bg RGB
- Transparent cells identified by bg color `(255, 0, 255)` (magenta)

### How Sprites Are Loaded/Injected

**File:** `/Users/r/Downloads/asciicker-pipeline-v2/web/termpp_flat_map_bootstrap.js`

The game is a C++ engine compiled to WASM via Emscripten. The bootstrap JavaScript wraps the engine's exported C functions:

1. **`Load(playerName)`** — C function exported via Emscripten `cwrap`. Loads all sprite .xp files for the named player (e.g., "player") from the `/sprites/` directory in the Emscripten virtual filesystem. The engine scans for files matching patterns like `player-0100.xp`, `attack-0001.xp`, `plydie-0000.xp`.

2. **`Resize(null)`** — C function that triggers the engine to recalculate rendering dimensions after sprite data changes. Called immediately after `Load()`.

3. **Injection flow** (from `web/workbench.js` lines 859-898):
   ```
   FS.writeFile("/sprites/{name}", xpBytes)  →  Load("player")  →  Resize(null)
   ```
   Every override filename receives the same XP bytes. The engine reads them as if they were native game files.

### AHSW Naming Convention

**File:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py` lines 2345-2368

AHSW = **A**rmor / **H**elmet / **S**hield / **W**eapon — encodes equipment visibility state:
- A ∈ {0, 1} (binary: armor off/on)
- H ∈ {0, 1} (binary: helmet off/on)
- S ∈ {0, 1} (binary: shield off/on)
- W ∈ {0, 1, 2} (**ternary**: no weapon / weapon 1 / weapon 2)

Filename pattern: `{family}-{A}{H}{S}{W}.xp`
- Player idle: `player-0000.xp` through `player-1112.xp` (24 combinations + `player-nude.xp`)
- Attack: `attack-{AHSW}.xp` with W >= 1 only (16 combinations)
- Death: `plydie-{AHSW}.xp` (24 combinations)

In practice, during workbench skin testing, all 24+ override filenames receive the **same** XP bytes — the engine sees a uniform appearance regardless of equipment state. Production skins would need per-AHSW variation.

### Runtime Structure

**Path:** `/Users/r/Downloads/asciicker-pipeline-v2/runtime/termpp-skin-lab-static/`

Contains `termpp-web-flat/` — the Emscripten WASM build. Required files:
- `index.html`, `index.js`, `index.wasm`, `index.data` (Emscripten core)
- `flat_map_bootstrap.js` (the bootstrap script)
- At least one `.a3d` map file

The `index.data` file is Emscripten's pre-packaged filesystem, which includes default sprites under `/sprites/`. The injection process **overwrites** these files at runtime via `FS.writeFile`.

---

## 2. How The Game Renders Sprites

### Sprite Grid Layout

Each .xp sprite file is a 2D grid atlas containing multiple animation frames at multiple viewing angles. The grid is organized as:

| | Frame 0 (Proj 0) | Frame 1 (Proj 0) | ... | Frame 0 (Proj 1) | Frame 1 (Proj 1) | ... |
|---|---|---|---|---|---|---|
| Angle 0 | cell | cell | | cell | cell | |
| Angle 1 | cell | cell | | cell | cell | |
| ... | | | | | | |
| Angle 7 | cell | cell | | cell | cell | |

- **Rows** = angles × cell_h (8 angles × 10 rows = 80 total rows for player)
- **Columns** = total_frames × projs × cell_w

Where:
- `projs` = source projections (2 for stereo — left/right eye parallax)
- `total_frames` = sum of all animation sequence lengths

### Reference XP Dimensions (from read_xp_info)

| Family | Dims (WxH) | Layers | Angles | Projs | Anims | Cell Size |
|--------|-----------|--------|--------|-------|-------|-----------|
| player | 126×80 | 4 | 8 | 2 | [1, 8] | 7×10 |
| attack | 144×80 | 4 | 8 | 2 | [8] | 9×10 |
| plydie | 110×88 | 3 | 8 | 2 | [5] | 11×11 |

Verification: player = (1+8) frames × 2 projs × 7 cell_w = 126 cols, 8 angles × 10 cell_h = 80 rows. Checks out.

### Half-Cell Encoding (Glyph → Visual Pixels)

**File:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py` lines 1476-1514

Each character cell in the .xp file represents a small patch of the source image. The pipeline uses CP437 block glyphs to achieve sub-cell vertical resolution (effectively 2x vertical pixel density):

| Glyph | CP437 | Meaning | fg = | bg = |
|-------|-------|---------|------|------|
| 219 (█) | Full block | Both halves same color | average color | (0,0,0) |
| 223 (▀) | Upper half block | Top/bottom different colors | top color | bottom color |
| 220 (▄) | Lower half block | Only bottom visible | bottom color | magenta (transparent) |
| 223 (▀) | Upper half block | Only top visible | top color | magenta (transparent) |

The pipeline splits each pixel patch vertically in half, computes average color for top and bottom regions, then picks the appropriate glyph. If both halves are within RGB distance < 20, it uses full block (219). This means each character cell encodes **two** vertical pixel rows.

### Layer Structure

| Layer | Purpose | Content |
|-------|---------|---------|
| L0 (Metadata) | Engine configuration | Glyph-encoded metadata: angles, animation counts, projection count. Yellow bg (255,255,85), black fg. |
| L1 (Height) | Vertical position | 9→0 countdown repeating every 10 rows. White bg, black fg. Used for parallax/depth. |
| L2 (Visual) | Primary sprite art | The actual sprite appearance using half-cell encoding. Transparent cells use magenta bg. |
| L3 (Swoosh) | Attack overlay VFX | Swoosh/trail effects for attack animations. Only present on player (4 layers) and attack (4 layers). Death uses 3 layers (no swoosh). |

### L0 Metadata Format

**File:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py` lines 1193-1212

L0 row 0 encodes the sprite atlas layout using ASCII digit glyphs:
- Cell (0,0): number of angles ('8' = 8 angles)
- Cell (0,1): first animation frame count ('1' = 1 frame for idle)
- Cell (0,2): second animation frame count ('8' = 8 frames for walk)

Additional metadata rows:
- Row 1: '2','4' (source projections and unknown)
- Row 2: '1','F' (unknown, possibly render flags)

Values > 9 use hex-style encoding: 'A'=10, 'B'=11, ..., 'F'=15.

Per-family L0 col-0 patterns (from `_FAMILY_L0_COL0`):
- player: `["8", "1", "8"]` (8 angles, 1 idle frame, 8 walk frames)
- attack: `["8", "8"]` (8 angles, 8 attack frames)
- plydie: `["8", "5"]` (8 angles, 5 death frames)

---

## 3. Asset Creation Workflow Today

### End-to-End: PNG to In-Game

**Automated path (via workbench web UI):**

1. User opens workbench at `http://127.0.0.1:5071/workbench`
2. User uploads a PNG sprite sheet (drag/drop or file picker)
3. Pipeline auto-detects grid layout (angles, frames, projections)
4. Pipeline converts PNG → XP via half-cell encoding
5. Pipeline writes L0 metadata, L1 height map, L2 visual, L3 swoosh (if applicable)
6. Workbench shows XP cell grid preview
7. User clicks "Apply to runtime" → XP injected into WASM iframe
8. User sees character in flat arena with their custom skin

**Semi-automated path (via MCP tools + CLI):**

1. Upload PNG: `upload_png(file_path)` → source_path
2. Run pipeline: `run_pipeline(source_path, name, angles, frames, ...)` → job_id
3. Poll: `get_job_status(job_id)` → completed
4. Load session: `load_session(job_id)` → session_id
5. Export: `export_xp(session_id)` → xp_path
6. Copy .xp files to game's `/sprites/` directory

**Bundle workflow (multi-action):**

1. `create_bundle("player_native_full")` → bundle_id
2. Upload idle PNG → `apply_action_grid(bundle_id, "idle", source_path)`
3. Upload attack PNG → `apply_action_grid(bundle_id, "attack", source_path)`
4. Upload death PNG → `apply_action_grid(bundle_id, "death", source_path)`
5. Validate: `validate_structural_gates(bundle_id)` → G10/G11/G12 pass/fail
6. Export: `export_bundle(bundle_id)` → per-action .xp files
7. Preview: `get_bundle_payload(bundle_id)` → inject into WASM

### Manual Steps vs Automated

| Step | Manual? | Automated? |
|------|---------|-----------|
| Source art creation | Manual (external tool) | No |
| PNG upload | Manual (file picker) | Yes via API |
| Grid detection (angles/frames) | Auto-suggested, user override | Mostly auto |
| PNG → XP conversion | Automated | Yes |
| L0/L1/L3 layer construction | Automated (native_compat) | Yes |
| Cell-level editing | Manual (inspector tool) | Partially |
| In-game preview | Semi-manual (click button) | Yes via API |
| Export to game files | Manual copy or API export | Yes |

### Friction Points

1. **Source art must be pre-formatted** — user must know the exact grid layout (8 angles vertically, N frames horizontally) before creating their PNG. No template/guide overlay.

2. **No undo across sessions** — session state is persisted, but closing the browser loses inspector edits if not saved.

3. **Preview requires WASM runtime build** — the `runtime/termpp-skin-lab-static/` directory must contain a built game. Missing = no preview.

4. **AHSW uniform override** — all equipment variants get the same skin. No per-equipment-state editing.

5. **Grid auto-detection can fail** — unusual PNG aspect ratios trigger fallback geometry that may produce garbled output.

---

## 4. UX Workflow Gaps

### Gap 1: No From-Scratch Sprite Creation
**Severity: HIGH**

There is no workflow for creating a sprite from scratch without a PNG source. The pipeline requires `upload_png` as the entry point. A user who wants to hand-draw in CP437 glyphs directly has no path through the workbench UI.

The MCP tools (`create_xp_file`, `write_cell`, `fill_rect`, `write_ascii_block`) can create XP files from scratch, but there is no UI wrapper for this — it requires programmatic API calls.

### Gap 2: Limited Cell/Glyph Editing
**Severity: MEDIUM**

The workbench inspector panel supports:
- Inspect mode (view cell data)
- Paint mode (change fg/bg colors)
- Glyph mode (change glyph code)
- Erase mode (set to transparent)
- Dropper mode (pick colors)
- Select mode (copy/paste regions)

However, this operates on the **converted XP** — it cannot modify the source PNG. Changes are on the XP cell level only. The glyph palette is limited to typing a code number rather than a visual CP437 picker.

### Gap 3: Preview Requires Full Runtime
**Severity: HIGH**

In-game preview requires:
1. A built WASM runtime in `runtime/termpp-skin-lab-static/termpp-web-flat/`
2. All Emscripten files present (index.html, index.js, index.wasm, index.data)
3. At least one .a3d map file

If the runtime is missing (common on fresh clones), the "Apply to flat arena" button is disabled. There is no lightweight preview mode. The `check_runtime_preflight` tool validates this, but cannot fix it.

### Gap 4: No Iterative Edit-Preview Loop for Cell Edits
**Severity: MEDIUM**

The workflow is: convert PNG → inspect cells → (optional) edit cells → apply to runtime. But cell edits do not update the preview automatically. The user must:
1. Make cell edits in the inspector
2. Save the session
3. Click "Apply to flat arena" again
4. Wait for WASM reload (~3-5 seconds in preboot mode)

There is no real-time cell-edit-to-preview feedback loop.

### Gap 5: No Visual Feedback When Conversion Goes Wrong
**Severity: HIGH**

When the PNG → XP conversion produces a garbled result (wrong grid detection, bad aspect ratio), the user sees the broken XP grid but has no guidance on what went wrong or how to fix it. Possible failure modes:
- Wrong angle count → sprites scrambled vertically
- Wrong frame count → sprites cut at wrong boundaries
- Wrong projection count → left/right halves merged or duplicated
- Background not removed → character has colored rectangle around it

The workbench shows the grid cells but does not overlay the source PNG for comparison or highlight misaligned boundaries.

### Gap 6: No Template/Guide for Source Art Creation
**Severity: MEDIUM**

Users must know:
- Player idle: 9 frames (1 idle + 8 walk) × 8 angles × 2 projections = 18 columns, 8 rows
- Attack: 8 frames × 8 angles × 2 projections = 16 columns, 8 rows
- Death: 5 frames × 8 angles × 2 projections = 10 columns, 8 rows

There is no downloadable template PNG with guide lines, no documentation in the UI about required layout, and no validation feedback before conversion starts.

### Gap 7: No Multi-Angle Preview
**Severity: LOW**

The WASM preview shows the character from whatever angle the camera is at. There is no way to cycle through all 8 angles systematically to verify each one looks correct, or to see all angles simultaneously in a grid.

### Gap 8: No Diff View (Before/After)
**Severity: LOW**

When editing cells or re-converting with different parameters, there is no side-by-side comparison of previous vs current output.

### Gap 9: Bundle Workflow Is Action-Sequential
**Severity: MEDIUM**

Creating a full player bundle (idle + attack + death) requires three separate PNG uploads and three separate pipeline runs. There is no batch upload or combined preview. Each action must be configured and converted independently.

---

## 5. Game Engine Constraints That Affect the Editor

### Dimension Constraints (Hard — WASM Crash If Violated)

| Family | Width (cols) | Height (rows) | Enforced By |
|--------|-------------|---------------|-------------|
| player | 126 | 80 | `_assert_native_contract_dims()` |
| attack | 144 | 80 | `_assert_native_dims()` |
| plydie | 110 | 88 | `_assert_native_dims()` |

Source: `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py` lines 1169-1174

These are **non-negotiable** — the C++ engine reads fixed offsets. Wrong dimensions = WASM crash (100% crash rate observed historically, per MEMORY.md).

### Layer Count Constraints (Hard)

| Family | Required Layers | L3 Purpose |
|--------|----------------|------------|
| player | 4 | Swoosh overlay |
| attack | 4 | Swoosh overlay |
| plydie | 3 | No swoosh |

Validated by G11 gate in `gates.py`.

### L0 Metadata Constraints (Hard)

Row 0, col 0 sequence must match family pattern exactly:
- player: glyphs `['8', '1', '8']` → 8 angles, 1+8 frames
- attack: glyphs `['8', '8']` → 8 angles, 8 frames
- plydie: glyphs `['8', '5']` → 8 angles, 5 frames

Validated by G12 gate. Mismatch = engine misinterprets sprite atlas → visual corruption.

Source: `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py` lines 2371-2375

### Angle Constraint (Hard)

Native compatibility requires exactly 8 angles. Enforced at `native_compat_angles` gate.

### Cell Size Constraints (Derived)

Cell dimensions are derived from total dims / (angles × frames × projs):
- player cell: 7w × 10h (126 / (9×2) = 7, 80 / 8 = 10)
- attack cell: 9w × 10h (144 / (8×2) = 9, 80 / 8 = 10)
- plydie cell: 11w × 11h (110 / (5×2) = 11, 88 / 8 = 11)

Columns must divide evenly: `cell_w × total_tile_cols == total_cols`. Enforced by `native_compat_geometry` gate.

### Glyph Constraints (Soft)

- CP437 code points 0-255 only
- Visual glyphs: 219 (█), 220 (▄), 223 (▀) are the primary rendering primitives
- Glyph 32 (space) with magenta bg = transparent
- Glyph 0 with magenta bg = transparent (used in metadata/blank layers)
- No hard restriction on which glyphs appear in L2, but the half-cell encoding only produces 219/220/223 from the pipeline

### Color Constraints (Soft)

- Background `(255, 0, 255)` = transparent (magenta key color)
- L0 background `(255, 255, 85)` = metadata layer yellow (convention, not engine-enforced)
- L1 background `(255, 255, 255)` = height encoding white (convention)
- Pipeline clamps average colors to range [28, 220] per channel to avoid near-black/near-white confusion

### Projection Constraint

All native skins use 2 projections (stereo). The engine supports 1 projection but native_compat forces 2.

### Override Name Constraints

The workbench writes the same XP to all AHSW variants. In production:
- player: 24 files (2×2×2×3) + player-nude.xp = 25 files
- attack: 16 files (W ∈ {1,2} only, so 2×2×2×2 = 16)
- plydie: 24 files (2×2×2×3)

---

## Summary Counts

- **Hard engine constraints:** 12 (dimensions×3 families, layer counts×3, L0 metadata×3, 8-angle, cell divisibility, projection count)
- **Soft constraints:** 4 (CP437 range, magenta transparency, color clamping, AHSW naming)
- **Total constraints:** 16
- **UX workflow gaps identified:** 9

---

## Key Architecture Insight

The Asciicker engine is a **closed-source C++ binary** compiled to WASM. The sprite contract is reverse-engineered from reference .xp files and runtime behavior, not from engine documentation. This means:

1. Every constraint was discovered empirically (often via crash)
2. The pipeline must replicate exact binary patterns from reference files
3. L0 metadata is the most fragile contract — a single wrong glyph crashes the engine
4. The "gate" system (G10-G12) exists specifically because these constraints have caused production crashes

The pipeline is fundamentally a **PNG-to-XP translator** with heavy engine-contract enforcement. The editor capabilities (inspector, cell painting) are afterthoughts bolted onto the conversion pipeline rather than a first-class creation tool.
