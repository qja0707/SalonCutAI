"""비율 3종 변환.

1:1·4:5 는 crop 우선, 9:16 은 fit_pad 고정이다.
crop 이 안 되는 경우는 확대·블러 배경으로 여백을 채운다. 단색은 경계가 보인다.

머리 전체가 들어오는 것이 기준이다. 정수리 볼륨과 모발 끝이 잘리면
시술 결과를 보여주는 사진으로서 의미가 없다.
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

    경계를 페더링해 붙여넣은 티를 없앤다.
    """
    w, h = img.size
    nw, nh = (w, int(w / target)) if w / h > target else (int(h * target), h)

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
    if settings.PAD_DARKEN < 1.0:
        bg = Image.eval(bg, lambda v: int(v * settings.PAD_DARKEN))

    ox, oy = (nw - w) // 2, (nh - h) // 2
    mask = Image.new("L", (nw, nh), 0)
    ImageDraw.Draw(mask).rectangle([ox, oy, ox + w - 1, oy + h - 1], fill=255)
    mask = mask.filter(
        ImageFilter.GaussianBlur(int(min(w, h) * settings.PAD_FEATHER_RATIO))
    )

    layer = Image.new("RGB", (nw, nh))
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

    if ratio == "9:16":
        return _blurred_bg_pad(img, target), "fit_pad"

    hb = head_box if head_box is not None else get_head_box(img)
    if hb is None:
        return _blurred_bg_pad(img, target), "fit_pad"

    hx0, hy0, hx1, hy1 = hb

    # 가로가 넘치면 옆머리가 잘린다. crop 을 포기한다.
    if hx1 - hx0 > cw:
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
