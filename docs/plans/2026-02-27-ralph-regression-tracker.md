# Ralph Regression Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-cycle artifact folders, append-only history, delta classification, and change fingerprinting to ralph.sh — so every cycle is auditable and regressions are immediately visible in console output.

**Architecture:** All new logic lives inside `scripts/ralph.sh`. Each cycle writes artifacts to `output/ralph/cycle-<ISO>-<N>/`, appends one JSONL line to `output/ralph/history.jsonl`, computes a delta against the previous cycle, and prints two extra lines in the verdict block. No external dependencies beyond what ralph already requires (jq, git, shasum).

**Tech Stack:** bash, jq, git diff, shasum -a 256

**Watched files (used for changes.patch scope):**
- `web/termpp_flat_map_bootstrap.js`
- `web/workbench.js`
- `web/workbench.html`

---

### Task 1: Add cycle artifact directory and file saving

**Files:**
- Modify: `scripts/ralph.sh`

**Step 1: Add RALPH_OUT dir constant and WATCHED_FILES array after the RT_BOOTSTRAP line**

Insert after line 18 (`RT_BOOTSTRAP=...`), before the arg parsing section:

```bash
# Artifact output
RALPH_OUT="$REPO_ROOT/output/ralph"
HISTORY_FILE="$RALPH_OUT/history.jsonl"

# Files watched — also used for changes.patch scope
WATCHED_FILES=(
  "$REPO_ROOT/web/termpp_flat_map_bootstrap.js"
  "$REPO_ROOT/web/workbench.js"
  "$REPO_ROOT/web/workbench.html"
)
```

**Step 2: Add `save_cycle_artifacts` function after `sync_bootstrap` and before the verdict extraction section**

```bash
# ── Cycle artifacts ──
save_cycle_artifacts() {
  local cycle_num="$1" cycle_start="$2" result_path="$3" verdict="$4" extracted="$5"
  local cycle_end cycle_dur_ms cycle_ts cycle_dir

  cycle_end="$(date +%s)"
  cycle_dur_ms=$(( (cycle_end - cycle_start) * 1000 ))
  cycle_ts="$(date -u -r "$cycle_start" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"
  cycle_dir="$RALPH_OUT/cycle-${cycle_ts}-${cycle_num}"

  mkdir -p "$cycle_dir"

  # 1. Copy result.json (if it exists)
  if [[ -f "$result_path" ]]; then
    cp "$result_path" "$cycle_dir/result.json"
  fi

  # 2. Write verdict.json (normalized fields from extracted, plus verdict)
  if [[ -n "$extracted" ]]; then
    echo "$extracted" | jq --arg v "$verdict" '. + {verdict: $v}' > "$cycle_dir/verdict.json"
  else
    printf '{"verdict":"%s"}\n' "$verdict" > "$cycle_dir/verdict.json"
  fi

  # 3. changes.patch — git diff of watched files
  local patch_content
  patch_content="$(git -C "$REPO_ROOT" diff -- \
    web/termpp_flat_map_bootstrap.js \
    web/workbench.js \
    web/workbench.html 2>/dev/null)" || true
  printf '%s' "$patch_content" > "$cycle_dir/changes.patch"

  # 4. changes.stat
  git -C "$REPO_ROOT" diff --stat -- \
    web/termpp_flat_map_bootstrap.js \
    web/workbench.js \
    web/workbench.html > "$cycle_dir/changes.stat" 2>/dev/null || true

  # 5. meta.json
  local git_head
  git_head="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
  jq -n \
    --argjson cycle "$cycle_num" \
    --arg start_ts "$cycle_ts" \
    --argjson start_epoch "$cycle_start" \
    --argjson end_epoch "$cycle_end" \
    --argjson duration_ms "$cycle_dur_ms" \
    --arg git_head "$git_head" \
    '{cycle: $cycle, start_ts: $start_ts, start_epoch: $start_epoch, end_epoch: $end_epoch, duration_ms: $duration_ms, git_head: $git_head}' \
    > "$cycle_dir/meta.json"

  # 6. Compute change fingerprint
  local fingerprint
  if [[ -z "$patch_content" ]]; then
    fingerprint="no_change"
  else
    fingerprint="$(printf '%s' "$patch_content" | shasum -a 256 | cut -d' ' -f1)"
  fi

  # Return values via globals (bash limitation)
  _CYCLE_DIR="$cycle_dir"
  _FINGERPRINT="$fingerprint"
  _GIT_HEAD="$git_head"
  _SHORTSTAT="$(git -C "$REPO_ROOT" diff --shortstat -- \
    web/termpp_flat_map_bootstrap.js \
    web/workbench.js \
    web/workbench.html 2>/dev/null | sed 's/^ //' || echo "no changes")"
}
```

**Step 3: Verify syntax**

Run:
```bash
bash -n scripts/ralph.sh
```
Expected: No errors.

**Step 4: Commit**

```bash
git add scripts/ralph.sh
git commit -m "feat: ralph cycle artifact saving (dir, result, verdict, patch, meta)"
```

---

### Task 2: Add append-only history.jsonl writer

**Files:**
- Modify: `scripts/ralph.sh`

**Step 1: Add `append_history` function after `save_cycle_artifacts`**

```bash
# ── Append-only history ──
append_history() {
  local cycle_num="$1" result_path="$2" verdict="$3" extracted="$4" fingerprint="$5" git_head="$6"

  mkdir -p "$RALPH_OUT"

  # Build history line from extracted fields (or defaults for INVALID_RUN)
  local history_line
  if [[ -n "$extracted" ]]; then
    history_line="$(echo "$extracted" | jq -c \
      --argjson cycle "$cycle_num" \
      --arg verdict "$verdict" \
      --arg result_path "$result_path" \
      --arg change_fingerprint "$fingerprint" \
      --arg git_head "$git_head" \
      '{
        cycle_id: $cycle,
        result_path: $result_path,
        status: .status,
        error: .error,
        classification: .classification,
        passed: .passed,
        gateA_passed: .gateA_passed,
        gateB_passed: .gateB_passed,
        menu_cleared_while_not_ready: .menu_cleared_while_not_ready,
        world_ready_drop_count: .world_ready_drop_count,
        viewport_zero: .viewport_zero,
        moved: .moved,
        verdict: $verdict,
        change_fingerprint: $change_fingerprint,
        git_head: $git_head
      }')"
  else
    history_line="$(jq -nc \
      --argjson cycle "$cycle_num" \
      --arg verdict "$verdict" \
      --arg result_path "$result_path" \
      --arg change_fingerprint "$fingerprint" \
      --arg git_head "$git_head" \
      '{
        cycle_id: $cycle,
        result_path: $result_path,
        status: null,
        error: null,
        classification: null,
        passed: null,
        gateA_passed: null,
        gateB_passed: null,
        menu_cleared_while_not_ready: null,
        world_ready_drop_count: null,
        viewport_zero: null,
        moved: null,
        verdict: $verdict,
        change_fingerprint: $change_fingerprint,
        git_head: $git_head
      }')"
  fi

  # Append — never overwrite
  echo "$history_line" >> "$HISTORY_FILE"
}
```

**Step 2: Verify syntax**

Run:
```bash
bash -n scripts/ralph.sh
```
Expected: No errors.

**Step 3: Commit**

```bash
git add scripts/ralph.sh
git commit -m "feat: ralph append-only history.jsonl writer"
```

---

### Task 3: Add delta classifier (N vs N-1)

**Files:**
- Modify: `scripts/ralph.sh`

**Step 1: Add `classify_delta` function after `append_history`**

```bash
# ── Delta classifier (N vs N-1) ──
classify_delta() {
  local cycle_num="$1" verdict="$2" extracted="$3"

  # First cycle — no comparison possible
  if (( cycle_num <= 1 )) || [[ ! -f "$HISTORY_FILE" ]]; then
    echo "first_cycle"
    return
  fi

  # Read previous cycle's history line (second-to-last line, since current was just appended)
  local prev_line line_count
  line_count="$(wc -l < "$HISTORY_FILE" | tr -d ' ')"
  if (( line_count < 2 )); then
    echo "first_cycle"
    return
  fi
  prev_line="$(tail -2 "$HISTORY_FILE" | head -1)"

  local prev_verdict prev_error prev_drops prev_menu_clear
  prev_verdict="$(echo "$prev_line" | jq -r '.verdict')"
  prev_error="$(echo "$prev_line" | jq -r '.error | tostring')"
  prev_drops="$(echo "$prev_line" | jq -r '.world_ready_drop_count | tostring')"
  prev_menu_clear="$(echo "$prev_line" | jq -r '.menu_cleared_while_not_ready | tostring')"

  local curr_drops curr_menu_clear
  if [[ -n "$extracted" ]]; then
    curr_drops="$(echo "$extracted" | jq -r '.world_ready_drop_count | tostring')"
    curr_menu_clear="$(echo "$extracted" | jq -r '.menu_cleared_while_not_ready | tostring')"
  else
    curr_drops="null"
    curr_menu_clear="null"
  fi

  # Either side invalid → limited comparison
  if [[ "$verdict" == "INVALID_RUN" && "$prev_verdict" == "INVALID_RUN" ]]; then
    local curr_error
    if [[ -n "$extracted" ]]; then
      curr_error="$(echo "$extracted" | jq -r '.error | tostring')"
    else
      curr_error="null"
    fi
    if [[ "$curr_error" != "$prev_error" ]]; then
      echo "regressed"
      return
    fi
    echo "unchanged"
    return
  fi

  # PASS → FAIL/INVALID = regressed
  if [[ "$prev_verdict" == "PASS" && "$verdict" != "PASS" ]]; then
    echo "regressed"
    return
  fi

  # FAIL/INVALID → PASS = improved
  if [[ "$prev_verdict" != "PASS" && "$verdict" == "PASS" ]]; then
    echo "improved"
    return
  fi

  # Both PASS
  if [[ "$prev_verdict" == "PASS" && "$verdict" == "PASS" ]]; then
    echo "unchanged"
    return
  fi

  # Both non-PASS: check minor signals
  # New premature menu clear = regressed_minor
  if [[ "$prev_menu_clear" == "false" && "$curr_menu_clear" == "true" ]]; then
    echo "regressed_minor"
    return
  fi

  # Higher drops = regressed_minor
  if [[ "$prev_drops" != "null" && "$curr_drops" != "null" ]]; then
    if (( curr_drops > prev_drops )); then
      echo "regressed_minor"
      return
    fi
    if (( curr_drops < prev_drops )); then
      echo "improved_minor"
      return
    fi
  fi

  echo "unchanged"
}
```

**Step 2: Verify syntax**

Run:
```bash
bash -n scripts/ralph.sh
```
Expected: No errors.

**Step 3: Commit**

```bash
git add scripts/ralph.sh
git commit -m "feat: ralph delta classifier (N vs N-1)"
```

---

### Task 4: Wire artifacts + history + delta into run_one_cycle and print_verdict

This is the integration task. It modifies `run_one_cycle` to call the new functions and extends the verdict block with DELTA and CHANGE lines.

**Files:**
- Modify: `scripts/ralph.sh`

**Step 1: Refactor print_verdict to return extracted and verdict via globals instead of printing NEXT/sep**

The current `print_verdict` both determines the verdict AND prints the block. We need to split this so `run_one_cycle` can:
1. Get the verdict + extracted data
2. Call `save_cycle_artifacts` and `append_history`
3. Call `classify_delta`
4. Print the full block including DELTA and CHANGE

Replace the entire `print_verdict` function with `extract_verdict` that sets globals and returns, plus `print_verdict_block` that does the printing:

```bash
# extract_verdict sets: _VERDICT, _EXTRACTED, _F_* field globals
# Returns 0 on valid extraction, 1 on INVALID_RUN (still sets _VERDICT)
extract_verdict() {
  local result_path="$1"

  _VERDICT="INVALID_RUN"
  _EXTRACTED=""

  if [[ ! -f "$result_path" ]]; then
    _VERDICT_REASON="Test run produced no result.json"
    return 1
  fi

  local extracted
  extracted="$(jq -e "$JQ_EXTRACT" "$result_path" 2>/dev/null)" || {
    _VERDICT_REASON="Result JSON missing required fields"
    return 1
  }
  _EXTRACTED="$extracted"

  # Read individual fields
  _F_ERROR="$(echo "$extracted" | jq -r '.error | tostring')"
  _F_STATUS="$(echo "$extracted" | jq -r '.status | tostring')"
  _F_PASSED="$(echo "$extracted" | jq -r '.passed | tostring')"
  _F_GATEA="$(echo "$extracted" | jq -r '.gateA_passed | tostring')"
  _F_GATEB="$(echo "$extracted" | jq -r '.gateB_passed | tostring')"
  _F_CLASS="$(echo "$extracted" | jq -r '.classification | tostring')"
  _F_MENU_CLEAR="$(echo "$extracted" | jq -r '.menu_cleared_while_not_ready | tostring')"
  _F_WR_DROPS="$(echo "$extracted" | jq -r '.world_ready_drop_count | tostring')"
  _F_VP_ZERO="$(echo "$extracted" | jq -r '.viewport_zero | tostring')"
  _F_MOVED="$(echo "$extracted" | jq -r '.moved | tostring')"

  # Null check
  for field in "$_F_STATUS" "$_F_PASSED" "$_F_GATEA" "$_F_GATEB" "$_F_CLASS" "$_F_MENU_CLEAR" "$_F_WR_DROPS" "$_F_VP_ZERO" "$_F_MOVED"; do
    if [[ "$field" == "null" ]]; then
      _VERDICT_REASON="Result has null required fields"
      return 1
    fi
  done

  # Classification unknown
  if [[ "$_F_CLASS" == "unknown" ]]; then
    _VERDICT_REASON="Classification unknown — runner could not determine state"
    return 1
  fi

  # Consistency check
  if [[ "$_F_PASSED" == "true" ]]; then
    if [[ "$_F_STATUS" != "valid" || "$_F_ERROR" != "null" ]]; then
      _VERDICT_REASON="Schema contradiction — passed=true but status=$_F_STATUS, error=$_F_ERROR"
      return 1
    fi
    _VERDICT="PASS"
  else
    _VERDICT="FAIL"
  fi

  return 0
}

print_verdict_block() {
  local result_path="$1" delta="$2" shortstat="$3" fingerprint="$4"
  local sep="══════════════════════════════════════════"

  echo "$sep"
  if [[ "$_VERDICT" == "INVALID_RUN" ]]; then
    echo "CLAIM: $_VERDICT_REASON"
    echo "EVIDENCE: $result_path"
    if [[ -n "$_EXTRACTED" ]]; then
      echo "  (raw): $(echo "$_EXTRACTED" | jq -c .)"
    fi
  else
    echo "CLAIM: Skin test run completed"
    echo "EVIDENCE: $result_path"
    printf "  %-35s %s\n" "error:" "$_F_ERROR"
    printf "  %-35s %s\n" "status:" "$_F_STATUS"
    printf "  %-35s %s\n" "classification:" "$_F_CLASS"
    printf "  %-35s %s\n" "gateA.passed:" "$_F_GATEA"
    printf "  %-35s %s\n" "gateB.passed:" "$_F_GATEB"
    printf "  %-35s %s\n" "passed:" "$_F_PASSED"
    printf "  %-35s %s\n" "menu_cleared_while_not_ready:" "$_F_MENU_CLEAR"
    printf "  %-35s %s\n" "world_ready_drop_count:" "$_F_WR_DROPS"
    printf "  %-35s %s\n" "viewport_zero:" "$_F_VP_ZERO"
    printf "  %-35s %s\n" "moved:" "$_F_MOVED"
  fi
  echo "VERDICT: $_VERDICT"
  echo "DELTA: $delta"
  echo "CHANGE: ${shortstat:-no changes} | fingerprint=${fingerprint:0:8}"
  echo "NEXT: watching for changes..."
  echo "$sep"
}
```

**Step 2: Rewrite `run_one_cycle` to use the new functions**

Replace the entire `run_one_cycle` function:

```bash
run_one_cycle() {
  local cycle_num="$1"
  local cycle_start
  cycle_start="$(date +%s)"
  echo ""
  echo "── Cycle #$cycle_num ── $(date +%H:%M:%S) ──"

  # Sync bootstrap before every run
  sync_bootstrap

  # Run the test, capture RESULT_PATH from stdout
  local test_output result_path
  test_output="$(node "$REPO_ROOT/scripts/workbench_png_to_skin_test_playwright.mjs" \
    --png "$PNG" \
    --headed \
    --url "$URL" \
    --timeout-sec "$TIMEOUT_SEC" \
    --move-sec "$MOVE_SEC" \
    --override-mode "$OVERRIDE_MODE" \
    --reload-mode "$RELOAD_MODE" 2>&1)" || true

  # Extract RESULT_PATH — no fallback to avoid stale-result false-pass
  result_path="$(echo "$test_output" | grep '^RESULT_PATH=' | tail -1 | cut -d= -f2-)"

  if [[ -z "$result_path" ]]; then
    result_path="/dev/null"
  fi

  # Staleness guard (skip for /dev/null)
  if [[ "$result_path" != "/dev/null" ]]; then
    local result_mtime
    result_mtime="$(stat -f %m "$result_path" 2>/dev/null || echo 0)"
    if (( result_mtime < cycle_start )); then
      _VERDICT="INVALID_RUN"
      _VERDICT_REASON="result.json is stale (mtime=$result_mtime, cycle_start=$cycle_start)"
      _EXTRACTED=""

      save_cycle_artifacts "$cycle_num" "$cycle_start" "$result_path" "$_VERDICT" "$_EXTRACTED"
      append_history "$cycle_num" "$result_path" "$_VERDICT" "$_EXTRACTED" "$_FINGERPRINT" "$_GIT_HEAD"
      local delta
      delta="$(classify_delta "$cycle_num" "$_VERDICT" "$_EXTRACTED")"
      print_verdict_block "$result_path" "$delta" "$_SHORTSTAT" "$_FINGERPRINT"
      return
    fi
  fi

  # Extract verdict
  extract_verdict "$result_path" || true

  # Save artifacts and append history
  save_cycle_artifacts "$cycle_num" "$cycle_start" "$result_path" "$_VERDICT" "$_EXTRACTED"
  append_history "$cycle_num" "$result_path" "$_VERDICT" "$_EXTRACTED" "$_FINGERPRINT" "$_GIT_HEAD"

  # Classify delta
  local delta
  delta="$(classify_delta "$cycle_num" "$_VERDICT" "$_EXTRACTED")"

  # Print verdict block with delta and change info
  print_verdict_block "$result_path" "$delta" "$_SHORTSTAT" "$_FINGERPRINT"
}
```

**Step 3: Update initial run and watch loop**

The call sites remain the same (they already use `|| true`):

```bash
# ── Initial run ──
CYCLE=0
CYCLE=$((CYCLE + 1))
run_one_cycle "$CYCLE" || true

# ── Watch loop ──
echo ""
echo "Watching for changes..."
fswatch -o --latency 1 "${WATCHED_FILES[@]}" |
while read -r _; do
  CYCLE=$((CYCLE + 1))
  run_one_cycle "$CYCLE" || true
  echo ""
  echo "Watching for changes..."
done
```

Note: the fswatch call now uses `"${WATCHED_FILES[@]}"` instead of hardcoded paths.

**Step 4: Verify syntax**

Run:
```bash
bash -n scripts/ralph.sh
```
Expected: No errors.

**Step 5: Commit**

```bash
git add scripts/ralph.sh
git commit -m "feat: wire ralph artifacts + history + delta into run_one_cycle"
```

---

### Task 5: Integration test — two cycles with artifact verification

**Files:** (none — verification only)

**Step 1: Ensure output/ralph/ is clean**

Run:
```bash
rm -rf output/ralph
```

**Step 2: Run ralph with a real PNG (server must be running)**

Run:
```bash
./scripts/ralph.sh <png-path>
```

Wait for Cycle #1 to complete. Expected output includes:
```
VERDICT: FAIL (or INVALID_RUN)
DELTA: first_cycle
CHANGE: <shortstat or no changes> | fingerprint=<8chars>
```

**Step 3: Verify cycle 1 artifacts**

Run:
```bash
ls output/ralph/cycle-*/
cat output/ralph/cycle-*/meta.json | jq .
cat output/ralph/cycle-*/verdict.json | jq .
wc -l output/ralph/history.jsonl
```
Expected:
- One cycle directory with: result.json, verdict.json, changes.patch, changes.stat, meta.json
- meta.json has cycle=1, valid timestamps, git_head
- verdict.json has all fields + verdict
- history.jsonl has exactly 1 line

**Step 4: Touch a watched file to trigger cycle 2**

Run (in another terminal):
```bash
touch web/workbench.js
```

Wait for Cycle #2. Expected output includes:
```
VERDICT: ...
DELTA: unchanged (or regressed/improved if verdict changed)
CHANGE: no changes | fingerprint=no_chang
```

**Step 5: Verify cycle 2 artifacts and history**

Run:
```bash
ls output/ralph/
wc -l output/ralph/history.jsonl
tail -1 output/ralph/history.jsonl | jq .
```
Expected:
- Two cycle directories
- history.jsonl has exactly 2 lines
- Second line has change_fingerprint="no_change" (since touch doesn't modify content)

**Step 6: Verify anti-evasion: history was appended, not overwritten**

Run:
```bash
head -1 output/ralph/history.jsonl | jq .cycle_id
tail -1 output/ralph/history.jsonl | jq .cycle_id
```
Expected: `1` then `2` — both lines preserved.

**Step 7: Ctrl-C to exit, verify clean shutdown**

**Step 8: Commit**

```bash
git add scripts/ralph.sh
git commit -m "chore: ralph regression tracker integration verified"
```
