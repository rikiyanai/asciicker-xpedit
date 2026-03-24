# Deployment

Production deployment configs for the asciicker XP editor workbench.

See `docs/WORKBENCH_DOCS_ARCHIVE.md#mvp-deployment` for the canonical deployment posture and constraints.

## Quick start

```sh
# 1. Clone and install
git clone <repo-url> /opt/asciicker-pipeline-v2
cd /opt/asciicker-pipeline-v2
python3 -m venv venv
source venv/bin/activate
pip install -e ".[deploy]"

# 2. Configure
cp deploy/.env.example .env
# Edit .env: set PIPELINE_HOST, PIPELINE_PORT, GUNICORN_WORKERS

# 3. Run
./scripts/deploy/launch_prod.sh
```

## Files

| File | Purpose |
|------|---------|
| `.env.example` | Template environment config |
| `Caddyfile` | Caddy reverse proxy config |
| `nginx.conf` | Nginx reverse proxy config |
| `systemd/asciicker-xpedit.service` | Systemd service unit |

## Reverse proxy

Choose one:

- **Caddy** (recommended for simplicity): `caddy run --config deploy/Caddyfile`
- **Nginx**: symlink `deploy/nginx.conf` into `/etc/nginx/sites-enabled/`

Both configs show two modes:

- **Mode A (root/subdomain):** The app owns the entire domain. Set `PIPELINE_BASE_PATH=` (empty).
- **Mode B (subpath):** The app lives under a prefix like `/xpedit`. Set `PIPELINE_BASE_PATH=/xpedit` in `.env`.

The domain names are placeholders — replace with your actual domain.

## Systemd

```sh
sudo cp deploy/systemd/asciicker-xpedit.service /etc/systemd/system/
# Edit paths in the unit file if not using /opt/asciicker-pipeline-v2
sudo systemctl daemon-reload
sudo systemctl enable --now asciicker-xpedit
```

## Runtime payload

The `runtime/termpp-skin-lab-static/` directory must be present. It is committed in the repo and should not be excluded or downloaded separately.
