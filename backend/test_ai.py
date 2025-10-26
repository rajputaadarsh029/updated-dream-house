# backend/test_ai.py
from ai.generator import generate_layout
import json

if __name__ == "__main__":
    sample = generate_layout("modern 2BHK with garden", "eco", 2)
    print(json.dumps(sample, indent=2))
