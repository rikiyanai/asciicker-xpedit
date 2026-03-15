# XP Editor Hard-Fail Plan

Date: 2026-03-15
Status: active

This plan replaces the deleted blank-flow single-frame harness plan.

It is governed by:

- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- `PLAYWRIGHT_FAILURE_LOG.md`

## Objective

Prove full XP-editor parity through the shipped product paths, not through substitute harnesses.

The work must hard-fail at the first broken gate and then fix that exact gate before proceeding.

## Phase 0: Four Audits

Owner outcome:

- complete the four audits in `docs/2026-03-15-CLAUDE-HANDOFF-FOUR-AUDITS-XP-EDITOR.md`
- produce an evidence-backed blocker list
- identify salvageable local/remote code

Exit gate:

- one audit document exists with exact file/line refs and a pass/fail/unknown matrix against the acceptance contract

## Phase 1: Canonical XP Data Contract

Define and verify the product data contract for both workflow families:

- new XP authoring
- existing XP load/edit/export

Must specify:

- dimensions
- angles
- anim/frame grouping
- projections
- layer count and mapping
- frame width/height in chars
- export representation
- runtime payload expectations

Exit gate:

- one canonical code-backed data contract document exists
- current code is audited against it

## Phase 2: Backend Structure Correctness

Bring backend behavior into line with the contract.

Targets:

- existing XP load path preserves real geometry and layers
- new XP creation path supports intended structure instead of fake single-sheet defaults
- export path preserves full structure and layers

Hard-fail categories:

- metadata mismatch
- layer mismatch
- export mismatch

Exit gate:

- backend can round-trip structure correctly in code-backed tests or deterministic checks

## Phase 3: Frontend Structure Realization

Bring the shipped workbench UI into line with the contract.

Targets:

- frame grid reflects real structure
- editor can target the correct frame/angle/projection
- layer visibility/editability matches the data model
- no fake single-frame fallback masquerades as fidelity

Hard-fail categories:

- UI layout mismatch
- frame selection mismatch
- layer behavior mismatch

Exit gate:

- live UI state matches backend session structure for both new and loaded XP workflows

## Phase 4: Editing Fidelity

Verify editing behavior through shipped controls.

Targets:

- cell edits land in the intended frame/layer
- editing does not corrupt unrelated frames/layers
- visible result matches actual exported result

Hard-fail categories:

- visual mismatch
- cell mismatch
- layer spill/cross-talk

Exit gate:

- editing correctness is established for representative multi-frame/multi-layer cases

## Phase 5: Export Fidelity

Prove export correctness against the canonical contract.

Targets:

- export preserves structure
- export preserves all layers
- export preserves all cell data

Hard-fail categories:

- missing metadata
- wrong geometry
- wrong layer count
- wrong cell data

Exit gate:

- exported XP matches expected structure and content exactly

## Phase 6: Skin Dock / Runtime Acceptance

Prove product usability of the edited/exported XP.

Targets:

- current edited session can be applied to Skin Dock when appropriate
- exported XP can be consumed by runtime/product paths
- runtime reaches playable state

Hard-fail categories:

- payload mismatch
- runtime load failure
- playable-state failure
- movement/runtime interaction failure

Exit gate:

- runtime acceptance passes for the required workflow family under test

## Phase 7: Build The Real Verifier

Only after Phases 1-6 are understood and grounded in real product paths:

- build a verifier that reflects the acceptance contract
- emit explicit component gates, not vague PASS/FAIL
- refuse to run if required contract inputs are missing

This verifier must never:

- flatten geometry to `1,1,1`
- skip layers
- skip cells as a convenience
- report PASS with required gates skipped

Exit gate:

- verifier is honest, narrow when narrow, and full only when full

## Immediate Next Actions

1. Complete the four audits.
2. Write the canonical XP data contract grounded in current code.
3. Identify whether backend geometry/layer preservation or frontend structure realization is the first hard blocker.
4. Fix that blocker only.
5. Rerun and repeat.

## Non-Goals

- no quick “fidelity” harness
- no single-frame substitute
- no layer-2-only proof
- no UX redesign before parity proof
