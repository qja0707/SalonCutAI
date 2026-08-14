"""생성 전 사전 검증.

CPU 로 1초 안에 끝난다. 얼굴이 없는 사진 때문에 GPU 큐가 막히는 것을 막는다.

세 오류 모두 retryable 이 False 다. 같은 사진으로 다시 해도 결과가 같아서
사용자가 사진을 바꿔야 한다.
"""

import mediapipe as mp
import numpy as np
from PIL import Image

from src.ai_engine.image_gen import loader, settings
from src.exceptions.api_error import ApiError


def detect_faces(img: Image.Image) -> dict:
    """검출 결과. bbox 는 [x, y, w, h] 픽셀 좌표다.

    Tasks API 는 픽셀 좌표를 돌려준다. 구 API 의 상대 좌표(0~1)와 달라
    폭에 width 를 다시 곱하지 않는다.
    """
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(img))
    result = loader.get_face_detector().detect(mp_img)
    boxes = [
        [
            d.bounding_box.origin_x,
            d.bounding_box.origin_y,
            d.bounding_box.width,
            d.bounding_box.height,
        ]
        for d in result.detections
    ]
    return {"count": len(boxes), "boxes": boxes, "size": img.size}


def validate_image(img: Image.Image) -> ApiError | None:
    """통과하면 None, 실패하면 ApiError.

    호출한 쪽은 이 값을 create_job 의 pre_error 로 넘긴다.
    접수 자체는 성공이므로 4xx 가 아니라 202 뒤 첫 폴링에서 실패를 보여준다.
    """
    result = detect_faces(img)

    if result["count"] == 0:
        return ApiError(
            422,
            "FACE_NOT_DETECTED",
            "사진에서 얼굴을 찾지 못했습니다. 얼굴이 잘 보이는 사진을 올려주세요.",
        )

    if result["count"] > 1:
        return ApiError(
            422,
            "MULTIPLE_FACES",
            "얼굴이 여러 명 보입니다. 한 명만 나온 사진을 올려주세요.",
        )

    if result["boxes"][0][2] < settings.MIN_FACE_WIDTH:
        return ApiError(
            422,
            "FACE_TOO_SMALL",
            "얼굴이 너무 작게 나왔습니다. 더 가까이서 찍은 사진을 올려주세요.",
        )

    return None
