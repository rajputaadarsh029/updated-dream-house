# backend/services/versioning.py
import os, json, tempfile, time, shutil
ROOT = os.path.dirname(__file__)
DATA_ROOT = os.path.join(ROOT, "..", "data")
PROJECTS_DIR = os.path.join(DATA_ROOT, "projects")
VERSIONS_DIR = os.path.join(DATA_ROOT, "versions")
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(VERSIONS_DIR, exist_ok=True)

def ensure_data_dirs():
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    os.makedirs(VERSIONS_DIR, exist_ok=True)

def atomic_write_json(path, obj):
    dirpath = os.path.dirname(path)
    os.makedirs(dirpath, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=dirpath, delete=False) as tf:
        json.dump(obj, tf)
        tf.flush()
        os.fsync(tf.fileno())
    os.replace(tf.name, path)

def persist_project_layout(project_id, layout):
    path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    atomic_write_json(path, layout)

def load_project(project_id):
    path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)

def create_version_from_project(project_id, layout):
    ts = int(time.time())
    ver_dir = os.path.join(VERSIONS_DIR, project_id)
    os.makedirs(ver_dir, exist_ok=True)
    version_path = os.path.join(ver_dir, f"{ts}.json")
    atomic_write_json(version_path, {"ts": ts, "layout": layout})
    return ts

def list_versions_for_project(project_id):
    ver_dir = os.path.join(VERSIONS_DIR, project_id)
    if not os.path.exists(ver_dir):
        return []
    files = sorted(os.listdir(ver_dir), reverse=True)
    return [{"id": f[:-5], "ts": f[:-5]} for f in files]

def load_version(project_id, version_id):
    path = os.path.join(VERSIONS_DIR, project_id, f"{version_id}.json")
    if not os.path.exists(path):
        return None
    with open(path,"r") as f:
        return json.load(f).get("layout")
