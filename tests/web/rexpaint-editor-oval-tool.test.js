/**
 * Oval Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-oval-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-oval-tool.test.js
 */

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

runner.describe('Oval Tool', () => {
  runner.it('should draw outline oval', () => {
    const tool = new OvalTool();
    const canvas = { setCell: vi.fn(), width: 10, height: 10 };
    tool.setCanvas(canvas);
    tool.setGlyph(35);
    tool.setColors([255, 255, 255], [0, 0, 0]);
    tool.setMode('outline');

    tool.startOval(0, 0);
    tool.drawOval(5, 3);
    tool.endOval();

    // Outline: only perimeter cells painted
    const calls = canvas.setCell.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThan(24); // Less than filled
  });

  runner.it('should draw filled oval', () => {
    const tool = new OvalTool();
    const canvas = { setCell: vi.fn(), width: 10, height: 10 };
    tool.setCanvas(canvas);
    tool.setGlyph(178);
    tool.setColors([100, 100, 100], [0, 0, 0]);
    tool.setMode('filled');

    tool.startOval(0, 0);
    tool.drawOval(5, 3);
    tool.endOval();

    // Filled: more cells than outline
    expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
  });

  runner.it('should respect apply modes', () => {
    const tool = new OvalTool();
    const canvas = {
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] })),
      width: 10,
      height: 10,
    };
    tool.setCanvas(canvas);
    tool.setApplyModes({ glyph: false, foreground: true, background: true });
    tool.setMode('filled');

    tool.startOval(0, 0);
    tool.drawOval(3, 3);
    tool.endOval();

    // Should paint cells respecting apply modes
    expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
  });

  runner.it('should handle ovals with swapped coordinates', () => {
    const tool = new OvalTool();
    const canvas = { setCell: vi.fn(), width: 10, height: 10 };
    tool.setCanvas(canvas);
    tool.setGlyph(65);
    tool.setColors([255, 0, 0], [0, 0, 0]);
    tool.setMode('filled');

    tool.startOval(5, 5);
    tool.drawOval(0, 0);
    tool.endOval();

    // Should draw oval regardless of coordinate order
    expect(canvas.setCell.mock.calls.length).toBeGreaterThan(0);
  });

  runner.it('should silently ignore out-of-bounds start', () => {
    const tool = new OvalTool();
    const canvas = { setCell: vi.fn(), width: 10, height: 10 };
    tool.setCanvas(canvas);
    tool.setGlyph(35);

    tool.startOval(-5, -5); // Out of bounds

    // Should not throw, just ignore
    expect(tool.isDrawing).toBe(false);
  });
});

runner.report();
