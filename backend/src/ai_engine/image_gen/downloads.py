"""모델 파일 확보.

합쳐서 약 4.6GB 라 git 에 넣지 않는다. 없으면 받고 있으면 건너뛴다.
VM 에서 수동 배치를 하지 않아도 되게 하려는 것이다.

RealVisXL 과 SDXL 인페인팅은 from_pretrained 가 알아서 캐시하므로
여기서 다루지 않는다.
"""

import logging
import urllib.request

from huggingface_hub import hf_hub_download

from src.ai_engine.image_gen import settings

logger = logging.getLogger(__name__)

# InstantID 의 ControlNet 과 IP-Adapter 가 있는 저장소
INSTANTID_REPO = "InstantX/InstantID"


def _download_url(url: str, dest) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def _fetch_instantid() -> None:
    """ControlNetModel 과 ip-adapter.bin 을 받는다.

    hf_hub_download 는 저장소 안의 경로 구조를 그대로 쓴다.
    local_dir 를 checkpoints 로 주면 ControlNetModel/ 하위에 풀린다.
    """
    targets = [
        "ControlNetModel/config.json",
        "ControlNetModel/diffusion_pytorch_model.safetensors",
        "ip-adapter.bin",
    ]
    settings.CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    for name in targets:
        if (settings.CHECKPOINTS_DIR / name).exists():
            continue
        logger.info("InstantID 파일 받는 중: %s", name)
        hf_hub_download(
            repo_id=INSTANTID_REPO,
            filename=name,
            local_dir=str(settings.CHECKPOINTS_DIR),
        )


def _fetch_mediapipe() -> None:
    for dest, url in settings.MEDIAPIPE_URLS.items():
        if dest.exists():
            continue
        logger.info("MediaPipe 모델 받는 중: %s", dest.name)
        _download_url(url, dest)


def ensure_models() -> None:
    """필요한 파일이 모두 있는 상태로 만든다.

    antelopev2 는 insightface 가 FaceAnalysis 생성 시점에 직접 받으므로
    여기서는 폴더만 준비한다.
    """
    settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    _fetch_instantid()
    _fetch_mediapipe()
    logger.info("모델 파일 준비 완료")


def missing_files() -> list[str]:
    """없는 파일 목록을 돌려준다. 기동 로그와 테스트에서 쓴다."""
    required = [
        settings.CONTROLNET_DIR / "config.json",
        settings.CONTROLNET_DIR / "diffusion_pytorch_model.safetensors",
        settings.IP_ADAPTER_PATH,
        settings.FACE_LANDMARKER_PATH,
        settings.SELFIE_SEGMENTER_PATH,
    ]
    return [str(p) for p in required if not p.exists()]
