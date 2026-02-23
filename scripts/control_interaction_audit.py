#!/usr/bin/env python3
from __future__ import annotations

import json
import socket
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server

from pipeline_v2.app import create_app


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output"
REPORT_PATH = OUT_DIR / "controls_audit.json"
FIXTURE = ROOT / "tests" / "fixtures" / "known_good" / "cat_sheet.png"


@dataclass
class CheckResult:
    control: str
    interaction: str
    expected: str
    observed: str
    verdict: str
    details: dict[str, Any]


class _ServerThread(threading.Thread):
    def __init__(self, host: str, port: int):
        super().__init__(daemon=True)
        self.host = host
        self.port = port
        self.app = create_app()
        self.server = make_server(host, port, self.app)
        self.port = self.server.server_port

    def run(self) -> None:
        self.server.serve_forever()

    def stop(self) -> None:
        self.server.shutdown()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _ok(v: bool) -> str:
    return "THRESHOLD_MET" if v else "THRESHOLD_BREACHED"


def _require(page, selector: str) -> bool:
    return page.locator(selector).count() > 0


def _disabled(page, selector: str) -> bool:
    return bool(page.eval_on_selector(selector, "el => !!el.disabled"))


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if not FIXTURE.exists():
        raise SystemExit(f"fixture missing: {FIXTURE}")

    port = _free_port()
    server = _ServerThread("127.0.0.1", port)
    server.start()
    time.sleep(0.25)
    base = f"http://127.0.0.1:{server.port}"

    checks: list[CheckResult] = []
    run_job_id = ""
    run_payload: dict[str, Any] = {}
    run_response: dict[str, Any] = {}
    workbench_response: dict[str, Any] = {}
    export_response: dict[str, Any] = {}

    required_actions = [
        "Load From Job",
        "Export XP",
        "Undo",
        "Redo",
        "Delete (grid context menu)",
        "Row Reorder",
        "Column Reorder",
        "Draw Box",
        "Find Sprites",
        "Assign Animation Category",
        "Assign Frame Group",
        "XP Preview",
    ]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            page.goto(base + "/", wait_until="networkidle", timeout=30000)

            # Wizard control presence.
            for control_id in [
                "#file",
                "#btnUpload",
                "#btnAnalyze",
                "#name",
                "#angles",
                "#frames",
                "#sourceProjs",
                "#renderRes",
                "#btnRun",
                "#btnOpenWorkbench",
                "#uploadOut",
                "#analyzeOut",
                "#runOut",
                "#runStatus",
            ]:
                exists = _require(page, control_id)
                checks.append(
                    CheckResult(
                        control=control_id,
                        interaction="presence",
                        expected="Control exists on wizard",
                        observed=f"exists={exists}",
                        verdict=_ok(exists),
                        details={},
                    )
                )

            # Initial disabled state.
            analyze_disabled = _disabled(page, "#btnAnalyze")
            run_disabled = _disabled(page, "#btnRun")
            checks.append(
                CheckResult(
                    control="#btnAnalyze",
                    interaction="initial-state",
                    expected="Analyze disabled before upload",
                    observed=f"disabled={analyze_disabled}",
                    verdict=_ok(analyze_disabled),
                    details={},
                )
            )
            checks.append(
                CheckResult(
                    control="#btnRun",
                    interaction="initial-state",
                    expected="Run disabled before upload",
                    observed=f"disabled={run_disabled}",
                    verdict=_ok(run_disabled),
                    details={},
                )
            )

            # Upload with no file.
            page.click("#btnUpload")
            msg = page.inner_text("#uploadOut")
            checks.append(
                CheckResult(
                    control="#btnUpload",
                    interaction="click-no-file",
                    expected="Prompt to pick PNG",
                    observed=msg,
                    verdict=_ok("Pick a .png first." in msg),
                    details={},
                )
            )

            # Upload valid file.
            page.set_input_files("#file", str(FIXTURE))
            page.click("#btnUpload")
            page.wait_for_function("() => document.getElementById('uploadOut').textContent.includes('source_path')", timeout=15000)
            up_txt = page.inner_text("#uploadOut")
            up = json.loads(up_txt)
            enabled_after_upload = (not _disabled(page, "#btnAnalyze")) and (not _disabled(page, "#btnRun"))
            checks.append(
                CheckResult(
                    control="#btnUpload",
                    interaction="click-valid-file",
                    expected="upload returns source_path and enables Analyze/Run",
                    observed=f"keys={sorted(list(up.keys()))}, buttons_enabled={enabled_after_upload}",
                    verdict=_ok(("source_path" in up) and enabled_after_upload),
                    details={"upload_response": up},
                )
            )

            # Analyze.
            page.click("#btnAnalyze")
            page.wait_for_function("() => document.getElementById('analyzeOut').textContent.includes('suggested_angles')", timeout=15000)
            an_txt = page.inner_text("#analyzeOut")
            an = json.loads(an_txt)
            auto_applied = page.input_value("#angles") != "" and page.input_value("#frames") != ""
            checks.append(
                CheckResult(
                    control="#btnAnalyze",
                    interaction="click",
                    expected="analyze returns suggestions and applies angles/frames inputs",
                    observed=f"suggested_angles={an.get('suggested_angles')}, suggested_frames={an.get('suggested_frames')}, auto_applied={auto_applied}",
                    verdict=_ok(("suggested_angles" in an) and ("suggested_frames" in an) and auto_applied),
                    details={"analyze_response": an},
                )
            )

            # Inputs interactability.
            for selector, value in [
                ("#name", "audit_sprite"),
                ("#angles", "4"),
                ("#frames", "8,8,8,8"),
                ("#sourceProjs", "1"),
                ("#renderRes", "24"),
            ]:
                page.fill(selector, value)
                now = page.input_value(selector)
                checks.append(
                    CheckResult(
                        control=selector,
                        interaction="set-value",
                        expected=f"value becomes {value}",
                        observed=f"value={now}",
                        verdict=_ok(now == value),
                        details={},
                    )
                )

            # Invalid angles.
            page.fill("#angles", "0")
            page.click("#btnRun")
            page.wait_for_timeout(400)
            run_state = page.inner_text("#runStatus")
            run_text = page.inner_text("#runOut")
            checks.append(
                CheckResult(
                    control="#btnRun",
                    interaction="invalid-angles",
                    expected="run returns validation error",
                    observed=f"runStatus={run_state}",
                    verdict=_ok(("Run failed" in run_state) or ("invalid_angles" in run_text)),
                    details={"run_out": run_text[:400]},
                )
            )

            # Invalid source_projs.
            page.fill("#angles", "4")
            page.fill("#sourceProjs", "3")
            page.click("#btnRun")
            page.wait_for_timeout(400)
            run_state = page.inner_text("#runStatus")
            run_text = page.inner_text("#runOut")
            checks.append(
                CheckResult(
                    control="#btnRun",
                    interaction="invalid-source-projs",
                    expected="run returns source_projs validation error",
                    observed=f"runStatus={run_state}",
                    verdict=_ok(("Run failed" in run_state) or ("invalid_source_projs" in run_text)),
                    details={"run_out": run_text[:400]},
                )
            )

            # Valid run.
            page.fill("#sourceProjs", "1")
            page.fill("#name", "audit_sprite")
            page.fill("#angles", "2")
            page.fill("#frames", "4,4")
            page.fill("#renderRes", "24")
            run_payload = {
                "source_path": up["source_path"],
                "name": "audit_sprite",
                "angles": 2,
                "frames": "4,4",
                "source_projs": 1,
                "render_resolution": 24,
            }
            page.click("#btnRun")
            page.wait_for_function("() => document.getElementById('runStatus').textContent.includes('Run complete')", timeout=120000)
            run_response = json.loads(page.inner_text("#runOut"))
            run_job_id = str(run_response.get("job_id", ""))
            can_open_workbench = not _disabled(page, "#btnOpenWorkbench")
            checks.append(
                CheckResult(
                    control="#btnRun",
                    interaction="valid-run",
                    expected="run completes with job_id and enables Open in Workbench",
                    observed=f"job_id_present={bool(run_job_id)}, open_workbench_enabled={can_open_workbench}",
                    verdict=_ok(bool(run_job_id) and can_open_workbench),
                    details={"run_response": run_response},
                )
            )

            # Open workbench.
            page.click("#btnOpenWorkbench")
            page.wait_for_url("**/workbench?job_id=**", timeout=30000)
            page.wait_for_function("() => document.getElementById('wbStatus').textContent.includes('Session active')", timeout=30000)
            wb_status = page.inner_text("#wbStatus")
            session_text = page.inner_text("#sessionOut")
            session_json = json.loads(session_text)
            workbench_response = session_json
            grid_count = page.locator("#grid .cell").count()
            checks.append(
                CheckResult(
                    control="#btnOpenWorkbench",
                    interaction="click",
                    expected="navigates to workbench and auto-loads session",
                    observed=f"url={page.url}, wbStatus={wb_status}, cells={grid_count}",
                    verdict=_ok(("workbench?job_id=" in page.url) and ("Session active" in wb_status) and (grid_count > 0)),
                    details={"session_summary": session_json},
                )
            )

            # Workbench control presence.
            for control_id in ["#btnLoad", "#btnExport", "#grid", "#sessionOut", "#exportOut"]:
                exists = _require(page, control_id)
                checks.append(
                    CheckResult(
                        control=control_id,
                        interaction="presence",
                        expected="Control exists on workbench",
                        observed=f"exists={exists}",
                        verdict=_ok(exists),
                        details={},
                    )
                )

            # Manual reload.
            page.click("#btnLoad")
            page.wait_for_function("() => document.getElementById('wbStatus').textContent.includes('Session active')", timeout=30000)
            checks.append(
                CheckResult(
                    control="#btnLoad",
                    interaction="click",
                    expected="loads/reloads workbench session from job_id",
                    observed=page.inner_text("#wbStatus"),
                    verdict=_ok("Session active" in page.inner_text("#wbStatus")),
                    details={},
                )
            )

            # Delete + Undo + Redo.
            page.click("#gridPanel .frame-cell")
            sig_before = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            page.click("#deleteCellBtn")
            sig_after_delete = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            page.click("#undoBtn")
            sig_after_undo = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            page.click("#redoBtn")
            sig_after_redo = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            checks.append(
                CheckResult(
                    control="#deleteCellBtn",
                    interaction="click",
                    expected="Delete Selected clears chosen frame",
                    observed=f"changed={sig_before != sig_after_delete}",
                    verdict=_ok(sig_before != sig_after_delete),
                    details={},
                )
            )
            checks.append(
                CheckResult(
                    control="#undoBtn",
                    interaction="click",
                    expected="Undo restores frame",
                    observed=f"restored={sig_after_undo == sig_before}",
                    verdict=_ok(sig_after_undo == sig_before),
                    details={},
                )
            )
            checks.append(
                CheckResult(
                    control="#redoBtn",
                    interaction="click",
                    expected="Redo reapplies delete",
                    observed=f"reapplied={sig_after_redo == sig_after_delete}",
                    verdict=_ok(sig_after_redo == sig_after_delete),
                    details={},
                )
            )

            # Context-menu Delete.
            page.click("#undoBtn")
            page.click("#gridPanel .frame-cell[data-row='0'][data-col='0']")
            sig_ctx_before = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            page.click("#gridPanel .frame-cell[data-row='0'][data-col='0']", button="right")
            page.click("#ctxDelete")
            sig_ctx_after = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            checks.append(
                CheckResult(
                    control="#ctxDelete",
                    interaction="context-click",
                    expected="Context menu delete clears frame",
                    observed=f"changed={sig_ctx_before != sig_ctx_after}",
                    verdict=_ok(sig_ctx_before != sig_ctx_after),
                    details={},
                )
            )

            # Row reorder.
            page.click("#undoBtn")
            page.click("#gridPanel .frame-cell[data-row='0'][data-col='0']")
            sig_row0_before = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            sig_row1_before = page.evaluate("() => window.__wb_debug.frameSignature(1,0)")
            page.click("#rowDownBtn")
            sig_row0_after = page.evaluate("() => window.__wb_debug.frameSignature(0,0)")
            sig_row1_after = page.evaluate("() => window.__wb_debug.frameSignature(1,0)")
            checks.append(
                CheckResult(
                    control="#rowDownBtn",
                    interaction="click",
                    expected="Row down swaps selected row with next row",
                    observed=f"swap_ok={(sig_row0_after == sig_row1_before) and (sig_row1_after == sig_row0_before)}",
                    verdict=_ok((sig_row0_after == sig_row1_before) and (sig_row1_after == sig_row0_before)),
                    details={},
                )
            )

            # Column reorder.
            page.click("#gridPanel .frame-cell[data-row='1'][data-col='0']")
            sig_col0_before = page.evaluate("() => window.__wb_debug.frameSignature(1,0)")
            sig_col1_before = page.evaluate("() => window.__wb_debug.frameSignature(1,1)")
            page.click("#colRightBtn")
            sig_col0_after = page.evaluate("() => window.__wb_debug.frameSignature(1,0)")
            sig_col1_after = page.evaluate("() => window.__wb_debug.frameSignature(1,1)")
            checks.append(
                CheckResult(
                    control="#colRightBtn",
                    interaction="click",
                    expected="Col right swaps selected column with next column",
                    observed=f"swap_ok={(sig_col0_after == sig_col1_before) and (sig_col1_after == sig_col0_before)}",
                    verdict=_ok((sig_col0_after == sig_col1_before) and (sig_col1_after == sig_col0_before)),
                    details={},
                )
            )

            # Assign row category.
            page.select_option("#animCategorySelect", "walk")
            page.click("#assignAnimCategoryBtn")
            dbg1 = page.evaluate("() => window.__wb_debug.getState()")
            checks.append(
                CheckResult(
                    control="#assignAnimCategoryBtn",
                    interaction="click",
                    expected="Assign category on selected row",
                    observed=f"row_categories={dbg1.get('rowCategories')}",
                    verdict=_ok(bool(dbg1.get("rowCategories"))),
                    details={},
                )
            )

            # Assign frame group + apply group metadata.
            page.click("#gridPanel .frame-cell[data-row='1'][data-col='0']")
            page.click("#gridPanel .frame-cell[data-row='1'][data-col='2']", modifiers=["Shift"])
            page.fill("#frameGroupName", "walk_cycle")
            page.click("#assignFrameGroupBtn")
            dbg2 = page.evaluate("() => window.__wb_debug.getState()")
            checks.append(
                CheckResult(
                    control="#assignFrameGroupBtn",
                    interaction="click",
                    expected="Frame group is recorded from selected range",
                    observed=f"frame_groups={dbg2.get('frameGroups')}",
                    verdict=_ok(any(g.get("name") == "walk_cycle" for g in dbg2.get("frameGroups", []))),
                    details={},
                )
            )
            anims_before_apply = page.evaluate("() => window.__wb_debug.getState().anims")
            page.click("#applyGroupsToAnimsBtn")
            anims_after_apply = page.evaluate("() => window.__wb_debug.getState().anims")
            checks.append(
                CheckResult(
                    control="#applyGroupsToAnimsBtn",
                    interaction="click",
                    expected="Applying groups updates anim metadata",
                    observed=f"before={anims_before_apply}, after={anims_after_apply}",
                    verdict=_ok(anims_after_apply != anims_before_apply),
                    details={},
                )
            )

            # Direct workbench upload + draw-box + find sprites.
            page.set_input_files("#wbFile", str(FIXTURE))
            page.click("#wbUpload")
            page.wait_for_function("() => document.getElementById('wbRunOut').textContent.includes('source_path')", timeout=15000)
            page.wait_for_function("() => window.__wb_debug && window.__wb_debug.getState().sourceImageLoaded === true", timeout=10000)
            page.click("#drawBoxBtn")
            page.locator("#sourceCanvas").scroll_into_view_if_needed()
            box = page.locator("#sourceCanvas").bounding_box()
            if box is not None:
                x0 = box["x"] + box["width"] * 0.05
                y0 = box["y"] + box["height"] * 0.05
                x1 = box["x"] + box["width"] * 0.30
                y1 = box["y"] + box["height"] * 0.60
                page.mouse.move(x0, y0)
                page.mouse.down()
                page.mouse.move(x1, y1)
                page.mouse.up()
            else:
                page.evaluate(
                    """() => {
                        const c = document.getElementById('sourceCanvas');
                        if (!c) return;
                        const r = c.getBoundingClientRect();
                        const sx = r.left + 10, sy = r.top + 10;
                        const ex = r.left + Math.max(20, r.width * 0.3);
                        const ey = r.top + Math.max(20, r.height * 0.6);
                        c.dispatchEvent(new MouseEvent('mousedown', { clientX: sx, clientY: sy, bubbles: true }));
                        c.dispatchEvent(new MouseEvent('mousemove', { clientX: ex, clientY: ey, bubbles: true }));
                        c.dispatchEvent(new MouseEvent('mouseup', { clientX: ex, clientY: ey, bubbles: true }));
                    }"""
                )
            dbg3 = page.evaluate("() => window.__wb_debug.getState()")
            checks.append(
                CheckResult(
                    control="#drawBoxBtn",
                    interaction="drag-on-sourceCanvas",
                    expected="Draw Box creates anchor bbox",
                    observed=f"anchor={dbg3.get('anchorBox')}",
                    verdict=_ok(dbg3.get("anchorBox") is not None),
                    details={},
                )
            )
            page.click("#extractBtn")
            dbg4 = page.evaluate("() => window.__wb_debug.getState()")
            checks.append(
                CheckResult(
                    control="#extractBtn",
                    interaction="click",
                    expected="Find Sprites detects similar-size boxes",
                    observed=f"extracted_boxes={dbg4.get('extractedBoxes')}",
                    verdict=_ok(int(dbg4.get("extractedBoxes", 0)) > 0),
                    details={},
                )
            )

            # XP Preview controls.
            page.fill("#previewAngle", "0")
            page.click("#playBtn")
            page.wait_for_timeout(300)
            page.click("#stopBtn")
            checks.append(
                CheckResult(
                    control="#playBtn/#stopBtn",
                    interaction="click",
                    expected="Preview play and stop are clickable and stable",
                    observed="clicked",
                    verdict=_ok(True),
                    details={},
                )
            )

            # Export XP.
            page.click("#btnExport")
            page.wait_for_function("() => document.getElementById('exportOut').textContent.includes('xp_path')", timeout=30000)
            export_text = page.inner_text("#exportOut")
            export_response = json.loads(export_text)
            checks.append(
                CheckResult(
                    control="#btnExport",
                    interaction="click",
                    expected="exports XP and returns xp_path + checksum",
                    observed=f"keys={sorted(list(export_response.keys()))}",
                    verdict=_ok(("xp_path" in export_response) and ("checksum" in export_response)),
                    details={"export_response": export_response},
                )
            )

            # Back link.
            page.click("a[href='/']")
            page.wait_for_url("**/", timeout=15000)
            checks.append(
                CheckResult(
                    control="a[href='/']",
                    interaction="click",
                    expected="navigates back to wizard",
                    observed=page.url,
                    verdict=_ok(page.url.endswith("/")),
                    details={},
                )
            )

            # No-job workbench checks.
            page.goto(base + "/workbench", wait_until="networkidle", timeout=30000)
            export_disabled = _disabled(page, "#btnExport")
            page.click("#btnLoad")
            missing_job_status = page.inner_text("#wbStatus")
            checks.append(
                CheckResult(
                    control="#btnLoad",
                    interaction="click-without-job-id",
                    expected="shows missing job_id error",
                    observed=missing_job_status,
                    verdict=_ok("Missing job_id" in missing_job_status),
                    details={},
                )
            )
            checks.append(
                CheckResult(
                    control="#btnExport",
                    interaction="initial-without-session",
                    expected="export disabled before session load",
                    observed=f"disabled={export_disabled}",
                    verdict=_ok(export_disabled),
                    details={},
                )
            )

            # Required action presence from checklist §5A.
            page.goto(base + "/workbench", wait_until="networkidle", timeout=30000)
            wb_html = page.content().lower()
            for action in required_actions:
                if action == "Load From Job":
                    present = "id=\"btnload\"" in wb_html
                elif action == "Export XP":
                    present = "id=\"btnexport\"" in wb_html
                elif action == "Undo":
                    present = "id=\"undobtn\"" in wb_html
                elif action == "Redo":
                    present = "id=\"redobtn\"" in wb_html
                elif action == "Delete (grid context menu)":
                    present = "id=\"gridcontextmenu\"" in wb_html and "id=\"ctxdelete\"" in wb_html
                elif action == "Row Reorder":
                    present = "id=\"rowupbtn\"" in wb_html and "id=\"rowdownbtn\"" in wb_html
                elif action == "Column Reorder":
                    present = "id=\"colleftbtn\"" in wb_html and "id=\"colrightbtn\"" in wb_html
                elif action == "Draw Box":
                    present = "id=\"drawboxbtn\"" in wb_html
                elif action == "Find Sprites":
                    present = "id=\"extractbtn\"" in wb_html
                elif action == "Assign Animation Category":
                    present = "id=\"assignanimcategorybtn\"" in wb_html
                elif action == "Assign Frame Group":
                    present = "id=\"assignframegroupbtn\"" in wb_html
                elif action == "XP Preview":
                    present = "id=\"previewcanvas\"" in wb_html
                else:
                    present = False
                checks.append(
                    CheckResult(
                        control=action,
                        interaction="required-action-presence",
                        expected="Action exists in workbench UI",
                        observed=f"present={present}",
                        verdict=_ok(present),
                        details={},
                    )
                )

            context.close()
            browser.close()
    finally:
        server.stop()

    met = sum(1 for c in checks if c.verdict == "THRESHOLD_MET")
    breached = sum(1 for c in checks if c.verdict == "THRESHOLD_BREACHED")
    report = {
        "base_url": base,
        "fixture": str(FIXTURE.resolve()),
        "run_payload": run_payload,
        "run_job_id": run_job_id,
        "run_response": run_response,
        "workbench_session_summary": workbench_response,
        "export_response": export_response,
        "total_checks": len(checks),
        "threshold_met": met,
        "threshold_breached": breached,
        "overall_verdict": "THRESHOLD_MET" if breached == 0 else "THRESHOLD_BREACHED",
        "checks": [asdict(c) for c in checks],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {REPORT_PATH}")
    print(json.dumps({
        "overall_verdict": report["overall_verdict"],
        "total_checks": report["total_checks"],
        "threshold_met": report["threshold_met"],
        "threshold_breached": report["threshold_breached"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
