# Edge-Case Verifier Implementation Plan

**Goal:** Add a second verifier lane (`edge_workflow`) to the canonical `scripts/xp_fidelity_test/` family that checks workflow state transitions and gating honesty — without touching `full_recreation` semantics.

**Architecture:** Sibling runner (`run_edge_workflow_test.mjs`) alongside existing `run_bundle_fidelity_test.mjs`. Shares Playwright launch and page-navigation patterns but has its own action DSL, state snapshot function, and invariant checker. V1 uses hardcoded named recipes. V2 must promote those same action/state rules into a bounded randomized SAR-sequence generator for the full Milestone 1 workbench subset. Shell entry point `run_edge_workflow.sh` wraps invocation.

**Tech Stack:** Playwright (JS/ESM), Node.js, shell wrapper

---

## Design Rationale

The existing runner (`run_bundle_fidelity_test.mjs`) is tightly coupled to:
- truth-table-derived geometry
- recipe-driven cell painting
- L2 proof-region fidelity comparison

The edge-case verifier needs none of that. It needs:
- product state snapshots (bundle status, session ID, geometry, button states)
- an action DSL for template apply, tab switch, save, export, new-xp, refresh
- invariant assertions after each action
- structured failure output with pre/post state

A sibling runner is the cleanest path. It does **not** touch:
- `run_bundle_fidelity_test.mjs`
- `run_fidelity_test.mjs`
- `recipe_generator.py`
- `truth_table.py`

This implementation plan is therefore split into:

- **v1:** deterministic named recipes for known blocker classes
- **v2:** generated SAR sequences for irrational but user-reachable action chains

## Files Overview

| Action | Path |
|--------|------|
| Create | `scripts/xp_fidelity_test/run_edge_workflow_test.mjs` |
| Create | `scripts/xp_fidelity_test/run_edge_workflow.sh` |
| Modify | `scripts/xp_fidelity_test/README.md` (add edge_workflow docs) |

Primary implementation files are the new runner, shell wrapper, and README. A narrow `web/workbench.js` debug-state patch is acceptable if needed to expose honest state for verifier snapshots.

## State Source Model

The `captureState()` function must pull state from three sources:

| Field | Source | API |
|-------|--------|-----|
| `templateSetKey` | app state | `__wb_debug._state().templateSetKey` |
| `bundleId` | app state | `__wb_debug._state().bundleId` |
| `activeActionKey` | app state | `__wb_debug._state().activeActionKey` |
| `actionStates` | app state | `__wb_debug._state().actionStates` |
| `sessionId` | app state | `__wb_debug._state().sessionId` |
| `gridCols`, `gridRows` | app state | `__wb_debug.getState().angles`, etc. — but `gridCols`/`gridRows` are NOT in `getState()`, use `_state().gridCols` |
| `frameWChars`, `frameHChars` | debug API | `__wb_debug.getState().frameWChars`, `getState().frameHChars` |
| `angles`, `anims`, `projs` | debug API | `__wb_debug.getState().angles`, `.anims`, `.projs` |
| `bundleStatus` text | DOM | `document.getElementById('bundleStatus').textContent` |
| `wbStatus` text | DOM | `document.getElementById('wbStatus').textContent` |
| `webbuildState` text | DOM | `document.getElementById('webbuildState').textContent` |
| `wholeSheetMounted` | DOM | `!!document.getElementById('wholeSheetCanvas')` |
| button states | DOM | `.disabled` on `#btnSave`, `#btnExport`, `#btnNewXp`, `#webbuildQuickTestBtn` |

`__wb_debug._state()` (workbench.js:7330) returns the raw internal `state` object. This is the only current path to `templateSetKey`, `bundleId`, `activeActionKey`, and `actionStates`. If a structured alternative is preferred, patch `__wb_debug.getState()` to include those fields — but that is optional for v1.

`__wb_debug.getWebbuildDebugState()` is runtime/skin-dock-focused only. It does NOT expose bundle, template, or action state.

---

## Expected Geometry Per Action (from `config/template_registry.json`)

These are the oracle values for geometry assertions in the **Milestone 1 bundle-native workflow only** (the `player_native_full` template set). This oracle is not the general geometry source for future existing-XP load/edit workflows or Milestone 2 PNG-ingest workflows — those will need their own oracle derivation.

| Action | xp_dims | gridCols | gridRows | angles | anims | projs | frameWChars | frameHChars | layers |
|--------|---------|----------|----------|--------|-------|-------|-------------|-------------|--------|
| idle | 126x80 | 126 | 80 | 8 | [1, 8] | 2 | 7 | 10 | 4 |
| attack | 144x80 | 144 | 80 | 8 | [8] | 2 | 9 | 10 | 4 |
| death | 110x88 | 110 | 88 | 8 | [5] | 2 | 11 | 11 | 3 |

---

## Checkpoint Map

| Checkpoint | Gate | Commit |
|------------|------|--------|
| 1 | State snapshot shape + action DSL skeleton + shell wrapper runnable | `refactor: add edge-case verifier state snapshots` |
| 2 | Recipe family 1 (partial_bundle_gating) passes/fails with structured output | `feat: add partial bundle gating verifier recipes` |
| 3 | Recipe family 2 (action_tab_hydration) passes/fails with structured output | `feat: add action-tab hydration verifier recipes` |
| 4 | Generated SAR edge sequences run from bounded action vocabulary with reproducible seeds | `feat: add generated SAR edge-workflow recipes` |

---

## Task 1: Create shell entry point

**Files:**
- Create: `scripts/xp_fidelity_test/run_edge_workflow.sh`

**Step 1: Write the shell wrapper**

```bash
#!/usr/bin/env bash
# Edge-case workflow verifier — entry point.
#
# Part of the canonical XP fidelity verifier family (scripts/xp_fidelity_test/).
# Tests workflow state transitions and gating honesty.
# Does NOT replace full_recreation or bundle fidelity.
#
# Usage:
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh [--headed] [--url <url>] [--recipe <name>]
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe partial_bundle_gating --headed
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe action_tab_hydration
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh  # runs all recipes
set -euo pipefail

OUT_ROOT="output/xp-fidelity-test"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${OUT_ROOT}/edge-workflow-${STAMP}"
mkdir -p "${OUT_DIR}"

echo "=== Edge-case workflow verifier ==="
echo "Output: ${OUT_DIR}"

node scripts/xp_fidelity_test/run_edge_workflow_test.mjs --out-dir "${OUT_DIR}" "$@"
```

**Step 2: Make executable and verify it parses**

Run: `chmod +x scripts/xp_fidelity_test/run_edge_workflow.sh && bash -n scripts/xp_fidelity_test/run_edge_workflow.sh`
Expected: no output (syntax OK)

---

## Task 2: Create runner skeleton with state snapshot

**Files:**
- Create: `scripts/xp_fidelity_test/run_edge_workflow_test.mjs`

**Step 1: Write the runner skeleton with captureState, action DSL, and report structure**

The runner must implement these core primitives:

### A. State snapshot function (`captureState`)

Captures product-observable state by evaluating in-page. Uses `__wb_debug._state()` for bundle/template/action fields, `__wb_debug.getState()` for structured geometry, and DOM for text/button states.

```javascript
async function captureState(page, label) {
  return page.evaluate((lbl) => {
    const q = (id) => document.getElementById(id);
    const text = (id) => String(q(id)?.textContent || '').trim();
    const btnState = (id) => {
      const el = q(id);
      if (!el) return { exists: false, disabled: true, text: '' };
      return { exists: true, disabled: !!el.disabled, text: String(el.textContent || '').trim() };
    };

    // Raw app state via _state() — the only current path to bundle/template/action fields
    const raw = (window.__wb_debug && typeof window.__wb_debug._state === 'function')
      ? window.__wb_debug._state() : null;

    // Structured geometry via getState()
    const geo = (window.__wb_debug && typeof window.__wb_debug.getState === 'function')
      ? window.__wb_debug.getState() : null;

    return {
      label: lbl,
      timestamp: Date.now(),
      // Bundle/template/action fields — from raw app state
      templateSetKey: raw?.templateSetKey ?? null,
      bundleId: raw?.bundleId ?? null,
      activeActionKey: raw?.activeActionKey ?? null,
      sessionId: raw?.sessionId ?? null,
      actionStates: raw?.actionStates ? Object.fromEntries(
        Object.entries(raw.actionStates).map(([k, v]) => [k, {
          status: v?.status ?? null,
          sessionId: v?.sessionId ?? null,
        }])
      ) : null,
      // DOM text fields
      bundleStatus: text('bundleStatus'),
      wbStatus: text('wbStatus'),
      webbuildState: text('webbuildState'),
      wholeSheetMounted: !!q('wholeSheetCanvas'),
      // Geometry — from structured debug API
      geometry: {
        gridCols: raw?.gridCols ?? null,
        gridRows: raw?.gridRows ?? null,
        frameWChars: geo?.frameWChars ?? null,
        frameHChars: geo?.frameHChars ?? null,
        angles: geo?.angles ?? null,
        anims: geo?.anims ?? null,
        projs: geo?.projs ?? null,
      },
      // Button states — from DOM
      buttons: {
        save: btnState('btnSave'),
        exportXp: btnState('btnExport'),
        newXp: btnState('btnNewXp'),
        testThisSkin: btnState('webbuildQuickTestBtn'),
      },
    };
  }, label);
}
```

### B. Action DSL

Each action is an async function that performs one user-reachable operation:

```javascript
const ACTIONS = {
  async apply_template(page, params) {
    await page.selectOption('#templateSelect', params.template || 'player_native_full');
    await page.click('#templateApplyBtn');
    // Wait for bundle creation
    await page.waitForFunction(() => {
      const bs = String(document.getElementById('bundleStatus')?.textContent || '');
      return /Bundle: \d+\/\d+/i.test(bs);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(1000);
  },

  async switch_action_tab(page, params) {
    const ACTION_LABELS = { idle: /Idle \/ Walk/i, attack: /^Attack/i, death: /^Death/i };
    const label = ACTION_LABELS[params.action];
    if (!label) throw new Error(`Unknown action: ${params.action}`);
    const tab = page.locator('#bundleActionTabs button').filter({ hasText: label });
    await tab.first().click();
    // Wait for session to load — sessionOut must update with valid JSON
    await page.waitForFunction(() => {
      const t = String(document.getElementById('sessionOut')?.textContent || '').trim();
      if (!t) return false;
      try { JSON.parse(t); return true; } catch (_e) { return false; }
    }, null, { timeout: 15000 });
    // Wait for whole-sheet editor to remount
    await page.waitForSelector('#wholeSheetCanvas', { state: 'attached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
  },

  async save_action(page, _params) {
    const btn = page.locator('#btnSave');
    if (await btn.isDisabled()) throw new Error('Save button is disabled');
    await btn.click();
    await page.waitForTimeout(2000);
  },

  async export_action(page, _params) {
    await page.evaluate(() => {
      const el = document.getElementById('exportOut');
      if (el) el.textContent = '';
    });
    const btn = page.locator('#btnExport');
    if (await btn.isDisabled()) throw new Error('Export button is disabled');
    await btn.click();
    await page.waitForFunction(() => {
      const t = String(document.getElementById('exportOut')?.textContent || '').trim();
      if (!t) return false;
      try { return !!JSON.parse(t).xp_path; } catch (_e) { return false; }
    }, null, { timeout: 20000 });
  },

  async new_xp(page, _params) {
    const btn = page.locator('#btnNewXp');
    if (await btn.isDisabled()) throw new Error('New XP button is disabled');
    await btn.click();
    await page.waitForTimeout(2000);
  },

  async test_this_skin(page, _params) {
    const btn = page.locator('#webbuildQuickTestBtn');
    const isDisabled = await btn.isDisabled();
    // Record disabled state in the action result for diagnostics.
    // If disabled, the honest gating is working — the force-click below
    // is a deliberate diagnostic probe to verify no silent corruption.
    // If enabled, this is a normal click.
    if (isDisabled) {
      // Diagnostic: force-click a disabled button to verify no freeze/corruption
      await btn.click({ force: true });
    } else {
      await btn.click();
    }
    await page.waitForTimeout(3000);
  },

  async capture_state(page, _params) {
    // No-op — state is always captured after every action
  },

  async refresh_page(page, _params) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Wait for runtime preflight
    await page.waitForFunction(() => {
      const s = window.__wb_debug && typeof window.__wb_debug.getWebbuildDebugState === 'function'
        ? window.__wb_debug.getWebbuildDebugState() : null;
      return !!(s && s.runtimePreflight && s.runtimePreflight.checked === true);
    }, null, { timeout: 30000 });
  },
};
```

The v1 action DSL is intentionally small. For v2 generated SAR sequences, extend it with at least:

- `undo`
- `redo`
- `switch_active_layer`
- `upload_png`
- `convert_action`

These are required to cover the real blocker class of irrational user flows such as:

- upload -> `New XP`
- edit -> undo -> redo -> redo attempt
- switch layer -> edit -> action-tab switch
- import/replace -> `New XP`

### C. Recipe executor with invariant checks

```javascript
async function runRecipe(page, recipe, outDir) {
  const results = { recipe: recipe.name, steps: [], pass: true };

  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i];
    const preState = await captureState(page, `step_${i}_pre`);

    let actionError = null;
    try {
      const actionFn = ACTIONS[step.action];
      if (!actionFn) throw new Error(`Unknown action: ${step.action}`);
      await actionFn(page, step.params || {});
    } catch (err) {
      actionError = String(err.message || err);
    }

    const postState = await captureState(page, `step_${i}_post`);

    // Run invariant assertions
    const assertionResults = [];
    for (const assertion of (step.assertions || [])) {
      const result = checkAssertion(postState, assertion);
      assertionResults.push(result);
      if (!result.pass) results.pass = false;
    }

    // If action threw and step.expect_error is not set, that's a failure
    if (actionError && !step.expect_error) {
      results.pass = false;
    }
    // If action threw and step.expect_error IS set, record but don't fail
    if (actionError && step.expect_error) {
      // Expected error — not a failure
    }

    results.steps.push({
      index: i,
      action: step.action,
      params: step.params || {},
      actionError,
      preState,
      postState,
      assertions: assertionResults,
    });

    // Screenshot on failure
    if ((actionError && !step.expect_error) || assertionResults.some(a => !a.pass)) {
      await page.screenshot({
        path: path.join(outDir, `edge-${recipe.name}-step${i}-FAIL.png`),
        fullPage: true,
      });
    }
  }

  // Run post-recipe checks if defined
  if (recipe.postChecks && typeof recipe.postChecks === 'function') {
    recipe.postChecks(results);
  }

  return results;
}
```

### D. Invariant checker (`checkAssertion`)

```javascript
function checkAssertion(state, assertion) {
  // assertion shape: { field: "dotpath", op: "eq"|"neq"|"match"|"truthy"|"falsy"|"contains"|"disabled"|"enabled", value?: any, message?: string }
  const val = getNestedValue(state, assertion.field);
  let pass = false;

  switch (assertion.op) {
    case 'eq': pass = JSON.stringify(val) === JSON.stringify(assertion.value); break;
    case 'neq': pass = JSON.stringify(val) !== JSON.stringify(assertion.value); break;
    case 'match': pass = new RegExp(assertion.value).test(String(val)); break;
    case 'truthy': pass = !!val; break;
    case 'falsy': pass = !val; break;
    case 'contains': pass = String(val).includes(assertion.value); break;
    case 'disabled': pass = val?.disabled === true; break;
    case 'enabled': pass = val?.disabled === false && val?.exists === true; break;
    default: pass = false;
  }

  return {
    pass,
    field: assertion.field,
    op: assertion.op,
    expected: assertion.value,
    actual: val,
    message: assertion.message || `${assertion.field} ${assertion.op} ${JSON.stringify(assertion.value)}`,
  };
}

function getNestedValue(obj, dotpath) {
  return dotpath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}
```

### E. Report output

```javascript
function writeReport(outDir, allResults) {
  const overall = allResults.every(r => r.pass);
  const report = {
    workflow_type: 'edge_workflow',
    timestamp: new Date().toISOString(),
    overall_pass: overall,
    recipes: allResults,
  };
  fs.writeFileSync(path.join(outDir, 'edge-workflow-result.json'), JSON.stringify(report, null, 2));

  // Human-readable summary to stderr
  for (const r of allResults) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.error(`[${icon}] ${r.recipe}`);
    for (const step of r.steps) {
      const failedAssertions = step.assertions.filter(a => !a.pass);
      if (step.actionError && !step.expect_error) {
        console.error(`  step ${step.index} (${step.action}): ACTION ERROR: ${step.actionError}`);
      }
      for (const fa of failedAssertions) {
        console.error(`  step ${step.index} (${step.action}): ASSERT FAIL: ${fa.message}`);
        console.error(`    expected: ${JSON.stringify(fa.expected)}, actual: ${JSON.stringify(fa.actual)}`);
      }
    }
  }

  return overall;
}
```

**Step 2: Wire up main() with CLI arg parsing, browser launch, navigation, preflight wait**

```javascript
async function main() {
  // Parse args: --out-dir, --headed, --hold, --url, --recipe
  // Launch browser, navigate to workbench, wait for runtime preflight
  // Select recipes to run based on --recipe flag (or all)
  // For each recipe: reload page fresh, then run via runRecipe()
  // Write report via writeReport()
  // Exit with code 0 (pass) or 1 (fail)
}
```

**Step 3: Verify runner loads without errors**

Run: `node --check scripts/xp_fidelity_test/run_edge_workflow_test.mjs`
Expected: exit 0 (no syntax errors)

---

## Task 3: Implement recipe family 1 — partial_bundle_gating

**Files:**
- Modify: `scripts/xp_fidelity_test/run_edge_workflow_test.mjs` (add recipe definition)

**Step 1: Define the partial_bundle_gating recipe**

This recipe tests **gating honesty at partial bundle states**, not a happy-path march to 3/3. The documented bug class is: partial/blank states can still reach misleading test paths, and stale frontend gating allows actions that should be blocked.

The recipe focuses on:
- verifying `Test This Skin` is honestly disabled at 0/3 (expected honest state)
- verifying partial readiness (after one save) still blocks the full-bundle test path
- verifying `bundleStatus` text truthfully reflects actual action states
- verifying no silent state corruption (action key, session, mount state unchanged)
- a deliberate diagnostic force-click on disabled `Test This Skin` to confirm the workbench does not freeze or corrupt state if a disabled button is somehow reached

```javascript
const RECIPE_PARTIAL_BUNDLE_GATING = {
  name: 'partial_bundle_gating',
  description: 'Verify bundle readiness gating and Test This Skin honesty at partial states (0/3, after 1 save)',
  steps: [
    // Step 0: Apply template — expect 0/3, all controls in initial gated state
    {
      action: 'apply_template',
      params: { template: 'player_native_full' },
      assertions: [
        { field: 'bundleStatus', op: 'contains', value: '0/3', message: 'Bundle must show 0/3 after template apply' },
        { field: 'buttons.testThisSkin', op: 'disabled', message: 'Test This Skin must be disabled at 0/3' },
        { field: 'wholeSheetMounted', op: 'truthy', message: 'Whole-sheet editor must be mounted' },
        { field: 'activeActionKey', op: 'eq', value: 'idle', message: 'First action should be idle' },
      ],
    },
    // Step 1: Verify initial action states are all blank
    {
      action: 'capture_state',
      params: {},
      assertions: [
        { field: 'actionStates.idle.status', op: 'eq', value: 'blank', message: 'idle must start as blank' },
        { field: 'actionStates.attack.status', op: 'eq', value: 'blank', message: 'attack must start as blank' },
        { field: 'actionStates.death.status', op: 'eq', value: 'blank', message: 'death must start as blank' },
        { field: 'sessionId', op: 'truthy', message: 'Session ID must exist' },
        { field: 'bundleId', op: 'truthy', message: 'Bundle ID must exist' },
      ],
    },
    // Step 2: Verify honest blocking — button IS disabled, that's the expected honest state.
    // Then: diagnostic force-click to confirm no silent corruption if the disabled
    // guard is somehow bypassed.  This is not "trying to provoke a freeze as normal
    // behavior" — it is verifying that the gating is robust even under unusual access.
    {
      action: 'test_this_skin',
      params: {},
      expect_error: false,
      assertions: [
        // Primary: button was honestly disabled (captured in preState via step 0/1 assertions)
        // Secondary: no state corruption after the diagnostic force-click
        { field: 'bundleStatus', op: 'contains', value: '0/3', message: 'Bundle must still show 0/3 (no false readiness)' },
        { field: 'wholeSheetMounted', op: 'truthy', message: 'Whole-sheet must still be mounted (no silent corruption)' },
        { field: 'activeActionKey', op: 'eq', value: 'idle', message: 'Active action must still be idle (no state corruption)' },
        { field: 'buttons.save', op: 'enabled', message: 'Save must still be enabled (workbench responsive)' },
      ],
    },
    // Step 3: Save idle action — transitions to "saved" but not "converted"
    {
      action: 'save_action',
      params: {},
      assertions: [
        { field: 'actionStates.idle.status', op: 'match', value: 'saved|converted', message: 'idle should be saved or converted after save' },
        { field: 'bundleStatus', op: 'match', value: '0/3|1/3', message: 'Bundle status must reflect partial readiness' },
        { field: 'buttons.testThisSkin', op: 'disabled', message: 'Test This Skin must still be disabled after 1 save' },
      ],
    },
    // Step 4: Verify gating honesty after partial save — attack and death still blank
    {
      action: 'capture_state',
      params: {},
      assertions: [
        { field: 'actionStates.attack.status', op: 'eq', value: 'blank', message: 'attack must still be blank' },
        { field: 'actionStates.death.status', op: 'eq', value: 'blank', message: 'death must still be blank' },
        { field: 'buttons.testThisSkin', op: 'disabled', message: 'Test This Skin must be disabled with blank actions remaining' },
      ],
    },
    // Step 5: Verify gating still honest at partial state — button still disabled.
    // Diagnostic force-click to confirm no corruption at the partially-ready state.
    {
      action: 'test_this_skin',
      params: {},
      expect_error: false,
      assertions: [
        // Primary: gating is still honest — button disabled is already asserted in step 4
        // Secondary: no state corruption after diagnostic force-click at partial readiness
        { field: 'wholeSheetMounted', op: 'truthy', message: 'Whole-sheet must still be mounted (no silent corruption)' },
        { field: 'activeActionKey', op: 'truthy', message: 'Active action must still be set (no state corruption)' },
        { field: 'buttons.save', op: 'enabled', message: 'Save must still be enabled (workbench responsive)' },
        { field: 'buttons.testThisSkin', op: 'disabled', message: 'Test This Skin must still be disabled at partial state' },
      ],
    },
  ],
};
```

**Step 2: Register recipe in the RECIPES map**

```javascript
const RECIPES = {
  partial_bundle_gating: RECIPE_PARTIAL_BUNDLE_GATING,
};
```

**Step 3: Run the recipe headless against the running workbench**

Run: `bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe partial_bundle_gating`
Expected: structured pass/fail output to stderr + `edge-workflow-result.json` in output dir

**Step 4: Verify failure output shape on a deliberate assertion tweak**

Temporarily change one assertion value (e.g. expect `4/3` instead of `0/3`), run, confirm the failure artifact includes:
- recipe name
- step index
- action
- pre/post state
- assertion message

Revert the tweak.

**Step 5: Commit**

```bash
git add scripts/xp_fidelity_test/run_edge_workflow_test.mjs scripts/xp_fidelity_test/run_edge_workflow.sh
git commit -m "feat: add partial bundle gating verifier recipes"
```

---

## Task 4: Implement recipe family 2 — action_tab_hydration

**Files:**
- Modify: `scripts/xp_fidelity_test/run_edge_workflow_test.mjs` (add recipe definition)

**Step 1: Define the action_tab_hydration recipe**

This recipe tests that switching tabs loads the **correct action-specific geometry** and updates the editor. It must catch the already-seen failure mode where death loads idle geometry.

Geometry oracle values are from `config/template_registry.json` (`player_native_full` template set — Milestone 1 bundle-native actions only):

| Action | gridCols | gridRows | angles | anims | projs | frameWChars | frameHChars |
|--------|----------|----------|--------|-------|-------|-------------|-------------|
| idle | 126 | 80 | 8 | [1, 8] | 2 | 7 | 10 |
| attack | 144 | 80 | 8 | [8] | 2 | 9 | 10 |
| death | 110 | 88 | 8 | [5] | 2 | 11 | 11 |

```javascript
// Geometry oracle from config/template_registry.json — player_native_full template set.
// This is the Milestone 1 bundle-native oracle only.  Milestone 2 / existing-XP workflows
// will need their own oracle derivation.
const EXPECTED_GEOMETRY = {
  idle:   { gridCols: 126, gridRows: 80, angles: 8, anims: [1, 8], projs: 2, frameWChars: 7,  frameHChars: 10 },
  attack: { gridCols: 144, gridRows: 80, angles: 8, anims: [8],    projs: 2, frameWChars: 9,  frameHChars: 10 },
  death:  { gridCols: 110, gridRows: 88, angles: 8, anims: [5],    projs: 2, frameWChars: 11, frameHChars: 11 },
};

function geometryAssertions(action) {
  const g = EXPECTED_GEOMETRY[action];
  return [
    { field: 'activeActionKey', op: 'eq', value: action, message: `Active action must be ${action}` },
    { field: 'geometry.gridCols', op: 'eq', value: g.gridCols, message: `${action} gridCols must be ${g.gridCols}` },
    { field: 'geometry.gridRows', op: 'eq', value: g.gridRows, message: `${action} gridRows must be ${g.gridRows}` },
    { field: 'geometry.angles', op: 'eq', value: g.angles, message: `${action} angles must be ${g.angles}` },
    { field: 'geometry.anims', op: 'eq', value: g.anims, message: `${action} anims must be ${JSON.stringify(g.anims)}` },
    { field: 'geometry.projs', op: 'eq', value: g.projs, message: `${action} projs must be ${g.projs}` },
    { field: 'geometry.frameWChars', op: 'eq', value: g.frameWChars, message: `${action} frameWChars must be ${g.frameWChars}` },
    { field: 'geometry.frameHChars', op: 'eq', value: g.frameHChars, message: `${action} frameHChars must be ${g.frameHChars}` },
    { field: 'wholeSheetMounted', op: 'truthy', message: 'Whole-sheet must be mounted' },
    { field: 'sessionId', op: 'truthy', message: `Session ID must exist for ${action}` },
  ];
}

const RECIPE_ACTION_TAB_HYDRATION = {
  name: 'action_tab_hydration',
  description: 'Verify session/geometry correctness after action-tab switches — catches wrong-session bugs',
  steps: [
    // Step 0: Apply template
    {
      action: 'apply_template',
      params: { template: 'player_native_full' },
      assertions: [
        { field: 'bundleStatus', op: 'contains', value: '0/3', message: 'Bundle should be 0/3' },
      ],
    },
    // Step 1: Verify idle geometry (exact values)
    {
      action: 'capture_state',
      params: {},
      assertions: geometryAssertions('idle'),
    },
    // Step 2: idle -> attack (exact geometry check)
    {
      action: 'switch_action_tab',
      params: { action: 'attack' },
      assertions: geometryAssertions('attack'),
    },
    // Step 3: attack -> death (exact geometry check — the critical bug case)
    {
      action: 'switch_action_tab',
      params: { action: 'death' },
      assertions: geometryAssertions('death'),
    },
    // Step 4: death -> idle (return trip — verify geometry restores)
    {
      action: 'switch_action_tab',
      params: { action: 'idle' },
      assertions: geometryAssertions('idle'),
    },
    // Step 5: idle -> death (skip attack — non-sequential jump)
    {
      action: 'switch_action_tab',
      params: { action: 'death' },
      assertions: geometryAssertions('death'),
    },
  ],
  // Post-recipe checks: session ID stability and uniqueness
  postChecks: (results) => {
    const sessionIds = {};
    for (const step of results.steps) {
      const actionKey = step.postState?.activeActionKey;
      const sid = step.postState?.sessionId;
      if (actionKey && sid) {
        if (!sessionIds[actionKey]) sessionIds[actionKey] = [];
        sessionIds[actionKey].push(sid);
      }
    }
    // All visits to same action should get same session ID
    for (const [action, sids] of Object.entries(sessionIds)) {
      const unique = [...new Set(sids)];
      if (unique.length !== 1) {
        results.pass = false;
        results.steps.push({
          index: results.steps.length,
          action: 'post_recipe_check',
          params: { check: 'session_id_stability' },
          actionError: null,
          preState: null,
          postState: null,
          assertions: [{
            pass: false,
            field: `sessionIds.${action}`,
            op: 'eq',
            expected: 'single unique ID',
            actual: unique,
            message: `${action} had inconsistent session IDs across visits: ${unique.join(', ')}`,
          }],
        });
      }
    }
    // Different actions should have different session IDs
    const allUnique = [...new Set(Object.values(sessionIds).map(s => s[0]))];
    if (allUnique.length < Object.keys(sessionIds).length) {
      results.pass = false;
      results.steps.push({
        index: results.steps.length,
        action: 'post_recipe_check',
        params: { check: 'session_id_uniqueness' },
        actionError: null,
        preState: null,
        postState: null,
        assertions: [{
          pass: false,
          field: 'sessionIds',
          op: 'all_unique',
          expected: 'all different',
          actual: sessionIds,
          message: 'Different actions should have different session IDs',
        }],
      });
    }
  },
};
```

**Step 2: Register recipe**

```javascript
const RECIPES = {
  partial_bundle_gating: RECIPE_PARTIAL_BUNDLE_GATING,
  action_tab_hydration: RECIPE_ACTION_TAB_HYDRATION,
};
```

**Step 3: Run both recipes**

Run: `bash scripts/xp_fidelity_test/run_edge_workflow.sh --headed`
Expected: both recipes run, structured output for each

**Step 4: Commit**

```bash
git add scripts/xp_fidelity_test/run_edge_workflow_test.mjs
git commit -m "feat: add action-tab hydration verifier recipes"
```

---

## Task 5: Implement bounded generated SAR edge sequences

After v1 deterministic recipes are stable, add a generated-sequence layer that turns the
Milestone 1 workbench SAR subset into reproducible randomized workflows.

### Scope

- bounded sequence length, not open-ended fuzzing
- fixed action vocabulary
- seedable generation
- per-step expected responses derived from SAR rules

### Required action vocabulary

- `apply_template`
- `switch_action_tab`
- `upload_png`
- `convert_action`
- `save_action`
- `export_action`
- `new_xp`
- `refresh_page`
- `test_this_skin`
- `undo`
- `redo`
- `switch_active_layer`

### Generator rules

The generator must:

1. choose only user-reachable actions
2. respect action preconditions when building the sequence
3. derive the expected SAR assertions for each chosen step
4. write the generated recipe and seed into the output artifact for replay

Example target flows:

- upload PNG -> `New XP`
- upload PNG -> convert -> `New XP`
- edit -> undo -> redo -> redo attempt
- switch active layer -> edit -> undo -> switch action tab
- partial bundle progress -> refresh -> `Test This Skin`

### Deliverable shape

- `--recipe generated_sar_sequences`
- optional `--seed <n>`
- output includes:
  - seed
  - generated action list
  - per-step expected assertions
  - failure step with pre/post state

### Commit

```bash
git add scripts/xp_fidelity_test/run_edge_workflow_test.mjs scripts/xp_fidelity_test/README.md
git commit -m "feat: add generated SAR edge-workflow recipes"
```

---

## Task 5: Update README

**Files:**
- Modify: `scripts/xp_fidelity_test/README.md`

**Step 1: Add edge_workflow section**

Add after the existing "Two Modes" section:

```markdown
## Edge-Case Workflow Verifier

Tests workflow state transitions and gating honesty. Does not replace
`full_recreation` or bundle fidelity testing.

### What it tests

- Bundle readiness gating honesty at partial states (0/3, after 1 save)
- `Test This Skin` blocked state honesty — no silent freeze at invalid states
- Action-tab session hydration with exact geometry verification per action
- Session ID stability (same action = same session) and uniqueness (different actions = different sessions)
- Whole-sheet editor mounting after tab switches

### Geometry oracle

Expected geometry per action is derived from `config/template_registry.json`:

| Action | gridCols | gridRows | angles | anims | frameWChars | frameHChars |
|--------|----------|----------|--------|-------|-------------|-------------|
| idle | 126 | 80 | 8 | [1, 8] | 7 | 10 |
| attack | 144 | 80 | 8 | [8] | 9 | 10 |
| death | 110 | 88 | 8 | [5] | 11 | 11 |

### Usage

```bash
# All edge-case recipes
bash scripts/xp_fidelity_test/run_edge_workflow.sh --headed

# Specific recipe
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe partial_bundle_gating --headed
bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe action_tab_hydration

# Custom URL
bash scripts/xp_fidelity_test/run_edge_workflow.sh --url http://localhost:5071/workbench
```

### Report shape

The `edge-workflow-result.json` includes:

- `workflow_type: "edge_workflow"`
- `overall_pass`
- `recipes[]`: per-recipe results with step-by-step pre/post state snapshots and assertion results

### State snapshot fields

Each step records pre/post state including:
- `templateSetKey`, `bundleId`, `activeActionKey`, `sessionId`, `actionStates`
- `bundleStatus`, `wbStatus`, `webbuildState` (DOM text)
- `geometry` (gridCols, gridRows, frameWChars, frameHChars, angles, anims, projs)
- `buttons` (save, exportXp, newXp, testThisSkin — exists + disabled + text)
- `wholeSheetMounted`
```

**Step 2: Commit**

```bash
git add scripts/xp_fidelity_test/README.md
git commit -m "docs: add edge-case workflow verifier to README"
```

---

## Preconditions

Before implementing recipes, confirm:

1. The workbench server is running at `http://127.0.0.1:5071/workbench` (or supply `--url`)
2. `__wb_debug._state()` (workbench.js:7330) returns the raw `state` object — confirmed to include `templateSetKey`, `bundleId`, `activeActionKey`, `actionStates`, `sessionId`, `gridCols`, `gridRows`
3. `__wb_debug.getState()` (workbench.js:7240) returns structured geometry — confirmed to include `angles`, `anims`, `projs`, `frameWChars`, `frameHChars`
4. `__wb_debug.getWebbuildDebugState()` is runtime/skin-dock-only — NOT used for bundle/template/action state
5. `#btnSave`, `#btnNewXp`, `#btnExport`, `#webbuildQuickTestBtn` confirmed as DOM IDs
6. Bundle status format is `"Bundle: X/3 actions ready"` (workbench.js:6408)
7. Action tab buttons are dynamically rendered in `#bundleActionTabs` with text matching `Idle / Walk`, `Attack`, `Death`
