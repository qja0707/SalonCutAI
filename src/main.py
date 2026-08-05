from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "안녕하세요, 첫 FastAPI 서버입니다!"}