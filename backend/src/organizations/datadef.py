from beanie import Document
from pydantic import BaseModel


class OrgnanizationDocument(Document):
    name: str
    admin_users: list[str]
    members: list[str]
    assets: list[str]
    

    class Settings:
        name = "organizations"