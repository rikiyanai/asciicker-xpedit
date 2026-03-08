# Web REXPaint XP Editor — Complete Feature Inventory

**Status:** Ground truth for Phase 1-8 implementation
**Last Updated:** 2026-03-08
**Total Features:** 40 (16 Tier 1 + 16 Tier 2 + 8 Tier 3)
**Target Implementation:** Phases 1-8 (Tier 1 by Phase 2, Tier 2 by Phase 6, Tier 3 by Phase 8)

---

## TIER 1: CRITICAL FEATURES (16 items)

These features form the minimal viable editor. Implementation targets Phase 1 discovery and Phase 2 MVP.

| # | Feature Name | Status | Shortcut | REXPaint Ref | Description | Test Method |
|---|---|---|---|---|---|---|
| 1 | Cell Draw (Freehand) | [ ] | `c` (2x = auto-walls) | Drawing > Draw Modes > Cell | Single-cell painting with cursor; alternate mode auto-draws walls | Click cell repeatedly, verify glyph/color applies; press c twice to toggle auto-walls |
| 2 | Glyph Selection | [ ] | Click picker grid | Fonts > Glyphs | Visual 16×16 CP437 glyph picker; right-click to pick from canvas | Click 10 different glyphs in picker, verify selection highlight; right-click canvas cell, verify dropper |
| 3 | Foreground Color Selection | [ ] | LMB on palette | Palettes > Selection & Editing | Left-click palette swatch to set foreground color | Click 5 palette colors, verify FG swatch updates; double-click to open picker |
| 4 | Background Color Selection | [ ] | RMB on palette | Palettes > Selection & Editing | Right-click palette swatch to set background color | Right-click 5 palette colors, verify BG swatch updates |
| 5 | Color Picker (HSV/RGB) | [ ] | Double-click palette swatch | Palettes > Color Picker | True-color RGB/HSV picker with numeric value entry | Edit R/G/B values numerically, verify color updates; switch to HSV mode |
| 6 | Apply Mode Toggles | [ ] | `g` / `f` / `b` | Drawing > Apply | Independent channel control: Glyph / Foreground / Background | Press g/f/b individually, verify apply buttons toggle; draw with only glyph on |
| 7 | Undo | [ ] | `z` or `Ctrl-z` | Drawing > Undo | Undo last action; maintains per-layer history | Make 5 changes, press z five times, verify all reverted |
| 8 | Redo | [ ] | `y` or `Ctrl-y` | Drawing > Undo | Redo last undone action | Undo 3 times, press y three times, verify reapplied |
| 9 | Layer Visibility Toggle | [ ] | `Ctrl-1~4` | Layers > Visibility & Locking | Toggle individual layer visibility without affecting editing | Toggle layer 1, 2, 3 visibility, verify canvas updates; locked layers stay editable even when hidden |
| 10 | Layer Selection | [ ] | `1~4` or mouse wheel | Layers > Active Layer | Activate layer for editing; mouse wheel cycles layers | Press 1/2/3, draw on each, verify drawing goes to active layer only |
| 11 | Line Draw | [ ] | `l` | Drawing > Draw Modes > Line | Draw straight line from start to end point | Drag line diagonally, press ESC to cancel mid-draw, verify preview works |
| 12 | Rectangle Draw | [ ] | `r` (2x = filled) | Drawing > Draw Modes > Rect | Draw rectangle outline or filled; alternate mode toggles fill | Draw outline rect, press r again, draw filled rect; ESC to cancel |
| 13 | Copy/Paste/Cut | [ ] | `Ctrl-c` / `Ctrl-v` / `Ctrl-x` | Drawing > Draw Modes > Copy/Paste | Rectangular selection copy/cut/paste with flip variants | Copy 3×3 area, paste 3 times, flip horizontally on paste, verify transforms |
| 14 | Text Tool | [ ] | `t` | Drawing > Draw Modes > Text Input | Type text directly onto canvas with current colors | Type 'HELLO', press Enter, type new line, press ESC to cancel, verify placement |
| 15 | Grid Toggle | [ ] | `Ctrl-g` | Canvas > Canvas controls | Toggle grid overlay on/off for alignment | Press Ctrl-g, verify grid appears/disappears; toggle 3 times |
| 16 | Canvas Pan | [ ] | Spacebar + drag | Canvas > Shifting | Drag canvas to view different regions (Photoshop-style) | Hold spacebar, drag canvas around, verify scrolling works |

---

## TIER 2: HIGH-PRIORITY FEATURES (16 items)

These features unlock significant workflow efficiency and shape versatility. Implementation targets Phases 3-6.

| # | Feature Name | Status | Shortcut | REXPaint Ref | Description | Test Method |
|---|---|---|---|---|---|---|
| 17 | Oval Draw | [ ] | `o` (2x = filled) | Drawing > Draw Modes > Oval | Draw oval outline or filled; Alt-o toggles center/corner mode | Draw outline oval, press o, draw filled; toggle Alt-o |
| 18 | Fill Tool | [ ] | `i` (2x = 8-direction) | Drawing > Draw Modes > Fill | Flood-fill connected cells; alternate mode uses 8-direction connectivity | Fill 4-connected area, press i, fill with 8-connected, verify difference |
| 19 | Swap FG/BG Colors | [ ] | `Alt-w` | Drawing > Apply | Quickly swap foreground and background colors | Set FG=red, BG=blue, press Alt-w, verify swapped |
| 20 | Used Glyph Highlighting | [ ] | `u` | Fonts > Glyphs | Highlight all glyphs currently used in image | Press u, verify used glyphs have visual indicator; press u again to toggle |
| 21 | Glyph Swap | [ ] | `Shift-LMB` (2x on glyphs) | Fonts > Glyph Swapping | Replace all occurrences of glyph A with glyph B across visible layers | Shift-click 'A' glyph, Shift-click 'B' glyph, verify all A→B swapped |
| 22 | Color Swap | [ ] | `Shift-LMB` (2x on palette colors) | Palettes > Selection & Editing | Replace all occurrences of color 1 with color 2 across visible layers | Shift-click two colors, verify all instances swapped |
| 23 | Selection Transform: Flip Horizontal | [ ] | `h` (on selected area) | Drawing > Clipboard operations | Mirror selected rectangle horizontally | Select area with asymmetric pattern, press h, verify mirrored |
| 24 | Selection Transform: Rotate | [ ] | `r` (on selected area) | Drawing > Clipboard operations | Rotate selected rectangle 90 degrees | Select rectangular area, press r, verify rotated |
| 25 | Layer Locking | [ ] | `Shift-1~4` | Layers > Visibility & Locking | Lock/unlock layer to prevent accidental editing | Lock layer 1, attempt to paint on it, verify no changes; unlock and retry |
| 26 | Merge Layer | [ ] | `Ctrl-Shift-m` | Layers > Merging | Merge active layer down into layer below | Create 2 layers with content, merge layer 2 into layer 1, verify combined |
| 27 | New Layer | [ ] | `Ctrl-l` | Layers > Control | Create new transparent layer (max 9 layers) | Create 3 new layers, verify layer count increases; verify new layer transparent |
| 28 | Canvas Resize | [ ] | `Ctrl-r` | Canvas > Resizing | Resize canvas dimensions; content repositioned from top-left | Draw content, resize larger, verify content preserved; resize smaller, verify clipped |
| 29 | Palette File Management | [ ] | `+/-` buttons or `[/]` | Palettes > Palette Files | Create, load, save multiple palette files | Create new palette, add colors, switch palettes, verify persistence |
| 30 | Extract Palette from Image | [ ] | `Ctrl-Shift-e` | Palettes > Extraction | Automatically extract all colors used in current image into palette | Paint with 5 colors, extract palette, verify all colors present |
| 31 | Purge Unused Colors | [ ] | `Ctrl-Shift-p` | Palettes > Organization | Remove unused colors from palette | Load palette with 50 colors, use 10, purge, verify 10 remain |
| 32 | Brush Preview on Hover | [ ] | Hover over canvas | Drawing > Preview | Show preview of what will be drawn without committing (cell/fill/paste) | Hover cell tool over canvas, see shadow preview; hover fill over area, see preview |

---

## TIER 3: DEFERRED FEATURES (8 items)

Advanced or less-frequently-used features. Implementation targets Phases 7-8 or post-MVP.

| # | Feature Name | Status | Shortcut | REXPaint Ref | Description | Test Method |
|---|---|---|---|---|---|---|
| 33 | Paste Flip Variants | [ ] | `Ctrl-v` (multiple presses) | Drawing > Draw Modes > Paste (Flip) | Paste with horizontal flip, vertical flip, or both flips | Copy area, press Ctrl-v 4 times to cycle through 4 flip variants |
| 34 | Organize Palette | [ ] | `Ctrl-Shift-o` | Palettes > Organization | Reorder palette colors via drag-and-drop | Drag palette colors to reorder, verify order persists |
| 35 | Palette Transparency | [ ] | RGB(255,0,255) hot pink | Palettes > Transparency | Special color (255,0,255 hot pink) renders as transparent | Paint with hot pink, verify transparent cells on export |
| 36 | Extended Layers Mode | [ ] | `Ctrl-Shift-l` or `E+` button | Layers > Extended Layers Mode | Toggle visibility of layer 0 (metadata layer) for advanced XP manipulation | Toggle E+ button, verify layer 0 appears/disappears in layer list |
| 37 | Custom Font Loading | [ ] | `Ctrl-PgUp/Dn` or `</>` | Fonts > Custom and Extended Fonts | Change active font; affects rendering zoom without resizing image | Press `<` to load smaller font, `>` to load larger, verify zoom changes |
| 38 | Copy Cell from Uppermost Layer | [ ] | `Ctrl-Shift-RMB` | Canvas > Canvas controls | Dropper that copies cell from topmost visible layer, not current layer | Select layer 2 (not topmost), Ctrl-Shift-RMB on layer 1 cell, verify layer 1 data copied |
| 39 | Dimension Display Toggle | [ ] | `Ctrl-d` | Canvas > Canvas controls | Toggle on-canvas dimension labels for selection boxes | Press Ctrl-d, draw rect, verify dimensions shown; press again to hide |
| 40 | Options & Customization | [ ] | `F3` | Customization > Options | Open options menu for UI/rendering tweaks (not core editing feature) | Press F3, verify options dialog opens (basic dialog presence only) |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Discovery & Architecture
- Survey existing editors (web-based and native)
- Design canvas rendering pipeline (CP437 glyphs, coloring)
- Plan keyboard shortcut dispatch system
- Define test framework strategy

### Phase 2: MVP (Tier 1 Complete)
- **Tier 1 features:** All 16 critical features
- Basic canvas (no zoom yet)
- Simple toolbar
- Layer panel (show/hide, select)
- Palette (12 fixed swatches initially)
- Undo/redo stack

### Phase 3: Shape Tools
- Line draw (with preview)
- Rectangle draw (outline + filled)
- Oval draw (outline + filled)
- Fill tool (4-direction + 8-direction)

### Phase 4: Advanced Selection
- Copy/cut/paste with clipboard
- Selection transforms (flip H, rotate)
- Brush preview on hover

### Phase 5: Palette System
- Multiple palette files (load/save)
- Extract palette from image
- Purge unused colors
- Color swap (global)
- Glyph swap (global)

### Phase 6: Multi-Layer Support (Tier 2 Complete)
- New layer creation
- Layer locking (prevent accidental edit)
- Merge layer downward
- Extended visibility controls
- Canvas resize

### Phase 7: Advanced Features (Early Tier 3)
- Paste flip variants (H, V, HV)
- Custom font loading
- Dimension display toggle

### Phase 8: Polish & Deferred (Late Tier 3)
- Palette organization (drag-reorder)
- Transparency handling (hot pink)
- Extended layers mode (metadata layer 0)
- Options & customization dialog

---

## CANVAS RENDERING REQUIREMENTS

| Requirement | Details | Priority |
|---|---|---|
| **Glyph Set** | Full 256 CP437 (0x00-0xFF) bitmap font | Phase 1 |
| **Grid Rendering** | Column-major cell layout with FG/BG colors | Phase 1 |
| **Zoom Levels** | 4x-28x magnification (font size scaling) | Phase 3 |
| **Pan Support** | Spacebar+drag for large canvases | Phase 2 |
| **Grid Overlay** | Optional visualization grid (Ctrl-g toggle) | Phase 2 |
| **Checkerboard** | Transparency indication (hot pink 255,0,255) | Phase 5 |
| **Selection Highlight** | Marching ants or clear selection border | Phase 2 |

---

## KEYBOARD SHORTCUT DISPATCH SYSTEM

The editor must support:

1. **Single-key shortcuts** (no modifier): `c`, `l`, `r`, `o`, `i`, `t`, `z`, `y`, `u`
2. **Ctrl+key shortcuts**: `Ctrl-c`, `Ctrl-x`, `Ctrl-v`, `Ctrl-z`, `Ctrl-y`, `Ctrl-l`, `Ctrl-r`, `Ctrl-g`, `Ctrl-d`
3. **Ctrl+Shift+key**: `Ctrl-Shift-m`, `Ctrl-Shift-o`, `Ctrl-Shift-e`, `Ctrl-Shift-p`, `Ctrl-Shift-l`
4. **Alt+key**: `Alt-w`, `Alt-o`
5. **Shift+key**: `Shift-LMB` (glyph/color swap)
6. **Numeric**: `1~4` (layer selection), `~4` (layer visibility toggle)
7. **Function keys**: `F3` (options)

Implementation strategy: Global keyboard listener with event.preventDefault() for all REXPaint shortcuts to prevent browser defaults (e.g., Ctrl-S for save dialog).

---

## TESTING STRATEGY (Placeholder for Phase 4)

### Unit Tests
- Cell coordinate math
- Color conversion (RGB ↔ HSV)
- Layer operations (create, visibility, lock)
- Clipboard operations

### Integration Tests
- Tool chain: select glyph → set color → draw → undo
- Layer workflow: create layer → draw → lock → switch layer
- Canvas pan & zoom with selection
- Keyboard shortcut dispatch

### E2E Tests (Playwright)
- Full sprite editing workflow
- Save/load round-trip
- Multi-action bundle mode (if applicable)

---

## DEPENDENCIES & INFRASTRUCTURE

### Build Tools
- **Vanilla JS target:** No npm/build step required for Phase 1-2
- **Canvas rendering:** HTML5 `<canvas>` with 2D context
- **Color input:** HTML5 `<input type="color">` for quick pick (Phase 1)
- **File I/O:** Workbench API for XP load/save

### Testing
- **Playwright:** Already in `/scripts/ui_tests/package.json` (v1.58.2)
- **Vitest:** Not yet in package.json (consider for Phase 4 unit tests)
- **Node.js:** Existing test infrastructure in `/tests/`

### External Libraries
- **None preferred** — vanilla JS target (canvas, keyboard events, DOM manipulation)
- **Rationale:** Minimize bundle size, reduce complexity, enable fine-grained control over rendering

---

## BUNDLE MODE INTEGRATION POINTS

When deployed as full-page XP editor within workbench:

1. **Per-action persistence:** Each action (idle/attack/death) maintains separate undo/redo
2. **Metadata layer (L0):** Read-only layer 0 contains XP format metadata (angles, frame counts)
3. **Layer lock enforcement:** Layers 0-1 always locked (metadata + height encoding)
4. **Dimension gating:** Canvas can only be resized to template-specified dimensions (e.g., 126×80 for idle)

---

## SUCCESS CRITERIA (MVP: Phase 2)

- [ ] Can load XP file into canvas
- [ ] Can paint single cells with glyph + FG + BG
- [ ] Can switch between layers and see updates
- [ ] Can toggle layer visibility
- [ ] Undo/redo works for all operations
- [ ] Keyboard shortcuts dispatch correctly
- [ ] Glyph picker shows all 256 glyphs
- [ ] Color picker allows RGB/HSV entry
- [ ] Palette has 12+ default colors
- [ ] Canvas renders at 1:1 cell size (no zoom)
- [ ] Can save XP file back to disk
- [ ] Runs in browser without build step

---

## SUCCESS CRITERIA (Full: Tiers 1-3)

- [ ] All 40 features implemented and tested
- [ ] Tier 1 + Tier 2 + partial Tier 3 (stretch goal)
- [ ] 80%+ test coverage (unit + integration)
- [ ] Performance: 60fps canvas rendering at 4x zoom
- [ ] Accessibility: Keyboard-only workflow possible
- [ ] Browser compatibility: Chrome, Firefox, Safari (recent versions)
- [ ] Bundle mode: Full integration with workbench UI and override export

---

**Document Version:** 1.0
**Author:** Claude Code (Research Agent)
**Audience:** Implementation team (Phase 1-8 developer)
**Review Date:** TBD (after Phase 1 discovery complete)
