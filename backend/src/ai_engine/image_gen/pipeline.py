"""생성부터 저장까지 전체 흐름.

service 는 job 상태만 알고, 여기서 실제 이미지를 만든다.
모드에 따라 조합 3·5 로 갈리고 후처리는 둘이 같다.

생성은 SDXL 에 맞춰 긴 변 1024 에서 하고, 후처리는 저장본(2048) 위에서 한다.
생성 결과만 키워서 원본에 붙이므로 마스크 밖 헤어·옷·배경은 원본 픽셀 그대로다.
"""

import logging

from PIL import Image

from src.ai_engine.image_gen import (
    aspect,
    combo3,
    combo5,
    compose,
    masks,
    restore,
    settings,
    storage,
)

logger = logging.getLogger(__name__)


def _finish(img: Image.Image, comp: Image.Image, gen_mask: Image.Image):
    """재합성 결과를 복원하고 색을 맞춘 뒤 눈썹을 되돌린다.

    복원은 512 정렬 영역 전체를 다시 그려 눈썹도 덮으므로, 눈썹 보존은
    복원 뒤에 와야 한다. 복원 전에도 한 번 되돌리는 것은 CodeFormer 가
    입력을 보고 그리므로 원본 눈썹이 있는 상태가 형태 유지에 낫기 때문이다.
    복원이 조명 톤을 지우므로 색 정합을 한 번 더 하되, 마스크 밖은 복원
    결과를 그대로 두어 원본과 어긋나지 않게 한다.
    """
    comp = compose.keep_brows(img, comp)
    post = restore.restore(comp)
    shifted = compose.color_transfer(post, img, gen_mask)
    final = Image.composite(shifted, post, gen_mask.convert("L"))
    return compose.keep_brows(img, final)


def _postprocess(img, out, face_mask, hair_mask):
    """1024 생성 결과를 원본 크기로 올려 원본 위에서 후처리한다."""
    out = out.resize(img.size, Image.LANCZOS)
    gen_mask = masks.build_gen_mask(face_mask, hair_mask)

    out = compose.color_transfer(out, img, gen_mask)
    comp = compose.recompose_with_hair(img, out, face_mask, hair_mask)
    return _finish(img, comp, gen_mask)


def _run_prompt_mode(img: Image.Image, options, seed: int) -> Image.Image:
    """조합 5. 마스크 안쪽만 다시 그려 헤어와 배경을 남긴다."""
    out, face_mask, hair_mask = combo5.generate(img, options.face.prompt, seed)
    return _postprocess(img, out, face_mask, hair_mask)


def _run_reference_mode(img: Image.Image, options, seed: int) -> Image.Image:
    """조합 3. 후처리는 조합 5 와 같다."""
    ref_id = options.face.reference.reference_face_id
    out, _, _ = combo3.generate(img, storage.ref_face_path(ref_id), seed)

    face_mask = masks.build_face_mask(img)
    if face_mask is None:
        raise ValueError("얼굴 마스크를 만들 수 없다")
    hair_mask = masks.build_hair_mask(img)
    return _postprocess(img, out, face_mask, hair_mask)


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