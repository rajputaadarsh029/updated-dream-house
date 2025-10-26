import React, { useEffect, useRef, useState } from "react";
import PreferenceForm from "../components/PreferenceForm";
import ThreeDViewer from "../components/ThreeDViewer";
import RoomList from "../components/RoomList";
import RoomEditor from "../components/RoomEditor";
import api from "../services/api";
import CollabClient from "../services/collab";

/**
 * Day20 Editor — Presence, Cursors, Autosave, Rollback
 */

export default function Editor() {
  const [layout, setLayout] = useState(null);
  const [selected, setSelected] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  // transform controls
  const [transformMode, setTransformMode] = useState("translate");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const snapSize = 0.25;
  // Versions UI
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsList, setVersionsList] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState(null);

  // Compare UI states
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState(null);
  const [compareRightId, setCompareRightId] = useState(null);
  const [compareLeftLayout, setCompareLeftLayout] = useState(null);
  const [compareRightLayout, setCompareRightLayout] = useState(null);
  const [compareDiff, setCompareDiff] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  // Collab state
  const collabRef = useRef(null);
  const [collabStatus, setCollabStatus] = useState("idle");
  const [participants, setParticipants] = useState([]);
  const [pendingOps, setPendingOps] = useState({});
  const [reconnectDelay, setReconnectDelay] = useState(0);

  // Day 20: New state for other users' cursors and autosave status
  const [otherCursors, setOtherCursors] = useState({});
  const [autosaveStatus, setAutosaveStatus] = useState("idle"); // idle | saving | saved
  const lastCursorSent = useRef(0);
  const cursorThrottle = 33; // ~30 FPS

  // Day 19: Recent Ops state
  const [recentOps, setRecentOps] = useState([]);

  // viewer & history
  const viewerRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const initialLoadRef = useRef(true);
  useEffect(() => {
    const stored = localStorage.getItem("loadedLayout");
    const storedId = localStorage.getItem("loadedProjectId");
    if (stored) {
      try {
        setLayout(JSON.parse(stored));
        localStorage.removeItem("loadedLayout");
      } catch (e) {}
    }
    if (storedId) {
      setProjectId(storedId);
      localStorage.removeItem("loadedProjectId");
    }
    setTimeout(() => (initialLoadRef.current = false), 10);
  }, []);
  // ---------- History helpers ----------
  const cloneLayout = (l) => (l ? JSON.parse(JSON.stringify(l)) : { rooms: [], meta: {} });
  const pushHistory = (prev) => {
    if (!prev) return;
    undoStackRef.current.push(cloneLayout(prev));
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    redoStackRef.current = [];
  };
  const setLayoutWithHistory = (updater, { skipHistory = false } = {}) => {
    setLayout((prev) => {
      if (!skipHistory && !initialLoadRef.current) {
        pushHistory(prev);
      }
      const next = typeof updater === "function" ? updater(prev || { rooms: [], meta: {} }) : updater;
      return next;
    });
  };

  const undo = () => {
    const undoStack = undoStackRef.current;
    if (!undoStack.length) {
      return alert("Nothing to undo");
    }
    setLayout((current) => {
      redoStackRef.current.push(cloneLayout(current));
      const prev = undoStack.pop();
      return prev;
    });
  };
  const redo = () => {
    const redoStack = redoStackRef.current;
    if (!redoStack.length) {
      return alert("Nothing to redo");
    }
    setLayout((current) => {
      undoStackRef.current.push(cloneLayout(current));
      const next = redoStack.pop();
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      const z = e.key.toLowerCase() === "z";
      const y = e.key.toLowerCase() === "y";
      if ((e.ctrlKey || e.metaKey) && z) {
        e.preventDefault();
        if (collabRef.current) collabRef.current.sendUndo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && y) {
        e.preventDefault();
        if (collabRef.current) collabRef.current.sendRedo();
        else redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!projectId) return;
    const fetchRecentOps = async () => {
      try {
        const res = await api.get(`/projects/${projectId}/ops/recent`);
        setRecentOps(res.data.ops);
      } catch (e) {
        console.error("Failed to fetch recent ops", e);
      }
    };
    fetchRecentOps();
  }, [projectId]);

  // ---------- Collab lifecycle ----------
  useEffect(() => {
    if (!projectId) {
      if (collabRef.current) {
        try { collabRef.current.requestSave(); } catch (e) {}
        collabRef.current.close();
      }
      collabRef.current = null;
      setCollabStatus("idle");
      setParticipants([]);
      return;
    }

    setCollabStatus("connecting");
    const client = 
    new CollabClient({
      projectId,
      token: localStorage.getItem("token") || null,
      onSnapshot: (remoteLayout, clients) => {
        initialLoadRef.current = true;
        setLayout(remoteLayout || { rooms: [], meta: {} });
        initialLoadRef.current = false;
        setCollabStatus("connected");
        setParticipants(clients || []);
      },
      onOp: (msg) => {
        const op = msg.op;
        const opId = msg.opId;
        applyOpToLayout(op, { pushHistory: false });
        setRecentOps(prev => [msg, ...prev].slice(0, 10));
      },
      onAck: (ack) => {
        const opId = ack.opId;
        if (opId) {
          setPendingOps(prev => {
            const cp = { ...prev };
            delete cp[opId];
            return cp;
          });
        }
      },
      onUndo: (msg) => {
        console.log("Received server undo", msg);
      },
      onRedo: (msg) => {
        console.log("Received server redo", msg);
      },
      onPresence: (msg) => {
        const id = msg.userId;
        const existing = (participants || []).filter((p) => p.userId !== id);
        const candidate = { userId: id, displayName: (msg.meta && msg.meta.displayName) || `User-${id.slice(0,6)}`, cursor: msg.cursor, lastSeen: Date.now() };
        setParticipants([...existing, candidate]);
      },
      onJoined: (msg) => {
        const id = msg.userId;
        setParticipants((prev) => {
          const others = (prev || []).filter((p) => p.userId !== id);
          const p = { userId: id, displayName: msg.displayName || `User-${id.slice(0,6)}`, lastSeen: Date.now() };
          return [...others, p];
        });
      },
      onLeft: (msg) => {
        const id = msg.userId;
        setParticipants((prev) => (prev || []).filter((p) => p.userId !== id));
      },
      onOpen: () => setCollabStatus("connected"),
      onReconnect: (delay) => {
        setCollabStatus("connecting");
        setReconnectDelay(delay);
      },
      // Day 20: New handlers for cursor updates and autosave
      onCursorBroadcast: (msg) => {
        setOtherCursors(prev => ({
          ...prev,
          [msg.userId]: msg.cursor
        }));
      },
      onAutosaveConfirm: () => {
        setAutosaveStatus("saved");
        setTimeout(() => setAutosaveStatus("idle"), 2000);
      }
    });
    collabRef.current = client;
    setCollabStatus("syncing");

    const presenceTimer = setInterval(() => {
      try {
        client.sendPresence({ now: Date.now() });
      } catch (e) {}
    }, 4000);
    return () => {
      clearInterval(presenceTimer);
      try { client.requestSave();
      } catch (e) {}
      try { client.close();
      } catch (e) {}
      collabRef.current = null;
      setCollabStatus("idle");
    };
  }, [projectId]);

  // ---------- apply op locally ----------
  const applyOpToLayout = (op, { pushHistory = false } = {}) => {
    if (!op || !op.kind) return;
    setLayout((prev) => {
      const next = cloneLayout(prev || { rooms: [], meta: {} });
      next.rooms = next.rooms || [];
      if (op.kind === "room:add") {
        const room = op.room || {};
        if (!next.rooms.some((r) => r.name === room.name)) next.rooms.push(room);
      } else if (op.kind === "room:remove") {
        const name = op.name;
        next.rooms = next.rooms.filter((r) => 
        r.name !== name);
      } else if (op.kind === "room:update") {
        const updated = op.room || {};
        const name = updated.name;
        let found = false;
        next.rooms = next.rooms.map((r) => {
          if (r.name === name) {
            found = true;
           
            return { ...r, ...updated };
          }
          return r;
        });
        if (!found) next.rooms.push(updated);
      }
      return next;
    });
  };

  // ---------- core handlers that also send ops ----------
  const handleGenerated = (newLayout) => {
    setLayoutWithHistory(() => newLayout, { skipHistory: true });
    setSelected(null);
    setProjectId(null);
    setThumbnailUrl(null);
  };

  const handleSelectRoom = (roomOrName) => {
    const name = typeof roomOrName === "string" ?
    roomOrName : roomOrName?.name;
    setSelected(name);
  };

  const _sendOpWithPending = (op, roomNameForUI) => {
    const opId = "op_" + Math.random().toString(36).slice(2,9);
    setPendingOps((prev) => ({ ...prev, [opId]: { opId, op, roomName: roomNameForUI, ts: Date.now() } }));
    if (collabRef.current) {
      collabRef.current.sendOp({ ...op, opId }).then(() => {
      }).catch(() => {
        setTimeout(() => {
          setPendingOps((prev) => {
            const cp = { ...prev };
            delete cp[opId];
            return cp;
          });
        }, 3000);
      });
    } else {
      setTimeout(() => {
        setPendingOps((prev) => {
          const cp = { ...prev };
          delete cp[opId];
          return cp;
        });
      }, 200);
    }
    return opId;
  };

  const handleTransformEnd = (roomName, { x, y, rotationY, scale }) => {
    setLayoutWithHistory((prev) => {
      if (!prev) return prev;
      const rooms = prev.rooms.map((r) =>
        r.name === roomName ? { ...r, x: Number(x), y: Number(y), rotationY: rotationY ?? r.rotationY, scale: scale ?? r.scale ?? 1 } : r
      );
      return { ...prev, rooms };
    });
    const op = { kind: "room:update", room: { name: roomName, x: Number(x), y: Number(y), rotationY: rotationY ??
    0, scale: scale ?? 1 } };
    _sendOpWithPending(op, roomName);
  };
  const handleRoomChange = (updatedRoom) => {
    setLayoutWithHistory((prev) => {
      if (!prev) return prev;
      const rooms = prev.rooms.map((r) => (r.name === updatedRoom.name ? updatedRoom : r));
      return { ...prev, rooms };
    });
    const op = { kind: "room:update", room: updatedRoom };
    _sendOpWithPending(op, updatedRoom.name);
  };
  const handleDeleteRoom = (name) => {
    setLayoutWithHistory((prev) => {
      if (!prev) return prev;
      const rooms = prev.rooms.filter((r) => r.name !== name);
      setSelected(null);
      return { ...prev, rooms };
    });
    const op = { kind: "room:remove", name };
    _sendOpWithPending(op, name);
  };
  const handleAddRoom = (room) => {
    setLayoutWithHistory((prev) => {
      const rlist = prev?.rooms ? [...prev.rooms] : [];
      let base = room.name || "Room";
      let suffix = 1;
      let nm = base;
      while (rlist.some((rr) => rr.name === nm)) {
        suffix += 1;
        nm = `${base} ${suffix}`;
      }
 
      const newRoom = { ...room, name: nm };
      return { rooms: [...rlist, newRoom], meta: prev?.meta || {} };
    });
    const op = { kind: "room:add", room };
    _sendOpWithPending(op, room.name || room.name);
  };
  // ---------- Save / Export ----------
  const handleSaveProject = async () => {
    if (!layout) return alert("No layout to save.");
    const token = localStorage.getItem("token");
    if (!token) {
      const ok = confirm("You must be logged in to save a project. Go to Login page?");
      if (ok) window.location.href = "/login";
      return;
    }

    const name = prompt("Project name:", (layout?.meta?.description || "My Project"));
    if (!name) return;

    let thumbnail = null;
    try {
      if (viewerRef.current && typeof viewerRef.current.capture === "function") {
        thumbnail = viewerRef.current.capture();
      }
    } catch (e) {
      console.warn("Capture failed:", e);
    }

    try {
      if (projectId) {
        await api.put(`/projects/${projectId}`, { name, layout, thumbnail }, { headers: { Authorization: `Bearer ${token}` } });
        alert("Project updated.");
      } else {
        const res = await api.post("/save-project", { name, layout, thumbnail }, { headers: { Authorization: `Bearer ${token}` } });
        setProjectId(res.data.id);
        alert("Saved. id: " + res.data.id);
      }
      if (thumbnail) setThumbnailUrl(thumbnail);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (collabRef.current) collabRef.current.requestSave();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || "Save failed. Check backend console.");
    }
  };

  const handleExportJSON = () => {
    if (!layout) return alert("No layout to export");
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (layout.meta?.description || "layout") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const createFloorplanSVGString = (layoutObj) => {
    if (!layoutObj || !layoutObj.rooms || !layoutObj.rooms.length) return "";
    const rooms = layoutObj.rooms;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rooms.forEach((r) => {
      const x1 = Number(r.x);
      const y1 = Number(r.y);
      const s = Number(r.size) || 1;
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x1 + s);
      maxY = Math.max(maxY, y1 + s);
    });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 10; maxY = 10;
    }
    const padding = 20; const pxPerUnit = 80;
    const width = Math.max(200, Math.ceil((maxX - minX) * pxPerUnit) + padding * 2);
    const height = Math.max(200, Math.ceil((maxY - minY) * pxPerUnit) + padding * 2);
    const worldToSvgX = (x) => Math.round((x - minX) * pxPerUnit) + padding;
    const worldToSvgY = (y) => Math.round((y - minY) * pxPerUnit) + padding;
    let rects = "";
    rooms.forEach((r) => {
      const s = Number(r.size) || 1;
      const sx = worldToSvgX(Number(r.x));
      const sy = worldToSvgY(Number(r.y));
      const sw = Math.max(1, Math.round(s * pxPerUnit));
      const sh = Math.max(1, Math.round(s * pxPerUnit));
      rects += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="rgba(58, 141, 255, 0.12)" stroke="#2A8BFF" stroke-width="2" />`;
      const textX = sx + sw / 2; const textY = sy + sh / 2;
     
      rects += `<text x="${textX}" y="${textY}" font-family="Arial" font-size="${Math.max(10, Math.round(pxPerUnit/6))}" fill="#0b1723" text-anchor="middle" dominant-baseline="middle">${escapeXml(r.name)}</text>`;
      rects += `<text x="${sx + 6}" y="${sy + sh - 6}" font-family="Arial" font-size="10" fill="#243444" >${s} m</text>`;
    });
    const scaleText = `Scale: 1 unit = 1 m, ${pxPerUnit}px per m`;
    const title = layoutObj.meta?.description || "Floorplan";
    const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 60}" viewBox="0 0 ${width} ${height + 60}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="translate(0,0)">
    <text x="${padding}" y="${padding - 4}" font-family="Arial" font-size="18" fill="#0b1723">${escapeXml(title)}</text>
    ${rects}
    <text x="${padding}" y="${height + 30}" font-family="Arial" font-size="12" fill="#444">${escapeXml(scaleText)}</text>
  </g>
</svg>`;
    return svg;
  };
  const escapeXml = (unsafe) => {
    if (!unsafe && unsafe !== 0) return "";
    return String(unsafe).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };
  const handleExportSVG = () => {
    if (!layout) return alert("Nothing to export");
    const svgString = createFloorplanSVGString(layout);
    if (!svgString) return alert("Cannot generate SVG for empty layout.");
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (layout.meta?.description || "floorplan") + ".svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Versions ----------
  const fetchVersions = async () => {
    if (!projectId) {
      alert("Save project first to get versions.");
      return;
    }
    setLoadingVersions(true);
    try {
      const res = await api.get(`/projects/${projectId}/versions`);
      setVersionsList(res.data.versions ||
      []);
      setVersionsOpen(true);
      setCompareMode(false);
      setCompareLeftId(null);
      setCompareRightId(null);
      setCompareLeftLayout(null);
      setCompareRightLayout(null);
      setCompareDiff(null);
    } catch (err) {
      console.error("Failed to fetch versions", err);
      alert(err?.response?.data?.detail || "Failed to fetch versions");
    } finally {
      setLoadingVersions(false);
    }
  };
  const previewVersion = async (vid) => {
    if (!projectId || !vid) return;
    try {
      const res = await api.get(`/projects/${projectId}/versions/${vid}`);
      const vdata = res.data;
      const proj = vdata.project;
      if (!proj) {
        alert("Invalid version data");
        return;
      }
      setPreviewingVersion(vid);
      setLayout(proj.layout);
      setSelected(null);
    } catch (err) {
      console.error("Preview failed", err);
      alert(err?.response?.data?.detail || "Failed to preview version");
    }
  };

  const cancelPreview = async () => {
    if (!projectId) {
      alert("No project to restore; reload.");
      setPreviewingVersion(null);
      return;
    }
    try {
      const res = await api.get(`/projects/${projectId}`);
      const proj = res.data;
      setLayout(proj.layout);
      setPreviewingVersion(null);
    } catch (err) {
      console.error("Failed to reload project after preview", err);
      alert("Failed to reload project. You may need to refresh the page.");
    }
  };

  // Day 20: Rollback logic
  const rollbackVersion = async (vid) => {
    if (!projectId || !vid) return;
    const ok = confirm(`Rollback to version ${vid}? This will reset all active sessions and undo/redo history.`);
    if (!ok) return;
    try {
      await api.post(`/projects/${projectId}/rollback/${vid}`);
      alert("Rollback initiated. The editor will now reload the old version.");
      // The server broadcast a snapshot, so we don't need to manually fetch the layout.
      // just clear the version state
      setPreviewingVersion(null);
      setVersionsOpen(false);
      // refetch versions to update the list
      fetchVersions();
    } catch (err) {
      console.error("Rollback failed", err);
      alert(err?.response?.data?.detail || "Rollback failed");
    }
  };

  const revertToVersion = async (vid) => {
    if (!projectId || !vid) return;
    const ok = confirm("Reverting will replace current project with this version. Continue?");
    if (!ok) return;
    try {
      await api.post(`/projects/${projectId}/versions/${vid}/revert`);
      alert("Reverted to version " + vid);
      const proj = (await api.get(`/projects/${projectId}`)).data;
      setLayout(proj.layout);
      setPreviewingVersion(null);
      const list = (await api.get(`/projects/${projectId}/versions`)).data.versions;
      setVersionsList(list || []);
    } catch (err) {
      console.error("Revert failed", err);
      alert(err?.response?.data?.detail || "Revert failed");
    }
  };
  // ---------- Compare helpers (unchanged) ----------
  const runCompare = async (leftId, rightId) => {
    if (!projectId) return alert("No project saved yet.");
    if (!leftId || !rightId) return alert("Choose two versions to compare.");
    if (leftId === rightId) return alert("Pick two different versions.");

    setLoadingCompare(true);
    try {
      const [lres, rres] = await Promise.all([
        api.get(`/projects/${projectId}/versions/${leftId}`),
        api.get(`/projects/${projectId}/versions/${rightId}`),
      ]);
      const lproj = lres.data.project;
      const rproj = rres.data.project;
      setCompareLeftLayout(lproj.layout);
      setCompareRightLayout(rproj.layout);
      const diff = computeLayoutDiff(lproj.layout, rproj.layout);
      setCompareDiff(diff);
      setCompareMode(true);
    } catch (err) {
      console.error("Compare failed", err);
      alert(err?.response?.data?.detail || "Compare failed");
    } finally {
      setLoadingCompare(false);
    }
  };
  function computeLayoutDiff(A = { rooms: [] }, B = { rooms: [] }) {
    const mapA = new Map((A.rooms || []).map((r) => [r.name, r]));
    const mapB = new Map((B.rooms || []).map((r) => [r.name, r]));
    const added = [];
    const removed = [];
    const modified = [];

    for (const [name, br] of mapB.entries()) {
      if (!mapA.has(name)) {
        added.push(br);
      }
    }
    for (const [name, ar] of mapA.entries()) {
      if (!mapB.has(name)) {
        removed.push(ar);
      }
    }
    for (const [name, ar] of mapA.entries()) {
      if (!mapB.has(name)) continue;
      const br = mapB.get(name);
      const changes = {};
      const keys = ["x", "y", "size", "rotationY", "scale"];
      keys.forEach((k) => {
        const av = typeof ar[k] === "undefined" ? null : ar[k];
        const bv = typeof br[k] === "undefined" ? null : br[k];
        if ((typeof av === "number" || typeof bv === "number")) {
          const aNum = Number(av || 0);
          const bNum = Number(bv || 0);
          if (Math.abs(aNum - bNum) 
          > 1e-4) changes[k] = [av, bv];
        } else {
          if (av !== bv) changes[k] = [av, bv];
        }
      });
      if (Object.keys(changes).length > 0) {
        modified.push({ name, changes, from: ar, to: br });
      }
    }

    return { added, removed, modified };
  }

  const swapCompareSides = () => {
    setCompareLeftId((prev) => {
      const oldLeft = prev;
      setCompareRightId((r) => oldLeft);
      return compareRightId;
    });
    setCompareLeftLayout(compareRightLayout);
    setCompareRightLayout(compareLeftLayout);
    if (compareDiff) {
      setCompareDiff((prev) => {
        if (!prev) return null;
        const rev = computeLayoutDiff(compareRightLayout, compareLeftLayout);
        return rev;
      });
    }
  };

  const downloadDiffJSON = () => {
    if (!compareDiff) return alert("No diff computed");
    const blob = new Blob([JSON.stringify(compareDiff, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diff_${projectId}_${compareLeftId}_vs_${compareRightId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Day 20: Mouse move handler for sending cursor updates
  const handleMouseMove = (e) => {
    if (!collabRef.current || !projectId) return;
    const now = Date.now();
    if (now - lastCursorSent.current > cursorThrottle) {
      const { offsetX, offsetY } = e.nativeEvent;
      collabRef.current.sendCursorUpdate({ x: offsetX, y: offsetY });
      lastCursorSent.current = now;
    }
  };

  // ---------- render ----------
  return (
    <div className="p-6 grid grid-cols-3 gap-6 editor-grid workspace-bg">
      <div className="col-span-1 space-y-4 card">
        <h2 className="section-title">Preferences</h2>
        <PreferenceForm onGenerated={handleGenerated} />

        <div className="mt-4">
          <h3 className="font-semibold">Add Room</h3>
          <AddRoomForm onAdd={(r) => handleAddRoom(r)} />
        </div>

      
        <div className="mt-4">
          <h3 className="font-semibold">Transform Controls</h3>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setTransformMode("translate")} className={`px-2 py-1 rounded ${transformMode === "translate" ? "btn-coffee" : "btn-coffee-ghost"}`}>Move</button>
            <button onClick={() => setTransformMode("rotate")} className={`px-2 py-1 rounded ${transformMode === "rotate" ? "btn-coffee" : "btn-coffee-ghost"}`}>Rotate</button>
            <button onClick={() => setTransformMode("scale")} className={`px-2 py-1 rounded ${transformMode === "scale" ? "btn-coffee" : "btn-coffee-ghost"}`}>Scale</button>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
            <span className="text-sm">Snap to grid ({snapEnabled ? snapSize : "off"})</span>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={handleSaveProject} className="btn-coffee">Save Project</button>
          <button onClick={handleExportJSON} className="btn-coffee-ghost">Export JSON</button>
          <button onClick={handleExportSVG} className="btn-soft">Export SVG</button>
        </div>

        {/* Day 19: Undo/Redo buttons */}
    <div className="mt-3 flex gap-2">
      <button onClick={() => collabRef.current && collabRef.current.sendUndo()} className="btn-soft">Undo</button>
      <button onClick={() => collabRef.current && collabRef.current.sendRedo()} className="btn-soft">Redo</button>
    </div>
        
        <div className="mt-3">
          <button onClick={() => { if (!projectId) return alert("Save project first to access versions.");
          fetchVersions(); }} className="btn-coffee" disabled={!projectId}>
            Versions
          </button>
        </div>

        <div className="mt-3">
          <div className="text-sm">Collab status: <strong className="muted">{collabStatus}</strong></div>
          {collabStatus === "connecting" && <div className="text-sm" style={{fontSize:12}}>Reconnecting… backoff: {reconnectDelay}ms</div>}
          <div className="text-sm">Connected participants: <strong>{participants.length}</strong></div>
          <div className="text-sm">Pending ops: <strong>{Object.keys(pendingOps).length}</strong></div>
          {Object.keys(pendingOps).length > 0 && (
            <div style={{ marginTop: 6 }}>
              {Object.values(pendingOps).map((p) => (
                <div key={p.opId} style={{ fontSize: 12, color: "#444" }}>
                  ⏳ {p.roomName || "op"} — {new Date(p.ts).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => collabRef.current && collabRef.current._sendPending()} className="btn-soft mt-2">Resend pending</button>
        </div>
        
        {/* Day 20: Autosave Status */}
        <div className="mt-2 text-sm text-gray-500">
          {autosaveStatus === "saving" ? "Saving..." : (autosaveStatus === "saved" ? "All changes saved" : null)}
        </div>

        {/* Day 19: Recent Ops Panel */}
        <div className="mt-4">
          <h3 className="font-semibold section-title">Recent Ops</h3>
          <div className="flex flex-col gap-1 text-sm overflow-y-auto" style={{maxHeight: "150px"}}>
            {recentOps.length === 0 ? <div className="text-gray-500">No ops yet.</div> : recentOps.map((op, i) => (
                <div key={i} className="bg-gray-100 p-2 rounded">
                    <strong>{op.op?.kind || op.type}</strong> by {op.from}
                </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold section-title">Participants</h3>
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            {participants.length === 0 ?
            <div style={{ color: "#666" }}>No one else here</div> : participants.map((p) => (
              <div key={p.userId} style={{ display: "flex", gap: 8, alignItems: "center" }} className="room-item">
                <div className="avatar">{(p.displayName || "U")[0]}</div>
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{p.displayName}</div>
                  <div className="small-muted">{p.cursor ? `cursor: ${JSON.stringify(p.cursor)}` : "idle"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

 
        {thumbnailUrl && (
          <div className="mt-4">
            <h3 className="font-semibold">Thumbnail Preview</h3>
            <img src={thumbnailUrl} alt="thumbnail" style={{ width: "100%", borderRadius: 6, border: "1px solid #ddd" }} />
          </div>
        )}

        {saved && <div className="mt-2 text-green-600">Saved ✔</div>}
      </div>

    
      <div className="col-span-1 card" onMouseMove={handleMouseMove} style={{ position: "relative" }}>
        <h2 className="section-title mb-2">3D Viewer</h2>
        <div style={{ height: 420, display: 'flex', alignItems: 'stretch' }}>
        <ThreeDViewer
          ref={viewerRef}
          layout={layout ||
          { rooms: [] }}
          selectedRoomName={selected}
          onSelectRoom={handleSelectRoom}
          onTransformEnd={handleTransformEnd}
          mode={transformMode}
          snap={snapEnabled ?
          snapSize : 0}
        />
        </div>
        {/* Day 20: Render other users' cursors */}
        {Object.entries(otherCursors).map(([id, cursor]) => (
            <div 
                key={id} 
                className="absolute w-5 h-5 bg-blue-500 rounded-full pointer-events-none opacity-50"
                style={{
                    left: cursor.x, 
                    top: cursor.y,
                    transform: 'translate(-50%, -50%)',
                }} 
            />
        ))}
      </div>

      <div className="col-span-1 space-y-4 card">
        <h2 className="section-title">Rooms</h2>
        <RoomList layout={layout || { rooms: [] }} onSelect={(r) => handleSelectRoom(r)} />
        <div className="mt-4">
          <h3 className="font-semibold">Editor</h3>
          <RoomEditor room={(layout?.rooms || []).find((r) => r.name === selected)} onChange={handleRoomChange} onDelete={handleDeleteRoom} />
        </div>
      </div>

      {/* Versions modal / panel */}
      {versionsOpen && (
        <div style={{
          position: 
          "fixed", left: 20, right: 20, top: 40, bottom: 40,
          background: "rgba(255,255,255,0.98)", border: "1px solid #ccc", borderRadius: 8, padding: 20, overflow: "auto", zIndex: 9999
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3>Versions for project {projectId}</h3>
            <div>
              
            <button onClick={() => { setVersionsOpen(false); setPreviewingVersion(null); setCompareMode(false); }} style={{ marginRight: 8 }} className="px-2 py-1 bg-gray-200 rounded">Close</button>
              <button onClick={cancelPreview} className="px-2 py-1 bg-gray-200 rounded">Reload Current</button>
            </div>
          </div>

          {loadingVersions ?
          <div>Loading versions...</div> : (
            <div style={{ display: "grid", gap: 12 }}>
              {/* Versions list */}
              <div>
                {versionsList.length === 0 ? <div>No versions found.</div> : (
                  <div style={{ display: "grid", gap: 8 
                  }}>
                    {versionsList.map((v) => (
                      <div key={v.version} style={{ border: "1px solid #ddd", padding: 8, borderRadius: 6, display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 120, height: 80, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
 
                          {v.thumbnail ? (
                            <img src={`/projects/${projectId}/versions/${v.version}/thumbnail`} alt="thumb" style={{ maxWidth: "100%", maxHeight: "100%" }} onError={(e)=>{e.target.onerror=null; e.target.src="/favicon.ico"}} />
                          ) : <div style={{ fontSize: 12, color: "#666" 
                          }}>No thumb</div>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{v.name ||
                          "Version"}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>Version id: {v.version}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>Created: {v.created}</div>
                        </div>
         
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => previewVersion(v.version)} className="px-2 py-1 bg-blue-600 text-white rounded">Preview</button>
                          <button onClick={() => rollbackVersion(v.version)} className="px-2 py-1 bg-red-600 text-white rounded">Rollback</button>
                          <button onClick={() => revertToVersion(v.version)} className="px-2 py-1 bg-red-600 text-white rounded">Revert</button>
                          </div>
                      </div>
                    ))}
                  </div>
                )}
           
            </div>

              {/* Compare controls */}
              <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
                <h4>Compare Versions</h4>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
               
                <select value={compareLeftId || ""} onChange={(e) => setCompareLeftId(e.target.value)} className="border p-1 rounded">
                    <option value="">Select left version</option>
                    {versionsList.map((v) => <option key={v.version} value={v.version}>{v.version} • {v.created}</option>)}
                  </select>
                  <button onClick={() => { if (!compareLeftId || !compareRightId) return; swapCompareSides(); }} className="px-2 py-1 bg-gray-200 rounded">Swap</button>
                  <select value={compareRightId ||
                  ""} onChange={(e) => setCompareRightId(e.target.value)} className="border p-1 rounded">
                    <option value="">Select right version</option>
                    {versionsList.map((v) => <option key={v.version} value={v.version}>{v.version} • {v.created}</option>)}
                  </select>
                  <button onClick={() => runCompare(compareLeftId, compareRightId)} className="px-3 py-1 bg-indigo-600 text-white 
                  rounded" disabled={loadingCompare}>Compare</button>
                  <button onClick={() => { setCompareMode(false);
                  setCompareLeftLayout(null); setCompareRightLayout(null); setCompareDiff(null); }} className="px-3 py-1 bg-gray-200 rounded">Clear</button>
                </div>

                {loadingCompare && <div>Computing diff...</div>}

                {/* Compare view */}
                {compareMode && compareDiff && (
                  <div 
                  style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Left: {compareLeftId}</div>
            
                        <div style={{ border: "1px solid #ddd", padding: 8, borderRadius: 6 }}>
                          <ThreeDViewer layout={compareLeftLayout || { rooms: [] }} selectedRoomName={null} />
                        </div>
                    
                    </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Right: {compareRightId}</div>
                        <div style={{ border: "1px solid #ddd", padding: 8, borderRadius: 6 }}>
       
                          <ThreeDViewer layout={compareRightLayout ||
                          { rooms: [] }} selectedRoomName={null} />
                        </div>
                      </div>
                    </div>

                    {/* diff summary */}
      
                    <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8 }}>
                      <h5>Diff summary</h5>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 
                        1 }}>
                          <div style={{ fontWeight: 600 }}>Added in Right</div>
                          {compareDiff.added.length === 0 ?
                          <div style={{ color: "#666" }}>none</div> : compareDiff.added.map((r) => (
                            <div key={r.name} style={{ padding: 6, border: "1px solid #e6f4ea", background: "#f3fff6", marginTop: 6, borderRadius: 4 }}>
                              <div style={{ fontWeight: 600 }}>{r.name}</div>
               
                              <div style={{ fontSize: 12 }}>size: {r.size} • x: {r.x} • y: {r.y}</div>
                            </div>
                          ))}
                    
                      </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>Removed from Right</div>
                          {compareDiff.removed.length === 0 ?
                          <div style={{ color: "#666" }}>none</div> : compareDiff.removed.map((r) => (
                            <div key={r.name} style={{ padding: 6, border: "1px solid #fff0f0", background: "#fff7f7", marginTop: 6, borderRadius: 4 }}>
                              <div style={{ fontWeight: 600 }}>{r.name}</div>
               
                              <div style={{ fontSize: 12 }}>size: {r.size} • x: {r.x} • y: {r.y}</div>
                            </div>
                          ))}
                    
                      </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>Modified</div>
                          {compareDiff.modified.length === 0 ?
                          <div style={{ color: "#666" }}>none</div> : compareDiff.modified.map((m) => (
                            <div key={m.name} style={{ padding: 6, border: "1px solid #eee", background: "#fff", marginTop: 6, borderRadius: 4 }}>
                              <div style={{ fontWeight: 600 }}>{m.name}</div>
               
                              <div style={{ fontSize: 12 }}>
                                {Object.entries(m.changes).map(([k, [a, b]]) => (
                                  <div key={k}><strong>{k}:</strong> {String(a)} → {String(b)}</div>
       
                               ))}
                              </div>
                            </div>
                 
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
               
                          <button onClick={() => downloadDiffJSON()} className="px-3 py-1 bg-gray-200 rounded">Download diff JSON</button>
                        <button onClick={() => { if (compareLeftId) previewVersion(compareLeftId);
                        }} className="px-3 py-1 bg-blue-600 text-white rounded">Open Left in Editor</button>
                        <button onClick={() => { if (compareRightId) previewVersion(compareRightId);
                        }} className="px-3 py-1 bg-blue-600 text-white rounded">Open Right in Editor</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
  
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* AddRoomForm nested component */
function AddRoomForm({ onAdd }) {
  const [name, setName] = React.useState("");
  const [size, setSize] = React.useState(3);
  const [x, setX] = React.useState(0);
  const [y, setY] = React.useState(0);

  const submit = (e) => {
    e.preventDefault();
    const room = { name: name || "Room", size: Number(size) || 3, x: Number(x) || 0, y: Number(y) ||
    0 };
    onAdd && onAdd(room);
    setName("");
    setSize(3);
    setX(0);
    setY(0);
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <input placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} className="border p-1 w-full" />
      <input placeholder="Size" value={size} onChange={(e) => setSize(e.target.value)} className="border p-1 w-full" />
      <div className="flex gap-2">
        <input placeholder="X" value={x} onChange={(e) => setX(e.target.value)} className="border p-1 w-1/2" />
        <input placeholder="Y" value={y} onChange={(e) => setY(e.target.value)} className="border p-1 w-1/2" />
      </div>
      <button className="px-3 py-1 bg-green-600 text-white rounded" type="submit">Add Room</button>
 
    </form>
  );
}