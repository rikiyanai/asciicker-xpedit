# Claude Memory

Use this file as short-lived repo memory, not as proof over code.

## Startup

- Run `python3 scripts/conductor_tools.py status --auto-setup` first.
- Then run `python3 scripts/self_containment_audit.py`.
- Then read `docs/INDEX.md` and `docs/AGENT_PROTOCOL.md`.
- Then read `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`.

## Current Milestone

- The current milestone is **REXPaint parity first**, not "functioning somehow first" and not UX polish after a narrowed substitute.
- "Done" for this milestone means the shipped workbench can load, edit, and export real multi-frame XP files with correct geometry through a **whole-sheet, user-reachable XP editor surface** that matches the real REXPaint interaction model closely enough to count as parity, and that exported XP loads in the Skin Dock runtime.
- The legacy frame-by-frame inspector in `web/workbench.js` is not the target editor model for parity. It is legacy behavior and may be used only as supporting/diagnostic context while the whole-sheet editor path is built.
- Any harness that depends on the legacy frame inspector or API scaffolding is diagnostic only; it is not parity proof.
- The previous blank-flow single-frame harness was deleted on 2026-03-15 because it flattened geometry, skipped layers, and misrepresented coverage. See `PLAYWRIGHT_FAILURE_LOG.md` for the deletion record and the later strict-diagnostic restore note.
- UX/UI polish follows parity, but the editor model itself (whole-sheet REXPaint-style editing instead of frame-by-frame inspection) is part of parity, not post-parity polish.

## Current High-Signal Truths

- As of the 2026-03-13 audit, the shared worktree at `/Users/r/Downloads/asciicker-pipeline-v2` was on `master` at `5caeb07` and should be treated as `stale/unknown` for bundle-restore truth until re-audited.
- Live workbench XP editing still runs through the legacy inspector in `web/workbench.js`; `EditorApp` is not embedded into shipped workbench on audited `master`.
- The correct direction is to pivot away from the legacy frame inspector as the primary editor path and toward a whole-sheet XP editor aligned with the REXPaint UI docs, using the debug/legacy grid as navigation/preview support rather than the main editing model.
- `EditorApp.undo()` / `redo()` are still TODO stubs in the audited codepath.
- Current JS XP codec code uses 10-byte REXPaint cells; older docs/tests may still mention 7-byte cells.
- `window.__wb_debug` is the live browser automation surface for the workbench inspector path.
- `workbench_upload_xp()` geometry hardcoding was a blocking backend gap; after the 2026-03-15 B1 patch, geometry should be re-audited as L0-derived instead of assumed stale.

## Do Not Assume

- Do not assume `master` contains the known-good bundle restore line.
- Do not treat March 4-10 editor plan docs as shipped-state truth without checking current code.
- Do not use editor test counts as verification evidence until the CommonJS/ESM runner mismatch is fixed.
- Do not reference sibling repos or external absolute paths for runtime/build/test fixes; self-containment is enforced by `scripts/self_containment_audit.py`.
- Do not assume external folders like `asciicker-Y9-2` are available. All assets must be committed to this repo.
- Do not call any test "XP fidelity" unless it loads real XP through the product path, validates all layers and metadata, and verifies Skin Dock runtime load.

## First Reads By Topic

- XP editor acceptance contract: `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`
- Four-audit restart handoff: `docs/2026-03-15-CLAUDE-HANDOFF-FOUR-AUDITS-XP-EDITOR.md`
- Hard-fail implementation plan: `docs/plans/2026-03-15-xp-editor-hard-fail-plan.md`
- Editor/doc alignment: `docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md`
- Claim verification: `docs/research/ascii/2026-03-13-claim-verification.md`
- Bundle/runtime restore history: `docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md`
- Bundle animation types & expansion: `docs/research/ascii/2026-03-20-bundle-animation-types.md`
