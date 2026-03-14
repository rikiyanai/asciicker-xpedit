# XP Fidelity Test — User-Action Conformance

Red/green gate for workbench XP editing. Tests whether the UI can recreate
XP cell data through real user-reachable actions only.

## Contract

- **Oracle**: Python reads source XP into truth table (exact cell values)
- **Executor**: tries to reproduce layer 2 using only visible DOM controls
- **Verifier**: clicks Export XP, compares exported XP against oracle

### User-reachable means

- Visible DOM controls: clicks, typing, color pickers
- Normal export flow: Export XP button
- NO `window.__wb_debug`
- NO direct JS state mutation
- NO hidden inputs

### Failure classes

| Class | Meaning |
|-------|---------|
| `ui_missing` | Required DOM control does not exist |
| `ui_blocked` | Control exists but can't complete action |
| `ui_behavior_mismatch` | Action works but cell data is wrong |
| `export_missing` | No normal export path |
| `xp_mismatch` | Export succeeds but doesn't match oracle |

## Scope

**Single-frame only.** This harness uses the `upload-xp` API which creates
sessions with geometry `1,1,1` (entire grid = 1 frame). Multi-frame sessions
are out of scope. See the plan doc for details.

**Upload-session defaults.** The upload path sets fixed metadata defaults
(`cell_w_chars=12`, `cell_h_chars=12`, `family="uploaded"`) — these are not
derived from the uploaded XP file. See `service.py:workbench_upload_xp()`.

## Architecture

```
truth_table.py → recipe_generator.py → run_fidelity_test.mjs
   (oracle)        (UI actions)         (preflight + execute + verify)
```

## Usage

```bash
# Start server
PYTHONPATH=src python3 -m pipeline_v2.app &

# Run with native game sprite (recommended first test)
scripts/xp_fidelity_test/run.sh sprites/player-0000.xp --headed

# Run with fixture (15 cells, fast)
scripts/xp_fidelity_test/run.sh sprites/fidelity-test-5x3.xp --headed
```

## Output

`output/xp-fidelity-test/fidelity-<timestamp>/result.json`

Contains: verdict, failure classes, preflight results, comparison stats, first mismatches.
