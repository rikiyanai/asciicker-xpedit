/**
 * Input Validation Tests - Comprehensive validation for drawing operations
 *
 * Run with: node tests/web/rexpaint-editor-input-validation.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-input-validation.test.js
 */

import { Canvas } from '../../web/rexpaint-editor/canvas.js';
import { CellTool } from '../../web/rexpaint-editor/tools/cell-tool.js';
import { LineTool } from '../../web/rexpaint-editor/tools/line-tool.js';
import { RectTool } from '../../web/rexpaint-editor/tools/rect-tool.js';
import { OvalTool } from '../../web/rexpaint-editor/tools/oval-tool.js';

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
  toThrow() {
    let thrown = false;
    try {
      if (typeof value === 'function') {
        value();
      }
    } catch (e) {
      thrown = true;
    }
    if (!thrown) {
      throw new Error('Expected function to throw an error');
    }
  },
});

// Mock HTMLCanvasElement for Node.js environment
if (typeof HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class {
    constructor() {
      this.width = 0;
      this.height = 0;
      this._context = null;
    }

    getContext(type) {
      if (!this._context) {
        this._context = new CanvasContext(this);
      }
      return this._context;
    }
  };

  class CanvasContext {
    constructor(canvas) {
      this.canvas = canvas;
      this.fillStyle = '#000000';
      this.strokeStyle = '#000000';
      this.lineWidth = 1;
      this.lineDashOffset = 0;
      this.font = '12px monospace';
      this.textAlign = 'left';
      this.textBaseline = 'top';
      this.pixelData = new Map();
    }

    fillRect(x, y, w, h) {
      const [r, g, b] = this._parseColor(this.fillStyle);
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          this.pixelData.set(`${px},${py}`, [r, g, b, 255]);
        }
      }
    }

    strokeRect(x, y, w, h) {}
    fillText(text, x, y, maxWidth) {}
    setLineDash(dash) {}

    _parseColor(colorStr) {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      }
      return [0, 0, 0];
    }

    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      return {
        data: data,
        width: w,
        height: h,
      };
    }
  }
}

// Mock document.createElement
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return new HTMLCanvasElement();
      }
      throw new Error(`Unsupported element: ${tag}`);
    },
  };
}

// Mock requestAnimationFrame for Node.js environment
if (typeof requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (callback) => {
    return 0;
  };
}

// Run tests
const runner = new TestRunner();

runner.describe('Canvas Input Validation', () => {
  runner.it('should reject non-integer coordinates', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    let errorThrown = false;
    try {
      canvas.setCell(5.5, 10, 65, [255, 255, 255], [0, 0, 0]);
    } catch (e) {
      errorThrown = true;
      if (!e.message.includes('must be integers')) {
        throw new Error(`Expected integer validation error, got: ${e.message}`);
      }
    }
    if (!errorThrown) {
      throw new Error('Expected error for non-integer coordinates');
    }
  });

  runner.it('should reject out-of-bounds coordinates', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    const cases = [
      { x: -1, y: 10, desc: 'negative x' },
      { x: 10, y: -1, desc: 'negative y' },
      { x: 80, y: 10, desc: 'x >= width' },
      { x: 10, y: 25, desc: 'y >= height' },
    ];

    cases.forEach(({ x, y, desc }) => {
      let errorThrown = false;
      try {
        canvas.setCell(x, y, 65, [255, 255, 255], [0, 0, 0]);
      } catch (e) {
        errorThrown = true;
        if (!e.message.includes('out of bounds')) {
          throw new Error(`Expected bounds error for ${desc}, got: ${e.message}`);
        }
      }
      if (!errorThrown) {
        throw new Error(`Expected error for ${desc}`);
      }
    });
  });

  runner.it('should reject invalid glyph values', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    const invalidGlyphs = [
      { glyph: -1, desc: 'negative glyph' },
      { glyph: 256, desc: 'glyph > 255' },
      { glyph: 5.5, desc: 'non-integer glyph' },
      { glyph: Infinity, desc: 'infinity glyph' },
    ];

    invalidGlyphs.forEach(({ glyph, desc }) => {
      let errorThrown = false;
      try {
        canvas.setCell(10, 10, glyph, [255, 255, 255], [0, 0, 0]);
      } catch (e) {
        errorThrown = true;
        if (!e.message.includes('Invalid glyph')) {
          throw new Error(`Expected glyph error for ${desc}, got: ${e.message}`);
        }
      }
      if (!errorThrown) {
        throw new Error(`Expected error for ${desc}`);
      }
    });
  });

  runner.it('should reject invalid foreground colors', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    const invalidColors = [
      { color: null, desc: 'null color' },
      { color: [255, 255], desc: 'color with 2 components' },
      { color: [255, 255, 255, 255], desc: 'color with 4 components' },
      { color: [256, 0, 0], desc: 'color component > 255' },
      { color: [-1, 0, 0], desc: 'color component < 0' },
      { color: [255.5, 0, 0], desc: 'non-integer color component' },
      { color: "red", desc: 'string color' },
    ];

    invalidColors.forEach(({ color, desc }) => {
      let errorThrown = false;
      try {
        canvas.setCell(10, 10, 65, color, [0, 0, 0]);
      } catch (e) {
        errorThrown = true;
        if (!e.message.includes('Invalid foreground')) {
          throw new Error(`Expected foreground color error for ${desc}, got: ${e.message}`);
        }
      }
      if (!errorThrown) {
        throw new Error(`Expected error for ${desc}`);
      }
    });
  });

  runner.it('should reject invalid background colors', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    const invalidColors = [
      { color: null, desc: 'null color' },
      { color: [0, 0], desc: 'color with 2 components' },
      { color: [0, 0, 0, 0], desc: 'color with 4 components' },
      { color: [300, 0, 0], desc: 'color component > 255' },
      { color: [-5, 0, 0], desc: 'color component < 0' },
      { color: [0, 100.5, 0], desc: 'non-integer color component' },
    ];

    invalidColors.forEach(({ color, desc }) => {
      let errorThrown = false;
      try {
        canvas.setCell(10, 10, 65, [255, 255, 255], color);
      } catch (e) {
        errorThrown = true;
        if (!e.message.includes('Invalid background')) {
          throw new Error(`Expected background color error for ${desc}, got: ${e.message}`);
        }
      }
      if (!errorThrown) {
        throw new Error(`Expected error for ${desc}`);
      }
    });
  });

  runner.it('should accept valid cell data', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    // These should not throw
    canvas.setCell(0, 0, 0, [0, 0, 0], [0, 0, 0]);
    canvas.setCell(79, 24, 255, [255, 255, 255], [255, 255, 255]);
    canvas.setCell(40, 12, 65, [128, 128, 128], [64, 32, 192]);

    // Verify data was stored
    const cell = canvas.getCell(40, 12);
    expect(cell.glyph).toBe(65);
    expect(cell.fg).toEqual([128, 128, 128]);
    expect(cell.bg).toEqual([64, 32, 192]);
  });
});

runner.describe('CellTool Input Validation', () => {
  runner.it('should silently ignore non-integer coordinates in paint()', () => {
    const tool = new CellTool();
    const canvas = { width: 80, height: 25, setCell: () => {}, getCell: () => ({ glyph: 0, fg: [255, 255, 255], bg: [0, 0, 0] }) };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    // These should not throw, just be silently ignored
    tool.paint(5.5, 10);
    tool.paint(5, 10.5);
    tool.paint(Infinity, 10);
  });

  runner.it('should silently ignore out-of-bounds paint operations', () => {
    const tool = new CellTool();
    const canvas = { width: 80, height: 25, setCell: () => {}, getCell: () => ({ glyph: 0, fg: [255, 255, 255], bg: [0, 0, 0] }) };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    // These should not throw, just be silently ignored
    tool.paint(-1, 10);
    tool.paint(80, 10);
    tool.paint(10, -1);
    tool.paint(10, 25);
  });

  runner.it('should paint valid coordinates', () => {
    const tool = new CellTool();
    let lastCall = null;
    const canvas = {
      width: 80,
      height: 25,
      setCell: function(x, y, g, fg, bg) { lastCall = { x, y, g, fg, bg }; },
      getCell: () => ({ glyph: 0, fg: [255, 255, 255], bg: [0, 0, 0] })
    };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.paint(40, 12);

    expect(lastCall !== null).toBe(true);
    expect(lastCall.x).toBe(40);
    expect(lastCall.y).toBe(12);
  });
});

runner.describe('LineTool Input Validation', () => {
  runner.it('should silently ignore non-integer coordinates in startLine()', () => {
    const tool = new LineTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    // These should not throw, just be silently ignored
    tool.startLine(5.5, 10);
    tool.startLine(5, 10.5);

    expect(tool.isDrawing).toBe(false);
  });

  runner.it('should silently ignore out-of-bounds startLine()', () => {
    const tool = new LineTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    // These should not throw
    tool.startLine(-1, 10);
    tool.startLine(80, 10);
    tool.startLine(10, -1);
    tool.startLine(10, 25);

    expect(tool.isDrawing).toBe(false);
  });

  runner.it('should start valid line draws', () => {
    const tool = new LineTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    tool.startLine(10, 5);

    expect(tool.isDrawing).toBe(true);
    expect(tool.lineStartX).toBe(10);
    expect(tool.lineStartY).toBe(5);
  });
});

runner.describe('RectTool Input Validation', () => {
  runner.it('should silently ignore non-integer coordinates in startRect()', () => {
    const tool = new RectTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    // These should not throw, just be silently ignored
    tool.startRect(5.5, 10);
    tool.startRect(5, 10.5);

    expect(tool.isDrawing).toBe(false);
  });

  runner.it('should silently ignore out-of-bounds startRect()', () => {
    const tool = new RectTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    // These should not throw
    tool.startRect(-1, 10);
    tool.startRect(80, 10);
    tool.startRect(10, -1);
    tool.startRect(10, 25);

    expect(tool.isDrawing).toBe(false);
  });

  runner.it('should start valid rectangle draws', () => {
    const tool = new RectTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    tool.startRect(10, 5);

    expect(tool.isDrawing).toBe(true);
    expect(tool.rectStartX).toBe(10);
    expect(tool.rectStartY).toBe(5);
  });
});

runner.describe('OvalTool Input Validation', () => {
  runner.it('should silently ignore non-integer coordinates in startDrag()', () => {
    const tool = new OvalTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    // These should not throw, just be silently ignored
    tool.startDrag(5.5, 10);
    tool.startDrag(5, 10.5);

    expect(tool.isDrawing).toBe(false);
  });

  runner.it('should silently ignore out-of-bounds startDrag()', () => {
    const tool = new OvalTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    // These should not throw
    tool.startDrag(-1, 10);
    tool.startDrag(80, 10);
    tool.startDrag(10, -1);
    tool.startDrag(10, 25);

    expect(tool.isDrawing).toBe(false);
  });

  runner.it('should start valid oval draws', () => {
    const tool = new OvalTool();
    const canvas = { width: 80, height: 25 };
    tool.setCanvas(canvas);

    tool.startDrag(10, 5);

    expect(tool.isDrawing).toBe(true);
    expect(tool.ovalStartX).toBe(10);
    expect(tool.ovalStartY).toBe(5);
  });
});

runner.describe('Validation Error Messages', () => {
  runner.it('should provide clear coordinate error messages', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    try {
      canvas.setCell(5.5, 10, 65, [255, 255, 255], [0, 0, 0]);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message.includes('coordinates')).toBe(true);
      expect(e.message.includes('5.5')).toBe(true);
    }
  });

  runner.it('should provide clear glyph error messages', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    try {
      canvas.setCell(10, 10, 300, [255, 255, 255], [0, 0, 0]);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message.includes('glyph')).toBe(true);
      expect(e.message.includes('300')).toBe(true);
    }
  });

  runner.it('should provide clear color error messages', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);

    try {
      canvas.setCell(10, 10, 65, [255, 255], [0, 0, 0]);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message.includes('foreground')).toBe(true);
      expect(e.message.includes('length')).toBe(true);
    }
  });
});

runner.report();
