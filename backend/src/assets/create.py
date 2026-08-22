from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)

from fastapi import HTTPException

from utils import APIRequestModel
from src.assets.datadef import AssetDocument
from src.organizations.datadef import OrganizationDocument
from src.organizations.interface import OrganizationAssetData


class NewAssetForm(APIRequestModel):
    org_id: str
    name: str
    total_quantity: int

    def create_document(self) -> AssetDocument:
        return AssetDocument.assemble(
            name=self.name,
            total_quantity=self.total_quantity,
        )


def asset_to_interface(asset_doc: AssetDocument) -> OrganizationAssetData:
    return OrganizationAssetData(
        id=str(asset_doc.id),
        name=asset_doc.name,
        total_quantity=asset_doc.resolved_total(),
        current_quantity=asset_doc.resolved_current(),
        endpoint=asset_doc.endpoint,
        check_out_time=asset_doc.check_out_time,
        check_in_time=asset_doc.check_in_time,
        checked_out=asset_doc.checked_out,
    )


async def create_new_asset(form: NewAssetForm) -> OrganizationAssetData:
    if form.total_quantity <= 0:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Total quantity must be greater than 0")
    asset_doc = form.create_document()
    try:
        await asset_doc.insert()
    except Exception as e:
        logger.error(f"Failed to insert asset: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to create new asset")

    try:
        org = await OrganizationDocument.get(form.org_id)
        if org is None:
            await asset_doc.delete()
            raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")
        await org.update({"$push": {"assets": asset_doc.id}})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add asset to org: {e}", exc_info=True)
        await asset_doc.delete()
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to add asset to organization")

    return asset_to_interface(asset_doc)
