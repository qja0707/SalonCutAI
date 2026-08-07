import os
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_session.refresh_token_model import RefreshTokenModel
from src.db_session.user_model import UserModel
from src.exceptions.auth import InvalidTokenError, TokenExpiredError
from src.schemas.auth import SigninRequest, SigninResponse, TokenInfo

load_dotenv()
secret_key = os.getenv("SECRET_KEY")
algoritm = "HS256"
access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES","30"))
refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS","7"))

password_hash = PasswordHash.recommended()

def create_jwt(data: TokenInfo, expires_delta: timedelta | None = None):
    to_encode = data
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)
    to_encode.expire = expire.isoformat()
    encoded_jwt = jwt.encode(to_encode.model_dump(), secret_key, algorithm=algoritm)

    return encoded_jwt

def signin_user(request: SigninRequest, db:Session)->SigninResponse | None:
    id = request.id
    plain_password = request.pw

    user = db.get(UserModel, id)

    if not user:
        return None

    if not password_hash.verify(plain_password, user.password):
        return None

    # make jwt
    token_info = TokenInfo(user_id=user.id, expire=None)

    access_token = create_jwt(token_info, expires_delta=timedelta(minutes=access_token_expire_minutes))
    refresh_token = create_jwt(token_info, expires_delta=timedelta(days=7))

    stmt = select(RefreshTokenModel).where(RefreshTokenModel.user_id == user.id)
    old_refresh_token_obj = db.scalars(stmt).first()
    
    if old_refresh_token_obj:
        old_refresh_token_obj.token = refresh_token
    else:
        new_refresh_token_obj = RefreshTokenModel(user_id=user.id, token=refresh_token)
        db.add(new_refresh_token_obj)

    db.commit()

    return SigninResponse(access_token=access_token, refresh_token=refresh_token)

def verify_access_token(token:str)->TokenInfo | None:
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algoritm])
    except jwt.PyJWTError:
        raise InvalidTokenError

    token_data = TokenInfo(**payload)

    dt = datetime.fromisoformat(token_data.expire)

    if dt < datetime.now(UTC):
        raise TokenExpiredError
    
    return token_data


