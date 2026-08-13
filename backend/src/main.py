from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.ai_engine.image_gen import job_queue
from src.api.api import api_router
from src.db_session import face_swap_model  # noqa: F401  테이블 생성을 위해 import 한다
from src.db_session.db import Base, engine
from src.exceptions.api_error import ApiError, api_error_handler
from src.service.auth import get_secret_key
from src.service.face_swap import recover_stale_jobs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 기동 시 중단된 job 을 정리하고 워커를 띄운다.

    배포 timer 가 주기적으로 재시작하는데 그때 진행 중이던 job 이 남아 있으면
    프론트가 무한 폴링에 빠진다. 워커보다 먼저 정리해야 한다.
    """
    recover_stale_jobs()
    job_queue.start_worker()
    yield


app = FastAPI(lifespan=lifespan)

Base.metadata.create_all(bind=engine)

app.include_router(api_router)
app.add_exception_handler(ApiError, api_error_handler)

get_secret_key()


@app.get("/")
def root():
    return {"message": "안녕하세요, 첫 FastAPI 서버입니다!"}
