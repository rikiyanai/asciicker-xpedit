# Codebase Audit Report & Feature Review

## 1. Architectural Design: Sprite Template Families
### Review of Sprite Mechanics and Wearables
The game currently implements item and character variations using a formalized `.xp` filename contract, primarily defined in `src/pipeline_v2/service.py` (`_build_native_player_layers`) and `web/termpp_skin_lab.js` (`player_common` arrays).

When a user wants to test a character with different items, the game checks for specific bitmask-like files (e.g., `player-0000.xp`, `player-0001.xp`, `player-0110.xp`). The files denote which wearables (like a helmet, weapon, armor, etc.) are present. If a player equips a helmet, the game looks for `player-1000.xp` (or a similar mask) which contains the core sprite on layer 2 and the helmet overlaid on layer 3 or another layer.

**The Challenge**: As more characters and wearable items are added, generating all permutations of `.xp` files exponentially increases the complexity and the number of required files (`O(C * 2^W)` where `C` is characters and `W` is wearables).

### Proposed Architectural Solution
Instead of pre-rendering every possible wearable permutation as a separate `.xp` file, the game engine and pipeline should shift to a **dynamic runtime compositing approach**.

- **Separation of Layers**: Keep the base character naked sprite as `player-base.xp`. Make each item a separate, standalone `.xp` sprite sheet (e.g., `item-helmet-01.xp`, `item-sword.xp`).
- **Dynamic Layer Injection (WASM/Game Engine)**: Modify the game engine loader (in the `termpp_skin_lab` WASM side) to composite these items on the fly at runtime. When an entity is spawned with `[BasePlayer, Helmet, Sword]`, the engine loads `player-base.xp` into layer 2, `item-helmet-01.xp` into layer 3, and `item-sword.xp` into layer 4.
- **Anchoring System**: If different characters have different body proportions, define "anchor points" in the base `.xp` files using metadata or unused channels (like a specific pure color pixel). The engine uses these anchors to correctly position the overlaid items.
- **Benefits**: Iterability is vastly simplified. You only create one `.xp` for the base character and one `.xp` for the item. The game handles the rest, requiring almost zero codebase changes to the item definition pipeline beyond exposing the dynamic loader.

## 2. Workbench vs Feature Specs Review
According to `docs/REQUIREMENTS_CHECKLIST.md`, the Workbench must support editing features such as "Select one or multiple cells", "Draw box on source panel", and "Find-sprites honors drawn bbox".

### Bug Identification: "Grid Source Panel and Grid Preview Drag Does Not Work"
I have audited the workbench frontend code (`web/workbench.js`) and compared it against the expected behavior.

- **Source**: Dragging a box from the `sourceCanvas` to the grid is intended to work via `onSourceMouseDown` -> `state.sourceDragHoverFrame = gridFrameFromClientPoint()`.
- **Root Cause**: The function `gridFrameFromClientPoint(clientX, clientY)` relies on `document.elementFromPoint(clientX, clientY)`. However, when dragging, the mouse cursor is often over a drag overlay or a transparent drop-zone overlay (e.g., `.grid-drop-choice-overlay`), which intercepts the pointer events. As a result, `elementFromPoint` returns the overlay instead of the underlying `.frame-cell`, causing `gridFrameFromClientPoint` to return `null`.
- **Solution needed**: Implement `pointer-events: none` on the drag/drop visual overlays, or traverse the DOM tree from the `elementFromPoint` hit to find the parent `.frame-cell`.

### Missing or Incomplete Features
1. **Find-sprites honors drawn bbox**: The implementation of `findSprites()` in `workbench.js` works against the whole image data or uses a fixed anchor algorithm. The drawn bbox anchor (`srcCtxSetAnchor`) is partially wired but doesn't fully limit the extraction bounds as specified in the checklist.
2. **Context Menu Delete Action**: The checklist states "Delete action from center-grid context menu", but the right-click deletion is finicky due to event bubbling issues in the grid panel.

## 3. Headed UI Testing Workflows
To support "user stories" and "task scenarios" for testing, I have written two Playwright specifications in the `tests/playwright/` directory.

- **`tests/playwright/bundle-mode-workflow.spec.js`**: Replicates the exact sequence from the canonical `bundle-baseline-2026-03-12` recording. It tests selecting the `player_native_full` template, switching between Idle, Attack, and Death tabs, uploading PNGs for each, and running the runtime test.
- **`tests/playwright/classic-mode-workflow.spec.js`**: Tests the editing capabilities required in the checklist, focusing on the "Upload -> Find Sprites -> Draw Box -> Row Reorder" classic mode scenario.
