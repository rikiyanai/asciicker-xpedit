from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw


def render_preview_png(
    xp_cells: list[tuple[int, tuple[int, int, int], tuple[int, int, int]]],
    cols: int,
    rows: int,
    out_path: str | Path,
    scale: int = 16,
) -> str:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (cols * scale, rows * scale), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    for idx, cell in enumerate(xp_cells):
        glyph, fg, bg = cell
        r = idx // cols
        c = idx % cols
        x0 = c * scale
        y0 = r * scale
        x1 = x0 + scale - 1
        y1 = y0 + scale - 1
        draw.rectangle([x0, y0, x1, y1], fill=bg)
        # cheap glyph visualization for debugging
        if glyph != 32:
            draw.rectangle([x0 + scale // 4, y0 + scale // 4, x0 + 3 * scale // 4, y0 + 3 * scale // 4], fill=fg)

    img.save(out)
    return str(out)
