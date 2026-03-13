# Claude Memory

Use this file as short-lived repo memory, not as proof over code.

## Startup

- Run `python3 scripts/conductor_tools.py status --auto-setup` first.
- Then read `docs/INDEX.md` and `docs/AGENT_PROTOCOL.md`.

## Current High-Signal Truths

- As of the 2026-03-13 audit, the shared worktree at `/Users/r/Downloads/asciicker-pipeline-v2` was on `master` at `5caeb07` and should be treated as `stale/unknown` for bundle-restore truth until re-audited.
- Live workbench XP editing still runs through the legacy inspector in `web/workbench.js`; `EditorApp` is not embedded into shipped workbench on audited `master`.
- `EditorApp.undo()` / `redo()` are still TODO stubs in the audited codepath.
- Current JS XP codec code uses 10-byte REXPaint cells; older docs/tests may still mention 7-byte cells.
- `window.__wb_debug` is the live browser automation surface for the workbench inspector path.

## Do Not Assume

- Do not assume `master` contains the known-good bundle restore line.
- Do not treat March 4-10 editor plan docs as shipped-state truth without checking current code.
- Do not use editor test counts as verification evidence until the CommonJS/ESM runner mismatch is fixed.

## First Reads By Topic

- Editor/doc alignment: `docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md`
- Claim verification: `docs/research/ascii/2026-03-13-claim-verification.md`
- Bundle/runtime restore history: `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
