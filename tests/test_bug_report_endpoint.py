from __future__ import annotations

import json
from pathlib import Path


def test_bug_report_endpoint_persists_report(client):
    payload = {
        "category": "whole_sheet_editor",
        "severity": "major",
        "description": "Whole-sheet editor did not update after switching bundle action.",
        "metadata": {
            "sessionId": "sess-123",
            "bundleStatus": "1/3 actions ready",
        },
        "uiRecorder": {
            "active": False,
            "eventCount": 2,
            "events": [
                {"type": "click", "detail": {"id": "btnNewXp"}},
                {"type": "status_change", "detail": {"wbStatus": "Load failed"}},
            ],
        },
    }
    resp = client.post(
        "/api/workbench/report-bug",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["ok"] is True
    report_path = Path(data["report_path"])
    assert report_path.exists()
    doc = json.loads(report_path.read_text(encoding="utf-8"))
    assert doc["payload"]["category"] == "whole_sheet_editor"
    assert doc["payload"]["severity"] == "major"
    assert doc["payload"]["metadata"]["sessionId"] == "sess-123"


def test_bug_report_endpoint_requires_description(client):
    payload = {
        "category": "layout_rendering",
        "severity": "minor",
        "description": "",
    }
    resp = client.post(
        "/api/workbench/report-bug",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["code"] == "missing_description"
