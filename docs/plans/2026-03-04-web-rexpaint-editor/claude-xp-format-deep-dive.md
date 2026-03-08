# XP Format Deep Dive — End-to-End Trace

## PART 1: Layer 0 Metadata — How Does It Actually Work?

### 1.1 The .xp Binary Format (REXPaint Appendix B)

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/docs/REXPAINT_MANUAL.txt:350-367`

The .xp file is gzip-compressed binary:

```
version         (int32, little-endian)   — always -1
num_layers      (uint32)
per layer:
  width         (int32)
  height        (int32)
  per cell (column-major order — x outer, y inner):
    glyph       (uint32, CP437 code point)
    fg_r        (uint8)
    fg_g        (uint8)
    fg_b        (uint8)
    bg_r        (uint8)
    bg_g        (uint8)
    bg_b        (uint8)
```

**Critical detail: Column-major storage.** The file iterates `for x in range(width): for y in range(height)`, NOT row-major. The Python codec transposes on load/save to present row-major `cells[y * width + x]` in memory.

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/xp_codec.py:24-29` (write) and `:68-74` (read) confirm column-major disk order transposed to row-major `cells[y * w + x]` in memory.

Transparent cells are identified by background color `(255, 0, 255)` (hot pink / magenta).

---

### 1.2 What Exactly is Written to Layer 0?

#### 1.2.1 Player family (player-0100.xp): Hand-built L0

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1193-1212`

```python
def _build_native_l0_layer(cols: int, rows: int) -> list[Cell]:
    META_BG = (255, 255, 85)   # yellow background
    META_FG = (0, 0, 0)        # black foreground
    space_cell = (32, META_FG, META_BG)  # space character
    layer = [space_cell] * (cols * rows)  # fill ENTIRE layer with yellow spaces

    # Stamp 7 metadata cells in the top-left corner:
    _set(0, 0, '8')   # row 0, col 0: angles = 8
    _set(0, 1, '1')   # row 0, col 1: anim[0] = 1 frame (idle)
    _set(0, 2, '8')   # row 0, col 2: anim[1] = 8 frames (walk)
    _set(1, 0, '2')   # row 1, col 0: ??? (extra metadata)
    _set(1, 1, '4')   # row 1, col 1: ??? (extra metadata)
    _set(2, 0, '1')   # row 2, col 0: ??? (extra metadata)
    _set(2, 1, 'F')   # row 2, col 1: ??? (extra metadata, 'F' = 15)
```

**Verified from actual file read (xp-tool read_layer_region on player-0100.xp L0, (0,0)-(20,5)):**

```
Row 0: glyph 56('8'), 49('1'), 56('8'), then 32(' ') for remaining cols
Row 1: glyph 50('2'), 52('4'), then 32(' ') for remaining cols
Row 2: glyph 49('1'), 70('F'), then 32(' ') for remaining cols
Row 3+: all 32(' ')
```

ALL cells have identical colors: fg=#000000, bg=#ffff55 (yellow).

**So for player, L0 is:**
- The ENTIRE 126x80 layer is filled with yellow-background spaces
- Only 7 cells in the top-left corner have non-space glyphs
- Row 0 encodes: [angles=8, anim0_frames=1, anim1_frames=8]
- Rows 1-2 encode additional metadata: [2,4] and [1,F] — purpose unclear from code alone, likely cell dimensions or projection info used by the C++ engine
- The rest of L0 is dead space (uniform yellow)

#### 1.2.2 Attack family (attack-0001.xp): Dense border art L0

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1249-1267`

Attack L0 is NOT hand-built — it is loaded from a reference file:

```python
l0_ref = _assert_l0_reference_available("attack", req_id)
l0 = list(l0_ref)  # deep copy from reference attack-0001.xp
```

**Verified from actual file read (attack-0001.xp L0, row 0, cols 0-19):**

```
Row 0: 56('8'), 56('8'), 196('─'), 196, 196, 196, 196, 196, 194('┬'), 194, 196, 196, 196, 196, 196, 196, 196, 194, 194, 196...
Row 1: 50('2'), 52('4'), 32(' '), ... 179('│'), 179...
Row 2: 49('1'), 70('F'), 32(' '), ... 179, 179...
```

ALL cells: fg=#000000, bg=#ffff55 (same yellow)

**Key difference from player:** Attack L0 has DENSE BORDER ART using CP437 box-drawing characters (196=horizontal line, 194=T-junction, 179=vertical line) that form a visible grid pattern on the layer. The metadata cells (0,0)=(0,1)='8' meaning 8 angles, then (0,2)+ have border art. The attack metadata row 0 starts with `8, 8` — meaning angles=8, anim[0]=8 frames.

Attack metadata: `angles=8, anims=[8]` (8 angles, one animation of 8 frames)
Attack dimensions: 144x80, cell_w=9, cell_h=10

#### 1.2.3 Death/plydie family (plydie-0000.xp): Dense border art L0

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1270-1289`

Also loaded from reference file, not hand-built.

**Verified from actual file read (plydie-0000.xp L0, row 0):**

```
Row 0: 56('8'), 53('5'), 196('─'), 196, 196, 196, 196, 196, 196, 196...
Row 1: 54('6'), 54('6'), 32(' ')...
Row 2: 53('5'), 70('F'), 32(' ')...
```

ALL cells: fg=#000000, bg=#ffff55 (yellow)

Plydie metadata: `angles=8, anims=[5]` (8 angles, one animation of 5 frames)
Plydie dimensions: 110x88, cell_w=11, cell_h=11

---

### 1.3 The Metadata Encoding Scheme

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/scripts/rex_mcp/xp_core.py:241-292` (get_metadata)
**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1146-1151` (_digit_to_glyph)
**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/scripts/xp_mcp_server.py:443-494` (set_metadata docstring)

#### Row 0 encoding (the ONLY universally parsed row):

| Position | Meaning | Encoding |
|----------|---------|----------|
| (0,0) | Number of rotation angles | ASCII digit: '0'-'9' → 0-9, 'A'-'Z' → 10-35 |
| (0,1) | Frame count for animation 0 | Same digit encoding |
| (0,2) | Frame count for animation 1 | Same digit encoding |
| (0,N) | Frame count for animation N-1 | Scanned until non-digit or zero |

The `get_metadata()` function in xp_core.py:

```python
raw_angles = get_digit(l0.data[0][0])   # cell (x=0, y=0) glyph
if raw_angles > 0:
    projs = 2       # multi-angle implies stereo projection
    angles = raw_angles
else:
    projs = 1       # no angles → mono projection
    angles = 1

# Scan remaining cols for animation frame counts
for a in range(1, l0.width):
    length = get_digit(l0.data[0][a])
    if length > 0:
        anims.append(length)
    else:
        break  # first non-digit stops the scan
```

**The digit decoder:**
```python
def get_digit(res):
    glyph, _, _ = res  # only glyph matters, colors ignored for metadata
    if 48 <= glyph <= 57: return glyph - 48    # '0'-'9' → 0-9
    if 65 <= glyph <= 90: return glyph + 10 - 65  # 'A'-'Z' → 10-35
    if 97 <= glyph <= 122: return glyph + 10 - 97 # 'a'-'z' → 10-35
    return -1  # non-digit terminates scan
```

#### Rows 1-2 (extra metadata — what the native files contain):

For player-0100.xp:
- Row 1: `'2'(=2), '4'(=4)` — likely encodes cell dimensions or additional engine params
- Row 2: `'1'(=1), 'F'(=15)` — likely encodes something engine-specific

For attack-0001.xp:
- Row 1: `'2'(=2), '4'(=4)`
- Row 2: `'1'(=1), 'F'(=15)`

For plydie-0000.xp:
- Row 1: `'6'(=6), '6'(=6)`
- Row 2: `'5'(=5), 'F'(=15)`

**IMPORTANT:** The Python pipeline code ONLY reads row 0 for metadata extraction. Rows 1+ are preserved from reference files but not programmatically parsed by the pipeline. They likely contain information that the C++ game engine reads directly.

#### Answer: Is L0 JUST glyphs? Or colors too?

**L0 metadata is encoded ONLY in glyphs.** The `get_metadata()` function extracts `glyph` from each cell and ignores fg/bg colors entirely. However, the colors ARE important for the overall L0 pattern:
- Player: uniform yellow fill (bg=#ffff55, fg=#000000) across all cells
- Attack/plydie: same yellow with CP437 box-drawing art creating visible borders between frame regions

The G12 structural gate (`gate_g12_l0_metadata` in `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/gates.py:69-82`) validates that L0 row 0 glyphs match the expected family pattern.

#### Answer: What is the rest of L0 beyond metadata cells?

- **Player family:** Entirely filled with space characters (glyph 32) on yellow background. Nothing but dead space.
- **Attack/plydie families:** Contain dense CP437 box-drawing border art that visually delineates frame boundaries when viewed in REXPaint. The border art uses horizontal lines (196='─'), vertical lines (179='│'), T-junctions (194='┬'), etc. on yellow background.

---

### 1.4 How the Game Engine Determines Frame Boundaries

The game engine slices the XP canvas into frames using the metadata from L0 row 0 plus the known dimensions:

**From the template registry** (`/Users/r/Downloads/asciicker-pipeline-v2/config/template_registry.json`):

| Family | XP dims | Angles | Frames | Projs | cell_w | cell_h | Layers |
|--------|---------|--------|--------|-------|--------|--------|--------|
| player | 126x80  | 8      | [1,8]  | 2     | 7      | 10     | 4      |
| attack | 144x80  | 8      | [8]    | 2     | 9      | 10     | 4      |
| plydie | 110x88  | 8      | [5]    | 2     | 11     | 11     | 3      |

The workbench computes frame geometry in `recomputeFrameGeometry()` (`/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:1647-1657`):

```javascript
function recomputeFrameGeometry() {
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    // e.g. player: 1+8 = 9 semantic frames
    const frameCols = Math.max(1, semanticFrames * Math.max(1, state.projs));
    // e.g. player: 9 * 2 = 18 frame columns
    const frameRows = Math.max(1, state.angles);
    // e.g. player: 8 rows
    const computedW = Math.max(1, Math.floor(state.gridCols / frameCols));
    // e.g. player: floor(126 / 18) = 7 chars wide per frame
    const computedH = Math.max(1, Math.floor(state.gridRows / frameRows));
    // e.g. player: floor(80 / 8) = 10 chars tall per frame

    state.frameWChars = computedW;  // 7
    state.frameHChars = computedH;  // 10
}
```

**Frame boundary formula for player (126x80, 8 angles, [1,8] anims, 2 projs):**
- Total semantic frames = 1 + 8 = 9
- Total frame columns = 9 * 2 (projs) = 18
- Frame width = 126 / 18 = 7 chars
- Frame rows = 8 (one per angle)
- Frame height = 80 / 8 = 10 chars

**For attack (144x80, 8 angles, [8] anims, 2 projs):**
- Total semantic frames = 8
- Total frame columns = 8 * 2 = 16
- Frame width = 144 / 16 = 9 chars
- Frame height = 80 / 8 = 10 chars

**For plydie (110x88, 8 angles, [5] anims, 2 projs):**
- Total semantic frames = 5
- Total frame columns = 5 * 2 = 10
- Frame width = 110 / 10 = 11 chars
- Frame height = 88 / 8 = 11 chars

---

## PART 2: Grid Panel Operations — What Actually Happens to the Data?

### 2.1 State Model

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:72-170`

The workbench maintains a flat array of cell objects:

```javascript
state = {
    cells: [],           // flat array of {idx, glyph, fg:[r,g,b], bg:[r,g,b]}
    gridCols: 0,         // total XP width in chars (e.g., 126)
    gridRows: 0,         // total XP height in chars (e.g., 80)
    angles: 1,           // number of rotation angles
    anims: [1],          // array of frame counts per animation
    projs: 1,            // projection count (1=mono, 2=stereo)
    frameWChars: 1,      // computed: width of one frame in chars
    frameHChars: 1,      // computed: height of one frame in chars
    layers: [],          // 4-element array: [L0, L1, L2_visual, L3]
    activeLayer: 2,      // only layer 2 (Visual) is editable
};
```

The `cells` array is the "source of truth" for layer 2 (Visual). It maps to XP coordinates as `cells[y * gridCols + x]`.

The 4 layers are:
- **Layer 0: "Metadata"** — auto-generated from state.angles + state.anims by `buildMetadataLayerCells()` (line 1875)
- **Layer 1: "Layer 1"** — blank/transparent (height encoding is NOT editable in workbench)
- **Layer 2: "Visual"** — the actual sprite art, cloned from state.cells
- **Layer 3: "Layer 3"** — blank/transparent (swoosh overlay, not editable in workbench)

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:1894-1912` (syncLayersFromSessionCells)

### 2.2 Frame Data Structure

A "frame" is NOT a separate data structure — it is a rectangular region of the flat `cells` array, calculated from (row, col) grid coordinates.

**Frame-to-XP coordinate mapping** (`/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:2381-2392`):

```javascript
function inspectorFrameCellMatrix(row, col) {
    const out = [];
    for (let y = 0; y < state.frameHChars; y++) {
        const line = [];
        for (let x = 0; x < state.frameWChars; x++) {
            const gx = col * state.frameWChars + x;  // XP x = col * frameW + localX
            const gy = row * state.frameHChars + y;   // XP y = row * frameH + localY
            line.push(cellAt(gx, gy));
        }
        out.push(line);
    }
    return out;  // 2D matrix [frameHChars][frameWChars] of cell objects
}
```

**THE FORMULA:**
```
XP_x = col * frameWChars + local_x
XP_y = row * frameHChars + local_y
```

For player-0100.xp (frameW=7, frameH=10):
- Frame at grid (row=0, col=0) → XP rect (0,0) to (6,9)
- Frame at grid (row=0, col=1) → XP rect (7,0) to (13,9)
- Frame at grid (row=3, col=2) → XP rect (14, 30) to (20, 39)

### 2.3 Projections (Stereo) Handling

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:2374-2378`

```javascript
function frameColInfo(col) {
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const proj = Math.floor(col / semanticFrames);
    const frame = col % semanticFrames;
    return { semanticFrames, proj, frame };
}
```

For player (9 semantic frames, 2 projs, 18 total cols):
- Cols 0-8: projection 0 (frames 0-8)
- Cols 9-17: projection 1 (frames 0-8)

These are additional columns in the XP canvas, NOT separate layers.

### 2.4 Row Reorder Operations

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:4851-4872`

```javascript
function swapRowBlocks(r1, r2) {
    // Swap ENTIRE rows of cell data (all columns for the full gridCols width)
    for (let y = 0; y < state.frameHChars; y++) {
        const gy1 = r1 * state.frameHChars + y;
        const gy2 = r2 * state.frameHChars + y;
        for (let x = 0; x < state.gridCols; x++) {
            const a = cellAt(x, gy1);
            const b = cellAt(x, gy2);
            setCell(x, gy1, b);    // swap actual cell data
            setCell(x, gy2, a);
        }
    }
    // Also swap row category metadata
    const c1 = state.rowCategories[r1];
    const c2 = state.rowCategories[r2];
    // ...swap categories and frameGroups...
}
```

**When the user reorders rows, it physically swaps rectangular blocks of cells** in the underlying XP canvas. This is NOT a metadata-only swap. Every cell in the row block (spanning all gridCols columns and frameHChars rows of height) is swapped.

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:2170-2189` (moveRowToIndex)

```javascript
function moveRowToIndex(fromRow, toRow) {
    // Bubble-swaps from fromRow to toRow, one position at a time
    const step = to > from ? 1 : -1;
    let cur = from;
    while (cur !== to) {
        swapRowBlocks(cur, cur + step);  // physically swap cells
        cur += step;
    }
}
```

### 2.5 Copy/Paste Frame Operations

**Copy** (`/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:5039-5048`):

```javascript
function copySelectedFrameToClipboard() {
    state.inspectorFrameClipboard = inspectorFrameCellMatrix(coord.row, coord.col);
    // Copies a frameHChars x frameWChars 2D matrix of cell objects
}
```

**Paste** (`/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:5051-5078`):

```javascript
function pasteClipboardToSelectedFrame() {
    writeFrameCellMatrix(coord.row, coord.col, state.inspectorFrameClipboard);
    // First clears target frame, then writes the copied cells
}
```

**writeFrameCellMatrix** (`/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:2395-2407`):

```javascript
function writeFrameCellMatrix(row, col, matrix) {
    clearFrame(row, col);  // clear destination first
    for (let y = 0; y < frameHChars; y++) {
        for (let x = 0; x < frameWChars; x++) {
            const gx = col * state.frameWChars + x;
            const gy = row * state.frameHChars + y;
            setCell(gx, gy, matrix[y][x]);  // write into XP canvas
        }
    }
}
```

Yes, copy/paste works with rectangular blocks of cells from the XP canvas. The clipboard stores a 2D matrix, and paste writes it back to the target frame position.

### 2.6 Delete Frame Operations

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:4828-4849`

```javascript
function clearFrame(row, col) {
    for (let y = 0; y < state.frameHChars; y++) {
        for (let x = 0; x < state.frameWChars; x++) {
            const gx = col * state.frameWChars + x;
            const gy = row * state.frameHChars + y;
            setCell(gx, gy, { glyph: 0, fg: [0, 0, 0], bg: [255, 0, 255] });
            // Cleared to transparent (magenta bg, glyph 0)
        }
    }
}

function deleteSelectedFrames() {
    for (const col of state.selectedCols) clearFrame(state.selectedRow, col);
    // Clears each selected frame to transparent — grid does NOT resize
}
```

**Delete clears cells to transparent (magenta background, glyph 0).** The grid never resizes from delete — it always stays at gridCols x gridRows.

### 2.7 Drag-and-Drop Between Cells

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:5112-5150`

```javascript
function applyGridCellDropAction(fromRow, fromCol, toRow, toCol, mode) {
    const src = inspectorFrameCellMatrix(fr, fc);  // read source frame
    const dst = inspectorFrameCellMatrix(tr, tc);  // read destination frame

    if (mode === "swap") {
        writeFrameCellMatrix(tr, tc, src);  // write source → destination
        writeFrameCellMatrix(fr, fc, dst);  // write destination → source
    } else {
        writeFrameCellMatrix(tr, tc, src);  // replace: overwrite destination only
    }
}
```

Two modes: **swap** (exchange both frames' cells) or **replace** (overwrite destination, leave source unchanged).

---

## PART 3: How Does the Game Engine Slice the XP?

### 3.1 The WASM Injection Path

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:859-898`

When the workbench injects an XP into the WASM game engine:

1. The XP file bytes (Uint8Array) are written to the Emscripten virtual filesystem at `/sprites/player-XXXX.xp` (for each override name)
2. `win.Load("player")` is called — this tells the C++ engine to reload the player sprite
3. `win.Resize(null)` is called — forces a display refresh
4. Auto-newgame pulses from the bootstrap handle menu advancement

```javascript
async function injectXpBytesIntoWebbuild(win, xpBytes, opts = {}) {
    const names = normalizeWebbuildOverrideNames(opts.override_names);
    for (const name of names) {
        emfsReplaceFile(M, `/sprites/${name}`, xpBytes);
    }
    win.Load(playerName);   // C++ engine reloads sprite atlas
    win.Resize(null);       // refresh display
}
```

For bundles (`injectBundleIntoWebbuild`, line 909-934), each action (idle/attack/death) has its own XP bytes and override filenames. The same XP bytes are written under multiple filenames in `/sprites/`.

### 3.2 How the C++ Engine Determines Frame Layout

The C++ engine reads the .xp file and extracts metadata from Layer 0 using the same glyph-digit encoding:

1. **Load the XP file** — decompress gzip, parse binary format (column-major cell data)
2. **Read L0 row 0** — extract angle count from cell (0,0), then scan cells (1,0), (2,0), etc. for animation frame counts
3. **Compute frame grid:**
   - `frameRows = angles` (e.g., 8)
   - `frameCols = sum(anims) * projs` (e.g., 9 * 2 = 18 for player)
   - `cellW = canvasWidth / frameCols` (e.g., 126 / 18 = 7)
   - `cellH = canvasHeight / frameRows` (e.g., 80 / 8 = 10)

4. **Frame indexing:** To render angle A, frame F, projection P:
   ```
   col = F + (P * sum_of_all_anim_frames)
   row = A
   x_start = col * cellW
   y_start = row * cellH
   ```

### 3.3 Player Skin Layout Example (126x80, 8 angles, [1,8] anims, 2 projs)

```
         Proj 0 (cols 0-8)                    Proj 1 (cols 9-17)
         idle  walk×8                         idle  walk×8
         F0    F0 F1 F2 F3 F4 F5 F6 F7       F0    F0 F1 F2 F3 F4 F5 F6 F7
Angle 0  [7×10][7×10]×8                      [7×10][7×10]×8
Angle 1  ...                                 ...
Angle 2  ...                                 ...
Angle 3  ...                                 ...
Angle 4  ...                                 ...
Angle 5  ...                                 ...
Angle 6  ...                                 ...
Angle 7  ...                                 ...
```

Total: 18 cols × 8 rows = 144 frames, each 7 chars wide × 10 chars tall = 126×80 canvas.

### 3.4 Layer 1 — Height Encoding

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1215-1230`

```python
def _build_native_l1_layer(cols: int, rows: int) -> list[Cell]:
    ANIM_BG = (255, 255, 255)  # white background
    ANIM_FG = (0, 0, 0)        # black foreground
    for y in range(rows):
        index_val = NATIVE_CELL_H - 1 - (y % NATIVE_CELL_H)  # 9,8,7,6,5,4,3,2,1,0 repeating
        glyph = _digit_to_glyph(index_val)  # '9','8','7','6','5','4','3','2','1','0'
        cell = (glyph, ANIM_FG, ANIM_BG)
        for _x in range(cols):
            layer.append(cell)  # same cell across entire row
```

**Verified from actual file (player-0100.xp L1, cols 0-2, rows 0-11):**

```
Row  0: glyph 57('9'), 57, 57   — all cells same
Row  1: glyph 56('8'), 56, 56
Row  2: glyph 55('7'), 55, 55
Row  3: glyph 54('6'), 54, 54
Row  4: glyph 53('5'), 53, 53
Row  5: glyph 52('4'), 52, 52
Row  6: glyph 51('3'), 51, 51
Row  7: glyph 50('2'), 50, 50
Row  8: glyph 49('1'), 49, 49
Row  9: glyph 48('0'), 48, 48
Row 10: glyph 57('9'), 57, 57   — REPEATS! (period = NATIVE_CELL_H = 10)
Row 11: glyph 56('8'), 56, 56
```

All cells: fg=#000000, bg=#ffffff (white).

**L1 is a repeating 9→0 countdown, uniform across all columns.** Each row within a frame cell gets a different height value. The C++ engine uses this to determine the vertical stacking/depth of each row within a character cell. Row 0 of a frame = height 9 (top/back), row 9 = height 0 (bottom/front). This creates the pseudo-3D isometric effect where higher rows appear behind lower rows.

**Note:** For plydie (cell_h=11), the L1 pattern still uses NATIVE_CELL_H=10 as the cycle period, meaning the countdown wraps within the 11-row frame (9,8,7,6,5,4,3,2,1,0,9). The comment in the code acknowledges this: "death cell_h=11 != NATIVE_CELL_H=10; L1 cycle period difference deferred to Phase 2."

### 3.5 Layer Structure Summary

| Layer | Name | Player | Attack | Plydie | Purpose |
|-------|------|--------|--------|--------|---------|
| 0 | Metadata | Yellow fill + 7 metadata glyphs | Yellow fill + border art + metadata | Same as attack | Angle/frame counts, frame boundaries |
| 1 | Height | 9→0 countdown, white bg | 9→0 countdown, white bg | 9→0 countdown, white bg | Vertical depth encoding |
| 2 | Visual | Sprite art | Sprite art | Sprite art | The actual rendered sprite glyphs+colors |
| 3 | Swoosh | Transparent (empty) | Transparent (empty) | N/A (only 3 layers) | Attack trails, VFX overlays |

### 3.6 Rendering Order

The game engine renders sprites using the layer stack:
1. **L0 is never rendered visually** — it is metadata-only
2. **L1 provides height/depth** — determines z-ordering of each character row
3. **L2 is the visible sprite** — the glyph and colors that appear on screen
4. **L3 (if present) overlays** on top of L2 — used for swoosh/trail effects during attacks

For each animation frame, the engine:
1. Determines the current angle from the player's facing direction (0-7)
2. Determines the current frame from the animation timer
3. Looks up the frame rect: `x = col * cellW, y = angle * cellH, w = cellW, h = cellH`
4. Reads L2 cells from that rect for visual rendering
5. Reads L1 cells from the same rect for height/depth ordering
6. If L3 exists and has non-transparent cells, overlays them on top

### 3.7 The Workbench buildMetadataLayerCells() (L0 in the editor)

**Source:** `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:1875-1884`

```javascript
function buildMetadataLayerCells() {
    const count = state.gridCols * state.gridRows;
    const layer = [];
    for (let i = 0; i < count; i++) layer.push(transparentCell(i));
    // Cell (0,0) = angle count as digit glyph
    layer[0] = { idx: 0, glyph: digitGlyph(state.angles), fg: [255,255,255], bg: [0,0,0] };
    // Cells (1,0), (2,0), ... = anim frame counts
    for (let i = 0; i < state.anims.length && i + 1 < state.gridCols; i++) {
        layer[i + 1] = { idx: i+1, glyph: digitGlyph(state.anims[i]), fg: [255,255,255], bg: [0,0,0] };
    }
    return layer;
}
```

**IMPORTANT DIFFERENCE:** The workbench builds a simplified L0 with just the metadata cells on a transparent background (magenta). It does NOT reproduce the dense border art from the native reference files. The native L0 reference is used during the final pipeline export via `_load_reference_l0()` to ensure the exported XP has the exact L0 pattern the C++ engine expects.

---

## APPENDIX: Key File References

| File | Purpose |
|------|---------|
| `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/xp_codec.py` | XP binary read/write (column-major ↔ row-major) |
| `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1193-1320` | Native layer builders (L0, L1, L2, L3 per family) |
| `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:949-986` | L0 reference loader from template registry |
| `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/service.py:1146-1151` | _digit_to_glyph encoder |
| `/Users/r/Downloads/asciicker-pipeline-v2/src/pipeline_v2/gates.py:69-82` | G12 L0 metadata validation gate |
| `/Users/r/Downloads/asciicker-pipeline-v2/scripts/rex_mcp/xp_core.py:241-292` | get_metadata() — L0 row 0 parser |
| `/Users/r/Downloads/asciicker-pipeline-v2/scripts/xp_mcp_server.py:443-494` | set_metadata() — L0 row 0 writer |
| `/Users/r/Downloads/asciicker-pipeline-v2/config/template_registry.json` | Family dimension contracts (dims, angles, frames, cell sizes) |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:1647-1657` | recomputeFrameGeometry() |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:2381-2407` | inspectorFrameCellMatrix / writeFrameCellMatrix |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:4851-4872` | swapRowBlocks (row reorder) |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:4828-4837` | clearFrame (delete) |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:5039-5078` | copy/paste frame |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:5112-5150` | drag-and-drop swap/replace |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:859-898` | injectXpBytesIntoWebbuild (WASM injection) |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:1875-1884` | buildMetadataLayerCells (workbench simplified L0) |
| `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js:1894-1912` | syncLayersFromSessionCells (4-layer assembly) |
| `/Users/r/Downloads/asciicker-pipeline-v2/sprites/player-0100.xp` | Reference player XP (126x80, 4 layers) |
| `/Users/r/Downloads/asciicker-pipeline-v2/sprites/attack-0001.xp` | Reference attack XP (144x80, 4 layers) |
| `/Users/r/Downloads/asciicker-pipeline-v2/sprites/plydie-0000.xp` | Reference death XP (110x88, 3 layers) |
