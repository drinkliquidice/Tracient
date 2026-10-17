from __future__ import annotations
import csv
from http import HTTPStatus
from io import StringIO
import logging
logger = logging.getLogger(__name__)

from fastapi import File, Form, HTTPException, UploadFile

from utils import APIRequestModel
from src.assets.datadef import AssetDocument, AssetGroupDocument
from src.assets.groups import load_group_copies, resolve_org_asset_group
from src.organizations.datadef import OrganizationDocument
from src.organizations.interface import OrganizationAssetCopyData, OrganizationAssetData


class NewAssetForm(APIRequestModel):
    org_id: str
    name: str
    asset_code: str
    total_quantity: int


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


def copy_to_interface(asset_doc: AssetDocument) -> OrganizationAssetCopyData:
    return OrganizationAssetCopyData(
        id=str(asset_doc.id),
        name=asset_doc.name,
        endpoint=asset_doc.endpoint,
        check_out_time=asset_doc.check_out_time,
        check_in_time=asset_doc.check_in_time,
        checked_out=asset_doc.checked_out,
    )


def group_to_interface(
    group: AssetGroupDocument,
    copies: list[AssetDocument],
) -> OrganizationAssetData:
    check_out_time = None
    check_in_time = None
    for copy in copies:
        if copy.check_out_time and (check_out_time is None or copy.check_out_time > check_out_time):
            check_out_time = copy.check_out_time
        if copy.check_in_time and (check_in_time is None or copy.check_in_time > check_in_time):
            check_in_time = copy.check_in_time

    return OrganizationAssetData(
        id=str(group.id),
        name=group.name,
        asset_code=group.resolved_asset_code(),
        total_quantity=group.total_quantity,
        current_quantity=group.current_quantity,
        endpoint=copies[0].endpoint if copies else "",
        check_out_time=check_out_time,
        check_in_time=check_in_time,
        checked_out=group.current_quantity < group.total_quantity,
        copies=[copy_to_interface(c) for c in copies],
    )


async def asset_group_to_interface(group: AssetGroupDocument) -> OrganizationAssetData:
    copies = await load_group_copies(group)
    return group_to_interface(group, copies)


async def assert_asset_code_available(
    org: OrganizationDocument,
    asset_code: str,
    *,
    exclude_group_id: str | None = None,
) -> None:
    code = asset_code.strip()
    if not code:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset code is required")

    for asset_id in org.assets:
        if exclude_group_id and str(asset_id) == exclude_group_id:
            continue
        existing = await resolve_org_asset_group(org, asset_id)
        if existing is None:
            continue
        if existing.resolved_asset_code().casefold() == code.casefold():
            raise HTTPException(HTTPStatus.CONFLICT, detail="Asset code already in use")


_ASSET_NAME_KEYS = ("asset_name", "name")
_ASSET_CODE_KEYS = ("asset_code", "code")
_ASSET_QTY_KEYS = ("total_quantity", "quantity")


def _normalize_header_cell(value: str | None) -> str:
    return (value or "").strip().casefold()


def _is_blank_csv_row(row: list[str]) -> bool:
    return not any((cell or "").strip() for cell in row)


def _header_field_map(header_row: list[str]) -> dict[str, int] | None:
    """Map logical field → column index. Ignores unknown columns (e.g. borrowed notes)."""
    indexes: dict[str, int] = {}
    for idx, cell in enumerate(header_row):
        key = _normalize_header_cell(cell)
        if not key:
            continue
        if key in _ASSET_NAME_KEYS and "name" not in indexes:
            indexes["name"] = idx
        elif key in _ASSET_CODE_KEYS and "code" not in indexes:
            indexes["code"] = idx
        elif key in _ASSET_QTY_KEYS and "qty" not in indexes:
            indexes["qty"] = idx
    if "name" in indexes or "code" in indexes or "qty" in indexes:
        return indexes
    return None


def _cell_at(row: list[str], index: int | None) -> str:
    if index is None or index < 0 or index >= len(row):
        return ""
    return (row[index] or "").strip()


def _iter_asset_csv_rows(csv_bytes: bytes):
    """Yield data rows after locating the asset header; only known columns are used."""
    text = csv_bytes.decode("utf-8-sig")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(StringIO(text), dialect=dialect)
    field_map: dict[str, int] | None = None
    for row in reader:
        if _is_blank_csv_row(row):
            continue
        if field_map is None:
            field_map = _header_field_map(row)
            if field_map is not None:
                continue
            # Not a header — skip stray preamble rows from spreadsheet exports.
            continue

        yield {
            "name": _cell_at(row, field_map.get("name")),
            "code": _cell_at(row, field_map.get("code")),
            "qty": _cell_at(row, field_map.get("qty")),
        }

    if field_map is None:
        raise HTTPException(
            HTTPStatus.BAD_REQUEST,
            detail="Assets CSV must include a header with asset_code, asset_name, and/or total_quantity",
        )


def parse_asset_groups_from_csv(csv_bytes: bytes) -> list[tuple[str, str, int]]:
    """Return list of (name, asset_code, total_quantity) rows.

    Extra columns (borrowed notes, blank leading columns, etc.) are ignored.
    Leading blank / preamble rows before the header are skipped.
    """
    rows: list[tuple[str, str, int]] = []
    seen_codes: set[str] = set()
    for row in _iter_asset_csv_rows(csv_bytes):
        name = row["name"] or MISSING_TEXT
        code = row["code"]
        qty_raw = row["qty"]
        if name == MISSING_TEXT and not qty_raw and not code:
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
        resolved_code = code or None
        # Temporary id-like placeholder for uniqueness check before insert
        preview_code = (resolved_code or name).casefold()
        if resolved_code:
            if resolved_code.casefold() in seen_codes:
                raise HTTPException(
                    HTTPStatus.BAD_REQUEST,
                    detail=f"Duplicate asset code in CSV: {resolved_code}",
                )
            seen_codes.add(resolved_code.casefold())
        elif preview_code in seen_codes:
            raise HTTPException(
                HTTPStatus.BAD_REQUEST,
                detail=f"Duplicate asset name in CSV without codes: {name}",
            )
        else:
            seen_codes.add(preview_code)
        rows.append((name, code, total_quantity))
    if not rows:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Assets CSV must contain at least one asset")
    return rows


async def create_asset_group_with_copies(
    *,
    name: str,
    asset_code: str | None,
    total_quantity: int,
) -> tuple[AssetGroupDocument, list[AssetDocument]]:
    group = AssetGroupDocument.assemble(
        name=name,
        total_quantity=total_quantity,
        asset_code=asset_code,
    )
    copies = [
        AssetDocument.assemble(name=name, group_id=group.id)
        for _ in range(total_quantity)
    ]
    group.assets = [c.id for c in copies]
    group.total_quantity = len(copies)
    group.current_quantity = len(copies)
    return group, copies


async def create_new_asset(form: NewAssetForm) -> OrganizationAssetData:
    if form.total_quantity <= 0:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Total quantity must be greater than 0")
    if not form.asset_code.strip():
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset code is required")

    org = await OrganizationDocument.get(form.org_id)
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")

    await assert_asset_code_available(org, form.asset_code)
    group, copies = await create_asset_group_with_copies(
        name=form.name,
        asset_code=form.asset_code,
        total_quantity=form.total_quantity,
    )

    try:
        await AssetDocument.insert_many(copies)
        await group.insert()
    except Exception as e:
        logger.error(f"Failed to insert asset group: {e}", exc_info=True)
        for copy in copies:
            try:
                await copy.delete()
            except Exception:
                pass
        try:
            await group.delete()
        except Exception:
            pass
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to create new asset")

    try:
        await org.update({"$push": {"assets": group.id}})
    except Exception as e:
        logger.error(f"Failed to add asset group to org: {e}", exc_info=True)
        for copy in copies:
            try:
                await copy.delete()
            except Exception:
                pass
        try:
            await group.delete()
        except Exception:
            pass
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to add asset to organization")

    return group_to_interface(group, copies)


async def create_assets_from_csv(form: AssetsCsvForm) -> list[OrganizationAssetData]:
    csv_bytes = await form.assets_csv.read()
    rows = parse_asset_groups_from_csv(csv_bytes)

    org = await OrganizationDocument.get(form.org_id)
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")

    prepared: list[tuple[AssetGroupDocument, list[AssetDocument]]] = []
    for name, code, total_quantity in rows:
        if code:
            await assert_asset_code_available(org, code)
        group, copies = await create_asset_group_with_copies(
            name=name,
            asset_code=code or None,
            total_quantity=total_quantity,
        )
        # Re-check generated codes against org + previously prepared
        await assert_asset_code_available(org, group.resolved_asset_code())
        for existing_group, _ in prepared:
            if existing_group.resolved_asset_code().casefold() == group.resolved_asset_code().casefold():
                raise HTTPException(
                    HTTPStatus.BAD_REQUEST,
                    detail=f"Duplicate asset code in CSV: {group.resolved_asset_code()}",
                )
        prepared.append((group, copies))

    all_copies = [c for _, copies in prepared for c in copies]
    groups = [g for g, _ in prepared]

    try:
        if all_copies:
            await AssetDocument.insert_many(all_copies)
        await AssetGroupDocument.insert_many(groups)
    except Exception as e:
        logger.error(f"Failed to insert assets from CSV: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to create assets from CSV")

    group_ids = [g.id for g in groups]
    try:
        await org.update({"$push": {"assets": {"$each": group_ids}}})
    except Exception as e:
        logger.error(f"Failed to add CSV assets to org: {e}", exc_info=True)
        for copy in all_copies:
            try:
                await copy.delete()
            except Exception:
                pass
        for group in groups:
            try:
                await group.delete()
            except Exception:
                pass
        raise HTTPException(
            HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Failed to add assets to organization",
        )

    return [group_to_interface(g, c) for g, c in prepared]
