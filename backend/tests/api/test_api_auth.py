"""API 인증 계약 테스트.

기능 라우터는 액세스 토큰 없이는 401 로 거절하고,
로그인 전에 필요한 경로(health·auth·users)는 공개로 남는지 확인한다.
토큰 자체의 검증 규칙은 test_dependencies.py 가 본다.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.api import api_router
from src.service.auth import algoritm, create_jwt


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(api_router)
    return TestClient(app)


def _access_token() -> str:
    return create_jwt(
        {"sub": "testuser", "token_type": "access"},
        expires_delta=timedelta(minutes=30),
    )


PROTECTED_REQUESTS = [
    ("GET", "/api/v1/reference-faces"),
    ("GET", "/api/v1/face-swap-jobs/some-job-id"),
    ("POST", "/api/v1/face-swap-jobs"),
    ("GET", "/api/v1/video-jobs/some-job-id"),
    ("POST", "/api/v1/video-jobs"),
    ("POST", "/api/v1/video-captions"),
    ("POST", "/api/v1/text-gen/blog-generation"),
]


@pytest.mark.parametrize(("method", "path"), PROTECTED_REQUESTS)
def test_protected_routes_reject_missing_token(method, path):
    response = _client().request(method, path)
    assert response.status_code == 401


PUBLIC_REQUESTS = [
    ("GET", "/api/v1/health"),
    ("POST", "/api/v1/auth/signin"),
    ("POST", "/api/v1/auth/token-refresh"),
    ("POST", "/api/v1/users/signup"),
]


@pytest.mark.parametrize(("method", "path"), PUBLIC_REQUESTS)
def test_public_routes_do_not_require_token(method, path):
    # 빈 요청이라 422 등이 나올 수 있지만 인증 때문에 막히면 안 된다.
    response = _client().request(method, path)
    assert response.status_code != 401


def test_valid_token_passes_auth():
    response = _client().get(
        "/api/v1/reference-faces",
        headers={"Authorization": f"Bearer {_access_token()}"},
    )
    assert response.status_code == 200


def test_auth_me_returns_only_current_user_id():
    response = _client().get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {_access_token()}"},
    )

    assert response.status_code == 200
    assert response.json() == {"id": "testuser"}


def test_auth_me_rejects_expired_token_with_existing_detail():
    expired = create_jwt(
        {"sub": "testuser", "token_type": "access"},
        expires_delta=timedelta(minutes=-1),
    )
    response = _client().get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired}"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "토큰이 만료되었습니다."}


def test_auth_me_rejects_invalid_and_missing_tokens_with_existing_contract():
    invalid = jwt.encode(
        {
            "sub": "testuser",
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=30),
        },
        "different-secret",
        algorithm=algoritm,
    )

    invalid_response = _client().get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {invalid}"},
    )
    missing_response = _client().get("/api/v1/auth/me")

    assert invalid_response.status_code == 401
    assert invalid_response.json() == {"detail": "유효하지 않은 토큰입니다."}
    assert missing_response.status_code == 401
    assert missing_response.json() == {"detail": "Not authenticated"}
