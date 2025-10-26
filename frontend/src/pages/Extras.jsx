import React from "react";
import { Link } from "react-router-dom";

export default function Extras({ sidebar }) {
  return (
    <div className={sidebar ? "p-0" : "p-8 card"} style={sidebar ? { boxShadow: "none", border: "none", background: "none", height: "100%", margin: 0, maxWidth: '100%' } : { maxWidth: 900, margin: '24px auto' }}>
      {!sidebar && (
        <>
          <h2 className="section-title">Extras & Tools</h2>
          <p className="muted">Small utilities and experimental features live here.</p>
          <div style={{ marginTop: 12 }}>
            <Link to="/" className="btn-soft">Home</Link>
            <Link to="/editor" className="btn-coffee-ghost" style={{ marginLeft: 8 }}>Go to Editor</Link>
          </div>
        </>
      )}
      {sidebar && (
        <div style={{ padding: 0, height: '100%' }}>
          {/* Sidebar content only, no extra header or margin */}
        </div>
      )}
    </div>
  );
}
