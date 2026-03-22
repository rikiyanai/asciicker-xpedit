# Workbench Verifier SAR Model

Date: 2026-03-22
Status: active

This document clarifies the verifier data model across both Milestone 1 and Milestone 2.

## Short answer

**No**: the current verifier truth table is **not** a true SAR table/map of all clickable
buttons and user-reachable actions in the full workbench.

Today there are two different verifier data models in play:

1. an **XP truth table** for fidelity/oracle comparison
2. an emerging **workflow state/action model** for UI-state bugs

The long-term verifier architecture needs both.

## Definitions

### XP truth table

The current `scripts/xp_fidelity_test/truth_table.py` output is an **XP oracle**, not a
UI map.

It records:

- source XP path
- width / height
- layer count
- metadata:
  - `angles`
  - `anims`
  - `projs`
  - `frame_rows`
  - `frame_cols`
  - `frame_w`
  - `frame_h`
- all cells for all layers

This is the right model for:

- geometry truth
- layer truth
- cell fidelity truth
- export comparison

It is **not** the right model for:

- button enable/disable truth
- tab-switch hydration truth
- partial bundle gating truth
- source-panel context menu truth
- drag/drop workflow truth

### SAR model

SAR here means:

- **State**
- **Action**
- **Response**

A real workbench SAR model must describe:

1. observable UI/application state
2. user-reachable actions
3. expected responses/invariants after each action

That is the missing top-level model for the whole workbench.

## Current milestone split

### Milestone 1

Milestone 1 currently uses:

1. XP truth table + recipe replay
   - `acceptance`
   - `full_recreation`
   - `manual_review`
2. edge-case workflow verifier plan
   - partial bundle gating
   - action-tab/session hydration
   - `New XP`
   - refresh/recovery
   - Skin Dock preconditions

This means Milestone 1 is currently split across:

- **fidelity truth** via XP oracle
- **workflow truth** via partial state/action verifier design

### Milestone 2

Milestone 2 verifier design already points toward the broader SAR model:

- source panel
- grid panel
- whole-sheet editor
- bundle workflow
- runtime dock
- manual assembly workflow

So Milestone 2 is where the verifier becomes a true workbench-wide SAR system.

## What the true workbench SAR model must cover

A complete SAR map must cover the full shipped workbench, not just the whole-sheet editor.

### A. Global / session state

- template set
- bundle id
- active action key
- session id
- job id
- dirty/saved state
- bundle status text
- workbench status text
- runtime status text

### B. Template / bundle controls

Actions:

- apply template
- switch action tab
- save action
- export action
- new XP
- import XP
- test this skin

Responses:

- correct action/session linkage
- honest readiness state
- correct enable/disable gating

### C. Upload / convert panel

Actions:

- upload PNG
- analyze
- convert to XP
- tweak angles / frames / source projections / render resolution

Responses:

- job/session creation
- status updates
- correct routing in classic vs bundle mode

### D. Source panel

Actions:

- select
- draw box
- drag row
- drag column
- vertical cut
- find sprites
- context menu actions

Responses:

- bbox creation/update/deletion
- anchor behavior
- source selection state
- extracted sprite set

### E. Grid panel

Actions:

- select frame
- add frame
- delete selected
- move row
- move columns
- drag/drop from source panel
- context menu copy/paste/focus

Responses:

- selected row/cols
- frame content changes
- frame ordering changes
- correct focus transfer to whole-sheet editor

### F. Whole-sheet editor

Actions:

- tool changes
- layer changes
- paint / erase / line / fill
- visibility toggles
- save

Responses:

- correct layer targeting
- correct geometry/focus
- correct visible update
- correct persistence/export result

### G. Runtime / Skin Dock

Actions:

- open preview
- reload preview
- test this skin
- apply in place
- apply + restart
- upload skin

Responses:

- honest preflight
- honest gating
- correct iframe/runtime path
- correct runtime-ready state

### H. Bug reporting

Actions:

- open bug modal
- submit structured report

Responses:

- correct metadata capture
- local report persistence

## Required verifier architecture going forward

### 1. Keep the XP truth table

Do not replace it. It remains the oracle for:

- fidelity
- export correctness
- runtime payload comparison

### 2. Add workbench SAR tables

These should define:

- state fields
- action DSL
- post-action invariants

### 3. Use both together

- Milestone 1:
  - XP truth table + edge-case SAR subset
- Milestone 2:
  - full workbench SAR model + PNG/manual-assembly workflows

## Practical conclusion

The current verifier truth model is **not yet the full workbench SAR map**.

That is why:

- `full_recreation` is good at fidelity
- but weak at workflow-state bugs

The correct next architecture is:

1. keep XP truth tables for output/fidelity truth
2. add a full workbench SAR table/map for user-reachable workflow truth

This SAR model must cover the **entire workbench**:

- bundle/template controls
- upload/convert panel
- source panel
- grid panel
- whole-sheet editor
- runtime dock
- bug-report widget

Not just the whole-sheet editor.
