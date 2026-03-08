/**
 * Glyph Picker UI Component
 *
 * Renders a 16x16 grid of CP437 glyph buttons (0-255).
 * Supports selection, event listeners, and styling.
 */

export class GlyphPicker {
  constructor(cellWidth = 12, cellHeight = 12) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.selectedGlyph = 0;
    this.listeners = new Map();
    this.glyphButtons = new Map();
    this.gridContainer = null;
  }

  /**
   * Render the 16x16 glyph grid into a container.
   * @param {HTMLElement} container
   */
  render(container) {
    // Create grid container
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'glyph-picker-grid';
    this.glyphButtons.clear();

    // Create 256 glyph buttons (16x16 grid)
    for (let code = 0; code < 256; code++) {
      const button = document.createElement('button');
      button.className = 'glyph-button';
      button.setAttribute('title', `Glyph ${code}`);

      // Set display text: show '·' for unprintable characters (0-31, 127)
      const isPrintable = (code >= 32 && code < 127) || code >= 128;
      if (isPrintable) {
        button.textContent = String.fromCharCode(code);
      } else {
        button.textContent = '·';
      }

      // Add click handler
      button.addEventListener('click', () => {
        this.selectGlyph(code);
      });

      // Store reference for later lookup
      this.glyphButtons.set(code, button);

      // Add to grid
      this.gridContainer.appendChild(button);
    }

    // Set initial selection highlight
    this._updateSelection();

    // Add to container
    container.appendChild(this.gridContainer);
  }

  /**
   * Select a glyph by code and emit 'select' event.
   * @param {number} code - CP437 code (0-255)
   */
  selectGlyph(code) {
    if (code < 0 || code > 255) {
      throw new Error(`Invalid glyph code: ${code}`);
    }
    this.selectedGlyph = code;
    this._updateSelection();
    this.emit('select', code);
  }

  /**
   * Get the currently selected glyph code.
   * @returns {number}
   */
  getSelectedGlyph() {
    return this.selectedGlyph;
  }

  /**
   * Register an event listener.
   * @param {string} event - Event name (e.g., 'select')
   * @param {function} callback - Callback function
   * @returns {Function} Unsubscribe function to remove this listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit an event to all registered listeners.
   * @param {string} event - Event name
   * @param {...*} args - Event arguments
   */
  emit(event, ...args) {
    const callbacks = this.listeners.get(event) || [];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  /**
   * Update the visual selection highlight.
   * @private
   */
  _updateSelection() {
    // Remove 'selected' class from all buttons
    for (const button of this.glyphButtons.values()) {
      button.classList.remove('selected');
    }

    // Add 'selected' class to current selection
    const selectedButton = this.glyphButtons.get(this.selectedGlyph);
    if (selectedButton) {
      selectedButton.classList.add('selected');
    }
  }

  /**
   * Dispose: removes all event listeners
   * Call this when the glyph picker is no longer needed (e.g., modal closes)
   */
  dispose() {
    this.listeners.clear();
  }
}
