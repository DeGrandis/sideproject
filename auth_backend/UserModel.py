from sqlalchemy import TIMESTAMP, Boolean, Column, Integer, String, func
from sqlalchemy_base import Base  


class User(Base):
    __tablename__ = "user_info"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    last_login = Column(TIMESTAMP)
    number_of_logins = Column(Integer, default=1)