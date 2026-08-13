from __future__ import annotations

import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api import video_jobs
from src.api.api import api_router


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


def test_create_and_get_video_job_returns_expected_status(monkeypatch, tmp_path):
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    video_jobs._jobs.clear()
    monkeypatch.setattr(video_jobs, "_job_root", lambda: tmp_path)
    monkeypatch.setattr(video_jobs, "_run_job", lambda _job_id: None)

    payload = {
        "clips": [
            {"role": "before", "selection": "center", "caption": "비포"},
            {"role": "after", "selection": "center", "caption": "애프터"},
        ],
        "blur_faces": True,
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
    assert client.get(f"/api/v1/video-jobs/{job_id}").status_code == 200
    assert client.get(f"/api/v1/api/v1/video-jobs/{job_id}").status_code == 404

    video_jobs._jobs.clear()
