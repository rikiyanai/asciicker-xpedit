# Claude Handoff - Editor Doc Alignment (2026-03-13)

## Purpose

This handoff captures the doc-alignment pass that made the agent-facing canonical stack usable again for editor/doc work on this repository.

Use this file when resuming:

- editor implementation status audits
- plan/doc cleanup
- canonical source reconciliation

Do not use this file as the primary source for bundle/runtime restore truth; for that, read `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`.

---

## Handoff Snapshot

- Branch: `master`
- Base aligned-docs commit: `ba42a63`
- Follow-up doc-corrections commit: *(see commit hash below)*
- Working tree path: `/Users/r/Downloads/asciicker-pipeline-v2`
- Scope completed in `ba42a63`:
  - added canonical doc hub `docs/INDEX.md`
  - added root `CLAUDE.md`
  - aligned `docs/AGENT_PROTOCOL.md` source order with the new canonical stack
  - marked March 4 editor plan docs as design/inventory docs instead of shipped-state truth
  - added evidence-backed audit `docs/research/ascii/2026-03-13-claim-verification.md`
- Scope completed in follow-up commit:
  - downgraded `docs/2026-03-10-readonly-investigation-rexpaint-state.md` from completion language to `partial/not integrated`
  - marked 7-byte XP findings in `docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md` as superseded by `a26be4a`
  - added audit banner to `docs/FEATURE_BUTTON_INDEX_WITH_REXPAINT_MANUAL.md` clarifying standalone vs integrated
  - relabeled stale 7-byte comments in 3 test files (comment-only; fixture code is a deferred issue)
  - expanded `docs/INDEX.md` with REXPaint reference docs, editor planning docs, font/palette asset inventory, and local research pointers
  - updated this handoff with findings and deferred issues

---

## What Is Now Canonical

Read in this order:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. current branch/worktree state
6. this handoff
7. focused subsystem docs

For editor/doc truth on audited `master`:

- live workbench editing still uses the legacy inspector in `web/workbench.js`
- `EditorApp` exists in `web/rexpaint-editor/*` but is not embedded into shipped workbench on audited `master`
- JS XP codec code now uses 10-byte REXPaint cells
- `window.__wb_debug` is the live browser automation surface for the legacy inspector path

---

## What Changed

### Canonical stack restored

- `docs/INDEX.md` now exists and names the current read order.
- `CLAUDE.md` now exists and records short-lived repo memory.
- `docs/AGENT_PROTOCOL.md` now points agents to the March 13 audit/handoff for editor/doc tasks and keeps the March 11 handoff for branch/bundle history.

### Plan docs downgraded to match reality

- `docs/plans/2026-03-04-web-rexpaint-editor/claude-embedded-editor-plan.md`
  - clearly marked as a design brief, not shipped-state truth
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-grid-editor-integration.md`
  - explicitly scoped to the legacy inspector path in `web/workbench.js`
- `docs/plans/2026-03-04-web-rexpaint-editor/xp-editor-feature-inventory.md`
  - corrected to stop counting `EditorApp` undo/redo as complete
  - warns that test counts are not current verification evidence

### Claim verification captured

- `docs/research/ascii/2026-03-13-claim-verification.md`
  - records the main contradictions between recent Claude/editor docs and current code

### Doc corrections applied (follow-up pass)

- `docs/2026-03-10-readonly-investigation-rexpaint-state.md`
  - added audit banner; changed "~75% complete" to "substantial implementation, not integrated"; fixed undo/redo claims; fixed test result claims
- `docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md`
  - added audit banner; marked Issue 1 (7-byte) as superseded by `a26be4a`; added update note after fix-required section
- `docs/FEATURE_BUTTON_INDEX_WITH_REXPAINT_MANUAL.md`
  - added audit banner clarifying `EditorApp` references describe standalone module, not live workbench

### Canonical trail expanded

- `docs/INDEX.md` now references 10 previously-orphaned docs:
  - 3 REXPaint reference/UI docs (`REXPAINT_UI_COMPLETE_INDEX`, `FEATURE_BUTTON_INDEX`, `COMPLETE_UI_CONTROL_REFERENCE`)
  - 2 editor planning docs (`claude-workbench-ui-inventory`, `claude-cp437-font-research`)
  - 2 investigation reports (`readonly-investigation`, `DELIVERABLE-AUDIT-REPORT`)
  - 5 local/untracked research files (`REXPAINT_LIBRARY_AUDIT_FINDINGS`, `findings/INDEX`, 3 findings)
- Font asset inventory added: 13 CP437 PNGs present in `runtime/termpp-skin-lab-static/` (two variant trees)
- Palette asset absence documented: no `.pal` files exist; palette is code-only in `web/rexpaint-editor/palette.js`

### Test comment relabeling

- `tests/web/rexpaint-editor-xp-file-reader.test.js` — relabeled 7-byte comment at line 479
- `tests/web/rexpaint-editor-xp-file-writer.test.js` — relabeled 7-byte comments at lines 11, 347
- `tests/web/rexpaint-editor-xp-integration.test.js` — relabeled 7-byte comment at line 139

---

## What Was Tested

- `python3 scripts/conductor_tools.py status --auto-setup` -> `READY`
- source inspection of:
  - `web/workbench.html`
  - `web/workbench.js`
  - `web/rexpaint-editor/editor-app.js`
  - `web/rexpaint-editor/xp-file-reader.js`
  - `web/rexpaint-editor/xp-file-writer.js`
- git state inspection:
  - `git status --short`
  - `git branch --all`
  - `git worktree list`
  - `git stash list`

## What Was Not Tested

- No runtime/browser validation of the workbench UI in this doc-alignment pass.
- No editor test suite pass. Direct `node tests/...` execution is still broken under the current CommonJS package configuration while those test files use ESM `import`.

---

## Known Risks / Open Items

- `master` should still be treated as `stale/unknown` for bundle-restore truth unless the task explicitly re-audits branch/runtime state.
- `EditorApp` and the live workbench inspector remain separate implementations.
- The new canonical stack exists, but more old docs may still need historical labeling as future cleanup.

### Deferred code issues (7-byte XP test fixtures)

Three test files construct actual 7-byte binary XP blobs in their fixtures, not just comments. Comments have been relabeled as STALE, but the fixture code itself still needs repair:

- `tests/web/rexpaint-editor-xp-file-reader.test.js` — 6 locations: buffer allocation with `* 7`, manual byte packing at `offset += 7` (lines 479-492, 529, 539-545, 580, 621)
- `tests/web/rexpaint-editor-xp-file-writer.test.js` — implicit 7-byte expectations in tested code paths
- `tests/web/rexpaint-editor-xp-integration.test.js` — 6+ locations: same `* 7` pattern (lines 139-152, 187, 191-198, 203, 207-214)

All three files also use ESM `import` statements but the repo's `package.json` declares `"type": "commonjs"`, so direct `node tests/...` execution fails with `SyntaxError`. Both issues (fixture byte size and module format) need to be resolved together before these tests can serve as verification evidence.

### Local / untracked research

The following files exist in this worktree but are not committed to `master`. They are referenced in `docs/INDEX.md` as local research output.

- `REXPAINT_LIBRARY_AUDIT_FINDINGS.md` — library audit (root-level, untracked)
- `findings/INDEX.md` — findings index; 4 of 11 findings were contradicted by code inspection. Read the full findings set as research output, not as accepted truth.
- `findings/09-FINDING-rexpaint-manual-coverage.md`
- `findings/10-FINDING-xp-editor-feature-audit.md`
- `findings/11-FINDING-manual-gaps-checker.md`
- `INTEGRATION_STRATEGY_AND_REPLAN.md` — not reviewed in this pass

---

## Exact Next Command

```bash
sed -n '1,300p' docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md
```
