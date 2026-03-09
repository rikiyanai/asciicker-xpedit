/**
 * XP File Reader
 *
 * Reads and parses REXPaint XP files (.xp format).
 * Handles both raw and gzip-compressed data.
 *
 * XP File Format (little-endian):
 * - Bytes 0-3:   Magic number 0x50584552 ("REXP")
 * - Bytes 4-7:   Version (int32)
 * - Bytes 8-11:  Width (int32)
 * - Bytes 12-15: Height (int32)
 * - Bytes 16-19: Layer count (int32)
 * - Bytes 20+:   Layer data (gzip-compressed column-major format)
 */

import zlib from 'zlib';

export class XPFileReader {
  /**
   * Create a new XPFileReader
   * @param {ArrayBuffer} arrayBuffer - The XP file data (raw or gzip-compressed)
   * @throws {Error} If magic number is invalid or dimensions are invalid
   */
  constructor(arrayBuffer) {
    this.buffer = arrayBuffer;

    // Try to detect and decompress gzip data
    const decompressed = this._tryDecompressGzip(arrayBuffer);
    this.view = new DataView(decompressed);
    this.offset = 0;

    // Parse the header
    this.parseHeader();
  }

  /**
   * Detect if buffer is gzip-compressed and decompress if needed
   * Gzip files start with magic bytes 0x1f 0x8b
   * @param {ArrayBuffer} arrayBuffer
   * @returns {ArrayBuffer} Decompressed data or original if not gzipped
   * @throws {Error} If gzip data is corrupted
   */
  _tryDecompressGzip(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);

    // Check for gzip magic bytes (0x1f 0x8b)
    if (view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b) {
      try {
        const decompressed = zlib.gunzipSync(Buffer.from(arrayBuffer));
        return decompressed.buffer.slice(
          decompressed.byteOffset,
          decompressed.byteOffset + decompressed.byteLength
        );
      } catch (error) {
        throw new Error(`Failed to decompress gzip data: ${error.message}`);
      }
    }

    // Not gzipped, return original
    return arrayBuffer;
  }

  /**
   * Parse XP file header
   * @throws {Error} If magic number is invalid or dimensions are invalid
   */
  parseHeader() {
    // Read magic number (should be "REXP" = 0x50584552 in little-endian)
    const magic = this.view.getUint32(this.offset, true);
    this.offset += 4;

    if (magic !== 0x50584552) {
      throw new Error(
        `Invalid XP file: bad magic number (expected 0x50584552, got 0x${magic.toString(16)})`
      );
    }

    // Read version
    this.version = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Read dimensions
    this.width = this.view.getInt32(this.offset, true);
    this.offset += 4;

    this.height = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Read layer count
    this.layerCount = this.view.getInt32(this.offset, true);
    this.offset += 4;

    // Validate dimensions
    if (this.width <= 0 || this.height <= 0 || this.layerCount <= 0) {
      throw new Error(
        `Invalid XP dimensions: width=${this.width}, height=${this.height}, layers=${this.layerCount}`
      );
    }
  }

  /**
   * Check if the XP file header is valid
   * @returns {boolean} True if all dimensions are positive
   */
  isValid() {
    return this.width > 0 && this.height > 0 && this.layerCount > 0;
  }
}
