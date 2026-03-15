# Claude Handoff: Four Audits For XP Editor Parity

Date: 2026-03-15
Status: active

Use this handoff to restart XP-editor verification from the real goal.

Do not resurrect or reframe the deleted blank-flow single-frame harness.

Start by reading:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
6. `PLAYWRIGHT_FAILURE_LOG.md`

## Ground Truth

- Branch: `master`
- Remote: `origin https://github.com/rikiyanai/asciicker-xpedit.git`
- Local worktree: `/Users/r/Downloads/asciicker-pipeline-v2`
- Additional local worktree present:
  - `/Users/r/Downloads/asciicker-pipeline-v2-xp-editor-wt` on `feat/workbench-xp-editor-wireup`
- Remote refs visible locally include:
  - `origin/master`
  - `origin/feat/workbench-xp-editor-wireup`
  - `origin/feat/xp-fidelity-harness`
  - `origin/fix/solo-only-load-contract`
  - `origin/restore/bundle-override-filter-8279e11`
  - `origin/template-forcefit-next`

## Mission

Audit the entire codebase, local and remote, four times, against the acceptance contract.

This is not a quick scan. This is a discrepancy hunt.

At every failure, identify exactly what category it belongs to:

- UI gap
- backend gap
- visual/render gap
- export gap
- runtime gap
- harness/verification gap
- doc/context drift

## Audit Pass 1: Local Shipped Code Reality

Audit the current `master` worktree only.

Focus:

- new XP authoring path
- existing XP load path
- geometry/metadata handling
- frame layout reconstruction
- layer model
- export path
- Skin Dock/runtime load path
- editor controls actually present in shipped workbench

Required output:

- exact file/line references
- explicit list of hard-fail gaps against `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`

Minimum files:

- `src/pipeline_v2/app.py`
- `src/pipeline_v2/service.py`
- `web/workbench.html`
- `web/workbench.js`
- any XP codec / export / runtime bridge code reached from those files

## Audit Pass 2: Local Git History And Deleted-Harness Autopsy

Audit how the deleted harness happened and what code/doc changes it dragged in.

Required:

- identify the commits that introduced the harness
- identify the commits/docs that narrowed scope without preserving the real goal
- identify which startup docs, handoffs, or file names allowed drift
- identify all "shortcut" patterns that must be treated as future blockers

Required evidence:

- commit hashes
- exact files
- exact claims that were too broad

## Audit Pass 3: Remote Branch And Ref Audit

Audit the visible remote refs locally via git object inspection. Do not assume remote branches are better.

Audit these refs at minimum:

- `origin/master`
- `origin/feat/workbench-xp-editor-wireup`
- `origin/feat/xp-fidelity-harness`
- `origin/fix/solo-only-load-contract`
- `origin/restore/bundle-override-filter-8279e11`

Questions to answer:

- which ref is closest to the real XP-editor parity goal
- which ref carries partial work that should be salvaged
- which ref contains misleading shortcuts or dead-end harness work
- whether any remote ref already solved geometry/layer/runtime issues that `master` lacks

Required output:

- ref-by-ref audit table
- salvage candidates
- dead-end refs

## Audit Pass 4: Cross-Check Everything Against The Acceptance Contract

Take the findings from passes 1-3 and build a hard-fail matrix against:

- new XP authoring
- existing XP load/edit/export
- geometry
- frame layout
- all layers
- export
- Skin Dock/runtime
- truthfulness of naming/reporting

Required output:

- one matrix with pass/fail/unknown for every gate
- no vague language
- if unknown, say exactly what code evidence is missing

## Rules

- Do not write any code before the four audits are complete.
- Do not create a new verifier before the audit results exist.
- Do not use words like `fidelity`, `parity`, `acceptance`, `verified`, or `PASS` unless the acceptance contract allows it.
- Do not narrow scope silently.
- Do not substitute a diagnostic slice for the real goal.

## Deliverables

Produce exactly these deliverables:

1. `docs/research/ascii/2026-03-15-four-audits-xp-editor.md`
   - contains all four audit passes
2. `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md`
   - updated or validated plan grounded in audit findings
3. a short terminal summary with:
   - top blockers
   - salvageable code/refs
   - what should happen first

## Expected Shape Of The Answer

1. Findings first, ordered by severity.
2. Then the four-pass audit matrix.
3. Then the recommended implementation order.
4. Then the exact next command to resume.

## Resume Command

Start with:

```bash
python3 scripts/conductor_tools.py status --auto-setup
```
