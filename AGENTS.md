# Agent Entry Point
Follow this repository rule before doing any task.

<!-- codex-conductor:start -->
## Conductor Guardrail
Always run `conductor:status` first.

- Command alias: `conductor_status`
- Direct command: `python3 scripts/conductor_tools.py status --auto-setup`
- Behavior: if Conductor is missing, status runs setup and creates the baseline.

## Self-Containment Guardrail
Always run the self-containment audit immediately after conductor status.

- Direct command: `python3 scripts/self_containment_audit.py`
- Install hooks: `bash scripts/install_self_containment_hooks.sh`
- Hard rule: this repo must not reference, symlink, or depend on folders outside `/Users/r/Downloads/asciicker-pipeline-v2` for live code, runtime, tests, or build steps.
<!-- codex-conductor:end -->
