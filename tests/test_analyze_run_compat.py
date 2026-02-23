from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image, ImageDraw


def _upload(client, path: Path):
    with path.open("rb") as f:
        return client.post("/api/upload", data={"file": (f, path.name)}, content_type="multipart/form-data")


def _write_fixture(path: Path, w: int, h: int) -> None:
    im = Image.new("RGBA", (w, h), (255, 0, 255, 255))
    draw = ImageDraw.Draw(im)
    draw.rectangle(
        (
            max(0, w // 4),
            max(0, h // 4),
            min(w - 1, (3 * w) // 4),
            min(h - 1, (3 * h) // 4),
        ),
        fill=(48, 180, 96, 255),
    )
    im.save(path)


def _write_dense_grid_fixture(path: Path, cols: int, rows: int, cell_w: int = 32, cell_h: int = 32) -> None:
    w = cols * cell_w
    h = rows * cell_h
    im = Image.new("RGBA", (w, h), (244, 244, 244, 255))
    draw = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w
            y0 = r * cell_h
            cx = x0 + (cell_w // 2)
            head_y = y0 + max(2, cell_h // 5)
            body_top = y0 + max(4, cell_h // 3)
            body_bot = y0 + max(6, (cell_h * 4) // 5)
            draw.rectangle((cx - 2, head_y, cx + 2, head_y + 4), fill=(20, 20, 20, 255))
            draw.rectangle((cx - 1, body_top, cx + 1, body_bot), fill=(20, 20, 20, 255))
            draw.rectangle((cx - 5, body_top + 3, cx + 5, body_top + 4), fill=(20, 20, 20, 255))
            draw.rectangle((cx - 3, body_bot, cx - 2, body_bot + 5), fill=(20, 20, 20, 255))
            draw.rectangle((cx + 2, body_bot, cx + 3, body_bot + 5), fill=(20, 20, 20, 255))
    im.save(path)


def _write_projection_fixture(
    path: Path,
    angles: int,
    semantic_frames: int,
    frame_w: int,
    frame_h: int,
    split_gap: int = 0,
) -> None:
    total_w = (semantic_frames * frame_w) + split_gap + (semantic_frames * frame_w if split_gap > 0 else 0)
    total_h = angles * frame_h
    im = Image.new("RGBA", (total_w, total_h), (255, 0, 255, 255))
    draw = ImageDraw.Draw(im)
    for a in range(angles):
        y0 = a * frame_h
        for f in range(semantic_frames):
            x0 = f * frame_w
            draw.rectangle((x0 + 5, y0 + 4, x0 + 9, y0 + 19), fill=(236, 236, 236, 255))
            if split_gap > 0:
                x1 = semantic_frames * frame_w + split_gap + (f * frame_w)
                draw.rectangle((x1 + 4, y0 + 3, x1 + 10, y0 + 20), fill=(230, 230, 230, 255))
    im.save(path)


@pytest.mark.parametrize(
    "w,h",
    [
        (315, 200),  # ~1.57: previous invalid_sheet_geometry class
        (153, 102),  # ~1.50
        (34, 24),    # tiny wide sheet edge case
        (34, 12),    # very wide strip edge case
        (24, 99),    # tall sheet edge case
        (25, 100),   # very tall sheet edge case
    ],
)
def test_analyze_suggestion_is_run_compatible(client, tmp_path: Path, w: int, h: int):
    fixture = tmp_path / f"compat_{w}x{h}.png"
    _write_fixture(fixture, w, h)

    up = _upload(client, fixture).get_json()
    analyze_resp = client.post(
        "/api/analyze",
        data=json.dumps({"source_path": up["source_path"]}),
        content_type="application/json",
    )
    assert analyze_resp.status_code == 200
    analyze_data = analyze_resp.get_json()
    suggested_source_projs = int(analyze_data.get("suggested_source_projs", 1))
    suggested_render_resolution = int(analyze_data.get("suggested_render_resolution", 12))
    assert suggested_source_projs in (1, 2)
    assert suggested_render_resolution >= 1

    run_payload = {
        "source_path": up["source_path"],
        "name": f"compat_{w}x{h}",
        "angles": int(analyze_data["suggested_angles"]),
        "frames": ",".join(str(x) for x in analyze_data["suggested_frames"]),
        "source_projs": suggested_source_projs,
        "render_resolution": suggested_render_resolution,
    }
    run_resp = client.post("/api/run", data=json.dumps(run_payload), content_type="application/json")
    assert run_resp.status_code == 200, run_resp.get_json()


@pytest.mark.parametrize(
    "w,h",
    [
        (3024, 1920),
        (1536, 1024),
    ],
)
def test_analyze_suggestion_avoids_giant_frames(client, tmp_path: Path, w: int, h: int):
    fixture = tmp_path / f"giant_guard_{w}x{h}.png"
    _write_fixture(fixture, w, h)

    up = _upload(client, fixture).get_json()
    analyze_resp = client.post(
        "/api/analyze",
        data=json.dumps({"source_path": up["source_path"]}),
        content_type="application/json",
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.get_json()

    suggested_angles = int(data["suggested_angles"])
    suggested_frames = [int(x) for x in data["suggested_frames"]]
    assert suggested_angles >= 1
    assert sum(suggested_frames) >= 1
    assert int(data["suggested_cell_w"]) <= 256
    assert int(data["suggested_cell_h"]) <= 256
    assert suggested_angles * sum(suggested_frames) >= 4


def test_analyze_suggestion_avoids_coarse_multi_sprite_splits(client, tmp_path: Path):
    fixture = tmp_path / "dense_grid_10x5.png"
    _write_dense_grid_fixture(fixture, cols=10, rows=5, cell_w=32, cell_h=32)

    up = _upload(client, fixture).get_json()
    analyze_resp = client.post(
        "/api/analyze",
        data=json.dumps({"source_path": up["source_path"]}),
        content_type="application/json",
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.get_json()

    suggested_angles = int(data["suggested_angles"])
    suggested_frames = [int(x) for x in data["suggested_frames"]]
    total_tiles = suggested_angles * sum(suggested_frames)
    assert total_tiles >= 40
    assert int(data["suggested_cell_w"]) <= 40
    assert int(data["suggested_cell_h"]) <= 40


def test_analyze_prefers_source_projs_2_on_center_split_hint(client, tmp_path: Path):
    fixture = tmp_path / "projection_split.png"
    _write_projection_fixture(fixture, angles=6, semantic_frames=8, frame_w=16, frame_h=24, split_gap=16)

    up = _upload(client, fixture).get_json()
    analyze_resp = client.post(
        "/api/analyze",
        data=json.dumps({"source_path": up["source_path"]}),
        content_type="application/json",
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.get_json()
    hint = ((data.get("diagnostics") or {}).get("grid_hint") or {})
    assert bool(hint.get("projection_split_hint")) is True
    assert int(data["suggested_source_projs"]) == 2
    assert int(data["suggested_angles"]) == 6
    assert [int(x) for x in data["suggested_frames"]] == [8]


def test_analyze_keeps_source_projs_1_without_split_hint(client, tmp_path: Path):
    fixture = tmp_path / "single_projection.png"
    _write_projection_fixture(fixture, angles=6, semantic_frames=12, frame_w=16, frame_h=24, split_gap=0)

    up = _upload(client, fixture).get_json()
    analyze_resp = client.post(
        "/api/analyze",
        data=json.dumps({"source_path": up["source_path"]}),
        content_type="application/json",
    )
    assert analyze_resp.status_code == 200
    data = analyze_resp.get_json()
    hint = ((data.get("diagnostics") or {}).get("grid_hint") or {})
    assert bool(hint.get("projection_split_hint")) is False
    assert int(data["suggested_source_projs"]) == 1
