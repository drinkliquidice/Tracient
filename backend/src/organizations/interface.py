from __future__ import annotations
from datetime import datetime
import logging

from fastapi import HTTPException
from http import HTTPStatus
from pydantic import Field, ValidationError

from utils import APIResponseModel
from src.admin.datadef import AdminUser
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser
from src.assets.datadef import AssetDocument
from src.assets.groups import load_group_copies, resolve_org_asset_group

logger = logging.getLogger(__name__)


class MemberContactData(APIResponseModel):
    name: str
    email: str
    contact_number: str
    use_sms: bool = False
    use_email: bool = False

class OrganizationMemberData(APIResponseModel):
    id: str
    name: str
    contacts: list[MemberContactData]
    sign_in_time: datetime | None 
    sign_out_time: datetime | None
    last_sign_in: datetime | None
    use_sms: bool
    use_email: bool
    assets: list[str]
    endpoint: str

class OrganizationAssetCopyData(APIResponseModel):
    id: str
    name: str
    endpoint: str
    check_out_time: datetime | None
    check_in_time: datetime | None
    checked_out: bool = False

class OrganizationAssetData(APIResponseModel):
    id: str
    name: str
    asset_code: str
    total_quantity: int
    current_quantity: int
    endpoint: str
    check_out_time: datetime | None
    check_in_time: datetime | None
    checked_out: bool = False
    copies: list[OrganizationAssetCopyData] = Field(default_factory=list)

class OrganizationInterfaceData(APIResponseModel):
    name: str
    id: str
    users: list[OrganizationMemberData]
    assets: list[OrganizationAssetData]


async def member_to_interface(member_doc: MemberUser) -> OrganizationMemberData:
    member_doc_assets: list[str] = []
    kept_asset_ids = []
    for asset_id in member_doc.assets or []:
        try:
            asset_doc = await AssetDocument.get(asset_id)
        except Exception:
            logger.warning("Skipping invalid member asset id %s on member %s", asset_id, member_doc.id)
            continue
        if asset_doc is None:
            continue
        member_doc_assets.append(asset_doc.name)
        kept_asset_ids.append(asset_id)

    # Drop dangling refs left after a manual assets wipe.
    if kept_asset_ids != list(member_doc.assets or []):
        try:
            member_doc.assets = kept_asset_ids
            await member_doc.save()
        except Exception:
            logger.warning("Failed to prune dangling assets on member %s", member_doc.id, exc_info=True)

    prefs_set = member_doc.contact_notify_prefs_set()
    member_contacts = [
        MemberContactData(
            name=contact.name,
            email=contact.email,
            contact_number=contact.contact_number,
            use_sms=contact.use_sms if prefs_set else member_doc.sms_enabled(),
            use_email=contact.use_email if prefs_set else member_doc.email_enabled(),
        )
        for contact in member_doc.resolved_contacts()
    ]
    return OrganizationMemberData(
        id=str(member_doc.id),
        name=member_doc.name,
        sign_in_time=member_doc.sign_in_time,
        sign_out_time=member_doc.sign_out_time,
        last_sign_in=member_doc.last_signed_in,
        endpoint=member_doc.endpoint,
        contacts=member_contacts,
        use_sms=member_doc.sms_enabled(),
        use_email=member_doc.email_enabled(),
        assets=member_doc_assets,
    )


async def get_dashboard_data(user: AdminUser) -> OrganizationInterfaceData:
    if user.organization is None:
        raise HTTPException(HTTPStatus.PRECONDITION_FAILED, detail="User is not part of any organization")

    try:
        org_doc = await OrganizationDocument.get(user.organization)
    except ValidationError as e:
        logger.error("Organization %s failed validation after DB edit: %s", user.organization, e)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Organization document is invalid — check assets/members arrays are real arrays, not null",
        ) from e

    if org_doc is None:
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Organization not found")

    members_data: list[OrganizationMemberData] = []
    assets_data: list[OrganizationAssetData] = []
    for member_id in org_doc.members or []:
        try:
            member_doc = await MemberUser.get(member_id)
        except ValidationError:
            logger.warning("Skipping invalid member document %s", member_id, exc_info=True)
            continue
        if member_doc is None:
            continue
        try:
            members_data.append(await member_to_interface(member_doc))
        except Exception:
            logger.warning("Skipping member %s while building dashboard", member_id, exc_info=True)
            continue

    # Re-fetch org in case legacy assets were migrated (assets list rewritten)
    try:
        org_doc = await OrganizationDocument.get(user.organization)
    except ValidationError as e:
        logger.error("Organization %s failed validation on re-fetch: %s", user.organization, e)
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Organization document is invalid — check assets/members arrays are real arrays, not null",
        ) from e
    if org_doc is None:
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Organization not found")

    # Prune org.assets entries that no longer resolve after a wipe.
    resolved_asset_ids = []
    for asset_id in list(org_doc.assets or []):
        try:
            group = await resolve_org_asset_group(org_doc, asset_id)
        except Exception:
            logger.warning("Skipping broken org asset id %s", asset_id, exc_info=True)
            continue
        if group is None:
            continue
        resolved_asset_ids.append(group.id)
        try:
            copies = await load_group_copies(group)
            check_out_time = None
            check_in_time = None
            for copy in copies:
                if copy.check_out_time and (check_out_time is None or copy.check_out_time > check_out_time):
                    check_out_time = copy.check_out_time
                if copy.check_in_time and (check_in_time is None or copy.check_in_time > check_in_time):
                    check_in_time = copy.check_in_time
            total_qty = int(group.total_quantity or 0)
            current_qty = int(group.current_quantity if group.current_quantity is not None else total_qty)
            assets_data.append(OrganizationAssetData(
                id=str(group.id),
                name=group.name or "TEMP",
                asset_code=group.resolved_asset_code(),
                total_quantity=total_qty,
                current_quantity=current_qty,
                endpoint=copies[0].endpoint if copies else "",
                check_out_time=check_out_time,
                check_in_time=check_in_time,
                checked_out=current_qty < total_qty,
                copies=[
                    OrganizationAssetCopyData(
                        id=str(copy.id),
                        name=copy.name,
                        endpoint=copy.endpoint,
                        check_out_time=copy.check_out_time,
                        check_in_time=copy.check_in_time,
                        checked_out=copy.checked_out,
                    )
                    for copy in copies
                ],
            ))
        except Exception:
            logger.warning("Skipping asset group %s while building dashboard", group.id, exc_info=True)
            continue

    if list(org_doc.assets or []) != resolved_asset_ids:
        try:
            org_doc.assets = resolved_asset_ids
            await org_doc.save()
        except Exception:
            logger.warning("Failed to prune dangling org.assets on %s", org_doc.id, exc_info=True)

    return OrganizationInterfaceData(
        name=org_doc.name,
        id=str(org_doc.id),
        users=members_data,
        assets=assets_data
    )
