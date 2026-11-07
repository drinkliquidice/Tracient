from __future__ import annotations
import logging
import re

from fastapi import HTTPException
from http import HTTPStatus
from pydantic import Field, ValidationError
from beanie import PydanticObjectId
from beanie.operators import In

from utils import APIResponseModel, EasternDateTime
from src.admin.datadef import AdminUser
from src.organizations.datadef import OrganizationDocument
from src.users.datadef import MemberUser
from src.assets.datadef import AssetDocument, AssetGroupDocument
from src.assets.groups import (
    load_copies_by_group,
    load_group_copies,
    resolve_org_asset_groups_batch,
)

logger = logging.getLogger(__name__)

DEFAULT_PAGE_LIMIT = 50


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
    sign_in_time: EasternDateTime | None
    sign_out_time: EasternDateTime | None
    last_sign_in: EasternDateTime | None
    use_sms: bool
    use_email: bool
    assets: list[str]
    endpoint: str


class OrganizationAssetCopyData(APIResponseModel):
    id: str
    name: str
    endpoint: str
    check_out_time: EasternDateTime | None
    check_in_time: EasternDateTime | None
    checked_out: bool = False
    borrowed_by_member_id: str | None = None
    borrowed_by_member_name: str | None = None


class OrganizationAssetData(APIResponseModel):
    id: str
    name: str
    asset_code: str
    total_quantity: int
    current_quantity: int
    endpoint: str
    check_out_time: EasternDateTime | None
    check_in_time: EasternDateTime | None
    checked_out: bool = False
    copies: list[OrganizationAssetCopyData] = Field(default_factory=list)


class OrganizationMetaData(APIResponseModel):
    id: str
    name: str


class OrganizationInterfaceData(APIResponseModel):
    """Legacy mega-payload kept for compatibility; prefer split endpoints."""

    name: str
    id: str
    users: list[OrganizationMemberData]
    assets: list[OrganizationAssetData]


class PaginatedMembersData(APIResponseModel):
    items: list[OrganizationMemberData]
    total: int
    page: int
    limit: int
    in_center_count: int


class PaginatedAssetsData(APIResponseModel):
    items: list[OrganizationAssetData]
    total: int
    page: int
    limit: int


def _parse_last_name(name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        return ""
    if "," in trimmed:
        return trimmed.split(",", 1)[0].strip()
    parts = trimmed.split()
    return parts[-1] if parts else ""


def last_name_letter(name: str) -> str:
    last = _parse_last_name(name)
    letter = (last[:1] or "#").upper()
    return letter if re.fullmatch(r"[A-Z]", letter) else "#"


def compare_by_last_name(a: MemberUser, b: MemberUser) -> int:
    la, lb = _parse_last_name(a.name).casefold(), _parse_last_name(b.name).casefold()
    if la != lb:
        return -1 if la < lb else 1
    fa = a.name.casefold()
    fb = b.name.casefold()
    if fa == fb:
        return 0
    return -1 if fa < fb else 1


def is_signed_in(member: MemberUser) -> bool:
    sign_in = member.sign_in_time
    sign_out = member.sign_out_time
    if sign_in is None:
        return False
    if sign_out is None:
        return True
    return sign_in > sign_out


def _member_contacts(member_doc: MemberUser) -> list[MemberContactData]:
    prefs_set = member_doc.contact_notify_prefs_set()
    return [
        MemberContactData(
            name=contact.name,
            email=contact.email,
            contact_number=contact.contact_number,
            use_sms=contact.use_sms if prefs_set else member_doc.sms_enabled(),
            use_email=contact.use_email if prefs_set else member_doc.email_enabled(),
        )
        for contact in member_doc.resolved_contacts()
    ]


def member_to_lean(member_doc: MemberUser) -> OrganizationMemberData:
    """List DTO — no borrowed-asset name resolution."""
    return OrganizationMemberData(
        id=str(member_doc.id),
        name=member_doc.name,
        sign_in_time=member_doc.sign_in_time,
        sign_out_time=member_doc.sign_out_time,
        last_sign_in=member_doc.last_signed_in,
        endpoint=member_doc.endpoint,
        contacts=_member_contacts(member_doc),
        use_sms=member_doc.sms_enabled(),
        use_email=member_doc.email_enabled(),
        assets=[],
    )


async def member_to_interface(member_doc: MemberUser) -> OrganizationMemberData:
    """Detail DTO — resolves borrowed asset names in one batch query."""
    asset_ids = list(member_doc.assets or [])
    member_doc_assets: list[str] = []
    kept_asset_ids: list[PydanticObjectId] = []

    if asset_ids:
        try:
            docs = await AssetDocument.find(In(AssetDocument.id, asset_ids)).to_list()
        except Exception:
            logger.warning("Failed to batch-load assets for member %s", member_doc.id, exc_info=True)
            docs = []
        by_id = {doc.id: doc for doc in docs}
        for asset_id in asset_ids:
            asset_doc = by_id.get(asset_id)
            if asset_doc is None:
                continue
            member_doc_assets.append(asset_doc.name)
            kept_asset_ids.append(asset_id)

        if kept_asset_ids != list(member_doc.assets or []):
            try:
                member_doc.assets = kept_asset_ids
                await member_doc.save()
            except Exception:
                logger.warning("Failed to prune dangling assets on member %s", member_doc.id, exc_info=True)

    lean = member_to_lean(member_doc)
    lean.assets = member_doc_assets
    return lean


def copy_to_interface(
    asset_doc: AssetDocument,
    *,
    borrower: MemberUser | None = None,
) -> OrganizationAssetCopyData:
    return OrganizationAssetCopyData(
        id=str(asset_doc.id),
        name=asset_doc.name,
        endpoint=asset_doc.endpoint,
        check_out_time=asset_doc.check_out_time,
        check_in_time=asset_doc.check_in_time,
        checked_out=asset_doc.checked_out,
        borrowed_by_member_id=str(borrower.id) if borrower is not None else None,
        borrowed_by_member_name=borrower.name if borrower is not None else None,
    )


def group_to_interface(
    group: AssetGroupDocument,
    copies: list[AssetDocument],
    *,
    include_copies: bool = True,
    borrowers_by_copy_id: dict[PydanticObjectId, MemberUser] | None = None,
) -> OrganizationAssetData:
    check_out_time = None
    check_in_time = None
    for copy in copies:
        if copy.check_out_time and (check_out_time is None or copy.check_out_time > check_out_time):
            check_out_time = copy.check_out_time
        if copy.check_in_time and (check_in_time is None or copy.check_in_time > check_in_time):
            check_in_time = copy.check_in_time

    total_qty = int(group.total_quantity or 0)
    current_qty = int(group.current_quantity if group.current_quantity is not None else total_qty)
    borrower_map = borrowers_by_copy_id or {}

    return OrganizationAssetData(
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
            copy_to_interface(c, borrower=borrower_map.get(c.id))
            for c in copies
        ] if include_copies else [],
    )


async def build_borrowers_by_copy_id(
    org: OrganizationDocument,
) -> dict[PydanticObjectId, MemberUser]:
    """Map checked-out copy ids to the member currently holding them."""
    members = await _load_org_members(org)
    mapping: dict[PydanticObjectId, MemberUser] = {}
    for member in members:
        for asset_id in list(member.assets or []):
            mapping[asset_id] = member
    return mapping


async def require_org(user: AdminUser) -> OrganizationDocument:
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
    return org_doc


async def get_org_meta(user: AdminUser) -> OrganizationMetaData:
    org = await require_org(user)
    return OrganizationMetaData(id=str(org.id), name=org.name)


async def _load_org_members(org: OrganizationDocument) -> list[MemberUser]:
    member_ids = list(org.members or [])
    if not member_ids:
        return []
    docs = await MemberUser.find(In(MemberUser.id, member_ids)).to_list()
    by_id = {doc.id: doc for doc in docs}
    return [by_id[mid] for mid in member_ids if mid in by_id]


def _member_matches_query(member: MemberUser, q: str) -> bool:
    if not q:
        return True
    if q in member.name.casefold():
        return True
    for contact in member.resolved_contacts():
        if (
            q in contact.name.casefold()
            or q in contact.email.casefold()
            or q in contact.contact_number.casefold()
        ):
            return True
    return False


def _paginate(items: list, page: int, limit: int) -> tuple[list, int, int, int]:
    total = len(items)
    if limit <= 0:
        return items, total, 1, total if total else 0
    page = max(page, 1)
    start = (page - 1) * limit
    return items[start : start + limit], total, page, limit


async def list_members(
    user: AdminUser,
    *,
    q: str = "",
    letter: str | None = None,
    in_center: bool = False,
    page: int = 1,
    limit: int = DEFAULT_PAGE_LIMIT,
) -> PaginatedMembersData:
    org = await require_org(user)
    members = await _load_org_members(org)
    members.sort(key=lambda m: (_parse_last_name(m.name).casefold(), m.name.casefold()))

    in_center_count = sum(1 for m in members if is_signed_in(m))
    query = q.strip().casefold()
    letter_filter = letter.strip().upper() if letter else None
    if letter_filter == "":
        letter_filter = None

    filtered = [
        m for m in members
        if (not in_center or is_signed_in(m))
        and (not letter_filter or last_name_letter(m.name) == letter_filter)
        and _member_matches_query(m, query)
    ]
    page_items, total, page, limit = _paginate(filtered, page, limit)
    return PaginatedMembersData(
        items=[member_to_lean(m) for m in page_items],
        total=total,
        page=page,
        limit=limit,
        in_center_count=in_center_count,
    )


async def get_member_detail(user: AdminUser, member_id: str) -> OrganizationMemberData:
    org = await require_org(user)
    try:
        oid = PydanticObjectId(member_id)
    except Exception as e:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Invalid member id") from e

    if oid not in list(org.members or []):
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found in organization")

    member = await MemberUser.get(oid)
    if member is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")
    return await member_to_interface(member)


def _asset_matches_query(group: AssetGroupDocument, q: str) -> bool:
    if not q:
        return True
    return q in (group.name or "").casefold() or q in group.resolved_asset_code().casefold()


async def list_assets(
    user: AdminUser,
    *,
    q: str = "",
    page: int = 1,
    limit: int = DEFAULT_PAGE_LIMIT,
    include_copies: bool = False,
) -> PaginatedAssetsData:
    org = await require_org(user)
    groups, _ = await resolve_org_asset_groups_batch(org)
    query = q.strip().casefold()
    filtered = [g for g in groups if _asset_matches_query(g, query)]
    filtered.sort(key=lambda g: g.resolved_asset_code().casefold())

    page_groups, total, page, limit = _paginate(filtered, page, limit)
    copies_map = await load_copies_by_group(page_groups)
    borrowers = await build_borrowers_by_copy_id(org) if include_copies else None
    items = [
        group_to_interface(
            group,
            copies_map.get(group.id, []),
            include_copies=include_copies,
            borrowers_by_copy_id=borrowers,
        )
        for group in page_groups
    ]
    return PaginatedAssetsData(items=items, total=total, page=page, limit=limit)


async def get_asset_detail(user: AdminUser, asset_id: str) -> OrganizationAssetData:
    org = await require_org(user)
    try:
        oid = PydanticObjectId(asset_id)
    except Exception as e:
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="Invalid asset id") from e

    groups, _ = await resolve_org_asset_groups_batch(org)
    group = next((g for g in groups if g.id == oid), None)
    if group is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Asset not found in organization")

    copies = await load_group_copies(group)
    borrowers = await build_borrowers_by_copy_id(org)
    return group_to_interface(
        group,
        copies,
        include_copies=True,
        borrowers_by_copy_id=borrowers,
    )


async def list_all_assets_with_copies(user: AdminUser) -> list[OrganizationAssetData]:
    result = await list_assets(user, q="", page=1, limit=0, include_copies=True)
    return result.items


async def get_dashboard_data(user: AdminUser) -> OrganizationInterfaceData:
    """Thin compatibility payload: org meta + empty lists. Prefer split endpoints."""
    meta = await get_org_meta(user)
    return OrganizationInterfaceData(
        name=meta.name,
        id=meta.id,
        users=[],
        assets=[],
    )
