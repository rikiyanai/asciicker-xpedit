#!/usr/bin/env bash
# Edge-case workflow verifier — entry point.
#
# Part of the canonical XP fidelity verifier family (scripts/xp_fidelity_test/).
# Tests workflow state transitions and gating honesty.
# Does NOT replace full_recreation or bundle fidelity.
#
# Usage:
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh [--headed] [--url <url>] [--recipe <name>]
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe partial_bundle_gating --headed
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh --recipe action_tab_hydration
#   bash scripts/xp_fidelity_test/run_edge_workflow.sh  # runs all recipes
set -euo pipefail

OUT_ROOT="output/xp-fidelity-test"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${OUT_ROOT}/edge-workflow-${STAMP}"
mkdir -p "${OUT_DIR}"

echo "=== Edge-case workflow verifier ==="
echo "Output: ${OUT_DIR}"

node scripts/xp_fidelity_test/run_edge_workflow_test.mjs --out-dir "${OUT_DIR}" "$@"
