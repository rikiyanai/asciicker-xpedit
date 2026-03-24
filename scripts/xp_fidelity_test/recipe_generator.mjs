#!/usr/bin/env node

/**
 * recipe_generator.mjs — Minimal fixed-recipe generator for READY-family workflows.
 *
 * Reads action_registry.json and emits deterministic recipe objects.
 * Each recipe step is derived from registry fields:
 *   selectorKey, fileInputSelectorKey, gestureType, preconditions, postconditions
 *
 * First pass constraints:
 *   - Fixed recipes only (no random generation)
 *   - READY families only (F1, F2, F4, F8, F9, F10, F11, F12)
 *   - No canvas gestures, source-to-grid, whole-sheet, or keyboard workflows
 *   - No canon-doc updates
 *
 * Usage:
 *   node recipe_generator.mjs                          # print recipes as JSON
 *   node recipe_generator.mjs --out recipes.json       # write to file
 *   node recipe_generator.mjs --list                   # list recipe IDs only
 *   node recipe_generator.mjs --recipe <id>            # print one recipe
 *
 * @module recipe_generator
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, isGestureBlocked } from './selectors.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// A. Load and validate registry
// ---------------------------------------------------------------------------

const registryPath = path.join(__dirname, 'action_registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

/**
 * Look up an action by ID, validating it exists and is generator-ready.
 * @param {string} actionId
 * @returns {object} action entry from registry
 */
function requireAction(actionId) {
  const action = registry.actions[actionId];
  if (!action) {
    throw new Error(`Action "${actionId}" not found in registry.`);
  }
  if (action.generatorReadiness !== 'READY') {
    throw new Error(
      `Action "${actionId}" has generatorReadiness="${action.generatorReadiness}", not READY.`
    );
  }
  if (isGestureBlocked(action.gestureType)) {
    throw new Error(
      `Action "${actionId}" uses blocked gesture "${action.gestureType}".`
    );
  }
  return action;
}

// ---------------------------------------------------------------------------
// B. Recipe step builder — derives steps from registry fields only
// ---------------------------------------------------------------------------

/**
 * Build a recipe step from an action ID and optional params.
 * All selector/gesture/condition data comes from the registry.
 *
 * @param {string} actionId
 * @param {object} [params={}] — action-specific runtime params (file path, option value, etc.)
 * @returns {object} recipe step conforming to action_registry_schema.json#/definitions/recipeStep
 */
function step(actionId, params = {}) {
  const action = requireAction(actionId);

  // Validate: every paramBinding's paramKey must have a corresponding value in params
  for (const binding of action.paramBindings || []) {
    if (!(binding.paramKey in params)) {
      throw new Error(
        `Action "${actionId}" has paramBinding requiring params.${binding.paramKey} ` +
        `(selectorKey="${binding.selectorKey}", gestureType="${binding.gestureType}") ` +
        `but it was not provided.`
      );
    }
  }

  return {
    actionId,
    params: Object.keys(params).length > 0 ? params : undefined,
    expectedOutcome: action.postconditions,
    // Derived metadata for runner consumption (not in schema, but useful for dom_runner)
    _derived: {
      selectorKey: action.selectorKey,
      paramBindings: action.paramBindings || [],
      gestureType: action.gestureType,
      preconditions: action.preconditions,
    },
  };
}

// ---------------------------------------------------------------------------
// C. Fixed recipe definitions — hardcoded sequences, registry-derived steps
// ---------------------------------------------------------------------------

/**
 * Recipe 1: Classic XP Lifecycle
 *
 * Upload PNG → Convert to XP → Save → Export → Test in Skin Dock
 *
 * Exercises: F2 (U1, U3), F1 (T3, T4, T7)
 * File-input actions: U1 (wbFile)
 */
function recipeClassicXpLifecycle(pngFixturePath) {
  return {
    id: 'classic_xp_lifecycle',
    name: 'Classic XP Lifecycle: upload → convert → save → export → runtime test',
    family: 'F1',
    preconditions: {},
    steps: [
      step('U1', { filePath: pngFixturePath }),
      step('U3'),
      step('T3'),
      step('T4'),
      step('R1'),
    ],
  };
}

/**
 * Recipe 2: XP Import Roundtrip
 *
 * Import XP file → Save → Export → Test in Skin Dock
 *
 * Exercises: F1 (T6, T3, T4, T7)
 * File-input actions: T6 (xpImportFile)
 */
function recipeXpImportRoundtrip(xpFixturePath) {
  return {
    id: 'xp_import_roundtrip',
    name: 'XP Import Roundtrip: import → save → export → runtime test',
    family: 'F1',
    preconditions: {},
    steps: [
      step('T6', { filePath: xpFixturePath }),
      step('T3'),
      step('T4'),
      step('R1'),
    ],
  };
}

/**
 * Recipe 3: Bundle Template Apply + Per-Action Save
 *
 * Apply template → (bundle mode activates) → Save current action
 *
 * Exercises: F1 (T1, T3)
 * No file-input actions.
 * Note: T2 (tab switch) is not included because it requires an existing bundle
 * with multiple actions already populated. This recipe tests the minimal
 * template-apply → save path that doesn't depend on prior state.
 */
function recipeBundleTemplateApply() {
  return {
    id: 'bundle_template_apply',
    name: 'Bundle Template Apply: apply template → save',
    family: 'F1',
    preconditions: {},
    steps: [
      step('T1', { templateValue: 'player_native_full' }),
      step('T3'),
    ],
  };
}

/**
 * Recipe 4: Runtime Dock Cycle
 *
 * (Assumes a session already exists from a prior recipe or manual setup.)
 * Open Preview → Reload Preview → Test This Skin
 *
 * Exercises: F10 (R4, R5, R1)
 * No file-input actions.
 */
function recipeRuntimeDockCycle() {
  return {
    id: 'runtime_dock_cycle',
    name: 'Runtime Dock Cycle: open preview → reload → test skin',
    family: 'F10',
    preconditions: {
      sessionId: { op: 'truthy', value: null },
    },
    steps: [
      step('R4'),
      step('R5'),
      step('R1'),
    ],
  };
}

/**
 * Recipe 5: Undo/Redo Smoke
 *
 * (Assumes a session with history from a prior recipe.)
 * Undo → Redo
 *
 * Exercises: F9 (L2, L3)
 * No file-input actions.
 */
function recipeUndoRedoSmoke() {
  return {
    id: 'undo_redo_smoke',
    name: 'Undo/Redo Smoke: undo → redo',
    family: 'F9',
    preconditions: {
      historyDepth: { op: 'gt', value: 0 },
    },
    steps: [
      step('L2'),
      step('L3'),
    ],
  };
}

/**
 * Recipe 6: Bug Report Open/Dismiss
 *
 * Open bug report modal → Dismiss
 *
 * Exercises: F11 (B1, B3)
 * No file-input actions. No preconditions.
 */
function recipeBugReportDismiss() {
  return {
    id: 'bug_report_dismiss',
    name: 'Bug Report: open → dismiss',
    family: 'F11',
    preconditions: {},
    steps: [
      step('B1'),
      step('B3'),
    ],
  };
}

/**
 * Recipe 7: Source Panel Mode Cycle
 *
 * (Assumes a source image is loaded from a prior recipe.)
 * Cycle through all 5 source modes, then find sprites.
 *
 * Exercises: F3 (S2, S3, S4, S5, S1, S12)
 */
function recipeSourcePanelModeCycle() {
  return {
    id: 'source_panel_mode_cycle',
    name: 'Source Panel Mode Cycle: draw_box → row → col → cut_v → select → find sprites',
    family: 'F3',
    preconditions: {
      sourceImageLoaded: true,
    },
    steps: [
      step('S2'),
      step('S3'),
      step('S4'),
      step('S5'),
      step('S1'),
      step('S12'),
    ],
  };
}

/**
 * Recipe 8: Grid Panel Frame Management
 *
 * (Assumes a session exists with at least one row selected.)
 * Add frame → delete it.
 *
 * Exercises: F6 (G5, G6)
 */
function recipeGridFrameManagement() {
  return {
    id: 'grid_frame_management',
    name: 'Grid Panel: add frame → delete selected',
    family: 'F6',
    preconditions: {
      sessionId: { op: 'truthy', value: null },
    },
    steps: [
      step('G5'),
      step('G6'),
    ],
  };
}

// ---------------------------------------------------------------------------
// D. Recipe catalog
// ---------------------------------------------------------------------------

const DEFAULT_PNG_FIXTURE = 'tests/fixtures/known_good/cat_sheet.png';
const DEFAULT_XP_FIXTURE = 'sprites/player-0000.xp';

/** Generate all fixed recipes with default fixture paths. */
export function generateRecipes(opts = {}) {
  const pngPath = opts.pngFixturePath || DEFAULT_PNG_FIXTURE;
  const xpPath = opts.xpFixturePath || DEFAULT_XP_FIXTURE;

  return [
    recipeClassicXpLifecycle(pngPath),
    recipeXpImportRoundtrip(xpPath),
    recipeBundleTemplateApply(),
    recipeRuntimeDockCycle(),
    recipeUndoRedoSmoke(),
    recipeBugReportDismiss(),
    recipeSourcePanelModeCycle(),
    recipeGridFrameManagement(),
  ];
}

// ---------------------------------------------------------------------------
// E. CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  const hasFlag = (name) => args.includes(name);

  const recipes = generateRecipes();

  if (hasFlag('--list')) {
    for (const r of recipes) {
      console.log(`${r.id}  (${r.steps.length} steps)  ${r.name}`);
    }
    return;
  }

  const recipeId = getArg('--recipe');
  const output = recipeId
    ? recipes.find(r => r.id === recipeId) || { error: `Recipe "${recipeId}" not found` }
    : recipes;

  const json = JSON.stringify(output, null, 2);

  const outPath = getArg('--out');
  if (outPath) {
    writeFileSync(outPath, json + '\n');
    console.log(`Wrote ${recipes.length} recipes to ${outPath}`);
  } else {
    console.log(json);
  }
}

// Guard: only run CLI when executed directly, not when imported as a module.
const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main();
}
