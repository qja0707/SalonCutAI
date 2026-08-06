from fastapi import APIRouter, Depends
from pydantic import BaseModel
from src.db_session.db import get_db
from sqlalchemy.orm import Session
from src.db_session.user_model import UserModel
from src.service.auth import password_hash

router = APIRouter(prefix="/users", tags=["유저 관리"])

class SignupRequest(BaseModel):
    id: str
    pw: str
    username: str

@router.post("/signup")  # 실제 주소: POST /users (회원가입)
def register_user(request: SignupRequest, db: Session = Depends(get_db)):
    user = db.get(UserModel, request.id)
    if user:
        return {"message": "이미 존재하는 아이디입니다."}

    new_user = UserModel(id=request.id, 
                        password=password_hash.hash(request.pw), 
                        username=request.username)
    
    db.add(new_user)
    db.commit()

    return {"message": "회원가입 성공"}
