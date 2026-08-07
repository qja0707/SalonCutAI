from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# 1. 상대 경로 문제를 해결하기 위한 절대 경로 계산
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent # 환경에 맞게 조절
DB_DIR = BASE_DIR / "database"
DB_DIR.mkdir(parents=True, exist_ok=True) # 폴더가 없으면 자동 생성
DB_URL = f"sqlite:///{DB_DIR}/SalonCutAI.db"

# 2. SQLite 타임아웃 설정 추가 (잠금 에러 방지)
connect_args = {
    "check_same_thread": False,
    "timeout": 30  # 다른 스레드가 쓰고 있을 때 최대 30초 대기
}

engine = create_engine(DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 3. id 타입을 Any로 명시하고 404 메시지에 모델명 포함 (디버깅 용이)
def get_object_or_404(db: Session, model: type, id: Any):
    obj = db.get(model, id)
            
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{model.__name__}에서 ID가 '{id}'인 데이터를 찾을 수 없습니다."
        )

    return obj

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
