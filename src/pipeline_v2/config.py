from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
JOBS_DIR = DATA_DIR / "jobs"
SESSIONS_DIR = DATA_DIR / "sessions"
EXPORT_DIR = DATA_DIR / "exports"
PREVIEWS_DIR = DATA_DIR / "previews"
GATES_DIR = DATA_DIR / "gates"
TRACES_DIR = DATA_DIR / "traces"
BUNDLES_DIR = DATA_DIR / "bundles"
CONFIG_DIR = ROOT / "config"
SPRITES_DIR = ROOT / "sprites"

ENABLED_FAMILIES: set[str] = {"player", "attack"}


def ensure_dirs() -> None:
    for path in [
        DATA_DIR,
        UPLOAD_DIR,
        JOBS_DIR,
        SESSIONS_DIR,
        EXPORT_DIR,
        PREVIEWS_DIR,
        GATES_DIR,
        TRACES_DIR,
        BUNDLES_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)
