/**
 * Selection Tool - Rectangular selection with marching ants visualization
 *
 * Allows users to select a rectangular region of cells.
 * Selection can be queried for bounds and included cells.
 * Provides API for other tools to check if cells are within selection.
 */

export class SelectTool {
  /**
   * Create a new SelectTool instance
   */
  constructor() {
    // Target canvas reference
    this.canvas = null;

    // Selection state
    this.startX = null;
    this.startY = null;
    this.endX = null;
    this.endY = null;
  }

  /**
   * Set the target canvas for this tool
   * @param {Canvas} canvas - The Canvas instance to track selection on
   */
  setCanvas(canvas) {
    this.canvas = canvas;
  }

  /**
   * Start a selection at the given coordinates
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  startSelection(x, y) {
    this.startX = x;
    this.startY = y;
    this.endX = x;
    this.endY = y;
  }

  /**
   * Update the selection endpoint during dragging
   * @param {number} x - Current cell column
   * @param {number} y - Current cell row
   */
  updateSelection(x, y) {
    this.endX = x;
    this.endY = y;
  }

  /**
   * Finalize the selection (optional, called when selection is committed)
   */
  endSelection() {
    // Selection remains active until cleared or deactivated
  }

  /**
   * Get the bounds of the current selection
   * @returns {Object|null} Selection bounds {x, y, width, height} or null if no selection
   */
  getSelectionBounds() {
    if (this.startX === null) {
      return null;
    }

    // Normalize coordinates to handle selections drawn in any direction
    const x1 = Math.min(this.startX, this.endX);
    const y1 = Math.min(this.startY, this.endY);
    const x2 = Math.max(this.startX, this.endX);
    const y2 = Math.max(this.startY, this.endY);

    return {
      x: x1,
      y: y1,
      width: x2 - x1 + 1,
      height: y2 - y1 + 1,
    };
  }

  /**
   * Get all cells within the current selection
   * @returns {Array<Object>} Array of cells with {x, y, glyph, fg, bg}
   */
  getSelectedCells() {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return [];
    }

    if (!this.canvas) {
      throw new Error('Canvas not set');
    }

    const cells = [];
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        const cell = this.canvas.getCell(x, y);
        if (cell) {
          cells.push({ x, y, ...cell });
        }
      }
    }

    return cells;
  }

  /**
   * Check if a cell is within the current selection
   * @param {number} x - Cell column
   * @param {number} y - Cell row
   * @returns {boolean} True if cell is selected
   */
  isSelected(x, y) {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return false;
    }

    return (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    );
  }

  /**
   * Clear the current selection
   */
  clearSelection() {
    this.startX = null;
    this.startY = null;
    this.endX = null;
    this.endY = null;
  }

  /**
   * Deactivate the tool and clear selection
   */
  deactivate() {
    this.clearSelection();
  }
}
