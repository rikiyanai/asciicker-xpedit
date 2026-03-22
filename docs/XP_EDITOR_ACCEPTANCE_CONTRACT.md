# XP Editor Acceptance Contract

Date: 2026-03-15
Status: active

This file is the canonical acceptance contract for XP-editor parity work.

If any code, plan, handoff, harness, or status report conflicts with this file, this file wins.

## Goal

The goal is full XP-editor parity for the shipped workbench.

"Done" means:

- the workbench can create new XP files with the intended structure
- the workbench can load existing XP files with their real structure
- the workbench can edit those XP files through shipped controls
- the primary editor surface is a whole-sheet XP editor aligned with the REXPaint interaction model, not a legacy frame-by-frame inspector used as a substitute for that model
- the workbench can export XP without structural corruption
- the exported XP works in the Skin Dock/runtime
- the end-to-end result passes through full UI-driven product workflows, not only artifact comparison

This is not a speed goal. This is not a partial-proof goal. This is a hard-fail fidelity goal.

## Milestone 1 vs Full Goal

The overall goal above remains the source of truth.

However, the current working milestone is narrower:

- **Milestone 1** = shipped bundle-native new-XP authoring viability for the required
  native action bundle:
  - `idle`
  - `attack`
  - `death`

Milestone 1 requires:

- whole-sheet editing through shipped controls
- correct structure/layer preservation for the bundle-native workflow
- successful Skin Dock/runtime application
- real-content final signoff through the canonical verifier family
- acceptable responsiveness and repeatability for this workflow

Milestone 1 does **not** by itself mean:

- complete existing-XP load/edit/export parity
- full general-purpose REXPaint feature parity
- closure of every editor capability outside the required bundle-native workflow

Do not report Milestone 1 as "full XP parity."

## Explicit Milestone Requirements

### Milestone 1 close requirements

Milestone 1 may be reported complete only when all of the following are true:

- the shipped whole-sheet authoring path covers the required native bundle actions:
  - `idle`
  - `attack`
  - `death`
- structure, layer behavior, export, and runtime load all pass for that workflow
- the canonical verifier passes in a Milestone 1 acceptance-eligible mode, with final signoff coming from `full_recreation`
- save/export/test behavior is usable enough to support a normal authoring loop
- users are not forced through export/download just to mark bundle progress or move to the next required action
- responsiveness and repeatability are good enough that the workflow is not merely a one-off proof

Current 2026-03-21 implementation status:

- the save-first workflow is now implemented in the product path:
  - top-level `Save`
  - `blank` / `saved` / `converted`
  - bundle readiness on `saved|converted`
- the latest remaining verifier/editor interaction fix is now implemented in the verifier path as a narrow canvas-targeting change
- Milestone 1 is still open until those landed changes are verified by a clean `full_recreation` pass, repeatability rerun(s), and final manual/runtime review

### Milestone 2 requirements

Milestone 2 starts only after Milestone 1 closes.

Milestone 2 is the practical PNG-ingest/manual-assembly milestone. It requires:

- preserving the arbitrary-PNG structural bundle baseline established in Milestone 1
- preserving the committed in-repo runtime payload needed for structural/runtime-safe PNG bundle injection
- shipped source-panel bbox extraction and source-to-grid assembly as the practical PNG workflow
- whole-sheet editing as the primary correction surface
- human-verified semantic dictionaries for canonical sprite families
- semantic edits building on those dictionaries, not on naive global color replacement or heroic analyze guesses

Milestone 2 does **not** require perfect automatic slicing.

## Deployment Constraint

Deployment is not itself a parity gate, but MVP launch claims must respect current product shape:

- the workbench is currently a Flask-served app with live `/api/workbench/*` routes
- runtime assets are served from committed repo paths under `runtime/termpp-skin-lab-static`
- current frontend paths are root-relative, not base-path-aware

Therefore, until explicitly changed:

- do not represent the workbench as ready for pure static GitHub Pages hosting
- do not assume subpath hosting like `/XPEdit` works without proxy/base-path work
- if an MVP must go live quickly, prefer a server deployment behind a reverse proxy

## UI Reskin Constraint

During Milestone 1 closeout and early MVP deployment:

- look-only reskin work is acceptable
- behavior-changing UI rewrites are not

Allowed:

- fonts
- CSS variables
- colors
- spacing
- borders
- typography

Not allowed as a "reskin":

- replacing the app shell with an external web template
- changing DOM ids or control wiring
- changing product workflows while claiming it is cosmetic only

## Two Required Workflow Families

Both workflow families are required. Neither may be substituted for the other.

### 1. New XP Authoring

The product must support creating a new XP from scratch with the intended:

- dimensions
- angles
- animation/frame layout
- projections
- layer structure

The resulting session must reflect that intended structure in the live workbench UI and in export.

Required acceptance scenario:

- from a new file, recreate the required three sprite animations for the bundle:
  - idle
  - attack
  - death
- do so through user-reachable UI controls
- export correctly
- pass Test Skin Dock/runtime

### 2. Existing XP Load/Edit/Export

The product must support loading an existing XP through the real product path, preserving:

- dimensions
- angles
- animation/frame layout
- projections
- all layers
- cell contents

Editing and export must not corrupt that structure.

Required acceptance scenario:

- import an existing blank single-layer XP file with a deliberately simple/wrong starting structure
- through user-reachable UI actions, change dimensions to the correct structure
- add the correct layers
- recreate each layer correctly
- produce the correct bundle XP result
- pass Test Skin Dock/runtime

## Non-Negotiable Hard-Fail Gates

Any mismatch below is a failure. Do not continue past a failed gate except to diagnose that exact failure.

### Gate A. Geometry and Metadata

Hard fail on any mismatch in:

- grid width/height
- angles
- anim counts / frame grouping
- projections
- frame grid shape
- frame width/height in chars
- layer count
- layer names if product-defined

### Gate B. Layer Fidelity

Hard fail on any mismatch in:

- missing layers
- extra layers
- wrong active/editable layer behavior
- wrong visible-layer behavior
- any layer being silently skipped

### Gate C. Cell Fidelity

Hard fail on any mismatch in:

- glyph
- fg color
- bg color
- cell position
- frame-local vs global mapping

### Gate D. UI Reachability

Hard fail if the claimed editor-path proof depends on:

- hidden state mutation
- fake geometry
- fake frame layout
- skipped layers
- synthetic shortcuts that bypass shipped controls
- substituting a frame-by-frame inspector workflow for the required whole-sheet editor workflow

Read-only instrumentation is allowed. State mutation shortcuts are not.

### Gate E. Export Fidelity

Hard fail if exported XP differs from the intended/new/oracle XP in metadata, layers, or cells.

### Gate F. Runtime Load

Hard fail if the exported XP or current edited session cannot load and behave in Skin Dock/runtime.

Artifact identity alone is not sufficient for acceptance. A workflow does not pass until
Skin Dock/runtime also passes.

### Gate G. Truthfulness of Reporting

Hard fail any claim, file name, or report that labels something as:

- fidelity
- parity
- acceptance
- verified
- PASS

unless it satisfies the full contract in this file.

## Forbidden Shortcuts

The following are forbidden in any artifact described as fidelity/parity/acceptance:

- flattening multi-frame XP into one sheet
- forcing geometry to `1,1,1`
- targeting only one layer while skipping others
- `skipped_layers` semantics
- skipping cells to make a result "close enough"
- treating a legacy frame-by-frame inspector as the parity target when the required editor model is whole-sheet REXPaint-style editing
- claiming new-file creation proves existing-file load fidelity
- claiming existing-file load proves new-file authoring fidelity
- reporting `PASS` with `SKIP` on a required gate

If a diagnostic tool uses one of these shortcuts, it must be named and described as diagnostic only.

## Naming Rules

Reserved words:

- fidelity
- parity
- acceptance
- verified

These words may be used only if the full contract is satisfied.

Diagnostic names must use terms like:

- diagnostic
- smoke
- probe
- regression_slice
- experiment

## Required Reporting Shape

Any future verifier must report at least:

- `new_xp_authoring_pass`
- `existing_xp_load_pass`
- `geometry_pass`
- `frame_layout_pass`
- `all_layers_pass`
- `cell_fidelity_pass`
- `export_pass`
- `skin_dock_pass`
- `overall_pass`

If the workflow under test is a bundle workflow, reporting must also distinguish bundle
coverage for:

- `idle_pass`
- `attack_pass`
- `death_pass`

`overall_pass` may be `true` only if every required gate for the workflow under test passes.

## Required Work Loop

The only acceptable loop is:

1. run the real workflow
2. hit a hard fail
3. classify the failure:
   - UI gap
   - backend gap
   - visual/render gap
   - export gap
   - runtime gap
   - harness/verification gap
4. fix that exact failure
5. rerun

Do not introduce a narrower substitute verifier just to get a pass signal.

## Verification Evidence Protocol

### Canonical Verifier Path

Acceptance evidence for XP-editor parity must come from the canonical recipe-driven verifier:

1. `scripts/xp_fidelity_test/truth_table.py` — ground truth extraction
2. `scripts/xp_fidelity_test/recipe_generator.py` — spec-constrained recipe of user-reachable actions
3. workflow runner:
   - `scripts/xp_fidelity_test/run_fidelity_test.mjs` for non-bundle/single-session workflows
   - `scripts/xp_fidelity_test/run_bundle_fidelity_test.mjs` and `scripts/xp_fidelity_test/run_bundle.sh`
     for bundle authoring workflows

No other script, manual test, browser-console probe, or ad hoc harness may be cited as
acceptance evidence.

### Ad Hoc Scripts Are Diagnostic Only

Ad hoc Playwright scripts, `page.evaluate()` mutations, `window.__wb_debug` calls, and
one-off test files are permitted for implementation diagnosis. They may NOT:

- be cited as acceptance evidence
- use reserved words (fidelity, parity, acceptance, verified, PASS) in their names or output
- substitute for the canonical verifier

### Verifier Inability Is a Verifier Bug

If the canonical verifier cannot express a required workflow (whole-sheet tool activation,
multi-layer editing, apply-mode toggling, etc.), that is a verifier failure. The correct
response is to fix the verifier, not to bypass it with an ad hoc script.

### Recipe Mode Enforcement

The recipe generator and test runners must distinguish acceptance-eligible modes from
diagnostic-only modes.

- **acceptance** (`--mode acceptance`): only user-reachable whole-sheet editor actions.
  Inspector-only and debug-only actions are refused. This mode is acceptance-eligible,
  but for Milestone 1 it is a bounded proof slice rather than the strongest final signoff.
- **full_recreation** (`--mode full_recreation`): whole-sheet, real-content recreation of
  all required Layer 2 cells. This is the strongest fidelity proof and the required final
  signoff lane for Milestone 1 bundle-native acceptance.
- **manual_review** (`--mode manual_review`): synthetic marker mode for headed visual QA.
  Diagnostic/manual only. Never acceptance evidence.
- **diagnostic** (`--mode diagnostic`): may include inspector or debug actions for
  implementation diagnosis. Results must be labeled diagnostic, not acceptance.

Running the verifier without `--mode` defaults to diagnostic mode. Acceptance claims
require an explicit acceptance-eligible mode (`acceptance` or `full_recreation`), and
Milestone 1 final signoff requires `full_recreation`, not `manual_review`.

## Current Repo Truth

As of 2026-03-20:

### Protocol requirements (now in effect)

- ad hoc scripts are diagnostic only — never acceptance evidence
- acceptance evidence must come from the canonical verifier path
- verifier inability to express a workflow is a verifier bug, not bypass permission
- recipe mode enforcement is required before any parity claim
- `manual_review` is synthetic/manual only
- `full_recreation` is the final real-content signoff lane for Milestone 1

### Implementation status

- the canonical verifier family exists at `scripts/xp_fidelity_test/`
- bundle workflow verification exists and is canonical for bundle-native authoring
- recipe generator supports `--mode acceptance`, `--mode full_recreation`,
  `--mode manual_review`, and `--mode diagnostic`
- `manual_review` is diagnostic only and must never be cited as fidelity evidence
- `full_recreation` exists specifically to avoid conflating sparse proof slices with final signoff
- the previous blank-flow single-frame harness was deleted because it violated this contract
- open gaps remain around responsiveness signoff, repeatability, and workflow completeness
  for save-first bundle authoring

### Bundle scope beyond Milestone 1

The current `player_native_full` template covers idle/attack/death (3 of the main player
workflow families).

Current repo truth:

- mounted families (`wolfie`, `wolack`) are not yet in the bundle template
- `player-nude` is not yet in the bundle template
- current server-side bundle payload generation does emit ternary W variants for enabled
  families, so the remaining W=2 gap is primarily in the browser debug override lists, not
  the server-side bundle payload path

See `docs/research/ascii/2026-03-20-bundle-animation-types.md` for the current family map.

## Milestone 2 Direction

Milestone 2 should focus on **practical PNG ingest and manual assembly**, not on claiming
perfect automatic sprite-sheet slicing.

Milestone 2 target:

- preserve the arbitrary-PNG -> structurally valid bundle XP -> runtime-safe injection
  baseline established in Milestone 1
- make source-panel bbox extraction and source-to-grid assembly the primary PNG workflow
- make the whole-sheet editor the primary correction surface
- add human-verified semantic dictionaries for canonical reference sprites

Milestone 2 is not a requirement that Analyze become an authoritative sprite interpreter.

Milestone 2 must preserve Milestone 1's structural/runtime checkpoint while making the
manual correction workflow practical through shipped controls.
