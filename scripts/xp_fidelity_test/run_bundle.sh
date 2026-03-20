#!/usr/bin/env bash
# Bundle authoring acceptance test — entry point.
#
# Generates per-action truth tables and acceptance recipes from reference XPs,
# then runs the bundle fidelity test through the shipped workbench UI.
#
# Part of the canonical XP fidelity verifier family (scripts/xp_fidelity_test/).
#
# Usage:
#   bash scripts/xp_fidelity_test/run_bundle.sh [--headed] [--url <url>] [--mode acceptance|manual_review]
#   bash scripts/xp_fidelity_test/run_bundle.sh --idle-xp <xp> --attack-xp <xp> --death-xp <xp>
set -euo pipefail

IDLE_XP="sprites/player-0100.xp"
ATTACK_XP="sprites/attack-0001.xp"
DEATH_XP="sprites/plydie-0000.xp"
MODE="acceptance"

REMAINING_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --idle-xp)   IDLE_XP="$2"; shift 2 ;;
    --attack-xp) ATTACK_XP="$2"; shift 2 ;;
    --death-xp)  DEATH_XP="$2"; shift 2 ;;
    --mode)      MODE="$2"; shift 2 ;;
    *)           REMAINING_ARGS+=("$1"); shift ;;
  esac
done

OUT_ROOT="output/xp-fidelity-test"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${OUT_ROOT}/bundle-run-${STAMP}"
mkdir -p "${OUT_DIR}"

for action_info in "idle:${IDLE_XP}" "attack:${ATTACK_XP}" "death:${DEATH_XP}"; do
  action="${action_info%%:*}"
  xp="${action_info#*:}"
  echo "=== ${action}: truth table + acceptance recipe from ${xp} ==="
  python3 scripts/xp_fidelity_test/truth_table.py "${xp}" \
    --output "${OUT_DIR}/${action}-truth-table.json"
  python3 scripts/xp_fidelity_test/recipe_generator.py \
    --truth-table "${OUT_DIR}/${action}-truth-table.json" \
    --output "${OUT_DIR}/${action}-recipe.json" \
    --mode "${MODE}"
done

echo "=== Running bundle fidelity test ==="
runner_args=(
  --idle-truth "${OUT_DIR}/idle-truth-table.json"
  --idle-recipe "${OUT_DIR}/idle-recipe.json"
  --attack-truth "${OUT_DIR}/attack-truth-table.json"
  --attack-recipe "${OUT_DIR}/attack-recipe.json"
  --death-truth "${OUT_DIR}/death-truth-table.json"
  --death-recipe "${OUT_DIR}/death-recipe.json"
  --out-dir "${OUT_DIR}"
)
if ((${#REMAINING_ARGS[@]})); then
  runner_args+=("${REMAINING_ARGS[@]}")
fi
node scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs "${runner_args[@]}"
