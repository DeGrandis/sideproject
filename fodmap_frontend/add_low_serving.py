"""Add low_serving field to dose-dependent High foods in fodmap_data.json."""
import json, pathlib

path = pathlib.Path(__file__).with_name("fodmap_data.json")
data = json.loads(path.read_text(encoding="utf-8"))

# Map: food name -> low_serving threshold (for High entries that have a safe amount)
LOW_THRESHOLDS = {
    # Paired "(large serving)" entries
    "Avocado (large serving)":          "up to 1/8 whole (30g)",
    "Blackberries (large serving)":     "up to 40g (~5 berries)",
    "Cauliflower (large serving)":      "up to 1/2 cup florets",
    "Sour cream (large serving)":       "up to 2 tbsp (40g)",
    "Hummus (large serving)":           "up to 2 tbsp (42g)",
    "Orange juice (large quantity)":    "up to 1/2 cup (120ml)",
    "Kombucha (large serving)":         "up to 180ml",
    "Beer (more than one bottle)":      "1 bottle",
    "Wine (more than one glass)":       "1 glass",

    # Standalone High entries where serving_size says "over X"
    "Grapefruit":                       "up to 80g (half medium)",
    "Nectarine":                        "up to 1/2 nectarine",
    "Raisins":                          "up to 1 tbsp (13g)",
    "Savoy cabbage":                    "up to 1/2 cup",
    "Red kidney beans":                 "up to 85g (canned, rinsed)",
}

count = 0
for food in data["foods"]:
    name = food["name"]
    if name in LOW_THRESHOLDS:
        food["low_serving"] = LOW_THRESHOLDS[name]
        count += 1

path.write_text(json.dumps(data, indent=8, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Updated {count} entries with low_serving field.")
print(f"Total foods: {len(data['foods'])}")
