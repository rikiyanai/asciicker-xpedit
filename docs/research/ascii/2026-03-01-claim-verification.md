# 2026-03-01 Claim Verification Audit

## Scope

Audit of the current "Section 3/4" claims shown in terminal output:

1. Structural XP comparison is conclusive and explains crash via dimensional mismatch.
2. A/B matrix (2 XPs x 2 maps x N=5) is in progress/usable as evidence.

Date: 2026-03-01  
Repo: `/Users/r/Downloads/asciicker-pipeline-v2`  
Branch: `fix/solo-only-load-contract` (`45a85c5`)

## Preflight

- `python3 scripts/conductor_tools.py status --auto-setup` -> READY
- `python3 scripts/git_guardrails.py audit` -> unavailable in this repo (script missing)
- `git status --short` -> `?? runtime/`
- `git worktree list` -> single worktree on current branch
- `git stash list` -> empty

## Claim Checks

### Claim A

Claim text: "All are structurally valid REXPaint v-1 with 4 layers. Crash supported as dimensional mismatch."

- Verification command:
  - `PYTHONPATH=src python3 -c "<read_xp over native + pipeline files>"`
- Evidence paths:
  - `/Users/r/Downloads/asciicker-Y9-2/sprites/player-0100.xp` -> `126x80`, `layers=4`, `ver=-1`
  - `/Users/r/Downloads/asciicker-pipeline-v2/sprites/player-workbench-reliability-20260223.xp` -> `252x160`, `layers=4`, `ver=-1`
  - `/Users/r/Downloads/asciicker-pipeline-v2/sprites/player-fidelity-pass-rr8-20260223.xp` -> `378x240`, `layers=4`, `ver=-1`
  - `/Users/r/Downloads/asciicker-pipeline-v2/sprites/skeleton-workbench-accepted-20260223.xp` -> `240x40`, `layers=4`, `ver=-1`
- Metadata summary:
  - native cells/layer: `10,080`
  - reliability cells/layer: `40,320` (`4.0x`)
  - fidelity cells/layer: `90,720` (`9.0x`)
  - skeleton cells/layer: `9,600` (`~0.95x`)
- Playability confirmation: not covered by this structural check.
- Commit evidence: `N/A` (artifact verification only).
- Verdict: `partial`
  - Structural validity (`ver=-1`, 4 layers) is verified.
  - Dimensional mismatch exists for two files and geometry-shape mismatch exists for all three.
  - "Crash explained by dimension mismatch" is not proven by this check alone.

### Claim B

Claim text: "A/B matrix runs are in progress and can support conclusions."

- Verification commands:
  - `node scripts/workbench_png_to_skin_test_playwright.mjs --help`
  - `python3 -c "<check result_path existence for matrix/parity summaries>"`
  - `nl -ba /tmp/pipeline-server-2.log`
- Evidence:
  - Runner has no `--help`, no matrix/repeat arguments; it is single-run oriented:
    - `scripts/workbench_png_to_skin_test_playwright.mjs` lines 9-35, 148-167
  - Existing matrix summary has null parsed fields:
    - `output/playwright/matrix-summary-20260227T032752Z.json` lines 9-16, 23-30, 37-44, 51-58
  - Corrected summary claims moved/underwater but referenced `result_path` artifacts are missing:
    - `output/playwright/matrix-summary-corrected-20260227T033134Z.json` lines 8, 22, 36, 50
  - Same missing-artifact issue exists for additional summaries:
    - `output/playwright/p1-batch-20260227-003727/summary.json` lines 7, 21, 35, 49, 63
  - Attempted "restart" log shows bind failure on port 5071:
    - `/tmp/pipeline-server-2.log` lines 3-4
- Playability confirmation: not reproducible from currently present summary artifacts.
- Commit evidence: `N/A` (artifact verification only).
- Verdict: `not verified`
  - The matrix claims are not currently reproducible from retained result artifacts.
  - Current evidence is summary-only and partially stale.

### Claim C

Claim text: "Current branch has solo-only hardening patch."

- Verification commands:
  - `git log --oneline -n 1`
  - `git show --stat --oneline 45a85c5`
  - `nl -ba web/workbench.js | sed -n '850,870p'`
- Evidence:
  - HEAD commit `45a85c5` modifies `web/workbench.js` + `web/termpp_flat_map_bootstrap.js`
  - Solo-only load contract comments + behavior in:
    - `web/workbench.js` lines 850-866
- Commit evidence: `45a85c5`
- Verification evidence: source inspection passed.
- Verdict: `verified`

## Overall Verdict

`PARTIALLY VERIFIED` — crash attribution revised after A/A/B and isolation testing.

What is verified:

- XP structural facts (version/layer metadata, dimensions) for referenced files.
- Presence of solo-only patch on current branch.
- A/B matrix evidence retained: `docs/research/ascii/verification/ab-matrix-2026-03-01.{md,json}`
- A/A/B causal check retained: `docs/research/ascii/verification/aab-causal-check-2026-03-01.md`
- Dimensional mismatch **rejected** as sole crash cause (A/A/B: resized pipeline at native dims still crashes)
- Layer structure **rejected** as crash cause (fix in b196f39 did not reduce crash rate)
- Crash identified as **race condition** in `override_mode=mounted` injection, correlated with file size

What is not verified:

- Root cause fix for the injection race (still open)
- pos=[None,None,None] classification regression (separate issue)

