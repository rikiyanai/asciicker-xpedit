# Claude Handoff - XP Fidelity Pivot To New-XP Flow (2026-03-14)

## Purpose

Use this handoff for a fresh session that should continue XP fidelity work from the new requirement:

- the main acceptance criterion is no longer uploaded-source reconstruction
- the main acceptance criterion is true **blank-document XP authoring** through a visible `New XP` flow with chosen starting dimensions
- uploaded-XP reconstruction remains a secondary regression/control test

Do not resume from the older Task 6 handoff alone without reading this file first.

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

Startup state checked:

- `python3 scripts/conductor_tools.py status --auto-setup` -> `READY`
- `python3 scripts/self_containment_audit.py` -> `PASS`
- `scripts/git_guardrails.py audit` -> script missing in this checkout; record as absent, not run

Current modified-but-uncommitted files relevant to this task:

- `scripts/xp_fidelity_test/run_fidelity_test.mjs`
- `src/pipeline_v2/service.py`
- `docs/plans/2026-03-13-xp-fidelity-test.md`
- `scripts/xp_fidelity_test/README.md`
- `CLAUDE.md`
- `docs/INDEX.md`
- `docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-TASK6-PLAYWRIGHT.md`
- `docs/2026-03-14-CLAUDE-HANDOFF-XP-NEW-XP-FLOW.md`

Current untracked files:

- `.ccb/`
- `INTEGRATION_STRATEGY_AND_REPLAN.md`
- `REXPAINT_LIBRARY_AUDIT_FINDINGS.md`
- `findings/`

---

## What Is Complete

Committed work already on `master`:

- XP fixture generator, truth-table extractor, recipe generator, executor, wrapper, and README
- backend prerequisite so `upload-xp` returns `job_id`
- self-containment enforcement and git hooks
- committed XP assets:
  - `sprites/fidelity-test-5x3.xp`
  - `sprites/player-0000.xp`
  - `sprites/player-0100.xp`

Current runtime evidence already produced:

- fixture run reached export/compare and produced a real `xp_mismatch`
- latest artifact:
  - `output/xp-fidelity-test/fidelity-2026-03-14T09-46-11-645Z/result.json`

---

## Requirement Pivot

This is the important change.

The user clarified that the real requirement is:

1. a user can create a **new XP file from blank** with chosen starting dimensions
2. the UI can reproduce the target content through user-reachable actions
3. the exported XP matches the oracle
4. the resulting skin/runtime path loads without crashing
5. final visual sign-off is done by the user

That means:

- the current uploaded-XP harness is **not** the primary acceptance test
- it is only a useful regression/control path
- the product now needs a first-class **`New XP` flow**

Do not keep optimizing uploaded-bootstrap reconstruction as if it satisfies the main requirement.

---

## Current Contradictions / Misread Risks

The prior work drifted into a misleading assumption:

- "upload original XP -> recreate through UI -> export"

This is still a valid secondary test, but it is not "create from blank."

The user also caught a real contradiction in diagnosis:

- one explanation said export was effectively returning the original uploaded XP
- but the latest fixture report showed `0/15` matching cells

Those statements do not fit together.

Correct interpretation:

- the harness currently proves only that the browser got as far as export/compare
- the actual layer/edit/export wiring is still not fully understood
- no one should claim "it just exported the original" unless that is verified with code and layer-by-layer evidence

The right verification questions are:

1. which layer is the UI mutating?
2. which layer is export serializing?
3. which layer is the oracle comparing?

---

## What The Next Session Must Do

### Phase 1: Product UI / Session Creation

1. Implement a first-class **`New XP`** UI flow in the workbench.
2. Add a visible **`New XP` button or entry point** in the workbench.
3. Add visible **starting dimension inputs** for width and height.
4. Make that flow create a real editable/exportable blank session without uploaded-source bootstrap.

This phase is first on purpose. Do not start by rewriting the harness around uploaded-source bootstrap again.

### Phase 2: Harness / Recipe / Verifier Changes

After the `New XP` flow exists, change the XP fidelity harness bootstrap to:

   - open workbench
   - click `New XP`
   - enter dimensions
   - create blank document
   - run recipe from blank state

1. The recipe generator must assume **blank starting state**, not uploaded-source state.
2. The verifier still compares exported XP to the oracle.
3. The executor/setup path must drive the visible blank-document flow, not `upload-xp`.
4. The uploaded-XP reconstruction path should remain as a secondary control test, not the main gate.

### Phase 3: Validation Gates

1. Small blank-flow fixture pass:
   - recreate the 5x3 synthetic XP from blank
   - export
   - compare
2. Real XP case:
   - use a real native sprite as oracle target
   - minimum required case: `sprites/player-0000.xp`
   - next stress case: `sprites/player-0100.xp`
3. Runtime load test:
   - use the exported XP from the real-XP success case
   - run `scripts/workbench_png_to_skin_test_playwright.mjs --xp <exported_xp>`
   - confirm no crash/hard-fail
4. User visual sign-off:
   - leave final approval to the user

Short version:

1. add `New XP` button + dimension fields
2. make blank session creation work
3. then fix recipe generator / verifier / executor to use that blank flow
4. then prove fixture -> real XP -> runtime load test

---

## Current Dirty Changes Worth Preserving

Two in-progress code directions exist in the worktree and should be reviewed before discarding:

1. `scripts/xp_fidelity_test/run_fidelity_test.mjs`
   - restructures preflight into:
     - session-level controls first
     - open inspector
     - inspector-local controls second
   - switches `open_inspector` action from dblclick to:
     - click frame cell
     - click `#openInspectorBtn`
   - adjusts canvas click math to convert internal canvas coordinates to CSS click coordinates

2. `src/pipeline_v2/service.py`
   - for uploaded sessions with `family == "uploaded"`, export preserves original L0/L1/L3 and replaces only layer 2

These changes may still be useful for the secondary uploaded-XP regression path, even after the main requirement pivots to `New XP`.

---

## Exact Next Commands

Fresh-session resume:

```bash
sed -n '1,260p' docs/2026-03-14-CLAUDE-HANDOFF-XP-NEW-XP-FLOW.md
```

Relevant background docs after that:

```bash
sed -n '1,220p' docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-TASK6-PLAYWRIGHT.md
sed -n '1,220p' docs/plans/2026-03-13-xp-fidelity-test.md
sed -n '1,220p' PLAYWRIGHT_FAILURE_LOG.md
```

The next implementation discussion should begin with:

- what the visible `New XP` UI should be
- where session creation should live in `web/workbench.js` and server code
- how the recipe/bootstrap contract changes once blank-document creation exists
