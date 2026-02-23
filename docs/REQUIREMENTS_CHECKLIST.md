# Pipeline V2 Requirements Checklist

This checklist is the single truth source for release readiness.

Claim policy:
- Never use `complete`, `completed`, `fixed`, `resolved`, or `done` in status claims.
- Allowed verdict vocabulary only:
  - `THRESHOLD_MET`
  - `THRESHOLD_BREACHED`
  - `HUMAN_REVIEW_REQUIRED`
  - `BLOCKED`

Status line template:
- `VERDICT=<THRESHOLD_MET|THRESHOLD_BREACHED|HUMAN_REVIEW_REQUIRED|BLOCKED> evidence=<path1,path2,...> notes=<short text>`

---

## 1) Scope Guardrails

- [ ] Work is performed in `asciicker-pipeline-v2` only.
- [ ] Legacy repo (`asciicker-Y9-2`) is used as read-only reference.
- [ ] Real sheets are sourced from `data/imported/smalltestpngs/`.
- [ ] No synthetic-only verification is accepted for release confidence.

---

## 2) Input Contract (Required)

- [ ] `POST /api/upload` accepts PNG and returns stable `upload_id` + `path`.
- [ ] `POST /api/analyze` returns explicit geometry candidates:
  - [ ] `suggested_angles`
  - [ ] `suggested_frames`
  - [ ] `suggested_cell_w`
  - [ ] `suggested_cell_h`
- [ ] `POST /api/run` requires explicit:
  - [ ] `name`
  - [ ] `source_path`
  - [ ] `angles`
  - [ ] `frames` (CSV/list)
  - [ ] `source_projs`
  - [ ] `render_resolution`
- [ ] Invalid or ambiguous geometry returns structured error (`400/422`) with `code` and `stage`.
- [ ] Fail-closed on impossible geometry (no silent fallback).

---

## 3) Output Contract (Required)

- [ ] Run returns:
  - [ ] `job_id`
  - [ ] `xp_path`
  - [ ] `preview_paths[]`
  - [ ] `gate_report_path`
  - [ ] `trace_path`
- [ ] `POST /api/workbench/load-from-job` creates populated session:
  - [ ] `job_id`
  - [ ] `angles`
  - [ ] `anims`
  - [ ] `projs`
  - [ ] `cell_w`
  - [ ] `cell_h`
  - [ ] `populated > 0`
- [ ] `POST /api/workbench/export-xp` returns:
  - [ ] `xp_path`
  - [ ] `checksum`
  - [ ] export metadata summary
- [ ] Export endpoint blocks contract violations with machine-readable details.

---

## 4) Geometry + Slicing Integrity

- [ ] Row/column slicing aligns to sprite boundaries for standard sheets.
- [ ] Metadata aligns with extracted cell grid:
  - [ ] `angles * sum(anims) * projs == total_cells`
  - [ ] Workbench grid dimensions match exported XP dimensions.
- [ ] No frame duplication drift unless explicitly configured.
- [ ] No hidden recenter/repad that changes per-frame alignment unexpectedly.
- [ ] Thin-feature sprites (limbs, weapon tips) are retained above configured threshold.

---

## 5) Workbench MVP Requirements

- [ ] Upload-first flow works without wizard dependency.
- [ ] Grid is editable before export.
- [ ] Required editing controls:
  - [ ] Select one or multiple cells
  - [ ] Delete action from center-grid context menu
  - [ ] Undo works for every mutating action
  - [ ] Redo works for every mutating action
  - [ ] Reorder rows
  - [ ] Reorder columns
  - [ ] Reassign row animation category
  - [ ] Assign selected frame group to an animation sequence
  - [ ] Draw box on source panel
  - [ ] Find-sprites honors drawn bbox as size anchor (similar-size filtering)
- [ ] Export uses current edited grid state, not stale pre-edit state.
- [ ] Workbench shows session geometry currently in effect.
- [ ] XP preview panel shows converted XP immediately after PNG upload.
- [ ] XP tool view is integrated into workbench workflow (no blind export-only path).

---

## 5A) Workbench Control Inventory (Non-Negotiable)

Every release candidate must publish a control inventory with:
- [ ] control id/text
- [ ] location (wizard/workbench/source-panel/grid-panel/right-panel)
- [ ] expected behavior
- [ ] observed behavior
- [ ] verdict (`THRESHOLD_MET` or `THRESHOLD_BREACHED`)
- [ ] evidence screenshot path

Minimum controls that must exist and operate:
- [ ] `Load From Job`
- [ ] `Export XP`
- [ ] `Undo`
- [ ] `Redo`
- [ ] `Delete` (grid context menu)
- [ ] `Row Reorder`
- [ ] `Column Reorder`
- [ ] `Draw Box`
- [ ] `Find Sprites`
- [ ] `Assign Animation Category`
- [ ] `Assign Frame Group`
- [ ] `XP Preview`

---

## 6) Visual Quality Gates

- [ ] G7 generated and recorded.
- [ ] G8 generated and recorded.
- [ ] G9 generated and recorded.
- [ ] Gate verdicts recorded as `THRESHOLD_MET` / `THRESHOLD_BREACHED` only.
- [ ] Human visual review performed in XP tool for each release candidate.
- [ ] Human review note links exact artifact paths.

---

## 7) Evidence Bundle (Per Iteration)

- [ ] Input sprite path recorded.
- [ ] Run request payload recorded.
- [ ] Run response JSON recorded.
- [ ] Workbench screenshot after load recorded.
- [ ] XP tool screenshot after export recorded.
- [ ] Gate JSON files attached.
- [ ] Trace JSON attached.
- [ ] Verdict line uses allowed vocabulary only.
- [ ] Control inventory report attached (`controls_audit.json`).

Recommended directory shape:
- `output/evidence/<timestamp>/request.json`
- `output/evidence/<timestamp>/run_result.json`
- `output/evidence/<timestamp>/workbench.png`
- `output/evidence/<timestamp>/xp_tool.png`
- `output/evidence/<timestamp>/gates.json`
- `output/evidence/<timestamp>/trace.json`
- `output/evidence/<timestamp>/verdict.txt`

---

## 8) Real-Asset Iteration Rule

Each iteration must run on:
- [ ] 2 known-bad sheets
- [ ] 1 known-good sheet

Minimum for release candidate:
- [ ] 2 consecutive iterations where all required gates are `THRESHOLD_MET`
- [ ] plus human review for both iterations.

---

## 9) Mandatory Runbook Commands

Session start:
- [ ] `python3 scripts/conductor_tools.py status --auto-setup` (legacy repo if used)
- [ ] `python3 scripts/maintainer/install_hooks.py --verify` (legacy repo if used)
- [ ] `python3 scripts/maintainer/run_tests.py` (legacy repo if used)

V2 validation:
- [ ] `PYTHONPATH=src python3 -m pytest`
- [ ] Headed browser flow (`upload -> analyze -> run -> load-from-job -> export`)
- [ ] Open exported XP in XP tool for human review
- [ ] Simulated-user control audit (all workbench controls):
  - [ ] enumerate buttons/menus
  - [ ] exercise each mutating control
  - [ ] assert undo/redo invariants
  - [ ] save `controls_audit.json` + screenshots

---

## 10) Release Readiness Gate

A release candidate is eligible only when every required checkbox above is checked and evidence is linked.

Final line format:
- `RELEASE_VERDICT=<THRESHOLD_MET|THRESHOLD_BREACHED|HUMAN_REVIEW_REQUIRED|BLOCKED>`
- `EVIDENCE_ROOT=<path>`
- `HUMAN_SIGNOFF=<name/date or pending>`
