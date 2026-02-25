(() => {
  "use strict";

  const DEFAULT_OVERRIDE_SETS = {
    player_common: [
      "player-nude.xp",
      "player-0000.xp",
      "player-0001.xp",
      "player-0010.xp",
      "player-0011.xp",
      "player-0100.xp",
      "player-0101.xp",
      "player-0110.xp",
      "player-0111.xp",
      "player-1000.xp",
      "player-1001.xp",
      "player-1010.xp",
      "player-1011.xp",
      "player-1100.xp",
      "player-1101.xp",
      "player-1110.xp",
      "player-1111.xp",
      "attack-0000.xp",
      "attack-0001.xp",
      "attack-0010.xp",
      "attack-0011.xp",
      "attack-0100.xp",
      "attack-0101.xp",
      "attack-0110.xp",
      "attack-0111.xp",
      "attack-1000.xp",
      "attack-1001.xp",
      "attack-1010.xp",
      "attack-1011.xp",
      "attack-1100.xp",
      "attack-1101.xp",
      "attack-1110.xp",
      "attack-1111.xp",
      "plydie-0000.xp",
      "plydie-0001.xp",
      "plydie-0010.xp",
      "plydie-0011.xp",
      "plydie-0100.xp",
      "plydie-0101.xp",
      "plydie-0110.xp",
      "plydie-0111.xp",
      "plydie-1000.xp",
      "plydie-1001.xp",
      "plydie-1010.xp",
      "plydie-1011.xp",
      "plydie-1100.xp",
      "plydie-1101.xp",
      "plydie-1110.xp",
      "plydie-1111.xp",
      "wolfie-0000.xp",
      "wolfie-0001.xp",
      "wolfie-0010.xp",
      "wolfie-0011.xp",
      "wolfie-0100.xp",
      "wolfie-0101.xp",
      "wolfie-0110.xp",
      "wolfie-0111.xp",
      "wolfie-1000.xp",
      "wolfie-1001.xp",
      "wolfie-1010.xp",
      "wolfie-1011.xp",
      "wolfie-1100.xp",
      "wolfie-1101.xp",
      "wolfie-1110.xp",
      "wolfie-1111.xp",
      "wolack-0000.xp",
      "wolack-0001.xp",
      "wolack-0010.xp",
      "wolack-0011.xp",
      "wolack-0100.xp",
      "wolack-0101.xp",
      "wolack-0110.xp",
      "wolack-0111.xp",
      "wolack-1000.xp",
      "wolack-1001.xp",
      "wolack-1010.xp",
      "wolack-1011.xp",
      "wolack-1100.xp",
      "wolack-1101.xp",
      "wolack-1110.xp",
      "wolack-1111.xp",
    ],
    single_player_nude: ["player-nude.xp"],
    all_visible_test: [
      "player-nude.xp",
      "player-0000.xp",
      "attack-0000.xp",
      "plydie-0000.xp",
      "wolfie-0000.xp",
      "wolack-0000.xp",
    ],
  };

  const state = {
    webbuildLoaded: false,
    webbuildReady: false,
    readyPoll: null,
    lastXpBytes: null,
    lastXpName: "",
  };

  const $ = (id) => document.getElementById(id);

  function setStatus(text, cls) {
    const el = $("statusLine");
    if (!el) return;
    el.className = `small ${cls || ""}`.trim();
    el.textContent = text;
  }

  function setWebbuildState(text, cls) {
    const el = $("webbuildState");
    if (!el) return;
    el.className = `small ${cls || ""}`.trim();
    el.textContent = text;
  }

  function out(obj) {
    const el = $("out");
    if (!el) return;
    if (typeof obj === "string") el.textContent = obj;
    else el.textContent = JSON.stringify(obj, null, 2);
  }

  function frameWin() {
    const f = $("gameFrame");
    return f && f.contentWindow ? f.contentWindow : null;
  }

  function selectedOverrideNames() {
    const mode = String($("overrideMode")?.value || "player_common");
    return [...(DEFAULT_OVERRIDE_SETS[mode] || DEFAULT_OVERRIDE_SETS.player_common)];
  }

  function renderOverrideNames() {
    const box = $("overrideNames");
    if (!box) return;
    box.innerHTML = "";
    for (const n of selectedOverrideNames()) {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = n;
      box.appendChild(span);
    }
  }

  function stopReadyPoll() {
    if (state.readyPoll) {
      clearInterval(state.readyPoll);
      state.readyPoll = null;
    }
  }

  function updateButtons() {
    const hasXp = !!(state.lastXpBytes && state.lastXpBytes.length);
    $("applyBtn").disabled = !(hasXp && state.webbuildReady);
    $("reapplyBtn").disabled = !(hasXp && state.webbuildReady);
    $("startBtn").disabled = !state.webbuildReady;
  }

  function detectWebbuildReady() {
    const win = frameWin();
    if (!win) return false;
    try {
      const ready = !!(
        win.Module &&
        win.Module.calledRun &&
        typeof win.Module.FS_createDataFile === "function" &&
        typeof win.Module.FS_unlink === "function" &&
        typeof win.Load === "function"
      );
      state.webbuildReady = ready;
      updateButtons();
      if (ready) {
        setWebbuildState("Webbuild ready", "ok");
        setStatus("Webbuild runtime is ready for XP injection", "ok");
        stopReadyPoll();
      } else {
        setWebbuildState("Webbuild loading...", "warn");
      }
      return ready;
    } catch (e) {
      state.webbuildReady = false;
      updateButtons();
      setWebbuildState(`Iframe access error: ${String(e)}`, "err");
      return false;
    }
  }

  function openWebbuild() {
    const f = $("gameFrame");
    if (!f) return;
    const src = String($("webbuildPath")?.value || "./termpp-web/index.html?solo=1&player=player").trim();
    state.webbuildLoaded = true;
    state.webbuildReady = false;
    updateButtons();
    setWebbuildState("Opening webbuild...", "warn");
    setStatus("Loading webbuild iframe...", "warn");
    stopReadyPoll();
    f.src = src;
    state.readyPoll = setInterval(detectWebbuildReady, 500);
    out({ action: "open_webbuild", src });
  }

  function reloadWebbuild() {
    const f = $("gameFrame");
    if (!f) return;
    state.webbuildReady = false;
    updateButtons();
    setWebbuildState("Reloading webbuild...", "warn");
    setStatus("Reloading webbuild iframe...", "warn");
    stopReadyPoll();
    try {
      if (f.contentWindow && f.contentWindow.location) f.contentWindow.location.reload();
      else openWebbuild();
    } catch (_e) {
      openWebbuild();
    }
    state.readyPoll = setInterval(detectWebbuildReady, 500);
  }

  function autoStartGameIfNeeded() {
    const win = frameWin();
    if (!win) throw new Error("iframe not available");
    const playerName = String($("playerName")?.value || "player").trim() || "player";
    try {
      const d = win.document;
      const overlay = d && d.getElementById ? d.getElementById("login-overlay") : null;
      const overlayVisible = !!(overlay && overlay.style && overlay.style.display !== "none");
      if (!overlayVisible) return { started: false, reason: "overlay_hidden" };
      const playerInput = d.getElementById("player-name");
      const serverInput = d.getElementById("server-addr");
      const playBtn = d.getElementById("play-btn");
      if (playerInput) playerInput.value = playerName;
      if (serverInput) serverInput.value = "";
      if (playBtn) playBtn.disabled = false;
      if (typeof win.StartGame !== "function") return { started: false, reason: "StartGame_missing" };
      win.StartGame();
      return { started: true };
    } catch (e) {
      return { started: false, reason: String(e) };
    }
  }

  function startGame() {
    if (!detectWebbuildReady()) {
      setStatus("Webbuild is not ready yet", "warn");
      return;
    }
    const res = autoStartGameIfNeeded();
    if (res.started) setStatus("Started webbuild game", "ok");
    else setStatus(`Start game skipped (${res.reason})`, "warn");
    out({ action: "start_game", result: res });
  }

  function ensureSpritesDir(M) {
    if (typeof M.FS_createPath === "function") {
      try { M.FS_createPath("/", "sprites", true, true); } catch (_e) {}
    }
  }

  async function injectXpBytes(xpBytes) {
    if (!xpBytes || !xpBytes.length) throw new Error("No XP bytes loaded");
    const win = frameWin();
    if (!win || !win.Module) throw new Error("Webbuild iframe not ready");
    const M = win.Module;
    if (win.__termppFlatMap && typeof win.__termppFlatMap.apply === "function") {
      try { await win.__termppFlatMap.apply(true); } catch (_e) {}
    }
    ensureSpritesDir(M);
    const names = selectedOverrideNames();
    for (const name of names) {
      try { M.FS_unlink(`/sprites/${name}`); } catch (_e) {}
      M.FS_createDataFile("/sprites", name, xpBytes, true, true, true);
    }
    const playerName = String($("playerName")?.value || "player").trim() || "player";
    if (typeof win.Load === "function") win.Load(playerName);
    if (typeof win.Resize === "function") {
      try { win.Resize(null); } catch (_e) {}
    }
    if ($("autoStartChk")?.checked) autoStartGameIfNeeded();
    try { win.ak_canvas?.focus?.(); } catch (_e) {}
    return { files_written: names.length, bytes: xpBytes.length, player_name: playerName, override_names: names };
  }

  async function applyLoadedXp() {
    if (!state.lastXpBytes || !state.lastXpBytes.length) {
      setStatus("Choose an .xp file first", "warn");
      return;
    }
    if (!detectWebbuildReady()) {
      setStatus("Open the webbuild and wait for 'Webbuild ready'", "warn");
      return;
    }
    try {
      const info = await injectXpBytes(state.lastXpBytes);
      setStatus(`Applied ${state.lastXpName || "XP"} to webbuild`, "ok");
      out({ action: "apply_xp", file: state.lastXpName, ...info });
    } catch (e) {
      setStatus(`XP apply failed: ${String(e)}`, "err");
      out({ action: "apply_xp", error: String(e) });
    }
  }

  function setLoadedXp(fileName, bytes) {
    state.lastXpName = String(fileName || "");
    state.lastXpBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    updateButtons();
    setStatus(`Loaded XP file: ${state.lastXpName || "(unnamed)"} (${state.lastXpBytes.length} bytes)`, "ok");
    out({ action: "load_xp", file: state.lastXpName, size_bytes: state.lastXpBytes.length });
  }

  async function loadFile(file) {
    if (!file) return;
    const ab = await file.arrayBuffer();
    setLoadedXp(file.name || "upload.xp", new Uint8Array(ab));
  }

  function attachDnD() {
    const zone = $("dropZone");
    if (!zone) return;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
      zone.addEventListener(ev, stop);
    });
    ["dragenter", "dragover"].forEach((ev) => {
      zone.addEventListener(ev, () => zone.classList.add("dragover"));
    });
    ["dragleave", "drop"].forEach((ev) => {
      zone.addEventListener(ev, () => zone.classList.remove("dragover"));
    });
    zone.addEventListener("drop", async (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        await loadFile(file);
      } catch (err) {
        setStatus(`Failed to load dropped file: ${String(err)}`, "err");
      }
    });
  }

  function runtimeInfo() {
    const win = frameWin();
    if (!win) {
      out({ error: "iframe not loaded" });
      return;
    }
    try {
      const info = {
        hasModule: !!win.Module,
        calledRun: !!win.Module?.calledRun,
        hasLoad: typeof win.Load === "function",
        hasResize: typeof win.Resize === "function",
        hasStartGame: typeof win.StartGame === "function",
        hasFSCreateDataFile: typeof win.Module?.FS_createDataFile === "function",
        hasFSUnlink: typeof win.Module?.FS_unlink === "function",
        currentSrc: $("gameFrame")?.src || "",
        playerName: $("playerName")?.value || "",
        overrideCount: selectedOverrideNames().length,
        lastXpName: state.lastXpName,
        lastXpBytes: state.lastXpBytes ? state.lastXpBytes.length : 0,
      };
      out(info);
      setStatus("Runtime info captured", "ok");
    } catch (e) {
      out({ error: String(e) });
      setStatus("Runtime info failed", "err");
    }
  }

  function init() {
    renderOverrideNames();
    attachDnD();
    updateButtons();
    out({ ready: true, note: "Open the webbuild, then upload an .xp and click Apply Uploaded XP." });

    $("overrideMode")?.addEventListener("change", () => {
      renderOverrideNames();
      updateButtons();
    });
    $("openBtn")?.addEventListener("click", openWebbuild);
    $("reloadBtn")?.addEventListener("click", reloadWebbuild);
    $("startBtn")?.addEventListener("click", startGame);
    $("applyBtn")?.addEventListener("click", applyLoadedXp);
    $("reapplyBtn")?.addEventListener("click", applyLoadedXp);
    $("downloadInfoBtn")?.addEventListener("click", runtimeInfo);
    $("xpFile")?.addEventListener("change", async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        await loadFile(file);
      } catch (err) {
        setStatus(`Failed to load file: ${String(err)}`, "err");
      }
    });

    // Helpful defaults for repeat local use.
    try {
      const savedPath = localStorage.getItem("termpp_skin_lab_webbuild_path");
      if (savedPath) $("webbuildPath").value = savedPath;
      const savedPlayer = localStorage.getItem("termpp_skin_lab_player_name");
      if (savedPlayer) $("playerName").value = savedPlayer;
    } catch (_e) {}
    $("webbuildPath")?.addEventListener("change", () => {
      try { localStorage.setItem("termpp_skin_lab_webbuild_path", $("webbuildPath").value); } catch (_e) {}
    });
    $("playerName")?.addEventListener("change", () => {
      try { localStorage.setItem("termpp_skin_lab_player_name", $("playerName").value); } catch (_e) {}
    });
  }

  window.addEventListener("beforeunload", stopReadyPoll);
  window.addEventListener("DOMContentLoaded", init);
})();
