/**
 * EditorApp Tests
 *
 * Run with: node tests/web/rexpaint-editor-app.test.js
 */

import { EditorApp } from '../../web/rexpaint-editor/editor-app.js';

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
  toContainEqual(expected) {
    const found = value && value.some(item => JSON.stringify(item) === JSON.stringify(expected));
    if (!found) {
      throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
    }
  },
  toBeGreaterThanOrEqual(expected) {
    if (value < expected) {
      throw new Error(`Expected >= ${expected}, got ${value}`);
    }
  },
});

// Mock EventEmitter base
class MockEventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);

    return () => {
      const listeners = this._listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  emit(event, ...args) {
    const callbacks = this._listeners.get(event) || [];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  dispose() {
    this._listeners.clear();
  }
}

// Mock Canvas
class MockCanvas extends MockEventEmitter {
  constructor() {
    super();
    this.activeTool = null;
    this.disposeCalled = false;
    this.fontSize = 12;
  }

  setActiveTool(tool) {
    this.activeTool = tool;
  }

  setFontSize(size) {
    if (![8, 10, 12, 16].includes(size)) {
      throw new Error('Font size must be 8, 10, 12, or 16 pixels');
    }
    this.fontSize = size;
  }

  getFontSize() {
    return this.fontSize;
  }

  dispose() {
    this.disposeCalled = true;
    super.dispose();
  }
}

// Mock Palette
class MockPalette extends MockEventEmitter {
  constructor() {
    super();
    this.disposeCalled = false;
  }

  dispose() {
    this.disposeCalled = true;
    super.dispose();
  }
}

// Mock GlyphPicker
class MockGlyphPicker extends MockEventEmitter {
  constructor() {
    super();
    this.disposeCalled = false;
  }

  dispose() {
    this.disposeCalled = true;
    super.dispose();
  }
}

// Mock CellTool
class MockCellTool {
  constructor() {
    this.glyph = 0;
    this.fg = [255, 255, 255];
    this.bg = [0, 0, 0];
    this.applyModes = { glyph: true, foreground: true, background: true };
    this.paintCalls = [];
    this.deactivateCalled = false;
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

  paint(x, y) {
    this.paintCalls.push([x, y]);
  }

  startDrag(x, y) {
    this.paint(x, y);
  }

  drag(x, y) {
    this.paint(x, y);
  }

  endDrag() {
    // no-op
  }

  deactivate() {
    this.deactivateCalled = true;
  }
}

// Mock LineTool
class MockLineTool {
  constructor() {
    this.glyph = 0;
    this.fg = [255, 255, 255];
    this.bg = [0, 0, 0];
    this.applyModes = { glyph: true, foreground: true, background: true };
    this.deactivateCalled = false;
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

  deactivate() {
    this.deactivateCalled = true;
  }
}

// Run tests
const runner = new TestRunner();

runner.describe('EditorApp', () => {
  runner.it('should initialize with all components', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    expect(app.canvas).toBe(canvas);
    expect(app.palette).toBe(palette);
    expect(app.glyphPicker).toBe(glyphPicker);
  });

  runner.it('should have default state', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    expect(app.activeGlyph).toBe(0);
    expect(app.activeFg).toEqual([255, 255, 255]);
    expect(app.activeBg).toEqual([0, 0, 0]);
    expect(app.activeApplyModes).toEqual({ glyph: true, foreground: true, background: true });
  });

  runner.it('should update tool when glyph picker selects glyph', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();
    const tool = new MockCellTool();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.activateTool(tool);

    glyphPicker.emit('select', 65);

    expect(tool.glyph).toBe(65);
    expect(app.activeGlyph).toBe(65);
  });

  runner.it('should update tool when palette changes foreground color', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();
    const tool = new MockCellTool();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.activateTool(tool);

    palette.emit('color-changed', { fg: [255, 0, 0], bg: [0, 0, 0] });

    expect(tool.fg).toEqual([255, 0, 0]);
    expect(app.activeFg).toEqual([255, 0, 0]);
  });

  runner.it('should update tool when palette changes apply modes', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();
    const tool = new MockCellTool();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.activateTool(tool);

    palette.emit('apply-mode-changed', { glyph: false, foreground: true, background: true });

    expect(tool.applyModes.glyph).toBe(false);
  });

  runner.it('should route canvas paint events through active tool', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();
    const tool = new MockCellTool();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.activateTool(tool);

    app.paint(5, 10);

    expect(tool.paintCalls).toContainEqual([5, 10]);
  });

  runner.it('should support tool switching and call deactivate on old tool', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();
    const cellTool = new MockCellTool();
    const lineTool = new MockLineTool();

    const app = new EditorApp({ canvas, palette, glyphPicker });

    app.activateTool(cellTool);
    expect(app.activeTool).toBe(cellTool);

    app.activateTool(lineTool);
    expect(app.activeTool).toBe(lineTool);
    expect(cellTool.deactivateCalled).toBe(true);
  });

  runner.it('should handle drag operations on active tool', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();
    const tool = new MockCellTool();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.activateTool(tool);

    app.startDrag(5, 10);
    app.drag(6, 10);
    app.endDrag();

    expect(tool.paintCalls.length).toBeGreaterThanOrEqual(1);
  });

  runner.it('should dispose all components when called', () => {
    const canvas = new MockCanvas();
    const palette = new MockPalette();
    const glyphPicker = new MockGlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.dispose();

    expect(canvas.disposeCalled).toBe(true);
    expect(palette.disposeCalled).toBe(true);
    expect(glyphPicker.disposeCalled).toBe(true);
  });
});

runner.report();
