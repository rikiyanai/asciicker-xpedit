# asciicker-pipeline-v2

Greenfield rebuild of the sprite-sheet pipeline. This repo is intentionally independent of the legacy `asciicker` codebase.

## MVP Goal

Convert a sprite sheet PNG into a valid `.xp`, load it into Workbench with populated cells, and export `.xp` back out.

Golden flow:

1. Upload
2. Analyze
3. Run
4. Open Workbench from job
5. Export XP

## Required Inputs

- `image_file` (`.png`)
- `name` (string)
- `angles` (int >= 1)
- `frames` (CSV like `8,8,8,8`)
- `source_projs` (`1|2`, default `1`)
- `render_resolution` (int, default `24`)
- `bg_mode` (`key_color|alpha|none`, default `key_color`)
- `bg_tolerance` (int, default `8`)

## Required Outputs

- `.xp` file path
- preview PNG path
- run report JSON
- gates JSON with G7/G8/G9
- workbench session with `populated_cells > 0`
- exported `.xp` from workbench

## API

- `POST /api/upload`
- `POST /api/analyze`
- `POST /api/run`
- `GET /api/status/<job_id>`
- `POST /api/workbench/load-from-job`
- `POST /api/workbench/export-xp`

All failures return:

```json
{
  "error": "human readable",
  "code": "machine_code",
  "stage": "upload|analyze|run|workbench",
  "request_id": "uuid"
}
```

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
PYTHONPATH=src python3 -m pipeline_v2.app
```

Open:

- Workbench (default): `http://127.0.0.1:5071/` (redirects to `/workbench`)
- Workbench (direct): `http://127.0.0.1:5071/workbench`
- Wizard (legacy, deprecated): `http://127.0.0.1:5071/wizard`

## Tests

```bash
PYTHONPATH=src python3 -m pytest
```

## Notes

- The XP codec implemented here writes/reads classic REXPaint-style layers.
- This MVP uses deterministic grayscale glyph mapping; it is not final art-quality conversion.

## Requirements Checklist

- Canonical checklist: `docs/REQUIREMENTS_CHECKLIST.md`
- Imported real-sheet fixtures: `data/imported/smalltestpngs/`
