from fastapi import FastAPI
from src.api.api import api_router
from src.db_session.db import Base, engine

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(api_router)

@app.get("/")
def root():
    return {"message": "안녕하세요, 첫 FastAPI 서버입니다!"}
