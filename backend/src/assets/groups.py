from __future__ import annotations

from beanie import PydanticObjectId

from src.assets.datadef import AssetDocument, AssetGroupDocument
from src.organizations.datadef import OrganizationDocument


async def load_group_copies(group: AssetGroupDocument) -> list[AssetDocument]:
    copies: list[AssetDocument] = []
    for asset_id in group.assets:
        asset = await AssetDocument.get(asset_id)
        if asset is not None:
            copies.append(asset)
    return copies


async def migrate_legacy_asset(
    org: OrganizationDocument,
    legacy: AssetDocument,
) -> AssetGroupDocument:
    """Convert a pre-group AssetDocument into an AssetGroup + individual copies."""
    total = max(legacy.resolved_total(), 1)
    current = legacy.resolved_current()
    if current < 0:
        current = 0
    if current > total:
        current = total
    checked_out_count = total - current

    group = AssetGroupDocument.assemble(
        name=legacy.name,
        total_quantity=total,
        asset_code=legacy.asset_code or str(legacy.id),
    )

    copies: list[AssetDocument] = []
    for index in range(total):
        is_out = index < checked_out_count
        copies.append(
            AssetDocument.assemble(
                name=legacy.name,
                group_id=group.id,
                checked_out=is_out,
                check_out_time=legacy.check_out_time if is_out else None,
                check_in_time=legacy.check_in_time if not is_out else None,
            )
        )

    group.assets = [c.id for c in copies]
    group.total_quantity = total
    group.current_quantity = current

    await AssetDocument.insert_many(copies)
    await group.insert()

    # Replace legacy asset id with the new group id on the org
    updated_assets = []
    for asset_id in org.assets:
        if asset_id == legacy.id:
            updated_assets.append(group.id)
        else:
            updated_assets.append(asset_id)
    org.assets = updated_assets
    await org.save()

    try:
        await legacy.delete()
    except Exception:
        pass

    return group


async def resolve_org_asset_group(
    org: OrganizationDocument,
    identifier: PydanticObjectId | str,
) -> AssetGroupDocument | None:
    """Resolve an org.assets entry as an AssetGroup, migrating legacy assets if needed."""
    try:
        object_id = (
            identifier
            if isinstance(identifier, PydanticObjectId)
            else PydanticObjectId(str(identifier))
        )
    except Exception:
        return None

    group = await AssetGroupDocument.get(object_id)
    if group is not None:
        return group

    legacy = await AssetDocument.get(object_id)
    if legacy is None:
        return None
    if not legacy.is_legacy():
        # Orphaned individual copy — not a list entry
        return None
    return await migrate_legacy_asset(org, legacy)


async def find_group_for_asset(
    asset: AssetDocument,
    org: OrganizationDocument | None = None,
) -> AssetGroupDocument | None:
    if asset.group_id is not None:
        return await AssetGroupDocument.get(asset.group_id)
    if org is not None and asset.is_legacy() and asset.id in org.assets:
        return await migrate_legacy_asset(org, asset)
    return None
