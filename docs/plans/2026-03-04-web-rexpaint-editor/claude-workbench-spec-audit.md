# Workbench Spec Audit — Complete Feature Index

**Date:** 2026-03-04
**Source Documents:**
- `docs/REQUIREMENTS_CHECKLIST.md` (RC)
- `docs/IMPLEMENTATION_PLAN.md` (IP)
- `docs/MVP_REQUIREMENTS_STATUS.md` (MVP)
- `docs/WORKBENCH_SOURCE_PANEL_UX_CHECKLIST.md` (UX)
- `docs/WORKBENCH_REGRESSIONS_TRACKER.md` (REG)
- `docs/REXPAINT_MCP_HANDOFF.md` (MCP)
- `docs/REXPAINT_MANUAL.txt` (RPM)

---

## WORKFLOW 1: Sprite Sheet Conversion Pipeline (PNG Upload -> XP)

### A. Feature Spec

| # | Feature | Status | Source |
|---|---------|--------|--------|
| P1 | `POST /api/upload` accepts PNG, returns upload_id + path | IMPLEMENTED | RC s2, MVP A |
| P2 | `POST /api/analyze` returns geometry candidates (angles, frames, cell_w, cell_h) | IMPLEMENTED | RC s2, MVP A |
| P3 | `POST /api/run` requires explicit name, source_path, angles, frames, source_projs, render_resolution | IMPLEMENTED | RC s2, MVP A |
| P4 | Invalid/ambiguous geometry returns structured error (400/422) with code and stage | IMPLEMENTED | RC s2, MVP A |
| P5 | Fail-closed on impossible geometry (no silent fallback) | IMPLEMENTED | RC s2, MVP A |
| P6 | Run returns job_id, xp_path, preview_paths[], gate_report_path, trace_path | IMPLEMENTED | RC s3, MVP A |
| P7 | Row/column slicing aligns to sprite boundaries | IMPLEMENTED | RC s4 |
| P8 | Metadata cell-count invariant: angles * sum(anims) * projs == total_cells | IMPLEMENTED | RC s4 |
| P9 | No frame duplication drift unless configured | IMPLEMENTED | RC s4 |
| P10 | No hidden recenter/repad that changes per-frame alignment | IMPLEMENTED | RC s4 |
| P11 | Thin-feature sprites retained above configured threshold | IMPLEMENTED | RC s4 |
| P12 | Analyze->Run compatibility on real-sheet edge cases (39/39 sweep) | IMPLEMENTED | MVP A |
| P13 | Stage ingest: open PNG and validate | IMPLEMENTED | IP Phase B |
| P14 | Stage analyze: heuristic grid proposal | IMPLEMENTED | IP Phase B |
| P15 | Stage slice/process: deterministic glyph mapping | IMPLEMENTED | IP Phase B |
| P16 | Stage assemble: write real .xp binary | IMPLEMENTED | IP Phase B |
| P17 | Stage verify: render preview + write G7/G8/G9 gates | IMPLEMENTED | IP Phase B |

### B. Requirement Mapping

| Feature | Primary Doc | Section |
|---------|-------------|---------|
| Upload/Analyze/Run endpoints | RC | s2 "Input Contract" |
| Run output artifacts | RC | s3 "Output Contract" |
| Geometry integrity | RC | s4 "Geometry + Slicing Integrity" |
| Pipeline stages | IP | Phase B "Core Pipeline" |
| Evidence of implementation | MVP | Section A "Contract and Flow MVP" |

### C. Gap Analysis

- **Specified but not built:** None identified -- all pipeline features show THRESHOLD_MET in MVP status doc.
- **Built but not specified:** The MCP-based pipeline tools (`upload_png`, `run_pipeline`, `get_job_status`) in the workbench MCP server extend pipeline access beyond the HTTP API. These are operational but not formally specified in RC.
- **Risk:** `FL-034` visual conversion fidelity for known-bad sheets still listed as open blocker in MVP s.D.

### D. Broken Features

| Issue | Severity | Source |
|-------|----------|--------|
| FL-034: Visual conversion fidelity for known real-sheet failures | HIGH (release blocker) | MVP s.D |

---

## WORKFLOW 2: Direct XP Editing (Cell Inspector/Editor)

### A. Feature Spec

| # | Feature | Status | Source |
|---|---------|--------|--------|
| E1 | Grid is editable before export | IMPLEMENTED | RC s5 classic |
| E2 | Select one or multiple cells | IMPLEMENTED | RC s5 classic, MVP B |
| E3 | Delete action from center-grid context menu | IMPLEMENTED | RC s5 classic, MVP B |
| E4 | Undo works for every mutating action | IMPLEMENTED | RC s5 classic, MVP B |
| E5 | Redo works for every mutating action | IMPLEMENTED | RC s5 classic, MVP B |
| E6 | Reorder rows | IMPLEMENTED | RC s5 classic, MVP B |
| E7 | Reorder columns | IMPLEMENTED | RC s5 classic, MVP B |
| E8 | Reassign row animation category | IMPLEMENTED | RC s5 classic, MVP B |
| E9 | Assign selected frame group to animation sequence | IMPLEMENTED | RC s5 classic, MVP B |
| E10 | Draw box on source panel | IMPLEMENTED | RC s5 classic, MVP B |
| E11 | Find-sprites honors drawn bbox as size anchor | IMPLEMENTED | RC s5 classic, MVP B |
| E12 | Export uses current edited grid state | IMPLEMENTED | RC s5 classic |
| E13 | Workbench shows session geometry currently in effect | IMPLEMENTED | RC s5 classic |
| E14 | XP preview panel shows converted XP immediately after PNG upload | IMPLEMENTED | RC s5 classic, MVP B |
| E15 | XP tool view integrated into workbench workflow | IMPLEMENTED | RC s5 classic, MVP B |
| E16 | Load From Job | IMPLEMENTED | RC s5A, MVP B |
| E17 | Export XP | IMPLEMENTED | RC s5A, MVP B |
| E18 | Apply frame groups to anim metadata | IMPLEMENTED | MVP B |

**Source Panel UX Features (from UX checklist):**

| # | Feature | Status | Source |
|---|---------|--------|--------|
| U1 | Source boxes can be selected | IMPLEMENTED | UX s1 |
| U2 | Source boxes can be moved | IMPLEMENTED | UX s1 |
| U3 | Source boxes can be resized (handles/corners) | IMPLEMENTED | UX s1 |
| U4 | Source boxes can be deleted | IMPLEMENTED | UX s1 |
| U5 | Movement/resizing snaps to pixel boundaries | IMPLEMENTED | UX s1 |
| U6 | Arrow keys nudge selected box by 1px | IMPLEMENTED | UX s1 |
| U7 | Shift+arrows nudge by 10px | IMPLEMENTED | UX s1 |
| U8 | Committed sprite boxes cannot overlap | IMPLEMENTED | UX s1 |
| U9 | Orange=committed, Blue=draft, distinct selected state | IMPLEMENTED | UX s2 |
| U10 | Overlay legend/hint visible | IMPLEMENTED | UX s2 |
| U11 | Right-click draft box opens context menu | IMPLEMENTED | UX s3 |
| U12 | Context menu: "Add as 1 sprite" | IMPLEMENTED | UX s3 |
| U13 | Context menu: "Add to selected row sequence" | IMPLEMENTED | UX s3 |
| U14 | Context menu: "Delete draft" | IMPLEMENTED | UX s3 |
| U15 | Rapid multi-add workflow (draft/commit distinction) | IMPLEMENTED | UX s4 |
| U16 | Draft can be committed via context menu or Enter | IMPLEMENTED | UX s4 |
| U17 | Anchor box for Find Sprites | IMPLEMENTED | UX s5 |
| U18 | "Set as anchor for Find Sprites" context action | IMPLEMENTED | UX s5 |
| U19 | "Pad bbox to anchor size" context action | IMPLEMENTED | UX s5 |
| U20 | Minimum Size applies to auto-detection only, not manual add | IMPLEMENTED | UX s6 |
| U21 | Checkerboard background renders correctly | IMPLEMENTED | UX s7 |
| U22 | Semantic grid row labels (angle names) | IN_PROGRESS | UX s8 |
| U23 | Semantic grid column labels (frame numbers) | IN_PROGRESS | UX s8 |
| U24 | Cell labels/tooltips with angle+frame semantics | IN_PROGRESS | UX s8 |
| U25 | Drag Row mode in Source Panel | IMPLEMENTED | UX s9 |
| U26 | Source Panel instruction text updates per active mode | IMPLEMENTED | UX s9 |
| U27 | Row drag region overlay uses distinct styling | IMPLEMENTED | UX s9 |
| U28 | Row drag selects intersecting sprite boxes | IMPLEMENTED | UX s9 |
| U29 | Drag Column mode | NOT_STARTED | UX s9 (future) |
| U30 | Plain drag replaces selection | IMPLEMENTED | UX s10 |
| U31 | Intersects hit-test (not fully-contained) | IMPLEMENTED | UX s10 |
| U32 | Cmd/Ctrl+click toggles one box | IMPLEMENTED | UX s10 |
| U33 | Shift+drag adds to selection | IMPLEMENTED | UX s10 |
| U34 | Alt/Option+drag subtracts from selection | IMPLEMENTED | UX s10 |
| U35 | Vertical cut insertion mode | IN_PROGRESS | UX s11 |
| U36 | Cut lines visible, editable, movable | IN_PROGRESS | UX s11 |
| U37 | Cut lines can be deleted | IN_PROGRESS | UX s11 |
| U38 | Cut lines snap to pixel boundaries | IN_PROGRESS | UX s11 |
| U39 | Horizontal cut insertion mode | NOT_STARTED | UX s11 (deferred) |
| U40 | Manual source boxes append to sprite list | IMPLEMENTED | UX s12 |
| U41 | Manual source boxes append to selected row sequence | IMPLEMENTED | UX s12 |
| U42 | Source-to-grid drag/drop batch insertion | IMPLEMENTED | UX s12 |
| U43 | Source-panel mutating actions in undo/redo (draw, move, resize, delete, anchor, cuts) | IN_PROGRESS | UX s13 |
| U44 | Source annotations persist in saved session | IN_PROGRESS | UX s13 |
| U45 | BBox normalization: default preserves exact bbox | IMPLEMENTED | UX s14 |
| U46 | Overlay z-ordering consistent | IMPLEMENTED | UX s15 |
| U47 | Source panel status text reflects active mode | IMPLEMENTED | UX s15 |
| U48 | Mode badge visible | IMPLEMENTED | UX s15 |
| U49 | V = select/move/resize mode | IMPLEMENTED | UX s16 |
| U50 | B = draw box mode | IMPLEMENTED | UX s16 |
| U51 | R = drag row select mode | IMPLEMENTED | UX s16 |
| U52 | C = drag column select mode | NOT_STARTED | UX s16 (later) |
| U53 | X = vertical cut mode | IN_PROGRESS | UX s16 |
| U54 | Enter = commit draft box | IMPLEMENTED | UX s16 |
| U55 | Esc = cancel draft | IMPLEMENTED | UX s16 |
| U56 | Delete/Backspace = delete selected | IMPLEMENTED | UX s16 |
| U57 | Source panel zoom | DEFERRED | UX s17 |
| U58 | Source panel pan | DEFERRED | UX s17 |
| U59 | Selected box numeric readout (x,y,w,h) | DEFERRED | UX s17 |
| U60 | Frame jitter nudge controls | IMPLEMENTED | UX s20 |
| U61 | Alt+arrows nudges selected frame contents | IMPLEMENTED | UX s20 |
| U62 | Auto-align selected frames | IMPLEMENTED | UX s20 |
| U63 | Auto-align whole selected row | IMPLEMENTED | UX s20 |

**XP Editor Semantic Features (from REG tracker automated tests):**

| # | Feature | Status | Source |
|---|---------|--------|--------|
| X1 | Palette semantics | IMPLEMENTED | REG (workbench-xp-editor-semantic) |
| X2 | Glyph stamp | IMPLEMENTED | REG |
| X3 | Half-cell paint mutation | IMPLEMENTED | REG |
| X4 | Selection drag + copy/cut/paste | IMPLEMENTED | REG |
| X5 | Paste at remembered hover anchor | IMPLEMENTED | REG |
| X6 | Fill / clear selection | IMPLEMENTED | REG |
| X7 | Replace FG / replace BG | IMPLEMENTED | REG |
| X8 | Find & replace (selection + whole-frame scope) | IMPLEMENTED | REG |
| X9 | Selection transforms (rotate/flip) | IMPLEMENTED | REG |
| X10 | Frame actions (copy/paste/flip/clear) | IMPLEMENTED | REG |
| X11 | Shortcut semantics (Ctrl/Cmd+A, Delete) | IMPLEMENTED | REG |

### B. Requirement Mapping

| Feature Group | Primary Doc | Section |
|---------------|-------------|---------|
| Classic editing controls | RC | s5 "Workbench MVP" + s5A "Control Inventory" |
| Source panel UX | UX | s1-s20 |
| XP editor semantics | REG | "workbench-xp-editor-semantic" section |
| Implementation phases | IP | Phase C "Workbench" + Phase D "UI" |

### C. Gap Analysis

**Specified but not built:**
- Semantic grid labels (angle/frame names) -- IN_PROGRESS (UX s8)
- Cut-line insertion (vertical) -- IN_PROGRESS (UX s11)
- Column select/drag mode -- NOT_STARTED (UX s9, s16)
- Horizontal cut lines -- NOT_STARTED (UX s11)
- Source panel zoom/pan -- DEFERRED (UX s17)
- Selected box numeric readout -- DEFERRED (UX s17)
- Undo/redo for ALL source-panel mutations (some in progress) -- IN_PROGRESS (UX s13)
- Source annotation persistence in saved session -- IN_PROGRESS (UX s13)

**Built but not specified (from REG tracker regression list):**
- These features are reported as BROKEN/missing by user but not in original spec:
  - Grid multi-select drag in-row (REG item 2)
  - Grid add/remove cells (REG item 2)
  - Grid row select UI (REG item 2)
  - Grid panel zoom (REG item 2)
  - Direction labels at left of each row (REG item 2)
  - Legacy Char Grid collapsed by default (REG item 2)
  - Double-click char cell opens XP editor (REG item 2)
  - Grid green grid lines matching original XP tool (REG item 2)

### D. Broken Features (from Regressions Tracker)

| Issue | Severity | Source |
|-------|----------|--------|
| Analyze dead-end: changing Name/Angles/Frames sometimes doesn't recover from bad analyze state | MEDIUM | REG item 2 |
| Source->Grid drag flow hard/broken | HIGH | REG item 2 |
| Source and Grid panels need zoom | MEDIUM | REG item 2 |
| Missing context menu items vs earlier versions | MEDIUM | REG item 2 |
| Cannot add/remove cells in Grid Panel | MEDIUM | REG item 2 |
| Grid multi-select UX missing (drag in-row, right-click delete/copy, drag whole row) | HIGH | REG item 2 |
| Cannot select row in Grid Panel | HIGH | REG item 2 |
| "Add selected row as sequence" groups as single sprite | HIGH | REG item 2 |
| Direction labels needed at left of each row | LOW | REG item 2 |
| Panel layout regression (Animation+Metadata and XP Preview should be under Grid Panel) | MEDIUM | REG item 2 |
| "Can't paint with glyph" workflow confusion | MEDIUM | REG item 2 |
| Legacy char grid debug should be collapsed/absorbed | LOW | REG item 2 |
| Mixed/double skin visual after direction changes (mounted override scope) | HIGH | REG 2026-02-27T03:58Z |
| Freeze on water/world state transitions | HIGH | REG 2026-02-27T03:58Z |
| world_ready=0 after menu clear (freeze_world_never_ready) | HIGH | REG 2026-02-27T04:04Z |

**Automated failing checks (red baseline from requirements audit):**
- `drag_select_in_row` -- BROKEN
- `grid_add_control_present` -- BROKEN
- `grid_context_menu_has_copy` -- BROKEN
- `grid_row_select_ui_present` -- BROKEN
- `legacy_grid_dblclick_opens_xp_editor` -- BROKEN
- `grid_row_drag_reorder_ui_present` -- BROKEN
- `legacy_grid_collapsed_by_default` -- BROKEN
- `legacy_grid_absorbed_into_xp_tool_no_separate_panel` -- BROKEN
- `legacy_grid_green_grid_lines` -- BROKEN
- `source_panel_zoom_controls_present` -- BROKEN
- `grid_panel_zoom_controls_present` -- BROKEN
- `row_direction_labels_dedicated_present` -- BROKEN

---

## WORKFLOW 3: Skin Testing with Bundles (idle/attack/death -> WASM Preview)

### A. Feature Spec

| # | Feature | Status | Source |
|---|---------|--------|--------|
| B1 | Template selector: choose template set (idle-only vs full bundle) | IMPLEMENTED | RC s5 bundle |
| B2 | Bundle creation initializes per-action sessions with correct dims | IMPLEMENTED | RC s5 bundle |
| B3 | Action tabs switch between idle/attack/death | IMPLEMENTED | RC s5 bundle |
| B4 | Source panel adapts canvas size per action (126x80, 144x80, 110x88) | IMPLEMENTED | RC s5 bundle |
| B5 | Grid panel adapts cell geometry per action (cell_w, cell_h, frames, projs) | IMPLEMENTED | RC s5 bundle |
| B6 | Per-action session state persists across tab switches | IMPLEMENTED | RC s5 bundle |
| B7 | All classic editing controls work per action | IMPLEMENTED | RC s5 bundle |
| B8 | Per-family export produces correctly-dimensioned XP per action | IMPLEMENTED | RC s5 bundle |
| B9 | Per-family L0/L1 metadata builders match family contract (G12) | IMPLEMENTED | RC s5 bundle |
| B10 | Bundle export assembles all completed actions into multi-family override set | IMPLEMENTED | RC s5 bundle |
| B11 | Bundle injection loads all families into WASM | IMPLEMENTED | RC s5 bundle |
| B12 | Structural gates G10-G12 enforced at export and injection time | IMPLEMENTED | RC s5 bundle |
| B13 | Override names follow AHSW ternary contract (25+16+24=65 files) | IMPLEMENTED | RC s5 bundle |
| B14 | Template Selector dropdown | IMPLEMENTED | RC s5A bundle |
| B15 | Create Bundle button | IMPLEMENTED | RC s5A bundle |
| B16 | Action Tabs (idle/attack/death) | IMPLEMENTED | RC s5A bundle |
| B17 | Action Tab Status (checkmark/circle per action) | IMPLEMENTED | RC s5A bundle |
| B18 | Source Canvas adapts dims per action | IMPLEMENTED | RC s5A bundle |
| B19 | Upload Source per action tab | IMPLEMENTED | RC s5A bundle |
| B20 | Draw Box at action-specific cell dims | IMPLEMENTED | RC s5A bundle |
| B21 | Find Sprites respects action cell_w x cell_h | IMPLEMENTED | RC s5A bundle |
| B22 | Grid Panel adapts geometry per action | IMPLEMENTED | RC s5A bundle |
| B23 | Grid Panel renders correct column count per action | IMPLEMENTED | RC s5A bundle |
| B24 | All classic grid controls per action | IMPLEMENTED | RC s5A bundle |
| B25 | Export Bundle -- all completed actions as multi-family XP set | IMPLEMENTED | RC s5A bundle |
| B26 | Test This Skin (bundle mode) -- inject all completed actions into WASM | IMPLEMENTED | RC s5A bundle |
| B27 | Test This Skin validates required actions before injection | IMPLEMENTED | RC s5A bundle |

**MCP-Based Validation Features:**

| # | Feature | Status | Source |
|---|---------|--------|--------|
| M1 | get_templates returns registry with enabled_families | IMPLEMENTED | RC s5B |
| M2 | create_bundle returns bundle_id with empty action states | IMPLEMENTED | RC s5B |
| M3 | apply_action_grid runs pipeline per action | IMPLEMENTED | RC s5B |
| M4 | validate_override_names confirms 25+16+24=65 | IMPLEMENTED | RC s5B |
| M5 | validate_structural_gates confirms G10/G11/G12 PASS | IMPLEMENTED | RC s5B |
| M6 | inspect_payload shows per-action XP bytes + filenames | IMPLEMENTED | RC s5B |
| M7 | check_runtime_preflight confirms all runtime files | IMPLEMENTED | RC s5B |

**Visual Quality Gates:**

| # | Feature | Status | Source |
|---|---------|--------|--------|
| V1 | G7 generated and recorded | IMPLEMENTED | RC s6 |
| V2 | G8 generated and recorded | IMPLEMENTED | RC s6 |
| V3 | G9 generated and recorded | IMPLEMENTED | RC s6 |
| V4 | G10 -- XP dims match template spec | IMPLEMENTED | RC s5A validation |
| V5 | G11 -- layer count matches template spec | IMPLEMENTED | RC s5A validation |
| V6 | G12 -- L0 metadata glyphs match family pattern | IMPLEMENTED | RC s5A validation |
| V7 | Override name contract: AHSW naming regex [01]{3}[012] | IMPLEMENTED | RC s5A validation |
| V8 | Bundle payload: per-action XP bytes + correct target filenames | IMPLEMENTED | RC s5A validation |

**Manual-Only Checks (visual/WASM):**

| # | Feature | Status | Source |
|---|---------|--------|--------|
| W1 | Sprite renders correctly in game viewport after injection | NOT_VERIFIED | RC s5B manual |
| W2 | Animation playback looks correct (idle/attack/death) | NOT_VERIFIED | RC s5B manual |
| W3 | No visual artifacts (wrong colors, missing frames, broken angles) | NOT_VERIFIED | RC s5B manual |
| W4 | Attack trigger fires and renders attack sprite correctly | NOT_VERIFIED | RC s5B manual |

### B. Requirement Mapping

| Feature Group | Primary Doc | Section |
|---------------|-------------|---------|
| Bundle lifecycle | RC | s5 "Bundle Mode (multi-family)" |
| Bundle controls | RC | s5A "Bundle Mode Controls" |
| MCP validation | RC | s5B "MCP-Based API Validation" |
| Visual quality gates | RC | s6 "Visual Quality Gates" |
| Implementation | IP | Phase C + commit history (T7/T8 features) |

### C. Gap Analysis

**Specified but not built:**
- Manual visual verification of sprite rendering (W1-W4) -- requires human review, listed as NOT_VERIFIED
- Human signoff record for release -- HUMAN_REVIEW_REQUIRED (MVP C)
- Pos reporting regression still open (classification=unknown)

**Built but not specified:**
- The workbench MCP server tools (upload_png, run_pipeline, load_session, etc.) are built and functional but exist outside the formal RC checklist -- they are specified only in s5B as validation tools.
- Preboot XP injection mode is built (MEMORY.md) but not formally in RC checklist.

### D. Broken Features

| Issue | Severity | Source |
|-------|----------|--------|
| Pos reporting regression: pos=[None,None,None] on both maps -> classification=unknown -> INVALID_RUN | CRITICAL | MEMORY.md |
| Mixed/double skin visual when only subset of variant files overridden | HIGH | REG 2026-02-27 |
| world_ready=0 freeze classification | HIGH | REG 2026-02-27 |

---

## REXPAINT vs WORKBENCH: XP Editing Feature Comparison

### REXPaint Core Editing Features (from RPM)

| Category | REXPaint Feature | Workbench Has? | Notes |
|----------|-----------------|----------------|-------|
| **Drawing** | Cell mode (single cell paint) | YES | Glyph stamp, half-cell paint |
| | Line draw mode | NO | Not specified or built |
| | Rectangle draw mode (outline + filled) | NO | Not specified or built |
| | Oval draw mode (outline + filled) | NO | Not specified or built |
| | Fill (flood fill, 4-dir + 8-dir) | YES | Fill selection |
| | Text input mode | NO | Not specified or built |
| | Copy rectangular area | YES | Selection drag + copy |
| | Cut rectangular area | YES | Selection cut |
| | Paste clipboard | YES | Paste at hover anchor |
| | Paste flip (H/V/both) | PARTIAL | Selection transforms include rotate/flip |
| **Apply Modes** | Toggle glyph apply on/off | NO | Not specified |
| | Toggle foreground color apply on/off | NO | Not specified |
| | Toggle background color apply on/off | NO | Not specified |
| | Independent glyph/fg/bg channel editing | PARTIAL | Replace FG / Replace BG exist |
| **Preview** | Live preview on hover (cell/fill/paste) | NO | Not specified |
| **Undo** | Undo/Redo with per-image history | YES | History stack |
| **Fonts** | Glyph selector from font window | YES | Palette semantics |
| | Right-click to pick glyph+colors from canvas | NO | Not specified |
| | Toggle used glyph highlighting | NO | Not specified |
| | Glyph swapping (replace all occurrences) | NO | Not specified |
| | Custom/extended fonts | NO | Not relevant (fixed CP437) |
| | Font size scaling (zoom) | NO | Not specified |
| **Palette** | LMB=foreground, RMB=background color pick | PARTIAL | Palette exists |
| | HSV/RGB color picker | NO | Not specified |
| | Multiple palette files | NO | Not specified |
| | Palette organization (sort) | NO | Not specified |
| | Palette extraction from image | NO | Not specified |
| | Palette swapping (swap all occurrences) | NO | Not specified |
| | Transparency via bg 255,0,255 | YES | XP format convention |
| **Layers** | Create up to 9 layers | YES (via MCP) | xp-tool add_layer |
| | Active layer switching (1-9 keys) | NO | Not in browser UI |
| | Layer visibility toggle | NO | Not specified |
| | Layer locking | NO | Not specified |
| | Layer reorder | NO | Not specified |
| | Layer merge | NO | Not specified |
| | Extended Layers Mode | NO | REXPaint-specific |
| **Canvas** | Resize canvas | YES (via MCP) | resize_xp_file tool |
| | Drag/pan canvas (spacebar) | NO | DEFERRED (UX s17) |
| | Grid overlay toggle | NO | Not specified |
| | Font/zoom scaling | NO | Not specified |
| **Browsing** | Browse all images in directory | NO | Not applicable (session-based) |
| | Image rename/duplicate/delete | NO | Not applicable |
| **Find & Replace** | Find & replace (selection + whole-frame) | YES | Workbench has this |
| **Selection** | Selection transforms (rotate/flip) | YES | Implemented |
| **Export** | Export PNG | NO | Export is to .xp only |
| | Export TXT/CSV/XML/ANS/XPM/BBCode | NO | Not relevant |

### Delta: What a REXPaint Clone Needs That Workbench Doesn't Specify

The following are core REXPaint editing features that the workbench spec does NOT require:

1. **Shape drawing tools** -- Line, Rectangle (outline+filled), Oval (outline+filled): These are fundamental ASCII art tools. The workbench focuses on sprite grid management, not freeform art creation.

2. **Apply mode toggles (G/F/B)** -- Independent glyph/foreground/background channel application: REXPaint's most powerful feature for selective editing. Workbench has partial coverage via Replace FG/BG but lacks the toggle-on-draw paradigm.

3. **Text input mode** -- Direct typing onto canvas: Not specified in workbench. Workbench is grid/sprite-oriented, not text-art oriented.

4. **Live hover preview** -- Shows effect before clicking: A core usability feature of REXPaint not replicated.

5. **Right-click color/glyph pickup** -- Eyedropper from canvas: Not specified in workbench.

6. **HSV/RGB color picker** -- Full color picker dialog: Not specified.

7. **Layer management UI** -- Layer visibility, locking, reorder, merge: These exist in MCP tools but not in the browser workbench UI.

8. **Canvas pan (spacebar drag)** -- DEFERRED in workbench spec.

9. **Font/zoom scaling** -- DEFERRED in workbench spec (as source/grid panel zoom).

10. **Glyph swapping** -- Replace all occurrences of one glyph with another: Not specified.

11. **Multiple palette files** -- Workbench has one palette; REXPaint supports multiple.

12. **Grid overlay toggle** -- Visual grid lines on canvas: Mentioned in regressions (green grid lines) but not formally specified.

### Summary Assessment

The workbench is designed as a **sprite atlas management tool**, not a **general-purpose ASCII art editor**. It excels at:
- Sprite detection, slicing, and grid organization
- Animation sequence management
- Multi-family bundle assembly for game integration
- XP export with structural validation gates

It lacks REXPaint's **freeform art creation** capabilities (shape tools, text mode, channel-independent drawing, live preview). This is by design -- the workbench assumes sprites are created elsewhere (in REXPaint or via PNG conversion) and focuses on the assembly/testing pipeline.

---

## CROSS-CUTTING: Evidence & Release Requirements

| # | Feature | Status | Source |
|---|---------|--------|--------|
| R1 | Evidence bundle per iteration (input, request, response, screenshots, gates, trace) | IMPLEMENTED | RC s7 |
| R2 | Real-asset iteration rule (2 known-bad + 1 known-good) | IMPLEMENTED | RC s8 |
| R3 | 2 consecutive iterations all THRESHOLD_MET + human review | NOT_VERIFIED | RC s8 |
| R4 | Control inventory report (controls_audit.json) | IMPLEMENTED | RC s5A, MVP B |
| R5 | Unit/contract/workbench tests pass | IMPLEMENTED | MVP C |
| R6 | Browser E2E flow | IMPLEMENTED | MVP C |
| R7 | Human signoff | NOT_VERIFIED | MVP C |

---

## AGGREGATE COUNTS

### By Workflow

| Workflow | Total Specified | Implemented | In Progress | Not Started | Deferred | Broken/Failing |
|----------|----------------|-------------|-------------|-------------|----------|----------------|
| Pipeline (PNG->XP) | 17 | 17 | 0 | 0 | 0 | 1 (FL-034) |
| Editing (Classic) | 92 | 74 | 9 | 3 | 3 | 12 (automated red baseline) |
| Bundles (WASM) | 38 | 34 | 0 | 0 | 0 | 3 (runtime/injection) |
| Release/Evidence | 7 | 5 | 0 | 0 | 0 | 0 |
| **TOTAL** | **154** | **130** | **9** | **3** | **3** | **16** |

### Notes on Counts

- "Broken" count of 16 includes: 12 automated red-baseline failing checks from requirements audit + FL-034 + pos regression + mixed skin visual + world_ready freeze. Some overlap exists between "broken" and "not started" (e.g., grid zoom is both deferred/not-started AND failing in automated tests).
- The 12 automated failing checks from REG tracker are features that users expect but that were either never built or regressed. They are formally tracked as the "red baseline."
- DEFERRED items (3) are explicitly deferred by design decision, not forgotten.
- IN_PROGRESS items (9) are partially built: semantic labels, cut lines, undo/redo scope for source panel.
