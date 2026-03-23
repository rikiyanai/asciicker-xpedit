#!/usr/bin/env node

/**
 * run_structural_baseline_test.mjs — M2-A Structural PNG Baseline Verifier
 *
 * Validates the PNG_STRUCTURAL_BASELINE_CONTRACT:
 *   PNG upload → bundle create → action-grid apply → export → G10/G11/G12 gates
 *
 * Built on verifier_lib.mjs (shared M2 verifier foundation).
 * Base-path-aware: pass --url to test under /xpedit/workbench.
 *
 * Requirements checked:
 *   M2-R1  verifier covers full workbench (structural pipeline is first slice)
 *   M2-R5  structured workflow-state evidence
 *   M2-R6  acceptance lanes pass at root and /xpedit
 *
 * Usage:
 *   node run_structural_baseline_test.mjs --out-dir output/structural_baseline
 *   node run_structural_baseline_test.mjs --url http://127.0.0.1:5071/xpedit/workbench --out-dir output/structural_baseline_prefixed
 *   node run_structural_baseline_test.mjs --family idle --out-dir output/structural_baseline
 */

import {
  setupVerifier,
  captureState,
  waitForSessionHydration,
  resolveRoute,
  writeReport,
  writeJsonArtifact,
  screenshot,
  parseJsonSafe,
} from './verifier_lib.mjs';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FAMILIES = {
  idle: {
    fixture: 'tests/fixtures/baseline/player-idle.png',
    templateSet: 'player_native_full',
    actionKey: 'idle',
    expectedDims: { cols: 126, rows: 80 },
    expectedLayers: 3,
  },
  attack: {
    fixture: 'tests/fixtures/baseline/attack.png',
    templateSet: 'attack_native',
    actionKey: 'attack',
    expectedDims: { cols: 144, rows: 80 },
    expectedLayers: 3,
  },
  death: {
    fixture: 'tests/fixtures/baseline/death.png',
    templateSet: 'plydie_native',
    actionKey: 'death',
    expectedDims: { cols: 110, rows: 88 },
    expectedLayers: 3,
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { page, browser, report, fail, workbenchUrl, outDir, cliArgs } =
    await setupVerifier('structural_baseline', { requireOutDir: true });

  const familyFilter = cliArgs.getArg('--family', null);
  const families = familyFilter
    ? { [familyFilter]: FAMILIES[familyFilter] }
    : FAMILIES;

  if (familyFilter && !FAMILIES[familyFilter]) {
    fail('config', `Unknown family: ${familyFilter}. Valid: ${Object.keys(FAMILIES).join(', ')}`);
    report.overall_pass = false;
    writeReport(outDir, 'report.json', report);
    await browser.close();
    process.exit(1);
  }

  const results = {};
  let allPass = true;

  for (const [familyName, familyCfg] of Object.entries(families)) {
    console.log(`\n=== Testing family: ${familyName} ===`);
    const familyResult = await testFamily(page, workbenchUrl, familyName, familyCfg, outDir, fail);
    results[familyName] = familyResult;
    if (!familyResult.pass) allPass = false;
  }

  report.families = results;
  report.overall_pass = allPass;
  report.families_tested = Object.keys(results).length;
  report.families_passed = Object.values(results).filter(r => r.pass).length;

  const reportPath = writeReport(outDir, 'report.json', report);

  console.log(`\n=== Structural Baseline Summary ===`);
  console.log(`Hosting mode: ${report.hosting_mode}`);
  console.log(`Families tested: ${report.families_tested}`);
  console.log(`Families passed: ${report.families_passed}`);
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log(`Report: ${reportPath}`);

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Per-family test
// ---------------------------------------------------------------------------

async function testFamily(page, workbenchUrl, familyName, cfg, outDir, fail) {
  const result = {
    family: familyName,
    pass: false,
    steps: {},
  };

  const fixturePath = path.resolve(REPO_ROOT, cfg.fixture);
  if (!fs.existsSync(fixturePath)) {
    fail('fixture', `Missing fixture: ${cfg.fixture}`);
    result.steps.fixture = { pass: false, error: 'fixture file not found' };
    return result;
  }
  result.steps.fixture = { pass: true, path: cfg.fixture };

  // Step 1: Navigate to workbench (fresh for each family)
  try {
    await page.goto(workbenchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() =>
      window.__wb_debug && typeof window.__wb_debug.getState === 'function',
      { timeout: 15000 }
    );
    result.steps.navigate = { pass: true };
  } catch (err) {
    fail('navigate', `Failed to load workbench: ${err.message}`);
    result.steps.navigate = { pass: false, error: err.message };
    return result;
  }

  // Step 2: Upload PNG via API (direct POST, more reliable than UI file input)
  let uploadResult;
  try {
    const apiBase = resolveRoute(workbenchUrl, '/api/upload');
    const fileBuffer = fs.readFileSync(fixturePath);
    const resp = await page.evaluate(async ({ url, bytes, filename }) => {
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(bytes)]), filename);
      const r = await fetch(url, { method: 'POST', body: formData });
      return { status: r.status, body: await r.json() };
    }, {
      url: apiBase,
      bytes: [...fileBuffer],
      filename: path.basename(fixturePath),
    });

    if (resp.status !== 200 || !resp.body?.job_id) {
      fail('upload', `Upload failed: status=${resp.status}`);
      result.steps.upload = { pass: false, response: resp };
      return result;
    }
    uploadResult = resp.body;
    result.steps.upload = { pass: true, job_id: uploadResult.job_id };
  } catch (err) {
    fail('upload', `Upload error: ${err.message}`);
    result.steps.upload = { pass: false, error: err.message };
    return result;
  }

  // Step 3: Create bundle from template
  let bundleResult;
  try {
    const bundleUrl = resolveRoute(workbenchUrl, '/api/workbench/bundle/create');
    const resp = await page.evaluate(async ({ url, templateSet }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_set: templateSet }),
      });
      return { status: r.status, body: await r.json() };
    }, { url: bundleUrl, templateSet: cfg.templateSet });

    if (resp.status !== 200 || !resp.body?.bundle_id) {
      fail('bundle_create', `Bundle create failed: status=${resp.status}`);
      result.steps.bundle_create = { pass: false, response: resp };
      return result;
    }
    bundleResult = resp.body;
    result.steps.bundle_create = { pass: true, bundle_id: bundleResult.bundle_id };
  } catch (err) {
    fail('bundle_create', `Bundle create error: ${err.message}`);
    result.steps.bundle_create = { pass: false, error: err.message };
    return result;
  }

  // Step 4: Apply action-grid (uses the upload job to generate XP for this action)
  let actionGridResult;
  try {
    const actionGridUrl = resolveRoute(workbenchUrl, '/api/workbench/action-grid/apply');
    const resp = await page.evaluate(async ({ url, bundleId, actionKey, jobId }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle_id: bundleId,
          action_key: actionKey,
          job_id: jobId,
          native_compat: false,
        }),
      });
      return { status: r.status, body: await r.json() };
    }, {
      url: actionGridUrl,
      bundleId: bundleResult.bundle_id,
      actionKey: cfg.actionKey,
      jobId: uploadResult.job_id,
    });

    if (resp.status !== 200) {
      fail('action_grid', `Action-grid apply failed: status=${resp.status}`);
      result.steps.action_grid = { pass: false, response: resp };
      return result;
    }
    actionGridResult = resp.body;
    result.steps.action_grid = { pass: true, session_id: actionGridResult?.session_id };
  } catch (err) {
    fail('action_grid', `Action-grid apply error: ${err.message}`);
    result.steps.action_grid = { pass: false, error: err.message };
    return result;
  }

  // Step 5: Export bundle and validate structural gates
  let exportResult;
  try {
    const exportUrl = resolveRoute(workbenchUrl, '/api/workbench/export-bundle');
    const resp = await page.evaluate(async ({ url, bundleId }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: bundleId }),
      });
      return { status: r.status, body: await r.json() };
    }, { url: exportUrl, bundleId: bundleResult.bundle_id });

    exportResult = resp.body;
    result.steps.export = {
      pass: resp.status === 200,
      status: resp.status,
      gates: exportResult?.structural_gates || exportResult?.gates || null,
      bundle_id: bundleResult.bundle_id,
    };

    if (resp.status !== 200) {
      fail('export', `Export failed: status=${resp.status}, body=${JSON.stringify(exportResult)}`);
      return result;
    }
  } catch (err) {
    fail('export', `Export error: ${err.message}`);
    result.steps.export = { pass: false, error: err.message };
    return result;
  }

  // Step 6: Validate gate results
  const gates = exportResult?.structural_gates || exportResult?.gates || {};
  const gateChecks = {};

  // G10: dimension match
  gateChecks.G10 = {
    expected: `${cfg.expectedDims.cols}x${cfg.expectedDims.rows}`,
    result: gates?.G10 || 'not reported',
    pass: gates?.G10 === 'PASS' || gates?.G10?.status === 'PASS',
  };

  // G11: layer count
  gateChecks.G11 = {
    expected: cfg.expectedLayers,
    result: gates?.G11 || 'not reported',
    pass: gates?.G11 === 'PASS' || gates?.G11?.status === 'PASS',
  };

  // G12: L0 metadata
  gateChecks.G12 = {
    result: gates?.G12 || 'not reported',
    pass: gates?.G12 === 'PASS' || gates?.G12?.status === 'PASS',
  };

  result.steps.gates = gateChecks;

  // Acceptance: G10 + G11 + G12 must all pass
  const acceptanceGatesPass = gateChecks.G10.pass && gateChecks.G11.pass && gateChecks.G12.pass;

  if (!acceptanceGatesPass) {
    fail('structural_gates', `Gates failed for ${familyName}: G10=${gateChecks.G10.pass}, G11=${gateChecks.G11.pass}, G12=${gateChecks.G12.pass}`);
  }

  // Step 7: Capture final state
  try {
    const finalState = await captureState(page, `${familyName}_final`);
    result.steps.final_state = { captured: true };
    writeJsonArtifact(outDir, `${familyName}_final_state.json`, finalState);
  } catch (err) {
    result.steps.final_state = { captured: false, error: err.message };
  }

  // Screenshot
  try {
    await screenshot(page, outDir, `${familyName}_after_export`);
  } catch (_) {}

  result.pass = acceptanceGatesPass;
  result.acceptance_gates = { G10: gateChecks.G10.pass, G11: gateChecks.G11.pass, G12: gateChecks.G12.pass };

  console.log(`  Family ${familyName}: ${result.pass ? 'PASS' : 'FAIL'}`);
  console.log(`    G10 (dims): ${gateChecks.G10.pass ? 'PASS' : 'FAIL'} — expected ${gateChecks.G10.expected}`);
  console.log(`    G11 (layers): ${gateChecks.G11.pass ? 'PASS' : 'FAIL'} — expected ${gateChecks.G11.expected}`);
  console.log(`    G12 (metadata): ${gateChecks.G12.pass ? 'PASS' : 'FAIL'}`);

  return result;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
