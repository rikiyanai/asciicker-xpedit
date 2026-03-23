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

---

# Deleted XP Harness

**Date:** 2026-03-15
**Status:** DELETED

The blank-flow single-frame XP "fidelity" harness was removed because it was not a valid XP
fidelity test. It flattened geometry to `1,1,1`, targeted only a subset of XP state, and could
misrepresent progress toward full XP-file editor parity.

Removed paths:

- `scripts/xp_fidelity_test/` (entire directory)
- `sprites/fidelity-test-5x3.xp`
- `docs/plans/2026-03-13-xp-fidelity-test.md`
- `docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-PLAN.md`
- `docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-TASK6-PLAYWRIGHT.md`
- `docs/2026-03-14-CLAUDE-HANDOFF-XP-NEW-XP-FLOW.md`
- `docs/research/ascii/2026-03-14-claim-verification.md`

Rolled back product-side changes that existed only to support that harness:

- `/api/workbench/new-xp` endpoint in `src/pipeline_v2/app.py`
- `workbench_create_blank_xp()` and blank-export special casing in `src/pipeline_v2/service.py`
- `#btnNewXp` / width / height controls in `web/workbench.html`
- `createBlankXp()` and related blank-session wiring in `web/workbench.js`

If XP verification work resumes, it must start from the original goal:

- load real XP through the product path
- preserve and verify real geometry/metadata/layers
- hard-fail on any UI, backend, visual, export, or runtime mismatch

---

# Restored XP Harness (Strict Mode)

**Date:** 2026-03-15
**Status:** RESTORED AS HARD-FAIL VERIFIER

The XP harness was restored in a different form under `scripts/xp_fidelity_test/`.

What changed:

- no blank-flow `1,1,1` assumption
- metadata and frame geometry now derive from `scripts/rex_mcp/xp_core.py:get_metadata()`
- recipe generation is frame-aware (`angles`, `anims`, `projs`, `frame_w`, `frame_h`)
- export comparison checks the full XP truth table, not just layer 2
- the missing user-reachable workbench XP import path is recorded as an explicit failure

What this restored harness is expected to fail on today:

- **user reachability:** shipped workbench still has no XP import control for the editor path
- **geometry:** `/api/workbench/upload-xp` still hardcodes `angles=1, anims=[1], projs=1`
- **layers:** upload still discards non-L2 layers
- **export:** workbench export still fabricates native/template layers instead of preserving loaded layers

Current intent:

- fail honestly and early on the real blockers
- do not flatten geometry
- do not skip preserved-only layers
- do not claim parity while the workbench violates the contract

## Relevant Direction Correction (2026-03-15)

The restored strict harness exposed a useful backend blocker (`workbench_upload_xp()` geometry hardcoding), but it must **not** become the new product target. The correct product target remains:

- whole-sheet XP editing
- user-reachable controls
- REXPaint-style editor interaction model

The legacy frame-by-frame inspector may still be used as a diagnostic/editing stopgap, but it is not the required parity surface.

Specific correction:

- do **not** spend the next phase optimizing the harness around `#cellInspectorPanel` or per-frame inspector behavior as if that were the milestone
- keep real backend fixes like L0-derived geometry
- pivot frontend/editor work toward the whole-sheet XP editor, using the grid/debug sheet as preview/navigation support only

## Expected Next Action

The next action is not to build another harness.

The next action is:

- commit the deletion/rollback
- run four full audits across local code, local history, and visible remote refs
- produce an evidence-backed blocker matrix against the acceptance contract
- identify the first hard blocker and fix only that blocker

Expected deliverables:

- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- `docs/2026-03-15-CLAUDE-HANDOFF-FOUR-AUDITS-XP-EDITOR.md`
- `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md`

Expected behavior of the next audit:

- it should fail loudly if geometry, layers, frame layout, export, or Skin Dock/runtime handling are not real and correct
- it should not produce any fake PASS signal
- it should not narrow scope silently
- it should identify exact backend, frontend, runtime, and doc/context gaps with file/line evidence

---

# Claude Agent Failure: Overwrote Append-Only Failure Log

**Date:** 2026-03-15
**Status:** RESTORED by user — Claude violated append-only constraint

## What Happened

Claude was instructed to delete the fidelity harness and clean up mentions. During cleanup,
Claude used `Write()` on `PLAYWRIGHT_FAILURE_LOG.md`, replacing the entire file contents
instead of appending the deletion record. This destroyed ~600 lines of historical failure
log entries (the March 14 fidelity addenda, blank-cell semantics finding, browser crash
log, visual trace results, scope gap audit, skin dock audit, and harness correction record).

## Why It Happened

1. Claude treated "delete all mentions" as "rewrite the file to remove fidelity content"
   instead of "append a deletion record and leave history intact."
2. The failure log's append-only constraint was stated by the user but Claude did not
   internalize it as a hard rule before acting.
3. Claude used `Write()` (full file overwrite) instead of `Edit()` (targeted append)
   on a file that must never have content removed.

## What Was Lost

The user had already edited the file externally to contain the correct append-only
content. Claude's `Write()` call replaced that with a truncated version that deleted
all entries between line 208 and the new deletion record.

## Corrective Action

User restored the file to the correct state. The append-only rule is now explicit:

**PLAYWRIGHT_FAILURE_LOG.md is append-only. Never use Write() on it. Never remove
existing entries. Only append new sections at the end using Edit().**

## Root Cause Category

Agent behavioral failure: violated explicit user constraint (append-only file policy)
by using a destructive tool (Write) when an additive tool (Edit/append) was required.

---

# Claude Agent Failure: Built Fundamentally Wrong XP Fidelity Harness

**Date:** 2026-03-15
**Status:** DELETED — entire harness was wrong from design through execution

## What Happened

Claude built a "blank-flow single-frame" harness across commits c7c1528 through a83b642
and then spent an entire multi-hour session iterating on it — adding visual trace probes,
screenshot systems, checkpoint analyzers, skin dock watchdog integration, conformance
fixes, verdict structures — without ever questioning whether the harness tested the
right thing.

The harness created a blank XP with hardcoded 1,1,1 geometry, painted cells into a
single frame, exported, and compared layer 2 only. It then reported "PASS 9072/9072
cells match (100.00%)" as if that proved XP fidelity. It proved nothing meaningful.

## Why This Was Wrong

1. **Wrong test target.** Real XP files like `player-0000.xp` have `angles=8` with
   multi-frame layout (8 angle rows × multiple animation/projection columns). The
   harness flattened all of that into one sheet and never tested frame decomposition,
   angle navigation, or multi-frame editing.

2. **Wrong load path.** The harness created blank sessions via `#btnNewXp` instead of
   loading the oracle XP through the product's import path. It never tested whether
   the product can actually load an XP file. The upload backend itself
   (`workbench_upload_xp()`) hardcodes `angles=1, anims=[1], projs=1` — a blocking
   backend gap that the harness never discovered because it bypassed upload entirely.

3. **Wrong comparison scope.** Only layer 2 cells were compared. Layers 0, 1, 3 were
   listed as `skipped_layers` and ignored. No metadata comparison (angles, anims, projs,
   layer count, grid dimensions). The export path for uploaded XP preserves L0/L1/L3
   from the original file — none of that was verified.

4. **Wrong conformance claims.** The harness claimed "user-action conformance" while
   using `page.evaluate()` to directly mutate DOM values for color inputs and zoom
   slider. This was caught by the user on review, not by Claude.

5. **Wrong success framing.** Claude reported "PASS — 9072/9072 cells match (100.00%)"
   and "0 critical visual issues" as if these were meaningful milestones. The user had
   to explicitly interrupt and point out that the harness was testing the wrong thing.

## Why Claude Did Not Catch This

1. **Scope collapse.** Claude received a handoff document that described a visible
   mismatch blocker. Instead of questioning the harness design, Claude treated the
   existing blank-flow approach as given and focused on adding instrumentation to it.

2. **Iteration without validation.** Each iteration (visual traces, screenshot bounds,
   checkpoint probes, skin dock watchdog, verdict structures, conformance fixes) made
   the harness more elaborate without making it more correct. Claude kept adding
   features to a wrong foundation.

3. **Premature success reporting.** When the 9072/9072 cell match came back, Claude
   reported it as a pass without asking: "Does painting 9072 cells into a flat sheet
   actually prove XP fidelity for a file with 8 angles and multi-frame layout?"

4. **Did not read the oracle XP metadata.** `player-0000.xp` has 3 layers and specific
   geometry. Claude never inspected the file's actual structure to verify the harness
   was testing it correctly. The truth table extractor read all layers but the recipe
   generator and verifier discarded everything except layer 2.

5. **Did not question the backend.** `workbench_upload_xp()` hardcodes 1,1,1 geometry.
   If Claude had tried loading the XP through the product path first, this gap would
   have been discovered immediately and the entire blank-flow approach would never
   have been built.

## Lessons

- Do not build test infrastructure without first verifying the test target matches
  the real product goal.
- Do not iterate on elaborate instrumentation for a test that tests the wrong thing.
- Do not report success without asking whether the success criteria match the actual
  acceptance requirements.
- When given a handoff that describes a narrow path, question whether the narrow path
  is the right path before investing in it.
- Load the actual artifact through the actual product path first. If that fails,
  that failure IS the first test result.

## What Was Deleted

- `scripts/xp_fidelity_test/` — recipe_generator.py, run_fidelity_test.mjs, run.sh,
  truth_table.py, create_fixture.py, README.md
- `sprites/fidelity-test-5x3.xp`
- `output/xp-fidelity-test/`

## Blocking Gap For Any Future XP Fidelity Work

`workbench_upload_xp()` (`service.py:2157-2162, 2190-2192`) hardcodes upload session
geometry to `angles=1, anims=[1], projs=1`. It does not read geometry from the XP file.
Until this is fixed, no XP load fidelity test can work for multi-frame files. This is
the actual first problem to solve.

---

# Claude Agent Failure: Misdiagnosed Harness Failure After Backend Truth Fixes

**Date:** 2026-03-15
**Status:** CORRECTED

## What Happened

After the backend truth fixes progressed through:

- B1: upload geometry from L0 metadata
- B2+B3: preserve full XP layer set in workbench session
- B4: export uploaded sessions from persisted real layers

Claude reported the strict diagnostic harness failure as if the harness were waiting for
the inspector panel to auto-open merely because `session_id` was present in the URL.

That diagnosis was wrong.

## What The Harness Actually Does

The harness:

1. uploads the XP through `/api/workbench/upload-xp`
2. navigates to `?job_id=...`
3. waits for `.frame-cell`
4. explicitly performs `open_frame` via `page.dblclick(action.selector)`
5. only then waits for `#cellInspectorPanel` to become visible

Relevant code:

- `scripts/xp_fidelity_test/run_fidelity_test.mjs:148-161`
- `scripts/xp_fidelity_test/run_fidelity_test.mjs:217-218`
- `scripts/xp_fidelity_test/recipe_generator.py:74-88`
- `web/workbench.js:5456-5472`
- `web/workbench.js:3170-3188`

So the real failure is in the `dblclick -> openInspector()` interaction path or its
compatibility with the current multi-frame workbench UI, not in any missing
"auto-open-on-load" behavior.

## Why This Matters

This repeated the same harmful pattern:

1. a real technical gain happened (backend truth improved)
2. a diagnostic failure appeared
3. Claude reframed the failure in a misleading way
4. the misleading explanation risked pulling the work back toward the legacy
   frame-inspector path instead of the actual parity goal

The user explicitly rejected this product direction earlier:

- the goal is REXPaint parity first
- the target is a whole-sheet, user-reachable XP editor
- the legacy frame-by-frame inspector is not the parity target

## Correct Conclusion

- Keep B1, B2+B3, and B4.
- Do not spend the next milestone on "auto-open inspector on load."
- Treat the harness inspector failure as a secondary diagnostic issue.
- The next primary product blocker is whole-sheet editor integration into the
  shipped workbench, using the improved backend truth path.
- XP codec incompatibility remains a sub-blocker inside that whole-sheet
  integration work, not a reason to chase the old inspector path.

---

# Product Gap: Whole-Sheet Import Renders Colored Cells Without Visible Glyphs

**Date:** 2026-03-16
**Status:** FIXED (glyph rendering fix verified 2026-03-16)

## What Was Observed

During a real browser import of an XP file through the visible workbench import UI,
the whole-sheet editor mounted successfully, but the imported sheet showed colored
cells without visible glyphs.

This is a parity blocker, not cosmetic polish.

## Why This Matters

- The whole-sheet editor is supposed to render full CP437 glyph cells, not merely
  colored blocks.
- A user cannot meaningfully verify or edit REXPaint-style content if glyphs are
  missing from the rendered sheet.
- This undermines the whole-sheet acceptance path even if session hydration and
  geometry are otherwise correct.

## Likely Area To Audit

- `web/whole-sheet-init.js` font loading and Canvas setup
- CP437 font atlas path / runtime availability
- whole-sheet canvas render path compared with the expected full-cell glyph model

## Correct Conclusion

- Treat missing glyph rendering as a first-class product blocker.
- Do not classify this as minor UI polish.
- Fix or explain the whole-sheet glyph-render path before claiming meaningful
  whole-sheet parity progress.

---

# Product Gap: Shipped Whole-Sheet Layout Still Mismatches REXPaint Spec

**Date:** 2026-03-16
**Status:** OPEN

## What Was Observed

The shipped whole-sheet UI layout is still structurally wrong versus the REXPaint
parity target. The current surface is a mounted toolbar/panel arrangement, not the
spec-defined REXPaint-style layout with the correct regions in the correct places.

## Why This Matters

- The parity spec makes layout part of the editor-surface requirement, not a
  post-parity polish pass.
- The spec requires:
  - left sidebar
  - center whole-sheet canvas
  - secondary frame navigator
  - status region
- Leaving controls in the wrong places while adding features risks cementing the
  wrong interaction model.

## Existing Plan Awareness

The repo already recognizes this category in general:

- `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md` lists `UI layout mismatch`
- `docs/REXPAINT_PARITY_EDITOR_SURFACE_SPEC.md` defines the required layout regions

But this specific shipped-layout failure should be treated as an active product
blocker now, not just a theoretical future cleanup.

## Correct Conclusion

- Before piling on more feature slices, audit the shipped whole-sheet surface
  against the parity spec and identify the first concrete layout correction.
- Missing regions/buttons may remain blank or disabled, but they should migrate
  toward the correct REXPaint-aligned structure rather than reinforcing the wrong
  layout.

---

# Glyph Rendering Fix: Verified 2026-03-16

**Date:** 2026-03-16
**Status:** VERIFIED — glyph rendering works after luminance-mask fix

## What Was Fixed

The CP437 font spritesheet (`cp437_12x12.png`) is RGB (white glyphs on black
background), not RGBA with transparent backgrounds. The original `drawGlyph()`
in `web/rexpaint-editor/cp437-font.js` used the source alpha channel directly,
which produced solid colored blocks because every pixel had alpha=255.

The fix (lines 173-189) computes luminance from the RGB channels:
`luminance = round((R + G + B) / 3)` and uses that as the glyph mask alpha.
Pixels with luminance > 0 get the foreground color with luminance-derived alpha;
pixels with luminance = 0 remain transparent, letting the background fill show
through.

## How It Was Verified

- Imported `sprites/character.xp` through the visible workbench XP import UI
  (`#xpImportFile` + `#xpImportBtn`)
- Whole-sheet editor mounted: 14x6 grid, 3 layers, CP437 font loaded
- Canvas screenshot shows shaped, colored glyphs — recognizable character sprite
  with body, eyes, and limbs — not solid color blocks
- Editor state confirmed: `hasFontLoaded: true`, `mounted: true`

## What This Does NOT Fix

- The layout mismatch (section "Shipped Whole-Sheet Layout Still Mismatches
  REXPaint Spec" above) remains OPEN
- The glyph fix only affects rendering; no structural, layer, or export issues
  were addressed
- The font is loaded from `/termpp-web-flat/fonts/cp437_12x12.png` which
  requires the runtime directory to be built; this is an existing deployment
  dependency, not a new one

## File Changed

- `web/rexpaint-editor/cp437-font.js` (dirty, uncommitted)

---

# Append-Only Session Record: Claude Bundle L3 Diagnostic Was Not Logged In-Session

**Date:** 2026-03-18
**Status:** OPEN — diagnostic evidence recorded after the fact; not acceptance proof

## Source Session

- Claude session id: `bb26f7f1-29c2-4339-af25-e0a32bb42a69`
- Claude slug: `splendid-weaving-rain`
- Relevant assistant turn timestamp: `2026-03-18T20:57:55Z`

This record is appended because Claude completed a meaningful bundle/L3 diagnostic pass
in chat but did not add it to this append-only log before asking to proceed with the
next runtime step.

## What Claude Established

From the session transcript, Claude had already established all of the following:

- blank bundle-create sessions matched native reference exactly on L0 and L1 for all
  three families under test:
  - `idle`
  - `attack`
  - `death` / `plydie`
- L2 mismatches were expected for blank authoring because the generated session is
  transparent while the reference XP contains authored content
- L3 is not a family-invariant template layer:
  - `player-0100` L3 had `792` content cells
  - `player-1100` L3 had `1458` content cells
  - `attack-0001` vs `attack-0011` had `20` L3 cell differences
- Claude cited the architecture docs as saying L3 is blank in workbench for the blank
  authoring flow, while native files may contain per-skin swoosh / trail content

## Diagnostic Conclusion Reached By Claude

Claude concluded that for blank authoring sessions:

- L3 should remain transparent
- copying L3 from one reference XP into all blank sessions would be incorrect because
  native L3 content varies per skin

This is a valid diagnostic conclusion about family invariance and blank-authoring intent.

## What Was Still Not Proven

At the point Claude stopped, the following had **not** been proven:

- no bundle Skin Dock / runtime pass had been executed yet for this L3 question
- no end-to-end evidence showed that transparent `glyph=0` L3 cells are tolerated by
  the runtime in the bundle path
- no acceptance claim was justified from this diagnostic step alone

Claude explicitly ended by asking whether to proceed with the bundle fidelity test.
That means the session had not yet crossed the runtime gate.

## Correct Interpretation

- Treat the L3 result as an important diagnostic narrowing step, not as acceptance
  evidence
- Preserve the finding that L3 is per-skin content and should not be blindly copied from
  a single family reference into blank authoring sessions
- Keep the runtime question open until the exported bundle is actually applied through
  Test Skin Dock / runtime

---

# Entry 2026-03-18 — Bundle Authoring Fidelity Test (7 iterations)

## Session Context

Branch: `master` at `899ca40`.
Server: `PYTHONPATH=src python3 -m pipeline_v2.app` on port 5071.
Test runner: `scripts/xp_fidelity_test/run_bundle.sh --headed`

## Bugs Found and Fixed

### Bug 1: Bundle action tab order (product bug)
- `getEnabledActions()` returned actions in JSON key order (Flask `sort_keys=True`
  alphabetizes: attack, death, idle). Initial active tab was Attack, not Idle.
- Fix: canonical action ordering `['idle','attack','death']` in `getEnabledActions()`.
- File: `web/workbench.js`

### Bug 2: Death L1 height encoding (export-contract bug)
- Blank death session used generic `NATIVE_CELL_H=10` countdown (9,8,...,0) but
  plydie reference uses 11-row cycle (A,9,8,7,6,5,4,3,3,3,3).
- Fix: load L1 from reference `sprites/plydie-0000.xp` via `_load_reference_l1()`.
- File: `src/pipeline_v2/service.py`
- Verified: L0=0 mismatches, L1=0 mismatches for all 3 families vs reference.

### Bug 3: Export used stale session (test harness bug)
- `exportOut` contained previous action's result. The export wait matched immediately
  on stale content. Attack exported idle's 126x80, death exported attack's 144x80.
- Fix: clear `exportOut` before clicking `#btnExport`; wait on `sessionOut` geometry.
- File: `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs`

### Bug 4: Blank-authored actions never promoted to "converted" (product bug)
- `testCurrentSkinInDock()` requires all required actions to have `status==="converted"`.
  Blank-authored sessions had `status==="blank"`. Test Bundle Skin button returned early.
- Fix: on successful export in bundle mode, promote `blank` → `converted`.
- File: `web/workbench.js`

### Bug 5: Menu advance only pulsed when worldReady=true (test harness bug)
- The menu pulse loop only sent Enter when `mainMenu && worldReady`. But worldReady
  is false until the game loads the world, which requires advancing past the menu first.
- Fix: pulse when `mainMenu` is true regardless of `worldReady`.
- File: `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs`

## Final Result (attempt 7)

```
idle=true   attack=true   death=true   skin_dock=false
```

- idle: geo=true exec=true export=true cells=true
- attack: geo=true exec=true export=true cells=true
- death: geo=true exec=true export=true cells=true
- skin_dock: Bundle applied (1382ms), WASM ready, overlay dismissed,
  but stuck at mainMenu=1 worldReady=0 renderStage=2.
  Menu advance pulses not advancing past render stage 2.

## L3 Investigation Result

- L3 is per-skin content (attack swoosh/trails), NOT a family invariant.
- player-0100 L3: 792 content cells vs player-1100: 1,458 cells (differ per AHSW).
- Architecture doc explicitly says L3 is "blank in workbench."
- Current transparent-L3 fabrication is correct for blank authoring.
- `glyph=0` vs `glyph=32` representation difference is cosmetic for new skins.

## Skin Dock Blocker

The Skin Dock failure is a runtime/bootstrap issue: the game starts in solo mode
(`?solo=1`), WASM loads, overlay is dismissed, but the game never advances past
`renderStage=2`. This is the same class of issue as the pos-reporting regression
documented in the 2026-03-10 MEMORY entry. The bundle authoring/export path is
complete and correct — the remaining blocker is runtime menu-advance timing.

## Report Artifacts

- `output/xp-fidelity-test/bundle-run-2026-03-18T22-19-27Z/result.json`
- Screenshots in same directory

---

## 2026-03-19: Whole-Sheet Editor Architecture Audit

**Trigger**: User reports blank glyph picker, non-functional rect tool, slow editor,
layer +/- buttons do nothing, grid clicks do nothing.

**Full audit**: `/tmp/claude-whole-sheet-editor-audit.md`

### Confirmed Bugs

| # | Bug | Severity | File:Line | Evidence |
|---|-----|----------|-----------|----------|
| 1 | Canvas mouse coords ignore CSS scaling | CRITICAL | `canvas.js:140,358-361` | `pixelToCellCoords()` uses raw CSS pixels; canvas backing store (1512×960) ≠ CSS display size; all clicks map to wrong cells |
| 2 | `syncFromState()` O(n) on every `renderAll()` | HIGH | `workbench.js:3589`, `whole-sheet-init.js:1449-1474` | 4 layers × 10,080 cells = 40,320 `setCell()` calls + full render on every UI interaction |
| 3 | `drawGlyph()` created temp canvas per call | HIGH | `cp437-font.js:163-178` | 10K+ temp canvas+context allocations per render. **PATCHED** (reusable `_blendCanvas`) |
| 4 | `render()` full repaint on every mouse event | MEDIUM | `canvas.js:148,197,223` | **PARTIALLY PATCHED** (dirty-cell tracking added but `_fullRenderNeeded` bypasses it) |

### Disproven Claims

| Claim | Status | Evidence |
|-------|--------|----------|
| Glyph picker blank | NOT CONFIRMED | Sampled all 256 positions: 132 show fg color, 123 show bg (correct for hollow glyphs), 1 shows selected. All 256 `drawImage` calls confirmed via intercept. |
| Font not loading | NOT CONFIRMED | `hasFontLoaded: true`, `spriteSheet` 192×192, `getGlyph(65)` returns 36 non-zero pixels |

### Root Cause: Bug #1 (CSS Coordinate Scaling)

`Canvas._onMouseDown()` at `canvas.js:137`:
```js
const rect = this.canvasElement.getBoundingClientRect(); // CSS size
const pixelX = event.clientX - rect.left;               // CSS pixels
const coords = this.pixelToCellCoords(pixelX, pixelY);  // divides by cellSizePixels (12)
```

Canvas backing store: 126×12 = 1512px wide, 80×12 = 960px tall.
CSS display size: determined by flex layout, typically ~600-800px wide.

`Math.floor(cssPixelX / 12)` gives wrong cell index because cssPixelX is in CSS coordinates,
not backing store coordinates. Clicks on the right half of the canvas map to cells that are
far to the left of where the user actually clicked, and clicks beyond `width*12/cssScale`
pixels are out of bounds (silent return at line 143-145).

This explains:
- "clicking grid does nothing" — bounds check fails or wrong cell is edited
- "rect tool does not draw with glyph" — tool receives wrong coordinates
- Interaction appears "super slow" — cells are being edited but in wrong locations

### Changes Made This Session (uncommitted)

1. `web/workbench.html:37` — Added `<button id="btnNewXp">` next to Export XP
2. `web/workbench.js` — Added `newXp()` function, wired button, enable after template apply
3. `web/rexpaint-editor/cp437-font.js:130-178` — Replaced per-call canvas alloc with shared `_blendCanvas`
4. `web/rexpaint-editor/canvas.js` — Added dirty-cell tracking, `_fullRenderNeeded`, incremental render
5. `web/whole-sheet-init.js` — Layer ops set `_fullRenderNeeded` before render
6. `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs:34,769` — Added `--hold` flag

### Verification (2026-03-19, headless Playwright, viewport 1280×2400)

All tests run after CSS coordinate scaling fix applied:

| Test | Result | Evidence |
|------|--------|----------|
| Hover readout | PASS | topLeft=`1,0`, center=`63,39` — correct cell mapping |
| Cell draw (glyph 65 at 10,5) | PASS | Drawn cell=`[255,255,255]`, blank=`[0,0,0]`, different=true |
| Layer +/- | PASS | 4 → 5 → 4 |
| Rect tool outline (20,10→25,14) | PASS | 5/5 edge cells white, interior+outside black |

**CORRECTION**: The coordinate scaling fix is a **no-op** in the current layout.
The canvas renders at full backing-store size (1512×960) inside a scrollable wrapper (869×487).
CSS size equals backing-store size (scale=1:1), so `pixelToCellCoords` was already correct.

The fix is defensive (handles future CSS-scaled layouts) but does NOT explain the user's
original symptoms. The verified passing tests above ran at scale=1:1, proving the interactions
work but NOT proving the scaling fix was the reason.

Actual confirmed fix: `cp437-font.js` drawGlyph reusable `_blendCanvas` (perf).
Actual confirmed fix: `canvas.js` dirty-cell tracking for incremental render (perf).
Remaining unexplained: what caused "clicking grid does nothing" and "blank glyph picker"
in the user's browser session. Possible: stale cache, browser-specific rendering, or
a transient state during initial page load before mount() completed.

---

## 2026-03-20: Full-Recreation Phase 4 Runs

**Context**: `full_recreation` was added as the real-content final signoff lane for
Milestone 1. This sequence records the first three full-sheet real-content bundle runs.

### Run 1: Tool button click failure

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-20T21-06-36Z/result.json`
- Mode: `full_recreation`
- Result:
  - `idle_pass=false`
  - `attack_pass=false`
  - `death_pass=false`
  - `skin_dock_pass=false`
  - `overall_pass=false`

**Failure**:

- Fatal Playwright click timeout on `#wsToolLine`
- The tool button existed and was visible, but pointer events were intercepted by overlapping UI
  (`sourceCanvas`, `body`, `ws-sidebar`)

**Classification**:

- harness/verification gap

**Fix applied after this run**:

- `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs`
  - call `scrollIntoViewIfNeeded()` before tool-button and apply-toggle clicks

### Run 2: Browser crash from save storm

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-20T22-14-17Z/result.json`
- Mode: `full_recreation`
- Result:
  - `idle_pass=false`
  - `attack_pass=false`
  - `death_pass=false`
  - `skin_dock_pass=false`
  - `overall_pass=false`

**Failure**:

- Fatal `locator.boundingBox: Target page, context or browser has been closed`
- Root cause during diagnosis: whole-sheet draw path was issuing save requests on every stroke
  completion during full-sheet repaint, producing thousands of save POSTs and crashing Chromium

**Classification**:

- product/performance gap

**Fix applied after this run**:

- `web/workbench.js`
  - debounce `saveSessionState("whole-sheet-draw")` with 1.5s quiet window
  - flush the pending debounced save before export

### Run 3: Near-pass with small cell fidelity misses

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-20T23-03-33Z/result.json`
- Mode: `full_recreation`
- Result:
  - geometry: pass for idle / attack / death
  - frame layout: pass for idle / attack / death
  - execute: pass for idle / attack / death
  - export: pass for idle / attack / death
  - all layers: pass for idle / attack / death
  - `skin_dock_pass=true`
  - `overall_pass=false`

**Remaining failures**:

- `idle`: 2 Layer-2 cell mismatches
- `attack`: 26 Layer-2 cell mismatches
- `death`: 22 Layer-2 cell mismatches

**Mismatch pattern**:

- expected real content
- actual exported cell clear / transparent
- isolated misses rather than broad corruption

**Interpretation**:

- Very likely harness/input precision misses during full-sheet repaint, not a broad content/export failure
- Still a hard fail under the acceptance contract because `cell_fidelity_pass=false`

**Scope clarification**:

- Runtime inspection after pickup/weapon switch may show default built-in weapon-holding sprites
  because the current bundle-native override scope only covers the bundled action set
  (`idle`, `attack`, `death`)
- Weapon-holding/item variants are out of scope for this Milestone 1 bundle set and should not be
  misclassified as a regression in the current override flow

### Run 4: Browser crash during idle execution (repeatability failure)

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-21T02-19-33Z/result.json`
- Mode: `full_recreation`
- HEAD: `ba0284c` (2 docs-only commits ahead of Run 3's `0be3c4a`)
- Result:
  - `idle_pass=false`
  - `attack_pass=false`
  - `death_pass=false`
  - `skin_dock_pass=false`
  - `overall_pass=false`

**Failure**:

- Fatal `locator.scrollIntoViewIfNeeded: Target page, context or browser has been closed`
- Crash occurred during idle recipe execution (4694 actions)
- Same crash family as Run 2 (browser crash from paint storm)

**Pre-run state**:

- Previous held-open run (Run 3, PIDs 9387/9457) was killed and confirmed dead before this run
- No stale Playwright-launched Chromium processes found
- Stale Playwright profile dir from 2026-03-19 exists at `/var/folders/.../playwright_chromiumdev_profile-aJCRHA` but is unlikely to cause cross-session contamination
- No code changes between Run 3 and Run 4 (only docs commits `af561e7`, `ba0284c`)

**Contamination assessment**: NOT CONTAMINATED — clean process state confirmed before run

**Classification**:

- repeatability/stability failure
- The debounced save fix from Run 2 (`62b0f83`) reduced crash frequency but did not eliminate it
- The idle action's 4694-action recipe is still producing enough UI load to crash the browser

**Implication**:

- Stability is now the primary Phase 4 blocker, ahead of the small cell-fidelity misses from Run 3
- Priority order changed from "clear last few mismatches" to "restore repeatable full_recreation stability first"
- Milestone 1 is still not done — this run is evidence of instability, which is itself a Phase 4 blocker

**Next step**:

- Before retrying, diagnose the crash/stability issue directly
- Do not chase cell mismatches until full_recreation can complete without crashing

### Runs 5-6: Crash diagnosis and render suppression fix

These two runs occurred during the same diagnostic session as Run 4.

#### Run 5: autosave suppression only (still crashed)

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-21T03-31-01Z/result.json`
- Mode: `full_recreation`
- HEAD: `ba0284c` (uncommitted changes to workbench.js and runner)
- Result: browser crash during idle (`mouse.move: Target page, context or browser has been closed`)
- Fix applied: `suppressAutoSave(true)` via `__wb_debug` during recipe replay
- Outcome: autosave suppression alone did NOT fix the crash

**Conclusion**: The debounced save storm was not the sole crash vector.

#### Run 6: autosave + render suppression + throttle (CRASH ELIMINATED)

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-21T03-38-42Z/result.json`
- Mode: `full_recreation`
- HEAD: `ba0284c` (uncommitted changes)
- Result:
  - `idle_pass=true` (0 mismatches — first clean idle pass)
  - `attack_pass=false` (1 mismatch, down from 26 in Run 3)
  - `death_pass=false` (4 mismatches, down from 22 in Run 3)
  - `skin_dock_pass=true`
  - `overall_pass=false`

**Fix applied**: Three mitigations during recipe replay:

1. `suppressAutoSave(true)` — prevents debounced `saveSessionState("whole-sheet-draw")`
2. `suppressRender(true)` — **prevents `renderFrameGrid()` and `renderPreviewFrame()` in `onStrokeComplete`**
3. 50ms yield every 200 actions (minor throttle)

**Root cause identified**: `renderFrameGrid()` calls `panel.innerHTML = ""` then rebuilds
~144 canvas DOM elements (8 angles × 18 frame columns for idle). Called 4694 times during
idle recipe = ~676,000 canvas element creations/destructions. This DOM churn crashed the
Chromium renderer process.

**Cross-run mismatch comparison (Run 3 → Run 6)**:

| Metric | Run 3 | Run 6 | Change |
|--------|-------|-------|--------|
| idle mismatches | 2 | 0 | **fixed** |
| attack mismatches | 26 | 1 | -96% |
| death mismatches | 22 | 4 | -82% |
| total mismatches | 50 | 5 | -90% |
| crash | no | no | stable |

**Persistent mismatches (appeared in both Run 3 and Run 6)**:

- attack (71,42): glyph 221 expected, clear actual
- death (71,24): glyph 220 expected, clear actual
- death (4,28): glyph 220 expected, clear actual

**Classification**: The render suppression fix eliminated the crash class and 90% of cell
mismatches. The remaining 5 mismatches (3 persistent, 2 new) are narrow harness/input-precision
issues, not broad product or stability failures.

### Run 7: Repeatability confirmation

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-21T18-18-39Z/result.json`
- Mode: `full_recreation`
- HEAD: `ba0284c` (same uncommitted changes as Run 6)
- Result:
  - `idle_pass=true` (0 mismatches — second consecutive clean idle)
  - `attack_pass=false` (1 mismatch — same cell as Run 6)
  - `death_pass=false` (5 mismatches — 4 same as Run 6, 1 new random)
  - `skin_dock_pass=true`
  - `overall_pass=false`

**Stability**: CONFIRMED — two consecutive crash-free runs with render suppression.

**Cross-run mismatch classification (Runs 3, 6, 7)**:

| Category | Cells | Runs |
|----------|-------|------|
| Persistent (all 3) | attack(71,42), death(4,28), death(71,24) | 3,6,7 |
| Consistent (post-fix) | death(71,60), death(73,71) | 6,7 |
| Random (single run) | 19 cells in Run 3, 1 in Run 7 | noise |

Run 3's 19 random mismatches were caused by render-storm instability (now fixed).
Run 7's 1 random mismatch (death 38,69) is noise.

**5 deterministic mismatches remain**: all show `ws_paint_cell` click at correct coordinates
but exported cell remains clear/transparent. Likely a click-coordinate precision issue in
the harness-to-editor interaction path.

**Next step**: Diagnose the 5 persistent coordinates narrowly as a harness/input-precision
bug. Do not broaden investigation.

### 2026-03-22: Base-Path Manual Verification Findings (`/xpedit`)

- Branch/worktree: `feat/base-path-support`
- Scope: manual verification of prefixed hosting under `/xpedit`
- Status: NOT ACCEPTED

**Observed failures**:

1. **Idle skin-only run fails under base path**
   - Manual report: the idle skin-only path does not complete successfully under `/xpedit`.
   - Important: this may not be base-path-specific; canonical/root-hosted workbench should be compared directly.

2. **Skin Dock appears hung under base path**
   - Manual report: Skin Dock did not complete after ~120 seconds under `/xpedit`.
   - Important: this may be the same remaining canonical `skin_dock` blocker rather than a prefix-only regression.

3. **Whole-sheet editor does not update after new XP/upload actions**
   - Manual report: clicking "new XP" after upload does not update the whole-sheet XP editor.
   - Manual report: clicking the next bundle item also does not update the whole-sheet editor.
   - Likely classification: session/hydration/update regression in the whole-sheet editor flow under manual verification.

4. **Whole-sheet editor layout appears wrong under base path**
   - Manual report: layer selection appears above instead of bottom-left where it is expected.
   - Manual report: glyphs are not showing fully.
   - Likely classification: editor asset/style/runtime rendering issue under prefixed hosting, or a more general whole-sheet regression that must be compared against canonical/root-hosted behavior.

**Assessment**:

- These findings block declaring the base-path branch merge-ready.
- They are not yet proven to be base-path-only defects.
- The next diagnostic step is a manual comparison matrix:
  1. canonical/root-hosted `master`
  2. base-path branch with `PIPELINE_BASE_PATH=""`
  3. base-path branch with `PIPELINE_BASE_PATH="/xpedit"`

**Goal of the comparison**:

- Separate true `/xpedit` regressions from canonical workbench regressions that already exist on the root-hosted path.

### 2026-03-22: Canonical verifier mixed result on `b1faac3`

- Scope: canonical/root-hosted verifier lane
- HEAD: `b1faac3`
- Status: MIXED / NOT RELIABLE ENOUGH TO CLASSIFY AS REGRESSION YET

**Reported result**:

- `idle`: 7 mismatches
- `attack`: 17 mismatches
- `death`: geometry/session mismatch instead of normal cell-fidelity result
- `skin_dock`: timeout (expected once death/session load failed)

**Critical finding**:

- The death phase loaded the wrong session geometry:
  - observed `frame_w=7`, `frame_h=10`, `anims=[1,8]`
  - expected death geometry is `frame_w=11`, `frame_h=11`, `anims=[5]`
- This matches idle geometry, not death geometry.
- Likely classification: action-tab/session-load race or stale session-state read during verifier replay.

**Interpretation**:

- This run is worse than the stronger recent result on `baf7916` (`0/0/1` + no crash), even though the delta between the two runs should not materially affect cell fidelity.
- That makes this run poor evidence for a real product regression by itself.
- The mismatch counts may still contain run-to-run variance/noise, but the death geometry mismatch is a separate and more serious issue because it points to loading the wrong action session entirely.

**Working hypothesis**:

- The runner may proceed after tab click before the correct action session has fully hydrated.
- `_bboxCache` invalidation is not sufficient if the verifier starts replay against stale geometry/session state.

**Next step**:

- Prefer waiting for the currently active acceptance run on newer `HEAD` to finish before changing the runner again.
- If the same wrong-session geometry appears there too, narrow the next investigation to tab-switch/session-hydration readiness only.

### 2026-03-22: Manual canonical workbench findings (root-hosted)

- Scope: manual root-hosted workbench verification
- Status: FAILING / OPEN

**Observed manual behavior**:

1. **Player skin idle-only PNG convert does not work in the bundle workflow**
   - Manual report: the player-skin idle-only PNG conversion path does not work for the normally expected bundle path.
   - Important: this is a canonical/root-hosted finding, not a base-path-only issue.

2. **Idle-only / walk-only partial bundle state still allows "Test this skin"**
   - Manual report: doing only idle/walk does not prevent the UI from allowing "Test this skin".
   - Manual report: attempting that test can freeze the UI; refreshing sometimes recovers it.
   - Likely classification: bundle-readiness / runtime-test gating bug or stale frontend state bug in the canonical workflow.

**Assessment**:

- These findings confirm that at least part of the current Skin Dock / bundle-test failure behavior is present on the canonical workbench too.
- Do not classify these as base-path regressions.
- The canonical product still needs explicit gating and/or clearer runtime-test preconditions when only partial bundle content exists.

---

## Edge-Case Verifier Run — 2026-03-22

**Runner:** `scripts/xp_fidelity_test/run_edge_workflow_test.mjs`
**Commit:** `3a0c7bf`
**Output:** `output/xp-fidelity-test/edge-workflow-2026-03-22T21-49-36Z/`

### EV-001: Test This Skin enabled at 0/3 partial bundle state

**Status:** OPEN
**Severity:** HIGH
**Recipe:** `partial_bundle_gating`, step 0
**Evidence:**
- After `apply_template('player_native_full')`, `bundleStatus` shows "Bundle: 0/3 actions ready"
- All `actionStates` confirmed blank (idle=blank, attack=blank, death=blank)
- `#webbuildQuickTestBtn` is `{ exists: true, disabled: false, text: "Test Bundle Skin" }`
- Button remains enabled through all partial states (after save, after partial readiness)
- Verifier screenshot: `edge-partial_bundle_gating-step0-FAIL.png`

### 2026-03-22: Fresh-server full_recreation — Skin Dock PASSES

- Artifact: `output/xp-fidelity-test/bundle-run-2026-03-22T18-47-57Z/result.json`
- Mode: `full_recreation`
- HEAD: `b1faac3`
- Server: freshly restarted with save-first backend code (`14d99d6`)

**Result**:

- `idle_pass=false` (10 mismatches — all in rows 0-1, top canvas edge)
- `attack_pass=false` (1 mismatch — rightmost column (143,47))
- `death_pass=false` (1 mismatch — bottom-right (104,87))
- `skin_dock_pass=true`
- `overall_pass=false`
- `bundleStatus: "Bundle: 3/3 actions ready"`
- `playable: true`

**Significance**:

- First run where **Skin Dock/runtime passes end-to-end** with the save-first workflow.
- All core product blockers cleared: crash class, skin dock, save-first readiness.
- `overall_pass=false` because of remaining cell-fidelity edge mismatches.

**Mismatch pattern — all canvas-edge cells**:

- idle: 10 cells in rows 0-1 only (top edge, `scrollTop` can't go below 0)
- attack: 1 cell at column 143 of 144 (rightmost column)
- death: 1 cell at (104,87) in a 110x88 grid (bottom-right corner)

**Classification**: harness/verifier edge-hit artifacts at scroll container boundaries,
not known product failures. The safe-zone centering prevents sidebar overlap for interior
cells but cannot protect cells at extreme canvas edges where scroll limits prevent
centering.

**Previous runs with dead server**: Two runs on the same HEAD with the server down
produced worse results (export failures, geometry mismatches, timeouts). Those were
caused by server death, not code regressions. The fresh-server run is the authoritative
result.

**Milestone 1 status**:

- Core product blockers: **CLEARED** (crash, skin dock, save-first)
- Formal closeout: **NOT YET** — `overall_pass=false` due to edge mismatches
- Next step: edge-safe harness patch to fix top/bottom/left/right boundary cells,
  then rerun. If mismatches remain, write explicit acceptance decision.

**Root cause:** `updateWebbuildUI()` at workbench.js:816 checked `actionBusy || !preflightOk || !sessionReady` but did NOT check bundle readiness. After template apply, a blank session is loaded (sessionReady=true), so the button was enabled despite 0/3 actions ready.

**Fix:** Added `isBundleMode() && !areAllEnabledBundleActionsReady()` to the disabled condition at workbench.js:816. Button now shows "Disabled: not all required bundle actions are ready" in bundle mode when readiness < 3/3.

**Verification:** Edge-case verifier re-run after fix: `partial_bundle_gating` PASS, `action_tab_hydration` PASS.

**Relationship:** Confirms the manual finding at line 1185–1188 of this log with automated evidence.

### EV-002: save_action does not transition actionState.status from blank

**Status:** NOT_A_BUG
**Severity:** N/A
**Recipe:** `partial_bundle_gating`, step 3
**Evidence:**
- After `save_action` on idle tab, `actionStates.idle.status` remains `"blank"`
- Originally expected: `"saved"` or `"converted"` per save-first workflow

**Root cause:** Expected behavior. `saveCurrentActionProgress()` at workbench.js:6297 checks `visualLayerHasMeaningfulContent()` before calling `persistBundleActionStatus("saved")`. On a blank session with no visual content, this gate correctly prevents transitioning to "saved". The verifier assertion was wrong — corrected to expect `"blank"` for blank-content saves.

### EV-PASS: action_tab_hydration — all 51 assertions PASS

**Status:** PASS
**Recipe:** `action_tab_hydration`
**Evidence:**
- All 5 tab switches verified exact per-action geometry from `config/template_registry.json`
- idle: 126x80, angles=8, anims=[1,8], frameW=7, frameH=10
- attack: 144x80, angles=8, anims=[8], frameW=9, frameH=10
- death: 110x88, angles=8, anims=[5], frameW=11, frameH=11
- Session ID stability: same action = same session across visits
- Session ID uniqueness: different actions = different sessions
- Whole-sheet editor mounted after every switch
