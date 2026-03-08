# Web REXPaint Editor — Tasks 9-35 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task.

**Goal:** Complete the REXPaint editor with 27 remaining features: advanced drawing tools (Oval, Fill, Text), apply mode toggles, keyboard shortcuts, undo/redo, pan/drag, layers, selection, XP file I/O, grid integration, bundle mode, coordinate display, polish, and validation suite.

**Architecture:** Extend EditorApp with tool ecosystem, state management (undo/redo), file I/O via XP binary format, layer stack abstraction, keyboard input routing, and grid panel integration for bundle mode context.

**Tech Stack:** ES6 modules, Canvas 2D context, CP437 font rendering, XP binary format (column-major, gzip), localStorage for undo stack, grid panel bridge for action switching.

---

## Phase 1: Advanced Drawing Tools (Tasks 9-11)

### Task 9: Oval Tool

**Files:**
- Create: `web/rexpaint-editor/tools/oval-tool.js` (220 LOC)
- Create: `tests/web/rexpaint-editor-oval-tool.test.js` (180 LOC)
- Modify: `web/rexpaint-editor/editor-app.js` (add oval tool instantiation + activation)

**Step 1: Write failing test for oval outline**

Test file: `tests/web/rexpaint-editor-oval-tool.test.js`

```javascript
runner.it('should draw outline oval', () => {
  const tool = new OvalTool();
  const canvas = { setCell: vi.fn() };
  tool.setCanvas(canvas);
  tool.setGlyph(42);
  tool.setColors([255, 255, 255], [0, 0, 0]);
  tool.setMode('outline');

  tool.startOval(0, 0);
  tool.drawOval(5, 3); // Draw oval from (0,0) to (5,3)
  tool.endOval();

  // Should paint perimeter cells only (not filled)
  const calls = canvas.setCell.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.length).toBeLessThan(24); // Less than filled 6x4 rect (24 cells)
});
```

**Step 2: Run test to verify it fails**

```bash
node tests/web/rexpaint-editor-oval-tool.test.js
```

Expected: FAIL with "OvalTool is not defined"

**Step 3: Implement OvalTool class**

File: `web/rexpaint-editor/tools/oval-tool.js`

```javascript
export class OvalTool {
  constructor() {
    this.canvas = null;
    this.glyph = 0;
    this.fg = [255, 255, 255];
    this.bg = [0, 0, 0];
    this.applyModes = { glyph: true, foreground: true, background: true };
    this.mode = 'outline'; // 'outline' or 'filled'
    this.startX = 0;
    this.startY = 0;
  }

  setCanvas(canvas) {
    this.canvas = canvas;
  }

  setGlyph(code) {
    this.glyph = code;
  }

  setColors(fg, bg) {
    this.fg = fg;
    this.bg = bg;
  }

  setApplyModes(modes) {
    this.applyModes = modes;
  }

  setMode(mode) {
    if (!['outline', 'filled'].includes(mode)) {
      throw new Error('Oval mode must be outline or filled');
    }
    this.mode = mode;
  }

  startOval(x, y) {
    this.startX = x;
    this.startY = y;
  }

  drawOval(endX, endY) {
    this._drawOval(this.startX, this.startY, endX, endY);
  }

  endOval() {
    // State cleanup if needed
  }

  _drawOval(x1, y1, x2, y2) {
    // Normalize coordinates
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const radiusX = (maxX - minX) / 2;
    const radiusY = (maxY - minY) / 2;
    const centerX = minX + radiusX;
    const centerY = minY + radiusY;

    // Midpoint circle algorithm for ellipse
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);

        const isOnPerimeter = Math.abs(dist - 1) < 0.25;
        const isInside = dist <= 1;

        if ((this.mode === 'outline' && isOnPerimeter) || (this.mode === 'filled' && isInside)) {
          this._paint(x, y);
        }
      }
    }
  }

  _paint(x, y) {
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
      return; // Silently ignore out-of-bounds
    }

    const glyph = this.applyModes.glyph ? this.glyph : this.canvas.getCell(x, y).glyph;
    const fg = this.applyModes.foreground ? this.fg : this.canvas.getCell(x, y).fg;
    const bg = this.applyModes.background ? this.bg : this.canvas.getCell(x, y).bg;

    this.canvas.setCell(x, y, glyph, fg, bg);
  }

  deactivate() {
    // Cleanup if needed
  }
}
```

**Step 4: Run test to verify it passes**

```bash
node tests/web/rexpaint-editor-oval-tool.test.js
```

Expected: PASS (1 test passing)

**Step 5: Add filled oval test**

```javascript
runner.it('should draw filled oval', () => {
  const tool = new OvalTool();
  const canvas = { setCell: vi.fn(), width: 80, height: 25 };
  tool.setCanvas(canvas);
  tool.setGlyph(178);
  tool.setColors([100, 100, 100], [0, 0, 0]);
  tool.setMode('filled');

  tool.startOval(0, 0);
  tool.drawOval(5, 3);
  tool.endOval();

  // Filled oval should paint more cells than outline
  expect(canvas.setCell.mock.calls.length).toBeGreaterThan(10);
});
```

**Step 6: Implement filled mode and run tests**

```bash
node tests/web/rexpaint-editor-oval-tool.test.js
```

Expected: PASS (2 tests)

**Step 7: Add apply modes test**

```javascript
runner.it('should respect apply modes', () => {
  const tool = new OvalTool();
  const canvas = {
    setCell: vi.fn(),
    width: 80,
    height: 25,
    getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] }))
  };
  tool.setCanvas(canvas);
  tool.setApplyModes({ glyph: false, foreground: true, background: true });
  tool.setMode('filled');

  tool.startOval(0, 0);
  tool.drawOval(4, 4);
  tool.endOval();

  // Should preserve existing glyph
  expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
});
```

**Step 8: Commit Task 9**

```bash
git add web/rexpaint-editor/tools/oval-tool.js tests/web/rexpaint-editor-oval-tool.test.js web/rexpaint-editor/editor-app.js
git commit -m "feat: add oval drawing tool with outline and filled modes"
```

---

### Task 10: Fill Tool

**Files:**
- Create: `web/rexpaint-editor/tools/fill-tool.js` (180 LOC)
- Create: `tests/web/rexpaint-editor-fill-tool.test.js` (140 LOC)
- Modify: `web/rexpaint-editor/editor-app.js`

**Step 1: Write test for flood fill**

```javascript
runner.it('should fill connected region with same glyph', () => {
  const tool = new FillTool();
  const canvas = {
    setCell: vi.fn(),
    getCell: vi.fn((x, y) => {
      if (x === 5 && y === 5) return { glyph: 42, fg: [0, 0, 0], bg: [0, 0, 0] };
      return { glyph: 65, fg: [100, 100, 100], bg: [50, 50, 50] };
    }),
    width: 80,
    height: 25
  };
  tool.setCanvas(canvas);
  tool.setGlyph(178);
  tool.setColors([255, 255, 255], [0, 0, 0]);

  tool.fill(5, 5); // Fill the 42 cell at (5,5)

  // Should fill all connected cells with same glyph
  expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
});
```

**Step 2: Implement FillTool with flood fill algorithm**

```javascript
export class FillTool {
  constructor() {
    this.canvas = null;
    this.glyph = 0;
    this.fg = [255, 255, 255];
    this.bg = [0, 0, 0];
    this.applyModes = { glyph: true, foreground: true, background: true };
  }

  setCanvas(canvas) {
    this.canvas = canvas;
  }

  setGlyph(code) {
    this.glyph = code;
  }

  setColors(fg, bg) {
    this.fg = fg;
    this.bg = bg;
  }

  setApplyModes(modes) {
    this.applyModes = modes;
  }

  fill(startX, startY) {
    const startCell = this.canvas.getCell(startX, startY);
    const targetGlyph = startCell.glyph;

    // BFS flood fill
    const visited = new Set();
    const queue = [[startX, startY]];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const [x, y] = queue.shift();

      // Paint this cell
      const glyph = this.applyModes.glyph ? this.glyph : targetGlyph;
      const fg = this.applyModes.foreground ? this.fg : this.canvas.getCell(x, y).fg;
      const bg = this.applyModes.background ? this.bg : this.canvas.getCell(x, y).bg;
      this.canvas.setCell(x, y, glyph, fg, bg);

      // Add neighbors
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < this.canvas.width && ny >= 0 && ny < this.canvas.height) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            const neighbor = this.canvas.getCell(nx, ny);
            if (neighbor.glyph === targetGlyph) {
              visited.add(key);
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }

  deactivate() {}
}
```

**Step 3: Run tests and commit**

```bash
node tests/web/rexpaint-editor-fill-tool.test.js
git add web/rexpaint-editor/tools/fill-tool.js tests/web/rexpaint-editor-fill-tool.test.js web/rexpaint-editor/editor-app.js
git commit -m "feat: add flood fill tool with BFS algorithm"
```

---

### Task 11: Text Tool

**Files:**
- Create: `web/rexpaint-editor/tools/text-tool.js` (160 LOC)
- Create: `tests/web/rexpaint-editor-text-tool.test.js` (120 LOC)
- Modify: `web/rexpaint-editor/editor-app.js`

**Step 1: Write test for text input**

```javascript
runner.it('should paint text string horizontally', () => {
  const tool = new TextTool();
  const canvas = { setCell: vi.fn(), width: 80, height: 25 };
  tool.setCanvas(canvas);
  tool.setColors([255, 255, 255], [0, 0, 0]);

  tool.setText('HELLO');
  tool.paint(10, 5); // Paint text at (10, 5)

  // Should paint 5 cells with glyphs for H, E, L, L, O
  expect(canvas.setCell.mock.calls.length).toBe(5);
  expect(canvas.setCell.mock.calls[0][0]).toBe(10); // x
  expect(canvas.setCell.mock.calls[0][1]).toBe(5);  // y
  expect(canvas.setCell.mock.calls[0][2]).toBe(72); // 'H'
});
```

**Step 2: Implement TextTool**

```javascript
export class TextTool {
  constructor() {
    this.canvas = null;
    this.text = '';
    this.fg = [255, 255, 255];
    this.bg = [0, 0, 0];
    this.applyModes = { glyph: true, foreground: true, background: true };
  }

  setCanvas(canvas) {
    this.canvas = canvas;
  }

  setText(text) {
    this.text = text;
  }

  setColors(fg, bg) {
    this.fg = fg;
    this.bg = bg;
  }

  setApplyModes(modes) {
    this.applyModes = modes;
  }

  paint(startX, startY) {
    for (let i = 0; i < this.text.length; i++) {
      const x = startX + i;
      const y = startY;

      if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
        continue; // Skip out-of-bounds
      }

      const glyph = this.text.charCodeAt(i); // CP437 code
      const fg = this.applyModes.foreground ? this.fg : this.canvas.getCell(x, y).fg;
      const bg = this.applyModes.background ? this.bg : this.canvas.getCell(x, y).bg;

      this.canvas.setCell(x, y, glyph, fg, bg);
    }
  }

  deactivate() {}
}
```

**Step 3: Run tests and commit**

```bash
node tests/web/rexpaint-editor-text-tool.test.js
git add web/rexpaint-editor/tools/text-tool.js tests/web/rexpaint-editor-text-tool.test.js web/rexpaint-editor/editor-app.js
git commit -m "feat: add text tool for horizontal glyph strings"
```

---

## Phase 2: UI Features (Tasks 12-17)

### Task 12: Apply Mode Toggles in UI

**Files:**
- Modify: `web/rexpaint-editor/editor-app.js` (add UI binding for apply mode buttons)
- Modify: `web/workbench.html` (add apply mode toggle buttons)
- Modify: `web/rexpaint-editor/styles.css` (style toggle buttons)

**Step 1: Add HTML toggle buttons**

File: `web/workbench.html`

```html
<div id="applyModeToggles" class="apply-mode-toggles">
  <button id="applyGlyph" class="toggle-btn active" title="Apply Glyph">G</button>
  <button id="applyForeground" class="toggle-btn active" title="Apply Foreground">F</button>
  <button id="applyBackground" class="toggle-btn active" title="Apply Background">B</button>
</div>
```

**Step 2: Add CSS for toggles**

File: `web/rexpaint-editor/styles.css`

```css
.apply-mode-toggles {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}

.toggle-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #444;
  background: #1e1e1e;
  color: #ffb86c;
  cursor: pointer;
  font-weight: bold;
}

.toggle-btn.active {
  background: #2e2e2e;
  border-color: #ffb86c;
}

.toggle-btn:hover {
  background: #3e3e3e;
}
```

**Step 3: Implement toggle button handlers in EditorApp**

Modify: `web/rexpaint-editor/editor-app.js`

```javascript
class EditorApp {
  constructor({ canvas, palette, glyphPicker, modalElement }) {
    // ... existing code ...
    this.modalElement = modalElement;
    this._setupApplyModeToggles();
  }

  _setupApplyModeToggles() {
    const glyphBtn = this.modalElement.querySelector('#applyGlyph');
    const fgBtn = this.modalElement.querySelector('#applyForeground');
    const bgBtn = this.modalElement.querySelector('#applyBackground');

    glyphBtn?.addEventListener('click', () => {
      this.activeApplyModes.glyph = !this.activeApplyModes.glyph;
      glyphBtn.classList.toggle('active');
      this._syncApplyModesToTools();
    });

    fgBtn?.addEventListener('click', () => {
      this.activeApplyModes.foreground = !this.activeApplyModes.foreground;
      fgBtn.classList.toggle('active');
      this._syncApplyModesToTools();
    });

    bgBtn?.addEventListener('click', () => {
      this.activeApplyModes.background = !this.activeApplyModes.background;
      bgBtn.classList.toggle('active');
      this._syncApplyModesToTools();
    });
  }

  _syncApplyModesToTools() {
    if (this.activeTool) {
      this.activeTool.setApplyModes(this.activeApplyModes);
    }
  }
}
```

**Step 4: Test and commit**

```bash
git add web/rexpaint-editor/editor-app.js web/workbench.html web/rexpaint-editor/styles.css
git commit -m "feat: add apply mode toggle buttons (Glyph, Foreground, Background)"
```

---

### Task 13: Keyboard Shortcuts

**Files:**
- Create: `web/rexpaint-editor/keyboard-handler.js` (200 LOC)
- Create: `tests/web/rexpaint-editor-keyboard-handler.test.js` (150 LOC)
- Modify: `web/rexpaint-editor/editor-app.js`

**Step 1: Implement keyboard handler class**

```javascript
export class KeyboardHandler {
  constructor(editorApp) {
    this.app = editorApp;
    this.shortcuts = {
      'KeyC': () => this.app.activateTool(this.app.cellTool),
      'KeyL': () => this.app.activateTool(this.app.lineTool),
      'KeyR': () => this.app.activateTool(this.app.rectTool),
      'KeyO': () => this.app.activateTool(this.app.ovalTool),
      'KeyF': () => this.app.activateTool(this.app.fillTool),
      'KeyT': () => this.app.activateTool(this.app.textTool),
      'KeyZ': (evt) => evt.ctrlKey && this.app.undo(),
      'KeyY': (evt) => evt.ctrlKey && this.app.redo(),
      'KeyS': (evt) => evt.ctrlKey && evt.preventDefault(), // Prevent browser save
    };
  }

  attach(element) {
    element.addEventListener('keydown', (evt) => this._handleKeyDown(evt));
  }

  _handleKeyDown(evt) {
    const shortcut = this.shortcuts[evt.code];
    if (shortcut) {
      shortcut(evt);
    }
  }

  detach(element) {
    // Cleanup handled by dispose
  }
}
```

**Step 2: Write tests**

```javascript
runner.it('should switch to cell tool on C key', () => {
  const app = new MockEditorApp();
  const handler = new KeyboardHandler(app);
  const evt = new KeyboardEvent('keydown', { code: 'KeyC' });

  handler._handleKeyDown(evt);

  expect(app.activateTool).toHaveBeenCalledWith(app.cellTool);
});

runner.it('should undo on Ctrl+Z', () => {
  const app = new MockEditorApp();
  const handler = new KeyboardHandler(app);
  const evt = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true });

  handler._handleKeyDown(evt);

  expect(app.undo).toHaveBeenCalled();
});
```

**Step 3: Integrate with EditorApp**

```javascript
class EditorApp {
  constructor(/* ... */) {
    this.keyboardHandler = new KeyboardHandler(this);
    this.keyboardHandler.attach(modalElement);
  }

  dispose() {
    this.keyboardHandler.detach();
    // ... rest of dispose ...
  }
}
```

**Step 4: Commit**

```bash
git add web/rexpaint-editor/keyboard-handler.js tests/web/rexpaint-editor-keyboard-handler.test.js web/rexpaint-editor/editor-app.js
git commit -m "feat: add keyboard shortcuts (C/L/R/O/F/T for tools, Ctrl+Z/Y for undo/redo)"
```

---

### Task 14: Undo/Redo Stack

**Files:**
- Create: `web/rexpaint-editor/undo-stack.js` (140 LOC)
- Create: `tests/web/rexpaint-editor-undo-stack.test.js` (120 LOC)
- Modify: `web/rexpaint-editor/editor-app.js`

**Step 1: Implement UndoStack class**

```javascript
export class UndoStack {
  constructor(maxSize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  push(snapshot) {
    if (this.undoStack.length >= this.maxSize) {
      this.undoStack.shift(); // Remove oldest
    }
    this.undoStack.push(snapshot);
    this.redoStack = []; // Clear redo when new action taken
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    const snapshot = this.undoStack.pop();
    this.redoStack.push(snapshot); // Current state becomes redo
    return this.undoStack[this.undoStack.length - 1]; // Return state to restore
  }

  redo() {
    if (!this.canRedo()) return null;
    const snapshot = this.redoStack.pop();
    this.undoStack.push(snapshot);
    return snapshot;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
```

**Step 2: Add tests and commit**

```bash
git add web/rexpaint-editor/undo-stack.js tests/web/rexpaint-editor-undo-stack.test.js web/rexpaint-editor/editor-app.js
git commit -m "feat: add undo/redo stack with 50-action history limit"
```

---

### Task 15: Pan/Drag Canvas

**Files:**
- Modify: `web/rexpaint-editor/canvas.js` (add pan state)
- Modify: `web/rexpaint-editor/editor-app.js` (add pan mode)

**Step 1: Add pan mode to EditorApp**

```javascript
class EditorApp {
  constructor() {
    this.panMode = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  setPanMode(enabled) {
    this.panMode = enabled;
  }

  startPan(screenX, screenY) {
    this.panStartX = screenX;
    this.panStartY = screenY;
  }

  pan(screenX, screenY) {
    if (!this.panMode) return;
    const deltaX = screenX - this.panStartX;
    const deltaY = screenY - this.panStartY;
    this.offsetX += deltaX;
    this.offsetY += deltaY;
    this.panStartX = screenX;
    this.panStartY = screenY;
    this.canvas.setOffset(this.offsetX, this.offsetY);
  }

  endPan() {
    this.panMode = false;
  }
}
```

**Step 2: Add offset to Canvas**

```javascript
class Canvas {
  constructor(canvasElement, width, height) {
    this.offsetX = 0;
    this.offsetY = 0;
    // ... rest of constructor ...
  }

  setOffset(x, y) {
    this.offsetX = x;
    this.offsetY = y;
    this.render(); // Re-render with new offset
  }

  render() {
    // Apply offset to all drawing operations
    // Clamp offset to prevent panning too far
    const maxOffsetX = this.width * this.cellSizePixels - this.canvasElement.width;
    const maxOffsetY = this.height * this.cellSizePixels - this.canvasElement.height;
    this.offsetX = Math.max(0, Math.min(this.offsetX, maxOffsetX));
    this.offsetY = Math.max(0, Math.min(this.offsetY, maxOffsetY));
    // ... render cells with offset ...
  }
}
```

**Step 3: Commit**

```bash
git add web/rexpaint-editor/canvas.js web/rexpaint-editor/editor-app.js
git commit -m "feat: add pan/drag canvas support with offset clamping"
```

---

### Task 16: Grid Display Toggle

**Files:**
- Modify: `web/rexpaint-editor/canvas.js` (add grid rendering)
- Modify: `web/rexpaint-editor/editor-app.js` (add grid toggle)
- Modify: `web/workbench.html` (add grid button)

**Step 1: Add grid rendering to Canvas**

```javascript
class Canvas {
  constructor() {
    this.showGrid = false;
    // ... rest of constructor ...
  }

  setGridVisible(visible) {
    this.showGrid = visible;
    this.render();
  }

  render() {
    // ... render cells ...
    if (this.showGrid) {
      this._drawGrid();
    }
  }

  _drawGrid() {
    const ctx = this.canvasElement.getContext('2d');
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 0.5;

    for (let x = 1; x < this.width; x++) {
      const px = x * this.cellSizePixels - this.offsetX;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, this.canvasElement.height);
      ctx.stroke();
    }

    for (let y = 1; y < this.height; y++) {
      const py = y * this.cellSizePixels - this.offsetY;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(this.canvasElement.width, py);
      ctx.stroke();
    }
  }
}
```

**Step 2: Add grid button and handler**

```html
<button id="gridToggle" class="control-btn" title="Toggle Grid">Grid</button>
```

```javascript
class EditorApp {
  _setupGridToggle() {
    const gridBtn = this.modalElement.querySelector('#gridToggle');
    gridBtn?.addEventListener('click', () => {
      const visible = !this.canvas.showGrid;
      this.canvas.setGridVisible(visible);
      gridBtn.classList.toggle('active', visible);
    });
  }
}
```

**Step 3: Commit**

```bash
git add web/rexpaint-editor/canvas.js web/rexpaint-editor/editor-app.js web/workbench.html
git commit -m "feat: add grid display toggle with 0.5px lines"
```

---

### Task 17: Status Bar Display

**Files:**
- Modify: `web/workbench.html` (add status bar elements)
- Modify: `web/rexpaint-editor/editor-app.js` (update status on changes)
- Modify: `web/rexpaint-editor/styles.css` (style status bar)

**Step 1: Add status bar HTML**

```html
<div id="statusBar" class="status-bar">
  <span id="posDisplay">Pos: --, --</span>
  <span id="cellDisplay">Cell: (empty)</span>
  <span id="toolDisplay">Tool: Cell</span>
  <span id="modeDisplay">Mode: G|F|B</span>
</div>
```

**Step 2: Update EditorApp to sync status**

```javascript
class EditorApp {
  _setupStatusBar() {
    this.statusBar = {
      pos: this.modalElement.querySelector('#posDisplay'),
      cell: this.modalElement.querySelector('#cellDisplay'),
      tool: this.modalElement.querySelector('#toolDisplay'),
      mode: this.modalElement.querySelector('#modeDisplay'),
    };

    this.canvas.on('mousemove', (x, y) => {
      const cell = this.canvas.getCell(x, y);
      this.statusBar.pos.textContent = `Pos: ${x}, ${y}`;
      this.statusBar.cell.textContent = `Cell: ${cell.glyph} (${String.fromCharCode(cell.glyph)})`;
    });

    this.canvas.on('click', (x, y) => {
      this.statusBar.pos.textContent = `Pos: ${x}, ${y}`;
    });
  }

  activateTool(tool) {
    this.activeTool = tool;
    const toolName = tool.constructor.name.replace('Tool', '');
    this.statusBar.tool.textContent = `Tool: ${toolName}`;
  }

  _syncApplyModesToTools() {
    const modes = [];
    if (this.activeApplyModes.glyph) modes.push('G');
    if (this.activeApplyModes.foreground) modes.push('F');
    if (this.activeApplyModes.background) modes.push('B');
    this.statusBar.mode.textContent = `Mode: ${modes.join('|')}`;
  }
}
```

**Step 3: Commit**

```bash
git add web/workbench.html web/rexpaint-editor/editor-app.js web/rexpaint-editor/styles.css
git commit -m "feat: add status bar with position, cell, tool, and mode display"
```

---

## Phase 3: Layers & Selection (Tasks 18-22)

[Due to length, remaining tasks 18-35 abbreviated. Same TDD structure applies.]

### Task 18: Layer Stack Implementation

- Create `web/rexpaint-editor/layer-stack.js` with Layer class, stack operations (addLayer, removeLayer, moveLayer, getActive)
- Create tests for layer manipulation
- Modify EditorApp to instantiate and manage layer stack
- Commit: "feat: add layer stack with add/remove/move/select operations"

### Task 19: Layer UI (List & Controls)

- Add layer list UI in workbench.html
- Implement layer selection, visibility toggle, opacity slider
- Sync EditorApp to draw only active layer(s)
- Commit: "feat: add layer panel with visibility and opacity controls"

### Task 20: Selection Rectangle

- Create `web/rexpaint-editor/tools/select-tool.js` with rectangular selection
- Implement selection store (cells within bounds)
- Add selection visualization (dashed outline)
- Commit: "feat: add rectangular selection tool with marching ants outline"

### Task 21: Copy/Paste Selection

- Add copy/paste methods to EditorApp (Ctrl+C, Ctrl+V)
- Store selection clipboard in EditorApp
- Implement paste cursor (follows mouse until placed)
- Commit: "feat: add copy/paste operations on selections"

### Task 22: Delete Selection

- Implement clear operation for selected region
- Add Delete key handler to remove selected cells
- Restore background color after deletion
- Commit: "feat: add delete operation for selected cells"

---

## Phase 4: XP File I/O (Tasks 23-25)

### Task 23: XP File Reading

- Create `web/rexpaint-editor/xp-reader.js` with gzip decompression, column-major parsing
- Implement layer extraction and metadata parsing
- Handle CP437 glyph mapping
- Commit: "feat: add XP file reader with gzip decompression and layer extraction"

### Task 24: XP File Writing

- Create `web/rexpaint-editor/xp-writer.js` with gzip compression, column-major serialization
- Implement L0 metadata encoding (angles, frame counts)
- Add file download handler
- Commit: "feat: add XP file writer with metadata encoding"

### Task 25: Open/Save File UI

- Add File → Open / File → Save buttons to editor
- Implement file input handler for loading .xp files
- Implement file download trigger for saving
- Show file name in status bar
- Commit: "feat: add file open/save dialogs for .xp format"

---

## Phase 5: Grid Integration & Bundle Mode (Tasks 26-30)

### Task 26: Grid Panel Bridge

- Implement EditorApp.setActionContext(actionKey: 'idle'|'attack'|'death')
- Track current action in status bar
- Filter available layers by action
- Commit: "feat: add action context switching (idle/attack/death)"

### Task 27: Grid Row Switching

- Listen to grid panel events for action changes
- Reload editor layers when grid row changes
- Update status bar with current action
- Commit: "feat: sync editor layers to grid panel action selection"

### Task 28: Bundle Mode Detection

- Auto-detect if workbench is in bundle mode (check grid panel state)
- Hide unused actions in editor
- Disable action switching in non-bundle mode
- Commit: "feat: detect bundle mode and adapt editor UI"

### Task 29: Thumbnail Preview

- Generate small preview of current layer after each edit
- Display preview in grid panel (optional)
- Cache previews for undo/redo
- Commit: "feat: add layer thumbnail preview generation"

### Task 30: Action Switching Animation

- Add visual feedback when switching actions (fade out → fade in)
- Ensure no data loss during switch
- Test layer preservation across switches
- Commit: "feat: add action switch animation with layer preservation"

---

## Phase 6: Coordinate Display & Polish (Tasks 31-34)

### Task 31: Pixel-to-Cell Converter

- Display both pixel coords and cell coords in status bar
- Add conversion preview on hover
- Show grid cell under cursor
- Commit: "feat: add pixel/cell coordinate display"

### Task 32: Color Picker from Canvas

- Right-click on cell to pick colors (eyedropper)
- Update palette with picked glyph and colors
- Add visual feedback (highlight picked cell)
- Commit: "feat: add color picker (eyedropper) tool"

### Task 33: Brush Size Control

- Add brush size slider (1-5 cells)
- Modify all tools to support brush size
- Update drag/paint algorithms to multi-cell
- Commit: "feat: add brush size slider (1-5 cells)"

### Task 34: Zoom Control

- Add zoom slider (50%-200%)
- Implement zoom with mouse wheel
- Adjust canvas rendering for zoom level
- Commit: "feat: add zoom control (50-200%)"

---

## Phase 7: Validation Suite (Task 35)

### Task 35: XP Recreation Test Suite

- Create `tests/web/rexpaint-editor-xp-roundtrip.test.js` (reference XP files)
- Test: Load .xp → Edit → Save .xp → Load → Verify identical
- Validate metadata, layers, cell data, colors
- Test all 256 CP437 glyphs
- Test multi-layer roundtrip
- Commit: "test: add XP file roundtrip validation suite"

---

## Testing Strategy

**Per-task TDD:**
1. Write failing test covering full behavior
2. Implement minimal code to pass
3. Run tests (expect pass)
4. Commit with scoped message

**Integration testing:**
- Canvas + Tools integration
- EditorApp + All components integration
- Layer stack with file I/O
- Grid panel synchronization

**Edge cases:**
- Out-of-bounds painting
- Empty layers/files
- Large undo stack (50+ actions)
- Rapid tool switching
- Pan beyond bounds

---

## Quality Checklist

- [ ] All 27 tasks have scoped, atomic commits
- [ ] 100% pass rate on per-task tests
- [ ] Integration tests pass
- [ ] XP roundtrip validation passes (all 256 glyphs)
- [ ] No memory leaks (event listener cleanup)
- [ ] Keyboard shortcuts all functional
- [ ] Grid panel synchronized
- [ ] Status bar shows accurate state
- [ ] File I/O roundtrips identically
- [ ] Pan/zoom constraints respected

---

## Execution Notes

- EditorApp is the central coordinator; all components emit events to it
- Canvas is the rendering layer; all tools call canvas.setCell()
- Layer stack is the data model; EditorApp keeps it in sync with UI
- XP format uses column-major storage; conversion happens in reader/writer only
- Undo stack snapshots entire layer state before each operation
- Grid panel bridge is event-based (no tight coupling)
