# Milestone 2 Plan: Practical PNG Ingest and Manual Assembly

Date: 2026-03-21
Status: draft
Depends on: Milestone 1 closure

## Purpose

Define the next milestone after bundle-native new-XP authoring viability.

Milestone 2 is **not** "perfect automatic sprite-sheet slicing." It is a practical,
stable PNG ingest workflow that preserves the already-hard-won bundle/runtime baseline while
making manual correction and assembly the primary success path.

## Explicit Milestone Boundary

Milestone 2 begins only after Milestone 1 closes.

Milestone 1 requirement summary:

- shipped whole-sheet authoring for `idle`, `attack`, `death`
- canonical verifier signoff for the bundle-native workflow
- usable save/export/test loop
- responsiveness and repeatability good enough for honest milestone-close reporting

Milestone 2 requirement summary:

- preserve the structural/runtime-safe arbitrary-PNG baseline from Milestone 1
- make source-panel/manual assembly practical through shipped controls
- keep whole-sheet as the primary correction surface
- add canonical human-verified semantic dictionaries and build semantic editing on top of them

## Non-Negotiable Starting Point

Milestone 1 established an important structural checkpoint:

- a readable PNG can be routed through bundle `action-grid/apply`
- `run_pipeline()` can force the result into a native family contract
- exported XP passes structural gates
- the resulting bundle can be injected into Skin Dock/runtime without violating engine
  expectations

This checkpoint must not regress.

### Structural Baseline To Preserve

For the required bundle families (`player`, `attack`, `plydie`):

- upload PNG
- convert/apply in bundle mode
- produce structurally valid XP for the target family
- load/edit/export in the workbench
- inject into Skin Dock/runtime successfully

This baseline remains valuable even when visual slicing fidelity is poor.

## Milestone 2 Goal

Make PNG-based sprite authoring **practical** by centering the workflow on:

1. stable structural conversion
2. visible auto-slice guides as hints, not truth
3. source-panel bbox extraction and manual correction
4. source-to-grid assembly
5. whole-sheet XP editing as the primary correction surface
6. human-verified semantic dictionaries for canonical sprite families

## What Milestone 2 Is Not

Milestone 2 is not:

- perfect automatic slicing for arbitrary commercial sheets
- a claim that Analyze is authoritative
- a generalized "AI understands any uploaded sprite sheet" milestone
- full existing-XP parity
- full REXPaint parity

## Product Principle

Demote auto-slicing from "heroic interpretation" to "assistive hinting."

The reliable path should be:

- upload PNG
- show source image and suggested guides
- detect candidate sprites / let user fix boxes
- drag/append into the grid
- correct in whole-sheet editor
- save/test/export

## Current UI Reality

The current workbench already has the rough pieces:

- Upload + Convert panel
- Source Panel with:
  - `Find Sprites`
  - `Draw Box`
  - `Drag Row`
  - `Drag Column`
  - `Vertical Cut`
  - context actions:
    - `Add as 1 sprite`
    - `Add to selected row sequence`
    - `Set as anchor for Find Sprites`
    - `Pad this bbox to anchor size`
- Grid Panel with:
  - row/column moves
  - add/delete
  - frame selection
- Whole-sheet editor mounted in the shipped workbench

However, the current product still has an important UX cleanup gap:

- shipped grid actions now focus the whole-sheet editor first
- but the legacy inspector still exists as a fallback/debug path and remains visible in the product

Milestone 2 should continue resolving this in favor of the whole-sheet editor by demoting the legacy inspector to debug-only.

## Milestone 2 Workstreams

### M2-A. Freeze the Milestone 1 structural PNG baseline

Before expanding functionality, add a non-regression guarantee for the existing bundle PNG
checkpoint:

- arbitrary readable PNG -> bundle apply
- structurally valid XP
- session loads
- export succeeds
- Skin Dock/runtime accepts bundle

This baseline is about structural/runtime safety, not visual correctness.

### M2-B. Make source-panel assisted assembly the primary PNG workflow

The intended flow:

1. User applies a bundle template.
2. User uploads a PNG source sheet for an action.
3. Workbench shows the raw source image immediately.
4. Workbench overlays **template guide lines** or **auto-slice lines** as a hint.
5. User can click `Find Sprites` to generate candidate bboxes.
6. User can manually draw, adjust, anchor, pad, and select boxes.
7. User can drag selected source sprites to a grid frame, or append to a selected row
   sequence.
8. User refines the result in the whole-sheet editor.

### M2-C. Promote the whole-sheet editor to the primary correction surface

The shipped UX should move from:

- frame tile -> legacy inspector

to:

- frame tile -> focus/pan the whole-sheet editor

Milestone 2 target behavior:

- the whole-sheet editor is always the main editing surface once a session exists
- grid selection focuses the whole-sheet viewport
- `Open XP Editor` either:
  - becomes `Focus Whole-Sheet`, or
  - is removed if redundant
- the legacy inspector must not remain the primary editing path

### M2-D. Stabilize source-panel and grid-panel common-sense workflows

Priority behaviors:

- `Find Sprites` should remain useful as a candidate-box generator, not a promise of
  correctness
- manual box draw/move/resize/delete must be reliable
- row drag selection must be reliable
- drag/drop source selection into grid must be reliable
- `Add to selected row sequence` must be reliable
- grid row/column operations must remain stable after inserts

### M2-E. Add human-verified semantic dictionaries for canonical sprites

This is the first phase of semantic editing support.

Scope:

- canonical reference XP families only
- human-verified
- explicit region labels with confidence

Start with:

- `player-0100.xp`
- `attack-0001.xp`
- `plydie-0000.xp`

Use cases unlocked:

- "make the shirt green"
- "make pants purple"
- "preserve skin"
- "change torso color but not boots"

This should be done from reference XP truth, not from the PNG analyze path.

### M2-F. Keep Analyze as assistive only

Analyze may continue to suggest geometry and overlay guide lines, but Milestone 2 should
explicitly stop treating it as the authoritative interpretation of the sheet.

The practical success path is:

- Analyze suggests
- Source panel detects / user corrects
- Grid assembles
- Whole-sheet editor finalizes

## Recommended Execution Order

1. Close Milestone 1 completely.
2. Add a non-regression gate for the structural PNG bundle baseline.
3. Make whole-sheet the primary correction/editing surface.
4. Stabilize source-panel -> grid-panel manual assembly.
5. Add visible template/auto-slice overlay guides on the source sheet.
6. Add Phase 1 human-verified semantic dictionaries for canonical families.
7. Add agent/API semantic edit operations on top of those dictionaries.
8. Only then revisit analyze/slicing improvements.

## Family Expansion Policy

Do not immediately broaden Milestone 2 by adding more sprite families unless needed for the
manual assembly path.

Important distinction:

- current server-side `player` override fanout already covers weapon-state filenames in the
  `player` family
- the next truly missing player families are `wolfie` and `wolack`

So if bundle family expansion is prioritized after Milestone 1, the next real bundle
expansion target is mounted gameplay support, not "idle with weapon" as a separate family.

## Acceptance Criteria For Milestone 2

Milestone 2 is complete only when all of the following are true:

- the Milestone 1 structural PNG bundle baseline is protected by non-regression checks
- a user can upload a PNG and see practical guide lines / source candidates
- a user can correct source boxes and assemble rows/frames manually through shipped controls
- the whole-sheet editor is the primary correction surface for assembled content
- the canonical semantic dictionaries exist for the enabled native families
- agent-driven region edits can be performed on canonical sprite references safely

Milestone 2 completion must be reported as Milestone 2 only. It does not by itself imply
full XP-editor parity.

## Not Required For Milestone 2

- perfect bbox detection on arbitrary uploaded sheets
- perfect row/column inference
- generalized semantic understanding for arbitrary user art
- mount-family bundle support, unless explicitly promoted into the milestone

## Resume Commands

When Milestone 1 is closed, start Milestone 2 with:

```bash
python3 scripts/conductor_tools.py status --auto-setup
python3 scripts/self_containment_audit.py
```

Then read:

- `docs/INDEX.md`
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- this file
- `docs/WORKBENCH_SOURCE_PANEL_UX_CHECKLIST.md`
- `docs/research/ascii/2026-03-21-player-sprite-semantic-dictionary-seed.md`
