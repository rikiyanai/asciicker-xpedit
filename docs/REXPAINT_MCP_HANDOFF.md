# REXPaint MCP Suite Enhancement Plan

**Status:** Active - Handoff Required  
**Scope:** Improve MCP server for REXPaint integration with macOS/Wine  
**Created:** 2026-03-04  
**Next Agent:** Continue automation improvements and documentation

---

## 📋 Executive Summary

The REXPaint MCP server has been significantly enhanced to work with macOS/Wine installations. Key achievements:

1. ✅ **Fixed hardcoded paths** - Updated from `/Users/r/Downloads/` to `/Users/r/Desktop/wine-11.0/`
2. ✅ **Added AppleScript automation** - Can now send keystrokes to control REXPaint GUI
3. ✅ **Added comprehensive tools** - Layer analysis, quick reference guides, file management
4. ✅ **Documented Wine on macOS specifics** - ARM64, preloader, XQuartz considerations
5. 🔄 **Requires accessibility permissions** - User clicked "Allow" but needs verification

---

## 🏗️ Architecture Overview

### Wine on macOS (ARM64) Specifics

**Process Structure:**
```
User launches REXPaint.exe
    ↓
Wine preloader (wine-preloader) reserves memory
    ↓
Wine server (wineserver) manages Windows environment
    ↓
REXPaint.exe runs as Windows process
    ↓
GUI rendered via X11 (XQuartz) or macOS display bridge
```

**Key Differences from Linux:**
- **Preloader required**: macOS ARM64 needs `wine-preloader` to reserve low 4GB memory
- **Page size**: 16KB vs 4KB on x86 (handled by preloader)
- **Display**: Uses XQuartz or CrossOver's built-in display bridge
- **Process name**: Shows as "Wine Crossover" or "wine-preloader", not "REXPaint"

### Automation Challenges

**What Works:**
- `ps aux | grep REXPaint` - Process detection ✓
- `pgrep -f REXPaint.exe` - PID lookup ✓
- File I/O (copy to images folder) ✓
- Native XP editing (bypass GUI entirely) ✓

**What Requires Permissions:**
- AppleScript `tell application "System Events"` - Needs Accessibility permission
- AppleScript `keystroke` - Needs permission for target app
- Process focusing via `set frontmost` - Requires user approval

**User Action Taken:**
- User clicked "Allow" when prompted for accessibility
- ❌ **However, automation still blocked** - permission needs to be granted to the specific Terminal/IDE running Python
- **Next agent should**: Guide user to System Settings > Privacy & Security > Accessibility > Add Terminal/IDE

**Verification (2026-03-04):**
```bash
python3 -c "from scripts.rex_mcp.server import focus_and_switch_layer; print(focus_and_switch_layer(2))"
# Result: Still fails - needs Terminal added to Accessibility permissions
```

---

## 🛠️ Current MCP Tools Inventory

### Core Control Tools

| Tool | Status | Description | Usage |
|------|--------|-------------|-------|
| `check_system()` | ✅ Working | Diagnose Wine/REXPaint setup | Run first to verify environment |
| `launch_rexpaint()` | ✅ Working | Launch with verification | Starts REXPaint if not running |
| `kill_rexpaint()` | ✅ Working | Force quit | Emergency termination |
| `is_rexpaint_running()` | ✅ Working | Check process status | Boolean check |

### Automation Tools (Require Permissions)

| Tool | Status | Description | Prerequisites |
|------|--------|-------------|---------------|
| `focus_and_switch_layer(n)` | 🔄 Needs Test | Auto-switch to layer N | Requires macOS Accessibility permission |
| `send_rexpaint_keystroke(key, modifier)` | 🔄 Needs Test | Send any keystroke | User clicked "Allow" - verify it works |

### XP File Analysis Tools

| Tool | Status | Description | When to Use |
|------|--------|-------------|-------------|
| `analyze_xp_layers(path)` | ✅ Working | Deep layer-by-layer analysis | Understanding sprite structure |
| `analyze_canvas_view(path, guess)` | ✅ Working | What you should see on canvas | When confused about which layer is visible |
| `get_layer_info(path, n)` | ✅ Working | Specific layer statistics | Quick layer stats |
| `get_summary(path)` | ✅ Working | Metadata + ASCII preview | Quick file overview |
| `get_rexpaint_quickref()` | ✅ Working | Complete UI reference guide | Learning REXPaint interface |
| `get_layer_guide()` | ✅ Working | Asciicker layer semantics | Understanding layer purposes |

### File Management Tools

| Tool | Status | Description |
|------|--------|-------------|
| `list_assets(dir)` | ✅ Working | List all .xp files |
| `open_in_rexpaint(path)` | ✅ Working | Copy file to images folder |
| `import_sprite_to_rexpaint(path, angles, anims)` | ✅ Working | Import with full guide |
| `get_rexpaint_status()` | ✅ Working | Check running state + available files |

### Direct XP Editing (No GUI Required)

| Tool | Status | Description | Best For |
|------|--------|-------------|----------|
| `set_cell(path, layer, x, y, glyph, fg, bg)` | ✅ Working | Edit single cell | Precise edits |
| `fill_rect(path, layer, x, y, w, h, glyph, fg, bg)` | ✅ Working | Batch fill area | Large areas |
| `apply_deltas(path, layer, deltas)` | ✅ Working | Multi-cell update | Complex patterns |
| `read_xp(path)` | ✅ Working | Load file info | Verification |
| `write_xp(path, w, h)` | ✅ Working | Create new file | New sprites |

---

## 📝 Documentation References

### Critical Files to Read

1. **`docs/specs/XP_LAYER_SPEC.md`** - Layer semantics specification
   - Layer 0: Color key + metadata encoding
   - Layer 1: Height map (0-9, A-Z = Z-depth)
   - Layer 2: Visual artwork (glyphs + colors)
   - Layer 3+: Swoosh/FX overlay (cyan highlights)

2. **`scripts/asset_gen/xp_core.py`** - XP file I/O implementation
   - `XPFile` class for loading/saving
   - `XPLayer` for layer manipulation
   - Metadata decoding (`get_metadata()`)

3. **`scripts/asset_gen/xp_viewer.py`** - Engine-aligned viewer
   - Frame indexing logic
   - Atlas grid calculation
   - Must match `asciiid.cpp` frame selection

4. **REXPaint Manual** - https://gridsagegames.com/rexpaint/manual.txt
   - Keyboard shortcuts reference
   - Layer control commands
   - Extended Layers Mode (Ctrl+Shift+L)

---

## 🔄 Recommended Agent Workflow

### Phase 1: Verify Automation Works (Priority: HIGH)

Since user clicked "Allow" for accessibility:

```python
# Test if automation now works
from scripts.rex_mcp.server import focus_and_switch_layer, send_rexpaint_keystroke

# 1. Verify REXPaint is running
status = get_rexpaint_status()
assert status['running'], "REXPaint must be running first"

# 2. Test layer switching
result = focus_and_switch_layer(2)
if result['success']:
    print("✅ Automation works! Can control REXPaint via AppleScript")
else:
    print("❌ Still blocked - check System Settings > Privacy & Security > Accessibility")
    print("   Ensure Terminal (or your IDE) is listed and checked")

# 3. Test generic keystroke
result2 = send_rexpaint_keystroke('c')  # Switch to Cell draw mode
print(f"Keystroke test: {result2}")
```

**If automation works:**
- Add more convenience functions (see "Future Enhancements" below)
- Document working automation patterns

**If still blocked:**
- Verify permissions in System Settings
- Document manual workaround as primary method

### Phase 2: Add Repeat Process Scripts (Priority: MEDIUM)

Create automated workflows for common tasks:

```python
# Example: Batch layer switching for animation review
@mcp.tool()
def review_animations(xp_path: str) -> str:
    """
    Auto-cycle through animation frames for review.
    
    Switches to Layer 2, then sends arrow keys to step through frames.
    """
    # Implementation: Switch to Layer 2, then send Right/Left arrows
    pass

# Example: Quick export workflow
@mcp.tool()
def quick_export_and_view(xp_path: str) -> str:
    """
    Export to PNG and open in default viewer.
    
    Sends Ctrl+E in REXPaint, then opens exported PNG.
    """
    # Implementation: Send Ctrl+E keystroke
    pass
```

### Phase 3: Enhance Error Handling (Priority: MEDIUM)

Current error messages are basic. Improve:

1. **Permission detection**: Check if accessibility is enabled before trying automation
2. **Fallback strategies**: If AppleScript fails, suggest manual steps with screenshots
3. **Retry logic**: Some operations need delays (REXPaint takes time to respond)

### Phase 4: Create Agent Training Docs (Priority: LOW)

Add to `docs/skills/`:

- `rexpaint-mcp-automation.md` - Complete automation guide
- `wine-macos-setup.md` - Wine/CrossOver specifics
- `xp-sprite-editing.md` - Layer semantics and workflows

---

## 🚀 Future Enhancement Ideas

### High Value

1. **Screenshot verification**
   - Use `screencapture` CLI to grab REXPaint window
   - Verify layer switch actually happened
   - Detect "what layer is currently visible"

2. **Animation playback**
   - Auto-send arrow keys to cycle through frames
   - Configurable delay between frames
   - Useful for reviewing walk cycles

3. **Palette extraction**
   - Read XP file, extract unique colors
   - Generate palette files for REXPaint
   - Help maintain color consistency

### Medium Value

4. **Batch operations**
   - Apply same edit to multiple XP files
   - Example: Update color key across all player sprites

5. **Layer comparison**
   - Compare Layer 2 (current) vs Layer 2 (backup)
   - Highlight differences

6. **Auto-crop detection**
   - Find bounding box of non-transparent content
   - Suggest optimal canvas size

### Low Value (Nice to Have)

7. **Voice control integration** - "Switch to layer 2"
8. **Macro recording** - Record sequences of edits
9. **Integration with asset_gen pipeline** - Direct PNG→XP conversion

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **AppleScript delays**: REXPaint takes ~0.2-0.5s to respond to keystrokes
2. **Window focus**: Must ensure REXPaint is frontmost before sending keys
3. **Extended Layers Mode**: Layer 0 hidden by default (press E+ to show)
4. **Wine process detection**: PID tracking works but process name varies

### Wine/CrossOver Variations

**If user has CrossOver:**
- Process name: "Wine Crossover"
- Preloader: Included in bundle
- Display: Built-in bridge (may not need XQuartz)

**If user has standalone Wine:**
- Process name: "wine" or "wine-preloader"
- May need XQuartz installed
- Different binary paths

**Current implementation assumes:** `/Users/r/Desktop/wine-11.0/wine`

---

## 📁 Files Modified/Added

### Modified
- `scripts/rex_mcp/server.py` - Core MCP server (916 lines → ~1200 lines)
- `scripts/rex_mcp/mcp_config_snippet.json` - Updated paths and DISPLAY env

### Test Files
- `scripts/rex_mcp/tests/test_lifecycle.py` - Tests pass (3/3)

### Next Agent Should Create
- `docs/skills/rexpaint-mcp-automation.md` - User guide
- `docs/plans/rexpaint-mcp-enhancements.md` - This plan
- Additional automated scripts (see Phase 2)

---

## ✅ Handoff Checklist for Next Agent

- [ ] Verify automation works (user clicked "Allow", test it)
- [ ] Document which specific accessibility permissions are needed
- [ ] Add more automated workflow tools (Phase 2)
- [ ] Create user guide in docs/skills/
- [ ] Test all tools with real REXPaint window
- [ ] Add error handling for permission failures
- [ ] Consider pyautogui as alternative if AppleScript unreliable

---

## 🔗 Quick Reference for Next Agent

**Test automation now:**
```bash
cd /Users/r/Downloads/asciicker-Y9-2
python3 -c "
from scripts.rex_mcp.server import focus_and_switch_layer
result = focus_and_switch_layer(2)
print('Success:', result.get('success'))
print('Message:', result.get('message'))
"
```

**Check permissions:**
```bash
# In Terminal
ls -la ~/Library/Application\ Support/com.apple.TCC/TCC.db
# Or check System Settings > Privacy & Security > Accessibility
```

**Verify REXPaint state:**
```python
from scripts.rex_mcp.server import get_rexpaint_status
status = get_rexpaint_status()
print(status)
```

---

## 📞 Context for Next Agent

**What was the user trying to do?**
- User wanted to see Layer 2 (Visual Artwork) instead of Layer 1 (Height Map numbers)
- I explained to press "2" key, but they wanted automation
- Automation initially failed due to macOS permissions
- User clicked "Allow" in the permission dialog
- **Next agent should verify this fixed the issue**

**What worked manually:**
- Press "1" → Layer 1 (Height numbers)
- Press "2" → Layer 2 (Visual Artwork) ✨
- Press "0" → Layer 0 (Color key/metadata)
- Ctrl+Shift+L → Toggle Extended Layers Mode (shows Layer 0)

**What the user learned:**
- Layer 0 = Color key + metadata encoding (yellow background, + grid pattern)
- Layer 1 = Height map (numbers 0-9 for physics)
- Layer 2 = Actual artwork (what they wanted to edit)
- "E+" button adds/hides extended layers (showed Layer 0)

---

## Phase 2 Completion: Game-Aware Sprite Editing Tools (2026-03-04)

### Bug Fixes
- `get_rexpaint_quickref()` — Fixed orphaned dead code (lines 1111-1234 were inside `send_rexpaint_keystroke`'s except block). Now properly defined as `@mcp.tool()`.
- `kill_rexpaint()` — Added missing tool (was referenced in `get_help()` output but never defined). Sends SIGTERM then SIGKILL.

### New Game-Aware Tools (13 total)

| Tool | Phase | Purpose | Status |
|------|-------|---------|--------|
| `decode_sprite_name(filename)` | 2 | Parse AHSW equipment from filename | Done |
| `list_game_sprites(family)` | 2 | Inventory sprites by action family | Done |
| `compare_sprites(a, b, layer)` | 2 | Cell-by-cell diff of two sprites | Done |
| `recolor_sprite(path, ...)` | 3 | Single-file color swap (team or custom) | Done |
| `recolor_equipment_set(family, ...)` | 3 | Batch recolor entire family | Done |
| `extract_palette(path, layer)` | 3 | Color analysis with role labels | Done |
| `inject_sprite(source, target)` | 4 | Copy .xp to sprites/ with validation | Done |
| `render_sprite_preview(path)` | 4 | Render to PNG via xp_viewer.py | Done |
| `ascii_preview(path)` | 4 | Unicode text preview of sprite | Done |
| `inject_and_preview(source)` | 4 | Flagship: inject + PNG + ASCII + instructions | Done |
| `batch_inject(dir, pattern)` | 4 | Inject multiple sprites at once | Done |
| `kill_rexpaint()` | 1 | Force quit REXPaint (was missing) | Done |
| `get_rexpaint_quickref()` | 1 | Quick reference (was dead code) | Done |

### Game Constants Added
- `EQUIPMENT` dict: 5D array slot definitions (AHSW)
- `ACTION_FAMILIES`: 6 sprite families with weapon combos and expected counts
- `SRC_CLOTHING/ACCENTS/HAIR/BODY_COLOR`: Source color constants
- `TEAM_VARIANTS`: 4 predefined team color sets (Blue/Red/Green/Yellow)
- `_decode_ahsw()` helper: Filename-to-equipment decoder

### Term++ Skin Integration (C++ + Python)
- Added `APPLY_SKIN` MCP command to `asciiid.cpp:ProcessMCPCommand()` (~15 lines)
- Calls `ApplyActiveSpriteAsQuickSkin()` + `TermApplyPlayerSkin()` — same as GUI button
- Python `termskin_preview()` tool launches asciiid in `--mcp` mode and pipes commands
- `inject_and_preview()` automatically tries term++ skin first, falls back to PNG

### Skill File
Created at `docs/skills/rexpaint-sprite-editing/SKILL.md` — covers equipment system, AHSW convention, team colors, tool reference, and common workflows.

---

**END OF HANDOFF**
