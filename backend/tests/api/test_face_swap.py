"""얼굴 교체 API 계약 테스트.

프론트가 보낸 payload 가 검증을 지나 그대로 남는지 확인한다.
필드명이 어긋나면 Pydantic 이 값을 조용히 버려서 오류 없이 사라지므로
스키마를 고칠 때 여기서 걸린다.
"""

from src.schemas.face_swap import CreateJobPayload

# 프론트 types.ts 의 FACE_PROMPT_KEYS 순서와 같다.
PROMPT_KEYS = [
    "ethnicity",
    "gender",
    "age",
    "face_style",
    "expression",
    "skin_tone",
    "makeup",
]

PAYLOAD = {
    "consent": {"agreed": True, "consent_version": "v1"},
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
                "age": "20대 초반",
                "face_style": "고양이상",
                "expression": "은은한 미소",
                "skin_tone": "밝은 피부",
                "makeup": "코랄 립",
            },
        },
    },
}


def test_prompt_keys_match_frontend():
    """스키마 필드가 프론트 키와 이름·순서까지 같다."""
    from src.schemas.face_swap import FacePromptOptions

    assert list(FacePromptOptions.model_fields) == PROMPT_KEYS


def test_optional_fields_survive_validation():
    """선택 4개가 검증 후에도 값을 유지한다."""
    parsed = CreateJobPayload.model_validate(PAYLOAD)
    prompt = parsed.options.face.prompt

    assert prompt is not None
    for key in PROMPT_KEYS:
        assert getattr(prompt, key) == PAYLOAD["options"]["face"]["prompt"][key]


def test_payload_survives_json_round_trip():
    """DB 에 문자열로 넣었다 꺼내도 값이 남는다.

    service 계층이 model_dump_json 으로 저장하고 워커가 다시 읽는다.
    """
    parsed = CreateJobPayload.model_validate(PAYLOAD)
    restored = CreateJobPayload.model_validate_json(parsed.model_dump_json())

    assert restored.options.face.prompt == parsed.options.face.prompt
