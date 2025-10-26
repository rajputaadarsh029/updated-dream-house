# backend/collab.py
import asyncio, json, os, time, logging
from fastapi import WebSocket
from backend.services.versioning import load_project, persist_project_layout, create_version_from_project
from backend.utils.metrics import METRICS

logging.basicConfig(level=logging.INFO)

ROOT = os.path.dirname(__file__)
DATA_DIR = os.path.join(ROOT, "data", "projects")
VERSIONS_DIR = os.path.join(ROOT, "data", "versions")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VERSIONS_DIR, exist_ok=True)

# in-memory rooms: project_id -> room dict
ROOMS = {}
PING_INTERVAL = 20
PING_TIMEOUT = 10
BATCH_INTERVAL = 0.05

async def broadcast_to_room(project_id, message, exclude_ws=None):
    room = ROOMS.get(project_id, {})
    clients = list(room.get("clients", {}).values())
    payload = json.dumps(message)
    for c in clients:
        ws = c.get("ws")
        if ws and ws != exclude_ws:
            try:
                await ws.send_text(payload)
            except Exception:
                # we'll cleanup on next loop
                pass

async def room_batcher(project_id):
    room = ROOMS[project_id]
    while not room.get("_shutdown"):
        await asyncio.sleep(BATCH_INTERVAL)
        q = room.get("_broadcast_queue", [])
        if not q:
            continue
        batch = q.copy()
        room["_broadcast_queue"].clear()
        await broadcast_to_room(project_id, {"type":"ops_batch", "ops": batch})

async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await websocket.accept()
    # basic auth/user id from querystring optional
    qs = websocket.scope.get("query_string", b"").decode()
    params = dict([p.split("=") for p in qs.split("&") if "=" in p]) if qs else {}
    user_id = params.get("user", f"user_{int(time.time()*1000)%10000}")
    username = params.get("username", user_id)

    # ensure room
    if project_id not in ROOMS:
        layout = load_project(project_id) or {"rooms": []}
        ROOMS[project_id] = {"id": project_id, "layout": layout, "clients": {}, "undo_stack": [], "redo_stack": [], "_broadcast_queue": [], "op_count":0}
        # start batcher
        ROOMS[project_id]["_batcher_task"] = asyncio.create_task(room_batcher(project_id))

    room = ROOMS[project_id]
    room["clients"][user_id] = {"ws": websocket, "user_id": user_id, "username": username, "cursor": None, "last_pong": time.time()}
    METRICS["active_connections"] += 1
    logging.info(f"[{project_id}] {username} connected. clients={len(room['clients'])}")
    # broadcast presence
    await broadcast_to_room(project_id, {"type":"presence_update", "clients":[{"user_id":c["user_id"], "username":c["username"]} for c in room["clients"].values()]}, exclude_ws=None)

    # start ping loop
    async def ping_loop():
        try:
            while True:
                await asyncio.sleep(PING_INTERVAL)
                try:
                    await websocket.send_text(json.dumps({"type":"ping","ts": time.time()}))
                except Exception:
                    break
                # timeout check
                last = room["clients"].get(user_id,{}).get("last_pong",0)
                if time.time() - last > (PING_INTERVAL + PING_TIMEOUT):
                    logging.info(f"[{project_id}] client {user_id} timed out, closing")
                    try:
                        await websocket.close()
                    except:
                        pass
                    break
        except asyncio.CancelledError:
            pass

    ping_task = asyncio.create_task(ping_loop())
    try:
        # send initial snapshot
        await websocket.send_text(json.dumps({"type":"snapshot","layout": room["layout"]}))

        async for raw in websocket.iter_text():
            try:
                msg = json.loads(raw)
            except:
                continue
            mtype = msg.get("type")
            # ping/pong
            if mtype == "pong":
                room["clients"][user_id]["last_pong"] = time.time()
                continue
            if mtype == "ping":
                # client ping to server - reply with pong
                await websocket.send_text(json.dumps({"type":"pong","ts":msg.get("ts")}))
                continue

            # operation messages
            if mtype == "op":
                op = msg.get("op")
                op_id = op.get("opId") or f"op_{int(time.time()*1000)}"
                op["opId"] = op_id
                # apply minimal local apply (the real app should have apply_op logic)
                # For example support room:add, room:move, room:delete
                try:
                    apply_op_to_layout(room["layout"], op)
                except Exception as e:
                    logging.exception("apply op failed")
                # push to undo stack
                room["undo_stack"].append(op)
                room["redo_stack"].clear()
                room["op_count"] = room.get("op_count",0) + 1
                METRICS["ops_total"] += 1
                # append to broadcast queue
                room["_broadcast_queue"].append({"type":"op","op":op,"actor":username})
                # immediate ack to sender
                try:
                    await websocket.send_text(json.dumps({"type":"ack","opId": op_id, "status":"persisted", "ts": time.time()}))
                except:
                    pass
                # autosave/trigger snapshot every 20 ops
                if room["op_count"] >= 20:
                    room["op_count"] = 0
                    persist(project_id=project_id, layout=room["layout"])
            elif mtype == "undo_request":
                if room["undo_stack"]:
                    op_to_undo = room["undo_stack"].pop()
                    undo_op_in_layout(room["layout"], op_to_undo)
                    room["redo_stack"].append(op_to_undo)
                    # broadcast full snapshot for simplicity
                    await broadcast_to_room(project_id, {"type":"snapshot","layout":room["layout"]})
                    persist(project_id=project_id, layout=room["layout"])
            elif mtype == "redo_request":
                if room["redo_stack"]:
                    op_to_redo = room["redo_stack"].pop()
                    apply_op_to_layout(room["layout"], op_to_redo)
                    room["undo_stack"].append(op_to_redo)
                    await broadcast_to_room(project_id, {"type":"snapshot","layout":room["layout"]})
                    persist(project_id=project_id, layout=room["layout"])
            elif mtype == "cursor_update":
                room["clients"][user_id]["cursor"] = msg.get("cursor")
                room["clients"][user_id]["last_pong"] = time.time()
                await broadcast_to_room(project_id, {"type":"cursor_broadcast","user_id":user_id,"cursor":msg.get("cursor")}, exclude_ws=websocket)
            elif mtype == "request_versions":
                # list versions
                vers = list_versions_for_project(project_id)
                await websocket.send_text(json.dumps({"type":"versions","versions":vers}))
            elif mtype == "rollback":
                version_id = msg.get("version_id")
                layout = load_version(project_id, version_id)
                if layout is not None:
                    room["layout"] = layout
                    room["undo_stack"].clear()
                    room["redo_stack"].clear()
                    await broadcast_to_room(project_id, {"type":"snapshot","layout":layout})
                    persist(project_id=project_id, layout=layout)
            # else ignore other types
    except Exception as e:
        logging.exception("ws loop error")
    finally:
        ping_task.cancel()
        # cleanup
        try:
            del room["clients"][user_id]
        except:
            pass
        METRICS["active_connections"] = max(0, METRICS["active_connections"] - 1)
        await broadcast_to_room(project_id, {"type":"presence_update", "clients":[{"user_id":c["user_id"], "username":c["username"]} for c in room["clients"].values()]})
        logging.info(f"[{project_id}] {username} disconnected. clients={len(room['clients'])}")

# ----- helpers: minimal op apply/undo, persistence hooks -----
def apply_op_to_layout(layout, op):
    typ = op.get("kind") or op.get("type")
    if typ == "room:add":
        room = op.get("room")
        layout.setdefault("rooms", []).append(room)
    elif typ == "room:move":
        rid = op.get("roomId")
        for r in layout.get("rooms", []):
            if r.get("id") == rid:
                r["x"] = op.get("x", r.get("x"))
                r["y"] = op.get("y", r.get("y"))
    elif typ == "room:delete":
        rid = op.get("roomId")
        layout["rooms"] = [r for r in layout.get("rooms", []) if r.get("id") != rid]
    # add other op kinds as needed

def undo_op_in_layout(layout, op):
    typ = op.get("kind") or op.get("type")
    # implement inverse
    if typ == "room:add":
        # remove last added with matching id
        rid = op.get("room", {}).get("id")
        layout["rooms"] = [r for r in layout.get("rooms", []) if r.get("id") != rid]
    elif typ == "room:move":
        # move must carry previous coords to undo in production; skip for demo
        pass

# persistence wrappers to use versioning
def persist(project_id, layout):
    persist_project_layout(project_id, layout)
    create_version_from_project(project_id, layout)
    METRICS["last_snapshot_ts"] = int(time.time())

# version helpers (we import these functions from services/versioning.py in real usage)
# For list_versions_for_project and load_version we will import from service file.

# we'll import wrappers from service file to avoid circulars
from backend.services.versioning import list_versions_for_project, load_version
