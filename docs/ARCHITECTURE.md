# Architecture (MVP)

## Modules

- `pipeline_v2.app`
  - Flask app factory and routes
- `pipeline_v2.models`
  - RunConfig validation, error model, DTOs
- `pipeline_v2.service`
  - Business logic for upload/analyze/run/workbench
- `pipeline_v2.xp_codec`
  - XP binary read/write
- `pipeline_v2.renderer`
  - Preview PNG generation
- `pipeline_v2.gates`
  - G7/G8/G9 verdict functions
- `pipeline_v2.storage`
  - JSON persistence

## Data persisted in `data/`

- `uploads/` raw uploaded PNG
- `jobs/` run records
- `exports/` XP outputs
- `previews/` preview PNG
- `gates/` gate JSON
- `traces/` run trace JSON
- `sessions/` workbench session JSON

## Invariants

- run success requires non-empty XP file path.
- workbench load success requires populated_cells > 0.
- export success requires checksum and file exists.
- endpoints never return bare stack traces.
