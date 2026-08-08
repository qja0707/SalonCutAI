from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import HTTPException, Request

from src.api.dependencies import check_auth_token
from src.service.auth import algoritm, create_jwt


# A simple mock for the Request object's scope
def mock_scope(access_token: str):
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"authorization", f"Bearer {access_token}".encode())],
        "state": {},  # request.state를 쓰기 위해 필요
    }

    return scope


@pytest.mark.asyncio
async def test_check_auth_token_success():
    """정상적인 액세스 토큰 테스트"""
    user_id = "testuser"
    token_payload = {"sub": user_id, "token_type": "access"}
    access_token = create_jwt(token_payload, expires_delta=timedelta(minutes=30))

    request = Request(mock_scope(access_token))

    await check_auth_token(request)

    assert request.state.user is not None
    assert request.state.user.sub == user_id


@pytest.mark.asyncio
async def test_check_auth_token_no_header():
    """헤더에 토큰이 없는 경우 테스트"""
    request = Request(mock_scope(""))

    with pytest.raises(HTTPException) as exc_info:
        await check_auth_token(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Not authenticated"


@pytest.mark.asyncio
async def test_check_auth_token_invalid_signature():
    """서명이 틀린 토큰 테스트"""
    user_id = "testuser"

    to_encode = {
        "sub": user_id,
        "token_type": "access",
        "exp": datetime.now(UTC) + timedelta(minutes=30),
    }

    # Use a different secret key to sign the token
    invalid_secret = "a-different-secret-key-that-is-not-the-correct-one"
    invalid_token = jwt.encode(to_encode, invalid_secret, algorithm=algoritm)

    headers = {"Authorization": f"Bearer {invalid_token}"}
    request = Request(mock_scope(headers))

    with pytest.raises(HTTPException) as exc_info:
        await check_auth_token(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "유효하지 않은 토큰입니다."


@pytest.mark.asyncio
async def test_check_auth_token_expired():
    """만료된 토큰 테스트"""
    user_id = "testuser"
    token_payload = {"sub": user_id, "token_type": "access"}
    expired_token = create_jwt(
        token_payload,
        expires_delta=timedelta(minutes=-1),  # Expired 1 minute ago
    )

    request = Request(mock_scope(expired_token))

    with pytest.raises(HTTPException) as exc_info:
        await check_auth_token(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "토큰이 만료되었습니다."


@pytest.mark.asyncio
async def test_check_auth_token_is_refresh_token():
    """리프레시 토큰을 사용한 경우 테스트"""
    user_id = "testuser"
    token_payload = {"sub": user_id, "token_type": "refresh"}
    refresh_token = create_jwt(token_payload, expires_delta=timedelta(days=7))

    headers = {"Authorization": f"Bearer {refresh_token}"}
    request = Request(mock_scope(headers))

    with pytest.raises(HTTPException) as exc_info:
        await check_auth_token(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "유효하지 않은 토큰입니다."
