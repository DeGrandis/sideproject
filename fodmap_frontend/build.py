"""
build.py — inject fodmap_data.json into index.html

Usage:
    python build.py                 # reads index.html, writes index.html in-place
    python build.py --check         # verify the target line exists, don't write

The script replaces any line that starts with (ignoring leading whitespace):
    const FOODS_VAR =
with:
    const FOODS_VAR = [...];   (minified JSON array, safe for inline <script>)

This means you can re-run build.py on an already-built index.html and it will
replace the previously injected data with fresh data from fodmap_data.json.
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Matches the declaration line whether it contains [] (stub) or injected data.
MATCH_RE  = re.compile(r'^(\s*)const FOODS_VAR\s*=.*$', re.MULTILINE)
DATE_RE   = re.compile(r'Last updated: [\w ,]+(?=</p>)')
DATA_FILE = Path(__file__).parent / "fodmap_data.json"
HTML_FILE = Path(__file__).parent / "index.html"


def load_foods() -> list:
    with DATA_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    foods = data["foods"]
    if not foods:
        raise ValueError("fodmap_data.json has an empty foods list")
    return foods


def inject(check_only: bool = False) -> None:
    template = HTML_FILE.read_text(encoding="utf-8")

    if not MATCH_RE.search(template):
        print(f"ERROR: 'const FOODS_VAR =' not found in {HTML_FILE}")
        sys.exit(1)

    if check_only:
        print(f"OK: 'const FOODS_VAR =' found in {HTML_FILE}")
        return

    foods = load_foods()
    json_array = json.dumps(foods, ensure_ascii=False, separators=(",", ":"))

    def replacement(m):
        indent = m.group(1)
        return f"{indent}const FOODS_VAR = {json_array};"

    output = MATCH_RE.sub(replacement, template, count=1)

    # Inject build date (EST)
    est = timezone(timedelta(hours=-5))
    build_date = datetime.now(est).strftime("%B %d, %Y")
    output = DATE_RE.sub(f"Last updated: {build_date}", output, count=1)

    # Restore trailing newline if original had one
    if template.endswith("\n") and not output.endswith("\n"):
        output += "\n"

    HTML_FILE.write_text(output, encoding="utf-8")
    print(f"OK: injected {len(foods)} foods into {HTML_FILE}")


if __name__ == "__main__":
    check = "--check" in sys.argv
    inject(check_only=check)
