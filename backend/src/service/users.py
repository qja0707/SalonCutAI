from src.schemas.common import CommonResponse
from src.schemas.users import SignupRequest
from src.db_session.user_model import UserModel
from sqlalchemy.orm import Session
from src.service.auth import password_hash

def signup_user(request: SignupRequest, db: Session)->bool:
    user = db.get(UserModel, request.id)

    if user:
        return False

    new_user = UserModel(id=request.id, 
                        password=password_hash.hash(request.pw), 
                        username=request.username)
    
    db.add(new_user)
    db.commit()

    return True

def delete_user(id:str, db:Session)->bool:
    user = db.get(UserModel, id)

    if not user:
        return False

    db.delete(user)
    db.commit()

    return True