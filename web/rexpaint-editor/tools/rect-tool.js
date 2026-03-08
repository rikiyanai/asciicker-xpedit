/**
 * Rectangle Tool - Draw filled or outline rectangles
 *
 * Draws rectangles from start point to end point.
 * Single press draws outline, double press draws filled.
 * Respects apply modes to selectively apply glyph and colors.
 */

export class RectTool {
  /**
   * Create a new RectTool instance
   */
  constructor() {
    // Target canvas reference
    this.canvas = null;

    // Current tool state
    this.glyph = 0;
    this.fg = [255, 255, 255]; // white
    this.bg = [0, 0, 0];       // black

    // Apply modes: independent flags for each attribute
    this.applyModes = {
      glyph: true,
      foreground: true,
      background: true,
    };

    // Rectangle state
    this.isDrawing = false;
    this.rectStartX = 0;
    this.rectStartY = 0;
    this.rectEndX = 0;
    this.rectEndY = 0;

    // Mode: 'outline' or 'filled'
    this.mode = 'outline';
  }

  /**
   * Set the target canvas for this tool
   * @param {Canvas} canvas - The Canvas instance to paint on
   */
  setCanvas(canvas) {
    this.canvas = canvas;
  }

  /**
   * Set the active glyph code
   * @param {number} code - CP437 glyph code (0-255)
   */
  setGlyph(code) {
    this.glyph = code & 0xFF; // Ensure 0-255
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
   * Set the rectangle drawing mode
   * @param {string} mode - 'outline' or 'filled'
   */
  setMode(mode) {
    if (mode === 'outline' || mode === 'filled') {
      this.mode = mode;
    }
  }

  /**
   * Paint a single cell at the given coordinates
   * @param {number} x - Cell column
   * @param {number} y - Cell row
   * @private
   */
  _paint(x, y) {
    if (!this.canvas) {
      throw new Error('Canvas not set');
    }

    // Determine what to apply based on apply modes
    let glyph = this.glyph;
    let fg = [...this.fg];
    let bg = [...this.bg];

    // If apply mode is disabled, use existing cell value
    if (!this.applyModes.glyph) {
      const existingCell = this.canvas.getCell(x, y);
      glyph = existingCell.glyph;
    }

    if (!this.applyModes.foreground) {
      const existingCell = this.canvas.getCell(x, y);
      fg = [...existingCell.fg];
    }

    if (!this.applyModes.background) {
      const existingCell = this.canvas.getCell(x, y);
      bg = [...existingCell.bg];
    }

    this.canvas.setCell(x, y, glyph, fg, bg);
  }

  /**
   * Start drawing a rectangle at the given coordinates
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  startRect(x, y) {
    this.isDrawing = true;
    this.rectStartX = x;
    this.rectStartY = y;
    this.rectEndX = x;
    this.rectEndY = y;
  }

  /**
   * Update the preview endpoint of the rectangle
   * @param {number} x - Current cell column
   * @param {number} y - Current cell row
   */
  drawRect(x, y) {
    if (!this.isDrawing) {
      return;
    }

    this.rectEndX = x;
    this.rectEndY = y;
  }

  /**
   * Commit the rectangle to the canvas
   */
  endRect() {
    if (!this.isDrawing) {
      return;
    }

    // Normalize coordinates (handle swapped corners)
    const x1 = Math.min(this.rectStartX, this.rectEndX);
    const y1 = Math.min(this.rectStartY, this.rectEndY);
    const x2 = Math.max(this.rectStartX, this.rectEndX);
    const y2 = Math.max(this.rectStartY, this.rectEndY);

    if (this.mode === 'filled') {
      this._drawFilledRect(x1, y1, x2, y2);
    } else {
      this._drawOutlineRect(x1, y1, x2, y2);
    }

    this.isDrawing = false;
    this.rectStartX = 0;
    this.rectStartY = 0;
    this.rectEndX = 0;
    this.rectEndY = 0;
  }

  /**
   * Draw a filled rectangle
   * @param {number} x1 - Left edge
   * @param {number} y1 - Top edge
   * @param {number} x2 - Right edge
   * @param {number} y2 - Bottom edge
   * @private
   */
  _drawFilledRect(x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        this._paint(x, y);
      }
    }
  }

  /**
   * Draw an outline rectangle
   * @param {number} x1 - Left edge
   * @param {number} y1 - Top edge
   * @param {number} x2 - Right edge
   * @param {number} y2 - Bottom edge
   * @private
   */
  _drawOutlineRect(x1, y1, x2, y2) {
    // Top and bottom edges
    for (let x = x1; x <= x2; x++) {
      this._paint(x, y1);
      this._paint(x, y2);
    }

    // Left and right edges (excluding corners to avoid double-paint)
    for (let y = y1 + 1; y < y2; y++) {
      this._paint(x1, y);
      this._paint(x2, y);
    }
  }
}
