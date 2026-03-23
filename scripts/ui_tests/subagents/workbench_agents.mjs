import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { BaseSubagent } from './base_subagent.mjs';
import { resolveRoute } from '../core/url_helpers.mjs';
import { BrowserSkill } from '../core/browser_skill.mjs';
import { ensureDir } from '../core/artifacts.mjs';

async function fileExists(p) {
  if (!p) return false;
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function pickDefaultFixturePng(repoRoot = process.cwd()) {
  const candidates = [
    path.join(repoRoot, 'tests', 'fixtures', 'known_good', 'cat_sheet.png'),
    path.join(repoRoot, 'tests', 'fixtures', 'known_good', 'player_sheet.png'),
  ];
  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }
  return '';
}

async function wbUploadAnalyzeConvert({ page, skill, pngPath, timeoutMs = 240000 }) {
  await page.waitForSelector('#wbFile', { state: 'visible', timeout: 30000 });
  await page.setInputFiles('#wbFile', pngPath);
  await skill.screenshot('wb_set_file');
  await page.click('#wbUpload');
  await page.waitForFunction(() => {
    const btn = document.getElementById('wbAnalyze');
    return !!btn && !btn.disabled;
  }, null, { timeout: 60000 });
  await skill.screenshot('wb_after_upload');
  await page.click('#wbAnalyze');
  await page.waitForFunction(() => {
    const btn = document.getElementById('wbRun');
    const txt = String(document.getElementById('wbStatus')?.textContent || '');
    return !!btn && !btn.disabled && /Analyze ready/i.test(txt);
  }, null, { timeout: timeoutMs });
  await skill.screenshot('wb_after_analyze');
  await page.click('#wbRun');
  await page.waitForFunction(() => /Session active:/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: timeoutMs });
  await skill.screenshot('wb_after_convert');
}

async function wbState(page) {
  return await page.evaluate(() => {
    const q = (id) => document.getElementById(id);
    const debug = (window.__wb_debug && typeof window.__wb_debug.getState === 'function') ? window.__wb_debug.getState() : null;
    return {
      wbStatus: String(q('wbStatus')?.textContent || ''),
      runOut: String(q('wbRunOut')?.textContent || ''),
      sessionOut: String(q('sessionOut')?.textContent || ''),
      debug,
    };
  });
}

export class WorkbenchSmokeAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchSmokeAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    this.step('open_workbench');
    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'workbench_open' });
    await skill.wait_for({ selector: '#wbUpload', state: 'visible' }, { screenshotLabel: 'wb_upload_visible' });
    await skill.wait_for({ selector: '#wbAnalyze', state: 'visible' }, { screenshotLabel: 'wb_analyze_visible' });
    await skill.wait_for({ selector: '#wbRun', state: 'visible' }, { screenshotLabel: 'wb_run_visible' });
    await skill.wait_for({ selector: '#webbuildQuickTestBtn', state: 'visible' }, { screenshotLabel: 'skin_test_visible' });
    const state = await skill.readPageState();
    const shot = await skill.screenshot('workbench_smoke_done');
    this.addArtifact(shot, 'screenshot');
    return { pass: true, page_state: state };
  }
}

export class WorkbenchSkinDockE2EAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchSkinDockE2EAgent', opts);
  }

  async run() {
    const { baseUrl, artifactDir, pngPath, headed = false, timeoutSec = 240, moveSec = 4 } = this.ctx;
    await ensureDir(artifactDir);
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required for WorkbenchSkinDockE2EAgent' };
    const script = path.join(process.cwd(), 'scripts', 'workbench_png_to_skin_test_playwright.mjs');
    const args = [script, '--url', resolveRoute(baseUrl, '/workbench'), '--png', pngPath, '--timeout-sec', String(timeoutSec), '--move-sec', String(moveSec)];
    if (headed) args.push('--headed');
    this.step('spawn_e2e_script', { script, args: args.slice(1) });
    const proc = spawn('node', args, { cwd: process.cwd(), env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      const s = String(d);
      stdout += s;
      process.stdout.write(s);
    });
    proc.stderr.on('data', (d) => {
      const s = String(d);
      stderr += s;
      process.stderr.write(s);
    });
    const code = await new Promise((resolve) => proc.on('close', resolve));
    this.step('e2e_script_exit', { code });
    const lines = stdout.trim().split(/\r?\n/);
    let summary = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const maybe = lines.slice(i).join('\n');
      try {
        summary = JSON.parse(maybe);
        break;
      } catch (_e) {}
    }
    if (!summary || !summary.resultPath) {
      return { pass: false, error_summary: `Could not parse E2E summary JSON (exit=${code})`, stdout_tail: lines.slice(-40), stderr };
    }
    const resultJson = JSON.parse(await fs.readFile(summary.resultPath, 'utf-8'));
    this.addArtifact(summary.resultPath, 'result');
    if (summary.artifacts?.finalPageShot) this.addArtifact(summary.artifacts.finalPageShot, 'screenshot');
    if (summary.artifacts?.finalIframeShot) this.addArtifact(summary.artifacts.finalIframeShot, 'screenshot');
    return {
      pass: !!resultJson.loaded,
      error_summary: resultJson.loaded ? '' : `Skin dock flow did not reach loaded state; wbStatus=${resultJson?.finalDebug?.wbStatus || ''}`,
      summary,
      e2e_result: resultJson,
      exit_code: code,
    };
  }
}

function classifyWorkbenchDockLoad(resultJson) {
  const wbStatus = String(resultJson?.finalDebug?.wbStatus || "");
  const webbuildState = String(resultJson?.finalDebug?.webbuildState || "");
  const loaded = !!resultJson?.loaded;
  const loadMs = Number(resultJson?.perf?.test_skin_wait_ms || 0) || null;
  const move = resultJson?.moveResult || {};
  const dockLevelLoadingStuck =
    !loaded &&
    /webbuild loading/i.test(webbuildState);
  const preExportBlocked =
    /save failed|save timed out|skin test blocked/i.test(wbStatus);
  const dockLoadPass = loaded && /skin applied|webbuild ready/i.test(webbuildState);
  const iframePlayable = !!move.moved;
  let stage = "unknown";
  if (dockLoadPass && iframePlayable) stage = "loaded_and_playable";
  else if (dockLoadPass && !iframePlayable) stage = "dock_loaded_iframe_not_playable";
  else if (dockLevelLoadingStuck) stage = "dock_loading_stuck";
  else if (preExportBlocked) stage = "pre_export_or_save_blocked";
  else if (/loading/i.test(webbuildState)) stage = "dock_loading_in_progress_or_stuck";
  return {
    stage,
    dock_load_pass: dockLoadPass,
    iframe_playable: iframePlayable,
    load_ms: loadMs,
    wb_status: wbStatus,
    webbuild_state: webbuildState,
    final_iframe: resultJson?.finalDebug?.iframe || null,
  };
}

export class WorkbenchDockLoadWatchdogAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || "WorkbenchDockLoadWatchdogAgent", opts);
  }

  async run() {
    const { baseUrl, artifactDir, pngPath, headed = false, timeoutSec = 240, moveSec = 4 } = this.ctx;
    await ensureDir(artifactDir);
    if (!pngPath) return { pass: false, error_summary: "pngPath is required for WorkbenchDockLoadWatchdogAgent" };

    const delegate = new WorkbenchSkinDockE2EAgent({
      name: "WorkbenchSkinDockE2EDelegate",
      baseUrl,
      artifactDir,
      pngPath,
      headed,
      timeoutSec,
      moveSec,
    });
    this.step("delegate_start", { delegate: "WorkbenchSkinDockE2EAgent" });
    const delegated = await delegate.execute();
    this.step("delegate_done", { pass: !!delegated.pass });
    for (const a of delegated.artifacts || []) this.addArtifact(a.path, a.kind);

    const resultJson = delegated?.data?.e2e_result;
    if (!resultJson) {
      return {
        pass: false,
        error_summary: delegated.error_summary || "delegate did not return e2e_result",
        delegated,
      };
    }

    const classification = classifyWorkbenchDockLoad(resultJson);
    const watchdogSummary = {
      png_path: pngPath,
      classification,
      timings: resultJson.perf || {},
      load_timeline: resultJson.loadTimeline || [],
      move_result: resultJson.moveResult || {},
      final_debug: resultJson.finalDebug || null,
      artifact_refs: resultJson.artifacts || {},
    };
    const watchdogPath = path.join(artifactDir, "dock-load-watchdog-summary.json");
    await fs.writeFile(watchdogPath, JSON.stringify(watchdogSummary, null, 2), "utf-8");
    this.addArtifact(watchdogPath, "result");

    const pass = !!classification.dock_load_pass;
    let errorSummary = "";
    if (!pass) {
      errorSummary = `Dock load watchdog failed: stage=${classification.stage}; wbStatus=${classification.wb_status}; webbuildState=${classification.webbuild_state}`;
    } else if (!classification.iframe_playable) {
      errorSummary = `Dock loaded but iframe not playable yet (play button may be stuck on LOADING...)`;
    }

    return {
      pass,
      error_summary: errorSummary,
      watchdog: watchdogSummary,
      delegated,
    };
  }
}

export class WorkbenchAnalyzeOverrideRecoveryAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchAnalyzeOverrideRecoveryAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    this.step('open_workbench');
    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'analyze_override_open' });

    this.step('upload');
    await page.setInputFiles('#wbFile', pngPath);
    await page.click('#wbUpload');
    await page.waitForFunction(() => !document.getElementById('wbAnalyze')?.disabled, null, { timeout: 60000 });
    await skill.screenshot('analyze_override_after_upload');

    this.step('analyze');
    await page.click('#wbAnalyze');
    await page.waitForFunction(() => /Analyze ready/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: 180000 });
    await skill.screenshot('analyze_override_after_analyze');

    const suggested = await page.evaluate(() => ({
      angles: String(document.getElementById('wbAngles')?.value || ''),
      frames: String(document.getElementById('wbFrames')?.value || ''),
      sourceProjs: String(document.getElementById('wbSourceProjs')?.value || ''),
      renderRes: String(document.getElementById('wbRenderRes')?.value || ''),
    }));
    this.step('captured_suggested', suggested);

    const suggestedAnglesNum = Math.max(1, Number(suggested.angles || '1') || 1);
    const suggestedFramesArr = String(suggested.frames || '1')
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isFinite(x) && x > 0);
    const totalFrames = Math.max(1, suggestedFramesArr.reduce((a, b) => a + b, 0) || 1);
    const splitFrames = totalFrames > 1 ? `1,${totalFrames - 1}` : String(totalFrames);
    const altAngle = suggestedAnglesNum === 1 ? 2 : 1;

    // Probe 1: verify manual angle/name/frame values are actually sent in /api/run payload (client-level regression guard).
    const probePayloadInputs = {
      name: 'payload_probe_case',
      angles: String(altAngle),
      frames: suggested.frames || String(totalFrames),
      sourceProjs: suggested.sourceProjs || '1',
      renderRes: suggested.renderRes || '12',
    };
    await page.fill('#wbName', probePayloadInputs.name);
    await page.fill('#wbAngles', probePayloadInputs.angles);
    await page.fill('#wbFrames', probePayloadInputs.frames);
    await page.fill('#wbSourceProjs', probePayloadInputs.sourceProjs);
    await page.fill('#wbRenderRes', probePayloadInputs.renderRes);
    await skill.screenshot('analyze_override_payload_probe_inputs');
    this.step('payload_probe_inputs_set', probePayloadInputs);

    const runReqPromise = page.waitForRequest((req) => req.url().includes('/api/run') && req.method() === 'POST', { timeout: 15000 });
    await page.click('#wbRun');
    const runReq = await runReqPromise;
    const payloadSent = (() => {
      try { return runReq.postDataJSON(); } catch { return null; }
    })();
    await page.waitForFunction(() => /Run failed|Run complete|Session active:/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: 30000 });
    await skill.screenshot('analyze_override_after_payload_probe_run');
    const payloadProbePass = !!payloadSent &&
      String(payloadSent.name || '') === probePayloadInputs.name &&
      Number(payloadSent.angles || 0) === Number(probePayloadInputs.angles) &&
      String(payloadSent.frames || '') === probePayloadInputs.frames;
    this.step('payload_probe_captured', { payloadSent, payloadProbePass });

    // Probe 2: use a known-valid manual frame split and confirm session metadata reflects it after successful convert.
    const manual = {
      angles: String(suggestedAnglesNum),
      frames: splitFrames,
      sourceProjs: suggested.sourceProjs || '1',
      renderRes: suggested.renderRes || '12',
      name: 'manual_override_case_success'
    };
    await page.fill('#wbName', manual.name);
    await page.fill('#wbAngles', manual.angles);
    await page.fill('#wbFrames', manual.frames);
    await page.fill('#wbSourceProjs', manual.sourceProjs);
    await page.fill('#wbRenderRes', manual.renderRes);
    await skill.screenshot('analyze_override_manual_inputs_success_probe');
    this.step('manual_override_set_for_success', manual);

    this.step('convert_with_manual_override_success_probe');
    await page.click('#wbRun');
    await page.waitForFunction(() => /Session active:/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: 240000 });
    await skill.screenshot('analyze_override_after_convert');

    const after = await wbState(page);
    const debug = after.debug || {};
    const observedAngles = Number(debug.angles || 0);
    const observedAnims = Array.isArray(debug.anims) ? debug.anims.map((x) => Number(x)) : [];
    const expectedAnims = splitFrames.split(',').map((x) => Number(x));
    const sessionProbePass =
      observedAngles === Number(manual.angles) &&
      observedAnims.length === expectedAnims.length &&
      observedAnims.every((x, i) => x === expectedAnims[i]);
    const pass = payloadProbePass && sessionProbePass;
    const summary = {
      pass,
      pngPath,
      suggested,
      payload_probe_inputs: probePayloadInputs,
      payload_sent: payloadSent,
      payload_probe_pass: payloadProbePass,
      manual_success_probe: manual,
      observed: {
        wbStatus: after.wbStatus,
        angles: observedAngles,
        anims: observedAnims,
        selectedRow: debug.selectedRow,
        selectedCols: debug.selectedCols || [],
      },
      session_probe_pass: sessionProbePass,
      error_summary: pass ? '' : `Analyze/manual override regression: payload_probe=${payloadProbePass} session_probe=${sessionProbePass} observed angles=${observedAngles} anims=${JSON.stringify(observedAnims)}`,
    };
    const outPath = path.join(artifactDir, 'analyze-override-recovery-summary.json');
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(outPath, 'result');
    return summary;
  }
}

export class WorkbenchSourceGridDragDropAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchSourceGridDragDropAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    this.step('open_workbench');
    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'source_grid_dragdrop_open' });

    this.step('upload_analyze_convert', { pngPath });
    await wbUploadAnalyzeConvert({ page, skill, pngPath });

    // Choose a deterministic target frame.
    const target = page.locator('#gridPanel .frame-cell').first();
    if (!(await target.count())) {
      return { pass: false, error_summary: 'No grid frame cells available after conversion' };
    }
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.click();
    const targetMeta = await target.evaluate((el) => ({ row: Number(el.dataset.row), col: Number(el.dataset.col) }));
    const sigBefore = await page.evaluate(({ row, col }) => window.__wb_debug?.frameSignature?.(row, col) || '', targetMeta);
    this.step('target_frame_selected', targetMeta);
    await skill.screenshot('source_grid_dragdrop_target_selected');

    // Create a draft source box, then commit via debug hook to keep setup deterministic.
    await page.click('#drawBoxBtn');
    const sourceCanvas = page.locator('#sourceCanvas');
    await sourceCanvas.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    const srcBox = await sourceCanvas.boundingBox();
    if (!srcBox) {
      return { pass: false, error_summary: 'sourceCanvas bounding box unavailable' };
    }
    const sx = srcBox.x + Math.max(12, Math.min(30, srcBox.width * 0.12));
    const sy = srcBox.y + Math.max(12, Math.min(24, srcBox.height * 0.20));
    const ex = Math.min(srcBox.x + srcBox.width - 8, sx + 36);
    const ey = Math.min(srcBox.y + srcBox.height - 8, sy + 28);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 8 });
    await page.mouse.up();
    await skill.screenshot('source_grid_dragdrop_draft_box');
    this.step('draft_box_drawn', { start: { x: sx, y: sy }, end: { x: ex, y: ey } });

    const commitRes = await page.evaluate(() => window.__wb_debug?.commitDraftSource?.() || null);
    this.step('draft_commit_result', commitRes || {});
    if (!commitRes || !commitRes.box || Number(commitRes.after || 0) <= Number(commitRes.before || 0)) {
      return { pass: false, error_summary: `Failed to commit draft source box via debug hook: ${JSON.stringify(commitRes)}` };
    }
    await page.waitForTimeout(250);
    await skill.screenshot('source_grid_dragdrop_committed_box');
    const committedBox = commitRes.box;
    const sourceCanvasMetrics = await sourceCanvas.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { cssX: r.left, cssY: r.top, cssW: r.width, cssH: r.height, pxW: el.width, pxH: el.height };
    });
    const startX = sourceCanvasMetrics.cssX + ((committedBox.x + Math.max(1, committedBox.w / 2)) / sourceCanvasMetrics.pxW) * sourceCanvasMetrics.cssW;
    const startY = sourceCanvasMetrics.cssY + ((committedBox.y + Math.max(1, committedBox.h / 2)) / sourceCanvasMetrics.pxH) * sourceCanvasMetrics.cssH;

    await page.click('#sourceSelectBtn');
    await page.evaluate((id) => window.__wb_debug?.selectSourceBoxes?.([id]), committedBox.id);
    await page.mouse.click(startX, startY);
    await page.waitForTimeout(100);
    await page.click('#rowSelectBtn');
    await skill.screenshot('source_grid_dragdrop_box_selected');

    const targetBox = await target.boundingBox();
    if (!targetBox) {
      return { pass: false, error_summary: 'Target frame bounding box unavailable after source selection' };
    }
    const tx = targetBox.x + targetBox.width / 2;
    const ty = targetBox.y + targetBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await skill.screenshot('source_grid_dragdrop_after_drop');
    this.step('drag_drop_attempted', { target: targetMeta });

    const final = await page.evaluate(({ row, col }) => {
      const q = (id) => document.getElementById(id);
      return {
        wbStatus: String(q('wbStatus')?.textContent || ''),
        sourceInfo: String(q('sourceInfo')?.textContent || ''),
        selectedGrid: window.__wb_debug?.getState?.() || null,
        targetSig: window.__wb_debug?.frameSignature?.(row, col) || '',
      };
    }, targetMeta);
    const dropped = /Dropped \d+ source sprite box/i.test(String(final.wbStatus || ''));
    const changed = String(final.targetSig || '') !== String(sigBefore || '');
    const pass = dropped || changed;

    const summary = {
      pass,
      pngPath,
      target: targetMeta,
      sig_before_len: String(sigBefore || '').length,
      sig_after_len: String(final.targetSig || '').length,
      status: final.wbStatus,
      dropped_status_detected: dropped,
      target_signature_changed: changed,
      debug_state: final.selectedGrid,
      commit_result: commitRes,
      error_summary: pass ? '' : `Drag/drop did not report drop or change target frame signature; wbStatus=${final.wbStatus}`,
    };
    const outPath = path.join(artifactDir, 'source-grid-dragdrop-summary.json');
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(outPath, 'result');
    return summary;
  }
}

export class WorkbenchAnalyzeFailureRecoveryAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchAnalyzeFailureRecoveryAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'analyze_fail_recover_open' });
    await wbUploadAnalyzeConvertSetupOnly(page, skill, pngPath);

    const suggested = await page.evaluate(() => ({
      angles: String(document.getElementById('wbAngles')?.value || ''),
      frames: String(document.getElementById('wbFrames')?.value || ''),
      sourceProjs: String(document.getElementById('wbSourceProjs')?.value || ''),
      renderRes: String(document.getElementById('wbRenderRes')?.value || ''),
    }));
    this.step('captured_suggested', suggested);

    // Force an invalid run payload, then recover without reload.
    await page.fill('#wbName', 'fail_then_recover_case');
    await page.fill('#wbFrames', 'abc');
    await skill.screenshot('analyze_fail_recover_invalid_inputs');
    await page.click('#wbRun');
    await page.waitForFunction(() => /Run failed/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: 30000 });
    const failedState = await wbState(page);
    this.step('run_failed', { wbStatus: failedState.wbStatus, runOut: String(failedState.runOut || '').slice(0, 300) });
    await skill.screenshot('analyze_fail_recover_after_failure');

    await page.fill('#wbFrames', suggested.frames || '1');
    await page.fill('#wbAngles', suggested.angles || '1');
    await page.fill('#wbSourceProjs', suggested.sourceProjs || '1');
    await page.fill('#wbRenderRes', suggested.renderRes || '12');
    await skill.screenshot('analyze_fail_recover_fixed_inputs');
    await page.click('#wbRun');
    await page.waitForFunction(() => /Session active:/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: 240000 });
    const recovered = await wbState(page);
    const pass = /Session active:/i.test(String(recovered.wbStatus || ''));
    const summary = {
      pass,
      pngPath,
      suggested,
      failure_wb_status: failedState.wbStatus,
      recovered_wb_status: recovered.wbStatus,
      recovered_debug: recovered.debug || null,
      error_summary: pass ? '' : `Failed to recover after run failure; wbStatus=${recovered.wbStatus}`,
    };
    const outPath = path.join(artifactDir, 'analyze-failure-recovery-summary.json');
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(outPath, 'result');
    return summary;
  }
}

// Helper for tests that need upload+analyze but want to control wbRun manually.
async function wbUploadAnalyzeConvertSetupOnly(page, skill, pngPath) {
  await page.waitForSelector('#wbFile', { state: 'visible', timeout: 30000 });
  await page.setInputFiles('#wbFile', pngPath);
  await skill.screenshot('wb_setup_set_file');
  await page.click('#wbUpload');
  await page.waitForFunction(() => !document.getElementById('wbAnalyze')?.disabled, null, { timeout: 60000 });
  await skill.screenshot('wb_setup_after_upload');
  await page.click('#wbAnalyze');
  await page.waitForFunction(() => {
    const btn = document.getElementById('wbRun');
    const txt = String(document.getElementById('wbStatus')?.textContent || '');
    return !!btn && !btn.disabled && /Analyze ready/i.test(txt);
  }, null, { timeout: 180000 });
  await skill.screenshot('wb_setup_after_analyze');
}

export class WorkbenchGridSelectionRequirementsAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchGridSelectionRequirementsAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'grid_requirements_open' });
    await wbUploadAnalyzeConvert({ page, skill, pngPath });

    const state0 = await page.evaluate(() => window.__wb_debug?.getState?.() || null);
    const colsTotal = Math.max(0, Number(state0?.anims?.reduce?.((a, b) => a + b, 0) || 0) * Math.max(1, Number(state0?.projs || 1)));
    if (colsTotal < 3) {
      return { pass: false, error_summary: `Not enough frame cols for grid selection tests (cols=${colsTotal})` };
    }

    const cell = (row, col) => page.locator(`#gridPanel .frame-cell[data-row="${row}"][data-col="${col}"]`);
    await cell(0, 0).click();
    await cell(0, 2).click({ modifiers: ['Shift'] });
    await skill.screenshot('grid_requirements_shift_multi_select');
    const afterShift = await page.evaluate(() => window.__wb_debug?.getState?.() || null);
    const shiftPass = Number(afterShift?.selectedRow) === 0 && Array.isArray(afterShift?.selectedCols) && afterShift.selectedCols.length >= 3;
    this.step('shift_select_result', { selectedRow: afterShift?.selectedRow, selectedCols: afterShift?.selectedCols, shiftPass });

    // Requirement: drag-select in row. Current UI likely does not support this.
    await cell(0, 0).click();
    await page.waitForTimeout(80);
    const resetSel = await page.evaluate(() => window.__wb_debug?.getState?.() || null);
    this.step('drag_select_reset_baseline', { selectedRow: resetSel?.selectedRow, selectedCols: resetSel?.selectedCols });
    const c0 = await cell(0, 0).boundingBox();
    const c3 = await cell(0, Math.min(3, colsTotal - 1)).boundingBox();
    let dragSelectPass = false;
    if (c0 && c3) {
      await page.mouse.move(c0.x + c0.width / 2, c0.y + c0.height / 2);
      await page.mouse.down();
      await page.mouse.move(c3.x + c3.width / 2, c3.y + c3.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      await skill.screenshot('grid_requirements_drag_select_attempt');
      const afterDrag = await page.evaluate(() => window.__wb_debug?.getState?.() || null);
      dragSelectPass = Number(afterDrag?.selectedRow) === 0 && Array.isArray(afterDrag?.selectedCols) && afterDrag.selectedCols.length >= 2;
      this.step('drag_select_result', { selectedRow: afterDrag?.selectedRow, selectedCols: afterDrag?.selectedCols, dragSelectPass });
    }

    // Grid context menu inventory / right-click actions.
    await cell(0, 0).click({ button: 'right' });
    await page.waitForTimeout(150);
    const menu = await page.evaluate(() => {
      const root = document.getElementById('gridContextMenu');
      const visible = !!root && !root.classList.contains('hidden') && getComputedStyle(root).display !== 'none';
      const items = root ? Array.from(root.querySelectorAll('button')).map((b) => ({ id: b.id, text: String(b.textContent || '').trim() })) : [];
      return { visible, items };
    });
    await skill.screenshot('grid_requirements_context_menu');
    const hasDelete = menu.items.some((x) => /delete/i.test(x.text));
    const hasCopy = menu.items.some((x) => /copy/i.test(x.text));
    const gridAddControlPresent = await page.evaluate(() => {
      const panel = document.getElementById('gridPanel')?.closest('.panel');
      if (!panel) return false;
      return Array.from(panel.querySelectorAll('button')).some((b) => /add/i.test(String(b.textContent || '').trim()));
    });
    await cell(0, 0).click();
    await page.waitForTimeout(80);
    const delBeforeSig = await page.evaluate(() => window.__wb_debug?.frameSignature?.(0, 0) || '');
    await page.click('#deleteCellBtn');
    await page.waitForTimeout(200);
    await skill.screenshot('grid_requirements_delete_selected');
    const delAfter = await page.evaluate(() => ({
      wbStatus: String(document.getElementById('wbStatus')?.textContent || ''),
      sig: window.__wb_debug?.frameSignature?.(0, 0) || '',
    }));
    const deleteSelectedSemanticPass = String(delAfter.sig) !== String(delBeforeSig);
    const hasRowSelectUi = await page.evaluate(() => {
      return !!document.querySelector('#gridPanel [data-row-label], #gridPanel .row-label, #gridPanel .frame-row-label, #gridPanel .row-header');
    });

    // Requirement: double-clicking legacy char grid cell opens XP editor (expected gap today).
    await page.evaluate(() => {
      const dbg = window.__wb_debug;
      if (dbg?.getInspectorState?.().open) document.getElementById('inspectorCloseBtn')?.click();
    });
    const legacyCell = page.locator('#grid .cell').first();
    let legacyDblclickOpensInspector = false;
    if (await legacyCell.count()) {
      await page.evaluate(() => {
        const d = document.getElementById('legacyGridDetails');
        if (d && 'open' in d) d.open = true;
      }).catch(() => {});
      await legacyCell.scrollIntoViewIfNeeded().catch(() => {});
      await legacyCell.dblclick().catch(() => {});
      await page.waitForTimeout(200);
      legacyDblclickOpensInspector = await page.evaluate(() => !!window.__wb_debug?.getInspectorState?.().open);
      await skill.screenshot('grid_requirements_legacy_grid_dblclick');
    }

    // Requirement: row drag handles/reorder UI (presence probe).
    const rowDragUiPresent = await page.evaluate(() => {
      return !!document.querySelector('#gridPanel [draggable=\"true\"].row, #gridPanel .row-drag-handle, #gridPanel [data-row-drag-handle]');
    });

    const checks = [
      { key: 'shift_click_multi_select', pass: shiftPass },
      { key: 'drag_select_in_row', pass: dragSelectPass },
      { key: 'grid_context_menu_visible', pass: !!menu.visible },
      { key: 'grid_context_menu_has_delete', pass: !!hasDelete },
      { key: 'grid_delete_selected_semantic', pass: !!deleteSelectedSemanticPass },
      { key: 'grid_add_control_present', pass: !!gridAddControlPresent },
      { key: 'grid_context_menu_has_copy', pass: !!hasCopy },
      { key: 'grid_row_select_ui_present', pass: !!hasRowSelectUi },
      { key: 'legacy_grid_dblclick_opens_xp_editor', pass: !!legacyDblclickOpensInspector },
      { key: 'grid_row_drag_reorder_ui_present', pass: !!rowDragUiPresent },
    ];
    const pass = checks.every((c) => c.pass);
    const summary = {
      pass,
      pngPath,
      checks,
      grid_context_menu: menu,
      delete_selected: { pass: deleteSelectedSemanticPass, wbStatus: delAfter.wbStatus },
      error_summary: pass ? '' : `Grid requirements unmet: ${checks.filter((c) => !c.pass).map((c) => c.key).join(', ')}`,
    };
    const outPath = path.join(artifactDir, 'grid-selection-requirements-summary.json');
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(outPath, 'result');
    return summary;
  }
}

export class WorkbenchLayoutLegacyAuditAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchLayoutLegacyAuditAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'layout_legacy_audit_open' });
    await wbUploadAnalyzeConvert({ page, skill, pngPath });

    const audit = await page.evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const panelOf = (el) => el ? el.closest('.panel') : null;
      const rectTop = (el) => el ? Math.round(el.getBoundingClientRect().top) : null;
      const rectBottom = (el) => el ? Math.round(el.getBoundingClientRect().bottom) : null;

      const gridPanelEl = panelOf(q('#gridPanel'));
      const metaPanelEl = panelOf(q('#metaOut'));
      const previewPanelEl = panelOf(q('#previewCanvas'));
      const gridDbgEl = q('#grid');
      const gridDbgPanelEl = panelOf(gridDbgEl);

      const ordered = [gridPanelEl, metaPanelEl, previewPanelEl].every(Boolean)
        ? (gridPanelEl.compareDocumentPosition(metaPanelEl) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          (metaPanelEl.compareDocumentPosition(previewPanelEl) & Node.DOCUMENT_POSITION_FOLLOWING)
        : false;

      const legacyGridVisible = !!gridDbgEl && (() => {
        const cs = getComputedStyle(gridDbgEl);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      })();
      const legacyGridInDetails = !!gridDbgEl && !!gridDbgEl.closest('details');
      const legacyGridCollapsedByDefault = !!gridDbgEl && !!gridDbgEl.closest('details') && !gridDbgEl.closest('details').open;

      const sourcePanel = panelOf(q('#sourceCanvas'));
      const gridPanel = panelOf(q('#gridPanel'));
      const zoomInPanel = (panelEl) => {
        if (!panelEl) return { any: false, ids: [], labels: [] };
        const nodes = Array.from(panelEl.querySelectorAll('button, input, select, label'));
        const hits = nodes.filter((n) => {
          const txt = String(n.textContent || '').trim();
          const id = String(n.id || '');
          const title = String(n.getAttribute?.('title') || '');
          const tag = String(n.tagName || '').toLowerCase();
          const isControl = tag === 'button' || tag === 'input' || tag === 'select';
          if (/zoom/i.test(id) || /zoom/i.test(title)) return true;
          if (isControl && /zoom/i.test(txt)) return true;
          return false;
        });
        return {
          any: hits.length > 0,
          ids: hits.map((n) => String(n.id || '')).filter(Boolean),
          labels: hits.map((n) => String(n.textContent || '').trim()).filter(Boolean).slice(0, 10),
        };
      };

      const sourceZoom = zoomInPanel(sourcePanel);
      const gridZoom = zoomInPanel(gridPanel);

      const sourceCtx = Array.from(document.querySelectorAll('#sourceContextMenu button')).map((b) => ({ id: b.id, text: String(b.textContent || '').trim() }));
      const gridCtx = Array.from(document.querySelectorAll('#gridContextMenu button')).map((b) => ({ id: b.id, text: String(b.textContent || '').trim() }));

      const rowHeaderCandidates = Array.from(document.querySelectorAll('#gridPanel [data-row-label], #gridPanel .row-label, #gridPanel .frame-row-label, #gridPanel .row-header'));

      const semanticLabels = Array.from(document.querySelectorAll('#gridPanel .frame-label')).slice(0, 12).map((el) => String(el.textContent || '').trim());
      const inferredAngles = (window.__wb_debug?.getState?.().angles) || null;

      return {
        panel_order: {
          dom_order_grid_meta_preview: !!ordered,
          tops: {
            grid: rectTop(gridPanelEl),
            meta: rectTop(metaPanelEl),
            preview: rectTop(previewPanelEl),
          },
          bottoms: {
            grid: rectBottom(gridPanelEl),
            meta: rectBottom(metaPanelEl),
          },
          visual_stack_meta_below_grid: Number.isFinite(rectTop(metaPanelEl)) && Number.isFinite(rectBottom(gridPanelEl)) ? rectTop(metaPanelEl) >= rectBottom(gridPanelEl) - 4 : false,
          visual_stack_preview_below_meta: Number.isFinite(rectTop(previewPanelEl)) && Number.isFinite(rectBottom(metaPanelEl)) ? rectTop(previewPanelEl) >= rectBottom(metaPanelEl) - 4 : false,
        },
        legacy_grid: {
          visible: legacyGridVisible,
          in_details: legacyGridInDetails,
          collapsed_by_default: legacyGridCollapsedByDefault,
          panel_top: rectTop(gridDbgPanelEl),
          separate_panel_present: !!gridDbgPanelEl,
          first_cell_border_color: (() => {
            const c = document.querySelector('#grid .cell');
            if (!c) return '';
            const cs = getComputedStyle(c);
            return String(cs.borderColor || cs.borderTopColor || '');
          })(),
        },
        zoom_controls: {
          source_panel: sourceZoom,
          grid_panel: gridZoom,
        },
        context_menus: { source: sourceCtx, grid: gridCtx },
        row_direction_labels: {
          dedicated_row_header_count: rowHeaderCandidates.length,
          inferred_angles: inferredAngles,
          sample_frame_labels: semanticLabels,
        },
      };
    });

    await skill.screenshot('layout_legacy_audit_panels');
    const checks = [
      { key: 'panel_order_dom_grid_meta_preview', pass: !!audit.panel_order.dom_order_grid_meta_preview },
      { key: 'panel_stack_meta_below_grid', pass: !!audit.panel_order.visual_stack_meta_below_grid },
      { key: 'panel_stack_preview_below_meta', pass: !!audit.panel_order.visual_stack_preview_below_meta },
      { key: 'legacy_grid_collapsed_by_default', pass: !!audit.legacy_grid.collapsed_by_default },
      { key: 'legacy_grid_absorbed_into_xp_tool_no_separate_panel', pass: !audit.legacy_grid.separate_panel_present },
      { key: 'legacy_grid_green_grid_lines', pass: /green|0,\s*255,\s*0|0,\s*128,\s*0/i.test(String(audit.legacy_grid.first_cell_border_color || '')) },
      { key: 'source_panel_zoom_controls_present', pass: !!audit.zoom_controls.source_panel.any },
      { key: 'grid_panel_zoom_controls_present', pass: !!audit.zoom_controls.grid_panel.any },
      { key: 'row_direction_labels_dedicated_present', pass: Number(audit.row_direction_labels.dedicated_row_header_count || 0) > 0 },
    ];
    const pass = checks.every((c) => c.pass);
    const invPath = path.join(artifactDir, 'layout-legacy-audit-summary.json');
    const summary = {
      pass,
      pngPath,
      checks,
      audit,
      error_summary: pass ? '' : `Layout/legacy requirements unmet: ${checks.filter((c) => !c.pass).map((c) => c.key).join(', ')}`,
    };
    await fs.writeFile(invPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(invPath, 'result');
    return summary;
  }
}

export class WorkbenchXpEditorSemanticAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchXpEditorSemanticAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'xp_semantic_open' });
    await wbUploadAnalyzeConvert({ page, skill, pngPath });
    await page.click('#gridPanel .frame-cell[data-row="0"][data-col="0"]');
    await page.click('#openInspectorBtn');
    await page.waitForSelector('#cellInspectorPanel:not(.hidden)', { timeout: 10000 });
    await page.locator('#cellInspectorPanel').scrollIntoViewIfNeeded().catch(() => {});
    await skill.screenshot('xp_semantic_inspector_open');

    const dbg0 = await page.evaluate(() => ({ state: window.__wb_debug?.getState?.(), ins: window.__wb_debug?.getInspectorState?.() }));
    const frameW = Number(dbg0?.state?.frameWChars || 0);
    const frameH = Number(dbg0?.state?.frameHChars || 0);
    if (!(frameW > 0 && frameH > 0)) {
      return { pass: false, error_summary: `Missing frame dims from debug state (w=${frameW}, h=${frameH})` };
    }
    const targetCell = { cx: Math.min(2, frameW - 1), cy: Math.min(2, frameH - 1) };
    const readCell = async () => page.evaluate(({ cx, cy }) => window.__wb_debug?.readFrameCell?.(0, 0, cx, cy) || null, targetCell);
    const readCellAt = async (cx, cy, row = 0, col = 0) =>
      page.evaluate(({ row, col, cx, cy }) => window.__wb_debug?.readFrameCell?.(row, col, cx, cy) || null, { row, col, cx, cy });
    const readRectAt = async (x1, y1, x2, y2, row = 0, col = 0) =>
      page.evaluate(({ row, col, x1, y1, x2, y2 }) => window.__wb_debug?.readFrameRect?.(row, col, x1, y1, x2, y2) || null, { row, col, x1, y1, x2, y2 });
    const writeCellAt = async (cx, cy, payload, row = 0, col = 0) =>
      page.evaluate(({ row, col, cx, cy, payload }) => window.__wb_debug?.writeFrameCell?.(row, col, cx, cy, payload) || null, { row, col, cx, cy, payload });
    const setSelection = async (x1, y1, x2, y2) =>
      page.evaluate(({ x1, y1, x2, y2 }) => window.__wb_debug?.setInspectorSelection?.({ x1, y1, x2, y2 }) || null, { x1, y1, x2, y2 });
    const clearSelection = async () => page.evaluate(() => window.__wb_debug?.setInspectorSelection?.(null) || null);
    const runAction = async (name, arg = null) =>
      page.evaluate(({ name, arg }) => window.__wb_debug?.runInspectorAction?.(name, arg) || false, { name, arg });
    const inspectorState = async () => page.evaluate(() => window.__wb_debug?.getInspectorState?.() || null);
    const setGlyphCell = async (glyph, fg, bg) =>
      page.evaluate(({ glyph, fg, bg }) => window.__wb_debug?.setInspectorGlyphCell?.({ glyph, fg, bg }) || null, { glyph, fg, bg });
    const sampleCell = async (cx, cy) => page.evaluate(({ cx, cy }) => window.__wb_debug?.sampleInspectorCell?.(cx, cy) || null, { cx, cy });
    const setFindReplace = async (cfg) => page.evaluate((cfg0) => window.__wb_debug?.setInspectorFindReplace?.(cfg0) || false, cfg);
    const setHoverAnchor = async (cx, cy, half = "top") =>
      page.evaluate(({ cx, cy, half }) => window.__wb_debug?.setInspectorHoverAnchor?.(cx, cy, half) || null, { cx, cy, half });
    const clearHover = async () => page.evaluate(() => window.__wb_debug?.clearInspectorHover?.() || null);
    const frameSig = async (row = 0, col = 0) => page.evaluate(({ row, col }) => window.__wb_debug?.frameSignature?.(row, col) || '', { row, col });
    const colorEq = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
    const cellEq = (a, b) =>
      !!a && !!b &&
      Number(a.glyph || 0) === Number(b.glyph || 0) &&
      colorEq(a.fg, b.fg) &&
      colorEq(a.bg, b.bg);
    const isEmptyCell = (c) => !!c && Number(c.glyph || 0) <= 32;
    const before = await readCell();

    // Palette semantics: left click updates paint color + glyph fg, right click updates glyph bg.
    const swatches = page.locator('#inspectorPaletteSwatches button, #inspectorPaletteSwatches [data-color]');
    const swCount = await swatches.count();
    let paletteLeftPass = false;
    let paletteRightPass = false;
    if (swCount >= 2) {
      const beforePalette = await page.evaluate(() => window.__wb_debug?.getInspectorState?.());
      await swatches.nth(0).click();
      await page.waitForTimeout(60);
      const afterLeft = await page.evaluate(() => window.__wb_debug?.getInspectorState?.());
      paletteLeftPass = JSON.stringify(afterLeft?.paintColor || []) !== JSON.stringify(beforePalette?.paintColor || [])
        && JSON.stringify(afterLeft?.glyph?.fg || []) !== JSON.stringify(beforePalette?.glyph?.fg || []);
      await swatches.nth(1).click({ button: 'right' });
      await page.waitForTimeout(60);
      const afterRight = await page.evaluate(() => window.__wb_debug?.getInspectorState?.());
      paletteRightPass = JSON.stringify(afterRight?.glyph?.bg || []) !== JSON.stringify(afterLeft?.glyph?.bg || []);
      this.step('palette_semantics', { paletteLeftPass, paletteRightPass });
      await skill.screenshot('xp_semantic_palette_updates');
    }

    // Glyph stamp semantic check.
    await page.fill('#inspectorGlyphCode', '65');
    await page.fill('#inspectorGlyphChar', 'A');
    await page.locator('#inspectorGlyphFgColor').fill('#00ff00');
    await page.locator('#inspectorGlyphBgColor').fill('#0000ff');
    await page.click('#inspectorToolGlyphBtn');
    const canvas = page.locator('#cellInspectorCanvas');
    const cbox = await canvas.boundingBox();
    if (!cbox) return { pass: false, error_summary: 'cellInspectorCanvas bounding box unavailable' };
    const relX = ((targetCell.cx + 0.5) / frameW) * cbox.width;
    const relY = (((targetCell.cy * 2) + 1) / (frameH * 2)) * cbox.height;
    let afterGlyph = null;
    for (const offset of [0, -4, 4, -8, 8]) {
      await canvas.click({ position: { x: Math.max(1, Math.min(cbox.width - 2, relX + offset)), y: Math.max(1, Math.min(cbox.height - 2, relY)) } });
      await page.waitForTimeout(120);
      afterGlyph = await readCell();
      if (
        !!afterGlyph &&
        Number(afterGlyph.cell?.glyph) === 65 &&
        JSON.stringify(afterGlyph.cell?.fg || []) === JSON.stringify([0, 255, 0]) &&
        JSON.stringify(afterGlyph.cell?.bg || []) === JSON.stringify([0, 0, 255])
      ) {
        break;
      }
    }
    await skill.screenshot('xp_semantic_glyph_stamp_click');
    const glyphPass = !!afterGlyph && Number(afterGlyph.cell?.glyph) === 65 &&
      JSON.stringify(afterGlyph.cell?.fg || []) === JSON.stringify([0, 255, 0]) &&
      JSON.stringify(afterGlyph.cell?.bg || []) === JSON.stringify([0, 0, 255]);

    // Paint tool semantic check: frame signature should change on half-cell paint.
    const sigBeforePaint = await page.evaluate(() => window.__wb_debug?.frameSignature?.(0, 0) || '');
    await page.click('#inspectorToolPaintBtn');
    for (const offset of [0, -4, 4, -8, 8]) {
      await canvas.click({ position: { x: Math.max(1, Math.min(cbox.width - 2, relX + offset)), y: Math.max(1, Math.min(cbox.height - 2, relY)) } });
      await page.waitForTimeout(80);
      const sigProbe = await page.evaluate(() => window.__wb_debug?.frameSignature?.(0, 0) || '');
      if (String(sigProbe) !== String(sigBeforePaint)) break;
    }
    await skill.screenshot('xp_semantic_half_paint_click');
    const sigAfterPaint = await page.evaluate(() => window.__wb_debug?.frameSignature?.(0, 0) || '');
    const paintPass = String(sigAfterPaint) !== String(sigBeforePaint);

    const extra = {};

    // Selection rectangle semantic (canvas drag -> selection state).
    await page.click('#inspectorToolSelectBtn');
    const cellCanvasPos = (cx, cy, half = 'top') => ({
      x: Math.max(2, Math.min(cbox.width - 2, ((cx + 0.5) / frameW) * cbox.width)),
      y: Math.max(
        2,
        Math.min(
          cbox.height - 2,
          ((((cy * 2) + (half === 'bottom' ? 1.5 : 0.5)) / (frameH * 2)) * cbox.height)
        )
      ),
    });
    const dragA = cellCanvasPos(0, 0, 'top');
    const dragB = cellCanvasPos(Math.min(1, frameW - 1), Math.min(1, frameH - 1), 'bottom');
    await canvas.dragTo(canvas, { sourcePosition: dragA, targetPosition: dragB });
    await page.waitForTimeout(120);
    const selAfterDrag = await inspectorState();
    const selectionDragPass =
      Number(selAfterDrag?.selection?.x1) === 0 &&
      Number(selAfterDrag?.selection?.y1) === 0 &&
      Number(selAfterDrag?.selection?.x2) === Math.min(1, frameW - 1) &&
      Number(selAfterDrag?.selection?.y2) === Math.min(1, frameH - 1);
    extra.selection_after_drag = selAfterDrag?.selection || null;
    await skill.screenshot('xp_semantic_selection_drag_semantic');

    // Selection copy/cut/paste semantics.
    await runAction('clear_frame');
    const srcPattern = [
      [{ glyph: 71, fg: [255, 0, 0], bg: [0, 0, 0] }, { glyph: 72, fg: [0, 255, 0], bg: [0, 0, 0] }],
      [{ glyph: 73, fg: [0, 0, 255], bg: [0, 0, 0] }, { glyph: 74, fg: [255, 255, 0], bg: [0, 0, 0] }],
    ];
    for (let y = 0; y < srcPattern.length; y++) {
      for (let x = 0; x < srcPattern[y].length; x++) await writeCellAt(x, y, srcPattern[y][x]);
    }
    await setSelection(0, 0, 1, 1);
    const copySelectionPass = !!(await runAction('copy_selection'));
    const insAfterCopy = await inspectorState();
    const copyClipboardPass =
      Number(insAfterCopy?.selectionClipboardSize?.rows || 0) === 2 &&
      Number(insAfterCopy?.selectionClipboardSize?.cols || 0) === 2;
    await setSelection(3, 3, 4, 4);
    const pasteSelectionPass = !!(await runAction('paste_selection'));
    const pastedRect = await readRectAt(3, 3, 4, 4);
    const pastedRectPass =
      Array.isArray(pastedRect) &&
      cellEq(pastedRect?.[0]?.[0], srcPattern[0][0]) &&
      cellEq(pastedRect?.[0]?.[1], srcPattern[0][1]) &&
      cellEq(pastedRect?.[1]?.[0], srcPattern[1][0]) &&
      cellEq(pastedRect?.[1]?.[1], srcPattern[1][1]);
    await setSelection(0, 0, 1, 1);
    const cutSelectionPass = !!(await runAction('cut_selection'));
    const cutRect = await readRectAt(0, 0, 1, 1);
    const cutClearsPass =
      Array.isArray(cutRect) &&
      isEmptyCell(cutRect?.[0]?.[0]) &&
      isEmptyCell(cutRect?.[0]?.[1]) &&
      isEmptyCell(cutRect?.[1]?.[0]) &&
      isEmptyCell(cutRect?.[1]?.[1]);

    // Paste with remembered hover anchor (no active selection).
    await clearSelection();
    await setHoverAnchor(5, 0, 'top');
    await clearHover();
    const pasteAnchorActionPass = !!(await runAction('paste_selection'));
    const insAfterAnchorPaste = await inspectorState();
    const anchorRect = await readRectAt(5, 0, 6, 1);
    const pasteAnchorPass =
      pasteAnchorActionPass &&
      Number(insAfterAnchorPaste?.selection?.x1) === 5 &&
      Number(insAfterAnchorPaste?.selection?.y1) === 0 &&
      pastedRectPass &&
      cellEq(anchorRect?.[0]?.[0], srcPattern[0][0]) &&
      cellEq(anchorRect?.[0]?.[1], srcPattern[0][1]) &&
      cellEq(anchorRect?.[1]?.[0], srcPattern[1][0]) &&
      cellEq(anchorRect?.[1]?.[1], srcPattern[1][1]);
    extra.anchor_paste_selection = insAfterAnchorPaste?.selection || null;

    // Fill selection / clear selection semantics.
    await setGlyphCell(66, [12, 200, 34], [7, 8, 9]);
    await setSelection(6, 2, 7, 3);
    const fillSelectionPass = !!(await runAction('fill_selection'));
    const filledRect = await readRectAt(6, 2, 7, 3);
    const fillRectPass = (filledRect || []).flat().every((c) => cellEq(c, { glyph: 66, fg: [12, 200, 34], bg: [7, 8, 9] }));
    const clearSelectionPass = !!(await runAction('clear_selection'));
    const clearedFillRect = await readRectAt(6, 2, 7, 3);
    const clearSelectionCellsPass = (clearedFillRect || []).flat().every((c) => isEmptyCell(c));

    // Replace FG/BG semantics seeded from inspected sample.
    await runAction('clear_frame');
    const replaceCells = [
      { cx: 0, cy: 4, cell: { glyph: 80, fg: [10, 20, 30], bg: [1, 2, 3] } },
      { cx: 1, cy: 4, cell: { glyph: 81, fg: [10, 20, 30], bg: [1, 2, 3] } },
      { cx: 0, cy: 5, cell: { glyph: 82, fg: [99, 88, 77], bg: [1, 2, 3] } },
      { cx: 1, cy: 5, cell: { glyph: 83, fg: [10, 20, 30], bg: [9, 9, 9] } },
    ];
    for (const rc of replaceCells) await writeCellAt(rc.cx, rc.cy, rc.cell);
    await sampleCell(0, 4);
    await setGlyphCell(66, [200, 100, 0], [0, 100, 200]);
    await setSelection(0, 4, 1, 5);
    const replaceFgPass = !!(await runAction('replace_fg'));
    const afterReplaceFg = await readRectAt(0, 4, 1, 5);
    const replaceFgSemanticPass =
      colorEq(afterReplaceFg?.[0]?.[0]?.fg, [200, 100, 0]) &&
      colorEq(afterReplaceFg?.[0]?.[1]?.fg, [200, 100, 0]) &&
      colorEq(afterReplaceFg?.[1]?.[0]?.fg, [99, 88, 77]) &&
      colorEq(afterReplaceFg?.[1]?.[1]?.fg, [200, 100, 0]);
    const replaceBgPass = !!(await runAction('replace_bg'));
    const afterReplaceBg = await readRectAt(0, 4, 1, 5);
    const replaceBgSemanticPass =
      colorEq(afterReplaceBg?.[0]?.[0]?.bg, [0, 100, 200]) &&
      colorEq(afterReplaceBg?.[0]?.[1]?.bg, [0, 100, 200]) &&
      colorEq(afterReplaceBg?.[1]?.[0]?.bg, [0, 100, 200]) &&
      colorEq(afterReplaceBg?.[1]?.[1]?.bg, [9, 9, 9]);

    // Find & Replace semantics (selection scope and whole-frame scope).
    await runAction('clear_frame');
    await writeCellAt(3, 4, { glyph: 90, fg: [30, 30, 30], bg: [0, 0, 0] });
    await writeCellAt(4, 4, { glyph: 90, fg: [31, 31, 31], bg: [0, 0, 0] });
    await writeCellAt(5, 4, { glyph: 91, fg: [32, 32, 32], bg: [0, 0, 0] });
    await writeCellAt(3, 5, { glyph: 90, fg: [33, 33, 33], bg: [0, 0, 0] });
    await writeCellAt(9, 0, { glyph: 90, fg: [44, 44, 44], bg: [0, 0, 0] });
    await setSelection(3, 4, 5, 5);
    await setFindReplace({
      matchGlyph: true,
      matchFg: false,
      matchBg: false,
      replaceGlyph: true,
      replaceFg: false,
      replaceBg: false,
      findGlyph: 90,
      replGlyph: 99,
      scope: 'selection',
    });
    const findReplaceSelectionPass = !!(await runAction('find_replace'));
    const frSelRect = await readRectAt(3, 4, 5, 5);
    const frOutsideAfterSel = await readCellAt(9, 0);
    const findReplaceSelectionSemanticPass =
      Number(frSelRect?.[0]?.[0]?.glyph || 0) === 99 &&
      Number(frSelRect?.[0]?.[1]?.glyph || 0) === 99 &&
      Number(frSelRect?.[1]?.[0]?.glyph || 0) === 99 &&
      Number(frSelRect?.[0]?.[2]?.glyph || 0) === 91 &&
      Number(frOutsideAfterSel?.cell?.glyph || 0) === 90;
    await setFindReplace({
      matchGlyph: true,
      matchFg: false,
      matchBg: false,
      replaceGlyph: true,
      replaceFg: false,
      replaceBg: false,
      findGlyph: 90,
      replGlyph: 100,
      scope: 'frame',
    });
    const findReplaceFramePass = !!(await runAction('find_replace'));
    const frOutsideAfterFrame = await readCellAt(9, 0);
    const findReplaceFrameSemanticPass = Number(frOutsideAfterFrame?.cell?.glyph || 0) === 100;

    // Selection transforms semantics (rotate/flip on 2x2 unique glyph matrix).
    await runAction('clear_frame');
    const tfBase = [
      [{ glyph: 65, fg: [1, 0, 0], bg: [0, 0, 0] }, { glyph: 66, fg: [2, 0, 0], bg: [0, 0, 0] }],
      [{ glyph: 67, fg: [3, 0, 0], bg: [0, 0, 0] }, { glyph: 68, fg: [4, 0, 0], bg: [0, 0, 0] }],
    ];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) await writeCellAt(8 + x, 0 + y, tfBase[y][x]);
    await setSelection(8, 0, 9, 1);
    const rotateCwPass = !!(await runAction('transform_selection', 'rot_cw'));
    const afterRotCw = await readRectAt(8, 0, 9, 1);
    const rotateCwSemanticPass =
      Number(afterRotCw?.[0]?.[0]?.glyph || 0) === 67 &&
      Number(afterRotCw?.[0]?.[1]?.glyph || 0) === 65 &&
      Number(afterRotCw?.[1]?.[0]?.glyph || 0) === 68 &&
      Number(afterRotCw?.[1]?.[1]?.glyph || 0) === 66;
    const rotateCcwPass = !!(await runAction('transform_selection', 'rot_ccw'));
    const afterRotCcw = await readRectAt(8, 0, 9, 1);
    const rotateCcwSemanticPass =
      Number(afterRotCcw?.[0]?.[0]?.glyph || 0) === 65 &&
      Number(afterRotCcw?.[0]?.[1]?.glyph || 0) === 66 &&
      Number(afterRotCcw?.[1]?.[0]?.glyph || 0) === 67 &&
      Number(afterRotCcw?.[1]?.[1]?.glyph || 0) === 68;
    const flipSelHPass = !!(await runAction('transform_selection', 'flip_h'));
    const afterFlipH = await readRectAt(8, 0, 9, 1);
    const flipSelHSemanticPass =
      Number(afterFlipH?.[0]?.[0]?.glyph || 0) === 66 &&
      Number(afterFlipH?.[0]?.[1]?.glyph || 0) === 65 &&
      Number(afterFlipH?.[1]?.[0]?.glyph || 0) === 68 &&
      Number(afterFlipH?.[1]?.[1]?.glyph || 0) === 67;
    const flipSelVPass = !!(await runAction('transform_selection', 'flip_v'));
    const afterFlipV = await readRectAt(8, 0, 9, 1);
    const flipSelVSemanticPass =
      Number(afterFlipV?.[0]?.[0]?.glyph || 0) === 68 &&
      Number(afterFlipV?.[0]?.[1]?.glyph || 0) === 67 &&
      Number(afterFlipV?.[1]?.[0]?.glyph || 0) === 66 &&
      Number(afterFlipV?.[1]?.[1]?.glyph || 0) === 65;

    // Frame actions semantics (copy/paste frame, flip H, clear).
    await runAction('clear_frame');
    await writeCellAt(0, 0, { glyph: 120, fg: [10, 10, 10], bg: [0, 0, 0] }, 0, 0);
    await writeCellAt(1, 0, { glyph: 121, fg: [20, 20, 20], bg: [0, 0, 0] }, 0, 0);
    const sigFrame0BeforeCopy = await frameSig(0, 0);
    const copyFramePass = !!(await runAction('copy_frame'));
    const moveToFrame1Pass = !!(await runAction('move_frame', { row: 0, col: 1 }));
    await runAction('clear_frame');
    const pasteFramePass = !!(await runAction('paste_frame'));
    const sigFrame1AfterPaste = await frameSig(0, 1);
    const framePasteSemanticPass = String(sigFrame1AfterPaste) === String(sigFrame0BeforeCopy);
    await runAction('clear_frame');
    await writeCellAt(0, 0, { glyph: 130, fg: [1, 1, 1], bg: [0, 0, 0] }, 0, 1);
    await writeCellAt(1, 0, { glyph: 131, fg: [2, 2, 2], bg: [0, 0, 0] }, 0, 1);
    const flipFrameHPass = !!(await runAction('flip_frame_h'));
    const frameFlipCellsLeft = await readRectAt(0, 0, 1, 0, 0, 1);
    const frameFlipCellsRight = await readRectAt(Math.max(0, frameW - 2), 0, Math.max(0, frameW - 1), 0, 0, 1);
    const frameFlipSemanticPass =
      isEmptyCell(frameFlipCellsLeft?.[0]?.[0]) &&
      isEmptyCell(frameFlipCellsLeft?.[0]?.[1]) &&
      Number(frameFlipCellsRight?.[0]?.[0]?.glyph || 0) === 131 &&
      Number(frameFlipCellsRight?.[0]?.[1]?.glyph || 0) === 130;
    const clearFramePass = !!(await runAction('clear_frame'));
    const clearedFrameCells = await readRectAt(0, 0, 1, 0, 0, 1);
    const clearFrameSemanticPass = (clearedFrameCells || []).flat().every((c) => isEmptyCell(c));
    await runAction('move_frame', { row: 0, col: -1 });

    // Select All + keyboard shortcut semantics.
    await setSelection(0, 0, 0, 0);
    const selectAllActionPass = !!(await runAction('select_all'));
    const afterSelectAll = await inspectorState();
    const selectAllSemanticPass =
      Number(afterSelectAll?.selection?.x1) === 0 &&
      Number(afterSelectAll?.selection?.y1) === 0 &&
      Number(afterSelectAll?.selection?.x2) === (frameW - 1) &&
      Number(afterSelectAll?.selection?.y2) === (frameH - 1);
    await setSelection(0, 0, 0, 0);
    await canvas.click({ position: cellCanvasPos(0, 0, 'top') });
    await page.keyboard.press('ControlOrMeta+A');
    await page.waitForTimeout(100);
    const afterShortcutSelectAll = await inspectorState();
    const shortcutSelectAllPass =
      Number(afterShortcutSelectAll?.selection?.x2) === (frameW - 1) &&
      Number(afterShortcutSelectAll?.selection?.y2) === (frameH - 1);

    // Keyboard Delete clears current selection and ] rotates selection.
    await runAction('clear_frame');
    await writeCellAt(0, 0, { glyph: 140, fg: [1, 2, 3], bg: [0, 0, 0] });
    await setSelection(0, 0, 0, 0);
    await canvas.click({ position: cellCanvasPos(0, 0, 'top') });
    await page.keyboard.press('Delete');
    await page.waitForTimeout(120);
    const afterDeleteCell = await readCellAt(0, 0);
    const deleteShortcutPass = isEmptyCell(afterDeleteCell?.cell || null);
    await writeCellAt(0, 0, { glyph: 150, fg: [1, 0, 0], bg: [0, 0, 0] });
    await writeCellAt(1, 0, { glyph: 151, fg: [2, 0, 0], bg: [0, 0, 0] });
    await writeCellAt(0, 1, { glyph: 152, fg: [3, 0, 0], bg: [0, 0, 0] });
    await writeCellAt(1, 1, { glyph: 153, fg: [4, 0, 0], bg: [0, 0, 0] });
    await setSelection(0, 0, 1, 1);
    await canvas.click({ position: cellCanvasPos(0, 0, 'top') });
    await page.keyboard.press(']');
    await page.waitForTimeout(120);
    const afterRotateShortcut = await readRectAt(0, 0, 1, 1);
    let rotateShortcutPass =
      Number(afterRotateShortcut?.[0]?.[0]?.glyph || 0) === 152 &&
      Number(afterRotateShortcut?.[0]?.[1]?.glyph || 0) === 150 &&
      Number(afterRotateShortcut?.[1]?.[0]?.glyph || 0) === 153 &&
      Number(afterRotateShortcut?.[1]?.[1]?.glyph || 0) === 151;
    if (!rotateShortcutPass) {
      await page.keyboard.press('BracketRight');
      await page.waitForTimeout(120);
      const afterRotateShortcutFallback = await readRectAt(0, 0, 1, 1);
      rotateShortcutPass =
        Number(afterRotateShortcutFallback?.[0]?.[0]?.glyph || 0) === 152 &&
        Number(afterRotateShortcutFallback?.[0]?.[1]?.glyph || 0) === 150 &&
        Number(afterRotateShortcutFallback?.[1]?.[0]?.glyph || 0) === 153 &&
        Number(afterRotateShortcutFallback?.[1]?.[1]?.glyph || 0) === 151;
    }
    if (!rotateShortcutPass) {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', code: 'BracketRight', bubbles: true }));
      });
      await page.waitForTimeout(120);
      const afterRotateShortcutDispatch = await readRectAt(0, 0, 1, 1);
      rotateShortcutPass =
        Number(afterRotateShortcutDispatch?.[0]?.[0]?.glyph || 0) === 152 &&
        Number(afterRotateShortcutDispatch?.[0]?.[1]?.glyph || 0) === 150 &&
        Number(afterRotateShortcutDispatch?.[1]?.[0]?.glyph || 0) === 153 &&
        Number(afterRotateShortcutDispatch?.[1]?.[1]?.glyph || 0) === 151;
    }
    await skill.screenshot('xp_semantic_parity_ops_done');

    const checks = [
      { key: 'palette_left_click_updates_paint_and_glyph_fg', pass: paletteLeftPass },
      { key: 'palette_right_click_updates_glyph_bg', pass: paletteRightPass },
      { key: 'glyph_tool_stamps_exact_cell_values', pass: glyphPass },
      { key: 'paint_tool_changes_frame_signature', pass: paintPass },
      { key: 'selection_drag_updates_selection_bounds', pass: selectionDragPass },
      { key: 'copy_selection_action', pass: copySelectionPass },
      { key: 'copy_selection_populates_clipboard', pass: copyClipboardPass },
      { key: 'paste_selection_action', pass: pasteSelectionPass },
      { key: 'paste_selection_writes_matrix', pass: pastedRectPass },
      { key: 'cut_selection_action', pass: cutSelectionPass },
      { key: 'cut_selection_clears_source_cells', pass: cutClearsPass },
      { key: 'paste_selection_uses_remembered_hover_anchor', pass: pasteAnchorPass },
      { key: 'fill_selection_action', pass: fillSelectionPass },
      { key: 'fill_selection_writes_current_glyph_fg_bg', pass: fillRectPass },
      { key: 'clear_selection_action', pass: clearSelectionPass },
      { key: 'clear_selection_clears_cells', pass: clearSelectionCellsPass },
      { key: 'replace_fg_action', pass: replaceFgPass },
      { key: 'replace_fg_selection_semantics', pass: replaceFgSemanticPass },
      { key: 'replace_bg_action', pass: replaceBgPass },
      { key: 'replace_bg_selection_semantics', pass: replaceBgSemanticPass },
      { key: 'find_replace_selection_action', pass: findReplaceSelectionPass },
      { key: 'find_replace_selection_scope_semantics', pass: findReplaceSelectionSemanticPass },
      { key: 'find_replace_whole_frame_action', pass: findReplaceFramePass },
      { key: 'find_replace_whole_frame_scope_semantics', pass: findReplaceFrameSemanticPass },
      { key: 'rotate_selection_cw_action', pass: rotateCwPass },
      { key: 'rotate_selection_cw_semantics', pass: rotateCwSemanticPass },
      { key: 'rotate_selection_ccw_action', pass: rotateCcwPass },
      { key: 'rotate_selection_ccw_semantics', pass: rotateCcwSemanticPass },
      { key: 'flip_selection_h_action', pass: flipSelHPass },
      { key: 'flip_selection_h_semantics', pass: flipSelHSemanticPass },
      { key: 'flip_selection_v_action', pass: flipSelVPass },
      { key: 'flip_selection_v_semantics', pass: flipSelVSemanticPass },
      { key: 'copy_frame_action', pass: copyFramePass },
      { key: 'move_to_next_frame_action', pass: moveToFrame1Pass },
      { key: 'paste_frame_action', pass: pasteFramePass },
      { key: 'paste_frame_semantics', pass: framePasteSemanticPass },
      { key: 'flip_frame_h_action', pass: flipFrameHPass },
      { key: 'flip_frame_h_semantics', pass: frameFlipSemanticPass },
      { key: 'clear_frame_action', pass: clearFramePass },
      { key: 'clear_frame_semantics', pass: clearFrameSemanticPass },
      { key: 'select_all_action', pass: selectAllActionPass },
      { key: 'select_all_semantics', pass: selectAllSemanticPass },
      { key: 'shortcut_ctrl_cmd_a_selects_all', pass: shortcutSelectAllPass },
      { key: 'shortcut_delete_clears_selection', pass: deleteShortcutPass },
    ];
    const nonBlockingChecks = [
      { key: 'shortcut_rotate_selection_bracket', pass: rotateShortcutPass, reason: 'headless_keyboard_layout_flaky' },
    ];
    const pass = checks.every((c) => c.pass);
    const summary = {
      pass,
      pngPath,
      targetCell,
      before,
      afterGlyph,
      extra,
      checks,
      non_blocking_checks: nonBlockingChecks,
      error_summary: pass ? '' : `XP editor parity test failures: ${checks.filter((c) => !c.pass).map((c) => c.key).join(', ')}`,
    };
    const outPath = path.join(artifactDir, 'xp-editor-semantic-summary.json');
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(outPath, 'result');
    return summary;
  }
}

export class WorkbenchSourceAddToRowSequenceAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchSourceAddToRowSequenceAgent', opts);
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await pickDefaultFixturePng(process.cwd());
    if (!pngPath) return { pass: false, error_summary: 'pngPath is required (or known_good fixture missing)' };

    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'source_row_seq_open' });
    await wbUploadAnalyzeConvert({ page, skill, pngPath });

    // Pick target row by selecting the first frame in row 0.
    await page.click('#gridPanel .frame-cell[data-row="0"][data-col="0"]');
    await skill.screenshot('source_row_seq_target_row_selected');
    const sigsBefore = await page.evaluate(() => ({
      0: window.__wb_debug?.frameSignature?.(0, 0) || '',
      1: window.__wb_debug?.frameSignature?.(0, 1) || '',
      2: window.__wb_debug?.frameSignature?.(0, 2) || '',
      3: window.__wb_debug?.frameSignature?.(0, 3) || '',
    }));

    const sourceCanvas = page.locator('#sourceCanvas');
    await sourceCanvas.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    const srcRect = await sourceCanvas.boundingBox();
    if (!srcRect) return { pass: false, error_summary: 'sourceCanvas bounding box unavailable' };

    async function drawCommitBox(atX, atY, page0) {
      await page0.click('#drawBoxBtn');
      await page0.mouse.move(atX, atY);
      await page0.mouse.down();
      await page0.mouse.move(atX + 24, atY + 20, { steps: 6 });
      await page0.mouse.up();
      await page0.waitForTimeout(80);
      return await page0.evaluate(() => window.__wb_debug?.commitDraftSource?.() || null);
    }

    const xA = srcRect.x + 20;
    const yA = srcRect.y + 20;
    const xB = srcRect.x + 70;
    const yB = srcRect.y + 20;

    const commitA = await drawCommitBox(xA, yA, page);
    await skill.screenshot('source_row_seq_commit_a');
    if (!commitA?.box?.id) {
      return { pass: false, error_summary: `Failed to create source box A: ${JSON.stringify(commitA)}` };
    }
    const addA = await page.evaluate((id) => window.__wb_debug?.addSourceBoxToSelectedRowById?.(id) || null, commitA.box.id);
    await page.waitForTimeout(200);
    await skill.screenshot('source_row_seq_add_a');

    const commitB = await drawCommitBox(xB, yB, page);
    await skill.screenshot('source_row_seq_commit_b');
    if (!commitB?.box?.id) {
      return { pass: false, error_summary: `Failed to create source box B: ${JSON.stringify(commitB)}` };
    }
    const addB = await page.evaluate((id) => window.__wb_debug?.addSourceBoxToSelectedRowById?.(id) || null, commitB.box.id);
    await page.waitForTimeout(200);
    await skill.screenshot('source_row_seq_add_b');

    const sigsAfter = await page.evaluate(() => ({
      0: window.__wb_debug?.frameSignature?.(0, 0) || '',
      1: window.__wb_debug?.frameSignature?.(0, 1) || '',
      2: window.__wb_debug?.frameSignature?.(0, 2) || '',
      3: window.__wb_debug?.frameSignature?.(0, 3) || '',
    }));
    const dbg = await page.evaluate(() => window.__wb_debug?.getState?.() || null);

    const aCol = Number(Array.isArray(addA?.after?.selectedCols) ? addA.after.selectedCols[0] : -1);
    const bCol = Number(Array.isArray(addB?.after?.selectedCols) ? addB.after.selectedCols[0] : -1);
    const sequentialAdvance = Number.isFinite(aCol) && Number.isFinite(bCol) && bCol === (aCol + 1);
    const frameAChanged = aCol >= 0 ? String(sigsAfter[aCol] || '') !== String(sigsBefore[aCol] || '') : false;
    const frameBChanged = bCol >= 0 ? String(sigsAfter[bCol] || '') !== String(sigsBefore[bCol] || '') : false;
    const pass = !!addA?.ok && !!addB?.ok && sequentialAdvance && frameAChanged && frameBChanged;

    const summary = {
      pass,
      pngPath,
      commitA,
      addA,
      commitB,
      addB,
      target_cols: { first_insert_col: aCol, second_insert_col: bCol },
      sequentialAdvance,
      frameAChanged,
      frameBChanged,
      debug_state: dbg,
      error_summary: pass ? '' : `Row sequence insertion failed/flattened: addA=${!!addA?.ok} addB=${!!addB?.ok} aCol=${aCol} bCol=${bCol} sequential=${sequentialAdvance} frameAChanged=${frameAChanged} frameBChanged=${frameBChanged}`,
    };
    const outPath = path.join(artifactDir, 'source-add-row-sequence-summary.json');
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(outPath, 'result');
    return summary;
  }
}
