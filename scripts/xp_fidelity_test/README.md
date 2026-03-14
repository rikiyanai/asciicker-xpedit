# XP Fidelity Test — User-Action Conformance

Red/green gate for XP-editor functional parity work. The long-term milestone is
that the shipped workbench can recreate XP files through real user-reachable
editing actions to the level of the targeted REXPaint capability surface.

This harness is the proof mechanism for that milestone:

- oracle XP -> truth table
- recipe derived from the oracle
- execute the recipe only through reachable UI
- export
- compare against the oracle

The current harness does **not** prove the whole milestone by itself. It proves
one current slice of it.

## Contract

- **Oracle**: Python reads source XP into truth table (exact cell values)
- **Executor**: clears and repaints the editable layer using only visible DOM controls
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

**Current harness slice:** blank-flow single-frame only. The current runner
creates a blank XP via `New XP`, and the audited recipe/executor assume
geometry `1,1,1`. Multi-frame and metadata-driven load geometry are still out
of scope for this harness version.

**Not the full milestone.** A pass here shows that one narrow workbench path
can reconstruct and export an XP through user-reachable actions. It does **not**
by itself prove:

- full REXPaint-capable editor parity
- metadata-driven multi-frame/multi-angle geometry correctness
- the broader editor feature surface
- the later UX/UI parity phase

**Milestone ordering matters.** Functional parity comes before UX/UI redesign.
The editor should not be treated as UX-complete just because this harness
passes.

## Architecture

```
truth_table.py → recipe_generator.py → run_fidelity_test.mjs
   (oracle)        (UI actions)         (preflight + execute + verify)
```

## Usage

```bash
# Start server
PYTHONPATH=src python3 -m pipeline_v2.app &

# Run with fixture (15 cells, fast)
scripts/xp_fidelity_test/run.sh sprites/fidelity-test-5x3.xp --headed

# Then run with native game sprite
scripts/xp_fidelity_test/run.sh sprites/player-0000.xp --headed
```

## Output

`output/xp-fidelity-test/fidelity-<timestamp>/result.json`

Contains: verdict, failure classes, preflight results, comparison stats, first mismatches.
