from fastapi import HTTPException
from http import HTTPStatus

from utils import APIRequestModel
from src.database.mongodb import mongo
from src.admin.datadef import AdminUser


class OrganizationInfo(APIRequestModel):
    name: str
    num_users: int
    num_assets: int


class DashboardData(APIRequestModel):
    organization_info: OrganizationInfo


async def get_dashboard_data(user: AdminUser) -> DashboardData:
    
    if user.organization is None:
        raise HTTPException(HTTPStatus.PRECONDITION_FAILED, detail="User is not part of any organization")

    org_doc = await mongo["organizations"].find_one({"_id": user.organization})
    
    if org_doc is None:
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Organization not found")
    
    org_info = OrganizationInfo(
        name=org_doc.name,
        num_users=len(org_doc.members),
        num_assets=len(org_doc.assets),
    )
    return DashboardData(organization_info=org_info)