/**
 * Canvas Module Tests
 *
 * Run with: node tests/web/rexpaint-editor-canvas.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-canvas.test.js
 */

import { Canvas } from '../../web/rexpaint-editor/canvas.js';

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
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected > ${expected}, got ${value}`);
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
      this.font = '12px monospace';
      this.textAlign = 'left';
      this.textBaseline = 'top';
      this.pixelData = new Map(); // Store pixel data for getImageData
    }

    fillRect(x, y, w, h) {
      // Parse fillStyle color and store pixel data
      const [r, g, b] = this._parseColor(this.fillStyle);
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          this.pixelData.set(`${px},${py}`, [r, g, b, 255]);
        }
      }
    }

    fillText(text, x, y, maxWidth) {}

    _parseColor(colorStr) {
      // Parse rgb(r, g, b) format
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      }
      return [0, 0, 0];
    }

    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const pixel = this.pixelData.get(`${px},${py}`) || [0, 0, 0, 0];
          const idx = (py * w + px) * 4;
          data[idx] = pixel[0];
          data[idx + 1] = pixel[1];
          data[idx + 2] = pixel[2];
          data[idx + 3] = pixel[3];
        }
      }
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

// Run tests
const runner = new TestRunner();

runner.describe('Canvas Module', () => {
  runner.it('should render a single cell with glyph and colors', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    canvas.setCell(0, 0, 65, [255, 255, 255], [0, 0, 0]); // 'A' in white on black

    // Verify the cell was stored correctly
    const cell = canvas.getCell(0, 0);
    expect(cell.glyph).toBe(65); // 'A'
    expect(cell.fg[0]).toBe(255); // Red component of white
    expect(cell.bg[0]).toBe(0); // Red component of black background

    // Verify we can render without errors
    canvas.render();
    const imageData = canvas.getImageData();
    expect(imageData.data.length).toBeGreaterThan(0);
  });

  runner.it('should track grid dimensions', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    expect(canvas.width).toBe(80);
    expect(canvas.height).toBe(25);
  });

  runner.it('should convert cell coordinates to pixel coordinates', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    const pixels = canvas.cellToPixelCoords(5, 10);
    expect(pixels.x).toBeGreaterThan(-1);
    expect(pixels.y).toBeGreaterThan(-1);
  });

  runner.it('should return defensive copy from getCell() - mutating returned cell does not corrupt canvas', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    canvas.setCell(5, 10, 65, [255, 0, 0], [0, 0, 255]); // 'A' in red on blue

    // Get the cell and mutate the returned object
    const cell = canvas.getCell(5, 10);
    cell.glyph = 999;
    cell.fg[0] = 100;
    cell.fg[1] = 100;
    cell.bg[2] = 100;

    // Original cell should be unchanged
    const original = canvas.getCell(5, 10);
    expect(original.glyph).toBe(65);
    expect(original.fg[0]).toBe(255);
    expect(original.fg[1]).toBe(0);
    expect(original.fg[2]).toBe(0);
    expect(original.bg[0]).toBe(0);
    expect(original.bg[1]).toBe(0);
    expect(original.bg[2]).toBe(255);
  });

  runner.it('should return defensive copy from getCell() - mutating returned color arrays does not corrupt canvas', () => {
    const canvas = new Canvas(document.createElement('canvas'), 80, 25);
    canvas.setCell(3, 7, 42, [100, 150, 200], [50, 75, 100]); // '#' in custom colors

    // Get the cell and mutate color arrays
    const cell = canvas.getCell(3, 7);
    const fg = cell.fg;
    const bg = cell.bg;

    fg[0] = 0;
    fg[1] = 0;
    fg[2] = 0;
    bg[0] = 255;
    bg[1] = 255;
    bg[2] = 255;

    // Original cell colors should be unchanged
    const original = canvas.getCell(3, 7);
    expect(original.fg[0]).toBe(100);
    expect(original.fg[1]).toBe(150);
    expect(original.fg[2]).toBe(200);
    expect(original.bg[0]).toBe(50);
    expect(original.bg[1]).toBe(75);
    expect(original.bg[2]).toBe(100);
  });

  runner.it('should detach mouse event handlers on dispose()', () => {
    const canvasElement = document.createElement('canvas');
    const listeners = new Map();

    // Mock addEventListener/removeEventListener to track calls
    canvasElement.addEventListener = function(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    };

    canvasElement.removeEventListener = function(event, handler) {
      if (listeners.has(event)) {
        const arr = listeners.get(event);
        const idx = arr.indexOf(handler);
        if (idx > -1) {
          arr.splice(idx, 1);
        }
      }
    };

    const canvas = new Canvas(canvasElement, 80, 25);

    // Verify handlers were attached
    expect(listeners.get('mousedown').length).toBe(1);
    expect(listeners.get('mousemove').length).toBe(1);
    expect(listeners.get('mouseup').length).toBe(1);
    expect(listeners.get('mouseleave').length).toBe(1);

    // Dispose should remove all handlers
    canvas.dispose();

    // Verify all handlers were removed
    expect(listeners.get('mousedown').length).toBe(0);
    expect(listeners.get('mousemove').length).toBe(0);
    expect(listeners.get('mouseup').length).toBe(0);
    expect(listeners.get('mouseleave').length).toBe(0);
  });
});

runner.report();
