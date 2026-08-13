from __future__ import annotations

import json
import shutil
import tempfile
import threading
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ValidationError, field_validator

from src.ai_engine.video_gen.engine import ClipInput, process_shorts

router = APIRouter(prefix="/video-jobs", tags=["video generation"])

MAX_CLIPS = 8
MIN_CLIPS = 2
MAX_FILE_BYTES = 80 * 1024 * 1024
MAX_TOTAL_BYTES = 320 * 1024 * 1024
TTL_HOURS = 24
ALLOWED_SUFFIXES = {".mp4", ".mov", ".webm", ".mkv"}
ROLE_DEFAULT_CAPTIONS = {
    "before": "시술 전, 오늘의 변화를 시작합니다",
    "process": "섬세하게 완성해 가는 시술 과정",
    "detail": "작은 디테일까지 꼼꼼하게",
    "after": "완성된 스타일을 확인해 보세요",
}


class ClipOptions(BaseModel):
    role: Literal["before", "process", "detail", "after"]
    selection: Literal["start", "center", "end"] = "center"
    caption: str = Field(default="", max_length=80)

    @field_validator("caption")
    @classmethod
    def strip_caption(cls, value: str) -> str:
        return value.strip()


class VideoJobPayload(BaseModel):
    clips: list[ClipOptions] = Field(min_length=MIN_CLIPS, max_length=MAX_CLIPS)
    blur_faces: Literal[True] = True


_jobs: dict[str, dict] = {}
_lock = threading.Lock()
_worker_lock = threading.Lock()


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _job_root() -> Path:
    path = Path(tempfile.gettempdir()) / "saloncutai-video-jobs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _public_job(job: dict) -> dict:
    return {
        key: value
        for key, value in job.items()
        if key not in {"directory", "clips", "output_path", "blur_faces"}
    }


def _cleanup_expired() -> None:
    cutoff = _now()
    expired: list[dict] = []
    with _lock:
        for job_id, job in list(_jobs.items()):
            if datetime.fromisoformat(job["result_expires_at"]) <= cutoff:
                expired.append(_jobs.pop(job_id))
    for job in expired:
        shutil.rmtree(job["directory"], ignore_errors=True)


async def _save_upload(upload: UploadFile, destination: Path) -> int:
    size = 0
    with destination.open("wb") as stream:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"파일당 최대 크기는 {MAX_FILE_BYTES // 1024 // 1024}MB입니다.",
                )
            stream.write(chunk)
    if size == 0:
        raise HTTPException(
            status_code=422, detail="빈 영상 파일은 사용할 수 없습니다."
        )
    return size


def _set_job(job_id: str, **changes: object) -> None:
    with _lock:
        job = _jobs[job_id]
        job.update(changes)
        job["updated_at"] = _iso(_now())


def _run_job(job_id: str) -> None:
    # The MVP VM has one CPU encoder lane. Concurrent jobs wait here instead of
    # competing for all cores and slowing every request down.
    with _worker_lock:
        _process_job(job_id)


def _process_job(job_id: str) -> None:
    started = time.perf_counter()
    _set_job(job_id, status="processing", progress=1, queue_position=None)
    with _lock:
        job = _jobs[job_id]
        clips = list(job["clips"])
        output_path = Path(job["output_path"])
        blur_faces = bool(job["blur_faces"])
    try:
        result = process_shorts(
            clips,
            output_path,
            blur_faces=blur_faces,
            progress=lambda value: _set_job(job_id, progress=value),
        )
        _set_job(
            job_id,
            status="completed",
            progress=100,
            result={
                "url": f"/api/v1/video-jobs/{job_id}/video",
                "duration_sec": result.duration_sec,
                "width": result.width,
                "height": result.height,
            },
            meta={
                "processing_sec": round(time.perf_counter() - started, 3),
                "faces_blurred": result.faces_blurred,
                "audio_included": False,
            },
        )
    except Exception as exc:  # noqa: BLE001 -- persist worker failures for polling clients
        _set_job(
            job_id,
            status="failed",
            error={
                "code": "VIDEO_PROCESSING_FAILED",
                "message": str(exc),
                "retryable": True,
            },
        )


@router.post("", status_code=202)
async def create_video_job(
    background_tasks: BackgroundTasks,
    clips: Annotated[list[UploadFile], File()],
    payload: Annotated[str, Form()],
):
    _cleanup_expired()
    try:
        options = VideoJobPayload.model_validate(json.loads(payload))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status_code=422, detail="영상 역할·구간·자막 설정을 확인해주세요."
        ) from exc
    if len(clips) != len(options.clips):
        raise HTTPException(
            status_code=422, detail="업로드 영상 수와 설정 수가 일치하지 않습니다."
        )

    job_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    directory = _job_root() / job_id
    directory.mkdir()
    saved_clips: list[ClipInput] = []
    total_size = 0
    try:
        for index, (upload, clip_options) in enumerate(
            zip(clips, options.clips, strict=True)
        ):
            suffix = Path(upload.filename or "").suffix.lower()
            if suffix not in ALLOWED_SUFFIXES:
                raise HTTPException(
                    status_code=415, detail="MP4, MOV, WEBM, MKV 영상만 지원합니다."
                )
            destination = directory / f"source-{index}{suffix}"
            total_size += await _save_upload(upload, destination)
            if total_size > MAX_TOTAL_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"전체 영상 크기는 최대 {MAX_TOTAL_BYTES // 1024 // 1024}MB입니다.",
                )
            saved_clips.append(
                ClipInput(
                    path=destination,
                    role=clip_options.role,
                    selection=clip_options.selection,
                    caption=clip_options.caption
                    or ROLE_DEFAULT_CAPTIONS[clip_options.role],
                )
            )
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        raise
    finally:
        for upload in clips:
            await upload.close()

    created_at = _now()
    expires_at = created_at + timedelta(hours=TTL_HOURS)
    job = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "attempt": 1,
        "queue_position": 1,
        "result": None,
        "meta": None,
        "error": None,
        "created_at": _iso(created_at),
        "updated_at": _iso(created_at),
        "source_expires_at": _iso(expires_at),
        "result_expires_at": _iso(expires_at),
        "request_id": request_id,
        "directory": str(directory),
        "clips": saved_clips,
        "output_path": str(directory / "shorts.mp4"),
        "blur_faces": options.blur_faces,
    }
    with _lock:
        _jobs[job_id] = job
    background_tasks.add_task(_run_job, job_id)
    return _public_job(job)


@router.get("/{job_id}")
def get_video_job(job_id: str):
    _cleanup_expired()
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="영상 작업을 찾을 수 없습니다.")
        return _public_job(dict(job))


@router.get("/{job_id}/video")
def get_video(job_id: str):
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="영상 작업을 찾을 수 없습니다.")
        if job["status"] != "completed":
            raise HTTPException(
                status_code=409, detail="영상이 아직 완성되지 않았습니다."
            )
        output_path = Path(job["output_path"])
    if not output_path.exists():
        raise HTTPException(status_code=410, detail="영상 보관 기간이 만료되었습니다.")
    return FileResponse(
        output_path, media_type="video/mp4", filename="saloncutai-shorts.mp4"
    )


@router.delete("/{job_id}", status_code=204)
def delete_video_job(job_id: str):
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="영상 작업을 찾을 수 없습니다.")
        if job["status"] in {"queued", "processing"}:
            raise HTTPException(
                status_code=409, detail="처리 중인 작업은 삭제할 수 없습니다."
            )
        _jobs.pop(job_id)
    shutil.rmtree(job["directory"], ignore_errors=True)
