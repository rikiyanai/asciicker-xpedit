#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/xp_fidelity_test/run.sh <xp_file> [--headed] [--url <url>]" >&2
  exit 1
fi

XP_PATH="$1"
shift || true

OUT_ROOT="output/xp-fidelity-test"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${OUT_ROOT}/run-${STAMP}"
mkdir -p "${OUT_DIR}"

TRUTH_JSON="${OUT_DIR}/truth-table.json"
RECIPE_JSON="${OUT_DIR}/recipe.json"

python3 scripts/xp_fidelity_test/truth_table.py "${XP_PATH}" --output "${TRUTH_JSON}"
python3 scripts/xp_fidelity_test/recipe_generator.py --truth-table "${TRUTH_JSON}" --output "${RECIPE_JSON}"
node scripts/xp_fidelity_test/run_fidelity_test.mjs --xp "${XP_PATH}" --truth-table "${TRUTH_JSON}" --recipe "${RECIPE_JSON}" "$@"
