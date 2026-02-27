# TERM++ Web/Native Startup Parity Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix first-move freeze/underwater in Workbench TERM++ skin preview by matching native `asciiid` startup ordering.

**Architecture:** Four surgical changes to `web/termpp_flat_map_bootstrap.js`: (1) add a diagnostic trace for first 5s post-StartGame, (2) gate auto-menu Enter pulses on `GameWorldReady()`, (3) await `original.StartGame()` if it returns a Promise, (4) add a diagnostic log to the Load wrapper async path. Phase 1 (runtime preflight) is already implemented.

**Tech Stack:** Vanilla JS (no build step), Flask/Python backend, Playwright for smoke tests.

**Design doc:** `docs/plans/2026-02-26-termpp-parity-fix-design.md`

---

## Pre-Implementation: Phase 1 Already Done

Runtime preflight endpoint (`/api/workbench/runtime-preflight`), workbench banner, and dock button gating are already implemented in:
- `src/pipeline_v2/app.py:86-153` (`_runtime_preflight_payload`)
- `src/pipeline_v2/app.py:197-199` (route)
- `web/workbench.js:274-325` (JS integration)
- `web/workbench.html:12-13` (banner HTML)

**No work needed for Phase 1.**

---

### Task 1: Add Diagnostic Trace to Bootstrap

**Files:**
- Modify: `web/termpp_flat_map_bootstrap.js`

**Context:** The bootstrap already has `menuProbe()` (line 236) that calls `GameWorldReady()`, `GetRenderStageCode()`, `ak.getPos()`, `ak.getWater()`, `ak.isGrounded()`. We need a new `startDiagnosticTrace()` function that logs these every 100ms for 5s after StartGame, then emits a classification.

**Step 1: Add `startDiagnosticTrace()` function**

Insert after the `gameplayLikelyStarted()` function (after line 294) and before `scheduleAutoNewGameAdvance()` (line 296):

```javascript
  var diagnosticTraceTimer = 0;

  function startDiagnosticTrace() {
    if (diagnosticTraceTimer) {
      clearInterval(diagnosticTraceTimer);
      diagnosticTraceTimer = 0;
    }
    var t0 = nowMs();
    var frameCount = 0;
    var initialStage = -1;
    var posChanged = false;
    var waterDetected = false;
    var groundedOnce = false;
    var stuckMenu = false;
    var firstPos = null;

    diagnosticTraceTimer = setInterval(function () {
      var age = nowMs() - t0;
      frameCount++;
      var probe = menuProbe();
      var stage = Number(probe.render_stage);
      if (initialStage < 0 && isFinite(stage)) initialStage = stage;
      var inMainMenu = (probe.main_menu === true || Number(probe.main_menu) === 1);
      var worldReady = (probe.world_ready === true || Number(probe.world_ready) === 1);
      var grounded = (probe.grounded === true);
      var water = Number(probe.water);
      if (grounded) groundedOnce = true;
      if (isFinite(water) && water > 0) waterDetected = true;
      if (Array.isArray(probe.pos) && probe.pos.length === 3) {
        if (!firstPos) firstPos = [Number(probe.pos[0]), Number(probe.pos[1]), Number(probe.pos[2])];
        for (var i = 0; i < 3; i++) {
          if (Math.abs(Number(probe.pos[i]) - firstPos[i]) > 0.01) posChanged = true;
        }
      }

      log("[TRACE] frame=" + frameCount + " t=" + age + " pos=" + JSON.stringify(probe.pos) +
          " grounded=" + String(probe.grounded) + " water=" + String(probe.water) +
          " menu=" + String(probe.main_menu) + " world_ready=" + String(probe.world_ready) +
          " stage=" + String(probe.render_stage));

      if (age >= 5000) {
        clearInterval(diagnosticTraceTimer);
        diagnosticTraceTimer = 0;
        // Classify
        var result = "unknown";
        if (worldReady && groundedOnce && posChanged && !waterDetected) {
          result = "playable";
        } else if (isFinite(stage) && stage === initialStage && initialStage < 70) {
          result = "freeze_no_frames";
        } else if (waterDetected && age <= 3000) {
          result = "underwater";
        } else if (!groundedOnce && Array.isArray(probe.pos) && probe.pos.length === 3 && firstPos) {
          var zNow = Number(probe.pos[2]);
          var zStart = firstPos[2];
          if (isFinite(zNow) && isFinite(zStart) && zNow < zStart - 1) {
            result = "falling";
          }
        } else if (inMainMenu) {
          result = "stuck_menu";
        } else if (!worldReady) {
          result = "freeze_world_never_ready";
        }
        log("[CLASSIFY] result=" + result + " frames=" + frameCount +
            " pos_changed=" + String(posChanged) + " water_detected=" + String(waterDetected) +
            " grounded_once=" + String(groundedOnce) + " final_stage=" + String(stage) +
            " world_ready=" + String(worldReady) + " menu=" + String(inMainMenu));
      }
    }, 100);
  }
```

**Step 2: Wire `startDiagnosticTrace()` into StartGame wrapper**

In `installStartGameWrapper()`, at line 402, add the call after `scheduleAutoNewGameAdvance()`:

```javascript
      // EXISTING line 402:
      scheduleAutoNewGameAdvance();
      // ADD this line:
      startDiagnosticTrace();
```

**Step 3: Verify manually**

Run the app:
```bash
python3 -m src.pipeline_v2.app
```

Open `http://127.0.0.1:5071/workbench`, load a session, click "Test This Skin". Open browser DevTools console. Filter for `[flat-map-bootstrap]`.

Expected: ~50 `[TRACE]` lines over 5 seconds, then one `[CLASSIFY]` line.

**Step 4: Commit**

```bash
git add web/termpp_flat_map_bootstrap.js
git commit -m "feat: add first-move diagnostic trace to flat map bootstrap"
```

---

### Task 2: Gate Auto-Menu on World Readiness

**Files:**
- Modify: `web/termpp_flat_map_bootstrap.js:296-347` (`scheduleAutoNewGameAdvance`)

**Context:** Currently the auto-menu sends Enter pulses as soon as the overlay hides. Native behavior: user can't advance menu until world is loaded. We add a `world_ready` check before sending the first pulse.

**Step 1: Add world-ready gate in `scheduleAutoNewGameAdvance()`**

Replace the block at lines 321-340 (the part after overlay check, before pulse budget check):

Current code (lines 321-340):
```javascript
      clearLoadingUi("overlay_hidden");
      var probe = menuProbe();
      var inMainMenu = (probe.main_menu === true || Number(probe.main_menu) === 1);
      if (!inMainMenu) {
        clearLoadingUi("main_menu_cleared");
        log("auto-newgame stopped (main menu cleared)");
        clearInterval(autoMenuTimer);
        autoMenuTimer = 0;
        return;
      }
      if (gameplayLikelyStarted(probe) || (probe.world_ready === true && probe.main_menu === false)) {
        clearLoadingUi("world_ready");
        log("auto-newgame stopped (world ready)");
        clearInterval(autoMenuTimer);
        autoMenuTimer = 0;
        return;
      }
      pulsesSent++;
      var mode = sendEnterPulse();
      log("auto-newgame pulse #" + pulsesSent + " (" + mode + ") age_ms=" + age + " menu=" + String(probe.main_menu) + " world=" + String(probe.world_ready) + " stage=" + String(probe.render_stage) + " pos=" + String(probe.pos) + " water=" + String(probe.water) + " grounded=" + String(probe.grounded));
```

Replace with:
```javascript
      clearLoadingUi("overlay_hidden");
      var probe = menuProbe();
      var inMainMenu = (probe.main_menu === true || Number(probe.main_menu) === 1);
      var worldReady = (probe.world_ready === true || Number(probe.world_ready) === 1);
      if (!inMainMenu) {
        clearLoadingUi("main_menu_cleared");
        log("auto-newgame stopped (main menu cleared)");
        clearInterval(autoMenuTimer);
        autoMenuTimer = 0;
        return;
      }
      if (gameplayLikelyStarted(probe) || (worldReady && !inMainMenu)) {
        clearLoadingUi("world_ready");
        log("auto-newgame stopped (world ready)");
        clearInterval(autoMenuTimer);
        autoMenuTimer = 0;
        return;
      }
      // PARITY GATE: Wait for world_ready before first Enter pulse.
      // Native asciiid loads map synchronously before menu advance is possible.
      if (!worldReady) {
        if (age > 10000) {
          log("auto-newgame aborted: world never became ready after 10s (freeze_world_never_ready)");
          clearInterval(autoMenuTimer);
          autoMenuTimer = 0;
          return;
        }
        if (pulsesSent === 0 || (age % 2000) < 500) {
          log("auto-newgame waiting for world_ready... age_ms=" + age + " stage=" + String(probe.render_stage));
        }
        return;
      }
      pulsesSent++;
      var mode = sendEnterPulse();
      log("auto-newgame pulse #" + pulsesSent + " (" + mode + ") age_ms=" + age + " menu=" + String(probe.main_menu) + " world=" + String(probe.world_ready) + " stage=" + String(probe.render_stage) + " pos=" + String(probe.pos) + " water=" + String(probe.water) + " grounded=" + String(probe.grounded));
```

**Key changes:**
- Added `worldReady` variable (already computed from probe, just extracted for clarity).
- Added `if (!worldReady)` block before the pulse — returns early (no pulse sent) if world not ready.
- 10-second timeout emits diagnostic and aborts if world never initializes.
- Periodic log while waiting so it's visible in DevTools.

**Step 2: Verify manually**

Same manual test as Task 1. In DevTools, look for:
- `auto-newgame waiting for world_ready...` logs (new gate working)
- Followed by `auto-newgame pulse #1` only after `world_ready=true`
- OR `auto-newgame aborted: world never became ready` if world init is broken

**Step 3: Commit**

```bash
git add web/termpp_flat_map_bootstrap.js
git commit -m "fix: gate auto-menu Enter pulses on GameWorldReady before advancing"
```

---

### Task 3: Await Original StartGame If Thenable

**Files:**
- Modify: `web/termpp_flat_map_bootstrap.js:398-403` (`installStartGameWrapper`)

**Context:** Line 398 calls `original.apply(this, arguments)` without awaiting. If the original `StartGame()` returns a Promise (modern builds), the wrapper returns before game init completes, and `scheduleAutoNewGameAdvance()` fires too early.

**Step 1: Make the wrapper await the original if it returns a thenable**

Replace lines 398-403:

Current:
```javascript
      var ret = original.apply(this, arguments);
      // Do not leave the Emscripten loading label pinned forever once startup transitions.
      setTimeout(function () { clearLoadingUi("post_startgame"); }, 1200);
      setTimeout(function () { clearLoadingUi("post_startgame_fallback"); }, 5000);
      scheduleAutoNewGameAdvance();
      return ret;
```

Replace with:
```javascript
      var ret = original.apply(this, arguments);
      // If original.StartGame returns a Promise, await it before scheduling auto-menu.
      // This ensures game initialization completes before Enter pulses are sent.
      if (ret && typeof ret.then === "function") {
        try { await ret; } catch (_e) { log("original StartGame rejected: " + _e); }
      }
      // Do not leave the Emscripten loading label pinned forever once startup transitions.
      setTimeout(function () { clearLoadingUi("post_startgame"); }, 1200);
      setTimeout(function () { clearLoadingUi("post_startgame_fallback"); }, 5000);
      scheduleAutoNewGameAdvance();
      startDiagnosticTrace();
      return ret;
```

**Note:** The `startDiagnosticTrace()` call from Task 1 should be here (after `scheduleAutoNewGameAdvance()`), not added separately. If Task 1 already added it, this replacement already includes it.

**Step 2: Verify manually**

Same manual test. Look for console logs to confirm auto-menu doesn't fire until after StartGame resolves (if async).

**Step 3: Commit**

```bash
git add web/termpp_flat_map_bootstrap.js
git commit -m "fix: await original StartGame if thenable before scheduling auto-menu"
```

---

### Task 4: Add Diagnostic Log to Load Wrapper Async Path

**Files:**
- Modify: `web/termpp_flat_map_bootstrap.js:424-427` (Load wrapper async branch)

**Context:** Lines 425-427 have the async deferral path for Load(). We need to log when this path is hit to validate whether it contributes to the bug.

**Step 1: Add log to async path**

Replace lines 424-427:

Current:
```javascript
          applyFlatMapOverride(false)
            .catch(function (e) { log("pre-Load override failed: " + e); })
            .finally(function () { originalLoad.apply(window, args); });
```

Replace with:
```javascript
          log("[DIAG] Load wrapper async path hit (appliedStamp=0) — map override deferred before originalLoad");
          applyFlatMapOverride(false)
            .catch(function (e) { log("pre-Load override failed: " + e); })
            .finally(function () {
              log("[DIAG] Load wrapper async path complete — calling originalLoad now");
              originalLoad.apply(window, args);
            });
```

**Step 2: Verify manually**

Check DevTools console for `[DIAG] Load wrapper async path hit`. If this message **never appears** during normal "Test This Skin" flow, the async gap is not a contributing factor (the StartGame path handles it via `await applyFlatMapOverride()`).

**Step 3: Commit**

```bash
git add web/termpp_flat_map_bootstrap.js
git commit -m "chore: add diagnostic log to Load wrapper async path for parity analysis"
```

---

### Task 5: Manual Smoke Test

**No code changes.** Run end-to-end manual validation.

**Step 1: Ensure runtime bundle exists**

```bash
ls runtime/termpp-skin-lab-static/termpp-web-flat/index.html \
   runtime/termpp-skin-lab-static/termpp-web-flat/index.js \
   runtime/termpp-skin-lab-static/termpp-web-flat/index.wasm \
   runtime/termpp-skin-lab-static/termpp-web-flat/index.data \
   runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js \
   runtime/termpp-skin-lab-static/termpp-web-flat/flatmaps/minimal_2x2.a3d
```

If any missing, rebuild:
```bash
./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web
```

**Step 2: Start server**

```bash
python3 -m src.pipeline_v2.app
```

**Step 3: Run preflight check**

```bash
curl -s http://127.0.0.1:5071/api/workbench/runtime-preflight | python3 -m json.tool
```

Expected: `"ok": true`

**Step 4: Open workbench and test skin**

1. Open `http://127.0.0.1:5071/workbench`
2. Load a session with a skin
3. Click "Test This Skin"
4. Open DevTools console, filter `[flat-map-bootstrap]`
5. Watch for:
   - `auto-newgame waiting for world_ready...` (gate working)
   - `auto-newgame pulse #1` fires only after `world_ready=true`
   - `[TRACE]` lines every 100ms for 5 seconds
   - `[CLASSIFY] result=...` at end
6. After game loads, press WASD movement keys
7. Verify: no freeze, no underwater, no fall-through

**Step 5: Record result in failure log**

Append to `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`:

```markdown
### YYYY-MM-DDTHH:MMZ — Parity fix validation
- Run: manual smoke test after world-ready gate + StartGame await + diagnostic trace.
- Observation: [describe what happened]
- Classification: [from CLASSIFY output]
- Hypothesis impact: [H1 supported/weakened/ruled_out]
- Next: [what to do next]
```

---

## Summary of All Changes

| Task | File | Change | Lines |
|------|------|--------|-------|
| 1 | `web/termpp_flat_map_bootstrap.js` | Add `startDiagnosticTrace()` function | After line 294 |
| 2 | `web/termpp_flat_map_bootstrap.js` | Gate auto-menu on `world_ready` | Lines 321-340 |
| 3 | `web/termpp_flat_map_bootstrap.js` | Await `original.StartGame()` if thenable | Lines 398-403 |
| 4 | `web/termpp_flat_map_bootstrap.js` | Log when Load async path hits | Lines 424-427 |
| 5 | Manual | Smoke test + failure log update | N/A |

All changes are in **one file** (`web/termpp_flat_map_bootstrap.js`). No backend, HTML, or build changes needed — Phase 1 preflight is already done.
