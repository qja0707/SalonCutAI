"""폴백 여백 채우기 방식 비교.

_blurred_bg_pad() 는 원본을 1.36배 확대해 중앙을 잘라 배경으로 쓴다.
세로 인물 사진의 중앙은 머리·옷이라 그것을 뭉갠 색이 여백에 깔린다.
경계에서 만나는 원본 픽셀은 맨 위(벽)·맨 아래(옷)라 색이 어긋난다.

지표 두 가지를 본다.
  여백-원본   여백 중앙과 원본 가장자리의 밝기 차이. 0 에 가까울수록 좋다
  경계 프로파일 경계 주변을 줄 단위로 찍는다. 평평할수록 좋다
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from src.ai_engine.image_gen import aspect, settings

IMAGE_DIR = Path.home() / "normal"
OUT_DIR = Path.home() / "normal_pad"
TARGET = 9 / 16

# 06 은 실제 폴백 케이스, 07·10 은 밝은 배경 조건을 보려고 강제로 태운다
TESTS = ["normal_06_bang_sheer", "normal_07_bang_heavy", "normal_10_salon_wave"]


def _canvas(img):
    w, h = img.size
    nw, nh = (w, int(w / TARGET)) if w / h > TARGET else (int(h * TARGET), h)
    return w, h, nw, nh


def _feather(img, bg, nw, nh, inward=True):
    """원본을 배경 위에 얹고 경계를 페더링한다.

    inward 면 마스크를 원본 안쪽으로만 흐린다. 바깥으로 흐리면
    페더링 구간에 배경이 섞여 들어가 어두운 띠가 생긴다.
    """
    w, h = img.size
    ox, oy = (nw - w) // 2, (nh - h) // 2
    r = int(min(w, h) * settings.PAD_FEATHER_RATIO)

    box = [ox, oy, ox + w - 1, oy + h - 1]
    if inward:
        box = [box[0], box[1] + r, box[2], box[3] - r]

    mask = Image.new("L", (nw, nh), 0)
    ImageDraw.Draw(mask).rectangle(box, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(r))

    layer = bg.copy()
    layer.paste(img, (ox, oy))
    return Image.composite(layer, bg, mask)


def pad_stretch(img):
    """원본 맨 윗줄·아랫줄을 늘려 채운다. 경계 색이 정확히 이어진다."""
    w, h, nw, nh = _canvas(img)
    oy = (nh - h) // 2
    bg = Image.new("RGB", (nw, nh))
    top = img.crop((0, 0, w, 1)).resize((nw, oy + 1), Image.NEAREST)
    bot = img.crop((0, h - 1, w, h)).resize((nw, nh - oy - h + 1), Image.NEAREST)
    bg.paste(top, (0, 0))
    bg.paste(bot, (0, oy + h - 1))
    bg = bg.filter(ImageFilter.GaussianBlur(int(min(nw, nh) * 0.03)))
    return _feather(img, bg, nw, nh)


def pad_edge_color(img):
    """원본 위·아래 가장자리 평균색으로 채운다."""
    _, h, nw, nh = _canvas(img)
    oy = (nh - h) // 2
    a = np.array(img, dtype=float)
    top_c = tuple(int(v) for v in a[:40].mean(axis=(0, 1)))
    bot_c = tuple(int(v) for v in a[-40:].mean(axis=(0, 1)))
    bg = Image.new("RGB", (nw, nh), top_c)
    ImageDraw.Draw(bg).rectangle([0, oy + h, nw, nh], fill=bot_c)
    return _feather(img, bg, nw, nh)


def pad_matched(img):
    """기존 방식을 쓰되 여백 밝기를 원본 가장자리에 맞춘다."""
    _, h, _, nh = _canvas(img)
    oy = (nh - h) // 2
    saved = settings.PAD_DARKEN
    settings.PAD_DARKEN = 1.0
    out = aspect._blurred_bg_pad(img, TARGET)
    settings.PAD_DARKEN = saved

    g = np.array(out.convert("L"), dtype=float)
    pad_v = g[oy // 2 - 10 : oy // 2 + 10].mean()
    src_v = g[oy + 80 : oy + 100].mean()
    if pad_v <= 0:
        return out

    k = min(max(src_v / pad_v, 0.5), 2.0)
    a = np.array(out, dtype=float)
    a[: oy + 1] = np.clip(a[: oy + 1] * k, 0, 255)
    a[oy + h - 1 :] = np.clip(a[oy + h - 1 :] * k, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def pad_fixed(img):
    """확대·블러 배경을 쓰되 밝기를 맞추고 안쪽 페더링을 쓴다."""
    w, h, nw, nh = _canvas(img)
    oy = (nh - h) // 2

    scale = max(nw / w, nh / h) * 1.15
    bw, bh = int(w * scale) + 1, int(h * scale) + 1
    bg = (
        img.resize((bw, bh), Image.LANCZOS)
        .crop(
            ((bw - nw) // 2, (bh - nh) // 2, (bw - nw) // 2 + nw, (bh - nh) // 2 + nh)
        )
        .filter(ImageFilter.GaussianBlur(int(min(nw, nh) * settings.PAD_BLUR_RATIO)))
    )

    src = np.array(img.convert("L"), dtype=float)
    bga = np.array(bg.convert("L"), dtype=float)
    k = src[:60].mean() / max(bga[:oy].mean(), 1.0)
    k = min(max(k, 0.5), 2.0)
    bg = Image.fromarray(
        np.clip(np.array(bg, dtype=float) * k, 0, 255).astype(np.uint8)
    )

    return _feather(img, bg, nw, nh)


METHODS = {
    "now": lambda im: aspect._blurred_bg_pad(im, TARGET),
    "stretch": pad_stretch,
    "edgecolor": pad_edge_color,
    "matched": pad_matched,
    "fixed": pad_fixed,
}


def band_diff(out, oy):
    g = np.array(out.convert("L"), dtype=float)
    return g[oy // 2 - 10 : oy // 2 + 10].mean() - g[oy + 80 : oy + 100].mean()


OUT_DIR.mkdir(exist_ok=True)

print(f"\n{'file':<22}{'method':<12}{'여백-원본':>12}")
for stem in TESTS:
    img = Image.open(IMAGE_DIR / f"{stem}.jpg").convert("RGB")
    _, h, _, nh = _canvas(img)
    oy = (nh - h) // 2

    for name, fn in METHODS.items():
        out = fn(img)
        out.save(OUT_DIR / f"{stem}_{name}.jpg", quality=95)
        print(f"{stem:<22}{name:<12}{band_diff(out, oy):>+12.1f}")
    print()

# --- 경계 밝기 프로파일 ---

print(f"\n{'file':<22}{'method':<12}{'경계 주변 밝기 (oy-60 → oy+20, 10px 간격)'}")
for stem in TESTS:
    img = Image.open(IMAGE_DIR / f"{stem}.jpg").convert("RGB")
    _, h, _, nh = _canvas(img)
    oy = (nh - h) // 2

    for name in ("now", "stretch", "fixed"):
        g = np.array(
            Image.open(OUT_DIR / f"{stem}_{name}.jpg").convert("L"), dtype=float
        )
        vals = [f"{g[oy + d].mean():5.0f}" for d in range(-60, 21, 10)]
        print(f"{stem:<22}{name:<12}{' '.join(vals)}")
    print()

print(f"저장: {OUT_DIR}")
