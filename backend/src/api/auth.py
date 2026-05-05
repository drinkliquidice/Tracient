from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from settings import settings
from src.admin.datadef import AdminUser
import jwt

auth_router = APIRouter(prefix="/api/admin")

class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str

class RefreshRequest(BaseModel):
    refresh_token: str

@auth_router.post("/login")
async def login(body: LoginRequest):
    user = await AdminUser.find_one(AdminUser.username == body.username)
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {
        "token": create_access_token(user.username),
        "refresh_token": create_refresh_token(user.username),
    }

@auth_router.post("/signup")
async def signup(body: SignupRequest):
    existing = await AdminUser.find_one(AdminUser.username == body.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    
    user = AdminUser(
        username=body.username,
        password=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
    )
    await user.insert()
    return {
        "token": create_access_token(user.username),
        "refresh_token": create_refresh_token(user.username),
    }

@auth_router.post("/refresh")
async def refresh(body: RefreshRequest):
    try:
        payload: dict = jwt.decode(body.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload["type"] != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        username = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    return {"token": create_access_token(username)}

@auth_router.get("/me")
async def get_me(current_user: AdminUser = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "organizations": current_user.organizations,
    }