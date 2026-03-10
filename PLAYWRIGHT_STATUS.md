# Playwright Test Suite - Status Report

**Date:** 2026-03-10
**Status:** BLOCKED - Awaiting Runtime Files
**Test File:** `tests/playwright/full-workflow-with-game.spec.js`

---

## Current State

### ✅ What Works
- Workbench loads
- PNG file upload ✓
- Analyze button ✓
- Convert to XP button ✓
- Button click handling ✓
- Test infrastructure ready ✓

### ❌ What's Blocked
- "Test This Skin" button **DISABLED** (missing runtime files)
- Game iframe cannot load without runtime
- Player movement cannot be tested
- Full workflow cannot complete

---

## The Problem

The workbench displays:
```
Skin dock disabled: missing:
  - flat_map_bootstrap.js
  - game_map_y8_original_game_map.a3d
  - minimal_2x2.a3d
  - index.data
  - index.html
  - index.js
  - index.wasm
```

These files are required to run the game for testing sprites.

**Location needed:**
```
runtime/termpp-skin-lab-static/termpp-web-flat/
├── flat_map_bootstrap.js
├── index.html
├── index.js
├── index.wasm
├── index.data
└── flatmaps/
    ├── game_map_y8_original_game_map.a3d
    └── minimal_2x2.a3d
```

---

## Solution

Build script exists: `scripts/build_termpp_skin_lab_static.sh`

**To fix:**
```bash
./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web
```

This will:
1. Extract game WASM from source
2. Copy bootstrap files
3. Deploy to runtime directory
4. Enable "Test This Skin" button

---

## Test Readiness

Test file is **ready to run** once runtime files are available:

```bash
# After runtime files built:
npx playwright test tests/playwright/full-workflow-with-game.spec.js --headed
```

**Expected output when runtime ready:**
- Opens workbench (visible in browser)
- Uploads PNG sprite
- Clicks Analyze
- Clicks Convert to XP
- Clicks "Test This Skin" → Game loads
- Moves player with W/A/S/D keys
- 10+ seconds of gameplay
- Test completes

---

## Test Design

The test is designed for **headful execution** (visible browser):
- No screenshots by default
- Shows UI interactions in real-time
- Player movement visible in game window
- Easy to observe and verify

```bash
npx playwright test tests/playwright/ --headed
```

---

## Next Action

**REQUIRED:** Build runtime files

```bash
cd /Users/r/Downloads/asciicker-pipeline-v2
./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web
```

After building, the test will be able to complete the full workflow and test the converted sprite in the game.

---

## Files

- **Test:** `tests/playwright/full-workflow-with-game.spec.js`
- **Config:** `playwright.config.js`
- **Fixtures:** `fixtures/player-sprite.png`
- **Failure Log:** `PLAYWRIGHT_FAILURE_LOG.md`
- **This Status:** `PLAYWRIGHT_STATUS.md`

---

**Summary:** Test is ready. Runtime files needed. Build script available.
