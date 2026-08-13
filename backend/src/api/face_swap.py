"""얼굴 교체 API 라우터.

HTTP 입출력과 요청 검증만 담당한다. job 생명주기는 service 계층이 안다.

인증을 걸지 않는다. 결과 이미지를 <img src> 로 부르는데 그 요청에는
Authorization 헤더를 실을 수 없다. job_id 가 UUID 이고 결과물은
24시간 뒤 만료되므로 추측으로 접근하기 어렵다.
"""

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from src.ai_engine.image_gen import settings, storage
from src.db_session.db import get_db
from src.db_session.face_swap_model import STATUS_COMPLETED
from src.exceptions.api_error import ApiError, new_request_id
from src.schemas.face_swap import (
    CreateJobPayload,
    CreateJobResponse,
    JobResponse,
    RetryJobResponse,
)
from src.service import face_swap as face_swap_service

# 스키마와 서비스의 파일명이 같아 모듈째 별칭으로 가져온다.

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/face-swap-jobs", tags=["얼굴 교체"])


# --- 검증 ---


def _invalid(message: str) -> ApiError:
    """옵션 검증 실패는 전부 같은 코드를 쓴다. 문구로 위치를 구분한다."""
    return ApiError(422, "INVALID_FACE_SWAP_INPUT", message)


def _parse_payload(raw: str) -> CreateJobPayload:
    """multipart 의 payload 문자열을 스키마로 바꾼다."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise _invalid("payload 를 JSON 으로 읽을 수 없습니다.") from None

    try:
        return CreateJobPayload.model_validate(data)
    except ValidationError:
        raise _invalid("payload 형식이 올바르지 않습니다.") from None


def _check_options(payload: CreateJobPayload) -> None:
    """스키마가 못 잡는 값 사이의 관계를 확인한다."""
    options = payload.options

    if not options.ratios:
        raise _invalid("ratios 가 비어 있습니다.")
    for ratio in options.ratios:
        if ratio not in settings.RATIOS:
            raise _invalid(f"지원하지 않는 비율입니다: {ratio}")

    if options.background_mode == "preserve" and options.background_style:
        raise _invalid("배경을 유지할 때는 background_style 을 보내지 않습니다.")
    if options.background_mode == "replace" and not options.background_style:
        raise _invalid("배경을 바꿀 때는 background_style 이 필요합니다.")

    face = options.face
    if face.mode == "reference":
        if face.reference is None or face.prompt is not None:
            raise _invalid("참조 얼굴 모드에는 reference 만 채웁니다.")
        if not storage.ref_face_path(face.reference.reference_face_id).exists():
            raise _invalid("없는 참조 얼굴입니다.")
    else:
        if face.prompt is None or face.reference is not None:
            raise _invalid("프롬프트 모드에는 prompt 만 채웁니다.")


# --- 접수 ---


@router.post("", status_code=202, response_model=CreateJobResponse)
async def create_job(
    image: UploadFile = File(...),
    payload: str = Form(...),
    db: Session = Depends(get_db),
) -> CreateJobResponse:
    if image.content_type not in ALLOWED_TYPES:
        raise ApiError(400, "INVALID_IMAGE_TYPE", "JPG·PNG·WEBP 만 올릴 수 있습니다.")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ApiError(413, "IMAGE_TOO_LARGE", "10MB 이하의 사진만 올릴 수 있습니다.")

    parsed = _parse_payload(payload)

    if not parsed.consent.agreed:
        raise ApiError(400, "CONSENT_REQUIRED", "초상권 동의가 필요합니다.")

    _check_options(parsed)

    job = face_swap_service.create_job(db, parsed, image_bytes)
    created = face_swap_service.to_response(job)

    return CreateJobResponse(
        job_id=created.job_id,
        test_code=created.test_code,
        status=created.status,
        created_at=created.created_at,
        request_id=created.request_id,
    )


# --- 조회 ---


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobResponse:
    job = face_swap_service.get_job_or_404(db, job_id)
    return face_swap_service.to_response(job)


# --- 재시도 ---


@router.post("/{job_id}/retry", status_code=202, response_model=RetryJobResponse)
def retry_job(job_id: str, db: Session = Depends(get_db)) -> RetryJobResponse:
    job = face_swap_service.retry_job(db, job_id)
    return RetryJobResponse(
        job_id=job.id,
        status="processing",
        attempt=job.attempt,
        request_id=new_request_id(),
    )


# --- 삭제 ---


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db)) -> None:
    face_swap_service.delete_job(db, job_id)


# --- 결과 이미지 ---


@router.get("/{job_id}/images/{ratio}")
def get_image(job_id: str, ratio: str, db: Session = Depends(get_db)) -> FileResponse:
    """ratio 는 1x1·4x5·9x16 이다. URL 에 콜론을 쓸 수 없어 x 표기를 쓴다."""
    if ratio not in settings.RATIO_PATH_MAP:
        raise ApiError(404, "RESULT_NOT_FOUND", "없는 비율입니다.")

    job = face_swap_service.get_job_or_404(db, job_id)
    if job.status != STATUS_COMPLETED:
        raise ApiError(409, "JOB_IN_PROGRESS", "아직 만들고 있습니다.")

    path = storage.result_path(job_id, ratio)
    if not path.exists():
        raise ApiError(404, "RESULT_NOT_FOUND", "결과 이미지를 찾을 수 없습니다.")

    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )
