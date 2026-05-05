from datetime import datetime, timezone, timedelta
import jwt as pyjwt
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from settings import settings

from src.admin.datadef import AdminUser

ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return pyjwt.encode({"sub": username, "exp": expire, "type": "access"}, settings.SECRET_KEY, settings.ALGORITHM)

def create_refresh_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return pyjwt.encode({"sub": username, "exp": expire, "type": "refresh"}, settings.SECRET_KEY, settings.ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> AdminUser:
    token = credentials.credentials
    try:
        payload: dict = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_type = payload["type"]
        username = payload["sub"]

        if token_type != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await AdminUser.find_one(AdminUser.username == username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user