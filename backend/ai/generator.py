# backend/ai/generator.py
from typing import Dict, Any, List

def generate_layout(description: str, mood: str, bedrooms: int) -> Dict[str, Any]:
    sizes = {"living": 5.0, "kitchen": 3.5, "bed": 3.5, "bath": 2.0}
    rooms: List[Dict[str, Any]] = []

    rooms.append({"name": "Living Room", "size": sizes["living"], "x": 0.0, "y": 0.0})
    rooms.append({"name": "Kitchen", "size": sizes["kitchen"], "x": sizes["living"], "y": 0.0})

    for i in range(max(1, int(bedrooms))):
        y = (i + 1) * (sizes["bed"] + 0.5)
        rooms.append({"name": f"Bedroom {i+1}", "size": sizes["bed"], "x": 0.0, "y": y})
        rooms.append({"name": f"Bathroom {i+1}", "size": sizes["bath"], "x": sizes["bed"] + 0.5, "y": y})

    notes = []
    d = (description or "").lower()
    m = (mood or "").lower()
    if "eco" in m or "eco" in d or "green" in d:
        notes.append("Suggest solar panels / green roof")
    if "modern" in m or "modern" in d:
        notes.append("Open-plan living, large windows")
    if "cozy" in m or "cozy" in d:
        notes.append("Fireplace or warm lighting")

    return {"rooms": rooms, "meta": {"description": description, "mood": mood, "bedrooms": bedrooms, "notes": notes}}
