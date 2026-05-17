from __future__ import annotations
from datetime import datetime
from http import HTTPStatus
import logging
from fastapi import HTTPException
from utils import APIRequestModel, APIResponseModel
from src.admin.datadef import AdminUser
from src.assets.datadef import AssetDocument
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser
from beanie import PydanticObjectId


logger = logging.getLogger(__name__)

class AssetCirculationForm(APIRequestModel):
    asset_id: str
    member_id: str
    time: datetime
    check_out: bool

class CirculateResponse(APIResponseModel):
    member_name: str
    asset_name: str
    remaining_quantity: int

async def circulate_asset(form: AssetCirculationForm, admin: AdminUser) -> CirculateResponse:
    asset = await AssetDocument.get(form.asset_id)
    org = await OrganizationDocument.get(admin.organization)
    member = await MemberUser.get(form.member_id)
    if asset is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found")
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")
    if member is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")

    if PydanticObjectId(form.asset_id) not in org.assets:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset does not belong to organization")
    if form.check_out and asset.quantity <= 0:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="No available quantity to check out")
    
    try:
        if form.check_out:
            await asset.update({"$inc": {"quantity": -1}})
        else:
            await asset.update({"$inc": {"quantity": 1}})
        
    except Exception as e:
        logger.error(f"Failed to update asset quantity: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update asset circulation")
    
    try:
        if form.check_out:
            await member.update({"$push": {"assets": PydanticObjectId(form.asset_id)}})
        else:
            await member.update({"$pull": {"assets": PydanticObjectId(form.asset_id)}})
    except Exception as e:
        logger.error(f"Failed to update member asset list: {e}", exc_info=True)
        # Attempt to rollback asset quantity update
        try:
            if form.check_out:
                await asset.update({"$inc": {"quantity": 1}})
            else:
                await asset.update({"$inc": {"quantity": -1}})
        except Exception as rollback_err:
            logger.critical(f"Failed to rollback asset quantity after member update failure: {rollback_err}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update member asset list")

    return CirculateResponse(
        member_name=member.name,
        asset_name=asset.name,
        remaining_quantity=asset.quantity + (-1 if form.check_out else 1),
    )