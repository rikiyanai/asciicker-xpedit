"""WSGI entrypoint for production servers (gunicorn, waitress, etc.).

Usage:
    gunicorn wsgi:app --bind 0.0.0.0:5071
    waitress-serve --listen=0.0.0.0:5071 wsgi:app

Requires PYTHONPATH=src or an installed package so that pipeline_v2 is importable.
"""
import sys
from pathlib import Path

# Ensure src/ is on the import path when running from repo root.
_src = str(Path(__file__).resolve().parent / "src")
if _src not in sys.path:
    sys.path.insert(0, _src)

from pipeline_v2.app import create_app  # noqa: E402

app = create_app()
