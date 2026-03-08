/**
 * Text Tool - Paint horizontal text strings on the canvas
 *
 * Paints text characters as a horizontal sequence, using CP437 character codes.
 * Respects apply modes to selectively apply glyph and colors.
 */

export class TextTool {
  /**
   * Create a new TextTool instance
   */
  constructor() {
    // Target canvas reference
    this.canvas = null;

    // Current tool state
    this.text = '';
    this.fg = [255, 255, 255]; // white
    this.bg = [0, 0, 0];       // black

    // Apply modes: independent flags for each attribute
    this.applyModes = {
      glyph: true,
      foreground: true,
      background: true,
    };
  }

  /**
   * Set the target canvas for this tool
   * @param {Canvas} canvas - The Canvas instance to paint on
   */
  setCanvas(canvas) {
    this.canvas = canvas;
  }

  /**
   * Set the text string to paint
   * @param {string} text - The text string to paint
   */
  setText(text) {
    this.text = text || '';
  }

  /**
   * Set the foreground and background colors
   * @param {Array<number>} fg - Foreground color [R, G, B]
   * @param {Array<number>} bg - Background color [R, G, B]
   */
  setColors(fg, bg) {
    this.fg = [...fg];
    this.bg = [...bg];
  }

  /**
   * Set the apply modes for this tool
   * @param {Object} modes - {glyph, foreground, background} boolean flags
   */
  setApplyModes(modes) {
    if (typeof modes.glyph === 'boolean') {
      this.applyModes.glyph = modes.glyph;
    }
    if (typeof modes.foreground === 'boolean') {
      this.applyModes.foreground = modes.foreground;
    }
    if (typeof modes.background === 'boolean') {
      this.applyModes.background = modes.background;
    }
  }

  /**
   * Paint text at the given coordinates
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  paint(x, y) {
    if (!this.canvas) {
      throw new Error('Canvas not set');
    }

    // Paint each character in the text string
    for (let i = 0; i < this.text.length; i++) {
      const charX = x + i;

      // Skip characters that would extend out-of-bounds
      if (charX < 0 || charX >= this.canvas.width) {
        continue;
      }

      // Skip if y is out of bounds
      if (y < 0 || y >= this.canvas.height) {
        continue;
      }

      // Get the glyph code for this character using charCodeAt
      const glyph = this.text.charCodeAt(i) & 0xFF;

      // Determine what to apply based on apply modes
      let finalGlyph = glyph;
      let finalFg = [...this.fg];
      let finalBg = [...this.bg];

      // If apply mode is disabled, use existing cell value
      if (!this.applyModes.glyph) {
        const existingCell = this.canvas.getCell(charX, y);
        finalGlyph = existingCell.glyph;
      }

      if (!this.applyModes.foreground) {
        const existingCell = this.canvas.getCell(charX, y);
        finalFg = [...existingCell.fg];
      }

      if (!this.applyModes.background) {
        const existingCell = this.canvas.getCell(charX, y);
        finalBg = [...existingCell.bg];
      }

      this.canvas.setCell(charX, y, finalGlyph, finalFg, finalBg);
    }
  }

  /**
   * Deactivate the tool (no-op stub)
   */
  deactivate() {
    // No special cleanup needed for text tool
  }
}
