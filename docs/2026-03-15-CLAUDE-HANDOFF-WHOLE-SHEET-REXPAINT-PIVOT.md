# Claude Handoff: Whole-Sheet REXPaint Pivot

Date: 2026-03-15
Status: active

Start a fresh session in `/Users/r/Downloads/asciicker-pipeline-v2`.

This handoff supersedes any next-step framing that would optimize around the legacy frame inspector as the primary XP editor path.

## Core Direction

The goal is **REXPaint parity first**.

That means:

- the product needs a **whole-sheet XP editor**
- the editor path must be **user-reachable**
- the editing model should align with the REXPaint UI documents already in this repo
- the legacy frame-by-frame inspector is **not** the parity target

The frame grid / debug grid can remain as:

- atlas structure visualization
- frame navigation
- preview / selection support

It should not remain the primary editing surface if the required parity target is a whole-sheet editor.

## What To Keep

Keep real backend fixes that move the product toward the contract.

As of now, keep:

- the B1 `workbench_upload_xp()` geometry fix in `src/pipeline_v2/service.py`

Do **not** revert that just because the restored strict harness now fails at the inspector stage.

## What Not To Do Next

Do not spend the next phase on:

- making `#cellInspectorPanel` the long-term parity path
- polishing the per-frame inspector workflow
- treating inspector open/close bugs as the main milestone blocker
- building more harness logic around per-frame inspector assumptions

Those may matter tactically, but they are not the correct product target.

## Required Reads

Read before doing anything:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
6. `docs/research/ascii/2026-03-15-xp-data-contract.md`
7. `docs/research/ascii/2026-03-15-four-audits-xp-editor.md`
8. `docs/REXPAINT_UI_COMPLETE_INDEX.md`
9. `docs/FEATURE_BUTTON_INDEX_WITH_REXPAINT_MANUAL.md`
10. `docs/COMPLETE_UI_CONTROL_REFERENCE.md`
11. `docs/plans/2026-03-04-web-rexpaint-editor/claude-web-rexpaint-design-brief.md`

## Phase 1: Audit The Whole-Sheet Editor Pivot

Do not write product code first.

Audit and report:

1. which existing workbench/grid structures can support a whole-sheet editor
2. which parts of `web/rexpaint-editor/*` are salvageable for the whole-sheet path
3. whether the existing debug/legacy grid can serve as the editable whole-sheet canvas baseline
4. which current inspector-only behaviors must be migrated or replaced
5. which user-reachable REXPaint interactions are still missing from the shipped workbench

Required code focus:

- `web/workbench.html`
- `web/workbench.js`
- `web/rexpaint-editor/*`

Required output:

- exact file/line refs
- explicit separation between:
  - salvageable
  - replace
  - delete / stop depending on

Write the audit to:

- `docs/research/ascii/2026-03-15-whole-sheet-rexpaint-pivot.md`

## Phase 2: Update The Hard-Fail Plan

After the audit, update:

- `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md`

The plan must explicitly say:

- B1 backend geometry fix stays
- the frontend/editor path now pivots to whole-sheet editing
- the legacy frame inspector is diagnostic / transitional only
- the next frontend milestone is not "make frame inspector work better"

## Phase 3: Stop And Report

Do not write product code in this handoff.

Return:

1. top frontend/editor blockers for whole-sheet parity
2. what is salvageable from `web/rexpaint-editor/*`
3. whether the existing grid/debug sheet is a viable editable baseline
4. which parts of the legacy inspector must stop being the core path
5. the exact first implementation task after this audit

## Non-Negotiable

- no silent narrowing
- no per-frame inspector treated as milestone target
- no substitute harness treated as parity proof
- no hidden mutation counted as editor parity
