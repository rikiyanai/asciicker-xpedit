# Four Audits: XP Editor Parity — 2026-03-15

Date: 2026-03-15
Branch: master
HEAD: 034004ea30a75294e597897e6231d90c15a342b6
Governed by: docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md

---

## Audit Pass 1: Local Shipped Code Reality

### 1.1 New XP Authoring

**FAIL — No user-reachable new-XP authoring path exists on master.**

The `#btnNewXp`, width/height controls, `createBlankXp()`, and `/api/workbench/new-xp` endpoint
were all deleted in commit `034004e` because they only supported 1,1,1 geometry and served the
now-deleted harness. No replacement exists.

- Evidence: `web/workbench.html` — no `#btnNewXp` element
- Evidence: `web/workbench.js` — no `createBlankXp` function
- Evidence: `src/pipeline_v2/app.py` — no `/api/workbench/new-xp` route
- Category: **UI gap + backend gap**

### 1.2 Existing XP Load (Upload)

**FAIL — Upload discards all structure except L2 visual cells.**

`workbench_upload_xp()` at `service.py:1991-2090`:

- Reads the XP file correctly via `read_xp()` (line 1998)
- Reads `width`, `height`, `layer_count` (lines 2002-2004)
- **Discards all layers except layer 2** (lines 2012-2014): `visual_layer_idx = 2 if layer_count >= 3 else 0`
- Extracts only L2 cells into a flat list (lines 2018-2027)
- **Hardcodes geometry** (lines 2054-2062, 2074-2076):
  ```
  angles=1, anims=[1], projs=1
  cell_w=12, cell_h=12
  ```
- The comment at line 2041 explicitly says: "These metadata values are not derived from the uploaded XP file"
- Category: **Backend gap (critical, blocking)**

### 1.3 Session Data Model

**FAIL — Session stores only one flat cell list, not multi-layer.**

`WorkbenchSession` (referenced at line 2071-2082) contains:
- `grid_cols`, `grid_rows` — correct
- `cells` — single flat list of L2 cells only
- `angles=1`, `anims=[1]`, `projs=1` — hardcoded
- No multi-layer storage
- No frame/angle/projection indexing
- Category: **Backend gap (structural)**

### 1.4 Export

**FAIL — Export fabricates L0/L1/L3 from hardcoded templates.**

`workbench_export_xp()` at `service.py:1957-1988`:
- Reads session cells (L2 only) from JSON (lines 1965-1967)
- Calls `_build_native_layers()` (line 1976) which:
  - Calls `_build_native_l0_layer()` (line 1193): hardcoded metadata template with '8','1','8' / '2','4' / '1','F'
  - Calls `_build_native_l1_layer()` (line 1215): hardcoded 9-0 countdown pattern
  - Uses L2 from session cells
  - L3 is presumably also template-generated
- **The original file's L0, L1, L3 are completely lost** — replaced with templates
- This means: load an XP → export it → the exported file has different L0/L1/L3 than the original
- Category: **Export gap (critical, blocking)**

### 1.5 EditorApp Integration

**FAIL — EditorApp is 100% dead code in shipped workbench.**

- `web/workbench.html` — zero references to `EditorApp`, `editor-app`, or `rexpaint-editor`
- `web/workbench.js` — zero references to `EditorApp`, `editor-app`, or `rexpaint-editor`
- The EditorApp modules exist at `web/rexpaint-editor/` but are never imported/used
- All editing happens through the legacy inspector in `web/workbench.js`
- Category: **UI gap (structural)**

### 1.6 User-Reachable Editing Operations

**PARTIAL — Only L2 cell editing through inspector is reachable.**

What works through shipped controls:
- Upload PNG → pipeline conversion → session
- Upload XP → session (but with geometry/layer loss per 1.2)
- L2 cell editing via inspector (glyph, fg, bg per cell)
- Undo/redo for L2 cell edits
- Export to XP (but with fabricated L0/L1/L3 per 1.4)
- Skin Dock test (single-family, hardcoded geometry)

What is NOT reachable:
- Frame navigation / angle selection
- Layer switching (L0/L1/L3 editing)
- Multi-frame XP viewing
- Geometry-aware editing
- REXPaint-style tools (draw, fill, copy, paste, flip, rotate)
- Category: **UI gap (extensive)**

### 1.7 XP Codec Incompatibility

**FAIL — Python and JS XP codecs use incompatible binary formats.**

- Python codec (`src/pipeline_v2/xp_codec.py`): standard REXPaint format (gzip stream, version=-1, layer_count, per-layer w+h+cells)
- JS codec (`web/rexpaint-editor/xp-file-reader.js`, `xp-file-writer.js`): custom format (magic `0x50584552` "REXP", version, w, h, layerCount, per-layer gzip blocks)
- These cannot read each other's output
- Category: **Backend gap (blocking for any JS↔Python XP round-trip)**

### 1.8 Skin Dock / Runtime

**PARTIAL — Works for single-family L2-only sessions.**

- Skin Dock loads exported XP and applies to runtime
- Player movement verification works for the converted skin
- But: Skin Dock receives fabricated L0/L1/L3, not original file layers
- But: geometry is always 1,1,1 regardless of source file
- The runtime presumably uses L0 metadata and L1 frame indexing — if source file had different structure, the fabricated templates may cause runtime misbehavior
- Category: **Runtime gap (latent, blocked by export fabrication)**

---

## Audit Pass 2: Local Git History and Deleted-Harness Autopsy

### 2.1 How the Bad Harness Entered

The XP fidelity harness was introduced across 8 commits between 2026-03-14 00:53 and 03:07 (a 26-hour lifecycle before deletion):

- `c7c1528` — initial harness: `scripts/xp_fidelity_test/` with `truth_table.py`, `recipe_generator.py`, `run_fidelity_test.mjs`, `run.sh`
- Subsequent commits added: `create_fixture.py`, visual traces, screenshot systems, checkpoint analyzers, skin dock watchdog, conformance fixes, verdict structures
- The very first fixture (`sprites/fidelity-test-5x3.xp`) was a 5x3 synthetic single-layer file — scope was collapsed from minute zero

### 2.2 Scope Collapse Timeline

1. **Minute zero**: Fixture was 5×3, 1 layer, synthetic — never tested real multi-frame files
2. **Geometry hardcoded**: Backend `workbench_upload_xp()` already had `angles=1, anims=[1], projs=1` — harness never questioned this
3. **Layer-2-only targeting**: Recipe generator and verifier only compared L2 cells, listed L0/L1/L3 as `skipped_layers`
4. **Blank-flow substitution**: Harness created blank sessions via `#btnNewXp` instead of loading through upload path
5. **Transparent cell skipping**: Cells with transparent bg were excluded from comparison

### 2.3 Naming Overstatement

- Directory named `xp_fidelity_test` — implies full fidelity, actually single-frame single-layer smoke
- Commit messages used "fidelity" 10+ times for a narrow smoke test
- `PASS 9072/9072 cells match (100.00%)` reported as milestone evidence
- Planning docs described the harness with thoroughness that masked scope gaps

### 2.4 Seven Shortcut Patterns (Must Block in Future)

| # | Pattern | Commit Evidence | Status |
|---|---------|----------------|--------|
| 1 | Hardcoded 1,1,1 geometry | service.py:2055-2076 | Still present on master |
| 2 | Layer-2-only targeting | Deleted with harness at 034004e | Dead |
| 3 | Synthetic fixture substitution | Deleted with harness at 034004e | Dead |
| 4 | Blank-flow goal substitution | Deleted with harness at 034004e | Dead |
| 5 | Transparent cell skipping | Deleted with harness at 034004e | Dead |
| 6 | Reserved-word inflation ("fidelity") | Naming rules in acceptance contract | Governed |
| 7 | Plan-doc thoroughness masking scope | Audit protocol now requires evidence | Governed |

### 2.5 Corrective Action

- Commit `034004e` deleted the harness and introduced the acceptance contract
- `docs/XP_EDITOR_ACCEPTANCE_CONTRACT.md` explicitly forbids all 7 patterns
- **Remaining risk**: Pattern #1 (geometry hardcoding) persists in shipped code on master

---

## Audit Pass 3: Remote Branch and Ref Audit

### 3.1 Ref-by-Ref Table

| Ref | HEAD | Ahead of master | Key Changes | Proximity (1-10) | Recommendation |
|-----|------|----------------|-------------|-------------------|----------------|
| `origin/master` | `034004e` | 0 | Same as local master | 2 | Current base |
| `origin/feat/workbench-xp-editor-wireup` | `4b56684` | 2 | EditorApp modal integration, browser-compat fixes, openInspector rewrite (469 lines) | 4 | **SALVAGE** |
| `origin/feat/xp-fidelity-harness` | varies | N/A | Dead harness code (reverted by master) | 0 | **DO NOT REVIVE** |
| `origin/fix/solo-only-load-contract` | ancestor | 0 | Fully merged into master | N/A | Merged, ignore |
| `origin/restore/bundle-override-filter-8279e11` | ancestor | 0 | Fully merged into master | N/A | Merged, ignore |
| `origin/template-forcefit-next` | ancestor | 0 | Fully merged into master | N/A | Merged, ignore |
| `origin/experiment/render-gate-ab-matrix` | varies | N/A | Failed experiment, commit says "do not merge" | 0 | **DO NOT REVIVE** |

### 3.2 Salvage Candidate: feat/workbench-xp-editor-wireup

- 2 commits ahead of master at `4b56684`
- Adds EditorApp modal integration into workbench HTML/JS
- Browser-compat fixes for `editor-app.js`
- Rewrites `openInspector` to support EditorApp path
- **Does NOT fix geometry hardcoding** in `workbench_upload_xp()`
- **Does NOT add multi-layer session storage**
- Value: provides the UI wiring for EditorApp, which is prerequisite for REXPaint-parity UI
- Risk: EditorApp itself still uses the incompatible JS XP codec

### 3.3 Critical Gap Across All Refs

**No branch anywhere fixes the geometry hardcoding** (`angles=1, anims=[1], projs=1`) in `workbench_upload_xp()`. This is a blocking gap on every ref. It must be built from scratch.

### 3.4 Do Not Revive

- `feat/xp-fidelity-harness` — contains the exact bad harness that was deleted
- `experiment/render-gate-ab-matrix` — explicitly marked as failed experiment

---

## Audit Pass 4: Contract Cross-Check Matrix

### Hard-Fail Matrix Against Acceptance Contract

| Gate | Requirement | Current Master | Best Ref (wireup) | Evidence | Status | Blocker Category |
|------|-------------|---------------|-------------------|----------|--------|-----------------|
| **New XP Authoring** | Create XP with intended structure | No UI, no endpoint (deleted in 034004e) | No change | workbench.html, app.py — no new-xp path | **FAIL** | UI + backend |
| **Existing XP Load** | Preserve real structure on load | Discards L0/L1/L3, hardcodes 1,1,1 geometry | No change | service.py:2012-2014, 2074-2076 | **FAIL** | Backend (critical) |
| **Gate A: Geometry/Metadata** | Preserve angles/anims/projs/dimensions | Hardcoded to 1,1,1 regardless of file | No change | service.py:2055-2062 | **FAIL** | Backend (critical) |
| **Gate B: Layer Fidelity** | Preserve all layers | Only L2 extracted; L0/L1/L3 discarded on load, fabricated on export | No change | service.py:2012-2014, 1193-1231 | **FAIL** | Backend (critical) |
| **Gate C: Cell Fidelity** | Preserve all cell data correctly | L2 cells preserved; L0/L1/L3 cells lost | No change | service.py:2018-2027 (L2 only) | **FAIL** | Backend |
| **Gate D: UI Reachability** | Edit through shipped controls | L2-only inspector; no frame/layer/angle controls | EditorApp modal wired but codec incompatible | workbench.html, workbench.js — no EditorApp | **FAIL** | UI (structural) |
| **Gate E: Export Fidelity** | Export preserves structure | L0/L1 fabricated from templates; L2 from session; geometry hardcoded | No change | service.py:1957-1988, 1193-1231 | **FAIL** | Export (critical) |
| **Gate F: Runtime Load** | Exported XP works in Skin Dock | Works for fabricated single-family sessions | No change | Skin Dock accepts fabricated XP | **PARTIAL** | Runtime (latent) |
| **Gate G: Truthfulness** | No misleading naming | AGENT_PROTOCOL.md:17 still treats 1,1,1 as evidence | No change | AGENT_PROTOCOL.md line 17 contradicts acceptance contract | **FAIL** | Doc drift |
| **Frame Layout** | Preserve frame decomposition | Not implemented — flat grid only | No change | No frame navigation code in workbench.js | **FAIL** | UI + backend |
| **XP Codec Compat** | Python↔JS round-trip | Incompatible binary formats | No change | xp_codec.py vs xp-file-reader.js | **FAIL** | Backend (blocking) |

### Summary Counts

- **FAIL**: 10
- **PARTIAL**: 1 (runtime — works for fabricated sessions only)
- **PASS**: 0
- **UNKNOWN**: 0

### Overall Verdict

**FAIL** — The shipped workbench on master cannot satisfy any gate of the acceptance contract for real multi-frame XP files. The single partial (Skin Dock) only works because the export fabricates compliant-looking XP from templates, masking the actual data loss.

---

## Blocker Order (Severity-Ranked)

### Tier 1: Structural Backend Blockers (must fix first)

1. **B1: Upload geometry hardcoding** — `service.py:2055-2076` hardcodes `angles=1, anims=[1], projs=1`. Until fixed, no multi-frame XP can load correctly. **Backend gap.**

2. **B2: Upload layer discarding** — `service.py:2012-2014` extracts only L2. All other layers are lost on load. **Backend gap.**

3. **B3: Session model is single-layer** — `WorkbenchSession.cells` is a flat list for one layer. Must support multi-layer storage. **Backend gap.**

4. **B4: Export fabricates L0/L1/L3** — `service.py:1193-1231, 1976` replaces original layers with templates. Export must preserve original structure. **Export gap.**

### Tier 2: Format and Protocol Blockers

5. **B5: XP codec incompatibility** — Python codec (standard REXPaint) and JS codec (custom "REXP" magic) cannot read each other. Must unify on REXPaint standard format. **Backend gap.**

6. **B6: No frame layout / angle navigation** — No UI or backend code for frame decomposition, angle selection, or projection handling. **UI + backend gap.**

### Tier 3: UI and Integration Blockers

7. **B7: EditorApp not integrated** — `web/rexpaint-editor/` exists but is dead code in shipped workbench. `feat/workbench-xp-editor-wireup` branch has the wiring. **UI gap. Salvageable.**

8. **B8: No new-XP authoring path** — Deleted in 034004e. Must be rebuilt with real geometry support. **UI + backend gap.**

9. **B9: No multi-layer editing UI** — Inspector only edits L2. No layer switching, visibility toggling, or multi-layer tools. **UI gap.**

10. **B10: AGENT_PROTOCOL.md contradiction** — Line 17 treats blank-flow 1,1,1 as evidence, contradicting acceptance contract. **Doc drift.**

### Tier 4: Latent Runtime Blockers

11. **B11: Runtime with real geometry** — Skin Dock currently receives fabricated templates. Unclear if runtime handles real multi-frame geometry correctly. **Runtime gap (blocked by B1-B4).**

---

## Salvage and Dead-End Summary

### Best salvage base
`origin/feat/workbench-xp-editor-wireup` at `4b56684` — provides EditorApp modal wiring. Cherry-pick or rebase onto master AFTER backend blockers B1-B4 are resolved.

### Do not revive
- `feat/xp-fidelity-harness` — dead harness
- `experiment/render-gate-ab-matrix` — failed experiment

### Already merged (ignore)
- `fix/solo-only-load-contract`
- `restore/bundle-override-filter-8279e11`
- `template-forcefit-next`

---

## Recommended Implementation Order

1. Fix B1 (geometry hardcoding) — make `workbench_upload_xp()` read real geometry from XP file
2. Fix B2 (layer discarding) — extract and store all layers from uploaded XP
3. Fix B3 (session model) — extend `WorkbenchSession` to multi-layer
4. Fix B4 (export fabrication) — export from stored layers, not templates
5. Fix B5 (codec unification) — align JS codec with standard REXPaint format
6. Fix B10 (doc drift) — update AGENT_PROTOCOL.md section 0
7. Merge B7 (EditorApp wiring from wireup branch)
8. Build B6 (frame/angle navigation)
9. Build B8 (new XP authoring with real geometry)
10. Build B9 (multi-layer editing UI)
11. Validate B11 (runtime with real geometry)

---

## First Implementation Task

**Fix B1: Make `workbench_upload_xp()` read geometry from the XP file.**

The XP file's L0 layer contains metadata cells that encode `angles`, `anims`, `projs`. The upload function already calls `read_xp()` which returns all layer data. The fix is to:

1. Read L0 metadata cells after parsing
2. Derive `angles`, `anims`, `projs` from the metadata encoding
3. Use derived values instead of hardcoded `1,1,1`
4. Validate derived geometry against grid dimensions

This unblocks all downstream work.

## Resume Command

```bash
cd /Users/r/Downloads/asciicker-pipeline-v2
python3 scripts/conductor_tools.py status --auto-setup
python3 scripts/self_containment_audit.py
# Then: read this file and fix B1 first
```
