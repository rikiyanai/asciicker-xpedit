// scripts/xp_fidelity_test/run_fidelity_test.mjs
/**
 * XP Fidelity Test — User-Action Conformance Executor
 *
 * Dispatches UI actions from a recipe using only visible DOM controls.
 * No window.__wb_debug. No direct state mutation. Only clicks, fills, and typing.
 *
 * Phases:
 *   1. Setup (test scaffolding, not under conformance test): upload XP via API, navigate to ?job_id=<id>
 *   2. Preflight: validate all required DOM selectors exist and are interactive
 *   3. Execute: dispatch recipe actions through visible controls
 *   4. Verify: click Export XP, download result, compare against truth table
 *
 * Usage:
 *   node run_fidelity_test.mjs \
 *     --truth-table <truth_table.json> \
 *     --recipe <recipe.json> \
 *     --xp <source.xp> \
 *     [--url http://127.0.0.1:5071/workbench] \
 *     [--headed]
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Args ---
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}

const truthTablePath = getArg('--truth-table');
const recipePath = getArg('--recipe');
const xpPath = getArg('--xp');
const url = getArg('--url') || 'http://127.0.0.1:5071/workbench';
const headed = args.includes('--headed');

if (!truthTablePath || !recipePath || !xpPath) {
  console.error('Usage: node run_fidelity_test.mjs --truth-table <json> --recipe <json> --xp <xp_file> [--url <url>] [--headed]');
  process.exit(1);
}

const truthTable = JSON.parse(fs.readFileSync(truthTablePath, 'utf-8'));
const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf-8'));

if (!recipe.ok) {
  console.error(`Recipe not OK: ${recipe.error}`);
  process.exit(1);
}

// Build truth lookup for layer 2
const layer2Info = truthTable.layers.find(l => l.index === 2);
const layer2Truth = {};
for (const cell of layer2Info.cells) {
  layer2Truth[`${cell.x},${cell.y}`] = cell;
}

// Output dir
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join('output', 'xp-fidelity-test', `fidelity-${ts}`);
fs.mkdirSync(outDir, { recursive: true });

// --- Failure tracking ---
const failures = [];
function fail(cls, detail) {
  failures.push({ class: cls, ...detail, timestamp: new Date().toISOString() });
  console.error(`[FAIL:${cls}] ${detail.message || JSON.stringify(detail)}`);
}

// --- Preflight results (declared at module scope for writeReport access) ---
let preflightResults = {};

async function main() {
  console.log(`[fidelity] XP Fidelity Test — User-Action Conformance`);
  console.log(`[fidelity] source: ${recipe.source}`);
  console.log(`[fidelity] recipe: ${recipe.stats.total_cells} cells, ${recipe.stats.brush_groups} groups, ${recipe.stats.total_actions} actions`);
  console.log('');

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[browser:error] ${msg.text()}`);
  });

  try {
    // ========================================================
    // PHASE 1: TEST SCAFFOLDING (the ONLY part not under test)
    // Uploads the XP via API, then navigates to the workbench
    // with the returned job_id. The existing boot path at
    // workbench.js:6866 calls loadFromJob() which does the
    // full state initialization (cells, geometry, layers,
    // activeLayer=2, btnExport.disabled=false, renderAll, etc).
    //
    // No direct state mutation. No page.evaluate for setup.
    // Everything after this — opening the editor, selecting
    // tools, painting cells, exporting — is under test.
    // ========================================================

    // Step 1: Upload XP via API.
    // upload-xp now creates a minimal job record alongside the session,
    // returning { session_id, job_id, grid_cols, grid_rows, ... }.
    console.log(`[phase:setup] uploading ${path.basename(xpPath)} via upload-xp API`);
    const xpBytes = fs.readFileSync(path.resolve(xpPath));
    const baseUrl = new URL(url).origin;
    const uploadResp = await (async () => {
      const blob = new Blob([xpBytes], { type: 'application/octet-stream' });
      const fd = new FormData();
      fd.append('file', blob, path.basename(xpPath));
      const resp = await fetch(`${baseUrl}/api/workbench/upload-xp`, { method: 'POST', body: fd });
      return resp.json();
    })();

    if (!uploadResp.job_id) {
      fail('ui_blocked', { message: `upload-xp did not return job_id: ${JSON.stringify(uploadResp)}`, phase: 'setup' });
      throw new Error('Cannot proceed without a job_id — is the backend prerequisite applied?');
    }
    const jobId = uploadResp.job_id;
    console.log(`[phase:setup] upload OK: job_id=${jobId}, session_id=${uploadResp.session_id}, ${uploadResp.grid_cols}x${uploadResp.grid_rows}`);

    // Step 2: Navigate to workbench with job_id.
    const loadUrl = `${url}?job_id=${encodeURIComponent(jobId)}`;
    console.log(`[phase:setup] navigating to ${loadUrl}`);
    await page.goto(loadUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Step 3: Wait for loadFromJob() to finish.
    await page.waitForSelector('.frame-cell[data-row][data-col]', { state: 'attached', timeout: 15000 });
    const exportReady = await page.evaluate(() => {
      const btn = document.querySelector('#btnExport');
      return btn && !btn.disabled;
    });
    if (!exportReady) {
      fail('ui_blocked', { message: 'loadFromJob() did not enable #btnExport — session may not have loaded', phase: 'setup' });
      throw new Error('Session load did not complete');
    }
    console.log(`[phase:setup] session loaded via loadFromJob() — frame cells present, export enabled`);

    // ========================================================
    // PHASE 2: PREFLIGHT (validates real DOM controls)
    // This IS part of the conformance test. A selector existing
    // in DOM is not enough — it must be visible, enabled, and
    // actually actionable. For the canvas, we verify that a
    // click changes visible state.
    // ========================================================
    console.log('[phase:preflight] validating DOM controls (visible + enabled + actionable)...');
    let preflightPassed = true;

    for (const [name, selector] of Object.entries(recipe.required_selectors)) {
      const info = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { exists: false, visible: false, enabled: false, actionable: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible = style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0'
          && rect.width > 0 && rect.height > 0;
        const enabled = el.disabled !== true;
        return {
          exists: true,
          visible,
          enabled,
          actionable: visible && enabled,
          tagName: el.tagName,
          type: el.type || null,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        };
      }, selector);

      preflightResults[name] = { selector, ...info };

      if (!info.exists) {
        fail('ui_missing', { message: `${name}: selector "${selector}" not found in DOM`, control: name });
        preflightPassed = false;
      } else if (!info.visible) {
        // inspector_panel is expected to be hidden until opened — special case
        if (name !== 'inspector_panel') {
          fail('ui_blocked', { message: `${name}: "${selector}" exists but is not visible (display/visibility/opacity/size)`, control: name });
          preflightPassed = false;
        }
      } else if (!info.enabled) {
        if (name !== 'export_btn') {
          fail('ui_blocked', { message: `${name}: "${selector}" is visible but disabled`, control: name });
          preflightPassed = false;
        }
      }
    }

    // Special check: frame cells must exist (dynamically created from session data)
    const frameCellCount = await page.evaluate(() =>
      document.querySelectorAll('.frame-cell[data-row][data-col]').length
    );
    preflightResults['frame_cell_count'] = frameCellCount;
    if (frameCellCount === 0) {
      fail('ui_missing', { message: 'No .frame-cell elements found — grid not rendered (session may not have loaded)', control: 'frame_cell' });
      preflightPassed = false;
    }

    // Canvas smoke test: verify that (a) dblclick opens the inspector,
    // and (b) a glyph-tool click on the canvas actually changes pixel data.
    if (preflightPassed && frameCellCount > 0) {
      console.log('[phase:preflight] canvas smoke test — verifying click changes canvas pixels...');
      try {
        // Step 1: Open inspector via dblclick on first frame cell
        await page.dblclick('.frame-cell[data-row="0"][data-col="0"]');
        await page.waitForTimeout(500);

        const panelVisible = await page.evaluate(() => {
          const panel = document.querySelector('#cellInspectorPanel');
          if (!panel) return false;
          const style = window.getComputedStyle(panel);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (!panelVisible) {
          fail('ui_blocked', { message: 'Double-click on frame cell did not open inspector panel — panel remained hidden', control: 'inspector_open' });
          preflightPassed = false;
        } else {
          // Step 2: Select glyph tool
          await page.click('#inspectorToolGlyphBtn');
          await page.waitForTimeout(100);

          // Step 3: Set a known glyph (219 = full block) with white fg
          await page.fill('#inspectorGlyphCode', '219');
          await page.dispatchEvent('#inspectorGlyphCode', 'input');
          await page.evaluate(() => {
            const el = document.querySelector('#inspectorGlyphFgColor');
            if (el) {
              el.value = '#ffffff';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          await page.waitForTimeout(100);

          // Step 4: Read canvas pixel data at cell (0,0) BEFORE click
          const zoom = await page.evaluate(() =>
            parseInt(document.querySelector('#inspectorZoom')?.value || '10', 10)
          );
          const smokePx = Math.floor(zoom / 2);
          const smokePy = Math.floor(zoom / 2);

          const beforePixel = await page.evaluate(({ px, py }) => {
            const c = document.querySelector('#cellInspectorCanvas');
            if (!c) return null;
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(px, py, 1, 1).data;
            return [d[0], d[1], d[2], d[3]];
          }, { px: smokePx, py: smokePy });

          // Step 5: Click canvas at cell (0,0)
          await page.click('#cellInspectorCanvas', { position: { x: smokePx, y: smokePy } });
          await page.waitForTimeout(300);

          // Step 6: Read canvas pixel data AFTER click
          const afterPixel = await page.evaluate(({ px, py }) => {
            const c = document.querySelector('#cellInspectorCanvas');
            if (!c) return null;
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(px, py, 1, 1).data;
            return [d[0], d[1], d[2], d[3]];
          }, { px: smokePx, py: smokePy });

          // Step 7: Verify pixels actually changed
          const pixelsChanged = beforePixel && afterPixel &&
            (beforePixel[0] !== afterPixel[0] ||
             beforePixel[1] !== afterPixel[1] ||
             beforePixel[2] !== afterPixel[2]);

          if (!pixelsChanged) {
            fail('ui_blocked', {
              message: `Canvas click at (${smokePx},${smokePy}) did not change pixel data — UI did not accept the edit. before=${JSON.stringify(beforePixel)} after=${JSON.stringify(afterPixel)}`,
              control: 'canvas_smoke',
            });
            preflightPassed = false;
          }

          preflightResults['canvas_smoke_test'] = {
            passed: !!pixelsChanged,
            inspector_opened: panelVisible,
            before_pixel: beforePixel,
            after_pixel: afterPixel,
            pixels_changed: !!pixelsChanged,
          };
          console.log(`[phase:preflight] canvas smoke test: ${pixelsChanged ? 'PASS' : 'FAIL'} (pixels ${pixelsChanged ? 'changed' : 'unchanged'})`);
        }
      } catch (err) {
        fail('ui_blocked', { message: `Canvas smoke test failed: ${err.message}`, control: 'canvas_smoke' });
        preflightPassed = false;
      }
    }

    console.log(`[phase:preflight] ${Object.keys(preflightResults).length} controls checked`);
    for (const [name, info] of Object.entries(preflightResults)) {
      if (typeof info === 'number') {
        console.log(`  ${name}: ${info}`);
      } else if (info.passed !== undefined) {
        console.log(`  ${name}: ${info.passed ? 'PASS' : 'FAIL'}`);
      } else {
        const status = !info.exists ? 'MISSING' : !info.visible ? 'HIDDEN' : !info.enabled ? 'DISABLED' : 'ok';
        console.log(`  ${name}: ${status} (${info.tagName || '?'})`);
      }
    }

    if (!preflightPassed) {
      console.log('[phase:preflight] FAIL — controls missing, hidden, disabled, or non-actionable');
      writeReport(null, null);
      await browser.close();
      process.exit(1);
    }
    console.log('[phase:preflight] PASS — all controls visible, enabled, and actionable');

    // ========================================================
    // PHASE 3: EXECUTE RECIPE (user-reachable actions only)
    // Every action uses visible DOM controls via Playwright.
    // No __wb_debug. No direct state mutation.
    // ========================================================
    console.log(`[phase:execute] dispatching ${recipe.actions.length} actions...`);
    let actionCount = 0;
    let actionErrors = [];

    for (const action of recipe.actions) {
      try {
        switch (action.action) {
          case 'open_inspector': {
            await page.dblclick(action.selector);
            await page.waitForTimeout(300);
            break;
          }

          case 'wait_visible': {
            await page.waitForSelector(action.selector, {
              state: 'visible',
              timeout: action.timeout_ms || 3000,
            });
            break;
          }

          case 'select_tool': {
            await page.click(action.selector);
            await page.waitForTimeout(100);
            break;
          }

          case 'clear_frame': {
            await page.click(action.selector);
            await page.waitForTimeout(200);
            break;
          }

          case 'set_glyph_code': {
            await page.fill(action.selector, '');
            await page.fill(action.selector, action.value);
            await page.dispatchEvent(action.selector, 'input');
            break;
          }

          case 'set_fg_color':
          case 'set_bg_color': {
            // Color inputs require evaluate to set value + dispatch events.
            // This simulates the user picking a color in the browser's color dialog.
            await page.evaluate(({ selector, value }) => {
              const el = document.querySelector(selector);
              if (el) {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, { selector: action.selector, value: action.value });
            break;
          }

          case 'paint_cell': {
            // Compute pixel coords from cell coords and zoom
            const zoom = await page.evaluate(() => {
              const el = document.querySelector('#inspectorZoom');
              return parseInt(el?.value || '10', 10);
            });
            const px = action.cx * zoom + Math.floor(zoom / 2);
            const py = action.cy * 2 * zoom + Math.floor(zoom / 2);

            // Validate coords are within canvas bounds
            const canvasSize = await page.evaluate(() => {
              const c = document.querySelector('#cellInspectorCanvas');
              return c ? { w: c.width, h: c.height } : null;
            });
            if (!canvasSize || px >= canvasSize.w || py >= canvasSize.h) {
              fail('ui_blocked', {
                message: `Cell (${action.cx},${action.cy}) at px=(${px},${py}) is outside canvas ${canvasSize?.w}x${canvasSize?.h} at zoom=${zoom}`,
                action: 'paint_cell', cx: action.cx, cy: action.cy,
              });
              actionErrors.push({ action, error: 'out of canvas bounds' });
              break;
            }

            await page.click(action.selector, { position: { x: px, y: py } });
            break;
          }

          default:
            fail('ui_missing', { message: `Unknown action type: ${action.action}` });
            actionErrors.push({ action, error: 'unknown action' });
        }

        actionCount++;
        if (actionCount % 500 === 0) {
          process.stdout.write(`[phase:execute] ${actionCount}/${recipe.actions.length} actions\r`);
        }

      } catch (err) {
        fail('ui_blocked', {
          message: `Action "${action.action}" failed: ${err.message}`,
          selector: action.selector, action: action.action,
        });
        actionErrors.push({ action, error: err.message });
      }
    }
    console.log(`[phase:execute] ${actionCount} actions executed (${actionErrors.length} errors)`);

    // ========================================================
    // PHASE 4: VERIFY (export via real button, compare)
    // Clicks the visible Export XP button, reads the result,
    // then compares the exported XP against the oracle truth table.
    // ========================================================
    console.log('[phase:verify] clicking Export XP...');

    const exportEnabled = await page.evaluate(() => {
      const btn = document.querySelector('#btnExport');
      return btn && !btn.disabled;
    });

    if (!exportEnabled) {
      fail('export_missing', { message: 'Export XP button (#btnExport) is missing or disabled' });
      writeReport(null, null);
      await browser.close();
      process.exit(1);
    }

    await page.click('#btnExport');
    await page.waitForTimeout(3000);

    // Read export result from visible #exportOut element
    const exportResult = await page.evaluate(() => {
      const el = document.querySelector('#exportOut');
      try { return JSON.parse(el?.textContent || '{}'); } catch { return null; }
    });

    if (!exportResult || !exportResult.xp_path) {
      fail('export_missing', { message: `Export did not produce xp_path: ${JSON.stringify(exportResult)}` });
      writeReport(exportResult, null);
      await browser.close();
      process.exit(1);
    }

    console.log(`[phase:verify] exported to ${exportResult.xp_path}`);

    // Compare exported XP against truth table by re-reading via the oracle
    const { execSync } = await import('child_process');
    let exportedTruth;
    try {
      const cmd = `python3 "${path.join(__dirname, 'truth_table.py')}" "${exportResult.xp_path}" --output /tmp/xp-fidelity-exported-truth.json`;
      execSync(cmd, { stdio: 'pipe' });
      exportedTruth = JSON.parse(fs.readFileSync('/tmp/xp-fidelity-exported-truth.json', 'utf-8'));
    } catch (err) {
      fail('xp_mismatch', { message: `Failed to read exported XP: ${err.message}` });
      writeReport(exportResult, null);
      await browser.close();
      process.exit(1);
    }

    // Compare layer 2 cells
    const exportedLayer2 = exportedTruth.layers.find(l => l.index === 2);
    if (!exportedLayer2) {
      fail('xp_mismatch', { message: 'Exported XP has no layer 2' });
      writeReport(exportResult, null);
      await browser.close();
      process.exit(1);
    }

    const exportedLookup = {};
    for (const cell of exportedLayer2.cells) {
      exportedLookup[`${cell.x},${cell.y}`] = cell;
    }

    const mismatches = [];
    let matchCount = 0;
    const totalCells = layer2Info.width * layer2Info.height;

    for (let y = 0; y < layer2Info.height; y++) {
      for (let x = 0; x < layer2Info.width; x++) {
        const key = `${x},${y}`;
        const expected = layer2Truth[key];
        const actual = exportedLookup[key];

        if (!actual) {
          mismatches.push({ x, y, expected, actual: null, reason: 'missing_in_export' });
          continue;
        }

        const ok =
          expected.glyph === actual.glyph &&
          expected.fg[0] === actual.fg[0] && expected.fg[1] === actual.fg[1] && expected.fg[2] === actual.fg[2] &&
          expected.bg[0] === actual.bg[0] && expected.bg[1] === actual.bg[1] && expected.bg[2] === actual.bg[2];

        if (ok) {
          matchCount++;
        } else {
          mismatches.push({
            x, y,
            expected: { glyph: expected.glyph, fg: expected.fg, bg: expected.bg },
            actual: { glyph: actual.glyph, fg: actual.fg, bg: actual.bg },
            reason: 'value_mismatch',
          });
        }
      }
    }

    if (mismatches.length > 0) {
      fail('xp_mismatch', {
        message: `${mismatches.length}/${totalCells} cells differ between oracle and export`,
        mismatch_count: mismatches.length,
      });
    }

    writeReport(exportResult, { matchCount, totalCells, mismatches });
    await browser.close();
    const passed = failures.length === 0;
    process.exit(passed ? 0 : 1);

  } catch (err) {
    console.error(`[fidelity] FATAL: ${err.message}`);
    console.error(err.stack);
    writeReport(null, null);
    await browser.close();
    process.exit(2);
  }

  function writeReport(exportResult, comparison) {
    const passed = failures.length === 0;
    const report = {
      verdict: passed ? 'PASS' : 'FAIL',
      failure_count: failures.length,
      failures,
      failure_classes: [...new Set(failures.map(f => f.class))],
      source: recipe.source,
      canvas: recipe.canvas,
      total_cells: layer2Info.width * layer2Info.height,
      skipped_layers: recipe.skipped_layers,
      comparison: comparison ? {
        matched: comparison.matchCount,
        mismatched: comparison.mismatches.length,
        match_pct: ((comparison.matchCount / comparison.totalCells) * 100).toFixed(2) + '%',
        first_mismatches: comparison.mismatches.slice(0, 20),
      } : null,
      export: exportResult ? { xp_path: exportResult.xp_path } : null,
      preflight: preflightResults,
      recipe_stats: recipe.stats,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report, null, 2));

    console.log('');
    console.log(`===== ${report.verdict} =====`);
    if (comparison) {
      console.log(`${comparison.matchCount}/${comparison.totalCells} cells match (${report.comparison.match_pct})`);
    }
    if (failures.length > 0) {
      console.log(`Failure classes: ${report.failure_classes.join(', ')}`);
      console.log(`Failures (${failures.length}):`);
      for (const f of failures.slice(0, 10)) {
        console.log(`  [${f.class}] ${f.message}`);
      }
      if (failures.length > 10) console.log(`  ... and ${failures.length - 10} more`);
    }
    console.log(`Report: ${path.join(outDir, 'result.json')}`);
  }
}

main();
