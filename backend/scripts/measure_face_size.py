"""생성 시점 얼굴·눈 크기 측정.

검증(validate.py)은 업로드 원본을, 생성은 긴 변 1024 축소본을 본다.
그 사이에 save_source() 의 2048 축소가 끼어 있어 세 단계의 얼굴 크기가
모두 다르다. 각 단계를 재서 MIN_FACE_WIDTH 기준이 생성 품질과 맞는지 본다.

두 세트를 나란히 잰다.
  normal 얼굴이 크게 잡힌 기존 세트
  upper  실사용 구도에 가까운 상반신 세트

GPU 는 쓰지 않는다. MediaPipe 두 모델만 있으면 된다.
"""

import sys
from pathlib import Path

# scripts/ 에서 실행해도 src 를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import mediapipe as mp
import numpy as np
from PIL import Image

from src.ai_engine.image_gen import downloads, loader, settings, validate

IMAGE_DIRS = [Path.home() / "normal", Path.home() / "upper", Path.home() / "phone"]
SDXL_TARGET = 1024
VAE_SCALE = 8
PHONE_LONG_SIDE = 4032  # 아이폰 기본 해상도

# 왼눈 좌우 끝, 오른눈 좌우 끝
EYES = ((33, 133), (362, 263))


# --- 단계별 축소 ---


def to_max_side(img: Image.Image, target: int) -> Image.Image:
    """save_source() 와 같다. 긴 변이 target 을 넘을 때만 줄인다."""
    if max(img.size) <= target:
        return img
    scale = target / max(img.size)
    return img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)


def to_sdxl(img: Image.Image) -> Image.Image:
    """resize_for_sdxl() 과 같다. 8의 배수로 내린다."""
    w, h = img.size
    scale = SDXL_TARGET / max(w, h)
    return img.resize(((int(w * scale) // 8) * 8, (int(h * scale) // 8) * 8))


# --- 측정 ---


def face_width(img: Image.Image):
    """검출기가 보는 얼굴 폭. validate 와 같은 경로를 탄다."""
    r = validate.detect_faces(img)
    if r["count"] != 1:
        return None
    return r["boxes"][0][2]


def eye_width(img: Image.Image):
    """양눈 폭의 평균. 랜드마크는 정규화 좌표라 폭을 곱한다."""
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(img))
    result = loader.get_landmarker().detect(mp_img)
    if not result.face_landmarks:
        return None
    lm = result.face_landmarks[0]
    w = img.width
    return float(np.mean([abs(lm[b].x - lm[a].x) * w for a, b in EYES]))


def judge(fw):
    if fw is None:
        return "검출실패"
    return "통과" if fw >= settings.MIN_FACE_WIDTH else "TOO_SMALL"


# --- 모델 확보 ---

# ensure_models() 는 InstantID 4.6GB 까지 받으므로 MediaPipe 만 확보한다
if any(
    not p.exists() for p in (settings.FACE_LANDMARKER_PATH, settings.FACE_DETECTOR_PATH)
):
    print("MediaPipe 모델을 받는다")
    downloads._fetch_mediapipe()


# --- 폰 사진 흉내 ---

# 실사용자는 폰으로 찍는다. 긴 변 4032 로 키워 검증 통과 여부만 바꾸고
# 생성 시점 얼굴 크기는 그대로인 것을 보인다. 화질은 판정과 무관하다.
phone_dir = Path.home() / "phone"
upper_dir = Path.home() / "upper"
if upper_dir.is_dir():
    phone_dir.mkdir(exist_ok=True)
    for src in sorted(upper_dir.glob("*.jpg")):
        dst = phone_dir / src.name
        if dst.exists():
            continue
        img = Image.open(src).convert("RGB")
        scale = PHONE_LONG_SIDE / max(img.size)
        img.resize(
            (int(img.width * scale), int(img.height * scale)), Image.LANCZOS
        ).save(dst, "JPEG", quality=95)
    print(f"폰 사진 흉내 {len(list(phone_dir.glob('*.jpg')))}장 준비")

# --- 측정 ---

results = {}
for base in IMAGE_DIRS:
    if not base.is_dir():
        print(f"건너뜀: {base} 없음")
        continue

    rows = []
    for path in sorted(
        p for p in base.iterdir() if p.suffix.lower() in {".jpg", ".png"}
    ):
        orig = Image.open(path).convert("RGB")
        saved = to_max_side(orig, settings.OUTPUT_MAX_SIDE)

        fw_orig = face_width(orig)
        fw_saved = face_width(saved)
        ew_gen = eye_width(to_sdxl(saved))

        ratio = fw_orig / max(orig.size) if fw_orig else None
        rows.append(
            {
                "name": path.stem,
                "size": f"{orig.width}x{orig.height}",
                "fw_orig": fw_orig,
                "fw_saved": fw_saved,
                "ratio": ratio,
                "fw_gen": ratio * SDXL_TARGET if ratio else None,
                "ew_gen": ew_gen,
                "latent": ew_gen / VAE_SCALE if ew_gen else None,
            }
        )
    results[base.name] = rows

# --- 출력 ---


def fmt(v, spec=".0f"):
    return "-" if v is None else format(v, spec)


for name, rows in results.items():
    print(f"\n=== {name} ===")
    print(
        f"{'file':<26}{'원본':>11}{'얼굴원본':>9}{'얼굴2048':>9}{'비율':>7}"
        f"{'얼굴생성':>9}{'눈생성':>8}{'latent':>8}{'현재':>10}{'2048':>10}"
    )
    for r in rows:
        print(
            f"{r['name']:<26}{r['size']:>11}{fmt(r['fw_orig']):>9}"
            f"{fmt(r['fw_saved']):>9}{fmt(r['ratio'], '.3f'):>7}"
            f"{fmt(r['fw_gen']):>9}{fmt(r['ew_gen'], '.1f'):>8}"
            f"{fmt(r['latent'], '.1f'):>8}"
            f"{judge(r['fw_orig']):>10}{judge(r['fw_saved']):>10}"
        )

    lat = [r["latent"] for r in rows if r["latent"]]
    if lat:
        print(f"\nlatent 눈 폭   최소 {min(lat):.1f}   최대 {max(lat):.1f}")
