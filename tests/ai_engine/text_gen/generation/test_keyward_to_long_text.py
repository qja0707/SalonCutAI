import json
from unittest.mock import patch, MagicMock
import pytest
from src.ai_engine.text_gen.generation.keyward_to_long_text import generate_blog_post
from src.ai_engine.text_gen.prompts.blog_prompt import BlogGenerationRequest, BlogGenerationResponse

@patch('src.ai_engine.text_gen.generation.keyward_to_long_text.openAI')
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
        region_keyword="강남역"
    )

    # Configure the mock OpenAI API response
    fake_response_content = {
        "title": "강남역 미용실, 태슬컷과 매직으로 차분한 스타일 완성",
        "body": "블로그 본문입니다. 부스스한 반곱슬 머리를 해결했습니다.",
        "hashtags": ["#강남역미용실", "#태슬컷", "#매직", "#차분한머리"]
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
    # Verify that the OpenAI API was called once with the expected model
    mock_openai.chat.completions.create.assert_called_once()
    called_args, called_kwargs = mock_openai.chat.completions.create.call_args
    assert called_kwargs.get("model") == "gpt-4o-mini"
    assert called_kwargs.get("response_format") == {"type": "json_object"}

    # Verify that the result is correctly parsed and returned
    assert isinstance(result, BlogGenerationResponse)
    assert result.title == fake_response_content["title"]
    assert result.body == fake_response_content["body"]
    assert result.hashtags == fake_response_content["hashtags"]
