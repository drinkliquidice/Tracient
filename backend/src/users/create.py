from __future__ import annotations

from backend.settings import settings
from backend.utils import APIRequestModel
from src.users.datadef import MemberUser

class NewStudentForm(APIRequestModel):
    name: str
    student_id: str
    parent_name: str
    parent_number: str

    def create_document(self) -> MemberUser:
        return MemberUser.assemble(
            name=self.name,
            contact_name=self.parent_name,
            contact_number=self.parent_number,
        )
