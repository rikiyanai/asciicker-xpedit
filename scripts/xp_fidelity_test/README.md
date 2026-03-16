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
