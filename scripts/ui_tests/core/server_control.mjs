import { spawn } from 'node:child_process';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export async function httpOk(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function ensureFlaskWorkbenchServer(opts = {}) {
  const url = String(opts.baseUrl || 'http://127.0.0.1:5071/workbench');
  const cwd = opts.cwd || process.cwd();
  if (await httpOk(url)) return { started: false, url };
  const proc = spawn('python3', ['-m', 'pipeline_v2.app'], {
    cwd,
    env: { ...process.env, PYTHONPATH: 'src' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logBuf = '';
  proc.stdout.on('data', (d) => { logBuf += d.toString(); process.stdout.write(String(d)); });
  proc.stderr.on('data', (d) => { logBuf += d.toString(); process.stderr.write(String(d)); });
  const deadline = Date.now() + Number(opts.timeoutMs || 30000);
  while (Date.now() < deadline) {
    if (await httpOk(url)) return { started: true, url, proc, logs: () => logBuf };
    if (proc.exitCode != null) break;
    await sleep(250);
  }
  try { proc.kill('SIGTERM'); } catch {}
  throw new Error(`Failed to start Workbench server at ${url}`);
}

export async function stopServer(handle) {
  if (!handle || !handle.proc) return;
  try { handle.proc.kill('SIGTERM'); } catch {}
  await sleep(300);
  if (handle.proc.exitCode == null) {
    try { handle.proc.kill('SIGKILL'); } catch {}
  }
}
