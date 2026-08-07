from src.ai_engine.text_gen.prompts.blog_prompt import BlogGenerationRequest, BlogPrompt


def test_blog_prompt_generation():
    """
    Tests that the BlogPrompt class correctly generates system and user prompts.
    """
    # 1. Arrange: Create a sample request
    request = BlogGenerationRequest(
        hair_length="긴 머리",
        hair_texture="직모",
        hair_thickness="두꺼움",
        damage_level="중간",
        customer_pain_point="축 처지는 모발",
        base_cut="레이어드 컷",
        main_treatment="C컬 펌",
        design_point="얼굴형 보완",
        designer_name="규범",
        duration_minutes="180",
        special_product="모로칸 오일",
        region_keyword="학동역"
    )

    # 2. Act: Generate the prompt
    blog_prompt_instance = BlogPrompt(request=request)
    system_prompt, user_prompt = blog_prompt_instance.get_prompt()

    # 3. Assert: Verify the prompts' content
    # Check that the system prompt is not empty and contains key instructions
    assert "너는 10년 이상 경력의 미용실 블로그 전문 카피라이터야" in system_prompt
    assert "[글 구조 및 소제목 서식]" in system_prompt
    assert "반드시 아래 JSON 형식으로만 응답해" in system_prompt

    # Check that the user prompt is formatted with data from the request
    assert "기장: 긴 머리" in user_prompt
    assert "모질/굵기: 직모 / 두꺼움" in user_prompt
    assert "시술 전 불편함: 축 처지는 모발" in user_prompt
    assert "메인 시술: C컬 펌" in user_prompt
    assert "디자이너: 규범" in user_prompt
    assert "지역 키워드: 학동역" in user_prompt
