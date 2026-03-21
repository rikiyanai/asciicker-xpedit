# Milestone 2: PNG Fixture Inventory

Date: 2026-03-21
Audit by: Claude agent (read-only)
Branch: master @ 2a43c2b

---

## Summary

- **Total PNGs in repo**: ~1,570
  - SMALLTESTPNGs/: 53 files (source sprite sheets, screenshots, test patterns, AI-generated)
  - tests/fixtures/: 2 files (1 known_good, 1 known_bad)
  - fixtures/: 1 PNG file (+ 2 XP files)
  - data/previews/: ~65 files (session preview renders — runtime artifacts)
  - data/uploads/: ~90 files (uploaded PNG copies — runtime artifacts)
  - output/: ~1,290 files (Playwright screenshots — test artifacts)
  - runtime/: ~58 files (CP437 font atlases, app icon — engine assets)
  - node_modules/: 1 file (playwright icon — ignored)

---

## 1. Existing Fixture Inventory

### A. Formal Test Fixtures (`tests/fixtures/` and `fixtures/`)

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `tests/fixtures/known_good/cat_sheet.png` | 192x48 | 278 B | test-pattern | 8 blue-dot-on-white frames in a 1x8 strip. Used by existing tests. |
| `tests/fixtures/known_bad/all_black.png` | 192x48 | 107 B | test-pattern (negative) | Solid black. Known-bad rejection test. |
| `fixtures/player-sprite.png` | 32x32 | 201 B | player-like (single frame) | Tiny pixel-art humanoid. Single idle frame facing south. |

### B. Candidate Sprite Sheets (`SMALLTESTPNGs/`)

#### Player-like (idle/walk animation sheets)

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/player-0100.png` | 3024x1920 | 42 KB | **player (canonical)** | Full 8-angle x 16-frame player sprite sheet. Rendered from `player-0100.xp`. Black background. THE canonical player reference PNG. |
| `SMALLTESTPNGs/wolack-0101.png` | 3840x2496 | 60 KB | **player-mounted (canonical)** | Mounted player (wolack family). 8-angle multi-frame layout. Black background. |
| `SMALLTESTPNGs/skeleton-bgfix5.png` | 1536x1536 | 33 KB | player-like | Skeleton humanoid, 8-angle x 8-frame walk cycle. Magenta (#FF00FF) background — good for keying. |
| `SMALLTESTPNGs/Skeleton.png` | 128x256 | 4.7 KB | player-like | Skeleton on olive/teal checkerboard background. 4 angles x 8 frames. Small per-frame dims. |
| `SMALLTESTPNGs/werewolf-NESW.png` | 144x256 | 3.7 KB | player-like | Werewolf sprite sheet. 4 angles (N/E/S/W) x ~4 frames. Black background. Small. |
| `SMALLTESTPNGs/spritesheet_50x50.png` | 250x400 | 31 KB | player-like | Yellow silhouette humanoid. 5 columns x 8 rows. White background. Walk/run/jump poses. |
| `SMALLTESTPNGs/fairy.png` | 236x472 | 120 KB | player-like | Fairy character, walk/idle animations. Transparent background. Multiple rows of animation. |
| `SMALLTESTPNGs/sprPonyTemplateOH.png` | 305x394 | 48 KB | player-like | Pony/chibi template with many animation rows. White/light background. |

#### Attack-like (weapon swings, combat)

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/knight.png` | 160x384 | 7.8 KB | attack-like | Knight with sword, multiple attack/walk poses. 4 cols x 8 rows. Transparent bg. |
| `SMALLTESTPNGs/skeleton spritesheet calciumtrice.png` | 320x160 | 5.4 KB | attack-like | Skeleton with weapon/shield. Combat poses. White background. |

#### Death-like (death/collapse animations)

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| (none identified) | — | — | — | No PNG in the repo clearly contains a death-only animation sequence. |

#### Multi-sprite / creature sheets

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/minidaemon.png` | 288x256 | 99 KB | creature-sheet | Daemon sprites, combat/walk. Black background. Multiple angles. |
| `SMALLTESTPNGs/midi-bn.png` | 352x288 | 35 KB | creature-sheet | Bear-like creature. Multi-angle walk/combat. Black background. |
| `SMALLTESTPNGs/deer male calciumtrice.png` | 160x160 | 3 KB | creature-sheet | Deer sprite, 4 angles x walk frames. White/transparent bg. |
| `SMALLTESTPNGs/rat and bat spritesheet calciumtrice.png` | 320x320 | 7.2 KB | creature-sheet | Rats and bats, many frames. White bg. Two creature types mixed. |
| `SMALLTESTPNGs/596f9f989c0da07e7348af5d327e0cea.png` | 576x256 | 90 KB | creature-sheet | Chibi/RPG characters. Dark clothing. Black background. 8+ angles. |
| `SMALLTESTPNGs/cooker_render_v5.png` | 192x768 | 74 KB | object-sheet | Cooker/furnace object. 8 angles, magenta bg. Not a character. |
| `SMALLTESTPNGs/cooker-split_spritesheet/car000-008.png` | 102x102 each | ~2 KB each | object-single-frame | Pre-split cooker frames. 9 files. Single frame each. |

#### Test pattern / synthetic

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/single_frame_1x1.png` | 24x24 | 5.6 KB | test-pattern | Single small colorful frame. |
| `SMALLTESTPNGs/grid_explicit_4x2.png` | 34x24 | 6.5 KB | test-pattern | 4x2 grid of tiny colored cells. |
| `SMALLTESTPNGs/ multiframe_strip_1x4.png` | 34x12 | 5.4 KB | test-pattern | 1x4 horizontal strip of tiny frames. Leading space in filename. |
| `SMALLTESTPNGs/ grid_auto_known.png` | 42x12 | 5.1 KB | test-pattern | Auto-grid detection test input. Leading space in filename. |
| `SMALLTESTPNGs/perfect-pixel-scaled-x12.png` | 288x288 | 5.6 KB | test-pattern | Pixel art scaled up 12x. Tests pixel-grid detection. |

#### AI-generated / reference (not practical for pipeline testing)

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/ChatGPT Image Jan 24, 2026 at 01_02_57 PM.png` | 1536x1024 | 2.7 MB | AI-generated | Large AI character art. Not a sprite sheet. |
| `SMALLTESTPNGs/ChatGPT Image Jan 24, 2026 at 01_03_10 PM Background Removed.png` | 1536x1024 | 1.3 MB | AI-generated | Same with bg removed. |
| `SMALLTESTPNGs/ChatGPT Image Feb 13, 2026 at 01_12_20 PM.png` | 1536x1024 | 1.7 MB | AI-generated | AI character art. |
| `SMALLTESTPNGs/Gemini_Generated_Image_ftaa3ftaa3ftaa3f.png` | 2528x1696 | 9.2 MB | AI-generated | Very large. |
| `SMALLTESTPNGs/Gemini_Generated_Image_ftaa3ftaa3ftaa3f_corrected.png` | 2528x1696 | 6.8 MB | AI-generated | Corrected version. |
| `SMALLTESTPNGs/Gemini_Generated_Image_653mno653mno653m.png` | 1248x848 | 2.3 MB | AI-generated | Large. |
| `SMALLTESTPNGs/Gemini_Generated_Image_w2iipfw2iipfw2ii.png` | 2816x1536 | 4.7 MB | AI-generated | Large. |
| `SMALLTESTPNGs/manul.png` | 1536x1024 | 1.5 MB | AI-generated | Manul cat, not a sprite. |
| `SMALLTESTPNGs/manull.png` | 288x288 | 91 KB | other | Smaller version. |

#### Screenshots / debug captures

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/Screenshot 2026-02-06 at 04.38.24.png` | 382x896 | 361 KB | screenshot | UI capture |
| `SMALLTESTPNGs/Screenshot 2026-02-06 at 04.38.32.png` | 242x998 | 159 KB | screenshot | UI capture |
| `SMALLTESTPNGs/Screenshot 2026-02-07 at 15.29.13.png` | 536x232 | 79 KB | screenshot | UI capture |
| `SMALLTESTPNGs/Screenshot 2026-02-09 at 01.03.28.png` | 66x102 | 19 KB | screenshot | Small capture |
| `SMALLTESTPNGs/Screenshot 2026-02-09 at 02.43.49.png` | 410x366 | 34 KB | screenshot | UI capture |
| `SMALLTESTPNGs/Screenshot 2026-02-11 at 15.38.17.png` | 1188x966 | 76 KB | screenshot | UI capture |
| `SMALLTESTPNGs/Screenshot 2026-02-13 at 12.57.22.png` | 258x274 | 89 KB | screenshot | UI capture |
| `SMALLTESTPNGs/Screenshot 2026-02-13 at 12.58.35.png` | 90x96 | 21 KB | screenshot | Small capture |
| `SMALLTESTPNGs/Screenshot 2026-02-22 at 00.46.13.png` | 1390x910 | 111 KB | screenshot | UI capture |
| `SMALLTESTPNGs/SpikeyAndDodecahedron_Snapshot-1.png` | 523x493 | 54 KB | screenshot/render | 3D render capture |

#### Other / miscellaneous

| Path | Dims | Size | Category | Notes |
|------|------|------|----------|-------|
| `SMALLTESTPNGs/ .png` | 800x533 | 397 KB | unknown | Leading-space filename. Generic photo? |
| `SMALLTESTPNGs/Old English Text MT Regular 400.png` | 868x100 | 13 KB | font-sample | Font rendering sample. |
| `SMALLTESTPNGs/Unknown.png` | 306x306 | 40 KB | unknown | Content unclear from metadata. |
| `SMALLTESTPNGs/Game Boy Advance - Pokemon Mystery Dungeon...Tauros.png` | 389x304 | 24 KB | external-sprite | Pokemon sprite rip. Copyright concerns. |

### C. Runtime / Infrastructure PNGs (not fixtures)

| Directory | Count | Purpose |
|-----------|-------|---------|
| `runtime/termpp-skin-lab-static/*/fonts/` | ~56 | CP437 font atlases (4x4 through 40x40). Engine assets. |
| `runtime/termpp-skin-lab-static/*/asciicker.png` | 2 | App icon (256x256). |
| `data/previews/` | ~65 | Session preview renders. Generated at runtime. |
| `data/uploads/` | ~90 | Uploaded PNG copies. Generated at runtime. |
| `output/` | ~1,290 | Playwright test screenshots. Test artifacts. |

---

## 2. Recommended Baseline Fixture Set for M2-A

The M2-A non-regression test needs PNG fixtures that exercise the structural PNG-to-bundle pipeline for each enabled family. Based on the inventory:

### Tier 1: Must-have (commit to `tests/fixtures/baseline/`)

| Family | Recommended Source | Current Path | Action |
|--------|-------------------|--------------|--------|
| **player** | `player-0100.png` | `SMALLTESTPNGs/player-0100.png` | Copy to `tests/fixtures/baseline/player-sheet.png`. Canonical 8-angle x 16-frame player sheet rendered from known-good XP. |
| **attack** | `knight.png` | `SMALLTESTPNGs/knight.png` | Copy to `tests/fixtures/baseline/attack-sheet.png`. Small (7.8 KB), has weapon/combat poses, 4 directions, transparent bg. |
| **plydie** | `skeleton-bgfix5.png` | `SMALLTESTPNGs/skeleton-bgfix5.png` | Copy to `tests/fixtures/baseline/death-sheet.png`. Visually a walk cycle (categorized as player-like in section 1B), but used here because no dedicated death-animation PNG exists in the repo. For M2-A structural baseline testing, visual content category is irrelevant — what matters is exercising the plydie family pipeline path with a PNG of suitable dimensions. Magenta bg for keying. |
| **negative (known-bad)** | `all_black.png` | `tests/fixtures/known_bad/all_black.png` | Already exists. Keep for rejection tests. |
| **edge case (single frame)** | `single_frame_1x1.png` | `SMALLTESTPNGs/single_frame_1x1.png` | Copy to `tests/fixtures/baseline/single-frame.png`. Minimal viable input. |

### Tier 2: Recommended additions (cover edge cases)

| Purpose | Recommended Source | Notes |
|---------|-------------------|-------|
| **Transparent background** | `fairy.png` (236x472) | Tests alpha-channel handling in pipeline. |
| **White background** | `deer male calciumtrice.png` (160x160) | Tests non-black, non-magenta background handling. |
| **Pre-split single frames** | `cooker-split_spritesheet/car000.png` (102x102) | Tests single-frame-per-file workflow. |
| **Large AI-generated** | Any Gemini/ChatGPT image | Tests pipeline resilience to non-sprite-sheet input. May be too large (MB range). |
| **Mounted/multi-entity** | `wolack-0101.png` (3840x2496) | Tests mounted player family when wolack support is added. |

---

## 3. Gaps Identified

### Critical gaps (blocking M2-A)

1. **No dedicated death/plydie PNG fixture exists.** None of the PNGs in the repo are explicitly a death-animation-only sheet. The `skeleton-bgfix5.png` has walk cycles; it could serve as a structural test input for the `plydie` family pipeline path even though the visual content is walking, not dying. Alternatively, a death sequence needs to be created or sourced.

2. **No attack-only PNG fixture.** `knight.png` has sword but is a mixed walk/attack sheet. The pipeline's `attack` family path needs at least one input that clearly exercises the attack template geometry. Again, for structural baseline (M2-A), visual content accuracy is not required; any PNG of suitable dimensions works.

3. **Existing formal fixtures are insufficient.** The `tests/fixtures/` directory has only `cat_sheet.png` (test pattern, not a real sprite) and `all_black.png` (rejection test). Neither exercises the actual sprite-to-bundle pipeline.

4. **`fixtures/player-sprite.png` is too small.** At 32x32 (single frame), it cannot exercise the multi-angle, multi-frame grid assembly that the player bundle requires.

### Non-critical gaps

5. **No PNG with magenta keying for player family.** All player-family PNGs use black background. A magenta-bg player PNG would test the background removal path.

6. **No standardized naming convention.** Files in `SMALLTESTPNGs/` have inconsistent names (spaces, leading spaces, mixed case, UUID hashes). Baseline fixtures should use clean `kebab-case` names.

7. **No test manifest.** No file maps PNGs to their expected pipeline behavior (which family, expected frame count, expected angle count, expected pass/fail).

8. **Font PNGs are duplicated.** `runtime/termpp-skin-lab-static/termpp-web-flat/fonts/` and `runtime/termpp-skin-lab-static/termpp-web-flat/fonts/fonts/` contain identical CP437 font atlases (duplicate nesting).

---

## 4. Acceptance Criteria for M2-A PNG Baseline Regression Test

A future `tests/test_png_bundle_baseline.py` (or equivalent) should verify:

### Per-family structural checks

For each enabled bundle family (`player`, `attack`, `plydie`):

1. **Upload**: PNG file is accepted by `/api/upload` or `workbench_upload_png()` without error
2. **Bundle create**: `bundle_create()` succeeds for the target family template
3. **Action-grid apply**: `bundle_action_run()` succeeds, producing a valid session with XP data
4. **Structural gates pass**: G10 (dimension match), G11 (layer count), G12 (L0 metadata) all pass
5. **Export succeeds**: `export_xp()` produces a valid XP byte stream
6. **XP roundtrip**: exported XP can be re-loaded via `workbench_upload_xp()` without error
7. **Non-empty content**: at least one cell in the exported XP has non-default (non-transparent) content

### Negative checks

8. **Known-bad rejection**: `all_black.png` is rejected or produces a valid-but-empty result (not a crash)
9. **Oversized input**: a very large PNG (>2000px) does not crash the pipeline (may produce degraded output)

### Fixture contract

10. **Deterministic**: same input PNG produces structurally identical output on repeated runs
11. **Self-contained**: all fixture PNGs are committed to the repo, not loaded from external paths
12. **Documented**: each fixture has a one-line description of its purpose in the test or a manifest file

### What the baseline does NOT verify

- Visual fidelity of the converted sprites
- Correct auto-slicing or frame detection
- Correct semantic region labeling
- Skin Dock runtime rendering (that is M2-A.4, separate)

---

## 5. Recommended Actions

1. **Create `tests/fixtures/baseline/` directory** with clean copies of the recommended Tier 1 fixtures
2. **Create a fixture manifest** (`tests/fixtures/baseline/MANIFEST.md` or `.json`) mapping each file to its intended family, expected behavior, and origin
3. **Write `tests/test_png_bundle_baseline.py`** using the Tier 1 fixtures, verifying the 12 acceptance criteria above
4. **Source or create a death-animation PNG** for the plydie family — even a synthetic one (recolor a walk cycle) is better than nothing for structural testing
5. **Clean up SMALLTESTPNGs/** — files with leading spaces in names will cause issues in scripts and CI

---

## File Count Summary

| Location | PNG Count | Size (approx) | Status |
|----------|-----------|----------------|--------|
| SMALLTESTPNGs/ | 53 | ~89 MB | Unorganized candidate pool |
| tests/fixtures/ | 2 | <1 KB | Minimal; insufficient for M2-A |
| fixtures/ | 1 | 201 B | Single-frame only |
| data/previews/ | ~65 | ~2.5 MB | Runtime artifact (gitignored via `data/`) |
| data/uploads/ | ~90 | ~69 MB | Runtime artifact (gitignored via `data/`) |
| output/ | ~1,290 | varies | Test screenshots |
| runtime/ | ~58 | ~170 KB | Engine assets (fonts, icons) |
| **Total** | **~1,559** | | |
