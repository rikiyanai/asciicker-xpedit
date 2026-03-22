# Base-Path Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

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

### Root-hosted regression

- [ ] With `PIPELINE_BASE_PATH=""` (default), all existing behavior is unchanged
- [ ] CI passes with no base-path set

---

## 8. Execution Phases

### Phase 1: Config and server plumbing

**Scope:** Add `PIPELINE_BASE_PATH` to config, create Blueprint, move all routes into it.

**Files likely touched:**
- `src/pipeline_v2/config.py` — add `BASE_PATH` with normalization
- `src/pipeline_v2/app.py` — refactor `create_app()` to use Blueprint with `url_prefix=BASE_PATH`
- `deploy/.env.example` — add `PIPELINE_BASE_PATH=` line

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

### Phase 4: Runtime iframe audit and fix

**Scope:** Verify the termpp-web-flat runtime HTML references bootstrap/WASM/data via relative paths. Fix any absolute references.

**Files likely touched:**
- `runtime/termpp-skin-lab-static/termpp-web-flat/index.html` — audit only (likely relative already)
- `web/workbench.js` — already done in Phase 3 (iframe src)

**Risks:**
- If the compiled Emscripten `index.html` uses absolute paths for `.wasm`/`.data`, there is no good fix short of post-processing the HTML or patching the JS loader. This is the highest-risk audit item.
- The runtime payload is committed binary; changing it requires a rebuild.

**Verification:**
- `PIPELINE_BASE_PATH="/test"` → click "Test This Skin" → iframe loads → player spawns → moves
- Network tab inside iframe: all fetches relative (no root-absolute 404s)

**Rollback:** If runtime HTML has absolute paths, document the finding and defer. Subpath support would be blocked on a runtime rebuild.

**Commit:** `fix: verify/fix runtime iframe paths for base-path support` (if changes needed)

### Phase 5: Reverse proxy templates and deploy docs

**Scope:** Add subpath reverse proxy examples. Update `deploy/.env.example` docs.

**Files likely touched:**
- `deploy/Caddyfile` — add subpath section (commented) or create `deploy/Caddyfile.subpath`
- `deploy/nginx.conf` — add subpath section (commented) or create `deploy/nginx-subpath.conf`
- `deploy/README.md` — add subpath deployment instructions
- `deploy/.env.example` — already done in Phase 1

**Risks:** None (doc/config only).

**Verification:** Manual review.

**Rollback:** Revert docs.

**Commit:** `docs: add subpath reverse proxy config templates`

### Phase 6: Script re-validation

**Scope:** Run scripts with prefixed URLs. Fix any path construction issues.

**Files likely touched:**
- `scripts/ui_tests/subagents/workbench_agents.mjs` — fix `new URL('/workbench', baseUrl)` if needed
- `scripts/ui_tests/core/server_control.mjs` — verify origin extraction logic

**Risks:** Low. Scripts already accept URL parameters.

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
- **Runtime rebuild** — if the Emscripten runtime HTML has absolute paths, fixing it requires a C++ rebuild which is out of scope for this plan. The plan will document the finding and block subpath support on that fix.

---

## Appendix A: Audit items to resolve before Phase 4

These must be checked during implementation, not deferred:

1. **Read `runtime/termpp-skin-lab-static/termpp-web-flat/index.html`** — confirm all `<script src>`, `<link href>`, and Emscripten loader references are relative, not absolute.
2. **Read `runtime/termpp-skin-lab-static/termpp-web-flat/index.js`** (the Emscripten-generated loader) — check for `locateFile` or hardcoded absolute paths for `.wasm` and `.data`.
3. **Read `runtime/termpp-skin-lab-static/termpp-web/index.html`** — same check for the non-flat runtime (lower priority, used less).

## Appendix B: Complete grep commands for verification

After implementation, run these to confirm no root-relative paths remain:

```bash
# API fetches without bp()
grep -n 'fetch("/api' web/workbench.js web/wizard.js web/whole-sheet-init.js

# Asset URLs without bp()
grep -n "'/termpp-web" web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n '"/termpp-web' web/workbench.js web/wizard.js web/whole-sheet-init.js

# href/src without bp() (in JS)
grep -n "\.src = '/" web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n '\.src = "/' web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n '\.href = "/' web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n "\.href = '/" web/workbench.js web/wizard.js web/whole-sheet-init.js

# URL construction without bp()
grep -n 'new URL("/' web/workbench.js web/wizard.js web/whole-sheet-init.js
grep -n "new URL('/" web/workbench.js web/wizard.js web/whole-sheet-init.js
```

All should return zero matches (or only matches inside the `bp()` function definition itself).
