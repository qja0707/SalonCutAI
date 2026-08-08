import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.db_session.db import Base

# db for test
TEST_DATABASE_URL = "sqlite:///../database/test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def setup_database():
    """전체 테스트 시작 시 기존 테이블을 삭제 후 새로 만들고 종료 후 삭제"""
    Base.metadata.drop_all(bind=engine)

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def db(setup_database):
    session = TestingSessionLocal()

    yield session

    # 테스트 종료 후 디비 세션 삭제
    session.close()
