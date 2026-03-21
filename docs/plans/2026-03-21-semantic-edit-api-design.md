# Semantic Edit API — Design Document

Date: 2026-03-21
Status: approved
Depends on: semantic map JSON files at `docs/research/ascii/semantic_maps/`

## Purpose

Add a session-based semantic recolor API so agents can issue commands like "make the
shirt green" against canonical sprite families. The API targets palette roles defined in
the verified semantic map JSON files, not blind global color replacement.

## Non-Goals

- Browser UI for semantic edits (Flask endpoints exist for MCP transport only)
- Direct XP file mutation (session-based only)
- Subcell_fill / outline / skin_detail targeting
- Per-frame or per-angle scoping (v1 is whole_sprite only)
- Shade/tint mapping for multi-color roles (v1 replaces all role colors with one target)
- PNG analysis or slicing changes

## File Layout

| File | Action | Purpose |
|------|--------|---------|
| `src/pipeline_v2/semantic_edit.py` | NEW | Core logic: load maps, resolve aliases, recolor, return summary |
| `src/pipeline_v2/models.py` | EDIT | Add request/response dataclasses |
| `src/pipeline_v2/app.py` | EDIT | Add 2 thin Flask endpoints (transport plumbing for MCP, not browser-UI) |
| `scripts/workbench_mcp_server.py` | EDIT | Add 2 MCP tool wrappers over the Flask endpoints |

The Flask endpoints exist because the MCP server (`scripts/workbench_mcp_server.py`) is
HTTP-backed against `src/pipeline_v2/app.py`. This preserves the repo's existing
integration pattern. The endpoints are not a browser-UI commitment.

## Data Model

### Request types

```python
@dataclass
class GetSemanticRegionsRequest:
    session_id: str

@dataclass
class RecolorRegionRequest:
    session_id: str
    region: str              # "shirt", "pants", "boots", "skin", "hair", "weapon"
    target_color: tuple[int, int, int]  # RGB triple, each 0..255
    scope: str = "whole_sprite"  # v1: only "whole_sprite" accepted
```

Validation rules:
- `target_color` must be length 3, each value in [0, 255]
- `scope` must be `"whole_sprite"`; reject any other value with an explicit error
- `region` must exist in the family's alias table; reject with list of valid regions

### Response types

```python
@dataclass
class SemanticRegionInfo:
    name: str                    # "shirt", "pants", etc.
    palette_roles: list[str]     # ["shirt_primary"]
    colors: dict[str, list[str]] # {"shirt_primary": ["#aa00aa"]}
    confidence: str              # lowest confidence across constituent roles
    description: str             # derived from role definitions, not ad-hoc

@dataclass
class GetSemanticRegionsResponse:
    session_id: str
    family: str
    reference_xp: str
    semantic_layer: int
    regions: list[SemanticRegionInfo]

@dataclass
class RecolorRegionResponse:
    session_id: str
    family: str
    requested_region: str
    resolved_palette_roles: list[str]
    changed_cells: int           # unique cells changed (not channel changes)
    changed_frames: list[int]    # semantic frame indices
    original_colors: dict[str, list[str]]  # role -> colors that were replaced
    target_color: tuple[int, int, int]
    warnings: list[str]
```

## Region Alias Tables

Hardcoded in `semantic_edit.py`. Not inferred from arbitrary JSON labels.

```python
REGION_ALIASES: dict[str, dict[str, list[str]]] = {
    "player": {
        "shirt":  ["shirt_primary"],
        "pants":  ["pants_dark", "pants_bright"],
        "boots":  ["boots_primary"],
        "skin":   ["skin"],
        "hair":   ["hair"],
    },
    "attack": {
        "shirt":  ["shirt_primary"],
        "pants":  ["pants_dark", "pants_bright"],
        "boots":  ["boots_primary"],
        "skin":   ["skin"],
        "hair":   ["hair"],
        "weapon": ["weapon_light", "weapon_dark"],
    },
    "plydie": {
        "shirt":  ["shirt_primary"],
        "pants":  ["pants_dark", "pants_bright"],
        "boots":  ["boots_primary"],
        "skin":   ["skin"],
        "hair":   ["hair"],
    },
}
```

Excluded from v1 targeting: `subcell_fill`, `outline`, `skin_detail`.

## Semantic Map File Lookup

```python
SEMANTIC_MAP_FILES: dict[str, str] = {
    "player": "docs/research/ascii/semantic_maps/player-0100.json",
    "attack": "docs/research/ascii/semantic_maps/attack-0001.json",
    "plydie": "docs/research/ascii/semantic_maps/plydie-0000.json",
}
```

Maps are loaded from disk relative to repo root. The session's `family` field drives
the lookup.

## Recolor Algorithm

```
recolor_region(session_id, region="shirt", target_color=(0,170,0), scope="whole_sprite")

1. Load session via existing workbench_load_session(session_id)
   → get family, layers[2] cells, grid_cols, grid_rows, cell_w, cell_h

2. Validate:
   - family exists in REGION_ALIASES
   - region exists in REGION_ALIASES[family]
   - scope == "whole_sprite"
   - target_color is valid RGB triple

3. Load semantic map from SEMANTIC_MAP_FILES[family]

4. Resolve region alias → palette role list
   - "pants" → ["pants_dark", "pants_bright"]

5. Validate roles in map:
   - Each resolved role must exist in semantic_map.palette_roles
   - Each resolved role must appear in at least one region in
     semantic_map.frames[*].regions[*].palette_roles
   - If not: return error, do not recolor

6. Collect color allowlist:
   - For each resolved role, get its colors and usage from palette_roles
   - Build: {hex_color: usage} where usage is "fg" | "bg" | "both"

7. Walk every cell in session.layers[2]:
   - For each cell:
     - Convert cell fg/bg to hex for comparison
     - If cell.fg matches an allowlisted color with usage "fg" or "both":
       → replace cell.fg with target_color
     - If cell.bg matches an allowlisted color with usage "bg" or "both":
       → replace cell.bg with target_color
     - If either channel changed: mark cell as changed, record frame index

8. Derive frame indices from cell positions:
   - col = idx % grid_cols
   - row = idx // grid_cols
   - frame_col = col // cell_w
   - frame_row = row // cell_h
   - Use session geometry (cell_w, cell_h, grid_cols), not semantic JSON

9. Save session via existing save path (single atomic save)

10. Return RecolorRegionResponse with:
    - changed_cells: count of unique cells where any channel changed
    - changed_frames: sorted unique frame indices
    - original_colors: {role: [hex colors]} for each touched role
    - warnings: collected from semantic map ambiguities + runtime checks
```

### Warning generation

Warnings are returned, never block the operation:

- `"Region 'weapon' is not supported for family 'player'"` → this is an error, not a warning
- `"Zero cells changed — target color may already match existing colors"` → warning
- `"Transition cells with mixed roles detected in {N} cells"` → warning when a cell has
  one channel matching this recolor and the other channel matching a different role
- Ambiguities from the semantic map's `ambiguities` array that mention any of the
  resolved palette roles → included verbatim as warnings

### Error cases

All errors return structured dicts, not exceptions:

| Condition | Error |
|-----------|-------|
| Unknown session_id | `{"error": "session_not_found", "session_id": ...}` |
| Unknown family | `{"error": "unknown_family", "family": ..., "supported": [...]}` |
| Unknown region for family | `{"error": "unknown_region", "region": ..., "family": ..., "valid_regions": [...]}` |
| Role not in annotated regions | `{"error": "role_not_annotated", "role": ..., "family": ...}` |
| Unsupported scope | `{"error": "unsupported_scope", "scope": ..., "supported": ["whole_sprite"]}` |
| Invalid target_color | `{"error": "invalid_color", "message": ...}` |

## Flask Endpoints

These are transport plumbing for MCP, not a browser-UI commitment.

### GET /api/workbench/semantic-regions

Query parameter: `session_id`

Returns: `GetSemanticRegionsResponse` as JSON

### POST /api/workbench/semantic-recolor

Request body:
```json
{
  "session_id": "...",
  "region": "shirt",
  "target_color": [0, 170, 0],
  "scope": "whole_sprite"
}
```

Returns: `RecolorRegionResponse` as JSON

### Endpoint conventions

- Namespace: `/api/workbench/` (matches existing endpoints)
- Error responses: `{"error": "...", "message": "..."}` with appropriate HTTP status
- Success: 200 with response dataclass serialized to JSON

## MCP Tool Wrappers

Added to `scripts/workbench_mcp_server.py` following the existing pattern of HTTP calls
to the Flask API.

### get_semantic_regions

```python
@mcp.tool()
def get_semantic_regions(session_id: str) -> dict:
    """Return the available semantic regions for a session's sprite family."""
    # GET /api/workbench/semantic-regions?session_id=...
```

### recolor_region

```python
@mcp.tool()
def recolor_region(
    session_id: str,
    region: str,
    target_color: list[int],
    scope: str = "whole_sprite",
) -> dict:
    """Recolor a semantic region (shirt, pants, boots, skin, hair, weapon)
    across the entire sprite using palette-role-aware channel replacement."""
    # POST /api/workbench/semantic-recolor
```

## Future Extensions (not implemented in v1)

- `scope` values: `"frame"`, `"angle"`, `"anim"` with additional selector parameters
- `target_color_map`: per-role color targets for multi-color roles (e.g. dark/bright pants)
- Region preview: return changed cells without saving, for UI preview
- Undo integration: push to workbench undo stack before applying
- Additional regions: `subcell_fill`, `outline`, `skin_detail` if use cases emerge
- Flask-only browser UI: semantic edit panel in workbench (post-v1, if workflow proves useful)

## Test Plan

- Unit tests for `_resolve_region()` across all families and invalid inputs
- Unit tests for recolor logic with synthetic cell data
- Integration test: load canonical session, recolor shirt, verify only shirt_primary
  cells changed and transition cell channels are handled correctly
- Negative tests: wrong family, wrong region, bad color, unsupported scope
- Round-trip test: recolor → export → re-read → verify colors match
