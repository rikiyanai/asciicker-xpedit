# Codex UI Testing Framework (4-Layer Agentic Stack)

This repository uses a **Codex-native** (not Gemini-specific) UI testing framework scaffold.

## Layer Mapping

1. **Layer 1: Skills (Core Browser Capabilities)**
   - `scripts/ui_tests/core/browser_skill.mjs`
   - Provides: `open_url`, `click`, `type`, `press_key`, `wait_for`, `screenshot`, `read_page_state`
   - Captures screenshots after meaningful actions (visual trail)
   - Logs actions to JSONL (`actions.jsonl`)

2. **Layer 2: Subagents (User-Story Workers)**
   - Base: `scripts/ui_tests/subagents/base_subagent.mjs`
   - Generic: `scripts/ui_tests/subagents/navigation_agent.mjs`
   - Repo-specific example: `scripts/ui_tests/subagents/workbench_agents.mjs`
     - `WorkbenchSmokeAgent`
     - `WorkbenchSkinDockE2EAgent`
     - `WorkbenchDockLoadWatchdogAgent` (classifies dock-load stuck vs iframe overlay/playability stall)
     - `WorkbenchAnalyzeOverrideRecoveryAgent` (manual input overrides after Analyze are sent/applied)
     - `WorkbenchSourceGridDragDropAgent` (source draft box -> selected source -> drag/drop into grid frame)
   - Workbench-wide UI coverage: `scripts/ui_tests/subagents/workbench_coverage_agent.mjs`
     - `WorkbenchUICoverageAgent` (upload/analyze/convert + probes/touches Workbench controls and emits per-control coverage matrix)

3. **Layer 3: Codex Orchestration Commands (CLI Subcommands)**
   - `scripts/ui_tests/runner/cli.mjs`
   - Commands:
     - `test:smoke`
     - `test:e2e --feature workbench-skin-dock`
     - `test:e2e --feature workbench-dock-load-watchdog`
     - `test:e2e --feature workbench-ui-coverage`
     - `test:e2e --feature workbench-analyze-override-recovery`
     - `test:e2e --feature workbench-source-grid-dragdrop`
     - `test:e2e --feature workbench-regression-starters`
     - `test:e2e --feature workbench-analyze-failure-recovery`
     - `test:e2e --feature workbench-grid-selection-requirements`
     - `test:e2e --feature workbench-layout-legacy-audit`
     - `test:e2e --feature workbench-xp-editor-semantic`
     - `test:e2e --feature workbench-source-add-row-sequence`
     - `test:e2e --feature workbench-requirements-audit`
     - `test:e2e --feature workbench-required-tests` (coverage + requirements audit + explicit dock watchdog)
     - `test:parallel`
   - This replaces any `.gemini/commands` assumption.

4. **Layer 4: Task Runner (`justfile`)**
   - Root `justfile` recipes for install/run/debug/parallel

## Phase 1 Discovery (This Repo)

### Environment Audit
- `node`/`npm`: present
- `just`: not installed in current environment (framework still provides `justfile`)
- Playwright: can run via local `scripts/ui_tests/package.json` dependency or fallback to Codex local install

### App Startup Discovery
- App startup: `PYTHONPATH=src python3 -m pipeline_v2.app`
- Default URL: `http://127.0.0.1:5071/workbench`
- No special env vars required for local Workbench smoke/E2E

### User Journey Mapping (Discovered)
- Core Workbench flow:
  1. Upload PNG
  2. Analyze
  3. Convert to XP
  4. Session becomes active
  5. Optional: `Test This Skin`
- Existing browser e2e exists at `tests/e2e/test_browser_flow.py`

### Auth / Session Discovery
- No auth/login for Workbench app shell itself
- Webbuild iframe has internal game login overlay (player/server fields) but this is not app auth
- Session state is Workbench session JSON persisted via `/api/workbench/save-session`

### Risks / Unknowns
- Flat webbuild startup has multi-stage loading and race conditions; diagnostics should always capture iframe state (`calledRun`, `hasLoad`, overlay visibility)
- First-load latency can be high (wasm/data/font startup)
- UI state may appear "ready" before iframe gameplay is actually interactable (overlay `PLAY` may remain `LOADING...`)

## Usage (Codex-native)

Run smoke:
```bash
node scripts/ui_tests/runner/cli.mjs test:smoke
```

Run E2E Workbench skin dock flow:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-skin-dock --png /absolute/path/to/sheet.png
```

Run dock-load watchdog (same flow, explicit stage classification):
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-dock-load-watchdog --png /absolute/path/to/sheet.png
```

Run Workbench-wide UI coverage (touch matrix across panels/buttons + delegated dock watchdog):
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-ui-coverage --png /absolute/path/to/sheet.png
```

Run starter regression checks (manual-override + source->grid drag/drop):
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-regression-starters --png /absolute/path/to/sheet.png
```

Run requirements audit (includes red-baseline tests for currently missing grid/layout features):
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-requirements-audit --png /absolute/path/to/sheet.png
```

Run all required Workbench tests (coverage + requirements + explicit dock watchdog):
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-required-tests --png /absolute/path/to/sheet.png
```

Run individually:
```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-analyze-override-recovery --png /absolute/path/to/sheet.png
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-source-grid-dragdrop --png /absolute/path/to/sheet.png
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-analyze-failure-recovery --png /absolute/path/to/sheet.png
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-grid-selection-requirements --png /absolute/path/to/sheet.png
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-layout-legacy-audit --png /absolute/path/to/sheet.png
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-xp-editor-semantic --png /absolute/path/to/sheet.png
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-source-add-row-sequence --png /absolute/path/to/sheet.png
```

Run parallel demo:
```bash
node scripts/ui_tests/runner/cli.mjs test:parallel --png /absolute/path/to/sheet.png
```

Artifacts are written to:
- `artifacts/ui-tests/<command>-<timestamp>/`

Post-run logging requirement (mandatory for skin-test debugging):
- Append an entry to `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md` immediately after each run.
- Include:
  - command + key params (`flatmap`, `autonewgame`, XP path)
  - artifact paths (`result.json`, `workbench-final.png`, `flat-arena-canvas.png`)
  - classifier truth fields from trace (`world_ready_ever_true`, `world_ready_final`)
  - hypothesis impact (`supported|ruled_out|inconclusive`)

Coverage run output includes:
- `workbench-ui-coverage/workbench-ui-coverage-summary.json` (pass/skip/warn/fail per control)
- `workbench-ui-coverage/screenshots/*.png` (visual trail)
- optional delegated dock watchdog artifacts/results

XP editing scope note:
- Functional XP editing coverage is centered on the **Workbench XP Editor** (`workbench-xp-editor-semantic` and related XP Editor checks).
- The desktop `xp_tool.py` is **not** a separate required functional test target in this framework.
- `Export -> Launch Desktop XP Tool (Optional)` is treated as an optional integration/button probe only.
- `workbench-xp-editor-semantic` now serves as a **Workbench XP Editor parity suite** (selection ops, paste anchor, fill/clear, replace FG/BG, find/replace, transforms, frame actions, and semantic shortcut checks such as `Ctrl/Cmd+A` and `Delete`).
- The `]` rotate-selection shortcut is tracked as a non-blocking check in headless runs due keyboard-layout/input flakiness; transform semantics are still covered by blocking button/action checks.

Regression starter outputs include:
- `workbench-analyze-override-recovery/analyze-override-recovery-summary.json`
- `workbench-source-grid-dragdrop/source-grid-dragdrop-summary.json`

Requirements/coverage outputs include:
- `workbench-grid-selection-requirements/grid-selection-requirements-summary.json`
- `workbench-layout-legacy-audit/layout-legacy-audit-summary.json`
- `workbench-xp-editor-semantic/xp-editor-semantic-summary.json`
- `workbench-source-add-row-sequence/source-add-row-sequence-summary.json`
- `workbench-requirements-audit/subagent-result.json` (aggregate)
- `workbench-required-tests/subagent-result.json` (aggregate)
- `workbench-dock-load-watchdog/dock-load-watchdog-summary.json`

## Debug / Visual Mode

```bash
node scripts/ui_tests/runner/cli.mjs test:e2e --feature workbench-skin-dock --png /absolute/path/to/sheet.png --headed
```
