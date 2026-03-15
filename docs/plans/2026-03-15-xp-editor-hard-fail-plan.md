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

## Audit-Grounded Blocker Order (2026-03-15)

Four audits completed. See `docs/research/ascii/2026-03-15-four-audits-xp-editor.md`.

**Result at audit time: 10 FAIL, 1 PARTIAL, 0 PASS.** The backend was the first wall.

Update after B1 patch:

- `workbench_upload_xp()` now derives `angles/anims/projs` from L0 row 0 instead of hardcoding `1,1,1`
- the next priority is no longer "make the frame inspector path pass"
- the next frontend/editor priority is the whole-sheet REXPaint-style editor pivot

### Tier 1: Backend Structure (fix first, in this order)

1. ~~**B1: Upload geometry hardcoding**~~ FIXED — `workbench_upload_xp()` now derives geometry from L0 row 0 metadata instead of hardcoding `1,1,1`.
2. **B2: Upload layer discarding** — `service.py:2012-2014` extracts only L2. Must extract and store all layers.
3. **B3: Session model is single-layer** — `WorkbenchSession.cells` is one flat list. Must support multi-layer.
4. **B4: Export fabricates L0/L1/L3** — `service.py:1193-1231` replaces real layers with templates. Must export from stored layers.

### Tier 2: Format and Protocol

5. **B5: XP codec incompatibility** — Python and JS codecs use structurally incompatible container formats (whole-file gzip + no magic vs per-layer gzip + REXP magic + 20-byte header). Neither can read the other's output. Must unify on REXPaint standard format or delete JS codec if EditorApp will proxy through backend.
6. **B6: Whole-sheet editor path not integrated** — the shipped workbench still centers editing on the legacy frame inspector instead of a whole-sheet REXPaint-style editor surface.

### Tier 3: UI and Integration

7. **B7: EditorApp / whole-sheet editor salvage audit** — salvageable pieces likely exist in `feat/workbench-xp-editor-wireup` and `web/rexpaint-editor/*`, but they must be audited before implementation.
8. **B8: No new-XP authoring** — Deleted in 034004e. Rebuild with real geometry.
9. **B9: No multi-layer editing UI** — inspector edits L2 only. Need real layer stack behavior on the whole-sheet editor path.
10. ~~**B10: AGENT_PROTOCOL.md contradiction**~~ FIXED — Updated to reference acceptance contract gates instead of deleted harness.

### Tier 4: Runtime Validation (blocked by Tier 1)

11. **B11: Runtime with real geometry** — Validate after B1-B4 are fixed.

## Immediate Next Actions

1. ~~Complete the four audits.~~ DONE — see audit document.
2. ~~Write canonical XP data contract.~~ DONE — see `docs/research/ascii/2026-03-15-xp-data-contract.md`. Phase 1 exit gate met.
3. ~~Fix B10: AGENT_PROTOCOL.md doc drift.~~ DONE.
4. ~~Fix B1: make `workbench_upload_xp()` derive geometry from XP file using L0 metadata parser.~~ DONE.
5. Audit the whole-sheet REXPaint pivot before more frontend code:
   - `docs/2026-03-15-CLAUDE-HANDOFF-WHOLE-SHEET-REXPAINT-PIVOT.md`
6. Fix B2: extract all layers on upload.
7. Fix B3: extend session model to multi-layer.
8. Fix B4: export from stored layers.
9. After Tier 1 backend preservation is fixed, implement the whole-sheet editor path instead of improving the legacy frame inspector path.

## Non-Goals

- no quick “fidelity” harness
- no single-frame substitute
- no layer-2-only proof
- no UX redesign before parity proof
