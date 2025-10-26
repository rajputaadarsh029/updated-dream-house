// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { API_BASE } from "../services/api";

export default function Dashboard({ sidebar }) {
  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [mineOnly, setMineOnly] = useState(true);

  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, mineOnly]);

  async function fetchProjects(search = null) {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.q = search;
      if (mineOnly) params.mine = true;

      const res = await api.get("/projects", { params });
      setProjects(res.data.projects || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Failed loading projects", err);
      if (err?.response?.status === 401) {
        alert("Please log in to view your projects");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        navigate("/login");
      } else {
        alert("Failed to load projects. Check backend.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    fetchProjects(q);
  }

  async function handleOpen(project) {
    try {
      const res = await api.get(`/projects/${project.id}`);
      const proj = res.data;
      localStorage.setItem("loadedLayout", JSON.stringify(proj.layout));
      localStorage.setItem("loadedProjectId", proj.id);
      navigate("/editor");
    } catch (err) {
      console.error("Failed to open project", err);
      alert("Failed to open project. Check backend.");
    }
  }

  async function handleDelete(project) {
    const ok = confirm(`Delete project "${project.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await api.delete(`/projects/${project.id}`);
      alert("Deleted");
      fetchProjects(q);
    } catch (err) {
      console.error("Delete failed", err);
      alert(err?.response?.data?.detail || "Delete failed. Check backend logs.");
    }
  }

  async function handleDuplicate(project) {
    try {
      const res = await api.post(`/projects/${project.id}/duplicate`);
      alert("Duplicated: " + res.data.id);
      fetchProjects(q);
    } catch (err) {
      console.error("Duplicate failed", err);
      alert(err?.response?.data?.detail || "Duplicate failed. Check backend logs.");
    }
  }

  function prevPage() {
    if (page > 1) setPage(page - 1);
  }
  function nextPage() {
    if (page * limit < total) setPage(page + 1);
  }

  function handleNewProject() {
    localStorage.removeItem("loadedLayout");
    localStorage.removeItem("loadedProjectId");
    navigate("/editor");
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/login";
  }

  return (
    <div className={sidebar ? "p-0" : "p-6 card"} style={sidebar ? { boxShadow: "none", border: "none", background: "none", height: "100%", margin: 0, maxWidth: '100%' } : {}}>
      {!sidebar && (
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Designs</h1>
          <div className="flex items-center gap-4">
            {username ? (
              <div className="flex items-center gap-2">
                <div className="text-sm">Signed in as <strong>{username}</strong></div>
                <button onClick={handleLogout} className="px-3 py-2 bg-red-600 text-white rounded">Logout</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => navigate("/login")} className="px-3 py-2 bg-blue-600 text-white rounded">Login</button>
                <button onClick={() => navigate("/signup")} className="px-3 py-2 bg-gray-200 rounded">Register</button>
              </div>
            )}
            <button onClick={handleNewProject} className="px-3 py-2 bg-green-600 text-white rounded">+ New Project</button>
          </div>
        </div>
      )}

      <form onSubmit={onSearchSubmit} className="flex gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID..." className="border p-2 rounded w-80" />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Search</button>
        <button type="button" onClick={() => { setQ(""); setPage(1); fetchProjects(null); }} className="px-3 py-2 bg-gray-200 rounded">Reset</button>
        <label className="ml-4 flex items-center gap-2">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          <span className="text-sm">Show only my projects</span>
        </label>
      </form>

      <div className="mb-4 flex items-center justify-between">
        <div><span className="text-sm text-gray-600">Showing {projects.length} of {total} results</span></div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Per page:</label>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="border p-1 rounded">
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="p-4 bg-white rounded shadow">No projects yet. Click "New Project" to start.</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="border rounded shadow bg-white overflow-hidden">
              <div style={{ height: 160, background: "#0f1724", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.thumbnail_url ? (
                  <img
                    src={`${API_BASE}${p.thumbnail_url}`}
                    alt={p.name}
                    style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "cover" }}
                    onError={(e) => { e.target.onerror = null; e.target.src = "/favicon.ico"; }}
                  />
                ) : (
                  <div className="text-white text-sm">No thumbnail</div>
                )}
              </div>
              <div className="p-3">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-gray-500 mb-3">ID: {p.id} {p.owner ? `• by ${p.owner}` : ""}</div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpen(p)} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Open</button>
                  <button onClick={() => handleDuplicate(p)} className="px-2 py-1 bg-yellow-500 text-white rounded text-sm">Duplicate</button>
                  <button onClick={() => handleDelete(p)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div>
          <button onClick={prevPage} disabled={page === 1} className="px-3 py-1 bg-gray-200 rounded mr-2">Prev</button>
          <button onClick={nextPage} disabled={page * limit >= total} className="px-3 py-1 bg-gray-200 rounded">Next</button>
        </div>
        <div className="text-sm text-gray-600">Page {page} • {Math.ceil(total / limit) || 1} total pages</div>
      </div>
    </div>
  );
}
