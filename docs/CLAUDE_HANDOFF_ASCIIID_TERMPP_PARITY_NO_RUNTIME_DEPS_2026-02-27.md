# Claude Handoff: Recreate Native `asciiid` TERM++ Skin Behavior in Workbench (No Runtime Dependencies)

Date: 2026-02-27  
Owner: Claude research/implementation agent  
Repo: `/Users/r/Downloads/asciicker-pipeline-v2`  
Legacy reference repo: `/Users/r/Downloads/asciicker-Y9-2`

## Mission

Make Workbench reproduce the same stable TERM++ skin behavior seen in native `asciiid` (multiple movement inputs with no freeze, no fall-through/underwater regression), while removing runtime dependency drift.

Runtime requirement:
- Workbench must run from this repo only.
- No implicit runtime dependence on sibling checkout paths.
- Any required TERM++ runtime assets must be explicitly bundled and validated.

## Proven Baseline (Native Works)

Confirmed working native baseline:
- Binary: `/Users/r/Downloads/asciicker-Y9-2/.run/asciiid`
- Custom XP copied to:
  - `/Users/r/Downloads/asciicker-Y9-2/sprites/session-30004ae1-8c48-4778-b625-d78279c96363.xp`
- User report: TERM++ in `asciiid` handles multiple movements with no freeze and no underwater fall-through.

This is the parity target.

## Current Workbench Failure Envelope

Observed in Workbench variants:
1. `Webbuild loading...` loop (packaging/missing-flatmap issue)
2. Enters runtime, rotates fine, freezes on first movement
3. Historical window: brief success, then underwater/fall-through after first move

Known timeline anchors (UTC):
- `2026-02-26T09:18:04Z`: stuck loading again
- `2026-02-26T09:21:47Z`: works briefly then underwater
- `2026-02-26T09:36:47Z`: after first movement falls through
- `2026-02-26T09:59:32Z`: still same issue
- `2026-02-26T10:28:35Z`: spawnz experiment reverted

## Non-Negotiable Constraints

1. No hidden runtime path coupling.
- Workbench runtime must not silently depend on `/Users/r/Downloads/asciicker-Y9-2` at runtime.
- If bundle assets are missing, fail fast with explicit API/UI error.

2. Deterministic runtime bundle.
- A single versioned bundle root:
  - `runtime/termpp-skin-lab-static/`
- Bundle must include all required flatmaps and bootstrap scripts.

3. Reproducibility gates.
- Every launch must verify endpoint and asset readiness before user interaction.
- Every parity run must emit structured diagnostics for first-move path.

## Current Code/Dependency Map (Start Here)

### Workbench server and runtime serving
- `src/pipeline_v2/app.py`
  - `STATIC_WEB_ROOT = ROOT / "runtime" / "termpp-skin-lab-static"`
  - `/termpp-web/*`, `/termpp-web-flat/*` routes
  - `_runtime_unavailable_response(...)` returns 503 when bundle missing

### Workbench dock/injection flow
- `web/workbench.js`
  - `openWebbuild`
  - `prepareWebbuildForSkinApply`
  - `injectXpBytesIntoWebbuild`
  - `applyCurrentXpAsWebSkin`
  - `testCurrentSkinInDock`

### Flat runtime bootstrap behavior
- `web/termpp_flat_map_bootstrap.js`
  - map override logic for `/a3d/game_map_y8.a3d`
  - `StartGame` wrapper
  - `Load`/`Resize` wrappers
  - duplicate `StartGame` guard

### Bundle build path
- `scripts/build_termpp_skin_lab_static.sh`
  - requires explicit source web dir argument
  - writes into `runtime/termpp-skin-lab-static` by default
  - bundles maps into `termpp-web-flat/flatmaps/`

### Native behavior reference (legacy)
- `asciicker-Y9-2/asciiid.cpp`
  - sprite scan from `sprites/`
  - map load path behavior
- `asciicker-Y9-2/game_web.cpp`
  - web `Load`/map startup behavior

## What Is Missing Right Now

1. First-move diagnostics parity.
- No hard evidence yet whether freeze is:
  - JS exception loop
  - WASM stall
  - loading-gate deadlock
  - physics/collision readiness race

2. Frozen-state differential against native.
- Native is stable, web variant is not.
- No side-by-side trace contract exists for first 2 seconds after `PLAY`.

3. Bundle preflight enforcement.
- Packaging gaps were able to reach users (`flatmaps` missing) and masked root-cause signals.

## Required Research and Implementation Plan

## Phase 1: Lock Runtime Inputs (Dependency Hygiene)

1. Add hard preflight endpoint in app/service:
- Verify existence/hash of:
  - `runtime/termpp-skin-lab-static/termpp-web-flat/index.html`
  - `index.js`, `index.wasm`, `index.data`
  - required maps:
    - `flatmaps/minimal_2x2.a3d`
    - `flatmaps/game_map_y8_original_game_map.a3d` (or chosen canonical parity map)

2. Block Workbench skin test actions if preflight fails.
- Show explicit failure cause in `webbuildState`.

3. Emit runtime manifest at build time.
- Example: `runtime/termpp-skin-lab-static/manifest.json` with SHA256 and source metadata.

## Phase 2: Instrument First-Move Path (Web)

Instrument `web/termpp_flat_map_bootstrap.js` and/or `web/workbench.js` to record:
- `t_play_clicked`
- `t_first_movement_key`
- per-frame (first ~120 frames):
  - player `x,y,z` (if exposed)
  - grounded/water indicators (if exposed)
  - overlay/loading state
  - frame heartbeat

Persist artifact:
- `artifacts/ui-tests/.../first-move-diagnostic.json`

Classification output (required):
- `playable`
- `freeze_js_exception`
- `freeze_wasm_stall`
- `freeze_loading_gate`
- `fallthrough_or_underwater`

## Phase 3: Native-Web Parity Trace

Create a minimal parity harness:
1. Native run (`asciiid`/`game_term`) baseline trace.
2. Web run trace with same map and equivalent startup.
3. Compare first 2 seconds and first movement tick outcomes.

Goal:
- Identify first state divergence, not just final symptom.

## Phase 4: Reconstruct Transient Failure Window

Rebuild the exact `2026-02-26T09:18Z..10:28Z` state:
- Parse session JSON for file-edit operations during that interval.
- Recreate resulting `workbench.js` and `termpp_flat_map_bootstrap.js` in a synthetic branch.
- Run parity harness on that reconstructed state.

## Acceptance Criteria (Definition of Done)

1. Runtime dependency criterion:
- Workbench skin-test flow succeeds without runtime reads from sibling legacy repo paths.
- Missing bundle assets produce explicit preflight failure, never silent loading loops.

2. Behavior criterion:
- On canonical parity map and skin payload:
  - `10` consecutive runs
  - movement input accepted
  - no freeze
  - no underwater/fall-through

3. Evidence criterion:
- Artifacts include:
  - runtime manifest
  - preflight report
  - first-move diagnostics
  - native-vs-web divergence report

## Operator Commands (Reference)

Build bundle (explicit inputs):
```bash
./scripts/build_termpp_skin_lab_static.sh <SOURCE_WEB_DIR> runtime/termpp-skin-lab-static <SOURCE_A3D_DIR> <ORIGINAL_MAP_PATH>
```

Run app:
```bash
python3 -m src.pipeline_v2.app
```

Key readiness checks:
```bash
curl -I http://127.0.0.1:5071/workbench
curl -I http://127.0.0.1:5071/termpp-web-flat/index.html
curl -I http://127.0.0.1:5071/termpp-web-flat/flatmaps/minimal_2x2.a3d
```

## Deliverables Expected From Claude

1. `PARITY_RUNTIME_PRECHECK.md` with explicit pass/fail matrix
2. code changes implementing preflight + diagnostics + manifest
3. synthetic-branch reconstruction of `09:18Z..10:28Z` state
4. parity report proving stable first-move behavior in Workbench matching native baseline

## Notes

- Existing consolidated context:
  - `docs/CLAUDE_RESEARCH_DUMP_WORKBENCH_MOVE_FREEZE_2026-02-27.md`
  - `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`
  - `docs/WORKBENCH_FLAT_ARENA_WATER_LOADING_RESEARCH_HANDOFF.md`
- Keep logging append-only in the failure log after each experiment.
