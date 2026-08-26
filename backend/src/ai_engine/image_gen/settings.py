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
CODEFORMER_PATH = MODELS_DIR / "codeformer.pth"
# facexlib 가 검출·파싱 가중치를 이 폴더 바로 아래에서 찾는다
FACEXLIB_ROOT = MODELS_DIR / "facexlib"

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


CODEFORMER_URLS = {
    CODEFORMER_PATH: (
        "https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth"
    ),
    FACEXLIB_ROOT / "detection_Resnet50_Final.pth": (
        "https://github.com/xinntao/facexlib/releases/download"
        "/v0.1.0/detection_Resnet50_Final.pth"
    ),
    FACEXLIB_ROOT / "parsing_parsenet.pth": (
        "https://github.com/xinntao/facexlib/releases/download"
        "/v0.2.2/parsing_parsenet.pth"
    ),
}

# --- 결과물 ---

RESULT_TTL_HOURS = 24  # 프론트 mock 과 동일
OUTPUT_MAX_SIDE = 2048  # 인스타 권장(1080)의 2배
JPEG_QUALITY = 90
THUMBNAIL_SIDE = 512  # 참조 얼굴 목록용. 원본 1.2MB 를 그대로 보내지 않는다

# --- 조합 5 (프롬프트 모드) ---
COMBO5_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
COMBO5_STRENGTH = 0.8  # 0.6·0.99 와 결과가 같고 0.99 보다 2초 빠르다
COMBO5_STEPS = 30
COMBO5_GUIDANCE = 7.5

# --- 조합 5 GPT 편집 경로 ---
# step3_combo5 (8/25~26) 에서 확정. SDXL 인페인팅은 guidance·얼굴 크롭·어휘
# 어느 레버로도 동물상을 구분하지 못해 OpenAI 이미지 편집으로 바꿨다.
# "sdxl" 로 두면 이전 경로로 돌아간다.
PROMPT_MODE_ENGINE = os.getenv("PROMPT_MODE_ENGINE", "gpt")
GPT_IMAGE_MODEL = os.getenv("GPT_IMAGE_MODEL", "gpt-image-2")
# 실측 29~39초. SDK 기본(600초·재시도 2회)이면 워커 1개가 멈춘 응답을 오래
# 기다린다. 재시도는 job 재시도 경로와 겹치므로 끈다(#197 리뷰).
GPT_TIMEOUT_SEC = 90
GPT_MAX_RETRIES = 0
GPT_CROP_PAD = 1.6  # 얼굴 bbox 긴 변 대비 정사각 크롭 배율
GPT_CROP_SIZE = 1024
# 편집 마스크 = 얼굴 윤곽 +16% − 헤어(팽창 0.077). 윤곽 그대로면 턱 그림자를
# GPT 가 안 건드려 원본 윤곽이 이중으로 남는다. 노트북 값 0.10 을 얼굴 폭
# 기준으로 환산한 값이다.
GPT_EDIT_DILATE_RATIO = 0.16
# 재합성은 얼굴 윤곽이 아니라 세그멘테이션 피부 클래스(face-skin + body-skin)로
# 자른다. 윤곽 기준으로 자르면 GPT 가 원본보다 갸름하게 그렸을 때 경계 블러 띠에
# 원본 턱선이 섞여 선으로 남는다. 피부 클래스 경계는 원본 윤곽 바깥이라 그 안이
# 전부 GPT 픽셀이 된다. 팽창 0 이면 분류 경계가 피부 안쪽에 잡혀 한 줄 남고,
# 2% 에서 사라진다(salon 5장 × 3종 + 여우상 재생성 6장 확인).
GPT_SKIN_DILATE_RATIO = 0.02
# 1.0 이면 원본 화장(립스틱)이 결과로 넘어온다. 0.3 이 목 톤은 맞추면서
# 안 넘어오는 값. L 채널만 올려도 얼굴 밝기 차이 1~3 으로 육안 차이 없음.
GPT_COLOR_ALPHA = 0.3

# --- 조합 3 (참조 얼굴 모드) ---
# step1_combo2_3_instantid 에서 확정

COMBO3_BASE = "SG161222/RealVisXL_V5.0"
COMBO3_CONTROLNET_REPO = "InstantX/InstantID"
COMBO3_STRENGTH = 0.4  # 0.7 부터 헤어·배경이 변형된다
COMBO3_STEPS = 30
COMBO3_GUIDANCE = 5.0
COMBO3_CONTROLNET_SCALE = 0.8
# InstantID 기본값. 그동안 인자가 안 먹어 실제로는 계속 이 값으로 돌았고,
# 조합 3 선정부터의 모든 실험이 0.5 기준이다. 0.8 은 검증된 적이 없다.
COMBO3_IP_ADAPTER_SCALE = 0.5
COMBO3_PROMPT = "a person in a hair salon, natural lighting, photorealistic"
COMBO3_NEGATIVE = "blurry, low quality, deformed, watermark, text"

# --- 공통 ---

FACE_NEGATIVE = "blurry, distorted, deformed face, extra features, cartoon, watermark"
# normal_03 이 365px 로 통과한 실측 기준. OUTPUT_MAX_SIDE 축소본에 적용한다.
# 절대 픽셀이라 원본 크기에 따라 의미가 달라진다. 긴 변 1930 에서 비율 0.181,
# 983 에서 0.356 이다. 생성 시점 얼굴 크기는 비율로만 정해지므로 비율 기준으로
# 바꾸는 것이 맞다. 임계값은 품질이 무너지는 지점을 실측한 뒤 정한다.
MIN_FACE_WIDTH = 350
# D-1 에서 20px 로 정했으나 절대 픽셀이라 얼굴 크기에 따라 의미가 달라졌다.
# 얼굴 폭 104px 에서 19.2%, 226px 에서 8.8% 로 작용해 작은 얼굴의 앞머리를
# 과하게 불렸다. 앞머리가 있는 normal 3장의 20px 비율 중 최대값을 택했다.
# 팽창을 덜 줄이는 보수적인 쪽이다. 폭은 InsightFace bbox 기준이다.
HAIR_DILATE_RATIO = 0.077
# GPT 편집 결과를 되붙일 때 쓰는 헤어 마스크. 팽창 0.077 은 앞머리가 눈꺼풀을
# 덮어 원본 눈이 GPT 눈 위에 겹치므로 못 쓰고, 팽창 0 은 잔머리 사이 톱니 틈에
# GPT 가 그린 머리카락이 박힌다. 닫힘은 틈만 메우고 바깥 경계는 그대로 둔다.
# 침식은 세그멘테이션이 물고 오는 볼 쪽 원본 피부 띠(원본 윤곽선)를 걷어낸다.
# 눈썹 제외는 앞머리가 눈썹에 닿는 사진에서 원본 눈썹 끝이 GPT 눈썹에 겹치는
# 것을 막는다(step3_combo5, 8/26).
# 노트북 값(0.077·0.02·0.03)은 pad 1.6 크롭 상자 폭 기준이라 InsightFace
# 얼굴 폭 기준으로 ×1.6 환산했다.
HAIR_CLOSE_RATIO = 0.123
HAIR_ERODE_RATIO = 0.032
BROW_EXCLUDE_RATIO = 0.048
RECOMPOSE_BLUR = 25  # 마스크 경계가 직선으로 드러나지 않는 값
HAIR_BLUR = 3  # 헤어 경계는 얇아서 크게 잡으면 잔상이 생긴다
COLOR_ALPHA = 1.0  # 색 정합 강도. 3장 모두 단조 개선, 교차점 없음
HIGHFREQ_STRENGTH = 0.5  # 목 피부와 얼굴이 같은 재질로 보이는 경계
# step2_face_restore 에서 확정. 복원 3종 비교에서 CodeFormer 가 유일하게
# 회피를 악화시키지 않았다. w 는 정렬 제거 후 0.3·0.7 재비교로 정했다.
RESTORE_FIDELITY = 0.7

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
