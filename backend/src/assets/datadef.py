from __future__ import annotations
from beanie import Document, PydanticObjectId
from datetime import datetime
from pydantic import Field

from settings import settings


class AssetGroupDocument(Document):
    """Logical asset type — groups duplicate/copy instances under one name."""

    name: str
    asset_code: str = ""
    total_quantity: int
    current_quantity: int
    assets: list[PydanticObjectId] = Field(default_factory=list)

    class Settings:
        name = "assetGroups"

    def resolved_asset_code(self) -> str:
        code = (self.asset_code or "").strip()
        if code:
            return code
        return str(self.id)

    def sync_quantities_from_copies(self, copies: list[AssetDocument]) -> None:
        self.total_quantity = len(copies)
        self.current_quantity = sum(1 for c in copies if not c.checked_out)

    @staticmethod
    def assemble(
        name: str,
        total_quantity: int,
        asset_code: str | None = None,
        assets: list[PydanticObjectId] | None = None,
    ) -> AssetGroupDocument:
        doc_id = PydanticObjectId()
        code = (asset_code or "").strip() or str(doc_id)
        qty = max(total_quantity, 0)
        return AssetGroupDocument(
            id=doc_id,
            name=name,
            asset_code=code,
            total_quantity=qty,
            current_quantity=qty,
            assets=list(assets or []),
        )


class AssetDocument(Document):
    """Individual physical copy of an asset — each has its own QR code."""

    name: str
    group_id: PydanticObjectId | None = None
    endpoint: str
    check_out_time: datetime | None = None
    check_in_time: datetime | None = None
    checked_out: bool = False
    # Legacy fields from pre-group documents (kept for migration)
    asset_code: str = ""
    total_quantity: int | None = None
    current_quantity: int | None = None
    quantity: int | None = None

    class Settings:
        name = "assets"

    def is_legacy(self) -> bool:
        """True when this document still stores quantity on the asset itself."""
        return self.group_id is None and (
            self.total_quantity is not None
            or self.current_quantity is not None
            or self.quantity is not None
        )

    def resolved_total(self) -> int:
        if self.total_quantity is not None:
            return self.total_quantity
        return self.quantity or 0

    def resolved_current(self) -> int:
        if self.current_quantity is not None:
            return self.current_quantity
        return self.quantity or 0

    @staticmethod
    def assemble(
        name: str,
        group_id: PydanticObjectId,
        *,
        checked_out: bool = False,
        check_out_time: datetime | None = None,
        check_in_time: datetime | None = None,
    ) -> AssetDocument:
        doc_id = PydanticObjectId()
        asset_endpoint = settings.TRACIENT_URL + "admin/asset/" + str(doc_id)
        return AssetDocument(
            id=doc_id,
            name=name,
            group_id=group_id,
            endpoint=asset_endpoint,
            check_out_time=check_out_time,
            check_in_time=check_in_time,
            checked_out=checked_out,
            asset_code="",
            total_quantity=None,
            current_quantity=None,
            quantity=None,
        )
