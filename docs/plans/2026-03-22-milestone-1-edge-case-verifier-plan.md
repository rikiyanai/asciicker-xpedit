# Milestone 1 Edge-Case Verifier Plan

Date: 2026-03-22
Status: active

This plan defines the **edge-case workflow verifier** for Milestone 1.

It does **not** replace the canonical `full_recreation` acceptance lane. Instead, it adds
a second verifier lane for hard-to-reproduce state and workflow bugs that occur around
partial bundle progress, tab switching, refresh/recovery, and Skin Dock/test gating.

It is governed by:

- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md`
- `docs/plans/2026-03-22-workbench-verifier-sar-model.md`
- `PLAYWRIGHT_FAILURE_LOG.md`

## Why this exists

`full_recreation` is the real-content acceptance/signoff lane. It is the right tool for:

- fidelity
- repeatability
- crash detection
- final milestone-close evidence

But it is the wrong tool for several current bug classes:

- partial bundle readiness / gating bugs
- stale session after action-tab switch
- `New XP` / save / refresh recovery issues
- frontend freeze cases that depend on specific workflow order
- "button was enabled when it should have been blocked" bugs

Those need a verifier that checks **workflow honesty and state transitions**, not only
cell fidelity.

## Scope

The edge-case verifier is for **Milestone 1 only** and covers the shipped bundle-native
workflow for:

- `idle`
- `attack`
- `death`

It focuses on:

- bundle status transitions
- action/session switching
- whole-sheet editor hydration
- save/export/test gating
- refresh/recovery behavior
- Skin Dock launch preconditions

It does **not** replace:

- `full_recreation`
- manual runtime signoff
- cell-fidelity comparison

## Architecture

This lane is not a complete workbench SAR map yet. It is the Milestone 1 subset of the
broader verifier model described in:

- `docs/plans/2026-03-22-workbench-verifier-sar-model.md`

The edge-case verifier should have four layers.

### 1. State model

At every meaningful step, capture product-observable state:

- `templateSetKey`
- `bundleId`
- `activeActionKey`
- `sessionId`
- `jobId`
- `bundleStatus` text
- `wbStatus` text
- `webbuildState` text
- whole-sheet mounted state
- grid geometry:
  - `gridCols`
  - `gridRows`
  - `frameWChars`
  - `frameHChars`
  - `angles`
  - `anims`
- readiness of critical controls:
  - `Save`
  - `Export XP`
  - `New XP`
  - `Test This Skin`
- current runtime iframe src/state

### 2. Action DSL

Use user-reachable actions, not raw DOM assumptions.

Required action types:

- `apply_template`
- `switch_action_tab`
- `upload_png`
- `convert_action`
- `save_action`
- `export_action`
- `new_xp`
- `focus_whole_sheet`
- `refresh_page`
- `test_this_skin`

Optional diagnostics:

- `capture_state`
- `capture_console_errors`
- `capture_network_failures`

### 3. Invariant checker

After every action, assert the expected product truth.

Examples:

- switching to `death` must load death geometry, not idle geometry
- partial bundle state must not falsely appear fully ready
- `Test This Skin` must be disabled or blocked honestly when bundle/session preconditions are not satisfied
- `New XP` must update the active session and whole-sheet editor consistently
- refresh must not silently corrupt bundle/session/action linkage

### 4. Failure artifact bundle

Every failure should emit:

- recipe name
- step index
- action taken
- pre-state
- post-state
- console errors
- relevant status texts
- screenshot(s) if practical

The point is fast classification, not pretty reporting.

## Verifier recipe families

Do not start with unbounded random fuzzing. Start with a small, named recipe set,
then promote that into a bounded randomized SAR-sequence generator.

The correct progression is:

1. deterministic named recipes for known blocker classes
2. bounded randomized sequences built from the same action/state model
3. invariant generation from SAR rules, not ad hoc expectations

So this verifier must eventually support irrational but user-reachable flows such as:

- make changes -> `New XP`
- upload PNG -> `New XP`
- upload PNG -> convert -> `New XP`
- undo -> redo -> redo attempt
- switch active layer -> edit -> undo -> action-tab switch
- import/replace -> switch bundle action -> `New XP`
- partial bundle progress -> refresh -> `Test This Skin`

The generator should create a randomized action sequence, then derive a "what should happen"
SAR script from the workbench state model and response rules. The runner executes the sequence,
captures state after every step, and fails on any violated invariant.

### Recipe family A: Partial bundle gating

Purpose:

- prove that bundle readiness and `Test This Skin` gating are honest

Required scenarios:

- `0/3` ready
- `1/3` ready
- `2/3` ready
- `saved` but not `converted`
- `converted` for one action only

Primary assertions:

- status text is truthful
- blocked actions stay blocked
- user does not enter a freeze-prone invalid test path silently

### Recipe family B: Action-tab hydration

Purpose:

- prove that switching tabs loads the correct session and geometry every time

Required scenarios:

- idle -> attack -> death
- death -> idle -> death
- switch immediately after save/export
- switch immediately after convert

Primary assertions:

- `sessionId` changes when expected
- geometry matches active action
- whole-sheet editor updates to the active action

### Recipe family C: New XP / replace-session flow

Purpose:

- prove that upload/new-session actions update the workbench and whole-sheet editor coherently

Required scenarios:

- upload PNG -> convert -> `New XP`
- bundle action switch after `New XP`
- import/replace while a bundle is active

Primary assertions:

- whole-sheet editor remounts or rehydrates correctly
- old session state does not bleed into the new one

### Recipe family D: Refresh and recovery

Purpose:

- prove that refresh does not silently corrupt action/session linkage

Required scenarios:

- refresh after save
- refresh after convert
- refresh with one action ready and others blank

Primary assertions:

- restored UI truth matches persisted backend truth
- active action/session linkage is still correct

### Recipe family E: Skin Dock preconditions

Purpose:

- prove that runtime-test paths are honestly gated

Required scenarios:

- `Test This Skin` with no valid XP
- `Test This Skin` with one action only
- `Test This Skin` with all required actions ready

Primary assertions:

- runtime/test path does not hang silently on known-invalid preconditions
- blocking state is explained honestly
- valid cases still proceed

### Recipe family F: Undo / redo / layer-switch turbulence

Purpose:

- prove that history/future state and active-layer state remain coherent under mixed editing flows

Required scenarios:

- edit -> undo -> redo
- edit -> undo -> redo -> redo attempt
- switch layer -> edit -> undo
- switch layer -> undo/redo -> action-tab switch

Primary assertions:

- undo followed by redo restores identical observable state
- invalid extra redo is blocked honestly
- layer selection and whole-sheet state do not drift silently

### Recipe family G: Generated SAR edge sequences

Purpose:

- cover high-value irrational user behavior without hand-writing every workflow

Required shape:

- choose a bounded action vocabulary from the Milestone 1 workbench subset
- generate short random sequences with legal preconditions
- derive expected responses from SAR rules at each step
- emit the generated sequence and expected SAR assertions as a reproducible artifact

Candidate actions for generation:

- `apply_template`
- `switch_action_tab`
- `upload_png`
- `convert_action`
- `save_action`
- `export_action`
- `new_xp`
- `refresh_page`
- `test_this_skin`
- `undo`
- `redo`
- `switch_active_layer`

The point is not chaos. The point is bounded, reproducible state-machine coverage of
user-reachable actions that humans combine in messy ways.

## Execution order

Build and run in this order:

1. Partial bundle gating
2. Action-tab hydration
3. New XP / replace-session flow
4. Refresh and recovery
5. Skin Dock preconditions
6. Undo / redo / layer-switch turbulence
7. Generated SAR edge sequences

Do not start with a giant combined workflow.

## Relationship to the truth table

Truth tables still matter, but in a different way here.

Use truth-table-derived geometry and required action families to know:

- what session geometry should load for each action
- what bundle actions are required
- what action orderings are valid

Do **not** use the edge-case verifier as a new cell-fidelity oracle.

That remains the job of `full_recreation`.

## Acceptance use

Milestone 1 still closes only on:

- `full_recreation`
- repeatability
- manual runtime review

The edge-case verifier is a blocker-discovery and blocker-classification lane.

It becomes mandatory whenever:

- manual reports reveal hard-to-reproduce state bugs
- the canonical verifier shows geometry/session races
- partial bundle readiness/gating behavior is in doubt

## Initial backlog

The current first-priority bugs this verifier should cover are:

1. partial bundle state still allows `Test This Skin`
2. Skin Dock timeout/freeze on invalid or incomplete bundle state
3. wrong session geometry after action-tab switch
4. whole-sheet editor not updating after `New XP`
5. whole-sheet editor not updating after bundle item switch

## Non-goals

This plan does **not** include:

- Milestone 2 PNG verifier architecture
- replacing `full_recreation`
- rewriting the whole verifier family before the next bug fix

What it does include later is a bounded SAR-sequence generator over the Milestone 1
workbench subset. That is different from generic fuzzing across the whole UI.

## Deliverables

1. new verifier mode or sibling runner for Milestone 1 edge workflows
2. named recipe families as listed above
3. a bounded randomized SAR-sequence generator for workbench actions
4. step-by-step invariant checks
5. structured failure artifact output

The implementation should stay narrow and product-state-focused.
