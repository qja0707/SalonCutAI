from datetime import UTC, datetime, timedelta

import jwt
import pytest

from src.schemas.auth import SigninRequest, TokenInfo
from src.schemas.users import SignupRequest
from src.service.auth import create_jwt, signin_user, verify_access_token
from src.service.users import delete_user, signup_user

TEST_USER_INFO = SignupRequest(id="test_user_test123123", pw="123", username="test")


def test_invalid_access_token():
    """
    Tests that an invalid access token raises an InvalidTokenError.
    """

    invalid_token = jwt.encode(
        {
            "sub": "gyubeom",
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=15),
        },
        "asdf",
        algorithm="HS256",
    )

    result = jwt.decode(invalid_token, "asdf", algorithms=["HS256"])

    result = TokenInfo(**result)

    assert result.sub == "gyubeom"

    with pytest.raises(jwt.PyJWTError):
        verify_access_token(invalid_token)


def test_delete_no_exist_user(db):
    """
    Tests that deleting a non-existent user returns False.
    """

    result = delete_user(TEST_USER_INFO.id, db)

    assert not result


def test_signin_no_exist_user(db):
    """
    Tests that signing in a non-existent user returns False.
    """

    signin_request = SigninRequest(id=TEST_USER_INFO.id, pw=TEST_USER_INFO.pw)

    result = signin_user(signin_request, db)

    assert not result


def test_create_new_user(db):
    """
    Tests that creating a new user returns True.
    """

    result = signup_user(TEST_USER_INFO, db)

    assert result


def test_signin_user(db):
    """
    Tests that signing in a user returns True.
    """

    signin_request = SigninRequest(id=TEST_USER_INFO.id, pw=TEST_USER_INFO.pw)

    result = signin_user(signin_request, db)

    assert result.access_token and result.refresh_token

    token_info = verify_access_token(result.access_token)

    assert token_info.sub == TEST_USER_INFO.id


def test_delete_user(db):
    """
    Tests that deleting a user returns True.
    """

    result = delete_user(TEST_USER_INFO.id, db)

    assert result


def test_expired_access_token():
    """
    Tests that an expired access token raises a TokenExpiredError.
    """

    expired_token = create_jwt(
        {"sub": "gyubeom", "token_type": "access"}, timedelta(-1)
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        verify_access_token(expired_token)
