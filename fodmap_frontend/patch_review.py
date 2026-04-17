#!/usr/bin/env python3
"""Apply all corrections, duplicate removals, inconsistency fixes, and additions from the review."""

import json, pathlib

path = pathlib.Path(__file__).parent / "fodmap_data.json"
data = json.loads(path.read_text(encoding="utf-8"))
foods = data["foods"]

# ── Helper ──
def find(name):
    for f in foods:
        if f["name"] == name:
            return f
    return None

# ═══════════════════════════════════════════
# 1. CORRECTIONS
# ═══════════════════════════════════════════

# Honeydew melon → High
f = find("Honeydew melon")
if f:
    f["fodmap_content"] = "High"
    f["serving_size"] = "1/2 cup"
    f["fodmap_type"] = "Fructose"
    f["notes"] = "Honeydew is high in excess fructose. Despite being a melon, it is not safe like cantaloupe."
    f["swap"] = "Cantaloupe or strawberries"

# Blackberries → Low at small serving; add High entry for large
f = find("Blackberries")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "40g (~5 berries)"
    f["fodmap_type"] = "—"
    f["notes"] = "Low at up to 40g. Larger servings become moderate to high."
    f["swap"] = ""
    # Add high entry
    foods.append({
        "name": "Blackberries (large serving)",
        "category": "Fruit",
        "fodmap_content": "High",
        "serving_size": "over 40g",
        "fodmap_type": "Polyols",
        "notes": "",
        "swap": ""
    })

# Rum → Low
f = find("Rum")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "1 standard drink"
    f["notes"] = "Pure distilled spirits are FODMAP-free. Same as gin, vodka, whiskey."
    f["swap"] = ""

# Greek yogurt → fix serving size
f = find("Greek yogurt (plain)")
if f:
    f["serving_size"] = "3/4 cup (~200g)"
    f["notes"] = "Straining removes most lactose; full-fat plain is best. Low at a generous serving. Avoid flavoured varieties."

# Coconut water → add warning
f = find("Coconut water")
if f:
    f["fodmap_type"] = "Polyols"
    f["notes"] = "Contains sorbitol; even 100ml may bother sensitive individuals. Use caution."

# Taro → Low
f = find("Taro")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "1/2 cup (75g)"
    f["notes"] = ""

# Cauliflower → Low at small serving, note about larger
f = find("Cauliflower")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "1/2 cup florets (~65g)"
    f["fodmap_type"] = "Fructans, Polyols"
    f["notes"] = "Low at 1/2 cup of florets. A full cup or more is High in fructans and mannitol."
    f["swap"] = "Broccoli or zucchini"
    # Add high entry
    foods.append({
        "name": "Cauliflower (large serving)",
        "category": "Vegetables & Legumes",
        "fodmap_content": "High",
        "serving_size": "over 1 cup",
        "fodmap_type": "Fructans, Polyols",
        "notes": "",
        "swap": ""
    })

# Kombucha → Low at small serve
f = find("Kombucha")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "180ml (~6 oz)"
    f["notes"] = "Low at up to 180ml. Larger serves become High due to fructose from fermentation."
    # Add high entry
    foods.append({
        "name": "Kombucha (large serving)",
        "category": "Drinks",
        "fodmap_content": "High",
        "serving_size": "over 180ml",
        "fodmap_type": "Fructose",
        "notes": "",
        "swap": ""
    })

# ═══════════════════════════════════════════
# 2. REMOVE DUPLICATES
# ═══════════════════════════════════════════

remove_names = [
    "Raspberry",                    # keep "Raspberries"
    "Garlic-infused oil (cooking)", # keep "Garlic-infused oil" in Condiments
    "Tahini (hulled)",              # keep "Tahini" in Condiments
    "Vinegar (apple cider)",        # keep "Vinegar (white/apple cider)" — we'll rename it below
]
foods = [f for f in foods if f["name"] not in remove_names]

# Rename the remaining vinegar entry to be clearer
f = find("Vinegar (white/apple cider)")
if f:
    f["name"] = "Vinegar (white / apple cider)"

# ═══════════════════════════════════════════
# 3. FIX INCONSISTENCIES
# ═══════════════════════════════════════════

# Sweet potato: align serving to 75g
f = find("Sweet potato")
if f:
    f["serving_size"] = "1/2 cup (75g)"
    f["notes"] = "Mannitol content rises with serving size; safe at up to 1/2 cup (75g). A full baked sweet potato is High FODMAP."

# Orange juice (large quantity): align threshold
f = find("Orange juice (large quantity)")
if f:
    f["serving_size"] = "over 1/2 cup (120ml)"

# Sour cream: reclassify as Low with note
f = find("Sour cream")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "2 tbsp (40g)"
    f["fodmap_type"] = "Lactose"
    f["notes"] = "Low at up to 2 tbsp. Larger servings are High due to lactose."
    f["swap"] = ""
    foods.append({
        "name": "Sour cream (large serving)",
        "category": "Dairy",
        "fodmap_content": "High",
        "serving_size": "over 2 tbsp",
        "fodmap_type": "Lactose",
        "notes": "",
        "swap": ""
    })

# Hummus: Low at small serving
f = find("Hummus")
if f:
    f["fodmap_content"] = "Low"
    f["serving_size"] = "2 tbsp (42g)"
    f["fodmap_type"] = "GOS, Fructans"
    f["notes"] = "Low at up to 2 tbsp (42g). Larger servings are High due to chickpea GOS and often garlic."
    f["swap"] = ""
    foods.append({
        "name": "Hummus (large serving)",
        "category": "Condiments & Sweeteners",
        "fodmap_content": "High",
        "serving_size": "over 1/4 cup",
        "fodmap_type": "GOS, Fructans",
        "notes": "",
        "swap": ""
    })

# Kidney beans: clarify — it IS high, the serving shown is the ceiling
f = find("Kidney beans")
if f:
    f["serving_size"] = "any serving"
    f["notes"] = "High FODMAP even at small servings. Canned and rinsed red kidney beans may be tolerated at 1/4 cup by some."

# ═══════════════════════════════════════════
# 4. ADDITIONS
# ═══════════════════════════════════════════

additions = [
    {
        "name": "Chamomile tea",
        "category": "Drinks",
        "fodmap_content": "High",
        "serving_size": "1 cup (strong brew)",
        "fodmap_type": "Fructans",
        "notes": "Chamomile flowers are high in fructans. A common surprise trigger for IBS sufferers.",
        "swap": "Peppermint tea or green tea"
    },
    {
        "name": "Fennel tea",
        "category": "Drinks",
        "fodmap_content": "High",
        "serving_size": "1 cup (strong brew)",
        "fodmap_type": "Fructans",
        "notes": "Made from fennel seeds, which are high in fructans at tea-strength concentration.",
        "swap": "Peppermint tea or ginger tea"
    },
    {
        "name": "Soy milk (from soy protein)",
        "category": "Drinks",
        "fodmap_content": "Low",
        "serving_size": "1 cup (250ml)",
        "fodmap_type": "—",
        "notes": "Soy milk made from soy protein isolate (not whole soy beans) is Low FODMAP. Check the ingredient list.",
        "swap": ""
    },
    {
        "name": "Erythritol",
        "category": "Condiments & Sweeteners",
        "fodmap_content": "Low",
        "serving_size": "up to 1 tsp per sitting",
        "fodmap_type": "—",
        "notes": "The only sugar alcohol considered Low FODMAP. Well absorbed in the small intestine unlike sorbitol/mannitol.",
        "swap": ""
    },
    {
        "name": "Persimmon",
        "category": "Fruit",
        "fodmap_content": "High",
        "serving_size": "1 medium",
        "fodmap_type": "Fructose",
        "notes": "High in excess fructose.",
        "swap": "Orange or kiwi"
    },
    {
        "name": "Coconut cream",
        "category": "Cooking Ingredients",
        "fodmap_content": "Low",
        "serving_size": "1/4 cup (60ml)",
        "fodmap_type": "—",
        "notes": "Low at up to 1/4 cup. Larger amounts used in rich curries may push into moderate territory.",
        "swap": ""
    },
    {
        "name": "Granola",
        "category": "Grains & Bread",
        "fodmap_content": "High",
        "serving_size": "1/2 cup",
        "fodmap_type": "Fructans, GOS",
        "notes": "Most granola contains honey, dried fruit, and wheat — all high FODMAP. Check for low-FODMAP certified brands.",
        "swap": "Rolled oats with safe toppings"
    },
    {
        "name": "Silken tofu",
        "category": "Meat & Protein",
        "fodmap_content": "High",
        "serving_size": "3.5 oz (100g)",
        "fodmap_type": "GOS",
        "notes": "Unlike firm tofu, silken tofu retains most of the GOS from soy beans.",
        "swap": "Firm tofu"
    },
    {
        "name": "Dried cranberries",
        "category": "Fruit",
        "fodmap_content": "High",
        "serving_size": "1/4 cup",
        "fodmap_type": "Fructose",
        "notes": "Concentrated fructose from drying plus often sweetened with apple juice or HFCS.",
        "swap": "Fresh blueberries or strawberries"
    },
    {
        "name": "Sucralose (Splenda)",
        "category": "Condiments & Sweeteners",
        "fodmap_content": "Low",
        "serving_size": "1 packet",
        "fodmap_type": "—",
        "notes": "Artificial sweetener; safe on a low-FODMAP diet. However, some Splenda products contain maltodextrin or other fillers.",
        "swap": ""
    },
]

foods.extend(additions)

# ═══════════════════════════════════════════
# 5. SORT & WRITE
# ═══════════════════════════════════════════

category_order = [
    "Fruit", "Vegetables & Legumes", "Grains & Bread",
    "Fish & Seafood", "Meat & Protein", "Dairy",
    "Nuts & Seeds", "Drinks", "Condiments & Sweeteners",
    "Cooking Ingredients"
]
cat_rank = {c: i for i, c in enumerate(category_order)}
foods.sort(key=lambda f: (cat_rank.get(f["category"], 99), f["name"].lower()))

data["foods"] = foods
path.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")

# Stats
from collections import Counter
counts = Counter(f["fodmap_content"] for f in foods)
print(f"Total foods: {len(foods)}")
for level in ["Low", "Medium", "High"]:
    print(f"  {level}: {counts.get(level, 0)}")
print("Done.")
