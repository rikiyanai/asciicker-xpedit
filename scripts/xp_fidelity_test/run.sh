#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/xp_fidelity_test/run.sh <xp_file> [--mode acceptance|diagnostic] [--headed] [--url <url>]" >&2
  exit 1
fi

XP_PATH="$1"
shift || true

# Extract --mode from remaining args (default: diagnostic)
MODE="diagnostic"
REMAINING_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      REMAINING_ARGS+=("--mode" "$2")
      shift 2
      ;;
    *)
      REMAINING_ARGS+=("$1")
      shift
      ;;
  esac
done

OUT_ROOT="output/xp-fidelity-test"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${OUT_ROOT}/run-${STAMP}"
mkdir -p "${OUT_DIR}"

TRUTH_JSON="${OUT_DIR}/truth-table.json"
RECIPE_JSON="${OUT_DIR}/recipe.json"

python3 scripts/xp_fidelity_test/truth_table.py "${XP_PATH}" --output "${TRUTH_JSON}"
python3 scripts/xp_fidelity_test/recipe_generator.py --truth-table "${TRUTH_JSON}" --output "${RECIPE_JSON}" --mode "${MODE}"
node scripts/xp_fidelity_test/run_fidelity_test.mjs --xp "${XP_PATH}" --truth-table "${TRUTH_JSON}" --recipe "${RECIPE_JSON}" "${REMAINING_ARGS[@]}"
