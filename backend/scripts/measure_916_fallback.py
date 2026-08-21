"""9:16 폴백 비율 측정.

to_ratio() 의 9:16 조기 반환이 없다고 가정하고, 1:1·4:5 와 같은 기준으로
crop 가능 여부를 센다. 디스커션 #122 의 조건부 폴백 설계 근거다.

두 기준을 나란히 잰다.
  현재   get_head_box() 그대로. 흘러내린 모발까지 머리로 본다
  턱선위 턱선 아래를 버린다. 정수리·앞머리·옆머리만 본다

GPU 는 쓰지 않는다. MediaPipe 두 모델만 있으면 된다.
"""

import sys
from pathlib import Path

# scripts/ 에서 실행해도 src 를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision
from PIL import Image

from src.ai_engine.image_gen import aspect, downloads, loader, settings

IMAGE_DIR = Path.home() / "normal"
TARGET = 9 / 16


def head_box_above_chin(img: Image.Image):
    """턱선 위쪽만 본 머리 박스. 얼굴이 없으면 None.

    get_head_box() 와 같은 방식으로 헤어 세그멘테이션과 얼굴 윤곽을 합친 뒤,
    턱선 아래를 버린다. 어깨로 흘러내린 모발이 박스를 프레임 폭까지 넓히는데,
    시술 결과 판단에 중요한 것은 정수리·앞머리·옆머리다.
    """
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


# --- 모델 확보 ---

# ensure_models() 는 InstantID 4.6GB 까지 받으므로 MediaPipe 만 확보한다
if any(
    not p.exists()
    for p in (settings.FACE_LANDMARKER_PATH, settings.SELFIE_SEGMENTER_PATH)
):
    print("MediaPipe 모델을 받는다")
    downloads._fetch_mediapipe()

# --- 측정 ---

rows = []
for path in sorted(IMAGE_DIR.glob("*.jpg")):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    cw = int(h * TARGET) if w / h > TARGET else w

    full = aspect.get_head_box(img)
    upper = head_box_above_chin(img)
    if full is None or upper is None:
        rows.append((path.name, None, None))
        continue

    rows.append((path.name, (full[2] - full[0]) / cw, (upper[2] - upper[0]) / cw))

# --- 출력 ---

THRESHOLD = 0.9

print(f"\n{'file':<26}{'머리전체':>10}{'판정':>10}")
for name, cur, _ in rows:
    if cur is None:
        print(f"{name:<26}{'얼굴없음':>10}")
        continue
    mode = "crop" if cur <= THRESHOLD else "fit_pad"
    print(f"{name:<26}{cur:>10.4f}{mode:>10}")

n = sum(1 for _, c, _ in rows if c is not None and c <= THRESHOLD)
print(f"\n임계값 {THRESHOLD}   crop {n} / {len(rows)}")
