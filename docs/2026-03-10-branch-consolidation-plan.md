# Branch Consolidation and Merge Plan

## Current State (2026-03-10)

### Active Branches
- **master** (359f217) - Base checkpoint after fix/solo-only-load-contract merge
- **restore/bundle-override-filter-8279e11** (114f840) ← **CURRENT HEAD** - Adds XP upload API (2 new commits)
- **feat/workbench-mcp-server** (2ebfe6a) - 80 commits ahead: Full web editor + XP I/O classes
- **feat/sprite-extraction-dual-analysis** (52419fe) - Dual algorithm analysis + rexpaint-editor
- **template-forcefit-next** (d65575c) - Bundle mode UI work
- **checkpoint/pre-rexpaint-clone** (8279e11) - Earlier checkpoint
- **phase2-death-template** (8279e11) - Points to same as checkpoint
- **fix/solo-only-load-contract** (a74c72e) - 1 commit behind master (already merged)
- **experiment/render-gate-ab-matrix** (2e5aa25) - Experimental, diverged

## Problem Analysis

### 1. Branch Divergence Issue
Two major feature branches diverged from master:
- **feat/workbench-mcp-server**: Has 80 commits of editor work but no rexpaint-editor/ files
- **feat/sprite-extraction-dual-analysis**: Has the actual rexpaint-editor/ code but only 2 commits of new work

The Web REXPaint editor was split across branches:
- UI wiring code on feat/workbench-mcp-server  
- Editor module code on feat/sprite-extraction-dual-analysis
- Never properly merged/unified

### 2. Session 62-63 Attempted Integration
- Added XP upload API endpoint to feat/workbench-mcp-server
- But editor classes (XPFileReader/XPFileWriter) were only on feat/sprite-extraction-dual-analysis
- Result: Half-baked integration that never worked

### 3. Current Worktree State
- Main repo at restore/bundle-override-filter-8279e11 (has rexpaint-editor/ now)
- Worktree at .worktrees/sprite-extraction-dual-analysis/ (old, can be deleted)

## Merge Strategy (Non-Destructive)

### Step 1: Verify Current State ✓
- Current HEAD: restore/bundle-override-filter-8279e11
- Contains: XP upload API + rexpaint-editor/ files (just copied from worktree)
- Status: Ready to commit

### Step 2: Consolidate onto feat/workbench-mcp-server
**Goal**: Merge all working code into the editor feature branch

```bash
# Switch to editor branch
git checkout feat/workbench-mcp-server

# Merge in the XP upload API work
git merge restore/bundle-override-filter-8279e11

# Merge in sprite analysis features  
git merge feat/sprite-extraction-dual-analysis
```

### Step 3: Verify Result
- feat/workbench-mcp-server should have:
  - ✓ All 80 original editor commits
  - ✓ XP upload API endpoint
  - ✓ rexpaint-editor/ module with XPFileReader/XPFileWriter
  - ✓ Dual algorithm sprite analysis
  - ✓ All pipeline service updates

### Step 4: Test Integration
- Verify imports work
- Run API test: upload XP → export XP
- Run headed test: show roundtrip in browser
- Check git status is clean

### Step 5: Update master (if tests pass)
```bash
git checkout master
git merge --ff-only feat/workbench-mcp-server
```

## Branch Retention Decision

### Keep
- **master** - Base checkpoint
- **feat/workbench-mcp-server** - Main development branch (after merge)
- **template-forcefit-next** - Bundle mode work (separate concern)

### Delete (After Merge)
- restore/bundle-override-filter-8279e11 (work merged into feat/workbench-mcp-server)
- feat/sprite-extraction-dual-analysis (work merged into feat/workbench-mcp-server)
- fix/solo-only-load-contract (already in master)
- checkpoint/pre-rexpaint-clone (checkpoint, no longer needed)
- phase2-death-template (redundant with other branches)
- experiment/render-gate-ab-matrix (experimental, superseded)

## Commit Structure After Merge

feat/workbench-mcp-server will have:
1. Original 35 editor tasks (Tasks 9-35)
2. + Critical bug fixes (Tasks 9.5, 15.5, 19.5)
3. + XP File I/O (W1.1-W1.5)
4. + Sprite extraction algorithms (T1-T5)
5. + XP upload API endpoint
6. + Clean git history with semantic commits

## Risk Assessment

**Low Risk**: 
- No force-pushing to master
- All work already exists (just consolidating)
- Can always revert to master if needed

**Merge Conflicts Expected**:
- xp_codec.py (both branches modified)
- app.py (both branches added endpoints)
- service.py (both branches added functions)
- Models might diverge

**Mitigation**:
- Cherry-pick commits instead of full merges if conflicts are severe
- Test each step before proceeding to next

## What You'll Have After Consolidation

**Single clean branch** (feat/workbench-mcp-server) with:
- ✓ Working Web REXPaint editor (all 35 tasks)
- ✓ XP file I/O roundtrip (upload → session → export)
- ✓ Sprite extraction and analysis  
- ✓ RESTful API for all operations
- ✓ Proper test coverage

**All temporary branches cleaned up**
- Branches with no new work deleted
- Experimental branches archived
- Clean git history for future collaboration
