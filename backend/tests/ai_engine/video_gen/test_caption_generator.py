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
                {
                    "index": 1,
                    "role": "process",
                    "caption": "제품을 고르게 도포해 흐름을 이어갑니다",
                },
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
        "제품을 고르게 도포해 흐름을 이어갑니다",
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
    assert "도입 → 변화 과정 → 결과" in messages[1]["content"]


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


def test_generate_captions_keeps_natural_promotional_language(monkeypatch):
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {
                    "index": 0,
                    "role": "process",
                    "caption": "샴푸로 산뜻하게 흐름을 이어갑니다.",
                },
                {
                    "index": 1,
                    "role": "detail",
                    "caption": "드라이로 가볍게 변화를 살펴보세요.",
                },
            ]
        ),
    )

    result = generate_captions(
        [
            CaptionInput(0, "process", "샴푸"),
            CaptionInput(1, "detail", "드라이"),
        ]
    )

    assert [caption.caption for caption in result] == [
        "샴푸로 산뜻하게 흐름을 이어갑니다.",
        "드라이로 가볍게 변화를 살펴보세요.",
    ]


def test_generate_captions_replaces_unsupported_domain_claims(monkeypatch):
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {"index": 0, "role": "before", "caption": "탈색 전 상태를 살펴봅니다."},
                {"index": 1, "role": "process", "caption": "오일로 커트를 진행합니다."},
                {"index": 2, "role": "detail", "caption": "핑크 염색을 더합니다."},
                {
                    "index": 3,
                    "role": "after",
                    "caption": "윤기 있는 모습으로 완성했습니다.",
                },
            ]
        ),
    )

    result = generate_captions(
        [
            CaptionInput(0, "before", "시술 전 상태"),
            CaptionInput(1, "process", "커트"),
            CaptionInput(2, "detail", "섹션 나누기"),
            CaptionInput(3, "after", "완성 확인"),
        ],
        "레이어드컷",
    )

    assert [caption.caption for caption in result] == [
        "시술 전 상태를 확인합니다.",
        "커트 작업을 진행합니다.",
        "섹션을 나눕니다.",
        "완성된 모습을 확인합니다.",
    ]


def test_generate_captions_accepts_spacing_normalization(monkeypatch):
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {
                    "index": 0,
                    "role": "before",
                    "caption": "레이어드컷으로 변화를 시작합니다.",
                },
                {
                    "index": 1,
                    "role": "after",
                    "caption": "완성된 스타일을 확인해보세요.",
                },
            ]
        ),
    )

    result = generate_captions(
        [CaptionInput(0, "before"), CaptionInput(1, "after")], "레이어드 컷"
    )

    assert [caption.caption for caption in result] == [
        "레이어드컷으로 변화를 시작합니다.",
        "완성된 스타일을 확인해보세요.",
    ]


def test_generate_captions_rejects_facts_moved_between_clips(monkeypatch):
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {
                    "index": 0,
                    "role": "process",
                    "caption": "염색약을 고르게 도포합니다.",
                },
                {"index": 1, "role": "after", "caption": "염색약으로 완성합니다."},
            ]
        ),
    )

    result = generate_captions(
        [
            CaptionInput(0, "process", "염색약 도포"),
            CaptionInput(1, "after", "완성 확인"),
        ]
    )

    assert [caption.caption for caption in result] == [
        "염색약을 고르게 도포합니다.",
        "완성된 모습을 확인합니다.",
    ]


def test_generate_captions_keeps_verified_live_sample(monkeypatch):
    expected = [
        "레이어드컷을 통해 변화를 기대해 보세요.",
        "커트로 자연스러운 층을 만들어갑니다.",
        "섹션을 나누어 섬세하게 다듬습니다.",
        "변화된 스타일을 확인해 보세요. 예약도 가능합니다.",
    ]
    roles = ["before", "process", "detail", "after"]
    monkeypatch.setattr(
        caption_generator.openAI.chat.completions,
        "create",
        lambda **_kwargs: _response(
            [
                {"index": index, "role": role, "caption": expected[index]}
                for index, role in enumerate(roles)
            ]
        ),
    )
    clips = [
        CaptionInput(0, "before", "시술 전 상태"),
        CaptionInput(1, "process", "커트"),
        CaptionInput(2, "detail", "섹션 나누기"),
        CaptionInput(3, "after", "완성 확인"),
    ]

    result = generate_captions(
        clips, "레이어드컷 전후를 자연스럽고 고급스럽게 보여주세요 분위기: 예약 유도"
    )

    assert [caption.caption for caption in result] == expected


@pytest.mark.parametrize("count", [2, 4, 8])
@pytest.mark.parametrize("mood", ["감성", "전문", "친근", "예약 유도"])
def test_generate_captions_preserves_story_across_counts_and_moods(
    monkeypatch, count, mood
):
    roles = ["before"] + ["process", "detail"] * 3 + ["after"]
    selected_roles = [roles[0], *roles[1 : count - 1], roles[-1]]
    captured: dict[str, object] = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        captions = []
        for index, role in enumerate(selected_roles):
            if role == "before":
                text = "어떤 변화가 시작될지 기대해보세요."
            elif role == "after":
                text = "완성된 흐름을 자연스럽게 확인해보세요."
            else:
                text = f"{index + 1}번째 컷에서 변화의 흐름을 이어갑니다."
            captions.append({"index": index, "role": role, "caption": text})
        return _response(captions)

    monkeypatch.setattr(
        caption_generator.openAI.chat.completions, "create", fake_create
    )
    clips = [CaptionInput(index, role) for index, role in enumerate(selected_roles)]
    result = generate_captions(clips, f"레이어드컷\n분위기: {mood}")
    texts = [caption.caption for caption in result]

    assert len(set(texts)) == count
    assert all(12 <= len(text) <= 24 for text in texts)
    assert all(
        "전 모습입니다" not in text and "후 모습입니다" not in text for text in texts
    )
    prompt = captured["messages"][1]["content"]
    assert f'"mood": "{mood}"' in prompt
    assert caption_generator.MOOD_STYLES[mood] in prompt
    assert "12~24자 안에" in prompt
