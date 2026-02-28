# Ralph Loop: Red-Green-Refactor Watch Loop for Skin Testing

Date: 2026-02-27

## Problem

Iterating on the skin test pipeline requires manually running a long `node` command, extracting fields with `jq`, eyeballing the verdict, tweaking code, and repeating. 42 manual runs today. This is slow and error-prone.

## Solution

A shell script (`scripts/ralph.sh`) that watches `web/termpp_flat_map_bootstrap.js`, `web/workbench.js`, and `web/workbench.html` for changes. On each save, it:

1. Syncs bootstrap source → runtime copy
2. Runs the headed Playwright skin test (full UI flow: upload → analyze → convert → test)
3. Extracts the verdict from result.json
4. Prints a strict CLAIM block with all required fields

## Invocation

```bash
./scripts/ralph.sh /path/to/daimon_sheet.png

# Or via justfile:
just ralph /path/to/daimon_sheet.png
```

One required arg: the PNG sprite sheet path.

### Env-overridable defaults

| Variable | Default | Purpose |
|----------|---------|---------|
| `RALPH_URL` | `http://127.0.0.1:5071/workbench` | Server URL |
| `RALPH_OVERRIDE_MODE` | `mounted` | Override mode |
| `RALPH_RELOAD_MODE` | `src_swap` | Reload mode |
| `RALPH_TIMEOUT_SEC` | `90` | Test timeout |
| `RALPH_MOVE_SEC` | `2` | Movement test duration |

## Preflight Gates

Before the watch loop starts, all must pass or the script exits 1:

1. **Server reachable**: `curl -sf "$URL" -o /dev/null` → fail: "Server not reachable at $URL"
2. **Bootstrap in sync**: `diff web/termpp_flat_map_bootstrap.js runtime/.../flat_map_bootstrap.js` → if differs: auto-sync + warn
3. **PNG exists**: `[ -f "$PNG" ]` → fail: "PNG not found: $PNG"
4. **fswatch available**: `command -v fswatch` → fail: "Install fswatch: brew install fswatch"

## Watch Loop

```
fswatch -o --latency 1 \
  web/termpp_flat_map_bootstrap.js \
  web/workbench.js \
  web/workbench.html |
while read _; do
  sync_bootstrap
  run_test
  extract_verdict
  print_claim
done
```

- `--latency 1`: 1-second debounce to avoid double-triggers on save
- Bootstrap sync runs before every test (not just preflight)
- One headed run per trigger (single, not batch)

## Verdict Format

Every run prints a strict CLAIM block:

```
══════════════════════════════════════════
CLAIM: Skin test run completed
EVIDENCE: output/playwright/workbench-png-to-skin-<ts>/result.json
  error:          null | <error_type>
  status:         valid | invalid_run | invalid_env_headless_zero_viewport | safety_fail
  classification: playable | underwater | freeze_* | stuck_menu | unknown
  gateA.passed:   true | false
  gateB.passed:   true | false
  passed:         true | false
  menu_cleared_while_not_ready: true | false
  world_ready_drop_count: <N>
  viewport_zero:  true | false
  moved:          true | false
VERDICT: PASS | FAIL | INVALID_RUN
NEXT: watching for changes...
══════════════════════════════════════════
```

### Verdict rules

- **PASS**: `passed == true` (requires gateA.passed AND gateB.passed)
- **FAIL**: `passed == false` AND all required fields present
- **INVALID_RUN**: any required jq field missing from result.json

Nonzero exit code per cycle on FAIL/INVALID_RUN, but loop continues watching.

### Required jq fields (all must be present or INVALID_RUN)

- `.error`
- `.runValidity.status`
- `.runValidity.passed`
- `.runValidity.gateA.passed`
- `.runValidity.gateB.passed`
- `.firstMoveDiagnostic.classification`
- `.firstMoveDiagnostic.menu_cleared_while_not_ready`
- `.firstMoveDiagnostic.world_ready_drop_count`
- `.firstMoveDiagnostic.viewport_zero`
- `.moveResult.moved`

## Files

| File | Purpose |
|------|---------|
| `scripts/ralph.sh` | The watch loop script |
| `justfile` | Add `ralph` recipe that calls `scripts/ralph.sh` |

## Non-goals

- Headless testing (headed only for now)
- Batch runs (single run per trigger; batch validation is a separate tool)
- NPC reskin (B1) — tracked separately, not mixed into movement/freeze criteria
