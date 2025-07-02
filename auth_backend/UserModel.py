from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String, Table, func
from .sqlalchemy_base import Base  
from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, Table, TIMESTAMP, UniqueConstraint
from sqlalchemy.orm import relationship

user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('user_info.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
)

class User(Base):
    __tablename__ = 'user_info'
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    created_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    updated_at = Column(TIMESTAMP, server_default="CURRENT_TIMESTAMP")
    is_active = Column(Boolean, default=True)
    last_login = Column(TIMESTAMP)
    number_of_logins = Column(Integer, default=1)

    roles = relationship('Role', secondary=user_roles, back_populates='users')

    __table_args__ = (
        UniqueConstraint('email', name='uq_user_email'),
        UniqueConstraint('username', name='uq_username'),
    )

class Role(Base):
    __tablename__ = 'roles'
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)

    users = relationship('User', secondary=user_roles, back_populates='roles')