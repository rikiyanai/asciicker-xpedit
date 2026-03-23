# Launch Readiness Checklist

Date: 2026-03-22

All gates must be green before the MVP is considered launch-ready.
This checklist is the single source of truth for launch/no-launch decisions.

## Gate 1: Milestone 1 Green

- [ ] Manual runtime review confirms bundle loads and renders correctly
- [ ] Save/export/test authoring loop works end-to-end without workarounds
- [ ] Milestone 1 closeout recorded in `docs/INDEX.md`
- [ ] Manual MVP launch does not depend on verifier scripts being present on the host
- [ ] A visible in-product pre-alpha bug-report path exists and captures enough context to make user reports actionable

**Current status:** M1 formally CLOSED on canonical root-hosted workbench (2026-03-23, commit `14e8e95`). Edge-workflow verifier 7/7 PASS. Fixes: EV-001 (bundle gating), EV-002 (blank-save), EV-003 (tab-switch race). Base-path clean. Canvas-edge mismatches classified non-blocking. Manual runtime confirmation still needed before launch.

## Gate 2: Deploy Package Builds

- [ ] `deploy-package` workflow runs successfully (manual dispatch)
- [ ] Artifact downloads and extracts cleanly
- [ ] `pip install -e ".[deploy]"` succeeds from the extracted package

**Current status:** Workflow exists (`.github/workflows/deploy-package.yml`), not yet run.

## Gate 3: Runtime Assets Present

- [ ] `runtime/termpp-skin-lab-static/termpp-web-flat/index.html` exists
- [ ] `runtime/termpp-skin-lab-static/termpp-web-flat/index.wasm` exists
- [ ] `runtime/termpp-skin-lab-static/termpp-web-flat/index.data` exists
- [ ] `runtime/termpp-skin-lab-static/termpp-web-flat/flat_map_bootstrap.js` exists
- [ ] At least one `.a3d` map file exists in `termpp-web-flat/flatmaps/`

**Current status:** Assets committed in repo. Verify with `GET /api/workbench/runtime-preflight`.

## Gate 4: Reverse Proxy Configured

- [ ] Domain/subdomain DNS resolves to host
- [ ] TLS certificate provisioned (Caddy auto or Nginx+certbot)
- [ ] Reverse proxy forwards to Flask on 127.0.0.1:5071
- [ ] `curl https://<domain>/healthz` returns `ok`

**Current status:** Template configs exist in `deploy/`. Host not yet provisioned.

## Gate 5: Health Endpoint Reachable

- [ ] `GET /healthz` returns `200 ok` from the running server
- [ ] Response time under 100ms (no heavy logic in healthz)
- [ ] Health check works through the reverse proxy

**Current status:** `/healthz` endpoint exists in `app.py`. Returns plain `200 ok`, no dependencies.

## Gate 6: Rollback Documented and Tested

- [ ] Rollback command documented in `docs/HOST_DEPLOYMENT_CHECKLIST.md`
- [ ] `systemctl stop` + `git checkout <prev>` + `systemctl start` tested
- [ ] Previous known-good commit identified before each deploy

**Current status:** Rollback command documented. Not yet tested on a live host.

## Gate 7: CI Passes (or failures triaged)

- [ ] `.github/workflows/ci.yml` runs on the deploy commit
- [ ] All failures are either fixed or explicitly triaged as non-blocking
- [ ] No new regressions introduced by deployment scaffolding

**Current status:** CI exists. Pre-existing test failures in `test_analyze_run_compat` and `test_contracts` are known and predate deployment work.

## Launch Decision

| Gate | Status | Blocking? |
|------|--------|-----------|
| M1 Green | Pending | Yes |
| Deploy Package Builds | Not run | Yes |
| Runtime Assets | Present | No |
| Reverse Proxy | Not configured | Yes |
| Health Endpoint | Exists | No |
| Rollback | Documented | No |
| CI | Known failures | Triage needed |

**Current verdict: NOT READY** — blocked on M1 acceptance rerun and host provisioning.

## Scope note

For the first MVP launch, this checklist is about the deployable product and manual Milestone 1 operation.
Verifier scripts are development QA tools and are not required on the deployed host.
