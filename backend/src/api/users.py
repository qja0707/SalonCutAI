from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.db_session.db import get_db
from src.schemas.common import CommonResponse, ErrorResponse
from src.schemas.users import SignupRequest
from src.service.users import signup_user

router = APIRouter(prefix="/users", tags=["유저 관리"])


@router.post(
    "/signup",
    response_model=CommonResponse,
    responses={
        400: {"model": ErrorResponse, "description": "이미 존재하는 아이디입니다."}
    },
)  # 실제 주소: POST /users (회원가입)
def register_user(request: SignupRequest, db: Session = Depends(get_db)):
    result = signup_user(request, db)

    if not result:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

    return CommonResponse(message="회원 가입 성공")
