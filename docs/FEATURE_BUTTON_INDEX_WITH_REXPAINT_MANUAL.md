# Historical Feature Index + REXPaint Manual Reference

> Status: non-canonical reference only.
>
> This file is **not** an implementation-status doc and **not** the spec for the shipped
> workbench editor. Earlier revisions overstated live integration, test status, and
> feature completeness for `web/rexpaint-editor/*`. Those claims should not be reused.
>
> Use these docs instead for current direction and acceptance:
>
> - `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
> - `docs/REXPAINT_UI_COMPLETE_INDEX.md`
> - `docs/COMPLETE_UI_CONTROL_REFERENCE.md`
> - `docs/REXPAINT_PARITY_EDITOR_SURFACE_SPEC.md` once approved
>
> Current truth on `master`:
>
> - the shipped workbench still uses the legacy frame inspector path
> - `web/rexpaint-editor/*` exists but is not integrated into the shipped workbench
> - JS XP file I/O in `web/rexpaint-editor/*` is not the current source of truth for product parity

**Generated:** 2026-03-09  
**Corrected:** 2026-03-15

---

## Purpose

This file preserves two useful things:

1. a historical index of planned / module-level REXPaint-style features
2. a compact reference copy of REXPaint manual/UI notes gathered during research

It does **not** prove:

- live workbench integration
- passing end-to-end tests
- feature completeness
- milestone completion

---

## 1. Historical Module Inventory

The following items describe functionality that exists in the standalone
`web/rexpaint-editor/*` module set, or functionality that was planned for that module.
They are **not** guarantees about the shipped workbench UI on `master`.

### XP File Reading

- Related code:
  - `web/rexpaint-editor/xp-file-reader.js`
  - `web/rexpaint-editor/editor-app.js` (`loadXPFile`)
- Historical intent:
  - read XP headers and layers
  - decompress gzip content
  - parse cells and resize the standalone canvas
- Caution:
  - this is not proof of browser-ready, shipped workbench file I/O parity

### XP File Writing

- Related code:
  - `web/rexpaint-editor/xp-file-writer.js`
  - `web/rexpaint-editor/editor-app.js` (`saveAsXP`)
- Historical intent:
  - export layers from the standalone editor module
  - encode XP cell data
  - return downloadable binary output
- Caution:
  - this is not proof of live workbench export parity

### Roundtrip Validation

- Historical intent:
  - load -> edit -> save -> load verification inside the standalone editor path
- Caution:
  - this is not an authoritative product-verification result for current `master`

---

## 2. Historical Feature List

This section is preserved as a feature vocabulary/reference list. Status marks from
older revisions were removed because they overstated current product reality.

### Standard Editor Features

- New
- Open
- Save
- Save As
- Undo
- Redo
- Copy
- Paste

### Drawing Tools

- Cell
- Line
- Rect
- Oval
- Fill
- Text
- Select

### Layer Management

- New Layer
- Delete Layer
- Duplicate
- Merge Down
- Show / Hide

### View Controls

- Zoom In
- Zoom Out
- Fit Canvas
- Pan

### Color + Palette

- Palette
- Color Picker
- Swap FG/BG
- Default Colors

---

## 3. Historical Watchdog Note

Earlier revisions of this file claimed broad watchdog success for XP file I/O and
EditorApp integration. Those claims are not authoritative for current `master` and
should not be used as implementation evidence.

If verification status is needed, use:

- current code audit
- current commit evidence
- current verification commands
- `PLAYWRIGHT_FAILURE_LOG.md`

---

## 4. REXPaint v1.70 Manual Reference

### Overview

REXPaint is an ASCII art editor for creating and manipulating character-based artwork.
It supports layered images, independent glyph/foreground/background editing, drawing
tools, palette manipulation, and export to multiple formats.

### Core Features

REXPaint supports:

- independent editing of characters, foreground colors, and background colors
- shape and text drawing tools (cell, line, rectangle, oval, fill, text)
- copy/cut/paste functionality with undo/redo
- live preview of effects via cursor hovering
- palette manipulation and color tweaking
- multi-layer image composition
- viewport navigation and dynamic scaling
- compressed native `.xp` file format

### Canvas Management

- resize images and manage canvas dimensions
- pan the viewport with drag/navigation controls
- edit on a whole-sheet canvas rather than frame-by-frame modal inspection

### Drawing Tools

- Cell Mode
- Line
- Rectangle
- Oval
- Fill
- Text
- Select

### Behavior Themes Worth Preserving In The Web Port

- whole-sheet editing as the primary interaction model
- independent apply channels for glyph / foreground / background
- visible glyph chooser rather than numeric-code-only entry
- multi-layer editing with active-layer and visibility controls
- direct pointer-driven editing with keyboard shortcuts

---

## 5. How To Use This File Safely

Use this file for:

- vocabulary
- manual-reference reminders
- historical module inventory

Do not use this file for:

- milestone status
- live feature status
- parity claims
- implementation sign-off

For the canonical editor-surface spec, use:

- `docs/REXPAINT_PARITY_EDITOR_SURFACE_SPEC.md`
