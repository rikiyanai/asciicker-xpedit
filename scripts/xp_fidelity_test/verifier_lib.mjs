/**
 * verifier_lib.mjs — Shared infrastructure for all M2 verifier slices.
 *
 * Provides:
 *  - CLI argument parsing (getArg, hasFlag)
 *  - Base-path-aware URL resolution (resolveRoute, resolveWorkbenchUrl)
 *  - Browser launch helpers (launchBrowser, openWorkbench)
 *  - State capture (captureState — reads getState() with P1/P2 fields)
 *  - Failure tracking (createReport, fail, writeReport)
 *  - Artifact writing (writeArtifact, writeJsonArtifact)
 *  - Frame signature helpers (readFrameSignature, readFrameCell)
 *
 * Usage:
 *   import { parseArgs, launchBrowser, captureState, createReport, fail, writeReport } from './verifier_lib.mjs';
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// A. CLI argument parsing
// ---------------------------------------------------------------------------

const __dirname_lib = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname_lib, '..', '..');

/**
 * Parse CLI args from process.argv.slice(2).
 * Returns { getArg, hasFlag, args, repoRoot }.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  function getArg(name, fallback = null) {
    const idx = argv.indexOf(name);
    return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : fallback;
  }
  function hasFlag(name) {
    return argv.includes(name);
  }
  return { getArg, hasFlag, args: argv, repoRoot: REPO_ROOT };
}

// ---------------------------------------------------------------------------
// B. Base-path-aware URL resolution
// ---------------------------------------------------------------------------

const DEFAULT_WORKBENCH_URL = process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench';

/**
 * Resolve a route path relative to a base workbench URL.
 * Strips the last pathname segment from baseUrl and appends routePath.
 *
 *   resolveRoute("http://host/xpedit/workbench", "/wizard") → "http://host/xpedit/wizard"
 *   resolveRoute("http://host/workbench", "/wizard")        → "http://host/wizard"
 */
export function resolveRoute(baseUrl, routePath) {
  const u = new URL(String(baseUrl));
  const prefix = u.pathname.replace(/\/[^/]*$/, '');
  u.pathname = prefix + routePath;
  u.search = '';
  return u.toString();
}

/**
 * Get the workbench URL from CLI args or env, with base-path support.
 * Accepts --url <url> flag. Falls back to WORKBENCH_URL env or default.
 */
export function resolveWorkbenchUrl(cliArgs) {
  const { getArg } = cliArgs;
  return getArg('--url', DEFAULT_WORKBENCH_URL);
}

/**
 * Extract the hosting mode label from a URL for artifact tagging.
 *   "http://host/workbench" → "root"
 *   "http://host/xpedit/workbench" → "prefixed"
 */
export function hostingModeTag(workbenchUrl) {
  try {
    const u = new URL(workbenchUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    return segments.length > 1 ? 'prefixed' : 'root';
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// C. Browser launch helpers
// ---------------------------------------------------------------------------

/**
 * Launch a Playwright Chromium browser.
 * @param {object} opts
 * @param {boolean} opts.headed — visible browser window
 * @param {number} opts.timeout — default navigation timeout (ms)
 * @returns {Promise<{browser, context, page}>}
 */
export async function launchBrowser({ headed = false, timeout = 30000 } = {}) {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  context.setDefaultTimeout(timeout);
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Navigate to the workbench URL and wait for it to be ready.
 * @param {import('playwright').Page} page
 * @param {string} workbenchUrl
 * @param {object} opts
 * @param {number} opts.waitMs — extra wait after load (ms)
 * @returns {Promise<void>}
 */
export async function openWorkbench(page, workbenchUrl, { waitMs = 1500 } = {}) {
  await page.goto(workbenchUrl, { waitUntil: 'networkidle' });
  if (waitMs > 0) await page.waitForTimeout(waitMs);
}

// ---------------------------------------------------------------------------
// D. State capture (reads getState() with P1/P2 fields)
// ---------------------------------------------------------------------------

/**
 * Capture the full verifier-relevant state from the workbench page.
 * Uses __wb_debug.getState() which now includes P1 and P2 fields.
 *
 * @param {import('playwright').Page} page
 * @param {string} label — human-readable label for this snapshot
 * @returns {Promise<object>} state snapshot
 */
export async function captureState(page, label = '') {
  return page.evaluate((lbl) => {
    const gs = (window.__wb_debug && typeof window.__wb_debug.getState === 'function')
      ? window.__wb_debug.getState() : null;
    const wse = (window.__wholeSheetEditor && typeof window.__wholeSheetEditor.getState === 'function')
      ? window.__wholeSheetEditor.getState() : null;

    return {
      label: lbl,
      timestamp: Date.now(),
      // From getState() — includes P1 and P2 fields
      ...(gs || {}),
      // Whole-sheet editor state (separate surface)
      wholeSheet: wse || null,
      // DOM-derived
      wholeSheetMounted: !!document.getElementById('wholeSheetCanvas'),
    };
  }, label);
}

/**
 * Read a single frame's signature hash.
 * @param {import('playwright').Page} page
 * @param {number} row
 * @param {number} col
 * @returns {Promise<string>}
 */
export async function readFrameSignature(page, row, col) {
  return page.evaluate(([r, c]) => {
    return window.__wb_debug?.frameSignature?.(r, c) ?? '';
  }, [row, col]);
}

/**
 * Read a single cell from a frame.
 * @param {import('playwright').Page} page
 * @param {number} row
 * @param {number} col
 * @param {number} cx — cell x within frame
 * @param {number} cy — cell y within frame
 * @returns {Promise<object|null>}
 */
export async function readFrameCell(page, row, col, cx, cy) {
  return page.evaluate(([r, c, x, y]) => {
    return window.__wb_debug?.readFrameCell?.(r, c, x, y) ?? null;
  }, [row, col, cx, cy]);
}

// ---------------------------------------------------------------------------
// E. Failure tracking and reporting
// ---------------------------------------------------------------------------

/**
 * Create a new report object for a verifier run.
 * @param {string} sliceName — e.g. 'structural_baseline', 'source_panel_contract'
 * @param {object} opts — additional report fields
 * @returns {object} report with failures array and helper methods
 */
export function createReport(sliceName, opts = {}) {
  const failures = [];
  const report = {
    slice: sliceName,
    hosting_mode: opts.hostingMode || 'unknown',
    workbench_url: opts.workbenchUrl || '',
    started_at: new Date().toISOString(),
    overall_pass: false,
    failures,
    ...opts,
  };

  return {
    report,
    failures,
    /**
     * Record a failure.
     * @param {string} cls — failure class (e.g. 'geometry', 'cell_fidelity')
     * @param {string} message
     * @param {object} extra — additional structured data
     */
    fail(cls, message, extra = {}) {
      failures.push({ class: cls, message, timestamp: new Date().toISOString(), ...extra });
      console.error(`[FAIL:${cls}] ${message}`);
    },
  };
}

/**
 * Write the final report JSON to disk.
 * @param {string} outDir — output directory
 * @param {string} filename — e.g. 'report.json'
 * @param {object} report
 */
export function writeReport(outDir, filename, report) {
  report.finished_at = new Date().toISOString();
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, filename);
  fs.writeFileSync(p, JSON.stringify(report, null, 2));
  console.log(`[REPORT] ${p}`);
  return p;
}

// ---------------------------------------------------------------------------
// F. Artifact helpers
// ---------------------------------------------------------------------------

/**
 * Write a text artifact to the output directory.
 */
export function writeArtifact(outDir, filename, content) {
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, filename);
  fs.writeFileSync(p, content);
  return p;
}

/**
 * Write a JSON artifact to the output directory.
 */
export function writeJsonArtifact(outDir, filename, data) {
  return writeArtifact(outDir, filename, JSON.stringify(data, null, 2));
}

/**
 * Take a screenshot and save it to the output directory.
 * @param {import('playwright').Page} page
 * @param {string} outDir
 * @param {string} name — filename without extension
 * @returns {Promise<string>} path to screenshot
 */
export async function screenshot(page, outDir, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

// ---------------------------------------------------------------------------
// G. JSON parsing helper
// ---------------------------------------------------------------------------

/**
 * Safely parse JSON text, recording a failure if invalid.
 * @param {string} text
 * @param {string} label — description for error messages
 * @param {function} failFn — fail() from createReport
 * @returns {object|null}
 */
export function parseJsonSafe(text, label, failFn) {
  try {
    return JSON.parse(text);
  } catch (err) {
    if (failFn) failFn('json_parse', `${label} was not valid JSON`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// H. Convenience: standard verifier setup
// ---------------------------------------------------------------------------

/**
 * Standard verifier bootstrap: parse args, resolve URL, launch browser, open workbench.
 *
 * Usage:
 *   const { page, browser, report, fail, workbenchUrl, outDir, cliArgs } = await setupVerifier('my_slice', { requireOutDir: true });
 *   // ... run verifier logic ...
 *   writeReport(outDir, 'report.json', report);
 *   await browser.close();
 *
 * @param {string} sliceName
 * @param {object} opts
 * @param {boolean} opts.requireOutDir — exit if --out-dir not provided
 * @param {boolean} opts.openPage — navigate to workbench URL (default true)
 * @returns {Promise<object>}
 */
export async function setupVerifier(sliceName, { requireOutDir = false, openPage = true } = {}) {
  const cliArgs = parseArgs();
  const workbenchUrl = resolveWorkbenchUrl(cliArgs);
  const headed = cliArgs.hasFlag('--headed');
  const outDir = cliArgs.getArg('--out-dir', `output/${sliceName}`);

  if (requireOutDir && !cliArgs.getArg('--out-dir')) {
    console.error(`Missing --out-dir for ${sliceName}`);
    process.exit(1);
  }

  const { report, failures, fail: failFn } = createReport(sliceName, {
    hostingMode: hostingModeTag(workbenchUrl),
    workbenchUrl,
  });

  const { browser, context, page } = await launchBrowser({ headed });

  if (openPage) {
    await openWorkbench(page, workbenchUrl);
  }

  return {
    page,
    browser,
    context,
    report,
    failures,
    fail: failFn,
    workbenchUrl,
    outDir,
    cliArgs,
    headed,
    resolveRoute: (routePath) => resolveRoute(workbenchUrl, routePath),
  };
}
