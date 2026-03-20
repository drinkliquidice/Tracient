from __future__ import annotations

from utils import APIRequestModel
from datadef import AdminUser

class NewUserForm(APIRequestModel):
    first_name: str
    last_name: str
    username: str
    password: str

    def create_document(self) -> AdminUser:
        return AdminUser(
            username=self.username,
            password=self.password,
            first_name=self.first_name,
            last_name=self.last_name,
        )

def create_new_admin(form: NewUserForm) -> None:
    new_admin = form.create_document()
    if 


