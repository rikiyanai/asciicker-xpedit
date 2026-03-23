# XP Fidelity Test

Hard-fail verifier for XP load/edit/export behavior in the shipped workbench.

Governed by: `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`

## Two Modes

### Acceptance mode (`--mode acceptance`)

Uses only user-reachable whole-sheet editor controls (`#wholeSheetCanvas`,
`#wsGlyphCode`, `#wsFgColor`, `#wsBgColor`, `#wsToolCell`, etc.).
Inspector-only and debug-only actions are refused by the test runner.

**Only this mode produces acceptance-eligible evidence.**

### Diagnostic mode (`--mode diagnostic`, default)

Uses the legacy inspector path (frame dblclick → `#cellInspectorPanel` →
inspector controls). Useful for implementation debugging but results
must be labeled diagnostic, not acceptance.

## What it does

- reads the source XP with `scripts/rex_mcp/xp_core.py`
- derives geometry from Layer 0 metadata (`angles`, `anims`, `projs`)
- generates a mode-appropriate repaint recipe
- loads the XP into the workbench via `/api/workbench/upload-xp` (scaffolding)
- asserts that the live session geometry matches the XP contract
- executes only the recipe's allowed actions
- exports the session XP
- compares the exported XP against the full original XP across metadata, layers, and cells

## What it does not pretend

- it does not make the shipped workbench user-reachable for existing-XP load
  (the API upload scaffolding is recorded as a hard failure in the report)
- diagnostic mode results are NOT acceptance evidence
- ad hoc scripts outside this verifier are NOT acceptance evidence

## Usage

```bash
# Acceptance mode (whole-sheet editor)
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --mode acceptance --headed

# Diagnostic mode (inspector, default)
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --headed

# Diagnostic mode (explicit)
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --mode diagnostic --headed
```

## Report shape

The result.json includes these contract-required fields:

- `mode` — acceptance or diagnostic
- `user_reachable_load_pass`
- `geometry_pass`
- `frame_layout_pass`
- `all_layers_pass`
- `execute_pass`
- `cell_fidelity_pass`
- `export_pass`
- `skin_dock_pass`
- `overall_pass`

`overall_pass` is true only if all failures list is empty.

## Protocol

See `docs/AGENT_PROTOCOL.md` Section 13 and
`docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` Verification Evidence Protocol.

## Edge-Case Workflow Verifier

Tests workflow state transitions and gating honesty. Does not replace
`full_recreation` or bundle fidelity testing.

Two modes:

- **v1 deterministic recipes**: named recipes for known blocker classes
- **v2 generated SAR sequences**: bounded randomized action chains for irrational
  but user-reachable flows (new_xp, layer switches, refresh recovery, tab cycling,
  repeated save/export, mixed partial-bundle actions)

### What it tests

**Deterministic recipes (v1):**

- Bundle readiness gating honesty at partial states (0/3, after 1 save)
- `Test This Skin` blocked state honesty — no silent freeze at invalid states
- Action-tab session hydration with exact geometry verification per action
- Session ID stability (same action = same session) and uniqueness (different actions = different sessions)
- Whole-sheet editor mounting after tab switches

**Generated SAR sequences (v2):**

- Bounded random action sequences from a 10-action vocabulary
- Precondition-gated: only legal actions chosen per simulated state
- Seedable and deterministic: `--seed <n>` reproduces the exact sequence
- Per-step SAR assertions derived from the workbench state model
- Covers: tab switching, layer switching, new_xp, save/export on blank,
  refresh recovery (with re-apply), test_this_skin gating
- Undo/redo in vocabulary but only eligible when history exists (requires
  cell editing actions not yet in the generated vocabulary)

### Geometry oracle

Expected geometry per action is derived from `config/template_registry.json`
(`player_native_full` template set — Milestone 1 bundle-native actions only):

| Action | gridCols | gridRows | angles | anims | frameWChars | frameHChars |
|--------|----------|----------|--------|-------|-------------|-------------|
| idle | 126 | 80 | 8 | [1, 8] | 7 | 10 |
| attack | 144 | 80 | 8 | [8] | 9 | 10 |
| death | 110 | 88 | 8 | [5] | 11 | 11 |

### Usage

```bash
# All recipes (deterministic + generated)
bash scripts/xp_fidelity_test/run_edge_workflow.sh --headed

# Deterministic recipes only
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe partial_bundle_gating --headed
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe action_tab_hydration

# Generated SAR sequences only (default: 3 seeds, 6 steps each)
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe generated_sar_sequences

# Generated with specific seed (reproducible)
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe generated_sar_sequences --seed 42

# Generated with custom count and length
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe generated_sar_sequences --gen-count 5 --gen-length 8

# Custom URL (for base-path testing when PIPELINE_BASE_PATH support lands)
bash scripts/xp_fidelity_test/run_edge_workflow.sh --url http://127.0.0.1:5073/xpedit/workbench
WORKBENCH_URL=http://127.0.0.1:5073/xpedit/workbench bash scripts/xp_fidelity_test/run_edge_workflow.sh
```

### Generated SAR artifacts

Each generated seed emits two files to the output directory:

- `generated-sar-seed<N>-recipe.json` — the generated sequence (seed, steps, preconditions, expected assertions). Written BEFORE execution for reproducibility.
- `generated-sar-seed<N>-result.json` — execution result with pre/post state snapshots and assertion pass/fail per step.

### Base-path compatibility

The generated edge-workflow verifier appears base-path-ready in its current URL
handling and DOM-driven action path; full proof still requires rerunning against
a real prefixed deployment.

As of 2026-03-22, `PIPELINE_BASE_PATH` support is not yet implemented in the
product server. CP3 validates verifier readiness only — prefixed-product behavior
cannot be tested until the product serves a base-path workbench. When it does,
the same seeds can be re-run with `--url` pointing at the prefixed URL.

### Report shape

The `edge-workflow-result.json` includes:

- `workflow_type: "edge_workflow"`
- `overall_pass`
- `recipes[]`: per-recipe results with step-by-step pre/post state snapshots and assertion results

### State snapshot fields

Each step records pre/post state including:
- `templateSetKey`, `bundleId`, `activeActionKey`, `sessionId`, `actionStates`
- `bundleStatus`, `wbStatus`, `webbuildState` (DOM text)
- `historyDepth`, `futureDepth` (undo/redo stack sizes)
- `activeLayer`, `sessionDirty`
- `geometry` (gridCols, gridRows, frameWChars, frameHChars, angles, anims, projs)
- `buttons` (save, exportXp, newXp, testThisSkin — exists + disabled + text)
- `wholeSheetMounted`
