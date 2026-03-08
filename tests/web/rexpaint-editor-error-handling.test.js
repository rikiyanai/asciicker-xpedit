/**
 * Error Handling Tests for REXPaint Editor Pan Mode
 *
 * Run with: node tests/web/rexpaint-editor-error-handling.test.js
 *
 * Tests ensure that:
 * - Pan operations have try/catch with cleanup
 * - Cursor is always restored even on error
 * - Errors are logged clearly
 * - Pan mode can recover from errors
 * - Error doesn't prevent subsequent pan attempts
 */

import { EditorApp } from '../../web/rexpaint-editor/editor-app.js';
import { Canvas } from '../../web/rexpaint-editor/canvas.js';
import { Palette } from '../../web/rexpaint-editor/palette.js';
import { GlyphPicker } from '../../web/rexpaint-editor/glyph-picker.js';

// Simple test framework
class TestRunner {
  constructor() {
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

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${actual} to equal ${expected}`
      );
    }
  }

  assertTrue(value, message) {
    if (value !== true) {
      throw new Error(message || `Expected ${value} to be true`);
    }
  }

  assertFalse(value, message) {
    if (value !== false) {
      throw new Error(message || `Expected ${value} to be false`);
    }
  }

  assertThrows(func, errorMessage, message) {
    let thrown = false;
    try {
      func();
    } catch (e) {
      thrown = true;
      if (errorMessage && !e.message.includes(errorMessage)) {
        throw new Error(
          `Expected error "${errorMessage}" but got "${e.message}"`
        );
      }
    }
    if (!thrown) {
      throw new Error(message || 'Expected function to throw');
    }
  }

  assertNoThrow(func, message) {
    try {
      func();
    } catch (e) {
      throw new Error(
        message || `Expected not to throw but got: ${e.message}`
      );
    }
  }

  summary() {
    console.log(
      `\n${this.passed} passed, ${this.failed} failed out of ${
        this.passed + this.failed
      } tests`
    );
    return this.failed === 0;
  }
}

// Create simple mocks
function createMockCanvasElement() {
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    }),
    width: 800,
    height: 600,
    style: {},
    getContext: () => ({
      fillStyle: '',
      fillRect: () => {},
      strokeStyle: '',
      lineWidth: 1,
      setLineDash: () => {},
      lineDashOffset: 0,
      strokeRect: () => {},
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: () => {},
      getImageData: () => ({}),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
    }),
  };
}

function setupGlobalMocks() {
  const mockCanvasElem = createMockCanvasElement();

  // Setup document mock
  global.document = {
    getElementById: (id) => {
      if (id === 'rexpaintCanvas') return mockCanvasElem;
      return null;
    },
    createElement: () => ({
      addEventListener: () => {},
      removeEventListener: () => {},
      appendChild: () => {},
      setAttribute: () => {},
      classList: { add: () => {}, toggle: () => {} },
      style: {},
    }),
  };

  // Setup window mock
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  return mockCanvasElem;
}

const test = new TestRunner();

// Test suite: Pan Mode Error Handling
test.describe('Pan Mode Error Handling - pan() method', () => {
  test.it('should catch errors during pan and disable pan mode', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.enablePanMode();
    test.assertEqual(editorApp.panMode, true, 'Pan mode should be enabled');
    test.assertEqual(
      mockCanvasElem.style.cursor,
      'grab',
      'Cursor should be grab'
    );

    // Mock canvas.setOffset to throw
    canvas.setOffset = () => {
      throw new Error('Offset calculation failed');
    };

    // Pan should catch error and disable pan mode
    test.assertThrows(
      () => editorApp.pan(100, 50),
      'Offset calculation failed',
      'Should throw the underlying error'
    );

    test.assertFalse(
      editorApp.panMode,
      'Pan mode should be disabled after error'
    );
    test.assertEqual(
      mockCanvasElem.style.cursor,
      'crosshair',
      'Cursor should be restored'
    );
  });

  test.it('should not throw if panMode is false', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.panMode = false;
    canvas.setOffset = () => {
      throw new Error('Should not be called');
    };

    test.assertNoThrow(
      () => editorApp.pan(100, 50),
      'Should return early without calling setOffset'
    );
  });

  test.it('should allow pan to succeed after previous error', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    // First pan with error
    editorApp.enablePanMode();
    canvas.setOffset = () => {
      throw new Error('First error');
    };

    try {
      editorApp.pan(100, 50);
    } catch (e) {
      // Expected
    }

    test.assertFalse(editorApp.panMode, 'Pan mode should be disabled after error');

    // Re-enable and try again
    editorApp.enablePanMode();
    canvas.setOffset = () => {}; // No error this time

    test.assertNoThrow(
      () => editorApp.pan(150, 100),
      'Second pan should succeed'
    );
  });
});

test.describe('Pan Mode Error Handling - endPan() method', () => {
  test.it('should safely disable pan mode on endPan', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.enablePanMode();
    test.assertEqual(editorApp.panMode, true);

    editorApp.endPan();

    test.assertFalse(editorApp.panMode, 'Pan mode should be disabled');
    test.assertEqual(
      mockCanvasElem.style.cursor,
      'crosshair',
      'Cursor should be restored'
    );
  });
});

test.describe('Pan Mode Cursor Management', () => {
  test.it('enablePanMode should set cursor to grab', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    mockCanvasElem.style.cursor = '';
    editorApp.enablePanMode();

    test.assertEqual(mockCanvasElem.style.cursor, 'grab');
  });

  test.it('disablePanMode should restore cursor to crosshair', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.enablePanMode();
    editorApp.disablePanMode();

    test.assertEqual(mockCanvasElem.style.cursor, 'crosshair');
  });

  test.it('should restore cursor if pan throws error', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.enablePanMode();
    canvas.setOffset = () => {
      throw new Error('Error');
    };

    try {
      editorApp.pan(100, 100);
    } catch (e) {
      // Expected
    }

    test.assertEqual(
      mockCanvasElem.style.cursor,
      'crosshair',
      'Cursor should be restored after error'
    );
  });

});


test.describe('Multiple Pan Operations', () => {
  test.it('should handle consecutive pan operations', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.enablePanMode();
    canvas.setOffset = () => {}; // No error

    // Multiple pans
    test.assertNoThrow(() => {
      editorApp.pan(100, 100);
      editorApp.pan(150, 150);
    });

    test.assertEqual(editorApp.panMode, true);
  });

});

test.describe('Canvas Mouse Event Error Handling', () => {
  test.it('_onMouseDown should handle pan mode errors', () => {
    const mockCanvasElem = setupGlobalMocks();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const mockEditorApp = {
      panMode: true,
      startPan: () => {
        throw new Error('Pan start failed');
      },
    };
    canvas.editorApp = mockEditorApp;

    const event = {
      clientX: 100,
      clientY: 50,
    };

    test.assertThrows(
      () => canvas._onMouseDown(event),
      'Pan start failed'
    );
  });

  test.it('_onMouseMove should handle pan mode errors', () => {
    const mockCanvasElem = setupGlobalMocks();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const mockEditorApp = {
      panMode: true,
      pan: () => {
        throw new Error('Pan failed');
      },
    };
    canvas.editorApp = mockEditorApp;

    const event = {
      clientX: 150,
      clientY: 75,
      buttons: 1, // Mouse button pressed
    };

    test.assertThrows(
      () => canvas._onMouseMove(event),
      'Pan failed'
    );
  });
});

test.describe('startPan method', () => {
  test.it('should set pan start coordinates', () => {
    const mockCanvasElem = setupGlobalMocks();

    const palette = new Palette();
    const glyphPicker = new GlyphPicker();
    const canvas = new Canvas(mockCanvasElem, 80, 25, 12);
    const editorApp = new EditorApp({ canvas, palette, glyphPicker });

    editorApp.startPan(100, 200);

    test.assertEqual(editorApp.panStartX, 100);
    test.assertEqual(editorApp.panStartY, 200);
  });
});

// Run summary
console.log('\n' + '='.repeat(60));
const success = test.summary();
console.log('='.repeat(60));

process.exit(success ? 0 : 1);
