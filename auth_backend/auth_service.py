from typing import Optional, Union
import os, json
from uuid import uuid4
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
import logging

if os.getenv("RUNNING_ENV") != "production":
    load_dotenv(".env.local")

log_dir = '/app/logs' if os.getenv("RUNNING_ENV") == 'production' else "./logs"
log_file = os.path.join(log_dir, "app.log")

os.makedirs(log_dir, exist_ok=True)
with open(log_file, "a"):
    pass  

logging.basicConfig(
    filename=log_file,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

console = logging.StreamHandler()
console.setLevel(logging.INFO)
console.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
logging.getLogger().addHandler(console)


def verify_key_pair(private_key: str, public_key: str, algorithm: str = "RS256"):
    """
    Signs and verifies a test JWT to ensure the private and public keys match.
    Raises an Exception if they do not match.
    """
    test_payload = {"test": "keypair"}
    try:
        token = jwt.encode(test_payload, private_key, algorithm=algorithm)
        decoded = jwt.decode(token, public_key, algorithms=[algorithm])
        assert decoded["test"] == "keypair"
    except Exception as e:
        raise RuntimeError(f"JWT private/public key mismatch or invalid: {e}")

from .db_connection import create_new_user, does_user_field_exist, authenticate_user, increment_login_count
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

origins = os.environ.get("CORS_ORIGIN", "").split(",")

redirect_authorization_codes = {}  # Temporary storage for authorization codes

logging.info("CORS origins: %s", origins)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SECRET_KEY = os.getenv("JWT_SECRET").replace("\\n", "\n")
PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY", "").replace("\\n", "\n")
ALGORITHM = "RS256"
verify_key_pair(SECRET_KEY, PUBLIC_KEY, ALGORITHM)
logging.info("JWT keys verified successfully")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))  # Default to 30 minutes if not set

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

async def get_current_user(access_token: Optional[str] = Cookie(None)):
    logging.info("get_current_user called with token: %s", access_token)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    logging.info("Token received: %s", access_token)
    try:
        payload = jwt.decode(access_token, PUBLIC_KEY, algorithms=[ALGORITHM])
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
    logging.info(f"Raw body: {body}")
    user = authenticate_user(body.get("email"), body.get("password"))
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token_data = {
        "username": user.username,
        "email": user.email,
        "roles": "user.roles" if hasattr(user, 'roles') else "user",  # Assuming user has a roles attribute
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
    logging.info(f"Access token created: {access_token}")
    increment_login_count(user.id) 
    return {"access_token": access_token , "token_type": "bearer"}

@app.get("/issue-authorization-code")
def issue_authorization_code(current_user: dict = Depends(get_current_user), redirect_uri: str = None):
    """
    Issues a temporary authorization code for the given redirect URI.
    """
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(current_user, expires_delta=access_token_expires)

    temporary_code = str(uuid4())
    redirect_authorization_codes[temporary_code] = access_token
    logging.info(f"Issued temporary authorization code: {temporary_code} for user: {current_user.get('username')}")
    return {"authorization_code": temporary_code}


#example http://127.0.0.1:8000/redeem-authorization-code?authorization_code=2893f64a-b2db-41ab-ab97-1c5c757b56a9
@app.get("/redeem-authorization-code")
def redeem_authorization_code(authorization_code: str):
    """
    Redeems a temporary authorization code for an access token.
    """
    if authorization_code not in redirect_authorization_codes:
        raise HTTPException(status_code=400, detail="Invalid authorization code")

    access_token = redirect_authorization_codes[authorization_code]
    logging.info(f"Redeemed authorization code: {authorization_code} for access token: {access_token}")
    del redirect_authorization_codes[authorization_code]
    return {"access_token": access_token}

@app.get("/public-key")
def get_public_key():
    """
    Returns the public key for verifying JWT tokens.
    """
    return {"public_key": PUBLIC_KEY}

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

    logging.info("Creating account with email:", email)
    try:
        create_new_user(username=username, email=email, password=password)
    except Exception as e:
        logging.info(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error creating user")

    return {"message": "User created successfully"}


@app.get("/verify-token")
async def verify_token(access_token: str = Cookie(None)):
    logging.info(f"Verifying token: {access_token}")
    """
    Verifies the provided JWT token.
    """
    try:
        payload = jwt.decode(access_token, PUBLIC_KEY, algorithms=[ALGORITHM])
        return {"message": "Token is valid", "payload": payload}
    except jwt.PyJWTError as e:
        logging.error(f"Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/protected")
async def read_protected(current_user: dict = Depends(get_current_user)):
    logging.info(f"Current user: {current_user}")
    return {"message": f"Hello {current_user['username']}, this is a protected resource."}

@app.get("/healthcheck")
async def healthcheck():
    logging.info("Healthcheck hit")
    return 200