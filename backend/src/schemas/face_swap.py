"""얼굴 교체 API 요청·응답 스키마.

프론트 frontend/src/lib/api-client/types.ts 와 필드가 1:1 로 맞아야 한다.
mock 이 내려주는 형태를 그대로 옮겼다.

프론트 계약에서 반드시 지켜야 하는 네 가지를 여기서 보장한다.
  1. status 는 소문자 정확히 네 값
  2. results 는 세 키가 전부 있어야 한다
  3. 오류는 {"error": {...}, "request_id": ...} 형식 (api_error.py 담당)
  4. retry 응답의 status 는 항상 processing
"""

from typing import Literal

from pydantic import BaseModel

JobStatus = Literal["queued", "processing", "completed", "failed"]
FormatMode = Literal["crop", "fit_pad"]
FaceMode = Literal["reference", "prompt"]


# --- 요청 ---


class Consent(BaseModel):
    agreed: bool
    consent_version: str


class FacePromptOptions(BaseModel):
    """선택 4개는 미지정 시 빈 문자열이 온다. null 이나 키 생략이 아니다.

    필드명은 프론트 types.ts 의 FACE_PROMPT_KEYS 와 같아야 한다.
    이름이 다르면 Pydantic 이 값을 조용히 버려서 프롬프트 매핑까지 가지 못한다.
    """

    ethnicity: str
    gender: str
    age: str
    face_style: str = ""
    expression: str = ""
    skin_tone: str = ""
    makeup: str = ""


class FaceReferenceOptions(BaseModel):
    reference_face_id: str


class FaceOption(BaseModel):
    """쓰는 쪽만 채우고 반대쪽은 null 이다. 검증도 이 규칙 하나만 본다."""

    mode: FaceMode
    reference: FaceReferenceOptions | None = None
    prompt: FacePromptOptions | None = None


class JobOptions(BaseModel):
    ratios: list[str]
    seed: int | None = None
    background_mode: Literal["preserve", "replace"]
    background_style: str | None = None
    face: FaceOption


class CreateJobPayload(BaseModel):
    """multipart 의 payload 필드에 JSON 문자열로 담겨 온다."""

    consent: Consent
    options: JobOptions


# --- 응답 ---


class ApiErrorBody(BaseModel):
    code: str
    message: str
    retryable: bool


class ImageResult(BaseModel):
    url: str
    format_mode: FormatMode


class JobMeta(BaseModel):
    seed: int
    gen_sec: float


class CreateJobResponse(BaseModel):
    job_id: str
    test_code: str
    status: JobStatus
    created_at: str
    request_id: str


class JobResponse(BaseModel):
    """상태 조회 응답. mock 이 내려주는 필드를 전부 포함한다.

    results 는 completed 일 때만 채우고, 채울 때는 "1:1"·"4:5"·"9:16"
    세 키가 모두 있어야 한다. 하나라도 빠지면 결과 화면이 렌더링되지 않는다.
    """

    job_id: str
    test_code: str
    status: JobStatus
    attempt: int
    queue_position: int | None = None
    results: dict[str, ImageResult] | None = None
    meta: JobMeta | None = None
    error: ApiErrorBody | None = None
    consent_recorded_at: str
    created_at: str
    updated_at: str
    source_expires_at: str
    result_expires_at: str
    request_id: str


class RetryJobResponse(BaseModel):
    """retry 직후 프론트가 한 번 조회한다. 이때 failed 가 오면 실패 화면에서 굳는다."""

    job_id: str
    status: Literal["processing"]
    attempt: int
    request_id: str


# --- 참조 얼굴 ---


class ReferenceFace(BaseModel):
    id: str
    label: str
    gender: str
    ethnicity: str
    age_group: str
    thumbnail_url: str


class ReferenceFacesResponse(BaseModel):
    """배열을 그대로 두지 않고 감싼다. 개수·페이지 정보를 붙일 자리가 생긴다."""

    items: list[ReferenceFace]
    request_id: str
