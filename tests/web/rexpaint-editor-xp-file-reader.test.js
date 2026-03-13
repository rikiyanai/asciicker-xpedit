/**
 * XP File Reader Tests - Core Structure & Gzip
 *
 * Run with: node tests/web/rexpaint-editor-xp-file-reader.test.js
 *
 * Tests ensure that:
 * - XPFileReader parses XP file header correctly
 * - Magic number validation works
 * - Version, width, height, layer count are read correctly
 * - Gzipped XP data is decompressed and validated
 * - Invalid dimensions throw errors
 */

import { XPFileReader } from '../../web/rexpaint-editor/xp-file-reader.js';
import zlib from 'zlib';

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

// Helper functions

/**
 * Creates a valid XP buffer (80x25 canvas, 1 layer)
 * Format: magic(4) + version(4) + width(4) + height(4) + layerCount(4)
 */
function createValidXPBuffer() {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);

  // Magic number: "REXP" = 0x50584552 (little-endian)
  view.setUint32(0, 0x50584552, true);

  // Version: 1
  view.setInt32(4, 1, true);

  // Width: 80
  view.setInt32(8, 80, true);

  // Height: 25
  view.setInt32(12, 25, true);

  // Layer count: 1
  view.setInt32(16, 1, true);

  return buffer;
}

/**
 * Creates an XP buffer with custom dimensions
 */
function createXPBufferWithDims(width, height, layerCount) {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);

  view.setUint32(0, 0x50584552, true); // Magic
  view.setInt32(4, 1, true); // Version
  view.setInt32(8, width, true);
  view.setInt32(12, height, true);
  view.setInt32(16, layerCount, true);

  return buffer;
}

/**
 * Compresses data with gzip synchronously
 */
function compressWithGzip(data) {
  return zlib.gzipSync(Buffer.from(data));
}

/**
 * Decompresses gzipped data synchronously
 */
function decompressGzip(buffer) {
  return zlib.gunzipSync(buffer);
}

// Test runner instance
const runner = new TestRunner();

// Test suite: XP File Header Parsing
runner.describe('XP File Header Parsing', () => {
  runner.it('should read XP file header and validate version', () => {
    const buffer = createValidXPBuffer();
    const reader = new XPFileReader(buffer);

    runner.assertEqual(reader.width, 80, 'Width should be 80');
    runner.assertEqual(reader.height, 25, 'Height should be 25');
    runner.assertEqual(reader.layerCount, 1, 'Layer count should be 1');
  });

  runner.it('should validate magic number', () => {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);

    // Wrong magic number
    view.setUint32(0, 0xDEADBEEF, true);
    view.setInt32(4, 1, true);
    view.setInt32(8, 80, true);
    view.setInt32(12, 25, true);
    view.setInt32(16, 1, true);

    runner.assertThrows(
      () => new XPFileReader(buffer),
      'Invalid XP file',
      'Should throw on invalid magic number'
    );
  });

  runner.it('should reject invalid width', () => {
    const buffer = createXPBufferWithDims(0, 25, 1);

    runner.assertThrows(
      () => new XPFileReader(buffer),
      'Invalid XP dimensions',
      'Should throw on zero width'
    );
  });

  runner.it('should reject invalid height', () => {
    const buffer = createXPBufferWithDims(80, 0, 1);

    runner.assertThrows(
      () => new XPFileReader(buffer),
      'Invalid XP dimensions',
      'Should throw on zero height'
    );
  });

  runner.it('should reject invalid layer count', () => {
    const buffer = createXPBufferWithDims(80, 25, 0);

    runner.assertThrows(
      () => new XPFileReader(buffer),
      'Invalid XP dimensions',
      'Should throw on zero layers'
    );
  });

  runner.it('should reject negative dimensions', () => {
    const buffer = createXPBufferWithDims(-10, 25, 1);

    runner.assertThrows(
      () => new XPFileReader(buffer),
      'Invalid XP dimensions',
      'Should throw on negative width'
    );
  });
});

// Test suite: Gzip Decompression
runner.describe('Gzip Decompression', () => {
  runner.it('should decompress gzipped XP data', () => {
    const xpData = createValidXPBuffer();
    const gzippedBuffer = compressWithGzip(xpData);
    const reader = new XPFileReader(gzippedBuffer);

    runner.assertTrue(reader.isValid(), 'Reader should be valid after decompression');
    runner.assertEqual(reader.width, 80);
    runner.assertEqual(reader.height, 25);
    runner.assertEqual(reader.layerCount, 1);
  });

  runner.it('should handle non-gzipped data', () => {
    const buffer = createValidXPBuffer();
    const reader = new XPFileReader(buffer);

    runner.assertTrue(reader.isValid(), 'Reader should work with raw data');
  });

  runner.it('should detect and handle invalid gzip', () => {
    // Create a buffer that looks like it might be gzipped but isn't
    const invalidGzipBuffer = new ArrayBuffer(20);
    const view = new DataView(invalidGzipBuffer);

    // Gzip magic: 0x1f 0x8b (these are the first 2 bytes)
    view.setUint8(0, 0x1f);
    view.setUint8(1, 0x8b);
    // Rest is garbage
    for (let i = 2; i < 20; i++) {
      view.setUint8(i, 0xFF);
    }

    runner.assertThrows(
      () => new XPFileReader(invalidGzipBuffer),
      'Failed to decompress',
      'Should throw on corrupted gzip data'
    );
  });
});

// Test suite: isValid() method
runner.describe('isValid() Method', () => {
  runner.it('should return true for valid dimensions', () => {
    const buffer = createValidXPBuffer();
    const reader = new XPFileReader(buffer);

    runner.assertTrue(reader.isValid(), 'Should be valid');
  });

  runner.it('should return false after failed parse (actually throws)', () => {
    // This test verifies that invalid data throws before isValid() can be called
    const buffer = createXPBufferWithDims(0, 25, 1);

    runner.assertThrows(
      () => new XPFileReader(buffer),
      'Invalid XP dimensions'
    );
  });

  runner.it('should validate large dimensions', () => {
    const buffer = createXPBufferWithDims(200, 100, 3);
    const reader = new XPFileReader(buffer);

    runner.assertTrue(reader.isValid());
    runner.assertEqual(reader.width, 200);
    runner.assertEqual(reader.height, 100);
    runner.assertEqual(reader.layerCount, 3);
  });
});

// Test suite: Multiple layers
runner.describe('Multiple Layers Support', () => {
  runner.it('should read single layer', () => {
    const buffer = createXPBufferWithDims(80, 25, 1);
    const reader = new XPFileReader(buffer);

    runner.assertEqual(reader.layerCount, 1);
  });

  runner.it('should read multiple layers', () => {
    const buffer = createXPBufferWithDims(80, 25, 4);
    const reader = new XPFileReader(buffer);

    runner.assertEqual(reader.layerCount, 4);
  });

  runner.it('should read many layers', () => {
    const buffer = createXPBufferWithDims(80, 25, 10);
    const reader = new XPFileReader(buffer);

    runner.assertEqual(reader.layerCount, 10);
  });
});

// Test suite: Version handling
runner.describe('Version Handling', () => {
  runner.it('should read version field', () => {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);

    view.setUint32(0, 0x50584552, true);
    view.setInt32(4, 2, true); // Version 2
    view.setInt32(8, 80, true);
    view.setInt32(12, 25, true);
    view.setInt32(16, 1, true);

    const reader = new XPFileReader(buffer);
    runner.assertEqual(reader.version, 2);
  });
});

// Test suite: Boundary cases
runner.describe('Boundary Cases', () => {
  runner.it('should handle minimum valid dimensions (1x1)', () => {
    const buffer = createXPBufferWithDims(1, 1, 1);
    const reader = new XPFileReader(buffer);

    runner.assertTrue(reader.isValid());
    runner.assertEqual(reader.width, 1);
    runner.assertEqual(reader.height, 1);
  });

  runner.it('should handle large dimensions', () => {
    const buffer = createXPBufferWithDims(256, 256, 16);
    const reader = new XPFileReader(buffer);

    runner.assertTrue(reader.isValid());
    runner.assertEqual(reader.width, 256);
    runner.assertEqual(reader.height, 256);
    runner.assertEqual(reader.layerCount, 16);
  });

  runner.it('should handle max safe integer dimensions', () => {
    const buffer = createXPBufferWithDims(100000, 100000, 100);
    const reader = new XPFileReader(buffer);

    runner.assertTrue(reader.isValid());
  });
});

// Test suite: Layer Decompression and Cell Parsing
runner.describe('Layer Decompression and Cell Parsing', () => {
  runner.it('should decompress and parse layer data', () => {
    const buffer = createValidXPBufferWithLayerData();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();

    runner.assertEqual(layers.length, 1, 'Should have 1 layer');
    runner.assertEqual(layers[0].width, 10, 'Layer width should be 10');
    runner.assertEqual(layers[0].height, 5, 'Layer height should be 5');
    runner.assertTrue(layers[0].data !== undefined, 'Layer data should be defined');
  });

  runner.it('should parse cells with correct glyph and colors', () => {
    const buffer = createValidXPBufferWithLayerData();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();
    const cell = layers[0].data[0][0];

    runner.assertEqual(cell.glyph, 65, 'Glyph should be 65 (A)');
    runner.assertEqual(cell.fg[0], 255, 'FG red should be 255');
    runner.assertEqual(cell.fg[1], 0, 'FG green should be 0');
    runner.assertEqual(cell.fg[2], 0, 'FG blue should be 0');
    runner.assertEqual(cell.bg[0], 0, 'BG red should be 0');
    runner.assertEqual(cell.bg[1], 0, 'BG green should be 0');
    runner.assertEqual(cell.bg[2], 255, 'BG blue should be 255');
  });

  runner.it('should handle column-major to row-major transposition', () => {
    const buffer = createColumnMajorTestBuffer();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();

    // Column-major disk order: x=0,y=0 then x=0,y=1 then x=1,y=0 then x=1,y=1
    // Should be transposed to row-major: [0][0], [0][1], [1][0], [1][1]
    runner.assertEqual(layers[0].data[0][0].glyph, 1, 'Cell (0,0) should have glyph 1');
    runner.assertEqual(layers[0].data[1][0].glyph, 2, 'Cell (0,1) should have glyph 2');
    runner.assertEqual(layers[0].data[0][1].glyph, 3, 'Cell (1,0) should have glyph 3');
    runner.assertEqual(layers[0].data[1][1].glyph, 4, 'Cell (1,1) should have glyph 4');
  });

  runner.it('should cache layer data on subsequent calls', () => {
    const buffer = createValidXPBufferWithLayerData();
    const reader = new XPFileReader(buffer);
    const layers1 = reader.getLayers();
    const layers2 = reader.getLayers();

    runner.assertTrue(layers1 === layers2, 'getLayers() should return cached instance');
  });

  runner.it('should provide getCell() convenience method', () => {
    const buffer = createValidXPBufferWithLayerData();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();
    const cell = layers[0].getCell(0, 0);

    runner.assertTrue(cell !== null, 'getCell should return a cell');
    runner.assertEqual(cell.glyph, 65, 'getCell should return correct cell');
  });

  runner.it('should handle multiple layers', () => {
    const buffer = createValidXPBufferWithMultipleLayers();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();

    runner.assertEqual(layers.length, 3, 'Should have 3 layers');
    runner.assertEqual(layers[0].width, 5, 'Layer 0 width should be 5');
    runner.assertEqual(layers[1].width, 5, 'Layer 1 width should be 5');
    runner.assertEqual(layers[2].width, 5, 'Layer 2 width should be 5');
  });

  runner.it('should parse cells across entire layer', () => {
    const buffer = createValidXPBufferWithLayerData();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();
    const layer = layers[0];

    // Check corners
    runner.assertTrue(layer.data[0][0] !== undefined, 'Top-left should exist');
    runner.assertTrue(layer.data[layer.height - 1][layer.width - 1] !== undefined, 'Bottom-right should exist');
  });

  runner.it('should handle empty/transparent cells', () => {
    const buffer = createBufferWithTransparentCells();
    const reader = new XPFileReader(buffer);
    const layers = reader.getLayers();
    const cell = layers[0].data[0][0];

    // Transparent cell: glyph=0, bg=(255,0,255)
    runner.assertEqual(cell.glyph, 0, 'Transparent glyph should be 0');
    runner.assertEqual(cell.bg[0], 255, 'Transparent BG red should be 255');
    runner.assertEqual(cell.bg[1], 0, 'Transparent BG green should be 0');
    runner.assertEqual(cell.bg[2], 255, 'Transparent BG blue should be 255');
  });
});

// Helper function: Create XP buffer with actual layer data (gzipped)
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
  // STALE: was 7 bytes, now 10 bytes per cell (glyph_u32 + fg_rgb + bg_rgb) since a26be4a
  const layerDataSize = 10 * 5 * 7; // 350 bytes — STALE: fixture still uses 7-byte layout
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
  const compressed = compressWithGzip(cellData);

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

// Helper function: Create buffer with column-major test data
function createColumnMajorTestBuffer() {
  const headerBuffer = new ArrayBuffer(20);
  const headerView = new DataView(headerBuffer);
  headerView.setUint32(0, 0x50584552, true);
  headerView.setInt32(4, 1, true);
  headerView.setInt32(8, 2, true); // 2x2 canvas
  headerView.setInt32(12, 2, true);
  headerView.setInt32(16, 1, true);

  // Column-major order for 2x2:
  // x=0: y=0 (glyph=1), y=1 (glyph=2)
  // x=1: y=0 (glyph=3), y=1 (glyph=4)
  const cellData = new Uint8Array(2 * 2 * 7);
  const cells = [
    { glyph: 1, fg: [255, 0, 0], bg: [0, 0, 0] },
    { glyph: 2, fg: [0, 255, 0], bg: [0, 0, 0] },
    { glyph: 3, fg: [0, 0, 255], bg: [0, 0, 0] },
    { glyph: 4, fg: [255, 255, 0], bg: [0, 0, 0] }
  ];

  for (let i = 0; i < 4; i++) {
    const cell = cells[i];
    cellData[i * 7] = cell.glyph;
    cellData[i * 7 + 1] = cell.fg[0];
    cellData[i * 7 + 2] = cell.fg[1];
    cellData[i * 7 + 3] = cell.fg[2];
    cellData[i * 7 + 4] = cell.bg[0];
    cellData[i * 7 + 5] = cell.bg[1];
    cellData[i * 7 + 6] = cell.bg[2];
  }

  const compressed = compressWithGzip(cellData);

  const fullBuffer = new ArrayBuffer(20 + 12 + compressed.length);
  const fullView = new Uint8Array(fullBuffer);
  fullView.set(new Uint8Array(headerBuffer), 0);

  const layerHeaderView = new DataView(fullBuffer, 20, 12);
  layerHeaderView.setInt32(0, 2, true); // width
  layerHeaderView.setInt32(4, 2, true); // height
  layerHeaderView.setInt32(8, compressed.length, true);

  fullView.set(new Uint8Array(compressed), 32);

  return fullBuffer;
}

// Helper function: Create buffer with multiple layers
function createValidXPBufferWithMultipleLayers() {
  const headerBuffer = new ArrayBuffer(20);
  const headerView = new DataView(headerBuffer);
  headerView.setUint32(0, 0x50584552, true);
  headerView.setInt32(4, 1, true);
  headerView.setInt32(8, 5, true); // 5 wide
  headerView.setInt32(12, 3, true); // 3 tall
  headerView.setInt32(16, 3, true); // 3 layers

  // Calculate total size: header + (layer_header + compressed_data) * 3
  let totalSize = 20;
  const compressedLayers = [];

  // Prepare all layers first to calculate size
  for (let l = 0; l < 3; l++) {
    const cellData = new Uint8Array(5 * 3 * 7);
    for (let i = 0; i < cellData.length; i++) {
      cellData[i] = 65 + l; // different glyph per layer
    }
    const compressed = compressWithGzip(cellData);
    compressedLayers.push(compressed);
    totalSize += 12 + compressed.length;
  }

  // Build full buffer
  const fullBuffer = new ArrayBuffer(totalSize);
  const fullView = new Uint8Array(fullBuffer);
  fullView.set(new Uint8Array(headerBuffer), 0);

  // Write each layer
  let offset = 20;
  for (let l = 0; l < 3; l++) {
    const layerHeaderView = new DataView(fullBuffer, offset, 12);
    layerHeaderView.setInt32(0, 5, true); // width
    layerHeaderView.setInt32(4, 3, true); // height
    layerHeaderView.setInt32(8, compressedLayers[l].length, true);
    offset += 12;

    fullView.set(new Uint8Array(compressedLayers[l]), offset);
    offset += compressedLayers[l].length;
  }

  return fullBuffer;
}

// Helper function: Create buffer with transparent cells
function createBufferWithTransparentCells() {
  const headerBuffer = new ArrayBuffer(20);
  const headerView = new DataView(headerBuffer);
  headerView.setUint32(0, 0x50584552, true);
  headerView.setInt32(4, 1, true);
  headerView.setInt32(8, 2, true);
  headerView.setInt32(12, 2, true);
  headerView.setInt32(16, 1, true);

  // Transparent cell: glyph=0, bg=(255,0,255)
  const cellData = new Uint8Array(2 * 2 * 7);
  for (let i = 0; i < 4; i++) {
    cellData[i * 7] = 0; // transparent glyph
    cellData[i * 7 + 1] = 0; // fg_r
    cellData[i * 7 + 2] = 0; // fg_g
    cellData[i * 7 + 3] = 0; // fg_b
    cellData[i * 7 + 4] = 255; // bg_r (magenta)
    cellData[i * 7 + 5] = 0; // bg_g
    cellData[i * 7 + 6] = 255; // bg_b
  }

  const compressed = compressWithGzip(cellData);

  const fullBuffer = new ArrayBuffer(20 + 12 + compressed.length);
  const fullView = new Uint8Array(fullBuffer);
  fullView.set(new Uint8Array(headerBuffer), 0);

  const layerHeaderView = new DataView(fullBuffer, 20, 12);
  layerHeaderView.setInt32(0, 2, true);
  layerHeaderView.setInt32(4, 2, true);
  layerHeaderView.setInt32(8, compressed.length, true);

  fullView.set(new Uint8Array(compressed), 32);

  return fullBuffer;
}

// Run summary
console.log('\n' + '='.repeat(60));
const success = runner.summary();
console.log('='.repeat(60));

process.exit(success ? 0 : 1);
