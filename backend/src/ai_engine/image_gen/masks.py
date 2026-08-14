"""마스크 생성.

얼굴 윤곽과 머리카락 영역을 나눠 인페인팅 대상을 정한다.
사각형 bbox 를 쓰면 이마 위와 양옆 머리카락까지 지워지므로
FACE_OVAL 폐곡선을 따라 만든다.
"""

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision
from PIL import Image

from src.ai_engine.image_gen import loader, settings

# selfie_multiclass 클래스 번호
# 0 배경 / 1 머리카락 / 2 body-skin / 3 face-skin / 4 의류 / 5 기타
HAIR_CLASS = 1
BODY_SKIN_CLASS = 2


def _to_mp_image(img: Image.Image) -> mp.Image:
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(img))


def _category_mask(img: Image.Image) -> np.ndarray:
    result = loader.get_segmenter().segment(_to_mp_image(img))
    return np.squeeze(result.category_mask.numpy_view())


def build_face_mask(img: Image.Image) -> Image.Image | None:
    """FACE_OVAL 내부를 흰색으로 채운다. 얼굴이 없으면 None.

    윤곽을 축소해도 이목구비가 계속 포함돼 결과가 달라지지 않았다.
    넓게 덮는 편이 초상권 회피에 안전해 축소 없이 쓴다.
    """
    w, h = img.size
    result = loader.get_landmarker().detect(_to_mp_image(img))
    if not result.face_landmarks:
        return None

    lm = result.face_landmarks[0]
    oval = vision.FaceLandmarksConnections.FACE_LANDMARKS_FACE_OVAL
    pts = np.array([[int(lm[c.start].x * w), int(lm[c.start].y * h)] for c in oval])

    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [pts], 255)
    return Image.fromarray(mask)


def build_hair_mask(img: Image.Image, dilate: int | None = None) -> Image.Image:
    """머리카락 영역을 팽창시켜 돌려준다.

    잔머리 사이가 톱니 모양으로 파이면 그 틈에 남은 이마 픽셀이
    인페인팅 대상에 들어가고, 모델이 주변을 참조해 머리카락으로 채워
    앞머리가 두꺼워진다. 팽창은 그 틈을 메우기 위한 것이다.
    """
    if dilate is None:
        dilate = settings.HAIR_DILATE_PX

    hair = (_category_mask(img) == HAIR_CLASS).astype(np.uint8) * 255

    if dilate > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (dilate * 2 + 1, dilate * 2 + 1)
        )
        hair = cv2.dilate(hair, kernel, iterations=1)

    return Image.fromarray(hair).resize(img.size)


def build_body_skin_mask(img: Image.Image) -> Image.Image:
    """목·데콜테 영역. 색 정합에서 기준 톤을 뽑는 데 쓴다."""
    skin = (_category_mask(img) == BODY_SKIN_CLASS).astype(np.uint8) * 255
    return Image.fromarray(skin).resize(img.size)


def build_gen_mask(face_mask: Image.Image, hair_mask: Image.Image) -> Image.Image:
    """얼굴 윤곽에서 머리카락을 뺀다. 인페인팅 대상 영역이다."""
    face = np.array(face_mask).copy()
    face[np.array(hair_mask) > 127] = 0
    return Image.fromarray(face)


def resize_for_sdxl(
    img: Image.Image, mask: Image.Image, target: int = 1024
) -> tuple[Image.Image, Image.Image]:
    """긴 변을 target 에 맞추고 8의 배수로 정렬한다.

    8의 배수는 VAE 다운샘플링 비율 때문이다. 맞지 않으면 에러가 난다.
    """
    w, h = img.size
    scale = target / max(w, h)
    nw = (int(w * scale) // 8) * 8
    nh = (int(h * scale) // 8) * 8
    return img.resize((nw, nh)), mask.resize((nw, nh))
