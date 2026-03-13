# Docs Index

Canonical doc hub for agents working in `/Users/r/Downloads/asciicker-pipeline-v2`.

## Current Branch Truth

- Audit date: 2026-03-13
- Audited worktree: `/Users/r/Downloads/asciicker-pipeline-v2`
- Audited branch: `master`
- Audited HEAD before doc-alignment commits: `5caeb07`
- Branch role on this worktree: `stale/unknown` for bundle-restore truth until a task-specific audit proves otherwise

Do not assume `master` is the canonical restore/bundle line. For bundle/runtime issues, read the branch-history handoff below before making fix claims.

## Canonical Read Order

1. `AGENTS.md`
2. this file
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. current live branch/worktree state
6. latest task-relevant handoff
7. focused subsystem docs and plan docs

If a lower-priority doc conflicts with a higher-priority source or with current code, treat the lower-priority doc as historical until corrected.

## First Reads By Task

### Any agent startup

- `AGENTS.md`
- `docs/AGENT_PROTOCOL.md`
- `CLAUDE.md`

### Editor/doc status or plan audits

- `docs/research/ascii/2026-03-13-claim-verification.md`
- `docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md`

### Bundle/runtime/restore regressions

- `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
- `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`

## Active High-Signal Docs

- `docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md`
  - current Claude resume point for doc alignment and editor-status truth
- `docs/research/ascii/2026-03-13-claim-verification.md`
  - evidence-backed audit of recent Claude/editor document claims against current code
- `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
  - historical branch/bundle handoff; still important for restore-line truth, but not the default source for editor implementation status on `master`
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-embedded-editor-plan.md`
  - design brief only; not shipped-state truth
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-grid-editor-integration.md`
  - accurate legacy-inspector analysis; not proof of `EditorApp` embedding
- `docs/plans/2026-03-04-web-rexpaint-editor/xp-editor-feature-inventory.md`
  - historical feature inventory with 2026-03-13 audit corrections

## Known Doc Caveats

- `CLAUDE.md` and `docs/INDEX.md` were missing before the 2026-03-13 doc-alignment pass; older handoffs may say they are absent.
- Some tests and docs still contain obsolete 7-byte XP assumptions even though current JS XP codec code uses 10-byte REXPaint cells.
- `EditorApp` exists in `web/rexpaint-editor/*`, but the live workbench on audited `master` still edits through the legacy inspector in `web/workbench.js`.
