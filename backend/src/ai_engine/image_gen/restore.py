"""얼굴 복원. 재합성 결과의 얼굴을 CodeFormer 로 다시 그린다.

step2_face_restore 의 흐름을 그대로 옮겼다.
검출 → 512 정렬 → 복원 → 원본 자리에 되붙이기. 정렬과 되붙이기는
facexlib 의 FaceRestoreHelper 가 한다.

복원은 얼굴만 다시 그리고 나머지는 건드리지 않는다. 다만 파싱 마스크
경계가 얼굴 밖 조명 톤을 지우므로 이 함수 뒤에 색 정합을 한 번 더 한다.
"""

import logging

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision.transforms.functional import normalize

from src.ai_engine.image_gen import loader, settings

logger = logging.getLogger(__name__)


def _restore_512(face_bgr: np.ndarray) -> np.ndarray:
    """정렬된 512 얼굴 한 장을 복원한다. 입출력 모두 BGR uint8."""
    net = loader.get_codeformer()
    device = next(net.parameters()).device

    rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    t = torch.from_numpy(rgb.transpose(2, 0, 1))
    normalize(t, (0.5,) * 3, (0.5,) * 3, inplace=True)
    t = t.unsqueeze(0).to(device)

    with torch.no_grad():
        out = net(t, w=settings.RESTORE_FIDELITY, adain=True)[0]

    out = out.squeeze(0).float().clamp_(-1, 1).cpu().numpy()
    out = (out + 1) / 2
    out = (out.transpose(1, 2, 0) * 255.0).round().astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_RGB2BGR)


def restore(img: Image.Image) -> Image.Image:
    """이미지 안의 얼굴을 복원해 돌려준다. 얼굴을 못 찾으면 그대로 돌려준다."""
    helper = loader.get_face_helper()
    bgr = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)

    helper.clean_all()
    helper.read_image(bgr)
    helper.get_face_landmarks_5(
        only_center_face=False, resize=640, eye_dist_threshold=5
    )
    helper.align_warp_face()

    if not helper.cropped_faces:
        logger.warning("복원할 얼굴을 찾지 못해 건너뛴다")
        return img

    for cropped in helper.cropped_faces:
        helper.add_restored_face(_restore_512(cropped))

    helper.get_inverse_affine(None)
    out = helper.paste_faces_to_input_image()
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
