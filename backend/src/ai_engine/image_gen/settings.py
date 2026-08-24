"""이미지 생성 설정값.

실험으로 확정된 수치를 한곳에 모은다.
값마다 어느 실험에서 나왔는지 주석으로 남긴다. 나중에 값을 의심할 때
근거를 바로 찾을 수 있어야 한다.
"""

import os
from pathlib import Path

# --- 실행 제어 ---

# 모델 로딩 여부. 0이면 API 흐름만 돌고 생성 요청은 실패로 처리한다.
# 로컬 개발과 pytest는 GPU가 없으므로 기본값을 0으로 둔다.
IMAGE_GEN_ENABLED = os.getenv("IMAGE_GEN_ENABLED", "0") == "1"

# --- 경로 ---

# settings.py -> image_gen -> ai_engine -> src -> backend
BACKEND_DIR = Path(__file__).resolve().parents[3]
REPO_DIR = BACKEND_DIR.parent

# 참조 사진은 바뀌지 않아 레포에 함께 둔다.
# 합성용 원본과 목록 표시용 사본이 이름만 다르게 같은 폴더에 있다.
REF_FACES_DIR = REPO_DIR / "asset" / "ref_faces"

# 합성 결과는 레포 밖에 둔다. 재배포나 clean 으로 지워지면 안 된다.
# 지정하지 않으면 레포 상위에 만든다.
STORAGE_DIR = Path(os.getenv("SALON_STORAGE_DIR", str(REPO_DIR.parent / "storage")))
JOB_DIR = STORAGE_DIR / "face_swap"

# --- 모델 파일 ---
# 합쳐서 약 4.6GB 라 git 에 넣지 않는다. 없으면 기동 시 받는다.

MODELS_DIR = Path(os.getenv("SALON_MODELS_DIR", str(STORAGE_DIR / "models")))
CHECKPOINTS_DIR = MODELS_DIR / "checkpoints"
CONTROLNET_DIR = CHECKPOINTS_DIR / "ControlNetModel"
IP_ADAPTER_PATH = CHECKPOINTS_DIR / "ip-adapter.bin"
INSIGHTFACE_ROOT = MODELS_DIR  # insightface 가 models/ 하위에 antelopev2 를 만든다
FACE_LANDMARKER_PATH = MODELS_DIR / "face_landmarker.task"
FACE_DETECTOR_PATH = MODELS_DIR / "blaze_face_short_range.tflite"
SELFIE_SEGMENTER_PATH = MODELS_DIR / "selfie_multiclass.tflite"

# --- 다운로드 주소 ---

MEDIAPIPE_URLS = {
    FACE_LANDMARKER_PATH: (
        "https://storage.googleapis.com/mediapipe-models/face_landmarker"
        "/face_landmarker/float16/1/face_landmarker.task"
    ),
    FACE_DETECTOR_PATH: (
        "https://storage.googleapis.com/mediapipe-models/face_detector"
        "/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
    ),
    SELFIE_SEGMENTER_PATH: (
        "https://storage.googleapis.com/mediapipe-models/image_segmenter"
        "/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
    ),
}

# --- 결과물 ---

RESULT_TTL_HOURS = 24  # 프론트 mock 과 동일
OUTPUT_MAX_SIDE = 2048  # 인스타 권장(1080)의 2배
JPEG_QUALITY = 90
THUMBNAIL_SIDE = 512  # 참조 얼굴 목록용. 원본 1.2MB 를 그대로 보내지 않는다

# --- 조합 5 (프롬프트 모드) ---
# step1_combo5_inpaint 에서 확정

COMBO5_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
COMBO5_STRENGTH = 0.8  # 0.6·0.99 와 결과가 같고 0.99 보다 2초 빠르다
COMBO5_STEPS = 30
COMBO5_GUIDANCE = 7.5

# --- 조합 3 (참조 얼굴 모드) ---
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

# --- 공통 ---

FACE_NEGATIVE = "blurry, distorted, deformed face, extra features, cartoon, watermark"
MIN_FACE_WIDTH = 350
# D-1 에서 20px 로 정했으나 절대 픽셀이라 얼굴 크기에 따라 의미가 달라졌다.
# 얼굴 폭 104px 에서 19.2%, 226px 에서 8.8% 로 작용해 작은 얼굴의 앞머리를
# 과하게 불렸다. 앞머리가 있는 normal 3장의 20px 비율 중 최대값을 택했다.
# 팽창을 덜 줄이는 보수적인 쪽이다. 폭은 InsightFace bbox 기준이다.
HAIR_DILATE_RATIO = 0.077
RECOMPOSE_BLUR = 25  # 마스크 경계가 직선으로 드러나지 않는 값
HAIR_BLUR = 3  # 헤어 경계는 얇아서 크게 잡으면 잔상이 생긴다
COLOR_ALPHA = 1.0  # 색 정합 강도. 3장 모두 단조 개선, 교차점 없음
HIGHFREQ_STRENGTH = 0.5  # 목 피부와 얼굴이 같은 재질로 보이는 경계
HIGHFREQ_RADIUS = 3

# --- 비율 ---
# step1_postprocess 에서 확정

RATIOS = {"1:1": (1, 1), "4:5": (4, 5), "9:16": (9, 16)}
# URL 에 콜론을 쓸 수 없어 경로 파라미터는 x 표기를 쓴다
RATIO_PATH_MAP = {"1x1": "1:1", "4x5": "4:5", "9x16": "9:16"}

PAD_BLUR_RATIO = 0.10  # 여백 배경 블러. 짧은 변 대비 비율
PAD_DARKEN = 0.92  # 배경 밝기 정합이 들어가면서 쓰지 않는다
PAD_FEATHER_RATIO = 0.02  # 경계선이 드러나지 않게 하는 페더링

# 머리가 창의 이 비율을 넘으면 crop 을 포기한다. 시술 사진의 결과물은
# 머리카락이라 끝이 잘리면 쓸 수 없다. 여백이 생기는 쪽이 낫다 (디스커션 #122)
CROP_HEAD_MARGIN = 0.9

# --- 워터마크 ---

WATERMARK_TEXT = "AI 생성 이미지"  # 문구 확정 시 이 줄만 교체
WATERMARK_WIDTH_RATIO = 0.18
WATERMARK_ALPHA = 0.55
WATERMARK_MARGIN_RATIO = 0.03
WATERMARK_FONT = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
