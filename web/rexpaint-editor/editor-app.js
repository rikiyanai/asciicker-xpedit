/**
 * EditorApp Controller
 *
 * Orchestrates all editor components (Canvas, Palette, GlyphPicker, Tools).
 * Manages canonical editor state and wires component events to keep all tools in sync.
 *
 * State Management:
 * - activeGlyph: Current CP437 glyph code (0-255)
 * - activeFg/activeBg: Current color palette [r, g, b]
 * - activeApplyModes: Which attributes to apply when painting {glyph, foreground, background}
 * - activeTool: Currently active drawing tool (CellTool, LineTool, RectTool, etc.)
 *
 * Event Wiring:
 * - Palette emits 'color-changed' → EditorApp updates all tools
 * - Palette emits 'apply-mode-changed' → EditorApp updates all tools
 * - GlyphPicker emits 'select' → EditorApp updates all tools
 * - Canvas emits mouse events → EditorApp routes to activeTool.paint/startDrag/drag/endDrag
 */

export class EditorApp {
  /**
   * Create a new EditorApp instance
   * @param {Object} config - Configuration object
   * @param {Canvas} config.canvas - The Canvas instance
   * @param {Palette} config.palette - The Palette instance
   * @param {GlyphPicker} config.glyphPicker - The GlyphPicker instance
   * @param {Array} config.tools - (Optional) Array of tool instances
   */
  constructor({ canvas, palette, glyphPicker, tools = [] }) {
    this.canvas = canvas;
    this.palette = palette;
    this.glyphPicker = glyphPicker;
    this.tools = tools;

    // Canonical state
    this.activeGlyph = 0;
    this.activeFg = [255, 255, 255];
    this.activeBg = [0, 0, 0];
    this.activeApplyModes = {
      glyph: true,
      foreground: true,
      background: true,
    };
    this.activeTool = null;

    // Store event unsubscribe functions for cleanup
    this._unsubscribers = [];

    // Wire component events
    this._wireComponentEvents();
  }

  /**
   * Set up event listeners for all components
   * @private
   */
  _wireComponentEvents() {
    // Listen to glyph picker selections
    const unsubGlyph = this.glyphPicker.on('select', (code) => {
      this.activeGlyph = code;
      if (this.activeTool && typeof this.activeTool.setGlyph === 'function') {
        this.activeTool.setGlyph(code);
      }
    });
    this._unsubscribers.push(unsubGlyph);

    // Listen to palette color changes
    const unsubColor = this.palette.on('color-changed', ({ fg, bg }) => {
      this.activeFg = [...fg];
      this.activeBg = [...bg];
      if (this.activeTool && typeof this.activeTool.setColors === 'function') {
        this.activeTool.setColors(this.activeFg, this.activeBg);
      }
    });
    this._unsubscribers.push(unsubColor);

    // Listen to palette apply mode changes
    const unsubApplyMode = this.palette.on('apply-mode-changed', (modes) => {
      this.activeApplyModes = { ...modes };
      if (this.activeTool && typeof this.activeTool.setApplyModes === 'function') {
        this.activeTool.setApplyModes(this.activeApplyModes);
      }
    });
    this._unsubscribers.push(unsubApplyMode);
  }

  /**
   * Activate a drawing tool and sync current state to it
   * Deactivates the previous tool if one was active
   * @param {Object} tool - The tool to activate
   */
  activateTool(tool) {
    // Deactivate previous tool if it has a deactivate method
    if (this.activeTool && typeof this.activeTool.deactivate === 'function') {
      this.activeTool.deactivate();
    }

    // Set new active tool
    this.activeTool = tool;

    // Sync current state to the new tool
    if (tool) {
      if (typeof tool.setGlyph === 'function') {
        tool.setGlyph(this.activeGlyph);
      }
      if (typeof tool.setColors === 'function') {
        tool.setColors(this.activeFg, this.activeBg);
      }
      if (typeof tool.setApplyModes === 'function') {
        tool.setApplyModes(this.activeApplyModes);
      }
    }

    // Tell canvas about the active tool
    if (this.canvas && typeof this.canvas.setActiveTool === 'function') {
      this.canvas.setActiveTool(tool);
    }
  }

  /**
   * Paint a single cell via the active tool
   * @param {number} x - Cell column
   * @param {number} y - Cell row
   */
  paint(x, y) {
    if (this.activeTool && typeof this.activeTool.paint === 'function') {
      this.activeTool.paint(x, y);
    }
  }

  /**
   * Start a drag operation on the active tool
   * @param {number} x - Starting cell column
   * @param {number} y - Starting cell row
   */
  startDrag(x, y) {
    if (this.activeTool && typeof this.activeTool.startDrag === 'function') {
      this.activeTool.startDrag(x, y);
    }
  }

  /**
   * Continue a drag operation on the active tool
   * @param {number} x - Current cell column
   * @param {number} y - Current cell row
   */
  drag(x, y) {
    if (this.activeTool && typeof this.activeTool.drag === 'function') {
      this.activeTool.drag(x, y);
    }
  }

  /**
   * End the current drag operation on the active tool
   */
  endDrag() {
    if (this.activeTool && typeof this.activeTool.endDrag === 'function') {
      this.activeTool.endDrag();
    }
  }

  /**
   * Change font size on the canvas
   * Valid sizes: 8, 10, 12, 16
   * @param {number} pixelsPerCell - Size in pixels
   */
  setFontSize(pixelsPerCell) {
    if (this.canvas && typeof this.canvas.setFontSize === 'function') {
      this.canvas.setFontSize(pixelsPerCell);
    }
  }

  /**
   * Get current font size
   * @returns {number} Current font size in pixels
   */
  getFontSize() {
    if (this.canvas && typeof this.canvas.getFontSize === 'function') {
      return this.canvas.getFontSize();
    }
    return 12; // Default
  }

  /**
   * Dispose of the editor app and all components
   * Unsubscribes all listeners and calls dispose() on components
   */
  dispose() {
    // Unsubscribe all event listeners
    for (const unsubscribe of this._unsubscribers) {
      unsubscribe();
    }
    this._unsubscribers = [];

    // Deactivate current tool
    if (this.activeTool && typeof this.activeTool.deactivate === 'function') {
      this.activeTool.deactivate();
    }
    this.activeTool = null;

    // Dispose all components
    if (this.canvas && typeof this.canvas.dispose === 'function') {
      this.canvas.dispose();
    }
    if (this.palette && typeof this.palette.dispose === 'function') {
      this.palette.dispose();
    }
    if (this.glyphPicker && typeof this.glyphPicker.dispose === 'function') {
      this.glyphPicker.dispose();
    }

    // Dispose all tools
    for (const tool of this.tools) {
      if (tool && typeof tool.dispose === 'function') {
        tool.dispose();
      }
    }
    this.tools = [];
  }
}
