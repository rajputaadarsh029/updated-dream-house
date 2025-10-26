
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Editor from "src/pages/Editor";
import Login from "src/pages/Login";
import Signup from "src/pages/Signup";
import AuthGate from "src/components/AuthGate";
import Extras from "src/pages/Extras";
import ExtrasSidebar from "src/components/ExtrasSidebar";
import React, { useState } from "react";

export default function App() {
  // Dashboard state removed as it's now buttons
  const [extrasOpen, setExtrasOpen] = useState(false);
  return (
    <BrowserRouter>
      <ExtrasSidebar open={extrasOpen} onClose={() => setExtrasOpen(false)} />
      <div className="app-header p-4 flex items-center justify-between">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="brand-title">DreamHouse</div>
          </Link>
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-50"
              >
                Open Dashboard
              </button>
              <button 
                onClick={() => {
                  const id = prompt("Enter projectId to load:");
                  if (id) {
                    localStorage.setItem("loadedProjectId", id);
                    window.location.href = "/editor";
                  }
                }}
                className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-50"
              >
                Load projectId
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("username");
                  window.location.href = "/login";
                }}
                className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-50"
              >
                Logout
              </button>
              <button 
                onClick={() => alert("Day17 • Projects & Dashboard\n\nHelp: Use the buttons to manage your projects.")}
                className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-50"
              >
                Help
              </button>
            </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {localStorage.getItem('username') ? (
            <>
              <span className="text-sm">Signed in as <strong>{localStorage.getItem('username')}</strong></span>
              <button onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = '/login';
              }} className="btn-soft">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-soft">Login</Link>
              <Link to="/signup" className="btn-coffee">Sign up</Link>
            </>
          )}
        </div>
      </div>

      <main style={{ padding: 20 }}>
        <Routes>
          <Route path="/" element={<AuthGate />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* Dashboard route removed as features are now in header */}
          <Route path="/editor" element={<Editor />} />
          <Route path="/extras" element={<Extras />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
