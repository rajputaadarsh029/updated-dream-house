from fastapi import FastAPI, HTTPException, Query, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from pathlib import Path
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
import json
import uuid
import base64
import shutil
import hashlib
import os
from datetime import datetime
import asyncio
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# Optional Redis async import (for pub/sub across processes)
try:
    import redis.asyncio as aioredis
except Exception:
    aioredis = None

# ---------------------
# Day 21: Metrics and Atomic Write Utilities
# ---------------------
METRICS = {
  "active_connections": 0,
  "ops_total": 0,
  "last_snapshot_ts": 0.0,
  "batches_total": 0,
}

def atomic_write_json(path, obj):
    """Writes JSON content to a path atomically using tempfile + os.replace."""
    import json, tempfile, os
    dirpath = os.path.dirname(path)
    
    # Ensure directory exists before creating temp file
    if not os.path.exists(dirpath):
        os.makedirs(dirpath)
        
    with tempfile.NamedTemporaryFile("w", dir=dirpath, delete=False, encoding="utf-8") as tf:
        json.dump(obj, tf, indent=2)
        tf.flush()
        os.fsync(tf.fileno())
    os.replace(tf.name, path)

    # Update metric for snapshot save
    if path.name.endswith(".json"):
        METRICS["last_snapshot_ts"] = time.time()

# ---------------------
# Day 21: Collaboration Constants
# ---------------------
PING_INTERVAL = 20  # sec
PING_TIMEOUT = 10   # sec
BATCH_INTERVAL = 0.05 # 50ms

app = FastAPI(title="DreamHouse Backend Day21 (Stability + Metrics)")

# CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
OPS_DIR = DATA_DIR / "ops"
VERSIONS_DIR = DATA_DIR / "versions"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
OPS_DIR.mkdir(parents=True, exist_ok=True)
VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

USERS_FILE = DATA_DIR / "users.json"
TOKENS_FILE = DATA_DIR / "tokens.json"

REDIS_URL = os.getenv("REDIS_URL")
REDIS = None
if REDIS_URL and aioredis:
    try:
        REDIS = aioredis.from_url(REDIS_URL, decode_responses=True)
    except Exception as e:
        print("Failed to connect to redis:", e)
        REDIS = None

# ---------------------
# JSON helpers
# ---------------------
def load_json_safe(path: Path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

def write_json_safe(path: Path, data):
    # Day 21: Use atomic write for config files
    atomic_write_json(path, data)

# ---------------------
# Auth helpers
# ---------------------
def hash_password(username: str, password: str) -> str:
    return hashlib.sha256(f"{username}|{password}".encode("utf-8")).hexdigest()

def save_token(token: str, username: str):
    tokens = load_json_safe(TOKENS_FILE)
    tokens[token] = {"username": username, "created": datetime.utcnow().isoformat()}
    write_json_safe(TOKENS_FILE, tokens)

def delete_token(token: str):
    tokens = load_json_safe(TOKENS_FILE)
    if token in tokens:
        del tokens[token]
        write_json_safe(TOKENS_FILE, tokens)

def get_username_for_token(token: str) -> Optional[str]:
    tokens = load_json_safe(TOKENS_FILE)
    info = tokens.get(token)
    return info.get("username") if info else None

def get_user_by_username(username: str) -> Optional[Dict[str,Any]]:
    users = load_json_safe(USERS_FILE)
    return users.get(username)

def create_user(username: str, password: str):
    users = load_json_safe(USERS_FILE)
    if username in users:
        raise ValueError("user exists")
    users[username] = {"password_hash": hash_password(username, password), "created": datetime.utcnow().isoformat()}
    write_json_safe(USERS_FILE, users)

# ---------------------
# Project file helpers
# ---------------------
def save_thumbnail(pid: str, thumbnail_b64: str) -> Optional[str]:
    if not thumbnail_b64:
        return None
    try:
        header, b64 = (thumbnail_b64.split(",", 1) if "," in thumbnail_b64 else ("", thumbnail_b64))
        data = base64.b64decode(b64)
        png_path = PROJECTS_DIR / f"{pid}.png"
        with open(png_path, "wb") as pf:
            pf.write(data)
        return f"{pid}.png"
    
    except Exception as e:
        print("Failed to decode/save thumbnail:", e)
        return None

def write_project_file(pid: str, name: str, layout: Dict[str,Any], owner: Optional[str] = None, thumb_filename: Optional[str] = None):
    out = {"id": pid, "name": name, "layout": layout}
    if owner:
        out["owner"] = owner
    if thumb_filename:
        out["thumbnail"] = thumb_filename
    path = PROJECTS_DIR / f"{pid}.json"
    
    # Day 21: Use atomic write for project file
    atomic_write_json(path, out)
    return out

def _project_file_path(project_id: str) -> Path:
    return PROJECTS_DIR / f"{project_id}.json"

def load_project_layout(project_id: str) -> dict:
    path = _project_file_path(project_id)
    if path.exists():
        try:
            j = load_json_safe(path)
            return j.get("layout", {"rooms": [], "meta": {}})
        except Exception:
            return {"rooms": [], 
"meta": {}}
    return {"rooms": [], "meta": {}}

def persist_project_layout(project_id: str, layout: dict):
    path = _project_file_path(project_id)
    if path.exists():
        try:
            existing = load_json_safe(path)
            name = existing.get("name", project_id)
            owner = existing.get("owner")
        except Exception:
            name = project_id
  
            owner = None
    else:
        name = project_id
        owner = None
    write_project_file(project_id, name, layout, owner=owner, thumb_filename=None)

# ---------------------
# Ops journal helpers (JSONL)
# ---------------------
def append_op_record(project_id: str, record: dict):
    ops_dir = OPS_DIR
    ops_dir.mkdir(parents=True, exist_ok=True)
    fpath = ops_dir / f"{project_id}.log"
    
    # Day 21: Increment total ops metric
    METRICS["ops_total"] += 1
    
    try:
        with open(fpath, "a", encoding="utf-8") as fh:
          
            fh.write(json.dumps(record) + "\n")
    except Exception as e:
        print("Failed to append op record:", e)

def replay_ops(project_id: str) -> list:
    fpath = OPS_DIR / f"{project_id}.log"
    ops = []
    if not fpath.exists():
        return ops
    try:
        with open(fpath, "r", encoding="utf-8") as fh:
            for line in fh:
           
                line = line.strip()
                if not line:
                    continue
                try:
                    ops.append(json.loads(line))
                except Exception:
  
                    continue
    except Exception as e:
        print("Failed to replay ops:", e)
    return ops

# ---------------------
# Version helpers
# ---------------------
def project_json_path(pid: str) -> Path:
    return PROJECTS_DIR / f"{pid}.json"

def project_png_path(pid: str) -> Path:
    return PROJECTS_DIR / f"{pid}.png"

def ensure_versions_dir_for_project(pid: str) -> Path:
    d = VERSIONS_DIR / pid
    d.mkdir(parents=True, exist_ok=True)
    return d

def create_version_from_project(pid: str) -> Optional[str]:
    jpath = project_json_path(pid)
    if not jpath.exists():
        return None
    ver_id = uuid.uuid4().hex
    ver_dir = ensure_versions_dir_for_project(pid)
    
    # Read data safely (should use atomic_read if available, but for consistency)
    data = load_json_safe(jpath)
    
    version_meta = {"id": ver_id, "created": datetime.utcnow().isoformat(), "name": data.get("name")}
    vjson_path = ver_dir / f"{ver_id}.json"
    
    # Day 21: Use atomic write for version files
    atomic_write_json(vjson_path, {"meta": version_meta, "project": data})
    
    png_path = project_png_path(pid)
    if png_path.exists():
  
        shutil.copyfile(png_path, ver_dir / f"{ver_id}.png")
    return ver_id

def list_versions_for_project(pid: str):
    ver_dir = VERSIONS_DIR / pid
    if not ver_dir.exists():
        return []
    items = []
    for f in sorted(ver_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            j = json.loads(f.read_text(encoding="utf-8"))
            meta = j.get("meta", {})
       
            vid = meta.get("id") or f.stem
            created = meta.get("created") or datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            has_thumb = (ver_dir / f"{vid}.png").exists()
            items.append({"version": vid, "created": created, "name": meta.get("name"), "thumbnail": has_thumb})
        except Exception:
            continue
    return items

def get_version_json(pid: str, vid: str):
    vjson = VERSIONS_DIR / pid / f"{vid}.json"
    if not vjson.exists():
        return None
    # Fix: Use load_json_safe for consistency
    return load_json_safe(vjson)

def revert_project_to_version(pid: str, vid: str, owner: Optional[str]=None):
    vjson = VERSIONS_DIR / pid / f"{vid}.json"
    if not vjson.exists():
        return False
    data = load_json_safe(vjson)
    project_data = data.get("project")
    if not project_data:
        return False
    
    # Use write_project_file which handles atomic write
    if owner:
        project_data["owner"] = owner
    write_project_file(pid, project_data.get("name", pid), project_data.get("layout", {}), owner=project_data.get("owner"))

    vthumb = VERSIONS_DIR / pid / f"{vid}.png"
    if vthumb.exists():
        dst = project_png_path(pid)
        shutil.copyfile(vthumb, dst)
    return True

# ---------------------
# Models
# ---------------------
class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class DesignRequest(BaseModel):
    description: Optional[str] = ""
  
    mood: Optional[str] = "cozy"
    bedrooms: Optional[int] = 2

class SaveProjectRequest(BaseModel):
    name: str
    layout: Dict[str, Any]
    thumbnail: Optional[str] = None

# ---------------------
# Auth wrappers
# ---------------------
def username_from_auth_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
        return get_username_for_token(token)
    return None

def require_user(authorization: Optional[str]) -> str:
 
    username = username_from_auth_header(authorization)
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing token")
    return username

# ---------------------
# REST endpoints
# ---------------------
@app.get("/")
def root():
    return {"message": "DreamHouse Backend (Day21) running"}

@app.get("/healthz")
async def healthz():
    ok = {"status": "ok"}
    try:
        if REDIS:
            _ = await REDIS.ping()
            ok["redis"] = "ok"
     
        else:
            ok["redis"] = "disabled"
    except Exception as e:
        ok["redis"] = f"error: {e}"
    return ok

# Day 21: Metrics endpoint
@app.get("/metrics", response_class=PlainTextResponse)
def get_metrics():
    """
    Returns Prometheus-compatible metrics.
    """
    lines = [
      f"# HELP dream_active_connections Number of currently open WebSocket connections.",
      f"# TYPE dream_active_connections gauge",
      f"dream_active_connections {METRICS['active_connections']}",
      
      f"# HELP dream_ops_total Total number of individual operations (op) persisted.",
      f"# TYPE dream_ops_total counter",
      f"dream_ops_total {METRICS['ops_total']}",
      
      f"# HELP dream_batches_total Total number of operation batches broadcast.",
      f"# TYPE dream_batches_total counter",
      f"dream_batches_total {METRICS['batches_total']}",
      
      f"# HELP dream_last_snapshot_ts Timestamp of the last project snapshot/version save.",
      f"# TYPE dream_last_snapshot_ts gauge",
      f"dream_last_snapshot_ts {METRICS['last_snapshot_ts']}",
    ]
    return "\n".join(lines)


@app.post("/register")
def register(req: RegisterRequest):
    uname = req.username.strip()
    pwd = req.password.strip()
    if not uname or not pwd:
        raise HTTPException(status_code=400, detail="username and password required")
    if len(uname) < 3 or len(pwd) < 3:
        raise HTTPException(status_code=400, detail="username and password must be >= 3 chars")
    users = load_json_safe(USERS_FILE)
    if uname in users:
        raise HTTPException(status_code=409, detail="user already exists")
    try:
        create_user(uname, pwd)
    except Exception:
        raise HTTPException(status_code=500, detail="failed to create user")
    return {"status":"ok", "username": uname}

@app.post("/login")
def login(req: LoginRequest):
    uname = req.username.strip()
    pwd = req.password.strip()
    user = get_user_by_username(uname)
    if not user:
       
        raise HTTPException(status_code=401, detail="invalid credentials")
    if user.get("password_hash") != hash_password(uname, pwd):
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = uuid.uuid4().hex
    save_token(token, uname)
    return {"token": token, "username": uname}

@app.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    uname = username_from_auth_header(authorization)
    if not uname:
        raise HTTPException(status_code=401, detail="no token")
    parts = authorization.split()
    if len(parts) == 2:
        token = parts[1]
        
        delete_token(token)
    return {"status":"ok"}

@app.post("/design")
def design(req: DesignRequest):
    sizes = {"living": 5.0, "kitchen": 3.5, "bed": 3.5, "bath": 2.0}
    rooms = []
    rooms.append({"name": "Living Room", "size": sizes["living"], "x": 0.0, "y": 0.0})
    rooms.append({"name": "Kitchen", "size": sizes["kitchen"], "x": sizes["living"] + 0.5, "y": 0.0})
    for i in range(max(1, int(req.bedrooms or 2))):
        y = (i + 1) * (sizes["bed"] + 0.5)
        rooms.append({"name": f"Bedroom {i+1}", "size": sizes["bed"], "x": 0.0, "y": y})
       
        rooms.append({"name": f"Bathroom {i+1}", "size": sizes["bath"], "x": sizes["bed"] + 0.5, "y": y})
    meta = {"description": req.description, "mood": req.mood, "bedrooms": req.bedrooms}
    return {"rooms": rooms, "meta": meta}

@app.get("/projects")
def list_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    q: Optional[str] = Query(None),
    mine: Optional[bool] = Query(False),
    authorization: Optional[str] = Header(None)
):
    files = sorted(PROJECTS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    items = []
    for f in files:
        
        try:
            j = load_json_safe(f)
            pid = j.get("id")
            name = j.get("name")
            owner = j.get("owner")
            if q:
                ql = q.lower()
             
                if not (ql in (name or "").lower() or ql in (pid or "").lower() or ql in json.dumps(j.get("layout", "")).lower()):
                    continue
            items.append({
                "id": pid,
                "name": name,
              
                "owner": owner,
                "thumbnail": (PROJECTS_DIR / f"{pid}.png").exists(),
                "thumbnail_url": f"/projects/{pid}/thumbnail" if (PROJECTS_DIR / f"{pid}.png").exists() else None,
                "updated": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            })
        except Exception:
            continue

    if mine:
        username = username_from_auth_header(authorization)
        if not username:
            raise HTTPException(status_code=401, detail="Unauthorized (mine=true requires login)")
        items = [it for it in items if it.get("owner") == username]

    total = len(items)
    start = (page - 1) * limit
    end = start + limit
    page_items = items[start:end]
    return {"projects": page_items, "page": page, "limit": limit, "total": total}

@app.get("/projects/{project_id}")
def get_project(project_id: str):
 
    path = PROJECTS_DIR / f"{project_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return load_json_safe(path)

@app.get("/projects/{project_id}/thumbnail")
def get_thumbnail(project_id: str):
    png_path = PROJECTS_DIR / f"{project_id}.png"
    if not png_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(path=str(png_path), media_type="image/png", filename=png_path.name)

@app.post("/save-project")
def save_project(req: SaveProjectRequest, authorization: Optional[str] = Header(None)):
    username = require_user(authorization)
    pid = uuid.uuid4().hex
    thumb_name = None
    if req.thumbnail:
      
        thumb_name = save_thumbnail(pid, req.thumbnail)
    out = write_project_file(pid, req.name, req.layout, owner=username, thumb_filename=thumb_name)
    return {"status": "ok", "id": pid}

@app.put("/projects/{project_id}")
def update_project(project_id: str, req: SaveProjectRequest, authorization: Optional[str] = Header(None)):
    username = require_user(authorization)
    path = PROJECTS_DIR / f"{project_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    j = load_json_safe(path)
    owner = j.get("owner")
    if owner != username:
        raise HTTPException(status_code=403, detail="Forbidden: you do not own this project")
  
    create_version_from_project(project_id)
    thumb_name = None
    if req.thumbnail:
        thumb_name = save_thumbnail(project_id, req.thumbnail)
    out = write_project_file(project_id, req.name, req.layout, owner=username, thumb_filename=thumb_name)
    return {"status": "updated", "id": project_id}

@app.delete("/projects/{project_id}")
def delete_project(project_id: str, authorization: Optional[str] = Header(None)):
    username = require_user(authorization)
    jpath = PROJECTS_DIR / f"{project_id}.json"
    if not jpath.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    j = load_json_safe(jpath)
    owner = j.get("owner")
    if owner != username:
 
        raise HTTPException(status_code=403, detail="Forbidden: you do not own this project")
    ppath = PROJECTS_DIR / f"{project_id}.png"
    try:
        jpath.unlink()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Failed to delete json: {e}"})
    if ppath.exists():
        try:
            ppath.unlink()
        except Exception as e:
       
            return JSONResponse(status_code=500, content={"detail": f"Deleted json but failed to delete thumbnail: {e}"})
    return {"status": "deleted", "id": project_id}

@app.post("/projects/{project_id}/duplicate")
def duplicate_project(project_id: str, authorization: Optional[str] = Header(None)):
    username = require_user(authorization)
    src = PROJECTS_DIR / f"{project_id}.json"
    if not src.exists():
        raise HTTPException(status_code=404, detail="Source project not found")
    try:
        j = load_json_safe(src)
        new_id = uuid.uuid4().hex
        name = j.get("name", "") + " (copy)"
        layout = j.get("layout", {})
        thumb_name = None
        src_thumb = PROJECTS_DIR / f"{project_id}.png"
        if src_thumb.exists():
            dst_thumb = PROJECTS_DIR / f"{new_id}.png"
            shutil.copyfile(src_thumb, dst_thumb)
            thumb_name = f"{new_id}.png"
        write_project_file(new_id, name, layout, owner=username, thumb_filename=thumb_name)
   
        return {"status": "duplicated", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to duplicate: {e}")

# ----- Version endpoints -----
@app.get("/projects/{project_id}/versions")
def get_versions(project_id: str):
    items = list_versions_for_project(project_id)
    return {"versions": items}

@app.get("/projects/{project_id}/versions/{version_id}")
def get_version(project_id: str, version_id: str):
    j = get_version_json(project_id, version_id)
    if not j:
        raise HTTPException(status_code=404, detail="Version not found")
    return j

@app.get("/projects/{project_id}/versions/{version_id}/thumbnail")
def get_version_thumbnail(project_id: str, version_id: str):
    vpng = VERSIONS_DIR / project_id / f"{version_id}.png"
    if not vpng.exists():
        raise HTTPException(status_code=404, detail="Version thumbnail not found")
    return FileResponse(path=str(vpng), media_type="image/png", filename=vpng.name)

@app.post("/projects/{project_id}/versions/{version_id}/revert")
def revert_version(project_id: str, version_id: str, authorization: Optional[str] = Header(None)):
    username = require_user(authorization)
    jpath = PROJECTS_DIR / f"{project_id}.json"
    if not jpath.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    j = load_json_safe(jpath)
    owner = j.get("owner")
    if owner != username:
        raise HTTPException(status_code=403, detail="Forbidden: not your project")
    ok = revert_project_to_version(project_id, 
        version_id, owner=username)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to revert to version")
    return {"status": "reverted", "id": project_id, "version": version_id}

@app.post("/projects/{project_id}/undo")
async def undo_project_op(project_id: str):
    room = PROJECT_ROOMS.get(project_id)
    if not room or not room.get("undo_stack"):
        raise HTTPException(status_code=400, detail="Nothing to undo")
    
    async with room["lock"]:
        op_to_undo = room["undo_stack"].pop()
        room.setdefault("redo_stack", []).append(op_to_undo)
        rebuild_layout_from_ops(project_id, room)
 
        persist_project_layout(project_id, room["layout"])
        logging.info(f"[{project_id}] REST API triggered undo for op: {op_to_undo.get('opId')}")
        
    undo_msg = {"type": "undo", "opId": op_to_undo.get("opId"), "from": "server", "ts": datetime.utcnow().isoformat()}
    await _redis_publish(project_id, undo_msg)
    return {"status": "ok", "undone_op": op_to_undo}

@app.post("/projects/{project_id}/redo")
async def redo_project_op(project_id: str):
    room = PROJECT_ROOMS.get(project_id)
    if not room or not room.get("redo_stack"):
        raise HTTPException(status_code=400, detail="Nothing to redo")
    
    async with room["lock"]:
  
        op_to_redo = room["redo_stack"].pop()
        apply_op_to_layout(room["layout"], op_to_redo.get("op"))
        room.setdefault("undo_stack", []).append(op_to_redo)
        persist_project_layout(project_id, room["layout"])
        logging.info(f"[{project_id}] REST API triggered redo for op: {op_to_redo.get('opId')}")
    
    redo_msg = {"type": "redo", "opId": op_to_redo.get("opId"), "from": "server", "ts": datetime.utcnow().isoformat()}
    await _redis_publish(project_id, redo_msg)
    return {"status": "ok", "redone_op": op_to_redo}

# Day 20: New Rollback Endpoint
@app.post("/projects/{project_id}/rollback/{version_id}")
async def rollback_project(project_id: str, version_id: str):
    j = get_version_json(project_id, version_id)
  
    if not j or not j.get("project"):
        raise HTTPException(status_code=404, detail="Version not found")
    
    layout_to_restore = j["project"]["layout"]
    
    room = PROJECT_ROOMS.get(project_id)
    if not room:
        room = get_or_create_room(project_id)

    async with room["lock"]:
        room["layout"] = layout_to_restore
        room["undo_stack"] = []
        room["redo_stack"] = []
        persist_project_layout(project_id, 
            room["layout"])
    
    # Broadcast snapshot to all clients
    snapshot_msg = {
        "type": "snapshot",
        "layout": room["layout"],
        "clients": list(room["clients_meta"].values()),
        "ts": datetime.utcnow().isoformat()
    }
    await _redis_publish(project_id, snapshot_msg)
    return {"status": "ok", "version_id": version_id}

@app.get("/projects/{project_id}/ops/recent")
async def get_recent_ops(project_id: str, count: int = 10):
    ops_path = OPS_DIR / f"{project_id}.log"
    if not ops_path.exists():
      
        return {"ops": []}
    
    ops = []
    with open(ops_path, 'r') as f:
        lines = f.readlines()
        
    for line in lines[-count:]:
        try:
            ops.append(json.loads(line))
        except json.JSONDecodeError:
            continue
            
    
    return {"ops": ops[::-1]}

def rebuild_layout_from_ops(project_id: str, room: dict):
    room["layout"] = {"rooms": [], "meta": {}}
    for op_record in room["undo_stack"]:
        apply_op_to_layout(room["layout"], op_record.get("op"))

# ---------------------
# In-memory rooms for WS (multi-room)
# ---------------------
PROJECT_ROOMS: Dict[str, Dict[str, Any]] = {}
SUBSCRIBE_TASKS: Dict[str, asyncio.Task] = {}
AUTOSAVE_INTERVAL_SECONDS = 30
AUTOSAVE_TASKS = {}

def get_or_create_room(project_id: str) -> Dict[str, Any]:
    if project_id not in PROJECT_ROOMS:
        PROJECT_ROOMS[project_id] = {
            # Day 21: Change connections from set to dict for heartbeat tracking
            "connections": {}, # Key: user_id, Value: {"ws": websocket, "last_pong": time.time()}
         
            "clients_meta": {},
            "layout": load_project_layout(project_id),
            "lock": asyncio.Lock(),
            "undo_stack": replay_ops(project_id),
            "redo_stack": [],
            "last_saved_at": time.time(),
            # Day 21: Batch buffer
            "_broadcast_queue": [], 
            "_batcher_task": None,
            "id": project_id # Added for batcher loop reference
        }
        # Day 21: Start batcher task if it's not running
        room = PROJECT_ROOMS[project_id]
        if not room["_batcher_task"]:
            room["_batcher_task"] = asyncio.create_task(batcher_loop(room))
    return PROJECT_ROOMS[project_id]

# Day 21: Batcher loop (defined here for scope)
async def batcher_loop(room: dict):
    project_id = room["id"]
    try:
        while True:
            await asyncio.sleep(BATCH_INTERVAL)
            
            if not room.get("_broadcast_queue"):
                continue
            
            to_send = room["_broadcast_queue"].copy()
            room["_broadcast_queue"].clear()
            
            if not to_send:
                continue

            batch_msg = {"type":"ops_batch","ops": to_send, "ts": datetime.utcnow().isoformat()}
            
            # Broadcast aggregated ops via Redis
            await _redis_publish(project_id, batch_msg)
            
            METRICS["batches_total"] += 1

    except asyncio.CancelledError:
        logging.info(f"[{project_id}] Batcher loop cancelled.")
    except Exception as e:
        logging.error(f"[{project_id}] Batcher loop error: {e}")
    finally:
        room["_batcher_task"] = None


# ---------------------
# Apply op to layout
# ---------------------
def apply_op_to_layout(layout: dict, op: dict) -> None:
    if not layout:
        layout = {"rooms": [], "meta": {}}
    kind = op.get("kind")
    if kind == "room:add":
        room = op.get("room", {})
        if not any(r.get("name") == room.get("name") for r in layout.get("rooms", [])):
            layout.setdefault("rooms", []).append(room)
    elif kind == "room:remove":
        name = op.get("name")
        layout["rooms"] = [r for r in layout.get("rooms", []) 
            if r.get("name") != name]
    elif kind == "room:update":
        updated = op.get("room", {})
        name = updated.get("name")
        if not name:
            return
        found = False
        for i, r in enumerate(layout.get("rooms", [])):
            if r.get("name") == name:
         
                new_room = dict(r)
                for k, v in updated.items():
                    new_room[k] = v
                layout["rooms"][i] = new_room
                found = True
             
                break
        if not found:
            layout.setdefault("rooms", []).append(updated)

# ---------------------
# Redis pub/sub subscriber loop
# ---------------------
async def _redis_subscriber_loop(project_id: str):
    if not REDIS:
        return
    channel = f"project:{project_id}"
    pubsub = REDIS.pubsub()
    await pubsub.subscribe(channel)
    try:
        while True:
            try:
         
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg.get("type") == "message":
                    data_raw = msg.get("data")
                    try:
                        data = json.loads(data_raw)
                    except Exception:
                        continue
                    room = PROJECT_ROOMS.get(project_id)
                    if not room:
           
                        continue
                    stale = []
                    
                    # Day 21: Iterate over connection values (websockets)
                    for client_data in list(room["connections"].values()):
                        try:
                  
                            await client_data["ws"].send_json(data)
                        except Exception:
                            # Use user_id to identify stale connections
                            stale.append(client_data["ws"])
                            
                    # Cleanup logic is primarily handled by ping loop/finally block

                await asyncio.sleep(0.01)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(0.1)
    finally:
        try:
 
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            await pubsub.close()
        except Exception:
            pass

async def _redis_publish(project_id: str, message: dict):
    if not REDIS:
        return
    channel = f"project:{project_id}"
    try:
        await REDIS.publish(channel, json.dumps(message))
    except Exception as e:
        print("redis publish failed:", e)

# ---------------------
# Day 20: Autosave Loop
# ---------------------
async def _autosave_loop(project_id: str):
    room = PROJECT_ROOMS.get(project_id)
    if not room:
        return
    
    while True:
        await asyncio.sleep(AUTOSAVE_INTERVAL_SECONDS)
        now = time.time()
        
   
        if len(room["connections"]) > 0:
            async with room["lock"]:
                if now - room.get("last_saved_at", now) >= AUTOSAVE_INTERVAL_SECONDS:
                    try:
                        persist_project_layout(project_id, room["layout"])
           
                        create_version_from_project(project_id)
                        room["last_saved_at"] = now
                        logging.info(f"[{project_id}] Autosaved project and created version.")
                    except Exception as e:
         
                        logging.error(f"[{project_id}] Failed to autosave: {e}")
                    
                    # Broadcast confirmation
                    try:
                   
                        await _redis_publish(project_id, {"type": "autosave_confirm", "ts": datetime.utcnow().isoformat()})
                    except Exception:
                        pass
        else:
            # If no connections, no need to keep the autosave loop running
            break
  
           

# ---------------------
# Day16: Presence cleanup loop and settings
# ---------------------
PRESENCE_TTL = 30
PRESENCE_CLEAN_INTERVAL = 5

async def _presence_cleanup_loop():
    try:
        while True:
            now_ts = datetime.utcnow().timestamp()
            for project_id, room in list(PROJECT_ROOMS.items()):
                to_remove: List[str] = []
              
                for uid, meta in list(room["clients_meta"].items()):
                    try:
                        last_seen = float(meta.get("lastSeen", 0))
                    except Exception:
                        last_seen = 0
                    if (now_ts - last_seen) > PRESENCE_TTL:
                        to_remove.append(uid)

                if to_remove:
                    for uid in to_remove:
           
                        room["clients_meta"].pop(uid, None)
                        left_msg = {"type": "left", "userId": uid, "ts": datetime.utcnow().isoformat()}
                        
                        # Day 21: Iterate over connection values (websockets)
                        for client_data in list(room["connections"].values()):
                            try:
  
                                await client_data["ws"].send_json(left_msg)
                            except Exception:
                                # Connection error will be handled by ping loop / finally block
                                pass
                        
                        try:
                            await _redis_publish(project_id, left_msg)
                        except Exception:
                            pass
            await asyncio.sleep(PRESENCE_CLEAN_INTERVAL)
    except asyncio.CancelledError:
        return

@app.on_event("startup")
async def _startup_tasks():
    app.state._presence_cleanup_task = asyncio.create_task(_presence_cleanup_loop())

@app.on_event("shutdown")
async def _shutdown_tasks():
    task = getattr(app.state, "_presence_cleanup_task", None)
    if task:
        task.cancel()
        try:
            await task
        except Exception:
            pass
    for task in AUTOSAVE_TASKS.values():
        task.cancel()
    
        try:
            await task
        except Exception:
            pass
    
    # Day 21: Cancel batcher tasks on shutdown
    for room in PROJECT_ROOMS.values():
        if room.get("_batcher_task"):
            room["_batcher_task"].cancel()
            try:
                await room["_batcher_task"]
            except Exception:
                pass


# ---------------------
# WebSocket endpoint for projects
# ---------------------
MAX_OP_SIZE = 10_000
@app.websocket("/ws/projects/{project_id}")
async def project_ws(websocket: WebSocket, project_id: str, token: Optional[str] = Query(None)):
    await websocket.accept()
    room = get_or_create_room(project_id)

    # Day 21: Metrics: increment active connections
    METRICS["active_connections"] += 1
    
    if REDIS and project_id not in SUBSCRIBE_TASKS:
        SUBSCRIBE_TASKS[project_id] = asyncio.create_task(_redis_subscriber_loop(project_id))
    
    # Day 20: Start autosave loop if it's not already running
    if project_id not in AUTOSAVE_TASKS:
        AUTOSAVE_TASKS[project_id] = asyncio.create_task(_autosave_loop(project_id))

    username = None
    if token:
        username = get_username_for_token(token)
    user_id = username or str(uuid.uuid4())
    display_name = username or f"Guest-{user_id[:6]}"

    # Day 21: Initialize client connection data with last_pong
    room["connections"][user_id] = {"ws": websocket, "last_pong": time.time()}

    room["clients_meta"][user_id] = {
        "userId": user_id,
        "displayName": display_name,
        "joinedAt": datetime.utcnow().isoformat(),
    
        "lastSeen": datetime.utcnow().timestamp(),
    }

    try:
        # Client list is from clients_meta (presence tracking)
        await websocket.send_json({"type": "snapshot", "layout": room["layout"], "clients": list(room["clients_meta"].values()), "ts": datetime.utcnow().isoformat()})
    except Exception as ex:
        print("Failed to send snapshot:", ex)
    
    # Day 21: Ping Loop (Heartbeat)
    async def ping_loop():
        try:
            while True:
                await asyncio.sleep(PING_INTERVAL)
                try:
                    await websocket.send_json({"type":"ping", "ts": time.time()})
                except Exception:
                    logging.warning(f"[{project_id}] Failed to send ping to {user_id}, closing ws")
                    break
                
                last_pong = room["connections"].get(user_id, {}).get("last_pong", 0)
                if time.time() - last_pong > (PING_INTERVAL + PING_TIMEOUT):
                    logging.info(f"[{project_id}] Client {user_id} timed out (no pong received)")
                    await websocket.close()
                    break
        except asyncio.CancelledError:
            pass

    ping_task = asyncio.create_task(ping_loop())
    
    join_msg = {"type": "joined", "userId": user_id, "displayName": display_name, "ts": datetime.utcnow().isoformat()}
    
    # Day 21: Broadcast to other clients (non-stale logic relies on ping loop / finally block)
    for client_data in list(room["connections"].values()):
        if client_data["ws"] is websocket:
            continue
        try:
            await client_data["ws"].send_json(join_msg)
        except Exception:
            pass
            
    try:
        await _redis_publish(project_id, join_msg)
    except Exception:
        pass

    try:
        while True:
      
            raw = await websocket.receive_text()
            if len(raw) > MAX_OP_SIZE:
                await websocket.send_json({"type":"error","msg":"op too large"})
                continue
            try:
                data = json.loads(raw)
           
            except Exception:
                continue

            mtype = data.get("type")
            if mtype == "pong":
                # Day 21: Update last_pong time
                if user_id in room["connections"]:
                    room["connections"][user_id]["last_pong"] = time.time()

            elif mtype == "ping":
                try:
                    room["clients_meta"].setdefault(user_id, {})["lastSeen"] = datetime.utcnow().timestamp()
              
                except Exception:
                    pass
                await websocket.send_json({"type": "pong", "ts": datetime.utcnow().isoformat()})

            elif mtype == "presence":
                meta = data.get("meta", {})
  
                if meta:
                    try:
                        room["clients_meta"].setdefault(user_id, {}).update(meta)
                    except Exception:
              
                        pass
                room["clients_meta"].setdefault(user_id, {})["lastSeen"] = datetime.utcnow().timestamp()

                
            elif mtype == "cursor_update":
                cursor = data.get("cursor")
                if cursor:
                    room["clients_meta"].setdefault(user_id, {})["cursor"] = cursor
                room["clients_meta"].setdefault(user_id, {})["lastSeen"] = datetime.utcnow().timestamp()
                
                cursor_msg = {"type": "cursor_broadcast", "userId": user_id, "cursor": cursor, "ts": datetime.utcnow().isoformat()}
                
                # Day 21: Broadcast cursor updates
                for client_data in list(room["connections"].values()):
                    if client_data["ws"] is websocket:
                        continue
                    try:
                        await client_data["ws"].send_json(cursor_msg)
                    except Exception:
                        pass # Failure handled by ping loop

                try:
                    await _redis_publish(project_id, cursor_msg)
       
                except Exception:
                    pass

            elif mtype == "op":
                op = data.get("op")
                op_id = data.get("opId") or str(uuid.uuid4())
                ts = data.get("ts") or datetime.utcnow().isoformat()
                op_record = {"opId": op_id, "from": user_id, "ts": ts, "op": op}
                
                logging.info(f"[{project_id}] User {user_id} performed op: {op.get('kind')} id={op_id}")
                
                try:
  
                    append_op_record(project_id, op_record)
                except Exception as ex:
                    print("append op failed:", ex)
                
                async with room["lock"]:
     
                    apply_op_to_layout(room["layout"], op)
                    room.setdefault("undo_stack", []).append(op_record)
                    room["redo_stack"] = []
                    try:
                     
                        persist_project_layout(project_id, room["layout"])
                    except Exception as ex:
                        print("persist failed after op:", ex)
                
                # ACK immediately to sender
                try:
             
                    await websocket.send_json({"type": "ack", "opId": op_id, "status": "persisted", "ts": datetime.utcnow().isoformat()})
                except Exception:
                    pass
                
                # Day 21: Add op to batch queue instead of immediate broadcast
                room.setdefault("_broadcast_queue", []).append(op_record)

            
            elif mtype == "undo_request":
                async with room["lock"]:
                   
                    if not room["undo_stack"]:
                        await websocket.send_json({"type": "error", "msg": "Nothing to undo"})
                        continue
                    op_to_undo = room["undo_stack"].pop()
                    room.setdefault("redo_stack", 
                        []).append(op_to_undo)
                    rebuild_layout_from_ops(project_id, room)
                    persist_project_layout(project_id, room["layout"])
                    logging.info(f"[{project_id}] User {user_id} triggered undo for op: {op_to_undo.get('opId')}")
                
               
                undo_msg = {"type": "undo", "opId": op_to_undo.get("opId"), "from": user_id, "ts": datetime.utcnow().isoformat()}
                await _redis_publish(project_id, undo_msg)

            elif mtype == "redo_request":
                async with room["lock"]:
                    if not room["redo_stack"]:
                 
                        await websocket.send_json({"type": "error", "msg": "Nothing to redo"})
                        continue
                    op_to_redo = room["redo_stack"].pop()
                    apply_op_to_layout(room["layout"], op_to_redo.get("op"))
                    
                    room.setdefault("undo_stack", []).append(op_to_redo)
                    persist_project_layout(project_id, room["layout"])
                    logging.info(f"[{project_id}] User {user_id} triggered redo for op: {op_to_redo.get('opId')}")
                
                redo_msg = {"type": "redo", "opId": op_to_redo.get("opId"), "from": user_id, "ts": datetime.utcnow().isoformat()}
          
                await _redis_publish(project_id, redo_msg)

            elif mtype == "save":
                async with room["lock"]:
                    try:
                        persist_project_layout(project_id, room["layout"])
              
                        await websocket.send_json({"type": "ack", "what": "save", "ts": datetime.utcnow().isoformat()})
                    except Exception as ex:
                        await websocket.send_json({"type": "error", "msg": f"save failed: {ex}"})

            elif mtype == "join":
                
                meta = data.get("meta", {})
                if meta:
                    try:
                        room["clients_meta"].setdefault(user_id, {}).update(meta)
                    except Exception:
              
                        pass
                try:
                    room["clients_meta"].setdefault(user_id, {})["lastSeen"] = datetime.utcnow().timestamp()
                except Exception:
                    pass

            else:
  
                try:
                    await websocket.send_json({"type": "error", "msg": f"unknown type {mtype}"})
                except Exception:
                    pass

    except WebSocketDisconnect:
        pass
    finally:
        # Day 21: Cancel ping task on disconnect
        ping_task.cancel()
        
        # Day 21: Remove client from connections and update metrics
        if user_id in room["connections"]:
            room["connections"].pop(user_id, None)
            METRICS["active_connections"] -= 1

        try:
            room["clients_meta"].pop(user_id, None)
        except Exception:
            pass

        left_msg = {"type": "left", "userId": user_id, "displayName": display_name, "ts": datetime.utcnow().isoformat()}
        
        # Broadcast leave message to remaining clients
        for client_data in list(room["connections"].values()):
            try:
                await client_data["ws"].send_json(left_msg)
            except Exception:
                pass

        try:
            await _redis_publish(project_id, left_msg)
        except Exception:
            pass

        if len(room["connections"]) == 0:
            try:
                persist_project_layout(project_id, room["layout"])
            except Exception as ex:
                print("Failed to persist layout on empty room:", ex)
            
            # Cancel tasks if the room is empty
            if project_id in SUBSCRIBE_TASKS:
                task = SUBSCRIBE_TASKS.pop(project_id, None)
                if task:
                    task.cancel()
            if project_id in AUTOSAVE_TASKS:
                task = AUTOSAVE_TASKS.pop(project_id, None)
                if task:
    
                    try:
                        task.cancel()
                    except Exception:
                        pass
            
            # Day 21: Cancel batcher task if room is empty
            if room.get("_batcher_task"):
                 room["_batcher_task"].cancel()