from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.ai_engine.video_gen.caption_generator import (
    CaptionGenerationError,
    GeneratedCaption,
)
from src.api import video_captions
from src.api.api import api_router
from src.api.dependencies import check_auth_token


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(api_router)
    # 이 파일은 자막 계약만 본다. 인증 계약은 test_api_auth.py 가 본다.
    app.dependency_overrides[check_auth_token] = lambda: None
    return TestClient(app)


def _payload(count: int, mode: str) -> dict[str, object]:
    clips = []
    for index in range(count):
        role = "before" if index == 0 else "after" if index == count - 1 else "process"
        clip: dict[str, object] = {"index": index, "role": role}
        if mode in {"topic_description", "description"}:
            clip["description"] = f"장면 설명 {index}"
        clips.append(clip)
    return {
        "clips": clips,
        "topic": "레이어드컷" if mode == "topic_description" else "",
    }


def test_video_caption_route_is_json_only_and_registered_once():
    paths = _client().app.openapi()["paths"]
    assert "/api/v1/video-captions" in paths
    assert "/api/v1/api/v1/video-captions" not in paths
    content = paths["/api/v1/video-captions"]["post"]["requestBody"]["content"]
    assert set(content) == {"application/json"}


@pytest.mark.parametrize("count", [2, 8])
@pytest.mark.parametrize("mode", ["topic_description", "description", "empty"])
def test_video_caption_contract_preserves_count_order_and_mapping(
    monkeypatch, count, mode
):
    captured: dict[str, object] = {}

    def fake_generate(clips, topic):
        captured["clips"] = clips
        captured["topic"] = topic
        return [
            GeneratedCaption(
                index=clip.index,
                role=clip.role,
                caption=f"{clip.index}번 자막을 생성합니다",
            )
            for clip in clips
        ]

    monkeypatch.setattr(video_captions, "generate_captions", fake_generate)
    payload = _payload(count, mode)
    response = _client().post("/api/v1/video-captions", json=payload)

    assert response.status_code == 200
    assert [item["index"] for item in response.json()["captions"]] == list(range(count))
    assert [clip.index for clip in captured["clips"]] == list(range(count))
    assert [clip.description for clip in captured["clips"]] == [
        item.get("description", "") for item in payload["clips"]
    ]
    assert captured["topic"] == payload["topic"]


def test_video_caption_rejects_selection_and_out_of_order_indexes():
    with_selection = _payload(2, "description")
    with_selection["clips"][0]["selection"] = "center"
    response = _client().post("/api/v1/video-captions", json=with_selection)
    assert response.status_code == 422

    reordered = _payload(2, "description")
    reordered["clips"][0]["index"] = 1
    response = _client().post("/api/v1/video-captions", json=reordered)
    assert response.status_code == 422


def test_video_caption_rejects_context_over_shared_limit():
    payload = _payload(2, "description")
    payload["clips"][0]["description"] = "가" * 101
    response = _client().post("/api/v1/video-captions", json=payload)
    assert response.status_code == 422

    payload = _payload(2, "description")
    payload["topic"] = "가" * 101
    response = _client().post("/api/v1/video-captions", json=payload)
    assert response.status_code == 422


def test_video_caption_provider_failure_returns_explicit_error(monkeypatch, caplog):
    class ProviderError(Exception):
        status_code = 400
        code = "invalid_json_schema"

    def fail_with_provider_error(*_args):
        try:
            raise ProviderError("provider rejected schema")
        except ProviderError as exc:
            raise CaptionGenerationError("provider failed") from exc

    monkeypatch.setattr(
        video_captions,
        "generate_captions",
        fail_with_provider_error,
    )
    response = _client().post("/api/v1/video-captions", json=_payload(2, "description"))

    assert response.status_code == 502
    assert response.json()["error"] == {
        "code": "CAPTION_GENERATION_FAILED",
        "message": "AI 자막 생성에 실패했습니다. 기본 문구를 직접 수정해 계속해주세요.",
        "retryable": True,
    }
    assert "provider_status=400" in caplog.text
    assert "error_type=ProviderError" in caplog.text
    assert "error_code=invalid_json_schema" in caplog.text
    assert "장면 설명" not in caplog.text
