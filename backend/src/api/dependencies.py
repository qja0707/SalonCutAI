import jwt
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer

from src.service.auth import verify_access_token

# Swagger UI에서 자물쇠 버튼(인증)을 활성화하기 위한 보안 스키마
security = HTTPBearer()


async def check_auth_token(request: Request):
    # 1. 헤더에서 Authorization: Bearer <token> 추출
    credentials = await security(request)
    token = credentials.credentials

    try:
        # 2. 기존에 만들어둔 JWT 검증 함수 호출
        payload = verify_access_token(token)

        # 3. 다른 API 로직에서 유저 정보를 꺼내 쓸 수 있도록 request에 저장
        request.state.user = payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 만료되었습니다."
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다."
        )
