from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException
from utils import APIRequestModel
from src.users.datadef import MemberUser
from src.organizations.datadef import OrganizationDocument

class UpdateMemberForm(APIRequestModel):
    org_id: str
    member_id: str
    contact_name: str
    contact_number: str
    use_contact: bool
    delete_user: bool

from beanie.odm.fields import PydanticObjectId

async def update_member(form: UpdateMemberForm) -> None:
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
            return

        await member.update({"$set": {
            "contact_name": form.contact_name,
            "contact_number": form.contact_number,
            "use_contact": form.use_contact,
        }})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update member: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update member")