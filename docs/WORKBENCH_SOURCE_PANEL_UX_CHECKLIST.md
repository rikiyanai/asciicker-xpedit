# Workbench Source Panel UX Checklist (Common-Sense Functionality)

Date: 2026-02-23
Baseline commit: `5c54a77` (`Improve workbench XP integration and slicing heuristics`)

Purpose:
- Track the next UX additions requested for the Workbench source panel/grid workflow.
- Define defaults, acceptance criteria, and open decisions so implementation can be verified item-by-item.

Status vocabulary:
- `PENDING`
- `IN_PROGRESS`
- `IMPLEMENTED`
- `VERIFIED`
- `DEFERRED`

---

## 1) Source Box Editing (Editor-Like Behavior)

Status: `IMPLEMENTED`

- [ ] Drawn source boxes can be selected.
- [ ] Selected source boxes can be moved.
- [ ] Selected source boxes can be resized (handles/corners).
- [ ] Selected source boxes can be deleted.
- [ ] Movement/resizing snaps to pixel boundaries.
- [ ] Arrow keys nudge selected box by 1px.
- [ ] `Shift` + arrow keys nudges by larger step (recommended: 10px).
- [ ] Committed sprite boxes cannot overlap other committed sprite boxes.

Notes:
- Draft/temporary overlays (row drag, cut guides, current draft box) are allowed to overlap committed boxes.

---

## 2) Box Types + Overlay Semantics

Status: `IMPLEMENTED`

- [ ] Orange boxes = committed sprite boxes (auto-detected or manually added).
- [ ] Blue box = current draft box (editable before commit).
- [ ] Selected box state is visually distinct from both orange and blue.
- [ ] Overlay legend/hint is visible in Source Panel (or nearby status text).

Recommended colors:
- Committed sprite box: orange
- Draft box: blue
- Selected box: green/cyan accent
- Row drag region: distinct color (not orange/blue)
- Cut lines: distinct line style/color

---

## 3) Manual Add Fallback (Right-Click Context Menu)

Status: `IMPLEMENTED`

- [ ] Right-click on draft box opens source-panel context menu.
- [ ] Context menu includes `Add as 1 sprite` (or equivalent wording).
- [ ] Manual add appends to source sprite list (default behavior).
- [ ] Context menu includes `Add to selected row sequence` (enabled only when valid row target exists).
- [ ] Context menu includes `Delete draft`.

Decision (accepted):
- Default action is append to source sprite list only.
- Secondary action supports appending directly to selected row sequence.

---

## 4) Draft/Commit Workflow for Fast Multi-Add

Status: `IMPLEMENTED`

- [ ] Workbench supports rapid manual addition of multiple missed sprites in sequence.
- [ ] Draft (blue) and committed (orange) boxes are distinct states.
- [ ] Draft can be committed explicitly (`context menu` and/or `Enter`).
- [ ] Optional `Rapid Manual Add` mode exists (recommended) for fast repeated additions.

Open design details:
- [ ] Confirm exact rapid mode behavior (auto-commit on mouse-up vs next-draw start).
- [ ] Confirm visible mode indicator (`Rapid Manual Add` on/off).

Recommendation (accepted for now):
- Do not make implicit auto-commit the only behavior.
- Provide safe explicit commit + optional rapid mode for speed.

---

## 5) Anchor Box + Find Sprites Integration

Status: `IMPLEMENTED`

- [ ] Draft or committed box can be marked as anchor/reference bbox.
- [ ] `Find Sprites` uses anchor bbox when present.
- [ ] Anchor state is visually distinct from draft/committed/selected state.
- [ ] UI clearly indicates when `Find Sprites` will use an anchor.

Related context menu action:
- [ ] `Set as anchor for Find Sprites`
- [ ] `Pad bbox to anchor size`

---

## 6) Minimum Size Semantics

Status: `IMPLEMENTED`

- [ ] `Minimum Size` applies to auto-detection (`Find Sprites`).
- [ ] Manual `Add as 1 sprite` is not blocked by `Minimum Size`.
- [ ] Manual add can warn on unusually small box but still allow action.

Rationale:
- Manual fallback exists specifically to capture misses and edge cases.

---

## 7) Checkerboard Background Fix

Status: `IMPLEMENTED`

- [ ] Source Panel transparency/checkerboard background renders correctly.
- [ ] Checkerboard is visually distinct from magenta key-color and sprite pixels.
- [ ] Checkerboard remains visible under overlays/selection boxes without becoming noisy.

---

## 8) Semantic Grid Labels (Rows/Columns/Cells)

Status: `IN_PROGRESS`

- [ ] Grid rows have semantic angle labels (e.g. `Angle 0 (South)`).
- [ ] Grid columns have semantic frame labels (e.g. `Frame 0`).
- [ ] Cell labels/tooltips include both angle and frame semantics.
- [ ] Labeling follows template preset for angle names.

Open design details:
- [ ] Define angle-name presets for `1`, `4`, `8` angle layouts.
- [ ] Decide whether user can override/rename labels in MVP or later.

---

## 9) Source-Panel Row/Column Drag Modes (Slicing Assistance)

Status: `IMPLEMENTED`

- [ ] Add `Drag Row` mode in Source Panel.
- [ ] Source Panel instruction text updates based on active mode (e.g. `Drag over a row`).
- [ ] Row drag region overlay uses distinct styling.
- [ ] Row drag mode selects sprite boxes intersecting the drag region.

Phasing decision (accepted):
- Implement row-select first.
- Column-select can follow after row-select behavior is validated.

Future extension:
- [ ] `Drag Column` mode

---

## 10) Row Drag Selection Semantics (Batch Selection)

Status: `IMPLEMENTED`

Default behavior (recommended / accepted):
- [ ] Plain drag replaces selection.
- [ ] Selection hit-test uses `intersects` (not fully-contained).
- [ ] Plain click selects one box and clears others.
- [ ] `Cmd/Ctrl` + click toggles one box.
- [ ] `Shift` + drag adds intersecting boxes to selection.
- [ ] `Alt/Option` + drag subtracts intersecting boxes from selection.

Open refinement (optional after v1):
- [ ] Row-band bias to reduce over-selection from adjacent rows.

---

## 11) Cut-Line Insertion (Manual Slicing Guides)

Status: `IN_PROGRESS`

- [ ] Vertical cut insertion mode exists.
- [ ] Inserted cut lines are visible and editable/movable.
- [ ] Cut lines can be deleted.
- [ ] Cut lines snap to pixel boundaries.
- [ ] Cut lines have distinct visual style from sprite boxes and selection overlays.

Deferred / later:
- [ ] Horizontal cut insertion mode

Pushback (accepted):
- Do not use `Ctrl+B` for cut insertion in browser UI (conflicts with common shortcuts).

Recommended shortcuts:
- `X` = vertical cut mode
- `Shift+X` = horizontal cut mode (later)

---

## 12) Source-to-Grid Workflow Integration

Status: `IMPLEMENTED`

- [ ] Manual source boxes can be appended to source sprite list only (default).
- [ ] Manual source boxes can be appended to selected row sequence (secondary action).
- [ ] Selected source sprites (e.g. row-selected set) can be dragged and dropped onto a grid frame cell for batch insertion.
- [ ] Source-side selections integrate cleanly with grid-sequencing workflow.
- [ ] UI makes destination/target row clear before sequence append action.

Decision (accepted):
- `Add as 1 sprite` default = source list only.
- `Add to selected row sequence` = explicit alternate action.

---

## 13) Persistence and Undo/Redo Scope

Status: `IN_PROGRESS`

- [ ] Source-panel mutating actions participate in undo/redo:
  - [ ] draw draft box
  - [ ] move/resize/delete box
  - [ ] manual add sprite
  - [ ] set/change anchor
  - [ ] add/move/delete cut line
  - [ ] row drag selection changes (if treated as stateful)
- [ ] Current source annotations/cuts persist in saved workbench session (recommended).

Lower-priority / possibly deferred:
- [ ] Full undo/redo stack persistence across page reload

Recommendation:
- Persist state first; persist undo stack later if needed.

---

## 14) BBox Normalization and Padding Behavior

Status: `IMPLEMENTED`

Accepted defaults:
- [ ] Default manual add preserves exact bbox.
- [ ] Dragging/resizing snaps to pixel boundaries.
- [ ] Context menu offers `Pad this bbox to anchor size`.

Open design detail:
- [ ] If padded bbox exceeds sheet bounds, define clamp behavior (recommended: clamp to image bounds and preserve anchor intent as much as possible).

---

## 15) Visual Clarity + Overlay Layering

Status: `IMPLEMENTED`

- [ ] Overlays remain readable when many sprites are present.
- [ ] Z-ordering is consistent (draft vs committed vs selection vs cuts vs row drag region).
- [ ] Source panel status text reflects active mode and current action.

Recommended:
- [ ] Visible `Mode:` badge (e.g. `Mode: Draw Box`, `Mode: Drag Row`, `Mode: Vertical Cut`)

---

## 16) Keyboard Shortcuts and Mode Ergonomics (Industry-Style)

Status: `IMPLEMENTED`

Recommended MVP shortcut set:
- [ ] `V` = select/move/resize mode
- [ ] `B` = draw box mode
- [ ] `R` = drag row select mode
- [ ] `C` = drag column select mode (later)
- [ ] `X` = insert vertical cut mode
- [ ] `Shift+X` = insert horizontal cut mode (later)
- [ ] `Enter` = commit draft box
- [ ] `Esc` = cancel draft / exit transient action
- [ ] `Delete` / `Backspace` = delete selected object
- [ ] Arrow keys = nudge selected box 1px
- [ ] `Shift` + arrows = nudge selected box 10px

Notes:
- Avoid shortcut conflicts with common browser behaviors where practical.

---

## 17) Strongly Recommended Additions (Common-Sense UX)

Status: `DEFERRED`

- [ ] Source panel zoom
- [ ] Source panel pan
- [ ] Selected box numeric readout (`x, y, w, h`)

Rationale:
- Precise box edits and cut placement become frustrating without zoom/pan/readout.

---

## 18) Implementation Order (Agreed Working Plan)

Status: `IN_PROGRESS`

1. [ ] Source box object editing (`move/resize/delete`, no-overlap for committed boxes, arrow nudge)
2. [ ] Draft/commit model + context menu manual add (`Add as 1 sprite`, `Add to selected row sequence`, anchor/pad actions)
3. [ ] Checkerboard fix + overlay legend/colors
4. [ ] Semantic row/column/cell labels
5. [ ] `Drag Row` select mode + selection semantics + instruction text
6. [ ] Cut lines (vertical first), then column-select/cuts
7. [ ] Source zoom/pan + numeric bbox readout

---

## 19) Final Verification Gate (End of Work)

Status: `IN_PROGRESS`

- [ ] Every checklist item is marked `IMPLEMENTED` or `VERIFIED`, or explicitly `DEFERRED` with reason.
- [ ] A demo pass shows:
  - [ ] missed sprite manually added via right-click draft box
  - [ ] box move/resize/delete + keyboard nudge
  - [ ] row drag-select over orange boxes
  - [ ] semantic labels visible in grid
  - [ ] checkerboard background fixed
- [ ] Undo/redo validated for source-panel mutating actions implemented in this phase.
