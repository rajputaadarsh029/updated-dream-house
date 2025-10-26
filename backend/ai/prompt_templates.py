# backend/ai/prompt_templates.py

FLOORPLAN_SCHEMA_NOTE = """
When you are asked to generate a floorplan, ONLY return valid JSON with the following schema:
{
  "rooms": [
    {"name": "Living Room", "size": 5.0, "x": 0.0, "y": 0.0},
    ...
  ],
  "meta": {"description": "...", "mood": "...", "bedrooms": 3}
}
Sizes are floats (meters). x,y are coordinates on a simple grid.
"""

PROMPT_TEMPLATE = """
You are an assistant that creates simple floorplans.
User request: "{description}"
Mood: "{mood}"
Bedrooms: {bedrooms}

{schema_note}

Return only JSON (no extra text).
""".strip()

def build_prompt(description: str, mood: str, bedrooms: int) -> str:
    return PROMPT_TEMPLATE.format(description=description, mood=mood, bedrooms=bedrooms, schema_note=FLOORPLAN_SCHEMA_NOTE)
