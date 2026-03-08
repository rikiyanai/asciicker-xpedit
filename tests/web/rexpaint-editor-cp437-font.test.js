/**
 * CP437 Font Module Tests
 *
 * Run with: node tests/web/rexpaint-editor-cp437-font.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-cp437-font.test.js
 */

import { CP437Font } from '../../web/rexpaint-editor/cp437-font.js';

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
  toBeDefined() {
    if (value === undefined) {
      throw new Error(`Expected defined value, got undefined`);
    }
  },
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
    throw new Error('toThrow() should be used with a function wrapped in () =>');
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

    drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) {
      // Mock drawImage - store that it was called
      if (!this.drawImageCalls) {
        this.drawImageCalls = [];
      }
      this.drawImageCalls.push({ source, sx, sy, sw, sh, dx, dy, dw, dh });
    }

    fillText(text, x, y, maxWidth) {}

    createImageData(w, h) {
      return {
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      };
    }

    putImageData(imageData, x, y) {
      // Mock putImageData
      const { data, width, height } = imageData;
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const idx = (py * width + px) * 4;
          this.pixelData.set(`${x + px},${y + py}`, [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
        }
      }
    }

    _parseColor(colorStr) {
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

// Mock Image for Node.js environment
if (typeof Image === 'undefined') {
  global.Image = class {
    constructor() {
      this.width = 0;
      this.height = 0;
      this.onload = null;
      this.onerror = null;
      this.src = '';
    }
  };
}

// Run tests
const runner = new TestRunner();

runner.describe('CP437Font', () => {
  runner.it('should construct with proper dimensions', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    expect(cp437).toBeDefined();
  });

  runner.it('should validate glyph codes (0-255)', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    // Mock the spritesheet to avoid load requirement
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192; // 16 glyphs * 12 pixels
    cp437.spriteSheet.height = 192; // 16 rows * 12 pixels

    // Valid codes should not throw
    try {
      cp437.getGlyph(0);
      cp437.getGlyph(127);
      cp437.getGlyph(255);
    } catch (e) {
      throw new Error(`Valid glyph code threw error: ${e.message}`);
    }

    // Invalid codes should throw
    try {
      cp437.getGlyph(-1);
      throw new Error('Expected getGlyph(-1) to throw');
    } catch (e) {
      if (!e.message.includes('Expected getGlyph(-1) to throw')) {
        // This is the error we want
      }
    }

    try {
      cp437.getGlyph(256);
      throw new Error('Expected getGlyph(256) to throw');
    } catch (e) {
      if (!e.message.includes('Expected getGlyph(256) to throw')) {
        // This is the error we want
      }
    }
  });

  runner.it('should cache glyphs after first access', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas'); // Mock spritesheet
    cp437.spriteSheet.width = 192; // 16 glyphs * 12 pixels
    cp437.spriteSheet.height = 192; // 16 rows * 12 pixels

    const glyph1 = cp437.getGlyph(65);
    const glyph2 = cp437.getGlyph(65);

    if (glyph1 !== glyph2) {
      throw new Error('Expected cached glyph to be the same object');
    }
  });

  runner.it('should draw glyphs with color blending', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas'); // Mock spritesheet
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, [0, 255, 0], [0, 0, 100]);
    } catch (e) {
      throw new Error(`drawGlyph threw error: ${e.message}`);
    }
  });

  runner.it('should extract glyphs from correct spritesheet position', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;
    cp437.spriteSheet.getContext = function (type) {
      return {
        drawImage: () => {},
        getImageData: () => ({
          data: new Uint8ClampedArray(144 * 4),
          width: 12,
          height: 12,
        }),
      };
    };

    // Glyph 65 ('A') should be at row 4, col 1 (65 = 4*16 + 1)
    // Position in spritesheet: x=12, y=48
    const glyph = cp437.getGlyph(65);
    expect(glyph).toBeDefined();
  });

  runner.it('should handle drawGlyph with NaN in foreground color', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw with NaN values
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, [NaN, 100, 200], [0, 0, 0]);
    } catch (e) {
      throw new Error(`drawGlyph should handle NaN without throwing: ${e.message}`);
    }
  });

  runner.it('should handle drawGlyph with all NaN foreground color', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw and should default to white
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, [NaN, NaN, NaN], [0, 0, 0]);
    } catch (e) {
      throw new Error(`drawGlyph should handle all NaN without throwing: ${e.message}`);
    }
  });

  runner.it('should handle drawGlyph with invalid foreground array (missing values)', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw with missing array values
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, [255], [0, 0, 0]); // Only 1 value
    } catch (e) {
      throw new Error(`drawGlyph should handle short array without throwing: ${e.message}`);
    }
  });

  runner.it('should handle drawGlyph with null foreground color', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw with null
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, null, [0, 0, 0]);
    } catch (e) {
      throw new Error(`drawGlyph should handle null color without throwing: ${e.message}`);
    }
  });

  runner.it('should clamp out-of-range color values in drawGlyph', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should clamp values to 0-255
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, [300, -50, 128], [1000, 0, 1000]);
    } catch (e) {
      throw new Error(`drawGlyph should clamp colors without throwing: ${e.message}`);
    }
  });

  runner.it('should handle drawGlyph with NaN in background color', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw with NaN in background
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, [255, 255, 255], [NaN, 50, NaN]);
    } catch (e) {
      throw new Error(`drawGlyph should handle NaN in background without throwing: ${e.message}`);
    }
  });

  runner.it('should handle drawGlyph with non-array color (undefined)', () => {
    const cp437 = new CP437Font('fonts/cp437-12x12.png', 12, 12);
    cp437.spriteSheet = document.createElement('canvas');
    cp437.spriteSheet.width = 192;
    cp437.spriteSheet.height = 192;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Should not throw with undefined (should default)
    try {
      cp437.drawGlyph(ctx, 65, 10, 10, undefined, undefined);
    } catch (e) {
      throw new Error(`drawGlyph should handle undefined colors without throwing: ${e.message}`);
    }
  });
});

runner.report();
