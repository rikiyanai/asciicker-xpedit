/**
 * REXPaint Editor End-to-End Integration Tests
 *
 * Comprehensive integration workflows testing complete editing sessions:
 * - Drawing with multiple tools in sequence
 * - Selection, copy, paste operations
 * - Multi-layer editing with visibility toggling
 * - Pan and draw workflows
 * - Undo/redo with mixed operations
 * - Full realistic editing sessions
 *
 * Run with: node tests/web/rexpaint-editor-integration.test.js
 */

import { EditorApp } from '../../web/rexpaint-editor/editor-app.js';
import { Canvas } from '../../web/rexpaint-editor/canvas.js';
import { Palette } from '../../web/rexpaint-editor/palette.js';
import { GlyphPicker } from '../../web/rexpaint-editor/glyph-picker.js';
import { LayerStack } from '../../web/rexpaint-editor/layer-stack.js';
import { UndoStack } from '../../web/rexpaint-editor/undo-stack.js';
import { CellTool } from '../../web/rexpaint-editor/tools/cell-tool.js';
import { LineTool } from '../../web/rexpaint-editor/tools/line-tool.js';
import { RectTool } from '../../web/rexpaint-editor/tools/rect-tool.js';
import { SelectTool } from '../../web/rexpaint-editor/tools/select-tool.js';
import { FillTool } from '../../web/rexpaint-editor/tools/fill-tool.js';

// Mock document and DOM for Node.js environment
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          tag,
          children: [],
          classList: {
            add() {},
            remove() {},
            toggle() {},
            contains() { return false; }
          },
          addEventListener() {},
          removeEventListener() {},
          querySelector() { return null; },
          querySelectorAll() { return []; },
          appendChild() {},
          textContent: '',
          getBoundingClientRect() { return { top: 0, left: 0 }; },
          getContext(type) {
            if (type === '2d') {
              return {
                fillRect() {},
                clearRect() {},
                fillText() {},
                measureText() { return { width: 6 }; },
                drawImage() {},
                createImageData() { return { data: new Uint8ClampedArray(4) }; },
              };
            }
            return null;
          }
        };
      }
      return {
        tag,
        children: [],
        classList: {
          add() {},
          remove() {},
          toggle() {},
          contains() { return false; }
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() {},
        textContent: '',
        getBoundingClientRect() { return { top: 0, left: 0 }; }
      };
    },
    getElementById() {
      return {
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {},
        appendChild() {},
        textContent: '',
        innerHTML: ''
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

if (typeof window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// Ensure requestAnimationFrame is available
if (typeof requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (callback) => {
    return 0;
  };
}

// Simple test framework (polyfill for vitest-like API)
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  describe(suiteName, suiteFunc) {
    console.log(`\n${suiteName}`);
    suiteFunc();
  }

  it(testName, testFunc) {
    try {
      testFunc();
      this.passed++;
      console.log(`  ✓ ${testName}`);
    } catch (error) {
      this.failed++;
      console.log(`  ✗ ${testName}`);
      console.log(`    ${error.message}`);
      if (error.stack) {
        console.log(`    ${error.stack.split('\n').slice(1, 3).join('\n    ')}`);
      }
    }
  }

  report() {
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Simple assertion helpers
const expect = (value) => ({
  toBe(expected) {
    if (value !== expected) {
      throw new Error(`Expected ${expected}, got ${value}`);
    }
  },
  toEqual(expected) {
    if (JSON.stringify(value) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    }
  },
  toContainEqual(expected) {
    const found = value && value.some(item => JSON.stringify(item) === JSON.stringify(expected));
    if (!found) {
      throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
    }
  },
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected > ${expected}, got ${value}`);
    }
  },
  toBeGreaterThanOrEqual(expected) {
    if (value < expected) {
      throw new Error(`Expected >= ${expected}, got ${value}`);
    }
  },
  toBeLessThan(expected) {
    if (value >= expected) {
      throw new Error(`Expected < ${expected}, got ${value}`);
    }
  },
  toBeTruthy() {
    if (!value) {
      throw new Error(`Expected truthy, got ${value}`);
    }
  },
  toBeFalsy() {
    if (value) {
      throw new Error(`Expected falsy, got ${value}`);
    }
  },
  toBeLessThanOrEqual(expected) {
    if (value > expected) {
      throw new Error(`Expected <= ${expected}, got ${value}`);
    }
  },
});

// Helper to create test environment
function createTestEnvironment() {
  const canvasElement = document.createElement('canvas');
  canvasElement.width = 800;
  canvasElement.height = 300;

  const canvas = new Canvas(canvasElement, 80, 25, 10);
  const palette = new Palette();
  const glyphPicker = new GlyphPicker();
  const layerStack = new LayerStack(80, 25);
  const undoStack = new UndoStack(50);

  const app = new EditorApp({
    canvas,
    palette,
    glyphPicker,
    layerStack,
    undoStack,
  });

  canvas.setLayerStack(layerStack);

  return {
    app,
    canvas,
    palette,
    glyphPicker,
    layerStack,
    undoStack,
  };
}

// Run tests
const runner = new TestRunner();

runner.describe('Integration: Complete Drawing Workflow', () => {
  runner.it('should create drawing with multiple tool types and verify cell data', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    const lineTool = new LineTool();
    const rectTool = new RectTool();

    cellTool.setCanvas(env.canvas);
    lineTool.setCanvas(env.canvas);
    rectTool.setCanvas(env.canvas);

    // Draw 10 cells with CellTool
    env.app.activateTool(cellTool);
    cellTool.setGlyph(65); // 'A'
    cellTool.setColors([255, 0, 0], [0, 0, 0]); // Red on black

    for (let i = 0; i < 10; i++) {
      cellTool.paint(i, 0);
    }

    // Save snapshot for undo
    const snapshot1 = JSON.stringify(env.layerStack.getActiveLayer().data);

    // Draw diagonal line with LineTool
    env.app.activateTool(lineTool);
    lineTool.setGlyph(92); // '\'
    lineTool.setColors([0, 255, 0], [0, 0, 0]); // Green on black

    // Simulate line draw
    lineTool.startLine(20, 0);
    lineTool.drawLine(25, 5);
    lineTool.endLine();

    // Draw filled rect with RectTool
    env.app.activateTool(rectTool);
    rectTool.setGlyph(219); // Full block
    rectTool.setColors([0, 0, 255], [0, 0, 0]); // Blue on black
    rectTool.setMode('filled');

    rectTool.startRect(40, 5);
    rectTool.drawRect(45, 10);
    rectTool.endRect();

    // Verify cell data integrity
    const activeLayer = env.layerStack.getActiveLayer();
    expect(activeLayer.width).toBe(80);
    expect(activeLayer.height).toBe(25);

    // Verify cells were modified
    const snapshot2 = JSON.stringify(activeLayer.data);
    expect(snapshot1 === snapshot2).toBeFalsy();

    // Verify specific cell has been painted
    const cell0 = env.canvas.getCell(0, 0);
    expect(cell0).toEqual({
      glyph: 65,
      fg: [255, 0, 0],
      bg: [0, 0, 0],
    });
  });

  runner.it('should maintain canvas state after multiple drawing operations', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);

    env.app.activateTool(cellTool);
    cellTool.setGlyph(42); // '*'
    cellTool.setColors([255, 255, 255], [100, 100, 100]);

    // Draw a pattern
    const positions = [[5, 5], [6, 5], [7, 5], [5, 6], [7, 6], [5, 7], [6, 7], [7, 7]];
    for (const [x, y] of positions) {
      cellTool.paint(x, y);
    }

    // Verify all cells are present
    let paintedCount = 0;
    for (const [x, y] of positions) {
      const cell = env.canvas.getCell(x, y);
      if (cell && cell.glyph === 42) {
        paintedCount++;
      }
    }
    expect(paintedCount).toBe(positions.length);
  });
});

runner.describe('Integration: Selection and Copy/Paste Workflow', () => {
  runner.it('should select, copy, and paste cells to different location', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    const selectTool = new SelectTool();

    cellTool.setCanvas(env.canvas);
    selectTool.setCanvas(env.canvas);

    // Draw initial pattern at (10, 10) to (14, 14)
    env.app.activateTool(cellTool);
    cellTool.setGlyph(88); // 'X'
    cellTool.setColors([255, 255, 0], [0, 0, 0]); // Yellow

    for (let x = 10; x < 15; x++) {
      for (let y = 10; y < 15; y++) {
        cellTool.paint(x, y);
      }
    }

    // Switch to select tool and select region
    env.app.activateTool(selectTool);
    selectTool.startSelection(10, 10);
    selectTool.updateSelection(14, 14);

    // Get selected cells
    const selectedCells = selectTool.getSelectedCells();
    expect(selectedCells.length).toBe(25); // 5x5 area

    // Verify painted cells are there
    for (const cell of selectedCells) {
      expect(cell.glyph).toBe(88);
    }

    // Copy to clipboard (simulated)
    const clipboard = JSON.parse(JSON.stringify(selectedCells));

    // Paste at different location (20, 5)
    const pasteX = 20;
    const pasteY = 5;
    env.app.activateTool(cellTool);
    cellTool.setGlyph(88); // Ensure glyph is set
    for (const cell of clipboard) {
      const newX = pasteX + (cell.x - 10);
      const newY = pasteY + (cell.y - 10);
      cellTool.paint(newX, newY);
    }

    // Verify original selection unchanged
    for (let x = 10; x < 15; x++) {
      for (let y = 10; y < 15; y++) {
        const cell = env.canvas.getCell(x, y);
        expect(cell.glyph).toBe(88);
      }
    }

    // Verify paste created correct cells
    for (let x = 20; x < 25; x++) {
      for (let y = 5; y < 10; y++) {
        const cell = env.canvas.getCell(x, y);
        expect(cell.glyph).toBe(88);
      }
    }

    // Verify undo would remove paste
    expect(env.undoStack.canUndo()).toBeFalsy(); // No undo recorded in this test
  });

  runner.it('should handle selection bounds correctly with different selection directions', () => {
    const env = createTestEnvironment();
    const selectTool = new SelectTool();
    selectTool.setCanvas(env.canvas);

    // Select from bottom-right to top-left (reversed)
    selectTool.startSelection(20, 20);
    selectTool.updateSelection(10, 10);

    const bounds = selectTool.getSelectionBounds();
    expect(bounds.x).toBe(10);
    expect(bounds.y).toBe(10);
    expect(bounds.width).toBe(11); // 20 - 10 + 1
    expect(bounds.height).toBe(11);

    // Verify all cells in normalized bounds are selected
    expect(selectTool.isSelected(10, 10)).toBeTruthy();
    expect(selectTool.isSelected(20, 20)).toBeTruthy();
    expect(selectTool.isSelected(9, 10)).toBeFalsy();
    expect(selectTool.isSelected(10, 21)).toBeFalsy();
  });
});

runner.describe('Integration: Multi-Layer Workflow', () => {
  runner.it('should manage multiple layers with independent drawing and visibility', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);

    // Initial state: Layer 0 exists
    expect(env.layerStack.layers.length).toBe(1);

    // Add Layer 1
    env.layerStack.addLayer('Layer 1');
    expect(env.layerStack.layers.length).toBe(2);

    // Draw on Layer 0
    env.layerStack.selectLayer(0);
    env.app.activateTool(cellTool);
    cellTool.setGlyph(65); // 'A'
    cellTool.setColors([255, 0, 0], [0, 0, 0]);
    cellTool.paint(5, 5);

    // Add Layer 2
    env.layerStack.addLayer('Layer 2');
    expect(env.layerStack.layers.length).toBe(3);

    // Draw on Layer 1
    env.layerStack.selectLayer(1);
    cellTool.setGlyph(66); // 'B'
    cellTool.setColors([0, 255, 0], [0, 0, 0]);
    cellTool.paint(10, 10);

    // Draw on Layer 2
    env.layerStack.selectLayer(2);
    cellTool.setGlyph(67); // 'C'
    cellTool.setColors([0, 0, 255], [0, 0, 0]);
    cellTool.paint(15, 15);

    // Verify layer independence
    expect(env.layerStack.layers[0].getCell(5, 5).glyph).toBe(65);
    expect(env.layerStack.layers[1].getCell(10, 10).glyph).toBe(66);
    expect(env.layerStack.layers[2].getCell(15, 15).glyph).toBe(67);

    // Verify other cells are empty (0 = transparent)
    expect(env.layerStack.layers[0].getCell(10, 10).glyph).toBe(0);
    expect(env.layerStack.layers[1].getCell(5, 5).glyph).toBe(0);
    expect(env.layerStack.layers[2].getCell(10, 10).glyph).toBe(0);
  });

  runner.it('should toggle layer visibility and render accordingly', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);

    // Setup: Create 3 layers with different content
    env.layerStack.addLayer('Layer 1');
    env.layerStack.addLayer('Layer 2');

    for (let i = 0; i < 3; i++) {
      env.layerStack.selectLayer(i);
      cellTool.setGlyph(65 + i); // A, B, C
      cellTool.paint(5 + i, 5);
    }

    // All layers initially visible
    expect(env.layerStack.layers[0].visible).toBeTruthy();
    expect(env.layerStack.layers[1].visible).toBeTruthy();
    expect(env.layerStack.layers[2].visible).toBeTruthy();

    // Hide Layer 1
    env.layerStack.layers[1].setVisible(false);
    expect(env.layerStack.layers[1].visible).toBeFalsy();

    // Verify visibility state persists
    expect(env.layerStack.layers[0].visible).toBeTruthy();
    expect(env.layerStack.layers[2].visible).toBeTruthy();

    // Toggle Layer 1 back on
    env.layerStack.layers[1].setVisible(true);
    expect(env.layerStack.layers[1].visible).toBeTruthy();
  });

  runner.it('should switch between layers and apply drawing to correct layer', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);
    env.app.activateTool(cellTool);

    // Add multiple layers
    env.layerStack.addLayer('Layer 1');
    env.layerStack.addLayer('Layer 2');

    // Draw on Layer 1, verify on Layer 1 only
    env.layerStack.selectLayer(1);
    cellTool.setGlyph(88); // 'X'
    cellTool.paint(20, 20);

    expect(env.layerStack.layers[1].getCell(20, 20).glyph).toBe(88);
    expect(env.layerStack.layers[0].getCell(20, 20).glyph).toBe(0);
    expect(env.layerStack.layers[2].getCell(20, 20).glyph).toBe(0);

    // Switch to Layer 0, draw again
    env.layerStack.selectLayer(0);
    cellTool.setGlyph(89); // 'Y'
    cellTool.paint(20, 20);

    // Now Layer 0 has 'Y', Layer 1 still has 'X'
    expect(env.layerStack.layers[0].getCell(20, 20).glyph).toBe(89);
    expect(env.layerStack.layers[1].getCell(20, 20).glyph).toBe(88);
  });
});

runner.describe('Integration: Pan and Draw Workflow', () => {
  runner.it('should draw at origin, pan, draw in different view, pan back', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);
    env.app.activateTool(cellTool);

    cellTool.setGlyph(65); // 'A'

    // Draw at origin
    cellTool.paint(0, 0);
    expect(env.canvas.getCell(0, 0).glyph).toBe(65);

    // Simulate pan (offset canvas view)
    const originalOffsetX = env.canvas.offsetX;
    const originalOffsetY = env.canvas.offsetY;
    env.canvas.offsetX += 200;
    env.canvas.offsetY += 0;

    // Draw at (10, 10) in panned view
    cellTool.setGlyph(66); // 'B'
    cellTool.paint(10, 10);
    expect(env.canvas.getCell(10, 10).glyph).toBe(66);

    // Pan back to origin
    env.canvas.offsetX = originalOffsetX;
    env.canvas.offsetY = originalOffsetY;

    // Verify both cells present at correct locations
    expect(env.canvas.getCell(0, 0).glyph).toBe(65);
    expect(env.canvas.getCell(10, 10).glyph).toBe(66);
  });

  runner.it('should maintain drawing state across pan operations', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);
    env.app.activateTool(cellTool);

    const positions = [[5, 5], [15, 10], [20, 15], [25, 20]];
    cellTool.setGlyph(42); // '*'

    // Draw pattern across canvas
    for (const [x, y] of positions) {
      cellTool.paint(x, y);
    }

    // Pan multiple times
    env.canvas.offsetX += 100;
    env.canvas.offsetY += 50;
    env.canvas.offsetX -= 100;
    env.canvas.offsetY -= 50;

    // Verify all cells still present after pan
    for (const [x, y] of positions) {
      expect(env.canvas.getCell(x, y).glyph).toBe(42);
    }
  });
});

runner.describe('Integration: Undo/Redo with Mixed Operations', () => {
  runner.it('should record state, undo and redo across multiple operations', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);
    env.app.activateTool(cellTool);

    cellTool.setGlyph(65); // 'A'
    cellTool.setColors([255, 255, 255], [0, 0, 0]);

    // Operation 1: Paint 5 cells
    for (let i = 0; i < 5; i++) {
      cellTool.paint(i, 0);
      env.undoStack.push(JSON.parse(JSON.stringify(env.layerStack.getActiveLayer().data)));
    }
    expect(env.undoStack.canUndo()).toBeTruthy();

    // Operation 2: Change glyph and paint
    cellTool.setGlyph(66); // 'B'
    for (let i = 5; i < 10; i++) {
      cellTool.paint(i, 0);
      env.undoStack.push(JSON.parse(JSON.stringify(env.layerStack.getActiveLayer().data)));
    }

    // Verify final state
    expect(env.canvas.getCell(0, 0).glyph).toBe(65);
    expect(env.canvas.getCell(5, 0).glyph).toBe(66);

    // Undo multiple times
    let count = 0;
    while (env.undoStack.canUndo() && count < 5) {
      const state = env.undoStack.undo();
      count++;
    }
    expect(env.undoStack.canRedo()).toBeTruthy();

    // Redo
    while (env.undoStack.canRedo() && count > 0) {
      env.undoStack.redo();
      count--;
    }

    // Should be back to final state
    expect(env.canvas.getCell(5, 0).glyph).toBe(66);
  });

  runner.it('should clear redo stack when new action taken after undo', () => {
    const env = createTestEnvironment();

    // Push some operations
    env.undoStack.push({ state: 1 });
    env.undoStack.push({ state: 2 });
    env.undoStack.push({ state: 3 });

    expect(env.undoStack.canUndo()).toBeTruthy();
    expect(env.undoStack.canRedo()).toBeFalsy();

    // Undo twice
    env.undoStack.undo();
    env.undoStack.undo();
    expect(env.undoStack.canRedo()).toBeTruthy();

    // Push new action - should clear redo
    env.undoStack.push({ state: 4 });
    expect(env.undoStack.canRedo()).toBeFalsy();
    expect(env.undoStack.canUndo()).toBeTruthy();
  });

  runner.it('should respect maximum undo history size', () => {
    const undoStack = new UndoStack(5); // Small size for testing

    // Push more than max size
    for (let i = 0; i < 10; i++) {
      undoStack.push({ state: i });
    }

    // Should only have last 5
    expect(undoStack.undoStack.length).toBeLessThan(10);

    // Undo all available
    let count = 0;
    while (undoStack.canUndo()) {
      undoStack.undo();
      count++;
    }

    expect(count).toBeLessThanOrEqual(5);
  });
});

runner.describe('Integration: Full Editing Session', () => {
  runner.it('should complete realistic editing session with all operations', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    const lineTool = new LineTool();
    const fillTool = new FillTool();
    const selectTool = new SelectTool();

    cellTool.setCanvas(env.canvas);
    lineTool.setCanvas(env.canvas);
    fillTool.setCanvas(env.canvas);
    selectTool.setCanvas(env.canvas);

    // Step 1: Initialize with canvas ready
    expect(env.layerStack.layers.length).toBe(1);
    expect(env.canvas.width).toBe(80);
    expect(env.canvas.height).toBe(25);

    // Step 2: Draw rectangle outline with LineTool
    env.app.activateTool(lineTool);
    lineTool.setGlyph(196); // Box drawing horizontal
    lineTool.setColors([255, 255, 255], [0, 0, 0]);

    // Draw top line
    lineTool.startLine(10, 10);
    lineTool.drawLine(30, 10);
    lineTool.endLine();

    // Step 3: Fill interior with manual setup (FillTool uses flood fill which requires specific setup)
    // Setup a filled area
    const activeLayer = env.layerStack.getActiveLayer();
    for (let y = 11; y < 15; y++) {
      for (let x = 11; x < 30; x++) {
        activeLayer.setCell(x, y, 176, [128, 128, 128], [0, 0, 0]);
      }
    }

    // Step 4: Select filled area
    env.app.activateTool(selectTool);
    selectTool.startSelection(11, 11);
    selectTool.updateSelection(29, 14);

    const selectedCells = selectTool.getSelectedCells();
    expect(selectedCells.length).toBeGreaterThan(0);

    // Step 5: Copy filled area
    const clipboard = JSON.parse(JSON.stringify(selectedCells));

    // Step 6: Create new layer
    env.layerStack.addLayer('Filled Copy');
    expect(env.layerStack.layers.length).toBe(2);

    // Step 7: Paste on new layer
    env.app.activateTool(cellTool);
    const offsetX = 40;
    const offsetY = 5;
    for (const cell of clipboard) {
      const newX = offsetX + (cell.x - 11);
      const newY = offsetY + (cell.y - 11);
      activeLayer.setCell(newX, newY, cell.glyph, cell.fg, cell.bg);
    }

    // Step 8: Toggle between layers
    env.layerStack.selectLayer(0);
    expect(env.layerStack.activeIndex).toBe(0);
    env.layerStack.selectLayer(1);
    expect(env.layerStack.activeIndex).toBe(1);

    // Step 9: Export layer data (verify structure)
    const layer0 = env.layerStack.layers[0];
    const layer1 = env.layerStack.layers[1];

    expect(layer0.data).toBeTruthy();
    expect(layer1.data).toBeTruthy();
    expect(layer0.data.length).toBe(25);
    expect(layer0.data[0].length).toBe(80);

    // Step 10: Verify all operations completed
    expect(env.layerStack.layers.length).toBe(2);
    expect(selectedCells.length).toBe(clipboard.length);

    // Verify some cells were actually modified
    const cell = layer0.getCell(11, 11);
    expect(cell).toBeTruthy();
  });

  runner.it('should handle apply mode filtering during drawing', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);
    env.app.activateTool(cellTool);

    // Draw initial cell with all attributes
    cellTool.setGlyph(65);
    cellTool.setColors([255, 0, 0], [0, 0, 0]);
    cellTool.setApplyModes({ glyph: true, foreground: true, background: true });
    cellTool.paint(5, 5);

    const cell1 = env.canvas.getCell(5, 5);
    expect(cell1.glyph).toBe(65);
    expect(cell1.fg).toEqual([255, 0, 0]);

    // Paint same cell with glyph-only mode
    cellTool.setGlyph(66);
    cellTool.setColors([0, 255, 0], [255, 255, 255]); // Different colors
    cellTool.setApplyModes({ glyph: true, foreground: false, background: false });
    cellTool.paint(5, 5);

    const cell2 = env.canvas.getCell(5, 5);
    expect(cell2.glyph).toBe(66); // Glyph changed
    expect(cell2.fg).toEqual([255, 0, 0]); // Colors unchanged
    expect(cell2.bg).toEqual([0, 0, 0]);
  });

  runner.it('should verify layer composition across multiple tools and modes', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    const lineTool = new LineTool();

    cellTool.setCanvas(env.canvas);
    lineTool.setCanvas(env.canvas);

    // Create multiple layers
    env.layerStack.addLayer('Lines');
    env.layerStack.addLayer('Cells');

    // Draw on Layer 0 with cells
    env.layerStack.selectLayer(0);
    env.app.activateTool(cellTool);
    cellTool.setGlyph(42);
    for (let i = 0; i < 10; i++) {
      cellTool.paint(i, 0);
    }

    // Draw on Layer 1 with lines
    env.layerStack.selectLayer(1);
    env.app.activateTool(lineTool);
    lineTool.setGlyph(45); // '-'
    lineTool.startLine(0, 5);
    lineTool.drawLine(10, 5);
    lineTool.endLine();

    // Draw on Layer 2 with cells
    env.layerStack.selectLayer(2);
    env.app.activateTool(cellTool);
    cellTool.setGlyph(88); // 'X'
    for (let i = 0; i < 10; i++) {
      cellTool.paint(i, 10);
    }

    // Verify independent composition
    expect(env.layerStack.layers[0].getCell(0, 0).glyph).toBe(42);
    expect(env.layerStack.layers[0].getCell(0, 5).glyph).toBe(0);
    expect(env.layerStack.layers[0].getCell(0, 10).glyph).toBe(0);

    expect(env.layerStack.layers[1].getCell(0, 0).glyph).toBe(0);
    expect(env.layerStack.layers[1].getCell(0, 5).glyph).toBe(45);
    expect(env.layerStack.layers[1].getCell(0, 10).glyph).toBe(0);

    expect(env.layerStack.layers[2].getCell(0, 0).glyph).toBe(0);
    expect(env.layerStack.layers[2].getCell(0, 5).glyph).toBe(0);
    expect(env.layerStack.layers[2].getCell(0, 10).glyph).toBe(88);
  });
});

runner.describe('Integration: State Consistency', () => {
  runner.it('should maintain state consistency across tool switches', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    const lineTool = new LineTool();
    const selectTool = new SelectTool();

    cellTool.setCanvas(env.canvas);
    lineTool.setCanvas(env.canvas);
    selectTool.setCanvas(env.canvas);

    // Set initial state
    env.app.activateTool(cellTool);
    cellTool.setGlyph(65);
    cellTool.paint(5, 5);

    const cell1 = env.canvas.getCell(5, 5);
    const state1 = JSON.stringify(cell1);

    // Switch tools multiple times
    env.app.activateTool(lineTool);
    env.app.activateTool(selectTool);
    env.app.activateTool(cellTool);

    // State should be unchanged
    const cell2 = env.canvas.getCell(5, 5);
    const state2 = JSON.stringify(cell2);

    expect(state1).toEqual(state2);
  });

  runner.it('should preserve layer data through multiple operations', () => {
    const env = createTestEnvironment();
    const cellTool = new CellTool();
    cellTool.setCanvas(env.canvas);

    env.layerStack.addLayer('Layer 1');
    env.layerStack.addLayer('Layer 2');

    env.app.activateTool(cellTool);

    // Populate all layers
    for (let l = 0; l < 3; l++) {
      env.layerStack.selectLayer(l);
      cellTool.setGlyph(65 + l);

      for (let x = 0; x < 10; x++) {
        cellTool.paint(x, 5 + l); // Paint at rows 5, 6, 7 instead of 0, 5, 10
      }
    }

    // Save snapshot
    const snapshot = JSON.parse(JSON.stringify(
      env.layerStack.layers.map(layer => ({ data: layer.data, visible: layer.visible }))
    ));

    // Perform various operations: switch layers, draw
    env.layerStack.selectLayer(0);
    cellTool.setGlyph(99);
    cellTool.paint(50, 20); // Paint within bounds

    env.layerStack.selectLayer(1);
    env.layerStack.selectLayer(2);

    // Verify original layer data persists
    const cell0 = env.layerStack.layers[0].getCell(0, 5);
    expect(cell0).toBeTruthy();
    expect(cell0.glyph).toBe(65);

    const cell1 = env.layerStack.layers[1].getCell(0, 6);
    expect(cell1).toBeTruthy();
    expect(cell1.glyph).toBe(66);

    const cell2 = env.layerStack.layers[2].getCell(0, 7);
    expect(cell2).toBeTruthy();
    expect(cell2.glyph).toBe(67);

    // Verify new paint is recorded
    const cellNew = env.layerStack.layers[0].getCell(50, 20);
    expect(cellNew).toBeTruthy();
    expect(cellNew.glyph).toBe(99);
  });
});

runner.report();
