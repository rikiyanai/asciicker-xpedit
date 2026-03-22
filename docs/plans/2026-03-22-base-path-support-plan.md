# Base-Path Support Implementation Plan

**Goal:** Make the Flask-served workbench function correctly when mounted under a URL prefix (e.g., `https://rikiworld.com/asciicker-XPEdit`) instead of at the domain root.

**Architecture:** A single canonical env var (`PIPELINE_BASE_PATH`) controls path prefixing. The server injects the base path into HTML via a global JS variable. All frontend fetches and asset URLs flow through a tiny helper that prepends the base path. Flask routes are mounted under a Blueprint with `url_prefix`. The runtime iframe src is prefixed server-side; internal iframe fetches (WASM, maps) remain relative and require no changes.

**Tech Stack:** Python/Flask (backend), vanilla JS (frontend), Caddy/Nginx (reverse proxy)

---

## 1. Configuration Model

### Canonical variable

| Property | Value |
|----------|-------|
| Name | `PIPELINE_BASE_PATH` |
| Source | Environment variable (read in `src/pipeline_v2/config.py`) |
| Default | `""` (empty string = root-hosted, current behavior) |

### Normalization rules

```python
def normalize_base_path(raw: str) -> str:
    """Normalize PIPELINE_BASE_PATH.

    Rules:
    - Empty / unset / "/" → "" (root-hosted)
    - Non-empty → ensure leading slash, strip trailing slash
    - Example: "asciicker-XPEdit" → "/asciicker-XPEdit"
    - Example: "/asciicker-XPEdit/" → "/asciicker-XPEdit"
    - Only one path segment is supported (no nested prefixes)
    """
    s = raw.strip().strip("/")
    if not s:
        return ""
    return "/" + s
```

### Behavior modes

| `PIPELINE_BASE_PATH` | Behavior |
|----------------------|----------|
| `""` (default) | Root-hosted. All routes at `/`. Current behavior, zero changes. |
| `"/asciicker-XPEdit"` | Prefixed. All routes under `/asciicker-XPEdit/*`. |

### Where it is read

| Layer | Location | How |
|-------|----------|-----|
| Server config | `src/pipeline_v2/config.py` | `os.environ.get("PIPELINE_BASE_PATH", "")` → `normalize_base_path()` → module-level `BASE_PATH` |
| Server routing | `src/pipeline_v2/app.py` | `from .config import BASE_PATH` — used for Blueprint prefix and HTML injection |
| Frontend | `window.__WB_BASE_PATH` | Injected into `<head>` by `_serve_web_html()` alongside the existing boot nonce script |
| Deploy env | `deploy/.env.example` | New line: `PIPELINE_BASE_PATH=` |

---

## 2. Backend Routing and HTML Injection

### Current state audit (`src/pipeline_v2/app.py`)

Every route currently assumes root mounting. The complete inventory:

#### Page routes (6)

| Route | Function | Base-path impact |
|-------|----------|-----------------|
| `GET /` | `index_page` | Redirect target must become `{BASE_PATH}/workbench` |
| `GET /workbench` | `workbench_page` | Must be `{BASE_PATH}/workbench` |
| `GET /wizard` | `wizard_page` | Must be `{BASE_PATH}/wizard` |
| `GET /termpp-skin-lab` | `termpp_skin_lab_page` | Must be `{BASE_PATH}/termpp-skin-lab` |
| `GET /healthz` | `healthz` | Must be `{BASE_PATH}/healthz` |
| `GET /<path:filename>` | `web_assets` | Catch-all for `web/` dir assets — must be under prefix |

#### Runtime static routes (4)

| Route | Function | Base-path impact |
|-------|----------|-----------------|
| `GET /termpp-web` | `termpp_web_index_alias` | Must be `{BASE_PATH}/termpp-web` |
| `GET /termpp-web/<path>` | `termpp_web_assets` | Must be `{BASE_PATH}/termpp-web/<path>` |
| `GET /termpp-web-flat` | `termpp_web_flat_index_alias` | Must be `{BASE_PATH}/termpp-web-flat` |
| `GET /termpp-web-flat/<path>` | `termpp_web_flat_assets` | Must be `{BASE_PATH}/termpp-web-flat/<path>` |

#### API routes (24)

All `/api/*` routes (upload, analyze, run, status, workbench CRUD, bundle, stream, verification, skin payload, download, templates, runtime-preflight, export-bundle, action-grid/apply, bundle/action-status, bundle/create) must be under `{BASE_PATH}/api/*`.

#### Redirect (1)

| Current | Must become |
|---------|------------|
| `redirect("/workbench", code=302)` | `redirect(f"{BASE_PATH}/workbench", code=302)` |

### Implementation approach: Flask Blueprint with `url_prefix`

**Why Blueprint, not `APPLICATION_ROOT`:** Flask's `APPLICATION_ROOT` only affects cookie paths and `url_for()` — it does not actually mount routes under a prefix. A Blueprint with `url_prefix=BASE_PATH` is the correct mechanism.

**How:**

1. In `create_app()`, move ALL route registrations into a `Blueprint("main", __name__)` with `url_prefix=BASE_PATH`.
2. Register the blueprint on the app: `app.register_blueprint(bp)`.
3. The `create_app()` function itself stays the same; the `app` object is still a `Flask()` instance.
4. The `/<path:filename>` catch-all for `web/` assets becomes a route on the blueprint and automatically gets the prefix.

This means:
- When `BASE_PATH=""`: routes are `GET /workbench`, `GET /api/workbench/*`, etc. (identical to today)
- When `BASE_PATH="/asciicker-XPEdit"`: routes are `GET /asciicker-XPEdit/workbench`, `GET /asciicker-XPEdit/api/workbench/*`, etc.

**Root-route ownership under subpath hosting:**

Blueprint `url_prefix=BASE_PATH` solves the prefixed app surface. It does NOT
define what bare `GET /` should do. Under subpath hosting, bare `/` is outside
the app's prefix — another site or app owns the domain root. The implementation
must choose one of:

1. **Bare `/` is out of scope** — the reverse proxy handles it (another site,
   a landing page, a 404). The Flask app does not register any route outside
   the blueprint. This is the expected case for `rikiworld.com/asciicker-XPEdit`.
2. **Flask keeps a root redirect** — a separate non-blueprint route at `GET /`
   redirects to `{BASE_PATH}/workbench`. Only appropriate when the Flask app
   owns the entire domain (in which case, subdomain hosting is simpler).

When `BASE_PATH=""`, the current `GET /` → redirect `/workbench` behavior
lives inside the blueprint at prefix `""` and works unchanged.

### HTML injection changes (`_serve_web_html`)

Current `_serve_web_html()` does string replacement on hardcoded root-relative paths. With base-path support:

1. **Inject `window.__WB_BASE_PATH`** into `<head>` alongside the existing boot nonce:
   ```python
   base_path_script = f'<script>window.__WB_BASE_PATH = "{BASE_PATH}";</script>'
   ```

2. **Prefix asset paths** in the string replacements:
   ```python
   # Current:
   html = html.replace('href="/styles.css"', f'href="{_v("/styles.css")}"')
   # Becomes:
   html = html.replace('href="/styles.css"', f'href="{_v(BASE_PATH + "/styles.css")}"')
   ```
   Same for `workbench.js`, `wizard.js`, `termpp_skin_lab.js`.

3. **HTML link tags in the raw HTML** (`workbench.html` lines 8, 425-426):
   - `<link rel="stylesheet" href="/rexpaint-editor/styles.css">` — must also be rewritten by `_serve_web_html()`.
   - `<script src="/workbench.js">` and `<script type="module" src="/whole-sheet-init.js">` — already handled by string replacement.
   - Add replacement for `/rexpaint-editor/styles.css`.

4. **Wizard HTML** (`wizard.html` line 13):
   - `<a href="/workbench">` — must be rewritten to `{BASE_PATH}/workbench`.
   - Add this replacement to `_serve_web_html()`.

### `_v()` helper update

The `_v()` helper appends a cache-bust parameter. It takes a path string. No change needed to `_v()` itself — the caller just passes `BASE_PATH + "/styles.css"` instead of `"/styles.css"`.

---

## 3. Frontend Path Handling

### Canonical frontend URL helper

Add a single helper at the top of `workbench.js` (and re-export or duplicate in `wizard.js`):

```javascript
const BASE_PATH = String(window.__WB_BASE_PATH || "");

function bp(path) {
  // Prepend base path to a root-relative path.
  // bp("/api/workbench/templates") → "/asciicker-XPEdit/api/workbench/templates"
  // When BASE_PATH is empty, bp("/foo") → "/foo" (no change).
  return BASE_PATH + path;
}
```

### Path classes that must be prefixed

All paths below currently appear as string literals starting with `/`. Each must be wrapped in `bp()`.

#### Class 1: API fetch URLs (27 call sites in workbench.js, 3 in wizard.js)

| File | Line(s) | Current path |
|------|---------|-------------|
| `workbench.js` | 539 | `/api/workbench/runtime-preflight` |
| `workbench.js` | 1194-1195 | `/api/workbench/web-skin-bundle-payload`, `/api/workbench/web-skin-payload` |
| `workbench.js` | 1449 | `/api/workbench/termpp-stream/status/${id}` |
| `workbench.js` | 1500, 1523 | `/api/workbench/termpp-stream/start` |
| `workbench.js` | 1545 | `/api/workbench/termpp-stream/stop` |
| `workbench.js` | 1569 | `/api/workbench/termpp-skin-command` |
| `workbench.js` | 1594 | `/api/workbench/open-termpp-skin` |
| `workbench.js` | 1634 | `/api/workbench/run-verification` |
| `workbench.js` | 1666 | `/api/workbench/xp-tool-command` |
| `workbench.js` | 1688 | `/api/workbench/open-in-xp-tool` |
| `workbench.js` | 3562 | `/api/workbench/save-session` |
| `workbench.js` | 3708 | `/api/workbench/load-from-job` |
| `workbench.js` | 3740 | `/api/workbench/load-session` |
| `workbench.js` | 3782 | `/api/workbench/upload-xp` |
| `workbench.js` | 3842 | `/api/workbench/export-xp` |
| `workbench.js` | 5984 | `/api/upload` |
| `workbench.js` | 5999 | `/api/analyze` |
| `workbench.js` | 6030 | `/api/workbench/templates` |
| `workbench.js` | 6116 | `/api/workbench/bundle/action-status` |
| `workbench.js` | 6242 | `/api/workbench/create-blank-session` |
| `workbench.js` | 6332 | `/api/workbench/bundle/create` |
| `workbench.js` | 6371 | `/api/workbench/action-grid/apply` |
| `workbench.js` | 6418 | `/api/run` |
| `wizard.js` | 22 | `/api/upload` |
| `wizard.js` | 32 | `/api/analyze` |
| `wizard.js` | 66 | `/api/run` |

**Transform:** `fetch("/api/...")` → `fetch(bp("/api/..."))`

#### Class 2: Download / stream frame URLs (2 sites)

| File | Line | Current |
|------|------|---------|
| `workbench.js` | 3870 | `a.href = \`/api/workbench/download-xp?xp_path=...\`` |
| `workbench.js` | 1443 | `img.src = \`/api/workbench/termpp-stream/frame/${id}?t=...\`` |

**Transform:** Prepend `bp()` to the template literal.

#### Class 3: Iframe / runtime source URLs (2 sites)

| File | Line | Current |
|------|------|---------|
| `workbench.js` | 53 | `new URL("/termpp-web-flat/index.html?solo=1&player=player", window.location.origin)` |
| `workbench.js` | 627 | `"/termpp-web-flat/index.html?solo=1&player=player"` (fallback) |

**Transform:** `new URL(bp("/termpp-web-flat/index.html?..."), window.location.origin)` and `bp("/termpp-web-flat/...")` for the fallback.

#### Class 4: Font / asset URLs (1 site)

| File | Line | Current |
|------|------|---------|
| `whole-sheet-init.js` | 21 | `const FONT_URL = '/termpp-web-flat/fonts/cp437_12x12.png'` |

**Transform:** `const FONT_URL = bp('/termpp-web-flat/fonts/cp437_12x12.png')`. This requires `bp()` to be available in `whole-sheet-init.js`. Since it's an ES module, read `window.__WB_BASE_PATH` directly:
```javascript
const BASE_PATH = String(window.__WB_BASE_PATH || "");
function bp(path) { return BASE_PATH + path; }
const FONT_URL = bp('/termpp-web-flat/fonts/cp437_12x12.png');
```

#### Class 5: Page navigation URLs (1 site)

| File | Line | Current |
|------|------|---------|
| `wizard.js` | 91 | `new URL("/workbench", window.location.origin)` |

**Transform:** `new URL(bp("/workbench"), window.location.origin)`

#### Class 6: HTML-embedded paths (handled server-side)

These are in the raw `.html` files and are rewritten by `_serve_web_html()`:

| File | Line | Current |
|------|------|---------|
| `workbench.html` | 7 | `href="/styles.css"` |
| `workbench.html` | 8 | `href="/rexpaint-editor/styles.css"` |
| `workbench.html` | 425 | `src="/workbench.js"` |
| `workbench.html` | 426 | `src="/whole-sheet-init.js"` |
| `wizard.html` | 7 | `href="/styles.css"` |
| `wizard.html` | 13 | `href="/workbench"` |
| `wizard.html` | 48 | `src="/wizard.js"` |

**Transform:** All handled by expanded `_serve_web_html()` replacements (Section 2).

### ES module import paths

The `whole-sheet-init.js` ES module imports use relative paths (`./rexpaint-editor/canvas.js`). These resolve relative to the module's own URL, which will already be under the prefix. **No changes needed for ES module imports.**

---

## 4. Runtime Iframe / Termpp Flat Path Risks

### Risk analysis

The runtime iframe loads `/termpp-web-flat/index.html` with query params. Once loaded, the iframe's internal fetches are:

| What | Path | Type | Risk |
|------|------|------|------|
| WASM binary | `index.wasm` | Relative to iframe HTML | **Safe** — relative path, no change needed |
| Data bundle | `index.data` | Relative to iframe HTML | **Safe** — relative path |
| JS loader | `index.js` | Relative to iframe HTML | **Safe** — relative path |
| Bootstrap | `flat_map_bootstrap.js` | Referenced in `index.html` | **Must verify** — check if `<script src>` is relative or absolute |
| Map files | `flatmaps/<name>.a3d` | Relative fetch in bootstrap | **Safe** — `MAP_DIR + "/" + mapName` = `"flatmaps/name.a3d"` (relative) |
| Font assets | `fonts/cp437_*.png` | Relative to iframe HTML | **Safe** — served from same dir |

### The critical path

The iframe `src` must be prefixed: `{BASE_PATH}/termpp-web-flat/index.html?...`. Once the browser loads the iframe at that URL, all **relative** fetches inside the iframe resolve against `{BASE_PATH}/termpp-web-flat/`, which Flask's blueprint routes will serve correctly.

### What must be verified under a prefix

1. **iframe src generation** (workbench.js:53, 627) — must include base path
2. **index.html inside termpp-web-flat** — must reference `flat_map_bootstrap.js` as a relative path (not `/flat_map_bootstrap.js`). **AUDIT REQUIRED:** read `runtime/termpp-skin-lab-static/termpp-web-flat/index.html` to confirm.
3. **Emscripten locateFile** — Emscripten's module loader resolves `.wasm` and `.data` relative to the HTML page by default. If a custom `locateFile` is configured with absolute paths, it would break. **AUDIT REQUIRED:** check `index.js` in the runtime bundle.
4. **Font URL in whole-sheet-init.js** — already covered in Section 3, Class 4.
5. **Map fetch in flat_map_bootstrap.js** — already uses relative path `flatmaps/name.a3d`. **Safe.**

### Post-injection path safety

After the iframe loads, `workbench.js` injects XP bytes via the `window.Module.FS` API (Emscripten virtual filesystem). These are internal WASM FS paths like `/a3d/game_map_y8.a3d` and `/sprites/player-0100.xp`. **These are WASM-internal absolute paths, not HTTP paths.** They are completely unaffected by the base path. **Safe.**

### Explicit test requirements for runtime under prefix

- [ ] iframe loads at `{BASE_PATH}/termpp-web-flat/index.html?solo=1&player=player`
- [ ] WASM runtime initializes (no 404s for `.wasm`, `.data`, `.js`)
- [ ] flat_map_bootstrap.js loads and fetches map (no 404 for `flatmaps/*.a3d`)
- [ ] Skin injection works (XP bytes reach WASM FS)
- [ ] Player spawns and moves in the arena
- [ ] Font atlas loads for whole-sheet editor (no 404 for fonts)

---

## 5. Reverse Proxy Strategy

### Three deployment shapes

#### Shape A: Subdomain / root path (current recommended)

```
xpedit.rikiworld.com → Flask on 127.0.0.1:5071
PIPELINE_BASE_PATH="" (empty, root-hosted)
```

No base-path changes needed. This is the safest launch shape.

#### Shape B: Subpath with prefix stripping (NOT recommended)

```
rikiworld.com/asciicker-XPEdit/* → proxy strips prefix → Flask sees /*
PIPELINE_BASE_PATH="" (app thinks it's root-hosted)
```

**Why not:** The app generates URLs for downloads, redirects, and injected asset paths. If the proxy strips the prefix but the app doesn't know about it, generated URLs like `/api/workbench/download-xp` will be wrong — they'll miss the `/asciicker-XPEdit` prefix. The browser will request the wrong path. This is the "works only because the proxy rewrites some routes" failure mode explicitly forbidden in `BASE_PATH_SUPPORT_CHECKLIST.md`.

#### Shape C: Subpath with upstream awareness (RECOMMENDED durable solution)

```
rikiworld.com/asciicker-XPEdit/* → proxy passes through → Flask sees /asciicker-XPEdit/*
PIPELINE_BASE_PATH="/asciicker-XPEdit"
```

The app knows its own prefix. All generated URLs include the prefix. The proxy just forwards. No path rewriting needed.

### Caddy example (Shape C)

```caddyfile
rikiworld.com {
    handle_path /asciicker-XPEdit/* {
        reverse_proxy 127.0.0.1:5071
    }
    # Other site routes...
}
```

**Wait — `handle_path` strips the prefix.** For Shape C, use `handle` instead:

```caddyfile
rikiworld.com {
    handle /asciicker-XPEdit/* {
        reverse_proxy 127.0.0.1:5071
    }
}
```

This passes `/asciicker-XPEdit/workbench` through to Flask, which has routes registered under `/asciicker-XPEdit/*` via the Blueprint.

### Nginx example (Shape C)

```nginx
server {
    server_name rikiworld.com;

    location /asciicker-XPEdit/ {
        proxy_pass http://127.0.0.1:5071/asciicker-XPEdit/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note: `proxy_pass` with a trailing path means Nginx passes the full URI including the prefix. The Flask app handles it because routes are mounted under the prefix.

### Deploy config deliverable

Add new template files:
- `deploy/Caddyfile.subpath` — Shape C Caddy config
- `deploy/nginx-subpath.conf` — Shape C Nginx config

Or extend the existing templates with commented-out subpath sections.

---

## 6. Script / Test Implications

### Scripts that accept `--url` or `WORKBENCH_URL`

All of these already support full URL configuration and should work with subpath hosting by passing the full prefixed URL:

| Script | Default URL | What to pass for subpath |
|--------|------------|------------------------|
| `scripts/workbench_png_to_skin_test_playwright.mjs` | `http://127.0.0.1:5071/workbench` | `http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/ralph.sh` | `http://127.0.0.1:5071/workbench` | `RALPH_URL=http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/debug_workbench_skin_dock_playwright.mjs` | `http://127.0.0.1:5071/workbench` | `--url http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/workbench_bundle_manual_watchdog.mjs` | `http://127.0.0.1:5071/workbench` | `--url http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/xp_fidelity_test/run_fidelity_test.mjs` | `http://127.0.0.1:5071/workbench` | `--url http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs` | `http://127.0.0.1:5071/workbench` | `--url http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/ui_tests/runner/cli.mjs` | `http://127.0.0.1:5071/workbench` | `--base-url http://127.0.0.1:5071/asciicker-XPEdit/workbench` |
| `scripts/workbench_mcp_server.py` | `http://127.0.0.1:5071` | `WORKBENCH_URL=http://127.0.0.1:5071/asciicker-XPEdit` |

### Scripts that construct internal paths from the base URL

Check these after implementation:

| Script | Concern |
|--------|---------|
| `scripts/ui_tests/core/server_control.mjs` (line 6) | Extracts origin from `WORKBENCH_URL` — must handle `/asciicker-XPEdit/workbench` correctly |
| `scripts/ui_tests/subagents/workbench_agents.mjs` (line 97) | Constructs `new URL('/workbench', baseUrl)` — will produce wrong path if baseUrl includes prefix. Must construct from the baseUrl correctly. |

### Re-validation checklist after base-path implementation

- [ ] `ralph.sh` with `RALPH_URL` set to prefixed URL — skin test passes
- [ ] `workbench_png_to_skin_test_playwright.mjs` with `--url` set to prefixed URL — full flow passes
- [ ] `run_bundle_fidelity_test.mjs` with `--url` set to prefixed URL — bundle fidelity passes
- [ ] `ui_tests/runner/cli.mjs` with `--base-url` set to prefixed URL — UI tests pass
- [ ] MCP server with `WORKBENCH_URL` set to prefixed URL — commands succeed

### What NOT to do

- Do not change the default `WORKBENCH_URL` values in scripts. They should stay as `http://127.0.0.1:5071/workbench` for local dev.
- Do not redesign verifier infrastructure. Just verify existing scripts accept the prefixed URL correctly.

---

## 7. Acceptance Criteria

Subpath support is complete only when **all** of the following pass with `PIPELINE_BASE_PATH="/asciicker-XPEdit"`:

### Page loads

- [ ] `GET /asciicker-XPEdit/workbench` returns 200 with correct HTML
- [ ] `GET /asciicker-XPEdit/wizard` returns 200 with correct HTML
- [ ] `GET /asciicker-XPEdit/healthz` returns 200 `ok`
- [ ] `GET /asciicker-XPEdit/` redirects to `/asciicker-XPEdit/workbench`
- [ ] `GET /asciicker-XPEdit/styles.css` returns 200
- [ ] `GET /asciicker-XPEdit/rexpaint-editor/styles.css` returns 200

### Asset loading

- [ ] `workbench.js` loads at `/asciicker-XPEdit/workbench.js`
- [ ] `whole-sheet-init.js` loads at `/asciicker-XPEdit/whole-sheet-init.js`
- [ ] All ES module imports resolve correctly (relative paths)
- [ ] Font atlas loads at `/asciicker-XPEdit/termpp-web-flat/fonts/cp437_12x12.png`

### API calls

- [ ] `POST /asciicker-XPEdit/api/workbench/templates` returns templates JSON
- [ ] `GET /asciicker-XPEdit/api/workbench/runtime-preflight` returns preflight JSON
- [ ] `POST /asciicker-XPEdit/api/workbench/bundle/create` creates a bundle
- [ ] `POST /asciicker-XPEdit/api/workbench/save-session` saves session state
- [ ] `POST /asciicker-XPEdit/api/workbench/export-xp` exports XP
- [ ] `GET /asciicker-XPEdit/api/workbench/download-xp?xp_path=...` downloads XP file

### Save / export / test flows

- [ ] Create bundle → fill actions → save → export → download: all API calls use prefix
- [ ] XP import roundtrip: upload → export → re-upload → cell match
- [ ] Bundle test skin flow: export → payload → inject → runtime loads

### Runtime iframe

- [ ] iframe src is `{BASE_PATH}/termpp-web-flat/index.html?solo=1&player=player&...`
- [ ] iframe loads without 404s (WASM, data, JS, bootstrap)
- [ ] flat map loads inside iframe (relative `flatmaps/` fetch succeeds)
- [ ] Skin injection works through the iframe

### Network log verification

- [ ] Open browser DevTools Network tab with `PIPELINE_BASE_PATH="/asciicker-XPEdit"`
- [ ] Perform full workflow: page load → create bundle → edit → save → export → test skin
- [ ] Filter network log for requests NOT starting with `/asciicker-XPEdit/`
- [ ] **Zero** requests should go to root-relative paths (no `/api/...`, no `/styles.css`, no `/termpp-web-flat/...`)
- [ ] Exception: browser-initiated requests like `favicon.ico` are acceptable

### Reverse proxy pass-through

- [ ] Full workflow works through Caddy or Nginx using subpath template config
- [ ] `redirect()` at `GET {BASE_PATH}/` produces correct external URL (scheme, host, prefix) — confirms ProxyFix
- [ ] Health probe through proxy: `GET https://<domain>{BASE_PATH}/healthz` returns `ok`

### Root-hosted regression

- [ ] With `PIPELINE_BASE_PATH=""` (default), all existing behavior is unchanged
- [ ] CI passes with no base-path set

---

## 8. Execution Phases

### Phase 1: Config and server plumbing

**Scope:** Add `PIPELINE_BASE_PATH` to config, create Blueprint, move all routes into it. Add `ProxyFix` middleware for correct scheme/host behind reverse proxy.

**Files likely touched:**
- `src/pipeline_v2/config.py` — add `BASE_PATH` with normalization
- `src/pipeline_v2/app.py` — refactor `create_app()` to use Blueprint with `url_prefix=BASE_PATH`; add `ProxyFix` wrapper
- `deploy/.env.example` — add `PIPELINE_BASE_PATH=` line

**ProxyFix requirement:**
Flask behind a reverse proxy needs `werkzeug.middleware.proxy_fix.ProxyFix` to
trust `X-Forwarded-*` headers. Without it, `redirect()` generates
`http://127.0.0.1:5071/...` instead of `https://rikiworld.com/...`. Add in
`create_app()`:
```python
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
```
This is correct for both root-hosted and subpath deployments. Safe to add
unconditionally — no-op when not behind a proxy.

**Risks:**
- Blueprint refactor could break route ordering. The catch-all `/<path:filename>` must be registered last on the blueprint.
- `@app.errorhandler(500)` stays on the app, not the blueprint.

**Verification:**
- `PIPELINE_BASE_PATH="" python3 -m pipeline_v2.app` — all routes work at root (regression)
- `PIPELINE_BASE_PATH="/test" python3 -m pipeline_v2.app` — `curl localhost:5071/test/healthz` returns `ok`
- `curl localhost:5071/test/workbench` returns HTML (even if assets are broken at this point)

**Rollback:** Revert the Blueprint refactor. No frontend changes yet.

**Commit:** `feat: add PIPELINE_BASE_PATH config and Blueprint routing`

### Phase 2: HTML injection prefixing

**Scope:** Update `_serve_web_html()` to inject `window.__WB_BASE_PATH` and prefix all asset paths in HTML.

**Files likely touched:**
- `src/pipeline_v2/app.py` — `_serve_web_html()` changes, add `_bp()` helper for path prefixing
- `web/workbench.html` — no changes (paths are rewritten at serve time)
- `web/wizard.html` — no changes (paths are rewritten at serve time)

**Risks:**
- String replacement order matters. Replacing `/styles.css` must not collide with `/rexpaint-editor/styles.css`. Use specific match strings (`href="/styles.css"` vs `href="/rexpaint-editor/styles.css"`).
- Missing a replacement means a 404 on page load — obvious and catchable.

**Verification:**
- `PIPELINE_BASE_PATH="/test"` → view source of `/test/workbench` → all `href` and `src` attributes start with `/test/`
- `window.__WB_BASE_PATH` equals `"/test"` in browser console
- CSS and JS files load (network tab shows 200s)

**Rollback:** Revert `_serve_web_html()` changes only. Phase 1 stays.

**Commit:** `feat: base-path-aware HTML asset injection`

### Phase 3: Frontend `bp()` helper and API fetch prefixing

**Scope:** Add `bp()` helper to `workbench.js` and `wizard.js`. Update all `fetch()` calls and URL constructions.

**Files likely touched:**
- `web/workbench.js` — add `bp()`, update ~30 fetch calls, update iframe src, update download/stream URLs
- `web/wizard.js` — add `bp()`, update 3 fetch calls, update navigation URL
- `web/whole-sheet-init.js` — add local `bp()`, update `FONT_URL`

**Risks:**
- Missing a single `fetch()` call means that feature silently breaks. The audit in Section 3 is exhaustive but grep verification is essential post-implementation.
- Template literal URLs (backtick strings) need careful `bp()` insertion.

**Verification:**
- `PIPELINE_BASE_PATH="/test"` → full workflow in browser (create bundle, edit, save, export, test skin)
- Network tab: zero requests to paths not starting with `/test/`
- `grep -rn 'fetch("/' web/workbench.js web/wizard.js web/whole-sheet-init.js` returns zero matches (all converted to `bp()`)

**Rollback:** Revert frontend files. Phases 1-2 stay. Page loads but JS features break (same as pre-phase-3 under prefix).

**Commit:** `feat: frontend base-path prefixing via bp() helper`

### Phase 4: Runtime iframe verification and proxy-through test

**Scope:** Verify runtime iframe loads correctly under prefix. Test the full
stack through an actual reverse proxy (Caddy or Nginx), not just direct Flask.

**Runtime iframe:** Already audited — all paths are relative (see Appendix A).
No code changes expected. This phase is verification-only for the runtime.

**Proxy-through test:** Set up a local Caddy or Nginx using the subpath
template from Phase 5 (write templates first, or inline a temporary config).
Verify the full workflow through the proxy, not just direct Flask access.
Subtle issues (header forwarding, trailing-slash redirects, scheme in
generated URLs) only surface through the proxy.

**Verification:**
- `PIPELINE_BASE_PATH="/test"` → direct Flask: click "Test This Skin" → iframe loads → player spawns → moves
- Network tab inside iframe: all fetches relative (no root-absolute 404s)
- Through reverse proxy: `https://localhost/test/workbench` → full workflow works
- `redirect()` response uses correct external scheme/host (not `127.0.0.1:5071`) — confirms ProxyFix is working

**Rollback:** No code changes expected. If issues found, fix in a follow-up commit.

**Commit:** none expected (verification-only) unless fixes discovered

### Phase 5: Reverse proxy templates and deploy docs

**Scope:** Add subpath reverse proxy examples. Update ops docs with prefixed
health-check paths. Add favicon/robots.txt handling note.

**Files likely touched:**
- `deploy/Caddyfile` — add subpath section (commented) or create `deploy/Caddyfile.subpath`
- `deploy/nginx.conf` — add subpath section (commented) or create `deploy/nginx-subpath.conf`
- `deploy/README.md` — add subpath deployment instructions
- `deploy/.env.example` — already done in Phase 1
- `docs/HOST_DEPLOYMENT_CHECKLIST.md` — note that health-check path becomes `{BASE_PATH}/healthz` under subpath hosting
- `docs/LAUNCH_READINESS_CHECKLIST.md` — same health-check path note

**Health-check path note:**
Ops docs currently hardcode `GET /healthz`. Under subpath hosting this becomes
`GET {BASE_PATH}/healthz`. Add a note to both checklists: "If
`PIPELINE_BASE_PATH` is set, all paths including `/healthz` are under the
prefix."

**Systemd propagation note:**
The systemd service reads `.env` via `EnvironmentFile=`. As long as the
deployed `.env` includes `PIPELINE_BASE_PATH=...`, gunicorn inherits it. No
service file changes needed. Add a verification step in the checklist: after
starting the service, `curl http://127.0.0.1:5071{BASE_PATH}/healthz` must
return `ok`.

**Favicon / robots.txt:**
Browsers request `/favicon.ico` at the domain root regardless of page prefix.
Under subpath hosting, this is outside the app's prefix. Options:
- The reverse proxy serves a favicon at `/favicon.ico` (recommended)
- Ignore — causes 404 noise in proxy logs but no functional impact
Add a note in the subpath proxy template with a commented-out favicon handler.

**Risks:** None (doc/config only).

**Verification:** Manual review.

**Rollback:** Revert docs.

**Commit:** `docs: add subpath reverse proxy config templates and ops notes`

### Phase 6: Script re-validation

**Scope:** Grep all scripts for leading-slash URL constructors. Fix every instance where a root-absolute path discards the base path prefix.

**Files touched:**
- `scripts/ui_tests/subagents/workbench_agents.mjs` — 11 instances of `new URL('/workbench', baseUrl)` (lines 75, 97, 248, 377, 495, 570, 703, 843, 1319, plus coverage agent)
- `scripts/ui_tests/subagents/workbench_coverage_agent.mjs` — 1 instance (line 594)
- `scripts/ui_tests/runner/cli.mjs` — `defaultBaseUrl()` (line 24) extracts `.origin`, discarding path; line 305 `new URL('/workbench', ...)` constructor
- `scripts/ui_tests/core/server_control.mjs` — `normalizeWorkbenchUrl()` (line 10) sets `u.pathname = '/workbench'`, discarding any prefix

**The bug pattern:**
```javascript
// If baseUrl = "http://host:5071/asciicker-XPEdit"
new URL('/workbench', baseUrl)
// → "http://host:5071/workbench"  ← WRONG, prefix discarded
// Should be: "http://host:5071/asciicker-XPEdit/workbench"
```

**How to find all instances:**
```bash
grep -rn "new URL('/" scripts/
grep -rn 'new URL("/' scripts/
grep -rn '\.pathname\s*=' scripts/
```

**Risks:** Low. Scripts already accept URL parameters. The fix is mechanical.

**Verification:** Run the re-validation checklist from Section 6.

**Rollback:** Revert script fixes. Scripts still work with root-hosted URLs.

**Commit:** `fix: script URL construction for subpath hosting`

---

## 9. Non-Goals

This plan explicitly does **not** include:

- **Milestone 2 PNG workflow work** — PNG ingest, source-panel assembly, semantic dictionaries
- **Reskin work** — CSS/font/visual changes unrelated to path handling
- **Deployment host provisioning** — choosing a VPS, DNS setup, TLS provisioning
- **Verifier redesign** — no changes to verifier architecture or acceptance criteria
- **Generalized routing refactors** — no Flask middleware, no WSGI dispatch rewrite, no URL map redesign beyond what base-path requires
- **Multi-level prefix support** — only single-segment prefixes like `/asciicker-XPEdit` are supported, not `/foo/bar/baz`
- **Dynamic base path detection** — the base path is a fixed config value, not auto-detected from request headers
- **WebSocket support** — not currently used; if added later, WebSocket paths would need the same prefix treatment
- **CDN / asset pipeline** — no hashing, no bundling, no separate asset domain
- **Runtime rebuild** — NOT needed. Audit confirmed all runtime paths are relative (see Appendix A).

---

## Appendix A: Runtime Iframe Audit — RESOLVED (2026-03-22)

All three audit items from the original plan have been resolved. **No blockers found.**

### A1. `runtime/termpp-skin-lab-static/termpp-web-flat/index.html`

Minified HTML. Extracted references:

| Tag | Value | Type | Verdict |
|-----|-------|------|---------|
| `<link href=asciicker.json rel=manifest>` | `asciicker.json` | Relative | **Safe** |
| `<script src="flat_map_bootstrap.js">` | `flat_map_bootstrap.js` | Relative | **Safe** |

No absolute `<script src="/...">` or `<link href="/...">` tags found.

### A2. `runtime/termpp-skin-lab-static/termpp-web-flat/index.js` (Emscripten loader)

Minified JS (single line). Key patterns extracted:

| Pattern | Value | Verdict |
|---------|-------|---------|
| `REMOTE_PACKAGE_BASE` | `"index.data"` | Relative — **Safe** |
| `findWasmBinary()` | `locateFile("index.wasm")` | Relative — **Safe** |
| `locateFile(path)` | `return scriptDirectory + path` | Uses `scriptDirectory` |
| `scriptDirectory` | `new URL(".", _scriptName).href` | Computed from script's own URL — **Safe** |

**How it works:** Emscripten computes `scriptDirectory` from the script's own URL using `new URL(".", _scriptName).href`. When the script is loaded at `{BASE_PATH}/termpp-web-flat/index.js`, `scriptDirectory` becomes `{BASE_PATH}/termpp-web-flat/`. Then `locateFile("index.wasm")` resolves to `{BASE_PATH}/termpp-web-flat/index.wasm`. All relative. **No changes needed.**

### A3. `runtime/termpp-skin-lab-static/termpp-web/index.html` (non-flat)

Extracted references:

| Tag | Value | Type | Verdict |
|-----|-------|------|---------|
| `<link href=asciicker.json rel=manifest>` | `asciicker.json` | Relative | **Safe** |

No script src tags (script is inline or loaded differently). Lower priority — non-flat runtime is rarely used.

### Summary

**Runtime iframe is NOT a blocker for subpath support.** All paths are relative. Phase 4 reduces to a verification-only step — no code changes needed in the runtime bundle.

## Appendix B: Complete grep commands for verification

After implementation, run these to confirm no root-relative paths remain:

```bash
# Frontend: API fetches without bp()
grep -n 'fetch("/api' web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n "fetch('/api" web/workbench.js web/wizard.js web/whole-sheet-init.js

# Frontend: Asset URLs without bp()
grep -n "'/termpp-web" web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n '"/termpp-web' web/workbench.js web/wizard.js web/whole-sheet-init.js

# Frontend: href/src assignments without bp()
grep -n '\.src = [`'"'"'"]/' web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n '\.href = [`'"'"'"]/' web/workbench.js web/wizard.js web/whole-sheet-init.js

# Frontend: URL construction without bp()
grep -n 'new URL("/' web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n "new URL('/" web/workbench.js web/wizard.js web/whole-sheet-init.js

# Scripts: leading-slash URL constructors
grep -rn "new URL('/" scripts/
grep -rn 'new URL("/' scripts/
grep -rn '\.pathname\s*=' scripts/

# Backend: hardcoded root-relative paths
grep -n 'redirect("/' src/pipeline_v2/app.py
grep -n "redirect('/" src/pipeline_v2/app.py
```

All frontend greps should return zero matches after Phase 3.
Script greps should return zero leading-slash constructors after Phase 6 (except inside helper functions that already account for the prefix).

## Appendix C: Precise Implementation Tasks

This appendix provides exact code changes for each phase. An implementing session should execute these task by task. Each task is one atomic commit-ready unit.

---

### Phase 1 Tasks: Config and server plumbing

#### Task 1.1: Add `BASE_PATH` to `config.py`

**File:** `src/pipeline_v2/config.py`

**Add after line 1** (after `from __future__ import annotations`):
```python
import os
```

**Add after line 18** (after `ENABLED_FAMILIES`):
```python

def _normalize_base_path(raw: str) -> str:
    s = raw.strip().strip("/")
    if not s:
        return ""
    return "/" + s

BASE_PATH: str = _normalize_base_path(os.environ.get("PIPELINE_BASE_PATH", ""))
```

**Verify:** `python3 -c "from pipeline_v2.config import BASE_PATH; print(repr(BASE_PATH))"` prints `''`.

#### Task 1.2: Refactor `create_app()` to use Blueprint

**File:** `src/pipeline_v2/app.py`

**Add import at line 8:**
```python
from flask import Flask, Blueprint, Response, jsonify, redirect, request, send_from_directory, send_file
```

**Add import from config (line 10):**
```python
from .config import ensure_dirs, ROOT, EXPORT_DIR, ENABLED_FAMILIES, BASE_PATH
```

**Refactor `create_app()`** — line 178:

Replace:
```python
def create_app() -> Flask:
    ensure_dirs()
    app = Flask(__name__)

    @app.route("/healthz")
```

With:
```python
def create_app() -> Flask:
    ensure_dirs()
    app = Flask(__name__)
    bp = Blueprint("main", __name__)

    @bp.route("/healthz")
```

Then change every `@app.route`, `@app.get`, `@app.post` to `@bp.route`, `@bp.get`, `@bp.post` respectively (37 route decorators total).

**Keep `@app.errorhandler(500)` on `app`** — it stays as `@app.errorhandler`, NOT on the blueprint.

**Fix the redirect** (line 188):
```python
    @bp.route("/")
    def index_page():
        return redirect(BASE_PATH + "/workbench", code=302)
```

**Register the blueprint before `return app`:**
```python
    app.register_blueprint(bp, url_prefix=BASE_PATH)

    @app.errorhandler(500)
    def api_500(_e):
        ...

    return app
```

**Critical ordering:** The catch-all `@bp.route("/<path:filename>")` must be defined AFTER all other routes on the blueprint. Flask matches routes in registration order within a blueprint. Current code already has it in the right position (line 203), so just keep that order.

**Verify:**
```bash
PIPELINE_BASE_PATH="" PYTHONPATH=src python3 -m pipeline_v2.app &
curl http://127.0.0.1:5071/healthz         # → "ok"
curl -sI http://127.0.0.1:5071/            # → 302 → /workbench
curl -s http://127.0.0.1:5071/workbench | head -5  # → HTML
kill %1

PIPELINE_BASE_PATH="/test" PYTHONPATH=src python3 -m pipeline_v2.app &
curl http://127.0.0.1:5071/test/healthz    # → "ok"
curl -sI http://127.0.0.1:5071/test/       # → 302 → /test/workbench
curl http://127.0.0.1:5071/healthz         # → 404 (routes NOT at root)
kill %1
```

**Commit:** `feat: add PIPELINE_BASE_PATH config and Blueprint routing`

#### Task 1.3: Add env var to deploy template

**File:** `deploy/.env.example`

**Add after line 7** (after `PIPELINE_DEBUG=false`):
```
# URL prefix for subpath hosting (empty = root-hosted, default)
# Example: /asciicker-XPEdit
PIPELINE_BASE_PATH=
```

#### Task 1.4: Add ProxyFix middleware

**File:** `src/pipeline_v2/app.py`

**Add import at top of file:**
```python
from werkzeug.middleware.proxy_fix import ProxyFix
```

**Add in `create_app()`, after `app = Flask(__name__)` and before the blueprint:**
```python
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
```

This is safe to add unconditionally — it's a no-op when not behind a proxy.
When behind a proxy, it ensures `redirect()` generates the correct external
URL (scheme, host, prefix) instead of `http://127.0.0.1:5071/...`.

**Verify:**
```bash
PIPELINE_BASE_PATH="/test" PYTHONPATH=src python3 -m pipeline_v2.app &
# Direct access (no proxy) — redirect still works:
curl -sI http://127.0.0.1:5071/test/ | grep Location
# → Location: http://127.0.0.1:5071/test/workbench
kill %1
```

Full ProxyFix verification happens in Phase 4 (proxy-through test).

---

### Phase 2 Tasks: HTML injection prefixing

#### Task 2.1: Inject `window.__WB_BASE_PATH` and prefix asset paths

**File:** `src/pipeline_v2/app.py`

**Replace the `_serve_web_html` function** (lines 79-89):

```python
def _serve_web_html(file_name: str):
    p = (WEB_DIR / file_name).resolve()
    html = p.read_text(encoding="utf-8")
    # Prefix asset paths with BASE_PATH
    html = html.replace('href="/styles.css"', f'href="{_v(BASE_PATH + "/styles.css")}"')
    html = html.replace('href="/rexpaint-editor/styles.css"', f'href="{_v(BASE_PATH + "/rexpaint-editor/styles.css")}"')
    html = html.replace('src="/wizard.js"', f'src="{_v(BASE_PATH + "/wizard.js")}"')
    html = html.replace('src="/workbench.js"', f'src="{_v(BASE_PATH + "/workbench.js")}"')
    html = html.replace('src="./termpp_skin_lab.js"', f'src="{_v(BASE_PATH + "/termpp_skin_lab.js")}"')
    # Prefix inline links
    html = html.replace('href="/workbench"', f'href="{BASE_PATH}/workbench"')
    # whole-sheet-init.js — type=module src
    html = html.replace('src="/whole-sheet-init.js"', f'src="{_v(BASE_PATH + "/whole-sheet-init.js")}"')
    # Inject base path and boot nonce globals
    globals_script = (
        f'<script>'
        f'window.__WB_BASE_PATH = "{BASE_PATH}";'
        f'window.__WB_SERVER_BOOT_NONCE = "{SERVER_BOOT_NONCE}";'
        f'</script>'
    )
    if "</head>" in html:
        html = html.replace("</head>", f"  {globals_script}\n</head>", 1)
    return _no_cache(Response(html, mimetype="text/html"))
```

**Note on replacement safety:**
- `href="/styles.css"` (workbench.html:7, wizard.html:7) — unique match, won't collide with `/rexpaint-editor/styles.css` because that match string is `href="/rexpaint-editor/styles.css"`.
- `src="/whole-sheet-init.js"` (workbench.html:426) — only appears once.
- `href="/workbench"` (wizard.html:13) — catches the `<a>` link.

**Verify:**
```bash
PIPELINE_BASE_PATH="/test" PYTHONPATH=src python3 -m pipeline_v2.app &
curl -s http://127.0.0.1:5071/test/workbench | grep -o 'window.__WB_BASE_PATH = "[^"]*"'
# → window.__WB_BASE_PATH = "/test"
curl -s http://127.0.0.1:5071/test/workbench | grep -o 'href="[^"]*styles[^"]*"'
# → href="/test/styles.css?v=..."
# → href="/test/rexpaint-editor/styles.css?v=..."
curl -s http://127.0.0.1:5071/test/wizard | grep -o 'href="[^"]*workbench[^"]*"'
# → href="/test/workbench"
kill %1
```

**Commit:** `feat: base-path-aware HTML asset injection`

---

### Phase 3 Tasks: Frontend `bp()` helper and fetch prefixing

#### Task 3.1: Add `bp()` helper to `workbench.js`

**File:** `web/workbench.js`

**Add after line 7** (after `const SERVER_BOOT_NONCE = ...`):
```javascript
  const BASE_PATH = String(window.__WB_BASE_PATH || "");
  function bp(path) { return BASE_PATH + path; }
```

#### Task 3.2: Prefix all API fetch calls in `workbench.js`

**File:** `web/workbench.js`

Every `fetch("/api/...` becomes `fetch(bp("/api/...`. The complete list (23 sites):

| Line | Current | Replace with |
|------|---------|-------------|
| 539 | `fetch("/api/workbench/runtime-preflight"` | `fetch(bp("/api/workbench/runtime-preflight")` |
| 1194 | `? "/api/workbench/web-skin-bundle-payload"` | `? bp("/api/workbench/web-skin-bundle-payload")` |
| 1195 | `: "/api/workbench/web-skin-payload"` | `: bp("/api/workbench/web-skin-payload")` |
| 1449 | `` fetch(`/api/workbench/termpp-stream/status/... `` | `` fetch(bp(`/api/workbench/termpp-stream/status/...`)) `` |
| 1500 | `fetch("/api/workbench/termpp-stream/start"` | `fetch(bp("/api/workbench/termpp-stream/start")` |
| 1523 | `fetch("/api/workbench/termpp-stream/start"` | `fetch(bp("/api/workbench/termpp-stream/start")` |
| 1545 | `fetch("/api/workbench/termpp-stream/stop"` | `fetch(bp("/api/workbench/termpp-stream/stop")` |
| 1569 | `fetch("/api/workbench/termpp-skin-command"` | `fetch(bp("/api/workbench/termpp-skin-command")` |
| 1594 | `fetch("/api/workbench/open-termpp-skin"` | `fetch(bp("/api/workbench/open-termpp-skin")` |
| 1634 | `fetch("/api/workbench/run-verification"` | `fetch(bp("/api/workbench/run-verification")` |
| 1666 | `fetch("/api/workbench/xp-tool-command"` | `fetch(bp("/api/workbench/xp-tool-command")` |
| 1688 | `fetch("/api/workbench/open-in-xp-tool"` | `fetch(bp("/api/workbench/open-in-xp-tool")` |
| 3562 | `fetch("/api/workbench/save-session"` | `fetch(bp("/api/workbench/save-session")` |
| 3708 | `fetch("/api/workbench/load-from-job"` | `fetch(bp("/api/workbench/load-from-job")` |
| 3740 | `fetch("/api/workbench/load-session"` | `fetch(bp("/api/workbench/load-session")` |
| 3782 | `fetch("/api/workbench/upload-xp"` | `fetch(bp("/api/workbench/upload-xp")` |
| 3842 | `fetch("/api/workbench/export-xp"` | `fetch(bp("/api/workbench/export-xp")` |
| 5984 | `fetch("/api/upload"` | `fetch(bp("/api/upload")` |
| 5999 | `fetch("/api/analyze"` | `fetch(bp("/api/analyze")` |
| 6030 | `fetch("/api/workbench/templates")` | `fetch(bp("/api/workbench/templates"))` |
| 6116 | `fetch("/api/workbench/bundle/action-status"` | `fetch(bp("/api/workbench/bundle/action-status")` |
| 6242 | `fetch("/api/workbench/create-blank-session"` | `fetch(bp("/api/workbench/create-blank-session")` |
| 6332 | `fetch("/api/workbench/bundle/create"` | `fetch(bp("/api/workbench/bundle/create")` |
| 6371 | `fetch("/api/workbench/action-grid/apply"` | `fetch(bp("/api/workbench/action-grid/apply")` |
| 6418 | `fetch("/api/run"` | `fetch(bp("/api/run")` |

#### Task 3.3: Prefix template-literal URLs in `workbench.js`

| Line | Current | Replace with |
|------|---------|-------------|
| 1443 | `` img.src = `/api/workbench/termpp-stream/frame/${...}?t=${...}` `` | `` img.src = bp(`/api/workbench/termpp-stream/frame/${...}?t=${...}`) `` |
| 1449 | `` fetch(`/api/workbench/termpp-stream/status/${...}`) `` | `` fetch(bp(`/api/workbench/termpp-stream/status/${...}`)) `` |
| 3870 | `` a.href = `/api/workbench/download-xp?xp_path=${...}` `` | `` a.href = bp(`/api/workbench/download-xp?xp_path=${...}`) `` |

#### Task 3.4: Prefix iframe source URL in `workbench.js`

**Line 53:**
```javascript
// Before:
const u = new URL("/termpp-web-flat/index.html?solo=1&player=player", window.location.origin);
// After:
const u = new URL(bp("/termpp-web-flat/index.html") + "?solo=1&player=player", window.location.origin);
```

**Line 627:**
```javascript
// Before:
const raw = String(state.webbuild.src || "/termpp-web-flat/index.html?solo=1&player=player");
// After:
const raw = String(state.webbuild.src || bp("/termpp-web-flat/index.html?solo=1&player=player"));
```

#### Task 3.5: Add `bp()` to `wizard.js` and prefix its URLs

**File:** `web/wizard.js`

**Add after line 3** (after `const $ = ...`):
```javascript
  const BASE_PATH = String(window.__WB_BASE_PATH || "");
  function bp(path) { return BASE_PATH + path; }
```

**Prefix fetches:**

| Line | Current | Replace with |
|------|---------|-------------|
| 22 | `fetch("/api/upload"` | `fetch(bp("/api/upload")` |
| 32 | `fetch("/api/analyze"` | `fetch(bp("/api/analyze")` |
| 66 | `fetch("/api/run"` | `fetch(bp("/api/run")` |

**Prefix navigation (line 91):**
```javascript
// Before:
const u = new URL("/workbench", window.location.origin);
// After:
const u = new URL(bp("/workbench"), window.location.origin);
```

#### Task 3.6: Add `bp()` to `whole-sheet-init.js` and prefix font URL

**File:** `web/whole-sheet-init.js`

**Add after line 19** (after the FillTool import):
```javascript
const _WS_BASE_PATH = String(window.__WB_BASE_PATH || "");
function bp(path) { return _WS_BASE_PATH + path; }
```

**Line 21:**
```javascript
// Before:
const FONT_URL = '/termpp-web-flat/fonts/cp437_12x12.png';
// After:
const FONT_URL = bp('/termpp-web-flat/fonts/cp437_12x12.png');
```

#### Task 3.7: Verify with grep

```bash
grep -n 'fetch("/api' web/workbench.js web/wizard.js
# Expected: 0 matches (all wrapped in bp())

grep -n 'fetch(`/api' web/workbench.js
# Expected: 0 matches

grep -n "'/termpp-web" web/whole-sheet-init.js
# Expected: 0 matches (font URL now uses bp())

grep -n 'new URL("/termpp' web/workbench.js
# Expected: 0 matches

grep -n 'new URL("/workbench' web/wizard.js
# Expected: 0 matches
```

**Commit:** `feat: frontend base-path prefixing via bp() helper`

---

### Phase 4 Tasks: Runtime iframe verification (no code changes)

#### Task 4.1: Verify runtime under prefix

**Already resolved by Appendix A audit.** All runtime paths are relative. This phase is verification-only.

```bash
PIPELINE_BASE_PATH="/test" PYTHONPATH=src python3 -m pipeline_v2.app &
# Open browser to http://127.0.0.1:5071/test/workbench
# Click "Test This Skin" (or any flow that loads the iframe)
# Open DevTools → Network → verify:
#   /test/termpp-web-flat/index.html → 200
#   /test/termpp-web-flat/index.js → 200
#   /test/termpp-web-flat/index.wasm → 200
#   /test/termpp-web-flat/index.data → 200
#   /test/termpp-web-flat/flat_map_bootstrap.js → 200
#   /test/termpp-web-flat/flatmaps/*.a3d → 200
#   /test/termpp-web-flat/fonts/cp437_12x12.png → 200
kill %1
```

**No commit needed unless fixes are discovered.**

---

### Phase 5 Tasks: Deploy templates

#### Task 5.1: Add subpath Caddy example

**File:** Create `deploy/Caddyfile.subpath` or add commented section to existing `deploy/Caddyfile`:

```caddyfile
# Subpath hosting: rikiworld.com/asciicker-XPEdit
# Flask must be started with PIPELINE_BASE_PATH=/asciicker-XPEdit
# Caddy `handle` (not handle_path) preserves the prefix in the upstream request.
rikiworld.com {
    handle /asciicker-XPEdit/* {
        reverse_proxy 127.0.0.1:5071
    }
    encode gzip zstd
}
```

#### Task 5.2: Add subpath Nginx example

**File:** Create `deploy/nginx-subpath.conf` or add commented section to existing `deploy/nginx.conf`:

```nginx
# Subpath hosting: rikiworld.com/asciicker-XPEdit
# Flask must be started with PIPELINE_BASE_PATH=/asciicker-XPEdit
# proxy_pass with matching path preserves the prefix.
server {
    listen 80;
    server_name rikiworld.com;

    location /asciicker-XPEdit/ {
        proxy_pass http://127.0.0.1:5071/asciicker-XPEdit/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Commit:** `docs: add subpath reverse proxy config templates`

---

### Phase 6 Tasks: Script URL fixes

#### Task 6.1: Grep for all leading-slash URL constructors

```bash
grep -rn "new URL('/" scripts/
grep -rn 'new URL("/' scripts/
grep -rn '\.pathname\s*=' scripts/
```

#### Task 6.2: Fix `server_control.mjs` normalizeWorkbenchUrl

**File:** `scripts/ui_tests/core/server_control.mjs` (lines 5-16)

**Current bug:** Line 10 — `u.pathname = '/workbench'` discards any base path prefix in the URL.

```javascript
// Before (line 5-16):
function normalizeWorkbenchUrl(baseUrl) {
  const raw = String(baseUrl || process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/workbench';        // ← discards prefix
    }
    return u.toString();
  } catch {
    return raw;
  }
}

// After:
function normalizeWorkbenchUrl(baseUrl) {
  const raw = String(baseUrl || process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/workbench';
    } else if (!u.pathname.endsWith('/workbench')) {
      // Preserve base path prefix: /prefix → /prefix/workbench
      u.pathname = u.pathname.replace(/\/$/, '') + '/workbench';
    }
    return u.toString();
  } catch {
    return raw;
  }
}
```

#### Task 6.3: Fix `cli.mjs` defaultBaseUrl

**File:** `scripts/ui_tests/runner/cli.mjs` (lines 21-28)

**Current bug:** `new URL(raw).origin` discards the path prefix.

```javascript
// Before:
function defaultBaseUrl() {
  const raw = String(process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://127.0.0.1:5071';
  }
}

// After:
function defaultBaseUrl() {
  const raw = String(process.env.WORKBENCH_URL || 'http://127.0.0.1:5071/workbench');
  try {
    const u = new URL(raw);
    // Preserve path prefix: http://host/prefix/workbench → http://host/prefix
    let base = u.origin;
    if (u.pathname && u.pathname !== '/' && u.pathname !== '/workbench') {
      const stripped = u.pathname.replace(/\/workbench\/?$/, '');
      if (stripped) base += stripped;
    }
    return base;
  } catch {
    return 'http://127.0.0.1:5071';
  }
}
```

#### Task 6.4: Fix `workbench_agents.mjs` URL constructors

**File:** `scripts/ui_tests/subagents/workbench_agents.mjs`

**11 instances** of `new URL('/workbench', baseUrl)` at lines 75, 97, 248, 377, 495, 570, 703, 843, 1319.

**The bug:** `new URL('/workbench', 'http://host/prefix')` → `http://host/workbench` (prefix discarded).

**Fix approach — add a helper at the top of the file:**
```javascript
function workbenchUrl(baseUrl) {
  try {
    const u = new URL(baseUrl);
    const base = u.pathname.replace(/\/$/, '');
    u.pathname = base + '/workbench';
    return u.toString();
  } catch {
    return baseUrl + '/workbench';
  }
}
```

Then replace all `new URL('/workbench', baseUrl).toString()` with `workbenchUrl(baseUrl)`.

**Same pattern in `workbench_coverage_agent.mjs` line 594.**

#### Task 6.5: Fix `cli.mjs` line 305

```javascript
// Before:
serverHandle = await ensureFlaskWorkbenchServer({ baseUrl: new URL('/workbench', opts.baseUrl).toString(), ... });
// After:
serverHandle = await ensureFlaskWorkbenchServer({ baseUrl: workbenchUrl(opts.baseUrl), ... });
```

(Import `workbenchUrl` from agents or duplicate the helper.)

**Commit:** `fix: script URL construction for subpath hosting`
