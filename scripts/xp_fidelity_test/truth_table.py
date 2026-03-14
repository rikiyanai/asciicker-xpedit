# scripts/xp_fidelity_test/truth_table.py
"""
XP Truth Table Extractor

Reads an XP file via xp_core.py and outputs a JSON truth table:
{
  "source": "<filename>",
  "width": N,
  "height": N,
  "layer_count": N,
  "layers": [
    {
      "index": 0,
      "width": N,
      "height": N,
      "editable": false,
      "cell_count": N,
      "non_transparent_count": N,
      "cells": [
        {"x": 0, "y": 0, "glyph": 65, "fg": [255, 0, 0], "bg": [0, 0, 255]},
        ...
      ]
    },
    ...
  ]
}

Usage:
  python3 scripts/xp_fidelity_test/truth_table.py <xp_file> [--output <json_path>]
"""
import sys, json, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'rex_mcp'))
from xp_core import XPFile

MAGENTA = (255, 0, 255)


def is_transparent(glyph, bg):
    """Check if cell is transparent (glyph 0 with magenta bg)."""
    return bg == MAGENTA and glyph == 0


def extract_truth_table(xp_path):
    xp = XPFile(xp_path)
    layers_out = []

    for layer_idx, layer in enumerate(xp.layers):
        cells = []
        non_transparent = 0
        for y in range(layer.height):
            for x in range(layer.width):
                glyph, fg, bg = layer.data[y][x]
                g = int(glyph)
                f = [int(fg[0]), int(fg[1]), int(fg[2])]
                b = [int(bg[0]), int(bg[1]), int(bg[2])]
                cells.append({"x": x, "y": y, "glyph": g, "fg": f, "bg": b})
                if not is_transparent(g, (b[0], b[1], b[2])):
                    non_transparent += 1

        layers_out.append({
            "index": layer_idx,
            "width": layer.width,
            "height": layer.height,
            "editable": layer_idx == 2,
            "cell_count": len(cells),
            "non_transparent_count": non_transparent,
            "cells": cells
        })

    return {
        "source": os.path.basename(xp_path),
        "width": xp.layers[0].width if xp.layers else 0,
        "height": xp.layers[0].height if xp.layers else 0,
        "layer_count": len(xp.layers),
        "layers": layers_out
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 truth_table.py <xp_file> [--output <json_path>]", file=sys.stderr)
        sys.exit(1)

    xp_path = sys.argv[1]
    output_path = None
    if '--output' in sys.argv:
        idx = sys.argv.index('--output')
        output_path = sys.argv[idx + 1]

    table = extract_truth_table(xp_path)

    if output_path:
        with open(output_path, 'w') as f:
            json.dump(table, f, indent=2)
        layer2 = next((l for l in table['layers'] if l['index'] == 2), None)
        nt = layer2['non_transparent_count'] if layer2 else '?'
        print(f"Truth table: {table['source']}, {table['layer_count']} layers, "
              f"{table['width']}x{table['height']}, "
              f"layer 2 non-transparent: {nt}/{table['width']*table['height']}",
              file=sys.stderr)
    else:
        json.dump(table, sys.stdout, indent=2)


if __name__ == '__main__':
    main()
