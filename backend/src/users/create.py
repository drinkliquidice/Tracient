from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)

from fastapi import HTTPException

from utils import APIRequestModel
from src.users.datadef import MemberUser, ContactSubDocument
from src.organizations.datadef import OrganizationDocument
from src.organizations.interface import OrganizationMemberData, member_to_interface


class ContactInput(APIRequestModel):
    name: str
    email: str = ""
    contact_number: str


class NewMemberForm(APIRequestModel):
    org_id: str
    name: str
    contacts: list[ContactInput]
    use_sms: bool = False
    use_email: bool = False

    def create_document(self) -> MemberUser:
        contacts = [
            ContactSubDocument(
                name=c.name.strip(),
                email=c.email.strip(),
                contact_number=c.contact_number.strip(),
            )
            for c in self.contacts
            if c.name.strip() or c.email.strip() or c.contact_number.strip()
        ]
        return MemberUser.assemble(
            name=self.name,
            contacts=contacts,
            use_sms=self.use_sms,
            use_email=self.use_email,
        )


async def create_new_member(form: NewMemberForm) -> OrganizationMemberData:
    if not form.name.strip():
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Member name is required")
    if not form.contacts:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="At least one contact is required")

    member_doc = form.create_document()
    if not member_doc.contacts:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="At least one contact is required")
    try:
        await member_doc.insert()
    except Exception as e:
        logger.error(f"Failed to insert member: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to create new member")

    try:
        org = await OrganizationDocument.get(form.org_id)
        if org is None:
            await member_doc.delete()
            raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")
        await org.update({"$push": {"members": member_doc.id}})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add member to org: {e}", exc_info=True)
        await member_doc.delete()
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to add member to organization")

    return await member_to_interface(member_doc)
