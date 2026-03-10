# Sprite Extraction: Dual Analysis + Smart Fallback

**Date:** 2026-03-10
**Status:** Planning Phase - Awaiting Approval
**Goal:** Fix "cannot tile evenly" error by providing intelligent analysis with dual algorithms and user choice

---

## Problem

**Current Flow (Broken):**
```
Upload PNG → Analyze (current algorithm) → Suggest angles/frames
  → Convert to XP → FAILS: "cannot tile evenly"
```

**Root Cause:** Current algorithm assumes uniform grid tiling. Real sprite sheets have irregular sizing.

---

## Solution: Dual Analysis with Smart Fallback

**New Flow:**
```
Upload PNG → Analyze
  ├─ Run current algorithm (fast, often inaccurate)
  └─ Run floodfill extraction (slower, more accurate)
      ├─ If current algo WOULD fail (cannot tile evenly) → USE floodfill only
      ├─ If both valid:
      │   - Compare vs template's expected sprite count
      │   - Show user choice: "A) Fast (X sprites) vs B) Accurate (Y sprites)"
      │   - User picks OR defaults to closest match
      └─ Return chosen suggestions
  → Convert to XP → SUCCEEDS
```

---

## Implementation Details

### A. Create Floodfill Module

**File:** `src/pipeline_v2/sprite_extract.py`

```python
def extract_sprites_floodfill(image) -> dict:
    """
    Detect individual sprites using connected component analysis
    Returns: {
        "angles": detected_angles,
        "frames": detected_frames,
        "cell_w": suggested_cell_width,
        "cell_h": suggested_cell_height,
        "sprite_count": total_sprites_detected,
        "diagnostics": {...}
    }
    """
```

### B. Modify `/api/analyze` Endpoint

**File:** `src/pipeline_v2/app.py` at line ~291

```python
@app.post("/api/analyze")
def api_analyze():
    req_id = str(uuid.uuid4())
    try:
        payload = request.get_json(silent=True) or {}
        source_path = payload.get("source_path", "")

        # STEP 1: Try current algorithm
        current_result = _suggest_run_geometry(w, h, source_image)
        current_angles = current_result["suggested_angles"]
        current_frames = current_result["suggested_frames"]

        # STEP 2: Check if current would fail native_compat check
        would_fail = _check_native_compat_valid(
            angles=current_angles,
            frames=current_frames,
            projs=1  # default
        )

        # STEP 3: If would fail, or user wants accuracy, run floodfill
        if would_fail or payload.get("try_floodfill"):
            floodfill_result = extract_sprites_floodfill(source_image)
        else:
            floodfill_result = None

        # STEP 4: Return comparison for user choice
        return jsonify({
            "current": current_result,  # Fast algorithm
            "floodfill": floodfill_result,  # Accurate algorithm
            "template": payload.get("template", "player_native_idle_only"),
            "needs_choice": (not would_fail and floodfill_result is not None),
            "recommended": _pick_best(current_result, floodfill_result, template),
        }), 200

    except ApiError as e:
        return _err(e)
```

### C. Helper Function: Check Native Compat Validity

**Location:** `src/pipeline_v2/service.py`

```python
def _check_native_compat_valid(angles: int, frames: int, projs: int) -> bool:
    """
    Check if geometry would fail "cannot tile evenly" check
    Returns True if WOULD FAIL
    """
    total_tile_cols = frames * projs
    cell_w_chars = NATIVE_COLS // max(1, total_tile_cols)

    # Would fail if doesn't divide evenly
    return cell_w_chars < 1 or cell_w_chars * total_tile_cols != NATIVE_COLS
```

### D. Helper Function: Pick Best Result

**Location:** `src/pipeline_v2/service.py`

```python
def _pick_best(current: dict, floodfill: dict, template: str) -> dict:
    """
    Compare both results and pick closest to template's expected sprite count

    Template expected counts:
    - player_native_idle_only: 8 sprites (1 angle × 8 frames)
    - player_native_full: 64 sprites (8 angles × 8 frames)
    - attack: 72 sprites (8 angles × 9 frames)
    """
    template_counts = {
        "player_native_idle_only": 8,
        "player_native_full": 64,
        "attack": 72,
    }

    expected = template_counts.get(template, 8)

    current_count = current["suggested_angles"] * current["suggested_frames"]
    floodfill_count = floodfill["suggested_angles"] * floodfill["suggested_frames"]

    current_error = abs(current_count - expected)
    floodfill_error = abs(floodfill_count - expected)

    # Return whichever is closer to expected count
    return current if current_error <= floodfill_error else floodfill
```

### E. Modify Workbench UI Response

**Response when both algorithms valid:**
```json
{
  "image_w": 32,
  "image_h": 32,
  "suggested_angles": 1,
  "suggested_frames": 1,

  "current": {
    "angles": 1,
    "frames": 1,
    "cell_w": 32,
    "cell_h": 32,
    "count": 1
  },
  "floodfill": {
    "angles": 1,
    "frames": 1,
    "cell_w": 32,
    "cell_h": 32,
    "count": 1
  },
  "recommended": "floodfill",
  "needs_choice": true,
  "template": "player_native_idle_only"
}
```

---

## Workbench UI Changes

### When Analysis Returns Choice Required

**Current behavior:**
- Shows single set of suggestions
- User adjusts values manually

**New behavior:**
- Analyze button click → shows temporary warning/popup
- "Two algorithms agree? Pick preferred:"
  - Option A: Fast (current) - X sprites
  - Option B: Accurate (floodfill) - Y sprites
  - Auto-select closest match to template
- User clicks choice OR dismiss to auto-select
- Pre-fills form with chosen values

---

## Fallback Behavior

### If Current Algorithm Would Fail
- Silently use floodfill only
- No popup, no choice
- Just works

### If Both Valid
- Show popup with both options
- Auto-select closest to template
- User can override if desired

### If Floodfill Also Fails
- Return current (will fail later in run step)
- Show error in run step as before
- User must adjust manually

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pipeline_v2/sprite_extract.py` | NEW - floodfill detection |
| `src/pipeline_v2/service.py` | Add `_check_native_compat_valid()` and `_pick_best()` |
| `src/pipeline_v2/app.py` | Modify `/api/analyze` endpoint |
| `web/workbench.js` | Handle popup/choice when `needs_choice: true` |

---

## Rollback Safety

**If issues found:**
```bash
git revert HEAD  # Single revert removes all changes
```

**Checkpoint:** `2d017d6 checkpoint: before sprite extraction floodfill fix`

---

## Testing Strategy

1. **Unit test floodfill extraction**
   - Various PNG sizes
   - Different sprite layouts
   - Edge cases (1x1, irregular grids)

2. **Test analyze endpoint**
   - PNG that fails current algo → uses floodfill
   - PNG where both valid → shows choice
   - PNG where both fail → returns current

3. **Test workbench flow**
   - Upload → Analyze → See popup (if needed)
   - Choose option
   - Convert succeeds

4. **Test game workflow**
   - Full PNG → XP → Game test
   - Verify sprite displays correctly

---

## Success Criteria

- ✓ "Cannot tile evenly" error never blocks analysis
- ✓ User always gets valid suggestions
- ✓ Floodfill kicks in when current algo fails
- ✓ User can choose when both valid
- ✓ Recommended pick defaults to closest sprite count
- ✓ Full workflow: PNG → XP → Game works end-to-end

---

## Questions for Approval

1. **Default template:** Should idle be default, or detect from template dropdown?
2. **UI popup:** Warning dialog, inline popup, or temporary banner?
3. **Auto-select behavior:** Always pick closest match, or require manual selection?
4. **Sprite count tolerance:** How close is "close enough" to template expected count?

---

**Ready to implement?** Please confirm approach before proceeding.
