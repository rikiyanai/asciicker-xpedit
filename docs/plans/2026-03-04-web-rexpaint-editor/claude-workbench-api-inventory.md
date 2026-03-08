# Workbench API Complete Inventory

Generated: 2026-03-04

---

## 1. HTTP Endpoints (app.py)

### Static / UI Routes

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/` | Redirect to `/workbench` (302) |
| 2 | GET | `/wizard` | Serve legacy wizard HTML page |
| 3 | GET | `/workbench` | Serve workbench HTML page |
| 4 | GET | `/termpp-skin-lab` | Serve TERM++ skin lab HTML page |
| 5 | GET | `/<path:filename>` | Serve static web assets from `web/` dir |
| 6 | GET | `/termpp-web` | Serve TERM++ web runtime index.html |
| 7 | GET | `/termpp-web/<path:filename>` | Serve TERM++ web runtime assets |
| 8 | GET | `/termpp-web-flat` | Serve flat TERM++ web runtime index.html |
| 9 | GET | `/termpp-web-flat/<path:filename>` | Serve flat TERM++ web runtime assets |

### API Endpoints

| # | Method | Path | Request | Response | Purpose |
|---|--------|------|---------|----------|---------|
| 10 | GET | `/api/workbench/runtime-preflight` | none | `{ok, runtime_root, required_files, missing_files, invalid_files, maps_found, checked_at}` | Check WASM runtime bundle health |
| 11 | GET | `/api/workbench/templates` | none | `{template_sets, enabled_families}` | List template sets and enabled families |
| 12 | POST | `/api/workbench/bundle/create` | `{template_set_key}` | `{bundle_id, template_set_key, actions, created_at, updated_at}` (201) | Create a new bundle session from template |
| 13 | POST | `/api/workbench/action-grid/apply` | `{bundle_id, action_key, source_path}` | `{bundle_id, action_key, job_id, session_id, grid_cols, grid_rows, family}` | Run pipeline for one bundle action |
| 14 | POST | `/api/workbench/export-bundle` | `{bundle_id}` | `{bundle_id, exports, gate_reports}` | Export all bundle actions as .xp with G10-G12 gates |
| 15 | POST | `/api/workbench/web-skin-bundle-payload` | `{bundle_id}` | `{bundle_id, actions: {xp_b64, override_names, ...}, unmapped_families}` | Get per-action XP bytes for WASM injection |
| 16 | POST | `/api/upload` | multipart file (field: `file`) | `{upload_id, source_path, width, height, sha256}` (201) | Upload PNG sprite sheet |
| 17 | POST | `/api/analyze` | `{source_path}` | `{image_w, image_h, suggested_angles, suggested_frames, suggested_cell_w, suggested_cell_h, suggested_source_projs, suggested_render_resolution, confidence, diagnostics}` | Analyze image and suggest geometry |
| 18 | POST | `/api/run` | `{source_path, name, angles, frames, source_projs, render_resolution, bg_mode, bg_tolerance, native_compat}` | `{job_id, state, xp_path, preview_paths, metadata, gate_report_path, trace_path}` | Run sprite conversion pipeline |
| 19 | GET | `/api/status/<job_id>` | path param: job_id | Full JobRecord dict | Poll pipeline job status |
| 20 | POST | `/api/workbench/load-from-job` | `{job_id}` | `{session_id, job_id, populated_cells, layer_count, grid_cols, grid_rows, cell_w, cell_h, angles, anims, projs, cells, ...}` (201) | Create workbench session from completed job |
| 21 | POST | `/api/workbench/export-xp` | `{session_id}` | `{session_id, xp_path, checksum}` | Export session as .xp file |
| 22 | GET | `/api/workbench/download-xp` | query: `xp_path` | Binary .xp file (attachment) | Download exported .xp file |
| 23 | POST | `/api/workbench/xp-tool-command` | `{xp_path}` | `{xp_path, command, argv, cwd}` | Get command to open XP in xp_tool |
| 24 | POST | `/api/workbench/open-in-xp-tool` | `{xp_path, dry_run?}` | `{xp_path, command, argv, cwd, launched, pid?}` | Launch xp_tool viewer for an XP file |
| 25 | POST | `/api/workbench/termpp-skin-command` | `{session_id, binary_name?}` | `{session_id, xp_path, legacy_root, binary_name, planned_runtime_root, planned_command}` | Get TERM++ skin test launch command |
| 26 | POST | `/api/workbench/open-termpp-skin` | `{session_id, binary_name?, dry_run?}` | `{session_id, xp_path, launched, pid?, runtime_root, ...}` | Launch TERM++ with skin in sandbox |
| 27 | POST | `/api/workbench/web-skin-payload` | `{session_id}` | `{session_id, xp_path, checksum, xp_size_bytes, xp_b64, override_names}` | Get classic session XP bytes for WASM injection |
| 28 | POST | `/api/workbench/termpp-stream/start` | `{session_id, x?, y?, w?, h?, fps?, dry_run?}` | `{stream_id, session_id, running, fps, region, frame_path, ...}` | Start screencapture stream (macOS) |
| 29 | POST | `/api/workbench/termpp-stream/stop` | `{stream_id}` | `{stream_id, stopped, ...}` | Stop screencapture stream |
| 30 | GET | `/api/workbench/termpp-stream/status/<stream_id>` | path param: stream_id | `{stream_id, running, fps, region, frame_count, ...}` | Poll stream status |
| 31 | GET | `/api/workbench/termpp-stream/frame/<stream_id>` | path param: stream_id | Binary PNG image | Get latest stream frame |
| 32 | POST | `/api/workbench/save-session` | `{session_id, cells?, anims?, angles?, projs?, row_categories?, frame_groups?, source_boxes?, source_anchor_box?, source_draft_box?, source_cuts_v?, source_cuts_h?}` | `{session_id, grid_cols, grid_rows, angles, anims, projs, cell_count, source_boxes}` | Save edits to workbench session |
| 33 | POST | `/api/workbench/run-verification` | `{session_id, profile?, command_template?, timeout_sec?, dry_run?}` | `{session_id, profile, passed, exit_code, checks, stats, ...}` | Run verification on exported session |

**Total HTTP endpoints: 33** (9 static/UI + 24 API)

---

## 2. MCP Tools

### workbench_mcp_server.py (workbench-api) — 16 tools

| # | Tool Name | Params | Returns | Purpose |
|---|-----------|--------|---------|---------|
| 1 | `server_status` | none | `{ok, url, message?}` | Check if workbench server is reachable |
| 2 | `upload_png` | `file_path: str` | `{upload_id, source_path, width, height, sha256}` | Upload PNG via `/api/upload` |
| 3 | `run_pipeline` | `source_path, name, angles?, frames?, source_projs?, render_resolution?, bg_mode?, bg_tolerance?, native_compat?` | `{job_id, state, ...}` | Run conversion via `/api/run` |
| 4 | `get_job_status` | `job_id: str` | `{state, stage, xp_path, previews}` | Poll job via `/api/status/<job_id>` |
| 5 | `load_session` | `job_id: str` | `{session_id, ...}` | Create session from job via `/api/workbench/load-from-job` |
| 6 | `save_session` | `session_id: str, payload?: str` | `{session_id, ...}` | Save session via `/api/workbench/save-session` |
| 7 | `export_xp` | `session_id: str` | `{xp_path}` | Export session as .xp via `/api/workbench/export-xp` |
| 8 | `get_skin_payload` | `session_id: str` | `{xp_b64, override_names, ...}` | Get classic web skin payload (rejects bundles with 409) |
| 9 | `get_templates` | none | `{template_sets, enabled_families}` | List templates via `/api/workbench/templates` |
| 10 | `create_bundle` | `template_set_key: str` | `{bundle_id, actions}` | Create bundle via `/api/workbench/bundle/create` |
| 11 | `apply_action_grid` | `bundle_id, action_key, source_path` | `{bundle_id, action_key, job_id, session_id}` | Run action pipeline via `/api/workbench/action-grid/apply` |
| 12 | `get_bundle_payload` | `bundle_id: str` | `{actions: {xp_b64, override_names, gate_report}}` | Get bundle payload via `/api/workbench/web-skin-bundle-payload` |
| 13 | `export_bundle` | `bundle_id: str` | `{exports, gate_reports}` | Export bundle via `/api/workbench/export-bundle` |
| 14 | `check_runtime_preflight` | none | `{ok, missing_files, ...}` | Check WASM runtime health via `/api/workbench/runtime-preflight` |
| 15 | `validate_structural_gates` | `bundle_id: str` | `{bundle_id, overall, actions: {gates, passed}}` | Run G10-G12 gates (calls export-bundle, reshapes response) |
| 16 | `validate_override_names` | `bundle_id: str` | `{bundle_id, overall, actions: {count, valid, invalid, names}, total_files}` | Validate AHSW naming convention on bundle payload |
| 17 | `inspect_payload` | `session_id?: str, bundle_id?: str` | `{mode, xp_size_bytes, override_file_count, ...}` | Inspect skin payload structure without raw b64 data |

**Note:** 17 tools total (the docstring says 16 but `inspect_payload` makes 17).

### xp_mcp_server.py (XP Tool) — 12 tools

| # | Tool Name | Params | Returns | Purpose |
|---|-----------|--------|---------|---------|
| 1 | `read_xp_info` | `path: str` | `dict: {version, layer_count, layers, metadata}` | Read XP file metadata |
| 2 | `create_xp_file` | `path, width, height, layer_count?` | `str` status | Create blank XP file (min 3 layers) |
| 3 | `add_layer` | `path: str` | `str` status | Add empty layer to XP file |
| 4 | `write_cell` | `path, layer_idx, x, y, glyph, fg, bg` | `str` status | Write single cell (glyph + colors) |
| 5 | `fill_rect` | `path, layer_idx, x, y, w, h, glyph, fg, bg` | `str` status | Fill rectangular region |
| 6 | `read_layer_region` | `path, layer_idx, x, y, w, h` | `dict: {data}` | Read sub-region of cells |
| 7 | `set_metadata` | `path, angles, anims` | `str` status | Write L0 animation metadata |
| 8 | `replace_color` | `path, old_hex, new_hex, layers?` | `str` status | Find-replace color across layers |
| 9 | `resize_xp_file` | `path, width, height` | `str` status | Resize canvas (centered reposition) |
| 10 | `write_ascii_block` | `path, layer_idx, x, y, width, text, fg_hex?, bg_hex?` | `str` status | Write multi-line text/ASCII art |
| 11 | `shift_layer_content` | `path, src_idx, dest_idx` | `str` status | Move content between layers |
| 12 | `write_text` | `path, layer_idx, x, y, text, fg_hex?, bg_hex?` | `str` status | Write single-line text |

### rex_mcp/server.py (rex_manager) — 17 tools

| # | Tool Name | Params | Returns | Purpose |
|---|-----------|--------|---------|---------|
| 1 | `ping` | none | `str "pong"` | Health check |
| 2 | `is_rexpaint_running` | none | `bool` | Check if REXPaint.exe running via Wine |
| 3 | `launch_rexpaint` | none | `str` status | Launch REXPaint via Wine |
| 4 | `focus_rexpaint` | none | `str` status | Bring REXPaint window to front (AppleScript) |
| 5 | `send_keystroke` | `key: str` | `str` status | Send keystroke to REXPaint |
| 6 | `send_key_combo` | `keys: list[str]` | `str` status | Send key combination (e.g. Ctrl+S) |
| 7 | `switch_layer` | `layer_num: int` | `str` status | Switch REXPaint layer (0-9) |
| 8 | `click_at` | `x: int, y: int` | `str` status | Click at screen coordinates |
| 9 | `save_in_rexpaint` | none | `str` status | Send Ctrl+S to save |
| 10 | `export_png_in_rexpaint` | none | `str` status | Send Ctrl+E to export PNG |
| 11 | `list_assets` | `directory?: str` | `list[str]` | List .xp files in directory |
| 12 | `get_summary` | `path: str` | `str` | Get XP metadata + ASCII preview |
| 13 | `read_xp` | `path: str` | `str` | Read XP file basic info |
| 14 | `write_xp` | `path, width, height` | `str` status | Create basic 3-layer XP file |
| 15 | `set_cell` | `path, layer, x, y, glyph, fg, bg` | `str` status | Set specific cell |
| 16 | `fill_rect` | `path, layer, x, y, w, h, glyph, fg, bg` | `str` status | Fill rectangular area |
| 17 | `apply_deltas` | `path, layer, deltas` | `str` status | Batch cell updates |
| 18 | `get_mcp_config` | none | `str` | Return MCP config snippet |

**Total MCP tools: 47** (17 workbench-api + 12 xp-tool + 18 rex-manager)

---

## 3. Service Methods (service.py)

### Public Service Methods (called from app.py routes)

| # | Method | Params | Returns | Purpose |
|---|--------|--------|---------|---------|
| 1 | `upload_image` | `file_storage, req_id` | `dict` | Save uploaded PNG, validate, return metadata |
| 2 | `analyze_image` | `source_path, req_id` | `dict` | Analyze image and suggest geometry parameters |
| 3 | `run_pipeline` | `cfg: RunConfig, req_id` | `dict` | Full sprite conversion: slice, render cells, write XP |
| 4 | `status` | `job_id, req_id` | `dict` | Load job record from disk |
| 5 | `workbench_load_from_job` | `job_id, req_id` | `dict` | Create WorkbenchSession from completed job XP |
| 6 | `workbench_save_session` | `session_id, payload, req_id` | `dict` | Save session edits (cells, metadata, source boxes) |
| 7 | `workbench_export_xp` | `session_id, req_id` | `dict` | Export session as native-contract .xp file |
| 8 | `workbench_xp_tool_command` | `xp_path, req_id` | `dict` | Build xp_tool launch command |
| 9 | `workbench_open_in_xp_tool` | `xp_path, req_id, dry_run?` | `dict` | Launch xp_tool subprocess |
| 10 | `workbench_run_verification` | `session_id, req_id, profile?, command_template?, timeout_sec?, dry_run?` | `dict` | Run verification (local_xp_sanity or custom shell) |
| 11 | `workbench_termpp_skin_command` | `session_id, req_id, binary_name?` | `dict` | Build TERM++ skin test command |
| 12 | `workbench_open_termpp_skin` | `session_id, req_id, binary_name?, dry_run?` | `dict` | Launch TERM++ in sandboxed runtime |
| 13 | `workbench_termpp_stream_start` | `session_id, req_id, x, y, w, h, fps?, dry_run?` | `dict` | Start screencapture stream thread |
| 14 | `workbench_termpp_stream_stop` | `stream_id, req_id` | `dict` | Stop screencapture stream |
| 15 | `workbench_termpp_stream_status` | `stream_id, req_id` | `dict` | Get stream status |
| 16 | `workbench_termpp_stream_frame_path` | `stream_id, req_id` | `Path` | Get path to latest frame PNG |
| 17 | `workbench_web_skin_payload` | `session_id, req_id` | `dict` | Build classic session XP b64 + override names |
| 18 | `workbench_web_skin_bundle_payload` | `bundle_id, req_id` | `dict` | Build per-action XP b64 + override names for bundle |
| 19 | `workbench_export_bundle` | `bundle_id, req_id` | `dict` | Export all bundle actions, run G10-G12 gates |
| 20 | `load_template_registry` | none | `dict` | Load/cache template_registry.json |
| 21 | `create_bundle` | `template_set_key, req_id` | `dict` | Create new BundleSession from template |
| 22 | `load_bundle` | `bundle_id, req_id` | `BundleSession` | Load bundle from disk |
| 23 | `save_bundle` | `bundle: BundleSession` | `None` | Persist bundle to disk |
| 24 | `bundle_action_run` | `bundle_id, action_key, source_path, req_id` | `dict` | Run pipeline for one bundle action |
| 25 | `_is_bundle_session` | `session_id` | `bool` | Check if session belongs to a bundle |

### Internal/Private Service Methods

| # | Method | Purpose |
|---|--------|---------|
| 26 | `_suggest_run_geometry` | Exhaustive geometry search for optimal angles/frames/projs |
| 27 | `_sha256` | Compute SHA-256 hash of file |
| 28 | `_load_reference_l0` | Load and cache L0 reference cells from XP file |
| 29 | `_assert_l0_reference_available` | Assert L0 ref is loaded or raise ApiError |
| 30 | `_assert_native_contract_dims` | Validate 126x80 player contract |
| 31 | `_assert_native_dims` | Validate family-specific native dimensions |
| 32 | `_build_native_l0_layer` | Build L0 metadata layer (player family) |
| 33 | `_build_native_l1_layer` | Build L1 height encoding layer (9-0 countdown) |
| 34 | `_build_native_player_layers` | Assemble 4 layers for player skin |
| 35 | `_build_native_attack_layers` | Assemble 4 layers for attack skin |
| 36 | `_build_native_death_layers` | Assemble 3 layers for death/plydie skin |
| 37 | `_build_native_layers` | Dispatch to family-specific layer builder |
| 38 | `_estimate_bg_rgb` | Estimate background color from image edges |
| 39 | `_infer_signal_mode` | Choose alpha vs delta foreground detection |
| 40 | `_crop_to_foreground` | Crop image to foreground bounding box |
| 41 | `_foreground_bbox` | Get foreground bounding box coordinates |
| 42 | `_region_stats` | Compute occupancy and average color for pixel region |
| 43 | `_cell_from_patch` | Convert image patch to single XP cell (glyph + colors) |
| 44 | `_tile_to_cells` | Convert image tile to grid of XP cells |
| 45 | `_transparent_cell` | Return transparent cell tuple |
| 46 | `_digit_to_glyph` | Convert integer to CP437 digit glyph |
| 47 | `_termpp_skin_override_names` | Generate legacy override filenames (81 files) |
| 48 | `_action_override_names` | Generate AHSW override filenames per family |
| 49 | `_stage_termpp_skin_sandbox` | Create isolated runtime dir with symlinks + skin overrides |
| 50 | `_workbench_verify_local_xp_sanity` | Built-in XP validation checks |
| 51 | `_workbench_verify_custom_shell` | Run custom shell command verification |
| 52 | `_run_structural_gates` | Run G10-G12 on exported XP |
| 53 | `_termpp_stream_worker` | Background thread for screencapture loop |
| 54 | `_termpp_stream_record_view` | Format stream record for API response |
| 55 | `_stream_capture_command` | Build screencapture CLI command |
| 56 | `_xp_tool_command_parts` | Resolve xp_tool module path and build argv |
| 57 | `_resolve_xp_tool_repo_root` | Resolve XP_TOOL_REPO_ROOT env var |
| 58 | `_resolve_legacy_repo_root` | Resolve TERMPP_REPO_ROOT env var |
| 59 | `_resolve_termpp_binary` | Find TERM++ binary in .run/ directory |
| 60 | `_normalize_binary_name` | Validate and normalize binary filename |

**Total service methods: 25 public + 35 private = 60**

---

## 4. Data Models (models.py)

### ApiError
```
@dataclass(slots=True)
Fields: error: str, code: str, stage: str, request_id: str, status: int = 400
Methods: to_dict() -> dict
Inherits: Exception
```

### RunConfig
```
@dataclass(slots=True)
Fields:
  source_path: str
  name: str
  angles: int
  frames: list[int]
  source_projs: int = 1
  render_resolution: int = 12
  bg_mode: str = "key_color"         # key_color | alpha | none
  bg_tolerance: int = 8
  native_compat: bool = True
  target_cols: int | None = None
  target_rows: int | None = None
  family: str = "player"             # player | attack | plydie
Methods: validate(request_id), projs (property)
```

### GateResult
```
@dataclass(slots=True)
Fields: gate: str, verdict: str, details: dict[str, Any]
```

### JobRecord
```
@dataclass(slots=True)
Fields:
  job_id: str
  state: str                         # SUCCEEDED, FAILED, etc.
  stage: str
  source_path: str
  xp_path: str | None
  preview_paths: list[str]
  metadata: dict[str, Any]
  gate_report_path: str | None
  trace_path: str | None
Methods: to_dict()
```

### WorkbenchSession
```
@dataclass(slots=True)
Fields:
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
Methods: to_dict()
```

### BundleActionState
```
@dataclass(slots=True)
Fields:
  action_key: str
  session_id: str | None = None
  job_id: str | None = None
  source_path: str | None = None
  status: str = "empty"              # empty | converted
Methods: to_dict()
```

### BundleSession
```
@dataclass(slots=True)
Fields:
  bundle_id: str
  template_set_key: str
  actions: dict[str, BundleActionState]
  created_at: str = ""
  updated_at: str = ""
Methods: to_dict(), from_dict(cls, d)
```

### Standalone Function
- `parse_frames_csv(frames_raw, request_id, stage) -> list[int]` — Parse frames from CSV string, list, or int

**Total models: 7 dataclasses + 1 standalone function**

---

## 5. Configuration (config.py + template_registry.json)

### config.py Constants

| Config | Value | Purpose |
|--------|-------|---------|
| `ROOT` | `Path(__file__).resolve().parents[2]` | Project root directory |
| `DATA_DIR` | `ROOT / "data"` | All persistent data |
| `UPLOAD_DIR` | `DATA_DIR / "uploads"` | Uploaded PNGs |
| `JOBS_DIR` | `DATA_DIR / "jobs"` | Job record JSONs |
| `SESSIONS_DIR` | `DATA_DIR / "sessions"` | Workbench session JSONs |
| `EXPORT_DIR` | `DATA_DIR / "exports"` | Exported .xp files |
| `PREVIEWS_DIR` | `DATA_DIR / "previews"` | Preview PNGs |
| `GATES_DIR` | `DATA_DIR / "gates"` | Gate report JSONs |
| `TRACES_DIR` | `DATA_DIR / "traces"` | Pipeline trace JSONs |
| `BUNDLES_DIR` | `DATA_DIR / "bundles"` | Bundle session JSONs |
| `CONFIG_DIR` | `ROOT / "config"` | Configuration files |
| `SPRITES_DIR` | `ROOT / "sprites"` | Reference sprite XP files |
| `ENABLED_FAMILIES` | `{"player", "attack", "plydie"}` | Phase-gated families |

### service.py Constants

| Config | Value | Purpose |
|--------|-------|---------|
| `MAGENTA_BG` | `(255, 0, 255)` | Transparent background marker |
| `NATIVE_COLS` | `126` | Native player XP width |
| `NATIVE_ROWS` | `80` | Native player XP height |
| `NATIVE_ANGLES` | `8` | Required angle count for native compat |
| `NATIVE_CELL_H` | `10` | Rows per angle block |
| `_FAMILY_DIMS` | `{player: (126,80), attack: (144,80), plydie: (110,88)}` | Per-family native XP dimensions |
| `_FAMILY_L0_COL0` | `{player: ["8","1","8"], attack: ["8","8"], plydie: ["8","5"]}` | Expected L0 metadata glyphs per family |

### app.py Runtime Constants

| Config | Value | Purpose |
|--------|-------|---------|
| `WEB_DIR` | `ROOT / "web"` | HTML/JS/CSS source directory |
| `STATIC_WEB_ROOT` | `ROOT / "runtime/termpp-skin-lab-static"` | WASM runtime root |
| `STATIC_WEB_DIR` | `STATIC_WEB_ROOT / "termpp-web"` | TERM++ web build assets |
| `STATIC_FLAT_WEB_DIR` | `STATIC_WEB_ROOT / "termpp-web-flat"` | Flat map TERM++ build |
| `SERVER_BOOT_NONCE` | `str(int(time.time() * 1000))` | Cache-busting nonce |

### workbench_mcp_server.py Constants

| Config | Value | Purpose |
|--------|-------|---------|
| `WORKBENCH_URL` | env `WORKBENCH_URL` or `http://127.0.0.1:5071` | HTTP server base URL |
| `TIMEOUT` | env `MCP_HTTP_TIMEOUT` or `60` | HTTP request timeout seconds |

### rex_mcp/server.py Constants

| Config | Value | Purpose |
|--------|-------|---------|
| `REXPAINT_WINE_PATH` | env `WINE_PATH` or `/Applications/Wine Crossover.app/.../wine` | Wine binary path |
| `REXPAINT_EXE_PATH` | env `REXPAINT_EXE_PATH` or `~/Desktop/wine-11.0/REXPaint-v1.70/REXPaint.exe` | REXPaint executable |
| `WINE_PROCESS_NAME` | env `WINE_PROCESS_NAME` or `wine-preloader` | Process name for ps/AppleScript |
| `CLICLICK_PATH` | env `CLICLICK_PATH` or `/opt/homebrew/bin/cliclick` | macOS click automation tool |

### template_registry.json

Two template sets:

**`player_native_idle_only`** — "Player Skin (Idle Only)"
- idle: family=player, xp_dims=[126,80], angles=8, frames=[1,8], projs=2, cell_w=7, cell_h=10, layers=4, ahsw_range=all_16

**`player_native_full`** — "Player Skin (Full Bundle)"
- idle: family=player, xp_dims=[126,80], angles=8, frames=[1,8], projs=2, cell_w=7, cell_h=10, layers=4, ahsw_range=all_16
- attack: family=attack, xp_dims=[144,80], angles=8, frames=[8], projs=2, cell_w=9, cell_h=10, layers=4, ahsw_range=weapon_gte_1
- death: family=plydie, xp_dims=[110,88], angles=8, frames=[5], projs=2, cell_w=11, cell_h=11, layers=3, ahsw_range=all_16

Each action has `l0_ref` path and `l0_ref_sha256` checksum for reference XP validation.

---

## 6. File I/O Operations

### Files Written

| Operation | Path Pattern | Format | Source |
|-----------|-------------|--------|--------|
| Upload PNG | `data/uploads/<uuid>.png` | PNG | `upload_image()` |
| Job record | `data/jobs/<uuid>.json` | JSON | `run_pipeline()` |
| Session state | `data/sessions/<uuid>.json` | JSON | `workbench_load_from_job()`, `workbench_save_session()` |
| Exported XP | `data/exports/<job_id>.xp` | XP binary (gzip) | `run_pipeline()` |
| Exported session XP | `data/exports/session-<session_id>.xp` | XP binary (gzip) | `workbench_export_xp()` |
| Preview PNG | `data/previews/<job_id>.png` | PNG | `run_pipeline()` |
| Gate report | `data/gates/<job_id>.json` | JSON | `run_pipeline()` |
| Trace log | `data/traces/<job_id>.json` | JSON | `run_pipeline()` |
| Bundle state | `data/bundles/b-<uuid>.json` | JSON | `create_bundle()`, `save_bundle()` |
| Verification report | `output/workbench_verify/<session>-<profile>-<ts>.json` | JSON | `workbench_run_verification()` |
| Stream frame | `output/termpp_stream/<stream_id>/latest.png` | PNG | `_termpp_stream_worker()` |
| Sandbox runtime | `output/termpp_skin_runs/<run_id>/` | Symlinks + copies | `_stage_termpp_skin_sandbox()` |

### Files Read

| Operation | Path Pattern | Format | Source |
|-----------|-------------|--------|--------|
| Template registry | `config/template_registry.json` | JSON | `load_template_registry()` |
| L0 reference XPs | `sprites/player-0100.xp`, `sprites/attack-0001.xp`, `sprites/plydie-0000.xp` | XP binary | `_load_reference_l0()` |
| Job records | `data/jobs/<job_id>.json` | JSON | `status()` |
| Session state | `data/sessions/<session_id>.json` | JSON | Multiple workbench methods |
| Bundle state | `data/bundles/<bundle_id>.json` | JSON | `load_bundle()` |
| Exported XPs | `data/exports/*.xp` | XP binary | `workbench_web_skin_payload()`, `workbench_web_skin_bundle_payload()` |
| Source images | `data/uploads/*.png` | PNG | `run_pipeline()`, `analyze_image()` |
| Web HTML files | `web/*.html` | HTML | `_serve_web_html()` |
| Runtime assets | `runtime/termpp-skin-lab-static/...` | Various (wasm, js, data, a3d) | Static file serving |
| Legacy sprites | `<TERMPP_REPO_ROOT>/sprites/*.xp` | XP binary | `_stage_termpp_skin_sandbox()` |
| MCP config snippet | `rex_mcp/mcp_config_snippet.json` | JSON | `get_mcp_config()` |

### XP Tool File I/O (xp_mcp_server.py)

All 12 tools read/write .xp files at user-specified absolute paths via `XPFile.load()` / `XPFile.save()`. Additionally sends TCP reload notifications to `localhost:9877`.

### Rex Manager File I/O (rex_mcp/server.py)

Reads/writes .xp files at user-specified paths. Launches REXPaint via Wine subprocess. Uses `glob.glob()` to list .xp files. Sends keystrokes/clicks via `osascript` and `cliclick`.

---

## Summary Counts

| Category | Count |
|----------|-------|
| HTTP Endpoints (total) | 33 |
| HTTP API Endpoints | 24 |
| HTTP Static/UI Routes | 9 |
| MCP Tools (workbench-api) | 17 |
| MCP Tools (xp-tool) | 12 |
| MCP Tools (rex-manager) | 18 |
| **MCP Tools (total)** | **47** |
| Service Methods (public) | 25 |
| Service Methods (private) | 35 |
| **Service Methods (total)** | **60** |
| Data Models | 7 |
| Config Constants | ~30 |
| Template Sets | 2 |
| Template Actions | 4 (1 + 3) |
