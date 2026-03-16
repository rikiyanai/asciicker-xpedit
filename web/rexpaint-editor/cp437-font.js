/**
 * CP437 Font Module - Handles CP437 glyph rendering from bitmap spritesheet
 *
 * Loads a CP437 spritesheet (16x16 grid of glyphs) and provides methods to:
 * - Extract individual glyphs with caching
 * - Draw glyphs to canvas contexts with color blending
 * - Support variable glyph dimensions (12x12, 16x16, etc.)
 */

export class CP437Font {
  /**
   * Create a CP437 font renderer from a spritesheet
   * @param {string} spriteSheetUrl - URL to the CP437 spritesheet PNG
   * @param {number} glyphWidth - Width of each glyph in pixels (default 12)
   * @param {number} glyphHeight - Height of each glyph in pixels (default 12)
   */
  constructor(spriteSheetUrl, glyphWidth = 12, glyphHeight = 12) {
    this.spriteSheetUrl = spriteSheetUrl;
    this.glyphWidth = glyphWidth;
    this.glyphHeight = glyphHeight;
    this.spriteSheet = null;
    this.glyphCache = new Map(); // Maps glyph code (0-255) to extracted ImageData
    this.loadPromise = null;
  }

  /**
   * Load the CP437 spritesheet image
   * @returns {Promise<void>}
   */
  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';

      image.onload = () => {
        // Create a canvas copy of the loaded image for efficient access
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        this.spriteSheet = canvas;
        resolve();
      };

      image.onerror = () => {
        reject(new Error(`Failed to load CP437 spritesheet: ${this.spriteSheetUrl}`));
      };

      image.src = this.spriteSheetUrl;
    });

    return this.loadPromise;
  }

  /**
   * Extract a single glyph from the spritesheet
   * Spritesheet layout: 16 glyphs per row (columns 0-15)
   * Code 0-15 → row 0, 16-31 → row 1, etc.
   *
   * @param {number} code - CP437 glyph code (0-255)
   * @returns {ImageData} Image data for the glyph (dimensions: glyphWidth x glyphHeight)
   * @throws {Error} If code is outside 0-255 range or spritesheet not loaded
   */
  getGlyph(code) {
    // Validate code range
    if (code < 0 || code > 255) {
      throw new Error(`Invalid glyph code ${code}. Must be 0-255.`);
    }

    // Return cached glyph if available
    if (this.glyphCache.has(code)) {
      return this.glyphCache.get(code);
    }

    // Ensure spritesheet is loaded
    if (!this.spriteSheet) {
      throw new Error('Spritesheet not loaded. Call load() first.');
    }

    // Calculate spritesheet coordinates
    // Code: 0-15 (row 0), 16-31 (row 1), ..., 240-255 (row 15)
    const col = code % 16;
    const row = Math.floor(code / 16);
    const sx = col * this.glyphWidth;
    const sy = row * this.glyphHeight;

    // Extract glyph from spritesheet using a temporary canvas
    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = this.glyphWidth;
    glyphCanvas.height = this.glyphHeight;
    const glyphCtx = glyphCanvas.getContext('2d');

    glyphCtx.drawImage(
      this.spriteSheet,
      sx,
      sy,
      this.glyphWidth,
      this.glyphHeight,
      0,
      0,
      this.glyphWidth,
      this.glyphHeight
    );

    // Get image data and cache it
    const imageData = glyphCtx.getImageData(0, 0, this.glyphWidth, this.glyphHeight);
    this.glyphCache.set(code, imageData);

    return imageData;
  }

  /**
   * Draw a glyph to a canvas context with color blending
   * Uses the glyph's alpha channel to blend the foreground color.
   *
   * @param {CanvasRenderingContext2D} ctx - Target canvas context
   * @param {number} code - CP437 glyph code (0-255)
   * @param {number} x - Pixel X coordinate to draw at
   * @param {number} y - Pixel Y coordinate to draw at
   * @param {Array<number>} fg - Foreground color [R, G, B] (0-255)
   * @param {Array<number>} bg - Background color [R, G, B] (0-255)
   * @throws {Error} If code is invalid or glyph not available
   */
  drawGlyph(ctx, code, x, y, fg, bg) {
    // Validate inputs
    if (code < 0 || code > 255) {
      throw new Error(`Invalid glyph code ${code}. Must be 0-255.`);
    }

    // Validate color arrays and clamp values
    if (!Array.isArray(fg) || fg.length < 3) {
      fg = [255, 255, 255]; // Default to white
    } else {
      fg = fg.slice(0, 3).map(c => {
        const val = Math.round(c);
        return isNaN(val) ? 255 : Math.max(0, Math.min(255, val));
      });
    }

    if (!Array.isArray(bg) || bg.length < 3) {
      bg = [0, 0, 0]; // Default to black
    } else {
      bg = bg.slice(0, 3).map(c => {
        const val = Math.round(c);
        return isNaN(val) ? 0 : Math.max(0, Math.min(255, val));
      });
    }

    // Draw background rectangle
    ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
    ctx.fillRect(x, y, this.glyphWidth, this.glyphHeight);

    // Get glyph data
    const glyphData = this.getGlyph(code);
    const data = glyphData.data;

    // Create a blended canvas with foreground color applied
    const blendedCanvas = document.createElement('canvas');
    blendedCanvas.width = this.glyphWidth;
    blendedCanvas.height = this.glyphHeight;
    const blendCtx = blendedCanvas.getContext('2d');

    // Create image data with blended colors
    const blendedData = blendCtx.createImageData(this.glyphWidth, this.glyphHeight);
    const blendedPixels = blendedData.data;

    // The bundled CP437 sheet is RGB (white glyphs on black), not RGBA.
    // Use source luminance as the glyph mask so imported sheets render shaped glyphs,
    // not solid color blocks.
    for (let i = 0; i < data.length; i += 4) {
      const luminance = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);

      if (luminance > 0) {
        // Glyph pixel: use foreground color with mask derived from brightness
        blendedPixels[i] = fg[0]; // Red
        blendedPixels[i + 1] = fg[1]; // Green
        blendedPixels[i + 2] = fg[2]; // Blue
        blendedPixels[i + 3] = luminance; // Brightness -> alpha
      } else {
        // Background pixel: keep transparent so the background fill shows through
        blendedPixels[i + 3] = 0;
      }
    }

    // Draw the blended glyph to the context
    blendCtx.putImageData(blendedData, 0, 0);
    ctx.drawImage(blendedCanvas, x, y);
  }

  /**
   * Clear the glyph cache (used when font properties change)
   */
  clearCache() {
    this.glyphCache.clear();
  }
}
