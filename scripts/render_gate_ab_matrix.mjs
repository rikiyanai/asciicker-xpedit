#!/usr/bin/env node
/**
 * A/B matrix test for the render gate experiment.
 *
 * Matrix: skin × map × gate
 *   skin:  problematic (216×32 a=4 n=9), stock_like (264×72 a=9 n=11)
 *   map:   game_map_y8_original_game_map.a3d, minimal_2x2.a3d, minimal_1x1.a3d
 *   gate:  off (0), on (1500)
 *
 * Each cell runs N times (default 10).  Per-run, the script:
 *   1. Opens the workbench with flatmap + rendergate_ms params
 *   2. Uploads the XP via the upload-test input
 *   3. Monitors for 20 s, recording crashes and game-state probes
 *
 * Usage:
 *   node scripts/render_gate_ab_matrix.mjs [--runs N] [--gate-ms N] [--url URL] [--headed]
 */
import fs from "node:fs/promises";
import fssync from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ── Playwright import ──────────────────────────────────────────────
async function loadPlaywright() {
  try {
    const m = await import("playwright");
    if (m.chromium) return m;
    if (m.default?.chromium) return m.default;
    throw new Error("no chromium");
  } catch (_e) {
    const fallback = path.join(
      os.homedir(),
      ".codex/skills/develop-web-game/node_modules/playwright/index.js",
    );
    const m = await import(pathToFileURL(fallback).href);
    if (m.chromium) return m;
    if (m.default?.chromium) return m.default;
    if (m["module.exports"]?.chromium) return m["module.exports"];
    throw new Error("playwright not found");
  }
}

// ── Args ───────────────────────────────────────────────────────────
function parseArgs() {
  const out = {
    runs: 10,
    gateMs: 1500,
    url: "http://127.0.0.1:5071/workbench",
    headed: false,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--runs" && argv[i + 1]) out.runs = Math.max(1, Number(argv[++i]) || 10);
    else if (a === "--gate-ms" && argv[i + 1]) out.gateMs = Math.max(100, Number(argv[++i]) || 1500);
    else if (a === "--url" && argv[i + 1]) out.url = argv[++i];
    else if (a === "--headed") out.headed = true;
  }
  return out;
}

// ── XP fixtures ────────────────────────────────────────────────────
// Generate if missing (idempotent).
async function ensureXpFixtures() {
  const problematic = "/tmp/xp_test_real_session.xp";
  const stockLike = "/tmp/xp_test_stock_like.xp";
  if (fssync.existsSync(problematic) && fssync.existsSync(stockLike)) return { problematic, stockLike };
  // Lazy-generate via Python
  const { spawnSync } = await import("node:child_process");
  const py = `
import sys, json; sys.path.insert(0,"src")
from pipeline_v2.xp_codec import write_xp
M=(255,0,255)
def tc(): return (0,(0,0,0),M)
def dg(v):
  if 0<=v<=9: return 48+v
  if 10<=v<=35: return 65+(v-10)
  return 0
def mk(p,c,r,a,nl,cells=None):
  bl=[tc() for _ in range(c*r)]
  if cells is None: cells=[(219,(200,200,200),(50,50,50)) for _ in range(c*r)]
  meta=[tc() for _ in range(c*r)]
  meta[0]=(dg(a),(255,255,255),(0,0,0))
  for i,v in enumerate(nl,1):
    if i>=c: break
    meta[i]=(dg(v),(255,255,255),(0,0,0))
  write_xp(p,c,r,[meta,bl,cells,bl])
sess=json.load(open("data/sessions/49f4c0fe-ec92-4a90-b518-78068a6caeaf.json"))
rc=[(int(c["glyph"]),tuple(c["fg"]),tuple(c["bg"])) for c in sess["cells"]]
mk("/tmp/xp_test_real_session.xp",216,32,4,[9],rc)
mk("/tmp/xp_test_stock_like.xp",264,72,9,[11])
print("ok")
`;
  const res = spawnSync("python3", ["-c", py], { cwd: process.cwd(), encoding: "utf-8" });
  if (res.status !== 0) throw new Error("fixture gen failed: " + (res.stderr || res.stdout));
  return { problematic, stockLike };
}

// ── Matrix definition ──────────────────────────────────────────────
function buildMatrix(args, fixtures) {
  const skins = [
    { id: "problematic", file: fixtures.problematic, label: "216×32 a=4 n=9" },
    { id: "stock_like", file: fixtures.stockLike, label: "264×72 a=9 n=11" },
  ];
  const maps = [
    "game_map_y8_original_game_map.a3d",
    "minimal_2x2.a3d",
    "minimal_1x1.a3d",
  ];
  const gates = [
    { id: "off", ms: 0 },
    { id: "on", ms: args.gateMs },
  ];
  const cells = [];
  for (const skin of skins) {
    for (const map of maps) {
      for (const gate of gates) {
        cells.push({ skin, map, gate });
      }
    }
  }
  return cells;
}

// ── Single run ─────────────────────────────────────────────────────
const MONITOR_MS = 20000;

async function runOnce(browser, baseUrl, cell, headed) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  let remainderCount = 0;
  let otherCrashCount = 0;
  let worldReadyEver = false;
  let posNanWhenReady = false;
  let stuckMenu = false;
  let renderStageMax = 0;
  let gateBlocked = 0;
  let gateFirstRealMs = 0;
  let gateBlockedFromConsole = 0;

  page.on("console", (msg) => {
    const text = msg.text();
    if (/remainder by zero/i.test(text)) remainderCount++;
    else if (/unreachable|memory access out of bounds|function signature mismatch/i.test(text)) otherCrashCount++;
    // Parse gate telemetry from bootstrap console logs
    const gateMatch = text.match(/render gate opened: blocked_count=(\d+)/);
    if (gateMatch) gateBlockedFromConsole = Math.max(gateBlockedFromConsole, Number(gateMatch[1]) || 0);
  });

  try {
    const wbUrl = `${baseUrl}?flatmap=${encodeURIComponent(cell.map)}&rendergate_ms=${cell.gate.ms}`;
    await page.goto(wbUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(800);

    // Wait for preflight
    await page.waitForFunction(() => {
      const s = window.__wb_debug?.getWebbuildDebugState?.();
      return !!(s?.runtimePreflight?.checked);
    }, { timeout: 30000 });

    // Wait for upload button
    await page.waitForSelector("#webbuildUploadTestBtn:not([disabled])", { timeout: 60000 });
    await page.waitForTimeout(200);

    // Upload XP
    await page.setInputFiles("#webbuildUploadTestInput", cell.skin.file);

    // Wait for applied
    await page.waitForFunction(() => {
      const st = document.getElementById("wbStatus");
      return st && /uploaded test skin applied|skin applied/i.test(st.textContent || "");
    }, { timeout: 30000 }).catch(() => {});

    // Monitor
    const t0 = Date.now();
    while (Date.now() - t0 < MONITOR_MS) {
      await page.waitForTimeout(2000);
      if (remainderCount > 20) break;

      const probe = await page.evaluate(() => {
        const frame = document.getElementById("webbuildFrame");
        if (!frame?.contentWindow) return null;
        const win = frame.contentWindow;
        try {
          let pos = null;
          if (win.ak?.getPos) { const p = [0, 0, 0]; win.ak.getPos(p, 0); pos = p; }
          const fmInfo = win.__termppFlatMap?.info?.() || {};
          return {
            worldReady: win.GameWorldReady?.() ?? 0,
            renderStage: win.GetRenderStageCode?.() ?? 0,
            mainMenu: win.GameMainMenuActive?.() ?? 0,
            pos,
            water: win.ak?.getWater?.() ?? null,
            gateBlocked: fmInfo.render_gate_blocked ?? 0,
            gateFirstRealMs: fmInfo.render_gate_first_real_ms ?? 0,
          };
        } catch (_e) { return null; }
      }).catch(() => null);

      if (!probe) continue;

      const stage = Number(probe.renderStage) || 0;
      if (stage > renderStageMax) renderStageMax = stage;

      const wr = (probe.worldReady === true || Number(probe.worldReady) === 1);
      if (wr) worldReadyEver = true;

      if (wr && probe.pos) {
        const hasNaN = probe.pos.some((v) => v === null || !isFinite(Number(v)));
        if (hasNaN) posNanWhenReady = true;
      }

      const mm = (probe.mainMenu === true || Number(probe.mainMenu) === 1);
      if (mm && Date.now() - t0 > 15000) stuckMenu = true;

      const probeGblk = Number(probe.gateBlocked) || 0;
      if (probeGblk > gateBlocked) gateBlocked = probeGblk;
      const probeGfr = Number(probe.gateFirstRealMs) || 0;
      if (probeGfr > gateFirstRealMs) gateFirstRealMs = probeGfr;
    }

    // Prefer console-reported gate count (most reliable — from bootstrap log)
    const finalGateBlocked = Math.max(gateBlocked, gateBlockedFromConsole);
    const wasmCrash = remainderCount > 0 || otherCrashCount > 50;

    return {
      remainder: remainderCount,
      other: otherCrashCount,
      wasm_crash: wasmCrash,
      pos_nan_when_ready: posNanWhenReady,
      stuck_menu: stuckMenu,
      world_ready: worldReadyEver,
      render_stage_max: renderStageMax,
      gate_blocked: finalGateBlocked,
      gate_first_real_ms: gateFirstRealMs,
    };
  } finally {
    await context.close();
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  const fixtures = await ensureXpFixtures();
  const matrix = buildMatrix(args, fixtures);

  const { chromium } = await loadPlaywright();
  const launchArgs = args.headed
    ? []
    : ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const browser = await chromium.launch({ headless: !args.headed, args: launchArgs });

  console.log(`=== Render Gate A/B Matrix ===`);
  console.log(`Runs per cell: ${args.runs}  |  Gate ms: ${args.gateMs}  |  Cells: ${matrix.length}`);
  console.log(`Total runs: ${matrix.length * args.runs}\n`);

  const allResults = [];

  for (const cell of matrix) {
    const cellLabel = `${cell.skin.id} | ${cell.map.replace(".a3d", "").replace("game_map_y8_original_game_map", "y8")} | gate=${cell.gate.id}`;
    process.stdout.write(`[${cellLabel}]\n`);

    const runs = [];
    for (let i = 0; i < args.runs; i++) {
      const r = await runOnce(browser, args.url, cell, args.headed);
      runs.push(r);
      const tag = r.wasm_crash ? "CRASH" : (r.stuck_menu ? "STUCK" : (r.pos_nan_when_ready ? "NaN" : "  ok "));
      process.stdout.write(`  #${String(i + 1).padStart(2)} ${tag}  rem=${String(r.remainder).padStart(3)} other=${String(r.other).padStart(3)} stage=${String(r.render_stage_max).padStart(2)} gblk=${String(r.gate_blocked).padStart(4)}\n`);
    }

    const crashCount = runs.filter((r) => r.wasm_crash).length;
    const stuckCount = runs.filter((r) => r.stuck_menu).length;
    const nanCount = runs.filter((r) => r.pos_nan_when_ready).length;
    const avgGateBlocked = Math.round(runs.reduce((s, r) => s + r.gate_blocked, 0) / runs.length);
    const verdict = crashCount === 0 && stuckCount === 0 ? "PASS" : "FAIL";

    console.log(`  => ${verdict}  crash=${crashCount}/${args.runs} stuck=${stuckCount}/${args.runs} nan=${nanCount}/${args.runs} avg_gate_blocked=${avgGateBlocked}\n`);

    allResults.push({
      skin: cell.skin.id,
      skin_label: cell.skin.label,
      map: cell.map,
      gate: cell.gate.id,
      gate_ms: cell.gate.ms,
      runs,
      summary: { crash_count: crashCount, stuck_count: stuckCount, nan_count: nanCount, avg_gate_blocked: avgGateBlocked, verdict },
    });
  }

  await browser.close();

  // ── Final matrix table ─────────────────────────────────────────
  console.log("=== MATRIX SUMMARY ===\n");
  const header = "Skin".padEnd(14) + "Map".padEnd(12) + "Gate".padEnd(6) + "Crash".padEnd(8) + "Stuck".padEnd(8) + "NaN".padEnd(6) + "GateBlk".padEnd(9) + "Verdict";
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of allResults) {
    const mapShort = r.map.replace(".a3d", "").replace("game_map_y8_original_game_map", "y8").slice(0, 10);
    console.log(
      r.skin.padEnd(14) +
      mapShort.padEnd(12) +
      r.gate.padEnd(6) +
      `${r.summary.crash_count}/${args.runs}`.padEnd(8) +
      `${r.summary.stuck_count}/${args.runs}`.padEnd(8) +
      `${r.summary.nan_count}/${args.runs}`.padEnd(6) +
      String(r.summary.avg_gate_blocked).padEnd(9) +
      r.summary.verdict,
    );
  }

  // ── Promotion check ────────────────────────────────────────────
  console.log("\n=== PROMOTION CHECK ===\n");
  const gateOnProblematic = allResults.filter((r) => r.gate === "on" && r.skin === "problematic");
  const gateOnStock = allResults.filter((r) => r.gate === "on" && r.skin === "stock_like");
  const gateOffProblematic = allResults.filter((r) => r.gate === "off" && r.skin === "problematic");
  const gateOffStock = allResults.filter((r) => r.gate === "off" && r.skin === "stock_like");

  const check = (label, cells, field, threshold) => {
    const total = cells.reduce((s, c) => s + c.summary[field], 0);
    const pass = total <= threshold;
    console.log(`  ${pass ? "✓" : "✗"} ${label}: ${field}=${total} (threshold ≤ ${threshold})`);
    return pass;
  };

  const p1 = check("gate=on + problematic: zero crashes", gateOnProblematic, "crash_count", 0);
  const p2 = check("gate=on + stock: zero crashes", gateOnStock, "crash_count", 0);
  const p3 = check("gate=on + problematic: zero stuck", gateOnProblematic, "stuck_count", 0);
  const p4 = check("gate=on + stock: zero stuck", gateOnStock, "stuck_count", 0);

  const baselineCrashes = gateOffProblematic.reduce((s, c) => s + c.summary.crash_count, 0);
  console.log(`  ℹ gate=off + problematic baseline: crash_count=${baselineCrashes}`);
  const baselineStockCrashes = gateOffStock.reduce((s, c) => s + c.summary.crash_count, 0);
  console.log(`  ℹ gate=off + stock baseline: crash_count=${baselineStockCrashes}`);

  const promote = p1 && p2 && p3 && p4;
  console.log(`\n  ${promote ? "PROMOTE: gate is safe to enable by default" : "DO NOT PROMOTE: criteria not met"}`);

  // ── Save results ───────────────────────────────────────────────
  const outPath = "/tmp/render_gate_ab_matrix_results.json";
  await fs.writeFile(outPath, JSON.stringify({ args, results: allResults, promote }, null, 2));
  console.log(`\nFull results: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
