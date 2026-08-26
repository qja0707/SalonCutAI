from __future__ import annotations

import asyncio
import io
import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.ai_engine.image_gen import job_queue, settings, storage
from src.api import face_swap as face_swap_api
from src.api.dependencies import check_auth_token
from src.db_session.db import Base, get_db
from src.db_session.face_swap_model import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_PROCESSING,
    STATUS_QUEUED,
    FaceSwapJobModel,
)
from src.exceptions.api_error import ApiError, api_error_handler
from src.service import face_swap as face_swap_service

NOW = datetime(2026, 8, 25, 12, tzinfo=UTC)


@pytest.fixture
def cleanup_db(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'cleanup.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = session_factory()

    monkeypatch.setattr(settings, "JOB_DIR", tmp_path / "face_swap")
    monkeypatch.setattr(face_swap_service, "SessionLocal", session_factory)

    yield db, session_factory

    db.close()
    engine.dispose()


def _add_job(db, job_id: str, status: str, created_at: datetime) -> FaceSwapJobModel:
    job = FaceSwapJobModel(
        id=job_id,
        test_code="T-1234",
        status=status,
        attempt=1,
        payload_json="{}",
        consent_recorded_at=created_at,
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(job)
    db.commit()
    return job


def _add_file(job_id: str) -> None:
    directory = settings.JOB_DIR / job_id
    directory.mkdir(parents=True)
    (directory / "source.jpg").write_bytes(b"source")


def _jpeg_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (16, 16), "white").save(output, "JPEG")
    return output.getvalue()


def _payload(*, agreed: bool = True) -> str:
    return json.dumps(
        {
            "consent": {"agreed": agreed, "consent_version": "v1"},
            "options": {
                "ratios": ["1:1", "4:5", "9:16"],
                "seed": None,
                "background_mode": "preserve",
                "background_style": None,
                "face": {
                    "mode": "prompt",
                    "reference": None,
                    "prompt": {
                        "ethnicity": "한국인",
                        "gender": "여성",
                        "age": "20대",
                        "face_style": "",
                        "expression": "",
                        "skin_tone": "",
                        "makeup": "",
                    },
                },
            },
        },
        ensure_ascii=False,
    )


def _client(db) -> TestClient:
    app = FastAPI()
    app.include_router(face_swap_api.router, prefix="/api/v1")
    app.add_exception_handler(ApiError, api_error_handler)
    app.dependency_overrides[check_auth_token] = lambda: None

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def test_cleanup_deletes_only_expired_terminal_jobs(cleanup_db):
    db, _ = cleanup_db
    expired_completed = _add_job(
        db, "expired-completed", STATUS_COMPLETED, NOW - timedelta(hours=25)
    )
    expired_failed = _add_job(
        db, "expired-failed", STATUS_FAILED, NOW - timedelta(hours=25)
    )
    fresh_completed = _add_job(
        db, "fresh-completed", STATUS_COMPLETED, NOW - timedelta(hours=23)
    )
    old_queued = _add_job(db, "old-queued", STATUS_QUEUED, NOW - timedelta(days=2))
    old_processing = _add_job(
        db, "old-processing", STATUS_PROCESSING, NOW - timedelta(days=2)
    )
    jobs = [
        expired_completed,
        expired_failed,
        fresh_completed,
        old_queued,
        old_processing,
    ]
    for job in jobs:
        _add_file(job.id)

    assert face_swap_service.cleanup_expired_jobs(db, now=NOW) == 2

    assert db.get(FaceSwapJobModel, "expired-completed") is None
    assert db.get(FaceSwapJobModel, "expired-failed") is None
    assert db.get(FaceSwapJobModel, "fresh-completed") is not None
    assert db.get(FaceSwapJobModel, "old-queued") is not None
    assert db.get(FaceSwapJobModel, "old-processing") is not None
    assert not (settings.JOB_DIR / "expired-completed").exists()
    assert not (settings.JOB_DIR / "expired-failed").exists()
    assert (settings.JOB_DIR / "fresh-completed").exists()
    assert (settings.JOB_DIR / "old-queued").exists()
    assert (settings.JOB_DIR / "old-processing").exists()


def test_cleanup_isolates_file_delete_failure(cleanup_db, monkeypatch):
    db, _ = cleanup_db
    _add_job(db, "bad", STATUS_COMPLETED, NOW - timedelta(hours=25))
    _add_job(db, "good", STATUS_FAILED, NOW - timedelta(hours=25))
    _add_file("bad")
    _add_file("good")
    real_delete = storage.delete_job_files

    def delete_with_failure(job_id: str) -> None:
        if job_id == "bad":
            raise OSError("locked")
        real_delete(job_id)

    monkeypatch.setattr(storage, "delete_job_files", delete_with_failure)

    assert face_swap_service.cleanup_expired_jobs(db, now=NOW) == 1
    assert db.get(FaceSwapJobModel, "bad") is not None
    assert db.get(FaceSwapJobModel, "good") is None
    assert (settings.JOB_DIR / "bad").exists()
    assert not (settings.JOB_DIR / "good").exists()


def test_expired_direct_lookup_returns_404_and_deletes(cleanup_db, monkeypatch):
    db, _ = cleanup_db
    _add_job(db, "expired", STATUS_COMPLETED, NOW - timedelta(hours=25))
    _add_file("expired")
    monkeypatch.setattr(face_swap_service, "_now", lambda: NOW)

    with pytest.raises(ApiError) as error:
        face_swap_service.get_job_or_404(db, "expired")

    assert error.value.status_code == 404
    assert error.value.code == "JOB_NOT_FOUND"
    assert db.get(FaceSwapJobModel, "expired") is None
    assert not (settings.JOB_DIR / "expired").exists()


def test_cleanup_once_uses_independent_session(cleanup_db):
    db, _ = cleanup_db
    _add_job(db, "expired", STATUS_FAILED, NOW - timedelta(hours=25))
    _add_file("expired")

    assert face_swap_service.cleanup_expired_jobs_once(now=NOW) == 1
    db.expire_all()
    assert db.get(FaceSwapJobModel, "expired") is None
    assert not (settings.JOB_DIR / "expired").exists()


def test_create_api_cleans_expired_job_and_accepts_new_job(cleanup_db, monkeypatch):
    db, _ = cleanup_db
    _add_job(db, "expired", STATUS_COMPLETED, NOW - timedelta(hours=25))
    _add_file("expired")
    monkeypatch.setattr(face_swap_service, "_now", lambda: NOW)
    monkeypatch.setattr(job_queue, "enqueue", lambda _job_id: None)
    client = _client(db)

    response = client.post(
        "/api/v1/face-swap-jobs",
        files={"image": ("source.jpg", _jpeg_bytes(), "image/jpeg")},
        data={"payload": _payload()},
    )

    assert response.status_code == 202
    assert db.get(FaceSwapJobModel, "expired") is None
    created = db.get(FaceSwapJobModel, response.json()["job_id"])
    assert created is not None
    assert created.status == STATUS_QUEUED


def test_create_api_keeps_validation_failure_contract(cleanup_db):
    db, _ = cleanup_db
    client = _client(db)

    response = client.post(
        "/api/v1/face-swap-jobs",
        files={"image": ("source.jpg", _jpeg_bytes(), "image/jpeg")},
        data={"payload": _payload(agreed=False)},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "CONSENT_REQUIRED"


def test_lifespan_runs_startup_cleanup_once_and_cancels_task(monkeypatch):
    from src import main

    calls: list[str] = []

    async def fake_cleanup() -> None:
        calls.append("cleanup")

    monkeypatch.setattr(main, "_run_face_swap_cleanup", fake_cleanup)
    monkeypatch.setattr(main, "recover_stale_jobs", lambda: calls.append("recover"))
    monkeypatch.setattr(main.job_queue, "start_worker", lambda: calls.append("worker"))

    class FakeThread:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            calls.append("warmup")

    monkeypatch.setattr(main.threading, "Thread", FakeThread)

    async def run_lifespan() -> None:
        async with main.lifespan(main.app):
            calls.append("yield")

    asyncio.run(run_lifespan())

    assert calls == ["recover", "cleanup", "worker", "warmup", "yield"]
