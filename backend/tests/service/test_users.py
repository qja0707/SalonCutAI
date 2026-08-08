import jwt
import pytest

from src.schemas.auth import SigninRequest, TokenInfo
from src.schemas.users import SignupRequest
from src.service.auth import signin_user, verify_access_token
from src.service.users import delete_user, signup_user

TEST_USER_INFO = SignupRequest(id="test_user_test123123", pw="123", username="test")


def test_invalid_access_token():
    """
    Tests that an invalid access token raises an InvalidTokenError.
    """
    invalid_token = "ewogICJhbGciOiAiSFMyNTYiLAogICJ0eXAiOiAiSldUIgp9.ewogICJzdWIiOiAiZ3l1YmVvbSIsCiAgInRva2VuX3R5cGUiOiAiYWNjZXNzX3Rva2VuIiwKICAiZXhwIjogMjUyNDYwODAwMAp9.mBNQGFzBPsBk-yGzinuw0WPVCuiei-4Wnye2w__j7C4"

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

    with pytest.raises(jwt.ExpiredSignatureError):
        expired_token = "ewogICJhbGciOiAiSFMyNTYiLAogICJ0eXAiOiAiSldUIgp9.ewogICJzdWIiOiAiZ3l1YmVvbSIsCiAgInRva2VuX3R5cGUiOiAiYWNjZXNzX3Rva2VuIiwKICAiZXhwIjogMTUyNDYwODAwMAp9.UHP6gQ1gNZRBRZdexaHHHUZUsQd1iTNBfxZa1ciLErk"

        verify_access_token(expired_token)
