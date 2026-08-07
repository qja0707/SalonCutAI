from pydantic import BaseModel

class SignupRequest(BaseModel):
    id: str
    pw: str
    username: str