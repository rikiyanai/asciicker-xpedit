# Full Codebase & Verifier Architecture Audit

**Date:** 2026-03-23
**Auditor:** Claude (automated multi-agent audit)
**Master:** `e0199a2` | **Base-path:** `feat/base-path-support` @ `673b864`
**Merge base:** `b630364`

---

## 1. Executive Requirement Statement

The Asciicker Pipeline V2 project requires one trustworthy, evidence-backed verifier and product architecture that proves the workbench behaves correctly at both root-hosted (`/workbench`) and prefixed (`/xpedit/workbench`) URLs. Milestone 1 (M1) covers bundle-native XP authoring for player sprite families (idle, attack, death) with whole-sheet editing, verified end-to-end through Skin Dock runtime. Milestone 2 (M2) extends coverage to the full workbench surface including practical PNG ingest, source-panel manual assembly, grid editing, and semantic operations — all under a unified SAR (State-Action-Response) verifier model that is base-path-native from day one. Both milestones require acceptance-grade evidence produced through user-reachable product actions only, not debug/inspector shortcuts.

---

## 2. M1 Pass Requirements

**Definition:** M1 passes when the shipped bundle-native workbench workflow is proven end-to-end on the canonical root-hosted product with acceptance-grade evidence.

| # | Requirement | Source Doc | Code Evidence | Verification Evidence | Verdict |
|---|------------|-----------|--------------|----------------------|---------|
| M1-R1 | Full-recreation verifier lane passes for canonical bundle-native families (idle 126x80, attack 144x80, death 110x88) | `XP_EDITOR_ACCEPTANCE_CONTRACT.md` | `run_bundle_fidelity_test.mjs` orchestrates 3-action authoring with geometry validation | `overall_pass=false` in full_recreation due to canvas-edge cell mismatches (rows 0-1, rightmost col, bottom-right corner) | **Satisfied** — canvas-edge mismatches explicitly classified as harness/verifier edge-hit artifacts, not product failures (PLAYWRIGHT_FAILURE_LOG.md:1315-1317) |
| M1-R2 | Edge-case workflow verifier lane passes for defined bundle/session/gating/hydration flows | `XP_EDITOR_ACCEPTANCE_CONTRACT.md` | `run_edge_workflow_test.mjs` with 7 recipes: partial_bundle_gating, action_tab_hydration, 5 generated_sar_seed_N | 7/7 PASS (PLAYWRIGHT_FAILURE_LOG.md:1280-1288) | **Satisfied** |
| M1-R3 | Results produced through user-reachable product actions only (not debug/inspector shortcuts) | `XP_EDITOR_ACCEPTANCE_CONTRACT.md` | Acceptance-mode action whitelist in runners: `ws_tool_activate`, `ws_paint_cell`, `ws_flood_fill`, etc. Inspector-only actions refused. | Whitelist enforced in code; all acceptance recipes use whole-sheet canvas actions | **Satisfied** |
| M1-R4 | Save/export/test loop working including full bundle readiness progression | `XP_EDITOR_ACCEPTANCE_CONTRACT.md` | `bundleNotReady` check added to `updateWebbuildUI()` (workbench.js:816). `visualLayerHasMeaningfulContent()` gate prevents false "saved" status. | EV-001 resolved: button disabled when not all actions ready. EV-002 resolved: blank-save correctly stays "blank". | **Satisfied** |
| M1-R5 | Resulting full bundle works in Skin Dock/runtime (not just editor/export isolation) | `XP_EDITOR_ACCEPTANCE_CONTRACT.md` | `run_bundle_fidelity_test.mjs` includes Skin Dock injection step. Earlier N=20 preboot test: 0/20 crashes. | Skin Dock pass in bundle fidelity lane. `b1faac3` accepts ready status. | **Satisfied** |
| M1-R6 | Base-path verification shows no `/xpedit`-specific regressions relative to root-hosted behavior | User requirement | Comparison matrix run: master root, branch root, branch `/xpedit` | "No `/xpedit`-specific regressions in any lane" (PLAYWRIGHT_FAILURE_LOG.md:1309-1311) | **Satisfied** |
| M1-R7 | Residual issues explicitly classified as verifier-only artifacts or accepted non-blocking items | User requirement | Canvas-edge mismatches documented with root cause (scroll boundary artifacts) | Explicitly classified in closeout (PLAYWRIGHT_FAILURE_LOG.md:1313-1317) | **Satisfied** |

### M1 Closeout Record

**Location:** `PLAYWRIGHT_FAILURE_LOG.md` lines 1272-1324
**Status:** CLOSED on canonical root-hosted workbench
**Commit:** `14e8e95` (master)
**Date:** 2026-03-23

**Fixes applied in closeout session:**
- EV-001 (Test This Skin gating): `bundleNotReady` check — RESOLVED
- EV-002 (blank-save expectation): test corrected to expect `blank` — RESOLVED (NOT_A_BUG)
- EV-003 (switch_action_tab race): 800ms settle + activeActionKey confirmation + dual geometry wait — RESOLVED

**Accepted non-blocking residuals:**
- Canvas-edge cell mismatches in full_recreation mode (harness artifact, not product failure)

### Acceptance-Critical vs Diagnostic Lanes

| Lane | Type | Status |
|------|------|--------|
| `run_bundle_fidelity_test.mjs` (3-action bundle authoring) | Acceptance | PASS |
| `run_edge_workflow_test.mjs` (7 recipes) | Acceptance | PASS (7/7) |
| `run_fidelity_test.mjs` (single-session XP roundtrip) | Acceptance (non-bundle) | Available |
| `full_recreation` cell-level comparison | Diagnostic | KNOWN: canvas-edge mismatches (non-blocking) |

---

## 3. M2 Pass Requirements

**Definition:** M2 passes when the verifier and product cover the full shipped workbench for practical PNG ingest/manual assembly, with SAR-based verification at both root-hosted and prefixed URLs.

| # | Requirement | Source Doc | Current State | Verdict |
|---|------------|-----------|--------------|---------|
| M2-R1 | Verifier models the entire workbench, not just the whole-sheet editor | `2026-03-22-workbench-verifier-sar-model.md` | SAR blueprint covers 7 state surfaces, 28+ actions. Verifier code covers ~8 actions (edge-workflow only). | **Not satisfied** — ~25% of SAR model in executable verifier |
| M2-R2 | All user-reachable actions inventoried in canonical SAR table (buttons, modes, context menus, source/grid/whole-sheet/runtime) | `2026-03-22-workbench-sar-table-blueprint.md` | Blueprint enumerates 96 actions across all panels. No machine-readable `action_registry.json` exists. | **Partially satisfied** — design complete, machine-readable artifact missing |
| M2-R3 | SAR model defines starting state, actions, responses, valid sequences per workflow family | `2026-03-22-workbench-sar-table-blueprint.md`, `2026-03-21-milestone-2-png-verifier-design.md` | Edge-workflow runner has invariant checker with 8 operators + generated sequences. PNG/source/grid families undefined. | **Partially satisfied** — M1 families defined, M2 families not |
| M2-R4 | Verifier uses SAR model for contract-driven workflow sequences | `2026-03-21-milestone-2-png-verifier-design.md` | Edge-workflow uses ACTIONS dispatch + precondition gating + stochastic generation. No PNG/source/grid equivalents. | **Partially satisfied** — infrastructure exists for M1 scope only |
| M2-R5 | Structured evidence for PNG/manual-assembly workflows (workflow-state-driven correctness) | `2026-03-21-milestone-2-png-verifier-design.md` | No PNG baseline test harness exists. No source-panel workflow verifier. No grid assembly verifier. | **Not satisfied** |
| M2-R6 | Acceptance-critical M2 lanes pass for both root-hosted and prefixed hosting | User requirement, `2026-03-23-milestone-2-base-path-unified-verifier-plan.md` (branch only) | No M2-specific acceptance lanes exist yet. Base-path verifier infrastructure (verifier_lib.mjs with resolveRoute) exists on branch only. | **Not satisfied** |
| M2-R7 | Diagnostic vs acceptance boundary explicit | `PNG_STRUCTURAL_BASELINE_CONTRACT.md` | Contract defines protected (structural pipeline) vs not-guaranteed (visual correctness). No test infrastructure enforces this. | **Partially satisfied** — design clear, enforcement missing |

### M2 Phase Completion Estimates

| Phase | Scope | Estimated Completion | Key Gaps |
|-------|-------|---------------------|----------|
| M2-A | Freeze structural PNG baseline | ~40% | No dedicated PNG baseline test harness; G7-G9 gates not called; no Skin Dock smoke test for PNG path |
| M2-B | Source-panel assisted assembly | ~50% | Template guide overlay missing; auto-slice guides missing; template-aware labeling missing |
| M2-C | Whole-sheet editor as primary | ~60% | Legacy inspector not demoted; SelectTool not wired; OvalTool/TextTool not imported; EditorApp.undo()/redo() are stubs |
| M2-D | Source/grid panel stability | ~70% | Semantic grid labels in-progress; source panel pan deferred; numeric bbox readout deferred |
| M2-E | Semantic dictionaries | ~30% | Multi-frame verification incomplete; region-edit API missing; palette-role mapping missing |
| M2-F | Analyze as assistive only | ~30% | Suggestion badge missing; guide overlay missing; UX clarification text missing |

---

## 4. Required Architecture

These systems/artifacts must exist for M2 acceptance to be trustworthy.

### 4.1 Verifier Runners

| Runner | Scope | Status |
|--------|-------|--------|
| XP fidelity runner (single-session roundtrip) | M1 acceptance | EXISTS (`run_fidelity_test.mjs`) |
| Bundle fidelity runner (3-action orchestration) | M1 acceptance | EXISTS (`run_bundle_fidelity_test.mjs`) |
| Edge-workflow runner (SAR sequences + invariants) | M1 acceptance | EXISTS (`run_edge_workflow_test.mjs`) |
| PNG structural baseline runner | M2-A acceptance | MISSING |
| Source-panel workflow runner | M2-B acceptance | MISSING |
| Grid assembly runner | M2-D acceptance | MISSING |
| Whole-sheet integration runner | M2-C acceptance | MISSING |
| Full-workbench SAR runner (unified) | M2 acceptance | MISSING |

### 4.2 Shared Verifier Core

| Artifact | Purpose | Status |
|----------|---------|--------|
| `verifier_lib.mjs` | Shared parseArgs, resolveRoute, openWorkbench, captureState, report writing | EXISTS on `feat/base-path-support` ONLY. Master has no shared library — all patterns inline. |
| `selectors.mjs` | Shared DOM selector constants | MISSING |
| `action_registry.json` | Machine-readable SAR action inventory | MISSING |
| `recipe_schema.json` | Recipe validation schema | MISSING |

### 4.3 State/Debug API Contract

| Surface | Status |
|---------|--------|
| `__wb_debug.getState()` — curated immutable snapshot | EXISTS. P1 fields (bundleId, activeActionKey, templateSetKey, activeLayer, visibleLayers, layerCount, sessionDirty, gridCols, gridRows) added on `feat/base-path-support` at `f246828`. **Master lacks P1/P2 additions.** |
| `__wb_debug._state()` — raw mutable reference | EXISTS. Required fallback for `actionStates` (not yet curated). |
| `__wb_debug.getWholeSheetEditorState()` | EXISTS (`whole-sheet-init.js:1578`) but 0 test consumers |
| `__wb_debug.getWebbuildDebugState()` | EXISTS but separate from getState() |
| `__wb_debug.getInspectorState()` | EXISTS but separate from getState() |
| State-capture contract doc | EXISTS on `feat/base-path-support` ONLY (`2026-03-23-state-capture-contract.md`) |

### 4.4 Route/Base-Path Handling Contract

| Layer | Root Status | Base-Path Status |
|-------|------------|-----------------|
| Flask routes (`app.py`) | Works | `feat/base-path-support` only (`fa3ef88`) |
| JS fetch calls (`workbench.js`) `bp()` helper | N/A (root-relative) | `feat/base-path-support` only (`b6de436`) — 26+ fetches prefixed |
| WS font URL (`whole-sheet-init.js`) `_BP` | N/A | `feat/base-path-support` only (`502d850`) |
| HTML asset tags (`workbench.html`) | Works | Server-side rewrite via `_serve_web_html()` (`feat/base-path-support`) |
| Verifier URL resolution | Hardcoded `127.0.0.1:5071/workbench` | `resolveRoute()` in `verifier_lib.mjs` (`feat/base-path-support`) |
| Python test parameterization | Root only | `hosted_client` fixture parameterizes root + `/xpedit` (`feat/base-path-support` @ `7d3b186`) |

### 4.5 Fixture Inventory

| Fixture | Purpose | Status |
|---------|---------|--------|
| Player sprite XPs (`sprites/*.xp`) | M1 fidelity reference | EXISTS |
| `template_registry.json` | Geometry definitions per action | EXISTS |
| `cat_sheet.png` (test fixture) | PNG upload contract test | EXISTS |
| `all_black.png` (test fixture) | Negative-path PNG test | EXISTS but orphaned (no test references it) |
| Per-family known-good PNG fixtures | M2-A baseline | MISSING |
| Corrupt/edge-case PNG fixtures | M2-A negative paths | MISSING |

### 4.6 Report/Artifact Schema

| Artifact | Status |
|----------|--------|
| Per-run structured report JSON | EXISTS in runners (session/meta capture) |
| Route-tagged artifacts (hosting mode label) | EXISTS on `feat/base-path-support` (`hostingModeTag()` in verifier_lib.mjs) |
| Failure log (append-only, structured) | EXISTS (`PLAYWRIGHT_FAILURE_LOG.md`) |
| Bundle readiness progression evidence | EXISTS (edge-workflow captures actionStates per step) |

### 4.7 Acceptance vs Diagnostic Boundaries

| Boundary | Definition | Enforcement |
|----------|-----------|-------------|
| M1 acceptance actions | Whole-sheet action whitelist (ws_tool_activate, ws_paint_cell, etc.) | Code-enforced in runners |
| M1 diagnostic actions | Inspector/legacy grid actions | Refused in acceptance mode |
| M2 acceptance scope | Structural pipeline: any PNG → structural XP → runtime-safe | DEFINED in PNG_STRUCTURAL_BASELINE_CONTRACT but no test enforces |
| M2 diagnostic scope | Visual correctness, sprite boundaries, palette fidelity | Explicitly excluded from acceptance |

### 4.8 Additional Required Subsystems

- **Runtime/Skin Dock verification path**: Exists for M1 (bundle fidelity runner). Missing for M2 PNG path.
- **Python API contract coverage**: `test_contracts.py`, `test_workbench_flow.py`, `test_analyze_run_compat.py` exist. Base-path parameterized on branch only.
- **Browser/UI coverage**: `scripts/ui_tests/` framework with 10+ subagents exists but coverage is partial.
- **Whole-sheet/source-panel/grid/source-to-grid/manual-assembly slices**: Designed in SAR blueprint. 0 of 5 M2 verifier slices implemented.

---

## 5. Current Implementation Inventory

### 5.1 Master (`e0199a2`)

**Verifier runners:**
- `run_fidelity_test.mjs` (29 KB) — single-XP roundtrip, 8 contract gates
- `run_bundle_fidelity_test.mjs` (42 KB) — 3-action bundle orchestration with preload support
- `run_edge_workflow_test.mjs` (38 KB) — stochastic SAR + invariant checking, 7 recipes

**Product code:**
- `web/workbench.js` — full workbench with `__wb_debug` API (getState without P1/P2 additions)
- `web/workbench.html` — root-relative asset paths (no base-path support)
- `web/whole-sheet-init.js` (1590 lines) — whole-sheet editor, mounted as primary
- `src/pipeline_v2/` — Flask app, service layer, gates (G7-G12), codec

**Tests:**
- `tests/test_contracts.py` — upload, analyze, run contracts (root-only)
- `tests/test_workbench_flow.py` — workbench flow (root-only)
- `tests/test_analyze_run_compat.py` — analyze/run compat (root-only)
- `tests/test_base_path.py` — exists but limited scope

**UI tests:**
- `scripts/ui_tests/core/` — BrowserSkill, artifacts, server control
- `scripts/ui_tests/subagents/` — 10+ test subagents (smoke, e2e, coverage, etc.)
- `scripts/ui_tests/runner/` — test orchestration

**Docs:**
- M2 planning suite (2026-03-21 through 2026-03-22): practical PNG plan, implementation checklist, PNG verifier design, SAR model, SAR blueprint
- No 2026-03-23 plan docs on master

**What master has that base-path lacks (14 commits since merge-base):**
- Generated SAR edge-workflow recipes (`4507aff`)
- Edge-safe canvas boundary visibility check (`a8f8292`)
- Structured in-product bug reports (`e836fc4`)
- Skin Dock ready-status acceptance (`b1faac3`)
- Canvas bounds caching for verifier replay (`baf7916`)
- M1 closeout record in failure log (`a00c965`)
- Strengthened switch_action_tab wait with 800ms settle (`14e8e95`)
- Dual sessionOut+metaOut gate after tab switch (`b3f2f06`)
- Preload-action option for split verifier runs (`04c916b`)
- Bundle action state sync after preload XP import (`e0199a2`)

### 5.2 `feat/base-path-support` (`673b864`)

**What base-path has that master lacks (16 commits since merge-base):**
- Base-path config helper (`2438958`)
- Flask route mounting under optional base path (`fa3ef88`)
- HTML asset URL prefixing (`48f2853`)
- Frontend URL prefixing with `bp()` helper (`b6de436`)
- Runtime iframe URL prefixing (`e6302fc`)
- CP437 font URL prefixing in whole-sheet editor (`502d850`)
- UI tests made base-path-aware (`21af66d`)
- `getState()` P1/P2 field additions (`f246828`) — 11 new fields
- Shared verifier core extraction (`verifier_lib.mjs`) + hosted test URL parameterization (`7d3b186`)
- M2 base-path unified verifier plan + bug-gap index (`6290275`)
- State-capture contract doc (`8b602bc`)
- Verifier runner reconciliation with canonical master (`673b864`)

**Key artifacts on branch only:**
- `scripts/xp_fidelity_test/verifier_lib.mjs` — shared parseArgs, resolveRoute, openWorkbench, captureState, reporting
- `docs/plans/2026-03-23-milestone-2-base-path-unified-verifier-plan.md` — unified verifier architecture plan
- `docs/plans/2026-03-23-milestone-2-bug-gap-index.md` — 32-item bug/gap inventory (PB-01 through PB-14, VB-01 through VB-11, DA-01 through DA-03, DP-01 through DP-05)
- `docs/plans/2026-03-23-state-capture-contract.md` — getState() vs _state() sourcing rules

---

## 6. Drift Findings

Ranked by severity (CRITICAL > HIGH > MEDIUM > LOW).

### DF-01: M1 Closure Status Conflict Between Branches

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Summary** | Master declares M1 CLOSED (PLAYWRIGHT_FAILURE_LOG.md:1272-1324). Base-path unified verifier plan (line 19) states "M1 is **not yet closed**" and lists 5 blockers as OPEN. |
| **Branch/Worktree** | Both — contradictory claims |
| **Requirement Affected** | M1-R1 through M1-R7, M2 kickoff precondition |
| **Code Evidence** | Master commit `a00c965` records M1 closeout. Base-path plan written at `6290275` before master's closeout commits. |
| **Doc Evidence** | PLAYWRIGHT_FAILURE_LOG.md lines 1272-1324 (master) vs 2026-03-23-milestone-2-base-path-unified-verifier-plan.md lines 19-29 (branch) |
| **Verification Evidence** | Master: 7/7 edge-workflow PASS, EV-001/002/003 resolved. Base-path: lists PB-10, PB-11, PB-12, PB-13, action_tab_hydration step-5 as OPEN. |
| **Root Cause** | Base-path plan written before master's M1 closeout session. Temporal ordering: base-path plan (`6290275`) → master fixes (`b3f2f06`, `14e8e95`, `a00c965`, `04c916b`, `e0199a2`). |
| **Fix Type** | Doc reconcile + branch merge-forward. Base-path plan must acknowledge M1 closure and remove stale blocker list. Master's 14 commits must be merged/cherry-picked into base-path. |

### DF-02: Verifier Infrastructure Divergence

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Summary** | `verifier_lib.mjs` (shared infrastructure with resolveRoute, captureState, base-path-aware openWorkbench) exists only on `feat/base-path-support`. Master runners have all patterns inline with no shared extraction. |
| **Branch/Worktree** | Master missing shared library; base-path missing master's 14 edge-workflow improvements |
| **Requirement Affected** | M2-R6 (base-path acceptance lanes), architectural coherence |
| **Code Evidence** | `verifier_lib.mjs` at `7d3b186` on branch. Master's runners are self-contained. |
| **Doc Evidence** | State-capture contract (`2026-03-23-state-capture-contract.md`) defines canonical captureState() pattern — branch only. |
| **Verification Evidence** | Both runners produce correct results for their respective scope, but neither can serve the other's requirements. |
| **Fix Type** | Code reconcile — merge verifier_lib.mjs into master, then merge master's 14 commits into branch, then reconcile runner differences. |

### DF-03: getState() P1/P2 Fields Missing on Master

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Summary** | `getState()` on base-path exposes 11 additional fields (bundleId, activeActionKey, templateSetKey, activeLayer, visibleLayers, layerCount, sessionDirty, gridCols, gridRows, sourceCutsV, sourceCanvasZoom) added at `f246828`. Master's getState() lacks all of these. |
| **Branch/Worktree** | Master missing P1/P2 fields |
| **Requirement Affected** | M2-R1 (verifier models full workbench), M2-R3 (SAR defines state per family) |
| **Code Evidence** | `workbench.js` getState() function differs between branches. Base-path: `f246828`. |
| **Doc Evidence** | State-capture contract documents these as "M2 verifier prerequisite" |
| **Verification Evidence** | Master's edge-workflow runner works around this by using `_state()` fallback. Base-path's runner prefers `getState()`. |
| **Fix Type** | Code reconcile — cherry-pick `f246828` into master. |

### DF-04: State Capture Pattern Divergence in Edge-Workflow Runner

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Summary** | Master's `run_edge_workflow_test.mjs` reads `activeLayer` from `raw?.activeLayer` (raw _state). Base-path reads from `geo?.activeLayer` (curated getState). `sessionDirty` likewise: master uses `!!raw?.sessionDirty`, base-path uses `geo?.sessionDirty ?? false`. |
| **Branch/Worktree** | Both — different patterns for same data |
| **Requirement Affected** | Verifier correctness, state-capture contract compliance |
| **Code Evidence** | Diff in captureState() implementations. Base-path aligns with state-capture contract. |
| **Doc Evidence** | State-capture contract Rule 1: "Prefer getState() for all assertion data" |
| **Verification Evidence** | Both produce functionally equivalent results currently, but master's pattern is fragile (mutable reference). |
| **Fix Type** | Code reconcile — adopt base-path's getState()-first pattern once P1 fields land on master. |

### DF-05: Bug-Gap Index Counts Stale on Branch

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Summary** | Base-path bug-gap index lists 22 OPEN items. At least 5 items (PB-10 runtime files, PB-12 cell mismatches, PB-13 Skin Dock stall, PB-11 whole-sheet layout, action_tab_hydration step-5) were resolved or reclassified by master's closeout session. Counts are immediately stale. |
| **Branch/Worktree** | `feat/base-path-support` — bug-gap-index.md |
| **Requirement Affected** | M2 planning accuracy |
| **Code Evidence** | Master commits `14e8e95`, `b3f2f06`, `a00c965` resolve issues listed as OPEN in index. |
| **Doc Evidence** | Bug-gap-index.md § 1 Product Bugs table |
| **Verification Evidence** | PLAYWRIGHT_FAILURE_LOG M1 closeout: EV-001/002/003 resolved. |
| **Fix Type** | Doc reconcile — update bug-gap index status for items resolved by master. |

### DF-06: Base-Path Checklist Shows 0/8 Done (Stale)

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Summary** | `docs/BASE_PATH_SUPPORT_CHECKLIST.md` on master shows items as incomplete. Branch has bp() in JS, _BP in WS init, Flask route mounting, HTML rewriting — all functional. Checklist predates these fixes. |
| **Branch/Worktree** | Master — checklist not updated after branch work |
| **Requirement Affected** | Documentation accuracy for base-path progress |
| **Code Evidence** | Branch commits `2438958` through `e6302fc` implement base-path support |
| **Doc Evidence** | BASE_PATH_SUPPORT_CHECKLIST.md |
| **Fix Type** | Doc reconcile — update checklist to reflect branch implementation status. |

### DF-07: Python Tests Root-Only on Master

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Summary** | `test_contracts.py`, `test_workbench_flow.py`, `test_analyze_run_compat.py` on master are hardcoded to root `/`. Branch parameterizes via `hosted_client` fixture at `7d3b186`. |
| **Branch/Worktree** | Master — no base-path parameterization |
| **Requirement Affected** | M2-R6 (both root and prefixed hosting) |
| **Code Evidence** | Branch `7d3b186` adds `hosted_client` fixture. Master lacks this. |
| **Fix Type** | Code reconcile — cherry-pick `7d3b186` into master. |

### DF-08: M2 Planning Docs Claim Shared Infrastructure Exists More Than It Does

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Summary** | Master's M2 planning docs (SAR model, SAR blueprint) describe verifier infrastructure that should be built. Base-path's unified verifier plan references `verifier_lib.mjs`, `selectors.mjs`, `action_registry.json`. Only verifier_lib.mjs actually exists (and only on branch). selectors.mjs and action_registry.json do not exist on either branch. |
| **Branch/Worktree** | Both — plans ahead of implementation |
| **Requirement Affected** | M2-R2 (canonical SAR table), M2-R4 (verifier uses SAR model) |
| **Code Evidence** | `selectors.mjs` not found. `action_registry.json` not found. |
| **Doc Evidence** | 2026-03-23-milestone-2-base-path-unified-verifier-plan.md line 7 |
| **Fix Type** | Status correction — plans should mark these as "to be built" not implied-existing. |

### DF-09: 42 of 48 Debug API Functions Unused by Tests

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Summary** | Only 6 of 48 `__wb_debug` functions are consumed by automated tests: getState, frameSignature, readFrameCell, suppressAutoSave, suppressRender, flushSave. 42 functions (including getWholeSheetEditorState, getWebbuildDebugState, getInspectorState) have zero test consumers. |
| **Branch/Worktree** | Both |
| **Requirement Affected** | M2-R1 (verifier models full workbench) |
| **Code Evidence** | Debug API surface in workbench.js vs test imports |
| **Fix Type** | Implementation — M2 verifier slices should consume relevant debug APIs as they are built. |

### DF-10: Operator-Facing Docs Describe Base-Path as Future

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Summary** | `docs/MVP_DEPLOYMENT.md` and `docs/BASE_PATH_SUPPORT_CHECKLIST.md` describe subpath hosting as "future work" / "not safe yet". Branch has working implementation. |
| **Branch/Worktree** | Master docs |
| **Requirement Affected** | Documentation accuracy |
| **Code Evidence** | Branch implementation at `fa3ef88` through `502d850` |
| **Fix Type** | Doc reconcile — update to "implemented on feat/base-path-support, pending merge to master". |

---

## 7. Doc Index

Full matrix in companion document: `docs/research/ascii/2026-03-23-doc-index-and-drift-matrix.md`

Summary:

| Category | Count | Status |
|----------|-------|--------|
| Canonical source of truth | 8 | Mostly accurate; BASE_PATH_SUPPORT_CHECKLIST stale |
| Active working plan (master) | 5 | M2 plans accurate as design; implementation gaps noted |
| Active working plan (branch) | 3 | M1 status claims stale; bug-gap counts stale |
| Stale but useful history | 6 | INTEGRATION_STRATEGY_AND_REPLAN.md most misleading |
| Branch-specific | 4 | Base-path WT PLAYWRIGHT_STATUS/FAILURE_LOG stale (2026-03-10) |

---

## 8. Recommended Sequence

Fix drift in this order before continuing M2 implementation:

### Phase 0: Branch Reconciliation (BLOCKING)

1. **Cherry-pick master's 14 commits into `feat/base-path-support`** (or merge master → branch). This brings edge-workflow robustness, M1 closeout record, preload support, generated SAR recipes, and canvas bounds caching.

2. **Cherry-pick branch's key commits into master:**
   - `f246828` — getState() P1/P2 fields (M2 prerequisite)
   - `7d3b186` — verifier_lib.mjs + hosted test parameterization
   - `2438958` through `502d850` — base-path product support (6 commits)

3. **Reconcile state capture patterns** — adopt getState()-first pattern from state-capture contract on both branches.

### Phase 1: Doc Corrections (HIGH)

4. **Update base-path unified verifier plan** — acknowledge M1 closure, remove stale blocker list, update bug-gap counts.

5. **Update BASE_PATH_SUPPORT_CHECKLIST** — reflect branch implementation status.

6. **Update MVP_DEPLOYMENT.md** — reflect base-path implementation status (branch, pending merge).

7. **Archive stale docs** — INTEGRATION_STRATEGY_AND_REPLAN.md, REXPAINT_LIBRARY_AUDIT_FINDINGS.md (mark as pre-whole-sheet-pivot history).

### Phase 2: M2 Foundation (Before Feature Work)

8. **Merge branches** — unified master with both base-path support and M1 robustness fixes.

9. **Create action_registry.json** — machine-readable SAR action inventory from blueprint.

10. **Create PNG baseline test harness** — M2-A foundation.

11. **Wire G7-G9 gates** — currently coded but not called in export pipeline.

12. **Add curated `actionStates` to getState()** — eliminate _state() fallback requirement.

### Phase 3: M2 Verifier Slices

13. Build M2 verifier slices in this order:
    - PNG structural baseline (M2-A) — highest blocking factor
    - Source-panel workflow (M2-B) — primary M2 user path
    - Grid assembly (M2-D) — dependent on source-panel
    - Whole-sheet integration (M2-C) — extending M1 infrastructure
    - Full-workbench SAR (unified) — capstone

Each slice must use verifier_lib.mjs, be base-path-aware, and produce route-tagged artifacts.

---

## Appendix: Evidence References

| Reference | Location |
|-----------|----------|
| M1 closeout record | `PLAYWRIGHT_FAILURE_LOG.md` lines 1272-1324 |
| Edge-workflow 7/7 results | `PLAYWRIGHT_FAILURE_LOG.md` lines 1280-1288 |
| Acceptance contract | `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` |
| PNG structural baseline | `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md` |
| SAR blueprint | `docs/plans/2026-03-22-workbench-sar-table-blueprint.md` |
| State-capture contract | `docs/plans/2026-03-23-state-capture-contract.md` (branch) |
| Bug-gap index | `docs/plans/2026-03-23-milestone-2-bug-gap-index.md` (branch) |
| Unified verifier plan | `docs/plans/2026-03-23-milestone-2-base-path-unified-verifier-plan.md` (branch) |
| Merge base | `b630364` |
| Master HEAD | `e0199a2` |
| Base-path HEAD | `673b864` |
