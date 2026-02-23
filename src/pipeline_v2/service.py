from __future__ import annotations

import hashlib
import math
import os
import shlex
import statistics
import subprocess
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any

from PIL import Image

from .config import (
    ensure_dirs,
    ROOT,
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

MAGENTA_BG = (255, 0, 255)

def request_id() -> str:
    return str(uuid.uuid4())


def _resolve_xp_tool_repo_root() -> Path:
    env_root = os.environ.get("XP_TOOL_REPO_ROOT", "").strip()
    if env_root:
        return Path(env_root).expanduser().resolve()
    sibling = ROOT.parent / "asciicker-Y9-2"
    if sibling.exists():
        return sibling.resolve()
    return ROOT.resolve()


def _xp_tool_command_parts(xp_path: Path) -> tuple[list[str], Path]:
    repo_root = _resolve_xp_tool_repo_root()
    argv = ["python3", "-m", "scripts.asset_gen.xp_tool", str(xp_path.resolve())]
    return argv, repo_root


def _suggest_run_geometry(
    image_w: int,
    image_h: int,
    source_image: Image.Image | None = None,
) -> tuple[int, list[int], int, int, int, int, dict[str, Any]]:
    """Pick analyze defaults that are likely to pass run-time geometry guards."""
    min_aspect = 0.35
    max_aspect = 1.2
    target_aspect = 0.75
    min_frame_px = 16
    max_frame_px = 256
    min_tiles = 4
    max_tiles = 128
    max_angles = min(max(1, image_h), 16)
    max_frames = min(max(1, image_w), 64)
    checked = 0
    best: dict[str, Any] | None = None
    ranked: list[dict[str, Any]] = []
    best_by_source_projs: dict[int, dict[str, Any]] = {}
    sample_rgba = source_image.convert("RGBA") if source_image is not None else None
    sample_bg_rgb = _estimate_bg_rgb(sample_rgba) if sample_rgba is not None else (0, 0, 0)
    sample_signal_mode = _infer_signal_mode(sample_rgba) if sample_rgba is not None else "delta"
    semantic_cache: dict[tuple[int, int, int], tuple[float, float]] = {}
    resample_nearest = getattr(Image, "Resampling", Image).NEAREST

    def _suggest_render_resolution(frame_px_w: int, angle_px_h: int) -> int:
        # Prefer denser defaults for larger frames to reduce visible degeneration.
        # Small sheets remain conservative to avoid excessive noise.
        min_rr = 12
        if frame_px_w >= 140 and angle_px_h >= 180:
            target_w_chars = 22.0
            target_h_chars = 30.0
            min_rr = 8
        elif frame_px_w >= 96 and angle_px_h >= 128:
            target_w_chars = 20.0
            target_h_chars = 26.0
            min_rr = 10
        else:
            target_w_chars = 16.0
            target_h_chars = 20.0
        raw = max(frame_px_w / target_w_chars, angle_px_h / target_h_chars)
        return max(min_rr, min(24, int(round(raw))))

    def _foreground_mask(tile: Image.Image) -> list[list[bool]]:
        rgba = tile.convert("RGBA")
        w, h = rgba.size
        out = [[False for _ in range(w)] for _ in range(h)]
        bg_r, bg_g, bg_b = sample_bg_rgb
        for y in range(h):
            for x in range(w):
                r, g, b, a = rgba.getpixel((x, y))
                if a < 16:
                    continue
                if sample_signal_mode == "delta":
                    delta = abs(int(r) - bg_r) + abs(int(g) - bg_g) + abs(int(b) - bg_b)
                    if delta <= 38:
                        continue
                out[y][x] = True
        return out

    def _run_segments(vals: list[int], thr: int, min_len: int) -> list[tuple[int, int]]:
        out: list[tuple[int, int]] = []
        i = 0
        n = len(vals)
        while i < n:
            if vals[i] <= thr:
                i += 1
                continue
            j = i
            while j + 1 < n and vals[j + 1] > thr:
                j += 1
            if (j - i + 1) >= min_len:
                out.append((i, j))
            i = j + 1
        return out

    def _semantic_penalty(angles: int, semantic_frames: int, source_projs: int) -> tuple[float, float]:
        key = (angles, semantic_frames, source_projs)
        if key in semantic_cache:
            return semantic_cache[key]
        if sample_rgba is None:
            semantic_cache[key] = (0.0, 0.0)
            return semantic_cache[key]

        source_frame_cols = semantic_frames * source_projs
        if source_frame_cols <= 0 or source_frame_cols > image_w:
            semantic_cache[key] = (8.0, 1.0)
            return semantic_cache[key]

        frame_px_w = max(1, image_w // source_frame_cols)
        angle_px_h = max(1, image_h // angles)
        base_points = [
            (0, 0),
            (0, semantic_frames - 1),
            (angles - 1, 0),
            (angles - 1, semantic_frames - 1),
            (angles // 2, semantic_frames // 2),
        ]
        sample_points: list[tuple[int, int, int]] = []
        for row_i, col_i in base_points:
            sample_points.append((row_i, col_i, 0))
            if source_projs > 1:
                sample_points.append((row_i, col_i, min(1, source_projs - 1)))
        split_sum = 0.0
        empty_count = 0
        used = 0

        for row_i, col_i, proj_i in sample_points:
            row_i = max(0, min(angles - 1, row_i))
            col_i = max(0, min(semantic_frames - 1, col_i))
            source_col = col_i + (proj_i * semantic_frames)
            x0 = source_col * frame_px_w
            y0 = row_i * angle_px_h
            x1 = min(image_w, x0 + frame_px_w)
            y1 = min(image_h, y0 + angle_px_h)
            if x1 <= x0 or y1 <= y0:
                continue
            tile = sample_rgba.crop((x0, y0, x1, y1))
            if tile.width > 96 or tile.height > 96:
                scale = max(tile.width / 96.0, tile.height / 96.0)
                tile = tile.resize(
                    (
                        max(8, int(tile.width / scale)),
                        max(8, int(tile.height / scale)),
                    ),
                    resample_nearest,
                )
            mask = _foreground_mask(tile)
            h = len(mask)
            w = len(mask[0]) if h else 0
            if w <= 0 or h <= 0:
                continue

            col_counts = [0 for _ in range(w)]
            row_counts = [0 for _ in range(h)]
            fg_count = 0
            for y in range(h):
                for x in range(w):
                    if mask[y][x]:
                        col_counts[x] += 1
                        row_counts[y] += 1
                        fg_count += 1
            occ = fg_count / max(1, w * h)
            if occ < 0.015:
                empty_count += 1

            col_thr = max(1, int(h * 0.08))
            row_thr = max(1, int(w * 0.08))
            col_segments = _run_segments(col_counts, col_thr, max(2, int(w * 0.14)))
            row_segments = _run_segments(row_counts, row_thr, max(2, int(h * 0.14)))

            split_pen = 0.0
            if len(col_segments) >= 2:
                split_pen += 1.10 * (len(col_segments) - 1)
            if len(row_segments) >= 2:
                split_pen += 0.50 * (len(row_segments) - 1)
            split_sum += split_pen
            used += 1

        if used <= 0:
            semantic_cache[key] = (0.0, 0.0)
        else:
            semantic_cache[key] = (split_sum / used, empty_count / used)
        return semantic_cache[key]

    def _grid_hint() -> dict[str, Any]:
        if sample_rgba is None:
            return {}

        hint_im = sample_rgba
        hw, hh = hint_im.size
        max_dim = 512
        if hw > max_dim or hh > max_dim:
            scale = max(hw / max_dim, hh / max_dim)
            hint_im = hint_im.resize((max(64, int(hw / scale)), max(64, int(hh / scale))), resample_nearest)

        mask = _foreground_mask(hint_im)
        h = len(mask)
        w = len(mask[0]) if h else 0
        if w <= 0 or h <= 0:
            return {}

        row_counts = [0 for _ in range(h)]
        for y in range(h):
            row_counts[y] = sum(1 for x in range(w) if mask[y][x])

        row_thr = max(1, int(w * 0.015))
        row_segments = _run_segments(row_counts, row_thr, max(2, int(h * 0.01)))
        if len(row_segments) < 2 or len(row_segments) > 24:
            return {
                "rows_hint": None,
                "source_cols_hint": None,
                "rows_detected": len(row_segments),
                "cols_samples": 0,
            }

        col_counts_per_row: list[int] = []
        projection_gap_hits = 0
        for y0, y1 in row_segments:
            cols = [0 for _ in range(w)]
            for y in range(y0, y1 + 1):
                row = mask[y]
                for x in range(w):
                    if row[x]:
                        cols[x] += 1
            row_h = max(1, y1 - y0 + 1)
            col_thr = max(1, int(row_h * 0.06))
            col_segments = _run_segments(cols, col_thr, max(2, int(w * 0.005)))
            if col_segments:
                col_counts_per_row.append(len(col_segments))
                # Detect a pronounced center gap between two projection groups.
                # Typical signal: many small frame gaps plus one much wider mid-sheet gap.
                gap_widths: list[int] = []
                max_gap = 0
                max_gap_center = 0.0
                for i in range(len(col_segments) - 1):
                    left = col_segments[i]
                    right = col_segments[i + 1]
                    gap = right[0] - left[1] - 1
                    if gap <= 0:
                        continue
                    gap_widths.append(gap)
                    if gap > max_gap:
                        max_gap = gap
                        max_gap_center = ((left[1] + right[0]) * 0.5) / max(1, w)
                if gap_widths:
                    med_gap = statistics.median(gap_widths)
                    if (
                        max_gap >= max(2, int(med_gap * 2.2))
                        and 0.35 <= max_gap_center <= 0.65
                    ):
                        projection_gap_hits += 1

        rows_hint = len(row_segments)
        cols_hint: int | None = None
        cols_std = 0.0
        if col_counts_per_row:
            cols_med = int(statistics.median(col_counts_per_row))
            cols_std = statistics.pstdev(col_counts_per_row) if len(col_counts_per_row) > 1 else 0.0
            if cols_std <= max(2.0, cols_med * 0.25):
                cols_hint = cols_med

        return {
            "rows_hint": rows_hint,
            "source_cols_hint": cols_hint,
            "rows_detected": len(row_segments),
            "cols_samples": len(col_counts_per_row),
            "cols_std": round(cols_std, 4),
            "projection_split_hint": (
                projection_gap_hits >= max(2, int(math.ceil(len(col_counts_per_row) * 0.25)))
                if col_counts_per_row
                else False
            ),
            "projection_split_rows": int(projection_gap_hits),
        }

    grid_hint = _grid_hint()
    rows_hint = grid_hint.get("rows_hint")
    source_cols_hint = grid_hint.get("source_cols_hint")
    cols_samples = int(grid_hint.get("cols_samples", 0) or 0)
    use_grid_prior = (
        isinstance(rows_hint, int)
        and isinstance(source_cols_hint, int)
        and rows_hint >= 2
        and rows_hint <= 12
        and source_cols_hint >= 2
        and source_cols_hint <= 12
        and cols_samples >= 4
    )
    use_large_col_hint = (
        isinstance(source_cols_hint, int)
        and source_cols_hint >= 14
        and source_cols_hint <= 64
        and cols_samples >= 6
    )
    projection_split_hint = bool(grid_hint.get("projection_split_hint", False))

    for angles in range(1, max_angles + 1):
        for semantic_frames in range(1, max_frames + 1):
            for source_projs in (1, 2):
                source_frame_cols = semantic_frames * source_projs
                if source_frame_cols > image_w:
                    continue

                frame_px_w = max(1, image_w // source_frame_cols)
                angle_px_h = max(1, image_h // angles)
                aspect = frame_px_w / max(1, angle_px_h)
                checked += 1
                if aspect < min_aspect or aspect > max_aspect:
                    continue

                # Penalize implausible frame dimensions: they pass geometry but tend to
                # collapse semantic slicing (e.g., giant 1x2 splits on real sheets).
                size_penalty = 0.0
                if frame_px_w < min_frame_px:
                    size_penalty += ((min_frame_px - frame_px_w) / max(1, min_frame_px)) * 6.0
                elif frame_px_w > max_frame_px:
                    size_penalty += ((frame_px_w - max_frame_px) / max(1, max_frame_px)) * 8.0
                if angle_px_h < min_frame_px:
                    size_penalty += ((min_frame_px - angle_px_h) / max(1, min_frame_px)) * 6.0
                elif angle_px_h > max_frame_px:
                    size_penalty += ((angle_px_h - max_frame_px) / max(1, max_frame_px)) * 8.0

                divisibility_penalty = (0 if image_w % source_frame_cols == 0 else 1) + (0 if image_h % angles == 0 else 1)
                tile_count = angles * semantic_frames
                tile_penalty = 0.0
                if tile_count < min_tiles:
                    tile_penalty += (min_tiles - tile_count) * 0.6
                if tile_count > max_tiles:
                    tile_penalty += (tile_count - max_tiles) / 64.0
                grid_penalty = 0.0
                if use_grid_prior:
                    assert isinstance(rows_hint, int)
                    assert isinstance(source_cols_hint, int)
                    grid_penalty = (abs(angles - rows_hint) * 0.45) + (abs(source_frame_cols - source_cols_hint) * 0.3)
                col_hint_penalty = 0.0
                if use_large_col_hint:
                    assert isinstance(source_cols_hint, int)
                    col_hint_penalty = abs(source_frame_cols - source_cols_hint) * 0.12
                angle_pref = min(abs(angles - 1), abs(angles - 4), abs(angles - 8)) * 0.04
                if projection_split_hint:
                    source_projs_pref = 0.0 if source_projs == 2 else 0.10
                else:
                    source_projs_pref = 0.0 if source_projs == 1 else 0.04
                semantic_split_penalty = 0.0
                semantic_empty_ratio = 0.0
                if sample_rgba is not None and divisibility_penalty <= 1:
                    semantic_split_penalty, semantic_empty_ratio = _semantic_penalty(angles, semantic_frames, source_projs)
                score = (
                    abs(aspect - target_aspect)
                    + (angles - 1) * 0.01
                    + (semantic_frames - 1) * 0.005
                    + divisibility_penalty * 0.2
                    + size_penalty
                    + tile_penalty
                    + grid_penalty
                    + col_hint_penalty
                    + angle_pref
                    + source_projs_pref
                    + semantic_split_penalty * 2.0
                    + semantic_empty_ratio * 0.75
                )
                ranked.append(
                    {
                        "score": round(score, 6),
                        "angles": angles,
                        "frames": semantic_frames,
                        "source_projs": source_projs,
                        "frame_aspect": round(aspect, 4),
                        "frame_px_w": frame_px_w,
                        "frame_px_h": angle_px_h,
                        "grid_penalty": round(grid_penalty, 6),
                        "col_hint_penalty": round(col_hint_penalty, 6),
                        "semantic_split_penalty": round(semantic_split_penalty, 6),
                        "semantic_empty_ratio": round(semantic_empty_ratio, 6),
                    }
                )
                if best is None or score < best["score"]:
                    best = {
                        "score": score,
                        "angles": angles,
                        "frames": semantic_frames,
                        "source_projs": source_projs,
                        "source_frame_cols": source_frame_cols,
                        "frame_aspect": aspect,
                        "frame_px_w": frame_px_w,
                        "frame_px_h": angle_px_h,
                        "tile_count": tile_count,
                        "grid_penalty": grid_penalty,
                        "col_hint_penalty": col_hint_penalty,
                        "semantic_split_penalty": semantic_split_penalty,
                        "semantic_empty_ratio": semantic_empty_ratio,
                    }
                prev = best_by_source_projs.get(source_projs)
                if prev is None or score < prev["score"]:
                    best_by_source_projs[source_projs] = {
                        "score": score,
                        "angles": angles,
                        "frames": semantic_frames,
                        "source_projs": source_projs,
                        "source_frame_cols": source_frame_cols,
                        "frame_aspect": aspect,
                        "frame_px_w": frame_px_w,
                        "frame_px_h": angle_px_h,
                        "tile_count": tile_count,
                        "grid_penalty": grid_penalty,
                        "col_hint_penalty": col_hint_penalty,
                        "semantic_split_penalty": semantic_split_penalty,
                        "semantic_empty_ratio": semantic_empty_ratio,
                    }

    if best is None:
        # Defensive fallback for extreme dimensions outside search budget.
        src_aspect = image_w / max(1, image_h)
        if src_aspect > max_aspect:
            angles = 1
            semantic_frames = max(1, int(math.ceil(src_aspect / max_aspect)))
        elif src_aspect < min_aspect:
            angles = max(1, int(math.ceil(min_aspect / max(src_aspect, 1e-6))))
            semantic_frames = 1
        else:
            angles = 1
            semantic_frames = 1
        semantic_frames = min(max(1, semantic_frames), max(1, image_w))
        angles = min(max(1, angles), max(1, image_h))
        frame_px_w = max(1, image_w // semantic_frames)
        angle_px_h = max(1, image_h // angles)
        return (
            angles,
            [semantic_frames],
            frame_px_w,
            angle_px_h,
            1,
            _suggest_render_resolution(frame_px_w, angle_px_h),
            {
                "method": "geometry_fallback",
                "checked": checked,
                "target_frame_aspect": target_aspect,
                "suggested_frame_aspect": frame_px_w / max(1, angle_px_h),
                "suggested_source_projs": 1,
            },
        )

    selected = best
    projection_override_reason: str | None = None
    # If grid evidence strongly suggests split projection groups, allow the best
    # source_projs=2 candidate (with its own semantic frame count) to win even
    # when source_projs=1 is marginally better by score.
    alt_by_projs2 = best_by_source_projs.get(2)
    if (
        int(best["source_projs"]) == 1
        and alt_by_projs2 is not None
        and isinstance(source_cols_hint, int)
    ):
        alt_cols = int(alt_by_projs2["source_frame_cols"])
        hint_match = abs(alt_cols - int(source_cols_hint)) <= 1
        score_gap = float(alt_by_projs2["score"]) - float(best["score"])
        split_gain = float(best["semantic_split_penalty"]) - float(alt_by_projs2["semantic_split_penalty"])
        if (
            projection_split_hint
            and hint_match
            and score_gap <= 0.60
        ) or (
            hint_match
            and split_gain >= 0.15
            and score_gap <= 0.35
        ):
            selected = alt_by_projs2
            projection_override_reason = (
                "projection split hint matched source_projs=2 candidate "
                f"(source_cols_hint={source_cols_hint}, cols={alt_cols}, "
                f"score_gap={score_gap:.3f}, split_gain={split_gain:.3f})."
            )

    frame_px_w = max(1, image_w // int(selected["source_frame_cols"]))
    angle_px_h = max(1, image_h // int(selected["angles"]))
    suggested_source_projs = int(selected["source_projs"])
    if (
        suggested_source_projs == 1
        and sample_rgba is not None
        and float(selected["semantic_split_penalty"]) >= 0.15
    ):
        alt_source_frame_cols = int(selected["frames"]) * 2
        if alt_source_frame_cols <= image_w:
            alt_frame_px_w = max(1, image_w // alt_source_frame_cols)
            alt_angle_px_h = max(1, image_h // int(selected["angles"]))
            alt_aspect = alt_frame_px_w / max(1, alt_angle_px_h)
            if min_aspect <= alt_aspect <= max_aspect:
                alt_split, alt_empty = _semantic_penalty(int(selected["angles"]), int(selected["frames"]), 2)
                base_split = float(selected["semantic_split_penalty"])
                base_empty = float(selected["semantic_empty_ratio"])
                if alt_split <= (base_split * 0.6) and alt_empty <= (base_empty + 0.05):
                    suggested_source_projs = 2
                    frame_px_w = alt_frame_px_w
                    angle_px_h = alt_angle_px_h
                    projection_override_reason = (
                        "source_projs=1 candidate had split foreground; source_projs=2 lowered split penalty "
                        f"({base_split:.3f} -> {alt_split:.3f}) at same angles/frames."
                    )
    suggested_render_resolution = _suggest_render_resolution(frame_px_w, angle_px_h)
    return (
        int(selected["angles"]),
        [int(selected["frames"])],
        frame_px_w,
        angle_px_h,
        suggested_source_projs,
        suggested_render_resolution,
        {
            "method": "geometry_search",
            "checked": checked,
            "target_frame_aspect": target_aspect,
            "suggested_frame_aspect": selected["frame_aspect"],
            "suggested_source_projs": suggested_source_projs,
            "suggested_render_resolution": suggested_render_resolution,
            "suggested_frame_px_w": selected["frame_px_w"],
            "suggested_frame_px_h": selected["frame_px_h"],
            "suggested_tile_count": selected["tile_count"],
            "grid_hint": grid_hint,
            "grid_prior_used": use_grid_prior,
            "large_col_hint_used": use_large_col_hint,
            "grid_penalty": selected["grid_penalty"],
            "col_hint_penalty": selected["col_hint_penalty"],
            "semantic_split_penalty": selected["semantic_split_penalty"],
            "semantic_empty_ratio": selected["semantic_empty_ratio"],
            "search_limits": {"max_angles": max_angles, "max_frames": max_frames},
            "frame_px_bounds": {"min": min_frame_px, "max": max_frame_px},
            "top_candidates": sorted(ranked, key=lambda c: c["score"])[:20],
            "selected_candidate": {
                "angles": int(selected["angles"]),
                "frames": int(selected["frames"]),
                "source_projs": int(selected["source_projs"]),
                "source_frame_cols": int(selected["source_frame_cols"]),
                "score": round(float(selected["score"]), 6),
            },
            "projection_override": projection_override_reason,
            "best_by_source_projs": {
                str(k): {
                    "score": round(v["score"], 6),
                    "angles": int(v["angles"]),
                    "frames": int(v["frames"]),
                    "source_projs": int(v["source_projs"]),
                    "frame_aspect": round(v["frame_aspect"], 4),
                    "frame_px_w": int(v["frame_px_w"]),
                    "frame_px_h": int(v["frame_px_h"]),
                    "grid_penalty": round(v["grid_penalty"], 6),
                    "col_hint_penalty": round(v["col_hint_penalty"], 6),
                    "semantic_split_penalty": round(v["semantic_split_penalty"], 6),
                    "semantic_empty_ratio": round(v["semantic_empty_ratio"], 6),
                }
                for k, v in sorted(best_by_source_projs.items(), key=lambda kv: kv[0])
            },
        },
    )


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
        rgba = im.convert("RGBA")

    (
        suggested_angles,
        suggested_frames,
        suggested_cell_w,
        suggested_cell_h,
        suggested_source_projs,
        suggested_render_resolution,
        diagnostics,
    ) = _suggest_run_geometry(
        w,
        h,
        source_image=rgba,
    )

    return {
        "image_w": w,
        "image_h": h,
        "suggested_angles": suggested_angles,
        "suggested_frames": suggested_frames,
        "suggested_cell_w": suggested_cell_w,
        "suggested_cell_h": suggested_cell_h,
        "suggested_source_projs": suggested_source_projs,
        "suggested_render_resolution": suggested_render_resolution,
        "confidence": "medium",
        "diagnostics": diagnostics,
    }


def _transparent_cell() -> tuple[int, tuple[int, int, int], tuple[int, int, int]]:
    return (0, (0, 0, 0), MAGENTA_BG)


def _digit_to_glyph(v: int) -> int:
    if 0 <= v <= 9:
        return 48 + v
    if 10 <= v <= 35:
        return 65 + (v - 10)
    return 0


def _build_metadata_layer(cols: int, rows: int, angles: int, anims: list[int]) -> list[tuple[int, tuple[int, int, int], tuple[int, int, int]]]:
    layer = [_transparent_cell() for _ in range(cols * rows)]
    # Layer-0 contract: (0,0)=angles, (a,0)=animation length digits.
    if cols > 0 and rows > 0:
        layer[0] = (_digit_to_glyph(int(angles)), (255, 255, 255), (0, 0, 0))
    for i, val in enumerate(anims, start=1):
        if i >= cols:
            break
        layer[i] = (_digit_to_glyph(int(val)), (255, 255, 255), (0, 0, 0))
    return layer


def _estimate_bg_rgb(im: Image.Image) -> tuple[int, int, int]:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    coords = []
    for x in range(0, w, max(1, w // 16)):
        coords.append((x, 0))
        coords.append((x, h - 1))
    for y in range(0, h, max(1, h // 16)):
        coords.append((0, y))
        coords.append((w - 1, y))
    coords.extend([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    rs, gs, bs = [], [], []
    for x, y in coords:
        r, g, b, a = rgba.getpixel((x, y))
        if a < 16:
            continue
        rs.append(r)
        gs.append(g)
        bs.append(b)
    if not rs:
        return (0, 0, 0)
    return (
        int(statistics.median(rs)),
        int(statistics.median(gs)),
        int(statistics.median(bs)),
    )


def _infer_signal_mode(im: Image.Image) -> str:
    """Choose foreground detection mode.

    - alpha: use alpha channel only (best for transparent sprite sheets)
    - delta: use RGB distance from estimated background (opaque sheets)
    """
    rgba = im.convert("RGBA")
    w, h = rgba.size
    total = max(1, w * h)
    alpha = [a for _r, _g, _b, a in rgba.getdata()]
    transparent_ratio = sum(1 for a in alpha if a < 16) / total
    if transparent_ratio > 0.05:
        return "alpha"
    return "delta"


def _crop_to_foreground(im: Image.Image, bg_rgb: tuple[int, int, int], delta_thr: int = 38, signal_mode: str = "delta") -> Image.Image:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    bg_r, bg_g, bg_b = bg_rgb
    min_x, min_y = w, h
    max_x, max_y = -1, -1
    px = list(rgba.getdata())
    for idx, (r, g, b, a) in enumerate(px):
        if a < 16:
            continue
        if signal_mode == "delta":
            delta = abs(int(r) - bg_r) + abs(int(g) - bg_g) + abs(int(b) - bg_b)
            if delta <= delta_thr:
                continue
        y, x = divmod(idx, w)
        if x < min_x:
            min_x = x
        if y < min_y:
            min_y = y
        if x > max_x:
            max_x = x
        if y > max_y:
            max_y = y
    if max_x < min_x or max_y < min_y:
        return rgba
    return rgba.crop((min_x, min_y, max_x + 1, max_y + 1))


def _foreground_bbox(
    im: Image.Image,
    bg_rgb: tuple[int, int, int],
    delta_thr: int = 38,
    signal_mode: str = "delta",
) -> tuple[int, int, int, int] | None:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    bg_r, bg_g, bg_b = bg_rgb
    min_x, min_y = w, h
    max_x, max_y = -1, -1
    px = list(rgba.getdata())
    for idx, (r, g, b, a) in enumerate(px):
        if a < 16:
            continue
        if signal_mode == "delta":
            delta = abs(int(r) - bg_r) + abs(int(g) - bg_g) + abs(int(b) - bg_b)
            if delta <= delta_thr:
                continue
        y, x = divmod(idx, w)
        if x < min_x:
            min_x = x
        if y < min_y:
            min_y = y
        if x > max_x:
            max_x = x
        if y > max_y:
            max_y = y
    if max_x < min_x or max_y < min_y:
        return None
    return (min_x, min_y, max_x, max_y)


def _region_stats(
    px: list[tuple[int, int, int, int]],
    bg_rgb: tuple[int, int, int],
    signal_mode: str = "delta",
    delta_thr: int = 38,
) -> tuple[float, tuple[int, int, int]] | None:
    bg_r, bg_g, bg_b = bg_rgb
    signal: list[tuple[int, int, int]] = []
    for r, g, b, a in px:
        if a < 16:
            continue
        if signal_mode == "delta":
            delta = abs(int(r) - bg_r) + abs(int(g) - bg_g) + abs(int(b) - bg_b)
            if delta <= delta_thr:
                continue
        signal.append((int(r), int(g), int(b)))

    occupancy = len(signal) / max(1, len(px))
    patch_area = len(px)
    if patch_area >= 100:
        min_occupancy = 0.05
    elif patch_area >= 36:
        min_occupancy = 0.06
    else:
        min_occupancy = 0.08
    if signal_mode == "alpha":
        min_occupancy = max(0.03, min_occupancy - 0.02)

    if patch_area <= 8:
        min_samples = 1
    elif patch_area <= 64:
        min_samples = 2
    else:
        min_samples = 3
    if occupancy < min_occupancy or len(signal) < min_samples:
        return None
    avg = (
        int(sum(v[0] for v in signal) / len(signal)),
        int(sum(v[1] for v in signal) / len(signal)),
        int(sum(v[2] for v in signal) / len(signal)),
    )
    return occupancy, (
        max(28, min(220, avg[0])),
        max(28, min(220, avg[1])),
        max(28, min(220, avg[2])),
    )


def _cell_from_patch(
    patch: Image.Image,
    bg_rgb: tuple[int, int, int],
    signal_mode: str = "delta",
) -> tuple[int, tuple[int, int, int], tuple[int, int, int]]:
    rgba = patch.convert("RGBA")
    w, h = rgba.size
    if w <= 0 or h <= 0:
        return _transparent_cell()

    split = max(1, h // 2)
    top_px = list(rgba.crop((0, 0, w, split)).getdata())
    bot_px = list(rgba.crop((0, split, w, h)).getdata())
    top = _region_stats(top_px, bg_rgb, signal_mode=signal_mode)
    bot = _region_stats(bot_px, bg_rgb, signal_mode=signal_mode)

    if top is None and bot is None:
        return _transparent_cell()
    if top is not None and bot is None:
        # Upper half block: top in fg, bottom transparent via magenta bg.
        return (223, top[1], MAGENTA_BG)
    if top is None and bot is not None:
        # Lower half block: bottom in fg, top transparent via magenta bg.
        return (220, bot[1], MAGENTA_BG)

    # Both halves visible.
    assert top is not None and bot is not None
    t_rgb = top[1]
    b_rgb = bot[1]
    diff = abs(t_rgb[0] - b_rgb[0]) + abs(t_rgb[1] - b_rgb[1]) + abs(t_rgb[2] - b_rgb[2])
    if diff < 20:
        avg = (
            (t_rgb[0] + b_rgb[0]) // 2,
            (t_rgb[1] + b_rgb[1]) // 2,
            (t_rgb[2] + b_rgb[2]) // 2,
        )
        return (219, avg, (0, 0, 0))
    # Upper/lower color split inside one char cell.
    return (223, t_rgb, b_rgb)


def _tile_to_cells(
    im: Image.Image,
    bg_rgb: tuple[int, int, int],
    out_w: int,
    out_h: int,
    signal_mode: str = "delta",
) -> list[list[tuple[int, tuple[int, int, int], tuple[int, int, int]]]]:
    src = im.convert("RGBA")
    src_w, src_h = src.size
    rows: list[list[tuple[int, tuple[int, int, int], tuple[int, int, int]]]] = []
    for y in range(out_h):
        row = []
        for x in range(out_w):
            x0 = int(x * src_w / out_w)
            x1 = int((x + 1) * src_w / out_w)
            y0 = int(y * src_h / out_h)
            y1 = int((y + 1) * src_h / out_h)
            if x1 <= x0:
                x1 = min(src_w, x0 + 1)
            if y1 <= y0:
                y1 = min(src_h, y0 + 1)
            patch = src.crop((x0, y0, x1, y1))
            row.append(_cell_from_patch(patch, bg_rgb, signal_mode=signal_mode))
        rows.append(row)
    return rows


def run_pipeline(cfg: RunConfig, req_id: str) -> dict[str, Any]:
    ensure_dirs()
    cfg.validate(req_id)
    src = Path(cfg.source_path)
    if not src.exists():
        raise ApiError("source_path not found", "source_not_found", "run", req_id, 404)

    job_id = str(uuid.uuid4())
    semantic_frames = sum(cfg.frames)
    source_frame_cols = semantic_frames * cfg.source_projs

    try:
        with Image.open(src) as im:
            src_w, src_h = im.size
            if src_w < source_frame_cols or src_h < cfg.angles:
                raise ApiError("source sheet too small for requested geometry", "invalid_sheet_geometry", "run", req_id, 422)
            bg_rgb = _estimate_bg_rgb(im)
            signal_mode = _infer_signal_mode(im)

            frame_px_w = max(1, src_w // source_frame_cols)
            angle_px_h = max(1, src_h // cfg.angles)
            # Fail closed on obviously wrong row slicing (prevents half-row splits).
            aspect = frame_px_w / max(1, angle_px_h)
            if aspect < 0.35 or aspect > 1.2:
                suggested_angles = None
                suggested_source_projs = cfg.source_projs
                candidates: list[tuple[float, int, int]] = []
                for cand_source_projs in sorted({1, 2, cfg.source_projs}):
                    cand_cols = semantic_frames * cand_source_projs
                    if cand_cols <= 0 or src_w < cand_cols:
                        continue
                    cand_frame_px_w = max(1, src_w // cand_cols)
                    for a in range(1, min(src_h, 16) + 1):
                        if src_h % a != 0:
                            continue
                        ah = src_h // a
                        asp = cand_frame_px_w / max(1, ah)
                        if 0.35 <= asp <= 1.2:
                            pref = 0.0 if cand_source_projs == cfg.source_projs else 0.05
                            candidates.append((abs(asp - 0.8) + pref, a, cand_source_projs))
                if candidates:
                    candidates.sort()
                    suggested_angles = candidates[0][1]
                    suggested_source_projs = candidates[0][2]
                hint = ""
                if suggested_angles is not None:
                    if suggested_source_projs != cfg.source_projs:
                        hint = f" Try source_projs={suggested_source_projs}, angles={suggested_angles}."
                    else:
                        hint = f" Try angles={suggested_angles}."
                raise ApiError(
                    f"slicing mismatch: angles={cfg.angles} gives frame aspect {aspect:.2f}.{hint}",
                    "invalid_sheet_geometry",
                    "run",
                    req_id,
                    422,
                )
            cell_w_chars = max(1, int(math.ceil(frame_px_w / max(1, cfg.render_resolution))))
            cell_h_chars = max(1, int(math.ceil(angle_px_h / max(1, cfg.render_resolution))))
            # Enforce a minimum visual resolution per frame so silhouettes/animation survive.
            # Keep aspect close to source frame ratio (48x32 => 1.5) with 12x8 minimum.
            cell_w_chars = max(cell_w_chars, 12)
            cell_h_chars = max(cell_h_chars, 8)

            cols = semantic_frames * cfg.projs * cell_w_chars
            rows = cfg.angles * cell_h_chars
            transparent = _transparent_cell()
            layer_grid = [[transparent for _ in range(cols)] for _ in range(rows)]

            # Use a stable foreground crop box per angle row so every frame in the same
            # animation track is sampled from identical vertical bounds.
            angle_crop_boxes: list[tuple[int, int, int, int]] = []
            min_crop_width_ratio = 0.60
            min_crop_height_ratio = 0.55
            for angle in range(cfg.angles):
                y0 = angle * angle_px_h
                y1 = min(src_h, y0 + angle_px_h)
                found = False
                min_x = frame_px_w
                min_y = angle_px_h
                max_x = -1
                max_y = -1
                for source_col in range(source_frame_cols):
                    sx0 = source_col * frame_px_w
                    sx1 = min(src_w, sx0 + frame_px_w)
                    tile = im.crop((sx0, y0, sx1, y1))
                    bbox = _foreground_bbox(tile, bg_rgb, signal_mode=signal_mode)
                    if bbox is None:
                        continue
                    bx0, by0, bx1, by1 = bbox
                    found = True
                    min_x = min(min_x, bx0)
                    min_y = min(min_y, by0)
                    max_x = max(max_x, bx1)
                    max_y = max(max_y, by1)
                if not found:
                    angle_crop_boxes.append((0, 0, frame_px_w - 1, angle_px_h - 1))
                    continue
                raw_w = max(1, (max_x - min_x + 1))
                raw_h = max(1, (max_y - min_y + 1))
                # Guard against over-tight row crops that collapse source detail.
                # This keeps a narrow pose in one frame from shrinking every frame in the row.
                if (
                    raw_w < int(frame_px_w * min_crop_width_ratio)
                    or raw_h < int(angle_px_h * min_crop_height_ratio)
                ):
                    angle_crop_boxes.append((0, 0, frame_px_w - 1, angle_px_h - 1))
                    continue
                pad = 1
                angle_crop_boxes.append(
                    (
                        max(0, min_x - pad),
                        max(0, min_y - pad),
                        min(frame_px_w - 1, max_x + pad),
                        min(angle_px_h - 1, max_y + pad),
                    )
                )

            for angle in range(cfg.angles):
                y0 = angle * angle_px_h
                y1 = min(src_h, y0 + angle_px_h)
                crop_x0, crop_y0, crop_x1, crop_y1 = angle_crop_boxes[angle]
                for frame in range(semantic_frames):
                    for proj in range(cfg.projs):
                        if cfg.source_projs == 1:
                            source_col = frame
                        else:
                            # Engine/xp_tool contract uses grouped projections:
                            # [all proj0 frames][all proj1 frames]
                            source_col = frame + (min(proj, cfg.source_projs - 1) * semantic_frames)

                        x0 = source_col * frame_px_w
                        x1 = min(src_w, x0 + frame_px_w)
                        tile = im.crop(
                            (
                                x0 + crop_x0,
                                y0 + crop_y0,
                                x0 + crop_x1 + 1,
                                y0 + crop_y1 + 1,
                            )
                        )

                        if cfg.source_projs == 1 and cfg.projs == 2 and proj == 1:
                            tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

                        # Render with stable row crop; bottom-align to keep feet anchored.
                        fg_tile = tile
                        inner_w = max(1, cell_w_chars)
                        inner_h = max(1, cell_h_chars)
                        inner_cells = _tile_to_cells(
                            fg_tile,
                            bg_rgb,
                            inner_w,
                            inner_h,
                            signal_mode=signal_mode,
                        )
                        tile_cells = [[_transparent_cell() for _ in range(cell_w_chars)] for _ in range(cell_h_chars)]
                        off_x = max(0, (cell_w_chars - inner_w) // 2)
                        off_y = max(0, cell_h_chars - inner_h)
                        for ty in range(inner_h):
                            for tx in range(inner_w):
                                tile_cells[off_y + ty][off_x + tx] = inner_cells[ty][tx]
                        # Output layout must match preview contract:
                        # frame_column = frame_global + proj * total_frames
                        dst_col = frame + (proj * semantic_frames)
                        dst_x0 = dst_col * cell_w_chars
                        dst_y0 = angle * cell_h_chars
                        for ty in range(cell_h_chars):
                            for tx in range(cell_w_chars):
                                layer_grid[dst_y0 + ty][dst_x0 + tx] = tile_cells[ty][tx]

            cells_layer2 = [layer_grid[y][x] for y in range(rows) for x in range(cols)]
    except Exception as e:
        if isinstance(e, ApiError):
            raise
        raise ApiError(f"pipeline failed reading image: {e}", "pipeline_image_error", "run", req_id, 500)

    blank_layer = [_transparent_cell() for _ in range(cols * rows)]
    layer0 = _build_metadata_layer(cols, rows, cfg.angles, cfg.frames)
    layers = [layer0, blank_layer, cells_layer2, blank_layer]

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
        "source_projs": cfg.source_projs,
        "projs": cfg.projs,
        "render_resolution": cfg.render_resolution,
        "cell_w_chars": cell_w_chars,
        "cell_h_chars": cell_h_chars,
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
        if glyph not in (0, 32):
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
        cell_w=int(meta.get("cell_w_chars", meta["render_resolution"])),
        cell_h=int(meta.get("cell_h_chars", meta["render_resolution"])),
        grid_cols=width,
        grid_rows=height,
        cells=cells,
    )
    save_json(_session_path(session_id), sess.to_dict())

    return {
        "session_id": session_id,
        "job_id": job_id,
        "populated_cells": populated,
        "layer_count": int(parsed["layers"]),
        "layer_names": ["Metadata", "Layer 1", "Visual", "Layer 3"][: int(parsed["layers"])],
        "grid_cols": width,
        "grid_rows": height,
        "cell_w": sess.cell_w,
        "cell_h": sess.cell_h,
        "angles": sess.angles,
        "anims": sess.anims,
        "source_projs": int(meta.get("source_projs", 1)),
        "projs": sess.projs,
        "cells": cells,
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

    blank = [_transparent_cell() for _ in range(cols * rows)]
    layer0 = _build_metadata_layer(cols, rows, int(sess["angles"]), [int(x) for x in sess["anims"]])
    layers = [layer0, blank, cells, blank]

    out = EXPORT_DIR / f"session-{session_id}.xp"
    write_xp(out, cols, rows, layers)

    return {
        "session_id": session_id,
        "xp_path": str(out.resolve()),
        "checksum": _sha256(out),
    }


def workbench_xp_tool_command(xp_path: str, req_id: str) -> dict[str, Any]:
    xp = Path(xp_path).expanduser()
    if not xp.exists():
        raise ApiError("xp_path not found", "xp_not_found", "workbench", req_id, 404)
    if xp.suffix.lower() != ".xp":
        raise ApiError("xp_path must end with .xp", "invalid_xp_path", "workbench", req_id, 422)
    argv, cwd = _xp_tool_command_parts(xp.resolve())
    return {
        "xp_path": str(xp.resolve()),
        "command": " ".join(shlex.quote(x) for x in argv),
        "argv": argv,
        "cwd": str(cwd),
    }


def workbench_open_in_xp_tool(xp_path: str, req_id: str, dry_run: bool = False) -> dict[str, Any]:
    cmd = workbench_xp_tool_command(xp_path, req_id)
    if dry_run:
        return {
            **cmd,
            "launched": False,
            "dry_run": True,
        }
    try:
        proc = subprocess.Popen(
            cmd["argv"],
            cwd=cmd["cwd"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception as e:
        raise ApiError(f"failed to launch xp_tool: {e}", "xp_tool_launch_failed", "workbench", req_id, 500)
    return {
        **cmd,
        "launched": True,
        "dry_run": False,
        "pid": int(proc.pid),
    }


def workbench_save_session(session_id: str, payload: dict[str, Any], req_id: str) -> dict[str, Any]:
    p = _session_path(session_id)
    if not p.exists():
        raise ApiError("session not found", "session_not_found", "workbench", req_id, 404)
    sess = load_json(p)

    cols = int(sess["grid_cols"])
    rows = int(sess["grid_rows"])
    expected_cells = cols * rows

    raw_cells = payload.get("cells")
    if raw_cells is not None:
        if not isinstance(raw_cells, list):
            raise ApiError("cells must be a list", "invalid_cells", "workbench", req_id, 422)
        if len(raw_cells) != expected_cells:
            raise ApiError("cells length mismatch", "session_geometry_invalid", "workbench", req_id, 422)
        coerced = []
        for idx, c in enumerate(raw_cells):
            if not isinstance(c, dict):
                raise ApiError(f"cell {idx} must be object", "invalid_cells", "workbench", req_id, 422)
            try:
                glyph = int(c.get("glyph", 0))
                fg = c.get("fg", [0, 0, 0])
                bg = c.get("bg", [0, 0, 0])
                if not (isinstance(fg, list) and len(fg) == 3 and isinstance(bg, list) and len(bg) == 3):
                    raise ValueError("fg/bg must be rgb triplets")
                fg = [max(0, min(255, int(v))) for v in fg]
                bg = [max(0, min(255, int(v))) for v in bg]
            except Exception as e:
                raise ApiError(f"invalid cell {idx}: {e}", "invalid_cells", "workbench", req_id, 422)
            coerced.append({"idx": idx, "glyph": glyph, "fg": fg, "bg": bg})
        sess["cells"] = coerced

    if "anims" in payload:
        raw_anims = payload.get("anims")
        if not isinstance(raw_anims, list) or not raw_anims:
            raise ApiError("anims must be non-empty list", "invalid_anims", "workbench", req_id, 422)
        anims = [int(x) for x in raw_anims]
        if any(x < 1 for x in anims):
            raise ApiError("anims must be >=1", "invalid_anims", "workbench", req_id, 422)
        sess["anims"] = anims
    if "angles" in payload:
        angles = int(payload.get("angles"))
        if angles < 1:
            raise ApiError("angles must be >=1", "invalid_angles", "workbench", req_id, 422)
        sess["angles"] = angles
    if "projs" in payload:
        projs = int(payload.get("projs"))
        if projs not in (1, 2):
            raise ApiError("projs must be 1 or 2", "invalid_projs", "workbench", req_id, 422)
        sess["projs"] = projs

    if "row_categories" in payload:
        row_categories = payload.get("row_categories")
        if not isinstance(row_categories, dict):
            raise ApiError("row_categories must be object", "invalid_row_categories", "workbench", req_id, 422)
        sess["row_categories"] = row_categories
    if "frame_groups" in payload:
        frame_groups = payload.get("frame_groups")
        if not isinstance(frame_groups, list):
            raise ApiError("frame_groups must be list", "invalid_frame_groups", "workbench", req_id, 422)
        sess["frame_groups"] = frame_groups

    save_json(p, sess)
    return {
        "session_id": session_id,
        "grid_cols": int(sess["grid_cols"]),
        "grid_rows": int(sess["grid_rows"]),
        "angles": int(sess["angles"]),
        "anims": [int(x) for x in sess["anims"]],
        "projs": int(sess["projs"]),
        "cell_count": len(sess["cells"]),
    }
