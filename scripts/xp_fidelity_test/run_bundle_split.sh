#!/usr/bin/env bash
# Split bundle authoring test — preloads idle+attack from exported XPs,
# replays only death, then runs skin dock.
#
# This variant avoids the ~2h full replay that outlives the Flask dev server.
# Preloaded actions are imported via the UI XP import path, then exported
# via the UI Export XP button (fully UI-driven, no API calls).
#
# Prerequisites: exported XP files from a previous passing run.
#
# Usage:
#   bash scripts/xp_fidelity_test/run_bundle_split.sh \
#     --idle-export <path> --attack-export <path> [--headed]
set -euo pipefail

IDLE_XP="sprites/player-0100.xp"
ATTACK_XP="sprites/attack-0001.xp"
DEATH_XP="sprites/plydie-0000.xp"
MODE="full_recreation"
IDLE_EXPORT=""
ATTACK_EXPORT=""

REMAINING_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --idle-xp)      IDLE_XP="$2"; shift 2 ;;
    --attack-xp)    ATTACK_XP="$2"; shift 2 ;;
    --death-xp)     DEATH_XP="$2"; shift 2 ;;
    --idle-export)   IDLE_EXPORT="$2"; shift 2 ;;
    --attack-export) ATTACK_EXPORT="$2"; shift 2 ;;
    --mode)          MODE="$2"; shift 2 ;;
    *)               REMAINING_ARGS+=("$1"); shift ;;
  esac
done

if [[ -z "${IDLE_EXPORT}" || -z "${ATTACK_EXPORT}" ]]; then
  echo "ERROR: --idle-export and --attack-export are required" >&2
  echo "These should be .xp files exported from a previous passing run." >&2
  exit 1
fi

for f in "${IDLE_EXPORT}" "${ATTACK_EXPORT}"; do
  if [[ ! -f "${f}" ]]; then
    echo "ERROR: export file not found: ${f}" >&2
    exit 1
  fi
done

OUT_ROOT="output/xp-fidelity-test"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${OUT_ROOT}/bundle-split-${STAMP}"
mkdir -p "${OUT_DIR}"

for action_info in "idle:${IDLE_XP}" "attack:${ATTACK_XP}" "death:${DEATH_XP}"; do
  action="${action_info%%:*}"
  xp="${action_info#*:}"
  echo "=== ${action}: truth table + recipe from ${xp} ==="
  python3 scripts/xp_fidelity_test/truth_table.py "${xp}" \
    --output "${OUT_DIR}/${action}-truth-table.json"
  python3 scripts/xp_fidelity_test/recipe_generator.py \
    --truth-table "${OUT_DIR}/${action}-truth-table.json" \
    --output "${OUT_DIR}/${action}-recipe.json" \
    --mode "${MODE}"
done

echo "=== Running split bundle fidelity test (preload idle+attack, replay death) ==="
runner_args=(
  --idle-truth "${OUT_DIR}/idle-truth-table.json"
  --idle-recipe "${OUT_DIR}/idle-recipe.json"
  --attack-truth "${OUT_DIR}/attack-truth-table.json"
  --attack-recipe "${OUT_DIR}/attack-recipe.json"
  --death-truth "${OUT_DIR}/death-truth-table.json"
  --death-recipe "${OUT_DIR}/death-recipe.json"
  --out-dir "${OUT_DIR}"
  --preload-idle "${IDLE_EXPORT}"
  --preload-attack "${ATTACK_EXPORT}"
)
if ((${#REMAINING_ARGS[@]})); then
  runner_args+=("${REMAINING_ARGS[@]}")
fi
node scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs "${runner_args[@]}"
