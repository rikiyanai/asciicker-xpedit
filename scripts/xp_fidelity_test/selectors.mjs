/**
 * selectors.mjs — Shared DOM selector and gesture authority for the M2 verifier architecture.
 *
 * This module is the single source of truth for DOM selectors used by:
 *   - action_registry.json (references selector keys, not raw CSS)
 *   - future recipe_generator.mjs
 *   - future dom_runner.mjs
 *
 * All selector keys map to real element IDs verified against web/workbench.html.
 * Canvas-coordinate and drag-gesture abstractions are NOT yet included — those
 * families are blocked on gesture design (see action_registry.json blockers).
 *
 * @module selectors
 */

// ---------------------------------------------------------------------------
// A. DOM Selectors — keyed by stable camelCase names
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} CSS selectors for workbench DOM elements. */
export const selectors = {
  // -- F1: Template / Bundle --
  templateSelect:       '#templateSelect',
  templateApplyBtn:     '#templateApplyBtn',
  templateStatus:       '#templateStatus',
  bundleActionTabs:     '#bundleActionTabs',
  bundleStatus:         '#bundleStatus',
  btnLoad:              '#btnLoad',
  btnSave:              '#btnSave',
  btnExport:            '#btnExport',
  btnNewXp:             '#btnNewXp',
  xpImportFile:         '#xpImportFile',
  xpImportBtn:          '#xpImportBtn',

  // -- F2: Upload / Convert --
  wbFile:               '#wbFile',
  wbUpload:             '#wbUpload',
  wbAnalyze:            '#wbAnalyze',
  wbRun:                '#wbRun',
  wbName:               '#wbName',
  wbAngles:             '#wbAngles',
  wbFrames:             '#wbFrames',
  wbSourceProjs:        '#wbSourceProjs',
  wbRenderRes:          '#wbRenderRes',
  uploadPanelLabel:     '#uploadPanelLabel',

  // -- F3: Source Panel (buttons + inputs only; canvas gestures are separate) --
  sourceSelectBtn:      '#sourceSelectBtn',
  drawBoxBtn:           '#drawBoxBtn',
  rowSelectBtn:         '#rowSelectBtn',
  colSelectBtn:         '#colSelectBtn',
  cutVBtn:              '#cutVBtn',
  deleteBoxBtn:         '#deleteBoxBtn',
  extractBtn:           '#extractBtn',
  rapidManualAdd:       '#rapidManualAdd',
  threshold:            '#threshold',
  minSize:              '#minSize',
  sourceZoomInput:      '#sourceZoomInput',
  sourceCanvas:         '#sourceCanvas',

  // -- F4: Context Menu (source) --
  sourceContextMenu:    '#sourceContextMenu',
  srcCtxAddSprite:      '#srcCtxAddSprite',
  srcCtxAddToRow:       '#srcCtxAddToRow',
  srcCtxSetAnchor:      '#srcCtxSetAnchor',
  srcCtxPadAnchor:      '#srcCtxPadAnchor',
  srcCtxDelete:         '#srcCtxDelete',

  // -- F4: Context Menu (grid) --
  gridContextMenu:      '#gridContextMenu',
  ctxCopy:              '#ctxCopy',
  ctxPaste:             '#ctxPaste',
  ctxOpenInspector:     '#ctxOpenInspector',
  ctxDelete:            '#ctxDelete',

  // -- F6: Grid Panel (buttons + inputs only; canvas gestures are separate) --
  rowUpBtn:             '#rowUpBtn',
  rowDownBtn:           '#rowDownBtn',
  colLeftBtn:           '#colLeftBtn',
  colRightBtn:          '#colRightBtn',
  addFrameBtn:          '#addFrameBtn',
  deleteCellBtn:        '#deleteCellBtn',
  openInspectorBtn:     '#openInspectorBtn',
  layerSelect:          '#layerSelect',
  gridZoomInput:        '#gridZoomInput',
  gridPanel:            '#gridPanel',

  // -- F8: Jitter / Alignment --
  autoAlignSelectedBtn: '#autoAlignSelectedBtn',
  autoAlignRowBtn:      '#autoAlignRowBtn',
  jitterLeftBtn:        '#jitterLeftBtn',
  jitterRightBtn:       '#jitterRightBtn',
  jitterUpBtn:          '#jitterUpBtn',
  jitterDownBtn:        '#jitterDownBtn',
  jitterAlignMode:      '#jitterAlignMode',
  jitterRefMode:        '#jitterRefMode',
  jitterRow:            '#jitterRow',
  jitterStep:           '#jitterStep',

  // -- F9: Lifecycle --
  undoBtn:              '#undoBtn',
  redoBtn:              '#redoBtn',
  // btnSave already listed under F1

  // -- F10: Runtime Dock --
  webbuildQuickTestBtn:    '#webbuildQuickTestBtn',
  webbuildOpenBtn:         '#webbuildOpenBtn',
  webbuildReloadBtn:       '#webbuildReloadBtn',
  webbuildApplyInPlaceBtn: '#webbuildApplyInPlaceBtn',
  webbuildApplyRestartBtn: '#webbuildApplyRestartBtn',
  webbuildUploadTestBtn:   '#webbuildUploadTestBtn',
  webbuildUploadTestInput: '#webbuildUploadTestInput',
  webbuildApplySkinBtn:    '#webbuildApplySkinBtn',
  webbuildFrame:           '#webbuildFrame',

  // -- F11: Bug Report --
  reportBugBtn:         '#reportBugBtn',
  bugReportModal:       '#bugReportModal',
  bugReportCloseBtn:    '#bugReportCloseBtn',
  bugReportSubmitBtn:   '#bugReportSubmitBtn',
  bugCategory:          '#bugCategory',
  bugSeverity:          '#bugSeverity',
  bugDescription:       '#bugDescription',
  bugKnownIssue:        '#bugKnownIssue',
  bugDeliveryMethod:    '#bugDeliveryMethod',
  bugIncludeSession:    '#bugIncludeSession',
  bugIncludeRecorder:   '#bugIncludeRecorder',

  // -- F11: UI Recorder --
  uiRecorderStartBtn:   '#uiRecorderStartBtn',
  uiRecorderStopBtn:    '#uiRecorderStopBtn',
  uiRecorderClearBtn:   '#uiRecorderClearBtn',
  uiRecorderDownloadBtn:'#uiRecorderDownloadBtn',

  // -- F12: XP Preview --
  playBtn:              '#playBtn',
  stopBtn:              '#stopBtn',
  fpsInput:             '#fpsInput',
  previewAngle:         '#previewAngle',
  previewCanvas:        '#previewCanvas',

  // -- Animation Metadata --
  animCategorySelect:   '#animCategorySelect',
  assignAnimCategoryBtn:'#assignAnimCategoryBtn',
  frameGroupName:       '#frameGroupName',
  assignFrameGroupBtn:  '#assignFrameGroupBtn',
  applyGroupsToAnimsBtn:'#applyGroupsToAnimsBtn',

  // -- Readiness / Status (observation-only, not action triggers) --
  sessionOut:           '#sessionOut',
  metaOut:              '#metaOut',
  wbStatus:             '#wbStatus',
  sessionDirtyBadge:    '#sessionDirtyBadge',
  wholeSheetPanel:      '#wholeSheetPanel',
  wholeSheetMount:      '#wholeSheetMount',
};

// ---------------------------------------------------------------------------
// B. Gesture Types — describe HOW to interact with a selector
// ---------------------------------------------------------------------------

/**
 * Canonical gesture types for the action registry.
 * Each action in the registry pairs a selectorKey with a gestureType.
 *
 * Canvas-coordinate gestures (canvasDrag, canvasClick, canvasRightClick)
 * are defined here for reference but require additional parameters
 * (coordinates, steps) that are not yet abstracted. Actions using these
 * gestures are marked as blocked in the registry.
 */
export const gestureTypes = {
  click:             { type: 'click',          description: 'Left-click the element' },
  rightClick:        { type: 'click',          description: 'Right-click the element', button: 'right' },
  setInputFiles:     { type: 'setInputFiles',  description: 'Set file(s) on a file input element' },
  selectOption:      { type: 'selectOption',   description: 'Select an option from a <select> element' },
  fill:              { type: 'fill',           description: 'Fill a text/number input with a value' },
  check:             { type: 'check',          description: 'Check/uncheck a checkbox' },
  inputRange:        { type: 'inputRange',     description: 'Set value on a range input (slider)' },

  // Canvas gestures — require coordinate parameters, blocked for generator
  canvasClick:       { type: 'canvasClick',    description: 'Click at (x,y) on a canvas element', blocked: true },
  canvasDrag:        { type: 'canvasDrag',     description: 'Drag from (x1,y1) to (x2,y2) on a canvas element', blocked: true },
  canvasRightClick:  { type: 'canvasRightClick', description: 'Right-click at (x,y) on a canvas element', blocked: true },

  // Keyboard gestures — require key-event abstraction, blocked for generator
  keypress:          { type: 'keypress',       description: 'Press a keyboard key', blocked: true },
};

// ---------------------------------------------------------------------------
// C. Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a selector key to its CSS selector string.
 * Throws if the key is not found.
 * @param {string} key
 * @returns {string}
 */
export function resolve(key) {
  if (!(key in selectors)) {
    throw new Error(`Unknown selector key: "${key}". Check selectors.mjs.`);
  }
  return selectors[key];
}

/**
 * Check whether a gesture type is blocked (requires design work).
 * @param {string} gestureType
 * @returns {boolean}
 */
export function isGestureBlocked(gestureType) {
  const g = gestureTypes[gestureType];
  return g?.blocked === true;
}
