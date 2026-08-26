import asyncio
import logging
import threading
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from src.ai_engine.image_gen import job_queue, loader
from src.api.api import api_router
from src.db_session import face_swap_model  # noqa: F401  테이블 생성을 위해 import 한다
from src.db_session.db import Base, engine
from src.exceptions.api_error import ApiError, api_error_handler
from src.service.auth import get_secret_key
from src.service.face_swap import cleanup_expired_jobs_once, recover_stale_jobs

FACE_SWAP_CLEANUP_INTERVAL_SECONDS = 5 * 60


def _warmup() -> None:
    """모델을 미리 올린다. 실패해도 서버는 떠 있어야 한다."""
    try:
        loader.warmup()
    except Exception:
        logging.getLogger(__name__).exception("모델 준비 실패")


async def _run_face_swap_cleanup() -> None:
    """파일 I/O 와 SQLite 정리를 이벤트 루프 밖에서 실행한다."""
    try:
        await asyncio.to_thread(cleanup_expired_jobs_once)
    except Exception:
        logging.getLogger(__name__).exception("만료 얼굴 교체 job 정리 실패")


async def _cleanup_face_swap_periodically() -> None:
    """접근이 없는 만료 결과도 최대 5분 안에 정리한다."""
    while True:
        await asyncio.sleep(FACE_SWAP_CLEANUP_INTERVAL_SECONDS)
        await _run_face_swap_cleanup()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 기동 시 중단된 job 을 정리하고 워커를 띄운다.

    배포 timer 가 주기적으로 재시작하는데 그때 진행 중이던 job 이 남아 있으면
    프론트가 무한 폴링에 빠진다. 워커보다 먼저 정리해야 한다.

    모델 로딩은 별도 스레드에서 한다. 여기서 동기로 올리면 1~2분 걸려
    배포 스크립트의 health 확인이 타임아웃된다.
    """
    recover_stale_jobs()
    await _run_face_swap_cleanup()
    job_queue.start_worker()
    threading.Thread(target=_warmup, daemon=True).start()
    cleanup_task = asyncio.create_task(_cleanup_face_swap_periodically())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


app = FastAPI(lifespan=lifespan)

Base.metadata.create_all(bind=engine)

app.include_router(api_router)
app.add_exception_handler(ApiError, api_error_handler)

get_secret_key()


@app.get("/")
def root():
    return {"message": "안녕하세요, 첫 FastAPI 서버입니다!"}
