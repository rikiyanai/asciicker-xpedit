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
