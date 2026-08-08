from fastapi import APIRouter, Depends, HTTPException, status

from src.db_session.db import get_db
from src.schemas.auth import SigninRequest, SigninResponse
from src.schemas.common import ErrorResponse
from src.service.auth import signin_user

router = APIRouter(prefix="/auth", tags=["유저 로그인 및 토큰 재발급등 인증 관련"])

@router.post("/signin", 
             response_model=SigninResponse,
             responses={
                 status.HTTP_401_UNAUTHORIZED: {
                     "model": ErrorResponse,
                     "description": "로그인 실패"
                 }
             })  
def signin(payload: SigninRequest, db=Depends(get_db)):
    token = signin_user(payload, db)

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 혹은 비밀번호가 일치하지 않습니다")
    
    return token

