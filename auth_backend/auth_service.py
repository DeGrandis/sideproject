from typing import Optional, Union
import os, json
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from fastapi.params import Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List
import jwt
import datetime
from fastapi import status
from dotenv import load_dotenv

if os.getenv("RUNNING_ENV") != "production":
    load_dotenv()

from db_connection import create_new_user, does_user_field_exist, authenticate_user, increment_login_count
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

origins = os.environ.get("CORS_ORIGIN", "").split(",")

print("CORS origins:", origins)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)  # Default to 30 minutes if not set

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

async def get_current_user(access_token: Optional[str] = Cookie(None)):
    print("get_current_user called with token:", access_token)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    print("Token received:", access_token)
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("username")
        if username is None:
            raise credentials_exception
        # You would typically query your database to get the user based on the username
        # For this example, let's assume a dummy user:
        user = {"username": username}
        if user is None:
            raise credentials_exception
        return payload
    except jwt.PyJWTError:
        raise credentials_exception

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/login", response_model=TokenResponse)
async def  login(response: Response, request: Request):
    body_bytes = await request.body()  # Raw bytes of the request body
    headers = request.headers    # Headers as a dictionary-like object
    body = json.loads(body_bytes)
    print("Raw body:", body)
    user = authenticate_user(body.get("email"), body.get("password"))
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token_data = {
        "username": user.username,
        "email": user.email,
        # "roles": user["roles"]
    }
    
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(token_data, expires_delta=access_token_expires)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Prevents client-side JS access
        secure=os.getenv("RUNNING_ENV") == "production",    # Only send over HTTPS (use False for local testing if not using HTTPS)
        samesite="Lax", # or "Lax" for CSRF protection
        domain=os.getenv("COOKIE_DOMAIN", ".127.0.0.1"),  # Set your domain here
        expires=access_token_expires # Optional: Set cookie expiration
    )
    print("Access token created:", access_token)

    increment_login_count(user.id) 
    return {"access_token": access_token , "token_type": "bearer"}

@app.post("/verify-token")
def verify_jwt_token(token: str = Depends(oauth2_scheme)):
    """
    Verifies a JWT token from the Authorization header and returns the decoded payload if valid.
    Returns 401 if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(payload)
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    

@app.post("/create-account")
async def create_account(request: Request):
    body = json.loads(await request.body())
    username = body.get("username")
    email = body.get("email")
    password = body.get("password")
    confirmed_password = body.get("confirmedPassword")

    if not email or not password or not confirmed_password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if password != confirmed_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if len(email) < 5 or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    if does_user_field_exist("email", email):
        raise HTTPException(status_code=400, detail="Email already exists")
    if does_user_field_exist("username", username):
        raise HTTPException(status_code=400, detail="Username already exists")

    print("Creating account with email:", email)
    try:
        create_new_user(username=username, email=email, password=password)
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error creating user")

    return {"message": "User created successfully"}


@app.get("/protected")
async def read_protected(current_user: dict = Depends(get_current_user)):
    print("Current user:", current_user)
    return {"message": f"Hello {current_user['username']}, this is a protected resource."}