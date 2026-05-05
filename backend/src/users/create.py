from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)

from fastapi import HTTPException

from settings import settings
from utils import APIRequestModel
from src.users.datadef import MemberUser

from src.organizations.datadef import OrganizationDocument

class NewMemberForm(APIRequestModel):
    org_id: str
    name: str
    contact_name: str
    contact_number: str

    def create_document(self) -> MemberUser:
        return MemberUser.assemble(
            name=self.name,
            contact_name=self.contact_name,
            contact_number=self.contact_number,
        )


async def create_new_member(form: NewMemberForm) -> None:
    member_doc = form.create_document()
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