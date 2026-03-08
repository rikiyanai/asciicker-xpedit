/**
 * Oval Tool - Draw filled or outline ovals/ellipses
 *
 * Draws ovals from start point to end point.
 * Single press draws outline, double press draws filled.
 * Respects apply modes to selectively apply glyph and colors.
 */

export class OvalTool {
  /**
   * Create a new OvalTool instance
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

    // Oval state
    this.isDrawing = false;
    this.ovalStartX = 0;
    this.ovalStartY = 0;
    this.ovalEndX = 0;
    this.ovalEndY = 0;

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
   * Set the oval drawing mode
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

    // Bounds checking
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
      return; // Silently ignore out-of-bounds
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
   * Start drawing an oval at the given coordinates (drag operation start)
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  startDrag(x, y) {
    // Clamp to valid canvas bounds
    if (!this.canvas || x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
      return; // Silently ignore out-of-bounds
    }

    this.isDrawing = true;
    this.ovalStartX = x;
    this.ovalStartY = y;
    this.ovalEndX = x;
    this.ovalEndY = y;
  }

  /**
   * Update the preview endpoint of the oval (drag operation continue)
   * @param {number} x - Current cell column
   * @param {number} y - Current cell row
   */
  drag(x, y) {
    if (!this.isDrawing) {
      return;
    }

    this.ovalEndX = x;
    this.ovalEndY = y;
  }

  /**
   * Commit the oval to the canvas (drag operation end)
   */
  endDrag() {
    if (!this.isDrawing) {
      return;
    }

    // Normalize coordinates
    const x1 = Math.min(this.ovalStartX, this.ovalEndX);
    const y1 = Math.min(this.ovalStartY, this.ovalEndY);
    const x2 = Math.max(this.ovalStartX, this.ovalEndX);
    const y2 = Math.max(this.ovalStartY, this.ovalEndY);

    if (this.mode === 'filled') {
      this._drawFilledOval(x1, y1, x2, y2);
    } else {
      this._drawOutlineOval(x1, y1, x2, y2);
    }

    this.isDrawing = false;
    this.ovalStartX = 0;
    this.ovalStartY = 0;
    this.ovalEndX = 0;
    this.ovalEndY = 0;
  }

  /**
   * Start drawing an oval at the given coordinates (compatibility method)
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  startOval(x, y) {
    this.startDrag(x, y);
  }

  /**
   * Update the preview endpoint of the oval (compatibility method)
   * @param {number} x - Current cell column
   * @param {number} y - Current cell row
   */
  drawOval(x, y) {
    this.drag(x, y);
  }

  /**
   * Commit the oval to the canvas (compatibility method)
   */
  endOval() {
    this.endDrag();
  }

  /**
   * Draw a filled oval
   * @param {number} x1 - Left edge
   * @param {number} y1 - Top edge
   * @param {number} x2 - Right edge
   * @param {number} y2 - Bottom edge
   * @private
   */
  _drawFilledOval(x1, y1, x2, y2) {
    this._drawOval(x1, y1, x2, y2, true);
  }

  /**
   * Draw an outline oval
   * @param {number} x1 - Left edge
   * @param {number} y1 - Top edge
   * @param {number} x2 - Right edge
   * @param {number} y2 - Bottom edge
   * @private
   */
  _drawOutlineOval(x1, y1, x2, y2) {
    this._drawOval(x1, y1, x2, y2, false);
  }

  /**
   * Draw an oval using midpoint ellipse algorithm
   * @param {number} x1 - Left edge
   * @param {number} y1 - Top edge
   * @param {number} x2 - Right edge
   * @param {number} y2 - Bottom edge
   * @param {boolean} filled - True for filled, false for outline
   * @private
   */
  _drawOval(x1, y1, x2, y2, filled) {
    // Calculate center and semi-axes
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = (x2 - x1) / 2;
    const ry = (y2 - y1) / 2;

    // Handle degenerate cases
    if (rx === 0 && ry === 0) {
      this._paint(Math.round(cx), Math.round(cy));
      return;
    }

    // Avoid division by zero
    const rxSq = rx * rx || 1;
    const rySq = ry * ry || 1;

    // Iterate through bounding box
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        // Calculate normalized distance from center
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const distSq = dx * dx + dy * dy;

        // Determine if point is on perimeter or inside
        const isInside = distSq <= 1.0;
        const isPerimeter = Math.abs(distSq - 1.0) < 0.25;

        if (filled && isInside) {
          this._paint(x, y);
        } else if (!filled && isPerimeter) {
          this._paint(x, y);
        }
      }
    }
  }

  /**
   * Deactivate the tool
   */
  deactivate() {
    this.isDrawing = false;
  }
}
