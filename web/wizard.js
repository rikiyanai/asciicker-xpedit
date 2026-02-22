(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let sourcePath = null;
  let runResult = null;

  function setStatus(text, cls) {
    const el = $("runStatus");
    el.className = "small " + (cls || "");
    el.textContent = text;
  }

  $("btnUpload").addEventListener("click", async () => {
    const f = $("file").files[0];
    if (!f) {
      $("uploadOut").textContent = "Pick a .png first.";
      return;
    }
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    $("uploadOut").textContent = JSON.stringify(j, null, 2);
    if (!r.ok) return;
    sourcePath = j.source_path;
    $("btnAnalyze").disabled = false;
    $("btnRun").disabled = false;
  });

  $("btnAnalyze").addEventListener("click", async () => {
    const r = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_path: sourcePath })
    });
    const j = await r.json();
    $("analyzeOut").textContent = JSON.stringify(j, null, 2);
    if (r.ok) {
      $("angles").value = String(j.suggested_angles || 1);
      $("frames").value = (j.suggested_frames || [1]).join(",");
    }
  });

  $("btnRun").addEventListener("click", async () => {
    if (!sourcePath) return;
    setStatus("Running...", "warn");
    const payload = {
      source_path: sourcePath,
      name: $("name").value,
      angles: parseInt($("angles").value || "1", 10),
      frames: $("frames").value,
      source_projs: parseInt($("sourceProjs").value || "1", 10),
      render_resolution: parseInt($("renderRes").value || "24", 10)
    };

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 90000);
    try {
      const r = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      });
      const j = await r.json();
      $("runOut").textContent = JSON.stringify(j, null, 2);
      if (!r.ok) {
        setStatus("Run failed", "err");
        return;
      }
      runResult = j;
      setStatus("Run complete", "ok");
      $("btnOpenWorkbench").disabled = false;
    } catch (e) {
      $("runOut").textContent = String(e);
      setStatus("Run timeout/fetch error", "err");
    } finally {
      clearTimeout(t);
    }
  });

  $("btnOpenWorkbench").addEventListener("click", () => {
    if (!runResult) return;
    const u = new URL("/workbench", window.location.origin);
    u.searchParams.set("job_id", runResult.job_id);
    window.location.href = u.toString();
  });
})();
