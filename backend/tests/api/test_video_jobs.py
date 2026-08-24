from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.ai_engine.video_gen.engine import VideoResult
from src.api import video_jobs
from src.api.api import api_router
from src.api.dependencies import check_auth_token


def test_video_routes_use_one_api_v1_prefix():
    app = FastAPI()
    app.include_router(api_router)
    paths = app.openapi()["paths"]

    create_route = paths["/api/v1/video-jobs"]
    assert "post" in create_route
    assert "202" in create_route["post"]["responses"]
    assert "/api/v1/video-jobs/{job_id}" in paths
    assert "/api/v1/api/v1/video-jobs" not in paths

    # dev 통합 뒤에도 기존 기능 라우트가 함께 등록되어 있어야 한다.
    assert "/api/v1/face-swap-jobs" in paths
    assert "/api/v1/reference-faces" in paths
    assert "/api/v1/text-gen/blog-generation" in paths
    assert "/api/v1/video-captions" in paths


def test_create_and_get_video_job_returns_expected_status(monkeypatch, tmp_path):
    app = FastAPI()
    app.include_router(api_router)
    # 이 테스트는 job 계약만 본다. 인증 계약은 test_api_auth.py 가 본다.
    app.dependency_overrides[check_auth_token] = lambda: None
    client = TestClient(app)

    video_jobs._jobs.clear()
    monkeypatch.setattr(video_jobs, "_job_root", lambda: tmp_path)
    monkeypatch.setattr(video_jobs, "_run_job", lambda _job_id: None)
    payload = {
        "clips": [
            {"role": "before", "selection": "center", "caption": "비포"},
            {"role": "after", "selection": "center", "caption": "애프터"},
        ],
    }
    response = client.post(
        "/api/v1/video-jobs",
        files=[
            ("clips", ("before.mp4", b"before", "video/mp4")),
            ("clips", ("after.mp4", b"after", "video/mp4")),
        ],
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 202
    job_id = response.json()["job_id"]
    assert video_jobs._jobs[job_id]["blur_faces"] is True
    assert client.get(f"/api/v1/video-jobs/{job_id}").status_code == 200
    assert client.get(f"/api/v1/api/v1/video-jobs/{job_id}").status_code == 404
    video_jobs._jobs.clear()


def test_video_job_accepts_false_blur_faces(monkeypatch, tmp_path):
    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[check_auth_token] = lambda: None
    client = TestClient(app)

    video_jobs._jobs.clear()
    monkeypatch.setattr(video_jobs, "_job_root", lambda: tmp_path)
    monkeypatch.setattr(video_jobs, "_run_job", lambda _job_id: None)
    payload = {
        "clips": [
            {"role": "before", "selection": "center", "caption": "비포"},
            {"role": "after", "selection": "center", "caption": "애프터"},
        ],
        "blur_faces": False,
    }
    response = client.post(
        "/api/v1/video-jobs",
        files=[
            ("clips", ("before.mp4", b"before", "video/mp4")),
            ("clips", ("after.mp4", b"after", "video/mp4")),
        ],
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 202
    assert video_jobs._jobs[response.json()["job_id"]]["blur_faces"] is False
    video_jobs._jobs.clear()


def test_completed_video_meta_reports_actual_blur_faces(monkeypatch, tmp_path):
    job_id = "blur-off-job"
    output = tmp_path / "shorts.mp4"
    video_jobs._jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "queue_position": 1,
        "clips": [],
        "output_path": str(output),
        "blur_faces": False,
        "audio_mode": "mute",
    }
    captured: dict[str, bool] = {}

    def fake_process_shorts(_clips, _output, *, blur_faces, **_kwargs):
        captured["blur_faces"] = blur_faces
        return VideoResult(
            duration_sec=4.0,
            width=1080,
            height=1920,
            faces_blurred=0,
            audio_included=False,
        )

    monkeypatch.setattr(video_jobs, "process_shorts", fake_process_shorts)

    video_jobs._process_job(job_id)

    assert captured["blur_faces"] is False
    assert video_jobs._jobs[job_id]["status"] == "completed"
    assert video_jobs._jobs[job_id]["meta"]["blur_faces"] is False
    video_jobs._jobs.clear()


def test_advanced_video_contract_preserves_explicit_range_order_and_audio(
    monkeypatch, tmp_path
):
    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[check_auth_token] = lambda: None
    client = TestClient(app)

    video_jobs._jobs.clear()
    monkeypatch.setattr(video_jobs, "_job_root", lambda: tmp_path)
    monkeypatch.setattr(video_jobs, "_run_job", lambda _job_id: None)
    payload = {
        "clips": [
            {
                "role": "after",
                "start_sec": 1.25,
                "end_sec": 4.75,
                "clip_order": 0,
                "keep_audio": True,
                "caption": "완성",
            },
            {
                "role": "before",
                "selection": "end",
                "clip_order": 1,
                "keep_audio": False,
                "caption": "시작",
            },
        ],
        "audio_mode": "original",
        "blur_faces": True,
    }
    response = client.post(
        "/api/v1/video-jobs",
        files=[
            ("clips", ("after.mp4", b"after", "video/mp4")),
            ("clips", ("before.mp4", b"before", "video/mp4")),
        ],
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 202
    body = response.json()
    assert "preset" not in body
    assert body["audio_mode"] == "original"
    saved = video_jobs._jobs[body["job_id"]]["clips"]
    assert (saved[0].start_sec, saved[0].end_sec, saved[0].clip_order) == (
        1.25,
        4.75,
        0,
    )
    assert saved[0].keep_audio is True
    assert saved[1].selection == "end"
    video_jobs._jobs.clear()


@pytest.mark.parametrize(
    "clips",
    [
        [
            {"role": "before", "start_sec": 1.0},
            {"role": "after", "selection": "end"},
        ],
        [
            {"role": "before", "start_sec": 2.0, "end_sec": 1.0},
            {"role": "after"},
        ],
        [
            {"role": "before", "clip_order": 0},
            {"role": "after"},
        ],
        [
            {"role": "before", "clip_order": 0},
            {"role": "after", "clip_order": 0},
        ],
    ],
)
def test_video_contract_rejects_incomplete_ranges_and_ambiguous_order(clips):
    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[check_auth_token] = lambda: None
    client = TestClient(app)

    response = client.post(
        "/api/v1/video-jobs",
        files=[
            ("clips", ("one.mp4", b"one", "video/mp4")),
            ("clips", ("two.mp4", b"two", "video/mp4")),
        ],
        data={"payload": json.dumps({"clips": clips, "blur_faces": True})},
    )
    assert response.status_code == 422


def test_tts_contract_returns_not_implemented_until_provider_is_connected():
    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[check_auth_token] = lambda: None
    client = TestClient(app)

    payload = {
        "clips": [{"role": "before"}, {"role": "after"}],
        "audio_mode": "tts",
        "blur_faces": True,
    }
    response = client.post(
        "/api/v1/video-jobs",
        files=[
            ("clips", ("one.mp4", b"one", "video/mp4")),
            ("clips", ("two.mp4", b"two", "video/mp4")),
        ],
        data={"payload": json.dumps(payload)},
    )
    assert response.status_code == 501
    assert "음성 생성기" in response.json()["detail"]
