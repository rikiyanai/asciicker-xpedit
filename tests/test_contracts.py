from __future__ import annotations

import json
from pathlib import Path


def _upload(client, path: Path):
    with path.open("rb") as f:
        resp = client.post("/api/upload", data={"file": (f, path.name)}, content_type="multipart/form-data")
    return resp


def test_upload_contract(client):
    fixture = Path(__file__).parent / "fixtures" / "known_good" / "cat_sheet.png"
    resp = _upload(client, fixture)
    assert resp.status_code == 201
    data = resp.get_json()
    for k in ("upload_id", "source_path", "width", "height", "sha256"):
        assert k in data
    assert data["width"] == 192
    assert data["height"] == 48


def test_analyze_contract(client):
    fixture = Path(__file__).parent / "fixtures" / "known_good" / "cat_sheet.png"
    up = _upload(client, fixture).get_json()
    resp = client.post("/api/analyze", data=json.dumps({"source_path": up["source_path"]}), content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    for k in ("image_w", "image_h", "suggested_angles", "suggested_frames", "suggested_cell_w", "suggested_cell_h", "confidence", "diagnostics"):
        assert k in data


def test_run_contract(client):
    fixture = Path(__file__).parent / "fixtures" / "known_good" / "cat_sheet.png"
    up = _upload(client, fixture).get_json()
    payload = {
        "source_path": up["source_path"],
        "name": "cat",
        "angles": 1,
        "frames": "8",
        "source_projs": 1,
        "render_resolution": 24,
    }
    resp = client.post("/api/run", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    for k in ("job_id", "state", "xp_path", "preview_paths", "metadata", "gate_report_path", "trace_path"):
        assert k in data
    assert Path(data["xp_path"]).exists()
    assert Path(data["gate_report_path"]).exists()


def test_error_contract_invalid_run(client):
    payload = {"source_path": "/tmp/nope.png", "name": "x", "angles": 1, "frames": "1"}
    resp = client.post("/api/run", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code in (404, 422)
    data = resp.get_json()
    for k in ("error", "code", "stage", "request_id"):
        assert k in data
