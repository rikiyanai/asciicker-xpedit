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

Do not replace prior failed attempts with summaries. Keep the chain of evidence.

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
