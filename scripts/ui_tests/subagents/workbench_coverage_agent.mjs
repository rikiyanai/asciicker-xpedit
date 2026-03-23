import fs from 'node:fs/promises';
import path from 'node:path';

import { BaseSubagent } from './base_subagent.mjs';
import { BrowserSkill } from '../core/browser_skill.mjs';
import { ensureDir } from '../core/artifacts.mjs';
import { resolveRoute } from '../core/url_helpers.mjs';
import { WorkbenchDockLoadWatchdogAgent } from './workbench_agents.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function existsFile(p) {
  if (!p) return false;
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function defaultWorkbenchPngPath(repoRoot = process.cwd()) {
  const candidates = [
    path.join(repoRoot, 'tests', 'fixtures', 'known_good', 'cat_sheet.png'),
    path.join(repoRoot, 'tests', 'fixtures', 'known_good', 'player_sheet.png'),
  ];
  for (const c of candidates) {
    if (await existsFile(c)) return c;
  }
  return '';
}

function textShort(s, max = 200) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function elementProbe(page, selector) {
  const loc = page.locator(selector).first();
  const count = await page.locator(selector).count();
  if (count <= 0) return { exists: false, selector };
  let visible = false;
  try { visible = await loc.isVisible(); } catch {}
  const state = await loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: String((el.textContent || '')).trim().slice(0, 160),
      disabled: 'disabled' in el ? !!el.disabled : false,
      value: 'value' in el ? String(el.value ?? '') : undefined,
      checked: 'checked' in el ? !!el.checked : undefined,
      className: String(el.className || ''),
      hiddenAttr: !!el.hidden,
      hiddenClass: el.classList ? el.classList.contains('hidden') : false,
      display: String(cs.display || ''),
      visibility: String(cs.visibility || ''),
      opacity: Number(cs.opacity || 1),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
  return { exists: true, visible, ...state, selector };
}

async function clickIfActionable(page, skill, selector, screenshotLabel) {
  const p = await elementProbe(page, selector);
  if (!p.exists) return { action: 'missing', probe: p };
  if (!p.visible) return { action: 'hidden', probe: p };
  if (p.disabled) return { action: 'disabled', probe: p };
  await page.locator(selector).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator(selector).first().click({ timeout: 5000 });
  const shot = await skill.screenshot(screenshotLabel || `click_${selector.replace(/[^a-z0-9_-]+/gi, '_')}`);
  return { action: 'clicked', probe: p, screenshot: shot };
}

function coverageSummaryRows(rows) {
  const counts = { pass: 0, skip: 0, fail: 0, warn: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return counts;
}

export class WorkbenchUICoverageAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'WorkbenchUICoverageAgent', opts);
    this.coverage = [];
  }

  record(panel, key, status, detail = {}) {
    this.coverage.push({ panel, key, status, ...detail });
  }

  async probe(page, panel, key, selector, opts = {}) {
    const p = await elementProbe(page, selector);
    const missingOkay = !!opts.optional;
    if (!p.exists) {
      this.record(panel, key, missingOkay ? 'skip' : 'fail', { selector, reason: missingOkay ? 'optional_missing' : 'missing' });
      return p;
    }
    const hidden = !p.visible || p.hiddenAttr || p.hiddenClass || p.display === 'none' || p.visibility === 'hidden';
    if (opts.expectHidden) {
      this.record(panel, key, hidden ? 'pass' : 'warn', { selector, probe: p, reason: hidden ? 'hidden_present' : 'expected_hidden_but_visible' });
      return p;
    }
    this.record(panel, key, 'pass', { selector, probe: p });
    return p;
  }

  async clickProbe(page, skill, panel, key, selector, opts = {}) {
    const res = await clickIfActionable(page, skill, selector, `touch_${key}`);
    if (res.action === 'clicked') {
      this.record(panel, key, 'pass', { selector, action: 'clicked' });
    } else if (res.action === 'disabled') {
      this.record(panel, key, opts.optional ? 'skip' : 'warn', { selector, action: 'disabled', probe: res.probe });
    } else if (res.action === 'hidden') {
      this.record(panel, key, opts.optional ? 'skip' : 'warn', { selector, action: 'hidden', probe: res.probe });
    } else {
      this.record(panel, key, opts.optional ? 'skip' : 'fail', { selector, action: 'missing' });
    }
    return res;
  }

  async typeProbe(page, skill, panel, key, selector, value, opts = {}) {
    const p = await elementProbe(page, selector);
    if (!p.exists) {
      this.record(panel, key, opts.optional ? 'skip' : 'fail', { selector, action: 'missing' });
      return;
    }
    if (!p.visible || p.disabled) {
      this.record(panel, key, opts.optional ? 'skip' : 'warn', { selector, action: p.disabled ? 'disabled' : 'hidden', probe: p });
      return;
    }
    const loc = page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.fill(String(value));
    await skill.screenshot(`type_${key}`);
    this.record(panel, key, 'pass', { selector, action: 'typed', value: String(value) });
  }

  async toggleProbe(page, skill, panel, key, selector, opts = {}) {
    const p = await elementProbe(page, selector);
    if (!p.exists) {
      this.record(panel, key, opts.optional ? 'skip' : 'fail', { selector, action: 'missing' });
      return;
    }
    if (!p.visible || p.disabled) {
      this.record(panel, key, opts.optional ? 'skip' : 'warn', { selector, action: p.disabled ? 'disabled' : 'hidden', probe: p });
      return;
    }
    await page.locator(selector).first().click();
    await skill.screenshot(`toggle_${key}_1`);
    await page.locator(selector).first().click();
    await skill.screenshot(`toggle_${key}_2`);
    this.record(panel, key, 'pass', { selector, action: 'toggle_twice' });
  }

  async selectProbe(page, skill, panel, key, selector, opts = {}) {
    const p = await elementProbe(page, selector);
    if (!p.exists) {
      this.record(panel, key, opts.optional ? 'skip' : 'fail', { selector, action: 'missing' });
      return;
    }
    if (!p.visible || p.disabled) {
      this.record(panel, key, opts.optional ? 'skip' : 'warn', { selector, action: p.disabled ? 'disabled' : 'hidden', probe: p });
      return;
    }
    const loc = page.locator(selector).first();
    const values = await loc.evaluate((el) => Array.from(el.options || []).map((o) => String(o.value)));
    if (!values.length) {
      this.record(panel, key, 'warn', { selector, action: 'no_options' });
      return;
    }
    const targetValue = opts.value && values.includes(String(opts.value)) ? String(opts.value)
      : values[Math.min(values.length - 1, opts.pickIndex ?? 0)];
    await loc.selectOption(targetValue);
    await skill.screenshot(`select_${key}`);
    this.record(panel, key, 'pass', { selector, action: 'select', value: targetValue });
  }

  async waitForSessionActive(page) {
    await page.waitForFunction(() => /Session active:/i.test(String(document.getElementById('wbStatus')?.textContent || '')), null, { timeout: 240000 });
  }

  async uploadAnalyzeConvert(page, skill, pngPath) {
    this.step('upload_analyze_convert:start', { pngPath });
    await page.setInputFiles('#wbFile', pngPath);
    await skill.screenshot('set_png_file');
    await page.click('#wbUpload');
    await page.waitForFunction(() => {
      const btn = document.getElementById('wbAnalyze');
      return !!btn && !btn.disabled;
    }, null, { timeout: 60000 });
    await skill.screenshot('after_upload_png');
    await page.click('#wbAnalyze');
    await page.waitForFunction(() => {
      const btn = document.getElementById('wbRun');
      const status = String(document.getElementById('wbStatus')?.textContent || '');
      return !!btn && !btn.disabled && /Analyze ready/i.test(status);
    }, null, { timeout: 180000 });
    await skill.screenshot('after_analyze_png');
    await page.click('#wbRun');
    await this.waitForSessionActive(page);
    await page.waitForFunction(() => {
      const btn = document.getElementById('webbuildQuickTestBtn');
      return !!btn && !btn.disabled;
    }, null, { timeout: 240000 });
    await skill.screenshot('after_convert_to_xp');
    this.step('upload_analyze_convert:done');
  }

  async interactSourcePanel(page, skill) {
    const panel = 'Source Panel';
    await this.clickProbe(page, skill, panel, 'sourceSelectBtn', '#sourceSelectBtn');
    await this.clickProbe(page, skill, panel, 'drawBoxBtn', '#drawBoxBtn');
    await this.clickProbe(page, skill, panel, 'rowSelectBtn', '#rowSelectBtn');
    await this.clickProbe(page, skill, panel, 'colSelectBtn', '#colSelectBtn');
    await this.clickProbe(page, skill, panel, 'cutVBtn', '#cutVBtn');
    await this.clickProbe(page, skill, panel, 'deleteBoxBtn', '#deleteBoxBtn');
    await this.clickProbe(page, skill, panel, 'extractBtn', '#extractBtn');
    await this.toggleProbe(page, skill, panel, 'rapidManualAdd', '#rapidManualAdd');
    await this.typeProbe(page, skill, panel, 'threshold', '#threshold', '48');
    await this.typeProbe(page, skill, panel, 'minSize', '#minSize', '8');
    await this.probe(page, panel, 'sourceCanvas', '#sourceCanvas');
    await this.probe(page, panel, 'sourceInfo', '#sourceInfo');

    // Create a draft box so source context menu items can become visible/actionable.
    const canvas = page.locator('#sourceCanvas');
    await canvas.scrollIntoViewIfNeeded().catch(() => {});
    await page.click('#drawBoxBtn').catch(() => {});
    const box = await canvas.boundingBox();
    if (box) {
      const x0 = box.x + Math.max(20, Math.min(80, box.width * 0.15));
      const y0 = box.y + Math.max(20, Math.min(80, box.height * 0.15));
      const x1 = x0 + 80;
      const y1 = y0 + 60;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x1, y1, { steps: 8 });
      await page.mouse.up();
      await skill.screenshot('source_draw_box_draft');
      await page.click('#sourceSelectBtn').catch(() => {});
      await page.mouse.click(x0 + 10, y0 + 10, { button: 'right' });
      await page.waitForTimeout(200);
    }
    const srcMenuVisible = await page.locator('#sourceContextMenu').isVisible().catch(() => false);
    this.record(panel, 'sourceContextMenu', srcMenuVisible ? 'pass' : 'warn', { action: 'contextmenu_open_attempt' });
    await this.probe(page, panel, 'srcCtxAddSprite', '#srcCtxAddSprite');
    await this.probe(page, panel, 'srcCtxAddToRow', '#srcCtxAddToRow');
    await this.probe(page, panel, 'srcCtxSetAnchor', '#srcCtxSetAnchor');
    await this.probe(page, panel, 'srcCtxPadAnchor', '#srcCtxPadAnchor');
    await this.probe(page, panel, 'srcCtxDelete', '#srcCtxDelete');
    await page.keyboard.press('Escape').catch(() => {});
  }

  async selectFirstFrame(page, skill) {
    const firstCell = page.locator('#gridPanel .frame-cell').first();
    if (await firstCell.count()) {
      await firstCell.scrollIntoViewIfNeeded().catch(() => {});
      await firstCell.click();
      await skill.screenshot('grid_select_first_frame');
      this.record('Grid Panel', 'gridPanel_select_frame', 'pass', { action: 'clicked_first_frame' });
      return true;
    }
    this.record('Grid Panel', 'gridPanel_select_frame', 'fail', { reason: 'no_frame_cells' });
    return false;
  }

  async interactGridPanel(page, skill) {
    const panel = 'Grid Panel';
    await this.probe(page, panel, 'gridPanel', '#gridPanel');
    await this.probe(page, panel, 'gridLegacyDebug', '#grid');
    await this.probe(page, panel, 'layerSelect', '#layerSelect');
    await this.probe(page, panel, 'layerVisibility', '#layerVisibility');
    await this.selectFirstFrame(page, skill);
    await this.clickProbe(page, skill, panel, 'rowUpBtn', '#rowUpBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'rowDownBtn', '#rowDownBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'colLeftBtn', '#colLeftBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'colRightBtn', '#colRightBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'deleteCellBtn', '#deleteCellBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'openInspectorBtn', '#openInspectorBtn', { optional: false });
    const rowLabels = await page.locator('#gridPanel .frame-label').count().catch(() => 0);
    this.record(panel, 'frame_labels_present', rowLabels > 0 ? 'pass' : 'warn', { count: rowLabels });

    const firstCell = page.locator('#gridPanel .frame-cell').first();
    if (await firstCell.count()) {
      await firstCell.click({ button: 'right' });
      await page.waitForTimeout(150);
      const visible = await page.locator('#gridContextMenu').isVisible().catch(() => false);
      this.record(panel, 'gridContextMenu', visible ? 'pass' : 'warn', { action: 'contextmenu_open_attempt' });
      await this.probe(page, panel, 'ctxDelete', '#ctxDelete');
      await page.keyboard.press('Escape').catch(() => {});
    }

    // Layer controls (select + first visibility checkbox)
    await this.selectProbe(page, skill, panel, 'layerSelect_select', '#layerSelect', { pickIndex: 0 });
    const layerCb = page.locator('#layerVisibility input[type="checkbox"]').first();
    if (await layerCb.count()) {
      await layerCb.click();
      await skill.screenshot('layer_visibility_toggle_1');
      await layerCb.click();
      await skill.screenshot('layer_visibility_toggle_2');
      this.record(panel, 'layerVisibility_toggle', 'pass', { action: 'toggle_first_checkbox_twice' });
    } else {
      this.record(panel, 'layerVisibility_toggle', 'warn', { reason: 'no_layer_visibility_checkboxes' });
    }
  }

  async interactAnimationMetadata(page, skill) {
    const panel = 'Animation + Metadata';
    await this.selectProbe(page, skill, panel, 'animCategorySelect', '#animCategorySelect', { pickIndex: 0 });
    await this.clickProbe(page, skill, panel, 'assignAnimCategoryBtn', '#assignAnimCategoryBtn', { optional: true });
    await this.typeProbe(page, skill, panel, 'frameGroupName', '#frameGroupName', 'qa_group');
    await this.clickProbe(page, skill, panel, 'assignFrameGroupBtn', '#assignFrameGroupBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'applyGroupsToAnimsBtn', '#applyGroupsToAnimsBtn');
    await this.selectProbe(page, skill, panel, 'jitterAlignMode', '#jitterAlignMode', { pickIndex: 0 });
    await this.selectProbe(page, skill, panel, 'jitterRefMode', '#jitterRefMode', { pickIndex: 0 });
    await this.clickProbe(page, skill, panel, 'autoAlignSelectedBtn', '#autoAlignSelectedBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'autoAlignRowBtn', '#autoAlignRowBtn', { optional: true });
    await this.typeProbe(page, skill, panel, 'jitterRow', '#jitterRow', '0');
    await this.typeProbe(page, skill, panel, 'jitterStep', '#jitterStep', '1');
    await this.clickProbe(page, skill, panel, 'jitterLeftBtn', '#jitterLeftBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'jitterRightBtn', '#jitterRightBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'jitterUpBtn', '#jitterUpBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'jitterDownBtn', '#jitterDownBtn', { optional: true });
    await this.probe(page, panel, 'jitterInfo', '#jitterInfo');
    await this.probe(page, panel, 'metaOut', '#metaOut');
  }

  async interactXpPreview(page, skill) {
    const panel = 'XP Preview';
    await this.clickProbe(page, skill, panel, 'playBtn', '#playBtn');
    await this.typeProbe(page, skill, panel, 'fpsInput', '#fpsInput', '8');
    await this.typeProbe(page, skill, panel, 'previewAngle', '#previewAngle', '0');
    await this.clickProbe(page, skill, panel, 'stopBtn', '#stopBtn');
    await this.probe(page, panel, 'previewCanvas', '#previewCanvas');
  }

  async interactSessionPanel(page) {
    const panel = 'Session';
    await this.probe(page, panel, 'sessionOut', '#sessionOut');
  }

  async interactSkinDock(page, skill) {
    const panel = 'Skin Test Dock (Flat Arena)';
    await this.probe(page, panel, 'webbuildQuickTestBtn', '#webbuildQuickTestBtn');
    await this.probe(page, panel, 'webbuildUploadTestBtn', '#webbuildUploadTestBtn');
    await this.probe(page, panel, 'webbuildState', '#webbuildState');
    await this.probe(page, panel, 'webbuildFrame', '#webbuildFrame');
    await this.clickProbe(page, skill, panel, 'webbuildQuickTestBtn_click', '#webbuildQuickTestBtn', { optional: true });
    // Wait a short window and capture debug state classification without blocking the coverage run.
    const start = Date.now();
    let snapshots = [];
    while (Date.now() - start < 15000) {
      const snap = await page.evaluate(() => {
        if (window.__wb_debug && typeof window.__wb_debug.getWebbuildDebugState === 'function') {
          return window.__wb_debug.getWebbuildDebugState();
        }
        return {
          wbStatus: String(document.getElementById('wbStatus')?.textContent || ''),
          webbuildState: String(document.getElementById('webbuildState')?.textContent || ''),
        };
      });
      snapshots.push({ t_ms: Date.now() - start, snap });
      if (/skin applied|webbuild ready/i.test(String(snap.webbuildState || ''))) break;
      await sleep(1000);
    }
    const last = snapshots[snapshots.length - 1]?.snap || {};
    const ready = /skin applied|webbuild ready/i.test(String(last.webbuildState || ''));
    this.record(panel, 'webbuild_quick_test_progress', ready ? 'pass' : 'warn', {
      duration_ms: Date.now() - start,
      wbStatus: String(last.wbStatus || ''),
      webbuildState: String(last.webbuildState || ''),
    });
    const timelinePath = path.join(this.ctx.artifactDir, 'skin-dock-short-timeline.json');
    await fs.writeFile(timelinePath, JSON.stringify(snapshots, null, 2), 'utf-8');
    this.addArtifact(timelinePath, 'result');

    // Hidden advanced controls are part of the coverage catalog, but intentionally hidden in UX.
    await this.probe(page, panel, 'webbuildApplyInPlaceBtn', '#webbuildApplyInPlaceBtn', { expectHidden: true });
    await this.probe(page, panel, 'webbuildApplyRestartBtn', '#webbuildApplyRestartBtn', { expectHidden: true });
    await this.probe(page, panel, 'webbuildOpenBtn', '#webbuildOpenBtn', { expectHidden: true });
    await this.probe(page, panel, 'webbuildReloadBtn', '#webbuildReloadBtn', { expectHidden: true });
    await this.probe(page, panel, 'webbuildApplySkinBtn', '#webbuildApplySkinBtn', { expectHidden: true });
    await this.probe(page, panel, 'webbuildOut', '#webbuildOut', { expectHidden: true });
  }

  async interactVerificationExport(page, skill) {
    const verifyPanel = 'Verification (Term++ / QA)';
    await this.selectProbe(page, skill, verifyPanel, 'verifyProfile', '#verifyProfile', { pickIndex: 0 });
    await this.typeProbe(page, skill, verifyPanel, 'verifyTimeout', '#verifyTimeout', '20');
    await this.typeProbe(page, skill, verifyPanel, 'verifyCommandTemplate', '#verifyCommandTemplate', 'cd {legacy_repo_root} && echo {xp_path}');
    await this.clickProbe(page, skill, verifyPanel, 'verifyDryRunBtn', '#verifyDryRunBtn', { optional: true });
    await this.clickProbe(page, skill, verifyPanel, 'verifyRunBtn', '#verifyRunBtn', { optional: true });
    await this.probe(page, verifyPanel, 'verifySummaryOut', '#verifySummaryOut');
    await this.probe(page, verifyPanel, 'verifyLogOut', '#verifyLogOut');

    const exportPanel = 'Export';
    await this.clickProbe(page, skill, exportPanel, 'btnExport', '#btnExport', { optional: true });
    await this.probe(page, exportPanel, 'openXpToolBtn', '#openXpToolBtn');
    await this.probe(page, exportPanel, 'xpToolCommandHint', '#xpToolCommandHint');
    await this.probe(page, exportPanel, 'exportOut', '#exportOut');
    await this.clickProbe(page, skill, exportPanel, 'openXpToolBtn_click', '#openXpToolBtn', { optional: true });
  }

  async interactTopBar(page, skill) {
    const panel = 'Top Bar';
    await this.probe(page, panel, 'sessionDirtyBadge', '#sessionDirtyBadge');
    await this.probe(page, panel, 'wbStatus', '#wbStatus');
    await this.clickProbe(page, skill, panel, 'undoBtn', '#undoBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'redoBtn', '#redoBtn', { optional: true });
    await this.clickProbe(page, skill, panel, 'btnExport_top', '#btnExport', { optional: true });
    await this.clickProbe(page, skill, panel, 'btnLoad', '#btnLoad', { optional: true });
  }

  async interactUploadConvertPanel(page, skill, pngPath) {
    const panel = 'Upload + Convert (Workbench Direct)';
    await this.probe(page, panel, 'wbFile', '#wbFile');
    await this.probe(page, panel, 'wbUpload', '#wbUpload');
    await this.probe(page, panel, 'wbAnalyze', '#wbAnalyze');
    await this.probe(page, panel, 'wbRun', '#wbRun');
    await this.typeProbe(page, skill, panel, 'wbName', '#wbName', 'qa_sprite');
    await this.typeProbe(page, skill, panel, 'wbAngles', '#wbAngles', '1');
    await this.typeProbe(page, skill, panel, 'wbFrames', '#wbFrames', '1');
    await this.typeProbe(page, skill, panel, 'wbSourceProjs', '#wbSourceProjs', '1');
    await this.typeProbe(page, skill, panel, 'wbRenderRes', '#wbRenderRes', '12');
    await this.probe(page, panel, 'wbRunOut', '#wbRunOut');
    if (pngPath) {
      await this.uploadAnalyzeConvert(page, skill, pngPath);
      // Re-probe post-convert states because many buttons/flows are session-gated.
      await this.probe(page, panel, 'wbAnalyze_post_convert', '#wbAnalyze');
      await this.probe(page, panel, 'wbRun_post_convert', '#wbRun');
    } else {
      this.record(panel, 'upload_analyze_convert_flow', 'skip', { reason: 'no_png_path' });
    }
  }

  async interactXpEditor(page, skill) {
    const panel = 'XP Editor (Frame)';
    const isOpen = await page.evaluate(() => {
      if (window.__wb_debug && typeof window.__wb_debug.openInspector === 'function') {
        window.__wb_debug.openInspector(0, 0);
        return !!window.__wb_debug.getInspectorState?.().open;
      }
      return false;
    }).catch(() => false);
    if (!isOpen) {
      this.record(panel, 'open', 'fail', { reason: 'debug_openInspector_failed' });
      return;
    }
    await page.locator('#cellInspectorPanel').scrollIntoViewIfNeeded().catch(() => {});
    await sleep(150);
    await skill.screenshot('xp_editor_opened');
    this.record(panel, 'open', 'pass');

    const clickIds = [
      'inspectorPrevAngleBtn', 'inspectorNextAngleBtn', 'inspectorPrevFrameBtn', 'inspectorNextFrameBtn',
      'inspectorToolInspectBtn', 'inspectorToolSelectBtn', 'inspectorToolGlyphBtn', 'inspectorToolPaintBtn', 'inspectorToolEraseBtn', 'inspectorToolDropperBtn',
      'inspectorCopyFrameBtn', 'inspectorPasteFrameBtn', 'inspectorFlipHBtn', 'inspectorClearFrameBtn',
      'inspectorCopySelBtn', 'inspectorPasteSelBtn', 'inspectorCutSelBtn', 'inspectorClearSelBtn', 'inspectorSelectAllBtn', 'inspectorFillSelBtn',
      'inspectorReplaceFgBtn', 'inspectorReplaceBgBtn',
      'inspectorRotateSelCwBtn', 'inspectorRotateSelCcwBtn', 'inspectorFlipSelHBtn', 'inspectorFlipSelVBtn',
      'inspectorBgTransparentBtn',
      'inspectorFindReplaceApplyBtn',
    ];
    const probeIds = [
      'inspectorCloseBtn', 'inspectorZoom', 'inspectorZoomValue', 'inspectorDirtyBadge', 'inspectorPaintColor',
      'inspectorGlyphCode', 'inspectorGlyphChar', 'inspectorGlyphFgColor', 'inspectorGlyphBgColor',
      'inspectorShowGrid', 'inspectorShowChecker',
      'inspectorPaletteSwatches', 'inspectorMatchSourceInfo', 'inspectorHoverReadout', 'inspectorPasteAnchorReadout',
      'inspectorFindReplaceDetails', 'inspectorShortcutsDetails', 'inspectorToolHint', 'cellInspectorCanvas', 'cellInspectorInfo',
      'inspectorFrMatchGlyphChk', 'inspectorFrFindGlyph', 'inspectorFrMatchFgChk', 'inspectorFrFindFg', 'inspectorFrMatchBgChk', 'inspectorFrFindBg',
      'inspectorFrReplaceGlyphChk', 'inspectorFrReplGlyph', 'inspectorFrReplaceFgChk', 'inspectorFrReplFg', 'inspectorFrReplaceBgChk', 'inspectorFrReplBg',
      'inspectorFrScope', 'inspectorFindReplaceInfo'
    ];
    for (const id of probeIds) await this.probe(page, panel, id, `#${id}`);

    await this.typeProbe(page, skill, panel, 'inspectorGlyphCode', '#inspectorGlyphCode', '64');
    await this.typeProbe(page, skill, panel, 'inspectorGlyphChar', '#inspectorGlyphChar', '@');
    // color inputs
    await page.locator('#inspectorGlyphFgColor').fill('#00ff00').catch(() => {});
    await skill.screenshot('xp_editor_fg_color_set');
    this.record(panel, 'inspectorGlyphFgColor_set', 'pass', { action: 'fill_color', value: '#00ff00' });
    await page.locator('#inspectorGlyphBgColor').fill('#ff00ff').catch(() => {});
    await skill.screenshot('xp_editor_bg_color_set');
    this.record(panel, 'inspectorGlyphBgColor_set', 'pass', { action: 'fill_color', value: '#ff00ff' });
    await page.locator('#inspectorPaintColor').fill('#3366ff').catch(() => {});
    await skill.screenshot('xp_editor_paint_color_set');
    this.record(panel, 'inspectorPaintColor_set', 'pass', { action: 'fill_color', value: '#3366ff' });

    // Open details panels.
    const frDetails = page.locator('#inspectorFindReplaceDetails');
    if (await frDetails.count()) {
      await frDetails.evaluate((el) => { el.open = true; });
      await skill.screenshot('xp_editor_find_replace_open');
      this.record(panel, 'inspectorFindReplaceDetails_open', 'pass', { action: 'details_open' });
    }
    const shortcutsDetails = page.locator('#inspectorShortcutsDetails');
    if (await shortcutsDetails.count()) {
      await shortcutsDetails.evaluate((el) => { el.open = true; });
      await skill.screenshot('xp_editor_shortcuts_open');
      this.record(panel, 'inspectorShortcutsDetails_open', 'pass', { action: 'details_open' });
    }

    // Select all so selection-gated buttons become actionable where possible.
    await this.clickProbe(page, skill, panel, 'inspectorSelectAllBtn_click', '#inspectorSelectAllBtn', { optional: true });

    // Canvas interactions for Inspect/Glyph/Paint/Erase/Dropper and match source.
    const canvas = page.locator('#cellInspectorCanvas');
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + Math.min(40, box.width / 3);
      const cy = box.y + Math.min(40, box.height / 3);
      await page.click('#inspectorToolInspectBtn').catch(() => {});
      await page.mouse.click(cx, cy);
      await page.click('#inspectorToolGlyphBtn').catch(() => {});
      await page.mouse.click(cx + 16, cy + 16);
      await page.click('#inspectorToolPaintBtn').catch(() => {});
      await page.mouse.click(cx + 32, cy + 16);
      await page.click('#inspectorToolEraseBtn').catch(() => {});
      await page.mouse.click(cx + 48, cy + 16);
      await page.click('#inspectorToolDropperBtn').catch(() => {});
      await page.mouse.click(cx, cy);
      await skill.screenshot('xp_editor_canvas_tool_interactions');
      this.record(panel, 'cellInspectorCanvas_tools', 'pass', { action: 'inspect_glyph_paint_erase_dropper_clicks' });
      // drag selection gesture
      await page.click('#inspectorToolSelectBtn').catch(() => {});
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 64, cy + 48, { steps: 6 });
      await page.mouse.up();
      await skill.screenshot('xp_editor_canvas_selection_drag');
      this.record(panel, 'cellInspectorCanvas_select_drag', 'pass', { action: 'drag_selection' });
    } else {
      this.record(panel, 'cellInspectorCanvas_tools', 'warn', { reason: 'no_bounding_box' });
    }

    // Selection/readout and palette touches.
    const swatches = page.locator('#inspectorPaletteSwatches button, #inspectorPaletteSwatches [data-color]');
    const swCount = await swatches.count().catch(() => 0);
    if (swCount > 0) {
      const first = swatches.nth(0);
      await first.click().catch(() => {});
      if (swCount > 1) await swatches.nth(1).click({ button: 'right' }).catch(() => {});
      await skill.screenshot('xp_editor_palette_touches');
      this.record(panel, 'inspectorPaletteSwatches_click_rightclick', 'pass', { swatch_count: swCount });
    } else {
      this.record(panel, 'inspectorPaletteSwatches_click_rightclick', 'warn', { reason: 'no_swatch_nodes_found' });
    }

    await this.toggleProbe(page, skill, panel, 'inspectorShowGrid', '#inspectorShowGrid');
    await this.toggleProbe(page, skill, panel, 'inspectorShowChecker', '#inspectorShowChecker');
    await this.selectProbe(page, skill, panel, 'inspectorFrScope', '#inspectorFrScope', { pickIndex: 0 });

    for (const id of clickIds) {
      // Skip close until the end.
      if (id === 'inspectorCloseBtn') continue;
      await this.clickProbe(page, skill, panel, id, `#${id}`, { optional: true });
    }

    // Keyboard shortcuts touch pass (avoid text inputs)
    await page.locator('body').click({ position: { x: 10, y: 10 } }).catch(() => {});
    const keys = ['g', 's', 'p', 'e', 'i', 'q', 'r', 'a', 'd', 'c', 'x', 'v', 'Delete', 'Escape', 'ControlOrMeta+A', '[', ']', 'f'];
    for (const key of keys) {
      await page.keyboard.press(key).catch(() => {});
      await sleep(40);
    }
    await skill.screenshot('xp_editor_shortcuts_touch');
    this.record(panel, 'shortcuts_touch', 'pass', { keys });

    await this.clickProbe(page, skill, panel, 'inspectorCloseBtn', '#inspectorCloseBtn', { optional: true });
  }

  async probeTermppHiddenPanel(page) {
    const panel = 'TERM++ Skin (Real Game Instance)';
    await this.probe(page, panel, 'termppNativePanel', '#termppNativePanel', { expectHidden: true });
    const ids = [
      'termppBinary', 'termppSkinCmdBtn', 'termppSkinLaunchBtn',
      'termppStreamX', 'termppStreamY', 'termppStreamW', 'termppStreamH', 'termppStreamFps',
      'termppStreamPreviewBtn', 'termppStreamStartBtn', 'termppStreamStopBtn',
      'termppStreamImg', 'termppStreamInfo', 'termppSkinOut'
    ];
    for (const id of ids) {
      await this.probe(page, panel, id, `#${id}`, { expectHidden: true });
    }
  }

  async run() {
    const { page, baseUrl, artifactDir, pngPath: ctxPng, headed = false, timeoutSec = 240, moveSec = 4 } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    const pngPath = ctxPng || await defaultWorkbenchPngPath(process.cwd());
    this.step('coverage_start', { baseUrl, pngPath: pngPath || null });

    await skill.open_url(resolveRoute(baseUrl, '/workbench'), { screenshotLabel: 'workbench_ui_coverage_open' });
    await page.waitForSelector('#wbUpload', { state: 'visible', timeout: 30000 });

    await this.interactTopBar(page, skill);
    await this.interactUploadConvertPanel(page, skill, pngPath);
    await this.interactSourcePanel(page, skill);
    await this.interactGridPanel(page, skill);
    await this.interactAnimationMetadata(page, skill);
    await this.interactXpPreview(page, skill);
    await this.interactSessionPanel(page);
    await this.interactSkinDock(page, skill);
    await this.interactVerificationExport(page, skill);
    await this.probeTermppHiddenPanel(page);
    await this.interactXpEditor(page, skill);

    // Optional delegated watchdog run to validate dock->playability in the same framework session.
    if (pngPath) {
      const watchdogDir = path.join(artifactDir, 'dock-load-watchdog-delegate');
      await ensureDir(watchdogDir);
      const watchdog = new WorkbenchDockLoadWatchdogAgent({
        baseUrl,
        artifactDir: watchdogDir,
        pngPath,
        headed,
        timeoutSec,
        moveSec,
      });
      this.step('delegate_watchdog_start');
      const delegated = await watchdog.execute();
      this.step('delegate_watchdog_done', { pass: !!delegated.pass });
      for (const a of delegated.artifacts || []) this.addArtifact(a.path, a.kind);
      this.record('Skin Test Dock (Flat Arena)', 'delegate_watchdog', delegated.pass ? 'pass' : 'warn', {
        error_summary: delegated.error_summary || '',
        stage: delegated?.data?.watchdog?.classification?.stage || '',
      });
    } else {
      this.record('Skin Test Dock (Flat Arena)', 'delegate_watchdog', 'skip', { reason: 'no_png_path' });
    }

    const counts = coverageSummaryRows(this.coverage);
    const failures = this.coverage.filter((r) => r.status === 'fail');
    const warns = this.coverage.filter((r) => r.status === 'warn');
    const summary = {
      pass: failures.length === 0,
      coverage_counts: counts,
      coverage_rows: this.coverage,
      failures,
      warnings: warns.slice(0, 200),
      notes: [
        'This coverage agent is a UI-touch matrix (presence/visibility/clickability/type/toggle) and not full functional parity validation for every control.',
        'Hidden advanced controls and hidden TERM++ panel controls are tracked as hidden-present probes by design.',
      ],
    };
    const out = path.join(artifactDir, 'workbench-ui-coverage-summary.json');
    await fs.writeFile(out, JSON.stringify(summary, null, 2), 'utf-8');
    this.addArtifact(out, 'result');
    await skill.screenshot('workbench_ui_coverage_final');

    return summary;
  }
}

