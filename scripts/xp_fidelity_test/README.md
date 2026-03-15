# XP Fidelity Test

Hard-fail verifier for existing XP load/edit/export behavior in the shipped workbench.

This is not the deleted blank-flow `1,1,1` harness.

What it does:

- reads the source XP with `scripts/rex_mcp/xp_core.py`
- derives geometry from Layer 0 metadata (`angles`, `anims`, `projs`)
- generates a frame-aware layer-2 repaint recipe
- loads the XP into the workbench
- asserts that the live session geometry matches the XP contract
- executes only visible editor controls for layer-2 repaint
- exports the session XP
- compares the exported XP against the full original XP across metadata, layers, and cells

What it does not pretend:

- it does not make the shipped workbench user-reachable for existing-XP load
- the current setup still uses `/api/workbench/upload-xp` as scaffolding because the shipped UI has no workbench-side `.xp` import control
- that missing UI path is recorded as a hard failure in the report

Current intent:

- fail honestly on user-reachability, geometry, layer, export, and codec mismatches
- expose the real blockers without flattening geometry or skipping layers

Usage:

```bash
bash scripts/xp_fidelity_test/run.sh sprites/player-0100.xp --headed
```
