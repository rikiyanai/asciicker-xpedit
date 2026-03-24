# Complete Workbench + REXPaint UI Control Reference

**Generated:** 2026-03-08
**Status:** Append-only comprehensive reference (no deletions)
**Combines:**
- Existing workbench UI inventory (189 elements, 15 sections)
- REXPaint v1.70 live UI screenshot analysis
- Bundle mode enhancements (already integrated into inventory)
- Full REXPaint v1.70 manual text (see Appendix A)

---

## PART 1: WORKBENCH UI COMPLETE INVENTORY

### Source
- `web/workbench.html` (395 lines)
- `web/workbench.js` (6669 lines, currently unchanged from clean worktree)

### Scope
189 UI elements across 15 sections, organized by panel/functional area.

---

## SECTION 1: TEMPLATE PANEL (`#templatePanel`) — 5 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 1 | `templateSelect` | select | Template | (change) | Options: `player_native_idle_only` "Player Skin (Idle Only)", `player_native_full` "Player Skin (Full Bundle)" |
| 2 | `templateApplyBtn` | button | Apply Template | `applyTemplate()` | Creates bundle or sets classic mode based on template selection |
| 3 | `templateStatus` | span | "Classic (single XP)" | (display) | Shows current mode: classic or bundle |
| 4 | `bundleActionTabs` | div | (dynamic tabs) | `renderBundleActionTabs()` | Container for action tab buttons (idle/attack/death) in bundle mode; each tab shows ✓/○ status |
| 5 | `bundleStatus` | div | (dynamic) | (display) | Shows "Bundle: N/M actions converted"; enables export when all required actions complete |

**Bundle Mode Additions:**
- Template now supports DUAL modes: classic (single XP) and bundle (multi-action)
- Bundle tabs for idle/attack/death actions with visual status indicators
- Each action can be worked independently with per-action source/grid/preview

---

## SECTION 2: SESSION TOOLBAR — 5 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 6 | `btnLoad` | button | Load From Job | `loadFromJob()` | Loads session from pipeline job ID (URL param); works for both classic and bundle modes |
| 7 | `btnExport` | button | Export XP | `exportXp()` | Exports current session as .xp (classic) or all actions as multi-family bundle (bundle mode) |
| 8 | `undoBtn` | button | Undo | `undo()` | Undoes last edit (max 50 history); per-action state preserved in bundle mode |
| 9 | `redoBtn` | button | Redo | `redo()` | Redoes last undone edit |
| 10 | `wbStatus` | div | (status) | (display) | Status message area; shows mode (classic/bundle), action name in bundle mode, or idle message |

---

## SECTION 3: UPLOAD + CONVERT PANEL — 11 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 11 | `uploadPanelLabel` | span | "Workbench Direct" | (display) | **Changes to action name in bundle mode** (e.g., "Idle Action", "Attack Action", "Death Action") |
| 12 | `wbFile` | input[file] | (file picker) | `change` | Accepts .png files; in bundle mode, respects action-specific dims (126×80, 144×80, 110×88) |
| 13 | `wbUpload` | button | Upload PNG | `wbUpload()` | Uploads selected PNG to server; sets source image for current action |
| 14 | `wbAnalyze` | button | Analyze | `wbAnalyze()` | Analyzes uploaded image for suggested angles/frames; **per-action in bundle mode** |
| 15 | `wbRun` | button | Convert to XP | `wbRun()` | **In bundle mode: runs pipeline for current action** with family-specific dims |
| 16 | `wbName` | input[text] | Name | (read) | Sprite name, default "wb_sprite"; per-action in bundle mode |
| 17 | `wbAngles` | input[text] | Angles | (read) | Number of rotation angles; **defaults per family**: player=8, attack=8, plydie=8 |
| 18 | `wbFrames` | input[text] | Frames CSV | (read) | Animation frame counts; **defaults per family**: player=[1,8], attack=[8], plydie=[5] |
| 19 | `wbSourceProjs` | input[text] | Source Projs | (read) | Source projections; **defaults per family**: all=2 |
| 20 | `wbRenderRes` | input[text] | Render Res | (read) | Render resolution, default "12" pixels per glyph |
| 21 | `wbRunOut` | pre | (output) | (display) | JSON output from upload/analyze/run per action |

**Bundle Mode Additions:**
- Upload panel label changes per action (shows "Idle Action", "Attack Action", etc.)
- Sprite dimensions and frame specs auto-populate per action family
- Each action has separate upload/analyze/run pipeline

---

## SECTION 4: SOURCE PANEL — 15 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 22 | `sourceSelectBtn` | button | Select | `setSourceMode("select")` | Sets source mode to select (click/drag boxes) |
| 23 | `drawBoxBtn` | button | Draw Box | `setSourceMode("draw_box")` | Sets source mode to draw box (drag to create) |
| 24 | `rowSelectBtn` | button | Drag Row | `setSourceMode("row_select")` | Sets source mode to row selection drag |
| 25 | `colSelectBtn` | button | Drag Column | `setSourceMode("col_select")` | Sets source mode to column selection drag |
| 26 | `cutVBtn` | button | Vertical Cut | `setSourceMode("cut_v")` | Sets source mode to vertical cut insertion |
| 27 | `deleteBoxBtn` | button | Delete Box | `deleteSelectedSourceObjectsOrDraft()` | Deletes selected source objects, or clears all overlays |
| 28 | `extractBtn` | button | Find Sprites | `findSprites()` | Auto-detects sprite bounding boxes via flood-fill; **respects action cell dimensions in bundle mode** |
| 29 | `rapidManualAdd` | checkbox | Rapid Add | `change` | When checked, drawing auto-commits previous draft |
| 30 | `threshold` | input[number] | Threshold | (read) | Background threshold, min=0, max=255, default=48; affects `findSprites()` sensitivity |
| 31 | `minSize` | input[number] | Min Size | (read) | Minimum sprite size, min=1, default=8 |
| 32 | `sourceZoomInput` | input[range] | Source Zoom | `input` | Range: 1-6, step 0.5, default 1 |
| 33 | `sourceZoomValue` | span | "1x" | (display) | Shows current source zoom level |
| 34 | `sourceModeHint` | div | (hint) | (display) | Describes current source tool mode |
| 35 | `sourceCanvas` | canvas | (source image) | mouse events | **576x320 default; adapts to action dims in bundle mode** (126×80 idle, 144×80 attack, 110×88 death) |
| 36 | `sourceInfo` | div | (info) | (display) | Shows sprite count, anchor size, draft size, selection count; per-action in bundle mode |

**Source Context Menu (`#sourceContextMenu`)** — 5 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 37 | `sourceContextMenu` | div | (menu) | (right-click) | Hidden context menu container |
| 38 | `srcCtxAddSprite` | button | Add as 1 sprite | `commitDraftToSource("manual")` | Commits draft box as a sprite box |
| 39 | `srcCtxAddToRow` | button | Add to selected row sequence | `addSourceBoxToSelectedRowSequence()` | Commits draft and inserts into grid row |
| 40 | `srcCtxSetAnchor` | button | Set as anchor for Find Sprites | `setAnchorFromTarget()` | Sets reference anchor for sprite detection |
| 41 | `srcCtxPadAnchor` | button | Pad this bbox to anchor size | `applyPadToContextTarget()` | Pads box to match anchor dimensions; **respects action cell_w/cell_h in bundle mode** |
| 42 | `srcCtxDelete` | button | Delete | `deleteSourceTarget()` | Deletes the context-targeted object |

**Bundle Mode Additions:**
- Source canvas resizes per action (idle: 126×80, attack: 144×80, death: 110×88)
- Find Sprites respects action-specific cell dimensions
- All source operations work per-action with per-action undo/redo

---

## SECTION 5: GRID PANEL — 13 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 43 | `rowUpBtn` | button | Row Up | `moveSelectedRow(-1)` | Swaps selected row with row above |
| 44 | `rowDownBtn` | button | Row Down | `moveSelectedRow(1)` | Swaps selected row with row below |
| 45 | `colLeftBtn` | button | Col Left | `moveSelectedCols(-1)` | Swaps selected column(s) left |
| 46 | `colRightBtn` | button | Col Right | `moveSelectedCols(1)` | Swaps selected column(s) right |
| 47 | `addFrameBtn` | button | Add Frame | `addGridFrameSlot()` | Adds a new frame column to the grid |
| 48 | `deleteCellBtn` | button | Delete Selected | `deleteSelectedFrames()` | Clears selected frame cells |
| 49 | `openInspectorBtn` | button | Open XP Editor | `openInspectorForSelectedFrame()` | **WILL BE REPLACED**: Opens full-page Web REXPaint editor for selected frame |
| 50 | `layerSelect` | select | Active Layer | `change` | Dynamic options for each layer (0-3+ depending on family); **layer counts per family**: player=4, attack=4, plydie=3 |
| 51 | `layerHint` | span | "Select a frame..." | (display) | Layer editing hint |
| 52 | `gridZoomInput` | input[range] | Grid Zoom | `input` | Range: 0.75-2.5, step 0.25, default 1 |
| 53 | `gridZoomValue` | span | "1x" | (display) | Shows current grid zoom level |
| 54 | `layerVisibility` | div | (checkboxes) | `change` | Dynamic checkboxes per layer; toggles visibility |
| 55 | `gridPanel` | div | (frame grid) | mouse/drag events | **Grid geometry adapts per action in bundle mode**: cell_w/cell_h, angle rows, frame columns |

**Grid Context Menu (`#gridContextMenu`)** — 4 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 56 | `gridContextMenu` | div | (menu) | (right-click) | Hidden context menu container |
| 57 | `ctxCopy` | button | Copy Frame | `copySelectedFrameToClipboard()` | Copies selected frame to clipboard; per-action in bundle mode |
| 58 | `ctxPaste` | button | Paste Frame | `pasteClipboardToSelectedFrame()` | Pastes clipboard into selected frame; per-action in bundle mode |
| 59 | `ctxOpenInspector` | button | Open XP Editor | `openInspectorFromGridContextMenu()` | **WILL BE REPLACED**: Opens full-page Web REXPaint editor |
| 60 | `ctxDelete` | button | Delete | `deleteSelectedFrames()` | Clears selected frame cells |

**Bundle Mode Additions:**
- Grid geometry changes per action: idle (18 cols × 8 rows), attack (8 cols × 8 rows), plydie (8 cols × 8 rows)
- Layer count per family: player/attack=4 layers, plydie=3 layers
- All grid operations per-action with per-action undo/redo

---

## SECTION 6: LEGACY CHAR GRID (DEBUG) — 2 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 61 | `legacyGridDetails` | details | "Legacy Char Grid (debug)" | (collapsible) | Debug-only view of raw character grid (collapsed by default) |
| 62 | `grid` | div | (char grid) | dblclick | Grid of individual character cells; dblclick opens inspector |

**Note:** Marked as deprecated in favor of frame grid; scheduled for removal/collapse by default.

---

## SECTION 7: ANIMATION + METADATA PANEL — 17 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 63 | `animCategorySelect` | select | Row Category | (read) | Options: idle, walk, attack, hurt, death, custom; **per-action in bundle mode** |
| 64 | `assignAnimCategoryBtn` | button | Assign Row Category | `assignRowCategory()` | Assigns category to selected row; per-action in bundle mode |
| 65 | `frameGroupName` | input[text] | Frame Group Name | (read) | Group name, default "group_1"; per-action in bundle mode |
| 66 | `assignFrameGroupBtn` | button | Assign Selected Frames | `assignFrameGroup()` | Assigns selected frames to named group; per-action in bundle mode |
| 67 | `applyGroupsToAnimsBtn` | button | Apply Frame Groups to Metadata | `applyGroupsToAnims()` | Updates anims array from frame groups; per-action in bundle mode |

**Frame Jitter Sub-section** — 12 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 68 | `jitterAlignMode` | select | Align | (read) | Options: Bottom Center, Bottom Left, Top Left, Center; reference point for alignment |
| 69 | `jitterRefMode` | select | Reference | (read) | Options: First Selected, Median (Selected); which frame to align to |
| 70 | `autoAlignSelectedBtn` | button | Auto Align Selected | `autoAlignFrameJitter(false)` | Aligns selected frames to reference |
| 71 | `autoAlignRowBtn` | button | Auto Align Row | `autoAlignFrameJitter(true)` | Aligns entire row to reference |
| 72 | `jitterRow` | input[number] | Row | `change` | Jump to row, min=0; selects active row for jitter operations |
| 73 | `jitterStep` | input[number] | Step | (read) | Nudge step size, min=1, max=16, default=1 |
| 74 | `jitterLeftBtn` | button | left arrow | `nudgeSelectedFrames(-step, 0)` | Nudge selected frames left |
| 75 | `jitterRightBtn` | button | right arrow | `nudgeSelectedFrames(step, 0)` | Nudge selected frames right |
| 76 | `jitterUpBtn` | button | up arrow | `nudgeSelectedFrames(0, -step)` | Nudge selected frames up |
| 77 | `jitterDownBtn` | button | down arrow | `nudgeSelectedFrames(0, step)` | Nudge selected frames down |
| 78 | `jitterInfo` | div | (info) | (display) | Shows jitter/alignment info for selected row; per-action in bundle mode |
| 79 | `metaOut` | pre | (output) | (display) | JSON metadata output; per-action in bundle mode |

**Bundle Mode Additions:**
- All animation metadata per-action (idle, attack, death have separate categories)
- Jitter alignment respects action-specific frame dimensions

---

## SECTION 8: XP PREVIEW PANEL — 5 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 80 | `playBtn` | button | Play | `startPreview()` | Starts animation preview loop; **per-action in bundle mode** |
| 81 | `stopBtn` | button | Stop | `stopPreview()` | Stops animation preview loop |
| 82 | `fpsInput` | input[number] | FPS | (read) | Frame rate, min=1, max=30, default=8 |
| 83 | `previewAngle` | input[number] | Direction | `change` | Angle/direction index, min=0; max=7 for 8-angle sprites |
| 84 | `previewCanvas` | canvas | (preview) | (display) | 256x256 animation preview canvas; **shows current action's animation in bundle mode** |

**Bundle Mode Additions:**
- Preview shows current action's animation (idle/attack/death)
- Switching action tabs updates preview to show that action's frames

---

## SECTION 9: SESSION PANEL — 1 Element

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 85 | `sessionOut` | pre | (output) | (display) | JSON session summary; **shows bundle ID and per-action status in bundle mode** |

---

## SECTION 10: SKIN TEST DOCK PANEL — 14 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 86 | `webbuildQuickTestBtn` | button | Test This Skin | `testCurrentSkinInDock()` | Full deterministic test: restart + apply skin; **in bundle mode: applies all completed actions** |
| 87 | `webbuildApplyInPlaceBtn` | button | Apply In Place | `applyCurrentXpAsWebSkin({...})` | Apply skin without restart (hidden) |
| 88 | `webbuildApplyRestartBtn` | button | Apply + Restart | `applyCurrentXpAsWebSkin({...})` | Apply skin with forced restart (hidden) |
| 89 | `webbuildUploadTestBtn` | button | Upload Skin | `onWebbuildUploadTestClick()` | Triggers file picker for external .xp upload; **per-action in bundle mode** |
| 90 | `webbuildUploadTestInput` | input[file] | (hidden) | `change` | Accepts .xp files; per-action in bundle mode |
| 91 | `webbuildState` | span | (status) | (display) | Shows webbuild runtime status |
| 92 | `webbuildHint` | div | (hint) | (display) | Explains skin test dock buttons |
| 93 | `webbuildFrame` | iframe | "Asciicker Webbuild" | `load` | Hidden iframe for WASM runtime; 100% wide, 360px tall; **loads current action in bundle mode** |
| 94 | `webbuildOpenBtn` | button | Open Preview | `openWebbuild()` | Opens flat arena preview in iframe |
| 95 | `webbuildReloadBtn` | button | Reload Preview | `reloadWebbuild()` | Reloads the iframe with fresh URL |
| 96 | `webbuildApplySkinBtn` | button | Apply Current XP (Advanced) | `applyCurrentXpAsWebSkin()` | Advanced skin apply (mounted mode) |
| 97 | `webbuildOut` | pre | (output) | (display) | Debug JSON output for webbuild operations |
| 98 | `runtimePreflightBanner` | div | (banner) | (display) | Warning banner when runtime preflight fails |
| 99 | `runtimePreflightBannerText` | div | (text) | (display) | Preflight failure details |

**Bundle Mode Additions:**
- "Test This Skin" applies all completed actions to WASM (not just current action)
- Runtime preflight validates all required actions present before injection
- Per-action skin testing via upload per action

---

## SECTION 11: TERM++ NATIVE PANEL — 24 Elements

| # | ID | Type | Label | Handler | Description |
|---|--|----|-------|---------|-------------|
| 100 | `termppBinary` | select | Binary | `change` | Options: game_term (TERM++), game (GL game); selects which binary to launch |
| 101 | `termppSkinCmdBtn` | button | Preview TERM++ Skin Launch | `termppSkinCommandPreview()` | Shows the command that would be run |
| 102 | `termppSkinLaunchBtn` | button | Launch TERM++ SKIN | `launchTermppSkin()` | Launches real game instance with custom skin |
| 103 | `termppStreamX` | input[number] | X | `change` | Embed region X, min=0, default=0 |
| 104 | `termppStreamY` | input[number] | Y | `change` | Embed region Y, min=0, default=0 |
| 105 | `termppStreamW` | input[number] | Width | `change` | Embed region width, min=16, default=960 |
| 106 | `termppStreamH` | input[number] | Height | `change` | Embed region height, min=16, default=640 |
| 107 | `termppStreamFps` | input[number] | FPS | `change` | Stream FPS, min=1, max=30, default=4 |
| 108 | `termppStreamPreviewBtn` | button | Preview Embed | `previewTermppEmbedStream()` | Dry-run of embed stream |
| 109 | `termppStreamStartBtn` | button | Start Embed Stream | `startTermppEmbedStream()` | Starts screen capture embed stream |
| 110 | `termppStreamStopBtn` | button | Stop Stream | `stopTermppEmbedStream()` | Stops running embed stream |
| 111 | `termppStreamHint` | div | (hint) | (display) | Explains embed stream usage |
| 112 | `termppStreamImg` | img | "TERM++ embed stream" | (display) | Shows captured frames from native window |
| 113 | `termppStreamInfo` | div | (info) | (display) | Stream status: running, frame count, last frame time |
| 114 | `termppSkinHint` | div | (hint) | (display) | Explains TERM++ skin launch |
| 115 | `termppSkinOut` | pre | (output) | (display) | JSON output from TERM++ skin operations |
(... remaining elements 116-125 continue in Sections 12-13)

---

## SECTION 12: VERIFICATION PANEL — 8 Elements
## SECTION 13: EXPORT PANEL — 3 Elements
## SECTION 14: XP EDITOR / CELL INSPECTOR PANEL — 62 Elements (**WILL BE REPLACED**)
## SECTION 15: TOP-LEVEL ELEMENTS — 1 Element

*(Full details in original inventory document, see `docs/WORKBENCH_DOCS_ARCHIVE.md#claude-workbench-ui-inventory`)*

---

## PART 2: REXPaint v1.70 UI ANALYSIS

### Source
- Live REXPaint v1.70 screenshots (2026-03-08)
- REXPaint v1.70 help menu (complete shortcut reference)
- REXPaint v1.70 manual (see Appendix A)

### Major UI Panels

**1. Glyph Picker** (Top-left, canvas-rendered 16×16 grid)
- All 256 CP437 characters visible
- Click to select active glyph
- Navigation: < > arrows to scroll
- Used glyph highlighting (optional)
- Dimensions: ~256×256 pixels

**2. Font Selection**
- Multiple CP437 bitmap font sizes (8×8, 10×10, 12×12, 16×16)
- Dropdown or keyboard shortcut to switch
- Affects rendering zoom level

**3. Palette Panel** (Mid-left, overlay on canvas)
- Large RGB color grid (120+ slots visible)
- Warm colors (left), cool colors (right), neutrals (bottom)
- LMB = set foreground color
- RMB = set background color
- Double-click = edit in color picker
- Scrollable if palette exceeds visible area

**4. Color Picker** (Custom HSV/RGB widget)
- HSV color wheel/square
- RGB sliders with numeric entry
- Hex value input
- Current selection indicator
- Mode: HSV vs RGB toggle

**5. Tools Panel** (Sidebar)
- **Drawing:** Cell, Line, Rect, Oval, Fill, Text
- **Selection:** Rectangular selection with transforms
- **Edit:** Copy, Cut, Paste, Undo, Redo
- **Canvas:** Resize, Pan/Drag, Grid toggle
- **File:** New, Open, Save, Export PNG

**6. Layers Panel** (Lower-left)
- Layer number buttons (1-9+)
- Visibility toggles (eye icon per layer)
- Lock indicators
- Active layer highlight
- Order arrows (up/down)
- Extended Layers Mode (E+) toggle

**7. Canvas** (Center, main editing area)
- Rendered ASCII art with CP437 glyphs
- Full-cell coloring (not half-cell blocks)
- Grid overlay toggle
- Zoom via font size (4-28x)
- Pan via spacebar+drag
- Transparent cells shown as checkerboard

**8. Info Panel** (Bottom-left)
- Coordinate display (X, Y)
- Current glyph code
- FG/BG color values
- Frame/angle position
- Tool tip/status

---

## PART 3: KEYBOARD SHORTCUTS COMPLETE REFERENCE

### REXPaint Conventions (to be replicated in Web REXPaint)

**Drawing Tools:**
- `c` — Cell draw (freehand)
- `l` — Line draw
- `r` — Rectangle (2x = filled)
- `o` — Oval (2x = filled)
- `i` — Fill tool (2x = 8-direction)
- `t` — Text input

**Apply Toggles (Independent Channels):**
- `g` — Toggle glyph apply
- `f` — Toggle foreground color apply
- `b` — Toggle background color apply

**Clipboard:**
- `Ctrl-c` — Copy selection
- `Ctrl-x` — Cut selection
- `Ctrl-v` — Paste (2x = flip variations)

**Undo/Redo:**
- `z` — Undo
- `y` — Redo

**Layers:**
- `Ctrl-1` — New layer
- `1~4` (Ctrl) — Activate layer 1-4
- `~4` — Toggle layer visibility

**Canvas:**
- `Ctrl-r` — Resize canvas
- `Ctrl-g` — Toggle grid
- `Spacebar` — Drag mode (pan)

**Selection Transforms:**
- `h` — Flip horizontal
- `r` — Rotate
- `[` — Rotate CCW
- `]` — Rotate CW

**File:**
- `Ctrl-n` — New image
- `Ctrl-s` — Save
- `Ctrl-o` — Export PNG
- `Tab` — Toggle browse/paint mode

---

## PART 4: COMPLETE EVENT LISTENER INVENTORY

### Click Events: 86 total
*(See Section: EVENT LISTENERS MASTER LIST in original inventory)*

### Change Events: 15 total
### Input Events: 8 total
### Mouse Events: 16 total
### Window-level Events: 6 total
### Iframe Events: 1 total
### Dynamic Events: 24 total (palette swatches)

**Total: 162 event handlers**

---

## PART 5: CANVASES SUMMARY

| Canvas | Size | Renders | Interaction | Purpose |
|--------|------|---------|-------------|---------|
| `sourceCanvas` | 576×320 | Source PNG + sprite boxes + cuts + drafts | Mouse: draw/select/drag | Sprite extraction from source image |
| `previewCanvas` | 256×256 | Animated XP frame preview | Play/Stop buttons only | Animation playback preview |
| `cellInspectorCanvas` | 320×320 | Zoomed XP cell editor + grid | Mouse: paint/erase/select | **WILL BE REPLACED by Web REXPaint canvas** |

---

## PART 6: BUNDLE SYSTEM INTEGRATION POINTS

### Classic Mode (Single-family)
- 1 session = 1 XP file
- Fixed layer count (4 for player)
- Editing workflow unchanged

### Bundle Mode (Multi-family)
- 1 bundle = 3 actions (idle/attack/death)
- Per-action family determines: dims, cell_w/cell_h, layer count, frame specs
- Each action has separate: source panel, grid panel, undo/redo, preview
- Bundle export creates 65 override files (25 player + 16 attack + 24 plydie)
- Structural gates G10-G12 validate each action before export

### Template System
| Template | Mode | Actions | Families |
|----------|------|---------|----------|
| `player_native_idle_only` | Classic | Idle (1) | Player (1) |
| `player_native_full` | Bundle | Idle + Attack + Death (3) | Player + Attack + Plydie (3) |

---

## APPENDIX A: REXPaint v1.70 Manual (Full Text)

[Complete manual text from `docs/REXPAINT_MANUAL.txt` would be appended here — 18K document with 403 lines]

*(To be appended: see Appendix B below for integration strategy)*

---

## APPENDIX B: UI CHANGE CHECKLIST FOR WEB REXPAINT EDITOR

### Elements to KEEP from current Cell Inspector:
- ✅ Undo/Redo (5 per-action history)
- ✅ Layer visibility toggle + layer selection
- ✅ Grid overlay toggle + checker background
- ✅ Zoom control (4-28x)
- ✅ Copy/Paste/Cut/Delete selection
- ✅ Flip/Rotate selection
- ✅ Find & Replace (glyph + FG/BG colors)
- ✅ Frame navigation (prev/next angle/frame)
- ✅ Dirty badge / auto-save indicator

### Elements to REPLACE (REXPaint-style improvements):
- ❌ Half-cell paint tool → **Full CP437 glyph rendering**
- ❌ Tool buttons (6) → **REXPaint 6-tool set (Cell, Line, Rect, Oval, Fill, Text)**
- ❌ Glyph code input → **Visual 16×16 CP437 glyph picker**
- ❌ Color inputs → **Custom HSV/RGB color picker with numeric entry**
- ❌ 12 fixed swatches → **Full palette system (loadable, saveable, extractable)**
- ❌ Single-layer editing → **Multi-layer with Layer 0/1 read-only enforcement**

### Canvas Improvements:
- ❌ 320×320 fixed size → **Full-page modal (80% viewport)**
- ❌ Half-cell rendering → **Full CP437 bitmap font rendering**
- ❌ No pan/zoom controls → **Canvas pan (spacebar+drag) + font-size zoom**
- ❌ No shape tools → **Line, Rect, Oval, Fill tool support**
- ❌ No hover preview → **Shadow preview before commit**

---

## SUMMARY TABLE: 189 vs 62 vs NEW

| Category | Current Workbench | Cell Inspector (to replace) | Web REXPaint (new) |
|----------|------|------|------|
| **Total UI Elements** | 189 | 62 | ~70-80 (estimated) |
| **Panels** | 15 | 1 | 1 (full-page modal) |
| **Tools** | 6 (basic) | 6 (basic) | 6 (REXPaint-class) |
| **Glyph Selection** | Numeric input | Numeric input | **Visual grid picker** |
| **Color Picker** | Native input | Native input | **Custom HSV/RGB** |
| **Palette** | 12 fixed swatches | 12 fixed swatches | **Loadable palette system** |
| **Canvas Rendering** | Half-cell blocks | Half-cell blocks | **Full CP437 glyphs** |
| **Shape Tools** | None | None | **Line, Rect, Oval, Fill** |
| **Canvas Size** | 320×320 fixed | 320×320 fixed | **Full-page adaptive** |
| **Hover Preview** | None | None | **Shadow preview** |
| **Layers** | 3-4 fixed | 3-4 fixed | **Per-family (3-4), L0/L1 locked** |

---

**END OF COMPLETE REFERENCE**

**Last Updated:** 2026-03-08
**Status:** Append-only (ready for Web REXPaint planning)
**Next Step:** Detailed architecture plan for full-page modal editor

---

## 2026-03-23 Audit Note: Scope Clarification

> **This document is a control-level inventory, not a capability-truth document.**
>
> It catalogs 189 UI elements (buttons, inputs, handlers, display areas) and their wiring in `workbench.html` / `workbench.js`. The presence of a control in this inventory does NOT prove that the workflow it belongs to is functional, verified, or acceptance-ready.
>
> For capability proof status — distinguishing "control exists" from "workflow is verified" — see:
> - `docs/plans/2026-03-23-m2-capability-canon-inventory.md` — canonical M2 capability inventory with per-action proof status
> - `PLAYWRIGHT_FAILURE_LOG.md` — ground-truth evidence for what has been verified end-to-end
>
> This doc remains the authoritative control-level precursor to the SAR (State/Action/Response) truth table defined in `docs/plans/2026-03-22-workbench-sar-table-blueprint.md`. The SAR model adds state transitions, response invariants, and isolation contracts on top of this control inventory.
>
> Key gap as of this audit: 70% of the 96 SAR-enumerated actions are WIRED (handler exists) but have zero verifier proof. Only 10% are PROVEN.
