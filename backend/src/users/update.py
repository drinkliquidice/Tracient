from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException
from utils import APIRequestModel
from src.users.datadef import MemberUser, ContactSubDocument
from src.organizations.datadef import OrganizationDocument
from src.users.create import ContactInput
from src.organizations.interface import OrganizationMemberData, member_to_interface

from beanie.odm.fields import PydanticObjectId


class UpdateMemberForm(APIRequestModel):
    org_id: str
    member_id: str
    contacts: list[ContactInput]
    use_sms: bool
    use_email: bool
    delete_user: bool


async def update_member(form: UpdateMemberForm) -> OrganizationMemberData | None:
    member = await MemberUser.get(form.member_id)
    if member is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")

    try:
        if form.delete_user:
            await member.delete()
            try:
                org = await OrganizationDocument.get(form.org_id)
                if org is None:
                    raise ValueError(f"Organization {form.org_id} not found")
                await org.update({"$pull": {"members": PydanticObjectId(form.member_id)}})
            except Exception as pull_err:
                logger.error(f"Failed to remove member from org, restoring member document: {pull_err}", exc_info=True)
                await member.insert()
                raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to delete member")
            return None

        contacts = [
            ContactSubDocument(
                name=c.name.strip(),
                email=c.email.strip(),
                contact_number=c.contact_number.strip(),
            )
            for c in form.contacts
            if c.name.strip() or c.email.strip() or c.contact_number.strip()
        ]
        member.contacts = contacts
        member.use_sms = form.use_sms
        member.use_email = form.use_email
        member.use_contact = False
        member.contact_name = None
        member.contact_number = None
        await member.save()
        return await member_to_interface(member)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update member: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update member")
