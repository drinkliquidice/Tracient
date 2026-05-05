import datetime

from fastapi import HTTPException
from http import HTTPStatus

from utils import APIRequestModel
from src.database.mongodb import mongo
from src.admin.datadef import AdminUser


class OrganizationMemberData(APIRequestModel):
    name: str
    contact_name: str
    contact_number: str
    sign_in_time: datetime
    sign_out_time: datetime
    last_sign_in: datetime


class OrganizationInterfaceData(APIRequestModel):
    name: str
    users: list[OrganizationMemberData]


async def get_dashboard_data(user: AdminUser) -> OrganizationInterfaceData:
    if user.organization is None:
        raise HTTPException(HTTPStatus.PRECONDITION_FAILED, detail="User is not part of any organization")

    org_doc = await mongo["organizations"].find_one({"_id": user.organization})
    
    if org_doc is None:
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Organization not found")

