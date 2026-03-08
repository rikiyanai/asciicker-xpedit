/**
 * Canvas Module - Handles CP437 cell rendering on HTML5 Canvas
 */

export class Canvas {
  /**
   * Create a new Canvas instance
   * @param {HTMLCanvasElement} canvasElement - The canvas DOM element
   * @param {number} gridWidth - Width in cells (columns)
   * @param {number} gridHeight - Height in cells (rows)
   * @param {number} cellSizePixels - Size of each cell in pixels (default 12)
   */
  constructor(canvasElement, gridWidth, gridHeight, cellSizePixels = 12) {
    this.canvasElement = canvasElement;
    this.width = gridWidth;
    this.height = gridHeight;
    this.cellSizePixels = cellSizePixels;

    // Set canvas dimensions
    this.canvasElement.width = gridWidth * cellSizePixels;
    this.canvasElement.height = gridHeight * cellSizePixels;

    // Get 2D rendering context
    this.ctx = this.canvasElement.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get 2D canvas context');
    }

    // Cell data storage: key is "x,y", value is {glyph, fg, bg}
    this.cells = new Map();

    // CP437 font renderer (optional, fallback to monospace if not set)
    this.cp437Font = null;

    // Active tool reference
    this.activeTool = null;

    // Store bound event handlers for cleanup
    this._boundHandlers = null;

    // Initialize with default cells (transparent, white on black)
    this._initializeCells();

    // Bind mouse event handlers
    this._bindMouseEventHandlers();
  }

  /**
   * Set the active tool for this canvas
   * @param {Object} tool - The tool instance to activate
   */
  toolActivated(tool) {
    this.activeTool = tool;
    if (tool) {
      tool.setCanvas(this);
    }
  }

  /**
   * Bind mouse event handlers to the canvas element
   * @private
   */
  _bindMouseEventHandlers() {
    if (!this.canvasElement.addEventListener) {
      // Skip event binding in test environments
      return;
    }

    // Store bound handlers for cleanup
    this._boundHandlers = {
      mousedown: (event) => this._onMouseDown(event),
      mousemove: (event) => this._onMouseMove(event),
      mouseup: (event) => this._onMouseUp(event),
      mouseleave: (event) => this._onMouseLeave(event),
    };

    this.canvasElement.addEventListener('mousedown', this._boundHandlers.mousedown);
    this.canvasElement.addEventListener('mousemove', this._boundHandlers.mousemove);
    this.canvasElement.addEventListener('mouseup', this._boundHandlers.mouseup);
    this.canvasElement.addEventListener('mouseleave', this._boundHandlers.mouseleave);
  }

  /**
   * Handle mousedown event
   * @private
   */
  _onMouseDown(event) {
    if (!this.activeTool) {
      return;
    }

    const rect = this.canvasElement.getBoundingClientRect();
    const pixelX = event.clientX - rect.left;
    const pixelY = event.clientY - rect.top;
    const coords = this.pixelToCellCoords(pixelX, pixelY);

    // Check bounds
    if (coords.x < 0 || coords.x >= this.width || coords.y < 0 || coords.y >= this.height) {
      return;
    }

    // Notify tool of drag start
    if (this.activeTool.startDrag) {
      this.activeTool.startDrag(coords.x, coords.y);
      this.render();
    }
  }

  /**
   * Handle mousemove event
   * @private
   */
  _onMouseMove(event) {
    if (!this.activeTool || !this.activeTool.drag) {
      return;
    }

    // Check if mouse button is pressed
    if (event.buttons === 0) {
      return;
    }

    const rect = this.canvasElement.getBoundingClientRect();
    const pixelX = event.clientX - rect.left;
    const pixelY = event.clientY - rect.top;
    const coords = this.pixelToCellCoords(pixelX, pixelY);

    // Check bounds
    if (coords.x < 0 || coords.x >= this.width || coords.y < 0 || coords.y >= this.height) {
      return;
    }

    // Notify tool of drag continuation
    this.activeTool.drag(coords.x, coords.y);
    this.render();
  }

  /**
   * Handle mouseup event
   * @private
   */
  _onMouseUp(event) {
    if (!this.activeTool || !this.activeTool.endDrag) {
      return;
    }

    this.activeTool.endDrag();
    this.render();
  }

  /**
   * Handle mouseleave event
   * @private
   */
  _onMouseLeave(event) {
    if (!this.activeTool || !this.activeTool.endDrag) {
      return;
    }

    // Cancel drag if mouse leaves canvas
    this.activeTool.endDrag();
    this.render();
  }

  /**
   * Initialize all cells with default values
   * @private
   */
  _initializeCells() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const key = `${x},${y}`;
        this.cells.set(key, {
          glyph: 0,
          fg: [255, 255, 255], // white
          bg: [0, 0, 0],       // black
        });
      }
    }
  }

  /**
   * Set a single cell's glyph and colors
   * @param {number} x - Column coordinate
   * @param {number} y - Row coordinate
   * @param {number} glyph - CP437 glyph code (0-255)
   * @param {Array<number>} fg - Foreground color [R, G, B]
   * @param {Array<number>} bg - Background color [R, G, B]
   */
  setCell(x, y, glyph, fg, bg) {
    this._validateCoordinates(x, y);
    const key = `${x},${y}`;
    this.cells.set(key, {
      glyph: glyph & 0xFF, // Ensure 0-255
      fg: [...fg],
      bg: [...bg],
    });
  }

  /**
   * Get a single cell's data
   * @param {number} x - Column coordinate
   * @param {number} y - Row coordinate
   * @returns {Object} Cell data {glyph, fg, bg} - Returns defensive copy to prevent mutation
   */
  getCell(x, y) {
    this._validateCoordinates(x, y);
    const key = `${x},${y}`;
    const stored = this.cells.get(key) || {
      glyph: 0,
      fg: [255, 255, 255],
      bg: [0, 0, 0],
    };

    // Return deep copy to prevent caller from mutating internal state
    return {
      glyph: stored.glyph,
      fg: [...stored.fg],  // Copy array to prevent mutation
      bg: [...stored.bg],  // Copy array to prevent mutation
    };
  }

  /**
   * Convert cell coordinates to pixel coordinates
   * @param {number} cellX - Cell column
   * @param {number} cellY - Cell row
   * @returns {Object} {x, y} pixel coordinates
   */
  cellToPixelCoords(cellX, cellY) {
    return {
      x: cellX * this.cellSizePixels,
      y: cellY * this.cellSizePixels,
    };
  }

  /**
   * Convert pixel coordinates to cell coordinates
   * @param {number} pixelX - Pixel X coordinate
   * @param {number} pixelY - Pixel Y coordinate
   * @returns {Object} {x, y} cell coordinates
   */
  pixelToCellCoords(pixelX, pixelY) {
    return {
      x: Math.floor(pixelX / this.cellSizePixels),
      y: Math.floor(pixelY / this.cellSizePixels),
    };
  }

  /**
   * Clear the entire canvas with black background
   */
  clear() {
    this.ctx.fillStyle = 'rgb(0, 0, 0)';
    this.ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  /**
   * Set the CP437 font renderer
   * @param {CP437Font} cp437Font - The CP437Font instance to use for rendering
   * @returns {Promise<void>}
   */
  async setFont(cp437Font) {
    this.cp437Font = cp437Font;
    if (cp437Font) {
      await cp437Font.load();
    }
  }

  /**
   * Draw a single cell with its glyph and colors
   * @param {number} x - Cell column
   * @param {number} y - Cell row
   * @private
   */
  drawCell(x, y) {
    const cell = this.getCell(x, y);
    const pixelCoords = this.cellToPixelCoords(x, y);

    // Use CP437 font renderer if available and loaded
    if (this.cp437Font && this.cp437Font.spriteSheet) {
      try {
        this.cp437Font.drawGlyph(
          this.ctx,
          cell.glyph,
          pixelCoords.x,
          pixelCoords.y,
          cell.fg,
          cell.bg
        );
        return;
      } catch (e) {
        // Fallback to monospace text if glyph rendering fails
        console.warn(`Failed to render glyph ${cell.glyph}: ${e.message}`);
      }
    }

    // Fallback: render with monospace text
    // Draw background
    const bgColor = `rgb(${cell.bg[0]}, ${cell.bg[1]}, ${cell.bg[2]})`;
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(
      pixelCoords.x,
      pixelCoords.y,
      this.cellSizePixels,
      this.cellSizePixels
    );

    // Draw glyph as character (basic ASCII support)
    const fgColor = `rgb(${cell.fg[0]}, ${cell.fg[1]}, ${cell.fg[2]})`;
    this.ctx.fillStyle = fgColor;
    this.ctx.font = `${this.cellSizePixels}px monospace`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    if (cell.glyph > 0 && cell.glyph < 256) {
      try {
        const char = String.fromCharCode(cell.glyph);
        this.ctx.fillText(char, pixelCoords.x, pixelCoords.y, this.cellSizePixels);
      } catch (e) {
        // Silently skip glyphs that can't be rendered
      }
    }
  }

  /**
   * Fill a rectangular region with uniform cell data
   * @param {number} x - Starting column
   * @param {number} y - Starting row
   * @param {number} w - Width in cells
   * @param {number} h - Height in cells
   * @param {number} glyph - CP437 glyph code
   * @param {Array<number>} fg - Foreground color [R, G, B]
   * @param {Array<number>} bg - Background color [R, G, B]
   */
  fillRect(x, y, w, h, glyph, fg, bg) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cellX = x + dx;
        const cellY = y + dy;
        if (cellX >= 0 && cellX < this.width && cellY >= 0 && cellY < this.height) {
          this.setCell(cellX, cellY, glyph, fg, bg);
        }
      }
    }
  }

  /**
   * Render all cells to the canvas
   */
  render() {
    this.clear();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.drawCell(x, y);
      }
    }
  }

  /**
   * Get the canvas element
   * @returns {HTMLCanvasElement} The canvas DOM element
   */
  getCanvasElement() {
    return this.canvasElement;
  }

  /**
   * Get image data from the canvas
   * @returns {ImageData} The canvas image data
   */
  getImageData() {
    return this.ctx.getImageData(
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height
    );
  }

  /**
   * Validate that coordinates are within bounds
   * @param {number} x - Column coordinate
   * @param {number} y - Row coordinate
   * @private
   */
  _validateCoordinates(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new Error(
        `Coordinates (${x}, ${y}) out of bounds (0-${this.width - 1}, 0-${this.height - 1})`
      );
    }
  }

  /**
   * Change font/cell size and re-render
   * Valid sizes: 8, 10, 12, 16 (matching CP437 bitmap fonts)
   * @param {number} pixelsPerCell - Size of each cell in pixels
   */
  setFontSize(pixelsPerCell) {
    if (![8, 10, 12, 16].includes(pixelsPerCell)) {
      throw new Error('Font size must be 8, 10, 12, or 16 pixels');
    }

    this.cellSizePixels = pixelsPerCell;

    // Update canvas physical size
    this.canvasElement.width = this.width * pixelsPerCell;
    this.canvasElement.height = this.height * pixelsPerCell;

    // Re-render with new size
    this.render();
  }

  /**
   * Get current font size in pixels per cell
   * @returns {number} Current font size (8, 10, 12, or 16)
   */
  getFontSize() {
    return this.cellSizePixels;
  }

  /**
   * Dispose: removes all event listeners and cleans up resources
   * Call this when the canvas is no longer needed (e.g., modal closes)
   */
  dispose() {
    if (!this.canvasElement.removeEventListener || !this._boundHandlers) {
      return;
    }

    // Remove all mouse event listeners
    this.canvasElement.removeEventListener('mousedown', this._boundHandlers.mousedown);
    this.canvasElement.removeEventListener('mousemove', this._boundHandlers.mousemove);
    this.canvasElement.removeEventListener('mouseup', this._boundHandlers.mouseup);
    this.canvasElement.removeEventListener('mouseleave', this._boundHandlers.mouseleave);

    // Clear references
    this._boundHandlers = null;
    this.activeTool = null;
  }
}
