from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from src.ai_engine.video_gen import caption_generator
from src.ai_engine.video_gen.caption_generator import (
    CaptionGenerationError,
    CaptionInput,
    generate_captions,
)


def _response(captions: list[dict[str, object]]) -> SimpleNamespace:
    content = json.dumps({"captions": captions}, ensure_ascii=False)
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def _schema_keywords(value: object) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {
            keyword for nested in value.values() for keyword in _schema_keywords(nested)
        }
    if isinstance(value, list):
        return {keyword for nested in value for keyword in _schema_keywords(nested)}
    return set()


def test_strict_response_schema_avoids_unsupported_string_lengths():
    response_format = caption_generator._response_format(2)
    schema = response_format["json_schema"]["schema"]

    assert _schema_keywords(schema).isdisjoint({"minLength", "maxLength"})


def test_generate_captions_sends_text_only_once_and_disables_storage(monkeypatch):
    captured: dict[str, object] = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        return _response(
            [
                {"index": 0, "role": "before", "caption": "시술 전 상태를 확인합니다"},
                {"index": 1, "role": "process", "caption": "모발에 제품을 도포합니다"},
            ]
        )

    monkeypatch.setattr(
        caption_generator.openAI.chat.completions, "create", fake_create
    )
    result = generate_captions(
        [
            CaptionInput(0, "before", "시술 전 상태"),
            CaptionInput(1, "process", "제품 도포"),
        ],
        "레이어드컷",
    )

    assert [caption.caption for caption in result] == [
        "시술 전 상태를 확인합니다",
        "제품을 도포합니다.",
    ]
    assert captured["model"] == "gpt-4o-mini"
    assert captured["store"] is False
    assert captured["temperature"] == 0.2
    assert captured["response_format"]["type"] == "json_schema"
    assert captured["response_format"]["json_schema"]["strict"] is True

    messages = captured["messages"]
    assert len(messages) == 2
    assert isinstance(messages[1]["content"], str)
    assert "image_url" not in json.dumps(messages)
    assert "data:image" not in json.dumps(messages)
    assert "selection" not in messages[1]["content"]
    assert '"description": "제품 도포"' in messages[1]["content"]
    assert '"topic": "레이어드컷"' in messages[1]["content"]
    assert "입력 JSON 밖의 장면을 추측하지 마세요" in messages[1]["content"]


def test_generate_captions_without_topic_or_descriptions_returns_defaults(monkeypatch):
    def fail_if_called(**_kwargs):
        raise AssertionError("provider must not be called without caption context")

    monkeypatch.setattr(
        caption_generator.openAI.chat.completions, "create", fail_if_called
    )
    result = generate_captions([CaptionInput(0, "before"), CaptionInput(1, "after")])

    assert [caption.caption for caption in result] == [
        "시술 전, 오늘의 변화를 시작합니다",
        "완성된 스타일을 확인해 보세요",
    ]


def test_generate_captions_rejects_reordered_provider_response(monkeypatch):
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {"index": 1, "role": "after", "caption": "완성 결과를 확인합니다"},
                {"index": 0, "role": "before", "caption": "시술 전 상태를 확인합니다"},
            ]
        ),
    )

    with pytest.raises(CaptionGenerationError, match="순서 또는 역할"):
        generate_captions(
            [
                CaptionInput(0, "before", "시술 전 상태"),
                CaptionInput(1, "after", "완성 확인"),
            ]
        )


def test_generate_captions_replaces_ungrounded_words_per_clip(monkeypatch):
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {
                    "index": 0,
                    "role": "process",
                    "caption": "상쾌한 샴푸로 시작합니다.",
                },
                {
                    "index": 1,
                    "role": "detail",
                    "caption": "드라이로 마무리합니다.",
                },
                {
                    "index": 2,
                    "role": "process",
                    "caption": "염색약을 도포합니다.",
                },
            ]
        ),
    )

    result = generate_captions(
        [
            CaptionInput(0, "process", "샴푸"),
            CaptionInput(1, "detail", "드라이"),
            CaptionInput(2, "process", "염색약 도포"),
        ]
    )

    assert [caption.caption for caption in result] == [
        "샴푸 작업을 진행합니다.",
        "드라이 작업을 진행합니다.",
        "염색약을 도포합니다.",
    ]
