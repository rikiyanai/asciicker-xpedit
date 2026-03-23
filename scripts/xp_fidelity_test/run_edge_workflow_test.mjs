import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const DEFAULT_WORKBENCH_URL = process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench';

function getArg(name, fallback = null) {
  const idx = argv.indexOf(name);
  return idx >= 0 ? argv[idx + 1] : fallback;
}

const headed = argv.includes('--headed');
const holdOpen = argv.includes('--hold');
const url = getArg('--url', DEFAULT_WORKBENCH_URL);
const outDir = getArg('--out-dir');
const recipeFilter = getArg('--recipe');

if (!outDir) {
  console.error('Missing --out-dir');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A. State snapshot
// ---------------------------------------------------------------------------

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
      bundleStatus: text('bundleStatus'),
      wbStatus: text('wbStatus'),
      webbuildState: text('webbuildState'),
      wholeSheetMounted: !!q('wholeSheetCanvas'),
      geometry: {
        gridCols: raw?.gridCols ?? null,
        gridRows: raw?.gridRows ?? null,
        frameWChars: geo?.frameWChars ?? null,
        frameHChars: geo?.frameHChars ?? null,
        angles: geo?.angles ?? null,
        anims: geo?.anims ?? null,
        projs: geo?.projs ?? null,
      },
      buttons: {
        save: btnState('btnSave'),
        exportXp: btnState('btnExport'),
        newXp: btnState('btnNewXp'),
        testThisSkin: btnState('webbuildQuickTestBtn'),
      },
    };
  }, label);
}

// ---------------------------------------------------------------------------
// B. Action DSL
// ---------------------------------------------------------------------------

const ACTIONS = {
  async apply_template(page, params) {
    await page.selectOption('#templateSelect', params.template || 'player_native_full');
    await page.click('#templateApplyBtn');
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
    await page.waitForFunction(() => {
      const t = String(document.getElementById('sessionOut')?.textContent || '').trim();
      if (!t) return false;
      try { JSON.parse(t); return true; } catch (_e) { return false; }
    }, null, { timeout: 15000 });
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
    if (isDisabled) {
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
    await page.waitForFunction(() => {
      const s = window.__wb_debug && typeof window.__wb_debug.getWebbuildDebugState === 'function'
        ? window.__wb_debug.getWebbuildDebugState() : null;
      return !!(s && s.runtimePreflight && s.runtimePreflight.checked === true);
    }, null, { timeout: 30000 });
  },
};

// ---------------------------------------------------------------------------
// C. Invariant checker
// ---------------------------------------------------------------------------

function getNestedValue(obj, dotpath) {
  return dotpath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function checkAssertion(state, assertion) {
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

// ---------------------------------------------------------------------------
// D. Recipe executor
// ---------------------------------------------------------------------------

async function runRecipe(page, recipe, recipeOutDir) {
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

    const assertionResults = [];
    for (const assertion of (step.assertions || [])) {
      const result = checkAssertion(postState, assertion);
      assertionResults.push(result);
      if (!result.pass) results.pass = false;
    }

    if (actionError && !step.expect_error) {
      results.pass = false;
    }

    results.steps.push({
      index: i,
      action: step.action,
      params: step.params || {},
      expect_error: !!step.expect_error,
      actionError,
      preState,
      postState,
      assertions: assertionResults,
    });

    if ((actionError && !step.expect_error) || assertionResults.some(a => !a.pass)) {
      await page.screenshot({
        path: path.join(recipeOutDir, `edge-${recipe.name}-step${i}-FAIL.png`),
        fullPage: true,
      });
    }
  }

  if (recipe.postChecks && typeof recipe.postChecks === 'function') {
    recipe.postChecks(results);
  }

  return results;
}

// ---------------------------------------------------------------------------
// E. Report output
// ---------------------------------------------------------------------------

function writeReport(reportOutDir, allResults) {
  const overall = allResults.every(r => r.pass);
  const report = {
    workflow_type: 'edge_workflow',
    timestamp: new Date().toISOString(),
    overall_pass: overall,
    recipes: allResults,
  };
  fs.writeFileSync(path.join(reportOutDir, 'edge-workflow-result.json'), JSON.stringify(report, null, 2));

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

// ---------------------------------------------------------------------------
// F. Recipes
// ---------------------------------------------------------------------------

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
    // guard is somehow bypassed.
    {
      action: 'test_this_skin',
      params: {},
      expect_error: false,
      assertions: [
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
        { field: 'wholeSheetMounted', op: 'truthy', message: 'Whole-sheet must still be mounted (no silent corruption)' },
        { field: 'activeActionKey', op: 'truthy', message: 'Active action must still be set (no state corruption)' },
        { field: 'buttons.save', op: 'enabled', message: 'Save must still be enabled (workbench responsive)' },
        { field: 'buttons.testThisSkin', op: 'disabled', message: 'Test This Skin must still be disabled at partial state' },
      ],
    },
  ],
};

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
          expect_error: false,
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
        expect_error: false,
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

const RECIPES = {
  partial_bundle_gating: RECIPE_PARTIAL_BUNDLE_GATING,
  action_tab_hydration: RECIPE_ACTION_TAB_HYDRATION,
};

// ---------------------------------------------------------------------------
// G. main
// ---------------------------------------------------------------------------

async function main() {
  if (recipeFilter && !RECIPES[recipeFilter]) {
    console.error(`Unknown recipe: ${recipeFilter}`);
    console.error(`Available recipes: ${Object.keys(RECIPES).join(', ') || '(none)'}`);
    process.exit(1);
  }

  const recipesToRun = recipeFilter
    ? { [recipeFilter]: RECIPES[recipeFilter] }
    : RECIPES;

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const allResults = [];

  try {
    for (const [name, recipe] of Object.entries(recipesToRun)) {
      console.error(`\n=== Recipe: ${name} ===`);
      const page = await browser.newPage({
        viewport: { width: 1500, height: 980 },
      });

      try {
        // Navigate and wait for runtime preflight
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        await page.waitForFunction(() => {
          const s = window.__wb_debug && typeof window.__wb_debug.getWebbuildDebugState === 'function'
            ? window.__wb_debug.getWebbuildDebugState() : null;
          return !!(s && s.runtimePreflight && s.runtimePreflight.checked === true);
        }, null, { timeout: 30000 });

        const result = await runRecipe(page, recipe, outDir);
        allResults.push(result);
      } finally {
        if (!holdOpen) await page.close();
      }
    }
  } finally {
    if (!holdOpen) await browser.close();
  }

  const overall = writeReport(outDir, allResults);
  console.error(`\n=== Overall: ${overall ? 'PASS' : 'FAIL'} ===`);
  process.exit(overall ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
