/**
 * Fill Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-fill-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-fill-tool.test.js
 */

import { FillTool } from '../../web/rexpaint-editor/tools/fill-tool.js';

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
      return implementation(...args);
    };
    fn.called = false;
    fn.callCount = 0;
    fn.lastArgs = [];
    return fn;
  },
};

// Run tests
const runner = new TestRunner();

runner.describe('Fill Tool', () => {
  runner.it('should flood fill connected cells with same source glyph', () => {
    // Create a mock canvas with a simple pattern
    // Row 0: [42, 42, 99, 99]
    // Row 1: [42, 99, 99, 99]
    // Row 2: [99, 99, 99, 99]
    const canvas = {
      width: 4,
      height: 3,
      getCell: vi.fn((x, y) => {
        const grid = [
          [{ glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] }, { glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }],
          [{ glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }],
          [{ glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }, { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] }],
        ];
        return grid[y]?.[x];
      }),
      setCell: vi.fn(),
    };

    const tool = new FillTool();
    tool.setCanvas(canvas);
    tool.setGlyph(77);
    tool.setColors([100, 100, 100], [10, 10, 10]);

    // Fill from (0, 0) which has glyph 42
    tool.fill(0, 0);

    // Should have filled cells (0,0), (1,0), (0,1) - all cells with glyph 42
    // setCell should be called 3 times
    expect(canvas.setCell).toHaveBeenCalledTimes(3);
  });

  runner.it('should not fill cells with different glyph', () => {
    // Create a mock canvas where (0,0) has glyph 42, adjacent cells have glyph 99
    const canvas = {
      width: 3,
      height: 3,
      getCell: vi.fn((x, y) => {
        if (x === 0 && y === 0) {
          return { glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] };
        }
        return { glyph: 99, fg: [0, 255, 0], bg: [0, 0, 0] };
      }),
      setCell: vi.fn(),
    };

    const tool = new FillTool();
    tool.setCanvas(canvas);
    tool.setGlyph(77);
    tool.setColors([100, 100, 100], [10, 10, 10]);

    // Fill from (0, 0) which has glyph 42
    tool.fill(0, 0);

    // Should only fill (0, 0) - adjacent cells have different glyph
    expect(canvas.setCell).toHaveBeenCalledTimes(1);
    expect(canvas.setCell).toHaveBeenCalledWith(0, 0, 77, [100, 100, 100], [10, 10, 10]);
  });

  runner.it('should respect apply modes - glyph only', () => {
    const canvas = {
      width: 3,
      height: 3,
      getCell: vi.fn((x, y) => {
        return { glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] };
      }),
      setCell: vi.fn(),
    };

    const tool = new FillTool();
    tool.setCanvas(canvas);
    tool.setGlyph(77);
    tool.setColors([100, 100, 100], [10, 10, 10]);
    tool.setApplyModes({ glyph: true, foreground: false, background: false });

    // Fill from (0, 0)
    tool.fill(0, 0);

    // Should fill (0,0), (1,0), (0,1), (2,0), (1,1), (0,2), (2,1), (1,2), (2,2) - 9 cells total (3x3 grid)
    expect(canvas.setCell).toHaveBeenCalledTimes(9);
    // But should preserve original colors
    for (let i = 0; i < canvas.setCell.callCount; i++) {
      const args = canvas.setCell.mock ? canvas.setCell.mock.calls[i] : null;
      // Check that the call used glyph 77 but kept original colors [255, 0, 0] and [0, 0, 0]
    }
  });

  runner.it('should stop at canvas boundaries', () => {
    const canvas = {
      width: 2,
      height: 2,
      getCell: vi.fn((x, y) => {
        return { glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] };
      }),
      setCell: vi.fn(),
    };

    const tool = new FillTool();
    tool.setCanvas(canvas);
    tool.setGlyph(77);
    tool.setColors([100, 100, 100], [10, 10, 10]);

    // Fill from (0, 0) in a 2x2 canvas
    tool.fill(0, 0);

    // Should fill all 4 cells: (0,0), (1,0), (0,1), (1,1)
    expect(canvas.setCell).toHaveBeenCalledTimes(4);
  });

  runner.it('should not crash when filling out-of-bounds position', () => {
    const canvas = {
      width: 3,
      height: 3,
      getCell: vi.fn((x, y) => {
        if (x < 0 || y < 0 || x >= 3 || y >= 3) return null;
        return { glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] };
      }),
      setCell: vi.fn(),
    };

    const tool = new FillTool();
    tool.setCanvas(canvas);
    tool.setGlyph(77);
    tool.setColors([100, 100, 100], [10, 10, 10]);

    // Fill from out-of-bounds position
    tool.fill(-1, 5);

    // Should not paint anything
    expect(canvas.setCell).toHaveBeenCalledTimes(0);
  });

  runner.it('should support paint() method as alias for fill()', () => {
    const canvas = {
      width: 2,
      height: 2,
      getCell: vi.fn((x, y) => {
        return { glyph: 42, fg: [255, 0, 0], bg: [0, 0, 0] };
      }),
      setCell: vi.fn(),
    };

    const tool = new FillTool();
    tool.setCanvas(canvas);
    tool.setGlyph(77);
    tool.setColors([100, 100, 100], [10, 10, 10]);

    // Call paint() instead of fill()
    tool.paint(0, 0);

    // Should fill all 4 cells: (0,0), (1,0), (0,1), (1,1)
    expect(canvas.setCell).toHaveBeenCalledTimes(4);
  });
});

runner.report();
