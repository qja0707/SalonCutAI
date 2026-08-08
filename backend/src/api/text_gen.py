from fastapi import APIRouter, Depends

from src.ai_engine.text_gen.generation.keyword_to_long_text import generate_blog_post
from src.ai_engine.text_gen.prompts.blog_prompt import (
    BlogGenerationRequest,
    BlogGenerationResponse,
)
from src.api.dependencies import check_auth_token

TAG = "text generation"

router = APIRouter(
    prefix="/text-gen", tags=[TAG], dependencies=[Depends(check_auth_token)]
)


@router.post(
    "/blog_generation",
    response_model=BlogGenerationResponse,
    description="키워드를 입력받아 블로그 포스팅용 텍스트를 생성합니다.",
)
def blog_generation(request: BlogGenerationRequest):
    return generate_blog_post(request)
