/**
 * Fill Tool - Flood fill with BFS algorithm
 *
 * Performs flood fill (bucket fill) on connected cells with the same glyph.
 * Uses breadth-first search (BFS) to traverse all connected cells.
 * Respects apply modes to selectively apply glyph and colors.
 */

export class FillTool {
  /**
   * Create a new FillTool instance
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
  }

  /**
   * Set the target canvas for this tool
   * @param {Canvas} canvas - The Canvas instance to fill on
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
   * Perform flood fill starting from the given coordinates (alias for fill)
   * Called when the user clicks on a cell
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  paint(x, y) {
    this.fill(x, y);
  }

  /**
   * Perform flood fill starting from the given coordinates
   * Uses BFS to fill all connected cells with the same source glyph
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  fill(x, y) {
    if (!this.canvas) {
      throw new Error('Canvas not set');
    }

    // Bounds check on starting position
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
      return; // Starting position is out of bounds
    }

    // Get the target glyph (the glyph at the start position)
    const startCell = this.canvas.getCell(x, y);
    if (!startCell) {
      return; // Cell is invalid
    }

    const targetGlyph = startCell.glyph;

    // BFS flood fill algorithm
    this._fillBFS(x, y, targetGlyph);
  }

  /**
   * BFS flood fill implementation
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate
   * @param {number} targetGlyph - The glyph to match and fill
   * @private
   */
  _fillBFS(startX, startY, targetGlyph) {
    const visited = new Set();
    const queue = [[startX, startY]];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const [x, y] = queue.shift();

      // Paint this cell
      this._paintCell(x, y);

      // Check all 4 neighbors: left, right, up, down
      const neighbors = [
        [x - 1, y], // left
        [x + 1, y], // right
        [x, y - 1], // up
        [x, y + 1], // down
      ];

      for (const [nx, ny] of neighbors) {
        const key = `${nx},${ny}`;

        // Skip if already visited
        if (visited.has(key)) {
          continue;
        }

        // Skip if out of bounds
        if (nx < 0 || ny < 0 || nx >= this.canvas.width || ny >= this.canvas.height) {
          continue;
        }

        // Get the cell and check if it has the target glyph
        const cell = this.canvas.getCell(nx, ny);
        if (cell && cell.glyph === targetGlyph) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }
  }

  /**
   * Paint a single cell, respecting apply modes
   * @param {number} x - Cell column
   * @param {number} y - Cell row
   * @private
   */
  _paintCell(x, y) {
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
   * Deactivate the tool (cleanup)
   */
  deactivate() {
    // no-op for fill tool
  }
}
