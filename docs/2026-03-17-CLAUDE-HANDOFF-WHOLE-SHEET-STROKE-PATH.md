# Claude Handoff - Whole-Sheet Stroke Path (2026-03-17)

## Purpose

This handoff captures the narrow whole-sheet editor slice that reduced the heavy post-stroke redraw/reset path without broadening into new tools or verifier work.

Use this file when resuming:

- whole-sheet draw/perf follow-up
- parity audits for the whole-sheet path
- next-step sequencing after commit `843941c`

Do not use this file as Milestone 1 acceptance proof. It is a narrow implementation handoff for the stroke-end path only.

---

## Handoff Snapshot

- Branch: `master`
- HEAD: `63e30ce`
- Completed:
  - reduced whole-sheet stroke-end redraw churn by replacing `renderAll()` with a targeted refresh in `web/workbench.js` (`843941c`)
  - added this handoff and indexed it in `docs/INDEX.md` (`63e30ce`)
- Deferred:
  - full verifier / recipe run (reason: current editor workflow is still not representative enough to make the expensive canonical run high-signal)
  - layer-panel parity work (reason: kept this slice narrow to post-stroke heaviness/reset)
  - non-uploaded-session non-layer-2 save gap (reason: pre-existing reachable product bug, not introduced in `843941c`)
- Open Risks:
  - `scripts/xp_fidelity_test/run_fidelity_test.mjs` is still dirty in the worktree from an intentionally uncommitted fallback fix
  - the whole-sheet UI appears to allow editing layers other than layer 2, but non-uploaded saves still derive `cells` from `layers[2]`
  - active/visible layer changes still route through `renderAll()`, so stroke-end lag may be improved while other heavy transitions remain
- Resume:
  - `sed -n '1,260p' docs/2026-03-17-CLAUDE-HANDOFF-WHOLE-SHEET-STROKE-PATH.md`

---

## What Changed In `843941c`

File changed:

- `web/workbench.js`

Exact slice:

- whole-sheet `onStrokeComplete` no longer calls `renderAll()`
- it now performs a targeted post-stroke refresh:
  - `renderFrameGrid()`
  - `renderPreviewFrame(...)`
  - `updateSessionDirtyBadge()`
  - `updateUndoRedoButtons()`
  - `saveSessionState("whole-sheet-draw")`

What this intentionally stops doing after each stroke:

- legacy grid rebuild
- source canvas redraw
- inspector redraw
- metadata/session summary refresh
- `syncWholeSheetFromState()` round-trip back into the editor that already owns the stroke

---

## Verification Status

Verified directly in this pass:

- `python3 scripts/conductor_tools.py status --auto-setup` -> `READY`
- `node --check web/workbench.js` -> pass
- narrow git diff review confirmed `843941c` only changes the whole-sheet stroke-end callback

Reported from the active Claude fixes pass, but not re-run in this handoff pass:

- real browser whole-sheet strokes were used rather than callback invocation as proof
- 3 strokes accumulated undo history correctly
- session saved after each stroke
- edited cell data changed as expected
- frame grid remained intact
- undo still worked and the editor stayed mounted

Treat the reported browser check as session evidence for this slice, not as Milestone 1 acceptance evidence.

---

## Current Product Read

What is better now:

- the highest-frequency whole-sheet action no longer triggers the legacy `renderAll()` sledgehammer on every completed stroke
- the committed slice matches the stated priority: fix heaviness/reset before adding more tools

What is still not done:

- no shipped new-file authoring flow
- no Skin Dock/runtime pass for Milestone 1
- layer panel still has parity gaps versus REXPaint: order, lock, add/delete, reorder
- verifier/recipe path is stronger, but still too expensive and not yet representative of the full target workflows

---

## Next Recommended Order

1. Audit the still-dirty `scripts/xp_fidelity_test/run_fidelity_test.mjs` change and either commit it separately or discard it explicitly.
2. Fix the reachable save-contract gap for non-uploaded sessions if whole-sheet layer switching away from layer 2 remains user-reachable.
3. Continue the structure-first parity pass on the layer panel: order, lock, add/delete, then reorder.
4. Re-evaluate whether one end-to-end canonical workflow is coherent enough to justify the full verifier/recipe run.

---

## Worktree Notes

Dirty or untracked items present when this handoff was written:

- modified: `scripts/xp_fidelity_test/run_fidelity_test.mjs`
- untracked: `.ccb/`
- untracked: `INTEGRATION_STRATEGY_AND_REPLAN.md`
- untracked: `REXPAINT_LIBRARY_AUDIT_FINDINGS.md`
- untracked research under `docs/research/ascii/2026-03-15-*`
- untracked `findings/`

Those files were not included in `843941c`.
