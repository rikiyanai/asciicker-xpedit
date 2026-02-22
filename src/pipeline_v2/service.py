from __future__ import annotations

import hashlib
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any

from PIL import Image

from .config import (
    ensure_dirs,
    UPLOAD_DIR,
    JOBS_DIR,
    PREVIEWS_DIR,
    GATES_DIR,
    TRACES_DIR,
    SESSIONS_DIR,
    EXPORT_DIR,
)
from .gates import gate_g7_geometry, gate_g8_nonempty, gate_g9_handoff
from .models import ApiError, RunConfig, JobRecord, WorkbenchSession
from .renderer import render_preview_png
from .storage import save_json, load_json
from .xp_codec import write_xp, read_xp

_GLYPH_RAMP = " .:-=+*#%@"


def request_id() -> str:
    return str(uuid.uuid4())


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _job_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def _session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def upload_image(file_storage, req_id: str) -> dict[str, Any]:
    ensure_dirs()
    if file_storage is None or not file_storage.filename:
        raise ApiError("file is required", "missing_file", "upload", req_id, 400)
    ext = Path(file_storage.filename).suffix.lower()
    if ext != ".png":
        raise ApiError("only .png supported in v2 mvp", "invalid_extension", "upload", req_id, 422)

    upload_id = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{upload_id}.png"
    file_storage.save(dest)

    try:
        with Image.open(dest) as im:
            width, height = im.size
    except Exception as e:
        raise ApiError(f"invalid image: {e}", "invalid_image", "upload", req_id, 422)

    return {
        "upload_id": upload_id,
        "source_path": str(dest.resolve()),
        "width": width,
        "height": height,
        "sha256": _sha256(dest),
    }


def analyze_image(source_path: str, req_id: str) -> dict[str, Any]:
    p = Path(source_path)
    if not p.exists():
        raise ApiError("source_path not found", "source_not_found", "analyze", req_id, 404)

    with Image.open(p) as im:
        w, h = im.size

    suggested_angles = 1
    suggested_frames = max(1, w // max(h, 1))
    suggested_cell_w = max(1, w // suggested_frames)
    suggested_cell_h = h

    return {
        "image_w": w,
        "image_h": h,
        "suggested_angles": suggested_angles,
        "suggested_frames": [suggested_frames],
        "suggested_cell_w": suggested_cell_w,
        "suggested_cell_h": suggested_cell_h,
        "confidence": "medium",
        "diagnostics": {
            "method": "ratio_heuristic",
            "note": "MVP heuristic only",
        },
    }


def _build_cells_from_image(im: Image.Image, cols: int, rows: int) -> list[tuple[int, tuple[int, int, int], tuple[int, int, int]]]:
    gray = im.convert("L").resize((cols, rows), Image.Resampling.BILINEAR)
    cells = []
    for r in range(rows):
        for c in range(cols):
            v = gray.getpixel((c, r))
            idx = int((v / 255) * (len(_GLYPH_RAMP) - 1))
            ch = _GLYPH_RAMP[idx]
            glyph = ord(ch)
            fg = (220, 220, 220)
            bg = (0, 0, 0)
            cells.append((glyph, fg, bg))
    return cells


def run_pipeline(cfg: RunConfig, req_id: str) -> dict[str, Any]:
    ensure_dirs()
    cfg.validate(req_id)
    src = Path(cfg.source_path)
    if not src.exists():
        raise ApiError("source_path not found", "source_not_found", "run", req_id, 404)

    job_id = str(uuid.uuid4())
    cols = sum(cfg.frames) * cfg.projs
    rows = cfg.angles

    try:
        with Image.open(src) as im:
            cells_layer2 = _build_cells_from_image(im, cols, rows)
    except Exception as e:
        raise ApiError(f"pipeline failed reading image: {e}", "pipeline_image_error", "run", req_id, 500)

    blank_layer = [(32, (0, 0, 0), (0, 0, 0)) for _ in range(cols * rows)]
    layers = [blank_layer, blank_layer, cells_layer2, blank_layer]

    xp_path = EXPORT_DIR / f"{job_id}.xp"
    write_xp(xp_path, cols, rows, layers)

    preview_path = PREVIEWS_DIR / f"{job_id}.png"
    render_preview_png(cells_layer2, cols, rows, preview_path)

    g7 = gate_g7_geometry(cols * rows, len(cells_layer2))
    g8 = gate_g8_nonempty([g for g, _fg, _bg in cells_layer2])
    g9 = gate_g9_handoff(len(cells_layer2))
    gate_report = {
        "job_id": job_id,
        "results": [asdict(g7), asdict(g8), asdict(g9)],
    }
    gate_path = GATES_DIR / f"{job_id}.json"
    save_json(gate_path, gate_report)

    trace = {
        "job_id": job_id,
        "state": [
            "CREATED",
            "ANALYZED",
            "RUNNING_INGEST",
            "RUNNING_SLICE",
            "RUNNING_PROCESS",
            "RUNNING_ASSEMBLE",
            "RUNNING_VERIFY",
            "SUCCEEDED",
        ],
        "cols": cols,
        "rows": rows,
        "source_sha256": _sha256(src),
        "xp_sha256": _sha256(xp_path),
    }
    trace_path = TRACES_DIR / f"{job_id}.json"
    save_json(trace_path, trace)

    metadata = {
        "angles": cfg.angles,
        "anims": cfg.frames,
        "projs": cfg.projs,
        "render_resolution": cfg.render_resolution,
        "checksum": _sha256(xp_path),
    }

    record = JobRecord(
        job_id=job_id,
        state="SUCCEEDED",
        stage="verify",
        source_path=str(src.resolve()),
        xp_path=str(xp_path.resolve()),
        preview_paths=[str(preview_path.resolve())],
        metadata=metadata,
        gate_report_path=str(gate_path.resolve()),
        trace_path=str(trace_path.resolve()),
    )
    save_json(_job_path(job_id), record.to_dict())

    return {
        "job_id": job_id,
        "state": record.state,
        "xp_path": record.xp_path,
        "preview_paths": record.preview_paths,
        "metadata": record.metadata,
        "gate_report_path": record.gate_report_path,
        "trace_path": record.trace_path,
    }


def status(job_id: str, req_id: str) -> dict[str, Any]:
    p = _job_path(job_id)
    if not p.exists():
        raise ApiError("job not found", "job_not_found", "status", req_id, 404)
    return load_json(p)


def workbench_load_from_job(job_id: str, req_id: str) -> dict[str, Any]:
    job = status(job_id, req_id)
    xp_path = Path(job["xp_path"])
    if not xp_path.exists():
        raise ApiError("xp_path missing", "xp_missing", "workbench", req_id, 500)

    parsed = read_xp(xp_path)
    width = parsed["width"]
    height = parsed["height"]
    visual = parsed["cells"][2] if parsed["layers"] >= 3 else parsed["cells"][0]

    cells = []
    populated = 0
    for idx, (glyph, fg, bg) in enumerate(visual):
        if glyph != 32:
            populated += 1
        cells.append({"idx": idx, "glyph": glyph, "fg": list(fg), "bg": list(bg)})

    if populated <= 0:
        raise ApiError("workbench session would be empty", "empty_workbench", "workbench", req_id, 422)

    meta = job["metadata"]
    session_id = str(uuid.uuid4())
    sess = WorkbenchSession(
        session_id=session_id,
        job_id=job_id,
        angles=int(meta["angles"]),
        anims=[int(x) for x in meta["anims"]],
        projs=int(meta["projs"]),
        cell_w=int(meta["render_resolution"]),
        cell_h=int(meta["render_resolution"]),
        grid_cols=width,
        grid_rows=height,
        cells=cells,
    )
    save_json(_session_path(session_id), sess.to_dict())

    return {
        "session_id": session_id,
        "job_id": job_id,
        "populated_cells": populated,
        "grid_cols": width,
        "grid_rows": height,
        "cell_w": sess.cell_w,
        "cell_h": sess.cell_h,
        "angles": sess.angles,
        "anims": sess.anims,
        "projs": sess.projs,
    }


def workbench_export_xp(session_id: str, req_id: str) -> dict[str, Any]:
    p = _session_path(session_id)
    if not p.exists():
        raise ApiError("session not found", "session_not_found", "workbench", req_id, 404)

    sess = load_json(p)
    cols = int(sess["grid_cols"])
    rows = int(sess["grid_rows"])
    cells = [
        (int(c["glyph"]), tuple(c["fg"]), tuple(c["bg"]))
        for c in sess["cells"]
    ]

    if len(cells) != cols * rows:
        raise ApiError("session cell geometry mismatch", "session_geometry_invalid", "workbench", req_id, 422)

    blank = [(32, (0, 0, 0), (0, 0, 0)) for _ in range(cols * rows)]
    layers = [blank, blank, cells, blank]

    out = EXPORT_DIR / f"session-{session_id}.xp"
    write_xp(out, cols, rows, layers)

    return {
        "session_id": session_id,
        "xp_path": str(out.resolve()),
        "checksum": _sha256(out),
    }
