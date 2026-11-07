from __future__ import annotations
from datetime import datetime
from http import HTTPStatus
import logging
from fastapi import HTTPException
from utils import APIRequestModel, APIResponseModel
from src.admin.datadef import AdminUser
from src.assets.datadef import AssetDocument
from src.assets.groups import find_group_for_asset, load_group_copies
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser
from beanie import PydanticObjectId
from beanie.operators import In


logger = logging.getLogger(__name__)

class AssetCirculationForm(APIRequestModel):
    asset_id: str
    member_id: str | None = None
    time: datetime
    check_out: bool

class CirculateResponse(APIResponseModel):
    member_name: str
    asset_name: str
    remaining_quantity: int
    total_quantity: int


async def resolve_asset(identifier: str) -> AssetDocument | None:
    """Resolve a scanned QR payload to an individual asset copy."""
    raw = identifier.strip()
    if not raw:
        return None
    # Endpoint URLs end with the asset id
    if "/" in raw:
        raw = raw.rstrip("/").rsplit("/", 1)[-1]
    try:
        by_id = await AssetDocument.get(PydanticObjectId(raw))
        if by_id is not None:
            return by_id
    except Exception:
        pass
    return None


async def find_member_holding_asset(
    org: OrganizationDocument,
    asset_id: PydanticObjectId,
) -> MemberUser | None:
    """Find the org member whose borrowed-assets list contains this copy."""
    member_ids = list(org.members or [])
    if not member_ids:
        return None
    members = await MemberUser.find(In(MemberUser.id, member_ids)).to_list()
    for member in members:
        if asset_id in list(member.assets or []):
            return member
    return None


async def circulate_asset(form: AssetCirculationForm, admin: AdminUser) -> CirculateResponse:
    asset = await resolve_asset(form.asset_id)
    org = await OrganizationDocument.get(admin.organization)
    if asset is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found")
    if org is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Organization not found")

    member: MemberUser | None = None
    if form.member_id:
        member = await MemberUser.get(form.member_id)
        if member is None:
            raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")
    elif form.check_out:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Member is required to check out")
    else:
        # Check-in can resolve the borrower from the member's asset list
        member = await find_member_holding_asset(org, asset.id)

    group = await find_group_for_asset(asset, org)
    if group is None:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset does not belong to a group")
    if group.id not in org.assets:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Asset does not belong to organization")

    # Refresh asset after possible legacy migration (migration creates new copies)
    if asset.is_legacy():
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail="Asset was migrated to a group; scan a copy QR code instead",
        )

    if form.check_out and asset.checked_out:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="This asset copy is already checked out")
    if not form.check_out and not asset.checked_out:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="This asset copy is already checked in")

    previous_checked_out = asset.checked_out
    previous_check_out_time = asset.check_out_time
    previous_check_in_time = asset.check_in_time
    previous_current = group.current_quantity

    try:
        if form.check_out:
            asset.checked_out = True
            asset.check_out_time = form.time
            group.current_quantity = max(previous_current - 1, 0)
        else:
            asset.checked_out = False
            asset.check_in_time = form.time
            group.current_quantity = min(previous_current + 1, group.total_quantity)
        await asset.save()
        await group.save()
    except Exception as e:
        logger.error(f"Failed to update asset circulation: {e}", exc_info=True)
        raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update asset circulation")

    if member is not None:
        try:
            if form.check_out:
                await member.update({"$push": {"assets": asset.id}})
            else:
                await member.update({"$pull": {"assets": asset.id}})
        except Exception as e:
            logger.error(f"Failed to update member asset list: {e}", exc_info=True)
            try:
                asset.checked_out = previous_checked_out
                asset.check_out_time = previous_check_out_time
                asset.check_in_time = previous_check_in_time
                group.current_quantity = previous_current
                await asset.save()
                await group.save()
            except Exception as rollback_err:
                logger.critical(
                    f"Failed to rollback asset circulation after member update failure: {rollback_err}",
                    exc_info=True,
                )
            raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update member asset list")
    elif not form.check_out:
        logger.warning(
            "Checked in asset %s with no member holding it; asset state updated only",
            asset.id,
        )

    # Keep group quantities aligned with copy states
    copies = await load_group_copies(group)
    group.sync_quantities_from_copies(copies)
    await group.save()

    return CirculateResponse(
        member_name=member.name if member is not None else "Unknown",
        asset_name=group.name,
        remaining_quantity=group.current_quantity,
        total_quantity=group.total_quantity,
    )
