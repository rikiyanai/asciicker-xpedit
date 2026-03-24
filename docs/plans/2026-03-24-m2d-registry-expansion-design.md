# M2-D Registry Expansion Design

**Date:** 2026-03-24
**Branch:** master
**Depends on:** Generator foundation (85ff3b8), M2-C closeout (d824667)
**Status:** approved

---

## Goal

Expand the action registry from 47 entries (READY families only) to 77 entries covering F3/F6 button-click actions, F7 whole-sheet stubs, and a W15 product fix. This is the first M2-D pass — it covers all actions extractable under the current schema without new gesture types or branching models.

## Current State

- **Registry:** 47 actions across 8 READY families (F1/F2/F4/F8/F9/F10/F11/F12)
- **Families F3/F5/F6/F7:** registryActionCount = 0
- **M2-C:** 15/18 W-family PROVEN (W1-W14 + W18). W15 WIRED (visualization gap). W16-W17 DEFERRED.
- **Generator stack:** selectors.mjs → action_registry_schema.json → action_registry.json → recipe_generator.mjs → dom_runner.mjs — all committed and tested.

## Deliverables

### Part 1a: F3 Source Panel — 7 new executable entries

| ID | Action | selectorKey | gestureType | Canon Status |
|----|--------|-------------|-------------|-------------|
| S1 | Set mode: Select | sourceSelectBtn | click | PROVEN |
| S2 | Set mode: Draw Box | drawBoxBtn | click | PROVEN |
| S3 | Set mode: Drag Row | rowSelectBtn | click | WIRED |
| S4 | Set mode: Drag Column | colSelectBtn | click | WIRED |
| S5 | Set mode: Vertical Cut | cutVBtn | click | WIRED |
| S6 | Delete box / clear overlays | deleteBoxBtn | click | WIRED |
| S12 | Find Sprites | extractBtn | click | PROVEN |

**Deferred:**
- S7-S10, S13-S14, S17: canvas gestures (NEEDS_DESIGN)
- S11: duplicate of S6 — same button, same handler
- S15, S16: deferred alias rows — same selectors/gestures as C3/C4, distinct canon IDs
- S18: inputRange not in runner
- S19: PARTIAL

### Part 1b: F6 Grid Panel — 5 new executable entries

| ID | Action | selectorKey | gestureType | paramBindings | Canon Status |
|----|--------|-------------|-------------|---------------|-------------|
| G5 | Add frame | addFrameBtn | click | none | WIRED |
| G6 | Delete selected | deleteCellBtn | click | none | WIRED |
| G9 | Assign row category | assignAnimCategoryBtn | click | animCategorySelect → selectOption → "category" | WIRED |
| G10 | Assign frame group | assignFrameGroupBtn | click | frameGroupName → fill → "groupName" | WIRED |
| G11 | Apply groups to metadata | applyGroupsToAnimsBtn | click | none | WIRED |

**Deferred:**
- G3, G4: dual-button schema gap (one canon ID → two physical buttons; paramBindings can't branch on click)
- G7, G8: deferred alias rows — same selectors/gestures as C6/C7, distinct canon IDs
- G13: inputRange not in runner
- G1, G2, G12, G14: canvas gestures

### Part 2a: Selectors — 31 new entries in selectors.mjs

29 ws* ID selectors from whole-sheet-init.js dynamic DOM creation, plus 2 class selectors:
- `.ws-layer-add-btn` (W12)
- `.ws-layer-del-btn` (W13)

### Part 2b: F7 Whole-Sheet — 2 new executable entries

| ID | Action | selectorKey | gestureType | generatorReadiness | Canon Status |
|----|--------|-------------|-------------|-------------------|-------------|
| W12 | Add layer | wsLayerAddBtn | click | READY | PROVEN |
| W13 | Delete layer | wsLayerDelBtn | click | READY | PROVEN |

These are stable header buttons (`.ws-layer-add-btn`, `.ws-layer-del-btn`), not per-row dynamic elements.

### Part 2c: F7 Whole-Sheet — 16 stub entries (not executable)

| ID | Action | status | generatorReadiness | Blocker |
|----|--------|--------|--------------------|---------|
| W1 | Focus whole-sheet | PROVEN | NEEDS_DESIGN | dblclick grid frame → WS mount |
| W2 | Paint cell | PROVEN | NEEDS_DESIGN | Tool activation + canvasClick |
| W3 | Eyedropper | PROVEN | NEEDS_DESIGN | Tool activation + canvasClick |
| W4 | Erase cell | PROVEN | NEEDS_DESIGN | Tool activation + canvasClick |
| W5 | Erase drag | PROVEN | NEEDS_DESIGN | canvasDrag after tool activation |
| W6 | Flood fill | PROVEN | NEEDS_DESIGN | Tool activation + canvasClick |
| W7 | Rectangle tool | PROVEN | NEEDS_DESIGN | Tool activation + canvasDrag |
| W8 | Line tool | PROVEN | NEEDS_DESIGN | Tool activation + canvasDrag |
| W9 | Switch tool (keyboard) | PROVEN | NEEDS_DESIGN | keypress C/E/D/L/R/I/S |
| W10 | Switch layer | PROVEN | NEEDS_DESIGN | Dynamic layer row buttons |
| W11 | Toggle layer visibility | PROVEN | NEEDS_DESIGN | Dynamic layer checkboxes |
| W14 | Move layer | PROVEN | NEEDS_DESIGN | Dynamic up/down per layer row |
| W15 | Select tool | WIRED | NEEDS_DESIGN | canvas.setSelectionTool() not called — no visualization |
| W16 | Oval tool | DEFERRED | DEFERRED | OvalTool not wired |
| W17 | Text tool | DEFERRED | DEFERRED | TextTool not wired |
| W18 | Per-stroke undo/redo | PROVEN | DEFERRED | Dual-button (wsUndoBtn/wsRedoBtn) — same schema gap as G3/G4 |

### Part 3: W15 product fix

One line in `whole-sheet-init.js`, after selectTool instantiation (~line 344):

```js
canvas.setSelectionTool(editorState.selectTool);
```

The marching-ants rendering already exists at `canvas.js:573-600`. The SelectToolAdapter already exposes `getSelectionBounds()`. This call connects them. After landing + verifier proof: W15 status → PROVEN, generatorReadiness stays NEEDS_DESIGN (canvas gesture for actual selection use).

## Schema Gaps Identified (not addressed in this pass)

| Gap | Affected Actions | Resolution Path |
|-----|-----------------|----------------|
| Dual-button branching | G3, G4, W18 | Schema needs conditional action dispatch or canon ID split |
| inputRange gesture in runner | S18, G13 | Add inputRange to dom_runner.mjs gesture executors |
| Canvas gesture abstraction | S7-S10, S13-S14, S17, G1, G2, G12, G14, W1-W9 | Multi-step action model: tool activation + canvas gesture |
| Dynamic row selectors | W10, W11, W14 | Parameterized selector model for layer row indices |
| Alias rows | S15=C3, S16=C4, G7=C6, G8=C7 | Schema allows it; deferred to alias-row pass |

## Totals

| Category | Count |
|----------|-------|
| New executable entries | 14 (7 F3 + 5 F6 + 2 F7) |
| New stub entries | 16 (F7) |
| New selectors in selectors.mjs | 31 |
| W15 product fix | 1 line |
| **Total new registry entries** | **30** |
| **Registry total after this pass** | **77** |
