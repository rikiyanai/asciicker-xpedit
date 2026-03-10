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

  /**
   * Read and decompress all layers from the XP file
   * @returns {Array} Array of layer objects, each with width, height, data (2D cell array), and getCell(x, y) method
   * @throws {Error} If decompression or parsing fails
   */
  getLayers() {
    if (this.cachedLayers) {
      return this.cachedLayers;
    }

    const layers = [];

    for (let i = 0; i < this.layerCount; i++) {
      try {
        // Read layer header
        const layerWidth = this.view.getInt32(this.offset, true);
        this.offset += 4;
        const layerHeight = this.view.getInt32(this.offset, true);
        this.offset += 4;

        // Read compressed data size
        const compressedSize = this.view.getInt32(this.offset, true);
        this.offset += 4;

        // Read compressed data
        const compressedData = this.buffer.slice(this.offset, this.offset + compressedSize);
        this.offset += compressedSize;

        // Decompress gzip data
        const decompressed = this._decompressGzip(compressedData);

        // Parse cells (column-major format from disk, transpose to row-major)
        const cells = this._parseCells(decompressed, layerWidth, layerHeight);

        layers.push({
          width: layerWidth,
          height: layerHeight,
          data: cells,
          getCell: (x, y) => (cells[y] && cells[y][x]) ? cells[y][x] : null
        });
      } catch (error) {
        throw new Error(`Failed to parse layer ${i}: ${error.message}`);
      }
    }

    this.cachedLayers = layers;
    return layers;
  }

  /**
   * Decompress gzip-compressed cell data
   * @param {ArrayBuffer} compressed - The gzip-compressed data
   * @returns {Uint8Array} The decompressed data
   * @throws {Error} If decompression fails
   */
  _decompressGzip(compressed) {
    try {
      const decompressed = zlib.gunzipSync(Buffer.from(compressed));
      return new Uint8Array(decompressed);
    } catch (error) {
      throw new Error(`Gzip decompression failed: ${error.message}`);
    }
  }

  /**
   * Parse cell data from decompressed buffer
   * XP files store cells in column-major order (x varies outer, y varies inner).
   * This method transposes to row-major order for easier 2D array access.
   *
   * Cell format: 10 bytes per cell (REXPaint standard)
   * - glyph: 4 bytes (uint32 little-endian CP437 code point)
   * - fg_r, fg_g, fg_b: 3 bytes
   * - bg_r, bg_g, bg_b: 3 bytes
   *
   * @param {Uint8Array} data - The decompressed cell data
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Array<Array>} 2D array of cells in row-major order: cells[y][x]
   */
  _parseCells(data, width, height) {
    const BYTES_PER_CELL = 10;
    const cells = [];

    // Initialize row-major 2D array
    for (let y = 0; y < height; y++) {
      cells[y] = [];
    }

    // Parse column-major data and transpose to row-major
    let offset = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (offset + BYTES_PER_CELL > data.length) {
          throw new Error(
            `Insufficient data for cell at (${x}, ${y}): expected ${BYTES_PER_CELL} bytes, only ${data.length - offset} remaining`
          );
        }

        // Read glyph as 4-byte little-endian uint32
        const glyph = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
        const fgR = data[offset + 4];
        const fgG = data[offset + 5];
        const fgB = data[offset + 6];
        const bgR = data[offset + 7];
        const bgG = data[offset + 8];
        const bgB = data[offset + 9];
        offset += BYTES_PER_CELL;

        cells[y][x] = {
          glyph: glyph >>> 0,  // Ensure unsigned 32-bit
          fg: [fgR, fgG, fgB],
          bg: [bgR, bgG, bgB]
        };
      }
    }

    return cells;
  }
}
