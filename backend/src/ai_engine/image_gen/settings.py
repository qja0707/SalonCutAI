"""이미지 생성 설정값.

실험으로 확정된 수치를 한곳에 모은다.
값마다 어느 실험에서 나왔는지 주석으로 남긴다. 나중에 값을 의심할 때
근거를 바로 찾을 수 있어야 한다.
"""

import os
from pathlib import Path

# --- 실행 제어 -----------------------------------------------------------

# 모델 로딩 여부. 0이면 API 흐름만 돌고 생성 요청은 실패로 처리한다.
# 로컬 개발과 pytest는 GPU가 없으므로 기본값을 0으로 둔다.
IMAGE_GEN_ENABLED = os.getenv("IMAGE_GEN_ENABLED", "0") == "1"

# --- 경로 ---------------------------------------------------------------

# settings.py -> image_gen -> ai_engine -> src -> backend
STORAGE_DIR = Path(__file__).resolve().parents[3] / "storage"
REF_FACES_DIR = STORAGE_DIR / "ref_faces"
REF_THUMB_DIR = REF_FACES_DIR / "thumb"
JOB_DIR = STORAGE_DIR / "face_swap"

# --- 결과물 ------------------------------------------------------------

RESULT_TTL_HOURS = 24  # 프론트 mock 과 동일
OUTPUT_MAX_SIDE = 2048  # 인스타 권장(1080)의 2배
JPEG_QUALITY = 90
THUMBNAIL_SIDE = 320  # 참조 얼굴 목록용. 원본 1.2MB 를 그대로 보내지 않는다

# --- 조합 5 (프롬프트 모드) ----------------------------------------------
# step1_combo5_inpaint 에서 확정

COMBO5_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
COMBO5_STRENGTH = 0.8  # 0.6·0.99 와 결과가 같고 0.99 보다 2초 빠르다
COMBO5_STEPS = 30
COMBO5_GUIDANCE = 7.5

# --- 조합 3 (참조 얼굴 모드) ---------------------------------------------
# step1_combo2_3_instantid 에서 확정

COMBO3_BASE = "SG161222/RealVisXL_V5.0"
COMBO3_CONTROLNET_REPO = "InstantX/InstantID"
COMBO3_STRENGTH = 0.4  # 0.7 부터 헤어·배경이 변형된다
COMBO3_STEPS = 30
COMBO3_GUIDANCE = 5.0
COMBO3_CONTROLNET_SCALE = 0.8
COMBO3_IP_ADAPTER_SCALE = 0.8
COMBO3_PROMPT = "a person in a hair salon, natural lighting, photorealistic"
COMBO3_NEGATIVE = "blurry, low quality, deformed, watermark, text"

# --- 공통 ---------------------------------------------------------------

FACE_NEGATIVE = "blurry, distorted, deformed face, extra features, cartoon, watermark"
MIN_FACE_WIDTH = 350  # normal_03 이 365px 로 통과한 실측 기준
HAIR_DILATE_PX = 20  # 앞머리 SSIM 과 초상권 회피의 균형점 (D-1)
RECOMPOSE_BLUR = 25  # 마스크 경계가 직선으로 드러나지 않는 값
HAIR_BLUR = 3  # 헤어 경계는 얇아서 크게 잡으면 잔상이 생긴다
COLOR_ALPHA = 1.0  # 색 정합 강도. 3장 모두 단조 개선, 교차점 없음
HIGHFREQ_STRENGTH = 0.5  # 목 피부와 얼굴이 같은 재질로 보이는 경계
HIGHFREQ_RADIUS = 3

# --- 비율 ---------------------------------------------------------------
# step1_postprocess 에서 확정

RATIOS = {"1:1": (1, 1), "4:5": (4, 5), "9:16": (9, 16)}
# URL 에 콜론을 쓸 수 없어 경로 파라미터는 x 표기를 쓴다
RATIO_PATH_MAP = {"1x1": "1:1", "4x5": "4:5", "9x16": "9:16"}

PAD_BLUR_RATIO = 0.10  # 여백 배경 블러. 짧은 변 대비 비율
PAD_DARKEN = 0.92  # 원본과 배경의 밝기를 살짝 벌린다
PAD_FEATHER_RATIO = 0.02  # 경계선이 드러나지 않게 하는 페더링

# --- 워터마크 -----------------------------------------------------------

WATERMARK_TEXT = "AI 생성 이미지"  # 문구 확정 시 이 줄만 교체
WATERMARK_WIDTH_RATIO = 0.18
WATERMARK_ALPHA = 0.55
WATERMARK_MARGIN_RATIO = 0.03
WATERMARK_FONT = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
