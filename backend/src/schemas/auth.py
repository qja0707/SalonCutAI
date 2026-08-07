from pydantic import BaseModel

class SigninRequest(BaseModel):
    id: str
    pw: str

class RefreshRequest(BaseModel):
    refresh_token: str

class SigninResponse(BaseModel):
    access_token: str
    refresh_token: str
    