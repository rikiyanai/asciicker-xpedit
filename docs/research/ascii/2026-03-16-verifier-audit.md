# Canonical Verifier Audit

Date: 2026-03-16
Branch: master @ 26fb431
Governed by: docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md

---

## 1. truth_table.py — Sound

### What works

- **XP parsing** (`scripts/xp_fidelity_test/truth_table.py:32`): Uses `xp_core.XPFile` — real XP parser, not a simplified stub.
- **All layers preserved** (`truth_table.py:48-69`): Iterates every layer and records all cells with full glyph/fg/bg data.
- **L0 metadata derivation** (`truth_table.py:33-45`): Correctly reads `angles`, `anims`, `projs` from `get_metadata()` and derives `frame_rows`, `frame_cols`, `frame_w`, `frame_h` with exact-division validation.
- **Transparency detection** (`truth_table.py:27-28`): Correct magenta-bg convention.
- **Layer role labels** (`truth_table.py:89-94`): Documents the 0/1/2/3+ role convention.

### Issues

| Issue | File:Line | Severity | Description |
|-------|-----------|----------|-------------|
| Hardcoded editable assumption | `truth_table.py:65` | LOW | `"editable": layer_idx == 2` — assumes only L2 is editable. Documentation field, not a functional gate, but propagates into `recipe_generator.py` assumptions. |
| No per-frame cell grouping | `truth_table.py:48-69` | INFO | Cells are recorded in global (x,y) coordinates. Frame grouping happens in `recipe_generator.py`. This is fine — truth table is raw data. |

**Verdict: SOUND.** No changes needed for whole-sheet alignment. The truth table is editor-model-agnostic.

---

## 2. recipe_generator.py — Inspector-Centric, Stale

### Fundamental problem

The entire recipe generation pipeline produces inspector-specific workflows. Every selector,
every action, and every interaction model assumes the legacy frame-by-frame inspector is the
primary editor. This makes it **unable to express whole-sheet REXPaint-spec actions**.

### Issue inventory

| # | Issue | File:Line | Severity | Description |
|---|-------|-----------|----------|-------------|
| 1 | Inspector-only selectors | `recipe_generator.py:16-30` | CRITICAL | `REQUIRED_SELECTORS` dict contains ONLY inspector elements: `#cellInspectorPanel`, `#inspectorToolGlyphBtn`, `#inspectorGlyphCode`, `#inspectorGlyphFgColor`, `#inspectorGlyphBgColor`, `#inspectorClearFrameBtn`, `#inspectorZoom`, `#cellInspectorCanvas`. No whole-sheet selectors. |
| 2 | Inspector frame-open action | `recipe_generator.py:83-88` | CRITICAL | `open_frame` action uses `dblclick` on `.frame-cell[data-row][data-col]` to open the legacy inspector modal. Not a user-reachable whole-sheet action. |
| 3 | Inspector panel wait | `recipe_generator.py:91` | CRITICAL | Waits for `#cellInspectorPanel` visible — inspector modal dependency. |
| 4 | Inspector layer select | `recipe_generator.py:92` | HIGH | `select_layer` targets `#layerSelect` — inspector dropdown control, not whole-sheet layer switching. |
| 5 | Inspector tool select | `recipe_generator.py:93` | HIGH | `select_tool` targets `#inspectorToolGlyphBtn` — inspector tool, not whole-sheet `#wsToolCell`. |
| 6 | Inspector clear frame | `recipe_generator.py:94` | HIGH | `clear_frame` targets `#inspectorClearFrameBtn` — inspector-only operation. |
| 7 | Inspector glyph/color inputs | `recipe_generator.py:112-114` | HIGH | `set_glyph_code`, `set_fg_color`, `set_bg_color` target inspector controls. Whole-sheet equivalents: `#wsGlyphCode`, `#wsFgColor`, `#wsBgColor`. |
| 8 | Inspector canvas paint | `recipe_generator.py:115-123` | CRITICAL | `paint_cell` clicks `#cellInspectorCanvas` using inspector zoom math. Whole-sheet paints on `#wholeSheetCanvas` with CELL_SIZE coordinates. |
| 9 | Layer-2-only recipe | `recipe_generator.py:66` | HIGH | Only generates paint actions for layer 2 cells. Cannot express multi-layer editing. |
| 10 | No whole-sheet tool actions | `recipe_generator.py` (entire) | CRITICAL | Cannot emit: `ws_tool_activate`, `ws_set_draw_state`, `ws_paint_cell`, `ws_eyedropper`. |
| 11 | No apply-mode actions | `recipe_generator.py` (entire) | HIGH | Cannot emit glyph/fg/bg apply-mode toggles (`#wsApplyGlyph`, `#wsApplyFg`, `#wsApplyBg`). |
| 12 | Per-frame grouping only | `recipe_generator.py:38-48` | MEDIUM | `_group_frame_cells` groups cells for per-frame inspector painting. Whole-sheet paints at global (x,y) — no frame grouping needed. |
| 13 | No mode flag | `recipe_generator.py` (entire) | HIGH | No `--mode acceptance|diagnostic` CLI flag. |

**Verdict: STALE.** Requires whole-sheet recipe mode addition to express acceptance-eligible actions.

---

## 3. run_fidelity_test.mjs — Inspector-First

### Issues

| # | Issue | File:Line | Severity | Description |
|---|-------|-----------|----------|-------------|
| 1 | Inspector zoom dependency | `run_fidelity_test.mjs:147-151` | HIGH | `getZoom()` reads `#inspectorZoom`. Whole-sheet uses fixed CELL_SIZE. |
| 2 | Inspector-only action handlers | `run_fidelity_test.mjs:153-188` | CRITICAL | `executeRecipe()` handles only inspector actions: `open_frame`, `select_layer`, `select_tool`, `clear_frame`, `set_glyph_code/fg/bg`, `paint_cell` (inspector zoom math). |
| 3 | Inspector zoom paint math | `run_fidelity_test.mjs:176-181` | HIGH | `paint_cell` uses `zoom * 2` for Y (half-cell model). Whole-sheet uses CELL_SIZE uniformly. |
| 4 | No mode flag | `run_fidelity_test.mjs` (entire) | HIGH | No `--mode acceptance|diagnostic`. Cannot distinguish acceptance from diagnostic runs. |
| 5 | No whole-sheet action handlers | `run_fidelity_test.mjs` (entire) | CRITICAL | Cannot execute: `ws_tool_activate`, `ws_set_draw_state`, `ws_paint_cell`, `ws_eyedropper`, `ws_erase`, `ws_toggle_apply`. |
| 6 | Incomplete report shape | `run_fidelity_test.mjs:32-41` | MEDIUM | Missing contract-required fields: `new_xp_authoring_pass`, `existing_xp_load_pass`, `frame_layout_pass`, `all_layers_pass`, `cell_fidelity_pass`, `skin_dock_pass`. |
| 7 | No debug-action refusal | `run_fidelity_test.mjs:153-188` | HIGH | Acceptance mode should refuse inspector/debug actions. Currently accepts all. |

### What works

- **Truth table comparison** (`run_fidelity_test.mjs:74-136`): `compareTruth()` is editor-model-agnostic. Compares metadata, dimensions, layer count, cell data across all layers. Sound.
- **Upload scaffolding with honest failure** (`run_fidelity_test.mjs:196-198`): Records `ui_gap` failure for missing user-reachable XP import. Correct.
- **Geometry validation** (`run_fidelity_test.mjs:238-249`): Checks frame count, angles, anims, projs, frame_w, frame_h. Sound.
- **Export comparison** (`run_fidelity_test.mjs:256-277`): Runs truth_table.py on exported XP and compares to source. Sound.

**Verdict: PARTIALLY SOUND.** Comparison and validation logic is good. Action execution was
100% inspector-centric; whole-sheet handlers, whitelist mode enforcement, scroll-before-paint,
contract-gate-based `overall_pass`, and independent `frame_layout_pass` were added 2026-03-16.

---

## 4. run.sh — Sound

Passes CLI args through to the three-step pipeline. Needs `--mode` passthrough when added.

---

## 5. README.md — Accurate but Incomplete

Correctly describes restored strict harness intent. Does not mention:
- whole-sheet editing as the target path
- acceptance vs diagnostic mode distinction
- acceptance contract's required reporting shape

---

## 6. Summary

| Component | Sound? | Whole-Sheet Ready? | Changes Needed |
|-----------|--------|-------------------|----------------|
| truth_table.py | YES | YES (editor-agnostic) | None |
| recipe_generator.py | Partially | NO (100% inspector-centric) | Add `--mode acceptance` whole-sheet recipe generation |
| run_fidelity_test.mjs | Partially | UPDATED 2026-03-16 | Whole-sheet handlers added, whitelist enforcement, scroll-before-paint, gate-conjunction `overall_pass`, independent `frame_layout_pass` |
| run.sh | YES | UPDATED 2026-03-16 | `--mode` passthrough added |
| README.md | YES | UPDATED 2026-03-16 | Both modes documented, protocol references added |
