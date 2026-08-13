"""얼굴 교체 API 전용 예외.

프론트가 기대하는 응답 형식이 FastAPI 기본값과 다르다.

    기본값   {"detail": "..."}
    계약     {"error": {"code", "message", "retryable"}, "request_id": "..."}

`detail` 로 오면 프론트가 서버 문구를 읽지 못하고
"요청에 실패했습니다. (500)" 으로 대체해버린다.

기존 users·auth 라우터는 HTTPException 을 그대로 쓰므로
여기서 만든 핸들러는 ApiError 에만 걸어 그쪽 응답 형식을 건드리지 않는다.
"""

import logging
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def new_request_id() -> str:
    return f"req-{uuid.uuid4()}"


class ApiError(Exception):
    """상태 코드·오류 코드·문구·재시도 가능 여부를 함께 나른다.

    retryable 은 프론트에서 "다시 만들기" 버튼 노출 여부를 결정한다.
    UI 동작을 직접 바꾸는 값이므로 신중히 정한다.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable

    def to_payload(self, request_id: str) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
            },
            "request_id": request_id,
        }


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    request_id = new_request_id()
    logger.warning(
        "%s %s %s %s", request_id, exc.code, request.method, request.url.path
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_payload(request_id),
        headers={"Cache-Control": "no-store"},
    )
