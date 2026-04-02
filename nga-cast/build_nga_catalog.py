#!/usr/bin/env python3
import csv
import json
from pathlib import Path


SOURCE_ROOT = Path("/Users/jpoole/python_practice/codex/chromecast-nga-poc/data")
OBJECTS_CSV = SOURCE_ROOT / "objects.csv"
IMAGES_CSV = SOURCE_ROOT / "published_images.csv"
OUTPUT_JSON = Path(__file__).resolve().parent / "catalog.json"


def load_objects():
    objects = {}
    with OBJECTS_CSV.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            objects[row["objectid"]] = {
                "title": row["title"],
                "artist": row["attribution"],
                "date": row["displaydate"],
                "classification": row["classification"],
            }
    return objects


def build_catalog():
    objects = load_objects()
    catalog = []

    with IMAGES_CSV.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row["openaccess"] != "1" or row["viewtype"] != "primary":
                continue

            details = objects.get(row["depictstmsobjectid"])
            if not details:
                continue

            try:
                width = int(row["width"] or 0)
                height = int(row["height"] or 0)
            except ValueError:
                width = 0
                height = 0

            catalog.append(
                {
                    "objectId": row["depictstmsobjectid"],
                    "title": details["title"],
                    "artist": details["artist"],
                    "date": details["date"],
                    "classification": details["classification"],
                    "width": width,
                    "height": height,
                    "imageUrl": f"{row['iiifurl']}/full/!1920,1080/0/default.jpg",
                    "credit": "National Gallery of Art",
                    "description": (row.get("assistivetext") or "").strip(),
                }
            )

    catalog.sort(key=lambda item: (item["width"] * item["height"], item["title"]), reverse=True)
    return catalog


def main():
    catalog = build_catalog()
    OUTPUT_JSON.write_text(json.dumps(catalog, ensure_ascii=True), encoding="utf-8")
    print(f"Wrote {len(catalog)} paintings to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
