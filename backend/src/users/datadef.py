from __future__ import annotations
from datetime import datetime

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

from settings import settings
from utils import PyObjectId


class ContactSubDocument(BaseModel):
    name: str
    email: str = ""
    contact_number: str


class MemberUser(Document):
    name: str
    contacts: list[ContactSubDocument] = Field(default_factory=list)
    endpoint: str
    assets: list[PyObjectId] = Field(default_factory=list)
    use_sms: bool | None = None
    use_email: bool = False
    # Legacy combined notification flag
    use_contact: bool = False
    sign_in_time: datetime | None = None
    sign_out_time: datetime | None = None
    last_signed_in: datetime | None = None
    # Legacy flat fields from earlier documents
    contact_name: str | None = None
    contact_number: str | None = None

    class Settings:
        name = "memberUsers"

    def resolved_contacts(self) -> list[ContactSubDocument]:
        if self.contacts:
            return self.contacts
        if self.contact_name or self.contact_number:
            return [ContactSubDocument(
                name=self.contact_name or "",
                email="",
                contact_number=self.contact_number or "",
            )]
        return []

    def sms_enabled(self) -> bool:
        if self.use_sms is not None:
            return self.use_sms
        return self.use_contact

    def email_enabled(self) -> bool:
        return self.use_email

    @staticmethod
    def assemble(
        name: str,
        contacts: list[ContactSubDocument],
        use_sms: bool,
        use_email: bool,
    ) -> MemberUser:
        doc_id = PydanticObjectId()
        member_endpoint = settings.TRACIENT_URL + "admin/member/" + str(doc_id)
        return MemberUser(
            id=doc_id,
            name=name,
            contacts=contacts,
            endpoint=member_endpoint,
            sign_in_time=None,
            sign_out_time=None,
            last_signed_in=None,
            use_sms=use_sms,
            use_email=use_email,
            use_contact=False,
            assets=[],
        )
