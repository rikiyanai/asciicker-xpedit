/**
 * CP437 Font Module - Handles CP437 glyph rendering
 *
 * This module will provide CP437 font support for the web REXPaint editor.
 * Full font rendering will be implemented in a subsequent task.
 */

export class CP437Font {
  /**
   * Create a CP437 font renderer
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} cellSizePixels - Size of each cell in pixels
   */
  constructor(ctx, cellSizePixels = 12) {
    this.ctx = ctx;
    this.cellSizePixels = cellSizePixels;
    this.glyphCache = new Map();
  }

  /**
   * Render a CP437 glyph at the specified position
   * @param {number} glyph - CP437 glyph code (0-255)
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {Array<number>} fgColor - Foreground color [R, G, B]
   */
  renderGlyph(glyph, x, y, fgColor) {
    // Placeholder: will be replaced with actual CP437 font rendering
    // For now, use basic monospace text rendering
    const color = `rgb(${fgColor[0]}, ${fgColor[1]}, ${fgColor[2]})`;
    this.ctx.fillStyle = color;
    this.ctx.font = `${this.cellSizePixels}px monospace`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    if (glyph > 0 && glyph < 256) {
      try {
        const char = String.fromCharCode(glyph);
        this.ctx.fillText(char, x, y, this.cellSizePixels);
      } catch (e) {
        // Silently skip invalid glyphs
      }
    }
  }

  /**
   * Clear the glyph cache (used when font properties change)
   */
  clearCache() {
    this.glyphCache.clear();
  }
}
