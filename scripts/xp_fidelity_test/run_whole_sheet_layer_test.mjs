#!/usr/bin/env node

/**
 * run_whole_sheet_layer_test.mjs — M2-C Slice 2: Layer Operations Verifier
 *
 * CLASSIFICATION: UI-driven with diagnostic observation layer
 * ACTION PATH:    All actions via DOM clicks on layer panel buttons/rows
 * OBSERVATION:    State reads via __wholeSheetEditor.getState() + DOM class checks
 * ELIGIBLE FOR:   UI-driven acceptance evidence
 *
 * Validates:
 *   W10: Switch layer (click layer row)
 *   W11: Toggle layer visibility (click visibility button)
 *   W12: Add layer (click add button)
 *   W13: Delete layer (click delete button)
 *   W14: Move layer (click up/down buttons)
 *
 * Precondition: imports an XP file with 3+ layers to have a session with
 * layer panel visible. Uses verifier_lib.mjs for shared infrastructure.
 *
 * Usage:
 *   node run_whole_sheet_layer_test.mjs --xp sprites/attack-0001.xp --out-dir output/ws_layer_test
 *   node run_whole_sheet_layer_test.mjs --xp sprites/attack-0001.xp --url http://127.0.0.1:5072/xpedit/workbench --out-dir output/ws_layer_test_prefixed
 */

import {
  setupVerifier,
  captureState,
  waitForSessionHydration,
  waitForWholeSheetMount,
  writeReport,
  writeJsonArtifact,
  screenshot,
} from './verifier_lib.mjs';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition, failFn, cls, message, extra = {}) {
  if (!condition) {
    failFn(cls, message, extra);
    return false;
  }
  return true;
}

/** Read whole-sheet editor state via __wholeSheetEditor.getState(). */
async function getWsState(page) {
  return page.evaluate(() => {
    const ws = window.__wholeSheetEditor;
    if (!ws || typeof ws.getState !== 'function') return null;
    return ws.getState();
  });
}

/** Count visible layers by checking .ws-layer-visible class on vis buttons. */
async function countVisibleLayers(page) {
  return page.locator('.ws-layer-vis-btn.ws-layer-visible').count();
}

/** Get the index of the active layer row (has .ws-layer-active class). */
async function getActiveRowIndex(page) {
  const rows = page.locator('.ws-layer-row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const cls = await rows.nth(i).getAttribute('class');
    if (cls && cls.includes('ws-layer-active')) return i;
  }
  return -1;
}

/** Get layer names from DOM in order. */
async function getLayerNames(page) {
  const names = [];
  const spans = page.locator('.ws-layer-name');
  const count = await spans.count();
  for (let i = 0; i < count; i++) {
    names.push(await spans.nth(i).textContent());
  }
  return names;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { page, browser, report, fail, workbenchUrl, outDir, cliArgs } =
    await setupVerifier('whole_sheet_layer', { requireOutDir: true });

  const xpPath = cliArgs.getArg('--xp');
  if (!xpPath) {
    console.error('Missing --xp <path>');
    process.exit(1);
  }
  const absXp = path.resolve(REPO_ROOT, xpPath);
  if (!fs.existsSync(absXp)) {
    fail('config', `XP fixture not found: ${xpPath}`);
    report.overall_pass = false;
    writeReport(outDir, 'report.json', report);
    await browser.close();
    process.exit(1);
  }

  const steps = {};
  let allPass = true;

  // Step 1: Import XP to create session with layers
  console.log('=== Step 1: Import XP ===');
  await page.waitForSelector('#xpImportFile', { state: 'attached', timeout: 10000 });
  await page.waitForSelector('#xpImportBtn', { state: 'visible', timeout: 10000 });
  await page.locator('#xpImportFile').setInputFiles(absXp);
  await page.click('#xpImportBtn');
  await waitForSessionHydration(page);
  await waitForWholeSheetMount(page);
  await page.waitForTimeout(500);

  const baseline = await getWsState(page);
  await screenshot(page, outDir, 'step01_baseline');

  const baselinePass = assert(
    baseline && baseline.layerCount >= 3,
    fail, 'setup', `Need 3+ layers, got ${baseline?.layerCount}`,
    { baseline }
  );
  steps.setup = { step: 'import_xp', pass: baselinePass, layerCount: baseline?.layerCount };
  if (!baselinePass) allPass = false;

  const initialLayerCount = baseline?.layerCount || 0;
  const initialActive = baseline?.activeLayerIndex ?? 0;

  // Step 2: W10 — Switch layer (click a different layer row)
  console.log('=== Step 2: W10 Switch layer ===');
  const targetLayer = initialActive === 0 ? 1 : 0;
  const rows = page.locator('.ws-layer-row');
  await rows.nth(targetLayer).click();
  await page.waitForTimeout(300);

  const afterSwitch = await getWsState(page);
  await screenshot(page, outDir, 'step02_switch_layer');

  const switchPass = assert(
    afterSwitch?.activeLayerIndex === targetLayer,
    fail, 'w10_switch', `activeLayerIndex should be ${targetLayer}, got ${afterSwitch?.activeLayerIndex}`,
    { before: initialActive, after: afterSwitch?.activeLayerIndex }
  );
  steps.w10_switch = { step: 'switch_layer', pass: switchPass, target: targetLayer, actual: afterSwitch?.activeLayerIndex };
  if (!switchPass) allPass = false;

  // Step 3: W11 — Toggle layer visibility
  console.log('=== Step 3: W11 Toggle visibility ===');
  const visBefore = await countVisibleLayers(page);
  // Toggle visibility of layer 0
  const visBtn = page.locator('.ws-layer-row').nth(0).locator('.ws-layer-vis-btn');
  await visBtn.click();
  await page.waitForTimeout(300);

  const visAfter = await countVisibleLayers(page);
  await screenshot(page, outDir, 'step03_toggle_vis');

  const visPass = assert(
    visBefore !== visAfter,
    fail, 'w11_visibility', `Visible layer count should change: before=${visBefore}, after=${visAfter}`,
    { visBefore, visAfter }
  );
  steps.w11_visibility = { step: 'toggle_visibility', pass: visPass, visBefore, visAfter };
  if (!visPass) allPass = false;

  // Restore visibility
  await visBtn.click();
  await page.waitForTimeout(200);

  // Step 4: W12 — Add layer
  console.log('=== Step 4: W12 Add layer ===');
  const preAdd = await getWsState(page);
  await page.locator('.ws-layer-add-btn').click();
  await page.waitForTimeout(300);

  const postAdd = await getWsState(page);
  await screenshot(page, outDir, 'step04_add_layer');

  const addPass = assert(
    postAdd?.layerCount === preAdd.layerCount + 1,
    fail, 'w12_add', `layerCount should increase by 1: before=${preAdd.layerCount}, after=${postAdd?.layerCount}`,
    { before: preAdd.layerCount, after: postAdd?.layerCount }
  );
  steps.w12_add = { step: 'add_layer', pass: addPass, before: preAdd.layerCount, after: postAdd?.layerCount };
  if (!addPass) allPass = false;

  // Step 5: W14 — Move layer (move the new layer up)
  console.log('=== Step 5: W14 Move layer ===');
  const namesBefore = await getLayerNames(page);
  // The new layer is at the bottom (last row). Click its "up" button.
  const lastRowIdx = (await page.locator('.ws-layer-row').count()) - 1;
  const upBtn = page.locator('.ws-layer-row').nth(lastRowIdx).locator('.ws-layer-move-btn').first();
  const upDisabled = await upBtn.isDisabled();
  let movePass = true;
  if (upDisabled) {
    fail('w14_move', 'Up button on last layer row is disabled');
    movePass = false;
  } else {
    await upBtn.click();
    await page.waitForTimeout(300);
  }

  const namesAfter = await getLayerNames(page);
  await screenshot(page, outDir, 'step05_move_layer');

  if (movePass) {
    movePass = assert(
      JSON.stringify(namesBefore) !== JSON.stringify(namesAfter),
      fail, 'w14_move', 'Layer names order should change after move',
      { namesBefore, namesAfter }
    );
  }
  steps.w14_move = { step: 'move_layer', pass: movePass, namesBefore, namesAfter };
  if (!movePass) allPass = false;

  // Step 6: W13 — Delete layer (delete the active layer — should be the one we just moved)
  console.log('=== Step 6: W13 Delete layer ===');
  const preDel = await getWsState(page);
  await page.locator('.ws-layer-del-btn').click();
  await page.waitForTimeout(300);

  const postDel = await getWsState(page);
  await screenshot(page, outDir, 'step06_delete_layer');

  const delPass = assert(
    postDel?.layerCount === preDel.layerCount - 1,
    fail, 'w13_delete', `layerCount should decrease by 1: before=${preDel.layerCount}, after=${postDel?.layerCount}`,
    { before: preDel.layerCount, after: postDel?.layerCount }
  );
  steps.w13_delete = { step: 'delete_layer', pass: delPass, before: preDel.layerCount, after: postDel?.layerCount };
  if (!delPass) allPass = false;

  // Final state
  const finalState = await captureState(page, 'final');
  await screenshot(page, outDir, 'step_final');

  // Build report
  report.steps = steps;
  report.overall_pass = allPass;
  report.xp_fixture = xpPath;
  report.steps_total = Object.keys(steps).length;
  report.steps_passed = Object.values(steps).filter(s => s.pass).length;
  report.steps_failed = Object.values(steps).filter(s => !s.pass).length;

  writeJsonArtifact(outDir, 'state_snapshots.json', { baseline, finalState });
  const reportPath = writeReport(outDir, 'report.json', report);

  console.log('\n=== Whole-Sheet Layer Operations Summary ===');
  console.log(`Hosting mode: ${report.hosting_mode}`);
  console.log(`Steps: ${report.steps_passed}/${report.steps_total} passed`);
  for (const [name, step] of Object.entries(steps)) {
    console.log(`  ${step.pass ? 'PASS' : 'FAIL'} ${name}`);
  }
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log(`Report: ${reportPath}`);

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
