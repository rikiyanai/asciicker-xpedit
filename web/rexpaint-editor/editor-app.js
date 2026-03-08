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

import { FillTool } from './tools/fill-tool.js';
import { KeyboardHandler } from './keyboard-handler.js';

export class EditorApp {
  /**
   * Create a new EditorApp instance
   * @param {Object} config - Configuration object
   * @param {Canvas} config.canvas - The Canvas instance
   * @param {Palette} config.palette - The Palette instance
   * @param {GlyphPicker} config.glyphPicker - The GlyphPicker instance
   * @param {Array} config.tools - (Optional) Array of tool instances
   * @param {HTMLElement} config.modalElement - (Optional) Element to attach keyboard handler to
   */
  constructor({ canvas, palette, glyphPicker, tools = [], modalElement = null }) {
    this.canvas = canvas;
    this.palette = palette;
    this.glyphPicker = glyphPicker;
    this.tools = tools;

    // Tool references for keyboard shortcuts
    this.cellTool = null;
    this.lineTool = null;
    this.rectTool = null;
    this.ovalTool = null;
    this.fillTool = null;
    this.textTool = null;

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

    // Pan/drag state
    this.panMode = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    // Store event unsubscribe functions for cleanup
    this._unsubscribers = [];

    // Create keyboard handler
    this.keyboardHandler = new KeyboardHandler(this);
    if (modalElement) {
      this.keyboardHandler.attach(modalElement);
    }

    // Wire component events
    this._wireComponentEvents();

    // Set up apply mode toggle buttons
    this._setupApplyModeToggles();

    // Set up grid toggle button
    this._setupGridToggle();

    // Set up status bar
    this._setupStatusBar();
  }

  /**
   * Set up status bar display elements and event handlers
   * Attaches mousemove and click listeners to canvas to update position and cell displays
   * @private
   */
  _setupStatusBar() {
    // Cache status bar element references
    this.statusBar = {
      posDisplay: document.getElementById('posDisplay'),
      cellDisplay: document.getElementById('cellDisplay'),
      toolDisplay: document.getElementById('toolDisplay'),
      modeDisplay: document.getElementById('modeDisplay'),
    };

    // Only set up if status bar elements exist (REXPaint editor modal)
    if (!this.statusBar.posDisplay) {
      return;
    }

    // Get the canvas element
    const canvasElement = document.getElementById('rexpaintCanvas');
    if (!canvasElement) {
      return;
    }

    // Handle canvas mousemove to update position and cell display
    canvasElement.addEventListener('mousemove', (e) => {
      const rect = canvasElement.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Convert screen coordinates to cell coordinates using canvas font size
      const pixelsPerCell = this.getFontSize() || 12;
      const cellX = Math.floor(screenX / pixelsPerCell);
      const cellY = Math.floor(screenY / pixelsPerCell);

      // Update position display
      this.statusBar.posDisplay.textContent = `Pos: ${cellX}, ${cellY}`;

      // Get current cell from canvas and display glyph info
      if (this.canvas && typeof this.canvas.getCell === 'function') {
        const cell = this.canvas.getCell(cellX, cellY);
        if (cell) {
          const glyphCode = cell.glyph || 0;
          const glyphChar = String.fromCharCode(glyphCode);
          this.statusBar.cellDisplay.textContent = `Cell: ${glyphCode} (${glyphChar})`;
        } else {
          this.statusBar.cellDisplay.textContent = 'Cell: (empty)';
        }
      }
    });

    // Handle canvas click to update position display (in addition to mousemove)
    canvasElement.addEventListener('click', (e) => {
      const rect = canvasElement.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const pixelsPerCell = this.getFontSize() || 12;
      const cellX = Math.floor(screenX / pixelsPerCell);
      const cellY = Math.floor(screenY / pixelsPerCell);

      this.statusBar.posDisplay.textContent = `Pos: ${cellX}, ${cellY}`;
    });

    // Initialize tool display with default tool name
    this._updateToolDisplay();

    // Initialize mode display with current modes
    this._updateModeDisplay();
  }

  /**
   * Update the tool display in the status bar
   * Called when tool is activated
   * @private
   */
  _updateToolDisplay() {
    if (!this.statusBar || !this.statusBar.toolDisplay) {
      return;
    }

    if (this.activeTool && this.activeTool.name) {
      // Remove 'Tool' suffix if present (e.g., 'CellTool' -> 'Cell')
      const toolName = this.activeTool.name.replace(/Tool$/, '');
      this.statusBar.toolDisplay.textContent = `Tool: ${toolName}`;
    } else {
      this.statusBar.toolDisplay.textContent = 'Tool: Cell';
    }
  }

  /**
   * Update the mode display in the status bar with active apply modes
   * Shows which of G (glyph), F (foreground), B (background) are active
   * @private
   */
  _updateModeDisplay() {
    if (!this.statusBar || !this.statusBar.modeDisplay) {
      return;
    }

    const activeModes = [];
    if (this.activeApplyModes.glyph) {
      activeModes.push('G');
    }
    if (this.activeApplyModes.foreground) {
      activeModes.push('F');
    }
    if (this.activeApplyModes.background) {
      activeModes.push('B');
    }

    const modeText = activeModes.length > 0 ? activeModes.join('|') : 'none';
    this.statusBar.modeDisplay.textContent = `Mode: ${modeText}`;
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
   * Set up click handlers for apply mode toggle buttons
   * @private
   */
  _setupApplyModeToggles() {
    const glyphBtn = document.getElementById('applyGlyph');
    const fgBtn = document.getElementById('applyForeground');
    const bgBtn = document.getElementById('applyBackground');

    if (glyphBtn) {
      glyphBtn.addEventListener('click', () => {
        this.activeApplyModes.glyph = !this.activeApplyModes.glyph;
        glyphBtn.classList.toggle('active');
        this._syncApplyModesToTools();
      });
    }

    if (fgBtn) {
      fgBtn.addEventListener('click', () => {
        this.activeApplyModes.foreground = !this.activeApplyModes.foreground;
        fgBtn.classList.toggle('active');
        this._syncApplyModesToTools();
      });
    }

    if (bgBtn) {
      bgBtn.addEventListener('click', () => {
        this.activeApplyModes.background = !this.activeApplyModes.background;
        bgBtn.classList.toggle('active');
        this._syncApplyModesToTools();
      });
    }
  }

  /**
   * Sync apply modes to all active tools
   * @private
   */
  _syncApplyModesToTools() {
    if (this.activeTool && typeof this.activeTool.setApplyModes === 'function') {
      this.activeTool.setApplyModes(this.activeApplyModes);
    }

    // Update status bar with active modes
    this._updateModeDisplay();
  }

  /**
   * Set up click handler for grid toggle button
   * @private
   */
  _setupGridToggle() {
    const gridToggleBtn = document.getElementById('gridToggle');
    if (gridToggleBtn) {
      gridToggleBtn.addEventListener('click', () => {
        if (this.canvas && typeof this.canvas.setGridVisible === 'function') {
          const newState = !this.canvas.showGrid;
          this.canvas.setGridVisible(newState);
          gridToggleBtn.classList.toggle('active');
        }
      });
    }
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

    // Update status bar with active tool name
    this._updateToolDisplay();

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
   * Set pan mode on/off
   * @param {boolean} enabled - Whether pan mode is active
   */
  setPanMode(enabled) {
    this.panMode = enabled;
  }

  /**
   * Start a pan operation at the given screen coordinates
   * @param {number} screenX - Starting X coordinate on screen
   * @param {number} screenY - Starting Y coordinate on screen
   */
  startPan(screenX, screenY) {
    this.panStartX = screenX;
    this.panStartY = screenY;
  }

  /**
   * Continue pan operation, calculating delta and updating canvas offset
   * @param {number} screenX - Current X coordinate on screen
   * @param {number} screenY - Current Y coordinate on screen
   */
  pan(screenX, screenY) {
    const deltaX = screenX - this.panStartX;
    const deltaY = screenY - this.panStartY;

    this.offsetX += deltaX;
    this.offsetY += deltaY;

    this.panStartX = screenX;
    this.panStartY = screenY;

    if (this.canvas && typeof this.canvas.setOffset === 'function') {
      this.canvas.setOffset(this.offsetX, this.offsetY);
    }
  }

  /**
   * End the pan operation
   */
  endPan() {
    this.panMode = false;
  }

  /**
   * Undo the last action
   * Placeholder for future undo/redo stack integration
   */
  undo() {
    // TODO: Implement undo stack (Task 14)
  }

  /**
   * Redo the last undone action
   * Placeholder for future undo/redo stack integration
   */
  redo() {
    // TODO: Implement redo stack (Task 14)
  }

  /**
   * Activate the fill tool
   * Instantiates a FillTool, adds it to the tools array, and activates it
   * @returns {FillTool} The activated fill tool
   */
  activateFillTool() {
    const fillTool = new FillTool();
    fillTool.setCanvas(this.canvas);
    fillTool.setGlyph(this.activeGlyph);
    fillTool.setColors(this.activeFg, this.activeBg);
    fillTool.setApplyModes(this.activeApplyModes);

    // Add to tools array if not already present
    if (!this.tools.includes(fillTool)) {
      this.tools.push(fillTool);
    }

    // Activate the tool
    this.activateTool(fillTool);

    return fillTool;
  }

  /**
   * Dispose of the editor app and all components
   * Unsubscribes all listeners and calls dispose() on components
   */
  dispose() {
    // Dispose keyboard handler
    if (this.keyboardHandler && typeof this.keyboardHandler.dispose === 'function') {
      this.keyboardHandler.dispose();
    }
    this.keyboardHandler = null;

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
