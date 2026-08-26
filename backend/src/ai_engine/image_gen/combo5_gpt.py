"""프롬프트 모드 생성. OpenAI 이미지 편집(gpt-image).

SDXL 인페인팅은 "고양이상" 같은 인상 개념을 몰라 동물상이 갈리지 않았다.
얼굴 주변만 정사각으로 잘라 편집 마스크·문장 프롬프트와 함께 보내고,
돌아온 결과를 원래 자리에 붙인다. 외부로 나가는 것은 사진 전체가 아니라
이 크롭이다.

시드 고정이 안 되므로 같은 입력이라도 매번 다른 얼굴이 나온다.
다시 생성은 프론트 버튼(#185)이 담당한다.
"""

import base64
import io
import logging
import os

import cv2
import numpy as np
from PIL import Image

from src.ai_engine.image_gen import loader, masks, prompt_map, settings

logger = logging.getLogger(__name__)


def _client():
    from openai import OpenAI

    return OpenAI(
        api_key=os.getenv("OPENAI_KEY"),
        timeout=settings.GPT_TIMEOUT_SEC,
        max_retries=settings.GPT_MAX_RETRIES,
    )


def _square_box(
    bbox: tuple[float, float, float, float], width: int, height: int, pad: float
) -> tuple[int, int, int, int]:
    """bbox 를 pad 배 키운 정사각 상자를 이미지 안에 맞춰 돌려준다.

    얼굴이 가장자리에 붙어 있으면 그냥 자르는 것으로는 정사각이 깨지고,
    그 크롭을 1024×1024 로 늘리면 얼굴과 마스크 기하가 왜곡된다. 변 길이는
    유지한 채 상자를 반대쪽으로 밀고, 변이 이미지 짧은 변보다 길면 짧은 변에
    맞춘다. 어느 경우든 결과는 정사각이다.
    """
    x1, y1, x2, y2 = bbox
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    side = int(min(max(x2 - x1, y2 - y1) * pad, width, height))
    left = round(cx - side / 2)
    top = round(cy - side / 2)
    left = min(max(left, 0), width - side)
    top = min(max(top, 0), height - side)
    return left, top, left + side, top + side


def _face_box(img: Image.Image) -> tuple[tuple[int, int, int, int], float]:
    """얼굴 크롭 상자와 얼굴 폭을 돌려준다."""
    faces = loader.get_face_app().get(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR))
    if not faces:
        raise ValueError("얼굴을 찾을 수 없다")
    face = max(faces, key=lambda f: f.bbox[2] - f.bbox[0])
    x1, y1, x2, y2 = (float(v) for v in face.bbox)
    box = _square_box((x1, y1, x2, y2), *img.size, settings.GPT_CROP_PAD)
    return box, x2 - x1


def _edit(crop: Image.Image, rgba: Image.Image, prompt: str) -> Image.Image:
    """크롭과 알파 마스크를 보내 편집 결과를 받는다. 투명한 곳이 편집 영역이다."""
    img_buf, mask_buf = io.BytesIO(), io.BytesIO()
    crop.save(img_buf, "PNG")
    rgba.save(mask_buf, "PNG")
    img_buf.seek(0)
    mask_buf.seek(0)
    img_buf.name = "image.png"
    mask_buf.name = "mask.png"

    size = f"{settings.GPT_CROP_SIZE}x{settings.GPT_CROP_SIZE}"
    res = _client().images.edit(
        model=settings.GPT_IMAGE_MODEL,
        image=img_buf,
        mask=mask_buf,
        prompt=prompt,
        size=size,
        n=1,
    )
    return Image.open(io.BytesIO(base64.b64decode(res.data[0].b64_json))).convert("RGB")


def generate(img: Image.Image, options) -> tuple[Image.Image, Image.Image, Image.Image]:
    """편집 결과를 원본 자리에 붙인 이미지와 후처리 마스크를 돌려준다.

    돌려주는 것은 (붙인 결과, 피부 마스크, 헤어 마스크) 로 combo5.generate 와
    같은 형태다. 피부 마스크는 세그멘테이션 피부 클래스 +2%, 헤어 마스크는
    GPT 용(닫힘·침식·눈썹 제외)이다. 얼굴 윤곽 마스크는 편집 마스크에만 쓴다.
    결과는 원본 크기라 후처리에서 리사이즈가 필요 없다.

    편집 마스크(GPT 에 보내는 것)와 되붙임 마스크는 헤어 팽창이 다르다.
    편집 쪽은 팽창 0.077 로 앞머리 틈을 메워 GPT 가 머리카락을 안 그리게 하고,
    되붙임 쪽은 팽창하면 원본 눈꺼풀까지 덮여 GPT 눈과 겹치므로 팽창 없이 간다.
    """
    face_mask = masks.build_face_mask(img)
    if face_mask is None:
        raise ValueError("얼굴 마스크를 만들 수 없다")

    box, face_width = _face_box(img)
    x1, y1, x2, y2 = box
    size = settings.GPT_CROP_SIZE

    edit_face = masks.dilate_mask(face_mask, face_width, settings.GPT_EDIT_DILATE_RATIO)
    edit_mask = masks.build_gen_mask(edit_face, masks.build_hair_mask(img))

    crop = img.crop(box).resize((size, size), Image.LANCZOS)
    m = edit_mask.crop(box).resize((size, size), Image.NEAREST)
    rgba = crop.copy().convert("RGBA")
    rgba.putalpha(Image.fromarray(255 - np.array(m.convert("L"))))

    prompt = prompt_map.build_face_sentence(options)
    logger.info("조합 5 GPT 프롬프트: %s", prompt)
    raw = _edit(crop, rgba, prompt)

    full = img.copy()
    full.paste(raw.resize((x2 - x1, y2 - y1), Image.LANCZOS), (x1, y1))

    skin = masks.build_skin_mask(img, face_width)
    hair = masks.build_hair_mask_gpt(img, face_width)
    return full, skin, hair
