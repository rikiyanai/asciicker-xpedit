#!/usr/bin/env bash
# scripts/doc_lifecycle_stitch.sh
#
# Retire a worksheet into the docs archive.
#
# Usage:
#   bash scripts/doc_lifecycle_stitch.sh <worksheet-path> [--reason <reason>]
#   bash scripts/doc_lifecycle_stitch.sh --help
#   bash scripts/doc_lifecycle_stitch.sh --list-candidates
#
# What it does:
#   1. Validates the worksheet exists and is not a protected doc
#   2. Generates a slug anchor from the filename
#   3. Appends a TOC entry to the archive
#   4. Appends the worksheet content to the archive
#   5. Rewrites references to the old path across repo *.md files
#   6. Appends a lifecycle note to PLAYWRIGHT_FAILURE_LOG.md
#   7. Deletes the original worksheet
#   8. Prints a summary of changes

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="$REPO_ROOT/docs/WORKBENCH_DOCS_ARCHIVE.md"
FAILURE_LOG="$REPO_ROOT/PLAYWRIGHT_FAILURE_LOG.md"

# Protected paths (relative to repo root) — stitch refuses to archive these
PROTECTED_PATHS=(
  "PLAYWRIGHT_FAILURE_LOG.md"
  "AGENTS.md"
  "CLAUDE.md"
  "CODEX.md"
  "docs/INDEX.md"
  "docs/AGENT_PROTOCOL.md"
  "docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md"
  "docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md"
  "docs/WORKBENCH_DOCS_ARCHIVE.md"
  "docs/plans/2026-03-23-workbench-canonical-spec.md"
  "docs/plans/2026-03-23-m2-capability-canon-inventory.md"
)

usage() {
  cat <<'EOF'
Usage:
  bash scripts/doc_lifecycle_stitch.sh <worksheet-path> [--reason <reason>]
  bash scripts/doc_lifecycle_stitch.sh --help
  bash scripts/doc_lifecycle_stitch.sh --list-candidates

Commands:
  <worksheet-path>    Retire the worksheet into docs/WORKBENCH_DOCS_ARCHIVE.md
  --help              Show this help
  --list-candidates   List .md files under docs/ that are not protected

Options:
  --reason <reason>   Reason for retirement (recorded in failure log)

What it does:
  1. Validates the worksheet exists and is not a protected doc
  2. Generates a slug anchor from the filename
  3. Appends a TOC entry to the archive
  4. Appends the worksheet content to the archive
  5. Rewrites references to the old path across repo *.md files
  6. Appends a lifecycle note to PLAYWRIGHT_FAILURE_LOG.md
  7. Deletes the original worksheet
  8. Prints a summary of changes

Protected docs (cannot be archived):
  PLAYWRIGHT_FAILURE_LOG.md
  AGENTS.md, CLAUDE.md, CODEX.md
  docs/INDEX.md, docs/AGENT_PROTOCOL.md
  docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md
  docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md
  docs/WORKBENCH_DOCS_ARCHIVE.md
  docs/plans/2026-03-23-workbench-canonical-spec.md
  docs/plans/2026-03-23-m2-capability-canon-inventory.md
EOF
  exit 0
}

is_protected() {
  local rel_path="$1"
  for p in "${PROTECTED_PATHS[@]}"; do
    if [[ "$rel_path" == "$p" ]]; then
      return 0
    fi
  done
  return 1
}

list_candidates() {
  echo "Worksheet candidates (not protected):"
  echo ""
  find "$REPO_ROOT/docs" -name '*.md' -type f | sort | while read -r f; do
    local rel
    rel="$(python3 -c "import os; print(os.path.relpath('$f', '$REPO_ROOT'))")"
    if ! is_protected "$rel"; then
      echo "  $rel"
    fi
  done
  # Also check root-level .md files that aren't protected
  find "$REPO_ROOT" -maxdepth 1 -name '*.md' -type f | sort | while read -r f; do
    local rel
    rel="$(python3 -c "import os; print(os.path.relpath('$f', '$REPO_ROOT'))")"
    if ! is_protected "$rel"; then
      echo "  $rel  (root-level)"
    fi
  done
}

make_slug() {
  # Convert filename to a lowercase slug anchor
  local name
  name="$(basename "$1" .md)"
  echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

stitch_worksheet() {
  local worksheet="$1"
  local reason="${2:-superseded}"

  # Resolve to absolute then relative-to-repo-root
  local abs_path
  abs_path="$(python3 -c "import os; print(os.path.abspath('$worksheet'))")"
  local rel_path
  rel_path="$(python3 -c "import os; print(os.path.relpath('$abs_path', '$REPO_ROOT'))")"
  # Guard: rel_path must not escape the repo (no leading ../)
  if [[ "$rel_path" == ../* ]]; then
    echo "ERROR: $worksheet resolves outside the repo: $rel_path" >&2
    exit 1
  fi

  # Validate existence
  if [[ ! -f "$abs_path" ]]; then
    echo "ERROR: File not found: $rel_path" >&2
    exit 1
  fi

  # Validate not protected
  if is_protected "$rel_path"; then
    echo "ERROR: $rel_path is a protected doc and cannot be archived." >&2
    exit 1
  fi

  # Validate it's a markdown file
  if [[ "$rel_path" != *.md ]]; then
    echo "ERROR: Only .md files can be archived. Got: $rel_path" >&2
    exit 1
  fi

  # Validate archive exists
  if [[ ! -f "$ARCHIVE" ]]; then
    echo "ERROR: Archive doc not found at $ARCHIVE" >&2
    exit 1
  fi

  local slug
  slug="$(make_slug "$rel_path")"
  local datestamp
  datestamp="$(date +%Y-%m-%d)"
  local title
  title="$(basename "$rel_path")"

  echo "Stitching: $rel_path → archive anchor: #$slug"

  # Step 1: Add TOC entry (before TOC:END marker)
  local toc_entry="- [$title](#$slug) — retired $datestamp ($reason)"
  sed -i '' "s|<!-- TOC:END -->|$toc_entry\n<!-- TOC:END -->|" "$ARCHIVE"

  # Step 2: Append worksheet content (before ARCHIVE:END marker)
  local archive_block
  archive_block=$(cat <<ARCHEOF

---

<a id="$slug"></a>

### $title

**Original path:** \`$rel_path\`
**Retired:** $datestamp
**Reason:** $reason

$(cat "$abs_path")

ARCHEOF
)
  # Use python to safely append before the ARCHIVE:END marker
  python3 -c "
import sys
archive_path = '$ARCHIVE'
marker = '<!-- ARCHIVE:END -->'
with open(archive_path, 'r') as f:
    content = f.read()
block = open('/dev/stdin', 'r').read()
if marker not in content:
    print('ERROR: ARCHIVE:END marker not found in archive', file=sys.stderr)
    sys.exit(1)
content = content.replace(marker, block + '\n' + marker)
with open(archive_path, 'w') as f:
    f.write(content)
" <<< "$archive_block"

  # Step 3: Rewrite references across repo .md files
  # References appear in two forms:
  #   relative: docs/some-file.md
  #   absolute: $REPO_ROOT/docs/some-file.md  (resolved at runtime)
  # Replace absolute paths first, then relative (abs contains rel as suffix).
  local ref_count=0
  local archive_ref="docs/WORKBENCH_DOCS_ARCHIVE.md#$slug"
  while IFS= read -r md_file; do
    local changed=false
    # Replace absolute paths first — abs_path contains rel_path as a suffix,
    # so replacing rel_path first would mangle absolute references.
    if grep -q "$abs_path" "$md_file" 2>/dev/null; then
      sed -i '' "s|$abs_path|$archive_ref|g" "$md_file"
      changed=true
    fi
    if grep -q "$rel_path" "$md_file" 2>/dev/null; then
      sed -i '' "s|$rel_path|$archive_ref|g" "$md_file"
      changed=true
    fi
    if $changed; then
      ref_count=$((ref_count + 1))
    fi
  done < <(find "$REPO_ROOT" -name '*.md' -type f ! -path "$abs_path" ! -path "$ARCHIVE")

  # Step 4: Append lifecycle note to failure log
  cat >> "$FAILURE_LOG" <<LOGEOF

---

## Doc Lifecycle: Worksheet Retired

**Date:** $datestamp
**Worksheet:** \`$rel_path\`
**Archive anchor:** \`$archive_ref\`
**Reason:** $reason
**References rewritten:** $ref_count file(s)
**Script:** \`scripts/doc_lifecycle_stitch.sh\`

LOGEOF

  # Step 5: Delete the original
  rm "$abs_path"

  # Summary
  echo ""
  echo "Done."
  echo "  Archived:    $rel_path → docs/WORKBENCH_DOCS_ARCHIVE.md#$slug"
  echo "  Refs updated: $ref_count file(s)"
  echo "  Logged to:   PLAYWRIGHT_FAILURE_LOG.md"
  echo "  Original:    deleted"
  echo ""
  echo "Next: review with 'git diff' and commit if satisfied."
}

# --- Main ---

if [[ $# -eq 0 ]]; then
  usage
fi

case "$1" in
  --help|-h)
    usage
    ;;
  --list-candidates)
    list_candidates
    exit 0
    ;;
  *)
    WORKSHEET="$1"
    shift
    REASON="superseded"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --reason)
          REASON="$2"
          shift 2
          ;;
        *)
          echo "ERROR: Unknown option: $1" >&2
          exit 1
          ;;
      esac
    done
    stitch_worksheet "$WORKSHEET" "$REASON"
    ;;
esac
