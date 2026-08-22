from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException
from utils import APIRequestModel
from src.assets.datadef import AssetDocument
from src.organizations.datadef import OrganizationDocument
from src.assets.create import asset_to_interface
from src.organizations.interface import OrganizationAssetData
from beanie.odm.fields import PydanticObjectId

class UpdateAssetForm(APIRequestModel):
    org_id: str
    asset_id: str
    name: str
    total_quantity: int
    current_quantity: int
    delete_asset: bool

async def update_asset(form: UpdateAssetForm) -> OrganizationAssetData | None:
    asset = await AssetDocument.get(form.asset_id)
    if asset is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found")

    try:
        if form.delete_asset:
            await asset.delete()
            try:
                org = await OrganizationDocument.get(form.org_id)
                if org is None:
                    raise ValueError(f"Organization {form.org_id} not found")
                await org.update({"$pull": {"assets": PydanticObjectId(form.asset_id)}})
            except Exception as pull_err:
                logger.error(f"Failed to remove asset from org, restoring asset document: {pull_err}", exc_info=True)
                await asset.insert()
                raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to delete asset")
            return None

        if form.total_quantity <= 0:
            raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Total quantity must be greater than 0")
        if form.current_quantity < 0:
            raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Current quantity cannot be negative")
        if form.current_quantity > form.total_quantity:
            raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Current quantity cannot exceed total quantity")

        asset.name = form.name
        asset.total_quantity = form.total_quantity
        asset.current_quantity = form.current_quantity
        asset.checked_out = form.current_quantity < form.total_quantity
        asset.quantity = None
        await asset.save()
        refreshed = await AssetDocument.get(form.asset_id)
        if refreshed is None:
            raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found")
        return asset_to_interface(refreshed)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update asset: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update asset")