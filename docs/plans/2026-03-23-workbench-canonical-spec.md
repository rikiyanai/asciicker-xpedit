# Workbench Canonical Spec

**Authority:** This is one of the 3 canonical authority docs for this repo. See Section 6 below.

**Last updated:** 2026-03-24
**Branch:** master @ f967a21

---

## 1. Milestone Definitions & Pass Criteria

### Milestone 1: Bundle-Native New-XP Authoring Viability

**Status: CLOSED** (2026-03-23)

Evidence: `PLAYWRIGHT_FAILURE_LOG.md` commit 14e8e95 — 7/7 edge workflows PASS, Skin Dock PASS, base-path 0 regressions. M1 is the closed baseline. Do not re-litigate M1 pass criteria; refer to the failure log for the closeout record.

### Milestone 2: Practical PNG Ingest and Manual Assembly

**Status: ACTIVE**

M2 passes only when:

- all user-reachable actions are mapped in a canonical SAR table
- the SAR model defines starting state, allowed actions, required responses, and valid next states for each workflow family
- the verifier executes predefined contract-driven workflow sequences on both root-hosted and base-path hosting
- acceptance-critical M2 lanes pass without errors

M2 is NOT: perfect automatic slicing, full existing-XP parity, or full REXPaint parity.

### Future Milestones

Placeholder. No milestone beyond M2 is currently defined.

---

## 2. M2 Sub-Phase Execution Order

| Phase | Scope | Depends On | Status |
|-------|-------|-----------|--------|
| **M2-A** | Structural PNG baseline (dims, layers, metadata gates) | M1 closed | ESTABLISHED |
| **M2-B** | Source panel + grid assembly (draw box, find sprites, drag-to-grid) | M2-A | ESTABLISHED — source-panel 10/10 PASS (5c67ef2); source-to-grid 13/13 PASS (380edee) at root + /xpedit. D1, D2/C2, G1 PROVEN. |
| **M2-C** | Whole-sheet editor coverage (tools, layers, undo) | M2-A | ESTABLISHED — 15/18 W-actions PROVEN. W15 (SelectTool) WIRED only (activation works, visualization not connected). W16/W17 DEFERRED. |
| **M2-D** | Full SAR workflow coverage (all remaining WIRED actions get verifier proof) | M2-B, M2-C | NOT STARTED |
| **M2-E** | Semantic editing (region-based dictionary-driven edits) | M2-D | NOT STARTED |
| **M2-F** | Analyze/auto-slice (assistive, not authoritative) | M2-D | NOT STARTED |

Execute in dependency order. M2-B and M2-C may run in parallel after M2-A.

---

## 3. Current Priority Stack

**Last reviewed:** 2026-03-24

1. **MVP deployment to `rikiworld.com/xpedit`** — LIVE. GitHub Actions runs `23479759126` and `23479759126` passed all 3 jobs. Bug report → GitHub Issue delivery wired via Secret Manager (verified: Issues #6, #7). Bare `/xpedit` route fixed (`8ede2c6`). Remaining follow-up: refresh Node-20-based GitHub Actions before GitHub's Node 24 cutoff. Pipeline runs on Cloud Run free tier are too slow (>5 min) for verifier tests — UI-only flows work fine.
2. **M2-D full SAR workflow coverage** — M2-B and M2-C are established. Remaining WIRED actions outside the whole-sheet blocked/deferred set need committed proof.
3. **PB-01/02/03 undo gaps** in source panel anchor ops — small fixes that affect M2-D completeness.
4. **PB-06 SelectTool visualization** — tool activates but canvas.setSelectionTool() never called, marching-ants not rendered, drag→bounds unverified. W18 (undo) is PROVEN. W16/W17 remain deferred.

This stack is execution priority, not timeless truth. Re-evaluate when any sub-phase status changes.

---

## 4. Acceptance vs Diagnostic Boundary

The canonical verifier path (`truth_table → recipe → run`) is the only source of acceptance evidence. See `docs/AGENT_PROTOCOL.md` Section 13 for the full protocol.

Project-specific narrowing:

- **Acceptance mode** (`--mode acceptance`): user-reachable actions through the shipped whole-sheet editor surface only. Inspector-only and debug-only actions are refused.
- **Diagnostic mode** (`--mode diagnostic`): may use inspector-primary actions for implementation debugging. Results must be labeled diagnostic.
- Ad hoc scripts, `page.evaluate()` probes, and `window.__wb_debug` calls are diagnostic-only — never acceptance evidence.
- If the verifier cannot express a required workflow, that is a verifier bug, not permission to bypass it.

### Runner Classification (2026-03-23 reconciliation)

| Runner | Action Path | Observation | Classification |
|--------|------------|-------------|----------------|
| `run_fidelity_test.mjs` | XP import via file input; painting via canvas mouse events (acceptance mode) | Cell reads via `readFrameCell()`/`frameSignature()` | UI-driven with diagnostic observation layer |
| `run_bundle_fidelity_test.mjs` | Tab switch via DOM click; painting via canvas mouse events | State waits via `_state()`, readiness via `getState()` | Mixed — UI actions + diagnostic observation. M1 historical evidence only. |
| `run_edge_workflow_test.mjs` | Tab switch via DOM click; button clicks; DOM waits | Core state via `getState()` + `_state()` | Mixed — UI actions + diagnostic observation. M1 historical evidence only. |
| `run_structural_baseline_test.mjs` | ALL actions via `fetch()` API calls — zero DOM interaction | API response JSON | Structural-contract only (per `PNG_STRUCTURAL_BASELINE_CONTRACT.md`). NOT UI proof. |
| `run_source_panel_workflow_test.mjs` | ALL actions via DOM clicks, canvas drags, file input, context menu | State reads via `getState()` | UI-driven with diagnostic observation layer |
| `run_source_to_grid_workflow_test.mjs` | ALL actions via DOM clicks, canvas drags, file input, context menu, cross-panel drag/drop | State reads via `getState()` + `readFrameSignature()` | UI-driven with diagnostic observation layer |
| `run_whole_sheet_layer_test.mjs` | ALL actions via DOM clicks on layer panel buttons/rows | State reads via `__wholeSheetEditor.getState()` + DOM class checks | UI-driven with diagnostic observation layer |
| `run_whole_sheet_tools_test.mjs` | ALL actions via DOM clicks, grid dblclick, canvas mouse events | State reads via `readFrameCell()` | UI-driven with diagnostic observation layer |
| `workbench_agents.mjs` (subagents) | DOM clicks + file inputs | `getState()` reads + request interception | Diagnostic / subagent coverage |
| `workbench_coverage_agent.mjs` | DOM clicks, drags, screenshots | Element probes via `evaluate()` | Diagnostic coverage |

**Standard for M2 UI acceptance (2026-03-23):**

1. **UI-driven actions are required.** Every user-facing workflow step (click button, drag on canvas, select file, switch tab) must be performed through the shipped DOM surface — not via `fetch()` or `page.evaluate(async => ...)` action calls.
2. **Read-only diagnostic observation is tolerated.** Using `getState()`, `readFrameCell()`, or `frameSignature()` to *verify* outcomes after a UI action is acceptable. The observation layer does not replace user actions — it confirms their effect.
3. **`fetch()` / API action driving is not acceptance for workflow slices** unless a live structural contract (e.g., `PNG_STRUCTURAL_BASELINE_CONTRACT.md`) explicitly defines that API-backed path for a narrow structural-safety purpose.

**Rule:** Only runners classified as "UI-driven" may produce evidence labeled as acceptance. Structural-contract runners prove API/gate contracts only. Mixed runners are M1 historical evidence — not pure UI-driven acceptance going forward.

---

## 5. Unified M2 Verifier Architecture

### The Problem

M1 used hand-written runners with inline readiness patterns. This worked because M1 scope was small (7 edge workflows, 1 fidelity test, 1 bundle test). M2 has 96+ SAR-enumerated actions across 13 families — hand-writing a runner per workflow does not scale.

### Required Architecture: Capability Canon → Recipe → Run → Proof

The M2 verifier is a pipeline with five stages:

```
┌─────────────────────┐
│ 1. Capability Canon  │  docs/plans/2026-03-23-m2-capability-canon-inventory.md
│    (human-curated)   │  Action families, status, code evidence, proof evidence
└──────────┬──────────┘
           │ machine-readable extraction
           ▼
┌─────────────────────┐
│ 2. Action Registry   │  scripts/xp_fidelity_test/action_registry.json
│    (generated)       │  Per-action: id, family, selectors, preconditions, postconditions
└──────────┬──────────┘
           │ recipe generation
           ▼
┌─────────────────────┐
│ 3. Recipe Generator  │  scripts/xp_fidelity_test/recipe_generator.mjs
│    (UI-only recipes) │  Combines actions into bounded workflow sequences
│                      │  Each step = DOM selector + user gesture (click/drag/input)
│                      │  No page.evaluate() action calls — UI gestures only
└──────────┬──────────┘
           │ execution
           ▼
┌─────────────────────┐
│ 4. DOM Runner        │  scripts/xp_fidelity_test/dom_runner.mjs
│    (Playwright)      │  Executes recipe steps via Playwright actions
│                      │  Uses verifier_lib.mjs for readiness, base-path, reporting
└──────────┬──────────┘
           │ read-only observation
           ▼
┌─────────────────────┐
│ 5. Observation Layer │  getState() primary, _state() fallback (actionStates only)
│    + Proof Artifacts │  Per docs/plans/2026-03-23-state-capture-contract.md
│                      │  Output: structured report JSON + failure-log entries
└─────────────────────┘
```

### Stage Details

**Stage 1 — Capability Canon** is human-curated and already exists (`m2-capability-canon-inventory.md`). It classifies every action as PROVEN/WIRED/PARTIAL/PLANNED/BLOCKED/DEFERRED and tracks code evidence and proof evidence.

**Stage 2 — Action Registry** (`action_registry.json`) exists (committed 85ff3b8, expanded in M2-D). Machine-readable extraction of the capability canon: one entry per action with `id`, `family`, `selectorKey` (reference into `selectors.mjs`), `gestureType` (constrained enum), `paramBindings` (preparatory input steps), `preconditions`, `postconditions`, `acceptanceEligible`, and `generatorReadiness`. Schema: `action_registry_schema.json` (JSON Schema draft-07). Current coverage: 47 READY-family actions; M2-D pass adds 30 more (14 executable + 16 stubs).

**Stage 3 — Recipe Generator** (`recipe_generator.mjs`) exists (committed 85ff3b8). Reads the action registry and composes bounded workflow sequences. A recipe is an ordered list of `{ actionId, params, expectedOutcome }` steps with `_derived` metadata for runner consumption. Currently produces 6 fixed regression recipes for READY-family workflows. Import-safe (no side effects on module import). Bounded-random generation is future work.

**Stage 4 — DOM Runner** (`dom_runner.mjs`) exists (committed 85ff3b8). Executes recipe steps via Playwright DOM actions — never `page.evaluate()` for action driving. Supports gestures: click, setInputFiles, selectOption, fill. Enforces recipe-level precondition gates, refuses blocked gestures, constrains main gestures to value-less types (click, rightClick). Uses `verifier_lib.mjs` for `openWorkbench()`, `captureState()`, base-path resolution, and structured reporting. Proof: 3 recipes pass (bundle_template_apply, bug_report_dismiss, xp_import_roundtrip).

**Stage 5 — Observation Layer** exists via `getState()` and the state-capture contract. Known debt: `actionStates` still requires `_state()` fallback (see state-capture contract §4). The DOM runner captures state after each recipe step and evaluates postconditions using operator-based assertions (eq, gt, truthy, changed, etc.).

### Selector Infrastructure

`selectors.mjs` (committed 85ff3b8) centralizes DOM selectors used by both the action registry and runners. 102+ selector keys verified against `web/workbench.html`. Gesture types defined with blocked flags for canvas/keyboard. M2-D pass adds 31 whole-sheet selectors.

### Relationship to Existing Infrastructure

| Existing | Role in M2 Architecture |
|----------|------------------------|
| `truth_table.py` | XP fidelity oracle — orthogonal to SAR; kept for export/cell truth |
| `verifier_lib.mjs` | Foundation for DOM runner (readiness, state capture, reporting) |
| `run_source_panel_workflow_test.mjs` | M2-B source-panel proof runner — will be replaced by generated recipe + DOM runner |
| `run_source_to_grid_workflow_test.mjs` | M2-B source-to-grid proof runner (D1/D2/G1) — will be replaced by generated recipe + DOM runner |
| `run_structural_baseline_test.mjs` | Structural-contract only — stays standalone, not part of SAR pipeline |
| M1 runners (fidelity, bundle, edge-workflow) | Frozen — M1 is closed, do not refactor |

### Known Design Debt

- `actionStates` not yet in `getState()` — requires `_state()` fallback (state-capture contract §4)
- Tab hydration readiness uses `_state().activeActionKey` — should migrate to `getState()` P3 batch
- Canvas-coordinate actions (source panel drawing, grid drag) need a selector abstraction beyond CSS — likely `{ type: "canvas", target: "sourceCanvas", gesture: "drag", from: [x1,y1], to: [x2,y2] }`
- Dual-button branching: G3 (row up/down), G4 (col left/right), W18 (undo/redo) each map one canon ID to two physical buttons. Current schema's `paramBindings` only supports input-setting gestures, not conditional click dispatch. Needs schema evolution or canon ID split.
- inputRange gesture: S18 (source zoom), G13 (grid zoom) need `inputRange` added to dom_runner.mjs gesture executors.
- Alias rows: S15=C3, S16=C4, G7=C6, G8=C7 are distinct canon IDs sharing selectors/gestures. Schema allows separate entries; deferred to alias-row pass.

### Implementation Status

| # | Component | Status | Commit |
|---|-----------|--------|--------|
| 1 | `selectors.mjs` | **Done** | 85ff3b8 |
| 2 | `action_registry_schema.json` | **Done** | 85ff3b8 |
| 3 | `action_registry.json` | **Done** (47 entries); M2-D expansion to 77 in progress | 85ff3b8 |
| 4 | `recipe_generator.mjs` | **Done** (6 fixed recipes) | 85ff3b8 |
| 5 | `dom_runner.mjs` | **Done** (click, setInputFiles, selectOption, fill) | 85ff3b8 |
| 6 | M2-D registry expansion | **In progress** | See `docs/plans/2026-03-24-m2d-registry-expansion-design.md` |
5. `dom_runner.mjs` — recipe executor using verifier_lib foundation

This architecture is NOT yet implemented. The next implementation target after this canonization pass is items 1-3 above.

---

## 6. Document Authority Model

This repo uses a 3-doc canonical authority model:

| # | Doc | Role |
|---|-----|------|
| 1 | `PLAYWRIGHT_FAILURE_LOG.md` | Reality/failure/proof log — what actually happened |
| 2 | This doc (`docs/plans/2026-03-23-workbench-canonical-spec.md`) | Normative requirements, roadmap, priority, policy |
| 3 | `docs/plans/2026-03-23-m2-capability-canon-inventory.md` | Capability inventory, truth-table, SAR canon |

### Doc Classifications

| Classification | Rule |
|---------------|------|
| **Canonical** | Only source of active truth; update in-place |
| **Structural Contract** | Stable normative contracts; update only on milestone boundary |
| **Reference** | Stable reference material; does not claim active state |
| **Worksheet** | Temporary session/plan docs; retire via `scripts/doc_lifecycle_stitch.sh` after completion |
| **Archive** | `docs/WORKBENCH_DOCS_ARCHIVE.md` — retired worksheets, append-only via stitch script |

### Retirement Policy

- Completed or superseded worksheets MUST be retired using `scripts/doc_lifecycle_stitch.sh`.
- The script appends to the archive, rewrites repo-wide references, deletes the original, and logs to the failure log.
- Canonical docs and structural contracts are protected — the script refuses to archive them.
- Do not create new authority docs. If a canonical doc is insufficient, update it in-place.

---

## 7. Non-Negotiable Constraints

- **Self-containment**: No runtime, test, or build dependency on external folders. Enforced by `scripts/self_containment_audit.py`.
- **Claim discipline**: No "fixed" / "restored" / "working" claims without branch, commit, and verification evidence. See `docs/AGENT_PROTOCOL.md` Section 8.
- **Drift guardrail**: Do not build M2 work on drifted verifier code or stale planning docs. See `AGENTS.md` § Drift Guardrail.

---

## 8. Structural Contract Pointers

- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` — canonical acceptance contract for XP-editor parity
- `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md` — non-regression contract for the PNG structural ingest path

---

## 9. Canonical Read Order

Agents must read in this order at session start:

1. `AGENTS.md` — startup guardrails
2. `docs/INDEX.md` — doc hub and navigation
3. `docs/AGENT_PROTOCOL.md` — behavioral rules
4. This doc — normative spec and policy
5. `PLAYWRIGHT_FAILURE_LOG.md` — reality log
6. `docs/plans/2026-03-23-m2-capability-canon-inventory.md` — capability canon
7. Task-specific reference docs as needed
