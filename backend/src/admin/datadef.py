from beanie import Document
from utils import PyObjectId


class AdminUser(Document):
    username: str
    password: str
    first_name: str
    last_name: str
    organization: PyObjectId | None = None

    class Settings:
        name = "adminUsers"

