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

    verify_dry_resp = client.post(
        "/api/workbench/run-verification",
        data=json.dumps({
            "session_id": wb_data["session_id"],
            "profile": "termpp_custom",
            "command_template": "echo verifying {xp_path}",
            "dry_run": True,
        }),
        content_type="application/json",
    )
    assert verify_dry_resp.status_code == 200
    verify_dry_data = verify_dry_resp.get_json()
    assert verify_dry_data["dry_run"] is True
    assert "verifying " in (verify_dry_data.get("command") or "")

    verify_local_resp = client.post(
        "/api/workbench/run-verification",
        data=json.dumps({
            "session_id": wb_data["session_id"],
            "profile": "local_xp_sanity",
            "timeout_sec": 10,
        }),
        content_type="application/json",
    )
    assert verify_local_resp.status_code == 200
    verify_local_data = verify_local_resp.get_json()
    assert verify_local_data["dry_run"] is False
    assert verify_local_data["profile"] == "local_xp_sanity"
    assert verify_local_data["passed"] is True
    assert Path(verify_local_data["report_path"]).exists()

    termpp_cmd_resp = client.post(
        "/api/workbench/termpp-skin-command",
        data=json.dumps({
            "session_id": wb_data["session_id"],
            "binary_name": "game_term",
        }),
        content_type="application/json",
    )
    assert termpp_cmd_resp.status_code == 200
    termpp_cmd_data = termpp_cmd_resp.get_json()
    assert termpp_cmd_data["binary_name"] == "game_term"
    assert termpp_cmd_data["planned_runtime_root"]
    assert termpp_cmd_data["xp_path"].endswith(".xp")

    termpp_dry_resp = client.post(
        "/api/workbench/open-termpp-skin",
        data=json.dumps({
            "session_id": wb_data["session_id"],
            "binary_name": "game_term",
            "dry_run": True,
        }),
        content_type="application/json",
    )
    assert termpp_dry_resp.status_code == 200
    termpp_dry_data = termpp_dry_resp.get_json()
    assert termpp_dry_data["dry_run"] is True
    assert termpp_dry_data["launched"] is False
    assert "runtime_root" in termpp_dry_data

    stream_dry_resp = client.post(
        "/api/workbench/termpp-stream/start",
        data=json.dumps({
            "session_id": wb_data["session_id"],
            "x": 0,
            "y": 0,
            "w": 320,
            "h": 240,
            "fps": 2,
            "dry_run": True,
        }),
        content_type="application/json",
    )
    assert stream_dry_resp.status_code == 200
    stream_dry_data = stream_dry_resp.get_json()
    assert stream_dry_data["dry_run"] is True
    assert stream_dry_data["region"]["w"] == 320
    assert stream_dry_data["region"]["h"] == 240

    web_skin_resp = client.post(
        "/api/workbench/web-skin-payload",
        data=json.dumps({"session_id": wb_data["session_id"]}),
        content_type="application/json",
    )
    assert web_skin_resp.status_code == 200
    web_skin_data = web_skin_resp.get_json()
    assert web_skin_data["xp_path"].endswith(".xp")
    assert web_skin_data["xp_size_bytes"] > 0
    assert len(web_skin_data["xp_b64"]) > 0
    assert "player-0000.xp" in web_skin_data["override_names"]
