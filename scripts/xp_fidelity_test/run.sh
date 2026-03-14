#!/usr/bin/env bash
# scripts/xp_fidelity_test/run.sh
#
# XP Fidelity Test — full pipeline (single-frame, upload-xp sessions)
#
# Usage:
#   scripts/xp_fidelity_test/run.sh <xp_file> [--headed] [--url <url>]
#
# The XP is uploaded via /api/workbench/upload-xp, which creates a session
# with geometry 1,1,1 (entire grid = 1 frame). The recipe generator assumes
# this geometry — global coords = frame-local coords. Multi-frame sessions
# are out of scope for this harness version.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
XP_FILE="${1:?Usage: $0 <xp_file> [--headed] [--url <url>]}"
shift

URL="http://127.0.0.1:5071/workbench"
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

TS=$(date +%Y%m%dT%H%M%S)
TRUTH="/tmp/xp-fidelity-truth-${TS}.json"
RECIPE="/tmp/xp-fidelity-recipe-${TS}.json"

echo "=== XP Fidelity Test — User-Action Conformance ==="
echo "Source:   ${XP_FILE}"
echo "Geometry: 1,1,1 (upload-xp single-frame)"
echo ""

# Phase 1: Truth table (oracle)
echo "[1/3] Extracting truth table..."
python3 "${SCRIPT_DIR}/truth_table.py" "${XP_FILE}" --output "${TRUTH}"

# Phase 2: Recipe (single-frame)
echo "[2/3] Generating UI action recipe..."
python3 "${SCRIPT_DIR}/recipe_generator.py" \
  --truth-table "${TRUTH}" \
  --output "${RECIPE}"

# Phase 3: Execute + Verify
echo "[3/3] Executing in browser (user-action only)..."
node "${SCRIPT_DIR}/run_fidelity_test.mjs" \
  --truth-table "${TRUTH}" \
  --recipe "${RECIPE}" \
  --xp "${XP_FILE}" \
  --url "${URL}" \
  "${EXTRA_ARGS[@]}"

EXIT=$?
rm -f "${TRUTH}" "${RECIPE}"
exit $EXIT
