"""모델 로딩과 상주.

파이프라인 두 개와 보조 모델 세 개를 프로세스에 한 번만 올리고 재사용한다.
요청마다 로딩하면 10초가 매번 더 붙는다.

두 파이프라인 동시 상주 시 생성 피크가 21.4GB 다(Colab L4 실측).
L4 가 23GB 라 여유가 1.6GB 뿐이므로 워커 1개 순차 처리를 전제로 한다.
동시에 두 요청이 돌면 OOM 이 난다.
"""

import logging
import threading

from src.ai_engine.image_gen import downloads, settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_combo3 = None
_combo5 = None
_face_app = None
_landmarker = None
_segmenter = None
_face_detector = None
_codeformer = None
_face_helper = None


def _require_enabled() -> None:
    if not settings.IMAGE_GEN_ENABLED:
        raise RuntimeError("IMAGE_GEN_ENABLED 가 0 이라 모델을 올리지 않는다.")


def get_combo5():
    """프롬프트 모드 파이프라인. SDXL 인페인팅."""
    global _combo5
    if _combo5 is not None:
        return _combo5

    _require_enabled()
    with _lock:
        if _combo5 is not None:
            return _combo5

        import torch
        from diffusers import AutoPipelineForInpainting

        logger.info("조합 5 로딩 시작")
        _combo5 = AutoPipelineForInpainting.from_pretrained(
            settings.COMBO5_MODEL,
            torch_dtype=torch.float16,
            variant="fp16",
            use_safetensors=True,
        ).to("cuda")
        logger.info("조합 5 로딩 완료")
    return _combo5


def get_combo3():
    """참조 얼굴 모드 파이프라인. InstantID + RealVisXL."""
    global _combo3
    if _combo3 is not None:
        return _combo3

    _require_enabled()
    with _lock:
        if _combo3 is not None:
            return _combo3

        import torch
        from diffusers.models import ControlNetModel

        from src.ai_engine.image_gen.vendor.pipeline_stable_diffusion_xl_instantid_img2img import (
            StableDiffusionXLInstantIDImg2ImgPipeline,
        )

        logger.info("조합 3 로딩 시작")
        controlnet = ControlNetModel.from_pretrained(
            str(settings.CONTROLNET_DIR), torch_dtype=torch.float16
        )
        _combo3 = StableDiffusionXLInstantIDImg2ImgPipeline.from_pretrained(
            settings.COMBO3_BASE,
            controlnet=controlnet,
            torch_dtype=torch.float16,
        ).to("cuda")
        _combo3.load_ip_adapter_instantid(str(settings.IP_ADAPTER_PATH))
        logger.info("조합 3 로딩 완료")
    return _combo3


def get_codeformer():
    """CodeFormer 얼굴 복원 모델. 재합성 뒤 얼굴을 다시 그린다."""
    global _codeformer
    if _codeformer is not None:
        return _codeformer

    _require_enabled()
    with _lock:
        if _codeformer is not None:
            return _codeformer

        import torch

        from src.ai_engine.image_gen.vendor.codeformer_arch import CodeFormer

        logger.info("CodeFormer 로딩 시작")
        net = CodeFormer(
            dim_embd=512,
            codebook_size=1024,
            n_head=8,
            n_layers=9,
            connect_list=["32", "64", "128", "256"],
        )
        state = torch.load(settings.CODEFORMER_PATH, map_location="cpu")
        net.load_state_dict(state["params_ema"])
        # GPU 는 두 파이프라인으로 꽉 차 CPU 로 돌린다. 512 한 장에 5초 안팎(Colab 2코어)
        _codeformer = net.eval()
        logger.info("CodeFormer 로딩 완료")
    return _codeformer


def get_face_helper():
    """facexlib 정렬·되붙이기 도우미. 복원용 512 정렬에 쓴다.

    검출기는 RetinaFace 다. 조합 3 의 InsightFace 와 별개인데,
    복원 실험이 이 조합으로 이뤄져 같은 것을 쓴다.
    """
    global _face_helper
    if _face_helper is not None:
        return _face_helper

    _require_enabled()
    with _lock:
        if _face_helper is not None:
            return _face_helper

        from facexlib.utils.face_restoration_helper import FaceRestoreHelper

        logger.info("FaceRestoreHelper 로딩 시작")
        _face_helper = FaceRestoreHelper(
            upscale_factor=1,
            face_size=512,
            crop_ratio=(1, 1),
            det_model="retinaface_resnet50",
            save_ext="png",
            use_parse=True,
            device="cpu",
            model_rootpath=str(settings.FACEXLIB_ROOT),
        )
        logger.info("FaceRestoreHelper 로딩 완료")
    return _face_helper


def get_face_app():
    """InsightFace. 얼굴 검출과 임베딩 추출에 쓴다.

    CPU 로 돌린다. GPU 판은 numpy·protobuf 가 충돌한다.
    """
    global _face_app
    if _face_app is not None:
        return _face_app

    with _lock:
        if _face_app is not None:
            return _face_app

        from insightface.app import FaceAnalysis

        logger.info("InsightFace 로딩 시작")
        downloads.ensure_antelopev2()
        try:
            _face_app = FaceAnalysis(
                name="antelopev2",
                root=str(settings.INSIGHTFACE_ROOT),
                providers=["CPUExecutionProvider"],
            )
        except AssertionError:
            # 첫 실행에서 zip 을 막 받은 경우다. 폴더를 펴고 한 번 더 시도한다.
            downloads.ensure_antelopev2()
            _face_app = FaceAnalysis(
                name="antelopev2",
                root=str(settings.INSIGHTFACE_ROOT),
                providers=["CPUExecutionProvider"],
            )
        _face_app.prepare(ctx_id=-1, det_size=(640, 640))
        logger.info("InsightFace 로딩 완료")
    return _face_app


def get_landmarker():
    """MediaPipe 얼굴 랜드마크 478점. 얼굴 윤곽 마스크에 쓴다."""
    global _landmarker
    if _landmarker is not None:
        return _landmarker

    with _lock:
        if _landmarker is not None:
            return _landmarker

        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        _landmarker = vision.FaceLandmarker.create_from_options(
            vision.FaceLandmarkerOptions(
                base_options=mp_python.BaseOptions(
                    model_asset_path=str(settings.FACE_LANDMARKER_PATH)
                ),
                num_faces=1,
            )
        )
    return _landmarker


def get_face_detector():
    """MediaPipe 얼굴 검출. 사전 검증에 쓴다.

    조합 3 의 InsightFace 와 별개다. 350px 기준이 이 검출기로 측정한
    값이므로 같은 것을 써야 판정이 실험과 맞는다.
    """
    global _face_detector
    if _face_detector is not None:
        return _face_detector

    with _lock:
        if _face_detector is not None:
            return _face_detector

        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        _face_detector = vision.FaceDetector.create_from_options(
            vision.FaceDetectorOptions(
                base_options=mp_python.BaseOptions(
                    model_asset_path=str(settings.FACE_DETECTOR_PATH)
                ),
                min_detection_confidence=0.5,
            )
        )
    return _face_detector


def get_segmenter():
    """MediaPipe 세그멘테이션. 헤어·목 영역을 나눈다."""
    global _segmenter
    if _segmenter is not None:
        return _segmenter

    with _lock:
        if _segmenter is not None:
            return _segmenter

        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        _segmenter = vision.ImageSegmenter.create_from_options(
            vision.ImageSegmenterOptions(
                base_options=mp_python.BaseOptions(
                    model_asset_path=str(settings.SELFIE_SEGMENTER_PATH)
                ),
                output_category_mask=True,
            )
        )
    return _segmenter


def warmup() -> None:
    """기동 시 백그라운드 스레드에서 부른다.

    lifespan 에서 동기로 부르면 배포 스크립트의 health 확인이 타임아웃된다.
    """
    if not settings.IMAGE_GEN_ENABLED:
        logger.info("IMAGE_GEN_ENABLED 가 0 이라 모델을 올리지 않는다")
        return

    downloads.ensure_models()
    get_face_app()
    get_landmarker()
    get_face_detector()
    get_segmenter()
    get_codeformer()
    get_face_helper()
    get_combo5()
    get_combo3()
    logger.info("모델 준비 완료")
