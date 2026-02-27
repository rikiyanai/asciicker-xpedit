# Workbench Regressions Tracker

Status tracker for manual QA regressions and automated coverage gaps in the Workbench UI.

## Current Open Issues

1. Dock / map behavior (manual repro still open)
- User still reports dock/game-stage issues under some manual runs (map-specific behavior, in-game loading, or spawn/underwater teleport variants).
- Keep open while map-side fixes are being tested.
- Automated status:
  - Headed watchdog has passed `loaded_and_playable` in prior runs.
  - Headless watchdog often ends at `dock_loaded_iframe_not_playable` (`overlay PLAY visible`, `wasmReady=false`), which is expected for some headless/WebGL environments and is not by itself a Workbench dock regression.

2. Workbench interaction regressions (user-reported starter list)
- `Analyze` dead-end: changing `Name/Angles/Frames` sometimes does not recover from a bad analyze state.
- Source -> Grid drag flow is hard/broken (`drag selected cells properly`).
- Source and Grid panels need box-level zoom.
- Missing context menu items/options compared to earlier versions (exact list pending diff audit).
- Cannot add/remove cells in Grid Panel (user expectation).
- Grid multi-select UX missing:
  - drag select in-row
  - right-click delete/copy/etc.
  - drag whole row and place between other rows
- Cannot select row in Grid Panel.
- `Add selected row as sequence` groups selected frames as a single sprite.
- Direction labels needed at left of each row (game-expected row order).
- Panel layout regression:
  - `Animation + Metadata` and `XP Preview` should sit under `Grid Panel`
  - `Legacy Char Grid (debug)` should be collapsed by default (dropdown)
- XP tool/workbench editor issues:
  - `can't paint with glyph` (user-reported workflow confusion; automated touch coverage currently shows control click paths, not full semantic result validation)
  - workflow unintuitive
  - legacy char grid debug should be absorbed into XP tool; grid lines should match original XP tool; double-click char cell should open XP editor

Scope note:
- We are not maintaining a separate desktop `xp_tool.py` functional test suite here.
- Required editing-function coverage is tracked against the **Workbench XP Editor**, which is the intended replacement/absorption target.

## Automated Coverage Baseline (2026-02-26)

Coverage command:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-ui-coverage --png tests/fixtures/known_good/cat_sheet.png
```

Latest baseline artifact:
- `/Users/r/Downloads/asciicker-pipeline-v2/artifacts/ui-tests/test-e2e-2026-02-26T06-49-18-355Z/workbench-ui-coverage/workbench-ui-coverage-summary.json`

Summary:
- `pass=180`
- `skip=13` (mostly hidden/disabled-by-state controls)
- `warn=1`
- `fail=0`

Current warning from coverage baseline:
- `Verification (Term++ / QA) -> verifyCommandTemplate` was disabled in that run state.
- Coverage delegate note: dock loaded, but headless iframe remained non-playable (`wasmReady=false`, overlay `PLAY` visible); this is tracked as a non-fatal warning in headless runs.

Notes:
- The coverage agent is a UI-touch matrix (presence/visibility/clickability/type/toggle), not full behavior parity validation for every feature.
- Hidden advanced dock controls and hidden TERM++ panel controls are tracked as hidden-present by design.

## Starter Regression Tests (Automated)

Added dedicated checks in the Codex 4-layer framework:

1. `workbench-analyze-override-recovery`
- Verifies manual values entered after Analyze are actually used:
  - payload probe: confirms `/api/run` request sends manual `name/angles/frames`
  - success probe: confirms session metadata (`angles`, `anims`) reflects manual frame split after convert
- Latest passing artifact:
  - `/Users/r/Downloads/asciicker-pipeline-v2/artifacts/ui-tests/test-e2e-2026-02-26T06-31-22-868Z/workbench-analyze-override-recovery/analyze-override-recovery-summary.json`

2. `workbench-source-grid-dragdrop`
- Verifies source->grid drag/drop path for a deterministic single source box:
  - draw draft source box
  - commit source box
  - select source box
  - drag/drop onto grid frame
  - assert `Dropped ...` status and frame signature mutation
- Latest passing artifact:
  - `/Users/r/Downloads/asciicker-pipeline-v2/artifacts/ui-tests/test-e2e-2026-02-26T06-31-22-868Z/workbench-source-grid-dragdrop/source-grid-dragdrop-summary.json`

Combined command:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-regression-starters --png tests/fixtures/known_good/cat_sheet.png
```

Scope limits (important):
- `workbench-source-grid-dragdrop` currently covers a single-box drag/drop insertion path, not multi-box drag, row drag/reorder, or drag between rows.
- `workbench-analyze-override-recovery` proves manual override propagation and session metadata application, but does not yet cover all analyze-failure recovery UI scenarios.

## Git Diff Audit (Context Menus / Missing Options)

Status: pending detailed historical diff audit.

What is confirmed in current `web/workbench.html`:
- Source context menu items present:
  - `Add as 1 sprite`
  - `Add to selected row sequence`
  - `Set as anchor for Find Sprites`
  - `Pad this bbox to anchor size`
  - `Delete`
- Grid context menu item present:
  - `Delete`

Follow-up audit task:
- Compare `web/workbench.html` and `web/workbench.js` against earlier commits to identify removed context-menu actions and wire them into the coverage catalog once identified.

## Next Test Additions (Planned)

1. Grid row-select and multi-cell selection behavior checks (`drag select IN ROW`, row selection, right-click actions)
2. Source->Grid multi-box drag/drop and row grouping assertions
3. `Analyze` failure recovery scenario (bad run -> edit inputs -> recover without reload)
4. Layout assertions (panel order and `Legacy Char Grid (debug)` collapsed-by-default)
5. XP editor glyph paint semantic validation (cell diff, not just click-path)
6. Context-menu historical diff audit + restore missing actions into coverage catalog

## Requirements Audit Baseline (Automated, Current)

Composite requirements audit command:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-requirements-audit --png tests/fixtures/known_good/cat_sheet.png
```

Latest aggregate artifact:
- `/Users/r/Downloads/asciicker-pipeline-v2/artifacts/ui-tests/test-e2e-2026-02-26T06-47-59-386Z/summary.json`

Current expected failing checks (red baseline for missing features):
- `workbench-grid-selection-requirements`
  - `drag_select_in_row`
  - `grid_add_control_present`
  - `grid_context_menu_has_copy`
  - `grid_row_select_ui_present`
  - `legacy_grid_dblclick_opens_xp_editor`
  - `grid_row_drag_reorder_ui_present`
- `workbench-layout-legacy-audit`
  - `legacy_grid_collapsed_by_default`
  - `legacy_grid_absorbed_into_xp_tool_no_separate_panel`
  - `legacy_grid_green_grid_lines`
  - `source_panel_zoom_controls_present`
  - `grid_panel_zoom_controls_present`
  - `row_direction_labels_dedicated_present`

Passing requirement tests in the same suite:
- `workbench-analyze-override-recovery`
- `workbench-source-grid-dragdrop`
- `workbench-analyze-failure-recovery`
- `workbench-xp-editor-semantic`
- `workbench-source-add-row-sequence`

XP editor parity coverage note:
- `workbench-xp-editor-semantic` is the canonical automated semantic/parity test for absorbed XP-tool editing behaviors.
- Current blocking semantic coverage includes:
  - palette semantics
  - glyph stamp
  - half-cell paint mutation
  - selection drag + copy/cut/paste
  - paste at remembered hover anchor
  - fill / clear selection
  - replace FG / replace BG
  - find & replace (selection + whole-frame scope)
  - selection transforms (rotate/flip)
  - frame actions (copy/paste/flip/clear)
  - shortcut semantics (`Ctrl/Cmd+A`, `Delete`)
- Non-blocking headless note:
  - `]` rotate-selection shortcut is recorded as a non-blocking check due headless keyboard-layout flakiness.

## One-Command "All Required Tests"

Runs:
- full UI touch coverage matrix (`workbench-ui-coverage`)
- requirements audit suite (`workbench-requirements-audit` contents)
- explicit dock watchdog (`workbench-dock-load-watchdog`)

Command:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-required-tests --png tests/fixtures/known_good/cat_sheet.png
```

## 2026-02-27T03:58Z — Mounted skin override follow-up (user validation)

Observed by user after spawn override patch:
- First run: custom mounted skin renders correctly (non-generic).
- Repeat test after direction/movement: mixed/double skin visual and eventual movement freeze.
- User also reports hard refresh (`Cmd+Shift+R`) does not always feel like a fully clean runtime reset.

Likely root cause for mixed/double skin visual:
- Workbench override scope currently targets startup-mounted subset (`000*` + `player-nude`) rather than full directional movement set.
- Runtime switches to additional directional/animation files while turning/moving (`001*`, `010*`, etc.), causing custom+default sheet mixing.

Freeze note:
- Freeze remains a separate/open movement-path issue (water/world state transitions), not a skin payload-write failure.

Evidence:
- `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T03-48-05-865Z/result.json`
- `/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-png-to-skin-2026-02-27T03-48-05-865Z/flat-arena-canvas.png`
