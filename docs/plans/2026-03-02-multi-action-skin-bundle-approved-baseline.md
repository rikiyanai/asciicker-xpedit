# Multi-Action Skin Bundle — Architecture & Rollout Plan

## Context

The current pipeline converts a single PNG sprite sheet → one XP file (126x80, 4 layers) for idle/walk. "Test This Skin" writes that same XP to ALL 81 sprite slots (player-*, attack-*, plydie-*, wolfie-*, wolack-*), meaning attack/death use the wrong geometry and visuals.

**Goal**: After building idle/walk AND attack sprites, "Test This Skin" injects the correct XP per action family — distinct bytes and geometry for player vs attack slots.

**Branch**: `template-forcefit-next` (worktree at `/Users/r/Downloads/asciicker-pipeline-v2-clean-wt`)

---

## 1) Architecture: Bundle Session Composition Layer

A `BundleSession` composes N independent `WorkbenchSession` instances — one per action key. This requires changes to core pipeline functions (detailed below), new data models, new API endpoints, and UI additions.

**Scope of changes** (explicit):
- `run_pipeline()` — **TWO CHANGES**: (1) resolve effective dims via explicit `if is not None` checks (not bare `or`, which would coerce 0); (2) accept `RunConfig.family` to select correct L0/L1/layer builder during pipeline run (not just at export)
- `workbench_export_xp()` — **PARAMETERIZED**: add `family` arg to dispatch to correct native builder; default="player" preserves existing behavior. Family flows from RunConfig so preview=export parity is guaranteed.
- `service.py` — **ADDITIVE**: new `_build_native_attack_layers()` and `_build_native_death_layers()` alongside existing `_build_native_player_layers()`; new `_load_reference_l0()` for dynamic L0 templates
- New bundle CRUD/export/payload functions are purely additive
- `models.py` — **EXTENDED**: add `target_cols`/`target_rows`/`family` to RunConfig; add BundleSession dataclass

**Backward compat**: Classic sessions use `/api/workbench/web-skin-payload` (unchanged). Bundle sessions use `/api/workbench/web-skin-bundle-payload`. Multi-action template auto-creates bundle; classic test path hidden in bundle mode.

**Hard constraint — Single-XP path untouched**: The existing single-session flow (`upload → run_pipeline → workbench_load_from_job → workbench_export_xp → web-skin-payload → inject`) must produce identical behavior before and after this work. No changes to this path except the addition of the server-side 409 guard (which only triggers when a bundle session_id is passed). All existing tests must continue to pass unchanged.

---

## 2) Verified Native Contracts (Ground Truth)

Verified against `/Users/r/Downloads/asciicker-Y9-2/sprites/*.xp`:

| Family | XP dims | Layers | L0 col-0 metadata | L0 content |
|--------|---------|--------|-------------------|------------|
| **player** (idle) | 126x80 | 4 | `'8','1','8'` | 7 metadata cells + spaces (0.1% non-space) |
| **attack** | 144x80 | 4 | `'8','8'` | Dense: ~38% non-space (border art) |
| **plydie** (death) | 110x88 | 3 | `'8','5'` | Dense: ~33% non-space (border art) |

### Cell geometry (all units = char-cells in output XP)

All families use `projs=2` for `angles=8` (confirmed: `RunConfig(angles=8).projs == 2`):

| Family | XP dims | frames | total_tile_cols=Σframes×projs | cell_w | cell_h |
|--------|---------|--------|------|--------|--------|
| player | 126x80 | [1,8]=9 | 9×2=18 | 126/18=**7** | 80/8=**10** |
| attack | 144x80 | [8]=8 | 8×2=16 | 144/16=**9** | 80/8=**10** |
| plydie | 110x88 | [5]=5 | 5×2=10 | 110/10=**11** | 88/8=**11** |

### L1 strategy (animation index layer) — LOCKED
**DO NOT introduce any new column-based L1 logic.** Reuse the existing `_build_native_l1_layer(cols, rows)` (`service.py:1038`) for ALL families in Phase 1. This builder uses row-based 9→0 countdown (`9-(y%NATIVE_CELL_H)`) and is ship-gated (0/20 WASM crashes). For attack (144x80), call `_build_native_l1_layer(144, 80)`. For death (110x88), call `_build_native_l1_layer(110, 88)` — note death cell_h=11 ≠ NATIVE_CELL_H=10, so parameterize the cycle period if needed in Phase 2. Phase 1 only adds attack (cell_h=10, same as player).

### L0 strategy: Dynamic reference templates
Attack and plydie L0 layers contain dense box-drawing border art that differs from player's sparse metadata-only L0. Given L0 crash sensitivity (session #S13), we load L0 templates dynamically from reference XP files at server startup:
- `sprites/player-0100.xp` → player L0 template (existing)
- `sprites/attack-0001.xp` → attack L0 template (copy from native game)
- `sprites/plydie-0000.xp` → death L0 template (copy from native game)

Reference files must be present in repo. `_load_reference_l0(family)` reads and caches L0 cells at startup. **Integrity check**: template_registry.json includes `l0_ref_sha256` per action. At startup, computed SHA-256 of each reference file is compared against the pinned hash. Mismatch → log warning + mark family as unavailable. **API behavior on checksum mismatch**: any endpoint that would use the failed family returns HTTP 422 with body `{"error": "invalid_template_reference", "detail": "L0 reference checksum mismatch for family '{family}'. Update l0_ref_sha256 in template_registry.json.", "family": "<family>"}`. This lets frontend display a specific error and tests assert deterministically.

---

## 3) API Contract Drafts

### `GET /api/workbench/templates`
```json
{
  "template_sets": {
    "player_native_idle_only": {
      "label": "Player Skin (Idle Only)",
      "actions": {
        "idle": { "family": "player", "label": "Idle / Walk", "required": true,
                  "xp_dims": [126,80], "angles": 8, "frames": [1,8], "projs": 2,
                  "cell_w": 7, "cell_h": 10, "layers": 4 }
      }
    },
    "player_native_full": {
      "label": "Player Skin (Full Bundle)",
      "actions": {
        "idle":   { "family": "player", "label": "Idle / Walk", "required": true,
                    "xp_dims": [126,80], "angles": 8, "frames": [1,8], "projs": 2,
                    "cell_w": 7, "cell_h": 10, "layers": 4 },
        "attack": { "family": "attack", "label": "Attack", "required": false,
                    "xp_dims": [144,80], "angles": 8, "frames": [8], "projs": 2,
                    "cell_w": 9, "cell_h": 10, "layers": 4,
                    "weapon_filter": "W>=1" },
        "death":  { "family": "plydie", "label": "Death", "required": false,
                    "xp_dims": [110,88], "angles": 8, "frames": [5], "projs": 2,
                    "cell_w": 11, "cell_h": 11, "layers": 3 }
      }
    }
  }
}
```

`cell_w` and `cell_h` are **output char-cells** (the tile size in the final XP grid, matching native).

### `POST /api/workbench/action-grid/apply`
Template's `run_config_defaults` are auto-populated from registry. User only provides `source_path` and `action_key`. Target dims (`target_cols`, `target_rows`) come exclusively from registry — never from client.
```json
// Request: { "bundle_id": "b-abc123", "action_key": "attack", "source_path": "..." }
// Server resolves from registry: angles=8, frames=[8], target_cols=144, target_rows=80, native_compat=true
// Response: { "job_id": "j-456", "session_id": "s-789", "grid_cols": 144, "grid_rows": 80 }
```

### `POST /api/workbench/web-skin-bundle-payload`
Per-action XP bytes + target filenames:
```json
{ "actions": {
    "idle":   { "xp_b64": "...", "override_names": ["player-nude.xp","player-0000.xp",..."player-1111.xp"] },
    "attack": { "xp_b64": "...", "override_names": ["attack-0001.xp","attack-0011.xp","attack-0101.xp",
                "attack-0111.xp","attack-1001.xp","attack-1011.xp","attack-1101.xp","attack-1111.xp"] }
  },
  "unmapped_families": ["plydie"],
  "reload_player_name": "player"
}
```
**Fallback**: Unmapped families are NOT overridden — WASM keeps native defaults. Avoids geometry mismatches.

### `/api/workbench/web-skin-payload` — UNCHANGED + SERVER GUARD
Classic sessions only. **Unreachable from bundle mode UI** (auto-guard). **Backend guard**: if `session_id` belongs to a bundle (check `data/bundles/` for session→bundle mapping), return HTTP 409 with error `"use /api/workbench/web-skin-bundle-payload for bundle sessions"`. Prevents accidental cross-family overwrite via direct API calls.

---

## 4) Session/Data Model

### RunConfig changes (`models.py`)
```python
@dataclass
class RunConfig:
    # ... existing fields ...
    target_cols: int | None = None   # NEW: override NATIVE_COLS when set
    target_rows: int | None = None   # NEW: override NATIVE_ROWS when set
    family: str = "player"           # NEW: selects L0/L1/layer builder
```
**`family` drives builder selection throughout the pipeline**:
- `run_pipeline()` uses `cfg.family` to select which `_build_native_{family}_layers()` function assembles the final XP. This ensures action-grid previews use the same L0/L1 contracts as export — no "preview shows player metadata, export rewrites to attack metadata" drift.
- `workbench_export_xp()` reads `family` from the session's originating RunConfig (persisted in job metadata).
- Validation: `target_cols % total_tile_cols == 0`, `target_rows % angles == 0`
- Default (`family="player"`, `target_cols=None`) = existing 126x80 behavior (backward compat)

### BundleSession (`data/bundles/{bundle_id}.json`)
```python
@dataclass
class BundleActionState:
    action_key: str
    session_id: str | None = None
    job_id: str | None = None
    source_path: str | None = None
    status: str = "empty"  # empty|uploaded|converted|edited

@dataclass
class BundleSession:
    bundle_id: str
    template_set_key: str
    actions: dict[str, BundleActionState]
    created_at: str = ""
    updated_at: str = ""
```

### WorkbenchSession — UNCHANGED
Each action gets its own standard `WorkbenchSession`.

---

## 5) Template Registry

### File: `config/template_registry.json`
Schema per §3. Loaded once at server startup. The `family` field drives builder selection AND reference L0 template lookup.

**Filename generation** by `ahsw_range`:
- `"all_16"` → AHSW ∈ {0,1}⁴ → 16 files + extras
- `"weapon_gte_1"` → AHS ∈ {0,1}³, W=1 → 8 files

---

## 6) UI Integration Plan

### Auto-bundle guard
- Selecting a multi-action template automatically creates a `BundleSession`
- "Test This Skin" in bundle mode ALWAYS calls bundle payload endpoint
- Classic single-XP test path is **hidden/disabled** in bundle mode
- Classic endpoint unreachable from bundle UI (no accidental geometry-mismatch overwrites)

### Action tabs
When bundle mode active, horizontal tab bar:
```
[Idle/Walk ✓]  [Attack ○]  [Death ○]
```
Each tab swaps the backing `sessionId` — same source/grid/preview panels reused.

### State additions in `workbench.js`
```javascript
state.bundleId = null;           // null = classic mode
state.templateSetKey = "player_native_idle_only";
state.activeActionKey = "idle";
state.actionStates = {};
```

### Preserving existing flow
`templateSetKey === "player_native_idle_only"` → no tabs, no bundle, 100% existing behavior.

---

## 7) Runtime Injection Plan

### Bundle injection function
```javascript
async function injectBundleIntoWebbuild(win, bundlePayload) {
  for (const [actionKey, actionData] of Object.entries(bundlePayload.actions)) {
    const xpBytes = b64ToUint8Array(actionData.xp_b64);
    for (const name of actionData.override_names) {
      emfsReplaceFile(M, `/sprites/${name}`, xpBytes);
    }
  }
  // Unmapped families → no writes → WASM keeps native defaults
  win.Load("player"); win.Resize(null);
}
```

### Bootstrap attack trigger (testing only)
`termpp_flat_map_bootstrap.js`: add `scheduleAutoAttackTest()` gated by `?autoattack=1`. Fires attack keypress 2s after player grounded. Emits `[ATTACK-TRIGGER]` console log for Playwright.

---

## 8) Wearables Strategy

**Pre-composite during export (Phase 3 MVP)**. User provides base body + weapon overlay. Export composites at cell level. W=0 → base XP, W≥1 → composite XP. Scales to 2 variants per family initially.

---

## 9) Validation + Test Plan

### Per-action structural gates
| Gate | Check | Severity |
|------|-------|----------|
| G10 | XP dims match template's `xp_dims` | BLOCK |
| G11 | Layer count matches template's `layers` | BLOCK |
| G12 | L0 col-0 metadata matches template's expected values | BLOCK |
| G7-G9 | Existing geometry/nonempty/handoff gates | BLOCK |

### Bundle completeness gate
All `required` actions must be `converted` or `edited`. Missing optional = warning.

### Runtime smoke test (Phase 1 — idle+attack only)
- **N=5** bundle injection test via Playwright — **idle + attack actions only** (death is in the registry schema but NOT tested until Phase 2)
- **Primary gate (BLOCK)**: `crashSignals.any === false` for all N runs. This is the sole blocking criterion.
- **Non-blocking telemetry**: `error`, `classification`, `runValidity` logged but NOT gated. Current harness returns `error=invalid_run` for all runs (including stable native) due to pos-reporting regression.
- Attack trigger: `?autoattack=1` + frame diff >5% (WARN for Phase 1)

---

## 10) Phased Rollout

### Phase 1: Idle + Attack (5-7 days)
- Template registry + bundle session CRUD
- RunConfig `target_cols`/`target_rows` extension
- Attack family native builder (144x80, L4, dynamic L0 from reference)
- Per-action upload + pipeline run endpoints
- Bundle export + payload endpoints
- UI: template selector + 2-tab bar + auto-bundle guard
- Bundle injection (per-action XP bytes)
- Structural gates G10-G12
- Playwright bundle test N=5

**Phase 1 feature gate (server-side)**: `PHASE1_ENABLED_FAMILIES = {"player", "attack"}`. Any request to `action-grid/apply` or `web-skin-bundle-payload` referencing a family not in this set → HTTP 422 `{"error": "phase_not_enabled", "detail": "Family '{family}' is not enabled in the current phase.", "family": "<family>"}`. Phase 2 adds `"plydie"` to the set. This prevents death actions from reaching the pipeline even if the UI guard is bypassed.

**Ship gate**: N=5 bundle (idle+attack only) → `crashSignals.any=false` for all runs. `error`/`classification` logged as telemetry, not gated. Death family is present in registry schema but server-rejected until Phase 2.

### Phase 2: Death (2-3 days)
- Add `"plydie"` to `PHASE1_ENABLED_FAMILIES` (rename to `ENABLED_FAMILIES`)
- Death family builder (110x88, L3, dynamic L0 from reference)
- UI: 3rd tab
- plydie target names (all 16 AHSW)

### Phase 3: Wearables MVP (3-5 days)
- Weapon overlay upload UI
- Cell-level pre-composite
- W=0 vs W≥1 variant generation

**Rollback**: Template selector defaults to "Idle Only". Bundle paths dead in classic mode.

---

## 11) Implementation Tickets

### T1: Template Registry + Bundle Model + RunConfig Extension (1 day)
- NEW: `config/template_registry.json`
- NEW: `sprites/attack-0001.xp`, `sprites/plydie-0000.xp` (copy from native game as reference templates)
- MODIFY: `src/pipeline_v2/models.py` — add `target_cols`/`target_rows` to RunConfig; add `BundleSession`, `BundleActionState`
- MODIFY: `src/pipeline_v2/config.py` — add `BUNDLES_DIR`, `PHASE1_ENABLED_FAMILIES = {"player", "attack"}`
- MODIFY: `src/pipeline_v2/service.py` — add `load_template_registry()`, `_load_reference_l0(family)`, `create_bundle()`, `load_bundle()`, `save_bundle()`
- MODIFY: `src/pipeline_v2/app.py` — add `GET /api/workbench/templates`, `POST /api/workbench/bundle/create`
- **Deps**: None

### T2: Per-Action Pipeline Run with Target Dims + Family (1 day)
- MODIFY: `src/pipeline_v2/service.py` — in `run_pipeline()`:
  - Resolve effective dims as two separate assignments:
    ```python
    cols = cfg.target_cols if cfg.target_cols is not None else NATIVE_COLS
    rows = cfg.target_rows if cfg.target_rows is not None else NATIVE_ROWS
    ```
    (Avoids `cfg.target_cols or NATIVE_COLS` which silently coerces `0` to `NATIVE_COLS`.)
  - Replace `_build_native_player_layers()` call with family-dispatched `_build_native_layers(family=cfg.family, ...)` that selects correct builder
  - This ensures action-grid/apply produces XPs with correct L0/L1 from the start (not just at export)
  - Add `bundle_action_run()` wrapper that populates RunConfig fields (`family`, `target_cols`, `target_rows`, `frames`, `angles`) from template registry
- MODIFY: `src/pipeline_v2/app.py` — add `POST /api/workbench/action-grid/apply`
- Validate: `target_cols % total_tile_cols == 0` and `target_rows % angles == 0`
- **Deps**: T1, T3 (needs family builders to exist before dispatching to them)

### T3: Attack Family Native Builder (1 day)
- MODIFY: `src/pipeline_v2/service.py`:
  - Add `_build_native_attack_layers()`: dynamic L0 from `_load_reference_l0("attack")`, **reuse existing `_build_native_l1_layer()`** (row-based countdown, ship-gated pattern), L2 visual cells, L3 blank
  - Add `_build_native_layers(family, ...)` dispatcher that routes to `_build_native_player_layers()` (existing) or `_build_native_attack_layers()` (new) based on family string
  - Add `_assert_native_dims(cols, rows, family)` generalized dimension gate using registry-defined dims
  - Parameterize `workbench_export_xp()` — read `family` from session metadata (set during `run_pipeline`). **Fallback for pre-existing sessions**: if `family` is missing from session metadata JSON, default to `"player"`. This ensures all sessions created before bundle support continue to export correctly without migration.
- **Deps**: T1

### CHECKPOINT after T2 (mandatory before T4)
**Stop and validate before proceeding.** T1→T3→T2 must all be complete. Do not start T4 until both pass:
1. **Attack XP build check**: `run_pipeline(family="attack", target_cols=144, target_rows=80)` produces XP with: dims=144x80, layers=4, L0 col-0=`['8','8']`
2. **Bundle inject smoke N=3**: Inject idle XP (player slots) + attack XP (attack slots) into WASM runtime → `crashSignals.any=false` for all 3 runs

If either fails, debug before continuing. This catches L0/L1/dimension issues before investing in export/UI code.

### T4: Bundle Export + Payload Endpoints + API Guard (1 day)
- MODIFY: `src/pipeline_v2/service.py` — add `workbench_export_bundle()`, `workbench_web_skin_bundle_payload()`, `_action_override_names(family, ahsw_range)`, `_is_bundle_session(session_id)` helper
- MODIFY: `src/pipeline_v2/app.py` — add `POST /api/workbench/export-bundle`, `POST /api/workbench/web-skin-bundle-payload`, `POST /api/workbench/action-map/save`. **Server guards**: (1) existing `POST /api/workbench/web-skin-payload` — if `_is_bundle_session(session_id)`, return HTTP 409 `"use web-skin-bundle-payload for bundle sessions"`; (2) `action-grid/apply` and `web-skin-bundle-payload` — if requested family ∉ `PHASE1_ENABLED_FAMILIES`, return HTTP 422 `phase_not_enabled`. Both guards are server-enforced; UI guard alone is insufficient.
- **Deps**: T2, T3

### T5: UI — Template Selector + Action Tabs + Auto-Bundle Guard (2 days)
- MODIFY: `web/workbench.html` — template selector dropdown, tab bar markup
- MODIFY: `web/workbench.js` — bundle state, tab switching, per-action flows. Auto-bundle: selecting multi-action template creates BundleSession and hides classic test path. `applyCurrentXpAsWebSkin()` branches on `state.bundleId`.
- **Deps**: T1, T4

### T6: Bundle WASM Injection (1 day)
- MODIFY: `web/workbench.js` — add `injectBundleIntoWebbuild()`, wire into bundle branch of `applyCurrentXpAsWebSkin()`
- **Deps**: T4, T5

### T7: Structural Gates G10-G12 (0.5 day)
- MODIFY: `src/pipeline_v2/gates.py` — add `gate_g10_action_dims()`, `gate_g11_layer_count()`, `gate_g12_l0_metadata()`
- MODIFY: `src/pipeline_v2/service.py` — call during bundle export
- **Deps**: T3

### T8: Bootstrap Attack Trigger + Playwright Bundle Test (1 day)
- MODIFY: `web/termpp_flat_map_bootstrap.js` — add `scheduleAutoAttackTest()` gated by `?autoattack=1`
- MODIFY: `scripts/workbench_png_to_skin_test_playwright.mjs` — add `--bundle` mode, multi-XP injection, attack trigger, frame diff
- Runtime sync: use `./scripts/build_termpp_skin_lab_static.sh /Users/r/Downloads/asciicker-Y9-2/.web` (existing build/sync script — do NOT use ad-hoc `cp` commands)
- **Deps**: T6

```
T1 ──→ T3 ──→ T2 ──→ [CHECKPOINT: smoke N=3] ──→ T4 ──→ T5 ──→ T6 ──→ T8
                                                    └──→ T7
```
- T3 before T2: family builders must exist before `run_pipeline()` can dispatch to them
- CHECKPOINT after T2: mandatory smoke test before investing in export/UI code
- T4 includes server-side API guard (409 for bundle sessions on classic endpoint)

---

## Verification

1. **Unit**: Generate attack XP via `run_pipeline(family="attack")` → assert 144x80 L4, L0 col-0 = `['8','8']`, cell_w=9 (144/16)
2. **Reference L0 integrity**: `_load_reference_l0("attack")` checksum matches `l0_ref_sha256` in registry
3. **Preview=Export parity**: action-grid/apply for attack produces XP with attack L0 metadata (not player metadata) — same builder used for both preview and export
4. **Integration**: `POST /api/workbench/web-skin-bundle-payload` returns distinct `xp_b64` per action with correct `override_names` (17 player, 8 attack)
5. **API guard**: `POST /api/workbench/web-skin-payload` with a bundle session_id → HTTP 409
6. **E2E**: Playwright bundle test N=5 → `crashSignals.any=false` for all runs
7. **Regression**: Existing single-XP test N=5 → 0 crashes, unchanged behavior
8. **UX guard**: Verify classic test button is disabled/hidden when bundle mode active
