import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
}

const xpPath = getArg('--xp');
const truthTablePath = getArg('--truth-table');
const recipePath = getArg('--recipe');
const url = getArg('--url', 'http://127.0.0.1:5071/workbench');
const headed = args.includes('--headed');

if (!xpPath || !truthTablePath || !recipePath) {
  console.error('Usage: node run_fidelity_test.mjs --xp <xp> --truth-table <json> --recipe <json> [--url <url>] [--headed]');
  process.exit(1);
}

const truthTable = JSON.parse(fs.readFileSync(truthTablePath, 'utf-8'));
const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf-8'));
const outDir = path.dirname(path.resolve(truthTablePath));

const failures = [];
const report = {
  source_xp: path.resolve(xpPath),
  setup_mode: 'api_scaffold',
  user_reachable_load_pass: false,
  geometry_pass: false,
  execute_pass: false,
  export_pass: false,
  overall_pass: false,
  failures,
};

function fail(cls, message, extra = {}) {
  failures.push({ class: cls, message, ...extra });
  console.error(`[FAIL:${cls}] ${message}`);
}

function parseJsonText(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    fail('json_parse', `${label} was not valid JSON`, { text });
    return null;
  }
}

function runTruthTable(xpFile, outputPath) {
  const result = spawnSync(
    'python3',
    ['scripts/xp_fidelity_test/truth_table.py', xpFile, '--output', outputPath],
    { cwd: repoRoot, encoding: 'utf-8' }
  );
  if (result.status !== 0) {
    throw new Error(`truth_table.py failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
}

function sameRgb(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === 3 && b.length === 3
    && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function compareTruth(expected, actual) {
  const mismatches = [];
  const metaKeys = ['angles', 'projs', 'frame_rows', 'frame_cols', 'frame_w', 'frame_h'];
  for (const key of metaKeys) {
    if ((expected.metadata?.[key] ?? null) !== (actual.metadata?.[key] ?? null)) {
      mismatches.push({ type: 'metadata', key, expected: expected.metadata?.[key], actual: actual.metadata?.[key] });
    }
  }
  const expAnims = JSON.stringify(expected.metadata?.anims || []);
  const actAnims = JSON.stringify(actual.metadata?.anims || []);
  if (expAnims !== actAnims) {
    mismatches.push({ type: 'metadata', key: 'anims', expected: expAnims, actual: actAnims });
  }
  for (const key of ['width', 'height', 'layer_count']) {
    if ((expected[key] ?? null) !== (actual[key] ?? null)) {
      mismatches.push({ type: 'file', key, expected: expected[key], actual: actual[key] });
    }
  }
  const layerCount = Math.max(expected.layers?.length || 0, actual.layers?.length || 0);
  for (let i = 0; i < layerCount; i++) {
    const expLayer = expected.layers?.[i];
    const actLayer = actual.layers?.[i];
    if (!expLayer || !actLayer) {
      mismatches.push({ type: 'layer_missing', layer: i, expected: !!expLayer, actual: !!actLayer });
      continue;
    }
    if (expLayer.width !== actLayer.width || expLayer.height !== actLayer.height) {
      mismatches.push({
        type: 'layer_dims',
        layer: i,
        expected: `${expLayer.width}x${expLayer.height}`,
        actual: `${actLayer.width}x${actLayer.height}`,
      });
      continue;
    }
    const cells = Math.max(expLayer.cells.length, actLayer.cells.length);
    for (let idx = 0; idx < cells; idx++) {
      const expCell = expLayer.cells[idx];
      const actCell = actLayer.cells[idx];
      if (!expCell || !actCell) {
        mismatches.push({ type: 'cell_missing', layer: i, index: idx });
        continue;
      }
      if (
        expCell.glyph !== actCell.glyph ||
        !sameRgb(expCell.fg, actCell.fg) ||
        !sameRgb(expCell.bg, actCell.bg)
      ) {
        mismatches.push({
          type: 'cell',
          layer: i,
          x: expCell.x,
          y: expCell.y,
          expected: expCell,
          actual: actCell,
        });
        if (mismatches.length >= 50) break;
      }
    }
    if (mismatches.length >= 50) break;
  }
  return { ok: mismatches.length === 0, mismatches };
}

async function readSummary(page) {
  const sessionText = await page.locator('#sessionOut').textContent();
  const metaText = await page.locator('#metaOut').textContent();
  return {
    session: sessionText ? parseJsonText(sessionText, 'sessionOut') : null,
    meta: metaText ? parseJsonText(metaText, 'metaOut') : null,
  };
}

async function getZoom(page) {
  const value = await page.locator('#inspectorZoom').inputValue();
  const zoom = Number.parseInt(value || '10', 10);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 10;
}

async function executeRecipe(page) {
  for (const action of recipe.actions || []) {
    switch (action.action) {
      case 'wait_visible':
        await page.waitForSelector(action.selector, { state: 'visible', timeout: action.timeout_ms || 5000 });
        break;
      case 'open_frame':
        await page.dblclick(action.selector);
        break;
      case 'select_layer':
        await page.selectOption(action.selector, action.value);
        break;
      case 'select_tool':
        await page.click(action.selector);
        break;
      case 'clear_frame':
        await page.click(action.selector);
        break;
      case 'set_glyph_code':
      case 'set_fg_color':
      case 'set_bg_color':
        await page.fill(action.selector, action.value);
        break;
      case 'paint_cell': {
        const zoom = await getZoom(page);
        const x = Math.floor((action.cx * zoom) + (zoom / 2));
        const y = Math.floor((action.cy * zoom * 2) + (zoom / 2));
        await page.click(action.selector, { position: { x, y } });
        break;
      }
      default:
        fail('unknown_action', `Unknown recipe action: ${action.action}`);
        return false;
    }
  }
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({ acceptDownloads: true });

  try {
    fail(
      'ui_gap',
      'Shipped workbench has no user-reachable XP import control; using /api/workbench/upload-xp as scaffolding',
      { required_gate: 'existing_xp_load_user_reachability' }
    );

    const xpBytes = fs.readFileSync(path.resolve(xpPath));
    const fd = new FormData();
    fd.append('file', new Blob([xpBytes], { type: 'application/octet-stream' }), path.basename(xpPath));
    const uploadResp = await fetch(`${new URL(url).origin}/api/workbench/upload-xp`, {
      method: 'POST',
      body: fd,
    });
    const uploadJson = await uploadResp.json();
    if (!uploadResp.ok || !uploadJson.job_id) {
      fail('setup_upload', 'workbench upload-xp failed', { response: uploadJson });
      throw new Error('upload-xp failed');
    }
    report.setup = uploadJson;

    await page.goto(`${url}?job_id=${encodeURIComponent(uploadJson.job_id)}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#sessionOut', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('.frame-cell[data-row][data-col]', { state: 'attached', timeout: 10000 });

    for (const [name, selector] of Object.entries(recipe.required_selectors || {})) {
      const count = await page.locator(selector).count();
      if (count <= 0) {
        fail('ui_missing', `Missing selector ${name}: ${selector}`);
      }
    }

    const summary = await readSummary(page);
    report.live_session = summary.session;
    report.live_meta = summary.meta;
    const expected = recipe.geometry;
    const actual = summary.session || {};
    const actualMeta = summary.meta || {};

    if (!summary.session || !summary.meta) {
      throw new Error('session/meta summary missing');
    }

    const expectedFrameCount = expected.frame_rows * expected.frame_cols;
    const actualFrameCount = await page.locator('.frame-cell[data-row][data-col]').count();
    if (actualFrameCount !== expectedFrameCount) {
      fail('geometry', `Frame cell count mismatch: expected ${expectedFrameCount}, got ${actualFrameCount}`);
    }
    if (actual.angles !== expected.angles) fail('geometry', `angles mismatch: expected ${expected.angles}, got ${actual.angles}`);
    if (JSON.stringify(actual.anims || []) !== JSON.stringify(expected.anims || [])) {
      fail('geometry', `anims mismatch: expected ${JSON.stringify(expected.anims)}, got ${JSON.stringify(actual.anims)}`);
    }
    if (actual.projs !== expected.projs) fail('geometry', `projs mismatch: expected ${expected.projs}, got ${actual.projs}`);
    if (actualMeta.frame_w_chars !== expected.frame_w) fail('geometry', `frame_w mismatch: expected ${expected.frame_w}, got ${actualMeta.frame_w_chars}`);
    if (actualMeta.frame_h_chars !== expected.frame_h) fail('geometry', `frame_h mismatch: expected ${expected.frame_h}, got ${actualMeta.frame_h_chars}`);

    report.geometry_pass = !failures.some((f) => f.class === 'geometry');
    if (report.geometry_pass) {
      report.execute_pass = await executeRecipe(page);
    }

    await page.click('#btnExport');
    await page.waitForTimeout(1000);
    const exportText = await page.locator('#exportOut').textContent();
    const exportJson = exportText ? parseJsonText(exportText, 'exportOut') : null;
    report.export = exportJson;
    if (!exportJson?.xp_path) {
      fail('export', 'Export did not return xp_path');
    } else {
      const exportedTruthPath = path.join(outDir, 'exported-truth-table.json');
      const exportedTruth = runTruthTable(exportJson.xp_path, exportedTruthPath);
      const comparison = compareTruth(truthTable, exportedTruth);
      report.export_compare = {
        ok: comparison.ok,
        mismatch_count: comparison.mismatches.length,
        mismatches: comparison.mismatches.slice(0, 20),
      };
      if (!comparison.ok) {
        fail('export_compare', `Exported XP mismatched source XP (${comparison.mismatches.length} mismatches)`);
      } else {
        report.export_pass = true;
      }
    }
  } catch (err) {
    fail('fatal', err instanceof Error ? err.message : String(err));
  } finally {
    report.overall_pass = failures.length === 0;
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  process.exit(report.overall_pass ? 0 : 1);
}

main();
