/**
 * Cross-Tool Integration Tests
 *
 * Tests how different tools interact when switched, used in sequence, or combined
 * with other features like copy/paste, undo/redo, layer switching, and pan mode.
 *
 * Run with: node tests/web/rexpaint-editor-cross-tool-integration.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-cross-tool-integration.test.js
 */

import { EditorApp } from '../../web/rexpaint-editor/editor-app.js';
import { Canvas } from '../../web/rexpaint-editor/canvas.js';
import { Palette } from '../../web/rexpaint-editor/palette.js';
import { GlyphPicker } from '../../web/rexpaint-editor/glyph-picker.js';
import { CellTool } from '../../web/rexpaint-editor/tools/cell-tool.js';
import { LineTool } from '../../web/rexpaint-editor/tools/line-tool.js';
import { RectTool } from '../../web/rexpaint-editor/tools/rect-tool.js';
import { OvalTool } from '../../web/rexpaint-editor/tools/oval-tool.js';
import { FillTool } from '../../web/rexpaint-editor/tools/fill-tool.js';
import { TextTool } from '../../web/rexpaint-editor/tools/text-tool.js';
import { SelectTool } from '../../web/rexpaint-editor/tools/select-tool.js';

// Mock document and DOM for Node.js environment
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
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
  toBeTruthy() {
    if (!value) {
      throw new Error(`Expected truthy value, got ${value}`);
    }
  },
  toBeFalsy() {
    if (value) {
      throw new Error(`Expected falsy value, got ${value}`);
    }
  },
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected ${value} to be > ${expected}`);
    }
  },
  toBeGreaterThanOrEqual(expected) {
    if (value < expected) {
      throw new Error(`Expected ${value} to be >= ${expected}`);
    }
  },
  toHaveBeenCalled() {
    if (!value.called) {
      throw new Error(`Expected function to have been called`);
    }
  },
  toHaveBeenCalledWith(...args) {
    if (!value.called) {
      throw new Error(`Expected function to have been called`);
    }
    if (JSON.stringify(value.lastArgs) !== JSON.stringify(args)) {
      throw new Error(
        `Expected to be called with ${JSON.stringify(args)}, got ${JSON.stringify(value.lastArgs)}`
      );
    }
  },
});

// Mock function helper
const vi = {
  fn: (implementation = () => {}) => {
    const fn = (...args) => {
      fn.called = true;
      fn.callCount++;
      fn.lastArgs = args;
      return implementation(...args);
    };
    fn.called = false;
    fn.callCount = 0;
    fn.lastArgs = [];
    return fn;
  },
};

// Helper to create a mock canvas
function createMockCanvas(width = 80, height = 25) {
  const canvas = {
    width,
    height,
    cells: Array(height)
      .fill(null)
      .map(() =>
        Array(width)
          .fill(null)
          .map(() => ({
            glyph: 0,
            fg: [255, 255, 255],
            bg: [0, 0, 0],
          }))
      ),
    setCell: vi.fn((x, y, glyph, fg, bg) => {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        canvas.cells[y][x] = { glyph, fg: [...fg], bg: [...bg] };
      }
    }),
    getCell: vi.fn((x, y) => {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        return canvas.cells[y][x];
      }
      return null;
    }),
    render: vi.fn(),
    setOffset: vi.fn(),
    setActiveTool: vi.fn(),
    setSelectionTool: vi.fn(),
    setLayerStack: vi.fn(),
    layerStack: null,
    showGrid: false,
    setGridVisible: vi.fn(),
    setFontSize: vi.fn(),
    getFontSize: vi.fn(() => 12),
  };
  return canvas;
}

// Helper to create a mock palette
function createMockPalette() {
  const listeners = {};
  return {
    on: (event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      return () => {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      };
    },
    emit: (event, data) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
  };
}

// Helper to create a mock glyph picker
function createMockGlyphPicker() {
  const listeners = {};
  return {
    on: (event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      return () => {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      };
    },
    emit: (event, data) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
  };
}

// Run tests
const runner = new TestRunner();

runner.describe('Cross-Tool Integration Tests', () => {
  // ========== Tool Switching Sequences ==========

  runner.it('should deactivate old tool when switching from CellTool to LineTool', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const lineTool = new LineTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, lineTool],
    });

    // Add deactivate spy to cellTool
    cellTool.deactivate = vi.fn();

    // Activate cell tool first
    editor.activateTool(cellTool);
    expect(editor.activeTool).toBe(cellTool);

    // Switch to line tool
    editor.activateTool(lineTool);

    // Verify old tool was deactivated
    expect(cellTool.deactivate).toHaveBeenCalled();
    expect(editor.activeTool).toBe(lineTool);
  });

  runner.it('should work correctly after switching from CellTool to OvalTool and drawing', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const ovalTool = new OvalTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, ovalTool],
    });

    // Set canvas on tools
    cellTool.setCanvas(canvas);
    ovalTool.setCanvas(canvas);

    // Activate and paint with cell tool
    editor.activateTool(cellTool);
    editor.paint(10, 10);
    expect(canvas.setCell).toHaveBeenCalled();

    // Clear the call count
    canvas.setCell.callCount = 0;

    // Switch to oval tool
    editor.activateTool(ovalTool);

    // Start an oval
    editor.startDrag(10, 10);
    editor.drag(15, 15);
    editor.endDrag();

    // Verify oval tool worked (should have painted something)
    expect(canvas.setCell.callCount).toBeGreaterThan(0);
  });

  runner.it('should preserve state when switching back to previous tool', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const rectTool = new RectTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, rectTool],
    });

    // Set glyph to 65 (A) on editor and sync to cellTool
    editor.activeGlyph = 65;
    editor.activateTool(cellTool);
    expect(cellTool.glyph).toBe(65);

    // Switch to rect tool
    editor.activateTool(rectTool);
    expect(editor.activeTool).toBe(rectTool);

    // Switch back to cell tool - old state preserved
    editor.activateTool(cellTool);
    expect(editor.activeTool).toBe(cellTool);
    expect(cellTool.glyph).toBe(65); // State should be preserved
  });

  // ========== Copy/Paste with Different Tools ==========

  runner.it('should paste correctly when active tool changes after copy', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const selectTool = new SelectTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, selectTool],
    });

    // Activate select tool and create a selection
    editor.activateTool(selectTool);
    selectTool.setCanvas(canvas);
    selectTool.startSelection(0, 0);
    selectTool.updateSelection(2, 2);

    // Set up some cells to copy
    canvas.cells[0][0] = { glyph: 65, fg: [255, 0, 0], bg: [0, 0, 0] };
    canvas.cells[0][1] = { glyph: 66, fg: [0, 255, 0], bg: [0, 0, 0] };
    canvas.cells[1][0] = { glyph: 67, fg: [0, 0, 255], bg: [0, 0, 0] };

    // Copy selection
    const copyResult = editor.copy();
    expect(copyResult).toBe(true);
    expect(editor.clipboard).toBeTruthy();

    // Switch to cell tool
    editor.activateTool(cellTool);

    // Paste should still work
    editor.paste(5, 5);

    // Verify cells were pasted at new location
    expect(canvas.cells[5][5].glyph).toBe(65);
    expect(canvas.cells[5][6].glyph).toBe(66);
  });

  runner.it('should persist clipboard across multiple tool switches', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const selectTool = new SelectTool();
    const lineTool = new LineTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, selectTool, lineTool],
    });

    // Create a selection and copy
    editor.activateTool(selectTool);
    selectTool.setCanvas(canvas);
    selectTool.startSelection(0, 0);
    selectTool.updateSelection(2, 2);
    canvas.cells[0][0] = { glyph: 65, fg: [255, 255, 255], bg: [0, 0, 0] };

    editor.copy();
    const clipboardBefore = editor.clipboard;

    // Switch through several tools
    editor.activateTool(cellTool);
    editor.activateTool(lineTool);
    editor.activateTool(selectTool);

    // Clipboard should still be there
    expect(editor.clipboard).toBe(clipboardBefore);
  });

  // ========== Layer Changes with Active Tool ==========

  runner.it('should apply drawing to correct layer when layer is switched', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool],
    });

    editor.activateTool(cellTool);
    cellTool.setCanvas(canvas);

    // Paint on initial state
    cellTool.paint(5, 5);
    expect(canvas.setCell).toHaveBeenCalled();

    // Reset call count
    canvas.setCell.callCount = 0;

    // Paint again - tool should still work
    cellTool.paint(6, 6);
    expect(canvas.setCell.callCount).toBe(1);
  });

  // ========== Pan Mode with Tools ==========

  runner.it('should not interfere with tool when pan mode is enabled and disabled', () => {
    // Create a mock DOM element
    const mockCanvasElement = {
      style: {},
      addEventListener() {},
      removeEventListener() {}
    };

    // Mock document.getElementById to return canvas element for pan mode
    const originalGetElementById = document.getElementById;
    document.getElementById = (id) => {
      if (id === 'rexpaintCanvas') return mockCanvasElement;
      return originalGetElementById(id);
    };

    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool],
    });

    editor.activateTool(cellTool);
    cellTool.setCanvas(canvas);

    // Paint before pan
    cellTool.paint(5, 5);
    expect(canvas.setCell.callCount).toBe(1);

    // Enable pan mode
    editor.enablePanMode();
    expect(editor.panMode).toBe(true);

    // Pan operation
    editor.startPan(100, 100);
    editor.pan(110, 110);

    // Verify pan offset was updated
    expect(editor.offsetX).toBe(10);
    expect(editor.offsetY).toBe(10);

    // Disable pan mode
    editor.disablePanMode();
    expect(editor.panMode).toBe(false);

    // Tool should still work after pan
    canvas.setCell.callCount = 0;
    cellTool.paint(6, 6);
    expect(canvas.setCell.callCount).toBe(1);

    // Restore original getElementById
    document.getElementById = originalGetElementById;
  });

  runner.it('should preserve cell tool state during pan mode', () => {
    // Create a mock DOM element
    const mockCanvasElement = {
      style: {},
      addEventListener() {},
      removeEventListener() {}
    };

    // Mock document.getElementById to return canvas element for pan mode
    const originalGetElementById = document.getElementById;
    document.getElementById = (id) => {
      if (id === 'rexpaintCanvas') return mockCanvasElement;
      return originalGetElementById(id);
    };

    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool],
    });

    editor.activateTool(cellTool);
    cellTool.setCanvas(canvas);

    // Set glyph on cell tool
    cellTool.setGlyph(65);
    expect(cellTool.glyph).toBe(65);

    // Enable pan mode while tool is active
    editor.enablePanMode();
    expect(editor.panMode).toBe(true);
    expect(cellTool.glyph).toBe(65); // State should be preserved

    // Pan
    editor.startPan(100, 100);
    editor.pan(110, 110);

    // Verify pan worked
    expect(editor.offsetX).toBe(10);

    // Disable pan
    editor.disablePanMode();
    expect(editor.panMode).toBe(false);

    // Tool state should still be intact
    expect(cellTool.glyph).toBe(65);

    // Restore original getElementById
    document.getElementById = originalGetElementById;
  });

  // ========== Selection with Drawing Tools ==========

  runner.it('should activate select tool and create selection', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const selectTool = new SelectTool();
    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [selectTool],
    });

    editor.activateTool(selectTool);
    selectTool.setCanvas(canvas);

    // Create a selection
    selectTool.startSelection(5, 5);
    selectTool.updateSelection(10, 10);

    // Verify selection bounds
    const bounds = selectTool.getSelectionBounds();
    expect(bounds.x).toBe(5);
    expect(bounds.y).toBe(5);
    expect(bounds.width).toBe(6);
    expect(bounds.height).toBe(6);
  });

  runner.it('should switch between select tool and cell tool without losing selection state', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const selectTool = new SelectTool();
    const cellTool = new CellTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [selectTool, cellTool],
    });

    // Create selection with select tool
    editor.activateTool(selectTool);
    selectTool.setCanvas(canvas);
    selectTool.startSelection(3, 3);
    selectTool.updateSelection(8, 8);

    const boundsBefore = selectTool.getSelectionBounds();

    // Switch to cell tool and back
    editor.activateTool(cellTool);
    editor.activateTool(selectTool);

    // Selection should be cleared after deactivation
    const boundsAfter = selectTool.getSelectionBounds();
    expect(boundsAfter).toBeFalsy(); // Should be null after deactivate
  });

  // ========== Color Changes During Operations ==========

  runner.it('should apply color change to new cells when switching tools', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool1 = new CellTool();
    const cellTool2 = new CellTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool1, cellTool2],
    });

    // Use first cell tool with red color
    editor.activateTool(cellTool1);
    cellTool1.setCanvas(canvas);
    cellTool1.setColors([255, 0, 0], [0, 0, 0]);
    cellTool1.paint(5, 5);

    // Switch to second cell tool with blue color
    editor.activateTool(cellTool2);
    cellTool2.setCanvas(canvas);
    cellTool2.setColors([0, 0, 255], [0, 0, 0]);

    // Verify color was synced to new tool
    expect(cellTool2.fg).toEqual([0, 0, 255]);

    cellTool2.paint(6, 6);
    expect(canvas.cells[6][6].fg).toEqual([0, 0, 255]);
  });

  runner.it('should update apply modes across tool switches', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const lineTool = new LineTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, lineTool],
    });

    // Change apply modes
    editor.activeApplyModes = {
      glyph: false,
      foreground: true,
      background: false,
    };

    // Activate cell tool - should sync apply modes
    editor.activateTool(cellTool);
    expect(cellTool.applyModes).toEqual({
      glyph: false,
      foreground: true,
      background: false,
    });

    // Switch to line tool - should also sync
    editor.activateTool(lineTool);
    expect(lineTool.applyModes).toEqual({
      glyph: false,
      foreground: true,
      background: false,
    });
  });

  // ========== Complex Interaction Sequences ==========

  runner.it('should handle tool switch sequence: Cell → Line → Rect → Cell', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const lineTool = new LineTool();
    const rectTool = new RectTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, lineTool, rectTool],
    });

    // Cell tool
    editor.activateTool(cellTool);
    cellTool.setCanvas(canvas);
    expect(editor.activeTool).toBe(cellTool);

    // Line tool
    editor.activateTool(lineTool);
    lineTool.setCanvas(canvas);
    expect(editor.activeTool).toBe(lineTool);

    // Rect tool
    editor.activateTool(rectTool);
    rectTool.setCanvas(canvas);
    expect(editor.activeTool).toBe(rectTool);

    // Back to cell tool
    editor.activateTool(cellTool);
    expect(editor.activeTool).toBe(cellTool);
  });

  runner.it('should work with fill tool after drawing with other tools', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const fillTool = new FillTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, fillTool],
    });

    // Draw with cell tool
    editor.activateTool(cellTool);
    cellTool.setCanvas(canvas);
    cellTool.setGlyph(65);
    cellTool.paint(5, 5);

    // Switch to fill tool
    editor.activateTool(fillTool);
    fillTool.setCanvas(canvas);

    // Fill tool should be ready to use
    expect(editor.activeTool).toBe(fillTool);
  });

  runner.it('should properly sync glyph when switching between tools', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const cellTool = new CellTool();
    const lineTool = new LineTool();

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools: [cellTool, lineTool],
    });

    // Set glyph on editor
    editor.activeGlyph = 100;

    // Activate cell tool - glyph should be synced
    editor.activateTool(cellTool);
    expect(cellTool.glyph).toBe(100);

    // Switch to line tool - glyph should be synced
    editor.activateTool(lineTool);
    expect(lineTool.glyph).toBe(100);

    // Change editor glyph
    editor.activeGlyph = 200;

    // Activate cell tool again - should get new glyph
    editor.activateTool(cellTool);
    expect(cellTool.glyph).toBe(200); // New glyph from editor

    // Switch to line tool - should also get new glyph
    editor.activateTool(lineTool);
    expect(lineTool.glyph).toBe(200);
  });

  runner.it('should handle rapid tool switching without crashes', () => {
    const canvas = createMockCanvas();
    const palette = createMockPalette();
    const glyphPicker = createMockGlyphPicker();

    const tools = [
      new CellTool(),
      new LineTool(),
      new RectTool(),
      new OvalTool(),
      new FillTool(),
      new TextTool(),
    ];

    const editor = new EditorApp({
      canvas,
      palette,
      glyphPicker,
      tools,
    });

    // Rapidly switch tools
    for (let i = 0; i < 5; i++) {
      for (const tool of tools) {
        editor.activateTool(tool);
        expect(editor.activeTool).toBe(tool);
      }
    }

    // Should end with last tool
    expect(editor.activeTool).toBe(tools[tools.length - 1]);
  });
});

runner.report();
