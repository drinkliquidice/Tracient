from beanie import Document
from utils import PyObjectId


class OrganizationDocument(Document):
    name: str
    admin_users: list[PyObjectId]
    members: list[PyObjectId]
    assets: list[PyObjectId]
    

    class Settings:
        name = "organizations"