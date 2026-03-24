#!/usr/bin/env bash
# smoke_test.sh — verify a live asciicker-xpedit deployment
#
# Usage:
#   ./scripts/deploy/smoke_test.sh                              # defaults
#   ./scripts/deploy/smoke_test.sh https://rikiworld.com /xpedit
#   BASE_URL=http://127.0.0.1:5071 PREFIX="" ./scripts/deploy/smoke_test.sh
#
# Exit code 0 = all checks passed, non-zero = at least one failed.

set -euo pipefail

BASE_URL="${BASE_URL:-${1:-https://rikiworld.com}}"
PREFIX="${PREFIX:-${2:-/xpedit}}"
TIMEOUT="${CURL_TIMEOUT:-10}"

PASS=0
FAIL=0

check() {
    local label="$1"
    local url="$2"
    local expect="${3:-200}"
    local status

    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$url" 2>/dev/null) || status="000"

    if [ "$status" = "$expect" ]; then
        echo "  PASS  $label  ($url → $status)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  $label  ($url → $status, expected $expect)"
        FAIL=$((FAIL + 1))
    fi
}

echo "Smoke test: ${BASE_URL}${PREFIX}"
echo "---"

# Core health
check "healthz"          "${BASE_URL}${PREFIX}/healthz"

# Workbench HTML loads
check "workbench"        "${BASE_URL}${PREFIX}/workbench"

# API endpoint responds
check "templates-api"    "${BASE_URL}${PREFIX}/api/workbench/templates"

# Runtime static asset (index.html from the WASM payload)
check "runtime-index"    "${BASE_URL}${PREFIX}/termpp-web-flat/index.html"

# Stateful: upload a 1x1 PNG and verify the backend can process it
# Endpoint: POST /api/upload (returns upload_id, width, height, sha256)
# This proves Flask routing, Pillow image processing, and filesystem writes all work.
check_stateful() {
    local base="${BASE_URL}${PREFIX}"

    # Create a minimal valid 1x1 PNG via python (portable, avoids shell printf binary issues)
    local tmpfile
    tmpfile=$(mktemp /tmp/smoke-test-XXXXXX.png)
    python3 -c "
import struct, zlib
# Minimal 1x1 RGB PNG
sig = b'\\x89PNG\\r\\n\\x1a\\n'
def chunk(t, d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB',1,1,8,2,0,0,0))
raw = zlib.compress(b'\\x00\\xff\\x00\\x00')
idat = chunk(b'IDAT', raw)
iend = chunk(b'IEND', b'')
open('${tmpfile}','wb').write(sig+ihdr+idat+iend)
" 2>/dev/null

    if [ ! -s "$tmpfile" ]; then
        echo "  FAIL  stateful-upload  (could not generate test PNG)"
        FAIL=$((FAIL + 1))
        rm -f "$tmpfile"
        return
    fi

    # POST to /api/upload — expect 201 with upload_id in response
    local http_code body
    body=$(curl -s -w '\n%{http_code}' --max-time "$TIMEOUT" \
      -F "file=@${tmpfile};type=image/png" \
      "${base}/api/upload" 2>/dev/null) || body=""
    rm -f "$tmpfile"

    http_code=$(echo "$body" | tail -1)
    body=$(echo "$body" | sed '$d')

    if [ "$http_code" = "201" ] && echo "$body" | grep -q '"upload_id"'; then
        echo "  PASS  stateful-upload  (POST /api/upload → 201, upload_id present)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  stateful-upload  (HTTP ${http_code}, body: ${body:0:120})"
        FAIL=$((FAIL + 1))
    fi
}

check_stateful

echo "---"
echo "Results: ${PASS} passed, ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
