# Host Deployment Checklist

Date: 2026-03-22

Pre-deploy checklist for provisioning and configuring the actual host. Fill in values before deployment.

## Decisions Required

| Decision | Value | Notes |
|----------|-------|-------|
| Target host | ________________ | VPS, cloud VM, container, etc. |
| Domain/subdomain | ________________ | e.g., `xpedit.rikiworld.com` |
| Reverse proxy | Caddy / Nginx | Templates in `deploy/` |
| TLS | Let's Encrypt / manual / none | Caddy auto-provisions; Nginx needs certbot or manual |
| OS | ________________ | Ubuntu 22.04+ recommended for systemd |
| Python version | 3.11+ | Required by pyproject.toml |
| Process manager | systemd / supervisor / docker | Template in `deploy/systemd/` |
| Hosting shape | subdomain / reverse-proxied root / subpath | Subpath requires extra work; see `docs/BASE_PATH_SUPPORT_CHECKLIST.md` |

## Host Setup Steps

### 1. Provision host

- [ ] Server accessible via SSH
- [ ] Python 3.11+ installed
- [ ] Git installed
- [ ] Reverse proxy installed (Caddy or Nginx)

### 2. Clone and install

```sh
git clone <repo-url> /opt/asciicker-pipeline-v2
cd /opt/asciicker-pipeline-v2
python3 -m venv venv
source venv/bin/activate
pip install -e ".[deploy]"
```

### 3. Configure environment

```sh
cp deploy/.env.example .env
```

Fill in `.env`:

| Variable | Production value | Default |
|----------|-----------------|---------|
| `PIPELINE_HOST` | `0.0.0.0` | `127.0.0.1` |
| `PIPELINE_PORT` | `5071` | `5071` |
| `PIPELINE_DEBUG` | `false` | `false` |
| `GUNICORN_WORKERS` | `2*cores+1` | `3` |
| `APP_DIR` | `/opt/asciicker-pipeline-v2` | — |

### 4. Verify runtime payload

```sh
ls runtime/termpp-skin-lab-static/termpp-web-flat/index.html
ls runtime/termpp-skin-lab-static/termpp-web-flat/index.wasm
ls runtime/termpp-skin-lab-static/termpp-web-flat/index.data
```

All three must exist. If missing, the clone is incomplete.

### 5. Install systemd service

```sh
sudo cp deploy/systemd/asciicker-xpedit.service /etc/systemd/system/
# Edit paths if not using /opt/asciicker-pipeline-v2
sudo systemctl daemon-reload
sudo systemctl enable --now asciicker-xpedit
sudo systemctl status asciicker-xpedit
```

### 6. Configure reverse proxy

**Caddy:**
```sh
# Edit deploy/Caddyfile: replace xpedit.example.com
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Nginx:**
```sh
# Edit deploy/nginx.conf: replace xpedit.example.com
sudo cp deploy/nginx.conf /etc/nginx/sites-available/asciicker-xpedit
sudo ln -s /etc/nginx/sites-available/asciicker-xpedit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. Verify

```sh
# Direct health check
curl http://127.0.0.1:5071/healthz
# Should return: ok

# Through reverse proxy
curl https://xpedit.example.com/healthz
# Should return: ok

# Workbench loads
curl -s -o /dev/null -w "%{http_code}" https://xpedit.example.com/workbench
# Should return: 200
```

For manual MVP operation, no verifier scripts are required on the host. The required host checks are:

- workbench loads
- save/export/test flows work
- runtime preflight is healthy
- manual Milestone 1 workflow succeeds

### 8. Rollback command

```sh
# Stop service
sudo systemctl stop asciicker-xpedit

# Roll back to previous commit
cd /opt/asciicker-pipeline-v2
git log --oneline -5  # find the good commit
git checkout <commit>

# Restart
sudo systemctl start asciicker-xpedit
```

## Post-Deploy Monitoring

- Health probe: `GET /healthz` → 200
- Workbench smoke: `GET /workbench` → 200
- Runtime preflight: `GET /api/workbench/runtime-preflight` → JSON with `ok: true`
- Logs: `journalctl -u asciicker-xpedit -f`
