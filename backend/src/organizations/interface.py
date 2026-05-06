from __future__ import annotations
from datetime import datetime

from fastapi import HTTPException
from http import HTTPStatus

from utils import APIResponseModel
from src.database.mongodb import mongo
from src.admin.datadef import AdminUser
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser
    

class OrganizationMemberData(APIResponseModel):
    id: str
    name: str
    contact_name: str
    contact_number: str
    sign_in_time: datetime | None 
    sign_out_time: datetime | None
    last_sign_in: datetime | None
    use_contact: bool
    endpoint: str


class OrganizationInterfaceData(APIResponseModel):
    name: str
    id: str
    users: list[OrganizationMemberData]


async def get_dashboard_data(user: AdminUser) -> OrganizationInterfaceData:
    if user.organization is None:
        raise HTTPException(HTTPStatus.PRECONDITION_FAILED, detail="User is not part of any organization")

    org_doc = await OrganizationDocument.get(user.organization)
    
    if org_doc is None:
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Organization not found")
    
    members_data: list[OrganizationMemberData] = []
    for member_id in org_doc.members:
        member_doc = await MemberUser.get(member_id)
        if member_doc is None:
            continue
        members_data.append(OrganizationMemberData(
            id=str(member_doc.id),
            name=member_doc.name,
            sign_in_time=member_doc.sign_in_time,
            sign_out_time=member_doc.sign_out_time,
            last_sign_in=member_doc.last_signed_in,
            endpoint=member_doc.endpoint,
            contact_name=member_doc.contact_name,
            contact_number=member_doc.contact_number,
            use_contact=member_doc.use_contact
        ))

    return OrganizationInterfaceData(
        name=org_doc.name,
        id=str(org_doc.id),
        users=members_data
    )
