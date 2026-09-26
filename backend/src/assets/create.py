from __future__ import annotations
import csv
from http import HTTPStatus
from io import StringIO
import logging
logger = logging.getLogger(__name__)

from fastapi import File, Form, HTTPException, UploadFile

from utils import APIRequestModel
from src.assets.datadef import AssetDocument
from src.organizations.datadef import OrganizationDocument
from src.organizations.interface import OrganizationAssetData


class NewAssetForm(APIRequestModel):
    org_id: str
    name: str
    asset_code: str
    total_quantity: int

    def create_document(self) -> AssetDocument:
        return AssetDocument.assemble(
            name=self.name,
            total_quantity=self.total_quantity,
            asset_code=self.asset_code,
        )


class AssetsCsvForm:
    def __init__(
        self,
        org_id: str = Form(...),
        assets_csv: UploadFile = File(...),
    ):
        self.org_id = org_id
        self.assets_csv = assets_csv


MISSING_TEXT = "TEMP"
DEFAULT_ASSET_QUANTITY = 1


def asset_to_interface(asset_doc: AssetDocument) -> OrganizationAssetData:
    return OrganizationAssetData(
        id=str(asset_doc.id),
        name=asset_doc.name,
        asset_code=asset_doc.resolved_asset_code(),
        total_quantity=asset_doc.resolved_total(),
        current_quantity=asset_doc.resolved_current(),
        endpoint=asset_doc.endpoint,
        check_out_time=asset_doc.check_out_time,
        check_in_time=asset_doc.check_in_time,
        checked_out=asset_doc.checked_out,
    )


async def assert_asset_code_available(
    org: OrganizationDocument,
    asset_code: str,
    *,
    exclude_asset_id: str | None = None,
) -> None:
    code = asset_code.strip()
    if not code:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset code is required")

    for asset_id in org.assets:
        if exclude_asset_id and str(asset_id) == exclude_asset_id:
            continue
        existing = await AssetDocument.get(asset_id)
        if existing is None:
            continue
        if existing.resolved_asset_code().casefold() == code.casefold():
            raise HTTPException(HTTPStatus.CONFLICT, detail="Asset code already in use")


def _csv_dict_reader(csv_bytes: bytes) -> csv.DictReader:
    text = csv_bytes.decode("utf-8-sig")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
    except csv.Error:
        dialect = csv.excel
    return csv.DictReader(StringIO(text), dialect=dialect)


def parse_assets_from_csv(csv_bytes: bytes) -> list[AssetDocument]:
    reader = _csv_dict_reader(csv_bytes)
    assets: list[AssetDocument] = []
    seen_codes: set[str] = set()
    for row in reader:
        name = (row.get("asset_name") or row.get("name") or "").strip() or MISSING_TEXT
        code = (row.get("asset_code") or row.get("code") or "").strip()
        qty_raw = (row.get("total_quantity") or row.get("quantity") or "").strip()
        if name == MISSING_TEXT and not qty_raw and not code:
            # Completely blank row — skip
            if not any((v or "").strip() for v in row.values()):
                continue
        if not qty_raw:
            total_quantity = DEFAULT_ASSET_QUANTITY
        else:
            try:
                total_quantity = int(qty_raw)
            except (TypeError, ValueError):
                total_quantity = DEFAULT_ASSET_QUANTITY
        if total_quantity <= 0:
            total_quantity = DEFAULT_ASSET_QUANTITY
        asset = AssetDocument.assemble(
            name=name,
            total_quantity=total_quantity,
            asset_code=code or None,
        )
        resolved = asset.resolved_asset_code().casefold()
        if resolved in seen_codes:
            raise HTTPException(
                HTTPStatus.BAD_REQUEST,
                detail=f"Duplicate asset code in CSV: {asset.resolved_asset_code()}",
            )
        seen_codes.add(resolved)
        assets.append(asset)
    if not assets:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Assets CSV must contain at least one asset")
    return assets


async def create_new_asset(form: NewAssetForm) -> OrganizationAssetData:
    if form.total_quantity <= 0:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Total quantity must be greater than 0")
    if not form.asset_code.strip():
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset code is required")

    org = await OrganizationDocument.get(form.org_id)
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")

    await assert_asset_code_available(org, form.asset_code)
    asset_doc = form.create_document()
    try:
        await asset_doc.insert()
    except Exception as e:
        logger.error(f"Failed to insert asset: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to create new asset")

    try:
        await org.update({"$push": {"assets": asset_doc.id}})
    except Exception as e:
        logger.error(f"Failed to add asset to org: {e}", exc_info=True)
        await asset_doc.delete()
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to add asset to organization")

    return asset_to_interface(asset_doc)


async def create_assets_from_csv(form: AssetsCsvForm) -> list[OrganizationAssetData]:
    csv_bytes = await form.assets_csv.read()
    assets = parse_assets_from_csv(csv_bytes)

    org = await OrganizationDocument.get(form.org_id)
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")

    for asset in assets:
        await assert_asset_code_available(org, asset.resolved_asset_code())

    try:
        await AssetDocument.insert_many(assets)
    except Exception as e:
        logger.error(f"Failed to insert assets from CSV: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to create assets from CSV")

    asset_ids = [a.id for a in assets]
    try:
        await org.update({"$push": {"assets": {"$each": asset_ids}}})
    except Exception as e:
        logger.error(f"Failed to add CSV assets to org: {e}", exc_info=True)
        for asset in assets:
            try:
                await asset.delete()
            except Exception:
                pass
        raise HTTPException(
            HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Failed to add assets to organization",
        )

    return [asset_to_interface(a) for a in assets]
