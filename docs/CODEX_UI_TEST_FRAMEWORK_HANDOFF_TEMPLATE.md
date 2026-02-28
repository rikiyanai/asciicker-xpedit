# Codex UI Testing Framework Handoff (General Template)

Use this handoff when you want another **Codex agent** to implement a reusable browser UI testing framework in a new repository.

## Objective
Implement a robust, scalable, parallel-friendly web UI testing framework using a **4-layer agentic architecture** that is reusable across repositories.

Required capabilities:
- Fast smoke tests
- End-to-end user-story tests
- Parallel execution of independent flows
- Headless CI execution
- Local debug/headed mode
- Screenshot-based action trail (visual trail) for reasoning/debugging

## Codex-Specific Adaptation (Important)
This handoff is **Codex-native**, not Gemini-specific.

- Do **not** depend on `.gemini/commands` or Gemini extension mechanisms.
- Layer 3 orchestration should be implemented as a **repo-local CLI runner** (for example `scripts/ui_tests/runner/cli.mjs`) plus a `justfile`.
- Commands should map to `test:smoke`, `test:e2e`, `test:parallel` style subcommands.

## 4-Layer Architecture

### Layer 1: Skills / Core Browser Capabilities
Create a reusable browser automation module that exposes composable actions:
- `open_url`
- `click`
- `type`
- `press_key`
- `wait_for`
- `screenshot`
- `read_page_state` (URL/title/visible text summary)

Requirements:
- Capture screenshots after meaningful actions or step boundaries
- Log action intent, result, and screenshot path
- Prefer semantic locators (role/text/label/placeholder) before brittle selectors
- Support headless default and headed/debug mode

### Layer 2: Subagents (User-Story Workers)
Implement reusable subagents that act like users and consume the visual trail.
Examples (adapt to repo):
- `AuthAgent`
- `NavigationAgent`
- `CrudAgent`
- `CheckoutAgent`
- repo-specific workflow agents

Each subagent should return structured results:
- `pass` / `fail`
- `steps_run`
- `artifacts`
- `error_summary`
- optional domain-specific debug payloads

### Layer 3: Codex Orchestration Commands (CLI)
Implement a repo-local CLI runner exposing at least:
- `test:smoke`
- `test:e2e --feature <name>`
- `test:parallel`

Requirements:
- Print artifact directory paths
- Accept flags: `--base-url`, `--headed`/`--debug`, `--timeout-sec`
- Summarize failures with first failing step + artifact location
- Parallel runs must isolate browser contexts and artifact subfolders

### Layer 4: Task Runner (`justfile`)
Provide root `justfile` recipes:
- `install-testing-deps`
- `test-smoke`
- `test-e2e feature=<name>`
- `test-parallel`
- `test-debug feature=<name>`
- optional: `dev`, `dev-and-test-smoke`, `clean-test-artifacts`

Requirements:
- Prefer local dependencies over global installs
- Recipes should be rerunnable and composable
- Artifacts go to predictable path (e.g. `artifacts/ui-tests/`)

## Execution Directive (Mandatory Phases)

### Phase 1: Repository Discovery
1. Environment Audit
   - detect `node/npm/pnpm/yarn`, `just`, Playwright availability
   - detect existing browser test tooling
2. App Startup Discovery
   - identify local startup command(s)
   - identify base URL and required env vars
3. User Journey Mapping
   - inspect docs/tests/routes/UI specs
   - prioritize a smoke path and one meaningful E2E flow
4. Auth / Session Discovery
   - identify auth/session model (or no auth)
   - document simplest test-safe path
5. Risk Notes
   - record blockers/unknowns (CAPTCHA, SSO, flaky loaders, background jobs, etc.)

Deliverable for Phase 1:
- a short discovery note (repo-specific) checked into docs or artifact summary

### Phase 2: Framework Scaffold
Implement Layer 1 core utilities, then Layer 2 subagents, then Layer 3 CLI, then Layer 4 `justfile`.

### Phase 3: Repo-Specific Flows
Add at least:
- one `smoke` flow
- one `e2e` feature flow
- one `parallel` demo using independent flows

### Phase 4: Validation
Run:
- smoke
- one e2e feature
- parallel demo

Produce artifacts with screenshots + JSON summary and report exact paths.

## Output Expectations for Codex Agent
The agent should return:
1. What it implemented (files and layers)
2. How to run smoke/e2e/parallel/debug
3. Artifact location conventions
4. Discovery notes (repo-specific)
5. Known limitations / next steps

## Suggested Implementation Stack (Default)
- Playwright runtime (`playwright` package) via local dependency
- Node-based CLI runner (`.mjs`)
- `justfile` for tasks
- JSON + JSONL artifact logs
- PNG screenshots for visual trail

## Quality Bar
- Headless runs work without manual intervention
- Headed/debug mode supported
- Parallel flows use isolated contexts/artifact dirs
- Failures include actionable artifact pointers
- No hardcoded app assumptions before discovery
