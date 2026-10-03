from __future__ import annotations
from http import HTTPStatus
import logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException
from utils import APIRequestModel
from src.assets.datadef import AssetDocument, AssetGroupDocument
from src.assets.create import assert_asset_code_available, group_to_interface
from src.assets.groups import load_group_copies, resolve_org_asset_group
from src.organizations.datadef import OrganizationDocument
from src.organizations.interface import OrganizationAssetData


class UpdateAssetForm(APIRequestModel):
    org_id: str
    asset_id: str
    name: str
    asset_code: str
    total_quantity: int
    current_quantity: int | None = None
    delete_asset: bool


async def _delete_asset_group(
    org: OrganizationDocument,
    group: AssetGroupDocument,
) -> None:
    copies = await load_group_copies(group)
    for copy in copies:
        try:
            await copy.delete()
        except Exception as e:
            logger.error(f"Failed to delete asset copy {copy.id}: {e}", exc_info=True)
            raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to delete asset")

    await group.delete()
    try:
        await org.update({"$pull": {"assets": group.id}})
    except Exception as pull_err:
        logger.error(f"Failed to remove asset group from org, restoring: {pull_err}", exc_info=True)
        # Best-effort restore of group shell; copies already gone
        await group.insert()
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to delete asset")


async def _resize_group_copies(
    group: AssetGroupDocument,
    copies: list[AssetDocument],
    new_total: int,
    name: str,
) -> list[AssetDocument]:
    current_total = len(copies)
    if new_total == current_total:
        for copy in copies:
            if copy.name != name:
                copy.name = name
                await copy.save()
        return copies

    if new_total > current_total:
        added = [
            AssetDocument.assemble(name=name, group_id=group.id)
            for _ in range(new_total - current_total)
        ]
        await AssetDocument.insert_many(added)
        copies = copies + added
    else:
        available = [c for c in copies if not c.checked_out]
        to_remove_count = current_total - new_total
        if len(available) < to_remove_count:
            raise HTTPException(
                HTTPStatus.BAD_REQUEST,
                detail=(
                    f"Cannot reduce quantity to {new_total}: "
                    f"only {len(available)} available copies (not checked out)"
                ),
            )
        remove = available[-to_remove_count:]
        remove_ids = {c.id for c in remove}
        for copy in remove:
            await copy.delete()
        copies = [c for c in copies if c.id not in remove_ids]
        for copy in copies:
            if copy.name != name:
                copy.name = name
                await copy.save()

    group.assets = [c.id for c in copies]
    group.sync_quantities_from_copies(copies)
    return copies


async def update_asset(form: UpdateAssetForm) -> OrganizationAssetData | None:
    org = await OrganizationDocument.get(form.org_id)
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")

    group = await resolve_org_asset_group(org, form.asset_id)
    if group is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found")

    try:
        if form.delete_asset:
            await _delete_asset_group(org, group)
            return None

        if form.total_quantity <= 0:
            raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Total quantity must be greater than 0")
        if not form.asset_code.strip():
            raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset code is required")

        await assert_asset_code_available(
            org,
            form.asset_code,
            exclude_group_id=str(group.id),
        )

        copies = await load_group_copies(group)
        copies = await _resize_group_copies(
            group,
            copies,
            form.total_quantity,
            form.name.strip(),
        )

        group.name = form.name.strip()
        group.asset_code = form.asset_code.strip()
        group.assets = [c.id for c in copies]
        group.sync_quantities_from_copies(copies)
        await group.save()

        refreshed = await AssetGroupDocument.get(group.id)
        if refreshed is None:
            raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found")
        refreshed_copies = await load_group_copies(refreshed)
        return group_to_interface(refreshed, refreshed_copies)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update asset: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update asset")
