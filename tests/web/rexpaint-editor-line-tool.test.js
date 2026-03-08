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
  runner.it('should draw line from start to end point', () => {
    const tool = new LineTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.startLine(0, 0);
    tool.drawLine(5, 0); // Horizontal line to (5, 0)
    tool.endLine();

    // Should paint cells (0,0), (1,0), (2,0), (3,0), (4,0), (5,0)
    expect(canvas.setCell.mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  runner.it('should use Bresenham line algorithm for diagonal lines', () => {
    const tool = new LineTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(42);
    tool.setColors([0, 255, 0], [0, 0, 0]);

    tool.startLine(0, 0);
    tool.drawLine(5, 5); // Diagonal line
    tool.endLine();

    // Should paint approximately sqrt(50) ≈ 7 cells
    const callCount = canvas.setCell.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(5);
  });

  runner.it('should respect apply modes', () => {
    const tool = new LineTool();
    const canvas = {
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] }))
    };
    tool.setCanvas(canvas);
    tool.setApplyModes({ glyph: false, foreground: true, background: true });

    tool.startLine(0, 0);
    tool.drawLine(3, 0);
    tool.endLine();

    // When glyph mode false, only colors should be painted
    expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
  });

  runner.it('should draw vertical lines', () => {
    const tool = new LineTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(35);
    tool.setColors([100, 100, 100], [0, 0, 0]);

    tool.startLine(5, 0);
    tool.drawLine(5, 10); // Vertical line
    tool.endLine();

    expect(canvas.setCell.mock.calls.length).toBeGreaterThanOrEqual(11);
  });
});

runner.report();
