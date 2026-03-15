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
- the workbench can export XP without structural corruption
- the exported XP works in the Skin Dock/runtime

This is not a speed goal. This is not a partial-proof goal. This is a hard-fail fidelity goal.

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

### 2. Existing XP Load/Edit/Export

The product must support loading an existing XP through the real product path, preserving:

- dimensions
- angles
- animation/frame layout
- projections
- all layers
- cell contents

Editing and export must not corrupt that structure.

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

Read-only instrumentation is allowed. State mutation shortcuts are not.

### Gate E. Export Fidelity

Hard fail if exported XP differs from the intended/new/oracle XP in metadata, layers, or cells.

### Gate F. Runtime Load

Hard fail if the exported XP or current edited session cannot load and behave in Skin Dock/runtime.

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

## Current Repo Truth

As of 2026-03-15:

- no valid XP fidelity harness exists in this repo
- the previous blank-flow single-frame harness was deleted because it violated this contract
- future XP verification work must restart from this contract, not from deleted harness artifacts
