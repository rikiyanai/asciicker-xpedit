# Claude Handoff: Strict Resume For Phase 4 Acceptance

Date: 2026-03-20
Status: active
Supersedes as primary resume point:
- `docs/2026-03-18-CLAUDE-HANDOFF-BUNDLE-RUNTIME-STRICT.md`

Use this handoff for a fresh Claude session.

This is not a Phase 1-3 rescue handoff. Those phases are substantially closed.
The current work is Phase 4: final acceptance, responsiveness, repeatability,
and keeping manual-review tooling separate from acceptance evidence.

## Start Here

Read in this exact order:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
6. `PLAYWRIGHT_FAILURE_LOG.md`
7. `docs/2026-03-20-CLAUDE-HANDOFF-PHASE-4-ACCEPTANCE-STRICT.md`
8. `docs/2026-03-18-CLAUDE-HANDOFF-BUNDLE-RUNTIME-STRICT.md` only for historical Phase 1-3 context

Do not start by re-litigating old runtime blocker theories.

## Git Truth

- Branch: `master`
- HEAD: `0be3c4a`
- HEAD subject: `docs: log full-recreation runs and update milestone 1 roadmap`

Committed milestones already in history:

1. `7e8ff60`
   - whole-sheet editor perf improvements
   - coordinate scaling fix
   - `New XP` button
2. `1bed60f`
   - bundle test runner shell safety
   - `--hold` support
3. `b7bb5c7`
   - whole-sheet editor audit docs and failure log
4. `45c5fd8`
   - auto-advance to next action after export
5. `ad77e19`
   - Skin Dock probe truth / frame-detach resilience
6. `72eef5a`
   - `manual_review` mode committed as diagnostic-only tooling
7. `1c21ee7`
   - `full_recreation` mode committed as the real-content final signoff lane
8. `62b0f83`
   - stabilize full-recreation verifier interactions and whole-sheet autosave behavior
9. `0be3c4a`
   - log full-recreation runs and update canonical Milestone 1 roadmap docs

## Current Worktree

Tracked worktree state is currently clean.

Only older untracked research/handoff files remain in the tree. Do not mistake those for
active product changes.

The earlier Phase 4 manual-review dirty state is no longer current. It has already been split
into committed history:

- `72eef5a`: `manual_review` mode
- `1c21ee7`: `full_recreation` mode
- `62b0f83`: runner click stabilization + debounced whole-sheet autosave / export flush

## Current Acceptance Evidence

### Manual-review run (diagnostic only)

Artifact:

- `output/xp-fidelity-test/bundle-run-2026-03-20T20-38-19Z/result.json`

Observed:

- `idle=true`
- `attack=true`
- `death=true`
- `skin_dock=true`

This run is useful for manual gameplay inspection only.

It is not final acceptance evidence because it paints synthetic markers, not real art fidelity.

### Full-recreation runs (real-content lane)

The first real-content final-signoff sequence is now logged in `PLAYWRIGHT_FAILURE_LOG.md`.

Artifacts:

- `output/xp-fidelity-test/bundle-run-2026-03-20T21-06-36Z/result.json`
- `output/xp-fidelity-test/bundle-run-2026-03-20T22-14-17Z/result.json`
- `output/xp-fidelity-test/bundle-run-2026-03-20T23-03-33Z/result.json`

Observed progression:

1. `2026-03-20T21-06-36Z`
   - fatal tool-button click timeout on `#wsToolLine`
   - harness/verification gap
2. `2026-03-20T22-14-17Z`
   - browser crash during full repaint/save storm
   - product/performance gap
3. `2026-03-20T23-03-33Z`
   - geometry/layout/execute/export/layers: pass
   - `skin_dock_pass=true`
   - remaining cell-fidelity failures only:
     - idle: 2 mismatches
     - attack: 26 mismatches
     - death: 22 mismatches

Interpretation:

- Milestone 1 is very close, but not signed off yet.
- Current best evidence points to small harness/input precision misses during full-sheet repaint,
  not broad content/export corruption.
- Under the hard-fail contract, this is still not a final pass until `cell_fidelity_pass=true`.

## Manual-Review Protocol: Non-Negotiable

The synthetic `T` protocol is strictly manual-only.

Rules:

- `manual_review` exists only to help a human visually inspect that frames/actions are reachable in runtime
- `manual_review` must never be cited as export fidelity proof
- `manual_review` must never replace the real acceptance path
- `manual_review` must remain clearly labeled diagnostic/manual in code and docs

If committed, commit it as manual tooling only.

## Final Acceptance Protocol: Non-Negotiable

The final check must use real sprite recreation, not synthetic markers.

Do not confuse these lanes:

1. Manual lane
   - `manual_review`
   - synthetic `T` marker(s)
   - held-open gameplay inspection
   - diagnostic only

2. Acceptance lane
   - real XP authoring/export flow
   - real cells, real glyphs, real colors
   - no synthetic `T` markers
   - this is the lane that counts for final signoff

The user explicitly wants the previous full run with full recreation for the final check.

That means:

- do not treat sparse proof-region acceptance alone as the final visual signoff
- do not treat `manual_review` as the final signoff
- `full_recreation` is now the dedicated final-signoff lane
- do not weaken or replace `full_recreation` with synthetic or bounded-proof substitutes

## Phase 4 Mission

Finish acceptance without drifting backward.

Primary objectives:

1. Preserve the manual-only `T` mode as a separate diagnostic path
2. Clear the remaining full-recreation cell-fidelity misses
3. Confirm responsiveness in real browser use is acceptable
4. Close the save-first bundle workflow/product gaps
5. Re-run enough times to establish repeatability rather than a one-off pass

## What Not To Reopen

Do not reopen these unless new contradictory evidence appears:

- bundle tab order
- death / `plydie` L1 encoding
- blank-to-converted bundle gating
- Skin Dock probe-truth misclassification as the main blocker
- “no New XP button”
- auto-advance after export

These were already handled in committed history.

## Open Risks

1. Responsiveness may still be subjectively too slow in real manual use even after Phase 1 fixes
2. Final acceptance could drift into the wrong lane if the next session mistakes `manual_review` for real acceptance
3. Small full-recreation misses may still remain until the input-precision/harness issue is fully cleared
4. The save-first bundle workflow is still incomplete (`blank` / `saved` / `converted`, top-level Save, no forced-download progression)

## Required Startup Commands

Run in this order:

```bash
python3 scripts/conductor_tools.py status --auto-setup
python3 scripts/self_containment_audit.py
git status --short
git log --oneline -6
```

If any old held-open browser/run is still alive, classify it before doing new work:

```bash
ps aux | rg "run_bundle.sh --mode .* --headed --hold|run_bundle_fidelity_test.mjs"
```

## Recommended Order For The Next Session

1. Rerun `full_recreation` on current HEAD
   - do not use `manual_review`
   - classify whether the remaining misses disappear or reproduce

2. If small misses remain, diagnose that exact issue narrowly
   - input precision
   - click/drag rounding
   - scroll-boundary interaction
   - runner/tool-state mismatch

3. Run the final manual browser acceptance with real content
   - headed
   - held open
   - move, attack, pick up item, die
   - visually confirm real sprite fidelity rather than synthetic markers

4. Close the save-first bundle workflow gaps
   - top-level Save
   - `blank` / `saved` / `converted`
   - Skin Dock readiness on `saved|converted`
   - no forced-download requirement just to move on

5. Review responsiveness
   - normal interactive use in browser
   - no “unbelievably and unusably slow” behavior
   - inspect stroke-end save behavior if lag is still visible

6. Re-run automated acceptance for repeatability
   - do not claim signoff from one lucky run

## Evidence Requirements

“Done” for Phase 4 requires all of:

- real acceptance lane pass
- manual runtime inspection on real content
- responsiveness judged acceptable in normal use
- save-first authoring workflow no longer blocked on export/download side effects
- repeat run(s) without regression
- commit evidence for any new mode or debounce changes

Anything less is progress, not completion.

## Handoff Snapshot

- Branch: `master`
- HEAD: `0be3c4a`
- Completed:
  - editor perf + coordinate scaling + New XP (`7e8ff60`)
  - bundle runner shell safety + `--hold` (`1bed60f`)
  - audit docs (`b7bb5c7`)
  - auto-advance after export (`45c5fd8`)
  - Skin Dock probe truth / frame-detach resilience (`ad77e19`)
  - `manual_review` diagnostic lane (`72eef5a`)
  - `full_recreation` final-signoff lane (`1c21ee7`)
  - full-recreation runner/autosave stabilization (`62b0f83`)
  - full-recreation run logging + Milestone 1 roadmap cleanup (`0be3c4a`)
- Deferred:
  - final real-content acceptance signoff (`full_recreation` still has small cell misses)
  - responsiveness signoff
  - save-first bundle workflow cleanup
  - repeatability confirmation
- Open Risks:
  - manual-review and acceptance lanes may be confused
  - responsiveness may still be below user bar
  - save-first authoring flow still has common-sense UX gaps
  - small full-recreation misses may still be a harness/input precision issue
- Resume:
  - `bash scripts/xp_fidelity_test/run_bundle.sh --mode manual_review --headed --hold` for manual synthetic-marker QA only
  - `bash scripts/xp_fidelity_test/run_bundle.sh --mode full_recreation --headed --hold` for the real final-signoff lane
  - then close the remaining save-first workflow and responsiveness gaps
