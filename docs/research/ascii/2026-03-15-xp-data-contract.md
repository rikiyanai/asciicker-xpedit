# Canonical XP Data Contract

Date: 2026-03-15
Branch: master
HEAD: 034004ea30a75294e597897e6231d90c15a342b6
Governed by: docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md

This document defines the XP data contract that the product must obey. Every claim
is code-backed with file path, line refs, and a confidence tag: CONFIRMED, INFERRED,
or UNKNOWN.

---

## 1. Scope

This contract covers two distinct workflow families. Neither substitutes for the other.

### 1a. New XP Authoring Contract

Creating a new XP from scratch. The product must let the user specify dimensions,
angles, anim grouping, projections, and layer structure through reachable UI, and the
resulting session must reflect that structure in editing and export.

**Current status**: No new-XP authoring path exists on master. The `#btnNewXp` UI,
`createBlankXp()`, and `/api/workbench/new-xp` endpoint were deleted in `034004e`.
(CONFIRMED — `web/workbench.html`, `web/workbench.js`, `src/pipeline_v2/app.py`)

### 1b. Existing XP Load/Edit/Export Contract

Loading an existing XP file through the product upload path. The product must preserve
all geometry, layers, and cells on load; allow editing through shipped controls; and
export without structural corruption.

**Current status**: Upload path exists but discards layers, hardcodes geometry, and
fabricates non-visual layers on export. (CONFIRMED — see sections 8-9)

---

## 2. XP Binary Contract

### 2a. Standard REXPaint Format (Python codecs)

Two Python implementations exist. Both implement the same standard REXPaint binary format.

**File container format:**

```
gzip( version_i32 | layer_count_u32 | layer_0 | layer_1 | ... )
```

- Entire file is gzip-compressed as a single stream
- No magic number
- No global width/height in the outer header

(CONFIRMED — `src/pipeline_v2/xp_codec.py:16-18`, `scripts/rex_mcp/xp_core.py:220-223`)

**Per-layer structure:**

```
width_i32 | height_i32 | cells[width * height]
```

- Width and height stored as signed i32 (little-endian)
- Cell data immediately follows dimensions — no per-layer compression boundary
- All layers must have identical dimensions (enforced on read)

(CONFIRMED — `xp_codec.py:22-23,64-69`, `xp_core.py:169-172,226`)

**Version field:**

- Written as signed i32, value = -1
- Read rejects any value other than -1

(CONFIRMED — `xp_codec.py:17,57-58`, `xp_core.py:153,222`)

**Layer count:**

- Written/read as unsigned u32

(CONFIRMED — `xp_codec.py:18,59`)

### 2b. Custom JS Format (xp-file-reader.js / xp-file-writer.js)

The JS codec uses a **completely different container format** that is incompatible
with the standard REXPaint format above.

**File container format:**

```
magic_u32("REXP") | version_i32(=1) | width_i32 | height_i32 | layerCount_i32 | layer_0 | layer_1 | ...
```

- Outer envelope is **NOT** gzip-compressed
- Has a 20-byte header with magic number, version, global dimensions, and layer count
- Per-layer cell data is individually gzip-compressed

(CONFIRMED — `web/rexpaint-editor/xp-file-writer.js:74-88,144-147`,
`web/rexpaint-editor/xp-file-reader.js:67-91`)

**Per-layer structure:**

```
layerWidth_i32 | layerHeight_i32 | compressedSize_i32 | gzip(cells[width * height])
```

- Each layer's cell data is separately gzip-compressed
- `compressedSize` field tells the reader how many bytes to read for the gzip block

(CONFIRMED — `xp-file-reader.js:121-133`, `xp-file-writer.js:117-162`)

**Version field:**

- Written as signed i32, value = 1 (not -1)
- No validation on read — any version accepted

(CONFIRMED — `xp-file-writer.js:80-81`, `xp-file-reader.js:78-80`)

### 2c. Cell Format (Shared)

Both codecs use the **same 10-byte cell format:**

```
Offset  Len  Field         Type
0       4    glyph         uint32 (little-endian, CP437 code point)
4       3    fg_r,fg_g,fg_b  3 × uint8 (RGB)
7       3    bg_r,bg_g,bg_b  3 × uint8 (RGB)
```

(CONFIRMED — `xp_codec.py:28-29`, `xp-file-writer.js:122-137`)

### 2d. Column-Major Stream Order

Both codecs iterate cells in **column-major order** on disk (X outer, Y inner):

```
for x in range(width):
    for y in range(height):
        write/read cell at (x, y)
```

In-memory representations use **row-major indexing** (`cells[y * width + x]` in Python,
`cells[y][x]` in JS). The codec transposes during read/write.

(CONFIRMED — `xp_codec.py:24-27,71-77`, `xp-file-reader.js:188-213`,
`xp-file-writer.js:118-142`)

### 2e. Codec Compatibility Matrix

| Direction | Result | Reason |
|-----------|--------|--------|
| Python → Python | OK | Both use version=-1, gzip container |
| JS → JS | OK | Both use REXP magic, version=1, per-layer gzip |
| Python → JS | FAIL | JS reader decompresses gzip, then reads first 4 bytes as magic → gets 0xFFFFFFFF (version -1 as unsigned) → rejects |
| JS → Python | FAIL | Python skips non-gzip file, reads first 4 bytes as version → gets 0x50584552 (REXP magic) = 1347571026 → rejects (not -1) |

**The two codecs cannot read each other's output.** This is NOT just a version field
difference — the container formats are structurally incompatible (whole-file gzip
vs per-layer gzip, no magic vs REXP magic, 8-byte header vs 20-byte header).

(CONFIRMED — cross-referencing `xp_codec.py:38-41,56-58` with
`xp-file-reader.js:43-61,67-76`)

---

## 3. Geometry / Metadata Contract

### 3a. Authoritative Metadata Source: L0 Row 0

Geometry metadata is encoded in Layer 0, row 0 via CP437 digit glyphs:

```
Cell (0,0) glyph → angles (number of rotation angles)
Cell (0,1) glyph → anims[0] (frame count for first animation)
Cell (0,2) glyph → anims[1] (frame count for second animation)
Cell (0,N) glyph → anims[N-1] (scan continues until zero/non-digit)
```

**Digit codec:**

- Glyphs 48-57 ('0'-'9') → values 0-9
- Glyphs 65-90 ('A'-'Z') → values 10-35
- Glyphs 97-122 ('a'-'z') → values 10-35 (case-insensitive)

(CONFIRMED — `scripts/rex_mcp/xp_core.py:261-269` `get_digit()`,
`src/pipeline_v2/service.py:1146-1151` `_digit_to_glyph()`)

**Projection derivation:**

- If `angles > 0` (valid digit): `projs = 2`
- If `angles <= 0` (no valid digit): `angles = 1, projs = 1`

(CONFIRMED — `xp_core.py:271-278` in `get_metadata()`)

### 3b. Existing Metadata Parser

`xp_core.py:242-292` `XPFile.get_metadata()` is the **only working metadata parser**
in the codebase. It correctly reads L0 row 0 and returns `{angles, projs, anims}`.

(CONFIRMED — `xp_core.py:242-292`)

**Critical gap**: This parser lives in `scripts/rex_mcp/xp_core.py` (MCP tool
support code), NOT in `src/pipeline_v2/service.py`. The workbench upload path in
service.py does not call it — it hardcodes geometry instead.

(CONFIRMED — `service.py:2039-2046,2054-2062` — comment explicitly states
"These metadata values are not derived from the uploaded XP file")

### 3c. L0 Rows 1+ Purpose

L0 contains additional metadata cells at rows 1 and 2:

**Player family (from `_build_native_l0_layer`, service.py:1209-1211):**
```
Row 1: (0)='2', (1)='4'
Row 2: (0)='1', (1)='F'
```

**Purpose of rows 1-2: UNKNOWN.**

These values are hardcoded in the native player template but their semantic meaning
is not documented in any code comment or doc. Possible interpretations:
- Row 1 may encode cell dimensions or projection metadata
- Row 2 may encode family type or layer configuration
- 'F' (glyph 70) maps to value 15 in the digit codec

The `get_metadata()` parser in xp_core.py only reads row 0. Rows 1-2 are not parsed
by any known code path, but they ARE present in reference XP files and in the template
builder output. Their purpose relative to the WASM engine is UNKNOWN.

### 3d. L0 Row 0 Expected Values Per Family

From `_FAMILY_L0_COL0` at `service.py:2478-2482`:

| Family | L0 Row 0 Glyphs | Meaning |
|--------|-----------------|---------|
| player | `['8', '1', '8']` | 8 angles, anims=[1, 8] |
| attack | `['8', '8']` | 8 angles, anims=[8] |
| plydie | `['8', '5']` | 8 angles, anims=[5] |

These are validated by gate G12 (`gates.py:69-82`) but only for
validation — NOT used to derive session geometry on upload.

(CONFIRMED — `service.py:2478-2482`, `gates.py:69-82`)

### 3e. What Is Engine Contract vs Editor Convention

- **Engine contract**: L0 row 0 metadata encoding (angles/anims), L1 countdown pattern,
  L2 visual layer, layer count per family — the WASM runtime depends on these.
  (INFERRED — runtime code is WASM binary, not directly inspectable; inferred from
  the fact that the native builders enforce these patterns and Skin Dock accepts them)

- **Editor convention**: L0 border art (box-drawing characters delineating frame
  boundaries in REXPaint), L0 rows 1-2 metadata, yellow background fill on L0 —
  these exist in reference XP files but no code path parses or depends on them
  beyond template replication.
  (INFERRED — border art visible in attack/plydie reference files per
  `_build_native_attack_layers` and `_build_native_death_layers` which copy L0
  from reference files at `service.py:1263-1264,1286-1287`)

---

## 4. Layer Contract

### Layer 0 (L0): Metadata / Colorkey

**Role**: Encodes geometry metadata (row 0 digit glyphs) and optionally frame-boundary
border art. Full canvas filled with yellow background `(255,255,85)`.

**Runtime significance**: YES — engine reads L0 row 0 to determine frame slicing.

**Editable in workbench**: NO — not exposed through any shipped control.

**Preserved on upload**: NO — discarded. Only L2 extracted.
(CONFIRMED — `service.py:2012-2014`)

**Preserved on export**: NO — fabricated from template (`_build_native_l0_layer` for
player, copied from reference XP for attack/plydie).
(CONFIRMED — `service.py:1193-1212,1243,1263-1264,1286-1287`)

### Layer 1 (L1): Frame Index / Height Countdown

**Role**: Row-based countdown pattern. Every cell on row Y has glyph encoding
`(CELL_H - 1) - (Y % CELL_H)`. For player: 9,8,7,...,0 repeating every 10 rows.
White background `(255,255,255)`, black foreground `(0,0,0)`.

**Runtime significance**: YES — engine uses L1 to determine frame-row boundaries.

**Editable in workbench**: NO.

**Preserved on upload**: NO — discarded.

**Preserved on export**: NO — always regenerated from template with `NATIVE_CELL_H=10`.
(CONFIRMED — `service.py:1215-1230,1244`)

**Known issue**: Plydie family has `cell_h=11` (from `template_registry.json:66`)
but L1 is regenerated with `NATIVE_CELL_H=10`, creating a period mismatch.
(CONFIRMED — `service.py:1282-1283` comment acknowledges this)

### Layer 2 (L2): Visual / Editable Sprite Art

**Role**: Primary visual layer containing the sprite artwork.

**Runtime significance**: YES — rendered as the visible sprite.

**Editable in workbench**: YES — the only editable layer via the inspector UI.
(CONFIRMED — `web/workbench.js` inspector operates on `state.cells` which is L2)

**Preserved on upload**: YES — extracted and stored in session.
(CONFIRMED — `service.py:2012-2027`)

**Preserved on export**: YES — written from session cells.
(CONFIRMED — `service.py:1965-1968,1976-1978`)

### Layer 3 (L3): Swoosh / Transparent Overlay

**Role**: Optional overlay layer for attack effects. Typically fully transparent.

**Runtime significance**: UNKNOWN — possibly used by engine for attack swoosh effects.

**Editable in workbench**: NO.

**Preserved on upload**: NO — discarded.

**Preserved on export**: NO — fabricated as fully transparent
(`glyph=0, fg=(0,0,0), bg=(255,0,255)`).
(CONFIRMED — `service.py:1245`)

**Layer count by family:**

| Family | Layers | L3 present |
|--------|--------|------------|
| player | 4 | Yes (transparent) |
| attack | 4 | Yes (transparent) |
| plydie | 3 | No |

(CONFIRMED — `config/template_registry.json:16,50,67`,
`service.py:1246,1267,1289`)

---

## 5. Frame Layout Contract

### 5a. Frame Grid Derivation

Given geometry `{angles, anims, projs}` and grid dimensions `{gridCols, gridRows}`:

```
semantic_frames = sum(anims)
frame_cols      = semantic_frames × projs
frame_rows      = angles
frame_w_chars   = gridCols / frame_cols
frame_h_chars   = gridRows / frame_rows
```

(CONFIRMED — `service.py:1602-1609`, `web/workbench.js:1647-1657`
`recomputeFrameGeometry()`)

### 5b. Frame Addressing (Global ↔ Frame-Local)

A frame at grid position `(row, col)` occupies:

```
global_x_min = col × frame_w_chars
global_y_min = row × frame_h_chars
global_x_max = global_x_min + frame_w_chars - 1
global_y_max = global_y_min + frame_h_chars - 1
```

(CONFIRMED — `web/workbench.js:2381-2392` `inspectorFrameCellMatrix()`)

### 5c. Stereo Projection Mapping

For `projs=2`, frame columns are split:

```
Columns [0, semantic_frames-1]                → Projection 0
Columns [semantic_frames, 2×semantic_frames-1] → Projection 1
```

(CONFIRMED — `web/workbench.js:2374-2378` `frameColInfo()`)

### 5d. Family-Specific Frame Contracts

| Family | Grid | Angles | Anims | Projs | frame_w | frame_h | Total Frames |
|--------|------|--------|-------|-------|---------|---------|-------------|
| player | 126×80 | 8 | [1,8] | 2 | 7 | 10 | 8×9×2 = 144 |
| attack | 144×80 | 8 | [8] | 2 | 9 | 10 | 8×8×2 = 128 |
| plydie | 110×88 | 8 | [5] | 2 | 11 | 11 | 8×5×2 = 80 |

(CONFIRMED — `config/template_registry.json:10-15,45-50,61-66`)

### 5e. What The Workbench Currently Assumes

On upload, geometry is hardcoded to `angles=1, anims=[1], projs=1`, so:

```
frame_cols = 1, frame_rows = 1
frame_w_chars = gridCols, frame_h_chars = gridRows
```

The entire grid is treated as a single frame regardless of actual structure.
`recomputeFrameGeometry()` runs but produces single-frame layout from the
hardcoded inputs.

(CONFIRMED — `service.py:2054-2062,2074-2076`)

---

## 6. New XP Authoring Requirements

A correct new-file workflow must let the user specify through reachable UI:

| Parameter | Required | Description |
|-----------|----------|-------------|
| width | YES | Grid width in cells |
| height | YES | Grid height in cells |
| angles | YES | Number of rotation angles (1-8) |
| anims | YES | List of frame counts per animation (e.g. [1,8]) |
| projs | YES | Projection count (1=mono, 2=stereo) |
| layers | INFERRED | Must create correct layer stack per family (3 or 4) |
| family | INFERRED | Determines layer builder, dimension constraints, L0 template |

**Editable layers**: Only L2 is user-editable. L0 and L1 must be generated from
the specified geometry. L3 (if present) is initialized transparent.

**Locked layers**: L0 (metadata), L1 (countdown), L3 (overlay) — generated, not
user-edited.

**Validation**: Grid dimensions must divide evenly by frame grid:
- `gridCols % (sum(anims) × projs) == 0`
- `gridRows % angles == 0`

(INFERRED — from frame layout contract in section 5a; no validation code exists
because no new-XP authoring path exists)

---

## 7. Existing XP Load Requirements

When loading an existing XP file, the product must preserve:

| Property | Must Preserve | Currently Preserved |
|----------|--------------|-------------------|
| Grid width/height | YES | YES — `xp_data["width"], xp_data["height"]` stored in session |
| Layer count | YES | NO — only L2 extracted, count recorded but layers discarded |
| All layer cell data | YES | NO — L0, L1, L3 discarded on upload |
| Geometry (angles/anims/projs) | YES | NO — hardcoded to 1,1,1 |
| Frame layout | YES | NO — derived from hardcoded geometry |
| L0 metadata | YES | NO — not read on upload |

(CONFIRMED — `service.py:1991-2095`)

---

## 8. Confirmed Contradictions In Current Code

### C1: Upload Geometry Hardcoding (Blocker B1)

`workbench_upload_xp()` hardcodes `angles=1, anims=[1], projs=1` regardless of file
content. A working L0 metadata parser exists at `xp_core.py:242-292` but is not used.

- File: `src/pipeline_v2/service.py:2054-2062`
- Status: CONFIRMED, blocking

### C2: Upload Layer Discarding (Blocker B2)

Only L2 (or L0 for <3-layer files) is extracted. L0 metadata, L1 frame index, and
L3 overlay are silently discarded and never stored in the session.

- File: `src/pipeline_v2/service.py:2012-2014`
- Status: CONFIRMED, blocking

### C3: Single-Layer Session Model (Blocker B3)

`WorkbenchSession` stores one flat `cells: list[dict]` for a single layer. No
multi-layer storage, no per-layer addressing.

- File: `src/pipeline_v2/models.py:93-107`
- Status: CONFIRMED, blocking

### C4: Export Layer Fabrication (Blocker B4)

Export always calls `_build_native_layers()` which fabricates L0 from a hardcoded
template (player) or copies from reference XP (attack/plydie), regenerates L1 from
a countdown formula, and creates L3 as transparent. Only L2 is preserved from the
session.

- File: `src/pipeline_v2/service.py:1957-1988,1292-1320`
- L0 template: `service.py:1193-1212`
- L1 template: `service.py:1215-1230`
- L3 transparent: `service.py:1245`
- Status: CONFIRMED, blocking

### C5: XP Codec Incompatibility (Blocker B5)

Python and JS codecs use structurally incompatible binary formats (see section 2e).
This is not a minor version-field difference — the container structures differ in:

- Whole-file gzip (Python) vs no outer gzip + per-layer gzip (JS)
- No magic number (Python) vs REXP magic (JS)
- 8-byte header (Python) vs 20-byte header (JS)
- Version -1 (Python) vs version 1 (JS)

No code path currently requires Python↔JS round-trip, so this is latent. It becomes
blocking when EditorApp (JS) needs to read files written by service.py (Python) or
vice versa.

- Files: `src/pipeline_v2/xp_codec.py`, `web/rexpaint-editor/xp-file-reader.js`,
  `web/rexpaint-editor/xp-file-writer.js`
- Status: CONFIRMED, latent blocker

### C6: Doc Drift — AGENT_PROTOCOL.md

Was referencing deleted oracle/recipe/harness and treating blank-flow 1,1,1 as
evidence. **Fixed in this session** — now aligned with acceptance contract.

- File: `docs/AGENT_PROTOCOL.md:16-18`
- Status: CONFIRMED, fixed

### C7: Plydie L1 Period Mismatch

Death/plydie family has `cell_h=11` but L1 countdown uses `NATIVE_CELL_H=10`.
The regenerated L1 has a 10-row period instead of 11-row, potentially misaligning
frame-row boundaries for the engine.

- File: `src/pipeline_v2/service.py:1282-1283`
- Template registry: `config/template_registry.json:66` (`"cell_h": 11`)
- Status: CONFIRMED, deferred

---

## 9. Unknowns That Must Be Resolved Before Patching

### U1: Exact Semantics of L0 Rows 1-2

L0 metadata rows 1 and 2 contain hardcoded values (`'2','4'` and `'1','F'` for player)
whose purpose is not documented. Before implementing L0 preservation on upload/export:

- Are rows 1-2 read by the WASM engine?
- Do they encode cell dimensions, projection mode, family type, or something else?
- Can they be safely preserved as-is from the source file, or must they match the
  template exactly?

**Risk if unknown**: If we preserve original L0 but the engine expects specific row 1-2
values, the runtime may fail or behave incorrectly.

**Resolution path**: Inspect reference XP files (player-0100.xp, attack-0001.xp,
plydie-0000.xp) and compare L0 rows 1-2 values across families. Cross-reference with
any WASM source or disassembly if available.

### U2: Whether JS Codec Should Be Deleted, Rewritten, or Made Compatible

Three options exist for resolving the codec incompatibility (C5):

1. **Delete JS codec** — if EditorApp will always read/write via backend Python API
2. **Rewrite JS codec** — to match standard REXPaint format (version=-1, whole-file gzip, no REXP magic)
3. **Make compatible** — add REXP-format support to Python reader (accept both formats)

The choice depends on the frontend architecture decision: will EditorApp do local
XP I/O or always proxy through the backend?

**Risk if unknown**: Choosing wrong creates wasted work or introduces new incompatibility.

### U3: Whether Uploaded XP Geometry Should Come From L0 or From Template Registry

Two possible sources for geometry on upload:

1. **From L0 metadata** (xp_core.py `get_metadata()`) — file is self-describing
2. **From template registry** — user selects a family/template, registry provides geometry

Option 1 is more general (arbitrary XP files). Option 2 is safer for known families
but fails for non-standard files. The upload path may need both: read L0, validate
against template if family is known, use L0-derived values.

**Risk if unknown**: If L0 metadata is wrong or absent in some files, pure L0-based
geometry would produce incorrect frame layout.

### U4: Runtime Behavior With Non-Template Geometry

Skin Dock and the WASM engine have only been tested with native family geometry
(8 angles, specific frame counts). It is unknown whether the runtime handles:

- Fewer than 8 angles
- Non-standard frame counts
- Non-standard grid dimensions
- Files without L0 metadata

**Risk if unknown**: Fixing B1-B4 might produce correctly structured XP files that
the runtime still rejects or renders incorrectly.

### U5: Whether L3 Overlay Has Runtime Significance

L3 is fabricated as transparent on export. If the original file had meaningful L3
content (e.g. attack swoosh art), that content is lost. It is unknown whether the
WASM engine reads L3 for rendering.

**Risk if unknown**: Preserving L3 from source might not matter if the engine ignores
it, or might be critical if the engine renders it.

---

## Summary of Evidence Confidence

| Claim | Confidence | Primary Source |
|-------|-----------|----------------|
| Cell format is 10 bytes (4+3+3) | CONFIRMED | xp_codec.py:28-29, xp-file-writer.js:122-137 |
| Stream order is column-major | CONFIRMED | xp_codec.py:24-27, xp-file-reader.js:188-213 |
| Python/JS codecs are incompatible | CONFIRMED | Cross-reference sections 2a, 2b, 2e |
| L0 row 0 encodes angles/anims | CONFIRMED | xp_core.py:242-292 |
| L0 rows 1-2 purpose | UNKNOWN | Values exist but no parser reads them |
| L1 is countdown pattern | CONFIRMED | service.py:1215-1230 |
| L2 is the only editable layer | CONFIRMED | workbench.js inspector, service.py:2012-2014 |
| L3 runtime significance | UNKNOWN | Fabricated as transparent, no evidence either way |
| Upload discards geometry | CONFIRMED | service.py:2039-2062 |
| Export fabricates L0/L1/L3 | CONFIRMED | service.py:1193-1230,1292-1320 |
| Session is single-layer | CONFIRMED | models.py:93-107 |
| Frame layout formula | CONFIRMED | service.py:1602-1609, workbench.js:1647-1657 |
| Plydie L1 period mismatch | CONFIRMED | service.py:1282-1283, template_registry.json:66 |
