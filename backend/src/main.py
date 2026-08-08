from fastapi import FastAPI

from src.api.api import api_router
from src.db_session.db import Base, engine
from src.service.auth import get_secret_key

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(api_router)

get_secret_key()


@app.get("/")
def root():
    return {"message": "안녕하세요, 첫 FastAPI 서버입니다!"}
