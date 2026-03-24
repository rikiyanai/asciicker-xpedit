# MVP Deploy to Google Cloud Run — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the xpedit workbench to Google Cloud Run so it's live at `rikiworld.com/xpedit`, using GitHub Actions for CI/CD and Cloudflare Workers for path-based routing.

**Architecture:** The Flask app runs as a Docker container on Cloud Run (free tier), constrained to a single instance (`--max-instances=1`) because all session/upload/export state is filesystem-based and ephemeral. GitHub Actions builds the image, pushes to Artifact Registry with a deterministic SHA tag, and deploys that exact tag to Cloud Run on manual trigger. A Cloudflare Worker routes `rikiworld.com/xpedit/*` requests to the Cloud Run service URL while all other paths continue to GitHub Pages. Post-deploy verification includes both stateless health checks and a stateful upload→session round-trip.

**Tech Stack:** Docker, Google Cloud Run, Artifact Registry, GitHub Actions (`google-github-actions/deploy-cloudrun`), Cloudflare Workers, existing Flask + Gunicorn app

---

## Storage Limitations (Cloud Run Ephemeral Filesystem)

The app stores uploads, sessions, bundles, exports, and bug reports under `data/` on the local filesystem (`src/pipeline_v2/config.py:25-34`, `src/pipeline_v2/storage.py:8`). Cloud Run provides an ephemeral filesystem — **all data disappears when the container restarts or a new revision deploys.**

### MVP mitigations

| Concern | Mitigation |
|---------|-----------|
| Cross-instance inconsistency | `--max-instances=1` — all requests hit the same container |
| Data loss on redeploy | Accepted for MVP — the workbench workflow is upload→edit→export/download in one session; persistence across deploys is not needed |
| Bug report durability | Set `BUG_REPORT_DELIVERY=github` so reports go to GitHub Issues, not local files |
| Scale-to-zero cold data loss | Accepted — user re-uploads after idle timeout; no long-lived sessions expected at MVP scale |

### Post-MVP upgrade path

When real users need persistent sessions, mount a GCS bucket via Cloud Run volume mounts (GA since 2024) at `/app/data/`. No app code changes needed — just a `--add-volume` flag on deploy. This is explicitly out of scope for MVP.

---

## Pre-Conditions

- GCP project with billing enabled (free tier is sufficient)
- `gcloud` CLI installed locally
- Cloudflare account managing `rikiworld.com` DNS
- GitHub repo with Actions enabled

## Files Overview

| Action | File |
|--------|------|
| Create | `Dockerfile` |
| Create | `.dockerignore` |
| Create | `.github/workflows/deploy-cloudrun.yml` |
| Modify | `scripts/deploy/smoke_test.sh` (add stateful check) |
| Create | `deploy/cloudflare-worker/xpedit-router.js` |
| Create | `deploy/cloudflare-worker/wrangler.toml` |
| Keep   | `scripts/deploy/launch_prod.sh` (still useful for non-Cloud-Run deploys) |
| Delete | `.github/workflows/deploy-prod.yml` (SSH-based, superseded) |
| Delete | `scripts/deploy/install_release.sh` (VPS-specific, superseded) |

---

## Phase 1: Docker + Cloud Run (Core)

### Task 1: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

**Step 1: Write the file**

```dockerignore
.git
.github
.venv
.ccb
.claude
.worktrees
__pycache__
*.pyc
.pytest_cache
output/
data/
SMALLTESTPNGs/
node_modules/
tests/
docs/
deploy/cloudflare-worker/
.DS_Store
*.tar.gz
sprites/Stony_Brook_Seawolves_logo_svg.xp
```

**Step 2: Verify it exists**

Run: `cat .dockerignore`
Expected: file contents displayed

**Step 3: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for Cloud Run builds"
```

---

### Task 2: Create `Dockerfile`

**Files:**
- Create: `Dockerfile`

**Step 1: Write the Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps for Pillow (JPEG, PNG, freetype support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev zlib1g-dev libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package metadata first (layer caching: deps reinstall only when these change)
COPY pyproject.toml README.md ./

# Non-editable install — editable installs need the full source tree at install time
RUN pip install --no-cache-dir ".[deploy]"

# Copy application code and assets
COPY src/ src/
COPY web/ web/
COPY config/ config/
COPY sprites/ sprites/
COPY runtime/ runtime/
COPY wsgi.py .

# Create data directories (ephemeral on Cloud Run — see plan doc)
RUN python3 -c "import sys; sys.path.insert(0,'src'); from pipeline_v2.config import ensure_dirs; ensure_dirs()"

# Cloud Run sets PORT at runtime (default 8080)
ENV PORT=8080
ENV PIPELINE_HOST=0.0.0.0
ENV PIPELINE_BASE_PATH=/xpedit

EXPOSE ${PORT}

# Single worker: Cloud Run single-instance MVP, no need for multi-worker
CMD exec gunicorn wsgi:app \
    --bind 0.0.0.0:${PORT} \
    --workers 1 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

Design decisions:
- `COPY pyproject.toml README.md ./` before install — fixes the build failure (`readme = "README.md"` in pyproject.toml requires the file to exist at install time)
- `pip install ".[deploy]"` (not `-e`) — editable installs are for development; production installs the package properly
- `--workers 1 --threads 4` — single instance with threads; matches `--max-instances=1` constraint, avoids multi-worker file conflicts
- `runtime/` (63 MB WASM payload) baked in — it's committed in the repo

**Step 2: Test Docker build locally**

Run: `docker build -t xpedit-test .`
Expected: builds successfully, no errors. Watch specifically for:
- `pip install` succeeds (README.md found)
- Pillow installs with JPEG/PNG support
- `ensure_dirs()` runs without error

**Step 3: Test Docker run locally**

Run: `docker run --rm -p 5071:8080 -e PIPELINE_BASE_PATH=/xpedit xpedit-test`

In another terminal:

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:5071/xpedit/healthz`
Expected: `200`

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:5071/xpedit/workbench`
Expected: `200`

Run: `BASE_URL=http://localhost:5071 PREFIX=/xpedit ./scripts/deploy/smoke_test.sh`
Expected: all checks PASS

Stop the container with Ctrl+C.

**Step 4: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile for Cloud Run deployment"
```

---

### Task 3: Add stateful smoke check

**Files:**
- Modify: `scripts/deploy/smoke_test.sh`

**Context:** The existing smoke test only checks GET endpoints (healthz, workbench HTML, templates API, static asset). This won't catch broken upload/filesystem behavior. Add a stateful round-trip: POST a 1x1 PNG to `/api/upload` → verify `upload_id` in the response (proves Flask, Pillow, and filesystem writes all work).

The actual upload endpoint is `POST /api/upload` (not `/api/workbench/upload`). It accepts a `file` field with a `.png` and returns `{"upload_id": "...", "source_path": "...", "width": N, "height": N, "sha256": "..."}` with status 201. See `src/pipeline_v2/app.py:459` and `src/pipeline_v2/service.py:1159`.

**Step 1: Add the stateful check after the existing checks**

Append to `scripts/deploy/smoke_test.sh`, before the final results block:

```bash
# Stateful: upload a 1x1 PNG and verify the backend can process it
# Endpoint: POST /api/upload (returns upload_id, width, height, sha256)
# This proves Flask routing, Pillow image processing, and filesystem writes all work.
check_stateful() {
    local base="${BASE_URL}${PREFIX}"

    # Create a minimal valid 1x1 PNG via python (portable, avoids shell printf binary issues)
    local tmpfile
    tmpfile=$(mktemp /tmp/smoke-test-XXXXXX.png)
    python3 -c "
import struct, zlib
# Minimal 1x1 RGB PNG
sig = b'\\x89PNG\\r\\n\\x1a\\n'
def chunk(t, d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB',1,1,8,2,0,0,0))
raw = zlib.compress(b'\\x00\\xff\\x00\\x00')
idat = chunk(b'IDAT', raw)
iend = chunk(b'IEND', b'')
open('${tmpfile}','wb').write(sig+ihdr+idat+iend)
" 2>/dev/null

    if [ ! -s "$tmpfile" ]; then
        echo "  FAIL  stateful-upload  (could not generate test PNG)"
        FAIL=$((FAIL + 1))
        rm -f "$tmpfile"
        return
    fi

    # POST to /api/upload — expect 201 with upload_id in response
    local http_code body
    body=$(curl -s -w '\n%{http_code}' --max-time "$TIMEOUT" \
      -F "file=@${tmpfile};type=image/png" \
      "${base}/api/upload" 2>/dev/null) || body=""
    rm -f "$tmpfile"

    http_code=$(echo "$body" | tail -1)
    body=$(echo "$body" | sed '$d')

    if [ "$http_code" = "201" ] && echo "$body" | grep -q '"upload_id"'; then
        echo "  PASS  stateful-upload  (POST /api/upload → 201, upload_id present)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  stateful-upload  (HTTP ${http_code}, body: ${body:0:120})"
        FAIL=$((FAIL + 1))
    fi
}

check_stateful
```

**Step 2: Verify syntax**

Run: `bash -n scripts/deploy/smoke_test.sh`
Expected: no errors

**Step 3: Test locally against running container**

Run: `BASE_URL=http://localhost:5071 PREFIX=/xpedit ./scripts/deploy/smoke_test.sh`
Expected: 5/5 PASS (including stateful-upload)

**Step 4: Commit**

```bash
git add scripts/deploy/smoke_test.sh
git commit -m "feat: add stateful upload check to deploy smoke test"
```

---

### Task 4: Create GitHub Actions workflow for Cloud Run

**Files:**
- Create: `.github/workflows/deploy-cloudrun.yml`
- Delete: `.github/workflows/deploy-prod.yml` (SSH-based, superseded)
- Delete: `scripts/deploy/install_release.sh` (VPS-specific, superseded)

**Step 1: Write the workflow**

The build job outputs the exact image tag. The deploy job consumes it — no floating `:latest` tag race.

```yaml
name: Deploy to Cloud Run

on:
  workflow_dispatch:
    inputs:
      target_ref:
        description: "Git ref to deploy (branch, tag, or SHA)"
        required: false
        default: "master"

env:
  GCP_REGION: us-central1
  SERVICE_NAME: asciicker-xpedit
  AR_REPO: asciicker-xpedit

jobs:
  # ── Job 1: Build, test, push image ──
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.image_tag }}
      image_url: ${{ steps.meta.outputs.image_url }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.target_ref || 'master' }}

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Pre-deploy tests
        run: |
          pip install -e ".[deploy]"
          python3 -m py_compile src/pipeline_v2/app.py
          python3 -m py_compile src/pipeline_v2/service.py
          python3 -m py_compile src/pipeline_v2/config.py
          python3 -m py_compile wsgi.py
          python3 -m pytest --ignore=tests/e2e -q

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet

      - name: Compute image metadata
        id: meta
        run: |
          SHA="$(git rev-parse --short HEAD)"
          IMAGE="${{ env.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/${{ env.AR_REPO }}/xpedit"
          echo "image_tag=${SHA}" >> "$GITHUB_OUTPUT"
          echo "image_url=${IMAGE}:${SHA}" >> "$GITHUB_OUTPUT"

      - name: Build and push Docker image
        run: |
          docker build -t "${{ steps.meta.outputs.image_url }}" .
          docker push "${{ steps.meta.outputs.image_url }}"

  # ── Job 2: Deploy exact image to Cloud Run ──
  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE_NAME }}
          region: ${{ env.GCP_REGION }}
          image: ${{ needs.build-and-push.outputs.image_url }}
          flags: |
            --allow-unauthenticated
            --memory=512Mi
            --cpu=1
            --min-instances=0
            --max-instances=1
            --port=8080
            --concurrency=80
          env_vars: |
            PIPELINE_BASE_PATH=/xpedit
            PIPELINE_HOST=0.0.0.0
            BUG_REPORT_DELIVERY=github
            BUG_REPORT_GITHUB_REPO=${{ github.repository }}
          secrets: |
            BUG_REPORT_GITHUB_TOKEN=BUG_REPORT_GITHUB_TOKEN:latest

  # ── Job 3: Post-deploy smoke test ──
  smoke-test:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Fetch service URL
        id: svc
        run: |
          URL=$(gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.GCP_REGION }} \
            --format='value(status.url)')
          echo "url=${URL}" >> "$GITHUB_OUTPUT"
          echo "Cloud Run URL: ${URL}"

      - name: Wait for service to stabilize
        run: sleep 5

      - name: Run smoke tests (stateless + stateful)
        run: |
          BASE_URL="${{ steps.svc.outputs.url }}" \
          PREFIX="/xpedit" \
          ./scripts/deploy/smoke_test.sh

      - name: Deployment summary
        if: always()
        run: |
          echo "## Deploy Summary" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Ref:** ${{ github.event.inputs.target_ref || 'master' }}" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Image:** \`${{ needs.build-and-push.outputs.image_url }}\`" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Cloud Run URL:** ${{ steps.svc.outputs.url }}" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Service:** ${{ env.SERVICE_NAME }}" >> "$GITHUB_STEP_SUMMARY"
```

Note on `--max-instances=1`: this is the critical constraint that makes ephemeral filesystem safe — see the Storage Limitations section above. Do not increase without adding shared persistent storage.

Note on `secrets:` block: if you don't want bug reports going to GitHub Issues yet, remove the `BUG_REPORT_DELIVERY`, `BUG_REPORT_GITHUB_REPO`, and `secrets:` lines. Bug reports will fall back to local-only (ephemeral on Cloud Run, which is fine for MVP since users can screenshot).

**Step 2: Remove SSH-based artifacts**

```bash
rm -f .github/workflows/deploy-prod.yml
rm -f scripts/deploy/install_release.sh
```

**Step 3: Validate**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-cloudrun.yml')); print('YAML OK')"` or manual review.

**Step 4: Commit**

```bash
git add .github/workflows/deploy-cloudrun.yml
git rm --cached .github/workflows/deploy-prod.yml 2>/dev/null || true
git rm --cached scripts/deploy/install_release.sh 2>/dev/null || true
git commit -m "feat: add Cloud Run deploy workflow, remove SSH-based deploy"
```

---

### Task 5: One-time GCP setup (manual — not automated)

These are run once by the developer, not by CI. **The workflow will fail without this.**

**Step 1: Enable APIs**

```bash
export PROJECT_ID="your-gcp-project-id"

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

**Step 2: Create Artifact Registry repo**

```bash
gcloud artifacts repositories create asciicker-xpedit \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker images for xpedit workbench"
```

**Step 3: Create service account for GitHub Actions**

```bash
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions Deploy"

SA_EMAIL="github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant roles
for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE"
done

# Create key
gcloud iam service-accounts keys create /tmp/github-deploy-key.json \
  --iam-account="${SA_EMAIL}"

echo "Key saved to /tmp/github-deploy-key.json — add its contents to GitHub Secrets as GCP_SA_KEY"
```

**Step 4: (Optional) Create Secret Manager secret for bug report token**

Only needed if you want `BUG_REPORT_DELIVERY=github`:

```bash
echo -n "ghp_YOUR_GITHUB_PAT" | gcloud secrets create BUG_REPORT_GITHUB_TOKEN \
  --data-file=- \
  --replication-policy=automatic

# Grant the Cloud Run service account access
gcloud secrets add-iam-policy-binding BUG_REPORT_GITHUB_TOKEN \
  --member="serviceAccount:${PROJECT_ID}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

If you skip this, remove the `secrets:` and `BUG_REPORT_*` lines from the workflow.

**Step 5: Add GitHub Secrets**

Go to GitHub repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_SA_KEY` | Contents of `/tmp/github-deploy-key.json` |

**Step 6: Create GitHub Environment**

Go to GitHub repo → Settings → Environments → New environment → name it `production`.

**Step 7: Test the first deploy**

Go to GitHub repo → Actions → "Deploy to Cloud Run" → Run workflow → use default `master`.

Expected: all 3 jobs pass (build-and-push → deploy → smoke-test).
The Cloud Run service URL appears in the workflow summary.

**Step 8: Verify manually**

```bash
# Replace with actual Cloud Run URL from step 7
./scripts/deploy/smoke_test.sh https://asciicker-xpedit-abc123-uc.a.run.app /xpedit
```

Expected: all checks PASS (including stateful upload)

---

## Phase 2: Custom Domain Routing (`rikiworld.com/xpedit`)

### Task 6: Create Cloudflare Worker for path-based routing

**Context:** `rikiworld.com` currently points to GitHub Pages (serves the asciicker-Y9-2 game). We need `/xpedit/*` to go to Cloud Run while everything else stays on GitHub Pages. A Cloudflare Worker does this — matching the pattern from `deploy-multiplayer.yml`.

**Files:**
- Create: `deploy/cloudflare-worker/xpedit-router.js`
- Create: `deploy/cloudflare-worker/wrangler.toml`

**Step 1: Write the Worker**

`deploy/cloudflare-worker/xpedit-router.js`:

```javascript
/**
 * Cloudflare Worker: routes /xpedit/* to Cloud Run, everything else passes through.
 *
 * Environment variable CLOUD_RUN_URL must be set in wrangler.toml or CF dashboard.
 * Example: https://asciicker-xpedit-abc123-uc.a.run.app
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/xpedit' || url.pathname.startsWith('/xpedit/')) {
      const target = new URL(url.pathname + url.search, env.CLOUD_RUN_URL);

      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Host', url.hostname);
      headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      return fetch(target.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'follow',
      });
    }

    // Everything else: pass through to origin (GitHub Pages)
    return fetch(request);
  },
};
```

**Step 2: Write wrangler.toml**

`deploy/cloudflare-worker/wrangler.toml`:

```toml
name = "xpedit-router"
main = "xpedit-router.js"
compatibility_date = "2024-01-01"

[vars]
# Replace with your actual Cloud Run service URL after first deploy
CLOUD_RUN_URL = "https://asciicker-xpedit-CHANGEME.a.run.app"

# Route configuration — set in Cloudflare Dashboard → Workers Routes:
#   rikiworld.com/xpedit/*  →  xpedit-router
```

**Step 3: Deploy the Worker**

```bash
cd deploy/cloudflare-worker
npx wrangler deploy
```

**Step 4: Configure the route in Cloudflare Dashboard**

1. Cloudflare Dashboard → your zone (`rikiworld.com`) → Workers Routes
2. Add route: `rikiworld.com/xpedit/*` → `xpedit-router`

**Step 5: Commit**

```bash
git add deploy/cloudflare-worker/
git commit -m "feat: add Cloudflare Worker for rikiworld.com/xpedit routing"
```

---

### Task 7: End-to-end verification

**Step 1: Smoke test via Cloud Run URL directly**

```bash
./scripts/deploy/smoke_test.sh https://asciicker-xpedit-ACTUAL.a.run.app /xpedit
```

Expected: all checks PASS

**Step 2: Smoke test via rikiworld.com**

```bash
./scripts/deploy/smoke_test.sh https://rikiworld.com /xpedit
```

Expected: all checks PASS

**Step 3: Verify GitHub Pages is unaffected**

```bash
curl -s -o /dev/null -w '%{http_code}' https://rikiworld.com/asciicker-Y9-2/
```

Expected: `200`

**Step 4: Open in browser**

Visit `https://rikiworld.com/xpedit/workbench` — workbench should load and function.

---

## Phase 3: Doc Alignment

### Task 8: Update all docs that reference the MVP deployment path

The repo has three files that describe how/where the MVP is deployed. All three must be updated to reflect Cloud Run as the primary path, with VPS/nginx/systemd retained as documented alternatives.

**Files:**
- Modify: `docs/INDEX.md` (lines 168-173 — stale "deploy-to-server automation is the main remaining gap" text)
- Modify: `docs/plans/2026-03-23-workbench-canonical-spec.md` (deployment/hosting section — canonical authority doc)
- Modify: `CLAUDE.md` (Current High-Signal Truths — short-lived repo memory, not canonical authority)

**Step 1: Update `docs/INDEX.md` deployment summary**

Replace the deployment summary block (lines ~168-175) with:

```markdown
Summary:
- MVP is server-backed Flask, not static GitHub Pages
- committed runtime payload under `runtime/termpp-skin-lab-static` is part of the deployable product
- `/xpedit` subpath hosting is implemented and proven; MVP deploys to Google Cloud Run at `rikiworld.com/xpedit` via Cloudflare Worker routing
- GitHub Actions `deploy-cloudrun.yml` handles build → push → deploy → smoke test
- VPS/nginx/systemd configs remain in `deploy/` as documented alternatives
- The runtime payload must remain committed inside this repo. Do not reintroduce any dependency on external runtime folders.
- For the first manual MVP launch, verifier scripts are offline QA tools, not required production-host dependencies.
```

**Step 2: Update the canonical spec's deployment section**

In `docs/plans/2026-03-23-workbench-canonical-spec.md`, find the deployment/hosting section and update to state that Cloud Run is the MVP deploy target. Keep VPS/nginx/systemd as documented alternatives for self-hosted deployments. Reference `docs/plans/2026-03-24-mvp-deploy-cloud-run.md` for the full deploy plan.

**Step 3: Add deploy status to CLAUDE.md**

Under `## Current High-Signal Truths`, add:

```
- MVP deployment targets Google Cloud Run (single instance, ephemeral storage). Deploy via GitHub Actions `deploy-cloudrun.yml`. Custom domain routing via Cloudflare Worker at `rikiworld.com/xpedit/*`. See `docs/plans/2026-03-24-mvp-deploy-cloud-run.md`.
```

**Step 4: Commit**

```bash
git add docs/INDEX.md docs/plans/2026-03-23-workbench-canonical-spec.md CLAUDE.md
git commit -m "docs: update INDEX, canonical spec, and CLAUDE.md for Cloud Run MVP deploy path"
```

---

## Required Secrets Summary

### GitHub Actions Secrets

| Secret | Source | Purpose |
|--------|--------|---------|
| `GCP_PROJECT_ID` | GCP Console | Identifies the GCP project |
| `GCP_SA_KEY` | `gcloud iam service-accounts keys create` | Service account JSON key |

### Cloudflare (already configured from multiplayer deploy)

| Secret | Source | Purpose |
|--------|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard | Deploy Worker (already in repo secrets) |

### GCP Secret Manager (optional, for bug report delivery)

| Secret | Source | Purpose |
|--------|--------|---------|
| `BUG_REPORT_GITHUB_TOKEN` | GitHub PAT with `issues:write` | Post bug reports as GitHub Issues |

### Cloud Run Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `PIPELINE_BASE_PATH` | `/xpedit` | URL prefix for all routes |
| `PIPELINE_HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8080` (set by Cloud Run) | Gunicorn bind port |
| `BUG_REPORT_DELIVERY` | `github` | Route bug reports to Issues, not ephemeral disk |
| `BUG_REPORT_GITHUB_REPO` | `rikiyanai/asciicker-pipeline-v2` | Target repo for bug report Issues |

---

## Cost Estimate (Free Tier)

| Resource | Free Allowance | Expected MVP Usage |
|----------|---------------|-------------------|
| Cloud Run CPU | 180,000 vCPU-seconds/month | ~1,000 (scales to zero) |
| Cloud Run Memory | 360,000 GB-seconds/month | ~2,000 |
| Cloud Run Requests | 2,000,000/month | ~hundreds |
| Artifact Registry | 500 MB storage | ~200 MB (one image) |
| Cloudflare Worker | 100,000 requests/day | ~hundreds |
| **Total** | | **$0/month at MVP scale** |

---

## Rollback

```bash
# List revisions
gcloud run revisions list --service=asciicker-xpedit --region=us-central1

# Roll back to previous revision
gcloud run services update-traffic asciicker-xpedit \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1
```

---

## Architecture Diagram

```
Browser → rikiworld.com
           │
    Cloudflare DNS/CDN
           │
    Cloudflare Worker (xpedit-router)
           │
    ┌──────┴──────┐
    │             │
 /xpedit/*    everything else
    │             │
 Cloud Run    GitHub Pages
 (1 instance) (static WASM game)
    │
 gunicorn (1w/4t) → wsgi.py → Flask
    │
 /xpedit/healthz          ← stateless
 /xpedit/workbench        ← serves HTML
 /xpedit/api/*            ← stateful (ephemeral)
 /xpedit/termpp-web-flat/* ← static runtime assets
    │
 data/ (ephemeral filesystem)
 ├── uploads/   sessions/   exports/
 └── bundles/   bug_reports/ (→ GitHub Issues)
```
