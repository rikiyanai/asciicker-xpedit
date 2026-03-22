# MVP Portability Audit & Cleanup Plan

Date: 2026-03-21

This document categorizes all portability issues found in the repo, separated into
must-fix, should-fix, and can-remain tiers. No mass deletions in this step — this is
the plan that cleanup follows.

## Must-Fix Before MVP Deploy

### 1. Hardcoded absolute repo path in live script

- **File:** `scripts/workbench_png_to_skin_test_playwright.mjs:76`
- **Issue:** `/Users/r/Downloads/asciicker-pipeline-v2` hardcoded as fallback PNG search root
- **Fix:** Replace with `__dirname`-relative path resolution or env var

### 2. SMALLTESTPNGs/ directory (~89 MB untracked)

- Large batch of test fixture PNGs, not committed but present in worktree
- If accidentally committed, bloats the repo permanently
- **Fix:** Add `SMALLTESTPNGs/` to `.gitignore`

### 3. Hardcoded localhost URLs in test/script files (not env-overridable)

These scripts will break if the server runs on a different host/port in production:

| File | Line | Value |
|------|------|-------|
| `scripts/workbench_bundle_manual_watchdog.mjs` | 10 | `http://127.0.0.1:5071/workbench` |
| `scripts/workbench_png_to_skin_test_playwright.mjs` | 11 | `http://127.0.0.1:5071/workbench` |
| `scripts/debug_workbench_skin_dock_playwright.mjs` | 9 | `http://127.0.0.1:5071/workbench` |
| `scripts/ui_tests/runner/cli.mjs` | 24 | `http://127.0.0.1:5071` |
| `scripts/ui_tests/core/server_control.mjs` | 15 | `http://127.0.0.1:5071/workbench` |
| `scripts/xp_fidelity_test/run_fidelity_test.mjs` | 19 | `http://127.0.0.1:5071/workbench` |
| `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs` | 35 | `http://127.0.0.1:5071/workbench` |

- **Fix:** Accept `--url` CLI arg or `WORKBENCH_URL` env var with `127.0.0.1:5071` as default
- Note: `scripts/ralph.sh` and `scripts/workbench_mcp_server.py` already use env vars — good pattern to follow

## Should-Fix Soon After MVP

### 4. Untracked agent/handoff docs in worktree

These exist locally but are not committed:

| Path | Size | Notes |
|------|------|-------|
| `INTEGRATION_STRATEGY_AND_REPLAN.md` | ~449 lines | Cross-reference of 9 audit findings |
| `REXPAINT_LIBRARY_AUDIT_FINDINGS.md` | ~733 lines | Library comparison (30+ libraries) |
| `docs/2026-03-17-CLAUDE-HANDOFF-AREA-BASED-RECIPE.md` | handoff | Area-based recipe handoff |
| `docs/2026-03-18-CLAUDE-HANDOFF-BUNDLE-RUNTIME-AND-WHOLE-SHEET-VISIBILITY.md` | handoff | Bundle runtime handoff |
| `docs/2026-03-18-CLAUDE-HANDOFF-BUNDLE-RUNTIME-STRICT.md` | handoff | Strict bundle handoff |
| `docs/research/ascii/2026-03-15-whole-sheet-rexpaint-pivot.md` | research | Whole-sheet pivot research |
| `docs/research/ascii/2026-03-15-whole-sheet-seam-map.md` | research | Seam map research |
| `sprites/Stony_Brook_Seawolves_logo_svg.xp` | test asset | Non-canonical test sprite |

- **Decision needed:** Commit useful ones, `.gitignore` ephemeral ones, or delete
- **Risk if left:** Untracked files won't appear in a fresh clone — no functional impact, but messy local worktree

### 5. `.ccb/` session directory (untracked)

- Claude Code session histories and metadata (~124 KB)
- **Fix:** Add `.ccb/` to `.gitignore` — these are per-machine session artifacts

### 6. `findings/` directory (untracked)

- 11 audit report files + large JSON summary
- Historical research output, not live product code
- **Fix:** Either commit as reference (if valuable) or `.gitignore`

### 7. Hardcoded paths in docs (~87 occurrences)

- ~87 references to `/Users/r/Downloads/asciicker-pipeline-v2` and `/Users/r/Downloads/asciicker-Y9-2` across docs/handoff files
- These are documentation artifacts, not executable code
- **Fix:** Low priority. Can be cleaned gradually. Focus on any that appear in `docs/INDEX.md` or `CLAUDE.md` first (e.g., `docs/INDEX.md` line 3 still references the absolute worktree path)

## Can Remain Historical/Local

### 8. Committed CLAUDE-HANDOFF docs

- 12+ handoff docs are committed and tracked
- They are historical session context, not product code
- **Status:** Harmless in the repo; provide lineage for decisions
- **No action needed** unless repo size becomes a concern

### 9. Localhost defaults in env-overridable files

Already portable:
- `src/pipeline_v2/app.py` — `PIPELINE_HOST`/`PIPELINE_PORT` env vars
- `scripts/ralph.sh` — `RALPH_URL` env var
- `scripts/workbench_mcp_server.py` — `WORKBENCH_URL` env var
- `playwright.config.js` — test-only config

### 10. `.claude/` project config

- `.claude/settings.local.json` contains local machine paths
- This is expected — `.local.` files are per-machine by convention
- **No action needed**

### 11. `progress.md` external path references

- Historical progress tracking with local path citations
- Not executable, not deployment-relevant
- **No action needed**

## Risky to Delete Blindly

- **`findings/`**: Contains audit research that informed design decisions. Read `findings/INDEX.md` before deleting — 5 of 11 findings are verified and may still be referenced.
- **Untracked handoff docs**: Some may contain context not captured elsewhere. Scan before deleting.
- **`REXPAINT_LIBRARY_AUDIT_FINDINGS.md`**: Comprehensive library comparison that could be useful reference for future codec decisions.
- **`sprites/Stony_Brook_Seawolves_logo_svg.xp`**: May be a test fixture in active use — check before removing.

## Recommended .gitignore Additions

```
SMALLTESTPNGs/
.ccb/
```

These two entries prevent the most likely accidental commits. The `findings/` directory and untracked docs are a case-by-case decision.
