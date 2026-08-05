from fastapi import FastAPI
from src.api.api import api_router

app = FastAPI()

app.include_router(api_router)

@app.get("/")
def root():
    return {"message": "안녕하세요, 첫 FastAPI 서버입니다!"}
