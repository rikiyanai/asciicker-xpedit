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
  runner.it('should draw outline rectangle with exact perimeter cells', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(35);
    tool.setColors([255, 255, 255], [0, 0, 0]);
    tool.setMode('outline');

    tool.startRect(0, 0);
    tool.drawRect(4, 4);
    tool.endRect();

    // Outline of 5x5 rect: perimeter = 2*(5+5) - 4 = 16 cells
    // Top: 5 cells, Bottom: 5 cells, Left (excluding corners): 3 cells, Right (excluding corners): 3 cells
    const calls = canvas.setCell.mock.calls;
    expect(calls.length).toBe(16);

    // Verify all outline cells have correct glyph and colors
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i][2]).toBe(35); // Glyph
      expect(calls[i][3]).toEqual([255, 255, 255]); // Foreground
      expect(calls[i][4]).toEqual([0, 0, 0]); // Background
    }

    // Verify cells are only on perimeter (not interior)
    const cellSet = new Set();
    calls.forEach(call => cellSet.add(`${call[0]},${call[1]}`));
    // No interior cells should be painted (e.g., not (1,1), (2,2), (3,3))
    expect(cellSet.has('1,1')).toBe(false);
    expect(cellSet.has('2,2')).toBe(false);
    expect(cellSet.has('3,3')).toBe(false);
  });

  runner.it('should draw filled rectangle with exact area cells', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(178);
    tool.setColors([100, 100, 100], [0, 0, 0]);
    tool.setMode('filled');

    tool.startRect(0, 0);
    tool.drawRect(4, 4);
    tool.endRect();

    // Filled 5x5 rectangle = 25 cells exactly
    expect(canvas.setCell.mock.calls.length).toBe(25);

    // Verify all cells have correct glyph and colors
    for (let i = 0; i < 25; i++) {
      const call = canvas.setCell.mock.calls[i];
      expect(call[2]).toBe(178); // Glyph
      expect(call[3]).toEqual([100, 100, 100]); // Foreground
      expect(call[4]).toEqual([0, 0, 0]); // Background
    }
  });

  runner.it('should normalize coordinates and draw correct area for swapped corners', () => {
    const tool = new RectTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);
    tool.setMode('filled');

    tool.startRect(5, 5);
    tool.drawRect(0, 0); // Top-left to bottom-right swapped
    tool.endRect();

    // Should normalize to (0,0)-(5,5) and draw 6x6 rectangle = 36 cells
    expect(canvas.setCell.mock.calls.length).toBe(36);

    // Verify all 36 cells are painted with correct glyph
    for (let i = 0; i < 36; i++) {
      const call = canvas.setCell.mock.calls[i];
      expect(call[2]).toBe(65); // Glyph
    }

    // Verify cells cover range (0,0) to (5,5)
    const minX = Math.min(...canvas.setCell.mock.calls.map(c => c[0]));
    const maxX = Math.max(...canvas.setCell.mock.calls.map(c => c[0]));
    const minY = Math.min(...canvas.setCell.mock.calls.map(c => c[1]));
    const maxY = Math.max(...canvas.setCell.mock.calls.map(c => c[1]));
    expect(minX).toBe(0);
    expect(maxX).toBe(5);
    expect(minY).toBe(0);
    expect(maxY).toBe(5);
  });

  runner.it('should respect apply modes - preserve glyph when disabled', () => {
    const tool = new RectTool();
    const canvas = {
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] })),
      width: 80,
      height: 25
    };
    tool.setCanvas(canvas);
    tool.setGlyph(99); // Tool's glyph should be 99
    tool.setColors([255, 0, 0], [0, 0, 0]); // Tool's colors
    tool.setApplyModes({ glyph: false, foreground: true, background: true });
    tool.setMode('filled');

    tool.startRect(0, 0);
    tool.drawRect(2, 2);
    tool.endRect();

    // Should paint 3x3 = 9 cells
    expect(canvas.setCell.mock.calls.length).toBe(9);

    // When glyph apply mode is false, should preserve existing glyph (42), not tool's (99)
    for (let i = 0; i < 9; i++) {
      const call = canvas.setCell.mock.calls[i];
      expect(call[2]).toBe(42); // Existing glyph, not tool's glyph (99)
      expect(call[3]).toEqual([255, 0, 0]); // New foreground
      expect(call[4]).toEqual([0, 0, 0]); // New background
    }
  });
});

runner.report();
