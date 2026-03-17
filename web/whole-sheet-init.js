/**
 * Whole-Sheet XP Editor Integration
 *
 * REXPaint-style left-sidebar + canvas layout (spec sections 3.1-3.9).
 * Hydrates from backend session layers (state.layers), NOT from JS XP file I/O.
 * Supports cell draw, eyedropper, erase with active-layer-aware editing.
 *
 * Layout regions:
 *   Left sidebar: Mode, Glyph, Palette, Tools/Apply, Image/Draw, Layers, Info
 *   Center: Whole-sheet canvas (primary editing surface)
 */

import { Canvas } from './rexpaint-editor/canvas.js';
import { LayerStack } from './rexpaint-editor/layer-stack.js';
import { CP437Font } from './rexpaint-editor/cp437-font.js';
import { CellTool } from './rexpaint-editor/tools/cell-tool.js';
import { LineTool } from './rexpaint-editor/tools/line-tool.js';
import { RectTool } from './rexpaint-editor/tools/rect-tool.js';
import { FillTool } from './rexpaint-editor/tools/fill-tool.js';

const FONT_URL = '/termpp-web-flat/fonts/cp437_12x12.png';
const CELL_SIZE = 12;
const PALETTE_CELL = 11;
const DEFAULT_PALETTE = [
  // Grayscale
  [0,0,0],[17,17,17],[34,34,34],[51,51,51],[68,68,68],[85,85,85],[102,102,102],[119,119,119],
  [136,136,136],[153,153,153],[170,170,170],[187,187,187],[204,204,204],[221,221,221],[238,238,238],[255,255,255],
  // Saturated hues
  [255,0,0],[255,85,0],[255,170,0],[255,255,0],[170,255,0],[85,255,0],[0,255,0],[0,255,85],
  [0,255,170],[0,255,255],[0,170,255],[0,85,255],[0,0,255],[85,0,255],[170,0,255],[255,0,170],
  // Light / pastel
  [255,128,128],[255,170,128],[255,213,128],[255,255,128],[213,255,128],[170,255,128],[128,255,128],[128,255,170],
  [128,255,213],[128,255,255],[128,213,255],[128,170,255],[128,128,255],[170,128,255],[213,128,255],[255,128,213],
  // Dark
  [128,0,0],[128,43,0],[128,85,0],[128,128,0],[85,128,0],[43,128,0],[0,128,0],[0,128,43],
  [0,128,85],[0,128,128],[0,85,128],[0,43,128],[0,0,128],[43,0,128],[85,0,128],[128,0,85],
];
const PALETTE_COLS = 16;
const PALETTE_ROWS = Math.ceil(DEFAULT_PALETTE.length / PALETTE_COLS);

// ── Inline tool classes ──

class EyedropperTool {
  constructor() {
    this.canvas = null;
    this._onSample = null;
  }
  setCanvas(canvas) { this.canvas = canvas; }
  setOnSample(fn) { this._onSample = fn; }
  startDrag(x, y) { this._sample(x, y); }
  drag(x, y) { this._sample(x, y); }
  endDrag() {}
  _sample(x, y) {
    if (!this.canvas) return;
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const ls = this.canvas.layerStack;
    let cell;
    if (ls) {
      const activeLayer = ls.getActiveLayer();
      cell = activeLayer ? activeLayer.getCell(x, y) : null;
    }
    if (!cell) {
      try { cell = this.canvas.getCell(x, y); } catch (_) { return; }
    }
    if (cell && this._onSample) {
      this._onSample(cell.glyph, [...(cell.fg || [255,255,255])], [...(cell.bg || [0,0,0])]);
    }
  }
}

class EraseTool {
  constructor() {
    this.canvas = null;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
  }
  setCanvas(canvas) { this.canvas = canvas; }
  startDrag(x, y) {
    this.isDragging = true;
    this.lastX = x;
    this.lastY = y;
    this._erase(x, y);
  }
  drag(x, y) {
    if (!this.isDragging) return;
    const cells = this._line(this.lastX, this.lastY, x, y);
    for (const c of cells) this._erase(c.x, c.y);
    this.lastX = x;
    this.lastY = y;
  }
  endDrag() { this.isDragging = false; }
  _erase(x, y) {
    if (!this.canvas) return;
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    this.canvas.setCell(x, y, 0, [255, 255, 255], [0, 0, 0]);
  }
  _line(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (true) {
      cells.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return cells;
  }
}

// ── Tool adapters (bridge startDrag/drag/endDrag to underlying tool APIs) ──

class LineToolAdapter {
  constructor() { this._tool = new LineTool(); }
  setCanvas(c) { this._tool.setCanvas(c); }
  setGlyph(code) { this._tool.setGlyph(code); }
  setColors(fg, bg) { this._tool.setColors(fg, bg); }
  setApplyModes(modes) { this._tool.setApplyModes(modes); }
  startDrag(x, y) { this._tool.startLine(x, y); }
  drag(x, y) { this._tool.drawLine(x, y); }
  endDrag() { this._tool.endLine(); }
}

class RectToolAdapter {
  constructor() { this._tool = new RectTool(); this._tool.setMode('outline'); }
  setCanvas(c) { this._tool.setCanvas(c); }
  setGlyph(code) { this._tool.setGlyph(code); }
  setColors(fg, bg) { this._tool.setColors(fg, bg); }
  setApplyModes(modes) { this._tool.setApplyModes(modes); }
  setMode(mode) { this._tool.setMode(mode); }
  startDrag(x, y) { this._tool.startRect(x, y); }
  drag(x, y) { this._tool.drawRect(x, y); }
  endDrag() { this._tool.endRect(); }
}

class FillToolAdapter {
  constructor() { this._tool = new FillTool(); }
  setCanvas(c) { this._tool.setCanvas(c); }
  setGlyph(code) { this._tool.setGlyph(code); }
  setColors(fg, bg) { this._tool.setColors(fg, bg); }
  setApplyModes(modes) { this._tool.setApplyModes(modes); }
  startDrag(x, y) { this._tool.fill(x, y); }
  drag() {}
  endDrag() {}
}

function _forEachTool(fn) {
  for (const t of [editorState.cellTool, editorState.lineTool, editorState.rectTool, editorState.fillTool]) {
    if (t) fn(t);
  }
}

// ── Editor state ──

let editorState = {
  mounted: false,
  canvas: null,
  layerStack: null,
  cp437Font: null,
  cellTool: null,
  eyedropperTool: null,
  eraseTool: null,
  lineTool: null,
  rectTool: null,
  fillTool: null,
  activeTool: 'cell',
  gridCols: 0,
  gridRows: 0,
  containerEl: null,
  drawGlyph: 64,
  drawFg: [255, 255, 255],
  drawBg: [0, 0, 0],
  applyGlyph: true,
  applyFg: true,
  applyBg: true,
  onCellEdited: null,
  onStrokeStart: null,
  onStrokeComplete: null,
  onActiveLayerChanged: null,
  onLayerVisibilityChanged: null,
  _strokeDirty: false,
  _originalGridParent: null,
  _originalGridNextSibling: null,
};

// ── mount ──

async function mount({ container, gridCols, gridRows, layers, layerNames, activeLayer, visibleLayers, onCellEdited, onStrokeStart, onStrokeComplete, onActiveLayerChanged, onLayerVisibilityChanged, onSave, onExport, onUndo, onRedo }) {
  if (editorState.mounted) unmount();

  editorState.gridCols = gridCols;
  editorState.gridRows = gridRows;
  editorState.containerEl = container;
  editorState.onCellEdited = onCellEdited || null;
  editorState.onStrokeStart = onStrokeStart || null;
  editorState.onStrokeComplete = onStrokeComplete || null;
  editorState.onActiveLayerChanged = onActiveLayerChanged || null;
  editorState.onLayerVisibilityChanged = onLayerVisibilityChanged || null;
  editorState.onSave = onSave || null;
  editorState.onExport = onExport || null;
  editorState.onUndo = onUndo || null;
  editorState.onRedo = onRedo || null;

  // Build DOM — REXPaint-style sidebar + canvas layout
  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'ws-layout';

  // Left sidebar (spec sections 3.1-3.6, 3.9)
  const sidebar = _buildSidebar(layers.length, activeLayer, layerNames, visibleLayers, gridCols, gridRows);
  layout.appendChild(sidebar);

  // Center canvas area (spec section 3.7)
  const canvasArea = document.createElement('div');
  canvasArea.className = 'ws-canvas-area';

  const scrollWrap = document.createElement('div');
  scrollWrap.id = 'wholeSheetScroll';
  scrollWrap.className = 'ws-scroll-wrap';
  canvasArea.appendChild(scrollWrap);

  const canvasEl = document.createElement('canvas');
  canvasEl.id = 'wholeSheetCanvas';
  canvasEl.style.imageRendering = 'pixelated';
  canvasEl.style.cursor = 'crosshair';
  scrollWrap.appendChild(canvasEl);

  // Secondary frame navigation region (spec §3.8)
  const frameNav = document.createElement('div');
  frameNav.className = 'ws-frame-nav';
  frameNav.id = 'wsFrameNav';
  const frameNavLabel = document.createElement('h4');
  frameNavLabel.textContent = 'Frame Navigation';
  frameNav.appendChild(frameNavLabel);
  canvasArea.appendChild(frameNav);

  layout.appendChild(canvasArea);
  container.appendChild(layout);

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

  // Populate layers panel now that LayerStack is ready
  _updateLayersPanelUI();

  // Create CellTool
  const cellTool = new CellTool();
  cellTool.setGlyph(editorState.drawGlyph);
  cellTool.setColors(editorState.drawFg, editorState.drawBg);
  cellTool.setApplyModes({
    glyph: editorState.applyGlyph,
    foreground: editorState.applyFg,
    background: editorState.applyBg,
  });
  editorState.cellTool = cellTool;

  // Create EyedropperTool
  const eyedropperTool = new EyedropperTool();
  eyedropperTool.setOnSample((glyph, fg, bg) => {
    _applyEyedropperSample(glyph, fg, bg);
  });
  editorState.eyedropperTool = eyedropperTool;

  // Create EraseTool
  const eraseTool = new EraseTool();
  editorState.eraseTool = eraseTool;

  // Create Line/Rect/Fill tool adapters
  editorState.lineTool = new LineToolAdapter();
  editorState.rectTool = new RectToolAdapter();
  editorState.fillTool = new FillToolAdapter();
  for (const t of [editorState.lineTool, editorState.rectTool, editorState.fillTool]) {
    t.setGlyph(editorState.drawGlyph);
    t.setColors(editorState.drawFg, editorState.drawBg);
    t.setApplyModes({ glyph: editorState.applyGlyph, foreground: editorState.applyFg, background: editorState.applyBg });
  }

  // Activate default tool
  editorState.activeTool = 'cell';
  canvas.toolActivated(cellTool);

  // Proxy canvas.setCell for callbacks
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

  // Stroke-complete detection
  canvasEl.addEventListener('mouseup', _onStrokeEnd);
  canvasEl.addEventListener('mouseleave', _onStrokeEnd);

  // Mouse tracking
  canvasEl.addEventListener('mousemove', _onCanvasMouseMove);

  // Keyboard shortcuts
  document.addEventListener('keydown', _onKeyDown);

  editorState.mounted = true;
  canvas.render();
  _updateToolUI();
  _renderGlyphPicker();
  _renderPaletteGrid();

  // Integrate frame navigation into the layout (spec §3.8)
  const gridPanel = document.getElementById('gridPanel');
  const frameNavEl = document.getElementById('wsFrameNav');
  if (gridPanel && frameNavEl) {
    editorState._originalGridParent = gridPanel.parentElement;
    editorState._originalGridNextSibling = gridPanel.nextSibling;
    frameNavEl.appendChild(gridPanel);
  }
}

// ── Stroke tracking ──

function _onStrokeEnd() {
  if (editorState._strokeDirty) {
    editorState._strokeDirty = false;
    if (editorState.onStrokeComplete) editorState.onStrokeComplete();
  }
}

// ── Eyedropper sample ──

function _applyEyedropperSample(glyph, fg, bg) {
  editorState.drawGlyph = glyph & 0xFF;
  editorState.drawFg = [...fg];
  editorState.drawBg = [...bg];

  _forEachTool(t => { t.setGlyph(editorState.drawGlyph); t.setColors(editorState.drawFg, editorState.drawBg); });

  const glyphEl = document.getElementById('wsGlyphCode');
  if (glyphEl) glyphEl.value = String(editorState.drawGlyph);
  const charEl = document.getElementById('wsGlyphChar');
  if (charEl) charEl.value = (glyph > 31 && glyph < 127) ? String.fromCharCode(glyph) : '';
  const fgEl = document.getElementById('wsFgColor');
  if (fgEl) fgEl.value = _rgbToHex(editorState.drawFg);
  const bgEl = document.getElementById('wsBgColor');
  if (bgEl) bgEl.value = _rgbToHex(editorState.drawBg);

  const cellEl = document.getElementById('wsCell');
  if (cellEl) {
    const ch = (glyph > 31 && glyph < 127) ? String.fromCharCode(glyph) : '\u00b7';
    cellEl.textContent = `Sampled: ${glyph} (${ch})`;
  }

  _renderGlyphPicker();
  _renderPaletteGrid();
}

// ── Tool switching ──

function _switchTool(name) {
  if (!editorState.mounted || !editorState.canvas) return;
  editorState.activeTool = name;
  const canvasEl = editorState.canvas.canvasElement;
  switch (name) {
    case 'cell':
      editorState.canvas.toolActivated(editorState.cellTool);
      if (canvasEl) canvasEl.style.cursor = 'crosshair';
      break;
    case 'eyedropper':
      editorState.canvas.toolActivated(editorState.eyedropperTool);
      if (canvasEl) canvasEl.style.cursor = 'copy';
      break;
    case 'erase':
      editorState.canvas.toolActivated(editorState.eraseTool);
      if (canvasEl) canvasEl.style.cursor = 'not-allowed';
      break;
    case 'line':
      editorState.canvas.toolActivated(editorState.lineTool);
      if (canvasEl) canvasEl.style.cursor = 'crosshair';
      break;
    case 'rect':
      editorState.canvas.toolActivated(editorState.rectTool);
      if (canvasEl) canvasEl.style.cursor = 'crosshair';
      break;
    case 'fill':
      editorState.canvas.toolActivated(editorState.fillTool);
      if (canvasEl) canvasEl.style.cursor = 'crosshair';
      break;
    default:
      return;
  }
  _updateToolUI();
}

function _updateToolUI() {
  const names = { cell: 'Cell', eyedropper: 'Eyedropper', erase: 'Erase', line: 'Line', rect: 'Rect', fill: 'Fill' };
  const toolEl = document.getElementById('wsActiveTool');
  if (toolEl) toolEl.textContent = `Tool: ${names[editorState.activeTool] || editorState.activeTool}`;

  for (const id of ['wsToolCell', 'wsToolEyedropper', 'wsToolErase', 'wsToolLine', 'wsToolRect', 'wsToolFill']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const toolName = id.replace('wsTool', '').toLowerCase();
    btn.classList.toggle('ws-tool-active', toolName === editorState.activeTool);
  }
}

// ── Keyboard shortcuts ──

function _onKeyDown(e) {
  if (!editorState.mounted) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  switch (e.key.toLowerCase()) {
    case 'c':
      _switchTool('cell');
      e.preventDefault();
      break;
    case 'e':
      _switchTool('erase');
      e.preventDefault();
      break;
    case 'd':
      _switchTool('eyedropper');
      e.preventDefault();
      break;
    case 'l':
      _switchTool('line');
      e.preventDefault();
      break;
    case 'r':
      _switchTool('rect');
      e.preventDefault();
      break;
    case 'i':
      _switchTool('fill');
      e.preventDefault();
      break;
  }
}

// ── Glyph picker ──

function _setDrawGlyph(code) {
  code = Math.max(0, Math.min(255, code));
  editorState.drawGlyph = code;
  _forEachTool(t => t.setGlyph(code));

  const glyphEl = document.getElementById('wsGlyphCode');
  if (glyphEl) glyphEl.value = String(code);
  const charEl = document.getElementById('wsGlyphChar');
  if (charEl) charEl.value = (code > 31 && code < 127) ? String.fromCharCode(code) : '';

  _renderGlyphPicker();
}

function _renderGlyphPicker() {
  const canvas = document.getElementById('wsGlyphPickerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const font = editorState.cp437Font;
  const cw = CELL_SIZE;
  const ch = CELL_SIZE;

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let code = 0; code < 256; code++) {
    const col = code % 16;
    const row = Math.floor(code / 16);
    const x = col * cw;
    const y = row * ch;
    const sel = (code === editorState.drawGlyph);

    if (font && font.spriteSheet) {
      const fg = sel ? editorState.drawFg : [180, 185, 195];
      const bg = sel ? editorState.drawBg : [10, 14, 20];
      font.drawGlyph(ctx, code, x, y, fg, bg);
    } else if (code > 31 && code < 127) {
      if (sel) {
        ctx.fillStyle = `rgb(${editorState.drawBg[0]},${editorState.drawBg[1]},${editorState.drawBg[2]})`;
        ctx.fillRect(x, y, cw, ch);
      }
      const fc = sel ? editorState.drawFg : [180, 185, 195];
      ctx.fillStyle = `rgb(${fc[0]},${fc[1]},${fc[2]})`;
      ctx.font = `${Math.floor(cw * 0.7)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String.fromCharCode(code), x + cw / 2, y + ch / 2);
    }

    if (sel) {
      ctx.strokeStyle = '#4ea1ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
    }
  }
}

// ── Sidebar builders ──

function _buildSection(title) {
  const section = document.createElement('div');
  section.className = 'ws-sidebar-section';
  const h4 = document.createElement('h4');
  h4.textContent = title;
  section.appendChild(h4);
  return section;
}

function _placeholder(text) {
  const el = document.createElement('div');
  el.className = 'ws-placeholder';
  el.textContent = text;
  return el;
}

function _buildSidebar(layerCount, activeLayer, layerNames, visibleLayers, gridCols, gridRows) {
  const sidebar = document.createElement('div');
  sidebar.className = 'ws-sidebar';

  // 3.1 Mode
  const modeSection = _buildSection('Mode');
  const modeGroup = document.createElement('div');
  modeGroup.className = 'ws-tool-group';
  const paintBtn = document.createElement('button');
  paintBtn.textContent = 'PAINT';
  paintBtn.className = 'ws-tool-btn ws-tool-active';
  const browseBtn = document.createElement('button');
  browseBtn.textContent = 'BROWSE';
  browseBtn.className = 'ws-tool-btn';
  browseBtn.disabled = true;
  browseBtn.title = 'Browse mode (deferred)';
  modeGroup.appendChild(paintBtn);
  modeGroup.appendChild(browseBtn);
  modeSection.appendChild(modeGroup);
  sidebar.appendChild(modeSection);

  // 3.2 Glyph — 16x16 CP437 picker (spec §3.2)
  const glyphSection = _buildSection('Glyph');

  const pickerCanvas = document.createElement('canvas');
  pickerCanvas.id = 'wsGlyphPickerCanvas';
  pickerCanvas.className = 'ws-glyph-picker-canvas';
  pickerCanvas.width = 16 * CELL_SIZE;
  pickerCanvas.height = 16 * CELL_SIZE;
  pickerCanvas.style.imageRendering = 'pixelated';
  pickerCanvas.style.cursor = 'pointer';
  pickerCanvas.title = 'Click to select glyph';

  pickerCanvas.addEventListener('click', (e) => {
    const rect = pickerCanvas.getBoundingClientRect();
    const scaleX = pickerCanvas.width / rect.width;
    const scaleY = pickerCanvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(px / CELL_SIZE);
    const row = Math.floor(py / CELL_SIZE);
    if (col < 0 || col >= 16 || row < 0 || row >= 16) return;
    _setDrawGlyph(row * 16 + col);
  });

  glyphSection.appendChild(pickerCanvas);

  const glyphRow = document.createElement('div');
  glyphRow.className = 'ws-glyph-row';
  const glyphInput = document.createElement('input');
  glyphInput.type = 'number';
  glyphInput.id = 'wsGlyphCode';
  glyphInput.min = '0';
  glyphInput.max = '255';
  glyphInput.value = String(editorState.drawGlyph);
  glyphInput.style.width = '48px';
  const glyphChar = document.createElement('input');
  glyphChar.type = 'text';
  glyphChar.id = 'wsGlyphChar';
  glyphChar.maxLength = 1;
  glyphChar.value = String.fromCharCode(editorState.drawGlyph);
  glyphChar.style.width = '28px';
  glyphChar.title = 'Type a character';

  glyphInput.addEventListener('change', () => {
    _setDrawGlyph(Math.max(0, Math.min(255, parseInt(glyphInput.value, 10) || 0)));
  });
  glyphChar.addEventListener('input', () => {
    if (glyphChar.value.length === 1) {
      _setDrawGlyph(glyphChar.value.charCodeAt(0) & 0xFF);
    }
  });

  glyphRow.appendChild(glyphInput);
  glyphRow.appendChild(glyphChar);
  glyphSection.appendChild(glyphRow);
  sidebar.appendChild(glyphSection);

  // 3.3 Palette (spec §3.3: color grid + fg/bg swatches)
  const paletteSection = _buildSection('Palette');

  const paletteCanvas = document.createElement('canvas');
  paletteCanvas.id = 'wsPaletteCanvas';
  paletteCanvas.className = 'ws-palette-canvas';
  paletteCanvas.width = PALETTE_COLS * PALETTE_CELL;
  paletteCanvas.height = PALETTE_ROWS * PALETTE_CELL;
  paletteCanvas.style.imageRendering = 'pixelated';
  paletteCanvas.style.cursor = 'pointer';
  paletteCanvas.title = 'LMB = set foreground, RMB = set background';
  paletteCanvas.addEventListener('click', (e) => _onPaletteClick(e, 'fg'));
  paletteCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    _onPaletteClick(e, 'bg');
  });
  paletteSection.appendChild(paletteCanvas);

  const swatchRow = document.createElement('div');
  swatchRow.className = 'ws-swatch-row';

  const fgLabel = document.createElement('span');
  fgLabel.className = 'ws-swatch-label';
  fgLabel.textContent = 'f';
  const fgInput = document.createElement('input');
  fgInput.type = 'color';
  fgInput.id = 'wsFgColor';
  fgInput.value = _rgbToHex(editorState.drawFg);
  fgInput.title = 'Foreground color';
  fgInput.addEventListener('input', () => {
    editorState.drawFg = _hexToRgb(fgInput.value);
    _forEachTool(t => t.setColors(editorState.drawFg, editorState.drawBg));
    _renderGlyphPicker();
    _renderPaletteGrid();
  });

  const bgLabel = document.createElement('span');
  bgLabel.className = 'ws-swatch-label';
  bgLabel.textContent = 'b';
  const bgInput = document.createElement('input');
  bgInput.type = 'color';
  bgInput.id = 'wsBgColor';
  bgInput.value = _rgbToHex(editorState.drawBg);
  bgInput.title = 'Background color';
  bgInput.addEventListener('input', () => {
    editorState.drawBg = _hexToRgb(bgInput.value);
    _forEachTool(t => t.setColors(editorState.drawFg, editorState.drawBg));
    _renderGlyphPicker();
    _renderPaletteGrid();
  });

  swatchRow.appendChild(fgLabel);
  swatchRow.appendChild(fgInput);
  swatchRow.appendChild(bgLabel);
  swatchRow.appendChild(bgInput);
  paletteSection.appendChild(swatchRow);
  sidebar.appendChild(paletteSection);

  // 3.4 Tools / Apply (spec §3.4: two-column layout)
  const toolsSection = _buildSection('Tools / Apply');
  const taCols = document.createElement('div');
  taCols.className = 'ws-ta-cols';

  // Left column — Tools: Undo, Redo, Grid
  const toolsCol = document.createElement('div');
  toolsCol.className = 'ws-ta-col';
  const toolsLabel = document.createElement('span');
  toolsLabel.className = 'ws-ta-label';
  toolsLabel.textContent = 'Tools';
  toolsCol.appendChild(toolsLabel);

  const undoBtn = document.createElement('button');
  undoBtn.id = 'wsUndoBtn';
  undoBtn.className = 'ws-tool-btn';
  undoBtn.textContent = 'Undo';
  undoBtn.title = 'Undo (Ctrl+Z)';
  undoBtn.addEventListener('click', () => { if (editorState.onUndo) editorState.onUndo(); });
  toolsCol.appendChild(undoBtn);

  const redoBtn = document.createElement('button');
  redoBtn.id = 'wsRedoBtn';
  redoBtn.className = 'ws-tool-btn';
  redoBtn.textContent = 'Redo';
  redoBtn.title = 'Redo (Ctrl+Y)';
  redoBtn.addEventListener('click', () => { if (editorState.onRedo) editorState.onRedo(); });
  toolsCol.appendChild(redoBtn);

  toolsCol.appendChild(_buildToggle('Grid', 'wsGridToggle', false, (on) => {
    if (editorState.canvas) editorState.canvas.setGridVisible(on);
  }));

  // Right column — Apply: G, F, B toggles
  const applyCol = document.createElement('div');
  applyCol.className = 'ws-ta-col';
  const applyLabel = document.createElement('span');
  applyLabel.className = 'ws-ta-label';
  applyLabel.textContent = 'Apply';
  applyCol.appendChild(applyLabel);

  applyCol.appendChild(_buildToggle('G', 'wsApplyGlyph', editorState.applyGlyph, (on) => {
    editorState.applyGlyph = on;
    _forEachTool(t => t.setApplyModes({ glyph: on }));
  }));
  applyCol.appendChild(_buildToggle('F', 'wsApplyFg', editorState.applyFg, (on) => {
    editorState.applyFg = on;
    _forEachTool(t => t.setApplyModes({ foreground: on }));
  }));
  applyCol.appendChild(_buildToggle('B', 'wsApplyBg', editorState.applyBg, (on) => {
    editorState.applyBg = on;
    _forEachTool(t => t.setApplyModes({ background: on }));
  }));

  taCols.appendChild(toolsCol);
  taCols.appendChild(applyCol);
  toolsSection.appendChild(taCols);
  sidebar.appendChild(toolsSection);

  // 3.5 Image / Draw (spec §3.5: two-column layout)
  const imageDrawSection = _buildSection('Image / Draw');
  const idCols = document.createElement('div');
  idCols.className = 'ws-ta-cols';

  // Left column — Image: Save, Export, Resize
  const imageCol = document.createElement('div');
  imageCol.className = 'ws-ta-col';
  const imageLabel = document.createElement('span');
  imageLabel.className = 'ws-ta-label';
  imageLabel.textContent = 'Image';
  imageCol.appendChild(imageLabel);
  imageCol.appendChild(_placeholder('New'));

  const saveBtn = document.createElement('button');
  saveBtn.id = 'wsSaveBtn';
  saveBtn.className = 'ws-tool-btn';
  saveBtn.textContent = 'Save';
  saveBtn.title = 'Save session to server';
  saveBtn.addEventListener('click', () => { if (editorState.onSave) editorState.onSave(); });
  imageCol.appendChild(saveBtn);

  const exportBtn = document.createElement('button');
  exportBtn.id = 'wsExportBtn';
  exportBtn.className = 'ws-tool-btn';
  exportBtn.textContent = 'Export';
  exportBtn.title = 'Export XP file (save + download)';
  exportBtn.addEventListener('click', () => { if (editorState.onExport) editorState.onExport(); });
  imageCol.appendChild(exportBtn);

  // Right column — Draw: active tool selector
  const drawCol = document.createElement('div');
  drawCol.className = 'ws-ta-col';
  const drawLabel = document.createElement('span');
  drawLabel.className = 'ws-ta-label';
  drawLabel.textContent = 'Draw';
  drawCol.appendChild(drawLabel);

  const toolCellBtn = document.createElement('button');
  toolCellBtn.id = 'wsToolCell';
  toolCellBtn.textContent = 'Cell';
  toolCellBtn.className = 'ws-tool-btn ws-tool-active';
  toolCellBtn.title = 'Cell draw tool (C)';
  toolCellBtn.addEventListener('click', () => _switchTool('cell'));
  drawCol.appendChild(toolCellBtn);

  const toolEyedropperBtn = document.createElement('button');
  toolEyedropperBtn.id = 'wsToolEyedropper';
  toolEyedropperBtn.textContent = 'Pick';
  toolEyedropperBtn.className = 'ws-tool-btn';
  toolEyedropperBtn.title = 'Eyedropper (D)';
  toolEyedropperBtn.addEventListener('click', () => _switchTool('eyedropper'));
  drawCol.appendChild(toolEyedropperBtn);

  const toolEraseBtn = document.createElement('button');
  toolEraseBtn.id = 'wsToolErase';
  toolEraseBtn.textContent = 'Erase';
  toolEraseBtn.className = 'ws-tool-btn';
  toolEraseBtn.title = 'Erase tool (E)';
  toolEraseBtn.addEventListener('click', () => _switchTool('erase'));
  drawCol.appendChild(toolEraseBtn);

  const toolLineBtn = document.createElement('button');
  toolLineBtn.id = 'wsToolLine';
  toolLineBtn.textContent = 'Line';
  toolLineBtn.className = 'ws-tool-btn';
  toolLineBtn.title = 'Line tool (L)';
  toolLineBtn.addEventListener('click', () => _switchTool('line'));
  drawCol.appendChild(toolLineBtn);

  const toolRectBtn = document.createElement('button');
  toolRectBtn.id = 'wsToolRect';
  toolRectBtn.textContent = 'Rect';
  toolRectBtn.className = 'ws-tool-btn';
  toolRectBtn.title = 'Rectangle tool (R)';
  toolRectBtn.addEventListener('click', () => _switchTool('rect'));
  drawCol.appendChild(toolRectBtn);

  const toolFillBtn = document.createElement('button');
  toolFillBtn.id = 'wsToolFill';
  toolFillBtn.textContent = 'Fill';
  toolFillBtn.className = 'ws-tool-btn';
  toolFillBtn.title = 'Flood fill tool (I)';
  toolFillBtn.addEventListener('click', () => _switchTool('fill'));
  drawCol.appendChild(toolFillBtn);

  idCols.appendChild(imageCol);
  idCols.appendChild(drawCol);
  imageDrawSection.appendChild(idCols);
  sidebar.appendChild(imageDrawSection);

  // 3.6 Layers
  const layersSection = _buildSection('Layers');
  const layersPanel = document.createElement('div');
  layersPanel.id = 'wsLayersPanel';
  layersPanel.className = 'ws-layers-panel';
  layersSection.appendChild(layersPanel);
  sidebar.appendChild(layersSection);

  // 3.9 Info
  const statusSection = document.createElement('div');
  statusSection.className = 'ws-sidebar-section ws-status-section';
  const statusH4 = document.createElement('h4');
  statusH4.textContent = 'Info';
  statusSection.appendChild(statusH4);

  const mkSpan = (id, text) => {
    const s = document.createElement('span');
    s.id = id;
    s.textContent = text;
    return s;
  };
  statusSection.appendChild(mkSpan('wsPos', 'Pos: -,-'));
  statusSection.appendChild(mkSpan('wsCell', 'Cell: --'));
  statusSection.appendChild(mkSpan('wsDims', `${gridCols}\u00d7${gridRows}`));
  statusSection.appendChild(mkSpan('wsLayers', `${layerCount} layers`));
  statusSection.appendChild(mkSpan('wsActiveTool', 'Tool: Cell'));
  statusSection.appendChild(mkSpan('wsActiveLayerInfo', `Layer: ${typeof activeLayer === 'number' ? activeLayer : 0}`));
  sidebar.appendChild(statusSection);

  return sidebar;
}

// ── Toggle button builder ──

function _buildToggle(label, id, initial, onChange) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = label;
  btn.className = 'ws-toggle' + (initial ? ' ws-toggle-on' : '');
  btn.title = `Toggle ${label}`;
  btn.addEventListener('click', () => {
    const on = !btn.classList.contains('ws-toggle-on');
    btn.classList.toggle('ws-toggle-on', on);
    onChange(on);
  });
  return btn;
}

// ── Layer panel ──

function _updateLayersPanelUI() {
  const panel = document.getElementById('wsLayersPanel');
  if (!panel || !editorState.layerStack) return;

  panel.innerHTML = '';
  const layers = editorState.layerStack.layers;
  const activeIdx = editorState.layerStack.activeIndex;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const row = document.createElement('div');
    row.className = 'ws-layer-row';
    if (i === activeIdx) row.classList.add('ws-layer-active');
    if (!layer.visible) row.classList.add('ws-layer-hidden');

    const visBtn = document.createElement('button');
    visBtn.className = 'ws-layer-vis-btn' + (layer.visible ? ' ws-layer-visible' : '');
    visBtn.textContent = layer.visible ? 'V' : '-';
    visBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleLayerVisibility(i);
    });

    const idxSpan = document.createElement('span');
    idxSpan.className = 'ws-layer-index';
    idxSpan.textContent = String(i);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ws-layer-name';
    nameSpan.textContent = layer.name || `Layer ${i}`;

    row.appendChild(visBtn);
    row.appendChild(idxSpan);
    row.appendChild(nameSpan);
    row.addEventListener('click', () => _switchActiveLayer(i));
    panel.appendChild(row);
  }

  // Update status info
  const infoEl = document.getElementById('wsActiveLayerInfo');
  if (infoEl && editorState.layerStack) {
    const layer = editorState.layerStack.layers[activeIdx];
    infoEl.textContent = `Layer: ${activeIdx}${layer ? ' (' + (layer.name || '') + ')' : ''}`;
  }
}

function _switchActiveLayer(index) {
  if (!editorState.layerStack) return;
  if (index < 0 || index >= editorState.layerStack.layers.length) return;

  editorState.layerStack.selectLayer(index);
  _updateLayersPanelUI();

  if (editorState.onActiveLayerChanged) {
    editorState.onActiveLayerChanged(index);
  }
}

function _toggleLayerVisibility(index) {
  if (!editorState.layerStack) return;
  const layer = editorState.layerStack.layers[index];
  if (!layer) return;

  const newVisible = !layer.visible;
  layer.setVisible(newVisible);
  _updateLayersPanelUI();

  if (editorState.canvas) editorState.canvas.render();

  if (editorState.onLayerVisibilityChanged) {
    editorState.onLayerVisibilityChanged(index, newVisible);
  }
}

// ── Helpers ──

function _rgbToHex(rgb) {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function _hexToRgb(hex) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function _setDrawColor(channel, rgb) {
  if (channel === 'fg') {
    editorState.drawFg = [...rgb];
    const el = document.getElementById('wsFgColor');
    if (el) el.value = _rgbToHex(rgb);
  } else {
    editorState.drawBg = [...rgb];
    const el = document.getElementById('wsBgColor');
    if (el) el.value = _rgbToHex(rgb);
  }
  _forEachTool(t => t.setColors(editorState.drawFg, editorState.drawBg));
  _renderGlyphPicker();
  _renderPaletteGrid();
}

function _renderPaletteGrid() {
  const canvas = document.getElementById('wsPaletteCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cs = PALETTE_CELL;

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < DEFAULT_PALETTE.length; i++) {
    const col = i % PALETTE_COLS;
    const row = Math.floor(i / PALETTE_COLS);
    const x = col * cs;
    const y = row * cs;
    const [r, g, b] = DEFAULT_PALETTE[i];

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, cs, cs);

    // Thin grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, cs, cs);

    // Highlight if matches current fg or bg
    const matchFg = editorState.drawFg[0] === r && editorState.drawFg[1] === g && editorState.drawFg[2] === b;
    const matchBg = editorState.drawBg[0] === r && editorState.drawBg[1] === g && editorState.drawBg[2] === b;
    if (matchFg) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
    }
    if (matchBg) {
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 1]);
      ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      ctx.setLineDash([]);
    }
  }
}

function _onPaletteClick(e, channel) {
  const canvas = document.getElementById('wsPaletteCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(px / PALETTE_CELL);
  const row = Math.floor(py / PALETTE_CELL);
  if (col < 0 || col >= PALETTE_COLS || row < 0 || row >= PALETTE_ROWS) return;
  const idx = row * PALETTE_COLS + col;
  if (idx >= 0 && idx < DEFAULT_PALETTE.length) {
    _setDrawColor(channel, DEFAULT_PALETTE[idx]);
  }
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
    } catch (_) {}
  }
}

// ── unmount ──

function unmount() {
  document.removeEventListener('keydown', _onKeyDown);

  if (editorState.canvas) {
    const canvasEl = editorState.canvas.canvasElement;
    if (canvasEl) {
      canvasEl.removeEventListener('mousemove', _onCanvasMouseMove);
      canvasEl.removeEventListener('mouseup', _onStrokeEnd);
      canvasEl.removeEventListener('mouseleave', _onStrokeEnd);
    }
    if (typeof editorState.canvas.dispose === 'function') editorState.canvas.dispose();
  }
  // Restore frame grid to original location
  if (editorState._originalGridParent) {
    const gridPanel = document.getElementById('gridPanel');
    if (gridPanel) {
      if (editorState._originalGridNextSibling) {
        editorState._originalGridParent.insertBefore(gridPanel, editorState._originalGridNextSibling);
      } else {
        editorState._originalGridParent.appendChild(gridPanel);
      }
    }
  }

  if (editorState.containerEl) editorState.containerEl.innerHTML = '';

  editorState = {
    mounted: false,
    canvas: null,
    layerStack: null,
    cp437Font: null,
    cellTool: null,
    eyedropperTool: null,
    eraseTool: null,
    lineTool: null,
    rectTool: null,
    fillTool: null,
    activeTool: 'cell',
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
    onActiveLayerChanged: null,
    onLayerVisibilityChanged: null,
    onSave: null,
    onExport: null,
    onUndo: null,
    onRedo: null,
    _strokeDirty: false,
    _originalGridParent: null,
    _originalGridNextSibling: null,
  };
}

// ── Public API ──

function panToFrame(row, col, frameWChars, frameHChars) {
  if (!editorState.mounted) return;
  const scrollWrap = document.getElementById('wholeSheetScroll');
  if (!scrollWrap) return;

  const targetX = col * frameWChars * CELL_SIZE;
  const targetY = row * frameHChars * CELL_SIZE;
  const framePixelW = frameWChars * CELL_SIZE;
  const framePixelH = frameHChars * CELL_SIZE;

  const viewW = scrollWrap.clientWidth;
  const viewH = scrollWrap.clientHeight;
  const scrollX = Math.max(0, targetX - (viewW - framePixelW) / 2);
  const scrollY = Math.max(0, targetY - (viewH - framePixelH) / 2);

  scrollWrap.scrollTo({ left: scrollX, top: scrollY, behavior: 'smooth' });
}

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

function getState() {
  return {
    mounted: editorState.mounted,
    gridCols: editorState.gridCols,
    gridRows: editorState.gridRows,
    layerCount: editorState.layerStack ? editorState.layerStack.layers.length : 0,
    activeLayerIndex: editorState.layerStack ? editorState.layerStack.activeIndex : 0,
    hasFontLoaded: !!(editorState.cp437Font && editorState.cp437Font.spriteSheet),
    activeTool: editorState.activeTool,
    drawGlyph: editorState.drawGlyph,
    drawFg: editorState.drawFg,
    drawBg: editorState.drawBg,
  };
}

function setDrawState({ glyph, fg, bg, applyGlyph, applyFg, applyBg }) {
  if (typeof glyph === 'number') {
    editorState.drawGlyph = glyph & 0xFF;
    _forEachTool(t => t.setGlyph(editorState.drawGlyph));
    const el = document.getElementById('wsGlyphCode');
    if (el) el.value = String(editorState.drawGlyph);
    const ch = document.getElementById('wsGlyphChar');
    if (ch) ch.value = (glyph > 31 && glyph < 127) ? String.fromCharCode(glyph) : '';
  }
  if (Array.isArray(fg) && fg.length === 3) {
    editorState.drawFg = fg.map(Number);
    _forEachTool(t => t.setColors(editorState.drawFg, editorState.drawBg));
    const el = document.getElementById('wsFgColor');
    if (el) el.value = _rgbToHex(editorState.drawFg);
  }
  if (Array.isArray(bg) && bg.length === 3) {
    editorState.drawBg = bg.map(Number);
    _forEachTool(t => t.setColors(editorState.drawFg, editorState.drawBg));
    const el = document.getElementById('wsBgColor');
    if (el) el.value = _rgbToHex(editorState.drawBg);
  }
  if (typeof applyGlyph === 'boolean') {
    editorState.applyGlyph = applyGlyph;
    _forEachTool(t => t.setApplyModes({ glyph: applyGlyph }));
    const el = document.getElementById('wsApplyGlyph');
    if (el) el.classList.toggle('ws-toggle-on', applyGlyph);
  }
  if (typeof applyFg === 'boolean') {
    editorState.applyFg = applyFg;
    _forEachTool(t => t.setApplyModes({ foreground: applyFg }));
    const el = document.getElementById('wsApplyFg');
    if (el) el.classList.toggle('ws-toggle-on', applyFg);
  }
  if (typeof applyBg === 'boolean') {
    editorState.applyBg = applyBg;
    _forEachTool(t => t.setApplyModes({ background: applyBg }));
    const el = document.getElementById('wsApplyBg');
    if (el) el.classList.toggle('ws-toggle-on', applyBg);
  }
  _renderGlyphPicker();
  _renderPaletteGrid();
}

function setActiveLayer(index) {
  _switchActiveLayer(index);
}

function setLayerVisibility(index, visible) {
  if (!editorState.layerStack) return;
  const layer = editorState.layerStack.layers[index];
  if (!layer) return;
  if (layer.visible === visible) return;
  _toggleLayerVisibility(index);
}

function getLayerInfo() {
  if (!editorState.layerStack) return [];
  return editorState.layerStack.layers.map((layer, i) => ({
    index: i,
    name: layer.name,
    active: i === editorState.layerStack.activeIndex,
    visible: layer.visible,
  }));
}

// ── Window export ──

window.__wholeSheetEditor = {
  mount,
  unmount,
  panToFrame,
  syncFromState,
  getState,
  setDrawState,
  setActiveLayer,
  setLayerVisibility,
  getLayerInfo,
};
