import path from 'node:path';
import { appendJsonl, safeName } from './artifacts.mjs';

function shortVisibleText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export class BrowserSkill {
  constructor(page, opts = {}) {
    this.page = page;
    this.artifactDir = opts.artifactDir || process.cwd();
    this.logPath = path.join(this.artifactDir, 'actions.jsonl');
    this.screenshotDir = path.join(this.artifactDir, 'screenshots');
    this.stepIndex = 0;
    this.defaultTimeoutMs = Number(opts.defaultTimeoutMs || 30000);
    this.verbose = opts.verbose !== false;
  }

  async _log(row) {
    await appendJsonl(this.logPath, { ts: new Date().toISOString(), ...row });
    if (this.verbose) {
      const extra = row.detail ? ` ${JSON.stringify(row.detail)}` : '';
      console.log(`[skill] ${row.kind}:${row.action}${extra}`);
    }
  }

  async screenshot(label = 'step', extra = {}) {
    this.stepIndex += 1;
    const name = `${String(this.stepIndex).padStart(3, '0')}_${safeName(label)}.png`;
    const filePath = path.join(this.screenshotDir, name);
    await this.page.screenshot({ path: filePath, fullPage: true });
    await this._log({ kind: 'artifact', action: 'screenshot', label, detail: { path: filePath, ...extra } });
    return filePath;
  }

  locatorFor(target) {
    if (!target) throw new Error('target is required');
    if (typeof target === 'string') return this.page.locator(target);
    if (target.selector) return this.page.locator(String(target.selector));
    if (target.role) return this.page.getByRole(String(target.role), target.name ? { name: target.name } : undefined);
    if (target.text) return this.page.getByText(String(target.text), target.exact ? { exact: true } : undefined);
    if (target.label) return this.page.getByLabel(String(target.label), target.exact ? { exact: true } : undefined);
    if (target.placeholder) return this.page.getByPlaceholder(String(target.placeholder), target.exact ? { exact: true } : undefined);
    throw new Error(`unsupported target descriptor: ${JSON.stringify(target)}`);
  }

  async readPageState() {
    const data = await this.page.evaluate(() => {
      const bodyText = document.body ? (document.body.innerText || '') : '';
      return {
        url: String(location.href),
        title: String(document.title || ''),
        visibleText: String(bodyText || ''),
      };
    });
    const state = {
      url: String(data.url || ''),
      title: String(data.title || ''),
      visible_text_summary: shortVisibleText(data.visibleText),
    };
    await this._log({ kind: 'read', action: 'page_state', detail: state });
    return state;
  }

  async open_url(url, opts = {}) {
    await this._log({ kind: 'intent', action: 'open_url', detail: { url } });
    await this.page.goto(url, { waitUntil: opts.waitUntil || 'domcontentloaded', timeout: opts.timeoutMs || this.defaultTimeoutMs });
    const state = await this.readPageState();
    const shot = await this.screenshot(opts.screenshotLabel || 'open_url');
    return { state, screenshot: shot };
  }

  async click(target, opts = {}) {
    const loc = this.locatorFor(target);
    await this._log({ kind: 'intent', action: 'click', detail: { target } });
    if (opts.scroll !== false) await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: opts.timeoutMs || this.defaultTimeoutMs });
    const shot = await this.screenshot(opts.screenshotLabel || 'click');
    return { screenshot: shot };
  }

  async type(target, text, opts = {}) {
    const loc = this.locatorFor(target);
    await this._log({ kind: 'intent', action: 'type', detail: { target, text: opts.redact ? '<redacted>' : String(text) } });
    if (opts.clear !== false) await loc.fill('', { timeout: opts.timeoutMs || this.defaultTimeoutMs });
    await loc.fill(String(text), { timeout: opts.timeoutMs || this.defaultTimeoutMs });
    const shot = await this.screenshot(opts.screenshotLabel || 'type');
    return { screenshot: shot };
  }

  async press_key(key, opts = {}) {
    await this._log({ kind: 'intent', action: 'press_key', detail: { key } });
    await this.page.keyboard.press(String(key), { delay: opts.delay || 0 });
    const shot = await this.screenshot(opts.screenshotLabel || `press_${key}`);
    return { screenshot: shot };
  }

  async wait_for(condition, opts = {}) {
    const timeoutMs = opts.timeoutMs || this.defaultTimeoutMs;
    await this._log({ kind: 'intent', action: 'wait_for', detail: { condition, timeoutMs } });
    if (condition.selector) {
      await this.page.waitForSelector(String(condition.selector), { state: condition.state || 'visible', timeout: timeoutMs });
    } else if (condition.text) {
      const loc = this.page.getByText(String(condition.text), condition.exact ? { exact: true } : undefined);
      await loc.waitFor({ state: condition.state || 'visible', timeout: timeoutMs });
    } else if (condition.functionBody) {
      await this.page.waitForFunction(condition.functionBody, condition.arg, { timeout: timeoutMs });
    } else {
      throw new Error(`unsupported wait condition: ${JSON.stringify(condition)}`);
    }
    const shot = await this.screenshot(opts.screenshotLabel || 'wait_for');
    return { screenshot: shot };
  }
}
