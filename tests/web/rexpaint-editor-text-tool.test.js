/**
 * Text Tool Tests
 *
 * Run with: node tests/web/rexpaint-editor-text-tool.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-text-tool.test.js
 */

import { TextTool } from '../../web/rexpaint-editor/tools/text-tool.js';

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
      fn.calls.push(args);
      return implementation(...args);
    };
    fn.called = false;
    fn.callCount = 0;
    fn.lastArgs = [];
    fn.calls = [];
    return fn;
  },
};

// Run tests
const runner = new TestRunner();

runner.describe('Text Tool', () => {
  runner.it('should paint simple text string horizontally', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('HELLO');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.paint(10, 5);

    // Expected: 5 calls for H, E, L, L, O at (10,5), (11,5), (12,5), (13,5), (14,5)
    // H=72, E=69, L=76, L=76, O=79
    expect(canvas.setCell).toHaveBeenCalledTimes(5);
  });

  runner.it('should use correct CP437 glyph codes for text characters', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('HELLO');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.paint(10, 5);

    // Verify each character is painted with correct CP437 code
    expect(canvas.setCell.calls[0]).toEqual([10, 5, 72, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[1]).toEqual([11, 5, 69, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[2]).toEqual([12, 5, 76, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[3]).toEqual([13, 5, 76, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[4]).toEqual([14, 5, 79, [255, 0, 0], [0, 0, 0]]);
  });

  runner.it('should skip characters that extend out-of-bounds', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('HELLO');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    // Start at x=78, canvas width is 80, so only 2 characters fit
    tool.paint(78, 5);

    // Only H and E should be painted at (78,5) and (79,5)
    expect(canvas.setCell).toHaveBeenCalledTimes(2);
  });

  runner.it('should respect apply modes - glyph disabled', () => {
    const tool = new TextTool();
    const existingGlyph = 99;
    const canvas = {
      width: 80,
      height: 25,
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: existingGlyph, fg: [100, 100, 100], bg: [50, 50, 50] })),
    };
    tool.setCanvas(canvas);
    tool.setText('AB');
    tool.setColors([255, 0, 0], [0, 0, 0]);
    tool.setApplyModes({ glyph: false, foreground: true, background: true });

    tool.paint(10, 5);

    // When glyph apply mode is false, should use existing glyph
    expect(canvas.setCell).toHaveBeenCalledTimes(2);
    // Both calls should use existing glyph 99, but new colors
    expect(canvas.setCell.calls[0]).toEqual([10, 5, existingGlyph, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[1]).toEqual([11, 5, existingGlyph, [255, 0, 0], [0, 0, 0]]);
  });

  runner.it('should respect apply modes - colors disabled', () => {
    const tool = new TextTool();
    const canvas = {
      width: 80,
      height: 25,
      setCell: vi.fn(),
      getCell: vi.fn(() => ({ glyph: 42, fg: [100, 100, 100], bg: [50, 50, 50] })),
    };
    tool.setCanvas(canvas);
    tool.setText('AB');
    tool.setColors([255, 0, 0], [0, 0, 255]);
    tool.setApplyModes({ glyph: true, foreground: false, background: false });

    tool.paint(10, 5);

    // When color apply modes are false, should use existing colors
    expect(canvas.setCell).toHaveBeenCalledTimes(2);
    expect(canvas.setCell.calls[0]).toEqual([10, 5, 65, [100, 100, 100], [50, 50, 50]]);
    expect(canvas.setCell.calls[1]).toEqual([11, 5, 66, [100, 100, 100], [50, 50, 50]]);
  });

  runner.it('should handle empty text string', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    tool.paint(10, 5);

    // No cells should be painted for empty string
    expect(canvas.setCell).toHaveBeenCalledTimes(0);
  });

  runner.it('should not crash when painting at negative x', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('HELLO');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    // Start at negative x - all characters out of bounds
    tool.paint(-5, 5);

    expect(canvas.setCell).toHaveBeenCalledTimes(0);
  });

  runner.it('should not crash when painting at negative y', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('HELLO');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    // Start at negative y - all characters out of bounds
    tool.paint(10, -5);

    expect(canvas.setCell).toHaveBeenCalledTimes(0);
  });

  runner.it('should paint valid characters when text starts out-of-bounds and wraps in', () => {
    const tool = new TextTool();
    const canvas = { width: 80, height: 25, setCell: vi.fn() };
    tool.setCanvas(canvas);
    tool.setText('HELLO');
    tool.setColors([255, 0, 0], [0, 0, 0]);

    // Start at x=-2, so first 2 chars (H, E) are out of bounds, then L, L, O fit
    tool.paint(-2, 5);

    // Only 3 characters should be painted (L, L, O at x=0, x=1, x=2)
    expect(canvas.setCell).toHaveBeenCalledTimes(3);
    expect(canvas.setCell.calls[0]).toEqual([0, 5, 76, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[1]).toEqual([1, 5, 76, [255, 0, 0], [0, 0, 0]]);
    expect(canvas.setCell.calls[2]).toEqual([2, 5, 79, [255, 0, 0], [0, 0, 0]]);
  });

  runner.it('should deactivate without errors', () => {
    const tool = new TextTool();
    tool.deactivate();
    // Should not crash
  });
});

runner.report();
