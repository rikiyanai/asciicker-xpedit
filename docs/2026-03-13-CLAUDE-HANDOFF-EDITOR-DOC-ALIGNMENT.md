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
- Working tree path: `/Users/r/Downloads/asciicker-pipeline-v2`
- Scope completed in `ba42a63`:
  - added canonical doc hub `docs/INDEX.md`
  - added root `CLAUDE.md`
  - aligned `docs/AGENT_PROTOCOL.md` source order with the new canonical stack
  - marked March 4 editor plan docs as design/inventory docs instead of shipped-state truth
  - added evidence-backed audit `docs/research/ascii/2026-03-13-claim-verification.md`

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
- Some tests and older docs still contain obsolete 7-byte XP assumptions.
- `EditorApp` and the live workbench inspector remain separate implementations.
- The new canonical stack exists, but more old docs may still need historical labeling as future cleanup.

---

## Exact Next Command

```bash
sed -n '1,260p' docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md
```
