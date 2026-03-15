# Claude Handoff: B6 Whole-Sheet Editor Integration

Date: 2026-03-15
Status: active

Start a fresh session in `/Users/r/Downloads/asciicker-pipeline-v2`.

## Goal Reminder

The goal is **REXPaint parity first**.

That means:

- the product needs a **whole-sheet XP editor**
- the editor path must be **user-reachable**
- the legacy frame-by-frame inspector is **not** the parity target
- frame/debug grid can remain navigation/preview support only

Do not silently narrow the goal to "make the inspector harness pass."

## Current Ground Truth

Keep these backend truth fixes:

- B1 fixed: upload derives geometry from Layer 0 metadata
- B2+B3 fixed: uploaded XP sessions preserve the full real layer set
- B4 fixed: uploaded-session export preserves persisted real layers instead of fabricating template layers

Do not revert those fixes just because the strict diagnostic harness still fails on
the legacy inspector path.

## Important Correction

The current strict harness does **not** expect the inspector to auto-open on page load.
It explicitly `dblclick`s frame tiles and then waits for `#cellInspectorPanel`.

So do not propose "auto-open inspector on load" as the next fix.

## Required Reads

Read before doing anything:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
6. `docs/research/ascii/2026-03-15-xp-data-contract.md`
7. `docs/research/ascii/2026-03-15-four-audits-xp-editor.md`
8. `docs/research/ascii/2026-03-15-whole-sheet-seam-map.md`
9. `docs/2026-03-15-CLAUDE-HANDOFF-WHOLE-SHEET-REXPAINT-PIVOT.md`

## Task

Implement the first **whole-sheet integration slice** into the shipped workbench.

This is not full parity yet. It is the first real integration step toward it.

### In Scope

1. Mount a whole-sheet editor surface into the shipped workbench UI.
2. Use the persisted backend session truth (`layers`, geometry, dimensions) as the source for that surface.
3. Reuse salvageable `web/rexpaint-editor/*` pieces where they fit.
4. Keep the frame grid as navigation/preview support only.
5. Avoid the JS XP file I/O path for this step; use backend session data, not `XPFileReader` / `XPFileWriter`.

### Out Of Scope

- full parity completion
- export/file I/O redesign
- JS codec replacement
- deleting the legacy inspector
- making the strict harness pass through the legacy inspector path
- solving every missing REXPaint tool in one pass

## Concrete Implementation Target

Build a mounted whole-sheet editor shell in workbench that:

1. has a real DOM mount point in `workbench.html`
2. loads the required whole-sheet editor JS/CSS into the shipped workbench path
3. constructs the editor using current session dimensions
4. hydrates visible cell data from persisted `state.layers`
5. allows frame-grid selection to focus/pan/navigate the whole-sheet surface rather than opening the legacy inspector as the primary path

The slice is successful if a loaded uploaded XP can be viewed as one whole editable sheet in the shipped workbench using real session data.

## Constraints

- Do not depend on `xp-file-reader.js` or `xp-file-writer.js` for this step.
- Do not claim the legacy inspector is the primary editor.
- Do not call this complete parity.
- If a rexpaint-editor module is only salvageable after modification, say so explicitly in the final report.

## Suggested Files

Primary likely touch points:

- `web/workbench.html`
- `web/workbench.js`
- `web/rexpaint-editor/editor-app.js`
- `web/rexpaint-editor/canvas.js`
- `web/rexpaint-editor/styles.css`

Only touch more files if required.

## Verification

Run only the minimum checks needed for this slice:

```bash
node --check web/workbench.js
```

If you add module-loading changes that need a browser smoke test, run one targeted manual/debug check only and report exactly what you observed.

## Report Back With

1. exact files changed
2. what whole-sheet editor surface now exists in shipped workbench
3. whether it hydrates from real persisted session layers
4. whether frame-grid navigation now connects to the whole-sheet surface
5. what still blocks this from full REXPaint parity
6. what the next implementation task is after this slice

## Non-Negotiable

- no silent narrowing
- no inspector-as-primary-target
- no hidden mutation counted as parity
- no substitute harness treated as proof
