# MVP Requirements Diff and Status

Date: 2026-02-22 (updated 2026-02-23)

Comparison baseline:
- Source feature inventory: `/Users/r/Downloads/asciicker-Y9-2/.claude/skills/xp-asset-knowledge/references/web-ui-features.md`
- Current v2 checklist: `docs/REQUIREMENTS_CHECKLIST.md`
- Current v2 implementation: `web/*.html`, `web/*.js`, `src/pipeline_v2/*.py`

Verdict vocabulary:
- `THRESHOLD_MET`
- `THRESHOLD_BREACHED`
- `HUMAN_REVIEW_REQUIRED`
- `BLOCKED`

## A) Contract and Flow MVP

| Requirement | v2 Evidence | Verdict |
|---|---|---|
| Upload PNG works | `web/wizard.html:16`, `web/wizard.js:14`, `src/pipeline_v2/app.py:43`, `src/pipeline_v2/service.py:56` | `THRESHOLD_MET` |
| Analyze returns geometry suggestions | `src/pipeline_v2/app.py:52`, `src/pipeline_v2/service.py:78` | `THRESHOLD_MET` |
| Run requires explicit geometry inputs | `web/wizard.html:31`, `web/wizard.js:48`, `src/pipeline_v2/app.py:62`, `src/pipeline_v2/models.py:35` | `THRESHOLD_MET` |
| Fail-closed invalid geometry path exists | `src/pipeline_v2/service.py:353`, `src/pipeline_v2/service.py:360` | `THRESHOLD_MET` |
| Analyze→Run compatibility on real-sheet edge cases | `src/pipeline_v2/service.py` geometry-search analyze defaults + `output/evidence/2026-02-23-analyze-run-compat-sweep.json` (`39/39` run-compatible) | `THRESHOLD_MET` |
| Run returns artifact paths (`xp`, `preview`, `gates`, `trace`) | `src/pipeline_v2/service.py:554` | `THRESHOLD_MET` |
| Workbench load-from-job returns populated session | `src/pipeline_v2/app.py:96`, `src/pipeline_v2/service.py:572` | `THRESHOLD_MET` |
| Workbench export returns `xp_path` + `checksum` | `src/pipeline_v2/app.py:108`, `src/pipeline_v2/service.py:624` | `THRESHOLD_MET` |
| Workbench save-session for edited state | `src/pipeline_v2/app.py` `/api/workbench/save-session`, `src/pipeline_v2/service.py` `workbench_save_session` | `THRESHOLD_MET` |
| XP Tool command/open endpoints exist | `src/pipeline_v2/app.py` `/api/workbench/xp-tool-command` + `/api/workbench/open-in-xp-tool`, `tests/test_workbench_flow.py` dry-run verification | `THRESHOLD_MET` |

## B) Workbench Controls MVP (User-critical)

Control verification artifact: `output/controls_audit.json` (`62/62` checks in latest local run).

| Requirement | v2 Evidence | Verdict |
|---|---|---|
| `Load From Job` | `web/workbench.html:15`, `web/workbench.js` load handler | `THRESHOLD_MET` |
| `Export XP` | `web/workbench.html:16`, `web/workbench.js` export handler | `THRESHOLD_MET` |
| Grid selection + shift range | `web/workbench.js` `selectFrame()` | `THRESHOLD_MET` |
| Context menu delete | `web/workbench.html` `#gridContextMenu/#ctxDelete`, `web/workbench.js` context handlers | `THRESHOLD_MET` |
| Undo | `web/workbench.html` `#undoBtn`, `web/workbench.js` history stack | `THRESHOLD_MET` |
| Redo | `web/workbench.html` `#redoBtn`, `web/workbench.js` history stack | `THRESHOLD_MET` |
| Row reorder | `web/workbench.html` `#rowUpBtn/#rowDownBtn`, `web/workbench.js` `moveSelectedRow()` | `THRESHOLD_MET` |
| Column reorder | `web/workbench.html` `#colLeftBtn/#colRightBtn`, `web/workbench.js` `moveSelectedCols()` | `THRESHOLD_MET` |
| Draw box | `web/workbench.html` `#drawBoxBtn`, `#sourceCanvas`, `web/workbench.js` mouse handlers | `THRESHOLD_MET` |
| Find sprites honors bbox size anchor | `web/workbench.js` `findSprites()` (anchor score + best-match fallback) | `THRESHOLD_MET` |
| Assign animation category | `web/workbench.html` `#assignAnimCategoryBtn`, `web/workbench.js` `assignRowCategory()` | `THRESHOLD_MET` |
| Assign selected frame group | `web/workbench.html` `#assignFrameGroupBtn`, `web/workbench.js` `assignFrameGroup()` | `THRESHOLD_MET` |
| Apply frame groups to anim metadata | `web/workbench.html` `#applyGroupsToAnimsBtn`, `web/workbench.js` `applyGroupsToAnims()` | `THRESHOLD_MET` |
| XP preview integrated in workbench | `web/workbench.html` `#previewCanvas`, `#playBtn/#stopBtn`, `web/workbench.js` preview renderer | `THRESHOLD_MET` |
| Direct workbench upload/analyze/run path | `web/workbench.html` `#wbFile/#wbUpload/#wbAnalyze/#wbRun`, `web/workbench.js` corresponding handlers | `THRESHOLD_MET` |
| XP tool view integrated into workflow (no blind export-only path) | `web/workbench.html` `#openXpToolBtn/#xpToolCommandHint`, `web/workbench.js` `refreshXpToolCommand()/openInXpTool()`, Playwright evidence `output/evidence/2026-02-23-xptool-integrated-local-3sheet-v3.json` | `THRESHOLD_MET` |

## C) Verification Artifacts

| Item | Evidence | Verdict |
|---|---|---|
| Unit/contract/workbench tests | `PYTHONPATH=src pytest -q` (12 passed) | `THRESHOLD_MET` |
| Browser E2E flow | `output/evidence/2026-02-23-e2e-summary.json` | `THRESHOLD_MET` |
| E2E screenshots for manual check | Cleaned per run artifact policy (JSON evidence retained only) | `HUMAN_REVIEW_REQUIRED` |
| Real-sheet analyze→run compatibility sweep | `output/evidence/2026-02-23-analyze-run-compat-sweep.json` (`39/39` `THRESHOLD_MET`) | `THRESHOLD_MET` |
| Real-sheet workflow with XP-tool integration step (2 known-bad + 1 known-good) | `output/evidence/2026-02-23-xptool-integrated-local-3sheet-v3.json` (`open_xp_tool_clicked` + `XP Tool launch requested` for all 3) | `THRESHOLD_MET` |
| XP Tool MCP frame diagnostics captured for exported sheets | `output/evidence/2026-02-23-xptool-mcp-analysis-v3.json` (`analyze_sequence` + per-frame component stats) | `THRESHOLD_MET` |
| Human signoff record for release | Pending user signoff | `HUMAN_REVIEW_REQUIRED` |

## D) Current MVP Gate Decision

- `RELEASE_VERDICT=THRESHOLD_BREACHED`
- Blocking reason: visual conversion fidelity for known real-sheet failures still needs explicit human XP-tool inspection outputs tied to this patchset (`FL-034` remains open).
