# Workbench Canonical Spec

**Authority:** This is one of the 3 canonical authority docs for this repo. See Section 5 below.

**Last updated:** 2026-03-23
**Branch:** master @ b5034b5

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
| **M2-B** | Source panel + grid assembly (draw box, find sprites, drag-to-grid) | M2-A | UNCOMMITTED — evidence exists from dirty worktree (10/10 PASS) but runner and product fixes not committed; requires independent verification |
| **M2-C** | Whole-sheet editor coverage (tools, layers, undo) | M2-A | NOT STARTED |
| **M2-D** | Full SAR workflow coverage (all remaining WIRED actions get verifier proof) | M2-B, M2-C | NOT STARTED |
| **M2-E** | Semantic editing (region-based dictionary-driven edits) | M2-D | NOT STARTED |
| **M2-F** | Analyze/auto-slice (assistive, not authoritative) | M2-D | NOT STARTED |

Execute in dependency order. M2-B and M2-C may run in parallel after M2-A.

---

## 3. Current Priority Stack

**Last reviewed:** 2026-03-23

1. **M2-B source panel assembly** — committed proof (`5c67ef2`), 10/10 PASS on committed code at both root and /xpedit. UI-driven actions with read-only diagnostic observation layer. Prerequisite for the PNG→source→grid→WS→export end-to-end workflow.
2. **M2-C whole-sheet editor verification** — tools are wired but unproven; parallel with M2-B
3. **PB-01/02/03 undo gaps** in source panel anchor ops — small fixes that affect M2-D completeness
4. **PB-06 SelectTool wiring** — blocked M2-C.2 feature, needed for whole-sheet editor parity

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
| `workbench_agents.mjs` (subagents) | DOM clicks + file inputs | `getState()` reads + request interception | Diagnostic / subagent coverage |
| `workbench_coverage_agent.mjs` | DOM clicks, drags, screenshots | Element probes via `evaluate()` | Diagnostic coverage |

**Standard for M2 UI acceptance (2026-03-23):**

1. **UI-driven actions are required.** Every user-facing workflow step (click button, drag on canvas, select file, switch tab) must be performed through the shipped DOM surface — not via `fetch()` or `page.evaluate(async => ...)` action calls.
2. **Read-only diagnostic observation is tolerated.** Using `getState()`, `readFrameCell()`, or `frameSignature()` to *verify* outcomes after a UI action is acceptable. The observation layer does not replace user actions — it confirms their effect.
3. **`fetch()` / API action driving is not acceptance for workflow slices** unless a live structural contract (e.g., `PNG_STRUCTURAL_BASELINE_CONTRACT.md`) explicitly defines that API-backed path for a narrow structural-safety purpose.

**Rule:** Only runners classified as "UI-driven" may produce evidence labeled as acceptance. Structural-contract runners prove API/gate contracts only. Mixed runners are M1 historical evidence — not pure UI-driven acceptance going forward.

---

## 5. Document Authority Model

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

## 6. Non-Negotiable Constraints

- **Self-containment**: No runtime, test, or build dependency on external folders. Enforced by `scripts/self_containment_audit.py`.
- **Claim discipline**: No "fixed" / "restored" / "working" claims without branch, commit, and verification evidence. See `docs/AGENT_PROTOCOL.md` Section 8.
- **Drift guardrail**: Do not build M2 work on drifted verifier code or stale planning docs. See `AGENTS.md` § Drift Guardrail.

---

## 7. Structural Contract Pointers

- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` — canonical acceptance contract for XP-editor parity
- `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md` — non-regression contract for the PNG structural ingest path

---

## 8. Canonical Read Order

Agents must read in this order at session start:

1. `AGENTS.md` — startup guardrails
2. `docs/INDEX.md` — doc hub and navigation
3. `docs/AGENT_PROTOCOL.md` — behavioral rules
4. This doc — normative spec and policy
5. `PLAYWRIGHT_FAILURE_LOG.md` — reality log
6. `docs/plans/2026-03-23-m2-capability-canon-inventory.md` — capability canon
7. Task-specific reference docs as needed
