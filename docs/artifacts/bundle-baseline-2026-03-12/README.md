# Bundle Baseline 2026-03-12

Canonical promoted baseline for the Workbench bundle/runtime path.

## Branch / Commit

- verified branch: `integrate/mcp-restore-baseline-20260312`
- verified commit: `4054dcf`
- promoted branch: `master`
- promoted commit: `2f413ee`

## Included Evidence

- `workbench-ui-recording-2026-03-11T13-27-24-653Z.json`
  - saved manual recording from the known-good restore baseline
- `integrate-watchdog-result.json`
  - headed watchdog result from `integrate/mcp-restore-baseline-20260312`
- `integrate-watchdog-ui-recorder.json`
  - UI recorder capture from the integration watchdog run
- `workbench-bundle-baseline.gif`
  - screen recording rendered to GIF for the repo README

## Canonical Recorded Order

1. `Attack`
2. `Death`
3. `Idle / Walk`
4. `Test Bundle Skin`

## Verified Outcomes

- `Bundle: 3/3 actions converted`
- `Applied bundle skin`
- self-contained original-game runtime payload loaded from `runtime/termpp-skin-lab-static`
- manual live check after recorded clickthrough:
  - equipped/attacked/died in runtime
  - uploaded attack/death/idle bundle animations played distinctly in live use

## Scope

This baseline is canonical for:

- Workbench bundle/runtime baseline
- self-contained runtime assets
- uploaded 3-action bundle playback

It is not a claim that the standalone XP editor is fully wired into the live workbench UI.
