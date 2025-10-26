import React from "react";
import { Link } from "react-router-dom";

export default function AuthGate() {
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  if (!token) {
    return (
      <div className="p-8 card" style={{ maxWidth: 720, margin: "24px auto" }}>
        <h1 className="brand-title" style={{ fontSize: 28 }}>DreamHouse AI Builder</h1>
        <p className="muted">Design your custom dream house using AI and 3D models.</p>
        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <Link to="/login" className="btn-coffee">Login</Link>
          <Link to="/signup" className="btn-coffee-ghost">Sign up</Link>
        </div>
        <div style={{ marginTop: 12 }} className="small-muted">Please log in to access the editor, dashboard, and extras.</div>
      </div>
    );
  }

  return (
    <div className="p-8 card" style={{ maxWidth: 900, margin: "24px auto" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="brand-title">Welcome back, {username}</h2>
          <div className="small-muted">Choose what you'd like to do next</div>
        </div>
        <div>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('username'); window.location.reload(); }} className="btn-soft">Logout</button>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
        <Link to="/editor" className="btn-coffee">Open Editor</Link>
        <Link to="/dashboard" className="btn-coffee-ghost">Dashboard</Link>
        <Link to="/extras" className="btn-soft">Extras</Link>
      </div>
    </div>
  );
}
