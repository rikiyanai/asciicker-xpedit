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

## REXPaint Reference & UI Docs

- `docs/REXPAINT_UI_COMPLETE_INDEX.md`
  - REXPaint v1.70 complete UI index extracted from live screenshots; reference implementation, not asciicker-specific
- `docs/FEATURE_BUTTON_INDEX_WITH_REXPAINT_MANUAL.md`
  - feature button reference + REXPaint v1.70 manual text; references `EditorApp` methods but these describe the standalone module, not proof of live workbench integration
- `docs/COMPLETE_UI_CONTROL_REFERENCE.md`
  - 189 workbench UI elements + REXPaint manual appendix; notes Section 14 (inspector) planned for replacement by `EditorApp`

## Editor Planning & Research

- `docs/plans/2026-03-04-web-rexpaint-editor/claude-workbench-ui-inventory.md`
  - exhaustive workbench.html/js UI element inventory (189 elements, handler-level detail)
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-cp437-font-research.md`
  - CP437 bitmap font rendering research; lists font atlas filenames (cp437_8x8 through cp437_40x40); recommends Canvas 2D pre-tinted atlas caching
- `docs/2026-03-10-readonly-investigation-rexpaint-state.md`
  - readonly investigation of standalone `EditorApp` module; historical — see 2026-03-13 audit banner for current caveats
- `docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md`
  - deliverable audit identifying XP cell format mismatch; Issue 1 (7-byte vs 10-byte) superseded by `a26be4a`

## Local / Untracked Research (not committed)

The following files exist in this worktree but are not committed to `master`. They are research output and should be read with caution — the `findings/INDEX.md` summary shows 4 of 11 findings were contradicted by code inspection.

- `REXPAINT_LIBRARY_AUDIT_FINDINGS.md`
  - audit of 30+ REXPaint libraries across 6 languages; recommends rexpaintjs-fork (JS), pyrexpaint (Python)
- `findings/INDEX.md`
  - findings index (11 findings: 5 verified, 4 contradicted, 1 partial, 1 verified-with-gaps)
- `findings/09-FINDING-rexpaint-manual-coverage.md`
  - REXPaint manual coverage analysis (~94 features, 50-55% implemented)
- `findings/10-FINDING-xp-editor-feature-audit.md`
  - 67-feature audit: 38 fully implemented (56.7%), 3 partial, 26 missing
- `findings/11-FINDING-manual-gaps-checker.md`
  - 37 additional REXPaint features not covered in the 67-feature audit

## Font & Palette Assets

### Font assets (present)

13 CP437 PNG font atlases are present in the runtime tree at two locations:
- `runtime/termpp-skin-lab-static/termpp-web-flat/fonts/cp437_{4x4..40x40}.png` (with BDF/PSF metadata)
- `runtime/termpp-skin-lab-static/termpp-web/fonts/cp437_{4x4..40x40}.png` (PNGs only, no metadata)
- Build output copies also exist in `output/termpp-skin-lab-static/`

Font loader: `web/rexpaint-editor/cp437-font.js` accepts a spritesheet URL at construction time (16x16 glyph grid layout).

### Palette assets (not present)

No distinct palette asset files (`.pal`, `palette.json`, etc.) exist in the repo. Palette management is entirely code-based via `web/rexpaint-editor/palette.js` (RGB arrays in memory, no file persistence). If REXPaint `.pal` import/export is needed, it would require new code.

## Known Doc Caveats

- `CLAUDE.md` and `docs/INDEX.md` were missing before the 2026-03-13 doc-alignment pass; older handoffs may say they are absent.
- Some tests and docs still contain obsolete 7-byte XP assumptions even though current JS XP codec code uses 10-byte REXPaint cells. Three test files (`tests/web/rexpaint-editor-xp-file-{reader,writer,integration}.test.js`) construct actual 7-byte binary XP blobs in their fixtures — this is a deferred code issue.
- All editor test files use ESM `import` statements but the repo's `package.json` declares `"type": "commonjs"`, so direct `node tests/...` execution fails with `SyntaxError`.
- `EditorApp` exists in `web/rexpaint-editor/*`, but the live workbench on audited `master` still edits through the legacy inspector in `web/workbench.js`.
- The finding that the editor modal/UI is still wrong for REXPaint-parity goals remains valid; existence of `EditorApp` modules does not mean the shipped UI matches REXPaint.
- XP-file fidelity is still not proven end-to-end. No canonical test currently exists for `read XP -> recreate/edit using only editor controls or browser API -> compare output XP to source XP`.
