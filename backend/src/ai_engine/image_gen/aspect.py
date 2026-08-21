"""비율 3종 변환.

세 비율 모두 crop 우선이다. 머리가 창보다 넓으면 crop 을 포기하고
확대·블러 배경으로 여백을 채운다. 단색은 경계가 보인다.

머리 전체가 들어오는 것이 기준이다. 정수리 볼륨과 모발 끝이 잘리면
시술 결과를 보여주는 사진으로서 의미가 없다. 9:16 은 0.5625 로 매우
길어 잘림 위험이 크므로 CROP_HEAD_MARGIN 만큼 여유를 두고 판정한다.
"""

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision
from PIL import Image, ImageDraw, ImageFilter

from src.ai_engine.image_gen import loader, settings


def get_head_box(img: Image.Image, pad_ratio: float = 0.0):
    """머리 전체(헤어 + 얼굴) 바운딩 박스. 얼굴이 없으면 None.

    헤어 세그멘테이션과 얼굴 윤곽을 합친다. 헤어만 쓰면 이마가 빠지고
    얼굴만 쓰면 정수리가 빠진다.
    """
    arr = np.array(img.convert("RGB"))
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)

    category = np.squeeze(
        loader.get_segmenter().segment(mp_img).category_mask.numpy_view()
    )
    head = category == 1

    result = loader.get_landmarker().detect(mp_img)
    if result.face_landmarks:
        w, h = img.size
        lm = result.face_landmarks[0]
        oval = vision.FaceLandmarksConnections.FACE_LANDMARKS_FACE_OVAL
        pts = np.array([[int(lm[c.start].x * w), int(lm[c.start].y * h)] for c in oval])
        mask = np.zeros((h, w), np.uint8)
        cv2.fillPoly(mask, [pts], 255)
        head |= mask > 127

    ys, xs = np.where(head)
    if len(ys) == 0:
        return None

    w, h = img.size
    py, px = int(h * pad_ratio), int(w * pad_ratio)
    return (
        max(int(xs.min()) - px, 0),
        max(int(ys.min()) - py, 0),
        min(int(xs.max()) + px, w),
        min(int(ys.max()) + py, h),
    )


def _blurred_bg_pad(img: Image.Image, target: float) -> Image.Image:
    """원본을 확대·블러해 배경으로 깔고 그 위에 원본을 얹는다.

    배경은 원본 중앙을 확대한 것이라 원본 가장자리보다 어둡다. 그대로 두면
    페더링 구간에서 섞이며 경계에 어두운 띠가 생긴다. 그래서 배경 밝기를
    원본 가장자리에 맞추고, 페더링도 원본 안쪽으로만 준다.
    """
    w, h = img.size
    nw, nh = (w, int(w / target)) if w / h > target else (int(h * target), h)
    ox, oy = (nw - w) // 2, (nh - h) // 2

    # 캔버스를 덮도록 확대 후 중앙 크롭. 1.15 는 가장자리 반복을 줄이는 여유다.
    scale = max(nw / w, nh / h) * 1.15
    bw, bh = int(w * scale) + 1, int(h * scale) + 1
    bg = (
        img.resize((bw, bh), Image.LANCZOS)
        .crop(
            ((bw - nw) // 2, (bh - nh) // 2, (bw - nw) // 2 + nw, (bh - nh) // 2 + nh)
        )
        .filter(ImageFilter.GaussianBlur(int(min(nw, nh) * settings.PAD_BLUR_RATIO)))
    )

    # --- 배경 밝기 정합 ---

    src_g = np.array(img.convert("L"), dtype=float)
    bg_g = np.array(bg.convert("L"), dtype=float)
    if oy > 0:
        src_v, pad_v = src_g[:60].mean(), bg_g[:oy].mean()
    elif ox > 0:
        src_v, pad_v = src_g[:, :60].mean(), bg_g[:, :ox].mean()
    else:
        src_v = pad_v = 0.0

    if pad_v > 0:
        k = min(max(src_v / pad_v, 0.5), 2.0)
        bg = Image.fromarray(
            np.clip(np.array(bg, dtype=float) * k, 0, 255).astype(np.uint8)
        )

    # --- 안쪽 페더링 ---

    r = int(min(w, h) * settings.PAD_FEATHER_RATIO)
    box = [ox, oy, ox + w - 1, oy + h - 1]
    if oy > 0:
        box = [box[0], box[1] + r, box[2], box[3] - r]
    else:
        box = [box[0] + r, box[1], box[2] - r, box[3]]

    mask = Image.new("L", (nw, nh), 0)
    ImageDraw.Draw(mask).rectangle(box, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(r))

    layer = bg.copy()
    layer.paste(img, (ox, oy))
    return Image.composite(layer, bg, mask)


def to_ratio(img: Image.Image, ratio: str, head_box=None) -> tuple[Image.Image, str]:
    """비율을 맞춘다. 돌려주는 것은 (이미지, format_mode) 다.

    format_mode 는 실제 적용된 값이다. 프론트가 이 값을 화면에 표시한다.
    """
    rw, rh = settings.RATIOS[ratio]
    target = rw / rh
    w, h = img.size
    cw, ch = (int(h * target), h) if w / h > target else (w, int(w / target))

    hb = head_box if head_box is not None else get_head_box(img)
    if hb is None:
        return _blurred_bg_pad(img, target), "fit_pad"

    hx0, hy0, hx1, hy1 = hb

    # 가로가 넘치면 옆머리가 잘린다. crop 을 포기한다.
    # 9:16 은 잘림 위험이 커서 창을 그대로 쓰지 않고 여유를 둔다.
    limit = cw * settings.CROP_HEAD_MARGIN if ratio == "9:16" else cw
    if hx1 - hx0 > limit:
        return _blurred_bg_pad(img, target), "fit_pad"

    cx = (hx0 + hx1) // 2
    x0 = max(0, min(min(max(cx - cw // 2, 0), hx0), w - cw))

    if hy1 - hy0 <= ch:
        cy = (hy0 + hy1) // 2
        y0 = max(0, min(min(max(cy - ch // 2, 0), hy0), h - ch))
    else:
        # 세로가 넘치면 정수리를 살리고 아래(어깨)를 자른다.
        y0 = max(0, min(hy0, h - ch))

    return img.crop((x0, y0, x0 + cw, y0 + ch)), "crop"
