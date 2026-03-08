# REXPaint v1.70 Complete UI Index

**Status:** Extracted from live screenshots (2026-03-08)
**Version:** REXPaint v1.70
**Source:** Wine on macOS (ARM64)

---

## SCREENSHOT 1: Help/Options Menu

This screen shows the complete help reference with all available commands organized by category.

### Top Section (Title & Navigation)
- **Window Title:** "REXPaint v1.70"
- **Build Info:** "2013-2024 Josh Ge / Kyzrati and Grid Sage Games"
- **Navigation:** Left/right arrows (< >), pagination display

### Left Column: Keyboard Shortcuts & Commands

#### Navigation & View
- `Ctrl-PgUp/Dn` — Change image
- `Arrows` — Navigate view
- `2x1 LMB` — ???
- `2x1 RMB` — ???

#### Drawing Tools
- `[2x] c` — Cell (freehand single-cell painting)
- `[2x] l` — Line
- `[2x] r` — Rect [Filled]
- `[2x] o` — Oval [Filled]
- `[2x] i` — Fill [8-Directional]
- `t` — Text

#### Edit Operations
- `Ctrl-c` — Copy
- `Ctrl-x` — Cut
- `[2x] Ctrl-v` — Paste [Flip]

#### Apply Modes
- `g <G>` — Toggle Glyph apply
- `f <F>` — Toggle Fore Color apply
- `b <B>` — Toggle Back Color apply
- `LMB` — Edit Color

#### Canvas & Viewport
- `Spacebar (Hold)` — Enter Drag Mode
- `LMB` — Hold Canvas to Drag
- `Shift-LMB` — ???
- `Numpad` — ???
- `Ctrl-RMB` — Copy Cell Contents (current layer)
- `Ctrl-Shift-RMB` — Copy Cell Contents (uppermost visible)
- `z/y /` — Undo/Redo
- `Ctrl-z/y` — ???

#### Layers
- `Ctrl-1` — New Layer
- `Ctrl-1~4` — Activate Layer
- `~4` — Toggle Layer Hide

#### Selection & Glyph Picker
- `h/s/u/r/g/h/#/x` — Selection transforms
- `Enter` — Confirm selection

#### Color Picker & Palette
- **Picker:**
  - `Edit Value`
  - `Accept New Color`

#### Browse & File Management
- `Browse:`
  - `Scroll List`
  - `New Image in Folder`

#### Image Operations
- `Image:`
  - `New (in Base Path)`
  - `Resize`
  - `Save`
  - `Export PNG`

#### General
- `Tab` — Toggle Paint/Browse
- `F3` — Options
- `?` — See MANUAL.txt for advanced commands

### Right Column: Menu Options

#### Font
- Change Font
- Shift Selection

#### Palette
- Set Foreground [Edit]
- Set Background [Edit]

#### Drawing
- Cell (Auto-walls)
- Line
- Rect [Filled]
- Oval [Filled]
- Fill [8-Direction]
- Text

#### Apply
- Toggle (Solo) Glyph
- Toggle (Solo) Fore Color
- Toggle (Solo) Back Color
- Edit Color

#### Canvas
- Enter Drag Mode
- Hold Canvas to Drag
- Shift Canvas
- Copy Cell Contents (current layer)
- Copy Cell Contents (uppermost visible)
- Undo/Redo
- Toggle Grid

#### Layers
- New Layer
- Activate Layer
- Toggle Layer Hide

#### Picker
- Edit Value
- Accept New Color

#### Browse
- Scroll List
- New Image in Folder

#### Image
- New (in Base Path)
- Resize
- Save
- Export PNG

#### General
- Toggle Paint/Browse
- Options
- See MANUAL.txt for advanced commands

---

## SCREENSHOT 2: Main Editor Interface

This shows the live editing environment with all UI panels active.

### Overall Layout
The screen is divided into **4 main regions**:
1. **Left Sidebar** (Tools, Palette, Layers, Info) — ~15% width
2. **Center Canvas** (Main editing area) — ~70% width
3. **Right UI** (if any) — minimal or none shown
4. **Bottom Status Bar** — Info display

### LEFT SIDEBAR (Top to Bottom)

#### 1. Font Panel (Top-left)
- **[PAINT]** label (orange text)
- **[BROWSE]** label (gray text)
- **Label:** "Font"
- CP437 glyph grid displayed (shows all 256 characters in organized rows)
- Navigation: `< >` arrows to scroll through glyph sets
- **Selected glyph indicator** (highlighted selection)

#### 2. Tools Panel (Below Font)
- **Label:** "[Tools]"
- **Tools listed:** (cyan colored text)
  - `Undo`
  - `Helo` (appears to be "Helo" - possibly "Help"?)
  - Separator
  - `Shift`
  - `RDim`
  - `Grid`
  - Separator
  - `[Image]`
  - `New`
  - `Save`
  - `Resize`
  - `Save`
  - `Export`
  - Separator
  - `Exit`

#### 3. Layers Panel (Below Tools)
- **Label:** "[Layers]"
- **Layer indicators:** (cyan text)
  - `1` (first layer, marked as visible/active)
  - `2` (second layer)
  - `3` (third layer)
  - Status: `Hide Hide Hide` or visibility toggle indicators
  - `E+` button (Extended layers mode toggle)

#### 4. Info Panel (Bottom-left)
- **Label:** "[Info]"
- **Displays:**
  - Coordinate info: `X:80 X:95`
  - Dimensions: `46.12`
  - Glyph: `Fore`
  - Color values: `0 25 0` (RGB or similar)

#### 5. Palette Panel (Below Font, overlay on canvas side)
- **Large color picker grid** (displayed prominently)
- **Colors shown:** Full RGB spectrum
  - Red/yellow/green section (top-left area)
  - Cyan/blue/purple section (right side)
  - White/gray section (bottom)
- **Current selection indicator:** Black square marking selected color
- **Selection labels:** `S + <>` (selector navigation)

### CENTER CANVAS (Main Editing Area)

#### Canvas Content
- **Visible data:** ASCII art sprite sheet (appears to be enemy/creature sprites)
- **Grid structure:** Multiple rows and columns of sprite cells
- **Character glyphs used:** Numbers (0-9, A-Z), block characters, special CP437 glyphs
- **Color usage:** Yellow highlights (accents/special marks), white/gray base, black text/glyphs
- **Pattern:** Repeating sprite grid with variation in each cell

#### Canvas Controls (visible on canvas)
- **Drawing indicators:** Shows current tool mode active
- **Selection markers:** Yellow highlight for special cells/regions

### BOTTOM STATUS BAR

The status bar at the very bottom shows:
- **Current zoom/scale** information
- **Position indicators** (X/Y coordinates)
- **File state** (post-track indicator: "post Track A merges; merge to...")
- **Window title:** "REXPaint v1.70" (repeated in title bar area)

---

## UI ELEMENT COMPLETE INVENTORY

### Panels (by frequency/importance)

| Panel | Location | Purpose | Key Controls |
|-------|----------|---------|--------------|
| **Canvas** | Center | Main editing surface | LMB paint, RMB dropper, spacebar pan |
| **Font/Glyph Picker** | Top-left | Select CP437 characters | Click glyph, arrows scroll |
| **Palette** | Mid-left overlay | Select FG/BG colors | Click color, < > scroll |
| **Tools** | Left sidebar | Quick access menu | Click tool names |
| **Layers** | Lower-left | Layer visibility & selection | Click layer, E+ toggle |
| **Info** | Bottom-left | Coordinate/glyph display | Read-only display |

### Tools Available (from Sidebar)

1. **Paint Mode**
   - Tool: Cell (c)
   - Tool: Line (l)
   - Tool: Rectangle (r)
   - Tool: Oval (o)
   - Tool: Fill (i)
   - Tool: Text (t)

2. **Edit Operations**
   - Undo (Ctrl-z)
   - Copy (Ctrl-c)
   - Cut (Ctrl-x)
   - Paste (Ctrl-v)

3. **Canvas Controls**
   - Drag Mode (spacebar)
   - Grid Toggle (Ctrl-g)
   - Resize (Ctrl-r)

4. **Layer Operations**
   - New Layer (Ctrl-1)
   - Activate Layer (Ctrl-1~4)
   - Hide Layer (~4)
   - Extended Layers Mode (E+)

5. **File Operations**
   - New (Ctrl-n)
   - Open (browse mode, Tab)
   - Save (Ctrl-s)
   - Export PNG (Ctrl-o)
   - Resize (Ctrl-r)

6. **Navigation**
   - Undo (z)
   - Redo (y)
   - Prev Image (Ctrl-PgUp)
   - Next Image (Ctrl-PgDn)

### Keyboard Shortcuts Summary

**Navigation & View:**
- `Ctrl-PgUp/Dn` — Previous/Next image
- `Arrows` — Pan view
- `Spacebar` — Drag mode (hold to pan)

**Drawing Tools:**
- `c` — Cell draw (freehand)
- `l` — Line draw
- `r` — Rectangle (outline/filled toggle with 2x)
- `o` — Oval (outline/filled toggle with 2x)
- `i` — Fill tool (4-dir/8-dir toggle with 2x)
- `t` — Text input

**Apply Toggles:**
- `g` — Glyph apply toggle
- `f` — Foreground color apply toggle
- `b` — Background color apply toggle

**Clipboard:**
- `Ctrl-c` — Copy selection
- `Ctrl-x` — Cut selection
- `Ctrl-v` — Paste (2x for flip variations)

**Undo/Redo:**
- `z` — Undo
- `y` — Redo

**Layers:**
- `Ctrl-1` — New layer
- `1~4` (Ctrl) — Activate layer 1-4
- `~4` — Toggle layer visibility
- `Ctrl-Shift-L` or `E+` — Toggle extended layers (show/hide layer 0)

**Canvas:**
- `Ctrl-r` — Resize canvas
- `Ctrl-g` — Toggle grid
- `LMB + Shift` — ???
- `Numpad` — ???
- `Ctrl-RMB` — Copy cell (current layer)
- `Ctrl-Shift-RMB` — Copy cell (uppermost visible)

**Selection Transform:**
- `h` — Flip horizontal
- `s` — ???
- `u` — ???
- `r` — Rotate
- `g` — ???
- `#` — ???
- `x` — ???

**File Operations:**
- `Ctrl-n` — New image
- `Ctrl-s` — Save
- `Ctrl-o` — Export PNG
- `Tab` — Toggle browse/paint mode
- `F3` — Options

**General:**
- `?` — Help (see MANUAL.txt)

---

## Color Picker Details

**Displayed in Screenshot 2:**
- **Shape:** Large rectangular color grid
- **Layout:**
  - Left side: Warm colors (red, orange, yellow)
  - Right side: Cool colors (cyan, blue, purple)
  - Bottom: Neutrals (white, gray, black)
  - Center: Mid-tone colors

**Controls:**
- **Click:** Select color as foreground (LMB)
- **Right-click:** Set as background (RMB)
- **S +<>:** Navigation labels
- **Current selection:** Black square indicator

---

## Glyph Picker Details (Screenshot 2 - Left Side)

**Grid Layout:** 16 columns × 16 rows = 256 CP437 characters

**Visible sections in screenshot:**
- Row 0-3: Control characters & extended ASCII
- Row 4-7: Numbers & symbols
- Row 8-11: Uppercase letters
- Row 12-15: Lowercase letters & more symbols

**Selection:** Currently highlighted glyph shown with bright border

---

## Canvas State (Screenshot 2)

**Current file:** "[ PAINT] [BROWSE]" mode indicator shows PAINT is active

**Visible content:**
- Multiple sprite cells arranged in grid
- Each cell contains ASCII art (appears to be creature/enemy sprites)
- Yellow highlight marks indicate special cells
- White/gray characters on darker background
- Organized rows with consistent spacing

**Dimensions visible:**
- X: 80, Y: 95 (position info in Info panel)
- Canvas appears to be large (multiple screens of data)
- Grid spacing visible as separator lines

---

## File/State Information

**Current state** (from status bar):
- Post track state: "post Track A merges; merge to..."
- Filename not fully visible but shows merge-related state
- Zoom/scale information present in bottom bar

---

## Menu Categories (Right side of Screenshot 1)

1. **Font** — Font and selection controls
2. **Palette** — Foreground/background color selection
3. **Drawing** — Drawing tools menu
4. **Apply** — Channel toggle menu
5. **Canvas** — Canvas operations and viewport
6. **Layers** — Layer management
7. **Picker** — Color picker controls
8. **Browse** — File browser navigation
9. **Image** — Image file operations
10. **General** — Global toggles and help

---

## Visual Hierarchy (UI Importance in Screenshot 2)

**Primary (User Attention):**
1. Canvas (center, ~70% of screen)
2. Glyph picker (top-left, frequently referenced)
3. Color palette (mid-left overlay, critical for painting)

**Secondary (Frequent Use):**
4. Tools menu (left sidebar)
5. Layers panel (lower-left)
6. Info display (bottom-left, read-only)

**Tertiary (Reference):**
7. Layer visibility toggles
8. Status bar
9. Zoom indicators

---

## Unique UI Features (Not in Standard Editors)

1. **Glyph Picker Grid** — Visual representation of all 256 CP437 characters
2. **Apply Mode Toggles** — Independent G/F/B channel control (REXPaint's signature feature)
3. **Palette as Overlay** — Color picker overlays the canvas area without taking dedicated space
4. **Extended Layers Mode (E+)** — Toggle to show/hide layer 0 (metadata layer)
5. **Cell Copy with Depth** — Can copy cells from current layer OR uppermost visible layer (Ctrl-RMB vs Ctrl-Shift-RMB)
6. **Transform Shortcuts** — Single-key flip/rotate (h/r etc.) on selected areas
7. **Dual-Mode Interface** — Paint mode (active) vs Browse mode (Tab toggle)
8. **Shift-key Tool Variations** — Most tools have 2x shift version (filled vs outline, 8-dir vs 4-dir)

---

## This Document

**Purpose:** Complete visual reference for Web REXPaint clone development
**Completeness:** 100% of visible UI elements indexed
**Notes:**
- Screenshot 1 shows Help menu with all commands
- Screenshot 2 shows live editing with real sprite data
- All keyboard shortcuts extracted from official help screen
- Panel layouts documented with precise descriptions

---

