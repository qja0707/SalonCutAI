"""얼굴 교체 job 생명주기.

접수 → 큐 적재 → 워커 처리 → 완료·실패까지를 담당한다.
라우터는 HTTP 만 알고, 이미지 생성은 image_gen 이 알고,
그 사이를 이 모듈이 잇는다.

IMAGE_GEN_ENABLED 가 0 이면 실제 추론 없이 더미 이미지를 만든다.
API 흐름과 프론트 계약을 GPU 없이 검증하기 위한 것이다.
"""

import json
import logging
import random
import uuid
from datetime import UTC, datetime, timedelta

from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

from src.ai_engine.image_gen import job_queue, settings, storage
from src.db_session.db import SessionLocal
from src.db_session.face_swap_model import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_PROCESSING,
    STATUS_QUEUED,
    FaceSwapJobModel,
)
from src.exceptions.api_error import ApiError, new_request_id
from src.schemas.face_swap import CreateJobPayload, JobResponse

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(dt: datetime | None) -> str:
    """프론트 mock 이 toISOString() 결과를 쓰므로 같은 형태로 맞춘다."""
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat().replace("+00:00", "Z")


def _new_test_code() -> str:
    """mock 이 T- + 4자리 형식이라 형식만 맞춘다."""
    return f"T-{random.randint(1000, 9999)}"


# --- 조회 ---


def get_job_or_404(db: Session, job_id: str) -> FaceSwapJobModel:
    job = db.get(FaceSwapJobModel, job_id)
    if job is None:
        raise ApiError(404, "JOB_NOT_FOUND", "작업을 찾을 수 없습니다.")
    return job


def to_response(job: FaceSwapJobModel) -> JobResponse:
    """DB 레코드를 프론트 계약 형태로 옮긴다.

    results 는 completed 일 때만 채운다. status 가 completed 인데 results 가
    비어 있으면 화면이 "만들고 있습니다" 에서 영원히 멈춘다.
    """
    results = json.loads(job.results_json) if job.results_json else None
    meta = json.loads(job.meta_json) if job.meta_json else None
    error = json.loads(job.error_json) if job.error_json else None

    created = job.created_at or _now()
    expires = created + timedelta(hours=settings.RESULT_TTL_HOURS)

    return JobResponse(
        job_id=job.id,
        test_code=job.test_code,
        status=job.status,
        attempt=job.attempt,
        queue_position=(
            job_queue.position(job.id) if job.status == STATUS_QUEUED else None
        ),
        results=results,
        meta=meta,
        error=error,
        consent_recorded_at=_iso(job.consent_recorded_at),
        created_at=_iso(created),
        updated_at=_iso(job.updated_at or created),
        source_expires_at=_iso(expires),
        result_expires_at=_iso(expires),
        request_id=new_request_id(),
    )


# --- 접수 ---


def create_job(
    db: Session,
    payload: CreateJobPayload,
    image_bytes: bytes,
    pre_error: ApiError | None = None,
) -> FaceSwapJobModel:
    """job 을 만들고 큐에 넣는다.

    pre_error 는 얼굴 사전 검증 실패다. 이 경우 job 은 만들되 큐에 넣지 않고
    바로 failed 로 확정한다. 접수 자체는 성공했으므로 4xx 가 아니라
    202 + 첫 폴링에서 failed 를 보여줘야 한다는 계약을 지키면서
    GPU 도 쓰지 않기 위해서다.
    """
    job_id = f"face-{uuid.uuid4()}"
    now = _now()

    job = FaceSwapJobModel(
        id=job_id,
        test_code=_new_test_code(),
        status=STATUS_QUEUED,
        attempt=1,
        payload_json=payload.model_dump_json(),
        consent_recorded_at=now,
    )
    db.add(job)
    db.commit()

    storage.save_source(job_id, image_bytes)

    if pre_error is not None:
        _mark_failed(db, job, pre_error)
        return job

    job_queue.enqueue(job_id)
    return job


# --- 재시도 ---


def retry_job(db: Session, job_id: str) -> FaceSwapJobModel:
    """실패한 job 을 다시 큐에 넣는다.

    상태를 큐에 넣기 전에 processing 으로 바꾸고 커밋한다.
    프론트가 retry 직후 한 번 조회하는데 그때 failed 가 오면
    실패 화면에서 그대로 굳는다.
    """
    job = get_job_or_404(db, job_id)

    if job.status != STATUS_FAILED:
        raise ApiError(409, "NOT_RETRYABLE", "재시도할 수 없는 상태입니다.")

    error = json.loads(job.error_json) if job.error_json else {}
    if not error.get("retryable"):
        raise ApiError(
            409, "NOT_RETRYABLE", "이 오류는 다시 시도해도 같은 결과가 나옵니다."
        )

    job.attempt += 1
    job.status = STATUS_PROCESSING
    job.error_json = None
    db.commit()

    job_queue.enqueue(job_id)
    return job


def delete_job(db: Session, job_id: str) -> None:
    job = get_job_or_404(db, job_id)
    if job.status in (STATUS_QUEUED, STATUS_PROCESSING):
        raise ApiError(409, "JOB_IN_PROGRESS", "진행 중인 작업은 삭제할 수 없습니다.")
    storage.delete_job_files(job_id)
    db.delete(job)
    db.commit()


# --- 처리 ---


def _mark_failed(db: Session, job: FaceSwapJobModel, err: ApiError) -> None:
    job.status = STATUS_FAILED
    job.error_json = json.dumps(
        {"code": err.code, "message": err.message, "retryable": err.retryable},
        ensure_ascii=False,
    )
    db.commit()


def _placeholder(job_id: str, ratio_key: str, size: tuple[int, int]) -> Image.Image:
    """IMAGE_GEN_ENABLED 가 0 일 때 쓰는 더미 이미지.

    실제 사진 대신 규격과 job_id 만 그린다. 프론트가 3규격을 제대로
    받아 그리는지 확인하는 용도라 내용은 중요하지 않다.
    """
    img = Image.new("RGB", size, (232, 226, 240))
    d = ImageDraw.Draw(img)
    d.text((20, 20), f"{ratio_key}\n{job_id[:16]}", fill=(80, 70, 90))
    return img


def process_job(job_id: str) -> None:
    """워커 스레드가 부른다. 세션을 직접 열고 닫는다.

    요청 스레드의 세션은 응답과 함께 닫히므로 여기서 재사용할 수 없다.
    """
    db = SessionLocal()
    try:
        job = db.get(FaceSwapJobModel, job_id)
        if job is None:
            logger.warning("없는 job: %s", job_id)
            return

        job.status = STATUS_PROCESSING
        db.commit()

        payload = CreateJobPayload.model_validate_json(job.payload_json)
        seed = payload.options.seed or random.randint(0, 2**31 - 1)

        started = _now()

        if settings.IMAGE_GEN_ENABLED:
            # Layer 2 에서 채운다. 지금은 여기 오면 실패로 둔다.
            raise ApiError(
                500,
                "IMAGE_GENERATION_FAILED",
                "이미지 생성에 실패했습니다. 다시 시도해주세요.",
                retryable=True,
            )

        results: dict[str, dict] = {}
        sizes = {"1x1": (600, 600), "4x5": (600, 750), "9x16": (540, 960)}
        for ratio_key, size in sizes.items():
            img = _placeholder(job_id, ratio_key, size)
            storage.save_result(job_id, ratio_key, img)
            results[settings.RATIO_PATH_MAP[ratio_key]] = {
                "url": f"/api/v1/face-swap-jobs/{job_id}/images/{ratio_key}",
                "format_mode": "crop" if ratio_key != "9x16" else "fit_pad",
            }

        gen_sec = round((_now() - started).total_seconds(), 1)

        job.results_json = json.dumps(results, ensure_ascii=False)
        job.meta_json = json.dumps({"seed": seed, "gen_sec": gen_sec})
        job.error_json = None
        job.status = STATUS_COMPLETED
        db.commit()

    except ApiError as err:
        job = db.get(FaceSwapJobModel, job_id)
        if job is not None:
            _mark_failed(db, job, err)
    except Exception:
        logger.exception("job 처리 실패: %s", job_id)
        job = db.get(FaceSwapJobModel, job_id)
        if job is not None:
            _mark_failed(
                db,
                job,
                ApiError(
                    500,
                    "IMAGE_GENERATION_FAILED",
                    "이미지 생성에 실패했습니다. 다시 시도해주세요.",
                    retryable=True,
                ),
            )
    finally:
        db.close()


def recover_stale_jobs() -> None:
    """기동 시 queued·processing 으로 남은 job 을 정리한다.

    배포 timer 가 5분마다 salon-api 를 재시작하는데 그때 진행 중이던
    job 이 유실된다. 그대로 두면 프론트가 무한 폴링에 빠지므로
    재시도 가능한 실패로 바꿔준다.
    """
    db = SessionLocal()
    try:
        stale = (
            db.query(FaceSwapJobModel)
            .filter(FaceSwapJobModel.status.in_([STATUS_QUEUED, STATUS_PROCESSING]))
            .all()
        )
        for job in stale:
            _mark_failed(
                db,
                job,
                ApiError(
                    500,
                    "IMAGE_GENERATION_FAILED",
                    "서버가 재시작되어 작업이 중단되었습니다. 다시 시도해주세요.",
                    retryable=True,
                ),
            )
        if stale:
            logger.info("중단된 job %d 건 정리", len(stale))
    finally:
        db.close()


# 워커가 부를 함수를 등록한다. 순환 import 를 피하려고 여기서 넘긴다.
job_queue.set_processor(process_job)
