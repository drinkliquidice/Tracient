from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)

from fastapi import HTTPException
from utils import APIRequestModel
from src.users.datadef import MemberUser


class UpdateMemberForm(APIRequestModel):
    member_id: str
    contact_name: str
    contact_number: str
    use_contact: bool


async def update_member(form: UpdateMemberForm) -> None:
    member = await MemberUser.get(form.member_id)
    if member is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")
    try:
        await member.update({"$set": {
            "contact_name": form.contact_name,
            "contact_number": form.contact_number,
            "use_contact": form.use_contact,
        }})
    except Exception as e:
        logger.error(f"Failed to update member: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update member")