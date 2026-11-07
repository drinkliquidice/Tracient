from __future__ import annotations

from beanie import PydanticObjectId
from beanie.operators import In

from src.assets.datadef import AssetDocument, AssetGroupDocument
from src.organizations.datadef import OrganizationDocument


async def load_copies_for_ids(asset_ids: list[PydanticObjectId]) -> list[AssetDocument]:
    """Batch-load asset copies, preserving the order of asset_ids."""
    if not asset_ids:
        return []
    docs = await AssetDocument.find(In(AssetDocument.id, list(asset_ids))).to_list()
    by_id = {doc.id: doc for doc in docs}
    return [by_id[asset_id] for asset_id in asset_ids if asset_id in by_id]


async def load_group_copies(group: AssetGroupDocument) -> list[AssetDocument]:
    return await load_copies_for_ids(list(group.assets or []))


async def load_copies_by_group(
    groups: list[AssetGroupDocument],
) -> dict[PydanticObjectId, list[AssetDocument]]:
    """One query for all copies across groups, keyed by group id."""
    all_ids: list[PydanticObjectId] = []
    for group in groups:
        all_ids.extend(group.assets or [])
    if not all_ids:
        return {group.id: [] for group in groups}

    docs = await AssetDocument.find(In(AssetDocument.id, all_ids)).to_list()
    by_id = {doc.id: doc for doc in docs}
    return {
        group.id: [by_id[aid] for aid in (group.assets or []) if aid in by_id]
        for group in groups
    }


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


async def resolve_org_asset_groups_batch(
    org: OrganizationDocument,
) -> tuple[list[AssetGroupDocument], bool]:
    """
    Resolve all org.assets entries as groups (migrating legacy as needed).
    Returns (groups_in_org_order, org_was_mutated).
    """
    asset_ids = list(org.assets or [])
    if not asset_ids:
        return [], False

    found = await AssetGroupDocument.find(In(AssetGroupDocument.id, asset_ids)).to_list()
    by_id = {group.id: group for group in found}

    groups: list[AssetGroupDocument] = []
    resolved_ids: list[PydanticObjectId] = []
    mutated = False

    for asset_id in asset_ids:
        group = by_id.get(asset_id)
        if group is not None:
            groups.append(group)
            resolved_ids.append(group.id)
            continue
        # Missing as a group — may be legacy asset needing migration, or a dangling id.
        try:
            group = await resolve_org_asset_group(org, asset_id)
        except Exception:
            mutated = True
            continue
        if group is None:
            mutated = True
            continue
        if group.id != asset_id:
            mutated = True
        groups.append(group)
        resolved_ids.append(group.id)

    if list(org.assets or []) != resolved_ids:
        org.assets = resolved_ids
        try:
            await org.save()
            mutated = True
        except Exception:
            pass

    return groups, mutated
