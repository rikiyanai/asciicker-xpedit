# Docs Index

Canonical doc hub for agents working in `/Users/r/Downloads/asciicker-pipeline-v2`.

## Non-Negotiable Constraints

- **Self-containment**: This repo must be 100% self-contained. No runtime, test, or build-time dependency on external folders (e.g. `/Users/r/Downloads/asciicker-Y9-2`, `/Users/r/Downloads/n`).
- All sprites, runtime assets, `.web` files, `.a3d` maps, fonts — everything the workbench needs must live inside this repo.
- Symlinks pointing outside the repo are violations.

## Current Branch Truth

- Audit date: 2026-03-21
- Audited worktree: `/Users/r/Downloads/asciicker-pipeline-v2`
- Audited branch: `master`
- Audited HEAD: `2a43c2b`
- Current branch role: active XP-editor Phase 4 acceptance line
- **Self-containment**: This repo must be 100% self-contained. No runtime, test, or build-time dependency on external folders (e.g. `/Users/r/Downloads/asciicker-Y9-2`, `/Users/r/Downloads/n`). Run `python3 scripts/self_containment_audit.py` at startup.

Do not assume `master` is the canonical restore/bundle line. For bundle/runtime issues, read the branch-history handoff below before making fix claims.

## Canonical Read Order

1. `AGENTS.md`
2. this file
3. `docs/AGENT_PROTOCOL.md`
4. `CLAUDE.md`
5. current live branch/worktree state
6. latest task-relevant handoff
7. focused subsystem docs and plan docs

If a lower-priority doc conflicts with a higher-priority source or with current code, treat the lower-priority doc as historical until corrected.

## Current Milestone

- The overall product goal remains **full XP-file editor parity** as defined in `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`.
- The current working milestone is **Milestone 1: bundle-native new-XP authoring viability**.
- Milestone 1 means:
  - create and edit the required native bundle actions (`idle`, `attack`, `death`) through shipped whole-sheet workbench controls
  - preserve required structure and layers
  - export/apply correctly into Skin Dock/runtime
  - support a usable authoring loop for save/export/test
  - pass canonical verifier evidence plus final manual/runtime review
- Milestone 1 does **not** mean full existing-XP load/edit/export parity is complete.
- A canonical XP verifier family now exists in `scripts/xp_fidelity_test/`, including bundle workflow runners. Do not reuse the deleted blank-flow single-frame harness as evidence.
- Do not start broader REXPaint UX/UI redesign as if full parity is already proven. The current work is Phase 4 acceptance, responsiveness, and repeatability on the bundle-native line.
- If Milestone 1 closes, the next milestone is **Milestone 2: practical PNG ingest and manual assembly**, not "perfect automatic slicing."

## Explicit Milestone Definitions

### Milestone 1: bundle-native new-XP authoring viability

Milestone 1 is complete only when all of the following are true:

- shipped whole-sheet controls can create/edit the required native bundle actions:
  - `idle`
  - `attack`
  - `death`
- the bundle workflow preserves the intended structure, layers, and export/runtime contract
- the authoring loop is usable enough for normal work:
  - save
  - export
  - test/apply
- canonical verifier evidence passes in an acceptance-eligible mode, with final signoff coming from `full_recreation`
- manual/runtime review and repeatability are good enough to support an honest milestone-close claim

Milestone 1 is **not**:

- full existing-XP load/edit/export parity
- full REXPaint feature parity
- generalized PNG slicing correctness

### Milestone 2: practical PNG ingest and manual assembly

Milestone 2 begins only after Milestone 1 closes.

Milestone 2 is complete only when all of the following are true:

- the arbitrary-PNG structural ingest baseline is protected by a non-regression contract and test path
- uploaded PNG workflows are practical through shipped controls:
  - source-panel bbox extraction
  - manual source-to-grid assembly
  - whole-sheet correction/editing
- auto-slicing/analyze are assistive hints, not authoritative truth
- canonical human-verified semantic dictionaries exist for the enabled native families
- semantic editing can safely build on those dictionaries

Milestone 2 is **not**:

- perfect automatic slicing for arbitrary sprite sheets
- full existing-XP parity
- full REXPaint parity

## Structural Contracts

- `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md`
  - non-regression contract for the arbitrary-PNG structural ingest baseline; protects the Milestone 1 structural checkpoint (PNG → bundle apply → valid XP → editor load/export → runtime-safe injection) during Milestone 2 work
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
  - canonical acceptance contract for XP-editor parity

## First Reads By Task

### Any agent startup

- `AGENTS.md`
- `docs/AGENT_PROTOCOL.md`
- `CLAUDE.md`
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- `python3 scripts/conductor_tools.py status --auto-setup`
- `python3 scripts/self_containment_audit.py`

### Editor/doc status or plan audits

- `docs/research/ascii/2026-03-13-claim-verification.md`
- `docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md`

### Bundle/runtime/restore regressions

- `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
- `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`

## Active High-Signal Docs

- `docs/2026-03-20-CLAUDE-HANDOFF-PHASE-4-ACCEPTANCE-STRICT.md`
  - primary fresh-session resume point for Phase 4; separates manual-only `T` review from real acceptance evidence and defines the remaining acceptance/responsiveness/repeatability work
- `docs/2026-03-18-CLAUDE-HANDOFF-BUNDLE-RUNTIME-STRICT.md`
  - historical strict handoff for the Phase 1-3 bundle runtime blocker path; no longer the primary resume point after the Phase 4 handoff above
- `docs/2026-03-18-CLAUDE-HANDOFF-BUNDLE-RUNTIME-AND-WHOLE-SHEET-VISIBILITY.md`
  - softer context handoff retained for continuity; superseded as the primary resume doc by the strict 2026-03-18 handoff above
- `docs/2026-03-17-CLAUDE-HANDOFF-WHOLE-SHEET-STROKE-PATH.md`
  - latest resume point for the whole-sheet stroke-end perf fix, current open risks, and next blocker ordering
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
  - canonical acceptance contract; this is the source of truth for what counts as XP-editor parity and what shortcuts are forbidden
- `docs/2026-03-15-CLAUDE-HANDOFF-FOUR-AUDITS-XP-EDITOR.md`
  - restart handoff requiring four full audits across local code, local history, remote refs, and contract cross-checking
- `docs/2026-03-15-CLAUDE-HANDOFF-WHOLE-SHEET-REXPAINT-PIVOT.md`
  - current next-step handoff: keep backend geometry fixes, stop optimizing the legacy frame inspector as the parity path, and pivot to auditing the whole-sheet REXPaint editor integration
- `docs/research/ascii/2026-03-15-xp-data-contract.md`
  - canonical code-backed XP data contract: binary format, layer roles, frame layout, geometry derivation, confirmed contradictions, and unknowns
- `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md`
  - active hard-fail plan replacing the deleted single-frame harness plan
- `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`
  - next-step roadmap after Milestone 1: preserve the arbitrary-PNG structural baseline, center PNG workflows on source-panel/manual assembly, promote whole-sheet correction, and add human-verified semantic dictionaries
- `docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md`
  - current Claude resume point for doc alignment and editor-status truth
- `docs/research/ascii/2026-03-13-claim-verification.md`
  - evidence-backed audit of recent Claude/editor document claims against current code
- `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
  - historical branch/bundle handoff; still important for restore-line truth, but not the default source for editor implementation status on `master`
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-embedded-editor-plan.md`
  - design brief only; not shipped-state truth
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-grid-editor-integration.md`
  - accurate legacy-inspector analysis; not proof of `EditorApp` embedding
- `docs/plans/2026-03-04-web-rexpaint-editor/xp-editor-feature-inventory.md`
  - historical feature inventory with 2026-03-13 audit corrections

## Historical Handoff Docs

Some untracked March 14 handoff docs in local worktrees may still reference the deleted blank-flow
single-frame harness. Treat them as obsolete. Do not use any document as an "XP fidelity" plan or
resume point unless it explicitly says it loads real XP through the product path and hard-fails on
metadata, layer, visual, export, and Skin Dock/runtime mismatches.

## REXPaint Reference & UI Docs

- `docs/REXPAINT_UI_COMPLETE_INDEX.md`
  - REXPaint v1.70 complete UI index extracted from live screenshots; reference implementation, not asciicker-specific
- `docs/FEATURE_BUTTON_INDEX_WITH_REXPAINT_MANUAL.md`
  - feature button reference + REXPaint v1.70 manual text; references `EditorApp` methods but these describe the standalone module, not proof of live workbench integration
- `docs/COMPLETE_UI_CONTROL_REFERENCE.md`
  - 189 workbench UI elements + REXPaint manual appendix; notes Section 14 (inspector) planned for replacement by `EditorApp`

## Editor Planning & Research

- `docs/plans/2026-03-04-web-rexpaint-editor/claude-workbench-ui-inventory.md`
  - exhaustive workbench.html/js UI element inventory (189 elements, handler-level detail)
- `docs/plans/2026-03-04-web-rexpaint-editor/claude-cp437-font-research.md`
  - CP437 bitmap font rendering research; lists font atlas filenames (cp437_8x8 through cp437_40x40); recommends Canvas 2D pre-tinted atlas caching
- `docs/2026-03-10-readonly-investigation-rexpaint-state.md`
  - readonly investigation of standalone `EditorApp` module; historical — see 2026-03-13 audit banner for current caveats
- `docs/2026-03-10-DELIVERABLE-AUDIT-REPORT.md`
  - deliverable audit identifying XP cell format mismatch; Issue 1 (7-byte vs 10-byte) superseded by `a26be4a`

## Bundle & Animation Research

- `docs/research/ascii/2026-03-20-bundle-animation-types.md`
  - complete map of all 5 player sprite families (player, attack, plydie, wolfie, wolack), AHSW equipment encoding, current bundle-template coverage, gameplay trigger states, and remaining expansion priorities; note the browser debug override lists still lag the server-side ternary W generation
- `docs/research/ascii/2026-03-21-player-sprite-semantic-dictionary-seed.md`
  - seed semantic dictionary for `player-0100.xp` L2 with verified glyph inventory, face/shirt/pants/boots region labels, palette-role mapping, and a proposed machine-readable schema for future agent-driven sprite edits
- `docs/research/ascii/semantic_maps/` — machine-readable JSON semantic dictionaries
  - `schema.json` — JSON Schema for the semantic dictionary format
  - `player-0100.json` — fully populated player sprite semantic dictionary (frame 0 idle + frame 1 walk)
  - `attack-0001.json` — attack sprite semantic dictionary with weapon region (frame 0)
  - `plydie-0000.json` — death sprite semantic dictionary (frame 0)

## Milestone 2 Implementation

- `docs/plans/2026-03-21-milestone-2-practical-png-ingest-plan.md`
  - strategic plan for Milestone 2: defines the milestone explicitly, preserves the structural baseline, centers on manual assembly, and promotes whole-sheet editing
- `docs/plans/2026-03-21-milestone-2-implementation-checklist.md`
  - implementation-ready checklist with explicit Milestone 1/Milestone 2 boundary, EXISTS/PARTIAL/MISSING status per item, file:line references, and wave ordering
- `docs/PNG_STRUCTURAL_BASELINE_CONTRACT.md`
  - non-regression contract for the PNG structural ingest path (also linked under Structural Contracts above)

## Local / Untracked Research (not committed)

The following files exist in this worktree but are not committed to `master`. They are research output and should be read with caution — the `findings/INDEX.md` summary shows 4 of 11 findings were contradicted by code inspection.

- `REXPAINT_LIBRARY_AUDIT_FINDINGS.md`
  - audit of 30+ REXPaint libraries across 6 languages; recommends rexpaintjs-fork (JS), pyrexpaint (Python)
- `findings/INDEX.md`
  - findings index (11 findings: 5 verified, 4 contradicted, 1 partial, 1 verified-with-gaps)
- `findings/09-FINDING-rexpaint-manual-coverage.md`
  - REXPaint manual coverage analysis (~94 features, 50-55% implemented)
- `findings/10-FINDING-xp-editor-feature-audit.md`
  - 67-feature audit: 38 fully implemented (56.7%), 3 partial, 26 missing
- `findings/11-FINDING-manual-gaps-checker.md`
  - 37 additional REXPaint features not covered in the 67-feature audit

## Font & Palette Assets

### Font assets (present)

13 CP437 PNG font atlases are present in the runtime tree at two locations:
- `runtime/termpp-skin-lab-static/termpp-web-flat/fonts/cp437_{4x4..40x40}.png` (with BDF/PSF metadata)
- `runtime/termpp-skin-lab-static/termpp-web/fonts/cp437_{4x4..40x40}.png` (PNGs only, no metadata)
- Build output copies also exist in `output/termpp-skin-lab-static/`

Font loader: `web/rexpaint-editor/cp437-font.js` accepts a spritesheet URL at construction time (16x16 glyph grid layout).

### Palette assets (not present)

No distinct palette asset files (`.pal`, `palette.json`, etc.) exist in the repo. Palette management is entirely code-based via `web/rexpaint-editor/palette.js` (RGB arrays in memory, no file persistence). If REXPaint `.pal` import/export is needed, it would require new code.

## Known Doc Caveats

- `CLAUDE.md` and `docs/INDEX.md` were missing before the 2026-03-13 doc-alignment pass; older handoffs may say they are absent.
- Some tests and docs still contain obsolete 7-byte XP assumptions even though current JS XP codec code uses 10-byte REXPaint cells. Three test files (`tests/web/rexpaint-editor-xp-file-{reader,writer,integration}.test.js`) construct actual 7-byte binary XP blobs in their fixtures — this is a deferred code issue.
- All editor test files use ESM `import` statements but the repo's `package.json` declares `"type": "commonjs"`, so direct `node tests/...` execution fails with `SyntaxError`.
- `EditorApp` and the whole-sheet surface exist in `web/rexpaint-editor/*` and `web/whole-sheet-init.js`, and current shipped grid actions now focus the whole-sheet editor first. The legacy inspector still exists as a fallback/debug path and remains a Milestone 2 demotion target.
- The finding that the editor modal/UI is still incomplete for REXPaint-parity goals remains valid; existence of whole-sheet integration does not mean full parity is proven.
- XP-file fidelity is not proven end-to-end. No canonical test exists. The deleted harness was not a valid fidelity test — see `PLAYWRIGHT_FAILURE_LOG.md`.
- Self-containment is now machine-enforced via `scripts/self_containment_audit.py` and installable git hooks in `.githooks/`. Blocking findings are external symlinks and live/build/runtime/test references to absolute paths outside this repo.
