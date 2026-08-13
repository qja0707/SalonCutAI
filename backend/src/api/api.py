from fastapi import APIRouter

from src.api import auth, face_swap, reference_faces, text_gen, users

# 메인 총괄 라우터 생성
api_router = APIRouter(prefix="/api/v1")

# 총괄 라우터에 하위 라우터들을 모두 심어줍니다.
api_router.include_router(text_gen.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(face_swap.router)
api_router.include_router(reference_faces.router)


@api_router.get("/health")
def health():
    return {"status": "ok"}
