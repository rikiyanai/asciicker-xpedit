# Workbench UI Complete Inventory

Generated from:
- `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.html` (395 lines)
- `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js` (6669 lines)

---

## SECTION 1: TEMPLATE PANEL (`#templatePanel`)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 1 | `templateSelect` | select | Template | (change triggers applyTemplate indirectly) | Options: `player_native_idle_only` "Player Skin (Idle Only)", `player_native_full` "Player Skin (Full Bundle)" |
| 2 | `templateApplyBtn` | button | Apply Template | `applyTemplate()` | Creates bundle or sets classic mode based on template selection |
| 3 | `templateStatus` | span | "Classic (single XP)" | (display only) | Shows current mode: classic or bundle |
| 4 | `bundleActionTabs` | div | (dynamic tabs) | (populated by `renderBundleActionTabs()`) | Container for action tab buttons (idle/attack/death) in bundle mode |
| 5 | `bundleStatus` | div | (dynamic) | (display only) | Shows "Bundle: N/M actions converted" |

---

## SECTION 2: SESSION TOOLBAR (unnamed panel, line 33)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 6 | `btnLoad` | button | Load From Job | `loadFromJob()` | Loads session from pipeline job ID (from URL param) |
| 7 | `btnExport` | button | Export XP | `exportXp()` | Exports current session as .xp file (starts download) |
| 8 | `undoBtn` | button | Undo | `undo()` | Undoes last edit (max 50 history) |
| 9 | `redoBtn` | button | Redo | `redo()` | Redoes last undone edit |
| 10 | `wbStatus` | div | "No active session" | (display only) | Status message area |

---

## SECTION 3: UPLOAD + CONVERT PANEL

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 11 | `uploadPanelLabel` | span | "Workbench Direct" | (display only) | Changes to action name in bundle mode |
| 12 | `wbFile` | input[file] | (file picker) | `change` -> loads source image + resets boxes | Accepts .png files |
| 13 | `wbUpload` | button | Upload PNG | `wbUpload()` | Uploads selected PNG to server, sets source image |
| 14 | `wbAnalyze` | button | Analyze | `wbAnalyze()` | Analyzes uploaded image for suggested angles/frames |
| 15 | `wbRun` | button | Convert to XP | `wbRun()` | Runs pipeline conversion (or bundle action conversion) |
| 16 | `wbName` | input[text] | Name | (read on convert) | Sprite name, default "wb_sprite" |
| 17 | `wbAngles` | input[text] | Angles | (read on convert) | Number of rotation angles, default "1" |
| 18 | `wbFrames` | input[text] | Frames CSV | (read on convert) | Animation frame counts, default "1" |
| 19 | `wbSourceProjs` | input[text] | Source Projs | (read on convert) | Source projections, default "1" |
| 20 | `wbRenderRes` | input[text] | Render Res | (read on convert) | Render resolution, default "12" |
| 21 | `wbRunOut` | pre | (output) | (display only) | JSON output from upload/analyze/run |

---

## SECTION 4: SOURCE PANEL (left column)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 22 | `sourceSelectBtn` | button | Select | `setSourceMode("select")` | Sets source mode to select (click/drag boxes) |
| 23 | `drawBoxBtn` | button | Draw Box | `setSourceMode("draw_box")` | Sets source mode to draw box (drag to create) |
| 24 | `rowSelectBtn` | button | Drag Row | `setSourceMode("row_select")` | Sets source mode to row selection drag |
| 25 | `colSelectBtn` | button | Drag Column | `setSourceMode("col_select")` | Sets source mode to column selection drag |
| 26 | `cutVBtn` | button | Vertical Cut | `setSourceMode("cut_v")` | Sets source mode to vertical cut insertion |
| 27 | `deleteBoxBtn` | button | Delete Box | `deleteSelectedSourceObjectsOrDraft()` or clear all | Deletes selected source objects, or clears all overlays |
| 28 | `extractBtn` | button | Find Sprites | `findSprites()` + `saveSessionState("find-sprites")` | Auto-detects sprite bounding boxes via flood-fill |
| 29 | `rapidManualAdd` | checkbox | Rapid Add | `change` -> `state.rapidManualAdd` toggle | When checked, drawing auto-commits previous draft |
| 30 | `threshold` | input[number] | Threshold | (read by findSprites/rasterizer) | Background threshold, min=0, max=255, default=48 |
| 31 | `minSize` | input[number] | Min Size | (read by findSprites) | Minimum sprite size, min=1, default=8 |
| 32 | `sourceZoomInput` | input[range] | Source Zoom | `input` -> updates sourceCanvasZoom | Range: 1-6, step 0.5, default 1 |
| 33 | `sourceZoomValue` | span | "1x" | (display only) | Shows current source zoom level |
| 34 | `sourceModeHint` | div | "Mode: Select..." | (display only) | Describes current source tool mode |
| 35 | `sourceCanvas` | canvas | (source image) | mousedown/mousemove/mouseup/contextmenu | 576x320 default; renders source image with sprite boxes, cuts, draft box |
| 36 | `sourceInfo` | div | (info text) | (display only) | Shows sprite count, anchor size, draft size, selection count |

### Source Context Menu (`#sourceContextMenu`)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 37 | `sourceContextMenu` | div | (context menu) | (shown on right-click) | Hidden context menu container |
| 38 | `srcCtxAddSprite` | button | Add as 1 sprite | `commitDraftToSource("manual")` | Commits draft box as a sprite box |
| 39 | `srcCtxAddToRow` | button | Add to selected row sequence | `addSourceBoxToSelectedRowSequence()` | Commits draft and inserts into grid row |
| 40 | `srcCtxSetAnchor` | button | Set as anchor for Find Sprites | `setAnchorFromTarget()` | Sets reference anchor for sprite detection |
| 41 | `srcCtxPadAnchor` | button | Pad this bbox to anchor size | `applyPadToContextTarget()` | Pads box to match anchor dimensions |
| 42 | `srcCtxDelete` | button | Delete | `deleteSourceTarget()` | Deletes the context-targeted object |

---

## SECTION 5: GRID PANEL (right column)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 43 | `rowUpBtn` | button | Row Up | `moveSelectedRow(-1)` | Swaps selected row with row above |
| 44 | `rowDownBtn` | button | Row Down | `moveSelectedRow(1)` | Swaps selected row with row below |
| 45 | `colLeftBtn` | button | Col Left | `moveSelectedCols(-1)` | Swaps selected column(s) left |
| 46 | `colRightBtn` | button | Col Right | `moveSelectedCols(1)` | Swaps selected column(s) right |
| 47 | `addFrameBtn` | button | Add Frame | `addGridFrameSlot()` | Adds a new frame column to the grid |
| 48 | `deleteCellBtn` | button | Delete Selected | `deleteSelectedFrames()` | Clears selected frame cells |
| 49 | `openInspectorBtn` | button | Open XP Editor | `openInspectorForSelectedFrame()` | Opens XP Editor for selected frame |
| 50 | `layerSelect` | select | Active Layer | `change` -> sets activeLayer, renderAll | Dynamic options for each layer (0-3+) |
| 51 | `layerHint` | span | "Select a frame..." | (display only) | Layer editing hint |
| 52 | `gridZoomInput` | input[range] | Grid Zoom | `input` -> updates gridPanelZoom, renderFrameGrid | Range: 0.75-2.5, step 0.25, default 1 |
| 53 | `gridZoomValue` | span | "1x" | (display only) | Shows current grid zoom level |
| 54 | `layerVisibility` | div | (checkboxes) | `change` -> toggles layer visibility | Dynamic checkboxes per layer |
| 55 | `gridPanel` | div | (frame grid) | mousedown/mousemove/click/dblclick/contextmenu/dragstart/dragover/dragleave/drop/dragend | Frame tile grid with drag-select, drag-reorder, context menu |

### Grid Context Menu (`#gridContextMenu`)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 56 | `gridContextMenu` | div | (context menu) | (shown on right-click) | Hidden context menu container |
| 57 | `ctxCopy` | button | Copy Frame | `copySelectedFrameToClipboard()` | Copies selected frame to clipboard |
| 58 | `ctxPaste` | button | Paste Frame | `pasteClipboardToSelectedFrame()` | Pastes clipboard into selected frame |
| 59 | `ctxOpenInspector` | button | Open XP Editor | `openInspectorFromGridContextMenu()` | Opens XP Editor for selected frame |
| 60 | `ctxDelete` | button | Delete | `deleteSelectedFrames()` | Clears selected frame cells |

---

## SECTION 6: LEGACY CHAR GRID (debug)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 61 | `legacyGridDetails` | details | "Legacy Char Grid (debug)" | (collapsible) | Debug-only view of raw character grid |
| 62 | `grid` | div | (char grid) | `dblclick` on cells opens inspector | Grid of individual character cells |

---

## SECTION 7: ANIMATION + METADATA PANEL

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 63 | `animCategorySelect` | select | Row Category | (read by assignRowCategory) | Options: idle, walk, attack, hurt, death, custom |
| 64 | `assignAnimCategoryBtn` | button | Assign Row Category | `assignRowCategory()` | Assigns category to selected row |
| 65 | `frameGroupName` | input[text] | Frame Group Name | (read by assignFrameGroup) | Group name, default "group_1" |
| 66 | `assignFrameGroupBtn` | button | Assign Selected Frames | `assignFrameGroup()` | Assigns selected frames to named group |
| 67 | `applyGroupsToAnimsBtn` | button | Apply Frame Groups to Metadata | `applyGroupsToAnims()` | Updates anims array from frame groups |

### Frame Jitter Sub-section

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 68 | `jitterAlignMode` | select | Align | (read by autoAlignFrameJitter) | Options: Bottom Center, Bottom Left, Top Left, Center |
| 69 | `jitterRefMode` | select | Reference | (read by autoAlignFrameJitter) | Options: First Selected, Median (Selected) |
| 70 | `autoAlignSelectedBtn` | button | Auto Align Selected | `autoAlignFrameJitter(false)` | Aligns selected frames to reference |
| 71 | `autoAlignRowBtn` | button | Auto Align Row | `autoAlignFrameJitter(true)` | Aligns entire row to reference |
| 72 | `jitterRow` | input[number] | Row | `change` -> `jumpSelectionToRow()` | Jump to row, min=0 |
| 73 | `jitterStep` | input[number] | Step | (read by nudge functions) | Nudge step size, min=1, max=16, default=1 |
| 74 | `jitterLeftBtn` | button | left arrow | `nudgeSelectedFrames(-step, 0)` | Nudge selected frames left |
| 75 | `jitterRightBtn` | button | right arrow | `nudgeSelectedFrames(step, 0)` | Nudge selected frames right |
| 76 | `jitterUpBtn` | button | up arrow | `nudgeSelectedFrames(0, -step)` | Nudge selected frames up |
| 77 | `jitterDownBtn` | button | down arrow | `nudgeSelectedFrames(0, step)` | Nudge selected frames down |
| 78 | `jitterInfo` | div | (info text) | (display only) | Shows jitter/alignment info for selected row |
| 79 | `metaOut` | pre | (output) | (display only) | JSON metadata output |

---

## SECTION 8: XP PREVIEW PANEL (left column)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 80 | `playBtn` | button | Play | `startPreview()` | Starts animation preview loop |
| 81 | `stopBtn` | button | Stop | `stopPreview()` | Stops animation preview loop |
| 82 | `fpsInput` | input[number] | FPS | (read by startPreview) | Frame rate, min=1, max=30, default=8 |
| 83 | `previewAngle` | input[number] | Direction | `change` -> `renderPreviewFrame(row, 0)` | Angle/direction index, min=0 |
| 84 | `previewCanvas` | canvas | (preview) | (display only) | 256x256 animation preview canvas |

---

## SECTION 9: SESSION PANEL (right column)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 85 | `sessionOut` | pre | (output) | (display only) | JSON session summary |

---

## SECTION 10: SKIN TEST DOCK PANEL (`#webbuildDockPanel`)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 86 | `webbuildQuickTestBtn` | button | Test This Skin | `testCurrentSkinInDock()` | Full deterministic test: restart + apply skin |
| 87 | `webbuildApplyInPlaceBtn` | button | Apply In Place | `applyCurrentXpAsWebSkin({restart_if_overlay_hidden:false})` | Apply skin without restart (hidden) |
| 88 | `webbuildApplyRestartBtn` | button | Apply + Restart | `applyCurrentXpAsWebSkin({force_restart:true})` | Apply skin with forced restart (hidden) |
| 89 | `webbuildUploadTestBtn` | button | Upload Skin | `onWebbuildUploadTestClick()` | Triggers file picker for external .xp upload |
| 90 | `webbuildUploadTestInput` | input[file] | (hidden file picker) | `change` -> `onWebbuildUploadTestInputChange()` | Accepts .xp files |
| 91 | `webbuildState` | span | "Webbuild not loaded" | (display only) | Shows webbuild runtime status |
| 92 | `webbuildHint` | div | (hint text) | (display only) | Explains skin test dock buttons |
| 93 | `webbuildFrame` | iframe | "Asciicker Webbuild" | `load` -> sets webbuild.loaded, starts readyPoll | Hidden iframe for WASM runtime; 100% wide, 360px tall |

### Advanced Skin Dock Controls (hidden details)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 94 | `webbuildOpenBtn` | button | Open Preview | `openWebbuild()` | Opens flat arena preview in iframe |
| 95 | `webbuildReloadBtn` | button | Reload Preview | `reloadWebbuild()` | Reloads the iframe with fresh URL |
| 96 | `webbuildApplySkinBtn` | button | Apply Current XP (Advanced) | `applyCurrentXpAsWebSkin()` | Advanced skin apply (mounted mode) |
| 97 | `webbuildOut` | pre | (output) | (display only) | Debug JSON output for webbuild operations |

### Runtime Preflight Banner

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 98 | `runtimePreflightBanner` | div | (banner) | (display only) | Warning banner when runtime preflight fails |
| 99 | `runtimePreflightBannerText` | div | (text) | (display only) | Preflight failure details |

---

## SECTION 11: TERM++ NATIVE PANEL (`#termppNativePanel`, hidden)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 100 | `termppBinary` | select | Binary | `change` -> clears termppSkinOut | Options: game_term (TERM++), game (GL game) |
| 101 | `termppSkinCmdBtn` | button | Preview TERM++ Skin Launch | `termppSkinCommandPreview()` | Shows the command that would be run |
| 102 | `termppSkinLaunchBtn` | button | Launch TERM++ SKIN | `launchTermppSkin()` | Launches real game instance with custom skin |
| 103 | `termppStreamX` | input[number] | X | `change` -> `persistTermppStreamRegion()` | Embed region X, min=0, default=0 |
| 104 | `termppStreamY` | input[number] | Y | `change` -> `persistTermppStreamRegion()` | Embed region Y, min=0, default=0 |
| 105 | `termppStreamW` | input[number] | Width | `change` -> `persistTermppStreamRegion()` | Embed region width, min=16, default=960 |
| 106 | `termppStreamH` | input[number] | Height | `change` -> `persistTermppStreamRegion()` | Embed region height, min=16, default=640 |
| 107 | `termppStreamFps` | input[number] | FPS | `change` -> `persistTermppStreamRegion()` | Stream FPS, min=1, max=30, default=4 |
| 108 | `termppStreamPreviewBtn` | button | Preview Embed | `previewTermppEmbedStream()` | Dry-run of embed stream |
| 109 | `termppStreamStartBtn` | button | Start Embed Stream | `startTermppEmbedStream()` | Starts screen capture embed stream |
| 110 | `termppStreamStopBtn` | button | Stop Stream | `stopTermppEmbedStream()` | Stops running embed stream |
| 111 | `termppStreamHint` | div | (hint text) | (display only) | Explains embed stream usage |
| 112 | `termppStreamImg` | img | "TERM++ embed stream" | (display only, refreshed by timer) | Shows captured frames from native window |
| 113 | `termppStreamInfo` | div | (info text) | (display only) | Stream status: running, frame count, last frame time |
| 114 | `termppSkinHint` | div | (hint text) | (display only) | Explains TERM++ skin launch |
| 115 | `termppSkinOut` | pre | (output) | (display only) | JSON output from TERM++ skin operations |

---

## SECTION 12: VERIFICATION PANEL (`#verificationPanel`)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 116 | `verifyProfile` | select | Profile | `change` -> `updateVerifyUI()` | Options: Local XP Sanity, Custom Term++ Command, Legacy verify_e2e.py |
| 117 | `verifyTimeout` | input[number] | Timeout | (read on run) | Timeout in seconds, min=1, max=300, default=20 |
| 118 | `verifyRunBtn` | button | Run Verification | `runWorkbenchVerification(false)` | Runs selected verification profile |
| 119 | `verifyDryRunBtn` | button | Dry Run | `runWorkbenchVerification(true)` | Shows command that would be run |
| 120 | `verifyCommandTemplate` | input[text] | Command Template | `input` -> persists to localStorage | Custom command template with {xp_path} placeholder |
| 121 | `verifyHint` | div | (hint text) | (display only) | Describes selected verification profile |
| 122 | `verifySummaryOut` | pre | (output) | (display only) | Verification result JSON |
| 123 | `verifyLogOut` | pre | (output) | (display only) | Verification stdout/stderr logs |

---

## SECTION 13: EXPORT PANEL

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 124 | `openXpToolBtn` | button | Launch Desktop XP Tool (Optional) | `openInXpTool()` | Launches REXPaint or xp-tool for desktop inspection |
| 125 | `xpToolCommandHint` | span | "Export an `.xp`..." | `click` -> copies command to clipboard | Shows XP tool command, clickable to copy |
| 126 | `exportOut` | pre | (output) | (display only) | Export result JSON |

---

## SECTION 14: XP EDITOR / CELL INSPECTOR PANEL (`#cellInspectorPanel`, hidden)

### Navigation Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 127 | `inspectorDirtyBadge` | span | "saved" | (display only) | Shows edited/saved/saving status |
| 128 | `inspectorCloseBtn` | button | Close | `closeInspector()` | Closes the XP editor panel |
| 129 | `inspectorPrevAngleBtn` | button | Prev Angle | `moveInspectorSelection(-1, 0)` | Navigate to previous angle row |
| 130 | `inspectorNextAngleBtn` | button | Next Angle | `moveInspectorSelection(1, 0)` | Navigate to next angle row |
| 131 | `inspectorPrevFrameBtn` | button | Prev Frame | `moveInspectorSelection(0, -1)` | Navigate to previous frame column |
| 132 | `inspectorNextFrameBtn` | button | Next Frame | `moveInspectorSelection(0, 1)` | Navigate to next frame column |
| 133 | `inspectorZoom` | input[range] | Zoom | `input` -> sets inspectorZoom, renderInspector | Range: 4-28, default 10 |
| 134 | `inspectorZoomValue` | span | "10x" | (display only) | Shows current inspector zoom |

### Tool Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 135 | `inspectorToolInspectBtn` | button | Inspect | sets inspectorTool="inspect" | Click cells to read glyph/fg/bg values |
| 136 | `inspectorToolSelectBtn` | button | Select | sets inspectorTool="select" | Drag rectangle selection |
| 137 | `inspectorToolGlyphBtn` | button | Glyph | sets inspectorTool="glyph" | Click/drag to stamp full XP cells |
| 138 | `inspectorToolPaintBtn` | button | Paint | sets inspectorTool="paint" | Drag to paint half-cells |
| 139 | `inspectorToolEraseBtn` | button | Erase | sets inspectorTool="erase" | Drag to erase half-cells |
| 140 | `inspectorToolDropperBtn` | button | Dropper | sets inspectorTool="dropper" | Click to sample color from half-cell |
| 141 | `inspectorPaintColor` | input[color] | Half Color | `input` -> sets inspectorPaintColor | Half-cell paint color, default #ffffff |

### Glyph Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 142 | `inspectorGlyphCode` | input[number] | Glyph | `input` -> sets inspectorGlyphCode | CP437 code 0-255, default 64 (@) |
| 143 | `inspectorGlyphChar` | input[text] | (char) | `input` -> sets inspectorGlyphCode from charCode | Single character input, default "@" |
| 144 | `inspectorGlyphFgColor` | input[color] | FG | `input` -> sets inspectorGlyphFgColor | Glyph foreground color, default #ffffff |
| 145 | `inspectorGlyphBgColor` | input[color] | BG | `input` -> sets inspectorGlyphBgColor | Glyph background color, default #ff00ff |

### Frame Operations Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 146 | `inspectorCopyFrameBtn` | button | Copy Frame | `copyInspectorFrame()` | Copies entire frame to clipboard |
| 147 | `inspectorPasteFrameBtn` | button | Paste Frame | `pasteInspectorFrame()` | Pastes frame clipboard into current frame |
| 148 | `inspectorFlipHBtn` | button | Flip H | `flipInspectorFrameHorizontal()` | Flips frame horizontally |
| 149 | `inspectorClearFrameBtn` | button | Clear Frame | `clearInspectorFrame()` | Clears entire frame to transparent |
| 150 | `inspectorShowGrid` | checkbox | Grid | `change` -> toggles inspectorShowGrid | Shows/hides cell grid overlay |
| 151 | `inspectorShowChecker` | checkbox | Checker | `change` -> toggles inspectorShowChecker | Shows/hides checker background |

### Selection Operations Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 152 | `inspectorCopySelBtn` | button | Copy Sel | `copyInspectorSelection()` | Copies selection to clipboard |
| 153 | `inspectorPasteSelBtn` | button | Paste Sel | `pasteInspectorSelection()` | Pastes selection clipboard at hover anchor |
| 154 | `inspectorCutSelBtn` | button | Cut Sel | `cutInspectorSelection()` | Copies then clears selection |
| 155 | `inspectorClearSelBtn` | button | Clear Sel | `clearInspectorSelectionCells()` | Clears selected cells to transparent |
| 156 | `inspectorSelectAllBtn` | button | Select All | `inspectorSelectAll()` | Selects entire frame |
| 157 | `inspectorFillSelBtn` | button | Fill Sel | `fillInspectorSelectionWithGlyph()` | Fills selection with current glyph cell |
| 158 | `inspectorReplaceFgBtn` | button | Replace FG | `replaceInspectorSelectionColor("fg")` | Replaces matching FG colors in selection |
| 159 | `inspectorReplaceBgBtn` | button | Replace BG | `replaceInspectorSelectionColor("bg")` | Replaces matching BG colors in selection |

### Transform Operations Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 160 | `inspectorRotateSelCwBtn` | button | Rotate Sel CW | `transformInspectorSelection("rot_cw")` | Rotates selection clockwise |
| 161 | `inspectorRotateSelCcwBtn` | button | Rotate Sel CCW | `transformInspectorSelection("rot_ccw")` | Rotates selection counter-clockwise |
| 162 | `inspectorFlipSelHBtn` | button | Flip Sel H | `transformInspectorSelection("flip_h")` | Flips selection horizontally |
| 163 | `inspectorFlipSelVBtn` | button | Flip Sel V | `transformInspectorSelection("flip_v")` | Flips selection vertically |
| 164 | `inspectorBgTransparentBtn` | button | BG = Transparent | sets inspectorGlyphBgColor to MAGENTA | Resets glyph BG to transparent (magenta) |

### Palette Row

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 165 | `inspectorPaletteSwatches` | div | (swatch buttons) | click -> set paint+FG color; contextmenu -> set BG color | 12 color swatches (black, white, magenta, red, green, blue, yellow, cyan, gray, orange, purple, brown) |

### Info Readouts

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 166 | `inspectorMatchSourceInfo` | div | "Match source: none" | (display only) | Shows last inspected/droppered cell info |
| 167 | `inspectorHoverReadout` | div | "Hover: none" | (display only) | Shows cell under cursor |
| 168 | `inspectorPasteAnchorReadout` | div | "Paste anchor: none" | (display only) | Shows where paste will land |

### Find & Replace (collapsible details)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 169 | `inspectorFindReplaceDetails` | details | "Find & Replace (XP cell)" | (collapsible) | Container for find/replace controls |
| 170 | `inspectorFrMatchGlyphChk` | checkbox | Match Glyph | (read by applyInspectorFindReplace) | Enable glyph matching |
| 171 | `inspectorFrFindGlyph` | input[number] | (find glyph) | (read by applyInspectorFindReplace) | Glyph to find, 0-255, default 0 |
| 172 | `inspectorFrMatchFgChk` | checkbox | Match FG | (read by applyInspectorFindReplace) | Enable FG color matching |
| 173 | `inspectorFrFindFg` | input[color] | (find FG) | (read by applyInspectorFindReplace) | FG color to find, default #ffffff |
| 174 | `inspectorFrMatchBgChk` | checkbox | Match BG | (read by applyInspectorFindReplace) | Enable BG color matching |
| 175 | `inspectorFrFindBg` | input[color] | (find BG) | (read by applyInspectorFindReplace) | BG color to find, default #ff00ff |
| 176 | `inspectorFrReplaceGlyphChk` | checkbox | Replace Glyph | (read by applyInspectorFindReplace) | Enable glyph replacement (default checked) |
| 177 | `inspectorFrReplGlyph` | input[number] | (replace glyph) | (read by applyInspectorFindReplace) | Replacement glyph, 0-255, default 64 |
| 178 | `inspectorFrReplaceFgChk` | checkbox | Replace FG | (read by applyInspectorFindReplace) | Enable FG replacement (default checked) |
| 179 | `inspectorFrReplFg` | input[color] | (replace FG) | (read by applyInspectorFindReplace) | Replacement FG color, default #ffffff |
| 180 | `inspectorFrReplaceBgChk` | checkbox | Replace BG | (read by applyInspectorFindReplace) | Enable BG replacement |
| 181 | `inspectorFrReplBg` | input[color] | (replace BG) | (read by applyInspectorFindReplace) | Replacement BG color, default #ff00ff |
| 182 | `inspectorFrScope` | select | Scope | `change` -> `updateInspectorToolUI()` | Options: Selection, Whole Frame |
| 183 | `inspectorFindReplaceApplyBtn` | button | Apply | `applyInspectorFindReplace()` | Executes find and replace |
| 184 | `inspectorFindReplaceInfo` | div | "Matches all checked..." | (display only) | Find/replace result info |

### Shortcuts (collapsible details)

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 185 | `inspectorShortcutsDetails` | details | "Shortcuts" | (collapsible) | Keyboard shortcut reference |

### Inspector Canvas and Info

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 186 | `inspectorToolHint` | div | (tool description) | (display only) | Describes current tool and available shortcuts |
| 187 | `cellInspectorCanvas` | canvas | (XP editor) | mousedown/mousemove/mouseleave/contextmenu | 320x320 default; zoomed XP cell editor |
| 188 | `cellInspectorInfo` | div | (info text) | (display only) | Shows current row/col/angle/frame/tool/selection state |

---

## SECTION 15: TOP-LEVEL ELEMENTS

| # | ID/Selector | Type | Label/Text | Handler | Description |
|---|------------|------|-----------|---------|-------------|
| 189 | `sessionDirtyBadge` | span | "Session: idle" | (display only) | Top-level session dirty status in h1 |

---

## REXPAINT MANUAL REFERENCE - Full Text

The following is the complete REXPaint v1.70 manual provided as a comprehensive feature reference for implementing the Web REXPaint editor:

=================================================================
 REXPaint v1.70 - Manual
=================================================================

A powerful and user-friendly ASCII art editor.


-----------------------------------------------------------------
 Background
-----------------------------------------------------------------

There are a number of ASCII art editors available on the web, but most suffer from poor usability or small feature sets (one notable exception being eigenbom's awesome fork of ASCII Paint). For development of my own projects, I needed an application equipped with a wide range of tools for quickly drawing and manipulating ASCII art, as well as the ability to easily browse the images created as stored in their native format. Thus REXPaint was born.

Over the years since its first public release, REXPaint has found use as a general purpose ASCII art editor, as well as a roguelike development tool for mockups, mapping, and design. I love seeing what people create with this program, so send me a link/copy if you've made something cool! (Or share it with us on the forums: www.gridsagegames.com/forums/index.php?board=8.0)


-----------------------------------------------------------------
 Features
-----------------------------------------------------------------

An overview of REXPaint's major features:
* Edit characters, foreground, and background colors separately
* Draw shapes and text
* Copy/cut/paste areas
* Undo/redo changes
* Preview effects simply by hovering the cursor over the canvas
* Palette manipulation
* Image-wide color tweaking and palette swaps
* True-color RGB/HSV color picker
* Create multi-layered images
* Zooming: Scale an image by changing font size on the fly
* Custom fonts and support for extended characters and tilesets
* Browse art assets and begin editing at the press of a button
* Images highly compressed
* Export PNGs for use in other programs or on the web
* Import/export .ANS files for ANSI art
* Other exportable formats: TXT, CSV, XML, XPM, BBCode, C:DDA
* Import .TXT files
* Skinnable interface


-----------------------------------------------------------------
 Table of Contents
-----------------------------------------------------------------

* Canvas
    Resizing
    Shifting
* Drawing
    Apply
    Draw Modes
    Text Input
    Preview
    Undo
* Fonts
    Glyphs
    Glyph Swapping
    Custom and Extended Fonts
    Custom Glyph Mirroring
    Custom Unicode Codepoints
* Palettes
    Selection & Editing
    Color Picker
    Palette Files
    Extraction
    Adding
    Organization
    Palette Swapping
    Transparency
* Layers
    Control
    Active Layer
    Order
    Visibility & Locking
    Merging
    Extended Layers Mode
* Browsing
    File/Image Control
    Viewing & Editing
    Saving
    Exporting
* Customization
    Options
    Skins
* Commands
* Appendix A: Known Issues
* Appendix B: .xp Format Specification
* Appendix C: External Libraries and Tools
* Appendix D: ANSI Art (.ans)
* Appendix E: Exportable Text Formats (.txt, .csv., .xml, BBCode)
* Appendix F: Importing Text Files
* Appendix G: Importing PNGs
* Appendix H: Additional Command Line Options
* Appendix I: Exporting ANSI art for C:DDA

-----------------------------------------------------------------
 Canvas
-----------------------------------------------------------------

The black area to the right of the tool menus is the canvas view where all image editing occurs, and the image itself initially appears as a box outline that defaults to the size of the entire canvas view.

 Resizing
----------
Resize the image as necessary (Ctrl-r), ideally before starting to draw so that later changes are not affected by a change in image dimensions. Resizing can be done at any time, but the dimensions are always based from the top-left corner of an image, so make sure the portion of a larger image you wish to retain is based in the top-left corner before shrinking it (move the relevant section with the copy tool).

 Shifting
----------
To view different parts of a large image (or reposition a smaller one), hold spacebar while left-clicking on the image and moving the mouse to drag it (Photoshop style). The numpad can also be used for eight-directional shifting of the image, Enter resets its location, and Ctrl-Enter centers it.


-----------------------------------------------------------------
 Drawing
-----------------------------------------------------------------

 Apply
-------
The apply menu determines what is actually produced by the current draw mode when you left-click on the image. Glyphs (characters), foreground color, and background color are each drawn/edited separately, and can be individually toggled on and off via the menu buttons or 'g', 'f', and 'b'. Thus if you activate "glyph" and deactivate "fore" and "back," when you draw only the current glyph will be applied, while the image's colors remain unchanged. Activating all modes will overwrite the glyph and both foreground and background colors when drawing. (Turning all apply modes off would draw... nothing, and be completely pointless!)
    The colors to be applied are shown to the right of their button, and the current glyph is that highlighted/chosen among the characters in the font box. Change the glyph by left-clicking on a different one in the font box, and change the colors by either left-clicking on the color square (see Color Picker explanation further below) or chosing a color from the palette (LMB choses a color for the foreground, RMB for the background).

 Draw Modes
------------
Drawing modes define the shape and area of the image affected while drawing. Only one mode can be active at a time, and some modes have an alternate setting that changes their behavior (left-click on the active mode to toggle its secondary feature, or cycle through them if more than one).
    Cell ('c'): Applies the effect to a single "cell" (space) on the image. Hold LMB and move the cursor to keep drawing. Alternate mode: Auto-wall/auto-box drawing.
    Line ('l'): Applies the effect to a line. Left-click at the line's start and release the button at its end, or press RMB/ESC before releasing the button to cancel the line.
    Rect ('r'): Applies the effect to a rectangular area. Left-click at one corner of the rectangle and release the button at the opposite corner, or press RMB/ESC before releasing the button to cancel the rectangle. Alternate mode: Fills the entire rectangle instead of drawing an outline.
    Oval ('o'): Like rect mode, but draws ovals. Alternate mode fills the oval. By default ovals are centered on the point chosen; to instead draw from any corner switch the oval drawing method via Alt-o.
    Fill ('i'): Applies the effect to all like cells attached to the one under the cursor. Alternate Mode: Fill search is performed in 8 directions rather than 4.
    Text ('t'): Types text onto the image.
    Copy (Ctrl-c): Copies a rectangular area of the image into the clipboard for later pasting. Alternate mode: Cut (Ctrl-x).
    Paste (Ctrl-v): Paste the clipboard contents to the image. Alternate modes: Flip clipboard contents horizontally, vertically, or both.

 Preview
---------
While the cursor is hovering over the image, applicable draw modes (cell, fill, paste) will show a preview of what the image will look like assuming a left-click at that location.

 Undo
------
All image manipulation actions can be undone/redone (Ctrl-z/Ctrl-y, or just z/y). Undo histories are also saved separately for each image.


-----------------------------------------------------------------
 Fonts
-----------------------------------------------------------------

Images themselves do not store font information, instead remembering only what glyph/character index belongs at each position. This means you can dynamically change the size and/or appearance of an image by simply switching the font (Ctrl-PgUp/Dn or '<'/'>').

 Glyphs
--------
Select a glyph to draw with by clicking on it in the font window. Right-click on a cell in the image to pick up its glyph and colors.
    Toggle highlighting of all used glyphs by pressing 'u'. To see where a specific glyph has been used, hold Alt while hovering over it in the font window.

 Glyph Swapping
----------------
To replace every occurence of a glyph in all visible unlocked layers, Shift-LMB on it in the font window, then Shift-LMB on the new glyph to replace it with.

 Custom and Extended Fonts
---------------------------
By default, both the GUI and images use a standard 256-glyph Code Page 437 font. REXPaint makes this same font available at several sizes. You can edit these fonts (in the "data/fonts/" directory), and/or add new ones by creating a new .png bitmap and listing it in the "data/fonts/_config.xt" text file. Fonts do not require square glyphs (rectangles are okay), but both the GUI and Art font must use the same glyph dimensions.
    Although the default number of rows in a font bitmap is 16, fonts with additional rows are supported, essentially allowing space for an unlimited number of glyphs in an image. Simply specify the proper number of rows available for the relevant art font in _config.xt.


-----------------------------------------------------------------
 Palette
-----------------------------------------------------------------

Palettes in REXPaint are tools intended purely for color selection and organization, thus images themselves do not store palettes (i.e., image colors are not "indexed").

 Selection & Editing
---------------------
Left-clicking on a palette color selects it as the foreground color; right-clicking selects it as the background color. Clicking on the same color again will allow you to edit it in the color picker.

 Color Picker
--------------
Left-click on a color to select it, and click on it again to accept it. Choose a precise color by specifying HSV/RGB number values (click on the number, or press 'h'/'s'/'v'/'r'/'g'/'b').

 Palette Files
---------------
Any number of palettes can be created by clicking on the '+' button (switch between them with the buttons or '['/']' keys). Stored in text format in the "data/palettes/" directory.

 Transparency
--------------
Background color 255,0,255 (hot pink) identifies transparent cells. Draw using the transparent background color to create a transparent cell/area.


-----------------------------------------------------------------
 Layers
-----------------------------------------------------------------

 Control
---------
Each image automatically comes with one base layer (required). More can be created with Ctrl-l or by clicking on the layer window's '+' button. A single image can have up to nine separate layers, and all newly created layers are automatically filled with transparent cells (255,0,255).

 Active Layer
--------------
The "active layer" is the one which effects are applied to when drawing. Change the active layer by clicking on a different number, pressing 1~9, or using the mouse wheel while the cursor is over the canvas area.

 Order
-------
Layers are listed in top to bottom order, and their order determines which are drawn on top. The relative order of layers can be changed by clicking on the arrow buttons.

 Visibility & Locking
----------------------
Individual layers can be hidden from view. Locked layers (Shift-# or the "Lck" button) prevent editing.

 Merging
---------
Use Ctrl-Shift-m to merge the active layer downward.


-----------------------------------------------------------------
 Browsing
-----------------------------------------------------------------

Switch between paint mode and browse mode with Tab. Browse mode allows you to view all the images in the "images/" directory and subdirectories.

 File/Image Control
--------------------
New images: Ctrl-n or New button. Rename (RMB), duplicate (Shift-LMB) and delete (Ctrl-Shift-Alt-LMB).
    Reload all image files: Ctrl-Shift-r or the "R" button.

 Viewing & Editing
-------------------
Images do not need to be explicitly opened. When the program starts, all images are loaded into memory. Browse through them by clicking on their name or pressing up/down.

 Saving
--------
Save with Ctrl-s or the Save button.

 Exporting
-----------
Export PNG: Ctrl-e. Export TXT: Ctrl-t. Export CSV: Ctrl-k. Export ANS: Ctrl-a. Export XML: Ctrl-m. Export XPM: Ctrl-p. Export BBCode: Ctrl-b.


-----------------------------------------------------------------
 Commands
-----------------------------------------------------------------

 Font
------
Ctrl-PgUp/Dn / </>      Change Font (Scale Image/UI)
LMB                     Select Glyph
Arrows                  Shift Selection
u                       Toggle Used Glyph Highlighting
Alt (hold)              Highlight Hovered Glyph in Current Layer
Shift-LMB x2            Swap Occurences of Glyph 1 with Glyph 2

 Palette
---------
[/]                     Change Palette
LMB (x2)                Set (Edit) Foreground Color
RMB (x2)                Set (Edit) Background Color
Shift-LMB x2            Swap Occurences of Color 1 with Color 2
Ctrl-Shift-o            Organize Palette
Ctrl-Shift-e            Extract Image Palette
Ctrl-Shift-p            Purge Unused Colors
Ctrl-LMB x2             Swap Palette Colors

 Drawing
---------
c (x2)                  Cell (Auto-walls)
l                       Line
r (x2)                  Rectangle (Filled)
o (x2)                  Oval (Filled)
Alt-o                   Toggle oval drawing method (center/corner)
i (x2)                  Fill (8-direction)
t                       Text
Ctrl-c                  Copy
Ctrl-x                  Cut
Ctrl-v (x2)             Paste (Flip)
ESC / RMB               Stop/Cancel

 Text Tool
-----------
Enter                   Confirm
Ctrl-Enter              New line below
Escape                  Cancel
Left/Right Arrow        Move caret
Backspace               Delete before caret
Delete                  Delete at caret
Up/Down                 Cycle text history
Ctrl-v                  Paste from clipboard

 Apply
-------
g (G)                   Toggle (Solo) Glyph
f (F)                   Toggle (Solo) Foreground Color
b (B)                   Toggle (Solo) Background Color
RMB                     Add Color to Palette
Alt-w                   Swap Foreground/Background Colors
d                       Increment Copy/Cut/Paste Layer Depth

 Canvas
--------
Spacebar (hold)         Enter Drag Mode
LMB                     Hold Canvas to Drag
RMB                     Copy Cell Contents (Applied Modes Only)
Shift/Alt (hold)        Hide Preview
z/Ctrl-z                Undo
y/Ctrl-y                Redo
Ctrl-d                  Toggle Rect Dimension Display
Ctrl-g                  Toggle Grid
Ctrl-Tab                Switch between current/latest image
Ctrl-Up/Down            Edit Previous/Next Image

 Layers
--------
Ctrl-l                  New Layer
Wheel                   Cycle Active Layer
1~9                     Activate Layer
Ctrl-1~9                Toggle Layer Hide
Shift-1~9               Toggle Layer Lock
Ctrl-Shift-m            Merge Active Layer
Ctrl-Shift-l            Toggle Extended Layers Mode

 Browse
--------
Wheel / PgUp/Dn         Scroll List
LMB                     View Image
Up/Down                 View Previous/Next Image
RMB                     Rename Image
Shift-LMB               Duplicate Image
Ctrl-Shift-Alt-LMB      Delete Image
Ctrl-Shift-r            Reload All Image Files
Home/End                First/Last Image

 Image
-------
Ctrl-n                  New (in Base Path)
Ctrl-r                  Resize
Ctrl-s                  Save
Ctrl-e                  Export PNG
Ctrl-t                  Export TXT
Ctrl-k                  Export CSV
Ctrl-a                  Export ANS
Ctrl-m                  Export XML
Ctrl-p                  Export XPM
Ctrl-b                  Export BBCode

 General
---------
Tab                     Toggle Paint/Browse
F1 / ?                  Commands
F3                      Options
F4                      Change Skin
Alt-F4                  Exit
Alt-Enter               Fullscreen


-----------------------------------------------------------------
 Appendix B: .xp Format Specification
-----------------------------------------------------------------

The .xp files are deflated with zlib (gzipped); once decompressed the format is binary:

#-----xp format version (32)
A-----number of layers (32)
 /----image width (32)
 |    image height (32)
 |  /-ASCII code (32) (little-endian!)
B|  | foreground color red (8)
 |  | foreground color green (8)
 |  | foreground color blue (8)
 | C| background color red (8)
 |  | background color green (8)
 \--\-background color blue (8)

Data stored in column-major order. Transparent cells identified by background color 255,0,255.


-----------------------------------------------------------------
 Appendix H: Additional Command Line Options
-----------------------------------------------------------------

 Exporting PNGs
----------------
-exportAll              Export every .xp file as PNG
-export:XXX             Export individual .xp file as PNG

 Creating/Opening Images
-------------------------
-create:XXX             Create new .xp file
-open:XXX               Open REXPaint with .xp file preselected
-txt2xp:XXX             Convert .txt file to .xp
-png2xp:XXX             Convert .png file to .xp (filename must include _WWWxHHH)
-uniqueGlyphs           Use unique glyphs for different characters in png2xp


-----------------------------------------------------------------
 Key Configuration Reference
-----------------------------------------------------------------

REXPaint.cfg options:
* unlimitedFontSize: Load all fonts even if too large for screen
* txtOutputUTF8: UTF8 encoding for TXT export
* baseImagePath: Base path for image loading (relative to .exe)
* exportsToBase: Export to base path vs source subdirectory
* ignorePath: Paths to exclude from browser
* ansiMode: Enable ANSI art restrictions
* fontKeyColorOverride: Override font background color detection
* glyphScrollRowCount: Mouse scroll rate for glyph area
* glyphSelectAlwaysAutoscrolls: Auto-scroll to selected glyph
* noSaveForOutOfBoundsGlyphs: Block saving images with OOB glyphs
* ansOutputNoCursorShift: Disable cursor shift in ANS export

---

## EVENT LISTENERS MASTER LIST

### Button Click Events (76 total)

1. `btnLoad` click -> `loadFromJob()`
2. `btnExport` click -> `exportXp()`
3. `openXpToolBtn` click -> `openInXpTool()`
4. `webbuildOpenBtn` click -> `openWebbuild()`
5. `webbuildReloadBtn` click -> `reloadWebbuild()`
6. `webbuildApplySkinBtn` click -> `applyCurrentXpAsWebSkin()`
7. `webbuildApplyInPlaceBtn` click -> `applyCurrentXpAsWebSkin({restart_if_overlay_hidden:false})`
8. `webbuildApplyRestartBtn` click -> `applyCurrentXpAsWebSkin({force_restart:true})`
9. `webbuildQuickTestBtn` click -> `testCurrentSkinInDock()`
10. `webbuildUploadTestBtn` click -> `onWebbuildUploadTestClick()`
11. `termppSkinCmdBtn` click -> `termppSkinCommandPreview()`
12. `termppSkinLaunchBtn` click -> `launchTermppSkin()`
13. `termppStreamPreviewBtn` click -> `previewTermppEmbedStream()`
14. `termppStreamStartBtn` click -> `startTermppEmbedStream()`
15. `termppStreamStopBtn` click -> `stopTermppEmbedStream()`
16. `verifyRunBtn` click -> `runWorkbenchVerification(false)`
17. `verifyDryRunBtn` click -> `runWorkbenchVerification(true)`
18. `undoBtn` click -> `undo()`
19. `redoBtn` click -> `redo()`
20. `templateApplyBtn` click -> `applyTemplate()`
21. `wbUpload` click -> `wbUpload()`
22. `wbAnalyze` click -> `wbAnalyze()`
23. `wbRun` click -> `wbRun()`
24. `sourceSelectBtn` click -> `setSourceMode("select")`
25. `drawBoxBtn` click -> `setSourceMode("draw_box")`
26. `rowSelectBtn` click -> `setSourceMode("row_select")`
27. `colSelectBtn` click -> `setSourceMode("col_select")`
28. `cutVBtn` click -> `setSourceMode("cut_v")`
29. `deleteBoxBtn` click -> delete selection or clear all
30. `extractBtn` click -> `findSprites()` + save
31. `srcCtxAddSprite` click -> `commitDraftToSource("manual")`
32. `srcCtxAddToRow` click -> `addSourceBoxToSelectedRowSequence()`
33. `srcCtxSetAnchor` click -> `setAnchorFromTarget()`
34. `srcCtxPadAnchor` click -> `applyPadToContextTarget()`
35. `srcCtxDelete` click -> `deleteSourceTarget()`
36. `deleteCellBtn` click -> `deleteSelectedFrames()`
37. `ctxCopy` click -> `copySelectedFrameToClipboard()`
38. `ctxPaste` click -> `pasteClipboardToSelectedFrame()`
39. `ctxOpenInspector` click -> `openInspectorFromGridContextMenu()`
40. `ctxDelete` click -> `deleteSelectedFrames()`
41. `rowUpBtn` click -> `moveSelectedRow(-1)`
42. `rowDownBtn` click -> `moveSelectedRow(1)`
43. `colLeftBtn` click -> `moveSelectedCols(-1)`
44. `colRightBtn` click -> `moveSelectedCols(1)`
45. `addFrameBtn` click -> `addGridFrameSlot()`
46. `openInspectorBtn` click -> `openInspectorForSelectedFrame()`
47. `assignAnimCategoryBtn` click -> `assignRowCategory()`
48. `assignFrameGroupBtn` click -> `assignFrameGroup()`
49. `applyGroupsToAnimsBtn` click -> `applyGroupsToAnims()`
50. `autoAlignSelectedBtn` click -> `autoAlignFrameJitter(false)`
51. `autoAlignRowBtn` click -> `autoAlignFrameJitter(true)`
52. `jitterLeftBtn` click -> `nudgeSelectedFrames(-step, 0)`
53. `jitterRightBtn` click -> `nudgeSelectedFrames(step, 0)`
54. `jitterUpBtn` click -> `nudgeSelectedFrames(0, -step)`
55. `jitterDownBtn` click -> `nudgeSelectedFrames(0, step)`
56. `playBtn` click -> `startPreview()`
57. `stopBtn` click -> `stopPreview()`
58. `inspectorCloseBtn` click -> `closeInspector()`
59. `inspectorPrevAngleBtn` click -> `moveInspectorSelection(-1, 0)`
60. `inspectorNextAngleBtn` click -> `moveInspectorSelection(1, 0)`
61. `inspectorPrevFrameBtn` click -> `moveInspectorSelection(0, -1)`
62. `inspectorNextFrameBtn` click -> `moveInspectorSelection(0, 1)`
63. `inspectorToolInspectBtn` click -> set tool "inspect"
64. `inspectorToolSelectBtn` click -> set tool "select"
65. `inspectorToolGlyphBtn` click -> set tool "glyph"
66. `inspectorToolPaintBtn` click -> set tool "paint"
67. `inspectorToolEraseBtn` click -> set tool "erase"
68. `inspectorToolDropperBtn` click -> set tool "dropper"
69. `inspectorCopyFrameBtn` click -> `copyInspectorFrame()`
70. `inspectorPasteFrameBtn` click -> `pasteInspectorFrame()`
71. `inspectorFlipHBtn` click -> `flipInspectorFrameHorizontal()`
72. `inspectorClearFrameBtn` click -> `clearInspectorFrame()`
73. `inspectorCopySelBtn` click -> `copyInspectorSelection()`
74. `inspectorPasteSelBtn` click -> `pasteInspectorSelection()`
75. `inspectorCutSelBtn` click -> `cutInspectorSelection()`
76. `inspectorClearSelBtn` click -> `clearInspectorSelectionCells()`
77. `inspectorSelectAllBtn` click -> `inspectorSelectAll()`
78. `inspectorFillSelBtn` click -> `fillInspectorSelectionWithGlyph()`
79. `inspectorReplaceFgBtn` click -> `replaceInspectorSelectionColor("fg")`
80. `inspectorReplaceBgBtn` click -> `replaceInspectorSelectionColor("bg")`
81. `inspectorRotateSelCwBtn` click -> `transformInspectorSelection("rot_cw")`
82. `inspectorRotateSelCcwBtn` click -> `transformInspectorSelection("rot_ccw")`
83. `inspectorFlipSelHBtn` click -> `transformInspectorSelection("flip_h")`
84. `inspectorFlipSelVBtn` click -> `transformInspectorSelection("flip_v")`
85. `inspectorBgTransparentBtn` click -> set BG to MAGENTA
86. `inspectorFindReplaceApplyBtn` click -> `applyInspectorFindReplace()`
87. `xpToolCommandHint` click -> copies command to clipboard

### Change Events (15 total)

88. `wbFile` change -> load source image
89. `webbuildUploadTestInput` change -> `onWebbuildUploadTestInputChange()`
90. `termppBinary` change -> clear output
91. `termppStreamX` change -> `persistTermppStreamRegion()`
92. `termppStreamY` change -> `persistTermppStreamRegion()`
93. `termppStreamW` change -> `persistTermppStreamRegion()`
94. `termppStreamH` change -> `persistTermppStreamRegion()`
95. `termppStreamFps` change -> `persistTermppStreamRegion()`
96. `verifyProfile` change -> `updateVerifyUI()`
97. `rapidManualAdd` change -> toggle rapidManualAdd
98. `layerSelect` change -> set activeLayer
99. `layerVisibility` change (delegation) -> toggle layer visibility
100. `previewAngle` change -> renderPreviewFrame
101. `inspectorShowGrid` change -> toggle grid overlay
102. `inspectorShowChecker` change -> toggle checker background
103. `inspectorFrScope` change -> `updateInspectorToolUI()`
104. `jitterRow` change -> `jumpSelectionToRow()`

### Input Events (8 total)

105. `sourceZoomInput` input -> update source canvas zoom
106. `gridZoomInput` input -> update grid panel zoom
107. `inspectorZoom` input -> update inspector zoom
108. `inspectorPaintColor` input -> set paint color
109. `inspectorGlyphCode` input -> set glyph code
110. `inspectorGlyphChar` input -> set glyph from character
111. `inspectorGlyphFgColor` input -> set glyph FG color
112. `inspectorGlyphBgColor` input -> set glyph BG color
113. `verifyCommandTemplate` input -> persist to localStorage

### Mouse Events on Canvas/Panel (16 total)

114. `sourceCanvas` mousedown -> `onSourceMouseDown()`
115. `sourceCanvas` mousemove -> `onSourceMouseMove()`
116. `sourceCanvas` mouseup -> `onSourceMouseUp()`
117. `sourceCanvas` contextmenu -> show source context menu
118. `cellInspectorCanvas` mousedown -> tool-dependent action (paint/erase/glyph/select/inspect/dropper)
119. `cellInspectorCanvas` mousemove -> continue painting/selecting, update hover
120. `cellInspectorCanvas` mouseleave -> clear hover
121. `cellInspectorCanvas` contextmenu -> preventDefault (right-click samples)
122. `gridPanel` mousedown -> cell drag-start or frame select
123. `gridPanel` mousemove -> cell drag or frame drag-select
124. `gridPanel` click -> frame select or row header select
125. `gridPanel` dblclick -> open inspector for frame
126. `gridPanel` contextmenu -> show grid context menu
127. `gridPanel` dragstart -> row drag initiate
128. `gridPanel` dragover -> row drag hover
129. `gridPanel` dragleave -> clear drag target
130. `gridPanel` drop -> `moveRowToIndex()`
131. `gridPanel` dragend -> clear drag state
132. `grid` (legacy) dblclick -> open inspector

### Window-level Events (6 total)

133. `window` mouseup -> end source drag, end inspector painting/selecting, end grid cell drag
134. `window` keydown -> keyboard shortcuts (see below)
135. `window` beforeunload -> `stopTermppStreamPolling()`
136. `window` beforeunload -> `stopWebbuildReadyPoll()`
137. `document` click -> hide context menus

### Iframe Events (1 total)

138. `webbuildFrame` load -> set webbuild.loaded, start readyPoll

### Dynamic Events (palette swatches, ~24)

139-162. 12 palette swatch buttons x 2 events each (click -> set paint+FG color, contextmenu -> set BG color)

---

## KEYBOARD SHORTCUTS

### Global (window keydown)

| Key | Condition | Action |
|-----|-----------|--------|
| `Ctrl/Cmd+Z` | Not in input field | `undo()` |
| `Ctrl/Cmd+Y` | Not in input field | `redo()` |
| `Delete` | Inspector open | Clear selection or clear frame |
| `Delete` | Source objects selected | Delete source objects |
| `Delete` | Grid frames selected | Delete selected frames |
| `Escape` | Inspector open + selection | Clear selection |
| `Escape` | Inspector open | Close inspector |
| `Escape` | Source drag active | Cancel drag |
| `Escape` | Nothing active | Deselect all |
| `V` | No modifiers | `setSourceMode("select")` |
| `B` | No modifiers | `setSourceMode("draw_box")` |
| `R` | No modifiers, inspector closed | `setSourceMode("row_select")` |
| `C` | No modifiers, inspector closed | `setSourceMode("col_select")` |
| `X` | No modifiers, inspector closed | `setSourceMode("cut_v")` |
| `W/A/S/D` | No modifiers | Nudge selected frames (step from jitterStep) |
| `Shift+W/A/S/D` | No modifiers | Nudge selected frames (step=10) |
| `Enter` | Draft box exists | `commitDraftToSource("manual")` |
| `Arrow keys` | No modifiers | Nudge source box or draft box (1px) |
| `Shift+Arrow keys` | No modifiers | Nudge source box or draft box (10px) |
| `Alt+Arrow keys` | No modifiers | Nudge selected grid frames |
| `Alt+Shift+Arrow keys` | No modifiers | Nudge selected grid frames (step=10) |

### Inspector-only (when inspector is open)

| Key | Condition | Action |
|-----|-----------|--------|
| `Ctrl/Cmd+C` | Inspector open | Copy selection or frame |
| `Ctrl/Cmd+X` | Inspector open | Cut selection |
| `Ctrl/Cmd+V` | Inspector open | Paste selection or frame |
| `Ctrl/Cmd+A` | Inspector open | Select all |
| `P` | Inspector open, no modifiers | Set tool to Paint |
| `G` | Inspector open, no modifiers | Set tool to Glyph |
| `S` | Inspector open, no modifiers | Set tool to Select |
| `E` | Inspector open, no modifiers | Set tool to Erase |
| `I` | Inspector open, no modifiers | Set tool to Dropper |
| `Q` | Inspector open, no modifiers | Previous angle (move up) |
| `R` | Inspector open, no modifiers | Next angle (move down) |
| `A` | Inspector open, no modifiers | Previous frame (move left) |
| `D` | Inspector open, no modifiers | Next frame (move right) |
| `C` | Inspector open, no modifiers | Copy selection or frame |
| `X` | Inspector open, no modifiers | Cut selection |
| `V` | Inspector open, no modifiers | Paste selection or frame |
| `F` | Inspector open, no modifiers | Flip frame horizontal |
| `]` | Inspector open, no modifiers | Rotate selection CW |
| `[` | Inspector open, no modifiers | Rotate selection CCW |

---

## CANVASES SUMMARY (3 total)

| Canvas | Default Size | Renders | Interaction |
|--------|-------------|---------|-------------|
| `sourceCanvas` | 576x320 | Source PNG with sprite boxes, cuts, drafts, anchor | mousedown/move/up for box drawing/selecting/dragging; contextmenu for sprite actions |
| `previewCanvas` | 256x256 | Animated XP frame preview | Display only (play/stop buttons control animation) |
| `cellInspectorCanvas` | 320x320 | Zoomed XP cell editor with grid overlay | mousedown for tool actions (paint/erase/glyph/select/inspect/dropper); mousemove for drag painting/selecting; contextmenu for sampling |

---

## DROPDOWNS/SELECTS SUMMARY (8 total)

| Select | Options | Controls |
|--------|---------|----------|
| `templateSelect` | player_native_idle_only, player_native_full | Template set for bundle creation |
| `layerSelect` | Dynamic (0-N layers) | Active editing layer |
| `animCategorySelect` | idle, walk, attack, hurt, death, custom | Row animation category |
| `jitterAlignMode` | bottom_center, bottom_left, top_left, center | Frame alignment reference point |
| `jitterRefMode` | first_selected, median | Alignment reference frame |
| `termppBinary` | game_term, game | Native binary to launch |
| `verifyProfile` | local_xp_sanity, termpp_custom, legacy_verify_e2e | Verification profile |
| `inspectorFrScope` | selection, frame | Find/replace scope |

---

## SLIDERS/RANGE INPUTS SUMMARY (3 total)

| Slider | Min | Max | Step | Default | Controls |
|--------|-----|-----|------|---------|----------|
| `sourceZoomInput` | 1 | 6 | 0.5 | 1 | Source canvas zoom multiplier |
| `gridZoomInput` | 0.75 | 2.5 | 0.25 | 1 | Grid panel tile size multiplier |
| `inspectorZoom` | 4 | 28 | 1 | 10 | XP editor pixel zoom |

---

## CHECKBOXES SUMMARY (9 total)

| Checkbox | Default | Toggles |
|----------|---------|---------|
| `rapidManualAdd` | unchecked | Auto-commit drafts on new draw |
| `inspectorShowGrid` | checked | Cell grid overlay on inspector |
| `inspectorShowChecker` | unchecked | Checkerboard background on inspector |
| `inspectorFrMatchGlyphChk` | unchecked | Match glyph in find/replace |
| `inspectorFrMatchFgChk` | unchecked | Match FG color in find/replace |
| `inspectorFrMatchBgChk` | unchecked | Match BG color in find/replace |
| `inspectorFrReplaceGlyphChk` | checked | Replace glyph in find/replace |
| `inspectorFrReplaceFgChk` | checked | Replace FG color in find/replace |
| `inspectorFrReplaceBgChk` | unchecked | Replace BG color in find/replace |

---

## MODALS/DIALOGS SUMMARY (0 true modals, 2 context menus)

| Menu | Trigger | Items | Actions |
|------|---------|-------|---------|
| `sourceContextMenu` | Right-click on source canvas (box/draft/cut) | Add as 1 sprite, Add to selected row sequence, Set as anchor, Pad to anchor, Delete | Various source manipulation functions |
| `gridContextMenu` | Right-click on grid frame cell | Copy Frame, Paste Frame, Open XP Editor, Delete | Frame clipboard and inspector operations |

---

## DEBUG API (`window.__wb_debug`)

The JS exposes a comprehensive debug API at `window.__wb_debug` with these methods:
- `getState()` - Full workbench state snapshot
- `getWebbuildDebugState()` - Webbuild iframe debug state
- `openWebbuild(forceFresh)` - Programmatic webbuild open
- `testSkinDock()` - Programmatic skin test
- `openInspector(row, col)` - Programmatic inspector open
- `commitDraftSource()` - Commit draft box
- `selectSourceBoxes(ids)` - Select source boxes by ID
- `addSourceBoxToSelectedRowById(id)` - Insert source box into grid
- `getInspectorState()` - Full inspector state
- `setInspectorSelection(sel)` - Set inspector selection
- `setInspectorHoverAnchor(cx, cy, half)` - Set hover anchor
- `clearInspectorHover()` - Clear hover
- `sampleInspectorCell(cx, cy)` - Sample cell values
- `setInspectorGlyphCell(payload)` - Set glyph/colors
- `setInspectorFindReplace(cfg)` - Configure find/replace
- `runInspectorAction(name, arg)` - Run inspector action by name
- `readFrameCell(row, col, cx, cy)` - Read single cell
- `writeFrameCell(row, col, cx, cy, payload)` - Write single cell
- `readFrameRect(row, col, x1, y1, x2, y2)` - Read cell rectangle
- `frameSignature(row, col)` - Get frame content hash
