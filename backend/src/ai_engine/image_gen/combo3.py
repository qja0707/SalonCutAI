"""참조 얼굴 모드 생성. InstantID + RealVisXL.

미리 만들어둔 가상 얼굴의 정체성을 손님 사진에 입힌다.
조합 5 와 달리 인페인팅이 아니라 img2img 라 이미지 전체를 다시 그리지만,
strength 0.4 로 원본 구조가 유지된다.
"""

import logging

import cv2
import numpy as np
import torch
from PIL import Image

from src.ai_engine.image_gen import loader, settings
from src.ai_engine.image_gen.vendor.draw_kps import draw_kps

logger = logging.getLogger(__name__)


def _to_bgr(img: Image.Image) -> np.ndarray:
    return np.array(img.convert("RGB"))[:, :, ::-1]


def prepare(ref_path, img: Image.Image):
    """참조에서 임베딩을, 원본에서 키포인트 이미지를 만든다.

    임베딩은 normed_embedding 이 아니라 raw embedding 을 쓴다.
    정규화된 것을 넣으면 얼굴이 제대로 반영되지 않는다.
    """
    app = loader.get_face_app()

    ref_faces = app.get(cv2.imread(str(ref_path)))
    if not ref_faces:
        raise ValueError("참조 얼굴 검출 실패")
    embedding = ref_faces[0]["embedding"]

    src_faces = app.get(_to_bgr(img))
    if not src_faces:
        raise ValueError("원본 얼굴 검출 실패")
    face = max(src_faces, key=lambda f: f["bbox"][2] * f["bbox"][3])

    return embedding, draw_kps(img, face["kps"])


def _resize(img: Image.Image, kps: Image.Image, target: int = 1024):
    """긴 변을 target 에 맞추고 8의 배수로 정렬한다. 둘에 같은 크기를 쓴다."""
    w, h = img.size
    scale = target / max(w, h)
    nw = (int(w * scale) // 8) * 8
    nh = (int(h * scale) // 8) * 8
    return img.resize((nw, nh)), kps.resize((nw, nh))


def generate(
    img: Image.Image,
    ref_path,
    seed: int,
) -> tuple[Image.Image, Image.Image, np.ndarray]:
    """생성 결과와 리사이즈된 원본, 원본 키포인트를 돌려준다.

    키포인트는 후처리의 어파인 정렬에 쓴다. 조합 3 은 이미지 전체를
    다시 그려서 얼굴 위치가 미세하게 어긋나므로 맞춰줘야 한다.
    """
    embedding, kps_img = prepare(ref_path, img)
    img_r, kps_r = _resize(img, kps_img)

    out = loader.get_combo3()(
        prompt=settings.COMBO3_PROMPT,
        negative_prompt=settings.COMBO3_NEGATIVE,
        image_embeds=embedding,
        image=img_r,
        control_image=kps_r,
        strength=settings.COMBO3_STRENGTH,
        controlnet_conditioning_scale=settings.COMBO3_CONTROLNET_SCALE,
        ip_adapter_scale=settings.COMBO3_IP_ADAPTER_SCALE,
        num_inference_steps=settings.COMBO3_STEPS,
        guidance_scale=settings.COMBO3_GUIDANCE,
        generator=torch.Generator("cuda").manual_seed(seed),
    ).images[0]

    src_faces = loader.get_face_app().get(_to_bgr(img_r))
    src_kps = src_faces[0]["kps"] if src_faces else None

    return out, img_r, src_kps
