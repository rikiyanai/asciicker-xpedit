# Fix "Test New Skin" Term++ Skin Test Instance Bugs

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three bugs that prevent the "Test This Skin" feature from working reliably in the workbench skin test dock.

**Architecture:** The workbench embeds a `termpp-web-flat` iframe ("skin test instance") that loads an Emscripten-compiled game build. Users click "Test This Skin" to inject XP sprite bytes into this iframe's virtual FS and start the game. Three bugs break this flow: (1) the poll loop in the Playwright E2E test exits without checking `wasmReady` or overlay dismissal, declaring success prematurely; (2) the `scheduleDeferredWebbuildStart` timer has no recovery path when `_wasmReady` never becomes true — the status message says "waiting for game init" indefinitely with no timeout feedback to the user; (3) a cosmetic gap where `setStatusText("Loading flat test arena...")` in `applyFlatMapOverride` is never cleared if the deferred start timer fires before `clearLoadingUi`.

**Tech Stack:** JavaScript (browser), Playwright (Node.js E2E test scripts)

---

### Task 1: Fix Playwright poll loop — require `wasmReady` + overlay dismissal in success condition

The E2E test `workbench_png_to_skin_test_playwright.mjs` declares skin-test success when `wbStatus` matches "Applied XP" and `iframe.calledRun && iframe.hasLoad` — but does NOT check `iframe.wasmReady` or `!iframe.overlayVisible`. This means the test moves to the "click canvas / move player" phase while the game is still on the login overlay, causing a `TimeoutError: locator.click: Timeout 10000ms exceeded` when the overlay intercepts pointer events.

**Files:**
- Modify: `scripts/workbench_png_to_skin_test_playwright.mjs:426-432`

**Step 1: Read the current success condition**

Verify the file content at lines 426-432 matches what we expect:
```js
    const success = (
      /Applied XP as web skin/i.test(wbStatus) &&
      /skin applied|webbuild ready/i.test(webbuildState) &&
      !!s.ready &&
      !!iframe.calledRun &&
      !!iframe.hasLoad
    );
```

**Step 2: Add `wasmReady` and overlay check to the success condition**

Replace the success condition with a stricter one that also requires `wasmReady` to be true, OR the overlay to be hidden (indicating game has progressed past login):

```js
    const success = (
      /Applied XP as web skin/i.test(wbStatus) &&
      /skin applied|webbuild ready/i.test(webbuildState) &&
      !!s.ready &&
      !!iframe.calledRun &&
      !!iframe.hasLoad &&
      (!!iframe.wasmReady || !iframe.overlayVisible)
    );
```

The key addition is `(!!iframe.wasmReady || !iframe.overlayVisible)`. This means:
- Either WASM is ready (can proceed to StartGame/Play), OR
- The overlay is already gone (game already started playing)

Both indicate the iframe is actually in a state where canvas interaction will work.

**Step 3: Run the test script to verify it still passes in headed mode**

Run: `node scripts/workbench_png_to_skin_test_playwright.mjs --headed --url http://127.0.0.1:5071/workbench --timeout 120`
Expected: Test should still reach the skin injection phase. If wasmReady is true and overlay is visible (the normal "ready to play" state), the success condition will still match. If wasmReady is false (the broken state), the poll loop will now correctly keep waiting instead of exiting early.

**Step 4: Commit**

```bash
git add scripts/workbench_png_to_skin_test_playwright.mjs
git commit -m "fix: require wasmReady or overlay dismissed in skin test poll loop"
```

---

### Task 2: Add `statusText` clearing for deferred-start path in `termpp_flat_map_bootstrap.js`

When `applyFlatMapOverride` runs, it sets `setStatusText("Loading flat test arena...")`. This is cleared by `clearLoadingUi()` which is called from `scheduleAutoNewGameAdvance` or `installStartGameWrapper`'s setTimeout. But in the deferred-start path (`scheduleDeferredWebbuildStart`), the deferred timer calls `win.StartGame()` which triggers the wrapped StartGame — BUT if the StartGame wrapper's `clearLoadingUi("post_startgame")` setTimeout fires before the overlay actually hides, the status may remain stuck. The fix is to call `clearLoadingUi` explicitly in `scheduleDeferredWebbuildStart` after StartGame succeeds.

**Files:**
- Modify: `web/termpp_flat_map_bootstrap.js:400`

**Step 1: Read the current `installStartGameWrapper` post-StartGame cleanup**

Verify line 400 in `termpp_flat_map_bootstrap.js`:
```js
      setTimeout(function () { clearLoadingUi("post_startgame"); }, 1200);
```

This 1200ms timeout is a best-effort. The `scheduleAutoNewGameAdvance` also calls `clearLoadingUi` but only after the overlay hides. There is a window where the statusText stays stuck.

**Step 2: Add a fallback `clearLoadingUi` call in the StartGame wrapper with a longer timeout**

Replace the single timeout with a two-stage clear: keep the existing 1200ms for the fast path, and add a 5000ms fallback:

In `installStartGameWrapper`, change line 400 from:
```js
      setTimeout(function () { clearLoadingUi("post_startgame"); }, 1200);
```
to:
```js
      setTimeout(function () { clearLoadingUi("post_startgame"); }, 1200);
      setTimeout(function () { clearLoadingUi("post_startgame_fallback"); }, 5000);
```

**Step 3: Verify bootstrap still loads correctly**

Open `http://127.0.0.1:5071/termpp-web-flat/index.html?solo=1&player=player&autonewgame=1` in browser.
Expected: The "Loading flat test arena..." text should clear within 5 seconds maximum, even in slow-init scenarios.

**Step 4: Commit**

```bash
git add web/termpp_flat_map_bootstrap.js
git commit -m "fix: add fallback clearLoadingUi timer in StartGame wrapper"
```

---

### Task 3: Surface deferred-start timeout to workbench status bar with actionable message

When `scheduleDeferredWebbuildStart` hits its 60-second timeout, it writes to `webbuildOut` but only sets a generic `status()` warning. The `setWebbuildState` line from `applyCurrentXpAsWebSkin` (line 808) says "waiting for game init..." but never updates when the timeout fires. The user sees a stale "waiting for game init (60s)..." message with no resolution.

**Files:**
- Modify: `web/workbench.js:548-553`

**Step 1: Read the current timeout handler in `scheduleDeferredWebbuildStart`**

Verify lines 548-553:
```js
          if (secs <= 60) {
            setWebbuildState(`Webbuild ready; waiting for game init (${secs}s)...`, "warn");
          }
          if (Date.now() - t0 > 60000) {
            clearInterval(timer);
            state.webbuild.pendingAutoStartToken = "";
            status("Skin applied, but web game init is still pending (click Play when ready)", "warn");
```

**Step 2: Update the timeout handler to also update `webbuildState` and offer a retry hint**

Replace lines 548-553 with:
```js
          if (secs <= 60) {
            setWebbuildState(`Webbuild ready; waiting for game init (${secs}s)...`, "warn");
          }
          if (Date.now() - t0 > 60000) {
            clearInterval(timer);
            state.webbuild.pendingAutoStartToken = "";
            status("Skin applied, but game init timed out — click Test This Skin to retry", "warn");
            setWebbuildState("Webbuild ready (game init timed out)", "warn");
```

This gives the user an actionable next step ("click Test This Skin to retry") and updates the webbuild state indicator so it no longer shows "waiting for game init (60s)...".

**Step 3: Verify the status change compiles and renders**

Open workbench, trigger a skin test. If the deferred start fires, observe the status bar.
No automated test needed — this is a UI string change.

**Step 4: Commit**

```bash
git add web/workbench.js
git commit -m "fix: show actionable timeout message when deferred skin test init stalls"
```

---

### Task 4: Add `wasmReady` field to `wbSnapshot` iframe probe in Playwright test

The poll loop (Task 1) now checks `iframe.wasmReady`, but we need to verify that the `wbSnapshot` helper actually captures `wasmReady` from the iframe. If it doesn't, the new success condition will always fail on `wasmReady`.

**Files:**
- Modify: `scripts/workbench_png_to_skin_test_playwright.mjs` (the `wbSnapshot` function)

**Step 1: Find the `wbSnapshot` function and check if it captures `wasmReady`**

Search for `wbSnapshot` definition. It should be a `page.evaluate()` that reads iframe state. Check if `_wasmReady` is already in the returned `iframe` object.

Run: Search for `wasmReady` in `workbench_png_to_skin_test_playwright.mjs`

**Step 2: If `wasmReady` is already captured, skip to Step 4. If not, add it.**

In the `wbSnapshot` function's iframe probe section, add:
```js
wasmReady: !!iframeWin._wasmReady,
```
alongside the existing `calledRun`, `hasLoad`, etc. fields.

**Step 3: Run a quick syntax check**

Run: `node --check scripts/workbench_png_to_skin_test_playwright.mjs`
Expected: No syntax errors.

**Step 4: Commit (if changes were needed)**

```bash
git add scripts/workbench_png_to_skin_test_playwright.mjs
git commit -m "fix: capture wasmReady in wbSnapshot iframe probe"
```

---

### Task 5: Verify all changes work together end-to-end

**Files:**
- Read: All files modified in Tasks 1-4

**Step 1: Start the dev server if not running**

Run: Verify server is up at `http://127.0.0.1:5071/workbench`

**Step 2: Run the full E2E skin test in headed mode**

Run: `node scripts/workbench_png_to_skin_test_playwright.mjs --headed --url http://127.0.0.1:5071/workbench --timeout 120`

Expected:
- Poll loop should wait for `wasmReady` before declaring success
- If `wasmReady` becomes true, the overlay wait + play click should succeed
- If `wasmReady` stays false for >60s, workbench status should show "game init timed out — click Test This Skin to retry"
- No `TimeoutError: locator.click` on login-overlay

**Step 3: Check for regressions in the debug probe script**

Run: `node scripts/debug_workbench_skin_dock_playwright.mjs --url http://127.0.0.1:5071/workbench --timeout 25`
Expected: Timeline should show the same fields as before; no crashes.

**Step 4: Commit any final tweaks if needed**

```bash
git add -A
git commit -m "test: verify skin test instance fixes end-to-end"
```
