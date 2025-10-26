// src/components/RoomList.jsx
import React from "react";

export default function RoomList({ layout = { rooms: [] }, onSelect }) {
  const rooms = layout.rooms || [];
  if (!rooms.length) return <div className="p-3 card">No rooms yet</div>;

  return (
    <div className="p-3 card max-h-64 overflow-auto">
      <ul className="space-y-2">
        {rooms.map((r, i) => (
          <li key={r.name ?? i} className="flex items-center justify-between border-b pb-2 pt-2 room-item">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="avatar">{(r.name||'R')[0]}</div>
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm small-muted">pos: ({r.x}, {r.y}) • size: {r.size}</div>
              </div>
            </div>
            <div>
              <button onClick={() => onSelect && onSelect(r)} className="btn-coffee">Open</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
