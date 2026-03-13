# 2026-03-13 Claim Verification Audit

## Scope

Audit of recent Claude/editor documents against the current repository state.

Primary docs audited:

1. `docs/2026-03-10-readonly-investigation-rexpaint-state.md`
2. `docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md`
3. `docs/plans/2026-03-04-web-rexpaint-editor/claude-embedded-editor-plan.md`
4. `docs/plans/2026-03-04-web-rexpaint-editor/claude-grid-editor-integration.md`
5. `docs/plans/2026-03-04-web-rexpaint-editor/xp-editor-feature-inventory.md`

Date: 2026-03-13  
Repo: `/Users/r/Downloads/asciicker-pipeline-v2`  
Branch: `master` (`5caeb07`)  
Branch role: `stale/unknown` for canonical bundle truth; audit below is limited to current code in this worktree.

## Preflight

- `python3 scripts/conductor_tools.py status --auto-setup` -> READY
- `python3 scripts/git_guardrails.py audit` -> unavailable in this repo (script missing)
- `git status --short` -> untracked: `.ccb/`, `INTEGRATION_STRATEGY_AND_REPLAN.md`, `REXPAINT_LIBRARY_AUDIT_FINDINGS.md`, `findings/`
- `git branch --all` -> current branch `master`; alternate local branch `feat/workbench-xp-editor-wireup`
- `git worktree list` -> main worktree on `master`, secondary worktree on `feat/workbench-xp-editor-wireup`
- `git stash list` -> empty
- Canonical doc drift noted:
  - `docs/INDEX.md` missing
  - `CLAUDE.md` missing

## Claim Checks

### Claim A

Claim text: the modular REXPaint `EditorApp` is the embedded editor path for the live workbench flow.

- Verification commands:
  - `nl -ba web/workbench.html | sed -n '392,410p'`
  - `nl -ba web/workbench.js | sed -n '5180,5315p'`
  - `nl -ba web/workbench.js | sed -n '6068,6105p'`
  - `rg -n "window\\.rexpaintEditor|fillRegion|readRegion|validate" web/rexpaint-editor web/workbench.js`
- Evidence:
  - `web/workbench.html` only loads `/workbench.js`; no `web/rexpaint-editor/*` script is imported.
  - `Open XP Editor` still routes to `openInspector(...)` in `web/workbench.js:5192-5199` and `web/workbench.js:5266-5273`.
  - Layer changes and inspector navigation still re-render the legacy inspector path in `web/workbench.js:6075-6105`.
  - No `window.rexpaintEditor`, `fillRegion`, `readRegion`, or `validate()` surface exists in live workbench code.
- Commit evidence:
  - `e7f72e1` for current `web/workbench.js` / `web/workbench.html` state
- Verification evidence:
  - source inspection passed
- Verdict: `not verified`
  - The live workbench still uses the legacy inspector inside `web/workbench.js`.
  - The modular `EditorApp` exists, but it is not wired into production workbench UI on this branch.

### Claim B

Claim text: the REXPaint editor is "~75% complete" with keyboard shortcuts and undo/redo complete.

- Verification commands:
  - `nl -ba docs/2026-03-10-readonly-investigation-rexpaint-state.md | sed -n '10,64p'`
  - `nl -ba web/rexpaint-editor/editor-app.js | sed -n '930,980p'`
  - `nl -ba web/rexpaint-editor/editor-app.js | sed -n '996,1088p'`
  - `nl -ba web/rexpaint-editor/canvas.js | sed -n '285,315p'`
- Evidence:
  - The March 10 readonly report says the editor has "Keyboard shortcuts and undo/redo" and marks undo/redo as complete.
  - `EditorApp.undo()` and `EditorApp.redo()` are still TODO no-ops in `web/rexpaint-editor/editor-app.js:946-960`.
  - `EditorApp` does have real XP load/save and tool wiring in `web/rexpaint-editor/editor-app.js:1041-1112`.
  - Canvas layer composition ignores opacity and simply returns the top visible non-zero glyph in `web/rexpaint-editor/canvas.js:293-314`.
- Commit evidence:
  - `a26be4a` for current `web/rexpaint-editor/*` state
  - `e7a7cec` for current March 10 audit docs
- Verification evidence:
  - source inspection passed
- Verdict: `partial`
  - There is substantial editor implementation in isolation.
  - The status claim is overstated because undo/redo is unimplemented and some advertised layer behavior is incomplete.

### Claim C

Claim text: Claude/editor automation is "missing entirely" because there is no usable browser control surface.

- Verification commands:
  - `nl -ba docs/2026-03-10-readonly-investigation-rexpaint-state.md | sed -n '131,183p'`
  - `nl -ba web/workbench.js | sed -n '6507,6645p'`
  - `rg -n "window\\.__wb_debug|openInspector|getInspectorState|writeFrameCell|readFrameRect" web/workbench.js`
- Evidence:
  - The March 10 readonly report correctly notes that `EditorApp` has no dedicated JS automation API.
  - Current workbench code exposes `window.__wb_debug` with browser automation hooks including `openInspector` and `getInspectorState`.
  - The debug surface is for the legacy inspector path, not for `EditorApp`.
- Commit evidence:
  - `e7f72e1` for current `window.__wb_debug` surface
- Verification evidence:
  - source inspection passed
- Verdict: `partial`
  - It is true that `EditorApp` lacks a first-class controller API.
  - It is false to describe the browser as having no automation surface at all; `window.__wb_debug` already exists for the live workbench inspector.

### Claim D

Claim text: the JavaScript XP codec is still incompatible with real XP files because it uses 7-byte cells.

- Verification commands:
  - `nl -ba docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md | sed -n '20,78p'`
  - `sed -n '1,260p' web/rexpaint-editor/xp-file-reader.js`
  - `sed -n '1,260p' web/rexpaint-editor/xp-file-writer.js`
  - `git log -n 1 --oneline -- web/rexpaint-editor/xp-file-reader.js web/rexpaint-editor/xp-file-writer.js`
  - `rg -n "7 bytes|10 bytes" tests/web/rexpaint-editor-* docs -g '!node_modules'`
- Evidence:
  - The March 10 deliverable audit describes the JS reader/writer as 7-byte cell code and blocks testing on that basis.
  - Current source uses 10-byte REXPaint cells in both `xp-file-reader.js` and `xp-file-writer.js`.
  - Last-touch commit for those files is `a26be4a fix: correct XP file cell format from 7 bytes to 10 bytes (REXPaint standard)`.
  - However, several tests and docs still contain 7-byte fixtures and comments:
    - `tests/web/rexpaint-editor-xp-integration.test.js`
    - `tests/web/rexpaint-editor-xp-file-writer.test.js`
    - `tests/web/rexpaint-editor-xp-file-reader.test.js`
- Commit evidence:
  - `a26be4a`
- Verification evidence:
  - source inspection passed
- Verdict: `partial`
  - The March 10 incompatibility claim is stale for current code.
  - Follow-on drift remains because test fixtures and several docs still encode the old 7-byte assumption.

### Claim E

Claim text: editor test coverage is verified and runnable as documented.

- Verification commands:
  - `sed -n '1,140p' tests/web/rexpaint-editor-xp-file-reader.test.js`
  - `sed -n '1,140p' tests/web/rexpaint-editor-xp-file-writer.test.js`
  - `node tests/web/rexpaint-editor-xp-file-reader.test.js`
  - `node tests/web/rexpaint-editor-xp-file-writer.test.js`
  - `node tests/web/rexpaint-editor-xp-integration.test.js`
- Evidence:
  - Multiple test files instruct the user to run them directly with `node tests/...`.
  - The repo `package.json` declares `"type": "commonjs"`.
  - Those test files use ESM `import`, so direct `node tests/...` execution currently fails with `SyntaxError: Cannot use import statement outside a module`.
  - Static inspection also shows stale 7-byte fixture data in XP integration/writer tests.
- Commit evidence:
  - current repository head `5caeb07`
- Verification evidence:
  - command execution failed before assertions due to module-format mismatch
- Verdict: `not verified`
  - The claimed test coverage cannot be treated as current verification evidence in this checkout.
  - The test harness instructions themselves are broken, and some fixtures are stale relative to current codec code.

## Overall Verdict

`PARTIALLY VERIFIED`

What is verified:

- A substantial standalone `web/rexpaint-editor/*` implementation exists on `master`.
- The live workbench on `master` still uses the legacy inspector path in `web/workbench.js`.
- The JS XP codec on `master` now uses the 10-byte REXPaint cell format.
- `window.__wb_debug` provides a real automation surface for the live inspector workflow.

What is not verified:

- The claim that `EditorApp` is the embedded editor currently shipped in workbench.
- The claim that undo/redo is complete in `EditorApp`.
- The claim that current test coverage is executable and therefore valid as present-tense verification evidence.

Recommended doc actions:

1. Downgrade `docs/2026-03-10-readonly-investigation-rexpaint-state.md` from completion-style language to `partial/not integrated`.
2. Add an explicit note that workbench production UI still uses the legacy inspector, not `EditorApp`.
3. Mark the 7-byte XP findings in `docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md` as superseded by `a26be4a`.
4. Repair or relabel the editor test instructions before using them as evidence in future audits.

## Handoff Snapshot

- Branch: `master`
- HEAD: `5caeb07`
- Completed:
  - Recent Claude/editor doc audit captured in this file (`5caeb07`)
- Deferred:
  - Doc status corrections in the original March 4-10 files (reason: audit requested, not mass doc rewrite)
- Open Risks:
  - Missing `docs/INDEX.md` keeps the canonical doc stack incomplete.
  - Several tests and docs still encode obsolete 7-byte XP assumptions.
  - `EditorApp` and live workbench inspector remain split implementations.
- Resume:
  - `sed -n '1,260p' docs/research/ascii/2026-03-13-claim-verification.md`
