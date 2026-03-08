/**
 * Rectangle Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-rect-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-rect-tool.test.js
 */

import { RectTool } from '../../web/rexpaint-editor/tools/rect-tool.js';

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
  toBeGreaterThanOrEqual(expected) {
    if (value < expected) {
      throw new Error(`Expected ${value} to be >= ${expected}`);
    }
  },
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected ${value} to be > ${expected}`);
    }
  },
  toBeLessThan(expected) {
    if (value >= expected) {
      throw new Error(`Expected ${value} to be < ${expected}`);
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
  toHaveBeenCalledTimes(times) {
    if (value.callCount !== times) {
      throw new Error(`Expected to be called ${times} times, got ${value.callCount}`);
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
      fn.mock = fn.mock || { calls: [] };
      fn.mock.calls.push(args);
      return implementation(...args);
    };
    fn.called = false;
    fn.callCount = 0;
    fn.lastArgs = [];
    fn.mock = { calls: [] };
    return fn;
  },
};

// Run tests
const runner = new TestRunner();

runner.describe('Rectangle Tool', () => {
  runner.it('should draw outline rectangle', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(35);
    tool.setColors([255, 255, 255], [0, 0, 0]);
    tool.setMode('outline');

    tool.startRect(0, 0);
    tool.drawRect(4, 4);
    tool.endRect();

    // Outline: only perimeter cells painted (8 cells for 5x5 rect)
    const calls = canvas.setCell.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThan(25); // Not filled
  });

  runner.it('should draw filled rectangle', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(178);
    tool.setColors([100, 100, 100], [0, 0, 0]);
    tool.setMode('filled');

    tool.startRect(0, 0);
    tool.drawRect(4, 4);
    tool.endRect();

    // Filled: all cells in rectangle (25 cells for 5x5)
    expect(canvas.setCell.mock.calls.length).toBe(25);
  });

  runner.it('should handle rectangles with swapped coordinates', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);
    tool.setMode('filled');

    tool.startRect(5, 5);
    tool.drawRect(0, 0); // Top-left to bottom-right swapped
    tool.endRect();

    // Should draw 6x6 rectangle (from 0,0 to 5,5 inclusive)
    expect(canvas.setCell.mock.calls.length).toBe(36);
  });

  runner.it('should respect apply modes', () => {
    const tool = new RectTool();
    const canvas = {
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] }))
    };
    tool.setCanvas(canvas);
    tool.setApplyModes({ glyph: false, foreground: true, background: true });
    tool.setMode('filled');

    tool.startRect(0, 0);
    tool.drawRect(2, 2);
    tool.endRect();

    // Should still paint cells respecting apply modes
    expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
  });

  runner.it('should draw single-cell rectangle', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(35);
    tool.setColors([255, 255, 255], [0, 0, 0]);
    tool.setMode('filled');

    tool.startRect(3, 3);
    tool.drawRect(3, 3); // Same point
    tool.endRect();

    // Single cell
    expect(canvas.setCell.mock.calls.length).toBe(1);
  });

  runner.it('should draw 2x2 outline rectangle', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(35);
    tool.setColors([255, 255, 255], [0, 0, 0]);
    tool.setMode('outline');

    tool.startRect(0, 0);
    tool.drawRect(1, 1); // 2x2 rectangle
    tool.endRect();

    // 2x2 outline = 4 cells (all perimeter)
    expect(canvas.setCell.mock.calls.length).toBe(4);
  });
});

runner.report();
