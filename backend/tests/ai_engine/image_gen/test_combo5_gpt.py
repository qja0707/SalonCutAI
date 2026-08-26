import base64
import io
from types import SimpleNamespace

import numpy as np
from PIL import Image

from src.ai_engine.image_gen import combo5_gpt, masks, pipeline, settings
from src.schemas.face_swap import FacePromptOptions

W, H = 400, 500
BOX = (100, 100, 300, 300)  # _face_box 가 돌려줄 크롭 상자


def _png_b64(img):
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _mask(fill_box=None):
    m = np.zeros((H, W), np.uint8)
    if fill_box:
        x1, y1, x2, y2 = fill_box
        m[y1:y2, x1:x2] = 255
    return Image.fromarray(m)


class _FakeImages:
    def __init__(self, calls):
        self.calls = calls

    def edit(self, **kw):
        self.calls.append(kw)
        red = Image.new(
            "RGB", (settings.GPT_CROP_SIZE, settings.GPT_CROP_SIZE), (255, 0, 0)
        )
        return SimpleNamespace(data=[SimpleNamespace(b64_json=_png_b64(red))])


def _patch(monkeypatch):
    calls = []
    monkeypatch.setattr(
        combo5_gpt, "_client", lambda: SimpleNamespace(images=_FakeImages(calls))
    )
    monkeypatch.setattr(combo5_gpt, "_face_box", lambda img: (BOX, 200.0))
    monkeypatch.setattr(
        masks, "build_face_mask", lambda img: _mask((150, 150, 250, 250))
    )
    monkeypatch.setattr(
        masks, "build_hair_mask", lambda img, dilate=None: _mask((150, 150, 250, 170))
    )
    monkeypatch.setattr(
        masks, "build_hair_mask_gpt", lambda img, fw=None: _mask((150, 150, 250, 170))
    )
    monkeypatch.setattr(
        masks, "build_skin_mask", lambda img, fw: _mask((140, 170, 260, 320))
    )
    return calls


def _opts():
    return FacePromptOptions(
        ethnicity="한국인", gender="여성", age="20대", face_style="고양이상"
    )


def test_generate_sends_square_crop_with_transparent_edit_area(monkeypatch):
    calls = _patch(monkeypatch)
    img = Image.new("RGB", (W, H), (0, 0, 255))

    combo5_gpt.generate(img, _opts())

    assert len(calls) == 1
    kw = calls[0]
    assert kw["model"] == settings.GPT_IMAGE_MODEL
    assert kw["size"] == f"{settings.GPT_CROP_SIZE}x{settings.GPT_CROP_SIZE}"
    assert "cat-like face" in kw["prompt"]

    sent = Image.open(kw["image"])
    rgba = Image.open(kw["mask"])
    assert sent.size == (settings.GPT_CROP_SIZE, settings.GPT_CROP_SIZE)
    alpha = np.array(rgba.split()[-1])
    assert alpha.min() == 0 and alpha.max() == 255  # 편집 영역 투명, 나머지 불투명
    assert alpha[512, 512] == 0  # 얼굴 중심은 편집 영역
    assert alpha[5, 5] == 255  # 크롭 모서리는 보존 영역


def test_generate_pastes_result_back_into_box_only(monkeypatch):
    _patch(monkeypatch)
    img = Image.new("RGB", (W, H), (0, 0, 255))

    full, skin, hair = combo5_gpt.generate(img, _opts())

    arr = np.array(full)
    assert full.size == img.size
    assert tuple(arr[200, 200]) == (255, 0, 0)  # 상자 안은 GPT 결과
    assert tuple(arr[50, 50]) == (0, 0, 255)  # 상자 밖은 원본
    assert skin.size == img.size and hair.size == img.size


def test_postprocess_gpt_keeps_original_outside_skin(monkeypatch):
    monkeypatch.setattr(settings, "GPT_COLOR_ALPHA", 0.0)
    img = Image.new("RGB", (W, H), (0, 0, 255))
    full = Image.new("RGB", (W, H), (255, 0, 0))
    skin = _mask((140, 170, 260, 320))
    hair = _mask((150, 150, 250, 170))

    out = np.array(pipeline._postprocess_gpt(img, full, skin, hair))

    assert out[250, 200][0] > 200 and out[250, 200][2] < 50  # 피부 안은 결과(빨강)
    assert tuple(out[50, 50]) == (0, 0, 255)  # 배경은 원본
    assert tuple(out[160, 200]) == (0, 0, 255)  # 헤어는 원본


def test_run_prompt_mode_uses_sdxl_when_engine_is_not_gpt(monkeypatch):
    monkeypatch.setattr(settings, "PROMPT_MODE_ENGINE", "sdxl")
    called = {}

    def fake_sdxl(img, o, seed):
        called["sdxl"] = True
        return img, None, None

    monkeypatch.setattr(pipeline.combo5, "generate", fake_sdxl)
    monkeypatch.setattr(pipeline, "_postprocess", lambda *a: "sdxl-out")
    monkeypatch.setattr(
        pipeline.combo5_gpt,
        "generate",
        lambda *a: (_ for _ in ()).throw(AssertionError("gpt 호출됨")),
    )
    options = SimpleNamespace(face=SimpleNamespace(mode="prompt", prompt=_opts()))

    assert (
        pipeline._run_prompt_mode(Image.new("RGB", (W, H)), options, seed=1)
        == "sdxl-out"
    )
    assert called["sdxl"]
