from __future__ import annotations

import logging
import uuid
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

from src.ai_engine.video_gen.caption_generator import (
    CaptionGenerationError,
    CaptionInput,
    GeneratedCaption,
    generate_captions,
)
from src.api.video_jobs import MAX_CLIPS, MIN_CLIPS

router = APIRouter(prefix="/video-captions", tags=["video captions"])
logger = logging.getLogger(__name__)
MAX_CONTEXT_LENGTH = 100


class CaptionClipOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int = Field(ge=0)
    role: Literal["before", "process", "detail", "after"]
    description: str = Field(default="", max_length=MAX_CONTEXT_LENGTH)

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        return " ".join(value.strip().split())


class VideoCaptionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clips: list[CaptionClipOptions] = Field(min_length=MIN_CLIPS, max_length=MAX_CLIPS)
    topic: str = Field(default="", max_length=MAX_CONTEXT_LENGTH)

    @field_validator("topic")
    @classmethod
    def strip_topic(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @model_validator(mode="after")
    def validate_indexes(self) -> VideoCaptionPayload:
        if [clip.index for clip in self.clips] != list(range(len(self.clips))):
            raise ValueError("clip indexes must start at zero and follow input order")
        return self


class VideoCaptionResponse(BaseModel):
    captions: list[GeneratedCaption]


@router.post("", response_model=VideoCaptionResponse)
async def create_video_captions(payload: VideoCaptionPayload):
    request_id = str(uuid.uuid4())
    try:
        clips = [
            CaptionInput(
                index=clip.index,
                role=clip.role,
                description=clip.description,
            )
            for clip in payload.clips
        ]
        generated = await run_in_threadpool(generate_captions, clips, payload.topic)
        return VideoCaptionResponse(captions=generated)
    except CaptionGenerationError as exc:
        provider_error = exc.__cause__ or exc
        logger.warning(
            "video caption generation failed request_id=%s "
            "provider_status=%s error_type=%s error_code=%s",
            request_id,
            getattr(provider_error, "status_code", None),
            type(provider_error).__name__,
            getattr(provider_error, "code", None),
        )
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "CAPTION_GENERATION_FAILED",
                    "message": "AI 자막 생성에 실패했습니다. 기본 문구를 직접 수정해 계속해주세요.",
                    "retryable": True,
                },
                "request_id": request_id,
            },
        )
