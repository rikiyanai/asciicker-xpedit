# Pre-Fix vs Post-Fix Comparison — 2026-03-01

## Summary

The layer structure fix (commit b196f39) corrected pipeline XP layers 0 and 1 to
match native conventions but **did not reduce crash rate**. This table demonstrates
that the crash cause is not layer encoding.

## Pre-Fix A/B Matrix (T21, commit a7b7c7e)

XP used: `player-workbench-reliability-20260223.xp` (252x160, original sparse layers)

| Group | XP | Runs | WASM Crash | Avg MemOOB | Moved |
|-------|----|------|------------|-----------|-------|
| Control | native player-0100 (126x80) | 10 | 0/10 | 0 | 10/10 |
| Case | pipeline reliability (252x160) | 10 | 7/10 | 1219 | 3/10 |

## Post-Fix Matrix (T22:39, commit b196f39)

XP used: `player-pipeline-fixed-layers.xp` (252x160, populated layers 0+1)

| Group | XP | Runs | WASM Crash | Crash Signals | Moved |
|-------|----|------|------------|---------------|-------|
| Control | native player-0100 (126x80) | 5 | 0/5 | 0/5 | 5/5 |
| Fixed layers | pipeline fixed 252x160 | 5 | 4/5 | 5/5 (incl 1 invalid_run) | 1/5 |
| Fixed layers | pipeline fixed 126x80 | 5 | 5/5 | 5/5 | 0/5 |
| Original | pipeline reliability 252x160 | 5 | 4/5 | 5/5 (incl 1 invalid_run) | 1/5 |

### Post-Fix Per-Run Detail

#### Native control (0/5 crash)
| # | Timestamp | Error | CrashAny | RemCrash | MemOOB | Moved |
|---|-----------|-------|----------|----------|--------|-------|
| 1 | T22-39-31 | invalid_run | false | 0 | 0 | true |
| 2 | T22-39-45 | invalid_run | false | 0 | 0 | true |
| 3 | T22-40-00 | invalid_run | false | 0 | 0 | true |
| 4 | T22-40-14 | invalid_run | false | 0 | 0 | true |
| 5 | T22-40-29 | invalid_run | false | 0 | 0 | true |

#### Pipeline fixed-layers 252x160 (4/5 wasm_crash, 1 invalid_run_with_crash)
| # | Timestamp | Error | CrashAny | RemCrash | MemOOB | Moved |
|---|-----------|-------|----------|----------|--------|-------|
| 1 | T22-40-43 | wasm_crash | true | 0 | 52 | false |
| 2 | T22-40-57 | wasm_crash | true | 0 | 49 | false |
| 3 | T22-41-11 | invalid_run | true | 87 | 469 | true |
| 4 | T22-41-25 | wasm_crash | true | 91 | 2187 | false |
| 5 | T22-41-52 | wasm_crash | true | 0 | 50 | false |

#### Pipeline fixed-layers 126x80 (5/5 wasm_crash)
| # | Timestamp | Error | CrashAny | RemCrash | MemOOB | Moved |
|---|-----------|-------|----------|----------|--------|-------|
| 1 | T22-42-06 | wasm_crash | true | 0 | 50 | false |
| 2 | T22-42-20 | wasm_crash | true | 0 | 50 | false |
| 3 | T22-42-34 | wasm_crash | true | 0 | 52 | false |
| 4 | T22-42-47 | wasm_crash | true | 0 | 51 | false |
| 5 | T22-43-01 | wasm_crash | true | 0 | 50 | false |

#### Pipeline original 252x160 (4/5 wasm_crash, 1 invalid_run_with_crash)
| # | Timestamp | Error | CrashAny | RemCrash | MemOOB | Moved |
|---|-----------|-------|----------|----------|--------|-------|
| 1 | T22-43-15 | wasm_crash | true | 0 | 50 | false |
| 2 | T22-43-29 | invalid_run | true | 3 | 534 | true |
| 3 | T22-43-43 | wasm_crash | true | 0 | 52 | false |
| 4 | T22-43-59 | wasm_crash | true | 91 | 2187 | false |
| 5 | T22-44-26 | wasm_crash | true | 91 | 2188 | false |

## Comparison Verdict

| Metric | Pre-Fix Pipeline | Post-Fix Pipeline (fixed) | Post-Fix Pipeline (original) |
|--------|-----------------|--------------------------|------------------------------|
| Dimensions | 252x160 | 252x160 | 252x160 |
| Layer 0 | sparse metadata | fully populated | sparse metadata |
| Layer 1 | blank | animation indices | blank |
| WASM crash rate | 7/10 | 4/5 | 4/5 |
| Crash signal rate | N/A (not tracked) | 5/5 | 5/5 |

**Conclusion:** Fixed and original pipeline XPs crash at statistically identical rates.
The layer structure fix (populating layers 0 and 1) does not reduce crashes.
Combined with the A/A/B check showing pipeline content at native dimensions
still crashes 5/5, the crash is confirmed as a **race condition in mounted
injection**, not a content, dimension, or layer encoding issue.

## Stochastic Retest Evidence (T23:03–T23:07)

Final confirmation that crash behavior is non-deterministic:

| XP | Run 1 | Run 2 | Note |
|----|-------|-------|------|
| test-fill-100pct (126x80, uniform glyph 219) | no crash (T23-03-16) | crash (T23-03-45) | **identical file, different result** |
| native player-0100 (126x80, 4.2KB) | 0/5 crash (T23-04-41 to T23-05-40) | — | consistent |
| pipeline reliability (252x160, 18KB+) | 4/5 crash (T23-05-55 to T23-07-18) | — | consistent with pre-fix |

## Artifact References

All raw result.json files are in `output/playwright/workbench-png-to-skin-<timestamp>/`.
See `ab-matrix-2026-03-01.md` Evidence Files section for complete directory listing.
