# Font-Only Reskin Prep Plan

Date: 2026-03-21

This document defines the safe presentation-only reskin surface for the workbench MVP.
A future reskin session follows this plan; this session produces the plan only.

## Safe Reskin Surface

A reskin is permitted **only** on these dimensions:

1. **Fonts / typography** — font-family stacks, font-size, font-weight, letter-spacing, line-height
2. **Colors** — CSS custom properties in `:root`, hardcoded hex colors in rules
3. **Spacing / borders** — padding, margin, gap, border-radius, border-color, border-width
4. **Background treatments** — gradients, panel backgrounds, overlay opacity

## Explicitly Forbidden

- DOM structure rewrites (adding/removing/reordering elements)
- Changing element `id` attributes (JS hooks depend on these)
- Changing element `class` names that JS references (e.g., `.hidden`, `.selected`, `.active`)
- Behavior-coupled layout changes (flex direction flips that break JS positioning)
- Adopting `www-server-mono` or any external site template as an app shell
- Replacing the workbench HTML files with different markup structures
- Modifying JS files for visual purposes

## CSS Entry Points

There are exactly 2 CSS files and 1 HTML with significant inline styles:

### `web/styles.css` (818 lines) — primary

The main workbench stylesheet. Contains:

| Token | Current value | Role |
|-------|---------------|------|
| `--bg` | `#0b0d10` | Page background |
| `--panel` | `#151922` | Panel background |
| `--fg` | `#e8edf3` | Primary text |
| `--muted` | `#8ea0b3` | Secondary text |
| `--ok` | `#37c47a` | Success indicators |
| `--warn` | `#f3b63f` | Warning indicators |
| `--err` | `#f15a5a` | Error indicators |
| `--accent` | `#4ea1ff` | Accent / selection |

Font stack (4 occurrences): `ui-monospace, Menlo, Consolas, monospace`

All CSS custom properties are in `:root` (lines 1-10). A reskin can change these values without touching any other rules.

Hardcoded hex colors exist throughout (~80 rules). A thorough reskin would extract these to additional custom properties, but that's optional — changing `:root` values covers the major visual tone.

### `web/rexpaint-editor/styles.css` (328 lines) — editor modal

The REXPaint editor modal stylesheet. Uses a different visual language:
- Font: `'Courier New', monospace` (3 occurrences)
- Color palette: `#ffb86c` accent, `#1e1e1e` / `#2d2d2d` grays, `#90ee90` green
- No CSS custom properties — all colors are hardcoded

A reskin should add `:root` custom properties to this file to align it with the main stylesheet palette.

### `web/termpp_skin_lab.html` (~7 inline styles)

Contains inline `style=` attributes. These are minimal and mostly layout-related. A reskin can override them via CSS specificity without touching the HTML.

### `web/workbench.html` (~23 inline style occurrences)

Inline `style=` attributes on various elements. Same approach — override via CSS, do not edit the HTML for visual changes.

### `web/wizard.html` (1 inline style)

Legacy wizard page. Minimal inline styling.

## Font Inventory

Current font stacks in use:

| Location | Stack | Suggested replacement |
|----------|-------|-----------------------|
| `styles.css` body + info bars | `ui-monospace, Menlo, Consolas, monospace` | Custom monospace web font or keep as-is |
| `rexpaint-editor/styles.css` modal | `'Courier New', monospace` | Align with main stack |
| `rexpaint-editor/styles.css` glyph buttons | `monospace` | Align with main stack |
| `termpp_skin_lab.html` inline | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace` | Align with main stack |

No `@font-face` declarations or external font imports exist. The app uses only system monospace fonts. A reskin could add a web font via `@font-face` in `styles.css` and reference it in the stack.

## Reskin Execution Plan (for a future session)

1. Update `:root` custom properties in `web/styles.css` for the target palette
2. Add `:root` custom properties to `web/rexpaint-editor/styles.css`
3. Replace hardcoded hex colors in both CSS files with `var(--token)` references where practical
4. Unify font-family stacks across all CSS files (optionally add `@font-face`)
5. Adjust border-radius, spacing, and border-color tokens as needed
6. Test: load workbench, verify all panels render, verify editor modal opens, verify whole-sheet editor renders, verify no JS console errors

## Files a Future Reskin Would Touch

| File | Change type |
|------|-------------|
| `web/styles.css` | Edit `:root` vars, replace hardcoded colors, unify fonts |
| `web/rexpaint-editor/styles.css` | Add `:root` vars, replace hardcoded colors, unify fonts |

That's it. No HTML changes. No JS changes. No new files required unless adding a web font asset.

## Behavior Preservation Guarantee

If the reskin follows this plan:
- All DOM ids remain unchanged → JS hooks work
- All class names remain unchanged → JS selectors work
- No layout direction changes → positioning logic works
- No element addition/removal → event handlers work
- The workbench, editor modal, whole-sheet editor, and skin lab all render identically in structure, differing only in visual presentation
