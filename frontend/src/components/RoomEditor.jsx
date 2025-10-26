// src/components/RoomEditor.jsx
import React from "react";

export default function RoomEditor({ room, onChange, onDelete }) {
  if (!room) return <div className="p-3 text-sm">No room selected</div>;

  const handle = (field) => (e) => {
    const val = e.target.value;
    if (field === "name") {
      onChange && onChange({ ...room, name: val });
    } else {
      const num = parseFloat(val);
      onChange && onChange({ ...room, [field]: Number.isFinite(num) ? num : 0 });
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input className="input-coffee w-full mb-2" value={room.name} onChange={handle("name")} />
        </div>

        <div>
          <label className="block text-sm font-medium">Size (m)</label>
          <input className="input-coffee w-full mb-2" value={room.size} onChange={handle("size")} />
        </div>

        <div>
          <label className="block text-sm font-medium">X</label>
          <input className="input-coffee w-full mb-2" value={room.x} onChange={handle("x")} />
        </div>

        <div>
          <label className="block text-sm font-medium">Y</label>
          <input className="input-coffee w-full mb-2" value={room.y} onChange={handle("y")} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
        <div className="small-muted">Last updated: {room.updatedAt || '—'}</div>
        <div>
          <button
            className="btn-soft"
            onClick={() => onDelete && onDelete(room.name)}
          >Delete</button>
        </div>
      </div>
    </div>
  );
}
