import path from 'node:path';
import { BaseSubagent } from './base_subagent.mjs';
import { BrowserSkill } from '../core/browser_skill.mjs';
import { ensureDir } from '../core/artifacts.mjs';

export class NavigationAgent extends BaseSubagent {
  constructor(opts) {
    super(opts.name || 'NavigationAgent', opts);
  }

  async run() {
    const { page, baseUrl, routePath = '/', expectText = '', artifactDir } = this.ctx;
    await ensureDir(artifactDir);
    const skill = new BrowserSkill(page, { artifactDir });
    this.step('open_route', { routePath });
    await skill.open_url(new URL(routePath, baseUrl).toString(), { screenshotLabel: `${this.name}_open` });
    const state = await skill.readPageState();
    if (expectText && !String(state.visible_text_summary || '').toLowerCase().includes(String(expectText).toLowerCase())) {
      const shot = await skill.screenshot(`${this.name}_missing_text`);
      this.addArtifact(shot, 'screenshot');
      return { pass: false, error_summary: `Expected text not found: ${expectText}`, page_state: state };
    }
    const finalShot = await skill.screenshot(`${this.name}_done`);
    this.addArtifact(finalShot, 'screenshot');
    return { pass: true, page_state: state };
  }
}
