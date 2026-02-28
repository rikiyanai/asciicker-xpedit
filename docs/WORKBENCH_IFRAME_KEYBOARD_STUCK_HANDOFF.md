# Handoff: Workbench Skin Test Failure Log (Live)

**Status:** UNRESOLVED — primary investigation focus is now spawn/map state, not blanket XP-invalid assumptions.
**Date:** 2026-02-26
**Branch:** `master`

## Logging Discipline (Mandatory)

This file is append-only for attempts/evidence.

For every debug run, record:
- timestamp
- command/script and key inputs
- artifact path(s)
- observed outcome
- hypothesis impact (`ruled_out`, `supported`, or `inconclusive`)
- next step
- runtime mode details:
  - override scope (exact names/count)
  - reload mode (`src_swap` vs `iframe_recreate`)
  - classification truth fields from trace (`world_ready_ever_true`, `world_ready_final`)

Do not replace prior failed attempts with summaries. Keep the chain of evidence.

### Required Per-Run Evidence Block (new)

When a run includes Playwright `result.json`, include this minimal parse in the log entry:

```bash
jq -r '[
  .firstMoveDiagnostic.classification,
  ((.firstMoveDiagnostic.traces // []) | map((.parsed.world_ready // "")|tostring) | any(.=="1")),
  ((.firstMoveDiagnostic.traces // []) | map((.parsed.world_ready // "")|tostring) | last),
  (.injectResult.override_names // [] | length)
] | @tsv' <result.json>
```

Interpretation contract:
- if `classification=freeze_world_never_ready` and `world_ready_ever_true=true`, mark it as **label mismatch** and set hypothesis impact to `inconclusive` for \"never-ready\" claims.
- always include screenshot chain paths:
  - `workbench-final.png`
  - `flat-arena-canvas.png`

## Current Symptom

User report: skin appears to apply and can work briefly, then runtime behavior breaks around spawn/game-state transition ("spawning in water and falling").

This means "sprite never worked at all" is not consistent with observed behavior.

## Hypothesis Matrix (Current)

### H1: Parent page focus theft causes stuck movement
Status: `mostly ruled_out`

Evidence:
- Prior fixes (`webbuildFrame.focus`, inspector focus guard) did not resolve issue.
- User can move briefly in failing repros, which implies input reaches game at least initially.

### H2: Overlay/ready-state race causes false-positive "loaded" state
Status: `partially supported`

Evidence:
- Historical failing run: overlay still visible and canvas clicks intercepted (`TimeoutError`, 2026-02-26T03:40:34Z).
- Poll loop hardened to require `wasmReady || !overlayVisible`.

### H3: XP format is globally incompatible with TERM++
Status: `ruled_out as primary`

Evidence:
- User confirmed sprite worked briefly before spawn/water failure.
- Some runs classify `loaded_and_playable` with movement success.

### H4: Map/Spawn initialization bug in skin-test flow (flat map/bootstrap/start sequence)
Status: `primary open hypothesis`

Evidence:
- Failures cluster around post-launch/game-state progression.
- User-reported failure onset is spawn-in-water/falling, not immediate skin decode rejection.

### H5: Runtime instability only in staged sandbox launch path
Status: `open`

Evidence:
- Converted XP launch into original-repo-based sandbox succeeded in starting, but one check showed process exit before 15s.
- Baseline raw original repo `game_term` remained alive past 15s.
- Needs controlled A/B with identical runtime conditions and captured stderr.

## Key Artifacts (Most Relevant)

- Failing watchdog (inject stalls, then explicit failure):
  - `artifacts/ui-tests/test-e2e-2026-02-26T03-55-42-982Z/workbench-dock-load-watchdog/dock-load-watchdog-summary.json`
  - Final state: `wbStatus="Web skin apply failed"`, `webbuildState="Webbuild ready"`, `overlayVisible=true`.

- Passing watchdog (loaded + playable):
  - `artifacts/ui-tests/test-e2e-2026-02-26T08-09-19-631Z/workbench-dock-load-watchdog/dock-load-watchdog-summary.json`
  - Final state: `stage="loaded_and_playable"`, `wasmReady=true`, `overlayVisible=false`, `move_result.moved=true`.

- Original repo TERM++ baseline check:
  - baseline `game_term` alive after 15s (reported by subagent).

- Converted XP sandbox launch check:
  - runtime launched from original repo root via pipeline staging;
  - at least one run exited before 15s; needs deeper stderr-captured replication.

## Attempt Log (Append-Only)

### 2026-02-26T03:40:34Z — Overlay intercept failure
- Run: workbench dock watchdog.
- Artifact: `artifacts/ui-tests/test-e2e-2026-02-26T03-40-34-746Z/summary.json`.
- Outcome: canvas click blocked by login overlay (`TimeoutError`).
- Hypothesis impact: supports H2, inconclusive for H4.
- Next: tighten readiness gate and overlay checks.

### 2026-02-26T03:55:42Z — "Web skin apply failed" terminal status
- Run: watchdog (`cat_sheet.png`).
- Artifact: `artifacts/ui-tests/test-e2e-2026-02-26T03-55-42-982Z/workbench-dock-load-watchdog/dock-load-watchdog-summary.json`.
- Outcome: repeated `"Injecting XP..."` then `"Web skin apply failed"`; overlay remained visible.
- Hypothesis impact: supports H2; does not prove global XP invalidity.
- Next: compare against passing runs and capture map/spawn behavior.

### 2026-02-26T08:09:19Z — Loaded and playable pass
- Run: watchdog (`cat_sheet.png`).
- Artifact: `artifacts/ui-tests/test-e2e-2026-02-26T08-09-19-631Z/workbench-dock-load-watchdog/dock-load-watchdog-summary.json`.
- Outcome: loaded + movement success.
- Hypothesis impact: weakens H3 (global XP incompatibility).
- Next: isolate conditions that flip pass/fail (map/start/spawn timing).

### 2026-02-26T18:08:30Z — Converted XP launch in original repo sandbox
- Run: `workbench_open_termpp_skin(...)` with `TERMPP_REPO_ROOT=/Users/r/Downloads/asciicker-Y9-2`, session `577c11ae-15b4-4de1-9f63-84157602b15f`.
- Artifact root: `output/termpp_skin_runs/577c11ae-15b4-4de1-9f63-84157602b15f-20260226T180830Z`.
- Outcome: launch succeeded (PID created); short-lifetime behavior varied across attempts.
- Hypothesis impact: inconclusive for H5.
- Next: run controlled A/B with stderr capture for both baseline and staged runtime.

### 2026-02-26T18:10:54Z — 15s hold check on staged launch
- Run: subagent hold test on staged converted-XP runtime.
- Outcome: process exited before 15s in this attempt.
- Hypothesis impact: supports H5 but not enough evidence yet.
- Next: compare against baseline runtime with same launch conditions.

### 2026-02-26T18:11Z — Baseline original repo runtime hold check
- Run: direct `/Users/r/Downloads/asciicker-Y9-2/.run/game_term`.
- Outcome: alive after 15s; then terminated by test harness.
- Hypothesis impact: supports H5/H4 over H3.
- Next: instrument spawn/map state to validate water/fall path.

### 2026-02-26T18:2xZ — Created pinned repro worktree for rollback testing
- Run: `git worktree add /Users/r/Downloads/asciicker-pipeline-v2-underwater-repro 82e7b24`.
- Outcome: isolated checkout created at commit `82e7b24` (no edits to active working tree).
- Hypothesis impact: inconclusive (environment setup step).
- Next: run underwater-after-2-moves repro checks from this pinned tree.

### 2026-02-26T18:20Z — Launched pinned repro snapshot server
- Run: `python3 -m src.pipeline_v2.app` from `/Users/r/Downloads/asciicker-pipeline-v2-underwater-repro` (background).
- Artifact: `/tmp/asciicker_underwater_repro_5071.log`, PID file `/tmp/asciicker_underwater_repro_5071.pid`.
- Outcome: server started successfully on `http://127.0.0.1:5071/workbench` (HTTP 200).
- Hypothesis impact: inconclusive (environment ready for repro).
- Next: execute the exact "2 moves -> underwater/fall" repro and capture outcome.

### 2026-02-26T18:24Z — Launch reliability issue and recovery
- Run: user reported `ERR_CONNECTION_REFUSED`; checked PID/curl and confirmed server had died.
- Artifact: `/tmp/asciicker_underwater_repro_5071.log`.
- Outcome: switched to persistent interactive launch session (`python3 -m src.pipeline_v2.app`), re-opened page, confirmed `HTTP 200` on `/workbench`.
- Hypothesis impact: inconclusive for gameplay bug; confirms detached background launch is unreliable in this environment.
- Next: keep server running in persistent session during repro steps.

### 2026-02-26T18:31Z — Session-history audit using `still/again/after` anchors (last 15h)
- Run: parsed `/Users/r/.codex/sessions/2026/02/24/rollout-2026-02-24T22-01-58-019c92bf-07d6-7780-9e2f-cdcffd1aa24a.jsonl` and `/Users/r/.codex/history.jsonl`.
- Key timeline:
  - `2026-02-26T09:18:04Z` user: "stuck on loading screen again"
  - `2026-02-26T09:21:47Z` user: "works for an instant then goes underwater"
  - `2026-02-26T09:36:47Z` user: "after first movement, it falls through"
  - `2026-02-26T09:59:32Z` user: "still the same issue why?"
  - `2026-02-26T10:28:35Z` assistant: reverted `spawnz` experiment
- `z=40...` was not found in these sessions; recorded spawn override value was `spawnz=757`.
- Hypothesis impact: supports H4, weakens "XP globally invalid" (H3), and shows "underwater after movement" predates `spawnz` experiment.
- Next: target pre-`spawnz` checkpoint window (`09:24Z` to `09:36Z`) when reproducing "briefly works then falls through."

### 2026-02-27T01:07Z — Black screen launch failure on pinned repro snapshot
- Run: launched pinned snapshot server (`82e7b24`) from `/Users/r/Downloads/asciicker-pipeline-v2-underwater-repro`.
- Observation: `/workbench` returned `200`, but `/termpp-web-flat/index.html` and `/termpp-web-flat/flat_map_bootstrap.js` returned `404`, producing black webbuild view.
- Fix: rebuilt static flat bundle in that worktree via `./scripts/build_termpp_skin_lab_static.sh`.
- Verification: both flat endpoints now return `200`; static files exist under `output/termpp-skin-lab-static/termpp-web-flat/`.
- Hypothesis impact: inconclusive for H4/H5 (environment packaging issue, not gameplay-state evidence).
- Next: re-run user repro flow on `http://127.0.0.1:5071/workbench?flatmap=game_map_y8.a3d` with hard refresh.

### 2026-02-27T01:12Z — Corrected timeline launch (pre-late-fixes commit)
- Run: created isolated worktree at `1bfb929` (`/tmp/asciicker-pipeline-v2-1bfb929`) and launched `python3 -m src.pipeline_v2.app`.
- Reason: user-reported underwater window (`2026-02-26T09:18Z..10:28Z`) predates commit `82e7b24` (`2026-02-26T14:25:00Z`), so `82e7b24` is too late and changes failure mode.
- Build step: rebuilt static flat assets with explicit legacy web dir:
  - `./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web /tmp/asciicker-pipeline-v2-1bfb929/output/termpp-skin-lab-static`
- Verification:
  - `/workbench` => `200`
  - `/termpp-web-flat/index.html` => `200`
- Hypothesis impact: supports H4/H5 framing that repro behavior is highly state/version sensitive and not a single monotonic bug.
- Next: user rerun on this snapshot to see if symptom returns to "falls underwater after movement" versus "freeze on move."

### 2026-02-27T01:14Z — Flat-map bundle packaging gap caused permanent loading
- Run: inspected live `1bfb929` snapshot assets after user report "not even loading."
- Observation:
  - `/termpp-web-flat/index.js`, `.wasm`, `.data` were `200`.
  - `termpp-web-flat/flatmaps/` was effectively empty for runtime map usage at launch.
  - Bootstrap in this snapshot defaults to `flatmaps/minimal_2x2.a3d`, so missing map files can stall at `Webbuild loading...`.
- Fix:
  - manually copied required maps into snapshot output:
    - `minimal_2x2.a3d`
    - `minimal_1x1.a3d`
    - `game_map_y8.a3d`
    - plus test maps now present
- Verification:
  - `/termpp-web-flat/flatmaps/minimal_2x2.a3d` => `200`
  - `/termpp-web-flat/flatmaps/game_map_y8.a3d` => `200`
- Hypothesis impact: inconclusive for underwater/freeze root cause; confirms one independent packaging blocker that masked gameplay-state repro.
- Next: retry movement repro now that map bootstrap path is valid.

### 2026-02-27T01:17Z — Movement-triggered freeze persists after map packaging fix
- Run: user retest on live `1bfb929` snapshot after map files were restored.
- Observation:
  - Dock loads and rotation works.
  - First movement input causes runtime freeze/hang.
  - User screenshot also confirms older dock layout (`Test This Skin`, `Apply In Place`, `Apply + Restart`, `Upload Test Skin`) in this snapshot.
- Hypothesis impact:
  - supports H4 (post-start movement/physics/collision/water path), not just dock-load/bootstrap packaging.
  - weakens any assumption that the remaining issue is solely missing flatmaps/assets.
- Next:
  - produce consolidated research/audit dump for dedicated engine/runtime investigation.
  - instrument first-move tick path (grounded/water/pos/collision readiness) in web runtime.

### 2026-02-27T01:19Z — Comprehensive Claude research/audit dump generated
- Run: consolidated timeline, commit-window mismatch, packaging blockers, hypothesis status, and next research plan into one handoff.
- Artifact:
  - `/Users/r/Downloads/asciicker-pipeline-v2/docs/CLAUDE_RESEARCH_DUMP_WORKBENCH_MOVE_FREEZE_2026-02-27.md`
- Outcome: single-source research dump now available for external Claude investigation.
- Hypothesis impact: no change (documentation/coordination step).
- Next: execute reconstruction of transient `2026-02-26T09:18Z..10:28Z` state and movement-path instrumentation plan.

### 2026-02-27T02:10Z — Fresh relaunch for user asciid-side testing
- Run: killed prior Flask process and relaunched from `/tmp/asciicker-pipeline-v2-1bfb929` using `python3 -m src.pipeline_v2.app`.
- Verification:
  - `/workbench` => `200`
  - `/termpp-web-flat/flatmaps/minimal_2x2.a3d` => `200`
  - browser open command issued for `http://127.0.0.1:5071/workbench`
- Outcome: runtime relaunched cleanly for user to continue XP/asciid cross-testing.
- Hypothesis impact: no direct change (environment reset step).
- Next: compare user's asciid run outcome against web first-move freeze behavior.

### 2026-02-27T02:11Z — Audit of Claude research summary draft
- Run: reviewed user-provided analysis against local evidence and handoff docs.
- Outcome:
  - analysis direction is mostly correct (timeline, commit-window mismatch, multi-failure-mode framing).
  - one reproducibility-critical path error found (flatmaps copy path omitted `output/termpp-skin-lab-static` segment).
  - noted missing proof section for freeze-type classification (JS exception vs WASM stall vs loading-gate deadlock).
- Hypothesis impact: no change to root-cause ranking; improves handoff accuracy requirements for next agent.
- Next: provide corrected findings list to user and fold path correction into future handoff prompts.

### 2026-02-27T02:18Z — Native asciiid baseline reconfirmed + parity handoff authored
- Run:
  - copied user XP into native sprites directory:
    - `/Users/r/Downloads/asciicker-Y9-2/sprites/session-30004ae1-8c48-4778-b625-d78279c96363.xp`
  - launched native `asciiid`:
    - `/Users/r/Downloads/asciicker-Y9-2/.run/asciiid`
- Outcome:
  - native runtime launched and loaded sprite scan including user XP.
  - user reports native TERM++ skin behavior is stable across multiple movements (no freeze/no underwater).
- Artifact:
  - new Claude implementation/research handoff:
    - `/Users/r/Downloads/asciicker-pipeline-v2/docs/CLAUDE_HANDOFF_ASCIIID_TERMPP_PARITY_NO_RUNTIME_DEPS_2026-02-27.md`
- Hypothesis impact:
  - strengthens "web-only divergence" and "post-start movement path" focus.
- Next:
  - Claude to execute parity plan with runtime preflight, first-move diagnostics, and transient-window reconstruction.

## Next Targeted Work

1. Add explicit spawn-state probes (player XYZ, terrain/water context) during first 5s after StartGame in flat test flow.
2. Compare spawn results between `minimal_2x2.a3d` and `game_map_y8_original_game_map.a3d`.
3. Run staged converted-XP sandbox with stderr capture and correlate failure time with spawn/map events.
4. Keep this log updated immediately after each run (no deferred summary-only updates).

### 2026-02-27T02:50Z — Runtime preflight gate implemented (Section 1)
- Run:
  - Added backend endpoint `GET /api/workbench/runtime-preflight` in `src/pipeline_v2/app.py`.
  - Added Workbench UI preflight fetch + gate in `web/workbench.js` (runs on page init and before skin-test actions).
  - Added top warning banner + dock-button gating UI in `web/workbench.html` and `web/styles.css`.
- Preflight contract now checks:
  - required files exist and are non-empty:
    - `termpp-web-flat/index.html`
    - `termpp-web-flat/index.js`
    - `termpp-web-flat/index.wasm`
    - `termpp-web-flat/index.data`
    - `termpp-web-flat/flat_map_bootstrap.js`
  - at least one map exists and is non-empty:
    - `termpp-web-flat/flatmaps/minimal_2x2.a3d`
    - `termpp-web-flat/flatmaps/game_map_y8_original_game_map.a3d`
- UI behavior:
  - failed preflight shows a top warning banner with exact missing/invalid paths.
  - skin-test dock controls are disabled with tooltip containing exact missing/invalid file details.
  - editor/workbench core remains usable.
- Verification:
  - `python3 -m pytest tests/test_workbench_flow.py -q` => PASS (added endpoint coverage assertions).
  - `node --check web/workbench.js` => PASS.
- Hypothesis impact:
  - rules out hidden runtime-bundle drift as an unobserved blocker for future reproductions.
  - does **not** explain movement freeze/underwater directly; gameplay-path root cause remains open.
- Next:
  - run controlled repro matrix (`flatmap` x `autonewgame`) on this updated gate and correlate first-move probes (`pos/water/grounded/renderStage/worldReady`) with freeze vs pass outcomes.

### 2026-02-27T03:32Z — Revised parity plan execution (startup hardening + matrix + 10-run XP parity)
- Run:
  - hardened `web/termpp_flat_map_bootstrap.js` world-ready gate with non-deadlocking fallback:
    - bypass world gate when `render_stage>=70` after warmup or after 10s timeout (instead of hard abort).
  - gated keyboard/focus diagnostic wrappers behind query flag (`?keybdiag=1`, default off) to reduce runtime perturbation.
  - extended `scripts/workbench_png_to_skin_test_playwright.mjs`:
    - new XP upload mode (`--xp <path>`) for direct Workbench `Upload Skin` flow.
    - emits machine-readable `first-move-diagnostic.json` per run.
    - writes `RESULT_PATH=...` sentinel for deterministic batch parsing.
- Verification:
  - `node --check web/termpp_flat_map_bootstrap.js` => PASS.
  - `node --check scripts/workbench_png_to_skin_test_playwright.mjs` => PASS.
  - `python3 -m pytest tests/test_workbench_flow.py -q` => PASS.
- Matrix artifacts:
  - source summary (initial parse):
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/matrix-summary-20260227T032752Z.json`
  - corrected summary (field paths fixed):
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/matrix-summary-corrected-20260227T033134Z.json`
  - outcome (all 4 cases):
    - loaded=true, moved=true, classification=underwater.
- 10-run XP parity artifacts (user XP):
  - XP used:
    - `/Users/r/Downloads/session-30004ae1-8c48-4778-b625-d78279c96363.xp`
  - source summary (initial parse):
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/parity-10run-summary-20260227T033012Z.json`
  - corrected summary (field paths fixed):
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/parity-10run-summary-corrected-20260227T033134Z.json`
  - corrected totals:
    - total_runs=10
    - loaded_true=10
    - moved_true=10
    - playable_classifications=0
    - underwater_classifications=8
    - unknown_classifications=2
- Hypothesis impact:
  - strongly weakens current freeze hypothesis for this branch (movement consistently succeeds in matrix + 10-run batch).
  - strongly supports persistent spawn/water-state parity bug in web runtime (underwater/unknown classification despite successful movement).
- Next:
  - tune startup/menu parity to eliminate underwater classification (target: playable=10/10 on canonical map).
  - compare `TRACE` timelines on unknown runs vs underwater runs to pinpoint branch to water-detection stabilization.

### 2026-02-27T03:34Z — Trace sanity check on underwater classification
- Run: analyzed `first-move-diagnostic` traces from 10-run XP parity batch.
- Observation:
  - all runs had `min(z - water) = 0.0` and at least one trace sample where `z <= water`.
  - all runs still reported `moved=true` (no movement freeze).
- Interpretation:
  - current `[CLASSIFY] underwater` likely means water-plane contact occurred during startup/movement window; it is not equivalent to a hard freeze.
  - freeze and underwater are now separable in current instrumentation.
- Next:
  - refine classification to distinguish transient water contact vs persistent underwater/fallthrough (duration + grounded + sustained z/water relation).

### 2026-02-27T03:40Z — Override scope narrowed to spawn-default sheet only
- Run:
  - updated Workbench web skin override policy in `web/workbench.js`.
  - changed default override target from broad player-sheet set to single spawn-default sheet:
    - `player-0000.xp`
  - kept guard that ignores server broad override list for web injection path.
- Reason:
  - user requested replacing only the default spawned skin rather than all player directional sheets.
- Verification:
  - `node --check web/workbench.js` => PASS.
  - `/workbench` health check => HTTP 200.
- Next:
  - user visual validation: confirm spawned player now uses uploaded custom skin while non-default states remain unchanged.

### 2026-02-27T03:48Z — Spawn sprite audit: mounted player uses wolf sheets; override list was too narrow
- Run:
  - traced runtime sprite file opens in `/termpp-web-flat/index.html` using Playwright + `window.FS` hook.
  - captured concrete startup/open paths for spawn/mount sprites.
- Key findings:
  - player startup is mounted and loads both player + wolf sheets (`player-*`, `wolfie-*`, `wolack-*`), not just one player file.
  - runtime requests `...2` suffix variants at startup (example: `player-0002.xp`, `wolfie-0002.xp`, `wolack-0002.xp`).
  - previous web override safety filter only allowed `player-[01]{4}.xp` and default list lacked `...2` variants.
- Root-cause implication:
  - narrow `player`-only + binary-only override policy can leave active spawn/mount frames untouched, producing "generic skin" even when upload/apply reports success.
- Fix implemented:
  - `web/workbench.js`
    - expanded default web override names to spawn-mounted set:
      - `player-nude.xp`
      - `player-0000/0001/0002.xp`
      - `wolfie-0000/0001/0002.xp`
      - `wolack-0001/0002.xp`
    - widened safe-name filter from `player-[01]{4}` to allow spawn-mounted patterns with `...2` suffix:
      - `^(player|wolfie)-[01]{3}[0-2]\.xp$`
      - `^wolack-[01]{3}[1-2]\.xp$`
    - added `override_names` to injection result payload for easier runtime audit.
- Verification:
  - `node --check web/workbench.js` => PASS.
  - Playwright upload-XP run => PASS load/apply/move:
    - result: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T03-48-05-865Z/result.json`
    - final iframe shot: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T03-48-05-865Z/flat-arena-canvas.png`
- Remaining:
  - gameplay classification in this run remains `underwater`; this patch targeted visible skin override parity, not water/fallthrough behavior.

### 2026-02-27T03:57Z — User validation: custom skin appears; repeat test causes mixed/double sprite + freeze after steps
- User report (validated against current implementation and artifacts):
  - first test run shows custom mounted sprite correctly (non-generic), confirming spawn override patch works.
  - after another test cycle and movement/direction change, observed mixed/double sprite appearance and later movement freeze.
  - user also noted CMD+SHIFT+R did not feel like a fully clean reset.
- Interpretation / likely causes:
  - current Workbench override set is intentionally narrow (spawn-mounted startup frames only):
    - `player/wolfie/wolack` limited to `000*` startup orientation plus `player-nude`.
  - when avatar rotates/moves, runtime switches to other directional/animation frame files (`001*`, `010*`, etc.) that are not overridden.
  - result is mixed assets on character (custom+generic overlap/ghosting look), perceived as two skins/sprite overlay.
  - freeze after several steps remains consistent with existing open gameplay bug (water/fallthrough/state transition), not with override-write failure.
- Hard refresh note:
  - browser hard-refresh reloads top document, but skin tests still run inside iframe runtime with query-param/cache behavior (`_srv`, `_wb`) and runtime state transitions.
  - deterministic cleanest path remains forced iframe restart before each test action (already used by `Test This Skin` / upload test path), plus avoiding rapid repeated actions while world/menu state is transitioning.
- Evidence snapshot (post-patch run):
  - result json:
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T03-48-05-865Z/result.json`
  - final frame image showing custom mounted sprite:
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T03-48-05-865Z/flat-arena-canvas.png`
- Next technical action (pending):
  - move from narrow startup override to deterministic directional set parity for mounted player states (at least all `player/wolfie/wolack` variants used during movement), while preserving non-player sheets.

### 2026-02-27T03:59Z — Correction: variant semantics note
- Correction to prior note:
  - `player/wolfie/wolack-xxxx` variation should not be described as "direction files".
  - user clarification is accepted: each sheet contains directional poses internally; filename variants map to loadout/state variants (e.g., armor/weapon/mount state), not simple facing direction.
- What remains true:
  - current override scope is still a subset of mounted variants; if runtime selects a non-overridden variant file, mixed custom/default visuals can appear.
- Follow-up requirement:
  - implement mounted-variant-complete override strategy (deterministic full `player/wolfie/wolack` variant set present in runtime), instead of startup-subset targeting.

### 2026-02-27T04:04Z — Full ASCIIID parity override run + action mutex
- User escalation: requested full parity with ASCIIID logic and reported NPC inheritance + repeated-click instability.
- Code changes (`web/workbench.js`):
  - Web override policy switched to match native TERM++ sandbox parity set exactly:
    - `player-nude.xp`
    - `(player|attack|plydie|wolfie|wolack)-[0000..1111].xp`
  - `normalizeWebbuildOverrideNames()` now accepts and normalizes server-provided override set (no longer drops broad list).
  - Added dock action mutex (`webbuild.actionInFlight/actionLabel`) to prevent overlapping skin actions from repeated clicks.
  - Dock controls now disable while a skin action is running and show busy tooltip/status.
- Parity run artifact:
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-04-05-927Z/result.json`
- Parity run outcome:
  - `loaded=true`
  - `moved=true`
  - classification=`freeze_world_never_ready`
  - final status still reports uploaded skin applied.
  - trace shows main menu clears but `world_ready` stays `0` and classifier reports world-never-ready.
- Interpretation:
  - current instability is not explained by click overlap alone (mutex added) and not by load failure (`loaded=true`).
  - bug remains in gameplay/world readiness path after skin apply/restart sequence.
- Important scope note:
  - skin replacement is FS-global; any actor referencing overridden filenames can inherit the custom skin. this is runtime-level behavior, not per-entity assignment.

### 2026-02-27T04:33Z — Claim audit + runbook schema correction (Codex)
- Run:
  - audited `/tmp/claude-systematic-debug-audit-skin-freeze.md` claims against live code and artifacts.
  - updated this failure log's \"Logging Discipline\" section with mandatory runtime-mode + classifier-truth fields.
- Artifacts/evidence reviewed:
  - `web/workbench.js` (override/reload/injection paths)
  - `web/termpp_flat_map_bootstrap.js` (world gate + classifier logic)
  - `src/pipeline_v2/service.py` (`_termpp_skin_override_names`, sandbox staging)
  - `output/playwright/workbench-png-to-skin-2026-02-27T04-04-05-927Z/result.json`
- Outcome:
  - B1 global aliasing claim remains supported by code.
  - B2 race claim remains supported but not fully root-caused.
  - corrected interpretation: `freeze_world_never_ready` label can occur even when trace shows `world_ready` became `1` earlier.
  - B3 stale-state claim downgraded to plausible/unverified pending controlled reload A/B.
- Hypothesis impact:
  - H4 `supported` (startup/world-state path still primary).
  - H2 `supported` (state-gate semantics still inconsistent).
  - H5 `inconclusive` (reload contamination not yet proven).
- Next:
  - implement P0 trace/classifier correction before additional causal claims.

### 2026-02-27T04:41Z — P0 implementation test initially masked by stale served static bundle
- Run:
  - implemented P0 code changes in:
    - `web/termpp_flat_map_bootstrap.js`
    - `scripts/workbench_png_to_skin_test_playwright.mjs`
  - executed:
    - `node --check web/termpp_flat_map_bootstrap.js`
    - `node --check scripts/workbench_png_to_skin_test_playwright.mjs`
    - `node scripts/workbench_png_to_skin_test_playwright.mjs --url http://127.0.0.1:5071/workbench --xp /Users/r/Downloads/session-30004ae1-8c48-4778-b625-d78279c96363.xp --timeout-sec 120 --move-sec 2`
- Artifacts:
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-41-38-583Z/result.json`
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-41-38-583Z/workbench-final.png`
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-41-38-583Z/flat-arena-canvas.png`
- Runtime mode details:
  - override scope: full parity web override set (81 names via `_termpp_skin_override_names`)
  - reload mode: `src_swap` (iframe `about:blank` then fresh `_wb` URL)
  - classification truth fields from trace: unavailable in this run because stale served bootstrap omitted new fields
- Outcome:
  - runtime still emitted old `[CLASSIFY]` line format (no `world_ready_ever/world_ready_drops/trace_duration_ms`).
  - root cause: Flask served `runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js` had not been rebuilt after source edit.
- Hypothesis impact:
  - H2/H4 `inconclusive` (instrumentation not yet actually deployed).
- Next:
  - rebuild static bundle and rerun same XP test to validate P0 observability fields.

### 2026-02-27T04:43Z — P0 observability deployed and verified (including tracelen param)
- Run:
  - rebuilt served static runtime:
    - `./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web`
  - reran XP test:
    - `node scripts/workbench_png_to_skin_test_playwright.mjs --url http://127.0.0.1:5071/workbench --xp /Users/r/Downloads/session-30004ae1-8c48-4778-b625-d78279c96363.xp --timeout-sec 120 --move-sec 2`
  - direct bootstrap tracelen sanity check:
    - launched `/termpp-web-flat/index.html?...&tracelen=6000` and verified classify emitted `trace_duration_ms=6000`.
- Artifacts:
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-42-26-690Z/result.json`
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-42-26-690Z/first-move-diagnostic.json`
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-42-26-690Z/workbench-final.png`
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-42-26-690Z/flat-arena-canvas.png`
- Runtime mode details:
  - override scope: full parity web override set (81 names via `_termpp_skin_override_names`)
  - reload mode: `src_swap`
  - classification truth fields:
    - classification=`underwater`
    - `world_ready_ever_true=true`
    - `world_ready_drop_count=33`
    - `menu_cleared_while_not_ready=true`
    - `trace_duration_ms=5000`
- Outcome:
  - P0 parser fields successfully appear in `result.json` under `firstMoveDiagnostic`.
  - new class label path exists (`freeze_world_ready_dropped`) and is now available when conditions match.
  - direct `tracelen` query parameter is honored by bootstrap runtime (`trace_duration_ms=6000` observed).
- Hypothesis impact:
  - H4 `supported` (non-monotonic readiness is observable; world-ready dropped repeatedly after first true sample in this run).
  - H2 `supported` (menu cleared while world not ready is now explicitly captured).
  - H5 `inconclusive` (reload contamination still unproven; unchanged in P0).
- Next:
  - proceed to P1 world-gate hardening with these new observability fields as acceptance checks.

### 2026-02-27T05:35Z — Post-P1 user repro still shows NPC inheritance + move-freeze + ineffective reload
- Run:
  - user manual repro after accepting P1 edits (real browser), plus Claude validation summary over 5 runs (headless + headed).
  - observed by user:
    - custom skin appears on nearby NPCs.
    - movement freezes after a few frames.
    - reload path does not reliably return clean state.
- Artifacts/status:
  - no new deterministic artifact bundle captured in this specific manual report; symptom report logged immediately per append-only rule.
  - prior referenced evidence remains:
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-42-26-690Z/result.json`
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T04-42-26-690Z/first-move-diagnostic.json`
- Runtime mode details:
  - override scope: full parity web override set (81 names); NPC inheritance remains expected under FS-global replacement.
  - reload mode: `src_swap` (user reports no reliable clean reset).
  - classification truth fields: unchanged in latest captured artifact (`world_ready_ever_true=true`, `world_ready_drop_count=33`, `menu_cleared_while_not_ready=true`).
- Outcome:
  - P1 gate-hardening alone did not resolve user-visible bug envelope.
  - two issue families remain active:
    - B1 aliasing: NPC skin inheritance (architectural/global override behavior).
    - B2/B3 runtime state: freeze after movement and unreliable reset/reload.
- Hypothesis impact:
  - H4 `supported` (movement/runtime-state path still broken).
  - H5 `partially supported` by symptom (reload ineffectiveness), but still lacks controlled iframe-destroy A/B proof.
  - B1 remains `supported`/expected with full-parity override scope.
- Next:
  - capture a fresh deterministic Playwright artifact set on current P1 branch (5-run batch) and append parsed classifier truth fields for each run.
  - execute P2 reload A/B (`src_swap` vs full iframe recreate) to prove/disprove runtime contamination.
  - decide override policy split (default scoped player-only mode vs explicit full-parity mode) to stop NPC inheritance in standard tests.

### 2026-02-27T05:41Z — Deterministic 5-run P1 batch (current branch) captured; gate criterion passes but runtime freezes pre-world
- Run:
  - rebuilt runtime bundle:
    - `./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web`
  - executed 5 sequential runs:
    - `node scripts/workbench_png_to_skin_test_playwright.mjs --url http://127.0.0.1:5071/workbench --xp /Users/r/Downloads/session-30004ae1-8c48-4778-b625-d78279c96363.xp --timeout-sec 120 --move-sec 2`
  - generated batch summary:
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/p1-batch-20260227-003727/summary.json`
- Artifacts:
  - run1: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T05-37-27-270Z/result.json`
  - run2: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T05-38-03-130Z/result.json`
  - run3: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T05-38-38-968Z/result.json`
  - run4: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T05-39-14-813Z/result.json`
  - run5: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T05-39-50-955Z/result.json`
- Runtime mode details:
  - override scope: full parity web override set (81 names).
  - reload mode: `src_swap`.
  - aggregate parsed diagnostics:
    - `total_runs=5`
    - `menu_cleared_while_not_ready_false_count=5` (primary P1 gate criterion passed in all runs)
    - `hard_timeout_any_count=5` (safety net tripped every run)
    - classifications: `freeze_no_frames=5`
    - per-run: `world_ready_ever_true=false`, `world_ready_drop_count=0`, `moved=false`, `playable_wait_ready=false`
- Outcome:
  - P1 gate-hold behavior appears effective (no premature menu clear while not ready).
  - However, runtime did not progress past initial load/frame stage in batch environment (`freeze_no_frames` across all runs), so gameplay remains blocked.
  - This means current blocker shifted from premature menu advancement to upstream world/frame initialization in this test environment.
- Hypothesis impact:
  - H2 `partially ruled_out` as primary cause for this batch (premature menu advance prevented).
  - H4 `supported` (post-start runtime/world progression still broken).
  - H5 `supported` in automation context (reload/runtime lifecycle instability remains plausible and now consistent with hard-timeout dependence).
  - B1 aliasing remains unresolved (separate issue family).
- Next:
  - run P2 controlled reload A/B (`src_swap` vs iframe destroy/recreate) with identical harness to isolate lifecycle contamination.
  - run a fresh manual real-browser session after explicit server restart to test whether `freeze_no_frames` is automation/context-specific.
  - split override policy so default mode does not repaint NPC families.

### 2026-02-27T05:52Z — Fresh-server single-run discriminator: gate deadlock pattern observed (no pulses emitted)
- Run:
  - forced server restart on `:5071`, rebuilt static runtime, ran single XP test.
  - artifact:
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T05-51-42-580Z/result.json`
- Parsed outcome:
  - `classification=freeze_no_frames`
  - `world_ready_ever_true=false`
  - `menu_cleared_while_not_ready=false`
  - `moved=false`
  - `HARD TIMEOUT` logs: 1
  - `waiting for stable world_ready` logs: 16
  - critical: `moveResult.newGameAdvance.pulses=[]` (none sent before stop)
- Interpretation:
  - this is not just accumulated-session drift; first run after restart still stalls.
  - current P1 condition (requiring stable world_ready before menu advance) appears over-constrained and can deadlock pre-menu startup in this environment.
  - likely sequence: menu remains active -> world_ready never rises while in menu -> no pulses -> no world start -> timeout.
- Hypothesis impact:
  - H5a (pure accumulated state) `weakened`.
  - H5b/H4 (logic-level startup deadlock/regression) `supported`.
  - H2 premature-menu-clear is still improved (`menu_cleared_while_not_ready=false`), but introduced lockup risk.
- Next:
  - revise P1 to two-phase startup gating (menu-advance gating decoupled from post-menu world-ready stabilization), then rerun deterministic batch.

### 2026-02-27T08:09Z — Harness false-positive pass detected (no TRACE/CLASSIFY diagnostics)
- Run:
  - reviewed latest headed run artifact reported as success:
    - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T08-06-52-773Z/result.json`
- Parsed findings:
  - `loaded=true`, `moveResult.moved=true`, `playableWait.ready=true` (harness pass-like values)
  - but `firstMoveDiagnostic.classify_log_count=0` and `trace_log_count=0` (no `[CLASSIFY]` or `[TRACE]` evidence)
  - `firstMoveDiagnostic.classification=unknown` with all truth fields `null`
- Interpretation:
  - this run is non-diagnostic and must not be counted as gameplay pass.
  - harness currently allows pass-like outcome without required bootstrap trace/classify evidence.
- Hypothesis impact:
  - no change to root-cause ranking; this is a test-harness validity defect.
- Next:
  - make TRACE/CLASSIFY presence a required precondition for any pass verdict in automation.
  - reject/flag runs with `classification=unknown` or missing truth fields as `invalid_run`.

### 2026-02-27T10:02Z — Three-fix deployment: two-phase gate + mounted-default override + invalid_run enforcement
- Code changes:
  1. **Two-phase gate** (`web/termpp_flat_map_bootstrap.js`):
     - Phase A: allow first 3 Enter pulses without requiring world_ready (engine needs them to begin world init).
     - Phase B: after 3 pulses, enforce `WORLD_READY_REQUIRED_STREAK` (default 4) before more pulses.
     - Hard timeout at 30s remains as safety net.
     - Fixes deadlock where zero pulses were emitted because world_ready=0 blocked all pulses.
  2. **Mounted-default override** (`web/workbench.js`):
     - Default (`?overridemode=mounted`): player-nude + player/wolfie/wolack-[0000..1111] = 49 names.
     - Covers mounted player spawn (player + wolf companion families).
     - Excludes attack/plydie to reduce NPC aliasing (B1) and destabilization risk.
     - Full parity (81 names incl attack/plydie) only via explicit `?overridemode=full_parity`.
  3. **invalid_run enforcement** (`scripts/workbench_png_to_skin_test_playwright.mjs`):
     - Run is `invalid_run` unless: `trace_log_count > 0`, `classify_log_count > 0`, `classification != "unknown"`, truth fields not null.
     - Top-level `error` field set to `"invalid_run"` when checks fail.
     - `runValidity` object with per-check breakdown included in result.json.
- Rebuilt static bundle, killed server, restarted fresh on `:5071`.
- **Headless run**:
  - artifact: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T10-02-41-434Z/result.json`
  - `runValidity.status=valid` (all 4 checks pass)
  - `classification=underwater`
  - `world_ready_ever_true=true`
  - `world_ready_drop_count=29`
  - `menu_cleared_while_not_ready=true`
  - `trace_log_count=37`, `classify_log_count=1`
  - `moved=false`
  - `error=playable_state_timeout`
  - `headed=false`, `overrideMode=player_only`
- **Headed run**:
  - artifact: `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T10-03-36-149Z/result.json`
  - `runValidity.status=valid` (all 4 checks pass)
  - `classification=underwater`
  - `world_ready_ever_true=true`
  - `world_ready_drop_count=0`
  - `menu_cleared_while_not_ready=false`
  - `trace_log_count=37`, `classify_log_count=1`
  - `moved=true`
  - `error=null`
  - `headed=true`, `overrideMode=player_only`
  - move probes: start pos=[0,15,331] water=55 grounded=false → after pos=[-6.0,21.2,123.3] water=55 grounded=true
- Comparison:
  | Field | Headless | Headed |
  |---|---|---|
  | runValidity | valid | valid |
  | classification | underwater | underwater |
  | world_ready_ever_true | true | true |
  | world_ready_drop_count | 29 | 0 |
  | menu_cleared_while_not_ready | true | false |
  | moved | false | true |
  | error | playable_state_timeout | null |
- Interpretation:
  - **Two-phase gate fix works**: both runs now advance past stage 2 (was `freeze_no_frames` before). World_ready becomes true in both.
  - **Headless vs headed divergence**: headless has unstable world_ready (29 drops) and premature menu clear; headed has stable world_ready and no premature clear. This explains why headless fails to reach playable state.
  - **Underwater classification in both**: water=55 at spawn. This is the pre-existing H4 spawn/water parity bug, separate from the gate deadlock.
  - **Movement**: headed position changes significantly (player-controlled). Headless never reaches playable state due to world_ready instability.
- Hypothesis impact:
  - H4 `supported` (spawn/water path issue persists in both modes).
  - H5 `partially supported` (headless world_ready instability is environment-specific, not code-only).
  - P1 deadlock `resolved` (two-phase gate allows initial pulses).
  - B1 NPC aliasing `tracked separately` (mounted-default reduces but doesn't eliminate FS-global sharing).
- Next:
  - investigate headless world_ready instability (29 drops vs 0 in headed) — likely SwiftShader/WebGL timing difference.
  - address underwater spawn (H4) as the remaining primary gameplay bug.
  - user visual validation of headed mode skin appearance with mounted-default override set.

### 2026-02-27T10:28Z — Harness anti-false-claim gate verified with fresh run
- Run:
  - `node scripts/workbench_png_to_skin_test_playwright.mjs --url http://127.0.0.1:5071/workbench --xp /Users/r/Downloads/session-30004ae1-8c48-4778-b625-d78279c96363.xp --timeout-sec 90 --move-sec 2`
- Artifact:
  - `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T10-28-07-963Z/result.json`
- Parsed outcome:
  - `overrideMode=mounted`
  - `reloadMode=src_swap`
  - `runValidity.status=safety_fail`
  - `runValidity.passed=false`
  - `error=premature_menu_clear`
  - diagnostic checks all present (`has_trace_logs=true`, `has_classify_log=true`, `classification_known=true`, `truth_fields_present=true`)
  - `classification=underwater`
  - `menu_cleared_while_not_ready=true`
- Interpretation:
  - anti-false-claim harness changes are active and functioning:
    - non-clean runs are not passable despite full diagnostic data.
    - explicit safety failure is surfaced at top-level error/status.
- Hypothesis impact:
  - H2 still `supported` in this run (premature clear reproduced).
  - H4 still `supported` (underwater classification persists).
- Next:
  - treat any `runValidity.passed=false` as hard fail for milestone claims.
  - proceed with focused fix for `menu_cleared_while_not_ready` in both headless and headed paths.

### 2026-02-27T~11:00Z — Deep root-cause analysis: `menuClearedWhileWorldNotReady` is a false positive in headless

**Finding 1: The diagnostic flag is a rolling check, not a point-in-time check.**

`termpp_flat_map_bootstrap.js` lines 332-333:
```javascript
if (!inMainMenu && menuClearedAt < 0) menuClearedAt = age;      // one-time: records clear moment
if (!inMainMenu && !worldReady && menuClearedAt >= 0) ...= true; // ROLLING: fires every tick
```

In the T10:28 headless run, the menu cleared at frame 5 (t=1997ms) **while `world_ready=1`**.
`world_ready` then dropped at frame 8 (t=2302ms) — 300ms AFTER the legitimate clear.
The rolling check on line 333 fires on frame 8, setting `menuClearedWhileWorldNotReady=true`.

**This is a false positive.** The clear itself was not premature — `world_ready` was true at the moment of clearing.
The flag should record whether `world_ready` was true at the **moment of clearing**, not whether it ever drops afterward.
The existing `worldReadyDropCount` (28-33 in headless) already tracks post-clear regression separately.

**Finding 2: Headless zero-viewport chain causes `render_stage` freeze at 1.**

Root mechanism traced through the WASM bridge:
1. Headless Chromium + SwiftShader creates WebGL context but iframe `drawingBufferWidth=0`
2. `AsciickerLoop` computes `n=floor(0/fontWidth)=0, r=0` → calls `Render(0, 0)`
3. In C++ `Game::Render()`: sets `g_web_render_stage_code=1`, hits main_menu branch at stage 2, returns early
4. Stage never reaches 20+ (physics init) or 73 (minimap/full frame)
5. `GameWorldReady()` depends on `game->physics` being initialized → stays false
6. Brief `world_ready=1` at frames 5-7 is transient — engine hasn't stabilized with zero-size grid

Headed mode: iframe has real viewport (1440x980), `Render(cols, rows)` advances through full pipeline, stage reaches 73, `world_ready` stays stable.

**Finding 3: Two distinct problems being conflated.**

| Problem | What it is | Where |
|---------|-----------|-------|
| False positive detection | Rolling check catches post-clear regression as "premature clear" | `flat_map_bootstrap.js:333` |
| Headless world_ready instability | Zero-viewport → no physics init → world_ready unreliable | WASM engine + SwiftShader |

The diagnostic fix (point-in-time check) would eliminate false positives for runs where the menu cleared while `world_ready=true`.
The engine fix (force non-zero viewport before `StartGame`) would address the underlying headless instability.

**Trace evidence comparison (definitive):**

| Metric | Headless T10:28 | Headed T10:03 |
|--------|----------------|---------------|
| world_ready at clear moment | **1 (true)** | 1 (true) |
| world_ready after 300ms | **0 (dropped)** | 1 (stable) |
| render_stage after clear | **1 (stuck)** | 73 (full frame) |
| world_ready_drop_count | **28** | 0 |
| pos z progression | **frozen at 331** | falls 324→131 |
| grounded | oscillates | stable true |

**Architecture question: "How hard can it possibly be to replicate TERM++ skin?"**

The skin pipeline itself (PNG → XP → Emscripten FS → Load) is straightforward and works correctly.
ALL complexity is in the **test harness** — verifying the skin renders correctly in a live game session.
The engine is a full 3D game compiled to WASM; "did the skin apply?" requires the game loop to be running.

Simplification paths to evaluate:
1. **Headed-only testing**: Eliminate headless entirely. Stage advances to 73, world_ready is stable.
2. **Force-viewport preflight**: Before StartGame, ensure `drawingBufferWidth > 0` via CSS/layout forcing.
3. **Visual-only gate**: Screenshot canvas after skin inject + Load(), skip movement test. Verify skin pixels match expected output.
4. **Separate the concerns**: Skin-applied gate (FS write + Load succeeds) vs gameplay-works gate (world_ready + movement).

- Next:
  - Evaluate whether headed-only testing is sufficient for the milestone.
  - If headless is required: implement force-viewport preflight in bootstrap.
  - Fix the rolling-check false positive in line 333 regardless (it's a correctness bug).
