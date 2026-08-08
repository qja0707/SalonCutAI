from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str


class CommonResponse(BaseModel):
    message: str
