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

# Seed cycle counter from history (survives restarts)
if [[ -f "$HISTORY_FILE" ]] && [[ -s "$HISTORY_FILE" ]]; then
  _last_id="$(tail -1 "$HISTORY_FILE" | jq -r '.cycle_id // empty' 2>/dev/null)" || _last_id=""
  if [[ "$_last_id" =~ ^[0-9]+$ ]]; then
    CYCLE="$_last_id"
  else
    echo "WARNING: malformed last history line, seeding cycle_id=0" >&2
    CYCLE=0
  fi
else
  CYCLE=0
fi

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

# extract_verdict sets: _VERDICT, _EXTRACTED, _VERDICT_REASON, _F_* field globals
# Returns 0 on valid extraction, 1 on INVALID_RUN (still sets _VERDICT)
extract_verdict() {
  local result_path="$1"

  _VERDICT="INVALID_RUN"
  _EXTRACTED=""
  _VERDICT_REASON=""

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

echo "Ralph loop ready."
echo "  PNG:   $PNG"
echo "  URL:   $URL"
echo "  Mode:  $OVERRIDE_MODE / $RELOAD_MODE"
echo "  Watch: web/termpp_flat_map_bootstrap.js, web/workbench.js, web/workbench.html"
echo "  Press Ctrl-C to stop."
echo ""

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

# ── Initial run ──
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
