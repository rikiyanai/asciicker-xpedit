import path from 'node:path';
import { ensureDir, writeJson } from '../core/artifacts.mjs';

export class BaseSubagent {
  constructor(name, ctx = {}) {
    this.name = name;
    this.ctx = ctx;
    this.steps = [];
    this.artifacts = [];
  }

  step(name, detail = {}) {
    this.steps.push({ t: new Date().toISOString(), name, ...detail });
  }

  addArtifact(file, kind = 'file') {
    this.artifacts.push({ kind, path: file });
  }

  async saveResult(dir, payload) {
    const out = path.join(dir, 'result.json');
    await writeJson(out, payload);
    this.addArtifact(out, 'result');
    return out;
  }

  async execute() {
    const started = Date.now();
    let pass = false;
    let errorSummary = '';
    try {
      const data = await this.run();
      pass = !!data?.pass;
      return {
        pass,
        steps_run: this.steps,
        artifacts: this.artifacts,
        error_summary: data?.error_summary || '',
        data,
        duration_ms: Date.now() - started,
      };
    } catch (e) {
      errorSummary = String(e?.stack || e);
      return {
        pass: false,
        steps_run: this.steps,
        artifacts: this.artifacts,
        error_summary: errorSummary,
        duration_ms: Date.now() - started,
      };
    }
  }
}
