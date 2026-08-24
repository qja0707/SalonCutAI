import json

from src.ai_engine.text_gen.model import openAI
from src.ai_engine.text_gen.prompts.blog_prompt import (
    BlogGenerationRequest,
    BlogGenerationResponse,
    BlogPrompt,
)


def generate_blog_post(request: BlogGenerationRequest):
    """
    Generates a blog post using the BlogPrompt class and OpenAI API.
    """
    # Instantiate BlogPrompt with the provided parameters
    blog_prompt_instance = BlogPrompt(request=request)

    # Get the system and user prompts
    system_prompt, user_prompt, edit_prompt = blog_prompt_instance.get_prompt()

    # 3. GPT-4o-mini API 호출
    response = openAI.chat.completions.create(
        model="gpt-5.4-nano",
        response_format={"type": "json_object"},  # ⭐️ JSON 전용 출력 보장
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                ],
            },
        ],
    )

    result_dict = json.loads(response.choices[0].message.content)

    response = BlogGenerationResponse.model_validate(result_dict)

    edit_response = openAI.chat.completions.create(
        model="gpt-5.4",
        response_format={"type": "json_object"},  # ⭐️ JSON 전용 출력 보장
        messages=[
            {"role": "system", "content": edit_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"[입력 파라미터]:{user_prompt}, [AI 생성 결과물]:{response}",
                    },
                ],
            },
        ],
    )

    edit_dict = json.loads(edit_response.choices[0].message.content)

    if edit_dict.get("status") == "PASS":
        return response

    edit_response = BlogGenerationResponse.model_validate(edit_dict)

    # 4. 결과 출력
    return edit_response


# 사용 예시
if __name__ == "__main__":
    # Example usage with parameters matching BlogPrompt
    request = BlogGenerationRequest(
        hair_length="긴 머리",
        hair_texture="직모",
        hair_thickness="두꺼움",
        damage_level="중간",
        customer_pain_point="축 처지는 모발, 스타일링 어려움, 자고 일어나면 머리가 부스스해짐",
        base_cut="레이어드 컷",
        main_treatment="C컬 펌",
        design_point="얼굴형 보완, 자연스러운 볼륨",
        designer_name="규범",
        duration_minutes="180",
        special_product="모로칸 오일",
        region_keyword="학동역 1번출구",
    )

    result = generate_blog_post(request)
    print(result)
