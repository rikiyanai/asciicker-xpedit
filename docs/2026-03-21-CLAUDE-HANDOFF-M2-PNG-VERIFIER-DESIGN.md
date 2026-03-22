# Claude Handoff: Milestone 2 PNG Verifier Design

Date: 2026-03-21
Status: historical handoff / superseded by completed design
Audience: fresh-session Claude / Codex agent

## Start Here

Work in `/Users/r/Downloads/asciicker-pipeline-v2`.

Before doing anything:

1. `python3 scripts/conductor_tools.py status --auto-setup`
2. `python3 scripts/self_containment_audit.py`

## Outcome

This handoff has been executed.

The completed design now lives at:

- `docs/plans/2026-03-21-milestone-2-png-verifier-design.md`

Use that document as the implementation-start source of truth for the Milestone 2 PNG
verifier architecture.

## Why This Exists

Milestone 1 verifier architecture was centered on whole-sheet XP editing and recipe replay
for bundle-native authoring.

Milestone 2 is different:

- source panel has multiple modes
- context menus matter
- bbox extraction matters
- drag/drop and row-sequence insertion matter
- the workflow is more stateful than paint-only editing

So Milestone 2 needs a richer verifier design than a simple paint truth-table.

## Historical context

At the time this handoff was written, several M2 support docs still had known inaccuracies.
That corrective pass has since been completed, and the design doc above reflects the corrected
inputs.

The rest of this handoff is retained as historical lineage for how the design was produced.

## Important: supporting M2 docs were not all trustworthy yet

Several recently created Milestone 2 support artifacts have verified inaccuracies. Do not
blindly use them as ground truth for the verifier design.

Confirmed examples:

- `docs/plans/2026-03-21-m2-png-fixture-inventory.md`
  - inflated PNG counts
  - false claim that `data/uploads/` and `data/previews/` are not gitignored
- `docs/plans/2026-03-21-legacy-inspector-retirement-checklist.md`
  - misclassifies whole-sheet hover/cell readout as missing/fallback
  - feature counts are wrong
- `docs/plans/2026-03-21-m2-source-panel-implementation-spec.md`
  - false undo-gap claims for `findSprites()` and cut-line move paths
- `docs/plans/2026-03-21-semantic-edit-test-matrix.md`
  - missing important cross-family behavior coverage
- `scripts/validate_semantic_maps.py`
  - useful, but still draft; do not assume it is a complete correctness proof

Treat these artifacts as drafts that must be corrected or carefully fenced off before they
influence canonical verifier design.

## Required pre-step: support-doc audit/fix

Before writing the main verifier design, do a short corrective pass on the draft support
artifacts above.

Minimum requirement:

1. fix or explicitly annotate the factual errors that would mislead verifier design
2. do not promote any of those draft docs to canonical truth until corrected
3. summarize what was corrected vs what remains draft

Do not skip this step.

## Required First Step

After the support-doc corrective pass, start by mapping **all user-reachable actions**
involved in the PNG workflow.

At minimum, classify actions across:

1. upload / analyze / convert
2. source-panel mode switches
3. bbox creation / selection / editing
4. context-menu actions
5. source-to-grid insertion / drag-drop
6. grid selection / row / frame operations
7. whole-sheet correction/editing
8. save / export / test-bundle transitions

Do not start with code changes. Start with the workflow/action map.

## Required Design Sections

The resulting design doc must explicitly define:

### 1. Verifier state model

What observable product state the verifier can rely on, such as:

- active action/tab
- source mode
- selected boxes
- anchor box
- source cuts
- selected grid row / frame
- whole-sheet mounted / focused
- context-menu availability
- save / dirty state

### 2. Action DSL

Define user-reachable action primitives such as:

- `source_draw_box`
- `source_select_box`
- `source_move_box`
- `source_resize_box`
- `source_find_sprites`
- `source_set_anchor`
- `source_pad_to_anchor`
- `source_add_as_single`
- `source_add_to_selected_row_sequence`
- `source_drag_selection_to_grid`
- `grid_select_frame`
- `grid_move_row`
- `grid_add_frame`
- `focus_whole_sheet`
- `ws_paint_cell`
- `save_session`
- `export_bundle`
- `test_skin_dock`

These are examples; refine them to match current code/UI truth.

### 3. State -> action -> response / invariant mapping

For each action family, specify:

- required preconditions
- user gesture
- expected product response
- invariants that can be checked immediately

### 4. Recipe generator architecture

Define how PNG recipes differ from Milestone 1:

- mode switches
- context menus
- drag/drop
- source/grid coordination

### 5. Verifier slices

Do not design one giant verifier first. Define staged verifier slices:

1. PNG structural baseline
2. source-panel contract
3. source-to-grid contract
4. whole-sheet correction contract
5. end-to-end PNG manual-assembly acceptance

### 6. Acceptance vs diagnostic boundaries

Make explicit what is:

- acceptance evidence
- diagnostic only

Do not let ad hoc scripts substitute for the canonical verifier path.

## Inputs To Read

- `docs/INDEX.md`
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md`
- `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`
- `docs/plans/2026-03-21-milestone-2-implementation-checklist.md`
- `docs/WORKBENCH_SOURCE_PANEL_UX_CHECKLIST.md`
- current relevant UI/code in:
  - `web/workbench.html`
  - `web/workbench.js`
  - `web/whole-sheet-init.js`

## Constraints

- do not conflate Milestone 1 verifier rules with Milestone 2 without adjustment
- do not assume Analyze is authoritative
- do not assume source-panel workflows are paint-like
- do not trust recently added draft M2 support docs unless you have rechecked them against code
- do not make implementation changes unless strictly needed to clarify current code truth
- prefer evidence-backed design over broad speculation

## Output

Produce:

1. corrected or clearly caveated M2 support docs where needed
2. a completed `docs/plans/2026-03-21-milestone-2-png-verifier-design.md`
3. any small supporting doc updates needed for alignment
4. a short summary of:
   - proposed action DSL
   - verifier slices
   - acceptance boundary
   - which support-doc inaccuracies were fixed
   - open unknowns
