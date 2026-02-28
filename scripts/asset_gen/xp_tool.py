#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="python3 -m scripts.asset_gen.xp_tool",
        description="Minimal local XP helper for pipeline-v2.",
    )
    parser.add_argument("xp_path", nargs="?", help="Path to .xp file")
    args = parser.parse_args()

    if not args.xp_path:
        parser.print_help()
        return 2

    xp = Path(args.xp_path).expanduser().resolve()
    if not xp.exists():
        print(json.dumps({"ok": False, "error": f"xp not found: {xp}"}))
        return 1
    if xp.suffix.lower() != ".xp":
        print(json.dumps({"ok": False, "error": f"expected .xp file: {xp}"}))
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "mode": "local-minimal",
                "xp_path": str(xp),
                "size_bytes": xp.stat().st_size,
                "note": "No external repo dependency; advanced XP editor integration is optional.",
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
