# Milestone 2 Bug & Gap Index (Base-Path Edition)

**Date:** 2026-03-23
**Branch:** `feat/base-path-support` at `1c4b99c`
**Method:** Parallel code audit of workbench.js, whole-sheet-init.js, workbench.html, pipeline_v2/, xp_fidelity_test/, ui_tests/, all M2 planning docs, contracts, and PLAYWRIGHT_FAILURE_LOG.md

---

## 1. Known Bug Index

### Product Bugs

| ID | Title | Scope | Severity | Status | Evidence |
|----|-------|-------|----------|--------|----------|
| PB-01 | Anchor set not undoable (context menu) | both | HIGH | OPEN | `workbench.js:6592` — `setAnchorFromTarget()` called without `pushHistory()` |
| PB-02 | Anchor set not undoable (setDraftBox implicit) | both | MEDIUM | OPEN | `workbench.js:4086` — `setDraftBox()` silently mutates `anchorBox` without undo |
| PB-03 | File upload clears anchor without undo | both | MEDIUM | OPEN | `workbench.js:6513` — `state.anchorBox = null` with no `pushHistory()` |
| PB-04 | 4 root-relative paths in workbench.html | base-path | ~~HIGH~~ N/A | STALE-DOC (not a bug) | `workbench.html:7,8,425,426` appear root-relative in raw HTML but are rewritten at serve time by `_serve_web_html()` in `app.py:79-99` — all 4 paths are prefixed with `BASE_PATH` + cache-bust nonce. Confirmed working under `/xpedit`. |
| PB-05 | OvalTool on disk but not wired | both | LOW | DEFERRED | `web/rexpaint-editor/tools/oval-tool.js` exists, not imported in `whole-sheet-init.js` |
| PB-06 | SelectTool on disk but not wired | both | MEDIUM | OPEN (M2-C.2) | `web/rexpaint-editor/tools/select-tool.js` exists, not imported |
| PB-07 | TextTool on disk but not wired | both | MEDIUM | OPEN (M2-C.4) | `web/rexpaint-editor/tools/text-tool.js` exists, not imported |
| PB-08 | BROWSE mode button disabled/placeholder | both | LOW | DEFERRED | `workbench.js:593-597` — `disabled=true`, title "Browse mode (deferred)" |
| PB-09 | New/Resize are stubs | both | LOW | DEFERRED | `workbench.js:794` — `_placeholder('New')`, Resize is comment-only |
| PB-10 | Missing runtime files block "Test This Skin" | both | ~~CRITICAL~~ | CLOSED (M1 closeout) | Runtime committed; EV-001 gating fix at `894ea9d`. PLAYWRIGHT_FAILURE_LOG M1 closeout. |
| PB-11 | Whole-sheet layout mismatches REXPaint spec | canonical master | ~~HIGH~~ | CLOSED (M1 closeout) | Resolved by edge-workflow strengthening; 7/7 recipes PASS. PLAYWRIGHT_FAILURE_LOG M1 closeout. |
| PB-12 | Cell fidelity misses in full_recreation Run 3 | canonical master | ~~HIGH~~ | NON-BLOCKING (M1 closeout) | Canvas-edge harness artifact, not product failure. Explicitly classified in PLAYWRIGHT_FAILURE_LOG:1313-1317. |
| PB-13 | Skin Dock stuck at renderStage=2 (menu advance) | both | ~~HIGH~~ | CLOSED (M1 closeout) | `b1faac3` accepts ready status in skin dock verifier. PLAYWRIGHT_FAILURE_LOG M1 closeout. |
| PB-14 | G7/G8/G9 gates exist but not called in export pipeline | both | MEDIUM | OPEN (decision needed) | `gates.py:10,19,32` — functions exist; `_run_structural_gates()` only calls G10/G11/G12 |

### Verifier Bugs / Gaps

| ID | Title | Scope | Severity | Status | Evidence |
|----|-------|-------|----------|--------|----------|
| VB-01 | `getState()` missing 9 P1 fields | both | ~~HIGH~~ | CLOSED (`f246828`) | All 9 P1 fields added: `bundleId`, `activeActionKey`, `templateSetKey`, `activeLayer`, `visibleLayers`, `layerCount`, `sessionDirty`, `gridCols`, `gridRows` |
| VB-02 | `getState()` missing 2 P2 fields | both | ~~MEDIUM~~ | CLOSED (`f246828`) | Both P2 fields added: `sourceCutsV`, `sourceCanvasZoom` |
| VB-03 | `_state()` leaks full mutable state by reference | both | MEDIUM | OPEN (design debt) | `workbench.js:7193` — returns raw `state` object, ~80+ fields, mutable |
| VB-04 | 0 of 5 M2 verifier slices implemented | both | HIGH | OPEN | Slices 1-5 designed in `2026-03-21-milestone-2-png-verifier-design.md`, none built |
| VB-05 | No shared verifier infrastructure extracted | both | HIGH | OPEN | `selectors.mjs`, `verifier_lib.mjs`, `action_registry.json`, `recipe_schema.json` all needed per design |
| VB-06 | `test_contracts.py` hardcoded to root "/" | base-path | ~~MEDIUM~~ | CLOSED (`7d3b186`) | `hosted_client` fixture parameterizes root + /xpedit; 80/80 pass |
| VB-07 | `test_workbench_flow.py` hardcoded to root "/" | base-path | ~~MEDIUM~~ | CLOSED (`7d3b186`) | `hosted_client` fixture parameterizes root + /xpedit |
| VB-08 | `test_analyze_run_compat.py` hardcoded to root "/" | base-path | ~~MEDIUM~~ | CLOSED (`7d3b186`) | `hosted_client` fixture parameterizes root + /xpedit |
| VB-09 | `full-workflow-with-game.spec.js` hardcoded URL | base-path | LOW | OPEN | Hardcoded `http://localhost:5071/workbench` |
| VB-10 | `all_black.png` fixture exists but no test references it | both | LOW | OPEN | `tests/fixtures/known_bad/all_black.png` — orphaned |
| VB-11 | 42 of 48 debug API functions unused by automated tests | both | INFO | OPEN (design gap) | Only `getState`, `frameSignature`, `readFrameCell`, `suppressAutoSave`, `suppressRender`, `flushSave` used |

### Debug API Gaps

| ID | Title | Scope | Severity | Status | Evidence |
|----|-------|-------|----------|--------|----------|
| DA-01 | No `getBugReportMetadata()` single-call full snapshot | both | LOW | OPEN | SAR blueprint recommends it; not implemented |
| DA-02 | 22 action primitives need Playwright gesture workarounds | both | MEDIUM | OPEN | No debug API method exists for these; SAR blueprint notes them |
| DA-03 | `getWholeSheetEditorState()` not used by any verifier | both | LOW | OPEN | Exists at `whole-sheet-init.js:1578` but 0 test consumers |

### Docs / Planning Gaps

| ID | Title | Severity | Status | Evidence |
|----|-------|----------|--------|----------|
| DP-01 | BASE_PATH_SUPPORT_CHECKLIST shows 0/8 items done | HIGH | STALE-DOC | Branch has `bp()` in JS + `_BP` in WS init; checklist predates these fixes |
| DP-02 | PNG_STRUCTURAL_BASELINE_CONTRACT claims "no automated test" | MEDIUM | STALE-DOC if test_contracts counts | `test_contracts.py:test_upload_contract` validates dims+sha256, but contract may mean full pipeline test |
| DP-03 | XP_EDITOR_ACCEPTANCE_CONTRACT M1 close requirements undated | LOW | STALE-DOC | M1 closed 2026-03-23 per PLAYWRIGHT_FAILURE_LOG closeout. Contract dates need refresh. |
| DP-04 | SAR blueprint cites 96 actions but verifier design only covers 50+ | MEDIUM | OPEN | Gap between SAR enumeration (comprehensive) and verifier DSL (partial) |
| DP-05 | Support artifacts referenced but not all created | MEDIUM | OPEN | `m2-png-fixture-inventory.md` exists; `semantic-edit-test-matrix.md` not verified |

### Deferred / Not-in-Scope

| ID | Title | Reason |
|----|-------|--------|
| DEF-01 | Source panel pan | Explicitly deferred in M2-D.4 |
| DEF-02 | Numeric bbox readout | Explicitly deferred in M2-D.5 |
| DEF-03 | OvalTool wiring | Lower priority per M2-C.3 |
| DEF-04 | BROWSE mode | Placeholder, no M2 requirement |
| DEF-05 | New/Resize stubs | No M2 requirement |
| DEF-06 | Perfect automatic slicing | Explicitly excluded from M2 acceptance |
| DEF-07 | Mount-family support | Explicitly excluded |
| DEF-08 | Full XP-editor parity | Explicitly excluded |
| DEF-09 | ~~`action_tab_hydration` step-5 failure~~ | CLOSED: resolved by 800ms settle + dual gate (`14e8e95`, `b3f2f06`). 7/7 edge-workflow PASS. |

---

## 2. Untested / Missing Coverage Index

### ZERO Coverage

| Area | What's Missing | Blocking Factor |
|------|---------------|-----------------|
| Source panel input modes | No test for file-browse, url-input, or drag-drop as source acquisition paths | No verifier capability exists |
| PNG structural edge cases | No tests for corrupt PNG, wrong color mode (palette/RGBA/grayscale), oversized, zero-dimension, non-PNG masquerading | No fixtures or negative-path tests |
| Source context-menu action outcomes | DOM element presence probed by coverage agent; NO functional verification of click → state change | VB-01 (getState gaps) blocks state assertion |
| Undo/redo state verification | Coverage agent probes buttons; no pre/post state comparison after undo/redo cycle | VB-01 blocks; PB-01/02/03 make anchor undo untestable |
| Multi-frame semantic operations | Copy frame, clone angle, reorder frames — no test | No verifier slice or agent covers this |

### Partial Coverage

| Area | What Exists | What's Missing |
|------|------------|----------------|
| Source-to-grid drag/drop | `WorkbenchSourceGridDragDropAgent` tests 1 drag | Multi-box drops, row-based drops, error cases |
| Grid editing post-insertion | `WorkbenchGridSelectionRequirementsAgent` tests selection ops | Cell-level edit verification, undo/redo, layer switching, inspector consistency |
| Semantic edit flows | `WorkbenchXpEditorSemanticAgent` exists | Glyph code mapping, animation metadata, multi-frame ops |
| Skin Dock error recovery | `WorkbenchSkinDockE2EAgent` tests happy path | Multiple skins, replacement without reload, error recovery |
| PNG structural baseline | `test_contracts.py` checks dims+sha256 for cat_sheet | Full pipeline gate test (G7-G12), family-specific fixtures, runtime smoke |
| Base-path route equivalence | `test_base_path.py` (39 tests) covers prefix routes | API contract tests (VB-06/07/08) still root-only |
| Whole-sheet tools | Fidelity verifier covers cell/line/rect/fill/erase/eyedropper | No coverage for unwired tools (select/oval/text), no undo per-stroke verification |

### Coverage by Verifier Lane

| Lane | Acceptance-Eligible? | Base-Path Aware? | Status |
|------|---------------------|------------------|--------|
| Single-XP fidelity (`run_fidelity_test.mjs`) | YES (acceptance mode) | Partial (--url configurable, no resolveRoute) | WORKING |
| Bundle fidelity (`run_bundle_fidelity_test.mjs`) | YES | Partial | WORKING |
| Edge workflow (`run_edge_workflow_test.mjs`) | YES | Partial | WORKING |
| ui_tests CLI (`cli.mjs`) | YES (orchestrates agents) | YES (resolveRoute + --base-url) | WORKING |
| Base-path tests (`test_base_path.py`) | YES | YES (dedicated) | WORKING |
| API contracts (`test_contracts.py`) | YES (but root-only) | NO | NEEDS UPDATE |
| Workbench flow (`test_workbench_flow.py`) | YES (but root-only) | NO | NEEDS UPDATE |
| Analyze compat (`test_analyze_run_compat.py`) | YES (but root-only) | NO | NEEDS UPDATE |
| Browser E2E (`test_browser_flow.py`) | YES (but root-only) | NO | NEEDS UPDATE |
| Playwright full workflow | Diagnostic-only | NO | NEEDS UPDATE |
| Web unit tests (21 files) | YES (component) | N/A (no routes) | WORKING |

---

## 3. Unfinished Action Inventory

Classification of all 96 user-reachable actions from SAR blueprint:

### Template/Bundle (T) — 8 actions

| ID | Action | Status |
|----|--------|--------|
| T1 | Apply template | implemented + covered (edge workflow tests) |
| T2 | Switch action tab | implemented + covered (bundle fidelity) |
| T3 | Save session | implemented + partially covered (save-first tested, dirty-state not) |
| T4 | Export XP | implemented + covered (fidelity + bundle tests) |
| T5 | New session | implemented + untested |
| T6 | Import XP | implemented + untested |
| T7 | Test skin | implemented + partially covered (skin dock agent, but PB-10 blocks) |
| T8 | Delete session | implemented + untested |

### Upload/Convert (U) — 3 actions

| ID | Action | Status |
|----|--------|--------|
| U1 | Upload PNG | implemented + covered (contract + flow tests) |
| U2 | Analyze PNG | implemented + covered (analyze compat tests) |
| U3 | Run pipeline | implemented + covered (contract + flow tests) |

### Source Panel (S) — 19 actions

| ID | Action | Status |
|----|--------|--------|
| S1 | Set source mode (draw) | implemented + untested |
| S2 | Set source mode (select) | implemented + untested |
| S3 | Draw box | implemented + partially covered (drag-drop agent draws 1 box) |
| S4 | Commit box | implemented + partially covered (drag-drop agent) |
| S5 | Select box | implemented + partially covered (drag-drop agent) |
| S6 | Move box | implemented + untested |
| S7 | Resize box | implemented + untested |
| S8 | Delete box | implemented + untested |
| S9 | Find sprites | implemented + untested |
| S10 | Row select mode | implemented + untested |
| S11 | Column select mode | implemented + untested |
| S12 | Pad to anchor | implemented + untested |
| S13 | Set anchor | implemented + untested (PB-01: not undoable) |
| S14 | Cut V overlay | implemented + untested |
| S15 | Cut H overlay | implemented + untested |
| S16 | Zoom source | implemented + untested |
| S17 | Clear all boxes | implemented + untested |
| S18 | Undo source op | implemented + untested |
| S19 | Redo source op | implemented + untested |

### Context Menu (C) — 9 actions

| ID | Action | Status |
|----|--------|--------|
| C1 | Add as sprite | implemented + untested (DOM presence probed only) |
| C2 | Add to row | implemented + partially covered (AddToRowSequence agent) |
| C3 | Set anchor (ctx) | implemented + untested (PB-01: not undoable) |
| C4 | Pad to anchor (ctx) | implemented + untested |
| C5 | Delete box (ctx) | implemented + untested |
| C6 | Grid copy | implemented + untested |
| C7 | Grid paste | implemented + untested |
| C8 | Focus grid frame | implemented + untested |
| C9 | Grid delete | implemented + untested |

### Source-to-Grid (D) — 2 actions

| ID | Action | Status |
|----|--------|--------|
| D1 | Drag box to grid | implemented + partially covered (drag-drop agent: 1 case) |
| D2 | Add to row sequence | implemented + partially covered (AddToRowSequence agent) |

### Grid Panel (G) — 14 actions

| ID | Action | Status |
|----|--------|--------|
| G1 | Select frame | implemented + partially covered (selection agent) |
| G2 | Shift-select frames | implemented + partially covered (selection agent) |
| G3 | Move row | implemented + untested |
| G4 | Move column | implemented + untested |
| G5 | Add frame | implemented + untested |
| G6 | Delete frame | implemented + untested |
| G7 | Copy frame | implemented + untested |
| G8 | Paste frame | implemented + untested |
| G9 | Assign category | implemented + untested |
| G10 | Assign group | implemented + untested |
| G11 | Drag-select | implemented + partially covered (selection agent) |
| G12 | Grid context menu | implemented + untested |
| G13 | DblClick → inspector | implemented + partially covered (selection agent) |
| G14 | Grid zoom | implemented + untested |

### Whole-Sheet (W) — 18 actions

| ID | Action | Status |
|----|--------|--------|
| W1 | Focus whole-sheet | implemented + covered (fidelity verifier) |
| W2 | Paint cell | implemented + covered (fidelity verifier) |
| W3 | Eyedropper sample | implemented + covered (fidelity verifier) |
| W4 | Erase cell | implemented + covered (fidelity verifier) |
| W5 | Erase drag | implemented + covered (fidelity verifier) |
| W6 | Flood fill | implemented + covered (fidelity verifier) |
| W7 | Draw rect | implemented + covered (fidelity verifier) |
| W8 | Draw line | implemented + covered (fidelity verifier) |
| W9 | Switch tool | implemented + covered (implicit in W2-W8) |
| W10 | Switch layer | implemented + untested |
| W11 | Toggle layer visibility | implemented + untested |
| W12 | Add layer | implemented + untested |
| W13 | Delete layer | implemented + untested |
| W14 | Move layer | implemented + untested |
| W15 | Select tool | blocked by missing product behavior (PB-06) |
| W16 | Oval tool | deferred from M2 (PB-05) |
| W17 | Text tool | blocked by missing product behavior (PB-07) |
| W18 | Per-stroke undo | blocked by missing verifier capability (VB-01 getState gaps) |

### Jitter (J) — 6 actions

| ID | Action | Status |
|----|--------|--------|
| J1-J6 | Nudge/auto-align family | implemented + untested |

### Lifecycle (L) — 3 actions

| ID | Action | Status |
|----|--------|--------|
| L1 | Save | implemented + partially covered (save-first workflow) |
| L2 | Undo | implemented + untested (state verification missing) |
| L3 | Redo | implemented + untested (state verification missing) |

### Runtime Dock (R) — 7 actions

| ID | Action | Status |
|----|--------|--------|
| R1 | Preview | blocked by missing product behavior (PB-10, PB-13) |
| R2 | Test skin | blocked by missing product behavior (PB-10, PB-13) |
| R3 | Apply skin | blocked by missing product behavior (PB-10) |
| R4 | Upload skin | implemented + untested |
| R5-R7 | Dock controls | implemented + untested |

### Bug Report (B) — 3 actions

| ID | Action | Status |
|----|--------|--------|
| B1-B3 | Open/submit/dismiss | implemented + untested |

### UI Recorder (X) — 4 actions

| ID | Action | Status |
|----|--------|--------|
| X1-X4 | Start/stop/clear/download | implemented + untested |

### Summary Counts

| Classification | Count |
|---------------|-------|
| implemented + covered | 14 |
| implemented + partially covered | 12 |
| implemented + untested | 57 |
| blocked by missing verifier capability | 1 |
| blocked by missing product behavior | 5 |
| deferred from M2 | 7 |
| **Total** | **96** |
