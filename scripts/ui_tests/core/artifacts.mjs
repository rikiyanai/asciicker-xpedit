import fs from 'node:fs/promises';
import path from 'node:path';

export function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function createRunDir(rootName, repoRoot = process.cwd()) {
  const dir = path.join(repoRoot, 'artifacts', 'ui-tests', `${rootName}-${isoStamp()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function safeName(s) {
  return String(s || 'step').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function appendJsonl(filePath, row) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, JSON.stringify(row) + '\n');
}
