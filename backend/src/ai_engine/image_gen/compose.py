"""후처리.

생성 결과를 원본과 자연스럽게 합친다. 순서가 중요하다.

    색 정합 → 헤어 복원 재합성 → 눈썹 보존

조합 3·5 가 같은 경로를 쓴다.

블러 상수는 긴 변 1024 에서 정한 값이다. 후처리는 저장본(2048) 위에서 도므로
이미지 크기에 비례해 키운다. 그대로 쓰면 경계 페더가 절반으로 좁아진다.
"""

import cv2
import numpy as np
from PIL import Image, ImageFilter

from src.ai_engine.image_gen import loader, masks, settings

BLUR_BASE_SIDE = 1024  # 블러 상수를 정한 기준 크기


def _blur_scale(img: Image.Image) -> float:
    return max(img.size) / BLUR_BASE_SIDE


def color_transfer(
    src: Image.Image,
    ref: Image.Image,
    mask: Image.Image,
    alpha: float | None = None,
) -> Image.Image:
    """src 의 마스크 영역 색 통계를 ref 쪽으로 alpha 만큼 옮긴다. LAB 기준.

    생성 결과는 얼굴만 밝고 노랗게 나와 목과 톤이 끊긴다.
    alpha 0→1 이 단조 개선이고 교차점이 없어 1.0 으로 둔다.
    """
    if alpha is None:
        alpha = settings.COLOR_ALPHA

    s = cv2.cvtColor(np.array(src.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32)
    r = cv2.cvtColor(
        np.array(ref.resize(src.size).convert("RGB")), cv2.COLOR_RGB2LAB
    ).astype(np.float32)
    mk = np.array(mask.resize(src.size)) > 127

    out = s.copy()
    for c in range(3):
        s_std, s_mean = s[..., c][mk].std(), s[..., c][mk].mean()
        r_std, r_mean = r[..., c][mk].std(), r[..., c][mk].mean()
        t_std = s_std + (r_std - s_std) * alpha
        t_mean = s_mean + (r_mean - s_mean) * alpha
        if s_std > 1e-6:
            out[..., c] = (s[..., c] - s_mean) / s_std * t_std + t_mean

    return Image.fromarray(
        cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    )


def recompose_with_hair(
    original: Image.Image,
    result: Image.Image,
    face_mask: Image.Image,
    hair_mask: Image.Image,
) -> Image.Image:
    """얼굴 경계는 부드럽게 섞고 머리카락은 원본으로 되돌린다.

    헤어 블러를 크게 잡으면 경계가 얇아 잔상이 생기므로 3 으로 둔다.
    """
    size = original.size
    scale = _blur_scale(original)
    res = result.resize(size)

    comp = Image.composite(
        res,
        original,
        face_mask.resize(size).filter(
            ImageFilter.GaussianBlur(settings.RECOMPOSE_BLUR * scale)
        ),
    )
    return Image.composite(
        original,
        comp,
        hair_mask.resize(size).filter(
            ImageFilter.GaussianBlur(settings.HAIR_BLUR * scale)
        ),
    )


def recompose_skin(
    original: Image.Image,
    result: Image.Image,
    skin_mask: Image.Image,
    hair_mask: Image.Image,
) -> Image.Image:
    """피부 영역만 결과로 두고 머리카락·배경·옷은 원본으로 되돌린다. GPT 경로 전용.

    얼굴 윤곽으로 자르는 recompose_with_hair 는 결과 얼굴이 원본보다 갸름할 때
    경계 블러 띠에 원본 턱선이 섞여 선으로 남았다. 피부 클래스 경계는 원본 윤곽
    바깥에 있어 그 안이 전부 결과 픽셀이 되므로 원본 윤곽이 섞이지 않는다.
    경계가 피부↔배경·옷이라 얇은 블러(HAIR_BLUR)로 충분하다.
    """
    size = original.size
    blur = ImageFilter.GaussianBlur(settings.HAIR_BLUR * _blur_scale(original))
    comp = Image.composite(
        result.resize(size), original, skin_mask.resize(size).filter(blur)
    )
    return Image.composite(original, comp, hair_mask.resize(size).filter(blur))


def keep_brows(original: Image.Image, comp: Image.Image) -> Image.Image:
    """생성된 눈썹을 원본 눈썹으로 되돌린다.

    참조 얼굴에서 가져오는 것은 눈·코·입이고 눈썹은 원본을 유지한다.
    kps 5점에 눈썹 정보가 없어 참조 임베딩이 눈썹 모양을 끌고 오는데,
    원본과 다른 눈썹이 나오면 인상이 크게 달라진다.

    검출에 실패하면 되돌리지 않고 그대로 둔다. 눈썹 보존은 필수 단계가
    아니라서 여기서 실패해도 결과는 나온다.
    """
    brow = masks.build_brow_mask(original)
    if brow is None:
        return comp

    return Image.composite(
        original,
        comp,
        brow.resize(original.size).filter(
            ImageFilter.GaussianBlur(settings.HAIR_BLUR * _blur_scale(original))
        ),
    )


def _get_kps(img_rgb: np.ndarray):
    faces = loader.get_face_app().get(cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
    if not faces:
        return None
    return max(faces, key=lambda f: f.bbox[2] - f.bbox[0]).kps.astype(np.float32)


def align_then_recompose(
    original: Image.Image,
    result: Image.Image,
    face_mask: Image.Image,
    hair_mask: Image.Image,
) -> Image.Image:
    """생성 결과를 원본 좌표계로 맞춘 뒤 재합성한다. 조합 3 전용.

    원본과 결과에서 각각 얼굴 5점을 검출해 유사변환으로 맞춘다.
    둘 중 하나라도 얼굴을 못 찾으면 정렬 없이 재합성한다.
    """
    res = result.resize(original.size)
    o, g = np.array(original.convert("RGB")), np.array(res.convert("RGB"))

    kps_o, kps_g = _get_kps(o), _get_kps(g)
    if kps_o is not None and kps_g is not None:
        matrix, _ = cv2.estimateAffinePartial2D(kps_g, kps_o, method=cv2.LMEDS)
        if matrix is not None:
            res = Image.fromarray(
                cv2.warpAffine(
                    g,
                    matrix,
                    (o.shape[1], o.shape[0]),
                    flags=cv2.INTER_LANCZOS4,
                )
            )

    return recompose_with_hair(original, res, face_mask, hair_mask)


def transfer_high_freq(
    base: Image.Image,
    original: Image.Image,
    mask: Image.Image,
    strength: float | None = None,
) -> Image.Image:
    """원본의 고주파 성분을 마스크 영역에 더한다.

    인페인팅이 피부 질감을 뭉개서 얼굴만 다른 재질로 보인다.
    질감은 원본 것을 쓰고 형태와 색은 생성 것을 쓴다.
    신원 정보는 형태에 있으므로 회피는 유지된다.
    """
    if strength is None:
        strength = settings.HIGHFREQ_STRENGTH

    b = np.array(base.convert("RGB")).astype(np.float32)
    o = np.array(original.resize(base.size).convert("RGB")).astype(np.float32)
    hf = o - cv2.GaussianBlur(o, (0, 0), settings.HIGHFREQ_RADIUS)
    mk = (np.array(mask.resize(base.size)) > 127).astype(np.float32)[..., None]

    return Image.fromarray(np.clip(b + hf * mk * strength, 0, 255).astype(np.uint8))
