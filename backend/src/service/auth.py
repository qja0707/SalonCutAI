import os
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_session.refresh_token_model import RefreshTokenModel
from src.db_session.user_model import UserModel
from src.exceptions.system import SystemStartError
from src.schemas.auth import SigninRequest, SigninResponse, TokenInfo

load_dotenv()

algoritm = "HS256"
access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

password_hash = PasswordHash.recommended()


def get_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY")

    if not secret_key:
        raise SystemStartError("SECRET_KEY is not set")

    return secret_key


def create_jwt(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)

    to_encode.update({"exp": expire})

    secret_key = get_secret_key()

    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=algoritm)

    return encoded_jwt


def make_tokens(user_id: str):
    # make jwt
    access_token_info = {"sub": user_id, "token_type": "access"}
    refresh_token_info = {"sub": user_id, "token_type": "refresh"}

    access_token = create_jwt(access_token_info, expires_delta=timedelta(seconds=10))
    refresh_token = create_jwt(
        refresh_token_info, expires_delta=timedelta(days=refresh_token_expire_days)
    )

    return access_token, refresh_token


def record_refresh_token(user_id: str, refresh_token: str, db: Session):
    hashed_refresh_token = password_hash.hash(refresh_token)

    stmt = select(RefreshTokenModel).where(RefreshTokenModel.user_id == user_id)
    old_refresh_token_obj = db.scalars(stmt).first()

    if old_refresh_token_obj:
        old_refresh_token_obj.token = hashed_refresh_token
    else:
        new_refresh_token_obj = RefreshTokenModel(
            user_id=user_id, token=hashed_refresh_token
        )
        db.add(new_refresh_token_obj)

    db.commit()


def signin_user(request: SigninRequest, db: Session) -> SigninResponse | None:
    id = request.id
    plain_password = request.pw

    user = db.get(UserModel, id)

    if not user:
        return None

    if not password_hash.verify(plain_password, user.password):
        return None

    access_token, refresh_token = make_tokens(user.id)

    record_refresh_token(user.id, refresh_token, db)

    return SigninResponse(access_token=access_token, refresh_token=refresh_token)


def verify_access_token(token: str) -> TokenInfo | None:
    secret_key = get_secret_key()

    payload = jwt.decode(
        token,
        secret_key,
        algorithms=[algoritm],
        options={"require": ["sub", "exp", "token_type"]},
    )

    token_data = TokenInfo(**payload)

    if token_data.token_type != "access":
        raise jwt.InvalidTokenError("access token 이 아닙니다")

    return token_data


def token_refresh_with_verify(token: str, db: Session) -> SigninResponse:
    secret_key = get_secret_key()

    payload = jwt.decode(
        token,
        secret_key,
        algorithms=[algoritm],
        options={"require": ["sub", "exp", "token_type"]},
    )

    token_data = TokenInfo(**payload)

    if token_data.token_type != "refresh":
        raise jwt.InvalidTokenError("refresh token 이 아닙니다")

    stmt = select(RefreshTokenModel).where(token_data.sub == RefreshTokenModel.user_id)
    refresh_token_obj = db.scalars(stmt).first()

    if not refresh_token_obj:
        raise jwt.InvalidTokenError("로그인 기록이 없는 사용자입니다")

    if not password_hash.verify(token, refresh_token_obj.token):
        raise jwt.InvalidTokenError("기존 리프레시 토큰과 일치하지 않습니다")

    access_token, refresh_token = make_tokens(token_data.sub)

    record_refresh_token(token_data.sub, refresh_token, db)

    return SigninResponse(access_token=access_token, refresh_token=refresh_token)
