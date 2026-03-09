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

// Run summary
console.log('\n' + '='.repeat(60));
const success = runner.summary();
console.log('='.repeat(60));

process.exit(success ? 0 : 1);
