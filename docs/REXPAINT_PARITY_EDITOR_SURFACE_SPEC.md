# REXPaint Parity Editor Surface Spec

Date: 2026-03-16
Status: draft tightened with REXPaint UI evidence (screenshots + manual v1.70)

## 1. Scope

This document defines the canonical editor-surface target for milestone work on the XP
editor.

The target is:

- a whole-sheet XP editor
- user-reachable through shipped workbench controls
- behaviorally aligned with the REXPaint editing model where it matters for parity

This document does not describe:

- current implementation status
- test status
- bundle/runtime verification
- legacy frame-inspector behavior except where it constrains migration

## 2. Primary Editing Model

The primary editing surface must be a single whole-sheet canvas representing the full
XP image at once.

Normative requirements:

- the whole-sheet canvas is the primary place where cell edits occur
- the user must not be forced into per-frame modal editing for ordinary work
- frame tiles may remain visible, but only as navigation/preview support
- the legacy frame inspector is transitional only and is not the parity target

The editor must preserve the atlas-wide view of the XP while still exposing frame and
angle structure.

## 3. Primary Layout

The milestone-1 layout must include these regions, ordered to match REXPaint's
left-sidebar-plus-canvas architecture. Evidence: REXPaint screenshots
(`rexpaint_browser.gif`, `rexpaint_shapes.gif`, `rexpaint_palette.gif`,
`rexpaint_layers.gif`, `rexpaint_zoomscale.gif`) and `REXPAINT_MANUAL.txt`.

### 3.1 Mode Toggle (top of sidebar)

- two buttons or tabs: PAINT and BROWSE
- PAINT is the default creative mode; BROWSE is a file manager mode
- in REXPaint these sit at the very top of the sidebar
- milestone 1 minimum: PAINT mode only; BROWSE is deferred
- the toggle region must exist as a placeholder even if BROWSE is not implemented

### 3.2 Font / Glyph Picker (below mode toggle)

- a 16x16 grid displaying all 256 CP437 glyphs from the active font bitmap
- located at the top of the left sidebar, immediately below the mode toggle
- clicking a glyph selects it as the active draw glyph
- the selected glyph must be visually highlighted in the grid
- right-click on a canvas cell should act as eyedropper (select that cell's glyph + colors)
- milestone 1 deferred: scroll/pagination for extended fonts (>256 glyphs), used-glyph
  highlighting (`u` key), Alt-hover glyph location, glyph swap (Shift-LMB)

### 3.3 Palette Panel (below glyph picker)

- a color grid for foreground and background selection
- LMB on a palette color selects it as the foreground color
- RMB on a palette color selects it as the background color
- current foreground and background colors must be displayed as labeled swatches
  (REXPaint labels these `f` and `b` next to the palette grid)
- clicking on the fg or bg color swatch opens the color picker
- milestone 1 minimum: a working color picker (HTML color input is acceptable as
  a stand-in for the full HSV/RGB picker); palette grid display
- milestone 1 deferred: palette files, palette extraction, auto-organize,
  palette swapping, Shift-LMB global replace

### 3.4 Tools / Apply Panel (below palette)

This region is split into two columns in REXPaint:

Left column — **Tools**:
- Undo, Redo
- Grid toggle

Right column — **Apply**:
- `G` (Glyph), `F` (Foreground), `B` (Background) toggles
- active glyph preview (the currently selected glyph character)
- foreground color swatch next to `Fore`
- background color swatch next to `Back`

The Apply toggles control which cell attributes are affected by drawing.
See section 6 for behavioral requirements.

### 3.5 Image / Draw Panel (below Tools/Apply)

This region is split into two columns in REXPaint:

Left column — **Image**:
- New, Resize, Save, Export

Right column — **Draw** (tool selector):
- Cell, Line, Rect, Oval, Fill, Text, Copy, Paste
- the active tool is visually indicated (highlighted or marked)
- some tools have alternate modes (e.g., filled vs outline Rect) shown by a
  secondary indicator next to the tool name

Milestone 1 minimum: Cell, Line, Rect, Fill, Text, Copy, Paste from the Draw
column; New, Save, Export from the Image column. Resize is required for
milestone 1 if frame structure changes need it. See section 4 for tool details.

### 3.6 Layers Panel (bottom of sidebar)

- displays numbered layers (1-9 in REXPaint)
- the active layer is visually indicated
- each layer row shows: layer number, name/label, visibility state
- controls: Hide (toggle visibility), Del (delete layer), + (add layer)
- clicking a layer number activates it for editing
- `Ctrl-1..9` hides/shows layers; `Shift-1..9` locks/unlocks layers in REXPaint
- extended layers mode (`E` key) expands the list to show all 9 layers,
  overlapping the info region below
- milestone 1 minimum: activate, show/hide, add layer, view full stack
- milestone 1 required: lock/unlock per layer
- milestone 1 deferred: merge down, duplicate, reorder, extended mode

### 3.7 Center Editing Surface

- whole-sheet canvas occupying the remaining area to the right of the sidebar
- visible grid overlay option (`Ctrl-g` in REXPaint; user-reachable toggle)
- hover feedback: cursor position, preview of draw effect where practical
- selection overlays for copy/paste/select tool
- pan: `Space + LMB` drag (Photoshop-style) or numpad 8-direction shift
- zoom: `Ctrl+Wheel` or `< / >` to change font/cell display size dynamically
- zoom must not change document structure, only view scale
- `Enter` resets viewport position; `Ctrl-Enter` centers image

### 3.8 Secondary Navigation Region (frame grid)

- frame grid or equivalent atlas navigator showing frame/angle structure
- selecting a frame must focus/navigate the whole-sheet surface to that region
- selecting a frame must not redefine the frame grid as the main editor
- frame tiles may support preview thumbnails, selection highlight, metadata labels

### 3.9 Status / Info Region

- in REXPaint, the Info window sits at the bottom of the sidebar below the
  Layers panel and shows: current cursor position (cell coords), image dimensions,
  active layer number, glyph index under cursor, fg/bg colors under cursor
- Options (`F3`) and Help (`F1`) menu entries are also in this region
- milestone 1 minimum: current cell position, active tool name, active apply
  modes, active layer, current draw glyph / fg / bg
- this region may be overlapped by extended layers mode (deferred)

## 4. Required Tools

Milestone 1 required tools (REXPaint shortcut in parentheses):

- Cell draw (`c`) — apply to single cell; hold LMB + drag to paint continuously
- Line (`l`) — click start, release at end; RMB/ESC to cancel
- Rect (`r`) — click corner, release at opposite corner; alternate mode: filled rect
- Fill (`i`) — flood fill attached like-cells (4-direction); alternate: 8-direction
- Text (`t`) — on-canvas typing; Enter to confirm
- Copy (`Ctrl-c`) — copy rectangular area to clipboard
- Cut (`Ctrl-x`) — copy + erase source area
- Paste (`Ctrl-v`) — paste clipboard; alternate modes: flip H, flip V, flip both
- Eyedropper — right-click on canvas cell to sample glyph + fg + bg into draw state
- Erase — clear cells to transparent state (glyph 0, fg white, bg black)

Milestone 1 tool behavior requirements:

- tools must operate on the whole-sheet canvas
- hover preview is required for Cell, Fill, and Paste modes (REXPaint shows
  preview on hover for these three; Line/Rect show preview during drag)
- right-click anywhere on the canvas acts as eyedropper regardless of active tool
  (REXPaint behavior: "right-click on it in the image" to load glyph + colors)
- erasing must honor the XP/editor transparency contract (glyph 0 + white fg +
  black bg) rather than silently painting a random placeholder state
- only the currently enabled apply channels (G/F/B) are affected by any tool
- Copy always captures all attributes regardless of apply mode; Paste respects
  active apply modes

Deferred beyond milestone 1:

- Oval (`o`)
- auto-wall / auto-box Cell alternate mode
- 8-direction Fill alternate mode (4-direction is sufficient for milestone 1)
- Paste flip alternate modes (plain paste is sufficient for milestone 1)
- used-glyph highlighting (`u`)
- Alt-hover glyph/color location highlighting
- global color replace (Shift-LMB on palette)

## 5. Layer Behavior

Layer behavior must be explicit and user-reachable. Evidence: `rexpaint_layers.gif`,
`REXPAINT_MANUAL.txt` "Layers" section.

REXPaint supports 1-9 layers per image. The Layers panel at the bottom of the
sidebar shows numbered layer rows. The active layer is highlighted. Each layer
can be hidden (`Ctrl-1..9`) or locked (`Shift-1..9`). Locked layers cannot be
edited. Multi-layer copy/paste depth is controlled by `d` key.

Required behavior:

- the editor must display the real XP layer stack for loaded/uploaded sessions
- active layer and visible layers must be separate concepts
- the active layer determines where edits land
- visible layers determine composite rendering
- the UI must expose layer visibility toggles (per-layer Hide button or icon)
- the UI must expose active-layer switching (click layer number to activate)
- the UI must prevent accidental edits to hidden/non-active layers through clear
  state feedback (e.g., greyed-out or marked layer rows)
- the active layer indicator must be visible in both the Layers panel and the
  status/info region

Milestone 1 minimum operations:

- activate layer (click to select)
- show/hide layer (toggle per layer)
- view full stack (all layers listed)
- add layer (+ button)

Milestone 1 required operations:

- activate layer
- show/hide layer
- lock/unlock layer
- view full stack
- add layers as needed to reach the required XP structure
- delete layer

Milestone 1 not required unless product owner promotes them:

- layer reorder
- merge down (`Ctrl-Shift-m` in REXPaint — irreversible)
- duplicate layer
- multi-layer copy depth (`d` key)
- extended layers mode (`E` key — expands panel over info region)

If a layer is preserved-only for runtime contract reasons, the UI must make that clear.

## 6. Apply Modes

REXPaint-style apply-channel behavior is mandatory. Evidence:
`REXPAINT_MANUAL.txt` "Apply" section, all sidebar screenshots showing G/F/B toggles.

Required channels:

- Glyph (`g`)
- Foreground (`f`)
- Background (`b`)

Required behavior:

- channels can be toggled independently via sidebar buttons or keyboard shortcuts
- a tool applies only the enabled channels
- toggle state must be visually obvious (highlighted/colored when active)
- Shift-click on a channel button solos that channel (turns off the others) in
  REXPaint; milestone 1 may defer solo-click but must support independent toggle
- color swatches next to `Fore` and `Back` show the current draw colors
- LMB on a color swatch opens the color picker for that color
- `Alt-w` swaps foreground and background colors (deferred if not needed)
- eyedropper (right-click on canvas) must update glyph and both colors in the
  draw state, regardless of which apply channels are currently enabled

### Color Picker

REXPaint uses a Photoshop-style HSV/RGB color picker (`rexpaint_colorpicker_v.png`):
- large saturation/brightness gradient field (left)
- vertical hue slider bar (right of gradient)
- New/Old color preview swatches
- numeric entry fields: H, S, V, R, G, B, plus hex code
- mode radio buttons to switch slider between H, S, or V
- OK / Cancel buttons

Milestone 1 minimum: a functional color picker that allows precise RGB selection.
An HTML `<input type="color">` is acceptable as a temporary stand-in but does not
constitute parity. Full HSV/RGB picker with numeric entry is the parity target.

Milestone 1 acceptance examples:

- glyph-only drawing changes glyph without changing fg/bg
- fg-only drawing changes foreground without changing glyph/bg
- bg-only drawing changes background without changing glyph/fg
- combined modes apply all selected channels together
- turning all channels off draws nothing (REXPaint behavior)

## 7. Navigation, Pan, and Zoom

Whole-sheet navigation is required. Evidence: `rexpaint_zoomscale.gif`,
`REXPAINT_MANUAL.txt` "Canvas" and "Shifting" sections.

Required behavior:

- the canvas supports pan/drag via `Space + LMB` drag (Photoshop-style)
- numpad keys for 8-directional shift (deferred if no numpad expected in web)
- the canvas supports zoom: `Ctrl+Wheel` or `< / >` keys change display font
  size dynamically (REXPaint actually switches to a different-sized font bitmap)
- `Enter` resets viewport position; `Ctrl-Enter` centers image
- frame-grid selection must focus or pan the whole-sheet viewport to the selected
  frame region
- zoom must not change document structure, only view scale
- grid overlay toggle: `Ctrl-g`; grid resolution adjustable with `Alt+Wheel`;
  `Alt-g` toggles "Grid Under" mode (deferred for milestone 1)

Milestone 1 minimum:

- `Space + LMB` drag pan (or scroll-based pan in a scrollable container)
- at least one zoom in / zoom out control
- at least one reliable fit/reset control
- `Ctrl-g` or equivalent grid toggle

## 8. Selection Semantics

Selection is rectangular by default.

Required behavior:

- create rectangular selection on whole-sheet canvas
- move/copy/cut/paste selected region
- delete/clear selection contents
- selection preview must be visible before commit where movement/transform is involved
- selection operations must respect active layer and apply modes

Milestone 1 required transforms:

- paste
- delete/clear
- horizontal flip
- vertical flip

Deferred unless explicitly promoted:

- rotate selection
- arbitrary multi-selection
- global replace within selection

## 9. Shortcuts

Milestone 1 shortcut set must be small, stable, and REXPaint-aligned where reasonable.
Evidence: `REXPAINT_MANUAL.txt` "Commands" section and inline tool descriptions.

Required shortcuts:

- `c` Cell draw
- `l` Line
- `r` Rect
- `i` Fill
- `t` Text
- `g` toggle Glyph apply
- `f` toggle Foreground apply
- `b` toggle Background apply
- `z` or `Ctrl/Cmd+Z` Undo (REXPaint supports both)
- `y` or `Ctrl/Cmd+Y` Redo (REXPaint supports both)
- `Ctrl/Cmd+C` Copy
- `Ctrl/Cmd+X` Cut
- `Ctrl/Cmd+V` Paste
- `Delete` clear selection
- `Space` temporary pan mode (hold Space + LMB drag)
- `Ctrl-g` toggle grid overlay
- `Ctrl-r` resize image (milestone 1 if needed for structure changes)

REXPaint manual precedence applies to shortcut conflicts. In particular:

- `i` is Fill (not "insert" or any other meaning)
- `f` is Foreground apply toggle (not "find" or any other meaning)
- `o` is Oval (deferred) — do not assign `o` to anything else
- `u` is used-glyph highlighting (deferred) — do not assign `u` to anything else
- `d` is multi-layer copy depth (deferred) — do not assign `d` to anything else

Note: `s` was listed in the previous draft for Select but REXPaint does not use
`s` as a draw-mode shortcut. Copy/Cut/Paste are the selection tools in REXPaint.
If a dedicated Select tool is added for milestone 1, `s` is acceptable but must
not conflict with any REXPaint-reserved shortcut.

## 10. Frame Grid Behavior

The frame grid is secondary navigation, not the main editor.

Required behavior:

- frame tiles reflect atlas/frame structure
- selecting a frame updates navigation/focus state for the whole-sheet canvas
- frame tiles may support preview, selection, and metadata context
- primary edits do not require opening a separate frame editor

Forbidden milestone drift:

- treating frame-tile double-click + modal inspector as the parity target
- requiring per-frame modal entry for ordinary painting

## 11. Milestone 1 Definition

Milestone 1 is achieved only when all of the following are true:

- the shipped workbench exposes a whole-sheet editor surface
- the surface is user-reachable
- the surface supports both new-file authoring and existing-file editing
- loaded/uploaded XP sessions hydrate from real backend truth
- the user can edit on the whole sheet with required milestone tools
- apply modes work
- active layer / visible layer behavior is correct
- frame grid acts as navigator/preview, not primary editor
- exported XP preserves structure and layers through the backend truth path
- the result also passes Test Skin Dock / runtime acceptance for the workflow under test

Milestone 1 required acceptance scenarios:

1. New-file bundle authoring through shipped UI:
- start from a new file
- create the correct structure
- recreate the three sprite animations required for the bundle:
  - idle
  - attack
  - death
- produce the correct XP outputs through reachable UI actions
- pass Test Skin Dock/runtime

2. Existing-file reconstruction through shipped UI:
- import a blank single-layer XP file, initially with the wrong simple structure (for example a 2x2 cell-size starting point)
- through reachable UI actions, change dimensions to the correct structure
- add the required layers
- recreate the required contents on each layer
- produce the correct bundle XP result
- pass Test Skin Dock/runtime

Milestone 1 is not achieved by:

- making the legacy inspector less broken
- proving isolated module behavior in `web/rexpaint-editor/*`
- passing a narrow harness that does not reflect the whole-sheet target

## 12. Deferred Beyond Milestone 1

Deferred by default:

- full REXPaint browse mode
- alternate export formats beyond required XP/product paths
- font switching
- advanced palette management files
- layer reorder/merge/duplicate if not needed for immediate parity gate
- rotate selection if not needed for immediate parity gate
- oval and other lower-priority tools
- nonessential cosmetic/theme parity

## 13. Open Questions

- ~~Which exact shortcut resolves the `Fill` vs `Foreground apply` conflict in the
  shipped UI?~~ **RESOLVED**: No conflict. `i` is Fill, `f` is Foreground apply
  toggle. They are separate keys in REXPaint. (Manual: "Fill ('i')" and "'f'" for
  foreground apply.)
- Should milestone 1 include layer locking, or is active-layer plus visibility
  feedback sufficient? (Layer locking is listed as milestone 1 required in section 5,
  pending product-owner confirmation.)
- Are horizontal/vertical flip mandatory in milestone 1, or acceptable in the next
  increment after basic selection copy/paste/delete?
- Does milestone 1 require direct new-file authoring from this surface, or only
  loaded/uploaded XP editing through the shipped workbench path?

## 14. Evidence Sources

This spec was tightened on 2026-03-16 using:

- `REXPAINT_MANUAL.txt` (v1.70 official manual)
- `rexpaint_browser.gif` — browse mode sidebar layout
- `rexpaint_shapes.gif` — paint mode sidebar with tools and apply panel
- `rexpaint_palette.gif` — palette panel and image context
- `rexpaint_layers.gif` — layer editing with multi-layer content
- `rexpaint_zoomscale.gif` — zoomed view with font scaling
- `rexpaint_colorpicker_v.png` — HSV/RGB color picker dialog (static PNG)
- `rexpaint_copypaste.gif` — copy/paste and text tool
- `rexpaint_preview.gif` — fill preview on hover
- `rexpaint ui.md` — structured UI audit cross-referenced with manual

These resources are sufficient for structural layout and control-placement
requirements. They are not sufficient for pixel-perfect geometry, all rare
dialog states, or configuration-only modes.
