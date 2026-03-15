# Claude Memory

Use this file as short-lived repo memory, not as proof over code.

## Startup

- Run `python3 scripts/conductor_tools.py status --auto-setup` first.
- Then run `python3 scripts/self_containment_audit.py`.
- Then read `docs/INDEX.md` and `docs/AGENT_PROTOCOL.md`.
- Then read `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md`.

## Current Milestone

- The current milestone is **functional XP-editor parity first**, not UX polish.
- "Done" for this milestone means the shipped workbench can load, edit, and export real multi-frame XP files with correct geometry, and that exported XP loads in the Skin Dock runtime.
- No XP fidelity harness exists yet. The previous blank-flow single-frame harness was deleted on 2026-03-15 because it flattened geometry, skipped layers, and misrepresented coverage. See `PLAYWRIGHT_FAILURE_LOG.md` for the full deletion record.
- UX/UI redesign to make the editor feel like REXPaint comes **after** capability parity is demonstrated and verified.

## Current High-Signal Truths

- As of the 2026-03-13 audit, the shared worktree at `/Users/r/Downloads/asciicker-pipeline-v2` was on `master` at `5caeb07` and should be treated as `stale/unknown` for bundle-restore truth until re-audited.
- Live workbench XP editing still runs through the legacy inspector in `web/workbench.js`; `EditorApp` is not embedded into shipped workbench on audited `master`.
- `EditorApp.undo()` / `redo()` are still TODO stubs in the audited codepath.
- Current JS XP codec code uses 10-byte REXPaint cells; older docs/tests may still mention 7-byte cells.
- `window.__wb_debug` is the live browser automation surface for the workbench inspector path.
- `workbench_upload_xp()` in `service.py` hardcodes `angles=1, anims=[1], projs=1` — it does not read geometry from the uploaded XP file. This is a blocking backend gap for any multi-frame XP load test.

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
