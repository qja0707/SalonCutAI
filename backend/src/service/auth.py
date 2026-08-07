from dotenv import load_dotenv
import os
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from sqlalchemy import select
from src.db_session.user_model import UserModel
from datetime import datetime, timedelta, timezone
import jwt
from src.db_session.refresh_token_model import RefreshTokenModel
from src.schemas.auth import SigninResponse, SigninRequest

load_dotenv()
secret_key = os.getenv("SECRET_KEY")
algoritm = "HS256"
access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES","30"))
refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS","7"))

password_hash = PasswordHash.recommended()

def create_jwt(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=algoritm)

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
    access_token = create_jwt(data={"sub": user.id}, expires_delta=timedelta(minutes=access_token_expire_minutes))
    refresh_token = create_jwt(data={"sub": user.id}, expires_delta=timedelta(days=refresh_token_expire_days))

    print(f"user id: {user.id}")

    stmt = select(RefreshTokenModel).where(RefreshTokenModel.user_id == user.id)
    old_refresh_token_obj = db.scalars(stmt).first()

    print(f"old_refresh_token_obj: {old_refresh_token_obj}")
    
    if old_refresh_token_obj:
        print(f"exist")
        old_refresh_token_obj.token = refresh_token
    else:
        print(f"not exist")
        new_refresh_token_obj = RefreshTokenModel(user_id=user.id, token=refresh_token)
        db.add(new_refresh_token_obj)

    db.commit()

    return SigninResponse(access_token=access_token, refresh_token=refresh_token)
