"""프롬프트 모드 생성. MediaPipe 마스크 + SDXL 인페인팅.

참조 얼굴 없이 옵션만으로 얼굴을 새로 그린다.
마스크 안쪽만 다시 그리므로 헤어와 배경은 원본 그대로 남는다.
"""

import logging

import torch
from PIL import Image

from src.ai_engine.image_gen import loader, masks, prompt_map, settings

logger = logging.getLogger(__name__)


def generate(
    img: Image.Image,
    options,
    seed: int,
) -> tuple[Image.Image, Image.Image, Image.Image]:
    """생성 결과와 후처리에 필요한 마스크를 함께 돌려준다.

    돌려주는 것은 (생성 결과, 얼굴 마스크, 헤어 마스크) 다.
    생성은 긴 변 1024 에서 하고 결과도 그 크기지만, 마스크는 원본 크기
    그대로 돌려준다. 후처리가 원본 위에서 돌기 때문이다.
    """
    face_mask = masks.build_face_mask(img)
    if face_mask is None:
        raise ValueError("얼굴 마스크를 만들 수 없다")

    hair_mask = masks.build_hair_mask(img)
    gen_mask = masks.build_gen_mask(face_mask, hair_mask)

    img_r, gen_r = masks.resize_for_sdxl(img, gen_mask)

    prompt = prompt_map.build_face_prompt(options)
    logger.info("조합 5 프롬프트: %s", prompt)

    out = loader.get_combo5()(
        prompt=prompt,
        negative_prompt=settings.FACE_NEGATIVE,
        image=img_r,
        mask_image=gen_r,
        strength=settings.COMBO5_STRENGTH,
        num_inference_steps=settings.COMBO5_STEPS,
        guidance_scale=settings.COMBO5_GUIDANCE,
        generator=torch.Generator("cuda").manual_seed(seed),
    ).images[0]

    return out, face_mask, hair_mask