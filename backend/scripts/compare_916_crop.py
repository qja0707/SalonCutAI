"""9:16 처리 3안 비교.

A 현재    fit_pad 고정
B 머리전체 get_head_box() 로 판정 후 크롭
C 턱선위  턱선 아래를 버린 박스로 판정 후 크롭

B·C 는 크롭 창 배치가 같다. 판정 기준만 다르다.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision
from PIL import Image

from src.ai_engine.image_gen import aspect, loader

IMAGE_DIR = Path.home() / "normal"
OUT_DIR = Path.home() / "normal_916"
TARGET = 9 / 16


def head_box_above_chin(img: Image.Image):
    """턱선 위쪽만 본 머리 박스. 얼굴이 없으면 None."""
    arr = np.array(img.convert("RGB"))
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)

    category = np.squeeze(
        loader.get_segmenter().segment(mp_img).category_mask.numpy_view()
    )
    head = category == 1

    result = loader.get_landmarker().detect(mp_img)
    if not result.face_landmarks:
        return None

    w, h = img.size
    lm = result.face_landmarks[0]
    oval = vision.FaceLandmarksConnections.FACE_LANDMARKS_FACE_OVAL
    pts = np.array([[int(lm[c.start].x * w), int(lm[c.start].y * h)] for c in oval])
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [pts], 255)
    head |= mask > 127

    head[int(pts[:, 1].max()) :, :] = False

    ys, xs = np.where(head)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def crop_or_pad(img: Image.Image, judge_box, place_box):
    """judge_box 로 판정하고 place_box 로 창을 놓는다.

    창 배치는 to_ratio() 와 같은 계산이다.
    """
    w, h = img.size
    cw, ch = (int(h * TARGET), h) if w / h > TARGET else (w, int(w / TARGET))

    if judge_box is None or judge_box[2] - judge_box[0] > cw:
        return aspect._blurred_bg_pad(img, TARGET), "fit_pad"

    hx0, hy0, hx1, hy1 = place_box
    cx = (hx0 + hx1) // 2
    x0 = max(0, min(min(max(cx - cw // 2, 0), hx0), w - cw))

    if hy1 - hy0 <= ch:
        cy = (hy0 + hy1) // 2
        y0 = max(0, min(min(max(cy - ch // 2, 0), hy0), h - ch))
    else:
        y0 = max(0, min(hy0, h - ch))

    return img.crop((x0, y0, x0 + cw, y0 + ch)), "crop"


OUT_DIR.mkdir(exist_ok=True)
rows = []

for path in sorted(IMAGE_DIR.glob("*.jpg")):
    img = Image.open(path).convert("RGB")
    full = aspect.get_head_box(img)
    upper = head_box_above_chin(img)

    a = aspect._blurred_bg_pad(img, TARGET)
    b, head_mode = crop_or_pad(img, full, full)
    c, chin_mode = crop_or_pad(img, upper, full)

    stem = path.stem
    a.save(OUT_DIR / f"{stem}_A_now.jpg", quality=95)
    b.save(OUT_DIR / f"{stem}_B_headbox.jpg", quality=95)
    c.save(OUT_DIR / f"{stem}_C_chin.jpg", quality=95)
    rows.append((stem, head_mode, chin_mode))

print(f"\n{'file':<26}{'B 머리전체':>12}{'C 턱선위':>12}")
for stem, hm, cm in rows:
    print(f"{stem:<26}{hm:>12}{cm:>12}")

head_n = sum(1 for _, hm, _ in rows if hm == "crop")
chin_n = sum(1 for _, _, cm in rows if cm == "crop")
print(f"\ncrop  B {head_n} / {len(rows)}   C {chin_n} / {len(rows)}")
print(f"저장: {OUT_DIR}")
