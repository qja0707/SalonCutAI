from fastapi import APIRouter
from src.api import text_gen

# 메인 총괄 라우터 생성
api_router = APIRouter()

# 총괄 라우터에 하위 라우터들을 모두 심어줍니다.
api_router.include_router(text_gen.router)