from __future__ import annotations
from beanie import Document, PydanticObjectId
from datetime import datetime

from settings import settings

class AssetDocument(Document):
    name: str
    quantity: int
    endpoint: str
    check_out_time: datetime | None
    check_in_time: datetime | None
    checked_out: bool = False

    class Settings:
        name = "assets"

    @staticmethod
    def assemble(name: str, quantity: int) -> AssetDocument:
        doc_id = PydanticObjectId()
        asset_endpoint = settings.TRACIENT_URL + "admin/asset/" + str(doc_id)
        return AssetDocument(
            id=doc_id,
            name=name,
            quantity=quantity,
            endpoint=asset_endpoint,
            check_out_time=None,
            check_in_time=None,
            checked_out=False,
        )
