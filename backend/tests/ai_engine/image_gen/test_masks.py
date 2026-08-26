import cv2
import numpy as np
from PIL import Image

from src.ai_engine.image_gen import masks, settings


def _blank(h=100, w=100):
    return np.zeros((h, w), np.uint8)


def test_morph_close_fills_gap_without_growing_outward():
    m = _blank()
    m[20:60, 20:45] = 255
    m[20:60, 48:80] = 255  # 3px 틈
    closed = np.array(masks._morph(Image.fromarray(m), cv2.MORPH_CLOSE, 3))
    assert closed[40, 46] == 255  # 틈이 메워짐
    assert closed[15, 40] == 0  # 바깥 경계는 그대로
    assert closed[40, 85] == 0


def test_dilate_mask_grows_by_face_width_ratio():
    m = _blank()
    m[40:60, 40:60] = 255
    out = np.array(masks.dilate_mask(Image.fromarray(m), face_width=100, ratio=0.05))
    assert out[35, 50] == 255  # 5px 팽창
    assert out[33, 50] == 0


def test_morph_noop_when_px_zero():
    m = Image.fromarray(_blank())
    assert masks._morph(m, cv2.MORPH_ERODE, 0) is m


def test_build_hair_mask_gpt_excludes_brow_and_erodes(monkeypatch):
    hair = _blank()
    hair[0:50, :] = 255  # 위쪽 절반이 머리카락
    brow = _blank()
    brow[45:55, 30:70] = 255  # 헤어 하단에 걸친 눈썹
    img = Image.new("RGB", (100, 100))

    monkeypatch.setattr(
        masks, "build_hair_mask", lambda i, dilate=None: Image.fromarray(hair)
    )
    monkeypatch.setattr(masks, "build_brow_mask", lambda i: Image.fromarray(brow))
    monkeypatch.setattr(settings, "HAIR_CLOSE_RATIO", 0.0)
    monkeypatch.setattr(settings, "HAIR_ERODE_RATIO", 0.02)
    monkeypatch.setattr(settings, "BROW_EXCLUDE_RATIO", 0.03)

    out = np.array(masks.build_hair_mask_gpt(img, face_width=100))
    assert out[10, 10] == 255  # 머리카락 본체 유지
    assert out[49, 10] == 0  # 침식 2px 로 하단 경계가 올라감
    assert out[44, 50] == 0  # 눈썹(팽창 3px, 42행부터) 영역 제외
    assert out[44, 10] == 255  # 눈썹 밖은 유지


def test_build_hair_mask_gpt_skips_morph_without_face(monkeypatch):
    hair = _blank()
    hair[0:50, :] = 255
    img = Image.new("RGB", (100, 100))
    monkeypatch.setattr(
        masks, "build_hair_mask", lambda i, dilate=None: Image.fromarray(hair)
    )
    monkeypatch.setattr(masks, "_face_width", lambda i: None)

    out = np.array(masks.build_hair_mask_gpt(img))
    assert (out == hair).all()
