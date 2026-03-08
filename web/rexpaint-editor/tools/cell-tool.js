/**
 * Cell Tool - Basic freehand cell painting tool
 *
 * Paints individual cells with current glyph and colors.
 * Supports drag operations to paint multiple cells.
 * Respects apply modes to selectively apply glyph and colors.
 */

export class CellTool {
  /**
   * Create a new CellTool instance
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

    // Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastDragX = 0;
    this.lastDragY = 0;
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
   * Paint a single cell at the given coordinates
   * @param {number} x - Cell column
   * @param {number} y - Cell row
   */
  paint(x, y) {
    if (!this.canvas) {
      throw new Error('Canvas not set');
    }

    // Clamp to valid canvas bounds
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
   * Start a drag operation
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  startDrag(x, y) {
    this.isDragging = true;
    this.dragStartX = x;
    this.dragStartY = y;
    this.lastDragX = x;
    this.lastDragY = y;

    // Paint the starting cell
    this.paint(x, y);
  }

  /**
   * Continue a drag operation
   * @param {number} x - Current cell column
   * @param {number} y - Current cell row
   */
  drag(x, y) {
    if (!this.isDragging) {
      return;
    }

    // Paint from last position to current position
    const cells = this._lineBresenham(this.lastDragX, this.lastDragY, x, y);
    for (const cell of cells) {
      this.paint(cell.x, cell.y);
    }

    this.lastDragX = x;
    this.lastDragY = y;
  }

  /**
   * End the current drag operation
   */
  endDrag() {
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastDragX = 0;
    this.lastDragY = 0;
  }

  /**
   * Generate cells along a line using Bresenham's algorithm
   * @param {number} x0 - Start X
   * @param {number} y0 - Start Y
   * @param {number} x1 - End X
   * @param {number} y1 - End Y
   * @returns {Array<{x, y}>} Array of cell coordinates along the line
   * @private
   */
  _lineBresenham(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      cells.push({ x, y });

      if (x === x1 && y === y1) {
        break;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return cells;
  }
}
