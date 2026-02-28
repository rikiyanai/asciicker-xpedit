#!/usr/bin/env bash
set -euo pipefail

# ── Ralph Loop: Red-Green-Refactor watch for skin testing ──

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Env-overridable defaults
URL="${RALPH_URL:-http://127.0.0.1:5071/workbench}"
OVERRIDE_MODE="${RALPH_OVERRIDE_MODE:-mounted}"
RELOAD_MODE="${RALPH_RELOAD_MODE:-src_swap}"
TIMEOUT_SEC="${RALPH_TIMEOUT_SEC:-90}"
MOVE_SEC="${RALPH_MOVE_SEC:-2}"

# Source and runtime bootstrap paths
SRC_BOOTSTRAP="$REPO_ROOT/web/termpp_flat_map_bootstrap.js"
RT_BOOTSTRAP="$REPO_ROOT/runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js"

# Artifact output
RALPH_OUT="$REPO_ROOT/output/ralph"
HISTORY_FILE="$RALPH_OUT/history.jsonl"

# Files watched — also used for changes.patch scope
WATCHED_FILES=(
  "$REPO_ROOT/web/termpp_flat_map_bootstrap.js"
  "$REPO_ROOT/web/workbench.js"
  "$REPO_ROOT/web/workbench.html"
)

# ── Arg parsing ──
PNG="${1:-}"
if [[ -z "$PNG" ]]; then
  echo "Usage: ralph.sh <png-path>"
  echo "  Watches web/termpp_flat_map_bootstrap.js, web/workbench.js, web/workbench.html"
  echo "  On change: syncs bootstrap, runs headed skin test, prints verdict."
  exit 1
fi

# Resolve to absolute path
PNG="$(cd "$(dirname "$PNG")" && pwd)/$(basename "$PNG")"

# ── Preflight gates ──
preflight_fail() { echo "PREFLIGHT FAIL: $1"; exit 1; }

# 1. fswatch available?
command -v fswatch >/dev/null 2>&1 || preflight_fail "fswatch not found. Install: brew install fswatch"

# 2. jq available?
command -v jq >/dev/null 2>&1 || preflight_fail "jq not found. Install: brew install jq"

# 3. PNG exists?
[[ -f "$PNG" ]] || preflight_fail "PNG not found: $PNG"

# 4. Server reachable?
curl -sf "$URL" -o /dev/null || preflight_fail "Server not reachable at $URL"

# 5. Bootstrap in sync? (auto-fix with warning)
sync_bootstrap() {
  if ! diff -q "$SRC_BOOTSTRAP" "$RT_BOOTSTRAP" >/dev/null 2>&1; then
    echo "SYNC: web/ bootstrap → runtime/ (files differed)"
    cp "$SRC_BOOTSTRAP" "$RT_BOOTSTRAP"
  fi
}
sync_bootstrap

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

# ── Verdict extraction ──
# Required jq fields — if any is null/missing, the run is INVALID_RUN.
JQ_EXTRACT='{
  error: .error,
  status: .runValidity.status,
  passed: .runValidity.passed,
  gateA_passed: .runValidity.gateA.passed,
  gateB_passed: .runValidity.gateB.passed,
  classification: .firstMoveDiagnostic.classification,
  menu_cleared_while_not_ready: .firstMoveDiagnostic.menu_cleared_while_not_ready,
  world_ready_drop_count: .firstMoveDiagnostic.world_ready_drop_count,
  viewport_zero: .firstMoveDiagnostic.viewport_zero,
  moved: .moveResult.moved
}'

print_verdict() {
  local result_path="$1"
  local sep="══════════════════════════════════════════"

  if [[ ! -f "$result_path" ]]; then
    echo "$sep"
    echo "CLAIM: Test run produced no result.json"
    echo "EVIDENCE: (none)"
    echo "VERDICT: INVALID_RUN"
    echo "NEXT: watching for changes..."
    echo "$sep"
    return 1
  fi

  # Extract all fields in one jq call
  local extracted
  extracted="$(jq -e "$JQ_EXTRACT" "$result_path" 2>/dev/null)" || {
    echo "$sep"
    echo "CLAIM: Result JSON missing required fields"
    echo "EVIDENCE: $result_path"
    echo "VERDICT: INVALID_RUN"
    echo "NEXT: watching for changes..."
    echo "$sep"
    return 1
  }

  # Read individual fields — use `tostring` not `//` to avoid jq treating false as null
  local f_error f_status f_passed f_gateA f_gateB f_class f_menu_clear f_wr_drops f_vp_zero f_moved
  f_error="$(echo "$extracted" | jq -r '.error | tostring')"
  f_status="$(echo "$extracted" | jq -r '.status | tostring')"
  f_passed="$(echo "$extracted" | jq -r '.passed | tostring')"
  f_gateA="$(echo "$extracted" | jq -r '.gateA_passed | tostring')"
  f_gateB="$(echo "$extracted" | jq -r '.gateB_passed | tostring')"
  f_class="$(echo "$extracted" | jq -r '.classification | tostring')"
  f_menu_clear="$(echo "$extracted" | jq -r '.menu_cleared_while_not_ready | tostring')"
  f_wr_drops="$(echo "$extracted" | jq -r '.world_ready_drop_count | tostring')"
  f_vp_zero="$(echo "$extracted" | jq -r '.viewport_zero | tostring')"
  f_moved="$(echo "$extracted" | jq -r '.moved | tostring')"

  # Check for null fields → INVALID_RUN
  for field in "$f_status" "$f_passed" "$f_gateA" "$f_gateB" "$f_class" "$f_menu_clear" "$f_wr_drops" "$f_vp_zero" "$f_moved"; do
    if [[ "$field" == "null" ]]; then
      echo "$sep"
      echo "CLAIM: Result has null required fields"
      echo "EVIDENCE: $result_path"
      echo "  (raw): $(echo "$extracted" | jq -c .)"
      echo "VERDICT: INVALID_RUN"
      echo "NEXT: watching for changes..."
      echo "$sep"
      return 1
    fi
  done

  # Determine verdict — PASS requires consistency: passed=true AND status=valid AND error=null AND known classification
  local verdict
  if [[ "$f_class" == "unknown" ]]; then
    echo "$sep"
    echo "CLAIM: Classification unknown — runner could not determine state"
    echo "EVIDENCE: $result_path"
    echo "  (raw): $(echo "$extracted" | jq -c .)"
    echo "VERDICT: INVALID_RUN"
    echo "NEXT: watching for changes..."
    echo "$sep"
    return 1
  fi
  if [[ "$f_passed" == "true" ]]; then
    if [[ "$f_status" != "valid" || "$f_error" != "null" ]]; then
      # Schema contradiction: passed=true but status/error disagree
      echo "$sep"
      echo "CLAIM: Schema contradiction — passed=true but status=$f_status, error=$f_error"
      echo "EVIDENCE: $result_path"
      echo "  (raw): $(echo "$extracted" | jq -c .)"
      echo "VERDICT: INVALID_RUN"
      echo "NEXT: watching for changes..."
      echo "$sep"
      return 1
    fi
    verdict="PASS"
  else
    verdict="FAIL"
  fi

  echo "$sep"
  echo "CLAIM: Skin test run completed"
  echo "EVIDENCE: $result_path"
  printf "  %-35s %s\n" "error:" "$f_error"
  printf "  %-35s %s\n" "status:" "$f_status"
  printf "  %-35s %s\n" "classification:" "$f_class"
  printf "  %-35s %s\n" "gateA.passed:" "$f_gateA"
  printf "  %-35s %s\n" "gateB.passed:" "$f_gateB"
  printf "  %-35s %s\n" "passed:" "$f_passed"
  printf "  %-35s %s\n" "menu_cleared_while_not_ready:" "$f_menu_clear"
  printf "  %-35s %s\n" "world_ready_drop_count:" "$f_wr_drops"
  printf "  %-35s %s\n" "viewport_zero:" "$f_vp_zero"
  printf "  %-35s %s\n" "moved:" "$f_moved"
  echo "VERDICT: $verdict"
  echo "NEXT: watching for changes..."
  echo "$sep"

  [[ "$verdict" == "PASS" ]]
}

echo "Ralph loop ready."
echo "  PNG:   $PNG"
echo "  URL:   $URL"
echo "  Mode:  $OVERRIDE_MODE / $RELOAD_MODE"
echo "  Watch: web/termpp_flat_map_bootstrap.js, web/workbench.js, web/workbench.html"
echo "  Press Ctrl-C to stop."
echo ""

# ── Run one test cycle ──
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

  # Extract RESULT_PATH from the test output — no fallback to avoid stale-result false-pass
  result_path="$(echo "$test_output" | grep '^RESULT_PATH=' | tail -1 | cut -d= -f2-)"

  if [[ -z "$result_path" ]]; then
    print_verdict "/dev/null" || true  # triggers "no result.json" verdict; don't exit on FAIL
    return
  fi

  # Guard: result.json must have been written during this cycle (mtime >= cycle start)
  local result_mtime
  result_mtime="$(stat -f %m "$result_path" 2>/dev/null || echo 0)"
  if (( result_mtime < cycle_start )); then
    local sep="══════════════════════════════════════════"
    echo "$sep"
    echo "CLAIM: result.json is stale (written before this cycle)"
    echo "EVIDENCE: $result_path (mtime=$result_mtime, cycle_start=$cycle_start)"
    echo "VERDICT: INVALID_RUN"
    echo "NEXT: watching for changes..."
    echo "$sep"
    return
  fi

  # || true: print_verdict returns non-zero on FAIL/INVALID — don't let set -e kill the loop
  print_verdict "$result_path" || true
}

# ── Initial run ──
CYCLE=0
CYCLE=$((CYCLE + 1))
run_one_cycle "$CYCLE" || true

# ── Watch loop ──
echo ""
echo "Watching for changes..."
fswatch -o --latency 1 \
  "$REPO_ROOT/web/termpp_flat_map_bootstrap.js" \
  "$REPO_ROOT/web/workbench.js" \
  "$REPO_ROOT/web/workbench.html" |
while read -r _; do
  CYCLE=$((CYCLE + 1))
  run_one_cycle "$CYCLE" || true
  echo ""
  echo "Watching for changes..."
done
