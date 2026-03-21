# Semantic Edit API — Test Matrix

Date: 2026-03-21
Status: draft
Depends on: `docs/plans/2026-03-21-semantic-edit-api-design.md`, semantic maps at `docs/research/ascii/semantic_maps/`

---

## Conventions

- **Session setup**: Unless stated otherwise, tests load a session from the family's
  reference XP via the existing `workbench_upload_xp()` flow. The session holds the
  parsed layers; the semantic map JSON is loaded from disk by `semantic_edit.py`.
- **Layer**: All recolor operations target `semantic_layer: 2` as declared in each map.
- **Color notation**: `#rrggbb` hex strings in map data; `(r, g, b)` integer triples in
  API parameters. Both representations refer to the same color space.
- **Frame 0 idle cells**: Cell coordinates and colors cited below come from the annotated
  `frames["0"]` in each semantic map. The recolor algorithm walks the full layer grid, not
  just annotated cells, so "cells changed" counts in production will be higher than the
  annotated sample.

---

## 1. `get_semantic_regions(session_id)`

### T1.1 — Player family returns correct regions

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. Family resolves to `"player"`. |
| **Input** | `get_semantic_regions(session_id)` |
| **Expected behavior** | Response contains `family: "player"`, `reference_xp: "sprites/player-0100.xp"`, `semantic_layer: 2`. `regions` list contains exactly 5 entries with names `["shirt", "pants", "boots", "skin", "hair"]` (order not significant). |
| **Expected per-region fields** | `shirt`: `palette_roles: ["shirt_primary"]`, `colors: {"shirt_primary": ["#aa00aa"]}`, `confidence: "high"`, `description: "Purple torso garment fill — used as both fg and bg on shirt cells"`. `pants`: `palette_roles: ["pants_dark", "pants_bright"]`, `colors: {"pants_dark": ["#0000aa"], "pants_bright": ["#5555ff"]}`, `description: "Dark blue lower garment — appears as fg on pants cells and belt transition"` (from pants_dark; pants_bright: `"Bright blue pants highlight/shading variant"`). `boots`: `palette_roles: ["boots_primary"]`, `colors: {"boots_primary": ["#aa5500"]}`, `description: "Brown boot/footwear foreground color"`. `skin`: `palette_roles: ["skin"]`, `colors: {"skin": ["#ff5555"]}`, `description: "Flesh tone for face, exposed arm edges, and neck transition"`. `hair`: `palette_roles: ["hair"]`, `colors: {"hair": ["#000000"]}`, `description: "Black hair — appears as foreground color on head/hair cells via half-block glyphs"`. |
| **Expected warnings/errors** | None. |

### T1.2 — Attack family returns correct regions including weapon

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/attack-0001.xp`, obtain `session_id`. Family resolves to `"attack"`. |
| **Input** | `get_semantic_regions(session_id)` |
| **Expected behavior** | Response contains `family: "attack"`. `regions` list contains exactly 6 entries: `["shirt", "pants", "boots", "skin", "hair", "weapon"]`. |
| **Expected per-region fields** | All body regions same as T1.1 except: `skin` has `description: "Flesh tone — same role as player family; appears as bg on face cells and as fg on shirt/arm transition cells"`. `pants_dark` has `description: "Dark blue pants — same role as player family"`. `pants_bright` has `description: "Bright blue pants highlight — same role as player family"`. `boots_primary` has `description: "Brown boots — same role as player family"`. `hair` has `description: "Black hair — same role as player family"`. Additionally: `weapon`: `palette_roles: ["weapon_light", "weapon_dark"]`, `colors: {"weapon_light": ["#aaaaaa"], "weapon_dark": ["#555555"]}`, `confidence: "high"`, `description: "Light gray weapon blade/metal — attack-family specific"` (from weapon_light; weapon_dark: `"Dark gray weapon handle/shadow — attack-family specific"`). |
| **Expected warnings/errors** | None. |

### T1.3 — Plydie family returns correct regions (no weapon)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/plydie-0000.xp`, obtain `session_id`. Family resolves to `"plydie"`. |
| **Input** | `get_semantic_regions(session_id)` |
| **Expected behavior** | `regions` list contains exactly 5 entries: `["shirt", "pants", "boots", "skin", "hair"]`. No `weapon` region. |
| **Expected per-region fields** | `shirt`: `description: "Purple torso — same role as player family"`. `pants` (pants_dark): `description: "Dark blue pants — same role as player family"`. `pants` (pants_bright): `description: "Bright blue pants highlight — same role as player family"`. `skin`: `description: "Flesh tone — same role as player family"`. `skin_detail`: `description: "Dark red face detail — used for ^ expression glyph in death pose"`. `hair`: `description: "Black hair — same role as player family"`. `boots`: `description: "Brown boots — same role as player family"`. |
| **Expected warnings/errors** | None. |

### T1.4 — Unknown session_id returns structured error

| Field | Value |
|-------|-------|
| **Setup** | No session created. |
| **Input** | `get_semantic_regions("nonexistent-session-id-999")` |
| **Expected behavior** | No regions returned. |
| **Expected warnings/errors** | `{"error": "session_not_found", "session_id": "nonexistent-session-id-999"}` |

---

## 2. `recolor_region(session_id, region, target_color, scope)` — Happy path

### T2.1 — Shirt recolor on player

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | All cells on layer 2 whose fg or bg matches `#aa00aa` (shirt_primary) are recolored. The `usage` for `shirt_primary` is `"both"`, so both fg and bg channels matching `#aa00aa` are replaced with `(0, 170, 0)`. In frame 0: cells (2,4), (3,4), (4,4), (2,5), (3,5), (4,5) have shirt_primary in fg or bg. Belt transition cell (3,6) has `bg: #aa00aa` which IS shirt_primary — its bg changes, but its fg (`#0000aa`, pants_dark) does NOT change. Arm cells (1,5) and (5,5) have fg `#ff5555` (skin) and bg `#ffff55` (subcell_fill) — neither matches shirt_primary, so arms are NOT touched. `changed_cells > 0`, `changed_frames` includes all frames across all angles. |
| **Expected response fields** | `resolved_palette_roles: ["shirt_primary"]`, `original_colors: {"shirt_primary": ["#aa00aa"]}`, `target_color: (0, 170, 0)`. |
| **Expected warnings/errors** | Warning from ambiguities: `"Belt transition cell (3,6) uses shirt_primary bg bleeding into pants_dark fg — a 'change shirt color' edit should include this cell's bg but a 'change pants color' edit should include this cell's fg"` (verbatim from semantic map, since it mentions `shirt_primary`). Warning: `"Transition cells with mixed roles detected in {N} cells"` for cells where one channel matches shirt_primary and the other matches a different role. |

### T2.2 — Pants recolor on player

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="pants", target_color=(0, 100, 0), scope="whole_sprite")` |
| **Expected behavior** | Resolves to roles `["pants_dark", "pants_bright"]`. All cells with fg or bg matching `#0000aa` (pants_dark, usage `"fg"`) have fg replaced. All cells with fg or bg matching `#5555ff` (pants_bright, usage `"both"`) have matching channels replaced. In frame 0: cell (3,6) belt transition has fg `#0000aa` — its fg changes. Cell (4,6) has fg `#0000aa` — changes. Cells (2,7), (4,7) have fg `#0000aa` and bg `#5555ff` — both channels change. Cell (2,6) has fg `#5555ff` — changes. The bg `#aa00aa` on cell (3,6) is shirt_primary and is NOT touched. |
| **Expected response fields** | `resolved_palette_roles: ["pants_dark", "pants_bright"]`, `original_colors: {"pants_dark": ["#0000aa"], "pants_bright": ["#5555ff"]}`. |
| **Expected warnings/errors** | Warning from ambiguities mentioning pants_dark or belt transition. Transition cell warning for belt cell (3,6) where bg is shirt_primary. |

### T2.3 — Boots recolor on player

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="boots", target_color=(170, 0, 0), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["boots_primary"]`. Usage is `"fg"`. All cells with fg matching `#aa5500` are replaced. In frame 0: cells (2,8) and (4,8) have fg `#aa5500` — both change. The bg `#000000` on those cells is outline, not boots — it does NOT change. |
| **Expected response fields** | `resolved_palette_roles: ["boots_primary"]`, `original_colors: {"boots_primary": ["#aa5500"]}`. |
| **Expected warnings/errors** | None expected (no ambiguity text mentions `boots_primary`). |

### T2.4 — Skin recolor on player

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="skin", target_color=(200, 150, 100), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["skin"]`. Usage is `"bg"`. All cells with bg matching `#ff5555` are replaced. In frame 0: cell (3,2) eyes — bg changes. Cell (3,3) mouth — bg changes. Cell (3,4) neck_transition — fg is `#ff5555` but skin usage is `"bg"`, so fg is NOT changed (fg `#ff5555` on a bg-only role stays). Arm cells (1,5) fg `#ff5555` — same rule: fg not changed for bg-only role. Note: `skin_detail` (`#aa0000`) is excluded from v1 targeting and is NOT touched. |
| **Expected response fields** | `resolved_palette_roles: ["skin"]`, `original_colors: {"skin": ["#ff5555"]}`. |
| **Expected warnings/errors** | Warning from ambiguities: `"Arm cells at shirt edges (1,5) and (5,5) in idle use skin fg on subcell_fill bg — they belong to both 'skin' and 'shirt' semantically; recoloring shirt should NOT touch these arm cells"` (mentions skin). Transition cell warning for cells where one channel is skin and the other is a different role. |

### T2.5 — Hair recolor on player

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="hair", target_color=(139, 69, 19), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["hair"]`. Usage is `"fg"`. All cells with fg matching `#000000` where the color is the `hair` role color are replaced. **Critical edge case**: `#000000` is also the `outline` role color. Both `hair` and `outline` map to `#000000`. The algorithm matches by color value, not by semantic role, so ALL fg `#000000` cells — including outline and eye cells — will be recolored. This is a known limitation of v1's color-matching approach. In frame 0: cell (3,1) hair_cap fg `#000000` — changes. Cell (3,2) eyes fg `#000000` — also changes (collision with outline). |
| **Expected response fields** | `resolved_palette_roles: ["hair"]`, `original_colors: {"hair": ["#000000"]}`. |
| **Expected warnings/errors** | Transition cell warnings expected due to many mixed-role cells. The `outline` role also uses `#000000` — ambiguity warning about color collision is warranted if the implementation detects shared colors across roles. |

### T2.6 — Weapon recolor on attack

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/attack-0001.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="weapon", target_color=(255, 215, 0), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["weapon_light", "weapon_dark"]`. `weapon_light` colors `["#aaaaaa"]` usage `"fg"` — all fg `#aaaaaa` cells change. `weapon_dark` colors `["#555555"]` usage `"both"` — all fg and bg `#555555` cells change. In frame 0: cells (6,0) blade_top_left fg `#aaaaaa` — changes. (7,0) blade_top_right fg `#555555` — changes. (6,1) blade_mid fg `#aaaaaa` and bg `#555555` — both change. (5,2) guard fg `#aaaaaa` — changes, bg `#000000` (outline) — no change. (6,2) blade_lower fg `#555555` — changes. (5,3) handle bg `#555555` — changes, fg `#000000` — no change. |
| **Expected response fields** | `resolved_palette_roles: ["weapon_light", "weapon_dark"]`, `original_colors: {"weapon_light": ["#aaaaaa"], "weapon_dark": ["#555555"]}`. |
| **Expected warnings/errors** | Warning from ambiguities: `"Weapon region overlaps with head/face area at x=5 — the guard cell (5,2) is adjacent to face cells; recoloring weapon should not touch face skin"` (mentions weapon). |

---

## 3. `recolor_region` — Rejection cases

### T3.1 — REJECT: weapon recolor on player (region not present)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. Family is `"player"`. |
| **Input** | `recolor_region(session_id, region="weapon", target_color=(255, 0, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. Session state unchanged. |
| **Expected warnings/errors** | `{"error": "unknown_region", "region": "weapon", "family": "player", "valid_regions": ["shirt", "pants", "boots", "skin", "hair"]}` |

### T3.2 — REJECT: unknown region name

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="cape", target_color=(255, 0, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "unknown_region", "region": "cape", "family": "player", "valid_regions": ["shirt", "pants", "boots", "skin", "hair"]}` |

### T3.3 — REJECT: invalid RGB triple (negative value)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(-1, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "invalid_color", "message": "Each RGB component must be in [0, 255]; got (-1, 170, 0)"}` |

### T3.4 — REJECT: invalid RGB triple (value > 255)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 300, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "invalid_color", "message": "Each RGB component must be in [0, 255]; got (0, 300, 0)"}` |

### T3.5 — REJECT: invalid RGB triple (wrong length)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "invalid_color", "message": "target_color must have exactly 3 components (R, G, B); got 2"}` |

### T3.6 — REJECT: invalid RGB triple (4 components)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0, 255), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "invalid_color", "message": "target_color must have exactly 3 components (R, G, B); got 4"}` |

### T3.7 — REJECT: unsupported scope value

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="frame")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "unsupported_scope", "scope": "frame", "supported": ["whole_sprite"]}` |

### T3.8 — REJECT: unknown session_id on recolor

| Field | Value |
|-------|-------|
| **Setup** | No session created. |
| **Input** | `recolor_region("nonexistent-id", region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "session_not_found", "session_id": "nonexistent-id"}` |

---

## 4. `recolor_region` — Transition cell behavior

### T4.1 — Shirt recolor touches bg but not fg on belt transition cell

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | Belt transition cell at frame 0 position (3,6) has `fg: #0000aa` (pants_dark) and `bg: #aa00aa` (shirt_primary). After recolor: `bg` becomes `(0, 170, 0)`. `fg` remains `#0000aa` — it is pants_dark, not shirt_primary. This verifies per-channel, per-role replacement. |
| **Expected warnings/errors** | Transition cell warning: `"Transition cells with mixed roles detected in {N} cells"`. |

### T4.2 — Pants recolor touches fg but not shirt bg on belt transition cell

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="pants", target_color=(0, 100, 0), scope="whole_sprite")` |
| **Expected behavior** | Belt transition cell at frame 0 position (3,6) has `fg: #0000aa` (pants_dark, usage `"fg"`) and `bg: #aa00aa` (shirt_primary). After recolor: `fg` becomes `(0, 100, 0)`. `bg` remains `#aa00aa` — it is shirt_primary, not a pants role. |
| **Expected warnings/errors** | Transition cell warning. |

### T4.3 — Pants recolor handles both-usage role on leg cells

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="pants", target_color=(0, 100, 0), scope="whole_sprite")` |
| **Expected behavior** | Frame 0 cells (2,7) and (4,7) have `fg: #0000aa` (pants_dark) and `bg: #5555ff` (pants_bright). `pants_dark` usage is `"fg"` — fg channel matches, fg changes. `pants_bright` usage is `"both"` — bg channel matches, bg changes. Both channels change on these cells. |
| **Expected warnings/errors** | None specific to these cells (both channels belong to pants roles). |

### T4.4 — Shirt recolor on attack: skin/shirt transition cells

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/attack-0001.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | Frame 0 cell (4,4) shirt_center_top has `fg: #ff5555` (skin) and `bg: #aa00aa` (shirt_primary). After recolor: `bg` changes to `(0, 170, 0)`. `fg` remains `#ff5555` (skin, not shirt). Cell (4,5) shirt_lower_center has `fg: #ff5555` (skin) and `bg: #aa00aa` (shirt_primary). Same: bg changes, fg stays. |
| **Expected warnings/errors** | Transition cell warning for mixed skin/shirt cells. |

### T4.5 — Boots recolor does not touch outline bg

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="boots", target_color=(170, 0, 0), scope="whole_sprite")` |
| **Expected behavior** | Frame 0 cells (2,8) and (4,8) have `fg: #aa5500` (boots_primary, usage `"fg"`) and `bg: #000000` (outline). After recolor: fg changes to `(170, 0, 0)`. bg remains `#000000` — outline is excluded from v1 targeting and boots_primary usage is fg-only. |
| **Expected warnings/errors** | None. |

---

## 5. `recolor_region` — Warning and edge cases

### T5.1 — Zero-change warning (recolor to same color)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(170, 0, 170), scope="whole_sprite")` |
| **Expected behavior** | `(170, 0, 170)` is `#aa00aa` — the existing shirt_primary color. The algorithm replaces matching cells with the same color. Implementation-dependent: either `changed_cells: 0` (no net change detected) or the implementation counts cells visited even if the new value equals the old. Preferred: detect no net change. |
| **Expected warnings/errors** | `"Zero cells changed — target color may already match existing colors"` |

### T5.2 — Ambiguity propagation for shirt on player

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | Recolor succeeds. Warnings include verbatim ambiguity strings from `player-0100.json` that mention any of the resolved palette roles. |
| **Expected warnings/errors** | At minimum these ambiguity strings are included (they mention `shirt_primary`): (1) `"Arm cells at shirt edges (1,5) and (5,5) in idle use skin fg on subcell_fill bg — they belong to both 'skin' and 'shirt' semantically; recoloring shirt should NOT touch these arm cells"` (2) `"Belt transition cell (3,6) uses shirt_primary bg bleeding into pants_dark fg — a 'change shirt color' edit should include this cell's bg but a 'change pants color' edit should include this cell's fg"` |

### T5.3 — Ambiguity propagation for weapon on attack

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/attack-0001.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="weapon", target_color=(255, 215, 0), scope="whole_sprite")` |
| **Expected behavior** | Recolor succeeds. |
| **Expected warnings/errors** | Ambiguity string included: `"Weapon region overlaps with head/face area at x=5 — the guard cell (5,2) is adjacent to face cells; recoloring weapon should not touch face skin"` |

### T5.4 — Skin usage="bg" means fg skin-colored cells are untouched

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="skin", target_color=(200, 150, 100), scope="whole_sprite")` |
| **Expected behavior** | `skin` role has usage `"bg"`. Cell (3,4) neck_transition has `fg: #ff5555` (skin color) and `bg: #aa00aa` (shirt_primary). Because usage is `"bg"`, only bg channels matching `#ff5555` are replaced. The fg `#ff5555` at (3,4) is NOT replaced despite being the skin color, because the role's usage is bg-only. Similarly, arm cells (1,5) fg `#ff5555` and (5,5) fg `#ff5555` are NOT replaced. |
| **Expected warnings/errors** | Ambiguity string about arm cells mentioning skin. |

### T5.5 — Sequential recolors: shirt then pants

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | (1) `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` then (2) `recolor_region(session_id, region="pants", target_color=(0, 100, 0), scope="whole_sprite")` |
| **Expected behavior** | After step 1, shirt_primary cells are `(0, 170, 0)`. Step 2 then recolors pants_dark/pants_bright cells. The belt transition cell (3,6) had bg changed to `(0, 170, 0)` in step 1. In step 2, the algorithm looks for fg matching `#0000aa` (pants_dark) — it still finds it and changes fg. The bg is now `#00aa00`, not `#aa00aa` — but step 2 only targets pants roles, not shirt, so bg is not touched. Both edits coexist correctly. |
| **Expected warnings/errors** | Standard transition cell warnings for each call. |

### T5.6 — Plydie death pose shirt recolor with skin-bg bleed

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/plydie-0000.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["shirt_primary"]`. Frame 0 cell (5,7) shirt_center has `fg: #aa00aa` (shirt_primary) and `bg: #ff5555` (skin). Fg changes to `(0, 170, 0)`. Bg stays `#ff5555`. Cells (4,7) and (6,7) have `fg: #aa00aa` and `bg: #aa00aa` — both channels change. Pants transition cells (4,8) and (6,8) have `fg: #aa00aa` (shirt_primary bleeding into pants) — fg changes. |
| **Expected warnings/errors** | Transition cell warning for cell (5,7) where fg is shirt and bg is skin. Ambiguity: `"Shirt center cell (5,7) uses skin bg (#ff5555) instead of shirt bg (#aa00aa) — this may represent skin visible through torn/open shirt in death pose, or it may be a rendering artifact"` (mentions shirt). |

---

## 6. Cross-family and scope edge cases

### T6.1 — Weapon on plydie: rejected (no weapon region)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/plydie-0000.xp`, obtain `session_id`. Family is `"plydie"`. |
| **Input** | `recolor_region(session_id, region="weapon", target_color=(255, 0, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "unknown_region", "region": "weapon", "family": "plydie", "valid_regions": ["shirt", "pants", "boots", "skin", "hair"]}` |

### T6.2 — Empty string scope: rejected

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "unsupported_scope", "scope": "", "supported": ["whole_sprite"]}` |

### T6.3 — Scope "angle": rejected (future extension)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="angle")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "unsupported_scope", "scope": "angle", "supported": ["whole_sprite"]}` |

---

## 7. Cross-Family Usage Divergence

These tests verify that the same region name behaves differently across families because
`usage` varies per family's semantic map. A recolor that is bg-only on player may touch
both fg and bg on attack, or vice versa. Each case below highlights a concrete divergence.

### T7.1 — Skin recolor on attack: usage="both" touches fg AND bg (unlike player usage="bg")

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/attack-0001.xp`, obtain `session_id`. Family resolves to `"attack"`. |
| **Input** | `recolor_region(session_id, region="skin", target_color=(200, 150, 100), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["skin"]`. In attack family, skin usage is `"both"` (player has `"bg"`). All cells with fg OR bg matching `#ff5555` are replaced. In frame 0: cell (3,2) face_left_edge has `fg: #ff5555` — fg changes (would NOT change on player where usage is bg-only). Cell (4,2) eyes has `bg: #ff5555` — bg changes. Cell (4,3) mouth has `bg: #ff5555` — bg changes. Cells (4,4) shirt_center_top and (4,5) shirt_lower_center have `fg: #ff5555` — fg changes. This is the key divergence from T2.4 (player skin recolor), where fg `#ff5555` cells were untouched because player skin usage is `"bg"`. |
| **Expected response fields** | `resolved_palette_roles: ["skin"]`, `original_colors: {"skin": ["#ff5555"]}`, `target_color: (200, 150, 100)`, `changed_cells > 0`. |
| **Expected warnings/errors** | Transition cell warnings for cells where one channel is skin and the other is a different role. |

### T7.2 — Pants recolor on attack: pants_dark usage="both" touches bg (unlike player usage="fg")

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/attack-0001.xp`, obtain `session_id`. Family resolves to `"attack"`. |
| **Input** | `recolor_region(session_id, region="pants", target_color=(0, 100, 0), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["pants_dark", "pants_bright"]`. In attack family, `pants_dark` usage is `"both"` (player has `"fg"`). All cells with fg OR bg matching `#0000aa` are replaced for pants_dark. In frame 0: cell (4,6) pants_center has `bg: #0000aa` — bg changes (would NOT change on player where pants_dark usage is fg-only). Cell (5,6) pants_top_right has `fg: #0000aa` — fg changes. Cell (5,7) pants_leg_right has `fg: #0000aa` and `bg: #5555ff` — both channels change (fg via pants_dark "both", bg via pants_bright "both"). `pants_bright` usage is `"both"` in attack (same as player), so bg `#5555ff` cells also change. |
| **Expected response fields** | `resolved_palette_roles: ["pants_dark", "pants_bright"]`, `original_colors: {"pants_dark": ["#0000aa"], "pants_bright": ["#5555ff"]}`. |
| **Expected warnings/errors** | Transition cell warnings where pants roles mix with other roles. |

### T7.3 — Pants recolor on plydie: pants_bright usage="fg" skips bg (unlike player usage="both")

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/plydie-0000.xp`, obtain `session_id`. Family resolves to `"plydie"`. |
| **Input** | `recolor_region(session_id, region="pants", target_color=(0, 100, 0), scope="whole_sprite")` |
| **Expected behavior** | Resolves to `["pants_dark", "pants_bright"]`. In plydie family, `pants_bright` usage is `"fg"` (player has `"both"`) and `pants_dark` usage is `"both"` (player has `"fg"`). In frame 0: cell (5,8) pants_center has `fg: #5555ff` and `bg: #0000aa` — fg changes via pants_bright "fg", bg changes via pants_dark "both". Cell (4,8) pants_shirt_transition_left has `fg: #aa00aa` (shirt_primary, not a pants role — no change to fg) and `bg: #0000aa` — bg changes via pants_dark "both". Cell (6,8) same pattern. This is the key divergence: on player, pants_bright "both" would have changed bg `#5555ff` cells, but on plydie, pants_bright "fg" skips any bg `#5555ff` occurrences. |
| **Expected response fields** | `resolved_palette_roles: ["pants_dark", "pants_bright"]`, `original_colors: {"pants_dark": ["#0000aa"], "pants_bright": ["#5555ff"]}`. |
| **Expected warnings/errors** | Transition cell warnings for cells (4,8) and (6,8) where fg is shirt_primary and bg is pants_dark. |

---

## 8. Additional error paths and input validation

### T8.1 — REJECT: unknown_family error when session has unrecognized family

| Field | Value |
|-------|-------|
| **Setup** | Create a session whose `family` field resolves to `"goblin"` (not in REGION_ALIASES). |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. Session state unchanged. |
| **Expected warnings/errors** | `{"error": "unknown_family", "family": "goblin", "supported": ["player", "attack", "plydie"]}` |

### T8.2 — REJECT: role_not_annotated when alias resolves to role absent from map regions

| Field | Value |
|-------|-------|
| **Setup** | Modify `REGION_ALIASES` to include a test entry `"player": {"cape": ["cape_primary"]}` where `cape_primary` does not exist in `player-0100.json` palette_roles or any frame's region palette_roles. Upload `sprites/player-0100.xp`. |
| **Input** | `recolor_region(session_id, region="cape", target_color=(255, 0, 0), scope="whole_sprite")` |
| **Expected behavior** | No cells modified. The region alias resolves, but the role `cape_primary` is not found in the semantic map's annotated regions. |
| **Expected warnings/errors** | `{"error": "role_not_annotated", "role": "cape_primary", "family": "player"}` |

### T8.3 — REJECT: target_color as hex string instead of tuple (wrong type)

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. |
| **Input** | `recolor_region(session_id, region="shirt", target_color="#00aa00", scope="whole_sprite")` |
| **Expected behavior** | No cells modified. |
| **Expected warnings/errors** | `{"error": "invalid_color", "message": "target_color must be a list or tuple of 3 integers; got str"}` |

### T8.4 — Shirt recolor on player verifies changed_frames in response

| Field | Value |
|-------|-------|
| **Setup** | Upload `sprites/player-0100.xp`, obtain `session_id`. Player has 8 angles x 2 projections x [1 idle + 8 walk] = 144 frames. |
| **Input** | `recolor_region(session_id, region="shirt", target_color=(0, 170, 0), scope="whole_sprite")` |
| **Expected behavior** | Recolor succeeds. Response includes `changed_frames` as a sorted list of unique semantic frame indices. Since shirt_primary (`#aa00aa`) is present in every frame across all angles, `changed_frames` should contain all frame indices (0 through N-1 where N is total frames). `len(changed_frames) > 1` — a single-frame result would indicate the algorithm only processed one frame instead of the whole sprite. |
| **Expected response fields** | `changed_frames: [0, 1, 2, ...]` (sorted ascending, covering all frames containing shirt_primary cells on layer 2). `changed_cells > 0`. |
| **Expected warnings/errors** | Standard transition cell and ambiguity warnings as in T2.1. |

---

## Summary

| Category | Test IDs | Count |
|----------|----------|-------|
| `get_semantic_regions` | T1.1 – T1.4 | 4 |
| `recolor_region` happy path | T2.1 – T2.6 | 6 |
| `recolor_region` rejections | T3.1 – T3.8 | 8 |
| Transition cell behavior | T4.1 – T4.5 | 5 |
| Warning and edge cases | T5.1 – T5.6 | 6 |
| Cross-family / scope edge | T6.1 – T6.3 | 3 |
| Cross-family usage divergence | T7.1 – T7.3 | 3 |
| Additional error paths / validation | T8.1 – T8.4 | 4 |
| **Total** | | **39** |

### Palette roles referenced (from semantic maps)

| Role | Color(s) | Usage | Families |
|------|----------|-------|----------|
| `hair` | `#000000` | fg | player, attack, plydie |
| `subcell_fill` | `#ffff55` | bg | player, attack, plydie (excluded from v1 targeting) |
| `skin` | `#ff5555` | bg (player, plydie) / both (attack) | player, attack, plydie |
| `skin_detail` | `#aa0000` | fg | player, attack, plydie (excluded from v1 targeting) |
| `shirt_primary` | `#aa00aa` | both | player, attack, plydie |
| `pants_dark` | `#0000aa` | fg (player) / both (attack, plydie) | player, attack, plydie |
| `pants_bright` | `#5555ff` | both (player, attack) / fg (plydie) | player, attack, plydie |
| `boots_primary` | `#aa5500` | fg | player, attack, plydie |
| `outline` | `#000000` | both | player, attack, plydie (excluded from v1 targeting) |
| `weapon_light` | `#aaaaaa` | fg | attack only |
| `weapon_dark` | `#555555` | both | attack only |

### Region alias table (from API design doc)

| Family | Valid regions |
|--------|-------------|
| `player` | shirt, pants, boots, skin, hair |
| `attack` | shirt, pants, boots, skin, hair, weapon |
| `plydie` | shirt, pants, boots, skin, hair |
