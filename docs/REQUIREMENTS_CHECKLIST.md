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

### Classic Mode (single-family)

- [ ] Upload-first flow works without legacy wizard dependency.
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

### Bundle Mode (multi-family — Phase 2-4)

- [ ] Template selector allows choosing template set (idle-only vs full bundle).
- [ ] Bundle creation initializes per-action sessions with correct dims.
- [ ] Action tabs switch between idle/attack/death subsections.
- [ ] Source panel adapts canvas size to active action dims (126×80, 144×80, 110×88).
- [ ] Grid panel adapts cell geometry per action family (cell_w, cell_h, frames, projs).
- [ ] Per-action session state persists across tab switches (no data loss).
- [ ] All classic editing controls work per action (select, delete, reorder, undo/redo).
- [ ] Per-family export pipeline produces correctly-dimensioned XP per action.
- [ ] Per-family L0/L1 metadata builders match family contract (G12 patterns).
- [ ] Bundle export assembles all completed actions into multi-family override set.
- [ ] Bundle injection loads all families into WASM (not just `Load("player")`).
- [ ] Structural gates G10-G12 enforced at export and injection time.
- [ ] Override names follow AHSW ternary contract (25+16+24=65 files).

---

## 5A) Workbench Control Inventory (Non-Negotiable)

Every release candidate must publish a control inventory with:
- [ ] control id/text
- [ ] location (workbench/source-panel/grid-panel/right-panel; legacy wizard only if explicitly tested)
- [ ] expected behavior
- [ ] observed behavior
- [ ] verdict (`THRESHOLD_MET` or `THRESHOLD_BREACHED`)
- [ ] evidence screenshot path

### Classic Mode Controls (minimum)

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

### Bundle Mode Controls (Phase 2-4)

Template & Bundle Lifecycle:
- [ ] `Template Selector` — dropdown to pick template set (idle-only vs full bundle)
- [ ] `Create Bundle` — creates bundle session from selected template
- [ ] `Action Tabs` (idle/attack/death) — switch between family subsections
- [ ] `Action Tab Status` — shows ✓/○ per action (converted vs empty)

Per-Action Source Panel:
- [ ] `Source Canvas` adapts dims per action (126×80 idle, 144×80 attack, 110×88 death)
- [ ] `Upload Source` per action tab — accepts PNG matching action spec dims
- [ ] `Draw Box` works at action-specific cell dims (7×10, 9×10, 11×11)
- [ ] `Find Sprites` respects action cell_w × cell_h for bbox anchor

Per-Action Grid Panel:
- [ ] `Grid Panel` adapts geometry per action (cell_w, cell_h, angles, frames, projs)
- [ ] `Grid Panel` renders correct column count: `sum(frames) × projs` per action
- [ ] All classic grid controls work per action (select, delete, reorder, undo/redo)

Bundle Export & Injection:
- [ ] `Export Bundle` — exports all completed actions as multi-family XP set
- [ ] `Test This Skin` (bundle mode) — injects all completed actions into WASM
- [ ] `Test This Skin` validates required actions converted before injection

### Validation Controls (MCP-verifiable, no browser needed)

- [ ] `G10` — XP dims match template spec per action
- [ ] `G11` — layer count matches template spec per action
- [ ] `G12` — L0 row-0 metadata glyphs match family pattern
- [ ] Override name contract: 25 player + 16 attack + 24 plydie = 65 total
- [ ] AHSW naming regex: `[01]{3}[012]` per family file
- [ ] Bundle payload: per-action XP bytes + correct target filenames

---

## 5B) MCP-Based API Validation (replaces Playwright watchdog)

The 47-gate Playwright watchdog is replaced by direct API validation via MCP
server. API contract checks don't need a browser; visual/WASM rendering is
confirmed manually.

MCP-verifiable contracts:
- [ ] `get_templates` returns registry with enabled_families = ["player","attack","plydie"]
- [ ] `create_bundle` returns bundle_id with empty action states per enabled family
- [ ] `apply_action_grid` runs pipeline and returns job result for each action
- [ ] `validate_override_names` confirms 25 player + 16 attack + 24 plydie = 65
- [ ] `validate_structural_gates` confirms G10/G11/G12 PASS for each completed action
- [ ] `inspect_payload` shows per-action XP bytes, correct target filenames, checksums
- [ ] `check_runtime_preflight` confirms all runtime files present and valid

Manual-only checks (visual/WASM):
- [ ] Sprite renders correctly in game viewport after injection
- [ ] Animation playback (idle walk cycle, attack swing, death fall) looks correct
- [ ] No visual artifacts (wrong colors, missing frames, broken angles)
- [ ] Attack trigger fires and renders attack sprite correctly

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
