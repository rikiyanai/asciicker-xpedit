# Claude Handoff - XP Fidelity Task 6 Playwright Resume (2026-03-14)

## Purpose

Use this handoff to continue the XP fidelity harness from the Playwright executor stage.

This is the current resume point for:

- Task 6 runtime execution of `scripts/xp_fidelity_test/run_fidelity_test.mjs`
- first end-to-end browser runs against the fixture and native sprite XP files
- failure triage from the real user-action-only harness
- post-fidelity runtime load testing of the produced skin

Do not use this file as the primary source for bundle/runtime restore history. For that, read `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`.

---

## Handoff Snapshot

- Correct worktree: `/Users/r/Downloads/asciicker-pipeline-v2`
- Branch: `master`
- HEAD: `bb3e4c42c991ef4b84daee08cfcada67b342718a`
- Secondary worktree present but not the current task target:
  - `/Users/r/Downloads/asciicker-pipeline-v2-xp-editor-wt`
  - branch `feat/workbench-xp-editor-wireup`
  - HEAD `4b56684`
- Stash count: `0`

Current untracked files in the main worktree:

- `.ccb/`
- `INTEGRATION_STRATEGY_AND_REPLAN.md`
- `REXPAINT_LIBRARY_AUDIT_FINDINGS.md`
- `findings/`

Current modified-but-uncommitted files relevant to this task:

- `scripts/xp_fidelity_test/run_fidelity_test.mjs`
- `src/pipeline_v2/service.py`
- `CLAUDE.md`
- `docs/INDEX.md`
- `docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-TASK6-PLAYWRIGHT.md`

Startup state checked for this handoff:

- `python3 scripts/conductor_tools.py status --auto-setup` -> `READY`
- `python3 scripts/self_containment_audit.py` -> `PASS`

---

## What Is Complete

Committed work already present on `master`:

- fixture XP generator: `c7c1528`
- truth table extractor: `bc26770`
- recipe generator: `744acd8`
- recipe fixes:
  - `470a032` skip transparent post-clear cells correctly
  - `7cbc129` tighten skip semantics + document upload defaults
- backend prerequisite (`upload-xp -> job_id`): `1f49c03`
- Playwright executor: `db3df6a`
- one-command wrapper + README: `0ced452`
- native game sprite fixture/test doc update: `743da3d`
- self-containment enforcement + hook gate: `c328dc7`
- `.mcp.json` machine-path cleanup: `bb3e4c4`

Current committed XP fidelity files:

- `scripts/xp_fidelity_test/create_fixture.py`
- `scripts/xp_fidelity_test/truth_table.py`
- `scripts/xp_fidelity_test/recipe_generator.py`
- `scripts/xp_fidelity_test/run_fidelity_test.mjs`
- `scripts/xp_fidelity_test/run.sh`
- `scripts/xp_fidelity_test/README.md`
- `docs/plans/2026-03-13-xp-fidelity-test.md`

Available committed test XP files:

- `sprites/fidelity-test-5x3.xp`
- `sprites/player-0000.xp`
- `sprites/player-0100.xp`

---

## What Is True Right Now

- The canonical startup stack remains:
  1. `AGENTS.md`
  2. `docs/INDEX.md`
  3. `docs/AGENT_PROTOCOL.md`
  4. `CLAUDE.md`
  5. current git/worktree reality
  6. this task handoff
- The repo is now machine-gated for self-containment:
  - hooks live in `.githooks/`
  - `scripts/self_containment_audit.py` hard-fails on external symlinks and live external absolute-path references
- The XP fidelity harness is scoped to `upload-xp` single-frame sessions.
- `upload-xp` now returns `job_id` on current `master`, so the executor should no longer setup-abort for that reason.
- The harness contract is still user-action-only after setup:
  - no `window.__wb_debug`
  - no direct workbench state mutation
  - only visible DOM interactions after boot
- The current harness is an edit/reconstruction roundtrip from uploaded-source bootstrap, not true from-scratch XP authoring from blank dimensions.
- The shipped editor UI is still the legacy per-frame inspector, not REXPaint-parity whole-sheet UI.

---

## Task 6 Target

Task 6 is no longer "write the Playwright executor." That code is already committed.

Task 6 now means:

1. Use the synthetic 5x3 fixture only as the first milestone.
2. Get a clean roundtrip pass on that fixture.
3. Then run the whole flow with a real native XP sprite:
   - required: `sprites/player-0000.xp`
   - preferred next stress case: `sprites/player-0100.xp`
4. After real-XP roundtrip, load test the resulting skin/runtime path and confirm it does not crash or hard-fail.
5. Leave final visual sign-off to the user.

The fixture is not the finish line. It exists to prove the harness and shake out obvious executor/export bugs cheaply before burning time on large sprites.

If product scope changes to "user can create a brand-new XP file from chosen starting dimensions," interrupt this line of work and treat that as a separate feature:

- add a first-class `New XP` UI flow
- define its starting-dimensions contract
- change the recipe/bootstrap model so the harness can begin from blank state instead of uploaded-source bootstrap

---

## Current Runtime Evidence

What has already happened in this worktree:

1. Initial fixture run produced a false preflight failure because the executor checked inspector child controls before opening the hidden inspector panel.
2. The current dirty `run_fidelity_test.mjs` patch restructures preflight so session-level controls are checked first, then the inspector is opened through the UI path, then inspector-local controls are checked.
3. The latest fixture run reached export/compare and failed as a real `xp_mismatch`, which is meaningful progress.

Latest recorded artifact:

- `output/xp-fidelity-test/fidelity-2026-03-14T09-46-11-645Z/result.json`

Latest recorded result:

- verdict: `FAIL`
- failure class: `xp_mismatch`
- mismatch summary: `15/15 cells differ between oracle and export`

Interpretation:

- the harness now gets far enough to export and compare
- the current blocker is fidelity of the edited/exported XP, not missing setup
- the synthetic fixture still has not passed

There is also a current dirty `service.py` patch:

- for sessions with `family == "uploaded"`, export preserves original L0/L1/L3 from the source XP and replaces only layer 2 with edited cells

This is relevant because real-XP roundtrip correctness depends on preserving non-edited layers instead of rebuilding everything with the native player-family export path.

---

## Acceptance Gates

Do not declare success until all of these are satisfied:

1. **Fixture roundtrip pass**
   - `sprites/fidelity-test-5x3.xp`
   - exported XP matches oracle on layer 2
   - no crash/setup abort

2. **Real XP roundtrip pass**
   - required: `sprites/player-0000.xp`
   - preferred next case: `sprites/player-0100.xp`
   - exported XP matches oracle on the tested editable layer
   - run is stable enough to complete without browser/workbench failure

3. **Runtime skin load test**
   - take the exported XP from the successful real-XP fidelity run
   - run the existing runtime Playwright skin smoke path against that XP
   - confirm the skin loads and the runtime does not crash or hard-fail

4. **User visual sign-off**
   - the user does final visual approval
   - automation is not the final art/UX sign-off

---

## Required Order

1. Start with the smallest fixture:
   - `sprites/fidelity-test-5x3.xp`
2. Fix the harness/export path until the fixture passes.
3. Then run the full flow on:
   - `sprites/player-0000.xp`
4. If that passes, run the larger real sprite:
   - `sprites/player-0100.xp`
5. For the first successful real-XP run, take the exported XP path from `result.json` and run the runtime skin smoke test.
6. After runtime smoke is stable, hand off to the user for visual sign-off.

---

## Known Risks / Open Items

- No successful end-to-end fixture roundtrip pass has been recorded in this worktree yet.
- The current real blocker has moved to XP fidelity/export mismatch, not setup.
- The executor may still hit real UI gaps, selector drift, export issues, or browser-action mismatches.
- XP fidelity remains unproven until exported XP is compared against the oracle and the result is inspected.
- Runtime skin stability is also unproven until the exported real-XP result is loaded through the runtime skin smoke path.
- The UI is still not REXPaint-parity; this harness validates the current shipped path, not future parity UX.

---

## Exact Next Commands

In terminal 1:

```bash
cd /Users/r/Downloads/asciicker-pipeline-v2
PYTHONPATH=src python3 -m pipeline_v2.app
```

In terminal 2:

```bash
cd /Users/r/Downloads/asciicker-pipeline-v2
scripts/xp_fidelity_test/run.sh sprites/fidelity-test-5x3.xp --headed
```

If that completes and writes a report, inspect the latest result:

```bash
ls -td output/xp-fidelity-test/fidelity-* | head -n 1
```

Then open the report:

```bash
sed -n '1,260p' "$(ls -td output/xp-fidelity-test/fidelity-* | head -n 1)/result.json"
```

After the fixture passes, try the first native sprite:

```bash
scripts/xp_fidelity_test/run.sh sprites/player-0000.xp --headed
```

After the first successful real-XP roundtrip, extract the exported XP path and run the runtime skin smoke test:

```bash
RESULT_JSON="$(ls -td output/xp-fidelity-test/fidelity-* | head -n 1)/result.json"
EXPORT_XP="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["export"]["xp_path"])' "$RESULT_JSON")"
node scripts/workbench_png_to_skin_test_playwright.mjs --url http://127.0.0.1:5071/workbench --xp "$EXPORT_XP" --timeout-sec 120 --move-sec 2 --headed
```

If `player-0000.xp` is stable, repeat the same flow for the larger real sprite:

```bash
scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --headed
```

To resume from this handoff in a fresh session:

```bash
sed -n '1,260p' docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-TASK6-PLAYWRIGHT.md
```
