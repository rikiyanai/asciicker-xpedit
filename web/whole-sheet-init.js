/**
 * Whole-Sheet XP Editor Integration (B6 Slice + B7 Cell Draw)
 *
 * Mounts a whole-sheet Canvas editor surface into the workbench.
 * Hydrates from backend session layers (state.layers), NOT from JS XP file I/O.
 * Supports cell draw on the whole-sheet canvas with active-layer-aware editing
 * that writes back to workbench/session truth via callbacks.
 *
 * Reuses salvageable rexpaint-editor modules:
 *   Canvas, LayerStack, CP437Font, CellTool
 * Does NOT import EditorApp (which depends on XPFileReader/Writer → Node.js zlib).
 */

import { Canvas } from './rexpaint-editor/canvas.js';
import { LayerStack } from './rexpaint-editor/layer-stack.js';
import { CP437Font } from './rexpaint-editor/cp437-font.js';
import { CellTool } from './rexpaint-editor/tools/cell-tool.js';

const FONT_URL = '/termpp-web-flat/fonts/cp437_12x12.png';
const CELL_SIZE = 12;

let editorState = {
  mounted: false,
  canvas: null,
  layerStack: null,
  cp437Font: null,
  cellTool: null,
  gridCols: 0,
  gridRows: 0,
  containerEl: null,
  // Drawing state
  drawGlyph: 64,   // '@'
  drawFg: [255, 255, 255],
  drawBg: [0, 0, 0],
  applyGlyph: true,
  applyFg: true,
  applyBg: true,
  // Callbacks to workbench
  onCellEdited: null,
  onStrokeStart: null,
  onStrokeComplete: null,
  // Stroke tracking
  _strokeDirty: false,
};

/**
 * Mount the whole-sheet editor into the given container.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container - DOM element to mount into
 * @param {number} opts.gridCols - grid width in cells
 * @param {number} opts.gridRows - grid height in cells
 * @param {Array<Array<Object>>} opts.layers - flat cell arrays per layer from backend
 * @param {string[]} opts.layerNames - layer name labels
 * @param {number} [opts.activeLayer=2] - active layer index
 * @param {Set<number>} [opts.visibleLayers] - set of visible layer indices
 * @param {Function} [opts.onCellEdited] - callback(x, y, glyph, fg, bg) per cell edit
 * @param {Function} [opts.onStrokeStart] - callback() before the first cell edit in a stroke
 * @param {Function} [opts.onStrokeComplete] - callback() when a draw stroke finishes
 */
async function mount({ container, gridCols, gridRows, layers, layerNames, activeLayer, visibleLayers, onCellEdited, onStrokeStart, onStrokeComplete }) {
  if (editorState.mounted) {
    unmount();
  }

  editorState.gridCols = gridCols;
  editorState.gridRows = gridRows;
  editorState.containerEl = container;
  editorState.onCellEdited = onCellEdited || null;
  editorState.onStrokeStart = onStrokeStart || null;
  editorState.onStrokeComplete = onStrokeComplete || null;

  // Build DOM structure
  container.innerHTML = '';

  // Toolbar
  const toolbar = _buildToolbar(layers.length, activeLayer, layerNames);
  container.appendChild(toolbar);

  // Info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'ws-info-bar';
  infoBar.innerHTML =
    `<span id="wsPos">Pos: -,-</span>` +
    ` <span id="wsCell">Cell: --</span>` +
    ` <span id="wsDims">${gridCols}\u00d7${gridRows}</span>` +
    ` <span id="wsLayers">${layers.length} layers</span>` +
    ` <span id="wsActiveTool">Tool: Cell</span>`;
  container.appendChild(infoBar);

  // Scrollable canvas wrapper
  const scrollWrap = document.createElement('div');
  scrollWrap.id = 'wholeSheetScroll';
  scrollWrap.className = 'ws-scroll-wrap';
  container.appendChild(scrollWrap);

  // Canvas element
  const canvasEl = document.createElement('canvas');
  canvasEl.id = 'wholeSheetCanvas';
  canvasEl.style.imageRendering = 'pixelated';
  canvasEl.style.cursor = 'crosshair';
  scrollWrap.appendChild(canvasEl);

  // Create Canvas renderer
  const canvas = new Canvas(canvasEl, gridCols, gridRows, CELL_SIZE);
  editorState.canvas = canvas;

  // Load CP437 bitmap font
  const font = new CP437Font(FONT_URL, 12, 12);
  try {
    await font.load();
    editorState.cp437Font = font;
    await canvas.setFont(font);
  } catch (e) {
    console.warn('[whole-sheet] CP437 font load failed, using monospace fallback:', e.message);
  }

  // Build LayerStack from backend session layers
  const layerStack = new LayerStack(gridCols, gridRows);
  // Remove default "Layer 0" created by constructor
  layerStack.layers.splice(0, 1);

  for (let li = 0; li < layers.length; li++) {
    const name = (layerNames && layerNames[li]) || `Layer ${li}`;
    layerStack.addLayer(name);
    const stackLayer = layerStack.layers[li];
    const flatCells = layers[li];

    if (!Array.isArray(flatCells)) continue;

    for (let i = 0; i < flatCells.length; i++) {
      const cell = flatCells[i];
      if (!cell) continue;
      const x = i % gridCols;
      const y = Math.floor(i / gridCols);
      if (x >= gridCols || y >= gridRows) continue;

      const glyph = Number(cell.glyph || 0);
      const fg = Array.isArray(cell.fg) ? cell.fg.map(Number) : [255, 255, 255];
      const bg = Array.isArray(cell.bg) ? cell.bg.map(Number) : [0, 0, 0];
      stackLayer.setCell(x, y, glyph & 0xFF, fg, bg);
    }
  }

  // Set active/visible layers
  const aLayer = (typeof activeLayer === 'number' && activeLayer >= 0 && activeLayer < layerStack.layers.length)
    ? activeLayer : Math.min(2, layerStack.layers.length - 1);
  layerStack.selectLayer(aLayer);

  if (visibleLayers && visibleLayers.size > 0) {
    for (let i = 0; i < layerStack.layers.length; i++) {
      layerStack.layers[i].setVisible(visibleLayers.has(i));
    }
  }

  editorState.layerStack = layerStack;
  canvas.setLayerStack(layerStack);

  // Create CellTool for drawing
  const cellTool = new CellTool();
  cellTool.setGlyph(editorState.drawGlyph);
  cellTool.setColors(editorState.drawFg, editorState.drawBg);
  cellTool.setApplyModes({
    glyph: editorState.applyGlyph,
    foreground: editorState.applyFg,
    background: editorState.applyBg,
  });
  editorState.cellTool = cellTool;

  // Activate CellTool on the canvas — this wires mouse→tool delegation
  canvas.toolActivated(cellTool);

  // Proxy canvas.setCell to fire callbacks:
  // - onStrokeStart before the first edit in a stroke (for undo snapshot)
  // - onCellEdited per cell (for workbench state sync)
  const originalSetCell = canvas.setCell.bind(canvas);
  canvas.setCell = function(x, y, glyph, fg, bg) {
    if (!editorState._strokeDirty && editorState.onStrokeStart) {
      editorState.onStrokeStart();
    }
    originalSetCell(x, y, glyph, fg, bg);
    editorState._strokeDirty = true;
    if (editorState.onCellEdited) {
      editorState.onCellEdited(x, y, glyph & 0xFF, [...fg], [...bg]);
    }
  };

  // Stroke-complete detection: fire callback on mouseup/mouseleave after drawing
  canvasEl.addEventListener('mouseup', _onStrokeEnd);
  canvasEl.addEventListener('mouseleave', _onStrokeEnd);

  // Mouse position tracking on canvas
  canvasEl.addEventListener('mousemove', _onCanvasMouseMove);

  editorState.mounted = true;
  canvas.render();
}

function _onStrokeEnd() {
  if (editorState._strokeDirty) {
    editorState._strokeDirty = false;
    if (editorState.onStrokeComplete) {
      editorState.onStrokeComplete();
    }
  }
}

/**
 * Build the drawing toolbar DOM.
 */
function _buildToolbar(layerCount, activeLayer, layerNames) {
  const bar = document.createElement('div');
  bar.className = 'ws-toolbar';

  // Glyph input
  const glyphLabel = document.createElement('label');
  glyphLabel.textContent = 'Glyph';
  glyphLabel.className = 'ws-toolbar-label';
  const glyphInput = document.createElement('input');
  glyphInput.type = 'number';
  glyphInput.id = 'wsGlyphCode';
  glyphInput.min = '0';
  glyphInput.max = '255';
  glyphInput.value = String(editorState.drawGlyph);
  glyphInput.style.width = '56px';

  const glyphChar = document.createElement('input');
  glyphChar.type = 'text';
  glyphChar.id = 'wsGlyphChar';
  glyphChar.maxLength = 1;
  glyphChar.value = String.fromCharCode(editorState.drawGlyph);
  glyphChar.style.width = '32px';
  glyphChar.title = 'Type a character';

  glyphInput.addEventListener('change', () => {
    const code = Math.max(0, Math.min(255, parseInt(glyphInput.value, 10) || 0));
    glyphInput.value = String(code);
    editorState.drawGlyph = code;
    glyphChar.value = (code > 31 && code < 127) ? String.fromCharCode(code) : '';
    if (editorState.cellTool) editorState.cellTool.setGlyph(code);
  });

  glyphChar.addEventListener('input', () => {
    if (glyphChar.value.length === 1) {
      const code = glyphChar.value.charCodeAt(0) & 0xFF;
      editorState.drawGlyph = code;
      glyphInput.value = String(code);
      if (editorState.cellTool) editorState.cellTool.setGlyph(code);
    }
  });

  // FG color
  const fgLabel = document.createElement('label');
  fgLabel.textContent = 'FG';
  fgLabel.className = 'ws-toolbar-label';
  const fgInput = document.createElement('input');
  fgInput.type = 'color';
  fgInput.id = 'wsFgColor';
  fgInput.value = _rgbToHex(editorState.drawFg);
  fgInput.addEventListener('input', () => {
    editorState.drawFg = _hexToRgb(fgInput.value);
    if (editorState.cellTool) editorState.cellTool.setColors(editorState.drawFg, editorState.drawBg);
  });

  // BG color
  const bgLabel = document.createElement('label');
  bgLabel.textContent = 'BG';
  bgLabel.className = 'ws-toolbar-label';
  const bgInput = document.createElement('input');
  bgInput.type = 'color';
  bgInput.id = 'wsBgColor';
  bgInput.value = _rgbToHex(editorState.drawBg);
  bgInput.addEventListener('input', () => {
    editorState.drawBg = _hexToRgb(bgInput.value);
    if (editorState.cellTool) editorState.cellTool.setColors(editorState.drawFg, editorState.drawBg);
  });

  // Apply mode toggles
  const applyGlyph = _buildToggle('G', 'wsApplyGlyph', editorState.applyGlyph, (on) => {
    editorState.applyGlyph = on;
    if (editorState.cellTool) editorState.cellTool.setApplyModes({ glyph: on });
  });
  const applyFg = _buildToggle('F', 'wsApplyFg', editorState.applyFg, (on) => {
    editorState.applyFg = on;
    if (editorState.cellTool) editorState.cellTool.setApplyModes({ foreground: on });
  });
  const applyBg = _buildToggle('B', 'wsApplyBg', editorState.applyBg, (on) => {
    editorState.applyBg = on;
    if (editorState.cellTool) editorState.cellTool.setApplyModes({ background: on });
  });

  // Active layer indicator
  const layerLabel = document.createElement('label');
  layerLabel.textContent = 'Layer';
  layerLabel.className = 'ws-toolbar-label';
  const layerSpan = document.createElement('span');
  layerSpan.id = 'wsActiveLayer';
  layerSpan.className = 'ws-toolbar-value';
  const aIdx = (typeof activeLayer === 'number') ? activeLayer : 2;
  const lName = (layerNames && layerNames[aIdx]) || `Layer ${aIdx}`;
  layerSpan.textContent = `${aIdx}: ${lName}`;

  // Grid toggle
  const gridToggle = _buildToggle('Grid', 'wsGridToggle', false, (on) => {
    if (editorState.canvas) editorState.canvas.setGridVisible(on);
  });

  // Assemble
  bar.appendChild(glyphLabel);
  bar.appendChild(glyphInput);
  bar.appendChild(glyphChar);
  bar.appendChild(fgLabel);
  bar.appendChild(fgInput);
  bar.appendChild(bgLabel);
  bar.appendChild(bgInput);
  bar.appendChild(applyGlyph);
  bar.appendChild(applyFg);
  bar.appendChild(applyBg);
  bar.appendChild(layerLabel);
  bar.appendChild(layerSpan);
  bar.appendChild(gridToggle);

  return bar;
}

/**
 * Build a toggle button element.
 */
function _buildToggle(label, id, initial, onChange) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = label;
  btn.className = 'ws-toggle' + (initial ? ' ws-toggle-on' : '');
  btn.title = `Toggle ${label} apply mode`;
  btn.addEventListener('click', () => {
    const on = !btn.classList.contains('ws-toggle-on');
    btn.classList.toggle('ws-toggle-on', on);
    onChange(on);
  });
  return btn;
}

function _rgbToHex(rgb) {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function _hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function _onCanvasMouseMove(e) {
  const canvasEl = e.currentTarget;
  const rect = canvasEl.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const cx = Math.floor(px / CELL_SIZE);
  const cy = Math.floor(py / CELL_SIZE);

  const posEl = document.getElementById('wsPos');
  if (posEl) posEl.textContent = `Pos: ${cx},${cy}`;

  const { canvas, gridCols, gridRows } = editorState;
  if (canvas && cx >= 0 && cx < gridCols && cy >= 0 && cy < gridRows) {
    try {
      const cell = canvas.getCell(cx, cy);
      const cellEl = document.getElementById('wsCell');
      if (cellEl && cell) {
        const ch = (cell.glyph > 31 && cell.glyph < 127) ? String.fromCharCode(cell.glyph) : '\u00b7';
        cellEl.textContent = `Cell: ${cell.glyph} (${ch})`;
      }
    } catch (_) { /* ignore out-of-bounds during rapid mouse movement */ }
  }
}

/**
 * Tear down the editor and release resources.
 */
function unmount() {
  if (editorState.canvas) {
    const canvasEl = editorState.canvas.canvasElement;
    if (canvasEl) {
      canvasEl.removeEventListener('mousemove', _onCanvasMouseMove);
      canvasEl.removeEventListener('mouseup', _onStrokeEnd);
      canvasEl.removeEventListener('mouseleave', _onStrokeEnd);
    }
    if (typeof editorState.canvas.dispose === 'function') editorState.canvas.dispose();
  }
  if (editorState.containerEl) editorState.containerEl.innerHTML = '';

  editorState = {
    mounted: false,
    canvas: null,
    layerStack: null,
    cp437Font: null,
    cellTool: null,
    gridCols: 0,
    gridRows: 0,
    containerEl: null,
    drawGlyph: editorState.drawGlyph,
    drawFg: editorState.drawFg,
    drawBg: editorState.drawBg,
    applyGlyph: editorState.applyGlyph,
    applyFg: editorState.applyFg,
    applyBg: editorState.applyBg,
    onCellEdited: null,
    onStrokeStart: null,
    onStrokeComplete: null,
    _strokeDirty: false,
  };
}

/**
 * Scroll the whole-sheet editor viewport to center on a specific frame.
 *
 * @param {number} row - frame grid row (angle index)
 * @param {number} col - frame grid column
 * @param {number} frameWChars - frame width in cells
 * @param {number} frameHChars - frame height in cells
 */
function panToFrame(row, col, frameWChars, frameHChars) {
  if (!editorState.mounted) return;

  const scrollWrap = document.getElementById('wholeSheetScroll');
  if (!scrollWrap) return;

  const targetX = col * frameWChars * CELL_SIZE;
  const targetY = row * frameHChars * CELL_SIZE;
  const framePixelW = frameWChars * CELL_SIZE;
  const framePixelH = frameHChars * CELL_SIZE;

  // Center the frame in the scroll viewport
  const viewW = scrollWrap.clientWidth;
  const viewH = scrollWrap.clientHeight;
  const scrollX = Math.max(0, targetX - (viewW - framePixelW) / 2);
  const scrollY = Math.max(0, targetY - (viewH - framePixelH) / 2);

  scrollWrap.scrollTo({ left: scrollX, top: scrollY, behavior: 'smooth' });
}

/**
 * Sync the LayerStack cells from workbench state.layers (flat arrays) and re-render.
 * Called by workbench.js renderAll() to keep the whole-sheet surface in sync after edits.
 *
 * @param {Array<Array<Object>>} layers - flat cell arrays per layer from workbench state
 */
function syncFromState(layers) {
  if (!editorState.mounted || !editorState.layerStack || !editorState.canvas) return;
  if (!Array.isArray(layers)) return;

  const { gridCols, gridRows, layerStack } = editorState;
  const count = Math.min(layers.length, layerStack.layers.length);

  for (let li = 0; li < count; li++) {
    const flatCells = layers[li];
    const stackLayer = layerStack.layers[li];
    if (!Array.isArray(flatCells)) continue;

    for (let i = 0; i < flatCells.length; i++) {
      const cell = flatCells[i];
      if (!cell) continue;
      const x = i % gridCols;
      const y = Math.floor(i / gridCols);
      if (x >= gridCols || y >= gridRows) continue;

      const glyph = Number(cell.glyph || 0);
      const fg = Array.isArray(cell.fg) ? cell.fg.map(Number) : [255, 255, 255];
      const bg = Array.isArray(cell.bg) ? cell.bg.map(Number) : [0, 0, 0];
      stackLayer.setCell(x, y, glyph & 0xFF, fg, bg);
    }
  }

  editorState.canvas.render();
}

/**
 * Get current editor state summary.
 */
function getState() {
  return {
    mounted: editorState.mounted,
    gridCols: editorState.gridCols,
    gridRows: editorState.gridRows,
    layerCount: editorState.layerStack ? editorState.layerStack.layers.length : 0,
    hasFontLoaded: !!(editorState.cp437Font && editorState.cp437Font.spriteSheet),
    activeTool: editorState.cellTool ? 'cell' : null,
    drawGlyph: editorState.drawGlyph,
    drawFg: editorState.drawFg,
    drawBg: editorState.drawBg,
  };
}

/**
 * Update drawing state externally.
 */
function setDrawState({ glyph, fg, bg, applyGlyph, applyFg, applyBg }) {
  if (typeof glyph === 'number') {
    editorState.drawGlyph = glyph & 0xFF;
    if (editorState.cellTool) editorState.cellTool.setGlyph(editorState.drawGlyph);
    const el = document.getElementById('wsGlyphCode');
    if (el) el.value = String(editorState.drawGlyph);
    const ch = document.getElementById('wsGlyphChar');
    if (ch) ch.value = (glyph > 31 && glyph < 127) ? String.fromCharCode(glyph) : '';
  }
  if (Array.isArray(fg) && fg.length === 3) {
    editorState.drawFg = fg.map(Number);
    if (editorState.cellTool) editorState.cellTool.setColors(editorState.drawFg, editorState.drawBg);
    const el = document.getElementById('wsFgColor');
    if (el) el.value = _rgbToHex(editorState.drawFg);
  }
  if (Array.isArray(bg) && bg.length === 3) {
    editorState.drawBg = bg.map(Number);
    if (editorState.cellTool) editorState.cellTool.setColors(editorState.drawFg, editorState.drawBg);
    const el = document.getElementById('wsBgColor');
    if (el) el.value = _rgbToHex(editorState.drawBg);
  }
  if (typeof applyGlyph === 'boolean') {
    editorState.applyGlyph = applyGlyph;
    if (editorState.cellTool) editorState.cellTool.setApplyModes({ glyph: applyGlyph });
    const el = document.getElementById('wsApplyGlyph');
    if (el) el.classList.toggle('ws-toggle-on', applyGlyph);
  }
  if (typeof applyFg === 'boolean') {
    editorState.applyFg = applyFg;
    if (editorState.cellTool) editorState.cellTool.setApplyModes({ foreground: applyFg });
    const el = document.getElementById('wsApplyFg');
    if (el) el.classList.toggle('ws-toggle-on', applyFg);
  }
  if (typeof applyBg === 'boolean') {
    editorState.applyBg = applyBg;
    if (editorState.cellTool) editorState.cellTool.setApplyModes({ background: applyBg });
    const el = document.getElementById('wsApplyBg');
    if (el) el.classList.toggle('ws-toggle-on', applyBg);
  }
}

// Expose on window for workbench.js (non-module IIFE) to call
window.__wholeSheetEditor = {
  mount,
  unmount,
  panToFrame,
  syncFromState,
  getState,
  setDrawState,
};
