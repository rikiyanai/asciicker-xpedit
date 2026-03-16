# Ad Hoc Proof Intent Replay Plan

Date: 2026-03-16
Branch: master @ 26fb431
Governed by: docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md

---

## Purpose

Identify the last two recent ad hoc proof intents and determine whether each
can be represented as a canonical recipe/verifier case, or record the exact
blockers preventing that.

---

## Ad Hoc Proof Intent #1: Strict Diagnostic Harness After B1-B4

### What happened

Commits `fe09c44` through `3f2fd52` (2026-03-15) restored the strict diagnostic
harness and then applied four backend truth fixes:

- B1 (`60a03ec`): derive uploaded XP geometry from L0 metadata
- B2+B3 (`f23d2b8`): persist full XP layer set in workbench session
- B4 (`3f2fd52`): preserve uploaded XP layers on workbench export

After B4, the harness was run against the inspector path. It failed because the
`dblclick` → `openInspector()` interaction path did not open the inspector as
expected. Claude misdiagnosed this as the inspector needing "auto-open on load"
behavior (see PLAYWRIGHT_FAILURE_LOG.md lines 451-517).

### Was this acceptance evidence?

**No.** The harness uses inspector-centric actions (`open_frame` via dblclick,
`#cellInspectorPanel` wait, `#inspectorGlyphCode` fills, `#cellInspectorCanvas`
clicks). Even if it had passed, it would only prove the inspector path works —
not that the whole-sheet editor (the parity target) works.

### Can it be represented canonically?

**Yes, as a diagnostic case.** The existing verifier with `--mode diagnostic`
can run the exact same inspector-centric recipe. This is now the default mode.

**No, as an acceptance case.** The inspector path is not the acceptance target.
To test the same XP file through the acceptance path, run with
`--mode acceptance` — this generates whole-sheet actions instead.

### Current canonical replay command

```bash
# Diagnostic replay of the B1-B4 inspector proof intent
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --mode diagnostic --headed
```

### Expected outcome

Will fail honestly on:
- `ui_gap`: no user-reachable XP import control (scaffolding via API)
- `ui_missing`: inspector selectors may not be available depending on UI state
- geometry/layer mismatches if backend still has issues

This is correct behavior — the inspector diagnostic path should expose real
blockers without being confused for acceptance.

---

## Ad Hoc Proof Intent #2: Whole-Sheet Editor Visual Verification

### What happened

Commits `49c940b` through `26fb431` (2026-03-15 to 2026-03-16) implemented the
whole-sheet editor slice:

- `49c940b`: mounted whole-sheet Canvas editor surface into workbench
- `8846413`: advanced whole-sheet editing with layer truth and cell-draw
- `26fb431`: added whole-sheet eyedropper and erase tools

Verification of these features was done by manual browser interaction — loading
the workbench, uploading an XP file, observing the whole-sheet canvas rendering,
drawing cells, using eyedropper, using erase. No canonical verifier was run
because the verifier had no whole-sheet action support.

### Was this acceptance evidence?

**No.** Manual browser interaction is ad hoc proof. It cannot be cited as
acceptance evidence per the protocol.

### Can it be represented canonically?

**Yes, now.** With the `--mode acceptance` addition to recipe_generator.py and
run_fidelity_test.mjs, the canonical verifier can now generate and execute
whole-sheet recipes.

### Current canonical replay command

```bash
# Acceptance replay of the whole-sheet editing proof intent
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --mode acceptance --headed
```

### Actual run result (2026-03-16)

Run was terminated after the recipe executor began painting 10,080 cells (too
slow for this session). Failures captured before termination:

1. `[FAIL:ui_gap]` — no user-reachable XP import control (expected, honest)
2. `[FAIL:frame_layout]` — session metadata missing `frame_rows`/`frame_cols`
   (real gap: the live session `#metaOut` JSON does not expose these fields,
   so the independent frame_layout check correctly fails)

No result.json was produced (process killed before `finally` block). The two
failures above are honest and represent real product/verifier gaps.

### Remaining verifier blockers for full acceptance

Even with `--mode acceptance` now implemented in the verifier, full acceptance
remains blocked by:

1. **No user-reachable XP import control** — the workbench has no file-input or
   button that lets the user load an `.xp` file into the whole-sheet editor
   through the shipped UI. The API upload scaffolding is recorded as a hard
   failure.

2. **Session metadata missing frame_rows/frame_cols** — the `#metaOut` JSON
   does not include `frame_rows` or `frame_cols`, so the acceptance-mode
   frame_layout check cannot verify frame structure from session metadata.
   This is a backend/frontend gap.

3. **Skin Dock not tested** — `skin_dock_pass` is always false. The verifier
   does not yet drive the Test Skin Dock / runtime path after export.

4. **New-file authoring not tested** — the verifier only tests existing-XP
   load/edit/export. The acceptance contract requires a second workflow family
   (new XP authoring from scratch) which has no verifier recipe.

5. **Multi-layer editing not expressed** — the acceptance recipe only paints
   layer 2 cells. The contract requires demonstrating that all layers are
   preserved and that layer switching works through user-reachable controls.

6. **10,080-cell painting is too slow** — painting every non-transparent L2
   cell one by one through Playwright clicks takes many minutes. A practical
   acceptance run may need a reduced-scope fixture or batch painting mechanism.

These are honest verifier limitations, not permission to bypass the verifier.

---

## Canonical Run Results (2026-03-16, final)

### Diagnostic run (proof intent #1)

```
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --mode diagnostic
```

Result: **FAIL** (2 failures), `overall_pass: false`

| Gate | Result | Detail |
|------|--------|--------|
| user_reachable_load_pass | false | no XP import UI |
| geometry_pass | **true** | B1 fix works: angles=8, anims=[1,8], projs=2 |
| frame_layout_pass | **true** | 144 frame tiles rendered correctly |
| all_layers_pass | false | export comparison not reached (fatal before export) |
| execute_pass | false | `#cellInspectorPanel` not visible after dblclick |
| cell_fidelity_pass | false | not reached |
| export_pass | false | not reached |
| skin_dock_pass | false | not testable |
| overall_pass | false | gate conjunction |

Note: `all_layers_pass` is now correctly false when the export comparison is
never reached. Previously it would report true from a layer-count-only check.

Report: `output/xp-fidelity-test/run-2026-03-16T10-53-43Z/result.json`

### Acceptance run (proof intent #2)

```
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --mode acceptance
```

Result: **FAIL** (terminated mid-execution, 2+ failures captured)

| Failure | Detail |
|---------|--------|
| ui_gap | no user-reachable XP import control |
| frame_layout | session metadata missing frame_rows/frame_cols |

Recipe now exercises all three whole-sheet tools (cell draw, eyedropper with
expected-value verification, erase) and all tool-switch paths. The recipe
reached recipe execution but was terminated during the 10,081-cell paint phase.
No result.json produced.

### What the acceptance recipe now covers vs what it does not

**Covered by the recipe** (tool exercise happens before bulk painting):

- Cell draw tool activation and painting
- Eyedropper tool: switch to eyedropper → sample a painted cell → verify
  glyph/fg/bg match expected values in the toolbar inputs
- Erase tool: switch to erase → erase a cell
- Tool switching: cell → eyedropper → erase → cell (full round-trip)
- Apply-mode toggle verification (glyph/fg/bg)
- Draw-state setting through toolbar inputs

**Not covered by the recipe** (honest limitations):

- Non-L2 layer editing or layer switching through whole-sheet UI
- Eyedropper/erase on non-L2 layers
- Apply-mode-restricted painting (e.g., glyph-only without changing fg/bg)
- Full-sheet painting of all 10,081 cells (takes too long for CI)

---

## Summary

| Proof Intent | Original Method | Canonical Mode | Run Outcome | Key Finding |
|---|---|---|---|---|
| #1: B1-B4 inspector harness | Inspector-centric Playwright | diagnostic | FAIL (honest) | Geometry/frame-layout pass, all_layers_pass correctly false (export not reached), inspector dblclick fails |
| #2: Whole-sheet visual check | Manual browser interaction | acceptance | FAIL (honest) | frame_layout gap in metadata; tool exercise actions (cell/eyedropper/erase) now in recipe but not yet validated end-to-end |
