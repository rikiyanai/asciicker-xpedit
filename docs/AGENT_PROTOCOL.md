# Agent Protocol

## Purpose

This repo has multiple branches, worktrees, runtime bundles, and historical handoff docs. Agents must not improvise from memory or from other repositories.

This protocol defines the minimum required startup, debugging, and handoff behavior for Claude/Codex/other agents working in this repository.

---

## 1. Mandatory Startup

Before doing any debugging, testing, restore work, or merge planning, the agent must report:

1. current branch name
2. current `HEAD` commit
3. current working tree path
4. whether this branch is:
   - `canonical`
   - `experimental`
   - `restore`
   - `stale/unknown`

If the branch role is unknown, the agent must stop making fix claims and audit branch reality first.

---

## 2. Canonical Sources

Use sources in this order:

1. `AGENTS.md`
2. [docs/INDEX.md](/Users/r/Downloads/asciicker-pipeline-v2/docs/INDEX.md)
3. this file
4. `CLAUDE.md`
5. current live branch/worktree state
6. latest task-relevant handoff
7. focused bug handoff docs such as:
   - `docs/WORKBENCH_IFRAME_KEYBOARD_STUCK_HANDOFF.md`
   - `docs/CLAUDE_RESEARCH_DUMP_WORKBENCH_MOVE_FREEZE_2026-02-27.md`
   - relevant docs under `docs/plans/`

Old summary docs are supporting evidence, not branch truth.

---

## 3. Cross-Repo Isolation

Agents must not:

- import code or tools from a different repo path unless the user explicitly asked for that
- run Playwright from another checkout
- read fixtures from another repo to "make the current repo work"
- treat another repo's `node_modules`, scripts, or runtime assets as canonical for this repo

Concrete example of forbidden behavior:

- writing `/tmp/headed-test.mjs` that imports Playwright from `/Users/r/Downloads/asciicker-Y9-2/node_modules/playwright/index.js`

If a required dependency is missing in this repo, the agent must say so explicitly.

---

## 4. Test Script Policy

Agents must prefer existing runners before creating new scripts.

Before writing any new test script, the agent must check for existing relevant runners in:

- `scripts/`
- `tests/`
- `docs/` handoff instructions

If a new script is still required:

- it must live in the repo, not silently in `/tmp`
- it must state its purpose at the top
- it must not become the new "truth" unless the user approves

One-off throwaway scripts are a last resort, not the default workflow.

---

## 5. Background Process Policy

Agents must not launch unattended background processes without explicitly stating:

1. what process was started
2. why it is needed
3. how to stop it
4. which branch/worktree it belongs to

Forbidden default behavior:

- `node some-script.mjs &`
- server starts that are not tied to a stated branch and port owner

Preferred behavior:

- foreground command
- or a clearly announced background server with stop instructions

---

## 6. Branch Truth Before Debugging

For any bug involving "restore", "regression", "why did this stop working", or "bundle fix version", the agent must determine:

1. which branch the user is currently running
2. which branch contains the known-good restore line
3. whether those are the same branch
4. whether the runtime bundle in use matches the expected branch

If the known-good restore line is on another branch, the agent must say that plainly before suggesting file-level fixes.

### Canonical Bundle Checkpoint

For the current Workbench bundle checkpoint, the canonical evidence is:

- branch/worktree: main worktree `/Users/r/Downloads/asciicker-pipeline-v2` on `restore/bundle-override-filter-8279e11`
- committed base: `89b7d0616853276043cccd6130b1463700742c7d`
- required dirty baseline delta:
  - `web/workbench.html`
  - `web/workbench.js`
  - `scripts/workbench_bundle_manual_watchdog.mjs`
- saved manual recording: `/Users/r/Downloads/workbench-ui-recording-2026-03-11T13-27-24-653Z.json`
- fresh headed verification artifact: [result.json](/Users/r/Downloads/asciicker-pipeline-v2/output/playwright/workbench-headed-replay-2026-03-12T13-56-16-164Z/result.json)

The canonical action order is:

1. `Attack`
2. `Death`
3. `Idle / Walk`
4. `Test Bundle Skin`

The checkpoint is only considered matched when the workbench reaches `Bundle: 3/3 actions converted` and `Applied bundle skin`.

---

## 7. Runtime / Asset Bugs

For Workbench skin-dock, flat-arena, runtime, or map issues, agents must distinguish between:

- UI logic bug
- runtime bundle mismatch
- flatmap/bootstrap mismatch
- gameplay/world freeze after runtime entry

Agents must not collapse all of these into "the iframe is broken" or "the test dock is missing."

When the user says:

- "world is wrong"
- "bundle fix version"
- "freeze after move"

the agent must inspect runtime bundle and flatmap/bootstrap state first.

---

## 8. Claim Discipline

Agents must not say:

- "fixed"
- "restored"
- "working"
- "same as known-good version"

without attaching:

1. branch name
2. commit hash
3. verification command or artifact

If any of those are missing, the claim must be downgraded to:

- "suspected"
- "partially restored"
- "not yet verified"

---

## 9. Merge / Restore Rules

Agents must not write merge plans or restore advice based on local `master` alone.

They must check:

- current branch
- `origin/master`
- active worktrees
- whether the restore branch was actually merged

If a restore happened on a side branch and was never merged back, the agent must treat that as the main finding.

---

## 10. Session-End Requirements

At the end of any substantial session, the agent must leave one handoff containing:

- branch
- `HEAD`
- what changed
- what was tested
- what was not tested
- known blockers
- exact next command

If no handoff was updated, the session is incomplete.

---

## 11. First Read For Current Repo State

Start with the canonical hub and then pick the task-specific handoff:

- [docs/INDEX.md](/Users/r/Downloads/asciicker-pipeline-v2/docs/INDEX.md)

For editor/doc status work on audited `master`, read:

- [2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md](/Users/r/Downloads/asciicker-pipeline-v2/docs/2026-03-13-CLAUDE-HANDOFF-EDITOR-DOC-ALIGNMENT.md)
- [2026-03-13 claim verification](/Users/r/Downloads/asciicker-pipeline-v2/docs/research/ascii/2026-03-13-claim-verification.md)

For the branch confusion and restore/bundle history, read:

- [2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md](/Users/r/Downloads/asciicker-pipeline-v2/docs/2026-03-11-CLAUDE-HANDOFF-CURRENT-STATE.md#L1)

That older handoff explains:

- why `feat/workbench-mcp-server` is not the full restore line
- why `restore/bundle-override-filter-8279e11` matters
- which commits changed runtime truth
- what not to do next

---

## 12. Decision Rule

If the agent has not identified the exact branch/runtime baseline, it is not ready to fix the bug.
