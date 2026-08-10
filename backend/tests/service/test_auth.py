from datetime import timedelta

import jwt
import pytest

from src.schemas.auth import SigninRequest
from src.schemas.users import SignupRequest
from src.service.auth import create_jwt, signin_user, token_refresh_with_verify
from src.service.users import signup_user

TEST_USER_INFO = SignupRequest(id="auth_test", pw="123", username="test")


@pytest.fixture
def logged_in_user_tokens(db):
    """유저 가입 및 로그인을 처리하여 유효한 토큰 세트를 반환하는 픽스처"""
    signup_user(TEST_USER_INFO, db)
    signin_request = SigninRequest(id=TEST_USER_INFO.id, pw=TEST_USER_INFO.pw)
    return signin_user(signin_request, db)


# --- 시나리오별 테스트 케이스 ---


def test_token_refresh_fails_if_not_refresh_type(db):
    """❌ 케이스1: 토큰 타입이 refresh가 아닐 때 (access 토큰 전달 시)"""
    invalid_type_token = create_jwt(
        {"sub": TEST_USER_INFO.id, "token_type": "access"}, timedelta(minutes=15)
    )

    with pytest.raises(jwt.InvalidTokenError, match="refresh token 이 아닙니다"):
        token_refresh_with_verify(invalid_type_token, db)


def test_token_refresh_fails_if_no_db_record(db):
    """❌ 디비에 해당 유저의 접속 기록이 없을 때"""
    no_record_token = create_jwt(
        {"sub": "non_existent_user_id", "token_type": "refresh"}, timedelta(days=7)
    )

    with pytest.raises(jwt.InvalidTokenError, match="로그인 기록이 없는 사용자입니다"):
        token_refresh_with_verify(no_record_token, db)


def test_token_refresh_fails_if_token_mismatch(db, logged_in_user_tokens):
    """❌ DB에 저장된 유저의 리프레시 토큰과 불일치할 때"""
    mismatched_token = create_jwt(
        {"sub": TEST_USER_INFO.id, "token_type": "refresh"}, timedelta(days=8)
    )

    with pytest.raises(
        jwt.InvalidTokenError, match="기존 리프레시 토큰과 일치하지 않습니다"
    ):
        token_refresh_with_verify(mismatched_token, db)


def test_expired_refresh_token(db):
    """
    ❌ 리프레시 토큰이 만료되었을 때 TokenExpiredError(ExpiredSignatureError) 발생 검증
    """
    # timedelta(-1)을 주어 이미 어제 만료된 리프레시 토큰을 강제로 생성합니다.
    expired_refresh_token = create_jwt(
        {"sub": TEST_USER_INFO.id, "token_type": "refresh"}, timedelta(-1)
    )

    # jwt.decode 단계에서 유효기간 만료(ExpiredSignatureError)로 즉시 튕겨 나가는지 검증합니다.
    with pytest.raises(jwt.ExpiredSignatureError):
        token_refresh_with_verify(expired_refresh_token, db)


def test_token_refresh_success(db, logged_in_user_tokens):
    """정상 케이스: 성공적으로 토큰이 리프레시되어 반환되는지 검증"""
    valid_refresh_token = logged_in_user_tokens.refresh_token

    response = token_refresh_with_verify(valid_refresh_token, db)

    assert response is not None
    assert response.access_token is not None
    assert response.refresh_token is not None
