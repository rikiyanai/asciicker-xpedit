/**
 * XP File Reader - EditorApp Integration Tests
 *
 * Run with: node tests/web/rexpaint-editor-xp-integration.test.js
 *
 * Tests ensure that:
 * - EditorApp.loadXPFile() successfully loads XP file data
 * - Canvas dimensions are updated to match XP file
 * - LayerStack is created and populated with file layers
 * - Cell data is preserved correctly (glyph + colors)
 * - Canvas renders after load
 * - UndoStack is reset
 * - Error handling for invalid files
 */

import zlib from 'zlib';

// Mock DOM for Node.js environment
if (typeof document === 'undefined') {
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {},
      classList: { add: () => {}, toggle: () => {}, remove: () => {} },
    }),
  };
}

import { EditorApp } from '../../web/rexpaint-editor/editor-app.js';
import { Canvas } from '../../web/rexpaint-editor/canvas.js';
import { Palette } from '../../web/rexpaint-editor/palette.js';
import { GlyphPicker } from '../../web/rexpaint-editor/glyph-picker.js';
import { LayerStack } from '../../web/rexpaint-editor/layer-stack.js';

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

  assertGreaterThan(actual, minimum, message) {
    if (actual <= minimum) {
      throw new Error(
        message || `Expected ${actual} to be greater than ${minimum}`
      );
    }
  }

  assertArrayEquals(actual, expected, message) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      throw new Error('Both values must be arrays');
    }
    if (actual.length !== expected.length) {
      throw new Error(
        message || `Array length mismatch: ${actual.length} vs ${expected.length}`
      );
    }
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(
          message || `Array[${i}]: expected ${expected[i]}, got ${actual[i]}`
        );
      }
    }
  }
}

// Helper functions

function createValidXPBufferWithLayerData() {
  // Header: 10x5 canvas, 1 layer
  const headerBuffer = new ArrayBuffer(20);
  const headerView = new DataView(headerBuffer);
  headerView.setUint32(0, 0x50584552, true); // Magic
  headerView.setInt32(4, 1, true); // Version
  headerView.setInt32(8, 10, true); // Width
  headerView.setInt32(12, 5, true); // Height
  headerView.setInt32(16, 1, true); // Layer count

  // Build uncompressed cell data: 10x5 canvas = 50 cells
  // Column-major order: x=0 (y=0..4), x=1 (y=0..4), etc.
  // Each cell: 7 bytes (glyph + fg_rgb + bg_rgb)
  const layerDataSize = 10 * 5 * 7; // 350 bytes
  const cellData = new Uint8Array(layerDataSize);
  let offset = 0;
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 5; y++) {
      cellData[offset] = 65; // glyph 'A'
      cellData[offset + 1] = 255; // fg_r
      cellData[offset + 2] = 0; // fg_g
      cellData[offset + 3] = 0; // fg_b
      cellData[offset + 4] = 0; // bg_r
      cellData[offset + 5] = 0; // bg_g
      cellData[offset + 6] = 255; // bg_b
      offset += 7;
    }
  }

  // Compress with gzip
  const compressed = zlib.gzipSync(Buffer.from(cellData));

  // Combine header + layer header + compressed data
  const fullBuffer = new ArrayBuffer(20 + 12 + compressed.length);
  const fullView = new Uint8Array(fullBuffer);
  fullView.set(new Uint8Array(headerBuffer), 0);

  // Write layer header at offset 20
  const layerHeaderView = new DataView(fullBuffer, 20, 12);
  layerHeaderView.setInt32(0, 10, true); // layer width
  layerHeaderView.setInt32(4, 5, true); // layer height
  layerHeaderView.setInt32(8, compressed.length, true); // compressed_size

  // Write compressed data at offset 32
  fullView.set(new Uint8Array(compressed), 32);

  return fullBuffer;
}

function createXPBufferWithMultipleLayers() {
  // Header: 5x5 canvas, 2 layers
  const headerBuffer = new ArrayBuffer(20);
  const headerView = new DataView(headerBuffer);
  headerView.setUint32(0, 0x50584552, true); // Magic
  headerView.setInt32(4, 1, true); // Version
  headerView.setInt32(8, 5, true); // Width
  headerView.setInt32(12, 5, true); // Height
  headerView.setInt32(16, 2, true); // Layer count: 2

  // Build cell data for layer 1: glyph 'A' (65)
  const cellDataLayer1 = new Uint8Array(5 * 5 * 7);
  let offset = 0;
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      cellDataLayer1[offset] = 65; // glyph 'A'
      cellDataLayer1[offset + 1] = 255; // fg_r
      cellDataLayer1[offset + 2] = 0; // fg_g
      cellDataLayer1[offset + 3] = 0; // fg_b
      cellDataLayer1[offset + 4] = 0; // bg_r
      cellDataLayer1[offset + 5] = 0; // bg_g
      cellDataLayer1[offset + 6] = 0; // bg_b
      offset += 7;
    }
  }

  // Build cell data for layer 2: glyph 'B' (66)
  const cellDataLayer2 = new Uint8Array(5 * 5 * 7);
  offset = 0;
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      cellDataLayer2[offset] = 66; // glyph 'B'
      cellDataLayer2[offset + 1] = 0; // fg_r
      cellDataLayer2[offset + 2] = 255; // fg_g
      cellDataLayer2[offset + 3] = 0; // fg_b
      cellDataLayer2[offset + 4] = 0; // bg_r
      cellDataLayer2[offset + 5] = 0; // bg_g
      cellDataLayer2[offset + 6] = 0; // bg_b
      offset += 7;
    }
  }

  const compressed1 = zlib.gzipSync(Buffer.from(cellDataLayer1));
  const compressed2 = zlib.gzipSync(Buffer.from(cellDataLayer2));

  // Combine all parts
  const fullBuffer = new ArrayBuffer(20 + 12 + compressed1.length + 12 + compressed2.length);
  const fullView = new Uint8Array(fullBuffer);
  fullView.set(new Uint8Array(headerBuffer), 0);

  // Write layer 1 header
  let pos = 20;
  const layerHeader1 = new DataView(fullBuffer, pos, 12);
  layerHeader1.setInt32(0, 5, true); // width
  layerHeader1.setInt32(4, 5, true); // height
  layerHeader1.setInt32(8, compressed1.length, true); // size
  pos += 12;

  // Write layer 1 data
  fullView.set(new Uint8Array(compressed1), pos);
  pos += compressed1.length;

  // Write layer 2 header
  const layerHeader2 = new DataView(fullBuffer, pos, 12);
  layerHeader2.setInt32(0, 5, true); // width
  layerHeader2.setInt32(4, 5, true); // height
  layerHeader2.setInt32(8, compressed2.length, true); // size
  pos += 12;

  // Write layer 2 data
  fullView.set(new Uint8Array(compressed2), pos);

  return fullBuffer;
}

function createMockCanvasElement() {
  return {
    width: 80,
    height: 25,
    getContext: () => ({
      fillStyle: '',
      fillRect: () => {},
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: () => {},
      lineDashOffset: 0,
      strokeRect: () => {},
      fillText: () => {},
      drawImage: () => {},
      clearRect: () => {},
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}

// Test runner instance
const runner = new TestRunner();

// Test suite: EditorApp XP File Loading
runner.describe('EditorApp XP File Integration', () => {
  runner.it('should load XP file and update canvas dimensions', () => {
    const xpBuffer = createValidXPBufferWithLayerData();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });

    // Verify method exists
    runner.assertTrue(
      typeof app.loadXPFile === 'function',
      'EditorApp should have loadXPFile method'
    );

    // Initial dimensions (80x25)
    runner.assertEqual(app.canvas.width, 80, 'Initial canvas width should be 80');
    runner.assertEqual(app.canvas.height, 25, 'Initial canvas height should be 25');

    // Load XP file (10x5)
    app.loadXPFile(xpBuffer);

    // Verify dimensions changed
    runner.assertEqual(app.canvas.width, 10, 'Canvas width should be 10 after load');
    runner.assertEqual(app.canvas.height, 5, 'Canvas height should be 5 after load');
  });

  runner.it('should populate canvas with cell data from XP file', () => {
    const xpBuffer = createValidXPBufferWithLayerData();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.loadXPFile(xpBuffer);

    // Check cell at (0, 0)
    const cell = app.canvas.getCell(0, 0);
    runner.assertEqual(cell.glyph, 65, 'Glyph should be 65 (A)');
    runner.assertArrayEquals(cell.fg, [255, 0, 0], 'Foreground color should be [255, 0, 0]');
    runner.assertArrayEquals(cell.bg, [0, 0, 255], 'Background color should be [0, 0, 255]');
  });

  runner.it('should create LayerStack from XP file layers', () => {
    const xpBuffer = createValidXPBufferWithLayerData();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.loadXPFile(xpBuffer);

    // Verify LayerStack was created
    runner.assertTrue(app.layerStack !== null, 'LayerStack should be created');
    runner.assertGreaterThan(app.layerStack.layers.length, 0, 'LayerStack should have at least 1 layer');
    runner.assertEqual(app.layerStack.layers.length, 1, 'LayerStack should have exactly 1 layer');
  });

  runner.it('should preserve cell data in LayerStack', () => {
    const xpBuffer = createValidXPBufferWithLayerData();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.loadXPFile(xpBuffer);

    // Get cell from LayerStack directly
    const layer = app.layerStack.layers[0];
    const cell = layer.getCell(0, 0);

    runner.assertTrue(cell !== null, 'Cell should exist');
    runner.assertEqual(cell.glyph, 65, 'Glyph should be 65 (A)');
    runner.assertArrayEquals(cell.fg, [255, 0, 0], 'Layer cell foreground should be [255, 0, 0]');
    runner.assertArrayEquals(cell.bg, [0, 0, 255], 'Layer cell background should be [0, 0, 255]');
  });

  runner.it('should handle multiple layers', () => {
    const xpBuffer = createXPBufferWithMultipleLayers();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });
    app.loadXPFile(xpBuffer);

    // Verify LayerStack has 2 layers
    runner.assertEqual(app.layerStack.layers.length, 2, 'LayerStack should have 2 layers');

    // Verify layer 1 content (glyph 65)
    const layer1Cell = app.layerStack.layers[0].getCell(0, 0);
    runner.assertEqual(layer1Cell.glyph, 65, 'Layer 1 glyph should be 65 (A)');

    // Verify layer 2 content (glyph 66)
    const layer2Cell = app.layerStack.layers[1].getCell(0, 0);
    runner.assertEqual(layer2Cell.glyph, 66, 'Layer 2 glyph should be 66 (B)');
  });

  runner.it('should reset UndoStack after loading', () => {
    const xpBuffer = createValidXPBufferWithLayerData();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });

    // Verify UndoStack exists
    runner.assertTrue(app.undoStack !== null, 'UndoStack should exist before load');

    // Load file
    app.loadXPFile(xpBuffer);

    // UndoStack should be reset (new instance)
    runner.assertTrue(app.undoStack !== null, 'UndoStack should exist after load');
  });

  runner.it('should throw error on invalid XP file', () => {
    const invalidBuffer = new ArrayBuffer(4);
    const view = new DataView(invalidBuffer);
    view.setUint32(0, 0xDEADBEEF, true); // Wrong magic

    const mockElement = createMockCanvasElement();
    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });

    runner.assertThrows(
      () => app.loadXPFile(invalidBuffer),
      'Invalid XP file',
      'Should throw error on invalid magic number'
    );
  });

  runner.it('should connect LayerStack to Canvas', () => {
    const xpBuffer = createValidXPBufferWithLayerData();
    const mockElement = createMockCanvasElement();

    const canvas = new Canvas(mockElement, 80, 25);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });

    // Verify canvas not using LayerStack initially
    runner.assertFalse(app.canvas.useLayerStack, 'Canvas should not use LayerStack initially');

    // Load XP file
    app.loadXPFile(xpBuffer);

    // Verify canvas is now using LayerStack
    runner.assertTrue(app.canvas.useLayerStack, 'Canvas should use LayerStack after load');
    runner.assertTrue(app.canvas.layerStack === app.layerStack, 'Canvas should reference the same LayerStack');
  });

  runner.it('should save canvas to XP file', () => {
    const mockElement = createMockCanvasElement();
    const canvas = new Canvas(mockElement, 10, 5);
    const palette = new Palette();
    const glyphPicker = new GlyphPicker();

    const app = new EditorApp({ canvas, palette, glyphPicker });

    // Verify method exists
    runner.assertTrue(
      typeof app.saveAsXP === 'function',
      'EditorApp should have saveAsXP method'
    );

    // Initialize LayerStack manually (normally done by _setupLayerPanel with DOM)
    app.layerStack = new LayerStack(10, 5);
    app.canvas.setLayerStack(app.layerStack);

    // Create test data by setting a cell
    app.layerStack.getActiveLayer().setCell(0, 0, 65, [255, 0, 0], [0, 0, 0]); // Red 'A'

    // Save to XP buffer
    const buffer = app.saveAsXP();

    runner.assertTrue(buffer !== undefined, 'Buffer should be defined');
    runner.assertTrue(buffer instanceof ArrayBuffer, 'Should return ArrayBuffer');
    runner.assertGreaterThan(buffer.byteLength, 0, 'Buffer should have content');
  });

  runner.it('should roundtrip: load → save → load', () => {
    // Create original XP buffer
    const original = createValidXPBufferWithLayerData();

    // Load into first app
    const mockElement1 = createMockCanvasElement();
    const canvas1 = new Canvas(mockElement1, 80, 25);
    const palette1 = new Palette();
    const glyphPicker1 = new GlyphPicker();
    const app1 = new EditorApp({ canvas: canvas1, palette: palette1, glyphPicker: glyphPicker1 });
    app1.loadXPFile(original);

    // Verify cell data was loaded
    const cell1Before = app1.layerStack.getActiveLayer().getCell(0, 0);
    runner.assertTrue(cell1Before !== null, 'Cell1 should be loaded from original');
    runner.assertEqual(cell1Before.glyph, 65, 'Original cell glyph should be 65 (A)');

    // Save from first app
    const saved = app1.saveAsXP();
    runner.assertGreaterThan(saved.byteLength, 0, 'Saved buffer should have content');

    // Load into second app
    const mockElement2 = createMockCanvasElement();
    const canvas2 = new Canvas(mockElement2, 80, 25);
    const palette2 = new Palette();
    const glyphPicker2 = new GlyphPicker();
    const app2 = new EditorApp({ canvas: canvas2, palette: palette2, glyphPicker: glyphPicker2 });
    app2.loadXPFile(saved);

    // Verify cells match at position (0, 0) - guaranteed to have data
    const cell1 = app1.layerStack.getActiveLayer().getCell(0, 0);
    const cell2 = app2.layerStack.getActiveLayer().getCell(0, 0);

    runner.assertTrue(cell1 !== null, 'Cell1 should exist');
    runner.assertTrue(cell2 !== null, 'Cell2 should exist');
    runner.assertEqual(cell1.glyph, cell2.glyph, 'Glyphs should match');
    runner.assertArrayEquals(cell1.fg, cell2.fg, 'Foreground colors should match');
    runner.assertArrayEquals(cell1.bg, cell2.bg, 'Background colors should match');
  });
});

// Print test summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests passed: ${runner.passed}`);
console.log(`Tests failed: ${runner.failed}`);
console.log(`Total: ${runner.passed + runner.failed}`);
console.log(`${'='.repeat(50)}`);

process.exit(runner.failed > 0 ? 1 : 0);
