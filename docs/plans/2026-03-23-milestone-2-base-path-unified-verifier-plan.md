# Milestone 2: Base-Path Unified Verifier Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce a complete, base-path-aware verifier architecture for the workbench that covers all 96 user-reachable actions, with acceptance gates for structural PNG baseline and manual assembly, and diagnostic coverage for all remaining workflow families.

**Architecture:** SAR truth table (State-Action-Response) model layered on top of existing XP fidelity verifiers. Base-path awareness is a first-class requirement for every verifier lane. Shared infrastructure (`verifier_lib.mjs`, `selectors.mjs`, `action_registry.json`) extracted as a common layer consumed by all 5 verifier slices.

**Tech Stack:** Playwright (1.58+), Node.js ESM, Python (Flask test client), `__wb_debug` / `__wholeSheetEditor` debug APIs

**Companion doc:** `docs/plans/2026-03-23-milestone-2-bug-gap-index.md` (full bug/gap/action inventory)

---

## 1. Scope and Status

### M1 Status

M1 is **not yet closed**. Remaining blockers (all on canonical `master`, not base-path-specific):

| Blocker | Status | Evidence |
|---------|--------|----------|
| `full_recreation` cell fidelity — 50 L2 mismatches (Run 3) | OPEN | PLAYWRIGHT_FAILURE_LOG 2026-03-20 |
| Whole-sheet layout vs REXPaint spec mismatch | OPEN | PLAYWRIGHT_FAILURE_LOG 2026-03-16 |
| Skin Dock renderStage=2 stall (menu advance) | OPEN | PLAYWRIGHT_FAILURE_LOG 2026-03-18 |
| Missing runtime files block "Test This Skin" | CRITICAL | PLAYWRIGHT_FAILURE_LOG 2026-03-10 |
| `action_tab_hydration` step-5 failure (root-hosted) | OPEN | Outside base-path scope — track separately |

**None of these are base-path regressions.** They exist on `master` and are M1-scope issues that must be resolved before M2 formally opens. This plan treats them as Wave 0 preconditions.

### Base-Path Status

| Layer | Status | Evidence |
|-------|--------|----------|
| JS fetch calls (`workbench.js`) | CLEAN | All 26+ fetches use `bp()` — `workbench.js:10` |
| WS font URL (`whole-sheet-init.js`) | CLEAN | Uses `_BP` prefix — `whole-sheet-init.js:21-22` |
| HTML asset tags (`workbench.html`) | **CLEAN** (rewritten by `_serve_web_html()` at `app.py:79-99`) | Stale-doc debt only — server-side rewrite handles all 4 paths |
| Flask route handling (`app.py`) | CLEAN | `BASE_PATH` config in `config.py:normalize_base_path()` |
| M1 edge-workflow verifier | CLOSED for base-path lane | No `/xpedit`-specific regressions remain |
| UI test framework | CLEAN | `resolveRoute()` + `--base-url` in `scripts/ui_tests/` |
| Python API tests | **BOTH** (root + /xpedit) | `hosted_client` fixture in `conftest.py` parameterizes all 3 test files (`7d3b186`) |

### What "M2 Planning for the Base-Path Version" Means

This plan defines the verifier architecture and bug resolution sequence needed for the workbench to be fully testable **at both `http://host/workbench` and `http://host/xpedit/workbench`** with identical acceptance results. Every verifier lane must:
1. Accept a base URL parameter
2. Use `resolveRoute()` or equivalent for all navigation
3. Produce route-tagged artifacts so results are traceable to the hosting mode

This is not about implementing base-path support in the product (already complete — JS uses `bp()`/`_BP`, HTML rewritten server-side). It is about making the **verifier** base-path-native so that every future M2 feature is automatically tested under both hosting modes.

---

## 2. Known Bug Index

Full index with classifications, evidence, and severity in companion doc:
**`docs/plans/2026-03-23-milestone-2-bug-gap-index.md` § 1**

Summary counts:

| Classification | Open | Fixed | Deferred | Total |
|---------------|------|-------|----------|-------|
| Product bug | 8 | 0 | 5 | 13 (PB-04 reclassified as stale-doc) |
| Verifier bug/gap | 6 | 5 | 0 | 11 |
| Debug API gap | 3 | 0 | 0 | 3 |
| Docs/planning gap | 5 | 0 | 0 | 5 |
| **Total** | **22** | **5** | **5** | **32** |

**Resolved on this branch (2026-03-23):**
- ~~VB-01~~ (`getState()` P1 fields) — CLOSED at `f246828`
- ~~VB-02~~ (`getState()` P2 fields) — CLOSED at `f246828`
- ~~VB-06/07/08~~ (Python test base-path parameterization) — CLOSED at `7d3b186`

**Critical items still requiring attention:**
- **PB-10** (runtime files missing) — blocks all Skin Dock testing
- **PB-12** (50 cell mismatches) — blocks M1 closure

---

## 3. Untested / Missing Coverage Index

Full matrix in companion doc: **`docs/plans/2026-03-23-milestone-2-bug-gap-index.md` § 2**

### ZERO Coverage Areas

| Area | Why It Matters |
|------|---------------|
| Source panel input modes (file-browse, url-input, drag-drop) | These are the M2 primary PNG acquisition paths — untested = unshipped |
| PNG structural edge cases (corrupt, wrong color mode, oversized) | Structural baseline contract requires "any readable PNG" — negative paths untested |
| Source context-menu action outcomes | 9 actions with DOM-presence-only probing; no state verification |
| Undo/redo state verification | Undo is undoable for anchor ops (PB-01/02/03); no state-diff testing for any undo |
| Multi-frame semantic operations | Copy frame, clone angle, reorder — core M2-E tasks with zero coverage |

### Verifier Lane Readiness

| Lane | Acceptance? | Base-Path? | Ready? |
|------|------------|-----------|--------|
| XP fidelity runners (3) | YES | Partial (--url) | YES for current scope |
| ui_tests framework | YES | YES | YES |
| test_base_path.py | YES | YES | YES |
| test_contracts.py | YES | NO | NEEDS PREFIX PARAM |
| test_workbench_flow.py | YES | NO | NEEDS PREFIX PARAM |
| test_analyze_run_compat.py | YES | NO | NEEDS PREFIX PARAM |
| Browser E2E | YES | NO | NEEDS PREFIX PARAM |
| Playwright full workflow | Diagnostic | NO | NEEDS REWRITE |
| Web unit tests (21) | YES | N/A | YES |

---

## 4. Unified SAR Truth Table Requirements

### Required State Surfaces

The verifier must be able to observe all state needed to verify any action's effect. Sources:

| Surface | Access Method | Fields | Base-Path Impact |
|---------|--------------|--------|-----------------|
| Workbench curated state | `__wb_debug.getState()` | 18 current + 9 P1 additions + 2 P2 | None (JS API) |
| Workbench raw state | `__wb_debug._state()` (diagnostic-only) | ~80+ fields | None (JS API) |
| Whole-sheet editor state | `__wholeSheetEditor.getState()` | 13 fields | None (JS API) |
| Webbuild/runtime state | `__wb_debug.getWebbuildDebugState()` | 18+ fields | Runtime URLs are base-path-sensitive |
| Inspector state | `__wb_debug.getInspectorState()` | 16 fields | None (JS API) |
| Layer info | `__wholeSheetEditor.getLayerInfo()` | Per-layer metadata | None |
| Cell data | `__wb_debug.readFrameCell(r,c,cx,cy)` | Glyph/fg/bg per cell | None |
| Frame signature | `__wb_debug.frameSignature(r,c)` | Hash-like fingerprint | None |
| DOM state | Playwright `page.locator()` queries | Buttons, panels, menus | Selectors route-independent |
| Network state | Playwright `page.route()` intercepts | API calls | **Routes must use base-path prefix** |

### P1 `getState()` Additions (Prerequisite)

These 9 fields MUST be added before any M2 verifier slice can be implemented:

| Field | Type | Source in `_state()` | Why Needed |
|-------|------|---------------------|-----------|
| `bundleId` | string | `state.bundleId` | Action tab identity |
| `activeActionKey` | string | `state.activeActionKey` | Current action context |
| `templateSetKey` | string | `state.templateSetKey` | Template identity |
| `activeLayer` | number | `state.activeLayer` | Layer editing context |
| `visibleLayers` | boolean[] | `state.visibleLayers` | Layer visibility |
| `layerCount` | number | `state.layers.length` | Layer geometry |
| `sessionDirty` | boolean | `state.sessionDirty` | Save-state tracking |
| `gridCols` | number | `state.gridCols` | Grid geometry |
| `gridRows` | number | `state.gridRows` | Grid geometry |

### Required Action Families

96 actions across 12 families. Full enumeration in companion doc § 3. Grouped by verifier slice:

| Slice | Actions Covered | Priority |
|-------|----------------|----------|
| Slice 1: PNG Structural Baseline | U1-U3 (upload/analyze/run), T1 (apply template), T4 (export), T7 (test skin) | P0 — acceptance gate |
| Slice 2: Source-Panel Contract | S1-S19 (all source panel), C1-C9 (context menu) | P1 — diagnostic |
| Slice 3: Source-to-Grid Contract | D1-D2 (drag/add-to-row), G1-G14 (grid panel) | P1 — diagnostic |
| Slice 4: Whole-Sheet Correction | W1-W18 (all WS tools), L1-L3 (save/undo/redo) | P1 — diagnostic |
| Slice 5: Manual Assembly Acceptance | End-to-end: U1→S3→S4→D1→W2→T4→T7 | P0 — acceptance gate |

### Required Response/Invariant Families

| Invariant | Scope | Assertion |
|-----------|-------|-----------|
| Source-panel isolation | All S* and C* actions | MUST NOT modify `cells`, grid selection, session geometry, or WS editor state |
| Grid-panel isolation | All G* actions | MUST NOT modify source boxes, source mode, or WS draw state |
| Export idempotency | T4 repeated | Same cells → same XP binary |
| Undo reversibility | L2 after any single action | `getState()` matches pre-action snapshot (except `historyDepth`/`futureDepth`) |
| Base-path transparency | Any action under `/xpedit` | Same `getState()` result as under `/` for identical input sequence |
| Layer isolation | W10 (switch layer) | Only `activeLayer` changes; `cells` unchanged |
| Template geometry lock | T1 (apply template) | `gridCols`, `gridRows`, `frameWChars`, `frameHChars` match template registry |

### Route/Base-Path Requirements for Every Verifier Family

| Verifier | URL Construction | Must Test Under |
|----------|-----------------|-----------------|
| XP fidelity runners | `--url` parameter → `page.goto(url)` | Both `/workbench` and `/xpedit/workbench` |
| ui_tests agents | `resolveRoute(baseUrl, route)` | Both (already works) |
| Python API tests | Flask test client path prefix | Both (`/api/*` and `/xpedit/api/*`) |
| Browser E2E | Playwright `page.goto()` | Both |
| SAR recipe runner | `page.goto(baseUrl)` + `page.evaluate()` for debug API | Both (debug API is route-independent) |

### Seedable/Generated-Sequence Requirements

| Requirement | Purpose |
|------------|---------|
| Deterministic box coordinates | Source-panel verifier must produce repeatable box positions |
| Recipe seed parameter | Fidelity verifier recipe generator already supports mode-based generation; add seed for SAR recipes |
| Fixture catalog | Known-good PNGs per family: player (idle/attack/death) + one adversarial (corrupt/palette/oversized) |
| Template registry snapshot | Freeze `config/template_registry.json` geometry as verifier reference data |

### Report/Artifact Requirements

| Artifact | Format | Purpose |
|----------|--------|---------|
| Gate results JSON | `{gate, pass, details, timestamp}` | Machine-readable acceptance evidence |
| State snapshots | `{action, pre_state, post_state, delta}` | SAR verification evidence |
| Screenshot on failure | PNG with timestamped filename | Visual debugging |
| Action log | JSONL (one line per action) | Replay capability |
| Run summary | Markdown table | Human-readable report |
| Route tag | `{hosting_mode: "root" | "prefixed", base_url: "..."}` | Base-path evidence traceability |

### Acceptance vs Diagnostic Evidence Boundaries

| Evidence Type | Acceptance-Eligible | Diagnostic-Only |
|--------------|--------------------|-----------------|
| Slice 1 gate results | YES — structural baseline | — |
| Slice 5 end-to-end results | YES — manual assembly | — |
| Slice 2-4 state assertions | — | YES (workflow correctness) |
| `_state()` raw snapshots | — | YES (never acceptance) |
| `__wb_debug` write methods (`_setCell`, etc.) | — | YES (mutation = non-acceptance) |
| Coverage agent probes | — | YES (DOM presence only) |
| Web unit test results | YES (component correctness) | — |
| `test_base_path.py` results | YES (base-path gate) | — |

---

## 5. Unfinished Action Inventory

Full classified inventory in companion doc: **`docs/plans/2026-03-23-milestone-2-bug-gap-index.md` § 3**

| Classification | Count | % |
|---------------|-------|---|
| implemented + covered | 14 | 15% |
| implemented + partially covered | 12 | 12% |
| implemented + untested | 57 | 59% |
| blocked by missing verifier capability | 1 | 1% |
| blocked by missing product behavior | 5 | 5% |
| deferred from M2 | 7 | 7% |

**Key insight:** 59% of actions are implemented but have zero automated test coverage. The bottleneck is verifier infrastructure, not product code.

---

## 6. Ordered Sequence of Fixes

### Wave 0: Preconditions / M1 Leftovers

Must resolve before M2 execution begins. These are NOT base-path issues.

| Task | Files | Why First |
|------|-------|-----------|
| Fix 50 L2 cell mismatches in full_recreation | `web/workbench.js` (cell painting logic), `scripts/xp_fidelity_test/run_fidelity_test.mjs` | M1 closure gate — all docs require clean full_recreation pass |
| Fix Skin Dock renderStage=2 stall | `web/workbench.js` (webbuild iframe messaging) | Blocks all runtime testing (PB-13) |
| Create/fix runtime build script | `scripts/build_termpp_skin_lab_static.sh` | Blocks "Test This Skin" (PB-10) |
| ~~Fix 4 root-relative HTML paths~~ | `web/workbench.html:7,8,425,426` | **STALE-DOC** — `_serve_web_html()` at `app.py:79-99` already rewrites all 4 paths at serve time. No fix needed. |

### Wave 1: Verifier Foundation

Build the shared infrastructure all 5 slices depend on.

| Task | Files to Create/Modify | Status |
|------|----------------------|--------|
| ~~Add 9 P1 fields to `getState()`~~ | `web/workbench.js:7103-7125` | **DONE** (`f246828`) |
| ~~Add 2 P2 fields to `getState()`~~ | `web/workbench.js:7103-7125` | **DONE** (`f246828`) |
| Extract shared selectors module | `scripts/xp_fidelity_test/selectors.mjs` (NEW) | NOT STARTED |
| ~~Extract shared verifier library~~ | `scripts/xp_fidelity_test/verifier_lib.mjs` (NEW) | **DONE** (`7d3b186`) — needs readiness hardening |
| Create action registry JSON | `scripts/xp_fidelity_test/action_registry.json` (NEW) | NOT STARTED |
| Create recipe schema JSON | `scripts/xp_fidelity_test/recipe_schema.json` (NEW) | NOT STARTED |
| ~~Parameterize Python API tests for base-path~~ | `tests/conftest.py`, `tests/test_contracts.py`, `tests/test_workbench_flow.py`, `tests/test_analyze_run_compat.py` | **DONE** (`7d3b186`) — 80/80 pass |
| Add `resolveRoute()` to fidelity runners | `scripts/xp_fidelity_test/run_fidelity_test.mjs` (+ bundle, edge) | NOT STARTED |
| **Reconcile edge-workflow with canonical master** | `scripts/xp_fidelity_test/run_edge_workflow_test.mjs` | **NEW** — branch dropped ~360 lines including generated SAR, stronger waits |
| **Reconcile bundle-fidelity with canonical master** | `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs` | **NEW** — branch dropped metaOut dual-gate, bbox caching, preload path |
| **Harden verifier_lib.mjs readiness** | `scripts/xp_fidelity_test/verifier_lib.mjs` | **NEW** — replace fixed sleep with M1-grade readiness wait |
| **Document shared state-capture contract** | `docs/plans/` (new) | **NEW** — getState() vs _state() sourcing policy |

### Wave 2: Structural PNG Baseline Gates (Slice 1)

| Task | Files | Why Next |
|------|-------|----------|
| Create known-good PNG fixtures per family | `tests/fixtures/known_good/player_idle.png`, `attack.png`, `death.png` (NEW) | M2-A.2 — fixtures gate all structural tests |
| Create known-bad PNG fixtures | `tests/fixtures/known_bad/corrupt.png`, `palette_mode.png`, `oversized.png` (NEW) | Negative-path structural validation |
| Wire G7/G8/G9 into `_run_structural_gates()` (if decision = yes) | `src/pipeline_v2/gates.py` | PB-14 — currently unreachable code |
| Implement Slice 1 runner | `scripts/xp_fidelity_test/run_structural_baseline.mjs` (NEW) | M2-A.1 — PNG→bundle→gate→export→runtime pipeline test |
| Add Skin Dock runtime smoke test | Extension to Slice 1 or standalone | M2-A.4 — automated runtime safety check |
| Document frozen baseline contract | `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md` (update) | M2-A.5 — refresh with actual gate status |
| Wire `all_black.png` into negative test | `tests/test_contracts.py` or Slice 1 | VB-10 — orphaned fixture |

### Wave 3: Source-Panel / Manual Assembly Coverage (Slices 2, 3, 5)

| Task | Files | Why Next |
|------|-------|----------|
| Fix anchor undo gap (3 locations) | `web/workbench.js:6592,4086,6513` — add `pushHistory()` | PB-01/02/03 — blocks undo verification |
| Implement Slice 2 runner (source-panel contract) | `scripts/xp_fidelity_test/run_source_panel.mjs` (NEW) | S1-S19 coverage |
| Implement Slice 3 runner (source-to-grid) | `scripts/xp_fidelity_test/run_source_to_grid.mjs` (NEW) | D1-D2 + G1-G14 coverage |
| Implement Slice 5 runner (manual assembly acceptance) | `scripts/xp_fidelity_test/run_manual_assembly.mjs` (NEW) | End-to-end acceptance gate |
| Test source panel input modes | Slice 2 recipes | File-browse, url-input, drag-drop |
| Test context-menu action outcomes | Slice 2 recipes | C1-C9 functional verification |

### Wave 4: Whole-Sheet Primary Surface Completion (Slice 4)

| Task | Files | Why Next |
|------|-------|----------|
| Wire SelectTool into editor | `web/whole-sheet-init.js` — import + toolbar + adapter | PB-06 / M2-C.2 |
| Wire TextTool into editor | `web/whole-sheet-init.js` — import + toolbar + adapter | PB-07 / M2-C.4 |
| Connect per-stroke undo to workbench undo | `web/whole-sheet-init.js` ↔ `web/workbench.js` | M2-C.5 |
| Demote legacy inspector to debug-only | `web/workbench.js` — hide inspector panel, WS becomes primary | M2-C.1 |
| Implement Slice 4 runner (WS correction) | `scripts/xp_fidelity_test/run_ws_correction.mjs` (NEW) | W1-W18 + L1-L3 coverage |
| Layer operation verification | Slice 4 recipes | W10-W14 (switch/visibility/add/delete/move) |
| Undo/redo state-diff verification | Slice 4 recipes | L2/L3 with pre/post state comparison |

### Wave 5: Semantic Dictionaries / Semantic-Edit Verification

| Task | Files | Why Next |
|------|-------|----------|
| Multi-frame/angle region verification | `docs/research/ascii/semantic_maps/*.json` + new validation script | M2-E.4 |
| Agent API for region-based edits | `web/workbench.js` — new `__wb_debug` methods | M2-E.5 |
| Palette-role mapping | Semantic map extensions | M2-E.6 |
| Semantic edit test matrix | `scripts/xp_fidelity_test/` — SAR recipes for semantic ops | Coverage for multi-frame ops |
| Template guide-line overlay | `web/workbench.js` (source canvas rendering) | M2-B.1 |
| "Suggestion" badge on Analyze | `web/workbench.js` (analyze UI) | M2-F.1 |

### Wave 6: Stabilization / Acceptance Pass

| Task | Files | Why Next |
|------|-------|----------|
| Run all 5 slices under both hosting modes | All slice runners with `--url` for root and `/xpedit` | Full base-path acceptance |
| Fix any delta between root and prefixed results | Varies | Base-path transparency invariant |
| Update stale docs (DP-01 through DP-05) | Contract docs, checklist | Align docs with code reality |
| Run full_recreation clean pass | Fidelity verifier acceptance mode | M1 formal closure |
| Generate acceptance report | All slice artifacts → summary Markdown | Human signoff artifact |
| Jitter actions coverage (J1-J6) | Slice 4 extension or standalone | Low-priority completeness |
| Runtime Dock actions (R1-R7) | Requires PB-10/PB-13 resolution first | Post-runtime-fix verification |

---

## 7. Decisions / Open Questions

### D1: Should G7-G9 be added to structural export gating?

**Context:** `gates.py` has G7 (geometry), G8 (non-empty), G9 (handoff) implemented but NOT called in `_run_structural_gates()`. Only G10/G11/G12 are enforced.

**Options:**
- (a) Wire them in — catches more structural failures, but may reject currently-passing bundles
- (b) Keep them diagnostic-only — verifier checks them, but export doesn't gate on them
- (c) Make them configurable per-template — some families require G8, others don't

**Recommendation:** (b) for M2 launch, graduate to (a) once baseline is stable.

### D2: Should source panel pan be required for M2?

**Context:** Deferred as M2-D.4. Users working with large PNGs need to scroll the source canvas.

**Recommendation:** Defer — source zoom (S16) exists, pan is ergonomic improvement not functional gate.

### D3: Should legacy inspector stay debug-only or become hidden by default?

**Context:** M2-C.1 says "demote to debug-only." Inspector is still primary cell-editing surface for some workflows.

**Options:**
- (a) Hidden by default, accessible via `__wb_debug.openInspector()` only
- (b) Collapsed by default, expandable via a small toggle
- (c) Moved to a developer-tools panel

**Recommendation:** (b) — least disruptive, preserves escape hatch.

### D4: Should M2 verifier be one runner with modes or separate runners sharing a SAR core?

**Context:** Current design specifies 5 separate slice runners. Alternative: one `run_verifier.mjs --slice=N`.

**Options:**
- (a) Separate runners (current design) — simpler per-file, but shared code may drift
- (b) Single runner with mode flag — enforces shared infrastructure, harder to test in isolation
- (c) Separate runners importing a shared core module — best of both

**Recommendation:** (c) — `verifier_lib.mjs` as shared core, individual `run_*.mjs` files per slice.

### D5: What is the stale-doc refresh policy?

**Context:** DP-01 (base-path checklist says 0/8 done) is clearly stale — JS `bp()` and `_BP` are already implemented. Multiple docs reference states that have changed.

**Decision needed:** Should stale-doc updates be a Wave 0 task (before M2 execution) or a Wave 6 task (after)?

**Recommendation:** Wave 0 for safety-critical docs (contracts, checklists), Wave 6 for planning docs.

### D6: Which `getState()` additions are truly P1 vs can wait?

**Context:** VB-01 lists 9 P1 fields. Some slices only need a subset.

**Recommendation:** Add all 9 in one commit — they are simple pass-throughs from `state`, low risk, and the incremental cost of adding all vs a subset is negligible.

---

## Verification Items (Answered During Planning)

### Which debug-state fields still require `getState()` additions?

**9 P1 fields confirmed missing** by reading `workbench.js:7103-7125`:
`bundleId`, `activeActionKey`, `templateSetKey`, `activeLayer`, `visibleLayers`, `layerCount`, `sessionDirty`, `gridCols`, `gridRows`

**2 P2 fields:** `sourceCutsV`, `sourceCanvasZoom`

All are simple reads from `state.*`. `_state()` fallback exposes them via raw reference but is unsuitable for acceptance testing.

### Is the anchor undo gap still real?

**YES.** Confirmed at 3 locations:
- `workbench.js:6592` — context menu "Set as anchor" — no `pushHistory()`
- `workbench.js:4086` — `setDraftBox()` implicit anchor set — no `pushHistory()` from draw-complete path
- `workbench.js:6513` — file upload clears anchor — no `pushHistory()`

`snapshot()` at line 1755 DOES capture `anchorBox`, so undo would restore it correctly IF `pushHistory()` were called. The gap is purely missing push calls.

### Which whole-sheet tools exist on disk but are not wired?

**3 tools:**
- `web/rexpaint-editor/tools/oval-tool.js` (OvalTool) — not imported, no toolbar button
- `web/rexpaint-editor/tools/select-tool.js` (SelectTool) — not imported, no toolbar button
- `web/rexpaint-editor/tools/text-tool.js` (TextTool) — not imported, no toolbar button

**2 placeholder UI elements:**
- BROWSE mode button — `disabled=true` at `workbench.js:593`
- New — `_placeholder('New')` at `workbench.js:794`

### Which M2 tasks already have fixtures/research artifacts?

| Has Artifacts | Missing Artifacts |
|--------------|-------------------|
| Semantic dictionaries: `player-0100.json`, `attack-0001.json`, `plydie-0000.json` | Multi-frame/angle region verification |
| PNG fixture: `cat_sheet.png` (192x48) | Family-specific PNG fixtures (player/attack/death) |
| Negative fixture: `all_black.png` (unused) | Corrupt/palette/oversized PNG fixtures |
| XP fixtures: `player-0100.xp`, `test-player.xp` | Per-family XP reference oracles |
| Source panel spec: `m2-source-panel-implementation-spec.md` | — |
| Fixture inventory: `m2-png-fixture-inventory.md` | — |
| Inspector retirement checklist: `legacy-inspector-retirement-checklist.md` | — |
| Semantic edit test matrix: existence unverified | May need creation |

### Which verifier lanes are acceptance-eligible vs diagnostic-only?

| Lane | Classification |
|------|---------------|
| Slice 1 (structural baseline) | **Acceptance** |
| Slice 5 (manual assembly) | **Acceptance** |
| Slices 2-4 (source/grid/WS contracts) | **Diagnostic** |
| XP fidelity runners (acceptance mode) | **Acceptance** |
| ui_tests agents | **Mixed** (smoke = acceptance, coverage = diagnostic) |
| test_base_path.py | **Acceptance** (base-path gate) |
| Web unit tests | **Acceptance** (component correctness) |
| Coverage agent | **Diagnostic** (DOM presence only) |

### Root-relative/base-path-sensitive code paths still relevant?

| Location | Status | Action |
|----------|--------|--------|
| `workbench.html:7,8,425,426` | **CLEAN** (rewritten by `_serve_web_html()` at `app.py:79-99`) | None — stale-doc debt only |
| `workbench.js` fetch calls | CLEAN (all use `bp()`) | None |
| `whole-sheet-init.js` font URL | CLEAN (uses `_BP`) | None |
| `app.py` route registration | CLEAN (uses `BASE_PATH`) | None |
| Runtime iframe bootstrap | **UNTESTED** — `WEBBUILD_BASE_SRC` uses `bp()` but runtime files may have internal root-relative paths | Verify in Wave 2 Skin Dock test |
| `build_termpp_skin_lab_static.sh` | Uses absolute local paths | Verify doesn't embed root-relative URLs in output |

---

## Recommended Next Execution Slice

**The very next session should execute Wave 0 + Wave 1 foundation:**

1. ~~Fix PB-04~~ — **Already handled.** `_serve_web_html()` at `app.py:79-99` rewrites all 4 HTML paths at serve time. Marked as stale-doc debt.

2. **Add VB-01 fields** — 9 P1 fields in `getState()`. This is ~20 lines of code in `workbench.js:7103-7125`. Unblocks all M2 verifier slices.

3. **Parameterize Python API tests** — Add a `base_path` fixture to `conftest.py` so `test_contracts.py`, `test_workbench_flow.py`, `test_analyze_run_compat.py` can run under both root and prefixed modes. Estimated: ~30 lines per file.

4. **Extract `verifier_lib.mjs`** — Shared state capture, assertion framework, artifact writing. This is the foundation all 5 slices build on.

These 4 items are independent of M1 closure (they don't touch fidelity logic) and produce the foundation for all subsequent waves.

**Do NOT attempt:** Slice implementation (needs fixtures), Skin Dock fixes (needs runtime build investigation), cell fidelity debugging (M1 scope, separate session).
