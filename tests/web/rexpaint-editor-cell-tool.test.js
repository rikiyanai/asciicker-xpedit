/**
 * Cell Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-cell-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-cell-tool.test.js
 */

import { CellTool } from '../../web/rexpaint-editor/tools/cell-tool.js';

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

runner.describe('Cell Tool', () => {
  runner.it('should paint a single cell on click', () => {
    const tool = new CellTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.paint(5, 10); // Paint cell at (5, 10)

    expect(canvas.setCell).toHaveBeenCalledWith(5, 10, 65, [255, 0, 0], [0, 0, 0]);
  });

  runner.it('should paint multiple cells on drag', () => {
    const tool = new CellTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.startDrag(5, 10);
    tool.drag(6, 10);
    tool.drag(7, 10);
    tool.endDrag();

    // startDrag paints (5,10), drag(6,10) paints line from (5,10)-(6,10),
    // drag(7,10) paints line from (6,10)-(7,10)
    // Total: 1 + 2 + 2 = 5 calls
    expect(canvas.setCell).toHaveBeenCalledTimes(5);
  });

  runner.it('should respect apply modes - glyph disabled', () => {
    const tool = new CellTool();
    const canvas = { setCell: vi.fn(), getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] })) };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);
    tool.setApplyModes({ glyph: false, foreground: true, background: true });

    tool.paint(5, 10);

    // When glyph apply mode is false, should use existing glyph from canvas.getCell
    expect(canvas.setCell).toHaveBeenCalledWith(5, 10, 42, [255, 0, 0], [0, 0, 0]);
  });

  runner.it('should respect apply modes - color disabled', () => {
    const tool = new CellTool();
    const canvas = { setCell: vi.fn(), getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] })) };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 255]);
    tool.setApplyModes({ glyph: true, foreground: false, background: false });

    tool.paint(5, 10);

    // When color apply modes are false, should use existing colors from canvas.getCell
    expect(canvas.setCell).toHaveBeenCalledWith(5, 10, 65, [100, 100, 100], [50, 50, 50]);
  });

  runner.it('should have default apply modes (all enabled)', () => {
    const tool = new CellTool();
    const canvas = { setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.paint(5, 10);

    // With default modes (all enabled), all should be applied
    expect(canvas.setCell).toHaveBeenCalledWith(5, 10, 65, [255, 0, 0], [0, 0, 0]);
  });
});

runner.report();
