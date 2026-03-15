/**
 * Whole-Sheet XP Editor Integration (B6 Slice)
 *
 * Mounts a whole-sheet Canvas editor surface into the workbench.
 * Hydrates from backend session layers (state.layers), NOT from JS XP file I/O.
 * First integration slice toward REXPaint parity.
 *
 * Reuses salvageable rexpaint-editor modules:
 *   Canvas, LayerStack, CP437Font
 * Does NOT import EditorApp (which depends on XPFileReader/Writer → Node.js zlib).
 */

import { Canvas } from './rexpaint-editor/canvas.js';
import { LayerStack } from './rexpaint-editor/layer-stack.js';
import { CP437Font } from './rexpaint-editor/cp437-font.js';

const FONT_URL = '/termpp-web-flat/fonts/cp437_12x12.png';
const CELL_SIZE = 12;

let editorState = {
  mounted: false,
  canvas: null,
  layerStack: null,
  cp437Font: null,
  gridCols: 0,
  gridRows: 0,
  containerEl: null,
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
 */
async function mount({ container, gridCols, gridRows, layers, layerNames, activeLayer, visibleLayers }) {
  if (editorState.mounted) {
    unmount();
  }

  editorState.gridCols = gridCols;
  editorState.gridRows = gridRows;
  editorState.containerEl = container;

  // Build DOM structure
  container.innerHTML = '';

  // Info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'ws-info-bar';
  infoBar.innerHTML =
    `<span id="wsPos">Pos: -,-</span>` +
    ` <span id="wsCell">Cell: --</span>` +
    ` <span id="wsDims">${gridCols}\u00d7${gridRows}</span>` +
    ` <span id="wsLayers">${layers.length} layers</span>`;
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

  // Mouse position tracking on canvas
  canvasEl.addEventListener('mousemove', _onCanvasMouseMove);

  editorState.mounted = true;
  canvas.render();
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
    if (canvasEl) canvasEl.removeEventListener('mousemove', _onCanvasMouseMove);
    if (typeof editorState.canvas.dispose === 'function') editorState.canvas.dispose();
  }
  if (editorState.containerEl) editorState.containerEl.innerHTML = '';

  editorState = {
    mounted: false,
    canvas: null,
    layerStack: null,
    cp437Font: null,
    gridCols: 0,
    gridRows: 0,
    containerEl: null,
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
  };
}

// Expose on window for workbench.js (non-module IIFE) to call
window.__wholeSheetEditor = {
  mount,
  unmount,
  panToFrame,
  syncFromState,
  getState,
};
