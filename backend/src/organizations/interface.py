from __future__ import annotations
from datetime import datetime

from fastapi import HTTPException
from http import HTTPStatus

from utils import APIResponseModel
from src.database.mongodb import mongo
from src.admin.datadef import AdminUser
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser
from src.assets.datadef import AssetDocument
    

class OrganizationMemberData(APIResponseModel):
    id: str
    name: str
    contact_name: str
    contact_number: str
    sign_in_time: datetime | None 
    sign_out_time: datetime | None
    last_sign_in: datetime | None
    use_contact: bool
    assets: list[str]
    endpoint: str

class OrganizationAssetData(APIResponseModel):
    id: str
    name: str
    quantity: int
    endpoint: str
    check_out_time: datetime | None
    check_in_time: datetime | None
    checked_out: bool = False

class OrganizationInterfaceData(APIResponseModel):
    name: str
    id: str
    users: list[OrganizationMemberData]
    assets: list[OrganizationAssetData]


async def get_dashboard_data(user: AdminUser) -> OrganizationInterfaceData:
    if user.organization is None:
        raise HTTPException(HTTPStatus.PRECONDITION_FAILED, detail="User is not part of any organization")

    org_doc = await OrganizationDocument.get(user.organization)
    
    if org_doc is None:
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Organization not found")
    
    members_data: list[OrganizationMemberData] = []
    assets_data: list[OrganizationAssetData] = []
    for member_id in org_doc.members:
        member_doc = await MemberUser.get(member_id)
        if member_doc is None:
            continue
        member_doc_assets = []
        for asset_id in member_doc.assets:
            asset_doc = await AssetDocument.get(asset_id)
            if asset_doc is not None:
                member_doc_assets.append(asset_doc.name)
        members_data.append(OrganizationMemberData(
            id=str(member_doc.id),
            name=member_doc.name,
            sign_in_time=member_doc.sign_in_time,
            sign_out_time=member_doc.sign_out_time,
            last_sign_in=member_doc.last_signed_in,
            endpoint=member_doc.endpoint,
            contact_name=member_doc.contact_name,
            contact_number=member_doc.contact_number,
            use_contact=member_doc.use_contact,
            assets=member_doc_assets,
        ))

    for asset_id in org_doc.assets:
        asset_doc = await AssetDocument.get(asset_id)
        if asset_doc is None:
            continue
        assets_data.append(OrganizationAssetData(
            id=str(asset_doc.id),
            name=asset_doc.name,
            quantity=asset_doc.quantity,
            endpoint=asset_doc.endpoint,
            check_out_time=asset_doc.check_out_time,
            check_in_time=asset_doc.check_in_time,
            checked_out=asset_doc.checked_out
        ))

    return OrganizationInterfaceData(
        name=org_doc.name,
        id=str(org_doc.id),
        users=members_data,
        assets=assets_data
    )
