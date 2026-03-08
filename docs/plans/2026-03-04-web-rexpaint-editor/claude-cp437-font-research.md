# CP437 Bitmap Font Rendering for Web Canvas -- Deep Research

## 1. CP437 Font Atlas Approach

### Loading a CP437 Bitmap Font PNG

A standard CP437 font is a PNG image containing a 16x16 grid of 256 glyphs (code points 0x00-0xFF). The glyphs are white on black (or white on transparent). To load:

```javascript
const fontImg = new Image();
fontImg.src = 'cp437_12x12.png';
await new Promise(resolve => fontImg.onload = resolve);

// Auto-detect glyph dimensions from image size
const glyphW = fontImg.width / 16;
const glyphH = fontImg.height / 16;
```

### Rendering Individual Glyphs via drawImage

The 9-argument form of `drawImage` extracts a source rectangle from the font atlas:

```javascript
function drawGlyph(ctx, glyphIndex, destX, destY, glyphW, glyphH, fontImg) {
    const srcX = (glyphIndex % 16) * glyphW;
    const srcY = Math.floor(glyphIndex / 16) * glyphH;
    ctx.drawImage(fontImg, srcX, srcY, glyphW, glyphH, destX, destY, glyphW, glyphH);
}
```

### Foreground Color Tinting (source-in technique)

The proven Canvas 2D technique (from Geoff Blair's canvas-bitmap-fonts):

1. Prepare the font image as **white glyphs on transparent background** (not black).
   - If the font is white-on-black, pre-process it once: draw to offscreen canvas, read ImageData, set every black pixel to transparent, keep white pixels.
2. For each unique foreground color needed:
   - Draw the font atlas to an offscreen buffer canvas.
   - Set `globalCompositeOperation = 'source-in'`.
   - Fill the entire buffer with the desired foreground color.
   - This replaces all white pixels with the color while preserving transparency.
3. Use `drawImage` from the tinted buffer to extract individual glyphs.

```javascript
function createTintedFont(fontImg, color) {
    const buffer = document.createElement('canvas');
    buffer.width = fontImg.width;
    buffer.height = fontImg.height;
    const bCtx = buffer.getContext('2d');

    // Draw font atlas (white on transparent)
    bCtx.drawImage(fontImg, 0, 0);

    // Apply color tint
    bCtx.globalCompositeOperation = 'source-in';
    bCtx.fillStyle = color;
    bCtx.fillRect(0, 0, buffer.width, buffer.height);

    return buffer; // Now contains colored glyphs on transparent bg
}
```

### Background Color

Background is simply a filled rectangle drawn BEFORE the glyph:

```javascript
function drawCell(ctx, glyphIndex, x, y, fgColor, bgColor, tintedFont, glyphW, glyphH) {
    // 1. Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, glyphW, glyphH);

    // 2. Foreground glyph (from pre-tinted font atlas)
    const srcX = (glyphIndex % 16) * glyphW;
    const srcY = Math.floor(glyphIndex / 16) * glyphH;
    ctx.drawImage(tintedFont, srcX, srcY, glyphW, glyphH, x, y, glyphW, glyphH);
}
```

### Performance: Pre-colored Glyph Caching vs Per-Draw Tinting

**Pre-colored atlas caching (RECOMMENDED for Canvas 2D):**
- Create one tinted font atlas canvas per unique foreground color used.
- Cache in a `Map<string, HTMLCanvasElement>`.
- Typical XP files use 10-50 unique colors, so 10-50 cached canvases.
- Each `drawImage` from cache is extremely fast (GPU-accelerated blit).
- For a 126x80 grid (10,080 cells), this means ~10K `drawImage` calls per frame, each a simple blit from cached canvas.

**Per-draw tinting (NOT recommended):**
- Using `source-in` compositing per cell per frame is expensive.
- Would require 10K composite operations per frame.
- 10-100x slower than cached approach.

**Benchmark reference (from Geoff Blair / Mirko Sertic):**
- Pre-rendered bitmap cache: ~1ms per frame (Firefox).
- Direct fillText: ~10ms per frame.
- Canvas `drawImage` from cached source is the fastest 2D operation available.

---

## 2. Existing Implementations and Libraries

### rex-viewer by jjclark1982
- **URL**: https://github.com/jjclark1982/rex-viewer
- **Type**: HTML Canvas-based RexPaint .xp image viewer
- **Approach**: Drag-and-drop font PNG + .xp file. Renders using Canvas 2D.
- **Key feature**: Supports loading arbitrary font PNGs (REXPaint-compatible).
- **Status**: Small, self-contained. The best existing reference for exactly what we want.
- **Rendering**: Uses `drawImage` with source rects from font atlas. Supports fg/bg coloring.

### pcface by susam
- **URL**: https://github.com/susam/pcface
- **Type**: Bitmap arrays (not PNG atlas) for CP437 glyphs.
- **Approach**: Encodes each glyph as an array of integers (bit patterns per row). Renders pixel-by-pixel using `fillRect` for each "on" pixel.
- **Key feature**: Avoids antialiasing entirely. Ships multiple IBM PC OEM fonts (8x8, 8x14, 8x16, 9x14, 9x16).
- **Rendering**: `drawChar()`, `drawString()` functions. Sets `fillStyle` then loops over bitmap bits.
- **Performance**: Slow for large grids (pixel-by-pixel), but pixel-perfect. Good for reference, not for editor.

### rexpaintjs by chiguireitor
- **URL**: https://www.npmjs.com/package/rexpaintjs
- **Type**: .xp file parser only. No rendering.
- **API**: Parses binary .xp format, returns layer/cell data with glyph indices and colors.
- **Relevance**: Useful for loading .xp files but does not draw anything.

### rexpaintjs-fork by adri326
- **URL**: https://github.com/adri326/rexpaintjs-fork
- **Type**: Enhanced .xp parser. Still no visual rendering.
- **Adds**: Better API, more features for working with .xp data in JavaScript.

### glyph-image.js by Dominus-Sicarum
- **Type**: Node.js module for loading .xp files as Array of Maps.
- **No visual rendering** -- data access only.

### rot.js by ondras
- **URL**: https://github.com/ondras/rot.js
- **Type**: Roguelike toolkit with multiple display backends.
- **Tile backend**: Treats tiles like a bitmap font. Uses `drawImage` with source rects.
- **Color handling**: Foreground color multiplied with tile image data. Background drawn as rect behind tile.
- **Caching**: Creates buffer cache keyed on (character, foreground color) -> Image.
- **Relevance**: Mature, well-tested. The tile backend is conceptually identical to what we need.
- **File**: `src/display/tile.ts` and `src/display/tile-gl.ts` (WebGL variant).

### fastiles by ondras
- **URL**: https://github.com/ondras/fastiles
- **Type**: Ultra-fast WebGL 2 bitmap font renderer.
- **Approach**: Single GL draw call for entire scene. Indexed color palette (up to 256 colors).
- **Performance**: Thousands of tiles at 60fps. No per-render memory allocations.
- **Key design**: Font atlas loaded as WebGL texture. Fragment shader samples glyph from atlas, multiplies by palette color.
- **Relevance**: The gold standard for performance. Overkill for an editor but worth studying.

### gw-canvas by funnisimo
- **URL**: https://github.com/funnisimo/gw-canvas
- **Type**: WebGL canvas for roguelikes, forked from fastiles concepts.
- **Approach**: Loads 16x16 font image into WebGL. Infers glyph size from image dimensions.
- **Color system**: 12-bit color (4 bits per channel). `draw(x, y, glyphCode, fgColor, bgColor)`.
- **Relevance**: Clean API, demonstrates WebGL font atlas approach with simple color model.

### Summary Table

| Library | Renders visually? | Technology | Font loading | Color support |
|---------|------------------|------------|-------------|---------------|
| rex-viewer | YES | Canvas 2D | PNG drag-drop | fg + bg |
| pcface | YES | Canvas 2D (pixel) | Embedded bitmaps | fg only |
| rexpaintjs | No | N/A | N/A | N/A |
| rexpaintjs-fork | No | N/A | N/A | N/A |
| glyph-image.js | No | N/A | N/A | N/A |
| rot.js | YES | Canvas 2D / WebGL | Image tiles | fg + bg, cached |
| fastiles | YES | WebGL 2 | Texture atlas | Indexed palette |
| gw-canvas | YES | WebGL | Texture atlas | 12-bit fg + bg |

---

## 3. Font Interchangeability (REXPaint-style)

### REXPaint Font System

REXPaint stores fonts as PNG bitmaps in `data/fonts/`. Each PNG is a 16-column x 16-row grid of white-on-black glyphs. The font configuration file `_config.xt` defines available font sets.

#### Fonts shipped with REXPaint v1.70:

| File | Glyph Size | Image Size | Resolution @80x60 |
|------|-----------|------------|-------------------|
| cp437_8x8.png | 8x8 | 128x128 | 640x480 |
| cp437_10x10.png | 10x10 | 160x160 | 800x600 |
| cp437_12x12.png | 12x12 | 192x192 | 960x720 |
| cp437_14x14.png | 14x14 | 224x224 | 1120x840 |
| cp437_16x16.png | 16x16 | 256x256 | 1280x960 |
| cp437_18x18.png | 18x18 | 288x288 | 1440x1080 |
| cp437_20x20.png | 20x20 | 320x320 | 1600x1200 |

**Total: 7 font sizes** (all square glyphs, all 16x16 grid layout).

Default font (first in `_config.xt`): **cp437_12x12** (used for both GUI and art).

#### _config.xt Format:
```
// Each line defines a font set:
// "Set Name"  file_basename  columns  rows  [art_file  columns  rows]  unicode  mirror  available
"CP437 12x12"  cp437_12x12  16  16  cp437_12x12  16  16  _utf8  _mirror  1
```

Key observations:
- GUI font and Art font can be different (but REXPaint ships them as the same).
- All fonts are 16 columns x 16 rows = 256 glyphs.
- Columns/Rows are always 16/16 for CP437.
- Unicode mapping is via `_utf8.txt`.
- Mirror mapping is via `_mirror.txt`.

### Web Implementation Plan

```javascript
class FontAtlas {
    constructor() {
        this.glyphW = 0;
        this.glyphH = 0;
        this.image = null;         // Original white-on-transparent
        this.colorCache = new Map(); // color string -> tinted canvas
    }

    async load(pngUrl) {
        const img = new Image();
        img.src = pngUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Auto-detect glyph dimensions
        this.glyphW = img.width / 16;
        this.glyphH = img.height / 16;

        // Convert white-on-black to white-on-transparent
        this.image = this._makeTransparent(img);

        // Clear color cache (font changed)
        this.colorCache.clear();
    }

    _makeTransparent(img) {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            // Black pixels -> transparent
            if (d[i] === 0 && d[i+1] === 0 && d[i+2] === 0) {
                d[i+3] = 0; // alpha = 0
            }
            // White pixels -> keep white, full alpha
        }
        ctx.putImageData(id, 0, 0);
        return c;
    }

    getTinted(color) {
        if (this.colorCache.has(color)) return this.colorCache.get(color);

        const c = document.createElement('canvas');
        c.width = this.image.width;
        c.height = this.image.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(this.image, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, c.width, c.height);

        this.colorCache.set(color, c);
        return c;
    }
}
```

Font switching is simply: call `atlas.load(newFontUrl)`. The grid dimensions recalculate automatically, the color cache is rebuilt lazily on next draw.

---

## 4. Color Tinting Techniques Comparison

### Method 1: Offscreen Canvas + globalCompositeOperation 'source-in' (RECOMMENDED)

**How it works:**
1. Load font as white-on-transparent.
2. For each unique color, create an offscreen canvas.
3. Draw font atlas, then composite 'source-in' with solid color fill.
4. Cache the result. Use `drawImage` with source rects for individual glyphs.

**Pros:**
- Pure Canvas 2D, no WebGL required.
- Very fast once cached (each cell = 1 fillRect + 1 drawImage).
- Memory-efficient: one canvas per unique color.
- Easy to implement and debug.

**Cons:**
- Initial cache creation has a cost (one composite per new color).
- Cache invalidation needed on font change.
- Not as fast as WebGL for >50K cells.

**Performance for 10,000 cells:**
- ~10K drawImage calls + ~10K fillRect calls per frame.
- Easily 60fps on modern hardware.
- Measured at ~1ms per frame (Firefox benchmarks).

### Method 2: ImageData Pixel Manipulation

**How it works:**
- Read font atlas as ImageData, loop through pixels, replace white with target color.

**Pros:**
- Maximum control over pixel values.
- Works in workers (OffscreenCanvas).

**Cons:**
- Extremely slow for per-frame use (CPU-bound pixel loops).
- Only viable as a one-time pre-processing step (same as Method 1 but slower).
- Not recommended even for caching -- `source-in` is faster.

### Method 3: CSS filter / hue-rotate

**Pros:** Zero code.
**Cons:** Cannot target precise colors. Hue-rotate shifts ALL colors. Completely unsuitable for arbitrary fg color.

### Method 4: WebGL Shader

**How it works (fastiles approach):**
- Font atlas as GL texture.
- Per-cell data (glyph index, fg color index, bg color index) uploaded as buffer attributes.
- Fragment shader: sample atlas texel. If > threshold, output fg color; else output bg color.
- Single draw call for entire grid.

**Pros:**
- Fastest possible. 1 draw call regardless of cell count.
- Handles 100K+ cells at 60fps.
- No caching needed -- GPU does the tinting.
- Color changes are instant (update palette uniform).

**Cons:**
- Significant implementation complexity (shaders, buffers, state management).
- WebGL context loss handling required.
- Harder to debug.
- Overkill for an editor with <20K cells.

### Method 5: Hybrid (BEST for editor use case)

- Use Canvas 2D with pre-tinted atlas caching (Method 1) for the main editor.
- Only redraw dirty cells (not entire grid every frame).
- On font change: clear cache, lazy-rebuild.
- If performance becomes an issue (huge canvases, animation preview), consider switching to WebGL.

**Recommendation for XP editor:**
Canvas 2D + source-in tinting with dirty-rect tracking. This gives excellent performance (10K cells easily at 60fps), simple code, and trivial font swapping. WebGL is unnecessary unless you need to animate thousands of cells simultaneously.

---

## 5. Dirty-Rect Optimization for Editor

An editor does not need to redraw all 10K cells every frame. Only cells that changed need redrawing:

```javascript
class XPRenderer {
    constructor(canvas, fontAtlas) {
        this.ctx = canvas.getContext('2d');
        this.font = fontAtlas;
        this.dirty = new Set(); // Set of "x,y" strings
    }

    markDirty(x, y) {
        this.dirty.add(`${x},${y}`);
    }

    render(cells) {
        for (const key of this.dirty) {
            const [x, y] = key.split(',').map(Number);
            const cell = cells[y][x]; // { glyph, fg, bg }

            const px = x * this.font.glyphW;
            const py = y * this.font.glyphH;

            // Background
            this.ctx.fillStyle = cell.bg;
            this.ctx.fillRect(px, py, this.font.glyphW, this.font.glyphH);

            // Foreground glyph
            if (cell.glyph !== 0 && cell.glyph !== 32) {
                const tinted = this.font.getTinted(cell.fg);
                const srcX = (cell.glyph % 16) * this.font.glyphW;
                const srcY = Math.floor(cell.glyph / 16) * this.font.glyphH;
                this.ctx.drawImage(tinted,
                    srcX, srcY, this.font.glyphW, this.font.glyphH,
                    px, py, this.font.glyphW, this.font.glyphH);
            }
        }
        this.dirty.clear();
    }
}
```

With dirty-rect tracking, typical editor operations (brush stroke, selection, cursor) redraw only 1-100 cells per frame, not 10K.

---

## 6. Recommended Architecture for XP Editor

```
FontAtlas
  - load(pngUrl)           // Load any REXPaint-compatible font PNG
  - glyphW, glyphH         // Auto-detected from image/16
  - getTinted(color)       // Returns cached colored atlas canvas
  - clearCache()           // Called on font swap

XPDocument
  - layers[]               // Array of { cells[][] } where cell = {glyph, fg, bg}
  - width, height          // Grid dimensions
  - activeLayer            // Current editing layer

XPRenderer
  - canvas                 // Main visible canvas
  - fontAtlas              // Current FontAtlas
  - dirtySet               // Cells needing redraw
  - renderLayer(layer)     // Draw one layer
  - renderAll()            // Full redraw (font change, scroll, etc.)
  - renderDirty()          // Incremental redraw

XPEditor (orchestrator)
  - document               // XPDocument
  - renderer               // XPRenderer
  - tools                  // Brush, fill, pick, select, etc.
  - onFontChange(url)      // Swap font, full redraw
```

### Font Swap Flow:
1. User selects new font from dropdown.
2. `fontAtlas.load(newUrl)` -- loads PNG, auto-detects glyph size.
3. Resize canvas: `canvas.width = doc.width * fontAtlas.glyphW`.
4. `renderer.renderAll()` -- full redraw with new font.
5. Color cache rebuilds lazily (first draw of each color creates its tinted atlas).

---

## 7. Key References and Sources

### Primary Implementation References
- **rex-viewer**: https://github.com/jjclark1982/rex-viewer -- closest to what we need
- **Geoff Blair bitmap font tinting**: https://www.geoffblair.com/blog/coloring-bitmap-fonts-html5-canvas/
- **canvas-bitmap-fonts code**: https://github.com/geoffb/canvas-bitmap-fonts
- **pcface**: https://github.com/susam/pcface -- pixel-perfect CP437 bitmap arrays
- **rot.js tile backend**: https://github.com/ondras/rot.js -- mature tile/glyph caching

### WebGL References (if needed later)
- **fastiles**: https://github.com/ondras/fastiles -- WebGL 2, single draw call
- **gw-canvas**: https://github.com/funnisimo/gw-canvas -- WebGL, forked from fastiles concepts

### REXPaint Resources
- **REXPaint manual**: https://www.gridsagegames.com/rexpaint/resources.html
- **REXPaint downloads**: https://www.gridsagegames.com/rexpaint/downloads.html

### .xp File Parsers (no rendering)
- **rexpaintjs**: https://www.npmjs.com/package/rexpaintjs
- **rexpaintjs-fork**: https://github.com/adri326/rexpaintjs-fork
