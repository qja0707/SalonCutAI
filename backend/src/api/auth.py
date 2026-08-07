from fastapi import APIRouter
from src.service.auth import signin_user
from fastapi import HTTPException
from src.schemas.auth import SigninRequest, SigninResponse, RefreshRequest
from src.schemas.common import ErrorResponse
from src.db_session.db import get_db
from fastapi import Depends

router = APIRouter(prefix="/auth", tags=["유저 로그인 및 토큰 재발급등 인증 관련"])

@router.post("/signin", 
             response_model=SigninResponse,
             responses={
                 401: {
                     "model": ErrorResponse,
                     "description": "로그인 실패"
                 }
             })  
def signin(payload: SigninRequest, db=Depends(get_db)):
    token = signin_user(payload.id, payload.pw, db)

    if not token:
        raise HTTPException(status_code=401, detail="아이디 혹은 비밀번호가 일치하지 않습니다")
    
    return token

# TODO
@router.post("/refresh", response_model=SigninResponse) 
def refresh_token(payload: RefreshRequest):
    return {"message": "토큰 재발급 성공"}
