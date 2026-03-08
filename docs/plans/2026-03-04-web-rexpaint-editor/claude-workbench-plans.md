# Workbench Plans & Architecture Research

## 1. Existing Plans and Roadmaps

### Implementation Plan (`docs/IMPLEMENTATION_PLAN.md`)
5-phase greenfield plan:
- **Phase A**: Contracts and State — request/response schemas for 6 endpoints
- **Phase B**: Core Pipeline — ingest, analyze, slice, assemble, verify stages
- **Phase C**: Workbench — session bootstrap, grid metadata, export roundtrip
- **Phase D**: UI — workbench page for upload/analyze/run/edit/export
- **Phase E**: Reliability — fixtures, regression tests, CI

### Requirements Checklist (`docs/REQUIREMENTS_CHECKLIST.md`)
10-section release readiness document. Key sections:
- Section 2: Input Contract (upload/analyze/run API)
- Section 3: Output Contract (job results, session, export)
- Section 4: Geometry + Slicing Integrity
- **Section 5**: Workbench MVP Requirements — split into:
  - **Classic Mode** (single-family): upload-first flow, grid editing, undo/redo, reorder, source panel draw box, find sprites
  - **Bundle Mode** (multi-family, Phase 2-4): template selector, action tabs (idle/attack/death), per-action dims, structural gates G10-G12, AHSW override naming (25+16+24=65 files)
- **Section 5A**: Control Inventory — exhaustive list of Classic and Bundle mode controls
- **Section 5B**: MCP-Based API Validation — 7 MCP-verifiable contracts replacing the 47-gate Playwright watchdog
- Sections 6-10: Visual quality gates, evidence bundles, real-asset iteration, runbook, release gate

### MVP Requirements Status (`docs/MVP_REQUIREMENTS_STATUS.md`)
Dated 2026-02-23. All Contract/Flow MVP items: `THRESHOLD_MET`. All Workbench Controls MVP items: `THRESHOLD_MET`.
**Release verdict: `THRESHOLD_BREACHED`** — blocked on visual conversion fidelity for known-bad real sheets (FL-034 open).

### Source Panel UX Checklist (`docs/WORKBENCH_SOURCE_PANEL_UX_CHECKLIST.md`)
20-item checklist for source panel UX. Most items marked `IMPLEMENTED`:
- Source box editing (move/resize/delete/nudge)
- Draft/commit workflow, context menu manual add
- Anchor box + Find Sprites integration
- Row/column drag modes, cut-line insertion
- Keyboard shortcuts (V/B/R/X modes)
- Frame jitter handling (nudge/auto-align)
- **Still IN_PROGRESS**: Semantic grid labels (#8), cut-line insertion (#11), undo/redo scope (#13)
- **DEFERRED**: Source panel zoom/pan, numeric bbox readout (#17)

### Regressions Tracker (`docs/WORKBENCH_REGRESSIONS_TRACKER.md`)
Open issues:
- Dock/map behavior intermittent failures
- Analyze dead-end recovery
- Source->Grid drag flow broken/hard
- Missing zoom controls
- Grid multi-select UX gaps (drag select, row select, row drag reorder)
- Layout regressions (panel ordering, legacy char grid)
- XP editor workflow confusion
- Mounted skin override issues (mixed/double skin visuals, freeze)

### REXPaint MCP Handoff (`docs/REXPAINT_MCP_HANDOFF.md`)
4-phase plan for REXPaint integration:
- Phase 1: Verify AppleScript automation (macOS accessibility permissions)
- Phase 2: Repeat process scripts (batch layer switching, quick export)
- Phase 3: Error handling improvements
- Phase 4: Agent training docs
- Lists 25+ MCP tools across core control, automation, XP analysis, file management, and direct editing categories

### Other Research Docs
- `docs/WORKBENCH_FLAT_ARENA_WATER_LOADING_RESEARCH_HANDOFF.md` — investigation of LOADING stall and underwater teleport bugs
- `docs/CLAUDE_RESEARCH_DUMP_WORKBENCH_MOVE_FREEZE_2026-02-27.md` — movement freeze research
- `docs/plans/2026-02-26-fix-skin-test-instance-bugs.md` — skin test bug fixes
- `docs/plans/2026-02-26-termpp-parity-fix-design.md` — term++ parity design
- `docs/plans/2026-02-27-ralph-loop-design.md` — ralph automated test loop

---

## 2. Families/Bundle System

### Family Definitions
Three enabled families (`src/pipeline_v2/config.py`):
- **player** — idle/walk sprites, dims 126x80, cell 7x10, 8 angles, frames [1,8], 2 projections, 4 layers
- **attack** — attack sprites, dims 144x80, cell 9x10, 8 angles, frames [8], 2 projections, 4 layers
- **plydie** — death sprites, dims 110x88, cell 11x11, 8 angles, frames [5], 2 projections, 3 layers

### AHSW Override Naming
Files follow `{family}-{A}{H}{S}{W}.xp` ternary naming convention:
- A = armor (0-1), H = hat (0-1), S = shield (0-1), W = weapon (0-2)
- Player: 25 files (all_16 range = all AHSW combos)
- Attack: 16 files (weapon_gte_1, W>=1 filter)
- Plydie: 24 files (all_16 range)
- Total: 65 override files per complete bundle

### Bundle Model
- Bundle is a container for multiple action sessions (idle/attack/death)
- Created from a template set via `create_bundle(template_set_key)`
- Each action within a bundle gets its own pipeline run with family-specific geometry
- Bundle export assembles all completed actions into a multi-family override set
- Structural gates G10-G12 validate each action at export time

### Native Layer Builders
Per-family native layer builders in `service.py`:
- `_build_native_player_layers()` — 4 layers for player
- `_build_native_attack_layers()` — 4 layers for attack (dynamic L0 from reference)
- `_build_native_plydie_layers()` — 3 layers for plydie (dynamic L0 from reference)
- L0 layer comes from reference XP files (checksummed in template_registry.json)
- L1 = height encoding, L2 = visual artwork, L3+ = swoosh overlays

---

## 3. Template System

### Template Registry (`config/template_registry.json`)
Two template sets:

**`player_native_idle_only`** — Single idle action:
- idle: player family, 126x80, 8 angles, [1,8] frames, 4 layers

**`player_native_full`** — Full 3-action bundle:
- idle: player family, 126x80, 8 angles, [1,8] frames, 4 layers (required)
- attack: attack family, 144x80, 8 angles, [8] frames, 4 layers (optional)
- death: plydie family, 110x88, 8 angles, [5] frames, 3 layers (optional)

Each action spec includes:
- `family`, `label`, `required` flag
- `xp_dims` [width, height], `angles`, `frames`, `projs`
- `cell_w`, `cell_h`, `layers`
- `ahsw_range` (override file generation strategy)
- `l0_ref` path and `l0_ref_sha256` checksum for L0 reference validation

### Structural Gates
- **G10**: XP dimensions match template spec per action
- **G11**: Layer count matches template spec per action
- **G12**: L0 row-0 metadata glyph sequence matches family pattern
  - Player L0 col0: `["8", "1", "8"]` (8 angles, 1 idle frame, 8 walk frames)
  - Attack L0 col0: `["8", "8"]` (8 angles, 8 frames)
  - Plydie L0 col0: `["8", "5"]` (8 angles, 5 frames)

---

## 4. API Endpoints

### Core Pipeline API (`docs/API_CONTRACT.md`)
- `POST /api/upload` — upload PNG, returns upload_id + source_path
- `POST /api/analyze` — geometry suggestions (angles, frames, cell dims)
- `POST /api/run` — run conversion pipeline, returns job_id + xp_path + previews
- `GET /api/status/<job_id>` — poll job status

### Workbench Session API
- `POST /api/workbench/load-from-job` — create session from completed job
- `POST /api/workbench/save-session` — persist edited session state
- `POST /api/workbench/export-xp` — export session as .xp file
- `GET /api/workbench/templates` — list template sets + enabled families

### Bundle API
- `POST /api/workbench/bundle/create` — create bundle from template_set_key
- `POST /api/workbench/bundle/<id>/action/<key>/run` — run pipeline for one action
- `POST /api/workbench/bundle/<id>/export` — export all actions as multi-family XP set
- `GET /api/workbench/bundle/<id>/payload` — get per-action XP bytes for WASM injection

### MCP Server Tools (`scripts/workbench_mcp_server.py`, 540 lines)
25 MCP tools wrapping the HTTP API:
- server_status, upload_png, run_pipeline, get_job_status
- load_session, save_session, export_xp, get_skin_payload
- get_templates, create_bundle, apply_action_grid
- get_bundle_payload, export_bundle
- check_runtime_preflight, validate_structural_gates, validate_override_names, inspect_payload

### XP Tool MCP Server (`scripts/xp_mcp_server.py`)
Low-level XP file editing tools:
- read_xp_info, create_xp_file, add_layer
- write_cell, fill_rect, read_layer_region
- set_metadata, replace_color, resize_xp_file
- write_ascii_block, write_text, shift_layer_content

---

## 5. Known Issues and TODOs

### Open Blockers
- **FL-034**: Visual conversion fidelity for known-bad real sheets — blocking release
- **Pos reporting regression**: Both native and pipeline XPs show pos=[None,None,None], causing classification=unknown

### Workbench UX Gaps (from regressions tracker)
- Grid multi-select: drag select in-row, right-click delete/copy, row drag reorder
- Source panel: missing zoom/pan controls
- Layout: Animation+Metadata and XP Preview should sit under Grid Panel
- Legacy Char Grid: should be collapsed by default, absorbed into XP tool
- Direction labels needed at left of each row
- XP editor: workflow unintuitive, "can't paint with glyph" confusion

### Source Panel Incomplete Items
- Semantic grid labels (IN_PROGRESS)
- Cut-line insertion (IN_PROGRESS)
- Full undo/redo scope for all source-panel mutations (IN_PROGRESS)
- Source panel zoom/pan (DEFERRED)

### Runtime/Injection Issues
- Mounted skin override shows mixed/double skin visuals when only subset overridden
- Movement freeze after skin injection (separate from skin payload issue)
- world_ready stuck at 0 in some runs
- Headless dock loads often non-playable (wasmReady=false)

### No TODOs/FIXMEs Found
- Zero TODO/FIXME/HACK comments in `web/workbench.js`, `web/` directory, or `src/pipeline_v2/` Python code
- Zero TODO/FIXME/HACK in `scripts/workbench_mcp_server.py`

---

## 6. Git Commit History (Recent 30)

Key feature commits (template/bundle system, chronological):
1. `43e33d2` feat: T1 — template registry, bundle model, RunConfig extension
2. `d429f3a` feat: T2 — per-action pipeline run with target dims + family dispatch
3. `20e5e0a` feat: T3 — attack/death family native builders + dispatcher
4. `d98aecf` feat: T5+T6 — template selector, action tabs, bundle injection UI
5. `67c3e39` feat: T7 — structural gates G10-G12 for bundle XP validation
6. `fdf5917` feat: T8 — bootstrap auto-attack trigger + Playwright bundle test mode
7. `d65575c` fix(workbench): phase-gate bundle UI actions via enabled_families
8. `8279e11` fix: AHSW ternary naming + enable plydie family + bundle override filter

Other notable commits:
- `359f217` merge: fix/solo-only-load-contract
- `a74c72e` fix: stabilize preboot injection flow
- `3b848c4` refactor: centralize native player skin contract
- `f1bd6a1` fix: enforce native 126x80 player skin contract

---

## 7. Architecture Summary

### Server Stack
- Flask app: `src/pipeline_v2/app.py`
- Business logic: `src/pipeline_v2/service.py` (2500+ lines)
- Models: `src/pipeline_v2/models.py`
- XP codec: `src/pipeline_v2/xp_codec.py`
- Config: `src/pipeline_v2/config.py` (ENABLED_FAMILIES, paths)
- Storage: `src/pipeline_v2/storage.py` (JSON persistence)

### Frontend
- `web/workbench.html` + `web/workbench.js` — primary workbench UI
- `web/termpp_flat_map_bootstrap.js` — WASM runtime bootstrap

### Data Directories
- `data/uploads/`, `data/jobs/`, `data/exports/`, `data/sessions/`, `data/bundles/`
- `config/template_registry.json` — template definitions
- `sprites/` — reference XP files for L0 validation
- `runtime/termpp-skin-lab-static/` — WASM runtime files

### MCP Integration
- `scripts/workbench_mcp_server.py` — HTTP API wrapper for Claude MCP
- `scripts/xp_mcp_server.py` — low-level XP file editing MCP
- `scripts/rex_mcp/` — REXPaint GUI automation MCP
- `.mcp.json` — MCP server configuration
