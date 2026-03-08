/**
 * Glyph Picker Tests
 *
 * Run with: node tests/web/rexpaint-editor-glyph-picker.test.js
 * Or via test framework: npm test -- tests/web/rexpaint-editor-glyph-picker.test.js
 */

import { GlyphPicker } from '../../web/rexpaint-editor/glyph-picker.js';

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
  toBeGreaterThan(expected) {
    if (value <= expected) {
      throw new Error(`Expected > ${expected}, got ${value}`);
    }
  },
  toBeTruthy() {
    if (!value) {
      throw new Error(`Expected truthy value, got ${value}`);
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
    } else if (this.tag === selector) {
      results.push(this);
    }

    // Recursively search all descendants (not just direct children)
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
  }

  getAttribute(name) {
    return this.attributes.get(name);
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

// Run tests
const runner = new TestRunner();

runner.describe('Glyph Picker', () => {
  runner.it('should render 256 glyphs in 16x16 grid', () => {
    const picker = new GlyphPicker(12, 12);
    const container = document.createElement('div');
    picker.render(container);

    const glyphs = container.querySelectorAll('.glyph-button');
    expect(glyphs.length).toBe(256);
  });

  runner.it('should set selected glyph when clicked', () => {
    const picker = new GlyphPicker(12, 12);
    let selectedGlyph = null;
    picker.on('select', (code) => {
      selectedGlyph = code;
    });

    const container = document.createElement('div');
    picker.render(container);

    const glyphBtn = container.querySelectorAll('.glyph-button')[65];
    glyphBtn.click();

    expect(selectedGlyph).toBe(65);
  });


  runner.it('should return unsubscribe function from on()', () => {
    const picker = new GlyphPicker(12, 12);
    let callCount = 0;
    const unsubscribe = picker.on('select', () => {
      callCount++;
    });

    picker.selectGlyph(65);
    expect(callCount).toBe(1);

    // Unsubscribe and verify callback no longer fires
    unsubscribe();
    picker.selectGlyph(100);
    expect(callCount).toBe(1); // Should not increment
  });

});

runner.report();
