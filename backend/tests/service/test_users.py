import jwt
import pytest

from src.db_session.db import get_db
from src.exceptions.auth import InvalidTokenError, TokenExpiredError
from src.schemas.auth import SigninRequest, TokenInfo
from src.schemas.users import SignupRequest
from src.service.auth import signin_user, verify_access_token
from src.service.users import delete_user, signup_user

TEST_USER_INFO = SignupRequest(id="test_user_test123123", pw="123", username="test")

def test_invalid_access_token():
    """
    Tests that an invalid access token raises an InvalidTokenError.
    """
    invalid_token = "ewogICJhbGciOiAiSFMyNTYiLAogICJ0eXAiOiAiSldUIgp9.ewogICJ1c2VyX2lkIjogImd5dWJlb20iLAogICJleHBpcmUiOiAiMjA1MC0wMS0wMSIKfQ.XFi0r6O19XddG-SRWybIQqQi9XY1K284hU_muUc2eFA"

    result = jwt.decode(invalid_token, "asdf", algorithms=["HS256"])

    result = TokenInfo(**result)

    assert result.user_id == "gyubeom"

    with pytest.raises(InvalidTokenError):
        verify_access_token(invalid_token)

def test_delete_no_exist_user():
    """
    Tests that deleting a non-existent user returns False.
    """
    db = next(get_db())

    result = delete_user(TEST_USER_INFO.id, db)

    assert not result

def test_signin_no_exist_user():
    """
    Tests that signing in a non-existent user returns False.
    """
    db = next(get_db())

    signin_request = SigninRequest(id=TEST_USER_INFO.id, pw=TEST_USER_INFO.pw)
    
    result = signin_user(signin_request, db)

    assert not result

def test_create_new_user():
    """
    Tests that creating a new user returns True.
    """
    db = next(get_db())

    result = signup_user(TEST_USER_INFO, db)

    assert result

def test_signin_user():
    """
    Tests that signing in a user returns True.
    """
    db = next(get_db())

    signin_request = SigninRequest(id=TEST_USER_INFO.id, pw=TEST_USER_INFO.pw)
    
    result = signin_user(signin_request, db)

    assert result.access_token and result.refresh_token

    token_info = verify_access_token(result.access_token)

    assert token_info.user_id == TEST_USER_INFO.id

def test_delete_user():
    """
    Tests that deleting a user returns True.
    """
    db = next(get_db())

    result = delete_user(TEST_USER_INFO.id, db)

    assert result

def test_expired_access_token():
    """
    Tests that an expired access token raises a TokenExpiredError.
    """

    with pytest.raises(TokenExpiredError):
        expired_token = 'ewogICJhbGciOiAiSFMyNTYiLAogICJ0eXAiOiAiSldUIgp9.ewogICJ1c2VyX2lkIjogInRlc3QxMjMiLAogICJleHBpcmUiOiAiMjAyNi0wOC0wNlQxMzo0NTozMC4xMjM0NTYrMDA6MDAiCn0.9lkLaRgEAkmNy2IUiW5-HtVR0f8gjmqWvABG138kcQk'
        
        verify_access_token(expired_token)