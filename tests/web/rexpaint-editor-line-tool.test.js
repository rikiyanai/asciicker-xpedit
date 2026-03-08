/**
 * Line Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-line-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-line-tool.test.js
 */

import { LineTool } from '../../web/rexpaint-editor/tools/line-tool.js';

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

runner.describe('Line Tool', () => {
  runner.it('should draw line from start to end point using Bresenham algorithm', () => {
    const tool = new LineTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.startLine(0, 0);
    tool.drawLine(5, 0); // Horizontal line to (5, 0)
    tool.endLine();

    // Should paint exactly 6 cells for horizontal line: (0,0) to (5,0)
    expect(canvas.setCell.mock.calls.length).toBe(6);

    // Verify exact coordinates
    expect(canvas.setCell.mock.calls[0]).toEqual([0, 0, 65, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.mock.calls[1]).toEqual([1, 0, 65, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.mock.calls[2]).toEqual([2, 0, 65, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.mock.calls[3]).toEqual([3, 0, 65, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.mock.calls[4]).toEqual([4, 0, 65, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.mock.calls[5]).toEqual([5, 0, 65, [255, 0, 0], [0, 0, 0]]);
  });

  runner.it('should use Bresenham line algorithm for diagonal lines with exact cell count', () => {
    const tool = new LineTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(42);
    tool.setColors([0, 255, 0], [0, 0, 0]);

    tool.startLine(0, 0);
    tool.drawLine(5, 5); // Diagonal line (octant 1)
    tool.endLine();

    // Bresenham diagonal should paint exactly 6 cells from (0,0) to (5,5)
    // Cells: (0,0), (1,1), (2,2), (3,3), (4,4), (5,5)
    const callCount = canvas.setCell.mock.calls.length;
    expect(callCount).toBe(6);

    // Verify all cells have correct glyph and colors
    for (let i = 0; i < callCount; i++) {
      const call = canvas.setCell.mock.calls[i];
      expect(call[2]).toBe(42); // Glyph
      expect(call[3]).toEqual([0, 255, 0]); // Foreground color
      expect(call[4]).toEqual([0, 0, 0]); // Background color
    }
  });

  runner.it('should respect apply modes - preserve existing glyph when glyph mode disabled', () => {
    const tool = new LineTool();
    const canvas = {
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] })),
      width: 80,
      height: 25
    };
    tool.setCanvas(canvas);
    tool.setGlyph(99); // Tool glyph should be 99
    tool.setColors([255, 0, 0], [0, 0, 0]); // Tool colors
    tool.setApplyModes({ glyph: false, foreground: true, background: true });

    tool.startLine(0, 0);
    tool.drawLine(3, 0);
    tool.endLine();

    // Should paint exactly 4 cells (0,0) to (3,0)
    expect(canvas.setCell.mock.calls.length).toBe(4);

    // When glyph apply mode is false, should preserve existing glyph (42)
    // but apply new colors
    for (let i = 0; i < 4; i++) {
      const call = canvas.setCell.mock.calls[i];
      expect(call[2]).toBe(42); // Glyph should be existing, not the tool's glyph (99)
      expect(call[3]).toEqual([255, 0, 0]); // Foreground color applied
      expect(call[4]).toEqual([0, 0, 0]); // Background color applied
    }
  });
});

runner.report();
