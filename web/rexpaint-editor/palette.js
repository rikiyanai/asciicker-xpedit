/**
 * Palette
 *
 * Manages foreground/background colors for the REXPaint editor.
 * Supports RGB arrays and hex string formats, with event emission for color changes.
 * Also manages apply modes for glyph/foreground/background channels.
 */

export class Palette {
  constructor() {
    // Default colors: white foreground, black background
    this._fg = [255, 255, 255];
    this._bg = [0, 0, 0];

    // Apply modes: track which channels to apply when painting
    this._applyModes = {
      glyph: true,
      foreground: true,
      background: true,
    };

    // Event listeners
    this._listeners = new Map();
  }

  /**
   * Get foreground color as RGB array
   */
  getForeground() {
    return [...this._fg];
  }

  /**
   * Set foreground color
   * @param {number[] | string} color - RGB array [r,g,b] or hex string '#RRGGBB'
   */
  setForeground(color) {
    this._fg = this.normalizeColor(color);
    this._emitColorChanged();
  }

  /**
   * Get background color as RGB array
   */
  getBackground() {
    return [...this._bg];
  }

  /**
   * Set background color
   * @param {number[] | string} color - RGB array [r,g,b] or hex string '#RRGGBB'
   */
  setBackground(color) {
    this._bg = this.normalizeColor(color);
    this._emitColorChanged();
  }

  /**
   * Normalize color format to RGB array
   * Accepts either [r,g,b] array or '#RRGGBB' hex string
   * Clamps values to 0-255
   * @param {number[] | string} color
   * @returns {number[]} RGB array
   */
  normalizeColor(color) {
    if (Array.isArray(color)) {
      // Clamp RGB values to 0-255
      return [
        Math.max(0, Math.min(255, Math.round(color[0]))),
        Math.max(0, Math.min(255, Math.round(color[1]))),
        Math.max(0, Math.min(255, Math.round(color[2]))),
      ];
    }

    if (typeof color === 'string' && color.startsWith('#')) {
      // Parse hex string '#RRGGBB'
      const hex = color.substring(1);
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return [r, g, b];
      }
    }

    throw new Error(`Invalid color format: ${color}`);
  }

  /**
   * Convert RGB array to hex string
   * @param {number[]} rgb - RGB array [r,g,b]
   * @returns {string} Hex string '#RRGGBB'
   */
  rgbToHex(rgb) {
    const toHex = (n) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb[0]).toUpperCase()}${toHex(rgb[1]).toUpperCase()}${toHex(rgb[2]).toUpperCase()}`;
  }

  /**
   * Set apply mode for a channel
   * @param {string} channel - 'glyph', 'foreground', or 'background'
   * @param {boolean} enabled
   */
  setApplyMode(channel, enabled) {
    if (channel in this._applyModes) {
      this._applyModes[channel] = enabled;
      this._emitApplyModeChanged();
    }
  }

  /**
   * Get all apply modes
   * @returns {Object} {glyph, foreground, background}
   */
  getApplyMode() {
    return { ...this._applyModes };
  }

  /**
   * Register event listener
   * @param {string} event - Event name ('color-changed', 'apply-mode-changed')
   * @param {Function} callback
   * @returns {Function} Unsubscribe function to remove this listener
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to all listeners
   * @private
   */
  _emit(event, ...args) {
    const callbacks = this._listeners.get(event) || [];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  /**
   * Emit color-changed event
   * @private
   */
  _emitColorChanged() {
    this._emit('color-changed', {
      fg: this.getForeground(),
      bg: this.getBackground(),
    });
  }

  /**
   * Emit apply-mode-changed event
   * @private
   */
  _emitApplyModeChanged() {
    this._emit('apply-mode-changed', this.getApplyMode());
  }

  /**
   * Dispose: removes all event listeners
   * Call this when the palette is no longer needed (e.g., modal closes)
   */
  dispose() {
    this._listeners.clear();
  }

  /**
   * Render color picker UI
   * Creates foreground/background color input elements
   * @param {HTMLElement} container
   */
  render(container) {
    // Create container for palette UI
    const paletteEl = document.createElement('div');
    paletteEl.className = 'palette-container';

    // Foreground color section
    const fgSection = document.createElement('div');
    fgSection.className = 'palette-section fg-section';

    const fgLabel = document.createElement('label');
    fgLabel.textContent = 'Foreground';
    fgLabel.className = 'palette-label';

    const fgInput = document.createElement('input');
    fgInput.type = 'color';
    fgInput.className = 'palette-color-input fg-input';
    fgInput.value = this.rgbToHex(this._fg);

    fgInput.addEventListener('input', (e) => {
      this.setForeground(e.target.value);
    });

    fgSection.appendChild(fgLabel);
    fgSection.appendChild(fgInput);

    // Background color section
    const bgSection = document.createElement('div');
    bgSection.className = 'palette-section bg-section';

    const bgLabel = document.createElement('label');
    bgLabel.textContent = 'Background';
    bgLabel.className = 'palette-label';

    const bgInput = document.createElement('input');
    bgInput.type = 'color';
    bgInput.className = 'palette-color-input bg-input';
    bgInput.value = this.rgbToHex(this._bg);

    bgInput.addEventListener('input', (e) => {
      this.setBackground(e.target.value);
    });

    bgSection.appendChild(bgLabel);
    bgSection.appendChild(bgInput);

    // Apply modes section
    const modesSection = document.createElement('div');
    modesSection.className = 'palette-apply-modes';

    const modes = ['glyph', 'foreground', 'background'];
    for (const mode of modes) {
      const modeContainer = document.createElement('div');
      modeContainer.className = 'apply-mode-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = `apply-mode-checkbox apply-mode-${mode}`;
      checkbox.checked = this._applyModes[mode];

      checkbox.addEventListener('change', (e) => {
        this.setApplyMode(mode, e.target.checked);
      });

      const modeLabel = document.createElement('label');
      modeLabel.className = 'apply-mode-label';
      modeLabel.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);

      modeContainer.appendChild(checkbox);
      modeContainer.appendChild(modeLabel);
      modesSection.appendChild(modeContainer);
    }

    paletteEl.appendChild(fgSection);
    paletteEl.appendChild(bgSection);
    paletteEl.appendChild(modesSection);
    container.appendChild(paletteEl);
  }
}
