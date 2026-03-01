# Render Gate Controlled Experiment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a flagged render gate (`?rendergate_ms=N`) to the flat map bootstrap, run an A/B matrix to determine if it eliminates the remainder-by-zero WASM crash without regressions.

**Architecture:** The bootstrap wraps the C-exported `Render()` function to return 0 (null buffer) for a configurable grace period after StartGame. Disabled by default (`rendergate_ms=0`). The workbench forwards the param to the iframe URL. A matrix test script drives 10 cycles per cell across skin × map × gate combinations.

**Tech Stack:** Vanilla JS (bootstrap), Playwright (matrix test), Node.js ESM

---

### Task 1: Add render gate to bootstrap

**Files:**
- Modify: `web/termpp_flat_map_bootstrap.js:33-37` (param parsing block)
- Modify: `web/termpp_flat_map_bootstrap.js:518-546` (StartGame wrapper)

**Step 1: Add param parsing at line 37**

After the existing `WORLD_GATE_HARD_TIMEOUT` line, add:

```javascript
var RENDER_GATE_MS = Math.max(0, Math.min(10000, parseInt(qs("rendergate_ms"), 10) || 0));
```

And add module-level state vars after line 23:

```javascript
var renderGateUntil = 0;
var renderGateBlockedCount = 0;
var renderGateFirstRealMs = 0;
var renderGateInstalled = false;
```

**Step 2: Add installRenderGate function**

Insert before `installStartGameWrapper` (before line 518):

```javascript
function installRenderGate() {
  if (renderGateInstalled || RENDER_GATE_MS <= 0) return;
  if (typeof window.Render !== "function") return;
  var originalRender = window.Render;
  window.Render = function (w, h) {
    if (renderGateUntil > 0 && nowMs() < renderGateUntil) {
      renderGateBlockedCount++;
      return 0;
    }
    if (renderGateUntil > 0 && !renderGateFirstRealMs) {
      renderGateFirstRealMs = nowMs();
      log("render gate opened: blocked_count=" + renderGateBlockedCount +
          " first_real_render_ms=" + (renderGateFirstRealMs - (renderGateUntil - RENDER_GATE_MS)));
    }
    return originalRender.apply(this, arguments);
  };
  renderGateInstalled = true;
  log("render gate wrapper installed (gate_ms=" + RENDER_GATE_MS + ")");
}
```

**Step 3: Arm the gate in StartGame wrapper**

Inside the `installStartGameWrapper` function, after `var ret = original.apply(this, arguments);` (line 537), insert:

```javascript
if (RENDER_GATE_MS > 0) {
  renderGateUntil = nowMs() + RENDER_GATE_MS;
  renderGateBlockedCount = 0;
  renderGateFirstRealMs = 0;
  log("render gate armed: " + RENDER_GATE_MS + "ms from now");
}
```

**Step 4: Install the gate wrapper in installLoadWrapperWhenReady**

Inside the `installLoadWrapperWhenReady` polling function (line 597 area), add after `installStartGameWrapper();`:

```javascript
installRenderGate();
```

**Step 5: Expose gate telemetry on __termppFlatMap**

In the `window.__termppFlatMap` object (line 609), add to `info()`:

```javascript
render_gate_ms: RENDER_GATE_MS,
render_gate_blocked: renderGateBlockedCount,
render_gate_first_real_ms: renderGateFirstRealMs,
render_gate_armed: renderGateUntil > 0,
```

**Step 6: Add gate stats to CLASSIFY log**

In the `startDiagnosticTrace` classify block (line 389 area), append to the log string:

```
" render_gate_blocked=" + String(renderGateBlockedCount) +
" render_gate_first_real_ms=" + String(renderGateFirstRealMs)
```

**Step 7: Verify — load bootstrap in browser with `?rendergate_ms=1500`**

Check console for: `[flat-map-bootstrap] render gate wrapper installed (gate_ms=1500)`

**Step 8: Commit**

```
git add web/termpp_flat_map_bootstrap.js
git commit -m "feat: add flagged render gate (?rendergate_ms=N) to flat map bootstrap"
```

---

### Task 2: Forward rendergate_ms in workbench iframe URL

**Files:**
- Modify: `web/workbench.js:52-59` (WEBBUILD_BASE_SRC construction)

**Step 1: Add rendergate_ms forwarding**

After the `autonewgame` forwarding block (line 58), add:

```javascript
const rendergateParam = String(params.get("rendergate_ms") || "").trim();
if (rendergateParam && /^\d+$/.test(rendergateParam)) u.searchParams.set("rendergate_ms", rendergateParam);
```

**Step 2: Commit**

```
git add web/workbench.js
git commit -m "feat: forward rendergate_ms param to webbuild iframe URL"
```

---

### Task 3: Rebuild runtime copy

**Step 1: Run the build script**

```bash
bash scripts/build_termpp_skin_lab_static.sh
```

Verify runtime copy matches source:

```bash
diff web/termpp_flat_map_bootstrap.js runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js
```

Expected: no diff.

**Step 2: Commit runtime if changed**

```
git add runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js
git commit -m "chore: rebuild runtime copy of flat map bootstrap"
```

---

### Task 4: Create A/B matrix test script

**Files:**
- Create: `scripts/render_gate_ab_matrix.mjs`

**Test matrix (2 × 3 × 2 = 12 cells, 10 runs each = 120 total runs):**

| Dimension | Values |
|---|---|
| Skin | `problematic` (/tmp/xp_test_real_session.xp, 216×32 a=4 n=9), `stock_like` (/tmp/xp_test_stock_like.xp, 264×72 a=9 n=11) |
| Map | `game_map_y8_original_game_map.a3d`, `minimal_2x2.a3d`, `minimal_1x1.a3d` |
| Gate | `off` (rendergate_ms=0), `on` (rendergate_ms=1500) |

**Per-run recording:**
- `remainder_by_zero_count` — number of "remainder by zero" console messages
- `other_crash_count` — unreachable / memory access / function signature mismatch
- `wasm_crash` — boolean, true if remainder > 0 OR other > 50
- `pos_nan_when_ready` — worldReady=1 but pos has NaN/null
- `stuck_menu` — mainMenu=1 after 30s
- `world_ready` — did worldReady ever become 1
- `render_stage_max` — highest render stage seen
- `render_gate_blocked` — from telemetry (only when gate=on)
- `render_gate_first_real_ms` — from telemetry

**Verdict per cell:** PASS if 0/10 wasm_crash AND 0/10 stuck_menu. FAIL otherwise.

**Output:**
- Console: condensed per-run lines + final matrix table
- File: `/tmp/render_gate_ab_matrix_results.json`

**Implementation notes:**
- Reuse Playwright import pattern from workbench test script
- Launch args: `--use-angle=swiftshader --use-gl=angle --enable-unsafe-swiftshader --ignore-gpu-blocklist`
- Viewport: 1440×980, serviceWorkers: "block"
- Workbench URL: `http://127.0.0.1:5071/workbench?flatmap=MAP&rendergate_ms=GATE`
- Upload XP via `page.setInputFiles("#webbuildUploadTestInput", xpPath)`
- Wait for "uploaded test skin applied" in status
- Monitor for 20s per run (capture crashes, probe game state every 2s)
- Fresh browser context per run (ensures clean WASM state)

**Step 1: Write the test script**

See implementation in task execution.

**Step 2: Verify it runs**

```bash
node scripts/render_gate_ab_matrix.mjs --runs 1
```

Should complete 12 cells × 1 run = 12 test iterations.

**Step 3: Commit**

```
git add scripts/render_gate_ab_matrix.mjs
git commit -m "feat: add A/B matrix test for render gate experiment"
```

---

### Task 5: Run the full matrix

**Step 1: Execute with 10 runs per cell**

```bash
node scripts/render_gate_ab_matrix.mjs --runs 10
```

Expected runtime: ~120 runs × 25s ≈ 50 minutes.

**Step 2: Analyze results**

Promotion criteria:
- Gate ON + problematic XP: crash rate drops to **0/10** across all maps
- Gate ON + stock XP: remains **0/10** (no regressions)
- Gate OFF: shows non-zero crash rate for problematic XP (confirms baseline)
- No new stuck_menu, invalid_run, or significant move-timeout increase
- Stock path (gate OFF) remains stable

**Step 3: Write results to temp file**

Save analysis to `/tmp/claude-render-gate-matrix-analysis.md`.
