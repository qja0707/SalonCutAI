"""생성부터 저장까지 전체 흐름.

service 는 job 상태만 알고, 여기서 실제 이미지를 만든다.
모드에 따라 조합 3·5 로 갈리고 후처리는 둘이 같다.
"""

import logging

from PIL import Image

from src.ai_engine.image_gen import (
    aspect,
    combo3,
    combo5,
    compose,
    masks,
    settings,
    storage,
)

logger = logging.getLogger(__name__)


def _run_prompt_mode(img: Image.Image, options, seed: int) -> Image.Image:
    """조합 5. 마스크 안쪽만 다시 그려 헤어와 배경을 남긴다."""
    out, img_r, face_r, hair_r = combo5.generate(img, options.face.prompt, seed)
    gen_mask = masks.build_gen_mask(face_r, hair_r)

    out = compose.color_transfer(out, img_r, gen_mask)
    comp = compose.recompose_with_hair(img_r, out, face_r, hair_r)
    return compose.keep_brows(img_r, comp)


def _run_reference_mode(img: Image.Image, options, seed: int) -> Image.Image:
    """조합 3. 후처리는 조합 5 와 같다."""
    ref_id = options.face.reference.reference_face_id
    out, img_r, _ = combo3.generate(img, storage.ref_face_path(ref_id), seed)

    face_mask = masks.build_face_mask(img_r)
    if face_mask is None:
        raise ValueError("얼굴 마스크를 만들 수 없다")
    hair_mask = masks.build_hair_mask(img_r)
    gen_mask = masks.build_gen_mask(face_mask, hair_mask)

    out = compose.color_transfer(out, img_r, gen_mask)
    comp = compose.recompose_with_hair(img_r, out, face_mask, hair_mask)
    return compose.keep_brows(img_r, comp)


def run(job_id: str, options, seed: int) -> dict[str, dict]:
    """job 하나를 처리하고 results 를 돌려준다.

    돌려주는 형태는 프론트 계약과 같다.
        {"1:1": {"url": ..., "format_mode": ...}, ...}
    """
    img = Image.open(storage.source_path(job_id)).convert("RGB")

    if options.face.mode == "reference":
        final = _run_reference_mode(img, options, seed)
    else:
        final = _run_prompt_mode(img, options, seed)

    head_box = aspect.get_head_box(final)

    results: dict[str, dict] = {}
    for path_key, ratio in settings.RATIO_PATH_MAP.items():
        out, mode = aspect.to_ratio(final, ratio, head_box)
        storage.save_result(job_id, path_key, out)
        results[ratio] = {
            "url": f"/api/v1/face-swap-jobs/{job_id}/images/{path_key}",
            "format_mode": mode,
        }

    return results
