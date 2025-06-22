from typing import Union
import os, json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List
import jwt
import datetime
from fastapi import status

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

origins = os.environ.get("CORS_ORIGIN", "http://localhost:5173,http://10.0.0.49:5173").split(",")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fake_users_db = {
    "rob": {
        "username": "rob",
        "password": "rob",  # In production, use hashed passwords!
        "roles": ["user", "admin"]
    }
}

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

def authenticate_user(username: str, password: str):
    user = fake_users_db.get(username)
    if not user or user["password"] != password:
        return None
    return user

def create_jwt_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@app.post("/login", response_model=TokenResponse)
async def  login(request: Request):
    body_bytes = await request.body()  # Raw bytes of the request body
    headers = request.headers    # Headers as a dictionary-like object
    body = json.loads(body_bytes)
    # You can also access request.method, request.url, etc.
    print("Raw body:", body)
    user = authenticate_user(body.get("username"), body.get("password"))
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token_data = {
        "sub": user["username"],
        "roles": user["roles"]
    }
    token = create_jwt_token(token_data)
    return {"access_token": token, "token_type": "bearer"}

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