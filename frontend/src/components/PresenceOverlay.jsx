import React, { useEffect, useRef } from "react";

export default function PresenceOverlay({ collab, participants = [], enabled = true }) {
  const rootRef = useRef(null);
  const pendingSendRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !enabled) return;

    function onPointerMove(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (e.clientY - rect.top) / Math.max(rect.height, 1);

      if (pendingSendRef.current) {
        pendingSendRef.current.latest = { x, y, screenX: e.clientX, screenY: e.clientY };
        return;
      }
      pendingSendRef.current = { latest: { x, y, screenX: e.clientX, screenY: e.clientY } };
      requestAnimationFrame(() => {
        const payload = pendingSendRef.current.latest;
        try {
          if (collab && typeof collab.send === "function") {
            collab.send({ type: "presence", cursor: payload, meta: {} });
          }
        } catch (err) {
          console.warn("presence send failed", err);
        }
        pendingSendRef.current = null;
      });
    }

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
    };
  }, [collab, enabled]);

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {(participants || []).map((p) => {
        const cursor = p.cursor;
        if (!cursor || typeof cursor.x !== "number" || typeof cursor.y !== "number") return null;
        const left = `${Math.max(0, Math.min(1, cursor.x)) * 100}%`;
        const top = `${Math.max(0, Math.min(1, cursor.y)) * 100}%`;
        const color = p.color || "#2A8BFF";
        const label = p.displayName || p.userId.slice(0, 6);
        return (
          <div
            key={p.userId}
            style={{
              position: "absolute",
              left,
              top,
              transform: "translate(-50%,-120%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              zIndex: 1000,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 10,
                background: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              {label[0]?.toUpperCase() || "U"}
            </div>
            <div
              style={{
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                padding: "4px 6px",
                borderRadius: 6,
                minWidth: 44,
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
