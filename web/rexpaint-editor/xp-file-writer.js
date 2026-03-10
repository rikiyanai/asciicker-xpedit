/**
 * XP File Writer
 *
 * Writes canvas data to REXPaint XP binary format.
 * Handles layer encoding and gzip compression.
 *
 * XP File Format (little-endian):
 * - Bytes 0-3:   Magic number 0x50584552 ("REXP")
 * - Bytes 4-7:   Version (int32)
 * - Bytes 8-11:  Width (int32)
 * - Bytes 12-15: Height (int32)
 * - Bytes 16-19: Layer count (int32)
 * - Bytes 20+:   Layer data (each: layer_width(4) + layer_height(4) + compressed_size(4) + compressed_data)
 *
 * Cell format (10 bytes per cell, column-major order on disk - REXPaint standard):
 * - glyph: 4 bytes (uint32 little-endian CP437 code point)
 * - fg_r, fg_g, fg_b: 3 bytes
 * - bg_r, bg_g, bg_b: 3 bytes
 */

import zlib from 'zlib';

export class XPFileWriter {
  /**
   * Create a new XPFileWriter
   * @param {number} width - Canvas width in cells
   * @param {number} height - Canvas height in cells
   * @param {number} layerCount - Number of layers to expect
   * @throws {Error} If dimensions are invalid
   */
  constructor(width, height, layerCount) {
    // Validate dimensions
    if (width <= 0 || height <= 0 || layerCount <= 0) {
      throw new Error('Invalid dimensions: width, height, and layerCount must be positive');
    }

    this.width = width;
    this.height = height;
    this.layerCount = layerCount;
    this.layers = [];
  }

  /**
   * Add a layer to the writer
   * @param {Array<Array>} cells - 2D array of cells [y][x] with {glyph, fg, bg}
   * @throws {Error} If layer dimensions don't match canvas dimensions
   */
  addLayer(cells) {
    // Validate layer dimensions
    if (!cells || cells.length !== this.height) {
      throw new Error(
        `Layer dimensions do not match: expected height ${this.height}, got ${cells ? cells.length : 'undefined'}`
      );
    }

    if (cells[0].length !== this.width) {
      throw new Error(
        `Layer dimensions do not match: expected width ${this.width}, got ${cells[0].length}`
      );
    }

    this.layers.push(cells);
  }

  /**
   * Write all layers to an XP file format ArrayBuffer
   * @returns {ArrayBuffer} The complete XP file data
   * @throws {Error} If layer count doesn't match expected count
   */
  write() {
    const parts = [];

    // Write main header
    const header = new ArrayBuffer(20);
    const headerView = new DataView(header);

    // Magic number: "REXP" = 0x50584552 (little-endian)
    headerView.setUint32(0, 0x50584552, true);

    // Version: 1
    headerView.setInt32(4, 1, true);

    // Canvas dimensions
    headerView.setInt32(8, this.width, true);
    headerView.setInt32(12, this.height, true);

    // Layer count
    headerView.setInt32(16, this.layerCount, true);

    parts.push(new Uint8Array(header));

    // Write each layer
    for (let i = 0; i < this.layers.length; i++) {
      const layerData = this._encodeLayer(this.layers[i]);
      parts.push(layerData);
    }

    // Combine all parts into single buffer
    const totalSize = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const combined = new Uint8Array(totalSize);

    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.byteLength;
    }

    return combined.buffer;
  }

  /**
   * Encode a single layer to column-major format with gzip compression
   * @param {Array<Array>} cells - 2D array of cells [y][x]
   * @returns {Uint8Array} Encoded layer data with header
   * @private
   */
  _encodeLayer(cells) {
    // Create cell data in column-major format
    // Disk layout: for each x (0..width-1), iterate y (0..height-1)
    const cellBytes = [];

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const cell = cells[y][x];

        // Write 10 bytes per cell (REXPaint format)
        // Glyph: 4 bytes (uint32 little-endian)
        const glyph = cell.glyph >>> 0;  // Ensure unsigned 32-bit
        cellBytes.push(glyph & 0xFF);
        cellBytes.push((glyph >> 8) & 0xFF);
        cellBytes.push((glyph >> 16) & 0xFF);
        cellBytes.push((glyph >> 24) & 0xFF);
        // FG: 3 bytes
        cellBytes.push(cell.fg[0] & 0xFF);
        cellBytes.push(cell.fg[1] & 0xFF);
        cellBytes.push(cell.fg[2] & 0xFF);
        // BG: 3 bytes
        cellBytes.push(cell.bg[0] & 0xFF);
        cellBytes.push(cell.bg[1] & 0xFF);
        cellBytes.push(cell.bg[2] & 0xFF);
      }
    }

    const uncompressed = Buffer.from(cellBytes);

    // Compress with gzip
    const compressed = zlib.gzipSync(uncompressed);

    // Create layer header
    const layerHeader = new ArrayBuffer(12);
    const layerHeaderView = new DataView(layerHeader);
    layerHeaderView.setInt32(0, this.width, true);
    layerHeaderView.setInt32(4, this.height, true);
    layerHeaderView.setInt32(8, compressed.length, true);

    // Combine header + compressed data
    const result = new Uint8Array(12 + compressed.length);
    result.set(new Uint8Array(layerHeader));
    result.set(new Uint8Array(compressed), 12);

    return result;
  }
}
