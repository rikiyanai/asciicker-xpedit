import { Canvas } from './canvas.js';
import { EditorApp } from './editor-app.js';
import { GlyphPicker } from './glyph-picker.js';
import { Palette } from './palette.js';
import { CellTool } from './tools/cell-tool.js';
import { FillTool } from './tools/fill-tool.js';
import { LineTool } from './tools/line-tool.js';
import { OvalTool } from './tools/oval-tool.js';
import { RectTool } from './tools/rect-tool.js';
import { SelectTool } from './tools/select-tool.js';

const STYLE_LINK_ID = 'rexpaintWorkbenchModalStyles';
const MODAL_STYLE_ID = 'rexpaintWorkbenchModalInlineStyles';

let activeModal = null;

function cloneCell(cell) {
  return {
    glyph: Number(cell?.glyph || 0),
    fg: [
      Number(cell?.fg?.[0] || 0),
      Number(cell?.fg?.[1] || 0),
      Number(cell?.fg?.[2] || 0),
    ],
    bg: [
      Number(cell?.bg?.[0] || 0),
      Number(cell?.bg?.[1] || 0),
      Number(cell?.bg?.[2] || 0),
    ],
  };
}

function cloneMatrix(matrix, width, height) {
  const out = [];
  for (let y = 0; y < height; y++) {
    const line = [];
    const srcLine = Array.isArray(matrix?.[y]) ? matrix[y] : [];
    for (let x = 0; x < width; x++) {
      line.push(cloneCell(srcLine[x]));
    }
    out.push(line);
  }
  return out;
}

function ensureStyles() {
  if (!document.getElementById(STYLE_LINK_ID)) {
    const link = document.createElement('link');
    link.id = STYLE_LINK_ID;
    link.rel = 'stylesheet';
    link.href = '/rexpaint-editor/styles.css';
    document.head.appendChild(link);
  }

  if (!document.getElementById(MODAL_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = MODAL_STYLE_ID;
    style.textContent = `
.rexpaint-workbench-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 10, 18, 0.78);
  backdrop-filter: blur(4px);
}

.rexpaint-workbench-shell {
  width: min(1320px, calc(100vw - 48px));
  height: min(880px, calc(100vh - 48px));
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: #101620;
  color: #d8e1ea;
  border: 1px solid rgba(112, 144, 176, 0.38);
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.rexpaint-workbench-header,
.rexpaint-workbench-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(112, 144, 176, 0.18);
}

.rexpaint-workbench-footer {
  border-bottom: 0;
  border-top: 1px solid rgba(112, 144, 176, 0.18);
  justify-content: space-between;
}

.rexpaint-workbench-title {
  font-size: 16px;
  font-weight: 700;
}

.rexpaint-workbench-subtitle {
  font-size: 12px;
  color: #91a7bc;
}

.rexpaint-workbench-header-spacer {
  flex: 1;
}

.rexpaint-workbench-body {
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(420px, 1fr) 320px;
  gap: 14px;
  padding: 14px 18px 18px;
}

.rexpaint-workbench-panel {
  min-height: 0;
  overflow: auto;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(112, 144, 176, 0.18);
  border-radius: 10px;
  padding: 12px;
}

.rexpaint-workbench-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.rexpaint-workbench-section:last-child {
  margin-bottom: 0;
}

.rexpaint-workbench-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #91a7bc;
}

.rexpaint-workbench-tools,
.rexpaint-workbench-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rexpaint-workbench-stage {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.rexpaint-workbench-canvas-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background:
    linear-gradient(135deg, rgba(42, 56, 74, 0.55), rgba(15, 21, 31, 0.75)),
    radial-gradient(circle at top left, rgba(82, 126, 168, 0.18), transparent 42%);
  border: 1px solid rgba(112, 144, 176, 0.18);
  border-radius: 10px;
}

.rexpaint-workbench-canvas-wrap canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.rexpaint-workbench-status {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #91a7bc;
}

.rexpaint-workbench-footer button,
.rexpaint-workbench-header button,
.rexpaint-workbench-tools button,
.rexpaint-workbench-inline button {
  cursor: pointer;
}

.rexpaint-workbench-footer .primary {
  background: #7ec8a5;
  color: #0f1a17;
  border-color: rgba(126, 200, 165, 0.4);
}

.rexpaint-workbench-note {
  font-size: 12px;
  line-height: 1.45;
  color: #91a7bc;
}

@media (max-width: 1100px) {
  .rexpaint-workbench-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(320px, 1fr) auto;
  }
}
`;
    document.head.appendChild(style);
  }
}

function createButton(label, onClick, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (extraClass) button.className = extraClass;
  button.addEventListener('click', onClick);
  return button;
}

function buildModalShell({ title, subtitle }) {
  const overlay = document.createElement('div');
  overlay.className = 'rexpaint-workbench-modal';
  overlay.innerHTML = `
    <div class="rexpaint-workbench-shell" role="dialog" aria-modal="true" aria-label="XP Editor">
      <div class="rexpaint-workbench-header">
        <div>
          <div class="rexpaint-workbench-title"></div>
          <div class="rexpaint-workbench-subtitle"></div>
        </div>
        <div class="rexpaint-workbench-header-spacer"></div>
        <button type="button" data-action="close">Close</button>
      </div>
      <div class="rexpaint-workbench-body">
        <div class="rexpaint-workbench-panel" data-panel="left"></div>
        <div class="rexpaint-workbench-stage">
          <div class="rexpaint-workbench-panel rexpaint-workbench-canvas-wrap">
            <canvas id="rexpaintCanvas"></canvas>
          </div>
        </div>
        <div class="rexpaint-workbench-panel" data-panel="right"></div>
      </div>
      <div class="rexpaint-workbench-footer">
        <div class="rexpaint-workbench-note" id="rexpaintWorkbenchNote"></div>
        <div class="rexpaint-workbench-inline">
          <button type="button" data-action="cancel">Cancel</button>
          <button type="button" class="primary" data-action="save">Apply To Frame</button>
        </div>
      </div>
    </div>
  `;
  overlay.querySelector('.rexpaint-workbench-title').textContent = title;
  overlay.querySelector('.rexpaint-workbench-subtitle').textContent = subtitle;
  return overlay;
}

function mountUi(shell) {
  const left = shell.querySelector('[data-panel="left"]');
  const right = shell.querySelector('[data-panel="right"]');
  const stage = shell.querySelector('.rexpaint-workbench-stage');

  left.innerHTML = `
    <div class="rexpaint-workbench-section">
      <div class="rexpaint-workbench-label">Tools</div>
      <div class="rexpaint-workbench-tools" id="rexpaintToolButtons"></div>
    </div>
    <div class="rexpaint-workbench-section">
      <div class="rexpaint-workbench-label">Apply Channels</div>
      <div class="rexpaint-workbench-inline">
        <button type="button" id="applyGlyph" class="active">Glyph</button>
        <button type="button" id="applyForeground" class="active">FG</button>
        <button type="button" id="applyBackground" class="active">BG</button>
        <button type="button" id="gridToggle">Grid</button>
      </div>
    </div>
    <div class="rexpaint-workbench-section">
      <div class="rexpaint-workbench-label">Palette</div>
      <div id="paletteMount"></div>
    </div>
    <div class="rexpaint-workbench-section">
      <div class="rexpaint-workbench-label">Layers</div>
      <div id="layerList"></div>
    </div>
  `;

  right.innerHTML = `
    <div class="rexpaint-workbench-section">
      <div class="rexpaint-workbench-label">Glyph Picker</div>
      <div id="glyphPickerMount"></div>
    </div>
  `;

  const statusPanel = document.createElement('div');
  statusPanel.className = 'rexpaint-workbench-panel';
  statusPanel.innerHTML = `
    <div class="rexpaint-workbench-status">
      <span id="toolDisplay">Tool: Cell</span>
      <span id="modeDisplay">Mode: G|F|B</span>
      <span id="posDisplay">Pos: 0, 0</span>
      <span id="cellDisplay">Cell: (empty)</span>
    </div>
  `;
  stage.appendChild(statusPanel);
}

function collectMatrix(app, width, height) {
  const layer = app.layerStack?.getActiveLayer?.();
  const out = [];
  for (let y = 0; y < height; y++) {
    const line = [];
    for (let x = 0; x < width; x++) {
      const cell = layer?.getCell(x, y) || app.canvas.getCell(x, y);
      line.push(cloneCell(cell));
    }
    out.push(line);
  }
  return out;
}

function loadMatrix(app, matrix, width, height) {
  const layer = app.layerStack?.getActiveLayer?.();
  if (!layer) return;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = cloneCell(matrix?.[y]?.[x]);
      layer.setCell(x, y, cell.glyph, cell.fg, cell.bg);
    }
  }
  app.canvas.render();
}

function wireToolButtons(app, tools) {
  const root = document.getElementById('rexpaintToolButtons');
  if (!root) return;
  const defs = [
    ['Cell', tools.cellTool],
    ['Select', tools.selectTool],
    ['Line', tools.lineTool],
    ['Rect', tools.rectTool],
    ['Oval', tools.ovalTool],
    ['Fill', tools.fillTool],
  ];
  const buttons = new Map();
  for (const [label, tool] of defs) {
    const button = createButton(label, () => {
      app.activateTool(tool);
      for (const btn of buttons.values()) btn.classList.remove('active');
      button.classList.add('active');
    });
    root.appendChild(button);
    buttons.set(label, button);
  }
  const first = buttons.get('Cell');
  if (first) first.classList.add('active');
}

function createEditorApp(width, height) {
  const canvas = new Canvas(document.getElementById('rexpaintCanvas'), width, height, 18);
  const palette = new Palette();
  const glyphPicker = new GlyphPicker();
  palette.render(document.getElementById('paletteMount'));
  glyphPicker.render(document.getElementById('glyphPickerMount'));

  const cellTool = new CellTool();
  const selectTool = new SelectTool();
  const lineTool = new LineTool();
  const rectTool = new RectTool();
  const ovalTool = new OvalTool();
  const fillTool = new FillTool();
  const tools = [cellTool, selectTool, lineTool, rectTool, ovalTool, fillTool];

  for (const tool of tools) {
    if (typeof tool.setCanvas === 'function') {
      tool.setCanvas(canvas);
    }
  }

  const app = new EditorApp({
    canvas,
    palette,
    glyphPicker,
    tools,
    modalElement: document.querySelector('.rexpaint-workbench-shell'),
  });
  app.activateTool(cellTool);
  wireToolButtons(app, { cellTool, selectTool, lineTool, rectTool, ovalTool, fillTool });
  return app;
}

export async function openWorkbenchEditorModal({
  title,
  subtitle,
  frameWidth,
  frameHeight,
  matrix,
  onSave,
  onClose,
}) {
  ensureStyles();
  if (activeModal && typeof activeModal.close === 'function') {
    activeModal.close({ cancelled: true });
  }

  const overlay = buildModalShell({ title, subtitle });
  mountUi(overlay);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const app = createEditorApp(frameWidth, frameHeight);
  loadMatrix(app, cloneMatrix(matrix, frameWidth, frameHeight), frameWidth, frameHeight);
  document.getElementById('rexpaintWorkbenchNote').textContent =
    'Standalone REXPaint editor mounted into the workbench. Apply writes the edited frame back into the current bundle/session grid.';

  let closed = false;
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close({ cancelled: true });
    }
  };

  const teardown = (result = {}) => {
    if (closed) return result;
    closed = true;
    window.removeEventListener('keydown', onKey);
    try {
      app.dispose();
    } catch (_e) {}
    try {
      overlay.remove();
    } catch (_e) {}
    document.body.style.overflow = '';
    if (activeModal && activeModal.close === close) {
      activeModal = null;
    }
    if (typeof onClose === 'function') onClose(result);
    return result;
  };

  const close = (result = {}) => teardown(result);

  const apply = async () => {
    const nextMatrix = collectMatrix(app, frameWidth, frameHeight);
    if (typeof onSave === 'function') {
      await onSave(nextMatrix);
    }
    close({ saved: true });
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close({ cancelled: true });
  });
  overlay.querySelector('[data-action="close"]').addEventListener('click', () => close({ cancelled: true }));
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ cancelled: true }));
  overlay.querySelector('[data-action="save"]').addEventListener('click', () => void apply());
  window.addEventListener('keydown', onKey);

  activeModal = { close };
  return activeModal;
}
