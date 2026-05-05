from __future__ import annotations
from datetime import datetime 

from beanie import Document
from beanie.odm.fields import PydanticObjectId

from settings import settings


class MemberUser(Document):
    name: str
    contact_name: str
    contact_number: str
    endpoint: str
    sign_in_time: datetime | None = None
    sign_out_time: datetime | None = None
    last_signed_in: datetime | None = None

    class Settings:
        name = "memberUsers"

    @staticmethod
    def assemble(name: str, contact_name: str, contact_number: str) -> MemberUser:
        doc_id = PydanticObjectId()
        member_endpoint = settings.TRACIENT_URL + "/" + str(doc_id)
        return MemberUser(
            id=doc_id,
            name=name,
            contact_name=contact_name,
            contact_number=contact_number,
            endpoint=member_endpoint,
            sign_in_time=None,
            sign_out_time=None,
            last_signed_in=None,
        )

