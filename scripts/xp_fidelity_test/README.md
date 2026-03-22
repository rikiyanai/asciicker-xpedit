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

### What it tests

- Bundle readiness gating honesty at partial states (0/3, after 1 save)
- `Test This Skin` blocked state honesty — no silent freeze at invalid states
- Action-tab session hydration with exact geometry verification per action
- Session ID stability (same action = same session) and uniqueness (different actions = different sessions)
- Whole-sheet editor mounting after tab switches

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
# All edge-case recipes
bash scripts/xp_fidelity_test/run_edge_workflow.sh --headed

# Specific recipe
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe partial_bundle_gating --headed
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe action_tab_hydration

# Custom URL
bash scripts/xp_fidelity_test/run_edge_workflow.sh --url http://localhost:5071/workbench
```

### Report shape

The `edge-workflow-result.json` includes:

- `workflow_type: "edge_workflow"`
- `overall_pass`
- `recipes[]`: per-recipe results with step-by-step pre/post state snapshots and assertion results

### State snapshot fields

Each step records pre/post state including:
- `templateSetKey`, `bundleId`, `activeActionKey`, `sessionId`, `actionStates`
- `bundleStatus`, `wbStatus`, `webbuildState` (DOM text)
- `geometry` (gridCols, gridRows, frameWChars, frameHChars, angles, anims, projs)
- `buttons` (save, exportXp, newXp, testThisSkin — exists + disabled + text)
- `wholeSheetMounted`
