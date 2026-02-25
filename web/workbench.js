(() => {
  "use strict";

  const MAGENTA = [255, 0, 255];
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const DEFAULT_LAYER_NAMES = ["Metadata", "Layer 1", "Visual", "Layer 3"];
  const VERIFY_CMD_TEMPLATE_STORAGE_KEY = "wb_verify_command_template_v1";
  const TERM_STREAM_REGION_STORAGE_KEY = "wb_termpp_stream_region_v1";
  const INSPECTOR_SWATCHES = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [128, 128, 128],
    [255, 128, 0],
    [128, 0, 255],
    [128, 64, 0],
  ];
  const WEBBUILD_DEFAULT_OVERRIDE_NAMES = (() => {
    const out = ["player-nude.xp"];
    const groups = ["player", "attack", "plydie", "wolfie", "wolack"];
    for (const group of groups) {
      for (let i = 0; i < 16; i++) {
        out.push(`${group}-${i.toString(2).padStart(4, "0")}.xp`);
      }
    }
    return out;
  })();

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
    sourceMode: "select",
    sourceSelection: new Set(),
    sourceDrag: null,
    sourceRowDrag: null,
    sourceContextTarget: null,
    sourceCutsV: [],
    sourceCutsH: [],
    sourceSelectedCut: null,
    sourceNextId: 1,
    rapidManualAdd: false,
    sourceDragHoverFrame: null,
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
    inspectorTool: "inspect",
    inspectorPaintColor: [255, 255, 255],
    inspectorGlyphCode: 64,
    inspectorGlyphFgColor: [255, 255, 255],
    inspectorGlyphBgColor: [255, 0, 255],
    inspectorPainting: false,
    inspectorStrokeChanged: false,
    inspectorStrokeHadHistory: false,
    inspectorStrokeWasDirty: false,
    inspectorSelecting: false,
    inspectorSelectAnchor: null,
    inspectorSelection: null, // local frame chars: {x1,y1,x2,y2}
    inspectorSelectionClipboard: null, // 2D matrix of cells
    inspectorLastInspectCell: null, // {glyph,fg,bg}
    inspectorShowGrid: true,
    inspectorShowChecker: false,
    inspectorFrameClipboard: null,
    history: [],
    future: [],
    previewTimer: null,
    previewFrameIdx: 0,
    sessionDirty: false,
    sessionSaveInFlight: false,
    sessionLastSaveOkAt: 0,
    sessionLastSaveReason: "",
    termppStream: {
      id: null,
      pollTimer: null,
      imgTimer: null,
      running: false,
    },
    webbuild: {
      src: "/termpp-web-flat/index.html?solo=1&player=player",
      loaded: false,
      ready: false,
      readyPoll: null,
      uploadedXpBytes: null,
      uploadedXpName: "",
    },
    inspectorHover: null, // {cx,cy,half,cell}
    inspectorLastHoverAnchor: null, // {cx,cy}
  };

  function status(text, cls) {
    const el = $("wbStatus");
    el.className = "small " + (cls || "");
    el.textContent = text;
  }

  function updateSessionDirtyBadge() {
    const top = $("sessionDirtyBadge");
    const ins = $("inspectorDirtyBadge");
    let txt = "Session: idle";
    let cls = "small";
    if (!state.sessionId) {
      txt = "Session: idle";
    } else if (state.sessionSaveInFlight && state.sessionDirty) {
      txt = `Session: saving...`;
      cls = "small warn";
    } else if (state.sessionDirty) {
      txt = "Session: edited (unsaved)";
      cls = "small warn";
    } else if (state.sessionLastSaveOkAt) {
      txt = `Session: saved`;
      cls = "small ok";
    } else {
      txt = "Session: loaded";
      cls = "small";
    }
    if (top) {
      top.className = cls;
      top.textContent = txt;
    }
    if (ins) {
      ins.className = cls;
      ins.textContent = state.sessionDirty ? (state.sessionSaveInFlight ? "saving..." : "edited") : "saved";
    }
  }

  function markSessionDirty(reason = "") {
    if (!state.sessionId) return;
    state.sessionDirty = true;
    if (reason) state.sessionLastSaveReason = String(reason);
    updateSessionDirtyBadge();
  }

  function markSessionSaved(reason = "") {
    state.sessionDirty = false;
    state.sessionSaveInFlight = false;
    state.sessionLastSaveOkAt = Date.now();
    if (reason) state.sessionLastSaveReason = String(reason);
    updateSessionDirtyBadge();
  }

  function setXpToolHint(text) {
    const el = $("xpToolCommandHint");
    if (!el) return;
    el.textContent = text;
  }

  function verifyProfileRequiresCommand(profile) {
    return profile === "termpp_custom" || profile === "legacy_verify_e2e";
  }

  function defaultVerifyTemplate(profile) {
    if (profile === "legacy_verify_e2e") {
      return 'cd {legacy_repo_root} && PYTHONPATH={legacy_repo_root} python3 scripts/verify_e2e.py --xp-path "{xp_path}"';
    }
    if (profile === "termpp_custom") {
      return 'cd {legacy_repo_root} && <PASTE_TERMPP_VERIFY_COMMAND> "{xp_path}"';
    }
    return "";
  }

  function updateVerifyUI() {
    const profileEl = $("verifyProfile");
    const cmdEl = $("verifyCommandTemplate");
    const runBtn = $("verifyRunBtn");
    const dryBtn = $("verifyDryRunBtn");
    const hint = $("verifyHint");
    if (!profileEl || !cmdEl || !runBtn || !dryBtn) return;
    const profile = String(profileEl.value || "local_xp_sanity");
    const needsCmd = verifyProfileRequiresCommand(profile);
    cmdEl.disabled = !needsCmd;
    if (!needsCmd) {
      cmdEl.placeholder = "Built-in verifier does not require a command template";
    } else if (profile === "legacy_verify_e2e") {
      cmdEl.placeholder = 'Legacy script (experimental): cd {legacy_repo_root} && ... "{xp_path}"';
      if (!cmdEl.value.trim()) cmdEl.value = defaultVerifyTemplate(profile);
    } else {
      cmdEl.placeholder = 'Custom Term++ command using {xp_path} (and optionally {legacy_repo_root}, {pipeline_repo_root})';
    }
    const sessionReady = !!state.sessionId;
    runBtn.disabled = !sessionReady;
    dryBtn.disabled = !sessionReady;
    if (hint) {
      if (profile === "local_xp_sanity") {
        hint.textContent = "Built-in verifier: exports current session XP and checks XP structure/geometry/non-empty visual cells. Use this for quick regressions.";
      } else if (profile === "legacy_verify_e2e") {
        hint.textContent = "Experimental legacy verifier wrapper. It may fail depending on legacy repo environment. Use Dry Run first to inspect the exact command.";
      } else {
        hint.textContent = "Custom Term++ verifier: exports current session XP, then runs your command template. Include {xp_path} where the exported XP file path should be inserted.";
      }
    }
  }

  function updateTermppSkinUI() {
    const sessionReady = !!state.sessionId;
    const cmdBtn = $("termppSkinCmdBtn");
    const launchBtn = $("termppSkinLaunchBtn");
    if (cmdBtn) cmdBtn.disabled = !sessionReady;
    if (launchBtn) launchBtn.disabled = !sessionReady;
    if ($("termppStreamPreviewBtn")) $("termppStreamPreviewBtn").disabled = !sessionReady;
    if ($("termppStreamStartBtn")) $("termppStreamStartBtn").disabled = !sessionReady;
    if ($("termppStreamStopBtn")) $("termppStreamStopBtn").disabled = !state.termppStream.id;
  }

  function setWebbuildState(text, cls) {
    const el = $("webbuildState");
    if (!el) return;
    el.className = "small " + (cls || "");
    el.textContent = text;
  }

  function webbuildFrameWindow() {
    const frame = $("webbuildFrame");
    return frame && frame.contentWindow ? frame.contentWindow : null;
  }

  function readWebbuildLoadingDetail(win) {
    if (!win) return "";
    try {
      const statusEl = win.document && win.document.getElementById ? win.document.getElementById("status") : null;
      const progressEl = win.document && win.document.getElementById ? win.document.getElementById("progress") : null;
      const statusText = statusEl && statusEl.textContent ? String(statusEl.textContent).trim() : "";
      const pHidden = !!(progressEl && progressEl.hidden);
      const pVal = progressEl && Number.isFinite(Number(progressEl.value)) ? Number(progressEl.value) : null;
      const pMax = progressEl && Number.isFinite(Number(progressEl.max)) ? Number(progressEl.max) : null;
      let prog = "";
      if (!pHidden && pVal != null && pMax != null && pMax > 0) {
        prog = ` ${Math.round((pVal / pMax) * 100)}%`;
      }
      const moduleStatus = win.Module && win.Module.setStatus && win.Module.setStatus.last && win.Module.setStatus.last.text
        ? String(win.Module.setStatus.last.text).trim()
        : "";
      const text = statusText || moduleStatus;
      return text ? `${text}${prog}`.trim() : "";
    } catch (_e) {
      return "";
    }
  }

  function stopWebbuildReadyPoll() {
    if (state.webbuild.readyPoll) {
      clearInterval(state.webbuild.readyPoll);
      state.webbuild.readyPoll = null;
    }
  }

  function updateWebbuildUI() {
    const sessionReady = !!state.sessionId;
    const runtimeReady = !!state.webbuild.ready;
    const applyBtn = $("webbuildApplySkinBtn");
    if (applyBtn) {
      applyBtn.disabled = !(sessionReady && runtimeReady);
      applyBtn.title = sessionReady && runtimeReady ? "Apply current XP skin to the running webbuild" : "Requires an active session and a ready webbuild runtime";
    }
    const applyInPlaceBtn = $("webbuildApplyInPlaceBtn");
    if (applyInPlaceBtn) {
      applyInPlaceBtn.disabled = !(sessionReady && runtimeReady);
      applyInPlaceBtn.title = sessionReady && runtimeReady ? "Apply to the current runtime without a forced restart (faster)" : "Disabled: wait for the webbuild runtime to finish loading";
    }
    const applyRestartBtn = $("webbuildApplyRestartBtn");
    if (applyRestartBtn) {
      applyRestartBtn.disabled = !sessionReady;
      applyRestartBtn.title = sessionReady ? "Export and apply current XP skin with a deterministic webbuild restart" : "Disabled: load or create a session first";
    }
    const quickBtn = $("webbuildQuickTestBtn");
    if (quickBtn) {
      quickBtn.disabled = !sessionReady;
      quickBtn.title = sessionReady ? "Deterministic test path (opens/reloads preview as needed, then applies current XP skin)" : "Disabled: load or create a session first";
    }
  }

  function detectWebbuildReady() {
    const win = webbuildFrameWindow();
    if (!win) return false;
    try {
      const hasModule = !!win.Module;
      const calledRun = !!(win.Module && win.Module.calledRun);
      const hasLoad = typeof win.Load === "function";
      const hasFSOps = !!(win.Module && typeof win.Module.FS_createDataFile === "function" && typeof win.Module.FS_unlink === "function");
      const ready = hasModule && calledRun && hasLoad && hasFSOps;
      state.webbuild.ready = ready;
      updateWebbuildUI();
      if (ready) {
        setWebbuildState("Webbuild ready", "ok");
        stopWebbuildReadyPoll();
      } else {
        const detail = readWebbuildLoadingDetail(win);
        setWebbuildState(detail ? `Webbuild loading... ${detail}` : "Webbuild loading... (first load may take 5-30s)", "warn");
      }
      return ready;
    } catch (e) {
      state.webbuild.ready = false;
      updateWebbuildUI();
      setWebbuildState(`Webbuild access error (${e})`, "err");
      return false;
    }
  }

  function openWebbuild() {
    const frame = $("webbuildFrame");
    if (!frame) return;
    frame.classList.remove("hidden");
    state.webbuild.loaded = true;
    state.webbuild.ready = false;
    updateWebbuildUI();
    setWebbuildState("Opening flat arena preview... (first load downloads ~24MB)", "warn");
    stopWebbuildReadyPoll();
    frame.src = state.webbuild.src;
    state.webbuild.readyPoll = setInterval(detectWebbuildReady, 500);
  }

  function reloadWebbuild() {
    const frame = $("webbuildFrame");
    if (!frame) return;
    if (frame.classList.contains("hidden")) frame.classList.remove("hidden");
    state.webbuild.ready = false;
    updateWebbuildUI();
    setWebbuildState("Reloading webbuild...", "warn");
    stopWebbuildReadyPoll();
    try {
      frame.contentWindow?.location.reload();
    } catch (_e) {
      frame.src = state.webbuild.src;
    }
    state.webbuild.readyPoll = setInterval(detectWebbuildReady, 500);
  }

  function b64ToUint8Array(b64) {
    const bin = atob(String(b64 || ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function waitForWebbuildReady(timeoutMs = 25000) {
    if (!state.webbuild.loaded) openWebbuild();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (detectWebbuildReady()) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }

  function webbuildLoginOverlayVisible(win) {
    if (!win || !win.document || typeof win.document.getElementById !== "function") return false;
    const overlay = win.document.getElementById("login-overlay");
    if (!overlay) return false;
    try {
      const cs = typeof win.getComputedStyle === "function" ? win.getComputedStyle(overlay) : null;
      if (cs) {
        if (cs.display === "none" || cs.visibility === "hidden") return false;
      }
    } catch (_e) {}
    if (overlay.hidden) return false;
    if (overlay.style && overlay.style.display === "none") return false;
    return true;
  }

  function normalizeWebbuildOverrideNames(names) {
    const out = [];
    const seen = new Set();
    const add = (name) => {
      const s = String(name || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    };
    for (const name of WEBBUILD_DEFAULT_OVERRIDE_NAMES) add(name);
    if (Array.isArray(names)) {
      for (const name of names) add(name);
    }
    return out;
  }

  async function prepareWebbuildForSkinApply(opts = {}) {
    const forceRestart = !!opts.force_restart;
    const restartIfOverlayHidden = !!opts.restart_if_overlay_hidden;
    if (!(await waitForWebbuildReady())) return { ready: false, restarted: false, overlay_visible: 0 };
    const initialWin = webbuildFrameWindow();
    const overlayVisible = webbuildLoginOverlayVisible(initialWin);
    if (forceRestart || (restartIfOverlayHidden && !overlayVisible)) {
      reloadWebbuild();
      if (!(await waitForWebbuildReady())) return { ready: false, restarted: true, overlay_visible: 0 };
      const restartedWin = webbuildFrameWindow();
      return {
        ready: true,
        restarted: true,
        restart_reason: forceRestart ? "forced" : "overlay_hidden",
        overlay_visible: webbuildLoginOverlayVisible(restartedWin) ? 1 : 0,
      };
    }
    return { ready: true, restarted: false, overlay_visible: overlayVisible ? 1 : 0 };
  }

  async function injectXpBytesIntoWebbuild(win, xpBytes, opts = {}) {
    if (!win || !win.Module) throw new Error("webbuild iframe is not ready");
    if (!(xpBytes instanceof Uint8Array) || !xpBytes.length) throw new Error("empty xp payload");
    const M = win.Module;
    if (win.__termppFlatMap && typeof win.__termppFlatMap.apply === "function") {
      try {
        await win.__termppFlatMap.apply(true);
      } catch (_e) {
        // Fall through: skin injection can still proceed on non-flat bundles.
      }
    }
    if (typeof M.FS_createPath === "function") {
      try { M.FS_createPath("/", "sprites", true, true); } catch (_e) {}
    }
    const names = normalizeWebbuildOverrideNames(opts.override_names);
    const playerName = String(opts.reload_player_name || "player");
    const requireStartGame = !!opts.require_start_game;
    for (const name of names) {
      try { M.FS_unlink(`/sprites/${name}`); } catch (_e) {}
      M.FS_createDataFile("/sprites", name, xpBytes, true, true, true);
    }
    let startedVia = "load";
    let overlayVisible = false;
    try {
      const loginOverlay = win.document && win.document.getElementById ? win.document.getElementById("login-overlay") : null;
      const playBtn = win.document && win.document.getElementById ? win.document.getElementById("play-btn") : null;
      const playerInput = win.document && win.document.getElementById ? win.document.getElementById("player-name") : null;
      const serverInput = win.document && win.document.getElementById ? win.document.getElementById("server-addr") : null;
      overlayVisible = webbuildLoginOverlayVisible(win);
      if (overlayVisible && typeof win.StartGame === "function") {
        if (playerInput && !String(playerInput.value || "").trim()) playerInput.value = playerName;
        if (serverInput) serverInput.value = "";
        if (playBtn) playBtn.disabled = false;
        win.StartGame();
        startedVia = "start_game";
      }
    } catch (_e) {}
    if (startedVia !== "start_game") {
      if (requireStartGame) {
        throw new Error("webbuild did not expose login overlay for StartGame path (preview needs restart)");
      }
      if (typeof win.Load === "function") win.Load(playerName);
      if (typeof win.Resize === "function") {
        try { win.Resize(null); } catch (_e) {}
      }
    }
    if (typeof win.ak_canvas !== "undefined" && win.ak_canvas && typeof win.ak_canvas.focus === "function") {
      try { win.ak_canvas.focus(); } catch (_e) {}
    }
    return { bytes: xpBytes.length, files_written: names.length, player_name: playerName, started_via: startedVia, overlay_visible: overlayVisible ? 1 : 0 };
  }

  async function injectXpIntoWebbuild(win, payload) {
    const xpBytes = b64ToUint8Array(payload.xp_b64 || "");
    return await injectXpBytesIntoWebbuild(win, xpBytes, {
      override_names: Array.isArray(payload.override_names) ? payload.override_names : [],
      reload_player_name: String(payload.reload_player_name || "player"),
    });
  }

  async function applyCurrentXpAsWebSkin(opts = {}) {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    const prep = await prepareWebbuildForSkinApply({
      force_restart: !!opts.force_restart,
      restart_if_overlay_hidden: opts.restart_if_overlay_hidden !== false,
    });
    if (!prep.ready) {
      status("Webbuild not ready yet; wait for load to finish", "warn");
      return;
    }
    try {
      await saveSessionState("pre-web-skin-apply");
      status(prep.restarted ? "Reloaded preview; exporting XP and applying web skin..." : "Exporting XP and applying web skin...", "warn");
      const r = await fetch("/api/workbench/web-skin-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId }),
      });
      const j = await r.json();
      if (!r.ok) {
        $("webbuildOut").textContent = JSON.stringify(j, null, 2);
        status("Web skin payload failed", "err");
        return;
      }
      const win = webbuildFrameWindow();
      const inject = await injectXpBytesIntoWebbuild(win, b64ToUint8Array(j.xp_b64 || ""), {
        override_names: j.override_names,
        reload_player_name: String(j.reload_player_name || "player"),
        require_start_game: prep.restarted || prep.overlay_visible,
      });
      $("webbuildOut").textContent = JSON.stringify({
        prep,
        payload: { ...j, override_names: normalizeWebbuildOverrideNames(j.override_names), xp_b64: `(<${(j.xp_b64 || "").length} base64 chars>)` },
        inject,
      }, null, 2);
      state.webbuild.ready = true;
      updateWebbuildUI();
      status("Applied XP as web skin", "ok");
      setWebbuildState("Webbuild ready (skin applied)", "ok");
    } catch (e) {
      $("webbuildOut").textContent = String(e);
      status("Web skin apply failed", "err");
    }
  }

  async function testCurrentSkinInDock() {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    const frame = $("webbuildFrame");
    if (frame && frame.classList.contains("hidden")) {
      status("Opening flat preview and testing current skin...", "warn");
    } else {
      status("Reloading flat preview and testing current skin...", "warn");
    }
    await applyCurrentXpAsWebSkin({
      force_restart: !!(frame && !frame.classList.contains("hidden")),
      restart_if_overlay_hidden: true,
    });
  }

  async function onWebbuildUploadTestClick() {
    const input = $("webbuildUploadTestInput");
    if (!input) return;
    input.value = "";
    input.click();
  }

  async function applyUploadedXpBytesToWebbuild(fileName, xpBytes) {
    const prep = await prepareWebbuildForSkinApply({ restart_if_overlay_hidden: true });
    if (!prep.ready) {
      status("Webbuild not ready; preview failed to load", "err");
      return;
    }
    try {
      const win = webbuildFrameWindow();
      const override_names = WEBBUILD_DEFAULT_OVERRIDE_NAMES;
      const inject = await injectXpBytesIntoWebbuild(win, xpBytes, {
        override_names,
        reload_player_name: "player",
        require_start_game: prep.restarted || prep.overlay_visible,
      });
      state.webbuild.uploadedXpBytes = xpBytes;
      state.webbuild.uploadedXpName = fileName || "upload.xp";
      $("webbuildOut").textContent = JSON.stringify({
        mode: "upload_test_skin",
        file: state.webbuild.uploadedXpName,
        prep,
        inject,
      }, null, 2);
      state.webbuild.ready = true;
      updateWebbuildUI();
      status(`Uploaded test skin applied: ${state.webbuild.uploadedXpName}`, "ok");
      setWebbuildState("Webbuild ready (uploaded skin applied)", "ok");
    } catch (e) {
      $("webbuildOut").textContent = String(e);
      status("Upload test skin failed", "err");
    }
  }

  async function onWebbuildUploadTestInputChange(e) {
    const file = e && e.target && e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      await applyUploadedXpBytesToWebbuild(file.name || "upload.xp", new Uint8Array(ab));
    } catch (err) {
      $("webbuildOut").textContent = String(err);
      status("Upload test skin failed to read file", "err");
    }
  }

  function moveWebbuildDockToBottom() {
    const dock = $("webbuildDockPanel");
    const inspector = $("cellInspectorPanel");
    if (!dock || !inspector || !inspector.parentElement || dock.parentElement !== inspector.parentElement) return;
    inspector.parentElement.insertBefore(dock, inspector);
  }

  function movePanelsToBottom() {
    const root = $("cellInspectorPanel")?.parentElement;
    if (!root) return;
    const ids = ["termppNativePanel", "verificationPanel"];
    for (const id of ids) {
      const el = $(id);
      if (el && el.parentElement === root) root.appendChild(el);
    }
  }

  function termppStreamRegionPayload() {
    return {
      x: Math.max(0, Number($("termppStreamX")?.value || 0)),
      y: Math.max(0, Number($("termppStreamY")?.value || 0)),
      w: Math.max(16, Number($("termppStreamW")?.value || 960)),
      h: Math.max(16, Number($("termppStreamH")?.value || 640)),
      fps: Math.max(1, Math.min(30, Number($("termppStreamFps")?.value || 4))),
    };
  }

  function persistTermppStreamRegion() {
    try {
      localStorage.setItem(TERM_STREAM_REGION_STORAGE_KEY, JSON.stringify(termppStreamRegionPayload()));
    } catch (_e) {}
  }

  function loadPersistedTermppStreamRegion() {
    try {
      const raw = localStorage.getItem(TERM_STREAM_REGION_STORAGE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (Number.isFinite(Number(j.x))) $("termppStreamX").value = String(Math.max(0, Number(j.x)));
      if (Number.isFinite(Number(j.y))) $("termppStreamY").value = String(Math.max(0, Number(j.y)));
      if (Number.isFinite(Number(j.w))) $("termppStreamW").value = String(Math.max(16, Number(j.w)));
      if (Number.isFinite(Number(j.h))) $("termppStreamH").value = String(Math.max(16, Number(j.h)));
      if (Number.isFinite(Number(j.fps))) $("termppStreamFps").value = String(Math.max(1, Math.min(30, Number(j.fps))));
    } catch (_e) {}
  }

  function stopTermppStreamPolling() {
    if (state.termppStream.pollTimer) {
      clearInterval(state.termppStream.pollTimer);
      state.termppStream.pollTimer = null;
    }
    if (state.termppStream.imgTimer) {
      clearInterval(state.termppStream.imgTimer);
      state.termppStream.imgTimer = null;
    }
  }

  function refreshTermppStreamImage() {
    if (!state.termppStream.id) return;
    const img = $("termppStreamImg");
    if (!img) return;
    img.style.display = "block";
    img.src = `/api/workbench/termpp-stream/frame/${encodeURIComponent(state.termppStream.id)}?t=${Date.now()}`;
  }

  async function pollTermppStreamStatus() {
    if (!state.termppStream.id) return;
    try {
      const r = await fetch(`/api/workbench/termpp-stream/status/${encodeURIComponent(state.termppStream.id)}`);
      const j = await r.json();
      if (!r.ok) {
        $("termppStreamInfo").textContent = `stream status error: ${j.error || "request failed"}`;
        return;
      }
      state.termppStream.running = !!j.running;
      const last = j.last_frame_ts ? new Date(j.last_frame_ts * 1000).toLocaleTimeString() : "n/a";
      $("termppStreamInfo").textContent = `stream=${j.stream_id} running=${j.running ? 1 : 0} frames=${j.frame_count} last=${last}${j.last_error ? ` error=${j.last_error}` : ""}`;
      if (j.region) {
        $("termppStreamX").value = String(j.region.x);
        $("termppStreamY").value = String(j.region.y);
        $("termppStreamW").value = String(j.region.w);
        $("termppStreamH").value = String(j.region.h);
      }
      if (j.has_frame) refreshTermppStreamImage();
      if (!j.running) updateTermppSkinUI();
    } catch (e) {
      $("termppStreamInfo").textContent = `stream poll error: ${e}`;
    }
  }

  function attachTermppStreamToUi(streamId) {
    stopTermppStreamPolling();
    state.termppStream.id = streamId || null;
    state.termppStream.running = !!streamId;
    if (!streamId) {
      $("termppStreamInfo").textContent = "";
      const img = $("termppStreamImg");
      if (img) {
        img.style.display = "none";
        img.removeAttribute("src");
      }
      updateTermppSkinUI();
      return;
    }
    refreshTermppStreamImage();
    state.termppStream.pollTimer = setInterval(pollTermppStreamStatus, 1000);
    state.termppStream.imgTimer = setInterval(refreshTermppStreamImage, 350);
    pollTermppStreamStatus();
    updateTermppSkinUI();
  }

  async function previewTermppEmbedStream() {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    persistTermppStreamRegion();
    const region = termppStreamRegionPayload();
    try {
      const r = await fetch("/api/workbench/termpp-stream/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId, dry_run: true, ...region }),
      });
      const j = await r.json();
      $("termppSkinOut").textContent = JSON.stringify(j, null, 2);
      status(r.ok ? "TERM++ embed preview ready" : "TERM++ embed preview failed", r.ok ? "ok" : "err");
    } catch (e) {
      $("termppSkinOut").textContent = String(e);
      status("TERM++ embed preview failed: fetch error", "err");
    }
  }

  async function startTermppEmbedStream() {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    persistTermppStreamRegion();
    const region = termppStreamRegionPayload();
    try {
      status("Starting TERM++ embed stream...", "warn");
      const r = await fetch("/api/workbench/termpp-stream/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId, dry_run: false, ...region }),
      });
      const j = await r.json();
      $("termppSkinOut").textContent = JSON.stringify(j, null, 2);
      if (!r.ok) {
        status("TERM++ embed stream failed to start", "err");
        return;
      }
      attachTermppStreamToUi(j.stream_id);
      status("TERM++ embed stream started", "ok");
    } catch (e) {
      $("termppSkinOut").textContent = String(e);
      status("TERM++ embed stream failed: fetch error", "err");
    }
  }

  async function stopTermppEmbedStream() {
    if (!state.termppStream.id) return;
    try {
      const r = await fetch("/api/workbench/termpp-stream/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_id: state.termppStream.id }),
      });
      const j = await r.json();
      $("termppSkinOut").textContent = JSON.stringify(j, null, 2);
      attachTermppStreamToUi(null);
      status(r.ok ? "TERM++ embed stream stopped" : "TERM++ embed stream stop failed", r.ok ? "ok" : "err");
    } catch (e) {
      $("termppSkinOut").textContent = String(e);
      attachTermppStreamToUi(null);
      status("TERM++ embed stream stop failed: fetch error", "err");
    }
  }

  async function termppSkinCommandPreview() {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    try {
      await saveSessionState("pre-termpp-skin-preview");
      status("Preparing TERM++ skin launch preview...", "warn");
      const r = await fetch("/api/workbench/termpp-skin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: state.sessionId,
          binary_name: String($("termppBinary")?.value || "game_term"),
        }),
      });
      const j = await r.json();
      $("termppSkinOut").textContent = JSON.stringify(j, null, 2);
      status(r.ok ? "TERM++ skin preview ready" : "TERM++ skin preview failed", r.ok ? "ok" : "err");
    } catch (e) {
      $("termppSkinOut").textContent = String(e);
      status("TERM++ skin preview failed: fetch error", "err");
    }
  }

  async function launchTermppSkin() {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    try {
      await saveSessionState("pre-termpp-skin-launch");
      status("Launching TERM++ SKIN runtime...", "warn");
      const r = await fetch("/api/workbench/open-termpp-skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: state.sessionId,
          binary_name: String($("termppBinary")?.value || "game_term"),
          dry_run: false,
        }),
      });
      const j = await r.json();
      $("termppSkinOut").textContent = JSON.stringify(j, null, 2);
      status(r.ok ? "TERM++ SKIN launch requested" : "TERM++ SKIN launch failed", r.ok ? "ok" : "err");
    } catch (e) {
      $("termppSkinOut").textContent = String(e);
      status("TERM++ SKIN launch failed: fetch error", "err");
    }
  }

  async function runWorkbenchVerification(dryRun) {
    if (!state.sessionId) {
      status("Load a workbench session first", "warn");
      return;
    }
    const profile = String($("verifyProfile")?.value || "local_xp_sanity");
    const commandTemplate = String($("verifyCommandTemplate")?.value || "");
    const timeoutSec = Math.max(1, Math.min(300, Number($("verifyTimeout")?.value || 20)));
    if (verifyProfileRequiresCommand(profile) && !commandTemplate.trim()) {
      status("Verification command template is required for this profile", "warn");
      return;
    }
    try {
      await saveSessionState(dryRun ? "pre-verify-dry-run" : "pre-verify");
      status(dryRun ? "Preparing verification dry run..." : "Running verification...", "warn");
      const payload = {
        session_id: state.sessionId,
        profile,
        command_template: commandTemplate,
        timeout_sec: timeoutSec,
        dry_run: !!dryRun,
      };
      const r = await fetch("/api/workbench/run-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      $("verifySummaryOut").textContent = JSON.stringify(j, null, 2);
      const logs = [];
      if (j.stdout) logs.push(String(j.stdout));
      if (j.stderr) logs.push(`[stderr]\n${String(j.stderr)}`);
      $("verifyLogOut").textContent = logs.join("\n\n");
      if (!r.ok) {
        status("Verification request failed", "err");
        return;
      }
      if (dryRun) {
        status("Verification dry run ready", "ok");
        return;
      }
      status(
        j.passed ? "Verification passed" : "Verification failed",
        j.passed ? "ok" : "err"
      );
    } catch (e) {
      $("verifyLogOut").textContent = String(e);
      status("Verification failed: fetch error", "err");
    }
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

  function cloneBox(b) {
    if (!b) return null;
    return { ...b };
  }

  function cloneBoxes(list) {
    return (list || []).map((b) => ({ ...b }));
  }

  function cloneCuts(list) {
    return (list || []).map((c) => ({ ...c }));
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
      sourceMode: state.sourceMode,
      sourceSelection: [...state.sourceSelection],
      sourceCutsV: cloneCuts(state.sourceCutsV),
      sourceCutsH: cloneCuts(state.sourceCutsH),
      sourceSelectedCut: state.sourceSelectedCut ? { ...state.sourceSelectedCut } : null,
      sourceNextId: Number(state.sourceNextId || 1),
      rapidManualAdd: !!state.rapidManualAdd,
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
    state.sourceMode = String(snap.sourceMode || "select");
    state.sourceSelection = new Set((snap.sourceSelection || []).map((x) => Number(x)));
    state.sourceCutsV = cloneCuts(snap.sourceCutsV || []);
    state.sourceCutsH = cloneCuts(snap.sourceCutsH || []);
    state.sourceSelectedCut = snap.sourceSelectedCut ? { ...snap.sourceSelectedCut } : null;
    state.sourceNextId = Math.max(1, Number(snap.sourceNextId || 1));
    state.rapidManualAdd = !!snap.rapidManualAdd;
    state.drawMode = state.sourceMode === "draw_box";
    state.drawCurrent = null;
    state.drawStart = null;
    state.drawing = false;
    state.sourceDrag = null;
    state.sourceRowDrag = null;
    state.sourceContextTarget = null;
    const rapid = $("rapidManualAdd");
    if (rapid) rapid.checked = !!state.rapidManualAdd;
    syncLayersFromSessionCells();
    recomputeFrameGeometry();
      updateSourceToolUI();
      updateVerifyUI();
      updateTermppSkinUI();
      updateWebbuildUI();
      renderAll();
  }

  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 50) state.history.shift();
    state.future = [];
    markSessionDirty("edit");
    updateUndoRedoButtons();
  }

  function revertNoopHistory(wasDirty) {
    if (state.history.length) state.history.pop();
    updateUndoRedoButtons();
    if (!wasDirty) {
      state.sessionDirty = false;
      updateSessionDirtyBadge();
    }
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

  function colorsEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1]) && Number(a[2]) === Number(b[2]);
  }

  function rgbToHex(rgb) {
    const r = Math.max(0, Math.min(255, Number(rgb?.[0] || 0)));
    const g = Math.max(0, Math.min(255, Number(rgb?.[1] || 0)));
    const b = Math.max(0, Math.min(255, Number(rgb?.[2] || 0)));
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  function hexToRgb(hex) {
    const s = String(hex || "").trim();
    const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
    if (!m) return [255, 255, 255];
    const n = m[1];
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }

  function decodeCellHalves(c) {
    const glyph = Number(c?.glyph || 0);
    const fg = Array.isArray(c?.fg) ? [...c.fg] : [0, 0, 0];
    const bg = Array.isArray(c?.bg) ? [...c.bg] : [...MAGENTA];
    const bgColor = isMagenta(bg) ? null : bg;
    if (glyph === 219) return { top: fg, bottom: fg };
    if (glyph === 223) return { top: fg, bottom: bgColor };
    if (glyph === 220) return { top: bgColor, bottom: fg };
    if (glyph === 0 || glyph === 32) return { top: bgColor, bottom: bgColor };
    return { top: fg, bottom: fg };
  }

  function encodeCellHalves(top, bottom, prevCell) {
    const prev = prevCell || { glyph: 0, fg: [255, 255, 255], bg: [...MAGENTA] };
    const fgPrev = Array.isArray(prev.fg) ? [...prev.fg] : [255, 255, 255];
    const out = { glyph: 0, fg: fgPrev, bg: [...MAGENTA] };
    if (!top && !bottom) return out;
    if (colorsEqual(top, bottom) && top) {
      out.glyph = 219;
      out.fg = [...top];
      return out;
    }
    if (top && !bottom) {
      out.glyph = 223;
      out.fg = [...top];
      out.bg = [...MAGENTA];
      return out;
    }
    if (!top && bottom) {
      out.glyph = 220;
      out.fg = [...bottom];
      out.bg = [...MAGENTA];
      return out;
    }
    out.glyph = 223;
    out.fg = [...top];
    out.bg = [...bottom];
    return out;
  }

  function updateInspectorToolUI() {
    const map = [
      ["inspectorToolInspectBtn", "inspect"],
      ["inspectorToolSelectBtn", "select"],
      ["inspectorToolGlyphBtn", "glyph"],
      ["inspectorToolPaintBtn", "paint"],
      ["inspectorToolEraseBtn", "erase"],
      ["inspectorToolDropperBtn", "dropper"],
    ];
    for (const [id, key] of map) {
      const el = $(id);
      if (!el) continue;
      el.classList.toggle("tool-active", state.inspectorTool === key);
    }
    const colorInput = $("inspectorPaintColor");
    if (colorInput) colorInput.value = rgbToHex(state.inspectorPaintColor);
    const glyphCode = $("inspectorGlyphCode");
    if (glyphCode) glyphCode.value = String(clampInspectorGlyphCode(state.inspectorGlyphCode));
    const glyphChar = $("inspectorGlyphChar");
    if (glyphChar) {
      const g = clampInspectorGlyphCode(state.inspectorGlyphCode);
      glyphChar.value = g >= 32 && g <= 255 ? String.fromCharCode(g) : "";
    }
    const glyphFg = $("inspectorGlyphFgColor");
    if (glyphFg) glyphFg.value = rgbToHex(state.inspectorGlyphFgColor);
    const glyphBg = $("inspectorGlyphBgColor");
    if (glyphBg) glyphBg.value = rgbToHex(state.inspectorGlyphBgColor);
    const hint = $("inspectorToolHint");
    if (!hint) return;
    const clipState = state.inspectorFrameClipboard ? " Frame clipboard: yes." : "";
    const selClipState = state.inspectorSelectionClipboard ? " Selection clipboard: yes." : "";
    const base = `Embedded XP frame editor. Visual layer only. Shortcuts: G glyph, S select, P/E half paint/erase, I dropper, Q/R angle nav, A/D frame nav, C/X/V selection copy/cut/paste, F frame flip-H, Delete clear sel/frame.${clipState}${selClipState}`;
    if (state.inspectorTool === "paint") hint.textContent = `${base} Drag to paint half-cells.`;
    else if (state.inspectorTool === "erase") hint.textContent = `${base} Drag to erase half-cells to transparent.`;
    else if (state.inspectorTool === "dropper") hint.textContent = `${base} Click a half-cell to sample color.`;
    else if (state.inspectorTool === "glyph") hint.textContent = `${base} Click/drag to stamp full XP cells (glyph + FG/BG).`;
    else if (state.inspectorTool === "select") hint.textContent = `${base} Drag a rectangle selection (cell coordinates).`;
    else hint.textContent = base;
    const showGrid = $("inspectorShowGrid");
    const showChecker = $("inspectorShowChecker");
    if (showGrid) showGrid.checked = !!state.inspectorShowGrid;
    if (showChecker) showChecker.checked = !!state.inspectorShowChecker;
    const pasteBtn = $("inspectorPasteFrameBtn");
    if (pasteBtn) pasteBtn.disabled = !state.inspectorFrameClipboard;
    const pasteSelBtn = $("inspectorPasteSelBtn");
    if (pasteSelBtn) pasteSelBtn.disabled = !state.inspectorSelectionClipboard;
    const needSel = !normalizeInspectorSelection(state.inspectorSelection);
    for (const id of ["inspectorCopySelBtn", "inspectorCutSelBtn", "inspectorClearSelBtn", "inspectorFillSelBtn", "inspectorReplaceFgBtn", "inspectorReplaceBgBtn"]) {
      const el = $(id);
      if (el) el.disabled = needSel;
    }
    for (const id of ["inspectorRotateSelCwBtn", "inspectorRotateSelCcwBtn", "inspectorFlipSelHBtn", "inspectorFlipSelVBtn"]) {
      const el = $(id);
      if (el) el.disabled = needSel;
    }
    const selAllBtn = $("inspectorSelectAllBtn");
    if (selAllBtn) selAllBtn.disabled = !state.inspectorOpen;
    const hasMatchSource = !!state.inspectorLastInspectCell;
    for (const id of ["inspectorReplaceFgBtn", "inspectorReplaceBgBtn"]) {
      const el = $(id);
      if (el) el.disabled = needSel || !hasMatchSource;
    }
    const matchInfo = $("inspectorMatchSourceInfo");
    if (matchInfo) {
      if (!hasMatchSource) {
        matchInfo.textContent = "Match source: none (use Inspect or Dropper on a cell)";
      } else {
        const s = state.inspectorLastInspectCell;
        matchInfo.textContent = `Match source: glyph=${clampInspectorGlyphCode(s.glyph)} fg=${rgbToHex(s.fg)} bg=${rgbToHex(s.bg)}`;
      }
    }
    const hoverInfo = $("inspectorHoverReadout");
    if (hoverInfo) {
      if (!state.inspectorHover || !state.inspectorHover.cell) hoverInfo.textContent = "Hover: none";
      else {
        const h = state.inspectorHover;
        hoverInfo.textContent = `Hover: x=${h.cx} y=${h.cy} half=${h.half} glyph=${Number(h.cell.glyph || 0)} fg=${rgbToHex(h.cell.fg || [0, 0, 0])} bg=${rgbToHex(h.cell.bg || [0, 0, 0])}`;
      }
    }
    const pasteAnchorInfo = $("inspectorPasteAnchorReadout");
    if (pasteAnchorInfo) {
      if (state.inspectorHover) {
        pasteAnchorInfo.textContent = `Paste anchor: x=${Number(state.inspectorHover.cx || 0)} y=${Number(state.inspectorHover.cy || 0)} (current hover)`;
      } else if (state.inspectorLastHoverAnchor) {
        pasteAnchorInfo.textContent = `Paste anchor: x=${Number(state.inspectorLastHoverAnchor.cx || 0)} y=${Number(state.inspectorLastHoverAnchor.cy || 0)} (last hovered cell)`;
      } else {
        pasteAnchorInfo.textContent = "Paste anchor: none (hover a cell, then click Paste Sel)";
      }
    }
    const frApply = $("inspectorFindReplaceApplyBtn");
    const frScope = String($("inspectorFrScope")?.value || "selection");
    if (frApply) frApply.disabled = (frScope === "selection" && needSel);
  }

  function renderInspectorPaletteSwatches() {
    const box = $("inspectorPaletteSwatches");
    if (!box) return;
    if (box.childElementCount) return;
    for (const rgb of INSPECTOR_SWATCHES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = `FG click / BG right-click ${rgbToHex(rgb)}`;
      btn.style.width = "18px";
      btn.style.height = "18px";
      btn.style.padding = "0";
      btn.style.border = "1px solid #334";
      btn.style.background = rgbToHex(rgb);
      btn.dataset.color = rgb.join(",");
      btn.addEventListener("click", () => {
        state.inspectorGlyphFgColor = [...rgb];
        updateInspectorToolUI();
        renderInspector();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        state.inspectorGlyphBgColor = [...rgb];
        updateInspectorToolUI();
        renderInspector();
      });
      box.appendChild(btn);
    }
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

  function angleNameForIndex(i) {
    const idx = Math.max(0, Number(i || 0));
    if (state.angles === 8) {
      const names = ["South", "SouthWest", "West", "NorthWest", "North", "NorthEast", "East", "SouthEast"];
      return names[idx] || `Angle ${idx}`;
    }
    if (state.angles === 4) {
      const names = ["South", "West", "North", "East"];
      return names[idx] || `Angle ${idx}`;
    }
    if (state.angles === 1) return "South";
    return `Angle ${idx}`;
  }

  function semanticFrameLabel(row, col) {
    const info = frameColInfo(col);
    const angleName = angleNameForIndex(row);
    return `A${row} ${angleName} F${info.frame}${state.projs > 1 ? ` P${info.proj}` : ""}`;
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
    if (state.inspectorShowChecker) {
      const sz = Math.max(2, Math.floor(zoom / 2));
      for (let y = 0; y < canvas.height; y += sz) {
        for (let x = 0; x < canvas.width; x += sz) {
          const dark = (((x / sz) | 0) + ((y / sz) | 0)) % 2 === 0;
          ctx.fillStyle = dark ? "rgb(22,26,34)" : "rgb(34,40,52)";
          ctx.fillRect(x, y, sz, sz);
        }
      }
    } else {
      ctx.fillStyle = "rgb(0,0,0)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

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
    label.textContent = semanticFrameLabel(row, col);
    frame.title = `Angle ${row} (${angleNameForIndex(row)}), Frame ${frameColInfo(col).frame}${state.projs > 1 ? `, Proj ${frameColInfo(col).proj}` : ""}`;
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
    renderJitterInfo();
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
      source_boxes: state.extractedBoxes.length,
      source_cuts_v: state.sourceCutsV.length,
      source_mode: state.sourceMode,
    };
    $("sessionOut").textContent = JSON.stringify(summary, null, 2);
  }

  function renderSourceCanvas() {
    const canvas = $("sourceCanvas");
    const ctx = canvas.getContext("2d");
    state.extractedBoxes = (state.extractedBoxes || []).map((b) =>
      (b && b.id !== undefined)
        ? { source: b.source || "auto", ...b }
        : { id: nextSourceId(), source: "auto", ...b }
    );
    const drawChecker = (w, h, size = 8) => {
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          const even = ((Math.floor(x / size) + Math.floor(y / size)) % 2) === 0;
          ctx.fillStyle = even ? "rgb(18,24,34)" : "rgb(10,14,20)";
          ctx.fillRect(x, y, size, size);
        }
      }
    };
    const drawBoxOutline = (b, color, width = 1, dash = []) => {
      if (!b) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash.length) ctx.setLineDash(dash);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, Math.max(1, b.w - 1), Math.max(1, b.h - 1));
      ctx.restore();
    };
    const drawHandles = (b, color) => {
      if (!b) return;
      const pts = [
        [b.x, b.y],
        [boxRight(b), b.y],
        [b.x, boxBottom(b)],
        [boxRight(b), boxBottom(b)],
      ];
      ctx.save();
      ctx.fillStyle = color;
      for (const [x, y] of pts) ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.restore();
    };
    if (!state.sourceImage) {
      drawChecker(canvas.width, canvas.height, 8);
      $("sourceInfo").textContent = "No source image loaded.";
      return;
    }
    canvas.width = state.sourceImage.width;
    canvas.height = state.sourceImage.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawChecker(canvas.width, canvas.height, 8);
    ctx.drawImage(state.sourceImage, 0, 0);

    for (const cut of state.sourceCutsV) {
      const selected = state.sourceSelectedCut && state.sourceSelectedCut.type === "v" && Number(state.sourceSelectedCut.id) === Number(cut.id);
      ctx.save();
      ctx.strokeStyle = selected ? "rgba(255,95,95,0.95)" : "rgba(168,99,255,0.9)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.setLineDash(selected ? [] : [4, 3]);
      ctx.beginPath();
      ctx.moveTo(cut.x + 0.5, 0);
      ctx.lineTo(cut.x + 0.5, canvas.height);
      ctx.stroke();
      ctx.restore();
    }

    for (const b of state.extractedBoxes) {
      const selected = state.sourceSelection.has(Number(b.id));
      drawBoxOutline(b, selected ? "rgba(99,255,219,0.98)" : "rgba(243,182,63,0.95)", selected ? 2 : 1);
      if (selected) drawHandles(b, "rgba(99,255,219,0.98)");
    }
    if (state.anchorBox) {
      drawBoxOutline(state.anchorBox, "rgba(79,209,122,0.95)", 2, [5, 3]);
    }
    if (state.drawCurrent) {
      drawBoxOutline(state.drawCurrent, "rgba(78,161,255,0.98)", 2);
      drawHandles(state.drawCurrent, "rgba(78,161,255,0.98)");
    }
    if (state.sourceRowDrag?.rect) {
      const mode = state.sourceRowDrag.mode;
      const c = mode === "col_select" ? "rgba(255,123,63,0.85)" : "rgba(255,230,63,0.85)";
      ctx.save();
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      const r = state.sourceRowDrag.rect;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(1, r.w - 1), Math.max(1, r.h - 1));
      ctx.restore();
    }

    const anchorTxt = state.anchorBox ? ` anchor=${state.anchorBox.w}x${state.anchorBox.h}` : "";
    const draftTxt = state.drawCurrent ? ` draft=${state.drawCurrent.w}x${state.drawCurrent.h}` : "";
    const selTxt = ` selected=${state.sourceSelection.size}`;
    const cutTxt = ` cutsV=${state.sourceCutsV.length}`;
    $("sourceInfo").textContent = `sprites_detected=${state.extractedBoxes.length}${anchorTxt}${draftTxt}${selTxt}${cutTxt}`;
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

  function inspectorFrameCellMatrix(row, col) {
    const out = [];
    for (let y = 0; y < state.frameHChars; y++) {
      const line = [];
      for (let x = 0; x < state.frameWChars; x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        line.push(gx >= state.gridCols || gy >= state.gridRows ? transparentCell(0) : { ...cellAt(gx, gy) });
      }
      out.push(line);
    }
    return out;
  }

  function writeFrameCellMatrix(row, col, matrix) {
    clearFrame(row, col);
    if (!Array.isArray(matrix)) return;
    for (let y = 0; y < Math.min(state.frameHChars, matrix.length); y++) {
      const line = Array.isArray(matrix[y]) ? matrix[y] : [];
      for (let x = 0; x < Math.min(state.frameWChars, line.length); x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        setCell(gx, gy, line[x] || transparentCell(0));
      }
    }
  }

  function flipFrameMatrixH(matrix) {
    return (matrix || []).map((line) => [...line].reverse().map((c) => ({ ...c })));
  }

  function inspectorCurrentFrameCoord() {
    const row = Math.max(0, Math.min(state.angles - 1, Number(state.inspectorRow || 0)));
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const maxCol = Math.max(0, semanticFrames * Math.max(1, state.projs) - 1);
    const col = Math.max(0, Math.min(maxCol, Number(state.inspectorCol || 0)));
    return { row, col, semanticFrames, maxCol };
  }

  function clampInspectorGlyphCode(v) {
    return Math.max(0, Math.min(255, Number(v || 0) | 0));
  }

  function normalizeInspectorSelection(sel) {
    if (!sel) return null;
    const x1 = Math.max(0, Math.min(state.frameWChars - 1, Number(sel.x1)));
    const y1 = Math.max(0, Math.min(state.frameHChars - 1, Number(sel.y1)));
    const x2 = Math.max(0, Math.min(state.frameWChars - 1, Number(sel.x2)));
    const y2 = Math.max(0, Math.min(state.frameHChars - 1, Number(sel.y2)));
    return {
      x1: Math.min(x1, x2),
      y1: Math.min(y1, y2),
      x2: Math.max(x1, x2),
      y2: Math.max(y1, y2),
    };
  }

  function inspectorSelectionOrWholeFrame() {
    return normalizeInspectorSelection(state.inspectorSelection) || {
      x1: 0,
      y1: 0,
      x2: Math.max(0, state.frameWChars - 1),
      y2: Math.max(0, state.frameHChars - 1),
    };
  }

  function inspectorSelectionLabel() {
    const s = normalizeInspectorSelection(state.inspectorSelection);
    if (!s) return "none";
    return `${s.x1},${s.y1}..${s.x2},${s.y2}`;
  }

  function inspectorCellFromLocal(row, col, cx, cy) {
    const gx = col * state.frameWChars + cx;
    const gy = row * state.frameHChars + cy;
    if (gx < 0 || gy < 0 || gx >= state.gridCols || gy >= state.gridRows) return null;
    return { gx, gy, cell: cellAt(gx, gy) };
  }

  function cellEquals(a, b) {
    if (!a || !b) return false;
    return (
      Number(a.glyph || 0) === Number(b.glyph || 0) &&
      colorsEqual(a.fg || [0, 0, 0], b.fg || [0, 0, 0]) &&
      colorsEqual(a.bg || [0, 0, 0], b.bg || [0, 0, 0])
    );
  }

  function currentInspectorGlyphCell() {
    return {
      glyph: clampInspectorGlyphCode(state.inspectorGlyphCode),
      fg: [...(Array.isArray(state.inspectorGlyphFgColor) ? state.inspectorGlyphFgColor : [255, 255, 255])],
      bg: [...(Array.isArray(state.inspectorGlyphBgColor) ? state.inspectorGlyphBgColor : [...MAGENTA])],
    };
  }

  function setInspectorGlyphUIFromCell(c) {
    if (!c) return;
    state.inspectorGlyphCode = clampInspectorGlyphCode(c.glyph);
    state.inspectorGlyphFgColor = [...(Array.isArray(c.fg) ? c.fg : [255, 255, 255])];
    state.inspectorGlyphBgColor = [...(Array.isArray(c.bg) ? c.bg : [...MAGENTA])];
    state.inspectorLastInspectCell = {
      glyph: state.inspectorGlyphCode,
      fg: [...state.inspectorGlyphFgColor],
      bg: [...state.inspectorGlyphBgColor],
    };
    const fg = rgbToHex(state.inspectorGlyphFgColor);
    const bg = rgbToHex(state.inspectorGlyphBgColor);
    if ($("inspectorFrFindGlyph")) $("inspectorFrFindGlyph").value = String(state.inspectorGlyphCode);
    if ($("inspectorFrFindFg")) $("inspectorFrFindFg").value = fg;
    if ($("inspectorFrFindBg")) $("inspectorFrFindBg").value = bg;
  }

  function inspectorSelectionMatrix(row, col, sel) {
    const s = normalizeInspectorSelection(sel);
    if (!s) return null;
    const out = [];
    for (let y = s.y1; y <= s.y2; y++) {
      const line = [];
      for (let x = s.x1; x <= s.x2; x++) {
        const rec = inspectorCellFromLocal(row, col, x, y);
        line.push(rec ? { ...rec.cell } : transparentCell(0));
      }
      out.push(line);
    }
    return out;
  }

  function selectionBoundsFromMatrixAtAnchor(anchorX, anchorY, matrix) {
    const rows = Array.isArray(matrix) ? matrix.length : 0;
    const cols = rows > 0 && Array.isArray(matrix[0]) ? matrix[0].length : 0;
    const x1 = Math.max(0, Math.min(state.frameWChars - 1, Number(anchorX || 0)));
    const y1 = Math.max(0, Math.min(state.frameHChars - 1, Number(anchorY || 0)));
    const x2 = Math.max(x1, Math.min(state.frameWChars - 1, x1 + Math.max(0, cols - 1)));
    const y2 = Math.max(y1, Math.min(state.frameHChars - 1, y1 + Math.max(0, rows - 1)));
    return { x1, y1, x2, y2 };
  }

  function writeInspectorSelectionMatrix(row, col, sel, matrix) {
    const s = normalizeInspectorSelection(sel);
    if (!s || !Array.isArray(matrix)) return 0;
    let changed = 0;
    for (let y = 0; y < matrix.length; y++) {
      const line = Array.isArray(matrix[y]) ? matrix[y] : [];
      for (let x = 0; x < line.length; x++) {
        const tx = s.x1 + x;
        const ty = s.y1 + y;
        if (tx > s.x2 || ty > s.y2) continue;
        const rec = inspectorCellFromLocal(row, col, tx, ty);
        if (!rec) continue;
        const next = line[x] || transparentCell(0);
        if (cellEquals(rec.cell, next)) continue;
        setCell(rec.gx, rec.gy, next);
        changed += 1;
      }
    }
    return changed;
  }

  function inspectorCellRectAtEvent(evt) {
    const hit = inspectorHalfCellAtEvent(evt);
    if (!hit) return null;
    return { row: hit.row, col: hit.col, cx: hit.cx, cy: hit.cy };
  }

  function setInspectorHoverFromHit(hit) {
    if (!hit) {
      state.inspectorHover = null;
      updateInspectorToolUI();
      return;
    }
    const rec = inspectorCellFromLocal(hit.row, hit.col, hit.cx, hit.cy);
    state.inspectorHover = rec ? { cx: hit.cx, cy: hit.cy, half: hit.half || "top", cell: { ...rec.cell } } : null;
    if (state.inspectorHover) {
      state.inspectorLastHoverAnchor = { cx: Number(state.inspectorHover.cx || 0), cy: Number(state.inspectorHover.cy || 0) };
    }
    updateInspectorToolUI();
  }

  function selectionMatrixFlipH(matrix) {
    return (Array.isArray(matrix) ? matrix : []).map((row) => (Array.isArray(row) ? [...row].reverse().map((c) => ({ ...c })) : []));
  }

  function selectionMatrixFlipV(matrix) {
    return [...(Array.isArray(matrix) ? matrix : [])].reverse().map((row) => (Array.isArray(row) ? row.map((c) => ({ ...c })) : []));
  }

  function selectionMatrixRotate(matrix, clockwise) {
    const src = Array.isArray(matrix) ? matrix : [];
    const h = src.length;
    const w = h > 0 && Array.isArray(src[0]) ? src[0].length : 0;
    if (!h || !w) return [];
    const out = [];
    if (clockwise) {
      for (let y = 0; y < w; y++) {
        const row = [];
        for (let x = 0; x < h; x++) row.push({ ...(src[h - 1 - x]?.[y] || transparentCell(0)) });
        out.push(row);
      }
    } else {
      for (let y = 0; y < w; y++) {
        const row = [];
        for (let x = 0; x < h; x++) row.push({ ...(src[x]?.[w - 1 - y] || transparentCell(0)) });
        out.push(row);
      }
    }
    return out;
  }

  function inspectorSelectAll() {
    if (!state.inspectorOpen) return false;
    state.inspectorSelection = normalizeInspectorSelection({
      x1: 0,
      y1: 0,
      x2: Math.max(0, state.frameWChars - 1),
      y2: Math.max(0, state.frameHChars - 1),
    });
    updateInspectorToolUI();
    renderInspector();
    return true;
  }

  function transformInspectorSelection(kind) {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for selection transforms", "warn");
      return false;
    }
    const sel = normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      status("No selection to transform", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    const src = inspectorSelectionMatrix(row, col, sel);
    let dst = src;
    if (kind === "flip_h") dst = selectionMatrixFlipH(src);
    else if (kind === "flip_v") dst = selectionMatrixFlipV(src);
    else if (kind === "rot_cw") dst = selectionMatrixRotate(src, true);
    else if (kind === "rot_ccw") dst = selectionMatrixRotate(src, false);
    else return false;
    const wasDirty = !!state.sessionDirty;
    pushHistory();
    let changed = 0;
    changed += writeInspectorSelectionMatrix(row, col, sel, Array.isArray(src) ? src.map((r) => r.map(() => transparentCell(0))) : []);
    const nextSel = selectionBoundsFromMatrixAtAnchor(sel.x1, sel.y1, dst);
    changed += writeInspectorSelectionMatrix(row, col, nextSel, dst);
    state.inspectorSelection = normalizeInspectorSelection(nextSel);
    if (!changed) {
      revertNoopHistory(wasDirty);
      status("Selection transform made no changes", "warn");
      return false;
    }
    renderAll();
    saveSessionState(`inspector-${kind}`);
    status(`Applied ${kind.replace("_", " ")} to selection`, "ok");
    return true;
  }

  function applyInspectorGlyphAtCell(hit) {
    if (!hit) return false;
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for inspector edits", "warn");
      return false;
    }
    const rec = inspectorCellFromLocal(hit.row, hit.col, hit.cx, hit.cy);
    if (!rec) return false;
    const next = currentInspectorGlyphCell();
    if (cellEquals(rec.cell, next)) return false;
    setCell(rec.gx, rec.gy, next);
    return true;
  }

  function copyInspectorSelection() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    const sel = normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      status("No frame selection to copy", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    state.inspectorSelectionClipboard = inspectorSelectionMatrix(row, col, sel);
    updateInspectorToolUI();
    status(`Copied selection ${inspectorSelectionLabel()}`, "ok");
    return true;
  }

  function pasteInspectorSelection() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for inspector paste", "warn");
      return false;
    }
    if (!state.inspectorSelectionClipboard) {
      status("No copied selection in clipboard", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    let sel = normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      const anchor = state.inspectorHover
        ? { x: Number(state.inspectorHover.cx || 0), y: Number(state.inspectorHover.cy || 0) }
        : state.inspectorLastHoverAnchor
          ? { x: Number(state.inspectorLastHoverAnchor.cx || 0), y: Number(state.inspectorLastHoverAnchor.cy || 0) }
          : { x: 0, y: 0 };
      sel = selectionBoundsFromMatrixAtAnchor(anchor.x, anchor.y, state.inspectorSelectionClipboard);
      state.inspectorSelection = normalizeInspectorSelection(sel);
    }
    const wasDirty = !!state.sessionDirty;
    pushHistory();
    const changed = writeInspectorSelectionMatrix(row, col, sel, state.inspectorSelectionClipboard);
    if (!changed) {
      revertNoopHistory(wasDirty);
      status("Paste selection made no changes", "warn");
      return false;
    }
    renderAll();
    saveSessionState("inspector-paste-selection");
    status(`Pasted selection into ${inspectorSelectionLabel()}`, "ok");
    return true;
  }

  function clearInspectorSelectionCells() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for clear selection", "warn");
      return false;
    }
    const sel = normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      status("No selection to clear", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    const wasDirty = !!state.sessionDirty;
    pushHistory();
    let changed = 0;
    for (let y = sel.y1; y <= sel.y2; y++) {
      for (let x = sel.x1; x <= sel.x2; x++) {
        const rec = inspectorCellFromLocal(row, col, x, y);
        if (!rec) continue;
        const next = transparentCell(0);
        if (cellEquals(rec.cell, next)) continue;
        setCell(rec.gx, rec.gy, next);
        changed += 1;
      }
    }
    if (!changed) {
      revertNoopHistory(wasDirty);
      status("Selection already empty", "warn");
      return false;
    }
    renderAll();
    saveSessionState("inspector-clear-selection");
    status(`Cleared selection ${inspectorSelectionLabel()}`, "ok");
    return true;
  }

  function cutInspectorSelection() {
    if (!copyInspectorSelection()) return false;
    return clearInspectorSelectionCells();
  }

  function fillInspectorSelectionWithGlyph() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for fill selection", "warn");
      return false;
    }
    const sel = normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      status("No selection to fill", "warn");
      return false;
    }
    const fillCell = currentInspectorGlyphCell();
    const { row, col } = inspectorCurrentFrameCoord();
    const wasDirty = !!state.sessionDirty;
    pushHistory();
    let changed = 0;
    for (let y = sel.y1; y <= sel.y2; y++) {
      for (let x = sel.x1; x <= sel.x2; x++) {
        const rec = inspectorCellFromLocal(row, col, x, y);
        if (!rec) continue;
        if (cellEquals(rec.cell, fillCell)) continue;
        setCell(rec.gx, rec.gy, fillCell);
        changed += 1;
      }
    }
    if (!changed) {
      revertNoopHistory(wasDirty);
      status("Fill selection made no changes", "warn");
      return false;
    }
    renderAll();
    saveSessionState("inspector-fill-selection");
    status(`Filled selection ${inspectorSelectionLabel()}`, "ok");
    return true;
  }

  function replaceInspectorSelectionColor(channel) {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for replace color", "warn");
      return false;
    }
    const sel = normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      status("No selection for color replace", "warn");
      return false;
    }
    const sample = state.inspectorLastInspectCell;
    if (!sample) {
      status("Inspect or dropper a cell first to set match colors", "warn");
      return false;
    }
    const target = channel === "bg" ? sample.bg : sample.fg;
    const replacement = channel === "bg" ? state.inspectorGlyphBgColor : state.inspectorGlyphFgColor;
    const { row, col } = inspectorCurrentFrameCoord();
    const wasDirty = !!state.sessionDirty;
    pushHistory();
    let changed = 0;
    for (let y = sel.y1; y <= sel.y2; y++) {
      for (let x = sel.x1; x <= sel.x2; x++) {
        const rec = inspectorCellFromLocal(row, col, x, y);
        if (!rec) continue;
        const cur = rec.cell;
        const next = { ...cur, fg: [...cur.fg], bg: [...cur.bg] };
        const before = channel === "bg" ? cur.bg : cur.fg;
        if (!colorsEqual(before, target)) continue;
        if (channel === "bg") next.bg = [...replacement];
        else next.fg = [...replacement];
        if (cellEquals(cur, next)) continue;
        setCell(rec.gx, rec.gy, next);
        changed += 1;
      }
    }
    if (!changed) {
      revertNoopHistory(wasDirty);
      status(`No ${channel.toUpperCase()} matches in selection`, "warn");
      return false;
    }
    renderAll();
    saveSessionState(channel === "bg" ? "inspector-replace-bg-selection" : "inspector-replace-fg-selection");
    status(`Replaced ${channel.toUpperCase()} color in selection`, "ok");
    return true;
  }

  function applyInspectorFindReplace() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for find/replace", "warn");
      return false;
    }
    const matchGlyph = !!$("inspectorFrMatchGlyphChk")?.checked;
    const matchFg = !!$("inspectorFrMatchFgChk")?.checked;
    const matchBg = !!$("inspectorFrMatchBgChk")?.checked;
    if (!matchGlyph && !matchFg && !matchBg) {
      status("Find/Replace: enable at least one match criterion", "warn");
      return false;
    }
    const replGlyphOn = !!$("inspectorFrReplaceGlyphChk")?.checked;
    const replFgOn = !!$("inspectorFrReplaceFgChk")?.checked;
    const replBgOn = !!$("inspectorFrReplaceBgChk")?.checked;
    if (!replGlyphOn && !replFgOn && !replBgOn) {
      status("Find/Replace: enable at least one replacement channel", "warn");
      return false;
    }
    const findGlyph = clampInspectorGlyphCode($("inspectorFrFindGlyph")?.value || 0);
    const findFg = hexToRgb($("inspectorFrFindFg")?.value || "#ffffff");
    const findBg = hexToRgb($("inspectorFrFindBg")?.value || "#ff00ff");
    const replGlyph = clampInspectorGlyphCode($("inspectorFrReplGlyph")?.value || 0);
    const replFg = hexToRgb($("inspectorFrReplFg")?.value || "#ffffff");
    const replBg = hexToRgb($("inspectorFrReplBg")?.value || "#ff00ff");
    const scope = String($("inspectorFrScope")?.value || "selection");
    const { row, col } = inspectorCurrentFrameCoord();
    const sel = scope === "frame" ? {
      x1: 0, y1: 0, x2: Math.max(0, state.frameWChars - 1), y2: Math.max(0, state.frameHChars - 1),
    } : normalizeInspectorSelection(state.inspectorSelection);
    if (!sel) {
      status("Find/Replace scope is selection, but no selection exists", "warn");
      return false;
    }
    const wasDirty = !!state.sessionDirty;
    pushHistory();
    let changed = 0;
    for (let y = sel.y1; y <= sel.y2; y++) {
      for (let x = sel.x1; x <= sel.x2; x++) {
        const rec = inspectorCellFromLocal(row, col, x, y);
        if (!rec) continue;
        const cur = rec.cell;
        if (matchGlyph && Number(cur.glyph || 0) !== findGlyph) continue;
        if (matchFg && !colorsEqual(cur.fg || [0, 0, 0], findFg)) continue;
        if (matchBg && !colorsEqual(cur.bg || [0, 0, 0], findBg)) continue;
        const next = {
          ...cur,
          glyph: replGlyphOn ? replGlyph : Number(cur.glyph || 0),
          fg: replFgOn ? [...replFg] : [...(cur.fg || [0, 0, 0])],
          bg: replBgOn ? [...replBg] : [...(cur.bg || [0, 0, 0])],
        };
        if (cellEquals(cur, next)) continue;
        setCell(rec.gx, rec.gy, next);
        changed += 1;
      }
    }
    if (!changed) {
      revertNoopHistory(wasDirty);
      status("Find/Replace made no changes", "warn");
      const info = $("inspectorFindReplaceInfo");
      if (info) info.textContent = "Find & Replace: no matching cells in scope.";
      return false;
    }
    renderAll();
    saveSessionState("inspector-find-replace");
    const info = $("inspectorFindReplaceInfo");
    if (info) info.textContent = `Find & Replace updated ${changed} cell(s) in ${scope === "frame" ? "whole frame" : "selection"}.`;
    status(`Find/Replace updated ${changed} cell(s)`, "ok");
    return true;
  }

  function moveInspectorSelection(deltaRow, deltaCol) {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    const cur = inspectorCurrentFrameCoord();
    const nextRow = Math.max(0, Math.min(state.angles - 1, cur.row + Number(deltaRow || 0)));
    const nextCol = Math.max(0, Math.min(cur.maxCol, cur.col + Number(deltaCol || 0)));
    state.inspectorRow = nextRow;
    state.inspectorCol = nextCol;
    state.selectedRow = nextRow;
    state.selectedCols = new Set([nextCol]);
    renderFrameGrid();
    renderPreviewFrame(nextRow, Math.max(0, Math.min(cur.semanticFrames - 1, nextCol % cur.semanticFrames)));
    renderInspector();
    return true;
  }

  function copyInspectorFrame() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    const { row, col } = inspectorCurrentFrameCoord();
    state.inspectorFrameClipboard = inspectorFrameCellMatrix(row, col);
    updateInspectorToolUI();
    status(`Copied frame row=${row} col=${col}`, "ok");
    return true;
  }

  function pasteInspectorFrame() {
    if (!state.inspectorOpen || !state.inspectorFrameClipboard) {
      status("No copied frame in clipboard", "warn");
      return false;
    }
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for frame paste", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    pushHistory();
    writeFrameCellMatrix(row, col, state.inspectorFrameClipboard);
    renderAll();
    saveSessionState("inspector-paste-frame");
    status(`Pasted frame into row=${row} col=${col}`, "ok");
    return true;
  }

  function flipInspectorFrameHorizontal() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for frame flip", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    pushHistory();
    const flipped = flipFrameMatrixH(inspectorFrameCellMatrix(row, col));
    writeFrameCellMatrix(row, col, flipped);
    renderAll();
    saveSessionState("inspector-flip-frame-h");
    status(`Flipped frame horizontally row=${row} col=${col}`, "ok");
    return true;
  }

  function clearInspectorFrame() {
    if (!state.inspectorOpen) return false;
    commitInspectorStrokeIfNeeded();
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active to clear frame", "warn");
      return false;
    }
    const { row, col } = inspectorCurrentFrameCoord();
    pushHistory();
    clearFrame(row, col);
    renderAll();
    saveSessionState("inspector-clear-frame");
    status(`Cleared frame row=${row} col=${col}`, "ok");
    return true;
  }

  function openInspector(row, col) {
    state.inspectorOpen = true;
    state.inspectorRow = Math.max(0, row);
    state.inspectorCol = Math.max(0, col);
    state.inspectorHover = null;
    state.inspectorLastHoverAnchor = null;
    const panel = $("cellInspectorPanel");
    if (panel) panel.classList.remove("hidden");
    renderInspector();
  }

  function closeInspector() {
    commitInspectorStrokeIfNeeded();
    state.inspectorOpen = false;
    state.inspectorSelecting = false;
    state.inspectorSelectAnchor = null;
    state.inspectorHover = null;
    state.inspectorLastHoverAnchor = null;
    const panel = $("cellInspectorPanel");
    if (panel) panel.classList.add("hidden");
    updateInspectorToolUI();
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

    if (state.inspectorShowGrid) {
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
    }

    const sel = normalizeInspectorSelection(state.inspectorSelection);
    if (sel) {
      const x = sel.x1 * zoom + 1;
      const y = sel.y1 * zoom * 2 + 1;
      const w = (sel.x2 - sel.x1 + 1) * zoom - 2;
      const h = (sel.y2 - sel.y1 + 1) * zoom * 2 - 2;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, Math.max(1, w), Math.max(1, h));
      ctx.restore();
    }

    if (!state.inspectorHover && state.inspectorLastHoverAnchor) {
      const ax = Number(state.inspectorLastHoverAnchor.cx || 0);
      const ay = Number(state.inspectorLastHoverAnchor.cy || 0);
      if (ax >= 0 && ay >= 0 && ax < state.frameWChars && ay < state.frameHChars) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,214,92,0.9)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.strokeRect(ax * zoom + 2, ay * zoom * 2 + 2, Math.max(2, zoom - 4), Math.max(2, zoom * 2 - 4));
        ctx.restore();
      }
    }

    const info = frameColInfo(col);
    $("cellInspectorInfo").textContent = [
      `row=${row} col=${col}`,
      `angle=${row} proj=${info.proj} frame=${info.frame}/${Math.max(0, info.semanticFrames - 1)}`,
      `active_layer=${state.activeLayer} visible_layers=[${[...state.visibleLayers].sort((a, b) => a - b).join(",")}]`,
      `frame_chars=${state.frameWChars}x${state.frameHChars * 2}`,
      `tool=${state.inspectorTool} sel=${inspectorSelectionLabel()} glyph=${clampInspectorGlyphCode(state.inspectorGlyphCode)} fg=${rgbToHex(state.inspectorGlyphFgColor)} bg=${rgbToHex(state.inspectorGlyphBgColor)} half=${rgbToHex(state.inspectorPaintColor)} grid=${state.inspectorShowGrid ? 1 : 0} checker=${state.inspectorShowChecker ? 1 : 0}`,
    ].join(" | ");
    updateInspectorToolUI();
  }

  function inspectorHalfCellAtEvent(evt) {
    const canvas = $("cellInspectorCanvas");
    if (!canvas || !state.inspectorOpen) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = Math.floor((evt.clientX - rect.left) * (canvas.width / rect.width));
    const py = Math.floor((evt.clientY - rect.top) * (canvas.height / rect.height));
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
    const zoom = Math.max(1, Number(state.inspectorZoom || 10));
    const halfX = Math.floor(px / zoom);
    const halfY = Math.floor(py / zoom);
    const cx = halfX;
    const half = (halfY % 2) === 0 ? "top" : "bottom";
    const cy = Math.floor(halfY / 2);
    if (cx < 0 || cy < 0 || cx >= state.frameWChars || cy >= state.frameHChars) return null;
    const row = Math.max(0, Math.min(state.angles - 1, Number(state.inspectorRow || 0)));
    const semanticFrames = Math.max(1, state.anims.reduce((a, b) => a + b, 0));
    const maxCol = Math.max(0, semanticFrames * Math.max(1, state.projs) - 1);
    const col = Math.max(0, Math.min(maxCol, Number(state.inspectorCol || 0)));
    return { row, col, cx, cy, half };
  }

  function applyInspectorToolAt(hit) {
    if (!hit) return false;
    const gx = hit.col * state.frameWChars + hit.cx;
    const gy = hit.row * state.frameHChars + hit.cy;
    if (gx < 0 || gy < 0 || gx >= state.gridCols || gy >= state.gridRows) return false;
    const prev = cellAt(gx, gy);
    const halves = decodeCellHalves(prev);
    if (state.inspectorTool === "inspect") {
      setInspectorGlyphUIFromCell(prev);
      updateInspectorToolUI();
      renderInspector();
      status(`Inspected cell glyph=${Number(prev.glyph || 0)} fg=${rgbToHex(prev.fg || [0, 0, 0])} bg=${rgbToHex(prev.bg || [0, 0, 0])}`, "ok");
      return false;
    }
    if (state.inspectorTool === "dropper") {
      const sampled = hit.half === "top" ? halves.top : halves.bottom;
      setInspectorGlyphUIFromCell(prev);
      if (!sampled) {
        status("Dropper sampled transparent half-cell", "warn");
        return false;
      }
      state.inspectorPaintColor = [...sampled];
      updateInspectorToolUI();
      renderInspector();
      status(`Sampled color ${rgbToHex(sampled)}`, "ok");
      return false;
    }
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active for inspector edits", "warn");
      return false;
    }
    if (state.inspectorTool !== "paint" && state.inspectorTool !== "erase") return false;
    if (state.inspectorTool === "paint") {
      if (hit.half === "top") halves.top = [...state.inspectorPaintColor];
      else halves.bottom = [...state.inspectorPaintColor];
    } else {
      if (hit.half === "top") halves.top = null;
      else halves.bottom = null;
    }
    const next = encodeCellHalves(halves.top, halves.bottom, prev);
    const changed =
      Number(prev.glyph || 0) !== Number(next.glyph || 0) ||
      !colorsEqual(prev.fg || [0, 0, 0], next.fg || [0, 0, 0]) ||
      !colorsEqual(prev.bg || [0, 0, 0], next.bg || [0, 0, 0]);
    if (!changed) return false;
    setCell(gx, gy, next);
    return true;
  }

  function commitInspectorStrokeIfNeeded() {
    if (!state.inspectorPainting) return;
    state.inspectorPainting = false;
    if (!state.inspectorStrokeChanged) {
      if (state.inspectorStrokeHadHistory) revertNoopHistory(!!state.inspectorStrokeWasDirty);
      state.inspectorStrokeChanged = false;
      state.inspectorStrokeHadHistory = false;
      state.inspectorStrokeWasDirty = false;
      renderInspector();
      return;
    }
    state.inspectorStrokeChanged = false;
    state.inspectorStrokeHadHistory = false;
    state.inspectorStrokeWasDirty = false;
    renderAll();
    saveSessionState("inspector-edit");
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
    const jitterDisabled = readOnly || !hasSelection;
    const jitterRowDisabled = readOnly || !hasRow;
    if ($("autoAlignSelectedBtn")) $("autoAlignSelectedBtn").disabled = jitterDisabled;
    if ($("autoAlignRowBtn")) $("autoAlignRowBtn").disabled = jitterRowDisabled;
    if ($("jitterLeftBtn")) $("jitterLeftBtn").disabled = jitterDisabled;
    if ($("jitterRightBtn")) $("jitterRightBtn").disabled = jitterDisabled;
    if ($("jitterUpBtn")) $("jitterUpBtn").disabled = jitterDisabled;
    if ($("jitterDownBtn")) $("jitterDownBtn").disabled = jitterDisabled;
  }

  async function saveSessionState(reason) {
    if (!state.sessionId) return;
    state.sessionSaveInFlight = true;
    updateSessionDirtyBadge();
    try {
      const payload = {
        session_id: state.sessionId,
        cells: state.cells,
        angles: state.angles,
        anims: state.anims,
        projs: state.projs,
        row_categories: state.rowCategories,
        frame_groups: state.frameGroups,
        source_boxes: state.extractedBoxes,
        source_anchor_box: state.anchorBox,
        source_draft_box: state.drawCurrent,
        source_cuts_v: state.sourceCutsV,
      };
      const r = await fetch("/api/workbench/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const txt = await r.text();
        state.sessionSaveInFlight = false;
        status(`Save failed (${reason})`, "err");
        $("exportOut").textContent = txt;
        updateSessionDirtyBadge();
      } else {
        markSessionSaved(reason);
      }
    } catch (e) {
      state.sessionSaveInFlight = false;
      status(`Save failed (${reason})`, "err");
      updateSessionDirtyBadge();
    }
  }

  function renderAll() {
    recomputeFrameGeometry();
    renderLayerControls();
    renderLegacyGrid();
    renderFrameGrid();
    renderMeta();
    renderJitterInfo();
    renderSession();
    renderSourceCanvas();
    const row = state.selectedRow === null ? 0 : state.selectedRow;
    renderPreviewFrame(Math.max(0, Math.min(state.angles - 1, row)), 0);
    renderInspector();
    updateSessionDirtyBadge();
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
      state.anchorBox = j.source_anchor_box ? { ...j.source_anchor_box } : null;
      state.drawCurrent = j.source_draft_box ? { ...j.source_draft_box } : null;
      state.extractedBoxes = cloneBoxes(j.source_boxes || []);
      state.sourceCutsV = cloneCuts(j.source_cuts_v || []);
      state.sourceCutsH = cloneCuts(j.source_cuts_h || []);
      state.sourceSelection = new Set();
      state.sourceSelectedCut = null;
      state.sourceRowDrag = null;
      state.sourceDrag = null;
      state.sourceNextId = Math.max(
        1,
        ...state.extractedBoxes.map((b) => Number(b.id || 0) + 1),
        ...state.sourceCutsV.map((c) => Number(c.id || 0) + 1),
        ...state.sourceCutsH.map((c) => Number(c.id || 0) + 1),
      );
      state.activeLayer = 2;
      state.visibleLayers = new Set([2]);
      state.selectedRow = null;
      state.selectedCols = new Set();
      state.history = [];
      state.future = [];
      state.sessionDirty = false;
      state.sessionSaveInFlight = false;
      state.sessionLastSaveOkAt = 0;
      state.sessionLastSaveReason = "";
      state.latestXpPath = "";
      $("openXpToolBtn").disabled = true;
      setXpToolHint("Export an `.xp` to generate XP tool command.");
      updateVerifyUI();
      updateTermppSkinUI();
      updateWebbuildUI();
      updateSourceToolUI();
      updateUndoRedoButtons();
      $("btnExport").disabled = false;
      syncLayersFromSessionCells();
      status(`Session active: ${state.sessionId.slice(0, 8)}...`, "ok");
      renderAll();
      if (!state.webbuild.loaded) openWebbuild();
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
      try {
        const a = document.createElement("a");
        a.href = `/api/workbench/download-xp?xp_path=${encodeURIComponent(state.latestXpPath)}`;
        a.download = "";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (_e) {
        // Export succeeded even if the browser blocks programmatic download.
      }
    } else {
      state.latestXpPath = "";
      $("openXpToolBtn").disabled = true;
    }
    status(r.ok ? "Export succeeded (download started)" : "Export failed", r.ok ? "ok" : "err");
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

  function nextSourceId() {
    const id = Number(state.sourceNextId || 1);
    state.sourceNextId = id + 1;
    return id;
  }

  function sourceCanvasSize() {
    const c = $("sourceCanvas");
    return { w: Math.max(1, c.width || 1), h: Math.max(1, c.height || 1) };
  }

  function clampBoxToCanvas(box) {
    if (!box) return null;
    const { w: cw, h: ch } = sourceCanvasSize();
    let x = Math.max(0, Math.min(cw - 1, Math.round(Number(box.x || 0))));
    let y = Math.max(0, Math.min(ch - 1, Math.round(Number(box.y || 0))));
    let width = Math.max(1, Math.round(Number(box.w || 1)));
    let height = Math.max(1, Math.round(Number(box.h || 1)));
    if (x + width > cw) width = Math.max(1, cw - x);
    if (y + height > ch) height = Math.max(1, ch - y);
    return { x, y, w: width, h: height };
  }

  function boxRight(b) {
    return b.x + b.w - 1;
  }

  function boxBottom(b) {
    return b.y + b.h - 1;
  }

  function boxContainsPt(b, pt) {
    return pt.x >= b.x && pt.y >= b.y && pt.x <= boxRight(b) && pt.y <= boxBottom(b);
  }

  function boxesIntersect(a, b) {
    return !(boxRight(a) < b.x || boxRight(b) < a.x || boxBottom(a) < b.y || boxBottom(b) < a.y);
  }

  function committedBoxesOverlap(candidate, ignoreId = null) {
    const c = clampBoxToCanvas(candidate);
    if (!c) return false;
    return state.extractedBoxes.some((b) => Number(b.id) !== Number(ignoreId) && boxesIntersect(c, b));
  }

  function sourceBoxAtPoint(pt) {
    for (let i = state.extractedBoxes.length - 1; i >= 0; i--) {
      const b = state.extractedBoxes[i];
      if (boxContainsPt(b, pt)) return b;
    }
    return null;
  }

  function sourceVBoxAtPoint(pt, tol = 3) {
    for (let i = state.sourceCutsV.length - 1; i >= 0; i--) {
      const cut = state.sourceCutsV[i];
      if (Math.abs(pt.x - Number(cut.x)) <= tol) return cut;
    }
    return null;
  }

  function sourceHandleAtPoint(box, pt) {
    if (!box) return null;
    const pad = 4;
    const left = box.x;
    const right = boxRight(box);
    const top = box.y;
    const bottom = boxBottom(box);
    const nearL = Math.abs(pt.x - left) <= pad;
    const nearR = Math.abs(pt.x - right) <= pad;
    const nearT = Math.abs(pt.y - top) <= pad;
    const nearB = Math.abs(pt.y - bottom) <= pad;
    if (nearL && nearT) return "nw";
    if (nearR && nearT) return "ne";
    if (nearL && nearB) return "sw";
    if (nearR && nearB) return "se";
    if (nearT && pt.x >= left && pt.x <= right) return "n";
    if (nearB && pt.x >= left && pt.x <= right) return "s";
    if (nearL && pt.y >= top && pt.y <= bottom) return "w";
    if (nearR && pt.y >= top && pt.y <= bottom) return "e";
    if (boxContainsPt(box, pt)) return "move";
    return null;
  }

  function setDraftBox(box) {
    state.drawCurrent = box ? clampBoxToCanvas(box) : null;
    if (state.drawCurrent) {
      state.anchorBox = { x: state.drawCurrent.x, y: state.drawCurrent.y, w: state.drawCurrent.w, h: state.drawCurrent.h };
    }
  }

  function sourceSelectionPrimaryBox() {
    if (state.sourceSelection.size !== 1) return null;
    const id = [...state.sourceSelection][0];
    return state.extractedBoxes.find((b) => Number(b.id) === Number(id)) || null;
  }

  function clearSourceSelection() {
    state.sourceSelection = new Set();
    state.sourceSelectedCut = null;
  }

  function setSourceMode(mode) {
    state.sourceMode = mode;
    state.drawMode = mode === "draw_box";
    state.drawing = false;
    state.drawStart = null;
    state.sourceDrag = null;
    state.sourceRowDrag = null;
    hideSourceContextMenu();
    updateSourceToolUI();
    renderSourceCanvas();
  }

  function updateSourceToolUI() {
    const mode = state.sourceMode;
    const map = [
      ["sourceSelectBtn", "select"],
      ["drawBoxBtn", "draw_box"],
      ["rowSelectBtn", "row_select"],
      ["colSelectBtn", "col_select"],
      ["cutVBtn", "cut_v"],
    ];
    for (const [id, key] of map) {
      const el = $(id);
      if (!el) continue;
      el.classList.toggle("tool-active", mode === key);
    }
    const hint = $("sourceModeHint");
    if (hint) {
      const txt =
        mode === "draw_box"
          ? "Mode: Draw Box. Drag to create a draft (blue) box. Right-click it to add as a sprite."
          : mode === "row_select"
          ? "Mode: Drag Row. Drag over orange sprites to select intersecting boxes."
          : mode === "col_select"
          ? "Mode: Drag Column. Drag over orange sprites to select intersecting boxes."
          : mode === "cut_v"
          ? "Mode: Vertical Cut. Click to insert a vertical cut, drag existing cut to move."
          : "Mode: Select. Click sprite box to select; drag to move; drag handles to resize.";
      hint.textContent = txt;
    }
    const rapid = $("rapidManualAdd");
    if (rapid) rapid.checked = !!state.rapidManualAdd;
  }

  function hideSourceContextMenu() {
    const menu = $("sourceContextMenu");
    if (menu) menu.classList.add("hidden");
    state.sourceContextTarget = null;
  }

  function showSourceContextMenu(clientX, clientY, target) {
    const menu = $("sourceContextMenu");
    if (!menu) return;
    state.sourceContextTarget = target;
    const isDraft = target?.type === "draft";
    const rowReady = state.selectedRow !== null;
    $("srcCtxAddSprite").disabled = !isDraft;
    $("srcCtxAddToRow").disabled = !isDraft || !rowReady;
    $("srcCtxPadAnchor").disabled = !target;
    $("srcCtxSetAnchor").disabled = !target;
    $("srcCtxDelete").disabled = !target;
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    menu.classList.remove("hidden");
  }

  function setAnchorFromTarget(target) {
    if (!target) return;
    if (target.type === "draft" && state.drawCurrent) {
      state.anchorBox = { ...state.drawCurrent };
      status(`Anchor set ${state.anchorBox.w}x${state.anchorBox.h} from draft`, "ok");
    } else if (target.type === "box") {
      const box = state.extractedBoxes.find((b) => Number(b.id) === Number(target.id));
      if (!box) return;
      state.anchorBox = { x: box.x, y: box.y, w: box.w, h: box.h };
      status(`Anchor set ${box.w}x${box.h} from sprite`, "ok");
    }
  }

  function padRectToAnchor(box) {
    if (!box || !state.anchorBox) return box ? { ...box } : null;
    const aw = Math.max(1, Number(state.anchorBox.w || 1));
    const ah = Math.max(1, Number(state.anchorBox.h || 1));
    const cx = box.x + (box.w / 2);
    const cy = box.y + (box.h / 2);
    const padded = clampBoxToCanvas({
      x: Math.round(cx - (aw / 2)),
      y: Math.round(cy - (ah / 2)),
      w: aw,
      h: ah,
    });
    return padded;
  }

  function applyPadToContextTarget() {
    const t = state.sourceContextTarget;
    if (!t || !state.anchorBox) return;
    if (t.type === "draft" && state.drawCurrent) {
      pushHistory();
      setDraftBox(padRectToAnchor(state.drawCurrent));
      renderSourceCanvas();
      saveSessionState("pad-draft-anchor");
      return;
    }
    if (t.type === "box") {
      const idx = state.extractedBoxes.findIndex((b) => Number(b.id) === Number(t.id));
      if (idx < 0) return;
      const next = padRectToAnchor(state.extractedBoxes[idx]);
      if (committedBoxesOverlap(next, state.extractedBoxes[idx].id)) {
        status("Padding blocked: overlap with another sprite box", "warn");
        return;
      }
      pushHistory();
      state.extractedBoxes[idx] = { ...state.extractedBoxes[idx], ...next };
      renderSourceCanvas();
      saveSessionState("pad-box-anchor");
    }
  }

  function deleteSourceTarget(target) {
    if (!target) return;
    pushHistory();
    if (target.type === "draft") {
      state.drawCurrent = null;
      if (state.anchorBox && target.useDraftAnchor) state.anchorBox = null;
      renderSourceCanvas();
      saveSessionState("delete-draft");
      return;
    }
    if (target.type === "box") {
      state.extractedBoxes = state.extractedBoxes.filter((b) => Number(b.id) !== Number(target.id));
      state.sourceSelection.delete(Number(target.id));
      renderSourceCanvas();
      saveSessionState("delete-source-box");
      return;
    }
    if (target.type === "cut_v") {
      state.sourceCutsV = state.sourceCutsV.filter((c) => Number(c.id) !== Number(target.id));
      if (state.sourceSelectedCut && state.sourceSelectedCut.type === "v" && Number(state.sourceSelectedCut.id) === Number(target.id)) {
        state.sourceSelectedCut = null;
      }
      renderSourceCanvas();
      saveSessionState("delete-cut");
    }
  }

  function commitDraftToSource(kind = "manual", opts = {}) {
    if (!state.drawCurrent) {
      status("No draft box to add", "warn");
      return null;
    }
    const box = clampBoxToCanvas(state.drawCurrent);
    if (committedBoxesOverlap(box, null)) {
      status("Cannot add sprite box: overlaps existing sprite box", "warn");
      return null;
    }
    if (!opts.skipHistory) pushHistory();
    const committed = { id: nextSourceId(), x: box.x, y: box.y, w: box.w, h: box.h, source: kind };
    state.extractedBoxes = [...state.extractedBoxes, committed];
    state.sourceSelection = new Set([committed.id]);
    if (!state.rapidManualAdd) {
      state.drawCurrent = null;
    }
    renderSourceCanvas();
    saveSessionState("add-source-box");
    return committed;
  }

  function applySourceBoxSelectionRect(mode, rect, modifiers) {
    const hits = state.extractedBoxes.filter((b) => boxesIntersect(b, rect)).map((b) => Number(b.id));
    let next = new Set(state.sourceSelection);
    if (modifiers.subtract) {
      for (const id of hits) next.delete(id);
    } else if (modifiers.add) {
      for (const id of hits) next.add(id);
    } else if (modifiers.toggle) {
      for (const id of hits) (next.has(id) ? next.delete(id) : next.add(id));
    } else {
      next = new Set(hits);
    }
    state.sourceSelection = next;
    state.sourceSelectedCut = null;
    const noun = mode === "col_select" ? "column" : "row";
    status(`${noun} select: ${hits.length} hit (${state.sourceSelection.size} selected)`, hits.length ? "ok" : "warn");
  }

  function resizeBoxFromHandle(box, handle, anchorPt, pt) {
    let x0 = box.x;
    let y0 = box.y;
    let x1 = boxRight(box);
    let y1 = boxBottom(box);
    if (handle.includes("w")) x0 = pt.x;
    if (handle.includes("e")) x1 = pt.x;
    if (handle.includes("n")) y0 = pt.y;
    if (handle.includes("s")) y1 = pt.y;
    if (handle === "move") {
      const dx = pt.x - anchorPt.x;
      const dy = pt.y - anchorPt.y;
      x0 = box.x + dx;
      y0 = box.y + dy;
      x1 = boxRight(box) + dx;
      y1 = boxBottom(box) + dy;
    }
    const out = {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0) + 1,
      h: Math.abs(y1 - y0) + 1,
    };
    return clampBoxToCanvas(out);
  }

  function onSourceMouseDown(e) {
    if (!state.sourceImage) return;
    if (e.button !== 0) return;
    hideSourceContextMenu();
    const canvas = $("sourceCanvas");
    const pt = canvasCoord(e, canvas);
    const mode = state.sourceMode;
    if ((mode === "row_select" || mode === "col_select") && state.sourceSelection.size > 0) {
      const hit = sourceBoxAtPoint(pt);
      if (hit && state.sourceSelection.has(Number(hit.id))) {
        state.sourceDrag = {
          type: "drag_source_selection_to_grid",
          startClientX: e.clientX,
          startClientY: e.clientY,
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          moved: false,
        };
        state.sourceDragHoverFrame = null;
        status("Drag selected source sprites to a grid frame cell", "ok");
        return;
      }
    }
    if (mode === "draw_box") {
      pushHistory();
      if (state.rapidManualAdd && state.drawCurrent) {
        commitDraftToSource("manual");
      }
      state.drawing = true;
      state.drawStart = pt;
      state.sourceDrag = { type: "draw", start: pt };
      setDraftBox({ x: pt.x, y: pt.y, w: 1, h: 1 });
      renderSourceCanvas();
      return;
    }
    if (mode === "row_select" || mode === "col_select") {
      state.sourceDrag = { type: mode, start: pt, modifiers: { add: e.shiftKey, subtract: e.altKey, toggle: e.ctrlKey || e.metaKey } };
      state.sourceRowDrag = { mode, rect: { x: pt.x, y: pt.y, w: 1, h: 1 } };
      renderSourceCanvas();
      return;
    }
    if (mode === "cut_v") {
      const cut = sourceVBoxAtPoint(pt);
      pushHistory();
      if (cut) {
        state.sourceSelectedCut = { type: "v", id: cut.id };
        state.sourceDrag = { type: "move_cut_v", id: cut.id };
      } else {
        const existingX = state.sourceCutsV.find((c) => Number(c.x) === Number(pt.x));
        if (!existingX) {
          const newCut = { id: nextSourceId(), x: pt.x };
          state.sourceCutsV = [...state.sourceCutsV, newCut].sort((a, b) => a.x - b.x);
          state.sourceSelectedCut = { type: "v", id: newCut.id };
          saveSessionState("insert-cut-v");
        }
        const selected = sourceVBoxAtPoint(pt, 0) || sourceVBoxAtPoint(pt, 3);
        if (selected) state.sourceDrag = { type: "move_cut_v", id: selected.id };
      }
      renderSourceCanvas();
      return;
    }
    const hit = sourceBoxAtPoint(pt);
    const draftHandle = state.drawCurrent ? sourceHandleAtPoint(state.drawCurrent, pt) : null;
    if (draftHandle && state.drawCurrent) {
      pushHistory();
      state.sourceSelection = new Set();
      state.sourceSelectedCut = null;
      state.sourceDrag = { type: "draft_edit", handle: draftHandle, anchor: pt, original: { ...state.drawCurrent } };
      renderSourceCanvas();
      return;
    }
    if (hit) {
      if (e.ctrlKey || e.metaKey) {
        const id = Number(hit.id);
        if (state.sourceSelection.has(id)) state.sourceSelection.delete(id);
        else state.sourceSelection.add(id);
      } else if (!state.sourceSelection.has(Number(hit.id)) || state.sourceSelection.size !== 1) {
        state.sourceSelection = new Set([Number(hit.id)]);
      }
      state.sourceSelectedCut = null;
      const primary = sourceSelectionPrimaryBox() || hit;
      const handle = sourceHandleAtPoint(primary, pt);
      pushHistory();
      state.sourceDrag = { type: "box_edit", boxId: Number(primary.id), handle: handle || "move", anchor: pt, original: { ...primary } };
      renderSourceCanvas();
      return;
    }
    const cutHit = sourceVBoxAtPoint(pt);
    if (cutHit) {
      state.sourceSelectedCut = { type: "v", id: cutHit.id };
      state.sourceSelection = new Set();
      state.sourceDrag = { type: "move_cut_v", id: Number(cutHit.id) };
      renderSourceCanvas();
      return;
    }
    clearSourceSelection();
    renderSourceCanvas();
  }

  function onSourceMouseMove(e) {
    if (!state.sourceImage) return;
    const pt = canvasCoord(e, $("sourceCanvas"));
    if (!state.sourceDrag) return;
    const d = state.sourceDrag;
    if (d.type === "draw" && d.start) {
      setDraftBox(normalizeBox(d.start, pt));
    } else if ((d.type === "row_select" || d.type === "col_select") && d.start) {
      state.sourceRowDrag = { mode: d.type, rect: normalizeBox(d.start, pt) };
    } else if (d.type === "draft_edit") {
      const next = resizeBoxFromHandle(d.original, d.handle, d.anchor, pt);
      setDraftBox(next);
    } else if (d.type === "box_edit") {
      const idx = state.extractedBoxes.findIndex((b) => Number(b.id) === Number(d.boxId));
      if (idx >= 0) {
        const next = resizeBoxFromHandle(d.original, d.handle, d.anchor, pt);
        if (!committedBoxesOverlap(next, d.boxId)) {
          state.extractedBoxes[idx] = { ...state.extractedBoxes[idx], ...next };
        }
      }
    } else if (d.type === "move_cut_v") {
      const idx = state.sourceCutsV.findIndex((c) => Number(c.id) === Number(d.id));
      if (idx >= 0) {
        const { w } = sourceCanvasSize();
        state.sourceCutsV[idx] = { ...state.sourceCutsV[idx], x: Math.max(0, Math.min(w - 1, pt.x)) };
        state.sourceCutsV.sort((a, b) => a.x - b.x);
      }
    } else if (d.type === "drag_source_selection_to_grid") {
      d.lastClientX = e.clientX;
      d.lastClientY = e.clientY;
      if (Math.abs(e.clientX - d.startClientX) > 3 || Math.abs(e.clientY - d.startClientY) > 3) d.moved = true;
      state.sourceDragHoverFrame = gridFrameFromClientPoint(e.clientX, e.clientY);
      if (state.sourceDragHoverFrame) {
        status(
          `Drop target: Angle ${state.sourceDragHoverFrame.row} (${angleNameForIndex(state.sourceDragHoverFrame.row)}), Frame ${frameColInfo(state.sourceDragHoverFrame.col).frame}`,
          "ok"
        );
      }
    }
    renderSourceCanvas();
  }

  function onSourceMouseUp(e) {
    if (!state.sourceDrag) return;
    const d = state.sourceDrag;
    const pt = canvasCoord(e, $("sourceCanvas"));
    if (d.type === "draw" && d.start) {
      setDraftBox(normalizeBox(d.start, pt));
      if (state.rapidManualAdd && state.drawCurrent) {
        commitDraftToSource("manual", { skipHistory: false });
      } else {
        status(`Draft box ${state.drawCurrent?.w || 0}x${state.drawCurrent?.h || 0}`, "ok");
      }
    } else if (d.type === "draft_edit") {
      const next = resizeBoxFromHandle(d.original, d.handle, d.anchor, pt);
      setDraftBox(next);
    } else if (d.type === "box_edit") {
      const idx = state.extractedBoxes.findIndex((b) => Number(b.id) === Number(d.boxId));
      if (idx >= 0) {
        const next = resizeBoxFromHandle(d.original, d.handle, d.anchor, pt);
        if (!committedBoxesOverlap(next, d.boxId)) {
          state.extractedBoxes[idx] = { ...state.extractedBoxes[idx], ...next };
          saveSessionState("edit-source-box");
        } else {
          state.extractedBoxes[idx] = { ...state.extractedBoxes[idx], ...d.original };
          status("Move/resize blocked: overlap with another sprite box", "warn");
        }
      }
    } else if (d.type === "row_select" || d.type === "col_select") {
      const rect = normalizeBox(d.start, pt);
      state.sourceRowDrag = { mode: d.type, rect };
      applySourceBoxSelectionRect(d.type, rect, d.modifiers || {});
      saveSessionState(d.type);
    } else if (d.type === "move_cut_v") {
      saveSessionState("move-cut-v");
    } else if (d.type === "drag_source_selection_to_grid") {
      const didDrop = d.moved ? dropSelectedSourceBoxesAtClientPoint(e.clientX, e.clientY) : false;
      if (!didDrop && !d.moved) {
        status(`${state.sourceSelection.size} source sprite box(es) selected`, state.sourceSelection.size ? "ok" : "warn");
      }
    }
    state.drawing = false;
    state.drawStart = null;
    state.sourceDrag = null;
    state.sourceDragHoverFrame = null;
    state.sourceRowDrag = null;
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
    pushHistory();
    const manual = state.extractedBoxes.filter((b) => String(b.source || "") === "manual");
    const merged = [...manual];
    for (const b of filtered) {
      const candidate = clampBoxToCanvas(b);
      if (!candidate) continue;
      if (merged.some((m) => boxesIntersect(m, candidate))) continue;
      merged.push({ id: nextSourceId(), x: candidate.x, y: candidate.y, w: candidate.w, h: candidate.h, source: "auto" });
    }
    state.extractedBoxes = merged;
    renderSourceCanvas();
    status(`Find Sprites: ${filtered.length} matched (${merged.length} total boxes)`, filtered.length > 0 ? "ok" : "warn");
  }

  function buildRawSourceCanvas() {
    if (!state.sourceImage) return null;
    const c = document.createElement("canvas");
    c.width = state.sourceImage.width;
    c.height = state.sourceImage.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(state.sourceImage, 0, 0);
    return c;
  }

  function estimateBgRgbFromImageData(data, w, h) {
    const samples = [
      [0, 0],
      [Math.max(0, w - 1), 0],
      [0, Math.max(0, h - 1)],
      [Math.max(0, w - 1), Math.max(0, h - 1)],
    ];
    let r = 0, g = 0, b = 0;
    for (const [x, y] of samples) {
      const i = (y * w + x) * 4;
      r += data[i + 0];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [Math.round(r / samples.length), Math.round(g / samples.length), Math.round(b / samples.length)];
  }

  function sourceCellFromPatch(rgbaData, imgW, imgH, patchBox, bgRgb, threshold) {
    const px0 = Math.max(0, Math.min(imgW - 1, patchBox.x));
    const py0 = Math.max(0, Math.min(imgH - 1, patchBox.y));
    const px1 = Math.max(px0 + 1, Math.min(imgW, patchBox.x + patchBox.w));
    const py1 = Math.max(py0 + 1, Math.min(imgH, patchBox.y + patchBox.h));
    const split = Math.max(py0 + 1, Math.floor((py0 + py1) / 2));
    const regionStats = (yStart, yEnd) => {
      let sig = 0;
      let total = 0;
      let rs = 0, gs = 0, bs = 0;
      for (let y = yStart; y < yEnd; y++) {
        for (let x = px0; x < px1; x++) {
          const i = (y * imgW + x) * 4;
          total += 1;
          const a = rgbaData[i + 3];
          if (a < 16) continue;
          const dr = Math.abs(rgbaData[i + 0] - bgRgb[0]);
          const dg = Math.abs(rgbaData[i + 1] - bgRgb[1]);
          const db = Math.abs(rgbaData[i + 2] - bgRgb[2]);
          if (dr + dg + db <= threshold) continue;
          sig += 1;
          rs += rgbaData[i + 0];
          gs += rgbaData[i + 1];
          bs += rgbaData[i + 2];
        }
      }
      if (sig <= 0 || total <= 0) return null;
      const occ = sig / total;
      if (occ < 0.04) return null;
      return {
        occ,
        rgb: [
          Math.max(28, Math.min(220, Math.round(rs / sig))),
          Math.max(28, Math.min(220, Math.round(gs / sig))),
          Math.max(28, Math.min(220, Math.round(bs / sig))),
        ],
      };
    };
    const top = regionStats(py0, Math.max(py0 + 1, split));
    const bot = regionStats(Math.max(py0 + 1, split), py1);
    if (!top && !bot) return { glyph: 0, fg: [0, 0, 0], bg: [...MAGENTA] };
    if (top && !bot) return { glyph: 223, fg: top.rgb, bg: [...MAGENTA] };
    if (!top && bot) return { glyph: 220, fg: bot.rgb, bg: [...MAGENTA] };
    const diff = Math.abs(top.rgb[0] - bot.rgb[0]) + Math.abs(top.rgb[1] - bot.rgb[1]) + Math.abs(top.rgb[2] - bot.rgb[2]);
    if (diff < 20) {
      return {
        glyph: 219,
        fg: [
          Math.round((top.rgb[0] + bot.rgb[0]) / 2),
          Math.round((top.rgb[1] + bot.rgb[1]) / 2),
          Math.round((top.rgb[2] + bot.rgb[2]) / 2),
        ],
        bg: [0, 0, 0],
      };
    }
    return { glyph: 223, fg: top.rgb, bg: bot.rgb };
  }

  function frameCellsFromSourceBox(box) {
    const raw = buildRawSourceCanvas();
    if (!raw) return null;
    const ctx = raw.getContext("2d");
    const img = ctx.getImageData(0, 0, raw.width, raw.height);
    const data = img.data;
    const bg = estimateBgRgbFromImageData(data, raw.width, raw.height);
    const threshold = Math.max(0, Math.min(255, Number($("threshold").value || 48)));
    const out = [];
    const fw = Math.max(1, state.frameWChars);
    const fh = Math.max(1, state.frameHChars);
    for (let cy = 0; cy < fh; cy++) {
      const row = [];
      for (let cx = 0; cx < fw; cx++) {
        const x0 = box.x + Math.floor((cx * box.w) / fw);
        const x1 = box.x + Math.floor(((cx + 1) * box.w) / fw);
        const y0 = box.y + Math.floor((cy * box.h) / fh);
        const y1 = box.y + Math.floor(((cy + 1) * box.h) / fh);
        row.push(
          sourceCellFromPatch(
            data,
            raw.width,
            raw.height,
            { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) },
            bg,
            threshold
          )
        );
      }
      out.push(row);
    }
    return out;
  }

  function frameIsEmpty(row, col) {
    for (let y = 0; y < state.frameHChars; y++) {
      for (let x = 0; x < state.frameWChars; x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        const c = cellAt(gx, gy);
        if (Number(c.glyph || 0) > 32) return false;
      }
    }
    return true;
  }

  function selectedFrameColsSorted() {
    return [...state.selectedCols].map((c) => Number(c)).sort((a, b) => a - b);
  }

  function frameVisualBounds(row, col) {
    let minX = null;
    let minY = null;
    let maxX = null;
    let maxY = null;
    for (let y = 0; y < state.frameHChars; y++) {
      for (let x = 0; x < state.frameWChars; x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        const c = cellAt(gx, gy);
        if (Number(c.glyph || 0) <= 32) continue;
        minX = minX === null ? x : Math.min(minX, x);
        minY = minY === null ? y : Math.min(minY, y);
        maxX = maxX === null ? x : Math.max(maxX, x);
        maxY = maxY === null ? y : Math.max(maxY, y);
      }
    }
    if (minX === null) return null;
    return { minX, minY, maxX, maxY, w: (maxX - minX + 1), h: (maxY - minY + 1) };
  }

  function frameBoundsForCols(row, cols) {
    return cols
      .map((col) => ({ row, col, bounds: frameVisualBounds(row, col) }))
      .filter((x) => !!x.bounds);
  }

  function medianInt(values) {
    const vals = (values || []).filter((v) => Number.isFinite(Number(v))).map((v) => Number(v)).sort((a, b) => a - b);
    if (!vals.length) return 0;
    const mid = Math.floor(vals.length / 2);
    if (vals.length % 2 === 1) return vals[mid];
    return Math.round((vals[mid - 1] + vals[mid]) / 2);
  }

  function computeAlignTarget(boundsEntries, refMode) {
    if (!boundsEntries.length) return null;
    if (refMode === "first_selected") {
      const b = boundsEntries[0].bounds;
      return {
        left: b.minX,
        top: b.minY,
        right: b.maxX,
        bottom: b.maxY,
        center2: b.minX + b.maxX,
        middle2: b.minY + b.maxY,
      };
    }
    const bs = boundsEntries.map((e) => e.bounds);
    return {
      left: medianInt(bs.map((b) => b.minX)),
      top: medianInt(bs.map((b) => b.minY)),
      right: medianInt(bs.map((b) => b.maxX)),
      bottom: medianInt(bs.map((b) => b.maxY)),
      center2: medianInt(bs.map((b) => b.minX + b.maxX)),
      middle2: medianInt(bs.map((b) => b.minY + b.maxY)),
    };
  }

  function computeAlignShift(bounds, target, mode) {
    if (!bounds || !target) return { dx: 0, dy: 0 };
    const center2 = bounds.minX + bounds.maxX;
    const middle2 = bounds.minY + bounds.maxY;
    if (mode === "bottom_left") {
      return { dx: target.left - bounds.minX, dy: target.bottom - bounds.maxY };
    }
    if (mode === "top_left") {
      return { dx: target.left - bounds.minX, dy: target.top - bounds.minY };
    }
    if (mode === "center") {
      return {
        dx: Math.round((target.center2 - center2) / 2),
        dy: Math.round((target.middle2 - middle2) / 2),
      };
    }
    return {
      dx: Math.round((target.center2 - center2) / 2),
      dy: target.bottom - bounds.maxY,
    };
  }

  function shiftFrameContents(row, col, dx, dy) {
    dx = Math.round(Number(dx || 0));
    dy = Math.round(Number(dy || 0));
    if (!dx && !dy) return { moved: false, clippedCells: 0 };
    const src = [];
    for (let y = 0; y < state.frameHChars; y++) {
      const line = [];
      for (let x = 0; x < state.frameWChars; x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        if (gx >= state.gridCols || gy >= state.gridRows) line.push(transparentCell(0));
        else line.push({ ...cellAt(gx, gy) });
      }
      src.push(line);
    }

    let clippedCells = 0;
    clearFrame(row, col);
    for (let y = 0; y < state.frameHChars; y++) {
      for (let x = 0; x < state.frameWChars; x++) {
        const c = src[y][x];
        if (Number(c.glyph || 0) <= 32) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.frameWChars || ny >= state.frameHChars) {
          clippedCells += 1;
          continue;
        }
        const gx = col * state.frameWChars + nx;
        const gy = row * state.frameHChars + ny;
        if (gx >= state.gridCols || gy >= state.gridRows) {
          clippedCells += 1;
          continue;
        }
        setCell(gx, gy, c);
      }
    }
    return { moved: true, clippedCells };
  }

  function nudgeSelectedFrames(dx, dy) {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return false;
    }
    if (state.selectedRow === null || state.selectedCols.size === 0) {
      status("Select one or more frames on a row first", "warn");
      return false;
    }
    const row = Number(state.selectedRow);
    const cols = selectedFrameColsSorted();
    pushHistory();
    let moved = 0;
    let clipped = 0;
    for (const col of cols) {
      const res = shiftFrameContents(row, col, dx, dy);
      if (res.moved) moved += 1;
      clipped += Number(res.clippedCells || 0);
    }
    renderAll();
    saveSessionState("nudge-frame-jitter");
    status(`Nudged ${moved} frame(s) by dx=${dx}, dy=${dy}${clipped ? ` (clipped ${clipped} cells)` : ""}`, clipped ? "warn" : "ok");
    return true;
  }

  function autoAlignFrameJitter(useEntireRow = false) {
    if (!editableLayerActive()) {
      status("Selected layer is read-only. Switch to Visual layer (2) to edit.", "warn");
      return false;
    }
    if (state.selectedRow === null) {
      status("Select a grid row/frame first", "warn");
      return false;
    }
    const row = Number(state.selectedRow);
    const cols = useEntireRow
      ? Array.from({ length: totalGridFrameCols() }, (_v, i) => i)
      : selectedFrameColsSorted();
    if (!cols.length) {
      status("Select one or more frames on a row first", "warn");
      return false;
    }
    const entries = frameBoundsForCols(row, cols);
    if (entries.length < 2) {
      status(entries.length === 1 ? "Only one non-empty frame in selection; no jitter alignment needed" : "No non-empty frames in selection", "warn");
      return false;
    }
    const alignMode = String($("jitterAlignMode")?.value || "bottom_center");
    const refMode = String($("jitterRefMode")?.value || "first_selected");
    const target = computeAlignTarget(entries, refMode);
    pushHistory();
    let shifted = 0;
    let clipped = 0;
    for (const entry of entries) {
      const { dx, dy } = computeAlignShift(entry.bounds, target, alignMode);
      if (!dx && !dy) continue;
      const res = shiftFrameContents(row, entry.col, dx, dy);
      if (res.moved) shifted += 1;
      clipped += Number(res.clippedCells || 0);
    }
    renderAll();
    saveSessionState(useEntireRow ? "auto-align-row-jitter" : "auto-align-selected-jitter");
    status(
      `Auto-aligned ${shifted} frame(s) on row ${row} (${alignMode}, ${refMode})${clipped ? `; clipped ${clipped} cells` : ""}`,
      clipped ? "warn" : "ok"
    );
    return true;
  }

  function renderJitterInfo() {
    const el = $("jitterInfo");
    if (!el) return;
    if (state.selectedRow === null || state.selectedCols.size === 0) {
      el.textContent = "Select one or more grid frames on a row to align/nudge jitter.";
      return;
    }
    const row = Number(state.selectedRow);
    const cols = selectedFrameColsSorted();
    const firstCol = cols[0];
    const firstBounds = frameVisualBounds(row, firstCol);
    const entries = frameBoundsForCols(row, cols);
    const nonEmpty = entries.length;
    const total = cols.length;
    if (!firstBounds) {
      el.textContent = `Row ${row} selected (${total} frame(s)); first selected frame is empty. Use W/A/S/D or Option+Arrow to nudge frame contents.`;
      return;
    }
    el.textContent = `Row ${row} (${angleNameForIndex(row)}) | selected=${total} non_empty=${nonEmpty} | first_bounds x=${firstBounds.minX}..${firstBounds.maxX} y=${firstBounds.minY}..${firstBounds.maxY} (${firstBounds.w}x${firstBounds.h}) | W/A/S/D or Option+Arrow nudges selected frames`;
  }

  function totalGridFrameCols() {
    return Math.max(1, state.anims.reduce((a, b) => a + b, 0) * Math.max(1, state.projs));
  }

  function writeSourceCellsToFrame(row, col, cells) {
    clearFrame(row, col);
    for (let y = 0; y < state.frameHChars; y++) {
      for (let x = 0; x < state.frameWChars; x++) {
        const gx = col * state.frameWChars + x;
        const gy = row * state.frameHChars + y;
        if (gx >= state.gridCols || gy >= state.gridRows) continue;
        setCell(gx, gy, cells[y][x]);
      }
    }
  }

  function groupSourceBoxesByRows(boxes) {
    const sorted = [...boxes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const groups = [];
    for (const box of sorted) {
      if (!groups.length) {
        groups.push({ minY: box.y, maxY: boxBottom(box), boxes: [box] });
        continue;
      }
      const g = groups[groups.length - 1];
      const tol = Math.max(4, Math.round(Math.min(box.h, (g.maxY - g.minY + 1)) * 0.35));
      if (box.y <= (g.maxY + tol)) {
        g.boxes.push(box);
        g.minY = Math.min(g.minY, box.y);
        g.maxY = Math.max(g.maxY, boxBottom(box));
      } else {
        groups.push({ minY: box.y, maxY: boxBottom(box), boxes: [box] });
      }
    }
    for (const g of groups) {
      g.boxes.sort((a, b) => (a.x - b.x) || (a.y - b.y));
    }
    return groups;
  }

  function nextAppendColForRow(row) {
    const totalCols = totalGridFrameCols();
    if (state.selectedRow === row && state.selectedCols.size > 0) {
      const next = Math.max(...state.selectedCols) + 1;
      if (next < totalCols) return next;
    }
    for (let c = 0; c < totalCols; c++) {
      if (frameIsEmpty(row, c)) return c;
    }
    return -1;
  }

  function insertSourceBoxesIntoGridAt(boxes, targetRow, startCol) {
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active to insert source sprites into grid", "warn");
      return false;
    }
    if (!state.sourceImage) {
      status("Source image is not loaded in the workbench", "err");
      return false;
    }
    const totalCols = totalGridFrameCols();
    if (targetRow < 0 || targetRow >= state.angles || startCol < 0 || startCol >= totalCols) {
      status("Drop target is outside grid bounds", "warn");
      return false;
    }
    const rowGroups = groupSourceBoxesByRows(boxes);
    if (!rowGroups.length) {
      status("No source sprite boxes selected for drop", "warn");
      return false;
    }

    pushHistory();
    let inserted = 0;
    let rowsInserted = 0;
    let firstRow = null;
    let firstRowCols = [];
    for (let rOff = 0; rOff < rowGroups.length; rOff++) {
      const row = targetRow + rOff;
      if (row < 0 || row >= state.angles) break;
      const group = rowGroups[rOff];
      const usable = group.boxes.filter((_b, i) => (startCol + i) < totalCols);
      if (!usable.length) continue;
      rowsInserted += 1;
      const colsUsed = [];
      for (let i = 0; i < usable.length; i++) {
        const col = startCol + i;
        const cells = frameCellsFromSourceBox(usable[i]);
        if (!cells) continue;
        writeSourceCellsToFrame(row, col, cells);
        inserted += 1;
        colsUsed.push(col);
      }
      if (firstRow === null && colsUsed.length) {
        firstRow = row;
        firstRowCols = colsUsed;
      }
    }
    if (firstRow !== null && firstRowCols.length) {
      state.selectedRow = firstRow;
      state.selectedCols = new Set(firstRowCols);
    }
    renderAll();
    saveSessionState("drop-source-selection-to-grid");
    status(`Dropped ${inserted} source sprite box(es) into ${rowsInserted} grid row(s)`, inserted > 0 ? "ok" : "warn");
    return inserted > 0;
  }

  function gridFrameFromClientPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!(el instanceof Element)) return null;
    const frame = el.closest(".frame-cell");
    if (!frame) return null;
    const row = Number(frame.dataset.row);
    const col = Number(frame.dataset.col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return { row, col };
  }

  function dropSelectedSourceBoxesAtClientPoint(clientX, clientY) {
    const ids = new Set([...state.sourceSelection].map((x) => Number(x)));
    const boxes = state.extractedBoxes.filter((b) => ids.has(Number(b.id)));
    if (!boxes.length) return false;
    const tgt = gridFrameFromClientPoint(clientX, clientY);
    if (!tgt) {
      status("Drop selected source sprites onto a grid frame cell", "warn");
      return false;
    }
    return insertSourceBoxesIntoGridAt(boxes, tgt.row, tgt.col);
  }

  function addSourceBoxToSelectedRowSequence(box) {
    if (!editableLayerActive()) {
      status("Visual layer (2) must be active to insert source sprite into grid", "warn");
      return false;
    }
    if (state.selectedRow === null) {
      status("Select a target grid row first, then use Add to selected row sequence", "warn");
      return false;
    }
    if (!state.sourceImage) {
      status("Source image is not loaded in the workbench", "err");
      return false;
    }
    const col = nextAppendColForRow(state.selectedRow);
    if (col < 0) {
      status("No free frame slot found on selected row", "warn");
      return false;
    }
    const cells = frameCellsFromSourceBox(box);
    if (!cells) {
      status("Failed to rasterize source box", "err");
      return false;
    }
    pushHistory();
    writeSourceCellsToFrame(state.selectedRow, col, cells);
    state.selectedCols = new Set([col]);
    renderAll();
    saveSessionState("source-box-to-row-seq");
    status(`Inserted source sprite into row ${state.selectedRow}, col ${col}`, "ok");
    return true;
  }

  function deleteSelectedSourceObjectsOrDraft() {
    if (state.sourceSelection.size > 0 || state.sourceSelectedCut || state.drawCurrent) {
      pushHistory();
      if (state.sourceSelection.size > 0) {
        const ids = new Set([...state.sourceSelection].map((x) => Number(x)));
        state.extractedBoxes = state.extractedBoxes.filter((b) => !ids.has(Number(b.id)));
        clearSourceSelection();
        renderSourceCanvas();
        saveSessionState("delete-source-selection");
        status("Deleted selected source sprite box(es)", "ok");
        return true;
      }
      if (state.sourceSelectedCut?.type === "v") {
        const id = Number(state.sourceSelectedCut.id);
        state.sourceCutsV = state.sourceCutsV.filter((c) => Number(c.id) !== id);
        state.sourceSelectedCut = null;
        renderSourceCanvas();
        saveSessionState("delete-source-cut");
        status("Deleted vertical cut", "ok");
        return true;
      }
      if (state.drawCurrent) {
        state.drawCurrent = null;
        renderSourceCanvas();
        saveSessionState("delete-source-draft");
        status("Deleted draft box", "ok");
        return true;
      }
    }
    return false;
  }

  function nudgeSelectedSourceBox(dx, dy) {
    if (state.sourceSelection.size !== 1) return false;
    const box = sourceSelectionPrimaryBox();
    if (!box) return false;
    const next = clampBoxToCanvas({ x: box.x + dx, y: box.y + dy, w: box.w, h: box.h });
    if (committedBoxesOverlap(next, box.id)) {
      status("Nudge blocked: overlap with another sprite box", "warn");
      return true;
    }
    pushHistory();
    state.extractedBoxes = state.extractedBoxes.map((b) => (Number(b.id) === Number(box.id) ? { ...b, ...next } : b));
    renderSourceCanvas();
    saveSessionState("nudge-source-box");
    return true;
  }

  function nudgeDraftBox(dx, dy) {
    if (!state.drawCurrent) return false;
    pushHistory();
    setDraftBox({ x: state.drawCurrent.x + dx, y: state.drawCurrent.y + dy, w: state.drawCurrent.w, h: state.drawCurrent.h });
    renderSourceCanvas();
    saveSessionState("nudge-draft-box");
    return true;
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
    renderJitterInfo();
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
    document.addEventListener("click", () => {
      $("gridContextMenu").classList.add("hidden");
      hideSourceContextMenu();
    });
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
    moveWebbuildDockToBottom();
    movePanelsToBottom();
    renderInspectorPaletteSwatches();
    updateSessionDirtyBadge();
    $("btnLoad").addEventListener("click", loadFromJob);
    $("btnExport").addEventListener("click", exportXp);
    $("openXpToolBtn").addEventListener("click", openInXpTool);
    $("webbuildOpenBtn").addEventListener("click", openWebbuild);
    $("webbuildReloadBtn").addEventListener("click", reloadWebbuild);
    $("webbuildApplySkinBtn").addEventListener("click", applyCurrentXpAsWebSkin);
    $("webbuildApplyInPlaceBtn").addEventListener("click", () => applyCurrentXpAsWebSkin({ restart_if_overlay_hidden: false }));
    $("webbuildApplyRestartBtn").addEventListener("click", () => applyCurrentXpAsWebSkin({ force_restart: true, restart_if_overlay_hidden: true }));
    $("webbuildQuickTestBtn").addEventListener("click", testCurrentSkinInDock);
    $("webbuildUploadTestBtn").addEventListener("click", onWebbuildUploadTestClick);
    $("webbuildUploadTestInput").addEventListener("change", onWebbuildUploadTestInputChange);
    $("webbuildFrame").addEventListener("load", () => {
      state.webbuild.loaded = true;
      state.webbuild.ready = false;
      updateWebbuildUI();
      setWebbuildState("Webbuild frame loaded, waiting for runtime...", "warn");
      stopWebbuildReadyPoll();
      state.webbuild.readyPoll = setInterval(detectWebbuildReady, 500);
    });
    $("termppSkinCmdBtn").addEventListener("click", termppSkinCommandPreview);
    $("termppSkinLaunchBtn").addEventListener("click", launchTermppSkin);
    $("termppStreamPreviewBtn").addEventListener("click", previewTermppEmbedStream);
    $("termppStreamStartBtn").addEventListener("click", startTermppEmbedStream);
    $("termppStreamStopBtn").addEventListener("click", stopTermppEmbedStream);
    $("termppBinary").addEventListener("change", () => {
      $("termppSkinOut").textContent = "";
    });
    ["termppStreamX", "termppStreamY", "termppStreamW", "termppStreamH", "termppStreamFps"].forEach((id) => {
      $(id).addEventListener("change", persistTermppStreamRegion);
    });
    $("verifyProfile").addEventListener("change", () => {
      const profile = String($("verifyProfile").value || "local_xp_sanity");
      if (profile === "legacy_verify_e2e" && !$("verifyCommandTemplate").value.trim()) {
        $("verifyCommandTemplate").value = defaultVerifyTemplate(profile);
      }
      updateVerifyUI();
    });
    $("verifyRunBtn").addEventListener("click", () => runWorkbenchVerification(false));
    $("verifyDryRunBtn").addEventListener("click", () => runWorkbenchVerification(true));
    $("verifyCommandTemplate").addEventListener("input", () => {
      try {
        localStorage.setItem(VERIFY_CMD_TEMPLATE_STORAGE_KEY, $("verifyCommandTemplate").value || "");
      } catch (_e) {}
    });
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
        state.anchorBox = null;
        state.drawCurrent = null;
        state.extractedBoxes = [];
        state.sourceCutsV = [];
        state.sourceCutsH = [];
        clearSourceSelection();
        state.sourceNextId = 1;
        renderSourceCanvas();
      };
      img.src = URL.createObjectURL(f);
    });

    $("sourceSelectBtn").addEventListener("click", () => setSourceMode("select"));
    $("drawBoxBtn").addEventListener("click", () => setSourceMode("draw_box"));
    $("rowSelectBtn").addEventListener("click", () => setSourceMode("row_select"));
    $("colSelectBtn").addEventListener("click", () => setSourceMode("col_select"));
    $("cutVBtn").addEventListener("click", () => setSourceMode("cut_v"));
    $("rapidManualAdd").addEventListener("change", () => {
      state.rapidManualAdd = !!$("rapidManualAdd").checked;
      updateSourceToolUI();
    });
    $("deleteBoxBtn").addEventListener("click", () => {
      if (!deleteSelectedSourceObjectsOrDraft()) {
        pushHistory();
        state.anchorBox = null;
        state.drawCurrent = null;
        state.extractedBoxes = [];
        state.sourceCutsV = [];
        clearSourceSelection();
        renderSourceCanvas();
        saveSessionState("clear-source-overlays");
        status("Cleared source boxes/cuts/anchor", "ok");
      }
    });
    $("extractBtn").addEventListener("click", () => {
      findSprites();
      saveSessionState("find-sprites");
    });
    $("sourceCanvas").addEventListener("contextmenu", (e) => {
      if (!state.sourceImage) return;
      e.preventDefault();
      const pt = canvasCoord(e, $("sourceCanvas"));
      if (state.drawCurrent && boxContainsPt(state.drawCurrent, pt)) {
        showSourceContextMenu(e.clientX, e.clientY, { type: "draft", useDraftAnchor: true });
        return;
      }
      const box = sourceBoxAtPoint(pt);
      if (box) {
        state.sourceSelection = new Set([Number(box.id)]);
        renderSourceCanvas();
        showSourceContextMenu(e.clientX, e.clientY, { type: "box", id: Number(box.id) });
        return;
      }
      const cut = sourceVBoxAtPoint(pt);
      if (cut) {
        state.sourceSelectedCut = { type: "v", id: Number(cut.id) };
        renderSourceCanvas();
        showSourceContextMenu(e.clientX, e.clientY, { type: "cut_v", id: Number(cut.id) });
      }
    });
    $("sourceCanvas").addEventListener("mousedown", onSourceMouseDown);
    $("sourceCanvas").addEventListener("mousemove", onSourceMouseMove);
    $("sourceCanvas").addEventListener("mouseup", onSourceMouseUp);
    window.addEventListener("mouseup", onSourceMouseUp);
    $("srcCtxAddSprite").addEventListener("click", () => {
      if (state.sourceContextTarget?.type === "draft") commitDraftToSource("manual");
      hideSourceContextMenu();
    });
    $("srcCtxAddToRow").addEventListener("click", () => {
      let box = null;
      if (state.sourceContextTarget?.type === "draft") {
        box = commitDraftToSource("manual") || null;
        if (!box && state.drawCurrent) box = { ...state.drawCurrent, id: -1 };
      } else if (state.sourceContextTarget?.type === "box") {
        box = state.extractedBoxes.find((b) => Number(b.id) === Number(state.sourceContextTarget.id)) || null;
      }
      if (box) addSourceBoxToSelectedRowSequence(box);
      hideSourceContextMenu();
    });
    $("srcCtxSetAnchor").addEventListener("click", () => {
      setAnchorFromTarget(state.sourceContextTarget);
      hideSourceContextMenu();
      renderSourceCanvas();
      saveSessionState("set-anchor");
    });
    $("srcCtxPadAnchor").addEventListener("click", () => {
      applyPadToContextTarget();
      hideSourceContextMenu();
    });
    $("srcCtxDelete").addEventListener("click", () => {
      deleteSourceTarget(state.sourceContextTarget);
      hideSourceContextMenu();
    });

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
    $("autoAlignSelectedBtn").addEventListener("click", () => autoAlignFrameJitter(false));
    $("autoAlignRowBtn").addEventListener("click", () => autoAlignFrameJitter(true));
    $("jitterLeftBtn").addEventListener("click", () => {
      const step = Math.max(1, Number($("jitterStep").value || 1));
      nudgeSelectedFrames(-step, 0);
    });
    $("jitterRightBtn").addEventListener("click", () => {
      const step = Math.max(1, Number($("jitterStep").value || 1));
      nudgeSelectedFrames(step, 0);
    });
    $("jitterUpBtn").addEventListener("click", () => {
      const step = Math.max(1, Number($("jitterStep").value || 1));
      nudgeSelectedFrames(0, -step);
    });
    $("jitterDownBtn").addEventListener("click", () => {
      const step = Math.max(1, Number($("jitterStep").value || 1));
      nudgeSelectedFrames(0, step);
    });

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
    $("inspectorPrevAngleBtn").addEventListener("click", () => moveInspectorSelection(-1, 0));
    $("inspectorNextAngleBtn").addEventListener("click", () => moveInspectorSelection(1, 0));
    $("inspectorPrevFrameBtn").addEventListener("click", () => moveInspectorSelection(0, -1));
    $("inspectorNextFrameBtn").addEventListener("click", () => moveInspectorSelection(0, 1));
    $("inspectorZoom").addEventListener("input", () => {
      state.inspectorZoom = Number($("inspectorZoom").value || 10);
      renderInspector();
    });
    $("inspectorToolInspectBtn").addEventListener("click", () => {
      state.inspectorTool = "inspect";
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorToolSelectBtn").addEventListener("click", () => {
      state.inspectorTool = "select";
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorToolGlyphBtn").addEventListener("click", () => {
      state.inspectorTool = "glyph";
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorToolPaintBtn").addEventListener("click", () => {
      state.inspectorTool = "paint";
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorToolEraseBtn").addEventListener("click", () => {
      state.inspectorTool = "erase";
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorToolDropperBtn").addEventListener("click", () => {
      state.inspectorTool = "dropper";
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorPaintColor").addEventListener("input", () => {
      state.inspectorPaintColor = hexToRgb($("inspectorPaintColor").value || "#ffffff");
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorGlyphCode").addEventListener("input", () => {
      state.inspectorGlyphCode = clampInspectorGlyphCode($("inspectorGlyphCode").value || 0);
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorGlyphChar").addEventListener("input", () => {
      const v = String($("inspectorGlyphChar").value || "");
      if (v) state.inspectorGlyphCode = clampInspectorGlyphCode(v.charCodeAt(0));
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorGlyphFgColor").addEventListener("input", () => {
      state.inspectorGlyphFgColor = hexToRgb($("inspectorGlyphFgColor").value || "#ffffff");
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorGlyphBgColor").addEventListener("input", () => {
      state.inspectorGlyphBgColor = hexToRgb($("inspectorGlyphBgColor").value || "#ff00ff");
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorCopyFrameBtn").addEventListener("click", copyInspectorFrame);
    $("inspectorPasteFrameBtn").addEventListener("click", pasteInspectorFrame);
    $("inspectorFlipHBtn").addEventListener("click", flipInspectorFrameHorizontal);
    $("inspectorClearFrameBtn").addEventListener("click", clearInspectorFrame);
    $("inspectorCopySelBtn").addEventListener("click", copyInspectorSelection);
    $("inspectorPasteSelBtn").addEventListener("click", pasteInspectorSelection);
    $("inspectorCutSelBtn").addEventListener("click", cutInspectorSelection);
    $("inspectorClearSelBtn").addEventListener("click", clearInspectorSelectionCells);
    $("inspectorSelectAllBtn").addEventListener("click", inspectorSelectAll);
    $("inspectorFillSelBtn").addEventListener("click", fillInspectorSelectionWithGlyph);
    $("inspectorReplaceFgBtn").addEventListener("click", () => replaceInspectorSelectionColor("fg"));
    $("inspectorReplaceBgBtn").addEventListener("click", () => replaceInspectorSelectionColor("bg"));
    $("inspectorRotateSelCwBtn").addEventListener("click", () => transformInspectorSelection("rot_cw"));
    $("inspectorRotateSelCcwBtn").addEventListener("click", () => transformInspectorSelection("rot_ccw"));
    $("inspectorFlipSelHBtn").addEventListener("click", () => transformInspectorSelection("flip_h"));
    $("inspectorFlipSelVBtn").addEventListener("click", () => transformInspectorSelection("flip_v"));
    $("inspectorBgTransparentBtn").addEventListener("click", () => {
      state.inspectorGlyphBgColor = [...MAGENTA];
      updateInspectorToolUI();
      renderInspector();
    });
    $("inspectorFindReplaceApplyBtn").addEventListener("click", applyInspectorFindReplace);
    $("inspectorFrScope").addEventListener("change", updateInspectorToolUI);
    $("inspectorShowGrid").addEventListener("change", () => {
      state.inspectorShowGrid = !!$("inspectorShowGrid").checked;
      renderInspector();
    });
    $("inspectorShowChecker").addEventListener("change", () => {
      state.inspectorShowChecker = !!$("inspectorShowChecker").checked;
      renderInspector();
    });
    $("cellInspectorCanvas").addEventListener("mousedown", (e) => {
      if (!state.inspectorOpen) return;
      if (state.inspectorTool === "select") {
        const hitCell = inspectorCellRectAtEvent(e);
        if (!hitCell) return;
        state.inspectorSelecting = true;
        state.inspectorSelectAnchor = { x: hitCell.cx, y: hitCell.cy };
        state.inspectorSelection = normalizeInspectorSelection({ x1: hitCell.cx, y1: hitCell.cy, x2: hitCell.cx, y2: hitCell.cy });
        renderInspector();
        return;
      }
      const hit = inspectorHalfCellAtEvent(e);
      if (!hit) return;
      setInspectorHoverFromHit(hit);
      if (state.inspectorTool === "paint" || state.inspectorTool === "erase" || state.inspectorTool === "glyph") {
        state.inspectorPainting = true;
        state.inspectorStrokeChanged = false;
        state.inspectorStrokeHadHistory = false;
        state.inspectorStrokeWasDirty = !!state.sessionDirty;
      }
      let changed = false;
      if (state.inspectorPainting && (state.inspectorTool === "paint" || state.inspectorTool === "erase" || state.inspectorTool === "glyph") && !state.inspectorStrokeHadHistory) {
        pushHistory();
        state.inspectorStrokeHadHistory = true;
      }
      if (state.inspectorTool === "glyph") {
        changed = applyInspectorGlyphAtCell(hit);
      } else {
        changed = applyInspectorToolAt(hit);
      }
      if (changed) state.inspectorStrokeChanged = true;
      if (changed) {
        renderAll();
      }
      if (state.inspectorTool === "dropper" || state.inspectorTool === "inspect") {
        state.inspectorPainting = false;
      }
    });
    $("cellInspectorCanvas").addEventListener("mousemove", (e) => {
      const hoverHit = inspectorHalfCellAtEvent(e);
      setInspectorHoverFromHit(hoverHit);
      if (state.inspectorSelecting) {
        const hitCell = inspectorCellRectAtEvent(e);
        if (!hitCell || !state.inspectorSelectAnchor) return;
        state.inspectorSelection = normalizeInspectorSelection({
          x1: state.inspectorSelectAnchor.x,
          y1: state.inspectorSelectAnchor.y,
          x2: hitCell.cx,
          y2: hitCell.cy,
        });
        renderInspector();
        return;
      }
      if (!state.inspectorPainting) return;
      if (state.inspectorTool !== "paint" && state.inspectorTool !== "erase" && state.inspectorTool !== "glyph") return;
      const hit = hoverHit;
      if (!hit) return;
      if (!state.inspectorStrokeHadHistory) {
        state.inspectorStrokeWasDirty = !!state.sessionDirty;
        pushHistory();
        state.inspectorStrokeHadHistory = true;
      }
      const changed = state.inspectorTool === "glyph" ? applyInspectorGlyphAtCell(hit) : applyInspectorToolAt(hit);
      if (changed) state.inspectorStrokeChanged = true;
      if (changed) renderAll();
    });
    $("cellInspectorCanvas").addEventListener("mouseleave", () => {
      setInspectorHoverFromHit(null);
    });
    window.addEventListener("mouseup", () => {
      if (state.inspectorPainting) commitInspectorStrokeIfNeeded();
      if (state.inspectorSelecting) {
        state.inspectorSelecting = false;
        state.inspectorSelectAnchor = null;
        renderInspector();
      }
    });

    window.addEventListener("keydown", (e) => {
      const t = e.target;
      const typingTarget =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement;
      if (typingTarget && !(e.ctrlKey || e.metaKey)) return;
      if (state.inspectorOpen && (e.ctrlKey || e.metaKey) && !e.altKey && !typingTarget) {
        const k = e.key.toLowerCase();
        if (k === "c") {
          if (!copyInspectorSelection()) copyInspectorFrame();
          e.preventDefault();
          return;
        }
        if (k === "x") {
          cutInspectorSelection();
          e.preventDefault();
          return;
        }
        if (k === "v") {
          if (!pasteInspectorSelection()) pasteInspectorFrame();
          e.preventDefault();
          return;
        }
        if (k === "a") {
          inspectorSelectAll();
          e.preventDefault();
          return;
        }
      }
      if (state.inspectorOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "p") {
          state.inspectorTool = "paint";
          updateInspectorToolUI();
          renderInspector();
          e.preventDefault();
          return;
        }
        if (k === "g") {
          state.inspectorTool = "glyph";
          updateInspectorToolUI();
          renderInspector();
          e.preventDefault();
          return;
        }
        if (k === "s") {
          state.inspectorTool = "select";
          updateInspectorToolUI();
          renderInspector();
          e.preventDefault();
          return;
        }
        if (k === "e") {
          state.inspectorTool = "erase";
          updateInspectorToolUI();
          renderInspector();
          e.preventDefault();
          return;
        }
        if (k === "i") {
          state.inspectorTool = "dropper";
          updateInspectorToolUI();
          renderInspector();
          e.preventDefault();
          return;
        }
        if (k === "q") {
          moveInspectorSelection(-1, 0);
          e.preventDefault();
          return;
        }
        if (k === "r") {
          moveInspectorSelection(1, 0);
          e.preventDefault();
          return;
        }
        if (k === "a") {
          moveInspectorSelection(0, -1);
          e.preventDefault();
          return;
        }
        if (k === "d") {
          moveInspectorSelection(0, 1);
          e.preventDefault();
          return;
        }
        if (k === "c") {
          if (!copyInspectorSelection()) copyInspectorFrame();
          e.preventDefault();
          return;
        }
        if (k === "x") {
          cutInspectorSelection();
          e.preventDefault();
          return;
        }
        if (k === "v") {
          if (!pasteInspectorSelection()) pasteInspectorFrame();
          e.preventDefault();
          return;
        }
        if (k === "f") {
          flipInspectorFrameHorizontal();
          e.preventDefault();
          return;
        }
        if (k === "]") {
          transformInspectorSelection("rot_cw");
          e.preventDefault();
          return;
        }
        if (k === "[") {
          transformInspectorSelection("rot_ccw");
          e.preventDefault();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (typingTarget) return;
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (typingTarget) return;
        e.preventDefault();
        redo();
      } else if (e.key === "Delete") {
        if (state.inspectorOpen) {
          if (!clearInspectorSelectionCells()) clearInspectorFrame();
          e.preventDefault();
        } else if (deleteSelectedSourceObjectsOrDraft()) {
          e.preventDefault();
        } else {
          deleteSelectedFrames();
        }
      } else if (e.key === "Escape") {
        hideSourceContextMenu();
        if (state.inspectorOpen) {
          if (state.inspectorSelection) {
            state.inspectorSelection = null;
            state.inspectorSelecting = false;
            state.inspectorSelectAnchor = null;
            renderInspector();
            e.preventDefault();
            return;
          }
          closeInspector();
        } else if (state.sourceDrag || state.sourceRowDrag) {
          state.sourceDrag = null;
          state.sourceRowDrag = null;
          state.drawing = false;
          state.drawStart = null;
          renderSourceCanvas();
        } else {
          state.selectedCols = new Set();
          state.selectedRow = null;
          clearSourceSelection();
          renderFrameGrid();
          renderSourceCanvas();
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "v") {
        setSourceMode("select");
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "b") {
        setSourceMode("draw_box");
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "r") {
        setSourceMode("row_select");
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "c") {
        setSourceMode("col_select");
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "x") {
        setSourceMode("cut_v");
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && ["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        const step = e.shiftKey ? 10 : Math.max(1, Number($("jitterStep")?.value || 1));
        const key = e.key.toLowerCase();
        const dx = key === "a" ? -step : key === "d" ? step : 0;
        const dy = key === "w" ? -step : key === "s" ? step : 0;
        if (dx !== 0 || dy !== 0) {
          if (nudgeSelectedFrames(dx, dy)) e.preventDefault();
        }
      } else if (e.key === "Enter") {
        if (state.drawCurrent) {
          e.preventDefault();
          commitDraftToSource("manual");
        }
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
          const step = e.shiftKey ? 10 : Math.max(1, Number($("jitterStep")?.value || 1));
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          if (dx !== 0 || dy !== 0) {
            if (nudgeSelectedFrames(dx, dy)) e.preventDefault();
            return;
          }
        }
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (dx !== 0 || dy !== 0) {
          if (nudgeSelectedSourceBox(dx, dy) || nudgeDraftBox(dx, dy)) {
            e.preventDefault();
          }
        }
      }
    });
    attachGridHandlers();
    updateUndoRedoButtons();
    try {
      const savedCmd = localStorage.getItem(VERIFY_CMD_TEMPLATE_STORAGE_KEY);
      if (savedCmd) $("verifyCommandTemplate").value = savedCmd;
    } catch (_e) {}
    loadPersistedTermppStreamRegion();
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
    updateSourceToolUI();
    updateVerifyUI();
    updateTermppSkinUI();
    updateWebbuildUI();
    window.addEventListener("beforeunload", () => stopTermppStreamPolling());
    window.addEventListener("beforeunload", () => stopWebbuildReadyPoll());
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
    openInspector: (row = 0, col = 0) => {
      openInspector(Number(row) || 0, Number(col) || 0);
      return {
        open: !!state.inspectorOpen,
        row: state.inspectorRow,
        col: state.inspectorCol,
      };
    },
    getInspectorState: () => ({
      open: !!state.inspectorOpen,
      row: Number(state.inspectorRow || 0),
      col: Number(state.inspectorCol || 0),
      tool: String(state.inspectorTool || "inspect"),
      selection: state.inspectorSelection ? { ...state.inspectorSelection } : null,
      hover: state.inspectorHover ? {
        cx: Number(state.inspectorHover.cx || 0),
        cy: Number(state.inspectorHover.cy || 0),
        half: String(state.inspectorHover.half || "top"),
      } : null,
      lastHoverAnchor: state.inspectorLastHoverAnchor ? {
        cx: Number(state.inspectorLastHoverAnchor.cx || 0),
        cy: Number(state.inspectorLastHoverAnchor.cy || 0),
      } : null,
      lastInspectCell: state.inspectorLastInspectCell ? {
        glyph: Number(state.inspectorLastInspectCell.glyph || 0),
        fg: [...(state.inspectorLastInspectCell.fg || [0, 0, 0])],
        bg: [...(state.inspectorLastInspectCell.bg || [0, 0, 0])],
      } : null,
      glyph: {
        code: clampInspectorGlyphCode(state.inspectorGlyphCode),
        fg: [...(state.inspectorGlyphFgColor || [255, 255, 255])],
        bg: [...(state.inspectorGlyphBgColor || MAGENTA)],
      },
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
