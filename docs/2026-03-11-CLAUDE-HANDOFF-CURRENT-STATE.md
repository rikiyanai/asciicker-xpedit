# Claude Handoff - Current State (2026-03-11)

> Historical note (2026-03-13): this remains the canonical branch/bundle history handoff for restore-line debugging, but it is not the default source for current editor implementation status on audited `master`. Start with `docs/INDEX.md` and the 2026-03-13 editor/doc handoff for that workflow.

## 2026-03-12 Addendum - Canonical Bundle Checkpoint

This document remains useful for branch-history context, but the canonical bundle checkpoint is now narrower and more specific than this handoff originally stated.

- active baseline worktree: `/Users/r/Downloads/asciicker-pipeline-v2`
- active baseline branch: `restore/bundle-override-filter-8279e11`
- committed base: `89b7d0616853276043cccd6130b1463700742c7d`
- required dirty delta on top of that commit:
  - `web/workbench.html`
  - `web/workbench.js`
  - `scripts/workbench_bundle_manual_watchdog.mjs`
  - `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
  - `docs/AGENT_PROTOCOL.md`

Verified checkpoint evidence:

- saved manual recording: `/Users/r/Downloads/workbench-ui-recording-2026-03-11T13-27-24-653Z.json`
- fresh headed replay: [result.json](/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-headed-replay-2026-03-12T13-56-16-164Z/result.json)

Exact successful sequence:

1. `Apply Template` with `player_native_full`
2. `Attack`
3. `Death`
4. `Idle / Walk`
5. `Test Bundle Skin`

Expected terminal state:

- `Bundle: 3/3 actions converted`
- `Applied bundle skin`

Important correction:

- the old local manual watchdog script was hardcoded `idle -> attack -> death`
- that ordering is not the canonical checkpoint
- future audits or merges must preserve and validate the exact recorded order above

This addendum supersedes any older assumption that plain `restore@89b7d06` alone is enough. The known-good bundle checkpoint is the exact dirty baseline described here.

## Purpose

This handoff replaces guesswork. The repo currently has multiple divergent branches and worktrees that all contain partial pieces of the Workbench skin-dock / bundle / runtime story. Claude should not improvise from memory.

This file records the current branch reality, the key regression timeline, and the exact next commands to resume from a stable base.

---

## Handoff Snapshot

- Branch: `feat/workbench-mcp-server`
- HEAD: `2ebfe6a0ff7076c7466e6d463e72f1f83648c1a3`
- Primary working tree: `/Users/r/Downloads/asciicker-pipeline-v2`
- Other active worktrees:
  - `/Users/r/Downloads/asciicker-pipeline-v2-clean-wt` -> `phase2-death-template` @ `8279e11ca712f1a19c68417e89727f4446efbcc5`
  - `/Users/r/Downloads/asciicker-pipeline-v2/.worktrees/sprite-extraction-dual-analysis` -> `feat/sprite-extraction-dual-analysis` @ `52419fe5b563b25eb9be75c67492f60e0f8b0ef4`
- Additional local branch of interest:
  - `restore/bundle-override-filter-8279e11` @ `89b7d0616853276043cccd6130b1463700742c7d`

---

## Executive Summary

The current branch `feat/workbench-mcp-server` is not the same thing as the "bundle fix version" the user expects.

The restore work was split across multiple branches:

- `ecbc927` restored the simpler working skin-dock JS from `1bfb929`
- `33820ed` imported a large self-contained runtime bundle and changed runtime assets
- `2ebfe6a` restored only part of the runtime map asset state
- `7ffce8d` on `restore/bundle-override-filter-8279e11` restored the runtime bundle from `8279e11`

Result: the branch being tested now is only a partial restore, while the fuller restore lives on a separate branch that was never merged back.

Claude must stop assuming:

- that `feat/workbench-mcp-server` contains the full restore line
- that local `master` is the integration truth
- that missing behavior can be reconstructed from memory

---

## Critical Truths

1. The branch the user is running now is `feat/workbench-mcp-server` at `2ebfe6a`.
2. The fuller runtime restore is on `restore/bundle-override-filter-8279e11`, not on the current branch.
3. `ecbc927` restored the skin-dock logic from `1bfb929`, but did not by itself restore the whole runtime/bootstrap bundle state.
4. `33820ed` materially changed bundled runtime assets and is a likely source of "world is wrong" drift.
5. `2ebfe6a` only restored selected flatmap assets:
   - `game_map_y8_original_game_map.a3d`
   - `minimal_2x2.a3d`
6. `restore/bundle-override-filter-8279e11` contains later restore-line commits:
   - `7ffce8d` runtime restore from clean worktree
   - `8142ae5` playwright test search root fix
   - `2e2cde9` test verdict relaxation
   - `892aefc` XP upload endpoint
   - `114f840` upload session fix
   - `89b7d06` branch-consolidation docs
7. There is no authoritative in-repo Claude doc stack right now:
   - `docs/INDEX.md` missing
   - `docs/AGENT_PROTOCOL.md` missing
   - `CLAUDE.md` missing

---

## Current User-Facing Problem

The user is asking why the skin test dock / world behavior is not back to the expected "bundle fix version."

Answer:

- because the full restore line is not on the branch currently being tested
- because the runtime bundle changed after the dock JS restore
- because subsequent debugging drift created multiple one-off test scripts and multiple candidate truths

This is a branch-truth problem before it is a UI problem.

---

## Verified Commit Timeline

### Historical baseline

- `1bfb929` - `Add workbench XP editor UX and skin dock reliability fixes`
  - Historical known-good reference for simpler skin-dock behavior

### Current branch restore sequence

- `e7a7cec` - `fix: disable runtime preflight requirement for classic mode skin dock`
- `1192596` - `fix: relax test requirement for Load function availability`
- `ecbc927` - `fix: restore working skin dock from commit 1bfb929`
  - Important: this restored simpler dock logic only
- `33820ed` - `chore: disconnect all external game file dependencies`
  - Large runtime import / self-contained runtime shift
  - Important: this is where runtime/world packaging changed substantially
- `2ebfe6a` - `restore: original game map file from working commit ecbc927`
  - Partial asset restore only

### Separate restore branch sequence

- branch created from `8279e11`
- `7ffce8d` - `restore: runtime files with bundle override filter from clean-wt (8279e11)`
- `8142ae5` - `fix: remove Y9-2 from playwright test search roots`
- `2e2cde9` - `fix: enable test verdict to pass with unavailable position reporting`
- `892aefc` - `feat: add XP file upload endpoint with roundtrip support`
- `114f840` - `fix: correct WorkbenchSession initialization in upload_xp`
- `89b7d06` - `docs: add branch consolidation and merge plan`

---

## Branch Relationship

`restore/bundle-override-filter-8279e11` is not a child of `feat/workbench-mcp-server`.

Current divergence count:

- `feat/workbench-mcp-server...restore/bundle-override-filter-8279e11`
- left/right count: `71 6`

Interpretation:

- current branch has many commits the restore branch does not
- restore branch has six commits the current branch does not
- the restore branch was not merged back

---

## Files That Matter Most

### Current branch logic / UI

- `web/workbench.js`
- `web/workbench.html`
- `web/termpp_flat_map_bootstrap.js`
- `scripts/workbench_png_to_skin_test_playwright.mjs`

### Runtime bundle / flat arena assets

- `runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.html`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.js`
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.wasm`
- `runtime/termpp-skin-lab-static/termpp-web-flat/flatmaps/game_map_y8_original_game_map.a3d`
- `runtime/termpp-skin-lab-static/termpp-web-flat/flatmaps/minimal_2x2.a3d`

### Existing research / handoff docs that Claude must read before guessing

- `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`
- `docs/CLAUDE_RESEARCH_DUMP_WORKBENCH_MOVE_FREEZE_2026-02-27.md`
- `docs/plans/2026-02-26-termpp-parity-fix-design.md`
- `docs/plans/2026-02-26-termpp-parity-fix-impl.md`

Key point: these docs already distinguish packaging issues from movement/world freeze issues. Do not collapse them into one bug.

---

## Existing Evidence About The Freeze

Claude previously documented that:

- skin-dock packaging/runtime-gate issues were one class of failure
- movement/world freeze after entering the runtime was a separate class
- `1bfb929` isolated repro plus later handoff docs already established that restoring map packaging alone did not fully eliminate runtime movement/world issues

Therefore:

- if the dock opens but the world freezes, do not blame iframe visibility
- if the user says "world is wrong," inspect runtime bundle and flatmap/bootstrap state first

---

## Current Working Tree Noise

These untracked scripts exist in the current repo and should not be treated as canonical truth:

- `bundle-headed-test-final.mjs`
- `headed-bundle-test-correct.mjs`
- `headed-bundle-test-with-screenshots.mjs`
- `headed-test-open-for-user.mjs`
- `headed-test-up-to-test-button.mjs`

They were created on 2026-03-11 around 01:28-01:35 local time during debugging thrash.

Do not create more one-off headed scripts until one canonical runner is chosen.

---

## What Claude Must Not Do

1. Do not assume the current branch contains the full restore line.
2. Do not tell the user "I don't know what version you mean" before checking the actual branch history and existing handoff docs.
3. Do not chase iframe visibility unless the runtime/bootstrap evidence points there.
4. Do not produce a merge plan based on local `master` without checking `origin/master`.
5. Do not treat `phase2-death-template` as "no bundle"; it already contains bundle APIs.
6. Do not generate more ad hoc Playwright/headed scripts unless explicitly asked and after checking whether an existing runner already covers the flow.

---

## Recommended Recovery Path

### Option A - Fastest truth check

Test the restore branch directly.

Why:

- it is the only branch with the fuller runtime restore line
- it answers the immediate user question: "is the bundle-fix version actually working?"

Commands:

```bash
git switch restore/bundle-override-filter-8279e11
python3 -m src.pipeline_v2.app
```

Then run the chosen test flow against that branch.

### Option B - If restore branch is the correct baseline

Make the restore branch the canonical debug branch, then merge/cherry-pick forward intentionally.

Do not keep debugging on `feat/workbench-mcp-server` while assuming restore-line behavior that is not actually there.

---

## Exact Next Commands To Resume

### Minimal resume

```bash
git switch restore/bundle-override-filter-8279e11
python3 -m src.pipeline_v2.app
```

### If you need to confirm current branch first

```bash
git switch feat/workbench-mcp-server
git log --oneline --decorate --max-count=8
git diff --name-status feat/workbench-mcp-server..restore/bundle-override-filter-8279e11 -- web/workbench.js web/workbench.html web/termpp_flat_map_bootstrap.js scripts/workbench_png_to_skin_test_playwright.mjs runtime/termpp-skin-lab-static/termpp-web-flat/
```

### If you need the key history again

```bash
git show --stat 1bfb929 ecbc927 33820ed 2ebfe6a 7ffce8d 8142ae5 89b7d06
```

---

## Decision Rule For The Next Agent

Before making any fix:

1. identify the branch being tested
2. identify whether the runtime bundle comes from `2ebfe6a` or the `7ffce8d` restore line
3. read `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`
4. only then decide whether the problem is:
   - branch mismatch
   - runtime bundle mismatch
   - remaining gameplay/world freeze bug

If step 1-3 are skipped, Claude will likely repeat the same confusion.

---

## Bottom Line

The user is not crazy. The main issue is not that the repo forgot everything. The repo contains multiple conflicting truths, and the fuller restore branch was never merged back into the branch being tested.

Treat `restore/bundle-override-filter-8279e11` as the authoritative candidate baseline until proven otherwise.
