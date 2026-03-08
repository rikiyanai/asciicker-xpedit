# REXPaint v1.70 vs Pipeline V2 Workbench — Feature Comparison Matrix

**Date:** 2026-03-04
**REXPaint source:** Manual v1.70 (local + online)
**Workbench source:** `web/workbench.js` (6669 lines) + `web/workbench.html`

---

## Context

REXPaint is a general-purpose desktop ASCII art editor (Windows/Wine). The Pipeline V2 Workbench is a browser-based tool for converting PNG sprite sheets into XP-format sprite atlases for the Asciicker game engine. They serve fundamentally different purposes, which explains many of the gaps.

---

## Feature Comparison Matrix

### 1. Drawing Tools

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Cell draw (single cell, freehand) | PARTIAL | "Paint" tool does half-cell color painting; "Glyph" tool stamps full cells. No freehand line-drawing mode. |
| Line draw tool | NO | No line-drawing primitive. |
| Rectangle draw tool (outline + filled) | NO | No rectangle drawing shape. Source panel has "Draw Box" for sprite extraction, not art drawing. |
| Oval draw tool (outline + filled) | NO | Not implemented. |
| Flood fill tool | NO | Not implemented. |
| Text input tool | NO | No text-input drawing mode. |
| Auto-wall / auto-box drawing | NO | Not implemented. |
| Preview on hover (before committing) | NO | No draw-preview. Inspector shows hover readout (glyph/fg/bg info) but not a visual preview of what would be drawn. |
| Apply modes (toggle glyph/fg/bg independently) | PARTIAL | Glyph tool applies glyph+fg+bg as a unit. Paint/Erase tools work on half-cell colors only. No independent channel toggles. |

### 2. Selection & Clipboard

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Copy rectangular area | YES | Inspector has Copy Sel (cell-level selection within a frame). |
| Cut rectangular area | YES | Inspector has Cut Sel. |
| Paste clipboard | YES | Inspector has Paste Sel with anchor positioning. |
| Flip clipboard (H/V/both) | PARTIAL | Flip Sel H, Flip Sel V exist. Flip Frame H exists. No combined H+V flip. |
| Copy/paste between images | NO | Clipboard is local to the session/frame. No cross-image clipboard. |
| Multi-layer copy depth ('d' key) | NO | Not implemented. |

### 3. Undo/Redo

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Undo (Ctrl-Z) | YES | Full undo with session state snapshots. |
| Redo (Ctrl-Y) | YES | Full redo. |
| Per-image undo histories | YES | History is per-session. |

### 4. Colors & Palette

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| True-color RGB color picker | PARTIAL | Uses native HTML `<input type="color">` for FG, BG, and half-cell paint color. No custom picker UI. |
| HSV color picker | NO | Browser color input provides HSV internally, but no explicit HSV number entry. |
| Palette files (multiple, switchable) | NO | Fixed swatch strip of ~16 hardcoded colors (`INSPECTOR_SWATCHES`). No loadable palettes. |
| Palette organization / sorting | NO | Not implemented. |
| Palette extraction from image | NO | Not implemented. |
| Palette swapping (global color replace) | PARTIAL | "Replace FG" and "Replace BG" buttons replace colors within selection/frame using a "match source" cell. Find & Replace panel with glyph+fg+bg criteria. But no image-wide palette swap. |
| Color swap (foreground/background) | NO | No Alt-W equivalent to swap fg/bg. |
| Transparency (hot pink 255,0,255) | YES | `MAGENTA = [255,0,255]` used as transparency key. "BG = Transparent" button. |
| Right-click color eyedropper | YES | "Dropper" tool samples glyph + half-cell color. |

### 5. Fonts & Glyphs

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| CP437 glyph set (256 characters) | YES | Glyph codes 0-255 supported. Half-cell rendering for 219/220/223. |
| Visual glyph selection grid | NO | Glyph selected by numeric code input or character input. No clickable glyph grid. |
| Font switching (multiple sizes) | NO | No font changing. Rendering is pixel-based canvas, not font-based. |
| Custom / extended fonts | NO | Not applicable — workbench renders via half-cell color blocks. |
| Glyph swapping (global replace) | PARTIAL | Find & Replace panel supports glyph matching+replacement, but only within selection/frame scope. |
| Used glyph highlighting | NO | Not implemented. |
| Unicode codepoint mapping | NO | Not applicable. |

### 6. Layers

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Multiple layers (up to 9) | PARTIAL | Supports 3-4 layers (Metadata L0, Height L1, Visual L2, Swoosh L3). Fixed layer structure, not user-creatable. |
| Active layer switching | YES | Layer dropdown selector. |
| Layer visibility toggle | YES | Per-layer visibility checkboxes. |
| Layer locking | NO | Not implemented. Only Visual layer (L2) is editable. |
| Layer reordering | NO | Fixed layer order (engine contract). |
| Layer merging | NO | Not implemented. |
| Extended layers mode (>9) | NO | Fixed at 3-4 layers. |
| Add/remove layers | NO | Layer count determined by pipeline/template. |

### 7. Canvas & Navigation

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Canvas resize (Ctrl-R) | NO | Grid dimensions set by pipeline conversion parameters (angles, frames). No manual resize. |
| Canvas drag/pan (Spacebar) | NO | No pan. Source panel has zoom slider (1x-6x). Grid panel has zoom slider (0.75x-2.5x). |
| Zoom (font size change) | PARTIAL | Zoom sliders for source canvas, grid panel, and inspector (4x-28x). Not font-based. |
| Grid overlay toggle | YES | Inspector has Grid and Checker toggles. |
| Rect dimension display | NO | Not implemented. |

### 8. File Management & Browsing

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Browse mode (Tab) | NO | No image browser. Single-session workflow. |
| Image browser with thumbnails | NO | Not implemented. |
| Create new image | PARTIAL | "Apply Template" creates a new bundle/session. Not a blank canvas. |
| Rename / duplicate / delete images | NO | Not implemented. |
| Reload all image files | NO | Not applicable. |
| Save (Ctrl-S) | YES | Auto-save on edits via `saveSessionState()`. |
| Multiple images in memory | NO | Single active session only. |

### 9. Export Formats

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Native .xp format | YES | Core format. Export XP button with browser download. |
| Export PNG | NO | Input is PNG, output is XP. No PNG export of the art. |
| Export TXT | NO | Not implemented. |
| Export CSV | NO | Not implemented. |
| Export ANS (ANSI art) | NO | Not implemented. |
| Export XML | NO | Not implemented. |
| Export XPM | NO | Not implemented. |
| Export BBCode | NO | Not implemented. |
| Export C:DDA format | NO | Not implemented. |

### 10. Import Formats

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Import .xp files | YES | Load from pipeline job, upload .xp for skin testing. |
| Import .txt files | NO | Not implemented. |
| Import .ans files | NO | Not implemented. |
| Import .png files | YES | Core workflow: PNG upload -> pipeline conversion -> XP. |
| Command-line import/export | NO | API-driven (HTTP endpoints), not CLI. |

### 11. Customization

| REXPaint Feature | Workbench | Notes |
|---|---|---|
| Skinnable interface | NO | Fixed CSS theme. |
| Configurable options (REXPaint.cfg) | PARTIAL | URL query parameters for override mode, flatmap, etc. |
| Custom glyph mirroring tables | NO | Not implemented. |

### 12. Workbench-Only Features (Not in REXPaint)

| Workbench Feature | REXPaint Equivalent |
|---|---|
| PNG-to-XP pipeline conversion | None (REXPaint has basic png2xp CLI) |
| Sprite sheet extraction (Find Sprites) | None |
| Source panel with bbox drawing/selection | None |
| Frame grid layout (angles x frames) | None |
| Animation metadata (angles, anims, projs) | None |
| Animation preview (Play/Stop/FPS) | None |
| Frame jitter alignment (auto-align, nudge) | None |
| Bundle templates (idle/attack/death) | None |
| WASM skin test dock (live game preview) | None |
| TERM++ native game launch | None |
| Structural gate validation (G10-G12) | None |
| Row/column reordering in frame grid | None |
| Half-cell painting (top/bottom halves) | None (REXPaint works at full-cell level) |
| Verification profiles (QA automation) | None |
| Row categories (idle/walk/attack/etc.) | None |
| Frame groups and animation grouping | None |

---

## Summary Statistics

| Category | REXPaint Features | Workbench YES | Workbench PARTIAL | Workbench NO |
|---|---|---|---|---|
| Drawing Tools | 9 | 0 | 2 | 7 |
| Selection & Clipboard | 6 | 3 | 1 | 2 |
| Undo/Redo | 3 | 3 | 0 | 0 |
| Colors & Palette | 9 | 2 | 2 | 5 |
| Fonts & Glyphs | 7 | 1 | 1 | 5 |
| Layers | 8 | 2 | 1 | 5 |
| Canvas & Navigation | 5 | 1 | 1 | 3 |
| File Management | 7 | 1 | 1 | 5 |
| Export Formats | 9 | 1 | 0 | 8 |
| Import Formats | 5 | 2 | 0 | 3 |
| Customization | 3 | 0 | 1 | 2 |
| **TOTAL** | **71** | **16 (23%)** | **10 (14%)** | **45 (63%)** |

---

## Key Gaps (Critical for Art Editing Parity)

1. **No shape drawing tools** — no line, rectangle, oval, or flood fill
2. **No glyph selection grid** — must type glyph codes manually
3. **No palette system** — only fixed color swatches + native color picker
4. **No text input tool** — cannot type text onto the canvas
5. **No HSV color picker** — no precise color value entry
6. **No canvas pan/resize** — grid dimensions locked to pipeline output
7. **No export formats beyond .xp** — no PNG/TXT/CSV/ANS export
8. **No image browser** — single-session, no multi-image management
9. **No layer management** — cannot add, remove, reorder, merge, or lock layers
10. **No freehand line drawing** — paint tool works cell-by-cell

## Key Strengths (Workbench has, REXPaint does not)

1. **PNG-to-XP sprite pipeline** — automated conversion with configurable parameters
2. **Animation system** — frame grid, preview, jitter alignment, metadata
3. **Live game preview** — WASM skin test dock with in-browser game instance
4. **Sprite sheet extraction** — automatic bbox detection from source PNGs
5. **Bundle templates** — multi-action sprite sets (idle/attack/death)
6. **Half-cell painting** — sub-cell color editing using CP437 half-block glyphs
7. **QA verification** — automated skin testing with Playwright

---

## Verdict

The workbench is a **sprite pipeline tool**, not a general ASCII art editor. It covers ~37% of REXPaint's feature set (23% full + 14% partial). The missing 63% consists primarily of drawing primitives, palette management, font handling, and export formats — features that would be needed if the workbench aimed to replace REXPaint as an art editor. However, the workbench has 16+ unique features around sprite conversion, animation, and live game testing that REXPaint completely lacks.

The two tools are complementary: REXPaint for authoring ASCII art, workbench for sprite pipeline conversion and game integration testing.
