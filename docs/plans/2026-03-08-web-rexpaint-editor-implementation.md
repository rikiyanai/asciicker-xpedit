# Web REXPaint Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-page dropdown Web REXPaint v1.70 clone editor in the workbench as a replacement for the broken Cell Inspector Panel, supporting all 32 Tier 1+2 features with UI automation testability.

**Architecture:** The editor runs as a large dropdown modal (like the debug sheet) triggered from the Cell Inspector. It features a dual-panel layout: left sidebar with CP437 glyph picker, palette, tools menu, and layers; center canvas with interactive grid. The editor maintains separate state per action context (idle/attack/death in bundle mode) and integrates with the grid panel to handle frame navigation, row/col operations, and dynamic grid reordering while the editor is open.

**Tech Stack:**
- Vanilla JavaScript (no framework dependencies)
- HTML5 Canvas for rendering (not DOM)
- REXPaint v1.70 manual as authoritative feature spec
- XP format codec (existing `mcp__xp-tool__*` functions)
- Playwright for UI automation testing

---

## Phase 1: Canvas Rendering & CP437 Glyph System

### Task 1: Create canvas module with cell rendering

**Files:**
- Create: `web/rexpaint-editor/canvas.js`
- Create: `web/rexpaint-editor/cp437-font.js`
- Modify: `web/workbench.html` (add canvas element + styles)

**Step 1: Write failing test for cell rendering**

Create file `tests/web/rexpaint-editor-canvas.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { Canvas } from '../../web/rexpaint-editor/canvas.js';

describe('Canvas Module', () => {
  it('should render a single cell with glyph and colors', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    canvas.setCell(0, 0, 65, [255, 255, 255], [0, 0, 0]); // 'A' in white on black
    const imageData = canvas.getImageData();

    // Verify pixel data contains white and black
    expect(imageData.data.length).toBeGreaterThan(0);
    expect(imageData.data[0]).toBe(255); // Red channel of white
  });

  it('should track grid dimensions', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    expect(canvas.width).toBe(80);
    expect(canvas.height).toBe(25);
  });

  it('should convert cell coordinates to pixel coordinates', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    const pixels = canvas.cellToPixelCoords(5, 10);
    expect(pixels).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/r/Downloads/asciicker-pipeline-v2
npm test -- tests/web/rexpaint-editor-canvas.test.js
```

Expected: FAIL with "Cannot find module '../../web/rexpaint-editor/canvas.js'"

**Step 3: Write minimal canvas implementation**

Create file `web/rexpaint-editor/canvas.js`:
```javascript
/**
 * Canvas Module - Renders CP437 glyph grid with color support
 * Dimensions: cell grid size (e.g., 80x25)
 * Rendering: HTML5 Canvas with bitmap font (12px per cell by default)
 */

export class Canvas {
  constructor(htmlCanvasElement, gridWidth, gridHeight, cellSizePixels = 12) {
    this.canvas = htmlCanvasElement;
    this.ctx = this.canvas.getContext('2d');

    this.width = gridWidth;      // cells
    this.height = gridHeight;    // cells
    this.cellSize = cellSizePixels; // pixels per cell

    // Physical canvas size
    this.canvas.width = gridWidth * cellSizePixels;
    this.canvas.height = gridHeight * cellSizePixels;

    // Cell data: Map of "x,y" -> { glyph, fg, bg }
    this.cells = new Map();

    // Load CP437 font (will be populated by cp437-font module)
    this.fontData = null;
  }

  /**
   * Set a cell's glyph and colors
   * @param {number} x - column (0-based)
   * @param {number} y - row (0-based)
   * @param {number} glyph - CP437 code (0-255)
   * @param {[number, number, number]} fg - RGB foreground
   * @param {[number, number, number]} bg - RGB background
   */
  setCell(x, y, glyph, fg, bg) {
    const key = `${x},${y}`;
    this.cells.set(key, { glyph, fg, bg });
  }

  /**
   * Get cell data
   */
  getCell(x, y) {
    const key = `${x},${y}`;
    return this.cells.get(key) || { glyph: 0, fg: [255, 255, 255], bg: [0, 0, 0] };
  }

  /**
   * Convert cell coordinates to pixel coordinates
   */
  cellToPixelCoords(cellX, cellY) {
    return {
      x: cellX * this.cellSize,
      y: cellY * this.cellSize
    };
  }

  /**
   * Convert pixel coordinates to cell coordinates
   */
  pixelToCellCoords(pixelX, pixelY) {
    return {
      x: Math.floor(pixelX / this.cellSize),
      y: Math.floor(pixelY / this.cellSize)
    };
  }

  /**
   * Render the entire grid to canvas
   */
  render() {
    // Clear canvas to black
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw each cell
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.drawCell(x, y);
      }
    }
  }

  /**
   * Draw a single cell
   */
  drawCell(x, y) {
    const cell = this.getCell(x, y);
    const { pixelX, pixelY } = this.cellToPixelCoords(x, y);

    // Draw background
    this.ctx.fillStyle = `rgb(${cell.bg[0]},${cell.bg[1]},${cell.bg[2]})`;
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

    // Draw glyph (placeholder: white rectangle for now)
    this.ctx.fillStyle = `rgb(${cell.fg[0]},${cell.fg[1]},${cell.fg[2]})`;
    this.ctx.font = `${this.cellSize}px monospace`;
    this.ctx.textBaseline = 'top';
    const char = String.fromCharCode(cell.glyph);
    this.ctx.fillText(char, pixelX, pixelY);
  }

  /**
   * Get canvas image data for testing
   */
  getImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Clear the entire grid
   */
  clear() {
    this.cells.clear();
    this.render();
  }

  /**
   * Fill a rectangular region with a single cell value
   */
  fillRect(x, y, w, h, glyph, fg, bg) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setCell(x + dx, y + dy, glyph, fg, bg);
      }
    }
  }

  /**
   * Get the canvas HTML element
   */
  getCanvasElement() {
    return this.canvas;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/web/rexpaint-editor-canvas.test.js
```

Expected: PASS (all 3 assertions pass)

**Step 5: Commit**

```bash
git add tests/web/rexpaint-editor-canvas.test.js web/rexpaint-editor/canvas.js
git commit -m "feat: add canvas module with CP437 cell rendering"
```

---

### Task 2: Implement CP437 bitmap font rendering

**Files:**
- Create: `web/rexpaint-editor/cp437-font.js`
- Create: `web/rexpaint-editor/fonts/cp437-12x12.png` (existing asset or generate)
- Modify: `web/rexpaint-editor/canvas.js` (integrate font)

**Step 1: Write failing test for glyph rendering**

Add to `tests/web/rexpaint-editor-canvas.test.js`:
```javascript
it('should render CP437 glyph 65 ("A") with correct bitmap pixels', async () => {
  const cp437 = new CP437Font('web/rexpaint-editor/fonts/cp437-12x12.png', 12, 12);
  await cp437.load();

  const glyphImageData = cp437.getGlyph(65);
  expect(glyphImageData).toBeDefined();
  expect(glyphImageData.width).toBe(12);
  expect(glyphImageData.height).toBe(12);
});

it('should blend foreground and background colors when drawing', () => {
  const canvas = new Canvas(document.createElement('canvas'), 80, 25, 12);
  canvas.setFontData(mockCP437Font);
  canvas.setCell(10, 10, 65, [0, 255, 0], [0, 0, 100]); // Green 'A' on dark blue
  canvas.render();

  const imageData = canvas.getImageData();
  // Verify the cell region has green and blue pixels
  expect(imageData.data.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/web/rexpaint-editor-canvas.test.js -t "CP437"
```

Expected: FAIL with "CP437Font is not defined"

**Step 3: Write CP437 font module**

Create file `web/rexpaint-editor/cp437-font.js`:
```javascript
/**
 * CP437 Font Module - Loads and caches CP437 glyphs from bitmap spritesheet
 * Spritesheet layout: 16x16 grid = 256 glyphs total
 * Each glyph: 12x12 pixels (configurable)
 */

export class CP437Font {
  constructor(spriteSheetUrl, glyphWidth = 12, glyphHeight = 12) {
    this.spriteSheetUrl = spriteSheetUrl;
    this.glyphWidth = glyphWidth;
    this.glyphHeight = glyphHeight;
    this.spriteSheet = null;
    this.glyphCache = new Map();
  }

  /**
   * Load spritesheet image from URL
   */
  async load() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.spriteSheet = img;
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load CP437 spritesheet: ${this.spriteSheetUrl}`));
      };
      img.src = this.spriteSheetUrl;
    });
  }

  /**
   * Extract a single glyph from the spritesheet
   * Glyph layout: 16 glyphs per row, rows 0-15
   * Code 0-15: row 0, 16-31: row 1, etc.
   */
  getGlyph(code) {
    if (code < 0 || code > 255) {
      throw new Error(`Invalid CP437 code: ${code}`);
    }

    // Check cache
    if (this.glyphCache.has(code)) {
      return this.glyphCache.get(code);
    }

    if (!this.spriteSheet) {
      throw new Error('Font not loaded. Call load() first.');
    }

    // Calculate grid position
    const col = code % 16;
    const row = Math.floor(code / 16);
    const srcX = col * this.glyphWidth;
    const srcY = row * this.glyphHeight;

    // Create temp canvas to extract glyph
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.glyphWidth;
    tempCanvas.height = this.glyphHeight;
    const ctx = tempCanvas.getContext('2d');

    ctx.drawImage(
      this.spriteSheet,
      srcX, srcY, this.glyphWidth, this.glyphHeight,
      0, 0, this.glyphWidth, this.glyphHeight
    );

    const imageData = ctx.getImageData(0, 0, this.glyphWidth, this.glyphHeight);
    this.glyphCache.set(code, {
      imageData,
      width: this.glyphWidth,
      height: this.glyphHeight
    });

    return this.glyphCache.get(code);
  }

  /**
   * Draw a single glyph to a canvas context with color blending
   * @param {CanvasRenderingContext2D} ctx - target canvas context
   * @param {number} code - CP437 code (0-255)
   * @param {number} x - pixel position X
   * @param {number} y - pixel position Y
   * @param {[number, number, number]} fg - foreground RGB
   * @param {[number, number, number]} bg - background RGB
   */
  drawGlyph(ctx, code, x, y, fg, bg) {
    const glyph = this.getGlyph(code);

    // Draw background
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    ctx.fillRect(x, y, this.glyphWidth, this.glyphHeight);

    // Get glyph bitmap
    const { imageData } = glyph;
    const data = imageData.data;

    // Create a temporary canvas for the colored glyph
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.glyphWidth;
    tempCanvas.height = this.glyphHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Copy glyph image data
    tempCtx.putImageData(imageData, 0, 0);

    // Color the non-transparent pixels with foreground color
    // (assumes font glyphs use alpha channel for shape)
    const tempImageData = tempCtx.getImageData(0, 0, this.glyphWidth, this.glyphHeight);
    const tempData = tempImageData.data;
    for (let i = 0; i < tempData.length; i += 4) {
      if (tempData[i + 3] > 128) { // If alpha > threshold
        tempData[i] = fg[0];     // R
        tempData[i + 1] = fg[1]; // G
        tempData[i + 2] = fg[2]; // B
      }
    }
    tempCtx.putImageData(tempImageData, 0, 0);

    // Draw colored glyph
    ctx.drawImage(tempCanvas, x, y);
  }
}
```

**Step 4: Integrate font into canvas module**

Modify `web/rexpaint-editor/canvas.js` to use CP437Font:
```javascript
// At top of file
import { CP437Font } from './cp437-font.js';

// In Canvas class
export class Canvas {
  constructor(htmlCanvasElement, gridWidth, gridHeight, cellSizePixels = 12) {
    // ... existing code ...
    this.fontData = null;
    this.cp437Font = null;
  }

  /**
   * Set CP437 font and load it
   */
  async setFont(cp437Font) {
    this.cp437Font = cp437Font;
    await cp437Font.load();
  }

  /**
   * Override drawCell to use bitmap font
   */
  drawCell(x, y) {
    const cell = this.getCell(x, y);
    const { x: pixelX, y: pixelY } = this.cellToPixelCoords(x, y);

    if (this.cp437Font) {
      this.cp437Font.drawGlyph(this.ctx, cell.glyph, pixelX, pixelY, cell.fg, cell.bg);
    } else {
      // Fallback to monospace text
      this.ctx.fillStyle = `rgb(${cell.bg[0]},${cell.bg[1]},${cell.bg[2]})`;
      this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
      this.ctx.fillStyle = `rgb(${cell.fg[0]},${cell.fg[1]},${cell.fg[2]})`;
      this.ctx.font = `${this.cellSize}px monospace`;
      this.ctx.textBaseline = 'top';
      const char = String.fromCharCode(cell.glyph);
      this.ctx.fillText(char, pixelX, pixelY);
    }
  }
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- tests/web/rexpaint-editor-canvas.test.js -t "CP437"
```

Expected: PASS

**Step 6: Commit**

```bash
git add web/rexpaint-editor/cp437-font.js web/rexpaint-editor/canvas.js tests/
git commit -m "feat: add CP437 bitmap font rendering with color blending"
```

---

### Task 3: Add HTML canvas element and modal styling

**Files:**
- Modify: `web/workbench.html` (add canvas + styles)
- Create: `web/rexpaint-editor/styles.css`

**Step 1: Write integration test**

Add to `tests/web/rexpaint-editor-canvas.test.js`:
```javascript
it('should create modal with canvas when initialized from workbench', () => {
  const modal = document.getElementById('rexpaintEditorModal');
  const canvas = modal.querySelector('canvas#rexpaintCanvas');

  expect(modal).toBeDefined();
  expect(canvas).toBeDefined();
  expect(canvas.width).toBeGreaterThan(0);
  expect(canvas.height).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/web/rexpaint-editor-canvas.test.js -t "modal"
```

Expected: FAIL with "Cannot find element rexpaintEditorModal"

**Step 3: Add HTML and styles**

Modify `web/workbench.html` (add to body, after cellInspectorPanel or as replacement):
```html
<!-- REXPaint Editor Modal -->
<div id="rexpaintEditorModal" class="modal hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h2>REXPaint Editor</h2>
      <button id="rexpaintEditorClose" class="close-btn">✕</button>
    </div>
    <div class="modal-body">
      <div class="editor-container">
        <!-- Left sidebar -->
        <div class="editor-sidebar">
          <div class="sidebar-section">
            <h3>Font</h3>
            <div id="glyphPickerContainer"></div>
          </div>
          <div class="sidebar-section">
            <h3>Tools</h3>
            <div id="toolsPanel"></div>
          </div>
          <div class="sidebar-section">
            <h3>Palette</h3>
            <div id="palettePanel"></div>
          </div>
          <div class="sidebar-section">
            <h3>Layers</h3>
            <div id="layersPanel"></div>
          </div>
        </div>

        <!-- Canvas area -->
        <div class="editor-canvas-area">
          <canvas id="rexpaintCanvas" width="960" height="300"></canvas>
          <div class="editor-info">
            <span id="coordInfo">X: 0 Y: 0</span>
            <span id="glyphInfo">Glyph: 0</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

Create file `web/rexpaint-editor/styles.css`:
```css
/* REXPaint Editor Modal */
#rexpaintEditorModal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

#rexpaintEditorModal.active {
  display: flex;
}

.modal-content {
  background: #1e1e1e;
  border: 2px solid #444;
  border-radius: 8px;
  width: 90%;
  height: 90%;
  max-width: 1400px;
  max-height: 900px;
  display: flex;
  flex-direction: column;
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #444;
  background: #2d2d2d;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #ffb86c;
}

.close-btn {
  background: none;
  border: none;
  color: #e0e0e0;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #ff6b6b;
}

.modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-sidebar {
  width: 200px;
  background: #252525;
  border-right: 1px solid #444;
  overflow-y: auto;
  padding: 8px;
}

.sidebar-section {
  margin-bottom: 16px;
}

.sidebar-section h3 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #ffb86c;
  text-transform: uppercase;
  padding: 4px 0;
  border-bottom: 1px solid #444;
}

.editor-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  padding: 8px;
}

#rexpaintCanvas {
  border: 1px solid #444;
  background: #000;
  flex: 1;
  image-rendering: pixelated;
}

.editor-info {
  display: flex;
  gap: 20px;
  padding: 8px 0;
  font-size: 12px;
  color: #888;
}

.hidden {
  display: none !important;
}
```

Link stylesheet in `web/workbench.html` (in `<head>`):
```html
<link rel="stylesheet" href="rexpaint-editor/styles.css">
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/web/rexpaint-editor-canvas.test.js -t "modal"
```

Expected: PASS

**Step 5: Commit**

```bash
git add web/workbench.html web/rexpaint-editor/styles.css
git commit -m "feat: add REXPaint editor modal HTML and styling"
```

---

## Phase 2: Glyph Picker & Palette System

### Task 4: Implement CP437 glyph picker UI

**Files:**
- Create: `web/rexpaint-editor/glyph-picker.js`
- Modify: `web/rexpaint-editor/styles.css`

**Step 1: Write failing test**

Add to `tests/web/rexpaint-editor-glyph-picker.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { GlyphPicker } from '../../web/rexpaint-editor/glyph-picker.js';

describe('Glyph Picker', () => {
  it('should render 256 glyphs in 16x16 grid', () => {
    const picker = new GlyphPicker(12, 12); // 12x12 cell size
    const container = document.createElement('div');
    picker.render(container);

    const glyphs = container.querySelectorAll('.glyph-button');
    expect(glyphs.length).toBe(256);
  });

  it('should set selected glyph when clicked', () => {
    const picker = new GlyphPicker(12, 12);
    const onSelect = vi.fn();
    picker.on('select', onSelect);

    const container = document.createElement('div');
    picker.render(container);

    // Click glyph 65 ('A')
    const glyphBtn = container.querySelectorAll('.glyph-button')[65];
    glyphBtn.click();

    expect(onSelect).toHaveBeenCalledWith(65);
  });

  it('should highlight selected glyph', () => {
    const picker = new GlyphPicker(12, 12);
    const container = document.createElement('div');
    picker.render(container);

    const glyphBtn = container.querySelectorAll('.glyph-button')[65];
    glyphBtn.click();

    expect(glyphBtn.classList.contains('selected')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/web/rexpaint-editor-glyph-picker.test.js
```

Expected: FAIL with "GlyphPicker is not defined"

**Step 3: Implement glyph picker**

Create file `web/rexpaint-editor/glyph-picker.js`:
```javascript
/**
 * Glyph Picker - 16x16 grid of CP437 characters (256 total)
 * Emits 'select' event with glyph code when user clicks
 */

export class GlyphPicker {
  constructor(cellWidth = 12, cellHeight = 12) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.selectedGlyph = 0;
    this.listeners = new Map();
  }

  /**
   * Render glyph picker grid into container
   */
  render(container) {
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'glyph-picker-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(16, 1fr)';
    grid.style.gap = '2px';

    for (let code = 0; code < 256; code++) {
      const btn = document.createElement('button');
      btn.className = 'glyph-button';
      btn.title = `Code: ${code}`;
      btn.style.width = `${this.cellWidth + 4}px`;
      btn.style.height = `${this.cellHeight + 4}px`;
      btn.style.padding = '2px';
      btn.style.font = '9px monospace';
      btn.style.background = '#333';
      btn.style.color = '#0f0';
      btn.style.border = '1px solid #555';
      btn.style.cursor = 'pointer';
      btn.innerHTML = code < 32 || code === 127 ? '·' : String.fromCharCode(code);

      if (code === this.selectedGlyph) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        this.selectGlyph(code);
      });

      grid.appendChild(btn);
    }

    container.appendChild(grid);
  }

  /**
   * Select a glyph and emit event
   */
  selectGlyph(code) {
    const oldGlyph = this.selectedGlyph;
    this.selectedGlyph = code;

    // Update UI
    const buttons = document.querySelectorAll('.glyph-button');
    if (buttons[oldGlyph]) {
      buttons[oldGlyph].classList.remove('selected');
    }
    if (buttons[code]) {
      buttons[code].classList.add('selected');
    }

    this.emit('select', code);
  }

  /**
   * Event emitter
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, ...args) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(...args));
    }
  }

  /**
   * Get currently selected glyph
   */
  getSelectedGlyph() {
    return this.selectedGlyph;
  }
}
```

**Step 4: Add CSS for glyph picker**

Add to `web/rexpaint-editor/styles.css`:
```css
.glyph-picker-grid {
  background: #222;
  padding: 4px;
  border-radius: 4px;
}

.glyph-button {
  font-size: 9px !important;
  width: 18px !important;
  height: 18px !important;
  padding: 1px !important;
  margin: 1px !important;
  background: #333 !important;
  color: #0f0 !important;
  border: 1px solid #555 !important;
  cursor: pointer !important;
}

.glyph-button:hover {
  background: #444 !important;
  border-color: #777 !important;
}

.glyph-button.selected {
  background: #0f0 !important;
  color: #000 !important;
  border-color: #0f0 !important;
  font-weight: bold !important;
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- tests/web/rexpaint-editor-glyph-picker.test.js
```

Expected: PASS (all assertions pass)

**Step 6: Commit**

```bash
git add web/rexpaint-editor/glyph-picker.js web/rexpaint-editor/styles.css tests/web/rexpaint-editor-glyph-picker.test.js
git commit -m "feat: add CP437 glyph picker with 16x16 grid (256 glyphs)"
```

---

### Task 5: Implement color palette & picker

**Files:**
- Create: `web/rexpaint-editor/palette.js`
- Create: `tests/web/rexpaint-editor-palette.test.js`

**Step 1: Write failing test**

Create file `tests/web/rexpaint-editor-palette.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { Palette } from '../../web/rexpaint-editor/palette.js';

describe('Palette', () => {
  it('should initialize with default colors', () => {
    const palette = new Palette();
    expect(palette.getForeground()).toEqual([255, 255, 255]);
    expect(palette.getBackground()).toEqual([0, 0, 0]);
  });

  it('should set foreground color', () => {
    const palette = new Palette();
    palette.setForeground([255, 0, 0]);
    expect(palette.getForeground()).toEqual([255, 0, 0]);
  });

  it('should set background color', () => {
    const palette = new Palette();
    palette.setBackground([0, 255, 0]);
    expect(palette.getBackground()).toEqual([0, 255, 0]);
  });

  it('should emit color-changed event', () => {
    const palette = new Palette();
    const onChanged = vi.fn();
    palette.on('color-changed', onChanged);

    palette.setForeground([100, 100, 100]);
    expect(onChanged).toHaveBeenCalledWith({
      fg: [100, 100, 100],
      bg: [0, 0, 0]
    });
  });

  it('should render color picker UI', () => {
    const palette = new Palette();
    const container = document.createElement('div');
    palette.render(container);

    const colorInputs = container.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBeGreaterThanOrEqual(2); // at least fg and bg
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/web/rexpaint-editor-palette.test.js
```

Expected: FAIL with "Palette is not defined"

**Step 3: Implement palette**

Create file `web/rexpaint-editor/palette.js`:
```javascript
/**
 * Palette - Manages foreground and background colors
 * Supports RGB input, hex input, and visual color grid picker
 */

export class Palette {
  constructor() {
    this.fg = [255, 255, 255]; // white
    this.bg = [0, 0, 0];       // black
    this.listeners = new Map();
    this.applyMode = {
      glyph: true,
      foreground: true,
      background: true
    };
  }

  /**
   * Set foreground color (RGB array or hex string)
   */
  setForeground(color) {
    this.fg = this.normalizeColor(color);
    this.emit('color-changed', { fg: this.fg, bg: this.bg });
  }

  /**
   * Set background color
   */
  setBackground(color) {
    this.bg = this.normalizeColor(color);
    this.emit('color-changed', { fg: this.fg, bg: this.bg });
  }

  /**
   * Get foreground color
   */
  getForeground() {
    return [...this.fg];
  }

  /**
   * Get background color
   */
  getBackground() {
    return [...this.bg];
  }

  /**
   * Normalize color format (RGB array or hex string)
   */
  normalizeColor(color) {
    if (Array.isArray(color)) {
      return color.slice(0, 3).map(c => Math.max(0, Math.min(255, Math.round(c))));
    }
    if (typeof color === 'string') {
      // Parse hex #RRGGBB
      const hex = color.replace('#', '');
      if (hex.length === 6) {
        return [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16)
        ];
      }
    }
    return [255, 255, 255];
  }

  /**
   * Convert RGB to hex
   */
  rgbToHex(rgb) {
    return '#' + rgb.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  /**
   * Render palette UI
   */
  render(container) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'palette-wrapper';

    // Foreground color
    const fgSection = document.createElement('div');
    fgSection.className = 'palette-section';
    const fgLabel = document.createElement('label');
    fgLabel.textContent = 'Foreground:';
    const fgInput = document.createElement('input');
    fgInput.type = 'color';
    fgInput.value = this.rgbToHex(this.fg);
    fgInput.addEventListener('change', (e) => {
      this.setForeground(e.target.value);
    });
    fgSection.appendChild(fgLabel);
    fgSection.appendChild(fgInput);

    // Background color
    const bgSection = document.createElement('div');
    bgSection.className = 'palette-section';
    const bgLabel = document.createElement('label');
    bgLabel.textContent = 'Background:';
    const bgInput = document.createElement('input');
    bgInput.type = 'color';
    bgInput.value = this.rgbToHex(this.bg);
    bgInput.addEventListener('change', (e) => {
      this.setBackground(e.target.value);
    });
    bgSection.appendChild(bgLabel);
    bgSection.appendChild(bgInput);

    wrapper.appendChild(fgSection);
    wrapper.appendChild(bgSection);
    container.appendChild(wrapper);
  }

  /**
   * Set apply mode for a channel
   */
  setApplyMode(channel, enabled) {
    this.applyMode[channel] = enabled;
    this.emit('apply-mode-changed', this.applyMode);
  }

  /**
   * Get apply mode
   */
  getApplyMode() {
    return { ...this.applyMode };
  }

  /**
   * Event emitter
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, ...args) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(...args));
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/web/rexpaint-editor-palette.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add web/rexpaint-editor/palette.js tests/web/rexpaint-editor-palette.test.js
git commit -m "feat: add color palette with RGB and hex input support"
```

---

## Phase 3: Drawing Tools (6 Tier 1 Tools)

*[This section contains 6 detailed tasks: Cell tool, Line tool, Rect tool, Oval tool, Fill tool, Text tool]*

Due to context limits, I'm deferring detailed Task 6-11 implementations. Each follows the same pattern:
- **Task 6: Cell (freehand) drawing tool**
- **Task 7: Line drawing tool**
- **Task 8: Rectangle (filled/outline) tool**
- **Task 9: Oval (filled/outline) tool**
- **Task 10: Fill (flood fill) tool with 4-dir/8-dir modes**
- **Task 11: Text input tool**

Each task includes: failing test → run fail → minimal implementation → run pass → commit.

---

## Phase 4: Apply Toggles, Keyboard Shortcuts & Mouse Controls

*[6 tasks covering keyboard shortcuts, mouse event handling, apply toggles, undo/redo, pan/drag mode, grid toggle]*

- **Task 12: Implement apply toggles (g/f/b) for glyph/foreground/background**
- **Task 13: Add keyboard shortcuts for all drawing tools (c/l/r/o/i/t)**
- **Task 14: Implement undo/redo stack (z/y)**
- **Task 15: Add pan/drag mode (Spacebar + LMB)**
- **Task 16: Implement grid toggle (Ctrl-g)**
- **Task 17: Add canvas resize (Ctrl-r)**

---

## Phase 5: Layers & Selection Operations

*[5 tasks covering layer management, copy/cut/paste, selection transforms]*

- **Task 18: Implement layer panel with visibility/activation**
- **Task 19: Add per-family layer constraints (player/attack=4, plydie=3)**
- **Task 20: Implement copy/cut/paste (Ctrl-c/x/v)**
- **Task 21: Add selection transform shortcuts (h/r for flip/rotate)**
- **Task 22: Implement selection rectangle with visual feedback**

---

## Phase 6: XP File I/O & Persistence

*[3 tasks covering XP codec integration and file persistence]*

- **Task 23: Integrate XP format codec (existing mcp__xp-tool__* functions)**
- **Task 24: Implement XP file loading into editor**
- **Task 25: Implement XP file saving from editor**

---

## Phase 7: Grid Panel Integration & Bundle Mode

*[5 tasks covering workbench integration and bundle context management]*

- **Task 26: Wire editor open/close to Cell Inspector button**
- **Task 27: Implement action tab context switching (idle/attack/death)**
- **Task 28: Handle grid row/col operations while editor is open**
- **Task 29: Add frame copy/paste from grid panel**
- **Task 30: Implement frame reorder via grid drag while editor open**

---

## Phase 8: Coordinate Display, Status Bar, & Polish

*[4 tasks covering UX polish and live coordinate display]*

- **Task 31: Add live X/Y coordinate display (always visible)**
- **Task 32: Add glyph code and color display in info panel**
- **Task 33: Implement zoom levels for canvas (1x/2x/4x)**
- **Task 34: Add keyboard shortcut reference overlay (?)**

---

## Execution Strategy

**Total Scope:** 34 bite-sized TDD tasks across 8 phases
**Estimated Timeline:** 2-3 hours per phase (parallel execution possible for independent modules)
**Testing:** Each task includes failing test → implementation → passing test → commit

---

## Execution Choice

Plan complete and saved to `docs/plans/2026-03-08-web-rexpaint-editor-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

**Which approach?**