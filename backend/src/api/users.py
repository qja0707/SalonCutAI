from fastapi import APIRouter, Depends
from src.db_session.db import get_db
from sqlalchemy.orm import Session
from src.schemas.common import CommonResponse
from src.schemas.users import SignupRequest
from src.service.users import signup_user

router = APIRouter(prefix="/users", tags=["유저 관리"])

@router.post("/signup", response_model=CommonResponse)  # 실제 주소: POST /users (회원가입)
def register_user(request: SignupRequest, db: Session = Depends(get_db)):
    result = signup_user(request, db)

    if result:
        return CommonResponse(message="회원가입 성공")
    else:
        return CommonResponse(message="이미 존재하는 아이디입니다.")
