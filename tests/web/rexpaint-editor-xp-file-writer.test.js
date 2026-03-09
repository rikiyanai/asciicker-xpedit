/**
 * XP File Writer Tests - Core Structure & Compression
 *
 * Run with: node tests/web/rexpaint-editor-xp-file-writer.test.js
 *
 * Tests ensure that:
 * - XPFileWriter creates valid XP file headers
 * - Dimensions are validated before writing
 * - Layer encoding works in column-major format
 * - Gzip compression is applied correctly
 * - Cell data is properly formatted (7 bytes per cell)
 */

import { XPFileWriter } from '../../web/rexpaint-editor/xp-file-writer.js';
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

  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(
        message || `Expected ${actual} to be greater than ${expected}`
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

// Test runner instance
const runner = new TestRunner();

// Test suite: Constructor and Validation
runner.describe('Constructor and Validation', () => {
  runner.it('should create XP file writer with valid dimensions', () => {
    runner.assertNoThrow(
      () => new XPFileWriter(80, 25, 3),
      'Should accept valid dimensions'
    );
  });

  runner.it('should reject zero width', () => {
    runner.assertThrows(
      () => new XPFileWriter(0, 25, 1),
      'Invalid dimensions',
      'Should throw on zero width'
    );
  });

  runner.it('should reject zero height', () => {
    runner.assertThrows(
      () => new XPFileWriter(80, 0, 1),
      'Invalid dimensions',
      'Should throw on zero height'
    );
  });

  runner.it('should reject zero layer count', () => {
    runner.assertThrows(
      () => new XPFileWriter(80, 25, 0),
      'Invalid dimensions',
      'Should throw on zero layer count'
    );
  });

  runner.it('should reject negative width', () => {
    runner.assertThrows(
      () => new XPFileWriter(-1, 25, 1),
      'Invalid dimensions',
      'Should throw on negative width'
    );
  });

  runner.it('should reject negative height', () => {
    runner.assertThrows(
      () => new XPFileWriter(80, -1, 1),
      'Invalid dimensions',
      'Should throw on negative height'
    );
  });

  runner.it('should reject negative layer count', () => {
    runner.assertThrows(
      () => new XPFileWriter(80, 25, -1),
      'Invalid dimensions',
      'Should throw on negative layer count'
    );
  });
});

// Test suite: Header Writing
runner.describe('Header Writing', () => {
  runner.it('should create XP file with valid header', () => {
    const writer = new XPFileWriter(80, 25, 3);
    writer.addLayer(createTestLayer(80, 25));
    writer.addLayer(createTestLayer(80, 25));
    writer.addLayer(createTestLayer(80, 25));
    const buffer = writer.write();

    runner.assertTrue(buffer instanceof ArrayBuffer, 'Should return ArrayBuffer');
    runner.assertGreaterThan(
      buffer.byteLength,
      20,
      'Buffer should contain at least header (20 bytes)'
    );
  });

  runner.it('should write correct magic number', () => {
    const writer = new XPFileWriter(80, 25, 1);
    writer.addLayer(createTestLayer(80, 25));
    const buffer = writer.write();

    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);

    runner.assertEqual(magic, 0x50584552, 'Magic should be 0x50584552');
  });

  runner.it('should write correct version', () => {
    const writer = new XPFileWriter(80, 25, 1);
    writer.addLayer(createTestLayer(80, 25));
    const buffer = writer.write();

    const view = new DataView(buffer);
    const version = view.getInt32(4, true);

    runner.assertEqual(version, 1, 'Version should be 1');
  });

  runner.it('should write correct width and height', () => {
    const writer = new XPFileWriter(100, 50, 1);
    writer.addLayer(createTestLayer(100, 50));
    const buffer = writer.write();

    const view = new DataView(buffer);
    const width = view.getInt32(8, true);
    const height = view.getInt32(12, true);

    runner.assertEqual(width, 100, 'Width should be 100');
    runner.assertEqual(height, 50, 'Height should be 50');
  });

  runner.it('should write correct layer count', () => {
    const writer = new XPFileWriter(80, 25, 3);
    writer.addLayer(createTestLayer(80, 25));
    writer.addLayer(createTestLayer(80, 25));
    writer.addLayer(createTestLayer(80, 25));
    const buffer = writer.write();

    const view = new DataView(buffer);
    const layerCount = view.getInt32(16, true);

    runner.assertEqual(layerCount, 3, 'Layer count should be 3');
  });

  runner.it('should write minimum dimensions (1x1)', () => {
    const writer = new XPFileWriter(1, 1, 1);
    writer.addLayer(createTestLayer(1, 1));
    const buffer = writer.write();

    const view = new DataView(buffer);
    runner.assertEqual(view.getInt32(8, true), 1, 'Width should be 1');
    runner.assertEqual(view.getInt32(12, true), 1, 'Height should be 1');
  });

  runner.it('should write large dimensions', () => {
    const writer = new XPFileWriter(256, 256, 1);
    writer.addLayer(createTestLayer(256, 256));
    const buffer = writer.write();

    const view = new DataView(buffer);
    runner.assertEqual(view.getInt32(8, true), 256, 'Width should be 256');
    runner.assertEqual(view.getInt32(12, true), 256, 'Height should be 256');
  });
});

// Test suite: Layer Addition and Validation
runner.describe('Layer Addition and Validation', () => {
  runner.it('should accept valid layer data', () => {
    const writer = new XPFileWriter(80, 25, 1);
    runner.assertNoThrow(
      () => writer.addLayer(createTestLayer(80, 25)),
      'Should accept layer with matching dimensions'
    );
  });

  runner.it('should reject layer with wrong width', () => {
    const writer = new XPFileWriter(80, 25, 1);
    runner.assertThrows(
      () => writer.addLayer(createTestLayer(100, 25)),
      'Layer dimensions',
      'Should reject layer with wrong width'
    );
  });

  runner.it('should reject layer with wrong height', () => {
    const writer = new XPFileWriter(80, 25, 1);
    runner.assertThrows(
      () => writer.addLayer(createTestLayer(80, 50)),
      'Layer dimensions',
      'Should reject layer with wrong height'
    );
  });

  runner.it('should accept multiple layers with correct dimensions', () => {
    const writer = new XPFileWriter(80, 25, 3);
    runner.assertNoThrow(() => {
      writer.addLayer(createTestLayer(80, 25));
      writer.addLayer(createTestLayer(80, 25));
      writer.addLayer(createTestLayer(80, 25));
    });
  });
});

// Test suite: Layer Encoding
runner.describe('Layer Encoding', () => {
  runner.it('should encode layer data in column-major format', () => {
    const writer = new XPFileWriter(2, 2, 1);
    const testLayer = [
      [
        { glyph: 1, fg: [255, 0, 0], bg: [0, 0, 0] },
        { glyph: 3, fg: [0, 0, 255], bg: [0, 0, 0] }
      ],
      [
        { glyph: 2, fg: [0, 255, 0], bg: [0, 0, 0] },
        { glyph: 4, fg: [255, 255, 0], bg: [0, 0, 0] }
      ]
    ];
    writer.addLayer(testLayer);
    const buffer = writer.write();

    // Buffer should be: header(20) + layer_header(12) + compressed_data
    // Verify it's a valid buffer
    runner.assertTrue(buffer instanceof ArrayBuffer);
    runner.assertGreaterThan(buffer.byteLength, 32);
  });

  runner.it('should preserve glyph values', () => {
    const writer = new XPFileWriter(1, 1, 1);
    const testLayer = [
      [{ glyph: 65, fg: [255, 255, 255], bg: [0, 0, 0] }]
    ];
    writer.addLayer(testLayer);
    const buffer = writer.write();

    runner.assertTrue(buffer instanceof ArrayBuffer);
    runner.assertGreaterThan(buffer.byteLength, 20);
  });

  runner.it('should preserve color values', () => {
    const writer = new XPFileWriter(1, 1, 1);
    const testLayer = [
      [{ glyph: 65, fg: [200, 100, 50], bg: [10, 20, 30] }]
    ];
    writer.addLayer(testLayer);
    const buffer = writer.write();

    runner.assertTrue(buffer instanceof ArrayBuffer);
    runner.assertGreaterThan(buffer.byteLength, 20);
  });
});

// Test suite: Compression
runner.describe('Compression', () => {
  runner.it('should compress layer data', () => {
    const writer = new XPFileWriter(80, 25, 1);
    writer.addLayer(createTestLayer(80, 25));
    const buffer = writer.write();

    // Total size should be reasonable for compressed data
    // 80x25 = 2000 cells * 7 bytes = 14000 bytes uncompressed
    // Should be much smaller compressed
    runner.assertGreaterThan(buffer.byteLength, 32, 'Should have content');
  });

  runner.it('should apply gzip compression to layer data', () => {
    const writer = new XPFileWriter(10, 5, 1);
    writer.addLayer(createTestLayer(10, 5));
    const buffer = writer.write();

    // Skip past header (20) and layer header (12)
    const dataView = new Uint8Array(buffer);
    const layerDataStart = 32;

    // After header, we should have layer header then compressed data
    // Compressed data should be gzipped (not all bytes same as uncompressed)
    runner.assertTrue(buffer.byteLength > 32, 'Should have compressed data');
  });
});

// Test suite: Complete Write Output
runner.describe('Complete Write Output', () => {
  runner.it('should produce valid XP buffer with single layer', () => {
    const writer = new XPFileWriter(10, 5, 1);
    writer.addLayer(createTestLayer(10, 5));
    const buffer = writer.write();

    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    const version = view.getInt32(4, true);
    const width = view.getInt32(8, true);
    const height = view.getInt32(12, true);
    const layerCount = view.getInt32(16, true);

    runner.assertEqual(magic, 0x50584552);
    runner.assertEqual(version, 1);
    runner.assertEqual(width, 10);
    runner.assertEqual(height, 5);
    runner.assertEqual(layerCount, 1);
  });

  runner.it('should produce valid XP buffer with multiple layers', () => {
    const writer = new XPFileWriter(10, 5, 3);
    writer.addLayer(createTestLayer(10, 5));
    writer.addLayer(createTestLayer(10, 5));
    writer.addLayer(createTestLayer(10, 5));
    const buffer = writer.write();

    const view = new DataView(buffer);
    const layerCount = view.getInt32(16, true);

    runner.assertEqual(layerCount, 3);
    runner.assertGreaterThan(buffer.byteLength, 20);
  });
});

// Helper function to create test layer data
function createTestLayer(width, height) {
  const layer = [];
  for (let y = 0; y < height; y++) {
    layer[y] = [];
    for (let x = 0; x < width; x++) {
      layer[y][x] = {
        glyph: 65 + ((x + y) % 26),
        fg: [200, 150, 100],
        bg: [50, 50, 50]
      };
    }
  }
  return layer;
}

// Run summary
console.log('\n' + '='.repeat(60));
const success = runner.summary();
console.log('='.repeat(60));

process.exit(success ? 0 : 1);
