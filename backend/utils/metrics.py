# backend/utils/metrics.py
from fastapi import APIRouter
router = APIRouter()
METRICS = {
    "active_connections": 0,
    "ops_total": 0,
    "last_snapshot_ts": 0,
}

@router.get("/metrics")
def metrics_text():
    lines = [
        f"dream_active_connections {METRICS['active_connections']}",
        f"dream_ops_total {METRICS['ops_total']}",
        f"dream_last_snapshot_ts {METRICS['last_snapshot_ts']}"
    ]
    return "\n".join(lines)
