# Claude Handoff - XP Fidelity Plan Status (2026-03-14)

## Purpose

This handoff captures the current resume point for the XP fidelity harness planning work.

Use this file when resuming:

- XP fidelity harness planning
- workbench upload/bootstrap contract changes for XP testing
- executor/oracle/recipe implementation sequencing

Do not use this file as the primary source for bundle/runtime restore truth; for that, read `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`.

---

## Handoff Snapshot

- Correct worktree for this task: `/Users/r/Downloads/asciicker-pipeline-v2`
- Branch: `feat/xp-fidelity-harness`
- HEAD at handoff refresh: `743da3d`
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

The XP fidelity plan is committed on this branch, but it is still a plan document. Treat code and current branch state as truth over the plan text when they diverge.

---

## What Is True Right Now

- The canonical doc stack for editor/doc truth is still:
  1. `AGENTS.md`
  2. `docs/INDEX.md`
  3. `docs/AGENT_PROTOCOL.md`
  4. `CLAUDE.md`
  5. current live branch/worktree state
  6. task-specific handoff
- Live workbench XP editing on audited `master` still uses the legacy inspector in `web/workbench.js`.
- `EditorApp` exists but is not embedded into the shipped workbench UI on `master`.
- The shipped editor modal/UI still does not match REXPaint-parity UX.
- XP fidelity is still not proven end-to-end.

For XP fidelity work specifically:

- The current direction is a user-action conformance harness:
  - oracle reads XP to truth table
  - recipe describes visible UI actions
  - executor uses visible DOM actions only after setup
  - verifier exports XP and compares against the oracle
- The plan is currently scoped to `upload-xp` single-frame sessions only.
- Multi-frame fidelity is explicitly deferred because the current setup path does not create matching non-`1,1,1` workbench geometry.

---

## Latest Plan Audit Result

As of the last audit/resume point on this branch, the XP fidelity plan is internally consistent on its core contract:

- unmodified `master`: setup aborts because `upload-xp` does not return `job_id`
- `feat/xp-fidelity-harness` after the backend prerequisite patch: setup completes and the harness should reach structured UI/fidelity failures until the UI path is sufficient

What is in better shape now:

- impossible direct `state.*` hydration via `page.evaluate` was removed from the plan
- the plan now uses `upload-xp -> job_id -> /workbench?job_id=... -> loadFromJob()`
- the `page.evaluate` boundary now matches the smoke-test implementation, including canvas read APIs
- the plan documents the `upload-xp -> job_id` prerequisite that this branch now implements
- single-frame scope is honest and matches the current upload path

---

## Backend Prerequisite Status

The backend prerequisite is implemented on `feat/xp-fidelity-harness`. It is still a prerequisite for `master`.

Implemented change on this branch:

- `upload-xp` saves uploaded XP bytes to disk
- `upload-xp` creates a minimal job record that `workbench_load_from_job(job_id)` can consume
- `upload-xp` sets `job_id` on the created `WorkbenchSession`
- `upload-xp` returns `job_id` in addition to `session_id`

Reason:

- this reuses the real `loadFromJob()` initialization path
- it avoids fake frontend state hydration
- it avoids adding a debug-only load surface
- it keeps the harness honest after setup

---

## Recommended Implementation Order

1. Verify the prerequisite directly:
   - `upload-xp` returns `job_id`
   - `workbench_load_from_job(job_id)` succeeds for uploaded XP jobs
2. Implement the smallest harness assets first:
   - `scripts/xp_fidelity_test/create_fixture.py`
   - `scripts/xp_fidelity_test/truth_table.py`
   - `scripts/xp_fidelity_test/recipe_generator.py`
3. Implement `scripts/xp_fidelity_test/run_fidelity_test.mjs`.
4. Run the first end-to-end attempt against the 5x3 fixture, not `sprites/player-0100.xp`.

---

## What Was Checked

- `python3 scripts/conductor_tools.py status --auto-setup` -> `READY`
- `python3 scripts/self_containment_audit.py` -> required startup gate after 2026-03-14 enforcement patch
- `git status --short`
- `git branch --all`
- `git worktree list`
- `git stash list`
- current branch/HEAD
- current canonical docs:
  - `docs/INDEX.md`
  - `CLAUDE.md`
  - `docs/AGENT_PROTOCOL.md`
- current XP fidelity plan in:
  - `docs/plans/2026-03-13-xp-fidelity-test.md`
- relevant backend/frontend code paths:
  - `src/pipeline_v2/service.py`
  - `src/pipeline_v2/app.py`
  - `web/workbench.js`
  - `web/workbench.html`

## What Was Not Tested

- No successful runtime execution of the full XP fidelity harness yet
- No browser validation of the end-to-end roundtrip on this branch yet

---

## Known Blockers

- The backend prerequisite is not implemented on current `master`.
- The current workbench UI remains per-frame and not REXPaint-parity.
- XP fidelity remains unproven until the executor runs end-to-end and the exported XP is compared against the oracle.

---

## Exact Next Command

```bash
sed -n '1,260p' docs/2026-03-14-CLAUDE-HANDOFF-XP-FIDELITY-PLAN.md
```
