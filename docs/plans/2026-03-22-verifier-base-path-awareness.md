# Verifier Base-Path Awareness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the `scripts/ui_tests/` test runner and all agents construct URLs correctly when the workbench is hosted under a prefix like `/xpedit`.

**Architecture:** Change `baseUrl` from an origin (`http://host:port`) to a full workbench URL (`http://host:port/xpedit/workbench`). Add a single `resolveRoute(baseUrl, routePath)` helper that derives sibling routes by replacing the last path segment instead of using `new URL('/absolute', origin)`. All 11 broken `new URL('/workbench', baseUrl)` calls become `resolveRoute(baseUrl, '/workbench')` which correctly produces `/xpedit/workbench` when baseUrl contains a prefix.

**Tech Stack:** Node.js ESM (scripts/ui_tests/), Playwright

---

## Problem

The `ui_tests/` framework stores `baseUrl` as an origin (e.g., `http://127.0.0.1:5071`) and constructs page URLs via:

```js
new URL('/workbench', baseUrl).toString()
// → http://127.0.0.1:5071/workbench  ← ignores /xpedit prefix
```

When `WORKBENCH_URL=http://127.0.0.1:5073/xpedit/workbench`, the origin strip in `defaultBaseUrl()` (cli.mjs:24) loses the prefix entirely.

### Affected sites (11 total)

| File | Line | Pattern |
|------|------|---------|
| `runner/cli.mjs` | 24 | `defaultBaseUrl()` strips to origin |
| `runner/cli.mjs` | 305 | `new URL('/workbench', opts.baseUrl)` for server check |
| `runner/cli.mjs` | 259 | `routePath: '/workbench'` in parallel nav |
| `runner/cli.mjs` | 266 | `routePath: '/termpp-skin-lab'` in parallel nav |
| `core/server_control.mjs` | 9-10 | Forces `pathname = '/workbench'` when `/` |
| `subagents/navigation_agent.mjs` | 16 | `new URL(routePath, baseUrl)` |
| `subagents/workbench_agents.mjs` | 75, 97, 248, 377, 495, 570, 703, 843, 1319 | 9× `new URL('/workbench', baseUrl)` |
| `subagents/workbench_coverage_agent.mjs` | 594 | `new URL('/workbench', baseUrl)` |

### Not affected (already work)

- `workbench_png_to_skin_test_playwright.mjs` — takes full `--url`, uses it directly
- `workbench_bundle_manual_watchdog.mjs` — same
- `debug_workbench_skin_dock_playwright.mjs` — same

## Design

### Key change: `baseUrl` becomes a full workbench URL

Instead of stripping to origin, `baseUrl` keeps the full path:

```
WORKBENCH_URL=http://127.0.0.1:5073/xpedit/workbench
                                    ^^^^^^^ ^^^^^^^^
                                    prefix   page
```

### New helper: `resolveRoute(baseUrl, routePath)`

```js
// scripts/ui_tests/core/url_helpers.mjs

/**
 * Resolve a route path relative to a base workbench URL.
 *
 * Given baseUrl = "http://host:5073/xpedit/workbench"
 *   resolveRoute(baseUrl, "/workbench")     → "http://host:5073/xpedit/workbench"
 *   resolveRoute(baseUrl, "/termpp-skin-lab") → "http://host:5073/xpedit/termpp-skin-lab"
 *   resolveRoute(baseUrl, "/wizard")          → "http://host:5073/xpedit/wizard"
 *
 * When baseUrl has no prefix (root-hosted):
 *   resolveRoute("http://host:5071/workbench", "/wizard") → "http://host:5071/wizard"
 *
 * Logic: strip the last segment from baseUrl's pathname, append routePath.
 */
export function resolveRoute(baseUrl, routePath) {
  const u = new URL(String(baseUrl));
  // "/xpedit/workbench" → "/xpedit", "/workbench" → ""
  const prefix = u.pathname.replace(/\/[^/]*$/, '');
  u.pathname = prefix + routePath;
  u.search = '';
  return u.toString();
}
```

### Migration rules

| Before | After |
|--------|-------|
| `new URL('/workbench', baseUrl).toString()` | `resolveRoute(baseUrl, '/workbench')` |
| `new URL(routePath, baseUrl).toString()` | `resolveRoute(baseUrl, routePath)` |
| `defaultBaseUrl()` strips `.origin` | `defaultBaseUrl()` returns full URL |
| `normalizeWorkbenchUrl()` forces `/workbench` | Appends `/workbench` only when pathname is `/` |

---

## Task 1: Add `resolveRoute` helper with tests

**Files:**
- Create: `scripts/ui_tests/core/url_helpers.mjs`
- Create: `scripts/ui_tests/core/url_helpers.test.mjs`

**Step 1: Write the test file**

```js
// scripts/ui_tests/core/url_helpers.test.mjs
import { strict as assert } from 'node:assert';
import { resolveRoute } from './url_helpers.mjs';

// Root-hosted
assert.equal(
  resolveRoute('http://127.0.0.1:5071/workbench', '/workbench'),
  'http://127.0.0.1:5071/workbench'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5071/workbench', '/wizard'),
  'http://127.0.0.1:5071/wizard'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5071/workbench', '/termpp-skin-lab'),
  'http://127.0.0.1:5071/termpp-skin-lab'
);

// Prefixed
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench', '/workbench'),
  'http://127.0.0.1:5073/xpedit/workbench'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench', '/wizard'),
  'http://127.0.0.1:5073/xpedit/wizard'
);
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench', '/termpp-skin-lab'),
  'http://127.0.0.1:5073/xpedit/termpp-skin-lab'
);

// With query params on baseUrl (should be stripped)
assert.equal(
  resolveRoute('http://127.0.0.1:5073/xpedit/workbench?job_id=123', '/wizard'),
  'http://127.0.0.1:5073/xpedit/wizard'
);

// Deep prefix
assert.equal(
  resolveRoute('http://host/a/b/workbench', '/wizard'),
  'http://host/a/b/wizard'
);

console.log('url_helpers: all tests passed');
```

**Step 2: Run test to verify it fails**

Run: `node scripts/ui_tests/core/url_helpers.test.mjs`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```js
// scripts/ui_tests/core/url_helpers.mjs

/**
 * Resolve a route path relative to a base workbench URL.
 * Strips the last pathname segment from baseUrl and appends routePath.
 */
export function resolveRoute(baseUrl, routePath) {
  const u = new URL(String(baseUrl));
  const prefix = u.pathname.replace(/\/[^/]*$/, '');
  u.pathname = prefix + routePath;
  u.search = '';
  return u.toString();
}
```

**Step 4: Run test to verify it passes**

Run: `node scripts/ui_tests/core/url_helpers.test.mjs`
Expected: `url_helpers: all tests passed`

**Step 5: Commit**

```
git add scripts/ui_tests/core/url_helpers.mjs scripts/ui_tests/core/url_helpers.test.mjs
git commit -m "feat: add resolveRoute helper for base-path-aware URL construction"
```

---

## Task 2: Fix `cli.mjs` — stop stripping baseUrl to origin

**Files:**
- Modify: `scripts/ui_tests/runner/cli.mjs:21-28,305,259,266`

**Step 1: Update `defaultBaseUrl()`**

```js
// BEFORE (line 21-28):
function defaultBaseUrl() {
  const raw = String(process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://127.0.0.1:5071';
  }
}

// AFTER:
function defaultBaseUrl() {
  const raw = String(process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === '/') u.pathname = '/workbench';
    u.search = '';
    return u.toString();
  } catch {
    return 'http://127.0.0.1:5071/workbench';
  }
}
```

**Step 2: Fix server check (line 305)**

Add import at top of file:
```js
import { resolveRoute } from '../core/url_helpers.mjs';
```

```js
// BEFORE (line 305):
serverHandle = await ensureFlaskWorkbenchServer({ baseUrl: new URL('/workbench', opts.baseUrl).toString(), ... });

// AFTER:
serverHandle = await ensureFlaskWorkbenchServer({ baseUrl: resolveRoute(opts.baseUrl, '/workbench'), ... });
```

**Step 3: Fix parallel nav routePaths (lines 259, 266)**

No code change needed here — `routePath: '/workbench'` and `routePath: '/termpp-skin-lab'` are passed to `NavigationAgent` which will be fixed in Task 4. These are correct as relative route names.

**Step 4: Run existing tests**

Run: `node scripts/ui_tests/core/url_helpers.test.mjs`
Expected: PASS (no regression in helper)

**Step 5: Commit**

```
git add scripts/ui_tests/runner/cli.mjs
git commit -m "refactor: preserve full workbench URL in cli.mjs baseUrl"
```

---

## Task 3: Fix `server_control.mjs` normalization

**Files:**
- Modify: `scripts/ui_tests/core/server_control.mjs:5-16`

**Step 1: Update `normalizeWorkbenchUrl`**

```js
// BEFORE:
function normalizeWorkbenchUrl(baseUrl) {
  const raw = String(baseUrl || process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/workbench';
    }
    return u.toString();
  } catch {
    return raw;
  }
}

// AFTER (identical logic, just verifying it already does the right thing):
// This function is already correct — it only appends /workbench when pathname is '/'.
// When baseUrl is 'http://host:5073/xpedit/workbench', pathname is '/xpedit/workbench',
// so no mutation happens. No change needed.
```

Actually: **no change needed** for `server_control.mjs`. Its `normalizeWorkbenchUrl` already preserves non-root pathnames. The fix is in `cli.mjs` passing the full URL instead of just the origin.

**Step 1: Verify no change needed**

Read `server_control.mjs` and confirm that when `baseUrl = 'http://host:5073/xpedit/workbench'`, `normalizeWorkbenchUrl` returns it unchanged (pathname is not `/`).

**Step 2: Commit** — skip, no changes.

---

## Task 4: Fix `navigation_agent.mjs`

**Files:**
- Modify: `scripts/ui_tests/subagents/navigation_agent.mjs:1,16`

**Step 1: Add import and fix URL construction**

```js
// Add at top:
import { resolveRoute } from '../core/url_helpers.mjs';

// BEFORE (line 16):
await skill.open_url(new URL(routePath, baseUrl).toString(), ...);

// AFTER:
await skill.open_url(resolveRoute(baseUrl, routePath), ...);
```

**Step 2: Commit**

```
git add scripts/ui_tests/subagents/navigation_agent.mjs
git commit -m "refactor: use resolveRoute in navigation agent"
```

---

## Task 5: Fix `workbench_agents.mjs` (9 sites)

**Files:**
- Modify: `scripts/ui_tests/subagents/workbench_agents.mjs:1,75,97,248,377,495,570,703,843,1319`

**Step 1: Add import**

```js
import { resolveRoute } from '../core/url_helpers.mjs';
```

**Step 2: Replace all 9 occurrences**

Search-and-replace:
```
new URL('/workbench', baseUrl).toString()
→
resolveRoute(baseUrl, '/workbench')
```

Lines: 75, 97, 248, 377, 495, 570, 703, 843, 1319.

**Step 3: Commit**

```
git add scripts/ui_tests/subagents/workbench_agents.mjs
git commit -m "refactor: use resolveRoute in workbench agents (9 sites)"
```

---

## Task 6: Fix `workbench_coverage_agent.mjs` (1 site)

**Files:**
- Modify: `scripts/ui_tests/subagents/workbench_coverage_agent.mjs:1,594`

**Step 1: Add import and fix**

```js
import { resolveRoute } from '../core/url_helpers.mjs';

// BEFORE (line 594):
await skill.open_url(new URL('/workbench', baseUrl).toString(), ...);

// AFTER:
await skill.open_url(resolveRoute(baseUrl, '/workbench'), ...);
```

**Step 2: Commit**

```
git add scripts/ui_tests/subagents/workbench_coverage_agent.mjs
git commit -m "refactor: use resolveRoute in coverage agent"
```

---

## Task 7: Verify zero remaining `new URL('/` patterns

**Step 1: Grep for remaining broken patterns**

Run: `grep -rn "new URL('/" scripts/ui_tests/`
Expected: zero matches (all replaced)

**Step 2: Run url_helpers test**

Run: `node scripts/ui_tests/core/url_helpers.test.mjs`
Expected: PASS

**Step 3: Smoke test with live server**

```bash
# Start prefixed server
cd /Users/r/Downloads/asciicker-pipeline-v2-base-path-wt
PIPELINE_BASE_PATH=/xpedit PIPELINE_PORT=5073 PYTHONPATH=src python3 -m pipeline_v2.app &

# Run smoke test pointing at prefixed URL
node scripts/ui_tests/runner/cli.mjs test:smoke \
  --url http://127.0.0.1:5073/xpedit/workbench \
  --no-server-start
```

Expected: smoke test passes (workbench page loads, key elements visible)

**Step 4: Verify root-hosted still works**

```bash
PIPELINE_PORT=5072 PYTHONPATH=src python3 -m pipeline_v2.app &
node scripts/ui_tests/runner/cli.mjs test:smoke \
  --url http://127.0.0.1:5072/workbench \
  --no-server-start
```

Expected: smoke test passes (zero regression)

**Step 5: Final commit**

```
git commit --allow-empty -m "test: verify ui_tests work under /xpedit prefix"
```

(Or skip if no additional files changed.)

---

## Summary

| Task | Files | Sites fixed |
|------|-------|-------------|
| 1 | `url_helpers.mjs` (new) | Helper + tests |
| 2 | `cli.mjs` | 2 (defaultBaseUrl, server check) |
| 3 | `server_control.mjs` | 0 (already correct) |
| 4 | `navigation_agent.mjs` | 1 |
| 5 | `workbench_agents.mjs` | 9 |
| 6 | `workbench_coverage_agent.mjs` | 1 |
| 7 | Verification | 0 (grep + live test) |

Total: 13 call sites fixed, 1 new helper, 1 new test file, 5 modified files.
