from src.service.users import signup_user, delete_user
from src.schemas.users import SignupRequest
from src.schemas.auth import SigninRequest
from src.service.auth import signin_user


TEST_USER_INFO = SignupRequest(id="test_user_test123123", pw="123", username="test")

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

def test_delete_user(db):
    """
    Tests that deleting a user returns True.
    """

    result = delete_user(TEST_USER_INFO.id, db)

    assert result
    