# Claude Research Dump: Workbench Skin Test Freeze/Underwater Regression

Date: 2026-02-27T01:17:44Z  
Repo: `/Users/r/Downloads/asciicker-pipeline-v2`  
Primary legacy runtime source: `/Users/r/Downloads/asciicker-Y9-2`

## Executive Answer: What Is Actually Going On

This is not one bug. It is at least three overlapping states:

1. The exact user-reported "underwater after first move" window (`2026-02-26T09:18Z..10:28Z`) was a live working-tree state, not a clean commit.
2. Later commits changed startup behavior and can shift the symptom to "move then freeze" instead of "move then fall underwater."
3. Historical snapshot launches can fail independently due static bundle packaging gaps (missing `flatmaps/*.a3d`), which causes permanent `Webbuild loading...` and masks gameplay-state bugs.

So "just revert to commit X" cannot faithfully restore that exact bug window.

## High-Signal Timeline (UTC)

- `2026-02-26T09:18:04Z` user: "stuck on loading screen again"
- `2026-02-26T09:21:47Z` user: "works for an instant then goes underwater"
- `2026-02-26T09:36:47Z` user: "after first movement, it falls through"
- `2026-02-26T09:59:32Z` user: "still the same issue why?"
- `2026-02-26T10:28:35Z` assistant: `spawnz` experiment reverted

Commit timestamps:

- `1bfb929` = `2026-02-25T07:11:05Z`
- `82e7b24` = `2026-02-26T14:25:00Z` (later than the failure window above)

Implication:

- `82e7b24` is too late to represent the user's reported underwater window.
- `1bfb929` is earlier but still not equivalent to the exact live state from `09:18Z..10:28Z`.

## Snapshot Attempts and Outcomes

### Snapshot A: `82e7b24` in `/Users/r/Downloads/asciicker-pipeline-v2-underwater-repro`

Initial issue:
- `/workbench` = `200`
- `/termpp-web-flat/index.html` = `404`
- `/termpp-web-flat/flat_map_bootstrap.js` = `404`

Fix:
- rebuilt static bundle with `./scripts/build_termpp_skin_lab_static.sh`

After fix:
- endpoints recovered to `200`
- gameplay symptom still not matching target underwater window

### Snapshot B: `1bfb929` in `/tmp/asciicker-pipeline-v2-1bfb929`

Initial issue:
- runtime bundle existed, but `termpp-web-flat/flatmaps/` was missing required maps for bootstrap default (`minimal_2x2.a3d`)
- result: persistent `Webbuild loading...`

Fix:
- copied maps manually:
  - `minimal_2x2.a3d`
  - `minimal_1x1.a3d`
  - `game_map_y8.a3d`

Verification:
- `/termpp-web-flat/flatmaps/minimal_2x2.a3d` = `200`
- `/termpp-web-flat/flatmaps/game_map_y8.a3d` = `200`

Current user report after packaging fix:
- rotation works
- first movement freezes runtime

## Why It Does Not Cleanly "Go Back to Underwater"

1. The target window was not captured as a committed SHA.
2. The launch path depends on generated static output (`output/termpp-skin-lab-static`) that can drift from source unless rebuilt/copied correctly per snapshot.
3. Multiple runtime fixes between the historical window and later snapshots altered failure mode.

In short: we are trying to reproduce a transient in-session state using commits that bracket it, not contain it.

## Hypotheses Status

### Ruled out / weakened

- Global XP incompatibility with TERM++ (not primary): there are passing playable runs and brief-success reports.
- Pure dock-button/UI issue: UI regressions exist, but movement-triggered freeze persists after load.

### Supported

- Version/state sensitivity is severe (commit + generated assets both matter).
- Failure is likely in post-start movement path (physics/collision/water/readiness), not only in upload/inject.

### Open

- Web runtime movement tick enters invalid state (freeze/hang) when locomotion begins.
- Collision/water readiness race after `PLAY`.
- Web-only ordering difference vs native runtime.

## Evidence and Artifacts

Primary logs:
- `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`
- `docs/WORKBENCH_FLAT_ARENA_WATER_LOADING_RESEARCH_HANDOFF.md`

Representative watchdog artifacts:
- Fail: `artifacts/ui-tests/test-e2e-2026-02-26T03-55-42-982Z/workbench-dock-load-watchdog/dock-load-watchdog-summary.json`
- Pass: `artifacts/ui-tests/test-e2e-2026-02-26T08-09-19-631Z/workbench-dock-load-watchdog/dock-load-watchdog-summary.json`

Current snapshot UI evidence (older dock controls present in `1bfb929`):
- `/tmp/asciicker-pipeline-v2-1bfb929/web/workbench.html` lines containing:
  - `Apply In Place`
  - `Apply + Restart`
  - `Upload Test Skin`

## Environment and Runtime State

Active server at report time:
- command: `python3 -m src.pipeline_v2.app`
- workdir: `/tmp/asciicker-pipeline-v2-1bfb929`
- URL: `http://127.0.0.1:5071/workbench`

Repo state:
- main worktree is dirty with many unrelated modifications; do not hard-reset.

## Audit: What Was Done Correctly vs Incorrectly

Correct:
- Timeline narrowed to exact user-message anchors.
- Static bundle endpoint checks (`200/404`) identified real packaging blockers.
- Append-only failure log maintained with concrete timestamps and outcomes.

Incorrect / costly:
- Initially launched `82e7b24` as if it represented target window; it is temporally later.
- Underestimated impact of generated `output/` assets drifting per snapshot.
- Attempted commit-based rollback for a likely uncommitted transient session state.

## Required Next Work for Claude (Prioritized)

1. Reconstruct the transient `2026-02-26T09:18Z..10:28Z` source state:
- parse session JSON for assistant file-edit operations in that interval
- recover exact `workbench.js` and `termpp_flat_map_bootstrap.js` deltas applied then reverted
- produce a synthetic branch reproducing that exact state

2. Add movement-path diagnostics in flat runtime (web):
- first 2 seconds after `PLAY`, log:
  - player position (`x,y,z`)
  - grounded/water indicators (if exposed)
  - world/collision ready markers
  - frame progression heartbeat
- classify freeze as:
  - JS exception loop
  - WASM stall
  - infinite loading gate
  - dead input loop

3. Cross-check native vs web on same map/start sequence:
- verify if native exhibits freeze/fall after first movement under equivalent spawn/start timing
- isolate web-only differences in startup ordering

4. Harden snapshot launch reproducibility:
- enforce preflight assertion that required flatmaps exist before launching server
- fail fast if `flatmaps/minimal_2x2.a3d` missing

## Suggested Data Collection Contract for Next Run

For every run, capture:
- commit/worktree id
- static bundle build command and output path
- endpoint status:
  - `/workbench`
  - `/termpp-web-flat/index.html`
  - `/termpp-web-flat/flat_map_bootstrap.js`
  - `/termpp-web-flat/flatmaps/minimal_2x2.a3d`
- user action sequence to first movement
- exact terminal state:
  - freeze
  - underwater/fallthrough
  - loading loop
  - playable

## Bottom Line for Leadership/Decision

Current blocker is not "we cannot code a fix."  
Current blocker is "we are not yet executing against the exact failing state."

Until the `09:18Z..10:28Z` transient source state is reconstructed, movement freeze vs underwater is expected to flip between nearby snapshots.
