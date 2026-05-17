from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException
from utils import APIRequestModel
from src.assets.datadef import AssetDocument
from src.organizations.datadef import OrganizationDocument
from beanie.odm.fields import PydanticObjectId

class UpdateAssetForm(APIRequestModel):
    org_id: str
    asset_id: str
    name: str
    quantity: int
    delete_asset: bool

async def update_asset(form: UpdateAssetForm) -> None:
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
            return

        await asset.update({"$set": {
            "name": form.name,
            "quantity": form.quantity,
        }})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update asset: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update asset")