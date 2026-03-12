# Branch Consolidation and Merge Plan

## Status

This document was stale after the failed 2026-03-12 step-1/step-2 attempt. The old plan assumed plain `restore/bundle-override-filter-8279e11` was the known-good merge source. That is incomplete.

The canonical bundle checkpoint is the current dirty main worktree on top of `restore/bundle-override-filter-8279e11@89b7d06`, verified by:

- `/Users/r/Downloads/workbench-ui-recording-2026-03-11T13-27-24-653Z.json`
- [result.json](/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-headed-replay-2026-03-12T13-56-16-164Z/result.json)

Exact checkpoint sequence:

1. `Attack`
2. `Death`
3. `Idle / Walk`
4. `Test Bundle Skin`

Expected terminal state:

- `Bundle: 3/3 actions converted`
- `Applied bundle skin`

## Current Branch / Worktree Reality (2026-03-12)

- main worktree `/Users/r/Downloads/asciicker-pipeline-v2`
  - branch: `restore/bundle-override-filter-8279e11`
  - base commit: `89b7d0616853276043cccd6130b1463700742c7d`
  - required dirty delta:
    - `web/workbench.html`
    - `web/workbench.js`
    - `scripts/workbench_bundle_manual_watchdog.mjs`
    - `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
    - `docs/AGENT_PROTOCOL.md`
- clean worktree `/Users/r/Downloads/asciicker-pipeline-v2-clean-wt`
  - branch: `phase2-death-template`
  - commit: `8279e11ca712f1a19c68417e89727f4446efbcc5`
- extra worktree `/Users/r/Downloads/asciicker-pipeline-v2/.worktrees/sprite-extraction-dual-analysis`
  - branch: `feat/sprite-extraction-dual-analysis`
  - commit: `52419fe5b563b25eb9be75c67492f60e0f8b0ef4`
  - user decision: disposable, do not include in current consolidation
- integration candidate base:
  - `feat/workbench-mcp-server` @ `2ebfe6a0ff7076c7466e6d463e72f1f83648c1a3`
  - divergence vs `restore`: `71 6`

## Why The Old Step 1 / Step 2 Failed

1. Step 1 preserved the dirty checkpoint as a side commit, but did not make that exact checkpoint the merge source.
2. Step 2 merged plain `restore/bundle-override-filter-8279e11`, which omitted the dirty bundle-baseline delta.
3. That omitted at least two important things:
   - the UI recorder/checkpoint hooks
   - the empty-action-tab fix in `web/workbench.js` (`renderLegacyGrid()` / `renderFrameGrid()` instead of the dead `renderGrid()` path)
4. Validation was then attempted with a stale idle-first watchdog script instead of the real recorded order.

## Re-Audit Of Step 1

Step 1 is still necessary, but it must preserve the exact dirty checkpoint and keep it runnable in place.

Correct Step 1:

1. Do not move the main worktree off `restore`.
2. Create a dedicated checkpoint branch from the current dirty state, for example `checkpoint/bundle-watchdog-baseline-20260312`.
3. Commit the exact dirty delta to that branch:
   - `web/workbench.html`
   - `web/workbench.js`
   - `scripts/workbench_bundle_manual_watchdog.mjs`
   - the handoff/protocol doc updates
4. Leave the main worktree parked on the same dirty checkpoint for manual comparison runs.

Why:

- the known-good bundle checkpoint is not reproducible from plain `89b7d06` alone
- step 2 needs a merge source that actually contains the verified bundle behavior

## Re-Audit Of Step 2

Step 2 should still use `feat/workbench-mcp-server` as the integration base, but it must merge the exact checkpoint branch from Step 1, not plain `restore`.

Correct Step 2:

1. Create a fresh worktree from `feat/workbench-mcp-server`.
2. Create a new integration branch there, for example `integrate/mcp-restore-baseline-20260312`.
3. Merge `checkpoint/bundle-watchdog-baseline-20260312` into that branch.
4. Resolve conflicts with this policy:
   - `web/workbench.js`: prefer the checkpoint branch first
   - `web/workbench.html`: prefer the checkpoint branch first
   - `runtime/termpp-skin-lab-static/**`: prefer the checkpoint/restore side for bundle/runtime truth
   - `src/pipeline_v2/app.py`, `src/pipeline_v2/service.py`, `src/pipeline_v2/xp_codec.py`: merge carefully, then rerun upload/export smoke
   - `web/rexpaint-editor/*` and any modal wiring from `feat/workbench-mcp-server`: do not let that displace the working bundle shell during this step
5. Run the canonical headed bundle checkpoint on the integration branch before any editor wiring.

Why:

- `feat/workbench-mcp-server` contains editor-side work, but its workbench shell diverges from the proven bundle shell
- the biggest risk is `web/workbench.js` / `web/workbench.html`, not the small backend diff

## Focused Conflict / Risk Inventory

High-risk files:

- `web/workbench.js`
  - `feat/workbench-mcp-server` has different web-skin apply/test flow and editor-related divergence
  - the checkpoint branch contains the proven bundle path and empty-tab fix
- `web/workbench.html`
  - `feat/workbench-mcp-server` carries REXPaint modal markup and stylesheet hookup
  - the checkpoint branch is the proven bundle UI shell
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.data`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.wasm`
  - binary conflicts expected; these must follow the checkpoint/restore runtime line

Medium-risk files:

- `src/pipeline_v2/app.py`
- `src/pipeline_v2/service.py`
- `src/pipeline_v2/xp_codec.py`
- `scripts/workbench_png_to_skin_test_playwright.mjs`
- `web/termpp_flat_map_bootstrap.js`

Known audit findings:

- `git merge-tree` already warns about binary conflicts in the runtime bundle
- the dirty baseline delta is only `web/workbench.html` and `web/workbench.js`, but that delta is behavior-critical
- `feat/sprite-extraction-dual-analysis` is not needed for the current merge and should stay out

## Verification Gate For The New Step 2

The integration branch does not pass Step 2 unless all of these hold:

1. API smoke:
   - `POST /api/workbench/upload-xp` returns `201`
   - `POST /api/workbench/export-xp` for that session returns `200`
2. Bundle checkpoint, headed:
   - `Attack`
   - `Death`
   - `Idle / Walk`
   - `Test Bundle Skin`
3. Final status matches:
   - `Bundle: 3/3 actions converted`
   - `Applied bundle skin`
4. No new workbench regression is introduced when switching into an empty action tab

## Handoff Snapshot

- Branch: `restore/bundle-override-filter-8279e11`
- HEAD: `89b7d0616853276043cccd6130b1463700742c7d`
- Completed:
  - Canonical bundle checkpoint identified from saved recording and fresh headed replay
- Deferred:
  - Step 1 exact checkpoint branch creation
  - Step 2 integration re-run from that checkpoint branch
- Open Risks:
  - `web/workbench.js` / `web/workbench.html` divergence with `feat/workbench-mcp-server`
  - binary runtime conflicts under `runtime/termpp-skin-lab-static`
- Resume:
  - create the exact dirty checkpoint branch first, then merge that branch into a fresh `feat/workbench-mcp-server` worktree
