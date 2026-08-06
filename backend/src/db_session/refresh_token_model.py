from src.db_session.db import Base
from sqlalchemy import Column, DateTime, String, ForeignKey, Integer
from datetime import datetime

class RefreshTokenModel(Base):
    __tablename__="refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    updated_at = Column(DateTime, onupdate=datetime.now())