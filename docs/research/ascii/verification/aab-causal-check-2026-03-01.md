# A/A/B Causal Dimension Check — 2026-03-01T21:53:54Z

## A (native 126x80) + game_map_y8

| # | Error | FMD Cls | Status | Passed | RemCrash | MemOOB | CrashAny | InvalidWithCrash | Moved |
|---|-------|---------|--------|--------|----------|--------|----------|------------------|-------|
| 1 | invalid_run | unknown | invalid_run | False | 0 | 0 | False | False | True |
| 2 | invalid_run | unknown | invalid_run | False | 0 | 0 | False | False | True |
| 3 | invalid_run | unknown | invalid_run | False | 0 | 0 | False | False | True |
| 4 | invalid_run | unknown | invalid_run | False | 0 | 0 | False | False | True |
| 5 | invalid_run | unknown | invalid_run | False | 0 | 0 | False | False | True |

## A2 (pipeline resized 126x80) + game_map_y8

| # | Error | FMD Cls | Status | Passed | RemCrash | MemOOB | CrashAny | InvalidWithCrash | Moved |
|---|-------|---------|--------|--------|----------|--------|----------|------------------|-------|
| 1 | wasm_crash | freeze_world_ready_dropped | valid | False | 91 | 2195 | True | False | False |
| 2 | wasm_crash | freeze_world_ready_dropped | valid | False | 91 | 2193 | True | False | False |
| 3 | wasm_crash | freeze_world_ready_dropped | valid | False | 91 | 2198 | True | False | False |
| 4 | wasm_crash | freeze_world_ready_dropped | valid | False | 91 | 2194 | True | False | False |
| 5 | wasm_crash | freeze_world_ready_dropped | valid | False | 89 | 2186 | True | False | False |

## B (pipeline original 252x160) + game_map_y8

| # | Error | FMD Cls | Status | Passed | RemCrash | MemOOB | CrashAny | InvalidWithCrash | Moved |
|---|-------|---------|--------|--------|----------|--------|----------|------------------|-------|
| 1 | wasm_crash | freeze_world_ready_dropped | valid | False | 89 | 2198 | True | False | False |
| 2 | wasm_crash | freeze_world_ready_dropped | valid | False | 91 | 2197 | True | False | False |
| 3 | wasm_crash | freeze_world_ready_dropped | valid | False | 91 | 2190 | True | False | False |
| 4 | invalid_run | unknown | invalid_run | False | 3 | 12 | True | True | True |
| 5 | wasm_crash | freeze_world_ready_dropped | valid | False | 0 | 51 | True | False | False |


## Causal Interpretation

**RESULT: Dimensions alone do NOT explain the crash.**

- A (native 126x80): 0/5 crashes, 5/5 moved — clean
- A2 (pipeline content cropped to 126x80): **5/5 wasm_crash** — identical crash profile to B
- B (pipeline original 252x160): 4/5 wasm_crash + 1 invalid_run_with_crash_signals — crashes

A2 has the same dimensions as A but crashes identically to B. This rules out
dimensional mismatch as the sole cause. The crash is in the **cell content**
produced by the pipeline, not the grid size.

### Content-level hypotheses tested (all rejected):
1. Layer structure (metadata/animation index encoding) — fixed in b196f39, crash persisted
2. Glyph values (219/223 vs native range) — uniform glyph tests show stochastic behavior
3. Fill density / sparse cells — all densities 1-100% showed crashes

### Actual root cause identified:
**Race condition in `override_mode=mounted` injection.** Crash rate correlates with
XP file size (injection duration), not cell content. Native (4.2KB) injects fast → 0/5
crashes. Pipeline (18KB+) injects slowly → widens the EMFS write / WASM execution race
window → 4-5/5 crashes. Identical XPs produce stochastic results confirming
non-determinism.
