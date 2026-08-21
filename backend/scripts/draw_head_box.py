"""머리 박스 육안 확인.

measure_916_fallback.py 의 판정이 맞는지 눈으로 본다.
머리 박스(빨강)와 9:16 크롭 창(파랑)을 그려 저장한다.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageDraw

from src.ai_engine.image_gen import aspect

IMAGE_DIR = Path.home() / "normal"
OUT_DIR = Path.home() / "normal_headbox"
TARGET = 9 / 16

OUT_DIR.mkdir(exist_ok=True)

for path in sorted(IMAGE_DIR.glob("*.jpg")):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    cw = int(h * TARGET) if w / h > TARGET else w

    hb = aspect.get_head_box(img)
    if hb is None:
        continue

    hx0, hy0, hx1, hy1 = hb
    # to_ratio() 와 같은 창 위치 계산
    cx = (hx0 + hx1) // 2
    x0 = max(0, min(min(max(cx - cw // 2, 0), hx0), w - cw))

    d = ImageDraw.Draw(img)
    d.rectangle([hx0, hy0, hx1, hy1], outline=(255, 0, 0), width=8)
    d.rectangle([x0, 0, x0 + cw - 1, h - 1], outline=(0, 128, 255), width=8)
    img.save(OUT_DIR / path.name)

print(f"저장: {OUT_DIR}")
