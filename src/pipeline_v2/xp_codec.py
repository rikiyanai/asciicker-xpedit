from __future__ import annotations

import gzip
import struct
from pathlib import Path


def write_xp(path: str | Path, width: int, height: int, layers: list[list[tuple[int, tuple[int, int, int], tuple[int, int, int]]]]) -> None:
    """Write a minimal REXPaint-like XP file.

    layers: list of flattened layer cell arrays, each size width*height.
    Cell tuple: (glyph, (fg_r,fg_g,fg_b), (bg_r,bg_g,bg_b))
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(p, "wb") as f:
        f.write(struct.pack("<i", -1))
        f.write(struct.pack("<I", len(layers)))
        for layer in layers:
            if len(layer) != width * height:
                raise ValueError("layer cell count mismatch")
            f.write(struct.pack("<i", width))
            f.write(struct.pack("<i", height))
            # REXPaint/xp_core contract: column-major stream order.
            for x in range(width):
                for y in range(height):
                    glyph, fg, bg = layer[y * width + x]
                    f.write(struct.pack("<I", int(glyph)))
                    f.write(bytes([fg[0], fg[1], fg[2], bg[0], bg[1], bg[2]]))


def read_xp(path: str | Path | bytes) -> dict:
    if isinstance(path, bytes):
        raw = path
    else:
        p = Path(path)
        raw = p.read_bytes()
    if raw.startswith(b"\x1f\x8b"):
        data = gzip.decompress(raw)
    else:
        data = raw
    offset = 0

    def u32() -> int:
        nonlocal offset
        v = struct.unpack_from("<I", data, offset)[0]
        offset += 4
        return v

    def i32() -> int:
        nonlocal offset
        v = struct.unpack_from("<i", data, offset)[0]
        offset += 4
        return v

    version = i32()
    if version not in (-1,):
        raise ValueError(f"unsupported xp version: {version}")
    layer_count = u32()
    layers = []
    width = None
    height = None
    for _ in range(layer_count):
        w = i32()
        h = i32()
        if width is None:
            width, height = w, h
        if w != width or h != height:
            raise ValueError("non-uniform layer dimensions")
        cells = [None] * (w * h)
        for x in range(w):
            for y in range(h):
                glyph = u32()
                fg = tuple(data[offset:offset + 3])
                bg = tuple(data[offset + 3:offset + 6])
                offset += 6
                cells[y * w + x] = (glyph, fg, bg)
        layers.append(cells)

    return {
        "version": version,
        "layers": layer_count,
        "width": width or 0,
        "height": height or 0,
        "cells": layers,
    }
