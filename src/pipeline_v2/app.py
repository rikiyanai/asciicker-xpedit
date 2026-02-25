from __future__ import annotations

import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, send_file

from .config import ensure_dirs, ROOT, EXPORT_DIR
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
    workbench_run_verification,
    workbench_termpp_skin_command,
    workbench_open_termpp_skin,
    workbench_termpp_stream_start,
    workbench_termpp_stream_stop,
    workbench_termpp_stream_status,
    workbench_termpp_stream_frame_path,
    workbench_web_skin_payload,
)


WEB_DIR = ROOT / "web"
LEGACY_WEB_DIR = (ROOT.parent / "asciicker-Y9-2" / ".web").resolve()
STATIC_FLAT_WEB_DIR = (ROOT / "output" / "termpp-skin-lab-static" / "termpp-web-flat").resolve()


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

    @app.route("/termpp-skin-lab")
    def termpp_skin_lab_page():
        return send_from_directory(WEB_DIR, "termpp_skin_lab.html")

    @app.route("/<path:filename>")
    def web_assets(filename: str):
        return send_from_directory(WEB_DIR, filename)

    @app.route("/termpp-web")
    def termpp_web_index_alias():
        return send_from_directory(LEGACY_WEB_DIR, "index.html")

    @app.route("/termpp-web/<path:filename>")
    def termpp_web_assets(filename: str):
        return send_from_directory(LEGACY_WEB_DIR, filename)

    @app.route("/termpp-web-flat")
    def termpp_web_flat_index_alias():
        return send_from_directory(STATIC_FLAT_WEB_DIR, "index.html")

    @app.route("/termpp-web-flat/<path:filename>")
    def termpp_web_flat_assets(filename: str):
        return send_from_directory(STATIC_FLAT_WEB_DIR, filename)

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

    @app.get("/api/workbench/download-xp")
    def api_wb_download_xp():
        req_id = str(uuid.uuid4())
        try:
            raw_path = str(request.args.get("xp_path", "")).strip()
            if not raw_path:
                raise ApiError("xp_path is required", "missing_xp_path", "workbench", req_id, 400)
            xp_path = Path(raw_path).expanduser().resolve()
            export_root = EXPORT_DIR.resolve()
            if export_root not in xp_path.parents or xp_path.suffix.lower() != ".xp":
                raise ApiError("xp_path must be an exported .xp under data/exports", "invalid_xp_path", "workbench", req_id, 400)
            if not xp_path.is_file():
                raise ApiError("xp file not found", "xp_not_found", "workbench", req_id, 404)
            return send_file(xp_path, mimetype="application/octet-stream", as_attachment=True, download_name=xp_path.name, max_age=0)
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

    @app.post("/api/workbench/termpp-skin-command")
    def api_wb_termpp_skin_command():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            binary_name = str(payload.get("binary_name", "game_term")).strip() or "game_term"
            return jsonify(workbench_termpp_skin_command(session_id, req_id, binary_name=binary_name)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/open-termpp-skin")
    def api_wb_open_termpp_skin():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            binary_name = str(payload.get("binary_name", "game_term")).strip() or "game_term"
            raw = payload.get("dry_run", False)
            dry_run = raw if isinstance(raw, bool) else str(raw).lower() in {"1", "true", "yes", "on"}
            return jsonify(workbench_open_termpp_skin(session_id, req_id, binary_name=binary_name, dry_run=dry_run)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/web-skin-payload")
    def api_wb_web_skin_payload():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            return jsonify(workbench_web_skin_payload(session_id, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/termpp-stream/start")
    def api_wb_termpp_stream_start():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            x = int(payload.get("x", 0))
            y = int(payload.get("y", 0))
            w = int(payload.get("w", 640))
            h = int(payload.get("h", 480))
            fps = int(payload.get("fps", 4))
            raw = payload.get("dry_run", False)
            dry_run = raw if isinstance(raw, bool) else str(raw).lower() in {"1", "true", "yes", "on"}
            return jsonify(workbench_termpp_stream_start(session_id, req_id, x, y, w, h, fps=fps, dry_run=dry_run)), 200
        except ApiError as e:
            return _err(e)

    @app.post("/api/workbench/termpp-stream/stop")
    def api_wb_termpp_stream_stop():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            stream_id = str(payload.get("stream_id", "")).strip()
            if not stream_id:
                raise ApiError("stream_id is required", "missing_stream_id", "workbench", req_id, 400)
            return jsonify(workbench_termpp_stream_stop(stream_id, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.get("/api/workbench/termpp-stream/status/<stream_id>")
    def api_wb_termpp_stream_status(stream_id: str):
        req_id = str(uuid.uuid4())
        try:
            return jsonify(workbench_termpp_stream_status(stream_id, req_id)), 200
        except ApiError as e:
            return _err(e)

    @app.get("/api/workbench/termpp-stream/frame/<stream_id>")
    def api_wb_termpp_stream_frame(stream_id: str):
        req_id = str(uuid.uuid4())
        try:
            p = workbench_termpp_stream_frame_path(stream_id, req_id)
            return send_file(p, mimetype="image/png", max_age=0)
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

    @app.post("/api/workbench/run-verification")
    def api_wb_run_verification():
        req_id = str(uuid.uuid4())
        try:
            payload = request.get_json(silent=True) or {}
            session_id = str(payload.get("session_id", "")).strip()
            if not session_id:
                raise ApiError("session_id is required", "missing_session_id", "workbench", req_id, 400)
            profile = str(payload.get("profile", "local_xp_sanity")).strip() or "local_xp_sanity"
            command_template = str(payload.get("command_template", ""))
            timeout_sec = int(payload.get("timeout_sec", 20))
            raw = payload.get("dry_run", False)
            dry_run = raw if isinstance(raw, bool) else str(raw).lower() in {"1", "true", "yes", "on"}
            return jsonify(
                workbench_run_verification(
                    session_id=session_id,
                    req_id=req_id,
                    profile=profile,
                    command_template=command_template,
                    timeout_sec=timeout_sec,
                    dry_run=dry_run,
                )
            ), 200
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
