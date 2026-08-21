"""수정된 to_ratio() 로 9:16 결과를 뽑는다."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image

from src.ai_engine.image_gen import aspect

IMAGE_DIR = Path.home() / "normal"
OUT_DIR = Path.home() / "normal_final"

OUT_DIR.mkdir(exist_ok=True)

print(f"\n{'file':<26}{'mode':>10}")
for path in sorted(IMAGE_DIR.glob("*.jpg")):
    img = Image.open(path).convert("RGB")
    out, mode = aspect.to_ratio(img, "9:16")
    out.save(OUT_DIR / f"{path.stem}_{mode}.jpg", quality=95)
    print(f"{path.stem:<26}{mode:>10}")

print(f"\n저장: {OUT_DIR}")
