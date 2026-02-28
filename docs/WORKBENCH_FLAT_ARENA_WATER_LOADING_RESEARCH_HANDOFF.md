# Workbench Flat Arena Water/Loading Research Handoff

## Scope

Investigate an intermittent/manual-repro bug in the Workbench flat test dock where:

1. `Test This Skin` can enter the in-game view, then get stuck showing large `LOADING`.
2. In other runs, the game appears stable briefly, but after the first movement input the player falls/teleports underwater.

This is a research/debug handoff (not a feature implementation handoff).

## Current State (Important)

- Temporary `spawnz=757` experiment changes were **reverted** from:
  - `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js`
  - `/Users/r/Downloads/asciicker-pipeline-v2/web/termpp_flat_map_bootstrap.js`
- Temporary copied map alias was removed:
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/termpp-skin-lab-static/termpp-web-flat/flatmaps/game_map_y8_spawn757_test.a3d`
- Broader dock reliability fixes remain in place (manual `PLAY` flow, deterministic restart, load wrappers, etc.).

## Repro (Manual)

1. Open `/workbench`
2. Upload PNG
3. `Analyze`
4. `Convert to XP`
5. `Test This Skin`
6. Click `PLAY` in the iframe overlay
7. Press movement key once (`W`)

Observed by user:
- loading progress can hit 100, reset to 0, then remain stuck on loading
- or the player falls/teleports underwater after first movement

## Failure Stages (Do Not Conflate)

There are multiple distinct failure stages:

1. Dock-level webbuild load (`Webbuild loading...`)
2. Iframe login overlay (`PLAY` / `LOADING...`)
3. In-game startup loading (world visible + large `LOADING`)
4. Post-start physics issue (first move -> fall/underwater)

The current unresolved issue is mainly stages `3` and `4`.

## What Is Already Fixed / Verified

These are working and should not be the first focus:

- Workbench dock restart/injection path
- Manual `PLAY` flow (dock no longer auto-enters game)
- Headed Playwright PNG->Analyze->Convert->Test-Skin runs often reach playable state
- Map swap to `game_map_y8.a3d` is playable in headed automation, so map choice alone is not a universal cause

## Key Evidence / Artifacts

### Successful headed PNG->Skin runs (manual `PLAY` dock flow)

- `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-26T09-23-27-610Z/result.json`
- `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-26T09-50-57-194Z/result.json`

### Map swap experiment (`game_map_y8.a3d` playable in headed automation)

- `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-26T08-13-18-660Z/result.json`

### Full composite framework run

- `/Users/r/Downloads/asciicker-pipeline-v2/artifacts/ui-tests/test-e2e-2026-02-26T07-47-10-118Z/summary.json`

## Failed / Inconclusive Experiments (Avoid Repeating Blindly)

### JS spawn-Z override (`spawnz=757`)

We attempted a temporary flat-runtime hook to force player `z=757` after `PLAY`.

Findings:
- `window.ak.getPos/setPos` wrappers in the web runtime depend on `Module.HEAPF32/HEAP32`, which may not be initialized by default in this build.
- External JS calls to `ak.getPos/setPos` often throw unless those heap views are synthesized.
- `ak.onFrame` callback registration from external JS appeared unreliable for this purpose.
- Hook timing could itself interfere with startup/loading behavior.

Conclusion:
- Not a reliable root-cause proof path.
- Reverted.

### Copied map alias + forced spawn altitude

- Produced ambiguous results due interaction with startup timing.
- Reverted.

## Suspected Root Cause Areas (Research Targets)

### A. Physics/collision readiness race after `StartGame`

Symptoms strongly suggest a race between:
- world/map load completion
- collision/terrain readiness
- player spawn/grounding state
- first movement/physics tick

### B. Water/ground height mismatch in web build vs native

Need a same-map/same-start comparison between native and web for the first seconds after spawn.

### C. Web-only startup ordering differences

Focus on the interaction/order of:
- `Load(...)`
- `Resize(...)`
- `AsciickerLoop`
- any delayed initialization steps in the web runtime

## Code Pointers (Start Here)

### Workbench-side dock/injection (pipeline repo)

- `/Users/r/Downloads/asciicker-pipeline-v2/web/workbench.js`
  - `testCurrentSkinInDock`
  - `applyCurrentXpAsWebSkin`
  - `prepareWebbuildForSkinApply`
  - `injectXpBytesIntoWebbuild`

### Flat runtime bootstrap wrapper (pipeline repo)

- `/Users/r/Downloads/asciicker-pipeline-v2/web/termpp_flat_map_bootstrap.js`
  - `StartGame` wrapper
  - `Load` wrapper
  - `Resize` wrapper
  - flat-map FS replacement

### Engine/runtime source (legacy repo)

- `/Users/r/Downloads/asciicker-Y9-2/game_app.cpp`
- `/Users/r/Downloads/asciicker-Y9-2/game_api.cpp`
- `/Users/r/Downloads/asciicker-Y9-2/README.md`

Also useful:
- `/Users/r/Downloads/asciicker-Y9-2/debug_a3d_reader.py`
  - terrain/material patch structure inspection
  - not a spawn-Z patcher

## Recommended Research Tasks (Ordered)

1. Instrument first ~2 seconds after `PLAY` in the web runtime:
   - player pos (`x,y,z`)
   - grounded state
   - water state/level (if exposed)
   - any world/collision ready flags
   - loading state transitions

2. Compare native vs web on the same map and startup sequence:
   - confirm if native shows any transient invalid ground/collision window
   - isolate web-only ordering differences if native is stable

3. Trace first movement processing path:
   - determine whether movement/physics is applied before collision/world is fully ready

4. Audit startup `Resize()` side effects:
   - zero-size `Resize` calls were observed previously
   - confirm whether resize can invalidate/reset early world/player state

5. If needed, add a temporary engine-side diagnostic gate:
   - block movement until world/collision ready
   - use only as proof-of-cause, not final UX behavior

## Test Framework Gap (Useful Extension)

The current Workbench 4-layer tests distinguish dock/login/playability stages, but not the post-`PLAY` gameplay-state failures.

Recommended new watchdog classification:
- `in_game_loading_hang`
- `first_move_fallthrough_or_underwater`

## Environment Notes

- Workbench server runs from pipeline repo via:
  - `PYTHONPATH=src python3 -m pipeline_v2.app`
- `scripts/conductor_tools.py` is not present in this checkout (Conductor status preflight fails here)

