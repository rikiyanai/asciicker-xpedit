/**
 * Palette Tests
 *
 * Run with: node tests/web/rexpaint-editor-palette.test.js
 */

import { Palette } from '../../web/rexpaint-editor/palette.js';

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
      throw new Error(`Expected >= ${expected}, got ${value}`);
    }
  },
  toHaveBeenCalledWith(expected) {
    if (!this.wasCalled || JSON.stringify(this.lastArgs) !== JSON.stringify([expected])) {
      throw new Error(`Expected to be called with ${JSON.stringify(expected)}`);
    }
  },
});

// Mock classList API
class MockClassList {
  constructor() {
    this._classes = new Set();
  }

  add(className) {
    this._classes.add(className);
  }

  remove(className) {
    this._classes.delete(className);
  }

  has(className) {
    return this._classes.has(className);
  }

  contains(className) {
    return this._classes.has(className);
  }

  toggle(className) {
    if (this._classes.has(className)) {
      this._classes.delete(className);
    } else {
      this._classes.add(className);
    }
  }
}

// Mock Element for Node.js environment
class MockElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.classList = new MockClassList();
    this.attributes = new Map();
    this._listeners = new Map();
    this._className = '';
    this.type = '';
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = value;
    // Also sync to classList
    this.classList._classes.clear();
    if (value) {
      for (const cls of value.split(/\s+/)) {
        if (cls) {
          this.classList.add(cls);
        }
      }
    }
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    this._querySelect(selector, results);
    return results;
  }

  _querySelect(selector, results) {
    // Check this element first
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      if (this.classList.contains(className)) {
        results.push(this);
      }
    } else if (selector.includes('.')) {
      const [tag, className] = selector.split('.');
      if (this.tag === tag && this.classList.contains(className)) {
        results.push(this);
      }
    } else if (selector.includes('[type=')) {
      // Handle input[type="color"]
      const match = selector.match(/(\w+)\[type="(\w+)"\]/);
      if (match && this.tag === match[1] && this.type === match[2]) {
        results.push(this);
      }
    } else if (this.tag === selector) {
      results.push(this);
    }

    // Recursively search all descendants
    for (const child of this.children) {
      if (child._querySelect) {
        child._querySelect(selector, results);
      }
    }
  }

  addEventListener(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  click() {
    const callbacks = this._listeners.get('click') || [];
    for (const callback of callbacks) {
      callback(new MockEvent('click'));
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
    if (name === 'type') {
      this.type = value;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  get value() {
    return this.attributes.get('value') || '';
  }

  set value(v) {
    this.attributes.set('value', v);
  }

  get textContent() {
    return this.attributes.get('data-text') || '';
  }

  set textContent(value) {
    this.attributes.set('data-text', value);
  }
}

class MockEvent {
  constructor(type) {
    this.type = type;
  }
}

// Mock document and DOM APIs for Node.js environment
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
      return new MockElement(tag);
    },
  };
}

// Mock function tracker
function vi() {}
vi.fn = function() {
  const fn = function(...args) {
    fn.wasCalled = true;
    fn.lastArgs = args;
    fn.callCount = (fn.callCount || 0) + 1;
  };
  fn.wasCalled = false;
  fn.callCount = 0;
  fn.lastArgs = null;
  return fn;
};

// Run tests
const runner = new TestRunner();

runner.describe('Palette', () => {
  runner.it('should initialize with default colors', () => {
    const palette = new Palette();
    expect(palette.getForeground()).toEqual([255, 255, 255]);
    expect(palette.getBackground()).toEqual([0, 0, 0]);
  });

  runner.it('should set foreground color', () => {
    const palette = new Palette();
    palette.setForeground([255, 0, 0]);
    expect(palette.getForeground()).toEqual([255, 0, 0]);
  });

  runner.it('should set background color', () => {
    const palette = new Palette();
    palette.setBackground([0, 255, 0]);
    expect(palette.getBackground()).toEqual([0, 255, 0]);
  });

  runner.it('should emit color-changed event', () => {
    const palette = new Palette();
    let emittedData = null;
    palette.on('color-changed', (data) => {
      emittedData = data;
    });

    palette.setForeground([100, 100, 100]);
    expect(emittedData).toEqual({
      fg: [100, 100, 100],
      bg: [0, 0, 0]
    });
  });

  runner.it('should render color picker UI', () => {
    const palette = new Palette();
    const container = document.createElement('div');
    palette.render(container);

    const colorInputs = container.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBeGreaterThanOrEqual(2);
  });

  runner.it('should normalize color formats (RGB array or hex string)', () => {
    const palette = new Palette();
    palette.setForeground('#FF0000');
    expect(palette.getForeground()).toEqual([255, 0, 0]);
  });

  runner.it('should convert RGB to hex', () => {
    const palette = new Palette();
    palette.setForeground([255, 0, 0]);
    const hex = palette.rgbToHex(palette.getForeground());
    expect(hex).toBe('#FF0000');
  });

  runner.it('should set apply mode for glyph/foreground/background', () => {
    const palette = new Palette();
    palette.setApplyMode('glyph', false);
    expect(palette.getApplyMode().glyph).toBe(false);
  });

  runner.it('should return unsubscribe function from on()', () => {
    const palette = new Palette();
    let callCount = 0;
    const unsubscribe = palette.on('color-changed', () => {
      callCount++;
    });

    palette.setForeground([100, 100, 100]);
    expect(callCount).toBe(1);

    // Unsubscribe and verify callback no longer fires
    unsubscribe();
    palette.setForeground([200, 200, 200]);
    expect(callCount).toBe(1); // Should not increment
  });

  runner.it('should remove all listeners on dispose()', () => {
    const palette = new Palette();
    let callCount1 = 0;
    let callCount2 = 0;
    palette.on('color-changed', () => {
      callCount1++;
    });
    palette.on('apply-mode-changed', () => {
      callCount2++;
    });

    palette.setForeground([100, 100, 100]);
    expect(callCount1).toBe(1);

    palette.dispose();

    palette.setForeground([200, 200, 200]);
    palette.setApplyMode('glyph', false);

    expect(callCount1).toBe(1); // Should not increment after dispose
    expect(callCount2).toBe(0); // Should never fire after dispose
  });
});

runner.report();
