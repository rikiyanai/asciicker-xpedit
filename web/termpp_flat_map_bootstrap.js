(function () {
  "use strict";

  // Static flat-map override for the browser webbuild.
  // Replaces /a3d/game_map_y8.a3d in Emscripten FS before StartGame/Load.

  var TARGET_MAP_PATH = "/a3d/game_map_y8.a3d";
  var DEFAULT_FLAT_MAP = "minimal_2x2.a3d";
  var MAP_DIR = "flatmaps";

  var cachedMapBytes = null;
  var cachedMapName = null;
  var appliedStamp = 0;
  var wrapInstalled = false;

  function nowMs() { return Date.now ? Date.now() : +new Date(); }

  function qs(name) {
    try { return new URLSearchParams(window.location.search).get(name); }
    catch (_e) { return null; }
  }

  function selectedMapName() {
    var v = String(qs("flatmap") || DEFAULT_FLAT_MAP).trim();
    if (!/^[a-zA-Z0-9_.-]+\.a3d$/.test(v)) return DEFAULT_FLAT_MAP;
    return v;
  }

  function mapUrl() {
    return MAP_DIR + "/" + selectedMapName();
  }

  function log(msg) {
    try { console.log("[flat-map-bootstrap] " + msg); } catch (_e) {}
  }

  function setStatusText(msg) {
    try {
      if (window.Module && typeof window.Module.setStatus === "function") window.Module.setStatus(msg);
    } catch (_e) {}
  }

  async function fetchFlatMapBytes() {
    var name = selectedMapName();
    if (cachedMapBytes && cachedMapName === name) return cachedMapBytes;
    var url = mapUrl();
    log("fetching " + url);
    var r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("flat map fetch failed: " + r.status + " " + url);
    var ab = await r.arrayBuffer();
    cachedMapBytes = new Uint8Array(ab);
    cachedMapName = name;
    log("fetched " + cachedMapBytes.length + " bytes from " + url);
    return cachedMapBytes;
  }

  async function waitForFs(timeoutMs) {
    timeoutMs = Math.max(500, timeoutMs || 8000);
    var t0 = nowMs();
    while (nowMs() - t0 < timeoutMs) {
      var M = window.Module;
      if (M &&
          typeof M.FS_createDataFile === "function" &&
          typeof M.FS_unlink === "function" &&
          typeof M.FS_createPath === "function") {
        return M;
      }
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    throw new Error("webbuild FS not ready");
  }

  async function applyFlatMapOverride(force) {
    if (!force && appliedStamp) return { applied: false, reason: "already_applied", stamp: appliedStamp };
    setStatusText("Loading flat test arena...");
    var M = await waitForFs(15000);
    var bytes = await fetchFlatMapBytes();
    try { M.FS_createPath("/", "a3d", true, true); } catch (_e) {}
    try { M.FS_unlink(TARGET_MAP_PATH); } catch (_e) {}
    M.FS_createDataFile("/a3d", "game_map_y8.a3d", bytes, true, true, true);
    appliedStamp = nowMs();
    log("patched " + TARGET_MAP_PATH + " with " + cachedMapName + " (" + bytes.length + " bytes)");
    return { applied: true, target: TARGET_MAP_PATH, source: cachedMapName, bytes: bytes.length, stamp: appliedStamp };
  }

  function disablePlayUi(disabled, label) {
    try {
      var btn = document.getElementById("play-btn");
      if (btn) {
        btn.disabled = !!disabled;
        if (label) btn.textContent = String(label);
      }
    } catch (_e) {}
  }

  function installStartGameWrapper() {
    if (wrapInstalled) return true;
    if (typeof window.StartGame !== "function") return false;
    var original = window.StartGame;
    window.StartGame = async function () {
      try {
        disablePlayUi(true, "LOADING MAP...");
        var res = await applyFlatMapOverride(false);
        log("start wrapper apply result: " + JSON.stringify(res));
      } catch (e) {
        log("flat map apply failed before StartGame: " + e);
      } finally {
        disablePlayUi(false, "PLAY");
      }
      return original.apply(this, arguments);
    };
    wrapInstalled = true;
    log("StartGame wrapper installed");
    return true;
  }

  function installLoadWrapperWhenReady() {
    // Optional extra safety: if external callers invoke Load() directly, ensure map override
    // has a chance to apply first. Load() is assigned later by Emscripten cwrap.
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (typeof window.Load === "function" && !window.Load.__flatWrapped) {
        var originalLoad = window.Load;
        var wrapped = function () {
          var args = arguments;
          applyFlatMapOverride(false).catch(function (e) { log("pre-Load override failed: " + e); })
            .finally(function () { originalLoad.apply(window, args); });
        };
        wrapped.__flatWrapped = true;
        window.Load = wrapped;
        log("Load wrapper installed");
      }
      installStartGameWrapper();
      if (attempts > 400 || (wrapInstalled && window.Load && window.Load.__flatWrapped)) clearInterval(timer);
    }, 100);
  }

  function prefetchSoon() {
    // Best-effort prefetch so first Play click is fast.
    setTimeout(function () {
      fetchFlatMapBytes().catch(function (e) { log("prefetch failed: " + e); });
    }, 50);
  }

  window.__termppFlatMap = {
    apply: function (force) { return applyFlatMapOverride(!!force); },
    info: function () {
      return {
        target: TARGET_MAP_PATH,
        selected: selectedMapName(),
        url: mapUrl(),
        cached: !!cachedMapBytes,
        cached_bytes: cachedMapBytes ? cachedMapBytes.length : 0,
        applied_stamp: appliedStamp || 0,
      };
    }
  };

  installLoadWrapperWhenReady();
  prefetchSoon();
  log("bootstrap active (flatmap=" + selectedMapName() + ")");
})();
