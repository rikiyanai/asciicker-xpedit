from __future__ import annotations

import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .config import ensure_dirs, ROOT
from .models import ApiError, RunConfig, parse_frames_csv
from .service import (
    upload_image,
    analyze_image,
    run_pipeline,
    status,
    workbench_load_from_job,
    workbench_save_session,
    workbench_export_xp,
    workbench_xp_tool_command,
    workbench_open_in_xp_tool,
)


WEB_DIR = ROOT / "web"


def _err(e: ApiError):
    return jsonify(e.to_dict()), e.status


def create_app() -> Flask:
    ensure_dirs()
    app = Flask(__name__)

    @app.route("/")
    def wizard_page():
        return send_from_directory(WEB_DIR, "wizard.html")

    @app.route("/workbench")
    def workbench_page():
        return send_from_directory(WEB_DIR, "workbench.html")

    @app.route("/<path:filename>")
    def web_assets(filename: str):
        return send_from_directory(WEB_DIR, filename)

    @app.post("/api/upload")
    def api_upload():
        req_id = str(uuid.uuid4())
        try:
            file = request.files.get("file")
            return jsonify(upload_image(file, req_id)), 201
        except ApiError as e:
            return _err(e)

    @app.post("/api/analyze")
    def api_analyze():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            source_path = payload.get("source_path", "")
            return jsonify(analyze_image(source_path, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/run")
    def api_run():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            cfg = RunConfig(
                source_path=str(payload.get("source_path", "")),
                name=str(payload.get("name", "")).strip(),
                angles=int(payload.get("angles", 1)),
                frames=parse_frames_csv(payload.get("frames", "1"), req_id, "run"),
                source_projs=int(payload.get("source_projs", 1)),
                render_resolution=int(payload.get("render_resolution", 12)),
                bg_mode=str(payload.get("bg_mode", "key_color")),
                bg_tolerance=int(payload.get("bg_tolerance", 8)),
            )
            return jsonify(run_pipeline(cfg, req_id)), 200
        except ApiError as e:
            return _err(e)
        except ValueError as e:
            return jsonify({
                "error": str(e),
                "code": "invalid_payload",
                "stage": "run",
                "request_id": req_id,
            }), 422

    @app.get("/api/status/<job_id>")
    def api_status(job_id: str):
        req_id = str(uuid.uuid4())
        try:
            return jsonify(status(job_id, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/load-from-job")
    def api_wb_load():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            job_id = str(payload.get("job_id", "")).strip()
            if not job_id:
                raise ApiError("job_id is required", "missing_job_id", "workbench", req_id, 400)
            return jsonify(workbench_load_from_job(job_id, req_id)), 201
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/export-xp")
    def api_wb_export():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            return jsonify(workbench_export_xp(session_id, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/xp-tool-command")
    def api_wb_xp_tool_command():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            xp_path = str(payload.get("xp_path", "")).strip()
            if not xp_path:
                raise ApiError("xp_path is required", "missing_xp_path", "workbench", req_id, 400)
            return jsonify(workbench_xp_tool_command(xp_path, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/open-in-xp-tool")
    def api_wb_open_in_xp_tool():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            xp_path = str(payload.get("xp_path", "")).strip()
            if not xp_path:
                raise ApiError("xp_path is required", "missing_xp_path", "workbench", req_id, 400)
            raw = payload.get("dry_run", False)
            dry_run = raw if isinstance(raw, bool) else str(raw).lower() in {"1", "true", "yes", "on"}
            return jsonify(workbench_open_in_xp_tool(xp_path, req_id, dry_run=dry_run)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/save-session")
    def api_wb_save():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            return jsonify(workbench_save_session(session_id, payload, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.errorhandler(500)
    def api_500(_e):
        req_id = str(uuid.uuid4())
        return jsonify({
            "error": "internal server error",
            "code": "internal_error",
            "stage": "unknown",
            "request_id": req_id,
        }), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=5071, debug=False)
