# REXPaint Parity Editor Surface Spec

Date: 2026-03-15
Status: draft revised with product-owner decisions

## 1. Scope

This document defines the canonical editor-surface target for milestone work on the XP
editor.

The target is:

- a whole-sheet XP editor
- user-reachable through shipped workbench controls
- behaviorally aligned with the REXPaint editing model where it matters for parity

This document does not describe:

- current implementation status
- test status
- bundle/runtime verification
- legacy frame-inspector behavior except where it constrains migration

## 2. Primary Editing Model

The primary editing surface must be a single whole-sheet canvas representing the full
XP image at once.

Normative requirements:

- the whole-sheet canvas is the primary place where cell edits occur
- the user must not be forced into per-frame modal editing for ordinary work
- frame tiles may remain visible, but only as navigation/preview support
- the legacy frame inspector is transitional only and is not the parity target

The editor must preserve the atlas-wide view of the XP while still exposing frame and
angle structure.

## 3. Primary Layout

The milestone-1 layout must include these regions:

1. Left sidebar
- visual CP437 glyph picker
- tool selector
- foreground/background controls
- apply-mode toggles
- layer list and active-layer controls

2. Center editing surface
- whole-sheet canvas
- visible grid overlay option
- hover feedback and selection overlays
- pan and zoom behavior

3. Secondary navigation region
- frame grid or equivalent atlas navigator
- selecting a frame must focus/navigate the whole-sheet surface to that region
- selecting a frame must not redefine the frame grid as the main editor

4. Status region
- current cell position
- active tool
- active apply modes
- active layer
- current glyph / fg / bg

## 4. Required Tools

Milestone 1 required tools:

- Cell draw
- Select
- Line
- Rect
- Fill
- Text
- Eyedropper
- Erase

Milestone 1 tool behavior requirements:

- tools must operate on the whole-sheet canvas
- hover preview is required for shape tools and text placement where practical
- right-click eyedropper behavior should match REXPaint expectations where possible
- erasing must honor the XP/editor transparency contract rather than silently painting a random placeholder state

Deferred beyond milestone 1:

- Oval
- auto-wall / auto-box behavior
- advanced global replace tools
- used-glyph highlighting

## 5. Layer Behavior

Layer behavior must be explicit and user-reachable.

Required behavior:

- the editor must display the real XP layer stack for loaded/uploaded sessions
- active layer and visible layers must be separate concepts
- the active layer determines where edits land
- visible layers determine composite rendering
- the UI must expose layer visibility toggles
- the UI must expose active-layer switching
- the UI must prevent accidental edits to hidden/non-active layers through clear state feedback

Milestone 1 minimum operations:

- activate layer
- show/hide layer
- view full stack

Milestone 1 required operations:

- activate layer
- show/hide layer
- lock/unlock layer
- view full stack
- add layers as needed to reach the required XP structure

Milestone 1 not required unless product owner promotes them:

- layer reorder
- merge down
- duplicate layer

If a layer is preserved-only for runtime contract reasons, the UI must make that clear.

## 6. Apply Modes

REXPaint-style apply-channel behavior is mandatory.

Required channels:

- Glyph
- Foreground
- Background

Required behavior:

- channels can be toggled independently
- a tool applies only the enabled channels
- solo/toggle behavior must be visible in the UI
- eyedropper must update glyph and colors in a way consistent with active editing state

Milestone 1 acceptance examples:

- glyph-only drawing changes glyph without changing fg/bg
- fg-only drawing changes foreground without changing glyph/bg
- bg-only drawing changes background without changing glyph/fg
- combined modes apply all selected channels together

## 7. Navigation, Pan, and Zoom

Whole-sheet navigation is required.

Required behavior:

- the canvas supports pan/drag
- the canvas supports zoom in, zoom out, and fit/reset behavior
- frame-grid selection must focus or pan the whole-sheet viewport to the selected frame region
- zoom must not change document structure, only view scale
- grid overlay toggle must be user-reachable

Milestone 1 minimum:

- mouse or pointer pan gesture
- keyboard-assisted pan mode if practical
- at least one reliable fit/reset control

## 8. Selection Semantics

Selection is rectangular by default.

Required behavior:

- create rectangular selection on whole-sheet canvas
- move/copy/cut/paste selected region
- delete/clear selection contents
- selection preview must be visible before commit where movement/transform is involved
- selection operations must respect active layer and apply modes

Milestone 1 required transforms:

- paste
- delete/clear
- horizontal flip
- vertical flip

Deferred unless explicitly promoted:

- rotate selection
- arbitrary multi-selection
- global replace within selection

## 9. Shortcuts

Milestone 1 shortcut set must be small, stable, and REXPaint-aligned where reasonable.

Required shortcuts:

- `c` Cell
- `s` Select
- `l` Line
- `r` Rect
- `i` Fill
- `t` Text
- `g` toggle Glyph apply
- `f` toggle Foreground apply
- `b` toggle Background apply
- `Ctrl/Cmd+Z` Undo
- `Ctrl/Cmd+Y` Redo
- `Ctrl/Cmd+C` Copy
- `Ctrl/Cmd+X` Cut
- `Ctrl/Cmd+V` Paste
- `Delete` clear selection
- `Space` temporary pan mode if implemented

REXPaint manual precedence applies to shortcut conflicts. In particular:

- `i` is Fill
- `f` is Foreground apply

## 10. Frame Grid Behavior

The frame grid is secondary navigation, not the main editor.

Required behavior:

- frame tiles reflect atlas/frame structure
- selecting a frame updates navigation/focus state for the whole-sheet canvas
- frame tiles may support preview, selection, and metadata context
- primary edits do not require opening a separate frame editor

Forbidden milestone drift:

- treating frame-tile double-click + modal inspector as the parity target
- requiring per-frame modal entry for ordinary painting

## 11. Milestone 1 Definition

Milestone 1 is achieved only when all of the following are true:

- the shipped workbench exposes a whole-sheet editor surface
- the surface is user-reachable
- the surface supports both new-file authoring and existing-file editing
- loaded/uploaded XP sessions hydrate from real backend truth
- the user can edit on the whole sheet with required milestone tools
- apply modes work
- active layer / visible layer behavior is correct
- frame grid acts as navigator/preview, not primary editor
- exported XP preserves structure and layers through the backend truth path
- the result also passes Test Skin Dock / runtime acceptance for the workflow under test

Milestone 1 required acceptance scenarios:

1. New-file bundle authoring through shipped UI:
- start from a new file
- create the correct structure
- recreate the three sprite animations required for the bundle:
  - idle
  - attack
  - death
- produce the correct XP outputs through reachable UI actions
- pass Test Skin Dock/runtime

2. Existing-file reconstruction through shipped UI:
- import a blank single-layer XP file, initially with the wrong simple structure (for example a 2x2 cell-size starting point)
- through reachable UI actions, change dimensions to the correct structure
- add the required layers
- recreate the required contents on each layer
- produce the correct bundle XP result
- pass Test Skin Dock/runtime

Milestone 1 is not achieved by:

- making the legacy inspector less broken
- proving isolated module behavior in `web/rexpaint-editor/*`
- passing a narrow harness that does not reflect the whole-sheet target

## 12. Deferred Beyond Milestone 1

Deferred by default:

- full REXPaint browse mode
- alternate export formats beyond required XP/product paths
- font switching
- advanced palette management files
- layer reorder/merge/duplicate if not needed for immediate parity gate
- rotate selection if not needed for immediate parity gate
- oval and other lower-priority tools
- nonessential cosmetic/theme parity

## 13. Open Questions

- Which exact shortcut resolves the `Fill` vs `Foreground apply` conflict in the shipped UI?
- Should milestone 1 include layer locking, or is active-layer plus visibility feedback sufficient?
- Are horizontal/vertical flip mandatory in milestone 1, or acceptable in the next increment after basic selection copy/paste/delete?
- Does milestone 1 require direct new-file authoring from this surface, or only loaded/uploaded XP editing through the shipped workbench path?
