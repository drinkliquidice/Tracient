from beanie import Document


class AdminUser(Document):
    username: str
    password: str
    first_name: str
    last_name: str

    class Settings:
        name = "admin_users"
