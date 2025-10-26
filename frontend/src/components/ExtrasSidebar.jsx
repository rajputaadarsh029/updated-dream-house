import React from "react";
import Extras from "../pages/Extras";

export default function ExtrasSidebar({ open, onClose }) {
  return (
    <aside style={{
      position: 'fixed',
      right: open ? 0 : -420,
      top: 0,
      bottom: 0,
      width: 400,
      background: 'var(--card)',
      boxShadow: '-2px 0 16px rgba(0,0,0,0.08)',
      zIndex: 100,
      transition: 'right 0.25s',
      borderLeft: '1px solid #e5e5e5',
      overflowY: 'auto',
      padding: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.2rem', borderBottom: '1px solid #eee' }}>
        <span className="section-title">Extras</span>
        <button onClick={onClose} className="btn-soft" style={{ fontSize: 18, padding: '0 10px' }}>&times;</button>
      </div>
      <div style={{ padding: 0, height: '100%' }}>
        <Extras sidebar />
      </div>
    </aside>
  );
}
