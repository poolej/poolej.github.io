#!/usr/bin/env python3

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path("/Users/jpoole/python_practice/codex/poolej.github.io")
SOURCE = ROOT / "emoji-test.txt"
TARGET = ROOT / "emoji-browser" / "emoji-data.js"


def slugify(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def tokenize(*parts: str) -> list[str]:
    joined = " ".join(parts).lower().replace("&", " and ")
    tokens = re.split(r"[^a-z0-9]+", joined)
    return [token for token in tokens if len(token) > 1]


def build() -> None:
    current_group = ""
    current_subgroup = ""
    seen = set()
    emojis = []

    for raw_line in SOURCE.read_text(encoding="utf-8").splitlines():
      line = raw_line.strip()
      if not line:
          continue

      if line.startswith("# group:"):
          current_group = line.split(":", 1)[1].strip()
          continue

      if line.startswith("# subgroup:"):
          current_subgroup = line.split(":", 1)[1].strip()
          continue

      if line.startswith("#"):
          continue

      left, right = line.split("#", 1)
      codepoints_part, status_part = [piece.strip() for piece in left.split(";", 1)]
      if status_part != "fully-qualified":
          continue

      match = re.match(r"\s*(\S+)\s+E[\d.]+\s+(.+)", right)
      if not match:
          continue

      emoji_char = match.group(1)
      name = match.group(2).strip()
      if emoji_char in seen:
          continue

      seen.add(emoji_char)
      emojis.append(
          {
              "id": slugify(name),
              "char": emoji_char,
              "name": name.title(),
              "group": current_group,
              "subgroup": current_subgroup.replace("-", " ").title(),
              "keywords": sorted(set(tokenize(name, current_group, current_subgroup))),
              "codepoints": codepoints_part.lower(),
          }
      )

    payload = {
        "version": "Unicode Emoji 17.0",
        "count": len(emojis),
        "groups": sorted({emoji["group"] for emoji in emojis}),
        "emoji": emojis,
    }

    TARGET.write_text(
        "window.EMOJI_DATASET = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    build()
