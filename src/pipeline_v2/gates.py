from __future__ import annotations

from .models import GateResult


THRESHOLD_MET = "THRESHOLD_MET"
THRESHOLD_BREACHED = "THRESHOLD_BREACHED"


def gate_g7_geometry(expected_cells: int, actual_cells: int) -> GateResult:
    ok = expected_cells == actual_cells
    return GateResult(
        gate="G7",
        verdict=THRESHOLD_MET if ok else THRESHOLD_BREACHED,
        details={"expected_cells": expected_cells, "actual_cells": actual_cells},
    )


def gate_g8_nonempty(glyphs: list[int], min_ratio: float = 0.05) -> GateResult:
    if not glyphs:
        return GateResult("G8", THRESHOLD_BREACHED, {"ratio": 0.0, "min_ratio": min_ratio})
    nonempty = sum(1 for g in glyphs if g != 32)
    ratio = nonempty / len(glyphs)
    ok = ratio >= min_ratio
    return GateResult(
        gate="G8",
        verdict=THRESHOLD_MET if ok else THRESHOLD_BREACHED,
        details={"ratio": ratio, "min_ratio": min_ratio, "nonempty": nonempty, "total": len(glyphs)},
    )


def gate_g9_handoff(populated_cells: int) -> GateResult:
    ok = populated_cells > 0
    return GateResult(
        gate="G9",
        verdict=THRESHOLD_MET if ok else THRESHOLD_BREACHED,
        details={"populated_cells": populated_cells},
    )
