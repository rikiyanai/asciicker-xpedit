# Agent Entry Point
Follow this repository rule before doing any task.

<!-- codex-conductor:start -->
## Conductor Guardrail
Always run `conductor:status` first.

- Command alias: `conductor_status`
- Direct command: `python3 scripts/conductor_tools.py status --auto-setup`
- Behavior: if Conductor is missing, status runs setup and creates the baseline.

## Self-Containment Guardrail
Always run the self-containment audit immediately after conductor status.

- Direct command: `python3 scripts/self_containment_audit.py`
- Install hooks: `bash scripts/install_self_containment_hooks.sh`
- Hard rule: this repo must not reference, symlink, or depend on folders outside `/Users/r/Downloads/asciicker-pipeline-v2` for live code, runtime, tests, or build steps.

## Milestone Requirements

Treat these as audit baselines, not optional guidance.

### Milestone 1 Pass

Milestone 1 passes only when all of the following are true:

- the canonical root-hosted workbench passes the `full_recreation` verifier lane for the Milestone 1 bundle-native workflow
- the edge-case workflow verifier passes for the defined bundle/session/gating/hydration flows
- acceptance evidence comes from user-reachable actions only
- the save/export/test loop works for the full bundle workflow
- the resulting full bundle works in Skin Dock/runtime
- base-path verification shows no `/xpedit`-specific regressions relative to root-hosted behavior
- any remaining issues are explicitly classified as verifier-only artifacts or accepted non-blocking residuals

Short version:

- M1 pass = full-recreation passes + edge-case passes + user-reachable acceptance path + full bundle works in Skin Dock/runtime + no unresolved prefix-only regressions

### Milestone 2 Pass

Milestone 2 passes only when the verifier and product cover the full shipped workbench for practical PNG ingest/manual assembly, not just the whole-sheet XP editor.

- the verifier models the entire workbench in a canonical SAR table
- all user-reachable actions are inventoried, including buttons, mode switches, source-panel actions, grid actions, whole-sheet actions, runtime actions, and context-menu actions
- for each workflow family, the SAR model defines starting state, allowed actions, required responses/invariants, and valid next states
- the verifier executes predefined contract-driven workflow sequences that represent what the shipped workbench must be able to do
- those sequences produce structured evidence analogous to M1's truth-table -> recipe -> run model, but adapted for PNG/manual-assembly workflows where correctness is workflow-state-driven
- acceptance-critical M2 lanes pass without errors for both root-hosted and prefixed/base-path hosting
- diagnostic-only lanes remain clearly labeled as diagnostic-only

Short version:

- M2 pass = the entire workbench is covered by a canonical SAR/action-response model, all user-reachable flows are mapped, expected workflow sequences are explicitly defined, and the verifier can execute those sequences and pass on both root-hosted and base-path hosting without errors

### Drift Guardrail

- Do not build new M2 work on top of drifted verifier code or stale planning docs.
- If `master` and `feat/base-path-support` disagree on verifier semantics, treat that as a blocker and reconcile it before adding new slices.
<!-- codex-conductor:end -->
