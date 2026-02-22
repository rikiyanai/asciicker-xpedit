# API Contract (v2 MVP)

## Error Schema (all endpoints)

```json
{
  "error": "string",
  "code": "machine_code",
  "stage": "upload|analyze|run|workbench|status",
  "request_id": "uuid"
}
```

## POST /api/upload

### Request
- `multipart/form-data`
- required field: `file` (`.png` only)

### Success 201
```json
{
  "upload_id": "uuid",
  "source_path": "/abs/path/to/file.png",
  "width": 192,
  "height": 48,
  "sha256": "hex"
}
```

### Failures
- 400 `missing_file`
- 422 `invalid_extension|invalid_image`

## POST /api/analyze

### Request
```json
{ "source_path": "/abs/path/to/file.png" }
```

### Success 200
```json
{
  "image_w": 192,
  "image_h": 48,
  "suggested_angles": 1,
  "suggested_frames": [4],
  "suggested_cell_w": 48,
  "suggested_cell_h": 48,
  "confidence": "medium",
  "diagnostics": { "method": "ratio_heuristic", "note": "MVP heuristic only" }
}
```

### Failures
- 404 `source_not_found`

## POST /api/run

### Request
```json
{
  "source_path": "/abs/path/to/file.png",
  "name": "sprite_name",
  "angles": 1,
  "frames": "8,8,8,8",
  "source_projs": 1,
  "render_resolution": 24,
  "bg_mode": "key_color",
  "bg_tolerance": 8
}
```

### Success 200
```json
{
  "job_id": "uuid",
  "state": "SUCCEEDED",
  "xp_path": "/abs/path/to/export/job.xp",
  "preview_paths": ["/abs/path/to/preview.png"],
  "metadata": {
    "angles": 1,
    "anims": [8],
    "projs": 1,
    "render_resolution": 24,
    "checksum": "hex"
  },
  "gate_report_path": "/abs/path/to/gates.json",
  "trace_path": "/abs/path/to/trace.json"
}
```

### Failures
- 404 `source_not_found`
- 422 `invalid_*`
- 500 `pipeline_image_error`

## GET /api/status/<job_id>

### Success 200
Returns the persisted job record.

### Failure
- 404 `job_not_found`

## POST /api/workbench/load-from-job

### Request
```json
{ "job_id": "uuid" }
```

### Success 201
```json
{
  "session_id": "uuid",
  "job_id": "uuid",
  "populated_cells": 48,
  "grid_cols": 48,
  "grid_rows": 1,
  "cell_w": 24,
  "cell_h": 24,
  "angles": 1,
  "anims": [8],
  "projs": 1
}
```

### Failures
- 400 `missing_job_id`
- 404 `job_not_found`
- 422 `empty_workbench`

## POST /api/workbench/export-xp

### Request
```json
{ "session_id": "uuid" }
```

### Success 200
```json
{
  "session_id": "uuid",
  "xp_path": "/abs/path/to/export/session-uuid.xp",
  "checksum": "hex"
}
```

### Failures
- 400 `missing_session_id`
- 404 `session_not_found`
- 422 `session_geometry_invalid`
