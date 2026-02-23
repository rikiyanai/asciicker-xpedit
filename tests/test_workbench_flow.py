from __future__ import annotations

import json
from pathlib import Path


def _upload(client, path: Path):
    with path.open("rb") as f:
        return client.post("/api/upload", data={"file": (f, path.name)}, content_type="multipart/form-data")


def test_wizard_to_workbench_to_export(client):
    fixture = Path(__file__).parent / "fixtures" / "known_good" / "cat_sheet.png"
    up = _upload(client, fixture).get_json()

    run_payload = {
        "source_path": up["source_path"],
        "name": "cat",
        "angles": 1,
        "frames": "8",
        "source_projs": 1,
        "render_resolution": 24,
    }
    run_resp = client.post("/api/run", data=json.dumps(run_payload), content_type="application/json")
    assert run_resp.status_code == 200
    run_data = run_resp.get_json()

    wb_resp = client.post(
        "/api/workbench/load-from-job",
        data=json.dumps({"job_id": run_data["job_id"]}),
        content_type="application/json",
    )
    assert wb_resp.status_code == 201
    wb_data = wb_resp.get_json()
    assert wb_data["populated_cells"] > 0
    assert wb_data["grid_cols"] > 0
    assert wb_data["grid_rows"] > 0

    export_resp = client.post(
        "/api/workbench/export-xp",
        data=json.dumps({"session_id": wb_data["session_id"]}),
        content_type="application/json",
    )
    assert export_resp.status_code == 200
    export_data = export_resp.get_json()
    assert Path(export_data["xp_path"]).exists()
    assert export_data["checksum"]

    cmd_resp = client.post(
        "/api/workbench/xp-tool-command",
        data=json.dumps({"xp_path": export_data["xp_path"]}),
        content_type="application/json",
    )
    assert cmd_resp.status_code == 200
    cmd_data = cmd_resp.get_json()
    assert "scripts.asset_gen.xp_tool" in cmd_data["command"]

    open_resp = client.post(
        "/api/workbench/open-in-xp-tool",
        data=json.dumps({"xp_path": export_data["xp_path"], "dry_run": True}),
        content_type="application/json",
    )
    assert open_resp.status_code == 200
    open_data = open_resp.get_json()
    assert open_data["dry_run"] is True
    assert open_data["launched"] is False
