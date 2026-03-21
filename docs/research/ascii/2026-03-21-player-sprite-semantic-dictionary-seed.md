# Player Sprite Semantic Dictionary — Seed

Date: 2026-03-21
Status: research
Purpose: Start a machine-usable semantic dictionary so agents can make edits like
"change shirt color to green" or "make pants purple" without guessing from raw glyph soup.

## Why this exists

Agents currently know a lot about geometry and layer contracts, but not enough about what a
visual region means. The first useful step is not a global glyph dictionary; it is a
**family + frame + region dictionary**:

- family-specific
- pose/frame-specific
- region-labeled (`face`, `shirt`, `pants`, `boots`, ...)
- color-role aware
- confidence-scored

## Scope and evidence model

This seed is intentionally narrow:

- family: `player`
- reference XP: `sprites/player-0100.xp`
- layer: L2 only (visual layer)
- starting pose: first idle frame, first projection, first angle row

Claims below are divided into:

- **High confidence**: direct repeated glyph/position/color evidence in the file
- **Medium confidence**: region inference from stable body layout and palette grouping
- **Low confidence**: plausible but not yet frame-family-wide verified

## Verified glyph inventory for `player-0100.xp` L2

Observed directly from the file:

| Glyph | Char | Count | Notes |
|------:|------|------:|-------|
| 32 | space | 7394 | transparent background |
| 222 | `▐` | 786 | right half block |
| 221 | `▌` | 686 | left half block |
| 220 | `▄` | 499 | lower half block |
| 223 | `▀` | 499 | upper half block |
| 34 | `"` | 54 | face detail |
| 219 | `█` | 36 | solid fill |
| 118 | `v` | 27 | face detail |
| 94 | `^` | 27 | face/head detail |
| 46 | `.` | 18 | detail |
| 96 | `` ` `` | 9 | detail |
| 39 | `'` | 9 | detail |
| 191/192/217/218 | `┐└┘┌` | 9 each | rounded/edge detail |

This is enough to reject the earlier bad summary that the sprite is "just blocks". It is
mostly block-based, but it also contains sparse semantic detail glyphs.

## Seed semantic map: `player-0100.xp`, frame 0

Frame-0 dimensions are 7x10 cells. The following regions are directly visible in the first
idle frame:

### High-confidence regions

| Region | BBox (x0..x1, y0..y1) | Evidence | Meaning |
|--------|------------------------|----------|---------|
| face | `2..4, 1..3` | centered head cluster with `"` at `(3,2)` and `v` at `(3,3)` on skin-tone background | eyes + mouth |
| boots | `2..4, 8..8` | two brown/black `▀` cells at `(2,8)` and `(4,8)` | footwear / feet |

### Medium-confidence regions

| Region | BBox (x0..x1, y0..y1) | Dominant colors | Meaning |
|--------|------------------------|-----------------|---------|
| shirt | `1..5, 4..5` | magenta/purple body fill with skin-tone edges | torso garment |
| pants | `2..4, 6..7` | dark/bright blue cells | lower garment / legs |

### High-confidence semantic detail cells

| Cell | Glyph | Colors | Semantic role |
|------|-------|--------|---------------|
| `(3,2)` | `"` | fg black, bg skin `(255,85,85)` | eyes |
| `(3,3)` | `v` | fg dark red, bg skin `(255,85,85)` | mouth |

The `v` mouth conclusion is not folklore: it is a repeated centered face glyph in the same
relative head position across multiple frames in `player-0100.xp`.

## Color-role seed for frame 0

This is the most useful bridge for future AI edits.

| Role | Representative colors | Confidence | Notes |
|------|------------------------|------------|-------|
| skin | `(255,85,85)` | high | face/arms edge background around eyes and mouth |
| shirt_primary | `(170,0,170)` | medium | torso fill |
| pants_primary | `(0,0,170)` and `(85,85,255)` | medium | leg/pants region |
| boots_primary | `(170,85,0)` with black | high | feet/boot row |
| outline | `(0,0,0)` | medium | eyes, edges, dark accents |

## Important rule: semantics are not glyph-only

Do **not** treat glyphs as globally semantic by themselves.

Example:

- `"` at `(3,2)` in the face region is an eye marker
- the same glyph elsewhere in another family/frame could be decorative or structural

The right abstraction is:

- `family`
- `reference_variant`
- `frame/projection/angle`
- `region`
- `role`
- `cell membership`

That is what allows a command like "make the shirt green" to work without touching the face
or pants.

## Proposed machine-readable schema

This should eventually live as checked-in JSON/YAML under a dedicated semantic-data folder.

```json
{
  "family": "player",
  "reference_xp": "sprites/player-0100.xp",
  "layer": 2,
  "frame_w": 7,
  "frame_h": 10,
  "regions": [
    {
      "name": "face",
      "frame": 0,
      "projection": 0,
      "angle": 0,
      "bbox": [2, 1, 4, 3],
      "confidence": "high",
      "cells": [[3, 2], [3, 3], [2, 2], [4, 2], [3, 1]],
      "roles": ["eyes", "mouth", "head_outline", "skin"]
    },
    {
      "name": "shirt",
      "frame": 0,
      "projection": 0,
      "angle": 0,
      "bbox": [1, 4, 5, 5],
      "confidence": "medium",
      "roles": ["shirt_primary", "shirt_edge", "skin_edge"]
    }
  ],
  "palette_roles": {
    "skin": [[255, 85, 85]],
    "shirt_primary": [[170, 0, 170]],
    "pants_primary": [[0, 0, 170], [85, 85, 255]],
    "boots_primary": [[170, 85, 0]]
  }
}
```

## Practical next steps

### Step 1: Build one seed dictionary per enabled family

Start with:

- `player-0100.xp`
- `attack-0001.xp`
- `plydie-0000.xp`

Only annotate a small number of robust roles first:

- face
- shirt / torso
- pants / legs
- boots / feet
- weapon trail / effect (for attack, if present)

### Step 2: Anchor semantics to frame-local coordinates

Do not begin with free-form natural-language descriptions. Start from:

- frame-local cell coordinates
- bboxes
- color-role sets
- confidence labels

### Step 3: Add agent-safe edit operations

Once region labels exist, agents can safely execute requests like:

- "change shirt color to green"
- "make pants purple"
- "leave skin tones alone"

Those operations should target region memberships and palette roles, not naive whole-frame
color replacement.

### Step 4: Keep PNG auto-analysis separate

Semantic dictionaries should be built from reference XP truth, not from the unreliable PNG
analyze path. They are a downstream editing aid, not a replacement for geometry detection.

## Milestone 2 relevance

This is directly useful for Milestone 2.

If the PNG pipeline is simplified toward:

- coarse source ingestion
- bounding-box extraction
- manual source-to-grid placement
- whole-sheet XP editing

then the semantic dictionary becomes the layer that lets agents and users talk about
"shirt", "pants", and "mouth" after the sheet exists, without requiring perfect automatic
PNG slicing first.

## Machine-readable dictionaries (2026-03-21)

Machine-readable JSON semantic dictionaries now exist at:

- `docs/research/ascii/semantic_maps/schema.json` — JSON Schema definition
- `docs/research/ascii/semantic_maps/player-0100.json` — player family (frame 0 idle + frame 1 walk)
- `docs/research/ascii/semantic_maps/attack-0001.json` — attack family with weapon region (frame 0)
- `docs/research/ascii/semantic_maps/plydie-0000.json` — death family (frame 0)

### Correction: hair is black, not yellow

The seed above incorrectly assumed `#ffff55` (bright yellow) was the hair color. User
verification confirmed: **hair is black** (`#000000`). The `#ffff55` yellow is a **sub-cell
rendering fill color** used as background for half-block glyphs throughout the sprite — it
appears on arm cells, pants edges, boot gaps, and head edges alike. It is not a semantic
body part color.

The machine-readable JSON files reflect this correction:
- `hair` role → `#000000` (black)
- `subcell_fill` role → `#ffff55` (yellow rendering fill, not recolorable as a body part)
