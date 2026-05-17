from __future__ import annotations
from datetime import datetime 

from beanie import Document, PydanticObjectId

from settings import settings
from utils import PyObjectId


class MemberUser(Document):
    name: str
    contact_name: str
    contact_number: str
    endpoint: str
    assets: list[PyObjectId] = []
    use_contact: bool = False
    sign_in_time: datetime | None = None
    sign_out_time: datetime | None = None
    last_signed_in: datetime | None = None

    class Settings:
        name = "memberUsers"

    @staticmethod
    def assemble(name: str, contact_name: str, contact_number: str, use_contact: bool) -> MemberUser:
        doc_id = PydanticObjectId()
        member_endpoint = settings.TRACIENT_URL + "admin/member/" + str(doc_id)
        return MemberUser(
            id=doc_id,
            name=name,
            contact_name=contact_name,
            contact_number=contact_number,
            endpoint=member_endpoint,
            sign_in_time=None,
            sign_out_time=None,
            last_signed_in=None,
            use_contact=use_contact,
            assets=[],
        )
