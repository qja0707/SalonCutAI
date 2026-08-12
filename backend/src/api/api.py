from fastapi import APIRouter

from src.api import auth, text_gen, users, video_jobs

# 메인 총괄 라우터 생성
api_router = APIRouter()

# 총괄 라우터에 하위 라우터들을 모두 심어줍니다.
api_router.include_router(text_gen.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(video_jobs.router)


@api_router.get("/health")
def health():
    return {"status": "ok"}
