import bcrypt
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy_base import Base  
import os

from UserModel import User  # Import the User model from UserModel.py

DATABASE_URL = f"postgresql://postgres:${os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST', 'localhost')}:5432/postgres"

engine = create_engine(DATABASE_URL)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Example usage: get a user by id
def get_user_by_id(user_id: int):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        return user
    finally:
        db.close()


# insert a user into the database
def create_user(username: str, email: str = None):
    db = SessionLocal()
    try:
        new_user = User(username=username, email=email)  # Email can be set to None or provided
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        db.rollback()
        print(f"Error creating user: {e}")
    finally:
        db.close()

def update_user(user_id: int, username: str = None, email: str = None):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if user:
            if username:
                user.username = username
            if email:
                user.email = email
            db.commit()
            return user
        else:
            print("User not found")
    except Exception as e:
        db.rollback()
        print(f"Error updating user: {e}")
    finally:
        db.close()

# print(create_user("testuser", "rob@example.com") ) # Example of creating a user

# print((get_user_by_id(10)).__dict__)

# print(update_user(10, email="new_email@example.com"))

def hash_password(password):
  """Hashes a password with a randomly generated salt."""
  # Generate a salt (adjust rounds for desired work factor)
  salt = bcrypt.gensalt(12) 
  hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
  return hashed_password.decode('utf-8') 

def check_password(password, stored_hash):
  """Checks if a password matches a stored hash."""
  return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))

def does_user_field_exist(field: str, value: str) -> bool:
    db = SessionLocal()
    try:
        user = db.query(User).filter(getattr(User, field) == value).first()
        return user is not None
    finally:
        db.close()

def create_new_user(username: str, email: str, password: str):
    db = SessionLocal()
    hashed_and_salted_password = hash_password(password)
    try:
        new_user = User(username=username, email=email, password_hash=hashed_and_salted_password)
        db.add(new_user)
        db.commit()
        return new_user
    except Exception as e:
        db.rollback()
        raise Exception(f"Error creating user: {e}")
    finally:
        db.close()

def increment_login_count(user_id: int):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.number_of_logins += 1
            db.commit()
            return user
        else:
            print("User not found")
    except Exception as e:
        db.rollback()
        print(f"Error incrementing login count: {e}")
    finally:
        db.close()


def authenticate_user(email: str, password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user and check_password(password, user.password_hash):
            return user
        return None
    finally:
        db.close()