import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from src.db_session.db import get_db
from src.schemas.auth import RefreshRequest, SigninRequest, SigninResponse
from src.schemas.common import ErrorResponse
from src.service.auth import signin_user, token_refresh_with_verify

router = APIRouter(prefix="/auth", tags=["유저 로그인 및 토큰 재발급등 인증 관련"])


@router.post(
    "/signin",
    response_model=SigninResponse,
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "로그인 실패",
        }
    },
)
def signin(payload: SigninRequest, db=Depends(get_db)):
    token = signin_user(payload, db)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 혹은 비밀번호가 일치하지 않습니다",
        )

    return token


@router.post(
    "/token-refresh",
    response_model=SigninResponse,
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "잘못된 접근입니다.",
        }
    },
)
def token_refresh(payload: RefreshRequest, db=Depends(get_db)):
    try:
        response = token_refresh_with_verify(payload.refresh_token, db)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 접근입니다."
        )

    return response
