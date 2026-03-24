# Claude Memory

Use this file as short-lived repo memory, not as proof over code.

## Startup

- Run `python3 scripts/conductor_tools.py status --auto-setup` first.
- Then run `python3 scripts/self_containment_audit.py`.
- Then read `docs/INDEX.md` and `docs/AGENT_PROTOCOL.md`.
- Then read `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`.

## Document Authority Model

This repo uses a 3-doc canonical authority model:

1. `PLAYWRIGHT_FAILURE_LOG.md` — reality/failure/proof log
2. `docs/plans/2026-03-23-workbench-canonical-spec.md` — normative requirements / roadmap / bug-priority / policy
3. `docs/plans/2026-03-23-m2-capability-canon-inventory.md` — capability inventory / SAR canon

All other docs are worksheets or reference. Worksheets must be retired after completion via `scripts/doc_lifecycle_stitch.sh`. See `AGENTS.md` § Document Authority Model for the full policy.

## Milestone Requirements

Treat these as the explicit repo baselines.

### Milestone 1 Pass

Milestone 1 passes only when:

- the canonical root-hosted workbench passes the `full_recreation` verifier lane for the bundle-native workflow
- the edge-case workflow verifier passes for the defined bundle/session/gating/hydration flows
- acceptance evidence comes from user-reachable actions only
- the full save/export/test loop works
- the full bundle works in Skin Dock/runtime
- base-path verification shows no `/xpedit`-specific regressions
- any residual failures are explicitly classified as verifier artifacts or accepted non-blocking residuals

Short version:

- M1 pass = full-recreation passes + edge-case passes + user-reachable acceptance path + full bundle works in Skin Dock/runtime + no unresolved prefix-only regressions

### Milestone 2 Pass

Milestone 2 passes only when the verifier and product cover the entire shipped workbench for PNG ingest/manual assembly, not just the whole-sheet XP editor.

- all user-reachable actions are mapped in a canonical SAR table
- that includes normal controls, mode switches, source-panel actions, grid actions, whole-sheet actions, runtime actions, and context-menu actions
- the SAR model defines starting state, allowed actions, required responses/invariants, and valid next states for each workflow family
- the verifier executes predefined contract-driven workflow sequences representing what the shipped workbench must be able to do
- those sequences produce structured evidence similar in spirit to M1's truth-table -> recipe -> run flow, but driven by workflow-state correctness rather than only XP-cell fidelity
- acceptance-critical M2 lanes pass on both root-hosted and prefixed/base-path hosting without errors

Short version:

- M2 pass = the entire workbench is covered by a canonical SAR/action-response model and the verifier can execute the required workflow sequences successfully on both root-hosted and base-path hosting

### Drift Guardrail

- Do not continue M2 implementation on top of drifted verifier code or stale planning docs.
- `feat/base-path-support` was fully merged into `master` at `e895298` and retired on 2026-03-23. All base-path work now lives on `master`.

## Current Milestone

- Milestone 1 is closed on canonical root-hosted `master` as of 2026-03-23.
- The current priority is Milestone 2 verifier architecture and practical PNG ingest/manual assembly on top of the closed M1 baseline.
- The whole-sheet editor remains the primary correction surface, but M2 verification scope is the entire shipped workbench, not just the editor.

## Acceptance vs Diagnostic Boundary (MANDATORY)

- **Acceptance evidence** = user-reachable actions through the shipped UI surface ONLY (button clicks, canvas drags, file inputs, DOM interactions).
- **Diagnostic evidence** = `fetch()` API calls, `page.evaluate()` state reads, `window.__wb_debug` methods, ad hoc scripts.
- **Structural contract evidence** = API-backed path explicitly permitted by a structural contract doc (e.g., `PNG_STRUCTURAL_BASELINE_CONTRACT.md`).
- Runners that use `fetch()` or `page.evaluate(async => fetch(...))` are NEVER acceptance-grade. They are structural-contract or diagnostic.
- If the verifier cannot express a UI workflow, that is a verifier gap — fix the verifier, do not bypass it with API calls.
- Citations: AGENTS.md:29,46; AGENT_PROTOCOL.md:305-354; workbench-canonical-spec.md:67-74.

## Current High-Signal Truths

- `PLAYWRIGHT_FAILURE_LOG.md` is the current log of record for M1 closeout and verifier fixes.
- M1 edge-workflow closeout on `master` includes `partial_bundle_gating`, `action_tab_hydration`, and generated SAR seed passes.
- Base-path verification found no `/xpedit`-specific regressions for the M1 edge-workflow lane.
- M2-A structural PNG baseline: **structural-contract proof only** (API-driven, not UI-driven). Valid per `PNG_STRUCTURAL_BASELINE_CONTRACT.md`. Does NOT prove the bundle UI workflow. See PLAYWRIGHT_FAILURE_LOG.md process failure entry.
- M2-B source-panel workflow: **committed proof** at `5c67ef2`. 10/10 PASS on both hosting modes on committed code. UI-driven actions with read-only diagnostic observation layer. PB-02 + Delete Box UX fixed.
- `window.__wb_debug.getState()` is the preferred verifier state surface; `_state()` fallback should be treated as a temporary exception, not the long-term contract.
- Any doc still referencing `feat/base-path-support` as a live branch is stale — that branch was merged and retired on 2026-03-23.

## Do Not Assume

- Do not assume old plan status text is current.
- Do not claim M2 verifier foundation is unified unless the shared library, runners, and docs actually agree.
- Do not call any lane acceptance-grade unless it uses user-reachable actions and the contract explicitly allows that lane as acceptance evidence.
- Do not reference sibling repos or external absolute paths for runtime/build/test fixes; self-containment is enforced by `scripts/self_containment_audit.py`.

## First Reads By Topic

- XP editor acceptance contract: `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- PNG structural baseline contract: `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md`
- M2 practical plan: `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`
- M2 verifier design: `docs/plans/2026-03-21-milestone-2-png-verifier-design.md`
- Workbench SAR model: `docs/WORKBENCH_DOCS_ARCHIVE.md#2026-03-22-workbench-verifier-sar-model`
- Unified SAR blueprint: `docs/plans/2026-03-22-workbench-sar-table-blueprint.md`
- Failure log / M1 closeout: `PLAYWRIGHT_FAILURE_LOG.md`
