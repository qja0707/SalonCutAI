from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.sql import func

from src.db_session.db import Base


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    password = Column(String, nullable=False)
    username = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    is_active = Column(Boolean, default=True)
