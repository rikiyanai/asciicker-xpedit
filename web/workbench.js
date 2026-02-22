(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get("job_id") || "";
  let sessionId = null;

  function status(text, cls) {
    const el = $("wbStatus");
    el.className = "small " + (cls || "");
    el.textContent = text;
  }

  function renderGrid(info) {
    const cols = info.grid_cols;
    const rows = info.grid_rows;
    const grid = $("grid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${cols}, 20px)`;
    for (let i = 0; i < cols * rows; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      c.textContent = "#";
      grid.appendChild(c);
    }
  }

  async function loadFromJob() {
    if (!jobId) {
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
        body: JSON.stringify({ job_id: jobId }),
        signal: ctl.signal,
      });
      const j = await r.json();
      $("sessionOut").textContent = JSON.stringify(j, null, 2);
      if (!r.ok) {
        status("Load failed", "err");
        return;
      }
      sessionId = j.session_id;
      $("btnExport").disabled = false;
      status(`Session active: ${sessionId.slice(0, 8)}...`, "ok");
      renderGrid(j);
    } catch (e) {
      status("Load failed: fetch/timeout", "err");
      $("sessionOut").textContent = String(e);
    } finally {
      clearTimeout(t);
    }
  }

  async function exportXp() {
    if (!sessionId) return;
    const r = await fetch("/api/workbench/export-xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const j = await r.json();
    $("exportOut").textContent = JSON.stringify(j, null, 2);
    if (r.ok) status("Export succeeded", "ok");
    else status("Export failed", "err");
  }

  $("btnLoad").addEventListener("click", loadFromJob);
  $("btnExport").addEventListener("click", exportXp);

  if (jobId) {
    loadFromJob();
  }
})();
