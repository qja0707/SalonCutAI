import json
from unittest.mock import MagicMock, patch

from src.ai_engine.text_gen.generation.keyword_to_long_text import generate_blog_post
from src.ai_engine.text_gen.prompts.blog_prompt import (
    BlogGenerationRequest,
    BlogGenerationResponse,
)


@patch("src.ai_engine.text_gen.generation.keyword_to_long_text.openAI")
def test_generate_blog_post_success(mock_openai):
    """
    Tests the successful generation of a blog post, mocking the OpenAI API call.
    """
    # 1. Arrange
    # Create a sample request
    request = BlogGenerationRequest(
        hair_length="단발",
        hair_texture="반곱슬",
        hair_thickness="얇음",
        damage_level="상",
        customer_pain_point="부스스함",
        base_cut="태슬컷",
        main_treatment="매직",
        design_point="차분함",
        designer_name="테스트",
        duration_minutes="120",
        special_product="실크테라피",
        region_keyword="강남역",
    )

    # Configure the mock OpenAI API response
    fake_response_content = {
        "title": "강남역 미용실, 태슬컷과 매직으로 차분한 스타일 완성",
        "intro": "부스스한 반곱슬 머리로 고민하시던 고객님이 방문해주셨습니다.",
        "sections": {
            "before": {
                "heading": "반곱슬과 부스스함으로 인한 일상 속 불편함",
                "body": "매일 아침 고데기를 해도 쉽게 부스스해지는 모발 때문에 스트레스를 받으셨습니다.",
            },
            "process": {
                "heading": "디자이너의 맞춤 솔루션: 깔끔한 태슬컷 & 매직 시술",
                "body": "모발 손상을 최소화하기 위해 실크테라피 제품을 전처리로 도포한 후 정밀하게 매직을 진행했습니다.",
            },
            "after": {
                "heading": "매직 시술 후 느껴지는 확실한 차분함과 스타일 변신",
                "body": "시술 후 윤기나는 머릿결과 함께 아침 스타일링 시간이 30분에서 5분으로 단축되었습니다.",
            },
            "home_care": {
                "heading": "차분한 태슬컷 스타일을 오랫동안 유지하는 홈케어 꿀팁",
                "body": "타올 드라이 후 실크테라피 에센스를 가볍게 바르고 위에서 아래 방향으로 건조해주세요.",
            },
        },
        "closing": "강남역 미용실 테스트 디자이너를 찾아주시면 1:1 맞춤 상담을 도와드리겠습니다.",
        "hashtags": ["#강남역미용실", "#태슬컷", "#매직", "#차분한머리"],
    }

    # Create a mock response object that mimics the OpenAI completion structure
    mock_completion = MagicMock()
    mock_completion.choices[0].message.content = json.dumps(fake_response_content)

    # Set the mock to return the configured completion object
    mock_openai.chat.completions.create.return_value = mock_completion

    # 2. Act
    # Call the function that uses the mocked API
    result = generate_blog_post(request)

    # 3. Assert
    _, called_kwargs = mock_openai.chat.completions.create.call_args
    assert called_kwargs.get("response_format") == {"type": "json_object"}

    # Verify that the result is correctly parsed and returned according to the new structure
    assert isinstance(result, BlogGenerationResponse)
    assert result.title == fake_response_content["title"]
    assert result.intro == fake_response_content["intro"]

    # Sections 내 각 항목 검증
    assert (
        result.sections.before.heading
        == fake_response_content["sections"]["before"]["heading"]
    )
    assert (
        result.sections.before.body
        == fake_response_content["sections"]["before"]["body"]
    )

    assert (
        result.sections.process.heading
        == fake_response_content["sections"]["process"]["heading"]
    )
    assert (
        result.sections.process.body
        == fake_response_content["sections"]["process"]["body"]
    )

    assert (
        result.sections.after.heading
        == fake_response_content["sections"]["after"]["heading"]
    )
    assert (
        result.sections.after.body == fake_response_content["sections"]["after"]["body"]
    )

    assert (
        result.sections.home_care.heading
        == fake_response_content["sections"]["home_care"]["heading"]
    )
    assert (
        result.sections.home_care.body
        == fake_response_content["sections"]["home_care"]["body"]
    )

    assert result.closing == fake_response_content["closing"]
    assert result.hashtags == fake_response_content["hashtags"]
