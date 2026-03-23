# Workbench State-Capture Contract

**Date:** 2026-03-23
**Branch:** `feat/base-path-support`
**Applies to:** All verifier slices (M1 fidelity, M1 edge-workflow, M2 structural baseline, M2 source-panel, etc.)

---

## The Two APIs

| API | Access | Mutability | Use Case |
|-----|--------|-----------|----------|
| `__wb_debug.getState()` | Curated snapshot, safe copy | **Immutable** — returns fresh cloned object | **Primary** for all verifier assertions |
| `__wb_debug._state()` | Raw internal state, direct reference | **Mutable** — caller can corrupt workbench state | **Diagnostic only** — or for fields not yet in getState() |

## getState() Fields (as of `f246828`)

### Original (pre-P1)
`jobId`, `sessionId`, `angles`, `anims`, `projs`, `frameWChars`, `frameHChars`, `selectedRow`, `selectedCols`, `rowCategories`, `frameGroups`, `sourceMode`, `rapidManualAdd`, `sourceImageLoaded`, `drawCurrent`, `sourceSelection`, `extractedBoxes` (count), `sourceBoxes` (geometry array), `anchorBox`, `historyDepth`, `futureDepth`

### P1 additions (M2 verifier prerequisite)
`bundleId`, `activeActionKey`, `templateSetKey`, `activeLayer`, `visibleLayers`, `layerCount`, `sessionDirty`, `gridCols`, `gridRows`

### P2 additions (M2 source panel)
`sourceCutsV` (count), `sourceCanvasZoom`

## Fields Still Requiring _state()

| Field | Why not in getState() | Plan |
|-------|----------------------|------|
| `actionStates` | Complex nested object with per-action session state; needs curation design | Add curated version in next getState() batch |
| `cells` | Full grid cell data — too large for routine snapshots | Use `readFrameCell()` / `readFrameRect()` instead |
| `history` / `future` | Full undo stacks — expose `historyDepth`/`futureDepth` counts instead | Already curated as counts |
| `webbuild` | Sub-object — use `getWebbuildDebugState()` | Separate API exists |
| `inspectorOpen`, `inspector*` | Inspector state — use `getInspectorState()` | Separate API exists |

## Sourcing Rules for Verifier Code

### Rule 1: Prefer getState() for all assertion data
```js
// GOOD — uses curated, immutable snapshot
const gs = window.__wb_debug.getState();
assert(gs.bundleId === expected);

// BAD — uses raw mutable reference
const raw = window.__wb_debug._state();
assert(raw.bundleId === expected);  // may be mutated between read and assert
```

### Rule 2: Use _state() ONLY when getState() doesn't expose the field
```js
// ACCEPTABLE — actionStates not yet curated
const raw = window.__wb_debug._state();
const status = raw?.actionStates?.idle?.status;
```

### Rule 3: Never use _state() writes in acceptance-mode recipes
```js
// FORBIDDEN in acceptance mode — breaks user-reachable-only contract
window.__wb_debug._state().cells[0] = modified;

// ACCEPTABLE in diagnostic mode only
window.__wb_debug._setCell(x, y, cellData);
```

### Rule 4: captureState() must read both APIs
The shared `captureState()` pattern (used by edge-workflow and future M2 slices) reads `getState()` as primary, falls back to `_state()` only for `actionStates`. This is the canonical pattern:

```js
const geo = window.__wb_debug.getState();   // primary — curated, immutable
const raw = window.__wb_debug._state();      // fallback — for actionStates only

return {
  templateSetKey: geo?.templateSetKey ?? null,  // from getState (P1)
  bundleId: geo?.bundleId ?? null,              // from getState (P1)
  activeActionKey: geo?.activeActionKey ?? null, // from getState (P1)
  sessionId: geo?.sessionId ?? null,            // from getState (original)
  activeLayer: geo?.activeLayer ?? 0,           // from getState (P1)
  sessionDirty: geo?.sessionDirty ?? false,     // from getState (P1)
  gridCols: geo?.gridCols ?? null,              // from getState (P1)
  gridRows: geo?.gridRows ?? null,              // from getState (P1)
  historyDepth: geo?.historyDepth ?? 0,         // from getState (original)
  futureDepth: geo?.futureDepth ?? 0,           // from getState (original)
  // ... geometry fields from getState ...
  actionStates: raw?.actionStates ? /* curate */ : null,  // from _state (not yet curated)
};
```

## Readiness Semantics

### openWorkbench() (verifier_lib.mjs)
1. `page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })`
2. `waitForFunction(() => __wb_debug.getState is callable)` — JS initialized
3. `waitForSelector('#xpImportFile', attached)` — DOM ready

### waitForSessionHydration() (verifier_lib.mjs)
After XP import or pipeline run:
1. Dual-gate: `#sessionOut` AND `#metaOut` both populated
2. Both parse as valid JSON
3. `session.session_id` present, `meta.frame_w_chars`/`meta.frame_h_chars` are numbers
4. Optional: `session.grid_cols`/`grid_rows` match expected values

### switch_action_tab (edge-workflow)
Master's 8-phase wait (canonical — do not weaken):
1. Pre-settle delay (800ms) for auto-advance timer
2. Tab click
3. `waitForFunction` — `_state().activeActionKey === expected` (10s)
4. Geometry validation via sessionOut + metaOut (30s)
5. `#wholeSheetCanvas` attached (15s)
6. `#wsGlyphCode` visible (10s, swallowed)
7. Final settle (1s)

## Runner Architecture Decisions (2026-03-23 reconciliation)

### M1 runners stay standalone
`run_fidelity_test.mjs` and `run_bundle_fidelity_test.mjs` do not import
`verifier_lib.mjs`. They use inline readiness patterns that differ slightly
from the canonical contract (e.g., fidelity uses `networkidle`, bundle uses
`domcontentloaded` + `runtimePreflight.checked`). **Do not refactor these.**
M1 is closed; changing proven acceptance infrastructure risks regression.

### Edge-workflow runner stays standalone for M1 scope
`run_edge_workflow_test.mjs` has an inline `captureState()` that already
follows this contract (getState-first, _state fallback for actionStates).
Its switch_action_tab readiness matches the 8-phase canonical sequence above.
Extracting to verifier_lib is optional for M1 scope, required for M2 reuse.

### verifier_lib.mjs is mandatory for all new M2 slices
New verifier slices (PNG structural baseline, source-panel workflow, grid
assembly, whole-sheet integration) MUST import from `verifier_lib.mjs`:
- `parseArgs` / `resolveWorkbenchUrl` / `resolveRoute` for base-path support
- `launchBrowser` / `openWorkbench` for consistent readiness
- `captureState` for contract-compliant state reading
- `createReport` / `fail` / `writeReport` for structured evidence

### actionStates remains _state()-only
`actionStates` is the sole field requiring `_state()` fallback. It will stay
this way until a curated version is added to `getState()`. The curated version
should expose per-action `{ status, sessionId }` only (not full session state).

## When to Add Fields to getState()

Add a field to `getState()` when:
- A verifier slice needs to assert on it
- It would otherwise require `_state()` in acceptance-mode code
- The curated version is a simple pass-through or safe copy

Do NOT add fields that:
- Are too large for routine snapshots (cells, history stacks)
- Have dedicated accessor APIs (inspector, webbuild, whole-sheet)
- Would require complex serialization logic
