from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from beanie import init_beanie
from src.admin.datadef import AdminUser
from src.api.auth import auth_router
from src.api.pages.dashboard import admin_pages_router
from src.api.actions.organizations import organizations_actions_router
from src.api.actions.twilio import twilio_actions_router
from src.database.mongodb import mongo, set_up_mongo
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_beanie(
        database=mongo, #type: ignore
        document_models=[AdminUser, OrganizationDocument, MemberUser]
    )
    print("Beanie initialized!")
    await set_up_mongo()
    await mongo["adminUsers"].create_index("username", unique=True)
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
app.include_router(admin_pages_router)
app.include_router(organizations_actions_router)
app.include_router(twilio_actions_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tracient.pages.dev",
        "https://e10fa18e.tracient.pages.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/health")
async def health_check():
    return {"status": "ok"}
