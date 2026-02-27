# Design: TERM++ Web/Native Startup Parity Fix

Date: 2026-02-26
Status: Approved
Approach: Instrument-then-fix (Phase A) + Native startup parity (Phase C)
Scope: Research and planning only — no code changes in this document

## Problem Statement

Workbench TERM++ skin preview freezes on first movement or falls underwater/through terrain.
Native `asciiid` handles the same XP skin perfectly with stable multi-directional movement.

The XP file at `/Users/r/Downloads/asciicker-Y9-2/sprites/session-30004ae1-8c48-4778-b625-d78279c96363.xp`
works in native but triggers freeze/underwater in web.

## Research Sources

- Native startup analysis: `/tmp/claude-explore-native-startup.md`
- Web bootstrap analysis: `/tmp/claude-explore-web-bootstrap.md`
- Failure log: `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`
- Research dump: `docs/CLAUDE_RESEARCH_DUMP_WORKBENCH_MOVE_FREEZE_2026-02-27.md`
- Parity handoff: `docs/CLAUDE_HANDOFF_ASCIIID_TERMPP_PARITY_NO_RUNTIME_DEPS_2026-02-27.md`

## Phase 1: Runtime Preflight

### Endpoint

New route: `GET /api/workbench/runtime-preflight`

Returns JSON:
```json
{
  "ok": true|false,
  "missing": ["termpp-web-flat/index.wasm", ...],
  "checked": ["termpp-web-flat/index.html", ...]
}
```

### Required files

- `termpp-web-flat/index.html`
- `termpp-web-flat/index.js`
- `termpp-web-flat/index.wasm`
- `termpp-web-flat/index.data`
- `termpp-web-flat/flat_map_bootstrap.js`
- At least one of:
  - `termpp-web-flat/flatmaps/minimal_2x2.a3d`
  - `termpp-web-flat/flatmaps/game_map_y8_original_game_map.a3d`

### Workbench UI

- Warning banner (yellow/orange) at top when preflight fails.
- Skin test dock buttons disabled with tooltip showing exact missing file(s).
- Other workbench features remain functional.
- Preflight checked on page load and before `applyCurrentXpAsWebSkin()` / `testCurrentSkinInDock()`.

### Files to modify

- `src/pipeline_v2/app.py` — add preflight endpoint
- `web/workbench.js` — fetch preflight on init, gate skin test buttons
- `web/workbench.html` — add banner container

## Phase 2: First-Move Diagnostic Trace

### Location

`web/termpp_flat_map_bootstrap.js` — new function `startDiagnosticTrace()` called from StartGame wrapper after `scheduleAutoNewGameAdvance()`.

### Trace output

Structured console.log every ~100ms for 5 seconds post-StartGame:

```
[flat-map-bootstrap] [TRACE] frame=12 t=1234 pos=[100,15,200] grounded=true water=0 menu=false world_ready=true stage=82
```

### Classification

Emitted once at end of 5-second window:

```
[flat-map-bootstrap] [CLASSIFY] result=playable frames=47 first_move_at=2100ms pos_changed=true water_detected=false grounded_always=true
```

Classification categories:
- `playable` — world_ready=true, grounded at least once, position changed, no water
- `freeze_no_frames` — render_stage never advanced past initial value
- `underwater` — water > 0 within first 3 seconds
- `falling` — grounded never true, Z decreasing
- `stuck_menu` — main_menu active after 5 seconds despite Enter pulses
- `freeze_world_never_ready` — GameWorldReady() never true within 10 seconds

### Files to modify

- `web/termpp_flat_map_bootstrap.js` — add `startDiagnosticTrace()` and classification logic

## Fix Plan: Hypotheses and Assumptions

### H1 (Primary): Auto-Menu Enter Pulses Fire Before Physics Ready

**Evidence:**
- Native: `Load()` → `Main()` → `CreateGame()` all synchronous. Main menu blocks input until user action. `InitGame()` spawns player after world/collision fully loaded.
- Web: `StartGame` wrapper calls `original.StartGame()` without awaiting, then immediately schedules `scheduleAutoNewGameAdvance()`. First Enter pulse at ~500ms.
- Native has no explicit world-readiness gate — relies on main_menu layer consuming input. Web auto-menu bypasses this.

**Assumption:** Enter pulse advances past main menu before `RebuildWorld()` / BSP construction finishes → player spawns into world with no collision mesh → immediate fall-through or water entry.

**Fix direction:**
1. `scheduleAutoNewGameAdvance()`: wait for `GameWorldReady() === true` before first Enter pulse.
2. Await `original.StartGame()` in wrapper if it returns a Promise.

### H2 (Secondary): Load Wrapper Async Gap

**Evidence:**
- When `appliedStamp === 0`, Load wrapper calls `applyFlatMapOverride()` async, returns immediately, calls `originalLoad()` in `.finally()`.
- Game's internal `Load()` may read original bundled map instead of flat arena map.

**Assumption:** If game reads wrong map, spawn position/terrain differ → underwater spawn.

**Fix direction:**
- StartGame wrapper already awaits `applyFlatMapOverride()` before `original.StartGame()`, handling the normal path. Load wrapper gap only matters if `Load()` called directly before `StartGame`. Validate via diagnostic trace.

### H3 (Tertiary): Focus Theft Causes Keyb Event Loss

**Evidence:**
- Deferred start calls `webbuildFrame.focus()` twice.
- Prior investigation marked "mostly ruled out" — user can move briefly in failing repros.

**Assumption:** Contributing factor for stuck keys, not primary cause. Trace will show whether Keyb events are received.

**Fix direction:** No change — focus calls necessary for iframe keyboard events. Real issue is upstream timing.

## Native Startup Parity Plan

### Native Ordering (Reference)

```
1. Load(playerName)               [sync]
2.   Main()                       [sync]
3.     InitMaterials()            [sync, fast]
4.     LoadSprites()              [sync, scans sprites/]
5.     CreateGame()               [sync]
6.       ReadConf()               [sync]
7.       game != nullptr          [input gate opens]
8.       main_menu = true         [input consumed by menu layer]
9. [FRAME LOOP via emscripten_set_main_loop]
10. User presses Enter →
11.   Game reads .a3d             [sync from FS]
12.   RebuildWorld(world, true)   [sync BSP build]
13.   InitGame()                  [sync player spawn]
14.   main_menu = false           [gameplay input enabled]
15. [WORLD FULLY READY]
```

Steps 11-14 are synchronous and sequential. Game never accepts gameplay input until world is fully initialized.

### Current Web Ordering (Problematic)

```
1. iframe loads WASM              [async, 30-120s]
2. detectWebbuildReady() polls    [500ms intervals]
3. cwraps available
4. bootstrap wrappers installed   [100ms polling]
5. XP bytes injected to FS        [sync]
6. StartGame wrapper:
7.   await applyFlatMapOverride() [async: fetch + FS write]
8.   original.StartGame()         [NOT AWAITED]
9.   scheduleAutoNewGameAdvance() [IMMEDIATE]
10.  +500ms: first Enter pulse    [BEFORE WORLD READY?]
```

**Divergence:** Step 8 doesn't await; step 9 fires immediately. In native, the user's Enter (step 10) only happens after C++ has loaded the map synchronously.

### Proposed Parity Changes

**Change 1: Gate auto-menu on world readiness**

In `scheduleAutoNewGameAdvance()`, before first Enter pulse, poll `menuProbe()` and require `world_ready === true` (i.e., `GameWorldReady()` returns true).

```
Current:  overlay hidden → send Enter pulse
Proposed: overlay hidden → wait for world_ready → send Enter pulse
```

**Change 2: Await original.StartGame() if thenable**

```javascript
// Current:
var ret = original.apply(this, arguments);
scheduleAutoNewGameAdvance();

// Proposed:
var ret = original.apply(this, arguments);
if (ret && typeof ret.then === 'function') await ret;
scheduleAutoNewGameAdvance();
```

**Change 3: World-ready fallback timeout**

If `GameWorldReady()` never true within 10s, emit `freeze_world_never_ready` classification and stop auto-menu loop.

**Change 4: Validate Load wrapper path**

Add console.log in Load wrapper's `appliedStamp === 0` branch. If diagnostic trace shows it never fires, async gap is not contributing.

### Not Changed

- No C++ / WASM changes
- No iframe focus handling changes
- No XP injection path changes
- No flat map override logic changes (just timing of when auto-menu fires after it)

## Acceptance Criteria

1. Runtime preflight endpoint returns accurate pass/fail for bundle completeness.
2. Warning banner + dock disable shown when bundle incomplete.
3. Diagnostic trace console output captures first 5s post-StartGame with classification.
4. After parity changes: 10 consecutive runs with movement input accepted, no freeze, no underwater/fall-through on canonical parity map and skin payload.

## Key File Reference

| File | Role |
|------|------|
| `src/pipeline_v2/app.py` | Flask routes, static serving, preflight endpoint |
| `web/workbench.js` | Dock UI, iframe management, skin injection |
| `web/workbench.html` | Workbench page layout, banner container |
| `web/termpp_flat_map_bootstrap.js` | StartGame/Load/Resize wrappers, auto-menu, diagnostics |
| `scripts/build_termpp_skin_lab_static.sh` | Bundle build script |
| `game_web.cpp` (legacy repo) | Native C++ startup, exports, input gates |
| `game.cpp` (legacy repo) | Game logic, menu system, input dispatch |
| `world.cpp` (legacy repo) | World/BSP/collision initialization |
