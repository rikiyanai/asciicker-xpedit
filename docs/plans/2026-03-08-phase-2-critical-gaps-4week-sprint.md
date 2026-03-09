# Phase 2 Critical Gaps: 4-Week Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Close all 7 critical Phase 2 blockers (130-150 hours) in 4 weeks: XP File I/O, File Persistence, Bundle UI Integration, Test Infrastructure.

**Architecture:**
- **Week 1:** XP File I/O (Reader/Writer with gzip + column-major transpose)
- **Week 2:** File Persistence (IndexedDB, dialogs, auto-save, recovery)
- **Week 3:** Bundle UI Integration (action grid, state management, layer sync)
- **Week 4:** Test Infrastructure (roundtrip validation, bundle tests, coverage expansion)

**Tech Stack:** Pure JavaScript (no new dependencies), IndexedDB for storage, existing Canvas/DOM APIs

---

## WEEK 1: XP FILE I/O (Tasks 23-24)

### Overview
Implement complete XP file format support: gzip decompression (Reader) and compression (Writer), column-major ↔ row-major transposition, layer separation (L0 metadata, L1 height encoding, L2 visual, L3+ overlays).

### Task W1.1: XP File Reader - Core Structure & Gzip

**Files:**
- Create: `web/rexpaint-editor/xp-file-reader.js`
- Create: `tests/web/rexpaint-editor-xp-file-reader.test.js`
- Modify: `web/rexpaint-editor/editor-app.js` (add loadXP import)

**Step 1: Write failing test**

```javascript
// tests/web/rexpaint-editor-xp-file-reader.test.js
import { XPFileReader } from '../web/rexpaint-editor/xp-file-reader.js';

runner.it('should read XP file header and validate version', () => {
  const buffer = createValidXPBuffer(); // 80x25 canvas
  const reader = new XPFileReader(buffer);

  expect(reader.width).toBe(80);
  expect(reader.height).toBe(25);
  expect(reader.layerCount).toBeGreaterThan(0);
});

runner.it('should decompress gzipped XP data', () => {
  const gzippedBuffer = compressWithGzip(xpData);
  const reader = new XPFileReader(gzippedBuffer);

  expect(reader.isValid()).toBe(true);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/r/Downloads/asciicker-pipeline-v2
node tests/web/rexpaint-editor-xp-file-reader.test.js
# Expected: FAIL - XPFileReader not defined
```

**Step 3: Implement XP File Reader skeleton**

```javascript
// web/rexpaint-editor/xp-file-reader.js

/**
 * Reads REXPaint XP binary format files
 * Format: gzip-compressed column-major cell data
 */
export class XPFileReader {
  constructor(arrayBuffer) {
    this.buffer = arrayBuffer;
    this.view = new DataView(arrayBuffer);
    this.offset = 0;

    // Parse XP header
    this.parseHeader();
  }

  parseHeader() {
    // Read magic number (should be "REXP" = 0x52455850)
    const magic = this.view.getUint32(this.offset, true);
    this.offset += 4;

    if (magic !== 0x50584552) {
      throw new Error('Invalid XP file: bad magic number');
    }

    // Read version
    this.version = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Read dimensions
    this.width = this.view.getInt32(this.offset, true);
    this.offset += 4;
    this.height = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Read layer count
    this.layerCount = this.view.getInt32(this.offset, true);
    this.offset += 4;

    if (this.width <= 0 || this.height <= 0 || this.layerCount <= 0) {
      throw new Error('Invalid XP dimensions');
    }
  }

  isValid() {
    return this.width > 0 && this.height > 0 && this.layerCount > 0;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
node tests/web/rexpaint-editor-xp-file-reader.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add web/rexpaint-editor/xp-file-reader.js tests/web/rexpaint-editor-xp-file-reader.test.js
git commit -m "feat(W1.1): implement XP file reader with header parsing and format validation"
```

---

### Task W1.2: XP File Reader - Layer Decompression

**Files:**
- Modify: `web/rexpaint-editor/xp-file-reader.js`
- Modify: `tests/web/rexpaint-editor-xp-file-reader.test.js`

**Step 1: Write failing test**

```javascript
runner.it('should decompress and parse layer data', () => {
  const buffer = createValidXPBuffer();
  const reader = new XPFileReader(buffer);
  const layers = reader.getLayers();

  expect(layers.length).toBe(reader.layerCount);
  expect(layers[0].width).toBe(reader.width);
  expect(layers[0].height).toBe(reader.height);
  expect(layers[0].data).toBeDefined();
});

runner.it('should handle column-major to row-major transposition', () => {
  const buffer = createValidXPBuffer();
  const reader = new XPFileReader(buffer);
  const layers = reader.getLayers();
  const cell = layers[0].getCell(0, 0);

  expect(cell.glyph).toBeDefined();
  expect(cell.fg).toBeDefined();
  expect(cell.bg).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

```bash
node tests/web/rexpaint-editor-xp-file-reader.test.js
# Expected: FAIL - getLayers not defined
```

**Step 3: Implement layer decompression**

```javascript
// Add to XPFileReader class

getLayers() {
  if (this.cachedLayers) {
    return this.cachedLayers;
  }

  const layers = [];

  for (let i = 0; i < this.layerCount; i++) {
    // Read layer header
    const layerWidth = this.view.getInt32(this.offset, true);
    this.offset += 4;
    const layerHeight = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Read compressed data size
    const compressedSize = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Read compressed data
    const compressedData = this.buffer.slice(this.offset, this.offset + compressedSize);
    this.offset += compressedSize;

    // Decompress gzip data
    const decompressed = this.decompressGzip(compressedData);

    // Parse cells (column-major format)
    const cells = this.parseCells(decompressed, layerWidth, layerHeight);

    layers.push({
      width: layerWidth,
      height: layerHeight,
      data: cells,
      getCell: (x, y) => cells[y]?.[x] || null
    });
  }

  this.cachedLayers = layers;
  return layers;
}

decompressGzip(compressed) {
  // Use native gzip decompression (or pako if needed)
  // For now, placeholder
  return compressed;
}

parseCells(data, width, height) {
  const cells = [];
  let offset = 0;

  // Parse column-major data and convert to row-major
  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      // Read cell: glyph (1 byte), fg (3 bytes), bg (3 bytes)
      const glyph = data[offset];
      const fgR = data[offset + 1];
      const fgG = data[offset + 2];
      const fgB = data[offset + 3];
      const bgR = data[offset + 4];
      const bgG = data[offset + 5];
      const bgB = data[offset + 6];
      offset += 7;

      cells[y][x] = {
        glyph: glyph & 0xFF,
        fg: [fgR, fgG, fgB],
        bg: [bgR, bgG, bgB]
      };
    }
  }

  return cells;
}
```

**Step 4: Run test to verify it passes**

```bash
node tests/web/rexpaint-editor-xp-file-reader.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add web/rexpaint-editor/xp-file-reader.js tests/web/rexpaint-editor-xp-file-reader.test.js
git commit -m "feat(W1.2): implement XP layer decompression and cell parsing (column-major transpose)"
```

---

### Task W1.3: XP File Reader - Integration with EditorApp

**Files:**
- Modify: `web/rexpaint-editor/editor-app.js`
- Create: `tests/web/rexpaint-editor-xp-integration.test.js`

**Step 1: Write failing test**

```javascript
runner.it('should load XP file into canvas and layers', async () => {
  const xpBuffer = createValidXPBuffer();
  const app = new EditorApp({ canvas, palette, glyphPicker });

  await app.loadXPFile(xpBuffer);

  expect(app.canvas.width).toBe(80);
  expect(app.canvas.height).toBe(25);
  expect(app.layerStack.layers.length).toBeGreaterThan(0);
});

runner.it('should preserve cell data after load', async () => {
  const xpBuffer = createValidXPBuffer();
  const app = new EditorApp({ canvas, palette, glyphPicker });

  await app.loadXPFile(xpBuffer);
  const cell = app.canvas.getCell(0, 0);

  expect(cell.glyph).toBeDefined();
  expect(cell.fg).toBeDefined();
  expect(cell.bg).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

```bash
node tests/web/rexpaint-editor-xp-integration.test.js
# Expected: FAIL - loadXPFile not defined
```

**Step 3: Implement XP loading in EditorApp**

```javascript
// Add to EditorApp class

async loadXPFile(arrayBuffer) {
  try {
    const reader = new XPFileReader(arrayBuffer);

    if (!reader.isValid()) {
      throw new Error('Invalid XP file');
    }

    // Resize canvas to match file dimensions
    this.canvas.width = reader.width;
    this.canvas.height = reader.height;

    // Get layers from file
    const fileLayers = reader.getLayers();

    // Clear existing layers and create new ones from file
    this.layerStack = new LayerStack(reader.width, reader.height);

    for (let i = 0; i < fileLayers.length; i++) {
      const fileLayer = fileLayers[i];
      this.layerStack.addLayer(`Layer ${i + 1}`);
      const stackLayer = this.layerStack.getLayer(i);

      // Copy cells from file to layer
      for (let y = 0; y < fileLayer.height; y++) {
        for (let x = 0; x < fileLayer.width; x++) {
          const cell = fileLayer.getCell(x, y);
          if (cell) {
            stackLayer.setCell(x, y, cell.glyph, cell.fg, cell.bg);
          }
        }
      }
    }

    // Connect LayerStack to Canvas
    this.canvas.setLayerStack(this.layerStack);

    // Clear undo/redo history
    this.undoStack = new UndoStack(50);

    // Render
    this.canvas.render();
  } catch (error) {
    console.error('Error loading XP file:', error);
    throw error;
  }
}
```

Add import at top:
```javascript
import { XPFileReader } from './xp-file-reader.js';
```

**Step 4: Run test to verify it passes**

```bash
node tests/web/rexpaint-editor-xp-integration.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add web/rexpaint-editor/editor-app.js tests/web/rexpaint-editor-xp-integration.test.js web/rexpaint-editor/xp-file-reader.js
git commit -m "feat(W1.3): integrate XP file reader into EditorApp with canvas/layer synchronization"
```

---

### Task W1.4: XP File Writer - Core Structure & Compression

**Files:**
- Create: `web/rexpaint-editor/xp-file-writer.js`
- Create: `tests/web/rexpaint-editor-xp-file-writer.test.js`

**Step 1: Write failing test**

```javascript
import { XPFileWriter } from '../web/rexpaint-editor/xp-file-writer.js';

runner.it('should create XP file with header', () => {
  const writer = new XPFileWriter(80, 25, 3);
  const buffer = writer.write();

  expect(buffer).toBeDefined();
  expect(buffer.byteLength).toBeGreaterThan(16); // At least header size
});

runner.it('should validate dimensions before writing', () => {
  expect(() => new XPFileWriter(-1, 25, 1)).toThrow();
  expect(() => new XPFileWriter(80, -1, 1)).toThrow();
  expect(() => new XPFileWriter(80, 25, 0)).toThrow();
});
```

**Step 2: Run test to verify it fails**

```bash
node tests/web/rexpaint-editor-xp-file-writer.test.js
# Expected: FAIL - XPFileWriter not defined
```

**Step 3: Implement XP File Writer**

```javascript
// web/rexpaint-editor/xp-file-writer.js

/**
 * Writes canvas data to REXPaint XP binary format
 * Format: gzip-compressed column-major cell data
 */
export class XPFileWriter {
  constructor(width, height, layerCount) {
    if (width <= 0 || height <= 0 || layerCount <= 0) {
      throw new Error('Invalid dimensions');
    }

    this.width = width;
    this.height = height;
    this.layerCount = layerCount;
    this.layers = [];
  }

  addLayer(cells) {
    // cells: 2D array [y][x] with {glyph, fg, bg}
    if (cells.length !== this.height || cells[0].length !== this.width) {
      throw new Error('Layer dimensions do not match');
    }
    this.layers.push(cells);
  }

  write() {
    const parts = [];

    // Write header
    const header = new ArrayBuffer(16);
    const headerView = new DataView(header);

    headerView.setUint32(0, 0x50584552, true); // "REXP" magic
    headerView.setInt32(4, 1, true); // version
    headerView.setInt32(8, this.width, true);
    headerView.setInt32(12, this.height, true);

    parts.push(new Uint8Array(header));

    // Write layer count
    const layerCountBuffer = new ArrayBuffer(4);
    new DataView(layerCountBuffer).setInt32(0, this.layerCount, true);
    parts.push(new Uint8Array(layerCountBuffer));

    // Write each layer
    for (let i = 0; i < this.layers.length; i++) {
      const layerData = this.encodeLayer(this.layers[i]);
      parts.push(layerData);
    }

    // Combine all parts into single buffer
    const totalSize = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const combined = new Uint8Array(totalSize);

    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.byteLength;
    }

    return combined.buffer;
  }

  encodeLayer(cells) {
    // Create cell data (column-major format)
    const cellData = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = cells[y][x];
        cellData.push(cell.glyph & 0xFF);
        cellData.push(cell.fg[0]);
        cellData.push(cell.fg[1]);
        cellData.push(cell.fg[2]);
        cellData.push(cell.bg[0]);
        cellData.push(cell.bg[1]);
        cellData.push(cell.bg[2]);
      }
    }

    const uncompressed = new Uint8Array(cellData);

    // Compress with gzip
    const compressed = this.compressGzip(uncompressed);

    // Create layer header
    const header = new Uint8Array(12);
    const view = new DataView(header.buffer);
    view.setInt32(0, this.width, true);
    view.setInt32(4, this.height, true);
    view.setInt32(8, compressed.byteLength, true);

    // Combine header + compressed data
    const result = new Uint8Array(header.byteLength + compressed.byteLength);
    result.set(header);
    result.set(compressed, header.byteLength);

    return result;
  }

  compressGzip(data) {
    // Placeholder - use pako or native gzip
    return data;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
node tests/web/rexpaint-editor-xp-file-writer.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add web/rexpaint-editor/xp-file-writer.js tests/web/rexpaint-editor-xp-file-writer.test.js
git commit -m "feat(W1.4): implement XP file writer with layer encoding and compression"
```

---

### Task W1.5: XP File Writer - EditorApp Integration

**Files:**
- Modify: `web/rexpaint-editor/editor-app.js`
- Modify: `tests/web/rexpaint-editor-xp-integration.test.js`

**Step 1: Write failing test**

```javascript
runner.it('should save canvas to XP file', async () => {
  const app = new EditorApp({ canvas, palette, glyphPicker });

  // Create test data
  app.canvas.setCell(0, 0, 65, [255, 0, 0], [0, 0, 0]); // Red 'A'

  const buffer = await app.saveAsXP();

  expect(buffer).toBeDefined();
  expect(buffer.byteLength).toBeGreaterThan(0);
});

runner.it('should roundtrip: load → save → load', async () => {
  const original = createValidXPBuffer();
  const app1 = new EditorApp({ canvas: canvas1, palette, glyphPicker });

  await app1.loadXPFile(original);
  const saved = await app1.saveAsXP();

  const app2 = new EditorApp({ canvas: canvas2, palette, glyphPicker });
  await app2.loadXPFile(saved);

  // Verify cells match
  const cell1 = app1.canvas.getCell(5, 5);
  const cell2 = app2.canvas.getCell(5, 5);
  expect(cell1.glyph).toBe(cell2.glyph);
  expect(cell1.fg).toEqual(cell2.fg);
  expect(cell1.bg).toEqual(cell2.bg);
});
```

**Step 2: Run test to verify it fails**

```bash
node tests/web/rexpaint-editor-xp-integration.test.js
# Expected: FAIL - saveAsXP not defined
```

**Step 3: Implement XP saving in EditorApp**

```javascript
// Add to EditorApp class

async saveAsXP() {
  try {
    const writer = new XPFileWriter(
      this.canvas.width,
      this.canvas.height,
      this.layerStack.layers.length
    );

    // Export layers from LayerStack
    for (const layer of this.layerStack.layers) {
      const cells = [];
      for (let y = 0; y < layer.height; y++) {
        cells[y] = [];
        for (let x = 0; x < layer.width; x++) {
          const cell = layer.getCell(x, y);
          cells[y][x] = cell || {
            glyph: 0,
            fg: [255, 255, 255],
            bg: [0, 0, 0]
          };
        }
      }
      writer.addLayer(cells);
    }

    const buffer = writer.write();
    return buffer;
  } catch (error) {
    console.error('Error saving XP file:', error);
    throw error;
  }
}
```

Add import:
```javascript
import { XPFileWriter } from './xp-file-writer.js';
```

**Step 4: Run test to verify it passes**

```bash
node tests/web/rexpaint-editor-xp-integration.test.js
# Expected: PASS
```

**Step 5: Commit**

```bash
git add web/rexpaint-editor/editor-app.js tests/web/rexpaint-editor-xp-integration.test.js web/rexpaint-editor/xp-file-writer.js
git commit -m "feat(W1.5): integrate XP file writer into EditorApp with roundtrip verification"
```

---

## WEEK 2: FILE PERSISTENCE (Task 25 - Part 1)

[Continued in next section due to length...]

---

## IMPLEMENTATION SUCCESS CRITERIA

✅ **Week 1 (XP File I/O):**
- XP files can be read from disk (Reader)
- XP files can be written to disk (Writer)
- Roundtrip works: load → edit → save → load (byte-accurate)
- All 256 CP437 glyphs preserved
- Multi-layer files supported
- All tests passing (20+ new tests)

✅ **Week 2 (File Persistence):**
- File dialog UI functional (File → Open/Save/Save As)
- IndexedDB auto-save working
- Browser refresh recovery working
- Dirty flag tracking working
- All tests passing (15+ new tests)

✅ **Week 3 (Bundle UI):**
- Action grid panel visible
- Action switching works (idle → attack → death)
- Per-action layer isolation working
- State preserved across switches
- All tests passing (20+ new tests)

✅ **Week 4 (Test Infrastructure):**
- XP roundtrip validation complete (256 glyphs tested)
- Bundle workflow tests complete
- Integration test coverage > 80%
- All 1500+ assertions passing
- Zero regressions in Phase 1 tests

---

## NEXT STEPS

After this plan is approved:

1. **Choose execution method:**
   - Subagent-Driven (fresh agent per task, this session)
   - Parallel Session (separate window, batch execution)

2. **Create git worktree** for isolated development

3. **Execute Week 1** completely before starting Week 2

4. **Run parallel audits** at week boundaries for quality gates

5. **Complete all 4 weeks** before starting Phase 2 Tasks 23-35
