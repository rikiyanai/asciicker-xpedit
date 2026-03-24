#!/usr/bin/env node

/**
 * dom_runner.mjs — Recipe executor for the M2 verifier architecture.
 *
 * Consumes recipe objects from recipe_generator.mjs and executes each step
 * as Playwright DOM actions. Uses verifier_lib.mjs for browser setup,
 * state capture, and structured reporting.
 *
 * First pass constraints:
 *   - Supports: click, setInputFiles, selectOption, fill
 *   - Refuses blocked gestures (canvas, keyboard)
 *   - Refuses non-READY actions
 *   - No canvas, no keyboard, no whole-sheet painting
 *
 * Usage:
 *   node dom_runner.mjs --recipe classic_xp_lifecycle --out-dir output/dom_runner
 *   node dom_runner.mjs --recipe bundle_template_apply --headed --out-dir output/dom_runner
 *   node dom_runner.mjs --all --out-dir output/dom_runner
 *
 * @module dom_runner
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

import {
  setupVerifier,
  captureState,
  writeReport,
  writeJsonArtifact,
  screenshot,
} from './verifier_lib.mjs';

import { resolve as resolveSelector, isGestureBlocked } from './selectors.mjs';
import { generateRecipes } from './recipe_generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// A. Gesture executors — one function per supported gestureType
// ---------------------------------------------------------------------------

/**
 * Execute a paramBinding or main gesture on the page.
 * @param {import('playwright').Page} page
 * @param {string} selectorKey — key into selectors.mjs
 * @param {string} gestureType — gesture to perform
 * @param {*} value — runtime value (file path, option value, text, etc.)
 * @returns {Promise<void>}
 */
async function executeGesture(page, selectorKey, gestureType, value) {
  const cssSelector = resolveSelector(selectorKey);

  switch (gestureType) {
    case 'click':
      await page.click(cssSelector);
      break;

    case 'setInputFiles':
      if (!value) throw new Error(`setInputFiles requires a file path value for ${selectorKey}`);
      await page.setInputFiles(cssSelector, path.resolve(REPO_ROOT, value));
      break;

    case 'selectOption':
      if (value === undefined || value === null) throw new Error(`selectOption requires a value for ${selectorKey}`);
      await page.selectOption(cssSelector, value);
      break;

    case 'fill':
      if (value === undefined || value === null) throw new Error(`fill requires a value for ${selectorKey}`);
      await page.fill(cssSelector, String(value));
      break;

    default:
      throw new Error(`Unsupported gestureType "${gestureType}" for ${selectorKey}. ` +
        `dom_runner first pass supports: click, setInputFiles, selectOption, fill.`);
  }
}

// ---------------------------------------------------------------------------
// B. Postcondition checker
// ---------------------------------------------------------------------------

/**
 * Evaluate a single postcondition assertion against a state snapshot.
 * @param {string} field — state field name
 * @param {*} expected — literal value or operator object { op, value }
 * @param {object} state — captured state snapshot
 * @param {object} [preState] — pre-step state for "changed" comparisons
 * @returns {{ pass: boolean, message: string }}
 */
function checkCondition(field, expected, state, preState) {
  const actual = state[field];

  // Literal equality
  if (expected === null || typeof expected !== 'object') {
    const pass = actual === expected;
    return {
      pass,
      message: pass
        ? `${field} === ${JSON.stringify(expected)}`
        : `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    };
  }

  // Operator object
  const { op, value } = expected;
  switch (op) {
    case 'eq':
      return { pass: actual === value, message: `${field}: ${actual} === ${value}` };
    case 'neq':
      return { pass: actual !== value, message: `${field}: ${actual} !== ${value}` };
    case 'gt':
      return { pass: actual > value, message: `${field}: ${actual} > ${value}` };
    case 'gte':
      return { pass: actual >= value, message: `${field}: ${actual} >= ${value}` };
    case 'lt':
      return { pass: actual < value, message: `${field}: ${actual} < ${value}` };
    case 'lte':
      return { pass: actual <= value, message: `${field}: ${actual} <= ${value}` };
    case 'truthy':
      return { pass: !!actual, message: `${field}: truthy? ${!!actual}` };
    case 'falsy':
      return { pass: !actual, message: `${field}: falsy? ${!actual}` };
    case 'changed': {
      const prev = preState?.[field];
      const pass = actual !== prev;
      return { pass, message: `${field}: changed from ${JSON.stringify(prev)} to ${JSON.stringify(actual)}` };
    }
    default:
      return { pass: false, message: `${field}: unknown op "${op}"` };
  }
}

/**
 * Check all postconditions for a recipe step.
 * @param {object} postconditions — expected state changes
 * @param {object} postState — state after step execution
 * @param {object} preState — state before step execution
 * @returns {{ allPass: boolean, results: Array<{ field, pass, message }> }}
 */
function checkPostconditions(postconditions, postState, preState) {
  const results = [];
  for (const [field, expected] of Object.entries(postconditions)) {
    const result = checkCondition(field, expected, postState, preState);
    results.push({ field, ...result });
  }
  const allPass = results.every(r => r.pass);
  return { allPass, results };
}

// ---------------------------------------------------------------------------
// C. Recipe step executor
// ---------------------------------------------------------------------------

const STEP_SETTLE_MS = 500;

/**
 * Execute a single recipe step.
 *
 * Sequence:
 * 1. Capture pre-state
 * 2. Execute paramBindings (preparatory inputs)
 * 3. Execute main gesture (selectorKey + gestureType)
 * 4. Settle wait
 * 5. Capture post-state
 * 6. Check postconditions
 * 7. Screenshot
 *
 * @param {import('playwright').Page} page
 * @param {object} step — recipe step with _derived metadata
 * @param {number} stepIndex — 0-based step index
 * @param {function} fail — failure recorder from verifier_lib
 * @param {string} outDir — output directory for artifacts
 * @returns {Promise<object>} step result
 */
async function executeStep(page, step, stepIndex, fail, outDir) {
  const { actionId, params = {}, expectedOutcome, _derived } = step;
  const { selectorKey, paramBindings, gestureType, preconditions } = _derived;
  const label = `step${String(stepIndex).padStart(2, '0')}_${actionId}`;

  // Guard: refuse blocked gestures
  if (isGestureBlocked(gestureType)) {
    fail('blocked_gesture', `${actionId}: gestureType "${gestureType}" is blocked`);
    return { step: label, actionId, pass: false, reason: 'blocked_gesture' };
  }

  // 1. Pre-state
  const preState = await captureState(page, `${label}_pre`);

  // 2. ParamBindings
  for (const binding of paramBindings) {
    const value = params[binding.paramKey];
    await executeGesture(page, binding.selectorKey, binding.gestureType, value);
    // Small settle after each binding
    await page.waitForTimeout(200);
  }

  // 3. Main gesture — first pass: value-less gestures only (click, rightClick)
  //    Value-requiring gestures (fill, selectOption, setInputFiles, etc.) must be
  //    modeled as paramBindings, not as the main gesture. If a main gesture would
  //    need a value, the action's registry entry is incomplete.
  if (selectorKey) {
    const VALUE_LESS_GESTURES = new Set(['click', 'rightClick']);
    if (!VALUE_LESS_GESTURES.has(gestureType)) {
      throw new Error(
        `Action "${actionId}": main gestureType "${gestureType}" requires a value, ` +
        `but first-pass dom_runner only supports value-less main gestures (click, rightClick). ` +
        `Value-requiring interactions must be modeled as paramBindings.`
      );
    }
    await executeGesture(page, selectorKey, gestureType);
  }

  // 4. Settle
  await page.waitForTimeout(STEP_SETTLE_MS);

  // 5. Post-state
  const postState = await captureState(page, `${label}_post`);

  // 6. Postconditions
  const { allPass, results } = checkPostconditions(expectedOutcome || {}, postState, preState);
  if (!allPass) {
    const failedChecks = results.filter(r => !r.pass);
    fail('postcondition', `${actionId}: ${failedChecks.map(r => r.message).join('; ')}`, {
      actionId,
      failedChecks,
    });
  }

  // 7. Screenshot
  await screenshot(page, outDir, label).catch(() => {});

  return {
    step: label,
    actionId,
    pass: allPass,
    postconditionResults: results,
    preState: { sessionId: preState.sessionId, sourceMode: preState.sourceMode },
    postState: { sessionId: postState.sessionId, sourceMode: postState.sourceMode },
  };
}

// ---------------------------------------------------------------------------
// D. Recipe runner
// ---------------------------------------------------------------------------

/**
 * Execute a complete recipe.
 *
 * @param {import('playwright').Page} page
 * @param {object} recipe — recipe object from generateRecipes()
 * @param {function} fail — failure recorder
 * @param {string} outDir — output directory
 * @returns {Promise<object>} recipe result
 */
export async function runRecipe(page, recipe, fail, outDir) {
  const recipeOutDir = path.join(outDir, recipe.id);
  const stepResults = [];
  let aborted = false;

  console.log(`[RECIPE] ${recipe.id}: ${recipe.name} (${recipe.steps.length} steps)`);

  // Gate: check recipe-level preconditions before any steps execute
  if (recipe.preconditions && Object.keys(recipe.preconditions).length > 0) {
    const preState = await captureState(page, `${recipe.id}_recipe_precondition`);
    const { allPass, results } = checkPostconditions(recipe.preconditions, preState, null);
    if (!allPass) {
      const failedChecks = results.filter(r => !r.pass);
      const msg = `Recipe "${recipe.id}" preconditions not met: ${failedChecks.map(r => r.message).join('; ')}`;
      fail('recipe_precondition', msg, { recipeId: recipe.id, failedChecks });
      console.log(`[RECIPE] ${recipe.id}: BLOCKED — preconditions not met`);
      await screenshot(page, recipeOutDir, 'precondition_blocked').catch(() => {});
      return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        pass: false,
        stepsTotal: recipe.steps.length,
        stepsPassed: 0,
        aborted: true,
        blocked: true,
        blockedReason: msg,
        preconditionResults: results,
        stepResults: [],
      };
    }
    console.log(`  [PRECONDITIONS] ${results.length} checked, all pass`);
  }

  for (let i = 0; i < recipe.steps.length; i++) {
    if (aborted) break;

    const step = recipe.steps[i];
    console.log(`  [STEP ${i}] ${step.actionId}...`);

    try {
      const result = await executeStep(page, step, i, fail, recipeOutDir);
      stepResults.push(result);

      if (!result.pass) {
        console.log(`  [STEP ${i}] ${step.actionId} — POSTCONDITION FAIL`);
        // Continue to next step; don't abort on postcondition failure
      } else {
        console.log(`  [STEP ${i}] ${step.actionId} — PASS`);
      }
    } catch (err) {
      fail('step_error', `${step.actionId}: ${err.message}`, { actionId: step.actionId, error: err.message });
      stepResults.push({
        step: `step${String(i).padStart(2, '0')}_${step.actionId}`,
        actionId: step.actionId,
        pass: false,
        reason: 'error',
        error: err.message,
      });
      console.log(`  [STEP ${i}] ${step.actionId} — ERROR: ${err.message}`);
      aborted = true;
    }
  }

  const allPass = stepResults.every(r => r.pass);
  console.log(`[RECIPE] ${recipe.id}: ${allPass ? 'PASS' : 'FAIL'} (${stepResults.filter(r => r.pass).length}/${stepResults.length})`);

  // Write step-level results artifact
  writeJsonArtifact(recipeOutDir, 'step_results.json', stepResults);

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    pass: allPass,
    stepsTotal: recipe.steps.length,
    stepsPassed: stepResults.filter(r => r.pass).length,
    aborted,
    stepResults,
  };
}

// ---------------------------------------------------------------------------
// E. CLI
// ---------------------------------------------------------------------------

async function main() {
  const {
    page, browser, report, fail, outDir, cliArgs, workbenchUrl,
  } = await setupVerifier('dom_runner', { requireOutDir: true });

  const recipes = generateRecipes();
  const runAll = cliArgs.hasFlag('--all');
  const targetId = cliArgs.getArg('--recipe');

  if (!runAll && !targetId) {
    console.error('Specify --recipe <id> or --all');
    console.error('Available:', recipes.map(r => r.id).join(', '));
    await browser.close();
    process.exit(1);
  }

  const toRun = runAll ? recipes : recipes.filter(r => r.id === targetId);
  if (toRun.length === 0) {
    console.error(`Recipe "${targetId}" not found. Available: ${recipes.map(r => r.id).join(', ')}`);
    await browser.close();
    process.exit(1);
  }

  const recipeResults = [];
  for (const recipe of toRun) {
    // Reload workbench between recipes for clean state
    if (recipeResults.length > 0) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        return window.__wb_debug && typeof window.__wb_debug.getState === 'function';
      }, { timeout: 15000 });
      await page.waitForTimeout(500);
    }

    const result = await runRecipe(page, recipe, fail, outDir);
    recipeResults.push(result);
  }

  // Build final report
  report.recipeResults = recipeResults;
  report.recipesTotal = recipeResults.length;
  report.recipesPassed = recipeResults.filter(r => r.pass).length;
  report.overall_pass = recipeResults.every(r => r.pass);

  writeReport(outDir, 'report.json', report);
  writeJsonArtifact(outDir, 'recipe_summary.json', recipeResults.map(r => ({
    id: r.recipeId,
    pass: r.pass,
    steps: `${r.stepsPassed}/${r.stepsTotal}`,
  })));

  const finalScreenshot = await screenshot(page, outDir, 'final_state').catch(() => null);

  await browser.close();

  // Exit code
  const exitCode = report.overall_pass ? 0 : 1;
  console.log(`\n[DOM_RUNNER] ${report.overall_pass ? 'ALL PASS' : 'FAILURES'} — ${report.recipesPassed}/${report.recipesTotal} recipes passed`);
  process.exit(exitCode);
}

// CLI guard: only run when executed directly
const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch(err => {
    console.error('[DOM_RUNNER] Fatal:', err.message);
    process.exit(2);
  });
}
