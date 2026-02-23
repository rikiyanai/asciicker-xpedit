(() => {
  "use strict";

  const MAGENTA = [255, 0, 255];
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const DEFAULT_LAYER_NAMES = ["Metadata", "Layer 1", "Visual", "Layer 3"];

  const state = {
    jobId: params.get("job_id") || "",
    sessionId: null,
    latestXpPath: "",
    sourcePath: "",
    sourceImage: null,
    drawMode: false,
    drawing: false,
    drawStart: null,
    drawCurrent: null,
    anchorBox: null,
    extractedBoxes: [],
    cells: [],
    gridCols: 0,
    gridRows: 0,
    angles: 1,
    anims: [1],
    sourceProjs: 1,
    projs: 1,
    cellWChars: 1,
    cellHChars: 1,
    frameWChars: 1,
    frameHChars: 1,
    selectedRow: null,
    selectedCols: new Set(),
    rowCategories: {},
    frameGroups: [],
    layers: [],
    layerNames: [...DEFAULT_LAYER_NAMES],
    activeLayer: 2,
    visibleLayers: new Set([2]),
    inspectorOpen: false,
    inspectorRow: 0,
    inspectorCol: 0,
    inspectorZoom: 10,
    history: [],
    future: [],
    previewTimer: null,
    previewFrameIdx: 0,
  };

  function status(text, cls) {
    const el = $("wbStatus");
    el.className = "small " + (cls || "");
    el.textContent = text;
  }

  function setXpToolHint(text) {
    const el = $("xpToolCommandHint");
    if (!el) return;
    el.textContent = text;
  }

  async function refreshXpToolCommand(xpPath) {
    if (!xpPath) return;
    try {
      const r = await fetch("/api/workbench/xp-tool-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp_path: xpPath }),
      });
      const j = await r.json();
      if (!r.ok) {
        setXpToolHint(`XP Tool command unavailable: ${j.error || "request failed"}`);
        return;
      }
      setXpToolHint(`XP Tool: ${j.command}`);
    } catch (e) {
      setXpToolHint("XP Tool command unavailable: fetch error");
    }
  }

  async function openInXpTool() {
    if (!state.latestXpPath) {
      status("Export an .xp before opening XP Tool", "warn");
      return;
    }
    try {
      const r = await fetch("/api/workbench/open-in-xp-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp_path: state.latestXpPath }),
      });
      const j = await r.json();
      if (!r.ok) {
        status("XP Tool launch failed", "err");
        setXpToolHint(`XP Tool launch failed: ${j.error || "request failed"}`);
        return;
      }
      status("XP Tool launch requested", "ok");
      setXpToolHint(`XP Tool: ${j.command}`);
    } catch (e) {
      status("XP Tool launch failed", "err");
      setXpToolHint("XP Tool launch failed: fetch error");
    }
  }

  function deepCloneCells(cells) {
    return cells.map((c) => ({
      idx: Number(c.idx),
      glyph: Number(c.glyph || 0),
      fg: [Number(c.fg?.[0] || 0), Number(c.fg?.[1] || 0), Number(c.fg?.[2] || 0)],
      bg: [Number(c.bg?.[0] || 0), Number(c.bg?.[1] || 0), Number(c.bg?.[2] || 0)],
    }));
  }

  function snapshot() {
    return {
      cells: deepCloneCells(state.cells),
      angles: state.angles,
      anims: [...state.anims],
      projs: state.projs,
      sourceProjs: state.sourceProjs,
      cellWChars: state.cellWChars,
      cellHChars: state.cellHChars,
      selectedRow: state.selectedRow,
      selectedCols: [...state.selectedCols],
      rowCategories: { ...state.rowCategories },
      frameGroups: JSON.parse(JSON.stringify(state.frameGroups)),
      anchorBox: state.anchorBox ? { ...state.anchorBox } : null,
      extractedBoxes: state.extractedBoxes.map((b) => ({ ...b })),
    };
  }

  function restore(snap) {
    state.cells = deepCloneCells(snap.cells);
    state.angles = Number(snap.angles || 1);
    state.anims = (snap.anims || [1]).map((x) => Number(x));
    state.sourceProjs = Number(snap.sourceProjs || state.sourceProjs || 1);
    state.projs = Number(snap.projs || 1);
    state.cellWChars = Number(snap.cellWChars || state.cellWChars || 1);
    state.cellHChars = Number(snap.cellHChars || state.cellHChars || 1);
    state.selectedRow = snap.selectedRow;
    state.selectedCols = new Set((snap.selectedCols || []).map((x) => Number(x)));
    state.rowCategories = { ...(snap.rowCategories || {}) };
    state.frameGroups = JSON.parse(JSON.stringify(snap.frameGroups || []));
    state.anchorBox = snap.anchorBox ? { ...snap.anchorBox } : null;
    state.extractedBoxes = (snap.extractedBoxes || []).map((b) => ({ ...b }));
    syncLayersFromSessionCells();
    recomputeFrameGeometry();
    renderAll();
  }

  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 50) state.history.shift();
    state.future = [];
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    $("undoBtn").disabled = state.history.length === 0;
    $("redoBtn").disabled = state.future.length === 0;
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(snapshot());
    const prev = state.history.pop();
    restore(prev);
    updateUndoRedoButtons();
    saveSessionState("undo");
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(snapshot());
    const next = state.future.pop();
    restore(next);
    updateUndoRedoButtons();
    saveSessionState("redo");
  }

  function recomputeFrameGeometry() {
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const frameCols = Math.max(1, semanticFrames * Math.max(1, state.projs));
    const frameRows = Math.max(1, state.angles);
    const computedW = Math.max(1, Math.floor(state.gridCols / frameCols));
    const computedH = Math.max(1, Math.floor(state.gridRows / frameRows));
    // Prefer metadata char geometry when integer division is not exact.
    state.frameWChars = state.gridCols % frameCols === 0 ? computedW : Math.max(1, Number(state.cellWChars || computedW));
    state.frameHChars = state.gridRows % frameRows === 0 ? computedH : Math.max(1, Number(state.cellHChars || computedH));
    $("previewAngle").max = String(Math.max(0, state.angles - 1));
  }

  function cellAt(x, y) {
    const idx = y * state.gridCols + x;
    return state.cells[idx] || { idx, glyph: 0, fg: [0, 0, 0], bg: [...MAGENTA] };
  }

  function setCell(x, y, c) {
    const idx = y * state.gridCols + x;
    const cell = {
      idx,
      glyph: Number(c.glyph || 0),
      fg: [Number(c.fg?.[0] || 0), Number(c.fg?.[1] || 0), Number(c.fg?.[2] || 0)],
      bg: [Number(c.bg?.[0] || 0), Number(c.bg?.[1] || 0), Number(c.bg?.[2] || 0)],
    };
    state.cells[idx] = cell;
    if (state.layers[2]) state.layers[2][idx] = { ...cell };
  }

  function isMagenta(rgb) {
    return rgb[0] === 255 && rgb[1] === 0 && rgb[2] === 255;
  }

  function transparentCell(idx) {
    return { idx, glyph: 0, fg: [0, 0, 0], bg: [...MAGENTA] };
  }

  function digitGlyph(v) {
    if (v >= 0 && v <= 9) return 48 + v;
    if (v >= 10 && v <= 35) return 65 + (v - 10);
    return 0;
  }

  function buildMetadataLayerCells() {
    const count = state.gridCols * state.gridRows;
    const layer = [];
    for (let i = 0; i < count; i++) layer.push(transparentCell(i));
    if (state.gridCols <= 0 || state.gridRows <= 0) return layer;
    layer[0] = { idx: 0, glyph: digitGlyph(state.angles), fg: [255, 255, 255], bg: [0, 0, 0] };
    for (let i = 0; i < state.anims.length && i + 1 < state.gridCols; i++) {
      layer[i + 1] = { idx: i + 1, glyph: digitGlyph(Number(state.anims[i] || 0)), fg: [255, 255, 255], bg: [0, 0, 0] };
    }
    return layer;
  }

  function buildBlankLayerCells() {
    const count = state.gridCols * state.gridRows;
    const layer = [];
    for (let i = 0; i < count; i++) layer.push(transparentCell(i));
    return layer;
  }

  function syncLayersFromSessionCells() {
    const count = state.gridCols * state.gridRows;
    const visual = deepCloneCells(state.cells);
    if (visual.length !== count) {
      state.cells = buildBlankLayerCells();
    }
    state.layers = [
      buildMetadataLayerCells(),
      buildBlankLayerCells(),
      deepCloneCells(state.cells),
      buildBlankLayerCells(),
    ];
    state.layerNames = [...DEFAULT_LAYER_NAMES];
    if (state.activeLayer < 0 || state.activeLayer >= state.layers.length) state.activeLayer = 2;
    if (!state.visibleLayers || state.visibleLayers.size <= 0) state.visibleLayers = new Set([2]);
    if (![...state.visibleLayers].some((v) => v >= 0 && v < state.layers.length)) {
      state.visibleLayers = new Set([2]);
    }
  }

  function layerCellAt(layerIdx, x, y) {
    const idx = y * state.gridCols + x;
    const layer = state.layers[layerIdx];
    if (!layer || !layer[idx]) return transparentCell(idx);
    return layer[idx];
  }

  function cellForRender(x, y) {
    const idx = y * state.gridCols + x;
    let out = transparentCell(idx);
    for (let l = 0; l < state.layers.length; l++) {
      if (!state.visibleLayers.has(l)) continue;
      const c = layerCellAt(l, x, y);
      if (Number(c.glyph || 0) > 32) out = c;
    }
    return out;
  }

  function editableLayerActive() {
    return state.activeLayer === 2;
  }

  function renderLayerControls() {
    const sel = $("layerSelect");
    const vis = $("layerVisibility");
    if (!sel || !vis) return;
    sel.innerHTML = "";
    for (let i = 0; i < state.layers.length; i++) {
      const opt = document.createElement("option");
      const nm = state.layerNames[i] || `Layer ${i}`;
      opt.value = String(i);
      opt.textContent = `${i}: ${nm}`;
      sel.appendChild(opt);
    }
    sel.value = String(Math.max(0, Math.min(state.layers.length - 1, state.activeLayer)));
    vis.innerHTML = "";
    for (let i = 0; i < state.layers.length; i++) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.visibleLayers.has(i);
      cb.dataset.layer = String(i);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(state.layerNames[i] || `Layer ${i}`));
      vis.appendChild(label);
    }
    const hint = $("layerHint");
    if (hint) {
      hint.textContent = editableLayerActive()
        ? "Active layer editable. Double-click frame to inspect and zoom."
        : "Active layer is read-only. Visual layer (2) is editable.";
    }
  }

  function drawHalfCell(ctx, px, py, scale, glyph, fg, bg) {
    const topY = py;
    const botY = py + scale;
    const drawRect = (x, y, color) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, scale, scale);
    };
    const fgCss = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
    const bgCss = isMagenta(bg) ? null : `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    if (glyph === 219) {
      drawRect(px, topY, fgCss);
      drawRect(px, botY, fgCss);
      return;
    }
    if (glyph === 223) {
      drawRect(px, topY, fgCss);
      drawRect(px, botY, bgCss);
      return;
    }
    if (glyph === 220) {
      drawRect(px, topY, bgCss);
      drawRect(px, botY, fgCss);
      return;
    }
    if (glyph === 0 || glyph === 32) {
      drawRect(px, topY, bgCss);
      drawRect(px, botY, bgCss);
      return;
    }
    drawRect(px, topY, fgCss);
    drawRect(px, botY, fgCss);
  }

  function renderLegacyGrid() {
    const grid = $("grid");
    const cols = state.gridCols;
    const rows = state.gridRows;
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${cols}, 22px)`;
    for (let i = 0; i < cols * rows; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      const x = i % cols;
      const y = Math.floor(i / cols);
      const cell = cellForRender(x, y);
      if (cell) {
        const glyph = Number(cell.glyph || 32);
        c.textContent = glyph <= 32 ? "·" : String.fromCharCode(glyph);
        const fg = Array.isArray(cell.fg) ? cell.fg : [220, 220, 220];
        const bg = Array.isArray(cell.bg) ? cell.bg : [0, 0, 0];
        c.style.color = glyph <= 32 ? "rgb(70,80,95)" : `rgb(${fg[0]},${fg[1]},${fg[2]})`;
        c.style.backgroundColor = isMagenta(bg) ? "rgb(11,15,23)" : `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      } else {
        c.textContent = "·";
        c.style.color = "rgb(70,80,95)";
      }
      grid.appendChild(c);
    }
  }

  function selectedFrameColsTotal() {
    return [...state.selectedCols].sort((a, b) => a - b);
  }

  function makeFrameCanvas(row, col, selected, rowSelected, groupSelected) {
    const frame = document.createElement("div");
    frame.className = "frame-cell";
    if (selected) frame.classList.add("selected");
    if (rowSelected) frame.classList.add("row-selected");
    if (groupSelected) frame.classList.add("group-selected");
    frame.dataset.row = String(row);
    frame.dataset.col = String(col);

    const canvas = document.createElement("canvas");
    const pixW = state.frameWChars;
    const pixH = state.frameHChars * 2;
    const scale = Math.max(1, Math.floor(56 / Math.max(pixW, pixH)));
    canvas.width = pixW * scale;
    canvas.height = pixH * scale;
    canvas.style.width = "64px";
    canvas.style.height = "64px";
    canvas.style.imageRendering = "pixelated";
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let cy = 0; cy < state.frameHChars; cy++) {
      for (let cx = 0; cx < state.frameWChars; cx++) {
        const gx = col * state.frameWChars + cx;
        const gy = row * state.frameHChars + cy;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        const c = cellForRender(gx, gy);
        drawHalfCell(ctx, cx * scale, cy * scale * 2, scale, Number(c.glyph || 0), c.fg || [0, 0, 0], c.bg || [0, 0, 0]);
      }
    }

    const label = document.createElement("div");
    label.className = "frame-label";
    label.textContent = `r${row} c${col}`;
    frame.appendChild(canvas);
    frame.appendChild(label);
    return frame;
  }

  function renderFrameGrid() {
    const panel = $("gridPanel");
    panel.innerHTML = "";
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const frameCols = semanticFrames * Math.max(1, state.projs);
    panel.style.gridTemplateColumns = `repeat(${frameCols}, 68px)`;
    for (let row = 0; row < state.angles; row++) {
      for (let col = 0; col < frameCols; col++) {
        const selected = state.selectedRow === row && state.selectedCols.has(col);
        const rowSelected = state.selectedRow === row;
        const groupSelected = state.frameGroups.some((g) => Number(g.row) === row && (g.cols || []).includes(col));
        const cellEl = makeFrameCanvas(row, col, selected, rowSelected, groupSelected);
        panel.appendChild(cellEl);
      }
    }
    updateActionButtons();
  }

  function renderMeta() {
    $("metaOut").textContent = JSON.stringify(
      {
        angles: state.angles,
        anims: state.anims,
        source_projs: state.sourceProjs,
        projs: state.projs,
        frame_w_chars: state.frameWChars,
        frame_h_chars: state.frameHChars,
        cell_w_chars: state.cellWChars,
        cell_h_chars: state.cellHChars,
        row_categories: state.rowCategories,
        frame_groups: state.frameGroups,
      },
      null,
      2
    );
  }

  function renderSession() {
    const summary = {
      session_id: state.sessionId,
      job_id: state.jobId,
      angles: state.angles,
      anims: state.anims,
      source_projs: state.sourceProjs,
      projs: state.projs,
      grid_cols: state.gridCols,
      grid_rows: state.gridRows,
      cell_w: state.cellWChars,
      cell_h: state.cellHChars,
      render_resolution: Number($("wbRenderRes").value || 12),
      cell_count: state.cells.length,
    };
    $("sessionOut").textContent = JSON.stringify(summary, null, 2);
  }

  function renderSourceCanvas() {
    const canvas = $("sourceCanvas");
    const ctx = canvas.getContext("2d");
    if (!state.sourceImage) {
      ctx.fillStyle = "rgb(8,12,18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      $("sourceInfo").textContent = "No source image loaded.";
      return;
    }
    canvas.width = state.sourceImage.width;
    canvas.height = state.sourceImage.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.sourceImage, 0, 0);

    const drawBox = (b, color, width = 1) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    };
    for (const b of state.extractedBoxes) drawBox(b, "rgba(243,182,63,0.95)", 1);
    if (state.anchorBox) drawBox(state.anchorBox, "rgba(79,209,122,0.95)", 2);
    if (state.drawCurrent) drawBox(state.drawCurrent, "rgba(78,161,255,0.95)", 1);

    const anchorTxt = state.anchorBox ? ` anchor=${state.anchorBox.w}x${state.anchorBox.h}` : "";
    $("sourceInfo").textContent = `sprites_detected=${state.extractedBoxes.length}${anchorTxt}`;
  }

  function renderPreviewFrame(row, frame) {
    const canvas = $("previewCanvas");
    const ctx = canvas.getContext("2d");
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const col = Math.min(Math.max(0, frame), semanticFrames - 1);
    const pixW = state.frameWChars;
    const pixH = state.frameHChars * 2;
    const scale = Math.max(1, Math.floor(Math.min(canvas.width / pixW, canvas.height / pixH)));
    const drawW = pixW * scale;
    const drawH = pixH * scale;
    const ox = Math.floor((canvas.width - drawW) / 2);
    const oy = Math.floor((canvas.height - drawH) / 2);
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let cy = 0; cy < state.frameHChars; cy++) {
      for (let cx = 0; cx < state.frameWChars; cx++) {
        const gx = col * state.frameWChars + cx;
        const gy = row * state.frameHChars + cy;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        const c = cellForRender(gx, gy);
        drawHalfCell(ctx, ox + cx * scale, oy + cy * scale * 2, scale, Number(c.glyph || 0), c.fg || [0, 0, 0], c.bg || [0, 0, 0]);
      }
    }
  }

  function frameColInfo(col) {
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const proj = Math.floor(col / semanticFrames);
    const frame = col % semanticFrames;
    return { semanticFrames, proj, frame };
  }

  function openInspector(row, col) {
    state.inspectorOpen = true;
    state.inspectorRow = Math.max(0, row);
    state.inspectorCol = Math.max(0, col);
    const panel = $("cellInspectorPanel");
    if (panel) panel.classList.remove("hidden");
    renderInspector();
  }

  function closeInspector() {
    state.inspectorOpen = false;
    const panel = $("cellInspectorPanel");
    if (panel) panel.classList.add("hidden");
  }

  function renderInspector() {
    const panel = $("cellInspectorPanel");
    const canvas = $("cellInspectorCanvas");
    if (!panel || !canvas) return;
    if (!state.inspectorOpen) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    const zoom = Math.max(4, Math.min(28, Number(state.inspectorZoom || 10)));
    state.inspectorZoom = zoom;
    $("inspectorZoom").value = String(zoom);
    $("inspectorZoomValue").textContent = `${zoom}x`;

    const row = Math.max(0, Math.min(state.angles - 1, state.inspectorRow));
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const maxCol = Math.max(0, semanticFrames * Math.max(1, state.projs) - 1);
    const col = Math.max(0, Math.min(maxCol, state.inspectorCol));

    const pixW = state.frameWChars;
    const pixH = state.frameHChars * 2;
    canvas.width = Math.max(1, pixW * zoom);
    canvas.height = Math.max(1, pixH * zoom);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let cy = 0; cy < state.frameHChars; cy++) {
      for (let cx = 0; cx < state.frameWChars; cx++) {
        const gx = col * state.frameWChars + cx;
        const gy = row * state.frameHChars + cy;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        const c = cellForRender(gx, gy);
        drawHalfCell(ctx, cx * zoom, cy * zoom * 2, zoom, Number(c.glyph || 0), c.fg || [0, 0, 0], c.bg || [0, 0, 0]);
      }
    }

    ctx.strokeStyle = "rgba(88,108,136,0.35)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= pixW; x++) {
      const px = x * zoom + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= pixH; y++) {
      const py = y * zoom + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
    }

    const info = frameColInfo(col);
    $("cellInspectorInfo").textContent = [
      `row=${row} col=${col}`,
      `angle=${row} proj=${info.proj} frame=${info.frame}/${Math.max(0, info.semanticFrames - 1)}`,
      `active_layer=${state.activeLayer} visible_layers=[${[...state.visibleLayers].sort((a, b) => a - b).join(",")}]`,
      `frame_chars=${state.frameWChars}x${state.frameHChars * 2}`,
    ].join(" | ");
  }

  function stopPreview() {
    if (state.previewTimer) {
      clearInterval(state.previewTimer);
      state.previewTimer = null;
    }
  }

  function startPreview() {
    stopPreview();
    const fps = Math.max(1, Number($("fpsInput").value || 8));
    const row = Math.max(0, Math.min(state.angles - 1, Number($("previewAngle").value || 0)));
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    state.previewTimer = setInterval(() => {
      renderPreviewFrame(row, state.previewFrameIdx % semanticFrames);
      state.previewFrameIdx += 1;
    }, Math.floor(1000 / fps));
  }

  function updateActionButtons() {
    const hasRow = state.selectedRow !== null;
    const hasSelection = hasRow && state.selectedCols.size > 0;
    const readOnly = !editableLayerActive();
    $("rowUpBtn").disabled = readOnly || !hasRow || state.selectedRow <= 0;
    $("rowDownBtn").disabled = readOnly || !hasRow || state.selectedRow >= state.angles - 1;
    const maxCol = Math.max(0, state.anims.reduce((a, b) => a + b, 0) * state.projs - 1);
    const minSel = hasSelection ? Math.min(...state.selectedCols) : 0;
    const maxSel = hasSelection ? Math.max(...state.selectedCols) : 0;
    $("colLeftBtn").disabled = readOnly || !hasSelection || minSel <= 0;
    $("colRightBtn").disabled = readOnly || !hasSelection || maxSel >= maxCol;
    $("deleteCellBtn").disabled = readOnly || !hasSelection;
    $("assignAnimCategoryBtn").disabled = readOnly || !hasRow;
    $("assignFrameGroupBtn").disabled = readOnly || !hasSelection;
  }

  async function saveSessionState(reason) {
    if (!state.sessionId) return;
    try {
      const payload = {
        session_id: state.sessionId,
        cells: state.cells,
        angles: state.angles,
        anims: state.anims,
        projs: state.projs,
        row_categories: state.rowCategories,
        frame_groups: state.frameGroups,
      };
      const r = await fetch("/api/workbench/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const txt = await r.text();
        status(`Save failed (${reason})`, "err");
        $("exportOut").textContent = txt;
      }
    } catch (e) {
      status(`Save failed (${reason})`, "err");
    }
  }

  function renderAll() {
    recomputeFrameGeometry();
    renderLayerControls();
    renderLegacyGrid();
    renderFrameGrid();
    renderMeta();
    renderSession();
    renderSourceCanvas();
    const row = state.selectedRow === null ? 0 : state.selectedRow;
    renderPreviewFrame(Math.max(0, Math.min(state.angles - 1, row)), 0);
    renderInspector();
  }

  async function loadFromJob() {
    if (!state.jobId) {
      status("Missing job_id in URL", "err");
      return;
    }
    status("Loading pipeline output...", "warn");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch("/api/workbench/load-from-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: state.jobId }),
        signal: ctl.signal,
      });
      const j = await r.json();
      const sessionSummary = { ...j, cells: undefined, cell_count: Array.isArray(j.cells) ? j.cells.length : 0 };
      $("sessionOut").textContent = JSON.stringify(sessionSummary, null, 2);
      if (!r.ok) {
        status("Load failed", "err");
        return;
      }
      state.sessionId = j.session_id;
      state.cells = deepCloneCells(j.cells || []);
      state.gridCols = Number(j.grid_cols || 0);
      state.gridRows = Number(j.grid_rows || 0);
      state.angles = Number(j.angles || 1);
      state.anims = (j.anims || [1]).map((x) => Number(x));
      state.sourceProjs = Number(j.source_projs || 1);
      state.projs = Number(j.projs || 1);
      state.cellWChars = Number(j.cell_w || 1);
      state.cellHChars = Number(j.cell_h || 1);
      state.layerNames = Array.isArray(j.layer_names) && j.layer_names.length ? [...j.layer_names] : [...DEFAULT_LAYER_NAMES];
      state.activeLayer = 2;
      state.visibleLayers = new Set([2]);
      state.selectedRow = null;
      state.selectedCols = new Set();
      state.history = [];
      state.future = [];
      state.latestXpPath = "";
      $("openXpToolBtn").disabled = true;
      setXpToolHint("Export an `.xp` to generate XP tool command.");
      updateUndoRedoButtons();
      $("btnExport").disabled = false;
      syncLayersFromSessionCells();
      status(`Session active: ${state.sessionId.slice(0, 8)}...`, "ok");
      renderAll();
      await saveSessionState("load");
    } catch (e) {
      status("Load failed: fetch/timeout", "err");
      $("sessionOut").textContent = String(e);
    } finally {
      clearTimeout(t);
    }
  }

  async function exportXp() {
    if (!state.sessionId) return;
    await saveSessionState("pre-export");
    const r = await fetch("/api/workbench/export-xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: state.sessionId }),
    });
    const j = await r.json();
    $("exportOut").textContent = JSON.stringify(j, null, 2);
    if (r.ok && j.xp_path) {
      state.latestXpPath = String(j.xp_path);
      $("openXpToolBtn").disabled = false;
      await refreshXpToolCommand(state.latestXpPath);
    } else {
      state.latestXpPath = "";
      $("openXpToolBtn").disabled = true;
    }
    status(r.ok ? "Export succeeded" : "Export failed", r.ok ? "ok" : "err");
  }

  function normalizeBox(a, b) {
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function canvasCoord(evt, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((evt.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((evt.clientY - rect.top) * (canvas.height / rect.height));
    return { x: Math.max(0, Math.min(canvas.width - 1, x)), y: Math.max(0, Math.min(canvas.height - 1, y)) };
  }

  function onSourceMouseDown(e) {
    if (!state.drawMode || !state.sourceImage) return;
    const pt = canvasCoord(e, $("sourceCanvas"));
    state.drawing = true;
    state.drawStart = pt;
    state.drawCurrent = { x: pt.x, y: pt.y, w: 1, h: 1 };
    renderSourceCanvas();
  }

  function onSourceMouseMove(e) {
    if (!state.drawing || !state.drawStart) return;
    const pt = canvasCoord(e, $("sourceCanvas"));
    state.drawCurrent = normalizeBox(state.drawStart, pt);
    renderSourceCanvas();
  }

  function onSourceMouseUp(e) {
    if (!state.drawing || !state.drawStart) return;
    const pt = canvasCoord(e, $("sourceCanvas"));
    pushHistory();
    state.anchorBox = normalizeBox(state.drawStart, pt);
    state.drawing = false;
    state.drawStart = null;
    state.drawCurrent = null;
    state.drawMode = false;
    $("drawBoxBtn").textContent = "Draw Box";
    renderSourceCanvas();
  }

  function findSprites() {
    if (!state.sourceImage) {
      status("Load source image first", "err");
      return;
    }
    const threshold = Math.max(0, Math.min(255, Number($("threshold").value || 48)));
    const minSize = Math.max(1, Number($("minSize").value || 8));
    const canvas = $("sourceCanvas");
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    const w = canvas.width;
    const h = canvas.height;
    const idxOf = (x, y) => (y * w + x) * 4;
    const visited = new Uint8Array(w * h);

    const corners = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ];
    let br = 0,
      bg = 0,
      bb = 0;
    for (const [x, y] of corners) {
      const i = idxOf(x, y);
      br += data[i + 0];
      bg += data[i + 1];
      bb += data[i + 2];
    }
    br /= corners.length;
    bg /= corners.length;
    bb /= corners.length;

    const isFg = (x, y) => {
      const i = idxOf(x, y);
      const a = data[i + 3];
      if (a < 24) return false;
      const dr = Math.abs(data[i + 0] - br);
      const dg = Math.abs(data[i + 1] - bg);
      const db = Math.abs(data[i + 2] - bb);
      return dr + dg + db > threshold;
    };

    const boxes = [];
    const qx = [];
    const qy = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const vi = y * w + x;
        if (visited[vi]) continue;
        visited[vi] = 1;
        if (!isFg(x, y)) continue;
        let head = 0;
        qx.length = 0;
        qy.length = 0;
        qx.push(x);
        qy.push(y);
        let minX = x,
          minY = y,
          maxX = x,
          maxY = y,
          count = 0;
        while (head < qx.length) {
          const cx = qx[head];
          const cy = qy[head];
          head += 1;
          count += 1;
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx > maxX) maxX = cx;
          if (cy > maxY) maxY = cy;
          const n = [
            [cx - 1, cy],
            [cx + 1, cy],
            [cx, cy - 1],
            [cx, cy + 1],
          ];
          for (const [nx, ny] of n) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (visited[ni]) continue;
            visited[ni] = 1;
            if (!isFg(nx, ny)) continue;
            qx.push(nx);
            qy.push(ny);
          }
        }
        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        if (bw >= minSize && bh >= minSize && count >= minSize) {
          boxes.push({ x: minX, y: minY, w: bw, h: bh });
        }
      }
    }

    let filtered = boxes;
    if (state.anchorBox) {
      const aw = state.anchorBox.w;
      const ah = state.anchorBox.h;
      const scored = boxes
        .map((b) => {
          const ws = Math.abs(b.w - aw) / Math.max(1, aw);
          const hs = Math.abs(b.h - ah) / Math.max(1, ah);
          return { b, score: ws + hs };
        })
        .sort((a, b) => a.score - b.score);
      filtered = scored.filter((s) => s.score <= 0.9).map((s) => s.b);
      // Fail-open to best size matches when strict cut yields none.
      if (!filtered.length && scored.length) {
        filtered = scored.slice(0, Math.min(24, scored.length)).map((s) => s.b);
      }
    }
    state.extractedBoxes = filtered;
    renderSourceCanvas();
    status(`Find Sprites: ${filtered.length} matched`, filtered.length > 0 ? "ok" : "warn");
  }

  function clearFrame(row, col) {
    for (let y = 0; y < state.frameHChars; y++) {
      for (let x = 0; x < state.frameWChars; x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        setCell(gx, gy, { glyph: 0, fg: [0, 0, 0], bg: [...MAGENTA] });
      }
    }
  }

  function deleteSelectedFrames() {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return;
    }
    if (state.selectedRow === null || state.selectedCols.size === 0) return;
    pushHistory();
    for (const col of state.selectedCols) clearFrame(state.selectedRow, col);
    renderAll();
    saveSessionState("delete");
  }

  function swapRowBlocks(r1, r2) {
    for (let y = 0; y < state.frameHChars; y++) {
      const gy1 = r1 * state.frameHChars + y;
      const gy2 = r2 * state.frameHChars + y;
      for (let x = 0; x < state.gridCols; x++) {
        const a = cellAt(x, gy1);
        const b = cellAt(x, gy2);
        setCell(x, gy1, b);
        setCell(x, gy2, a);
      }
    }
    const c1 = state.rowCategories[r1];
    const c2 = state.rowCategories[r2];
    if (c1 !== undefined) state.rowCategories[r2] = c1;
    else delete state.rowCategories[r2];
    if (c2 !== undefined) state.rowCategories[r1] = c2;
    else delete state.rowCategories[r1];
    for (const g of state.frameGroups) {
      if (Number(g.row) === r1) g.row = r2;
      else if (Number(g.row) === r2) g.row = r1;
    }
  }

  function moveSelectedRow(delta) {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return;
    }
    if (state.selectedRow === null) return;
    const target = state.selectedRow + delta;
    if (target < 0 || target >= state.angles) return;
    pushHistory();
    swapRowBlocks(state.selectedRow, target);
    state.selectedRow = target;
    renderAll();
    saveSessionState("row-move");
  }

  function swapColBlocks(c1, c2) {
    for (let y = 0; y < state.gridRows; y++) {
      for (let x = 0; x < state.frameWChars; x++) {
        const gx1 = c1 * state.frameWChars + x;
        const gx2 = c2 * state.frameWChars + x;
        if (gx1 >= state.gridCols || gx2 >= state.gridCols) continue;
        const a = cellAt(gx1, y);
        const b = cellAt(gx2, y);
        setCell(gx1, y, b);
        setCell(gx2, y, a);
      }
    }
    for (const g of state.frameGroups) {
      g.cols = (g.cols || []).map((c) => {
        if (c === c1) return c2;
        if (c === c2) return c1;
        return c;
      });
    }
  }

  function moveSelectedCols(delta) {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return;
    }
    if (state.selectedCols.size === 0) return;
    const cols = [...state.selectedCols].sort((a, b) => a - b);
    const maxCol = Math.max(0, state.anims.reduce((a, b) => a + b, 0) * state.projs - 1);
    if (delta < 0 && cols[0] <= 0) return;
    if (delta > 0 && cols[cols.length - 1] >= maxCol) return;
    pushHistory();
    const work = delta < 0 ? cols : [...cols].reverse();
    for (const c of work) swapColBlocks(c, c + delta);
    state.selectedCols = new Set(cols.map((c) => c + delta));
    renderAll();
    saveSessionState("col-move");
  }

  function assignRowCategory() {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return;
    }
    if (state.selectedRow === null) return;
    pushHistory();
    state.rowCategories[state.selectedRow] = $("animCategorySelect").value;
    renderMeta();
    saveSessionState("assign-row-category");
  }

  function assignFrameGroup() {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return;
    }
    if (state.selectedRow === null || state.selectedCols.size === 0) return;
    pushHistory();
    const name = ($("frameGroupName").value || "").trim() || `group_${state.frameGroups.length + 1}`;
    const cols = [...state.selectedCols].sort((a, b) => a - b);
    const existing = state.frameGroups.find((g) => g.name === name);
    if (existing) {
      existing.row = state.selectedRow;
      existing.cols = cols;
    } else {
      state.frameGroups.push({ name, row: state.selectedRow, cols });
    }
    renderAll();
    saveSessionState("assign-frame-group");
  }

  function applyGroupsToAnims() {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return;
    }
    const semanticFrames = Math.max(1, Math.floor((state.anims.reduce((a, b) => a + b, 0))));
    const row = state.selectedRow === null ? 0 : state.selectedRow;
    const groups = state.frameGroups
      .filter((g) => Number(g.row) === row)
      .map((g) => [...new Set((g.cols || []).filter((c) => c >= 0 && c < semanticFrames))].sort((a, b) => a - b))
      .filter((g) => g.length > 0);
    if (!groups.length) {
      status("No frame groups on selected row", "warn");
      return;
    }
    pushHistory();
    const used = new Set();
    const lengths = [];
    for (const g of groups) {
      for (const c of g) used.add(c);
      lengths.push(g.length);
    }
    const remainder = semanticFrames - used.size;
    if (remainder > 0) lengths.push(remainder);
    state.anims = lengths;
    recomputeFrameGeometry();
    renderAll();
    saveSessionState("apply-groups");
  }

  function selectFrame(row, col, shift) {
    if (!shift || state.selectedRow === null || state.selectedRow !== row || state.selectedCols.size === 0) {
      state.selectedRow = row;
      state.selectedCols = new Set([col]);
    } else {
      const anchor = [...state.selectedCols].sort((a, b) => a - b)[0];
      state.selectedCols = new Set();
      const lo = Math.min(anchor, col);
      const hi = Math.max(anchor, col);
      for (let c = lo; c <= hi; c++) state.selectedCols.add(c);
    }
    renderFrameGrid();
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    renderPreviewFrame(row, Math.max(0, Math.min(semanticFrames - 1, col % semanticFrames)));
  }

  function attachGridHandlers() {
    const panel = $("gridPanel");
    panel.addEventListener("click", (e) => {
      const cell = e.target.closest(".frame-cell");
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      selectFrame(row, col, e.shiftKey);
      $("gridContextMenu").classList.add("hidden");
    });
    panel.addEventListener("dblclick", (e) => {
      const cell = e.target.closest(".frame-cell");
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      selectFrame(row, col, false);
      openInspector(row, col);
      $("gridContextMenu").classList.add("hidden");
    });
    panel.addEventListener("contextmenu", (e) => {
      const cell = e.target.closest(".frame-cell");
      if (!cell) return;
      e.preventDefault();
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      selectFrame(row, col, false);
      const menu = $("gridContextMenu");
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      menu.classList.remove("hidden");
    });
    document.addEventListener("click", () => $("gridContextMenu").classList.add("hidden"));
  }

  async function wbUpload() {
    const f = $("wbFile").files[0];
    if (!f) {
      $("wbRunOut").textContent = "Pick a .png first.";
      return;
    }
    const img = new Image();
    img.onload = () => {
      state.sourceImage = img;
      renderSourceCanvas();
    };
    img.src = URL.createObjectURL(f);

    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    $("wbRunOut").textContent = JSON.stringify(j, null, 2);
    if (!r.ok) {
      status("Upload failed", "err");
      return;
    }
    state.sourcePath = j.source_path;
    $("wbAnalyze").disabled = false;
    $("wbRun").disabled = false;
    status("Upload ready", "ok");
  }

  async function wbAnalyze() {
    if (!state.sourcePath) return;
    const r = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_path: state.sourcePath }),
    });
    const j = await r.json();
    $("wbRunOut").textContent = JSON.stringify(j, null, 2);
    if (!r.ok) {
      status("Analyze failed", "err");
      return;
    }
    $("wbAngles").value = String(j.suggested_angles || 1);
    $("wbFrames").value = (j.suggested_frames || [1]).join(",");
    if (j.suggested_source_projs) {
      $("wbSourceProjs").value = String(j.suggested_source_projs);
    }
    if (j.suggested_render_resolution) {
      $("wbRenderRes").value = String(j.suggested_render_resolution);
    }
    status("Analyze ready", "ok");
  }

  async function wbRun() {
    if (!state.sourcePath) return;
    status("Running conversion...", "warn");
    const payload = {
      source_path: state.sourcePath,
      name: $("wbName").value || "wb_sprite",
      angles: parseInt($("wbAngles").value || "1", 10),
      frames: $("wbFrames").value || "1",
      source_projs: parseInt($("wbSourceProjs").value || "1", 10),
      render_resolution: parseInt($("wbRenderRes").value || "12", 10),
    };
    const r = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    $("wbRunOut").textContent = JSON.stringify(j, null, 2);
    if (!r.ok) {
      status("Run failed", "err");
      return;
    }
    state.jobId = j.job_id;
    const u = new URL(window.location.href);
    u.searchParams.set("job_id", state.jobId);
    history.replaceState({}, "", u.toString());
    status("Run complete", "ok");
    await loadFromJob();
  }

  function bindUI() {
    $("btnLoad").addEventListener("click", loadFromJob);
    $("btnExport").addEventListener("click", exportXp);
    $("openXpToolBtn").addEventListener("click", openInXpTool);
    $("undoBtn").addEventListener("click", undo);
    $("redoBtn").addEventListener("click", redo);

    $("wbUpload").addEventListener("click", wbUpload);
    $("wbAnalyze").addEventListener("click", wbAnalyze);
    $("wbRun").addEventListener("click", wbRun);
    $("wbFile").addEventListener("change", () => {
      const f = $("wbFile").files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => {
        state.sourceImage = img;
        renderSourceCanvas();
      };
      img.src = URL.createObjectURL(f);
    });

    $("drawBoxBtn").addEventListener("click", () => {
      state.drawMode = !state.drawMode;
      $("drawBoxBtn").textContent = state.drawMode ? "Drawing..." : "Draw Box";
    });
    $("deleteBoxBtn").addEventListener("click", () => {
      pushHistory();
      state.anchorBox = null;
      state.extractedBoxes = [];
      renderSourceCanvas();
      saveSessionState("delete-box");
    });
    $("extractBtn").addEventListener("click", () => {
      findSprites();
      saveSessionState("find-sprites");
    });
    $("sourceCanvas").addEventListener("mousedown", onSourceMouseDown);
    $("sourceCanvas").addEventListener("mousemove", onSourceMouseMove);
    $("sourceCanvas").addEventListener("mouseup", onSourceMouseUp);
    $("sourceCanvas").addEventListener("mouseleave", onSourceMouseUp);

    $("deleteCellBtn").addEventListener("click", deleteSelectedFrames);
    $("ctxDelete").addEventListener("click", () => {
      deleteSelectedFrames();
      $("gridContextMenu").classList.add("hidden");
    });
    $("rowUpBtn").addEventListener("click", () => moveSelectedRow(-1));
    $("rowDownBtn").addEventListener("click", () => moveSelectedRow(1));
    $("colLeftBtn").addEventListener("click", () => moveSelectedCols(-1));
    $("colRightBtn").addEventListener("click", () => moveSelectedCols(1));
    $("assignAnimCategoryBtn").addEventListener("click", assignRowCategory);
    $("assignFrameGroupBtn").addEventListener("click", assignFrameGroup);
    $("applyGroupsToAnimsBtn").addEventListener("click", applyGroupsToAnims);

    $("playBtn").addEventListener("click", startPreview);
    $("stopBtn").addEventListener("click", stopPreview);
    $("previewAngle").addEventListener("change", () => {
      const row = Math.max(0, Math.min(state.angles - 1, Number($("previewAngle").value || 0)));
      renderPreviewFrame(row, 0);
    });
    $("layerSelect").addEventListener("change", () => {
      state.activeLayer = Math.max(0, Number($("layerSelect").value || 2));
      renderAll();
    });
    $("layerVisibility").addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "checkbox") return;
      const layer = Number(t.dataset.layer || -1);
      if (layer < 0) return;
      if (t.checked) state.visibleLayers.add(layer);
      else state.visibleLayers.delete(layer);
      if (state.visibleLayers.size === 0) {
        state.visibleLayers.add(2);
      }
      renderAll();
    });
    $("inspectorCloseBtn").addEventListener("click", closeInspector);
    $("inspectorZoom").addEventListener("input", () => {
      state.inspectorZoom = Number($("inspectorZoom").value || 10);
      renderInspector();
    });

    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete") {
        deleteSelectedFrames();
      } else if (e.key === "Escape") {
        if (state.inspectorOpen) {
          closeInspector();
        } else {
          state.selectedCols = new Set();
          state.selectedRow = null;
          renderFrameGrid();
        }
      }
    });
    attachGridHandlers();
    updateUndoRedoButtons();
    setXpToolHint("Export an `.xp` to generate XP tool command.");
    $("xpToolCommandHint").addEventListener("click", async () => {
      const txt = $("xpToolCommandHint").textContent || "";
      const pref = "XP Tool: ";
      if (!txt.startsWith(pref)) return;
      try {
        await navigator.clipboard.writeText(txt.slice(pref.length));
        status("XP Tool command copied", "ok");
      } catch (_e) {
        status("Clipboard copy failed", "warn");
      }
    });
  }

  // Audit hooks for deterministic browser checks.
  window.__wb_debug = {
    getState: () => ({
      jobId: state.jobId,
      sessionId: state.sessionId,
      angles: state.angles,
      anims: [...state.anims],
      projs: state.projs,
      selectedRow: state.selectedRow,
      selectedCols: [...state.selectedCols],
      rowCategories: { ...state.rowCategories },
      frameGroups: JSON.parse(JSON.stringify(state.frameGroups)),
      sourceImageLoaded: !!state.sourceImage,
      extractedBoxes: state.extractedBoxes.length,
      anchorBox: state.anchorBox ? { ...state.anchorBox } : null,
      historyDepth: state.history.length,
      futureDepth: state.future.length,
    }),
    frameSignature: (row, col) => {
      const vals = [];
      for (let y = 0; y < state.frameHChars; y++) {
        for (let x = 0; x < state.frameWChars; x++) {
          const gx = col * state.frameWChars + x;
          const gy = row * state.frameHChars + y;
          if (gx >= state.gridCols || gy >= state.gridRows) continue;
          const c = cellAt(gx, gy);
          vals.push(`${c.glyph}:${c.fg[0]}:${c.fg[1]}:${c.fg[2]}:${c.bg[0]}:${c.bg[1]}:${c.bg[2]}`);
        }
      }
      return vals.join("|");
    },
  };

  bindUI();
  renderSourceCanvas();
  if (state.jobId) loadFromJob();
})();
