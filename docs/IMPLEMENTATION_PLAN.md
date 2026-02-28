# Implementation Plan (Greenfield)

## Phase A: Contracts and State

- Define strict request/response schema for all 6 endpoints.
- Define error schema and status code policy.
- Define run state machine and trace output.

Exit criteria:
- Contract tests exist for success and failure of each endpoint.

## Phase B: Core Pipeline

- Stage ingest: open PNG and validate.
- Stage analyze: heuristic grid proposal.
- Stage slice/process: deterministic glyph mapping.
- Stage assemble: write real `.xp` binary.
- Stage verify: render preview + write G7/G8/G9.

Exit criteria:
- `/api/run` always emits `xp_path`, preview, trace, gates.

## Phase C: Workbench

- Session bootstrap from completed job.
- Grid metadata and populated count invariant.
- Export roundtrip from in-memory session.

Exit criteria:
- `load-from-job` returns populated session.
- `export-xp` produces valid file + checksum.

## Phase D: UI

- Workbench page for upload/analyze/run/edit/export (primary UI).
- Legacy wizard page retained temporarily as deprecated fallback only.
- No deadlock UX: timeouts surface explicit error text.

Exit criteria:
- Manual golden flow completes in Workbench direct browser flow.

## Phase E: Reliability

- Add known-good + known-bad fixtures.
- Add regression tests for error contract.
- Add CI script entrypoints.

Exit criteria:
- Green tests and reproducible artifacts.
