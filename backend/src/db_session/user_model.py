from sqlalchemy import Column, DateTime, String, Boolean
from datetime import datetime
from src.db_session.db import Base

class UserModel(Base):
    __tablename__= "users"

    id = Column(String, primary_key=True, index = True)
    password = Column(String, nullable=False)
    username = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now())
    is_active = Column(Boolean, default=True)