from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)

from fastapi import HTTPException

from settings import settings
from utils import APIRequestModel
from src.users.datadef import MemberUser

from src.organizations.datadef import OrganizationDocument

class NewAssetForm(APIRequestModel):
    org_id: str
    name: str
    quantity: int

    def create_document(self) -> MemberUser:
        return MemberUser.assemble(
            name=self.name,
            quantity=self.quantity,
        )


async def create_new_asset(form: NewAssetForm) -> None:
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