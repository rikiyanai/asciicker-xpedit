# Base-Path Support Checklist

Date: 2026-03-22

This document defines what must change before the workbench can safely be hosted
under a URL prefix such as:

- `https://rikiworld.com/asciicker-XPEdit`

Current repo truth:

- root-path hosting works
- subdomain hosting works
- subpath hosting is **not** safe yet

This checklist is intentionally deployment-focused. It is not an XP-editor parity
contract.

## Goal

Make the existing Flask-served workbench function correctly when mounted under a
prefix instead of `/`.

Example target:

- base path: `/asciicker-XPEdit`
- workbench page: `/asciicker-XPEdit/workbench`
- API root: `/asciicker-XPEdit/api/workbench/*`

## Current blockers

The app still assumes root-hosting in several places:

- Flask HTML injection uses root-relative asset paths
- frontend fetches use `/api/workbench/*`
- runtime iframe/bootstrap paths use `/termpp-web*` and `/termpp-web-flat*`
- some scripts still default to `/workbench` under the host root
- redirects and static routes are mounted at `/`, not under a configurable prefix

## Required changes

### 1. Canonical base-path config

Add one canonical server/frontend setting, for example:

- `PIPELINE_BASE_PATH=/asciicker-XPEdit`

Rules:

- empty / unset means root-hosted
- non-empty means all generated URLs and frontend requests must be prefixed

### 2. Flask route and redirect awareness

Update the Flask app so all generated links and redirects can honor the base path:

- `/` redirect behavior
- `/workbench`
- `/wizard`
- `/termpp-web`
- `/termpp-web-flat`
- `/api/workbench/*`

Acceptable approaches:

- true prefixed route registration in Flask
- reverse-proxy prefix stripping with explicit Flask awareness of the external prefix

Not acceptable:

- “works only because the proxy rewrites some routes”

### 3. HTML asset injection

Update HTML serving so these are prefixed correctly:

- `styles.css`
- `workbench.js`
- `wizard.js`
- `whole-sheet-init.js`
- REXPaint editor CSS

Current root-relative injection in `src/pipeline_v2/app.py` must become base-path aware.

### 4. Frontend fetch path prefixing

All frontend fetches and generated URLs must go through one canonical helper, not ad hoc root-relative strings.

Targets include:

- `/api/workbench/*`
- download links
- stream frame URLs
- verification/runtime endpoints
- classic skin payload and bundle skin payload routes

### 5. Runtime iframe/bootstrap path prefixing

The most fragile subpath area is the term++ runtime embed path.

Must verify:

- `/termpp-web/*`
- `/termpp-web-flat/*`
- flat-map bootstrap JS
- iframe source generation
- runtime map/data/wasm fetches

This is a hard blocker for `/asciicker-XPEdit`.

### 6. Script/test base URL normalization

All scripts that interact with the workbench must accept the prefixed workbench URL cleanly.

Expected pattern:

- `WORKBENCH_URL=https://host/asciicker-XPEdit/workbench`

This work is partly done, but subpath should be re-verified after app changes.

### 7. Reverse proxy examples for subpath mode

If subpath hosting is required, committed deploy examples must include:

- Caddy subpath example
- Nginx subpath example
- explicit note about prefix stripping vs upstream awareness

### 8. Acceptance checks

Subpath support is complete only when all of the following are true:

- `/asciicker-XPEdit/workbench` loads with 200
- CSS and JS assets load under the prefix
- create/save/export flows still work
- Skin Dock/runtime iframe still loads correctly
- no root-relative fetches remain in the browser console/network log

## MVP posture

For the first MVP:

- subpath hosting is optional work, not a launch prerequisite
- verifier scripts are **not** required on the deployed host for manual MVP operation
- the deployed product only needs the Milestone 1 user-facing functions working end-to-end

So the recommended order is:

1. launch on a subdomain or reverse-proxied root path first
2. add base-path support later if `rikiworld.com/asciicker-XPEdit` is still desired

## Implementation plan

See `docs/plans/2026-03-22-base-path-support-plan.md` for the full phased
implementation plan covering config model, Flask Blueprint routing, frontend
`bp()` helper, runtime iframe audit, reverse proxy templates, and acceptance
criteria.
