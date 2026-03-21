# PNG Structural Ingest Baseline Contract

Date: 2026-03-21
Status: canonical
Purpose: Non-regression guarantee for the arbitrary-PNG structural ingest path

## What This Contract Protects

Any readable PNG must be able to pass through the structural pipeline and produce a
runtime-safe bundle, even if the visual quality of slicing is poor. This contract
protects the **structural and runtime safety** checkpoint established during Milestone 1.

Visual correctness is explicitly out of scope. A badly-sliced PNG that produces a
structurally valid, runtime-safe bundle is a PASS under this contract.

## The Structural Pipeline

The pipeline under protection:

1. **PNG upload** → `POST /api/upload` → `src/pipeline_v2/app.py`
2. **Bundle template create** → `POST /api/workbench/bundle/create` → `src/pipeline_v2/app.py:228`
3. **Action-grid apply** → `POST /api/workbench/action-grid/apply` → `bundle_action_run()` at `src/pipeline_v2/service.py:2145`
4. **XP generation** → produces structurally valid XP matching the target family contract
5. **Session creation** → session persisted for editor load
6. **Editor load** → whole-sheet editor mounts via `hydrateWholeSheetEditor()`
7. **Export** → `workbench_export_bundle()` at `src/pipeline_v2/service.py`, triggers `_run_structural_gates()` at line 2770
8. **Skin Dock injection** → exported bundle accepted by runtime without crash

## Structural Gates

### Gate G10: Dimension Match
- **What**: XP dimensions (cols × rows) must match the template's `xp_dims`
- **Where**: `src/pipeline_v2/gates.py:41` — `gate_g10_action_dims()`
- **Called at**: `_run_structural_gates()` in `src/pipeline_v2/service.py:2770`, invoked at lines 2828 and 2892
- **Failure**: `THRESHOLD_BREACHED` — XP dimensions do not match family contract
- **Status**: EXISTS — enforced on bundle export

### Gate G11: Layer Count
- **What**: Layer count must match the template's expected layer count
- **Where**: `src/pipeline_v2/gates.py:59` — `gate_g11_layer_count()`
- **Called at**: same as G10
- **Failure**: `THRESHOLD_BREACHED` — wrong number of layers
- **Status**: EXISTS — enforced on bundle export

### Gate G12: L0 Metadata
- **What**: L0 row-0 metadata glyphs must match expected family pattern (angles, projections, anim counts)
- **Where**: `src/pipeline_v2/gates.py:69` — `gate_g12_l0_metadata()`
- **Called at**: same as G10
- **Failure**: `THRESHOLD_BREACHED` — metadata glyphs do not match family contract
- **Status**: EXISTS — enforced on bundle export

### Gate G7: Geometry Cell Count
- **What**: Total cell count must match expected geometry
- **Where**: `src/pipeline_v2/gates.py:10` — `gate_g7_geometry()`
- **Status**: EXISTS in code — **NOT called** in `_run_structural_gates()`. Needs integration decision.

### Gate G8: Non-empty Content
- **What**: Visual layer must have at least `min_ratio` (default 5%) non-empty glyphs
- **Where**: `src/pipeline_v2/gates.py:19` — `gate_g8_nonempty()`
- **Status**: EXISTS in code — **NOT called** in `_run_structural_gates()`. Needs integration decision.

### Gate G9: Handoff Populated
- **What**: At least one populated cell must exist
- **Where**: `src/pipeline_v2/gates.py:32` — `gate_g9_handoff()`
- **Status**: EXISTS in code — **NOT called** in `_run_structural_gates()`. Needs integration decision.

## What This Contract Does NOT Guarantee

- Visual correctness of sprite slicing
- Correct sprite boundaries or alignment
- Semantic accuracy of region placement
- Palette fidelity to the source PNG
- Animation timing or sequence correctness
- That the resulting sprite looks good in gameplay
- That Find Sprites or Analyze produce correct bboxes

## Regression Test Requirements

A conforming non-regression test must verify:

1. **Input**: An arbitrary readable PNG (at least one per enabled family: player, attack, plydie)
2. **Pipeline execution**: Upload → bundle create → action-grid apply → export
3. **Structural validation**:
   - G10 passes (dimensions match family contract)
   - G11 passes (layer count matches)
   - G12 passes (L0 metadata matches)
4. **Session integrity**: Session can be loaded, session data round-trips through save/load
5. **Export validity**: Exported XP is a valid REXPaint binary, re-readable by the XP codec
6. **Runtime safety**: Exported bundle can be injected into Skin Dock without crash (if testable headlessly; otherwise manual verification acceptable for M2)

### Test fixture requirements

- At least one known-good PNG test fixture per enabled family
- Fixtures should be committed under `tests/fixtures/` for reproducibility
- Fixtures do not need to look good — they need to be structurally processable

## Currently Implemented vs Missing

| Component | Status | Notes |
|-----------|--------|-------|
| PNG upload endpoint | EXISTS | `src/pipeline_v2/app.py` |
| Bundle create endpoint | EXISTS | `src/pipeline_v2/app.py:228` |
| Action-grid apply | EXISTS | `src/pipeline_v2/service.py:2145` |
| Structural gates G10-G12 | EXISTS | `src/pipeline_v2/gates.py:41-82` |
| `_run_structural_gates()` | EXISTS | `src/pipeline_v2/service.py:2770` |
| Gates G7-G9 in code | EXISTS | `src/pipeline_v2/gates.py:10-38` — not yet called |
| Automated PNG-to-bundle test | **MISSING** | No test exercises full PNG→bundle→gate path |
| Known-good PNG fixtures (per family) | **PARTIAL** | Only `tests/fixtures/known_good/cat_sheet.png` exists |
| Skin Dock runtime smoke test | **MISSING** | Manual Playwright only |

## Enforcement

During Milestone 2 development:

- Any code change to the pipeline, gates, XP codec, or bundle system must not cause a
  previously-passing PNG to fail structural gates
- If a gate is strengthened (e.g., integrating G7-G9), existing passing PNGs must still
  pass under the new gate set, or the change must be documented as intentional tightening
- The non-regression test (when created) should run in CI or as a pre-merge check

## Related Documents

- `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md` — M2-A workstream
- `docs/plans/2026-03-21-milestone-2-implementation-checklist.md` — implementation tasks
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` — broader acceptance contract
- `docs/research/ascii/2026-03-15-xp-data-contract.md` — XP binary data contract
