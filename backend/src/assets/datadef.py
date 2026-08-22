from __future__ import annotations
from beanie import Document, PydanticObjectId
from datetime import datetime

from settings import settings

class AssetDocument(Document):
    name: str
    total_quantity: int | None = None
    current_quantity: int | None = None
    # Legacy single stock field from earlier documents
    quantity: int | None = None
    endpoint: str
    check_out_time: datetime | None
    check_in_time: datetime | None
    checked_out: bool = False

    class Settings:
        name = "assets"

    def resolved_total(self) -> int:
        if self.total_quantity is not None:
            return self.total_quantity
        return self.quantity or 0

    def resolved_current(self) -> int:
        if self.current_quantity is not None:
            return self.current_quantity
        return self.quantity or 0

    def ensure_quantities(self) -> None:
        self.total_quantity = self.resolved_total()
        self.current_quantity = self.resolved_current()

    @staticmethod
    def assemble(name: str, total_quantity: int) -> AssetDocument:
        doc_id = PydanticObjectId()
        asset_endpoint = settings.TRACIENT_URL + "admin/asset/" + str(doc_id)
        return AssetDocument(
            id=doc_id,
            name=name,
            total_quantity=total_quantity,
            current_quantity=total_quantity,
            quantity=None,
            endpoint=asset_endpoint,
            check_out_time=None,
            check_in_time=None,
            checked_out=False,
        )
