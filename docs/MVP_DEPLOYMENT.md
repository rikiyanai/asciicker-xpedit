# MVP Deployment Posture

Date: 2026-03-21

This is the canonical deployment truth for the asciicker-pipeline-v2 workbench MVP.
Do not make deployment decisions based on assumptions that contradict this document.

## Architecture

The MVP is a **server-backed Flask application**, not a static site.

- Backend: Flask (Python 3.11+), serving API routes under `/api/*` and static assets
- Frontend: vanilla JS/HTML/CSS served by Flask from `web/` and `runtime/`
- Runtime payload: committed WASM/JS/data bundle under `runtime/termpp-skin-lab-static/`
- No separate build step for frontend assets; they are served as-is

## What is deployable

The deployable unit is:

1. The Python package (`src/pipeline_v2/`)
2. The `web/` directory (frontend assets)
3. The `runtime/termpp-skin-lab-static/` directory (WASM runtime payload)
4. The `wsgi.py` entrypoint at repo root

All four must be co-located or accessible to the server process.

## How to run in production

```sh
# Install dependencies
pip install -e .

# Run with gunicorn (recommended)
gunicorn wsgi:app --bind 0.0.0.0:5071

# Or with waitress
waitress-serve --listen=0.0.0.0:5071 wsgi:app

# Or directly (development-style, env-configurable)
PIPELINE_HOST=0.0.0.0 PIPELINE_PORT=5071 PYTHONPATH=src python3 -m pipeline_v2.app
```

Environment variables: `PIPELINE_HOST` (default `127.0.0.1`), `PIPELINE_PORT` (default `5071`), `PIPELINE_DEBUG` (default off).

## Hosting constraints

### Subpath hosting is NOT safe

The frontend uses root-relative paths for assets and API calls (e.g., `/api/workbench/*`, `/styles.css`, `/workbench.js`). Hosting under a subpath like `rikiworld.com/XPEdit` will break all fetch paths and asset loads without explicit base-path rewriting in both frontend and backend.

### Recommended deployment shape

- **Subdomain** (e.g., `xpedit.rikiworld.com`) — cleanest option, no path rewriting needed
- **Reverse-proxied root path** (e.g., nginx proxying `/` to the Flask app) — also works without changes
- Subpath hosting requires future work: base-path env var, frontend path prefix injection, Flask URL prefix

See `docs/BASE_PATH_SUPPORT_CHECKLIST.md` for the exact work required before a path like
`rikiworld.com/asciicker-XPEdit` becomes safe.

### What GitHub Pages cannot do

GitHub Pages serves static files only. This MVP requires:
- Python API endpoints (`/api/*`)
- Server-side session management
- Dynamic XP file processing

GitHub Pages is not a deployment target for this product.

## CI status

GitHub Actions CI exists (`.github/workflows/ci.yml`) and runs on push to `master` and PRs:

- Python compile checks on all server modules
- `pytest` (excluding browser e2e tests)
- Semantic map validation
- JS syntax checks on critical frontend files

**Note:** The first CI run is expected to fail on pre-existing Python test failures in `test_analyze_run_compat` and `test_contracts`. This is intentional — CI exists to expose current truth, not to pretend the repo is green. These test failures predate the CI workflow and are unrelated to deployment readiness.

## Deployment configs

Template configs for reverse proxy and process management are in `deploy/`:

| File | Purpose |
|------|---------|
| `deploy/.env.example` | Template env config (copy to `.env`) |
| `deploy/Caddyfile` | Caddy reverse proxy |
| `deploy/nginx.conf` | Nginx reverse proxy |
| `deploy/systemd/asciicker-xpedit.service` | Systemd service unit |
| `scripts/deploy/launch_prod.sh` | Env-driven launch script |
| `deploy/README.md` | Setup instructions |

See `deploy/README.md` for quick start.

## CD scaffold

A manual-trigger GitHub Actions workflow exists (`.github/workflows/deploy-package.yml`).
It builds, tests, packages, and uploads an artifact — but does **not** deploy to any host.

Live CD can be added later once:
1. A hosting target is chosen
2. Pre-existing test failures are resolved or triaged
3. The deployment shape (subdomain vs. reverse proxy) is decided

## Manual MVP note

For the first MVP launch:

- the deployed host does **not** need the verifier scripts to function
- the host only needs the shipped Milestone 1 user-facing workflow working end-to-end
- verifier scripts remain offline QA / development tools, not production runtime dependencies
- the shipped UI should include a visible pre-alpha bug-report path so early users can submit structured issues without relying on developer-only tooling

That means a manual MVP launch can proceed once:

- Milestone 1 functions are working in full
- manual runtime review is complete
- the server-backed deployment checklist is satisfied

## Runtime payload

The `runtime/termpp-skin-lab-static/` directory contains the compiled WASM runtime and must remain committed in this repo. Do not:
- Add it to `.gitignore`
- Replace it with an external download step
- Depend on external folders for runtime assets

This is enforced by `scripts/self_containment_audit.py`.
