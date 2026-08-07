from pydantic import BaseModel

class LoginRequest(BaseModel):
    id: str
    pw: str

class RefreshRequest(BaseModel):
    refresh_token: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    