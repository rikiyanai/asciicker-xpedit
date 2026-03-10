# User Request API Test Checklist

**Purpose:** Live E2E testing scenarios for REXPaint editor and sprite conversion pipeline
**Test Framework:** Playwright with `--headed` flag (visible browser testing)
**CLI Command:** `node scripts/ui_tests/runner/cli.mjs test:e2e --headed --feature [feature-name]`

---

## Category A: Basic Sprite Editing Requests

These requests test fundamental editing workflows in the REXPaint editor.

### Request A1: "Add a hat to the base player"

**User intent:** Edit existing sprite to add new glyph element

**Test steps:**
1. Load player-0000.xp (idle base) from fixtures
2. Activate Layer 2 (visual layer)
3. Select head area (cells x:10-15, y:3-8)
4. Pick glyph 42 (asterisk) or 94 (caret)
5. Apply green color (FG = [0, 255, 0])
6. Paint hat glyphs on top of head
7. Undo 2x, verify hat removed
8. Redo 2x, verify hat restored
9. Save as .xp file
10. Reload file, verify hat persists

**Expected outcome:** Hatted player sprite saved correctly

**API calls used:**
- `EditorApp.loadXPFile()`
- `EditorApp.activateLayer(2)`
- `EditorApp.selectTool(selectTool)`
- `EditorApp.setGlyph(42)`
- `EditorApp.setForegroundColor([0, 255, 0])`
- `CellTool.paint(x, y)` (multiple cells)
- `EditorApp.undo()` / `redo()`
- `EditorApp.saveAsXP()`

**Test file:** `tests/web/rexpaint-editor-user-request-hat.test.js`

---

### Request A2: "Create attack animation for new variant sprite"

**User intent:** Convert static sprite to multi-frame animation

**Test steps:**
1. Load placeholder sprite PNG (144×80 for attack action)
2. Create new bundle session with player_native_full template
3. Switch to attack action tab
4. Upload PNG → Analyze (detects 8 angles × 8 frames)
5. Convert to XP via pipeline
6. Open editor on attack action
7. Select frames 1, 3, 5 (alternate frames)
8. Apply dodge effect (shift glyphs slightly, change color intensity)
9. Switch back to idle, verify unchanged
10. Export bundle, verify attack action included

**Expected outcome:** Multi-frame attack animation with idle unchanged

**API calls used:**
- `EditorApp.setActionContext('attack')`
- `EditorApp.loadXPFile()` (bundle mode)
- `EditorApp.selectMultipleCells([...])`
- `LineTool.draw()` (dodge lines on glyphs)
- `EditorApp.setActionContext('idle')`
- `EditorApp.exportBundle()`

**Test file:** `tests/web/rexpaint-editor-user-request-animation.test.js`

---

### Request A3: "Convert this sprite sheet"

**User intent:** Batch pipeline conversion from PNG to XP

**Test steps:**
1. Upload PNG (typical spritesheet: 560×400)
2. Auto-detect sprites via findSprites() (should find 4-8 sprites)
3. Verify bounding boxes with threshold=48
4. For each sprite:
   - Set as anchor
   - Pad to anchor dimensions
   - Confirm in grid
5. Run pipeline: angles=8, frames=[1,8], renderRes=12
6. Download XP file
7. Reload XP, verify structure
8. Validate engine constraints (dims, layer count)

**Expected outcome:** Valid XP file with correct dimensions and metadata

**API calls used:**
- `uploadFile(png)`
- `analyzeSource()` (threshold, minSize)
- `findSprites()`
- `commitDraftToSource()`
- `runPipeline()`
- `exportXp()`
- `validateConstraints()`

**Test file:** `tests/web/rexpaint-editor-user-request-convert.test.js`

---

## Category B: Complex Editing Workflows

### Request B1: "Recolor the entire sprite to grayscale"

**User intent:** Batch color operation across all layers

**Test steps:**
1. Load multi-layer sprite (4 layers)
2. Open color swap dialog
3. For each color in palette:
   - Calculate grayscale equivalent (R+G+B)/3
   - Replace all instances with grayscale
4. Verify all layers updated
5. Undo 1x (should revert all color swaps)
6. Save, reload, verify grayscale persists

**Expected outcome:** Fully grayscale sprite with correct layer structure

**API calls used:**
- `EditorApp.loadXPFile()`
- `EditorApp.readRegion()` (each layer)
- `Palette.getColors()`
- `EditorApp.replaceColor(oldColor, newGrayscale)` (batch for visible layers)
- `EditorApp.saveAsXP()`

**Test file:** `tests/web/rexpaint-editor-user-request-grayscale.test.js`

---

### Request B2: "Copy the head from sprite A and paste into sprite B"

**User intent:** Cross-sprite editing with selection management

**Test steps:**
1. Load sprite-A.xp (source)
2. Select head region (marching ants outline)
3. Copy selection (Ctrl+C)
4. Close sprite A
5. Load sprite-B.xp (target)
6. Place cursor at (5, 2)
7. Paste (Ctrl+V), see paste preview
8. Confirm placement
9. Save sprite-B
10. Reload, verify head from A present in B

**Expected outcome:** Head from A successfully integrated into B

**API calls used:**
- `EditorApp.loadXPFile(spriteA)`
- `SelectTool.select(x1, y1, x2, y2)`
- `EditorApp.copy()`
- `EditorApp.loadXPFile(spriteB)` (or switch in multi-tab mode)
- `EditorApp.placePasteCursor(x, y)`
- `EditorApp.commitPaste()`
- `EditorApp.saveAsXP()`

**Test file:** `tests/web/rexpaint-editor-user-request-paste-xsprite.test.js`

---

### Request B3: "Extract and reuse the palette from this sprite"

**User intent:** Palette management and extraction

**Test steps:**
1. Load sprite with custom palette
2. Select all (Ctrl+A)
3. Extract palette (Ctrl+Shift+E)
4. Verify palette panel shows all 8 unique colors
5. Save palette as "custom_palette.json"
6. Load new blank sprite
7. Import saved palette
8. Paint with imported colors
9. Save new sprite
10. Verify colors match original palette

**Expected outcome:** Palette extracted, saved, and reapplied correctly

**API calls used:**
- `EditorApp.loadXPFile()`
- `EditorApp.selectAll()`
- `EditorApp.extractPalette()`
- `Palette.save(filename)`
- `EditorApp.loadXPFile()` (new blank)
- `Palette.load(filename)`
- `EditorApp.saveAsXP()`

**Test file:** `tests/web/rexpaint-editor-user-request-palette-extract.test.js`

---

## Category C: Constraint Validation & Error Handling

### Request C1: "Resize the canvas to fit my new design"

**User intent:** Canvas resize with boundary preservation

**Test steps:**
1. Load sprite (126×80)
2. Open canvas resize dialog
3. Attempt invalid resize (0×0) → verify error message
4. Resize to 140×100 (expand)
5. Verify content centered in new canvas
6. Paint in new empty areas
7. Resize to 100×60 (shrink) → verify warning about clipping
8. Confirm shrink, verify content at top-left clipped
9. Save and verify dimensions in XP metadata

**Expected outcome:** Canvas resizes correctly, respects engine constraints in bundle mode

**API calls used:**
- `EditorApp.loadXPFile()`
- `EditorApp.resizeCanvas(newW, newH)`
- `EditorApp.validateDimensions(w, h)` (should reject invalid, warn on shrink)
- `EditorApp.saveAsXP()`

**Test file:** `tests/web/rexpaint-editor-user-request-resize.test.js`

---

### Request C2: "Save this sprite as a new action in the bundle"

**User intent:** Multi-action bundle management

**Test steps:**
1. In bundle mode, currently editing idle action
2. Create new sprite/edit (or upload new PNG for death action)
3. Switch to death action tab (should show empty or placeholder)
4. Upload death sprite PNG
5. Convert to XP
6. Edit death action sprite
7. Switch between idle/attack/death tabs 3 times
8. Export bundle
9. Verify all 3 actions present in export
10. Validate bundle structure with gate checks (G10, G11, G12)

**Expected outcome:** Bundle successfully exports with all 3 actions, each with correct dims/layers/metadata

**API calls used:**
- `EditorApp.setActionContext('death')`
- `EditorApp.loadXPFile()` (death action)
- `EditorApp.setActionContext('idle')` (switch tabs)
- `EditorApp.exportBundle()`
- `EditorApp.validateStructuralGates()` (G10, G11, G12)

**Test file:** `tests/web/rexpaint-editor-user-request-bundle-multi-action.test.js`

---

## Category D: Pipeline Integration & Conversion

### Request D1: "Convert sprite sheet with custom frame layout"

**User intent:** Pipeline with non-standard dimensions and frame counts

**Test steps:**
1. Upload PNG (500×600, non-standard)
2. Manually specify:
   - Angles: 4
   - Frames: [2, 4, 3] (3 animation sequences)
   - Source projs: 2 (stereo)
   - Render res: 14
3. Run pipeline conversion
4. Verify output XP has correct dims and L0 metadata
5. Load in editor, verify all frames load
6. Play animation preview (4 angles × frame sequence cycles)
7. Export and validate

**Expected outcome:** Custom frame layout converted and playable

**API calls used:**
- `uploadFile(png)`
- `runPipeline({angles, frames, sourceProjs, renderRes})`
- `EditorApp.loadXPFile()`
- `EditorApp.readLayerRegion()` (verify cell count)
- `EditorApp.playAnimation()` (preview)
- `EditorApp.exportXp()`

**Test file:** `tests/web/rexpaint-editor-user-request-custom-frames.test.js`

---

### Request D2: "Verify the converted sprite matches engine constraints"

**User intent:** QA validation before release

**Test steps:**
1. Load converted XP file
2. Check dimensions match template (family-specific):
   - Player idle: 126×80
   - Player attack: 144×80
   - Player death: 110×88
3. Verify layer count (4 layers minimum)
4. Verify L0 metadata readable:
   - Cell(0,0) = angle count (e.g., 8)
   - Cell(1,0), Cell(2,0), ... = frame counts
5. Run gate validations:
   - G10: Dimensions match family spec
   - G11: Layer count matches (4 for idle/attack, 3 for death)
   - G12: L0 metadata glyph sequence matches family pattern
6. Check all cells in range [0-255] for glyph values
7. Verify transparent color (255,0,255) handled correctly

**Expected outcome:** All gates pass, sprite ready for WASM injection

**API calls used:**
- `EditorApp.loadXPFile()`
- `EditorApp.readLayerRegion(0, 0, 0, 10, 10)` (L0 metadata)
- `EditorApp.validateStructuralGates(bundleId)`
- `EditorApp.inspect()` (payload summary)

**Test file:** `tests/web/rexpaint-editor-user-request-validation-gates.test.js`

---

## Category E: Performance & Stress Tests

### Request E1: "Edit a large sprite (126×80 @ 28x zoom) without lag"

**User intent:** Performance under heavy load

**Test steps:**
1. Load 126×80 sprite
2. Set zoom to 28x
3. Rapid paint operations:
   - Click 50 random cells at 100ms intervals
   - Fill large region (40×20 area)
   - Pan canvas while dragging line tool
4. Measure time per operation (target: <50ms)
5. Verify no frame drops (60fps maintained)
6. Undo stack survives 50 operations
7. Save performance baseline

**Expected outcome:** <50ms per operation, 60fps maintained, no memory leaks

**API calls used:**
- `EditorApp.setZoom(28)`
- `CellTool.paint()` (50x rapid)
- `FillTool.fill()`
- Canvas pan
- `EditorApp.undo()` (stress test stack)

**Test file:** `tests/web/rexpaint-editor-user-request-perf-large-sprite.test.js`

---

### Request E2: "Undo 50 edits without losing data"

**User intent:** Undo stack robustness

**Test steps:**
1. Load sprite
2. Make 50 distinct edits:
   - Paint cells (various positions)
   - Fill regions
   - Layer switches
   - Color changes
3. Undo all 50 → verify back to original
4. Redo all 50 → verify matches step 2
5. Undo 25, then make new edit → verify redo stack cleared
6. Save and reload → verify last state persists

**Expected outcome:** Full undo/redo stack survives, all data intact

**API calls used:**
- `EditorApp.setGlyph()` / `paint()` (50 edits)
- `EditorApp.undo()` (50x)
- `EditorApp.redo()` (50x)
- `EditorApp.saveAsXP()`

**Test file:** `tests/web/rexpaint-editor-user-request-undo-stress.test.js`

---

## Test Execution Instructions

### Run single request test with headless browser:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-xp-editor-semantic --timeout-sec 120
```

### Run with visible browser (for debugging):
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-xp-editor-semantic --headed --timeout-sec 120
```

### Run all request tests in sequence:
```bash
for req in A1 A2 A3 B1 B2 B3 C1 C2 D1 D2 E1 E2; do
  node scripts/ui_tests/runner/cli.mjs test:e2e --feature "workbench-user-request-$req" --headed
done
```

### Expected output (JSON):
```json
{
  "pass": true,
  "feature": "workbench-user-request-A1",
  "duration": 23.5,
  "steps": 10,
  "screenshots": ["step-1.png", "step-2.png", ...],
  "log": "hat-added-successfully"
}
```

---

## Checklist for Manual/Live Testing

Use this checklist during live API test runs with human requests:

- [ ] **A1: Add hat** — Paint glyph element on sprite
- [ ] **A2: Animation frames** — Multi-frame editing with action switching
- [ ] **A3: Convert sprite sheet** — Batch PNG to XP pipeline
- [ ] **B1: Recolor grayscale** — Batch color replacement all layers
- [ ] **B2: Copy/paste between sprites** — Cross-sprite selection operations
- [ ] **B3: Extract palette** — Palette extraction and reuse
- [ ] **C1: Resize canvas** — Dimension changes with boundary handling
- [ ] **C2: Multi-action bundle** — Bundle mode action management
- [ ] **D1: Custom frames** — Non-standard frame layout conversion
- [ ] **D2: Constraint validation** — Gate checks (G10, G11, G12)
- [ ] **E1: Performance large sprite** — 126×80 @ 28x zoom responsiveness
- [ ] **E2: Undo 50 edits** — Undo stack stress test

---

**Document Version:** 1.0
**Created:** 2026-03-10
**Last Updated:** 2026-03-10
