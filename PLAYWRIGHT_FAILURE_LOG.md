# Playwright Test Failure Log

**Date:** 2026-03-10
**Status:** FAILED - Test did not reach editor steps

---

## Test Execution Attempt

**Test File:** `full-workflow-with-game.spec.js`

**Expected Workflow:**
1. Open workbench ✓
2. Select PNG file ✓
3. Click Upload PNG button ✓
4. Click Analyze button ✓
5. Click Convert to XP button ✓
6. Click "Test This Skin" button ❌
7. Move player in game for 10+ seconds ❌
8. Capture gameplay ❌

**Failure Point:** Did not complete end-to-end flow

---

## Issues Identified

### Issue 1: "Test This Skin" Button State
- Button `#webbuildQuickTestBtn` may not be enabled after conversion
- Even if enabled, may not launch game window properly
- May require additional UI interaction or state change

### Issue 2: No Game Window Opening
- `context.pages()` check may not detect new windows
- Game might be embedded in iframe instead of new window
- Game might not launch automatically after "Test This Skin" click

### Issue 3: No Real Editor Integration
- EditorApp not integrated into workbench
- Cannot modify cells programmatically
- Cannot verify converted sprite properties
- Missing critical functionality in workbench UI

### Issue 4: Keyboard Input Not Reaching Game
- Game canvas may not have focus
- Key presses (W/A/S/D) may not work in game context
- Game may require mouse clicks or different input method

---

## Root Cause Analysis

**PRIMARY BLOCKER: Missing Runtime Files**

The "Test This Skin" button is disabled with the following error:
```
Skin dock disabled: missing:
  - termpp-web-flat/flat_map_bootstrap.js
  - termpp-web-flat/flatmaps/game_map_y8_original_game_map.a3d
  - termpp-web-flat/flatmaps/minimal_2x2.a3d
  - termpp-web-flat/index.data
  - termpp-web-flat/index.html
  - termpp-web-flat/index.js
  - termpp-web-flat/index.wasm
```

These runtime files are required for the game to load and test converted sprites.

**Secondary Issues:**
- EditorApp not integrated into workbench
- Sprite editing/manipulation not available in workbench
- Only PNG→XP conversion pipeline exists, no roundtrip verification

---

## Failure Evidence

Test execution shows:
- Workbench loads ✓
- File upload works ✓
- Analyze/Convert buttons enabled and respond ✓
- Convert completes ✓
- **"Test This Skin" button DISABLED** ❌ (missing runtime files)
- Cannot click button - disabled state maintained for 90s
- Test timeout: 90000ms exceeded

---

## Plan for Fixes

### CRITICAL FIX 1: Build/Deploy Runtime Files
**Task:** Generate missing game runtime files

**Required Files:**
- `runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.html`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.js`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.wasm`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.data`
- `runtime/termpp-skin-lab-static/termpp-web-flat/flatmaps/minimal_2x2.a3d`
- `runtime/termpp-skin-lab-static/termpp-web-flat/flatmaps/game_map_y8_original_game_map.a3d`

**Build Script Available:**
- `scripts/build_termpp_skin_lab_static.sh` exists
- May need to run against game source directory

**Status:** TODO - CRITICAL BLOCKER

### Fix 2: Update Test to Handle Runtime Readiness
**Task:** Wait for runtime to be available
- Check runtime preflight status
- Wait for button enabled state
- Or rebuild runtime before test
- Document runtime setup requirements

**Status:** TODO (depends on Fix 1)

### Fix 3: Integrate EditorApp into Workbench
**Task:** Make editor available in workbench
- Import EditorApp from `web/rexpaint-editor/editor-app.js`
- Expose `window.editorApp`
- Initialize with converted XP data
- Verify load/save/edit works

**Status:** TODO - Not blocking game test, but needed for full workflow

### Fix 4: Add XP Verification
**Task:** Verify conversion output before testing
- Load converted XP file after conversion
- Check dimensions, layers, cell data
- Verify no data loss
- Log conversion results

**Status:** TODO - Validation step

---

## Test Status

| Component | Status | Issue |
|-----------|--------|-------|
| Workbench loads | ✓ | None |
| PNG upload | ✓ | None |
| Analyze button | ✓ | None |
| Convert button | ✓ | Works (output unknown) |
| Test Skin button | ❓ | State/functionality unclear |
| Game launch | ❌ | No window/canvas detected |
| Game input | ❌ | Not tested |
| Player movement | ❌ | Not tested |

---

## Next Steps (In Order)

### 1. IMMEDIATE: Build Runtime Files
```bash
# Check if source game directory exists
ls /Users/r/Downloads/asciicker-Y9-2/.web/

# Run build script
./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web
```

**Expected Result:**
- Runtime files appear in `runtime/termpp-skin-lab-static/termpp-web-flat/`
- "Test This Skin" button becomes enabled
- Game iframe loads when clicked

### 2. Update Test Configuration
- Add runtime build step to test setup (if needed)
- Configure test to wait for runtime preflight
- Handle button enabled state

### 3. Re-run Test
```bash
npx playwright test tests/playwright/full-workflow-with-game.spec.js --headed
```

**Expected Behavior:**
- All 6 workflow steps complete
- "Test This Skin" button clickable
- Game iframe loads
- Player moves for 10+ seconds
- Test completes successfully

---

## Files Involved

**Test:**
- `tests/playwright/full-workflow-with-game.spec.js` - Ready, waiting for runtime

**Build:**
- `scripts/build_termpp_skin_lab_static.sh` - Build script exists
- `runtime/termpp-skin-lab-static/` - Runtime directory (needs files)
- `/Users/r/Downloads/asciicker-Y9-2/.web/` - Game source (for build)

**Workbench:**
- `web/workbench.js` - UI works, waiting for runtime
- Tests game in iframe `#webbuildFrame`

---

**CRITICAL BLOCKER:** Missing runtime files prevent "Test This Skin" button from being enabled.

**ACTION REQUIRED:** Build and deploy runtime files using `scripts/build_termpp_skin_lab_static.sh`
