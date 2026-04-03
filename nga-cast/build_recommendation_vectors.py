#!/usr/bin/env python3
import json
from pathlib import Path


SOURCE_JSON = Path("/Users/jpoole/python_practice/codex/chromecast-nga-poc/diptych_ai/painting_vectors.json")
OUTPUT_JSON = Path(__file__).resolve().parent / "taste_vectors.json"


def main():
    source = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    rows = []
    for item in source:
        rows.append(
            {
                "objectId": str(item["object_id"]),
                "medium": item.get("medium", ""),
                "orientation": item.get("orientation", ""),
                "topEmotions": item.get("top_emotions", []),
                "visualVector": item.get("visual_vector"),
                "emotionVector": item.get("emotion_vector"),
                "clipImageVector": item.get("clip_image_vector"),
            }
        )

    OUTPUT_JSON.write_text(json.dumps(rows, ensure_ascii=True), encoding="utf-8")
    print(f"Wrote {len(rows)} recommendation vectors to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
