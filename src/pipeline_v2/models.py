from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass(slots=True)
class ApiError(Exception):
    error: str
    code: str
    stage: str
    request_id: str
    status: int = 400

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": self.error,
            "code": self.code,
            "stage": self.stage,
            "request_id": self.request_id,
        }


@dataclass(slots=True)
class RunConfig:
    source_path: str
    name: str
    angles: int
    frames: list[int]
    source_projs: int = 1
    render_resolution: int = 12
    bg_mode: str = "key_color"
    bg_tolerance: int = 8

    def validate(self, request_id: str) -> None:
        if not self.source_path:
            raise ApiError("source_path is required", "missing_source_path", "run", request_id, 400)
        if not self.name:
            raise ApiError("name is required", "missing_name", "run", request_id, 400)
        if self.angles < 1:
            raise ApiError("angles must be >= 1", "invalid_angles", "run", request_id, 422)
        if not self.frames or any(x < 1 for x in self.frames):
            raise ApiError("frames must be positive integers", "invalid_frames", "run", request_id, 422)
        if self.source_projs not in (1, 2):
            raise ApiError("source_projs must be 1 or 2", "invalid_source_projs", "run", request_id, 422)
        if self.render_resolution < 1:
            raise ApiError("render_resolution must be >= 1", "invalid_render_resolution", "run", request_id, 422)
        if self.bg_mode not in {"key_color", "alpha", "none"}:
            raise ApiError("bg_mode must be key_color|alpha|none", "invalid_bg_mode", "run", request_id, 422)
        if self.bg_tolerance < 0:
            raise ApiError("bg_tolerance must be >= 0", "invalid_bg_tolerance", "run", request_id, 422)

    @property
    def projs(self) -> int:
        if self.angles <= 1:
            return 1
        return 2 if self.source_projs == 1 else self.source_projs


@dataclass(slots=True)
class GateResult:
    gate: str
    verdict: str
    details: dict[str, Any]


@dataclass(slots=True)
class JobRecord:
    job_id: str
    state: str
    stage: str
    source_path: str
    xp_path: str | None
    preview_paths: list[str]
    metadata: dict[str, Any]
    gate_report_path: str | None
    trace_path: str | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class WorkbenchSession:
    session_id: str
    job_id: str
    angles: int
    anims: list[int]
    projs: int
    cell_w: int
    cell_h: int
    grid_cols: int
    grid_rows: int
    cells: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def parse_frames_csv(frames_raw: Any, request_id: str, stage: str) -> list[int]:
    if isinstance(frames_raw, list):
        vals: list[int] = []
        for x in frames_raw:
            if not isinstance(x, (int, float)):
                raise ApiError("frames list must contain numbers", "invalid_frames", stage, request_id, 422)
            vals.append(int(x))
        return vals
    if isinstance(frames_raw, str):
        out = [int(x.strip()) for x in frames_raw.split(",") if x.strip()]
        return out
    if isinstance(frames_raw, (int, float)):
        return [int(frames_raw)]
    raise ApiError("frames must be csv string or list", "invalid_frames_type", stage, request_id, 422)
