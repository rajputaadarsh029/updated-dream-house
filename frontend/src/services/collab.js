// frontend/src/services/collab.js
// Collab client for Day 21
// - Ping/Pong Heartbeat (Client-side)
// - Op Batching/Buffering

const DEFAULT_WS_HOST = (() => {
  if (typeof window === "undefined") return "ws://localhost:8000";
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss" : "ws";
  const host = loc.hostname;
  return `${proto}://${host}:8000`;
})();

export default class CollabClient {
  constructor({ projectId, token = null, onSnapshot, onOp, onPresence, onJoined, onLeft, onOpen, onReconnect, onUndo, onRedo, onCursorBroadcast, onAutosaveConfirm }) {
    this.projectId = projectId;
    this.token = token || localStorage.getItem("token") || null;
    this.onSnapshot = onSnapshot || (() => {});
    this.onOp = onOp || (() => {});
    this.onAck = onOp || (() => {});
    this.onPresence = onPresence || (() => {});
    this.onJoined = onJoined || (() => {});
    this.onLeft = onLeft || (() => {});
    this.onOpen = onOpen || (() => {});
    this.onReconnect = onReconnect || (() => {});
    this.onUndo = onUndo || (() => {});
    this.onRedo = onRedo || (() => {});
    this.onCursorBroadcast = onCursorBroadcast || (() => {});
    this.onAutosaveConfirm = onAutosaveConfirm || (() => {});

    this.pending = {};
    this._backoff = 1000;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this.socket = null;

    this.connect();
  }

  _randomId() {
    return Math.random().toString(36).slice(2, 9);
  }

  _buildUrl() {
    const t = encodeURIComponent(this.token || "");
    return `${DEFAULT_WS_HOST}/ws/projects/${this.projectId}?token=${t}`;
  }

  connect() {
    this.close();
    const url = this._buildUrl();
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this._backoff = 1000;
      this._onopen();
      this._sendPending();
    };
    this.socket.onmessage = (event) => this._onmessage(event);
    this.socket.onclose = () => this._scheduleReconnect();
    this.socket.onerror = (e) => {
      console.warn("WS error", e);
      this.socket.close();
    };
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    const delay = Math.min(30000, this._backoff);
    this.onReconnect(delay);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._backoff = Math.min(30000, this._backoff * 1.6);
      this.connect();
    }, delay);
  }

  _onopen() {
    this.onOpen();
    this.send({ type: "join" });
    this._startHeartbeat();
  }

  _onmessage(evt) {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return;
    }
    
    // Day 21: Handle PING/PONG heartbeat
    if (msg.type === "ping") {
        this.send({ type: "pong", ts: msg.ts });
        return;
    }
    
    // Day 21: Handle ops_batch
    if (msg.type === "ops_batch") {
        // Process each op in the batch
        msg.ops.forEach(op_record => {
            this.onOp(op_record);
        });
        return;
    }

    if (msg.type === "ack" && msg.opId && this.pending[msg.opId]) {
      const p = this.pending[msg.opId];
      p.resolve && p.resolve(msg);
      delete this.pending[msg.opId];
      if (this.onAck) {
        this.onAck(msg);
      }
    } else if (msg.type === "snapshot") {
      this.onSnapshot(msg.layout, msg.clients);
    } else if (msg.type === "op") {
      this.onOp(msg);
    } else if (msg.type === "presence") {
      this.onPresence(msg);
    } else if (msg.type === "joined") {
      this.onJoined(msg);
    } else if (msg.type === "left") {
      this.onLeft(msg);
    } else if (msg.type === "pong") {
      // no-op
    } else if (msg.type === "undo") {
        this.onUndo(msg);
    } else if (msg.type === "redo") {
        this.onRedo(msg);
    } else if (msg.type === "error") {
      console.warn("Server error:", msg.msg);
    } 
    else if (msg.type === "cursor_broadcast") {
      this.onCursorBroadcast(msg);
    } else if (msg.type === "autosave_confirm") {
      this.onAutosaveConfirm(msg);
    }
  }

  _sendPending() {
    Object.keys(this.pending).forEach((id) => {
      const p = this.pending[id];
      if (p && this.socket && this.socket.readyState === WebSocket.OPEN) {
        const msg = JSON.stringify({ ...p.op, opId: id });
        this.socket.send(msg);
        p.queued = false;
        p.ts = Date.now();
      }
    });
  }

  sendOp(op) {
    return new Promise((resolve, reject) => {
      const opId = op.opId || ("op_" + this._randomId());
      const message = JSON.stringify({ ...op, opId });
      const attemptSend = () => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(message);
          this.pending[opId] = { op, resolve, reject, ts: Date.now(), retries: 0 };
        } else {
          this.pending[opId] = { op, resolve, reject, ts: Date.now(), queued: true };
          this.connect();
        }
      };
      attemptSend();
    });
  }

  sendUndo() {
    this.send({ type: "undo_request" });
  }

  sendRedo() {
    this.send({ type: "redo_request" });
  }

  sendPresence(meta) {
    this.send({ type: "presence", meta });
  }

  sendCursorUpdate(cursor) {
      this.send({ type: "cursor_update", cursor });
  }

  requestSave() {
    this.send({ type: "save" });
  }

  send(raw) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open, ignoring send:", raw);
      return;
    }
    try {
      this.socket.send(JSON.stringify(raw));
    } catch (e) {
      console.warn("Send failed:", e);
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // Client-side sends ping via the server's ping loop (Day 21)
      }
    }, 20000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  close() {
    try {
      this._stopHeartbeat();
      if (this.socket) {
        this.socket.close();
      }
    } catch (e) {}
    this.socket = null;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}