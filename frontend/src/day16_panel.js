/**
 * Day16 features added as a floating DOM panel:
 * - Autosave toggle (stores settings in localStorage)
 * - Manual "Trigger Save" which attempts to click the Save Project button in the page
 * - Activity log (local only)
 *
 * This is a standalone script that runs in the browser, manipulating the DOM
 * to add the floating panel.
 */
(function setupDay16Panel() {
  // Avoid attaching multiple panels if file is loaded more than once
  if (typeof window === "undefined") return;
  if (document.getElementById("day16-panel-root")) return;

  // Utilities
  const LS_KEY = "day16_autosave_enabled";
  const LS_INTERVAL_KEY = "day16_autosave_interval_ms";
  const LS_SELECTOR_KEY = "day16_save_button_selector";
  const LOG_KEY = "day16_activity_log";

  const createEl = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "style") Object.assign(el.style, v);
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    });
    children.forEach((c) => el.appendChild(c));
    return el;
  };

  function addLog(msg) {
    try {
      const ls = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      ls.unshift({ ts: Date.now(), msg });
      localStorage.setItem(LOG_KEY, JSON.stringify(ls.slice(0, 200)));
      renderLog();
    } catch (e) {
      // ignore
    }
  }

  function renderLog() {
    const container = document.getElementById("day16-log");
    if (!container) return;
    const ls = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    container.innerHTML = "";
    if (ls.length === 0) {
      container.textContent = "No activity yet.";
      return;
    }
    ls.slice(0, 50).forEach((entry) => {
      const d = new Date(entry.ts);
      const row = document.createElement("div");
      row.style.fontSize = "12px";
      row.style.padding = "4px 0";
      row.style.borderBottom = "1px solid rgba(0,0,0,0.04)";
      row.textContent = `${d.toLocaleTimeString()}: ${entry.msg}`;
      container.appendChild(row);
    });
  }

  // Find "Save Project (with thumbnail)" button in the DOM
  function findSaveButton() {
    // If user provided a CSS selector, try that first
    try {
      const sel = localStorage.getItem(LS_SELECTOR_KEY);
      if (sel) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
    } catch (e) {
      // ignore selector errors
    }
    // heuristics: find by text content;
    const btns = Array.from(document.querySelectorAll("button"));
    for (const b of btns) {
      if (!b.textContent) continue;
      const txt = b.textContent.trim().toLowerCase();
      if (txt.includes("save project") || txt.includes("save. id:") || txt.includes("save project (with thumbnail)")) {
        return b;
      }
    }
    // fallback: button with blue background class
    return document.querySelector('button.bg-blue-600') ||
    null;
  }

  // Attempt to trigger save by clicking the Save button;
  function triggerSaveClick() {
    const btn = findSaveButton();
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.focus();
      btn.click();
      addLog("Triggered save via Save button click.");
      return true;
    } else {
      addLog("Save button not found in DOM.");
      return false;
    }
  }

  // Autosave loop
  let autosaveTimer = null;
  function startAutosave() {
    stopAutosave();
    const enabled = localStorage.getItem(LS_KEY) === "true";
    if (!enabled) return;
    const interval = Number(localStorage.getItem(LS_INTERVAL_KEY) || "30000");
    autosaveTimer = setInterval(() => {
      const did = triggerSaveClick();
      addLog(did ? `Autosave triggered (interval ${interval}ms)` : "Autosave attempted but no Save button");
    }, Math.max(1000, interval));
    addLog("Autosave started.");
  }
  function stopAutosave() {
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
      addLog("Autosave stopped.");
    }
  }

  // Create panel (hidden by default, expanded by launcher)
  const root = createEl("div", {
    id: "day16-panel-root",
    style: {
      position: "fixed",
      right: "18px",
      bottom: "72px",
      width: "340px",
      maxHeight: "64vh",
      overflow: "auto",
      background: "linear-gradient(135deg, #fffaf6 60%, #f4efe9 100%)",
      border: "1.5px solid #8b5e45",
      borderRadius: "18px",
      boxShadow: "0 12px 32px 0 rgba(84,48,31,0.13), 0 1.5px 4px rgba(139,94,69,0.08)",
      padding: "0 0 16px 0",
      zIndex: 10000,
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "13px",
      color: "#432818",
      backdropFilter: "blur(8px)",
      backgroundClip: "padding-box",
      transform: "translateY(8px) scale(0.98)",
      opacity: "0",
      transition: "transform 220ms cubic-bezier(.4,2,.6,1), opacity 220ms cubic-bezier(.4,2,.6,1)",
      pointerEvents: "none"
    }
  });
  // Header with 3D house image/icon and title
  const header = createEl("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 8px 16px", borderTopLeftRadius: "18px", borderTopRightRadius: "18px", background: "linear-gradient(90deg, #fffaf6 80%, #f4efe9 100%)", borderBottom: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(139,94,69,0.04)" } });
  const houseImg = createEl("img", { src: "https://cdn.jsdelivr.net/gh/indestruct9/3d-assets/house3d.png", alt: "3D House", style: { width: "38px", height: "38px", marginRight: "10px", borderRadius: "10px", boxShadow: "0 2px 8px #e5e7eb" } });
  const title = createEl("div", { text: "Day16 — Extras", style: { fontWeight: 800, fontSize: "18px", letterSpacing: "-0.5px", color: "#8b5e45", display: "flex", alignItems: "center", gap: "8px" } });
  title.prepend(houseImg);
  const closeBtn = createEl("button", { text: "✕", style: { border: "none", background: "transparent", cursor: "pointer", fontSize: "20px", color: "#8b5e45", transition: "color 0.2s" } });
  closeBtn.onmouseenter = () => closeBtn.style.color = "#ef4444";
  closeBtn.onmouseleave = () => closeBtn.style.color = "#8b5e45";
  // We'll collapse the panel instead of removing it so it doesn't block the UI
  function openPanel() {
    root.style.transform = "translateY(0) scale(1)";
    root.style.opacity = "1";
    root.style.pointerEvents = "auto";
    launcher.setAttribute('aria-expanded', 'true');
    addLog('Panel opened');
  }
  function closePanel() {
    root.style.transform = "translateY(8px) scale(0.98)";
    root.style.opacity = "0";
    root.style.pointerEvents = "none";
    launcher.setAttribute('aria-expanded', 'false');
    addLog('Panel closed');
  }
  closeBtn.onclick = () => closePanel();
  header.appendChild(title);
  header.appendChild(closeBtn);
  // Controls
  const controlsWrap = createEl("div", { style: { marginBottom: "8px" } });
  // Autosave toggle
  const autosaveRow = createEl("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" } });
  const autosaveLabel = createEl("label", { text: "Autosave", style: { display: "flex", gap: "8px", alignItems: "center", cursor: "pointer" } });
  const autosaveCheckbox = createEl("input", { type: "checkbox" });
  autosaveCheckbox.checked = localStorage.getItem(LS_KEY) === "true";
  autosaveCheckbox.onchange = (e) => {
    localStorage.setItem(LS_KEY, e.target.checked ? "true" : "false");
    if (e.target.checked) startAutosave(); else stopAutosave();
    addLog(`Autosave ${e.target.checked ? "enabled" : "disabled"}`);
  };
  autosaveLabel.appendChild(autosaveCheckbox);
  autosaveLabel.appendChild(createEl("span", { text: "Enable autosave" }));
  autosaveRow.appendChild(autosaveLabel);
  // Interval input
  const intervalRow = createEl("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" } });
  const intervalInput = createEl("input", { type: "number", value: localStorage.getItem(LS_INTERVAL_KEY) || "30000", style: { width: "100px", padding: "6px", borderRadius: "4px", border: "1px solid #e5e7eb" } });
  const intervalSaveBtn = createEl("button", { text: "Set interval", style: { padding: "6px 8px", borderRadius: "6px", border: "none", background: "#111827", color: "#fff", cursor: "pointer" } });
  intervalSaveBtn.onclick = () => {
    const v = Math.max(1000, Number(intervalInput.value) || 30000);
    localStorage.setItem(LS_INTERVAL_KEY, String(v));
    addLog(`Autosave interval set to ${v}ms`);
    if (localStorage.getItem(LS_KEY) === "true") {
      startAutosave();
    }
  };
  intervalRow.appendChild(intervalInput);
  intervalRow.appendChild(intervalSaveBtn);

  // Save-button selector input (optional)
  const selectorRow = createEl("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" } });
  const selectorInput = createEl("input", { type: "text", value: localStorage.getItem(LS_SELECTOR_KEY) || "", placeholder: "CSS selector for Save button (optional)", style: { width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #e5e7eb" } });
  const selectorSaveBtn = createEl("button", { text: "Save selector", style: { padding: "6px 8px", borderRadius: "6px", border: "none", background: "#111827", color: "#fff", cursor: "pointer" } });
  selectorSaveBtn.onclick = () => {
    const v = (selectorInput.value || "").trim();
    if (v) localStorage.setItem(LS_SELECTOR_KEY, v); else localStorage.removeItem(LS_SELECTOR_KEY);
    addLog(`Save selector ${v ? 'set to ' + v : 'cleared'}`);
    alert('Selector saved. Trigger Save to test.');
  };
  selectorRow.appendChild(selectorInput);
  selectorRow.appendChild(selectorSaveBtn);

  // Manual save button
  const manualSaveRow = createEl("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" } });
  const manualSaveBtn = createEl("button", { text: "Trigger Save", style: { padding: "8px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", flex: "1" } });
  manualSaveBtn.onclick = () => {
    const ok = triggerSaveClick();
    if (!ok) {
      alert("Couldn't find Save button in DOM. Make sure the Editor is rendered and the Save button text hasn't been changed.");
    }
  };
  manualSaveRow.appendChild(manualSaveBtn);

  // Clear log button
  const clearLogBtn = createEl("button", { text: "Clear log", style: { padding: "6px 8px", borderRadius: "6px", border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer" } });
  clearLogBtn.onclick = () => {
    localStorage.removeItem(LOG_KEY);
    renderLog();
    addLog("Log cleared");
  };
  // Log container
  const logContainer = createEl("div", { id: "day16-log", style: { marginTop: "8px", maxHeight: "220px", overflow: "auto", borderTop: "1px solid rgba(0,0,0,0.04)", paddingTop: "8px" } });
  logContainer.textContent = "No activity yet.";

  // footer small info
  const footer = createEl("div", { style: { marginTop: "8px", fontSize: "11px", color: "#556", textAlign: "right" } });
  footer.textContent = "Day16 • floating tools";

  // Build panel
  controlsWrap.appendChild(autosaveRow);
  controlsWrap.appendChild(intervalRow);
  controlsWrap.appendChild(selectorRow);
  controlsWrap.appendChild(manualSaveRow);
  controlsWrap.appendChild(clearLogBtn);

  root.appendChild(header);
  root.appendChild(controlsWrap);
  root.appendChild(logContainer);
  root.appendChild(footer);

  // Add a small launcher button so the panel doesn't sit over content by default
  const launcher = createEl('button', {
    id: 'day16-launcher',
    title: 'Extras',
    style: {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      width: '54px',
      height: '54px',
      borderRadius: '999px',
      border: 'none',
      background: 'linear-gradient(135deg, #8b5e45 60%, #54301f 100%)',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(139,94,69,0.18)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '22px',
      transition: 'transform 0.18s cubic-bezier(.4,2,.6,1), box-shadow 0.18s',
      outline: 'none',
      borderColor: '#54301f',
    }
  });
  launcher.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .66.39 1.26 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.66 0 1.26.39 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.39-1.51 1z"></path></svg>';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.onmouseenter = () => { launcher.style.transform = 'scale(1.08) rotate(-12deg)'; launcher.style.boxShadow = '0 12px 32px rgba(139,94,69,0.22)'; };
  launcher.onmouseleave = () => { launcher.style.transform = 'scale(1)'; launcher.style.boxShadow = '0 8px 24px rgba(139,94,69,0.18)'; };
  launcher.onmousedown = () => { launcher.style.transform = 'scale(0.96) rotate(8deg)'; };
  launcher.onmouseup = () => { launcher.style.transform = 'scale(1.08) rotate(-12deg)'; };
  launcher.onclick = () => {
    const open = launcher.getAttribute('aria-expanded') === 'true';
    if (open) closePanel(); else openPanel();
  };

  // Start collapsed (launcher visible)
  closePanel();

  document.body.appendChild(root);
  document.body.appendChild(launcher);
  // Ensure autosave state is started if enabled
  if (localStorage.getItem(LS_KEY) === "true") {
    startAutosave();
  }

  // initial render log
  renderLog();

  // Expose small API for debugging from console
  window.__day16 = {
    triggerSaveClick,
    startAutosave,
    stopAutosave,
    addLog,
    renderLog,
  };
  // Announce panel ready
  addLog("Day16 panel initialized.");
})();